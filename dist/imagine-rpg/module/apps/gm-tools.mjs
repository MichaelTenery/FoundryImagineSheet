// @START (CODE)
// @MARKER GM TOOLS WINDOW
//==================================================================================================================
// The GM Tools window: his Character Sheet Config tab's "Calc/Show Experience Value" and "Split
// Experience" as one window beside a character or creature sheet -- the two things a Game Master does
// with a GMC, a GME or a creature the table has just beaten. The Game Master's alone: any other user is
// told so and nothing opens.
//
// The value is worked out from the character each time the window draws, so there is no stale number;
// his CALC button, which only recalculated on demand, is kept as a button that redraws it. Ticking
// Show Experience puts the value at the bottom of the character's main tab, for Game Masters only.
//
// Open it from the Updater, or from a macro:
//     game.imagine.gmTools(actor)
//
// Nothing here is a rule. The rules are module/gm-exp-rules.mjs, the lookups module/gm-exp-actions.mjs,
// and what is shown is built by module/gm-tools-view.mjs, which the test renders too.
//==================================================================================================================

import { buildGmToolsView } from "../gm-tools-view.mjs";
import { splitExperience } from "../gm-exp-rules.mjs";
import { valueCharacter } from "../gm-exp-actions.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineGmTools extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "gm-tools"],
		window: { title: "GM Tools", resizable: true },
		position: { width: 540, height: 640 },
		actions: {
			calcExp:  ImagineGmTools.#onCalc,
			splitExp: ImagineGmTools.#onSplit,
			done:     ImagineGmTools.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/gm-tools.hbs", scrollable: [".gm-tools-window"] }
	};

	#actor = null;
	// The split's own answers, and the last split's result, kept across the re-render an actor update causes.
	#working = {};
	#split = null;

	static windowId(tmpactor) {
		return `imagine-gm-tools-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineGmTools.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `GM Tools: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open. These
	// are the Game Master's tools: anyone else is told, and nothing opens.
	static open(tmpactor) {
		if (!game.user?.isGM) { ui.notifications.warn("The GM tools are for the Game Master."); return null; }
		var tmpexisting = foundry.applications.instances.get(ImagineGmTools.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineGmTools(tmpactor).render(true);
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
		// A tick or a poison type is the character's own setting and goes onto the actor as it changes.
		for (const tmpfield of this.element.querySelectorAll("[data-bonus]")) {
			tmpfield.addEventListener("change", (event) => this.#setBonus(event.target));
		}
		// Every other answer is the window's, captured as it changes so a re-render keeps it.
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", () => this.#capture());
		}
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpvalue = this.#actor.type == "creature" ? null : await valueCharacter(this.#actor);
		Object.assign(tmpcontext, buildGmToolsView(this.#actor, { value: tmpvalue, working: this.#working, split: this.#split }));
		return tmpcontext;
	}

	#capture() {
		var tmpread = (tmpname) => this.element?.querySelector(`[name='${tmpname}']`);
		this.#working = {
			amount: tmpread("amount")?.value ?? "", people: tmpread("people")?.value ?? "",
			difficulty: tmpread("difficulty")?.value ?? "1", fill: !!tmpread("fill")?.checked
		};
		// Ticking Fill redraws, so the amount box shows the value it is filled with.
		this.render();
	}

	// @MARKER WRITING
	async #setBonus(tmpfield) {
		var tmpkey = tmpfield.dataset.bonus;
		var tmpvalue = tmpfield.type == "checkbox" ? !!tmpfield.checked : tmpfield.value;
		await this.#actor.update({ [`system.gmExp.${tmpkey}`]: tmpvalue });
	}

	// His CALC: the value is current on every draw, so this redraws, and says what it came to.
	static async #onCalc(event, target) {
		event.preventDefault();
		var tmpvalue = await valueCharacter(this.#actor);
		ui.notifications.info(`${this.#actor.name}: experience value ${tmpvalue.total}.`);
		this.render();
	}

	// His SPLIT: handleSplitExp. The amount is the typed one, or the actor's value when Fill is ticked.
	static async #onSplit(event, target) {
		event.preventDefault();
		var tmpread = (tmpname) => this.element?.querySelector(`[name='${tmpname}']`);
		var tmpfill = !!tmpread("fill")?.checked;
		var tmpamount = parseInt(tmpread("amount")?.value) || 0;
		if (tmpfill) {
			tmpamount = this.#actor.type == "creature"
				? (parseInt(this.#actor.system.identity?.expValue) || 0)
				: (await valueCharacter(this.#actor)).total;
		}
		this.#working = { amount: tmpread("amount")?.value ?? "", people: tmpread("people")?.value ?? "",
			difficulty: tmpread("difficulty")?.value ?? "1", fill: tmpfill };
		this.#split = splitExperience(tmpamount, tmpread("people")?.value, tmpread("difficulty")?.value);
		this.render();
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
