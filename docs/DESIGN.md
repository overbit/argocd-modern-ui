# Design system

The visual system is intentionally GitHub-inspired rather than a generic rounded SaaS dashboard.

## Principles

- **Operational state first:** health, sync, warnings, and destructive actions preserve strong semantic contrast.
- **Developer-tool density:** compact rows and controls with clear grouping, not oversized dashboard furniture.
- **Border-led hierarchy:** surfaces are separated primarily by 1px borders and subtle background changes.
- **Restrained geometry:** 4-6px radii for most controls and cards; 8px only for larger overlays.
- **Minimal elevation:** shadows are used sparingly, primarily for floating controls.
- **Independent themes:** System, Light, and Dark are extension settings and apply equally to Hybrid and Full modes.
- **Safe reversibility:** Original Argo CD is always one action away.

## GitHub-inspired tokens

### Light

- canvas default: `#ffffff`
- canvas subtle: `#f6f8fa`
- border default: `#d0d7de`
- text default: `#1f2328`
- text muted: `#59636e`
- accent: `#0969da`
- success: `#1a7f37`
- warning: `#9a6700`
- danger: `#cf222e`

### Dark

- canvas default: `#0d1117`
- canvas inset: `#010409`
- canvas subtle: `#161b22`
- border default: `#30363d`
- text default: `#f0f6fc`
- text muted: `#8b949e`
- accent: `#2f81f7`
- success: `#3fb950`
- warning: `#d29922`
- danger: `#f85149`

The values are inspired by GitHub's visual language; the extension is not a GitHub/Primer implementation and does not depend on Primer packages.

## Typography and sizing

- system font stack: `-apple-system`, BlinkMacSystemFont, Segoe UI, Noto Sans, Helvetica, Arial
- base text: 14px
- sidebar: 232px expanded / 60px collapsed
- standard control height: 32-34px
- common radius: 6px
- large overlay radius: 8px

## Hybrid mode

Hybrid keeps native Argo CD behavior but changes visual hierarchy, spacing, controls, cards, filters, top bars, resource views, and navigation. `github-theme.css` is loaded after the base redesign so the GitHub-inspired layer can evolve independently.

### Focus issues

Healthy + Synced resources are visually de-emphasized so Degraded or OutOfSync resources dominate the topology/list without changing data or ordering.

## Full mode

Full mode uses a separate Shadow-DOM shell with:

- GitHub-like bordered application rows
- operational summary counters
- compact status indicators
- left navigation with minimal active treatment
- application resource list prioritizing degraded/missing resources
- settings overview cards for projects, clusters, and repositories

Administrative mutation flows not yet reproduced safely explicitly direct users to Hybrid mode rather than presenting a misleading disabled clone.
