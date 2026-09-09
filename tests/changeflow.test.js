import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const graph = fs.readFileSync(new URL('../extension/full-graph.js', import.meta.url), 'utf8');
const changeflow = fs.readFileSync(new URL('../extension/full-changeflow.js', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../extension/full-route.js', import.meta.url), 'utf8');

test('application resource view defaults and resets to the tree diagram', () => {
  assert.match(graph, /mode:\s*'tree'/);
  assert.match(graph, /Object\.assign\(view, \{mode:\s*'tree'/);
  assert.match(graph, /\['tree',\s*'Tree'\]/);
});

test('deploy preview compares managed live and desired resources', () => {
  assert.match(changeflow, /managed-resources\?appNamespace=/);
  assert.match(changeflow, /return 'create'/);
  assert.match(changeflow, /return 'delete'/);
  assert.match(changeflow, /return 'update'/);
  assert.match(changeflow, /Preview deploy/);
  assert.match(changeflow, /Deploy \$\{flow\.plan\.size\} change/);
});

test('diagram observes deploy and resource actions after they start', () => {
  assert.match(changeflow, /data-sync/);
  assert.match(changeflow, /data-resource-sync/);
  assert.match(changeflow, /data-resource-delete/);
  assert.match(changeflow, /data-resource-action/);
  assert.match(changeflow, /operationState\?\.phase/);
  assert.match(changeflow, /changeflow-path/);
});

test('direct application routes open the custom topology instead of remaining on the app list', () => {
  assert.match(route, /path\.startsWith\('\/applications\/'\)/);
  assert.match(route, /root\.querySelector\('\.topology-panel'\)/);
  assert.match(route, /querySelectorAll\('\[data-app\]'\)/);
  assert.match(route, /target\?\.click\(\)/);
});
