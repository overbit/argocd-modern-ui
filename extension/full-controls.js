(() => {
  if (globalThis.__ARGOCD_FULL_CONTROLS_FACTORY__) return;

  globalThis.__ARGOCD_FULL_CONTROLS_FACTORY__ = ({state, api, esc, badge, health, sync, rerender, reloadApp, onDeleted}) => {
    const ui = {panel: null, loading: false, data: null, error: ''};
    const appName = () => state.selected?.metadata?.name || '';
    const appNamespace = () => state.selected?.metadata?.namespace || '';
    const appPath = suffix => `/api/v1/applications/${encodeURIComponent(appName())}${suffix || ''}`;
    const qs = values => {
      const search = new URLSearchParams();
      Object.entries(values || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
      });
      return search.toString();
    };

    function normalizeJson(value) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || !((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) return value;
        try { return normalizeJson(JSON.parse(trimmed)); } catch { return value; }
      }
      if (Array.isArray(value)) return value.map(normalizeJson);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJson(item)]));
      }
      return value;
    }

    function pretty(value) {
      if (value === undefined || value === null) return 'Not available';
      const normalized = normalizeJson(value);
      return typeof normalized === 'string' ? normalized : JSON.stringify(normalized, null, 2);
    }

    function setPanel(panel, data = null) {
      ui.panel = panel;
      ui.data = data;
      ui.error = '';
      ui.loading = false;
      rerender();
    }

    function closePanel() {
      Object.assign(ui, {panel: null, loading: false, data: null, error: ''});
      rerender();
    }

    async function loadPanel(panel, loader) {
      Object.assign(ui, {panel, loading: true, data: null, error: ''});
      rerender();
      try {
        ui.data = normalizeJson(await loader());
      } catch (error) {
        ui.error = String(error?.message || error);
      } finally {
        ui.loading = false;
        rerender();
      }
    }

    async function refresh(mode = 'normal') {
      const query = qs({appNamespace: appNamespace(), refresh: mode});
      await api(`${appPath('')}?${query}`);
      await reloadApp();
    }

    async function toggleAutoSync() {
      const enabled = state.selected?.spec?.syncPolicy?.automated && state.selected.spec.syncPolicy.automated.enabled !== false;
      if (!confirm(`${enabled ? 'Disable' : 'Enable'} Auto-Sync for “${appName()}”?`)) return;
      await api(appPath('/resource/actions/v2'), {
        method: 'POST',
        body: JSON.stringify({
          appNamespace: appNamespace(),
          namespace: appNamespace(),
          resourceName: appName(),
          version: 'v1alpha1',
          kind: 'Application',
          group: 'argoproj.io',
          resourceActionParameters: [],
          action: 'toggle-auto-sync'
        })
      });
      await reloadApp();
    }

    async function approveDeletion() {
      if (!confirm(`Confirm the pending prune/deletion resources for “${appName()}”?`)) return;
      const updated = structuredClone(state.selected);
      updated.metadata = updated.metadata || {};
      updated.metadata.annotations = {...(updated.metadata.annotations || {}), 'argocd.argoproj.io/deletion-approved': new Date().toISOString()};
      await api(`${appPath('')}?validate=false`, {method: 'PUT', body: JSON.stringify(updated)});
      await reloadApp();
    }

    async function terminateOperation() {
      if (!confirm(`Terminate the running operation for “${appName()}”?`)) return;
      await api(`${appPath('/operation')}?${qs({appNamespace: appNamespace()})}`, {method: 'DELETE'});
      await reloadApp();
    }

    async function rollback(id) {
      const entry = (state.selected?.status?.history || []).find(item => String(item.id) === String(id));
      if (!entry) return;
      const automated = state.selected?.spec?.syncPolicy?.automated && state.selected.spec.syncPolicy.automated.enabled !== false;
      const message = automated
        ? `Auto-Sync must be disabled first. Disable it and roll back “${appName()}” to history ${id}?`
        : `Roll back “${appName()}” to history ${id}?`;
      if (!confirm(message)) return;
      if (automated) {
        const updated = structuredClone(state.selected);
        updated.spec.syncPolicy = updated.spec.syncPolicy || {};
        updated.spec.syncPolicy.automated = {...(updated.spec.syncPolicy.automated || {}), enabled: false};
        await api(`${appPath('')}?validate=false`, {method: 'PUT', body: JSON.stringify(updated)});
      }
      await api(appPath('/rollback'), {method: 'POST', body: JSON.stringify({id: Number(id), appNamespace: appNamespace(), prune: false})});
      Object.assign(ui, {panel: null, loading: false, data: null, error: ''});
      await reloadApp();
    }

    async function deleteApplication(cascade, propagationPolicy) {
      const behavior = cascade ? `${propagationPolicy} cascading deletion` : 'non-cascading deletion';
      if (!confirm(`Delete application “${appName()}” using ${behavior}?`)) return;
      const query = qs({cascade, propagationPolicy: cascade ? propagationPolicy : '', appNamespace: appNamespace()});
      await api(`${appPath('')}?${query}`, {method: 'DELETE'});
      Object.assign(ui, {panel: null, loading: false, data: null, error: ''});
      state.selected = null;
      state.tree = null;
      state.apps = [];
      if (onDeleted) await onDeleted();
      else rerender();
    }

    const currentRevision = () => state.selected?.status?.sync?.revision || state.selected?.spec?.source?.targetRevision || state.selected?.spec?.sources?.[0]?.targetRevision || 'HEAD';

    function optionEnabled(options, name, defaultValue = false, invert = false) {
      const prefix = `${name}=`;
      const raw = (options || []).find(item => String(item).startsWith(prefix));
      if (!raw) return defaultValue;
      const value = String(raw).slice(prefix.length) === 'true';
      return invert ? !value : value;
    }

    function optionValue(options, name, fallback) {
      const prefix = `${name}=`;
      const raw = (options || []).find(item => String(item).startsWith(prefix));
      return raw ? String(raw).slice(prefix.length) : fallback;
    }

    function checkbox(name, label, checked = false, note = '') {
      return `<label class="control-check"><input type="checkbox" data-sync-field="${esc(name)}" ${checked ? 'checked' : ''}><span><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span></label>`;
    }

    function syncPanel() {
      const app = state.selected;
      const options = app?.spec?.syncPolicy?.syncOptions || [];
      const resources = (app?.status?.resources || []).filter(item => !item.hook);
      const retry = app?.spec?.syncPolicy?.retry;
      return `<div class="control-form">
        <div class="control-field"><label>Revision</label><input data-sync-revision value="${esc(currentRevision())}"></div>
        <h4>Manual sync flags</h4>
        <div class="control-grid checks">${checkbox('prune','Prune')}${checkbox('dryRun','Dry Run')}${checkbox('applyOnly','Apply Only')}${checkbox('force','Force',false,'Potentially destructive')}</div>
        <h4>Sync options</h4>
        <div class="control-grid checks">
          ${checkbox('skipValidation','Skip Schema Validation',optionEnabled(options,'Validate',false,true))}
          ${checkbox('createNamespace','Auto-Create Namespace',optionEnabled(options,'CreateNamespace'))}
          ${checkbox('applyOutOfSyncOnly','Apply Out of Sync Only',optionEnabled(options,'ApplyOutOfSyncOnly'))}
          ${checkbox('respectIgnoreDifferences','Respect Ignore Differences',optionEnabled(options,'RespectIgnoreDifferences'))}
          ${checkbox('serverSideApply','Server-Side Apply',optionEnabled(options,'ServerSideApply'))}
          ${checkbox('pruneLast','Prune Last',optionEnabled(options,'PruneLast'))}
          ${checkbox('replace','Replace',optionEnabled(options,'Replace'), 'Deletes and recreates resources')}
        </div>
        <div class="control-grid thirds">
          <div class="control-field"><label>Prune propagation</label><select data-sync-select="prunePropagation"><option ${optionValue(options,'PrunePropagationPolicy','foreground') === 'foreground' ? 'selected' : ''}>foreground</option><option ${optionValue(options,'PrunePropagationPolicy','foreground') === 'background' ? 'selected' : ''}>background</option><option ${optionValue(options,'PrunePropagationPolicy','foreground') === 'orphan' ? 'selected' : ''}>orphan</option></select></div>
          <div class="control-field"><label>Prune resource option</label><select data-sync-select="pruneOption">${['true','false','confirm'].map(value => `<option ${optionValue(options,'Prune','true') === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
          <div class="control-field"><label>Delete resource option</label><select data-sync-select="deleteOption">${['true','false','confirm'].map(value => `<option ${optionValue(options,'Delete','true') === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
        </div>
        <h4>Retry</h4>
        <div class="control-grid retry">${checkbox('retry','Retry',Boolean(retry))}<div class="control-field"><label>Limit</label><input type="number" min="1" data-sync-retry="limit" value="${esc(retry?.limit ?? 2)}"></div><div class="control-field"><label>Duration</label><input data-sync-retry="duration" value="${esc(retry?.backoff?.duration || '5s')}"></div><div class="control-field"><label>Max duration</label><input data-sync-retry="maxDuration" value="${esc(retry?.backoff?.maxDuration || '3m0s')}"></div><div class="control-field"><label>Factor</label><input type="number" min="1" data-sync-retry="factor" value="${esc(retry?.backoff?.factor ?? 2)}"></div></div>
        <div class="resource-select-head"><h4>Synchronize resources</h4><div><button data-sync-select-resources="all">All</button><button data-sync-select-resources="outofsync">Out of sync</button><button data-sync-select-resources="none">None</button></div></div>
        <div class="sync-resource-list">${resources.map((resource, index) => `<label class="sync-resource"><input type="checkbox" data-sync-resource="${index}" checked><span><b>${esc(resource.kind)}/${esc(resource.name)}</b><small>${esc(resource.namespace || '(cluster)')} · ${esc(resource.status || 'Unknown')}${resource.requiresPruning ? ' · requires pruning' : ''}</small></span></label>`).join('') || '<div class="drawer-empty">No managed resources returned.</div>'}</div>
        <div class="control-submit"><button class="button" data-control-close>Cancel</button><button class="button primary" data-sync-submit>Synchronize</button></div>
      </div>`;
    }

    async function submitSync(root) {
      const resources = (state.selected?.status?.resources || []).filter(item => !item.hook);
      const field = name => Boolean(root.querySelector(`[data-sync-field="${name}"]`)?.checked);
      const selectedResources = [...root.querySelectorAll('[data-sync-resource]:checked')].map(input => resources[Number(input.dataset.syncResource)]).filter(Boolean);
      if (!selectedResources.length) throw new Error('Select at least one resource to synchronize.');
      const allSelected = selectedResources.length === resources.length;
      const force = field('force');
      const replace = field('replace');
      const prune = field('prune');
      if (force && !confirm('Force sync bypasses graceful deletion and can cause data loss. Continue?')) return;
      if (replace && prompt('Replace deletes and recreates resources. Type “replace” to continue.') !== 'replace') return;
      if (prune && selectedResources.some(resource => resource.requiresPruning) && prompt('Prune will delete resources. Type “prune” to continue.') !== 'prune') return;
      const syncOptions = [];
      const addBoolean = (name, enabled, invert = false) => { if (enabled) syncOptions.push(`${name}=${invert ? 'false' : 'true'}`); };
      addBoolean('Validate', field('skipValidation'), true);
      addBoolean('CreateNamespace', field('createNamespace'));
      addBoolean('ApplyOutOfSyncOnly', field('applyOutOfSyncOnly'));
      addBoolean('RespectIgnoreDifferences', field('respectIgnoreDifferences'));
      addBoolean('ServerSideApply', field('serverSideApply'));
      addBoolean('PruneLast', field('pruneLast'));
      addBoolean('Replace', replace);
      syncOptions.push(`PrunePropagationPolicy=${root.querySelector('[data-sync-select="prunePropagation"]')?.value || 'foreground'}`);
      syncOptions.push(`Prune=${root.querySelector('[data-sync-select="pruneOption"]')?.value || 'true'}`);
      syncOptions.push(`Delete=${root.querySelector('[data-sync-select="deleteOption"]')?.value || 'true'}`);
      const retryStrategy = field('retry') ? {
        limit: Number(root.querySelector('[data-sync-retry="limit"]')?.value || 2),
        backoff: {
          duration: root.querySelector('[data-sync-retry="duration"]')?.value || '5s',
          maxDuration: root.querySelector('[data-sync-retry="maxDuration"]')?.value || '3m0s',
          factor: Number(root.querySelector('[data-sync-retry="factor"]')?.value || 2)
        }
      } : null;
      const body = {
        appNamespace: appNamespace(),
        revision: root.querySelector('[data-sync-revision]')?.value || currentRevision(),
        prune,
        dryRun: field('dryRun'),
        strategy: field('applyOnly') ? {apply: {force}} : {hook: {force}},
        resources: allSelected ? null : selectedResources.map(resource => ({group: resource.group || '', kind: resource.kind, namespace: resource.namespace || '', name: resource.name})),
        syncOptions: {items: syncOptions},
        retryStrategy
      };
      await api(appPath('/sync'), {method: 'POST', body: JSON.stringify(body)});
      Object.assign(ui, {panel: null, loading: false, data: null, error: ''});
      await reloadApp();
    }

    function diffPanel(data) {
      const entries = Array.isArray(data) ? data : data?.items || [];
      if (!entries.length) return '<div class="drawer-empty">No managed resource diff returned.</div>';
      return `<div class="app-diff-list">${entries.map(item => `<section class="app-diff-entry"><h4>${esc(item.kind || 'Resource')}/${esc(item.name || '')}</h4><div class="json-split"><div><b>Desired</b><pre class="json-view">${esc(pretty(item.targetState))}</pre></div><div><b>Live</b><pre class="json-view">${esc(pretty(item.liveState))}</pre></div></div></section>`).join('')}</div>`;
    }

    function historyPanel() {
      const history = [...(state.selected?.status?.history || [])].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      return `<div class="history-list">${history.map(item => `<div class="history-row"><div><b>Deployment ${esc(item.id)}</b><small>${esc(item.deployedAt || item.deployStartedAt || '')}</small><code>${esc((item.revision || item.revisions || []).toString())}</code></div><button class="button" data-rollback="${esc(item.id)}">Rollback</button></div>`).join('') || '<div class="drawer-empty">No deployment history returned.</div>'}</div>`;
    }

    function eventsPanel(data) {
      const entries = Array.isArray(data) ? data : data?.items || [];
      return `<div class="event-list">${entries.slice(0, 200).map(event => `<div class="event-row ${event?.type === 'Warning' ? 'warn' : ''}"><div><b>${esc(event?.reason || event?.type || 'Event')}</b><span>${esc(event?.message || '')}</span></div><small>${esc(event?.lastTimestamp || event?.eventTime || event?.firstTimestamp || '')}</small></div>`).join('') || '<div class="drawer-empty">No application events returned.</div>'}</div>`;
    }

    function manifestsPanel(data) {
      const manifests = data?.manifests || data?.items || [];
      return `<div class="manifest-list">${manifests.map((manifest, index) => `<section><h4>Manifest ${index + 1}</h4><pre class="json-view">${esc(pretty(manifest))}</pre></section>`).join('') || '<div class="drawer-empty">No manifests returned.</div>'}</div>`;
    }

    function conditionsPanel() {
      const conditions = state.selected?.status?.conditions || [];
      return `<div class="condition-list">${conditions.map(condition => `<div class="condition-row"><b>${esc(condition.type || 'Condition')}</b><span>${esc(condition.message || '')}</span><small>${esc(condition.lastTransitionTime || '')}</small></div>`).join('') || '<div class="drawer-empty">No application conditions.</div>'}</div>`;
    }

    function detailsPanel() {
      return `<div class="details-grid"><div class="kv"><span>Project</span><b>${esc(state.selected?.spec?.project || 'default')}</b></div><div class="kv"><span>Health</span>${badge(health(state.selected))}</div><div class="kv"><span>Sync</span>${badge(sync(state.selected))}</div><div class="kv"><span>Destination</span><b>${esc(state.selected?.spec?.destination?.namespace || '(cluster)')}</b></div></div><div class="json-section"><h4>Application</h4><pre class="json-view">${esc(pretty(state.selected))}</pre></div>`;
    }

    function operationPanel(value = state.selected?.status?.operationState) {
      return `<div class="details-grid"><div class="kv"><span>Phase</span><b>${esc(value?.phase || 'No operation')}</b></div><div class="kv"><span>Started</span><b>${esc(value?.startedAt || '—')}</b></div><div class="kv"><span>Finished</span><b>${esc(value?.finishedAt || '—')}</b></div></div><pre class="json-view">${esc(pretty(value))}</pre>${value?.phase === 'Running' && value === state.selected?.status?.operationState ? '<div class="control-submit"><button class="button danger" data-terminate-operation>Terminate operation</button></div>' : ''}`;
    }

    function deletePanel() {
      return `<div class="control-form"><div class="control-note danger-note">Deleting an Application can cascade to all managed resources. Choose the same propagation behavior exposed by Argo CD before confirming.</div>${checkbox('deleteCascade','Cascade delete managed resources',true)}<div class="control-field"><label>Propagation policy</label><select data-delete-propagation><option>foreground</option><option>background</option><option>orphan</option></select></div><div class="control-submit"><button class="button" data-control-close>Cancel</button><button class="button danger" data-delete-submit>Delete application</button></div></div>`;
    }

    function panelTitle() {
      return ({details:'Application details',diff:'Application diff',sync:'Synchronize',operation:'Sync status',hydration:'Hydration status',history:'History and rollback',events:'Events',manifests:'Manifests',conditions:'Conditions',delete:'Delete application'}[ui.panel] || 'Application controls');
    }

    function panel() {
      if (!ui.panel) return '';
      let body = '';
      if (ui.loading) body = '<div class="drawer-empty">Loading…</div>';
      else if (ui.error) body = `<div class="control-error">${esc(ui.error)}</div>`;
      else if (ui.panel === 'details') body = detailsPanel();
      else if (ui.panel === 'diff') body = diffPanel(ui.data);
      else if (ui.panel === 'sync') body = syncPanel();
      else if (ui.panel === 'operation') body = operationPanel();
      else if (ui.panel === 'hydration') body = operationPanel(state.selected?.status?.sourceHydrator?.currentOperation);
      else if (ui.panel === 'history') body = historyPanel();
      else if (ui.panel === 'events') body = eventsPanel(ui.data);
      else if (ui.panel === 'manifests') body = manifestsPanel(ui.data);
      else if (ui.panel === 'conditions') body = conditionsPanel();
      else if (ui.panel === 'delete') body = deletePanel();
      return `<aside class="app-control-panel" role="dialog" aria-modal="true" aria-label="${esc(panelTitle())}"><div class="app-control-head"><div><b>${esc(panelTitle())}</b><small>${esc(appName())}</small></div><button data-control-close aria-label="Close ${esc(panelTitle())}">×</button></div><div class="app-control-body">${body}</div></aside>`;
    }

    function toolbar() {
      const app = state.selected;
      if (!app) return '';
      const automated = app.spec?.syncPolicy?.automated && app.spec.syncPolicy.automated.enabled !== false;
      const operation = app.status?.operationState;
      const running = operation?.phase === 'Running';
      const history = app.status?.history || [];
      const hasSource = Boolean(app.spec?.source || app.spec?.sources?.length || app.spec?.sourceHydrator);
      const hydration = app.status?.sourceHydrator?.currentOperation;
      const confirmationNeeded = Boolean(app.status?.resources?.some(resource => resource.requiresDeletionConfirmation));
      const confirmationLabel = app.metadata?.deletionTimestamp ? 'Confirm deletion' : 'Confirm pruning';
      return `<div class="app-control-toolbar" aria-label="Application controls">
        <button class="button primary" data-app-control="sync" ${hasSource ? '' : 'disabled'}>Sync</button>
        <button class="button" data-app-control="details" ${hasSource ? '' : 'disabled'}>Details</button>
        <button class="button" data-app-control="diff" ${sync(app) === 'Synced' ? 'disabled' : ''}>Diff</button>
        <button class="button" data-auto-sync>${automated ? 'Disable' : 'Enable'} Auto-Sync</button>
        <button class="button" data-app-control="operation" ${operation ? '' : 'disabled'}>Sync Status</button>
        ${hydration ? '<button class="button" data-app-control="hydration">Hydration</button>' : ''}
        <button class="button" data-app-control="history" ${history.length || operation ? '' : 'disabled'}>History</button>
        <button class="button" data-app-control="events">Events</button>
        <button class="button" data-app-control="manifests" ${hasSource ? '' : 'disabled'}>Manifests</button>
        <button class="button" data-app-control="conditions">Conditions</button>
        <button class="button" data-refresh-mode="normal">Refresh</button>
        <button class="button" data-refresh-mode="hard">Hard Refresh</button>
        ${confirmationNeeded ? `<button class="button warn" data-approve-deletion>${confirmationLabel}</button>` : ''}
        ${running ? '<button class="button warn" data-terminate-operation>Terminate</button>' : ''}
        <button class="button danger" data-app-control="delete">Delete</button>
      </div>`;
    }

    function bind(root = state.root) {
      if (!root) return;
      root.querySelectorAll('[data-app-control]').forEach(button => button.addEventListener('click', () => {
        if (button.disabled) return;
        const panelName = button.dataset.appControl;
        if (['details','sync','operation','hydration','history','conditions','delete'].includes(panelName)) return setPanel(panelName);
        if (panelName === 'diff') return void loadPanel('diff', () => api(`${appPath('/managed-resources')}?${qs({appNamespace: appNamespace()})}`));
        if (panelName === 'events') return void loadPanel('events', () => api(`${appPath('/events')}?${qs({appNamespace: appNamespace()})}`));
        if (panelName === 'manifests') return void loadPanel('manifests', () => api(`${appPath('/manifests')}?${qs({name: appName(), revision: currentRevision(), appNamespace: appNamespace()})}`));
      }));
      root.querySelectorAll('[data-control-close]').forEach(button => button.addEventListener('click', closePanel));
      root.querySelector('[data-auto-sync]')?.addEventListener('click', () => void toggleAutoSync().catch(error => alert(`Auto-Sync update failed: ${error?.message || error}`)));
      root.querySelectorAll('[data-refresh-mode]').forEach(button => button.addEventListener('click', () => void refresh(button.dataset.refreshMode).catch(error => alert(`Refresh failed: ${error?.message || error}`))));
      root.querySelectorAll('[data-approve-deletion]').forEach(button => button.addEventListener('click', () => void approveDeletion().catch(error => alert(`Confirmation failed: ${error?.message || error}`))));
      root.querySelectorAll('[data-terminate-operation]').forEach(button => button.addEventListener('click', () => void terminateOperation().catch(error => alert(`Terminate failed: ${error?.message || error}`))));
      root.querySelectorAll('[data-rollback]').forEach(button => button.addEventListener('click', () => void rollback(button.dataset.rollback).catch(error => alert(`Rollback failed: ${error?.message || error}`))));
      root.querySelectorAll('[data-sync-select-resources]').forEach(button => button.addEventListener('click', () => {
        const mode = button.dataset.syncSelectResources;
        const resources = (state.selected?.status?.resources || []).filter(item => !item.hook);
        root.querySelectorAll('[data-sync-resource]').forEach(input => {
          const resource = resources[Number(input.dataset.syncResource)];
          input.checked = mode === 'all' || (mode === 'outofsync' && resource?.status === 'OutOfSync');
        });
      }));
      root.querySelector('[data-sync-submit]')?.addEventListener('click', () => void submitSync(root).catch(error => alert(`Sync failed: ${error?.message || error}`)));
      root.querySelector('[data-delete-submit]')?.addEventListener('click', () => {
        const cascade = Boolean(root.querySelector('[data-sync-field="deleteCascade"]')?.checked);
        const propagation = root.querySelector('[data-delete-propagation]')?.value || 'foreground';
        void deleteApplication(cascade, propagation).catch(error => alert(`Delete failed: ${error?.message || error}`));
      });
    }

    function reset() {
      Object.assign(ui, {panel: null, loading: false, data: null, error: ''});
    }

    const styles = `
      .app-control-toolbar{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}.button.warn{border-color:color-mix(in srgb,var(--warn) 55%,var(--border));color:var(--warn)}.button.danger{border-color:color-mix(in srgb,var(--bad) 60%,var(--border));color:var(--bad)}.button:disabled{opacity:.48;cursor:not-allowed}
      .app-control-panel{position:fixed;z-index:30;right:18px;top:72px;bottom:18px;width:min(760px,calc(100vw - 254px));overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:0 24px 70px rgba(1,4,9,.34);display:grid;grid-template-rows:auto minmax(0,1fr)}.app-control-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--panel)}.app-control-head>div{min-width:0;flex:1}.app-control-head b,.app-control-head small{display:block}.app-control-head small{color:var(--muted)}.app-control-head button{width:44px;height:44px;border:0;border-radius:8px;background:transparent;color:var(--text);font-size:22px;cursor:pointer}.app-control-head button:hover{background:var(--soft)}.app-control-body{overflow:auto;padding:14px;background:var(--panel)}
      .json-view{margin:7px 0 0;max-height:560px;overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:12px;font:11px/1.55 "SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;white-space:pre;tab-size:2}.json-section{margin-top:14px}.json-section h4,.app-diff-entry h4,.manifest-list h4,.control-form h4{margin:14px 0 7px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.json-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.app-diff-entry{padding:0 0 16px;border-bottom:1px solid var(--border)}.manifest-list section+section{margin-top:18px;border-top:1px solid var(--border);padding-top:4px}
      .control-form{display:grid;gap:12px}.control-grid{display:grid;gap:9px}.control-grid.checks{grid-template-columns:repeat(2,minmax(0,1fr))}.control-grid.thirds{grid-template-columns:repeat(3,minmax(0,1fr))}.control-grid.retry{grid-template-columns:140px repeat(4,minmax(0,1fr));align-items:end}.control-field{display:grid;gap:5px}.control-field label{font-size:11px;color:var(--muted);font-weight:650}.control-field input,.control-field select{width:100%;min-height:44px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:0 10px}.control-check{min-height:48px;display:flex;align-items:flex-start;gap:9px;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer}.control-check input{margin-top:4px;accent-color:var(--accent)}.control-check span{display:grid;gap:2px}.control-check small{color:var(--muted);font-size:11px}.resource-select-head{display:flex;align-items:center;gap:10px}.resource-select-head h4{margin:0}.resource-select-head>div{margin-left:auto;display:flex;gap:5px}.resource-select-head button{border:0;background:transparent;color:var(--accent);cursor:pointer}.sync-resource-list{max-height:290px;overflow:auto;border:1px solid var(--border);border-radius:8px}.sync-resource{display:flex;gap:9px;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer}.sync-resource:last-child{border:0}.sync-resource span{display:grid;gap:2px}.sync-resource small{color:var(--muted)}.control-submit{display:flex;justify-content:flex-end;gap:8px;padding-top:8px}.control-note{padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--muted)}.danger-note{border-color:color-mix(in srgb,var(--bad) 48%,var(--border));color:var(--bad)}.control-error{padding:12px;border:1px solid color-mix(in srgb,var(--bad) 50%,var(--border));border-radius:8px;color:var(--bad);background:color-mix(in srgb,var(--bad) 8%,var(--panel))}
      .history-list{display:grid}.history-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}.history-row>div{min-width:0;flex:1}.history-row b,.history-row small,.history-row code{display:block}.history-row small{color:var(--muted)}.history-row code{margin-top:3px;color:var(--text);overflow:hidden;text-overflow:ellipsis}.condition-list{display:grid;gap:8px}.condition-row{display:grid;gap:3px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg)}.condition-row span,.condition-row small{color:var(--muted)}
      .app.dark .app-control-panel,.app.dark .app-control-head,.app.dark .app-control-body{background:#0d1117;color:#f0f6fc}.app.dark .json-view,.app.dark .control-field input,.app.dark .control-field select,.app.dark .control-check,.app.dark .condition-row,.app.dark .sync-resource-list{background:#010409;color:#f0f6fc;border-color:#30363d;color-scheme:dark}
      @media(max-width:900px){.app-control-panel{right:8px;left:72px;width:auto;top:64px;bottom:8px}.control-grid.retry{grid-template-columns:1fr 1fr}.control-grid.thirds{grid-template-columns:1fr}.json-split{grid-template-columns:1fr}}@media(max-width:650px){.app-control-panel{left:6px;right:6px}.control-grid.checks,.control-grid.retry{grid-template-columns:1fr}}
    `;

    return {styles, toolbar, panel, bind, reset, normalizeJson, pretty};
  };
})();