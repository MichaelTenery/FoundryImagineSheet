// @START (CODE)
// @MARKER UPDATER WINDOW
//==================================================================================================================
// The Character Updater window: his "What do you want to do?" dropdown, which every change to a made
// character went through. Pick the action; it opens that action's window, does the small ones here, or
// says where on the sheet the thing already is. The list and the reasons an action is closed are in
// module/updater-rules.mjs, which needs no Foundry.
//
// Open it from the Updater button on the character sheet, or from a macro:
//     game.imagine.updater(actor)
//==================================================================================================================

import { buildUpdaterChoices, resolveGmeAttackChange, GME_ATTACK_SKILLS } from "../updater-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineUpdater extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "updater"],
		window: { title: "Character Updater", resizable: true },
		position: { width: 520, height: "auto" },
		actions: {
			openAction:  ImagineUpdater.#onOpenAction,
			changeGme:   ImagineUpdater.#onChangeGme,
			done:        ImagineUpdater.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/updater.hbs" }
	};

	#actor = null;
	// The row chosen in the dropdown. The window's own, kept across the re-render an actor update causes.
	#selected = "";

	// One window per actor, keyed by uuid as the other windows are.
	static windowId(tmpactor) {
		return `imagine-updater-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineUpdater.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `Character Updater: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImagineUpdater.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineUpdater(tmpactor).render(true);
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
		// A dropdown changes rather than clicks, so it is bound here.
		this.element.querySelector("select[name='what']")
			?.addEventListener("change", (event) => { this.#selected = event.target.value; this.render(); });
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpsys = this.#actor.system;
		var tmpchoices = buildUpdaterChoices({ isGME: !!tmpsys.identity?.isNonClassed, isGM: !!game.user?.isGM });
		var tmpchosen = tmpchoices.find(tmprow => tmprow.id == this.#selected) ?? null;
		tmpcontext.choices = tmpchoices.map(tmprow => ({ ...tmprow, selected: tmprow.id == this.#selected }));
		tmpcontext.chosen = tmpchosen;
		tmpcontext.isGmeAttack = tmpchosen?.id == "gmeAttack";
		tmpcontext.attackSkill = tmpsys.combat?.attackSkill ?? "";
		tmpcontext.attackSkills = GME_ATTACK_SKILLS.map(tmpskill => ({ value: tmpskill, label: tmpskill,
			selected: tmpskill == tmpsys.combat?.chosenAttackSkill }));
		return tmpcontext;
	}

	// @MARKER OPENING A PANEL
	// The window is a list; the work is in the window it opens, which is called as game.imagine.<call>(actor, ...args).
	static async #onOpenAction(event, target) {
		event.preventDefault();
		var tmprow = buildUpdaterChoices({ isGME: !!this.#actor.system.identity?.isNonClassed, isGM: !!game.user?.isGM })
			.find(tmpchoice => tmpchoice.id == this.#selected);
		if (!tmprow || !tmprow.usable) { return; }
		var tmpfn = game.imagine?.[tmprow.call];
		if (typeof tmpfn != "function") {
			ui.notifications.warn(`${tmprow.label} is not available in this version.`);
			return;
		}
		tmpfn(this.#actor, ...tmprow.args);
	}

	// @MARKER GME ATTACK SKILL
	// His CHANGE button ("Change to the new attack skill (GME only)"): the chart a GME fights on, stored
	// as combat.chosenAttackSkill because a GME earns none by title.
	static async #onChangeGme(event, target) {
		event.preventDefault();
		var tmpwanted = this.element.querySelector("select[name='gmeAttackSkill']")?.value ?? "";
		var tmpresult = resolveGmeAttackChange(!!this.#actor.system.identity?.isNonClassed,
			this.#actor.system.combat.chosenAttackSkill, tmpwanted);
		if (!tmpresult.ok) { ui.notifications.warn(tmpresult.message); return; }
		await this.#actor.update({ "system.combat.chosenAttackSkill": tmpresult.skill });
		ui.notifications.info(`${this.#actor.name}: ${tmpresult.message}`);
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
