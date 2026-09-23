// @START (CODE)
// @MARKER MARTIAL ARTS VIEW
//==================================================================================================================
// What the Combat tab's martial arts panel shows, worked out without Foundry so the preview can
// render the same template against the same view -- the arrangement levelup-view.mjs and
// situational-view.mjs already use. A copy of a sheet's private builder kept in a preview harness
// drifts (tools/sheet-preview.html's duplicated #buildWeaponRows has, twice); one function called
// from both cannot.
//
// Everything it lays out was derived by _prepareMartialArts in the character model. The rules are
// in module/combat/martial-arts.mjs, the rolls in module/combat/martial-attack.mjs.
//==================================================================================================================

import { MARTIAL_DISCIPLINE_NAMES, MARTIAL_FAMILIES, parseMartialList } from "./combat/martial-arts.mjs";

	// What each of the three roll-only families asks for, shown beside its heading.
	//                  hint
	const MARTIAL_FAMILY_HINTS = {
		blocks: "a made block takes half the blow on the limb or torso used",
		holds:  "a touch first (d20 + Agility, 10 or better), then the skill roll",
		throws: "a touch first, then the skill roll; a Spin Throw needs no touch"
	};

	// This is the function which words a signed number, "+3" or "-2".
	function signed(tmpvalue) {
		return `${tmpvalue > 0 ? "+" : ""}${tmpvalue}`;
	}

	// This is the function which says, as lines, what the martial state in play does -- so the player
	// can see what the next attack will read without rolling it.
	export function describeMartialEffects(tmpstate) {
		var tmpeffects = [];
		var tmpstance = tmpstate?.stance;
		var tmpmoves = tmpstate?.moves ?? { made: [], illegal: [] };
		if (tmpstance) {
			var tmphit = [];
			if (tmpstance.melee)   { tmphit.push(`${signed(tmpstance.melee)} melee`); }
			if (tmpstance.missile) { tmphit.push(`${signed(tmpstance.missile)} missile`); }
			if (tmpstance.damage)  { tmphit.push(`${signed(tmpstance.damage)} damage`); }
			if (tmpstance.perDie)  { tmphit.push(`${signed(tmpstance.perDie)} damage per die`); }
			if (tmphit.length) { tmpeffects.push(`${tmpstance.name}: ${tmphit.join(", ")}`); }
		}
		if (tmpmoves.made.length && !tmpmoves.illegal.length) {
			var tmpmove = [];
			if (tmpmoves.melee)          { tmpmove.push(`${signed(tmpmoves.melee)} to hit`); }
			if (tmpmoves.damage)         { tmpmove.push(`${signed(tmpmoves.damage)} damage`); }
			if (tmpmoves.extraDice)      { tmpmove.push(`${signed(tmpmoves.extraDice)} damage die`); }
			if (tmpmoves.perDie)         { tmpmove.push(`${signed(tmpmoves.perDie)} damage per die`); }
			if (tmpmoves.multiplier > 1) { tmpmove.push(`damage x${tmpmoves.multiplier}`); }
			if (tmpmoves.seconds)        { tmpmove.push(`${signed(tmpmoves.seconds)} second(s) per attack`); }
			if (tmpmoves.strength == "tension") { tmpmove.push("Strength damage doubled"); }
			if (tmpmoves.martialOnly?.strength == "snap") { tmpmove.push("no Strength on a martial attack"); }
			if (tmpmove.length) { tmpeffects.push(`Moves (melee): ${tmpmove.join(", ")}`); }
		}
		if (tmpmoves.noDefense) { tmpeffects.push("Immoveable Stance: no defence while held"); }
		if (tmpstate?.defense?.adjust) {
			tmpeffects.push(`Defence ${signed(tmpstate.defense.adjust)} (${tmpstate.defense.reasons.join(", ")})`);
		}
		if (tmpstate?.initiative) { tmpeffects.push(`Initiative ${signed(tmpstate.initiative)}`); }
		if (tmpstate?.seconds) { tmpeffects.push(`Offensive actions ${signed(tmpstate.seconds)} second(s)`); }
		if (tmpstance?.inactive) { tmpeffects.push(`${tmpstance.inactive}: the stance adds nothing`); }
		if ((tmpstate?.bonuses?.lines ?? []).length) {
			tmpeffects.push(`While held: ${tmpstate.bonuses.lines.join(", ")}`);
		}
		var tmpblind = tmpstate?.blind;
		if (tmpblind?.blindFighting || tmpblind?.missileBlindFighting || tmpblind?.damage) {
			var tmpblindparts = [`${signed(tmpblind.blindFighting)} melee`];
			if (tmpblind.missileBlindFighting) { tmpblindparts.push(`${signed(tmpblind.missileBlindFighting)} missile`); }
			if (tmpblind.damage) { tmpblindparts.push(`${signed(tmpblind.damage)} damage`); }
			if (tmpblind.skills) { tmpblindparts.push(`${signed(tmpblind.skills)}% combat skills`); }
			tmpeffects.push(`Fighting blind: ${tmpblindparts.join(", ")}, never past the blindness penalty`
				+ `${tmpblind.fullDefense ? "; defence kept" : ""}`);
		}
		if (tmpstate?.lore?.noAttack) { tmpeffects.push("Flipping: no attack"); }
		if (tmpstate?.lore?.blockSeconds) { tmpeffects.push(`Feather Block: +${tmpstate.lore.blockSeconds} second(s) to the next block`); }
		if (tmpstate?.lore?.throwSeconds) { tmpeffects.push(`Slam: +${tmpstate.lore.throwSeconds} seconds to the next throw`); }
		return tmpeffects;
	}

	// This is the function which lays out the martial arts panel.
	//
	// Shown to a character who holds Martial Knowledge, or who has a discipline written down without
	// it -- the second so a Game Master can see what a character WOULD know, and why none of it
	// applies. Everyone else has no martial arts, and the tab stays as it was.
	//
	//   tmpsystem  the character's derived system data
	//   tmpopen    whether the panel is open -- the sheet's own state, not the character's
	export function buildMartialPanel(tmpsystem, tmpopen) {
		var tmpm = tmpsystem?.martial ?? {};
		var tmpstate = tmpm.state ?? {};
		if (!(tmpm.hasKnowledge || tmpm.discipline)) { return { show: false }; }

		var tmpstance = tmpstate.stance;
		var tmpmoves = tmpstate.moves ?? { made: [], illegal: [] };

		// One line for the closed panel: the discipline, the stance held and what is made.
		var tmpsummary = [tmpm.discipline || "no discipline chosen"];
		if (tmpstance) { tmpsummary.push(`${tmpstance.name}${tmpstance.mastered ? " (mastered)" : ""}`); }
		if (tmpmoves.made.length) { tmpsummary.push(tmpmoves.made.join(", ")); }
		if ((tmpstate.lore?.made ?? []).length) { tmpsummary.push(tmpstate.lore.made.join(", ")); }

		// The stance dropdown offers only what has been learned. A mastered one says so.
		var tmpmastered = parseMartialList(tmpm.masteredStances);
		var tmpstancechoices = [{ value: "", label: "No stance", selected: !tmpstance }];
		for (const tmprow of tmpm.stanceRows ?? []) {
			tmpstancechoices.push({ value: tmprow.name,
				label: `${tmprow.name}${tmpmastered.includes(tmprow.name) ? " (mastered)" : ""}`,
				selected: !!tmpstance && tmpstance.name == tmprow.name });
		}

		var tmprows = tmpm.rows ?? {};
		var tmpmade = tmpm.activeMoveNames ?? [];
		var tmpmadelore = tmpm.activeLoreNames ?? [];
		var tmpsubskills = [];
		for (const tmpfamily of ["blocks", "holds", "throws"]) {
			if (!(tmprows[tmpfamily] ?? []).length) { continue; }
			tmpsubskills.push({ family: tmpfamily, label: MARTIAL_FAMILIES[tmpfamily].label,
			                    hint: MARTIAL_FAMILY_HINTS[tmpfamily], rows: tmprows[tmpfamily] });
		}

		return {
			show: true,
			open: !!tmpopen,
			summary: tmpsummary.join(" · "),
			hasKnowledge: !!tmpm.hasKnowledge,
			hasLore: !!tmpm.hasLore,
			knowChance: tmpm.knowChance ?? 0,
			loreChance: tmpm.loreChance ?? 0,
			needsDiscipline: !!tmpm.hasKnowledge && !tmpm.discipline,
			disciplineChoices: ["", ...MARTIAL_DISCIPLINE_NAMES].map(tmpname => ({
				value: tmpname, label: tmpname || "(none chosen)", selected: tmpname == (tmpm.discipline ?? "") })),
			standFromProne: tmpm.standFromProne ?? "",
			stanceChoices: tmpstancechoices,
			stanceText: tmpstance ? tmpstance.text : "",
			// The two conditions a stance's bonuses wait on, shown only with the stance that reads
			// them: the Drunken stance's count of failed VIT saves, and Calm in the storm's "resisting
			// a hold or movement effect".
			showIntoxication: tmpstance?.name == "Drunken fighting",
			intoxication: parseInt(tmpm.intoxication) || 0,
			showResistingHold: tmpstance?.name == "Calm in the storm",
			resistingHold: !!tmpm.resistingHold,
			effects: describeMartialEffects(tmpstate),
			illegal: tmpmoves.illegal.length
				? `${tmpmoves.illegal.join(" and ")} cannot be combined without Martial Lore: none of them applies.` : "",
			moves: (tmprows.moves ?? []).map(tmprow => ({ ...tmprow, made: tmpmade.includes(tmprow.name) })),
			attacks: tmprows.attacks ?? [],
			subskills: tmpsubskills,
			lore: (tmpm.loreRows ?? []).map(tmprow => ({ ...tmprow, made: tmpmadelore.includes(tmprow.name) })),
			unknown: (tmpm.known?.unknown ?? []).join(", ")
		};
	}
// @END (CODE)
