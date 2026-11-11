// @START (CODE)
// @MARKER MARTIAL KNOWLEDGE DISCIPLINE WINDOW
//==================================================================================================================
// His "Select Martial Know. Discipline" panel: choose Offensive, Defensive, Balanced or Contact, or tick a Custom
// discipline box by box, and COMMIT. What the character knows is what is committed here; the Martial Arts panel on
// the Combat tab lists only that.
//
// Open it from the Martial Arts panel of a character or creature, from the Updater, or from a macro:
//     game.imagine.martialKnow(actor)
//
// Nothing here is a rule. What is shown and what COMMIT writes are in module/martial-know-view.mjs.
//==================================================================================================================

import { buildMartialKnowView, newMartialKnowWorking, resolveMartialKnowCommit } from "../martial-know-view.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineMartialKnow extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "martial-know"],
		window: { title: "Martial Knowledge Discipline", resizable: true },
		position: { width: 620, height: "auto" },
		actions: {
			commit: ImagineMartialKnow.#onCommit,
			done:   ImagineMartialKnow.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/martial-know.hbs" }
	};

	#actor = null;
	// The discipline chosen and the boxes ticked, the window's own until COMMIT, kept across re-renders.
	#working = null;

	// One window per actor, keyed by uuid as the other windows are.
	static windowId(tmpactor) {
		return `imagine-martial-know-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineMartialKnow.windowId(tmpactor) });
		this.#actor = tmpactor;
		this.#working = newMartialKnowWorking(tmpactor?.system?.martial);
	}

	get title() {
		return `Martial Knowledge Discipline: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImagineMartialKnow.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineMartialKnow(tmpactor).render(true);
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
		// Dropdowns and boxes change rather than click, so these are bound here.
		this.element.querySelector("select[name='discipline']")?.addEventListener("change", (event) => {
			this.#working.discipline = event.target.value;
			this.render();
		});
		for (const tmpbox of this.element.querySelectorAll("input[data-family]")) {
			tmpbox.addEventListener("change", (event) => this.#setBox(event.target));
		}
	}

	#setBox(tmpbox) {
		var tmpfamily = tmpbox.dataset.family;
		var tmpname = tmpbox.dataset.name;
		var tmppicks = this.#working.picks[tmpfamily] ?? [];
		this.#working.picks[tmpfamily] = tmpbox.checked
			? [...tmppicks.filter(tmpheld => tmpheld != tmpname), tmpname]
			: tmppicks.filter(tmpheld => tmpheld != tmpname);
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		Object.assign(tmpcontext, buildMartialKnowView({ characterName: this.#actor.name,
			martial: this.#actor.system.martial, working: this.#working, isGM: !!game.user?.isGM }));
		return tmpcontext;
	}

	// @MARKER COMMIT
	// His COMMIT, and his one line to chat. The window closes on success, as his sheet moves on to the
	// Combat tab.
	static async #onCommit(event, target) {
		event.preventDefault();
		var tmpresult = resolveMartialKnowCommit(this.#actor.name, this.#working, this.#actor.system.martial);
		if (!tmpresult.ok) { ui.notifications.warn(tmpresult.message); return; }
		await this.#actor.update(tmpresult.update);
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
			content: foundry.utils.escapeHTML(tmpresult.message) });
		await this.close();
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
