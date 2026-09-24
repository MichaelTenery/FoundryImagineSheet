#!/usr/bin/env python3
"""
extract_casting.py -- his casting and invoking code, carried across whole.

Build-time tooling. Not shipped with the Foundry system.

WHAT HIS SHEET DOES WHEN A SPELL IS CAST. The Use button on a spell row runs useSpell
(sheet-worker.js:161282), which checks the cast can be made at all -- memorized, not suppressed,
Aura enough in the pool, no more than Aura Control allows -- rolls the fail chance for a spell above
the caster's Aura Control, and then hands the spell's name and the Aura put into it to one function:

    doSpellAction (sheet-worker.js:162172)       552 cases, one per spell, 7,800 lines

Each case works out what the spell does AT THAT AURA -- "tempSpellRange1=parseInt(tempSpellAura*5)",
"tempSpellValue2=divideWithMin(tempSpellAura,2)+"d6"" -- rolls what it rolls, and writes the result
as one sentence of prose. An offensive spell calls doMagicalAttack for each bolt or finger, which
rolls to hit on the caster's own attack chart (or against their Intelligence save) and rolls its
damage. Invocations are the same shape: useInvocation (153430) then

    doInvocationAction (sheet-worker.js:153511)  461 cases, 6,300 lines, scaled by Piety Control

WHY IT IS CARRIED ACROSS RATHER THAN TRANSCRIBED. Thirteen thousand lines of hand-written cases
cannot be retyped without error, and every one of them is his arithmetic for how that spell scales.
They are plain JavaScript already. What stops them running in Foundry is not the logic but the
platform:

    1. His working variables are implicit globals (tempSpellAction=...), and an ES module is strict
       mode, where assigning an undeclared name throws. docs/STYLE.md section 7.
    2. They call Roll20 (getAttrs, setAttrs) and the rest of his sheet (modAttrib, addPowerName,
       standardSpellAddEffect, ...) to change the caster.
    3. They roll dice with Math.random.

So this walks each function out of his file by brace depth, follows every function of his it calls,
and writes them out verbatim with three changes and no others:

    1. Every name his code assigns without declaring is declared ONCE, at the top of the module,
       with var. At module scope rather than function scope on purpose: in his sheet they are all
       one set of globals, shared between every function, and a function that reads a value another
       one left behind still reads it here. Names his code READS but never assigns anywhere in what
       is carried across are declared the same way and listed in the module's header -- in his
       sheet they were set by some other part of it.
    2. A call to anything in STUBS is NOT carried across: those change the caster or talk to
       Roll20, and module/casting-helpers.mjs provides each one under the same name. What they do
       there is record what his sheet would have done, for the cast's chat card.
    3. Math.random() becomes castingRandom() (from casting-helpers.mjs), so a test can fix the dice
       and Foundry rolls with its own generator. getDieRoll is a stub for the same reason.

A duplicate parameter name (doSpellAction takes tmpINTSave twice) is a syntax error in strict mode;
the second copy is renamed, and reported.

It writes two modules, because one of them is large:

    module/casting-titles.mjs   his Aura Control, Piety Control, Aura Pool, regeneration and
                                devotion functions -- read every time a character is prepared
    module/casting-worker.mjs   doSpellAction, doInvocationAction, the magical mishap table and
                                what they call -- about 1.5 MB, loaded only when something is cast

Usage:
    python tools/extract/extract_casting.py            write both modules
    python tools/extract/extract_casting.py --check    report only; write nothing
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORKER = os.path.join(ROOT, "docs", "reference", "sheet-worker.js")
OUT_TITLES = os.path.join(ROOT, "module", "casting-titles.mjs")
OUT_WORKER = os.path.join(ROOT, "module", "casting-worker.mjs")

SOURCE = open(WORKER, encoding="utf-8", errors="replace").read()
LINES = SOURCE.split("\n")


# @MARKER WHAT IS CARRIED ACROSS
# The functions each module starts from. Everything of his they call is followed, except STUBS.
TITLE_ROOTS = [
    #  his function                        what it gives
    "getAuraControlTitleMod",           # Aura Control gained per title, by class
    "getPietyControlTitleMod",          # Piety Control gained per title, by class
    "getSpellLoreWhen",                 # the title a class gains Spell Lore (+2 Aura Control)
    "getMaxAuraControl",                # the ceiling on Aura Control, by title
    "getMaxAuraPool",                   # the ceiling on the Aura Pool, by title and Aura
    "getAuraRegenRate",                 # Aura regeneration, by class and practitioner title
    "checkDevotion",                    # is an invocation in a devotion (his prayer gate)
    "getDevotionList",                  # the invocations of each devotion
    "getLightFireSpellsWithoutLevel",   # the Illuminator's own spells
    "getAllShadowFrostSpellsWithoutLevel",  # the Shadowfrost Caster's own spells
    "getHalfCastingTime",               # a mastered spell casts in half the time
]
WORKER_ROOTS = [
    "doSpellAction",                    # what a spell does, at the Aura put into it
    "doInvocationAction",               # what an invocation does, at the invoker's Piety Control
    "getMagicalMishap",                 # his mishap table, for a spell that fails
    "getRandomSpell",                   # a random spell, for the Chaos mishaps
]

# Provided by module/casting-helpers.mjs under the same names. Each changes the caster, reads
# Roll20, or rolls a die; see that module for what each one records instead.
STUBS = {
    "getDieRoll", "getAttrs", "setAttrs", "doMagicalAttack",
    "addPowerName", "removePowerName", "checkAllValues", "handleMeleeSet",
    "modAttrib", "setCharacMod", "setAllResistMod", "setResistMod", "changeResistances",
    "standardSpellAddEffect", "standardSpellRemovalEffect", "standardInvokeAddEffect",
    "gainTempMagicalFly", "doSetFatigueLevel", "clearFatigue", "applyNaturalHealing",
    "doDirectFullBodyDamage", "setCombatModifiers", "setTempMovementRate",
    "equipMagicMail", "equipMagicPlate", "equipMagicUnderlayment",
    "equipCrystalskin", "equipEarthskin", "equipRockskin", "equipSteelskin", "equipWoodskin",
    "clearSpellDays", "uncheckSpellMemorize",
}

# @MARKER HIS SLIPS, CORRECTED
# Only a slip that makes a case unable to run at all is corrected -- never one that merely gives a
# number he may not have meant, which is reported instead (docs/UPSTREAM-ISSUES.md). Each must match
# exactly once, or the extraction stops, so a corrected sheet cannot be silently "fixed" twice.
#   his function      what he wrote                what it becomes                                 why
CORRECTIONS = [
    ("doSpellAction", "\t\t\t\tbreakAcid\n",       "\t\t\t\tbreak; // breakAcid in his sheet (UPSTREAM-ISSUES.md item 74)\n",
     "Sand Form ends in 'breakAcid' where 'break;' belongs; reading an undeclared name throws, so in his "
     "sheet the spell never casts, and declared it would fall through into Aura of Acid"),
]

# JavaScript's own names, which are never his globals.
JS_NAMES = {
    "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
    "else", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof",
    "let", "new", "return", "super", "switch", "this", "throw", "try", "typeof", "var", "void",
    "while", "with", "yield", "of", "true", "false", "null", "undefined", "NaN", "Infinity",
    "arguments", "parseInt", "parseFloat", "Math", "String", "Number", "Array", "Object", "JSON",
    "isNaN", "isFinite", "Boolean", "Date", "RegExp", "Error", "console", "Set", "Map",
}


# @MARKER SCANNING HIS JAVASCRIPT
WORD = re.compile(r"[A-Za-z0-9_$]+")


# This is the function which blanks out every string, comment, template and regular expression in
# a piece of his code, keeping every character's position, so the names left can be read safely.
# A "/" is taken as the start of a regular expression when what comes before it could not end an
# expression -- which is how every JavaScript reader tells division from a pattern.
def blank_code(tmptext):
    tmpout = list(tmptext)
    tmplen = len(tmptext)
    tmppos = 0
    tmpprev = ""          # the last significant character outside strings and comments
    tmpprevword = ""      # the last word, for "return /x/"

    def wipe(tmpfrom, tmpto):
        for tmpk in range(tmpfrom, tmpto):
            if tmpout[tmpk] != "\n":
                tmpout[tmpk] = " "

    while tmppos < tmplen:
        tmpc = tmptext[tmppos]
        tmpn = tmptext[tmppos + 1] if tmppos + 1 < tmplen else ""
        if tmpc == "/" and tmpn == "/":
            tmpend = tmptext.find("\n", tmppos)
            tmpend = tmplen if tmpend < 0 else tmpend
            wipe(tmppos, tmpend)
            tmppos = tmpend
            continue
        if tmpc == "/" and tmpn == "*":
            tmpend = tmptext.find("*/", tmppos + 2)
            tmpend = tmplen if tmpend < 0 else tmpend + 2
            wipe(tmppos, tmpend)
            tmppos = tmpend
            continue
        if tmpc in "\"'`":
            tmpq = tmpc
            tmpk = tmppos + 1
            while tmpk < tmplen:
                if tmptext[tmpk] == "\\":
                    tmpk += 2
                    continue
                if tmptext[tmpk] == tmpq:
                    break
                tmpk += 1
            wipe(tmppos + 1, tmpk)
            tmppos = tmpk + 1
            tmpprev = tmpq
            tmpprevword = ""
            continue
        if tmpc == "/" and (tmpprev == "" or tmpprev in "(,=:[!&|?{};+-*%<>~^" or tmpprevword in ("return", "typeof", "case")):
            tmpk = tmppos + 1
            tmpclass = False
            while tmpk < tmplen:
                tmpch = tmptext[tmpk]
                if tmpch == "\\":
                    tmpk += 2
                    continue
                if tmpch == "[":
                    tmpclass = True
                elif tmpch == "]":
                    tmpclass = False
                elif tmpch == "/" and not tmpclass:
                    break
                elif tmpch == "\n":
                    break
                tmpk += 1
            tmpk += 1
            while tmpk < tmplen and tmptext[tmpk].isalpha():
                tmpk += 1
            wipe(tmppos + 1, tmpk - 1)
            tmppos = tmpk
            tmpprev = "/"
            tmpprevword = ""
            continue
        if not tmpc.isspace():
            if tmpc.isalnum() or tmpc in "_$":
                tmpm = WORD.match(tmptext, tmppos)
                tmpprevword = tmpm.group(0)
                tmpprev = tmpprevword[-1]
                tmppos += len(tmpprevword)
                continue
            tmpprev = tmpc
            tmpprevword = ""
        tmppos += 1
    return "".join(tmpout)


# This is the function which finds where each of his functions is, by name. Where he declared a
# name twice (a character and a creature copy), the FIRST is taken unless told otherwise, and the
# duplicate is reported.
def index_functions():
    tmpfound = {}
    for tmpindex, tmpline in enumerate(LINES):
        tmpm = re.match(r"^\s*function\s+([A-Za-z_$][\w$]*)\s*\(", tmpline)
        if tmpm:
            tmpfound.setdefault(tmpm.group(1), []).append(tmpindex)
    return tmpfound

FUNCTIONS = index_functions()
OFFSETS = [0]
for tmpline in LINES:
    OFFSETS.append(OFFSETS[-1] + len(tmpline) + 1)
BLANKED = blank_code(SOURCE)


# This is the function which returns one of his functions whole: (first line number, its text).
# Braces are counted on the blanked copy, so a brace inside a string does not end it.
def function_text(tmpname):
    tmpstart = OFFSETS[FUNCTIONS[tmpname][0]]
    tmpopen = BLANKED.index("{", tmpstart)
    tmpdepth = 0
    for tmppos in range(tmpopen, len(BLANKED)):
        tmpch = BLANKED[tmppos]
        if tmpch == "{":
            tmpdepth += 1
        elif tmpch == "}":
            tmpdepth -= 1
            if tmpdepth == 0:
                tmplinestart = SOURCE.rfind("\n", 0, tmpstart) + 1
                return FUNCTIONS[tmpname][0] + 1, SOURCE[tmplinestart:tmppos + 1]
    raise SystemExit("unbalanced function: " + tmpname)


# This is the function which lists the names of his own functions a piece of his code calls -- and,
# with tmpany, every name called at all, which is how a call to Roll20's getAttrs is found.
def calls_in(tmptext, tmpany=False):
    tmpblank = blank_code(tmptext)
    return set(n for n in re.findall(r"(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(", tmpblank) if tmpany or n in FUNCTIONS)


# This is the function which reads, off one of his functions, what it declares and what it uses.
#   params    its own parameters, in order
#   declared  every name it declares (var/let/const, inner function parameters, loop variables)
#   assigned  every bare name it assigns to
#   read      every bare name it mentions at all
def analyse(tmptext):
    tmpblank = blank_code(tmptext)
    tmphead = re.match(r"\s*function\s+[\w$]+\s*\(([^)]*)\)", tmpblank)
    tmpparams = [p.strip() for p in tmphead.group(1).split(",") if p.strip()]
    tmpdeclared = set(tmpparams)
    for tmpm in re.finditer(r"\b(?:var|let|const)\s+([^;]*)", tmpblank):
        for tmppiece in tmpm.group(1).split(","):
            tmpname = re.match(r"\s*([A-Za-z_$][\w$]*)", tmppiece)
            if tmpname:
                tmpdeclared.add(tmpname.group(1))
    for tmpm in re.finditer(r"function\s*(?:[\w$]+)?\s*\(([^)]*)\)", tmpblank):
        for tmpp in tmpm.group(1).split(","):
            if tmpp.strip():
                tmpdeclared.add(tmpp.strip())
    for tmpm in re.finditer(r"\(\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*\)\s*=>", tmpblank):
        for tmpp in tmpm.group(1).split(","):
            tmpdeclared.add(tmpp.strip())
    for tmpm in re.finditer(r"(?<![\w$.])([A-Za-z_$][\w$]*)\s*=>", tmpblank):
        tmpdeclared.add(tmpm.group(1))
    for tmpm in re.finditer(r"catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)", tmpblank):
        tmpdeclared.add(tmpm.group(1))
    tmpassigned = set()
    for tmpm in re.finditer(r"(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?:=(?![=>])|\+=|-=|\*=|/=|%=|\+\+|--)", tmpblank):
        tmpassigned.add(tmpm.group(1))
    for tmpm in re.finditer(r"(?:\+\+|--)\s*([A-Za-z_$][\w$]*)", tmpblank):
        tmpassigned.add(tmpm.group(1))
    tmpread = set()
    for tmpm in re.finditer(r"(?<![\w$.])([A-Za-z_$][\w$]*)", tmpblank):
        tmpname = tmpm.group(1)
        if tmpname[0].isdigit():
            continue
        # An object literal's key ({tmp_defensive_mod: 3}) is not a name being read.
        tmpafter = tmpblank[tmpm.end():tmpm.end() + 3].lstrip()
        tmpbefore = tmpblank[:tmpm.start()].rstrip()[-1:]
        if tmpafter.startswith(":") and tmpbefore in ("{", ","):
            continue
        tmpread.add(tmpname)
    return {"params": tmpparams, "declared": tmpdeclared, "assigned": tmpassigned, "read": tmpread}


# @MARKER FOLLOWING THE CALLS
# This is the function which gathers every function of his a set of roots needs, stopping at STUBS.
def gather(tmproots):
    tmpseen = []
    tmptodo = list(tmproots)
    while tmptodo:
        tmpname = tmptodo.pop(0)
        if tmpname in tmpseen or tmpname in STUBS:
            continue
        if tmpname not in FUNCTIONS:
            raise SystemExit("not in his sheet: " + tmpname)
        tmpseen.append(tmpname)
        tmpline, tmptext = function_text(tmpname)
        for tmpcalled in sorted(calls_in(tmptext)):
            if tmpcalled not in tmpseen and tmpcalled not in STUBS:
                tmptodo.append(tmpcalled)
    return sorted(tmpseen, key=lambda n: FUNCTIONS[n][0])


# @MARKER WRITING A MODULE
# This is the function which writes one module out of a set of roots.
def build_module(tmproots, tmpheader, tmpnotes):
    tmpnames = gather(tmproots)
    tmpfunctions = []
    tmpglobals = set()
    tmpforeign = set()
    tmpstubs = set()
    tmpreport = []
    tmpall = set(FUNCTIONS)
    for tmpname in tmpnames:
        tmpline, tmptext = function_text(tmpname)

        # His slips that would stop a case running at all are corrected, each one said out loud.
        for tmpfunction, tmpwrong, tmpright, tmpwhy in CORRECTIONS:
            if tmpfunction == tmpname:
                if tmptext.count(tmpwrong) != 1:
                    raise SystemExit(f"correction no longer matches exactly once in {tmpname}: {tmpwrong!r}")
                tmptext = tmptext.replace(tmpwrong, tmpright)
                tmpreport.append(f"{tmpname}: corrected -- {tmpwhy}")

        tmpinfo = analyse(tmptext)

        # A parameter named twice is a syntax error in strict mode. The second copy is renamed;
        # in his code it always carries the same value as the first, and only the first is read.
        tmpseenparams = set()
        tmpfixed = []
        for tmpparam in tmpinfo["params"]:
            if tmpparam in tmpseenparams:
                tmpfixed.append(tmpparam + "Again")
                tmpreport.append(f"{tmpname}: parameter {tmpparam} is named twice; the second is renamed {tmpparam}Again")
            else:
                tmpfixed.append(tmpparam)
            tmpseenparams.add(tmpparam)
        if tmpfixed != tmpinfo["params"]:
            tmphead = re.match(r"(\s*function\s+[\w$]+\s*\()([^)]*)(\))", tmptext)
            tmptext = tmphead.group(1) + ", ".join(tmpfixed) + tmphead.group(3) + tmptext[tmphead.end():]

        # Math.random is routed through casting-helpers.mjs, so dice can be fixed for a test and
        # Foundry rolls with its own generator.
        tmptext = tmptext.replace("Math.random()", "castingRandom()")

        for tmpcalled in calls_in(tmptext, True):
            if tmpcalled in STUBS:
                tmpstubs.add(tmpcalled)

        tmpglobals |= (tmpinfo["assigned"] - tmpinfo["declared"] - JS_NAMES - tmpall - STUBS)
        tmpforeign |= (tmpinfo["read"] - tmpinfo["declared"] - tmpinfo["assigned"] - JS_NAMES - tmpall - STUBS
                       - {"castingRandom"})
        tmpexport = "export " if tmpname in tmproots else ""
        tmpbody = re.sub(r"^(\s*)function ", lambda m: m.group(1) + tmpexport + "function ", tmptext, count=1)
        tmpfunctions.append((tmpname, tmpline, tmpbody))

    # Names read somewhere and assigned somewhere else in the same module are ordinary shared
    # globals; only a name nothing here assigns is "foreign".
    tmpforeign = tmpforeign - tmpglobals

    tmpout = []
    tmpout.append("// @START (CODE)")
    tmpout.extend("// " + l if l else "//" for l in tmpheader)
    tmpout.append("//")
    tmpout.append("// GENERATED by tools/extract/extract_casting.py from docs/reference/sheet-worker.js. Do not edit")
    tmpout.append("// by hand: change his sheet or the extractor, and run it again.")
    for l in tmpnotes:
        tmpout.append("// " + l if l else "//")
    if tmpforeign:
        tmpout.append("//")
        tmpout.append("// READ HERE, SET ELSEWHERE IN HIS SHEET. These names are read by the code below and assigned")
        tmpout.append("// nowhere in it. In his sheet another part of it set them first; here they start undefined:")
        for tmpchunk in wrap_names(sorted(tmpforeign), 96):
            tmpout.append("//     " + tmpchunk)
    for tmpline in tmpreport:
        tmpout.append("// NOTE: " + tmpline)
    tmpout.append("//" + "=" * 114)
    tmpout.append("")
    tmpimports = sorted(tmpstubs) + ["castingRandom"]
    tmpout.append("import {")
    for tmpchunk in wrap_names(tmpimports, 100):
        tmpout.append("\t" + tmpchunk)
    tmpout.append('} from "./casting-helpers.mjs";')
    tmpout.append("")
    tmpout.append("// @MARKER HIS WORKING VARIABLES")
    tmpout.append("// Every name his functions below assign without declaring. In his sheet each is one global")
    tmpout.append("// shared by all of them, and so it is here: declared once, at module scope.")
    tmpdeclare = sorted(tmpglobals | tmpforeign)
    for tmpchunk in wrap_names(tmpdeclare, 110):
        tmpout.append("var " + tmpchunk.rstrip(",") + ";")
    tmpout.append("")
    if tmpforeign:
        tmpout.append("// @MARKER SET BEFORE A CAST")
        tmpout.append("// This is the function which sets, before a cast, the names his sheet had already set elsewhere")
        tmpout.append("// (listed in the header). module/casting-rules.mjs calls it with the caster's own values.")
        tmpout.append("export function setHisGlobals(tmpvalues) {")
        for tmpname in sorted(tmpforeign):
            tmpout.append(f'\tif (tmpvalues && "{tmpname}" in tmpvalues) {{ {tmpname} = tmpvalues.{tmpname}; }}')
        tmpout.append("}")
        tmpout.append("")
    for tmpname, tmpline, tmpbody in tmpfunctions:
        tmpout.append(f"// @MARKER {tmpname} (sheet-worker.js:{tmpline})")
        tmpout.append(tmpbody.rstrip())
        tmpout.append("")
    tmpout.append("// @END (CODE)")
    tmpout.append("")
    return "\n".join(tmpout), tmpnames, tmpglobals, tmpforeign, tmpstubs, tmpreport


def wrap_names(tmpnames, tmpwidth):
    tmprows = []
    tmprow = ""
    for tmpname in tmpnames:
        tmppiece = tmpname + ", "
        if len(tmprow) + len(tmppiece) > tmpwidth and tmprow:
            tmprows.append(tmprow.rstrip())
            tmprow = ""
        tmprow += tmppiece
    if tmprow:
        tmprows.append(tmprow.rstrip().rstrip(","))
    if tmprows:
        tmprows = [r if r.endswith(",") or i == len(tmprows) - 1 else r for i, r in enumerate(tmprows)]
    return tmprows


TITLES_HEADER = [
    "@MARKER CASTING BY TITLE",
    "=" * 114,
    "His functions for how far a caster and an invoker have come: Aura Control and Piety Control gained",
    "per title, the title Spell Lore arrives, the ceilings on Aura Control and the Aura Pool, the rate the",
    "pool refills, and the invocations each devotion holds. Read by module/casting-rules.mjs, which the",
    "character's prepare step calls; the rules that COMBINE them (his setMagicDivineLore) are there.",
]
TITLES_NOTES = []
WORKER_HEADER = [
    "@MARKER CASTING WORKER",
    "=" * 114,
    "What a spell or an invocation DOES, in his own words and arithmetic: doSpellAction (one case per",
    "spell, worked out at the Aura put into it), doInvocationAction (one case per invocation, at the",
    "invoker's Piety Control), his magical mishap table, and every function of his they call.",
    "",
    "Loaded only when something is cast (module/magic-actions.mjs imports it on first use), because it",
    "is large. module/casting-rules.mjs sets up a cast and reads what comes back; module/casting-helpers.mjs",
    "provides everything below that would have changed the caster in his sheet, and records it instead.",
]
WORKER_NOTES = []


def main():
    tmpcheck = "--check" in sys.argv
    for tmproots, tmpfile, tmpheader, tmpnotes in (
            (TITLE_ROOTS, OUT_TITLES, TITLES_HEADER, TITLES_NOTES),
            (WORKER_ROOTS, OUT_WORKER, WORKER_HEADER, WORKER_NOTES)):
        tmptext, tmpnames, tmpglobals, tmpforeign, tmpstubs, tmpreport = build_module(tmproots, tmpheader, tmpnotes)
        print(f"{os.path.basename(tmpfile)}: {len(tmpnames)} functions, {len(tmpglobals)} working variables, "
              f"{len(tmpstubs)} stubs, {len(tmptext) // 1024} KB")
        print("    carried: " + ", ".join(tmpnames))
        print("    stubs:   " + ", ".join(sorted(tmpstubs)))
        if tmpforeign:
            print("    READ BUT NEVER SET HERE: " + ", ".join(sorted(tmpforeign)))
        for tmpline in tmpreport:
            print("    " + tmpline)
        for tmpname in tmpnames:
            if len(FUNCTIONS[tmpname]) > 1:
                print(f"    NOTE: {tmpname} is declared {len(FUNCTIONS[tmpname])} times in his sheet; "
                      f"the first (line {FUNCTIONS[tmpname][0] + 1}) is used")
        if not tmpcheck:
            with open(tmpfile, "w", encoding="utf-8", newline="\n") as tmpout:
                tmpout.write(tmptext)
            print("    wrote " + os.path.relpath(tmpfile, ROOT))


if __name__ == "__main__":
    main()
