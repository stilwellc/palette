# Layouts: decks, reports, social images, product pages, mobile

Each layout below exists in a template with sample data. Start from the template (`scripts/new.sh`),
keep the blocks you need, delete the rest. Slides and pages are fixed-height flex columns: blocks keep
their size, and only `.cols`, `.split`-style grids or an element with `.grow` take leftover height.

## Deck (`templates/deck.html`, 1600x900)

| Slide | Build it from | Rule |
|---|---|---|
| Cover | `.mast` with a `.lockup`, `.tag`, `.h-hero`, `.lede`, orbs | the only slide with orbs besides an opener or quote |
| Agenda | `.agenda.grow`, `li.on` for the current part | at most five rows |
| Section opener | `.slide.opener`: eyebrow + `.h-part` at the top, an `.orbx` top right, `.low` with a lede and a `.spec` list | the middle of the slide stays empty |
| Hero stat + chart | grid `1fr 2fr`: `.tile.ink` with one number beside a chart card | the tile is the slide's ink block |
| Benchmark | headline left, `.cellx` holding a card with `AS.bench` right | the hero bar is the slide's signal mark |
| Summary grid | `.bento` of `.bc` cells (`.c2`..`.c12`, `.r2`, `.r3`) | below |
| Versus | `.vs` with two cards, `.fav` on the favoured one | same rows on both sides |
| Phases | `.phases` of three `.tile` (ink, stone, `.mid`) with `.nb` badges | three steps, four at most |
| Quote | `.quote` (second clause in `<em>`), `.author` | under 25 words |
| Roadmap | `AS.gantt` in a card, `.legend4` | one committed bar in ink, `ghost` for unstaffed |
| Logo wall | `.logos`, `.cobrand` | one ink, one height |
| Close | `.sums.grow`, then `.takeaway` | the takeaway is the ask, in one sentence |

**Chart card anatomy** (every chart on a slide or page): micro label or figure number, a `.legend4`
on the right, the finding as a full sentence, the plot, a hairline, a grey `.method` line (what was
measured, the window, n, the source).

**Summary grid.** 12 columns, 14px gutter, 28px radius. One hero cell (`.bc.hero`, about 12 to 25% of
the area, the slide's ink block) holding the title. Every other cell holds one thing: a number with a
label of five words or fewer (the number pinned to the bottom, a micro label at the top), an icon disc
with a label, one small chart, or one statement (`.st`). No body copy. At most one cell on a colour
cell, at most one on stone. Nine to fourteen cells.

**Footer.** Left: a `.ports` strip showing the part of the deck (or, in a short deck, the slide), then
the deck name. Right: the number.

**A short deck** is five slides: cover, hero stat with chart, one chart, a chart pair, close.

**Sizes that fit.** Two-thirds card: chart about 940 x 470. Half card: about 690 x 440 with a
one-line title. Full card: about 1400 x 520. The hero number in an ink tile: 168px for up to four
characters, about 128px for five. A `.plot` centres its chart and does not stretch it.

**Glue classes the templates use.** `.fcard` (a card laid out as a chart card), `.chd` (its top row:
label left, legend right), `.plot` (the box the chart is drawn in), `.method` (the grey line under a
hairline), `.rel` (sits above the cover glows), `.tile > b > small` (the unit after a big number),
`.tile .bar` (a thin progress bar), `.low` (pins what follows to the bottom).

## Report (`templates/whitepaper.html`, A4; `templates/doc.html`, letter)

**One page** (`templates/brief.html`, signal mode): running header, headline, a meta row, three
summary bullets, two chart cards, a strip of four numbers, the takeaway bar, a method line. That is
what a letter page holds. If it does not fit, cut a block; never shrink type. A row of cards on a
full page needs `style="flex:none"`, or it shrinks under its content and overlaps what follows (the
layout check reports it).

A4 is `<body class="doc a4">` with `@page{size:210mm 297mm}`. Every page after the cover starts with
a `.rhead` running header (lockup, section, page).

| Page | Build it from |
|---|---|
| Cover | micro eyebrow, `.h-hero`, dek, `.author`, a `.cellx` over the lower half holding the one chart that matters |
| Contents | `.toc` (title, grey line, dotted leader, page) and a numbered "what you will learn" list |
| Section opener | `.page.opener`: `.h-part` at the top, `.low` with a lede and a `.spec` list or `.pullq` |
| Stat page | `.tile.ink` at one third beside a chart card at two thirds; stone tiles with a thin `.bar` beside a ruled table |
| KPI grid | `.tilegrid` of six `.tile`, each with a category `.spill.cat`, a number, a two-line caption with a `sup.fn` |
| Process | `.phases` |
| Close | `.vs` or one last figure, `.takeaway`, `.sources`, a colophon |

Notes can sit in a right rail (`.withrail` > content + `.rail`) on data pages instead of the foot.

## Social images (`templates/social.html`)

One file, several page sizes: `<body class="social">` holds `<div class="canvas og">`, `sq`, `story`,
`wide` or `portrait` (1080x1350). Each is a named page, so render.sh writes one PNG per canvas. Delete
the canvases you do not need.

| Canvas | Size | Type floor |
|---|---|---|
| `og` link preview | 1200x630 | 16px |
| `sq` square | 1080x1080 | 20px |
| `story` vertical | 1080x1920 | 20px; keep the top 250px and bottom 300px free of text |
| `wide` announcement | 1600x900 | 16px |

Draw charts with a small `W` (about half the rendered width on story and square) so chart text scales
up with the image. Social cards keep the cover glows even with a chart. If the chart takes
`color:'signal'`, the tag must not also be `.sigc`: one signal mark per canvas. With no domain or
study to cite, the foot holds the tagline left and the date right. One claim per image. Lockup once. Close a square or wide card with a `.takeaway`.

## Print pieces

| Piece | Template | Notes |
|---|---|---|
| Invoice | `invoice.html` | line items in `table.tbl` with `.n` numeric cells and a grey `small` sub-line; the total is the page's ink block; the due tag is the signal mark. The sums must add up |
| Certificate | `certificate.html` | `body.doc.wide` (landscape letter), a ruled frame, the name very large, one small orb as the seal |
| Badges | `badge.html` | four identical badges per sheet with crop hairlines; the repeated fields are marked in comments for a mail merge |
| Posters | `print-poster.html` | A3 portrait and A4 landscape as named pages sized in mm; body type 19px or more on A3 |
| Thumbnails | `thumbnail.html` | 1280x720; at most seven words; type 44px or more; keep the bottom right 220x90 clear |
| Email headers | `email-header.html` | nothing important within 24px of an edge. Do not name a canvas `mast`, `sig` or `meta`: those are core classes |

An orb may run off the top or right edge (class `bleed` on its wrapper). Never off the bottom: it
prints with a second disc behind it. A `.bignum` with a comma at 380px or more needs about 60px of
extra space below it.

## Product page (`templates/landing.html`, 1440 wide)

`<body class="dash">` with `<div class="screen bare"><div class="web">`. Width comes from `.wrap`
(combine it: `class="nav wrap"`, `class="footer wrap"`).

`.banner` → `.nav` (lockup, links, one ghost and one primary) → hero (`.h-web`, lede, `.btn.ink.lg` +
ghost) → hero visual in a `.cellx` (a real chart or a real fragment of the product, never a stock
picture) → `.logos` → `.feat` grid with icon discs → `.sect.alt` proof (a `.tcard` beside a `.bento`
of numbers) → `.plans` (the recommended plan gets the cell header, the "Popular" `.badge` and the
only `.btn.ink` in view) → `.takeaway` → `.footer` + `.fine`.

One primary button per viewport height. No shadows on the page; `.modal`, `.toast`, `.cmdk` and
`.sheet` are the only things that float.

## Mobile (`templates/mobile.html`)

`.device > .scr` is a 390x844 screen. Inside: `.island`, `.mstat`, `.mhead` (two-clause headline at
30px), `.mbody` with `.mcard` and `.mlist`, `.tabbar` (four tabs, icon over label), `.homebar`.
A decision is a `.sheet` over a `.scrim` with one `.btn.ink.lg.block` and one ghost. Touch targets
are 44px or more (`.seg.fill`, `.device .btn.lg`, `.device .toggle` are sized for it). One signal
mark per screen. Present screens three across on a `body.graphic` canvas with a caption under each.
