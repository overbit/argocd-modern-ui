(() => {
  if (globalThis.__ARGOCD_MODERN_UI_CONTENT__) {
    return;
  }
  globalThis.__ARGOCD_MODERN_UI_CONTENT__ = true;

  const ROOT_ATTRIBUTE = 'data-argocd-modern';
  const MODE_ATTRIBUTE = 'data-argocd-modern-mode';
  const THEME_ATTRIBUTE = 'data-argocd-modern-theme';
  const ROUTE_ATTRIBUTE = 'data-argocd-modern-route';
  const FOCUS_ATTRIBUTE = 'data-argocd-modern-focus';
  const TOOL_HOST_ID = 'argocd-modern-ui-tools';
  const FULL_UI_HOST_ID = 'argocd-modern-full-ui';
  const DEFAULT_SETTINGS = {configuredUrl: '', uiMode: 'hybrid', theme: 'system', enabled: true};

  let toolHost = null;
  let lastHref = location.href;
  let routeObserver = null;
  let renderQueued = false;
  let focusIssues = false;
  let disposed = false;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');

  function normalizeUrl(value) {
    const parsed = new URL(String(value || '').trim());
    let pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    if (pathname.length > 1) {
      pathname = pathname.replace(/\/+$/, '');
    }
    return `${parsed.origin}${pathname === '/' ? '' : pathname}`;
  }

  function normalizeMode(settings) {
    if (['original', 'hybrid', 'full'].includes(settings.uiMode)) {
      return settings.uiMode;
    }
    return settings.enabled === false ? 'original' : 'hybrid';
  }

  function resolveTheme(value) {
    if (value === 'light' || value === 'dark') {
      return value;
    }
    return systemTheme.matches ? 'dark' : 'light';
  }

  function isAllowedLocation(candidateUrl, configuredUrl) {
    if (!configuredUrl) {
      return false;
    }

    try {
      const candidate = new URL(candidateUrl);
      const configured = new URL(normalizeUrl(configuredUrl));
      if (candidate.origin !== configured.origin) {
        return false;
      }

      const basePath = configured.pathname === '/' ? '' : configured.pathname.replace(/\/+$/, '');
      return !basePath || candidate.pathname === basePath || candidate.pathname.startsWith(`${basePath}/`);
    } catch {
      return false;
    }
  }

  function relativePath(configuredUrl) {
    try {
      const configured = new URL(normalizeUrl(configuredUrl));
      const basePath = configured.pathname === '/' ? '' : configured.pathname.replace(/\/+$/, '');
      const currentPath = location.pathname;
      if (basePath && currentPath.startsWith(basePath)) {
        return currentPath.slice(basePath.length) || '/';
      }
      return currentPath;
    } catch {
      return location.pathname;
    }
  }

  function classifyRoute(configuredUrl) {
    const path = relativePath(configuredUrl);
    if (path.startsWith('/applicationsets')) return 'applicationsets';
    if (path === '/' || path.startsWith('/applications')) return 'applications';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/user-info')) return 'user-info';
    if (path.startsWith('/help')) return 'help';
    return 'other';
  }

  function isApplicationDetail(configuredUrl) {
    const path = relativePath(configuredUrl);
    return /^\/applications\/[^/]+/.test(path);
  }

  function extensionContextAvailable() {
    try {
      return Boolean(globalThis.chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function isExtensionContextInvalidated(error) {
    return /extension context invalidated/i.test(String(error?.message || error || ''));
  }

  function removeToolHost() {
    toolHost?.remove();
    toolHost = null;
  }

  function unmountFullUi() {
    globalThis.__ARGOCD_FULL_UI__?.unmount?.();
  }

  function clearAttributes() {
    document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
    document.documentElement.removeAttribute(MODE_ATTRIBUTE);
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    document.documentElement.removeAttribute(ROUTE_ATTRIBUTE);
    document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
  }

  function disableModernUi() {
    clearAttributes();
    focusIssues = false;
    removeToolHost();
    unmountFullUi();
  }

  function disposeExtensionContext() {
    if (disposed) {
      return;
    }
    disposed = true;
    renderQueued = false;
    routeObserver?.disconnect();
    routeObserver = null;
    systemTheme.removeEventListener?.('change', queueRender);
    window.removeEventListener('popstate', queueRender);
    window.removeEventListener('hashchange', queueRender);
    window.removeEventListener('pageshow', queueRender);
    try {
      globalThis.chrome?.storage?.onChanged?.removeListener?.(handleStorageChanged);
    } catch {
      // The extension API itself may already be unavailable. DOM cleanup is still safe.
    }
    try {
      disableModernUi();
    } catch {
      // Never allow cleanup to restart the invalidated runtime loop.
    }
    globalThis.__ARGOCD_MODERN_UI_RUNTIME__ = null;
    globalThis.__ARGOCD_MODERN_UI_CONTENT__ = false;
  }

  function handleRuntimeError(error) {
    if (isExtensionContextInvalidated(error) || !extensionContextAvailable()) {
      disposeExtensionContext();
      return;
    }
    console.error('[Argo CD Modern UI] Runtime error.', error);
  }

  async function setStoredSettings(values) {
    if (disposed || !extensionContextAvailable()) {
      disposeExtensionContext();
      return false;
    }
    try {
      await chrome.storage.local.set(values);
      return true;
    } catch (error) {
      handleRuntimeError(error);
      return false;
    }
  }

  globalThis.__ARGOCD_MODERN_UI_RUNTIME__ = {
    setUiMode(mode) {
      return setStoredSettings({uiMode: mode, enabled: mode !== 'original'});
    }
  };

  function versionText() {
    return document.querySelector('.sidebar__version')?.textContent?.trim() || '';
  }

  function mountTools(configuredUrl, theme) {
    if (disposed || !document.body) {
      return;
    }

    if (!toolHost) {
      toolHost = document.createElement('div');
      toolHost.id = TOOL_HOST_ID;
      toolHost.setAttribute('aria-label', 'Argo CD Modern UI controls');
      toolHost.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;';
      document.body.appendChild(toolHost);
      toolHost.attachShadow({mode: 'open'});
    }

    const dark = theme === 'dark';
    const shadow = toolHost.shadowRoot;
    const showFocus = isApplicationDetail(configuredUrl);
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .bar {
          --bg:${dark ? '#0d1117' : '#ffffff'}; --border:${dark ? '#30363d' : '#d0d7de'}; --text:${dark ? '#f0f6fc' : '#1f2328'}; --muted:${dark ? '#8b949e' : '#59636e'}; --hover:${dark ? '#21262d' : '#f6f8fa'}; --accent:${dark ? '#2f81f7' : '#0969da'};
          display:flex; align-items:center; gap:4px; padding:5px; border:1px solid var(--border); border-radius:7px; background:var(--bg); color:var(--text); box-shadow:0 8px 24px rgba(140,149,159,.2);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;
        }
        .brand { display:flex; align-items:center; gap:7px; padding:0 7px; color:var(--muted); font-size:11px; font-weight:600; white-space:nowrap; }
        .dot { width:7px; height:7px; border-radius:50%; background:#1a7f37; }
        button { all:unset; box-sizing:border-box; cursor:pointer; min-height:30px; padding:0 9px; border-radius:6px; color:var(--text); font-size:11px; font-weight:600; line-height:30px; white-space:nowrap; }
        button:hover { background:var(--hover); }
        button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
        button[data-active="true"] { background:${dark ? 'rgba(56,139,253,.15)' : '#ddf4ff'}; color:var(--accent); }
        .full { border:1px solid var(--border); }
        @media (max-width:640px) { .brand { display:none; } }
      </style>
      <div class="bar">
        <div class="brand"><span class="dot"></span>Hybrid${versionText() ? ` · ${versionText()}` : ''}</div>
        ${showFocus ? `<button id="focus" data-active="${focusIssues}">${focusIssues ? 'Show all' : 'Focus issues'}</button>` : ''}
        <button id="full" class="full">Full UI</button>
        <button id="original">Original</button>
      </div>
    `;

    shadow.getElementById('original')?.addEventListener('click', () => {
      void setStoredSettings({uiMode: 'original', enabled: false});
    });

    shadow.getElementById('full')?.addEventListener('click', () => {
      void setStoredSettings({uiMode: 'full', enabled: true});
    });

    shadow.getElementById('focus')?.addEventListener('click', () => {
      focusIssues = !focusIssues;
      if (focusIssues) {
        document.documentElement.setAttribute(FOCUS_ATTRIBUTE, 'issues');
      } else {
        document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
      }
      mountTools(configuredUrl, theme);
    });
  }

  function applyBaseAttributes(configuredUrl, mode, theme) {
    document.documentElement.setAttribute(ROOT_ATTRIBUTE, 'true');
    document.documentElement.setAttribute(MODE_ATTRIBUTE, mode);
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
    document.documentElement.setAttribute(ROUTE_ATTRIBUTE, classifyRoute(configuredUrl));
  }

  function applyHybridUi(configuredUrl, theme) {
    if (disposed) {
      return;
    }
    unmountFullUi();
    applyBaseAttributes(configuredUrl, 'hybrid', theme);
    if (focusIssues && isApplicationDetail(configuredUrl)) {
      document.documentElement.setAttribute(FOCUS_ATTRIBUTE, 'issues');
    } else {
      document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
      focusIssues = false;
    }
    mountTools(configuredUrl, theme);
  }

  async function applyFullUi(configuredUrl, theme) {
    if (disposed) {
      return;
    }
    focusIssues = false;
    document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
    removeToolHost();
    applyBaseAttributes(configuredUrl, 'full', theme);
    if (!document.body || !globalThis.__ARGOCD_FULL_UI__?.mount) {
      return;
    }
    await globalThis.__ARGOCD_FULL_UI__.mount({configuredUrl, theme});
  }

  async function render() {
    if (disposed || !extensionContextAvailable()) {
      disposeExtensionContext();
      return;
    }

    let settings;
    try {
      settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
    } catch (error) {
      handleRuntimeError(error);
      return;
    }

    if (disposed) {
      return;
    }
    if (!isAllowedLocation(location.href, settings.configuredUrl)) {
      disableModernUi();
      return;
    }

    const mode = normalizeMode(settings);
    if (mode === 'original') {
      disableModernUi();
      return;
    }

    const theme = resolveTheme(settings.theme);
    if (mode === 'full') {
      await applyFullUi(settings.configuredUrl, theme);
    } else {
      applyHybridUi(settings.configuredUrl, theme);
    }
  }

  function queueRender() {
    if (disposed) {
      return;
    }
    if (!extensionContextAvailable()) {
      disposeExtensionContext();
      return;
    }
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (disposed) {
        return;
      }
      if (location.href !== lastHref) {
        lastHref = location.href;
        focusIssues = false;
      }
      void render().catch(handleRuntimeError);
    });
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName === 'local' && (changes.enabled || changes.uiMode || changes.theme || changes.configuredUrl)) {
      queueRender();
    }
  }

  try {
    if (extensionContextAvailable()) {
      chrome.storage.onChanged.addListener(handleStorageChanged);
    } else {
      disposeExtensionContext();
    }
  } catch (error) {
    handleRuntimeError(error);
  }

  if (!disposed) {
    routeObserver = new MutationObserver(() => {
      const mode = document.documentElement.getAttribute(MODE_ATTRIBUTE);
      const expectedHostMissing = mode === 'full' ? !document.getElementById(FULL_UI_HOST_ID) : !toolHost?.isConnected;
      if (location.href !== lastHref || expectedHostMissing) {
        queueRender();
      }
    });
    routeObserver.observe(document.documentElement, {childList: true, subtree: true});

    systemTheme.addEventListener?.('change', queueRender);
    window.addEventListener('popstate', queueRender);
    window.addEventListener('hashchange', queueRender);
    window.addEventListener('pageshow', queueRender);

    void render().catch(handleRuntimeError);
  }
})();
