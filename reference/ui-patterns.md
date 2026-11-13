# Dashboards and app UI

Working example: `templates/dashboard.html` (overview screen + triage queue with a detail drawer).
Classes live in `assets/ui.css`; charts in `assets/charts.js`.

## The rules

1. **Monochrome chrome, severity as the only colour.** Nav, buttons, tabs, filters and status are ink
   greys. A severity mark (`.sev.crit/.high/.med/.low`, dot + word; `.fixed` for a ring) is the one
   coloured thing in a row. Status (Unreviewed, AI-triaged, Fixed, Risk accepted) is a word in a
   neutral `.spill`.
2. **Depth from hairlines.** Cards are `.panel` or `.tray > .card` with `--ring`. Shadows only on things
   that float over content: `.tip`, `.anom`, `.drawer` (`--pop`).
3. **One primary action per screen**, `.btn.ink`. Everything else `.btn` or `.btn.ghost`.
4. **Every chart answers "show me the rows".** A link button under or beside it ("Findings in this
   range ↗"). An export icon button if the data can leave.
5. **The KPI strip picks the chart.** `.kpis` with `<button data-k>` tiles, wired by
   `AS.kpiSelect(strip, plot, {key: el => AS.area(el, ...)})`. Tiles show label, value (units small
   and grey), one context line. No sparklines and no delta arrows inside tiles. A severity count may
   colour its number (`b.high`).
6. **Neutral until grouped.** A single series is ink. Severity colours appear when the view is split
   by severity, never as decoration.
7. **Density:** 13.5–14px UI text, 34px nav rows, 32px controls, rows about 56px (two lines) or
   `.rows.dense` for tables. Ids, paths and counts in Geist Mono.

## Shell

```
.screen (grid: --side 248px | 1fr)
  nav.side   .brand, .switch (product switcher), a / a.on, .grp labels (sentence case), .bottom
  main.main  .top (crumb, search ⌘K, ghost buttons, avatar)
             .body  .phead (eyebrow + two-tone h1 + .acts) → .tabs → .filters → content
  aside.drawer (optional, absolute right, 400px)
```

Page headlines follow the house pattern at 32px: `297 open. <em>52 past SLA.</em>`

## Components

| Need | Class | Notes |
|---|---|---|
| filter | `.chip > span.k + span` | `.chip.on` = applied (ink, × to clear); `.chip.add` = "+ Group by"; `.sep` between groups |
| view switch | `.seg > a.on` | List / By repo / By rule; Linear / Log |
| tabs | `.tabs > a.on` | counts in `.ct` mono |
| card | `.panel` with `.phd` (h3 + p) and `.pft` | or `.tray > .card` for the hero chart |
| KPI selector | `.kpis > button.on` | `--cols` tiles, `AS.kpiSelect` |
| list | `.rows > .rhead + .row` | `--rowgrid`, `.t` title, `.s` sub with `code`, `.age.over` past SLA, `.row.sel` |
| top N | `.rank > div > .bar > i.high + span` + `em` | width = share of the max |
| detail | `.drawer > .dh .db .df` | sections `.sec` with `.micro` label; `.trace` code with `.hit` line; `.tl` history |
| floating note | `.anom` | one per screen, pinned near the point it explains, one action |
| tooltip | automatic | any chart from `AS.area/compare/track` gets one; custom marks: `data-tip` JSON + `AS.hover(svg)` |
| forms | `.field`, `.input`, `.input.area`, `.check(.on)`, `.toggle(.on)` | |
| empty | `.empty > b + text` | no illustrations |
| severity mix in a cell | `AS.mix(el, {critical, high, medium, low}, {W, H})` | thin stacked bar |

## Rendering

`render.sh` prints one PDF page per `.screen`. Set the same size in `body style="--w;--h"` and in
`@page`. The layout check flags anything spilling out of a screen. The live HTML is the deliverable
when someone will click around; the PNG is the deliverable for a deck or Slack.
