(() => {
  if (globalThis.__ARGOCD_FULL_GRAPH_FACTORY__) return;

  globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = ({state, api, fetchText, esc, badge, tone, health, sync, rerender, reloadApp, openOriginal}) => {
    const view = {
      mode: 'tree', scale: 1, x: 24, y: 24, selected: null, resourceTab: 'summary',
      focusIssues: false, fitPending: true, drag: null
    };
    const inspector = new Map();
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const refKey = ref => ref?.uid || [ref?.group || '', ref?.kind || '', ref?.namespace || '', ref?.name || ''].join('|');
    const nodeHealth = node => node?.health?.status || 'Unknown';
    const nodeSync = node => node?.status || 'Unknown';
    const needsAttention = node => ['bad', 'warn'].includes(tone(nodeHealth(node))) || nodeSync(node) === 'OutOfSync';
    const healthySynced = node => nodeHealth(node) === 'Healthy' && nodeSync(node) === 'Synced';
    const encodeKey = value => encodeURIComponent(String(value || ''));
    const decodeKey = value => decodeURIComponent(String(value || ''));
    const appName = () => state.selected?.metadata?.name || '';
    const appNamespace = () => state.selected?.metadata?.namespace || '';
    const kindCode = kind => ({
      Application: 'APP', ApplicationSet: 'AS', Deployment: 'DEP', StatefulSet: 'STS', DaemonSet: 'DS', ReplicaSet: 'RS',
      Pod: 'POD', Service: 'SVC', Ingress: 'ING', ConfigMap: 'CM', Secret: 'SEC', Job: 'JOB', CronJob: 'CRON',
      PersistentVolumeClaim: 'PVC', Namespace: 'NS', Rollout: 'RO', Workflow: 'WF', HorizontalPodAutoscaler: 'HPA', ServiceAccount: 'SA'
    }[kind] || String(kind || 'RES').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'RES');
    const styles = globalThis.__ARGOCD_FULL_GRAPH_STYLES__ || '';
    const qs = values => {
      const search = new URLSearchParams();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) search.set(key, String(value));
      });
      return search.toString();
    };
    const isRenderableResource = node => Boolean(node && String(node.kind || '').trim() && String(node.name || '').trim());

    function resourceNodes() {
      const statusByKey = new Map((state.selected?.status?.resources || []).map(resource => [refKey(resource), resource]));
      return [
        ...(state.tree?.nodes || []).map(node => ({...node, __orphaned: false})),
        ...(state.tree?.orphanedNodes || []).map(node => ({...node, __orphaned: true}))
      ].filter(isRenderableResource).map(node => {
        const status = statusByKey.get(refKey(node));
        return status ? {...node, health: status.health || node.health, status: status.status || node.status, hook: status.hook, requiresPruning: status.requiresPruning} : node;
      });
    }

    function treeEdges(resources) {
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
      return edges;
    }

    function networkEdges(resources) {
      const byKey = new Map(resources.map(node => [node.__key, node]));
      const edges = [];
      const participating = new Set();
      for (const node of resources) {
        for (const targetRef of node.networkingInfo?.targetRefs || []) {
          const target = refKey(targetRef);
          if (byKey.has(target) && target !== node.__key) {
            edges.push({from: node.__key, to: target, network: true});
            participating.add(node.__key);
            participating.add(target);
          }
        }
      }
      if (!edges.length) return {resources, edges: treeEdges(resources), fallback: true};
      const selected = resources.filter(node => participating.has(node.__key));
      const incoming = new Map(selected.map(node => [node.__key, 0]));
      edges.forEach(edge => incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1));
      selected.filter(node => (incoming.get(node.__key) || 0) === 0).forEach(node => edges.push({from: '__app__', to: node.__key, synthetic: true}));
      return {resources: selected, edges, fallback: false};
    }

    function buildTopology() {
      let resources = resourceNodes().map(node => ({...node, __key: refKey(node)}));
      let edges;
      let networkFallback = false;
      if (view.mode === 'network') {
        const network = networkEdges(resources);
        resources = network.resources;
        edges = network.edges;
        networkFallback = network.fallback;
      } else {
        edges = treeEdges(resources);
      }

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

      const appNode = {__key: '__app__', kind: 'Application', name: appName() || 'Application', namespace: appNamespace() || 'argocd', health: {status: health(state.selected)}, status: sync(state.selected), __appNode: true};
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

      const nodeWidth = 232, nodeHeight = 82, appHeight = 88, xGap = 124, yGap = 44, marginX = 72, marginY = 66;
      const maxDepth = Math.max(0, ...columns.keys());
      const maxColumnHeight = Math.max(appHeight, ...[...columns.entries()].map(([column, nodes]) => nodes.length * (column === 0 ? appHeight : nodeHeight) + Math.max(0, nodes.length - 1) * yGap));
      const height = Math.max(580, maxColumnHeight + marginY * 2);
      const width = Math.max(820, marginX * 2 + (maxDepth + 1) * nodeWidth + maxDepth * xGap);
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
      return {resources, edges, positions, width, height, networkFallback};
    }

    function edgePath(from, to) {
      const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2;
      const curve = Math.max(48, Math.min(136, (x2 - x1) * .48));
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

    function originalNodePath(node, tab = 'summary') {
      const fullName = [node.group || '', node.kind || '', node.namespace || '', node.name || ''].join('/');
      return `/applications/${encodeURIComponent(appNamespace())}/${encodeURIComponent(appName())}?node=${encodeURIComponent(`${fullName}/0`)}&tab=${encodeURIComponent(tab)}`;
    }

    function parseSseLogs(text) {
      return String(text || '').split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => {
        try {
          const parsed = JSON.parse(line.slice(5).trim());
          const entry = parsed?.result || parsed;
          return entry?.content || entry?.message || '';
        } catch {
          return line.slice(5).trim();
        }
      }).filter(Boolean).join('\n');
    }

    async function loadInspector(node, force = false) {
      if (!node || node.__appNode) return;
      const key = refKey(node);
      const current = inspector.get(key);
      if (current?.loading || (!force && current?.loaded)) return;
      inspector.set(key, {...current, loading: true, loaded: false, error: ''});
      rerender();
      const id = {name: node.name, namespace: node.namespace || '', kind: node.kind, group: node.group || ''};
      const resourceQuery = qs({
        name: node.name, appNamespace: appNamespace(), namespace: node.namespace || '', resourceName: node.name,
        version: node.version || '', kind: node.kind, group: node.group || ''
      });
      const managedQuery = qs({appNamespace: appNamespace(), ...id});
      const eventsQuery = qs({appNamespace: appNamespace(), resourceUID: node.uid || '', resourceNamespace: node.namespace || '', resourceName: node.name});
      const actionsQuery = qs({appNamespace: appNamespace(), namespace: node.namespace || '', resourceName: node.name, version: node.version || '', kind: node.kind, group: node.group || ''});
      const results = await Promise.allSettled([
        api(`/api/v1/applications/${encodeURIComponent(appName())}/resource?${resourceQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/managed-resources?${managedQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/events?${eventsQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/resource/actions?${actionsQuery}`)
      ]);
      const unwrap = (result, fallback) => result.status === 'fulfilled' ? result.value : fallback;
      const live = unwrap(results[0], null);
      const managedResponse = unwrap(results[1], {items: []});
      const managedItems = Array.isArray(managedResponse) ? managedResponse : managedResponse?.items || [];
      const managed = managedItems.find(item => item?.name === node.name && item?.kind === node.kind && (item?.namespace || '') === (node.namespace || '')) || managedItems[0] || null;
      const eventsResponse = unwrap(results[2], {items: []});
      const events = Array.isArray(eventsResponse) ? eventsResponse : eventsResponse?.items || [];
      const actionsResponse = unwrap(results[3], {actions: []});
      const actions = Array.isArray(actionsResponse) ? actionsResponse : actionsResponse?.actions || [];
      const firstError = results.find(result => result.status === 'rejected');
      inspector.set(key, {
        loaded: true, loading: false, live, managed, events, actions,
        error: firstError ? String(firstError.reason?.message || firstError.reason || '') : '', logs: current?.logs || null
      });
      rerender();
    }

    async function syncResource(node) {
      if (!node || node.__appNode || !confirm(`Sync ${node.kind} “${node.name}”?`)) return;
      const body = {
        appNamespace: appNamespace(),
        resources: [{group: node.group || '', kind: node.kind, namespace: node.namespace || '', name: node.name}]
      };
      await api(`/api/v1/applications/${encodeURIComponent(appName())}/sync`, {method: 'POST', body: JSON.stringify(body)});
      await reloadApp();
    }

    async function deleteResource(node) {
      if (!node || node.__appNode || !confirm(`Delete ${node.kind} “${node.name}” from the cluster?`)) return;
      const query = qs({
        name: node.name, appNamespace: appNamespace(), namespace: node.namespace || '', resourceName: node.name,
        version: node.version || '', kind: node.kind, group: node.group || '', force: false, orphan: false
      });
      await api(`/api/v1/applications/${encodeURIComponent(appName())}/resource?${query}`, {method: 'DELETE'});
      inspector.delete(refKey(node));
      view.selected = null;
      await reloadApp();
    }

    async function runResourceAction(node, action) {
      if (!node || !action) return;
      if ((action.params || action.parameters || []).length) {
        openOriginal(originalNodePath(node, 'summary'));
        return;
      }
      if (!confirm(`Run resource action “${action.name}” on ${node.kind} “${node.name}”?`)) return;
      const body = {
        appNamespace: appNamespace(), namespace: node.namespace || '', resourceName: node.name,
        version: node.version || '', kind: node.kind, group: node.group || '',
        resourceActionParameters: [], action: action.name
      };
      await api(`/api/v1/applications/${encodeURIComponent(appName())}/resource/actions/v2`, {method: 'POST', body: JSON.stringify(body)});
      await loadInspector(node, true);
      await reloadApp();
    }

    async function loadLogs(node, container = '') {
      const key = refKey(node);
      const current = inspector.get(key) || {};
      inspector.set(key, {...current, logsLoading: true});
      rerender();
      try {
        const live = current.live;
        const selectedContainer = container || live?.spec?.containers?.[0]?.name || '';
        const query = qs({
          appNamespace: appNamespace(), container: selectedContainer, namespace: node.namespace || '', follow: false,
          ...(node.kind === 'Pod' ? {podName: node.name} : {group: node.group || '', kind: node.kind, resourceName: node.name}),
          tailLines: 200
        });
        const text = await fetchText(`/api/v1/applications/${encodeURIComponent(appName())}/logs?${query}`);
        inspector.set(key, {...current, logsLoading: false, logs: parseSseLogs(text) || 'No log lines returned.', logContainer: selectedContainer});
      } catch (error) {
        inspector.set(key, {...current, logsLoading: false, logs: `Unable to load logs: ${error?.message || error}`});
      }
      rerender();
    }

    function pretty(value) {
      if (value === undefined || value === null) return 'Not available';
      if (typeof value === 'string') {
        try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
      }
      return JSON.stringify(value, null, 2);
    }

    function eventRows(events) {
      return (events || []).slice(0, 100).map(event => `<div class="event-row ${event?.type === 'Warning' ? 'warn' : ''}"><div><b>${esc(event?.reason || event?.type || 'Event')}</b><span>${esc(event?.message || '')}</span></div><small>${esc(event?.lastTimestamp || event?.eventTime || event?.firstTimestamp || '')}</small></div>`).join('') || '<div class="drawer-empty">No events returned.</div>';
    }

    function resourceTabs(node, data) {
      const tabs = ['summary', 'manifest', 'diff', 'events', 'logs', 'actions'];
      return `<div class="drawer-tabs" role="tablist" aria-label="Resource details">${tabs.map(tab => `<button role="tab" aria-selected="${view.resourceTab === tab}" data-resource-tab="${tab}" class="${view.resourceTab === tab ? 'active' : ''}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join('')}</div>`;
    }

    function resourceTabContent(node, data) {
      if (data?.loading) return '<div class="drawer-empty">Loading resource details…</div>';
      if (view.resourceTab === 'manifest') {
        return `<div class="code-head"><b>Live manifest</b><button data-open-original="manifest">Open native</button></div><pre class="code-block">${esc(pretty(data?.live))}</pre>`;
      }
      if (view.resourceTab === 'diff') {
        return `<div class="split-code"><section><div class="code-head"><b>Desired</b></div><pre class="code-block">${esc(pretty(data?.managed?.targetState))}</pre></section><section><div class="code-head"><b>Live</b></div><pre class="code-block">${esc(pretty(data?.managed?.liveState || data?.live))}</pre></section></div>`;
      }
      if (view.resourceTab === 'events') return `<div class="event-list">${eventRows(data?.events)}</div>`;
      if (view.resourceTab === 'logs') {
        const containers = data?.live?.spec?.containers || [];
        return `<div class="logs-tools">${containers.length ? containers.map(container => `<button class="tool-button ${data?.logContainer === container.name ? 'active' : ''}" data-load-logs="${esc(container.name)}">${esc(container.name)}</button>`).join('') : '<button class="tool-button" data-load-logs="">Load logs</button>'}${node.kind === 'Pod' ? `<button class="tool-button" data-open-original="exec">Terminal</button>` : ''}</div><pre class="code-block logs">${esc(data?.logsLoading ? 'Loading logs…' : data?.logs || 'Choose a container or load logs.')}</pre>`;
      }
      if (view.resourceTab === 'actions') {
        const actions = data?.actions || [];
        return `<div class="action-list">${actions.map(action => `<button class="action-row" data-resource-action="${esc(action.name)}" ${action.disabled ? 'disabled' : ''}><span><b>${esc(action.name)}</b>${action.disabled ? `<small>${esc(action.disabledMessage || 'Disabled by Argo CD')}</small>` : (action.params || action.parameters || []).length ? '<small>Opens native parameter form</small>' : '<small>Run with Argo CD RBAC</small>'}</span><span>›</span></button>`).join('') || '<div class="drawer-empty">No custom actions are available for this resource.</div>'}</div>`;
      }
      return `<div class="drawer-summary"><div class="kv"><span>Namespace</span><b>${esc(node.namespace || '(cluster)')}</b></div><div class="kv"><span>Health</span>${badge(nodeHealth(node))}</div><div class="kv"><span>Sync</span>${badge(nodeSync(node))}</div>${node.__orphaned ? '<div class="kv"><span>Relation</span><b>Orphaned</b></div>' : ''}${(node.info || []).slice(0, 12).map(item => `<div class="kv"><span>${esc(item?.name || 'Info')}</span><b>${esc(item?.value || '')}</b></div>`).join('')}${(node.images || []).length ? `<div class="drawer-section"><h4>Images</h4>${node.images.slice(0, 8).map(image => `<div class="drawer-line">${esc(image)}</div>`).join('')}</div>` : ''}${data?.error ? `<div class="drawer-note">Some resource metadata could not be loaded: ${esc(data.error)}</div>` : ''}</div>`;
    }

    function drawer(topology) {
      const node = topology.positions.get(view.selected)?.node;
      if (!node) return '';
      if (node.__appNode) {
        return `<aside class="topology-drawer"><div class="drawer-head"><div class="drawer-icon">APP</div><div class="drawer-title"><b>${esc(node.name)}</b><small>Application</small></div><button class="drawer-close" data-node-close aria-label="Close details">×</button></div><div class="drawer-body"><div class="kv"><span>Health</span>${badge(health(state.selected))}</div><div class="kv"><span>Sync</span>${badge(sync(state.selected))}</div><div class="kv"><span>Project</span><b>${esc(state.selected?.spec?.project || 'default')}</b></div><div class="drawer-note">Use the application tabs above the canvas for summary, diff, events, history, and source details.</div></div></aside>`;
      }
      const data = inspector.get(refKey(node)) || {};
      return `<aside class="topology-drawer"><div class="drawer-head"><div class="drawer-icon">${esc(kindCode(node.kind))}</div><div class="drawer-title"><b>${esc(node.name || node.kind)}</b><small>${esc(node.kind || 'Resource')}</small></div><button class="drawer-close" data-node-close aria-label="Close details">×</button></div><div class="drawer-actions"><button data-resource-sync>Sync</button><button data-resource-delete>Delete</button><button data-open-original="summary">Native</button></div>${resourceTabs(node, data)}<div class="drawer-body">${resourceTabContent(node, data)}</div></aside>`;
    }

    function graphMarkup() {
      const topology = buildTopology();
      if (!topology.positions.size) return '<div class="topology-empty">No resources returned.</div>';
      const connected = connectedKeys(topology);
      const edges = topology.edges.map(edge => {
        const from = topology.positions.get(edge.from), to = topology.positions.get(edge.to);
        if (!from || !to) return '';
        const active = view.selected && (edge.from === view.selected || edge.to === view.selected);
        return `<path class="topology-edge${edge.network ? ' network' : ''}${active ? ' active' : ''}${view.selected && !active ? ' dim' : ''}" d="${edgePath(from,to)}"/>`;
      }).join('');
      const nodes = [...topology.positions.values()].map(position => {
        const node = position.node;
        const nodeTone = node.__appNode ? tone(health(state.selected)) : tone(nodeHealth(node));
        const selected = view.selected === node.__key;
        const dim = view.selected && !connected.has(node.__key);
        const focusDim = view.focusIssues && !node.__appNode && healthySynced(node);
        const aria = `${node.kind || 'Resource'} ${node.name || ''}, health ${node.__appNode ? health(state.selected) : nodeHealth(node)}, sync ${node.__appNode ? sync(state.selected) : nodeSync(node)}`;
        return `<button class="topology-node ${nodeTone}${node.__appNode ? ' app-node' : ''}${node.__orphaned ? ' orphan' : ''}${selected ? ' selected' : ''}${dim ? ' dim' : ''}${focusDim ? ' focus-dim' : ''}" style="left:${position.x}px;top:${position.y}px" data-node="${encodeKey(node.__key)}" aria-label="${esc(aria)}"><span class="port in"></span><span class="node-icon">${esc(kindCode(node.kind))}</span><span class="node-copy"><span class="node-kind">${esc(node.kind || 'Resource')}${node.__orphaned ? ' · orphan' : ''}</span><strong>${esc(node.name || node.kind || 'Resource')}</strong><small>${esc(node.namespace || '(cluster)')}</small></span><span class="node-status" title="${esc(node.__appNode ? health(state.selected) : nodeHealth(node))}"></span><span class="port out"></span></button>`;
      }).join('');
      return `<div class="topology-viewport" data-topology-viewport><div class="topology-stage" data-topology-stage data-width="${topology.width}" data-height="${topology.height}" style="width:${topology.width}px;height:${topology.height}px"><svg class="topology-edges" width="${topology.width}" height="${topology.height}" viewBox="0 0 ${topology.width} ${topology.height}" aria-hidden="true">${edges}</svg>${nodes}</div><div class="topology-controls" aria-label="Diagram zoom controls"><button data-graph-action="zoom-out" aria-label="Zoom out">−</button><button data-graph-action="fit" aria-label="Fit diagram to view">Fit</button><button data-graph-action="zoom-in" aria-label="Zoom in">+</button></div><div class="graph-hint">Drag canvas · wheel to pan · Ctrl/⌘ + wheel to zoom</div>${topology.networkFallback && view.mode === 'network' ? '<div class="graph-notice">No network relationships were returned; showing the resource hierarchy.</div>' : ''}${drawer(topology)}</div>`;
    }

    function podsMarkup(nodes) {
      const pods = nodes.filter(node => node.kind === 'Pod');
      if (!pods.length) return '<div class="topology-empty">No Pods were returned for this application.</div>';
      return `<div class="pod-grid">${pods.map(node => `<button class="pod-card ${tone(nodeHealth(node))}" data-node="${encodeKey(refKey(node))}"><span class="pod-dot"></span><span><b>${esc(node.name)}</b><small>${esc(node.namespace || '(cluster)')}</small></span>${badge(nodeHealth(node))}</button>`).join('')}</div>`;
    }

    function listMarkup(nodes) {
      const rows = nodes.slice(0, 500).map(node => `<button class="resource resource-button" data-node="${encodeKey(refKey(node))}"><span class="name"><b>${esc(node?.name)}</b><small>${esc(node?.kind || 'Resource')}${node.__orphaned ? ' · orphan' : ''}</small></span><span class="muted">${esc(node?.namespace || '(cluster)')}</span><span>${badge(nodeHealth(node))}</span><span>${badge(nodeSync(node))}</span></button>`).join('');
      return `<div class="resource-list">${rows || '<div class="empty">No resources returned.</div>'}</div>`;
    }

    function toolbar(nodes = resourceNodes()) {
      const problems = nodes.filter(needsAttention).length;
      const modes = [['tree', 'Tree'], ['network', 'Network'], ['pods', 'Pods'], ['list', 'List']];
      return `<div class="topology-toolbar"><div class="segmented" role="tablist" aria-label="Application resource view">${modes.map(([mode, label]) => `<button role="tab" aria-selected="${view.mode === mode}" data-resource-view="${mode}" class="${view.mode === mode ? 'active' : ''}">${label}</button>`).join('')}</div>${['tree', 'network'].includes(view.mode) ? `<button class="tool-button ${view.focusIssues ? 'active' : ''}" data-focus-issues aria-pressed="${view.focusIssues}">${view.focusIssues ? 'Show all' : 'Focus issues'}</button>` : ''}<span class="topology-count">${nodes.length} resources · ${problems} need attention</span><div class="spacer"></div>${['tree', 'network'].includes(view.mode) ? '<button class="tool-button" data-graph-action="fit">Fit view</button>' : ''}</div>`;
    }

    function content(nodes = resourceNodes()) {
      if (view.mode === 'list') return listMarkup(nodes);
      if (view.mode === 'pods') return podsMarkup(nodes);
      return graphMarkup();
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
      const allowance = view.selected ? 360 : 0;
      const availableWidth = Math.max(280, viewport.clientWidth - 56 - allowance);
      const availableHeight = Math.max(280, viewport.clientHeight - 56);
      view.scale = clamp(Math.min(availableWidth / graphWidth, availableHeight / graphHeight), .26, 1.2);
      view.x = Math.max(22, (availableWidth - graphWidth * view.scale) / 2 + 22);
      view.y = Math.max(22, (viewport.clientHeight - graphHeight * view.scale) / 2);
      applyTransform();
    }

    function zoom(factor, clientX, clientY) {
      const viewport = state.root?.querySelector('[data-topology-viewport]');
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const px = (clientX ?? rect.left + rect.width / 2) - rect.left, py = (clientY ?? rect.top + rect.height / 2) - rect.top;
      const previous = view.scale, next = clamp(previous * factor, .26, 1.9);
      const graphX = (px - view.x) / previous, graphY = (py - view.y) / previous;
      view.scale = next; view.x = px - graphX * next; view.y = py - graphY * next; applyTransform();
    }

    function selectedNode() {
      if (!view.selected) return null;
      if (view.selected === '__app__') return {__appNode: true, __key: '__app__'};
      return resourceNodes().find(node => refKey(node) === view.selected) || null;
    }

    function bind() {
      state.root?.querySelectorAll('[data-resource-view]').forEach(node => node.addEventListener('click', () => {
        view.mode = node.dataset.resourceView;
        if (['tree', 'network'].includes(view.mode)) view.fitPending = true;
        view.selected = null;
        rerender();
      }));
      state.root?.querySelector('[data-focus-issues]')?.addEventListener('click', () => { view.focusIssues = !view.focusIssues; rerender(); });
      state.root?.querySelectorAll('[data-graph-action]').forEach(node => node.addEventListener('click', event => {
        event.stopPropagation();
        if (node.dataset.graphAction === 'fit') fit();
        if (node.dataset.graphAction === 'zoom-in') zoom(1.14);
        if (node.dataset.graphAction === 'zoom-out') zoom(.88);
      }));
      state.root?.querySelectorAll('[data-node]').forEach(node => node.addEventListener('click', event => {
        event.stopPropagation();
        view.selected = decodeKey(node.dataset.node);
        view.resourceTab = 'summary';
        rerender();
        const selected = selectedNode();
        if (selected && !selected.__appNode) void loadInspector(selected);
      }));
      state.root?.querySelector('[data-node-close]')?.addEventListener('click', event => { event.stopPropagation(); view.selected = null; rerender(); });
      state.root?.querySelectorAll('[data-resource-tab]').forEach(node => node.addEventListener('click', () => { view.resourceTab = node.dataset.resourceTab; rerender(); }));
      state.root?.querySelector('[data-resource-sync]')?.addEventListener('click', () => { const node = selectedNode(); if (node) void syncResource(node).catch(error => alert(`Sync failed: ${error?.message || error}`)); });
      state.root?.querySelector('[data-resource-delete]')?.addEventListener('click', () => { const node = selectedNode(); if (node) void deleteResource(node).catch(error => alert(`Delete failed: ${error?.message || error}`)); });
      state.root?.querySelectorAll('[data-resource-action]').forEach(button => button.addEventListener('click', () => {
        const node = selectedNode();
        const data = node ? inspector.get(refKey(node)) : null;
        const action = data?.actions?.find(item => item.name === button.dataset.resourceAction);
        if (node && action) void runResourceAction(node, action).catch(error => alert(`Action failed: ${error?.message || error}`));
      }));
      state.root?.querySelectorAll('[data-load-logs]').forEach(button => button.addEventListener('click', () => { const node = selectedNode(); if (node) void loadLogs(node, button.dataset.loadLogs || ''); }));
      state.root?.querySelectorAll('[data-open-original]').forEach(button => button.addEventListener('click', () => {
        const node = selectedNode();
        if (!node || node.__appNode) return;
        const requested = button.dataset.openOriginal;
        openOriginal(originalNodePath(node, requested === 'exec' ? 'exec' : requested || 'summary'));
      }));

      const viewport = state.root?.querySelector('[data-topology-viewport]');
      if (!viewport) return;
      viewport.addEventListener('wheel', event => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) zoom(event.deltaY < 0 ? 1.08 : .92, event.clientX, event.clientY);
        else { view.x -= event.deltaX; view.y -= event.deltaY; applyTransform(); }
      }, {passive: false});
      viewport.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.topology-node,.topology-controls,.topology-drawer,.tool-button')) return;
        view.drag = {id: event.pointerId, startX: event.clientX, startY: event.clientY, x: view.x, y: view.y};
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
      inspector.clear();
      Object.assign(view, {mode: 'tree', scale: 1, x: 24, y: 24, selected: null, resourceTab: 'summary', focusIssues: false, fitPending: true, drag: null});
    }

    return {styles, resourceNodes, needsAttention, toolbar, content, bind, reset};
  };
})();