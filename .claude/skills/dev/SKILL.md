---
name: dev
description: Use when writing or modifying any code in this project - enforces file structure, component granularity, and coding conventions
---

# Dev Conventions

## 1. Unicode & Special Characters

- **Never inline** Unicode escapes (`\u2708`, `&#x2708;`) or emoji literals in components
- Create/use `lib/constants/icons.ts` with descriptive named exports:
  ```ts
  export const AIRPLANE_ICON = '\u2708\uFE0F';
  export const SUN_ICON = '\u2600\uFE0F';
  export const MOON_ICON = '\uD83C\uDF19';
  export const BULLET_CIRCLE = '\u25CF';
  ```
- Variable name must describe what it visually represents

## 2. useEffect Requires Permission

- Before adding any `useEffect` to any component, **stop and tell the user**
- Explain what it does and why it's needed
- Wait for approval before proceeding
- This applies to subagents too

## 3. Routing & Page Structure

Each top-level UI section is a **route** in the `app/` directory:

```
app/
  layout.tsx
  page.tsx              # redirects to /dashboard or is the dashboard
  dashboard/
    page.tsx
    components/         # dashboard-only components
  spotting/
    page.tsx
    components/         # spotting-only components
  settings/
    page.tsx
    components/         # settings-only components
```

- **Don't** use tab state to switch between "pages" in a single `page.tsx`
- Each distinct view = its own `app/<name>/page.tsx`

## 4. Component Folder Hierarchy

Components folder structure mirrors the UI hierarchy:

```
app/dashboard/components/
  flight-map/
    FlightMap.tsx           # the map wrapper
    FlightMapInner.tsx      # Leaflet client component (kept small)
    map-controls/
      MapControls.tsx       # zoom, layer toggle, etc.
    draw-zone/
      DrawZone.tsx          # rectangle drawing interaction
      DrawZoneOverlay.tsx   # visual overlay
    aircraft-marker/
      AircraftMarker.tsx    # main marker component
      marker-icons/         # icon variants by aircraft type
        NarrowBodyIcon.tsx
        WideBodyIcon.tsx
        RegionalIcon.tsx
    flight-popup/
      FlightPopup.tsx       # info popup when clicking a flight
  landing-table/
    LandingTable.tsx
  status-banner/
    StatusBanner.tsx
  weather-card/
    WeatherCard.tsx
  timetable/
    Timetable.tsx
```

**Rules:**
- A component folder is created when a component has sub-parts
- Sub-components that only exist within a parent live inside the parent's folder
- Leaf components (no children) are just files, no folder needed

**Only `components/` (top-level) contains truly shared/common components:**
- `components/ui/` -- shadcn primitives (Button, Card, etc.)
- `components/DataCell.tsx` -- generic table cell
- `components/AirportCell.tsx` -- used across multiple pages
- If a component is used on only one page, it goes under that page's `components/`

## 5. One Concern Per File

Each file should serve **one purpose**. Length doesn't matter -- a 500-line file is fine if it's all one concern.

Split by concern:
- **Rendering logic** -- the JSX component
- **Data transformation** -- mapping/filtering/computing derived data
- **Animation/interaction** -- timers, transitions, drag handlers
- **Constants/config** -- magic numbers, enum maps, style maps

Bad (1300-line FlightMapInner.tsx):
```
FlightMapInner.tsx  # markers, icons, animations, draw zone, popups, controls
```

Good:
```
flight-map/
  FlightMapInner.tsx        # map setup, layer composition (~100 lines)
  aircraft-marker/
    AircraftMarker.tsx      # renders one plane on the map
    marker-icons/           # icon selection logic + SVG variants
  draw-zone/
    DrawZone.tsx            # drawing interaction + state
  useMapAnimation.ts        # animation loop hook
  mapConstants.ts           # bounds, colors, sizes
```

## Quick Reference

| Rule | Check |
|------|-------|
| Unicode/emoji in JSX? | Must be a named constant from `lib/constants/icons.ts` |
| Adding `useEffect`? | Ask user first, explain why |
| New page/section? | `app/<name>/page.tsx`, not a tab in existing page |
| File serves multiple concerns? | Split into separate files by concern |
| Component used on 1 page? | Goes under that page's `components/` |
| Component used on 2+ pages? | Goes in top-level `components/` |
| Sub-component of a component? | Nested folder inside parent's folder |
