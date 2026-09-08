# Architecture

## Goals

1. Offer Original, Hybrid, and Full UI modes for Argo CD 3.5.x.
2. Request access only to the user-configured Argo CD origin.
3. Keep authentication inside the existing Argo CD browser session.
4. Make rollback to Hybrid or Original UI immediate.
5. Avoid recreating privileged/destructive workflows until they can preserve Argo CD's RBAC and confirmation semantics.

## Runtime modes

### Original

`content.js` removes all redesign attributes, the Hybrid floating controls, and the Full replacement host.

### Hybrid

```text
Argo CD native React application
  + data-argocd-modern="true"
  + data-argocd-modern-mode="hybrid"
  + explicit extension theme attribute
  + modern.css + github-theme.css
  + isolated Shadow DOM mode/focus controls
```

Native components continue to own all application behavior.

### Full

```text
Argo CD authenticated page/session
  -> full-ui.js mounts fixed Shadow DOM shell
  -> native .cd-layout is hidden, not destroyed
  -> Full UI requests same-origin /api/v1 data with browser credentials
  -> independent navigation/rendering inside extension shadow root
  -> Hybrid / Original controls remain available
```

The native Argo CD runtime remains loaded underneath the replacement shell, so switching mode does not require reconstructing authentication state.

## Full UI API surface

The initial replacement shell uses:

- `GET /api/v1/applications`
- `GET /api/v1/applications/{name}`
- `GET /api/v1/applications/{name}/resource-tree`
- `POST /api/v1/applications/{name}/sync`
- `GET /api/v1/applicationsets`
- `GET /api/v1/projects`
- `GET /api/v1/clusters`
- `GET /api/v1/repositories`

Application namespace is forwarded through `appNamespace` using the same query/body placement as Argo CD 3.5.2's native applications service.

Administrative writes such as repository credential changes, project deletion, and cluster modification remain in Hybrid mode for now. This is deliberate failure containment rather than an invisible partial implementation.

## URL scoping

Chrome host permissions are origin-scoped. If the configured URL is `https://example.com/argocd`, Chrome permission is requested only for `https://example.com/*`, then `content.js` performs a second path-boundary check and activates only under `/argocd`.

Changing the configured origin removes the old host permission after the new permission has been granted.

## Storage and migration

`chrome.storage.local` stores only:

- configured Argo CD URL
- `uiMode`: `original | hybrid | full`
- `theme`: `system | light | dark`

Version 0.1 used `enabled: boolean`. Version 0.2 migrates it at read time:

- `enabled: false` -> `original`
- `enabled: true` -> `hybrid`

Writes retain the old flag as a compatibility hint, but the explicit mode is authoritative.

## Theme resolution

`System` is resolved in `content.js` using `prefers-color-scheme`. The resolved `light` or `dark` value is written to `data-argocd-modern-theme` and passed into Full mode. This makes extension theme selection independent of Argo CD's own `.theme-light` / `.theme-dark` state.

## Argo CD 3.5 Hybrid compatibility points

The Hybrid layer targets selectors confirmed in Argo CD v3.5.2 source:

- `ui/src/app/sidebar/sidebar.tsx` / `sidebar.scss`
- `ui/src/app/shared/components/page/page.scss`
- `ui/src/app/applications/components/applications-list/*`
- `ui/src/app/applications/components/application-details/*`
- `ui/src/app/applications/components/application-resource-tree/*`
- status icons from `ui/src/app/applications/components/utils.tsx`

The UI stylesheet is additive and root-gated. No Argo CD bundle is patched.

## Failure containment

Three escape paths exist:

1. Extension popup -> **Original**.
2. Hybrid floating control -> **Original** or **Full UI**.
3. Full sidebar -> **Hybrid UI** or **Original UI**.

The Full host is removed on mode change and the native layout becomes visible again. The Hybrid stylesheet remains harmless in Original mode because every rule requires the root redesign attribute.
