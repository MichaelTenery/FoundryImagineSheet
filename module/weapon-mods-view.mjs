// @START (CODE)
// @MARKER WEAPON MODS VIEW
//==================================================================================================================
// What the weapon mods window shows, worked out with no Foundry dependency so the window can be built
// and checked outside it -- the same split as magic-view.mjs and martial-view.mjs. The window
// (module/apps/weapon-mods.mjs) hands this the actor and the weapon and renders
// templates/apps/weapon-mods.hbs against the result.
//==================================================================================================================

import { WEAPON_CONDITIONS, ITEM_QUALITIES, WEAPON_CUSTOMIZATIONS, MAGIC_PLUS_CHOICES, MAGIC_WEAPON_ABILITIES,
         WEAPON_RUNES, ENERGY_TYPES, DIVINE_WEAPON_ABILITIES } from "./weapon-custom-tables.mjs";
import { checkWeaponCustomization, getWeaponCustomTags, getBlessingModifier, isTemporaryActive,
         TEMPORARY_SPANS, getWeaponDisplayName } from "./weapon-custom-rules.mjs";
import { isEnvenomed, ENVENOMED_DOSES, ENVENOMED_THRESHOLD } from "./lore-rules.mjs";

	// This is the function which says how long is left, in the largest unit that reads well.
	export function formatSpan(tmpseconds) {
		var tmps = Math.max(0, Math.round(tmpseconds));
		if (tmps >= 86400) { return `${Math.round(tmps / 8640) / 10} day(s)`; }
		if (tmps >= 3600) { return `${Math.round(tmps / 360) / 10} hour(s)`; }
		if (tmps >= 60) { return `${Math.round(tmps / 60)} minute(s)`; }
		return `${tmps} second(s)`;
	}

	// This is the function which builds everything the window renders.
	//
	//   tmpactor    the wielder, or anything with system.identity.alignment and a name
	//   tmpweapon   { id, name, system } -- the weapon
	//   tmpnow      the world's time, in seconds
	export function buildWeaponModsView(tmpactor, tmpweapon, tmpnow) {
		var tmpsystem = tmpweapon?.system ?? {};
		var tmpcustom = tmpsystem.custom ?? {};
		var tmpview = {};

		tmpview.weapon = {
			name: getWeaponDisplayName(tmpweapon.name, tmpsystem), baseName: tmpweapon.name,
			type: tmpsystem.type || "not a weapon type", material: tmpsystem.material || "",
			quantity: parseInt(tmpsystem.quantity) || 1, tags: getWeaponCustomTags(tmpsystem, tmpnow)
		};

		// @MARKER FOR NOW
		var tmpbless = getBlessingModifier(tmpactor?.system?.identity?.alignment);
		tmpview.blessNote = `For ${tmpactor?.name ?? "the wielder"} (${tmpactor?.system?.identity?.alignment || "no alignment"}): `
			+ (tmpbless.toHit ? `${tmpbless.toHit > 0 ? "+" : ""}${tmpbless.toHit} to hit, ${tmpbless.damage > 0 ? "+" : ""}${tmpbless.damage} damage.`
			                  : "no effect -- the book gives it to the good and against the evil.");
		tmpview.temporary = (tmpsystem.tempEffects ?? []).map(tmpeffect => {
			var tmpactive = isTemporaryActive(tmpeffect, tmpnow);
			// A blessing carries no figures of its own: what it does is the wielder's alignment's.
			var tmpfigures = tmpeffect.kind == "blessed" ? tmpbless : tmpeffect;
			return {
				...tmpeffect,
				active: tmpactive,
				figures: [tmpfigures.toHit ? `${tmpfigures.toHit > 0 ? "+" : ""}${tmpfigures.toHit} to hit` : "",
				          tmpfigures.damage ? `${tmpfigures.damage > 0 ? "+" : ""}${tmpfigures.damage} damage` : ""].filter(tmpf => tmpf).join(", ")
				         + (tmpeffect.kind == "blessed" ? (tmpbless.toHit ? " (by alignment)" : "none, by alignment") : ""),
				ends: tmpeffect.until ? (tmpactive ? `ends in ${formatSpan(tmpeffect.until - tmpnow)}` : "ended") : "until taken off"
			};
		});
		tmpview.hasExpired = tmpview.temporary.some(tmpeffect => !tmpeffect.active);
		tmpview.spans = TEMPORARY_SPANS;

		// @MARKER POISON COATING
		// A poison on the weapon, put there from the Magic & Lore tab's poison USE and wiped off here.
		// How it is delivered is lore-rules.mjs's (POISON ON A WEAPON).
		var tmpcoat = tmpsystem.coating ?? {};
		var tmpenvenomed = isEnvenomed(tmpsystem);
		tmpview.coating = {
			has: (parseInt(tmpcoat.doses) || 0) > 0,
			name: tmpcoat.name ?? "", form: tmpcoat.form ?? "", doses: parseInt(tmpcoat.doses) || 0,
			envenomed: tmpenvenomed,
			note: tmpenvenomed
				? `Envenomed: the hilt holds up to ${ENVENOMED_DOSES} doses, and a thrust that does ${ENVENOMED_THRESHOLD} or more actual damage delivers one.`
				: "One dose coats it; the first hit that does actual damage delivers it and the coating is spent."
		};

		// @MARKER FOR GOOD
		// What is on it, as chips that can be taken off.
		var tmpchips = [];
		if ((parseInt(tmpsystem.magicBonus) || 0) > 0) { tmpchips.push({ group: "plus", value: "", label: `+${tmpsystem.magicBonus}` }); }
		if (tmpcustom.blessed) { tmpchips.push({ group: "blessed", value: "", label: "Blessed (permanent)" }); }
		for (const tmpa of tmpcustom.magicAbilities ?? []) { tmpchips.push({ group: "magicAbilities", value: tmpa, label: tmpa }); }
		for (const tmpr of tmpcustom.runes ?? []) { tmpchips.push({ group: "runes", value: tmpr.name, label: `Rune of ${tmpr.name} ${tmpr.level}` }); }
		if (tmpcustom.energyType) { tmpchips.push({ group: "energy", value: "", label: `${tmpcustom.energyDice} dice ${tmpcustom.energyType}` }); }
		for (const tmpa of tmpcustom.divineAbilities ?? []) { tmpchips.push({ group: "divineAbilities", value: tmpa, label: tmpa }); }
		for (const tmpc of tmpcustom.customizations ?? []) { tmpchips.push({ group: "customizations", value: tmpc, label: tmpc }); }
		for (const tmpe of tmpcustom.magicalEffects ?? []) { tmpchips.push({ group: "magicalEffects", value: tmpe, label: tmpe }); }
		for (const tmpe of tmpcustom.divineEffects ?? []) { tmpchips.push({ group: "divineEffects", value: tmpe, label: tmpe }); }
		tmpview.chips = tmpchips;
		tmpview.custom = {
			prefix: tmpcustom.prefix ?? "", suffix: tmpcustom.suffix ?? "",
			baseAura: tmpcustom.baseAura || "", basePiety: tmpcustom.basePiety || "",
			auraSet: (parseInt(tmpcustom.baseAura) || 0) > 0, pietySet: (parseInt(tmpcustom.basePiety) || 0) > 0
		};

		// His selects. A customization this weapon cannot take is listed and disabled, with his reason.
		var tmpoption = ([tmpvalue, tmplabel]) => ({ value: tmpvalue, label: tmplabel });
		tmpview.options = {
			conditions: WEAPON_CONDITIONS.map(tmpoption), qualities: ITEM_QUALITIES.map(tmpoption),
			plus: MAGIC_PLUS_CHOICES.map(tmpoption), magic: MAGIC_WEAPON_ABILITIES.map(tmpoption),
			runes: WEAPON_RUNES.map(tmpoption), energy: ENERGY_TYPES.map(tmpoption),
			divine: DIVINE_WEAPON_ABILITIES.map(tmpoption),
			energyDice: Array.from({ length: 10 }, (tmpu, tmpi) => tmpi + 1),
			customizations: WEAPON_CUSTOMIZATIONS.map(([tmpvalue, tmplabel]) => {
				var tmpcheck = checkWeaponCustomization(tmpweapon, tmpvalue);
				return { value: tmpvalue, label: tmplabel, disabled: !tmpcheck.ok, reason: tmpcheck.reason };
			})
		};
		return tmpview;
	}

// @MARKER ADD NEW weapon mods view functions HERE
// @END (CODE)
