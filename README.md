# Argo CD Modern UI

A private Chromium Manifest V3 extension that adds two redesigned Argo CD experiences while retaining an immediate native fallback.

Initial compatibility target: **Argo CD 3.5.x**.

## Interface modes

### Original

Argo CD is left untouched. No redesign attributes or replacement shell remain mounted.

### Hybrid

Restyles Argo CD's native React UI while retaining its routing, authentication, RBAC, dialogs, logs, terminals, extensions, and actions underneath. The native resource DAG gets an n8n-inspired dotted canvas, rounded resource nodes, connection handles, clearer edges, issue-aware borders, and improved dark-mode contrast. Application details also expose **Focus issues** to de-emphasize Healthy + Synced resources.

### Full

Mounts an independent Shadow-DOM application over Argo CD and reads from the authenticated same-origin Argo CD REST API. The current Full UI includes:

- application dashboard with health/sync overview and search
- ApplicationSets overview
- application details with an interactive left-to-right resource topology plus List fallback
- drag-to-pan, wheel/trackpad pan, Ctrl/Command + wheel zoom, zoom buttons, and fit-to-view
- Focus issues, selected-neighbor highlighting, and a resource details drawer
- application sync action
- projects, clusters, and repositories settings overview
- one-click **Hybrid UI** and **Original UI** escape paths

Full mode intentionally sends administrative mutations that are not yet reproduced safely back to Hybrid mode. This keeps Argo CD's native RBAC-aware confirmation flows authoritative rather than cloning them prematurely.

## Theme and design

Both redesigned modes support **System**, **Light**, and **Dark** themes independently of the theme selected inside Argo CD.

The visual system is deliberately GitHub-inspired:

- GitHub-like canvas, border, text, accent, success, warning, and danger tokens
- 6px control/card radii
- compact developer-tool density
- flat borders and restrained shadows
- system UI font stack
- operational health/sync state remains visually dominant

## URL and authentication safety

- Supports Argo CD hosted at an origin root or a path prefix such as `https://example.com/argocd`.
- Requests optional host access only for the configured Argo CD origin.
- Stores configuration locally in the browser.
- Stores no Argo CD password, token, cookie, username, or other credential.
- Full mode uses the already-authenticated browser session for same-origin API calls.

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
  manifest.json      Manifest V3 permissions and entry points
  background.js      Dynamic host-scoped content-script registration
  settings.js        URL, mode, theme, and local settings helpers
  content.js         Mode activation, theme resolution, route awareness, fallbacks
  full-ui.js         Independent Full replacement UI and Argo CD REST client
  modern.css         Root-gated Hybrid redesign
  github-theme.css   GitHub-inspired Hybrid light/dark override layer
  graph.css          n8n-inspired Hybrid resource graph treatment
  popup.html         Instance, mode, and theme settings
  popup.js
  popup.css

tests/
  settings.test.js   URL/path/settings migration tests

docs/
  ARCHITECTURE.md
  DESIGN.md
```

## Compatibility

The Hybrid stylesheet targets selectors confirmed in Argo CD v3.5.2. Full mode depends primarily on stable `/api/v1` Argo CD endpoints rather than the native DOM, reducing selector coupling but increasing API-compatibility responsibility. Both modes retain a first-class native fallback.
