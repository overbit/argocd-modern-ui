(() => {
  if (globalThis.__ARGOCD_FULL_DIRECT_FACTORY__) return;

  const normalizeJson = value => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || !((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) return value;
      try { return normalizeJson(JSON.parse(trimmed)); } catch { return value; }
    }
    if (Array.isArray(value)) return value.map(normalizeJson);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJson(item)]));
    return value;
  };

  globalThis.__ARGOCD_FULL_DIRECT_FACTORY__ = ({state, esc}) => {
    const controllers = new WeakMap();
    const cleanPath = path => `/${String(path || '').replace(/^\/+/, '')}`;
    const base = () => String(state.baseUrl || '').replace(/\/+$/, '');
    const urlFor = path => `${base()}${cleanPath(path)}`;
    const pretty = value => {
      const normalized = normalizeJson(value);
      return typeof normalized === 'string' ? normalized : JSON.stringify(normalized, null, 2);
    };
    const qs = values => {
      const search = new URLSearchParams();
      Object.entries(values || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
      });
      return search.toString();
    };
    const request = async (path, options = {}) => {
      const response = await fetch(`${base()}${path}`, {
        credentials: 'include',
        headers: {Accept: 'application/json', ...(options.body ? {'Content-Type': 'application/json'} : {})},
        ...options
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch {}
        throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
      }
      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      try { return normalizeJson(JSON.parse(text)); } catch { return text; }
    };
    const requestText = async (path, options = {}) => {
      const response = await fetch(`${base()}${path}`, {credentials: 'include', ...options});
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.text();
    };
    const items = value => Array.isArray(value) ? value : value?.items || [];
    const routeUrl = path => new URL(cleanPath(path), 'https://argocd-modern.invalid');
    const decodedSegments = path => routeUrl(path).pathname.split('/').filter(Boolean).map(segment => {
      try { return decodeURIComponent(segment); } catch { return segment; }
    });
    const appIdentity = path => {
      const segments = decodedSegments(path);
      if (segments[0] !== 'applications' || segments.length < 2) return null;
      return segments.length >= 3 ? {namespace: segments[1], name: segments[2]} : {namespace: '', name: segments[1]};
    };
    const appSetIdentity = path => {
      const segments = decodedSegments(path);
      if (segments[0] !== 'applicationsets' || segments.length < 2) return null;
      return segments.length >= 3 ? {namespace: segments[1], name: segments[2]} : {namespace: '', name: segments[1]};
    };
    const nodeIdentity = path => {
      const value = routeUrl(path).searchParams.get('node');
      if (!value) return null;
      const parts = value.split('/');
      return {group: parts[0] || '', kind: parts[1] || '', namespace: parts[2] || '', name: parts[3] || '', containerIndex: Number(parts[4] || 0)};
    };

    const surfaceHead = (title, description, actions = '') => `<div class="direct-head"><div><h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div><div class="direct-head-actions">${actions}</div></div>`;
    const loading = surface => { surface.innerHTML = '<div class="direct-loading">Loading from Argo CD…</div>'; };
    const failure = (surface, error) => { surface.innerHTML = `<div class="direct-error"><b>Unable to load this Full UI control</b><span>${esc(error?.message || error)}</span><button class="button" data-direct-retry>Retry</button></div>`; surface.querySelector('[data-direct-retry]')?.addEventListener('click', () => void renderSurface(surface)); };
    const jsonEditorMarkup = ({title, description, value, saveLabel = 'Save', deleteLabel = '', extra = ''}) => `${surfaceHead(title, description)}<div class="direct-editor"><textarea class="direct-json-editor" spellcheck="false">${esc(pretty(value))}</textarea><div class="direct-editor-actions">${extra}<button class="button" data-direct-back>Back</button>${deleteLabel ? `<button class="button danger" data-direct-delete>${esc(deleteLabel)}</button>` : ''}<button class="button primary" data-direct-save>${esc(saveLabel)}</button></div><div class="direct-inline-error" data-direct-inline-error hidden></div></div>`;
    const parseEditor = surface => {
      try { return normalizeJson(JSON.parse(surface.querySelector('.direct-json-editor')?.value || '{}')); }
      catch (error) {
        const box = surface.querySelector('[data-direct-inline-error]');
        if (box) { box.hidden = false; box.textContent = `Invalid JSON: ${error.message}`; }
        return null;
      }
    };
    const showInlineError = (surface, error) => {
      const box = surface.querySelector('[data-direct-inline-error]');
      if (box) { box.hidden = false; box.textContent = String(error?.message || error); }
    };
    const bindBack = (surface, path) => surface.querySelector('[data-direct-back]')?.addEventListener('click', () => { surface.dataset.directPath = path; void renderSurface(surface); });
    const bindRoutes = surface => surface.querySelectorAll('[data-direct-route]').forEach(button => button.addEventListener('click', () => {
      surface.dataset.directPath = button.dataset.directRoute;
      void renderSurface(surface);
    }));

    async function renderApplications(surface, url) {
      if (url.searchParams.get('create') === '1') return renderApplicationEditor(surface, null, true);
      loading(surface);
      const apps = items(await request('/api/v1/applications'));
      const rows = apps.map(app => {
        const namespace = app?.metadata?.namespace || '';
        const name = app?.metadata?.name || '';
        const route = namespace ? `/applications/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}` : `/applications/${encodeURIComponent(name)}`;
        return `<button class="direct-row" data-direct-route="${esc(route)}"><span><b>${esc(name)}</b><small>${esc(namespace || 'argocd')} · ${esc(app?.spec?.project || 'default')}</small></span><span>${esc(app?.status?.health?.status || 'Unknown')}</span><span>${esc(app?.status?.sync?.status || 'Unknown')}</span><span>›</span></button>`;
      }).join('');
      surface.innerHTML = `${surfaceHead('Applications', 'Direct application create, edit and lifecycle controls.', '<button class="button primary" data-direct-route="/applications?create=1">New application</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No applications returned.</div>'}</div>`;
      bindRoutes(surface);
    }

    async function renderApplicationEditor(surface, identity, creating = false) {
      loading(surface);
      let app;
      if (creating) {
        app = {apiVersion: 'argoproj.io/v1alpha1', kind: 'Application', metadata: {name: '', namespace: 'argocd'}, spec: {project: 'default', source: {repoURL: '', targetRevision: 'HEAD', path: ''}, destination: {server: 'https://kubernetes.default.svc', namespace: ''}, syncPolicy: {}}};
      } else {
        const query = identity.namespace ? `?appNamespace=${encodeURIComponent(identity.namespace)}` : '';
        app = await request(`/api/v1/applications/${encodeURIComponent(identity.name)}${query}`);
      }
      const name = app?.metadata?.name || identity?.name || 'Application';
      surface.innerHTML = jsonEditorMarkup({title: creating ? 'New application' : `Edit ${name}`, description: 'The complete Application object is editable here; Argo CD remains the validation and RBAC authority.', value: app, saveLabel: creating ? 'Create application' : 'Save application', deleteLabel: creating ? '' : 'Delete application', extra: creating ? '' : '<select class="direct-select" data-app-delete-policy aria-label="Delete propagation"><option value="foreground">Foreground delete</option><option value="background">Background delete</option><option value="non-cascading">Non-cascading</option></select>'});
      bindBack(surface, '/applications');
      surface.querySelector('[data-direct-save]')?.addEventListener('click', async () => {
        const value = parseEditor(surface); if (!value) return;
        try {
          if (creating) await request('/api/v1/applications', {method: 'POST', body: JSON.stringify(value)});
          else await request(`/api/v1/applications/${encodeURIComponent(identity.name)}?validate=true`, {method: 'PUT', body: JSON.stringify(value)});
          if (!creating && state.selected?.metadata?.name === identity.name) state.selected = value;
          surface.dataset.directPath = '/applications';
          await renderSurface(surface);
        } catch (error) { showInlineError(surface, error); }
      });
      surface.querySelector('[data-direct-delete]')?.addEventListener('click', async () => {
        const policy = surface.querySelector('[data-app-delete-policy]')?.value || 'foreground';
        if (!confirm(`Delete application “${name}” using ${policy} propagation?`)) return;
        try {
          const cascade = policy !== 'non-cascading';
          const propagationPolicy = cascade ? policy : '';
          const query = qs({cascade, propagationPolicy, appNamespace: identity.namespace || ''});
          await request(`/api/v1/applications/${encodeURIComponent(identity.name)}?${query}`, {method: 'DELETE'});
          if (state.selected?.metadata?.name === identity.name) { state.selected = null; state.tree = null; }
          surface.dataset.directPath = '/applications';
          await renderSurface(surface);
        } catch (error) { showInlineError(surface, error); }
      });
    }

    async function renderApplicationSets(surface, url) {
      if (url.searchParams.get('create') === '1') return renderApplicationSetEditor(surface, null, true);
      loading(surface);
      const sets = items(await request('/api/v1/applicationsets'));
      const rows = sets.map(set => {
        const namespace = set?.metadata?.namespace || '';
        const name = set?.metadata?.name || '';
        const route = namespace ? `/applicationsets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}` : `/applicationsets/${encodeURIComponent(name)}`;
        return `<button class="direct-row" data-direct-route="${esc(route)}"><span><b>${esc(name)}</b><small>${esc(namespace || 'argocd')}</small></span><span>${esc(set?.spec?.template?.spec?.project || 'default')}</span><span>${esc(set?.status?.conditions?.at(-1)?.type || '—')}</span><span>›</span></button>`;
      }).join('');
      surface.innerHTML = `${surfaceHead('ApplicationSets', 'Direct generator/template create and edit controls.', '<button class="button primary" data-direct-route="/applicationsets?create=1">New ApplicationSet</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No ApplicationSets returned.</div>'}</div>`;
      bindRoutes(surface);
    }

    async function renderApplicationSetEditor(surface, identity, creating = false) {
      loading(surface);
      const appSet = creating ? {apiVersion: 'argoproj.io/v1alpha1', kind: 'ApplicationSet', metadata: {name: '', namespace: 'argocd'}, spec: {generators: [], template: {metadata: {name: ''}, spec: {project: 'default', source: {repoURL: '', targetRevision: 'HEAD', path: ''}, destination: {server: 'https://kubernetes.default.svc', namespace: ''}}}}} : await request(`/api/v1/applicationsets/${encodeURIComponent(identity.name)}?${qs({appsetNamespace: identity.namespace || ''})}`);
      const name = appSet?.metadata?.name || identity?.name || 'ApplicationSet';
      surface.innerHTML = jsonEditorMarkup({title: creating ? 'New ApplicationSet' : `Edit ${name}`, description: 'All generators, templates, goTemplate options and sync policy fields are editable directly.', value: appSet, saveLabel: creating ? 'Create ApplicationSet' : 'Save ApplicationSet', deleteLabel: creating ? '' : 'Delete ApplicationSet'});
      bindBack(surface, '/applicationsets');
      surface.querySelector('[data-direct-save]')?.addEventListener('click', async () => {
        const value = parseEditor(surface); if (!value) return;
        try {
          if (creating) await request('/api/v1/applicationsets', {method: 'POST', body: JSON.stringify(value)});
          else await request(`/api/v1/applicationsets/${encodeURIComponent(identity.name)}?${qs({appsetNamespace: identity.namespace || ''})}`, {method: 'PUT', body: JSON.stringify(value)});
          surface.dataset.directPath = '/applicationsets'; await renderSurface(surface);
        } catch (error) { showInlineError(surface, error); }
      });
      surface.querySelector('[data-direct-delete]')?.addEventListener('click', async () => {
        if (!confirm(`Delete ApplicationSet “${name}”?`)) return;
        try { await request(`/api/v1/applicationsets/${encodeURIComponent(identity.name)}?${qs({appsetNamespace: identity.namespace || ''})}`, {method: 'DELETE'}); surface.dataset.directPath = '/applicationsets'; await renderSurface(surface); }
        catch (error) { showInlineError(surface, error); }
      });
    }

    function settingsOverview(surface) {
      const cards = [
        ['/settings/repos','Repositories','Read/write Git and Helm repositories, credentials and connection settings'],
        ['/settings/write-repos','Write repositories','Write-back repository connections'],
        ['/settings/certs','Certificates','TLS and SSH known-host certificates'],
        ['/settings/gpgkeys','GPG keys','Commit signature verification keys'],
        ['/settings/clusters','Clusters','Connected Kubernetes clusters and cache controls'],
        ['/settings/projects','Projects','Destinations, sources, roles, policies and sync windows'],
        ['/settings/accounts','Accounts','Tokens and password controls'],
        ['/settings/appearance','Appearance','Full and Hybrid theme selection']
      ].map(([path, title, text]) => `<button class="direct-card" data-direct-route="${path}"><b>${title}</b><span>${text}</span><i>›</i></button>`).join('');
      surface.innerHTML = `${surfaceHead('Settings', 'Every standard Argo CD settings area is managed by the Full replacement UI.')}<div class="direct-card-grid">${cards}</div>`;
      bindRoutes(surface);
    }

    async function renderProjects(surface, url) {
      if (url.searchParams.get('create') === '1') return projectEditor(surface, null, true);
      const edit = url.searchParams.get('edit'); if (edit) return projectEditor(surface, edit, false);
      loading(surface);
      const projects = items(await request('/api/v1/projects'));
      const rows = projects.map(project => `<button class="direct-row" data-direct-route="/settings/projects?edit=${encodeURIComponent(project?.metadata?.name || '')}"><span><b>${esc(project?.metadata?.name || '')}</b><small>${esc(project?.spec?.description || '')}</small></span><span>${(project?.spec?.sourceRepos || []).length} sources</span><span>${(project?.spec?.destinations || []).length} destinations</span><span>›</span></button>`).join('');
      surface.innerHTML = `${surfaceHead('Projects', 'Project policy, destination, source, role and sync-window controls.', '<button class="button" data-direct-route="/settings">Settings</button><button class="button primary" data-direct-route="/settings/projects?create=1">New project</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No projects returned.</div>'}</div>`;
      bindRoutes(surface);
    }

    async function projectEditor(surface, name, creating) {
      loading(surface);
      const project = creating ? {apiVersion: 'argoproj.io/v1alpha1', kind: 'AppProject', metadata: {name: '', namespace: 'argocd'}, spec: {description: '', sourceRepos: ['*'], destinations: [{namespace: '*', server: '*'}], clusterResourceWhitelist: [{group: '*', kind: '*'}], roles: [], syncWindows: []}} : await request(`/api/v1/projects/${encodeURIComponent(name)}`);
      surface.innerHTML = jsonEditorMarkup({title: creating ? 'New project' : `Edit ${name}`, description: 'The entire AppProject definition is editable, including roles, Casbin policies, JWT metadata and sync windows.', value: project, saveLabel: creating ? 'Create project' : 'Save project', deleteLabel: creating ? '' : 'Delete project'});
      bindBack(surface, '/settings/projects');
      surface.querySelector('[data-direct-save]')?.addEventListener('click', async () => {
        const value = parseEditor(surface); if (!value) return;
        try { await request(creating ? '/api/v1/projects' : `/api/v1/projects/${encodeURIComponent(name)}`, {method: creating ? 'POST' : 'PUT', body: JSON.stringify({project: value})}); surface.dataset.directPath = '/settings/projects'; await renderSurface(surface); }
        catch (error) { showInlineError(surface, error); }
      });
      surface.querySelector('[data-direct-delete]')?.addEventListener('click', async () => {
        if (!confirm(`Delete project “${name}”?`)) return;
        try { await request(`/api/v1/projects/${encodeURIComponent(name)}`, {method: 'DELETE'}); surface.dataset.directPath = '/settings/projects'; await renderSurface(surface); }
        catch (error) { showInlineError(surface, error); }
      });
    }

    async function renderRepositories(surface, url, write = false) {
      const rootPath = write ? '/api/v1/write-repositories' : '/api/v1/repositories';
      const backPath = write ? '/settings/write-repos' : '/settings/repos';
      if (url.searchParams.get('create') === '1') return repositoryEditor(surface, null, true, write);
      const edit = url.searchParams.get('edit'); if (edit) return repositoryEditor(surface, decodeURIComponent(edit), false, write);
      loading(surface);
      const repositories = items(await request(rootPath));
      const rows = repositories.map(repo => `<button class="direct-row" data-direct-route="${backPath}?edit=${encodeURIComponent(repo?.repo || '')}"><span><b>${esc(repo?.name || repo?.repo || '')}</b><small>${esc(repo?.repo || '')}</small></span><span>${esc(repo?.type || 'git')}</span><span>${esc(repo?.connectionState?.status || 'Unknown')}</span><span>›</span></button>`).join('');
      surface.innerHTML = `${surfaceHead(write ? 'Write repositories' : 'Repositories', 'Direct repository connection and credential controls.', '<button class="button" data-direct-route="/settings">Settings</button><button class="button primary" data-direct-route="'+backPath+'?create=1">Connect repository</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No repositories returned.</div>'}</div>`;
      bindRoutes(surface);
    }

    async function repositoryEditor(surface, repoUrl, creating, write) {
      const rootPath = write ? '/api/v1/write-repositories' : '/api/v1/repositories';
      const backPath = write ? '/settings/write-repos' : '/settings/repos';
      loading(surface);
      const repo = creating ? {type: 'git', name: '', repo: '', project: '', username: '', password: '', bearerToken: '', sshPrivateKey: '', githubAppPrivateKey: '', githubAppId: 0, githubAppInstallationId: 0, githubAppEnterpriseBaseURL: '', gcpServiceAccountKey: '', azureServicePrincipalClientId: '', azureServicePrincipalClientSecret: '', azureServicePrincipalTenantId: '', azureActiveDirectoryEndpoint: '', tlsClientCertData: '', tlsClientCertKey: '', insecure: false, enableLfs: false, enableOCI: false, forceHttpBasicAuth: false, useAzureWorkloadIdentity: false, insecureOCIForceHttp: false, proxy: '', noProxy: '', depth: 0} : items(await request(rootPath)).find(item => item?.repo === repoUrl) || {repo: repoUrl};
      surface.innerHTML = jsonEditorMarkup({title: creating ? 'Connect repository' : `Edit ${repoUrl}`, description: 'HTTPS, SSH, GitHub App, GCP, Azure, OCI, proxy, TLS and shallow-clone fields are supported directly. Secret fields omitted by Argo CD stay omitted unless you add them.', value: repo, saveLabel: creating ? 'Connect repository' : 'Save repository', deleteLabel: creating ? '' : 'Delete repository'});
      bindBack(surface, backPath);
      surface.querySelector('[data-direct-save]')?.addEventListener('click', async () => {
        const value = parseEditor(surface); if (!value) return;
        try { const path = creating ? rootPath : `${rootPath}/${encodeURIComponent(repoUrl)}`; await request(path, {method: creating ? 'POST' : 'PUT', body: JSON.stringify(value)}); surface.dataset.directPath = backPath; await renderSurface(surface); }
        catch (error) { showInlineError(surface, error); }
      });
      surface.querySelector('[data-direct-delete]')?.addEventListener('click', async () => {
        if (!confirm(`Delete repository “${repoUrl}”?`)) return;
        try { await request(`${rootPath}/${encodeURIComponent(repoUrl)}?${qs({appProject: repo?.project || ''})}`, {method: 'DELETE'}); surface.dataset.directPath = backPath; await renderSurface(surface); }
        catch (error) { showInlineError(surface, error); }
      });
    }

    async function renderClusters(surface, url) {
      const edit = url.searchParams.get('edit'); if (edit) return clusterEditor(surface, decodeURIComponent(edit));
      loading(surface);
      const clusters = items(await request('/api/v1/clusters'));
      const rows = clusters.map(cluster => `<button class="direct-row" data-direct-route="/settings/clusters?edit=${encodeURIComponent(cluster?.server || '')}"><span><b>${esc(cluster?.name || cluster?.server || '')}</b><small>${esc(cluster?.server || '')}</small></span><span>${esc(cluster?.connectionState?.status || 'Unknown')}</span><span>${esc(cluster?.serverVersion || '—')}</span><span>›</span></button>`).join('');
      surface.innerHTML = `${surfaceHead('Clusters', 'Direct cluster inspection, cache invalidation, update and delete controls.', '<button class="button" data-direct-route="/settings">Settings</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No clusters returned.</div>'}</div>`;
      bindRoutes(surface);
    }

    async function clusterEditor(surface, server) {
      loading(surface);
      const cluster = await request(`/api/v1/clusters/${encodeURIComponent(server)}?id.type=url`);
      surface.innerHTML = jsonEditorMarkup({title: cluster?.name || server, description: 'Cluster metadata and connection configuration. Argo CD validates updates and enforces cluster RBAC.', value: cluster, saveLabel: 'Save cluster', deleteLabel: 'Delete cluster', extra: '<button class="button" data-cluster-invalidate>Invalidate cache</button>'});
      bindBack(surface, '/settings/clusters');
      surface.querySelector('[data-direct-save]')?.addEventListener('click', async () => { const value = parseEditor(surface); if (!value) return; try { await request(`/api/v1/clusters/${encodeURIComponent(server)}`, {method: 'PUT', body: JSON.stringify(value)}); surface.dataset.directPath = '/settings/clusters'; await renderSurface(surface); } catch (error) { showInlineError(surface, error); } });
      surface.querySelector('[data-cluster-invalidate]')?.addEventListener('click', async () => { try { await request(`/api/v1/clusters/${encodeURIComponent(server)}/invalidate-cache`, {method: 'POST', body: '{}'}); } catch (error) { showInlineError(surface, error); } });
      surface.querySelector('[data-direct-delete]')?.addEventListener('click', async () => { if (!confirm(`Delete cluster “${cluster?.name || server}”?`)) return; try { await request(`/api/v1/clusters/${encodeURIComponent(server)}`, {method: 'DELETE'}); surface.dataset.directPath = '/settings/clusters'; await renderSurface(surface); } catch (error) { showInlineError(surface, error); } });
    }

    async function renderCertificates(surface, url) {
      if (url.searchParams.get('create') === '1') {
        const template = {items: [{serverName: '', certType: 'https', certSubType: '', certData: ''}]};
        surface.innerHTML = jsonEditorMarkup({title: 'Add certificate', description: 'Add one or more TLS/SSH certificates or known-host entries.', value: template, saveLabel: 'Add certificates'});
        bindBack(surface, '/settings/certs');
        surface.querySelector('[data-direct-save]')?.addEventListener('click', async () => { const value = parseEditor(surface); if (!value) return; try { await request('/api/v1/certificates', {method: 'POST', body: JSON.stringify(value)}); surface.dataset.directPath = '/settings/certs'; await renderSurface(surface); } catch (error) { showInlineError(surface, error); } });
        return;
      }
      loading(surface);
      const certificates = items(await request('/api/v1/certificates'));
      const rows = certificates.map((cert, index) => `<div class="direct-row static"><span><b>${esc(cert?.serverName || cert?.hostNamePattern || '')}</b><small>${esc(cert?.certType || '')} ${esc(cert?.certSubType || '')}</small></span><span>${esc(cert?.certInfo || cert?.certData?.slice?.(0, 30) || '')}</span><span></span><button class="button danger" data-cert-delete="${index}">Delete</button></div>`).join('');
      surface.innerHTML = `${surfaceHead('Certificates', 'TLS and SSH certificate controls.', '<button class="button" data-direct-route="/settings">Settings</button><button class="button primary" data-direct-route="/settings/certs?create=1">Add certificate</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No certificates returned.</div>'}</div>`;
      bindRoutes(surface);
      surface.querySelectorAll('[data-cert-delete]').forEach(button => button.addEventListener('click', async () => {
        const cert = certificates[Number(button.dataset.certDelete)]; if (!cert) return;
        if (!confirm(`Delete certificate for “${cert.serverName || cert.hostNamePattern}”?`)) return;
        try { await request(`/api/v1/certificates?${qs({hostNamePattern: cert.serverName || cert.hostNamePattern || '', certType: cert.certType || '', certSubType: cert.certSubType || ''})}`, {method: 'DELETE'}); await renderSurface(surface); }
        catch (error) { alert(`Certificate deletion failed: ${error.message}`); }
      }));
    }

    async function renderGpgKeys(surface, url) {
      if (url.searchParams.get('create') === '1') {
        surface.innerHTML = `${surfaceHead('Add GPG public key', 'Paste an ASCII-armored public key.')}<div class="direct-editor"><textarea class="direct-json-editor direct-key-input" spellcheck="false" placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"></textarea><div class="direct-editor-actions"><button class="button" data-direct-back>Back</button><button class="button primary" data-gpg-save>Add key</button></div><div class="direct-inline-error" data-direct-inline-error hidden></div></div>`;
        bindBack(surface, '/settings/gpgkeys');
        surface.querySelector('[data-gpg-save]')?.addEventListener('click', async () => { const keyData = surface.querySelector('.direct-key-input')?.value?.trim(); if (!keyData) return showInlineError(surface, new Error('A public key is required.')); try { await request('/api/v1/gpgkeys', {method: 'POST', body: JSON.stringify({keyData})}); surface.dataset.directPath = '/settings/gpgkeys'; await renderSurface(surface); } catch (error) { showInlineError(surface, error); } });
        return;
      }
      loading(surface);
      const keys = items(await request('/api/v1/gpgkeys'));
      const rows = keys.map((key, index) => `<div class="direct-row static"><span><b>${esc(key?.keyID || '')}</b><small>${esc(key?.fingerprint || '')}</small></span><span>${esc(key?.owner || key?.subType || '')}</span><span></span><button class="button danger" data-gpg-delete="${index}">Delete</button></div>`).join('');
      surface.innerHTML = `${surfaceHead('GPG keys', 'Commit signature verification keys.', '<button class="button" data-direct-route="/settings">Settings</button><button class="button primary" data-direct-route="/settings/gpgkeys?create=1">Add key</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No GPG keys returned.</div>'}</div>`;
      bindRoutes(surface);
      surface.querySelectorAll('[data-gpg-delete]').forEach(button => button.addEventListener('click', async () => { const key = keys[Number(button.dataset.gpgDelete)]; if (!key || !confirm(`Delete GPG key “${key.keyID}”?`)) return; try { await request(`/api/v1/gpgkeys?${qs({keyID: key.keyID})}`, {method: 'DELETE'}); await renderSurface(surface); } catch (error) { alert(`GPG key deletion failed: ${error.message}`); } }));
    }

    async function renderAccounts(surface, url) {
      const edit = url.searchParams.get('edit'); if (edit) return accountEditor(surface, edit);
      loading(surface);
      const accounts = items(await request('/api/v1/account'));
      const rows = accounts.map(account => `<button class="direct-row" data-direct-route="/settings/accounts?edit=${encodeURIComponent(account?.name || '')}"><span><b>${esc(account?.name || '')}</b><small>${esc((account?.capabilities || []).join(', '))}</small></span><span>${account?.enabled === false ? 'Disabled' : 'Enabled'}</span><span>${(account?.tokens || []).length} tokens</span><span>›</span></button>`).join('');
      surface.innerHTML = `${surfaceHead('Accounts', 'Account token and password controls.', '<button class="button" data-direct-route="/settings">Settings</button>')}<div class="direct-list">${rows || '<div class="direct-empty">No accounts returned.</div>'}</div>`;
      bindRoutes(surface);
    }

    async function accountEditor(surface, name) {
      loading(surface);
      const [account, user] = await Promise.all([request(`/api/v1/account/${encodeURIComponent(name)}`), request('/api/v1/session/userinfo').catch(() => null)]);
      const tokens = account?.tokens || [];
      const tokenRows = tokens.map(token => `<div class="direct-row static"><span><b>${esc(token?.id || 'token')}</b><small>${esc(token?.issuedAt ? new Date(Number(token.issuedAt) * 1000).toISOString() : '')}</small></span><span>${esc(token?.expiresAt ? new Date(Number(token.expiresAt) * 1000).toISOString() : 'No expiry')}</span><span></span><button class="button danger" data-token-delete="${esc(token?.id || '')}">Delete</button></div>`).join('');
      const password = user?.username === name ? `<section class="direct-section"><h3>Change password</h3><div class="direct-fields"><input type="password" data-current-password placeholder="Current password"><input type="password" data-new-password placeholder="New password"><button class="button" data-change-password>Change password</button></div></section>` : '';
      surface.innerHTML = `${surfaceHead(name, 'Account capabilities, token lifecycle and password controls.', '<button class="button" data-direct-back>Back</button>')}<section class="direct-section"><h3>Create token</h3><div class="direct-fields"><input data-token-id placeholder="Token id"><input type="number" min="0" data-token-expiry placeholder="Expires in seconds (0 = never)"><button class="button primary" data-token-create>Create token</button></div><div class="direct-secret" data-token-secret hidden></div></section><section class="direct-section"><h3>Tokens</h3><div class="direct-list">${tokenRows || '<div class="direct-empty">No tokens.</div>'}</div></section>${password}<pre class="direct-code">${esc(pretty(account))}</pre><div class="direct-inline-error" data-direct-inline-error hidden></div>`;
      bindBack(surface, '/settings/accounts');
      surface.querySelector('[data-token-create]')?.addEventListener('click', async () => { const id = surface.querySelector('[data-token-id]')?.value?.trim() || ''; const expiresIn = Number(surface.querySelector('[data-token-expiry]')?.value || 0); try { const result = await request(`/api/v1/account/${encodeURIComponent(name)}/token`, {method: 'POST', body: JSON.stringify({id, expiresIn})}); const secret = surface.querySelector('[data-token-secret]'); if (secret) { secret.hidden = false; secret.textContent = `Token (copy now): ${result?.token || result}`; } } catch (error) { showInlineError(surface, error); } });
      surface.querySelectorAll('[data-token-delete]').forEach(button => button.addEventListener('click', async () => { if (!confirm(`Delete token “${button.dataset.tokenDelete}”?`)) return; try { await request(`/api/v1/account/${encodeURIComponent(name)}/token/${encodeURIComponent(button.dataset.tokenDelete)}`, {method: 'DELETE'}); await accountEditor(surface, name); } catch (error) { showInlineError(surface, error); } }));
      surface.querySelector('[data-change-password]')?.addEventListener('click', async () => { const currentPassword = surface.querySelector('[data-current-password]')?.value || ''; const newPassword = surface.querySelector('[data-new-password]')?.value || ''; try { await request('/api/v1/account/password', {method: 'PUT', body: JSON.stringify({currentPassword, name, newPassword})}); alert('Password updated.'); } catch (error) { showInlineError(surface, error); } });
    }

    function renderAppearance(surface) {
      surface.innerHTML = `${surfaceHead('Appearance', 'Theme selection is owned by the extension so Hybrid and Full remain consistent.', '<button class="button" data-direct-route="/settings">Settings</button>')}<div class="direct-theme-picker"><button class="button" data-theme-value="system">System</button><button class="button" data-theme-value="light">Light</button><button class="button" data-theme-value="dark">Dark</button></div>`;
      bindRoutes(surface);
      surface.querySelectorAll('[data-theme-value]').forEach(button => button.addEventListener('click', async () => {
        const theme = button.dataset.themeValue;
        try { await chrome.storage.local.set({theme}); } catch {}
        if (theme !== 'system') state.theme = theme;
        else state.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        state.root?.querySelector('.app')?.classList.toggle('dark', state.theme === 'dark');
      }));
    }

    async function renderUserInfo(surface) {
      loading(surface);
      const user = await request('/api/v1/session/userinfo');
      surface.innerHTML = `${surfaceHead('User info', 'Current Argo CD authenticated identity and groups.')}<div class="direct-summary-grid"><div><span>Username</span><b>${esc(user?.username || '—')}</b></div><div><span>Logged in</span><b>${user?.loggedIn === false ? 'No' : 'Yes'}</b></div><div><span>Issuer</span><b>${esc(user?.iss || '—')}</b></div></div><section class="direct-section"><h3>Groups</h3><div class="direct-tags">${(user?.groups || []).map(group => `<span>${esc(group)}</span>`).join('') || '<span>None</span>'}</div></section><pre class="direct-code">${esc(pretty(user))}</pre>`;
    }

    async function renderHelp(surface) {
      loading(surface);
      const [version, settings] = await Promise.all([request('/api/version'), request('/api/v1/settings').catch(() => null)]);
      surface.innerHTML = `${surfaceHead('Help', 'Runtime information for this Argo CD installation.')}<div class="direct-summary-grid"><div><span>Argo CD version</span><b>${esc(version?.Version || version?.version || 'Unknown')}</b></div><div><span>Build date</span><b>${esc(version?.BuildDate || version?.buildDate || '—')}</b></div><div><span>Go version</span><b>${esc(version?.GoVersion || version?.goVersion || '—')}</b></div></div><section class="direct-section"><h3>Server capabilities</h3><pre class="direct-code">${esc(pretty(settings || {}))}</pre></section>`;
    }

    function logEntries(text, fallbackContainer = '') {
      const entries = [];
      String(text || '').split(/\r?\n/).forEach(line => {
        const raw = line.startsWith('data:') ? line.slice(5).trim() : line.trim();
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw); const result = parsed?.result || parsed;
          if (result && !result.last) entries.push({content: result.content ?? result.message ?? '', podName: result.podName || '', containerName: result.containerName || fallbackContainer, timeStamp: result.timeStamp || ''});
        } catch { if (!line.startsWith(':')) entries.push({content: line, podName: '', containerName: fallbackContainer, timeStamp: ''}); }
      });
      return entries;
    }

    async function loadResourceContext(path) {
      const app = appIdentity(path); const node = nodeIdentity(path);
      if (!app || !node) throw new Error('Resource identity is missing from the route.');
      const appQuery = app.namespace ? `?appNamespace=${encodeURIComponent(app.namespace)}` : '';
      const application = await request(`/api/v1/applications/${encodeURIComponent(app.name)}${appQuery}`);
      const resourceQuery = qs({name: node.name, appNamespace: app.namespace || application?.metadata?.namespace || '', namespace: node.namespace, resourceName: node.name, version: '', kind: node.kind, group: node.group});
      const liveResponse = await request(`/api/v1/applications/${encodeURIComponent(app.name)}/resource?${resourceQuery}`);
      const live = liveResponse?.manifest !== undefined ? normalizeJson(liveResponse.manifest) : normalizeJson(liveResponse);
      const containers = [...(live?.spec?.containers || []), ...(live?.spec?.initContainers || []), ...(live?.spec?.ephemeralContainers || [])].map(container => container?.name).filter(Boolean);
      return {app, node, application, live, containers};
    }

    async function renderAdvancedLogs(surface, path) {
      loading(surface);
      const context = await loadResourceContext(path);
      const defaultContainer = context.containers[Math.min(context.node.containerIndex, Math.max(0, context.containers.length - 1))] || '';
      surface.innerHTML = `${surfaceHead(`${context.node.kind} ${context.node.name} logs`, 'Direct Argo CD log controls; no embedded original UI.')}<div class="direct-log-controls"><select data-log-container>${context.containers.map(name => `<option ${name === defaultContainer ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><input type="number" min="1" value="500" data-log-tail title="Tail lines"><input type="number" min="0" value="0" data-log-since title="Since seconds"><input data-log-filter placeholder="Filter"><label><input type="checkbox" data-log-match-case> Match case</label><label><input type="checkbox" data-log-previous> Previous</label><label><input type="checkbox" data-log-follow> Follow</label><button class="button primary" data-log-load>Load logs</button></div><pre class="direct-terminal direct-logs-output" data-logs-output>Choose log options and load.</pre><div class="direct-inline-error" data-direct-inline-error hidden></div>`;
      surface.querySelector('[data-log-load]')?.addEventListener('click', () => void startLogs(surface, context));
    }

    async function startLogs(surface, context) {
      const controller = controllers.get(surface) || {};
      controller.eventSource?.close?.();
      controller.eventSource = null;
      controllers.set(surface, controller);
      const container = surface.querySelector('[data-log-container]')?.value || context.containers[0] || '';
      const query = qs({appNamespace: context.app.namespace || context.application?.metadata?.namespace || '', container, namespace: context.node.namespace, follow: Boolean(surface.querySelector('[data-log-follow]')?.checked), ...(context.node.kind === 'Pod' ? {podName: context.node.name} : {group: context.node.group, kind: context.node.kind, resourceName: context.node.name}), tailLines: Number(surface.querySelector('[data-log-tail]')?.value || 500), sinceSeconds: Number(surface.querySelector('[data-log-since]')?.value || 0), filter: surface.querySelector('[data-log-filter]')?.value || '', matchCase: Boolean(surface.querySelector('[data-log-match-case]')?.checked), previous: Boolean(surface.querySelector('[data-log-previous]')?.checked)});
      const output = surface.querySelector('[data-logs-output]'); if (output) output.textContent = 'Loading logs…';
      try {
        if (surface.querySelector('[data-log-follow]')?.checked) {
          const source = new EventSource(`${base()}/api/v1/applications/${encodeURIComponent(context.app.name)}/logs?${query}`, {withCredentials: true});
          controller.eventSource = source;
          if (output) output.textContent = '';
          source.onmessage = event => {
            try { const result = JSON.parse(event.data)?.result; if (result?.last) return source.close(); if (result && output) { output.textContent += `${result.timeStamp ? `${result.timeStamp} ` : ''}${result.content || ''}\n`; output.scrollTop = output.scrollHeight; } } catch {}
          };
          source.onerror = () => { source.close(); showInlineError(surface, new Error('Log stream closed.')); };
        } else {
          const text = await requestText(`/api/v1/applications/${encodeURIComponent(context.app.name)}/logs?${query}`);
          const lines = logEntries(text, container).map(entry => `${entry.timeStamp ? `${entry.timeStamp} ` : ''}${entry.content}`).join('\n');
          if (output) output.textContent = lines || 'No log lines returned.';
        }
      } catch (error) { showInlineError(surface, error); if (output) output.textContent = ''; }
    }

    async function renderTerminal(surface, path) {
      loading(surface);
      const context = await loadResourceContext(path);
      if (context.node.kind !== 'Pod') throw new Error('Terminal is available for Pods only.');
      const selected = context.containers[Math.min(context.node.containerIndex, Math.max(0, context.containers.length - 1))] || context.containers[0] || '';
      surface.innerHTML = `${surfaceHead(`Terminal · ${context.node.name}`, 'Direct WebSocket terminal using Argo CD’s /terminal endpoint and the current authenticated session.')}<div class="direct-terminal-toolbar"><select data-terminal-container>${context.containers.map(name => `<option ${name === selected ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><span data-terminal-status>Disconnected</span><button class="button" data-terminal-connect>Reconnect</button></div><pre class="direct-terminal" tabindex="0" data-terminal-output aria-label="Pod terminal output"></pre><div class="direct-terminal-hint">Click the terminal and type. Paste is supported. Ctrl/Cmd key combinations and arrow keys are forwarded to the shell.</div><div class="direct-inline-error" data-direct-inline-error hidden></div>`;
      const connect = () => connectTerminal(surface, context);
      surface.querySelector('[data-terminal-connect]')?.addEventListener('click', connect);
      surface.querySelector('[data-terminal-container]')?.addEventListener('change', connect);
      connect();
    }

    function connectTerminal(surface, context) {
      const controller = controllers.get(surface) || {};
      controller.socket?.close?.();
      controller.socket = null;
      controllers.set(surface, controller);
      const output = surface.querySelector('[data-terminal-output]');
      const status = surface.querySelector('[data-terminal-status]');
      const container = surface.querySelector('[data-terminal-container]')?.value || context.containers[0] || '';
      if (!container) return showInlineError(surface, new Error('No Pod container is available.'));
      const endpoint = new URL(base());
      endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
      endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/terminal`;
      endpoint.search = qs({pod: context.node.name, container, appName: context.app.name, appNamespace: context.app.namespace || context.application?.metadata?.namespace || '', projectName: context.application?.spec?.project || 'default', namespace: context.node.namespace});
      const socket = new WebSocket(endpoint.toString());
      controller.socket = socket;
      if (output) output.textContent = '';
      if (status) status.textContent = 'Connecting…';
      const send = data => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({operation: 'stdin', data, rows: Math.max(12, Math.floor((output?.clientHeight || 360) / 18)), cols: Math.max(40, Math.floor((output?.clientWidth || 760) / 8))})); };
      const resize = () => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({operation: 'resize', rows: Math.max(12, Math.floor((output?.clientHeight || 360) / 18)), cols: Math.max(40, Math.floor((output?.clientWidth || 760) / 8))})); };
      socket.onopen = () => { if (status) status.textContent = 'Connected'; resize(); output?.focus(); };
      socket.onclose = () => { if (status) status.textContent = 'Disconnected'; };
      socket.onerror = () => showInlineError(surface, new Error('Terminal connection error.'));
      socket.onmessage = event => { try { const frame = JSON.parse(event.data); if (frame?.Code) return showInlineError(surface, new Error(frame?.Message || `Terminal error ${frame.Code}`)); if (output && frame?.data !== undefined) { output.textContent += frame.data; output.scrollTop = output.scrollHeight; } } catch { if (output) output.textContent += event.data; } };
      output?.addEventListener('keydown', event => {
        let data = '';
        if ((event.ctrlKey || event.metaKey) && event.key.length === 1) data = String.fromCharCode(event.key.toUpperCase().charCodeAt(0) & 31);
        else if (event.key === 'Enter') data = '\r';
        else if (event.key === 'Backspace') data = '\x7f';
        else if (event.key === 'Tab') data = '\t';
        else if (event.key === 'ArrowUp') data = '\x1b[A';
        else if (event.key === 'ArrowDown') data = '\x1b[B';
        else if (event.key === 'ArrowRight') data = '\x1b[C';
        else if (event.key === 'ArrowLeft') data = '\x1b[D';
        else if (event.key === 'Escape') data = '\x1b';
        else if (event.key.length === 1 && !event.altKey) data = event.key;
        if (data) { event.preventDefault(); send(data); }
      });
      output?.addEventListener('paste', event => { const text = event.clipboardData?.getData('text') || ''; if (text) { event.preventDefault(); send(text); } });
      const observer = new ResizeObserver(resize); if (output) observer.observe(output); controller.resizeObserver?.disconnect?.(); controller.resizeObserver = observer;
    }

    async function renderResourceRoute(surface, path) {
      const tab = routeUrl(path).searchParams.get('tab') || 'summary';
      if (tab === 'exec') return renderTerminal(surface, path);
      if (tab === 'logs') return renderAdvancedLogs(surface, path);
      loading(surface);
      const context = await loadResourceContext(path);
      surface.innerHTML = `${surfaceHead(`${context.node.kind} ${context.node.name}`, 'Direct resource detail surface.')}<div class="direct-summary-grid"><div><span>Namespace</span><b>${esc(context.node.namespace || '(cluster)')}</b></div><div><span>Application</span><b>${esc(context.app.name)}</b></div><div><span>Project</span><b>${esc(context.application?.spec?.project || 'default')}</b></div></div><pre class="direct-code">${esc(pretty(context.live))}</pre>`;
    }

    async function renderSurface(surface) {
      const path = surface.dataset.directPath || '/settings';
      const controller = controllers.get(surface) || {};
      controller.eventSource?.close?.(); controller.socket?.close?.(); controller.resizeObserver?.disconnect?.();
      controllers.set(surface, {path});
      try {
        const url = routeUrl(path); const segments = decodedSegments(path);
        if (segments[0] === 'applications' && url.searchParams.has('node')) return await renderResourceRoute(surface, path);
        const app = appIdentity(path); if (app && segments.length >= 2) return await renderApplicationEditor(surface, app, false);
        const appSet = appSetIdentity(path); if (appSet && segments.length >= 2) return await renderApplicationSetEditor(surface, appSet, false);
        if (segments[0] === 'applications') return await renderApplications(surface, url);
        if (segments[0] === 'applicationsets') return await renderApplicationSets(surface, url);
        if (segments[0] === 'settings' && segments.length === 1) return settingsOverview(surface);
        if (segments[0] === 'settings' && segments[1] === 'projects') return await renderProjects(surface, url);
        if (segments[0] === 'settings' && segments[1] === 'repos') return await renderRepositories(surface, url, false);
        if (segments[0] === 'settings' && segments[1] === 'write-repos') return await renderRepositories(surface, url, true);
        if (segments[0] === 'settings' && segments[1] === 'clusters') return await renderClusters(surface, url);
        if (segments[0] === 'settings' && segments[1] === 'certs') return await renderCertificates(surface, url);
        if (segments[0] === 'settings' && segments[1] === 'gpgkeys') return await renderGpgKeys(surface, url);
        if (segments[0] === 'settings' && segments[1] === 'accounts') return await renderAccounts(surface, url);
        if (segments[0] === 'settings' && segments[1] === 'appearance') return renderAppearance(surface);
        if (segments[0] === 'user-info') return await renderUserInfo(surface);
        if (segments[0] === 'help') return await renderHelp(surface);
        surface.innerHTML = `${surfaceHead('Full UI control', 'This route is represented directly by its API payload.')}<pre class="direct-code">${esc(pretty(await request(`/api/v1${url.pathname}`)))}</pre>`;
      } catch (error) { failure(surface, error); }
    }

    function frame(path, {title = 'Argo CD controls', description = ''} = {}) {
      return `<section class="direct-surface" data-direct-surface data-direct-path="${esc(cleanPath(path))}" aria-label="${esc(title)}"><div class="direct-loading">${esc(description || 'Loading Full UI controls…')}</div></section>`;
    }

    function bind(root = state.root) {
      root?.querySelectorAll('[data-direct-surface]').forEach(surface => {
        if (surface.dataset.directBound === 'true') return;
        surface.dataset.directBound = 'true';
        void renderSurface(surface);
      });
    }

    function applyTheme() {}

    const styles = `
      .direct-surface{min-height:320px;border:1px solid var(--border);border-radius:10px;background:var(--panel);color:var(--text);overflow:hidden;color-scheme:inherit}.direct-head{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);background:var(--panel)}.direct-head>div:first-child{min-width:0;flex:1}.direct-head h2{margin:0;font-size:17px}.direct-head p{margin:3px 0 0;color:var(--muted);font-size:12px}.direct-head-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.direct-loading,.direct-empty{padding:34px;text-align:center;color:var(--muted)}.direct-error{margin:16px;padding:14px;border:1px solid color-mix(in srgb,var(--bad) 55%,var(--border));border-radius:8px;background:color-mix(in srgb,var(--bad) 7%,var(--panel));color:var(--bad);display:grid;gap:7px}.direct-error .button{justify-self:start}.direct-list{display:grid}.direct-row{min-height:58px;width:100%;display:grid;grid-template-columns:minmax(220px,1.6fr) minmax(100px,.7fr) minmax(100px,.7fr) 48px;align-items:center;gap:12px;padding:9px 13px;border:0;border-bottom:1px solid var(--border);background:var(--panel);color:var(--text);text-align:left;cursor:pointer}.direct-row:hover:not(.static){background:var(--soft)}.direct-row.static{cursor:default}.direct-row>span:first-child{min-width:0}.direct-row b,.direct-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.direct-row small{color:var(--muted);font-size:11px}.direct-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px}.direct-card{min-height:90px;display:grid;grid-template-columns:minmax(0,1fr) 28px;grid-template-rows:auto auto;gap:2px 10px;padding:14px;border:1px solid var(--border);border-radius:9px;background:var(--panel);color:var(--text);text-align:left;cursor:pointer}.direct-card:hover{background:var(--soft);border-color:var(--accent)}.direct-card b{font-size:14px}.direct-card span{color:var(--muted);font-size:12px}.direct-card i{grid-column:2;grid-row:1/3;align-self:center;font-style:normal;color:var(--muted);font-size:20px}.direct-editor{padding:14px;display:grid;gap:10px}.direct-json-editor{display:block;width:100%;min-height:520px;resize:vertical;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:12px;font:12px/1.55 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;tab-size:2;color-scheme:inherit}.direct-key-input{min-height:360px}.direct-editor-actions{display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap}.direct-select,.direct-log-controls select,.direct-terminal-toolbar select,.direct-fields input{min-height:38px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);padding:0 9px;color-scheme:inherit}.direct-inline-error{padding:10px;border:1px solid color-mix(in srgb,var(--bad) 50%,var(--border));border-radius:7px;background:color-mix(in srgb,var(--bad) 7%,var(--panel));color:var(--bad)}.direct-section{padding:14px;border-bottom:1px solid var(--border)}.direct-section h3{margin:0 0 9px;font-size:13px}.direct-fields{display:flex;gap:8px;flex-wrap:wrap}.direct-fields input{min-width:180px;flex:1}.direct-secret{margin-top:10px;padding:10px;border:1px solid var(--warn);border-radius:7px;background:color-mix(in srgb,var(--warn) 8%,var(--panel));font:12px/1.5 "SFMono-Regular",Consolas,monospace;word-break:break-all}.direct-code{margin:14px;max-height:650px;overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:12px;font:11px/1.55 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;white-space:pre}.direct-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px}.direct-summary-grid>div{padding:11px;border:1px solid var(--border);border-radius:8px;background:var(--bg)}.direct-summary-grid span,.direct-summary-grid b{display:block}.direct-summary-grid span{color:var(--muted);font-size:11px}.direct-tags{display:flex;flex-wrap:wrap;gap:6px}.direct-tags span{padding:3px 7px;border:1px solid var(--border);border-radius:999px;background:var(--bg);font-size:11px}.direct-theme-picker{display:flex;gap:8px;padding:16px}.direct-log-controls,.direct-terminal-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px;border-bottom:1px solid var(--border);background:var(--panel)}.direct-log-controls input:not([type=checkbox]){min-height:38px;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);padding:0 8px;max-width:150px}.direct-log-controls label{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:11px}.direct-terminal{margin:12px;min-height:440px;max-height:70vh;overflow:auto;border:1px solid var(--border);border-radius:8px;background:#010409;color:#f0f6fc;padding:12px;font:12px/1.5 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;white-space:pre-wrap;word-break:break-word;outline:none}.direct-terminal:focus{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}.direct-terminal-hint{padding:0 12px 12px;color:var(--muted);font-size:11px}.direct-terminal-toolbar span{color:var(--muted);font-size:11px}.app.dark .direct-surface,.app.dark .direct-head,.app.dark .direct-row,.app.dark .direct-card,.app.dark .direct-section,.app.dark .direct-log-controls,.app.dark .direct-terminal-toolbar{background:#0d1117;color:#f0f6fc;border-color:#30363d}.app.dark .direct-json-editor,.app.dark .direct-select,.app.dark .direct-fields input,.app.dark .direct-log-controls input:not([type=checkbox]),.app.dark .direct-log-controls select,.app.dark .direct-terminal-toolbar select,.app.dark .direct-code,.app.dark .direct-summary-grid>div,.app.dark .direct-tags span{background:#010409;color:#f0f6fc;border-color:#30363d;color-scheme:dark}.app.dark .direct-card:hover,.app.dark .direct-row:hover:not(.static){background:#161b22}.app.dark .direct-terminal{background:#010409;color:#f0f6fc;border-color:#30363d;color-scheme:dark}
      .direct-overlay{position:fixed;inset:12px;z-index:1000;display:grid;grid-template-rows:56px minmax(0,1fr);overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--bg);box-shadow:0 24px 80px rgba(1,4,9,.38)}.direct-overlay-top{display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--border);background:var(--panel)}.direct-overlay-top div{min-width:0;flex:1}.direct-overlay-top strong,.direct-overlay-top span{display:block}.direct-overlay-top span{color:var(--muted);font-size:11px}.direct-overlay-close{min-width:44px;min-height:44px;border:1px solid var(--border);border-radius:7px;background:var(--panel);color:var(--text);cursor:pointer}.direct-overlay>.direct-surface{border:0;border-radius:0;overflow:auto}
      @media(max-width:900px){.direct-card-grid{grid-template-columns:1fr}.direct-row{grid-template-columns:minmax(180px,1fr) 110px 40px}.direct-row>span:nth-child(3){display:none}.direct-summary-grid{grid-template-columns:1fr}.direct-overlay{inset:6px}}@media(max-width:600px){.direct-row{grid-template-columns:minmax(0,1fr) 38px}.direct-row>span:nth-child(2),.direct-row>span:nth-child(3){display:none}.direct-editor{padding:8px}.direct-json-editor{min-height:440px}.direct-head{display:grid}.direct-head-actions{justify-content:flex-start}.direct-terminal{margin:8px;min-height:360px}}
    `;

    return {styles, frame, bind, applyTheme, urlFor, cleanPath, renderSurface, normalizeJson, pretty};
  };

  const graphFactory = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__;
  if (graphFactory && !globalThis.__ARGOCD_FULL_GRAPH_DIRECT_ADAPTED__) {
    globalThis.__ARGOCD_FULL_GRAPH_DIRECT_ADAPTED__ = true;
    globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = options => {
      const {state, esc, rerender} = options;
      const direct = globalThis.__ARGOCD_FULL_DIRECT_FACTORY__({state, esc});
      const base = () => String(state.baseUrl || '').replace(/\/+$/, '');
      const request = async (path, requestOptions = {}) => {
        const response = await fetch(`${base()}${path}`, {credentials: 'include', headers: {Accept: 'application/json', ...(requestOptions.body ? {'Content-Type': 'application/json'} : {})}, ...requestOptions});
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.status === 204 ? null : response.json();
      };
      const fetchText = async path => {
        const response = await fetch(`${base()}${path}`, {credentials: 'include', headers: {Accept: 'text/event-stream, text/plain, */*'}});
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.text();
      };
      const resourceIdentity = resource => [resource?.group || '', resource?.kind || '', resource?.namespace || '', resource?.name || ''].join('|');
      const mergeResourceStatus = () => {
        const statuses = new Map((state.selected?.status?.resources || []).map(resource => [resourceIdentity(resource), resource]));
        const merge = node => { const status = statuses.get(resourceIdentity(node)); if (!status) return node; node.health = status.health || node.health; node.status = status.status || node.status; node.hook = status.hook; node.syncWave = status.syncWave; node.requiresPruning = status.requiresPruning; return node; };
        (state.tree?.nodes || []).forEach(merge); (state.tree?.orphanedNodes || []).forEach(merge);
      };
      const reloadApp = async () => {
        if (!state.selected?.metadata?.name) return rerender?.();
        const name = encodeURIComponent(state.selected.metadata.name); const namespace = state.selected.metadata.namespace || ''; const query = namespace ? `?appNamespace=${encodeURIComponent(namespace)}` : '';
        [state.selected, state.tree] = await Promise.all([request(`/api/v1/applications/${name}${query}`), request(`/api/v1/applications/${name}/resource-tree${query}`)]); mergeResourceStatus(); rerender?.();
      };
      const openDirect = path => {
        if (!state.root) return;
        state.root.querySelector('.direct-overlay')?.remove();
        const overlay = document.createElement('section');
        overlay.className = 'direct-overlay';
        overlay.innerHTML = `<div class="direct-overlay-top"><div><strong>Resource controls</strong><span>Full replacement UI · direct Argo CD API/WebSocket controls</span></div><button class="direct-overlay-close" type="button" data-direct-overlay-close>Close</button></div>${direct.frame(path, {title: 'Resource controls'})}`;
        state.root.appendChild(overlay);
        overlay.querySelector('[data-direct-overlay-close]')?.addEventListener('click', () => overlay.remove());
        direct.bind(overlay);
      };
      const graph = graphFactory({...options, api: options.api || request, fetchText: options.fetchText || fetchText, reloadApp: options.reloadApp || reloadApp, openOriginal: openDirect});
      const directLabels = markup => String(markup || '').replaceAll('Native fallback', 'Advanced details').replaceAll('Native log controls', 'Advanced logs').replaceAll('original UI', 'advanced controls');
      const wrap = method => (...args) => { mergeResourceStatus(); return directLabels(graph[method](...args)); };
      return {...graph, resourceNodes: wrap('resourceNodes'), toolbar: wrap('toolbar'), content: wrap('content'), bind: wrap('bind')};
    };
  }
})();