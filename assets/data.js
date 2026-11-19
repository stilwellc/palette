/* palette data helpers. Load after charts.js and after the file scripts/data.py wrote:
     <script src=".../assets/charts.js"></script>
     <script src=".../assets/data.js"></script>
     <script src="sales.csv.data.js"></script>      (defines const DATA)
   DATA = {source, read, label, columns: [{name, type, unit, grain}], rows: [{...}]}.
   Every function takes DATA, or a rows array returned by AS.pick / AS.sortBy (they carry the
   column info along), so calls nest. Nothing here changes DATA.

   Columns and labels
     AS.col(DATA, 'revenue')                  -> [1200, 1350, ...]  one column's values, nulls kept
     AS.labels(DATA)                          -> ['May', 'Jun', ...]  the label column as strings.
                                                 Dates print short: 'May' when every row is in one
                                                 year, else 'May 2026'; 'Q3' or 'Q3 2026';
                                                 'May 5' or 'May 5, 2026'
     AS.labels(DATA, 'region')                -> ['North', 'South', ...]  a named column instead

   Rows
     AS.pick(DATA, r => r.region === 'North') -> the rows that pass, in order
     AS.sortBy(DATA, 'revenue')               -> rows sorted largest first (nulls last)
     AS.sortBy(DATA, 'revenue', false)        -> smallest first

   Figures (for headlines and notes; nulls are skipped)
     AS.sum(DATA, 'revenue')                  -> 16800
     AS.first(DATA, 'revenue')                -> 1200   first non-empty value
     AS.last(DATA, 'revenue')                 -> 1650   last non-empty value
     AS.change(DATA, 'revenue')               -> {abs: 450, pct: 37.5}  first to last; pct is null
                                                 when the first value is 0

   Formats
     AS.fmtPct(37.5)                          -> '38%'    AS.fmtPct(37.5, 1) -> '37.5%'
     AS.fmtN(2680)                            -> '2,680'  (from charts.js when loaded)
     AS.fmtK(42000)                           -> '42K'    (from charts.js when loaded)
     AS.fmtFor(DATA, 'revenue')               -> a formatter from the column's unit:
                                                 '$' gives v => '$1,200', '%' gives v => '12.5%',
                                                 otherwise AS.fmtN

   Chart rows (one-line chart calls)
     AS.rowsFor(DATA, {label: 'region', value: 'revenue'})
                                              -> [{label, value, display}] for hbars, bench, track
                                                 and bullet. display is the value in its unit.
                                                 Rows with an empty value are dropped.
       optional keys: target: 'plan' and of: 'quota' add those columns to each row (bullet, track);
                      fmt: v => v + ' ms' replaces the display format
       AS.hbars('#c', {rows: AS.rowsFor(AS.sortBy(DATA, 'revenue'), {label: 'region', value: 'revenue'})});
     AS.pairs(DATA, {label: 'region', a: 'q2', b: 'q3'})
                                              -> [{label, a, b}] for dumbbell and slope. Rows with
                                                 an empty a or b are dropped.
       AS.dumbbell('#c', {rows: AS.pairs(DATA, {label: 'region', a: 'q2', b: 'q3'}), fmt: AS.fmtN});
   label may be left out of rowsFor and pairs: the label column data.py assumed is used. */
(function (g) {
  const AS = g.AS = g.AS || {};
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const rowsOf = d => Array.isArray(d) ? d : (d && d.rows) || [];
  const colsOf = d => (d && d.columns) || [];
  const meta = (d, name) => colsOf(d).find(c => c.name === name);
  const carry = (rows, d) => { rows.columns = colsOf(d); rows.label = d && d.label; rows.source = d && d.source; return rows; };
  const need = (d, name) => {
    const rows = rowsOf(d);
    if (name == null) throw new Error('AS data: column name missing');
    if (colsOf(d).length ? !meta(d, name) : rows.length && !(name in rows[0]))
      throw new Error(`AS data: no column "${name}" (have: ${colsOf(d).map(c => c.name).join(', ') || Object.keys(rows[0] || {}).join(', ')})`);
    return rows;
  };
  const labelName = (d, name) => {
    if (name != null) return name;
    if (d && d.label) return d.label;
    const c = colsOf(d).find(c => c.type === 'text' || c.type === 'date');
    return c ? c.name : null;
  };

  if (!AS.fmtN) AS.fmtN = v => Number(v).toLocaleString('en-US');
  if (!AS.fmtK) AS.fmtK = v => Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e3 ? +(v / 1e3).toFixed(1) + 'K' : '' + v;
  AS.fmtPct = (v, digits = 0) => v == null || isNaN(v) ? '' : Number(v).toFixed(digits) + '%';
  const trim = v => +Number(v).toFixed(2);
  AS.fmtFor = (d, name) => {
    const u = (meta(d, name) || {}).unit;
    if (u === '%') return v => trim(v) + '%';
    if (u) return v => (v < 0 ? '-' : '') + u + AS.fmtN(Math.abs(trim(v)));
    return v => AS.fmtN(trim(v));
  };

  // stored dates are text: 2026-05-17, 2026-05, 2026-Q3, 2026, --05, --Q3 (no Date objects, no time zones)
  const parts = v => {
    let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v))) return { y: m[1], mo: +m[2], d: +m[3] };
    if ((m = /^(\d{4})-(\d{2})$/.exec(v))) return { y: m[1], mo: +m[2] };
    if ((m = /^(\d{4})-Q([1-4])$/.exec(v))) return { y: m[1], q: m[2] };
    if ((m = /^--(\d{2})$/.exec(v))) return { mo: +m[1] };
    if ((m = /^--Q([1-4])$/.exec(v))) return { q: m[1] };
    return null;
  };
  const dateLabels = vals => {
    const ps = vals.map(v => v == null ? null : parts(String(v)));
    const years = new Set(ps.filter(p => p && p.y).map(p => p.y));
    const yr = years.size > 1;
    return vals.map((v, i) => {
      const p = ps[i];
      if (v == null) return '';
      if (!p) return String(v);
      if (p.d) return `${MON[p.mo - 1]} ${p.d}` + (yr ? `, ${p.y}` : '');
      if (p.mo) return MON[p.mo - 1] + (yr && p.y ? ` ${p.y}` : '');
      return 'Q' + p.q + (yr && p.y ? ` ${p.y}` : '');
    });
  };

  AS.col = (d, name) => need(d, name).map(r => r[name] === undefined ? null : r[name]);
  AS.labels = (d, name) => {
    const n = labelName(d, name);
    if (n == null) return rowsOf(d).map((_, i) => String(i + 1));
    const vals = AS.col(d, n), m = meta(d, n);
    return m && m.type === 'date' ? dateLabels(vals) : vals.map(v => v == null ? '' : String(v));
  };
  AS.pick = (d, where) => carry(rowsOf(d).filter(where), d);
  AS.sortBy = (d, name, desc = true) => carry(need(d, name).slice().sort((p, q) => {
    const a = p[name], b = q[name];
    if (a == null || b == null) return (a == null) - (b == null);
    const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
    return desc ? -c : c;
  }), d);

  const nums = (d, name) => (name == null && Array.isArray(d) ? d : AS.col(d, name)).filter(v => v != null);
  const tidy = v => +v.toFixed(9);                       // 0.1 + 0.2 reads 0.3
  AS.sum = (d, name) => tidy(nums(d, name).reduce((s, v) => s + v, 0));
  AS.first = (d, name) => { const v = nums(d, name); return v.length ? v[0] : null; };
  AS.last = (d, name) => { const v = nums(d, name); return v.length ? v[v.length - 1] : null; };
  AS.change = (d, name) => {
    const a = AS.first(d, name), b = AS.last(d, name);
    if (a == null) return { abs: null, pct: null };
    return { abs: tidy(b - a), pct: a === 0 ? null : tidy((b - a) / Math.abs(a) * 100) };
  };

  AS.rowsFor = (d, o = {}) => {
    const rows = need(d, o.value), labs = AS.labels(d, o.label), fmt = o.fmt || AS.fmtFor(d, o.value);
    if (o.target != null) need(d, o.target);
    if (o.of != null) need(d, o.of);
    const out = [];
    rows.forEach((r, i) => {
      if (r[o.value] == null) return;
      const row = { label: labs[i], value: r[o.value], display: fmt(r[o.value]) };
      if (o.target != null && r[o.target] != null) row.target = r[o.target];
      if (o.of != null && r[o.of] != null) row.of = r[o.of];
      out.push(row);
    });
    return out;
  };
  AS.pairs = (d, o = {}) => {
    const rows = need(d, o.a), labs = AS.labels(d, o.label);
    need(d, o.b);
    const out = [];
    rows.forEach((r, i) => { if (r[o.a] != null && r[o.b] != null) out.push({ label: labs[i], a: r[o.a], b: r[o.b] }); });
    return out;
  };
})(window);
