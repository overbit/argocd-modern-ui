# Architecture

## Goals

1. Restyle Argo CD 3.5.x without replacing its authenticated application runtime.
2. Request access only to the user-configured Argo CD origin.
3. Keep all native Argo CD actions and routes underneath the modern presentation layer.
4. Make rollback to the original UI immediate and independent of Argo CD's own controls.

## Why hybrid instead of a replacement SPA

A full replacement UI would duplicate Argo CD API clients, RBAC behavior, extension points, routing, dialogs, streaming logs, terminals, and version-specific edge cases. The hybrid layer deliberately leaves those components in place and changes presentation plus a small number of non-destructive UX affordances.

This keeps the failure mode simple: remove `data-argocd-modern="true"` and Argo CD returns to its native presentation.

## Runtime flow

```text
Extension popup
  -> user enters Argo CD URL
  -> request optional host permission for that origin
  -> store URL locally
  -> service worker registers content.js + modern.css only for that origin

Argo CD page
  -> content.js verifies the configured path prefix
  -> if enabled: set data-argocd-modern="true"
  -> modern.css restyles native Argo CD components
  -> floating Shadow DOM controls provide "Original UI"
  -> if disabled: remove root attributes and controls
```

## URL scoping

Chrome host permissions are origin-scoped. If the configured URL is `https://example.com/argocd`, Chrome permission is requested only for `https://example.com/*`, then `content.js` performs a second path-boundary check and activates only under `/argocd`.

Changing the configured origin removes the old host permission after the new permission has been granted.

## Storage and authentication

The extension uses `chrome.storage.local`, not sync storage. It stores only:

- configured Argo CD URL
- modern UI enabled/disabled state

Argo CD authentication remains entirely inside the existing Argo CD browser session. No token, cookie, username, or password is copied into extension storage.

## Argo CD 3.5 compatibility points

The initial compatibility layer targets selectors confirmed in Argo CD v3.5.2 source:

- `ui/src/app/sidebar/sidebar.tsx` / `sidebar.scss`
- `ui/src/app/shared/components/page/page.scss`
- `ui/src/app/applications/components/applications-list/*`
- `ui/src/app/applications/components/application-details/*`
- `ui/src/app/applications/components/application-resource-tree/*`
- status icons from `ui/src/app/applications/components/utils.tsx`

The UI stylesheet is intentionally additive and root-gated. No Argo CD bundle is patched.

## Focus issues

On application-detail routes, the extension exposes **Focus issues**. It dims resource nodes/rows only when Argo CD itself marks them both `Healthy` and `Synced`. Degraded or OutOfSync resources remain fully emphasized. The control changes presentation only; it never changes Argo CD resource data or sync behavior.

## Failure containment

There are two independent escape paths:

1. Extension popup -> disable **Modern interface**.
2. In-page floating control -> **Original UI**.

Both write `enabled: false` to local extension storage. The already-injected CSS remains harmless because every rule requires the root modern attribute.
