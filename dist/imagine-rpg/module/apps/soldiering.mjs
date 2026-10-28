// @START (CODE)
// @MARKER SOLDIERING WINDOW
//==================================================================================================================
// The Select Soldiering Weapon window: his Updater option "update_soldiering_weapon", stood up as one window.
//
// A character with the social skill Soldiering names ONE weapon that is +1 to hit and +1 damage
// (module/soldiering-rules.mjs). Pick it from the list and press Select. A character without the skill is
// told so and nothing is written, as his roll refuses ("does not have Soldiering as a Social Skill").
//
// Open it from the Updater, or from a macro:
//     game.imagine.soldiering(actor)
//
// Nothing here is a rule; the rules and the view are module/soldiering-rules.mjs.
//==================================================================================================================

import { buildSoldieringView, checkSoldieringChoice } from "../soldiering-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineSoldiering extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "soldiering"],
		window: { title: "Select Soldiering Weapon", resizable: true },
		position: { width: 440, height: "auto" },
		actions: {
			select: ImagineSoldiering.#onSelect,
			clear:  ImagineSoldiering.#onClear,
			done:   ImagineSoldiering.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/soldiering.hbs" }
	};

	#actor = null;

	// One window per actor, keyed by uuid as the Brawling window is.
	static windowId(tmpactor) {
		return `imagine-soldiering-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineSoldiering.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `Soldiering Weapon: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImagineSoldiering.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineSoldiering(tmpactor).render(true);
	}

	// The window follows the actor, so a weapon chosen elsewhere shows here.
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
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpsys = this.#actor.system;
		var tmpowned = this.#actor.items.filter(tmpitem => tmpitem.type == "weapon").map(tmpitem => tmpitem.name);
		// The index of the world's weapons is already in memory on every client.
		var tmppack = game.packs.get("world.imagine-weapons");
		var tmppackNames = tmppack?.index ? Array.from(tmppack.index).map(tmpentry => tmpentry.name) : [];
		tmpcontext.actor = this.#actor;
		Object.assign(tmpcontext, buildSoldieringView(tmpsys.combat.hasSoldiering, tmpsys.combat.soldieringWeapon,
			tmpowned, tmppackNames));
		return tmpcontext;
	}

	// @MARKER WRITING
	static async #onSelect(event, target) {
		event.preventDefault();
		var tmpsys = this.#actor.system;
		var tmpchosen = this.element.querySelector("select[name='weapon']")?.value ?? "";
		var tmpcheck = checkSoldieringChoice(tmpsys.combat.hasSoldiering, tmpsys.combat.soldieringWeapon, tmpchosen, this.#actor.name);
		if (!tmpcheck.ok) { ui.notifications.warn(tmpcheck.message); return; }
		await this.#actor.update({ "system.combat.soldieringWeapon": tmpchosen });
		// His roll prints the replacement or the choice as a chat line.
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.#actor }), content: `<p>${foundry.utils.escapeHTML(tmpcheck.message)}</p>` });
	}

	static async #onClear(event, target) {
		event.preventDefault();
		await this.#actor.update({ "system.combat.soldieringWeapon": "" });
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
