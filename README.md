# Argo CD Modern UI

A private Chromium Manifest V3 extension that modernizes the Argo CD UI while keeping Argo CD's native React components, routing, authentication, RBAC, dialogs, logs, terminals, and actions underneath.

Initial target: **Argo CD 3.5.x**.

## What it does

- Restyles the full Argo CD surface: navigation, application lists, status panels, resource views, settings, forms, tables, modals, tabs, and logs.
- Supports Argo CD hosted at an origin root or a path prefix such as `https://example.com/argocd`.
- Requests optional host access only for the configured Argo CD origin.
- Stores configuration locally in the browser.
- Uses the existing authenticated Argo CD browser session. It stores no Argo CD credentials or tokens.
- Provides an immediate **Original UI** fallback from both the extension popup and the Argo CD page.
- Adds **Focus issues** on application detail routes to de-emphasize resources that Argo CD reports as both Healthy and Synced.
- Supports Chromium browsers using Manifest V3.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` (or the equivalent extensions page in Edge/Brave).
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension/` directory.
6. Open the extension popup, enter your Argo CD URL, and choose **Save**.
7. Approve access to that Argo CD origin.

The modern UI activates only inside the configured URL/path.

## Switching back to native Argo CD

Use either:

- the **Modern interface** switch in the extension popup, or
- the floating **Original UI** control in Argo CD.

The extension does not replace Argo CD's runtime. Switching off modern mode removes the root styling attribute and restores the original presentation immediately.

## Development

No runtime or build dependencies are required.

```bash
npm run check
npm run package
```

`npm run package` creates `argocd-modern-ui.zip` from the loadable `extension/` directory.

## Repository structure

```text
extension/
  manifest.json      Manifest V3 permissions and entry points
  background.js      Dynamic host-scoped content-script registration
  settings.js        URL normalization and local settings
  content.js         Mode activation, route awareness, safe fallback controls
  modern.css         Root-gated Argo CD 3.5.x redesign
  popup.html         URL settings and UI-mode toggle
  popup.js
  popup.css

tests/
  settings.test.js   URL/path/permission boundary tests

docs/
  ARCHITECTURE.md
  DESIGN.md
```

## Security model

The manifest declares HTTP/HTTPS access as **optional**, not automatically granted. The browser asks for access only after the user saves an Argo CD URL. The dynamic content script is registered only for the granted origin, and the content script performs a second path-prefix check before activating the UI.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

## Compatibility

This first version is based on Argo CD v3.5.2 UI structure. Patch releases should be low-risk because the extension keeps native components in place, but upstream class-name or layout changes can still affect styling. The native UI fallback is therefore a first-class feature rather than an afterthought.
