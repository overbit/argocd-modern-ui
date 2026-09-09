(() => {
  if (globalThis.__ARGOCD_FULL_CHANGEFLOW_ADAPTED__ || !globalThis.__ARGOCD_FULL_GRAPH_FACTORY__) return;
  globalThis.__ARGOCD_FULL_CHANGEFLOW_ADAPTED__ = true;

  const graphFactory = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__;

  globalThis.__ARGOCD_FULL_GRAPH_FACTORY__ = options => {
    const {state, esc, rerender} = options;
    const graph = graphFactory(options);
    const flow = {
      phase: 'idle',
      action: '',
      message: '',
      plan: new Map(),
      targets: new Set(),
      before: new Map(),
      observed: new Map(),
      timer: null,
      attempts: 0,
      failure: ''
    };

    const identity = resource => [resource?.group || '', resource?.kind || '', resource?.namespace || '', resource?.name || ''].join('|');
    const graphKey = resource => resource?.uid || identity(resource);
    const baseUrl = () => String(state.baseUrl || '').replace(/\/+$/, '');
    const appName = () => state.selected?.metadata?.name || '';
    const appNamespace = () => state.selected?.metadata?.namespace || '';
    const parseState = value => {
      if (!value) return null;
      if (typeof value !== 'string') return value;
      try { return JSON.parse(value); } catch { return value; }
    };
    const stableString = value => {
      const parsed = parseState(value);
      if (parsed === null || parsed === undefined) return '';
      if (typeof parsed === 'string') return parsed;
      try { return JSON.stringify(parsed); } catch { return String(parsed); }
    };
    const request = async (path, requestOptions = {}) => {
      const response = await fetch(`${baseUrl()}${path}`, {
        credentials: 'include',
        headers: {Accept: 'application/json', ...(requestOptions.body ? {'Content-Type': 'application/json'} : {})},
        ...requestOptions
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.status === 204 ? null : response.json();
    };

    const styles = `
      .changeflow-bar{display:flex;align-items:center;gap:10px;min-height:58px;padding:9px 12px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--panel) 92%,var(--bg));flex-wrap:wrap}
      .changeflow-copy{display:grid;gap:1px;min-width:220px}.changeflow-copy b{font-size:12px}.changeflow-copy span{font-size:11px;color:var(--muted)}
      .changeflow-stats{display:flex;gap:6px;flex-wrap:wrap}.changeflow-chip{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 8px;border:1px solid var(--border);border-radius:999px;background:var(--panel);font-size:11px;font-weight:650}.changeflow-chip i{width:7px;height:7px;border-radius:50%;background:var(--muted)}.changeflow-chip.create i{background:var(--ok)}.changeflow-chip.update i{background:var(--warn)}.changeflow-chip.delete i{background:var(--bad)}.changeflow-chip.running i{background:var(--accent)}
      .changeflow-actions{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}.changeflow-button{min-height:38px;padding:6px 11px;border:1px solid var(--border);border-radius:6px;background:var(--panel);color:var(--text);font-weight:650;cursor:pointer}.changeflow-button:hover{background:var(--soft)}.changeflow-button.primary{background:var(--green);border-color:transparent;color:#fff}.changeflow-button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .changeflow-status{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)}.changeflow-status i{width:9px;height:9px;border-radius:50%;background:var(--accent)}.changeflow-status.failed i{background:var(--bad)}.changeflow-status.complete i{background:var(--ok)}
      .topology-node.change-create,.pod-card.change-create,.resource-button.change-create{border-color:var(--ok)!important}.topology-node.change-update,.pod-card.change-update,.resource-button.change-update{border-color:var(--warn)!important}.topology-node.change-delete,.pod-card.change-delete,.resource-button.change-delete{border-color:var(--bad)!important;border-style:dashed!important}.topology-node.change-running,.pod-card.change-running,.resource-button.change-running{border-color:var(--accent)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent),var(--node-shadow)!important}.topology-node.change-complete,.pod-card.change-complete,.resource-button.change-complete{border-color:var(--ok)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--ok) 16%,transparent)!important}.topology-node.change-failed,.pod-card.change-failed,.resource-button.change-failed{border-color:var(--bad)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--bad) 16%,transparent)!important}
      .changeflow-tag{position:absolute;right:7px;top:6px;max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 5px;border:1px solid var(--border);border-radius:999px;background:var(--panel);font-size:9px;font-weight:750;text-transform:uppercase;letter-spacing:.03em;z-index:2}.changeflow-tag.create{color:var(--ok)}.changeflow-tag.update{color:var(--warn)}.changeflow-tag.delete{color:var(--bad)}.changeflow-tag.running{color:var(--accent)}.changeflow-tag.complete{color:var(--ok)}.changeflow-tag.failed{color:var(--bad)}
      .topology-edge.changeflow-path{stroke:var(--accent)!important;stroke-width:3!important;opacity:1!important}.topology-viewport.changeflow-preview .topology-edge:not(.changeflow-path){opacity:.18}.topology-viewport.changeflow-running .changeflow-path{stroke-dasharray:8 7;animation:argocd-changeflow-edge 1.1s linear infinite}
      @keyframes argocd-changeflow-edge{to{stroke-dashoffset:-30}}
      @media(max-width:760px){.changeflow-actions{margin-left:0;width:100%}.changeflow-actions .changeflow-button{flex:1}.changeflow-copy{min-width:0;flex:1}}
      @media(prefers-reduced-motion:reduce){.topology-viewport.changeflow-running .changeflow-path{animation:none}}
    `;

    function snapshot() {
      const result = new Map();
      for (const node of graph.resourceNodes()) {
        result.set(identity(node), {
          health: node?.health?.status || 'Unknown',
          sync: node?.status || 'Unknown',
          resourceVersion: node?.resourceVersion || '',
          uid: node?.uid || ''
        });
      }
      return result;
    }

    function planKind(item, node) {
      const live = parseState(item?.liveState);
      const target = parseState(item?.targetState);
      if (node?.requiresPruning || (live && !target)) return 'delete';
      if (!live && target) return 'create';
      if (node?.status === 'OutOfSync') return 'update';
      if (stableString(item?.predictedLiveState) && stableString(item?.predictedLiveState) !== stableString(item?.normalizedLiveState || item?.liveState)) return 'update';
      return 'stable';
    }

    function clearTimer() {
      if (flow.timer) clearTimeout(flow.timer);
      flow.timer = null;
    }

    function clearFlow() {
      clearTimer();
      Object.assign(flow, {
        phase: 'idle', action: '', message: '', plan: new Map(), targets: new Set(),
        before: new Map(), observed: new Map(), attempts: 0, failure: ''
      });
    }

    function planCounts() {
      const counts = {create: 0, update: 0, delete: 0};
      for (const kind of flow.plan.values()) if (counts[kind] !== undefined) counts[kind]++;
      return counts;
    }

    async function previewDeploy() {
      flow.phase = 'loading';
      flow.action = 'Deploy preview';
      flow.message = 'Comparing desired and live resources…';
      flow.failure = '';
      rerender();
      try {
        const response = await request(`/api/v1/applications/${encodeURIComponent(appName())}/managed-resources?appNamespace=${encodeURIComponent(appNamespace())}`);
        const managed = Array.isArray(response) ? response : response?.items || [];
        const nodes = graph.resourceNodes();
        const nodeByIdentity = new Map(nodes.map(node => [identity(node), node]));
        const plan = new Map();
        for (const item of managed) {
          const id = identity(item);
          const kind = planKind(item, nodeByIdentity.get(id));
          if (kind !== 'stable') plan.set(id, kind);
        }
        for (const node of nodes) {
          const id = identity(node);
          if (!plan.has(id) && node?.status === 'OutOfSync') plan.set(id, node?.requiresPruning ? 'delete' : 'update');
        }
        flow.plan = plan;
        flow.targets = new Set(plan.keys());
        flow.phase = 'preview';
        flow.message = plan.size ? 'The diagram now shows the resources that will change.' : 'Argo CD reports no resource changes to deploy.';
      } catch (error) {
        flow.phase = 'failed';
        flow.failure = String(error?.message || error);
        flow.message = 'Unable to build the deploy preview.';
      }
      rerender();
    }

    function actionTargetsFromPlan() {
      if (flow.plan.size) return new Set(flow.plan.keys());
      return new Set(graph.resourceNodes().filter(node => node?.status === 'OutOfSync').map(identity));
    }

    function selectedIdentity() {
      const selected = state.root?.querySelector('.topology-node.selected[data-node],.pod-card.selected[data-node],.resource-button.selected[data-node]');
      if (!selected) return '';
      const selectedKey = decodeURIComponent(selected.dataset.node || '');
      return identity(graph.resourceNodes().find(node => graphKey(node) === selectedKey));
    }

    function compareSnapshots(before, after, targets) {
      const observed = new Map();
      const ids = new Set([...targets, ...before.keys(), ...after.keys()]);
      for (const id of ids) {
        const previous = before.get(id);
        const current = after.get(id);
        if (!previous && current) observed.set(id, 'complete');
        else if (previous && !current) observed.set(id, 'complete');
        else if (previous && current && (previous.health !== current.health || previous.sync !== current.sync || previous.resourceVersion !== current.resourceVersion)) observed.set(id, current.sync === 'Synced' && !['Degraded', 'Missing'].includes(current.health) ? 'complete' : 'running');
        else if (targets.has(id)) observed.set(id, current?.sync === 'Synced' && !['Progressing', 'Degraded', 'Missing'].includes(current?.health) ? 'complete' : 'running');
      }
      return observed;
    }

    async function refreshApplication() {
      const namespace = appNamespace();
      const query = namespace ? `?appNamespace=${encodeURIComponent(namespace)}` : '';
      const name = encodeURIComponent(appName());
      [state.selected, state.tree] = await Promise.all([
        request(`/api/v1/applications/${name}${query}`),
        request(`/api/v1/applications/${name}/resource-tree${query}`)
      ]);
    }

    function finishObservedAction(phase, message) {
      clearTimer();
      flow.phase = phase;
      flow.message = message;
      rerender();
    }

    function scheduleObservation() {
      clearTimer();
      flow.timer = setTimeout(async () => {
        flow.attempts++;
        try {
          await refreshApplication();
          const after = snapshot();
          flow.observed = compareSnapshots(flow.before, after, flow.targets);
          const operationPhase = state.selected?.status?.operationState?.phase || '';
          const allSettled = flow.targets.size > 0 && [...flow.targets].every(id => flow.observed.get(id) === 'complete');
          if (['Failed', 'Error'].includes(operationPhase)) {
            finishObservedAction('failed', `${flow.action} failed in Argo CD.`);
            return;
          }
          if (operationPhase === 'Succeeded' || allSettled || flow.attempts >= 18) {
            const completed = [...flow.observed.values()].filter(value => value === 'complete').length;
            finishObservedAction('complete', `${flow.action} finished. ${completed || flow.targets.size} affected resource${(completed || flow.targets.size) === 1 ? '' : 's'} highlighted.`);
            return;
          }
          rerender();
          scheduleObservation();
        } catch (error) {
          if (flow.attempts >= 18) {
            finishObservedAction('failed', `Unable to follow ${flow.action.toLowerCase()}: ${error?.message || error}`);
            return;
          }
          scheduleObservation();
        }
      }, 1800);
    }

    function beginObservedAction(action, targets, message = '') {
      clearTimer();
      flow.phase = 'running';
      flow.action = action;
      flow.message = message || `${action} is running. The diagram will update as resources change.`;
      flow.targets = new Set([...targets].filter(Boolean));
      flow.before = snapshot();
      flow.observed = new Map([...flow.targets].map(id => [id, 'running']));
      flow.attempts = 0;
      flow.failure = '';
      rerender();
      scheduleObservation();
    }

    async function deployPlan() {
      const targets = actionTargetsFromPlan();
      if (!targets.size) return;
      if (!confirm(`Deploy ${targets.size} planned resource change${targets.size === 1 ? '' : 's'}?`)) return;
      beginObservedAction('Deploy', targets, `Deploying ${targets.size} planned resource change${targets.size === 1 ? '' : 's'}…`);
      try {
        await request(`/api/v1/applications/${encodeURIComponent(appName())}/sync`, {
          method: 'POST',
          body: JSON.stringify({appNamespace: appNamespace()})
        });
      } catch (error) {
        finishObservedAction('failed', `Deploy failed: ${error?.message || error}`);
      }
    }

    function flowBar() {
      if (flow.phase === 'idle') {
        return `<div class="changeflow-bar"><div class="changeflow-copy"><b>Understand before you deploy</b><span>Compare desired vs live state and highlight the exact resources and dependency paths that will change.</span></div><div class="changeflow-actions"><button class="changeflow-button" data-changeflow-preview>Preview deploy</button></div></div>`;
      }
      if (flow.phase === 'loading') {
        return `<div class="changeflow-bar"><div class="changeflow-status"><i></i><span>${esc(flow.message)}</span></div></div>`;
      }
      const counts = planCounts();
      const chips = `<div class="changeflow-stats"><span class="changeflow-chip create"><i></i>Create ${counts.create}</span><span class="changeflow-chip update"><i></i>Update ${counts.update}</span><span class="changeflow-chip delete"><i></i>Remove ${counts.delete}</span></div>`;
      if (flow.phase === 'preview') {
        return `<div class="changeflow-bar"><div class="changeflow-copy"><b>Deploy plan</b><span>${esc(flow.message)}</span></div>${chips}<div class="changeflow-actions"><button class="changeflow-button" data-changeflow-clear>Clear</button>${flow.plan.size ? `<button class="changeflow-button primary" data-changeflow-deploy>Deploy ${flow.plan.size} change${flow.plan.size === 1 ? '' : 's'}</button>` : ''}</div></div>`;
      }
      const statusClass = flow.phase === 'failed' ? 'failed' : flow.phase === 'complete' ? 'complete' : '';
      return `<div class="changeflow-bar"><div class="changeflow-status ${statusClass}"><i></i><span><b>${esc(flow.action || 'Action')}</b> · ${esc(flow.message || flow.failure)}</span></div>${flow.plan.size ? chips : ''}<div class="changeflow-actions">${flow.phase !== 'running' ? '<button class="changeflow-button" data-changeflow-clear>Dismiss</button><button class="changeflow-button" data-changeflow-preview>Preview current drift</button>' : ''}</div></div>`;
    }

    function edgeIdentities(mode) {
      const resources = graph.resourceNodes();
      const byKey = new Map(resources.flatMap(node => [[graphKey(node), identity(node)], [identity(node), identity(node)]]));
      const edges = [];
      if (mode === 'network') {
        for (const node of resources) {
          for (const target of node.networkingInfo?.targetRefs || []) {
            const to = byKey.get(target?.uid || identity(target));
            if (to) edges.push([identity(node), to]);
          }
        }
        if (edges.length) return edges;
      }
      const incoming = new Map(resources.map(node => [identity(node), 0]));
      for (const node of resources) {
        for (const parent of node.parentRefs || []) {
          const from = byKey.get(parent?.uid || identity(parent));
          if (from) {
            edges.push([from, identity(node)]);
            incoming.set(identity(node), (incoming.get(identity(node)) || 0) + 1);
          }
        }
      }
      for (const node of resources) if (!node.__orphaned && (incoming.get(identity(node)) || 0) === 0) edges.push(['__app__', identity(node)]);
      return edges;
    }

    function decorate() {
      const root = state.root;
      if (!root) return;
      const nodes = graph.resourceNodes();
      const identityByKey = new Map(nodes.flatMap(node => [[graphKey(node), identity(node)], [identity(node), identity(node)]]));
      const activeIds = flow.phase === 'preview' ? new Set(flow.plan.keys()) : new Set([...flow.targets, ...flow.observed.keys()]);
      root.querySelectorAll('[data-node]').forEach(element => {
        const key = decodeURIComponent(element.dataset.node || '');
        const id = identityByKey.get(key);
        if (!id) return;
        const plan = flow.plan.get(id);
        const observed = flow.observed.get(id);
        const kind = flow.phase === 'preview' ? plan : observed || (flow.targets.has(id) && flow.phase === 'running' ? 'running' : '');
        ['create','update','delete','running','complete','failed'].forEach(value => element.classList.remove(`change-${value}`));
        element.querySelector('.changeflow-tag')?.remove();
        if (!kind) return;
        element.classList.add(`change-${kind}`);
        if (element.classList.contains('topology-node')) {
          const label = kind === 'delete' ? 'Remove' : kind[0].toUpperCase() + kind.slice(1);
          const tag = document.createElement('span');
          tag.className = `changeflow-tag ${kind}`;
          tag.textContent = label;
          element.appendChild(tag);
        }
      });

      const viewport = root.querySelector('[data-topology-viewport]');
      if (!viewport) return;
      viewport.classList.toggle('changeflow-preview', flow.phase === 'preview');
      viewport.classList.toggle('changeflow-running', flow.phase === 'running');
      const mode = root.querySelector('[data-resource-view].active')?.dataset.resourceView || 'tree';
      const edges = edgeIdentities(mode);
      root.querySelectorAll('.topology-edge').forEach((path, index) => {
        const edge = edges[index];
        path.classList.toggle('changeflow-path', Boolean(edge && (activeIds.has(edge[0]) || activeIds.has(edge[1]))));
      });
    }

    function captureDirectActions() {
      const root = state.root;
      if (!root) return;
      root.querySelector('[data-sync]')?.addEventListener('click', () => {
        if (flow.phase !== 'running') beginObservedAction('Deploy', actionTargetsFromPlan(), 'Argo CD sync started. Following resource changes…');
      }, {capture: true});
      root.querySelector('[data-resource-sync]')?.addEventListener('click', () => {
        const id = selectedIdentity();
        if (id) beginObservedAction('Resource sync', new Set([id]));
      }, {capture: true});
      root.querySelector('[data-resource-delete]')?.addEventListener('click', () => {
        const id = selectedIdentity();
        if (id) beginObservedAction('Resource delete', new Set([id]), 'Following the resource removal and dependent status changes…');
      }, {capture: true});
      root.querySelectorAll('[data-resource-action]').forEach(button => button.addEventListener('click', () => {
        const id = selectedIdentity();
        if (!id) return;
        const label = button.dataset.resourceAction || 'Resource action';
        beginObservedAction(label[0].toUpperCase() + label.slice(1), new Set([id]), `Following changes caused by ${label}…`);
      }, {capture: true}));
    }

    function bind() {
      graph.bind();
      const root = state.root;
      root?.querySelector('[data-changeflow-preview]')?.addEventListener('click', () => void previewDeploy());
      root?.querySelector('[data-changeflow-deploy]')?.addEventListener('click', () => void deployPlan());
      root?.querySelector('[data-changeflow-clear]')?.addEventListener('click', () => { clearFlow(); rerender(); });
      captureDirectActions();
      decorate();
    }

    function reset() {
      graph.reset();
      if (flow.phase !== 'running') clearFlow();
    }

    return {
      ...graph,
      styles: `${graph.styles || ''}${styles}`,
      toolbar: (...args) => `${graph.toolbar(...args)}${flowBar()}`,
      bind,
      reset
    };
  };
})();
