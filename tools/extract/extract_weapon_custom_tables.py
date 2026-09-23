#!/usr/bin/env python3
"""
extract_weapon_custom_tables.py -- his weapon Customize panel, and what his attack does with it.

Build-time tooling. Not shipped with the Foundry system.

His Equipment tab has a CUSTOMIZE ITEMS panel (sheet HTML, "START ITEM CUSTOMIZATION") that
rewrites an item's NAME with bracketed tags -- "+2 {Long Sword} [Sharpness] [Base Aura:10]
[2d6 Flame damage]" -- and his attack code reads the tags back out of the name. The port keeps
them as fields on the weapon instead, and this script reads out of his sheet everything those
fields need:

    the choices          every option of the panel's weapon selects (condition, quality,
                         customization, magic plus, magical ability, rune, energy, divine ability)
    which weapons        checkWeaponCustomization (sheet-worker.js:81496): a Serrated edge only
                         on a blade or an axe, Tempered only on metal, and so on
    the plus they raise  updateMagicPlus (81461): four magical abilities and ten divine ones raise
                         the weapon's plus by its base Aura or base Piety Control
    energy               customizeItem's switch (78962): the die each energy rolls
    by attack mode       setMagicDamageDetails (91318) and handlePhysicalAttacks (64357): which
                         ability and which rune works on a thrust, a cut, a smash or a missile
    divine dice          setMagicDamageDetails: the die each brand rolls per 5 base Piety Control

Writes module/weapon-custom-tables.mjs.

Usage:
    python tools/extract/extract_weapon_custom_tables.py
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORKER = os.path.join(ROOT, "docs", "reference", "sheet-worker.js")
SHEET = os.path.join(ROOT, "ImagineRoll20CharacterSheet-main", "ImagineTabbedCharacterSheet.html")
OUTFILE = os.path.join(ROOT, "module", "weapon-custom-tables.mjs")

lines = open(WORKER, encoding="utf-8", errors="replace").readlines()
sheet = open(SHEET, encoding="utf-8", errors="replace").read().split("\n")
problems = []


def clean_text(tmpvalue):
    return str(tmpvalue or "").replace("`", "'").strip()


def function_body(name):
    """Return (first line number, list of lines) for a function by name, by brace depth."""
    starts = [i for i, l in enumerate(lines) if re.match(r'\s*function %s\s*\(' % re.escape(name), l)]
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


# @MARKER THE PANEL'S SELECTS
# Each select of his customize panel, as [value, label] pairs in his order. His label can say
# more than his value -- "Serrated(Cut)" is the Serrated customization, for cutting weapons --
# and both are kept.
def panel_selects():
    tmpstart = next(i for i, l in enumerate(sheet) if "START ITEM CUSTOMIZATION" in l)
    tmpend = next(i for i, l in enumerate(sheet) if i > tmpstart and "END ITEM CUSTOMIZATION" in l)
    tmpselects, tmpcurrent = {}, None
    for tmpline in sheet[tmpstart:tmpend]:
        tmpopen = re.search(r'<select name="attr_(\w+)"', tmpline)
        if tmpopen:
            tmpcurrent = tmpopen.group(1)
            tmpselects[tmpcurrent] = []
        tmpoption = re.search(r'<option value="([^"]*)"[^>]*>([^<]*)</option>', tmpline)
        if tmpoption and tmpcurrent and tmpoption.group(1):
            tmppair = [clean_text(tmpoption.group(1)), clean_text(tmpoption.group(2))]
            if tmppair not in tmpselects[tmpcurrent]:
                tmpselects[tmpcurrent].append(tmppair)
        if "</select>" in tmpline:
            tmpcurrent = None
    return tmpselects


# @MARKER WHICH WEAPONS TAKE WHICH CUSTOMIZATION
# checkWeaponCustomization tests tempCombatValues -- his weapon row -- and the name. [11] is the
# weapon's type (Blade, Axe ...), [12] its material, [2] its speed. Read case by case; a fall-
# through of several cases to one test (Silvering and Weapon Strap) gives each the same rule.
def customization_rules():
    tmpline, tmpbody = function_body("checkWeaponCustomization")
    tmprules, tmppending = {}, []
    for tmptext in tmpbody:
        for tmpcase in re.findall(r'case "([^"]+)":', tmptext):
            tmppending.append(tmpcase)
        tmprule = None
        tmptypes = re.findall(r'tempCombatValues\[11\]=="([^"]+)"', tmptext)
        if tmptypes and "tempweaponcustomok=true" in tmptext:
            tmprule = {"types": tmptypes}
        tmpmaterial = re.findall(r'tempCombatValues\[12\]=="([^"]+)"', tmptext)
        if tmpmaterial:
            tmprule = {"materials": tmpmaterial}
        tmpname = re.findall(r'tempweaponname\.includes\("([^"]+)"\)', tmptext)
        if tmpname:
            tmprule = {"nameIncludes": sorted(set(n.lower() for n in tmpname))}
        tmpspeed = re.search(r'tempmaxweapspeed>(\d+)\s*&&\s*tempmaxweapspeed<(\d+)', tmptext)
        if tmpspeed:
            tmprule = {"speedAbove": int(tmpspeed.group(1)), "speedBelow": int(tmpspeed.group(2))}
        if re.search(r'^\s*tempweaponcustomok=true;\s*$', tmptext) and tmppending:
            tmprule = {"any": True}
        if tmprule and tmppending:
            for tmpcase in tmppending:
                tmprules[tmpcase] = tmprule
            tmppending = []
    return tmpline, tmprules


# @MARKER ENERGY
# customizeItem's energy switch writes "[<dice>d<sides> <type> damage]"; Kinetic alone adds the dice
# count on again ("d4+" + dice).
def energy_dice():
    tmpline, tmpbody = function_body("customizeItem")
    tmptable, tmpcase = {}, None
    for tmptext in tmpbody:
        tmpm = re.search(r'case "([^"]+)":', tmptext)
        if tmpm:
            tmpcase = tmpm.group(1)
        tmpm = re.search(r'tmpweaponenergy=" \["\+tmpweaponmagicenergydice\+"d(\d+)(\+"\+tmpweaponmagicenergydice\+")?', tmptext)
        if tmpm and tmpcase:
            tmptable[tmpcase] = {"sides": int(tmpm.group(1)), "plusPerDie": 1 if tmpm.group(2) else 0}
    return tmpline, tmptable


# @MARKER WHAT RAISES THE PLUS
def plus_raisers():
    tmpline, tmpbody = function_body("updateMagicPlus")
    tmptext = "".join(tmpbody)
    tmpmagic = re.findall(r'tempweaponmagic=="([^"]+)"', tmptext)
    tmpdivine = re.findall(r'tmpweapondivine=="([^"]+)"', tmptext)
    return tmpline, sorted(set(tmpmagic), key=tmpmagic.index), sorted(set(tmpdivine), key=tmpdivine.index)


# @MARKER BY ATTACK MODE, AND THE DIVINE DICE
def magic_damage_details():
    tmpline, tmpbody = function_body("setMagicDamageDetails")
    tmptext = "".join(tmpbody)
    tmpmodes = {}
    for tmpability, tmpmode in re.findall(r'includes\("\[(\w+)\]"\)\s*&&\s*attackType\.includes\("(\w+)"\)', tmptext):
        tmpmodes[tmpability] = tmpmode.lower()
    tmpdivineattack = []
    tmpfirst = next((l for l in tmpbody if 'includes("Acidbrand") || tempWeaponName.includes("Arcbrand")' in l), "")
    tmpdivineattack = re.findall(r'includes\("([^"]+)"\)', tmpfirst)
    # "<brand>")) { tempDivineDice=""+tempDivineDicetoAdd+"d<sides>" -- the per-5-PC brands.
    # Only a block whose FIRST statement is the dice line is a plain brand: Divine Might works its
    # dice count out first (half the base Piety Control) and Rebuke rolls chest or head, and both are
    # their own rules in weapon-custom-rules.mjs rather than rows here.
    tmpbrands = {}
    for tmpindex, tmpline_text in enumerate(tmpbody):
        tmpm = re.search(r'if \(tempWeaponName\.includes\("([^"]+)"\)\)\s*\{', tmpline_text)
        if not tmpm or tmpindex + 1 >= len(tmpbody):
            continue
        tmpdice = re.search(r'^\s*tempDivineDice=""\+tempDivineDicetoAdd\+"d(\d+)"', tmpbody[tmpindex + 1])
        if tmpdice and tmpm.group(1) not in tmpbrands:
            tmpbrands[tmpm.group(1)] = int(tmpdice.group(1))
    # The name each brand's damage is reported under ("divine Cold damage"). One line of his names two
    # abilities -- Divine Strike and Divine Might are both Celestial -- so every name on it is taken.
    tmplabels = {}
    for tmpline_text in tmpbody:
        tmpm = re.search(r'energyType="([^"]+)"', tmpline_text)
        if tmpm and "if (tempWeaponName.includes(" in tmpline_text:
            for tmpname in re.findall(r'includes\("([^"]+)"\)', tmpline_text):
                tmplabels[tmpname] = tmpm.group(1)
    return tmpline, tmpmodes, tmpdivineattack, tmpbrands, tmplabels


def rune_modes():
    tmpline, tmpbody = function_body("handlePhysicalAttacks")
    tmpmodes, tmpmode = {}, None
    for tmptext in tmpbody:
        tmpm = re.search(r'temp(Thrust|Cut|Smash|Missile)Check=="on"', tmptext)
        if tmpm:
            tmpmode = tmpm.group(1).lower()
        tmpm = re.search(r'includes\("Rune (\w+):"\)', tmptext)
        if tmpm and tmpmode and tmpm.group(1) not in tmpmodes:
            tmpmodes[tmpm.group(1)] = tmpmode
    return tmpline, tmpmodes


# @MARKER REBUKE'S STROKES
# A Rebuke that strikes the head may bring on a stroke, and his d100 picks how bad: a ladder of
# "strokeEffectRoll<N" tests, each writing its sentence, the last one an else (below 101).
def rebuke_strokes():
    tmpline, tmpbody = function_body("setMagicDamageDetails")
    tmpladder, tmpbelow = [], None
    for tmptext in tmpbody:
        tmpm = re.search(r'strokeEffectRoll<(\d+)', tmptext)
        if tmpm:
            tmpbelow = int(tmpm.group(1))
        elif re.search(r'\}\s*else\s*\{\s*//\s*96-100', tmptext):
            tmpbelow = 101
        tmpm = re.search(r'tempMagicDamageDetails\+" ([A-Za-z ]+ Stroke: [^"]+)"', tmptext)
        if tmpm and tmpbelow is not None:
            tmpladder.append([tmpbelow, clean_text(tmpm.group(1))])
            tmpbelow = None
    return tmpline, tmpladder


# @MARKER WHAT A TAG DOES TO THE WEAPON'S FIGURES
# setEquippedWeaponInCombatSheet (sheet-worker.js:83420) puts an equipped weapon on his combat sheet
# through fifteen "listing changes" functions, in this order: the physical customizations, quality
# and condition first, then the magic. Each is a run of
#
#     if (tmpcombatweaponname.includes("[Chain Weapon]")) { newNumberOfDice=newNumberOfDice+1; damageChanged=true; }
#
# lines -- a tag, the figure it moves, and by how much -- and the magic ones a ladder on the plus
# ("+2 Long Sword" -> basePlusString "+2 "). Read here as data: [function, tags, figure, how, by].
# Anything that is not one of those lines (his Gravity rune's text-parsed figures, Repair and
# Invulnerability turning the strength into "[R]" and "[I]", Strenghthen's +5/+10) is left out and
# reported, for weapon-custom-rules.mjs to deal with or not.
LISTING_FUNCTIONS = [
    "getWeaponDamageListingChanges", "getWeaponSTRListingChanges", "getWeaponSpeedListingChanges",
    "getWeaponMinSpeedListingChanges", "getWeaponLengthChanges", "getWeaponSkillListingChanges",
    "getWeaponWeightListingChanges", "getWeaponToHitListingChanges",
    "getMagicWeaponDamageListingChanges", "getMagicWeaponSTRListingChanges", "getMagicWeaponSpeedListingChanges",
    "getMagicWeaponMinSpeedListingChanges", "getMagicWeaponSkillListingChanges",
    "getMagicWeaponWeightListingChanges", "getMagicWeaponToHitListingChanges",
]
# His working variable -> the port's weapon field it becomes.
LISTING_FIGURES = {
    "newNumberOfDice": "dice", "newDiceModifier": "diceMod",
    "newNumberOfDiceSpecial": "altDice", "newDiceModifierSpecial": "altDiceMod",
    "tempWeaponSTR": "structuralStrength", "calcWeaponCombatSpeed": "speed", "calcReloadSpeed": "reloadSpeed",
    "calcWeaponCombatMinSpeed": "minSpeed", "calcMinReloadSpeed": "reloadMinSpeed", "calcWeaponLength": "length",
    "calcSkillMod": "skillsMod", "calcWeaponWeight": "weight", "calcToHitMod": "toHit",
}


def listing_changes():
    tmprows, tmpladder, tmplines, tmpskipped = [], {}, {}, []
    for tmpfunction in LISTING_FUNCTIONS:
        tmpline, tmpbody = function_body(tmpfunction)
        tmplines[tmpfunction] = tmpline
        for tmptext in tmpbody:
            tmpm = re.search(r'if \((.+?)\) \{ (\w+)=\(?(\w+)([-+*])\(?([\w.]+)\)?\)?; \w+=true; \}', tmptext)
            if not tmpm:
                if "includes(" in tmptext and "if (" in tmptext and "Changed=true" in tmptext:
                    tmpskipped.append("%s: %s" % (tmpfunction, tmptext.strip()[:110]))
                continue
            tmpcondition, tmpvar, tmpbase, tmpop, tmpby = tmpm.groups()
            if tmpvar not in LISTING_FIGURES or tmpbase != tmpvar:
                tmpskipped.append("%s: %s" % (tmpfunction, tmptext.strip()[:110]))
                continue
            tmpfigure = LISTING_FIGURES[tmpvar]
            if tmpby in LISTING_FIGURES:
                tmphow, tmpvalue = "perDie", None          # "+(newNumberOfDice)": one for every die
            elif tmpop == "*":
                tmphow, tmpvalue = "times", float(tmpby)
            else:
                tmphow, tmpvalue = "add", (1 if tmpop == "+" else -1) * float(tmpby)
            if tmpvalue is not None and tmpvalue == int(tmpvalue):
                tmpvalue = int(tmpvalue)
            tmpplus = re.findall(r'basePlusString\.includes\("\+(\d+)"\)', tmpcondition)
            if tmpplus:
                tmpladder.setdefault(tmpplus[0], []).append([tmpfigure, tmphow, tmpvalue])
                continue
            tmptags = re.findall(r'tmpcombatweaponname\.includes\("\[([^\]]+)\]"\)', tmpcondition)
            if not tmptags:
                tmpskipped.append("%s: %s" % (tmpfunction, tmptext.strip()[:110]))
                continue
            tmprows.append([tmpfunction.replace("ListingChanges", "").replace("Changes", ""), tmptags, tmpfigure, tmphow, tmpvalue])
    tmpladder = {k: tmpladder[k] for k in sorted(tmpladder, key=int)}
    return tmplines, tmprows, tmpladder, tmpskipped


def js(tmpvalue):
    """One entry to a line, each written inline -- how he lays out his own dictionaries."""
    def tmpinline(tmpv):
        return json.dumps(tmpv, ensure_ascii=False)
    if isinstance(tmpvalue, list):
        return "[\n" + ",\n".join("\t" + tmpinline(v) for v in tmpvalue) + "\n]"
    if isinstance(tmpvalue, dict):
        tmpwidth = max((len(tmpinline(k)) for k in tmpvalue), default=0) + 1
        return "{\n" + ",\n".join("\t" + (tmpinline(k) + ":").ljust(tmpwidth + 1) + tmpinline(v)
                                   for k, v in tmpvalue.items()) + "\n}"
    return tmpinline(tmpvalue)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    tmpselects = panel_selects()
    tmpwanted = {
        "WEAPON_CONDITIONS": "item_custom_condition", "ITEM_QUALITIES": "item_custom_quality",
        "WEAPON_CUSTOMIZATIONS": "weapon_customization_select", "MAGIC_PLUS_CHOICES": "item_magic_plus",
        "MAGIC_WEAPON_ABILITIES": "item_magic_weapon", "WEAPON_RUNES": "item_weapon_rune",
        "ENERGY_TYPES": "item_magic_weapon_energy", "DIVINE_WEAPON_ABILITIES": "item_divine_weapon",
    }
    for tmpconst, tmpselect in tmpwanted.items():
        if not tmpselects.get(tmpselect):
            problems.append("no options found for " + tmpselect)

    tmprulesline, tmprules = customization_rules()
    for tmpvalue, _ in tmpselects.get("weapon_customization_select", []):
        if tmpvalue not in tmprules:
            problems.append("customization %s has no rule in checkWeaponCustomization" % tmpvalue)
    tmpenergyline, tmpenergy = energy_dice()
    for tmpvalue, _ in tmpselects.get("item_magic_weapon_energy", []):
        if tmpvalue not in tmpenergy:
            problems.append("energy %s has no dice in customizeItem" % tmpvalue)
    tmpplusline, tmpplusmagic, tmpplusdivine = plus_raisers()
    tmpdetailsline, tmpmodes, tmpdivineattack, tmpbrands, tmplabels = magic_damage_details()
    tmpruneline, tmprunemodes = rune_modes()
    tmpstrokeline, tmpstrokes = rebuke_strokes()
    if not tmpstrokes or tmpstrokes[-1][0] != 101:
        problems.append("Rebuke's stroke ladder does not end in an else")
    tmplistinglines, tmplisting, tmpplusladder, tmplistingskipped = listing_changes()
    # A tag his rules test that none of his panel's choices can write never fires in his sheet.
    tmpchoosable = set()
    for tmpselect in ("item_custom_condition", "item_custom_quality", "weapon_customization_select", "item_magic_weapon"):
        tmpchoosable.update(tmpvalue for tmpvalue, _ in tmpselects.get(tmpselect, []))
    tmpunchoosable = sorted({tmptag for tmprow in tmplisting for tmptag in tmprow[1] if tmptag not in tmpchoosable})
    for tmptag in tmpunchoosable:
        problems.append("listing rule for [%s], which no choice of his panel writes" % tmptag)

    with open(OUTFILE, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(MODULE_HEADER)
        fh.write("// @MARKER THE PANEL -- every option of his weapon selects, [value, his label], in his order.\n")
        for tmpconst, tmpselect in tmpwanted.items():
            fh.write("export const %s = %s;\n\n" % (tmpconst, js(tmpselects.get(tmpselect, []))))
        fh.write("// @MARKER WHICH WEAPONS -- checkWeaponCustomization (sheet-worker.js:%d). types are his\n"
                 "// weapon types; materials his material column; nameIncludes is tested against the name; the\n"
                 "// speed test is his weapon's MAXIMUM speed (his row's column 2).\n" % tmprulesline)
        fh.write("export const WEAPON_CUSTOMIZATION_RULES = %s;\n\n" % js(tmprules))
        fh.write("// @MARKER ENERGY -- customizeItem (sheet-worker.js:%d): N dice of this many sides, and for\n"
                 "// Kinetic N more on top.\n" % tmpenergyline)
        fh.write("export const ENERGY_DICE = %s;\n\n" % js(tmpenergy))
        fh.write("// @MARKER WHAT RAISES THE PLUS -- updateMagicPlus (sheet-worker.js:%d).\n" % tmpplusline)
        fh.write("export const PLUS_FROM_AURA = %s;\n\n" % js(tmpplusmagic))
        fh.write("export const PLUS_FROM_PIETY = %s;\n\n" % js(tmpplusdivine))
        fh.write("// @MARKER BY ATTACK MODE -- setMagicDamageDetails (sheet-worker.js:%d) for the abilities,\n"
                 "// handlePhysicalAttacks (sheet-worker.js:%d) for the runes.\n" % (tmpdetailsline, tmpruneline))
        fh.write("export const ABILITY_MODES = %s;\n\n" % js(tmpmodes))
        fh.write("export const RUNE_MODES = %s;\n\n" % js(tmprunemodes))
        fh.write("// @MARKER DIVINE -- the abilities that make a strike divine, the die each brand rolls per 5\n"
                 "// base Piety Control, and the name its damage is reported under. setMagicDamageDetails.\n")
        fh.write("export const DIVINE_ATTACKS = %s;\n\n" % js(tmpdivineattack))
        fh.write("export const DIVINE_BRAND_DICE = %s;\n\n" % js(tmpbrands))
        fh.write("export const DIVINE_ENERGY_LABELS = %s;\n\n" % js(tmplabels))
        fh.write("// @MARKER REBUKE'S STROKES -- setMagicDamageDetails (sheet-worker.js:%d). [below, what it does]:\n"
                 "// a d100 LESS THAN below takes the line.\n" % tmpstrokeline)
        fh.write("export const REBUKE_STROKES = [\n%s\n];\n\n"
                 % ",\n".join("\t" + json.dumps(tmprow, ensure_ascii=False) for tmprow in tmpstrokes))
        fh.write("// @MARKER WHAT A TAG DOES TO THE WEAPON'S FIGURES -- setEquippedWeaponInCombatSheet\n"
                 "// (sheet-worker.js:83420) runs an equipped weapon through these, in this order, from\n"
                 "// getWeaponDamageListingChanges (sheet-worker.js:%d) to getMagicWeaponToHitListingChanges\n"
                 "// (sheet-worker.js:%d). A row is [his function, the tags any one of which sets it off, the figure,\n"
                 "// how, by]: \"add\" adds, \"times\" multiplies, \"perDie\" adds one for every die the damage has.\n"
                 "// dice and diceMod are the damage's, altDice and altDiceMod its bracketed second damage (damageAlt).\n"
                 % (tmplistinglines[LISTING_FUNCTIONS[0]], tmplistinglines[LISTING_FUNCTIONS[-1]]))
        fh.write("//          function                   tags                                   figure                how       by\n")
        fh.write("export const WEAPON_LISTING_CHANGES = [\n%s\n];\n\n"
                 % ",\n".join("\t" + json.dumps(tmprow, ensure_ascii=False) for tmprow in tmplisting))
        fh.write("// @MARKER WHAT THE PLUS DOES TO THE WEAPON'S FIGURES -- the same functions' ladders on the magical\n"
                 "// plus, his \"basePlusString\": [figure, how, by] for each plus.\n")
        fh.write("export const MAGIC_PLUS_LISTING = %s;\n" % js(tmpplusladder))
        fh.write("\n// @END (CODE)\n")

    print("wrote %s (%.1f KB)" % (os.path.relpath(OUTFILE, ROOT), os.path.getsize(OUTFILE) / 1024))
    for tmpconst, tmpselect in tmpwanted.items():
        print("  %-26s %3d" % (tmpconst, len(tmpselects.get(tmpselect, []))))
    print("  customization rules %d, energy %d, plus from aura %d / piety %d, ability modes %d, rune modes %d, brands %d"
          % (len(tmprules), len(tmpenergy), len(tmpplusmagic), len(tmpplusdivine), len(tmpmodes), len(tmprunemodes), len(tmpbrands)))
    print("  listing changes %d rows, plus ladder %d steps" % (len(tmplisting), len(tmpplusladder)))
    for tmpskipped in tmplistingskipped:
        print("  LEFT TO THE RULES  " + tmpskipped)
    for tmpproblem in problems:
        print("  PROBLEM  " + tmpproblem)


MODULE_HEADER = """// @START (CODE)
// @MARKER WEAPON CUSTOMIZATION TABLES
//==================================================================================================================
// GENERATED FILE -- do not edit by hand.
// Produced by tools/extract/extract_weapon_custom_tables.py from the original Roll20 sheet and sheet-worker.
// Regenerate rather than editing, or this will drift from his sheet.
//
// His Equipment tab's CUSTOMIZE ITEMS panel, the weapon half: what it offers, which weapons may take
// what, and the numbers his attack reads back out of a customized weapon. The rules that use these
// are in module/weapon-custom-rules.mjs; the window is module/apps/weapon-mods.mjs.
//==================================================================================================================

"""


if __name__ == "__main__":
    main()
