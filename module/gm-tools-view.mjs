// @START (CODE)
// @MARKER GM TOOLS VIEW
//==================================================================================================================
// What the GM Tools window shows, worked out without Foundry so the test can render the same template
// against the same view (the arrangement brawling-view.mjs keeps). The rules are module/gm-exp-rules.mjs;
// the window is module/apps/gm-tools.mjs.
//
// His Character Sheet Config tab, the two parts that are a Game Master's: "Calc/Show Experience Value"
// (the Show Experience tick, the Experience Bonuses ticks and CALC) and "Split Experience".
//==================================================================================================================

import { EXP_DIFFICULTIES, POISON_TYPES, EXP_BONUS_TICKS } from "./gm-exp-rules.mjs";

	// This is the function which builds everything the window renders.
	//
	//   tmpactor     { type, system } -- a character or a creature
	//   tmpoptions = {
	//       value     the experience value worked out ({ total, parts }), or null for a creature (whose
	//                 own value is on its sheet and is read from system.identity.expValue)
	//       working   the split's own answers kept across a re-render: { amount, people, difficulty, fill }
	//       split     the last split's result { total, perPerson, remainder }, or null
	//   }
	export function buildGmToolsView(tmpactor, tmpoptions) {
		var tmpo = tmpoptions ?? {};
		var tmpw = tmpo.working ?? {};
		var tmpsystem = tmpactor?.system ?? {};
		var tmpiscreature = tmpactor?.type == "creature";
		var tmpbonus = tmpsystem.gmExp ?? {};

		// The value the "Fill" tick puts in the split box: the character's worked out value, or the
		// creature's own.
		var tmpvalue = tmpiscreature ? (parseInt(tmpsystem.identity?.expValue) || 0) : (parseInt(tmpo.value?.total) || 0);

		var tmpparts = [];
		if (tmpo.value?.parts) {
			var tmplabels = { base: "Base (by title)", attributes: "Attributes", endurance: "Endurance", resistances: "Resistances",
				skills: "Skills", powers: "Powers", specials: "Experience bonuses", hide: "Hide", immunities: "Immunities" };
			for (const [tmpkey, tmplabel] of Object.entries(tmplabels)) {
				if (tmpo.value.parts[tmpkey]) { tmpparts.push({ label: tmplabel, value: tmpo.value.parts[tmpkey] }); }
			}
		}

		var tmpdifficulty = parseFloat(tmpw.difficulty) || 1;
		var tmpamount = tmpw.fill ? tmpvalue : (tmpw.amount ?? "");
		return {
			isCreature: tmpiscreature,
			showExp: !!tmpbonus.show,
			value: tmpvalue,
			parts: tmpparts,
			poisonTypes: [{ value: "", selected: !tmpbonus.poisonType }]
				.concat(POISON_TYPES.map(tmpname => ({ value: tmpname, selected: tmpname == tmpbonus.poisonType }))),
			ticks: EXP_BONUS_TICKS.map(([tmpkey, tmplabel]) => ({ key: tmpkey, label: tmplabel, checked: !!tmpbonus[tmpkey] })),
			amount: tmpamount,
			fill: !!tmpw.fill,
			people: tmpw.people ?? "",
			difficulties: EXP_DIFFICULTIES.map(([tmpfactor, tmplabel]) => ({ value: tmpfactor, label: tmplabel, selected: tmpfactor == tmpdifficulty })),
			split: tmpo.split ?? null
		};
	}

// @MARKER ADD NEW gm tools view functions HERE
// @END (CODE)
