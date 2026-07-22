# Design System — Hartford Technology Rentals POC

## Theme

Scene: a technical director specs gear at a desk beside a lit stage — bright task light, matte-black equipment, one red tally lamp. Light UI (product photography lives on white), anchored by near-black "control room" bands (header, hero, footer). Named reference: Vercel-grade black/white monochrome discipline × broadcast tally-light red — NOT SaaS-cream, NOT editorial-serif.

## Color (OKLCH)

- `--ink`: oklch(0.18 0.005 260) — near-black, primary text & dark bands
- `--ink-2`: oklch(0.32 0.005 260) — secondary text on light
- `--ink-3`: oklch(0.45 0.004 260) — tertiary/meta text (still ≥4.5:1 on bg)
- `--bg`: oklch(0.985 0 0) — true near-white, chroma 0
- `--surface`: oklch(0.955 0.002 260) — light gray panels
- `--line`: oklch(0.88 0.003 260) — hairlines
- `--paper-dark`: oklch(0.205 0.006 260) — dark band surface
- `--line-dark`: oklch(0.32 0.006 260) — hairlines on dark
- `--muted-dark`: oklch(0.72 0.005 260) — secondary text on dark
- `--signal`: oklch(0.55 0.19 27) — HTR red, toned; use ≤5% (tally dots, badge counts, active ticks, focus accents)
- `--signal-strong`: oklch(0.48 0.18 27) — hover/pressed signal
- Strategy: Restrained monochrome; red is a signal, never a fill for large areas.

## Typography

- Display/headings: **Archivo** (variable, wdth axis). Display = uppercase, width 125 ("Expanded"), weight 600–700, tracking -0.01em. Broadcast-signage voice.
- Body/UI: **Archivo** normal width, 400/500.
- Data/spec labels: **Spline Sans Mono** 400/500 — model numbers, spec tables, breadcrumbs meta, SKU chips.
- Scale: fluid clamp; h1 clamp(2.5rem, 6vw, 4.5rem); ratio ≥1.25. `text-wrap: balance` on h1–h3.

## Components

- **Mega menu**: full-width panel under header; left rail = categories (hover/focus expands), right = subcategory columns + featured product photo. Lowes-style progressive expansion. Keyboard + touch accessible.
- **Quote List drawer**: slide-over from right; localStorage; badge count in header (signal red); replaces cart everywhere. CTA language: "Add to quote", "Request quote".
- **Product card**: white photo tile on hairline border, mono model number, name, "Add to quote" ghost button on hover (always visible on touch).
- **Spec table**: 2-col hairline rows, mono values.
- **Tally dot**: 8px signal-red dot with subtle 2s pulse (static under reduced motion) — availability/on-air motif.

## Motion

- ease-out-expo / quart everywhere; 200–500ms; no bounce.
- Hero: one orchestrated load (image clip-path reveal + 2-line headline stagger).
- Scroll reveals: sparse, content visible by default (enhance, never gate).
- Mega menu: 220ms fade+4px rise; drawer: 320ms slide.
- All wrapped in `@media (prefers-reduced-motion: reduce)` fallbacks.

## Layout

- Container 1440px max, 24px/40px gutters; 12-col grid where needed, flex elsewhere.
- Hairline-rule rhythm (1px --line) instead of card shadows; shadows reserved for overlays.
- Dark bands top and bottom sandwich light catalog body.
- Z-scale: dropdown 30 · sticky 40 · overlay-backdrop 50 · drawer/menu 60 · toast 70.

## Imagery

Client's real product photography (hartfordrents.com/wp-content/uploads/…) on white tiles; venue/stage photography for hero and section breaks (dark, stage-lit). Alt text in technical voice.
