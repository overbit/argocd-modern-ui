# Argo CD Modern UI

A private Chromium Manifest V3 extension that adds two redesigned Argo CD experiences while retaining an immediate native fallback.

Compatibility target: **Argo CD 3.5.x**.

## Interface modes

### Original

Argo CD is left untouched. No redesign attributes or replacement shell remain mounted.

### Hybrid

Restyles Argo CD's native React UI while retaining its routing, authentication, RBAC, dialogs, logs, terminals, extensions, and actions underneath. The native resource DAG gets an n8n-inspired dotted canvas, rounded resource nodes, connection handles, clearer edges, issue-aware borders, and improved dark-mode contrast. Application details also expose **Focus issues** to de-emphasize Healthy + Synced resources.

When a resource drawer is open, Hybrid keeps a high-opacity translucent surface instead of an opaque card so the topology remains visible underneath without reducing drawer readability.

### Full

Mounts an independent Shadow-DOM application over Argo CD and uses the authenticated same-origin Argo CD session.

Full mode uses a **replacement-first parity model**:

1. Purpose-built replacement surfaces implement application and resource controls directly where Argo CD exposes stable authenticated APIs.
2. A same-origin native fallback remains only for browser-terminal behavior, dynamically registered extensions, version-specific forms, and other installed-version functionality that cannot be reproduced without weakening Argo CD behavior.

Current Full UI includes:

- application dashboard with health/sync overview and search
- ApplicationSets overview
- **diagram-first application details**: direct application URLs and application selections open the custom topology instead of leaving the user on a resource list
- interactive application topology with Tree, Network, Pods, and List resource views
- drag-to-pan, wheel/trackpad pan, Ctrl/Command + wheel zoom, zoom buttons, and fit-to-view
- Focus issues and selected-neighbor highlighting
- **native-style compact grouping** in Tree view: same-kind inactive leaf siblings are collapsed into one aggregate node, while active branches and resources needing attention stay visible; click a group to expand it and use **Collapse groups** to compact the tree again
- **visual deploy preview** that compares desired and live state and marks resources as Create, Update, or Remove before sync
- dependency-path highlighting for resources affected by the deploy plan
- live diagram tracking while deploy, resource sync, delete, reset/restart-style custom actions, and other resource actions run; affected nodes update as Argo CD reports changes
- recursive JSON normalization: API fields containing JSON strings are decoded before rendering so manifests, desired/live state, application state, and operation data are shown as formatted structured JSON instead of escaped JSON strings
- resource inspector with summary, prettified live/desired manifests, diff, events, resource links, parameterized custom actions, sync, delete, logs, and terminal fallback
- workload-wide logs for **Deployment**, **ReplicaSet**, **Pod**, and other Pod-template resources: Full discovers init/app/ephemeral containers, offers **All containers**, and aggregates matching Pod log streams with `[pod/container]` source prefixes
- direct application controls matching the Argo CD 3.5.x action menu: **Details, Diff, Sync, Auto-Sync, Sync Status, Hydration status, History/Rollback, Events, Manifests, Conditions, Refresh, Hard Refresh, pruning/deletion confirmation, Terminate, and Delete**
- advanced Full sync form with Prune, Dry Run, Apply Only, Force, revision, per-resource selection, retry/backoff, validation, namespace creation, OutOfSync-only, ignore-difference, server-side apply, Prune Last, propagation, resource prune/delete behavior, and Replace options
- direct rollback including Auto-Sync disable when required by Argo CD
- direct application cascade/non-cascade deletion and propagation selection
- ApplicationSet detail parity
- complete Settings parity: repositories, certificates, GPG keys, clusters, projects, accounts, and appearance
- User Info and Help parity
- full native workspace for dynamically registered Argo CD extension screens and installed-version workflows not safely replaceable through stable APIs
- one-click **Hybrid UI** and **Original UI** escape paths

No Argo CD credentials are copied into extension storage. Full mode uses the browser's existing same-origin authenticated session for API calls and fallback frames.

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
- action overlays use the graph itself to explain operational change: green Create, amber Update, red Remove, animated in-progress paths, and settled resource state after the action
- Full mode propagates its selected light/dark scheme into same-origin fallback frames, including native panels, dialogs, forms, code/log viewers, tables, menus, and resource drawers, preventing light surfaces from leaking into a dark Full workspace

## URL and authentication safety

- Supports Argo CD hosted at an origin root or a path prefix such as `https://example.com/argocd`.
- Requests optional host access only for the configured Argo CD origin.
- Stores configuration locally in the browser.
- Stores no Argo CD password, token, cookie, username, or other credential.
- Full mode uses the already-authenticated browser session for same-origin API calls and fallback frames.

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
  full-route.js          Makes direct application routes open the custom topology first
  full-native.js         In-Full native fallback surface, theme synchronization, graph adapter
  full-controls.js       Direct application actions, advanced sync, history/rollback, lifecycle controls
  full-changeflow.js     Deploy preview and live action-change visualization
  full-graph.js          Interactive Full topology, structured resource inspector, workload logs/actions
  full-graph-styles.js   Full topology/inspector presentation
  modern.css             Root-gated Hybrid redesign
  github-theme.css       GitHub-inspired Hybrid themes and translucent resource drawer
  graph.css              n8n-inspired Hybrid resource graph treatment
  popup.html             Instance, mode, and theme settings
  popup.js
  popup.css

tests/
  settings.test.js       URL/path/settings migration tests
  graph.test.js          Graph grouping, resource validation, workload log coverage
  full-controls.test.js  Direct controls, advanced sync, nested JSON normalization
  parity.test.js         Full fallback routing and injection tests
  theme.test.js          Full dark-mode propagation and Hybrid translucency tests
  changeflow.test.js     Diagram-first and operational-change visualization tests

docs/
  ARCHITECTURE.md
  DESIGN.md
  PARITY.md
```

## Compatibility

The Hybrid stylesheet targets selectors confirmed in Argo CD v3.5.2. Full custom surfaces use stable `/api/v1` endpoints where practical. Native fallback surfaces run the configured Argo CD instance itself inside the Full shell for browser-terminal behavior, dynamic extensions, and installed-version workflows that must remain upstream-owned.
