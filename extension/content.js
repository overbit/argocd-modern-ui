(() => {
  if (globalThis.__ARGOCD_MODERN_UI_CONTENT__) {
    return;
  }
  globalThis.__ARGOCD_MODERN_UI_CONTENT__ = true;

  const ROOT_ATTRIBUTE = 'data-argocd-modern';
  const ROUTE_ATTRIBUTE = 'data-argocd-modern-route';
  const FOCUS_ATTRIBUTE = 'data-argocd-modern-focus';
  const TOOL_HOST_ID = 'argocd-modern-ui-tools';
  const DEFAULT_SETTINGS = {configuredUrl: '', enabled: true};

  let toolHost = null;
  let lastHref = location.href;
  let routeObserver = null;
  let renderQueued = false;
  let focusIssues = false;

  function normalizeUrl(value) {
    const parsed = new URL(String(value || '').trim());
    let pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    if (pathname.length > 1) {
      pathname = pathname.replace(/\/+$/, '');
    }
    return `${parsed.origin}${pathname === '/' ? '' : pathname}`;
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
    if (path === '/' || path.startsWith('/applications')) return 'applications';
    if (path.startsWith('/applicationsets')) return 'applicationsets';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/user-info')) return 'user-info';
    if (path.startsWith('/help')) return 'help';
    return 'other';
  }

  function isApplicationDetail(configuredUrl) {
    const path = relativePath(configuredUrl);
    return /^\/applications\/[^/]+/.test(path);
  }

  function removeToolHost() {
    toolHost?.remove();
    toolHost = null;
  }

  function disableModernUi() {
    document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
    document.documentElement.removeAttribute(ROUTE_ATTRIBUTE);
    document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
    focusIssues = false;
    removeToolHost();
  }

  function versionText() {
    return document.querySelector('.sidebar__version')?.textContent?.trim() || '';
  }

  function mountTools(configuredUrl) {
    if (!document.body) {
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

    const shadow = toolHost.shadowRoot;
    const showFocus = isApplicationDetail(configuredUrl);
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.94);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.24);
          backdrop-filter: blur(14px);
          font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 7px;
          color: #cbd5e1;
          font-size: 11px;
          font-weight: 650;
          letter-spacing: .01em;
          white-space: nowrap;
        }
        .dot { width: 7px; height: 7px; border-radius: 999px; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.12); }
        button {
          all: unset;
          box-sizing: border-box;
          cursor: pointer;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 650;
          line-height: 30px;
          white-space: nowrap;
        }
        button:hover { background: rgba(148,163,184,.14); }
        button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
        button[data-active="true"] { background: rgba(96,165,250,.16); color: #bfdbfe; }
        .original { color: #f8fafc; background: rgba(255,255,255,.08); }
        @media (max-width: 640px) {
          .brand { display: none; }
          .bar { border-radius: 10px; }
        }
      </style>
      <div class="bar">
        <div class="brand"><span class="dot"></span>Modern${versionText() ? ` / ${versionText()}` : ''}</div>
        ${showFocus ? `<button id="focus" data-active="${focusIssues}">${focusIssues ? 'Show all' : 'Focus issues'}</button>` : ''}
        <button id="original" class="original">Original UI</button>
      </div>
    `;

    shadow.getElementById('original')?.addEventListener('click', () => {
      void chrome.storage.local.set({enabled: false});
    });

    shadow.getElementById('focus')?.addEventListener('click', () => {
      focusIssues = !focusIssues;
      if (focusIssues) {
        document.documentElement.setAttribute(FOCUS_ATTRIBUTE, 'issues');
      } else {
        document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
      }
      mountTools(configuredUrl);
    });
  }

  function applyModernUi(configuredUrl) {
    document.documentElement.setAttribute(ROOT_ATTRIBUTE, 'true');
    document.documentElement.setAttribute(ROUTE_ATTRIBUTE, classifyRoute(configuredUrl));
    if (focusIssues && isApplicationDetail(configuredUrl)) {
      document.documentElement.setAttribute(FOCUS_ATTRIBUTE, 'issues');
    } else {
      document.documentElement.removeAttribute(FOCUS_ATTRIBUTE);
      focusIssues = false;
    }
    mountTools(configuredUrl);
  }

  async function render() {
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
    if (!isAllowedLocation(location.href, settings.configuredUrl) || settings.enabled === false) {
      disableModernUi();
      return;
    }
    applyModernUi(settings.configuredUrl);
  }

  function queueRender() {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (location.href !== lastHref) {
        lastHref = location.href;
        focusIssues = false;
      }
      void render();
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.enabled || changes.configuredUrl)) {
      queueRender();
    }
  });

  routeObserver = new MutationObserver(() => {
    // Argo CD is a SPA. React mutations are a useful route-change signal, but
    // log/terminal views can mutate continuously. Re-render only when the URL
    // changed or when our isolated escape-hatch host was removed.
    if (location.href !== lastHref || !toolHost?.isConnected) {
      queueRender();
    }
  });
  routeObserver.observe(document.documentElement, {childList: true, subtree: true});

  window.addEventListener('popstate', queueRender);
  window.addEventListener('hashchange', queueRender);
  window.addEventListener('pageshow', queueRender);

  void render();
})();
