import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('full native parity synchronizes the selected light or dark theme into embedded Argo surfaces', () => {
  const source = fs.readFileSync(new URL('../extension/full-native.js', import.meta.url), 'utf8');
  assert.match(source, /argocdModernEmbeddedTheme/);
  assert.match(source, /data-argocd-modern-embedded-theme=\\?"dark\\?"/);
  assert.match(source, /color-scheme:dark/);
  assert.match(source, /background:#010409/);
  assert.match(source, /\.sliding-panel/);
  assert.match(source, /\.argo-modal__content/);
  assert.match(source, /applyTheme/);
});

test('full custom UI declares matching color schemes for form and browser-native controls', () => {
  const source = fs.readFileSync(new URL('../extension/full-ui.js', import.meta.url), 'utf8');
  assert.match(source, /color-scheme:light/);
  assert.match(source, /color-scheme:dark/);
  assert.match(source, /\.app\.dark input/);
});

test('hybrid resource drawer remains translucent so the underlying topology stays visible', () => {
  const css = fs.readFileSync(new URL('../extension/github-theme.css', import.meta.url), 'utf8');
  assert.match(css, /data-argocd-modern-mode="hybrid"\]\s+\.sliding-panel/);
  assert.match(css, /color-mix\(in srgb, var\(--amu-surface-raised\) 94%, transparent\)/);
  assert.match(css, /backdrop-filter:\s*saturate\(112%\)/);
});
