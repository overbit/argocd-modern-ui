(() => {
  const directFactory = globalThis.__ARGOCD_FULL_DIRECT_FACTORY__;
  if (!directFactory || globalThis.__ARGOCD_FULL_DIRECT_PATCHED__) return;
  globalThis.__ARGOCD_FULL_DIRECT_PATCHED__ = true;

  globalThis.__ARGOCD_FULL_DIRECT_FACTORY__ = options => {
    const direct = directFactory(options);

    function repairRoutes(root) {
      root?.querySelectorAll?.('[data-direct-route]').forEach(node => {
        const route = String(node.dataset.directRoute || '');
        if (!route.includes("'+backPath+'")) return;
        const surfacePath = String(node.closest?.('[data-direct-surface]')?.dataset.directPath || '');
        const backPath = surfacePath.includes('/settings/write-repos') ? '/settings/write-repos' : '/settings/repos';
        node.dataset.directRoute = `${backPath}?create=1`;
      });
    }

    function bind(root = options.state?.root) {
      direct.bind(root);
      repairRoutes(root);
      if (!root || typeof MutationObserver === 'undefined') return;
      const observer = new MutationObserver(() => repairRoutes(root));
      observer.observe(root, {childList: true, subtree: true});
    }

    return {...direct, bind, repairRoutes};
  };
})();