(() => {
  if (globalThis.__ARGOCD_FULL_NATIVE_FACTORY__) return;

  globalThis.__ARGOCD_FULL_NATIVE_FACTORY__ = ({state, esc}) => {
    const styles = `
      .parity-surface{border:1px solid var(--border);border-radius:10px;background:var(--panel);overflow:hidden;box-shadow:0 1px 2px rgba(31,35,40,.04)}
      .parity-head{display:flex;align-items:center;gap:12px;min-height:48px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--bg)}
      .parity-head strong{font-size:13px}.parity-head small{display:block;color:var(--muted);font-size:11px}.parity-path{margin-left:auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font:11px/1.4 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace}
      .parity-frame{display:block;width:100%;height:calc(100vh - 190px);min-height:620px;border:0;background:var(--panel)}
      .parity-note{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px}.parity-note i{width:7px;height:7px;border-radius:50%;background:var(--ok);flex:none}
      .graph-parity-overlay{position:fixed;inset:12px;z-index:1000;display:grid;grid-template-rows:52px minmax(0,1fr);overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--bg);box-shadow:0 24px 80px rgba(1,4,9,.32)}
      .graph-parity-top{display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--border);background:var(--panel)}.graph-parity-top strong{font-size:13px}.graph-parity-top span{color:var(--muted);font-size:11px}.graph-parity-close{margin-left:auto;min-width:44px;min-height:36px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text);font-weight:650;cursor:pointer}.graph-parity-close:hover{background:var(--soft)}.graph-parity-overlay .parity-surface{height:100%;border:0;border-radius:0}.graph-parity-overlay .parity-frame{height:calc(100vh - 126px);min-height:0}
      @media(max-width:900px){.parity-frame{height:calc(100vh - 160px);min-height:520px}.parity-path{display:none}.parity-head{padding:8px 10px}.graph-parity-overlay{inset:6px}.graph-parity-overlay .parity-frame{height:calc(100vh - 112px)}}
    `;

    const cleanPath = path => `/${String(path || '').replace(/^\/+/, '')}`;
    const urlFor = path => `${String(state.baseUrl || '').replace(/\/+$/, '')}${cleanPath(path)}`;

    function frame(path, {title = 'Argo CD controls', description = 'Complete native functionality inside Full UI.', fullChrome = false} = {}) {
      const normalized = cleanPath(path);
      return `<section class="parity-surface"><div class="parity-head"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div><div class="parity-note"><i></i><span>Authenticated same-origin session</span></div><code class="parity-path">${esc(normalized)}</code></div><iframe class="parity-frame" data-native-frame data-native-chrome="${fullChrome ? 'full' : 'compact'}" src="${esc(urlFor(normalized))}" title="${esc(title)}"></iframe></section>`;
    }

    function installCompactChrome(frameNode) {
      if (frameNode.dataset.nativeChrome === 'full') return;
      try {
        const doc = frameNode.contentDocument;
        if (!doc?.head || doc.getElementById('argocd-modern-parity-style')) return;
        doc.documentElement.dataset.argocdModernEmbedded = 'true';
        const style = doc.createElement('style');
        style.id = 'argocd-modern-parity-style';
        style.textContent = `
          html[data-argocd-modern-embedded="true"] .sb-page-wrapper__sidebar { display:none !important; }
          html[data-argocd-modern-embedded="true"] .sb-page-wrapper,
          html[data-argocd-modern-embedded="true"] .sb-page-wrapper__content,
          html[data-argocd-modern-embedded="true"] .page,
          html[data-argocd-modern-embedded="true"] .page__content { margin-left:0 !important; padding-left:0 !important; }
          html[data-argocd-modern-embedded="true"] .page__top-bar,
          html[data-argocd-modern-embedded="true"] .flex-top-bar,
          html[data-argocd-modern-embedded="true"] .top-bar,
          html[data-argocd-modern-embedded="true"] .application-details__status-panel { left:0 !important; }
          html[data-argocd-modern-embedded="true"] body { overflow:auto !important; }
        `;
        doc.head.appendChild(style);
      } catch (error) {
        console.debug('[Argo CD Modern UI] Native parity frame could not be compacted.', error);
      }
    }

    function bind(root = state.root) {
      root?.querySelectorAll('[data-native-frame]').forEach(frameNode => {
        const onLoad = () => installCompactChrome(frameNode);
        frameNode.addEventListener('load', onLoad);
        if (frameNode.contentDocument?.readyState === 'complete') onLoad();
      });
    }

    return {styles, frame, bind, urlFor, cleanPath};
  };

  const graphFactory = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__;
  if (graphFactory && !globalThis.__ARGOCD_FULL_GRAPH_PARITY_ADAPTED__) {
    globalThis.__ARGOCD_FULL_GRAPH_PARITY_ADAPTED__ = true;
    globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = options => {
      const {state, esc, rerender} = options;
      const base = () => String(state.baseUrl || '').replace(/\/+$/, '');
      const request = async (path, requestOptions = {}) => {
        const response = await fetch(`${base()}${path}`, {
          credentials: 'include',
          headers: {Accept: 'application/json', ...(requestOptions.body ? {'Content-Type': 'application/json'} : {})},
          ...requestOptions
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.status === 204 ? null : response.json();
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
        rerender?.();
      };
      const openOriginal = path => {
        if (!state.root) return;
        state.root.querySelector('.graph-parity-overlay')?.remove();
        const native = globalThis.__ARGOCD_FULL_NATIVE_FACTORY__({state, esc});
        const overlay = document.createElement('section');
        overlay.className = 'graph-parity-overlay';
        overlay.innerHTML = `<div class="graph-parity-top"><div><strong>Resource controls</strong><br><span>Complete Argo CD resource view without leaving Full UI.</span></div><button class="graph-parity-close" type="button" data-parity-close aria-label="Close resource controls">Close</button></div>${native.frame(path, {title: 'Resource controls', description: 'Native resource summary, manifests, diff, events, logs, exec, and parameterized actions.'})}`;
        state.root.appendChild(overlay);
        overlay.querySelector('[data-parity-close]')?.addEventListener('click', () => overlay.remove());
        native.bind(overlay);
      };

      return graphFactory({
        ...options,
        api: options.api || request,
        fetchText: options.fetchText || fetchText,
        reloadApp: options.reloadApp || reloadApp,
        openOriginal: options.openOriginal || openOriginal
      });
    };
  }
})();
