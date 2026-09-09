(() => {
  if (!globalThis.__ARGOCD_FULL_GRAPH_BASE_FACTORY__ && globalThis.__ARGOCD_FULL_GRAPH_FACTORY__) {
    globalThis.__ARGOCD_FULL_GRAPH_BASE_FACTORY__ = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__;
  }
})();