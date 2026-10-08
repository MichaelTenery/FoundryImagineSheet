// @START (CODE)
// @MARKER BRAWLING RULES
//==================================================================================================================
// Brawling: a fist, a boot, a chair, a bottle -- "if the character is bereft of a weapon, he is
// likely to grab the nearest object or just start wailing away with fists" (Player's Guide p.187,
// the Brawling Weapons Table) -- and the two twists of a weapon left in a wound (p.189, "Twisting/
// Pushing a Weapon in an Opponent", and the Force skill's use of it).
//
// Ported from his BRAWLER block: getBrawlingValues (sheet-worker.js:100881, the table),
// handleBrawlingAttackChange (69097, the speed), and handleBrawling (69670, the roll). Nothing here
// rolls a die or talks to Foundry; the dice arrive as arguments and the window and the roll are in
// module/apps/brawling.mjs and module/combat/brawling-attack.mjs.
//
// THREE KINDS OF ROW, which his roll treats differently:
//   - a TWIST ("Weapon Twist", "Force Twist" and their Small and Proj./Knife sizes): no roll to hit
//     at all -- the weapon is already in the wound -- and the damage goes straight to that body
//     area, bypassing armour. A Force Twist first rolls the Force skill; failed, it is an ordinary
//     Weapon Twist of the same size.
//   - HAND TO HAND (a fist, foot, elbow, knee, headbutt, and their mailed kinds): read down the
//     attack chart like a weapon, and the only rows his code lets worn magic and spikes add to.
//   - everything else, the IMPROVISED weapons: read down the chart like a weapon.
//
// One thing is NOT ported, and said so rather than silently dropped: his handToHand branch reads the
// worn armour and clothing for "[Spiked]" (1d6+1 more), "[Disruption]", "[Piercing]", "[Foe Strike]",
// an energy, Holy Touch, Unholy Touch and Bane (getExtraMagicalDamage, getSpecialMagic, 67117 and
// 67237). The port has customized WEAPONS (weapon-custom-rules.mjs) but no customized armour yet,
// so there is nothing on a worn gauntlet to read. The card says a mailed fist is a mailed fist.
//==================================================================================================================

import { getToHitModifiers, resolveCriticalFumble, combineDamageMultipliers, getNumberOfDice,
         getWeaponSpeed } from "./combat-rules.mjs";

// @MARKER THE TABLE
// From getBrawlingValues (sheet-worker.js:100881-100933), his own order, which is the Player's
// Guide's alphabetical table with the six twists put first. The book writes "1-3" where he writes
// "1d3" and "1 point" where he writes "1"; his spellings are kept, since they are what Roll reads.
// Every figure was read against the book's table on p.187-188 when this was written: all agree.
//
//      Name                            Type           Speed  Min   Damage
export const BRAWLING_WEAPONS = [
	[ "Weapon Twist",                 "Thrust/Cut",   3,     3,   "3d6"   ],
	[ "Weapon Twist(Small)",          "Thrust/Cut",   3,     3,   "2d8"   ],
	[ "Weapon Twist(Proj./Knife)",    "Thrust/Cut",   3,     3,   "3d4"   ],
	[ "Force Twist",                  "Thrust/Cut",   5,     5,   "9d6"   ],
	[ "Force Twist(Small)",           "Thrust/Cut",   5,     5,   "6d8"   ],
	[ "Force Twist(Proj./Knife)",     "Thrust/Cut",   5,     5,   "9d4"   ],
	[ "Belaying Pin",                 "Smash",        4,     2,   "1d6"   ],
	[ "Bench",                        "Smash",        7,     5,   "3d4"   ],
	[ "Bottle",                       "Smash",        4,     2,   "1d6"   ],
	[ "Brass Knuckles",               "Smash",        2,     1,   "1d3+1" ],
	[ "Broken Bottle",                "Cut",          4,     2,   "1d8"   ],
	[ "Broken Mug",                   "Cut",          3,     2,   "1d4+1" ],
	[ "Broken Pitcher",               "Cut",          4,     3,   "1d8+1" ],
	[ "Chair",                        "Smash",        8,     4,   "2d4"   ],
	[ "Cleaver",                      "Cut",          4,     2,   "2d8"   ],
	[ "Eating Utensil",               "Cut",          3,     2,   "1"     ],
	[ "Elbow",                        "Smash",        3,     2,   "1d2"   ],
	[ "Empty Keg",                    "Smash",        6,     3,   "2d4"   ],
	[ "Fire Poker",                   "Smash/Thrust", 5,     3,   "2d4+1" ],
	[ "Fist(Punch)",                  "Smash",        2,     1,   "1"     ],
	[ "Foot(Kick)",                   "Smash",        4,     2,   "1d3"   ],
	[ "Full Keg",                     "Smash",        9,     5,   "4d4"   ],
	[ "Grappling Hook",               "Smash",        6,     4,   "2d6"   ],
	[ "Headbutt",                     "Smash",        5,     4,   "1d4+1" ],
	[ "Headbutt(Helm)",               "Smash",        5,     4,   "1d6+1" ],
	[ "Hoe",                          "Cut",          5,     4,   "2d6+1" ],
	[ "Kettle",                       "Smash",        8,     4,   "2d4"   ],
	[ "Knitting Needle",              "Thrust",       3,     1,   "1d2"   ],
	[ "Knee",                         "Smash",        3,     2,   "1d2"   ],
	[ "Large Rock",                   "Smash",        5,     3,   "1d8"   ],
	[ "Mailed Elbow",                 "Smash",        2,     1,   "1d3+1" ],
	[ "Mailed Fist",                  "Smash",        3,     1,   "1d3+1" ],
	[ "Mailed Foot",                  "Smash",        4,     3,   "2d4"   ],
	[ "Mailed Knee",                  "Smash",        3,     2,   "1d4+1" ],
	[ "Mug",                          "Smash",        3,     2,   "1d4"   ],
	[ "Pitcher",                      "Smash",        4,     3,   "1d6+1" ],
	[ "Pitchfork",                    "Thrust",       6,     3,   "3d4"   ],
	[ "Platter",                      "Smash",        4,     3,   "1d4"   ],
	[ "Rock",                         "Smash",        4,     2,   "1d4+1" ],
	[ "Rolling Pin",                  "Smash",        4,     3,   "2d6+1" ],
	[ "Sap",                          "Smash",        3,     1,   "2d4+2" ],
	[ "Shield Bash(metal)",           "Smash",        5,     4,   "2d6"   ],
	[ "Shield Bash(wood)",            "Smash",        3,     2,   "1d4"   ],
	[ "Shovel",                       "Smash",        5,     3,   "4d4"   ],
	[ "Skewer/Shiv/Ice Pick",         "Thrust",       3,     1,   "1d3"   ],
	[ "Skillet",                      "Smash",        6,     4,   "3d4"   ],
	[ "Small Rock",                   "Smash",        3,     2,   "1d2"   ],
	[ "Small Table",                  "Smash",        10,    6,   "3d4"   ],
	[ "Table Leg",                    "Smash",        4,     2,   "2d4"   ],
	[ "Thick Branch",                 "Smash",        6,     4,   "2d4"   ]
];

// The rows his handleBrawling tests by name (69806): the hand-to-hand attacks, which are the only
// ones worn magic and spikes would add to.
export const HAND_TO_HAND_NAMES = ["Elbow", "Fist(Punch)", "Foot(Kick)", "Headbutt", "Headbutt(Helm)", "Knee",
                                   "Mailed Elbow", "Mailed Fist", "Mailed Foot", "Mailed Knee"];

// The twists, and which Weapon Twist a failed Force Twist falls back to (69740-69829). His fallback
// is written out as three dice strings; they are the Weapon Twist rows' own, which is what this
// reads -- see UPSTREAM-ISSUES.md 120 for the slip in his second branch.
export const WEAPON_TWIST_NAMES = ["Weapon Twist", "Weapon Twist(Small)", "Weapon Twist(Proj./Knife)"];
export const FORCE_TWIST_NAMES  = ["Force Twist", "Force Twist(Small)", "Force Twist(Proj./Knife)"];
const FORCE_TWIST_FALLBACK = {
	"Force Twist":              "Weapon Twist",
	"Force Twist(Small)":       "Weapon Twist(Small)",
	"Force Twist(Proj./Knife)": "Weapon Twist(Proj./Knife)"
};

// His "Smash", "Cut", "Thrust" and the two slashed kinds, as the damage pipeline's types. A slashed
// kind ("Thrust/Cut", "Smash/Thrust") is the table's to settle; the first word is offered.
const TYPE_DAMAGE = { Smash: "Smashing", Cut: "Cutting", Thrust: "Piercing" };

	// This is the function which reads one row of the table by name, or null for a name not on it.
	//
	//   { name, type, speed, minSpeed, damage, damageType, kind }
	//   kind is "twist", "hand" or "improvised" -- see the head of this file.
	export function getBrawlingValues(tmpname) {
		var tmprow = BRAWLING_WEAPONS.find(tmpentry => tmpentry[0] == ("" + (tmpname ?? "")));
		if (!tmprow) { return null; }
		var tmpkind = isTwist(tmprow[0]) ? "twist" : isHandToHand(tmprow[0]) ? "hand" : "improvised";
		return { name: tmprow[0], type: tmprow[1], speed: tmprow[2], minSpeed: tmprow[3], damage: tmprow[4],
		         damageType: getBrawlingDamageType(tmprow[1]), kind: tmpkind };
	}

	// This is the function which says whether a row is one of his hand-to-hand attacks.
	export function isHandToHand(tmpname) {
		return HAND_TO_HAND_NAMES.includes("" + (tmpname ?? ""));
	}

	// This is the function which says whether a row is a twist of either kind: no roll to hit, the
	// damage straight to the area the weapon is set in.
	export function isTwist(tmpname) {
		return isWeaponTwist(tmpname) || isForceTwist(tmpname);
	}

	export function isWeaponTwist(tmpname) {
		return WEAPON_TWIST_NAMES.includes("" + (tmpname ?? ""));
	}

	export function isForceTwist(tmpname) {
		return FORCE_TWIST_NAMES.includes("" + (tmpname ?? ""));
	}

	// This is the function which gives the damage pipeline's type for a row's Type column: the
	// first word of a slashed kind, since the card offers it and the damage dialog lets it be changed.
	export function getBrawlingDamageType(tmptype) {
		var tmpfirst = ("" + (tmptype ?? "")).split("/")[0].trim();
		return TYPE_DAMAGE[tmpfirst] ?? "Smashing";
	}

// @MARKER SPEED
	// This is the function which gives a brawling attack's seconds, as handleBrawlingAttackChange
	// does (69112-69126): the row's speed plus the character's weapon speed modifier (Strength,
	// Agility, armour -- and the stance held, which the character model folds in), never under the
	// row's minimum. getWeaponSpeed is that rule for a weapon, so it is the same function.
	export function getBrawlingSpeed(tmpname, tmpweaponspeedmod) {
		var tmprow = getBrawlingValues(tmpname);
		if (!tmprow) { return 0; }
		return getWeaponSpeed(tmprow.speed, tmprow.minSpeed, tmpweaponspeedmod);
	}

// @MARKER TO HIT
	// This is the function which gathers a brawling attack's modifiers to hit, in the { label,
	// value } shape every attack card lists them in. His handleBrawling sums (69711-69716):
	//
	//     combat_mod_melee_str           STR            -> attacker.meleeAttack
	//     combat_mod_melee_other         Melee Other    -> attacker.meleeMisc
	//     situational_mod_melee          Situational    -> situation (already cut to melee)
	//     martial_arts_mod_melee         Martial Moves  -> martial (getMartialAttackModifiers' list)
	//     martial_stance_mod_melee       Stance         -> martial, the same list
	//     ?{Modifier}                    Modifier       -> situational
	//
	// and nothing else: no weapon mode, no magical plus, no lore, no off hand, since there is no
	// weapon. The target's defence is added as every other attack adds it (getToHitModifiers), which
	// his one-character sheet could not. Each figure is summed ONCE -- his lines read
	// `toHitMod=toHitMod+parseInt(x)||0`, which zeroes the running total whenever a field is "-"
	// (UPSTREAM-ISSUES.md 11); the sum is what he meant.
	//
	//   tmpinput = { attacker: { meleeAttack, meleeMisc }, target: { defensiveAdjust } | null,
	//                situation, situational, martial: [{ label, value }] }
	export function getBrawlingToHitModifiers(tmpinput) {
		var tmpmods = getToHitModifiers({
			mode: "smash",
			weapon: {},
			attacker: { meleeAttack: tmpinput?.attacker?.meleeAttack, meleeMisc: tmpinput?.attacker?.meleeMisc },
			target: tmpinput?.target ?? null,
			situation: tmpinput?.situation,
			situational: tmpinput?.situational
		});
		for (const tmpentry of tmpinput?.martial ?? []) {
			tmpmods.list.push(tmpentry);
			tmpmods.total = tmpmods.total + (parseInt(tmpentry.value) || 0);
		}
		return tmpmods;
	}

// @MARKER A FORCE TWIST
	// This is the function which settles a Force Twist's skill roll: the d100 against the Force
	// skill's chance, "skillRoll<=tempValue" (69735) and nothing more -- no critical, no made by
	// half. Returns which row's damage is rolled: the Force row's on a success, the Weapon Twist
	// of the same size on a failure ("failing and reducing it to a normal Weapon Twist", 69941).
	//
	//   tmpchance  the Force skill's total chance; null when the skill is not held at all, which
	//              his roll treats as 0% -- the twist still happens, as a Weapon Twist
	export function resolveForceTwist(tmpname, tmpchance, tmpskillroll) {
		var tmpvalue = parseInt(tmpchance) || 0;
		var tmpmade = (parseInt(tmpskillroll) || 0) <= tmpvalue && tmpvalue > 0;
		var tmprolled = tmpmade ? ("" + tmpname) : (FORCE_TWIST_FALLBACK[tmpname] ?? ("" + tmpname));
		return { made: tmpmade, chance: tmpvalue, roll: parseInt(tmpskillroll) || 0,
		         damageRow: getBrawlingValues(tmprolled), heldSkill: tmpchance !== null && tmpchance !== undefined };
	}

// @MARKER A FUMBLE
	// This is the function which works out a brawling fumble -- his handleBrawling (69770-69782),
	// which is the weapon fumble with one branch of its own: there is no weapon to throw, so the
	// ordinary (80 or under) failure is "fall prone and lose 1d6+1 seconds standing". A critical
	// reads his melee table through resolveCriticalFumble, as every other fumble does.
	//
	//   tmpdice = { saveRoll: d100, recoveryRoll: d4, severityRoll: d100, standRoll: d6,
	//               and resolveCriticalFumble's: criticalRoll, variantRoll, throwRoll, directionRoll, stunRoll }
	export function resolveBrawlingFumble(tmpaglsave, tmpdice) {
		if ((parseInt(tmpdice.saveRoll) || 0) <= (parseInt(tmpaglsave) || 0)) {
			var tmprecovery = (parseInt(tmpdice.recoveryRoll) || 0) + 1;
			return { saved: true, critical: false, secondsLost: tmprecovery,
			         text: `Agility save made: recovers, losing ${tmprecovery} seconds.` };
		}
		if ((parseInt(tmpdice.severityRoll) || 0) <= 80) {
			var tmpstand = (parseInt(tmpdice.standRoll) || 0) + 1;
			return { saved: false, critical: false, secondsLost: tmpstand,
			         text: `Agility save failed: falls prone and loses ${tmpstand} seconds standing.` };
		}
		var tmpcritical = resolveCriticalFumble(false, tmpdice);
		return { saved: false, critical: true, secondsLost: tmpcritical.secondsLost,
		         target: tmpcritical.target, damageMultiplier: tmpcritical.damageMultiplier,
		         bypassesArmor: tmpcritical.bypassesArmor,
		         // There is no weapon to lose; his table's "loses the weapon" bands still read, as his
		         // code reads them, but nothing is dropped on the map for a fist.
		         weaponLost: false, weaponBroken: false, direction: "", thrownFeet: 0,
		         text: `Agility save failed: CRITICAL fumble -- ${tmpcritical.text}.` };
	}

// @MARKER DAMAGE
	// This is the function which works out a brawling attack's damage from the dice already
	// rolled, in his order (69815-69880, then the multiples):
	//
	//   1. the dice (a martial stance's extra die already in them), plus every flat modifier --
	//      his totalDamMod: combat_mod_damage (Strength and body weight), situational, martial
	//      arts, martial lore and stance -- plus anything per die rolled
	//   2. multiplied: the Situation Mods' own and the martial one, his additive combining, never
	//      past x3 (combineDamageMultipliers)
	//   3. HALVED for a called shot, as the weapon path and the Player's Guide have it -- his brawling
	//      path reads the called shot and never halves for it, the same gap UPSTREAM 15 records for
	//      creatures, and it is closed the same way here
	//
	//   tmpinput = { rolled, dice, strength, weight, misc, flat, perDie, multipliers: [], halve }
	export function resolveBrawlingDamage(tmpinput) {
		var tmpdice = getNumberOfDice(tmpinput?.dice);
		var tmpperdie = (parseInt(tmpinput?.perDie) || 0) * tmpdice;
		var tmpbase = (parseInt(tmpinput?.rolled) || 0) + (parseInt(tmpinput?.strength) || 0)
		            + (parseInt(tmpinput?.weight) || 0) + (parseInt(tmpinput?.misc) || 0)
		            + (parseInt(tmpinput?.flat) || 0) + tmpperdie;
		if (tmpbase < 0) { tmpbase = 0; }
		var tmpmultiplier = combineDamageMultipliers(tmpinput?.multipliers ?? []);
		var tmptotal = tmpbase * tmpmultiplier;
		var tmphalved = !!tmpinput?.halve;
		// His halving, where he halves: parseInt((damage*0.5)+0.9), a half rounded up.
		if (tmphalved) { tmptotal = parseInt((tmptotal * 0.5) + 0.9) || 0; }
		return { base: tmpbase, perDie: tmpperdie, multiplier: tmpmultiplier, halved: tmphalved,
		         total: parseInt(tmptotal) || 0 };
	}

	// This is the function which says whether a damage string is dice at all. "1" (a fist, an
	// eating utensil) is a flat point: his "if (!(damString=="1"))" branch rolls nothing and gives
	// 1 (69847-69858), and a stance's extra die is never added to it (addMartialDice keeps that).
	export function isFlatDamage(tmpdice) {
		return !/\d*d\d+/i.test("" + (tmpdice ?? ""));
	}

// @MARKER ADD NEW brawling rule functions HERE
// @END (CODE)
