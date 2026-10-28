// @START (CODE)
// @MARKER GRAPPLING RULES
//==================================================================================================================
// Grappling: his GRAPPLING row -- a dropdown of fifteen moves, ROLL and MOD, and the boxes Speed, Min,
// Mod and Damage -- "Any weapon 18 inches (1.5 feet) in length or less can be used in a grapple."
//
// Ported from getGrapplingValues (sheet-worker.js:100851, the table), handleGrappleMoveChange (69055,
// the speed), handleTouchAttack (67731, the touch) and handleGrappling (69156, the roll, move by
// move). Nothing here rolls a die or talks to Foundry: the d20 and the d100 arrive as arguments, and
// the damage dice by a function the caller gives (rollDice), so the arithmetic is tested outside
// Foundry. The window is module/apps/grappling.mjs; the roll and the card are
// module/combat/grappling-attack.mjs.
//
// THE FOUR KINDS OF MOVE, as his handler splits them:
//   - TOUCH-BASED (Touch, Claw, Bite, Knee/Elbow, Punch, Grapple, Strangle, Tackle): a d20 plus the
//     typed modifier and the attacker's missile AGL modifier, 10 or better to make contact (a natural
//     1 always misses). Grapple, Strangle and Tackle then roll the d100 against the attacker's STR Save
//     as well; Claw, Bite, Knee/Elbow and Punch roll their damage on contact.
//   - CALLED-SHOT (Ear Rip, Eye Gouge): the d20 plus the modifier must reach the attack chart's called
//     shot number; no touch roll, no save.
//   - AGL SAVE (Escape, Hold, Pin): a d100, less the modifier, at or under the attacker's AGL Save.
//   - STR SAVE (Throw, Slam): a d100, PLUS the modifier, at or under the STR Save, and the margin
//     decides the damage: 1d4 (Slam: twice 1d4) for every 10% it was made by, at least one.
//
// THREE THINGS NOT PORTED, and said so rather than silently dropped:
//   - his handler reads the worn armour and clothing for "[Spiked]" (a 1d6+1 spike on Grapple, Punch
//     and Knee/Elbow), and for the special and extra magical damage of worn pieces
//     (getSpecialMagic, getExtraMagicalDamage). The port has customized WEAPONS but no customized
//     armour yet, so there is nothing on a worn piece to read -- the same gap brawling-rules.mjs notes.
//   - his Claw and Bite add the per-die damage twice (69295 area: tmpDam = tmpDam+damMods+
//     modExtraDamPerDie after damMods already took it). Read as a slip: it is added once, as on every
//     other move.
//   - his empty-move case falls into Touch (a missing break). The window does not roll with nothing chosen.
//
// ONE ODDITY KEPT AS HE WROTE IT: the modifier HELPS on a touch, a called shot, Escape, Hold and Pin
// (added to the d20, or taken off the d100) but HURTS on Throw and Slam, where it is added to the d100
// (69595, 69625). The card prints "+mod" in each case so what was done is visible. Reported to him.
//==================================================================================================================

import { getWeaponSpeed } from "./combat-rules.mjs";

// @MARKER THE TABLE
// From getGrapplingValues (sheet-worker.js:100851-100868), his order and his spellings -- "1d4 per 10%"
// is what his box shows, not a roll. The book's grappling rules are Player's Guide p.188.
//
//      Name           Speed  Min   Mod    Damage              Notes
export const GRAPPLING_MOVES = [
	[ "Touch",       1,     1,   "AGL", "0",                "Success=attacker has made contact with the opponent." ],
	[ "Grapple",     2,     2,   "0",   "0",                "If successful touch, attacker STR Save vs opponent's AGL Save. Win=grapple." ],
	[ "Strangle",    3,     3,   "-10", "2d4",              "If successful touch while grapple, attacker STR Save vs opponent's STR Save. win=damage at the end of each 10 second round. Rigid armor blocks this attack." ],
	[ "Claw",        3,     2,   "0",   "1d2",              "If successful touch while grapple. Some races will have higher claw damage." ],
	[ "Bite",        4,     3,   "0",   "1d2",              "If successful touch while grapple. Some races will have higher bite damage." ],
	[ "Escape",      3,     3,   "0",   "0",                "While grapple, escaper's AGL Save vs opponent's AGL Save. Win=escape." ],
	[ "Ear Rip",     3,     3,   "0",   "1d6",              "If successful Called Shot while grapple. Damage to ear/antenna." ],
	[ "Eye Gouge",   3,     3,   "0",   "1d4",              "If successful Called Shot while grapple. Damage to eye." ],
	[ "Hold",        3,     3,   "10",  "0",                "While grapple, attacker's AGL Save vs opponent's AGL or STR Save. Win=held (no opponent attacks), Loss=still grapple." ],
	[ "Knee/Elbow",  3,     2,   "0",   "1d2",              "If successful touch while grapple." ],
	[ "Pin",         5,     5,   "0",   "0",                "While grapple, attacker's AGL Save vs opponent's STR Save. Win=pinned(no opponent attacks/escape is 1/2 chance), Loss=still grapple." ],
	[ "Punch",       2,     1,   "0",   "1",                "If successful touch while grapple." ],
	[ "Tackle",      3,     3,   "0",   "0",                "If successful touch, attacker STR Save vs opponent's AGL Save. Win=grapple and both attacker and opponent prone." ],
	[ "Throw",       5,     5,   "0",   "1d4 per 10%",      "While grapple, attacker's STR Save vs opponent's AGL or STR Save. Win=thrown 1' and does 1d4 per 10% difference in Saves." ],
	[ "Slam",        5,     5,   "0",   "1d4 x2 per 10%",   "While grapple, force skill roll,attacker's STR Save vs opponent's AGL or STR Save. Win=thrown 1' and does 1d4x2 per 10% difference in Saves." ]
];

// The two moves a character with "All manipulator limbs lost" may still make (69058).
export const NO_HANDS_MOVES = [ "Touch", "Escape" ];

// This is the function which gives one row of the table as an object, or null for a name that is not on it.
export function getGrapplingValues(tmpname) {
	var tmprow = GRAPPLING_MOVES.find(tmpentry => tmpentry[0] == tmpname);
	if (!tmprow) { return null; }
	return { name: tmprow[0], speed: tmprow[1], minSpeed: tmprow[2], mod: tmprow[3], damage: tmprow[4], note: tmprow[5] };
}

// @MARKER SPEED
// His handleGrappleMoveChange (69082-69086): the row's speed plus the character's weapon speed modifier
// (the stance held is already folded into it), never under the row's minimum.
export function getGrapplingSpeed(tmpname, tmpweaponspeedmod) {
	var tmprow = getGrapplingValues(tmpname);
	if (!tmprow) { return 0; }
	return getWeaponSpeed(tmprow.speed, tmprow.minSpeed, tmpweaponspeedmod);
}

// This is the function which says whether a move may be made at all: a character who has lost every
// manipulator limb may only Touch or Escape.
export function canMakeMove(tmpname, tmpnohands) {
	if (!getGrapplingValues(tmpname)) { return false; }
	if (tmpnohands) { return NO_HANDS_MOVES.includes(tmpname); }
	return true;
}

// @MARKER THE TOUCH
// His handleTouchAttack (67731): the d20 with its modifier, 1 always a miss (tested on the total with the
// typed modifier, as his is), otherwise 10 or better once the missile AGL modifier is added.
export function isTouch(tmproll, tmpaglmod) {
	var tmptotal = (parseInt(tmproll) || 0) + (parseInt(tmpaglmod) || 0);
	if ((parseInt(tmproll) || 0) == 1) { return false; }
	return tmptotal > 9;
}

// @MARKER DAMAGE DICE
// His extra-dice handling, repeated in each move: whole dice added to the number rolled, then a flat
// amount per die (counted on the dice AFTER the extras, 69277). Returns the formula and the per-die
// total that joins the flat modifiers.
export function applyExtraDice(tmpdice, tmpextradice, tmpextraperdie) {
	var tmpmatch = ("" + (tmpdice ?? "")).match(/^(\d+)d(\d+)$/);
	var tmpextra = parseInt(tmpextradice) || 0;
	var tmpper = parseInt(tmpextraperdie) || 0;
	if (!tmpmatch || (!tmpextra && !tmpper)) { return { dice: "" + tmpdice, perDie: 0 }; }
	var tmpcount = Math.max(0, parseInt(tmpmatch[1]) + tmpextra);
	return { dice: `${tmpcount}d${tmpmatch[2]}`, perDie: tmpcount * tmpper };
}

// @MARKER THE ROLL
// This is the function which resolves one grapple move.
//
//   tmpin = {
//       move        the row chosen
//       d20, d100   the natural rolls
//       mod         the typed modifier, his ?{Modifier} (0 for his plain ROLL)
//       aglMod      the attacker's missile AGL modifier, added to the touch (combat_mod_missile_agl)
//       strSave     the attacker's STR Save, and agl: their AGL Save
//       aglSave
//       calledShot  the attack chart's called shot number (Ear Rip, Eye Gouge)
//       damMods     every flat damage modifier his sheet totalled (combat_mod_damage, situational,
//                   martial arts, lore and stance damage)
//       extraDice, extraPerDie   his tmp_extra_dice and tmp_extra_per_die
//       rollDice    function(formula) -> number: rolls damage dice
//   }
//
// Returns { move, success, touch, lines: [text], damage, ... } -- the card prints `lines`, and the
// numbers are there for the test. The sentences are his, tidied only where his own were broken.
export function resolveGrappleMove(tmpin) {
	var tmprow = getGrapplingValues(tmpin.move);
	if (!tmprow) { return null; }
	var tmpmove = tmprow.name;
	var tmpmod = parseInt(tmpin.mod) || 0;
	var tmpagl = parseInt(tmpin.aglMod) || 0;
	var tmpstrsave = parseInt(tmpin.strSave) || 0;
	var tmpaglsave = parseInt(tmpin.aglSave) || 0;
	var tmpd20 = parseInt(tmpin.d20) || 0;
	var tmpd100 = parseInt(tmpin.d100) || 0;
	var tmpdammods = parseInt(tmpin.damMods) || 0;
	var tmpcalled = parseInt(tmpin.calledShot) || 0;
	var tmproll = tmpin.rollDice;
	var tmpr = { move: tmpmove, success: false, touch: null, lines: [], damage: null, damageText: "", madeBy: 0, levels: 0 };

	// The damage of a move, rolled only when the move landed: dice with the extras, then flat.
	// A flat "1" takes no dice and no extras (his damString=="1" branch).
	var tmpdamage = (tmpdice, tmpdouble) => {
		var tmpflat = ("" + tmpdice) == "1";
		var tmpextras = tmpflat ? { dice: "1", perDie: 0 } : applyExtraDice(tmpdice, tmpin.extraDice, tmpin.extraPerDie);
		var tmpflatmods = tmpdammods + tmpextras.perDie;
		var tmprolled = tmpflat ? 1 : tmproll(tmpextras.dice);
		var tmptotal = tmprolled + tmpflatmods;
		tmpr.damage = tmpdouble ? tmptotal * 2 : tmptotal;
		tmpr.damageText = tmpdouble ? `(${tmpextras.dice}${tmpflatmods ? (tmpflatmods > 0 ? "+" : "") + tmpflatmods : ""})x2=${tmpr.damage}`
		                            : `${tmpextras.dice}${tmpflatmods ? (tmpflatmods > 0 ? "+" : "") + tmpflatmods : ""}=${tmpr.damage}`;
		tmpr.damageRolled = tmprolled;
		tmpr.damageDice = tmpextras.dice;
		return tmpr.damage;
	};

	var tmpsaid = `attempted grapple move ${tmpmove}.`;
	var tmptouchtotal = 0;
	var tmpdotouch = () => {
		// His total1 already carries the typed modifier; the AGL modifier is added for the 10-or-better.
		tmpr.natural = tmpd20;
		tmpr.rolled = tmpd20 + tmpmod;
		tmptouchtotal = tmpr.rolled + tmpagl;
		tmpr.touch = isTouch(tmpr.rolled, tmpagl);
		tmpr.total = tmptouchtotal;
		return `Rolled a ${tmptouchtotal}, needing a 10+ to contact.`;
	};

	switch (tmpmove) {
		case "Touch": {
			var tmptext = tmpdotouch();
			tmpr.success = tmpr.touch;
			tmpr.lines.push(`${tmpsaid} ${tmptext} Succeeded? = ${tmpr.touch}`);
			break;
		}
		case "Grapple":
		case "Tackle": {
			// Contact, then the attacker's STR Save. Grapple adds the margin to the opponent's AGL
			// Save, Tackle too and puts both on the ground.
			var tmptext2 = tmpdotouch();
			var tmpmade = tmpd100 <= tmpstrsave;
			tmpr.madeBy = tmpmade ? tmpstrsave - tmpd100 : 0;
			tmpr.success = tmpr.touch && tmpmade;
			var tmpverb = tmpmove == "Grapple" ? "to grapple" : "to tackle";
			if (!tmpr.touch) {
				tmpr.lines.push(`${tmpsaid} ${tmptext2} Succeeded? = ${tmpr.success}`);
			} else if (!tmpmade) {
				tmpr.lines.push(`${tmpsaid} ${tmptext2} Then rolled a ${tmpd100}% against a ${tmpstrsave}% STR Save ${tmpverb}. Succeeded? = ${tmpr.success}`);
			} else if (tmpmove == "Grapple") {
				tmpr.lines.push(`${tmpsaid} ${tmptext2} Then rolled a ${tmpd100}% against a ${tmpstrsave}% STR Save ${tmpverb}. Made by ${tmpr.madeBy}% to be added to the opponent's AGL Save. Succeeded? = ${tmpr.success}`);
			} else {
				tmpr.lines.push(`${tmpsaid} ${tmptext2} Then rolled a ${tmpd100}% against a ${tmpstrsave}% STR Save ${tmpverb}. Made by ${tmpr.madeBy}% to be added to the opponent's AGL Save. If the opponent fails both are in grapple and prone. Succeeded? = ${tmpr.success}`);
			}
			break;
		}
		case "Strangle": {
			// His own +10 on the d100 stands for the -10 in the Mod box: a harder STR Save.
			var tmptext3 = tmpdotouch();
			var tmpshifted = tmpd100 + 10;
			var tmpmade3 = tmpshifted <= tmpstrsave;
			tmpr.madeBy = tmpmade3 ? tmpstrsave - tmpd100 : 0;
			tmpr.success = tmpr.touch && tmpmade3;
			if (!tmpr.touch) {
				tmpr.lines.push(`${tmpsaid} ${tmptext3} Succeeded? = ${tmpr.success}`);
			} else if (!tmpmade3) {
				tmpr.lines.push(`${tmpsaid} ${tmptext3} Then rolled a ${tmpd100}+10=${tmpshifted}% against a ${tmpstrsave}% STR Save to choke opponent. Succeeded? = ${tmpr.success}`);
			} else {
				tmpdamage(tmprow.damage, false);
				tmpr.lines.push(`${tmpsaid} ${tmptext3} Then rolled a ${tmpd100}+10=${tmpshifted}% STR Save to choke opponent. Made by ${tmpr.madeBy}% to be added to the opponent's STR Save to avoid being choked for ${tmpr.damageText} at the end of each round (10 seconds). Succeeded? = ${tmpr.success}`);
			}
			break;
		}
		case "Claw":
		case "Bite":
		case "Knee/Elbow":
		case "Punch": {
			var tmptext4 = tmpdotouch();
			tmpr.success = tmpr.touch;
			if (!tmpr.touch) {
				tmpr.lines.push(`${tmpsaid} ${tmptext4} Succeeded? = ${tmpr.touch}`);
			} else {
				tmpdamage(tmprow.damage, false);
				tmpr.lines.push(`${tmpsaid} ${tmptext4} ${tmpmove} damage is ${tmpr.damageText}. Succeeded? = ${tmpr.touch}`);
			}
			break;
		}
		case "Ear Rip":
		case "Eye Gouge": {
			// No touch: the d20 with the typed modifier against the chart's called shot number.
			tmpr.natural = tmpd20;
			tmpr.rolled = tmpd20 + tmpmod;
			tmpr.total = tmpr.rolled;
			tmpr.success = tmpr.rolled >= tmpcalled;
			var tmpwhat = tmpmove == "Ear Rip" ? "rip the ear" : "strike an eye";
			var tmpwhere = tmpmove == "Ear Rip" ? "to ear" : "to an eye";
			if (!tmpr.success) {
				tmpr.lines.push(`${tmpsaid} Rolled a ${tmpr.rolled}, needing a ${tmpcalled} to ${tmpwhat}. Succeeded? = false`);
			} else {
				tmpdamage(tmprow.damage, false);
				tmpr.lines.push(`${tmpsaid} Rolled a ${tmpr.rolled}, needing a ${tmpcalled} to ${tmpwhat}. ${tmpmove} damage is ${tmpr.damageText} ${tmpwhere}. Succeeded? = true`);
			}
			break;
		}
		case "Escape":
		case "Hold":
		case "Pin": {
			// The d100 less the typed modifier (Hold: less its own 10 as well), at or under the AGL Save.
			var tmpshift = tmpmove == "Hold" ? 10 : 0;
			var tmpvalue = tmpd100 - tmpmod - tmpshift;
			tmpr.rolled = tmpvalue;
			tmpr.total = tmpvalue;
			var tmpmade5 = tmpvalue <= tmpaglsave;
			tmpr.madeBy = tmpmade5 ? tmpaglsave - tmpvalue : 0;
			tmpr.success = tmpmade5;
			var tmpverb5 = { Escape: "to escape opponent", Hold: "to hold opponent", Pin: "to pin opponent" }[tmpmove];
			var tmptail = {
				Escape: `Made by ${tmpr.madeBy}% to be added to the opponent's AGL Save to retain grapple/hold.`,
				Hold:   `Made by ${tmpr.madeBy}% to be added to the opponent's AGL or STR Save to avoid hold.`,
				Pin:    `Made by ${tmpr.madeBy}% to be added to the opponent's AGL Save to avoid pin. If they are pinned future escapes are at half chance.`
			}[tmpmove];
			tmpr.lines.push(`${tmpsaid} Rolled a ${tmpvalue}% against a ${tmpaglsave}% AGL Save ${tmpverb5}. ${tmpmade5 ? tmptail + " " : ""}Succeeded? = ${tmpmade5}`);
			break;
		}
		case "Throw":
		case "Slam": {
			// His modifier is ADDED to the d100 here (see the oddity in the header). The margin is
			// taken off the bare roll, one die of 1d4 for every 10% and at least one.
			var tmpvalue6 = tmpd100 + tmpmod;
			tmpr.rolled = tmpvalue6;
			tmpr.total = tmpvalue6;
			var tmpmade6 = tmpvalue6 <= tmpstrsave;
			tmpr.madeBy = tmpmade6 ? tmpstrsave - tmpd100 : 0;
			tmpr.levels = Math.max(1, parseInt(tmpr.madeBy / 10) || 1);
			tmpr.success = tmpmade6;
			if (!tmpmade6) {
				tmpr.lines.push(`${tmpsaid} Rolled a ${tmpvalue6}% against a ${tmpstrsave}% STR Save to throw. Succeeded? = false`);
			} else {
				tmpdamage(`${tmpr.levels}d4`, tmpmove == "Slam");
				tmpr.lines.push(`${tmpsaid} Rolled a ${tmpvalue6}% against a ${tmpstrsave}% STR Save to throw. Made by ${tmpr.madeBy}% to be added to the opponent's AGL or STR Save. If the opponent fails they are thrown ${tmpr.levels} feet and are prone. They take ${tmpr.damageText} to 1 random area. Succeeded? = true`);
			}
			break;
		}
	}
	return tmpr;
}

// @MARKER WHERE GRAPPLE DAMAGE LANDS
// His handler only ever SAYS where a move's damage goes -- "to 1 random area" (Throw, Slam, and the
// armour spike, sheet-worker.js:69233 and 69608), "to ear" (69462), "to an eye" (69501) -- because his
// sheet never applied damage at all; the table did, by hand. The port's cards apply damage through the
// same Apply Damage dialog as every other blow (applyAttackDamage, attack.mjs), so a landing has to be
// chosen, and this table chooses it. The Game Master can still move it on the target's figure.
//
// PORT RULINGS, not his code (DECISIONS 2026-10-27):
//   - "random" is one area of the target's own body chart, every area an equal chance. His sheet has
//     no random-location roll and the body charts carry no hit weights, so there is nothing finer
//     to follow. Claw, Bite, Knee/Elbow and Punch name no area in his text; in the clinch there is no
//     aim either, so they land at random too.
//   - Ear Rip goes to an area named for an ear or antenna if the chart has one, else the head; Eye
//     Gouge to an Eye area (one chart has it), else the head. Both are called shots made in the
//     clinch, which the dialog's own hint calls "a called shot that goes through a gap", so armour is
//     bypassed (the box starts ticked).
//   - Strangle goes to the neck and bypasses armour, since a choke is not a blow armour turns -- but
//     his note says "Rigid armor blocks this attack", so the card says so and the Game Master does not
//     apply it against rigid armour.
//   - the damage type is the nearest of the armour table's: a claw cuts, a bite and a gouge thrust,
//     a fist, knee, throw and slam smash, an ear is torn (cutting), a choke constricts.
//
//      Move           where      type             bypass
const GRAPPLE_LANDINGS = {
	"Claw":        [ "random", "Cutting",       false ],
	"Bite":        [ "random", "Thrusting",     false ],
	"Knee/Elbow":  [ "random", "Smashing",      false ],
	"Punch":       [ "random", "Smashing",      false ],
	"Throw":       [ "random", "Smashing",      false ],
	"Slam":        [ "random", "Smashing",      false ],
	"Ear Rip":     [ "ear",    "Cutting",       true  ],
	"Eye Gouge":   [ "eye",    "Thrusting",     true  ],
	"Strangle":    [ "neck",   "Constricting",  true  ]
};

// The area names each fixed landing looks for, first found wins. A name is matched whole, and then as
// the start of a numbered duplicate ("Head (2)", parseBodyChart's spelling).
const GRAPPLE_AREA_NAMES = {
	ear:  [ "Ear", "Left Ear", "Right Ear", "Antenna", "Antennae", "Head" ],
	eye:  [ "Eye", "Eyes", "Head" ],
	neck: [ "Neck" ]
};

// This is the function which says how a grapple move's damage is applied: the damage type, whether
// armour is bypassed, and where it lands on the target. A move that does no damage gives null.
//
//   tmpmove    the move's name
//   tmpareas   the target's body.areas ([{ name }]), or [] when no target is known yet
//   tmpdie     function(sides) -> 1..sides, for the random area; only called when one is needed
//
// Returns { type, bypass, how, area, text }:
//   how "random"   area is the one rolled ("" when there were no areas to roll among yet)
//   how "fixed"    area is the ear, eye or neck found ("" when the chart has none: ask on the figure)
export function getGrappleLanding(tmpmove, tmpareas, tmpdie) {
	var tmprow = GRAPPLE_LANDINGS[tmpmove];
	if (!tmprow) { return null; }
	var [ tmpwhere, tmptype, tmpbypass ] = tmprow;
	var tmplist = Array.isArray(tmpareas) ? tmpareas : [];
	var tmpr = { type: tmptype, bypass: tmpbypass, how: tmpwhere == "random" ? "random" : "fixed", area: "", text: "" };

	if (tmpwhere == "random") {
		if (!tmplist.length) {
			tmpr.text = "1 random area of the target's body, rolled when the damage is applied.";
			return tmpr;
		}
		var tmproll = parseInt(tmpdie?.(tmplist.length)) || 1;
		if (tmproll < 1) { tmproll = 1; }
		if (tmproll > tmplist.length) { tmproll = tmplist.length; }
		tmpr.area = tmplist[tmproll - 1].name;
		tmpr.text = `1 random area: rolled ${tmproll} of ${tmplist.length}, the ${tmpr.area}.`;
		return tmpr;
	}

	var tmpwanted = GRAPPLE_AREA_NAMES[tmpwhere];
	var tmpfound = null;
	for (const tmpname of tmpwanted) {
		tmpfound = tmplist.find(tmparea => tmparea.name == tmpname || tmparea.name.startsWith(tmpname + " ("));
		if (tmpfound) { break; }
	}
	var tmpword = { ear: "the ear", eye: "an eye", neck: "the neck" }[tmpwhere];
	if (tmpfound) {
		tmpr.area = tmpfound.name;
		tmpr.text = tmpfound.name == "Head" && tmpwhere != "neck"
			? `Damage to ${tmpword}: the Head, since this body has no area of its own for it.`
			: `Damage to ${tmpword}: the ${tmpfound.name}.`;
	} else {
		tmpr.text = tmplist.length
			? `Damage to ${tmpword}, which this body has no area for. Pick where it lands.`
			: `Damage to ${tmpword}.`;
	}
	if (tmpwhere == "neck") { tmpr.text += " Rigid armour blocks this attack."; }
	return tmpr;
}

// This is the function which words the chosen row for the Combat tab's bar -- "Grapple: 2s, mod 0".
export function describeGrapplingChoice(tmpselected, tmpweaponspeedmod) {
	var tmprow = getGrapplingValues(tmpselected);
	if (!tmprow) { return ""; }
	return `${tmprow.name}: ${getGrapplingSpeed(tmprow.name, tmpweaponspeedmod)}s, ${tmprow.damage}`;
}
// @END (CODE)
