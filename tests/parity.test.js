import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../extension/full-graph.js');
await import('../extension/full-native.js');

const createNative = baseUrl => globalThis.__ARGOCD_FULL_NATIVE_FACTORY__({
  state: {baseUrl, root: null},
  esc: value => String(value ?? '')
});

test('full parity surface preserves a path-prefixed Argo CD base URL', () => {
  const native = createNative('https://argocd.example.com/platform/argocd');
  assert.equal(
    native.urlFor('/settings/projects'),
    'https://argocd.example.com/platform/argocd/settings/projects'
  );
  assert.equal(
    native.urlFor('applications/default/demo'),
    'https://argocd.example.com/platform/argocd/applications/default/demo'
  );
});

test('full parity surface defaults to compact native chrome', () => {
  const native = createNative('https://argocd.example.com');
  const markup = native.frame('/applications/default/demo', {title: 'Demo controls'});
  assert.match(markup, /data-native-chrome="compact"/);
  assert.match(markup, /src="https:\/\/argocd\.example\.com\/applications\/default\/demo"/);
});

test('full parity surface can expose the complete native workspace', () => {
  const native = createNative('https://argocd.example.com');
  const markup = native.frame('/applications', {title: 'All features', fullChrome: true});
  assert.match(markup, /data-native-chrome="full"/);
});

test('full graph merges application resource status by Kubernetes identity rather than UID', () => {
  const state = {
    baseUrl: 'https://argocd.example.com',
    root: null,
    selected: {
      metadata: {name: 'demo', namespace: 'argocd'},
      status: {
        resources: [{
          group: 'apps',
          kind: 'Deployment',
          namespace: 'default',
          name: 'api',
          status: 'OutOfSync',
          health: {status: 'Degraded'}
        }]
      }
    },
    tree: {
      nodes: [{
        uid: 'deployment-uid',
        group: 'apps',
        kind: 'Deployment',
        namespace: 'default',
        name: 'api',
        health: {status: 'Healthy'},
        parentRefs: []
      }],
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

test('runtime loads parity, changeflow, diagram routing, then content in both injection paths', () => {
  const background = fs.readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
  const popup = fs.readFileSync(new URL('../extension/popup.js', import.meta.url), 'utf8');
  for (const source of [background, popup]) {
    assert.match(source, /full-graph\.js['"],\s*['"]full-native\.js['"],\s*['"]full-changeflow\.js['"],\s*['"]full-ui\.js['"],\s*['"]full-route\.js['"],\s*['"]content\.js/);
  }
});

test('full UI exposes native parity sections and application controls tab', () => {
  const fullUi = fs.readFileSync(new URL('../extension/full-ui.js', import.meta.url), 'utf8');
  assert.match(fullUi, /data-view="settings"/);
  assert.match(fullUi, /data-view="user-info"/);
  assert.match(fullUi, /data-view="help"/);
  assert.match(fullUi, /data-app-tab="controls"/);
  assert.match(fullUi, /All Argo CD features/);
});
