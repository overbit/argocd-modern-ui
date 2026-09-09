(() => {
  if (globalThis.__ARGOCD_FULL_UI__) return;

  const state = {
    host: null,
    root: null,
    baseUrl: '',
    theme: 'light',
    apps: [],
    appSets: [],
    selected: null,
    tree: null,
    view: 'applications',
    appTab: 'topology',
    directView: null
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(`${state.baseUrl.replace(/\/+$/, '')}${path}`, {
      credentials: 'include',
      headers: {Accept: 'application/json', ...(options.body ? {'Content-Type': 'application/json'} : {})},
      ...options
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  };
  const items = value => Array.isArray(value) ? value : value?.items || [];
  const health = app => app?.status?.health?.status || 'Unknown';
  const sync = app => app?.status?.sync?.status || 'Unknown';
  const tone = value => ['Healthy','Synced','Succeeded'].includes(value) ? 'ok' : ['Degraded','Missing','Failed','Error'].includes(value) ? 'bad' : ['Progressing','OutOfSync','Suspended'].includes(value) ? 'warn' : 'muted';
  const badge = value => `<span class="badge ${tone(value)}"><i></i>${esc(value || 'Unknown')}</span>`;
  const key = app => `${app?.metadata?.namespace || ''}/${app?.metadata?.name || ''}`;
  const direct = globalThis.__ARGOCD_FULL_DIRECT_FACTORY__?.({state, esc});
  const graph = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__?.({state, esc, badge, tone, health, sync, rerender: () => renderApp()});
  const controls = globalThis.__ARGOCD_FULL_CONTROLS_FACTORY__?.({
    state,
    api,
    esc,
    badge,
    health,
    sync,
    rerender: () => renderApp(),
    reloadApp: () => reloadSelected(),
    onDeleted: () => navigate('applications', true)
  });

  async function setUiMode(mode) {
    const runtime = globalThis.__ARGOCD_MODERN_UI_RUNTIME__;
    if (runtime?.setUiMode) {
      await runtime.setUiMode(mode);
      return;
    }
    try {
      if (!globalThis.chrome?.runtime?.id) return;
      await chrome.storage.local.set({uiMode: mode, enabled: mode !== 'original'});
    } catch (error) {
      if (!/extension context invalidated/i.test(String(error?.message || error || ''))) console.error('[Argo CD Modern UI] Unable to switch UI mode.', error);
    }
  }

  const styles = `
    :host{all:initial}*{box-sizing:border-box}.app{--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--soft:#afb8c133;--accent:#0969da;--green:#1f883d;--ok:#1a7f37;--warn:#9a6700;--bad:#cf222e;position:fixed;inset:0;z-index:2147483646;display:grid;grid-template-columns:220px minmax(0,1fr);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);color-scheme:light}
    .app.dark{--bg:#010409;--panel:#0d1117;--text:#f0f6fc;--muted:#8b949e;--border:#30363d;--soft:#6e768133;--accent:#2f81f7;--green:#238636;--ok:#3fb950;--warn:#d29922;--bad:#f85149;color-scheme:dark}.side{background:var(--panel);border-right:1px solid var(--border);padding:16px 12px;display:flex;flex-direction:column;gap:16px}.brand{font-weight:700;padding:0 8px}.brand small{display:block;color:var(--muted);font-weight:400;font-size:11px}.nav{display:grid;gap:3px}.nav button,.plain{border:0;background:transparent;color:inherit;text-align:left;padding:8px 9px;min-height:36px;border-radius:6px;cursor:pointer}.nav button:hover,.nav button.active,.plain:hover{background:var(--soft)}.bottom{margin-top:auto;border-top:1px solid var(--border);padding-top:12px;display:grid;gap:6px}.main{overflow:auto;background:var(--bg);color:var(--text)}.top{height:56px;display:flex;align-items:center;gap:8px;padding:0 24px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:2}.top strong{font-size:16px}.spacer{flex:1}.content{max-width:1480px;margin:auto;padding:24px}.hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.hero h1{font-size:24px;line-height:1.2;margin:0}.hero p{color:var(--muted);margin:4px 0 0}.hero-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.button{border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:6px;padding:6px 11px;min-height:36px;font-weight:600;cursor:pointer;color-scheme:inherit}.button:hover:not(:disabled){background:var(--soft)}.button.primary{background:var(--green);color:#fff;border-color:transparent}.button.danger{border-color:color-mix(in srgb,var(--bad) 55%,var(--border));color:var(--bad)}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.stat,.panel,.card{border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:6px}.stat{padding:12px 14px}.stat span{color:var(--muted);font-size:12px}.stat b{display:block;font-size:22px}.panel{overflow:hidden}.panel-head{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--bg)}.panel-head input{margin-left:auto;width:min(340px,45vw);height:34px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text);padding:0 9px;color-scheme:inherit}.row{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(130px,.8fr) 115px 115px;gap:12px;align-items:center;padding:9px 13px;min-height:54px;border-bottom:1px solid var(--border);background:var(--panel);color:var(--text);cursor:pointer}.row:last-child{border-bottom:0}.row:hover{background:var(--bg)}.row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.name b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.name small,.muted{color:var(--muted)}.badge{display:inline-flex;gap:6px;align-items:center;font-size:11px;font-weight:600}.badge i{width:8px;height:8px;border-radius:50%;background:currentColor}.badge.ok{color:var(--ok)}.badge.warn{color:var(--warn)}.badge.bad{color:var(--bad)}.badge.muted{color:var(--muted)}.kv{display:grid;grid-template-columns:100px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)}.kv span:first-child{color:var(--muted)}.empty,.error{padding:32px;text-align:center;color:var(--muted)}.error{color:var(--bad)}.app-tabs{display:flex;gap:4px;margin:14px 0 10px;padding:4px;width:max-content;border:1px solid var(--border);border-radius:8px;background:var(--bg)}.app-tabs button{min-height:36px;padding:6px 12px;border:0;border-radius:6px;background:transparent;color:var(--muted);font-weight:650;cursor:pointer}.app-tabs button:hover{color:var(--text);background:var(--soft)}.app-tabs button.active{background:var(--panel);color:var(--text);box-shadow:0 1px 2px rgba(31,35,40,.08)}.app-tabs button:focus-visible,.button:focus-visible,.nav button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.full-control-intro{margin-bottom:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--panel);color:var(--muted);font-size:12px}
    .app input,.app textarea,.app select,.app option{color-scheme:inherit}.app.dark input,.app.dark textarea,.app.dark select,.app.dark option{background-color:var(--bg);color:var(--text);border-color:var(--border)}.app.dark .panel,.app.dark .card,.app.dark .stat,.app.dark .row,.app.dark .button,.app.dark .top,.app.dark .side{background-color:var(--panel);color:var(--text);border-color:var(--border)}.app.dark .panel-head,.app.dark .row:hover{background-color:var(--bg)}
    @media(max-width:900px){.app{grid-template-columns:64px 1fr}.brand span,.nav span,.bottom span{display:none}.stats{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr 100px 100px}.row>*:nth-child(2){display:none}.hero{align-items:stretch}.hero-actions{justify-content:flex-start}.content{padding:18px}}
    @media(max-width:600px){.content{padding:14px}.top{padding:0 14px}.hero{display:grid}.stats{grid-template-columns:1fr 1fr}.app-tabs{width:100%}.app-tabs button{flex:1}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
    ${graph?.styles || ''}
    ${controls?.styles || ''}
    ${direct?.styles || ''}
  `;

  const objectRoute = (collection, object) => {
    const name = encodeURIComponent(object?.metadata?.name || '');
    const namespace = object?.metadata?.namespace || '';
    return namespace ? `/${collection}/${encodeURIComponent(namespace)}/${name}` : `/${collection}/${name}`;
  };

  function activeSection(section) {
    if (section === 'applications' && ['applications', 'application'].includes(state.view)) return true;
    if (section === 'applicationsets' && state.view === 'applicationsets') return true;
    if (state.view !== 'direct' || !state.directView?.path) return false;
    const path = state.directView.path;
    if (section === 'applications') return path === '/applications' || path.startsWith('/applications?') || path.startsWith('/applications/');
    if (section === 'applicationsets') return path === '/applicationsets' || path.startsWith('/applicationsets?') || path.startsWith('/applicationsets/');
    if (section === 'settings') return path === '/settings' || path.startsWith('/settings/');
    return path === `/${section}` || path.startsWith(`/${section}/`);
  }

  function shell(body, title = 'Applications') {
    if (!state.root) return;
    state.root.innerHTML = `<style>${styles}</style><div class="app ${state.theme === 'dark' ? 'dark' : ''}"><aside class="side"><div class="brand">Argo CD <small><span>Full replacement UI</span></small></div><nav class="nav" aria-label="Primary"><button data-view="applications" class="${activeSection('applications') ? 'active' : ''}">◫ <span>Applications</span></button><button data-view="applicationsets" class="${activeSection('applicationsets') ? 'active' : ''}">▦ <span>ApplicationSets</span></button><button data-view="settings" class="${activeSection('settings') ? 'active' : ''}">⚙ <span>Settings</span></button><button data-view="user-info" class="${activeSection('user-info') ? 'active' : ''}">○ <span>User info</span></button><button data-view="help" class="${activeSection('help') ? 'active' : ''}">? <span>Help</span></button></nav><div class="bottom"><button class="button" data-mode="hybrid"><span>Hybrid UI</span>↔</button><button class="button" data-mode="original"><span>Original UI</span>↩</button></div></aside><main class="main"><header class="top"><strong>${esc(title)}</strong><div class="spacer"></div><button class="button" data-refresh>Refresh</button></header><div class="content">${body}</div></main></div>`;
    bind();
  }

  function bind() {
    if (!state.root) return;
    state.root.querySelectorAll('[data-view]').forEach(node => node.onclick = () => { void navigate(node.dataset.view, true); });
    state.root.querySelectorAll('[data-mode]').forEach(node => node.onclick = () => { void setUiMode(node.dataset.mode); });
    state.root.querySelectorAll('[data-direct-path]').forEach(node => node.onclick = () => renderDirect(node.dataset.directPath, node.dataset.directTitle || 'Controls'));
    state.root.querySelectorAll('[data-app-tab]').forEach(node => node.onclick = () => { state.appTab = node.dataset.appTab; renderApp(); });
    state.root.querySelector('[data-refresh]')?.addEventListener('click', () => {
      if (state.view === 'application') void reloadSelected();
      else if (state.view === 'direct' && state.directView) renderDirect(state.directView.path, state.directView.title);
      else void navigate(state.view, true);
    });
    state.root.querySelector('[data-back]')?.addEventListener('click', () => { void navigate('applications'); });
    state.root.querySelectorAll('[data-app]').forEach(node => {
      node.onclick = () => { void openApp(node.dataset.app); };
      node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openApp(node.dataset.app); } };
    });
    const filter = state.root.querySelector('[data-app-filter]');
    filter?.addEventListener('input', () => renderApps(filter.value, true));
    controls?.bind();
    graph?.bind();
    direct?.bind();
  }

  function error(message, title) {
    shell(`<div class="panel error">Full UI could not load this view: ${esc(message)}<br><br><button class="button" data-mode="hybrid">Open Hybrid UI</button></div>`, title);
  }

  function loading(title) { shell('<div class="panel empty">Loading from Argo CD…</div>', title); }

  function renderDirect(path, title = 'Controls') {
    if (!direct) return error('The direct Full UI controls module is unavailable.', title);
    state.view = 'direct';
    state.directView = {path: direct.cleanPath(path), title};
    shell(direct.frame(state.directView.path, {title, description: 'Direct Full UI controls backed by Argo CD APIs.'}), title);
  }

  function renderApps(filter = '', preserveFocus = false) {
    const query = filter.toLowerCase();
    const visible = query ? state.apps.filter(app => [app?.metadata?.name, app?.metadata?.namespace, app?.spec?.project].some(value => String(value || '').toLowerCase().includes(query))) : state.apps;
    const healthy = state.apps.filter(app => health(app) === 'Healthy').length;
    const problem = state.apps.filter(app => ['Degraded','Missing'].includes(health(app)) || sync(app) === 'OutOfSync').length;
    const progressing = state.apps.filter(app => health(app) === 'Progressing').length;
    const rows = visible.map(app => `<div class="row" tabindex="0" role="button" data-app="${esc(key(app))}"><div class="name"><b>${esc(app?.metadata?.name)}</b><small>${esc(app?.metadata?.namespace || 'argocd')} · ${esc(app?.spec?.project || 'default')}</small></div><div class="muted">${esc(app?.spec?.destination?.namespace || '—')}</div><div>${badge(health(app))}</div><div>${badge(sync(app))}</div></div>`).join('');
    shell(`<div class="hero"><div><h1>Applications</h1><p>Health, synchronization and deployment topology across the configured Argo CD instance.</p></div><div class="hero-actions"><button class="button" data-direct-path="/applications" data-direct-title="Manage applications">Manage applications</button><button class="button primary" data-direct-path="/applications?create=1" data-direct-title="New application">New application</button></div></div><div class="stats"><div class="stat"><span>Total</span><b>${state.apps.length}</b></div><div class="stat"><span>Healthy</span><b>${healthy}</b></div><div class="stat"><span>Progressing</span><b>${progressing}</b></div><div class="stat"><span>Needs attention</span><b>${problem}</b></div></div><div class="panel"><div class="panel-head"><b>Applications</b><input data-app-filter placeholder="Filter name, namespace, project" value="${esc(filter)}"></div>${rows || '<div class="empty">No applications found.</div>'}</div>`, 'Applications');
    if (preserveFocus) {
      const input = state.root?.querySelector('[data-app-filter]'); input?.focus(); input?.setSelectionRange?.(input.value.length, input.value.length);
    }
  }

  function renderAppSets() {
    const rows = state.appSets.map(set => {
      const route = objectRoute('applicationsets', set);
      return `<div class="row" tabindex="0" role="button" data-direct-path="${esc(route)}" data-direct-title="${esc(set?.metadata?.name || 'ApplicationSet')}"><div class="name"><b>${esc(set?.metadata?.name)}</b><small>${esc(set?.metadata?.namespace || 'argocd')}</small></div><div class="muted">${esc(set?.spec?.template?.spec?.project || 'default')}</div><div>${badge(set?.status?.conditions?.some(c => c.status === 'False') ? 'Degraded' : 'Healthy')}</div><div class="muted">${esc(set?.status?.conditions?.at(-1)?.type || '—')}</div></div>`;
    }).join('');
    shell(`<div class="hero"><div><h1>ApplicationSets</h1><p>Generator-backed definitions managed directly in the Full replacement UI.</p></div><div class="hero-actions"><button class="button" data-direct-path="/applicationsets" data-direct-title="Manage ApplicationSets">Manage ApplicationSets</button><button class="button primary" data-direct-path="/applicationsets?create=1" data-direct-title="New ApplicationSet">New ApplicationSet</button></div></div><div class="panel">${rows || '<div class="empty">No ApplicationSets found.</div>'}</div>`, 'ApplicationSets');
  }

  function renderApp() {
    const app = state.selected;
    if (!app) return;
    const nodes = graph?.resourceNodes().sort((a, b) => Number(graph.needsAttention(b)) - Number(graph.needsAttention(a)) || String(a.kind || '').localeCompare(String(b.kind || ''))) || [...(state.tree?.nodes || []), ...(state.tree?.orphanedNodes || [])];
    const repo = app?.spec?.source?.repoURL || app?.spec?.sources?.[0]?.repoURL || '—';
    const appRoute = objectRoute('applications', app);
    const tabs = `<div class="app-tabs" role="tablist" aria-label="Application view"><button role="tab" aria-selected="${state.appTab === 'topology'}" data-app-tab="topology" class="${state.appTab === 'topology' ? 'active' : ''}">Topology</button><button role="tab" aria-selected="${state.appTab === 'controls'}" data-app-tab="controls" class="${state.appTab === 'controls' ? 'active' : ''}">Controls & spec</button></div>`;
    const hero = `<div class="hero"><div><button class="button" data-back>← Back</button><h1 style="margin-top:12px">${esc(app?.metadata?.name)}</h1><p>${esc(app?.metadata?.namespace || 'argocd')} · ${esc(app?.spec?.project || 'default')}</p></div><div class="hero-actions"><button class="button" data-direct-path="${esc(appRoute)}" data-direct-title="Edit ${esc(app?.metadata?.name || 'application')}">Edit application</button></div></div>`;
    const summary = `<div class="app-summary"><div class="summary-chip"><span>Health</span>${badge(health(app))}</div><div class="summary-chip"><span>Sync</span>${badge(sync(app))}</div><div class="summary-chip"><span>Destination</span><b>${esc(app?.spec?.destination?.namespace || '—')}</b></div><div class="summary-chip"><span>Repository</span><b title="${esc(repo)}">${esc(repo)}</b></div></div>`;
    const appControls = controls?.toolbar() || '';
    const controlPanel = controls?.panel() || '';

    if (state.appTab === 'controls') {
      const directControls = direct ? direct.frame(appRoute, {title: `${app?.metadata?.name || 'Application'} controls`, description: 'Direct Application object, source, destination and sync-policy editing.'}) : '<div class="panel error">Direct controls are unavailable.</div>';
      shell(`${hero}${summary}${appControls}${tabs}<div class="full-control-intro">This surface is fully implemented by the replacement UI. No original Argo CD page or iframe is embedded.</div>${directControls}${controlPanel}`, app?.metadata?.name || 'Application');
      return;
    }

    if (!graph) {
      const resources = nodes.slice(0, 250).map(node => `<div class="row"><div class="name"><b>${esc(node?.name)}</b><small>${esc(node?.kind || 'Resource')}</small></div><div class="muted">${esc(node?.namespace || '(cluster)')}</div><div>${badge(node?.health?.status || 'Unknown')}</div><div>${badge(node?.status || 'Unknown')}</div></div>`).join('');
      shell(`${hero}${summary}${appControls}${tabs}<div class="panel">${resources || '<div class="empty">No resources returned.</div>'}</div>${controlPanel}`, app?.metadata?.name || 'Application');
      return;
    }

    shell(`${hero}${summary}${appControls}${tabs}<section class="topology-panel">${graph.toolbar(nodes)}${graph.content(nodes)}</section>${controlPanel}`, app?.metadata?.name || 'Application');
  }

  async function reloadSelected() {
    const app = state.selected;
    if (!app?.metadata?.name) return;
    try {
      const name = encodeURIComponent(app.metadata.name); const namespace = app.metadata.namespace || ''; const query = namespace ? `?appNamespace=${encodeURIComponent(namespace)}` : '';
      [state.selected, state.tree] = await Promise.all([api(`/api/v1/applications/${name}${query}`), api(`/api/v1/applications/${name}/resource-tree${query}`)]);
      renderApp();
    } catch (err) { error(err, app.metadata.name); }
  }

  async function openApp(appKey) {
    const app = state.apps.find(item => key(item) === appKey);
    if (!app) return;
    state.view = 'application'; state.directView = null; state.appTab = 'topology'; state.selected = app; loading(app?.metadata?.name || 'Application'); await reloadSelected();
  }

  async function navigate(view, force = false) {
    if (view === 'direct' && state.directView) return renderDirect(state.directView.path, state.directView.title);
    state.view = view; state.directView = null;
    try {
      if (view === 'applications') {
        if (force || !state.apps.length) { loading('Applications'); state.apps = items(await api('/api/v1/applications')); }
        renderApps(); return;
      }
      if (view === 'applicationsets') {
        if (force || !state.appSets.length) { loading('ApplicationSets'); state.appSets = items(await api('/api/v1/applicationsets')); }
        renderAppSets(); return;
      }
      if (view === 'settings') return renderDirect('/settings', 'Settings');
      if (view === 'user-info') return renderDirect('/user-info', 'User info');
      if (view === 'help') return renderDirect('/help', 'Help');
      renderApps();
    } catch (err) { error(err, view); }
  }

  async function mount({configuredUrl, theme}) {
    state.baseUrl = configuredUrl || state.baseUrl;
    state.theme = theme === 'dark' ? 'dark' : 'light';
    if (!state.host?.isConnected) {
      const host = document.createElement('div'); host.id = 'argocd-modern-full-ui'; document.documentElement.appendChild(host); state.host = host; state.root = host.attachShadow({mode: 'open'});
    }
    await navigate('applications', true);
  }

  function unmount() {
    state.host?.remove(); state.host = null; state.root = null; state.apps = []; state.appSets = []; state.selected = null; state.tree = null; state.directView = null; controls?.reset?.();
  }

  globalThis.__ARGOCD_FULL_UI__ = {mount, unmount};
})();