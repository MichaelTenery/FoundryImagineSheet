#!/usr/bin/env python3
"""
extract_lore_tables.py -- his starting-lore chain, his poison tables and his starting spells.

Build-time tooling. Not shipped with the Foundry system.

When a character is finished on his sheet, a tick on the last creation step ("Provide random lore
for starting spells, all relevant skills, and related consumables", attr_do_random_lore) runs
provideRandomLoreAndLoreItems (sheet-worker.js:146686). That is a chain of thirteen functions, one
per lore, each of which

    counts how many times the character holds the lore's skill (storeSkillCountForSkills),
    draws that many DIFFERENT entries at random from a fixed list of his (get<Lore>List), and
    adds each one to the sheet -- and, for herbs, potions and poisons, a stock of doses as well --

and then a fourteenth hands out starting spells to anyone whose best casting skill is one of
five. None of it was ported, which is what "you are not generating relevant entries and inventory
for lores" was about (2026-09-22).

WHY A PARSER. The fourteen lists run to about 900 names, the poison details are three switches
and the starting spells are three d100 ladders. Walking them means a corrected sheet regenerates
them, and every name can be checked against the dictionary it should be in -- which is how the
misspelt and missing ones reported at the end of every run were found.

Writes module/lore-tables.mjs.

Usage:
    python tools/extract/extract_lore_tables.py
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "src", "packs", "raw")
WORKER = os.path.join(ROOT, "docs", "reference", "sheet-worker.js")
OUTFILE = os.path.join(ROOT, "module", "lore-tables.mjs")
NAMED = os.path.join(ROOT, "src", "packs", "named")

lines = open(WORKER, encoding="utf-8", errors="replace").readlines()


def clean_text(tmpvalue):
    """His data writes an apostrophe as a backtick; the built documents carry the apostrophe, so
    a name has to be cleaned the same way here or it will never match its document."""
    return str(tmpvalue or "").replace("`", "'").strip()


def function_body(name):
    """Return (first line number, list of lines) for a function by name, by brace depth."""
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
            break
    return i + 1, out


# @MARKER LORE LISTS
# Every get<Lore>List is the same two lines: tempLoreList="a,b,c"; return tempLoreList;
def lore_list(name):
    tmpline, tmpbody = function_body(name)
    for tmptext in tmpbody:
        tmpmatch = re.search(r'tempLoreList\s*=\s*"([^"]*)"', tmptext)
        if tmpmatch:
            return [clean_text(n) for n in tmpmatch.group(1).split(",") if n.strip()]
    raise SystemExit("no list in " + name)


# @MARKER THE CHAIN
# Followed rather than listed: each check function names the next one it calls, so the order is
# his, and a lore he adds to the chain is picked up without anyone editing this file.
#
# What a step does is read out of its own body -- the one or two skill names it counts, the list
# functions it draws from, the add functions it calls and any dose dice it rolls. The kind each add
# function makes is the one fixed thing here, and it is his repeating-section name: the same key
# the magic switches in module/availability.mjs are grouped by.
ADD_KINDS = {
    #  his add function          kind            what it adds
    "addBalladByName":          "ballad",        # a known ballad
    "addCandleLoreByName":      "candlelore",    # a known candle ritual
    "addEmpathyMagicByName":    "empathymagic",  # a known empathy ritual
    "addGlyphByName":           "glyph",         # a known glyph
    "addHymnByName":            "hymn",          # a known hymn
    "addPoemByName":            "poem",          # a known poem
    "addPoisonRecipeByName":    "poisonrecipe",  # a known poison recipe
    "addPoisonByName":          "poison",        # doses of that poison, made in the past
    "addPotionRecipeByName":    "potionrecipe",  # a known potion recipe
    "addPotionByName":          "potion",        # doses of that potion
    "addRitualByName":          "ritual",        # a known ritual
    "addRuneByName":            "rune",          # a known rune
    "addSongByName":            "song",          # a known song
    "addSympathyMagicByName":   "sympathymagic", # a known sympathy ritual
    "addHerbByName":            "herb",          # doses of a herb
}


# The walk stops where the lores end. checkStartingSpells is the next link in his chain, but it
# counts no lore skill: it finds the one best casting skill instead, and is carried by
# CASTING_SKILLS and the spell ladders below rather than as a step.
CHAIN_END = "checkStartingSpells"


def walk_chain():
    tmpsteps = []
    tmpname = "checkBalladLore"
    tmpseen = set()
    while tmpname and tmpname not in tmpseen and tmpname.startswith("check") and tmpname != CHAIN_END:
        tmpseen.add(tmpname)
        tmpline, tmpbody = function_body(tmpname)
        tmptext = "".join(tmpbody)
        tmpskills = re.findall(r'storeSkillCountForSkills\("([^"]*)",\s*"([^"]*)"\)', tmptext)
        tmplists = [n for n in re.findall(r'(get\w+List)\(\)', tmptext)]
        tmpadds = [n for n in re.findall(r'(add\w+ByName)\(', tmptext)]
        tmpdice = re.findall(r'rollDiceFromString\("([^"]+)"\)', tmptext)
        tmpnext = re.findall(r'\b(check\w+)\(\);', tmptext)
        tmpsteps.append({
            "function": tmpname, "line": tmpline,
            "skills": [s for s in (tmpskills[0] if tmpskills else ()) if s and s != "NO MATCH"],
            "lists": tmplists, "adds": tmpadds, "dice": tmpdice,
        })
        tmpname = tmpnext[-1] if tmpnext else None
    return tmpsteps


# @MARKER POISON TABLES
# A poison is not a dictionary row. It is built from a Type (I-XXV) and a Potency (A-Q) by three
# switches in getPoisonDetails (sheet-worker.js:135117): duration by type, onset by potency, and
# the effect by type with the onset written onto its end. A generic walk of a switch on one
# variable: every case label collects until the assignment, and the assignment goes to all of them.
def switch_table(tmpbody, tmpvariable, tmptarget):
    tmptable = {}
    tmpinside = False
    tmppending = []
    tmpdepth = 0
    for tmptext in tmpbody:
        if not tmpinside:
            if re.search(r'switch\s*\(\s*%s\s*\)' % re.escape(tmpvariable), tmptext):
                tmpinside = True
                tmpdepth = tmptext.count("{") - tmptext.count("}")
            continue
        tmpdepth += tmptext.count("{") - tmptext.count("}")
        for tmpcase in re.findall(r'case\s+"([^"]*)"\s*:', tmptext):
            tmppending.append(tmpcase)
        tmpassign = re.search(r'%s\s*=\s*"((?:[^"\\]|\\.)*)"(\s*\+\s*(\w+))?' % re.escape(tmptarget), tmptext)
        if tmpassign and tmppending:
            # Not clean_text: that strips, and "Effect starts: "+onset needs its trailing space.
            tmpvalue = tmpassign.group(1).replace("`", "'")
            if tmpassign.group(3):
                tmpvalue += "{" + tmpassign.group(3) + "}"
            for tmpcase in tmppending:
                tmptable[tmpcase] = tmpvalue
            tmppending = []
        if tmpdepth <= 0:
            break
    return tmptable


def roman_value(tmproman):
    tmpvalues = {"I": 1, "V": 5, "X": 10}
    tmptotal = 0
    for tmpindex, tmpchar in enumerate(tmproman):
        tmpvalue = tmpvalues[tmpchar]
        if tmpindex + 1 < len(tmproman) and tmpvalues[tmproman[tmpindex + 1]] > tmpvalue:
            tmptotal -= tmpvalue
        else:
            tmptotal += tmpvalue
    return tmptotal


# @MARKER STARTING SPELL LADDERS
# getOffensiveSpell, getDefensiveSpell and getUtilitySpell are each one d100 ladder:
#     if (tempRandomPercent<5) { x="Hold Plant"; } else if (tempRandomPercent<12) { ... } else { x="Soak"; }
# Stored as [below, name] pairs -- a roll LESS THAN "below" takes the name -- with the final else
# stored as below 101, which every d100 roll is.
def spell_ladder(tmpname):
    tmpline, tmpbody = function_body(tmpname)
    tmpladder = []
    tmpbelow = None
    for tmptext in tmpbody:
        tmpcond = re.search(r'tempRandomPercent\s*<\s*(\d+)', tmptext)
        if tmpcond:
            tmpbelow = int(tmpcond.group(1))
        elif re.search(r'\belse\s*\{', tmptext):
            tmpbelow = 101
        tmpassign = re.search(r'temp\w+Spell\s*=\s*"([^"]+)"', tmptext)
        if tmpassign and tmpbelow is not None:
            tmpladder.append([tmpbelow, clean_text(tmpassign.group(1))])
            tmpbelow = None
    return tmpladder


def casting_skills():
    tmpline, tmpbody = function_body("storeBestCastingSkill")
    for tmptext in tmpbody:
        if "raceskills[i])==" in tmptext:
            return re.findall(r'=="([^"]+)"', tmptext)
    raise SystemExit("no casting skills in storeBestCastingSkill")


def dictionary_names(tmpname):
    tmppath = os.path.join(RAW, tmpname + ".json")
    tmpentries = json.load(open(tmppath, encoding="utf-8")).get("entries", {})
    return {clean_text(k) for k in tmpentries}


# The dictionary each kind's names must be found in.
KIND_DICTIONARIES = {
    "ballad": "balladlist", "candlelore": "candlelorelist", "empathymagic": "empathymagiclist",
    "glyph": "glyphlist", "hymn": "hymnlorelist", "poem": "poemlist", "potionrecipe": "potionlist",
    "ritual": "rituallist", "rune": "runelist", "song": "songlist",
    "sympathymagic": "sympathymagiclist", "herb": "herblist",
}


def js(tmpvalue):
    """A JSON value as JavaScript source: one entry to a line, each entry written inline, which is
    how he lays out his own dictionaries -- a table read down the page, not a tree. A ladder (a list
    of [below, name] pairs) gets one rung to a line."""
    def tmpinline(tmpv):
        return json.dumps(tmpv, ensure_ascii=False)
    if isinstance(tmpvalue, list):
        return "[\n" + ",\n".join("\t" + tmpinline(v) for v in tmpvalue) + "\n]"
    if isinstance(tmpvalue, dict):
        tmpwidth = max((len(tmpinline(k)) for k in tmpvalue), default=0) + 1
        tmprows = []
        for tmpkey, tmpitem in tmpvalue.items():
            tmplabel = (tmpinline(tmpkey) + ":").ljust(tmpwidth + 1)
            if isinstance(tmpitem, list) and tmpitem and isinstance(tmpitem[0], list):
                tmprows.append("\t" + tmplabel + "[\n"
                               + ",\n".join("\t\t" + tmpinline(x) for x in tmpitem) + "\n\t]")
            else:
                tmprows.append("\t" + tmplabel + tmpinline(tmpitem))
        return "{\n" + ",\n".join(tmprows) + "\n}"
    return tmpinline(tmpvalue)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    tmpsteps = walk_chain()
    tmpproblems = []

    # --- the chain, one entry per step, in his order ------------------------------------------
    tmpchain = []
    tmplists = {}
    for tmpstep in tmpsteps:
        tmpkinds = [ADD_KINDS[a] for a in tmpstep["adds"] if a in ADD_KINDS]
        tmpunknown = [a for a in tmpstep["adds"] if a not in ADD_KINDS]
        if tmpunknown:
            tmpproblems.append("%s calls %s, which this script does not know the kind of"
                               % (tmpstep["function"], ", ".join(tmpunknown)))
        if not tmpkinds:
            continue
        tmpkind = tmpkinds[0]
        tmpentry = {"kind": tmpkind, "skills": tmpstep["skills"], "from": "%s (sheet-worker.js:%d)"
                    % (tmpstep["function"], tmpstep["line"])}
        if len(tmpkinds) > 1:
            tmpentry["stock"] = tmpkinds[1]
        tmpchain.append(tmpentry)
        for tmplistname in tmpstep["lists"]:
            tmplists[tmplistname] = lore_list(tmplistname)

    # --- name checks: every listed name should be an entry of its dictionary --------------------
    tmplistkinds = {
        "getBalladLoreList": "ballad", "getCandleLoreList": "candlelore",
        "getEmpathyMagicList": "empathymagic", "getGlyphList": "glyph",
        "getGoodHymnList": "hymn", "getEvilHymnList": "hymn", "getNeutralHymnList": "hymn",
        "getUnalignedHymnList": "hymn", "getPoemLoreList": "poem", "getPotionLoreList": "potionrecipe",
        "getRitualLoreList": "ritual", "getRuneLoreList": "rune", "getSongLoreList": "song",
        "getSympathyMagicList": "sympathymagic", "getHerbLoreList": "herb",
    }
    tmpmissing = {}
    for tmplistname, tmpnames in tmplists.items():
        tmpkind = tmplistkinds.get(tmplistname)
        if not tmpkind:
            continue
        tmpknown = dictionary_names(KIND_DICTIONARIES[tmpkind])
        tmpabsent = [n for n in tmpnames if n not in tmpknown]
        if tmpabsent:
            tmpmissing[tmplistname] = tmpabsent

    # --- poisons --------------------------------------------------------------------------------
    tmpline, tmpbody = function_body("getPoisonDetails")
    tmpdurations = switch_table(tmpbody, "tmpPoisonType", "tmpNewPoisonDuration")
    tmponsets = switch_table(tmpbody, "tmpPoisonPotency", "tmpNewPoisonStart")
    tmpeffects = switch_table(tmpbody[len(tmpbody) // 2:], "tmpPoisonType", "tmpNewPoisonDescription")
    tmptypes = {}
    for tmptype in lore_list("getPoisonTypeEvilList"):
        tmpeffect = tmpeffects.get(tmptype, "")
        tmptypes[tmptype] = {
            "rating": roman_value(tmptype),
            "duration": tmpdurations.get(tmptype, ""),
            "effect": tmpeffect.replace("{tmpNewPoisonStart}", "{onset}"),
        }
        if not tmpeffect or not tmpdurations.get(tmptype):
            tmpproblems.append("poison type %s has no %s" % (tmptype, "effect" if not tmpeffect else "duration"))
    tmppotencies = {p: tmponsets.get(p, "") for p in lore_list("getPoisonPotencyList")}
    for tmppotency, tmponset in tmppotencies.items():
        if not tmponset:
            tmpproblems.append("poison potency %s has no onset" % tmppotency)

    # --- starting spells ------------------------------------------------------------------------
    tmpladders = {
        "offensive": spell_ladder("getOffensiveSpell"),
        "defensive": spell_ladder("getDefensiveSpell"),
        "utility":   spell_ladder("getUtilitySpell"),
    }
    tmpspellnames = dictionary_names("spellslist")
    for tmpkey, tmpladder in tmpladders.items():
        if not tmpladder or tmpladder[-1][0] != 101:
            tmpproblems.append("the %s spell ladder does not end in an else" % tmpkey)
        tmpabsent = [n for _, n in tmpladder if n not in tmpspellnames]
        if tmpabsent:
            tmpmissing["get%sSpell" % tmpkey.capitalize()] = tmpabsent
    tmpprimers = json.load(open(os.path.join(RAW, "spellPrimers.json"), encoding="utf-8"))["entries"]
    tmpprimers = {k: clean_text(v[0]) for k, v in tmpprimers.items()}

    # --- write ----------------------------------------------------------------------------------
    with open(OUTFILE, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(MODULE_HEADER)
        fh.write("// @MARKER THE CHAIN -- one step per lore, in his order. \"skills\" are the one or two skill\n"
                 "// names the step counts (storeSkillCountForSkills); \"stock\" is the consumable a step also\n"
                 "// hands out doses of, beside the known entry.\n")
        fh.write("export const STARTING_LORE_CHAIN = %s;\n\n" % js(tmpchain))
        fh.write("// @MARKER THE LISTS -- what each step draws from, keyed by his own function name.\n")
        fh.write("export const STARTING_LORE_LISTS = %s;\n\n" % js(tmplists))
        fh.write("// @MARKER POISONS -- getPoisonDetails, and getPoisonRating (a recipe's memorization\n"
                 "// cost is its type's number). {onset} in an effect is the potency's onset.\n")
        fh.write("export const POISON_TYPES = %s;\n\n" % js(tmptypes))
        fh.write("export const POISON_POTENCIES = %s;\n\n" % js(tmppotencies))
        fh.write("// @MARKER STARTING SPELLS -- the five skills storeBestCastingSkill looks for, and\n"
                 "// the three d100 ladders. [below, name]: a roll LESS THAN below takes the name.\n")
        fh.write("export const CASTING_SKILLS = %s;\n\n" % js(casting_skills()))
        fh.write("export const STARTING_SPELL_LADDERS = %s;\n\n" % js(tmpladders))
        fh.write("// @MARKER SPELL PRIMERS -- getCantripBook. A new caster who makes an Affinity or a\n"
                 "// Fortune roll starts with one of these, at random, among their equipment.\n")
        fh.write("export const SPELL_PRIMERS = %s;\n\n" % js(tmpprimers))
        fh.write("// @MARKER NAMES HIS DICTIONARIES DO NOT HOLD -- reported by the extraction, and left\n"
                 "// in the lists: his sheet draws them too, and adds a blank row for each.\n")
        fh.write("export const LORE_NAMES_NOT_FOUND = %s;\n" % js(tmpmissing))
        fh.write("\n// @END (CODE)\n")

    # @MARKER HYMN ALIGNMENTS
    # His hymnlorelist has no alignment column; the only record of which hymn is whose is the four
    # starting lists checkHymn draws from. build_documents.py reads this to put the alignment on
    # each hymn document, so the sheet can say it and a picker can sort by it.
    tmphymns = {}
    for tmplistname, tmpalign in (("getGoodHymnList", "Good"), ("getEvilHymnList", "Evil"),
                                  ("getNeutralHymnList", "Neutral"), ("getUnalignedHymnList", "Unaligned")):
        for tmpname in tmplists.get(tmplistname, []):
            tmphymns[tmpname] = tmpalign
    tmppath = os.path.join(NAMED, "hymnAlignments.json")
    with open(tmppath, "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"_source": "the four hymn lists of checkHymn, sheet-worker.js:146851, via "
                              "tools/extract/extract_lore_tables.py",
                   "entries": tmphymns}, fh, indent=2, ensure_ascii=False)

    print("wrote %s (%.1f KB)" % (os.path.relpath(OUTFILE, ROOT), os.path.getsize(OUTFILE) / 1024))
    print("wrote %s (%d hymns)" % (os.path.relpath(tmppath, ROOT), len(tmphymns)))
    print("chain: %s" % " -> ".join(s["kind"] for s in tmpchain))
    print("lists: %d names across %d lists" % (sum(len(v) for v in tmplists.values()), len(tmplists)))
    print("poison types %d, potencies %d; spell ladders %s"
          % (len(tmptypes), len(tmppotencies), ", ".join("%s %d" % (k, len(v)) for k, v in tmpladders.items())))
    for tmplistname, tmpabsent in tmpmissing.items():
        print("  NOT IN HIS DICTIONARY  %-24s %s" % (tmplistname, ", ".join(tmpabsent)))
    for tmpproblem in tmpproblems:
        print("  PROBLEM  " + tmpproblem)


MODULE_HEADER = """// @START (CODE)
// @MARKER LORE TABLES
//==================================================================================================================
// GENERATED FILE -- do not edit by hand.
// Produced by tools/extract/extract_lore_tables.py from the original Roll20 sheet-worker.
// Regenerate rather than editing, or this will drift from his sheet.
//
// What his sheet hands a new character for the lores it holds -- provideRandomLoreAndLoreItems,
// sheet-worker.js:146686, run when "Provide random lore" is ticked on the last creation step --
// and the two tables that chain leans on: his poisons, which are built from a type and a potency
// rather than listed, and the starting spells a new caster is given.
//
// The rules that USE these are in module/lore-rules.mjs.
//==================================================================================================================

"""


if __name__ == "__main__":
    main()
