# Viastela Design System (`DESIGN.md`)

Unified 5-Platform Design Standard (`Web` · `macOS` · `Windows` · `iOS` · `Android`):
- **Frontend Stack**: **React 19 + TypeScript + Vite 8 + Tailwind CSS v4** (`src/main.tsx`, `src/styles/app.css`, `src/ui/dom.tsx`, `vite.config.ts`).
- **Default Theme**: **Warm Paper (`暖色纸感` · `#FAF9F5`)** — unified warm-paper canvas and sidebar with pure white `#FFFFFF` cards and `#F5F4ED` secondary recessed controls.
- **Selectable Dark-Gold Theme**: **Obsidian Gold (`星途暗金` · `#121318`)** — deep obsidian canvas with `#1A1C23` cards and `#F5B942` luminous gold accents.

## 1. Unified Surface & Color Hierarchy

| Semantic Token | `Warm Paper` (Default Light) | `Obsidian Gold` (Selectable Dark-Gold) | Role |
| :--- | :--- | :--- | :--- |
| `paper` (`--background` / `--sidebar`) | `#FAF9F5` | `#121318` | Unified app canvas & left navigation rail |
| `card` (`--card`) | `#FFFFFF` | `#1A1C23` | Primary cards, ledger sheets & active segmented pill |
| `paperDeep` (`--secondary`) | `#F5F4ED` | `#22252F` | Recessed filter tracks, time badges & secondary controls |
| `stageBg` (`--stage-bg`) | `#F3F1EA` | `#121318` | Theme-adaptive 2.5D Isometric Sanctuary Stage canvas |
| `ink` (`--foreground`) | `#141413` | `#F4F3EF` | Primary ink text |
| `muted` (`--muted-foreground`) | `#65635D` | `#9CA3AF` | Secondary descriptions & metadata |
| `line` (`--border`) | `#DCDAD3` / `#E5E3DB` | `rgba(245, 185, 66, 0.22)` | Hairline structural borders |
| `accent` (`--primary`) | `#D97757` (Terracotta) | `#F5B942` (Obsidian Gold) | Primary interactive highlight & active rail bar |

## 2. Native Desktop & Mobile Shell Craftsmanship (Path A + Path B Complete)

1. **Vite 8 + Tailwind CSS v4 + Native DOM Slot Architecture**:
   - Compiled via `vite.config.ts` (`@vitejs/plugin-react` + `@tailwindcss/vite`) with `src/styles/app.css` bridging all semantic tokens (`--background`, `--card`, `--secondary`, `--foreground`, `--primary`, `--border`) into `@theme inline`.
   - Core primitives (`Card`, `Chip`, `ChipGroup`, `ListRow`, `TimelineItem`, `SidebarFrame`, `NavItem`, `TabBar`, `DomGrid`, `DomSurface`) emit `data-slot` attributes on web (`webSlot(...)` in `src/ui/dom.tsx`) for native CSS `:hover` elevation, `backdrop-filter: blur(18px)` glassmorphism, and responsive CSS Grid layouts (`vs-bento-grid-4`, `vs-bento-grid-3`, `vs-bento-grid-2`).
2. **Unified Canvas & Sidebar**: The sidebar rail shares the `#FAF9F5` (`#121318` in dark mode) background (`color.paper` / `var(--sidebar)`) with a `1px` border divider, elevating the active item with a `2.5px` accent indicator bar and subtle card surface.
3. **Tactile Segmented Filter Track**: Filter bars use a recessed `#F5F4ED` container (`[data-slot="segmented-bar"]`) with an elevated `#FFFFFF` active pill (`[data-slot="segmented-pill"]`) and `50ms` tactile press physics.
4. **Tabular Numerals & Single-Line Timestamps**: All financial figures, durations, and dates enforce `tabular-nums lining-nums` and single-line badges.
5. **Theme-Adaptive 2.5D Isometric Stage**: `<IsometricStudioStage />` adapts its floor, ambient sky glow, floating island nameplates, and 4D closed-loop notification cards seamlessly between `Warm Paper` and `Obsidian Gold`.
