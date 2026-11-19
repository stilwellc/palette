/* Layout check run by render.sh. Result goes on <body data-check>: "OK" or a list of problems.
   - content spilling out of a page / slide / canvas / screen
   - a figure whose chart overlaps the note or legend below it
   - an icon or mark name that does not exist in icons.js
   - the signal colour covering more than 5% of a page (the budget is about 1%; 5% is the ceiling
     for a chart page) */
window.addEventListener('load', () => setTimeout(() => {
  const out = [];
  const probe = document.createElement('i'); probe.style.color = 'var(--signal)'; document.body.appendChild(probe);
  const SIG = getComputedStyle(probe).color; probe.remove();
  document.querySelectorAll('.page,.slide,.canvas,.screen').forEach((box, i) => {
    const b = box.getBoundingClientRect(), name = `${box.className.split(' ')[0]} ${i + 1}`;
    const all = [...box.querySelectorAll('*')];
    const spill = all.filter(e => {
      const r = e.getBoundingClientRect();
      return r.width && !e.closest('.orb,.tip') && (r.bottom > b.bottom + 1 || r.right > b.right + 1);
    }).map(e => e.className.baseVal ?? e.className ?? e.tagName).slice(0, 3);
    if (spill.length) out.push(`${name} overflows: ${spill.join(', ')}`);
    if (SIG && b.width) {
      let area = 0;
      all.forEach(e => { const cs = getComputedStyle(e);
        if (cs.backgroundColor === SIG || (e instanceof SVGElement && cs.fill === SIG)) { const r = e.getBoundingClientRect(); area += r.width * r.height; } });
      const pct = area / (b.width * b.height) * 100;
      if (pct > 5) out.push(`${name}: signal colour covers ${pct.toFixed(1)}% (ceiling 5%, aim for 1%)`);
    }
  });
  document.querySelectorAll('.card').forEach((c, i) => {
    const ch = c.querySelector('.ch'); if (!ch) return;
    const nx = [...c.querySelectorAll('.note,.key')].find(e => ch.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (nx && nx.getBoundingClientRect().top < ch.getBoundingClientRect().bottom - 1) out.push(`card ${i + 1}: chart overlaps its note/legend`);
  });
  const missing = [...document.querySelectorAll('[data-done="missing"]')].map(e => e.dataset.i || e.dataset.m);
  if (missing.length) out.push(`unknown icon or mark: ${[...new Set(missing)].join(', ')}`);
  document.body.dataset.check = out.length ? out.join(' | ') : 'OK';
}, 300));
