---
name: palette
description: Make charts, documents, slide decks, dashboards and app-UI screens in the AppSec house style (cream paper, Inter, huge two-tone headlines, ruled KPI strips, rounded figure cards, ink-grey charts where colour means severity only) and export them as PDF and PNG, or as a live HTML dashboard. Use when asked for a chart, graphic, one-pager, report, brief, doc, deck, slides, dashboard, console mock-up or UI screen "in our style", "house style", "like the PDF", "like the Q3 review", or any AppSec visual that should be a PDF or PNG.
---

# palette: charts, docs, slides, dashboards → PDF / PNG

The style guide is `reference/style-guide.md`. Read it before building anything. For a dashboard
or UI screen also read `reference/ui-patterns.md`.

**Private layer.** If `local/NOTES.md` exists, read it first: it holds this install's private
context (reference artefact, branded templates, data sources, team rules). `local/` is gitignored
and never ships with the repo. `scripts/new.sh` prefers `local/templates/<kind>.html` over the
public template when one exists.

```
assets/style.css    tokens + components + three formats (body.doc / body.slides / body.graphic)
assets/ui.css       dashboard and app-UI layer (body.dash): shell, filters, KPI selector, rows, drawer
assets/charts.js    AS.bars, diverging, lines, hbars, dots, flow, heat, strip, annotate,
                    area, compare, track, multiples, mix, kpiSelect (+ hover tooltips)
assets/check.js     layout check (overflow, chart over note) written to <body data-check>
assets/fonts/       Inter, Geist Mono (embedded, works offline)
templates/          graphic.html, slides.html, doc.html, dashboard.html (working examples, fictional data)
reference/          style-guide.md (read first), ui-patterns.md (dashboards)
scripts/new.sh      copy a template to a working file with absolute asset paths
scripts/render.sh   HTML → PDF (headless Chrome) → PNG per page, plus the layout check
local/              private, gitignored: NOTES.md, branded templates, research (optional)
```

## Pick the format

| Ask | Format | Template | Canvas |
|---|---|---|---|
| one chart / image / Slack graphic / social card | graphic | `templates/graphic.html` | 1600x1000 px by default; set `--w/--h` on body AND `@page` |
| deck, slides, presentation | slides | `templates/slides.html` | 1600x900 per `<section class="slide">` |
| report, doc, one-pager, brief | doc | `templates/doc.html` | US letter per `<section class="page">` |
| dashboard, console, app screen, UI mock-up | dash | `templates/dashboard.html` | 1440 wide per `<div class="screen">`; set `--w/--h` on body AND `@page` |

If the ask doesn't say which, use graphic for a single chart, doc for anything with prose. Ask only
if it could reasonably be either a deck or a doc.

## Steps

1. **Get the numbers first.** Every figure comes from a source you actually read (query, file,
   pasted data). Write down the source per number. No invented or "illustrative" values in a real
   deliverable; the templates' data is fictional and must be replaced.
2. **Write the words before the layout.** Headline in two clauses (fact, then grey consequence),
   one finding-sentence per figure title, a sub line saying what is plotted, a note saying what
   to take from it. Voice rules are at the end of the style guide.
3. **Start from a template:** `<skill>/scripts/new.sh <graphic|slides|doc|dashboard> <out.html>`
   into the working folder (the user's named location, else the session scratchpad), named for
   the content (`Repo_Archive_2026-11-12.html`). It rewrites asset links to absolute paths into
   this skill, so the copy renders from anywhere. Templates in the repo use `../assets/` and open
   in place.
4. **Build.** Use the component classes; don't restyle them. Pick the chart by the data's job
   (style guide, Charts). Set each chart's `W` near its rendered width in CSS px (doc cover about
   690, doc card about 640, slide half-card about 760, full slide card about 1400). Severity
   always goes through `color: 'high'` etc. Anything that isn't severity stays in the neutrals.
5. **Render:** `<skill>/scripts/render.sh <file.html> [outdir] [scale]` (`<skill>` is this
   skill's folder, usually `~/.claude/skills/palette`)
   * It prints `check: data-check="OK"` or a list of problems, writes `<name>.pdf`, and writes
     `<name>.png` (one page) or `<name>-01.png ...` (one per slide or page) at 2x by default.
   * Exit 2 means the layout check failed: content spills off a page or slide, or a chart overlaps
     its note. Fix it: shorten the text, lower a chart's `H`, or move a block to the next page.
     Don't shrink type below the doc scale.
   * Don't pipe its output into `head`: that kills the script before the PNG step.
6. **Look at every PNG** with Read. Check for label collisions, a headline wrapping to an orphan
   word, empty bottom space on a page (fill it or end the page earlier), and text sitting on dark
   marks. The script checks geometry, not taste.
7. **Deliver** the PDF and PNG paths. Mention anything you couldn't source.

## Rules that matter most

* Colour = severity (Critical `#4a2c17`, High `#722f37`, Medium `#8a5d18`, Low `#004225`), and
  nothing else. Ring = fixed, filled = open.
* The part that matters is darkest ink; context is light grey.
* Headlines: numbers first, full stops, second clause in `<em>`.
* Chart over table. One strong chart beats two.
* Plain human voice: no em dashes, no middle dots, no filler, only provable claims.
* No dark page backgrounds. Paper is always cream; emphasis comes from ink weight, the part band
  gradient and soft orbs.

## Dashboards and UI

* `body.dash` + `ui.css`. Opened in a browser the file is live: KPI tiles switch the chart
  (`AS.kpiSelect`), chart marks show tooltips. The PDF and PNG show the default state, so make the
  `.on` tile the one that tells the story.
* The chrome is monochrome. Status is a word in a neutral `.spill`, never a colour. Severity is the
  only coloured mark (`.sev.high` dot + word, ring for fixed).
* One chart per card in a `.tray`; every chart card has a way to the rows behind it (a link button)
  and says what it plots. Anomaly card (`.anom`) at most once per screen.
* Real data only, same as everything else. The template's numbers are sample data.

## Notes

* render.sh finds Chrome, Chromium or Edge (override with `CHROME=`). On macOS the PNG step uses
  `pdf2png`, built from `pdf2png.swift` on first run (needs Xcode command line tools); on Linux it
  uses `pdftoppm` from poppler.
* Blurred box-shadows print as flat grey boxes, even small layered ones. Print CSS swaps every
  shadow for the hairline ring. If you add a component with a shadow, add its print override in the
  stylesheet that defines it (a print rule in style.css loses to a later rule in ui.css).
* Hidden absolutely-positioned elements (tooltips) still print their box; the hover layer hides
  `.tip` in print. Keep it that way for anything that only matters on hover.
* Pages and slides are fixed-height flex columns: blocks keep their size, and only `.cols` or
  `.grow` stretches into leftover height.
* For a chart type with no helper (survival curves, bubble scatter), draw inline SVG with
  `AS.root` / `AS.el` and the chart text classes so it still matches.
