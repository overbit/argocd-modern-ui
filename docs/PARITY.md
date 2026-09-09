# Full mode parity matrix

Baseline: Argo CD **3.5.x** native UI.

The goal is functional parity without replacing upstream safety semantics with weaker clones. Coverage is classified as:

- **Custom** — implemented directly by the Full replacement UI using the authenticated Argo CD API.
- **Custom + fallback** — Full implements the normal workflow directly and retains an in-Full native route for installed-version behavior such as terminal, dynamic extensions, or specialized forms.
- **Native fallback** — the upstream Argo CD page remains available inside Full mode where browser/native frontend behavior is itself part of the capability.

## Applications

| Capability | Full coverage | Notes |
| --- | --- | --- |
| Application list | Custom + fallback | Custom health/sync dashboard and search; native list remains available for installed-version list actions. |
| Create application | Native fallback | Upstream project/source/destination discovery, validation and RBAC remain authoritative. |
| Edit application | Native fallback | Upstream source/destination/plugin editors remain authoritative. |
| Delete application | Custom + fallback | Full supports cascade/non-cascade deletion and foreground/background/orphan propagation with confirmation. |
| Application health/sync summary | Custom | Visible in Full application detail. |
| Resource tree diagram | Custom | Interactive Tree view. |
| Network diagram | Custom | Uses Argo `networkingInfo.targetRefs`; falls back safely when network data is absent. |
| Pod-focused view | Custom | Interactive resource/pod view. |
| Resource list | Custom | List alternative to diagrams. |
| Compact inactive resources | Custom | Same-kind inactive leaf siblings collapse into an expandable aggregate node. Resources requiring attention remain explicit. |
| Pan / zoom / fit | Custom | Pointer drag, trackpad/wheel pan, Ctrl/Command + wheel zoom, controls, fit view. |
| Focus issues | Custom | De-emphasizes healthy + synced resources. |
| Resource selection | Custom | Relationship highlighting and inspector. |
| Resource summary | Custom + fallback | Custom inspector plus upstream route for dynamic extension tabs. |
| Live manifest | Custom | Recursive JSON decoding prevents escaped JSON-string rendering. |
| Desired manifest | Custom | Managed-resource target state is recursively decoded and prettified. |
| Resource diff | Custom | Desired/live structured views in the inspector. |
| Application diff | Custom | Managed-resource diff panel. |
| Events | Custom | Resource and application event panels. |
| Logs | Custom + fallback | Full aggregates all matching Pods and every discovered init/app/ephemeral container for Deployment, ReplicaSet, Pod and Pod-template resources; native log UI remains available for streaming/filter/download/previous-log controls. |
| Exec / terminal | Native fallback | Browser terminal/websocket behavior remains the upstream implementation inside Full mode. |
| Resource actions | Custom | Parameterless and parameterized Argo resource actions run directly with Argo RBAC. |
| Resource links | Custom | Argo-provided external resource links are shown in the inspector. |
| Sync entire application | Custom | Advanced Full sync form implements the Argo 3.5.x manual flags, sync options, retry strategy and resource selection. |
| Sync selected resource | Custom | API-backed resource sync from the resource inspector. |
| Delete resource | Custom + fallback | Direct API-backed resource delete; native route remains available for installed-version dependent-resource presentation. |
| Toggle Auto-Sync | Custom | Uses Argo's built-in `toggle-auto-sync` Application resource action. |
| Confirm prune/deletion | Custom | Applies Argo's deletion-approval annotation after explicit confirmation. |
| Refresh / hard refresh | Custom | Uses the native `refresh=normal|hard` application API behavior. |
| Sync status | Custom | Operation status is shown as prettified structured data. |
| Terminate operation | Custom | Direct operation termination with confirmation. |
| Deployment history | Custom | Full history list. |
| Rollback | Custom | Direct rollback; disables Auto-Sync first when required. |
| Conditions | Custom | Full conditions view. |
| Manifests | Custom | Generated manifests rendered as structured/prettified data. |
| Hydration status | Custom | Shown when source hydrator operation state is present. |
| Full-screen logs route | Native fallback | Full mode recognizes and contains the installed native route. |
| Application extension tabs | Native fallback | Dynamically registered extension code must remain the installed frontend implementation. |

### Advanced sync parity

The Full sync form covers the controls exposed by Argo CD 3.5.x:

- revision
- Prune
- Dry Run
- Apply Only
- Force
- resource selection: all / out-of-sync / none / individual
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

Destructive Force, Replace and Prune choices require an additional confirmation in Full mode.

## JSON presentation

Argo APIs frequently return manifests and managed-resource state as JSON encoded inside strings. Full recursively parses complete JSON object/array strings before presentation, including nested encoded values, then renders them with indentation. This is used by application details, manifests, operation state, resource manifests and diff views.

## ApplicationSets

| Capability | Full coverage | Notes |
| --- | --- | --- |
| ApplicationSet list | Custom + fallback | Custom overview; installed native controls remain available. |
| ApplicationSet detail | Native fallback | Uses Argo CD's installed-version implementation. |
| Generator/template controls | Native fallback | Preserves upstream forms and validation. |

## Settings

All current Argo CD 3.5.x settings routes remain available inside Full mode through the same-origin native fallback surface.

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

CRUD, credential handling, validation, confirmation dialogs and RBAC remain owned by the upstream Argo CD frontend for these administration surfaces.

## Theme parity

Full's selected theme is propagated into same-origin native fallback frames. Dark mode explicitly covers the upstream page/layout surfaces, tables, status panels, sliding panels, modals, filters, menus, dropdowns, selects, inputs, code editors and log viewers so a dark Full workspace does not expose light fallback cards. Native browser controls inherit `color-scheme: dark`.

Hybrid keeps the resource sliding panel highly opaque but translucent so the topology remains perceptible under an open resource while text, controls and status content remain readable.

## Other upstream routes

| Capability | Full coverage |
| --- | --- |
| User Info | Native fallback |
| Help | Native fallback |
| Dynamically registered system-level extensions | Complete native workspace |
| Login/session behavior | Native Argo CD session |

## Why some fallback remains

A browser terminal requires Argo CD's websocket/session handling; dynamically registered resource/system extensions execute installed frontend code; administrative credential forms are version-specific and security-sensitive. Full therefore keeps these surfaces in the same authenticated Argo CD origin instead of approximating them with a weaker implementation.

For normal application operations and resource investigation, Full now uses its own controls and diagrams. Native fallback is a containment mechanism for functionality that inherently depends on the installed Argo CD frontend, not the primary application-detail workflow.
