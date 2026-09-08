(() => {
  if (globalThis.__ARGOCD_FULL_NATIVE_FACTORY__) return;

  globalThis.__ARGOCD_FULL_NATIVE_FACTORY__ = ({state, esc}) => {
    const styles = `
      .parity-surface{border:1px solid var(--border);border-radius:10px;background:var(--panel);overflow:hidden;box-shadow:0 1px 2px rgba(31,35,40,.04)}
      .parity-head{display:flex;align-items:center;gap:12px;min-height:48px;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--bg)}
      .parity-head strong{font-size:13px}.parity-head small{display:block;color:var(--muted);font-size:11px}.parity-path{margin-left:auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font:11px/1.4 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace}
      .parity-frame{display:block;width:100%;height:calc(100vh - 190px);min-height:620px;border:0;background:var(--panel)}
      .parity-note{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:11px}.parity-note i{width:7px;height:7px;border-radius:50%;background:var(--ok);flex:none}
      @media(max-width:900px){.parity-frame{height:calc(100vh - 160px);min-height:520px}.parity-path{display:none}.parity-head{padding:8px 10px}}
    `;

    const cleanPath = path => `/${String(path || '').replace(/^\/+/, '')}`;
    const urlFor = path => `${String(state.baseUrl || '').replace(/\/+$/, '')}${cleanPath(path)}`;

    function frame(path, {title = 'Argo CD controls', description = 'Complete native functionality inside Full UI.', fullChrome = false} = {}) {
      const normalized = cleanPath(path);
      return `<section class="parity-surface"><div class="parity-head"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div><div class="parity-note"><i></i><span>Authenticated same-origin session</span></div><code class="parity-path">${esc(normalized)}</code></div><iframe class="parity-frame" data-native-frame data-native-chrome="${fullChrome ? 'full' : 'compact'}" src="${esc(urlFor(normalized))}" title="${esc(title)}"></iframe></section>`;
    }

    function installCompactChrome(frame) {
      if (frame.dataset.nativeChrome === 'full') return;
      try {
        const doc = frame.contentDocument;
        if (!doc?.head || doc.getElementById('argocd-modern-parity-style')) return;
        doc.documentElement.dataset.argocdModernEmbedded = 'true';
        const style = doc.createElement('style');
        style.id = 'argocd-modern-parity-style';
        style.textContent = `
          html[data-argocd-modern-embedded="true"] .sb-page-wrapper__sidebar,
          html[data-argocd-modern-embedded="true"] .sidebar { display:none !important; }
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

    function bind() {
      state.root?.querySelectorAll('[data-native-frame]').forEach(frameNode => {
        const onLoad = () => installCompactChrome(frameNode);
        frameNode.addEventListener('load', onLoad);
        if (frameNode.contentDocument?.readyState === 'complete') onLoad();
      });
    }

    return {styles, frame, bind, urlFor, cleanPath};
  };
})();
