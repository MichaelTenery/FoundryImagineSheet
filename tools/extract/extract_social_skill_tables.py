#!/usr/bin/env python3
"""
extract_social_skill_tables.py -- the race and cross-skill modifiers on starting skills.

Build-time tooling. Not shipped with the Foundry system.

His sheet adds four kinds of modifier to a new character's skills that the port never carried
(the project notes called them "social-class skill modifiers"; nothing here reads Social Class --
the right name is "race and cross-skill modifiers"):

    SOCIAL_SKILL_RACE_MODS      the race's own modifier on a social skill, or BLOCKED
                                socialskillmoddict, in getSocialSkillMods      sheet-worker.js:55503
    SOCIAL_FROM_SOCIAL_BONUS    one social skill lifting another (Mathematics gives Accounting +10%)
                                socialbonusfromsocial, getSocialSkillModsToSocialSkills   57681
    SOCIAL_TO_RACE_CLASS_BONUS  a social skill lifting a racial or class skill (Explorer: Cartography +25%)
                                socialbonustoraceclass, getRacialModsFromSocial           57120
    RACE_CLASS_TO_SOCIAL_BONUS  a racial or class skill lifting a social skill (Disguise: Acting +15%)
                                the switch in getRaceClassSocialMod                       57649
    SOCIAL_GENERAL_MODS         the text his "Social Skill Modifiers:" box shows for each skill
                                socialgeneralmods, getSocialSkillGeneralModifier          57367

The first four dictionaries were already parsed by parse_dictionaries.py into src/packs/raw/; this
only re-shapes them. The switch is walked here, the way extract_advancement_tables.py walks his
switches, so it stays tied to his code.

WHAT IS CHANGED FROM HIS TABLES, AND WHY. Two kinds of change, both printed on every run so
nothing moves out of sight:

  1. REPAIRS of four data slips that make a row do nothing (the recommended option, taken
     2026-09-23 while the user was away; provisional until confirmed -- DECISIONS.md):
        Farming/Planting, Foraging/Forestry    "Botany","Botanist","+10%" is out of pairs, so walked
                                               two at a time Botany gets the modifier "Botanist" and
                                               nothing after it ever matches. Read as one giver
                                               under two names: Botany and Botanist are the same
                                               skill twice (identical descriptions).
        Calligraphy                            lists Artisan twice; counted once
        Psychology                             "Truth Tell " has a trailing space and never matches
     and one reading his data needs to mean anything at all:
        Rope Use                               gives +10% to "Set Trap", which no player holds --
                                               they hold Set Trap(w) or Set Trap(u) (UPSTREAM 43)
     A giver or target that answers to more than one name is written "A|B" in the output. No
     skill name of his contains "|" (the port already writes a Half Race's two names that way).

  2. HIS ERRATA, which outranks his sheet (the user's ruling of 2026-09-21). His errata carries
     the race tables for Aspects of the Wild (Aspects.txt "Pg 23(After)"), Epitaph of the Fallen
     (Epitaph.txt "Pg: 57 (After)") and four fixes to Legends' own table (Legends.txt "Pg. 71").
     Thirteen entries disagree with the sheet; they are ERRATA_CHANGES below. The errata files are
     local-only and never committed, so the list IS committed, and a fresh clone regenerates the
     same tables. When the errata files ARE present, they are re-read and every entry compared
     with the finished table, so a new errata file that says something else is reported rather
     than missed. A race the errata leaves out of a skill keeps the sheet's value: the Dread Elf
     row plainly omits the generic Elf entries (Heavy Drinking BLOCKED and the rest), which still
     apply.

THE TRAIT SWITCH is NOT extracted. getExtraClassRacialMods (53467) is six cases of conditional
logic -- Famorian evokes, Climbing, Enhanced Hearing and Smell, Loud -- and is carried by hand in
module/social-skill-rules.mjs with line citations. This checks that its case labels and figures
are still in his code, so a changed sheet is noticed.

Usage:
    python tools/extract/extract_social_skill_tables.py
    python tools/extract/extract_social_skill_tables.py --errata "path/to/docs/reference/errata"
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "src", "packs", "raw")
DOCUMENTS = os.path.join(ROOT, "src", "packs", "documents")
WORKER = os.path.join(ROOT, "docs", "reference", "sheet-worker.js")
OUT = os.path.join(ROOT, "module", "social-skill-tables.mjs")
ERRATA_DEFAULT = os.path.join(ROOT, "docs", "reference", "errata")

lines = open(WORKER, encoding="utf-8", errors="replace").readlines()


# @MARKER ERRATA CHANGES
# The thirteen places his errata disagrees with socialskillmoddict. Each says what his sheet has
# (None: the race is not listed for that skill) and what the errata has, so if a newer sheet has
# already taken the change -- or moved somewhere else entirely -- the run says so.
#
# Race names are his sheet's: the errata's "Lamia" is the sheet's Katara (renamed per his master
# index, "Katara (Formerly Lamia)"), "Dark Fairy" is Fairy(Dark), and Se'eth is written with the
# sheet's curly apostrophe.
ERRATA_CHANGES = [
    # skill                race            his sheet   errata      file           where
    ("Climatology",        "Brok",         10,         5,          "Epitaph.txt", "Pg: 57 (After)"),
    ("Astronomy",          "Brok",         None,       5,          "Epitaph.txt", "Pg: 57 (After)"),
    ("Astronomy",          "Gaunt",        5,          10,         "Epitaph.txt", "Pg: 57 (After)"),
    ("Undertaking",        "Gaunt",        5,          10,         "Epitaph.txt", "Pg: 57 (After)"),
    ("Dancing",            "Changeling",   10,         15,         "Aspects.txt", "Pg 23(After)"),
    ("Dancing",            "Fairy(Dark)",  5,          10,         "Aspects.txt", "Pg 23(After)"),
    ("Pyrotechnics",       "Fairy(Dark)",  10,         5,          "Aspects.txt", "Pg 23(After)"),
    ("History",            "Dryad",        None,       5,          "Aspects.txt", "Pg 23(After)"),
    ("Wood Working",       "Katara",       15,         5,          "Aspects.txt", "Pg 23(After), as Lamia"),
    ("Mining/Tunneling",   "Ratahl",       10,         20,         "Aspects.txt", "Pg 23(After)"),
    ("Torturing",          "Se’eth",       5,          20,         "Aspects.txt", "Pg 23(After)"),
    ("Heavy Drinking",     "Sylph",        None,       "BLOCKED",  "Aspects.txt", "Pg 23(After)"),
    ("Running",            "Equara",       None,       20,         "Legends.txt", "Pg. 71"),
]

# The errata's spellings, and the sheet's. Only the names that differ.
ERRATA_RACE_NAMES = {
    # errata          his sheet
    "Dread Elf":      "Elf(Dread)",
    "Dark Fairy":     "Fairy(Dark)",
    "Lamia":          "Katara",
    "Ba'Cora":        "Ba’Cora",
    "Se'eth":         "Se’eth",
    "S'rett":         "S’rett",
}
ERRATA_SKILL_NAMES = {
    # errata                      his sheet
    "Woodworking":                "Wood Working",
    "Florist/Horticulturalist":   "Florist/Horticulturist",
    "Signalling":                 "Signaling",
    "Overseer":                   "Overseer/Manager",
}

# @MARKER NAME REPAIRS
# A target or giver his data names in a way no character can hold. The value is every name it
# answers to, written "A|B|C" in the output.
NAME_ALTERNATIVES = {
    # his name     the names it answers to                   why
    "Set Trap":    "Set Trap|Set Trap(w)|Set Trap(u)",       # UPSTREAM 43: players hold a variant
}


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


def load_raw(tmpname):
    tmpdata = json.load(open(os.path.join(RAW, tmpname + ".json"), encoding="utf-8"))
    return tmpdata["entries"], tmpdata.get("_source", {})


def percent(tmptext):
    """His "+10%" / "-10%" / "BLOCKED" as a number or the flag. Anything else is None."""
    tmpvalue = str(tmptext or "").strip()
    if tmpvalue == "BLOCKED":
        return "BLOCKED"
    m = re.fullmatch(r'([+-]?\d+)\s*%', tmpvalue)
    return int(m.group(1)) if m else None


def is_percent(tmptext):
    return percent(tmptext) is not None and tmptext != "BLOCKED"


# @MARKER RACE MODIFIERS
def race_mod_table(tmpentries):
    """
    socialskillmoddict as {skill: {race: modifier}}. His getSocialSkillMods walks each row in
    pairs and takes the FIRST pair naming the race, so a race listed twice keeps its first value.
    """
    tmpout, tmpnotes = {}, []
    for tmpskill, tmprow in tmpentries.items():
        tmpmods = {}
        if tmprow and tmprow[0] != "None":
            if len(tmprow) % 2:
                tmpnotes.append("ODD ROW %s: %d values, the last is ignored" % (tmpskill, len(tmprow)))
            for i in range(0, len(tmprow) - 1, 2):
                tmprace, tmpvalue = tmprow[i].strip(), percent(tmprow[i + 1])
                if tmpvalue is None:
                    tmpnotes.append("UNREADABLE %s / %s: %r" % (tmpskill, tmprace, tmprow[i + 1]))
                    continue
                if tmprace in tmpmods:
                    tmpnotes.append("listed twice: %s under %s (%s then %s); the first is kept, as his loop does"
                                    % (tmprace, tmpskill, tmpmods[tmprace], tmpvalue))
                    continue
                tmpmods[tmprace] = tmpvalue
        tmpout[tmpskill] = tmpmods
    return tmpout, tmpnotes


def apply_errata_changes(tmptable):
    """Lay ERRATA_CHANGES over the race table. Returns the lines to print."""
    tmpsaid = []
    for tmpskill, tmprace, tmpsheet, tmperrata, tmpfile, tmpwhere in ERRATA_CHANGES:
        tmprow = tmptable.setdefault(tmpskill, {})
        tmpnow = tmprow.get(tmprace)
        if tmpnow == tmperrata:
            tmpsaid.append("  already so in his sheet now: %s %s %s (%s %s) -- the change can come off the list"
                           % (tmprace, tmpskill, show(tmperrata), tmpfile, tmpwhere))
            continue
        if tmpnow != tmpsheet:
            tmpsaid.append("  SHEET MOVED: %s %s is %s in his sheet, the list expected %s; the errata's %s is applied"
                           % (tmprace, tmpskill, show(tmpnow), show(tmpsheet), show(tmperrata)))
        tmprow[tmprace] = tmperrata
        tmpsaid.append("  %-14s %-18s %-8s -> %-8s %s %s"
                       % (tmprace, tmpskill, show(tmpnow), show(tmperrata), tmpfile, tmpwhere))
    return tmpsaid


def show(tmpvalue):
    if tmpvalue is None:
        return "(none)"
    if tmpvalue == "BLOCKED":
        return "BLOCKED"
    return "%+d%%" % tmpvalue


# @MARKER ERRATA RE-CHECK
def read_errata_table(tmppath, tmpheader):
    """
    One of his "Social Skill Modifiers by New Races" tables: a header line, "Race:
    Modifiers/Restrictions", then one line per race until a blank line --
        Brok: Animal Husbandry +10%, ..., No Chirugeon, No Riding
    Returns {race: {skill: value}} in the sheet's names, and anything that could not be read.
    """
    tmptext = open(tmppath, encoding="utf-8", errors="replace").read().splitlines()
    tmpstart = next((i for i, l in enumerate(tmptext) if tmpheader in l), None)
    if tmpstart is None:
        return None, ["header not found: %r" % tmpheader]
    tmprows, tmpodd = {}, []
    for l in tmptext[tmpstart + 1:]:
        l = re.sub(r'\s+', ' ', l).strip()
        if not l:
            break
        if l.startswith("Race:"):
            continue
        tmprace, _, tmpbody = l.partition(":")
        tmprace = ERRATA_RACE_NAMES.get(tmprace.strip(), tmprace.strip())
        # "Tattoo Artistry, +10%" -- a figure split off from its skill by a stray comma.
        tmpitems = []
        for tmpitem in [x.strip() for x in tmpbody.split(",") if x.strip()]:
            if re.fullmatch(r'[+-]?\d+%', tmpitem) and tmpitems:
                tmpitems[-1] += " " + tmpitem
            else:
                tmpitems.append(tmpitem)
        tmpmods = {}
        for tmpitem in tmpitems:
            m = re.fullmatch(r'No (.+)', tmpitem)
            if m:
                tmpmods[ERRATA_SKILL_NAMES.get(m.group(1), m.group(1))] = "BLOCKED"
                continue
            # "Slave Driving 10%" and "Tumbling 5%" are written with no "+".
            m = re.fullmatch(r'(.+?)\s+\+?(-?\d+)%', tmpitem)
            if m:
                tmpmods[ERRATA_SKILL_NAMES.get(m.group(1), m.group(1))] = int(m.group(2))
                continue
            tmpodd.append("%s: %r has no figure, skipped" % (tmprace, tmpitem))
        tmprows[tmprace] = tmpmods
    return tmprows, tmpodd


def recheck_errata(tmptable, tmperratadir):
    """Compare every entry of his three errata tables with the finished race table."""
    tmpsaid = []
    tmpchecked, tmpdiffer = 0, 0
    for tmpfile, tmpheader in [("Aspects.txt", "Social Skill Modifiers by New Races"),
                               ("Epitaph.txt", "Social Skill Modifiers by New Races")]:
        tmppath = os.path.join(tmperratadir, tmpfile)
        if not os.path.exists(tmppath):
            tmpsaid.append("  %s not found" % tmpfile)
            continue
        tmprows, tmpodd = read_errata_table(tmppath, tmpheader)
        if tmprows is None:
            tmpsaid.extend("  %s: %s" % (tmpfile, o) for o in tmpodd)
            continue
        for o in tmpodd:
            tmpsaid.append("  %s: %s" % (tmpfile, o))
        for tmprace, tmpmods in tmprows.items():
            for tmpskill, tmpvalue in tmpmods.items():
                tmpchecked += 1
                if tmpskill not in tmptable:
                    tmpdiffer += 1
                    tmpsaid.append("  ERRATA NAMES AN UNKNOWN SKILL: %s %s (%s)" % (tmprace, tmpskill, tmpfile))
                    continue
                tmphave = tmptable[tmpskill].get(tmprace)
                if tmphave != tmpvalue:
                    tmpdiffer += 1
                    tmpsaid.append("  ERRATA DIFFERS: %s %s is %s here, %s in %s -- add it to ERRATA_CHANGES"
                                   % (tmprace, tmpskill, show(tmphave), show(tmpvalue), tmpfile))
    # Legends Pg. 71 is four sentences of prose about Legends' own table, not a table. Each is
    # checked for what it asks.
    tmppath = os.path.join(tmperratadir, "Legends.txt")
    if os.path.exists(tmppath):
        tmptext = open(tmppath, encoding="utf-8", errors="replace").read()
        tmpchecks = [
            ("Add Running +20% Equara", tmptable.get("Running", {}).get("Equara") == 20),
            ("Add Riding No Scethen or Arachen",
             tmptable.get("Riding", {}).get("Scethen") == "BLOCKED" and tmptable.get("Riding", {}).get("Arachen") == "BLOCKED"),
            ("Ferrier entry should be removed",
             not any(r in tmptable.get("Ferrier", {}) for r in ("Elf(Sea)", "Sha’Cora", "Merfolk", "Nixie"))),
            ("Mephit should be Mephyt", not any("Mephit" in r for row in tmptable.values() for r in row)),
        ]
        for tmpsentence, tmpholds in tmpchecks:
            tmpchecked += 1
            if tmpsentence not in tmptext:
                tmpdiffer += 1
                tmpsaid.append("  Legends.txt no longer says %r -- re-read its Pg. 71" % tmpsentence)
            elif not tmpholds:
                tmpdiffer += 1
                tmpsaid.append("  ERRATA DIFFERS: Legends.txt Pg. 71 %r is not true of the table" % tmpsentence)
        # Pg 42: "Grants Swimming Social Skill at +50%". The port keeps his code's reading -- the +50
        # only when Swimming is taken (decision of 2026-09-23) -- and says so here.
        if "Grants Swimming Social Skill at +50%" in tmptext:
            tmpsaid.append("  Legends.txt Pg 42 \"Grants Swimming Social Skill at +50%\": read as his code reads it,"
                           " +50 when Swimming is taken (not granted free)")
    else:
        tmpsaid.append("  Legends.txt not found")
    tmpsaid.insert(0, "  %d errata entries compared, %d differ" % (tmpchecked, tmpdiffer))
    return tmpsaid


# @MARKER PAIRED LISTS
def paired_rows(tmpentries, tmpreal, tmpwhat):
    """
    One of his [name, "+N%", name, "+N%", ...] dictionaries as {key: [[name, N], ...]}, with the
    repairs made and reported. tmpreal is the set of real row keys (placeholder slot rows such as
    "Open Slot" are dropped). A run of names with no figure between them is ONE entry answering
    to all of them -- the Botany/Botanist slip.
    """
    tmpout, tmpsaid = {}, []
    for tmpkey, tmprow in tmpentries.items():
        if tmpkey not in tmpreal:
            continue
        tmppairs, tmppending = [], []
        for tmpvalue in tmprow:
            if tmpvalue == "":
                continue
            if is_percent(tmpvalue):
                if not tmppending:
                    tmpsaid.append("  %s %s: a figure %s with no name before it, dropped" % (tmpwhat, tmpkey, tmpvalue))
                    continue
                if len(tmppending) > 1:
                    tmpsaid.append("  REPAIRED %s %s: %s read as ONE entry, %s"
                                   % (tmpwhat, tmpkey, " / ".join(tmppending), tmpvalue))
                tmppairs.append(["|".join(tmppending), percent(tmpvalue)])
                tmppending = []
            else:
                tmpname = tmpvalue.strip()
                if tmpname != tmpvalue:
                    tmpsaid.append("  REPAIRED %s %s: %r trimmed to %r" % (tmpwhat, tmpkey, tmpvalue, tmpname))
                tmppending.append(tmpname)
        if tmppending:
            tmpsaid.append("  %s %s: %s has no figure after it, dropped" % (tmpwhat, tmpkey, " / ".join(tmppending)))
        # The same name twice in one row. His loops would count it twice; one skill held once
        # should give its bonus once.
        tmpseen, tmpkept = set(), []
        for tmpname, tmpmod in tmppairs:
            if tmpname in tmpseen:
                tmpsaid.append("  REPAIRED %s %s: %s listed twice, counted once" % (tmpwhat, tmpkey, tmpname))
                continue
            tmpseen.add(tmpname)
            tmpkept.append([tmpname, tmpmod])
        # A name no character can hold, widened to the names that can (NAME_ALTERNATIVES).
        for tmppair in tmpkept:
            if tmppair[0] in NAME_ALTERNATIVES:
                tmpsaid.append("  REPAIRED %s %s: %r matches %s" % (tmpwhat, tmpkey, tmppair[0], NAME_ALTERNATIVES[tmppair[0]]))
                tmppair[0] = NAME_ALTERNATIVES[tmppair[0]]
        if tmpkept:
            tmpout[tmpkey] = tmpkept
    return tmpout, tmpsaid


# @MARKER THE RACIAL/CLASS SWITCH
def race_class_to_social():
    """
    getRaceClassSocialMod as {social skill: [[racial or class skill, N], ...]}. His switch:
        case "Acting":
            if (tmpclassskill=="Disguise") { tmpmod=15; }
    """
    tmpstart, tmpbody = function_body("getRaceClassSocialMod")
    tmpout, tmpcase = {}, None
    for l in tmpbody:
        m = re.search(r'case\s+"([^"]*)"\s*:', l)
        if m:
            tmpcase = m.group(1)
            continue
        m = re.search(r'tmpclassskill\s*==\s*"([^"]+)"\s*\)\s*\{\s*tmpmod\s*=\s*(-?\d+)', l)
        if m and tmpcase:
            tmpout.setdefault(tmpcase, []).append([m.group(1), int(m.group(2))])
    return tmpout, tmpstart


# @MARKER TRAIT SWITCH CHECK
# What module/social-skill-rules.mjs @MARKER TRAIT SWITCH carries by hand. If any of these is no
# longer in his code, his sheet has changed and the hand-carried copy needs re-reading.
TRAIT_SWITCH_EXPECTED = [
    # function                  text that must still be there                                what it is
    ("getExtraClassRacialMods", 'case "Berserking":',                                      "Berserking case"),
    ("getExtraClassRacialMods", "tmpextramods=50;",                                        "Berserking evoke +50"),
    ("getExtraClassRacialMods", 'case "Climb":',                                           "Climb case"),
    ("getExtraClassRacialMods", "tmpextramods=-50;",                                       "Hooves evoke -50"),
    ("getExtraClassRacialMods", "tmpextramods=tmpextramods+40;",                           "Climbing evoke +40"),
    ("getExtraClassRacialMods", "tmpextramods=tmpextramods+10;",                           "Climbing ability +10"),
    ("getExtraClassRacialMods", 'case "Direction Knowledge":',                             "Direction Knowledge case"),
    ("getExtraClassRacialMods", "tmpextramods=tmpTitle*10;",                               "Instinct(Navigation) 10 per title"),
    ("getExtraClassRacialMods", 'case "Listen":',                                          "Listen case"),
    ("getExtraClassRacialMods", 'case "Smell":',                                           "Smell case"),
    ("getExtraClassRacialMods", "tmpextramods=30;",                                        "Hearing / Smell +30"),
    ("getExtraClassRacialMods", 'case "Surprise Attack":',                                 "Surprise Attack case"),
    ("getExtraClassRacialMods", "tmpextramods=-20;",                                       "Loud -20"),
    ("getExtraClassRacialMods", "if (tmpextramods>=tmpmod) { tmpextramods=tmpextramods-tmpmod; }", "the excess rule"),
    ("getExtraSocialMods",      "tmpmod=tmpmod+15;",                                       "Falconry +15"),
    ("getExtraSocialMods",      "tmpmod=tmpmod+50;",                                       "Swimming ability +50"),
    ("getExtraSocialMods",      "tmpmod=tmpmod+30;",                                       "Webbed Feet/Hands +30"),
]


def check_trait_switch():
    tmpsaid, tmpbodies = [], {}
    for tmpfunction, tmptext, tmpwhat in TRAIT_SWITCH_EXPECTED:
        if tmpfunction not in tmpbodies:
            tmpstart, tmpbody = function_body(tmpfunction)
            tmpbodies[tmpfunction] = (tmpstart, "".join(tmpbody).replace(" ", "").replace("\t", ""))
        if tmptext.replace(" ", "") not in tmpbodies[tmpfunction][1]:
            tmpsaid.append("  DRIFT: %s (line %d) no longer has %s -- re-read the hand-carried copy"
                           % (tmpfunction, tmpbodies[tmpfunction][0], tmpwhat))
    return tmpsaid, {k: v[0] for k, v in tmpbodies.items()}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    tmperratadir = ERRATA_DEFAULT
    if "--errata" in sys.argv:
        tmperratadir = sys.argv[sys.argv.index("--errata") + 1]

    tmpskilldocs = json.load(open(os.path.join(DOCUMENTS, "skills.json"), encoding="utf-8"))
    tmpallskills = {d["name"] for d in tmpskilldocs}
    tmpraces = json.load(open(os.path.join(DOCUMENTS, "races.json"), encoding="utf-8"))
    tmpracenames = {r["name"] for r in tmpraces} | {r["system"].get("sourceRace", "") for r in tmpraces}

    # --- the race table, and the errata over it --------------------------------------------------
    tmpmodentries, tmpmodsource = load_raw("socialskillmoddict")
    tmpsocial = set(tmpmodentries)
    tmpracetable, tmpnotes = race_mod_table(tmpmodentries)
    print("race modifiers on social skills (socialskillmoddict, lines %s)" % tmpmodsource.get("lines"))
    print("  %d social skills, %d with a race modifier, %d race/modifier pairs"
          % (len(tmpracetable), sum(1 for v in tmpracetable.values() if v), sum(len(v) for v in tmpracetable.values())))
    for n in tmpnotes:
        print("  " + n)
    tmpunknownraces = sorted({r for row in tmpracetable.values() for r in row} - tmpracenames)
    if tmpunknownraces:
        print("  races not in the port's race list: %s" % ", ".join(tmpunknownraces))

    print("his errata laid over it (%d changes; the errata outranks the sheet)" % len(ERRATA_CHANGES))
    for l in apply_errata_changes(tmpracetable):
        print(l)
    if os.path.isdir(tmperratadir):
        print("re-checked against the local errata (%s)" % os.path.relpath(tmperratadir, ROOT))
        for l in recheck_errata(tmpracetable, tmperratadir):
            print(l)
    else:
        print("the errata files are not here (%s) -- the committed list above is applied unchecked"
              % os.path.relpath(tmperratadir, ROOT))

    # --- the cross-skill tables ------------------------------------------------------------------
    tmpfromentries, tmpfromsource = load_raw("socialbonusfromsocial")
    tmpdropped = sorted(set(tmpfromentries) - tmpsocial)
    print("social from social (socialbonusfromsocial, lines %s)" % tmpfromsource.get("lines"))
    print("  placeholder slot rows dropped: %s" % ", ".join(tmpdropped))
    tmpfromsocial, tmpsaid = paired_rows(tmpfromentries, tmpsocial, "socialbonusfromsocial")
    for l in tmpsaid:
        print(l)
    print("  %d skills receive, %d pairs" % (len(tmpfromsocial), sum(len(v) for v in tmpfromsocial.values())))
    for tmpkey, tmppairs in tmpfromsocial.items():
        for tmpname, _ in tmppairs:
            for tmpone in tmpname.split("|"):
                if tmpone not in tmpsocial:
                    print("  UNKNOWN GIVER %s -> %s: not a social skill" % (tmpone, tmpkey))
                if tmpone == tmpkey:
                    print("  SELF %s gives itself a bonus" % tmpkey)

    tmptoentries, tmptosource = load_raw("socialbonustoraceclass")
    print("social to racial/class (socialbonustoraceclass, lines %s)" % tmptosource.get("lines"))
    tmptoraceclass, tmpsaid = paired_rows(tmptoentries, tmpsocial, "socialbonustoraceclass")
    for l in tmpsaid:
        print(l)
    print("  %d skills give, %d pairs" % (len(tmptoraceclass), sum(len(v) for v in tmptoraceclass.values())))
    for tmpkey, tmppairs in tmptoraceclass.items():
        for tmpname, _ in tmppairs:
            if not any(tmpone in tmpallskills for tmpone in tmpname.split("|")):
                print("  UNKNOWN TARGET %s -> %s: in no skill document" % (tmpkey, tmpname))

    tmpraceclasstosocial, tmpswitchline = race_class_to_social()
    print("racial/class to social (getRaceClassSocialMod, line %d): %d skills, %d pairs"
          % (tmpswitchline, len(tmpraceclasstosocial), sum(len(v) for v in tmpraceclasstosocial.values())))
    for tmpkey, tmppairs in tmpraceclasstosocial.items():
        if tmpkey not in tmpsocial:
            print("  UNKNOWN %s: not a social skill" % tmpkey)
        for tmpname, _ in tmppairs:
            if tmpname not in tmpallskills:
                print("  UNKNOWN %s -> %s: in no skill document" % (tmpname, tmpkey))

    tmpgeneralentries, tmpgeneralsource = load_raw("socialgeneralmods")
    tmpgeneral = {}
    for tmpkey, tmprow in tmpgeneralentries.items():
        tmptext = " ".join(str(x).strip() for x in tmprow if str(x).strip())
        if tmpkey in tmpsocial and tmptext:
            tmpgeneral[tmpkey] = tmptext.replace("`", "'")
    print("social skill general modifiers (socialgeneralmods, lines %s): %d with text"
          % (tmpgeneralsource.get("lines"), len(tmpgeneral)))

    tmpdrift, tmpfunctionlines = check_trait_switch()
    print("trait switch (getExtraClassRacialMods, line %d): %s"
          % (tmpfunctionlines["getExtraClassRacialMods"], "every case and figure still there" if not tmpdrift else ""))
    for l in tmpdrift:
        print(l)

    write_module(tmpracetable, tmpfromsocial, tmptoraceclass, tmpraceclasstosocial, tmpgeneral,
                 tmpmodsource, tmpfromsource, tmptosource, tmpswitchline, tmpgeneralsource)


# @MARKER THE SHIPPED TABLE
def row(tmpkey, tmpvalue, tmpwidth):
    tmplabel = json.dumps(tmpkey, ensure_ascii=False) + ":"
    return "\t%s %s,\n" % (tmplabel.ljust(tmpwidth), json.dumps(tmpvalue, ensure_ascii=False))


def write_dict(fh, tmpname, tmpdict, tmpkeyheader, tmpvalueheader):
    """One dictionary, a row a line, with a column-header comment lined up over the two columns."""
    tmpwidth = max(len(json.dumps(k, ensure_ascii=False)) + 1 for k in tmpdict) if tmpdict else 20
    tmpwidth = max(tmpwidth, len(tmpkeyheader) + 3)
    fh.write("export const %s = {\n" % tmpname)
    fh.write("\t// %s %s\n" % (tmpkeyheader.ljust(tmpwidth - 3), tmpvalueheader))
    for tmpkey in tmpdict:
        fh.write(row(tmpkey, tmpdict[tmpkey], tmpwidth))
    fh.write("};\n\n")


def write_module(tmpracetable, tmpfromsocial, tmptoraceclass, tmpraceclasstosocial, tmpgeneral,
                 tmpmodsource, tmpfromsource, tmptosource, tmpswitchline, tmpgeneralsource):
    # Races with no modifier on a skill are left out of its row, and skills with no race modifier
    # at all are left out entirely -- a missing skill answers "no modifier", which is what "None"
    # meant in his dictionary.
    tmprace = {k: v for k, v in tmpracetable.items() if v}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(MODULE_HEADER)
        fh.write("// @MARKER RACE MODIFIERS ON SOCIAL SKILLS\n")
        fh.write("// socialskillmoddict (sheet-worker.js:%d-%d), read by getSocialSkillMods (55499): the first\n"
                 % tuple(tmpmodsource.get("lines", [0, 0])))
        fh.write("// race's modifier on each social skill. \"BLOCKED\" means that race may not take it -- his copy\n"
                 "// button refuses the pick (7420). His errata's thirteen changes are laid over it:\n")
        for tmpskill, tmpr, tmpsheet, tmperrata, tmpfile, tmpwhere in ERRATA_CHANGES:
            fh.write("//     %-16s %-18s %-8s -> %-8s %s %s\n" % (tmpr, tmpskill, show(tmpsheet), show(tmperrata), tmpfile, tmpwhere))
        fh.write("// A skill not listed has no race modifier for anyone.\n")
        write_dict(fh, "SOCIAL_SKILL_RACE_MODS", tmprace, "social skill", "{ race: modifier, ... }")

        fh.write("// @MARKER SOCIAL FROM SOCIAL\n")
        fh.write("// socialbonusfromsocial (sheet-worker.js:%d-%d), read by getExtraSocialMods (57623): keyed by the\n"
                 % tuple(tmpfromsource.get("lines", [0, 0])))
        fh.write("// skill that RECEIVES. \"Accounting\": [[\"Mathematics\", 10]] -- a character holding Mathematics\n"
                 "// gets +10% on Accounting (Player's Guide p.156 says it the same way round). A giver written\n"
                 "// \"A|B\" answers to either name. Repaired from his rows, and printed on every extraction:\n"
                 "//     Farming/Planting, Foraging/Forestry   \"Botany\",\"Botanist\",\"+10%\" out of pairs -> Botany|Botanist 10\n"
                 "//     Calligraphy                           Artisan listed twice -> counted once\n")
        write_dict(fh, "SOCIAL_FROM_SOCIAL_BONUS", tmpfromsocial, "receiving social skill", "[ [giving social skill, percent], ... ]")

        fh.write("// @MARKER SOCIAL TO RACIAL AND CLASS\n")
        fh.write("// socialbonustoraceclass (sheet-worker.js:%d-%d), read by getExtraClassRacialMods (53526): keyed\n"
                 % tuple(tmptosource.get("lines", [0, 0])))
        fh.write("// by the social skill that GIVES. \"Explorer\": [[\"Cartography\", 25], ...] -- a character holding\n"
                 "// Explorer gets +25% on Cartography, racial or class. Repaired, and printed on every extraction:\n"
                 "//     Psychology   \"Truth Tell \" had a trailing space -> Truth Tell\n"
                 "//     Rope Use     \"Set Trap\" -> Set Trap|Set Trap(w)|Set Trap(u), the names players hold (UPSTREAM 43)\n")
        write_dict(fh, "SOCIAL_TO_RACE_CLASS_BONUS", tmptoraceclass, "giving social skill", "[ [racial or class skill, percent], ... ]")

        fh.write("// @MARKER RACIAL AND CLASS TO SOCIAL\n")
        fh.write("// The switch in getRaceClassSocialMod (sheet-worker.js:%d), called from getExtraSocialMods: a\n" % tmpswitchline)
        fh.write("// social skill lifted by a racial or class skill the character holds. Each held skill is\n"
                 "// asked once, as his later getNewSocialSkillModifier does (125673-125679) -- his creation\n"
                 "// code passes the whole array instead and never matches (UPSTREAM 52).\n")
        write_dict(fh, "RACE_CLASS_TO_SOCIAL_BONUS", tmpraceclasstosocial, "receiving social skill", "[ [racial or class skill held, percent], ... ]")

        fh.write("// @MARKER GENERAL MODIFIERS\n")
        fh.write("// socialgeneralmods (sheet-worker.js:%d-%d), read by getSocialSkillGeneralModifier: the text his\n"
                 % tuple(tmpgeneralsource.get("lines", [0, 0])))
        fh.write("// sheet's \"Social Skill Modifiers:\" box shows for each social skill held. Display only -- none of\n"
                 "// it is a number added to a skill.\n")
        write_dict(fh, "SOCIAL_GENERAL_MODS", tmpgeneral, "social skill", "what his box says")
        fh.write("// @END (CODE)\n")
    print("wrote %s (%.1f KB)" % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024))


MODULE_HEADER = """// @START (CODE)
// @MARKER SOCIAL SKILL TABLES
//==================================================================================================================
// GENERATED FILE -- do not edit by hand.
// Produced by tools/extract/extract_social_skill_tables.py from the original Roll20 sheet-worker and his
// errata. Regenerate rather than editing, or this will drift from his sheet.
//
// The race and cross-skill modifiers on a new character's skills. Percentages are whole numbers:
// his "+10%" is 10 here. The rules that read these are module/social-skill-rules.mjs.
//==================================================================================================================

"""


if __name__ == "__main__":
    main()
