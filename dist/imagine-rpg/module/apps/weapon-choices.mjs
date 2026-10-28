// @START (CODE)
// @MARKER WEAPON CHOICES WINDOW
//==================================================================================================================
// The Weapon Choices window: seven of his Updater options in one window -- Add Weapon Proficiency, and the
// weapons (or projectiles) named for Weapon Lore, Missile Lore, Second Weapon Knowledge, Second Weapon Lore,
// Projectile Knowledge and Projectile Lore. Pick which at the top; pick the weapon; Add rolls, as his ADD
// button did, and the result goes to chat. A Game Master may also take a name off a list.
//
// Open it from the Updater, or from a macro:
//     game.imagine.weaponChoices(actor, kind)
// where kind is "proficiency", "weaponLore", "missileLore", "secondKnow", "secondLore", "projectileKnow"
// or "projectileLore".
//
// CHARACTERS ONLY. A creature fights with its own attack items, which read no weapon lists, so nothing it
// named here would ever be used (module/combat/creature-rules.mjs: "no proficiency to lack").
//
// Nothing here is a rule; the rules are module/weapon-choices-rules.mjs and the view
// module/weapon-choices-view.mjs.
//==================================================================================================================

import { resolveWeaponChoice, getWeaponChoiceKind, getChoiceStanding } from "../weapon-choices-rules.mjs";
import { buildWeaponChoicesView, getWeaponChoiceFacts } from "../weapon-choices-view.mjs";
import { parseLoreList } from "../combat/combat-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineWeaponChoices extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "weapon-choices"],
		window: { title: "Weapon Choices", resizable: true },
		position: { width: 480, height: "auto" },
		actions: {
			add:        ImagineWeaponChoices.#onAdd,
			addInitial: ImagineWeaponChoices.#onAddInitial,
			remove:     ImagineWeaponChoices.#onRemove,
			done:       ImagineWeaponChoices.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/weapon-choices.hbs" }
	};

	#actor = null;
	#kind = "proficiency";
	// The weapon in the dropdown, kept across the re-render an actor update causes.
	#selected = "";
	// The compendium's weapons with what each can do, read once per window.
	#packWeapons = null;

	// One window per actor, keyed by uuid as the other windows are; the kind is the window's own choice.
	static windowId(tmpactor) {
		return `imagine-weapon-choices-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpkind, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineWeaponChoices.windowId(tmpactor) });
		this.#actor = tmpactor;
		if (getWeaponChoiceKind(tmpkind)) { this.#kind = tmpkind; }
	}

	get title() {
		return `Weapon Choices: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window on the kind asked for, or brings it forward and
	// switches it.
	static open(tmpactor, tmpkind = "proficiency") {
		if (tmpactor?.type != "character") {
			ui.notifications.warn("Weapon proficiencies and lore weapons are kept for characters; a creature's attacks read none of them.");
			return null;
		}
		var tmpexisting = foundry.applications.instances.get(ImagineWeaponChoices.windowId(tmpactor));
		if (tmpexisting) {
			tmpexisting.setKind(tmpkind);
			tmpexisting.bringToFront();
			return tmpexisting;
		}
		return new ImagineWeaponChoices(tmpactor, tmpkind).render(true);
	}

	setKind(tmpkind) {
		if (!getWeaponChoiceKind(tmpkind) || tmpkind == this.#kind) { return; }
		this.#kind = tmpkind;
		this.#selected = "";
		this.render();
	}

	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		this.#actor.apps[this.id] = this;
	}

	_onClose(options) {
		super._onClose?.(options);
		delete this.#actor.apps[this.id];
	}

	// @MARKER SHEET THEME
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
		// Dropdowns change rather than click, so they are bound here.
		this.element.querySelector("select[name='kind']")
			?.addEventListener("change", (event) => this.setKind(event.target.value));
		this.element.querySelector("select[name='weapon']")
			?.addEventListener("change", (event) => { this.#selected = event.target.value; });
	}

	// This is the function which reads the world's weapons once, with whether each can be swung or thrown --
	// what the Weapon and Missile Lore dropdowns divide on.
	async #getPackWeapons() {
		if (this.#packWeapons) { return this.#packWeapons; }
		var tmppack = game.packs.get("world.imagine-weapons");
		var tmpindex = tmppack ? await tmppack.getIndex({ fields: [ "system.missile.available", "system.thrust.available",
			"system.cut.available", "system.smash.available" ] }) : [];
		this.#packWeapons = Array.from(tmpindex).map(tmpentry => ImagineWeaponChoices.#describe(tmpentry));
		return this.#packWeapons;
	}

	static #describe(tmpdoc) {
		var tmps = tmpdoc?.system ?? {};
		return { name: tmpdoc?.name ?? "",
			melee: !!(tmps.thrust?.available || tmps.cut?.available || tmps.smash?.available),
			missile: !!tmps.missile?.available };
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpowned = this.#actor.items.filter(tmpitem => tmpitem.type == "weapon").map(tmpitem => ImagineWeaponChoices.#describe(tmpitem));
		var tmpweapons = tmpowned.concat(await this.#getPackWeapons());
		tmpcontext.actor = this.#actor;
		tmpcontext.isGM = !!game.user?.isGM;
		Object.assign(tmpcontext, buildWeaponChoicesView(this.#kind, getWeaponChoiceFacts(this.#actor.system, this.#kind),
			tmpweapons, this.#selected, this.#actor.name));
		return tmpcontext;
	}

	// @MARKER THE ROLL
	// His ADD: the roll (or the automatic first), his refusals, the chat line, and the list written on a success.
	async #attempt(tmpinitial) {
		var tmpk = getWeaponChoiceKind(this.#kind);
		var tmpfacts = getWeaponChoiceFacts(this.#actor.system, this.#kind);
		var tmpname = this.element.querySelector("select[name='weapon']")?.value ?? "";
		var tmpdescribed = (await this.#getPackWeapons()).concat(this.#actor.items.filter(tmpitem => tmpitem.type == "weapon")
			.map(tmpitem => ImagineWeaponChoices.#describe(tmpitem))).find(tmpw => tmpw.name == tmpname);
		var tmpd100 = () => Math.ceil(CONFIG.Dice.randomUniform() * 100) || 1;
		var tmpresult = resolveWeaponChoice({
			kind: this.#kind, name: tmpname, characterName: this.#actor.name,
			list: tmpfacts.list, profList: tmpfacts.profList, chance: tmpfacts.chance, slots: tmpfacts.slots,
			standing: getChoiceStanding(this.#kind, tmpfacts),
			initial: !!tmpinitial, available: tmpfacts.profAvailable,
			isMelee: tmpdescribed?.melee ?? true, isMissile: tmpdescribed?.missile ?? false,
			weaponLoreChance: tmpfacts.weaponLoreChance, missileLoreChance: tmpfacts.missileLoreChance,
			roll: tmpd100(), roll2: tmpd100(), roll3: tmpd100()
		});
		if (!tmpresult.ok) { ui.notifications.warn(tmpresult.message); return; }
		if (tmpresult.newList !== null) {
			await this.#actor.update({ [`system.combat.${tmpk.listField}`]: tmpresult.newList });
			this.#selected = "";
		}
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
			content: `<p><strong>${foundry.utils.escapeHTML(tmpk.label)}</strong></p><p>${foundry.utils.escapeHTML(tmpresult.message)}</p>` });
	}

	static async #onAdd(event, target) {
		event.preventDefault();
		await this.#attempt(false);
	}

	static async #onAddInitial(event, target) {
		event.preventDefault();
		// His initial panel exists only while experience is 0; refuse it otherwise, as his sheet hides it.
		if ((parseInt(this.#actor.system.identity?.exp) || 0) > 0) {
			ui.notifications.warn("An initial proficiency is taken before the character has any experience.");
			return;
		}
		await this.#attempt(true);
	}

	// A Game Master's correction: one name off the list shown. Not his -- his lists had no remove -- but a
	// wrong pick otherwise stays for good.
	static async #onRemove(event, target) {
		event.preventDefault();
		if (!game.user?.isGM) { return; }
		var tmpk = getWeaponChoiceKind(this.#kind);
		var tmpname = this.element.querySelector("select[name='remove']")?.value ?? "";
		if (!tmpname) { return; }
		var tmplist = parseLoreList(this.#actor.system.combat?.[tmpk.listField]).filter(tmpn => tmpn != tmpname);
		await this.#actor.update({ [`system.combat.${tmpk.listField}`]: tmplist.join(",") });
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
