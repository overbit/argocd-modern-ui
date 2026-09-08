(() => {
  if (globalThis.__ARGOCD_FULL_GRAPH_FACTORY__) return;

  globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = ({state, esc, badge, tone, health, sync, rerender}) => {
    const view = {mode: 'graph', scale: 1, x: 24, y: 24, selected: null, focusIssues: false, fitPending: true, drag: null};
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const refKey = ref => ref?.uid || [ref?.group || '', ref?.kind || '', ref?.namespace || '', ref?.name || ''].join('|');
    const nodeHealth = node => node?.health?.status || 'Unknown';
    const nodeSync = node => node?.status || 'Unknown';
    const needsAttention = node => ['bad', 'warn'].includes(tone(nodeHealth(node))) || nodeSync(node) === 'OutOfSync';
    const healthySynced = node => nodeHealth(node) === 'Healthy' && nodeSync(node) === 'Synced';
    const encodeKey = value => encodeURIComponent(String(value || ''));
    const decodeKey = value => decodeURIComponent(String(value || ''));
    const kindCode = kind => ({
      Application: 'APP', ApplicationSet: 'AS', Deployment: 'DEP', StatefulSet: 'STS', DaemonSet: 'DS', ReplicaSet: 'RS',
      Pod: 'POD', Service: 'SVC', Ingress: 'ING', ConfigMap: 'CM', Secret: 'SEC', Job: 'JOB', CronJob: 'CRON',
      PersistentVolumeClaim: 'PVC', Namespace: 'NS', Rollout: 'RO', Workflow: 'WF'
    }[kind] || String(kind || 'RES').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'RES');

    const styles = globalThis.__ARGOCD_FULL_GRAPH_STYLES__ || '';

    const isRenderableResource = node => Boolean(
      node && String(node.kind || '').trim() && String(node.name || '').trim()
    );

    function resourceNodes() {
      return [
        ...(state.tree?.nodes || []).map(node => ({...node, __orphaned: false})),
        ...(state.tree?.orphanedNodes || []).map(node => ({...node, __orphaned: true}))
      ].filter(isRenderableResource);
    }

    function buildTopology() {
      const resources = resourceNodes().map(node => ({...node, __key: refKey(node)}));
      const byKey = new Map(resources.map(node => [node.__key, node]));
      const edges = [];
      const incoming = new Map(resources.map(node => [node.__key, 0]));

      for (const node of resources) {
        for (const parentRef of node.parentRefs || []) {
          const parent = refKey(parentRef);
          if (byKey.has(parent) && parent !== node.__key) {
            edges.push({from: parent, to: node.__key});
            incoming.set(node.__key, (incoming.get(node.__key) || 0) + 1);
          }
        }
      }

      resources.filter(node => !node.__orphaned && (incoming.get(node.__key) || 0) === 0).forEach(node => edges.push({from: '__app__', to: node.__key, synthetic: true}));
      const depth = new Map(resources.map(node => [node.__key, 1]));
      for (let pass = 0; pass < resources.length; pass++) {
        let changed = false;
        for (const edge of edges) {
          if (edge.synthetic) continue;
          const next = Math.min(resources.length + 1, (depth.get(edge.from) || 1) + 1);
          if (next > (depth.get(edge.to) || 1)) {
            depth.set(edge.to, next);
            changed = true;
          }
        }
        if (!changed) break;
      }

      const appNode = {__key: '__app__', kind: 'Application', name: state.selected?.metadata?.name || 'Application', namespace: state.selected?.metadata?.namespace || 'argocd', health: {status: health(state.selected)}, status: sync(state.selected), __appNode: true};
      const columns = new Map([[0, [appNode]]]);
      resources.forEach(node => {
        const d = depth.get(node.__key) || 1;
        if (!columns.has(d)) columns.set(d, []);
        columns.get(d).push(node);
      });
      const priority = node => needsAttention(node) ? 0 : node.__orphaned ? 1 : 2;
      for (const [column, nodes] of columns) {
        if (column) nodes.sort((a, b) => priority(a) - priority(b) || String(a.kind || '').localeCompare(String(b.kind || '')) || String(a.name || '').localeCompare(String(b.name || '')));
      }

      const nodeWidth = 216, nodeHeight = 76, appHeight = 82, xGap = 116, yGap = 42, marginX = 70, marginY = 64;
      const maxDepth = Math.max(0, ...columns.keys());
      const maxColumnHeight = Math.max(appHeight, ...[...columns.entries()].map(([column, nodes]) => nodes.length * (column === 0 ? appHeight : nodeHeight) + Math.max(0, nodes.length - 1) * yGap));
      const height = Math.max(560, maxColumnHeight + marginY * 2);
      const width = Math.max(760, marginX * 2 + (maxDepth + 1) * nodeWidth + maxDepth * xGap);
      const positions = new Map();
      for (const [column, nodes] of columns) {
        const itemHeight = column === 0 ? appHeight : nodeHeight;
        const columnHeight = nodes.length * itemHeight + Math.max(0, nodes.length - 1) * yGap;
        let y = Math.max(marginY, (height - columnHeight) / 2);
        const x = marginX + column * (nodeWidth + xGap);
        nodes.forEach(node => {
          const h = node.__appNode ? appHeight : nodeHeight;
          positions.set(node.__key, {x, y, width: nodeWidth, height: h, node});
          y += h + yGap;
        });
      }
      return {resources, edges, positions, width, height};
    }

    function edgePath(from, to) {
      const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2;
      const curve = Math.max(44, Math.min(120, (x2 - x1) * .48));
      return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
    }

    function connectedKeys(topology) {
      if (!view.selected) return new Set();
      const connected = new Set([view.selected]);
      topology.edges.forEach(edge => {
        if (edge.from === view.selected) connected.add(edge.to);
        if (edge.to === view.selected) connected.add(edge.from);
      });
      return connected;
    }

    function drawer(topology) {
      const node = topology.positions.get(view.selected)?.node;
      if (!node) return '';
      const info = node.__appNode ? [] : node.info || [];
      const images = node.__appNode ? [] : node.images || [];
      return `<aside class="topology-drawer"><div class="drawer-head"><div class="drawer-icon">${esc(kindCode(node.kind))}</div><div class="drawer-title"><b>${esc(node.name || node.kind)}</b><small>${esc(node.kind || 'Resource')}</small></div><button class="drawer-close" data-node-close aria-label="Close details">×</button></div><div class="drawer-body"><div class="kv"><span>Namespace</span><b>${esc(node.namespace || '(cluster)')}</b></div><div class="kv"><span>Health</span>${badge(nodeHealth(node))}</div><div class="kv"><span>Sync</span>${badge(nodeSync(node))}</div>${node.__orphaned ? '<div class="kv"><span>Relation</span><b>Orphaned</b></div>' : ''}${info.length ? `<div class="drawer-section"><h4>Resource info</h4>${info.slice(0,12).map(item => `<div class="drawer-line"><b>${esc(item?.name || 'Info')}:</b> ${esc(item?.value || '')}</div>`).join('')}</div>` : ''}${images.length ? `<div class="drawer-section"><h4>Images</h4>${images.slice(0,8).map(image => `<div class="drawer-line">${esc(image)}</div>`).join('')}</div>` : ''}</div></aside>`;
    }

    function graphMarkup() {
      const topology = buildTopology();
      if (!topology.positions.size) return '<div class="topology-empty">No resources returned.</div>';
      const connected = connectedKeys(topology);
      const edges = topology.edges.map(edge => {
        const from = topology.positions.get(edge.from), to = topology.positions.get(edge.to);
        if (!from || !to) return '';
        const active = view.selected && (edge.from === view.selected || edge.to === view.selected);
        return `<path class="topology-edge${active ? ' active' : ''}${view.selected && !active ? ' dim' : ''}" d="${edgePath(from,to)}"/>`;
      }).join('');
      const nodes = [...topology.positions.values()].map(position => {
        const node = position.node;
        const nodeTone = node.__appNode ? tone(health(state.selected)) : tone(nodeHealth(node));
        const selected = view.selected === node.__key;
        const dim = view.selected && !connected.has(node.__key);
        const focusDim = view.focusIssues && !node.__appNode && healthySynced(node);
        return `<button class="topology-node ${nodeTone}${node.__appNode ? ' app-node' : ''}${node.__orphaned ? ' orphan' : ''}${selected ? ' selected' : ''}${dim ? ' dim' : ''}${focusDim ? ' focus-dim' : ''}" style="left:${position.x}px;top:${position.y}px" data-node="${encodeKey(node.__key)}"><span class="port in"></span><span class="node-icon">${esc(kindCode(node.kind))}</span><span class="node-copy"><span class="node-kind">${esc(node.kind || 'Resource')}${node.__orphaned ? ' · orphan' : ''}</span><strong>${esc(node.name || node.kind || 'Resource')}</strong><small>${esc(node.namespace || '(cluster)')}</small></span><span class="node-status"></span><span class="port out"></span></button>`;
      }).join('');
      return `<div class="topology-viewport" data-topology-viewport><div class="topology-stage" data-topology-stage data-width="${topology.width}" data-height="${topology.height}" style="width:${topology.width}px;height:${topology.height}px"><svg class="topology-edges" width="${topology.width}" height="${topology.height}" viewBox="0 0 ${topology.width} ${topology.height}">${edges}</svg>${nodes}</div><div class="topology-controls"><button data-graph-action="zoom-out" title="Zoom out">−</button><button data-graph-action="fit" title="Fit to view">⌗</button><button data-graph-action="zoom-in" title="Zoom in">+</button></div><div class="graph-hint">Drag canvas · wheel to pan · Ctrl/⌘ + wheel to zoom</div>${drawer(topology)}</div>`;
    }

    function listMarkup(nodes) {
      const rows = nodes.slice(0,500).map(node => `<div class="resource"><div class="name"><b>${esc(node?.name)}</b><small>${esc(node?.kind || 'Resource')}${node.__orphaned ? ' · orphan' : ''}</small></div><div class="muted">${esc(node?.namespace || '(cluster)')}</div><div>${badge(nodeHealth(node))}</div><div>${badge(nodeSync(node))}</div></div>`).join('');
      return `<div class="resource-list">${rows || '<div class="empty">No resources returned.</div>'}</div>`;
    }

    function toolbar(nodes = resourceNodes()) {
      const problems = nodes.filter(needsAttention).length;
      return `<div class="topology-toolbar"><div class="segmented"><button data-resource-view="graph" class="${view.mode === 'graph' ? 'active' : ''}">Graph</button><button data-resource-view="list" class="${view.mode === 'list' ? 'active' : ''}">List</button></div>${view.mode === 'graph' ? `<button class="tool-button ${view.focusIssues ? 'active' : ''}" data-focus-issues>${view.focusIssues ? 'Show all' : 'Focus issues'}</button>` : ''}<span class="topology-count">${nodes.length} resources · ${problems} need attention</span><div class="spacer"></div>${view.mode === 'graph' ? '<button class="tool-button" data-graph-action="fit">Fit view</button>' : ''}</div>`;
    }

    function content(nodes = resourceNodes()) {
      return view.mode === 'graph' ? graphMarkup() : listMarkup(nodes);
    }

    function applyTransform() {
      const stage = state.root?.querySelector('[data-topology-stage]');
      if (stage) stage.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
    }

    function fit() {
      const viewport = state.root?.querySelector('[data-topology-viewport]');
      const stage = state.root?.querySelector('[data-topology-stage]');
      if (!viewport || !stage) return;
      const graphWidth = Number(stage.dataset.width || 1), graphHeight = Number(stage.dataset.height || 1);
      const allowance = view.selected ? 330 : 0;
      const availableWidth = Math.max(260, viewport.clientWidth - 54 - allowance);
      const availableHeight = Math.max(260, viewport.clientHeight - 54);
      view.scale = clamp(Math.min(availableWidth / graphWidth, availableHeight / graphHeight), .28, 1.15);
      view.x = Math.max(20, (availableWidth - graphWidth * view.scale) / 2 + 22);
      view.y = Math.max(20, (viewport.clientHeight - graphHeight * view.scale) / 2);
      applyTransform();
    }

    function zoom(factor, clientX, clientY) {
      const viewport = state.root?.querySelector('[data-topology-viewport]');
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const px = (clientX ?? rect.left + rect.width / 2) - rect.left, py = (clientY ?? rect.top + rect.height / 2) - rect.top;
      const previous = view.scale, next = clamp(previous * factor, .28, 1.8);
      const graphX = (px - view.x) / previous, graphY = (py - view.y) / previous;
      view.scale = next; view.x = px - graphX * next; view.y = py - graphY * next; applyTransform();
    }

    function bind() {
      state.root?.querySelectorAll('[data-resource-view]').forEach(node => node.addEventListener('click', () => {
        view.mode = node.dataset.resourceView;
        if (view.mode === 'graph') view.fitPending = true;
        rerender();
      }));
      state.root?.querySelector('[data-focus-issues]')?.addEventListener('click', () => { view.focusIssues = !view.focusIssues; rerender(); });
      state.root?.querySelectorAll('[data-graph-action]').forEach(node => node.addEventListener('click', event => {
        event.stopPropagation();
        if (node.dataset.graphAction === 'fit') fit();
        if (node.dataset.graphAction === 'zoom-in') zoom(1.14);
        if (node.dataset.graphAction === 'zoom-out') zoom(.88);
      }));
      state.root?.querySelectorAll('[data-node]').forEach(node => node.addEventListener('click', event => { event.stopPropagation(); view.selected = decodeKey(node.dataset.node); rerender(); }));
      state.root?.querySelector('[data-node-close]')?.addEventListener('click', event => { event.stopPropagation(); view.selected = null; rerender(); });

      const viewport = state.root?.querySelector('[data-topology-viewport]');
      if (!viewport) return;
      viewport.addEventListener('wheel', event => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) zoom(event.deltaY < 0 ? 1.08 : .92, event.clientX, event.clientY);
        else { view.x -= event.deltaX; view.y -= event.deltaY; applyTransform(); }
      }, {passive:false});
      viewport.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.topology-node,.topology-controls,.topology-drawer,.tool-button')) return;
        view.drag = {id:event.pointerId,startX:event.clientX,startY:event.clientY,x:view.x,y:view.y};
        viewport.classList.add('dragging'); viewport.setPointerCapture(event.pointerId);
      });
      viewport.addEventListener('pointermove', event => {
        if (!view.drag || view.drag.id !== event.pointerId) return;
        view.x = view.drag.x + event.clientX - view.drag.startX; view.y = view.drag.y + event.clientY - view.drag.startY; applyTransform();
      });
      const end = event => { if (view.drag?.id === event.pointerId) { view.drag = null; viewport.classList.remove('dragging'); } };
      viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end);
      viewport.addEventListener('dblclick', event => { if (!event.target.closest('.topology-node,.topology-drawer')) fit(); });
      applyTransform();
      if (view.fitPending) { view.fitPending = false; requestAnimationFrame(fit); }
    }

    function reset() {
      Object.assign(view, {mode:'graph',scale:1,x:24,y:24,selected:null,focusIssues:false,fitPending:true,drag:null});
    }

    return {styles, resourceNodes, needsAttention, toolbar, content, bind, reset};
  };
})();
