// @START (CODE)
// @MARKER CREATURE COMBAT RULES
//==================================================================================================================
// The rules for a creature's own attacks, as pure functions with no Foundry in them, so they can
// be tested outside it. The Foundry layer that rolls the dice and writes the chat card is
// combat/creature-attack.mjs.
//
// Ported from handleCreatureAttack (sheet-worker.js:179717-180136) and handleTouchAttack
// (sheet-worker.js:67731). A creature's attack shares the zone ladder, the fumble handling and
// the body damage of a weapon attack -- those are already in combat-rules.mjs and are reused
// rather than copied. What is creature-only is here:
//
//   - which kind of roll a given attack type needs, if any
//   - the area shapes, whose reach comes from the creature's own Endurance
//   - the touch rule
//   - how a creature's to-hit and damage modifiers add up
//==================================================================================================================

import { CREATURE_ATTACK_TYPES } from "../creature-tables.mjs";
import { getMartialAttackModifiers } from "./martial-arts.mjs";

//==================================================================================================================
// @MARKER ATTACK BEHAVIOUR
//==================================================================================================================

	// This is the function which says how an attack type resolves.
	// Returns { resolve, mods, shape, tier }:
	//     resolve  "chart" rolls d20 down the attack chart, "auto" hits without a roll,
	//              "touch" needs a 10 or better once the Agility modifier is in
	//     mods     "melee" or "missile", which set of to-hit modifiers applies
	//     shape    the area shape sized from Endurance, or "" for none
	//     tier     which size band that shape uses
	// An unknown type falls back to a plain melee chart roll, which is what his code does with
	// anything its branches do not recognise.
	export function getCreatureAttackBehaviour(tmptype) {
		var tmprow = CREATURE_ATTACK_TYPES[tmptype] ?? CREATURE_ATTACK_TYPES["Melee"];
		return { resolve: tmprow[0], mods: tmprow[1], shape: tmprow[2], tier: tmprow[3] };
	}

	// This is the function which resolves a touch attack. Ported from handleTouchAttack.
	// A natural 1 always misses; otherwise 10 or better once the Agility missile modifier and
	// any declared modifier are added makes contact.
	export function resolveTouchAttack(tmpnatural, tmpmods) {
		var tmpnat = parseInt(tmpnatural) || 0;
		if (tmpnat == 1) { return { natural: tmpnat, total: tmpnat, touched: false }; }
		var tmptotal = tmpnat + (parseInt(tmpmods) || 0);
		return { natural: tmpnat, total: tmptotal, touched: tmptotal > 9 };
	}

//==================================================================================================================
// @MARKER AREA SHAPES
//==================================================================================================================

	// His two dividing helpers, ported so the arithmetic matches exactly.
	// divideWithMin never returns less than 1 (sheet-worker.js:25595).
	function divideWithMin(tmpdividend, tmpdivisor) {
		var tmpvalue = parseInt(tmpdividend / tmpdivisor) || 0;
		if (tmpvalue < 1) { tmpvalue = 1; }
		return tmpvalue;
	}

	// divideWithMinAndMax is the same with a ceiling -- and the ceiling is the part his own
	// version never applies: it reads `tempValue=>tmpMaxValue`, an arrow function rather than an
	// assignment, so the maximum is silently dropped (sheet-worker.js:25604). The cap is applied
	// here, which is plainly what it was for. Recorded in docs/UPSTREAM-ISSUES.md.
	function divideWithMinAndMax(tmpdividend, tmpdivisor, tmpmax) {
		var tmpvalue = divideWithMin(tmpdividend, tmpdivisor);
		if (tmpvalue > tmpmax) { tmpvalue = tmpmax; }
		return tmpvalue;
	}

	// The ceiling each shape and tier uses, from his branches at sheet-worker.js:179789-179845.
	// Note the plain tier sits BETWEEN weak and strong for a bolt or a cone, which is the order
	// his code has them in.
	//                                    weak  normal  strong
	const SHAPE_LIMITS = {
		cloud: { weak: 25,  normal: 35,  strong: 50  },   // cloud caps the level, then length at 100
		bolt:  { weak: 100, normal: 150, strong: 200 },
		cone:  { weak: 100, normal: 150, strong: 200 },
		glob:  { weak: 150, normal: 200, strong: 300 }
	};

	// This is the function which works out how far an area attack reaches, from the creature's
	// Endurance, and describes it the way his chat output does.
	//
	// tmpdice is only needed for a cone, which affects 1d4 body areas of anyone caught in it;
	// it arrives as an argument rather than being rolled here so this stays pure.
	// Returns null for an attack with no shape.
	export function getAreaAttackSize(tmpshape, tmptier, tmpendurance, tmpdice) {
		var tmpend = parseInt(tmpendurance) || 0;
		var tmptierkey = tmptier || "normal";

		if (tmpshape == "gaze") {
			return { shape: tmpshape, text: "effects all who are gazed on by the creature" };
		}
		if (tmpshape == "voice") {
			return { shape: tmpshape, text: "effects all who hear the creature's voice" };
		}

		var tmplimits = SHAPE_LIMITS[tmpshape];
		if (!tmplimits) { return null; }
		var tmpmax = tmplimits[tmptierkey];

		if (tmpshape == "cloud") {
			var tmpwidth = divideWithMin(tmpend, 10);
			if (tmpwidth > tmpmax) { tmpwidth = tmpmax; }
			var tmplength = parseInt(tmpwidth * 2) || 0;
			if (tmplength > 100) { tmplength = 100; }
			return {
				shape: tmpshape, length: tmplength, width: tmpwidth,
				text: `releases an oval cloud ${tmplength}' long, and ${tmpwidth}' wide (and deep)`
			};
		}

		if (tmpshape == "bolt") {
			var tmprange = divideWithMinAndMax(tmpend, 10, tmpmax);
			return { shape: tmpshape, range: tmprange, text: `fires a bolt that travels up to ${tmprange}'` };
		}

		if (tmpshape == "cone") {
			var tmplen = divideWithMinAndMax(tmpend, 10, tmpmax);
			var tmpdiameter = divideWithMin(tmplen, 4);
			var tmpareas = parseInt(tmpdice) || 0;
			return {
				shape: tmpshape, range: tmplen, diameter: tmpdiameter, areas: tmpareas,
				text: `emits a cone that extends outward up to ${tmplen}' with a diameter of ${tmpdiameter}'`
				      + `, affecting ${tmpareas} body areas of anyone caught in it`
			};
		}

		// glob
		var tmpthrow = divideWithMin(tmpend, 20);
		tmpthrow = parseInt(tmpthrow * 3) || 0;
		if (tmpthrow > tmpmax) { tmpthrow = tmpmax; }
		return { shape: tmpshape, range: tmpthrow, text: `shoots a glob up to ${tmpthrow}'` };
	}

//==================================================================================================================
// @MARKER MODIFIERS
//==================================================================================================================

	// This is the function which gathers every modifier to a creature's attack roll, each with
	// the label the chat card shows, in the manner of getToHitModifiers for a weapon.
	//
	// Melee takes the Strength modifier, missile the Agility one, and each its own manual
	// adjustment. A creature has no weapon to contribute a modifier and no proficiency to lack.
	//
	// Note this does NOT reproduce his arithmetic literally. His creature path adds
	// combat_mod_missile -- which is already the Agility modifier plus the others -- and then
	// adds the "other" modifier again, and its `||0` precedence wipes the running total whenever
	// a field is blank. Both are recorded in docs/UPSTREAM-ISSUES.md item 11; this follows
	// handlePhysicalAttacks, which sums each modifier once and separately, as evidently intended.
	export function getCreatureToHitModifiers(tmpinput) {
		var tmpattacker = tmpinput.attacker ?? {};
		var tmplist = [];

		if (tmpinput.mods == "missile") {
			var tmpagl = parseInt(tmpattacker.missileAttack) || 0;
			if (tmpagl) { tmplist.push({ label: "AGL", value: tmpagl }); }
			var tmpmissilemisc = parseInt(tmpattacker.missileMisc) || 0;
			if (tmpmissilemisc) { tmplist.push({ label: "Missile Other", value: tmpmissilemisc }); }
		} else {
			var tmpstr = parseInt(tmpattacker.meleeAttack) || 0;
			if (tmpstr) { tmplist.push({ label: "STR", value: tmpstr }); }
			var tmpmeleemisc = parseInt(tmpattacker.meleeMisc) || 0;
			if (tmpmeleemisc) { tmplist.push({ label: "Melee Other", value: tmpmeleemisc }); }
		}

		// Weapon Lore's +2 on a melee-kind attack, Missile Lore's +2 on a missile-kind one -- worked out
		// on the creature (combat.loreMelee / loreMissile) and passed in already chosen for this attack's
		// kind, since his creature branch files them in combat_mod_melee_other and combat_mod_missile_other
		// (sheet-worker.js:82262-82307), which his handleCreatureAttack reads by kind (179756-179770).
		var tmplore = parseInt(tmpinput.lore) || 0;
		if (tmplore) { tmplist.push({ label: "Lore", value: tmplore }); }

		if (tmpinput.target) {
			var tmpdef = parseInt(tmpinput.target.defensiveAdjust) || 0;
			if (tmpdef) { tmplist.push({ label: "Target's Defence", value: tmpdef }); }
		}

		// The off-hand penalty, worked out by resolveOffhandPenalties and passed in for the same
		// reason a character's is -- see the note on getToHitModifiers in combat-rules.mjs. Not
		// melee-only: an off-hand claw flung at range is penalised exactly as one swung in melee.
		var tmpoffhand = parseInt(tmpinput.offhand) || 0;
		if (tmpoffhand) { tmplist.push({ label: "Off Hand", value: tmpoffhand }); }

		// The Situation Mods the creature has set, cut to this attack by getSituationalForAttack
		// -- his creature page has the same bar a character's does -- then the number typed into
		// the attack dialog, as a character's are.
		var tmpsituation = parseInt(tmpinput.situation) || 0;
		if (tmpsituation) { tmplist.push({ label: "Situational", value: tmpsituation }); }
		var tmpsituational = parseInt(tmpinput.situational) || 0;
		if (tmpsituational) { tmplist.push({ label: "Modifier", value: tmpsituational }); }

		var tmptotal = 0;
		for (const tmpmod of tmplist) { tmptotal = tmptotal + tmpmod.value; }
		return { list: tmplist, total: tmptotal };
	}

	// This is the function which totals the flat additions to a creature's damage, each with the
	// label the chat card shows.
	//
	// CORRECTED 2026-09-23. This used to say "a creature gets no Strength damage bonus on top of its
	// attack's own dice -- the dice on the stat block are the whole of it", and gave a creature only
	// the temporary modifier. That misread his damage block. handleCreatureAttack (sheet-worker.js:
	// 179920-179929) adds, to every attack whose type is not "Projectile" -- and no creature attack
	// type is --
	//
	//     combat_mod_damage            Strength's melee damage + body weight (floored at 0 for a
	//                                  creature) + Weapon Lore's +4 + the temporary modifier
	//                                  (setCombatModifierValues, 82309-82322)
	//     situational_mod_damage       the Situation Mods
	//     martial_arts_mod_damage      a martial move's damage
	//     martial_lore_mod_damage      a Martial Lore value's
	//     martial_stance_mod_damage    the held stance's
	//
	// and the books mostly agree: of the four bestiaries' stat lines checked, 174 print a "Damage +N"
	// that is exactly Strength plus weight (a 1,200 lb buffalo of Strength 19 prints "Damage +17",
	// 5 + 12; Aspects of the Wild, PDF page 58) and 48 more come within 2. See the CORRECTION in
	// docs/DECISIONS.md, 2026-09-23.
	//
	// A TOUCH takes none of it. His touch branch (179773-179779) rolls the attack's bare dice, so here
	// a touch keeps only what the port adds to every attack of its own accord: the off-hand penalty
	// and the number typed into the attack dialog for this one attack.
	//
	// Every other type takes all of it -- breath, gaze and area attacks included, as his code does,
	// though the Player's Guide (p.179) speaks of body weight "when the character attacks with any
	// melee weapon". Whether he meant a dragon's breath to carry its +20 for weight is asked of him in
	// docs/UPSTREAM-ISSUES.md (2026-09-23); until he answers, the sheet is followed -- the provisional
	// D2 of the creature audit.
	//
	//   tmpinput = {
	//       resolve      the attack type's resolve ("chart", "auto", "touch"), getCreatureAttackBehaviour
	//       strength     combat.meleeDamage, signed
	//       weight       combat.weightDamage, already floored at 0
	//       lore         combat.loreDamage
	//       damageMisc   combat.damageMisc, his temporary damage modifier
	//       martial      the martial damage already worked out for this attack's dice, flat + per die
	//       offhand      the off-hand penalty, resolved by resolveOffhandPenalties
	//       situation    the Situation Mods' damage for this attack
	//       situational  the number typed into the attack dialog
	//   }
	export function getCreatureDamageMods(tmpinput) {
		var tmplist = [];
		var tmpistouch = (tmpinput.resolve == "touch");

		if (!tmpistouch) {
			var tmpstr = parseInt(tmpinput.strength) || 0;
			if (tmpstr) { tmplist.push({ label: "STR", value: tmpstr }); }
			var tmpweight = parseInt(tmpinput.weight) || 0;
			if (tmpweight) { tmplist.push({ label: "Weight", value: tmpweight }); }
			var tmplore = parseInt(tmpinput.lore) || 0;
			if (tmplore) { tmplist.push({ label: "Lore", value: tmplore }); }
			var tmpmisc = parseInt(tmpinput.damageMisc) || 0;
			if (tmpmisc) { tmplist.push({ label: "Damage Other", value: tmpmisc }); }
			var tmpmartial = parseInt(tmpinput.martial) || 0;
			if (tmpmartial) { tmplist.push({ label: "Martial", value: tmpmartial }); }
		}
		var tmpoffhand = parseInt(tmpinput.offhand) || 0;
		if (tmpoffhand) { tmplist.push({ label: "Off Hand", value: tmpoffhand }); }
		if (!tmpistouch) {
			var tmpsituation = parseInt(tmpinput.situation) || 0;
			if (tmpsituation) { tmplist.push({ label: "Situational", value: tmpsituation }); }
		}
		var tmpsituational = parseInt(tmpinput.situational) || 0;
		if (tmpsituational) { tmplist.push({ label: "Modifier", value: tmpsituational }); }

		var tmptotal = 0;
		for (const tmpmod of tmplist) { tmptotal = tmptotal + tmpmod.value; }
		return { list: tmplist, total: tmptotal };
	}

	// @MARKER CREATURE MARTIAL MODIFIERS
	// This is the function which gives what a creature's martial arts add to one of its natural attacks.
	//
	// CORRECTED 2026-09-23. The port used to give a natural attack the martial MELEE to-hit and nothing
	// else, on a reading of his handleCreatureAttack that said it took "no damage, no missile". It takes
	// all of it:
	//   to hit    a missile-kind attack (his test: the type names Missile, Glob or Bolt) adds
	//             martial_arts_mod_missile and martial_stance_mod_missile (sheet-worker.js:179761-179762);
	//             every other type the two melee figures (179768-179769). Here that is what
	//             getMartialAttackModifiers lists for a missile mode (the stance's missile figure) and
	//             for a melee one (the moves and the stance's melee figure).
	//   damage    every attack but a Touch adds the moves', Lore values' and stance's damage
	//             (179927-179929) WHATEVER ITS KIND -- a spat glob too -- the stance's "+1/+2 Die Dam"
	//             (179932-179945), the moves' extra dice and damage per die (tmp_extra_dice,
	//             tmp_extra_per_die, 179961-179968), and the martial multiplier (180003-180010). So the
	//             damage is always read at a melee mode. The one stance with "Die Dam", Drunken
	//             fighting, is read as damage PER die rather than an extra die, as it already is on a
	//             character's weapon (MARTIAL_STANCE_CORRECTIONS in martial-arts.mjs: his own prose
	//             and Mysteries of the Planes p.167 say per die).
	// A Touch rolls d20 plus Agility alone and its bare dice (179773-179779), so it takes none of it.
	// A Flip in progress forbids any attack, a touch included.
	//
	// Returns { noAttack, noAttackReason, list, special, damage: { flat, extraDice, perDie, multiplier } }.
	export function getCreatureMartialModifiers(tmpstate, tmpbehaviour) {
		var tmpmelee = getMartialAttackModifiers(tmpstate, { mode: "smash", martialAttack: false });
		var tmpout = {
			noAttack: tmpmelee.noAttack, noAttackReason: tmpmelee.noAttackReason,
			list: [], special: [],
			damage: { flat: 0, extraDice: 0, perDie: 0, multiplier: 1 }
		};
		if (tmpbehaviour?.resolve == "touch") { return tmpout; }

		var tmpkind = (tmpbehaviour?.mods == "missile")
			? getMartialAttackModifiers(tmpstate, { mode: "missile", martialAttack: false })
			: tmpmelee;
		tmpout.list = tmpkind.list;
		tmpout.special = tmpkind.special;
		tmpout.damage = {
			flat: tmpmelee.damage.flat, extraDice: tmpmelee.damage.extraDice,
			perDie: tmpmelee.damage.perDie, multiplier: tmpmelee.damage.multiplier
		};
		return tmpout;
	}

	// This is the function which picks out the rider effects that a given result sets off.
	//
	// A trigger of "Auto" always fires. "If hit" needs the attack to have landed. Everything
	// else names a save or a resistance that has to fail, which the Game Master rolls -- those
	// are reported as pending rather than decided here, because the target's own sheet owns
	// those rolls. "If 10 damage" is decided by the damage actually done, as his code does when
	// it annotates the trigger with the total.
	export function getTriggeredEffects(tmpeffects, tmpresult) {
		var tmpout = [];
		for (const tmpeffect of tmpeffects ?? []) {
			var tmptrigger = String(tmpeffect.trigger ?? "");
			var tmpstate = "pending";

			if (tmptrigger == "Auto") { tmpstate = "fires"; }
			else if (tmptrigger == "If hit") { tmpstate = tmpresult.isHit ? "fires" : "no"; }
			else if (tmptrigger == "If natural critical") {
				tmpstate = tmpresult.isCalledShot ? "fires" : "no";
			}
			else if (tmptrigger == "If 10 damage") {
				tmpstate = ((parseInt(tmpresult.damageTotal) || 0) >= 10) ? "fires" : "no";
			}
			else if (!tmpresult.isHit) { tmpstate = "no"; }   // a save only matters once it lands

			tmpout.push({ ...tmpeffect, state: tmpstate });
		}
		return tmpout;
	}

	// @MARKER HOW LONG AN ATTACK TAKES
	// This is the function which says how many of the round's ten seconds a creature's attack
	// spends. A creature carries its own seconds on the attack -- there is no weapon speed to fold
	// in -- and a called shot takes one second more (Player's Guide, Called Shots).
	//
	// "Special" timing is his own marker for an attack that does not spend seconds at all: a
	// constant aura, a gaze, something that happens rather than being swung. It is zero, and a
	// called shot does not add to it either, since there is nothing to be slower than.
	//
	// Split out of rollCreatureAttack so it can be tested: that function needs Foundry's dice and
	// chat, so for a long time this rule was only ever exercised by eye in a preview.
	export function getCreatureAttackSeconds(tmpattack, tmpcalledshot) {
		if (tmpattack?.speedSpecial) { return 0; }
		return (parseInt(tmpattack?.speed) || 0) + (tmpcalledshot ? 1 : 0);
	}

// @MARKER ADD NEW creature combat rule functions HERE
// @END (CODE)
