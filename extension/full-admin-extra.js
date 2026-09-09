(() => {
  const directFactory = globalThis.__ARGOCD_FULL_DIRECT_FACTORY__;
  if (!directFactory || globalThis.__ARGOCD_FULL_ADMIN_EXTRA__) return;
  globalThis.__ARGOCD_FULL_ADMIN_EXTRA__ = true;

  globalThis.__ARGOCD_FULL_DIRECT_FACTORY__ = options => {
    const direct = directFactory(options);
    const {state, esc} = options;
    const base = () => String(state.baseUrl || '').replace(/\/+$/, '');
    const normalize = value => direct.normalizeJson ? direct.normalizeJson(value) : value;
    const pretty = value => direct.pretty ? direct.pretty(value) : JSON.stringify(value, null, 2);

    async function request(path, requestOptions = {}) {
      const response = await fetch(`${base()}${path}`, {
        credentials: 'include',
        headers: {Accept: 'application/json', ...(requestOptions.body ? {'Content-Type': 'application/json'} : {})},
        ...requestOptions
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch {}
        throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 240)}` : ''}`);
      }
      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      try { return normalize(JSON.parse(text)); } catch { return text; }
    }

    const routeUrl = path => new URL(`/${String(path || '').replace(/^\/+/, '')}`, 'https://argocd-modern.invalid');
    const isCredsPath = path => /^\/settings\/(?:write-)?repocreds(?:\?|$)/.test(String(path || ''));
    const credsEndpoint = path => String(path || '').includes('/write-repocreds') ? '/api/v1/write-repocreds' : '/api/v1/repocreds';
    const credsRoute = path => String(path || '').includes('/write-repocreds') ? '/settings/write-repocreds' : '/settings/repocreds';
    const repoRoute = path => String(path || '').includes('/write-repocreds') ? '/settings/write-repos' : '/settings/repos';
    const showError = (surface, error) => {
      let box = surface.querySelector('[data-admin-extra-error]');
      if (!box) {
        box = document.createElement('div');
        box.dataset.adminExtraError = 'true';
        box.className = 'direct-inline-error';
        surface.appendChild(box);
      }
      box.hidden = false;
      box.textContent = String(error?.message || error);
    };

    function editorValue(surface) {
      try { return normalize(JSON.parse(surface.querySelector('.direct-json-editor')?.value || '{}')); }
      catch (error) { showError(surface, new Error(`Invalid JSON: ${error.message}`)); return null; }
    }

    async function renderRepoCreds(surface) {
      const path = surface.dataset.directPath || '/settings/repocreds';
      const url = routeUrl(path);
      const endpoint = credsEndpoint(path);
      const back = repoRoute(path);
      const route = credsRoute(path);
      const write = endpoint.includes('write-');

      if (url.searchParams.get('create') === '1') {
        const template = {
          url: '',
          type: 'git',
          username: '',
          password: '',
          bearerToken: '',
          sshPrivateKey: '',
          githubAppPrivateKey: '',
          githubAppId: 0,
          githubAppInstallationId: 0,
          githubAppEnterpriseBaseURL: '',
          gcpServiceAccountKey: '',
          azureServicePrincipalClientId: '',
          azureServicePrincipalClientSecret: '',
          azureServicePrincipalTenantId: '',
          azureActiveDirectoryEndpoint: '',
          tlsClientCertData: '',
          tlsClientCertKey: '',
          proxy: '',
          noProxy: '',
          enableOCI: false,
          insecureOCIForceHttp: false,
          forceHttpBasicAuth: false,
          useAzureWorkloadIdentity: false
        };
        surface.innerHTML = `<div class="direct-head"><div><h2>New ${write ? 'write ' : ''}credentials template</h2><p>Direct repository credential template control.</p></div></div><div class="direct-editor"><textarea class="direct-json-editor" spellcheck="false">${esc(pretty(template))}</textarea><div class="direct-editor-actions"><button class="button" data-creds-back>Back</button><button class="button primary" data-creds-save>Save credentials template</button></div><div class="direct-inline-error" data-admin-extra-error hidden></div></div>`;
        surface.querySelector('[data-creds-back]')?.addEventListener('click', () => { surface.dataset.directPath = route; void renderRepoCreds(surface); });
        surface.querySelector('[data-creds-save]')?.addEventListener('click', async () => {
          const value = editorValue(surface); if (!value) return;
          if (!String(value.url || '').trim()) return showError(surface, new Error('Credential template URL/prefix is required.'));
          try { await request(endpoint, {method: 'POST', body: JSON.stringify(value)}); surface.dataset.directPath = route; await renderRepoCreds(surface); }
          catch (error) { showError(surface, error); }
        });
        return;
      }

      surface.innerHTML = '<div class="direct-loading">Loading repository credential templates…</div>';
      try {
        const result = await request(endpoint);
        const templates = Array.isArray(result) ? result : result?.items || [];
        const rows = templates.map((credential, index) => `<div class="direct-row static"><span><b>${esc(credential?.url || '')}</b><small>${esc(credential?.type || 'git')}</small></span><span>${credential?.username ? 'Username/password' : credential?.sshPrivateKey ? 'SSH' : credential?.githubAppId ? 'GitHub App' : credential?.gcpServiceAccountKey ? 'Google Cloud' : credential?.azureServicePrincipalClientId ? 'Azure SP' : 'Credential template'}</span><span>${credential?.enableOCI ? 'OCI' : ''}</span><button class="button danger" data-creds-delete="${index}">Delete</button></div>`).join('');
        surface.innerHTML = `<div class="direct-head"><div><h2>${write ? 'Write repository' : 'Repository'} credential templates</h2><p>Credential-prefix templates are managed directly through Argo CD's repository-credentials API.</p></div><div class="direct-head-actions"><button class="button" data-creds-repositories>Repositories</button><button class="button primary" data-creds-create>New credentials template</button></div></div><div class="direct-list">${rows || '<div class="direct-empty">No credential templates returned.</div>'}</div><div class="direct-inline-error" data-admin-extra-error hidden></div>`;
        surface.querySelector('[data-creds-repositories]')?.addEventListener('click', () => { surface.dataset.directPath = back; direct.renderSurface(surface); });
        surface.querySelector('[data-creds-create]')?.addEventListener('click', () => { surface.dataset.directPath = `${route}?create=1`; void renderRepoCreds(surface); });
        surface.querySelectorAll('[data-creds-delete]').forEach(button => button.addEventListener('click', async () => {
          const credential = templates[Number(button.dataset.credsDelete)];
          if (!credential || !confirm(`Delete credentials template “${credential.url}”?`)) return;
          try { await request(`${endpoint}/${encodeURIComponent(credential.url)}`, {method: 'DELETE'}); await renderRepoCreds(surface); }
          catch (error) { showError(surface, error); }
        }));
      } catch (error) { showError(surface, error); }
    }

    function addRepositoryControls(surface) {
      const path = String(surface.dataset.directPath || '');
      const url = routeUrl(path);
      if (!/^\/settings\/(?:write-)?repos$/.test(url.pathname) || url.search) return;
      const actions = surface.querySelector('.direct-head-actions');
      if (!actions || actions.querySelector('[data-repo-creds]')) return;
      const write = url.pathname.includes('write-repos');
      const credentials = document.createElement('button');
      credentials.className = 'button';
      credentials.dataset.repoCreds = 'true';
      credentials.textContent = 'Credential templates';
      credentials.addEventListener('click', () => {
        surface.dataset.directPath = write ? '/settings/write-repocreds' : '/settings/repocreds';
        void renderRepoCreds(surface);
      });
      const refresh = document.createElement('button');
      refresh.className = 'button';
      refresh.dataset.repoRefresh = 'true';
      refresh.textContent = 'Force refresh';
      refresh.addEventListener('click', async () => {
        try {
          await request(`/api/v1/${write ? 'write-repositories' : 'repositories'}?forceRefresh=true`);
          await direct.renderSurface(surface);
        } catch (error) { showError(surface, error); }
      });
      actions.prepend(refresh, credentials);
    }

    function addSettingsCredentialCard(surface) {
      if (String(surface.dataset.directPath || '') !== '/settings') return;
      const grid = surface.querySelector('.direct-card-grid');
      if (!grid || grid.querySelector('[data-settings-creds]')) return;
      const card = document.createElement('button');
      card.className = 'direct-card';
      card.dataset.settingsCreds = 'true';
      card.innerHTML = '<b>Credential templates</b><span>Repository credential-prefix templates without leaving Full UI</span><i>›</i>';
      card.addEventListener('click', () => { surface.dataset.directPath = '/settings/repocreds'; void renderRepoCreds(surface); });
      grid.appendChild(card);
    }

    function projectObject(surface) {
      const value = editorValue(surface);
      return value?.kind === 'AppProject' || value?.apiVersion?.includes('argoproj.io') ? value : null;
    }

    async function refreshProjectExtras(surface, projectName) {
      try {
        const project = await request(`/api/v1/projects/${encodeURIComponent(projectName)}`);
        const editor = surface.querySelector('.direct-json-editor');
        if (editor) editor.value = pretty(project);
        renderProjectExtras(surface, projectName);
      } catch (error) { showError(surface, error); }
    }

    function renderProjectExtras(surface, projectName) {
      surface.querySelector('[data-project-extra]')?.remove();
      const project = projectObject(surface);
      if (!project) return;
      const roles = project?.spec?.roles || [];
      const section = document.createElement('section');
      section.className = 'direct-section';
      section.dataset.projectExtra = 'true';
      const roleOptions = roles.map(role => `<option value="${esc(role.name || '')}">${esc(role.name || '')}</option>`).join('');
      const tokenRows = roles.flatMap(role => (role.jwtTokens || []).map(token => `<div class="direct-row static"><span><b>${esc(role.name || '')}</b><small>Issued ${esc(token.iat ? new Date(Number(token.iat) * 1000).toISOString() : '—')}</small></span><span>${esc(token.exp ? new Date(Number(token.exp) * 1000).toISOString() : 'No expiry')}</span><span></span><button class="button danger" data-project-token-delete data-role="${esc(role.name || '')}" data-iat="${esc(token.iat || '')}">Delete</button></div>`)).join('');
      section.innerHTML = `<h3>Project role JWT tokens</h3><div class="direct-fields"><select class="direct-select" data-project-token-role>${roleOptions || '<option value="">No roles defined</option>'}</select><input type="number" min="0" data-project-token-expiry placeholder="Expires in seconds (0 = never)"><button class="button primary" data-project-token-create ${roles.length ? '' : 'disabled'}>Create token</button><button class="button" data-project-events>Events & links</button></div><div class="direct-secret" data-project-token-secret hidden></div><div class="direct-list">${tokenRows || '<div class="direct-empty">No project role tokens.</div>'}</div><pre class="direct-code" data-project-events-output hidden></pre><div class="direct-inline-error" data-admin-extra-error hidden></div>`;
      surface.querySelector('.direct-editor')?.appendChild(section);

      section.querySelector('[data-project-token-create]')?.addEventListener('click', async () => {
        const role = section.querySelector('[data-project-token-role]')?.value || '';
        const expiresIn = Number(section.querySelector('[data-project-token-expiry]')?.value || 0);
        if (!role) return showError(surface, new Error('Select a project role first.'));
        try {
          const result = await request(`/api/v1/projects/${encodeURIComponent(projectName)}/roles/${encodeURIComponent(role)}/token`, {method: 'POST', body: JSON.stringify({project: projectName, role, expiresIn})});
          const secret = section.querySelector('[data-project-token-secret]');
          if (secret) { secret.hidden = false; secret.textContent = `Token (copy now): ${result?.token || result}`; }
          await refreshProjectExtras(surface, projectName);
        } catch (error) { showError(surface, error); }
      });

      section.querySelectorAll('[data-project-token-delete]').forEach(button => button.addEventListener('click', async () => {
        if (!confirm(`Delete token issued for project role “${button.dataset.role}”?`)) return;
        try {
          await request(`/api/v1/projects/${encodeURIComponent(projectName)}/roles/${encodeURIComponent(button.dataset.role)}/token/${encodeURIComponent(button.dataset.iat)}`, {method: 'DELETE'});
          await refreshProjectExtras(surface, projectName);
        } catch (error) { showError(surface, error); }
      }));

      section.querySelector('[data-project-events]')?.addEventListener('click', async () => {
        try {
          const [events, links] = await Promise.all([
            request(`/api/v1/projects/${encodeURIComponent(projectName)}/events`),
            request(`/api/v1/projects/${encodeURIComponent(projectName)}/links`)
          ]);
          const output = section.querySelector('[data-project-events-output]');
          if (output) { output.hidden = false; output.textContent = pretty({events: events?.items || events || [], links: links?.items || links || []}); }
        } catch (error) { showError(surface, error); }
      });
    }

    function addProjectControls(surface) {
      const url = routeUrl(surface.dataset.directPath || '');
      if (url.pathname !== '/settings/projects' || !url.searchParams.get('edit')) return;
      if (!surface.querySelector('.direct-json-editor')) return;
      renderProjectExtras(surface, url.searchParams.get('edit'));
    }

    function addApplicationSetPreview(surface) {
      const path = String(surface.dataset.directPath || '');
      const url = routeUrl(path);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments[0] !== 'applicationsets' || segments.length < 2 || url.searchParams.get('create') === '1') return;
      const actions = surface.querySelector('.direct-editor-actions');
      if (!actions || actions.querySelector('[data-appset-preview]')) return;
      const preview = document.createElement('button');
      preview.className = 'button';
      preview.dataset.appsetPreview = 'true';
      preview.textContent = 'Generate preview';
      actions.prepend(preview);
      const output = document.createElement('pre');
      output.className = 'direct-code';
      output.dataset.appsetPreviewOutput = 'true';
      output.hidden = true;
      surface.querySelector('.direct-editor')?.appendChild(output);
      preview.addEventListener('click', async () => {
        const applicationSet = editorValue(surface); if (!applicationSet) return;
        const {status, ...definition} = applicationSet;
        void status;
        try {
          const result = await request('/api/v1/applicationsets/generate', {method: 'POST', body: JSON.stringify({applicationSet: definition})});
          output.hidden = false;
          output.textContent = pretty(result?.applications || result || []);
        } catch (error) { showError(surface, error); }
      });
    }

    function enhanceSurface(surface) {
      if (!surface?.isConnected) return;
      addRepositoryControls(surface);
      addSettingsCredentialCard(surface);
      addProjectControls(surface);
      addApplicationSetPreview(surface);
    }

    function bind(root = state.root) {
      const extras = [...(root?.querySelectorAll?.('[data-direct-surface]') || [])].filter(surface => isCredsPath(surface.dataset.directPath));
      extras.forEach(surface => surface.removeAttribute('data-direct-surface'));
      direct.bind(root);
      extras.forEach(surface => {
        surface.setAttribute('data-direct-surface', '');
        surface.dataset.directBound = 'true';
        void renderRepoCreds(surface);
      });
      root?.querySelectorAll?.('[data-direct-surface]').forEach(enhanceSurface);
      if (!root || typeof MutationObserver === 'undefined' || root.__argocdAdminExtraObserver) return;
      root.__argocdAdminExtraObserver = true;
      const observer = new MutationObserver(() => root.querySelectorAll('[data-direct-surface]').forEach(enhanceSurface));
      observer.observe(root, {childList: true, subtree: true});
    }

    return {...direct, bind, renderRepoCreds};
  };
})();