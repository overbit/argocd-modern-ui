(() => {
  if (globalThis.__ARGOCD_FULL_UI__) return;

  const state = {host: null, root: null, baseUrl: '', theme: 'light', apps: [], appSets: [], selected: null, tree: null, view: 'applications'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(`${state.baseUrl.replace(/\/+$/, '')}${path}`, {
      credentials: 'include',
      headers: {Accept: 'application/json', ...(options.body ? {'Content-Type': 'application/json'} : {})},
      ...options
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.status === 204 ? null : response.json();
  };
  const items = value => Array.isArray(value) ? value : value?.items || [];
  const health = app => app?.status?.health?.status || 'Unknown';
  const sync = app => app?.status?.sync?.status || 'Unknown';
  const tone = value => ['Healthy','Synced','Succeeded'].includes(value) ? 'ok' : ['Degraded','Missing','Failed','Error'].includes(value) ? 'bad' : ['Progressing','OutOfSync','Suspended'].includes(value) ? 'warn' : 'muted';
  const badge = value => `<span class="badge ${tone(value)}"><i></i>${esc(value || 'Unknown')}</span>`;
  const key = app => `${app?.metadata?.namespace || ''}/${app?.metadata?.name || ''}`;
  const graph = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__?.({state, esc, badge, tone, health, sync, rerender: () => renderApp()});

  const styles = `
    :host{all:initial}*{box-sizing:border-box}.app{--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--soft:#afb8c133;--accent:#0969da;--green:#1f883d;--ok:#1a7f37;--warn:#9a6700;--bad:#cf222e;position:fixed;inset:0;z-index:2147483646;display:grid;grid-template-columns:220px minmax(0,1fr);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text)}
    .app.dark{--bg:#010409;--panel:#0d1117;--text:#f0f6fc;--muted:#8b949e;--border:#30363d;--soft:#6e768133;--accent:#2f81f7;--green:#238636;--ok:#3fb950;--warn:#d29922;--bad:#f85149}.side{background:var(--panel);border-right:1px solid var(--border);padding:16px 12px;display:flex;flex-direction:column;gap:16px}.brand{font-weight:700;padding:0 8px}.brand small{display:block;color:var(--muted);font-weight:400;font-size:11px}.nav{display:grid;gap:3px}.nav button,.plain{border:0;background:transparent;color:inherit;text-align:left;padding:7px 9px;border-radius:6px;cursor:pointer}.nav button:hover,.nav button.active,.plain:hover{background:var(--soft)}.bottom{margin-top:auto;border-top:1px solid var(--border);padding-top:12px;display:grid;gap:6px}.main{overflow:auto}.top{height:56px;display:flex;align-items:center;gap:8px;padding:0 24px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:2}.top strong{font-size:16px}.spacer{flex:1}.content{max-width:1380px;margin:auto;padding:24px}.hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.hero h1{font-size:24px;line-height:1.2;margin:0}.hero p{color:var(--muted);margin:4px 0 0}.button{border:1px solid var(--border);background:var(--panel);color:inherit;border-radius:6px;padding:5px 10px;min-height:32px;font-weight:600;cursor:pointer}.button:hover{background:var(--soft)}.button.primary{background:var(--green);color:#fff;border-color:transparent}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.stat,.panel,.card{border:1px solid var(--border);background:var(--panel);border-radius:6px}.stat{padding:12px 14px}.stat span{color:var(--muted);font-size:12px}.stat b{display:block;font-size:22px}.panel{overflow:hidden}.panel-head{padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--bg)}.panel-head input{margin-left:auto;width:min(340px,45vw);height:30px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text);padding:0 9px}.row{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(130px,.8fr) 115px 115px;gap:12px;align-items:center;padding:9px 13px;min-height:52px;border-bottom:1px solid var(--border);cursor:pointer}.row:last-child{border-bottom:0}.row:hover{background:var(--bg)}.name b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.name small,.muted{color:var(--muted)}.badge{display:inline-flex;gap:6px;align-items:center;font-size:11px;font-weight:600}.badge i{width:8px;height:8px;border-radius:50%;background:currentColor}.badge.ok{color:var(--ok)}.badge.warn{color:var(--warn)}.badge.bad{color:var(--bad)}.badge.muted{color:var(--muted)}.detail{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.55fr);gap:14px}.card{padding:14px}.resource{display:grid;grid-template-columns:minmax(180px,1fr) 130px 110px 110px;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}.resource:last-child{border-bottom:0}.kv{display:grid;grid-template-columns:100px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)}.kv span:first-child{color:var(--muted)}.settings{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.settings .card h3{margin:0 0 8px}.item{padding:7px 0;border-bottom:1px solid var(--border)}.item:last-child{border:0}.empty,.error{padding:32px;text-align:center;color:var(--muted)}.error{color:var(--bad)}
    @media(max-width:900px){.app{grid-template-columns:64px 1fr}.brand span,.nav span,.bottom span{display:none}.stats{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr 100px 100px}.row>*:nth-child(2){display:none}.detail,.settings{grid-template-columns:1fr}}@media(max-width:600px){.content{padding:14px}.top{padding:0 14px}.resource{grid-template-columns:1fr 90px}.resource>*:nth-child(2),.resource>*:nth-child(4){display:none}}
    ${graph?.styles || ''}
  `;

  function shell(body, title = 'Applications') {
    state.root.innerHTML = `<style>${styles}</style><div class="app ${state.theme === 'dark' ? 'dark' : ''}"><aside class="side"><div class="brand">Argo CD <small><span>Full replacement UI</span></small></div><nav class="nav"><button data-view="applications" class="${state.view.startsWith('application') ? 'active' : ''}">◫ <span>Applications</span></button><button data-view="applicationsets" class="${state.view === 'applicationsets' ? 'active' : ''}">▦ <span>ApplicationSets</span></button><button data-view="settings" class="${state.view === 'settings' ? 'active' : ''}">⚙ <span>Settings</span></button></nav><div class="bottom"><button class="button" data-mode="hybrid"><span>Hybrid UI</span>↔</button><button class="button" data-mode="original"><span>Original UI</span>↩</button></div></aside><main class="main"><header class="top"><strong>${esc(title)}</strong><div class="spacer"></div><button class="button" data-refresh>Refresh</button></header><div class="content">${body}</div></main></div>`;
    bind();
  }

  function bind() {
    state.root.querySelectorAll('[data-view]').forEach(node => node.onclick = () => navigate(node.dataset.view, true));
    state.root.querySelectorAll('[data-mode]').forEach(node => node.onclick = () => chrome.storage.local.set({uiMode: node.dataset.mode, enabled: node.dataset.mode !== 'original'}));
    state.root.querySelector('[data-refresh]')?.addEventListener('click', () => navigate(state.view, true));
    state.root.querySelector('[data-back]')?.addEventListener('click', () => navigate('applications'));
    state.root.querySelector('[data-sync]')?.addEventListener('click', syncSelected);
    state.root.querySelectorAll('[data-app]').forEach(node => node.onclick = () => openApp(node.dataset.app));
    graph?.bind();
  }

  function error(message, title) { shell(`<div class="panel error">Full UI could not load this view: ${esc(message)}<br><br><button class="button" data-mode="hybrid">Open Hybrid UI</button></div>`, title); }
  function loading(title) { shell('<div class="panel empty">Loading from Argo CD…</div>', title); }

  function renderApps(filter = '') {
    const query = filter.toLowerCase();
    const visible = query ? state.apps.filter(app => [app?.metadata?.name, app?.metadata?.namespace, app?.spec?.project].some(value => String(value || '').toLowerCase().includes(query))) : state.apps;
    const healthy = state.apps.filter(app => health(app) === 'Healthy').length;
    const problem = state.apps.filter(app => ['Degraded','Missing'].includes(health(app)) || sync(app) === 'OutOfSync').length;
    const progressing = state.apps.filter(app => health(app) === 'Progressing').length;
    const rows = visible.map(app => `<div class="row" data-app="${esc(key(app))}"><div class="name"><b>${esc(app?.metadata?.name)}</b><small>${esc(app?.metadata?.namespace || 'argocd')} · ${esc(app?.spec?.project || 'default')}</small></div><div class="muted">${esc(app?.spec?.destination?.namespace || '—')}</div><div>${badge(health(app))}</div><div>${badge(sync(app))}</div></div>`).join('');
    shell(`<div class="hero"><div><h1>Applications</h1><p>Authenticated Argo CD data in an independent extension shell.</p></div></div><div class="stats"><div class="stat"><span>Total</span><b>${state.apps.length}</b></div><div class="stat"><span>Healthy</span><b>${healthy}</b></div><div class="stat"><span>Needs attention</span><b>${problem}</b></div><div class="stat"><span>Progressing</span><b>${progressing}</b></div></div><div class="panel"><div class="panel-head"><b>${visible.length} applications</b><input id="app-filter" value="${esc(filter)}" placeholder="Filter applications"></div>${rows || '<div class="empty">No applications found.</div>'}</div>`, 'Applications');
    const input = state.root.querySelector('#app-filter');
    input.oninput = event => { const value = event.target.value; renderApps(value); requestAnimationFrame(() => { const next = state.root.querySelector('#app-filter'); next.focus(); next.setSelectionRange(value.length, value.length); }); };
  }

  function renderAppSets() {
    const rows = state.appSets.map(set => `<div class="row"><div class="name"><b>${esc(set?.metadata?.name)}</b><small>${esc(set?.metadata?.namespace || 'argocd')}</small></div><div class="muted">${esc(set?.spec?.template?.spec?.project || 'default')}</div><div>${badge(set?.status?.conditions?.some(c => c.status === 'False') ? 'Degraded' : 'Healthy')}</div><div class="muted">${esc(set?.status?.conditions?.at(-1)?.type || '—')}</div></div>`).join('');
    shell(`<div class="hero"><div><h1>ApplicationSets</h1><p>Generator-backed definitions.</p></div></div><div class="panel">${rows || '<div class="empty">No ApplicationSets found.</div>'}</div>`, 'ApplicationSets');
  }

  function renderApp() {
    const app = state.selected;
    const nodes = graph?.resourceNodes().sort((a, b) => Number(graph.needsAttention(b)) - Number(graph.needsAttention(a)) || String(a.kind || '').localeCompare(String(b.kind || ''))) || [...(state.tree?.nodes || []), ...(state.tree?.orphanedNodes || [])];
    const repo = app?.spec?.source?.repoURL || app?.spec?.sources?.[0]?.repoURL || '—';
    if (!graph) {
      const resources = nodes.slice(0, 250).map(node => `<div class="resource"><div class="name"><b>${esc(node?.name)}</b><small>${esc(node?.kind || 'Resource')}</small></div><div class="muted">${esc(node?.namespace || '(cluster)')}</div><div>${badge(node?.health?.status || 'Unknown')}</div><div>${badge(node?.status || 'Unknown')}</div></div>`).join('');
      shell(`<div class="hero"><div><button class="button" data-back>← Back</button><h1 style="margin-top:12px">${esc(app?.metadata?.name)}</h1><p>${esc(app?.metadata?.namespace || 'argocd')} · ${esc(app?.spec?.project || 'default')}</p></div><div><button class="button primary" data-sync>Sync</button> <button class="button" data-mode="hybrid">Open Hybrid</button></div></div><div class="detail"><div class="card"><h3>Resources · ${nodes.length}</h3>${resources || '<div class="empty">No resources returned.</div>'}</div><aside class="card"><h3>Application status</h3><div class="kv"><span>Health</span>${badge(health(app))}</div><div class="kv"><span>Sync</span>${badge(sync(app))}</div><div class="kv"><span>Destination</span><b>${esc(app?.spec?.destination?.namespace || '—')}</b></div><div class="kv"><span>Repository</span><b>${esc(repo)}</b></div></aside></div>`, app?.metadata?.name || 'Application');
      return;
    }
    shell(`<div class="hero"><div><button class="button" data-back>← Back</button><h1 style="margin-top:12px">${esc(app?.metadata?.name)}</h1><p>${esc(app?.metadata?.namespace || 'argocd')} · ${esc(app?.spec?.project || 'default')}</p></div><div><button class="button primary" data-sync>Sync</button> <button class="button" data-mode="hybrid">Open Hybrid</button></div></div><div class="app-summary"><div class="summary-chip"><span>Health</span>${badge(health(app))}</div><div class="summary-chip"><span>Sync</span>${badge(sync(app))}</div><div class="summary-chip"><span>Destination</span><b>${esc(app?.spec?.destination?.namespace || '—')}</b></div><div class="summary-chip"><span>Repository</span><b title="${esc(repo)}">${esc(repo)}</b></div></div><section class="topology-panel">${graph.toolbar(nodes)}${graph.content(nodes)}</section>`, app?.metadata?.name || 'Application');
  }

  async function renderSettings() {
    const [projects, clusters, repositories] = await Promise.all([api('/api/v1/projects'), api('/api/v1/clusters'), api('/api/v1/repositories')]);
    const card = (title, values, label, meta) => `<div class="card"><h3>${title} · ${values.length}</h3>${values.map(value => `<div class="item"><b>${esc(label(value) || '—')}</b><div class="muted">${esc(meta(value) || '')}</div></div>`).join('') || '<div class="empty">None found.</div>'}</div>`;
    shell(`<div class="hero"><div><h1>Settings overview</h1><p>Read-only in Full mode. Mutations remain in Hybrid UI so Argo CD's native RBAC-aware dialogs stay authoritative.</p></div><button class="button" data-mode="hybrid">Open Hybrid settings</button></div><div class="settings">${card('Projects', items(projects), x => x?.metadata?.name, x => `${x?.spec?.destinations?.length || 0} destinations`)}${card('Clusters', items(clusters), x => x?.name || x?.server, x => x?.server)}${card('Repositories', items(repositories), x => x?.name || x?.repo, x => x?.type || 'git')}</div>`, 'Settings');
  }

  async function navigate(view, force = false) {
    state.view = view;
    loading(view === 'applicationsets' ? 'ApplicationSets' : view === 'settings' ? 'Settings' : 'Applications');
    try {
      if (view === 'applications') { if (!state.apps.length || force) state.apps = items(await api('/api/v1/applications')); renderApps(); }
      else if (view === 'applicationsets') { if (!state.appSets.length || force) state.appSets = items(await api('/api/v1/applicationsets')); renderAppSets(); }
      else if (view === 'settings') await renderSettings();
      else if (view === 'application' && state.selected) await openApp(key(state.selected));
    } catch (err) { error(err.message || String(err), view); }
  }

  async function openApp(appKey) {
    const base = state.apps.find(app => key(app) === appKey) || state.selected;
    if (!base) return;
    state.view = 'application'; loading(base.metadata?.name || 'Application');
    const name = encodeURIComponent(base.metadata?.name || '');
    const namespace = base.metadata?.namespace || '';
    const query = namespace ? `?appNamespace=${encodeURIComponent(namespace)}` : '';
    try { [state.selected, state.tree] = await Promise.all([api(`/api/v1/applications/${name}${query}`), api(`/api/v1/applications/${name}/resource-tree${query}`)]); graph?.reset(); renderApp(); }
    catch (err) { error(err.message || String(err), base.metadata?.name || 'Application'); }
  }

  async function syncSelected() {
    if (!state.selected || !confirm(`Sync application “${state.selected.metadata?.name}” using Argo CD?`)) return;
    const name = encodeURIComponent(state.selected.metadata?.name || '');
    try { await api(`/api/v1/applications/${name}/sync`, {method:'POST', body:JSON.stringify({appNamespace: state.selected.metadata?.namespace || ''})}); await openApp(key(state.selected)); }
    catch (err) { error(`Sync failed: ${err.message || err}`, state.selected.metadata?.name || 'Application'); }
  }

  async function mount({configuredUrl, theme}) {
    state.baseUrl = configuredUrl; state.theme = theme;
    if (!state.host?.isConnected) { state.host = document.createElement('div'); state.host.id = 'argocd-modern-full-ui'; document.body.appendChild(state.host); state.root = state.host.attachShadow({mode:'open'}); await navigate('applications', true); }
    else state.root.querySelector('.app')?.classList.toggle('dark', theme === 'dark');
  }
  function unmount() { state.host?.remove(); state.host = null; state.root = null; }
  globalThis.__ARGOCD_FULL_UI__ = {mount, unmount};
})();
