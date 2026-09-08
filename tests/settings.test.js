import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOriginPattern,
  isUrlWithinConfiguredBase,
  normalizeArgoUrl,
  normalizeTheme,
  normalizeUiMode
} from '../extension/settings.js';

test('normalizeArgoUrl strips query, hash, credentials and trailing slash', () => {
  assert.equal(
    normalizeArgoUrl(' https://user:pass@example.com/argocd///?x=1#section '),
    'https://example.com/argocd'
  );
});

test('normalizeArgoUrl allows root-hosted Argo CD', () => {
  assert.equal(normalizeArgoUrl('https://argocd.example.com/'), 'https://argocd.example.com');
});

test('normalizeArgoUrl rejects unsupported protocols', () => {
  assert.throws(() => normalizeArgoUrl('file:///tmp/argocd'), /Only http:\/\/ and https:\/\//);
});

test('getOriginPattern grants only the configured origin', () => {
  assert.equal(getOriginPattern('https://argocd.example.com/platform/argocd'), 'https://argocd.example.com/*');
});

test('root-hosted configuration matches any path on the same origin', () => {
  assert.equal(isUrlWithinConfiguredBase('https://argocd.example.com/applications/foo', 'https://argocd.example.com'), true);
  assert.equal(isUrlWithinConfiguredBase('https://other.example.com/applications/foo', 'https://argocd.example.com'), false);
});

test('path-hosted configuration matches only the configured path boundary', () => {
  const base = 'https://example.com/argocd';
  assert.equal(isUrlWithinConfiguredBase('https://example.com/argocd', base), true);
  assert.equal(isUrlWithinConfiguredBase('https://example.com/argocd/applications/foo', base), true);
  assert.equal(isUrlWithinConfiguredBase('https://example.com/argocd2/applications/foo', base), false);
  assert.equal(isUrlWithinConfiguredBase('https://example.com/other', base), false);
});

test('normalizeUiMode supports original, hybrid, and full', () => {
  assert.equal(normalizeUiMode('original'), 'original');
  assert.equal(normalizeUiMode('hybrid'), 'hybrid');
  assert.equal(normalizeUiMode('full'), 'full');
});

test('normalizeUiMode migrates the legacy enabled flag', () => {
  assert.equal(normalizeUiMode(undefined, false), 'original');
  assert.equal(normalizeUiMode(undefined, true), 'hybrid');
});

test('normalizeTheme supports system, light, and dark with a safe default', () => {
  assert.equal(normalizeTheme('system'), 'system');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('unknown'), 'system');
});
