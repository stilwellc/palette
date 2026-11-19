#!/usr/bin/env python3
"""Export a palette HTML file to PowerPoint (.pptx).

Usage: pptx.py <file.html> [outdir] [scale] [--from <dir>]
  outdir   where <name>.pptx is written (default: next to the html)
  scale    PNG scale passed to render.sh (default 2)
  --from   folder that already holds <name>.png or <name>-01.png ...; skips render.sh

What you get, honestly: every slide is a PICTURE of the rendered page, placed full-bleed.
The deck opens and presents in PowerPoint, Keynote and Google Slides and looks exactly like
the PDF, but the text on the slides is NOT editable there. The HTML stays the source: change
the HTML and export again.

So the deck is still searchable and a presenter has the words, each slide's speaker notes hold
that page's plain text, taken from the HTML source (each <section class="slide">,
<section class="page">, <div class="canvas ..."> or <div class="screen ..."> in document
order). Text that a script draws at render time (chart labels, for example) is not in the HTML
source, so it is not in the notes. The picture's alt text is the first 200 characters of the
same text, and the presentation title is the HTML <title>. If the number of those containers
does not match the number of PNGs, the deck is still written but the notes and alt text are
left empty rather than put on the wrong slides.

The slide size comes from the first PNG: 16:9 pages become 13.333in x 7.5in, anything else is
scaled so its long side is 13.333in. A page with a different shape from the first is fitted
inside the slide and centred.

Python 3 standard library only.
Exit 0 = deck written, 2 = deck written but render.sh reported a failed layout check,
1 = error (nothing written).
"""
import argparse
import datetime
import os
import re
import struct
import subprocess
import sys
import tempfile
import zipfile
from html.parser import HTMLParser
from xml.sax.saxutils import escape, quoteattr

LONG_SIDE = 12192000          # 13.333in in EMU
WIDE_SHORT = 6858000          # 7.5in in EMU
MIN_SIDE = 914400             # PowerPoint's minimum slide side, 1in
NOTES_CX, NOTES_CY = 6858000, 9144000
ALT_CHARS = 200

NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main"
NS_ALL = f'xmlns:a="{NS_A}" xmlns:r="{NS_R}" xmlns:p="{NS_P}"'
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "application/vnd.openxmlformats-officedocument.presentationml"
XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'


class Fail(Exception):
    pass


# ---------------------------------------------------------------- HTML text

CONTAINERS = {"section": {"slide", "page"}, "div": {"canvas", "screen"}}
INLINE = {"a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "del", "dfn", "em", "font",
          "i", "ins", "kbd", "mark", "q", "s", "samp", "strong", "sub", "sup",
          "time", "tspan", "u", "var", "wbr"}
# Inline tags the templates use as separate layout items ("halden<small>billing</small>"):
# they split words, but not lines. A unit or punctuation mark stays attached ("8<small>%").
SOFT = {"span", "small"}
SOFT_MARK = "\x00"
SOFT_GLUE = re.compile(SOFT_MARK + r"+(?=[%.,;:!?)\]])")
SKIP = {"script", "style", "template", "noscript"}
BAD_XML = re.compile("[^\t\n\r\x20-퟿-�\U00010000-\U0010ffff]")


class PageText(HTMLParser):
    """Collects the <title> and the plain text of each page container, in document order."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = None
        self.pages = []        # one list of lines per container
        self._buf = None       # text of the container being read, or None outside one
        self._tag = None       # tag name of the open container
        self._depth = 0        # nesting of that same tag inside the container
        self._skip = 0
        self._svg = 0
        self._in_title = False
        self._title_buf = []

    def handle_starttag(self, tag, attrs):
        if tag in SKIP:
            self._skip += 1
            return
        if tag == "svg":
            self._svg += 1
        if self._buf is None:
            if tag == "title" and self.title is None and not self._svg:
                self._in_title = True
            classes = set((dict(attrs).get("class") or "").split())
            if tag in CONTAINERS and classes & CONTAINERS[tag]:
                self._buf, self._tag, self._depth = [], tag, 1
            return
        if tag == self._tag:
            self._depth += 1
        self._break(tag)

    def handle_startendtag(self, tag, attrs):
        if self._buf is not None:
            self._break(tag)

    def _break(self, tag):
        if tag in SOFT:
            self._buf.append(SOFT_MARK)
        elif tag not in INLINE:
            self._buf.append("\n")

    def handle_endtag(self, tag):
        if tag in SKIP:
            self._skip = max(0, self._skip - 1)
            return
        if tag == "svg":
            self._svg = max(0, self._svg - 1)
        if tag == "title" and self._in_title:
            self._in_title = False
            self.title = clean(" ".join(self._title_buf))
        if self._buf is None:
            return
        self._break(tag)
        if tag == self._tag:
            self._depth -= 1
            if self._depth == 0:
                self._finish()

    def handle_data(self, data):
        if self._skip:
            return
        if self._in_title:
            self._title_buf.append(data)
        elif self._buf is not None:
            self._buf.append(data.replace(SOFT_MARK, ""))

    def _finish(self):
        text = SOFT_GLUE.sub("", "".join(self._buf)).replace(SOFT_MARK, " ")
        lines = [clean(line) for line in text.split("\n")]
        self.pages.append([line for line in lines if line])
        self._buf, self._tag, self._depth = None, None, 0

    def close(self):
        super().close()
        if self._buf is not None:      # container never closed in the source
            self._finish()


def clean(text):
    return " ".join(BAD_XML.sub("", text).split())


def read_html(path):
    try:
        with open(path, "rb") as f:
            raw = f.read()
    except OSError as e:
        raise Fail(f"cannot read {path}: {e.strerror}")
    parser = PageText()
    parser.feed(raw.decode("utf-8", errors="replace"))
    parser.close()
    return parser.title, parser.pages


# ---------------------------------------------------------------- PNGs

def png_size(path):
    try:
        with open(path, "rb") as f:
            head = f.read(24)
    except OSError as e:
        raise Fail(f"cannot read {path}: {e.strerror}")
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        raise Fail(f"not a PNG file: {path}")
    w, h = struct.unpack(">II", head[16:24])
    if not w or not h:
        raise Fail(f"PNG has no size: {path}")
    return w, h


def find_pngs(folder, name):
    """<name>-01.png ... in page order, or the single <name>.png."""
    try:
        entries = os.listdir(folder)
    except OSError as e:
        raise Fail(f"cannot list {folder}: {e.strerror}")
    numbered = []
    pat = re.compile(re.escape(name) + r"-(\d+)\.png$")
    for entry in entries:
        m = pat.match(entry)
        if m:
            numbered.append((int(m.group(1)), entry))
    single = f"{name}.png" if f"{name}.png" in entries else None
    if numbered:
        if single:
            warn(f"{folder} holds both {name}.png and numbered pages; using the numbered pages")
        return [os.path.join(folder, e) for _, e in sorted(numbered)]
    return [os.path.join(folder, single)] if single else []


def slide_size(w, h):
    if abs(w * 9 - h * 16) <= 0.005 * w * 9:
        return LONG_SIDE, WIDE_SHORT
    if w >= h:
        return LONG_SIDE, max(MIN_SIDE, round(LONG_SIDE * h / w))
    return max(MIN_SIDE, round(LONG_SIDE * w / h)), LONG_SIDE


def place(w, h, cx, cy):
    """Full-bleed when the picture has the slide's shape, else fitted inside and centred."""
    if abs(w * cy - h * cx) <= 0.005 * w * cy:
        return 0, 0, cx, cy, True
    k = min(cx / w, cy / h)
    pw, ph = round(w * k), round(h * k)
    return (cx - pw) // 2, (cy - ph) // 2, pw, ph, False


# ---------------------------------------------------------------- OOXML parts

def rels(items):
    body = "".join(f'<Relationship Id="rId{i}" Type="{t}" Target="{target}"/>'
                   for i, (t, target) in enumerate(items, 1))
    return f'{XML_HEAD}<Relationships xmlns="{PKG_REL}">{body}</Relationships>'


EMPTY_TREE = ('<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
              '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
              '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>')
CLR_MAP = ('<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" '
           'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" '
           'accent6="accent6" hlink="hlink" folHlink="folHlink"/>')
BG = '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>'


def lvl1(size, algn="l"):
    return (f'<a:lvl1pPr marL="0" indent="0" algn="{algn}" rtl="0"><a:buNone/>'
            f'<a:defRPr sz="{size}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/>'
            '</a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/>'
            '<a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>')


def theme(name):
    def fill3():
        return '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' * 3

    def line(w):
        return (f'<a:ln w="{w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill>'
                '<a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>')

    def font(tag):
        return (f'<a:{tag}><a:latin typeface="Helvetica Neue"/><a:ea typeface=""/>'
                f'<a:cs typeface=""/></a:{tag}>')

    colors = [("dk1", "111111"), ("lt1", "FFFFFF"), ("dk2", "3A3A3A"), ("lt2", "EDEDED"),
              ("accent1", "4A4A4A"), ("accent2", "6B6B6B"), ("accent3", "8C8C8C"),
              ("accent4", "ADADAD"), ("accent5", "C7C7C7"), ("accent6", "DEDEDE"),
              ("hlink", "0563C1"), ("folHlink", "954F72")]
    clr = "".join(f'<a:{k}><a:srgbClr val="{v}"/></a:{k}>' for k, v in colors)
    return (f'{XML_HEAD}<a:theme xmlns:a="{NS_A}" name={quoteattr(name)}><a:themeElements>'
            f'<a:clrScheme name="palette">{clr}</a:clrScheme>'
            f'<a:fontScheme name="palette">{font("majorFont")}{font("minorFont")}</a:fontScheme>'
            f'<a:fmtScheme name="palette"><a:fillStyleLst>{fill3()}</a:fillStyleLst>'
            f'<a:lnStyleLst>{line(6350)}{line(12700)}{line(19050)}</a:lnStyleLst>'
            '<a:effectStyleLst>' + '<a:effectStyle><a:effectLst/></a:effectStyle>' * 3 +
            f'</a:effectStyleLst><a:bgFillStyleLst>{fill3()}</a:bgFillStyleLst></a:fmtScheme>'
            '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>')


def slide_master():
    return (f'{XML_HEAD}<p:sldMaster {NS_ALL}><p:cSld>{BG}<p:spTree>{EMPTY_TREE}</p:spTree>'
            f'</p:cSld>{CLR_MAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/>'
            f'</p:sldLayoutIdLst><p:txStyles><p:titleStyle>{lvl1(4400)}</p:titleStyle>'
            f'<p:bodyStyle>{lvl1(2800)}</p:bodyStyle><p:otherStyle>{lvl1(1800)}</p:otherStyle>'
            '</p:txStyles></p:sldMaster>')


def slide_layout():
    return (f'{XML_HEAD}<p:sldLayout {NS_ALL} type="blank" preserve="1"><p:cSld name="Blank">'
            f'<p:spTree>{EMPTY_TREE}</p:spTree></p:cSld>'
            '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>')


def notes_boxes():
    """Slide image on the top half of the notes page, text below it."""
    m = 685800
    img = (m, 1143000, NOTES_CX - 2 * m, 3086100)
    txt = (m, 4400550, NOTES_CX - 2 * m, 3600450)
    return img, txt


def xfrm(box):
    x, y, cx, cy = box
    return f'<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'


def notes_master():
    img, txt = notes_boxes()
    return (f'{XML_HEAD}<p:notesMaster {NS_ALL}><p:cSld>{BG}<p:spTree>{EMPTY_TREE}'
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>'
            '<p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr>'
            '<p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr>'
            f'<p:spPr>{xfrm(img)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>'
            '<a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln>'
            '</p:spPr></p:sp>'
            '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/>'
            '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
            '<p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr>'
            f'<p:spPr>{xfrm(txt)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
            '<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" '
            'bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>'
            '<a:t>Notes</a:t></a:r></a:p></p:txBody></p:sp>'
            f'</p:spTree></p:cSld>{CLR_MAP}<p:notesStyle>{lvl1(1200)}</p:notesStyle>'
            '</p:notesMaster>')


def notes_slide(lines):
    if lines:
        paras = "".join(f'<a:p><a:r><a:rPr lang="en-US"/><a:t>{escape(line)}</a:t></a:r></a:p>'
                        for line in lines)
    else:
        paras = '<a:p><a:endParaRPr lang="en-US"/></a:p>'
    return (f'{XML_HEAD}<p:notes {NS_ALL}><p:cSld><p:spTree>{EMPTY_TREE}'
            '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>'
            '<p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr>'
            '<p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
            '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/>'
            '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
            '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>'
            f'<p:txBody><a:bodyPr/><a:lstStyle/>{paras}</p:txBody></p:sp>'
            '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>')


def slide(n, box, alt):
    x, y, cx, cy = box
    return (f'{XML_HEAD}<p:sld {NS_ALL}><p:cSld><p:spTree>{EMPTY_TREE}'
            f'<p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide {n}" descr={quoteattr(alt)}/>'
            '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch>'
            f'</p:blipFill><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/>'
            f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/>'
            '</a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld>'
            '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')


def presentation(count, cx, cy):
    ids = "".join(f'<p:sldId id="{255 + i}" r:id="rId{6 + i}"/>' for i in range(1, count + 1))
    return (f'{XML_HEAD}<p:presentation {NS_ALL} saveSubsetFonts="1">'
            '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
            '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>'
            f'<p:sldIdLst>{ids}</p:sldIdLst><p:sldSz cx="{cx}" cy="{cy}"/>'
            f'<p:notesSz cx="{NOTES_CX}" cy="{NOTES_CY}"/>'
            f'<p:defaultTextStyle>{lvl1(1800)}</p:defaultTextStyle></p:presentation>')


def content_types(count):
    parts = [("/ppt/presentation.xml", f"{CT}.presentation.main+xml"),
             ("/ppt/slideMasters/slideMaster1.xml", f"{CT}.slideMaster+xml"),
             ("/ppt/slideLayouts/slideLayout1.xml", f"{CT}.slideLayout+xml"),
             ("/ppt/notesMasters/notesMaster1.xml", f"{CT}.notesMaster+xml"),
             ("/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"),
             ("/ppt/theme/theme2.xml", "application/vnd.openxmlformats-officedocument.theme+xml"),
             ("/ppt/presProps.xml", f"{CT}.presProps+xml"),
             ("/ppt/viewProps.xml", f"{CT}.viewProps+xml"),
             ("/ppt/tableStyles.xml", f"{CT}.tableStyles+xml"),
             ("/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"),
             ("/docProps/app.xml",
              "application/vnd.openxmlformats-officedocument.extended-properties+xml")]
    for i in range(1, count + 1):
        parts.append((f"/ppt/slides/slide{i}.xml", f"{CT}.slide+xml"))
        parts.append((f"/ppt/notesSlides/notesSlide{i}.xml", f"{CT}.notesSlide+xml"))
    over = "".join(f'<Override PartName="{p}" ContentType="{t}"/>' for p, t in parts)
    return (f'{XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/'
            'content-types"><Default Extension="rels" ContentType="application/vnd.'
            'openxmlformats-package.relationships+xml"/><Default Extension="xml" '
            'ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
            f'{over}</Types>')


def core_props(title):
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (f'{XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/'
            'package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'<dc:title>{escape(title)}</dc:title>'
            f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
            f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
            '</cp:coreProperties>')


def app_props(count, wide):
    fmt = "Widescreen" if wide else "Custom"
    return (f'{XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/'
            '2006/extended-properties"><TotalTime>0</TotalTime><Application>palette'
            f'</Application><PresentationFormat>{fmt}</PresentationFormat>'
            f'<Slides>{count}</Slides><Notes>{count}</Notes><HiddenSlides>0</HiddenSlides>'
            '</Properties>')


def write_pptx(out_path, pngs, title, pages):
    """pages is a list of line lists (one per PNG), or None to leave notes and alt text empty."""
    sizes = [png_size(p) for p in pngs]
    cx, cy = slide_size(*sizes[0])
    count = len(pngs)
    t = REL
    parts = {
        "[Content_Types].xml": content_types(count),
        "_rels/.rels": rels([(f"{t}/officeDocument", "ppt/presentation.xml"),
                             (f"{PKG_REL}/metadata/core-properties", "docProps/core.xml"),
                             (f"{t}/extended-properties", "docProps/app.xml")]),
        "docProps/core.xml": core_props(title),
        "docProps/app.xml": app_props(count, (cx, cy) == (LONG_SIDE, WIDE_SHORT)),
        "ppt/presentation.xml": presentation(count, cx, cy),
        "ppt/_rels/presentation.xml.rels": rels(
            [(f"{t}/slideMaster", "slideMasters/slideMaster1.xml"),
             (f"{t}/notesMaster", "notesMasters/notesMaster1.xml"),
             (f"{t}/presProps", "presProps.xml"),
             (f"{t}/viewProps", "viewProps.xml"),
             (f"{t}/theme", "theme/theme1.xml"),
             (f"{t}/tableStyles", "tableStyles.xml")] +
            [(f"{t}/slide", f"slides/slide{i}.xml") for i in range(1, count + 1)]),
        "ppt/presProps.xml": f'{XML_HEAD}<p:presentationPr {NS_ALL}/>',
        "ppt/viewProps.xml": f'{XML_HEAD}<p:viewPr {NS_ALL}/>',
        "ppt/tableStyles.xml": (f'{XML_HEAD}<a:tblStyleLst xmlns:a="{NS_A}" '
                                'def="{5C22544A-7EE6-4342-B048-85BB5CBDFDE2}"/>'),
        "ppt/theme/theme1.xml": theme("palette"),
        "ppt/theme/theme2.xml": theme("palette notes"),
        "ppt/slideMasters/slideMaster1.xml": slide_master(),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": rels(
            [(f"{t}/slideLayout", "../slideLayouts/slideLayout1.xml"),
             (f"{t}/theme", "../theme/theme1.xml")]),
        "ppt/slideLayouts/slideLayout1.xml": slide_layout(),
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": rels(
            [(f"{t}/slideMaster", "../slideMasters/slideMaster1.xml")]),
        "ppt/notesMasters/notesMaster1.xml": notes_master(),
        "ppt/notesMasters/_rels/notesMaster1.xml.rels": rels(
            [(f"{t}/theme", "../theme/theme2.xml")]),
    }
    odd = []
    for i, (w, h) in enumerate(sizes, 1):
        lines = pages[i - 1] if pages else []
        x, y, pw, ph, bleed = place(w, h, cx, cy)
        if not bleed:
            odd.append(i)
        parts[f"ppt/slides/slide{i}.xml"] = slide(i, (x, y, pw, ph), " ".join(lines)[:ALT_CHARS])
        parts[f"ppt/slides/_rels/slide{i}.xml.rels"] = rels(
            [(f"{t}/slideLayout", "../slideLayouts/slideLayout1.xml"),
             (f"{t}/image", f"../media/image{i}.png"),
             (f"{t}/notesSlide", f"../notesSlides/notesSlide{i}.xml")])
        parts[f"ppt/notesSlides/notesSlide{i}.xml"] = notes_slide(lines)
        parts[f"ppt/notesSlides/_rels/notesSlide{i}.xml.rels"] = rels(
            [(f"{t}/notesMaster", "../notesMasters/notesMaster1.xml"),
             (f"{t}/slide", f"../slides/slide{i}.xml")])
    if odd:
        warn("pages " + ", ".join(map(str, odd)) + " have a different shape from page 1; "
             "they are fitted inside the slide and centred, not full-bleed")

    tmp = out_path + ".part"
    try:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
            for name, xml in parts.items():
                z.writestr(name, xml.encode("utf-8"))
            for i, png in enumerate(pngs, 1):
                z.write(png, f"ppt/media/image{i}.png", compress_type=zipfile.ZIP_STORED)
        os.replace(tmp, out_path)
    except OSError as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise Fail(f"cannot write {out_path}: {e.strerror or e}")
    return cx, cy


# ---------------------------------------------------------------- command line

def warn(msg):
    print(f"pptx:  warning: {msg}", file=sys.stderr)


class Parser(argparse.ArgumentParser):
    def error(self, message):          # keep exit 2 for "layout check failed" only
        self.print_usage(sys.stderr)
        print(f"pptx.py: error: {message}", file=sys.stderr)
        sys.exit(1)


def parse_args(argv):
    p = Parser(
        prog="pptx.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Export a palette HTML file to PowerPoint: <outdir>/<name>.pptx, one slide "
                    "per rendered page.",
        epilog="""Honest limits:
  Slides are PICTURES of the rendered pages, placed full-bleed. The deck opens and presents in
  PowerPoint, Keynote and Google Slides and matches the PDF, but the text on the slides is
  not editable there. The HTML stays the source: edit the HTML and export again.

  Each slide's speaker notes hold that page's plain text from the HTML source, so the deck is
  searchable and a presenter has the words. Text drawn by a script at render time (chart
  labels) is not included. The picture's alt text is the first 200 characters of that text.
  If the HTML's page containers do not match the PNG count, notes and alt text are left empty.

Exit codes: 0 deck written; 2 deck written but render.sh's layout check failed; 1 error.""")
    p.add_argument("html", metavar="file.html", help="the palette HTML file")
    p.add_argument("outdir", nargs="?", help="where to write <name>.pptx (default: next to the html)")
    p.add_argument("scale", nargs="?", default="2", help="PNG scale for render.sh (default 2)")
    p.add_argument("--from", dest="from_dir", metavar="DIR",
                   help="use the PNGs already in DIR (<name>.png or <name>-01.png ...) "
                        "instead of running render.sh")
    return p.parse_args(argv)


def run(argv):
    args = parse_args(argv)
    html = os.path.abspath(args.html)
    if not os.path.isfile(html):
        raise Fail(f"no such file: {args.html}")
    try:
        if float(args.scale) <= 0:
            raise ValueError
    except ValueError:
        raise Fail(f"scale must be a positive number, got {args.scale!r}")
    name = os.path.splitext(os.path.basename(html))[0]
    outdir = os.path.abspath(args.outdir) if args.outdir else os.path.dirname(html)
    try:
        os.makedirs(outdir, exist_ok=True)
    except OSError as e:
        raise Fail(f"cannot create {outdir}: {e.strerror}")
    title, pages = read_html(html)

    layout_failed = False
    with tempfile.TemporaryDirectory(prefix="palette-pptx-") as tmp:
        if args.from_dir:
            src = os.path.abspath(args.from_dir)
            if not os.path.isdir(src):
                raise Fail(f"no such folder: {args.from_dir}")
        else:
            src = tmp
            render = os.path.join(os.path.dirname(os.path.realpath(__file__)), "render.sh")
            if not os.path.isfile(render):
                raise Fail(f"render.sh not found next to pptx.py ({render})")
            sys.stdout.flush()
            try:
                rc = subprocess.run(["bash", render, html, tmp, args.scale]).returncode
            except OSError as e:
                raise Fail(f"cannot run render.sh: {e.strerror}")
            if rc == 2:
                layout_failed = True
            elif rc != 0:
                raise Fail(f"render.sh failed (exit {rc}); no deck written")
        pngs = find_pngs(src, name)
        if not pngs:
            raise Fail(f"no {name}.png or {name}-01.png ... in {src}"
                       + ("" if args.from_dir else " (render.sh wrote no PNGs)"))
        if len(pages) == len(pngs):
            notes = pages
        else:
            notes = None
            warn(f"{len(pages)} page containers in the HTML but {len(pngs)} PNGs; "
                 "notes and alt text left empty")
        out_path = os.path.join(outdir, f"{name}.pptx")
        cx, cy = write_pptx(out_path, pngs, title or name, notes)

    print(f"pptx:  {out_path}")
    print(f"       {len(pngs)} slide{'s' if len(pngs) != 1 else ''}, "
          f"{cx / 914400:.3f}in x {cy / 914400:.3f}in, "
          f"notes {'from the HTML text' if notes else 'empty'}; "
          "slides are pictures (text is not editable), the HTML stays the source")
    if layout_failed:
        print("pptx:  render.sh reported a failed layout check; the deck was written anyway, "
              "fix the HTML and export again", file=sys.stderr)
        return 2
    return 0


def main():
    try:
        sys.exit(run(sys.argv[1:]))
    except Fail as e:
        print(f"pptx.py: error: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
