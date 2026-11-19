#!/usr/bin/env python3
"""Data in: turn a CSV, TSV, JSON or .xlsx file into a typed JS data file plus a summary.

Usage: data.py <file> [--sheet NAME] [--name DATA] [--out data.js]

Writes <file>.data.js next to the input (or --out). The file defines
  const DATA = {source, read, label, columns: [{name, type, unit, grain}], rows: [{...}]};
ready for <script src>, so a page never contains hand-typed values. Load assets/data.js for the
helpers that turn DATA into chart rows (AS.col, AS.labels, AS.rowsFor, AS.pairs ...).

Prints a summary to stdout that can be quoted without doing arithmetic: row count, the assumed
label column, per numeric column first / last / min / max / sum / mean / median / change, per
text column the distinct count and top values, and suggested charts (helper names from
reference/charts.md).

Types
  number  thousands separators, currency symbols, %, and (1,200) negatives are stripped.
          unit is "%" (12.5% is stored as 12.5), a currency symbol, or null.
  date    stored as text: "2026-05-17" (day), "2026-05" (month), "2026-Q3" (quarter),
          "2026" (year, only for a column headed year / fy), "--05" (month with no year),
          "--Q3" (quarter with no year). grain says which.
  text    everything else. Empty cells are null in every type.

Python 3 standard library only. Exit 0 on success, 1 with a message on unreadable input.
"""
import csv
import datetime as dt
import io
import json
import math
import os
import re
import statistics
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter


class Fail(Exception):
    pass


NULLS = {'', 'na', 'n/a', '#n/a', 'null', 'none', 'nan', '-', '--', '\u2014', '\u2013'}
CURRENCY = '$\u20ac\u00a3\u00a5\u20b9'
MONTHS = {}
for _i, _names in enumerate(['january jan', 'february feb', 'march mar', 'april apr', 'may',
                             'june jun', 'july jul', 'august aug', 'september sep sept',
                             'october oct', 'november nov', 'december dec'], 1):
    for _n in _names.split():
        MONTHS[_n] = _i
MON_RE = '(' + '|'.join(sorted(MONTHS, key=len, reverse=True)) + r')\.?'

# ------------------------------------------------------------------ cell parsing

NUM_RE = re.compile(r'^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:[eE][+-]?\d+)?$')


def parse_number(s):
    """'$1,234.50' -> (1234.5, '$'); '(12%)' -> (-12.0, '%'); not a number -> None."""
    t = s.strip().replace('\u2212', '-').replace('\u00a0', ' ')
    neg = False
    if t.startswith('(') and t.endswith(')'):
        neg, t = True, t[1:-1].strip()
    unit = None
    if t[:1] in '+-' and t[:1]:
        neg, t = neg != (t[0] == '-'), t[1:].strip()
    if t[:1] and t[0] in CURRENCY:
        unit, t = t[0], t[1:].strip()
    elif t[-1:] and t[-1] in CURRENCY:
        unit, t = t[-1], t[:-1].strip()
    if t[:1] in '+-' and t[:1]:          # "$-12"
        neg, t = neg != (t[0] == '-'), t[1:].strip()
    if t.endswith('%'):
        if unit:
            return None
        unit, t = '%', t[:-1].strip()
    if not t or not NUM_RE.match(t) or not re.search(r'\d', t):
        return None
    if re.match(r'^0\d', t):             # 00123 is an id or a zip code, not a number
        return None
    plain = t.replace(',', '')
    v = float(plain) if re.search(r'[.eE]', plain) else int(plain)
    return (-v if neg else v, unit)


def _ymd(y, m, d):
    try:
        return dt.date(y, m, d).isoformat()
    except ValueError:
        return None


def _yy(y):
    y = int(y)
    return y if y > 99 else (2000 + y if y < 70 else 1900 + y)


def parse_date(s, dayfirst=False):
    """-> (stored text, grain) or None. grain: day, month, quarter, monthname, quartername."""
    t = re.sub(r'\s+', ' ', s.strip())
    low = t.lower()
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?)?$', low)
    if m:
        iso = _ymd(int(m[1]), int(m[2]), int(m[3]))
        return (iso, 'day') if iso else None
    m = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', low)
    if m:
        iso = _ymd(int(m[1]), int(m[2]), int(m[3]))
        return (iso, 'day') if iso else None
    m = re.match(r'^(\d{4})[-/](\d{1,2})$', low)
    if m and 1 <= int(m[2]) <= 12:
        return ('%04d-%02d' % (int(m[1]), int(m[2])), 'month')
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4}|\d{2})$', low)
    if m:
        a, b = int(m[1]), int(m[2])
        mo, d = (b, a) if dayfirst else (a, b)
        iso = _ymd(_yy(m[3]), mo, d)
        return (iso, 'day') if iso else None
    m = re.match(r'^(?:(\d{4}) ?-? ?q([1-4])|q([1-4])(?: ?-? ?(\d{4}))?)$', low)
    if m:
        y, q = (m[1], m[2]) if m[1] else (m[4], m[3])
        return ('%s-Q%s' % (y, q), 'quarter') if y else ('--Q%s' % q, 'quartername')
    m = re.match(r'^' + MON_RE + r'$', low)
    if m:
        return ('--%02d' % MONTHS[m[1]], 'monthname')
    m = re.match(r'^' + MON_RE + r'[ ,-]+(\d{4})$', low)
    if m:
        return ('%s-%02d' % (m[2], MONTHS[m[1]]), 'month')
    m = re.match(r'^' + MON_RE + r' (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$', low)
    if m:
        iso = _ymd(int(m[3]), MONTHS[m[1]], int(m[2]))
        return (iso, 'day') if iso else None
    m = re.match(r'^(\d{1,2})(?:st|nd|rd|th)?[ -]' + MON_RE + r'[ ,-]+(\d{4})$', low)
    if m:
        iso = _ymd(int(m[3]), MONTHS[m[2]], int(m[1]))
        return (iso, 'day') if iso else None
    return None


# ------------------------------------------------------------------ readers
# Every reader returns (header, rows, info). A cell is None, a str, an int/float (already a
# number), ('n', value, unit) or ('d', stored, grain) for typed spreadsheet cells.

def read_text(path):
    raw = open(path, 'rb').read()
    if b'\x00' in raw[:4096] and not raw.startswith((b'\xff\xfe', b'\xfe\xff')):
        raise Fail('looks like a binary file, not text')
    for enc in ('utf-8-sig', 'utf-16', 'cp1252'):
        try:
            return raw.decode(enc), enc
        except UnicodeError:
            continue
    raise Fail('could not decode the file as UTF-8, UTF-16 or Windows-1252')


def read_delimited(path, ext):
    text, enc = read_text(path)
    if not text.strip():
        raise Fail('the file is empty')
    if ext in ('.tsv', '.tab'):
        delim = '\t'
    else:
        first = text.splitlines()[0]
        counts = {d: first.count(d) for d in ',;\t|'}
        delim = max(counts, key=counts.get) if max(counts.values()) else ','
    rows = [r for r in csv.reader(io.StringIO(text, newline=''), delimiter=delim)]
    rows = [r for r in rows if any(c.strip() for c in r)]
    if not rows:
        raise Fail('the file has no rows')
    info = []
    if enc == 'cp1252':
        info.append('not valid UTF-8; read as Windows-1252')
    if delim not in ',\t':
        info.append('delimiter detected: %r' % delim)
    return rows[0], rows[1:], info


def read_json(path):
    text, _ = read_text(path)
    try:
        data = json.loads(text)
    except ValueError as e:
        raise Fail('not valid JSON: %s' % e)
    if isinstance(data, dict) and isinstance(data.get('rows'), list):
        data = data['rows']
    header = []
    if isinstance(data, list) and data and all(isinstance(r, dict) for r in data):
        for r in data:
            for k in r:
                if k not in header:
                    header.append(k)
        rows = [[r.get(k) for k in header] for r in data]
    elif isinstance(data, list) and data and all(isinstance(r, list) for r in data):
        header, rows = [str(c) for c in data[0]], data[1:]
    elif isinstance(data, dict) and data and all(isinstance(v, list) for v in data.values()):
        header = list(data)
        lens = {len(v) for v in data.values()}
        if len(lens) != 1:
            raise Fail('JSON object of arrays: the arrays have different lengths (%s)'
                       % ', '.join('%s=%d' % (k, len(v)) for k, v in data.items()))
        rows = [list(r) for r in zip(*data.values())]
    else:
        raise Fail('JSON shape not recognised. Expected an array of objects, an object of '
                   'arrays, {"rows": [...]}, or an array of arrays with a header row')
    for r in rows:
        for i, c in enumerate(r):
            if isinstance(c, bool):
                r[i] = 'true' if c else 'false'
            elif isinstance(c, (dict, list)):
                raise Fail('JSON column "%s" holds nested objects or arrays; flatten it first'
                           % header[i])
    return header, rows, []


# ---- xlsx

def _xml(z, name):
    try:
        root = ET.fromstring(z.read(name))
    except KeyError:
        raise Fail('workbook part missing: %s' % name)
    except ET.ParseError as e:
        raise Fail('workbook part %s is not valid XML: %s' % (name, e))
    for e in root.iter():
        e.tag = e.tag.rsplit('}', 1)[-1]
    return root


def _attr(e, local):
    for k, v in e.attrib.items():
        if k.rsplit('}', 1)[-1] == local:
            return v
    return None


BUILTIN_DATE = {14: 'day', 15: 'day', 16: 'day', 17: 'month', 22: 'day',
                27: 'day', 28: 'day', 29: 'day', 30: 'day', 31: 'day', 34: 'day', 35: 'day',
                36: 'day', 50: 'day', 51: 'day', 52: 'day', 53: 'day', 54: 'day', 57: 'day',
                58: 'day'}
BUILTIN_TIME = {18, 19, 20, 21, 32, 33, 45, 46, 47, 55, 56}
BUILTIN_PCT = {9, 10}
BUILTIN_CUR = {5, 6, 7, 8, 42, 44}


def _fmt_kind(fid, code):
    """-> ('date', grain) | ('time',) | ('num', unit)"""
    if code is None:
        if fid in BUILTIN_DATE:
            return ('date', BUILTIN_DATE[fid])
        if fid in BUILTIN_TIME:
            return ('time',)
        if fid in BUILTIN_PCT:
            return ('num', '%')
        if fid in BUILTIN_CUR:
            return ('num', '$')
        return ('num', None)
    sym = None
    m = re.search(r'\[\$([^\]-]*)', code)
    if m and m[1].strip() and m[1].strip()[0] in CURRENCY:
        sym = m[1].strip()[0]
    bare = re.sub(r'"[^"]*"|\\.|\[[^\]]*\]|_.|\*.', '', code.split(';')[0]).lower()
    if sym is None:
        q = re.sub(r'\[[^\]]*\]', '', code.split(';')[0])
        sym = next((c for c in q if c in CURRENCY), None)
    if 'general' in bare:
        return ('num', sym)
    if re.search(r'[dy]', bare):
        return ('date', 'day' if 'd' in bare else 'month')
    if re.search(r'[hs]', bare) or 'am/pm' in bare:
        return ('time',)
    if 'm' in bare:
        return ('date', 'month')
    if '%' in bare:
        return ('num', '%')
    return ('num', sym)


def _col_index(ref):
    n = 0
    for ch in ref:
        if ch.isalpha():
            n = n * 26 + ord(ch.upper()) - 64
        else:
            break
    return n - 1


def _serial(v, d1904, where):
    if d1904:
        base = dt.datetime(1904, 1, 1)
    else:
        base = dt.datetime(1899, 12, 30) if v >= 61 else dt.datetime(1899, 12, 31)
    try:
        return base + dt.timedelta(days=v)
    except OverflowError:
        raise Fail('cell %s: date serial %r is out of range' % (where, v))


def read_xlsx(path, sheet):
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        head = open(path, 'rb').read(8)
        if head.startswith(b'\xd0\xcf\x11\xe0'):
            raise Fail('this is an old-format (.xls) or password-protected workbook. '
                       'Save it as .xlsx without a password, or export CSV')
        raise Fail('not a valid .xlsx file (not a zip archive)')
    with z:
        names = set(z.namelist())
        if 'xl/workbook.xml' not in names:
            if 'xl/workbook.bin' in names:
                raise Fail('binary workbook (.xlsb) is not supported. Save as .xlsx or CSV')
            raise Fail('not a spreadsheet workbook (no xl/workbook.xml inside)')
        wb = _xml(z, 'xl/workbook.xml')
        pr = wb.find('workbookPr')
        d1904 = pr is not None and pr.get('date1904') in ('1', 'true')
        rels = {r.get('Id'): r.get('Target') for r in _xml(z, 'xl/_rels/workbook.xml.rels')}
        sheets = []
        for s in wb.iter('sheet'):
            target = rels.get(_attr(s, 'id'), '')
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            sheets.append((s.get('name'), target, s.get('state') or 'visible'))
        if not sheets:
            raise Fail('the workbook has no sheets')
        if sheet is None:
            pick = next((s for s in sheets if s[2] == 'visible'), sheets[0])
        else:
            pick = next((s for s in sheets if s[0] == sheet), None) or \
                   next((s for s in sheets if s[0].lower() == sheet.lower()), None)
            if not pick:
                raise Fail('no sheet named "%s". Sheets: %s' % (sheet, ', '.join(s[0] for s in sheets)))
        sname, target, _ = pick
        if 'worksheets/' not in target:
            raise Fail('sheet "%s" is a chart or macro sheet, not a worksheet' % sname)

        shared = []
        if 'xl/sharedStrings.xml' in names:
            for si in _xml(z, 'xl/sharedStrings.xml').findall('si'):
                shared.append(''.join(t.text or '' for t in si.iter('t')
                                      if not _in_phonetic(si, t)))
        kinds = [('num', None)]
        if 'xl/styles.xml' in names:
            st = _xml(z, 'xl/styles.xml')
            codes = {int(n.get('numFmtId')): n.get('formatCode') for n in st.iter('numFmt')}
            xfs = st.find('cellXfs')
            if xfs is not None:
                kinds = []
                for xf in xfs.findall('xf'):
                    fid = int(xf.get('numFmtId') or 0)
                    kinds.append(_fmt_kind(fid, codes.get(fid)))

        ws = _xml(z, target)
        mc = ws.find('mergeCells')
        if mc is not None and len(mc):
            raise Fail('sheet "%s" has merged cells (%s). Unmerge them or export the table as CSV'
                       % (sname, ', '.join(m.get('ref', '?') for m in list(mc)[:4])))
        grid, info = [], []
        errors = 0
        for row in ws.iter('row'):
            cells, pos = {}, -1
            for c in row.findall('c'):
                ref = c.get('r')
                pos = _col_index(ref) if ref else pos + 1
                where = ref or '?'
                t = c.get('t') or 'n'
                v = c.find('v')
                text = v.text if v is not None else None
                if t == 'inlineStr':
                    is_ = c.find('is')
                    val = ''.join(x.text or '' for x in is_.iter('t')) if is_ is not None else None
                elif text is None or text == '':
                    if c.find('f') is not None:
                        raise Fail('cell %s on sheet "%s" is a formula with no saved result. '
                                   'Open the workbook in a spreadsheet app, save it, and retry'
                                   % (where, sname))
                    val = None
                elif t == 's':
                    try:
                        val = shared[int(text)]
                    except (ValueError, IndexError):
                        raise Fail('cell %s points at a shared string that does not exist' % where)
                elif t == 'str':
                    val = text
                elif t == 'b':
                    val = 'true' if text == '1' else 'false'
                elif t == 'e':
                    errors += 1
                    val = None
                elif t == 'd':
                    val = text
                elif t == 'n':
                    try:
                        num = float(text)
                    except ValueError:
                        raise Fail('cell %s holds "%s", which is not a number' % (where, text))
                    si = int(c.get('s') or 0)
                    kind = kinds[si] if si < len(kinds) else ('num', None)
                    if kind[0] == 'time':
                        raise Fail('cell %s on sheet "%s" is a time of day or a duration. '
                                   'Only numbers, text and dates are supported; format the '
                                   'column as a number or export CSV' % (where, sname))
                    if kind[0] == 'date':
                        when = _serial(num, d1904, where)
                        val = ('d', when.date().isoformat()[:7 if kind[1] == 'month' else 10], kind[1])
                    else:
                        if num.is_integer() and abs(num) < 1e15:
                            num = int(num)
                        val = ('n', num, kind[1])
                else:
                    raise Fail('cell %s has a type this reader does not know (t="%s")' % (where, t))
                if isinstance(val, str) and not val.strip():
                    val = None
                if val is not None:
                    cells[pos] = val
            if cells:
                grid.append(cells)
        if not grid:
            raise Fail('sheet "%s" is empty' % sname)
        lo = min(min(r) for r in grid)
        hi = max(max(r) for r in grid)
        table = [[r.get(i) for i in range(lo, hi + 1)] for r in grid]
        header = []
        for c in table[0]:
            if isinstance(c, tuple):
                c = c[1]
            header.append('' if c is None else str(c))
        if len(sheets) > 1:
            info.append('sheet "%s" of %d (%s)' % (sname, len(sheets), ', '.join(s[0] for s in sheets)))
        else:
            info.append('sheet "%s"' % sname)
        if errors:
            info.append('%d cell(s) hold a formula error (#N/A, #DIV/0! ...): read as empty' % errors)
        if d1904:
            info.append('workbook uses the 1904 date system')
        return header, table[1:], info, sname


def _in_phonetic(si, t):
    for rph in si.iter('rPh'):
        if t in list(rph.iter('t')):
            return True
    return False


# ------------------------------------------------------------------ typing

def build(header, rows, info):
    width = len(header)
    for i, r in enumerate(rows):
        extra = [c for c in r[width:] if c is not None and str(c).strip()]
        if extra:
            raise Fail('data row %d has %d value(s) beyond the %d header columns. The first row '
                       'must be the header: remove title rows above the table' % (i + 1, len(extra), width))
    rows = [list(r[:width]) + [None] * (width - len(r)) for r in rows]

    def blank(c):
        return c is None or (isinstance(c, str) and c.strip().lower() in NULLS)

    names, keep = [], []
    for j, h in enumerate(header):
        h = re.sub(r'\s+', ' ', str(h)).strip()
        has = any(not blank(r[j]) for r in rows)
        if not h:
            if has:
                raise Fail('column %d has values but no header. The first row must name every '
                           'column: remove title rows above the table' % (j + 1))
            continue
        base, k = h, 2
        while h in names:
            h = '%s_%d' % (base, k)
            k += 1
        if h != base:
            info.append('duplicate header "%s" renamed "%s"' % (base, h))
        names.append(h)
        keep.append(j)
    if not names:
        raise Fail('no header row found')
    rows = [[r[j] for j in keep] for r in rows if any(not blank(r[j]) for j in keep)]
    if not rows:
        raise Fail('the file has a header (%s) but no data rows' % ', '.join(names))

    columns, out = [], [dict() for _ in rows]
    for j, name in enumerate(names):
        raw = [None if blank(r[j]) else r[j] for r in rows]
        col, vals = type_column(name, raw, info)
        columns.append(col)
        for o, v in zip(out, vals):
            o[name] = v
    return columns, out


def type_column(name, raw, info):
    present = [c for c in raw if c is not None]
    col = {'name': name, 'type': 'text', 'unit': None}
    if not present:
        info.append('column "%s" is empty' % name)
        return col, [None] * len(raw)

    def as_num(c):
        if isinstance(c, tuple):
            return (c[1], c[2], True) if c[0] == 'n' else None
        if isinstance(c, (int, float)):
            return (c, None, False) if math.isfinite(c) else None
        p = parse_number(c)
        return (p[0], p[1], False) if p else None

    nums = [as_num(c) for c in present]
    if all(nums):
        units = {u for _, u, _ in nums}
        mixed_pct = '%' in units and len(units) > 1
        cur = units - {None, '%'}
        if not mixed_pct and len(cur) <= 1:
            unit = '%' if units == {'%'} else (cur.pop() if cur else None)
            if re.match(r'^(year|yr|fy|fiscal year)$', name.lower()) and unit is None and \
                    all(isinstance(v, int) and 1900 <= v <= 2100 for v, _, _ in nums):
                col.update(type='date', grain='year')
                return col, [None if c is None else str(as_num(c)[0]) for c in raw]
            col.update(type='number', unit=unit)
            vals = []
            for c in raw:
                if c is None:
                    vals.append(None)
                    continue
                v, u, sheet = as_num(c)
                if sheet and u == '%':        # a spreadsheet stores 12.5% as 0.125
                    v = round(v * 100, 10)
                    v = int(v) if float(v).is_integer() else v
                vals.append(v)
            return col, vals
        info.append('column "%s" mixes %s: kept as text' % (
            name, 'percent and plain numbers' if mixed_pct else 'currencies (%s)' % ' '.join(sorted(cur))))

    for dayfirst in (False, True):
        dates = []
        for c in present:
            if isinstance(c, tuple):
                dates.append((c[1], c[2]) if c[0] == 'd' else None)
            elif isinstance(c, str):
                dates.append(parse_date(c, dayfirst))
            else:
                dates.append(None)
        grains = {d[1] for d in dates if d}
        if all(dates) and len(grains) == 1:
            col.update(type='date', grain=grains.pop())
            if dayfirst:
                info.append('column "%s": read as D/M/YYYY (M/D/YYYY did not fit every row)' % name)
            elif any(isinstance(c, str) and re.match(r'^\d{1,2}/\d{1,2}/\d{2,4}$', c.strip()) for c in present):
                info.append('column "%s": read as M/D/YYYY' % name)
            it = iter(dates)
            return col, [None if c is None else next(it)[0] for c in raw]

    n_num = sum(1 for n in nums if n)
    if 0 < n_num < len(present) and n_num >= len(present) / 2:
        bad = [c for c, n in zip(present, nums) if not n]
        info.append('column "%s": %d of %d values are not numbers (e.g. "%s"): kept as text'
                    % (name, len(bad), len(present), _show(bad[0])))
    else:
        ok = [bool(parse_date(c)) if isinstance(c, str) else isinstance(c, tuple) and c[0] == 'd' for c in present]
        if 0 < sum(ok) and sum(ok) >= len(present) / 2:
            bad = [c for c, k in zip(present, ok) if not k]
            info.append('column "%s": %s: kept as text' % (name, 'mixes date grains (day, month ...)' if not bad else
                        '%d of %d values are not dates in a recognised format (e.g. "%s")' % (len(bad), len(present), _show(bad[0]))))
    return col, [None if c is None else _show(c).strip() for c in raw]


def _show(c):
    if isinstance(c, tuple):
        return str(c[1])
    return c if isinstance(c, str) else json.dumps(c)


# ------------------------------------------------------------------ summary

def fnum(v, unit=None, signed=False):
    if v is None:
        return 'n/a'
    a = abs(v)
    if float(v).is_integer():
        s = '{:,.0f}'.format(a)
    elif unit and unit != '%':
        s = '{:,.2f}'.format(a)
    elif a >= 1:
        s = '{:,.2f}'.format(a).rstrip('0').rstrip('.')
    else:
        s = '{:.4g}'.format(a)
    sign = '-' if v < 0 else ('+' if signed and v > 0 else '')
    if unit == '%':
        return sign + s + '%'
    if unit:
        return sign + unit + s
    return sign + s


def clean(v):
    """Round away float noise (0.30000000000000004) so sums and means read as typed."""
    r = round(v, 9)
    return int(r) if float(r).is_integer() and abs(r) < 1e15 else r


MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def date_label(v):
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', v)
    if m:
        return '%s %d, %s' % (MONTH_ABBR[int(m[2]) - 1], int(m[3]), m[1])
    m = re.match(r'^(\d{4})-(\d{2})$', v)
    if m:
        return '%s %s' % (MONTH_ABBR[int(m[2]) - 1], m[1])
    m = re.match(r'^(\d{4})-Q(\d)$', v)
    if m:
        return 'Q%s %s' % (m[2], m[1])
    m = re.match(r'^--(\d{2})$', v)
    if m:
        return MONTH_ABBR[int(m[1]) - 1]
    m = re.match(r'^--Q(\d)$', v)
    if m:
        return 'Q' + m[1]
    return v


BEFORE_AFTER = [('before', 'after'), ('old', 'new'), ('prev', 'curr'), ('previous', 'current'),
                ('start', 'end'), ('from', 'to'), ('last', 'this'), ('then', 'now'),
                ('baseline', 'current'), ('prior', 'current'), ('pre', 'post')]
TARGET_RE = re.compile(r'(target|goal|plan|budget|quota|forecast)', re.I)


def looks_before_after(a, b, rows):
    """Two numeric columns that read as the same measure at two moments. -> reason or None."""
    if a['unit'] != b['unit']:
        return None
    na, nb = a['name'].lower(), b['name'].lower()
    wa, wb = set(re.findall(r'[a-z]+', na)), set(re.findall(r'[a-z]+', nb))
    for x, y in BEFORE_AFTER:
        if x in wa and y in wb:
            return 'names read as %s / %s' % (x, y)
    if na != nb and re.sub(r'\d+', '#', na) == re.sub(r'\d+', '#', nb) and '#' in re.sub(r'\d+', '#', na):
        return 'names differ only by a number (%s, %s)' % (a['name'], b['name'])
    va = [abs(r[a['name']]) for r in rows if r[a['name']] is not None]
    vb = [abs(r[b['name']]) for r in rows if r[b['name']] is not None]
    if va and vb:
        ma, mb = statistics.median(va), statistics.median(vb)
        if ma and mb and 1 / 3 <= ma / mb <= 3:
            return 'same unit and similar scale; check they are the same measure at two moments'
    return None


def summarise(columns, rows, src, info, name):
    L = []
    n = len(rows)
    L.append('%s: %d row%s, %d column%s' % (src, n, '' if n == 1 else 's',
                                             len(columns), '' if len(columns) == 1 else 's'))
    for i in info:
        L.append('note: ' + i)
    label = next((c for c in columns if c['type'] in ('text', 'date')), None)
    if label:
        lv = [r[label['name']] for r in rows]
        shown = [None if v is None else (date_label(v) if label['type'] == 'date' else v) for v in lv]
        uniq = len(set(v for v in lv if v is not None)) == len([v for v in lv if v is not None])
        L.append('label column (assumed): "%s" (%s%s)%s' % (
            label['name'], label['type'],
            ', ' + label['grain'] if label.get('grain') else '',
            '' if uniq else '. Its values repeat, so a label does not name one row'))
    else:
        shown = ['row %d' % (i + 1) for i in range(n)]
        uniq = True
        L.append('label column (assumed): none (no text or date column). Rows are named by position')

    def lab(i):
        return shown[i] if shown[i] is not None else 'row %d' % (i + 1)

    L.append('')
    L.append('columns:')
    numeric = [c for c in columns if c['type'] == 'number']
    stats = {}
    for c in columns:
        vals = [r[c['name']] for r in rows]
        idx = [i for i, v in enumerate(vals) if v is not None]
        nulls = n - len(idx)
        nl = ', %d empty' % nulls if nulls else ''
        if c['type'] == 'number':
            u = c['unit']
            kind = {'%': 'number, percent', None: 'number'}.get(u, 'number, currency %s' % u)
            L.append('  %s (%s%s)' % (c['name'], kind, nl))
            if not idx:
                continue
            xs = [vals[i] for i in idx]
            lo, hi = min(xs), max(xs)
            ilo, ihi = idx[xs.index(lo)], idx[xs.index(hi)]
            total = clean(math.fsum(xs))
            mean = clean(math.fsum(xs) / len(xs))
            med = clean(statistics.median(xs))
            first, last = xs[0], xs[-1]
            d = clean(last - first)
            pct = None if first == 0 else clean(round((last - first) / abs(first) * 100, 1))
            stats[c['name']] = dict(sum=total, min=lo, max=hi, n=len(xs), neg=lo < 0)

            def tie(v):
                k = xs.count(v) - 1
                return ', tied with %d other row%s' % (k, '' if k == 1 else 's') if k else ''
            L.append('    first   %s  (%s)' % (fnum(first, u), lab(idx[0])))
            L.append('    last    %s  (%s)' % (fnum(last, u), lab(idx[-1])))
            L.append('    min     %s  (%s%s)' % (fnum(lo, u), lab(ilo), tie(lo)))
            L.append('    max     %s  (%s%s)' % (fnum(hi, u), lab(ihi), tie(hi)))
            L.append('    sum     %s' % fnum(total, u))
            L.append('    mean    %s' % fnum(mean, u))
            L.append('    median  %s' % fnum(med, u))
            if u == '%':
                dtxt = fnum(d, None, True) + ' points'
            else:
                dtxt = fnum(d, u, True)
            L.append('    change first to last  %s  (%s)' % (
                dtxt, 'n/a, first value is 0' if pct is None else fnum(pct, '%', True)))
        elif c['type'] == 'date':
            L.append('  %s (date, %s%s)' % (c['name'], c.get('grain'), nl))
            if not idx:
                continue
            xs = [vals[i] for i in idx]
            order = 'ascending' if xs == sorted(xs) else ('descending (newest first, so "first" in the '
                    'number columns is the newest row)' if xs == sorted(xs, reverse=True) else 'not sorted')
            L.append('    first %s, last %s, %d distinct, order: %s' % (
                date_label(xs[0]), date_label(xs[-1]), len(set(xs)), order))
        else:
            L.append('  %s (text%s)' % (c['name'], nl))
            if not idx:
                continue
            cnt = Counter(vals[i] for i in idx)
            if len(cnt) == len(idx):
                top = ', '.join('"%s"' % v for v in [vals[i] for i in idx][:5])
                L.append('    %d distinct (every value is different). First values: %s%s'
                         % (len(cnt), top, ' ...' if len(cnt) > 5 else ''))
            else:
                top = ', '.join('"%s" x%d' % kv for kv in cnt.most_common(5))
                L.append('    %d distinct. Top values: %s%s' % (len(cnt), top, ' ...' if len(cnt) > 5 else ''))

    L.append('')
    L.append('suggested charts:')
    for s in suggest(columns, rows, label, uniq, numeric, stats, name):
        L.append('  ' + s)
    return L, (label['name'] if label else None)


def suggest(columns, rows, label, uniq, numeric, stats, D):
    n = len(rows)
    out = []
    if not numeric:
        return ['none: there is no numeric column. Count rows per value of a text column first.']
    q = lambda c: "'%s'" % c['name'].replace("\\", "\\\\").replace("'", "\\'")
    lab = q(label) if label else None
    dated = label is not None and label['type'] == 'date'
    texts = [c for c in columns if c['type'] == 'text']
    k = len(numeric)
    a = numeric[0]
    b = numeric[1] if k > 1 else None
    labels_call = 'AS.labels(%s)' % D

    if dated and not uniq and texts:
        out.append('long format (one row per %s and %s): filter one group with '
                   "AS.pick(%s, r => r[%s] === '...'), then `lines` (2 to 4 groups) or `multiples` (more)"
                   % (label['name'], texts[0]['name'], D, q(texts[0])))
    elif dated or label is None:
        if k == 1:
            if n <= 12:
                out.append("`compare`: one series over %d periods%s.  AS.compare('#c', {cats: %s, values: AS.col(%s, %s)})"
                           % (n, '' if n >= 4 else ' (under 4: consider a headline number instead)',
                              labels_call, D, q(a)))
            else:
                out.append("`area`: one series over %d periods (over 12, `compare` chips collide).  "
                           "AS.area('#c', {x: %s, series: [{name: %s, values: AS.col(%s, %s)}]})"
                           % (n, labels_call, q(a), D, q(a)))
        else:
            if k <= 4:
                out.append("`lines`: %d series over %d periods.  AS.lines('#c', {x: %s, series: [%s]})"
                           % (k, n, labels_call, ', '.join(
                               '{name: %s, values: AS.col(%s, %s)}' % (q(c), D, q(c)) for c in numeric)))
            else:
                out.append('`multiples`: %d series over %d periods, one panel each.  '
                           "AS.multiples('#c', {panels: [%s, ...]})"
                           % (k, n, '{label: %s, values: AS.col(%s, %s)}' % (q(a), D, q(a))))
            if k == 2:
                out.append("`diverging`: only if the two columns are in and out per period (opened and fixed).  "
                           "AS.diverging('#c', {cats: %s, up: AS.col(%s, %s), down: AS.col(%s, %s)})"
                           % (labels_call, D, q(a), D, q(b)))
            if n <= 12:
                out.append("`compare`: for one of the columns alone.  AS.compare('#c', {cats: %s, values: AS.col(%s, %s)})"
                           % (labels_call, D, q(a)))
    else:
        tgt = next((c for c in numeric if TARGET_RE.search(c['name'])), None)
        val = next((c for c in numeric if c is not tgt and tgt and c['unit'] == tgt['unit']), None)
        if not val:
            tgt = None
        pair = None
        for i in range(k - 1):
            x, y = numeric[i], numeric[i + 1]
            if tgt in (x, y):
                continue
            why = looks_before_after(x, y, rows)
            if why:
                pair = (x, y, why)
                break
        if tgt and val:
            out.append("`bullet`: \"%s\" against \"%s\".  AS.bullet('#c', {rows: AS.rowsFor(%s, {label: %s, value: %s, target: %s})})"
                       % (val['name'], tgt['name'], D, lab, q(val), q(tgt)))
        if pair:
            x, y, why = pair
            out.append("`dumbbell`: before and after per %s (%s).  AS.dumbbell('#c', {rows: AS.pairs(%s, {label: %s, a: %s, b: %s}), fmt: AS.fmtN%s})"
                       % (label['name'], why, D, lab, q(x), q(y), ', delta: false' if x['unit'] == '%' else ''))
            if n <= 8:
                out.append("`slope`: same pair, when the story is who moved (%d rows, 8 at most).  AS.slope('#c', {rows: AS.pairs(%s, {label: %s, a: %s, b: %s})})"
                           % (n, D, lab, q(x), q(y)))
        if k >= 2 and not (tgt and k == 2):
            x, y = (numeric[0], numeric[1])
            out.append("`scatter`: two numbers per item%s.  AS.scatter('#c', {xLabel: %s, yLabel: %s, points: %s.rows.map(r => ({x: r[%s], y: r[%s], label: r[%s]}))})"
                       % (' (the columns do not look like before and after)' if not pair else '',
                          q(x), q(y), D, q(x), q(y), lab))
        one = val or a
        st = stats.get(one['name'])
        if st and not (pair and k == 2) and not (tgt and k == 2):
            parts = n >= 2 and not st['neg'] and 99 <= st['sum'] <= 101
            frac = n >= 2 and not st['neg'] and one['unit'] is None and 0.99 <= st['sum'] <= 1.01
            if parts or frac:
                out.append("`track`: parts of a whole (\"%s\" sums to %s).  AS.track('#c', {%srows: AS.rowsFor(%s, {label: %s, value: %s})})"
                           % (one['name'], fnum(st['sum'], one['unit']), 'of: 1, ' if frac else '', D, lab, q(one)))
                if n <= 4:
                    out.append("`donut`: same parts as one ring (%d segments, 4 at most).  AS.donut('#c', {segs: AS.col(%s, %s).map((v, i) => ({v, color: 'n' + (i + 1)}))})"
                               % (n, D, q(one)))
                else:
                    out.append('`donut`: only for one share of the whole (it takes 4 segments at most; there are %d rows)' % n)
            if n <= 3:
                out.append("`bench`: %d rows, one hero.  AS.bench('#c', {rows: AS.rowsFor(%s, {label: %s, value: %s})})"
                           % (n, D, lab, q(one)))
            else:
                out.append("`hbars`: ranked list of %d rows%s.  AS.hbars('#c', {rows: AS.rowsFor(AS.sortBy(%s, %s), {label: %s, value: %s})})"
                           % (n, '' if n <= 15 else ' (long: keep the top 10 or so with .slice(0, 10))', D, q(one), lab, q(one)))
        if not uniq:
            out.append('caution: "%s" values repeat, so rows are not one per label. Filter with AS.pick first.' % label['name'])
    neg = [c['name'] for c in numeric if stats.get(c['name'], {}).get('neg')]
    if neg:
        out.append('caution: negative values in %s. `compare`, `area`, `lines`, `hbars` and `scatter` start at zero and cannot show them.'
                   % ', '.join('"%s"' % x for x in neg))
    return out or ['none fits the shape cleanly: see the pick table in reference/charts.md']


# ------------------------------------------------------------------ output

def write_js(path, name, src, sheet, label, columns, rows):
    def j(v):
        return json.dumps(v, ensure_ascii=False).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    head = ['source: %s' % j(src)]
    if sheet:
        head.append('sheet: %s' % j(sheet))
    head.append('read: %s' % j(dt.date.today().isoformat()))
    head.append('label: %s' % j(label))
    cols = []
    for c in columns:
        d = {'name': c['name'], 'type': c['type'], 'unit': c['unit']}
        if c.get('grain'):
            d['grain'] = c['grain']
        cols.append('    ' + j(d))
    body = ['    ' + j(r) for r in rows]
    text = ('// Generated by palette scripts/data.py from %s. Do not edit: re-run data.py on the source.\n'
            'const %s = {\n  %s,\n  columns: [\n%s\n  ],\n  rows: [\n%s\n  ]\n};\n'
            % (src.replace('\n', ' '), name, ',\n  '.join(head), ',\n'.join(cols), ',\n'.join(body)))
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


JS_RESERVED = set('break case catch class const continue debugger default delete do else export '
                  'extends finally for function if import in instanceof new return super switch '
                  'this throw try typeof var void while with yield let static enum await null '
                  'true false'.split())


def main(argv):
    args, opt = [], {'--sheet': None, '--name': 'DATA', '--out': None}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ('-h', '--help'):
            print(__doc__.strip())
            return 0
        if a in opt:
            if i + 1 >= len(argv):
                raise Fail('%s needs a value' % a)
            opt[a] = argv[i + 1]
            i += 2
            continue
        if a.startswith('--'):
            raise Fail('unknown option %s' % a)
        args.append(a)
        i += 1
    if len(args) != 1:
        raise Fail('usage: data.py <file> [--sheet NAME] [--name DATA] [--out data.js]')
    path, name = args[0], opt['--name']
    if not re.match(r'^[A-Za-z_$][A-Za-z0-9_$]*$', name) or name in JS_RESERVED:
        raise Fail('--name must be a JavaScript identifier (got "%s")' % name)
    if not os.path.isfile(path):
        raise Fail('no such file: %s' % path)
    ext = os.path.splitext(path)[1].lower()
    sheet = None
    if opt['--sheet'] is not None and ext not in ('.xlsx', '.xlsm'):
        raise Fail('--sheet only applies to .xlsx files')
    try:
        if ext in ('.csv', '.tsv', '.tab', '.txt'):
            header, rows, info = read_delimited(path, ext)
        elif ext == '.json':
            header, rows, info = read_json(path)
        elif ext in ('.xlsx', '.xlsm'):
            header, rows, info, sheet = read_xlsx(path, opt['--sheet'])
        elif ext in ('.xls', '.xlsb', '.ods', '.numbers'):
            raise Fail('%s files are not supported. Save as .xlsx or export CSV' % ext)
        else:
            raise Fail('unknown file type "%s". Supported: .csv .tsv .json .xlsx' % (ext or 'no extension'))
    except OSError as e:
        raise Fail('cannot read the file: %s' % e)
    columns, out_rows = build(header, rows, info)
    src = os.path.basename(path)
    lines, label = summarise(columns, out_rows, src, info, name)
    out = opt['--out'] or path + '.data.js'
    try:
        write_js(out, name, src, sheet, label, columns, out_rows)
    except OSError as e:
        raise Fail('cannot write %s: %s' % (out, e))
    print('\n'.join(lines))
    print('')
    print('wrote: %s  (const %s; load it with <script src> before the page script)' % (os.path.abspath(out), name))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except Fail as e:
        sys.stderr.write('data.py: %s: %s\n' % (sys.argv[1] if len(sys.argv) > 1 else 'error', e))
        sys.exit(1)
