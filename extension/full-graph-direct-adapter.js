(() => {
  const graphFactory = globalThis.__ARGOCD_FULL_GRAPH_BASE_FACTORY__;
  if (!graphFactory || globalThis.__ARGOCD_FULL_GRAPH_DIRECT_FIXED__) return;
  globalThis.__ARGOCD_FULL_GRAPH_DIRECT_FIXED__ = true;

  globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = options => {
    const {state, esc, rerender} = options;
    const direct = globalThis.__ARGOCD_FULL_DIRECT_FACTORY__?.({state, esc});
    const base = () => String(state.baseUrl || '').replace(/\/+$/, '');
    const resourceIdentity = resource => [resource?.group || '', resource?.kind || '', resource?.namespace || '', resource?.name || ''].join('|');
    const resourceKey = resource => resource?.uid || resourceIdentity(resource);
    let selectedResourceKey = null;

    function mergeResourceStatus() {
      const statusByIdentity = new Map((state.selected?.status?.resources || []).map(resource => [resourceIdentity(resource), resource]));
      const merge = node => {
        const status = statusByIdentity.get(resourceIdentity(node));
        if (!status) return node;
        node.health = status.health || node.health;
        node.status = status.status || node.status;
        node.hook = status.hook;
        node.syncWave = status.syncWave;
        node.requiresPruning = status.requiresPruning;
        return node;
      };
      (state.tree?.nodes || []).forEach(merge);
      (state.tree?.orphanedNodes || []).forEach(merge);
    }

    const request = async (path, requestOptions = {}) => {
      const response = await fetch(`${base()}${path}`, {
        credentials: 'include',
        headers: {Accept: 'application/json', ...(requestOptions.body ? {'Content-Type': 'application/json'} : {})},
        ...requestOptions
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    };

    const fetchText = async (path, requestOptions = {}) => {
      const response = await fetch(`${base()}${path}`, {
        credentials: 'include',
        headers: {Accept: 'text/event-stream, text/plain, */*'},
        ...requestOptions
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.text();
    };

    const reloadApp = async () => {
      const selected = state.selected;
      if (!selected?.metadata?.name) {
        rerender?.();
        return;
      }
      const name = encodeURIComponent(selected.metadata.name);
      const namespace = selected.metadata.namespace || '';
      const query = namespace ? `?appNamespace=${encodeURIComponent(namespace)}` : '';
      [state.selected, state.tree] = await Promise.all([
        request(`/api/v1/applications/${name}${query}`),
        request(`/api/v1/applications/${name}/resource-tree${query}`)
      ]);
      mergeResourceStatus();
      rerender?.();
    };

    const openDirect = path => {
      if (!state.root || !direct) return;
      state.root.querySelector('.direct-overlay')?.remove();
      const overlay = document.createElement('section');
      overlay.className = 'direct-overlay';
      overlay.innerHTML = `<div class="direct-overlay-top"><div><strong>Resource controls</strong><span>Full replacement UI · direct Argo CD API/WebSocket controls</span></div><button class="direct-overlay-close" type="button" data-direct-overlay-close>Close</button></div>${direct.frame(path, {title: 'Resource controls'})}`;
      state.root.appendChild(overlay);
      overlay.querySelector('[data-direct-overlay-close]')?.addEventListener('click', () => overlay.remove());
      direct.bind(overlay);
    };

    const graph = graphFactory({
      ...options,
      api: options.api || request,
      fetchText: options.fetchText || fetchText,
      reloadApp: options.reloadApp || reloadApp,
      openOriginal: options.openOriginal || openDirect
    });

    const directLabels = markup => String(markup || '')
      .replaceAll('Native fallback', 'Advanced details')
      .replaceAll('Native log controls', 'Advanced logs')
      .replaceAll('original UI', 'advanced controls');

    const wrapData = method => (...args) => {
      mergeResourceStatus();
      return graph[method](...args);
    };
    const wrapMarkup = method => (...args) => {
      mergeResourceStatus();
      return directLabels(graph[method](...args));
    };

    const decodeNodeKey = value => {
      try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); }
    };

    function dependentResources(node) {
      const target = resourceKey(node);
      const nodes = [...(state.tree?.nodes || []), ...(state.tree?.orphanedNodes || [])];
      return nodes.filter(child => (child.parentRefs || []).some(parent => resourceKey(parent) === target));
    }

    async function deleteResourceWithControls(node) {
      if (!node || node.__appNode) return;
      const mode = String(prompt(
        `Delete ${node.kind} “${node.name}”. Choose propagation: foreground, background, or orphan.`,
        'foreground'
      ) || '').trim().toLowerCase();
      if (!mode) return;
      if (!['foreground', 'background', 'orphan'].includes(mode)) {
        alert('Deletion cancelled: choose foreground, background, or orphan.');
        return;
      }

      const managed = (state.selected?.status?.resources || []).some(resource => resourceIdentity(resource) === resourceIdentity(node));
      const children = dependentResources(node);
      const childSummary = children.length
        ? `\nDependent resources: ${children.slice(0, 5).map(child => `${child.kind}/${child.name}`).join(', ')}${children.length > 5 ? ` and ${children.length - 5} more` : ''}.`
        : '';
      if (managed) {
        const confirmation = prompt(`Type “${node.name}” to confirm deletion.${childSummary}`);
        if (confirmation !== node.name) return;
      } else if (!confirm(`Delete ${node.kind} “${node.name}” using ${mode} propagation?${childSummary}`)) {
        return;
      }

      const query = new URLSearchParams({
        name: node.name || '',
        appNamespace: state.selected?.metadata?.namespace || '',
        namespace: node.namespace || '',
        resourceName: node.name || '',
        version: node.version || '',
        kind: node.kind || '',
        group: node.group || '',
        force: String(mode === 'background'),
        orphan: String(mode === 'orphan')
      });
      await request(`/api/v1/applications/${encodeURIComponent(state.selected?.metadata?.name || '')}/resource?${query}`, {method: 'DELETE'});
      selectedResourceKey = null;
      await reloadApp();
    }

    function installResourceControlCapture(root = state.root) {
      if (!root || root.__argocdDirectResourceCapture) return;
      root.__argocdDirectResourceCapture = true;
      root.addEventListener('click', event => {
        const nodeButton = event.target?.closest?.('[data-node]');
        if (nodeButton) selectedResourceKey = decodeNodeKey(nodeButton.dataset.node);

        const deleteButton = event.target?.closest?.('[data-resource-delete]');
        if (!deleteButton) return;
        const node = graph.resourceNodes().find(resource => resourceKey(resource) === selectedResourceKey);
        if (!node) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void deleteResourceWithControls(node).catch(error => alert(`Delete failed: ${error?.message || error}`));
      }, true);
    }

    const bind = (...args) => {
      mergeResourceStatus();
      installResourceControlCapture(args[0] || state.root);
      return graph.bind(...args);
    };

    return {
      ...graph,
      resourceNodes: wrapData('resourceNodes'),
      toolbar: wrapMarkup('toolbar'),
      content: wrapMarkup('content'),
      bind,
      deleteResourceWithControls
    };
  };
})();