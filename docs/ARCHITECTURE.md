# Architecture

## Goals

1. Offer Original, Hybrid and Full UI modes for Argo CD 3.5.x.
2. Request access only to the user-configured Argo CD origin/path.
3. Keep authentication inside the existing Argo CD browser session.
4. Make user-selected escape to Hybrid or Original immediate.
5. Implement standard Argo CD controls directly in Full mode rather than embedding the original frontend.
6. Keep topology interaction first-class in both redesigned modes.
7. Keep dark/light theme selection consistent across every surface.

## Runtime modes

### Original

`content.js` removes redesign attributes, Hybrid controls and the Full replacement host. Argo CD is untouched.

### Hybrid

```text
Argo CD native React application
  + data-argocd-modern="true"
  + data-argocd-modern-mode="hybrid"
  + data-argocd-modern-theme="light|dark"
  + modern.css + github-theme.css + graph.css
  + isolated Shadow DOM mode/focus controls
```

Argo continues to own behavior. The extension changes presentation only.

Hybrid resource details preserve Argo UI's SlidingPanel architecture: an opaque resource pane is positioned over a semi-transparent `rgba(0,0,0,.3)` outside layer. The topology remains visible through the outside region while resource content keeps full contrast.

### Full

```text
Argo CD authenticated browser session
  -> full-graph-styles.js
  -> full-graph.js
  -> full-graph-base.js
  -> full-direct.js
  -> full-direct-patch.js
  -> full-admin-extra.js
  -> full-graph-direct-adapter.js
  -> full-controls.js
  -> full-changeflow.js
  -> full-ui.js
  -> full-route.js
  -> content.js
```

`full-ui.js` mounts a fixed Shadow DOM shell and hides the top-level native `.cd-layout`; the Argo page/session remains alive underneath solely so authentication/session state is preserved. Full never embeds or iframes the native frontend for feature parity.

## Full direct-control model

Full surfaces communicate with Argo CD through the same authenticated interfaces used by the upstream v3.5.2 UI:

- REST JSON requests with `credentials: include`
- EventSource for followed logs
- WebSocket `/terminal` for Pod exec

`full-direct.js` owns generic CRUD/admin surfaces, structured object editors, advanced logs and terminal behavior.

`full-controls.js` owns application-level operational controls: advanced sync, diff, events, manifests, history/rollback, refresh/hard refresh, Auto-Sync, operation state/termination, deletion confirmations and lifecycle actions.

`full-graph.js` owns topology/resource inspection. `full-graph-direct-adapter.js` keeps resource status typed, routes advanced resource controls to direct Full surfaces and implements native-equivalent foreground/background/orphan resource deletion without calling the original UI.

`full-admin-extra.js` adds settings capabilities that are separate upstream services rather than ordinary object CRUD: repository credential templates, repository force refresh, project role JWT lifecycle, project events/links and ApplicationSet generation preview.

`full-direct-patch.js` contains a narrow compatibility repair for repository create-route interpolation without expanding `full-direct.js` further.

## Standard Full API surface

Representative endpoints include:

### Applications/resources

- `GET/POST /api/v1/applications`
- `GET/PUT/DELETE /api/v1/applications/{name}`
- `GET /api/v1/applications/{name}/resource-tree`
- `POST /api/v1/applications/{name}/sync`
- `POST /api/v1/applications/{name}/rollback`
- `DELETE /api/v1/applications/{name}/operation`
- `GET /api/v1/applications/{name}/managed-resources`
- `GET /api/v1/applications/{name}/resource`
- `DELETE /api/v1/applications/{name}/resource`
- `GET /api/v1/applications/{name}/events`
- `GET /api/v1/applications/{name}/manifests`
- `GET /api/v1/applications/{name}/logs`
- `GET /api/v1/applications/{name}/resource/actions`
- `POST /api/v1/applications/{name}/resource/actions/v2`
- `GET /api/v1/applications/{name}/resource/links`
- `WS(S) <base>/terminal`

`appNamespace` is placed in query/body locations matching the upstream Argo applications service.

### ApplicationSets

- `GET/POST /api/v1/applicationsets`
- `GET/PUT/DELETE /api/v1/applicationsets/{name}`
- `POST /api/v1/applicationsets/generate`

### Settings/admin

- `/api/v1/repositories`
- `/api/v1/write-repositories`
- `/api/v1/repocreds`
- `/api/v1/write-repocreds`
- `/api/v1/certificates`
- `/api/v1/gpgkeys`
- `/api/v1/clusters`
- `/api/v1/projects`
- `/api/v1/projects/{project}/roles/{role}/token`
- `/api/v1/account`
- `/api/v1/session/userinfo`
- `/api/v1/settings`
- `/api/version`

## Full replacement boundary

Full parity covers standard Argo CD 3.5.x controls implemented by these APIs. Dynamically registered third-party frontend extensions are not treated as parity by loading the original workspace inside Full. If a user explicitly selects Hybrid or Original mode to use third-party UI code, that is a mode change, not a Full implementation.

## URL scoping

Chrome host permission is origin-scoped. For `https://example.com/argocd`, permission is requested only for `https://example.com/*`; `content.js` then applies a path-boundary check and activates only inside `/argocd`.

All REST, EventSource and WebSocket URLs are derived from the configured base so path-prefixed installations retain their prefix.

Changing the configured origin removes the old host permission after the new permission is granted.

## Storage and migration

`chrome.storage.local` stores only:

- configured Argo CD URL
- `uiMode`: `original | hybrid | full`
- `theme`: `system | light | dark`

Legacy `enabled: boolean` is migrated at read time and retained only as a compatibility hint.

No Argo CD token, password, cookie, account data, repository credential, cluster credential, terminal data or fetched Kubernetes object is persisted by the extension.

## Theme resolution

`System` resolves in `content.js` through `prefers-color-scheme`. The resolved value is written to `data-argocd-modern-theme` and passed to Full.

Full sets `color-scheme` and tokenized surfaces inside its Shadow DOM. Dark mode also covers direct editors, selects, terminal/log surfaces and admin forms.

Hybrid uses root-gated overrides for Argo components that retain light defaults, including tables, tabs, dialogs, menus, resource panels, selects, fields and code/log viewers.

## Hybrid compatibility points

The Hybrid layer targets selectors confirmed in Argo CD v3.5.2 and Argo UI source, notably:

- sidebar/page layout
- applications list/detail
- application resource tree
- resource details/tabs
- Argo UI `SlidingPanel`
- status icons and common fields/selects/dialogs

No Argo CD bundle is patched.

## Failure containment

Three explicit escape paths remain:

1. Extension popup -> Original / Hybrid / Full.
2. Hybrid floating control -> Original or Full.
3. Full sidebar -> Hybrid or Original.

These are user-controlled mode switches only. Full does not use them internally to implement missing controls.
