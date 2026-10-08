// @START (CODE)
// @MARKER CREATURE GENERATOR RULES
//==================================================================================================================
// The arithmetic of designing a creature by the Master's Manual's Creature Creation Guide (pp.281-298),
// finished the way his Configurator finishes one (handleCreatureFinish, sheet-worker.js:174660) and
// valued the way his calcCreatureExp values one (175518). No Foundry in here: tools/creature-gen-test.html
// drives every function, and the window (module/apps/creature-generator.mjs) only rolls dice, loads the
// compendiums and writes the actor.
//
// The order the book works in, and this file follows:
//
//   1. concept        type, habits, climate, habitat                (CLIMATES, HABITATS)
//   2. body           body type, height -> base weight x body type x frame x form -> weight -> SIZE
//   3. endurance      by size and kind, with the BASE LEVEL the size carries
//   4. attributes     a band per attribute, each band a PP cost
//   5. resistances    from the attributes, the same tables a character's come from, plus abilities
//   6. combat         attack skill (PP), hide (PP, the errata's cap), standard and bought attacks
//   7. movement       base by family and size, speed modifier, the gaits that follow
//   8. abilities      the five lists, each entry its PP; skills and powers at their PP
//   9. level          base level + one per full 40 PP
//  10. experience     his calcCreatureExp, the Master's Manual p.181 table with the errata's row 0
//
// Every figure can be overridden on its step: the chapter says of itself that its tables "are meant to
// be used as guidelines", and a Game Master designing a creature knows what they mean.
//==================================================================================================================

import { ATTRIBUTE_TABLES } from "./config-tables.mjs";
import { getCreatureHideMax, getStockBodyChart } from "./creature-sheet-rules.mjs";
import { CREATURE_ATTACK_CHARTS } from "./creature-tables.mjs";
import {
	POWER_POINTS_PER_LEVEL, BODY_FAMILIES, BODY_TYPE_FAMILY, BASE_WEIGHT_BY_HEIGHT, BASE_WEIGHT_BEYOND_TABLE,
	FRAMES, FORMS, HUMANOID_SIZES, ANIMAL_SIZES, SIZE_ORDER, ENDURANCE_BY_SIZE, TREE_TABLE,
	ATTRIBUTE_BANDS, ATTRIBUTE_GROUPS, BODY_BAND_BY_SIZE, STANDARD_ATTACKS, STANDARD_ATTACK_KINDS,
	BOUGHT_ATTACKS, ATTACK_ABILITIES, ATTACK_SKILL_PP, HIDE_KINDS, WALKING_BASE, TINY_MOVEMENT,
	SPEED_MODIFIERS, SPEED_NAMES, SPEED_BY_AGILITY_BAND, GAIT_MULTIPLIERS, ABILITY_LIST,
	ABILITY_LISTS_BY_TYPE, SKILL_PP_DIVISOR, ENHANCED_SKILL_PP, ENHANCED_SKILL_STEP,
	POWER_EXTRA_USE_PP, POWER_MAX_COUNTED_USES, POWER_AT_WILL_PP, CREATURE_EXP_TABLE, EXP_SPECIALS,
	EXP_IMMUNITY_SHARE, EXP_HIDE_THRESHOLD
} from "./creature-gen-tables.mjs";

//==================================================================================================================
// @MARKER DICE
//==================================================================================================================

	// This is the function which reads one of the chapter's dice expressions into its parts:
	// "2d4+10", "1d10/2+25", "1d2-1", "15d20+400", "20d100x10+10000", or a plain "7" or "0".
	// Returns { count, sides, divide, multiply, add } or null for anything else.
	export function parseDice(tmpSpec) {
		var tmpText = String(tmpSpec ?? "").replace(/\s+/g, "").toLowerCase();
		if (tmpText == "") { return null; }
		if (/^-?\d+$/.test(tmpText)) { return { count: 0, sides: 0, divide: 1, multiply: 1, add: parseInt(tmpText) }; }
		var tmpMatch = tmpText.match(/^(\d+)d(\d+)(?:\/(\d+))?(?:x(\d+))?([+-]\d+)?$/);
		if (!tmpMatch) { return null; }
		return {
			count: parseInt(tmpMatch[1]), sides: parseInt(tmpMatch[2]),
			divide: tmpMatch[3] ? parseInt(tmpMatch[3]) : 1,
			multiply: tmpMatch[4] ? parseInt(tmpMatch[4]) : 1,
			add: tmpMatch[5] ? parseInt(tmpMatch[5]) : 0
		};
	}

	// This is the function which rolls one of the chapter's expressions. tmpRoll(sides) gives one die.
	// A division rounds UP: the book's "1d10/2+25" is printed as 26-30, and the Tiny fangs' "d4/2" as 1-2.
	export function rollDice(tmpSpec, tmpRoll) {
		var tmpParts = parseDice(tmpSpec);
		if (!tmpParts) { return 0; }
		var tmpTotal = 0;
		for (var tmpi = 0; tmpi < tmpParts.count; tmpi++) { tmpTotal = tmpTotal + (tmpRoll(tmpParts.sides) || 1); }
		if (tmpParts.divide > 1) { tmpTotal = Math.ceil(tmpTotal / tmpParts.divide); }
		return (tmpTotal * tmpParts.multiply) + tmpParts.add;
	}

	// This is the function which gives the lowest and highest an expression can roll.
	export function diceRange(tmpSpec) {
		var tmpParts = parseDice(tmpSpec);
		if (!tmpParts) { return { low: 0, high: 0 }; }
		var tmpLow = Math.ceil(tmpParts.count / tmpParts.divide) * tmpParts.multiply + tmpParts.add;
		var tmpHigh = Math.ceil((tmpParts.count * tmpParts.sides) / tmpParts.divide) * tmpParts.multiply + tmpParts.add;
		return { low: tmpLow, high: tmpHigh };
	}

	// This is the function which gives the average of an expression, rounded to the nearest whole
	// (halves up) -- the "one specific instance ... as close to average as possible" the chapter asks
	// for (MM p.281).
	export function averageDice(tmpSpec) {
		var tmpRange = diceRange(tmpSpec);
		return Math.round((tmpRange.low + tmpRange.high) / 2);
	}

//==================================================================================================================
// @MARKER BODY, WEIGHT AND SIZE
//==================================================================================================================

	// This is the function which gives a body type's family row (BODY_FAMILIES), Humanoid's for a body
	// type it does not know. Returns { name, kind, weight, walk, speedMods, gait }.
	export function getBodyFamily(tmpBodyType) {
		var tmpName = BODY_TYPE_FAMILY[tmpBodyType] ?? "Humanoid";
		var tmpRow = BODY_FAMILIES[tmpName] ?? BODY_FAMILIES["Humanoid"];
		return { name: tmpName, kind: tmpRow[0], weight: tmpRow[1], walk: tmpRow[2], speedMods: tmpRow[3], gait: tmpRow[4] };
	}

	// This is the function which gives the base-weight row for a height or length in inches (MM p.284):
	// { dice, low, high, beyond }. Over 100' the book gives no dice, only "100,000+".
	export function getBaseWeightRow(tmpInches) {
		var tmpHeight = parseFloat(tmpInches) || 0;
		for (const tmpRow of BASE_WEIGHT_BY_HEIGHT) {
			if (tmpHeight <= tmpRow[0]) { return { dice: tmpRow[1], low: tmpRow[2], high: tmpRow[3], beyond: false }; }
		}
		return { dice: "", low: BASE_WEIGHT_BEYOND_TABLE, high: BASE_WEIGHT_BEYOND_TABLE, beyond: true };
	}

	// This is the function which gives a frame's or a form's multiplier by its label, 1 for one it
	// does not know.
	export function getFrameMultiplier(tmpFrame) {
		var tmpRow = FRAMES.find(tmpOne => tmpOne[0] == tmpFrame);
		return tmpRow ? tmpRow[1] : 1;
	}
	export function getFormMultiplier(tmpForm) {
		var tmpRow = FORMS.find(tmpOne => tmpOne[0] == tmpForm);
		return tmpRow ? tmpRow[1] : 1;
	}

	// This is the function which works the final weight: base x body type x frame x form (MM p.284).
	// Whole pounds from 10 lb up; a tenth of a pound below, so an insect does not weigh nothing.
	export function computeWeight(tmpBase, tmpBodyMultiplier, tmpFrameMultiplier, tmpFormMultiplier) {
		var tmpWeight = (parseFloat(tmpBase) || 0) * (tmpBodyMultiplier ?? 1) * (tmpFrameMultiplier ?? 1) * (tmpFormMultiplier ?? 1);
		if (tmpWeight >= 10) { return Math.round(tmpWeight); }
		return Math.round(tmpWeight * 10) / 10;
	}

	// This is the function which classifies a weight by size (MM pp.284-285): the humanoid table for
	// kind "humanoid", the animal table otherwise. Returns { size, example }.
	export function getSizeClass(tmpWeight, tmpKind) {
		var tmpTable = (tmpKind == "humanoid") ? HUMANOID_SIZES : ANIMAL_SIZES;
		var tmpPounds = parseFloat(tmpWeight) || 0;
		for (const tmpRow of tmpTable) {
			if (tmpPounds <= tmpRow[0]) { return { size: tmpRow[1], example: tmpRow[2] }; }
		}
		var tmpLast = tmpTable[tmpTable.length - 1];
		return { size: tmpLast[1], example: tmpLast[2] };
	}

	// This is the function which gives the Endurance row for a size and kind (MM p.286): { dice,
	// average, baseLevel, example }. A humanoid row the table lacks (Minuscule) reads the animal one;
	// Divine Being reads Titanic.
	export function getEnduranceRow(tmpSize, tmpKind) {
		var tmpLookup = (tmpSize == "Divine Being") ? "Titanic" : tmpSize;
		var tmpRow = ENDURANCE_BY_SIZE[tmpKind == "humanoid" ? "humanoid" : "animal"]?.[tmpLookup]
			?? ENDURANCE_BY_SIZE.animal[tmpLookup];
		if (!tmpRow) { return { dice: "0", average: 0, baseLevel: 0, example: "" }; }
		return { dice: tmpRow[0], average: tmpRow[1], baseLevel: tmpRow[2], example: tmpRow[3] };
	}

	// This is the function which gives a tree's row by its height in feet (MM p.285): the first row
	// at or above the height, the 99' row for anything taller ("the stats max at 99'").
	// Returns { height, weight, dice, low, high, damage, baseLevel }.
	export function getTreeRow(tmpHeightFeet) {
		var tmpFeet = parseFloat(tmpHeightFeet) || 0;
		var tmpRow = TREE_TABLE.find(tmpOne => tmpFeet <= tmpOne[0]) ?? TREE_TABLE[TREE_TABLE.length - 1];
		return { height: tmpRow[0], weight: tmpRow[1], dice: tmpRow[2], low: tmpRow[3], high: tmpRow[4], damage: tmpRow[5], baseLevel: tmpRow[6] };
	}

	// This is the function which says where a size stands in the order, Minuscule 0 to Divine Being 13;
	// -1 for a name that is not a size.
	export function sizeIndex(tmpSize) {
		return SIZE_ORDER.indexOf(tmpSize);
	}

//==================================================================================================================
// @MARKER ATTRIBUTES
//==================================================================================================================

	// This is the function which gives a band of a group by name: { name, low, high, dice, pp }, or
	// null. The group is "body", "speed", "mind", "soul" or "spirit".
	export function getBand(tmpGroup, tmpName) {
		var tmpRow = (ATTRIBUTE_BANDS[tmpGroup] ?? []).find(tmpOne => tmpOne[0] == tmpName);
		if (!tmpRow) { return null; }
		return { name: tmpRow[0], low: tmpRow[1], high: tmpRow[2], dice: tmpRow[3], pp: tmpRow[4] };
	}

	// This is the function which lists a group's bands, for a select.
	export function listBands(tmpGroup) {
		return (ATTRIBUTE_BANDS[tmpGroup] ?? []).map(tmpRow => ({ name: tmpRow[0], low: tmpRow[1], high: tmpRow[2], dice: tmpRow[3], pp: tmpRow[4] }));
	}

	// This is the function which suggests a band for every attribute from the creature's size and type,
	// the chapter's own advice: physicals "should correspond closely" to the body size; animals have
	// "N/A" personals and an Animal mind and spirit; "Magical animals should always have at least
	// average mystical attributes"; "Mindless undead such as zombies should always have extremely low
	// personal attributes"; a non-mobile plant's Agility is "N/A" (the lowest band here). Humanoids and
	// the rest start Average and are adjusted by hand.
	export function suggestBands(tmpSize, tmpCreatureType) {
		var tmpBody = BODY_BAND_BY_SIZE[tmpSize] ?? "Medium";
		var tmpSpeed = "Average", tmpMind = "Average Intelligence", tmpSoul = "Average Soul", tmpSpirit = "Average Spirit";
		switch (tmpCreatureType) {
			case "Animal":
				tmpMind = "Animal Intelligence"; tmpSoul = "N/A (no soul)"; tmpSpirit = "Animal Spirit";
				break;
			case "Magical Animal":
				tmpMind = "Animal Intelligence"; tmpSoul = "N/A (no soul)"; tmpSpirit = "Average Spirit";
				break;
			case "Plant":
				tmpSpeed = "Lethargic"; tmpMind = "Basic Drives and Instincts"; tmpSoul = "N/A (no soul)"; tmpSpirit = "Basic Spirit";
				break;
			case "Magical Plant":
			case "Slime":
				tmpSpeed = "Lethargic"; tmpMind = "Basic Drives and Instincts"; tmpSoul = "N/A (no soul)"; tmpSpirit = "Average Spirit";
				break;
			case "Undead":
				tmpSoul = "Condemned/Damned Soul";
				break;
			case "Supernatural":
			case "Deity":
				tmpMind = "Above Average Mind"; tmpSoul = "Above Average Soul"; tmpSpirit = "Highly Magical Spirit";
				break;
		}
		var tmpBands = {};
		for (const [tmpKey, [tmpGroup]] of Object.entries(ATTRIBUTE_GROUPS)) {
			tmpBands[tmpKey] = { body: tmpBody, speed: tmpSpeed, mind: tmpMind, soul: tmpSoul, spirit: tmpSpirit }[tmpGroup];
		}
		return tmpBands;
	}

	// This is the function which works the twelve ratings from the bands: an entered rating stands
	// (held to 0-30), a rating of 0 or blank takes the band's average, and a rating outside its band is
	// kept but reported. Returns { ratings: {str: n...}, pp: total band cost, rows: [{ key, label, group,
	// band, rating, low, high, pp, outside }] }.
	export function resolveAttributes(tmpBands, tmpEntered) {
		var tmpRatings = {};
		var tmpRows = [];
		var tmpTotal = 0;
		for (const [tmpKey, [tmpGroup, tmpLabel]] of Object.entries(ATTRIBUTE_GROUPS)) {
			var tmpBand = getBand(tmpGroup, tmpBands?.[tmpKey]) ?? listBands(tmpGroup)[0];
			// Blank takes the band's average; a typed figure stands, 0 included (a Tiny creature's
			// Strength is 0 or 1, and the Game Master who types 0 means it).
			var tmpValue = parseInt(tmpEntered?.[tmpKey]);
			if (isNaN(tmpValue)) { tmpValue = Math.round((tmpBand.low + tmpBand.high) / 2); }
			if (tmpValue < 0) { tmpValue = 0; }
			if (tmpValue > 30) { tmpValue = 30; }
			tmpRatings[tmpKey] = tmpValue;
			tmpTotal = tmpTotal + tmpBand.pp;
			tmpRows.push({ key: tmpKey, label: tmpLabel, group: tmpGroup, band: tmpBand.name, rating: tmpValue,
				low: tmpBand.low, high: tmpBand.high, dice: tmpBand.dice, pp: tmpBand.pp,
				outside: tmpValue < tmpBand.low || tmpValue > tmpBand.high });
		}
		return { ratings: tmpRatings, pp: tmpTotal, rows: tmpRows };
	}

	// This is the function which gives a creature's attribute maximum by its level -- his
	// handleCreatureFinish (sheet-worker.js:174724-174730): 25 under level 10, 28 under 15, 30 from 15.
	// The same rule as ImagineCreatureData.getCreatureAttributeCap, kept here as well so this module
	// stays free of the data model (which needs Foundry to import); creature-gen-test.html checks the
	// two agree at every level.
	export function getLevelAttributeCap(tmpLevel) {
		var tmpLevelValue = parseInt(tmpLevel) || 0;
		if (tmpLevelValue < 10) { return 25; }
		if (tmpLevelValue < 15) { return 28; }
		return 30;
	}

//==================================================================================================================
// @MARKER RESISTANCES
//==================================================================================================================

	// This is the function which works the five resistances from the ratings. The chapter's creature
	// table (MM p.286) is his attribute tables' own resistance columns -- checked figure by figure at
	// ratings 0, 4, 5, 7, 10, 15, 16, 20, 25 and 27 -- so a creature reads the same tables a character
	// does (actor-character.mjs _prepareResistances): Magic from Aura, Illusion from Wisdom, Poison
	// and Disease from Vitality, Control from Will Force with the Intelligence and Wisdom adjustments.
	// Enhancements (the Enhanced ... Resistance abilities, as whole percentages) are added; an
	// immunity marks the track immune. Nothing goes below 0.
	// Returns { magic: { value, immune }, illusion, control, poison, disease }.
	export function deriveResistances(tmpRatings, tmpEnhancements, tmpImmune) {
		var tmpRow = (tmpKey) => ATTRIBUTE_TABLES[tmpKey]?.[parseInt(tmpRatings?.[tmpKey]) || 0] ?? {};
		var tmpControl = (parseInt(tmpRow("wil").controlResist) || 0)
			+ (parseInt(tmpRow("int").controlResistAdjust) || 0)
			+ (parseInt(tmpRow("wis").controlResistAdjust) || 0);
		var tmpBase = {
			magic:    parseInt(tmpRow("aur").magicResist) || 0,
			illusion: parseInt(tmpRow("wis").illusionResist) || 0,
			control:  tmpControl,
			poison:   parseInt(tmpRow("vit").poisonResist) || 0,
			disease:  parseInt(tmpRow("vit").diseaseResist) || 0
		};
		var tmpOut = {};
		for (const tmpKey of Object.keys(tmpBase)) {
			var tmpValue = tmpBase[tmpKey] + (parseInt(tmpEnhancements?.[tmpKey]) || 0);
			if (tmpValue < 0) { tmpValue = 0; }
			tmpOut[tmpKey] = { base: tmpBase[tmpKey], value: tmpValue, immune: !!tmpImmune?.[tmpKey] };
		}
		return tmpOut;
	}

	// Which immunity rows make a resistance track immune (MM pp.297-298), by the rows' names.
	const IMMUNITY_TRACKS = {
		"Magic": "magic", "Illusion": "illusion", "Control": "control",
		"Poison, Lesser": "poison", "Poison, Greater": "poison", "Disease": "disease"
	};
	// Which abilities enhance a track and by how much per unit (MM pp.289, 294).
	const ENHANCEMENT_TRACKS = {
		"Enhanced Poison Resistance":   [ "poison",   5 ],
		"Enhanced Disease Resistance":  [ "disease",  5 ],
		"Enhanced Magic Resistance":    [ "magic",    1 ],
		"Enhanced Illusion Resistance": [ "illusion", 1 ],
		"Enhanced Control Resistance":  [ "control",  1 ]
	};

	// This is the function which reads the chosen abilities for what they do to the resistances:
	// { enhancements: { poison: 10, ... }, immune: { magic: true, ... } }.
	export function readResistanceAbilities(tmpChosen) {
		var tmpEnhancements = {};
		var tmpImmune = {};
		for (const tmpPick of tmpChosen ?? []) {
			var tmpTrack = ENHANCEMENT_TRACKS[tmpPick.name];
			if (tmpTrack) {
				tmpEnhancements[tmpTrack[0]] = (tmpEnhancements[tmpTrack[0]] || 0) + tmpTrack[1] * Math.max(1, parseInt(tmpPick.count) || 1);
			}
			if (tmpPick.list == "immunity" && IMMUNITY_TRACKS[tmpPick.name]) { tmpImmune[IMMUNITY_TRACKS[tmpPick.name]] = true; }
		}
		return { enhancements: tmpEnhancements, immune: tmpImmune };
	}

//==================================================================================================================
// @MARKER ATTACKS
//==================================================================================================================

	// This is the function which turns one of the attack tables' printed ranges into the dice strings
	// his creatureAttack item carries. "3d4-4d4" offers two ("Creatures are given a range of damage
	// from which to choose", MM p.287); a flat "1-3" is one die with that spread (1d3); "0-1" is
	// 1d2-1; "0" is no attack at all. Returns [{ label, value }].
	export function readDamageRange(tmpText) {
		var tmpClean = String(tmpText ?? "").replace(/\s+/g, "");
		if (tmpClean == "" || tmpClean == "0") { return []; }
		var tmpDicePair = tmpClean.match(/^(\d+d\d+)-(\d+d\d+)$/);
		if (tmpDicePair) { return [ { label: tmpDicePair[1], value: tmpDicePair[1] }, { label: tmpDicePair[2], value: tmpDicePair[2] } ]; }
		var tmpFlatPair = tmpClean.match(/^(\d+)-(\d+)$/);
		if (tmpFlatPair) {
			var tmpLow = parseInt(tmpFlatPair[1]), tmpHigh = parseInt(tmpFlatPair[2]);
			var tmpSpread = tmpHigh - tmpLow + 1;
			var tmpDice = `1d${tmpSpread}` + (tmpLow - 1 != 0 ? ((tmpLow - 1 > 0 ? "+" : "") + (tmpLow - 1)) : "");
			return [ { label: `${tmpLow}-${tmpHigh} (${tmpDice})`, value: tmpDice } ];
		}
		return [ { label: tmpClean, value: tmpClean } ];
	}

	// This is the function which lists the standard attacks a size has (MM p.287), each with its damage
	// choices: [{ name, damageType, attackType, choices }]. A size with "0" in a column has no such
	// attack and the row is left out. Minuscule has no row of its own on the bought table but does here.
	export function getStandardAttacks(tmpSize) {
		var tmpRow = STANDARD_ATTACKS[tmpSize] ?? STANDARD_ATTACKS["Medium"];
		var tmpList = [];
		for (const [tmpName, tmpColumn, tmpDamageType, tmpAttackType] of STANDARD_ATTACK_KINDS) {
			var tmpChoices = readDamageRange(tmpRow[tmpColumn]);
			if (!tmpChoices.length) { continue; }
			tmpList.push({ name: tmpName, damageType: tmpDamageType, attackType: tmpAttackType, choices: tmpChoices });
		}
		return tmpList;
	}

	// This is the function which lists the attack abilities (MM pp.289-291) with the damage a size gives
	// each (p.287): [{ name, pp, speed, minSpeed, damageType, attackType, note, choices }]. Minuscule
	// reads Tiny's row and Divine Being Titanic's.
	export function getBoughtAttacks(tmpSize) {
		var tmpLookup = tmpSize == "Minuscule" ? "Tiny" : (tmpSize == "Divine Being" ? "Titanic" : tmpSize);
		var tmpRow = BOUGHT_ATTACKS[tmpLookup] ?? BOUGHT_ATTACKS["Medium"];
		var tmpList = [];
		for (const [tmpName, [tmpColumn, tmpPP, tmpSpeed, tmpMin, tmpDamageType, tmpAttackType, tmpNote]] of Object.entries(ATTACK_ABILITIES)) {
			tmpList.push({ name: tmpName, pp: tmpPP, speed: tmpSpeed, minSpeed: tmpMin, damageType: tmpDamageType,
				attackType: tmpAttackType, note: tmpNote, choices: readDamageRange(tmpRow[tmpColumn]) });
		}
		return tmpList;
	}

	// This is the function which gives an attack chart's PP (MM p.287), 0 for None or an unknown chart.
	export function getAttackSkillPP(tmpChart) {
		return ATTACK_SKILL_PP[tmpChart] ?? 0;
	}

//==================================================================================================================
// @MARKER HIDE
//==================================================================================================================

	// This is the function which works out a hide (MM p.290; plants p.292; supernatural p.296):
	//   kindMax     the most that kind of hide gives this Endurance (null for Supernatural, unlimited)
	//   errataMax   his errata's 5 per level cap (null where exempt), from getCreatureHideMax
	//   max         the lower of the two that apply (null if neither does)
	//   points      the points asked for, held to max unless tmpAllowOver
	//   overCap     true when the points asked for were above the errata's cap
	//   pp          the PP: the kind's flat part plus its rate per point, rounded up
	export function resolveHide(tmpKind, tmpPoints, tmpEndurance, tmpLevel, tmpCreatureType, tmpSize, tmpAllowOver) {
		var tmpRow = HIDE_KINDS[tmpKind] ?? HIDE_KINDS["None"];
		var [tmpPerEnd, tmpPerPoint, tmpFlat] = tmpRow;
		var tmpAsked = Math.max(0, parseInt(tmpPoints) || 0);
		if (tmpKind == "None" || !tmpKind) { return { kind: "None", kindMax: 0, errataMax: null, max: 0, points: 0, overCap: false, overKind: false, pp: 0 }; }
		var tmpKindMax = tmpPerEnd > 0 ? Math.floor((parseInt(tmpEndurance) || 0) / tmpPerEnd) : null;
		var tmpErrataMax = getCreatureHideMax(tmpLevel, tmpCreatureType, tmpSize);
		var tmpMax = null;
		if (tmpKindMax !== null) { tmpMax = tmpKindMax; }
		if (tmpErrataMax !== null) { tmpMax = (tmpMax === null) ? tmpErrataMax : Math.min(tmpMax, tmpErrataMax); }
		var tmpOverCap = tmpErrataMax !== null && tmpAsked > tmpErrataMax;
		var tmpOverKind = tmpKindMax !== null && tmpAsked > tmpKindMax;
		var tmpHeld = tmpAsked;
		if (!tmpAllowOver && tmpMax !== null && tmpHeld > tmpMax) { tmpHeld = tmpMax; }
		return { kind: tmpKind, kindMax: tmpKindMax, errataMax: tmpErrataMax, max: tmpMax, points: tmpHeld,
			overCap: tmpOverCap, overKind: tmpOverKind, pp: tmpHeld > 0 ? Math.ceil(tmpFlat + tmpHeld * tmpPerPoint) : 0 };
	}

//==================================================================================================================
// @MARKER MOVEMENT
//==================================================================================================================

	// This is the function which gives the speed name an Agility band answers to (MM p.288's modifier
	// tables are "referenced from Agility"), Average for one it does not know.
	export function speedForAgilityBand(tmpBand) {
		return SPEED_BY_AGILITY_BAND[tmpBand] ?? "Average";
	}

	// This is the function which builds a creature's movement modes (MM pp.287-288): the base gait by
	// family and size with the speed modifier added, then the gaits that follow from it --
	//   Jog x2 and Run x3 for walkers (never for crawlers, who "have no jogging or running speeds")
	//   Gallop x4 with Hooves, or when asked for (quadrupeds "and some reptiles")
	//   Fly x4 with Flight or Magical Flight; Swim x3 with Swimming (fish and sea mammals swim already)
	// The Tiny family has the chapter's fixed speeds instead. A family with no table (plants, the
	// insubstantial) gives nothing, for the Game Master to enter. Nothing goes below 0.
	// tmpGaits is { gallop, fly, swim, hop } -- what was ticked, or came with an ability.
	// Returns [{ name, hourly, tenSec, oneSec }].
	export function buildMovementModes(tmpFamily, tmpSize, tmpSpeedName, tmpGaits) {
		var tmpModes = [];
		var tmpSet = tmpGaits ?? {};
		if (tmpFamily?.walk == "tiny") {
			for (const [tmpName, tmpHourly, tmpTen, tmpOne] of TINY_MOVEMENT) {
				if (tmpName == "Fly" && !tmpSet.fly) { continue; }
				if (tmpName == "Hop" && !tmpSet.hop) { continue; }
				if (tmpName == "Swim" && !tmpSet.swim) { continue; }
				tmpModes.push({ name: tmpName, hourly: round2(tmpHourly), tenSec: round2(tmpTen), oneSec: round2(tmpOne) });
			}
			return tmpModes;
		}
		var tmpTable = WALKING_BASE[tmpFamily?.walk];
		if (!tmpTable) { return tmpModes; }
		var tmpBase = tmpTable[tmpSize] ?? tmpTable["Medium"];
		var tmpIndex = SPEED_NAMES.indexOf(tmpSpeedName);
		if (tmpIndex < 0) { tmpIndex = SPEED_NAMES.indexOf("Average"); }
		var tmpMods = (SPEED_MODIFIERS[tmpFamily.speedMods] ?? SPEED_MODIFIERS.humanoid)[tmpIndex];
		var tmpWalk = [0, 1, 2].map(tmpi => Math.max(0, round2(tmpBase[tmpi] + tmpMods[tmpi])));
		var tmpGaitName = tmpFamily.gait || "Walk";
		tmpModes.push({ name: tmpGaitName, hourly: tmpWalk[0], tenSec: tmpWalk[1], oneSec: tmpWalk[2] });

		var tmpTimes = (tmpName) => ({ name: tmpName,
			hourly: round2(tmpWalk[0] * GAIT_MULTIPLIERS[tmpName]), tenSec: round2(tmpWalk[1] * GAIT_MULTIPLIERS[tmpName]),
			oneSec: round2(tmpWalk[2] * GAIT_MULTIPLIERS[tmpName]) });
		if (tmpGaitName == "Walk") {
			tmpModes.push(tmpTimes("Jog"));
			tmpModes.push(tmpTimes("Run"));
			if (tmpSet.gallop) { tmpModes.push(tmpTimes("Gallop")); }
		}
		if (tmpSet.fly) { tmpModes.push(tmpTimes("Fly")); }
		if (tmpSet.swim && tmpGaitName != "Swim") { tmpModes.push(tmpTimes("Swim")); }
		return tmpModes;
	}

	function round2(tmpValue) { return Math.round((parseFloat(tmpValue) || 0) * 100) / 100; }

	// Which abilities bring a gait with them (MM pp.287-288, 290, 291, 295).
	export const GAIT_ABILITIES = {
		"Hooves": "gallop", "Wings": "fly", "Magical Flight": "fly", "Swimming": "swim", "Jumping": "hop"
	};

	// This is the function which reads the chosen abilities for the gaits they bring.
	export function readGaitAbilities(tmpChosen) {
		var tmpGaits = {};
		for (const tmpPick of tmpChosen ?? []) {
			var tmpGait = GAIT_ABILITIES[tmpPick.name];
			if (tmpGait) { tmpGaits[tmpGait] = true; }
		}
		return tmpGaits;
	}

//==================================================================================================================
// @MARKER ABILITIES, SKILLS AND POWERS
//==================================================================================================================

	// This is the function which lists the abilities a creature type may take (MM pp.289-298), by list:
	// { animal: [...], plant, mplant, magical, disability, immunity }, each row { name, list, pp, unit,
	// note }. Disabilities and immunities are open to every type.
	export function listAbilitiesFor(tmpCreatureType) {
		var tmpAllowed = ABILITY_LISTS_BY_TYPE[tmpCreatureType] ?? [true, false, false, true];
		var tmpOpen = { animal: tmpAllowed[0], plant: tmpAllowed[1], mplant: tmpAllowed[2], magical: tmpAllowed[3], disability: true, immunity: true };
		var tmpOut = { animal: [], plant: [], mplant: [], magical: [], disability: [], immunity: [] };
		for (const [tmpName, tmpList, tmpPP, tmpUnit, tmpNote] of ABILITY_LIST) {
			if (!tmpOpen[tmpList]) { continue; }
			tmpOut[tmpList].push({ name: tmpName, list: tmpList, pp: tmpPP, unit: tmpUnit, note: tmpNote });
		}
		return tmpOut;
	}

	// This is the function which finds one ability row by name, and by list where one is given (Insanity
	// is both a disability and an immunity), or null. Without a list, or with one no row matches, the
	// first row of that name is taken.
	export function getAbilityRow(tmpName, tmpList) {
		var tmpRow = (tmpList ? ABILITY_LIST.find(tmpOne => tmpOne[0] == tmpName && tmpOne[1] == tmpList) : null)
			?? ABILITY_LIST.find(tmpOne => tmpOne[0] == tmpName);
		return tmpRow ? { name: tmpRow[0], list: tmpRow[1], pp: tmpRow[2], unit: tmpRow[3], note: tmpRow[4] } : null;
	}

	// This is the function which prices the chosen abilities: each is its PP, times its count where it
	// has a unit; a disability's negative PP is a gain. A custom entry ({ name, list, pp, custom: true })
	// is taken at the PP given. Returns { pp, rows: [{ name, list, count, pp, unit, note }] }.
	export function priceAbilities(tmpChosen) {
		var tmpRows = [];
		var tmpTotal = 0;
		for (const tmpPick of tmpChosen ?? []) {
			var tmpRow = tmpPick.custom ? null : getAbilityRow(tmpPick.name, tmpPick.list);
			var tmpUnit = tmpRow?.unit ?? "";
			var tmpCount = tmpUnit ? Math.max(1, parseInt(tmpPick.count) || 1) : 1;
			var tmpEach = tmpRow ? tmpRow.pp : (parseFloat(tmpPick.pp) || 0);
			var tmpPP = Math.ceil(tmpEach * tmpCount);
			tmpTotal = tmpTotal + tmpPP;
			tmpRows.push({ name: tmpPick.name, list: tmpRow?.list ?? tmpPick.list ?? "animal", count: tmpCount, pp: tmpPP,
				unit: tmpUnit, note: tmpRow?.note ?? (tmpPick.note ?? ""), custom: !tmpRow });
		}
		return { pp: tmpTotal, rows: tmpRows };
	}

	// This is the function which prices a skill (MM p.298): half its rating, rounded up, plus 1 PP per
	// +10% over the base for a common or social skill and 2 PP per +10% for a restricted one. The
	// base chance is the skill's rating x 5 (the common chance); what is bought above that is
	// "Enhanced [skill]". A skill the compendium does not know is priced at the PP typed for it.
	// Returns { pp, rating, base, enhanced, known }.
	export function priceSkill(tmpPick, tmpSkillDoc) {
		var tmpChance = Math.max(0, parseInt(tmpPick?.chance) || 0);
		if (!tmpSkillDoc) {
			return { pp: Math.max(0, parseInt(tmpPick?.pp) || 0), rating: 0, base: 0, enhanced: 0, known: false };
		}
		var tmpRating = parseInt(tmpSkillDoc.system?.skillRating) || 0;
		var tmpBase = tmpRating * 5;
		var tmpOver = Math.max(0, tmpChance - tmpBase);
		var tmpSteps = Math.ceil(tmpOver / ENHANCED_SKILL_STEP);
		var tmpRate = tmpSkillDoc.system?.isRestricted ? ENHANCED_SKILL_PP.restricted : ENHANCED_SKILL_PP.common;
		var tmpPP = Math.ceil(tmpRating / SKILL_PP_DIVISOR) + tmpSteps * tmpRate;
		return { pp: tmpPP, rating: tmpRating, base: tmpBase, enhanced: tmpOver, known: true };
	}

	// This is the function which prices a power (MM p.298): the spell's Aura level or the invocation's
	// Piety level, +1 per use a day beyond the first up to 10, or 15 for "at will". An unknown name is
	// priced at the level typed for it. Returns { pp, level, known, kind }.
	export function pricePower(tmpPick, tmpSpellDoc, tmpInvocationDoc) {
		var tmpDoc = tmpSpellDoc ?? tmpInvocationDoc;
		var tmpLevel = tmpDoc ? (parseInt(tmpDoc.system?.level) || 0) : Math.max(0, parseInt(tmpPick?.level) || 0);
		var tmpUses = Math.max(1, parseInt(tmpPick?.uses) || 1);
		var tmpPP = tmpLevel;
		if (tmpPick?.atWill) { tmpPP = tmpPP + POWER_AT_WILL_PP; }
		else { tmpPP = tmpPP + (Math.min(tmpUses, POWER_MAX_COUNTED_USES) - 1) * POWER_EXTRA_USE_PP; }
		return { pp: tmpPP, level: tmpLevel, known: !!tmpDoc, kind: tmpSpellDoc ? "spell" : (tmpInvocationDoc ? "invocation" : "unknown") };
	}

//==================================================================================================================
// @MARKER LEVEL
//==================================================================================================================

	// This is the function which gives the level: the base level the size carries plus one per full 40
	// PP (MM p.281). Points below nothing (more disabilities than abilities) add no level and take none
	// away: the book says only what is ADDED. Returns { level, fromPoints, remainder }.
	export function levelFromPowerPoints(tmpBaseLevel, tmpPowerPoints) {
		var tmpPP = Math.max(0, parseInt(tmpPowerPoints) || 0);
		var tmpFrom = Math.floor(tmpPP / POWER_POINTS_PER_LEVEL);
		return { level: (parseInt(tmpBaseLevel) || 0) + tmpFrom, fromPoints: tmpFrom, remainder: tmpPP - tmpFrom * POWER_POINTS_PER_LEVEL };
	}

//==================================================================================================================
// @MARKER EXPERIENCE VALUE
//==================================================================================================================

	// This is the function which gives his experience row for a level: row 0 under level 1, row 21 for
	// 21 and over (getLevelExp's "<1" and "21+" branches).
	export function getExpRow(tmpLevel) {
		var tmpLevelValue = parseInt(tmpLevel) || 0;
		if (tmpLevelValue < 0) { tmpLevelValue = 0; }
		if (tmpLevelValue > 21) { tmpLevelValue = 21; }
		var tmpRow = CREATURE_EXP_TABLE[tmpLevelValue];
		return { level: tmpLevelValue, base: tmpRow[1], endOver: tmpRow[2], endPer: tmpRow[3], attrOver: tmpRow[4], attrPer: tmpRow[5],
			resistOver: tmpRow[6], resistPer: tmpRow[7], skillOver: tmpRow[8], skillPer: tmpRow[9], powerPer: tmpRow[10] };
	}

	// This is the function which values a creature as his calcCreatureExp does (sheet-worker.js:175518):
	//
	//   base         by level (getLevelExp)
	//   attributes   each rating over the row's figure, times the row's per        (getAttribExp)
	//   endurance    Endurance over the row's figure, times per                    (getENDExp)
	//   resistances  each of the five NUMERIC resistances over the row's %, per    (getResistExp; Immune skipped)
	//   skills       each race or class skill with a chance over the row's %, per  (getSkillExp -- social
	//                skills are not counted, his getRaceClassSkillDetails test and the errata's note)
	//   powers       each power's level times per                                  (getPowerExp)
	//   specials     his Configurator's ticks, each a share of the base; poison its type times the
	//                base; hide over 29 as (hide - 20) / 10, at least 1, times the base
	//   immunities   a fifth of the base each. HIS code splits an empty list and gets ONE, so a
	//                creature with no immunities is valued as having one (UPSTREAM 120); the count
	//                here is the real one.
	//
	// tmpInputs: { level, ratings, endurance, resistances: { magic: { value, immune } ... }, skills:
	//   [{ chance, counted }], powerLevels: [n...], specials: { slaying: true ... }, poisonType: 0-25,
	//   hide, immunityCount }
	// Returns { total, parts: { base, attributes, endurance, resistances, skills, powers, specials,
	//   hide, immunities }, row }.
	export function calcCreatureExp(tmpInputs) {
		var tmpRow = getExpRow(tmpInputs?.level);
		var tmpParts = { base: tmpRow.base, attributes: 0, endurance: 0, resistances: 0, skills: 0, powers: 0, specials: 0, hide: 0, immunities: 0 };

		for (const tmpKey of Object.keys(ATTRIBUTE_GROUPS)) {
			var tmpOver = (parseInt(tmpInputs?.ratings?.[tmpKey]) || 0) - tmpRow.attrOver;
			if (tmpOver > 0) { tmpParts.attributes = tmpParts.attributes + tmpOver * tmpRow.attrPer; }
		}
		var tmpEndOver = (parseInt(tmpInputs?.endurance) || 0) - tmpRow.endOver;
		if (tmpEndOver > 0) { tmpParts.endurance = tmpEndOver * tmpRow.endPer; }

		for (const tmpTrack of Object.values(tmpInputs?.resistances ?? {})) {
			if (tmpTrack?.immune) { continue; }
			if ((parseInt(tmpTrack?.value) || 0) > tmpRow.resistOver) { tmpParts.resistances = tmpParts.resistances + tmpRow.resistPer; }
		}
		for (const tmpSkill of tmpInputs?.skills ?? []) {
			if (!tmpSkill?.counted) { continue; }
			if ((parseInt(tmpSkill.chance) || 0) > tmpRow.skillOver) { tmpParts.skills = tmpParts.skills + tmpRow.skillPer; }
		}
		for (const tmpLevel of tmpInputs?.powerLevels ?? []) {
			var tmpPowerLevel = parseInt(tmpLevel) || 0;
			if (tmpPowerLevel > 0) { tmpParts.powers = tmpParts.powers + tmpPowerLevel * tmpRow.powerPer; }
		}

		var tmpBase = tmpRow.base;
		for (const [tmpKey, [tmpShare]] of Object.entries(EXP_SPECIALS)) {
			if (!tmpInputs?.specials?.[tmpKey]) { continue; }
			// His whole-share ticks (Slaying, Character Class, Caster) add even at base 0; the fractional
			// ones are guarded "if (tempBaseExp>0)", which only matters for a negative base, which there is
			// none of. parseInt truncates each, as his does.
			tmpParts.specials = tmpParts.specials + Math.trunc(tmpBase * tmpShare);
		}
		var tmpPoison = parseInt(tmpInputs?.poisonType) || 0;
		if (tmpPoison > 0) { tmpParts.specials = tmpParts.specials + tmpPoison * tmpBase; }

		var tmpHide = parseInt(tmpInputs?.hide) || 0;
		if (tmpHide > EXP_HIDE_THRESHOLD) {
			var tmpSteps = Math.trunc((tmpHide - 20) / 10);
			if (tmpSteps < 1) { tmpSteps = 1; }
			tmpParts.hide = tmpSteps * tmpBase;
		}
		var tmpImmunities = Math.max(0, parseInt(tmpInputs?.immunityCount) || 0);
		tmpParts.immunities = Math.trunc(tmpImmunities * (tmpBase * EXP_IMMUNITY_SHARE));

		var tmpTotal = 0;
		for (const tmpValue of Object.values(tmpParts)) { tmpTotal = tmpTotal + tmpValue; }
		return { total: tmpTotal, parts: tmpParts, row: tmpRow };
	}

	// This is the function which reads a poison type's roman numeral (I-XXV, his exp_poison_type
	// select) as a number, 0 for blank or anything else -- his convertPoisonTypeToInt.
	export function readPoisonType(tmpText) {
		var tmpRoman = String(tmpText ?? "").trim().toUpperCase();
		if (!tmpRoman) { return 0; }
		if (/^\d+$/.test(tmpRoman)) { return Math.min(25, parseInt(tmpRoman)); }
		var tmpValues = { I: 1, V: 5, X: 10 };
		var tmpTotal = 0;
		for (var tmpi = 0; tmpi < tmpRoman.length; tmpi++) {
			var tmpThis = tmpValues[tmpRoman[tmpi]];
			var tmpNext = tmpValues[tmpRoman[tmpi + 1]] ?? 0;
			if (!tmpThis) { return 0; }
			tmpTotal = tmpTotal + (tmpThis < tmpNext ? -tmpThis : tmpThis);
		}
		return tmpTotal > 25 ? 0 : tmpTotal;
	}

//==================================================================================================================
// @MARKER ASSEMBLY
//==================================================================================================================

	// This is the function which turns the finished design into the creature actor and its items --
	// what his handleCreatureFinish writes, in the port's fields (module/data/actor-creature.mjs).
	//
	// tmpDesign is what deriveCreatureDesign (creature-gen-view.mjs) works out; tmpLookup finds the
	// compendium documents to copy: { trait(name, list) -> doc|null, skill(name) -> doc|null,
	// spell(name) -> doc|null, invocation(name) -> doc|null }. A trait the packs do not carry is made
	// from the chapter's own note, so nothing chosen is lost.
	//
	// Returns { actor: { name, type, img?, system }, items: [...] }.
	export function assembleCreature(tmpDesign, tmpLookup) {
		var tmpFind = tmpLookup ?? {};
		var tmpAttributes = {};
		for (const tmpKey of Object.keys(ATTRIBUTE_GROUPS)) {
			tmpAttributes[tmpKey] = { rating: parseInt(tmpDesign.ratings?.[tmpKey]) || 0, permMod: 0, tempMod: 0 };
		}
		var tmpResistances = {};
		for (const tmpKey of ["magic", "illusion", "control", "poison", "disease"]) {
			var tmpTrack = tmpDesign.resistances?.[tmpKey] ?? { value: 0, immune: false };
			tmpResistances[tmpKey] = { entered: tmpTrack.immune ? 0 : (parseInt(tmpTrack.value) || 0), tempMod: 0, permMod: 0, immune: !!tmpTrack.immune };
		}
		var tmpNotes = [];
		if (tmpDesign.notes) { tmpNotes.push(tmpDesign.notes); }
		tmpNotes.push(`Designed by the Creature Creation Guide: ${tmpDesign.powerPoints?.total ?? 0} PP over a base level of ${tmpDesign.baseLevel ?? 0}`
			+ (tmpDesign.levelOverridden ? ", level set by hand." : "."));
		if (tmpDesign.climate) { tmpNotes.push(`Climate: ${tmpDesign.climate}.`); }

		var tmpActor = {
			name: tmpDesign.name || "New Creature",
			type: "creature",
			system: {
				identity: {
					creatureType: tmpDesign.creatureType || "",
					subtype: tmpDesign.subtype || "",
					level: parseInt(tmpDesign.level) || 0,
					lifecycle: tmpDesign.lifecycle || "",
					habitat: [tmpDesign.habitat, tmpDesign.climate].filter(tmpPart => tmpPart).join(" / "),
					alignment: tmpDesign.alignment || "",
					tendencies: tmpDesign.tendencies || "",
					expValue: parseInt(tmpDesign.expValue) || 0,
					expNote: tmpDesign.expNote || "",
					size: tmpDesign.size || ""
				},
				attributes: tmpAttributes,
				characteristics: {
					endurance: { entered: parseInt(tmpDesign.endurance) || 0, tempMod: 0 },
					perception: { tempMod: 0 }, affinity: { tempMod: 0 }, fortune: { tempMod: 0 },
					// Shock is left at 0: the model reads that as Endurance x 3, his Configurator's own default.
					shock: { entered: 0, immune: !!tmpDesign.shockImmune }
				},
				resistances: tmpResistances,
				body: {
					bodyType: tmpDesign.bodyType || "Humanoid",
					bodyChart: getStockBodyChart(tmpDesign.bodyType),
					hide: parseInt(tmpDesign.hide) || 0
				},
				physical: {
					heightFeet: parseInt(tmpDesign.heightFeet) || 0,
					heightInches: parseInt(tmpDesign.heightInches) || 0,
					weight: parseFloat(tmpDesign.weight) || 0
				},
				movement: { modes: (tmpDesign.movementModes ?? []).map(tmpMode => ({
					name: tmpMode.name, hourly: parseFloat(tmpMode.hourly) || 0, tenSec: parseFloat(tmpMode.tenSec) || 0, oneSec: parseFloat(tmpMode.oneSec) || 0 })) },
				skills: (tmpDesign.skills ?? []).filter(tmpSkill => tmpSkill.name).map(tmpSkill => ({ name: tmpSkill.name, chance: parseInt(tmpSkill.chance) || 0 })),
				combat: {
					attackChart: CREATURE_ATTACK_CHARTS.includes(tmpDesign.attackChart) ? tmpDesign.attackChart : "None",
					attackNotes: tmpDesign.attackNotes || ""
				},
				notes: tmpNotes.join("\n")
			}
		};

		var tmpItems = [];
		// Attacks: the standard ones the body gives and the ones bought from the abilities list.
		for (const tmpAttack of tmpDesign.attacks ?? []) {
			if (!tmpAttack?.name) { continue; }
			tmpItems.push({
				name: tmpAttack.name, type: "creatureAttack",
				system: {
					attackType: tmpAttack.attackType || "Melee",
					damage: tmpAttack.damage || "",
					damageType: tmpAttack.damageType || "",
					speed: parseInt(tmpAttack.speed) || 3,
					minSpeed: parseInt(tmpAttack.minSpeed) || 0,
					sourcebook: "Master's Manual", page: "287",
					description: tmpAttack.note ? `<p>${tmpAttack.note}</p>` : ""
				}
			});
		}
		// Traits: abilities, disabilities and immunities, from the packs where they are known.
		for (const tmpPick of tmpDesign.abilityRows ?? []) {
			var tmpCategory = tmpPick.list == "disability" ? "disability" : (tmpPick.list == "immunity" ? "immunity" : "ability");
			var tmpDoc = stripId(tmpFind.trait ? tmpFind.trait(tmpPick.name, tmpCategory) : null);
			var tmpNameOut = tmpPick.name + (tmpPick.unit && tmpPick.count > 1 ? ` (x${tmpPick.count})` : "");
			if (tmpDoc) {
				tmpItems.push({ ...tmpDoc, name: tmpNameOut, system: { ...tmpDoc.system, category: tmpCategory } });
			} else {
				tmpItems.push({ name: tmpNameOut, type: "trait", system: { category: tmpCategory, canonicalName: tmpPick.name, value1: "", value2: "",
					sourcebook: "Master's Manual", page: "", description: tmpPick.note ? `<p>${tmpPick.note} (${tmpPick.pp} PP)</p>` : `<p>${tmpPick.pp} PP</p>` } });
			}
		}
		// Hide, as his Configurator lists it among the abilities ("Hide(Fur)") so the sheet says what kind.
		if ((parseInt(tmpDesign.hide) || 0) > 0 && tmpDesign.hideKind && tmpDesign.hideKind != "None") {
			var tmpHideName = `Hide (${tmpDesign.hideKind})`;
			var tmpHideDoc = stripId(tmpFind.trait ? tmpFind.trait(tmpHideName, "ability") : null);
			tmpItems.push(tmpHideDoc
				? { ...tmpHideDoc, name: tmpHideName }
				: { name: tmpHideName, type: "trait", system: { category: "ability", canonicalName: tmpHideName, value1: "", value2: "",
					sourcebook: "Master's Manual", page: "290", description: `<p>${tmpDesign.hide} points of ${tmpDesign.hideKind.toLowerCase()} hide.</p>` } });
		}
		// Powers: innate spells and invocations, as his createAllCreaturePowers files them.
		for (const tmpPower of tmpDesign.powers ?? []) {
			if (!tmpPower.name) { continue; }
			var tmpSpell = tmpFind.spell ? tmpFind.spell(tmpPower.name) : null;
			var tmpInvocation = tmpSpell ? null : (tmpFind.invocation ? tmpFind.invocation(tmpPower.name) : null);
			var tmpSource = tmpSpell ?? tmpInvocation;
			var tmpUses = Math.max(1, parseInt(tmpPower.uses) || 1);
			tmpItems.push({
				name: tmpPower.name, type: "power",
				system: {
					unlimited: !!tmpPower.atWill, uses: tmpUses, usesMax: tmpUses,
					powerKind: tmpSpell ? "spell" : (tmpInvocation ? "invocation" : "unknown"),
					sourcebook: tmpSource?.system?.sourcebook ?? "", page: tmpSource?.system?.page ?? "",
					description: tmpSource?.system?.description ?? ""
				}
			});
		}
		return { actor: tmpActor, items: tmpItems };
	}

	// This is the function which copies a compendium document without its id, so the creature gets its
	// own embedded copy rather than a reference to the pack's.
	function stripId(tmpDoc) {
		if (!tmpDoc) { return null; }
		var { _id, ...tmpRest } = tmpDoc;
		return tmpRest;
	}

// @MARKER ADD NEW creature generator rule functions HERE
// @END (CODE)
