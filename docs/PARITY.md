# Full mode parity matrix

Baseline: Argo CD **3.5.x** native UI.

The goal is functional parity without replacing upstream safety semantics with weaker clones. Coverage is therefore classified as:

- **Custom** — implemented directly by the Full replacement UI.
- **Custom + parity** — Full provides a redesigned surface plus an in-Full native route for advanced controls.
- **Parity surface** — the upstream Argo CD page is embedded inside Full mode so the exact installed-version behavior remains authoritative.

## Applications

| Capability | Full coverage | Notes |
| --- | --- | --- |
| Application list | Custom + parity | Custom health/sync dashboard and search; native list remains available for complete filters/actions. |
| Create application | Parity surface | Uses upstream form, validation and RBAC. |
| Edit application | Parity surface | Uses upstream source/destination/sync-policy forms. |
| Delete application | Parity surface | Preserves upstream cascade/propagation confirmations. |
| Application health/sync summary | Custom | Visible in Full application detail. |
| Resource tree diagram | Custom | Interactive Tree view. |
| Network diagram | Custom | Uses Argo `networkingInfo.targetRefs`; falls back safely when network data is absent. |
| Pod-focused view | Custom | Interactive resource/pod view. |
| Resource list | Custom | List alternative to diagrams. |
| Pan / zoom / fit | Custom | Pointer drag, trackpad/wheel pan, Ctrl/Command + wheel zoom, controls, fit view. |
| Focus issues | Custom | De-emphasizes healthy + synced resources. |
| Resource selection | Custom | Relationship highlighting and inspector. |
| Resource summary | Custom + parity | Custom inspector plus upstream resource summary route. |
| Live manifest | Custom + parity | API-backed inspector plus upstream view. |
| Desired manifest | Custom + parity | API-backed managed-resource target state plus upstream view. |
| Diff | Custom + parity | Inspector diff presentation plus upstream diff for complete semantics. |
| Events | Custom + parity | Inspector event list plus upstream view. |
| Logs | Custom + parity | Inspector tail view plus upstream streaming/full-screen logs. |
| Exec / terminal | Parity surface | Uses upstream terminal implementation. |
| Resource actions | Custom + parity | Parameterless actions can run directly; parameterized actions open upstream controls. |
| Sync entire application | Custom + parity | Simple sync in Full; complete sync options use upstream dialog. |
| Sync selected resource | Custom + parity | API-backed resource sync with upstream control path available. |
| Delete resource | Custom + parity | API-backed basic delete; advanced confirmation semantics remain upstream. |
| Refresh / hard refresh | Parity surface | Upstream behavior. |
| Deployment history | Parity surface | Upstream history UI. |
| Rollback | Parity surface | Upstream rollback confirmation and options. |
| Terminate operation | Parity surface | Upstream action. |
| Parameters | Parity surface | Upstream Helm/Kustomize/plugin parameter UI. |
| Conditions | Parity surface | Upstream application conditions UI. |
| Full-screen logs route | Parity surface | Full mode recognizes native log routes. |

## ApplicationSets

| Capability | Full coverage | Notes |
| --- | --- | --- |
| ApplicationSet list | Custom + parity | Custom overview; native controls available. |
| ApplicationSet detail | Parity surface | Uses Argo CD's installed-version implementation. |
| Generator/template controls | Parity surface | Preserves upstream forms and validation. |

## Settings

All current Argo CD 3.5.x settings routes are available inside Full mode through the parity surface.

| Route | Capability |
| --- | --- |
| `/settings` | Settings overview |
| `/settings/repos` | Repositories |
| `/settings/certs` | TLS/SSH certificates |
| `/settings/gpgkeys` | GPG keys |
| `/settings/clusters` | Clusters |
| `/settings/clusters/:server` | Cluster detail |
| `/settings/projects` | Projects |
| `/settings/projects/:name` | Project detail |
| `/settings/accounts` | Accounts |
| `/settings/accounts/:name` | Account detail |
| `/settings/appearance` | Appearance |

CRUD, credential handling, validation, confirmation dialogs and RBAC remain owned by the upstream Argo CD frontend.

## Other upstream routes

| Capability | Full coverage |
| --- | --- |
| User Info | Parity surface |
| Help | Parity surface |
| Dynamically registered system-level extensions | Complete native workspace |
| Login/session behavior | Native Argo CD session |

## Why parity uses the installed Argo CD frontend

A full independent reimplementation of every Argo CD screen would duplicate a large amount of security-sensitive behavior: RBAC decisions, confirmation semantics, dynamic extension registration, form validation, terminal/log streaming, and version-specific APIs.

Full mode therefore treats upstream Argo CD as the behavior authority while progressively replacing high-value workflows with purpose-built UX. This gives users complete functionality today without blocking future replacement work.

## Replacement roadmap

The next direct-replacement targets should be implemented only when they can match upstream behavior and tests:

1. Advanced sync dialog: prune, dry-run, force/apply strategy, resource selection, sync options, retry.
2. Application history and rollback.
3. Application create/edit forms with project/source/destination discovery and validation.
4. Settings list/detail surfaces, starting with Projects and Clusters.
5. Repository management after credential handling and validation semantics are fully understood.
6. Terminal/exec only if the extension can preserve upstream authorization, websocket behavior and auditing without regression.

Until a workflow meets that bar, the parity surface remains the authoritative implementation inside Full mode.
