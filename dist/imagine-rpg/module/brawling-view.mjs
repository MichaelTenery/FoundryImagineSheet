// @START (CODE)
// @MARKER BRAWLING VIEW
//==================================================================================================================
// What the Brawling window shows, worked out without Foundry so the test can render the same
// template against the same view -- the arrangement situational-view.mjs and weapon-mods-view.mjs
// keep.
//
// His BRAWLER block is one row: a dropdown of the fifty brawling weapons, ROLL and MOD, and four
// read-only boxes -- Type, Speed, Min, Damage -- filled in as the dropdown changes. The window is
// that row stood up: the dropdown grouped (the twists, hand to hand, the improvised weapons), the
// four figures beside it, and under them the questions every attack of this system asks before the
// die is rolled. The rules are in module/combat/brawling-rules.mjs.
//==================================================================================================================

import { BRAWLING_WEAPONS, getBrawlingValues, getBrawlingSpeed, isTwist, isForceTwist, isHandToHand }
	from "./combat/brawling-rules.mjs";

	// The dropdown's three groups, in his order within each.
	//                            kind          label
	const BRAWLING_GROUPS = [
		[ "twist",      "Twisting a weapon in a wound" ],
		[ "hand",       "Hand to hand"                 ],
		[ "improvised", "Improvised weapons"           ]
	];

	// This is the function which builds everything the window renders.
	//
	//   tmpselected        the name chosen (system.combat.brawlingWeapon), or ""
	//   tmpoptions = {
	//       weaponSpeedMod   the actor's combat.weaponSpeedMod, for the Speed box
	//       forceChance      the Force skill's chance, or null when it is not held
	//       areas            the target's body areas, [{ name }], for the aim select; [] for none
	//       targetName       the target's name, or ""
	//       targetNoDefense  true when the target has No Defense from their own Situation Mods
	//       situationLine    the attacker's standing Situation Mods, as one line, or ""
	//       situationMelee   true when those mods are set for melee (so this attack reads them)
	//   }
	export function buildBrawlingView(tmpselected, tmpoptions) {
		var tmpo = tmpoptions ?? {};
		var tmpname = "" + (tmpselected ?? "");
		var tmprow = getBrawlingValues(tmpname);

		var tmpgroups = BRAWLING_GROUPS.map(([tmpkind, tmplabel]) => ({
			kind: tmpkind, label: tmplabel,
			options: BRAWLING_WEAPONS
				.filter(tmpentry => (getBrawlingValues(tmpentry[0])?.kind) == tmpkind)
				.map(tmpentry => ({ name: tmpentry[0], selected: tmpentry[0] == tmpname,
				                    figures: `${tmpentry[1]}, ${tmpentry[2]}s, ${tmpentry[4]}` }))
		}));

		var tmpspeed = tmprow ? getBrawlingSpeed(tmpname, tmpo.weaponSpeedMod) : 0;
		var tmptwist = !!tmprow && isTwist(tmpname);
		var tmpforce = !!tmprow && isForceTwist(tmpname);
		var tmpareas = (tmpo.areas ?? []).map(tmparea => ({ name: tmparea.name }));

		return {
			name: tmpname,
			hasChoice: !!tmprow,
			groups: tmpgroups,
			// The four boxes of his row, "-" until something is chosen, as his sheet shows them.
			type:     tmprow ? tmprow.type : "-",
			speed:    tmprow ? tmpspeed : "-",
			minSpeed: tmprow ? tmprow.minSpeed : "-",
			damage:   tmprow ? tmprow.damage : "-",
			speedMod: parseInt(tmpo.weaponSpeedMod) || 0,
			isTwist: tmptwist,
			isForceTwist: tmpforce,
			isHandToHand: !!tmprow && isHandToHand(tmpname),
			// The Force skill, for a Force Twist: its chance, or that it is not held, which still
			// twists -- as a Weapon Twist.
			forceChance: (tmpo.forceChance === null || tmpo.forceChance === undefined) ? null : (parseInt(tmpo.forceChance) || 0),
			forceHeld: !(tmpo.forceChance === null || tmpo.forceChance === undefined),
			// The aim: a twist has none to speak of (the weapon is where it is), so the aim select
			// is offered only for a blow read down the chart.
			askAim: !!tmprow && !tmptwist,
			areas: tmpareas,
			hasTarget: !!(tmpo.targetName),
			targetName: "" + (tmpo.targetName ?? ""),
			targetNoDefense: !!tmpo.targetNoDefense,
			situationLine: "" + (tmpo.situationLine ?? ""),
			situationMelee: !!tmpo.situationMelee,
			note: describeBrawlingRow(tmprow)
		};
	}

	// This is the function which says in a sentence what the chosen row does when it is rolled --
	// what his card said in its prose.
	export function describeBrawlingRow(tmprow) {
		if (!tmprow) { return "Choose what to brawl with."; }
		if (isForceTwist(tmprow.name)) {
			return "A weapon already in the wound, forced: the Force skill is rolled, and the damage goes "
			     + "straight to the body area the weapon is set in, bypassing armour. Failed, it is a Weapon Twist "
			     + `of the same size. Five seconds (the book's three to twist, and two more for Force).`;
		}
		if (isTwist(tmprow.name)) {
			return "A weapon already in the wound, twisted: no roll to hit; the damage goes straight to the "
			     + "body area the weapon is set in, bypassing armour. Every three seconds of twisting.";
		}
		if (isHandToHand(tmprow.name)) {
			return `${tmprow.name}: read down the attack chart like a weapon. Strength and body weight add to the damage.`;
		}
		return `${tmprow.name}: an improvised weapon, read down the attack chart. Strength and body weight add to the damage.`;
	}

	// This is the function which words the chosen row for the Combat tab's bar -- "Fist(Punch): Smash,
	// 2s, 1", or nothing when nothing is chosen.
	export function describeBrawlingChoice(tmpselected, tmpweaponspeedmod) {
		var tmprow = getBrawlingValues(tmpselected);
		if (!tmprow) { return ""; }
		return `${tmprow.name}: ${tmprow.type}, ${getBrawlingSpeed(tmprow.name, tmpweaponspeedmod)}s, ${tmprow.damage}`;
	}
// @END (CODE)
