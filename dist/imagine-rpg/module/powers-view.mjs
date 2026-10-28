// @START (CODE)
// @MARKER POWERS VIEW
//==================================================================================================================
// What the Add/Remove Powers/Abilities window shows, worked out without Foundry so the test can render
// the same template against the same view (the arrangement brawling-view.mjs keeps). The rules are in
// module/powers-rules.mjs; the window is module/apps/powers.mjs.
//
// His panel, top to bottom: the list "Additional Powers/Abilities" ("None" when empty); ADD ABILITIES
// (a typed one, a magical one, a divine one); ADD POWER (the same three, each with an activation);
// two notes; REMOVE POWER/ABILITY (a selector with left and right arrows).
//==================================================================================================================

import { POWER_ACTIVATIONS, describeTitleUsage } from "./powers-rules.mjs";

	// This is the function which builds everything the window renders.
	//
	//   tmpentries   the names now held, in order (the power items' names)
	//   tmpoptions = {
	//       title      the character's title, for the "(By Title)" note
	//       spells     names for the Magical dropdowns (the spell compendium), [] when there is none
	//       invocations names for the Divine dropdowns
	//       selected   the name showing in the remove selector, or ""
	//       working    the window's own answers kept across a re-render: { newAbility, newPower,
	//                  magicalAbility, divineAbility, magicalPower, divinePower, openActivation,
	//                  magicalActivation, divineActivation }
	//   }
	export function buildPowersView(tmpentries, tmpoptions) {
		var tmpo = tmpoptions ?? {};
		var tmpw = tmpo.working ?? {};
		var tmpnames = [...(tmpentries ?? [])];
		var tmpselected = tmpnames.includes(tmpo.selected) ? tmpo.selected : (tmpnames[0] ?? "");

		// A dropdown of names, blank first as his is, the one chosen marked.
		var tmplist = (tmpsource, tmpchosen) => [{ name: "", selected: !tmpchosen }]
			.concat((tmpsource ?? []).map(tmpname => ({ name: tmpname, selected: tmpname == tmpchosen })));
		// His activation selects, each defaulting to "(By Title)".
		var tmpactivations = (tmpchosen) => POWER_ACTIVATIONS.map(tmpvalue => ({ value: tmpvalue, selected: tmpvalue == (tmpchosen || "(By Title)") }));

		return {
			entries: tmpnames,
			hasEntries: tmpnames.length > 0,
			// His hidden "powers" attribute shown as text: "None" when empty.
			listText: tmpnames.length ? tmpnames.join(", ") : "None",
			selected: tmpselected,
			title: parseInt(tmpo.title) || 0,
			titleUsage: describeTitleUsage(tmpo.title),
			hasSpells: (tmpo.spells ?? []).length > 0,
			hasInvocations: (tmpo.invocations ?? []).length > 0,
			newAbility: "" + (tmpw.newAbility ?? ""),
			newPower: "" + (tmpw.newPower ?? ""),
			magicalAbilities: tmplist(tmpo.spells, tmpw.magicalAbility),
			divineAbilities: tmplist(tmpo.invocations, tmpw.divineAbility),
			magicalPowers: tmplist(tmpo.spells, tmpw.magicalPower),
			divinePowers: tmplist(tmpo.invocations, tmpw.divinePower),
			openActivations: tmpactivations(tmpw.openActivation),
			magicalActivations: tmpactivations(tmpw.magicalActivation),
			divineActivations: tmpactivations(tmpw.divineActivation)
		};
	}

// @MARKER ADD NEW powers view functions HERE
// @END (CODE)
