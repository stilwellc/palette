#!/usr/bin/env python3
"""Export a palette HTML file to PowerPoint (.pptx).

Usage: pptx.py <file.html> [outdir] [scale] [--from <dir>] [--editable [--plain-weights]]
  outdir      where <name>.pptx is written (default: next to the html)
  scale       PNG scale passed to render.sh (default 2)
  --from      folder that already holds <name>.png or <name>-01.png ...; skips render.sh
  --editable  real, editable text boxes over a text-free picture (see below); not with --from
  --plain-weights  with --editable: regular/bold only, no named weights (see below)

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

--editable, honestly: aimed first at Google Slides (File > Import slides, or open the .pptx
from Drive), and it also opens in PowerPoint and Keynote. Each slide gets two layers:
  1. a full-bleed picture of the page with its HTML text made invisible: cards, tiles, icons,
     orbs, rules, counters and quote marks drawn by CSS, and the charts WITH their own labels;
  2. one text box per block of HTML text on top, placed and styled from the rendered page
     (position, width, font, size, weight, italic, colour, letter-spacing, line-height,
     alignment, and a separate run for every inline change such as the grey <em> clause of a
     headline). Boxes have no fill, no outline, zero insets and no autofit. A block that is
     one line in the browser gets wrapping off, so it can never break; a wrapped block keeps
     wrapping on and is a little wider than measured (3%, and the width its tracking saves).
What that means:
  * The text is editable and re-flows when you edit it. Shapes and charts are NOT editable:
    they are one picture underneath, and it does not move when the text does. Chart labels,
    axis text and anything else inside an SVG stay in the picture, as do CSS counters
    (01, 02 ...), quote marks, and text that a text box cannot place (rotated, or sitting
    under a scrim).
  * Fonts are named, not embedded. Inter is used as Inter (Google Slides has it; PowerPoint and
    Keynote need it installed, or they substitute and the text re-wraps). Geist Mono is written
    as Roboto Mono, which Google Slides has. Any other family keeps its own name.
  * Weight is written into the family name ("Inter Medium", "Inter SemiBold"), the way Google
    Slides names weights in its own .pptx files. Slides resolves those names (checked on an
    import, Nov 2026) and the weights then match the PDF. An app that does not know a named
    family substitutes another font: for those use --plain-weights, which writes plain Inter
    with bold from weight 600 and regular below. That sets 500 lighter and 600 heavier than
    the PDF, so wrapped lines can break one word earlier or later.
  * Google Slides has no letter-spacing and drops it on import. The house style tracks
    headlines tight (-0.045em), so in Slides a headline sets about 5% wider than in the PDF
    and small caps labels a little narrower. The boxes leave room for that; PowerPoint and
    Keynote keep the tracking.
  * Other small differences from the PDF are normal: a wrapped line can break one word later,
    text can sit a few pixels high or low (apps disagree on where the first line sits when
    line-height is not 100%; the boxes are placed by what Google Slides was measured to do),
    OpenType features (tabular figures, alternates) and margins on inline elements are not
    carried, Roboto Mono's figures are drawn differently from Geist Mono's, and
    semi-transparent text becomes the nearest solid colour. Line spacing is a percentage of
    the font's own line height, which is how those apps store it.
  * The geometry comes from scripts/extract_text.js, run in headless Chrome on a temporary copy
    of the page written next to it (removed afterwards). If the text cannot be read back, or
    the pages do not match the PNGs one to one, the deck falls back to plain pictures and
    says so.
The HTML is still the source for anything but a wording change.

Python 3 standard library only.
Exit 0 = deck written, 2 = deck written but render.sh reported a failed layout check,
1 = error (nothing written).
"""
import argparse
import datetime
import json
import os
import pathlib
import re
import shutil
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


def slide(n, box, alt, shapes=""):
    x, y, cx, cy = box
    return (f'{XML_HEAD}<p:sld {NS_ALL}><p:cSld><p:spTree>{EMPTY_TREE}'
            f'<p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide {n}" descr={quoteattr(alt)}/>'
            '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch>'
            f'</p:blipFill><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/>'
            f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/>'
            f'</a:prstGeom></p:spPr></p:pic>{shapes}</p:spTree></p:cSld>'
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


def write_pptx(out_path, pngs, title, pages, text=None, named=True):
    """pages is a list of line lists (one per PNG), or None to leave notes and alt text empty.
    text is the extractor's page list (one per PNG) for --editable, or None for picture slides."""
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
        shapes = text_boxes(text[i - 1], x, y, pw, named) if text else ""
        parts[f"ppt/slides/slide{i}.xml"] = slide(i, (x, y, pw, ph), " ".join(lines)[:ALT_CHARS],
                                                  shapes)
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


# ---------------------------------------------------------------- editable text (--editable)

# Injected into the temporary copy. -webkit-text-fill-color hides glyphs without touching layout
# or currentColor (icons, bullets and rules drawn with currentColor keep their ink). It inherits,
# so everything that must stay in the picture is set back: SVG (chart labels), form controls,
# pseudo-element text (counters, quote marks), and elements the extractor marks as kept.
HIDE_CSS = (
    "*:not(svg):not(svg *):not(input):not(textarea):not(select):not([data-palette-keep])"
    "{-webkit-text-fill-color:transparent!important;text-shadow:none!important;"
    "text-decoration-color:transparent!important;caret-color:transparent!important}"
    "svg,input,textarea,select,[data-palette-keep]"
    "{-webkit-text-fill-color:currentcolor!important}"
    "*::before,*::after,*::marker,*::placeholder"
    "{-webkit-text-fill-color:currentcolor!important}")
TEXT_JSON = re.compile(r'<script type="application/json" id="palette-text">(.*?)</script>', re.S)
# CSS family (lower case) -> typeface written to the deck. Google Slides has Inter and Roboto
# Mono; a family not listed keeps its own name; generic names fall through to the theme font.
FONT_MAP = {"inter": "Inter", "inter var": "Inter", "inter variable": "Inter",
            "intervariable": "Inter", "geist mono": "Roboto Mono"}
GENERIC_FONTS = {"", "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
                 "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "math", "emoji",
                 "-apple-system", "blinkmacsystemfont"}
WEIGHT_NAMES = {100: " Thin", 200: " ExtraLight", 300: " Light", 400: "", 500: " Medium",
                600: " SemiBold", 700: "", 800: " ExtraBold", 900: " Black"}
SUPER_SCALE = 0.65            # apps shrink super/subscript runs by about this much themselves
WIDEN_LINE = (6.0, 0.08)      # one-line box: px floor and share of its width added
WIDEN_PARA = (6.0, 0.03)      # wrapped box: the same, so a metric difference does not re-wrap
# Where the first line sits when line spacing is under 100%, measured on a Google Slides import
# (Nov 2026): the glyphs move up by this share of the font's line height times the missing
# percentage (about the ascent). Over 100% Slides adds the extra below the line, not above.
TIGHT_LIFT = 0.8


def find_chrome():
    """Same search as render.sh."""
    env = os.environ.get("CHROME")
    if env:
        return env
    for c in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"):
        if os.access(c, os.X_OK):
            return c
    for c in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
              "microsoft-edge"):
        found = shutil.which(c)
        if found:
            return found
    return None


def dump_dom(chrome, path):
    """Headless Chrome --dump-dom with render.sh's flags (and its CI --no-sandbox rule)."""
    with tempfile.TemporaryDirectory(prefix="palette-chrome-") as prof:
        cmd = [chrome, "--headless=new", "--disable-gpu", "--no-first-run",
               f"--user-data-dir={prof}", "--allow-file-access-from-files", "--hide-scrollbars",
               "--virtual-time-budget=6000", "--run-all-compositor-stages-before-draw"]
        if os.environ.get("CI") or os.environ.get("PALETTE_NO_SANDBOX"):
            cmd.append("--no-sandbox")
        cmd += ["--dump-dom", pathlib.Path(path).as_uri()]
        try:
            done = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  timeout=300)
        except (OSError, subprocess.TimeoutExpired) as e:
            raise Fail(f"cannot run Chrome for the text layer: {e}")
    return done.stdout.decode("utf-8", errors="replace")


def inject(source, extractor, base=None):
    """The page source with the hide stylesheet and the extractor added inside <head>."""
    tags = (f'<style id="palette-hide">{HIDE_CSS}</style><script id="palette-extract">'
            + extractor.replace("</script", "<\\/script") + "</script>")
    if base:
        tags = f"<base href={quoteattr(base)}>" + tags
    comments = [m.span() for m in re.finditer(r"<!--.*?-->", source, re.S)]
    for pat in (r"<head\b[^>]*>", r"<html\b[^>]*>", r"<!doctype[^>]*>"):
        for m in re.finditer(pat, source, re.I):
            if not any(a <= m.start() < b for a, b in comments):
                return source[:m.end()] + tags + source[m.end():]
    return tags + source


def editable_copy(html, tmp):
    """Write the instrumented copy. Next to the original, so every relative link and check.js's
    path test behave the same; in tmp with a <base> when that folder cannot be written."""
    js_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "extract_text.js")
    try:
        with open(js_path, encoding="utf-8") as f:
            extractor = f.read()
    except OSError:
        raise Fail(f"extract_text.js not found next to pptx.py ({js_path})")
    with open(html, "rb") as f:
        source = f.read().decode("utf-8", errors="replace")
    folder, base = os.path.dirname(html), os.path.basename(html)
    stem = f".{os.path.splitext(base)[0]}.editable-{os.getpid()}"
    for where, href in ((folder, None), (tmp, pathlib.Path(folder).as_uri() + "/")):
        path = os.path.join(where, stem + ".html")
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(inject(source, extractor, href))
            return path, stem
        except OSError:
            continue
    raise Fail("cannot write the temporary copy for --editable")


def read_text_layer(dom):
    """The extractor's pages from a dumped DOM, or a Fail saying why there are none."""
    found = TEXT_JSON.findall(dom)
    if not found:
        raise Fail("the page did not report its text (no palette-text element in the DOM)")
    try:
        data = json.loads(found[-1])
    except ValueError as e:
        raise Fail(f"the page's text report is not valid JSON ({e})")
    if data.get("error"):
        raise Fail("extract_text.js failed: " + str(data["error"]).splitlines()[0])
    return data.get("pages") or []


def text_mismatch(text, pngs):
    """Why the extracted pages cannot be laid over these PNGs, or None when they can."""
    if len(text) != len(pngs):
        return f"{len(text)} page containers in the rendered page but {len(pngs)} PNGs"
    for i, (page, png) in enumerate(zip(text, pngs), 1):
        w, h = png_size(png)
        if not page.get("w") or not page.get("h"):
            return f"page {i} has no size"
        if abs(page["w"] * h - page["h"] * w) > 0.01 * page["w"] * h:
            return f"page {i} is {page['w']:g}x{page['h']:g} CSS px but its PNG is {w}x{h}"
    return None


def typeface(family):
    key = " ".join(family.lower().split())
    if key in GENERIC_FONTS:
        return None
    return FONT_MAP.get(key, BAD_XML.sub("", family).strip() or None)


def weight_of(run, named):
    """(typeface suffix, bold flag). Named (the default): the weight goes in the family name
    the way Google Slides writes its own decks ("Inter Medium", "Inter SemiBold"). Plain: bold
    from 600, regular below."""
    wt = int(run.get("wt") or (700 if run.get("b") else 400))
    if not named:
        return "", wt >= 600
    step = min(WEIGHT_NAMES, key=lambda w: abs(w - wt))
    return WEIGHT_NAMES[step], step == 700


def run_props(run, e, named=True):
    """<a:rPr> for one run; e is EMU per CSS px (12700 EMU = 1pt, sz and spc are 1/100 pt)."""
    suffix, bold = weight_of(run, named)
    size = run["sz"] / (SUPER_SCALE if run.get("v") else 1)
    attrs = [f'sz="{min(400000, max(100, round(size * e / 127)))}"',
             f'b="{1 if bold else 0}"', f'i="{1 if run.get("i") else 0}"']
    if run.get("u"):
        attrs.append('u="sng"')
    if run.get("s"):
        attrs.append('strike="sngStrike"')
    spc = round(run.get("ls", 0) * e / 127)
    if spc:
        attrs.append(f'spc="{max(-400000, min(400000, spc))}"')
    if run.get("v"):
        attrs.append(f'baseline="{30000 if run["v"] > 0 else -25000}"')
    color = run.get("c", "")
    fill = (f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
            if re.fullmatch(r"[0-9A-F]{6}", color) else "")
    face = typeface(run.get("f", ""))
    fonts = ""
    if face:
        q = quoteattr(face + suffix)
        fonts = f'<a:latin typeface={q}/><a:ea typeface={q}/><a:cs typeface={q}/>'
    return f'<a:rPr lang="en-US" {" ".join(attrs)} dirty="0">{fill}{fonts}</a:rPr>'


def text_boxes(page, ox, oy, pw, named=True):
    """The <p:sp> text boxes of one slide. page is one extractor page, (ox, oy) the picture's
    corner and pw its width in EMU, so the boxes follow a fitted (not full-bleed) picture too."""
    e = pw / page["w"]
    out = []
    for n, blk in enumerate(page.get("blocks") or [], 3):
        runs = [r for r in blk.get("runs") or [] if r.get("br") or clean_run(r.get("t", ""))]
        if not any("t" in r for r in runs):
            continue
        height, lines = max(blk.get("H") or 0, 1.0), max(int(blk.get("n") or 1), 1)
        pitch = blk.get("lh") or height
        pct = min(5.0, max(0.5, pitch / height))
        top = blk["top"] + ((1 - pct) * TIGHT_LIFT * height if pct < 1 else 0)
        x, w, align = blk["x"], max(blk.get("w") or 0, 1.0), blk.get("align", "l")
        # Google Slides has no letter-spacing and drops it on import, so tightly tracked text
        # sets wider there: give the box the width the longest line gains without tracking.
        lost = sum(max(0.0, -(r.get("ls") or 0)) * len(r["t"]) for r in runs if "t" in r)
        floor, share = WIDEN_PARA if lines > 1 else WIDEN_LINE
        if lines > 1:
            lost *= min(1.0, 1.15 * (blk.get("mx") or 1.0))
        if lines > 1:
            pad = max(floor, share * w) + lost
        else:                      # only as wide as the line needs; many boxes are already wider
            line = min(blk.get("tw") or w, w)
            pad = max(0.0, line + max(floor, share * line) + lost - w)
        if align == "ctr":
            x, w = x - pad / 2, w + pad
        elif align == "r":
            x, w = x - pad, w + pad
        else:
            w += pad
        box = (ox + round(x * e), oy + round(top * e), round(w * e),
               round((lines * pitch + 0.25 * height) * e))
        body, last = [], ""
        for r in runs:
            if r.get("br"):
                body.append(f"<a:br>{last}</a:br>" if last else "<a:br/>")
                continue
            last = run_props(r, e, named)
            body.append(f'<a:r>{last}<a:t>{escape(clean_run(r["t"]))}</a:t></a:r>')
        indent = round((blk.get("indent") or 0) * e)
        ppr = (f'<a:pPr marL="0" indent="{indent}" algn="{align}" rtl="0">'
               f'<a:lnSpc><a:spcPct val="{round(pct * 100000)}"/></a:lnSpc>'
               '<a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft>'
               '<a:buNone/></a:pPr>')
        out.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{n}" name="Text {n - 2}"/><p:cNvSpPr txBox="1"/>'
            f'<p:nvPr/></p:nvSpPr><p:spPr>{xfrm(box)}<a:prstGeom prst="rect"><a:avLst/>'
            '</a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>'
            f'<p:txBody><a:bodyPr wrap="{"square" if lines > 1 else "none"}" lIns="0" tIns="0" '
            'rIns="0" bIns="0" anchor="t" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>'
            f'<a:p>{ppr}{"".join(body)}</a:p></p:txBody></p:sp>')
    return "".join(out)


def clean_run(text):
    """Run text as XML allows it. Inner spaces are kept: they sit between runs."""
    return BAD_XML.sub("", text).replace("\t", " ").replace("\n", " ").replace("\r", "")


def run_render(html, into, scale):
    """render.sh into a folder. True when its layout check failed (exit 2)."""
    render = os.path.join(os.path.dirname(os.path.realpath(__file__)), "render.sh")
    if not os.path.isfile(render):
        raise Fail(f"render.sh not found next to pptx.py ({render})")
    sys.stdout.flush()
    try:
        rc = subprocess.run(["bash", render, html, into, scale]).returncode
    except OSError as e:
        raise Fail(f"cannot run render.sh: {e.strerror}")
    if rc not in (0, 2):
        raise Fail(f"render.sh failed (exit {rc}); no deck written")
    return rc == 2


def render_editable(html, tmp, scale):
    """Render the text-free pages and read the text layer.
    Returns (pngs, text pages, layout check failed); raises Fail when there is no text layer."""
    chrome = find_chrome()
    if not chrome or not os.access(chrome, os.X_OK):
        raise Fail("Chrome or Chromium not found; set CHROME=/path/to/chrome")
    work, stem = editable_copy(html, tmp)
    try:
        text = read_text_layer(dump_dom(chrome, work))
        failed = run_render(work, tmp, scale)
    finally:
        try:
            os.remove(work)
        except OSError:
            pass
    pngs = find_pngs(tmp, stem)
    if not pngs:
        raise Fail("render.sh wrote no PNGs")
    why = text_mismatch(text, pngs)
    if why:
        raise Fail(why)
    return pngs, text, failed


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

With --editable (aimed first at Google Slides, which imports .pptx):
  Each slide is a text-free picture of the page (cards, tiles, icons, orbs, CSS counters and
  quote marks, and the charts with their own labels) with one editable text box per block of
  HTML text on top, matched to the render: position, font, size, bold, colour, letter-spacing,
  line-height, alignment, and separate runs for inline changes (the grey headline clause).
  One-line blocks have wrapping off; wrapped blocks keep it on with a little slack.
  The text is editable and re-flows when edited. Shapes and charts are NOT editable: they are
  a picture underneath and do not move with the text. Chart labels stay in the picture.
  Fonts are named, not embedded: Inter stays Inter (Google Slides has it; elsewhere it must be
  installed or the app substitutes and text re-wraps), Geist Mono is written as Roboto Mono.
  Weights are written as family names ("Inter Medium", "Inter SemiBold"), which Google Slides
  resolves and which match the PDF. For an app that does not know those families use
  --plain-weights: plain Inter, bold from weight 600, regular below (500 sets lighter and 600
  heavier than the PDF, so wraps can move by a word). Google Slides drops letter-spacing, so
  tight headlines set about 5% wider there; the boxes leave room. Small wrap and position
  differences from the PDF are possible. If the text layer cannot be built the deck falls back
  to picture slides and says so. Cannot be combined with --from.

Exit codes: 0 deck written; 2 deck written but render.sh's layout check failed; 1 error.""")
    p.add_argument("html", metavar="file.html", help="the palette HTML file")
    p.add_argument("outdir", nargs="?", help="where to write <name>.pptx (default: next to the html)")
    p.add_argument("scale", nargs="?", default="2", help="PNG scale for render.sh (default 2)")
    p.add_argument("--from", dest="from_dir", metavar="DIR",
                   help="use the PNGs already in DIR (<name>.png or <name>-01.png ...) "
                        "instead of running render.sh")
    p.add_argument("--editable", action="store_true",
                   help="editable text boxes over a text-free picture of each page, for "
                        "Google Slides (shapes and charts stay a picture; see below)")
    p.add_argument("--plain-weights", action="store_true",
                   help="with --editable: regular or bold only (bold from weight 600), for "
                        "apps without named families such as Inter SemiBold (see below)")
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

    if args.plain_weights and not args.editable:
        raise Fail("--plain-weights only applies with --editable")
    if args.editable and args.from_dir:
        raise Fail("--editable renders its own text-free pages; it cannot be combined with --from")

    layout_failed, text = False, None
    with tempfile.TemporaryDirectory(prefix="palette-pptx-") as tmp:
        pngs = []
        if args.from_dir:
            src = os.path.abspath(args.from_dir)
            if not os.path.isdir(src):
                raise Fail(f"no such folder: {args.from_dir}")
            pngs = find_pngs(src, name)
        else:
            src = tmp
            if args.editable:
                try:
                    pngs, text, layout_failed = render_editable(html, tmp, args.scale)
                except Fail as e:
                    warn(f"no editable text layer ({e}); writing picture slides instead")
                    src = os.path.join(tmp, "plain")
                    os.makedirs(src)
            if text is None:
                layout_failed = run_render(html, src, args.scale)
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
        cx, cy = write_pptx(out_path, pngs, title or name, notes, text, not args.plain_weights)

    print(f"pptx:  {out_path}")
    if text is not None:
        boxes = sum(len(p.get("blocks") or []) for p in text)
        kind = (f"{boxes} editable text boxes over text-free pictures (shapes, charts and "
                "chart labels are not editable)")
    else:
        kind = "slides are pictures (text is not editable)"
    print(f"       {len(pngs)} slide{'s' if len(pngs) != 1 else ''}, "
          f"{cx / 914400:.3f}in x {cy / 914400:.3f}in, "
          f"notes {'from the HTML text' if notes else 'empty'}; "
          f"{kind}, the HTML stays the source")
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
