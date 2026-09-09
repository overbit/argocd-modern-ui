# Argo CD Modern UI

A Chromium Manifest V3 extension that provides redesigned **Hybrid** and **Full replacement** experiences for Argo CD while retaining explicit user-controlled escape modes.

Compatibility target: **Argo CD 3.5.x**.

## Interface modes

### Original

Argo CD is left untouched. No redesign attributes or replacement shell remain mounted.

### Hybrid

Hybrid restyles Argo CD's native React UI while retaining Argo's routing, authentication, RBAC and behavior. The resource DAG gets a compact dotted canvas, clearer edges, issue-aware status treatment and improved dark-mode contrast.

Resource details now follow Argo UI's actual `SlidingPanel` layering: the resource pane remains opaque/readable while the outside layer is a transparent 30% dimmer. The underlying topology therefore stays visible when a resource is open instead of being covered by an opaque full-screen surface.

### Full

Full mounts an independent Shadow-DOM application over Argo CD and uses the browser's existing authenticated same-origin session.

**Full mode does not embed, iframe, or route individual features through the original Argo CD UI.** Standard Argo CD 3.5.x controls are implemented through authenticated REST/EventSource/WebSocket calls. **Hybrid UI** and **Original UI** remain explicit mode switches only; they are not used to claim Full feature parity.

Current Full UI includes:

- application dashboard, search, health/sync summaries and diagram-first detail
- Application create/edit/delete using direct Application object controls
- ApplicationSets list, create/edit/delete and generate preview
- Tree, Network, Pods and List resource views
- pan, zoom, fit-to-view, Focus issues and relationship highlighting
- compact inactive resource grouping with expandable groups
- visual deploy preview for Create/Update/Remove operations
- live topology tracking during sync/resource actions
- recursively prettified structured JSON for manifests, application state and operations
- resource summary, live/desired manifests, diff, events, links and parameterized resource actions
- workload-wide logs across Deployment, ReplicaSet, Pod and Pod-template resources, including init/app/ephemeral containers
- advanced log controls: container, tail, since, filter, match case, previous logs and follow streaming
- direct Pod terminal over Argo CD's authenticated `/terminal` WebSocket endpoint
- resource sync and resource delete with foreground/background/orphan propagation and managed-resource confirmation
- complete application action toolbar: Details, Diff, Sync, Auto-Sync, Sync Status, Hydration, History/Rollback, Events, Manifests, Conditions, Refresh, Hard Refresh, prune/deletion confirmation, Terminate and Delete
- advanced application sync: revision, Prune, Dry Run, Apply Only, Force, per-resource selection, retry/backoff, validation, namespace creation, OutOfSync-only, ignore-difference, server-side apply, Prune Last, propagation, per-resource prune/delete behavior and Replace
- repository and write-repository CRUD plus force refresh
- repository and write-repository credential templates
- certificate and GPG key administration
- cluster update/delete/cache invalidation
- project CRUD, complete AppProject object editing, project events/links and role JWT token create/delete
- account token create/delete and current-user password change
- Appearance, User Info and Help/version surfaces
- explicit **Hybrid UI** and **Original UI** escape switches

Dynamically registered third-party Argo UI extensions are not represented as Full parity by embedding their original frontend. Full parity refers to the standard Argo CD 3.5.x controls implemented by this extension.

No Argo CD credentials are copied into extension storage.

See [`docs/PARITY.md`](docs/PARITY.md) for the direct implementation matrix.

## Theme and design

Both redesigned modes support **System**, **Light**, and **Dark** independently of Argo CD's own theme selection.

Dark mode applies `color-scheme: dark` and explicitly covers page/layout surfaces, cards, tables, resource details, tabs, editors, dialogs, menus, selects, native form controls, code views and log viewers. Full's Shadow-DOM components use the same tokenized dark palette so browser controls and replacement surfaces cannot fall back to light defaults.

The design is GitHub-inspired with n8n-like topology interactions:

- GitHub-like canvas, border, text, accent, success, warning and danger tokens
- compact developer-tool density
- flat borders and restrained shadows
- system UI font stack
- dotted topology canvas, connection ports, pan/zoom and contextual inspectors
- operational health/sync state remains visually dominant

## URL and authentication safety

- Supports Argo CD at an origin root or path prefix such as `https://example.com/argocd`.
- Requests optional host access only for the configured Argo CD origin.
- Activates only inside the configured path boundary.
- Stores only extension configuration locally.
- Stores no Argo CD password, token, cookie, username, repository secret, cluster credential or terminal data.
- Full uses the already-authenticated browser session for same-origin REST, EventSource and WebSocket traffic.

## Install locally

1. Clone or download this repository.
2. Open `chrome://extensions` or the equivalent Chromium extensions page.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select `extension/`.
6. Save the Argo CD URL in the extension popup and approve that origin.
7. Select **Hybrid** or **Full** and choose **System**, **Light**, or **Dark**.

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
  manifest.json                   Manifest V3 permissions and entry points
  background.js                   Dynamic host-scoped content-script registration
  settings.js                     URL, mode, theme and local settings helpers
  content.js                      Mode activation, theme resolution and route awareness
  full-ui.js                      Full replacement shell and top-level routing
  full-route.js                   Opens direct application routes in Full topology
  full-direct.js                  Direct CRUD, settings, logs and WebSocket terminal surfaces
  full-direct-patch.js            Direct-route compatibility repair
  full-admin-extra.js             Credential templates, project JWTs and admin parity controls
  full-controls.js                Application actions, advanced sync and lifecycle controls
  full-changeflow.js              Deploy preview and live action-change visualization
  full-graph.js                   Interactive Full topology and resource inspector
  full-graph-base.js              Preserves the base graph factory for direct adapters
  full-graph-direct-adapter.js    Direct resource controls/status adapter
  full-graph-styles.js            Full topology/inspector presentation
  modern.css                      Root-gated Hybrid redesign
  github-theme.css                Hybrid light/dark tokens and SlidingPanel treatment
  graph.css                       Hybrid resource graph treatment
  popup.html / popup.js / popup.css

tests/
  settings.test.js
  graph.test.js
  full-controls.test.js
  parity.test.js
  theme.test.js
  changeflow.test.js

docs/
  ARCHITECTURE.md
  DESIGN.md
  PARITY.md
```

## Compatibility

Hybrid selectors and Full API/WebSocket behavior are aligned to Argo CD **v3.5.2** source. Full does not depend on an embedded copy of the upstream frontend; version-specific API changes should therefore be covered by compatibility tests before changing the stated target.