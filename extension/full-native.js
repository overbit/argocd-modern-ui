(() => {
  if (globalThis.__ARGOCD_FULL_NATIVE_FACTORY__) return;

  globalThis.__ARGOCD_FULL_NATIVE_FACTORY__ = ({state, esc}) => {
    const styles = `
      .button,.nav button,.app-tabs button{min-height:44px}
      .parity-surface{border:1px solid var(--border);border-radius:10px;background:var(--panel);overflow:hidden;box-shadow:0 1px 2px rgba(31,35,40,.04)}
      .parity-head{display:flex;align-items:center;gap:12px;min-height:52px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--bg)}
      .parity-head strong{font-size:13px}.parity-head small{display:block;color:var(--muted);font-size:11px}.parity-path{margin-left:auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font:11px/1.4 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace}
      .parity-frame{display:block;width:100%;height:calc(100vh - 190px);min-height:620px;border:0;background:var(--panel);color-scheme:inherit}
      .parity-note{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px}.parity-note i{width:7px;height:7px;border-radius:50%;background:var(--ok);flex:none}
      .graph-parity-overlay{position:fixed;inset:12px;z-index:1000;display:grid;grid-template-rows:56px minmax(0,1fr);overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--bg);box-shadow:0 24px 80px rgba(1,4,9,.32)}
      .graph-parity-top{display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--border);background:var(--panel)}.graph-parity-top strong{font-size:13px}.graph-parity-top span{color:var(--muted);font-size:11px}.graph-parity-close{margin-left:auto;min-width:44px;min-height:44px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text);font-weight:650;cursor:pointer}.graph-parity-close:hover{background:var(--soft)}.graph-parity-close:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.graph-parity-overlay .parity-surface{height:100%;border:0;border-radius:0}.graph-parity-overlay .parity-frame{height:calc(100vh - 130px);min-height:0}
      .app.dark .parity-surface,.app.dark .parity-head,.app.dark .graph-parity-overlay,.app.dark .graph-parity-top{background:#0d1117;color:#f0f6fc;border-color:#30363d}.app.dark .parity-frame{background:#010409}
      @media(max-width:900px){.parity-frame{height:calc(100vh - 160px);min-height:520px}.parity-path{display:none}.parity-head{padding:8px 10px}.graph-parity-overlay{inset:6px}.graph-parity-overlay .parity-frame{height:calc(100vh - 116px)}}
    `;

    const cleanPath = path => `/${String(path || '').replace(/^\/+/, '')}`;
    const urlFor = path => `${String(state.baseUrl || '').replace(/\/+$/, '')}${cleanPath(path)}`;

    function frame(path, {title = 'Argo CD controls', description = 'Complete native functionality inside Full UI.', fullChrome = false} = {}) {
      const normalized = cleanPath(path);
      return `<section class="parity-surface"><div class="parity-head"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div><div class="parity-note"><i></i><span>Authenticated same-origin session</span></div><code class="parity-path">${esc(normalized)}</code></div><iframe class="parity-frame" data-native-frame data-native-chrome="${fullChrome ? 'full' : 'compact'}" src="${esc(urlFor(normalized))}" title="${esc(title)}"></iframe></section>`;
    }

    function installFrameTheme(frameNode) {
      try {
        const doc = frameNode.contentDocument;
        if (!doc?.head) return;
        doc.documentElement.dataset.argocdModernEmbedded = frameNode.dataset.nativeChrome === 'full' ? 'false' : 'true';
        doc.documentElement.dataset.argocdModernEmbeddedTheme = state.theme === 'dark' ? 'dark' : 'light';
        if (doc.getElementById('argocd-modern-parity-style')) return;
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

          html[data-argocd-modern-embedded-theme="dark"] { color-scheme:dark !important; background:#010409 !important; color:#f0f6fc !important; }
          html[data-argocd-modern-embedded-theme="dark"] body,
          html[data-argocd-modern-embedded-theme="dark"] .theme-light,
          html[data-argocd-modern-embedded-theme="dark"] .theme-dark,
          html[data-argocd-modern-embedded-theme="dark"] .cd-layout,
          html[data-argocd-modern-embedded-theme="dark"] .sb-page-wrapper,
          html[data-argocd-modern-embedded-theme="dark"] .sb-page-wrapper__content,
          html[data-argocd-modern-embedded-theme="dark"] .page,
          html[data-argocd-modern-embedded-theme="dark"] .page__content,
          html[data-argocd-modern-embedded-theme="dark"] .application-details { background:#010409 !important; color:#f0f6fc !important; }
          html[data-argocd-modern-embedded-theme="dark"] .white-box,
          html[data-argocd-modern-embedded-theme="dark"] .panel,
          html[data-argocd-modern-embedded-theme="dark"] .argo-table-list,
          html[data-argocd-modern-embedded-theme="dark"] .argo-table-list__row,
          html[data-argocd-modern-embedded-theme="dark"] .applications-list__entry,
          html[data-argocd-modern-embedded-theme="dark"] .application-details__status-panel,
          html[data-argocd-modern-embedded-theme="dark"] .application-details__status-panel .row,
          html[data-argocd-modern-embedded-theme="dark"] .sliding-panel,
          html[data-argocd-modern-embedded-theme="dark"] .sliding-panel__body,
          html[data-argocd-modern-embedded-theme="dark"] .argo-modal__content,
          html[data-argocd-modern-embedded-theme="dark"] .filters-group,
          html[data-argocd-modern-embedded-theme="dark"] .filter,
          html[data-argocd-modern-embedded-theme="dark"] .menu,
          html[data-argocd-modern-embedded-theme="dark"] .dropdown__menu,
          html[data-argocd-modern-embedded-theme="dark"] .select__menu { background:#0d1117 !important; color:#f0f6fc !important; border-color:#30363d !important; }
          html[data-argocd-modern-embedded-theme="dark"] .page__top-bar,
          html[data-argocd-modern-embedded-theme="dark"] .flex-top-bar,
          html[data-argocd-modern-embedded-theme="dark"] .top-bar,
          html[data-argocd-modern-embedded-theme="dark"] .argo-table-list__header { background:#161b22 !important; color:#f0f6fc !important; border-color:#30363d !important; }
          html[data-argocd-modern-embedded-theme="dark"] input,
          html[data-argocd-modern-embedded-theme="dark"] textarea,
          html[data-argocd-modern-embedded-theme="dark"] select,
          html[data-argocd-modern-embedded-theme="dark"] option,
          html[data-argocd-modern-embedded-theme="dark"] .argo-field,
          html[data-argocd-modern-embedded-theme="dark"] .argo-select,
          html[data-argocd-modern-embedded-theme="dark"] .select__control { background:#010409 !important; color:#f0f6fc !important; border-color:#484f58 !important; }
          html[data-argocd-modern-embedded-theme="dark"] pre,
          html[data-argocd-modern-embedded-theme="dark"] code,
          html[data-argocd-modern-embedded-theme="dark"] .logs-viewer,
          html[data-argocd-modern-embedded-theme="dark"] .pod-logs-viewer,
          html[data-argocd-modern-embedded-theme="dark"] .code-editor { background:#010409 !important; color:#f0f6fc !important; border-color:#30363d !important; }
          html[data-argocd-modern-embedded-theme="dark"] h1,
          html[data-argocd-modern-embedded-theme="dark"] h2,
          html[data-argocd-modern-embedded-theme="dark"] h3,
          html[data-argocd-modern-embedded-theme="dark"] h4,
          html[data-argocd-modern-embedded-theme="dark"] h5,
          html[data-argocd-modern-embedded-theme="dark"] label { color:#f0f6fc !important; }

          html[data-argocd-modern-embedded-theme="light"] { color-scheme:light !important; background:#f6f8fa !important; color:#1f2328 !important; }
          html[data-argocd-modern-embedded-theme="light"] body,
          html[data-argocd-modern-embedded-theme="light"] .theme-light,
          html[data-argocd-modern-embedded-theme="light"] .theme-dark,
          html[data-argocd-modern-embedded-theme="light"] .cd-layout,
          html[data-argocd-modern-embedded-theme="light"] .sb-page-wrapper,
          html[data-argocd-modern-embedded-theme="light"] .sb-page-wrapper__content,
          html[data-argocd-modern-embedded-theme="light"] .page,
          html[data-argocd-modern-embedded-theme="light"] .page__content { background:#f6f8fa !important; color:#1f2328 !important; }
        `;
        doc.head.appendChild(style);
      } catch (error) {
        console.debug('[Argo CD Modern UI] Native parity frame could not be themed.', error);
      }
    }

    function bind(root = state.root) {
      root?.querySelectorAll('[data-native-frame]').forEach(frameNode => {
        const onLoad = () => installFrameTheme(frameNode);
        frameNode.addEventListener('load', onLoad);
        if (frameNode.contentDocument?.readyState === 'complete') onLoad();
      });
    }

    function applyTheme(root = state.root) {
      root?.querySelectorAll('[data-native-frame]').forEach(installFrameTheme);
    }

    return {styles, frame, bind, applyTheme, urlFor, cleanPath};
  };

  const graphFactory = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__;
  if (graphFactory && !globalThis.__ARGOCD_FULL_GRAPH_PARITY_ADAPTED__) {
    globalThis.__ARGOCD_FULL_GRAPH_PARITY_ADAPTED__ = true;
    globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = options => {
      const {state, esc, rerender} = options;
      const base = () => String(state.baseUrl || '').replace(/\/+$/, '');
      const resourceIdentity = resource => [resource?.group || '', resource?.kind || '', resource?.namespace || '', resource?.name || ''].join('|');
      const mergeResourceStatus = () => {
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
      };
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
        mergeResourceStatus();
        rerender?.();
      };
      const openOriginal = path => {
        if (!state.root) return;
        state.root.querySelector('.graph-parity-overlay')?.remove();
        const native = globalThis.__ARGOCD_FULL_NATIVE_FACTORY__({state, esc});
        const overlay = document.createElement('section');
        overlay.className = 'graph-parity-overlay';
        overlay.innerHTML = `<div class="graph-parity-top"><div><strong>Resource fallback</strong><br><span>Native Argo CD view for terminal and version-specific resource workflows.</span></div><button class="graph-parity-close" type="button" data-parity-close aria-label="Close resource fallback">Close</button></div>${native.frame(path, {title: 'Resource fallback', description: 'Native terminal, advanced log controls, and version-specific resource UI.'})}`;
        state.root.appendChild(overlay);
        overlay.querySelector('[data-parity-close]')?.addEventListener('click', () => overlay.remove());
        native.bind(overlay);
      };

      const graph = graphFactory({
        ...options,
        api: options.api || request,
        fetchText: options.fetchText || fetchText,
        reloadApp: options.reloadApp || reloadApp,
        openOriginal: options.openOriginal || openOriginal
      });
      const wrap = method => (...args) => {
        mergeResourceStatus();
        return graph[method](...args);
      };
      return {
        ...graph,
        resourceNodes: wrap('resourceNodes'),
        toolbar: wrap('toolbar'),
        content: wrap('content'),
        bind: wrap('bind')
      };
    };
  }
})();