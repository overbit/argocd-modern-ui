# Argo CD Modern UI

A private Chromium Manifest V3 extension that adds two redesigned Argo CD experiences while retaining an immediate native fallback.

Compatibility target: **Argo CD 3.5.x**.

## Interface modes

### Original

Argo CD is left untouched. No redesign attributes or replacement shell remain mounted.

### Hybrid

Restyles Argo CD's native React UI while retaining its routing, authentication, RBAC, dialogs, logs, terminals, extensions, and actions underneath. The native resource DAG gets an n8n-inspired dotted canvas, rounded resource nodes, connection handles, clearer edges, issue-aware borders, and improved dark-mode contrast. Application details also expose **Focus issues** to de-emphasize Healthy + Synced resources.

### Full

Mounts an independent Shadow-DOM application over Argo CD and uses the authenticated same-origin Argo CD session.

Full mode now uses a **two-layer parity model**:

1. Purpose-built replacement surfaces for the workflows where the extension can improve usability directly.
2. An in-Full, same-origin native parity surface for advanced Argo CD workflows that must preserve the exact upstream RBAC, confirmation, terminal, log, extension, and form behavior.

The user stays in Full mode for both layers.

Current Full UI includes:

- application dashboard with health/sync overview and search
- ApplicationSets overview
- interactive application topology with Tree, Network, Pods, and List resource views
- drag-to-pan, wheel/trackpad pan, Ctrl/Command + wheel zoom, zoom buttons, and fit-to-view
- Focus issues and selected-neighbor highlighting
- interactive resource inspector with summary, live/desired manifests, diff, events, logs, resource actions, resource sync, and delete flows where supported by Argo CD's API
- application sync action
- **Controls & details** tab for the complete upstream application detail experience without leaving Full mode
- complete application create/edit/delete and advanced operations through the in-Full parity surface
- ApplicationSet detail parity
- complete Settings parity: repositories, certificates, GPG keys, clusters, projects, accounts, and appearance
- User Info and Help parity
- full native workspace for dynamically registered Argo CD extension screens and any advanced upstream workflow not yet replaced directly
- one-click **Hybrid UI** and **Original UI** escape paths

The parity surface is an authenticated same-origin Argo CD frame. No Argo CD credentials are copied into extension storage, and advanced destructive workflows continue to use Argo CD's own RBAC-aware dialogs and validation.

See [`docs/PARITY.md`](docs/PARITY.md) for the feature-by-feature coverage model.

## Theme and design

Both redesigned modes support **System**, **Light**, and **Dark** themes independently of the theme selected inside Argo CD.

The visual system is deliberately GitHub-inspired, with n8n-inspired topology interaction patterns:

- GitHub-like canvas, border, text, accent, success, warning, and danger tokens
- compact developer-tool density
- flat borders and restrained shadows
- system UI font stack
- dotted topology canvas, connection ports, pan/zoom, selectable nodes, and contextual inspectors
- operational health/sync state remains visually dominant

## URL and authentication safety

- Supports Argo CD hosted at an origin root or a path prefix such as `https://example.com/argocd`.
- Requests optional host access only for the configured Argo CD origin.
- Stores configuration locally in the browser.
- Stores no Argo CD password, token, cookie, username, or other credential.
- Full mode uses the already-authenticated browser session for same-origin API calls and parity frames.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` or the equivalent Chromium extensions page.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the repository's `extension/` directory.
6. Open the extension popup and save your Argo CD URL.
7. Approve access to that origin.
8. Select **Hybrid** or **Full**, then choose **System**, **Light**, or **Dark**.

The extension activates only inside the configured URL/path.

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
  manifest.json          Manifest V3 permissions and entry points
  background.js          Dynamic host-scoped content-script registration
  settings.js            URL, mode, theme, and local settings helpers
  content.js             Mode activation, theme resolution, route awareness, fallbacks
  full-ui.js             Full replacement shell and top-level routing
  full-native.js         In-Full native parity surface and graph parity adapter
  full-graph.js          Interactive Full topology and resource inspector
  full-graph-styles.js   Full topology/inspector presentation
  modern.css             Root-gated Hybrid redesign
  github-theme.css       GitHub-inspired Hybrid light/dark override layer
  graph.css              n8n-inspired Hybrid resource graph treatment
  popup.html             Instance, mode, and theme settings
  popup.js
  popup.css

tests/
  settings.test.js       URL/path/settings migration tests
  graph.test.js          Graph placeholder/resource validation
  parity.test.js         Full parity routing and injection tests

docs/
  ARCHITECTURE.md
  DESIGN.md
  PARITY.md
```

## Compatibility

The Hybrid stylesheet targets selectors confirmed in Argo CD v3.5.2. Full custom surfaces use stable `/api/v1` endpoints where practical. The parity surface runs the configured Argo CD instance itself inside the Full shell, so advanced workflows continue to use the exact upstream implementation for the installed Argo CD version.
