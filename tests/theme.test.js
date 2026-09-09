import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('full direct controls are tokenized for light and dark without embedded native surfaces', () => {
  const source = fs.readFileSync(new URL('../extension/full-direct.js', import.meta.url), 'utf8');
  assert.match(source, /\.app\.dark \.direct-surface/);
  assert.match(source, /background:#010409/);
  assert.match(source, /color-scheme:dark/);
  assert.match(source, /\.direct-json-editor/);
  assert.match(source, /\.direct-terminal/);
  assert.doesNotMatch(source, /<iframe/i);
});

test('full custom UI declares matching color schemes for form and browser-native controls', () => {
  const source = fs.readFileSync(new URL('../extension/full-ui.js', import.meta.url), 'utf8');
  assert.match(source, /color-scheme:light/);
  assert.match(source, /color-scheme:dark/);
  assert.match(source, /\.app\.dark input/);
  assert.match(source, /\.app\.dark \.panel/);
});

test('hybrid dark theme overrides common Argo surfaces that otherwise retain light defaults', () => {
  const css = fs.readFileSync(new URL('../extension/github-theme.css', import.meta.url), 'utf8');
  for (const selector of ['.tabs__content', '.select__control', '.argo-modal__content', '.sliding-panel__wrapper', '.code-editor', '.pod-logs-viewer']) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(css, /color-scheme:\s*dark\s*!important/);
});

test('hybrid resource drawer matches Argo SlidingPanel: dim transparent outside layer and opaque pane', () => {
  const css = fs.readFileSync(new URL('../extension/github-theme.css', import.meta.url), 'utf8');
  assert.match(css, /data-argocd-modern-mode="hybrid"\]\s+\.sliding-panel\s*\{[^}]*background-color:\s*rgba\(0,\s*0,\s*0,\s*\.30\)/s);
  assert.match(css, /data-argocd-modern-mode="hybrid"\]\s+\.sliding-panel__wrapper,[\s\S]*background-color:\s*var\(--amu-surface-raised\)\s*!important/);
  assert.match(css, /\.sliding-panel__outside\s*\{[^}]*background:\s*transparent\s*!important/s);
  assert.doesNotMatch(css, /var\(--amu-surface-raised\) 94%, transparent/);
  assert.doesNotMatch(css, /backdrop-filter:\s*saturate\(/);
});