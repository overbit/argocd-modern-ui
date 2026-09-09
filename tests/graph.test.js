import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../extension/full-graph.js');

const createGraph = tree => globalThis.__ARGOCD_FULL_GRAPH_FACTORY__({
  state: {tree},
  esc: value => String(value ?? ''),
  badge: value => String(value ?? ''),
  tone: () => 'muted',
  health: () => 'Unknown',
  sync: () => 'Unknown',
  rerender: () => {}
});

test('full topology ignores resource entries without a Kubernetes identity', () => {
  const graph = createGraph({
    nodes: [
      {kind: 'Deployment', name: 'api', namespace: 'default'},
      {kind: '', name: ''},
      {},
      null
    ],
    orphanedNodes: [
      {kind: 'Service', name: 'api', namespace: 'default'},
      {kind: 'Pod'}
    ]
  });

  assert.deepEqual(
    graph.resourceNodes().map(node => [node.kind, node.name, node.__orphaned]),
    [
      ['Deployment', 'api', false],
      ['Service', 'api', true]
    ]
  );
});

test('hybrid topology hides Argo decorative and empty indicator nodes', () => {
  const css = fs.readFileSync(new URL('../extension/graph.css', import.meta.url), 'utf8');
  assert.match(css, /application-resource-tree__filtered-indicator/);
  assert.match(css, /application-resource-tree__node:not\(\[title\]\):empty/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /visibility:\s*hidden\s*!important/);
  assert.match(css, /pointer-events:\s*none\s*!important/);
});
