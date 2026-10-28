// @START (CODE)
// @MARKER SHAPE CHANGE WINDOW
//==================================================================================================================
// The shape-change window: his four Updater panels for changing the body a character wears -- Changeling Switch
// Race, Formless New Host, Formless Host Retention and Formless Check Free Psyche -- as one window with his
// dropdown at the top. A character who is not that race sees his refusal and nothing else.
//
// Open it from the Updater, or from a macro:
//     game.imagine.shapeChange(actor, kind)     kind: "changeling" | "formlessHost" | "formlessRetention" | "formlessPsyche"
//
// Nothing here is a rule. The rules are module/shape-change-rules.mjs, the writing module/shape-change.mjs and
// what is shown module/shape-change-view.mjs.
//==================================================================================================================

import { buildShapeChangeView, SHAPE_CHANGE_KINDS } from "../shape-change-view.mjs";
import { applyChangelingSwitch, possessFormlessHost, retainFormlessHost, checkFreePsyche,
         getRaceDocument, hasFormlessHost } from "../shape-change.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineShapeChange extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "shape-change"],
		window: { title: "Shape Change", resizable: true },
		position: { width: 520, height: 640 },
		actions: {
			changeling: ImagineShapeChange.#onChangeling,
			possess:    ImagineShapeChange.#onPossess,
			retain:     ImagineShapeChange.#onRetain,
			psyche:     ImagineShapeChange.#onPsyche,
			done:       ImagineShapeChange.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/shape-change.hbs", scrollable: [""] }
	};

	#actor = null;
	#kind = "changeling";
	// The window's own unsaved inputs, kept across the re-render an actor update causes (brawling's #working).
	#working = {};
	// The chosen host's limits, read from the compendium when the host is picked, for the MAX boxes.
	#hostLimits = null;

	// One window per actor, keyed by uuid as the other windows are.
	static windowId(tmpactor) {
		return `imagine-shape-change-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpkind, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineShapeChange.windowId(tmpactor) });
		this.#actor = tmpactor;
		if (SHAPE_CHANGE_KINDS.some(tmprow => tmprow[0] == tmpkind)) { this.#kind = tmpkind; }
	}

	get title() {
		return `Shape Change: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window on the panel asked for, or brings it forward.
	static open(tmpactor, tmpkind = "changeling") {
		var tmpexisting = foundry.applications.instances.get(ImagineShapeChange.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.setKind(tmpkind); tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineShapeChange(tmpactor, tmpkind).render(true);
	}

	setKind(tmpkind) {
		if (!SHAPE_CHANGE_KINDS.some(tmprow => tmprow[0] == tmpkind) || tmpkind == this.#kind) { return; }
		this.#kind = tmpkind;
		this.#working = {};
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
		this.element.querySelector("select[name='kind']")
			?.addEventListener("change", (event) => this.setKind(event.target.value));
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", () => this.#capture(tmpfield.name == "host"));
		}
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpactor = this.#actor;
		var tmpsys = tmpactor.system;
		var tmppsyche = tmpactor.items.find(tmpitem => tmpitem.type == "race" && tmpitem.system.formless);
		var tmphost = tmpactor.items.find(tmpitem => tmpitem.type == "race" && !tmpitem.system.formless);
		tmpcontext.actor = tmpactor;
		Object.assign(tmpcontext, buildShapeChangeView(this.#kind, {
			name: tmpactor.name,
			raceName: tmpsys.identity.raceName,
			isChangeling: !!tmpsys.identity.isChangeling,
			isFormless: !!tmpsys.identity.isFormless,
			hasHost: hasFormlessHost(tmpactor),
			hostName: tmphost?.name ?? "",
			changeling: tmpsys.identity.changeling,
			formless: tmpsys.identity.formless,
			formlessHosts: tmppsyche?.system?.formlessHosts ?? [],
			hostLimits: this.#hostLimits,
			control: tmpsys.identity.formlessControl,
			wilSave: tmpsys.attributes.wil.save,
			heightFeet: tmpsys.physical.heightFeet,
			heightInches: tmpsys.physical.heightInches
		}, this.#working));
		return tmpcontext;
	}

	// This is the function which reads the window's inputs into #working. A new host fetches that race's limits.
	async #capture(tmphostChanged = false) {
		var tmpel = this.element;
		var tmpval = (tmpname) => tmpel.querySelector(`[name='${tmpname}']`)?.value ?? "";
		var tmpw = {
			form: tmpval("form"), gender: tmpval("gender"), heightFeet: tmpval("heightFeet"), heightInches: tmpval("heightInches"),
			frame: tmpval("frame"), weight: tmpval("weight"), hair: tmpval("hair"), bodyCovering: tmpval("bodyCovering"),
			eyes: tmpval("eyes"), skin: tmpval("skin"), host: tmpval("host"), hostType: tmpval("hostType"), hoursDead: tmpval("hoursDead"),
			attributes: {}
		};
		var tmpslight = tmpel.querySelector("[name='slight']");
		if (tmpslight) { tmpw.slight = !!tmpslight.checked; }
		for (const tmpkey of [ "str", "agl", "vit", "app", "soc" ]) { tmpw.attributes[tmpkey] = tmpval(`attr-${tmpkey}`); }
		this.#working = tmpw;
		if (tmphostChanged) {
			var tmpdoc = await getRaceDocument(tmpw.host);
			this.#hostLimits = tmpdoc?.system?.attributeLimits ?? null;
			this.render();
		}
	}

	// @MARKER DICE
	// Through Foundry's own random source, so the world's dice settings apply here too.
	static #d100() {
		return Math.ceil(CONFIG.Dice.randomUniform() * 100) || 1;
	}

	// @MARKER THE FOUR BUTTONS
	static async #onChangeling(event, target) {
		event.preventDefault();
		await this.#capture();
		var tmpresult = await applyChangelingSwitch(this.#actor, this.#working);
		if (tmpresult.ok) { this.#working = {}; this.render(); }
	}

	static async #onPossess(event, target) {
		event.preventDefault();
		await this.#capture();
		var tmpresult = await possessFormlessHost(this.#actor, this.#working, ImagineShapeChange.#d100());
		if (tmpresult.ok) { this.#working = {}; this.#hostLimits = null; this.render(); }
	}

	static async #onRetain(event, target) {
		event.preventDefault();
		await retainFormlessHost(this.#actor, ImagineShapeChange.#d100());
	}

	static async #onPsyche(event, target) {
		event.preventDefault();
		await checkFreePsyche(this.#actor, ImagineShapeChange.#d100(), ImagineShapeChange.#d100());
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
