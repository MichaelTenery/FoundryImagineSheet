#!/usr/bin/env python3
"""
extract_natural_attacks.py -- pull every race's natural attacks out of the sheet-worker and write
src/packs/named/naturalAttacks.json.

Build-time tooling. Not shipped with the Foundry system.

His natural attacks are not a dictionary. They are one switch, setRacialNaturalAttacks
(sheet-worker.js:100946), which writes up to ten numbered slots per race straight onto the sheet:

    natural_attackN_name      "Claws"
    natural_attackN_type      "Cut", "Pierce", "Smash", "Crush", "Constrict", "Touch"...
    natural_attackN_speed     a literal, or tmpSpeed -- see below
    natural_attackN_min       a literal, or tmpMinSpeed
    natural_attackN_damage    "2d4+1"
    natural_attackN_special   "None", or a rider in words
    natural_attacks_list      the names again, comma separated -- used here as a CROSS-CHECK

HOW SPEED IS WRITTEN. Two ways, and the difference is his:

    setAttrs({natural_attack1_speed: 2 });          a fixed speed, never shortened
    tmpSpeed=5; tmpMinSpeed=3;                       a speed shortened by the character's own
    tmpSpeed=tmpSpeed+combatModSpeed+stanceSpeedMod; speed modifier and martial stance, never
    if (tmpSpeed<tmpMinSpeed) { ... }               below the minimum -- which is exactly what
    setAttrs({natural_attack1_speed: tmpSpeed });   a weapon's speed and minimum already do

TWO RACES BRANCH, and both are carried rather than flattened:
    Apocritara   the Stinger exists only in the slight-physique branch (`physique: "slight"`)
    Se'eth       the Fangs' venom is his getPoisonByTitle(title), so it grows with the
                 character. The whole title table is written out beside the attacks.

FAMORIAN is not here: its attacks come from the evokes it has taken, through a separate function
(setFamorianNaturalAttacks). That is recorded in the output and left for its own pass.

Anything that does not parse is reported rather than dropped quietly.

Usage:
    python extract_natural_attacks.py
"""

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
WORKER = os.path.join(ROOT, "docs", "reference", "sheet-worker.js")
OUT = os.path.join(ROOT, "src", "packs", "named", "naturalAttacks.json")

lines = open(WORKER, encoding="utf-8", errors="replace").readlines()
problems = []


def function_body(name):
    """(first line number, lines) for a function, taking the LAST declaration as JavaScript does."""
    starts = [i for i, l in enumerate(lines)
              if re.match(r'\s*function %s\s*\(' % re.escape(name), l)]
    if not starts:
        raise SystemExit("function not found: " + name)
    i = starts[-1]
    depth, out = 0, []
    for j in range(i, len(lines)):
        out.append(lines[j])
        depth += lines[j].count("{") - lines[j].count("}")
        if depth <= 0 and j > i:
            return i + 1, out
    raise SystemExit("unterminated function: " + name)


# @MARKER PATTERNS
CASE     = re.compile(r'^\s*case\s+"([^"]*)"\s*:')
DEFAULT  = re.compile(r'^\s*default\s*:')
BREAK    = re.compile(r'^\s*break\s*;')
TMPSPEED = re.compile(r'^\s*tmpSpeed\s*=\s*(\d+)\s*;')
TMPMIN   = re.compile(r'^\s*tmpMinSpeed\s*=\s*(\d+)\s*;')
SLOT     = re.compile(r'setAttrs\(\{\s*natural_attack(\d+)_(name|type|speed|min|damage|special)\s*:\s*(.+?)\s*\}\)')
LIST     = re.compile(r'setAttrs\(\{\s*natural_attacks_list\s*:\s*"([^"]*)"\s*\}\)')
SLIGHTIF = re.compile(r'if\s*\(\s*tmpSlightPhysique\s*==\s*"yes"\s*\)')
ELSE     = re.compile(r'\}\s*else\s*\{')
FAMORIAN = re.compile(r'setFamorianNaturalAttacks\s*\(')


def read_value(tmpraw, tmpspeed, tmpmin, where):
    """One right-hand side from his setAttrs: a string literal, a number, tmpSpeed / tmpMinSpeed,
    or "literal"+posionString (the title venom). Returns (value, usesTmpSpeed, usesVenom)."""
    tmpraw = tmpraw.strip()
    tmpmatch = re.match(r'^"([^"]*)"\s*\+\s*posionString$', tmpraw)
    if tmpmatch:
        return tmpmatch.group(1), False, True
    tmpmatch = re.match(r'^"([^"]*)"$', tmpraw)
    if tmpmatch:
        return tmpmatch.group(1), False, False
    if re.match(r'^-?\d+$', tmpraw):
        return int(tmpraw), False, False
    if tmpraw == "tmpSpeed":
        if tmpspeed is None:
            problems.append("%s: tmpSpeed read before it was set" % where)
        return tmpspeed, True, False
    if tmpraw == "tmpMinSpeed":
        if tmpmin is None:
            problems.append("%s: tmpMinSpeed read before it was set" % where)
        return tmpmin, True, False
    problems.append("%s: unreadable value %r" % (where, tmpraw))
    return None, False, False


def walk_natural_attacks():
    tmpstart, tmpbody = function_body("setRacialNaturalAttacks")
    tmpentries = {}      # race -> [attack]
    tmplists = {}        # race -> {physique: "a,b,c"} from his natural_attacks_list
    tmpnone = []         # races his switch names as having none
    tmpdeferred = []     # races whose attacks come from elsewhere

    tmplabels, tmpgroupopen = [], False
    tmpslots = {}        # slot number -> attack being built
    tmpspeed = tmpmin = None
    tmpbranch = ""       # "", "slight" or "ordinary"
    tmpbranchdepth = None
    tmpdepth = 0
    tmpisdefault = False

    def close_group(tmplineno):
        # A group ends at its break. Every label that fell through to it shares what it wrote.
        if not tmplabels:
            return
        tmpattacks = [tmpslots[k] for k in sorted(tmpslots)]
        for tmplabel in tmplabels:
            if tmpisdefault or (not tmpattacks and tmplabel not in tmpdeferred):
                if tmplabel and tmplabel not in tmpdeferred:
                    tmpnone.append(tmplabel)
                continue
            if tmplabel in tmpdeferred:
                continue
            tmpentries[tmplabel] = [dict(a) for a in tmpattacks]

    for tmpoffset, tmpline in enumerate(tmpbody):
        tmplineno = tmpstart + tmpoffset
        where = "sheet-worker.js:%d" % tmplineno
        tmpcase = CASE.match(tmpline)
        if tmpcase or DEFAULT.match(tmpline):
            if not tmpgroupopen:
                tmplabels, tmpslots, tmpisdefault = [], {}, False
                tmpspeed = tmpmin = None
                tmpgroupopen = True
            if tmpcase:
                tmplabels.append(tmpcase.group(1).replace("`", "'"))
            else:
                tmpisdefault = True
            continue

        if FAMORIAN.search(tmpline):
            tmpdeferred.extend(tmplabels)

        # Physique branches. The brace count is taken AFTER the line, so an if-line opens its
        # branch at the depth it leaves behind and closes when the count falls back below it.
        if SLIGHTIF.search(tmpline):
            tmpbranch = "slight"
            tmpbranchdepth = tmpdepth + 1
        elif ELSE.search(tmpline) and tmpbranch == "slight":
            tmpbranch = "ordinary"

        tmpmatch = TMPSPEED.match(tmpline)
        if tmpmatch:
            tmpspeed = int(tmpmatch.group(1))
        tmpmatch = TMPMIN.match(tmpline)
        if tmpmatch:
            tmpmin = int(tmpmatch.group(1))

        tmpmatch = SLOT.search(tmpline)
        if tmpmatch and tmpgroupopen:
            tmpslot, tmpfield, tmpraw = int(tmpmatch.group(1)), tmpmatch.group(2), tmpmatch.group(3)
            tmpattack = tmpslots.setdefault(tmpslot, {
                "name": "", "type": "", "speed": 0, "minSpeed": 0, "speedAdjusts": False,
                "damage": "", "special": "", "venomByTitle": False, "physique": tmpbranch})
            tmpvalue, tmpadjusts, tmpvenom = read_value(tmpraw, tmpspeed, tmpmin, where)
            if tmpfield == "name":
                tmpattack["name"] = tmpvalue
                tmpattack["physique"] = tmpbranch
            elif tmpfield == "type":
                tmpattack["type"] = tmpvalue
            elif tmpfield == "speed":
                tmpattack["speed"] = tmpvalue
                tmpattack["speedAdjusts"] = tmpadjusts
            elif tmpfield == "min":
                tmpattack["minSpeed"] = tmpvalue
            elif tmpfield == "damage":
                tmpattack["damage"] = tmpvalue
            elif tmpfield == "special":
                tmpattack["special"] = "" if tmpvalue == "None" else tmpvalue
                tmpattack["venomByTitle"] = tmpvenom

        tmpmatch = LIST.search(tmpline)
        if tmpmatch and tmpgroupopen:
            for tmplabel in tmplabels:
                tmplists.setdefault(tmplabel, {})[tmpbranch] = tmpmatch.group(1)

        tmpdepth += tmpline.count("{") - tmpline.count("}")
        if tmpbranchdepth is not None and tmpdepth < tmpbranchdepth:
            tmpbranch, tmpbranchdepth = "", None

        if BREAK.match(tmpline) and tmpgroupopen:
            close_group(tmplineno)
            tmpgroupopen = False
            tmplabels = []

    return tmpentries, tmplists, sorted(set(tmpnone)), sorted(set(tmpdeferred))


def cross_check(tmpentries, tmplists):
    """His natural_attacks_list names every attack a branch gives. The slots walked above must
    say the same thing, branch for branch, or something was misread."""
    for tmprace, tmpattacks in tmpentries.items():
        for tmpbranch, tmplisted in tmplists.get(tmprace, {}).items():
            tmpwant = [n.strip() for n in tmplisted.split(",") if n.strip()]
            # An unbranched attack belongs to both physiques; a branched one only to its own.
            tmpgot = [a["name"] for a in tmpattacks if a["physique"] in ("", tmpbranch)]
            if tmpgot != tmpwant:
                problems.append("%s (%s branch): slots give %s, his list says %s"
                                % (tmprace, tmpbranch or "only", tmpgot, tmpwant))
        for tmpattack in tmpattacks:
            if not tmpattack["name"] or not tmpattack["damage"] and not tmpattack["type"].endswith("Touch"):
                problems.append("%s: incomplete attack %r" % (tmprace, tmpattack))


def walk_venom_table():
    """getPoisonByTitle: title -> "Type ...-Potency ..." exactly as his card writes it."""
    tmpstart, tmpbody = function_body("getPoisonByTitle")
    tmptable, tmptitle, tmptype = {}, None, ""
    for tmpline in tmpbody:
        tmpmatch = re.match(r'^\s*case\s+(\d+)\s*:', tmpline)
        if tmpmatch:
            tmptitle, tmptype = int(tmpmatch.group(1)), ""
            continue
        tmpmatch = re.search(r'venomType="([^"]*)"', tmpline)
        if tmpmatch and tmptitle is not None:
            tmptype = tmpmatch.group(1)
        tmpmatch = re.search(r'venomPotency="([^"]*)"', tmpline)
        if tmpmatch and tmptitle is not None:
            tmptable[tmptitle] = tmptype + tmpmatch.group(1)
    if sorted(tmptable) != list(range(1, 16)):
        problems.append("getPoisonByTitle: expected titles 1-15, found %s" % sorted(tmptable))
    return tmptable


def main():
    tmpentries, tmplists, tmpnone, tmpdeferred = walk_natural_attacks()
    cross_check(tmpentries, tmplists)
    tmpvenom = walk_venom_table()

    tmppayload = {
        "source": "setRacialNaturalAttacks (sheet-worker.js:100946) and getPoisonByTitle (102578)",
        "entries": tmpentries,
        "venomByTitle": {str(k): v for k, v in sorted(tmpvenom.items())},
        "_noNaturalAttacks": tmpnone,
        "_fromElsewhere": {r: "setFamorianNaturalAttacks -- built from the evokes taken" for r in tmpdeferred},
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(tmppayload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    tmpcount = sum(len(v) for v in tmpentries.values())
    print("natural attacks: %d races, %d attacks; %d races with none; deferred: %s"
          % (len(tmpentries), tmpcount, len(tmpnone), ", ".join(tmpdeferred) or "none"))
    for tmpproblem in problems:
        print("  PROBLEM " + tmpproblem)
    print("wrote " + os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
