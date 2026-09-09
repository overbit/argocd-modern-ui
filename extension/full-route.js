(() => {
  if (globalThis.__ARGOCD_FULL_ROUTE_ADAPTED__ || !globalThis.__ARGOCD_FULL_UI__) return;
  globalThis.__ARGOCD_FULL_ROUTE_ADAPTED__ = true;

  const fullUi = globalThis.__ARGOCD_FULL_UI__;
  const originalMount = fullUi.mount.bind(fullUi);
  const originalUnmount = fullUi.unmount.bind(fullUi);

  function relativePath(configuredUrl) {
    try {
      const base = new URL(configuredUrl);
      const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/+$/, '');
      const pathname = location.pathname;
      return basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname;
    } catch {
      return location.pathname;
    }
  }

  function applicationRoute(configuredUrl) {
    const path = relativePath(configuredUrl);
    if (!path.startsWith('/applications/') || path.includes('/logs')) return null;
    const segments = path.split('/').filter(Boolean).map(segment => {
      try { return decodeURIComponent(segment); } catch { return segment; }
    });
    if (segments[0] !== 'applications') return null;
    if (segments.length >= 3) return {namespace: segments[1], name: segments[2]};
    if (segments.length === 2) return {namespace: '', name: segments[1]};
    return null;
  }

  function openDiagramForRoute(configuredUrl) {
    const route = applicationRoute(configuredUrl);
    if (!route) return;
    const root = document.getElementById('argocd-modern-full-ui')?.shadowRoot;
    if (!root || root.querySelector('.topology-panel')) return;
    const rows = [...root.querySelectorAll('[data-app]')];
    const target = rows.find(row => {
      const value = String(row.dataset.app || '');
      const slash = value.indexOf('/');
      const namespace = slash >= 0 ? value.slice(0, slash) : '';
      const name = slash >= 0 ? value.slice(slash + 1) : value;
      return name === route.name && (!route.namespace || namespace === route.namespace);
    });
    target?.click();
  }

  async function mount(options) {
    await originalMount(options);
    requestAnimationFrame(() => openDiagramForRoute(options?.configuredUrl || ''));
  }

  globalThis.__ARGOCD_FULL_UI__ = {mount, unmount: originalUnmount};
})();
