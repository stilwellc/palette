/* Layout check run by render.sh. Result goes on <body data-check>: "OK" or a list of problems.
   - content spilling out of a page / slide / canvas / screen (with how far)
   - two stacked blocks on a page overlapping (a row that shrank under its content)
   - a chart drawn taller or wider than the box it sits in
   - a figure whose chart overlaps the note or legend below it
   - an icon or mark name that does not exist in icons.js
   - the signal colour covering more than 5% of a page (aim for about 1%)
   - sample names from the templates left in a piece made from one
   - a script error on the page (a chart that never drew)
   Add class "bleed" to art that is meant to run off the edge. A chart floating in a half-empty
   card is not an error, so it is reported as a note after OK: look at it. */
const __errs = [];
window.addEventListener('error', e => __errs.push((e.message || 'script error') + (e.lineno ? ' (line ' + e.lineno + ')' : '')));
window.addEventListener('load', () => setTimeout(() => {
  const out = [], notes = [];
  if (__errs.length) out.push(`page script failed, so charts may be missing: ${__errs[0]}`);
  const cls = e => ((e.className && e.className.baseVal) ?? e.className ?? '').toString().trim().split(/\s+/)[0] || e.tagName.toLowerCase();
  const probe = document.createElement('i'); probe.style.color = 'var(--signal)'; document.body.appendChild(probe);
  const SIG = getComputedStyle(probe).color; probe.remove();
  document.querySelectorAll('.page,.slide,.canvas,.screen').forEach((box, i) => {
    const b = box.getBoundingClientRect(), name = `${cls(box)} ${i + 1}`;
    const all = [...box.querySelectorAll('*')];
    let worst = 0, first = null;
    all.forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || e.closest('.orb,.tip,.bleed')) return;
      const over = Math.max(r.bottom - b.bottom, r.right - b.right); if (over > 1 && over > worst) { worst = over; first = e; } });
    if (first) out.push(`${name} overflows by ${Math.round(worst)}px (${cls(first)})`);
    // stacked blocks: each in-flow child should end before the next one starts
    const flow = [...box.children].filter(e => { const cs = getComputedStyle(e); return cs.position !== 'absolute' && cs.position !== 'fixed' && cs.display !== 'none' && e.getBoundingClientRect().height; });
    const col = getComputedStyle(box).flexDirection === 'column' || getComputedStyle(box).display === 'block';
    if (col) for (let k = 0; k < flow.length - 1; k++) {
      const a = flow[k], n2 = flow[k + 1]; let low = a.getBoundingClientRect().bottom;
      a.querySelectorAll('*').forEach(e => { if (!e.ownerSVGElement && !e.closest('.tip,.bleed,.orb')) { const r = e.getBoundingClientRect(); if (r.height && r.bottom > low) low = r.bottom; } });
      const gap = n2.getBoundingClientRect().top - low;
      if (gap < -2) out.push(`${name}: ${cls(a)} runs ${Math.round(-gap)}px into ${cls(n2)} (cut content, or give the row style="flex:none")`);
    }
    if (col && flow.length > 1) {   // the last block should stop at the bottom margin, not in it
      const pad = parseFloat(getComputedStyle(box).paddingBottom) || 0, last = flow[flow.length - 1].getBoundingClientRect().bottom, into = last - (b.bottom - pad);
      if (into > 3 && last <= b.bottom + 1) out.push(`${name} is overfull: its last block sits ${Math.round(into)}px into the bottom margin`);
    }
    if (SIG && b.width) {
      let area = 0;
      all.forEach(e => { const cs = getComputedStyle(e);
        if (cs.backgroundColor === SIG || (e instanceof SVGElement && cs.fill === SIG)) { const r = e.getBoundingClientRect(); area += r.width * r.height; } });
      const pct = area / (b.width * b.height) * 100;
      if (pct > 5) out.push(`${name}: signal colour covers ${pct.toFixed(1)}% (ceiling 5%, aim for 1%)`);
    }
  });
  document.querySelectorAll('svg.ch').forEach(s => {
    const host = s.parentElement; if (!host || s.closest('.tip')) return;
    const r = s.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (r.height > h.height + 2 && getComputedStyle(host).overflow === 'visible' && h.height > 20) {
      const card = s.closest('.card,.bc,.tile,.panel,.page,.slide,.canvas,.screen'), c = card && card.getBoundingClientRect();
      if (c && r.bottom > c.bottom + 1) out.push(`chart in #${host.id || cls(host)} is ${Math.round(r.bottom - c.bottom)}px taller than its ${cls(card)} (lower H or rowH)`);
    }
    if (host.classList.contains('plot') && h.height > 160 && r.height < h.height * .6 && r.width >= h.width * .9)
      notes.push(`chart in #${host.id || 'plot'} fills ${Math.round(r.height / h.height * 100)}% of its box height (raise H or rowH)`);
  });
  document.querySelectorAll('.card').forEach((c, i) => {
    const ch = c.querySelector('.ch'); if (!ch) return;
    const nx = [...c.querySelectorAll('.note,.key,.method')].find(e => ch.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (nx && nx.getBoundingClientRect().top < ch.getBoundingClientRect().bottom - 1) out.push(`card ${i + 1}: chart overlaps its note/legend`);
  });
  const missing = [...document.querySelectorAll('[data-done="missing"]')].map(e => e.dataset.i || e.dataset.m);
  if (missing.length) out.push(`unknown icon or mark: ${[...new Set(missing)].join(', ')}`);
  if (!/\/(templates|examples)\//.test(location.pathname)) {
    const left = (document.body.innerText.match(/\b(Acme|Halden)\b/g) || []);
    if (left.length) out.push(`template sample text left in: "${left[0]}" x${left.length}`);
  }
  document.body.dataset.check = out.length ? out.join(' | ') : 'OK';
  if (notes.length) document.body.dataset.checkNotes = notes.join(' | ');
}, 300));
