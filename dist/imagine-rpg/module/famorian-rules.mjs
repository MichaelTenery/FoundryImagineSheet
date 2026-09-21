// @START (CODE)
// @MARKER FAMORIAN RULES
//==================================================================================================================
// A Famorian's breed, its evoke budget, and the fifteen evokes that change a number. No Foundry
// dependency, so it can be tested outside it.
//
// A Famorian is beast-blooded and its body is BUILT rather than looked up. His case at
// sheet-worker.js:33032 is 593 lines, and it divides cleanly in two:
//
//     the ELSE branch of every evoke test   a Famorian that has taken no evokes. That is an
//                                           ordinary race and is the Famorian race document.
//     the IF branch of every evoke test     what each evoke does.
//
// OF ABOUT 120 EVOKES, FIFTEEN CHANGE A NUMBER. They are all below, each citing his line. Every
// other evoke is a described ability with no figure attached -- listed on the character, not
// applied, which is the call already made for racial abilities generally.
//
// The breed is ROLLED, and a world setting offers the choice instead: the same shape as handedness
// (DECISIONS.md 2026-09-20), and for the same reason -- his sheet rolls it and never asks.
//==================================================================================================================

// @MARKER NUMERIC EVOKES
// The fifteen, in the order his code applies them, because ORDER MATTERS for two of the groups.
//
// SPECIAL MOVEMENT: four evokes write the same three slots, and his own comment on the first says
// "set fins first (swimming is of least importance)" -- so a later one overwrites an earlier one,
// and a Famorian with both fins and wings flies. The order is his: fins, insect legs, animal legs,
// wings.
//
// SPEED MULTIPLIER: three evokes write the same slot, so the last applied wins there too.
export const FAMORIAN_NUMERIC_EVOKES = {
	// key                 what it does                                            his line
	str:                 { attribute: "str", dice: 3 },                         // 33044
	agl:                 { attribute: "agl", dice: 3 },                         // 33054
	vit:                 { attribute: "vit", dice: 3 },                         // 33064
	end:                 { endurance: { startMod: 3, titleFormula: "1d4+2",
	                                    titleDice: "1", titleMax: 4, titleMod: 2 } },  // 33148
	poison_resist:       { resistance: "poison",  value: 20 },                  // 33168
	disease_resist:      { resistance: "disease", value: 10 },                  // 33176
	stubborn:            { resistance: "control", value: 20 },                  // 33184
	fins:                { special: "Swim:",   from: "Walk", multiplier: 3, mods: [0, 0, 0] },      // 33192
	extra_insect_legs:   { special: "Scurry:", from: "Walk", multiplier: 4, mods: [4, 40, 4] },     // 33206
	extra_legs:          { special: "Gallop:", from: "Walk", multiplier: 4, mods: [0, 0, 0] },      // 33220
	wings:               { special: "Fly:",    from: "Walk", multiplier: 4, mods: [0, 0, 0] },      // 33234
	speed:               { speedMultiplier: 1.5, speedNote: "(Speed: 1.5 all movement)" },          // 33248
	hooves:              { speedMultiplier: 1.5, speedNote: "(Speed: 1.5 ground movement)" },       // 33263
	jumping:             { jumpStand: "x3", jumpUp: "x2" },                     // 33274
	metabolism_very_slow: { speedMultiplier: 0.5, speedNote: "(Speed: half ground movement)" }      // 33495
};

// The order his code applies them in. Anything not named here has no numeric effect.
const EVOKE_ORDER = ["str", "agl", "vit", "end", "poison_resist", "disease_resist", "stubborn",
	"fins", "extra_insect_legs", "extra_legs", "wings", "speed", "hooves", "jumping",
	"metabolism_very_slow"];

	// This is the function which says which breed a d100 rolled.
	//
	// His table (16736): 1-10 Hidden, 11-20 Trace, 21-40 Low, 41-60 Breed, 61-90 High, 91-95 True,
	// 96-100 Inbreed. The bands come off the race document rather than being written here, so a
	// corrected sheet moves them without touching this.
	export function getFamorianBreed(tmpBreeds, tmpRoll) {
		var tmpDie = parseInt(tmpRoll) || 0;
		return (tmpBreeds ?? []).find(tmpBand => tmpDie >= tmpBand.low && tmpDie <= tmpBand.high) ?? null;
	}

	// This is the function which says how many evokes a breed allows, given a roller.
	//
	// His budgets are 1, 1d2, 1d4, 1d4+1, 1d6+1, 1d6+2 and "All". "All" comes back as null, which
	// means no ceiling -- his own check reads `famorian_tmp_evoke_num != "All"` before comparing,
	// so "All" is an absence of a limit rather than a big number.
	export function rollEvokeBudget(tmpBreed, tmpRoller) {
		var tmpText = String(tmpBreed?.evokes ?? "").trim();
		if (!tmpText || tmpText.toLowerCase() == "all") { return null; }
		var tmpMatch = tmpText.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
		if (!tmpMatch) { return parseInt(tmpText) || 0; }
		var tmpCount = parseInt(tmpMatch[1] || "1") || 1;
		var tmpFaces = parseInt(tmpMatch[2]) || 1;
		var tmpTotal = parseInt(tmpMatch[3] || "0") || 0;
		for (var tmpN = 0; tmpN < tmpCount; tmpN++) { tmpTotal += (tmpRoller ? tmpRoller(tmpFaces) : 1); }
		return tmpTotal;
	}

	// This is the function which says whether a character has spent more evokes than its breed
	// allows. His own gate (7980) refuses to call character creation done while
	// `race_famorian_tmp_evokes_used > famorian_tmp_evoke_num`, with "All" meaning no ceiling.
	//
	// REPORTED, NOT REFUSED, which is the call already made for skill slots: his check happens at a
	// creation step, and here an evoke can be set on a sheet at any time.
	export function checkEvokeBudget(tmpChosen, tmpAllowed) {
		var tmpUsed = (tmpChosen ?? []).length;
		if (tmpAllowed === null || tmpAllowed === undefined) { return { used: tmpUsed, allowed: null, issue: "" }; }
		if (tmpUsed <= tmpAllowed) { return { used: tmpUsed, allowed: tmpAllowed, issue: "" }; }
		return {
			used: tmpUsed, allowed: tmpAllowed,
			issue: `This Famorian has taken ${tmpUsed} evokes and its breed allows ${tmpAllowed}.`
		};
	}

	// This is the function which rolls the three attribute evokes.
	//
	// Strength, Agility and Vitality each add 1d3 when taken, rolled once when the race is applied
	// and then kept -- his famorian_evoke_str_tmp and its two siblings. Returns only the ones taken,
	// so an evoke dropped later takes its points with it.
	export function rollEvokeAttributes(tmpChosen, tmpRoller) {
		var tmpOut = {};
		for (const tmpKey of ["str", "agl", "vit"]) {
			if ((tmpChosen ?? []).includes(tmpKey)) {
				tmpOut[tmpKey] = tmpRoller ? tmpRoller(FAMORIAN_NUMERIC_EVOKES[tmpKey].dice) : 1;
			}
		}
		return tmpOut;
	}

	// This is the function which builds the race a Famorian character actually has, out of the base
	// race and the evokes it has taken. Returns the same shape as a race item's system data, so
	// everything that reads a race reads this unchanged -- as combineHalfRace and combineFormless do.
	//
	// tmpBonuses is what rollEvokeAttributes returned, kept on the character rather than re-rolled,
	// because a modifier that changed every time the sheet re-rendered would not be a modifier.
	export function applyFamorianEvokes(tmpRaceSystem, tmpChosen, tmpBonuses) {
		if (!tmpRaceSystem?.famorian?.isFamorian) { return tmpRaceSystem; }
		var tmpTaken = tmpChosen ?? [];
		var tmpOut = {
			...tmpRaceSystem,
			attributeMods: { ...(tmpRaceSystem.attributeMods ?? {}) },
			endurance: { ...(tmpRaceSystem.endurance ?? {}) },
			resistanceMods: { ...(tmpRaceSystem.resistanceMods ?? {}) },
			movement: structuredClone(tmpRaceSystem.movement ?? {})
		};
		tmpOut.speedNote = "";

		for (const tmpKey of EVOKE_ORDER) {
			if (!tmpTaken.includes(tmpKey)) { continue; }
			var tmpRule = FAMORIAN_NUMERIC_EVOKES[tmpKey];

			// The three attribute evokes, each 1d3 rolled once and kept on the character.
			if (tmpRule.attribute) {
				tmpOut.attributeMods[tmpRule.attribute] =
					(tmpOut.attributeMods[tmpRule.attribute] ?? 0) + (parseInt(tmpBonuses?.[tmpRule.attribute]) || 0);
			}
			// Endurance is replaced outright, not added to: his if branch writes all five fields.
			if (tmpRule.endurance) { tmpOut.endurance = { ...tmpOut.endurance, ...tmpRule.endurance }; }
			// A resistance is SET, not added: his figures are absolute, which is why Enhanced
			// Disease Resist reads "+20%" on the sheet while writing 10 over a base of -10.
			if (tmpRule.resistance) { tmpOut.resistanceMods[tmpRule.resistance] = tmpRule.value; }
			// Special movement: four evokes write the same slots and the last one wins, which is
			// his own ordering and his own comment -- swimming is of least importance.
			if (tmpRule.special) {
				tmpOut.movement.specialName = tmpRule.special;
				tmpOut.movement.special = {
					hourly: tmpRule.from, hourlyMultiplier: tmpRule.multiplier, hourlyMod: tmpRule.mods[0],
					tenSec: tmpRule.from, tenSecMultiplier: tmpRule.multiplier, tenSecMod: tmpRule.mods[1],
					oneSec: tmpRule.from, oneSecMultiplier: tmpRule.multiplier, oneSecMod: tmpRule.mods[2]
				};
			}
			if (tmpRule.speedMultiplier !== undefined) {
				tmpOut.movement.speedMultiplier = tmpRule.speedMultiplier;
				tmpOut.speedNote = tmpRule.speedNote;
			}
			if (tmpRule.jumpStand !== undefined) {
				tmpOut.movement.jumpStand = tmpRule.jumpStand;
				tmpOut.movement.jumpUp = tmpRule.jumpUp;
			}
		}
		return tmpOut;
	}

	// This is the function which lists the evokes a character has taken, for the sheet to show.
	//
	// Every evoke, numeric or not, with its label and its rules. The ~105 that change no number are
	// the whole point of this: they are what the character actually IS, and they are listed rather
	// than applied, as racial abilities are.
	export function describeEvokes(tmpRaceSystem, tmpChosen, tmpBonuses) {
		var tmpCatalogue = tmpRaceSystem?.famorian?.evokes ?? [];
		return (tmpChosen ?? []).map(tmpKey => {
			var tmpEntry = tmpCatalogue.find(tmpOne => tmpOne.key == tmpKey);
			var tmpLabel = tmpEntry ? tmpEntry.label : tmpKey;
			var tmpBonus = tmpBonuses?.[tmpKey];
			return {
				key: tmpKey,
				label: tmpBonus ? `${tmpLabel} (+${tmpBonus})` : tmpLabel,
				detail: tmpEntry ? tmpEntry.detail : "",
				numeric: tmpKey in FAMORIAN_NUMERIC_EVOKES
			};
		});
	}
// @END (CODE)
