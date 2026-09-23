#!/usr/bin/env python3
"""
column_maps.py -- names for the positional columns of each data dictionary.

Build-time tooling. Not shipped with the Foundry system.

Every map below is sourced, and the source matters when auditing these against
his sheet later:

  "header"  -- taken from the column-header comment he wrote above the
               dictionary itself.
  "code"    -- derived from how the sheet-worker consumes the row, i.e. the
               field each index is written to via setAttrs. Produced by
               derive_column_maps.py; the comment records the variable and
               line to check against.
  "obvious" -- the dictionary is self-describing (a list of title names by
               index, a pair of attribute abbreviations, and so on).

Names here are lightly normalised from his field names: the `race_tmp_`
prefix in the race map is an artefact of the body-transform code path that
happens to read the table, not part of the race definition, so it is dropped.
Where a name is not obvious from the index, his original field name is kept so
the mapping stays checkable against his code.
"""

# ---------------------------------------------------------------------------
# @MARKER CORE SCOPE MAPS
# ---------------------------------------------------------------------------

    # skilldict -- source: header comment at sheet-worker.js:52755
SKILLDICT = [
    "attr1", "attr2", "skillRating", "startingDice", "time",
    "types", "learn", "sourcebook", "page", "description",
]

    # socialskilldict -- source: code. No header comment exists. Column 4 is
    # confirmed as learn time by getSocialSkillLearnTime (sheet-worker.js:56769),
    # which reads skillDetails[4] and falls back to skillDetails[2]*4.
SOCIALSKILLDICT = [
    "attr1", "attr2", "skillRating", "startingDice", "learnTime",
    "sourcebook", "page", "description",
]

    # weaponvalueslist -- source: header comment at sheet-worker.js:79269
WEAPONVALUESLIST = [
    "damage", "strength", "speed", "minSpeed", "length",
    "missile", "thrust", "cut", "smash", "skills",
    "weight", "type", "material",
    "rangePointBlank", "rangeShort", "rangeMedium", "rangeLong", "rangeExtreme",
]

    # armorvalueslist -- source: header comment at sheet-worker.js:79901.
    # Columns 2-20 are per-body-location armour values; column 1 is the
    # flexibility class (Clothing / Flexible / Semi-Flexible / Rigid), which
    # drives the layering rules.
ARMORVALUESLIST = [
    "material", "flexibility",
    "head", "neck", "shoulderLeft", "shoulderRight",
    "torsoUpper", "torsoMid", "torsoLower",
    "armLeft", "armRight", "forearmLeft", "forearmRight",
    "handLeft", "handRight",
    "thighLeft", "thighRight", "shinLeft", "shinRight",
    "footLeft", "footRight",
    "weight",
]

    # equipvalueslist -- source: header comment at sheet-worker.js:80697
EQUIPVALUESLIST = ["weight"]

    # raceStatsAndMoveDetails -- source: code. 62 unlabelled columns, derived
    # from tempRaceStatMoves reads at sheet-worker.js:33697-33758.
RACESTATSANDMOVEDETAILS = [
    # 0-11: attribute modifiers granted by the race
    "strMod", "aglMod", "vitMod", "intMod", "wisMod", "knwMod",
    "appMod", "chmMod", "socMod", "aurMod", "ptyMod", "wilMod",
    # 12-23: per-race attribute caps
    "strLimit", "aglLimit", "vitLimit", "intLimit", "wisLimit", "knwLimit",
    "appLimit", "chmLimit", "socLimit", "aurLimit", "ptyLimit", "wilLimit",
    # 24-29: endurance at creation, and per-title endurance advancement
    "startEnduranceFormula", "startEnduranceMod",
    "titleEnduranceFormula", "titleEnduranceDice",
    "titleEnduranceMax", "titleEnduranceMod",
    # 30-32: derived characteristics
    "perceptionMod", "affinityMod", "fortuneMod",
    # 33-37: resistances
    "magicResistMod", "illusionResistMod", "controlResistMod",
    "poisonResistMod", "diseaseResistMod",
    # 38-47: movement
    "speedMultiplier",
    "walkHourly", "walk10Sec", "walk1Sec",
    "jogHourly", "jog10Sec", "jog1Sec",
    "runHourly", "run10Sec", "run1Sec",
    # 48-57: special movement mode (fly, swim, scurry, ...)
    "specialMoveName",
    "specialHourly", "specialHourlyMultiplier", "specialHourlyMod",
    "special10Sec", "special10SecMultiplier", "special10SecMod",
    "special1Sec", "special1SecMultiplier", "special1SecMod",
    # 58-61
    "jumpStand", "jumpUp", "formless", "canSwim",
]

    # classRequirementsAndDetails -- source: code, derived from classDetails
    # reads at sheet-worker.js:51002-51023.
CLASSREQUIREMENTSANDDETAILS = [
    "isCaster", "isInvoker", "casterStartTitle", "invokerStartTitle",
    "communeTitleMod", "attackSkill", "attackSkillList",
    "alignRequirements", "focusAttributes", "description", "classType",
    "classMod1", "classMod2", "classMod3", "classMod4", "classMod5",
    "armorUsage", "weaponUsage", "classModifier", "titleName",
    "attribQualify", "casting",
]

    # classtitledict -- source: obvious. Positional list of the title names a
    # class earns as it advances; index 0 is Title 1. Row length is not fixed
    # (91 classes list 15 titles, 1 lists 16), so this is kept as a list rather
    # than fixed columns.
CLASSTITLEDICT = "LIST:titles"

    # goalupdict -- source: obvious. The two attributes a class may raise on a
    # goal advance.
GOALUPDICT = ["goalAttr1", "goalAttr2"]

    # archmortalqualifylist -- source: HIS OWN COLUMN-HEADER COMMENT, written
    # above the dictionary at sheet-worker.js:122310-122311. What a character of
    # this class must have before they may pass 10th title into Arch Mortal.
    #
    # The twelve attribute columns are read by setArchmortalAttributeQualifications
    # (122429 onward), and are not plain numbers:
    #     ""            no requirement at all
    #     "RM"          the character's racial MAXIMUM for that attribute
    #     a positive n  that rating
    #     a negative n  the racial maximum plus n, so "-1" is one below it,
    #                   floored at 0
    # The five skill columns each pair a skill name with the chance it must have
    # reached. The last column is a requirement only a Game Master can judge
    # ("Known for the discovery of a valuable magical item"), and "None" means
    # there is none.
ARCHMORTALQUALIFYLIST = [
    "str", "agl", "vit", "int", "wis", "knw",
    "app", "chm", "soc", "aur", "pty", "wil",
    "skill1", "chance1", "skill2", "chance2", "skill3", "chance3",
    "skill4", "chance4", "skill5", "chance5", "special",
]

# ---------------------------------------------------------------------------
# @MARKER ATTRIBUTE RATING TABLES
# ---------------------------------------------------------------------------
    # The twelve *RatingValues tables are keyed by attribute rating 0-30 and
    # hold that rating's derived modifiers. Columns differ per attribute and
    # match the attribute tables in the Player's Guide and Master's Manual.
    # Source: code, from changeAttribs (sheet-worker.js:29647 onward).

    # All twelve verified against the setAttrs reads in changeAttribs
    # (sheet-worker.js:29647-30260) rather than inferred from the rulebook
    # tables -- four of them (app, aur, pty, wil) carry extra "special"
    # columns that the printed tables do not show.
RATING_VALUE_MAPS = {
    "strRatingValues": ["meleeAttack", "meleeDamage", "loadLimit", "weaponSpeed"],
    "aglRatingValues": ["missileAttack", "defensiveAdjust", "initiativeAdjust", "weaponSpeed"],
    "vitRatingValues": ["healingRate", "poisonResist", "diseaseResist"],
    "intRatingValues": ["spokenLanguages", "writtenLanguages", "auraControlAdjust",
                        "initiativeAdjust", "controlResistAdjust"],
    "wisRatingValues": ["pietyControl", "illusionResist", "controlResistAdjust"],
    "knwRatingValues": ["classSkills", "raceSkills", "socialSkills", "memorizationPoints"],
    "appRatingValues": ["morale", "controlAdjust", "special", "specialChance"],
    "chmRatingValues": ["morale", "controlAdjust"],
    "socRatingValues": ["morale", "rank"],
    "aurRatingValues": ["magicResist", "regenBonusLabel", "regenBonus"],
    "ptyRatingValues": ["commune", "specialLabel", "specialNum"],
    "wilRatingValues": ["controlResist", "endure", "specialLabel", "specialNum"],
}

    # armorpenaltydict -- source: header comment at sheet-worker.js:107061 ("skills def
    # init speed"). Keyed by the same armour names as armorvalueslist, covering only the
    # pieces that actually encumber the wearer.
ARMORPENALTYDICT = ["skills", "defense", "initiative", "speed"]

    # abilitylist / disabilitylist / immunitylist -- source: header comment above each
    # dictionary, e.g. sheet-worker.js:176212 ("Name  Value1  Value2  Description").
    #
    # There are two copies of each: a smaller one used for racial abilities on the character
    # side (getRacialAbilityDetails and its twins, lines 45721, 45899, 45984) and a larger
    # creature-side one (getCreatureAbilityDetails and twins, lines 176209, 177693, 177961).
    # Both are mapped, because they disagree -- see docs/UPSTREAM-ISSUES.md item 10.
    #
    # Column 0 is a canonical name that is NOT always the key it is looked up by: the key
    # "Acid Regeneration" carries the canonical name "Regeneration(Acid)", and three spellings
    # of "360-degree vision" all resolve to one entry. Columns 1 and 2 are values whose meaning
    # is per entry rather than per column, which is why they stay strings downstream.
TRAITDICT = ["canonicalName", "value1", "value2", "description"]

# ---------------------------------------------------------------------------
# @MARKER MARTIAL ARTS MAPS
# ---------------------------------------------------------------------------
    # The eight martial arts dictionaries -- source: HIS OWN COLUMN-HEADER COMMENTS, written on
    # the line above each dictionary inside its accessor function (getMartialKnowAttackValues and
    # its seven siblings, sheet-worker.js:100674-100838). Every one of them was also checked
    # against how setMartialKnowDisplayValues / setMartialLoreDisplayValues read the row
    # (sheet-worker.js:99715, 100338): index 1 goes to *_rating, 2 to *_rating_mod, 3 to *_speed.
    #
    # His header calls column 2 "Skill". It is the subskill's MODIFIER to the parent skill's
    # chance, not a chance of its own -- Player's Guide p.93, "Subskills": the difference between
    # the parent skill's rating (Martial Knowledge 16, Martial Lore 18) and the subskill's rating,
    # times 5%. So it is named skillMod here. extract_combat_tables.py checks every row against
    # that formula and reports the one that does not fit (Jump).
    #
    # "speed" is kept as his TEXT for moves and throws, because a leading "+" or "-" there means
    # "added to the attack it is combined with" rather than a time of its own -- Spinning "+2",
    # Snap "-1". The generator parses the number and keeps the text beside it.
MARTIALATTACKVALUESLIST     = ["name", "rating", "skillMod", "speed", "minSpeed", "damage", "special"]
MARTIALBLOCKVALUESLIST      = ["name", "rating", "skillMod", "speed", "special"]
MARTIALHOLDVALUESLIST       = ["name", "rating", "skillMod", "speed", "special"]
MARTIALMOVEVALUESLIST       = ["name", "rating", "skillMod", "speed", "special"]
MARTIALTHROWVALUESLIST      = ["name", "rating", "skillMod", "speed", "damage", "special"]
    # martiallorevalueslist -- his header: "Name Type Rating Skill Special". Type is which of the
    # five Martial Knowledge families the Lore value extends (Attack, Block, Hold, Throw, Move).
MARTIALLOREVALUESLIST       = ["name", "type", "rating", "skillMod", "special"]
    # The two stance dictionaries are text only -- "Name Special". The NUMBERS a stance applies
    # are not in either dictionary; they are in handleStanceOn's switch, which
    # extract_combat_tables.py walks.
MARTIALKNOWSTANCEVALUESLIST = ["name", "special"]
MARTIALLORESTANCEVALUESLIST = ["name", "special"]


# ---------------------------------------------------------------------------
# @MARKER MAGIC AND LORE MAPS
# ---------------------------------------------------------------------------
# His Magic/Lore tab (the "e" button, sheet-magiclore) -- the consumables, the lores, the spells
# and the invocations. Every one of these carries a header comment of his own above the
# dictionary, so every map below is sourced "header", and each one keeps the name as column 0
# because his rows repeat it there (the build checks the two agree -- one potion row does not).

    # herblist -- source: header comment at sheet-worker.js:128573
HERBLIST          = ["name", "herbType", "value", "potency", "duration", "description"]
    # potionlist -- source: header comment at sheet-worker.js:133023
POTIONLIST        = ["name", "value", "duration", "description"]
    # elixirlist -- source: header comment at sheet-worker.js:134740
ELIXIRLIST        = ["name", "value", "duration", "description"]
    # charmlist -- source: header comment at sheet-worker.js:135629
CHARMLIST         = ["name", "form", "willCost", "duration", "description"]
    # balladlist -- source: header comment at sheet-worker.js:136861
BALLADLIST        = ["name", "rating", "modifier", "startTime", "duration", "description"]
    # candlelorelist -- source: header comment at sheet-worker.js:137466. "Candles" is the colour
    # code of the candles the ritual burns ("BL,BN,GY").
CANDLELORELIST    = ["name", "rating", "modifier", "startTime", "duration", "component", "description"]
    # empathymagiclist -- source: header comment at sheet-worker.js:137970. "Object" is the focus.
EMPATHYMAGICLIST  = ["name", "rating", "modifier", "startTime", "duration", "component", "description"]
    # glyphlist -- source: header comment at sheet-worker.js:138530
GLYPHLIST         = ["name", "rating", "modifier", "description"]
    # hymnlorelist -- source: header comment at sheet-worker.js:139116
HYMNLORELIST      = ["name", "rating", "modifier", "startTime", "duration", "description"]
    # poemlist -- source: header comment at sheet-worker.js:141890. SEVEN columns under a header of
    # six names: "Start Time" is two cells, the amount and its unit ("3d6", "sec."), which every
    # one of the 51 rows keeps apart. The build joins them.
POEMLIST          = ["name", "rating", "modifier", "startTime", "startTimeUnit", "duration", "description"]
    # rituallist -- source: header comment at sheet-worker.js:143037
RITUALLIST        = ["name", "rating", "modifier", "startTime", "duration", "description"]
    # runelist -- source: header comment at sheet-worker.js:143887
RUNELIST          = ["name", "rating", "modifier", "runeType", "description"]
    # songlist -- source: header comment at sheet-worker.js:145378
SONGLIST          = ["name", "rating", "modifier", "startTime", "duration", "description"]
    # sympathymagiclist -- source: header comment at sheet-worker.js:146295. "Object" again.
SYMPATHYMAGICLIST = ["name", "rating", "modifier", "startTime", "duration", "component", "description"]
    # evokedict -- source: obvious. His comment calls it "the data dictionary object for all evoke
    # abilities" and each row is a name and one sentence.
EVOKEDICT         = ["name", "description"]
    # spellslist -- source: header comment at sheet-worker.js:160160. "Magic Name" is the spell's
    # name in the old tongue (Chill is "Ath-Carmor"); "Type" is his aspect list ("Cre, Dis, Eng").
SPELLSLIST        = ["name", "level", "magicName", "save", "memTime", "spellTypes", "fail",
                     "castTime", "range", "area", "duration", "distance", "description"]
    # invocationslist -- source: header comment at sheet-worker.js:152811. "Uses/Per" is a
    # fraction of a day, ".166" for once in six days.
INVOCATIONSLIST   = ["name", "level", "alignment", "save", "prayerTime", "uses", "invokeTime",
                     "range", "area", "duration", "distance", "description"]

MAPS = {
    "skilldict": SKILLDICT,
    "abilitylist@176213": TRAITDICT,
    "abilitylist@45725": TRAITDICT,
    "disabilitylist@177698": TRAITDICT,
    "disabilitylist@45903": TRAITDICT,
    "immunitylist@177965": TRAITDICT,
    "immunitylist@45988": TRAITDICT,
    "armorpenaltydict": ARMORPENALTYDICT,
    "socialskilldict": SOCIALSKILLDICT,
    "weaponvalueslist": WEAPONVALUESLIST,
    "armorvalueslist": ARMORVALUESLIST,
    "equipvalueslist": EQUIPVALUESLIST,
    "raceStatsAndMoveDetails": RACESTATSANDMOVEDETAILS,
    "classRequirementsAndDetails": CLASSREQUIREMENTSANDDETAILS,
    "classtitledict": CLASSTITLEDICT,
    "goalupdict": GOALUPDICT,
    "archmortalqualifylist": ARCHMORTALQUALIFYLIST,
    "martialattackvalueslist": MARTIALATTACKVALUESLIST,
    "martialblockvalueslist": MARTIALBLOCKVALUESLIST,
    "martialholdvalueslist": MARTIALHOLDVALUESLIST,
    "martialmovevalueslist": MARTIALMOVEVALUESLIST,
    "martialthrowvalueslist": MARTIALTHROWVALUESLIST,
    "martiallorevalueslist": MARTIALLOREVALUESLIST,
    "martialknowstancevalueslist": MARTIALKNOWSTANCEVALUESLIST,
    "martiallorestancevalueslist": MARTIALLORESTANCEVALUESLIST,
    "herblist": HERBLIST,
    "potionlist": POTIONLIST,
    "elixirlist": ELIXIRLIST,
    "charmlist": CHARMLIST,
    "balladlist": BALLADLIST,
    "candlelorelist": CANDLELORELIST,
    "empathymagiclist": EMPATHYMAGICLIST,
    "glyphlist": GLYPHLIST,
    "hymnlorelist": HYMNLORELIST,
    "poemlist": POEMLIST,
    "rituallist": RITUALLIST,
    "runelist": RUNELIST,
    "songlist": SONGLIST,
    "sympathymagiclist": SYMPATHYMAGICLIST,
    "evokedict": EVOKEDICT,
    "spellslist": SPELLSLIST,
    "invocationslist": INVOCATIONSLIST,
}
MAPS.update(RATING_VALUE_MAPS)


# A row in his data that is the wrong width, and the repair HE has confirmed for it.
#
# Nothing goes in here on our own reading. Each entry cites the answer that authorised it, and
# each is reported every run, because this is the one place the extraction changes his data
# rather than recording a problem with it.
#
#   (dictionary, key) -> (expected width the row is short of, index to insert a blank at, why)
ROW_REPAIRS = {
    ("classRequirementsAndDetails", "Monk"): (
        21, 15,
        "Monk carries 4 classMod slots where every other class has 5, shifting armourUsage, "
        "weaponUsage, classModifier, titleName, attribQualify and casting one left. Confirmed "
        "2026-09-16: 'sounds like the right fix'. See docs/UPSTREAM-ISSUES.md item 1."
    ),
}
