import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const content = fs.readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8');

test('content runtime disposes itself when the extension context is invalidated', () => {
  assert.match(content, /function extensionContextAvailable\(\)/);
  assert.match(content, /function disposeExtensionContext\(\)/);
  assert.match(content, /routeObserver\?\.disconnect\(\)/);
  assert.match(content, /removeEventListener\('popstate', queueRender\)/);
  assert.match(content, /removeEventListener\('hashchange', queueRender\)/);
  assert.match(content, /removeEventListener\('pageshow', queueRender\)/);
  assert.match(content, /__ARGOCD_MODERN_UI_CONTENT__ = false/);
});

test('content runtime catches async render and storage failures instead of leaking rejected promises', () => {
  assert.match(content, /void render\(\)\.catch\(handleRuntimeError\)/);
  assert.match(content, /await chrome\.storage\.local\.get\(DEFAULT_SETTINGS\)/);
  assert.match(content, /catch \(error\) \{\s*handleRuntimeError\(error\);/s);
  assert.doesNotMatch(content, /void chrome\.storage\.local\.set/);
  assert.match(content, /void setStoredSettings\(/);
});
