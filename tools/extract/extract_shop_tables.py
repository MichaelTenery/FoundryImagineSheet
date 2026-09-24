#!/usr/bin/env python3
"""
extract_shop_tables.py -- his shop: what can be bought, and what it costs, out of his sheet.

Build-time tooling. Not shipped with the Foundry system.

His Equipment tab has an ADD/BUY ITEMS panel (ImagineTabbedCharacterSheet.html, "ITEM TYPE DIVS START
HERE" to "END ADD EQUIPMENT", about lines 17783-18672). A Type select picks Armor/Clothing, Weapon or
Equipment; under each, a radio per kind of thing (Apparel, Blades, Containers ... 79 of them) with its
own select of item names. Choosing an item fires his setCostAndType (sheet-worker.js:72846), which looks
the name up in one of three price dictionaries and shows all seven prices:

    weaponcostlist      getWeaponCost      sheet-worker.js:76678
    equipmentcostlist   getEquipmentCost   sheet-worker.js:77291
    armorcostlist       getArmorCost       sheet-worker.js:77918

each row seven prices under his header comment "1/4 low  1/2 low  low  med  high  double  triple".

This writes all four -- the panel's lists and the three dictionaries -- to module/shop-tables.mjs, so
the character generator's Equipment step (module/shop-rules.mjs) sells exactly what his panel sells at
exactly his prices, and a corrected sheet is one re-run away.

READ FROM sheet-worker.js, AS UTF-8. src/packs/raw/*costlist.json holds the same three dictionaries
(parse_dictionaries.py), but the sheet is his, and reading it directly keeps this one step from it. His
own spelling is kept -- ’ and “ included; module/shop-rules.mjs normalizeItemName is what matches
it to the pack documents, which spell some names with ' where he wrote ’ or a backtick.

DUPLICATE KEYS. A JavaScript object literal keeps the LAST of two rows with the same name, and eight of
his rows are repeated (two weapons, five equipment, one armour; the report below counts them) -- some
with different prices, Boots(Leather) among them. The table written here keeps the one his sheet
actually uses, and writes the other out as a comment saying so.

Usage:
    python tools/extract/extract_shop_tables.py
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORKER = os.path.join(ROOT, "docs", "reference", "sheet-worker.js")
SHEET = os.path.join(ROOT, "ImagineRoll20CharacterSheet-main", "ImagineTabbedCharacterSheet.html")
OUT = os.path.join(ROOT, "module", "shop-tables.mjs")

# His seven columns, in his order, as his header comment names them.
COLUMN_LABELS = ["1/4 low", "1/2 low", "low", "med", "high", "double", "triple"]

# The three item-type blocks of his panel, and the Type select value each belongs to.
PANEL_BLOCKS = [
    # his div class              his Type value
    ("add_armor_clothing",       "Armor"),
    ("add_weapons",              "Weapon"),
    ("add_general_equipment",    "Equipment"),
]

# The three price dictionaries: his function, the constant it is written to, and the Type it prices.
COST_TABLES = [
    # his function         constant written      Type
    ("getWeaponCost",      "WEAPON_COSTS",       "Weapon"),
    ("getEquipmentCost",   "EQUIPMENT_COSTS",    "Equipment"),
    ("getArmorCost",       "ARMOR_COSTS",        "Armor"),
]


# @MARKER THE PANEL

def read_panel():
    """
    His three item-type blocks as {Type: [(radio value, label, [option values in his order]), ...]},
    and the first and last line of the panel for the header.

    The option VALUE is what his add_item reads, so that is what is kept. One option's text differs
    from its value -- 'Arrow(Fairy Crossbow/True Flight)' is written with a stray leading quote in
    its visible text -- and the value is the right one.
    """
    tmplines = open(SHEET, encoding="utf-8").read().split("\n")
    tmpstart = next(i for i, l in enumerate(tmplines) if "<!--ITEM TYPE DIVS START HERE-->" in l)
    tmpend = next(i for i, l in enumerate(tmplines) if i > tmpstart and "<!--END ADD EQUIPMENT-->" in l)
    tmpsegment = "\n".join(tmplines[tmpstart:tmpend])

    tmptypes = dict(PANEL_BLOCKS)
    tmpout = {tmptype: [] for (_, tmptype) in PANEL_BLOCKS}
    tmpcurrent = None
    tmpradio = None
    for m in re.finditer(r'<div class="sheet-(add_\w+)'
                         r'|<input type="radio"[^>]*value="([^"]*)"[^>]*><b>([^<]*):</b>'
                         r'|<select name="attr_(\w+)"[^>]*>(.*?)</select>', tmpsegment, re.S):
        if m.group(1):
            tmpcurrent = tmptypes.get(m.group(1))
        elif m.group(2) is not None:
            tmpradio = (m.group(2), m.group(3))
        elif m.group(4) and tmpcurrent and tmpradio:
            tmpoptions = [o for o in re.findall(r'<option value="([^"]*)"', m.group(5)) if o]
            tmpout[tmpcurrent].append((tmpradio[0], tmpradio[1], tmpoptions))
            tmpradio = None
    return tmpout, tmpstart + 1, tmpend + 1


# @MARKER THE PRICE DICTIONARIES

def read_costs(tmpfunction):
    """
    One of his price dictionaries as a list of (name, [seven prices], line number), in his order,
    duplicates included, plus the line the function starts on.
    """
    tmplines = open(WORKER, encoding="utf-8").read().split("\n")
    tmpstart = next(i for i, l in enumerate(tmplines) if re.match(r"\s*function %s\s*\(" % tmpfunction, l))
    tmpopen = next(i for i in range(tmpstart, tmpstart + 5) if re.search(r"const \w+costlist\s*=\s*\{", tmplines[i]))
    tmprows = []
    tmpj = tmpopen + 1
    while not re.match(r"\s*\};", tmplines[tmpj]):
        m = re.match(r'\s*"([^"]*)"\s*:\s*\[(.*)\]', tmplines[tmpj])
        if m:
            tmprows.append((m.group(1), re.findall(r'"([^"]*)"', m.group(2)), tmpj + 1))
        elif tmplines[tmpj].strip():
            raise SystemExit("unreadable price row at sheet-worker.js:%d: %s" % (tmpj + 1, tmplines[tmpj].strip()))
        tmpj += 1
    return tmprows, tmpstart + 1, tmpj + 1


# @MARKER CHECKS
# The same reading module/shop-rules.mjs parsePrice gives, kept deliberately simple: a price is a
# whole number and one of his four coins. Anything else is reported, not corrected -- the correcting
# is done (and tested) in shop-rules.mjs, where the ruling on each typo is written down.
COPPER = {"cp": 1, "sp": 10, "gp": 100, "pp": 1000}


def in_copper(tmpprice):
    m = re.match(r"^\s*(\d+)\s*(cp|sp|gp|pp)\s*$", tmpprice)
    return int(m.group(1)) * COPPER[m.group(2)] if m else None


def report(tmptables, tmppanel):
    tmpissues = []
    for (tmpconst, tmprows) in tmptables:
        for (tmpname, tmpprices, tmpline) in tmprows:
            if len(tmpprices) != 7:
                tmpissues.append("%s %s (line %d) has %d prices, not 7" % (tmpconst, tmpname, tmpline, len(tmpprices)))
            for tmpprice in tmpprices:
                if in_copper(tmpprice) is None:
                    tmpissues.append("%s %s (line %d): malformed price %r" % (tmpconst, tmpname, tmpline, tmpprice))
    tmpdisorder = []
    for (tmpconst, tmprows) in tmptables:
        for (tmpname, tmpprices, tmpline) in tmprows:
            tmpvalues = [in_copper(p) for p in tmpprices]
            if None in tmpvalues:
                continue
            if any(tmpvalues[i] > tmpvalues[i + 1] for i in range(6)):
                # "at Medium": the default level's price is itself out of step with Low or High
                tmpatmedium = tmpvalues[2] > tmpvalues[3] or tmpvalues[3] > tmpvalues[4]
                tmpdisorder.append("%s%s %s (line %d): %s" % ("AT MEDIUM " if tmpatmedium else "", tmpconst,
                                   tmpname, tmpline, ", ".join(tmpprices)))
    tmpsubtypes = sum(len(v) for v in tmppanel.values())
    tmpoffers = set((t, o) for t, v in tmppanel.items() for (_, _, opts) in v for o in opts)
    print("  panel: %d subtypes (%s), %d distinct offers" % (tmpsubtypes,
          "/".join(str(len(tmppanel[t])) for (_, t) in PANEL_BLOCKS), len(tmpoffers)))
    for (tmpconst, tmprows) in tmptables:
        print("  %s: %d rows, %d distinct names" % (tmpconst, len(tmprows), len(set(r[0] for r in tmprows))))
    # The rows written out as DUPLICATE comments: every row after the first of its name. Printed, name by
    # name and with whether the prices differ, so the count in the prose can be checked against it.
    tmpduplicates = []
    for (tmpconst, tmprows) in tmptables:
        tmpfirst = {}
        for (tmpname, tmpprices, tmpline) in tmprows:
            if tmpname in tmpfirst:
                tmpduplicates.append("%s %s (lines %d and %d)%s" % (tmpconst, tmpname, tmpfirst[tmpname][1], tmpline,
                                     "" if tmpfirst[tmpname][0] == tmpprices else ": the prices differ"))
            else:
                tmpfirst[tmpname] = (tmpprices, tmpline)
    print("  duplicate rows (JavaScript keeps the later): %d" % len(tmpduplicates))
    for tmpline in tmpduplicates:
        print("    " + tmpline)
    print("  malformed prices: %d" % len(tmpissues))
    for tmpline in tmpissues:
        print("    " + tmpline)
    print("  rows out of order across the seven columns: %d (%d at Medium)" % (len(tmpdisorder),
          sum(1 for d in tmpdisorder if d.startswith("AT MEDIUM"))))
    for tmpline in tmpdisorder:
        print("    " + tmpline)


# @MARKER WRITING

def js(tmptext):
    return '"' + tmptext.replace("\\", "\\\\").replace('"', '\\"') + '"'


def wrap_names(tmpnames, tmpindent, tmpwidth=112):
    """His option names as JavaScript strings, as many to a line as fit."""
    tmplines, tmpcurrent = [], ""
    for tmpname in tmpnames:
        tmppiece = js(tmpname) + ","
        if tmpcurrent and len(tmpindent) * 4 + len(tmpcurrent) + 1 + len(tmppiece) > tmpwidth:
            tmplines.append(tmpindent + tmpcurrent)
            tmpcurrent = tmppiece
        else:
            tmpcurrent = (tmpcurrent + " " + tmppiece) if tmpcurrent else tmppiece
    if tmpcurrent:
        tmplines.append(tmpindent + tmpcurrent)
    if tmplines:
        tmplines[-1] = tmplines[-1].rstrip(",")
    return tmplines


def write_costs(tmpout, tmpconst, tmpfunction, tmprows, tmpfirst, tmplast):
    # JavaScript keeps the LAST of two rows with one name; that is the one kept here.
    tmplastline = {}
    for (tmpname, _, tmpline) in tmprows:
        tmplastline[tmpname] = tmpline
    # His layout: the name, padded to one column, then '[ "4 gp",  "7 gp", ... ]' with every price
    # starting under its heading.
    tmpnamewidth = max(len(js(r[0])) for r in tmprows) + 2
    tmpcellwidth = max(len(js(p)) for r in tmprows for p in r[1]) + 3
    tmpheader = "".join(tmplabel.ljust(tmpcellwidth) for tmplabel in COLUMN_LABELS).rstrip()
    tmpout.append("")
    tmpout.append("\t// @MARKER %s" % tmpconst.replace("_", " "))
    tmpout.append("\t// His %s, %s (sheet-worker.js:%d-%d), row for row and in his order. A name his"
                  % (tmpfunction.replace("get", "").replace("Cost", "").lower() + "costlist", tmpfunction, tmpfirst, tmplast))
    tmpout.append("\t// panel sells but this table lacks costs [\"0\" x7] on his sheet, which cannot be paid.")
    tmpout.append("\texport const %s = {" % tmpconst)
    tmpout.append("\t\t// " + "name".ljust(tmpnamewidth - 3) + "  " + tmpheader)
    for (tmpname, tmpprices, tmpline) in tmprows:
        tmpcells = "".join((js(p) + ("," if tmpi < len(tmpprices) - 1 else "")).ljust(tmpcellwidth)
                           for tmpi, p in enumerate(tmpprices)).rstrip()
        tmprow = (js(tmpname) + ":").ljust(tmpnamewidth) + "[ " + tmpcells + " ]"
        if tmplastline[tmpname] != tmpline:
            tmpout.append("\t\t// " + tmprow + "   // line %d: DUPLICATE -- his later row at line %d is the one"
                          " JavaScript keeps" % (tmpline, tmplastline[tmpname]))
            continue
        tmpout.append("\t\t" + tmprow + ",")
    # the last real row loses its comma
    for tmpi in range(len(tmpout) - 1, -1, -1):
        if tmpout[tmpi].startswith("\t\t\"") and tmpout[tmpi].endswith(","):
            tmpout[tmpi] = tmpout[tmpi][:-1]
            break
    tmpout.append("\t};")


def main():
    tmppanel, tmppanelfirst, tmppanellast = read_panel()
    tmptables = []
    tmpspans = {}
    for (tmpfunction, tmpconst, _) in COST_TABLES:
        tmprows, tmpfirst, tmplast = read_costs(tmpfunction)
        tmptables.append((tmpconst, tmprows))
        tmpspans[tmpconst] = (tmpfunction, tmpfirst, tmplast)

    tmpout = []
    tmpout.append("// @START (CODE)")
    tmpout.append("// @MARKER SHOP TABLES")
    tmpout.append("//" + "=" * 114)
    tmpout.append("// GENERATED FILE -- do not edit by hand.")
    tmpout.append("// Produced by tools/extract/extract_shop_tables.py from his Roll20 sheet: the markup of his ADD/BUY ITEMS")
    tmpout.append("// panel (ImagineTabbedCharacterSheet.html:%d-%d) and his three price dictionaries in sheet-worker.js."
                  % (tmppanelfirst, tmppanellast))
    tmpout.append("// Regenerate rather than editing, or this will drift from his sheet.")
    tmpout.append("//")
    tmpout.append("// His spelling is kept exactly -- ’ and “ included -- so a row can be found in his sheet by searching for")
    tmpout.append("// it. module/shop-rules.mjs normalizeItemName is what matches these names to the pack documents, and")
    tmpout.append("// the rulings on his typos, bundles and name slips are made there, not here.")
    tmpout.append("//" + "=" * 114)
    tmpout.append("")
    tmpout.append("\t// @MARKER SHOP CATEGORIES")
    tmpout.append("\t// His panel, type by type: each radio (its value, which his add_item switches on, and its visible")
    tmpout.append("\t// label), and the names in its select, in his order. A name may sit under two radios -- Boots(Leather)")
    tmpout.append("\t// is both Apparel and Boots -- and is the same item under both.")
    tmpout.append("\texport const SHOP_CATEGORIES = {")
    tmpout.append("\t\t// Type: [ [radio value, his label, [the names his select offers]], ... ]")
    for (tmpblockindex, (_, tmptype)) in enumerate(PANEL_BLOCKS):
        tmpout.append("\t\t%s: [" % js(tmptype))
        for (tmpsubindex, (tmpvalue, tmplabel, tmpoptions)) in enumerate(tmppanel[tmptype]):
            tmpout.append("\t\t\t[%s, %s, [" % (js(tmpvalue), js(tmplabel)))
            tmpout.extend(wrap_names(tmpoptions, "\t\t\t\t"))
            tmpout.append("\t\t\t]]" + ("," if tmpsubindex < len(tmppanel[tmptype]) - 1 else ""))
        tmpout.append("\t\t]" + ("," if tmpblockindex < len(PANEL_BLOCKS) - 1 else ""))
    tmpout.append("\t};")

    for (tmpconst, tmprows) in tmptables:
        tmpfunction, tmpfirst, tmplast = tmpspans[tmpconst]
        write_costs(tmpout, tmpconst, tmpfunction, tmprows, tmpfirst, tmplast)

    tmpout.append("")
    tmpout.append("// @END (CODE)")
    tmpout.append("")
    with open(OUT, "w", encoding="utf-8", newline="\n") as tmpfile:
        tmpfile.write("\n".join(tmpout))

    print("wrote " + os.path.relpath(OUT, ROOT))
    report(tmptables, tmppanel)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
