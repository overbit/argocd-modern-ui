import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../extension/full-graph.js');
await import('../extension/full-direct.js');

const createDirect = baseUrl => globalThis.__ARGOCD_FULL_DIRECT_FACTORY__({
  state: {baseUrl, root: null, theme: 'dark'},
  esc: value => String(value ?? '')
});

test('full direct surface preserves a path-prefixed Argo CD base URL', () => {
  const direct = createDirect('https://argocd.example.com/platform/argocd');
  assert.equal(direct.urlFor('/settings/projects'), 'https://argocd.example.com/platform/argocd/settings/projects');
  assert.equal(direct.urlFor('applications/default/demo'), 'https://argocd.example.com/platform/argocd/applications/default/demo');
});

test('full direct surfaces never embed the original Argo CD frontend', () => {
  const direct = createDirect('https://argocd.example.com');
  const markup = direct.frame('/applications/default/demo', {title: 'Demo controls'});
  assert.match(markup, /data-direct-surface/);
  assert.doesNotMatch(markup, /<iframe/i);
  assert.doesNotMatch(markup, /data-native-frame/i);
});

test('full direct control module includes CRUD, logs and terminal implementations', () => {
  const source = fs.readFileSync(new URL('../extension/full-direct.js', import.meta.url), 'utf8');
  for (const token of [
    '/api/v1/applications',
    '/api/v1/applicationsets',
    '/api/v1/projects',
    '/api/v1/repositories',
    '/api/v1/write-repositories',
    '/api/v1/clusters',
    '/api/v1/certificates',
    '/api/v1/gpgkeys',
    '/api/v1/account',
    '/api/v1/session/userinfo',
    '/terminal',
    'new WebSocket',
    'new EventSource'
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /<iframe/i);
});

test('full graph merges application resource status by Kubernetes identity rather than UID', () => {
  const state = {
    baseUrl: 'https://argocd.example.com',
    root: null,
    selected: {
      metadata: {name: 'demo', namespace: 'argocd'},
      status: {
        resources: [{group: 'apps', kind: 'Deployment', namespace: 'default', name: 'api', status: 'OutOfSync', health: {status: 'Degraded'}}]
      }
    },
    tree: {
      nodes: [{uid: 'deployment-uid', group: 'apps', kind: 'Deployment', namespace: 'default', name: 'api', health: {status: 'Healthy'}, parentRefs: []}],
      orphanedNodes: []
    }
  };
  const graph = globalThis.__ARGOCD_FULL_GRAPH_FACTORY__({
    state,
    esc: value => String(value ?? ''),
    badge: value => String(value ?? ''),
    tone: () => 'muted',
    health: () => 'Unknown',
    sync: () => 'Unknown',
    rerender: () => {}
  });
  const [node] = graph.resourceNodes();
  assert.equal(node.status, 'OutOfSync');
  assert.equal(node.health.status, 'Degraded');
});

test('runtime loads direct controls before controls and the Full shell in both injection paths', () => {
  const background = fs.readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
  const popup = fs.readFileSync(new URL('../extension/popup.js', import.meta.url), 'utf8');
  for (const source of [background, popup]) {
    assert.match(source, /full-graph\.js['"],\s*['"]full-direct\.js['"],\s*['"]full-controls\.js['"],\s*['"]full-changeflow\.js['"],\s*['"]full-ui\.js['"],\s*['"]full-route\.js['"],\s*['"]content\.js/);
    assert.doesNotMatch(source, /full-native\.js/);
  }
});

test('full UI exposes direct application controls without a native fallback tab or iframe', () => {
  const fullUi = fs.readFileSync(new URL('../extension/full-ui.js', import.meta.url), 'utf8');
  assert.match(fullUi, /__ARGOCD_FULL_DIRECT_FACTORY__/);
  assert.match(fullUi, /__ARGOCD_FULL_CONTROLS_FACTORY__/);
  assert.match(fullUi, /controls\?\.toolbar\(\)/);
  assert.match(fullUi, /controls\?\.panel\(\)/);
  assert.match(fullUi, /data-view="settings"/);
  assert.match(fullUi, /data-view="user-info"/);
  assert.match(fullUi, /data-view="help"/);
  assert.match(fullUi, /Controls & spec/);
  assert.doesNotMatch(fullUi, /Native fallback/);
  assert.doesNotMatch(fullUi, /<iframe/i);
});