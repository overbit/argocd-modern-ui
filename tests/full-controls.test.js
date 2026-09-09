import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../extension/full-controls.js');

const state = {
  selected: {
    metadata: {name: 'demo', namespace: 'argocd'},
    spec: {
      project: 'default',
      source: {repoURL: 'https://example.com/repo.git', targetRevision: 'main'},
      syncPolicy: {syncOptions: []}
    },
    status: {
      sync: {status: 'OutOfSync', revision: 'abc123'},
      health: {status: 'Healthy'},
      resources: [{group: 'apps', kind: 'Deployment', namespace: 'default', name: 'api', status: 'OutOfSync'}],
      operationState: {phase: 'Succeeded'},
      history: [{id: 1, revision: 'abc123'}]
    }
  }
};

const controls = globalThis.__ARGOCD_FULL_CONTROLS_FACTORY__({
  state,
  api: async () => ({}),
  esc: value => String(value ?? ''),
  badge: value => String(value ?? ''),
  health: app => app?.status?.health?.status || 'Unknown',
  sync: app => app?.status?.sync?.status || 'Unknown',
  rerender: () => {},
  reloadApp: async () => {}
});

test('full JSON renderer recursively decodes JSON strings before pretty printing', () => {
  const input = {
    manifest: '{"kind":"Pod","metadata":{"annotations":"{\\"example\\":true}"}}',
    targetState: '[{"name":"api"}]'
  };
  assert.deepEqual(controls.normalizeJson(input), {
    manifest: {kind: 'Pod', metadata: {annotations: {example: true}}},
    targetState: [{name: 'api'}]
  });
  const output = controls.pretty(input);
  assert.match(output, /"kind": "Pod"/);
  assert.doesNotMatch(output, /\\"kind\\"/);
});

test('full application toolbar exposes the core native application actions', () => {
  const markup = controls.toolbar();
  for (const label of ['Sync', 'Details', 'Diff', 'Auto-Sync', 'Sync Status', 'History', 'Events', 'Manifests', 'Conditions', 'Refresh', 'Hard Refresh', 'Delete']) {
    assert.match(markup, new RegExp(label.replace('-', '\\-')));
  }
});

test('full sync control implements original manual flags, sync options, retry and resource selection', () => {
  const source = fs.readFileSync(new URL('../extension/full-controls.js', import.meta.url), 'utf8');
  for (const token of [
    "checkbox('prune','Prune')",
    "checkbox('dryRun','Dry Run')",
    "checkbox('applyOnly','Apply Only')",
    "checkbox('force','Force'",
    'Validate',
    'CreateNamespace',
    'ApplyOutOfSyncOnly',
    'RespectIgnoreDifferences',
    'ServerSideApply',
    'PruneLast',
    'PrunePropagationPolicy',
    'Replace',
    'retryStrategy',
    'data-sync-select-resources'
  ]) assert.ok(source.includes(token), `expected full-controls.js to include ${token}`);
});
