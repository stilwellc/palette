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
4. **Emphasis without colour is a tile ramp:** ink tile (the hero), stone tile `--n6` (supporting),
   grey tile `--n5` (third). One ink block per page: an ink `.tile`, the `.bc.hero` cell or the
   `.takeaway` bar. Never a dark page.
5. **Sections change by ground, never by hue:** paper to `--ground-2` (`.sect.alt`).
6. **Cells** (`--cell-dawn`, `-mist`, `-sand`, `-moss`) are soft gradient fields that hold one card
   (`.cellx > .card`) or one statement (`.bc.dawn`). Background only. One cell per page, no data on it.
7. A multi-series chart stays in greys: this period ink, last period mid grey, everyone else pale
   (`.legend4`). Tell series apart by tone and dash before reaching for hue.

Change the signal for a brand with `AS.theme({signal: '#e4502a'})` at the top of the page script, or
set `--signal` on `:root`. Pick one hue and keep it.

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

A mark is two primitives on an 8-unit grid, in one ink. `AS.mark(name)` has ten starting points
(`dot ring split orbit stem quarter stack steps grid notch`); draw your own the same way.

```html
<span class="lockup"><i class="mk" data-m="split"></i><span class="nm">halden<small>billing</small></span></span>
<span class="lockup one" style="--m:40px"><i class="mk" data-m="split"></i><span class="nm">halden</span></span>
```

- Mark height is two lines of the name (`--m`). Gap 0.4 of the mark. Name lowercase, weight 600; the
  second line is the product, in grey.
- Clear space is half the mark on every side (`.clearbox` shows it). Minimum 16px on screen, 8mm in print.
- Once per page, in a corner (the `.mast`). Once more, larger, on the last page.
- One ink. Never tinted with the signal, never on a gradient or photo, never rotated, never a pattern.
  `<i class="mk sig">` puts the signal on the second primitive: cover or end card only.
- **Other people's logos** go in `.logos`: a grid, not a marquee, every logo forced to one ink at 42%
  and one height (`--lh`, 28px). `<img>` files are flattened with a filter; `.ph` is a text
  placeholder. A partnership is `.cobrand`: your lockup, a thin `×`, theirs, on stone.
- Never draw or imitate a real company's logo. Use the file they publish, or a text placeholder.

## Icons

`assets/icons.js`: 109 icons drawn for this skill on one grid. `<i class="ic" data-i="shield-check"></i>`
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

## Labels

| Class | What it is |
|---|---|
| `.tagx` | square inverse tag for a state word (`LIVE`). `.line` outlined, `.sigc` the one signal tag |
| `.code` | model code in mono: two letters, en dash, number (`HD–04`). `<sup>` is a version, in signal |
| `.plate` | label plate: 1px outline, code, descriptor, version, three micro spec columns |
| `.vers` | version table: code, dotted leader, value. The current row's value is `<em>` |
| `.legend4` | up to four swatches with lowercase mono labels, top right of a card. `.dot` for round |
| `.ports` | port strip: equal cells, some filled. Progress through a deck or a process |
| `.keyg` | key glyph: rounded square, inscribed circle, numeral. Steps and callouts. `.on` is current |
| `.nb` | numbered circle badge on a tile |
| `.spill`, `.badge` | neutral status word; outlined pill ("Popular") |

Readouts are charts: `AS.matrix` (dot-matrix number), `AS.meter` (segment level), `AS.stepgrid`,
`AS.waffle`, `AS.donut`. See the style guide.
