// @START (CODE)
// @MARKER STARTING MONEY
//==================================================================================================================
// The coins a new character starts with. Rules only -- no Foundry here, so tools/starting-money-test.html
// can drive the lot with scripted dice.
//
// His doing_coins, the function setCoins (sheet-worker.js:74147). His sheet runs it by itself when the
// racial features are confirmed (roll_finish_features, 6439), for every race whose money comes as
// coins; the few whose money comes as wilderness gear go to setWildernessEquipmentByRace instead,
// which on this port is the optional "Gear by culture" tick (module/starting-kit.mjs).
//
// Four parts, in his order, which is also the order the dice are rolled in:
//     1 apparent social class    a class below 5 or above 20 rolls 5d4 for one         74154
//     2 the Fortune roll         non-Nobles only (under 15): d100 against Fortune      74160
//     3 the multiplier           on a success, a second d100 on his Money Multiplier   74179
//     4 the coins                a switch on social class 5 to 20                      74197
//
// The Player's Guide has the same rule and the same two tables ("Starting Money", "Starting Fortune"
// and "Money Multiplier Random Table", p.207). Three places where his code and the book part company,
// each settled by the user's ruling of 2026-09-23 and recorded in docs/DECISIONS.md:
//     - the Fortune check reads the wrong way round in his code          UPSTREAM-ISSUES.md item 40
//     - Nobles lose the book's x5 and x10: "tempcoins*5;" assigns nothing  UPSTREAM-ISSUES.md item 67
//     - the Fortune it rolls against leaves out the race and the class   UPSTREAM-ISSUES.md item 68
//==================================================================================================================

import { rollDicePool } from "./chargen-rules.mjs";
import { getApparentSocialClass } from "./starting-kit.mjs";

	// @MARKER STARTING MONEY TABLE
	// His sixteen cases, one per social class (classes 11-12 and 13-14 share a case each in his code).
	//
	// "times" is the book's x5 and x10 for Nobles. His code writes them as "tempcoins*5;" and
	// "tempcoins*10;" -- a multiplication with no "tempcoins=" in front of it, which JavaScript works
	// out and throws away -- so on his sheet as it runs, a King's family starts with 10d20 platinum
	// where the book gives (10d20)x10. The multiplication is written, which says what was meant, and
	// the book agrees; the user's ruling of 2026-09-23 is to apply it. UPSTREAM-ISSUES.md item 67.
	export const STARTING_MONEY = {
		// social  dice      add  times  coin          rank or equivalent (Player's Guide p.207)
		5:  { dice: "5d4",   add: 0, times: 1,  coin: "copper"   },  // Slave or Escaped Slave
		6:  { dice: "5d8",   add: 0, times: 1,  coin: "copper"   },  // Freed Slave/Indentured
		7:  { dice: "3d10",  add: 0, times: 1,  coin: "silver"   },  // Peasant/Laborer
		8:  { dice: "3d20",  add: 0, times: 1,  coin: "silver"   },  // Peasant/Laborer
		9:  { dice: "2d4",   add: 2, times: 1,  coin: "gold"     },  // Common/Skilled Labor
		10: { dice: "4d4",   add: 0, times: 1,  coin: "gold"     },  // Common/Skilled Labor
		11: { dice: "4d6",   add: 2, times: 1,  coin: "gold"     },  // Tradesman/Craftsman
		12: { dice: "4d6",   add: 2, times: 1,  coin: "gold"     },  // Tradesman/Craftsman
		13: { dice: "6d8",   add: 0, times: 1,  coin: "gold"     },  // Master Trade/Craftsman
		14: { dice: "6d8",   add: 0, times: 1,  coin: "gold"     },  // Master Trade/Craftsman
		15: { dice: "8d4",   add: 0, times: 5,  coin: "gold"     },  // Noble, Knight Banneret (Family of)
		16: { dice: "5d10",  add: 0, times: 10, coin: "gold"     },  // Noble, Baron (Family of)
		17: { dice: "1d10",  add: 0, times: 10, coin: "platinum" },  // Noble, Count (Family of)
		18: { dice: "3d10",  add: 0, times: 10, coin: "platinum" },  // Noble, Earl (Family of)
		19: { dice: "5d10",  add: 0, times: 10, coin: "platinum" },  // Noble, Duke (Family of)
		20: { dice: "10d20", add: 0, times: 10, coin: "platinum" }   // Noble, King (Family of)
	};

	// The short name each coin goes by, as his tables and the book write them.
	export const COIN_ABBREVIATIONS = { copper: "cp", silver: "sp", gold: "gp", platinum: "pp" };

	// The social class at and above which a character is of noble background. Only those below it make
	// the Fortune roll: "(For non-nobles only!)" in the book, "tempsocial < 15" in his code.
	export const NOBLE_SOCIAL_CLASS = 15;

	// @MARKER MONEY MULTIPLIER TABLE
	// His Money Multiplier Random Table, read off one d100 once the Fortune roll has been made.
	// His ladder is "randperct<51 ... <71 ... <91 ... <96 ... <100 ... ==100", which is the book's
	// 01-50, 51-70, 71-90, 91-95, 96-99, 100.
	export const MONEY_MULTIPLIERS = [
		// d100 up to  multiplier
		[50,           2],
		[70,           3],
		[90,           4],
		[95,           5],
		[99,           8],
		[100,          10]
	];

	// This is the function which reads the multiplier off the d100. A roll the table does not cover --
	// there is none on a real d100 -- multiplies by nothing, rather than by the last row.
	export function getMoneyMultiplier(tmpPercent) {
		var tmpRoll = parseInt(tmpPercent) || 0;
		for (const [tmpUpTo, tmpMultiplier] of MONEY_MULTIPLIERS) {
			if (tmpRoll <= tmpUpTo) { return tmpRoll >= 1 ? tmpMultiplier : 1; }
		}
		return 1;
	}

	// @MARKER STARTING FORTUNE
	// This is the function which works out the Fortune the starting money is rolled against.
	//
	// His FORTUNE calculation (changeCharacteristics, sheet-worker.js:30333), as it stands on the day
	// the character is made:
	//     the average of Aura, Piety and Will Force, rounded up (his "+.99" idiom)
	//   + 5 for a class carrying "+5% Fortune"
	//   + 1 for the first title -- class_title_fortune, which he sets to 1 for everyone but a GME,
	//     who has no title (8145, 8158)
	//   + the race's own Fortune modifier (race_for_mod)
	//
	// His setCoins does NOT use this. It works out a Fortune of its own from the three attributes
	// alone: it fetches the race modifier and never adds it, and tests "values.class_modifiers" for
	// the +5% when the field it fetched is tmp_class_modifiers -- so the class bonus can never apply
	// either. The user's ruling of 2026-09-23 is the whole Fortune, the one the character actually has.
	// UPSTREAM-ISSUES.md item 68.
	export function getStartingFortune(tmpAur, tmpPty, tmpWil, tmpRaceMod, tmpClassMods, tmpNonClassed) {
		var tmpFortune = parseInt((((parseInt(tmpAur) || 0) + (parseInt(tmpPty) || 0) + (parseInt(tmpWil) || 0)) / 3) + .99) || 0;
		if ((tmpClassMods ?? []).includes("+5% Fortune")) {
			tmpFortune = tmpFortune + 5;
		}
		tmpFortune = tmpFortune + (tmpNonClassed ? 0 : 1);  // first title
		tmpFortune = tmpFortune + (parseInt(tmpRaceMod) || 0);
		return tmpFortune;
	}

	// @MARKER FORTUNE CHECK
	// This is the function which says whether the Fortune roll for starting money was made.
	//
	// His line is "if (tempfort <= getDieRoll(100))" -- made when the d100 comes up AT OR ABOVE the
	// character's Fortune. Every other percentile roll in his sheet is made AT OR UNDER the chance, and
	// as written a character with Fortune 10 multiplies their money nine times in ten while one with
	// Fortune 90 manages it once, and "+5% Fortune" makes the roll harder. UPSTREAM-ISSUES.md item 40,
	// still open with him.
	//
	// The user's ruling of 2026-09-23 is that it is a slip: at or under, like the rest. Both readings
	// are written out, so that if he answers the other way it is this one line and nothing else.
	export function checkStartingFortune(tmpFortune, tmpPercent) {
		var tmpChance = parseInt(tmpFortune) || 0;
		var tmpRoll = parseInt(tmpPercent) || 0;
		// return tmpChance <= tmpRoll;     // his line as written: made on a roll AT OR ABOVE Fortune
		return tmpRoll <= tmpChance;        // every other percentile roll: made AT OR UNDER (the ruling)
	}

	// @MARKER ROLL STARTING MONEY
	// This is the function which rolls a new character's starting money.
	//
	//   tmpSocial   the character's final Social Class
	//   tmpFortune  the Fortune to roll against (getStartingFortune)
	//   tmpRoll     the dice, tmpRoll(sides) -> 1..sides
	//
	// Returns the four coins -- only one of them is ever more than nothing, as in his code -- and
	// everything the roll did, so the generator can say what happened rather than only the total.
	export function rollStartingMoney(tmpSocial, tmpFortune, tmpRoll) {
		var tmpOut = {
			copper: 0, silver: 0, gold: 0, platinum: 0,
			socialClass: 0, realSocialClass: parseInt(tmpSocial) || 0, apparent: false, noble: false,
			fortune: parseInt(tmpFortune) || 0, fortuneRoll: 0, madeFortune: false,
			multiplierRoll: 0, multiplier: 1,
			dice: "", rolled: 0, coin: "", amount: 0,
			issues: []
		};

		// 1 -- "these beings have an apparent social class in the mortal realms"
		var tmpApparent = getApparentSocialClass(tmpSocial, tmpRoll);
		tmpOut.socialClass = tmpApparent.social;
		tmpOut.apparent = tmpApparent.apparent;
		tmpOut.noble = tmpOut.socialClass >= NOBLE_SOCIAL_CLASS;

		var tmpRow = STARTING_MONEY[tmpOut.socialClass];
		if (!tmpRow) {
			// Cannot happen from a real die -- the apparent class is 5d4, and 5 to 20 is the whole
			// table -- but a class that somehow falls outside says so rather than handing out nothing
			// in silence.
			tmpOut.issues.push(`No starting money is listed for social class ${tmpOut.socialClass}.`);
			return tmpOut;
		}

		// 2 and 3 -- the Fortune roll, and on a success the multiplier. Nobles make neither.
		if (!tmpOut.noble) {
			tmpOut.fortuneRoll = tmpRoll(100);
			tmpOut.madeFortune = checkStartingFortune(tmpOut.fortune, tmpOut.fortuneRoll);
			if (tmpOut.madeFortune) {
				tmpOut.multiplierRoll = tmpRoll(100);
				tmpOut.multiplier = getMoneyMultiplier(tmpOut.multiplierRoll);
			}
		}

		// 4 -- the coins. His getDiceRollMod(2, 4, 2) is 2d4 with 2 added to the total.
		tmpOut.dice = tmpRow.dice + (tmpRow.add ? "+" + tmpRow.add : "") + (tmpRow.times > 1 ? " x" + tmpRow.times : "");
		tmpOut.rolled = rollDicePool(tmpRow.dice, tmpRoll) + tmpRow.add;
		tmpOut.coin = tmpRow.coin;
		tmpOut.amount = tmpOut.rolled * tmpRow.times * tmpOut.multiplier;
		tmpOut[tmpRow.coin] = tmpOut.amount;
		return tmpOut;
	}

	// @MARKER DESCRIBE STARTING MONEY
	// This is the function which says in one line what a starting-money roll did, for the generator's
	// Equipment step and for the chat card -- the same words in both, so the two never disagree.
	export function describeStartingMoney(tmpMoney) {
		if (!tmpMoney) { return ""; }
		if (tmpMoney.issues?.length) { return tmpMoney.issues.join(" "); }
		var tmpAbbrev = COIN_ABBREVIATIONS[tmpMoney.coin] ?? tmpMoney.coin;
		var tmpParts = [];
		if (tmpMoney.apparent) {
			tmpParts.push(`Social class ${tmpMoney.realSocialClass} has no standing in the mortal realms, `
				+ `so an apparent class was rolled: ${tmpMoney.socialClass}`);
		}
		tmpParts.push(`Social class ${tmpMoney.socialClass}: ${tmpMoney.dice} ${tmpAbbrev}, rolled ${tmpMoney.rolled}`);
		if (tmpMoney.noble) {
			tmpParts.push("a Noble makes no Fortune roll");
		} else if (tmpMoney.madeFortune) {
			tmpParts.push(`Fortune ${tmpMoney.fortune}, rolled ${tmpMoney.fortuneRoll}: made, `
				+ `and ${tmpMoney.multiplierRoll} on the multiplier gives x${tmpMoney.multiplier}`);
		} else {
			tmpParts.push(`Fortune ${tmpMoney.fortune}, rolled ${tmpMoney.fortuneRoll}: missed`);
		}
		return tmpParts.join(" — ") + `. Starts with ${tmpMoney.amount} ${tmpAbbrev}.`;
	}

	// @MARKER ROLL ON THE SHEET
	// This is the function which says whether a character sheet may offer "Roll starting money".
	//
	// For a character the generator never made: one made before 0.19.0, when nothing rolled money, or
	// made blank with Foundry's own Create Actor button. His sheet does its whole creation on the sheet
	// itself, money included, so a player expects the sheet to do it. Reported 2026-09-23 on 0.19.1.
	//
	// Only while the purse is EMPTY -- no coins, gems or jewelry -- since the roll is starting money and
	// not income. A player may roll only once: the roll leaves its record on the actor
	// (flags.imagine-rpg.startingMoney, which the generator writes too), and after that the button is
	// gone for them, for the same reason the generator has no re-roll button. A Game Master may roll
	// for any empty purse, record or not, which is how a mistaken roll is put right.
	export function canRollStartingMoney(tmpWealth, tmpRecord, tmpIsGM) {
		var tmpEmpty = !(parseInt(tmpWealth?.copper) || parseInt(tmpWealth?.silver) || parseInt(tmpWealth?.gold)
			|| parseInt(tmpWealth?.platinum) || ("" + (tmpWealth?.gems ?? "")).trim() || ("" + (tmpWealth?.jewelry ?? "")).trim());
		if (!tmpEmpty) { return false; }
		return !!tmpIsGM || !tmpRecord;
	}

	// This is the function which works out the starting money inputs for a character that already
	// exists: its final Social Class, and the Fortune it had the day it was made (getStartingFortune --
	// first title only, whatever title it has reached since, as the roll is for the day it started).
	export function getCharacterMoneyInputs(tmpSystem, tmpClassSystems) {
		var tmpAttrs = tmpSystem?.attributes ?? {};
		var tmpClassMods = (tmpClassSystems ?? []).flatMap(tmpClass => tmpClass?.classMods ?? []);
		var tmpNonClassed = (tmpClassSystems ?? []).some(tmpClass => tmpClass?.nonClassed);
		return {
			social: parseInt(tmpAttrs.soc?.value) || 0,
			fortune: getStartingFortune(tmpAttrs.aur?.value, tmpAttrs.pty?.value, tmpAttrs.wil?.value,
				tmpSystem?.characteristics?.fortune?.raceMod, tmpClassMods, tmpNonClassed)
		};
	}

	// @MARKER GEAR INSTEAD OF COINS
	// The races his setMoneyEquipmentByRace (sheet-worker.js:73467) sends to wilderness gear rather
	// than to setCoins. On this port Gear by culture stays off unless ticked (DECISIONS 2026-09-20), so
	// these only earn a hint on the Equipment step. His race names: a split form reads its sourceRace.
	export const GEAR_INSTEAD_OF_COINS_RACES = [
		// race                     his case line
		"Chetahl",                  // 73511
		"Dwarf(Mountain)",          // 73538
		"Gnome",                    // 73607
		"Goblin(Forest)",           // 73611
		"Goblin(Mountain)",         // 73614
		"Goblin(Mountain:Magic)",   // 73615
		"Human(Barbaric)",          // 73639
		"Ogre",                     // 73722
		"Ogre(Magic)",              // 73723
		"Saurian",                  // 73745
		"Troll",                    // 73779
		"Troll(Ice)",               // 73782
		"Troll(Rock)"               // 73785
	];

	// The races his same function gives tmp_special_coins, and the sentence he gives them.
	export const FAIRY_COIN_RACES = [
		// race        his case line
		"Brownie",     // 73498
		"Fairy",       // 73580
		"Fairy(Dark)", // 73584
		"Gnome",       // 73607
		"Nixie",       // 73715
		"Podling",     // 73729
		"Sporeling"    // 73757
	];
	export const FAIRY_COIN_NOTE = "Due to their small size, this race uses fairy-sized `coins` that are small gem wafers of the same value as standard coins.";

// @MARKER ADD NEW starting-money functions HERE
// @END (CODE)
