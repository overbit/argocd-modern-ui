import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../extension/full-graph.js');

const tone = value => ['Healthy', 'Synced'].includes(value) ? 'ok' : ['Degraded', 'Missing', 'Failed'].includes(value) ? 'bad' : ['Progressing', 'OutOfSync'].includes(value) ? 'warn' : 'muted';
const createGraph = (tree, selected = {metadata: {name: 'demo', namespace: 'argocd'}, status: {health: {status: 'Healthy'}, sync: {status: 'Synced'}, resources: []}}) => globalThis.__ARGOCD_FULL_GRAPH_FACTORY__({
  state: {tree, selected},
  esc: value => String(value ?? ''),
  badge: value => String(value ?? ''),
  tone,
  health: app => app?.status?.health?.status || 'Unknown',
  sync: app => app?.status?.sync?.status || 'Unknown',
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

test('full tree groups same-kind inactive leaf siblings while keeping active branches visible', () => {
  const healthy = {health: {status: 'Healthy'}, status: 'Synced'};
  const graph = createGraph({
    nodes: [
      {uid: 'dep', kind: 'Deployment', name: 'api', namespace: 'default', ...healthy},
      {uid: 'rs-old-1', kind: 'ReplicaSet', name: 'api-111', namespace: 'default', parentRefs: [{uid: 'dep'}], ...healthy},
      {uid: 'rs-old-2', kind: 'ReplicaSet', name: 'api-222', namespace: 'default', parentRefs: [{uid: 'dep'}], ...healthy},
      {uid: 'rs-active', kind: 'ReplicaSet', name: 'api-333', namespace: 'default', parentRefs: [{uid: 'dep'}], ...healthy},
      {uid: 'pod-active', kind: 'Pod', name: 'api-333-abc', namespace: 'default', parentRefs: [{uid: 'rs-active'}], ...healthy}
    ],
    orphanedNodes: []
  });

  const markup = graph.content();
  assert.match(markup, /data-group=/);
  assert.match(markup, />2 ReplicaSets</);
  assert.doesNotMatch(markup, /api-111/);
  assert.doesNotMatch(markup, /api-222/);
  assert.match(markup, /api-333/);
  assert.match(markup, /api-333-abc/);
});

test('full tree does not hide resources that need attention inside compact groups', () => {
  const graph = createGraph({
    nodes: [
      {uid: 'dep', kind: 'Deployment', name: 'api', namespace: 'default', health: {status: 'Healthy'}, status: 'Synced'},
      {uid: 'rs-healthy', kind: 'ReplicaSet', name: 'api-healthy', namespace: 'default', parentRefs: [{uid: 'dep'}], health: {status: 'Healthy'}, status: 'Synced'},
      {uid: 'rs-bad', kind: 'ReplicaSet', name: 'api-bad', namespace: 'default', parentRefs: [{uid: 'dep'}], health: {status: 'Degraded'}, status: 'Synced'}
    ],
    orphanedNodes: []
  });

  const markup = graph.content();
  assert.doesNotMatch(markup, /data-group=/);
  assert.match(markup, /api-healthy/);
  assert.match(markup, /api-bad/);
});

test('full compact groups are expandable and can be collapsed again', () => {
  const source = fs.readFileSync(new URL('../extension/full-graph.js', import.meta.url), 'utf8');
  assert.match(source, /data-group=/);
  assert.match(source, /view\.expandedGroups\.add/);
  assert.match(source, /data-collapse-groups/);
  assert.match(source, /view\.expandedGroups\.clear\(\)/);
});

test('full logs discover every Deployment, ReplicaSet and Pod container', () => {
  const graph = createGraph({nodes: [], orphanedNodes: []});
  const workload = {
    live: {
      spec: {
        template: {
          spec: {
            initContainers: [{name: 'init'}],
            containers: [{name: 'api'}, {name: 'sidecar'}],
            ephemeralContainers: [{name: 'debug'}]
          }
        }
      }
    }
  };
  assert.deepEqual(graph.containerNames({kind: 'Deployment'}, workload), ['init', 'api', 'sidecar', 'debug']);
  assert.deepEqual(graph.containerNames({kind: 'ReplicaSet'}, workload), ['init', 'api', 'sidecar', 'debug']);
  assert.deepEqual(graph.containerNames({kind: 'Pod'}, {live: {spec: {containers: [{name: 'pod-main'}, {name: 'pod-sidecar'}]}}}), ['pod-main', 'pod-sidecar']);
});

test('full logs expose all-container workload aggregation and parameterized resource actions', () => {
  const source = fs.readFileSync(new URL('../extension/full-graph.js', import.meta.url), 'utf8');
  assert.match(source, /All containers/);
  assert.match(source, /node\.kind === 'Pod' \? \{podName: node\.name\} : \{group: node\.group \|\| '', kind: node\.kind, resourceName: node\.name\}/);
  assert.match(source, /Promise\.allSettled\(requests\)/);
  assert.match(source, /resourceActionParameters/);
  assert.doesNotMatch(source, /Opens native parameter form/);
});

test('hybrid topology hides Argo decorative and empty indicator nodes', () => {
  const css = fs.readFileSync(new URL('../extension/graph.css', import.meta.url), 'utf8');
  assert.match(css, /application-resource-tree__filtered-indicator/);
  assert.match(css, /application-resource-tree__node:not\(\[title\]\):empty/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /visibility:\s*hidden\s*!important/);
  assert.match(css, /pointer-events:\s*none\s*!important/);
});
