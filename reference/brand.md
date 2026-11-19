# Brand layer: colour ratio, shape, marks, icons, labels

Read this for anything that is not a severity report: a deck, a product page, a brand sheet, a social
image, a mobile screen. Working example of every rule here: `templates/brand.html`. The classes are in
the "v3 additions" block of `assets/style.css`; icons and marks are in `assets/icons.js`.

Three sources, structure only. A second pass over the product site this style started from (its
report PDFs, research charts and logo handling). Industrial product design (continuous corners,
concentric radii, an accent budget, the summary grid). Hardware instrument design (one signal colour
with a meaning, label plates, model codes, segment and dot readouts). No logo, typeface, image, icon
or brand colour was taken from any of them.

## Colour: 88 / 11 / 1

| Share of the page | What | Tokens |
|---|---|---|
| about 88% | paper and cards | `--paper`, `--paper-2`, `--ground-2`, `--n6` |
| about 11% | ink: type, marks, one ink block | `--ink` and the neutrals `--n2`..`--n5` |
| about 1% | signal | `--signal` (`#2b44d9`) |

1. **One signal mark per view.** It goes on the thing that is live, new, over a limit, or the claim:
   one bar, one dot, one tag, one cell of a meter, the "today" line. A chart page may spend up to 5%;
   `check.js` fails the render above that.
2. **Signal never colours** a headline, body text, the logo, a button or a background.
3. **Signal and severity never share a page.** In a severity piece the four severity colours are the
   only colour and `--signal` is not used. Everywhere else severity colours are not used.
4. **Dark mode** is `AS.theme('dark')`: near-black paper, warm white ink, a lighter signal, and
   severity colours lifted to read on dark. Everything inverts through the tokens, so the "ink" tile
   becomes the light block. It is a mode for the whole piece. A cream piece never gets a dark
   section and a dark piece never gets a cream one.
5. **Emphasis without colour is a tile ramp:** ink tile (the hero), stone tile `--n6` (supporting),
   grey tile `--n5` (third). One ink block per page: an ink `.tile`, the `.bc.hero` cell or the
   `.takeaway` bar.
6. **Sections change by ground, never by hue:** paper to `--ground-2` (`.sect.alt`).
7. **Cells** (`--cell-dawn`, `-mist`, `-sand`, `-moss`) are soft gradient fields that hold one card
   (`.cellx > .card`) or one statement (`.bc.dawn`). Background only. One cell per page, no data on it.
8. A multi-series chart stays in greys: this period ink, last period mid grey, everyone else pale
   (`.legend4`). Tell series apart by tone and dash before reaching for hue.

**A different brand** is one line, first in the page's bottom script:
`AS.theme({paper: '#eef1f4', ink: '#0e1c2f', signal: '#e4502a'})`. From those three it derives the
card paper, the six greys, the text greys, the grounds, the cover glows, the four cells and the orb
palette, and every chart follows. Pass only `signal` to change just the accent. In markup use the
tokens (`var(--ink)`, `var(--n3)`, `var(--signal)`), including as an SVG `fill`; in chart data use
tone names (`'n1'`..`'n6'`, `'signal'`, `'paper'`). Never type a hex into a page.

## Orbs

An orb is a soft gradient sphere: `<i class="orbx dawn" style="--o:300px"></i>`. It is the one piece
of art the style allows, an object and never a background.

- Use it large on a cover, opener or quote slide, or as the face of an agent, a voice or a product
  that has no picture. Use it small (`.author .orbx`, 46px) beside a name that has no photo.
- Palettes: `dawn` (default), `mist`, `sand`, `moss`, `tide` (the signal family), `ink`.
  `data-seed="7"` picks a different swirl so two orbs on a page do not match.
- One large orb per page. It never holds text, an icon or data, and nothing overlaps it.
- `tide` counts as the page's signal mark.
- It is painted on a canvas by `icons.js` (soft blobs, a highlight, a little grain), so the page
  needs that script. Do not rebuild it from CSS gradients or blur filters: those print with seams.
- The blurred `.orb.o1/.o2/.o3` fields are a different thing: page atmosphere behind a cover headline.

## Shape

- **Concentric radii.** A shape inside a rounded shape uses `outer radius - padding`, with a floor of
  6px (`--r-in`). In practice: inside a 24 to 28px card, inner things are 6 to 8px or full pills,
  never a second 20px.
- **Continuous corners.** `.bc`, `.tile`, `.cellx`, `.plan` and `.idisc.sq` use `corner-shape:squircle`
  where the browser has it and fall back to a plain radius.
- **Pill or rectangle.** Controls are pills. Tags and codes are square-cornered (3px) so they never
  read as buttons. Circles are for icon discs, avatars, numbered badges and dots.
- **Gutter and radius move together.** In a summary grid the radius is twice the gutter (28 and 14).
- A phone frame is 56 outer, 12 bezel, 44 screen. Cards inside the screen are 22.

## Marks and lockups

A mark is two primitives on an 8-unit grid, in one ink. `AS.mark(name)` has eleven starting points:

| Name | Looks like |
|---|---|
| `dab` | disc with a small dot low right (palette's own logo) |
| `dot`, `ring` | solid disc; thick ring |
| `split` | disc cut into two halves by a vertical gap |
| `orbit` | ring with a dot in the centre |
| `stem` | tall pill with a dot beside its foot |
| `quarter` | quarter disc with a dot in the open corner |
| `stack` | long pill over a short pill |
| `steps` | three rising bars |
| `grid` | four dots in a square |
| `notch` | rounded square with one corner cut out and a dot in it |

Draw your own the same way. Register it once, first in the bottom script, and use it by name
everywhere (`{sig}` marks the second primitive):

```js
AS.addMark('tide', '<path d="M.5 4a3.5 3.5 0 0 1 7 0z"/><circle {sig} cx="4" cy="6.3" r="1.2"/>');
```
```html
<i class="mk" data-m="tide"></i>
```

Or inline, where it fills `--m` like a built-in mark:

```html
<i class="mk"><svg viewBox="0 0 8 8" fill="currentColor"><path d="M.5 5a3.5 3.5 0 0 1 7 0z"/><circle cx="4" cy="6.6" r="1" fill="var(--signal)"/></svg></i>
```

The second primitive takes `fill="var(--signal)"` only on a cover or end card; elsewhere leave it ink.

```html
<span class="lockup"><i class="mk" data-m="split"></i><span class="nm">halden<small>billing</small></span></span>
<span class="lockup one" style="--m:40px"><i class="mk" data-m="split"></i><span class="nm">halden</span></span>
```

- Mark height is two lines of the name (`--m`). Gap 0.4 of the mark. Name lowercase, weight 600; the
  second line is the product, in grey.
- Clear space is half the mark on every side (`.clearbox` shows it). Minimum 16px on screen, 8mm in print.
- Once per page, in a corner (the `.mast`). Once more, larger, on the last page.
- One ink. Never tinted with the signal, never on a gradient or photo, never rotated, never a pattern.
  `<i class="mk sig">` puts the signal on the second primitive: the cover or end card of a deck or
  report only. A social card is not a cover for this: its mark stays one ink.
- **Other people's logos** go in `.logos`: a grid, not a marquee, every logo forced to one ink at 42%
  and one height (`--lh`, 28px). `<img>` files are flattened with a filter; `.ph` is a text
  placeholder. A partnership is `.cobrand`: your lockup, a thin `×`, theirs, on stone.
- Never draw or imitate a real company's logo. Use the file they publish, or a text placeholder.

## Icons

`assets/icons.js`: 110 icons drawn for this skill on one grid. `<i class="ic" data-i="shield-check"></i>`
is hydrated on load and sized by `--ic` or the font size; `AS.icon(name, {size})` returns the SVG string.
`check.js` fails the render on an unknown name.

- 24 grid, live area 3 to 21. One stroke: 1.5 at 24px, thicker as the icon shrinks (handled for you).
  Round caps and joins. Lines, circular arcs and rounded rectangles only. No fills except a dot.
- One idea per icon. Sizes 16, 20, 24. An icon sits beside text of the same weight, never alone as
  the only label for an action people have not learned.
- **Icon disc** `.idisc` (`--d` sets the size): the glyph is half the disc, one fill, no shadow.
  `.ink`, `.ring`, `.paper`, `.sq` (continuous-corner tile). One style of disc per page.
- Icons are ink. `.ic.sig` colours only the icon's dot, for a live state.
- Need one that is missing? Draw it to the construction rules at the top of `icons.js` and add it there.
- Names say what the picture is, not what you might want it for: `waveform` (and its old alias
  `wave`) is an audio waveform, `swell` is water, `bolt` is lightning, `dial` is a knob.
- Every name: `home` `search` `menu` `more` `close` `plus` `minus` `check` `chevron-right` `chevron-left` `chevron-down` `chevron-up` `arrow-right` `arrow-left` `arrow-up` `arrow-down` `arrow-up-right` `external` `filter` `sort` `sliders` `settings` `refresh` `download` `upload` `share` `send` `link` `copy` `edit` `trash` `power` `command` `grid` `list` `columns` `sidebar` `table` `layers` `user` `users` `lock` `unlock` `key` `shield` `shield-check` `eye` `eye-off` `bell` `inbox` `info` `alert` `help` `check-circle` `x-circle` `flag` `bookmark` `star` `heart` `tag` `target` `sparkle` `bolt` `calendar` `clock` `pin` `globe` `swell` `sun` `moon` `mail` `chat` `play` `pause` `stop` `record` `mic` `volume` `waveform` `headphones` `image` `file` `doc` `folder` `code` `terminal` `database` `server` `cloud` `cpu` `box` `branch` `pr` `bug` `ticket` `chart-bar` `chart-line` `chart-pie` `trend-up` `trend-down` `card` `cart` `dollar` `phone` `laptop` `dial` `toggle` `signal` `wifi` `battery`

## Labels

| Class | What it is |
|---|---|
| `.tagx` | square inverse tag for a state word (`LIVE`). `.line` outlined, `.sigc` the one signal tag |
| `.code` | model code in mono: two letters, en dash, number (`HD–04`). `<sup>` is a version, in signal |
| `.plate` | label plate: 1px outline, code, descriptor, version (`<em>`, grey; `<em class="sig">` makes it the page's signal mark), micro spec columns (`--cols`, default 3). It lowercases its text; wrap a unit or code in `.keep` |
| `.vers` | version table: code, dotted leader, value. The current row's value is `<em>` |
| `.legend4` | up to four swatches with lowercase mono labels, top right of a card: `<span class="legend4"><span><i></i>this year</span><span><i class="g2"></i>last year</span></span>`. Swatches: `i` ink, `i.g2` mid grey, `i.g3` pale, `i.s` signal. `.legend4.dot` makes them round. Keep it under about 300px in a half card |
| `.ports` | port strip: equal cells, some filled. Progress through a deck or a process |
| `.keyg` | key glyph: rounded square, inscribed circle, numeral. Steps and callouts. `.on` is current |
| `.nb` | numbered circle badge on a tile |
| `.spill`, `.badge` | neutral status word; outlined pill ("Popular") |

Readouts are charts: `AS.matrix` (dot-matrix number), `AS.meter` (segment level), `AS.stepgrid`,
`AS.waffle`, `AS.donut`. See the style guide.
