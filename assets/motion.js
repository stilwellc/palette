/* palette motion: animate charts that charts.js has ALREADY drawn. Plain JS, no dependencies.
   Load it after charts.js:  <script src="../assets/charts.js"></script><script src="../assets/motion.js"></script>

   The contract (the same one templates/pitch.html states, and scripts/animate.sh relies on):
   a page reads the time t, in seconds, from the URL hash, draws that one instant and stops. No CSS
   transitions, no CSS animations, no timers, no requestAnimationFrame. animate.sh loads the page once
   per frame (page.html#t=0.00, #t=0.08, ...) in any order and screenshots it, so everything here is a
   pure function of the progress you pass in: the same p always gives the same picture, and p >= 1
   gives the chart exactly as charts.js drew it (every attribute restored).

   Time and easing
     AS.t()                         seconds from the hash: page.html#t=1.2 or page.html#1.2 -> 1.2; no hash -> 0
     AS.ease(x)                     ease-out cubic, x clamped to 0..1:        AS.ease(.5) -> 0.875
     AS.span(t, start, dur)         eased 0..1 progress of one segment:       AS.span(t, .6, .8) is 0 until 0.6 s, 1 from 1.4 s
     AS.lin(t, start, dur)          the same segment, linear. Feed this to AS.reveal, which eases each mark itself
     AS.stagger(i, n, p, overlap)   eased progress of item i of n inside p (overlap .6: the next item starts when
                                    this one is 40% through):                 rows.forEach((el, i) => AS.fadeUp(el, AS.stagger(i, rows.length, p)))

   Charts
     AS.reveal(svg, p, opts)        show a drawn chart at progress p (0 = scaffold only, 1 = as drawn).
                                    svg: the <svg> a helper returned, its container, or a selector.
                                    opts: {overlap: .6, minWindow: .3} how much consecutive marks overlap, and the
                                    smallest share of p one mark may take (many marks then start closer together).
       const svg = AS.compare('#c', {...});
       AS.reveal(svg, AS.lin(AS.t(), .6, 2.4));          // the chart builds from 0.6 s to 3.0 s

     What moves (found from each element's geometry, never from which helper drew it):
       vertical bars, stacks      grow from the baseline, a stack as one column; bars drawn downward grow down;
                                  a floating step (waterfall) grows away from the level the bar before it ended on
       horizontal bars, pills     grow from the left edge, a segmented row as one bar; the pale track stays put
       line paths                 draw from their first point (stroke-dasharray over getTotalLength(), dash
                                  patterns kept); a fill that shares the line's points fades in behind it
       other filled paths         fade in (stacked areas, flow ribbons)
       lines with weight          draw from (x1,y1) to (x2,y2): slope lines, dumbbell connectors
       dots on a line             scale in at their final position when the line reaches them
       free dots                  scale in, left to right (scatter)
       rings                      sweep (donut), several segments as one sweep
       cell grids                 light up in order, from the unlit look when the grid has unlit cells
                                  (meter, stepgrid, waffle, matrix); lanes with a label run side by side
       text, chips, tick marks    fade in shortly after the mark nearest to them
     What is there from p = 0: gridlines, axis lines, axis text (.ax, .axl), category labels (left of or below
     every mark), pale tracks, unlit cells, legend dots.

   Numbers and blocks (pass these an eased progress, usually AS.span)
     AS.countUp(el, to, p, fmt)     el's text becomes the value at p. An integer target stays an integer on the way,
                                    a decimal keeps its decimals; fmt formats it:
       AS.countUp('#n', 96, AS.span(t, 0, .8), v => v + '%');
     AS.fadeUp(el, p, dy = 16)      opacity p and a rise of dy px, as inline style; at p >= 1 both are removed:
       AS.fadeUp('h1', AS.span(t, 0, .6));

   Keep every animated block in the layout from the first frame (fadeUp only changes opacity and transform),
   and give a counting number room for its final width, so nothing shifts between frames. */
(function (g) {
  const AS = g.AS = g.AS || {};
  const clamp = x => Math.min(1, Math.max(0, x));
  const ease = x => 1 - Math.pow(1 - clamp(x), 3);
  const inv = e => 1 - Math.cbrt(1 - clamp(e));            // the linear clock at which ease() reaches e
  const one = el => typeof el === 'string' ? document.querySelector(el) : el;
  const f2 = v => +(+v).toFixed(2);

  function t() { const v = parseFloat(String(location.hash).replace(/^#(t=)?/, '')); return isFinite(v) ? v : 0; }
  const lin = (time, start, dur) => clamp(dur > 0 ? (time - start) / dur : (time >= start ? 1 : 0));
  const span = (time, start, dur) => ease(lin(time, start, dur));
  function stagger(i, n, p, overlap = .6) {
    if (n <= 1) return ease(p);
    const w = 1 / (1 + (n - 1) * (1 - overlap));
    return ease((clamp(p) - i * w * (1 - overlap)) / w);
  }

  function countUp(el, to, p, fmt) {
    el = one(el); if (!el) return;
    const dec = Number.isInteger(to) ? 0 : Math.min(6, (String(to).split('.')[1] || '').length);
    const v = p >= 1 ? to : +(to * clamp(p)).toFixed(dec);
    el.textContent = fmt ? fmt(v) : dec ? v.toFixed(dec) : String(v);
  }
  function fadeUp(el, p, dy = 16) {
    el = one(el); if (!el) return;
    if (p >= 1) { el.style.removeProperty('opacity'); el.style.removeProperty('transform'); return; }
    p = clamp(p); el.style.opacity = +p.toFixed(3); el.style.transform = `translateY(${f2((1 - p) * dy)}px)`;
  }

  /* ---------------------------------- reveal ---------------------------------- */
  const DRAW = .8;      // a line is fully drawn at this point of its own clock; its last dot and label follow
  const DOT = .25;      // how long a dot takes to scale in
  const LD = .4;        // how long a label takes to fade in
  const plans = new WeakMap();
  const A = (el, a) => el.getAttribute(a);
  const num = (el, a, d = 0) => { const v = parseFloat(el.getAttribute(a)); return isNaN(v) ? d : v; };
  const NUM = '(-?\\d*\\.?\\d+(?:e-?\\d+)?)';
  // the shape charts.js bar() writes: M x,base V Q x,tip x+r,tip H Q x+w,tip x+w,. V base Z
  const BAR = new RegExp(`^M${NUM},${NUM}V${NUM}Q${NUM},${NUM} ${NUM},${NUM}H${NUM}Q${NUM},${NUM} ${NUM},${NUM}V${NUM}Z$`);
  const barD = (b, tip) => {
    const len = Math.abs(tip - b.base), r = Math.min(b.r, len, (b.x1 - b.x0) / 2), s = b.dir;   // s: -1 grows up, 1 down
    return `M${b.x0},${b.base}V${f2(tip - s * r)}Q${b.x0},${f2(tip)} ${f2(b.x0 + r)},${f2(tip)}H${f2(b.x1 - r)}Q${b.x1},${f2(tip)} ${b.x1},${f2(tip - s * r)}V${b.base}Z`;
  };

  function build(svg) {
    const vb = svg.viewBox.baseVal, VW = vb.width || 1, VH = vb.height || 1;
    const els = [...svg.querySelectorAll('rect,path,circle,line,text')]
      .filter(el => A(el, 'opacity') !== '0' && A(el, 'fill') !== 'transparent');   // hover columns and the crosshair
    const dom = new Map(els.map((el, i) => [el, i]));
    const by = tag => els.filter(el => el.tagName === tag);
    const units = [], labels = [], marks = [], scaffold = [], dotMarks = [];
    const unit = (kind, key, el, run) => { const u = { kind, key, dom: dom.get(el), E: 1, run, c: 0 }; units.push(u); return u; };
    const mark = (u, x0, y0, x1, y1, at) => { const m = { unit: u, x0, y0, x1, y1, at }; marks.push(m); return m; };
    const texts = by('text').map(el => ({ el, x: num(el, 'x'), y: num(el, 'y'), anchor: A(el, 'text-anchor') || 'start', cls: A(el, 'class') || '' }));

    /* ---- rects ---- */
    let rects = by('rect').map(el => ({ el, x: num(el, 'x'), y: num(el, 'y'), w: num(el, 'width'), h: num(el, 'height') }));
    const chips = rects.filter(r => { const s = A(r.el, 'stroke'), f = A(r.el, 'fill');     // an outlined pill behind a value
      return s && s !== 'none' && f && f !== 'none' && texts.some(tx => tx.x >= r.x && tx.x <= r.x + r.w && tx.y >= r.y && tx.y <= r.y + r.h); });
    rects = rects.filter(r => !chips.includes(r));
    // a track is a rect with a later rect lying on it (same row, inside its width)
    const tracked = new Set(), tracks = new Set();
    rects.forEach((a, i) => { if (tracked.has(a)) return;
      for (let j = i + 1; j < rects.length; j++) { const b = rects[j];
        if (Math.abs(b.y - a.y) < .6 && Math.abs(b.h - a.h) < .6 && b.x >= a.x - .6 && b.x + b.w <= a.x + a.w + .6) { tracks.add(a); tracked.add(b); } } });
    tracks.forEach(r => scaffold.push([r.x, r.y, r.x + r.w, r.y + r.h]));
    rects = rects.filter(r => !tracks.has(r));

    /* ---- cell grids (rects of one size packed together, circles of one size on a tight lattice) ---- */
    const cellSets = [];
    const groupBy = (arr, key) => { const m = new Map(); arr.forEach(o => { const k = key(o); (m.get(k) || m.set(k, []).get(k)).push(o); }); return [...m.values()]; };
    const minGap = vals => { const s = [...new Set(vals.map(v => +v.toFixed(1)))].sort((a, b) => a - b); let gmin = Infinity;
      for (let i = 1; i < s.length; i++) gmin = Math.min(gmin, s[i] - s[i - 1]); return { gmin, s }; };
    groupBy(rects.filter(r => !tracked.has(r)), r => r.w.toFixed(2) + '|' + r.h.toFixed(2)).forEach(grp => {
      if (grp.length < 6) return;
      const gx = minGap(grp.map(r => r.x)).gmin, gy = minGap(grp.map(r => r.y)).gmin;
      if (gx <= grp[0].w * 1.6 || gy <= grp[0].h * 1.6) cellSets.push(grp.map(r => ({ el: r.el, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h })));
    });
    const inCells = new Set(cellSets.flat().map(c => c.el));
    rects = rects.filter(r => !inCells.has(r.el));
    let circles = by('circle').map(el => ({ el, cx: num(el, 'cx'), cy: num(el, 'cy'), r: num(el, 'r') }));
    const sweeps = circles.filter(c => A(c.el, 'fill') === 'none' && A(c.el, 'stroke-dasharray'));
    const ringTrack = circles.filter(c => !sweeps.includes(c) && A(c.el, 'fill') === 'none' && sweeps.some(s => s.cx === c.cx && s.cy === c.cy && s.r === c.r));
    circles = circles.filter(c => !sweeps.includes(c) && !ringTrack.includes(c));
    groupBy(circles, c => c.r.toFixed(2)).forEach(grp => {
      if (grp.length < 6) return;
      const { gmin, s } = minGap(grp.map(c => c.cy));
      if (s.length < 2 || gmin > grp[0].r * 4 || minGap(grp.map(c => c.cx)).gmin > grp[0].r * 4) return;
      if (!s.every(v => { const k = (v - s[0]) / gmin; return Math.abs(k - Math.round(k)) < .06; })) return;
      cellSets.push(grp.map(c => ({ el: c.el, x0: c.cx - c.r, y0: c.cy - c.r, x1: c.cx + c.r, y1: c.cy + c.r })));
    });
    cellSets.flat().forEach(c => inCells.add(c.el));
    circles = circles.filter(c => !inCells.has(c.el));
    cellSets.forEach(cells => {
      cells.forEach(c => { c.fill = A(c.el, 'fill'); c.fo = num(c.el, 'fill-opacity', 1); scaffold.push([c.x0, c.y0, c.x1, c.y1]); });
      const fills = new Set(cells.map(c => c.fill));
      // the unlit look: a fill that only ever appears faded, next to at least one other fill
      const offCell = fills.size > 1 && cells.find(c => c.fo < 1 && !cells.some(d => d.fill === c.fill && d.fo !== c.fo));
      const on = offCell ? cells.filter(c => !(c.fill === offCell.fill && c.fo === offCell.fo)) : cells;
      if (!on.length) return;
      const gx0 = Math.min(...cells.map(c => c.x0)), gx1 = Math.max(...cells.map(c => c.x1));
      const lanes = texts.some(tx => (tx.x < gx0 - 1 || tx.x > gx1 + 1) && cells.some(c => tx.y >= c.y0 - 2 && tx.y <= c.y1 + 6));
      const sets = lanes ? groupBy(on, c => c.y0.toFixed(1)).map(row => row.sort((a, b) => a.x0 - b.x0)) : [on];
      sets.forEach(set => {
        const m = set.length, k = Math.max(2, m * .25);
        const u = unit('c', set[0].y0, set[0].el, (c, put) => { const uu = clamp(c);
          set.forEach((cell, j) => { const q = clamp((uu * (m - 1 + k) - j) / k); if (q >= 1) return;
            if (!offCell) put(cell.el, 'opacity', q <= 0 ? 0 : f2(q));
            else if (q <= 0) { put(cell.el, 'fill', offCell.fill); put(cell.el, 'fill-opacity', offCell.fo); }
            else put(cell.el, 'fill-opacity', f2((.15 + .85 * q) * cell.fo)); }); });
        mark(u, Math.min(...set.map(c => c.x0)), Math.min(...set.map(c => c.y0)), Math.max(...set.map(c => c.x1)), Math.max(...set.map(c => c.y1)), .85);
      });
    });

    /* ---- paths ---- */
    const barPaths = [], linePaths = [], fillPaths = [];
    by('path').forEach(el => {
      const d = A(el, 'd') || '', m = d.match(BAR);
      if (m) { const v = m.slice(1).map(Number), b = { el, x0: v[0], base: v[1], tip: v[4], x1: v[8], r: Math.abs(v[2] - v[4]) }; b.dir = b.tip <= b.base ? -1 : 1; barPaths.push(b); }
      else if ((A(el, 'fill') || '') === 'none') linePaths.push({ el, d });
      else fillPaths.push({ el, d });
    });

    /* ---- vertical bars: a bar() path, with any rects stacked under it, is one column ---- */
    const cols = barPaths.map(b => {
      const segs = b.dir < 0 ? rects.filter(r => Math.abs(r.x - b.x0) < .6 && Math.abs(r.x + r.w - b.x1) < .6 && r.y >= b.tip - .6) : [];
      rects = rects.filter(r => !segs.includes(r));
      return { x: b.x0, el: b.el, b, segs, base: Math.max(b.base, ...segs.map(r => r.y + r.h)), end: b.tip };
    });
    // what is left: rows grow from the left, columns from the bottom
    const horiz = r => tracked.has(r) || (!barPaths.length && r.w >= r.h);
    rects.filter(r => !horiz(r)).forEach(r => cols.push({ x: r.x, el: r.el, r }));
    cols.sort((a, b) => a.x - b.x || dom.get(a.el) - dom.get(b.el));
    const seps = by('line').filter(el => num(el, 'y1') === num(el, 'y2'));
    const usedLines = new Set();
    let prevEnd = null;
    cols.forEach(col => {
      if (col.b) {
        const { b, segs, base, end } = col, full = Math.abs(end - base) || 1;
        const mine = seps.filter(el => { const y = num(el, 'y1'); return segs.length && Math.abs(Math.min(num(el, 'x1'), num(el, 'x2')) - b.x0) < .6 && Math.abs(Math.max(num(el, 'x1'), num(el, 'x2')) - b.x1) < .6 && y > end && y < base; });
        mine.forEach(el => usedLines.add(el));
        const u = unit('v', col.x, b.el, (c, put) => {
          const front = base + (end - base) * ease(c);
          put(b.el, 'd', barD(b, b.dir < 0 ? Math.min(b.base, Math.max(front, b.tip)) : front));
          segs.forEach(r => { const y = Math.max(front, r.y), h = Math.max(0, r.y + r.h - y); put(r.el, 'y', f2(y)); put(r.el, 'height', f2(h)); });
          mine.forEach(el => { if (num(el, 'y1') < front + .5) put(el, 'opacity', 0); });
        });
        mark(u, b.x0, Math.min(b.tip, b.base), b.x1, Math.max(b.tip, b.base), .7);
        segs.forEach(r => mark(u, r.x, r.y, r.x + r.w, r.y + r.h, Math.min(.7, inv((base - r.y) / full))));
        prevEnd = end;
      } else {
        const r = col.r, top = r.y, bot = r.y + r.h;
        const down = prevEnd != null && Math.abs(top - prevEnd) < Math.abs(bot - prevEnd) - .01;   // a fall starts where the last bar ended
        const u = unit('v', col.x, r.el, (c, put) => { const h = r.h * ease(c); if (!down) put(r.el, 'y', f2(bot - h)); put(r.el, 'height', f2(h)); });
        mark(u, r.x, top, r.x + r.w, bot, .7);
        prevEnd = down ? bot : top;
      }
    });

    /* ---- horizontal bars: every rect in a row is one bar ---- */
    groupBy(rects.filter(horiz), r => r.y.toFixed(1) + '|' + r.h.toFixed(1)).forEach(row => {
      const x0 = Math.min(...row.map(r => r.x)), x1 = Math.max(...row.map(r => r.x + r.w)), full = (x1 - x0) || 1;
      const u = unit('h', row[0].y, row[0].el, (c, put) => { const front = x0 + full * ease(c);
        row.forEach(r => put(r.el, 'width', f2(Math.min(r.w, Math.max(0, front - r.x))))); });
      row.forEach(r => mark(u, r.x, r.y, r.x + r.w, r.y + r.h, Math.min(.7, inv((r.x + r.w - x0) / full))));
    });

    /* ---- things that draw: stroked paths and weighted lines, with the dots that sit on them ---- */
    const draws = [];
    linePaths.forEach(lp => {
      let pts = null, cum = null, L = 0;
      if (/^M[-\d.,eL\s]+$/.test(lp.d)) {
        pts = lp.d.split(/[ML]/).filter(Boolean).map(s => s.trim().split(/[,\s]+/).map(Number));
        cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      }
      try { L = lp.el.getTotalLength(); } catch (e) { L = cum ? cum[cum.length - 1] : 0; }
      let pat = (A(lp.el, 'stroke-dasharray') || '').split(/[\s,]+/).map(Number).filter(v => v >= 0 && isFinite(v));
      if (!pat.length || !pat.some(v => v > 0)) pat = null; else if (pat.length % 2) pat = pat.concat(pat);
      draws.push({ el: lp.el, path: true, d: lp.d, pts, cum, L, pat, dots: [], fills: [] });
    });
    const gridLines = [];
    by('line').forEach(el => {
      if (usedLines.has(el)) return;
      const x1 = num(el, 'x1'), y1 = num(el, 'y1'), x2 = num(el, 'x2'), y2 = num(el, 'y2'), sw = num(el, 'stroke-width', 1), dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
      const straight = dx < .01 || dy < .01, dashed = !!A(el, 'stroke-dasharray'), long = dx >= VW * .5 || dy >= VH * .5;
      if (straight && sw <= 1.2 && (!dashed || long)) { gridLines.push(el); return; }           // grid, axis, guides
      if (sw >= 1.3 && dx >= dy) draws.push({ el, line: true, pts: [[x1, y1], [x2, y2]], cum: [0, Math.hypot(dx, dy)], L: Math.hypot(dx, dy), dots: [], fills: [] });
      else labels.push({ el, x: (x1 + x2) / 2, y: (y1 + y2) / 2 });                             // leaders, target ticks, connectors
    });
    draws.sort((a, b) => dom.get(a.el) - dom.get(b.el));
    // a dot belongs to the line whose point it sits on (the nearest one before it in the svg, if several)
    const free = [];
    circles.forEach(c => {
      let best = null;
      draws.forEach(dr => { if (!dr.pts) return; const k = dr.pts.findIndex(pt => Math.abs(pt[0] - c.cx) < .6 && Math.abs(pt[1] - c.cy) < .6); if (k < 0) return;
        const before = dom.get(dr.el) < dom.get(c.el), tot = dr.cum[dr.cum.length - 1];
        const cand = { dr, f: tot ? dr.cum[k] / tot : (k ? 1 : 0), before, di: dom.get(dr.el) };
        if (!best || (cand.before && !best.before) || (cand.before === best.before && (cand.before ? cand.di > best.di : cand.di < best.di))) best = cand; });
      if (best) best.dr.dots.push({ ...c, f: best.f }); else free.push(c);
    });
    // a fill whose outline starts with a line's points fades in behind that line; any other fill fades on its own
    fillPaths.forEach(fp => {
      const dr = draws.find(d2 => d2.path && d2.d.length > 3 && fp.d.startsWith(d2.d));
      const fo = num(fp.el, 'fill-opacity', 1);
      if (dr) { dr.fills.push({ el: fp.el, fo }); return; }
      const u = unit('d', 0, fp.el, (c, put) => { const q = ease(c); if (q < 1) put(fp.el, 'fill-opacity', f2x(fo * q)); });
      let bb = null; try { bb = fp.el.getBBox(); } catch (e) { /* not rendered */ }
      if (bb) mark(u, bb.x, bb.y, bb.x + bb.width, bb.y + bb.height, .7);
    });
    draws.forEach(dr => {
      const u = unit('d', 0, dr.el, (c, put) => {
        const fr = ease(c / DRAW);
        if (fr < 1) {
          if (fr <= 0) put(dr.el, 'opacity', 0);
          else if (dr.line) { put(dr.el, 'x2', f2(dr.pts[0][0] + (dr.pts[1][0] - dr.pts[0][0]) * fr)); put(dr.el, 'y2', f2(dr.pts[0][1] + (dr.pts[1][1] - dr.pts[0][1]) * fr)); }
          else if (dr.L > 0) put(dr.el, 'stroke-dasharray', dashFor(dr.pat, dr.L * fr, dr.L));
          dr.fills.forEach(fl => put(fl.el, 'fill-opacity', f2x(fl.fo * fr)));
        }
        dr.dots.forEach(dt => { const q = ease((c - DRAW * inv(dt.f)) / DOT); if (q >= 1) return;
          if (q <= 0) put(dt.el, 'opacity', 0); else put(dt.el, 'r', f2(dt.r * q)); });
      });
      if (dr.dots.length) u.E = DRAW + DOT;
      if (dr.pts && dr.pts.length) { const a = dr.pts[0], b = dr.pts[dr.pts.length - 1];
        mark(u, a[0], a[1], a[0], a[1], .08); mark(u, b[0], b[1], b[0], b[1], DRAW + .08); }
      else { let bb = null; try { bb = dr.el.getBBox(); } catch (e) { /* not rendered */ }
        if (bb) mark(u, bb.x, bb.y, bb.x + bb.width, bb.y + bb.height, DRAW + .08); }
      dr.dots.forEach(dt => dotMarks.push({ ...dt, m: mark(u, dt.cx - dt.r, dt.cy - dt.r, dt.cx + dt.r, dt.cy + dt.r, DRAW * inv(dt.f) + .08) }));
    });

    /* ---- rings (donut): the segments around one centre sweep as one ---- */
    groupBy(sweeps, c => [c.cx, c.cy, c.r].join('|')).forEach(grp => {
      const segs = grp.map(c => { const da = A(c.el, 'stroke-dasharray').split(/[\s,]+/).map(Number); return { el: c.el, len: da[0], rest: da[1] ?? da[0], off: -num(c.el, 'stroke-dashoffset') }; })
        .sort((a, b) => a.off - b.off);
      const start = segs[0].off, total = Math.max(...segs.map(s => s.off + s.len)) - start, c0 = grp[0];
      const u = unit('o', 0, c0.el, (c, put) => { const front = start + total * ease(c);
        segs.forEach(s => { const vis = Math.min(s.len, Math.max(0, front - s.off)); if (vis >= s.len) return;
          if (vis <= .01) put(s.el, 'opacity', 0); else put(s.el, 'stroke-dasharray', `${f2(vis)} ${s.rest}`); }); });
      mark(u, c0.cx - c0.r, c0.cy - c0.r, c0.cx + c0.r, c0.cy + c0.r, .7);
    });
    ringTrack.forEach(c => scaffold.push([c.cx - c.r, c.cy - c.r, c.cx + c.r, c.cy + c.r]));

    /* ---- free dots: a scatter. Next to dots that sit on lines they are a legend, and stay ---- */
    if (!draws.some(dr => dr.dots.length)) free.forEach(c => {
      const u = unit('s', c.cx, c.el, (cl, put) => { const q = ease(cl); if (q >= 1) return; if (q <= 0) put(c.el, 'opacity', 0); else put(c.el, 'r', f2(c.r * q)); });
      dotMarks.push({ ...c, m: mark(u, c.cx - c.r, c.cy - c.r, c.cx + c.r, c.cy + c.r, .5) });
    });

    /* ---- reading order ---- */
    const rank = { v: 0, h: 1, c: 2, d: 3, o: 4, s: 5 };
    units.sort((a, b) => rank[a.kind] - rank[b.kind] || a.key - b.key || a.dom - b.dom);
    units.forEach((u, i) => { u.i = i; });

    /* ---- text and other small things: static, or after the nearest mark ---- */
    const boxes = marks.map(m => [m.x0, m.y0, m.x1, m.y1]).concat(scaffold);
    const minX = Math.min(...boxes.map(b => b[0])), maxY = Math.max(...boxes.map(b => b[3]));
    marks.forEach(m => { m.unit.last = Math.max(m.unit.last || 0, m.at); });
    const nearest = (px, py) => { let best = null, bs = Infinity;
      marks.forEach(m => { const dx = Math.max(m.x0 - px, 0, px - m.x1), dy = Math.max(m.y0 - py, 0, py - m.y1);
        const s = Math.hypot(dx, dy) + (dx <= 6 || dy <= 6 ? 0 : 1e4);                          // same row or column first
        if (s < bs - .01 || (Math.abs(s - bs) <= .01 && best && m.unit.i < best.unit.i)) { bs = s; best = m; } });
      if (!best || bs > 1e4 + 40) return null;                                                  // near nothing: part of the scaffold
      return bs > 40 ? { unit: best.unit, at: best.unit.last } : best; };                       // far along its row: after the whole mark
    const rings = marks.filter(m => m.unit.kind === 'o');
    const attach = (el, m) => { if (m) out.push({ el, mark: m }); };
    const out = [];
    if (marks.length) {
      texts.forEach(tx => {
        const row = tx.y - 4;                                                                    // a y tick label sits at the start of its gridline
        if (tx.anchor === 'end' && gridLines.some(el => { const x = Math.min(num(el, 'x1'), num(el, 'x2')); return num(el, 'y1') === num(el, 'y2') && Math.abs(num(el, 'y1') - row) < 1.5 && x >= tx.x && x <= tx.x + 14; })) return;
        const dots = dotMarks.filter(dm => Math.abs(tx.x - dm.cx) <= dm.r + 16 && Math.abs(tx.y - 4 - dm.cy) <= 8)
          .sort((a, b) => Math.abs(tx.x - a.cx) - Math.abs(tx.x - b.cx));
        if (dots.length) { out.push({ el: tx.el, mark: dots[0].m }); return; }                  // a value beside its dot
        const ring = rings.find(m => tx.x > m.x0 && tx.x < m.x1 && tx.y > m.y0 && tx.y < m.y1);
        if (ring) { out.push({ el: tx.el, mark: ring }); return; }                               // the number inside a ring
        if (/\bax\b|\baxl\b/.test(tx.cls)) return;                                               // axis text
        if ((tx.anchor === 'end' && tx.x <= minX + .5) || (tx.anchor === 'start' && tx.x <= minX + 1)) return;   // row names
        if (tx.y - 9 >= maxY && !/\bval\b/.test(tx.cls)) return;                                  // category names under the plot
        attach(tx.el, nearest(tx.x, tx.y - 4));
      });
      chips.forEach(r => attach(r.el, nearest(r.x + r.w / 2, r.y + r.h / 2)));
      labels.forEach(l => attach(l.el, nearest(l.x, l.y)));
    }
    out.forEach(l => { l.mark.unit.E = Math.max(l.mark.unit.E, l.mark.at + LD); });
    return { units, labels: out, E: Math.max(1, ...units.map(u => u.E)), orig: new Map() };
  }
  const f2x = v => +(+v).toFixed(4);
  // the dash pattern that shows the first `vis` units of a path of length L, keeping its own dashes if it has any
  function dashFor(pat, vis, L) {
    if (!pat) return `${f2(vis)} ${f2(L + 10)}`;
    const out = []; let pos = 0, i = 0;
    while (pos < vis && out.length < 4000) { const seg = pat[i % pat.length], take = Math.min(seg, vis - pos); out.push(f2(take)); pos += take; i++; if (take < seg) break; }
    if (out.length % 2) out.push(f2(L + 10)); else out[out.length - 1] = f2(out[out.length - 1] + L + 10);
    return out.join(' ');
  }

  function reveal(target, p, opts = {}) {
    let svg = one(target); if (!svg) return null;
    if (svg.tagName.toLowerCase() !== 'svg') svg = svg.querySelector('svg.ch') || svg.querySelector('svg');
    if (!svg) return null;
    let P = plans.get(svg); if (!P) plans.set(svg, P = build(svg));
    // back to the drawing as charts.js left it, then (below 1) set this instant's values
    P.orig.forEach((attrs, el) => { for (const a in attrs) { const v = attrs[a];
      if (v == null) el.removeAttribute(a); else if (el.getAttribute(a) !== v) el.setAttribute(a, v); } });
    p = +p || 0; const n = P.units.length;
    if (p >= 1 || !n) return svg;
    p = Math.max(0, p);
    const put = (el, a, v) => { let o = P.orig.get(el); if (!o) P.orig.set(el, o = {}); if (!(a in o)) o[a] = el.getAttribute(a); el.setAttribute(a, v); };
    const ov = opts.overlap ?? .6;
    const w = Math.min(1 / P.E, Math.max(opts.minWindow ?? .3, 1 / (P.E + (n - 1) * (1 - ov))));   // one mark's share of p
    const step = n > 1 ? (1 - P.E * w) / (n - 1) : 0;
    P.units.forEach((u, i) => { u.c = (p - i * step) / w; u.run(u.c, put); });
    P.labels.forEach(l => { const q = ease((l.mark.unit.c - l.mark.at) / LD); if (q < 1) put(l.el, 'opacity', q <= 0 ? 0 : +q.toFixed(3)); });
    return svg;
  }

  Object.assign(AS, { t, ease, lin, span, stagger, reveal, countUp, fadeUp });
})(window);
