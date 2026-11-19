/* AppSec house-style charts. Plain SVG, no dependencies. Each call draws into `el` (element or selector)
   and returns the <svg>. Sizes are viewBox units; the SVG scales to its container width.
   Colour carries severity only; everything else is ink greys. See reference/style-guide.md. */
(function (g) {
  const NS = 'http://www.w3.org/2000/svg';
  // Every colour is a CSS variable from style.css, so a theme is set in one place (the :root tokens,
  // or AS.theme below) and charts follow it.
  const SEV = { critical: 'var(--crit)', high: 'var(--high)', medium: 'var(--med)', low: 'var(--low)' };
  const N = ['var(--n1)', 'var(--n2)', 'var(--n3)', 'var(--n4)', 'var(--n5)', 'var(--n6)'];
  const PAPER = 'var(--paper-2)', GRID = 'var(--line)', AXIS = 'var(--axis)';
  // Tones that are not severity. 'signal' is the one accent a non-severity piece may use, once.
  const TONE = { signal: 'var(--signal)', ink: N[0], mute: N[3], pale: N[5], paper: PAPER, ground: 'var(--paper)',
    n1: N[0], n2: N[1], n3: N[2], n4: N[3], n5: N[4], n6: N[5] };
  const col = c => SEV[c] || TONE[c] || c;

  function root(el, W, H) {
    if (typeof el === 'string') el = document.querySelector(el);
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.setAttribute('class', 'ch');
    el.appendChild(s); return s;
  }
  function n(p, tag, a = {}, txt) {
    const e = document.createElementNS(NS, tag);
    for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    p.appendChild(e); return e;
  }
  function ticks(max, count = 4) {
    const raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    const out = []; for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
    if (out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toFixed(6));
    return out;
  }
  // Rect with only the data end rounded (r=4), anchored to the baseline.
  function bar(p, x, y, w, h, fill, up = true, r = 4) {
    if (h <= 0) return;
    r = Math.min(r, h, w / 2);
    const d = up
      ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
      : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
    return n(p, 'path', { d, fill });
  }
  function gridY(s, L, R, y, tk, fmt = v => v) {
    tk.forEach(v => {
      n(s, 'line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: GRID });
      n(s, 'text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'ax' }, fmt(v));
    });
  }

  /* Stacked or single vertical bars.
     cats: ['Q2','Q3']; series: [{name:'Low', color:'low', values:[..]}...] bottom-up.
     opts: segLabels (pct label right of last bar), totals (value above), yLabel. */
  function bars(el, o) {
    const W = o.W || 1000, H = o.H || 360, L = 56, R = W - (o.segLabels ? 110 : 20), T = 26, B = H - 40;
    const s = root(el, W, H), k = o.cats.length;
    const tot = o.cats.map((_, i) => o.series.reduce((a, se) => a + (se.values[i] || 0), 0));
    const tk = ticks(o.max || Math.max(...tot)), max = tk[tk.length - 1];
    const y = v => B - (v / max) * (B - T);
    if (!o.noGrid) gridY(s, L, R, y, tk);
    const slot = (R - L) / k, bw = Math.min(o.barW || slot * 0.62, 170);
    o.cats.forEach((c, i) => {
      const x = L + slot * i + (slot - bw) / 2; let acc = 0;
      const live = o.series.map((se, j) => [se, j]).filter(([se]) => (se.values[i] || 0) > 0);
      live.forEach(([se], idx) => {
        const v = se.values[i], y0 = y(acc + v), h = y(acc) - y0, top = idx === live.length - 1;
        if (top) bar(s, x, y0, bw, h, col(se.color)); else n(s, 'rect', { x, y: y0, width: bw, height: h, fill: col(se.color) });
        if (acc > 0) n(s, 'line', { x1: x, x2: x + bw, y1: y(acc), y2: y(acc), stroke: PAPER, 'stroke-width': 2 });
        if (o.segLabels && i === k - 1 && h > 14)
          n(s, 'text', { x: x + bw + 10, y: y0 + h / 2 + 4, class: 'val' }, `${se.name} ${Math.round(v / tot[i] * 100)}%`);
        acc += v;
      });
      if (o.totals !== false) n(s, 'text', { x: x + bw / 2, y: y(tot[i]) - 8, 'text-anchor': 'middle', class: 'val' }, tot[i]);
      n(s, 'text', { x: x + bw / 2, y: B + 22, 'text-anchor': 'middle', class: 'ax' }, c);
    });
    n(s, 'line', { x1: L, x2: R, y1: B, y2: B, stroke: AXIS });
    if (o.xLabel) n(s, 'text', { x: (L + R) / 2, y: H - 2, 'text-anchor': 'middle', class: 'axl' }, o.xLabel);
    return s;
  }

  /* Opened up / fixed down per period. up/down: arrays; notes: {index:'Sweep'} under the down bar. */
  function diverging(el, o) {
    const W = o.W || 1100, H = o.H || 360, L = 50, R = W - 20, T = 40, B = H - 64;
    const s = root(el, W, H), k = o.cats.length;
    const mu = Math.max(...o.up, 1), md = Math.max(...o.down, 1), tk = ticks(Math.max(mu, md), 2);
    const zero = T + (B - T) * (mu / (mu + md));  // one unit is the same height above and below
    const yu = v => zero - v * (zero - T) / mu, yd = v => zero + v * (B - zero) / md;
    tk.slice(1).forEach(v => {
      if (v <= mu) { n(s, 'line', { x1: L, x2: R, y1: yu(v), y2: yu(v), stroke: GRID }); n(s, 'text', { x: L - 10, y: yu(v) + 4, 'text-anchor': 'end', class: 'ax' }, v); }
      if (v <= md) { n(s, 'line', { x1: L, x2: R, y1: yd(v), y2: yd(v), stroke: GRID }); n(s, 'text', { x: L - 10, y: yd(v) + 4, 'text-anchor': 'end', class: 'ax' }, v); }
    });
    const slot = (R - L) / k, bw = slot * 0.56;
    o.cats.forEach((c, i) => {
      const x = L + slot * i + (slot - bw) / 2, u = o.up[i] || 0, d = o.down[i] || 0;
      if (u) { bar(s, x, yu(u), bw, zero - yu(u), o.upColor || N[0], true); n(s, 'text', { x: x + bw / 2, y: yu(u) - 8, 'text-anchor': 'middle', class: 'val' }, u); }
      if (d) { bar(s, x, zero, bw, yd(d) - zero, o.downColor || N[3], false); n(s, 'text', { x: x + bw / 2, y: yd(d) + 15, 'text-anchor': 'middle', class: 'val' }, d); }
      if (o.notes && o.notes[i]) n(s, 'text', { x: x + bw / 2, y: yd(d) + 31, 'text-anchor': 'middle', class: 'axl', style: 'fill:var(--ink)' }, o.notes[i]);
      n(s, 'text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'ax' }, c);
    });
    n(s, 'line', { x1: L, x2: R, y1: zero, y2: zero, stroke: AXIS });
    n(s, 'text', { x: 0, y: T - 18, class: 'axl' }, (o.upLabel || 'Opened') + ' ↑');
    n(s, 'text', { x: 0, y: B + 16, class: 'axl' }, (o.downLabel || 'Fixed') + ' ↓');
    return s;
  }

  /* Lines with dots and end labels. x: labels; series: [{name, values, color, dash:'dash'|'dot'}].
     Black lines told apart by dash, or severity colours. */
  function lines(el, o) {
    const W = o.W || 1000, H = o.H || 340, L = 60, R = W - (o.endW || 190), T = 20, B = H - 36;
    const s = root(el, W, H), k = o.x.length;
    const all = o.series.flatMap(se => se.values).filter(v => v != null);
    const tk = ticks(o.max || Math.max(...all)), max = tk[tk.length - 1];
    const y = v => B - (v / max) * (B - T), x = i => k === 1 ? (L + R) / 2 : L + (R - L) * i / (k - 1);
    if (o.grid !== false) gridY(s, L, R, y, tk, o.fmt);
    o.x.forEach((c, i) => {
      if (o.verticals) n(s, 'line', { x1: x(i), x2: x(i), y1: T, y2: B, stroke: GRID });
      n(s, 'text', { x: x(i), y: B + 22, 'text-anchor': 'middle', class: 'ax' }, c);
    });
    const dash = { dash: '7 5', dot: '2 4' };
    o.series.forEach(se => {
      const pts = se.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
      n(s, 'path', { d: 'M' + pts.map(p => p.join(',')).join('L'), fill: 'none', stroke: col(se.color || N[0]), 'stroke-width': 2, 'stroke-dasharray': dash[se.dash], 'stroke-linecap': 'round' });
      if (o.dots !== false) pts.forEach(([px, py]) => n(s, 'circle', { cx: px, cy: py, r: 4.5, fill: col(se.color || N[0]), stroke: PAPER, 'stroke-width': 2 }));
      const [lx, ly] = pts[pts.length - 1];
      n(s, 'text', { x: lx + 12, y: ly + 4 + (se.nudge || 0), class: 'lab' }, se.label || `${se.values[se.values.length - 1]} ${se.name}`);
    });
    return s;
  }

  /* Ranked horizontal bars. rows: [{label, value, segs:[{v, color}]?, note}] sorted by caller. */
  function hbars(el, o) {
    const rh = o.rowH || 34, W = o.W || 1000, LW = o.labelW || 220, R = W - 70;
    const H = o.rows.length * rh + 10, s = root(el, W, H);
    const max = o.max || Math.max(...o.rows.map(r => r.value));
    const x = v => LW + (v / max) * (R - LW);
    o.rows.forEach((r, i) => {
      const cy = 6 + i * rh + rh / 2, bh = Math.min(14, rh * .45);
      n(s, 'text', { x: LW - 14, y: cy + 4.5, 'text-anchor': 'end', class: 'lab' }, r.label);
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: R - LW, height: bh, rx: bh / 2, fill: 'var(--line)' });
      let acc = 0;
      (r.segs || [{ v: r.value, color: o.color || N[0] }]).forEach((sg, j, arr) => {
        const w = x(acc + sg.v) - x(acc);
        n(s, 'rect', { x: x(acc) + (j ? 1 : 0), y: cy - bh / 2, width: Math.max(0, w - (j ? 1 : 0)), height: bh, rx: (j === 0 || j === arr.length - 1) ? bh / 2 : 0, fill: col(sg.color) });
        acc += sg.v;
      });
      n(s, 'text', { x: R + 12, y: cy + 4.5, class: 'lab' }, r.display || r.value);
    });
    return s;
  }

  /* One dot per item, packed in a cluster per group (phyllotaxis).
     groups: [{label, items:[{sev:'high', fixed:false}]}]. Filled = open, ring = fixed. */
  function dots(el, o) {
    const W = o.W || 1200, H = o.H || 260, r = o.r || 4.2, gap = r * 2.5;
    const s = root(el, W, H), k = o.groups.length, slot = W / k, cy = (H - 44) / 2 + 6;
    o.groups.forEach((gr, gi) => {
      const cx = slot * gi + slot / 2;
      // severe first in the middle, fixed rings outside
      const items = gr.items.slice().sort((a, b) => (a.fixed - b.fixed) || (['critical', 'high', 'medium', 'low'].indexOf(a.sev) - ['critical', 'high', 'medium', 'low'].indexOf(b.sev)));
      items.forEach((it, i) => {
        const a = i * 2.39996, d = gap * 0.55 * Math.sqrt(i + .5);
        const px = cx + d * Math.cos(a), py = cy + d * Math.sin(a), c = col(it.sev || it.color || N[0]);
        if (it.fixed) n(s, 'circle', { cx: px, cy: py, r: r - .7, fill: 'none', stroke: c, 'stroke-width': 1.4 });
        else n(s, 'circle', { cx: px, cy: py, r, fill: c });
      });
      n(s, 'text', { x: cx, y: H - 22, 'text-anchor': 'middle', class: 'lab' }, gr.label);
      n(s, 'text', { x: cx, y: H - 5, 'text-anchor': 'middle', class: 'sml' }, gr.items.length);
    });
    return s;
  }

  /* Flow (sankey). nodes: {left:[{id,label}], right:[{id,label,color}]}; links: [{s,t,v,dark}]
     dark:true draws the ribbon in ink (the part that matters), else light. */
  function flow(el, o) {
    const W = o.W || 1100, H = o.H || 440, L = o.labelW || 200, R = W - (o.rightW || 230), NW = 14, G = o.gap || 12;
    const s = root(el, W, H);
    const sum = (ids, key) => ids.map(id => o.links.filter(l => l[key] === id).reduce((a, l) => a + l.v, 0));
    const lv = sum(o.nodes.left.map(d => d.id), 's'), rv = sum(o.nodes.right.map(d => d.id), 't');
    const total = Math.max(lv.reduce((a, b) => a + b, 0), rv.reduce((a, b) => a + b, 0));
    const sc = Math.min((H - G * (o.nodes.left.length - 1)) / total, (H - G * (o.nodes.right.length - 1)) / total);
    const place = (arr, vals) => { let y = 0; return arr.map((d, i) => { const h = Math.max(vals[i] * sc, 2), r = { ...d, y, h, v: vals[i], off: 0 }; y += h + G; return r; }); };
    const Ls = place(o.nodes.left, lv), Rs = place(o.nodes.right, rv);
    const byId = (a, id) => a.find(d => d.id === id), m = (L + NW + R) / 2;
    o.links.forEach(l => {
      const a = byId(Ls, l.s), b = byId(Rs, l.t), h = l.v * sc;
      const y0 = a.y + a.off, y1 = b.y + b.off; a.off += h; b.off += h;
      n(s, 'path', {
        d: `M${L + NW},${y0}C${m},${y0} ${m},${y1} ${R},${y1}V${y1 + h}C${m},${y1 + h} ${m},${y0 + h} ${L + NW},${y0 + h}Z`,
        fill: l.color ? col(l.color) : (l.dark ? N[1] : N[5]), 'fill-opacity': l.color ? .35 : (l.dark ? .95 : 1)
      });
    });
    Ls.forEach(d => {
      n(s, 'rect', { x: L, y: d.y, width: NW, height: d.h, rx: 2, fill: N[0] });
      const t = n(s, 'text', { x: L - 12, y: d.y + d.h / 2 + 4.5, 'text-anchor': 'end', class: 'lab' }, d.label + ' ');
      n(t, 'tspan', { class: 'sml' }, d.v);
    });
    Rs.forEach(d => {
      n(s, 'rect', { x: R, y: d.y, width: NW, height: d.h, rx: 2, fill: col(d.color || N[0]) });
      const t = n(s, 'text', { x: R + NW + 12, y: d.y + d.h / 2 + 4.5, class: 'lab' }, d.label + ' ');
      n(t, 'tspan', { class: 'sml' }, d.v);
    });
    return s;
  }

  /* Grey heat grid. rows/cols labels, values[r][c]. Darker is more; blank cells stay outlined. */
  function heat(el, o) {
    const cw = o.cellW || 130, ch = o.cellH || 36, LW = o.labelW || 170, T = 46;
    const W = LW + o.cols.length * (cw + 6), H = T + o.rows.length * (ch + 6), s = root(el, W, H);
    const max = Math.max(...o.values.flat());
    o.cols.forEach((c, j) => n(s, 'text', { x: LW + j * (cw + 6) + cw / 2, y: T - 16, 'text-anchor': 'middle', class: 'lab' }, c));
    o.rows.forEach((r, i) => {
      const y = T + i * (ch + 6);
      n(s, 'text', { x: LW - 16, y: y + ch / 2 + 4.5, 'text-anchor': 'end', class: 'lab' }, r);
      o.cols.forEach((_, j) => {
        const v = o.values[i][j], x = LW + j * (cw + 6);
        if (!v) { n(s, 'rect', { x, y, width: cw, height: ch, rx: 7, fill: 'none', stroke: GRID }); return; }
        const t = Math.sqrt(v / max), l = Math.round(214 - t * 186);
        n(s, 'rect', { x, y, width: cw, height: ch, rx: 7, fill: `rgb(${l},${l - 4},${l - 9})` });
        n(s, 'text', { x: x + cw / 2, y: y + ch / 2 + 4.5, 'text-anchor': 'middle', class: t > .45 ? 'inv' : 'lab', style: 'font-weight:500' }, v);
      });
    });
    return s;
  }

  /* Strip of dots on a (log) axis; equal values stack upward.
     values: numbers; ticks: [{v, label}]; median: {v, label}; color: severity or hex. */
  function strip(el, o) {
    const W = o.W || 1100, H = o.H || 200, L = 30, R = W - 30, B = H - 40, r = o.r || 5.5;
    const s = root(el, W, H), lo = o.min ?? Math.min(...o.values), hi = o.max ?? Math.max(...o.values);
    const f = o.log ? Math.log10 : v => v, x = v => L + (f(v) - f(lo)) / (f(hi) - f(lo)) * (R - L);
    (o.ticks || []).forEach(t => {
      n(s, 'line', { x1: x(t.v), x2: x(t.v), y1: 20, y2: B, stroke: GRID });
      n(s, 'text', { x: x(t.v), y: B + 26, 'text-anchor': 'middle', class: 'ax' }, t.label);
    });
    const placed = [];
    o.values.slice().sort((a, b) => a - b).forEach(v => {
      const px = x(v); let lvl = 0;
      while (placed.some(p => Math.abs(p[0] - px) < r * 2.1 && p[1] === lvl)) lvl++;
      placed.push([px, lvl]);
      n(s, 'circle', { cx: px, cy: B - 12 - lvl * r * 2.4, r, fill: col(o.color || 'high') });
    });
    if (o.median) {
      n(s, 'line', { x1: x(o.median.v), x2: x(o.median.v), y1: 10, y2: B, stroke: N[0], 'stroke-dasharray': '3 3' });
      n(s, 'text', { x: x(o.median.v) - 8, y: 16, 'text-anchor': 'end', class: 'axl', style: 'fill:var(--ink);font-weight:500' }, o.median.label);
    }
    return s;
  }

  /* Thin leader + annotation, the way the PDF calls out one mark. from/to: [x,y] in the svg's units. */
  function annotate(svg, from, to, text, anchor = 'end') {
    const [x0, y0] = from, [x1, y1] = to;
    n(svg, 'path', { d: `M${x0},${y0}C${(x0 + x1) / 2},${y0} ${x1},${(y0 + y1) / 2} ${x1},${y1}`, fill: 'none', stroke: N[0], 'stroke-width': 1 });
    n(svg, 'text', { x: x0 + (anchor === 'end' ? -6 : 6), y: y0 + 5, 'text-anchor': anchor, class: 'ann' }, text);
  }


  /* ===================== v2: dashboard and comparison charts ===================== */
  const fmtK = v => Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? +(v / 1e3).toFixed(1) + 'K' : '' + v;

  // Shared hover layer: any mark with data-tip='{"h":"Sep 2","rows":[["High","#722f37",12]]}' gets a tooltip.
  // Live HTML only; print and PNG show the static chart.
  function hover(svg) {
    const host = svg.parentNode; if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    let tip = host.querySelector(':scope > .tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.style.opacity = 0; host.appendChild(tip); }
    const show = (e, d) => {
      tip.innerHTML = (d.h ? `<div class="th">${d.h}</div>` : '') + d.rows.map(r => `<div class="tr"><i style="background:${col(r[1])}"></i>${r[0]}<b>${r[2]}</b></div>`).join('');
      const hb = host.getBoundingClientRect(); let x = e.clientX - hb.left + 14, y = e.clientY - hb.top + 14;
      if (x + 190 > hb.width) x -= 210; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1; tip.classList.add('show');
    };
    svg.addEventListener('mousemove', e => { const m = e.target.closest('[data-tip]'); if (m) show(e, JSON.parse(m.dataset.tip)); else tip.classList.remove('show'); });
    svg.addEventListener('mouseleave', () => tip.classList.remove('show'));
  }

  /* Minimal time series (the dashboard default). One neutral series = ink line + faint fill.
     Group by severity = pass series with color:'high' etc; stack:true stacks them as areas.
     Axis: horizontal grid only, 2-3 ticks, x labels at the two ends only. Crosshair tooltip on hover.
     o: {x:[labels], series:[{name, values, color}], stack, ticks:3, fmt, endLabels:true, mark:{i, label}} */
  function area(el, o) {
    const W = o.W || 1100, H = o.H || 300, L = 44, R = W - (o.endW || 8), T = 12, B = H - 28;
    const s = root(el, W, H), k = o.x.length, fmt = o.fmt || fmtK;
    const ser = o.series.map(se => ({ ...se, c: col(se.color || N[0]) }));
    const cum = ser.map((_, j) => o.x.map((_, i) => ser.slice(0, j + 1).reduce((a, se) => a + (o.stack ? (se.values[i] || 0) : 0), 0)));
    const top = o.stack ? Math.max(...cum[cum.length - 1]) : Math.max(...ser.flatMap(se => se.values));
    const tk = ticks(o.max || top, o.ticks || 2), max = tk[tk.length - 1];
    const y = v => B - (v / max) * (B - T), x = i => L + (R - L) * i / (k - 1);
    tk.forEach(v => { n(s, 'line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: GRID }); n(s, 'text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'ax' }, fmt(v)); });
    const path = pts => 'M' + pts.map(p => p.map(q => +q.toFixed(1)).join(',')).join('L');
    ser.forEach((se, j) => {
      const hi = o.x.map((_, i) => [x(i), y(o.stack ? cum[j][i] : se.values[i])]);
      const lo = o.stack && j ? o.x.map((_, i) => [x(i), y(cum[j - 1][i])]).reverse() : [[R, B], [L, B]];
      if (o.stack || ser.length === 1) n(s, 'path', { d: path(hi.concat(lo)) + 'Z', fill: se.c, 'fill-opacity': o.stack ? (se.color ? .85 : .9) : .07 });
      if (!o.stack) n(s, 'path', { d: path(hi), fill: 'none', stroke: se.c, 'stroke-width': ser.length === 1 ? 1.8 : 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      if (o.stack && j) n(s, 'path', { d: path(lo.slice().reverse()), fill: 'none', stroke: PAPER, 'stroke-width': 1.5 });
      if (o.endLabels !== false && ser.length > 1 && !o.stack) { const v = se.values[k - 1]; n(s, 'circle', { cx: x(k - 1), cy: y(v), r: 3.5, fill: se.c, stroke: PAPER, 'stroke-width': 1.5 }); }
    });
    n(s, 'text', { x: L, y: H - 6, class: 'ax' }, o.x[0]);
    n(s, 'text', { x: R, y: H - 6, 'text-anchor': 'end', class: 'ax' }, o.x[k - 1]);
    if (o.mark) { const i = o.mark.i, v = o.stack ? cum[cum.length - 1][i] : ser[0].values[i];
      n(s, 'line', { x1: x(i), x2: x(i), y1: T, y2: B, stroke: N[0], 'stroke-dasharray': '3 3', 'stroke-width': 1 });
      if (o.mark.label) n(s, 'text', { x: x(i) + 6, y: T + 10, class: 'axl', style: 'fill:var(--ink);font-weight:500' }, o.mark.label);
      n(s, 'circle', { cx: x(i), cy: y(v), r: 4.5, fill: N[0], stroke: PAPER, 'stroke-width': 2 }); }
    // hover columns
    const cw = (R - L) / (k - 1), cross = n(s, 'line', { x1: 0, x2: 0, y1: T, y2: B, stroke: N[3], opacity: 0 });
    o.x.forEach((lab, i) => {
      const rows = ser.slice().reverse().map(se => [se.name, se.c, fmt(se.values[i])]);
      if (o.stack) rows.unshift(['Total', N[0], fmt(cum[cum.length - 1][i])]);
      const r = n(s, 'rect', { x: x(i) - cw / 2, y: T, width: cw, height: B - T, fill: 'transparent', 'data-tip': JSON.stringify({ h: lab, rows }) });
      r.addEventListener('mouseenter', () => { cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 1); });
    });
    s.addEventListener('mouseleave', () => cross.setAttribute('opacity', 0));
    hover(s); return s;
  }

  /* Comparison bars: one coloured bar carries the claim, every other bar is pale neutral.
     Value chips above bars, dotted grid only at labelled values, no axis line, never truncated.
     o: {cats, values, hi: index or [indexes], color:'high', unit:'', fmt} */
  function compare(el, o) {
    const W = o.W || 900, H = o.H || 320, L = 40, R = W - 10, T = 34, B = H - 30;
    const s = root(el, W, H), k = o.cats.length, fmt = o.fmt || (v => v + (o.unit || ''));
    const his = [].concat(o.hi ?? k - 1), tk = ticks(o.max || Math.max(...o.values), o.ticks || 3), max = tk[tk.length - 1];
    const y = v => B - (v / max) * (B - T);
    tk.forEach(v => { if (v) n(s, 'line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: 'var(--line-2)', 'stroke-dasharray': '1 4', 'stroke-linecap': 'round' });
      n(s, 'text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'ax' }, fmt(v)); });
    const slot = (R - L) / k, bw = Math.min(o.barW || slot * .34, 64);
    o.cats.forEach((c, i) => {
      const on = his.includes(i), v = o.values[i], cx = L + slot * i + slot / 2;
      const bm = bar(s, cx - bw / 2, y(v), bw, B - y(v), on ? col(o.color || N[0]) : N[5], true, Math.min(bw / 2, 10)); if (bm) bm.setAttribute('data-tip', JSON.stringify({ h: c, rows: [[o.name || 'Value', on ? (o.color || N[0]) : N[4], fmt(v)]] }));
      const t = fmt(v), tw = t.length * 7 + 16;
      n(s, 'rect', { x: cx - tw / 2, y: y(v) - 30, width: tw, height: 21, rx: 10.5, fill: PAPER, stroke: on ? N[0] : N[3], 'stroke-width': on ? 1.2 : 1 });
      n(s, 'text', { x: cx, y: y(v) - 15.5, 'text-anchor': 'middle', class: 'val', style: on ? 'fill:var(--ink);font-weight:500' : '' }, t);
      n(s, 'text', { x: cx, y: B + 20, 'text-anchor': 'middle', class: on ? 'lab' : 'ax', style: on ? 'font-size:12px' : '' }, c);
    });
    hover(s); return s;
  }

  /* Share of a whole: pill bar on a full-width track, dotted leader, big number right.
     rows: [{label, value, of, color, display}] */
  function track(el, o) {
    const W = o.W || 900, rh = o.rowH || 54, LW = o.labelW || 170, NW = o.numW || 110, R = W - NW;
    const H = o.rows.length * rh, s = root(el, W, H), bh = o.barH || 14;
    o.rows.forEach((r, i) => {
      const cy = i * rh + rh / 2, of = r.of || o.of || 100, w = (R - LW - 24) * Math.min(1, r.value / of);
      n(s, 'text', { x: 0, y: cy + 4.5, class: 'lab', style: 'font-weight:500' }, r.label);
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: R - LW - 24, height: bh, rx: bh / 2, fill: N[5], 'fill-opacity': .55 });
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: Math.max(w, bh), height: bh, rx: bh / 2, fill: col(r.color || N[0]), 'data-tip': JSON.stringify({ h: r.label, rows: [[r.label, r.color || N[0], r.display || `${r.value} of ${of}`]] }) });
      n(s, 'line', { x1: R - 14, x2: R + 4, y1: cy, y2: cy, stroke: N[3], 'stroke-dasharray': '1 4', 'stroke-linecap': 'round' });
      n(s, 'text', { x: W, y: cy + 9, 'text-anchor': 'end', style: `font:600 ${o.numSize || 26}px var(--f-sans);letter-spacing:-.03em;fill:var(--ink)` }, r.display || Math.round(r.value / of * 100) + '%');
    });
    hover(s); return s;
  }

  /* Small multiples: one tiny line per panel, y labels only min and max, dot on the latest value,
     optional dashed event line. panels: [{label, values, color}]; o.cols, o.event {i, label} */
  function multiples(el, o) {
    const cols = o.cols || 4, pw = o.pw || 220, ph = o.ph || 96, gx = 26, gy = 30;
    const rows = Math.ceil(o.panels.length / cols), W = cols * pw + (cols - 1) * gx, H = rows * (ph + 30) + (rows - 1) * (gy - 30) + 4;
    const s = root(el, W, H), shared = o.shared ? Math.max(...o.panels.flatMap(p => p.values)) : null;
    o.panels.forEach((p, j) => {
      const ox = (j % cols) * (pw + gx), oy = Math.floor(j / cols) * (ph + gy), k = p.values.length;
      const mx = shared ?? Math.max(...p.values), mn = o.zero === false ? Math.min(...p.values) : 0;
      const x = i => ox + 30 + (pw - 40) * i / (k - 1), y = v => oy + 22 + (ph - 26) * (1 - (v - mn) / ((mx - mn) || 1));
      n(s, 'text', { x: ox, y: oy + 10, class: 'lab', style: 'font-size:12.5px' }, p.label);
      n(s, 'line', { x1: ox + 30, x2: ox + pw - 10, y1: y(mn), y2: y(mn), stroke: GRID });
      n(s, 'text', { x: ox + 24, y: y(mx) + 4, 'text-anchor': 'end', class: 'ax', style: 'font-size:9.5px' }, fmtK(mx));
      n(s, 'text', { x: ox + 24, y: y(mn) + 3, 'text-anchor': 'end', class: 'ax', style: 'font-size:9.5px' }, fmtK(mn));
      if (o.event) n(s, 'line', { x1: x(o.event.i), x2: x(o.event.i), y1: oy + 18, y2: y(mn), stroke: N[3], 'stroke-dasharray': '3 3' });
      const c = col(p.color || N[0]);
      n(s, 'path', { d: 'M' + p.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L'), fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
      n(s, 'circle', { cx: x(k - 1), cy: y(p.values[k - 1]), r: 3.4, fill: c, stroke: PAPER, 'stroke-width': 1.5 });
      n(s, 'text', { x: ox + pw, y: oy + 10, 'text-anchor': 'end', class: 'val', style: 'fill:var(--ink);font-weight:500' }, p.display ?? p.values[k - 1]);
    });
    if (o.event && o.event.label) n(s, 'text', { x: W, y: H - 2, 'text-anchor': 'end', class: 'sml' }, '┆ ' + o.event.label);
    return s;
  }

  /* Wire a .kpis strip to one plot: each <button data-k="key"> swaps the chart drawn by draw[key](el).
     The button with .on is drawn first; that is what print and PNG show. */
  function kpiSelect(strip, plot, draw) {
    if (typeof strip === 'string') strip = document.querySelector(strip);
    if (typeof plot === 'string') plot = document.querySelector(plot);
    const go = b => { strip.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); plot.innerHTML = ''; draw[b.dataset.k](plot); };
    strip.querySelectorAll('button').forEach(b => b.addEventListener('click', () => go(b)));
    go(strip.querySelector('button.on') || strip.querySelector('button'));
  }

  /* Severity bar stacked horizontally in one row (a mini severity mix for a table cell or tile).
     counts: {critical, high, medium, low} */
  function mix(el, counts, o = {}) {
    const W = o.W || 160, H = o.H || 8, s = root(el, W, H), keys = ['critical', 'high', 'medium', 'low'];
    const tot = keys.reduce((a, k) => a + (counts[k] || 0), 0) || 1; let x = 0;
    keys.forEach(k => { const w = (counts[k] || 0) / tot * W; if (!w) return;
      n(s, 'rect', { x: x + (x ? 1 : 0), y: 0, width: Math.max(0, w - (x ? 1 : 0)), height: H, fill: SEV[k] }); x += w; });
    s.style.borderRadius = H / 2 + 'px'; s.style.overflow = 'hidden'; return s;
  }

  /* ===================== v3: general design charts =====================
     Same rules as above: neutral marks, one mark carries the claim. That mark is ink by default; pass
     color:'signal' for the one signal-coloured mark in a piece that is not about severity. */
  const txt = (s, x, y, t, cls, a = {}) => n(s, 'text', { x, y, class: cls, ...a }, t);

  /* Ring: one share with the number in the middle, or a few segments.
     o: {value, of:100, color, label, sub, segs:[{v, color}], size, thick} */
  function donut(el, o) {
    const S = o.size || 220, th = o.thick || S * .11, r = (S - th) / 2, c = S / 2, s = root(el, S, S);
    const C = 2 * Math.PI * r, segs = o.segs || [{ v: o.value, color: o.color || N[0] }];
    const of = o.of || (o.segs ? segs.reduce((a, sg) => a + sg.v, 0) : 100), gap = segs.length > 1 ? 3 : 0;
    n(s, 'circle', { cx: c, cy: c, r, fill: 'none', stroke: N[5], 'stroke-width': th, 'stroke-opacity': .6 });
    let acc = 0;
    segs.forEach(sg => {
      const len = sg.v / of * C;
      n(s, 'circle', { cx: c, cy: c, r, fill: 'none', stroke: col(sg.color || N[0]), 'stroke-width': th, 'stroke-linecap': gap ? 'butt' : 'round',
        'stroke-dasharray': `${Math.max(0, len - gap)} ${C}`, 'stroke-dashoffset': -acc, transform: `rotate(-90 ${c} ${c})` });
      acc += len;
    });
    if (o.label != null) txt(s, c, c + (o.sub ? S * .03 : S * .075), o.label, null, { 'text-anchor': 'middle', style: `font:600 ${S * .22}px var(--f-sans);letter-spacing:-.04em;fill:var(--ink)` });
    if (o.sub) txt(s, c, c + S * .15, o.sub, 'axl', { 'text-anchor': 'middle' });
    return s;
  }

  /* Scatter or bubble. The hi points carry the claim; the rest are pale.
     o: {points:[{x, y, r, label, hi, color}], xLabel, yLabel, xMax, yMax, mid:{x, y}, quads:[tl, tr, bl, br]} */
  function scatter(el, o) {
    const W = o.W || 900, H = o.H || 440, L = 56, R = W - 24, T = o.yLabel ? 30 : 16, B = H - 46, s = root(el, W, H);
    const xt = ticks(o.xMax || Math.max(...o.points.map(p => p.x)), 4), yt = ticks(o.yMax || Math.max(...o.points.map(p => p.y)), 4);
    const xm = xt[xt.length - 1], ym = yt[yt.length - 1], x = v => L + v / xm * (R - L), y = v => B - v / ym * (B - T);
    const fx = o.xFmt || fmtK, fy = o.yFmt || fmtK;
    yt.forEach(v => { n(s, 'line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: GRID }); txt(s, L - 10, y(v) + 4, fy(v), 'ax', { 'text-anchor': 'end' }); });
    xt.forEach(v => txt(s, x(v), B + 18, fx(v), 'ax', { 'text-anchor': 'middle' }));
    if (o.xLabel) txt(s, R, H - 6, o.xLabel, 'axl', { 'text-anchor': 'end' });
    if (o.yLabel) txt(s, L, 12, o.yLabel, 'axl');
    if (o.mid) {
      const dash = { stroke: N[3], 'stroke-dasharray': '3 3' }, q = o.quads || [];
      n(s, 'line', { x1: x(o.mid.x), x2: x(o.mid.x), y1: T, y2: B, ...dash }); n(s, 'line', { x1: L, x2: R, y1: y(o.mid.y), y2: y(o.mid.y), ...dash });
      [[L + 8, T + 14, 'start'], [R - 8, T + 14, 'end'], [L + 8, B - 8, 'start'], [R - 8, B - 8, 'end']].forEach(([qx, qy, a], i) => q[i] && txt(s, qx, qy, q[i], 'sml', { 'text-anchor': a }));
    }
    o.points.slice().sort((a, b) => (a.hi ? 1 : 0) - (b.hi ? 1 : 0)).forEach(p => {
      const r = p.r || 5.5, c = p.hi ? col(p.color || o.color || N[0]) : N[3];
      n(s, 'circle', { cx: x(p.x), cy: y(p.y), r, fill: c, 'fill-opacity': p.hi ? .95 : .5, stroke: PAPER, 'stroke-width': 1.5,
        'data-tip': JSON.stringify({ h: p.label || '', rows: [[o.xLabel || 'x', c, fx(p.x)], [o.yLabel || 'y', c, fy(p.y)]] }) });
      if (p.label && (p.hi || o.labels)) { const right = x(p.x) + r + 8 + p.label.length * 7 < R;
        txt(s, x(p.x) + (right ? r + 7 : -r - 7), y(p.y) + 4.5, p.label, p.hi ? 'lab' : 'ax', { 'text-anchor': right ? 'start' : 'end' }); }
    });
    hover(s); return s;
  }

  /* Slope: two moments, one line per row. hi rows are ink (or their colour), the rest pale.
     o: {left:'2025', right:'2026', rows:[{label, a, b, hi, color}], fmt, min, max} */
  function slope(el, o) {
    const W = o.W || 640, H = o.H || 400, L = o.padL || 170, R = W - (o.padR || 90), T = 36, B = H - 14, s = root(el, W, H), fmt = o.fmt || (v => v);
    const vals = o.rows.flatMap(r => [r.a, r.b]), mn = o.min ?? Math.min(...vals), mx = o.max ?? Math.max(...vals), y = v => B - (v - mn) / ((mx - mn) || 1) * (B - T);
    txt(s, L, 12, o.left, 'axl', { 'text-anchor': 'middle' }); txt(s, R, 12, o.right, 'axl', { 'text-anchor': 'middle' });
    [L, R].forEach(gx => n(s, 'line', { x1: gx, x2: gx, y1: T - 12, y2: B + 8, stroke: GRID }));
    o.rows.slice().sort((a, b) => (a.hi ? 1 : 0) - (b.hi ? 1 : 0)).forEach(r => {
      const c = r.hi ? col(r.color || o.color || N[0]) : N[3];
      n(s, 'line', { x1: L, x2: R, y1: y(r.a), y2: y(r.b), stroke: c, 'stroke-width': r.hi ? 2.4 : 1.4, 'stroke-linecap': 'round' });
      [[L, r.a], [R, r.b]].forEach(([px, v]) => n(s, 'circle', { cx: px, cy: y(v), r: r.hi ? 4.5 : 3.2, fill: c, stroke: PAPER, 'stroke-width': 1.5 }));
      txt(s, L - 12, y(r.a) + 4.5 + (r.nudgeA || 0), `${r.label}  ${fmt(r.a)}`, r.hi ? 'lab' : 'ax', { 'text-anchor': 'end' });
      txt(s, R + 12, y(r.b) + 4.5 + (r.nudgeB || 0), fmt(r.b), r.hi ? 'lab' : 'ax');
    });
    return s;
  }

  /* Waterfall: how a start becomes an end. Totals are ink, rises mid grey, falls pale.
     o: {steps:[{label, value, total:true}], fmt, color (for the last total)} */
  function waterfall(el, o) {
    const W = o.W || 900, H = o.H || 340, L = 16, R = W - 16, T = 34, B = H - 30, s = root(el, W, H), k = o.steps.length, fmt = o.fmt || fmtK;
    let run = 0; const seg = o.steps.map(st => { const from = st.total ? 0 : run, to = st.total ? (st.value ?? run) : run + st.value; run = to; return { ...st, from, to }; });
    const max = ticks(o.max || Math.max(...seg.map(g => Math.max(g.from, g.to))), 3).pop(), y = v => B - v / max * (B - T);
    const slot = (R - L) / k, bw = Math.min(slot * .56, 84);
    n(s, 'line', { x1: L, x2: R, y1: B, y2: B, stroke: AXIS });
    seg.forEach((g2, i) => {
      const cx = L + slot * i + slot / 2, top = Math.max(g2.from, g2.to), bot = Math.min(g2.from, g2.to), up = g2.to >= g2.from;
      const last = g2.total && i === k - 1, fill = g2.total ? (last && o.color ? col(o.color) : N[0]) : up ? N[2] : N[4];
      if (g2.total) bar(s, cx - bw / 2, y(top), bw, y(bot) - y(top), fill, true, 6);
      else n(s, 'rect', { x: cx - bw / 2, y: y(top), width: bw, height: Math.max(2, y(bot) - y(top)), rx: 4, fill });
      if (i < k - 1) n(s, 'line', { x1: cx + bw / 2, x2: cx + slot - bw / 2, y1: y(g2.to), y2: y(g2.to), stroke: N[3], 'stroke-dasharray': '1 4', 'stroke-linecap': 'round' });
      txt(s, cx, y(top) - 9, (g2.total ? '' : up ? '+' : '−') + fmt(Math.abs(g2.total ? g2.to : g2.value)), 'val', { 'text-anchor': 'middle', style: g2.total ? 'fill:var(--ink);font-weight:500' : '' });
      txt(s, cx, B + 20, g2.label, g2.total ? 'lab' : 'ax', { 'text-anchor': 'middle', style: g2.total ? 'font-size:12px' : '' });
    });
    return s;
  }

  /* Funnel: left-aligned pills on a pale track, value at the bar end, share of the previous step right.
     o: {steps:[{label, value}], hi:index (default last), color, fmt} */
  function funnel(el, o) {
    const W = o.W || 900, rh = o.rowH || 50, LW = o.labelW || 190, NW = 96, R = W - NW, bh = o.barH || 22, k = o.steps.length;
    const s = root(el, W, k * rh), fmt = o.fmt || fmtK, top = o.steps[0].value, hi = o.hi ?? k - 1;
    o.steps.forEach((st, i) => {
      const cy = i * rh + rh / 2, w = Math.max(bh, (R - LW) * st.value / top), on = i === hi;
      txt(s, 0, cy + 4.5, st.label, 'lab', { style: 'font-weight:' + (on ? 600 : 500) });
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: R - LW, height: bh, rx: 7, fill: N[5], 'fill-opacity': .45 });
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: w, height: bh, rx: 7, fill: on ? col(o.color || N[0]) : N[3] });
      const inside = w > 70;
      txt(s, inside ? LW + w - 10 : LW + w + 10, cy + 4, fmt(st.value), 'val', { 'text-anchor': inside ? 'end' : 'start', style: `font-weight:500;fill:${inside && on ? PAPER : 'var(--ink)'}` });
      txt(s, W, cy + 4, i ? Math.round(st.value / o.steps[i - 1].value * 100) + '% of prev' : 'start', 'sml', { 'text-anchor': 'end' });
    });
    return s;
  }

  /* Segment meter: a level as lit cells, like a hardware level strip. The last lit cell takes the colour.
     o: {rows:[{label, value, of:100, display}], cells:24, color, labelW, rowH} */
  function meter(el, o) {
    const W = o.W || 700, rh = o.rowH || 40, LW = o.labelW ?? 150, NW = o.numW || 70, R = W - NW, cells = o.cells || 24, g2 = o.gap || 3;
    const s = root(el, W, o.rows.length * rh), ch = o.cellH || 16, cw = (R - LW - g2 * (cells - 1)) / cells;
    o.rows.forEach((r, i) => {
      const cy = i * rh + rh / 2, lit = Math.round(Math.min(1, r.value / (r.of || o.of || 100)) * cells);
      if (LW) txt(s, 0, cy + 4.5, r.label, 'lab', { style: 'font-weight:500' });
      for (let c = 0; c < cells; c++) n(s, 'rect', { x: LW + c * (cw + g2), y: cy - ch / 2, width: cw, height: ch, rx: Math.min(2, cw / 3),
        fill: c < lit ? (c === lit - 1 && (r.color || o.color) ? col(r.color || o.color) : N[0]) : N[5], 'fill-opacity': c < lit ? 1 : .7 });
      txt(s, W, cy + 4, r.display ?? r.value, 'val', { 'text-anchor': 'end', style: 'fill:var(--ink);font-weight:500;font-size:12px' });
    });
    return s;
  }

  /* Dot-matrix readout: text set in a 5 x 7 dot grid. For one hero number or a short code.
     AS.matrix(el, '98.2%', {dot: 10, gap: 4, color: 'signal', off: true}); off draws the unlit dots. */
  const GLYPH = {}; ('0:0e11131519110e|1:040c040404040e|2:0e11010204081f|3:1e01010e01011e|4:02060a121f0202|5:1f101e0101110e|6:0608101e11110e|7:1f010204080808|' +
    '8:0e11110e11110e|9:0e11110f01020c|A:0e11111f111111|B:1e11111e11111e|C:0e11101010110e|D:1c12111111121c|E:1f10101e10101f|F:1f10101e101010|G:0e11101711110f|' +
    'H:1111111f111111|I:0e04040404040e|J:0702020202120c|K:11121418141211|L:1010101010101f|M:111b1515111111|N:11191513111111|O:0e11111111110e|P:1e11111e101010|' +
    'Q:0e11111115120d|R:1e11111e141211|S:0f10100e01011e|T:1f040404040404|U:1111111111110e|V:11111111110a04|W:11111115151b11|X:11110a040a1111|Y:11110a04040404|' +
    'Z:1f01020408101f|.:00000000000c0c|,:000000000c0408|::000c0c000c0c00|-:0000001f000000|+:0004041f040400|%:18190204081303|/:01010204081010|\u00d7:0000110a040a11|' +
    '$:040f140e051e04|\u2191:040e1504040404|\u2193:04040404150e04|=:00001f001f0000|#:0a0a1f0a1f0a0a').split('|').forEach(t => {
    GLYPH[t[0]] = t.slice(2).match(/../g).map(h => parseInt(h, 16)); });
  function matrix(el, text, o = {}) {
    const d = o.dot || 8, g2 = o.gap ?? d * .45, p = d + g2, chars = ('' + text).replace(/(\d)x/g, '$1\u00d7').toUpperCase().split('');
    const narrow = c => '.,:'.includes(c), cw = c => (c === ' ' ? 3 : narrow(c) ? 3 : 5) * p + p * (o.off ? 1.8 : 1);
    const W = chars.reduce((a, c) => a + cw(c), 0) - p * (o.off ? 1.8 : 1) + g2 * 0 - g2, H = 7 * p - g2, s = root(el, W, H), fill = col(o.color || N[0]);
    let ox = 0;
    chars.forEach(c => {
      const rows = GLYPH[c], nar = narrow(c), cols = c === ' ' || nar ? 3 : 5;
      if (rows || o.off) for (let ry = 0; ry < 7; ry++) for (let cx = 0; cx < cols; cx++) {
        const bit = rows ? (rows[ry] >> (nar ? 3 - cx : 4 - cx)) & 1 : 0;
        if (bit || (o.off && c !== ' ')) n(s, 'circle', { cx: ox + cx * p + d / 2, cy: ry * p + d / 2, r: d / 2, fill: bit ? fill : N[5], 'fill-opacity': bit ? 1 : .6 });
      }
      ox += cw(c);
    });
    s.style.width = o.fit ? '100%' : W + 'px'; return s;
  }

  /* Sparkline for a table cell or a tile. AS.spark(el, [..], {W, H, color, fill, dot}) */
  function spark(el, values, o = {}) {
    const W = o.W || 120, H = o.H || 28, s = root(el, W, H), k = values.length, mn = o.zero ? 0 : Math.min(...values), mx = Math.max(...values);
    const x = i => 3 + (W - 8) * i / (k - 1), y = v => H - 4 - (H - 8) * (v - mn) / ((mx - mn) || 1), c = col(o.color || N[0]);
    const d = 'M' + values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L');
    if (o.fill) n(s, 'path', { d: d + `L${x(k - 1)},${H}L${x(0)},${H}Z`, fill: c, 'fill-opacity': .08 });
    n(s, 'path', { d, fill: 'none', stroke: o.dot === 'only' ? N[3] : c, 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    if (o.dot !== false) n(s, 'circle', { cx: x(k - 1), cy: y(values[k - 1]), r: 2.8, fill: col(o.dotColor || o.color || N[0]), stroke: PAPER, 'stroke-width': 1.2 });
    s.style.width = W + 'px'; return s;
  }

  /* Bullet rows: value on a pale track with a target tick. rows:[{label, value, target, of, display, color}] */
  function bullet(el, o) {
    const W = o.W || 800, rh = o.rowH || 46, LW = o.labelW || 180, NW = o.numW || 80, R = W - NW, bh = o.barH || 12, s = root(el, W, o.rows.length * rh);
    o.rows.forEach((r, i) => {
      const cy = i * rh + rh / 2, of = r.of || o.of || 100, x = v => LW + (R - LW) * Math.min(1, v / of), met = r.target == null || r.value >= r.target;
      txt(s, 0, cy + 4.5, r.label, 'lab', { style: 'font-weight:500' });
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: R - LW, height: bh, rx: bh / 2, fill: N[5], 'fill-opacity': .55 });
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: Math.max(bh, x(r.value) - LW), height: bh, rx: bh / 2, fill: col(r.color || (met ? N[0] : o.missColor || N[2])) });
      if (r.target != null) n(s, 'line', { x1: x(r.target), x2: x(r.target), y1: cy - bh / 2 - 6, y2: cy + bh / 2 + 6, stroke: N[0], 'stroke-width': 1.5, 'stroke-linecap': 'round' });
      txt(s, W, cy + 4, r.display ?? r.value, 'val', { 'text-anchor': 'end', style: 'fill:var(--ink);font-weight:500;font-size:12px' });
    });
    return s;
  }

  /* Dumbbell: before (ring) and after (dot) on one scale, both values labelled, change in a right column.
     o: {rows:[{label, a, b, color}], fmt, max, min, delta:false to hide the change column, names:['Before','After']} */
  function dumbbell(el, o) {
    const W = o.W || 800, rh = o.rowH || 40, LW = o.labelW || 180, DW = o.delta === false ? 16 : 70, R = W - DW - 34, fmt = o.fmt || (v => v);
    const T = o.names ? 24 : 0, H = o.rows.length * rh, s = root(el, W, T + H + 26);
    const vals = o.rows.flatMap(r => [r.a, r.b]), mn = o.min ?? 0, tk = ticks((o.max || Math.max(...vals)) - mn, 4).map(v => v + mn), mx = tk[tk.length - 1];
    const x = v => LW + 30 + (R - LW - 30) * (v - mn) / (mx - mn);
    tk.forEach(v => { n(s, 'line', { x1: x(v), x2: x(v), y1: T, y2: T + H, stroke: GRID }); txt(s, x(v), T + H + 18, fmt(v), 'ax', { 'text-anchor': 'middle' }); });
    if (o.names) { n(s, 'circle', { cx: LW + 35, cy: 8, r: 4.5, fill: PAPER, stroke: N[2], 'stroke-width': 1.6 }); txt(s, LW + 46, 12, o.names[0], 'axl');
      const nx = LW + 60 + o.names[0].length * 7; n(s, 'circle', { cx: nx, cy: 8, r: 5.5, fill: col(o.color || N[0]) }); txt(s, nx + 11, 12, o.names[1], 'axl'); }
    o.rows.forEach((r, i) => {
      const cy = T + i * rh + rh / 2, c = col(r.color || o.color || N[0]), aRight = r.a >= r.b;
      txt(s, 0, cy + 4.5, r.label, 'lab', { style: 'font-weight:500' });
      n(s, 'line', { x1: x(r.a), x2: x(r.b), y1: cy, y2: cy, stroke: N[4], 'stroke-width': 5, 'stroke-linecap': 'round' });
      n(s, 'circle', { cx: x(r.a), cy, r: 5, fill: PAPER, stroke: N[2], 'stroke-width': 1.6 });
      n(s, 'circle', { cx: x(r.b), cy, r: 6, fill: c, stroke: PAPER, 'stroke-width': 1.5 });
      const halo = `paint-order:stroke;stroke:${PAPER};stroke-width:4px;stroke-linejoin:round;`;
      txt(s, x(r.a) + (aRight ? 11 : -11), cy + 4, fmt(r.a), 'ax', { 'text-anchor': aRight ? 'start' : 'end', style: halo });
      txt(s, x(r.b) + (aRight ? -12 : 12), cy + 4, fmt(r.b), 'val', { 'text-anchor': aRight ? 'end' : 'start', style: halo + 'fill:var(--ink);font-weight:500' });
      if (o.delta !== false && r.a) { const d = Math.round((r.b - r.a) / r.a * 100);
        txt(s, W, cy + 4.5, (d > 0 ? '+' : d < 0 ? '\u2212' : '') + Math.abs(d) + '%', 'lab', { 'text-anchor': 'end' }); }
    });
    return s;
  }

  /* Benchmark bars: thick rounded bars, baseline pale, the hero in ink or signal, big figure at the bar end.
     o: {rows:[{label, value, hi, display, sub}], color, max} */
  function bench(el, o) {
    const W = o.W || 760, rh = o.rowH || 74, bh = o.barH || 26, NW = o.numW || 130, R = W - NW, s = root(el, W, o.rows.length * rh);
    const max = o.max || Math.max(...o.rows.map(r => r.value));
    o.rows.forEach((r, i) => {
      const oy = i * rh, w = Math.max(bh, R * r.value / max);
      txt(s, 0, oy + 15, r.label, r.hi ? 'lab' : 'axl', { style: r.hi ? '' : 'font-size:13px' });
      if (r.sub) txt(s, R, oy + 15, r.sub, 'sml', { 'text-anchor': 'end' });
      n(s, 'rect', { x: 0, y: oy + 26, width: w, height: bh, rx: Math.min(8, bh / 2), fill: r.hi ? col(r.color || o.color || N[0]) : N[4] });
      txt(s, w + 14, oy + 26 + bh / 2 + (r.hi ? 10 : 7), r.display ?? r.value, null, { style: `font:600 ${r.hi ? 30 : 20}px var(--f-sans);letter-spacing:-.035em;fill:${r.hi ? 'var(--ink)' : 'var(--n3)'}` });
    });
    return s;
  }

  /* Step grid: lanes of on/off cells, like a sequencer. Cadence, uptime, releases, habits.
     o: {lanes:[{label, cells:[0|1|2]}], x:[first, last], color (level 2), cell, gap, labelW} */
  function stepgrid(el, o) {
    const k = Math.max(...o.lanes.map(l => l.cells.length)), LW = o.labelW ?? 130, W = o.W || 800, g2 = o.gap ?? 4;
    const cw = (W - LW - g2 * (k - 1)) / k, chh = o.cell || Math.min(cw, 22), rh = chh + g2 + (o.lanePad ?? 6), s = root(el, W, o.lanes.length * rh + (o.x ? 18 : 0));
    o.lanes.forEach((l, i) => {
      const y0 = i * rh;
      if (LW) txt(s, 0, y0 + chh / 2 + 4.5, l.label, 'lab', { style: 'font-weight:500' });
      l.cells.forEach((v, c) => n(s, 'rect', { x: LW + c * (cw + g2), y: y0, width: cw, height: chh, rx: Math.min(3, cw / 4),
        fill: v === 2 ? col(o.color || 'signal') : v ? N[0] : N[5], 'fill-opacity': v ? 1 : .7 }));
    });
    if (o.x) { const yb = o.lanes.length * rh + 10; txt(s, LW, yb, o.x[0], 'ax'); txt(s, W, yb, o.x[1], 'ax', { 'text-anchor': 'end' }); }
    return s;
  }

  /* Unit grid: value of total as filled cells, 10 x 10 by default. o: {value, total:100, cols:10, color, cell, gap, round} */
  function waffle(el, o) {
    const cols = o.cols || 10, total = o.total || 100, rowsN = Math.ceil(total / cols), c = o.cell || 16, g2 = o.gap ?? 5, p = c + g2;
    const s = root(el, cols * p - g2, rowsN * p - g2), fill = col(o.color || N[0]);
    for (let i = 0; i < total; i++) { const on = i < Math.round(o.value), a = { fill: on ? fill : N[5], 'fill-opacity': on ? 1 : .75 };
      const cx = (i % cols) * p, cy = Math.floor(i / cols) * p;
      if (o.round) n(s, 'circle', { cx: cx + c / 2, cy: cy + c / 2, r: c / 2, ...a }); else n(s, 'rect', { x: cx, y: cy, width: c, height: c, rx: c * .22, ...a }); }
    s.style.maxWidth = cols * p - g2 + 'px'; return s;
  }

  /* Roadmap lanes on a time axis. from/to are in column units (0 .. cols.length).
     o: {cols:['Q1','Q2','Q3','Q4'], lanes:[{label, bars:[{from, to, label, hi, ghost}]}], today, todayLabel, color} */
  function gantt(el, o) {
    const W = o.W || 1100, LW = o.labelW || 170, rh = o.rowH || 50, T = 30, k = o.cols.length, s = root(el, W, T + o.lanes.length * rh + 6), x = v => LW + (W - LW) * v / k, bh = o.barH || 28;
    o.cols.forEach((c, i) => { n(s, 'line', { x1: x(i), x2: x(i), y1: T - 8, y2: T + o.lanes.length * rh, stroke: GRID }); txt(s, x(i) + 8, 14, c, 'axl'); });
    o.lanes.forEach((l, i) => {
      const cy = T + i * rh + rh / 2;
      n(s, 'line', { x1: 0, x2: W, y1: cy + rh / 2, y2: cy + rh / 2, stroke: GRID });
      txt(s, 0, cy + 4.5, l.label, 'lab', { style: 'font-weight:500' });
      l.bars.forEach(b => {
        const bx = x(b.from) + 3, bw = x(b.to) - x(b.from) - 6, fill = b.hi ? col(b.color || o.color || N[0]) : b.ghost ? 'none' : N[4];
        n(s, 'rect', { x: bx, y: cy - bh / 2, width: bw, height: bh, rx: 8, fill, stroke: b.ghost ? N[3] : 'none', 'stroke-dasharray': b.ghost ? '3 3' : null });
        if (b.label) txt(s, bx + 12, cy + 4.5, b.label, null, { style: `font:500 12.5px var(--f-sans);fill:${b.hi ? PAPER : 'var(--ink)'}` });
      });
    });
    if (o.today != null) { n(s, 'line', { x1: x(o.today), x2: x(o.today), y1: T - 10, y2: T + o.lanes.length * rh, stroke: col('signal'), 'stroke-width': 1.5 });
      n(s, 'circle', { cx: x(o.today), cy: T - 10, r: 3.5, fill: col('signal') });
      if (o.todayLabel) txt(s, x(o.today) + 8, T - 6, o.todayLabel, 'sml', { style: 'fill:var(--ink)' }); }
    return s;
  }

  /* Theme in one call. Give it any of {paper, ink, signal} as hex and it derives the rest (card
     paper, the six greys, text greys, grounds) and sets them as CSS variables, which the stylesheet
     and every chart read. Call it once at the top of the page script, before drawing.
     AS.theme({paper: '#f4f6f8', ink: '#0f1b2d', signal: '#e4502a'}). Any other token can be passed
     by its CSS name without the dashes: AS.theme({crit: '#7a1f1f', 'cell-dawn': 'linear-gradient(...)'}). */
  function theme(t = {}) {
    if (typeof document === 'undefined') return t;
    const root = document.documentElement, cs = getComputedStyle(root), set = (k, v) => root.style.setProperty('--' + k, v);
    const rgb = h => { const v = parseInt(h.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    const mix = (a, b, k) => '#' + rgb(a).map((c, i) => Math.round(c + (rgb(b)[i] - c) * k).toString(16).padStart(2, '0')).join('');
    if (t.paper || t.ink) {
      const paper = t.paper || cs.getPropertyValue('--paper').trim(), ink = t.ink || cs.getPropertyValue('--ink').trim();
      set('paper', paper); set('ink', ink); set('paper-2', mix(paper, '#ffffff', .5));
      set('ground-2', mix(paper, ink, .035)); set('tray', mix(paper, ink, .05));
      [['n1', 0], ['n2', .28], ['n3', .5], ['n4', .7], ['n5', .85], ['n6', .92], ['ink-2', .27], ['ink-3', .36], ['ink-soft', .52]].forEach(([k, m]) => set(k, mix(ink, paper, m)));
    }
    for (const k in t) if (k !== 'paper' && k !== 'ink') set(k, t[k]);
    return t;
  }

  g.AS = { SEV, N, bars, diverging, lines, hbars, dots, flow, heat, strip, annotate, area, compare, track, multiples, kpiSelect, mix, hover, fmtK, el: n, root,
    donut, scatter, slope, waterfall, funnel, meter, matrix, spark, bullet, dumbbell, bench, stepgrid, waffle, gantt, theme, TONE,
    ...(g.AS || {}) };
})(window);
