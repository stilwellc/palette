/* palette icons. One original line set, drawn for this skill. No dependencies.

   Construction (keep to it when adding one):
   - 24 x 24 grid, live area 3..21 (1.5 units of margin after the stroke), optical centre at 12,12.
   - One stroke weight per size: 1.5 at 24px. AS.icon scales the weight so a 16px icon still reads
     (see WEIGHT). Round caps and joins. No fills except a signal dot (class "f").
   - Primitives only: straight line, circle or circular arc, rounded rectangle (r = 2, or a full
     pill). Outer shapes sit on whole or half units.
   - One idea per icon. If it needs a third detail, it is two icons.

   Use:  <i class="ic" data-i="shield"></i>            hydrated on load, sized by font-size / --ic
         AS.icon('shield', {size: 20})                returns an <svg> string
         AS.iconInto(el, 'shield')                    replaces el's content
   A dot of signal colour: add class "sig" to the <i> and the icon's .f parts take --signal. */
(function (g) {
  const P = {
    /* ---- navigation and actions ---- */
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    more: '<circle class="f" fill="currentColor" stroke="none" cx="6" cy="12" r="1.1"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="12" r="1.1"/><circle class="f" fill="currentColor" stroke="none" cx="18" cy="12" r="1.1"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'chevron-right': '<path d="M9 5l7 7-7 7"/>',
    'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
    'chevron-down': '<path d="M5 9l7 7 7-7"/>',
    'chevron-up': '<path d="M5 15l7-7 7 7"/>',
    'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    'arrow-up': '<path d="M12 20V4M6 10l6-6 6 6"/>',
    'arrow-down': '<path d="M12 4v16M6 14l6 6 6-6"/>',
    'arrow-up-right': '<path d="M7 17L17 7M9 7h8v8"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    settings: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.3 4.8M4.5 12a7.5 7.5 0 0 1 13.3-4.8M18 3.5v4h-4M6 20.5v-4h4"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    share: '<path d="M12 15V4M8 7.5l4-4 4 4M7 11H6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/>',
    send: '<path d="M20.5 3.5L10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12M10 11v5M14 11v5"/>',
    power: '<path d="M12 3.5v8M7 6.6a7.5 7.5 0 1 0 10 0"/>',
    command: '<path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9h11A2.5 2.5 0 1 0 15 6.5v11a2.5 2.5 0 1 0 2.5-2.5h-11A2.5 2.5 0 1 0 9 17.5z"/>',

    /* ---- layout ---- */
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle class="f" fill="currentColor" stroke="none" cx="5" cy="7" r=".9"/><circle class="f" fill="currentColor" stroke="none" cx="5" cy="12" r=".9"/><circle class="f" fill="currentColor" stroke="none" cx="5" cy="17" r=".9"/>',
    columns: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16"/>',
    sidebar: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.5 4v16"/>',
    table: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/>',
    layers: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',

    /* ---- people, access, status ---- */
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    users: '<circle cx="9" cy="8.5" r="3"/><path d="M3 19.5a6 6 0 0 1 12 0M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.2a6 6 0 0 1 3.5 5.3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    key: '<circle cx="8" cy="15.5" r="4"/><path d="M11 12.5L19.5 4M16 7.5l2.5 2.5M13.5 10l2 2"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z"/>',
    'shield-check': '<path d="M12 3.5l7 2.5v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z"/><path d="M9 12l2.2 2.2L15 10.2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
    'eye-off': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M5 4l14 16"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    inbox: '<path d="M4 13l2.5-7.4A1 1 0 0 1 7.4 5h9.2a1 1 0 0 1 .9.6L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 13h4.5a3.5 3.5 0 0 0 7 0H20"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="7.8" r="1"/>',
    alert: '<path d="M12 4l9 15.5H3zM12 10v4.5"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="16.9" r=".9"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.7a2.5 2.5 0 1 1 3.7 2.2c-.8.4-1.2 1-1.2 1.9"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="16.6" r=".9"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
    'x-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
    flag: '<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>',
    bookmark: '<path d="M6.5 4h11v16l-5.5-4.5L6.5 20z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    heart: '<path d="M12 20S4 15 4 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15 12 20 12 20z"/>',
    tag: '<path d="M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5z"/><circle class="f" fill="currentColor" stroke="none" cx="8" cy="8" r="1.1"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.7"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="12" r="1.2"/>',
    sparkle: '<path d="M12 3.5c.6 4.5 4 7.9 8.5 8.5-4.5.6-7.9 4-8.5 8.5-.6-4.5-4-7.9-8.5-8.5 4.5-.6 7.9-4 8.5-8.5z"/>',
    bolt: '<path d="M13 3.5L5.5 13.5H11l-1 7 7.5-10H12z"/>',

    /* ---- time and place ---- */
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    pin: '<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.8 5.4 3.8 8.5s-1.3 5.9-3.8 8.5c-2.5-2.6-3.8-5.4-3.8-8.5s1.3-5.9 3.8-8.5z"/>',
    sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',

    /* ---- messages and media ---- */
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7.5l8 6 8-6"/>',
    chat: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H6a2 2 0 0 1-2-2z"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8.5 5v14M15.5 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    record: '<circle cx="12" cy="12" r="8.5"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="12" r="3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    volume: '<path d="M4 9.5h3l5-4v13l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    wave: '<path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4"/>',
    headphones: '<path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2"/><rect x="4.5" y="13.5" width="3.5" height="6.5" rx="1.5"/><rect x="16" y="13.5" width="3.5" height="6.5" rx="1.5"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4.5 17l4.5-4 3 2.5 3.5-3.5 4 4"/>',

    /* ---- files and build ---- */
    file: '<path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM14 3.5V8h4.5"/>',
    doc: '<path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM14 3.5V8h4.5M9 13h6M9 16.5h6"/>',
    folder: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    code: '<path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5"/>',
    terminal: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 10l2.5 2.5-2.5 2.5M12.5 15h4"/>',
    database: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    server: '<rect x="4" y="4.5" width="16" height="6.5" rx="2"/><rect x="4" y="13" width="16" height="6.5" rx="2"/><circle class="f" fill="currentColor" stroke="none" cx="7.7" cy="7.75" r=".9"/><circle class="f" fill="currentColor" stroke="none" cx="7.7" cy="16.25" r=".9"/>',
    cloud: '<path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.6a4.5 4.5 0 0 1 .5 8.9z"/>',
    cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="10" y="10" width="4" height="4" rx=".5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
    box: '<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7zM4.5 7.7l7.5 4.3 7.5-4.3M12 12v8.5"/>',
    branch: '<circle cx="6.5" cy="6" r="2"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="8" r="2"/><path d="M6.5 8v8M17.5 10c0 3.5-4 4-9.2 6.7"/>',
    pr: '<circle cx="6.5" cy="6" r="2"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/><path d="M6.5 8v8M17.5 16v-6a3 3 0 0 0-3-3H12M14 4.5L11.5 7l2.5 2.5"/>',
    bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M9.5 7a2.5 2.5 0 0 1 5 0M4 13h4M16 13h4M5 7.5l3 2.5M19 7.5l-3 2.5M5 19l3-2.5M19 19l-3-2.5"/>',
    ticket: '<path d="M4 8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2.2a1.8 1.8 0 0 0 0 3.6V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2.2a1.8 1.8 0 0 0 0-3.6zM14.5 7v10"/>',

    /* ---- data and money ---- */
    'chart-bar': '<path d="M4 20h16M7.5 16v-5M12 16V5M16.5 16V9"/>',
    'chart-line': '<path d="M4 4v16h16M7.5 15l4-4.5 3 2.5 5-6"/>',
    'chart-pie': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/>',
    'trend-up': '<path d="M3.5 17l6-6 4 4 7-7.5M15 7.5h5.5V13"/>',
    'trend-down': '<path d="M3.5 7l6 6 4-4 7 7.5M15 16.5h5.5V11"/>',
    card: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M3.5 10h17M7 15h3"/>',
    cart: '<path d="M3.5 4.5H6l2.2 10.5h9.6l1.7-7.5H7"/><circle cx="9.5" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
    dollar: '<path d="M12 3.5v17M16 7.7c-.6-1.4-2-2.2-4-2.2-2.3 0-4 1.1-4 3s1.5 2.7 4 3.2 4 1.3 4 3.3-1.7 3-4 3c-2.2 0-3.6-.8-4.2-2.2"/>',

    /* ---- devices and controls ---- */
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
    laptop: '<path d="M5.5 6.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1V15h-13zM3 18.5h18"/>',
    dial: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12l4.2-4.2"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="12" r="1.1"/>',
    toggle: '<rect x="3" y="7.5" width="18" height="9" rx="4.5"/><circle class="f" fill="currentColor" stroke="none" cx="16.5" cy="12" r="2.2"/>',
    signal: '<path d="M5 19v-3M10 19v-7M15 19V8M20 19V4"/>',
    wifi: '<path d="M3.5 9.5a12.5 12.5 0 0 1 17 0M6.5 13a8 8 0 0 1 11 0M9.5 16.3a3.8 3.8 0 0 1 5 0"/><circle class="f" fill="currentColor" stroke="none" cx="12" cy="19" r="1"/>',
    battery: '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21.5 10.5v3M6.5 11v2M9.5 11v2"/>',
  };

  // Stroke weight by pixel size, so small icons do not go thin and large ones do not go heavy.
  // Expressed in grid units (the viewBox stays 24): 16px draws about 1.25 device px, 48px about 2.2.
  const WEIGHT = px => px <= 14 ? 1.9 : px <= 18 ? 1.7 : px <= 28 ? 1.5 : px <= 44 ? 1.25 : 1.1;

  function icon(name, o = {}) {
    const body = P[name]; if (!body) return '';
    const size = o.size || 24, sw = o.stroke || WEIGHT(size);
    return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }
  function iconInto(el, name, o) { if (typeof el === 'string') el = document.querySelector(el); el.innerHTML = icon(name, o); return el; }
  function hydrate(scope = document) {
    scope.querySelectorAll('i.ic[data-i]:not([data-done])').forEach(el => {
      const px = el.getBoundingClientRect().width || parseFloat(getComputedStyle(el).fontSize) * 1.25 || 20;   // .ic is sized in CSS
      el.innerHTML = icon(el.dataset.i, { size: +el.dataset.size || px, stroke: +el.dataset.stroke || 0 });
      el.dataset.done = P[el.dataset.i] ? '1' : 'missing';
    });
    scope.querySelectorAll('i.mk[data-m]:not([data-done])').forEach(el => {
      el.innerHTML = mark(el.dataset.m, { sig: el.classList.contains('sig') }); el.dataset.done = M[el.dataset.m] ? '1' : 'missing';
    });
  }

  /* ---- marks: a brand mark is two primitives on an 8-unit grid, in one ink ----
     AS.mark('split') returns an <svg> string; <i class="mk" data-m="split"></i> is hydrated on load.
     {sig: true} puts the signal colour on the second primitive (use it once, on the cover or end card).
     These are starting points for a mark of your own, not a library of logos. */
  const M = {
    dot: s => `<circle cx="4" cy="4" r="3.5"/>`,
    ring: s => `<path fill-rule="evenodd" d="M4 .5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>`,
    split: s => `<path d="M3.6.5A3.5 3.5 0 0 0 3.6 7.5z"/><path ${s} d="M4.4.5a3.5 3.5 0 0 1 0 7z"/>`,
    orbit: s => `<path fill-rule="evenodd" d="M4 .5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z"/><circle ${s} cx="4" cy="4" r="1.15"/>`,
    stem: s => `<rect x="1" y=".5" width="2.4" height="7" rx="1.2"/><circle ${s} cx="5.6" cy="6.1" r="1.4"/>`,
    quarter: s => `<path d="M.5 7.5V2.6A7 7 0 0 1 5.4 7.5z"/><circle ${s} cx="6" cy="2" r="1.5"/>`,
    stack: s => `<rect x=".5" y="1" width="7" height="2.4" rx="1.2"/><rect ${s} x=".5" y="4.6" width="4.4" height="2.4" rx="1.2"/>`,
    steps: s => `<rect x=".5" y="4.9" width="2" height="2.6" rx=".5"/><rect x="3" y="2.7" width="2" height="4.8" rx=".5"/><rect ${s} x="5.5" y=".5" width="2" height="7" rx=".5"/>`,
    grid: s => `<circle cx="2" cy="2" r="1.4"/><circle cx="6" cy="2" r="1.4"/><circle cx="2" cy="6" r="1.4"/><circle ${s} cx="6" cy="6" r="1.4"/>`,
    notch: s => `<path d="M.5 2.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4V4H.5z"/><circle ${s} cx="1.9" cy="6.1" r="1.4"/>`,
  };
  function mark(name, o = {}) {
    const f = M[name]; if (!f) return '';
    const sig = o.sig ? 'fill="var(--signal,#2b44d9)"' : '';
    return `<svg viewBox="0 0 8 8" width="${o.size || 28}" height="${o.size || 28}" fill="currentColor" aria-hidden="true">${f(sig)}</svg>`;
  }
  const AS = g.AS = g.AS || {};
  AS.marks = Object.keys(M); AS.mark = mark;
  AS.icons = P; AS.icon = icon; AS.iconInto = iconInto; AS.hydrateIcons = hydrate;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrate());
    else hydrate();
  }
})(typeof window !== 'undefined' ? window : globalThis);
