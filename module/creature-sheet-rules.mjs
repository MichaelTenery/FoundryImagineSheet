// @START (CODE)
// @MARKER CREATURE SHEET RULES
//==================================================================================================================
// The rules behind the creature sheet's own controls, with no Foundry in them, so tools/creature-test.html
// can drive them. The sheet (module/sheets/actor-creature-sheet.mjs) rolls the dice and writes the
// documents; everything it decides is here.
//
// His creature is authored on a Configurator tab and then committed with a Finish button
// (handleCreatureFinish, sheet-worker.js:174660). The port edits in place on the sheet instead, the
// Foundry way -- the provisional D7 of the creature audit (docs/DECISIONS.md 2026-09-23). What that
// needs from the rules side:
//
//   characteristic rolls   Perception (and double), Affinity, Fortune -- his creature buttons,
//                          sheet-worker.js:24510-24648
//   the hide cap           his errata's 5 x level, warned about rather than enforced
//   jumps                  his Agility switch, setCreatureMovementValues (178893-179003)
//   the body chart         his "Name(Type:xN)" string read into rows and written back, so an
//                          area can be added, removed or re-weighted without typing the string
//   list rows              moving and removing an entry of a stored list (movement modes, skills)
//==================================================================================================================

import { BODY_CHARTS } from "./combat-tables.mjs";
import { getAreaMultiplier, getMovementBase } from "./combat/combat-rules.mjs";
import { BODY_AREA_TYPES, HIDE_CAP, HIDE_CAP_EXEMPT_TYPES, HIDE_CAP_EXEMPT_SIZES } from "./creature-tables.mjs";

//==================================================================================================================
// @MARKER CHARACTERISTIC ROLLS
//==================================================================================================================

	// The three answers each characteristic roll can give. The same table the character sheet's
	// Perception, Affinity and Fortune buttons use (actor-character-sheet.mjs, @MARKER CHARACTERISTIC
	// ROLL, bug report 0.18.1:1), so one creature and one character rolling the same figure read the same.
	//
	// His creature handlers are thinner: Perception and Affinity are pass/fail ("perceived? = true"),
	// and only Fortune has a third band -- "misfortunate" over 100 minus the chance, "unfortunate"
	// between (24593-24617). The bug report's three bands are a superset of his, and the two sheets
	// are kept alike rather than letting a creature's Perception mean something different.
	//                    good                  bad                neither
	export const CHARACTERISTIC_RESULTS = {
		perception:  [ "Perceived",          "Inattentive",     "Nothing Perceived" ],
		affinity:    [ "Affinity ensues",    "Enmity ensues",   "Neither Affinity or Enmity" ],
		fortune:     [ "Fortunate",          "Misfortunate",    "Neither fortunate nor misfortunate" ]
	};

	// This is the function which works out one characteristic roll.
	//
	//     roll <= chance                  the good result
	//     roll >  100 - (single chance)   the bad result
	//     anything else                   neither
	//
	// Double Perception doubles only the chance -- his roll_creature_per_dbl (24530), "if (chance>0)
	// { chance=chance*2; }" -- and the bad band stays 100 minus the SINGLE chance, as the character's
	// does. (The character sheet doubles without the "above 0" test. The answer cannot differ: a chance
	// of 0 or less is never rolled under, doubled or not.) A modifier (his Affinity and Fortune "+mod" buttons, 24571 and 24619, a shift-click here) is
	// added to the single chance before anything else, as his "chance=chance+tempmod" is, so it moves
	// the bad band too.
	//
	// His Fortune "+mod" also reads the chance as TEXT and adds the modifier to it -- "16" plus 5 is
	// "165", Roll20 handing attribute values back as text (24625) -- and then holds it to 1-99, so
	// his modified Fortune roll is almost always at 99. That is plainly a slip
	// (docs/UPSTREAM-ISSUES.md, 2026-09-23); the modifier is added as a number here and not held to
	// 1-99, as none of his other characteristic rolls are.
	//
	// Returns { key, chance, single, roll, outcome, good, bad, label } or null for a key it does not know.
	export function resolveCharacteristicRoll(tmpKey, tmpBase, tmpRoll, tmpDouble, tmpModifier) {
		var tmpResults = CHARACTERISTIC_RESULTS[tmpKey];
		if (!tmpResults) { return null; }
		var tmpSingle = (parseInt(tmpBase) || 0) + (parseInt(tmpModifier) || 0);
		var tmpChance = (tmpDouble && tmpSingle > 0) ? tmpSingle * 2 : tmpSingle;
		var tmpDie = parseInt(tmpRoll) || 0;

		var tmpOutcome = tmpResults[2];
		var tmpGood = false;
		var tmpBad = false;
		if (tmpDie <= tmpChance)           { tmpOutcome = tmpResults[0]; tmpGood = true; }
		else if (tmpDie > 100 - tmpSingle) { tmpOutcome = tmpResults[1]; tmpBad = true; }

		var tmpLabel = tmpKey.charAt(0).toUpperCase() + tmpKey.slice(1);
		if (tmpDouble) { tmpLabel = "Double " + tmpLabel; }
		return { key: tmpKey, chance: tmpChance, single: tmpSingle, roll: tmpDie, outcome: tmpOutcome,
		         good: tmpGood, bad: tmpBad, label: tmpLabel };
	}

//==================================================================================================================
// @MARKER HIDE CAP
//==================================================================================================================

	// This is the function which gives the most Hide a creature may have under his errata: 5 per level,
	// level 0 counting as 1. Returns null for a creature the errata exempts -- a plant or magical plant
	// (its type) or anything Titanic (its size) -- which has no cap at all.
	// See HIDE_CAP in creature-tables.mjs for the errata's own words.
	export function getCreatureHideMax(tmpLevel, tmpCreatureType, tmpSize) {
		if (HIDE_CAP_EXEMPT_TYPES.includes(String(tmpCreatureType ?? ""))) { return null; }
		if (HIDE_CAP_EXEMPT_SIZES.includes(String(tmpSize ?? ""))) { return null; }
		var tmpLevelValue = parseInt(tmpLevel) || 0;
		if (tmpLevelValue < HIDE_CAP.minimumLevel) { tmpLevelValue = HIDE_CAP.minimumLevel; }
		return tmpLevelValue * HIDE_CAP.perLevel;
	}

//==================================================================================================================
// @MARKER JUMPS
//==================================================================================================================

	// This is the function which works out a creature's two jump distances, in feet.
	//
	// His setCreatureMovementValues (sheet-worker.js:178893-179003) switches on Agility 0-30 for a
	// standing jump and a jump up, then adds the temporary modifiers from his modifiers page
	// (tmp_move_stand_jump_mod_input, tmp_move_up_jump_mod_input). Every one of his thirty-one cases is
	// the same pair of figures his character movement table gives for that Agility -- MOVEMENT_BASE in
	// combat-tables.mjs, from calcMovement -- so the one table serves both and nothing is transcribed
	// twice. Checked case by case: creature-test.html walks every Agility from 0 to 30 against his switch.
	//
	// He does not floor the result; a modifier that took a jump below nothing would show a negative
	// distance. It is held at 0 here, as the character's is.
	export function getCreatureJumps(tmpAgility, tmpStandMod, tmpUpMod) {
		var tmpBase = getMovementBase(tmpAgility);
		var tmpStand = tmpBase.jumpStand + (parseFloat(tmpStandMod) || 0);
		var tmpUp = tmpBase.jumpUp + (parseFloat(tmpUpMod) || 0);
		return {
			baseStand: tmpBase.jumpStand, baseUp: tmpBase.jumpUp,
			stand: tmpStand < 0 ? 0 : tmpStand,
			up: tmpUp < 0 ? 0 : tmpUp
		};
	}

//==================================================================================================================
// @MARKER BODY CHART ROWS
//==================================================================================================================

	// The Endurance multipliers an area may carry: the fourteen his custom body-area builder offers
	// (the END select, HTML 80858-80872), put smallest first. The label is what is written into the
	// chart string; the value is what getAreaMultiplier reads back out of it.
	//                 label     value
	export const BODY_AREA_MULTIPLIERS = [
		[ "x1/20",  0.05 ],
		[ "x1/10",  0.1  ],
		[ "x1/4",   0.25 ],
		[ "x1/2",   0.5  ],
		[ "x1",     1    ],
		[ "x2",     2    ],
		[ "x3",     3    ],
		[ "x4",     4    ],
		[ "x5",     5    ],
		[ "x6",     6    ],
		[ "x7",     7    ],
		[ "x8",     8    ],
		[ "x9",     9    ],
		[ "x10",    10   ]
	];

	// This is the function which gives the multiplier label for a value -- x1 for anything it does not
	// know, which is what getAreaMultiplier falls back to as well.
	function getMultiplierLabel(tmpValue) {
		var tmpRow = BODY_AREA_MULTIPLIERS.find(([tmpLabel, tmpNumber]) => tmpNumber == tmpValue);
		return tmpRow ? tmpRow[0] : "x1";
	}

	// This is the function which reads a chart string into rows for the sheet's editor.
	//
	// Unlike parseBodyChart in combat-rules.mjs -- which is what the wounds arithmetic reads, and which
	// only asks "Vital or not" -- this keeps the area's own kind (Vital, Limb, Other, Wing), because an
	// editor that turned every Wing into a Limb on the first save would be rewriting his data. The
	// multiplier is read with the same getAreaMultiplier, so what the editor shows is what the body uses.
	//
	// Returns [{ name, type, multiplier }], multiplier as its label ("x1/2").
	export function readBodyChartRows(tmpChart) {
		var tmpRows = [];
		var tmpText = String(tmpChart ?? "").trim();
		if (!tmpText) { return tmpRows; }
		for (const tmpEntry of tmpText.split(",")) {
			var tmpOpen = tmpEntry.lastIndexOf("(");
			var tmpName = (tmpOpen >= 0 ? tmpEntry.slice(0, tmpOpen) : tmpEntry).trim();
			if (!tmpName) { continue; }
			var tmpDetails = tmpOpen >= 0 ? tmpEntry.slice(tmpOpen + 1).replace(")", "") : "";
			var tmpKind = tmpDetails.split(":")[0].trim();
			if (!BODY_AREA_TYPES.includes(tmpKind)) { tmpKind = tmpDetails.includes("Vital") ? "Vital" : "Limb"; }
			tmpRows.push({ name: tmpName, type: tmpKind, multiplier: getMultiplierLabel(getAreaMultiplier(tmpDetails)) });
		}
		return tmpRows;
	}

	// This is the function which writes rows back into his chart string, "Name(Type:xN),Name(Type:xN)".
	//
	// A comma or a bracket in an area's name would break the string apart (his createBodyAreas splits
	// on "," and reads the details after the LAST "("), so both are taken out of the name. So is a
	// full stop, which his sheet would not mind but Foundry would: the Combat tab writes each area's
	// wounds to system.body.wounds.<area name>, and a dot there is read as a deeper key. None of his
	// stock charts has any of the three. A row with no name is dropped, which is how the editor
	// removes one without a separate button. An unknown kind is written as Limb and an unknown
	// multiplier as x1, the same fallbacks the reading side has.
	export function serializeBodyChart(tmpRows) {
		var tmpParts = [];
		for (const tmpRow of tmpRows ?? []) {
			var tmpName = cleanBodyAreaName(tmpRow?.name);
			if (!tmpName) { continue; }
			var tmpKind = BODY_AREA_TYPES.includes(tmpRow?.type) ? tmpRow.type : "Limb";
			var tmpMulti = BODY_AREA_MULTIPLIERS.some(([tmpLabel]) => tmpLabel == tmpRow?.multiplier) ? tmpRow.multiplier : "x1";
			tmpParts.push(`${tmpName}(${tmpKind}:${tmpMulti})`);
		}
		return tmpParts.join(",");
	}

	// This is the function which cleans one area's name the way serializeBodyChart writes it: no comma,
	// bracket or full stop, single spaces, trimmed.
	function cleanBodyAreaName(tmpName) {
		return String(tmpName ?? "").replace(/[,().]/g, " ").replace(/\s+/g, " ").trim();
	}

	// This is the function which gives a name for a new area that no area of the chart has yet: "New
	// Area", then "New Area 2", "New Area 3" and on. The port keeps each area's wounds BY NAME
	// (system.body.wounds.<name>), and parseBodyChart tells a repeated name apart only by its place --
	// "New Area", "New Area (2)" -- so two areas added under one name are two areas whose wound records
	// move if the first is removed or renamed. His builder keeps each area in its own repeating row and
	// never had the problem.
	export function getNewBodyAreaName(tmpRows, tmpStem) {
		var tmpBase = cleanBodyAreaName(tmpStem) || "New Area";
		var tmpTaken = new Set((tmpRows ?? []).map(tmpRow => cleanBodyAreaName(tmpRow?.name)));
		if (!tmpTaken.has(tmpBase)) { return tmpBase; }
		var tmpNumber = 2;
		while (tmpTaken.has(`${tmpBase} ${tmpNumber}`)) { tmpNumber = tmpNumber + 1; }
		return `${tmpBase} ${tmpNumber}`;
	}

	// This is the function which lists the names more than one row of a chart carries, once each and as
	// they will be written -- for the sheet to warn about, as it warns about the hide cap. The body reads
	// them as separate areas, the second "Name (2)" and so on (parseBodyChart), each with its own wounds;
	// but those records are keyed by place, so removing or renaming the first moves the rest's wounds
	// onto the wrong area. Nothing is renamed for the Game Master: his own Segmented Worm chart repeats
	// "Left Foot12" and "Right Foot12", and a round trip through the editor must leave his charts as
	// they are.
	export function getDuplicateBodyAreaNames(tmpRows) {
		var tmpSeen = new Set();
		var tmpDuplicates = [];
		for (const tmpRow of tmpRows ?? []) {
			var tmpName = cleanBodyAreaName(tmpRow?.name);
			if (!tmpName) { continue; }
			if (tmpSeen.has(tmpName) && !tmpDuplicates.includes(tmpName)) { tmpDuplicates.push(tmpName); }
			tmpSeen.add(tmpName);
		}
		return tmpDuplicates;
	}

	// This is the function which gives the stock chart string for a body type -- what his Configurator
	// seeds the area list with when a body type is picked (change:creature_bodytype_select,
	// sheet-worker.js:22262-22294) -- or "" for Custom, which his handler empties for building area by
	// area, and for any name that is not one of his charts. Copying it into the creature's own chart is
	// where hand editing starts.
	export function getStockBodyChart(tmpBodyType) {
		return BODY_CHARTS[tmpBodyType] ?? "";
	}

//==================================================================================================================
// @MARKER LIST ROWS
//==================================================================================================================

	// This is the function which moves one entry of a stored list up (-1) or down (+1), returning a new
	// list. His Configurator asks for movement modes slowest first with special modes last (HTML
	// 81003-81007), so the order is meaningful and has to be changeable. Out of range does nothing.
	export function moveListEntry(tmpList, tmpIndex, tmpOffset) {
		var tmpCopy = [...(tmpList ?? [])];
		var tmpFrom = parseInt(tmpIndex);
		var tmpTo = tmpFrom + (parseInt(tmpOffset) || 0);
		if (isNaN(tmpFrom) || tmpFrom < 0 || tmpFrom >= tmpCopy.length) { return tmpCopy; }
		if (tmpTo < 0 || tmpTo >= tmpCopy.length || tmpTo == tmpFrom) { return tmpCopy; }
		var [tmpEntry] = tmpCopy.splice(tmpFrom, 1);
		tmpCopy.splice(tmpTo, 0, tmpEntry);
		return tmpCopy;
	}

	// This is the function which removes one entry of a stored list, returning a new list.
	export function removeListEntry(tmpList, tmpIndex) {
		var tmpCopy = [...(tmpList ?? [])];
		var tmpAt = parseInt(tmpIndex);
		if (isNaN(tmpAt) || tmpAt < 0 || tmpAt >= tmpCopy.length) { return tmpCopy; }
		tmpCopy.splice(tmpAt, 1);
		return tmpCopy;
	}

// @MARKER ADD NEW creature sheet rule functions HERE
// @END (CODE)
