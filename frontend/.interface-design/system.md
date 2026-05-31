# Interface Design System

## Direction & Feel
* **Concept**: Graphite Bench & Teal Instrument Glow
* **Tone**: Technical, dense, precise, and hardware-inspired. Fits a robotics playground terminal.
* **Colors**:
  * Surface base (`--ws-floor`): `hsl(210, 8%, 7%)`
  * Surface elevation (`--ws-bench`): `hsl(210, 7%, 10%)`
  * Accent Instrument Glow (`--ws-glow`): `hsl(178, 55%, 48%)`
  * Text Chassis Ink (`--ws-ink`): `hsl(40, 10%, 88%)`

## Spacing & Grid System
* **Base Unit**: `4px` grid scale.
* **Spacing Rules**:
  * Micro gaps (between text/icon inside items): `gap-2` (`8px`)
  * Item gaps (in list lists): `gap-1` (`4px`) or `gap-2` (`8px`)
  * Inner padding: `p-2` (`8px`), `px-2.5 py-1.5`
  * Layout section gaps: `gap-4` (`16px`)

## Sizing & Typography Hierarchy
* **UI Controls & Headers**: `h-11` (`44px` height) for main header bars (`WorkspaceTopBar` and `LeftNav` headers).
* **List Elements**: `h-8` (`32px` height) for all sidebar navigation lists, tree nodes, search inputs, and list components.
* **Standard Typography**: `text-[13px]` for all primary content labels, node names, search parameters, and secondary navigation text.
* **Tiny Utilities**: `text-[10px] font-bold text-ws-muted uppercase tracking-wider` for group section titles (e.g. `Domains`, `Tools`, `Recent Activity`).

## Iconography Consistency
* **Action & Control Icons (Header & Lists)**: Unified to exactly `size-[14px]` (Search, chevron, settings, book, folders, delete/rename controls).
* **Launcher & Primary Focus Icons**: Unified to exactly `size-[16px]` (Main folders, search toggles when collapsed).
* **Indicator Badges**: Unified to exactly `size-[12px]` (Pins, tiny metadata tags).

## Depth & Layering
* **Depth Strategy**: Borders-only, crisp separation.
* **Borders**: Pure low-opacity border separator (`border-ws-line` or `border-ws-edge-soft`) to maintain visual transparency and prevent solid line clutter.
* **Horizontal Divider Rule**: Avoid splitting layout sidebars vertically near headers to sustain a continuous panel illusion from viewport top-to-bottom.
