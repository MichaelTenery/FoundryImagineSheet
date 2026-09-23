// @START (CODE)
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

// @MARKER THE PANEL -- every option of his weapon selects, [value, his label], in his order.
export const WEAPON_CONDITIONS = [
	["Undamaged", "Undamaged"],
	["Restored", "Restored"],
	["Repaired", "Repaired"],
	["Worn", "Worn"],
	["Lightly Damaged", "Lightly Damaged"],
	["Damaged", "Damaged"],
	["Heavily Damaged", "Heavily Damaged"]
];

export const ITEM_QUALITIES = [
	["Shoddy", "Shoddy"],
	["Poor", "Poor"],
	["Average", "Average"],
	["Good", "Good"],
	["High", "High"],
	["Master", "Master"]
];

export const WEAPON_CUSTOMIZATIONS = [
	["Arm Blade", "Arm Blade(Blade)"],
	["Barbing", "Barbing(Piercing)"],
	["Basket Guard", "Basket Guard(Blade)"],
	["Bell Guard", "Bell Guard(Blade)"],
	["Chain Weapon", "Chain Weapon(3-5 Sec Weapon)"],
	["Dagger Hilt", "Dagger Hilt(Blade)"],
	["Double Head", "Double Head(Hammer)"],
	["Doubling Blade", "Doubling Blade(Axe)"],
	["Dulling", "Dulling(Cut/Piercing)"],
	["Envenomed", "Envenomed(Blade)"],
	["Hooked Blade", "Hooked Blade(Blade)"],
	["Serrated", "Serrated(Cut)"],
	["Silvering", "Silvering(Any)"],
	["Sprinkler", "Sprinkler(Smash)"],
	["Tempered", "Tempered(Metal)"],
	["Weapon Strap", "Weapon Strap(Any)"]
];

export const MAGIC_PLUS_CHOICES = [
	["Blessed", "Blessed(+1)"],
	["+1", "+1"],
	["+2", "+2"],
	["+3", "+3"],
	["+4", "+4"],
	["+5", "+5"],
	["+6", "+6"],
	["+7", "+7"],
	["+8", "+8"],
	["+9", "+9"],
	["+10", "+10"]
];

export const MAGIC_WEAPON_ABILITIES = [
	["Accuracy", "Accuracy"],
	["Animate Object", "Animate Object"],
	["Bane", "Bane"],
	["Clean", "Clean"],
	["Disruption", "Disruption"],
	["Foe Strike", "Foe Strike"],
	["Frictionless", "Frictionless"],
	["Fulcrum", "Fulcrum"],
	["Invulnerability", "Invulnerability"],
	["Lesser Force Weapon", "Lesser Force Weapon"],
	["Phase Weapon", "Phase Weapon"],
	["Piercing", "Piercing"],
	["Repair", "Repair"],
	["Shadow Weapon", "Shadow Weapon"],
	["Sharpness", "Sharpness"]
];

export const WEAPON_RUNES = [
	["Accuracy", "Accuracy"],
	["Disruption", "Disruption"],
	["Gravity", "Gravity"],
	["Invulnerability", "Invulnerability"],
	["Piercing", "Piercing"],
	["Retrieval", "Retrieval"],
	["Strenghthen Metal", "Strenghthen Metal"],
	["Strenghthen Wood", "Strenghthen Wood"],
	["Sharpness", "Sharpness"]
];

export const ENERGY_TYPES = [
	["Light", "Light"],
	["Sonic", "Sonic"],
	["Frost", "Frost"],
	["Kinetic", "Kinetic"],
	["Flame", "Flame"],
	["Electricity", "Electricity"],
	["Acid", "Acid"],
	["Aura/Divine", "Aura/Divine"],
	["Life/Death", "Life/Death"],
	["Obliteration", "Obliteration"]
];

export const DIVINE_WEAPON_ABILITIES = [
	["Acidbrand", "Acidbrand"],
	["Anti-Magic", "Anti-Magic"],
	["Anguish", "Anguish"],
	["Aphasia", "Aphasia"],
	["Arcbrand", "Arcbrand"],
	["Bane", "Bane"],
	["Blindness", "Blindness"],
	["Bravery", "Bravery"],
	["Center", "Center"],
	["Center", "Chaosbrand"],
	["Control Humanoid", "Control Humanoid"],
	["Deathbrand", "Deathbrand"],
	["Deflect", "Deflect"],
	["Detect Enemy", "Detect Enemy"],
	["Detect Evil", "Detect Evil"],
	["Detect Good", "Detect Good"],
	["Detect Supernatural", "Detect Supernatural"],
	["Dimensional Blockade", "Dimensional Blockade"],
	["Disable Immunity", "Disable Immunity"],
	["Dispel Divinity", "Dispel Divinity"],
	["Divine Blast", "Divine Blast"],
	["Divine Might", "Divine Might"],
	["Divine Retribution", "Divine Retribution"],
	["Divine Right", "Divine Right"],
	["Divine Strike", "Divine Strike"],
	["Divine Weapon", "Divine Weapon"],
	["Divine Wrath", "Divine Wrath"],
	["Doom", "Doom"],
	["Eye for an Eye", "Eye for an Eye"],
	["Fear", "Fear"],
	["Firebrand", "Firebrand"],
	["Freedom", "Freedom"],
	["Frostbrand", "Frostbrand"],
	["Grant Immunity", "Grant Immunity"],
	["Guard Body", "Guard Body"],
	["Guard Mind", "Guard Mind"],
	["Guard Personal", "Guard Personal"],
	["Guard Self", "Guard Self"],
	["Guard Soul", "Guard Soul"],
	["Hallowed Brand", "Hallowed Brand"],
	["Heroism", "Heroism"],
	["Hold Magical Humanoid", "Hold Magical Humanoid"],
	["Holy Touch", "Holy Touch"],
	["Imprison", "Imprison"],
	["Lifebrand", "Lifebrand"],
	["Profane Brand", "Profane Brand"],
	["Protection from Undead", "Protection from Undead"],
	["Rebuke", "Rebuke"],
	["Reflect Divinity", "Reflect Divinity"],
	["Regeneration", "Regeneration"],
	["Second Chance", "Second Chance"],
	["Spiritual Armor", "Spiritual Armor"],
	["Thunderclap", "Thunderclap"],
	["Thunderous Voice", "Thunderous Voice"],
	["Turn Divinity", "Turn Divinity"],
	["Unholy Touch", "Unholy Touch"]
];

// @MARKER WHICH WEAPONS -- checkWeaponCustomization (sheet-worker.js:81497). types are his
// weapon types; materials his material column; nameIncludes is tested against the name; the
// speed test is his weapon's MAXIMUM speed (his row's column 2).
export const WEAPON_CUSTOMIZATION_RULES = {
	"Arm Blade":      {"types": ["Blade"]},
	"Barbing":        {"types": ["Piercer", "Pick"]},
	"Basket Guard":   {"types": ["Blade"]},
	"Bell Guard":     {"types": ["Blade"]},
	"Dagger Hilt":    {"types": ["Blade"]},
	"Doubling Blade": {"types": ["Axe"]},
	"Dulling":        {"types": ["Axe", "Blade", "Piercer", "Pick"]},
	"Envenomed":      {"types": ["Blade"]},
	"Hooked Blade":   {"types": ["Blade"]},
	"Serrated":       {"types": ["Blade", "Axe"]},
	"Sprinkler":      {"types": ["Bludgeon"]},
	"Tempered":       {"materials": ["Metal"]},
	"Double Head":    {"nameIncludes": ["hammer"]},
	"Chain Weapon":   {"speedAbove": 2, "speedBelow": 6},
	"Silvering":      {"any": true},
	"Weapon Strap":   {"any": true}
};

// @MARKER ENERGY -- customizeItem (sheet-worker.js:78903): N dice of this many sides, and for
// Kinetic N more on top.
export const ENERGY_DICE = {
	"Light":        {"sides": 2, "plusPerDie": 0},
	"Sonic":        {"sides": 3, "plusPerDie": 0},
	"Frost":        {"sides": 4, "plusPerDie": 0},
	"Kinetic":      {"sides": 4, "plusPerDie": 1},
	"Flame":        {"sides": 6, "plusPerDie": 0},
	"Electricity":  {"sides": 8, "plusPerDie": 0},
	"Acid":         {"sides": 10, "plusPerDie": 0},
	"Aura/Divine":  {"sides": 12, "plusPerDie": 0},
	"Life/Death":   {"sides": 20, "plusPerDie": 0},
	"Obliteration": {"sides": 100, "plusPerDie": 0}
};

// @MARKER WHAT RAISES THE PLUS -- updateMagicPlus (sheet-worker.js:81461).
export const PLUS_FROM_AURA = [
	"Accuracy",
	"Piercing",
	"Sharpness",
	"Disruption"
];

export const PLUS_FROM_PIETY = [
	"Acidbrand",
	"Arcbrand",
	"Deathbrand",
	"Chaosbrand",
	"Divine Weapon",
	"Firebrand",
	"Frostbrand",
	"Hallowed Brand",
	"Lifebrand",
	"Profane Brand"
];

// @MARKER BY ATTACK MODE -- setMagicDamageDetails (sheet-worker.js:91318) for the abilities,
// handlePhysicalAttacks (sheet-worker.js:64357) for the runes.
export const ABILITY_MODES = {
	"Accuracy":   "missile",
	"Piercing":   "thrust",
	"Sharpness":  "cut",
	"Disruption": "smash"
};

export const RUNE_MODES = {
	"Piercing":   "thrust",
	"Sharpness":  "cut",
	"Disruption": "smash",
	"Accuracy":   "missile"
};

// @MARKER DIVINE -- the abilities that make a strike divine, the die each brand rolls per 5
// base Piety Control, and the name its damage is reported under. setMagicDamageDetails.
export const DIVINE_ATTACKS = [
	"Acidbrand",
	"Arcbrand",
	"Chaosbrand",
	"Deathbrand",
	"Divine Blast",
	"Divine Might",
	"Divine Wrath",
	"Divine Retribution",
	"Divine Strike",
	"Firebrand",
	"Frostbrand",
	"Hallowed Brand",
	"Lifebrand",
	"Profane Brand",
	"Rebuke"
];

export const DIVINE_BRAND_DICE = {
	"Frostbrand":     4,
	"Firebrand":      6,
	"Arcbrand":       8,
	"Divine Strike":  8,
	"Acidbrand":      10,
	"Chaosbrand":     12,
	"Hallowed Brand": 20,
	"Profane Brand":  20,
	"Deathbrand":     20,
	"Lifebrand":      20
};

export const DIVINE_ENERGY_LABELS = {
	"Hallowed Brand": "Holy",
	"Profane Brand":  "Unholy",
	"Lifebrand":      "Life",
	"Deathbrand":     "Death",
	"Chaosbrand":     "Chaos",
	"Acidbrand":      "Acid",
	"Arcbrand":       "Electricity",
	"Firebrand":      "Fire",
	"Frostbrand":     "Cold",
	"Divine Strike":  "Celestial",
	"Divine Might":   "Celestial"
};

// @MARKER REBUKE'S STROKES -- setMagicDamageDetails (sheet-worker.js:91318). [below, what it does]:
// a d100 LESS THAN below takes the line.
export const REBUKE_STROKES = [
	[26, "Mild Stroke: Confusion for 1d4 hours, aphasia and inability to walk for 1d4 hours and then returns to normal."],
	[51, "Average Stroke: Confusion for 1d4 hours, aphasia and inability to walk for 1d4 hours and may return to normal. Make Intelligence save or lose 1 point from Intelligence permanently."],
	[76, "Strong Stroke: Confusion for 1d4 hours, aphasia and inability to walk for 1d4 hours and may return to normal. Make Intelligence save or lose 1 point from Intelligence permanently. Make a Vitality save or lose 1 point of either Strength or Agility (50%/50%)."],
	[86, "Severe Stroke: Confusion for 1d4 hours, aphasia and inability to walk for 1d4 hours and may return to normal. Make Intelligence save or lose 1 point from Intelligence permanently. Make a Vitality save or lose 1 point of either Strength or Agility (50%/50%). Make a 2nd Vitality save or lose the ability to walk or talk (50%/50%)."],
	[96, "Debilitating Stroke: Confusion for 1d4 hours, aphasia and inability to walk for 1d4 hours and then returns to normal. Make Intelligence save or lose 2 points from Intelligence permanently. Make a Vitality save or lose 2 points of either Strength and Agility. Make a 2nd Vitality save or lose the ability to walk and talk."],
	[101, "Life Ending Stroke: Confusion for 1d4 hours, aphasia and inability to walk for 1d4 hours and then returns to normal. Make Intelligence save or lose 2 points from Intelligence permanently. Make a Vitality save or lose 2 points of either Strength and Agility. Make a 2nd Vitality save or lose the ability to walk and talk. Will Force save must be made or mentality is reduced to 1d4-1 for each attribute. Any 0 result eventually leads to death as a Will Force save must be made each day to continue living."]
];

// @MARKER WHAT A TAG DOES TO THE WEAPON'S FIGURES -- setEquippedWeaponInCombatSheet
// (sheet-worker.js:83420) runs an equipped weapon through these, in this order, from
// getWeaponDamageListingChanges (sheet-worker.js:89784) to getMagicWeaponToHitListingChanges
// (sheet-worker.js:90450). A row is [his function, the tags any one of which sets it off, the figure,
// how, by]: "add" adds, "times" multiplies, "perDie" adds one for every die the damage has.
// dice and diceMod are the damage's, altDice and altDiceMod its bracketed second damage (damageAlt).
//          function                   tags                                   figure                how       by
export const WEAPON_LISTING_CHANGES = [
	["getWeaponDamage", ["Chain Weapon"], "dice", "add", 1],
	["getWeaponDamage", ["Dulling"], "dice", "add", -1],
	["getWeaponDamage", ["Barbing", "Serrated"], "diceMod", "perDie", null],
	["getWeaponDamage", ["Shoddy", "Poor"], "diceMod", "add", -1],
	["getWeaponDamage", ["Good", "High", "Master"], "diceMod", "add", 1],
	["getWeaponDamage", ["Repaired"], "diceMod", "add", -1],
	["getWeaponDamage", ["Worn"], "diceMod", "add", -2],
	["getWeaponDamage", ["Lightly Damaged"], "diceMod", "add", -3],
	["getWeaponDamage", ["Damaged"], "diceMod", "add", -4],
	["getWeaponDamage", ["Heavily Damaged"], "diceMod", "add", -5],
	["getWeaponDamage", ["Chain Weapon"], "altDice", "add", 1],
	["getWeaponDamage", ["Barbing", "Serrated"], "altDiceMod", "perDie", null],
	["getWeaponDamage", ["Shoddy", "Poor"], "altDiceMod", "add", -1],
	["getWeaponDamage", ["Good", "High", "Master"], "altDiceMod", "add", 1],
	["getWeaponDamage", ["Repaired"], "altDiceMod", "add", -1],
	["getWeaponDamage", ["Worn"], "altDiceMod", "add", -2],
	["getWeaponDamage", ["Lightly Damaged"], "altDiceMod", "add", -3],
	["getWeaponDamage", ["Damaged"], "altDiceMod", "add", -4],
	["getWeaponDamage", ["Heavily Damaged"], "altDiceMod", "add", -5],
	["getWeaponSTR", ["Tempered"], "structuralStrength", "times", 1.5],
	["getWeaponSTR", ["Double Head", "Double Blade"], "structuralStrength", "times", 1.2],
	["getWeaponSTR", ["Barbing", "Serrated"], "structuralStrength", "times", 0.33],
	["getWeaponSTR", ["Shoddy"], "structuralStrength", "times", 0.75],
	["getWeaponSTR", ["Poor"], "structuralStrength", "times", 0.9],
	["getWeaponSTR", ["Good"], "structuralStrength", "times", 1.1],
	["getWeaponSTR", ["High"], "structuralStrength", "times", 1.15],
	["getWeaponSTR", ["Master"], "structuralStrength", "times", 1.25],
	["getWeaponSTR", ["Restored"], "structuralStrength", "times", 0.98],
	["getWeaponSTR", ["Repaired"], "structuralStrength", "times", 0.96],
	["getWeaponSTR", ["Worn"], "structuralStrength", "times", 0.85],
	["getWeaponSTR", ["Lightly Damaged"], "structuralStrength", "times", 0.7],
	["getWeaponSTR", ["Damaged"], "structuralStrength", "times", 0.5],
	["getWeaponSTR", ["Heavily Damaged"], "structuralStrength", "times", 0.3],
	["getWeaponSpeed", ["Arm Blade"], "speed", "add", 1],
	["getWeaponSpeed", ["Chain Weapon"], "speed", "add", 2],
	["getWeaponSpeed", ["Double Head", "Double Blade"], "speed", "add", 1],
	["getWeaponSpeed", ["Shoddy", "Poor"], "speed", "add", 1],
	["getWeaponSpeed", ["Good", "High", "Master"], "speed", "add", -1],
	["getWeaponSpeed", ["Repaired"], "speed", "add", 1],
	["getWeaponSpeed", ["Worn"], "speed", "add", 1],
	["getWeaponSpeed", ["Lightly Damaged"], "speed", "add", 1],
	["getWeaponSpeed", ["Damaged"], "speed", "add", 2],
	["getWeaponSpeed", ["Heavily Damaged"], "speed", "add", 2],
	["getWeaponSpeed", ["Shoddy", "Poor"], "reloadSpeed", "add", 1],
	["getWeaponSpeed", ["Good", "High", "Master"], "reloadSpeed", "add", -1],
	["getWeaponSpeed", ["Repaired"], "reloadSpeed", "add", 1],
	["getWeaponSpeed", ["Worn"], "reloadSpeed", "add", 1],
	["getWeaponSpeed", ["Lightly Damaged"], "reloadSpeed", "add", 1],
	["getWeaponSpeed", ["Damaged"], "reloadSpeed", "add", 2],
	["getWeaponSpeed", ["Heavily Damaged"], "reloadSpeed", "add", 2],
	["getWeaponMinSpeed", ["Chain Weapon"], "minSpeed", "add", 1],
	["getWeaponLength", ["Chain Weapon"], "length", "add", 6],
	["getWeaponSkill", ["Arm Blade", "Double Head", "Double Blade"], "skillsMod", "add", 20],
	["getWeaponSkill", ["Basket Guard"], "skillsMod", "add", 10],
	["getWeaponSkill", ["Bell Guard"], "skillsMod", "add", 5],
	["getWeaponSkill", ["Shoddy"], "skillsMod", "add", -5],
	["getWeaponSkill", ["High", "Master"], "skillsMod", "add", 5],
	["getWeaponSkill", ["Worn"], "skillsMod", "add", -5],
	["getWeaponSkill", ["Lightly Damaged"], "skillsMod", "add", -10],
	["getWeaponSkill", ["Damaged"], "skillsMod", "add", -15],
	["getWeaponSkill", ["Heavily Damaged"], "skillsMod", "add", -20],
	["getWeaponWeight", ["Shoddy"], "weight", "times", 1.25],
	["getWeaponWeight", ["Poor"], "weight", "times", 1.1],
	["getWeaponWeight", ["Good"], "weight", "times", 0.9],
	["getWeaponWeight", ["High"], "weight", "times", 0.8],
	["getWeaponWeight", ["Master"], "weight", "times", 0.75],
	["getWeaponToHit", ["Shoddy"], "toHit", "add", -1],
	["getWeaponToHit", ["High"], "toHit", "add", 1],
	["getWeaponToHit", ["Master"], "toHit", "add", 1],
	["getWeaponToHit", ["Worn"], "toHit", "add", -1],
	["getWeaponToHit", ["Lightly Damaged"], "toHit", "add", -2],
	["getWeaponToHit", ["Damaged"], "toHit", "add", -2],
	["getWeaponToHit", ["Heavily Damaged"], "toHit", "add", -3],
	["getMagicWeaponDamage", ["Frictionless"], "diceMod", "perDie", null],
	["getMagicWeaponDamage", ["Frictionless"], "altDiceMod", "perDie", null],
	["getMagicWeaponSpeed", ["Fulcrum"], "speed", "add", -1],
	["getMagicWeaponMinSpeed", ["Fulcrum"], "minSpeed", "add", -1],
	["getMagicWeaponMinSpeed", ["Fulcrum"], "reloadMinSpeed", "add", -1]
];

// @MARKER WHAT THE PLUS DOES TO THE WEAPON'S FIGURES -- the same functions' ladders on the magical
// plus, his "basePlusString": [figure, how, by] for each plus.
export const MAGIC_PLUS_LISTING = {
	"1":  [["diceMod", "add", 1], ["altDiceMod", "add", 1], ["structuralStrength", "times", 1.25], ["speed", "add", -1], ["reloadSpeed", "add", -1], ["skillsMod", "add", 5], ["weight", "times", 0.9], ["toHit", "add", 1]],
	"2":  [["diceMod", "add", 2], ["altDiceMod", "add", 2], ["structuralStrength", "times", 1.5], ["speed", "add", -1], ["reloadSpeed", "add", -1], ["skillsMod", "add", 5], ["weight", "times", 0.8], ["toHit", "add", 2]],
	"3":  [["diceMod", "add", 3], ["altDiceMod", "add", 3], ["structuralStrength", "times", 1.75], ["speed", "add", -2], ["reloadSpeed", "add", -2], ["skillsMod", "add", 10], ["weight", "times", 0.7], ["toHit", "add", 3]],
	"4":  [["diceMod", "add", 4], ["altDiceMod", "add", 4], ["structuralStrength", "times", 2], ["speed", "add", -2], ["reloadSpeed", "add", -2], ["skillsMod", "add", 10], ["weight", "times", 0.6], ["toHit", "add", 4]],
	"5":  [["diceMod", "add", 5], ["altDiceMod", "add", 5], ["structuralStrength", "times", 2.5], ["speed", "add", -3], ["reloadSpeed", "add", -3], ["skillsMod", "add", 15], ["weight", "times", 0.5], ["toHit", "add", 5]],
	"6":  [["diceMod", "add", 6], ["altDiceMod", "add", 6], ["structuralStrength", "times", 3], ["speed", "add", -3], ["reloadSpeed", "add", -3], ["skillsMod", "add", 15], ["weight", "times", 0.4], ["toHit", "add", 6]],
	"7":  [["diceMod", "add", 7], ["altDiceMod", "add", 7], ["structuralStrength", "times", 4], ["speed", "add", -4], ["reloadSpeed", "add", -4], ["skillsMod", "add", 20], ["weight", "times", 0.3], ["toHit", "add", 7]],
	"8":  [["diceMod", "add", 8], ["altDiceMod", "add", 8], ["structuralStrength", "times", 5], ["speed", "add", -4], ["reloadSpeed", "add", -4], ["skillsMod", "add", 20], ["weight", "times", 0.2], ["toHit", "add", 8]],
	"9":  [["diceMod", "add", 9], ["altDiceMod", "add", 9], ["structuralStrength", "times", 7.5], ["speed", "add", -5], ["reloadSpeed", "add", -5], ["skillsMod", "add", 25], ["weight", "times", 0.1], ["toHit", "add", 9]],
	"10": [["diceMod", "add", 10], ["altDiceMod", "add", 10], ["structuralStrength", "times", 10], ["speed", "add", -6], ["reloadSpeed", "add", -6], ["skillsMod", "add", 30], ["weight", "times", 0.05], ["toHit", "add", 10]]
};

// @END (CODE)
