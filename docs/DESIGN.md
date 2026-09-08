# Design system

The visual direction is a compact developer-tool interface inspired by the information density of Linear and GitHub rather than a consumer dashboard.

## Principles

- **Operational state first:** health, sync, warnings, and destructive actions retain strong semantic contrast.
- **Dense, not cramped:** smaller controls and headings, larger grouping gaps, predictable 8/12/16px radii.
- **Neutral surfaces:** low-chroma backgrounds keep Argo CD status colors meaningful.
- **Native behavior:** navigation, menus, dialogs, logs, terminals, RBAC, and extension points remain Argo CD components.
- **Safe reversibility:** visual overrides are always subordinate to the root modern-mode attribute.

## Tokens

Light mode uses a slate/white surface system with blue interaction accents. Dark mode uses near-black/slate surfaces with the same interaction hierarchy. Status colors are not remapped; Argo CD's own status icon colors remain authoritative.

Core layout tokens:

- sidebar: 244px expanded / 64px collapsed
- control height: 34-36px
- small radius: 8px
- card radius: 12px
- dialog radius: 16px
- base text: 14px

## UX additions

### Original UI

Always visible as an extension control while modern mode is enabled. It disables the presentation layer immediately.

### Focus issues

Available on application detail routes. Healthy + Synced resources are visually de-emphasized so degraded or OutOfSync resources dominate the topology/list without changing resource ordering or Argo CD data.
