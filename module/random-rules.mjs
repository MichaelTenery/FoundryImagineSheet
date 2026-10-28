// @START (CODE)
// @MARKER RANDOM RULES
//==================================================================================================================
// What the Game Master's Randoms/Extras tool rolls -- his DICE, RANDOM ENCOUNTER, RANDOM DIRECTION, DOUBLE
// REFLECTION, RANDOM INSANITY, RANDOM ANIMAL, SUBSTANCE, ELEMENT, PLANE, SUBJECT, SKILL, SOCIAL SKILL, RACE,
// CLASS and ALIGNMENT, ALIGNMENT COLOR, MAGIC CHAOS EFFECT and the two RANDOM SPELLs.
//
// Ported from the handlers at sheet-worker.js:72712-72850 and the functions each calls (cited beside
// each below). Nothing here touches Foundry or a random source: every function is handed  tmpdie , a
// function that takes a number of sides and gives back 1 to that number -- his getDieRoll
// (sheet-worker.js:25405) -- so the test can feed it a fixed sequence and the window can feed it
// Foundry's own dice. The tables are in module/random-tables.mjs.
//==================================================================================================================

import {
	RANDOM_DIRECTIONS, DEFAULT_ENCOUNTER_CHANCE, REFLECTION_RESULTS, REFLECTION_AFFECTED, INSANITY_TYPES,
	DEPRESSIVE_DISORDERS, NEUROTIC_DISORDERS, AMNESIA_LOSSES, PSYCHOTIC_DISORDERS, SCHIZOPHRENIAS,
	MULTIPLE_PERSONALITIES, INSANITY_DURATIONS, AURA_COLORS, AURA_COLORS_UNALIGNED, AURA_COLOR_DEFAULT,
	CHAOS_EFFECTS, RANDOM_ANIMALS, RANDOM_HORSES, RANDOM_INSECTS, RANDOM_SNAKES, RANDOM_SPIDERS,
	RANDOM_ELEMENTS, RANDOM_SUBSTANCES, RANDOM_PLANES, RANDOM_SUBJECTS, RANDOM_SKILLS, RANDOM_SOCIAL_SKILLS,
	RANDOM_RACES, RANDOM_CLASSES, RANDOM_ALIGNMENTS, RANDOM_SPELLS_BY_AURA
} from "./random-tables.mjs";

// @MARKER DICE STRINGS
// His rollDiceFromString / getMaxValueFromDiceString (sheet-worker.js:25431, 25509): "1d3", "4d6",
// "3d4+2". Anything without a "d" in it is nothing at all, which his handler (72706) shows as 0.
// Two small additions: a "-" modifier is read as well as his "+", and a count is held to 1000 so a
// stray extra zero cannot hang the window.
const DICE_STRING = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

export function parseDiceString(tmpstring) {
	var tmpmatch = DICE_STRING.exec("" + tmpstring);
	if (!tmpmatch) { return null; }
	return {
		count: Math.min(parseInt(tmpmatch[1]) || 0, 1000),
		sides: parseInt(tmpmatch[2]) || 0,
		modifier: (tmpmatch[3] == "-" ? -1 : 1) * (parseInt(tmpmatch[4]) || 0)
	};
}

// This is the function which rolls a dice string, or 0 where it is not one.
export function rollDiceString(tmpstring, tmpdie) {
	var tmpdice = parseDiceString(tmpstring);
	if (!tmpdice || tmpdice.sides < 1) { return 0; }
	var tmptotal = 0;
	for (var tmpi = 0; tmpi < tmpdice.count; tmpi++) { tmptotal += tmpdie(tmpdice.sides); }
	return tmptotal + tmpdice.modifier;
}

// This is the function which gives the most a dice string can come to (his "Get Maximum Value").
export function getMaxDiceString(tmpstring) {
	var tmpdice = parseDiceString(tmpstring);
	if (!tmpdice || tmpdice.sides < 1) { return 0; }
	return tmpdice.count * tmpdice.sides + tmpdice.modifier;
}

// This is the function which does his DICE button: the roll, or the maximum if that box is ticked.
export function rollDiceTool(tmpstring, tmpmax, tmpdie) {
	return tmpmax ? getMaxDiceString(tmpstring) : rollDiceString(tmpstring, tmpdie);
}

// @MARKER PLAIN DRAWS
// His getRandomElementInArray (sheet-worker.js:26284): a die as big as the list, one entry.
export function pickFromList(tmplist, tmpdie) {
	return tmplist.length > 0 ? tmplist[tmpdie(tmplist.length) - 1] : "";
}

// This is the function which reads a row table (rows of [ low, high, ...]) at a roll.
export function findRow(tmprows, tmproll) {
	return tmprows.find(tmprow => tmproll >= tmprow[0] && tmproll <= tmprow[1]) ?? null;
}

// This is the function which fills a row's "%" with a dice string rolled.
function fillDice(tmptext, tmpdicestring, tmpdie) {
	return tmpdicestring ? tmptext.replace("%", "" + rollDiceString(tmpdicestring, tmpdie)) : tmptext;
}

// @MARKER ENCOUNTER (handleRollEncounter, sheet-worker.js:72720)
export function rollEncounter(tmpchance, tmpdie) {
	var tmpsides = parseInt(tmpchance) || DEFAULT_ENCOUNTER_CHANCE;
	return tmpdie(tmpsides) == 1 ? "Encounter Occurs!" : "No Encounter.";
}

// @MARKER DIRECTION (getRandomDirection, sheet-worker.js:26444)
export function getRandomDirection(tmpdie) {
	return pickFromList(RANDOM_DIRECTIONS, tmpdie);
}

// @MARKER DOUBLE REFLECTION (getReflectionResult, sheet-worker.js:27641)
export function getReflectionResult(tmpdie) {
	var tmproll = tmpdie(100);
	var tmpdistance = tmpdie(20);
	var tmpaffected = tmpdie(2);
	var tmprow = findRow(REFLECTION_RESULTS, tmproll);
	return tmprow[2]
		.replace("%D", "" + tmpdistance)
		.replace("%W", tmprow[2].includes("%W") ? getRandomDirection(tmpdie) : "")
		.replace("%T", REFLECTION_AFFECTED[tmpaffected - 1]);
}

// @MARKER INSANITY (getRandomInsanity, sheet-worker.js:28371)
export function getRandomInsanity(tmpdie) {
	var tmpkind = findRow(INSANITY_TYPES, tmpdie(100))[2];
	if (tmpkind == "depressive") { return findRow(DEPRESSIVE_DISORDERS, tmpdie(100))[2]; }
	if (tmpkind == "neurotic") { return getNeuroticInsanity(tmpdie); }
	return getPsychoticInsanity(tmpdie);
}

function getNeuroticInsanity(tmpdie) {
	var tmpname = findRow(NEUROTIC_DISORDERS, tmpdie(100))[2];
	if (tmpname.startsWith("Amnesia")) {
		var tmploss = findRow(AMNESIA_LOSSES, tmpdie(100));
		tmpname += fillDice(tmploss[2], tmploss[3], tmpdie);
	}
	return tmpname;
}

function getPsychoticInsanity(tmpdie) {
	var tmpname = findRow(PSYCHOTIC_DISORDERS, tmpdie(100))[2];
	if (tmpname == "schizophrenia") { return findRow(SCHIZOPHRENIAS, tmpdie(100))[2]; }
	if (tmpname == "multiple") {
		var tmprow = findRow(MULTIPLE_PERSONALITIES, tmpdie(100));
		return tmprow[3] ? tmprow[2].replace("%", "" + (tmprow[3] + rollDiceString(tmprow[4], tmpdie))) : tmprow[2];
	}
	return tmpname;
}

// This is the function which gives how long it lasts (getRandomInsanityDuration, 28384).
export function getInsanityDuration(tmpdie) {
	var tmprow = findRow(INSANITY_DURATIONS, tmpdie(100));
	return fillDice(tmprow[2], tmprow[3], tmpdie);
}

// His handleRandomInsanity (72746): the disorder and its duration written one after the other.
export function rollInsanityTool(tmpdie) {
	return getRandomInsanity(tmpdie) + getInsanityDuration(tmpdie);
}

// @MARKER THE LIST DRAWS
// getRandomLandAnimal (sheet-worker.js:29118): a name with "Horse", "Insect", "Snake" or "Spider" in it
// is drawn again from that kind's own list.
export function getRandomAnimal(tmpdie) {
	var tmpname = pickFromList(RANDOM_ANIMALS, tmpdie);
	if (tmpname.includes("Horse")) { return pickFromList(RANDOM_HORSES, tmpdie); }
	if (tmpname.includes("Insect")) { return pickFromList(RANDOM_INSECTS, tmpdie); }
	if (tmpname.includes("Snake")) { return pickFromList(RANDOM_SNAKES, tmpdie); }
	if (tmpname.includes("Spider")) { return pickFromList(RANDOM_SPIDERS, tmpdie); }
	return tmpname;
}

export const getRandomSubstance = (tmpdie) => pickFromList(RANDOM_SUBSTANCES, tmpdie);   // 29166
export const getRandomElement   = (tmpdie) => pickFromList(RANDOM_ELEMENTS, tmpdie);     // 28798
export const getRandomPlane     = (tmpdie) => pickFromList(RANDOM_PLANES, tmpdie);       // 29173
export const getRandomSkill     = (tmpdie) => pickFromList(RANDOM_SKILLS, tmpdie);       // 29190
export const getRandomSocialSkill = (tmpdie) => pickFromList(RANDOM_SOCIAL_SKILLS, tmpdie); // 29197
export const getRandomRace      = (tmpdie) => pickFromList(RANDOM_RACES, tmpdie);        // 28103
export const getRandomClass     = (tmpdie) => pickFromList(RANDOM_CLASSES, tmpdie);      // 28119
export const getRandomAlignment = (tmpdie) => pickFromList(RANDOM_ALIGNMENTS, tmpdie);  // 28130

// getRandomSubject (sheet-worker.js:29180): three of its rows name a random skill, social skill or spell.
export function getRandomSubject(tmpdie) {
	var tmpname = pickFromList(RANDOM_SUBJECTS, tmpdie);
	if (tmpname == "Skill") { return "Skill(" + getRandomSkill(tmpdie) + ")"; }
	if (tmpname == "Social Skill") { return "Social Skill(" + getRandomSocialSkill(tmpdie) + ")"; }
	if (tmpname == "Spell") { return "Spell(" + getRandomSpell(tmpdie) + ")"; }
	return tmpname;
}

// @MARKER AURA COLOUR (getAuraColor, sheet-worker.js:27664)
// "Good(Active)" -- his random alignment's spelling -- and "Good (Active)" -- his dropdown's -- are
// the same alignment; the space before the bracket is ignored in the lookup.
export function getAuraColor(tmpalign, tmpdie) {
	if (tmpalign === "" || tmpalign === undefined || tmpalign === null) {
		return pickFromList(AURA_COLORS_UNALIGNED, tmpdie);
	}
	var tmpkey = ("" + tmpalign).replace(/\s*\(/, " (");
	return AURA_COLORS[tmpkey] ?? AURA_COLOR_DEFAULT;
}

// @MARKER CHAOS (getRandomChaosEffect, sheet-worker.js:29204)
export function getRandomChaosEffect(tmpdie) {
	return findRow(CHAOS_EFFECTS, tmpdie(100))[2];
}

// @MARKER SPELLS (getRandomSpell, 170020; getRandomSpellByLevel, 170027)
// A spell level is a d20 for the plain roll. By level, any whole number is accepted and a level with no
// list of spells (31, say) gives nothing, as his switch does.
export function getRandomSpellByLevel(tmplevel, tmpdie) {
	return pickFromList(RANDOM_SPELLS_BY_AURA[tmplevel] ?? [], tmpdie);
}

export function getRandomSpell(tmpdie) {
	return getRandomSpellByLevel(tmpdie(20), tmpdie);
}

// His handleRandomSpellByLevel (72820): an empty box is an empty answer; anything else is read as a
// whole number, 1 where it is not one.
export function rollSpellByLevelTool(tmpinput, tmpdie) {
	if (("" + (tmpinput ?? "")).trim() === "") { return ""; }
	return getRandomSpellByLevel(parseInt(tmpinput) || 1, tmpdie);
}
// @END (CODE)
