# Chart reference

Every helper in `assets/charts.js`, with every option the source reads. All helpers live on the
global `AS`. Each one draws an `<svg class="ch">` into `el` (an element or a CSS selector) and
returns the svg. Load `assets/style.css` and `assets/charts.js` first. Tooltips also need
`assets/ui.css`.

Rules for which colour goes where are in `style-guide.md` (Charts). This file is the API.

## Pick by the data's job

| The data's job | Helper | Not this when |
|---|---|---|
| One series over 4 to 12 periods, one period highlighted | `compare` | Over about 12 bars the value chips collide. Use `area`. |
| One series over many periods (a trend) | `area` | You need every x label. `area` labels the two ends only. Use `lines`. |
| Two to four named series over time | `lines` | End labels sit at the last point and can collide. Fix with `nudge`, or use `multiples`. |
| The same measure for many groups over time | `multiples` | Scales are per panel unless you pass `shared: true`. |
| Parts of a total per period | `bars` (stacked) | More than four series. Segment labels only appear on the last bar. |
| In and out per period (opened and fixed, won and lost) | `diverging` | Both directions share one scale. If one side is under about a fifth of the other its bars are slivers. Use two `compare` charts or a `dumbbell`. |
| Before and after per group | `dumbbell` | The change column is relative percent change. For values already in percent pass `delta: false`. |
| Who moved between two moments | `slope` | More than about 8 rows, or values close together. Labels collide. Use `dumbbell`. |
| Share of a whole, one number | `donut` | More than four segments. |
| Share of a whole, several rows, each with its own total | `track` | Rows that must be compared on one absolute scale. Use `hbars`. |
| Share of a whole people should be able to count | `waffle` | More than three tones (`segs`). It stops being countable. |
| Ranked list | `hbars` | Two or three rows with one hero. Use `bench`. |
| Hero against a baseline ("2.4x faster") | `bench` | More than about four rows. Use `hbars`. |
| Two measures per item | `scatter` | Either axis must not start at zero. Both always do. |
| Flow between stages (sources to outcomes) | `flow` | More than two columns. It draws left to right once. |
| Drop-off through ordered steps | `funnel` | Steps that are not subsets of the first. Bars are sized against step one. |
| How one number became another | `waterfall` | The running total goes below zero. The scale starts at zero. |
| Progress against a target | `bullet` | You have no target. For lower-is-better measures pass `lower: true`. |
| A level against a limit (budget, capacity) | `meter` | You need precision. It rounds to whole cells. |
| One hero number | `matrix` | Lower-case or accented text. It has digits, capitals and a few symbols. |
| Cadence, on and off over time | `stepgrid` | More than about 60 cells per lane at doc width. Cells get too thin. |
| Plan over time | `gantt` | Dates finer than the columns matter. Positions are fractions of a column. |
| Trend in a table cell or tile | `spark` | The reader needs values. It has no axis and no labels. |
| Severity mix in a table cell or tile | `mix` | Categories other than the four severities. |
| Small counts where each item matters, by group | `dots` | Clusters look empty under about 30 items per group. Use `waffle` or one `stepgrid` row. |
| Small counts along a scale (ages, durations) | `strip` | More than about 150 values. Stacks run off the top. |
| Two categories crossed, one count per cell | `heat` | Colour must follow a theme. Its greys are fixed. |

## Sizing

`W` and `H` are viewBox units. The svg is `width: 100%` of its container, so set `W` near the
rendered CSS width of the plot box. Then one unit is one CSS px and text draws at the sizes below.
A chart drawn at `W: 1000` in a 500px box has half-size labels.

Typical plot boxes:

| Where | W x H |
|---|---|
| Doc, full-width card | about 640 wide |
| Doc, half card | about 300 wide |
| Doc, cover | about 690 wide |
| Slide, full card | about 1400 x 520 |
| Slide, two-thirds card | about 940 x 470 |
| Slide, half card | about 690 x 440 |
| 1600 x 1000 graphic, plot | about 1456 x 480 |

For images viewed small (Slack, social), set `W` to about 0.7 of the box so labels scale up. Use
0.5 on story and square formats. Scale `H` by the same factor.

**Helpers that take `W` and `H`** (defaults in brackets): `bars` (1000 x 360), `diverging`
(1100 x 360), `lines` (1000 x 340), `dots` (1200 x 260), `flow` (1100 x 440), `strip` (1100 x 200),
`area` (1100 x 300), `compare` (900 x 320), `scatter` (900 x 440), `slope` (640 x 400), `waterfall`
(900 x 340), `spark` (120 x 28), `mix` (160 x 8).

**Helpers that take `W` and a row height.** `H` is ignored. Total height is rows times row height
plus a constant:

| Helper | W default | Row option (default) | Total height |
|---|---|---|---|
| `hbars` | 1000 | `rowH` (34) | rows x rowH + 10 |
| `track` | 900 | `rowH` (54) | rows x rowH |
| `funnel` | 900 | `rowH` (50) | steps x rowH |
| `meter` | 700 | `rowH` (40) | rows x rowH |
| `bullet` | 800 | `rowH` (46) | rows x rowH |
| `dumbbell` | 800 | `rowH` (40) | rows x rowH + 26, plus 24 more when `names` is set |
| `bench` | 760 | `rowH` (74) | rows x rowH |
| `gantt` | 1100 | `rowH` (50) | lanes x rowH + 36 |
| `stepgrid` | 800 | `cell`, `gap`, `lanePad` | lanes x (cell + gap + lanePad), plus 18 when `x` is set |

**Helpers sized by their parts.** No `W` or `H`:

| Helper | Width | Height |
|---|---|---|
| `heat` | labelW + cols x (cellW + 6) | 46 + rows x (cellH + 6) |
| `multiples` | cols x pw + (cols - 1) x 26 | panel rows x (ph + 30) + 4 |
| `donut` | `size` (220) | `size` |
| `waffle` | cols x (cell + gap) - gap | grid rows x (cell + gap) - gap |
| `matrix` | sum of the glyph widths | 7 x (dot + gap) - gap |

`spark` and `matrix` set a fixed pixel width on the svg (`matrix` fills the container with
`fit: true`). `waffle` sets a max-width. Everything else stretches to its container, so a `donut`
or `heat` needs a container of the right width.

**Text sizes at 1:1** (from `.ch` rules in `assets/style.css`):

| Class | Font | Used for |
|---|---|---|
| `.ax` | 11px Geist Mono 400, ink-3 | axis ticks, quiet row labels |
| `.axl` | 12px Inter 400, ink-3 | axis titles, legend names, column heads |
| `.lab` | 13px Inter 600, ink | row labels, end labels |
| `.val` | 11px Geist Mono 400, ink-2 | values on or above marks |
| `.sml` | 11px Geist Mono 400, ink-3 | counts, small notes |
| `.inv` | 12px Inter 600, paper-2 | values inside dark `heat` cells |
| `.ann` | 15px Inter 500, ink, paper halo | `annotate` text |
| `.big` | 44px Inter 600, ink | not used by a helper. For hand-drawn hero numbers. |

Helpers also set a few sizes inline: `track` number 26px (`numSize`), `bench` figure 30px for the
hero row and 20px for the rest, `gantt` bar label 12.5px, `donut` label 0.22 x `size`.

**Row helpers and small images.** A helper sized by `rowH` ignores `H`. Pick `rowH` so that
rows x rowH plus its constant comes to the height you want: for the 1600x1000 graphic drawn at 0.7
that is about 336, so four dumbbell rows are `rowH: 72`. `fmt: AS.fmtN` prints 2680 as 2,680.
Sort the rows yourself, largest first unless the order means something.

## Colours

Anywhere an option says "colour" it takes one of:

* a severity name: `critical`, `high`, `medium`, `low`
* a tone: `signal`, `ink`, `mute`, `pale`, `paper`, `ground`, `n1` to `n6` (`n1` is ink, `n6` the palest grey)
* any CSS colour: `'#e4502a'`, `'var(--n3)'`, `'rgb(0 0 0 / .4)'`

`AS.SEV`, `AS.TONE` and `AS.N` hold the same names as CSS `var()` strings: `AS.SEV.high` is
`'var(--high)'`, `AS.TONE.signal` is `'var(--signal)'`, `AS.N[0]` to `AS.N[5]` are `n1` to `n6`.

## Helpers

In the order they are exported. "Required" means the call throws without it. Every example draws
into `<div id="chart"></div>`.

### bars

Stacked or single vertical bars with a total above each bar.

* `cats` (required): array of x labels.
* `series` (required): array, bottom of the stack first. Each: `name` (used by `segLabels`),
  `color` (colour, no default, always set it), `values` (one per cat; missing, zero and negative
  values are skipped).
* `W` (1000), `H` (360).
* `max` (largest stack): top of the y scale. Rounded up to a tick.
* `totals` (true): `false` hides the total above each bar.
* `segLabels` (false): labels each segment of the last bar as "name 41%" to its right. Reserves
  110 units on the right. Segments under 14 units tall get no label.
* `noGrid` (false): hides gridlines and y tick labels.
* `barW` (62% of the slot): bar width, capped at 170.
* `xLabel` (none): axis title under the plot.

```js
AS.bars('#chart', {W: 640, H: 220, cats: ['Q1', 'Q2', 'Q3'], xLabel: 'quarter', series: [
  {name: 'Renewals', color: 'n4', values: [20, 24, 30]},
  {name: 'New', color: 'n1', values: [12, 18, 31]}]});
```

### diverging

One bar up and one bar down per period, on a shared scale, with a value on each bar.

* `cats` (required): array of x labels.
* `up` (required), `down` (required): arrays of positive numbers, one per cat. A zero draws no bar
  and no label.
* `W` (1100), `H` (360).
* `upColor` (ink), `downColor` (n4): any colour name or CSS colour.
* `upLabel` ('Opened'), `downLabel` ('Fixed'): axis captions. An arrow is added.
* `notes` (none): object or array keyed by cat index. Text drawn under that period's down bar.

```js
AS.diverging('#chart', {W: 640, H: 260, cats: ['Jul', 'Aug', 'Sep', 'Oct'],
  up: [19, 44, 21, 28], down: [5, 8, 26, 12],
  upLabel: 'Opened', downLabel: 'Closed', notes: {2: 'Sweep'}});
```

### lines

Lines from a zero baseline with a dot on every point and a text label at the end of each line.

* `x` (required): array of x labels. All are drawn.
* `series` (required): array. Each: `name`, `values` (one per x; `null` skips a point and the line
  bridges the gap), `color` (colour, default ink), `dash` (`'dash'` or `'dot'`, default solid),
  `label` (end label text, default "last value + name"), `nudge` (0, moves the end label down by
  that many units, negative for up).
* `W` (1000), `H` (340).
* `endW` (190): space kept on the right for end labels.
* `max` (largest value): top of the y scale.
* `fmt` (identity): formats y tick labels. Not applied to end labels.
* `grid` (true): `false` hides gridlines and y tick labels.
* `verticals` (false): a vertical hairline at every x.
* `dots` (true): `false` hides the point dots.

```js
AS.lines('#chart', {W: 640, H: 260, endW: 110, x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  fmt: v => v + ' ms', series: [
    {name: 'v1', values: [120, 160, 210, 260, 410], color: 'n3', dash: 'dash', label: '410 ms v1'},
    {name: 'v2', values: [38, 39, 40, 41, 44], label: '44 ms v2'}]});
```

### hbars

Ranked horizontal pill bars on a pale track, label left, value right. The caller sorts the rows.

* `rows` (required): array. Each: `label`, `value` (required, sets the scale and the right-hand
  number), `display` (text shown instead of `value`), `segs` (array of `{v, color}` to split the
  bar; each seg needs its `color`).
* `W` (1000), `rowH` (34), `labelW` (220).
* `max` (largest value): value at the right end of the track.
* `color` (ink): bar colour for rows without `segs`.

```js
AS.hbars('#chart', {W: 640, labelW: 130, rowH: 30, max: 100, rows: [
  {label: 'Infrastructure', value: 71, display: '71%'},
  {label: 'Data platforms', value: 55, display: '55%'},
  {label: 'Fintech', value: 37, display: '37%', segs: [{v: 37, color: 'n3'}]}]});
```

### dots

One dot per item, packed into a round cluster per group, with the group label and count below.

* `groups` (required): array. Each: `label`, `items` (array; each item: `sev` (severity name) or
  `color` (colour), default ink; `fixed` (true draws a ring, false a filled dot)).
* `W` (1200), `H` (260).
* `r` (4.2): dot radius. The cluster radius is about 1.4 x r x sqrt(items). Nothing stops a big
  cluster from leaving its slot, so lower `r` or raise `H`.

Items are sorted so open items sit in the middle, most severe first, and fixed rings sit outside.
Set `fixed` on every item (see Known limits).

```js
const items = (n, sev, nFixed) =>
  Array.from({length: n}, (_, i) => ({sev, fixed: i < nFixed}));
AS.dots('#chart', {W: 640, H: 170, r: 3, groups: [
  {label: 'Authorization', items: [...items(40, 'high', 8), ...items(30, 'medium', 10)]},
  {label: 'Secrets', items: items(45, 'high', 12)},
  {label: 'Transport', items: items(32, 'medium', 5)}]});
```

### flow

A two-column sankey: sources on the left, outcomes on the right, a ribbon per link.

* `nodes` (required): `{left: [{id, label}], right: [{id, label, color}]}`. Left nodes are always
  ink. A right node takes `color` (colour, default ink). Each node label is followed by its total.
* `links` (required): array of `{s, t, v, dark, color}`. `s` is a left id, `t` a right id, `v` the
  amount. `dark: true` draws the ribbon in ink grey (the part that matters), otherwise pale.
  `color` (colour) overrides both and draws at 35% opacity. Ribbons stack in the order given.
* `W` (1100), `H` (440). Nodes fill the full height.
* `labelW` (200): space for left labels. `rightW` (230): space for right labels.
* `gap` (12): vertical gap between nodes.

```js
AS.flow('#chart', {W: 640, H: 240, labelW: 110, rightW: 170, nodes: {
    left: [{id: 'scan', label: 'Scanner'}, {id: 'test', label: 'Pen test'}],
    right: [{id: 'noise', label: 'Ruled out', color: 'n4'}, {id: 'open', label: 'Still open'},
            {id: 'fixed', label: 'Fixed', color: 'n3'}]},
  links: [{s: 'scan', t: 'noise', v: 120}, {s: 'scan', t: 'open', v: 18, dark: true},
          {s: 'scan', t: 'fixed', v: 6}, {s: 'test', t: 'open', v: 38, dark: true},
          {s: 'test', t: 'fixed', v: 22}]});
```

### heat

A grid of rounded cells in fixed warm greys. Darker is more. The value is printed in each cell.

* `rows` (required), `cols` (required): arrays of labels.
* `values` (required): `values[row][col]`. A zero, `null` or missing value draws an empty
  outlined cell. Shade is the square root of value over the largest value.
* `cellW` (130), `cellH` (36), `labelW` (170). Cells are 6 units apart. There is no `W` or `H`.

```js
AS.heat('#chart', {cellW: 90, cellH: 32, labelW: 110,
  rows: ['Accounts', 'Payments', 'Platform'], cols: ['Critical', 'High', 'Medium', 'Low'],
  values: [[1, 12, 30, 8], [0, 6, 14, 22], [2, 19, 9, 0]]});
```

### strip

One dot per value along a linear or log axis. Dots that would overlap stack upward.

* `values` (required): array of numbers. Must be above zero with `log`.
* `W` (1100), `H` (200).
* `r` (5.5): dot radius.
* `min` (smallest value), `max` (largest value): ends of the axis.
* `log` (false): log10 axis.
* `ticks` (none): array of `{v, label}`. A hairline and a label at each. Without it there is no axis.
* `median` (none): `{v, label}`. A dashed ink line with the label to its left at the top.
* `color` ('high'): dot colour. The default is the severity wine, so set it in non-severity work.

```js
AS.strip('#chart', {W: 640, H: 150, r: 4, log: true, min: 1, max: 1000, color: 'n1',
  values: [1, 2, 2, 5, 9, 14, 30, 31, 33, 60, 75, 120, 180, 240, 400, 620, 900],
  ticks: [{v: 1, label: '1 day'}, {v: 7, label: '1 week'}, {v: 30, label: '1 month'}, {v: 365, label: '1 year'}],
  median: {v: 33, label: 'median 33 days'}});
```

### annotate

`AS.annotate(svg, from, to, text, anchor)` adds a thin curved leader and a 15px label to a chart
that is already drawn.

* `svg` (required): the svg a helper returned.
* `from` (required): `[x, y]` where the label sits. The leader starts here.
* `to` (required): `[x, y]` of the mark the leader points at.
* `text` (required).
* `anchor` ('end'): `'end'` puts the text to the left of `from`, right-aligned. `'start'` puts it to
  the right.

The leader leaves `from` sideways and arrives at `to` vertically, so place the label to the side
of the mark and above or below it.

Coordinates are the svg's viewBox units: the same `W` and `H` you passed, origin top left. There
are two ways to find a mark.

Read it from the svg. Every mark is a plain element, so take the attributes of the one you want:

```js
const svg = AS.lines('#chart', {W: 640, H: 260, endW: 90, x: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  series: [{name: 'open', values: [40, 52, 95, 70, 64]}]});
const dot = svg.querySelectorAll('circle')[2];            // third point of the first series
AS.annotate(svg, [200, 40], [+dot.getAttribute('cx'), +dot.getAttribute('cy') - 8], 'Audit week');
```

Or compute it from the plot box. Each `W`/`H` helper keeps fixed margins:

| Helper | Left | Right | Top | Bottom |
|---|---|---|---|---|
| `bars` | 56 | W - 20 (W - 110 with `segLabels`) | 26 | H - 40 |
| `diverging` | 50 | W - 20 | 40 | H - 64 |
| `lines` | 60 | W - `endW` | 20 | H - 36 |
| `area` | 44 | W - `endW` | 12 | H - 28 |
| `compare` | 40 | W - 10 | 34 | H - 30 |
| `scatter` | 56 | W - 24 | 16 (30 with `yLabel`) | H - 46 |
| `slope` | `padL` | W - `padR` | 36 | H - 14 |
| `waterfall` | 16 | W - 16 | 34 | H - 30 |
| `strip` | 30 | W - 30 | n/a | dots sit at H - 52 |

For zero-based charts, y of a value is `bottom - value / top * (bottom - top margin)`, where `top`
is the highest gridline (the `max` rounded up to a tick). Pass a round `max` so you know it. For
`lines` and `area`, x of point `i` of `k` is `left + (right - left) * i / (k - 1)`. For `bars`,
`compare` and `waterfall`, the centre of bar `i` is `left + (right - left) * (i + 0.5) / k`.

```js
// bars at W 640, H 220, max 80: left 56, right 620, top 26, bottom 180
const svg = AS.bars('#chart', {W: 640, H: 220, max: 80, cats: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{name: 'Tickets', color: 'n1', values: [22, 31, 64, 40]}]});
const x = 56 + (620 - 56) * (2 + 0.5) / 4, y = 180 - 64 / 80 * (180 - 26);
AS.annotate(svg, [x - 110, y + 30], [x - 46, y + 60], 'Launch quarter');
```

### area

A minimal time series: one ink line over a faint fill, or several lines, or stacked areas. Two or
three y ticks, x labels at the two ends only. In live HTML a crosshair tooltip follows the pointer.

* `x` (required): array of labels, at least two. Only the first and last are drawn. All appear in
  tooltips.
* `series` (required): array of `{name, values, color}`. `color` is a colour, default ink. One
  series gets a line and a 7% fill. Several series get lines only, with a dot on each last point.
* `W` (1100), `H` (300).
* `stack` (false): stacks the series as filled areas, first series at the bottom.
* `max` (largest value or stack): top of the y scale.
* `ticks` (2): rough number of y intervals.
* `fmt` (`AS.fmtK`): formats y ticks and tooltip values.
* `endLabels` (true): `false` hides the end dots on multi-series charts. No text is drawn either way.
* `endW` (8): right margin. Raise it to leave room for your own labels.
* `mark` (none): `{i, label}`. A dashed vertical line at index `i`, a dot on the value there (the
  first series, or the stack total), and the label to the right of the line at the top.

```js
AS.area('#chart', {W: 640, H: 220, ticks: 3,
  x: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7', 'Wk 8'],
  series: [{name: 'Open', values: [234, 241, 248, 262, 255, 271, 284, 297]}],
  mark: {i: 3, label: 'New rule'}});
```

Stacked by severity:

```js
AS.area('#chart', {W: 640, H: 220, stack: true, x: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov'], series: [
  {name: 'Critical', color: 'critical', values: [3, 4, 4, 6, 7]},
  {name: 'High', color: 'high', values: [40, 52, 71, 96, 120]}]});
```

### compare

Vertical bars where one bar carries the claim and the rest are pale. Each bar has a value chip above
it. Dotted gridlines, no axis line.

* `cats` (required): array of x labels.
* `values` (required): array of numbers, zero or more.
* `W` (900), `H` (320).
* `hi` (last bar): index, or array of indexes, of the highlighted bars. `[]` highlights none.
* `color` (ink): colour of the highlighted bars.
* `unit` (''): appended to every value, for example `'%'` or `' h'`.
* `fmt` (value + unit): formats chips, y ticks and tooltips. Replaces `unit`.
* `max` (largest value): top of the y scale.
* `ticks` (3): rough number of y intervals.
* `barW` (34% of the slot): bar width, capped at 64.
* `name` ('Value'): series name in the tooltip.

```js
AS.compare('#chart', {W: 640, H: 220, cats: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  values: [2, 1, 4, 7, 9, 18], hi: 5, name: 'Fixed'});
```

### track

Share rows: a label, a pill bar on a full-width track, a dotted leader and a big number on the
right.

* `rows` (required): array. Each: `label`, `value`, `of` (the whole for this row), `color` (colour,
  default ink), `display` (the big number text, default the rounded percent).
* `W` (900), `rowH` (54).
* `of` (100): the whole for rows that do not set their own.
* `labelW` (170), `numW` (110): left and right column widths.
* `barH` (14): bar thickness. `numSize` (26): font size of the big number.

```js
AS.track('#chart', {W: 640, rowH: 48, labelW: 110, rows: [
  {label: 'Enterprise', value: 49, of: 118},
  {label: 'Mid-market', value: 30, of: 40, display: '30 / 40'},
  {label: 'Startup', value: 12}]});
```

### multiples

Small multiples: one tiny line per panel, min and max on the y axis, a dot and a value on the latest
point.

* `panels` (required): array. Each: `label`, `values` (at least two), `color` (colour, default ink),
  `display` (text for the top right figure, default the last value).
* `cols` (4): panels per row.
* `pw` (220), `ph` (96): panel width and height. There is no `W` or `H`.
* `shared` (false): `true` puts every panel on one scale (the largest value of all panels).
* `zero` (true): `false` starts each panel at its own minimum, not at zero.
* `event` (none): `{i, label}`. A dashed vertical line at index `i` in every panel. `label` is
  printed once at the bottom right.

```js
AS.multiples('#chart', {cols: 3, pw: 196, ph: 90, shared: true, event: {i: 3, label: 'rule change'},
  panels: [
    {label: 'Accounts', values: [28, 29, 31, 51, 50, 49, 48]},
    {label: 'Platform', values: [24, 25, 25, 33, 33, 34, 34]},
    {label: 'Payments', values: [18, 19, 19, 22, 21, 22, 22]}]});
```

### kpiSelect

`AS.kpiSelect(strip, plot, draw)` wires a strip of KPI buttons to one plot. Clicking a button
clears the plot and redraws it.

* `strip` (required): element or selector holding `<button data-k="key">` elements.
* `plot` (required): element or selector the charts draw into.
* `draw` (required): object of functions keyed by each button's `data-k`. Each gets the plot
  element.

The button with class `on` is drawn first (the first button if none has it). That is the state the
PDF and PNG show. The `.kpis` strip is styled by `assets/ui.css`.

```html
<div class="kpis" id="kpis" style="--cols:2">
  <button class="on" data-k="open"><span>Open</span><b>297</b><em>+63 in 8 weeks</em></button>
  <button data-k="fixed"><span>Fixed</span><b>42</b><em>last 30 days</em></button>
</div>
<div id="chart"></div>
```

```js
const wk = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'];
AS.kpiSelect('#kpis', '#chart', {
  open: el => AS.area(el, {W: 640, H: 200, x: wk, series: [{name: 'Open', values: [234, 248, 262, 255, 284, 297]}]}),
  fixed: el => AS.compare(el, {W: 640, H: 200, cats: wk, values: [1, 2, 26, 3, 6, 4], hi: 2, name: 'Fixed'})});
```

### mix

`AS.mix(el, counts, opts)` draws one thin rounded bar split by severity, for a table cell or tile.

* `counts` (required): `{critical, high, medium, low}`. Missing keys count as zero. Other keys are
  ignored.
* `opts.W` (160), `opts.H` (8). The svg stretches to its container, so give the container a width.

```js
AS.mix('#chart', {critical: 2, high: 14, medium: 30, low: 9}, {W: 160, H: 8});
```

### hover

`AS.hover(svg)` turns on tooltips for one svg. Any mark with a `data-tip` attribute shows a tooltip
while the pointer is over it. `area`, `compare`, `track` and `scatter` call it themselves. Call it
by hand for marks you add with `AS.el`.

* `data-tip` is JSON: `{"h": "heading", "rows": [["name", "colour", "value"], ...]}`. `h` is
  optional. The colour is any colour name from the Colours section.
* The tooltip is a `.tip` div added to the svg's parent, which is made `position: relative`. The
  `.tip` styles are in `assets/ui.css`. Live HTML only: print and PNG never show it.

```js
const svg = AS.root('#chart', 300, 60);
AS.el(svg, 'circle', {cx: 30, cy: 30, r: 14, fill: 'var(--n1)',
  'data-tip': JSON.stringify({h: 'Sep 2', rows: [['High', 'high', 12], ['Medium', 'medium', 30]]})});
AS.hover(svg);
```

### fmtK

`AS.fmtK(v)` shortens a number: thousands as `K`, millions as `M`, one decimal at most, trailing
zero dropped. It is the default formatter for `area`, `scatter`, `waterfall`, `funnel` and the
`multiples` axis.

```js
document.querySelector('#chart').textContent =
  [AS.fmtK(950), AS.fmtK(1500), AS.fmtK(42000), AS.fmtK(2400000)].join('  ');   // 950  1.5K  42K  2.4M
```

### el

`AS.el(parent, tag, attrs, text)` creates one SVG element, sets its attributes, appends it to
`parent` and returns it. Attributes whose value is `null` or `undefined` are skipped. `text` is
optional. Use it to add marks to a chart or to draw a chart no helper covers. Give text one of the
classes from the Sizing table.

### root

`AS.root(el, W, H)` appends an empty `<svg class="ch" viewBox="0 0 W H">` to `el` (element or
selector) and returns it. Every helper starts with it.

```js
const svg = AS.root('#chart', 320, 80);
AS.el(svg, 'line', {x1: 0, x2: 320, y1: 60, y2: 60, stroke: 'var(--axis)'});
AS.el(svg, 'rect', {x: 20, y: 20, width: 60, height: 40, rx: 4, fill: 'var(--n1)'});
AS.el(svg, 'text', {x: 50, y: 14, 'text-anchor': 'middle', class: 'val'}, '40');
AS.el(svg, 'text', {x: 96, y: 44, class: 'lab'}, 'Hand-drawn mark');
```

### donut

A ring showing one share, or up to four segments, with an optional number in the middle.

* `value` (required unless `segs`): the share.
* `of` (100, or the sum of `segs`): the whole.
* `color` (ink): colour of the single share.
* `segs` (none): array of `{v, color}`, drawn clockwise from the top with small gaps. Replaces
  `value` and `color`.
* `label` (none): text in the middle. It is not derived from `value`, so pass it.
* `sub` (none): small line under the label.
* `size` (220): width and height. `thick` (11% of size): ring thickness.

The svg stretches to its container. Put it in a box as wide as `size`.

```js
AS.donut('#chart', {value: 67, label: '67%', sub: 'renewed', size: 180});
```

### scatter

A scatter or bubble plot from zero on both axes. Points marked `hi` are dark and labelled. The
rest are pale.

* `points` (required): array. Each: `x`, `y`, `r` (5.5, radius in units), `label`, `hi` (true
  highlights and labels it), `color` (colour, used only when `hi`).
* `W` (900), `H` (440).
* `xMax`, `yMax` (largest value): tops of the scales.
* `xFmt`, `yFmt` (`AS.fmtK`): tick and tooltip formatters.
* `xLabel`, `yLabel` (none): axis titles. Also used as tooltip row names.
* `mid` (none): `{x, y}`. Dashed lines that split the plot into quadrants.
* `quads` (none): `[topLeft, topRight, bottomLeft, bottomRight]` corner captions. Needs `mid`.
* `labels` (false): `true` labels every point that has a `label`, not just the `hi` ones.
* `color` (ink): default colour for `hi` points.

```js
AS.scatter('#chart', {W: 640, H: 320, xLabel: 'USD per million', yLabel: 'Latency, ms',
  xMax: 40, yMax: 800, mid: {x: 20, y: 400}, quads: ['', 'Slow and dear', 'Cheap and fast', ''],
  points: [{x: 6, y: 180, label: 'Plan C', hi: true}, {x: 12, y: 420}, {x: 18, y: 380},
           {x: 22, y: 610}, {x: 30, y: 300}, {x: 34, y: 520}, {x: 9, y: 690}]});
```

### slope

Two moments, one line per row. `hi` rows are dark and bold. The rest are pale. Both ends are
labelled.

* `rows` (required): array. Each: `label`, `a` (left value), `b` (right value), `hi`, `color`
  (colour, used only when `hi`), `nudgeA`, `nudgeB` (0, move the left or right label down by that
  many units, negative for up).
* `left`, `right` (none): column headings.
* `W` (640), `H` (400).
* `padL` (170): space for the left labels, which read "label  value". `padR` (90): space on the
  right.
* `fmt` (identity): formats the values.
* `min` (smallest value), `max` (largest value): the scale. It does not start at zero by default.
* `color` (ink): default colour for `hi` rows.

```js
AS.slope('#chart', {W: 440, H: 280, left: '2025', right: '2026', padL: 130, padR: 60,
  fmt: v => v + '%', rows: [
    {label: 'Americas', a: 41, b: 46}, {label: 'Europe', a: 33, b: 24, hi: true},
    {label: 'Asia', a: 18, b: 21}, {label: 'Other', a: 8, b: 9}]});
```

### waterfall

Bars that walk from a start total to an end total. Totals are ink, rises mid grey, falls pale, with
dotted connectors and a signed value above each bar.

* `steps` (required): array. Each: `label`, `value` (the change, negative for a fall), `total`
  (true makes it a total bar from zero; with a `value` it sets the running total, without one it
  shows the running total so far).
* `W` (900), `H` (340).
* `fmt` (`AS.fmtK`): formats the values.
* `max` (largest level reached): top of the scale.
* `color` (ink): colour of the last bar, when that bar is a total.

```js
AS.waterfall('#chart', {W: 640, H: 260, steps: [
  {label: 'Start', value: 820, total: true}, {label: 'New', value: 310}, {label: 'Expand', value: 120},
  {label: 'Churn', value: -140}, {label: 'End', total: true}]});
```

### funnel

Ordered steps as left-aligned bars on a pale track. The value sits at the bar end and the share of
the previous step on the right.

* `steps` (required): array of `{label, value}`, at least one. Bars are sized against the first
  step.
* `W` (900), `rowH` (50), `labelW` (190), `barH` (22).
* `hi` (last step): index of the highlighted step.
* `color` (ink): colour of the highlighted step. The others are n4.
* `fmt` (`AS.fmtK`): formats the values.

```js
AS.funnel('#chart', {W: 640, labelW: 110, rowH: 44, steps: [
  {label: 'Signed up', value: 8400}, {label: 'Verified', value: 6100},
  {label: 'First call', value: 1700}, {label: 'Paid', value: 420}]});
```

### meter

Level rows drawn as lit cells, like a hardware level strip. The last lit cell of a row takes the
colour.

* `rows` (required): array. Each: `label`, `value`, `of` (the full level for this row), `display`
  (right-hand text, default `value`), `color` (colour for the last lit cell).
* `W` (700), `rowH` (40).
* `of` (100): full level for rows that do not set their own.
* `cells` (24): cells per row. Lit cells are `value / of` rounded to a whole cell.
* `color` (none): last-cell colour for rows that do not set their own. Without any colour every lit
  cell is ink.
* `labelW` (150): label column. `0` hides the labels. `numW` (70): number column.
* `cellH` (16), `gap` (3): cell height and the gap between cells.

```js
AS.meter('#chart', {W: 640, rows: [
  {label: 'Compute', value: 61, display: '61%'},
  {label: 'Storage', value: 94, display: '94%', color: 'signal'},
  {label: 'Egress', value: 38, display: '38%'}]});
```

### matrix

`AS.matrix(el, text, opts)` sets a short text in a 5 x 7 dot grid. For one hero number or a short
code.

* `text` (required): string or number. Letters are upper-cased. A digit followed by `x` becomes a
  multiplication sign. Glyphs: `0-9 A-Z . , : - + % / × $ ↑ ↓ = #` and space. Any other character
  draws as a blank.
* `opts.dot` (8): dot diameter. Keep it at 4 or more.
* `opts.gap` (45% of dot): space between dots.
* `opts.color` (ink): colour of the lit dots.
* `opts.off` (false): `true` also draws the unlit dots in pale grey.
* `opts.fit` (false): `true` scales the readout to the container width. Otherwise the svg is its
  natural pixel width.

```js
AS.matrix('#chart', '99.98%', {dot: 9, off: true});
```

### spark

`AS.spark(el, values, opts)` draws a sparkline with a dot on the last value. The svg has a fixed
width of `W` px.

* `values` (required): array of at least two numbers.
* `opts.W` (120), `opts.H` (28).
* `opts.color` (ink): line colour.
* `opts.fill` (false): `true` adds a faint fill under the line.
* `opts.zero` (false): `true` starts the scale at zero. By default it starts at the smallest value.
* `opts.dot` (true): `false` hides the end dot. `'only'` greys the line so the dot carries the colour.
* `opts.dotColor` (`color`): colour of the end dot.

```js
AS.spark('#chart', [12, 14, 13, 18, 17, 22, 26], {W: 130, H: 30, fill: true});
```

### bullet

Progress rows: a value bar on a pale track with a tick at the target and the value on the right.

* `rows` (required): array. Each: `label`, `value`, `target` (draws the tick; optional), `of` (the
  value at the right end of the track), `display` (right-hand text, default `value`), `color`
  (colour, overrides the met or missed colour), `lower` (true when lower is better for this row).
* `W` (800), `rowH` (46).
* `of` (100): track end for rows that do not set their own.
* `labelW` (180; 0 hides the labels), `numW` (80), `barH` (12).
* `lower` (false): lower is better for every row, so a row is met when `value <= target`.
* `missColor` (n3): bar colour for rows under target. Rows at or over target, and rows with no
  target, are ink.

A row is met when `value >= target`, or `value <= target` with `lower: true`. The tick has no
label: name the target in the row label or the legend (`.legend4 i.tick`).

```js
AS.bullet('#chart', {W: 640, labelW: 110, rows: [
  {label: 'NPS', value: 62, target: 55},
  {label: 'CSAT', value: 91, target: 90, display: '91%'},
  {label: 'Units', value: 820, target: 1000, of: 1200, display: '820'}]});
```

### dumbbell

Before and after per row on one scale: a ring for before, a dot for after, both values labelled, and
the percent change in a right column.

* `rows` (required): array. Each: `label`, `a` (before), `b` (after), `color` (colour of the after
  dot).
* `W` (800), `rowH` (40), `labelW` (180).
* `names` (none): `[before, after]`. Draws a small legend above the plot and adds 24 to the height.
* `fmt` (identity): formats the values and axis ticks. Not applied to the change column.
* `min` (0), `max` (largest value): the scale.
* `delta` (true): `false` hides the change column. The change is `(b - a) / a` as a rounded
  percent. It is skipped for rows where `a` is 0.
* `color` (ink): default colour of the after dots and the legend dot.

```js
AS.dumbbell('#chart', {W: 640, labelW: 100, names: ['August', 'November'], rows: [
  {label: 'Billing', a: 42, b: 18}, {label: 'Technical', a: 67, b: 31},
  {label: 'Sales', a: 21, b: 9}, {label: 'Abuse', a: 55, b: 12, color: 'signal'}]});
```

### bench

Benchmark rows: a thick rounded bar with its label above and a big figure at the bar end. The `hi`
row is dark with a larger figure. The rest are pale.

* `rows` (required): array. Each: `label`, `value`, `hi`, `display` (figure text, default `value`),
  `sub` (small note at the right above the bar), `color` (colour, used only when `hi`).
* `W` (760), `rowH` (74), `barH` (26).
* `numW` (130): space kept on the right for the figure. The longest bar is `W - numW` wide.
* `max` (largest value): value of a full-length bar.
* `color` (ink): default colour for `hi` rows.

```js
AS.bench('#chart', {W: 440, rows: [
  {label: 'Build 4.2', value: 2.4, display: '2.4x', hi: true, sub: 'same hardware'},
  {label: 'Build 4.1', value: 1.6, display: '1.6x'},
  {label: 'Build 3.9 (baseline)', value: 1, display: '1x'}]});
```

### stepgrid

Lanes of cells, like a sequencer: off, on, or flagged. For cadence, uptime, releases, habits.

* `lanes` (required): array. Each: `label`, `cells` (array of `0` off, `1` on in ink, `2` flagged
  in `color`).
* `W` (800): cell width is worked out from `W`, `labelW`, `gap` and the longest lane.
* `labelW` (130): label column. `0` hides the labels.
* `gap` (4): gap between cells.
* `cell` (cell width, capped at 22): cell height.
* `lanePad` (6): extra space under each lane.
* `x` (none): `[first, last]` captions under the grid. Adds 18 to the height.
* `color` ('signal'): colour of the `2` cells. Set it in severity work.

```js
AS.stepgrid('#chart', {W: 640, labelW: 70, x: ['Jun 1', 'Nov 15'], lanes: [
  {label: 'Web', cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]},
  {label: 'iOS', cells: [1, 0, 1, 0, 1, 0, 1, 0, 1, 2, 1, 0, 1, 0, 1, 0]}]});
```

### waffle

A unit grid: `value` of `total` cells filled, row by row from the top left.

* `value` (required): filled cells. Rounded to a whole number.
* `total` (100): cells in the grid.
* `cols` (10): cells per row.
* `cell` (16): cell size. `gap` (5): space between cells.
* `color` (ink): fill colour.
* `segs`: `[{v, color}]` fills several tones in order and replaces `value` and `color`, for
  example left for one reason, left for another, stayed.
* `round` (false): `true` draws circles, not rounded squares.

```js
AS.waffle('#chart', {value: 38, cell: 12, gap: 4});
```

### gantt

Roadmap lanes on a column axis, with a row of column headings and an optional today line.

* `cols` (required): array of column headings.
* `lanes` (required): array. Each: `label`, `bars` (array; each bar: `from` and `to` in column
  units from 0 to `cols.length`, `label` (text inside the bar), `hi` (true fills it dark with paper
  text), `ghost` (true draws a dashed outline with no fill), `color` (colour, used only when `hi`)).
* `W` (1100), `rowH` (50), `labelW` (170), `barH` (28).
* `today` (none): position of the today line in column units. It is always the signal colour.
* `todayLabel` (none): text beside the top of the today line.
* `color` (ink): default colour for `hi` bars.

```js
AS.gantt('#chart', {W: 640, labelW: 90, rowH: 44, cols: ['Q1', 'Q2', 'Q3', 'Q4'],
  today: 1.4, todayLabel: 'Today', lanes: [
    {label: 'Billing', bars: [{from: 0, to: 1.8, label: 'Usage billing', hi: true}]},
    {label: 'Mobile', bars: [{from: 1, to: 2.5, label: 'Beta'}, {from: 2.5, to: 4, label: 'GA', ghost: true}]}]});
```

### theme

`AS.theme(tokens)` sets CSS variables on the page so the stylesheet and every chart follow. Call
it once at the top of the page script, before drawing.

* `paper`, `ink` (hex): passing either one derives the card paper, the six greys (`n1` to `n6`),
  the text greys and the grounds from the pair. Use `#rgb` or `#rrggbb`.
* `signal` (hex): the one accent. Sets `--signal`.
* Passing any of the three also re-derives the cover glows, the gradient cells and the orb palette
  from paper, ink and signal, and adds the class `themed` to `<html>`. That maths needs hex, so
  give `signal` as hex too.
* Any other key is set as `--key` unchanged, after the derived tokens, so it can override one. For
  example `crit`, `high`, `med`, `low`, or `'cell-dawn'`.

It returns the object you passed.

```js
AS.theme({signal: '#e4502a'});
AS.compare('#chart', {W: 640, H: 200, cats: ['June', 'July', 'August', 'September'],
  values: [72, 51, 22, 4], unit: ' h', color: 'signal'});
```

## From a data file

`scripts/data.py sales.csv` (also TSV, JSON, .xlsx) prints a summary and writes `sales.csv.data.js`,
which defines `DATA = {source, columns:[{name, type, unit}], rows:[...], label}`. Load it and
`assets/data.js` with script tags, after `charts.js`.

| Call | Gives |
|---|---|
| `AS.col(DATA, 'revenue')` | that column as an array |
| `AS.labels(DATA)` | the label column as short strings ("May", "Q3") |
| `AS.rowsFor(DATA, {label, value})` | `[{label, value, display}]` for `hbars`, `bench`, `track`, `bullet` |
| `AS.pairs(DATA, {label, a, b})` | `[{label, a, b}]` for `dumbbell` and `slope` |
| `AS.sortBy(DATA, 'q3')`, `AS.pick(DATA, r => r.q3 > 0)` | sorted or filtered rows, usable in the calls above |
| `AS.sum`, `AS.first`, `AS.last`, `AS.change(DATA, name)` | figures for a headline; `change` is `{abs, pct}` |
| `AS.fmtFor(DATA, name)`, `AS.fmtN`, `AS.fmtPct` | formatters |

```js
AS.dumbbell('#c', {rows: AS.pairs(AS.sortBy(DATA, 'q3'), {label: 'region', a: 'q2', b: 'q3'}), fmt: AS.fmtN, names: ['Q2', 'Q3']});
```

Do not name a page variable `top`, `name`, `status` or `length`: they clash with the window's own and
the script dies (the layout check reports a script error).

## Animation

`assets/motion.js` animates a chart that is already drawn, for `scripts/animate.sh`. An animation
page reads the time from the hash and draws that instant: no CSS transitions, no timers.

```js
const t = AS.t();                                   // seconds, from #t=1.2
const svg = AS.compare('#c', {...});                // draw the finished chart
AS.reveal(svg, AS.lin(t, 0.7, 2.3));                // show it at that progress, 0 to 1
AS.countUp(numEl, 96, AS.span(t, 0, 0.8), v => Math.round(v));
AS.fadeUp(headline, AS.span(t, 0, 0.6));
```

`AS.reveal` grows bars from the baseline, draws lines left to right, sweeps a donut, lights cells in
order and fades each label in after its mark. At progress 1 the chart is exactly as drawn. It is
tested on `bars compare waterfall hbars track bullet funnel bench lines area spark dumbbell slope
donut meter stepgrid waffle matrix scatter`. `gantt flow dots strip multiples` are untested. Start
from `templates/chart-reveal.html`.

## Known limits

Found in the source while writing this. Each names the function.

1. `max` is read with `||` in `bars`, `lines`, `hbars`, `area`, `compare`, `scatter` (`xMax`,
   `yMax`), `waterfall`, `dumbbell` and `bench`, so `max: 0` is ignored. The same goes for `of: 0`
   (`track`, `bullet`, `meter`, `donut`), `gap: 0` (`flow`, `meter`), `total: 0` (`waffle`) and
   every `W`, `H`, `rowH`, `r`, `cells` and `ticks`. `labelW: 0` hides labels only in `meter` and
   `stepgrid`. In the other row helpers it falls back to the default.
2. `lines`, `area`, `bars`, `compare`, `scatter` and `waterfall` always start at zero and have no
   `min`. `bars` skips negative values. In the others a negative value falls below the plot.
3. `lines` cannot label a mid-series point, and `fmt` is not applied to its end labels. Use
   `series[].label` for the end text and `annotate` for a mid point. End labels that collide need
   `nudge` by hand.
4. `area` draws no end text even with `endLabels: true` (dots only, and only for several unstacked
   series). It labels the first and last x only. The `mark` label always sits to the right of the
   line, so a mark near the right edge runs off the plot. `mark` follows the first series when not
   stacked.
5. `area`, `multiples` and `spark` divide by `points - 1`, so a single point draws nothing useful.
6. `diverging` puts both directions on one scale, so a small side becomes slivers. The
   `downLabel` caption sits at the bottom left of the plot, where it can touch the lowest down
   tick label.
7. `bars`: the header comment lists `yLabel` but the function never reads it. `segLabels` labels
   the last bar only. A series without `color` is ink.
8. `hbars`: the header comment lists `note` per row but it is never read.
9. `dots`: clusters are not clipped to their slot or to `H`.
10. `strip` defaults to the `high` severity colour. Stacks are not clipped at the top. There is no
    axis unless you pass `ticks`.
11. `heat` is ink at an opacity per cell, so it follows the theme but takes no colour of its own.
    A zero cell draws empty, the same as a missing one.
12. `flow` has two columns only, left nodes are always ink, and the layout uses the full height
    with no top margin.
13. `compare` sizes value chips at 7 units per character, so long formatted values can overflow
    the chip. A zero value draws a chip with no bar.
14. `track` and `bullet` give the fill a minimum width of `barH`, and `funnel` and `bench` do the
    same, so a zero value still shows a small pill.
15. `bullet` clamps values above `of` to the track end, and its target tick has no label.
16. `dumbbell` reports change as relative percent only, with no formatter, and skips rows where
    `a` is 0. The legend dot uses `o.color`, not row colours.
17. `scatter` ignores `color` on points that are not `hi`. There are no vertical gridlines.
18. `slope` draws every row pale if none has `hi`. Close values overlap unless you set `nudgeA`
    or `nudgeB`.
19. `funnel` prints "% of prev" and "start" as fixed English text, and its right column is a fixed
    96 units.
20. `donut` does not write the number for you: no `label`, no text. A single share of 0 still
    draws a round dot at the top. The svg stretches to its container.
21. `waffle` rounds `value` and each `segs` entry to whole cells.
22. `matrix` upper-cases its text and draws unknown characters as blanks without warning.
23. `meter` colours only the last lit cell, and rounds, so a small value can light no cells.
24. `stepgrid` defaults the flagged colour to `signal` and has three states only.
25. `gantt` always draws the today line in `signal`. Bar labels are not clipped, so a long label
    overflows a short bar.
26. `multiples` defaults to a separate scale per panel (`shared: false`), while the style guide
    asks for a shared scale. `event` is one index for all panels.
27. `annotate` has no helper for finding a mark. Read the element's attributes or compute from the
    margins table above.
28. `hover` needs `assets/ui.css` for the `.tip` styles. With `style.css` alone the tooltip is
    unstyled.
