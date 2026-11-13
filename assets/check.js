/* Layout check run by render.sh: flags content spilling out of a page/slide/canvas and figures
   whose chart overlaps the note or legend below it. Result goes on <body data-check>. */
window.addEventListener('load', () => setTimeout(() => {
  const out = [];
  document.querySelectorAll('.page,.slide,.canvas,.screen').forEach((box, i) => {
    const b = box.getBoundingClientRect();
    const spill = [...box.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width && !e.closest('.orb,.tip') && (r.bottom > b.bottom + 1 || r.right > b.right + 1);
    }).map(e => e.className.baseVal ?? e.className ?? e.tagName).slice(0, 3);
    if (spill.length) out.push(`${box.className.split(' ')[0]} ${i + 1} overflows: ${spill.join(', ')}`);
  });
  document.querySelectorAll('.card').forEach((c, i) => {
    const ch = c.querySelector('.ch'), nx = c.querySelector('.note,.key');
    if (ch && nx && nx.getBoundingClientRect().top < ch.getBoundingClientRect().bottom - 1)
      out.push(`card ${i + 1}: chart overlaps its note/legend`);
  });
  document.body.dataset.check = out.length ? out.join(' | ') : 'OK';
}, 300));
