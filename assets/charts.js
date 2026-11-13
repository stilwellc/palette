/* AppSec house-style charts. Plain SVG, no dependencies. Each call draws into `el` (element or selector)
   and returns the <svg>. Sizes are viewBox units; the SVG scales to its container width.
   Colour carries severity only; everything else is ink greys. See reference/style-guide.md. */
(function (g) {
  const NS = 'http://www.w3.org/2000/svg';
  const SEV = { critical: '#4a2c17', high: '#722f37', medium: '#8a5d18', low: '#004225' };
  const N = ['#1c1917', '#5a5550', '#8c8478', '#b9b1a4', '#d9d2c5', '#e6e1d6'];
  const PAPER = '#fbf8f1', GRID = 'rgba(36,30,21,.10)', AXIS = 'rgba(36,30,21,.35)';
  const col = c => SEV[c] || c;

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
      if (o.notes && o.notes[i]) n(s, 'text', { x: x + bw / 2, y: yd(d) + 31, 'text-anchor': 'middle', class: 'axl', style: 'fill:#1c1917' }, o.notes[i]);
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
      n(s, 'rect', { x: LW, y: cy - bh / 2, width: R - LW, height: bh, rx: bh / 2, fill: 'rgba(36,30,21,.06)' });
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
      n(s, 'text', { x: x(o.median.v) - 8, y: 16, 'text-anchor': 'end', class: 'axl', style: 'fill:#1c1917;font-weight:500' }, o.median.label);
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
      if (o.mark.label) n(s, 'text', { x: x(i) + 6, y: T + 10, class: 'axl', style: 'fill:#1c1917;font-weight:500' }, o.mark.label);
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
    tk.forEach(v => { if (v) n(s, 'line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: 'rgba(36,30,21,.22)', 'stroke-dasharray': '1 4', 'stroke-linecap': 'round' });
      n(s, 'text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'ax' }, fmt(v)); });
    const slot = (R - L) / k, bw = Math.min(o.barW || slot * .34, 64);
    o.cats.forEach((c, i) => {
      const on = his.includes(i), v = o.values[i], cx = L + slot * i + slot / 2;
      const bm = bar(s, cx - bw / 2, y(v), bw, B - y(v), on ? col(o.color || N[0]) : N[5], true, Math.min(bw / 2, 10)); if (bm) bm.setAttribute('data-tip', JSON.stringify({ h: c, rows: [[o.name || 'Value', on ? (o.color || N[0]) : N[4], fmt(v)]] }));
      const t = fmt(v), tw = t.length * 7 + 16;
      n(s, 'rect', { x: cx - tw / 2, y: y(v) - 30, width: tw, height: 21, rx: 10.5, fill: PAPER, stroke: on ? N[0] : N[3], 'stroke-width': on ? 1.2 : 1 });
      n(s, 'text', { x: cx, y: y(v) - 15.5, 'text-anchor': 'middle', class: 'val', style: on ? 'fill:#1c1917;font-weight:500' : '' }, t);
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
      n(s, 'text', { x: W, y: cy + 9, 'text-anchor': 'end', style: `font:600 ${o.numSize || 26}px var(--f-sans);letter-spacing:-.03em;fill:#1c1917` }, r.display || Math.round(r.value / of * 100) + '%');
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
      n(s, 'text', { x: ox + pw, y: oy + 10, 'text-anchor': 'end', class: 'val', style: 'fill:#1c1917;font-weight:500' }, p.display ?? p.values[k - 1]);
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

  g.AS = { SEV, N, bars, diverging, lines, hbars, dots, flow, heat, strip, annotate, area, compare, track, multiples, kpiSelect, mix, hover, fmtK, el: n, root };
})(window);
