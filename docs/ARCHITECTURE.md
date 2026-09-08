# Architecture

## Goals

1. Offer Original, Hybrid, and Full UI modes for Argo CD 3.5.x.
2. Request access only to the user-configured Argo CD origin.
3. Keep authentication inside the existing Argo CD browser session.
4. Make rollback to Hybrid or Original UI immediate.
5. Reach functional parity with upstream Argo CD without reimplementing privileged workflows less safely than upstream.
6. Keep the redesigned topology interactive in both Hybrid and Full modes.

## Runtime modes

### Original

`content.js` removes all redesign attributes, the Hybrid floating controls, and the Full replacement host.

### Hybrid

```text
Argo CD native React application
  + data-argocd-modern="true"
  + data-argocd-modern-mode="hybrid"
  + explicit extension theme attribute
  + modern.css + github-theme.css + graph.css
  + isolated Shadow DOM mode/focus controls
```

Native components continue to own all application behavior. The native resource DAG remains Argo CD's graph implementation and receives only the extension's n8n-inspired visual treatment.

### Full

```text
Argo CD authenticated page/session
  -> full-graph-styles.js defines Full topology presentation
  -> full-graph.js defines the custom interactive resource graph/inspector
  -> full-native.js defines the same-origin parity surface and graph parity adapter
  -> full-ui.js mounts the fixed Shadow DOM shell
  -> native .cd-layout is hidden in the top-level page, not destroyed
  -> Full custom views request same-origin /api/v1 data with browser credentials
  -> advanced routes can render the upstream Argo CD UI in a same-origin iframe inside Full mode
  -> Hybrid / Original controls remain available
```

The native Argo CD runtime remains loaded underneath the replacement shell, so switching mode does not require reconstructing authentication state.

## Functional parity model

Full mode deliberately separates **replacement UX** from **upstream behavior parity**.

### Replacement surfaces

The extension directly owns:

- application dashboard/search/status overview
- ApplicationSets overview
- application summary
- Tree / Network / Pods / List resource views
- pan, zoom, fit-to-view, focus-issues, selection and relationship highlighting
- resource inspector
- selected resource API-backed summary/live/desired/diff/events/logs/actions where the Argo API can be reproduced safely
- simple application/resource sync operations

### Native parity surfaces

For workflows where upstream behavior is broader, dynamic, privileged, or form-heavy, Full mode embeds the configured Argo CD route in a same-origin iframe. This happens **inside the Full shell**; it does not change `uiMode`.

The parity surface preserves upstream:

- authentication/session cookies
- RBAC decisions
- validation
- confirmation dialogs
- application creation/edit/delete
- advanced sync options
- manifests and diff screens
- history and rollback
- resource actions with parameters
- resource terminal/exec
- full-screen logs
- repository/project/cluster/account/certificate/GPG/appearance settings
- user info and help
- dynamically registered Argo CD system-level extension screens when using the complete native workspace

`full-native.js` compacts the upstream global sidebar for focused parity frames but keeps upstream action bars and page behavior. A separate **All features** surface keeps the complete native chrome available for dynamic extension discovery and edge-case routes.

## Full UI API surface

The custom replacement layer uses the same authenticated Argo CD REST API used by the native UI, including:

- `GET /api/v1/applications`
- `GET /api/v1/applications/{name}`
- `GET /api/v1/applications/{name}/resource-tree`
- `POST /api/v1/applications/{name}/sync`
- `GET /api/v1/applications/{name}/resource`
- `DELETE /api/v1/applications/{name}/resource`
- `GET /api/v1/applications/{name}/managed-resources`
- `GET /api/v1/applications/{name}/events`
- `GET /api/v1/applications/{name}/logs`
- `GET /api/v1/applications/{name}/resource/actions`
- `POST /api/v1/applications/{name}/resource/actions/v2`
- `GET /api/v1/applicationsets`

Application namespace is forwarded through `appNamespace` using the same query/body placement as Argo CD 3.5.x's native applications service.

The parity layer avoids duplicating the rest of the API surface solely for parity. Instead, the installed Argo CD frontend remains the authority for advanced workflows until a replacement interaction is intentionally implemented and verified.

## Native parity route baseline

Argo CD 3.5.x top-level routes covered by Full mode are:

- `/applications`
- `/applicationsets`
- `/settings`
- `/user-info`
- `/help`

Settings subroutes covered through the parity surface include:

- `/settings/repos`
- `/settings/certs`
- `/settings/gpgkeys`
- `/settings/clusters`
- `/settings/clusters/:server`
- `/settings/projects`
- `/settings/projects/:name`
- `/settings/accounts`
- `/settings/accounts/:name`
- `/settings/appearance`

Application/ApplicationSet detail and full-screen log routes are also valid parity targets. Dynamic system-level extension routes remain reachable from the **All features** native workspace.

## URL scoping

Chrome host permissions are origin-scoped. If the configured URL is `https://example.com/argocd`, Chrome permission is requested only for `https://example.com/*`, then `content.js` performs a second path-boundary check and activates only under `/argocd`.

Changing the configured origin removes the old host permission after the new permission has been granted.

Both API requests and parity frame URLs are built from the configured base URL, so path-prefixed installations keep `/argocd` or another configured prefix.

## Storage and migration

`chrome.storage.local` stores only:

- configured Argo CD URL
- `uiMode`: `original | hybrid | full`
- `theme`: `system | light | dark`

Version 0.1 used `enabled: boolean`. Version 0.2 migrates it at read time:

- `enabled: false` -> `original`
- `enabled: true` -> `hybrid`

Writes retain the old flag as a compatibility hint, but the explicit mode is authoritative.

No Argo CD token, password, cookie, account data, repository credential, cluster credential, or session value is persisted by the extension.

## Theme resolution

`System` is resolved in `content.js` using `prefers-color-scheme`. The resolved `light` or `dark` value is written to `data-argocd-modern-theme` and passed into Full mode. This makes extension theme selection independent of Argo CD's own `.theme-light` / `.theme-dark` state.

Parity frames retain upstream Argo CD behavior. The outer Full shell always uses the extension-selected theme.

## Argo CD 3.5 Hybrid compatibility points

The Hybrid layer targets selectors confirmed in Argo CD v3.5.x source:

- `ui/src/app/sidebar/sidebar.tsx` / `sidebar.scss`
- `ui/src/app/shared/components/page/page.scss`
- `ui/src/app/applications/components/applications-list/*`
- `ui/src/app/applications/components/application-details/*`
- `ui/src/app/applications/components/application-resource-tree/*`
- status icons from `ui/src/app/applications/components/utils.tsx`

The UI stylesheet is additive and root-gated. No Argo CD bundle is patched.

## Failure containment

Four escape/parity paths exist:

1. Extension popup -> **Original**.
2. Hybrid floating control -> **Original** or **Full UI**.
3. Full sidebar -> **Hybrid UI** or **Original UI**.
4. Full sidebar -> **All features**, which keeps Full mode active while exposing the complete upstream Argo CD workspace inside the shell.

The Full host is removed on mode change and the native layout becomes visible again. The Hybrid stylesheet remains harmless in Original mode because every rule requires the root redesign attribute.
