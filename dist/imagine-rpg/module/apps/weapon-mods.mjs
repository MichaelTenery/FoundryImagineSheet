// @START (CODE)
// @MARKER WEAPON MODS WINDOW
//==================================================================================================================
// The window a weapon row's wand button opens: what is on this weapon for now, and what has been done
// to it for good.
//
//     FOR NOW     temporary effects -- Bless (Player's Guide, Holy Weapon: a day), or the Game
//                 Master's own with a to-hit, a damage and how long it lasts. Each one ends by the
//                 world's clock or is taken off here. And a poison coating, shown and wiped off
//                 here; it is put on from the Magic & Lore tab's poison Use, where the dose is.
//     FOR GOOD    his Equipment tab's CUSTOMIZE ITEMS panel, the weapon half: condition, quality,
//                 prefix and suffix, the magical plus (or Blessed), base Aura and Piety Control,
//                 magical and divine abilities, runes, energy, physical customizations, any spell or
//                 invocation imbued, and the weight. Applied to this weapon, or -- how his table got
//                 by without temporary effects -- to a customized copy of it, split off a stack as his
//                 panel's "No#" does.
//
// The rules are all in module/weapon-custom-rules.mjs; this is only their face.
//==================================================================================================================

import { applySheetTheme } from "../sheet-theme.mjs";
import { applyWeaponCustomization, removeWeaponCustomization, isTemporaryActive, makeTemporaryEffect,
         TEMPORARY_PRESETS, TEMPORARY_SPANS } from "../weapon-custom-rules.mjs";
import { buildWeaponModsView } from "../weapon-mods-view.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineWeaponMods extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		classes: ["imagine", "weapon-mods"],
		tag: "form",
		window: { title: "Imagine RPG — Weapon mods", resizable: true },
		position: { width: 640, height: 760 },
		form: { submitOnChange: false, closeOnSubmit: false },
		actions: {
			addBless:        ImagineWeaponMods.#onAddBless,
			addTemporary:    ImagineWeaponMods.#onAddTemporary,
			removeTemporary: ImagineWeaponMods.#onRemoveTemporary,
			clearExpired:    ImagineWeaponMods.#onClearExpired,
			wipeCoating:     ImagineWeaponMods.#onWipeCoating,
			customize:       ImagineWeaponMods.#onCustomize,
			removeCustom:    ImagineWeaponMods.#onRemoveCustom
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/weapon-mods.hbs", scrollable: [".weapon-mods-body"] }
	};

	#actor = null;
	#weapon = null;

	constructor(tmpactor, tmpweapon, tmpoptions) {
		super(foundry.utils.mergeObject({ id: `imagine-weapon-mods-${tmpweapon?.id ?? "x"}` }, tmpoptions ?? {}));
		this.#actor = tmpactor;
		this.#weapon = tmpweapon;
	}

	get title() {
		return `Weapon mods — ${this.#weapon?.name ?? ""}`;
	}

	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
	}

	// This is the function which builds what the window shows -- all of it in module/weapon-mods-view.mjs.
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		return Object.assign(tmpcontext, buildWeaponModsView(this.#actor, this.#weapon, game.time?.worldTime ?? 0));
	}

	// @MARKER FOR NOW
	// This is the function which reads the window's form.
	#readForm() {
		return foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
	}

	static async #onAddBless(event, target) {
		event.preventDefault();
		var tmpeffects = [...(this.#weapon.system.tempEffects ?? [])];
		if (tmpeffects.some(tmpe => tmpe.kind == "blessed" && isTemporaryActive(tmpe, game.time.worldTime))) {
			ui.notifications.info(`${this.#weapon.name} is already blessed.`);
			return;
		}
		var tmppreset = TEMPORARY_PRESETS.blessed;
		tmpeffects.push(makeTemporaryEffect({ name: tmppreset.name, kind: "blessed", seconds: tmppreset.seconds,
			lasts: tmppreset.lasts, notes: tmppreset.notes }, game.time.worldTime));
		await this.#weapon.update({ "system.tempEffects": tmpeffects });
		this.render();
	}

	static async #onAddTemporary(event, target) {
		event.preventDefault();
		var tmpform = this.#readForm().temporary ?? {};
		if (!("" + (tmpform.name ?? "")).trim()) { ui.notifications.warn("Give the effect a name."); return; }
		var tmpspan = TEMPORARY_SPANS.find(tmps => "" + tmps.seconds == "" + tmpform.span) ?? TEMPORARY_SPANS[0];
		var tmpeffects = [...(this.#weapon.system.tempEffects ?? [])];
		tmpeffects.push(makeTemporaryEffect({ name: tmpform.name, kind: "custom", toHit: tmpform.toHit, damage: tmpform.damage,
			notes: tmpform.notes, seconds: tmpspan.seconds, lasts: tmpspan.label }, game.time.worldTime));
		await this.#weapon.update({ "system.tempEffects": tmpeffects });
		this.render();
	}

	static async #onRemoveTemporary(event, target) {
		event.preventDefault();
		var tmpeffects = (this.#weapon.system.tempEffects ?? []).filter(tmpe => tmpe.id != target.dataset.id);
		await this.#weapon.update({ "system.tempEffects": tmpeffects });
		this.render();
	}

	static async #onClearExpired(event, target) {
		event.preventDefault();
		var tmpeffects = (this.#weapon.system.tempEffects ?? []).filter(tmpe => isTemporaryActive(tmpe, game.time.worldTime));
		await this.#weapon.update({ "system.tempEffects": tmpeffects });
		this.render();
	}

	// This is the function which wipes a poison coating off -- the doses in it are lost, not returned.
	static async #onWipeCoating(event, target) {
		event.preventDefault();
		await this.#weapon.update({ "system.coating": { name: "", poisonType: "", poisonPotency: "", form: "", doses: 0 } });
		this.render();
	}

	// @MARKER FOR GOOD
	// This is the function behind his CUSTOMIZE button: lay what was chosen over the weapon, or over
	// a copy of it. A copy is split off the stack when there is more than one ("No#" on his panel),
	// and is a second weapon beside the first when there is only one -- which is the table's own way
	// of carrying a weapon blessed or oiled for one fight.
	static async #onCustomize(event, target) {
		event.preventDefault();
		var tmpform = this.#readForm().custom ?? {};
		// The stored data, not the live model: the rules copy what they are given.
		var tmpresult = applyWeaponCustomization({ name: this.#weapon.name, system: this.#weapon.system.toObject() }, tmpform);
		for (const tmpissue of tmpresult.issues) { ui.notifications.warn(tmpissue); }

		var tmpcopy = tmpform.target == "copy";
		if (!tmpcopy) {
			await this.#weapon.update({ system: tmpresult.system });
			ui.notifications.info(`${this.#weapon.name} is customized.`);
			this.render();
			return;
		}
		var tmphave = parseInt(this.#weapon.system.quantity) || 1;
		var tmpcount = Math.max(1, Math.min(tmphave, parseInt(tmpform.count) || 1));
		var tmpdata = this.#weapon.toObject();
		delete tmpdata._id;
		tmpdata.system = { ...tmpresult.system, quantity: tmpcount, location: "carried" };
		if (!("" + (tmpform.suffix ?? "")).trim() && !("" + (tmpform.prefix ?? "")).trim()) {
			tmpdata.system.custom = { ...tmpdata.system.custom, suffix: tmpdata.system.custom?.suffix || "(customized)" };
		}
		var tmpcreated = await this.#actor.createEmbeddedDocuments("Item", [tmpdata]);
		if (tmphave > tmpcount) { await this.#weapon.update({ "system.quantity": tmphave - tmpcount }); }
		ui.notifications.info(`A customized ${this.#weapon.name} is added to ${this.#actor.name}, carried.`);
		if (tmpcreated?.length) {
			this.#weapon = tmpcreated[0];
			this.render({ window: { title: this.title } });
		}
	}

	static async #onRemoveCustom(event, target) {
		event.preventDefault();
		var tmpsystem = removeWeaponCustomization(this.#weapon.system.toObject(),
			{ group: target.dataset.group, value: target.dataset.value });
		await this.#weapon.update({ system: tmpsystem });
		this.render();
	}
}

// @END (CODE)
