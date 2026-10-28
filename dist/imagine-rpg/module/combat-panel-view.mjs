// @START (CODE)
// @MARKER COMBAT PANEL VIEW
//==================================================================================================================
// His COMBAT panel on the Combat tab (ImagineTabbedCharacterSheet.html:8030-8380): the attack skill and
// Lore attack skill bars, the two dartboard attack charts, the Combat Modifiers table, the Specific Combat
// Modifiers list and the weapon proficiency bar. "Allow visualization of attack charts and base modifiers in
// combat" -- bug report 0.25.1:8, 2026-10-27.
//
// A pure view over the character's derived data: nothing here is worked out afresh, so the figures are the
// ones every attack and every roll reads, temporary modifiers included (they are written to the same
// tempMod / misc fields the derivation already reads). It builds what the template shows and the test
// renders the same template against the same view, as the Brawling and Situation Mods windows do.
//
// HOW THE TABLE IS SPLIT. His columns are STR, AGL, INT, Weight, Armor, Other and then Total. The port's
// derivation keeps each figure whole, so the split is read back from the parts it is built from: the
// attribute table rows (system.attributes.*.mods), the armour's share (system.combat.armor*), and the
// Game Master's misc fields (system.combat.*Misc), fatigue and the Weapon Speed box (system.combat.fatigue,
// the Temporary Modifiers window) and the race's eyes, tendrils and metabolism (system.combat.racialCombat) for
// "Other" -- his combat_mod_*_other, which held his temporary modifiers and the racial figures alike
// (setCombatModifierValues, sheet-worker.js:82285-82380). Weight is the signed body-weight term on melee damage
// (system.combat.weightDamage), "-" at 0 as his combat_mod_dam_weight is. Each row's Total is the same sum of the
// same parts, and the test checks that it equals the figure the derivation holds. ONE THING IS NOT SHOWN:
//     Off Hand Defensive / Weapon Speed -- his panel prints them, the port has no off-hand figure for either.
//==================================================================================================================

import { ATTACK_CHARTS } from "./combat-tables.mjs";
import { getOffhandPenalty, getSimplifiedName, parseLoreList, LORE_GENERAL, LORE_SPECIFIC,
         resolveOffhandPenalties } from "./combat/combat-rules.mjs";
import { describeSoldiering } from "./soldiering-rules.mjs";

	// This is the function which writes a figure the way his panel does: the number, "-" where the column
	// does not apply to the row. A zero in a column that does apply is a zero.
	function tmpShow(tmpvalue, tmpsuffix = "") {
		if (tmpvalue === null || tmpvalue === undefined) { return "-"; }
		return `${tmpvalue}${tmpsuffix}`;
	}

	// This is the function which lays one chart out as the rings of his board, from the table row
	// "MissHigh HitHigh MissLeft HitLeft HitCenter HitRight MissRight HitLow MissLow MissShort Called".
	// A skill the chart does not have ("None", or no Lore chart yet) gives every box "-", as his does.
	export function buildAttackBoard(tmpskill) {
		var tmprow = ATTACK_CHARTS[tmpskill] ?? ATTACK_CHARTS["None"];
		return {
			skill: ATTACK_CHARTS[tmpskill] ? tmpskill : "None",
			missHigh: tmprow[0], hitHigh: tmprow[1], missLeft: tmprow[2], hitLeft: tmprow[3], hitCenter: tmprow[4],
			hitRight: tmprow[5], missRight: tmprow[6], hitLow: tmprow[7], missLow: tmprow[8], missShort: tmprow[9],
			called: tmprow[10]
		};
	}

	// This is the function which builds one row of the modifiers table. tmpcolumns holds the six source
	// columns in his order (STR, AGL, INT, Weight, Armor, Other); null is "-".
	function tmpRow(tmplabel, tmpcolumns, tmptotal, tmpoffhand, tmpsuffix = "") {
		var tmpnames = ["str", "agl", "int", "weight", "armor", "other"];
		var tmprow = { label: tmplabel, total: tmpShow(tmptotal, tmpsuffix), offhand: tmpShow(tmpoffhand, tmpsuffix) };
		tmpnames.forEach((tmpname, tmpindex) => { tmprow[tmpname] = tmpShow(tmpcolumns[tmpindex], tmpsuffix); });
		return tmprow;
	}

	// This is the function which writes the Specific Combat Modifiers list, his general_combat_modifiers
	// (setGeneralCombatModifierDisplay, sheet-worker.js:82451-82777), in his order and his words: Soldiering;
	// the race's eyes, blindness, sense tendrils and metabolism; Weapon and Missile Lore, general then each
	// weapon named; Second Weapon Knowledge and Lore, a line per weapon named; Projectile Lore, general then
	// each projectile; and the multiple-missile combinations. A character holding none of these reads "None".
	//
	// tmpsystem is optional (the tests pass combat alone): it gives the Agility and handedness the Second Weapon
	// Knowledge figures are worked out from.
	//
	// NOT LISTED, because the port keeps nothing to list: Projectile KNOWLEDGE (his proj_know_list, "(Medium
	// Range): +N%") -- the port has no projectile-knowledge list yet; it is one of the Updater's not-built rows.
	export function buildSpecificModifiers(tmpcombat, tmpsystem = {}) {
		var tmplines = [];
		if (tmpcombat.hasSoldiering) { tmplines.push(describeSoldiering(tmpcombat.soldieringWeapon)); }

		// The race's own (82491-82545), worked out in module/combat/racial-combat-rules.mjs.
		for (const tmpline of tmpcombat.racialCombat?.lines ?? []) { tmplines.push(tmpline); }

		// His words: "Weapon Lore[All Melee Weapons](Melee)" and "Missile Lore[All Missile Weapons](Missile)".
		var tmplore = (tmpskill, tmpkind, tmpheld, tmpnames) => {
			if (!tmpheld) { return; }
			var tmpfigures = (tmpv) => `(${tmpkind}):+${tmpv.attack} (Damage):+${tmpv.damage} (Weapon Speed):${tmpv.speed} (Skills):+${tmpv.skills}%`;
			tmplines.push(`${tmpskill}[All ${tmpkind} Weapons]${tmpfigures(LORE_GENERAL)}`);
			for (const tmpname of tmpnames ?? []) {
				tmplines.push(`${tmpskill}[${getSimplifiedName(tmpname)}]${tmpfigures(LORE_SPECIFIC)}`);
			}
		};
		tmplore("Weapon Lore", "Melee", tmpcombat.hasWeaponLore, tmpcombat.weaponLoreNames ?? parseLoreList(tmpcombat.weaponLoreList));
		tmplore("Missile Lore", "Missile", tmpcombat.hasMissileLore, tmpcombat.missileLoreNames ?? parseLoreList(tmpcombat.missileLoreList));

		// Second Weapon Knowledge (82612-82645): what the off hand pays with the skill, per weapon named. His
		// offhand_2nd_weapon_tohit/_damage/_skills are the off-hand penalties at the Knowledge tier, which is what
		// resolveOffhandPenalties gives for a weapon in the off hand flagged for it.
		var tmphanded = tmpsystem.physical?.handedness;
		var tmpagility = tmpsystem.attributes?.agl?.value ?? tmpsystem.attributes?.agl?.rating;
		if (tmpcombat.hasSecondWeaponKnowledge) {
			var tmpknow = resolveOffhandPenalties({ hand: tmphanded == "Left" ? "right" : "left", secondWeaponKnowledge: true },
				tmpagility, tmphanded, tmpcombat.secondWeaponKnowChance);
			for (const tmpname of tmpcombat.secondWeaponKnowNames ?? parseLoreList(tmpcombat.secondWeaponKnowList)) {
				tmplines.push(`2nd Weapon Know[${tmpname}](Offhand Melee):${tmpknow.melee} (Offhand Missile):${tmpknow.melee} (Offhand Damage):${tmpknow.damage} (Offhand Skills):${tmpknow.skill}%`);
			}
		}
		// Second Weapon Lore (82648-82683): no off-hand penalty at all, and an extra second of off-hand time for
		// every 20% of the skill, five at most, none for the Ambidextrous (his offhand_2nd_lore_seconds, 83239-83250).
		if (tmpcombat.hasSecondWeaponLore) {
			var tmpseconds = (tmphanded == "Ambidextrous") ? 0
				: Math.min(5, Math.floor((parseInt(tmpcombat.secondWeaponLoreChance) || 0) / 20));
			for (const tmpname of tmpcombat.secondWeaponLoreNames ?? parseLoreList(tmpcombat.secondWeaponLoreList)) {
				tmplines.push(`2nd Weapon Lore[${tmpname}](Offhand Seconds): +${tmpseconds} (Offhand Melee):0 (Offhand Missile):0 (Offhand Damage):0 (Offhand Skills):0%`);
			}
		}

		// Projectile Lore (82705-82724): +1 per die on every projectile, +2 on each one named.
		if (tmpcombat.hasProjectileLore) {
			tmplines.push("Projectile Lore[All Projectiles](Damage):+1 per die");
			for (const tmpname of tmpcombat.projectileLoreNames ?? parseLoreList(tmpcombat.projectileLoreList)) {
				tmplines.push(`Projectile Lore[${tmpname}](Damage):+2 per die`);
			}
		}

		// The multiple-missile combinations (82737-82771). Knowledge pays back a point to hit and two of damage for
		// every 25% of the skill; Lore's line is his "+0 / +0", since its benefit is in the shot count, not a figure.
		var tmpcombos = (tmplist) => ("" + (tmplist ?? "")).split(",").map(tmpentry => tmpentry.trim()).filter(Boolean);
		var tmpmmlevels = Math.floor((parseInt(tmpcombat.multiMissileKnowChance) || 0) / 25);
		for (const tmpcombo of tmpcombos(tmpcombat.multiMissileKnowList)) {
			tmplines.push(`Multiple Missile Knowledge[${tmpcombo}](Missile):+${tmpmmlevels} (Damage):+${tmpmmlevels * 2}`);
		}
		if (tmpcombat.hasMultiMissileLore) {
			for (const tmpcombo of tmpcombos(tmpcombat.multiMissileLoreList)) {
				tmplines.push(`Multiple Missile Lore[${tmpcombo}](Missile):+0 (Damage):+0`);
			}
		}
		return tmplines;
	}

	// This is the function which builds everything the Combat panel shows. tmpsystem is the character's
	// derived system data; tmpweaponKnowledge is the chance of the skill Weapon Knowledge, or null when the
	// character does not hold it.
	export function buildCombatPanelView(tmpsystem, tmpweaponKnowledge = null) {
		var tmpcombat = tmpsystem.combat ?? {};
		var tmpattr = tmpsystem.attributes ?? {};
		var tmpnum = (tmpvalue) => parseInt(tmpvalue) || 0;
		var tmphanded = tmpsystem.physical?.handedness;
		// The off hand reads the CURRENT Agility, temporary and magical modifiers included, as the attack does:
		// his setCombatModifierValues reads values.agility, the attribute as it stands (sheet-worker.js:82176).
		var tmpagility = tmpnum(tmpattr.agl?.value ?? tmpattr.agl?.rating);
		var tmpoffMelee = getOffhandPenalty("melee", tmpagility, tmphanded);
		var tmpoffDamage = getOffhandPenalty("damage", tmpagility, tmphanded);
		var tmpoffSkill = getOffhandPenalty("skill", tmpagility, tmphanded);

		var tmpstr = tmpattr.str?.mods ?? {}, tmpagl = tmpattr.agl?.mods ?? {}, tmpint = tmpattr.int?.mods ?? {};

		// "Other", row by row: the Game Master's misc field, what fatigue and the Temporary Modifiers' boxes take
		// off (combat.fatigue), and the race's own (combat.racialCombat). Melee and missile fatigue and race are
		// already inside meleeAttack / missileAttack, so the attribute columns read the attribute's own table row
		// rather than those figures, and the parts still add up to the Total.
		var tmpfatigue = tmpcombat.fatigue ?? {};
		var tmpracial = tmpcombat.racialCombat ?? {};
		var tmpweight = tmpnum(tmpcombat.weightDamage);
		var tmpdamageOther = tmpnum(tmpcombat.damageMisc) + tmpnum(tmpfatigue.damage) + tmpnum(tmpracial.damage);
		var tmpmeleeOther = tmpnum(tmpcombat.meleeMisc) + tmpnum(tmpfatigue.melee) + tmpnum(tmpracial.melee);
		var tmpmissileOther = tmpnum(tmpcombat.missileMisc) + tmpnum(tmpfatigue.missile) + tmpnum(tmpracial.missile);
		// tempSkillMod is fatigue's and the Skills box's together; without it (a view built without the
		// Temporary Modifiers' derivation) the misc field alone.
		var tmpskillOther = (tmpcombat.tempSkillMod !== undefined) ? tmpnum(tmpcombat.tempSkillMod) : tmpnum(tmpcombat.skillMisc);

		var tmprows = [
			// Damage: STR, Weight (signed, melee only -- "-" when it is nothing, as his), Other.
			tmpRow("Damage", [tmpnum(tmpcombat.meleeDamage), null, null, tmpweight == 0 ? null : tmpweight, null, tmpdamageOther],
				tmpnum(tmpcombat.meleeDamage) + tmpweight + tmpdamageOther, tmpoffDamage),
			// Defensive: AGL, Armor, Other. The total is what the character's defence stands at.
			tmpRow("Defensive", [null, tmpnum(tmpagl.defensiveAdjust), null, null, tmpnum(tmpcombat.armorDefense),
				tmpnum(tmpcombat.defenseMisc) + tmpnum(tmpracial.defense)], tmpnum(tmpcombat.defensiveAdjust), null),
			tmpRow("Melee", [tmpnum(tmpstr.meleeAttack), null, null, null, null, tmpmeleeOther],
				tmpnum(tmpcombat.meleeAttack) + tmpnum(tmpcombat.meleeMisc), tmpoffMelee),
			tmpRow("Missile", [null, tmpnum(tmpagl.missileAttack), null, null, null, tmpmissileOther],
				tmpnum(tmpcombat.missileAttack) + tmpnum(tmpcombat.missileMisc), tmpoffMelee),
			tmpRow("Initiative", [null, tmpnum(tmpagl.initiativeAdjust), tmpnum(tmpint.initiativeAdjust), null,
				tmpnum(tmpcombat.armorInitiative), tmpnum(tmpcombat.initiativeMisc) + tmpnum(tmpracial.initiative)],
				tmpnum(tmpcombat.initiativeMod), null),
			tmpRow("Weapon Speed", [tmpnum(tmpstr.weaponSpeed), tmpnum(tmpagl.weaponSpeed), null, null, tmpnum(tmpcombat.armorSpeed),
				tmpnum(tmpfatigue.weaponSpeed)], tmpnum(tmpcombat.weaponSpeedMod), null),
			tmpRow("Skills", [null, null, null, null, tmpnum(tmpcombat.armorSkillPenalty), tmpskillOther],
				tmpnum(tmpcombat.armorSkillPenalty) + tmpskillOther, tmpoffSkill, "%")
		];

		// The Specific list; one line per entry, or "None" as his does.
		var tmpspecific = buildSpecificModifiers(tmpcombat, tmpsystem);

		// Weapon proficiencies: his setWeaponProfTotals (sheet-worker.js:83369) -- a tenth of Weapon Knowledge's
		// chance, whole; Used is how many are on his weapon_prof_list (combat.weaponProfList, set from the
		// Updater's Add Weapon Proficiency), and Available what is left. All three are derived on the actor
		// (getWeaponProfTotals, module/weapon-choices-rules.mjs); the total is worked here too for a system
		// prepared before those fields existed.
		var tmpproftotal = tmpweaponKnowledge === null ? 0 : Math.floor(tmpnum(tmpweaponKnowledge) / 10);
		var tmpprofused = tmpnum(tmpcombat.weaponProfUsed);
		var tmpprofs = { held: tmpweaponKnowledge !== null, total: tmpproftotal, used: tmpprofused,
			available: tmpproftotal - tmpprofused, list: ("" + (tmpcombat.weaponProfList ?? "")).split(",").map(tmpn => tmpn.trim()).filter(Boolean).join(", ") };

		return {
			attackSkill: tmpcombat.attackSkill || "None",
			loreAttackSkill: tmpcombat.loreAttackSkill || "None",
			board: buildAttackBoard(tmpcombat.attackSkill),
			loreBoard: buildAttackBoard(tmpcombat.loreAttackSkill),
			// The two boards as a list, for the template to draw each the same way: his left board is the
			// character's attack chart, his right is the Lore attack chart (it reads "-" until Lore is reached).
			boards: [
				{ title: "Attack chart", ...buildAttackBoard(tmpcombat.attackSkill) },
				{ title: "Lore attack chart", ...buildAttackBoard(tmpcombat.loreAttackSkill) }
			],
			rows: tmprows,
			specific: tmpspecific,
			specificNone: tmpspecific.length == 0,
			profs: tmpprofs
		};
	}

// @MARKER PARTIAL
// The partial the character's Combat tab includes, loaded the way the body figure's is (loadBodyTemplates in
// module/body-view.mjs): once, awaited by the sheet before it renders. Foundry-bound, but only when called,
// so the tests above still import this file cleanly.
const COMBAT_PANEL_PARTIALS = {
	"imagine-combat-panel": "systems/imagine-rpg/templates/actor/combat-panel.hbs"
};
var tmpCombatPanelTemplatesReady = null;

	// This is the function which loads the panel's partial, once.
	export function loadCombatPanelTemplates() {
		if (!tmpCombatPanelTemplatesReady) {
			tmpCombatPanelTemplatesReady = foundry.applications.handlebars.loadTemplates(COMBAT_PANEL_PARTIALS);
		}
		return tmpCombatPanelTemplatesReady;
	}

// @MARKER ADD NEW combat panel functions HERE
// @END (CODE)
