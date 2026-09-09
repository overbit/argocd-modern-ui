# Full mode direct parity matrix

Baseline: Argo CD **3.5.x**, validated against v3.5.2 UI/service source.

**Rule:** Full parity is counted only when the replacement UI performs the capability itself through Argo CD REST, EventSource, or WebSocket APIs. Embedding/iframes of the original Argo CD frontend do not count and are not used.

Hybrid and Original remain explicit user-selected escape modes, not Full feature implementations.

## Applications

| Capability | Full implementation | Notes |
| --- | --- | --- |
| Application list/search | Direct | Custom health/sync dashboard and filtering. |
| Create application | Direct | Complete Application object editor, POST `/api/v1/applications`; Argo validates/RBACs the request. |
| Edit application | Direct | Complete Application object editor, PUT with validation. Covers source(s), destination, project, parameters/plugin configuration and sync policy fields. |
| Delete application | Direct | Cascade/non-cascade plus foreground/background/orphan propagation. |
| Health/sync summary | Direct | Full detail header. |
| Tree / Network / Pods / List | Direct | Custom topology views. |
| Compact inactive resources | Direct | Expandable same-kind leaf groups; issues stay visible. |
| Pan / zoom / fit | Direct | Pointer/trackpad/keyboard-friendly graph controls. |
| Focus issues | Direct | De-emphasizes Healthy + Synced resources. |
| Resource summary | Direct | Inspector/API-backed details. |
| Live/desired manifests | Direct | Recursive JSON-string decoding and pretty formatting. |
| Resource/application diff | Direct | Managed-resource API and structured views. |
| Events | Direct | Application/resource event APIs. |
| Logs | Direct | All matching workload Pods and init/app/ephemeral containers; tail/since/filter/match-case/previous/follow controls. Follow mode uses EventSource. |
| Pod terminal / exec | Direct | Authenticated `/terminal` WebSocket, container selection, resize/stdin, paste and common control keys. |
| Resource actions | Direct | Parameterless and parameterized `resource/actions/v2`. |
| Resource links | Direct | Argo-provided links. |
| Sync application | Direct | Full advanced sync form. |
| Sync selected resource | Direct | Resource-targeted sync request. |
| Delete resource | Direct | Foreground/background/orphan choices; managed resources require typing the resource name; dependent resources are summarized. |
| Toggle Auto-Sync | Direct | Built-in Application `toggle-auto-sync` action. |
| Confirm prune/deletion | Direct | Argo deletion-approval annotation after confirmation. |
| Refresh / hard refresh | Direct | `refresh=normal|hard`. |
| Sync status | Direct | Operation state. |
| Terminate operation | Direct | Operation DELETE. |
| Deployment history | Direct | History list. |
| Rollback | Direct | Direct rollback; Auto-Sync disabled first when required. |
| Conditions | Direct | Application conditions. |
| Manifests | Direct | Generated manifest API. |
| Hydration status | Direct | Source hydrator operation state when present. |

### Advanced sync controls

Full implements the Argo CD 3.5.x controls directly:

- revision
- Prune
- Dry Run
- Apply Only
- Force
- all / out-of-sync / none / individual resource selection
- Skip Schema Validation (`Validate=false`)
- Auto-Create Namespace
- Apply Out of Sync Only
- Respect Ignore Differences
- Server-Side Apply
- Prune Last
- Prune propagation: foreground / background / orphan
- per-resource `Prune=true|false|confirm`
- per-resource `Delete=true|false|confirm`
- Replace
- retry limit, duration, maximum duration and factor

Force, Replace and destructive prune flows require additional confirmation.

## JSON presentation

Full recursively parses strings that contain complete JSON objects/arrays before rendering. Nested JSON strings are normalized too. This applies to Application objects, manifests, desired/live state, operation state and generated payloads.

## ApplicationSets

| Capability | Full implementation | Notes |
| --- | --- | --- |
| List | Direct | Full overview. |
| Create | Direct | Complete ApplicationSet object editor. |
| Edit | Direct | Complete generator/template/goTemplate/sync-policy object editing. |
| Delete | Direct | Direct API deletion. |
| Generate preview | Direct | `/api/v1/applicationsets/generate`. |

## Settings

| Area | Full implementation | Notes |
| --- | --- | --- |
| Repositories | Direct | List/create/edit/delete; Git/Helm/OCI, HTTPS/SSH/GitHub App/GCP/Azure fields; force refresh. |
| Write repositories | Direct | Same direct controls for write-back repositories. |
| Repository credential templates | Direct | Standard and write credential-prefix templates via `/repocreds` and `/write-repocreds`. |
| Certificates | Direct | List/add/delete TLS and SSH certificate entries. |
| GPG keys | Direct | List/add/delete public keys. |
| Clusters | Direct | List/detail/update/delete/cache invalidation. Argo's native UI itself delegates cluster addition to the CLI. |
| Projects | Direct | Complete AppProject editing for sources, destinations, roles, policies, groups, resource allow/deny rules and sync windows. |
| Project role JWTs | Direct | Token create/delete. |
| Project events/links | Direct | Event and link APIs. |
| Accounts | Direct | Account details, token create/delete and current-user password change. |
| Appearance | Direct | Extension System/Light/Dark selection. |
| User Info | Direct | `/session/userinfo`. |
| Help/version | Direct | `/api/version` and server settings/capabilities. |

## Theme parity

Full's own Shadow DOM uses the extension token palette and browser `color-scheme`. In Dark mode, forms, selects, editors, code/log surfaces, cards, dialogs and direct admin controls all resolve to dark surfaces.

Hybrid dark mode explicitly overrides Argo components that otherwise retain light defaults, including tables, tabs, resource details, editable panels, dialogs, menus, selects, inputs, code editors and log viewers.

Hybrid resource details match Argo UI's `SlidingPanel` model: the resource pane remains opaque while `.sliding-panel` supplies a 30% dim transparent outside layer and `.sliding-panel__outside` remains transparent. The topology is visible around/behind the open resource without reducing panel readability.

## What is not counted as Full parity

Dynamically registered third-party UI extensions are executable frontend code supplied by another extension, not standard Argo CD controls. Full does not iframe the original workspace to claim support for them. Users can explicitly switch to Hybrid or Original mode when they intentionally want third-party native UI extensions, but those modes are separate products and are not counted in this matrix.
