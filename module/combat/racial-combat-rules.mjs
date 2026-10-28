// @START (CODE)
// @MARKER RACIAL COMBAT MODIFIERS
//==================================================================================================================
// What a race's senses and metabolism do to a fight: the eyes (Compound Eyes, Bad Eyes, Farsight, Exceptional
// Sight, one eye or both blind), lost sense tendrils, and a slow or fast metabolism. His setCombatModifierValues
// works these into the "Other" column of the Combat Modifiers table (sheet-worker.js:82205-82262), and his
// setGeneralCombatModifierDisplay writes one line each into the Specific Combat Modifiers list
// (sheet-worker.js:82495-82545). Both read the race's abilities and disabilities as one string and test it with
// includes(). His order is kept: "Metabolism,Very Slow" does not contain "Metabolism,Slow" (the comma comes
// first), so the four metabolisms cannot be mistaken for one another whichever is tested first.
//
// Nothing here talks to Foundry. The character's derivation folds the figures into the standing melee, missile,
// initiative and defence figures (module/data/actor-character.mjs, @MARKER RACIAL COMBAT MODIFIERS), the attack
// adds the damage, and the Combat panel (module/combat-panel-view.mjs) lists the lines.
//
// ONE THING IS NOT PORTED: Blind(-8 to hit/No defense) sets his isBlind, which takes the character's defence away
// altogether. The figures (-8 melee, -8 missile) are applied here; the No Defense half is shown in the line and
// left to the table, because the port's No Defense comes from the Situation Mods and a stance, and a third source
// written into it here would be cleared by neither of their buttons.
//==================================================================================================================

// A Famorian takes its metabolism as an evoke (his checkbox keys, module/famorian-rules.mjs), not as a race
// ability, and his evoke list writes it as the same "Metabolism,High(...)" text (sheet-worker.js:47385-47394),
// which is what his includes() then finds. The port keeps the keys, so they are named here.
//
//      evoke key                  the ability text his tests look for
const FAMORIAN_METABOLISM = {
	metabolism_very_slow:       "Metabolism,Very Slow",
	metabolism_slow:            "Metabolism,Slow",
	metabolism_high:            "Metabolism,High",
	metabolism_very_high:       "Metabolism,Very High"
};

	// This is the function which works out the racial combat modifiers, and the Specific Combat Modifiers lines
	// that go with them.
	//
	//   tmpabilities      the race's abilities, an array of names (identity.race.abilities)
	//   tmpdisabilities   the race's disabilities, likewise
	//   tmpevokes         a Famorian's evoke keys (physical.famorian.evokes), or []
	//
	// Returns { melee, missile, damage, defense, initiative, blind, lines }. Signs as his: a positive initiative
	// is SLOWER (lower acts first), a positive defence helps the ATTACKER (it is added to rolls against them).
	export function getRacialCombatMods(tmpabilities, tmpdisabilities, tmpevokes = []) {
		var tmpevokeText = (tmpevokes ?? []).map(tmpkey => FAMORIAN_METABOLISM[tmpkey] ?? "").filter(Boolean);
		var racialabilitiesvalue = [ ...(tmpabilities ?? []), ...tmpevokeText ].join(",");
		var racialdisabilitiesvalue = (tmpdisabilities ?? []).join(",");
		var tmpout = { melee: 0, missile: 0, damage: 0, defense: 0, initiative: 0, blind: false, lines: [] };

		// The eyes. Compound Eyes is the worst and overrides every other sight (82205).
		if (racialdisabilitiesvalue.includes("Compound Eyes")) {
			tmpout.missile = -4; tmpout.lines.push("Compound Eyes(Missile):-4");
		} else if (racialdisabilitiesvalue.includes("Bad Eyes")) {
			tmpout.missile = -2; tmpout.lines.push("Bad Eyes(Missile):-2");
		} else if (racialabilitiesvalue.includes("Farsight")) {   // the better bonus, so tested first
			tmpout.missile = 2; tmpout.lines.push("Farsight(Missile):+2");
		} else if (racialabilitiesvalue.includes("Exceptional Sight")) {
			tmpout.missile = 1; tmpout.lines.push("Exceptional Sight(Missile):+1");
		}

		// Blindness, on top of the eyes above (82237-82243).
		if (racialdisabilitiesvalue.includes("Blind in one eye")) {
			tmpout.missile = tmpout.missile - 2; tmpout.lines.push("Blind in one eye(Missile):-2");
		} else if (racialdisabilitiesvalue.includes("Blind(-8 to hit")) {
			tmpout.missile = tmpout.missile - 8; tmpout.melee = tmpout.melee - 8; tmpout.blind = true;
			tmpout.lines.push("Blind(Melee):-8 (Missile):-8 (No Defense)");
		}

		// Both sense tendrils lost: deaf, as he names it (82244-82249).
		if (racialdisabilitiesvalue.includes("Both sense tendrils lost")) {
			tmpout.missile = tmpout.missile - 1; tmpout.melee = tmpout.melee - 1;
			tmpout.defense = tmpout.defense + 1; tmpout.damage = tmpout.damage - 1;
			tmpout.lines.push("Deaf(Melee):-1 (Missile):-1 (Damage):-1 (Defense):+1");
		}

		// Metabolism, longest name first (82251-82260).
		if (racialabilitiesvalue.includes("Metabolism,Very Slow")) {
			tmpout.initiative = 2; tmpout.lines.push("Very Slow Metabolism(Initiative):+2");
		} else if (racialabilitiesvalue.includes("Metabolism,Slow")) {
			tmpout.initiative = 1; tmpout.lines.push("Slow Metabolism(Initiative):+1");
		} else if (racialabilitiesvalue.includes("Metabolism,High")) {
			tmpout.initiative = -1; tmpout.lines.push("High Metabolism(Initiative):-1");
		} else if (racialabilitiesvalue.includes("Metabolism,Very High")) {
			tmpout.initiative = -3; tmpout.lines.push("Very High Metabolism(Initiative):-3");
		}
		return tmpout;
	}

// @END (CODE)
