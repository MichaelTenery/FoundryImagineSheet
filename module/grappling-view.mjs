// @START (CODE)
// @MARKER GRAPPLING VIEW
//==================================================================================================================
// What the Grappling window shows, worked out without Foundry so the test can render the same template
// against the same view -- the arrangement brawling-view.mjs keeps.
//
// His GRAPPLING row is a dropdown of the fifteen moves, ROLL and MOD, and four read-only boxes -- Speed,
// Min, Mod, Damage -- and a notes line. The window is that row stood up: the dropdown, the four figures,
// the note for the move chosen, and one box for his MOD prompt. The rules are in
// module/combat/grappling-rules.mjs.
//==================================================================================================================

import { GRAPPLING_MOVES, getGrapplingValues, getGrapplingSpeed, canMakeMove } from "./combat/grappling-rules.mjs";

	// This is the function which builds everything the window renders.
	//
	//   tmpselected        the move chosen (system.combat.grapplingMove), or ""
	//   tmpoptions = {
	//       weaponSpeedMod   the actor's combat.weaponSpeedMod, for the Speed box
	//       noHands          true when the actor has "All manipulator limbs lost": only Touch and Escape
	//       situationLine    the attacker's standing Situation Mods, as one line, or ""
	//   }
	export function buildGrapplingView(tmpselected, tmpoptions) {
		var tmpo = tmpoptions ?? {};
		var tmpname = "" + (tmpselected ?? "");
		var tmprow = getGrapplingValues(tmpname);
		var tmpblocked = !!tmprow && !canMakeMove(tmpname, tmpo.noHands);

		return {
			name: tmpname,
			hasChoice: !!tmprow && !tmpblocked,
			blocked: tmpblocked,
			noHands: !!tmpo.noHands,
			moves: GRAPPLING_MOVES.map(tmpentry => ({
				name: tmpentry[0], selected: tmpentry[0] == tmpname,
				disabled: !canMakeMove(tmpentry[0], tmpo.noHands),
				figures: `${getGrapplingSpeed(tmpentry[0], tmpo.weaponSpeedMod)}s, ${tmpentry[4]}`
			})),
			// The four boxes of his row, "-" until something is chosen, as his sheet shows them.
			speed:    tmprow ? getGrapplingSpeed(tmpname, tmpo.weaponSpeedMod) : "-",
			minSpeed: tmprow ? tmprow.minSpeed : "-",
			mod:      tmprow ? tmprow.mod : "-",
			damage:   tmprow ? tmprow.damage : "-",
			speedMod: parseInt(tmpo.weaponSpeedMod) || 0,
			note:     tmprow ? tmprow.note : "Choose a grapple move.",
			situationLine: "" + (tmpo.situationLine ?? "")
		};
	}
// @END (CODE)
