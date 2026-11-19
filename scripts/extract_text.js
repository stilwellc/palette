/* Text extractor for `pptx.py --editable`. pptx.py inlines this file into a temporary copy of the
   page (never into the page itself), next to a stylesheet that makes HTML text invisible, and
   reads the result back with headless Chrome --dump-dom.

   After load, fonts, the page's own scripts and a short delay (the same wait check.js uses) it
   walks every page container (.slide, .page, .canvas, .screen) and writes
     {"v":1,"pages":[{w,h,blocks:[...]}]}
   into <head> as a JSON script element with id "palette-text". In <head>, because an extra last child of <body> would break `.slide:last-child`.

   A text block is the nearest non-inline ancestor of a run of text nodes (block, flex or grid
   item, list-item, table-cell, inline-block). A block is cut into segments wherever something
   that is not text sits in its line: a nested block, an icon, an image. Each segment becomes one
   text box:
     x, w      the box, in CSS px from the container's left edge. It is the block's content box
               when the lines sit in it the way text-align says; else the tight box of the lines
     top, H    top and height of the first line's glyph area (not its line box)
     lh        line pitch in px (measured when there are two or more lines, else line-height)
     n         number of lines the block takes in the browser (1 = pptx.py turns wrapping off)
     tw, mx    width of the longest line in px, and its share of all the text (1 for one line)
     align     l | ctr | r | just        indent   first-line indent in px
     runs      [{t, c: "RRGGBB", sz: px, b, wt: weight, i, f: family, ls: px, u, s, v}] or {br: 1}
   Not extracted: text inside svg (chart labels stay in the picture), inside .tip, in form
   controls, invisible or zero-size text, and pseudo-element text (counters, quote marks).
   Text that a text box cannot place (rotated, vertical, or covered by another element such as
   a scrim) is marked data-palette-keep, which the stylesheet turns visible again, so it stays
   in the picture instead. The same script runs in the dump and in the print, so both agree.

   Colours are flattened to solid sRGB (opacity and alpha blended over the nearest background
   colours), sizes include CSS zoom and uniform transform scale. */
(() => {
  const SEL = '.slide,.page,.canvas,.screen';
  const NONE = new Set(['script', 'style', 'template', 'noscript', 'title', 'head', 'meta', 'link']);
  const ATOM = new Set(['svg', 'img', 'canvas', 'video', 'audio', 'iframe', 'object', 'embed',
    'input', 'textarea', 'select', 'math', 'picture', 'progress', 'meter']);
  const SPLIT = { split: 1 };
  const num = v => parseFloat(v) || 0;
  const r2 = v => Math.round(v * 100) / 100;

  // ---- transforms and zoom
  const xfCache = new WeakMap();
  function xf(el) {
    if (!el || el.nodeType !== 1) return { s: 1, rot: false };
    let v = xfCache.get(el); if (v) return v;
    const up = xf(el.parentElement); let s = up.s, rot = up.rot;
    const cs = getComputedStyle(el);
    if (cs.transform && cs.transform !== 'none') {
      const m = new DOMMatrixReadOnly(cs.transform), sx = Math.hypot(m.a, m.b), sy = Math.hypot(m.c, m.d);
      if (!m.is2D || Math.abs(m.b) > 1e-3 || Math.abs(m.c) > 1e-3 || Math.abs(sx - sy) > 1e-3 || m.a < 0) rot = true;
      else s *= sx;
    }
    v = { s, rot }; xfCache.set(el, v); return v;
  }
  const scaleOf = el => xf(el).s * (el.currentCSSZoom || 1);

  // ---- colour
  let cv = null;
  function rgba(str) {
    let m = /^rgba?\(([^)]+)\)/.exec(str);
    if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(num); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = /^color\(srgb\s+([^)]+)\)/.exec(str);
    if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(num); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    try {
      cv = cv || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = str; cv.fillRect(0, 0, 1, 1);
      const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) { return [17, 17, 17, 1]; }
  }
  const over = (c, a, base) => [0, 1, 2].map(i => c[i] * a + base[i] * (1 - a));
  const bgCache = new WeakMap(), opCache = new WeakMap();
  function bgOf(el) {             // the flat colour behind an element (gradients and images ignored)
    if (!el || el.nodeType !== 1) return [255, 255, 255];
    let v = bgCache.get(el); if (v) return v;
    const c = rgba(getComputedStyle(el).backgroundColor);
    v = bgOf(el.parentElement); if (c[3] > 0) v = over(c, c[3], v);
    bgCache.set(el, v); return v;
  }
  function opacityOf(el) {
    if (!el || el.nodeType !== 1) return 1;
    let v = opCache.get(el); if (v !== undefined) return v;
    v = opacityOf(el.parentElement) * (parseFloat(getComputedStyle(el).opacity) || 0);
    opCache.set(el, v); return v;
  }
  const hex = c => c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();

  // ---- run style, one per element that holds text
  const stCache = new WeakMap();
  function styleOf(el, blk) {
    let st = stCache.get(el); if (st) return st;
    const cs = getComputedStyle(el), s = scaleOf(el), col = rgba(cs.color), op = opacityOf(el);
    let u = 0, strike = 0;
    for (let a = el; a; a = a.parentElement) {
      const d = getComputedStyle(a).textDecorationLine || '';
      if (d.includes('underline')) u = 1; if (d.includes('line-through')) strike = 1;
      if (a === blk) break;
    }
    const va = cs.verticalAlign, lift = /px$/.test(va) ? num(va) / (num(cs.fontSize) || 1) : 0;
    st = {
      vis: cs.visibility === 'visible' && op * col[3] > 0.02 && num(cs.fontSize) > 0,
      c: hex(over(col, col[3] * op, bgOf(el))),
      sz: r2(num(cs.fontSize) * s),
      b: (parseInt(cs.fontWeight, 10) || 400) >= 600 ? 1 : 0, wt: parseInt(cs.fontWeight, 10) || 400,
      i: /italic|oblique/.test(cs.fontStyle) ? 1 : 0,
      f: (cs.fontFamily.split(',')[0] || '').trim().replace(/^["']|["']$/g, ''),
      ls: r2(num(cs.letterSpacing) * s),
      u, s: strike, v: va === 'super' || lift > 0.2 ? 1 : va === 'sub' || lift < -0.15 ? -1 : 0,
      tt: cs.textTransform, ws: cs.whiteSpace,
      lh: cs.lineHeight === 'normal' ? 0 : num(cs.lineHeight) * s,
    };
    st.key = [st.c, st.sz, st.wt, st.i, st.f, st.ls, st.u, st.s, st.v].join('|');
    stCache.set(el, st); return st;
  }
  function transform(t, tt) {
    if (tt === 'uppercase') return t.toUpperCase();
    if (tt === 'lowercase') return t.toLowerCase();
    if (tt === 'capitalize') return t.replace(/(^|[\s\-(\["'“‘])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    return t;
  }

  // ---- is the text covered by something that is not its own block?
  function covered(rect, blk) {
    const dx = rect.l + Math.min(rect.w / 2, 6) + scrollX, dy = (rect.t + rect.b) / 2 + scrollY;
    window.scrollTo(Math.max(0, dx - innerWidth / 2), Math.max(0, dy - innerHeight / 2));
    const hit = document.elementFromPoint(dx - scrollX, dy - scrollY);
    window.scrollTo(0, 0);
    return !!hit && !(hit === blk || blk.contains(hit) || hit.contains(blk));
  }

  let order = 0;
  function walkBlock(blk, C, box, out) {
    const items = [];
    const walk = node => {
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) { items.push({ node: ch, k: order++ }); continue; }
        if (ch.nodeType !== 1) continue;
        const tag = ch.localName;
        if (NONE.has(tag) || (ch.classList && ch.classList.contains('tip'))) continue;
        if (tag === 'br') { items.push({ br: 1 }); continue; }
        const cs = getComputedStyle(ch);
        if (cs.display === 'none') continue;
        if (ATOM.has(tag)) { items.push(SPLIT); continue; }
        if (cs.display === 'inline' || cs.display === 'contents') { walk(ch); continue; }
        if (cs.position !== 'absolute' && cs.position !== 'fixed') items.push(SPLIT);
        walkBlock(ch, C, box, out);
      }
    };
    walk(blk);
    let seg = [];
    for (const it of items.concat([SPLIT])) {
      if (it !== SPLIT) { seg.push(it); continue; }
      if (seg.some(x => x.node)) segment(blk, seg, box, out);
      seg = [];
    }
  }

  function segment(blk, items, box, out) {
    const bcs = getComputedStyle(blk), range = document.createRange();
    const pieces = [], rects = [], parents = new Set();
    let first = null;
    for (const it of items) {
      if (it.br) { pieces.push({ br: 1 }); continue; }
      const el = it.node.parentElement, st = styleOf(el, blk);
      if (!st.vis) continue;
      const raw = it.node.data, keepSp = /^(pre|pre-wrap|break-spaces)$/.test(st.ws), keepBr = keepSp || st.ws === 'pre-line';
      const solid = /[^ \t\n\r\f]/.test(raw);
      if (solid) {
        range.selectNodeContents(it.node);
        const rs = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        if (!rs.length) continue;                               // not rendered
        rs.forEach(r => rects.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, sz: st.sz, lh: st.lh || r.height }));
        parents.add(el); if (first === null) first = it.k;
      }
      let t = raw;
      if (!keepSp) t = keepBr ? t.replace(/[ \t\r\f]*\n[ \t\r\f]*/g, '\n').replace(/[ \t\r\f]+/g, ' ') : t.replace(/[ \t\n\r\f]+/g, ' ');
      t = transform(t, st.tt);
      (keepBr ? t.split('\n') : [t]).forEach((part, i) => {
        if (i) pieces.push({ br: 1 });
        if (part) pieces.push({ t: part, st, pre: keepSp });
      });
    }
    if (!rects.length) return;

    // collapse spaces across runs the way a line of inline boxes does
    const runs = []; let start = true, sp = false;
    const rtrim = () => { const last = runs[runs.length - 1]; if (last && last.t !== undefined && !last.pre) { last.t = last.t.replace(/ +$/, ''); if (!last.t) { runs.pop(); rtrim(); } } };
    for (const p of pieces) {
      if (p.br) { rtrim(); runs.push({ br: 1 }); start = true; sp = false; continue; }
      let t = p.t;
      if (!p.pre && (start || sp)) t = t.replace(/^ +/, '');
      if (!t) continue;
      start = false; sp = !p.pre && t.endsWith(' ');
      const last = runs[runs.length - 1];
      if (last && last.t !== undefined && last.st.key === p.st.key && last.pre === p.pre) last.t += t;
      else runs.push({ t, st: p.st, pre: p.pre });
    }
    rtrim();
    while (runs.length && runs[runs.length - 1].br) runs.pop();
    while (runs.length && runs[0].br) runs.shift();
    if (!runs.some(r => r.t)) return;

    // lines
    rects.sort((a, b) => a.t - b.t || a.l - b.l);
    const lines = [];
    for (const r of rects) {
      const mid = (r.t + r.b) / 2, ln = lines[lines.length - 1];
      if (ln && ((mid > ln.t && mid < ln.b) || ((ln.t + ln.b) / 2 > r.t && (ln.t + ln.b) / 2 < r.b))) {
        ln.l = Math.min(ln.l, r.l); ln.r = Math.max(ln.r, r.r); ln.t = Math.min(ln.t, r.t); ln.b = Math.max(ln.b, r.b);
        if (r.sz > ln.dom.sz) ln.dom = r;
      } else lines.push({ l: r.l, r: r.r, t: r.t, b: r.b, dom: r });
    }
    const n = lines.length, dom = lines[0].dom;
    const uL = Math.min(...lines.map(l => l.l)), uR = Math.max(...lines.map(l => l.r));
    const uT = lines[0].t, uB = lines[n - 1].b;
    if (uR <= box.left || uL >= box.right || uB <= box.top || uT >= box.bottom) return;   // off the page

    const keep = () => parents.forEach(el => el.setAttribute('data-palette-keep', ''));
    if (xf(blk).rot || (bcs.writingMode && bcs.writingMode !== 'horizontal-tb')) return keep();
    if (covered(dom, blk)) return keep();

    const s = scaleOf(blk), br = blk.getBoundingClientRect();
    const cl = br.left + (num(bcs.borderLeftWidth) + num(bcs.paddingLeft)) * s;
    const cr = br.right - (num(bcs.borderRightWidth) + num(bcs.paddingRight)) * s;
    const ta = bcs.textAlign;
    let align = /center/.test(ta) ? 'ctr' : /right|end/.test(ta) ? 'r' : ta === 'justify' ? 'just' : 'l';
    if (bcs.direction === 'rtl' && /start|end/.test(ta)) align = ta === 'start' ? 'r' : 'l';
    const tol = 1.5 + Math.abs(runs.find(r => r.t).st.ls);
    let fits = uL >= cl - tol && uR <= cr + tol && cr - cl > 1;
    if (fits) fits = lines.every((l, i) =>
      align === 'ctr' ? Math.abs((l.l + l.r) / 2 - (cl + cr) / 2) <= tol :
      align === 'r' ? Math.abs(l.r - cr) <= tol :
      align === 'just' ? Math.abs(l.l - cl) <= tol && (i === n - 1 || Math.abs(l.r - cr) <= tol + 2) :
      Math.abs(l.l - cl) <= tol);
    let x0, x1, indent = 0;
    if (fits) { x0 = cl; x1 = cr; }
    else {
      x0 = uL; x1 = uR;
      const rest = n > 1 ? Math.min(...lines.slice(1).map(l => l.l)) : uL;
      if (n > 1 && align === 'ctr' && lines.every(l => Math.abs((l.l + l.r) / 2 - (uL + uR) / 2) <= tol)) align = 'ctr';
      else if (n > 1 && align === 'r' && lines.every(l => Math.abs(l.r - uR) <= tol)) align = 'r';
      else { align = 'l'; if (n > 1 && lines[0].l - rest > tol) { indent = lines[0].l - rest; x0 = rest; } }
    }
    const pitch = n > 1 ? (lines[n - 1].dom.t - dom.t) / (n - 1) : 0;
    // one line: the line box is as tall as its tallest inline box (or the block's own strut)
    const strut = bcs.lineHeight === 'normal' ? 0 : num(bcs.lineHeight) * s;
    const lh = pitch > 0 ? pitch : Math.max(strut, ...rects.map(r => r.lh));
    out.push({
      k: first, x: r2(x0 - box.left), w: r2(x1 - x0), top: r2(dom.t - box.top), H: r2(dom.h),
      lh: r2(lh || dom.h), n, align, indent: r2(indent), fit: fits ? 1 : 0,
      tw: r2(Math.max(...lines.map(l => l.r - l.l))),
      mx: r2(Math.max(...lines.map(l => l.r - l.l)) / (lines.reduce((a, l) => a + l.r - l.l, 0) || 1)),
      nowrap: /nowrap|^pre$/.test(bcs.whiteSpace) ? 1 : 0,
      runs: runs.map(r => r.br ? { br: 1 } : { t: r.t, c: r.st.c, sz: r.st.sz, b: r.st.b, wt: r.st.wt, i: r.st.i, f: r.st.f, ls: r.st.ls, u: r.st.u, s: r.st.s, v: r.st.v }),
    });
  }

  function run() {
    let data;
    try {
      const all = [...document.querySelectorAll(SEL)];
      const tops = all.filter(c => !(c.parentElement && c.parentElement.closest(SEL)));
      window.scrollTo(0, 0);
      data = { v: 1, pages: tops.map(C => {
        const box = C.getBoundingClientRect(), out = [];
        if (box.width && box.height) walkBlock(C, C, box, out);
        out.sort((a, b) => a.k - b.k); out.forEach(b => delete b.k);
        return { w: r2(box.width), h: r2(box.height), blocks: out };
      }) };
    } catch (e) { data = { v: 1, error: String(e && e.stack || e) }; }
    const el = document.createElement('script');
    el.type = 'application/json'; el.id = 'palette-text';
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    document.head.appendChild(el);
  }

  const later = () => setTimeout(run, 350);
  const ready = () => (document.fonts && document.fonts.ready ? document.fonts.ready.then(later, later) : later());
  if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);
})();
