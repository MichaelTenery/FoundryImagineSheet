#!/usr/bin/env python3
"""
extract_class_social_skills.py -- each class's Required and Recommended social skills.

Build-time tooling. Not shipped with the Foundry system.

His Step 6 (Social Skills) lists a class's own social skills first -- a checkbox per row, each
"Required" or "Recommend" -- and then one more checkbox with a dropdown of every social skill.
The rows come from one switch:

    setSocialSkillLists(tmpclass)       sheet-worker.js:53591, the switch at 53617-55403

Each case writes three attributes per row -- tmp_social_skill_N_type, _name and _mods -- and then
select_social_skill_sheet, which is how many rows his HTML shows ("social_skill_select_sixteen").
Sage writes "social_skill_select_none" and GME "social_skill_select_special": no class rows, the
whole list only. That is anyList below.

WRITES TWO FILES
    src/packs/named/classSocialSkillLists.json   his switch, walked: {class: {required, recommended, anyList}}
    src/packs/named/classSocialSkillUpTo.json    the books' "up to N": {class: {upTo, page}}, from
                                                 CLASS_SOCIAL_UP_TO below, hand-transcribed with a
                                                 page per row

"UP TO N" IS BOOK-ONLY. His sheet has no pick count at all -- the only cap is Knowledge
(getNumberOfSocialSkillSlots, 55408). The Player's Guide p.47 says what "up to" means: a player
may not choose more until he has rolled on the Additional Social Skills table. So it is carried
beside his lists rather than in them, and a class no local book gives a count for gets none.

HOW A ROW IS READ. By the N inside each attribute NAME, not by line order, and the _mods argument
is ignored -- the port derives the modifier from the skill name, and three of his cases have the
mods column out of step with the names (reported below, harmless here).

WHAT IS CHANGED FROM HIS SWITCH, AND WHY. Printed on every run so nothing moves out of sight:

  1. Witch Hunter (55378). From row 10 on, each _type line names the row BEFORE its _name line
     (tmp_social_skill_10_type is set twice, then 11_type sits beside 12_name, ...), so his last
     name, row 16 "Weapon Making", is given no type at all. Every other row in the case is
     "Recommend"; row 16 is read as Recommend too. Found by the walk, not patched by name -- any
     row whose name has no type is reported and taken as Recommend.
  2. Healer (54353): "Philosophy" becomes "Physiology". His errata for the Master's Manual, p.46
     (Healer Class), Social Skills, says so, and his errata outranks his sheet (the user's ruling of
     2026-09-21). The errata files are local-only and never committed, so the fact is kept HERE,
     in ERRATA_REPAIRS, and a fresh clone builds the same list. When the errata files are present
     the Healer entry is re-read and a disagreement reported.

WHAT IS KEPT AS HE HAS IT, AND REPORTED (upstream questions, not ours to settle):
  - Intercessor (54509) writes select_social_skill_sheet "social_skills_fourteen" -- a main-sheet
    attribute value, not a "social_skill_select_" one -- so on his sheet NOTHING shows in Step 6.
    The mods column is also one row behind the names from row 6, and names "Heraldry", which the
    names column never lists: Heraldry has probably been dropped. The fourteen names are kept.
  - Ranger: the Player's Guide (p.53) lists Animal Training, his sheet does not. Sheet kept.
  - Innominate and Obscuratum carry identical Recommend lists. Kept.

Usage:
    python tools/extract/extract_class_social_skills.py
    python tools/extract/extract_class_social_skills.py --errata "path/to/docs/reference/errata"
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "src", "packs", "raw")
NAMED = os.path.join(ROOT, "src", "packs", "named")
REFERENCE = os.path.join(ROOT, "docs", "reference")
WORKER = os.path.join(REFERENCE, "sheet-worker.js")
ERRATA_DEFAULT = os.path.join(REFERENCE, "errata")

lines = open(WORKER, encoding="utf-8", errors="replace").readlines()


# @MARKER ERRATA REPAIRS
# His errata over his switch. Kept as facts only: the errata files never leave his machine and
# ours. Each row is re-read from the named errata file when it is present.
ERRATA_REPAIRS = [
    # class      his sheet      errata         file       the errata line that says so
    ("Healer",   "Philosophy",  "Physiology",  "MM.txt",  "Philosophy should be Physiology"),
]

# @MARKER ANY-LIST CASES
# The select_social_skill_sheet values that mean "no class rows, the whole list". Sage's is his
# "none"; GME's is "special", which also opens the GME racial-skill select.
ANY_LIST_VALUES = {
    # his select value                  meaning
    "social_skill_select_none":         "Sage: any social skill",
    "social_skill_select_special":      "GME: any social skill",
}

NUM_WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
             "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
             "nineteen", "twenty", "twentyone", "twentytwo", "twentythree", "twentyfour", "twentyfive",
             "twentysix", "twentyseven", "twentyeight", "twentynine", "thirty"]


# @MARKER BOOK "UP TO N"
# The number of a class's social skills a player may choose, where a book prints one ("Social
# Skills: Up to two from the following: ..."). Page is the PRINTED page; the line is in the local
# fulltext dump, re-read on every run when that dump is present, so a mis-transcribed row is
# reported. The Master's Manual's printed page is its PDF page less ten (its own contents list:
# Archer 39, Cavalier 42, Healer 46). Keyed by his sheet's class names: the books' "Dark Knight",
# "Dark Priest", "Death Knight", "White Witch", "Rune Shaman" and "Drum Shaman" are his
# Knight(Dark), Priest(Dark), Knight(Death), Witch(White), Shaman(Rune) and Shaman(Drum).
#
# A class not listed has no book count: the Mysteries of the Planes class pages are images in the
# local dump, and a few classes (Hunter, Mounted Archer, the elemental casters, ...) have no class
# page in any local book. The MM's Jack of All Trades ("Any, up to maximum allowed by Knowledge",
# p.48) is not a class of his sheet and is not listed.
#
# Sage is "Up to four of any Player's Guide social skills" -- a count AND the any-list.
CLASS_SOCIAL_UP_TO = {
    # class                upTo  book                  page  fulltext line
    "Warrior":             (2,   "Player's Guide",      48,  ("players-guide", 8597)),
    "Bard":                (3,   "Player's Guide",      49,  ("players-guide", 8687)),
    "Duelist":             (2,   "Player's Guide",      50,  ("players-guide", 8780)),
    "Knight":              (2,   "Player's Guide",      51,  ("players-guide", 8879)),
    "Knight(Dark)":        (2,   "Player's Guide",      52,  ("players-guide", 8976)),
    "Ranger":              (2,   "Player's Guide",      53,  ("players-guide", 9070)),
    "Rogue":               (2,   "Player's Guide",      54,  ("players-guide", 9168)),
    "Acrobat":             (2,   "Player's Guide",      55,  ("players-guide", 9265)),
    "Assassin":            (3,   "Player's Guide",      56,  ("players-guide", 9361)),
    "Bandit":              (2,   "Player's Guide",      57,  ("players-guide", 9461)),
    "Buccaneer":           (2,   "Player's Guide",      58,  ("players-guide", 9555)),
    "Minstrel":            (3,   "Player's Guide",      59,  ("players-guide", 9655)),
    "Priest":              (2,   "Player's Guide",      60,  ("players-guide", 9751)),
    "Priest(Dark)":        (2,   "Player's Guide",      61,  ("players-guide", 9845)),
    "Druid":               (2,   "Player's Guide",      62,  ("players-guide", 9946)),
    "Monk":                (3,   "Player's Guide",      63,  ("players-guide", 10058)),
    "Seer":                (3,   "Player's Guide",      64,  ("players-guide", 10155)),
    "Shaman":              (2,   "Player's Guide",      65,  ("players-guide", 10251)),
    "Mage":                (2,   "Player's Guide",      66,  ("players-guide", 10353)),
    "Alchemist":           (3,   "Player's Guide",      67,  ("players-guide", 10461)),
    "Mentalist":           (2,   "Player's Guide",      68,  ("players-guide", 10559)),
    "Sage":                (4,   "Player's Guide",      69,  ("players-guide", 10655)),
    "Trickster":           (3,   "Player's Guide",      70,  ("players-guide", 10750)),
    "Witch(White)":        (4,   "Player's Guide",      71,  ("players-guide", 10847)),
    "Witch(Gray)":         (4,   "Player's Guide",      72,  ("players-guide", 10945)),
    "Witch(Black)":        (4,   "Player's Guide",      73,  ("players-guide", 11043)),
    "Archer":              (2,   "Master's Manual",     39,  ("masters-manual", 6053)),
    "Berserker":           (2,   "Master's Manual",     40,  ("masters-manual", 6185)),
    "Bounty Hunter":       (3,   "Master's Manual",     41,  ("masters-manual", 6317)),
    "Cavalier":            (3,   "Master's Manual",     42,  ("masters-manual", 6459)),
    "Martial Artist":      (3,   "Master's Manual",     43,  ("masters-manual", 6589)),
    "Runesmith":           (2,   "Master's Manual",     44,  ("masters-manual", 6719)),
    "Delver":              (4,   "Master's Manual",     45,  ("masters-manual", 6850)),
    "Healer":              (2,   "Master's Manual",     46,  ("masters-manual", 6993)),
    "Wilder":              (3,   "Master's Manual",     47,  ("masters-manual", 7122)),
    "Beastmaster":         (2,   "Aspects of the Wild", 25,  ("aspects-of-the-wild", 2460)),
    "Border Scout":        (3,   "Aspects of the Wild", 27,  ("aspects-of-the-wild", 2618)),
    "Shaman(Rune)":        (2,   "Aspects of the Wild", 29,  ("aspects-of-the-wild", 2783)),
    "Hermeticist":         (3,   "Aspects of the Wild", 31,  ("aspects-of-the-wild", 2936)),
    "Knight(Death)":       (2,   "Epitaph of the Fallen", 33, ("epitaph-of-the-fallen", 5067)),
    "Paladin":             (2,   "Epitaph of the Fallen", 35, ("epitaph-of-the-fallen", 5241)),
    "Crypt Robber":        (3,   "Epitaph of the Fallen", 37, ("epitaph-of-the-fallen", 5421)),
    "Shadow Stalker":      (3,   "Epitaph of the Fallen", 39, ("epitaph-of-the-fallen", 5497)),
    "Exorcist":            (4,   "Epitaph of the Fallen", 41, ("epitaph-of-the-fallen", 5675)),
    "Necromancer":         (2,   "Epitaph of the Fallen", 43, ("epitaph-of-the-fallen", 5946)),
    "Channeler":           (3,   "Epitaph of the Fallen", 45, ("epitaph-of-the-fallen", 6039)),
    "Vivisectionist":      (2,   "Epitaph of the Fallen", 47, ("epitaph-of-the-fallen", 6222)),
    "Conqueror":           (2,   "Legends of the Unknown", 45, ("legends-of-the-unknown", 4566)),
    "Legendier":           (4,   "Legends of the Unknown", 47, ("legends-of-the-unknown", 4755)),
    "Explorer":            (4,   "Legends of the Unknown", 49, ("legends-of-the-unknown", 4946)),
    "Gypsy":               (3,   "Legends of the Unknown", 51, ("legends-of-the-unknown", 5135)),
    "Shaman(Drum)":        (4,   "Legends of the Unknown", 53, ("legends-of-the-unknown", 5329)),
    "Missionary":          (4,   "Legends of the Unknown", 55, ("legends-of-the-unknown", 5520)),
    "Arcanist":            (4,   "Legends of the Unknown", 57, ("legends-of-the-unknown", 5713)),
    "Elementalist":        (2,   "Legends of the Unknown", 59, ("legends-of-the-unknown", 5908)),
}

UP_TO_WORDS = {"two": 2, "three": 3, "four": 4, "2": 2, "3": 3, "4": 4}


def function_body(name):
    """Return (first line number, list of lines) for a function by name, by brace depth, taking
    the LAST declaration -- the one JavaScript actually runs when a name is declared twice."""
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


# @MARKER THE WALK
# One case at a time: every tmp_social_skill_N_type / _name, keyed by N, and the select value.
def walk_switch():
    tmpfirst, tmpbody = function_body("setSocialSkillLists")
    tmpcases = {}
    tmpcurrent = None
    for tmpoffset, tmpline in enumerate(tmpbody):
        tmplineno = tmpfirst + tmpoffset
        m = re.match(r'\s*case\s+"([^"]*)"\s*:', tmpline)
        if m:
            tmpcurrent = {"line": tmplineno, "type": {}, "name": {}, "mods": {}, "select": None}
            tmpcases[m.group(1)] = tmpcurrent
            continue
        if tmpcurrent is None:
            continue
        for tmpn, tmpvalue in re.findall(r'tmp_social_skill_(\d+)_type:\s*"([^"]*)"', tmpline):
            tmpcurrent["type"][int(tmpn)] = tmpvalue
        for tmpn, tmpvalue in re.findall(r'tmp_social_skill_(\d+)_name:\s*"([^"]*)"', tmpline):
            tmpcurrent["name"][int(tmpn)] = tmpvalue
        for tmpn, tmpvalue in re.findall(r'tmp_social_skill_(\d+)_mods:\s*getSocialSkillMods\("([^"]*)"', tmpline):
            tmpcurrent["mods"][int(tmpn)] = tmpvalue
        m = re.search(r'select_social_skill_sheet:\s*"([^"]*)"', tmpline)
        if m:
            tmpcurrent["select"] = m.group(1)
    return tmpfirst, tmpcases


# This is the function which turns one walked case into {required, recommended, anyList}, and
# says every place it had to read past him.
def shape_case(tmpclass, tmpcase, tmpsaid):
    tmprequired, tmprecommended = [], []
    for tmpn in sorted(tmpcase["name"]):
        tmpname = tmpcase["name"][tmpn]
        tmptype = tmpcase["type"].get(tmpn)
        if tmptype is None:
            tmpsaid.append("  REPAIR %s row %d %s: no _type line names this row; read as Recommend"
                           % (tmpclass, tmpn, tmpname))
            tmptype = "Recommend"
        for tmpwho, tmpwas, tmpnow, _, _ in ERRATA_REPAIRS:
            if tmpwho == tmpclass and tmpname == tmpwas:
                tmpsaid.append("  REPAIR %s row %d %s -> %s (his errata)" % (tmpclass, tmpn, tmpwas, tmpnow))
                tmpname = tmpnow
        if tmptype == "Required":
            tmprequired.append(tmpname)
        elif tmptype == "Recommend":
            tmprecommended.append(tmpname)
        else:
            tmpsaid.append("  UNKNOWN TYPE %s row %d: %r" % (tmpclass, tmpn, tmptype))
    for tmpn in sorted(set(tmpcase["type"]) - set(tmpcase["name"])):
        tmpsaid.append("  note: %s sets a _type for row %d and no _name" % (tmpclass, tmpn))
    # The mods argument out of step with the name. Harmless to the port, which derives the modifier
    # from the name, but worth the upstream list.
    tmpdrift = [tmpn for tmpn in sorted(tmpcase["name"])
                if tmpcase["mods"].get(tmpn) not in (None, tmpcase["name"][tmpn])]
    if tmpdrift:
        tmpsaid.append("  note: %s mods argument differs from the name at row(s) %s (ignored; e.g. row %d %s / mods %s)"
                       % (tmpclass, ", ".join(str(n) for n in tmpdrift), tmpdrift[0],
                          tmpcase["name"][tmpdrift[0]], tmpcase["mods"][tmpdrift[0]]))
    tmpselect = tmpcase["select"] or ""
    tmpanylist = tmpselect in ANY_LIST_VALUES
    if not tmpanylist:
        m = re.fullmatch(r'social_skill_select_(\w+)', tmpselect)
        if not m:
            tmpsaid.append("  SLIP %s: select_social_skill_sheet is %r, not a social_skill_select_ value -- "
                           "his Step 6 shows no class rows (kept his %d names)"
                           % (tmpclass, tmpselect, len(tmpcase["name"])))
        elif m.group(1) not in NUM_WORDS or NUM_WORDS.index(m.group(1)) != len(tmpcase["name"]):
            tmpsaid.append("  note: %s shows %s rows but names %d" % (tmpclass, m.group(1), len(tmpcase["name"])))
    return {"required": tmprequired, "recommended": tmprecommended, "anyList": tmpanylist}


# This is the function which re-reads the errata repairs from the local errata, when it is there.
def recheck_errata(tmperratadir):
    tmpsaid = []
    for tmpclass, tmpwas, tmpnow, tmpfile, tmpphrase in ERRATA_REPAIRS:
        tmppath = os.path.join(tmperratadir, tmpfile)
        if not os.path.isfile(tmppath):
            tmpsaid.append("  errata file %s missing -- %s repair applied unchecked" % (tmpfile, tmpclass))
            continue
        tmptext = open(tmppath, encoding="utf-8", errors="replace").read()
        tmpok = (tmpclass + " Class") in tmptext and tmpphrase in tmptext
        tmpsaid.append("  %s %s -> %s: %s" % (tmpclass, tmpwas, tmpnow,
                       "still in %s" % tmpfile if tmpok else "NOT FOUND in %s -- check it" % tmpfile))
    return tmpsaid


# This is the function which re-reads each "up to N" row from its book, when the dump is there.
def recheck_up_to():
    tmpsaid, tmpcache = [], {}
    for tmpclass, (tmpupto, tmpbook, tmppage, (tmpslug, tmplineno)) in CLASS_SOCIAL_UP_TO.items():
        tmppath = os.path.join(REFERENCE, tmpslug + "-fulltext.txt")
        if not os.path.isfile(tmppath):
            tmpsaid.append("  %s: %s not here, row applied unchecked" % (tmpclass, tmpslug))
            continue
        if tmpslug not in tmpcache:
            tmpcache[tmpslug] = open(tmppath, encoding="utf-8", errors="replace").read().split("\n")
        tmptext = tmpcache[tmpslug][tmplineno - 1] if tmplineno <= len(tmpcache[tmpslug]) else ""
        m = re.search(r'[Uu]p to (\w+)', tmptext)
        if not tmptext.startswith(("Social Skills:", "Socia) Skills:")) or not m or UP_TO_WORDS.get(m.group(1)) != tmpupto:
            tmpsaid.append("  CHECK %s: %s-fulltext.txt:%d does not say up to %d: %r"
                           % (tmpclass, tmpslug, tmplineno, tmpupto, tmptext[:80]))
    return tmpsaid


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    tmperratadir = ERRATA_DEFAULT
    if "--errata" in sys.argv:
        tmperratadir = sys.argv[sys.argv.index("--errata") + 1]

    tmpsocial = set(json.load(open(os.path.join(RAW, "socialskilldict.json"), encoding="utf-8"))["entries"])

    tmpfirst, tmpcases = walk_switch()
    tmpsaid = []
    tmpentries = {}
    for tmpclass, tmpcase in tmpcases.items():
        if tmpclass == "":
            continue  # the "no class" case sets nothing
        tmpentries[tmpclass] = shape_case(tmpclass, tmpcase, tmpsaid)

    print("class social skills (setSocialSkillLists, line %d): %d cases, %d classes"
          % (tmpfirst, len(tmpcases), len(tmpentries)))
    print("  %d Required, %d Recommend; any-list: %s"
          % (sum(len(e["required"]) for e in tmpentries.values()),
             sum(len(e["recommended"]) for e in tmpentries.values()),
             ", ".join(c for c, e in tmpentries.items() if e["anyList"])))
    for l in tmpsaid:
        print(l)

    # Every name must be one of his social skills.
    for tmpclass, tmpentry in tmpentries.items():
        for tmpname in tmpentry["required"] + tmpentry["recommended"]:
            if tmpname not in tmpsocial:
                print("  UNKNOWN %s: %s is not in socialskilldict" % (tmpclass, tmpname))
        tmpall = tmpentry["required"] + tmpentry["recommended"]
        for tmpname in sorted({n for n in tmpall if tmpall.count(n) > 1}):
            print("  DUPLICATE %s: %s listed twice" % (tmpclass, tmpname))
    # Identical Recommend lists are worth a look (Innominate / Obscuratum differ only in Required).
    tmpseen = {}
    for tmpclass, tmpentry in tmpentries.items():
        tmpkey = tuple(tmpentry["recommended"])
        if tmpkey:
            tmpseen.setdefault(tmpkey, []).append(tmpclass)
    for tmpclasses in tmpseen.values():
        if len(tmpclasses) > 1:
            print("  note: identical Recommend lists for %s (kept)" % ", ".join(tmpclasses))

    if os.path.isdir(tmperratadir):
        print("errata repairs re-checked against %s" % os.path.relpath(tmperratadir, ROOT))
        for l in recheck_errata(tmperratadir):
            print(l)
    else:
        print("the errata files are not here -- the committed repair list is applied unchecked")

    with open(os.path.join(NAMED, "classSocialSkillLists.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "_source": {"file": "docs/reference/sheet-worker.js", "function": "setSocialSkillLists",
                        "line": tmpfirst},
            "_repairs": [l.strip() for l in tmpsaid if l.strip().startswith("REPAIR")],
            "entries": tmpentries
        }, fh, indent=2, ensure_ascii=False)

    # --- the books' "up to N" --------------------------------------------------------------------
    tmpupto = {}
    for tmpclass, (tmpn, tmpbook, tmppage, (tmpslug, tmplineno)) in CLASS_SOCIAL_UP_TO.items():
        if tmpclass not in tmpentries:
            print("  UP-TO %s: not a class of his switch" % tmpclass)
        tmpupto[tmpclass] = {"upTo": tmpn, "page": "%s p.%d" % (tmpbook, tmppage)}
    print("book \"up to N\": %d classes; %d of his classes have no book count"
          % (len(tmpupto), len([c for c in tmpentries if c not in tmpupto])))
    for l in recheck_up_to():
        print(l)
    with open(os.path.join(NAMED, "classSocialSkillUpTo.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "_source": {"file": "tools/extract/extract_class_social_skills.py", "table": "CLASS_SOCIAL_UP_TO",
                        "note": "Hand-transcribed from the books' class pages; page is the printed page."},
            "entries": tmpupto
        }, fh, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
