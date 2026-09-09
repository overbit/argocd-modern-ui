(() => {
  if (globalThis.__ARGOCD_FULL_GRAPH_FACTORY__) return;

  globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = ({state, api, fetchText, esc, badge, tone, health, sync, rerender, reloadApp, openOriginal}) => {
    const view = {
      mode: 'tree', scale: 1, x: 24, y: 24, selected: null, resourceTab: 'summary',
      focusIssues: false, fitPending: true, drag: null, expandedGroups: new Set()
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
    const pluralKind = kind => String(kind || 'Resource').endsWith('s') ? String(kind || 'Resource') : `${kind || 'Resource'}s`;
    const compactGroupKey = (parentKey, kind) => `__group__|${parentKey}|${kind}`;

    function normalizeJson(value) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || !((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) return value;
        try { return normalizeJson(JSON.parse(trimmed)); } catch { return value; }
      }
      if (Array.isArray(value)) return value.map(normalizeJson);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJson(item)]));
      }
      return value;
    }

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

    function compactTree(resources, edges) {
      const incoming = new Map(resources.map(node => [node.__key, []]));
      const outgoing = new Map(resources.map(node => [node.__key, 0]));
      edges.forEach(edge => {
        if (incoming.has(edge.to)) incoming.get(edge.to).push(edge);
        if (outgoing.has(edge.from)) outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1);
      });

      const groupedByParentAndKind = new Map();
      for (const node of resources) {
        const parentEdges = incoming.get(node.__key) || [];
        const leaf = (outgoing.get(node.__key) || 0) === 0;
        const inactive = leaf && !node.__orphaned && !needsAttention(node) && view.selected !== node.__key;
        if (!inactive || parentEdges.length !== 1) continue;
        const parentKey = parentEdges[0].from;
        const key = compactGroupKey(parentKey, node.kind);
        if (!groupedByParentAndKind.has(key)) groupedByParentAndKind.set(key, {key, parentKey, kind: node.kind, members: []});
        groupedByParentAndKind.get(key).members.push(node);
      }

      const groups = [...groupedByParentAndKind.values()]
        .filter(group => group.members.length > 1 && !view.expandedGroups.has(group.key))
        .sort((a, b) => a.key.localeCompare(b.key));
      if (!groups.length) return {resources, edges, groups: []};

      const groupedMemberKeys = new Set(groups.flatMap(group => group.members.map(member => member.__key)));
      const compactResources = resources.filter(node => !groupedMemberKeys.has(node.__key));
      const compactEdges = edges.filter(edge => !groupedMemberKeys.has(edge.to) && !groupedMemberKeys.has(edge.from));

      for (const group of groups) {
        group.members.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, {numeric: true}));
        const namespaces = [...new Set(group.members.map(member => member.namespace || '(cluster)'))];
        const healthStates = [...new Set(group.members.map(nodeHealth))];
        const syncStates = [...new Set(group.members.map(nodeSync))];
        const groupNode = {
          __key: group.key,
          __group: true,
          __groupKey: group.key,
          __groupMembers: group.members,
          kind: group.kind,
          name: `${group.members.length} ${pluralKind(group.kind)}`,
          namespace: namespaces.length === 1 ? namespaces[0] : 'multiple namespaces',
          health: {status: healthStates.length === 1 ? healthStates[0] : 'Unknown'},
          status: syncStates.length === 1 ? syncStates[0] : 'Unknown',
          count: group.members.length
        };
        compactResources.push(groupNode);
        compactEdges.push({from: group.parentKey, to: group.key, synthetic: group.parentKey === '__app__', grouped: true});
      }
      return {resources: compactResources, edges: compactEdges, groups};
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
      let groups = [];
      if (view.mode === 'network') {
        const network = networkEdges(resources);
        resources = network.resources;
        edges = network.edges;
        networkFallback = network.fallback;
      } else {
        edges = treeEdges(resources);
        const compact = compactTree(resources, edges);
        resources = compact.resources;
        edges = compact.edges;
        groups = compact.groups;
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
      const priority = node => needsAttention(node) ? 0 : node.__orphaned ? 1 : node.__group ? 3 : 2;
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
      return {resources, edges, positions, width, height, networkFallback, groups};
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

    function logEntries(text, container) {
      return String(text || '').split(/\r?\n/).filter(line => line.startsWith('data:')).map((line, order) => {
        const raw = line.slice(5).trim();
        try {
          const parsed = JSON.parse(raw);
          const entry = parsed?.result || parsed;
          if (!entry || entry.last) return null;
          return {
            content: entry.content || entry.message || '',
            podName: entry.podName || '',
            timeStamp: entry.timeStamp || entry.timestamp || entry.timeStampStr || '',
            container,
            order
          };
        } catch {
          return {content: raw, podName: '', timeStamp: '', container, order};
        }
      }).filter(entry => entry && entry.content !== '');
    }

    function workloadPodSpec(node, manifest) {
      const value = normalizeJson(manifest);
      if (!value || typeof value !== 'object') return null;
      if (node.kind === 'Pod') return value.spec || null;
      if (node.kind === 'CronJob') return value.spec?.jobTemplate?.spec?.template?.spec || null;
      return value.spec?.template?.spec || null;
    }

    function containerNames(node, data) {
      const manifest = data?.live || data?.managed?.liveState || data?.managed?.targetState;
      const spec = workloadPodSpec(node, manifest);
      if (!spec) return [];
      const names = [...(spec.initContainers || []), ...(spec.containers || []), ...(spec.ephemeralContainers || [])].map(container => container?.name).filter(Boolean);
      return [...new Set(names)];
    }

    function formatLogEntries(entries, node, showSources) {
      const ordered = entries.map((entry, index) => ({...entry, __index: index})).sort((a, b) => {
        const at = Date.parse(a.timeStamp || '');
        const bt = Date.parse(b.timeStamp || '');
        if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
        return a.__index - b.__index;
      });
      return ordered.map(entry => {
        const source = entry.podName || node.name;
        const prefix = showSources ? `[${source}/${entry.container || 'container'}] ` : '';
        return `${prefix}${entry.content}`;
      }).join('\n');
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
      const resourceMetaQuery = qs({appNamespace: appNamespace(), namespace: node.namespace || '', resourceName: node.name, version: node.version || '', kind: node.kind, group: node.group || ''});
      const results = await Promise.allSettled([
        api(`/api/v1/applications/${encodeURIComponent(appName())}/resource?${resourceQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/managed-resources?${managedQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/events?${eventsQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/resource/actions?${resourceMetaQuery}`),
        api(`/api/v1/applications/${encodeURIComponent(appName())}/resource/links?${resourceMetaQuery}`)
      ]);
      const unwrap = (result, fallback) => result.status === 'fulfilled' ? result.value : fallback;
      const liveResponse = normalizeJson(unwrap(results[0], null));
      const live = liveResponse?.manifest !== undefined ? normalizeJson(liveResponse.manifest) : liveResponse;
      const managedResponse = normalizeJson(unwrap(results[1], {items: []}));
      const managedItems = Array.isArray(managedResponse) ? managedResponse : managedResponse?.items || [];
      const managed = managedItems.find(item => item?.name === node.name && item?.kind === node.kind && (item?.namespace || '') === (node.namespace || '')) || managedItems[0] || null;
      const eventsResponse = unwrap(results[2], {items: []});
      const events = Array.isArray(eventsResponse) ? eventsResponse : eventsResponse?.items || [];
      const actionsResponse = unwrap(results[3], {actions: []});
      const actions = Array.isArray(actionsResponse) ? actionsResponse : actionsResponse?.actions || [];
      const linksResponse = unwrap(results[4], {items: []});
      const links = Array.isArray(linksResponse) ? linksResponse : linksResponse?.items || [];
      const firstError = results.find(result => result.status === 'rejected');
      const next = {
        loaded: true, loading: false, live, managed, events, actions, links,
        error: firstError ? String(firstError.reason?.message || firstError.reason || '') : '',
        logs: current?.logs || null,
        logContainer: current?.logContainer || '*'
      };
      next.containers = containerNames(node, next);
      inspector.set(key, next);
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
      const params = action.params || action.parameters || [];
      const resourceActionParameters = [];
      for (const param of params) {
        const value = prompt(`${action.displayName || action.name}: ${param.name}`, param.default ?? '');
        if (value === null) return;
        resourceActionParameters.push({name: param.name, value, type: param.type, default: param.default});
      }
      if (!params.length && !confirm(`Run resource action “${action.displayName || action.name}” on ${node.kind} “${node.name}”?`)) return;
      if (params.length && !confirm(`Run “${action.displayName || action.name}” with the entered parameters?`)) return;
      const body = {
        appNamespace: appNamespace(), namespace: node.namespace || '', resourceName: node.name,
        version: node.version || '', kind: node.kind, group: node.group || '',
        resourceActionParameters, action: action.name
      };
      await api(`/api/v1/applications/${encodeURIComponent(appName())}/resource/actions/v2`, {method: 'POST', body: JSON.stringify(body)});
      await loadInspector(node, true);
      await reloadApp();
    }

    async function loadLogs(node, container = '*') {
      const key = refKey(node);
      const current = inspector.get(key) || {};
      const availableContainers = current.containers?.length ? current.containers : containerNames(node, current);
      const selectedContainers = container === '*' ? availableContainers : [container];
      if (!selectedContainers.length) {
        inspector.set(key, {...current, logsLoading: false, logs: 'No Pod containers were found for this resource.', logContainer: container});
        rerender();
        return;
      }
      inspector.set(key, {...current, containers: availableContainers, logsLoading: true, logContainer: container});
      rerender();
      const requests = selectedContainers.map(async selectedContainer => {
        const query = qs({
          appNamespace: appNamespace(), container: selectedContainer, namespace: node.namespace || '', follow: false,
          ...(node.kind === 'Pod' ? {podName: node.name} : {group: node.group || '', kind: node.kind, resourceName: node.name}),
          tailLines: 500, sinceSeconds: 0
        });
        const text = await fetchText(`/api/v1/applications/${encodeURIComponent(appName())}/logs?${query}`);
        return logEntries(text, selectedContainer);
      });
      const results = await Promise.allSettled(requests);
      const entries = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      const errors = results.filter(result => result.status === 'rejected').map(result => String(result.reason?.message || result.reason || 'Unable to load logs'));
      const podNames = new Set(entries.map(entry => entry.podName).filter(Boolean));
      const showSources = selectedContainers.length > 1 || podNames.size > 1 || node.kind !== 'Pod';
      const logText = formatLogEntries(entries, node, showSources) || (errors.length ? errors.join('\n') : 'No log lines returned.');
      inspector.set(key, {...current, containers: availableContainers, logsLoading: false, logs: logText, logContainer: container, logErrors: errors});
      rerender();
    }

    function pretty(value) {
      if (value === undefined || value === null) return 'Not available';
      const normalized = normalizeJson(value);
      return typeof normalized === 'string' ? normalized : JSON.stringify(normalized, null, 2);
    }

    function eventRows(events) {
      return (events || []).slice(0, 100).map(event => `<div class="event-row ${event?.type === 'Warning' ? 'warn' : ''}"><div><b>${esc(event?.reason || event?.type || 'Event')}</b><span>${esc(event?.message || '')}</span></div><small>${esc(event?.lastTimestamp || event?.eventTime || event?.firstTimestamp || '')}</small></div>`).join('') || '<div class="drawer-empty">No events returned.</div>';
    }

    function resourceTabs() {
      const tabs = ['summary', 'manifest', 'diff', 'events', 'logs', 'actions'];
      return `<div class="drawer-tabs" role="tablist" aria-label="Resource details">${tabs.map(tab => `<button role="tab" aria-selected="${view.resourceTab === tab}" data-resource-tab="${tab}" class="${view.resourceTab === tab ? 'active' : ''}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join('')}</div>`;
    }

    function resourceTabContent(node, data) {
      if (data?.loading) return '<div class="drawer-empty">Loading resource details…</div>';
      if (view.resourceTab === 'manifest') {
        return `<div class="code-head"><b>Live manifest</b></div><pre class="code-block">${esc(pretty(data?.live))}</pre>`;
      }
      if (view.resourceTab === 'diff') {
        return `<div class="split-code"><section><div class="code-head"><b>Desired</b></div><pre class="code-block">${esc(pretty(data?.managed?.targetState))}</pre></section><section><div class="code-head"><b>Live</b></div><pre class="code-block">${esc(pretty(data?.managed?.liveState || data?.live))}</pre></section></div>`;
      }
      if (view.resourceTab === 'events') return `<div class="event-list">${eventRows(data?.events)}</div>`;
      if (view.resourceTab === 'logs') {
        const containers = data?.containers || containerNames(node, data);
        const all = `<button class="tool-button ${data?.logContainer === '*' ? 'active' : ''}" data-load-logs="*">All containers</button>`;
        const choices = containers.map(name => `<button class="tool-button ${data?.logContainer === name ? 'active' : ''}" data-load-logs="${esc(name)}">${esc(name)}</button>`).join('');
        const nativeLogs = `<button class="tool-button" data-open-original="logs">Native log controls</button>`;
        const terminal = node.kind === 'Pod' ? '<button class="tool-button" data-open-original="exec">Terminal</button>' : '';
        return `<div class="logs-tools">${containers.length ? all + choices : ''}<button class="tool-button" data-load-logs="${esc(data?.logContainer || '*')}">Refresh logs</button>${nativeLogs}${terminal}</div><div class="drawer-note">Deployment and ReplicaSet log queries include every matching Pod; “All containers” loads every init, app, and ephemeral container returned by the workload manifest.</div><pre class="code-block logs">${esc(data?.logsLoading ? 'Loading logs…' : data?.logs || (containers.length ? 'Choose All containers or an individual container.' : 'No containers were found for this resource.'))}</pre>`;
      }
      if (view.resourceTab === 'actions') {
        const actions = data?.actions || [];
        const links = data?.links || [];
        const actionRows = actions.map(action => `<button class="action-row" data-resource-action="${esc(action.name)}" ${action.disabled ? 'disabled' : ''}><span><b>${esc(action.displayName || action.name)}</b>${action.disabled ? `<small>${esc(action.disabledMessage || 'Disabled by Argo CD')}</small>` : (action.params || action.parameters || []).length ? '<small>Enter parameters and run with Argo CD RBAC</small>' : '<small>Run with Argo CD RBAC</small>'}</span><span>›</span></button>`).join('');
        const linkRows = links.map(link => `<a class="action-row resource-link" href="${esc(link.url || '#')}" target="_blank" rel="noopener noreferrer"><span><b>${esc(link.title || 'Resource link')}</b><small>${esc(link.description || link.url || '')}</small></span><span>↗</span></a>`).join('');
        return `<div class="action-list">${actionRows || '<div class="drawer-empty">No custom actions are available for this resource.</div>'}${links.length ? `<div class="drawer-section"><h4>Links</h4>${linkRows}</div>` : ''}</div>`;
      }
      return `<div class="drawer-summary"><div class="kv"><span>Namespace</span><b>${esc(node.namespace || '(cluster)')}</b></div><div class="kv"><span>Health</span>${badge(nodeHealth(node))}</div><div class="kv"><span>Sync</span>${badge(nodeSync(node))}</div>${node.__orphaned ? '<div class="kv"><span>Relation</span><b>Orphaned</b></div>' : ''}${(node.info || []).slice(0, 12).map(item => `<div class="kv"><span>${esc(item?.name || 'Info')}</span><b>${esc(item?.value || '')}</b></div>`).join('')}${(node.images || []).length ? `<div class="drawer-section"><h4>Images</h4>${node.images.slice(0, 8).map(image => `<div class="drawer-line">${esc(image)}</div>`).join('')}</div>` : ''}${data?.error ? `<div class="drawer-note">Some resource metadata could not be loaded: ${esc(data.error)}</div>` : ''}</div>`;
    }

    function drawer(topology) {
      const node = topology.positions.get(view.selected)?.node;
      if (!node) return '';
      if (node.__appNode) {
        return `<aside class="topology-drawer"><div class="drawer-head"><div class="drawer-icon">APP</div><div class="drawer-title"><b>${esc(node.name)}</b><small>Application</small></div><button class="drawer-close" data-node-close aria-label="Close details">×</button></div><div class="drawer-body"><div class="kv"><span>Health</span>${badge(health(state.selected))}</div><div class="kv"><span>Sync</span>${badge(sync(state.selected))}</div><div class="kv"><span>Project</span><b>${esc(state.selected?.spec?.project || 'default')}</b></div><div class="drawer-note">Use the application controls above the canvas for diff, sync, history, refresh, rollback, and lifecycle actions.</div></div></aside>`;
      }
      const data = inspector.get(refKey(node)) || {};
      return `<aside class="topology-drawer"><div class="drawer-head"><div class="drawer-icon">${esc(kindCode(node.kind))}</div><div class="drawer-title"><b>${esc(node.name || node.kind)}</b><small>${esc(node.kind || 'Resource')}</small></div><button class="drawer-close" data-node-close aria-label="Close details">×</button></div><div class="drawer-actions"><button data-resource-sync>Sync</button><button data-resource-delete>Delete</button><button data-open-original="summary">Native fallback</button></div>${resourceTabs()}<div class="drawer-body">${resourceTabContent(node, data)}</div></aside>`;
    }

    function graphMarkup() {
      const topology = buildTopology();
      if (!topology.positions.size) return '<div class="topology-empty">No resources returned.</div>';
      const connected = connectedKeys(topology);
      const edges = topology.edges.map(edge => {
        const from = topology.positions.get(edge.from), to = topology.positions.get(edge.to);
        if (!from || !to) return '';
        const active = view.selected && (edge.from === view.selected || edge.to === view.selected);
        return `<path class="topology-edge${edge.network ? ' network' : ''}${edge.grouped ? ' grouped' : ''}${active ? ' active' : ''}${view.selected && !active ? ' dim' : ''}" d="${edgePath(from,to)}"/>`;
      }).join('');
      const nodes = [...topology.positions.values()].map(position => {
        const node = position.node;
        const nodeTone = node.__appNode ? tone(health(state.selected)) : tone(nodeHealth(node));
        const selected = view.selected === node.__key;
        const dim = view.selected && !connected.has(node.__key);
        const focusDim = view.focusIssues && !node.__appNode && (node.__group || healthySynced(node));
        if (node.__group) {
          const aria = `${node.count} collapsed inactive ${pluralKind(node.kind)}, click to expand`;
          return `<button class="topology-node group-node ${nodeTone}${dim ? ' dim' : ''}${focusDim ? ' focus-dim' : ''}" style="left:${position.x}px;top:${position.y}px" data-group="${encodeKey(node.__groupKey)}" aria-label="${esc(aria)}"><span class="port in"></span><span class="node-icon">${esc(kindCode(node.kind))}</span><span class="node-copy"><span class="node-kind">Collapsed inactive resources</span><strong>${esc(node.name)}</strong><small>${esc(node.namespace || '(cluster)')} · click to expand</small></span><span class="group-count" aria-hidden="true">${node.count}</span><span class="port out"></span></button>`;
        }
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
      const collapseGroups = view.mode === 'tree' && view.expandedGroups.size ? '<button class="tool-button" data-collapse-groups>Collapse groups</button>' : '';
      return `<div class="topology-toolbar"><div class="segmented" role="tablist" aria-label="Application resource view">${modes.map(([mode, label]) => `<button role="tab" aria-selected="${view.mode === mode}" data-resource-view="${mode}" class="${view.mode === mode ? 'active' : ''}">${label}</button>`).join('')}</div>${['tree', 'network'].includes(view.mode) ? `<button class="tool-button ${view.focusIssues ? 'active' : ''}" data-focus-issues aria-pressed="${view.focusIssues}">${view.focusIssues ? 'Show all' : 'Focus issues'}</button>` : ''}${collapseGroups}<span class="topology-count">${nodes.length} resources · ${problems} need attention</span><div class="spacer"></div>${['tree', 'network'].includes(view.mode) ? '<button class="tool-button" data-graph-action="fit">Fit view</button>' : ''}</div>`;
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
      state.root?.querySelector('[data-collapse-groups]')?.addEventListener('click', () => {
        view.expandedGroups.clear();
        view.selected = null;
        view.fitPending = true;
        rerender();
      });
      state.root?.querySelectorAll('[data-group]').forEach(node => node.addEventListener('click', event => {
        event.stopPropagation();
        view.expandedGroups.add(decodeKey(node.dataset.group));
        view.fitPending = true;
        rerender();
      }));
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
      state.root?.querySelectorAll('[data-load-logs]').forEach(button => button.addEventListener('click', () => { const node = selectedNode(); if (node) void loadLogs(node, button.dataset.loadLogs || '*'); }));
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
      Object.assign(view, {mode: 'tree', scale: 1, x: 24, y: 24, selected: null, resourceTab: 'summary', focusIssues: false, fitPending: true, drag: null, expandedGroups: new Set()});
    }

    return {styles, resourceNodes, needsAttention, toolbar, content, bind, reset, normalizeJson, containerNames};
  };
})();