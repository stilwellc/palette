---
name: palette
description: Design anything visual in one editorial house style and export it as PDF and PNG, or as live HTML. Charts and graphs, slide decks, reports and one-pagers, white papers, dashboards and app UI, product and landing pages, mobile screens, social and link-preview images, brand sheets with a logo mark, icons and labels. Cream paper, Inter, huge two-tone headlines, ink-grey charts, one small signal colour (or severity colours for security work). Use when asked for a chart, graphic, image, PNG, PDF, deck, slides, presentation, report, brief, doc, one-pager, white paper, dashboard, UI screen, mock-up, landing page, app screen, social card, OG image, logo, icon, brand guide or design system "in our style", "house style", "like the Q3 review", or for any design task with no other style named.
---

# palette: charts, decks, reports, UI, images → PDF / PNG

Read `reference/style-guide.md` before building anything. Then read what the job needs:

| Job | Also read |
|---|---|
| anything that is not a security or severity report | `reference/brand.md` (the 88 / 11 / 1 colour rule, shape, marks, icons, labels) |
| deck, white paper, brief, social image, product page, mobile screen | `reference/layouts.md` |
| any chart | `reference/charts.md`: the pick table and sizing at the top, then only the section for the helper you use. Do not read `charts.js` |
| dashboard, console, product page, mobile, any UI | `reference/ui-patterns.md` |

**Two colour modes. Pick one per piece and never mix them.**
* **Severity** (security findings, risk, SLAs): colour means Critical, High, Medium, Low and nothing
  else. This is the original mode; `slides`, `doc`, `dashboard` templates show it. `graphic` works
  in either mode.
* **Signal** (everything else): ink greys plus one signal colour, about 1% of the page, on the one
  mark that is live, new or the claim. `brief`, `deck`, `whitepaper`, `landing`, `mobile`, `social`,
  `brand`, `charts` templates show it.

**Private layer.** Try to read `local/NOTES.md` first (not found is normal; carry on): it holds this install's private
context (reference artefact, branded templates, data sources, team rules). `local/` is gitignored
and never ships with the repo. `scripts/new.sh` prefers `local/templates/<kind>.html` over the
public template when one exists.

```
assets/style.css    tokens + components + three formats (body.doc / body.slides / body.graphic)
assets/ui.css       dashboard and app-UI layer (body.dash): shell, filters, KPI selector, rows, drawer
assets/ui.css       (same file) product pages, overlays, phone frame and mobile components
assets/charts.js    AS.bars, diverging, lines, hbars, dots, flow, heat, strip, annotate,
                    area, compare, track, multiples, mix, kpiSelect (+ hover tooltips),
                    bench, dumbbell, slope, scatter, waterfall, funnel, bullet, donut, waffle,
                    meter, stepgrid, matrix, spark, gantt, theme
assets/data.js      AS.col, AS.labels, AS.rowsFor, AS.pairs, AS.change: chart straight from a data file
assets/motion.js    AS.reveal, AS.countUp, AS.fadeUp: animate any drawn chart for the GIF export
assets/icons.js     110 original line icons (<i class="ic" data-i="name">), AS.mark brand marks,
                    and the painter for orbs (<i class="orbx dawn">)
assets/check.js     layout check (overflow, chart over note, unknown icon, signal over budget)
assets/fonts/       Inter, Geist Mono (embedded, works offline)
templates/          severity: graphic, slides, doc, dashboard
                    signal: brief, deck, whitepaper, landing, mobile, social, brand, charts (catalogue),
                    invoice, certificate, badge, thumbnail, email-header, poster
                    animation: pitch, chart-reveal
examples/           finished pieces for range: poster, menu, résumé, investor update, talk, spec sheet,
                    year recap. Look at one when a job has no template (do not copy its content)
reference/          style-guide.md (read first), brand.md, layouts.md, charts.md, ui-patterns.md
scripts/new.sh      copy a template to a working file with absolute asset paths
scripts/render.sh   HTML → PDF (headless Chrome) → PNG per page, plus the layout check
scripts/pptx.py     HTML → PowerPoint / Google Slides. --editable: real text boxes over a text-free picture
scripts/data.py     CSV, TSV, JSON or .xlsx → a data file the page charts from, plus a summary of the numbers
scripts/snapshot.sh visual regression against tests/snapshots (CI)
scripts/animate.sh  an animation page (templates/pitch.html) → looping GIF
local/              private, gitignored: NOTES.md, branded templates, research (optional)
```

## Pick the format

| Ask | Format | Template | Canvas |
|---|---|---|---|
| one chart / image / Slack graphic / social card | graphic | `templates/graphic.html` | 1600x1000 px by default; set `--w/--h` on body AND `@page` |
| deck, slides, presentation | slides | `templates/slides.html` | 1600x900 per `<section class="slide">` |
| one-page brief, memo, proposal, update (not security) | doc | `templates/brief.html` | US letter, one page, signal mode |
| security or risk report, findings summary | doc | `templates/doc.html` | US letter per page; severity mode. For one page keep page 1 (cover) or page 3 (brief) |
| dashboard, console, app screen, UI mock-up | dash | `templates/dashboard.html` | 1440 wide per `<div class="screen">`; set `--w/--h` on body AND `@page` |
| pitch, board or product deck, all-hands | slides | `templates/deck.html` | 1600x900; 12 layouts incl. agenda, summary grid, versus, roadmap |
| white paper, industry report, A4 anything | doc a4 | `templates/whitepaper.html` | A4 per `<section class="page">` |
| landing or product page, pricing page | dash | `templates/landing.html` | 1440 wide, `.screen.bare > .web` |
| mobile app screens | graphic | `templates/mobile.html` | 390x844 `.device` frames on one canvas |
| social card, OG image, story, announcement | named pages | `templates/social.html` | 1200x630, 1080x1080, 1080x1920, 1600x900 in one file |
| logo, brand guide, icon sheet, design system | slides | `templates/brand.html` | 1600x1000 per page |
| invoice, quote, receipt | doc | `templates/invoice.html` | US letter, one page |
| certificate, award, diploma | doc wide | `templates/certificate.html` | landscape letter |
| event badges, name tags | doc wide | `templates/badge.html` | four 4x3in badges per sheet, crop marks |
| video thumbnail | named pages | `templates/thumbnail.html` | 1280x720, three compositions |
| email or newsletter header, signature | named pages | `templates/email-header.html` | 1200x400, 1200x300, 600x200 |
| print poster, sign | named pages | `templates/poster.html` | A3 portrait, A4 landscape |
| animated chart for a post or slide | animation | `templates/chart-reveal.html` | 1200x675; `AS.reveal` from `assets/motion.js`; export with `scripts/animate.sh` |
| short animation, README or launch GIF | animation | `templates/pitch.html` | 1200x675, drawn per instant from `#t=`; export with `scripts/animate.sh` |
| "which chart?" | n/a | `templates/charts.html` | catalogue with one working call per newer helper |

`graphic.html` works in either colour mode: it has no severity marks until you add them.

If the ask doesn't say which, use graphic for a single chart, doc for anything with prose. Ask only
if it could reasonably be either a deck or a doc.

## Steps

1. **Get the numbers first.** Every figure comes from a source you actually read (query, file,
   pasted data, the user's own message). Given a CSV, TSV, JSON or .xlsx, run
   `${CLAUDE_SKILL_DIR}/scripts/data.py <file>`: it prints the figures you will quote (first, last,
   min, max, sum, change) and writes `<file>.data.js`. Load that and `assets/data.js` with script
   tags and chart from it (`AS.pairs(DATA, {label, a, b})`, `AS.rowsFor`, `AS.col`), so no value is
   typed by hand. Say where each came from in the piece itself: the
   `.method` line under a chart, or the footer. Figures you derive (a sum, a percent change) are
   fine when their inputs are on the page. No invented or "illustrative" values in a real
   deliverable; the templates' data is fictional and must be replaced.
   * No team or brand name given? Put the document's title in the masthead as plain text (not in a
     `.lockup`, which lowercases it and implies a logo). No as-of date? Put the period in the pill.
     A source figure that disagrees with its own inputs: print it with the inputs and flag it at
     delivery.
   * Never leave "Acme" or "Halden": the layout check fails on them.
   * Nothing in the data supports a recommendation? Then the closing bar is the one thing to watch,
     not an ask. In a PDF or image the bar never has a button.
2. **Write the words before the layout.** Headline in two clauses (fact, then grey consequence),
   one finding-sentence per figure title, a sub line saying what is plotted, a note saying what
   to take from it. Voice rules are at the end of the style guide.
3. **Start from a template:** `${CLAUDE_SKILL_DIR}/scripts/new.sh <kind> <out.html>` (kind = any file name in
   `templates/` without `.html`)
   into the working folder (the user's named location, else the session scratchpad), named for
   the content (`Repo_Archive_2026-11-12.html`). It rewrites asset links to absolute paths into
   this skill (the real path, if the skill folder is a symlink), so the copy renders from
   anywhere. Templates in the repo use `../assets/` and open in place.
   * Read the copy before writing any words: its header comment is the layout spec. Then replace
     that comment with a one-line note of your sources.
   * A template is several sample pages. Delete the pages, blocks and chart calls you do not use.
     A short deck is five slides: cover, hero stat with chart, one chart, a chart pair, close.
   * One request can need two files (a social card and a logo sheet). Make two.
   * "Make us a logo": page 1 of `brand.html` (mark and lockup). Add page 2 only for a full guide.
4. **Build.** Use the component classes; don't restyle them. Pick the chart by the data's job and
   copy its call from `reference/charts.md`. Set each chart's `W` near its rendered width in CSS px (doc cover about
   690, doc card about 640, doc half card about 300, slide half-card about 690, full slide card
   about 1400; heights and the rest are in `reference/charts.md`). Severity
   always goes through `color: 'high'` etc. Anything that isn't severity stays in the neutrals;
   in signal mode the one mark that carries the claim may take `color: 'signal'`. Icons come from
   `icons.js` only (`<i class="ic" data-i="...">`, add its script tag); never paste SVG from
   another icon set, and never draw a real company's logo.
   * `AS.theme({...})` goes on the first line of the page's bottom `<script>`, before any chart.
5. **Render:** `${CLAUDE_SKILL_DIR}/scripts/render.sh <file.html> [outdir] [scale]` (outdir
   defaults to the HTML file's folder)
   (`${CLAUDE_SKILL_DIR}` is the folder this SKILL.md is in. If you see it written out literally,
   use that folder's path: usually `~/.claude/skills/palette`, or the plugin's install folder.)
   * It prints `check: data-check="OK"` or a list of problems, writes `<name>.pdf`, and writes
     `<name>.png` (one page) or `<name>-01.png ...` (one per slide or page) at 2x by default.
   * Exit 2 means the layout check failed: content spills off a page or slide (it says by how
     much), two blocks overlap, a chart overlaps its note, an icon name does not exist, sample
     names are left in, or the signal colour covers more than 5% of a page. Fix it: shorten the text, lower a chart's `H`, or move a block to the next page.
     Don't shrink type below the doc scale.
   * Don't pipe its output into `head`: that kills the script before the PNG step.
6. **Look at every PNG** with Read. Check for label collisions, a headline wrapping to an orphan
   word, empty bottom space on a page (fill it or end the page earlier), a chart floating in a
   half-empty card (raise its `H` or `rowH`; render.sh prints a `note:` line when it sees one), and
   text sitting on dark marks. The script checks geometry, not taste.
7. **Deliver** the PDF and PNG paths. Mention anything you couldn't source. If they asked for
   PowerPoint, Keynote or Google Slides, also run `${CLAUDE_SKILL_DIR}/scripts/pptx.py <file.html>
   --editable`: text becomes real, editable text boxes over a picture of everything else. Say
   plainly what is not editable (shapes, charts and chart labels) and that the HTML stays the
   source. For Google Slides the user uploads the .pptx to Drive and opens it. Without
   `--editable` every slide is one picture with its text in the notes. It needs
   only Python 3, and re-renders into a temp folder, so ignore the temp paths it prints.

## Rules that matter most

* Severity mode: colour = severity (Critical `#4a2c17`, High `#722f37`, Medium `#8a5d18`, Low
  `#004225`), and nothing else. Ring = fixed, filled = open.
* Signal mode: 88 parts paper, 11 parts ink, 1 part signal (`#2b44d9`). One signal mark per view,
  never on a headline, body text, button, background or logo. Change it with `AS.theme({signal})`.
* One ink block per page (an ink tile, the summary grid's hero cell, or the takeaway bar).
* What counts as the signal mark: a bar, dot, tag, cell or line in a chart or layout. A legend
  swatch explaining it and the dot in the cover logo do not count.
* A different brand: one line at the top of the page script,
  `AS.theme({paper: '#eef1f4', ink: '#0e1c2f', signal: '#e4502a'})`. It derives every grey, card
  and ground from those three and charts follow. Never hard-code a hex in a page: use the tokens
  (`var(--ink)`, `var(--n3)`) in markup and tone names (`'n1'`..`'n6'`, `'signal'`, `'paper'`) in
  chart data.
* Several image sizes in one file: `<body class="social">` with `<div class="canvas og|sq|story|
  wide|portrait">`. On big canvases scale small labels with `.x15` / `.x2`. Art that is meant to run
  off the edge gets class `bleed`, or the layout check will flag it.
* The part that matters is darkest ink; context is light grey.
* Headlines: numbers first, full stops, second clause in `<em>`.
* Chart over table. One strong chart beats two.
* Plain human voice: no em dashes, no middle dots, no filler, only provable claims.
* Dark is a whole-piece mode, `AS.theme('dark')` (or `{dark: true, signal: ...}`), used only when
  asked for or when the piece will sit on a dark surface (a stage screen, a dark app). Never a dark
  section inside a light piece, or the reverse.
* In a light piece paper is always cream; emphasis comes from ink weight, the tile ramp
  (ink, stone, grey), the part band gradient, one colour cell and soft orbs.
* Shapes nest: inside a 24px card, inner corners are 6 to 8px or full pills. Controls are pills,
  tags are square. Icons are one line weight, one idea each.
* Art is one orb (`.orbx`): a soft gradient sphere on a cover, opener or quote, or as the face of
  something with no picture. One large orb per page, nothing on top of it. No stock imagery.
* The mark appears once per page, in one ink. Other people's logos: one ink, one height, in a grid.

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
