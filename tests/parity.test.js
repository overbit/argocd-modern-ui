import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../extension/full-graph.js');
await import('../extension/full-graph-base.js');
await import('../extension/full-direct.js');
await import('../extension/full-direct-patch.js');
await import('../extension/full-admin-extra.js');
await import('../extension/full-graph-direct-adapter.js');

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

test('direct admin layer covers repository credentials, project JWTs and ApplicationSet preview', () => {
  const source = fs.readFileSync(new URL('../extension/full-admin-extra.js', import.meta.url), 'utf8');
  for (const token of [
    '/api/v1/repocreds',
    '/api/v1/write-repocreds',
    'forceRefresh=true',
    '/roles/',
    '/token',
    '/events',
    '/links',
    '/api/v1/applicationsets/generate'
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('full graph merges application resource status by Kubernetes identity without stringifying graph data', () => {
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
  const nodes = graph.resourceNodes();
  assert.ok(Array.isArray(nodes));
  const [node] = nodes;
  assert.equal(node.status, 'OutOfSync');
  assert.equal(node.health.status, 'Degraded');
});

test('full graph direct adapter exposes foreground background and orphan resource deletion', () => {
  const source = fs.readFileSync(new URL('../extension/full-graph-direct-adapter.js', import.meta.url), 'utf8');
  assert.match(source, /foreground/);
  assert.match(source, /background/);
  assert.match(source, /orphan/);
  assert.match(source, /force:\s*String\(mode === 'background'\)/);
  assert.match(source, /orphan:\s*String\(mode === 'orphan'\)/);
  assert.match(source, /Type .* to confirm deletion|Type “\$\{node\.name\}” to confirm deletion/);
});

test('runtime loads direct controls and admin adapter before the corrected graph adapter', () => {
  const background = fs.readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
  const popup = fs.readFileSync(new URL('../extension/popup.js', import.meta.url), 'utf8');
  const order = /full-graph\.js['"],\s*['"]full-graph-base\.js['"],\s*['"]full-direct\.js['"],\s*['"]full-direct-patch\.js['"],\s*['"]full-admin-extra\.js['"],\s*['"]full-graph-direct-adapter\.js['"],\s*['"]full-controls\.js['"],\s*['"]full-changeflow\.js['"],\s*['"]full-ui\.js['"],\s*['"]full-route\.js['"],\s*['"]content\.js/;
  for (const source of [background, popup]) {
    assert.match(source, order);
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

test('direct repository route patch repairs both repository create routes', () => {
  const patch = fs.readFileSync(new URL('../extension/full-direct-patch.js', import.meta.url), 'utf8');
  assert.match(patch, /settings\/write-repos/);
  assert.match(patch, /settings\/repos/);
  assert.match(patch, /\?create=1/);
});