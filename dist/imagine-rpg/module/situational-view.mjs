// @START (CODE)
// @MARKER SITUATION MODS VIEW
//==================================================================================================================
// What the Situation Mods window shows, worked out without Foundry so the preview can render the
// same template against the same view -- the same arrangement as levelup-view.mjs.
//
// His combat page has one bar, "SITUATION MODS", with a dropdown that opens one of two panels --
// "Set melee modifiers" or "Set missile modifiers" -- and a Clear. The window is that: pick the
// kind, tick what applies, and the totals along the bottom are what every attack of that kind
// will read. The rules themselves are in combat-rules.mjs, under @MARKER SITUATIONAL MODIFIERS.
//==================================================================================================================

import { getSituationalOptions, resolveSituationalMods } from "./combat/combat-rules.mjs";

	// The two panels, and none. His dropdown's own words.
	//                     value       label
	export const SITUATION_KINDS = [
		{ value: "",        label: "None set" },
		{ value: "melee",   label: "Melee modifiers" },
		{ value: "missile", label: "Missile modifiers" }
	];

	// Groups shown as a dropdown rather than a row of boxes: one-of, and long enough that two
	// dozen checkboxes would bury the rest of the window.
	const SELECT_GROUPS = ["size", "area"];

	// This is the function which words what one option is worth, the way his labels do: "+2/+1 Dam",
	// "x2 Dam", "+4 Defense", "No Defense", "Max Dam".
	export function describeSituationalOption(tmpoption, tmpkind) {
		var tmpparts = [];
		var tmpword = (tmpkind == "missile") ? "Missile" : "Melee";
		var tmpsigned = (n) => `${n > 0 ? "+" : ""}${n}`;
		if (tmpoption.attack)  { tmpparts.push(`${tmpsigned(tmpoption.attack)} ${tmpword}`); }
		if (tmpoption.damage)  { tmpparts.push(`${tmpsigned(tmpoption.damage)} Dam`); }
		if (tmpoption.multi)   { tmpparts.push(`x${tmpoption.multi + 1} Dam`); }
		if (tmpoption.defense) { tmpparts.push(`${tmpsigned(tmpoption.defense)} Defense`); }
		if (tmpoption.noDef)   { tmpparts.push("No Defense"); }
		for (const tmpspecial of tmpoption.special ?? []) {
			if (tmpspecial == "Max") { tmpparts.push("Max Dam"); }
			else if (tmpspecial == "Half Dam") { tmpparts.push("Half Dam"); }
			else if (tmpspecial != "Called Shot") { tmpparts.push(tmpspecial.replace("`", "'")); }
		}
		if (tmpoption.multiMissile) { tmpparts.push("penalty by Multiple Missile skills"); }
		return tmpparts.join(", ");
	}

	// This is the function which builds everything the window renders.
	//
	//   tmpsituation   the stored { kind, selected, weaponId }
	//   tmpresolved    the actor's combat.situational, already totalled (null to total it here)
	//   tmpweapons     [{ id, name, skillsMod }] -- the weapons a skill roll may be made with; empty
	//                  for a creature, whose attacks carry no skills modifier
	//   tmpchances     { "Critical": 45, ... } -- each rollable option's skill chance, or absent
	export function buildSituationalView(tmpsituation, tmpresolved, tmpweapons, tmpchances) {
		var tmpkind = tmpsituation?.kind ?? "";
		var tmpselected = tmpsituation?.selected ?? [];
		var tmptotals = tmpresolved ?? resolveSituationalMods(tmpkind, tmpselected, null);
		var tmpoptions = getSituationalOptions(tmpkind);

		// Options in his order, collected under their headings. A heading met a second time (the
		// Visibility rows are split across two lines on his sheet) joins the first.
		var tmpgroups = [];
		var tmpbyheading = {};
		for (const [tmpkey, tmpoption] of Object.entries(tmpoptions)) {
			var tmpgroup = tmpbyheading[tmpoption.heading];
			if (!tmpgroup) {
				tmpgroup = { heading: tmpoption.heading, options: [], asSelect: SELECT_GROUPS.includes(tmpoption.group),
				             selectName: tmpoption.group, selectedKey: "" };
				tmpbyheading[tmpoption.heading] = tmpgroup;
				tmpgroups.push(tmpgroup);
			}
			var tmpchecked = tmpselected.includes(tmpkey);
			if (tmpchecked && tmpgroup.asSelect) { tmpgroup.selectedKey = tmpkey; }
			var tmpchance = tmpoption.skill ? (tmpchances ?? {})[tmpoption.skill] : undefined;
			tmpgroup.options.push({
				key: tmpkey,
				label: tmpoption.label,
				figures: describeSituationalOption(tmpoption, tmpkind),
				checked: tmpchecked,
				// Set only by a roll: the box shows the state but cannot be ticked by hand.
				rollSkill: tmpoption.skill ?? "",
				rollChance: (tmpchance === undefined) ? null : tmpchance,
				rollSet: !!(tmpoption.skill || tmpoption.roll),
				oneOf: !!tmpoption.group,
				closeOnly: !!tmpoption.closeOnly
			});
		}

		var tmpweaponid = tmpsituation?.weaponId ?? "";
		return {
			kind: tmpkind,
			kinds: SITUATION_KINDS.map(k => ({ ...k, selected: k.value == tmpkind })),
			hasPanel: !!tmpkind,
			groups: tmpgroups,
			weapons: (tmpweapons ?? []).map(w => ({ ...w, selected: w.id == tmpweaponid })),
			hasWeapons: (tmpweapons ?? []).length > 0,
			totals: {
				attack: tmptotals.attack,
				damage: tmptotals.damage,
				multi: tmptotals.multi,
				defense: tmptotals.defense,
				noDefense: tmptotals.noDefense,
				noAttack: tmptotals.noAttack,
				special: (tmptotals.special ?? []).map(w => ("" + w).replace("`", "'")),
				multiMissile: tmptotals.multiMissile,
				labels: tmptotals.labels ?? []
			},
			kindWord: tmpkind == "missile" ? "Missile" : "Melee"
		};
	}

	// This is the function which words the standing totals as one line, for the combat tab's bar
	// -- his "For Melee attacks - Melee: +4 Damage: +2 Dam Multiple: 2 Defense: 0".
	export function describeSituationalTotals(tmpresolved) {
		if (!tmpresolved?.kind || !(tmpresolved.labels ?? []).length) { return ""; }
		var tmpword = tmpresolved.kind == "missile" ? "Missile" : "Melee";
		var tmpsigned = (n) => `${n > 0 ? "+" : ""}${n}`;
		var tmpparts = [`For ${tmpword} attacks`];
		tmpparts.push(`${tmpword} ${tmpsigned(tmpresolved.attack)}`);
		tmpparts.push(`Damage ${tmpsigned(tmpresolved.damage)}`);
		if (tmpresolved.multi != 1) { tmpparts.push(`x${tmpresolved.multi} Damage`); }
		tmpparts.push(tmpresolved.noDefense ? "No Defense" : `Defense ${tmpsigned(tmpresolved.defense)}`);
		for (const tmpword2 of tmpresolved.special ?? []) { tmpparts.push(("" + tmpword2).replace("`", "'")); }
		return tmpparts.join(" · ");
	}
// @END (CODE)
