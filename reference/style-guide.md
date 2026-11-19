# AppSec house style

Derived from an internal quarterly security review (a long-form report PDF), then extended with a
study of a well-made product site and app. Every token below is in `assets/style.css`. If
`local/NOTES.md` names a private reference artefact, open it when unsure.

## The look in one line

Warm cream paper, near-black ink, one huge tight headline whose second clause goes grey, open
ruled KPI strips, soft rounded figure cards, and charts in ink greys where colour appears only to mean
severity.

## Tokens

| Token | Value | Use |
|---|---|---|
| paper | `#f5f0e6` | page background |
| paper-2 | `#fbf8f1` | cards, chart surface |
| ink | `#1c1917` | headlines, primary marks |
| ink-2 | `#57514a` | body text, ledes |
| ink-3 | `#6a6358` | captions, axis text, eyebrows |
| ink-soft | `#8f877b` | the grey second clause of a headline (`<em>`) |
| line / line-2 | rgba(36,30,21,.10 / .18) | hairlines; line-2 for strip borders |
| chip | rgba(36,30,21,.07) | Fig. pills, refs |
| Critical | `#4a2c17` | deep brown |
| High | `#722f37` | wine |
| Medium | `#8a5d18` | amber |
| Low | `#004225` | racing green |
| neutrals | `#1c1917 #5a5550 #8c8478 #b9b1a4 #d9d2c5 #e6e1d6` | non-severity data, darkest = what matters |
| part band | gradient 120deg `#ecdfcb → #efe3d6 → #e6e2ee`, wine glow top right | Part openers |
| orbs | peach/pink, periwinkle/lilac, butter, blurred 70px at 55% | cover and hero only |

Fonts: **Inter** 400/500/600 (body, headlines, labels), **Geist Mono** 400/500 (axis ticks, chart
values, small codes). Both ship in `assets/fonts/`. Numbers are tabular.

## Type scale

| Role | Slides / graphic | Doc (letter) |
|---|---|---|
| Hero headline `.h-hero` | 112px / 600 / -0.045em / lh .96 | 66–76px |
| Slide headline `.h-slide` | 72px (60 for long ones) | n/a |
| Part title `.h-part` | 88px / -0.05em | 46px |
| Section `.h-sec` | 40px / -0.032em | 28px |
| Lede `.lede` | 21px, ink-2 | 17px |
| Figure title `.card h3` | 21px / 600 | 16px |
| Body, sub, note | 15px, ink-2 | 12.5–13px |
| KPI number `.tiles b` | 40px / 500 | 30px |
| Eyebrow, caption | 13px / 500, ink-3 | 11.5px |
| Axis ticks | 11px Geist Mono, ink-3 | same |

## Headline pattern

Two clauses. The first is the fact, in ink. The second is the consequence or the "so what", in
ink-soft (`<em>`). Short, full stops, numbers first:

- `248 found. 97 fixed. <em>290 still open.</em>`
- `Intake doubled. <em>The mix turned serious.</em>`
- `Six things the quarter <em>says.</em>` (the grey can be a single word)

Figure titles are a full sentence stating the finding ("Half of all Highs are fixed by day 52. The SLA
is day 14."), never a label ("Time to fix"). The sub line says what is plotted. The note under the
rule says what to take from it, with **bold** severity names or key numbers.

## Components (class names)

- `.mast` masthead: dot mark + team name, centre label, `.pill` "Data as of ...".
- `.tag` black pill above a hero: the period or edition.
- `.tiles` open KPI strip, ruled top and bottom, hairline dividers. `--cols` sets the count. Each tile:
  `b` number, `span` bold label, `small` context.
- `.stats` boxed stat cards (translucent paper, 20px radius) for a row of supporting numbers.
- `.part` gradient band: `.eyebrow.wine` "Part I", `.h-part`, `p`.
- `.chap`: `.eyebrow` "Chapter 01", `.h-sec`, `p`.
- `.card` figure: `.kick` with `.fig` pill + method caption, `h3` finding, `.sub`, the chart, `.note`.
- `.key` legend: `i.sw-high` swatches, `i.ring` for fixed, `em` for a trailing explainer.
- `.sums` numbered summary cards (`.n` 01, `h4`, `p`, optional `.ref` "Fig. 2.3" chip).
- `.lessons` two-column ruled takeaways; `.steps` numbered list with mono counters.
- `.rule-lab` "In one minute" label with a hairline running right.
- `.chead` caption row above a chart: left what, right the total.
- `table.tbl` light ruled table, only when a chart cannot carry the data.

## Charts

Rules taken from the reference report:

1. **Colour means severity, everywhere, and nothing else.** Say so in a legend line on the first
   figure: "Colour means severity everywhere in this document, and nothing else."
2. Anything that is not severity is ink greys. The part that matters is darkest (verified, open,
   opened); context is light (noise, fixed, the rest).
3. **Filled = still open, ring = fixed** for dot marks.
4. Bars: square bases on the baseline, 4px rounded data end, a 2px paper gap between stacked
   segments. Direct value labels in Geist Mono above or beside bars, not on every point.
5. Lines are 2px. Several black lines are told apart by solid / dashed / dotted, with an end label
   ("290 open at quarter end") instead of a legend.
6. Gridlines are faint hairlines; axis text is 11px mono in ink-3. No chart borders, no dual axes.
7. Annotate one thing per chart with a thin curved leader and a 15px label (`AS.annotate`), e.g.
   "four in ten findings are one kind of bug".
8. One dot per item when counts are small enough (dot clusters, strip plots): the reader can count.
9. Prefer a chart to a table; prefer one strong chart to two weak ones.

Helpers in `assets/charts.js` (all draw SVG into an element; `W`/`H` are viewBox units, so set `W`
near the rendered width in CSS px to keep text 1:1):

| Call | Draws | Report example |
|---|---|---|
| `AS.bars(el,{cats,series,segLabels,totals,xLabel})` | stacked or single vertical bars | Fig 1.1 right, 2.2 |
| `AS.diverging(el,{cats,up,down,notes})` | opened up / fixed down per period | Fig 1.3 |
| `AS.lines(el,{x,series:[{name,values,dash,color}]})` | lines with end labels | Fig 1.1 left |
| `AS.hbars(el,{rows:[{label,value,segs}]})` | ranked horizontal bars | champions list |
| `AS.dots(el,{groups:[{label,items:[{sev,fixed}]}]})` | packed dot clusters, one per item | cover |
| `AS.flow(el,{nodes:{left,right},links:[{s,t,v,dark}]})` | sankey | Fig 1.2 |
| `AS.heat(el,{rows,cols,values})` | grey heat grid | Fig 3.4 |
| `AS.strip(el,{values,log,ticks,median})` | dots on a (log) axis, stacked | Fig 4.6 |
| `AS.annotate(svg,[x0,y0],[x1,y1],text)` | leader + label | cover |

Not covered by a helper (Kaplan-Meier survival with bands, bubble scatter with whiskers): draw
them as inline SVG using `AS.el` / `AS.root` with the same classes (`.ax`, `.lab`, `.val`, `.ann`) and
colours.

## v2 additions (product study)

Sources: a full crawl of a well-made product marketing site (902 pages, CSS, 637 articles, 18 charts)
and its app UI. Taken: structure and discipline. Not taken: their logo,
symbol or lockups, their proprietary display font, their gradient and grain imagery, their accent and
categorical colours, any of their images. Inter and Geist Mono are open-licensed and stay.

**Depth.** `--ring` (0.5px hairline at ~15% ink) replaces 1px borders on controls and cards in UI.
`--lift` adds a 4% two-layer shadow for raised controls; `--pop` is for floating things only
(tooltip, popover, drawer). Static cards in UI sit in a `.tray`, never on a shadow.

**Controls are pills.** `.btn` (paper with lift), `.btn.ink` (the one primary action), `.btn.ghost`.
Filter chips `.chip` read "label | value"; an applied filter inverts to ink with an ×.
Segmented control `.seg`: paper thumb on a stone track. Underline tabs `.tabs`.

**Separators.** Dotted rule `.drule` (and dotted list dividers) for sections inside a block; solid
hairlines for structure. Uppercase micro-labels `.micro` (11px, +.07em) for drawer sections, stat
eyebrows and "FIGURE 3"; everything else stays sentence case.

**New blocks** (all formats):
- `.crumbs` + `.meta` label-over-value pairs (Prepared by / Period / Data as of / Scope), then `.drule`.
- `.summary`: 2-4 bullets straight after the headline. Exec readers stop here.
- `.statgrid > .statcard`: micro eyebrow, hero number (severity class colours it), one-line dek,
  `.win` window line at the bottom. `.ba` inside it: before/after bars on one scale.
- `.callout.high`: light stone panel with a severity rule on the left. Never a dark bar.
- `.figure`: `.micro` "Figure 3", two-tone h3, chart, `.caption` starting with bold "Figure 3.".
- `.method` paragraph and `sup.fn` + `ol.fns` footnotes: source, population, window, dedup rule.
- `table.cmp`: grey sub-line under each row label, inline qualifiers, best per row in bold
  (credit the other tool when it wins), `—` for not applicable.
- `.ask` band: the closing row, a two-tone statement left, ink pill + ghost pill right.
- `.sums.grow` on slides: takeaway cards fill the space, number top, words pinned bottom.

**New chart rules.**
1. **One coloured mark.** In a comparison, the bar or series that carries the claim gets its colour
   (severity, or ink when it isn't severity); every other bar is `#d9d2c5` with grey labels, and
   only the hero's x label goes ink (`AS.compare`, `hi:`).
2. **Never truncate a bar axis.** Bars start at zero, always.
3. **Value chips** (outlined pills above bars) replace an axis line; dotted gridlines only at labelled
   values.
4. **Dashboard time series** (`AS.area`): neutral ink line over a faint fill; 2-3 y ticks; x labels at
   the two ends only; severity colours appear only when the view is grouped by severity
   (`stack:true` with `color:'high'` series). Optional `mark:{i,label}` for one event.
5. **Shares** (`AS.track`): pill bar on a full-width track, dotted leader, big number right.
6. **Small multiples** (`AS.multiples`): same scale unless said otherwise, min and max labels only,
   dot on the latest value, dashed event line.
7. **Top N** in UI: `.rank` rows, label inside the bar, fill tinted by worst severity with a 3px cap.
8. Every chart has a method line somewhere on the page, and outcomes are paired with a baseline:
   "41 to 12 days (n = 37)", never "much faster".

## v3 additions (general design)

The brand layer (colour ratio, shape, marks, icons, labels) is in `brand.md`; page and slide layouts
are in `layouts.md`. Chart additions, all in `assets/charts.js`, working calls in
`templates/charts.html`:

| Call | Draws | Use it when |
|---|---|---|
| `AS.bench(el,{rows:[{label,value,hi,display}],color})` | thick rounded bars, hero in ink or signal, big figure at the bar end | "2.4x faster" |
| `AS.dumbbell(el,{rows:[{label,a,b}],names})` | before ring, after dot, both labelled, change in a right column | before and after, per group |
| `AS.slope(el,{left,right,rows:[{label,a,b,hi}]})` | one line per row between two moments | who moved, who did not |
| `AS.scatter(el,{points:[{x,y,r,label,hi}],mid,quads})` | scatter or bubble, pale except the `hi` points | two measures, one outlier |
| `AS.waterfall(el,{steps:[{label,value,total}]})` | start, rises, falls, end | how a number became another |
| `AS.funnel(el,{steps:[{label,value}]})` | pills on a track with share of the previous step | drop-off |
| `AS.bullet(el,{rows:[{label,value,target}]})` | value on a track with a target tick | against a goal |
| `AS.donut(el,{value,label})` or `{segs}` | ring with the number inside | one share; never more than four segments |
| `AS.waffle(el,{value,total})` | unit grid | a share people should be able to count |
| `AS.meter(el,{rows:[{label,value,color}]})` | segment level strip, last lit cell takes the colour | budgets, limits, capacity |
| `AS.stepgrid(el,{lanes:[{label,cells}]})` | lanes of on, off and flagged cells | cadence, uptime, releases |
| `AS.matrix(el,'99.98%',{dot,off})` | dot-matrix readout | one hero number; dot 4px or more |
| `AS.spark(el,[..])` | sparkline | a table cell or a tile |
| `AS.gantt(el,{cols,lanes,today})` | roadmap lanes with a today line | plans by quarter |
| `AS.theme({signal})` | sets the signal colour for charts and CSS | once, at the top |

Rules added with them:

1. **Three tones before any hue.** This period ink, the previous period mid grey (`#8c8478`), everyone
   else pale (`#d9d2c5`). Say which is which in a `.legend4`.
2. **`color:'signal'` once.** In a piece that is not about severity, the mark that carries the claim
   may take the signal colour. One mark, one chart, one page.
3. **Draw a chart at the size it will be shown.** Set `W` (and `H`) near the plot box in CSS px. A
   chart squeezed into a smaller box shrinks its labels with it.
4. **Both ends labelled.** A dumbbell or slope shows both values; the reader should not need the axis.
5. **Say the scale.** If groups do not share a scale, the method line says so.

## Voice

Plain, human, short sentences. No em dashes, no middle dots, no "not X but Y", no signpost filler
("It's worth noting"). Medians over means. Only claims the data proves; cite the count ("540 of 790"),
never "most" or "hundreds" unmeasured. In anything leadership-facing, names not ticket ids.
Outcomes always against a baseline and a window. Mark approximations with "about" or "~". Say when
another tool or team did better. Button labels are two or three words; arrows only on links that
leave the page.
