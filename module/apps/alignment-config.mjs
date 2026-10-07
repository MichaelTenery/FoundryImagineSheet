// @START (CODE)
// @MARKER ALIGNMENTS AND TENDENCIES WINDOW
//==================================================================================================================
// The Game Master's window for this campaign's own alignments and tendencies (the world setting
// imagine-rpg.customAlignments). The rules for them -- which class lists a custom alignment joins,
// and why its name must carry its axis words -- are in module/alignment-rules.mjs.
//
// Built as the Content Availability window is (module/apps/availability-config.mjs): edits are held
// in a draft until Save, and before any re-render the form is captured into the draft, so adding or
// removing a row never throws away what was typed and not yet saved. Save checks every row with
// validateCustomAlignments and refuses, naming each problem, rather than storing a name the rules
// would misread.
//==================================================================================================================

import {
	CUSTOM_READS_AS, CUSTOM_ACTIVITY, CUSTOM_TENDENCY_LISTS,
	normalizeCustomAlignments, validateCustomAlignments
} from "../alignment-rules.mjs";
import { applySheetTheme, refreshOpenWindows } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// How each tendency list is named in the window.
const TENDENCY_LIST_LABELS = {
	// list        label
	"any":         "Any class",
	"order":       "Order classes too",
	"immoral":     "Immoral classes too"
};

export default class ImagineAlignmentConfig extends HandlebarsApplicationMixin(ApplicationV2) {

	// @MARKER SHEET THEME
	// Painted at render, as the availability window does, so a theme change repaints it.
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
	}

	// Whatever is typed goes into the draft as it is typed, so a repaint from outside (the setting's
	// onChange, a theme change -- refreshOpenWindows repaints every "imagine" window) rebuilds the
	// rows as they are on screen, not as they were at the last Add or Remove.
	// ON FIRST RENDER ONLY: the window's root element outlives its re-renders, so listeners added in
	// _onRender piled up -- two more per Add, Remove or repaint (quality pass 2026-10-07).
	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		this.element.addEventListener("input",  () => this.#captureForm());
		this.element.addEventListener("change", () => this.#captureForm());
	}


	static DEFAULT_OPTIONS = {
		id: "imagine-alignment-config",
		tag: "form",
		classes: ["imagine", "alignment-config"],
		window: { title: "Imagine RPG — Alignments & Tendencies", contentClasses: ["standard-form"] },
		position: { width: 620, height: 600 },
		// Not closed on submit: a save that fails validation must leave the window, and the rows, open.
		form: { handler: ImagineAlignmentConfig.#onSubmit, closeOnSubmit: false },
		actions: {
			addAlignment:    ImagineAlignmentConfig.#onAddAlignment,
			removeAlignment: ImagineAlignmentConfig.#onRemoveAlignment,
			addTendency:     ImagineAlignmentConfig.#onAddTendency,
			removeTendency:  ImagineAlignmentConfig.#onRemoveTendency
		}
	};

	static PARTS = {
		form:   { template: "systems/imagine-rpg/templates/apps/alignment-config.hbs", scrollable: [""] },
		footer: { template: "templates/generic/form-footer.hbs" }
	};

	// The unsaved working copy. Null until the window first renders.
	#draft = null;

	// This is the function which loads the saved setting into a fresh draft.
	#loadDraft() {
		this.#draft = foundry.utils.deepClone(normalizeCustomAlignments(game.settings.get("imagine-rpg", "customAlignments")));
	}

	// This is the function which copies whatever is on screen into the draft. Rows are submitted as
	// alignments.0.name, alignments.0.readsAs, ... in the order the draft holds them. The rows are read
	// as typed, not tidied, so validation sees what the Game Master actually entered.
	#captureForm() {
		if (!this.element) { return; }
		var tmpdata = foundry.utils.expandObject(
			new foundry.applications.ux.FormDataExtended(this.element).object);

		var tmpalignrows = tmpdata.alignments ?? {};
		this.#draft.alignments.forEach((tmprow, tmpindex) => {
			var tmpform = tmpalignrows[tmpindex];
			if (!tmpform) { return; }
			tmprow.name      = ("" + (tmpform.name ?? "")).trim();
			tmprow.readsAs   = tmpform.readsAs;
			tmprow.activity  = tmpform.activity;
			tmprow.fanatical = tmpform.fanatical === true;
		});
		var tmptendrows = tmpdata.tendencies ?? {};
		this.#draft.tendencies.forEach((tmprow, tmpindex) => {
			var tmpform = tmptendrows[tmpindex];
			if (!tmpform) { return; }
			tmprow.name = ("" + (tmpform.name ?? "")).trim();
			tmprow.list = tmpform.list;
		});
	}

	// This is the function which assembles what the template renders.
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		if (!this.#draft) { this.#loadDraft(); }

		tmpcontext.alignments = this.#draft.alignments.map((tmprow, tmpindex) => ({
			index: tmpindex,
			name: tmprow.name,
			fanatical: tmprow.fanatical,
			readsAsOptions:  CUSTOM_READS_AS.map(tmpv => ({ value: tmpv, label: tmpv, selected: tmpv == tmprow.readsAs })),
			activityOptions: CUSTOM_ACTIVITY.map(tmpv => ({ value: tmpv, label: tmpv, selected: tmpv == tmprow.activity }))
		}));
		tmpcontext.tendencies = this.#draft.tendencies.map((tmprow, tmpindex) => ({
			index: tmpindex,
			name: tmprow.name,
			listOptions: CUSTOM_TENDENCY_LISTS.map(tmpv => ({ value: tmpv, label: TENDENCY_LIST_LABELS[tmpv], selected: tmpv == tmprow.list }))
		}));
		tmpcontext.buttons = [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "Save" }];
		return tmpcontext;
	}

	// @MARKER ACTION HANDLERS

	// This is the function which adds a blank alignment row.
	static #onAddAlignment(event, target) {
		this.#captureForm();
		this.#draft.alignments.push({ name: "", readsAs: "Good", activity: "Active", fanatical: false });
		this.render();
	}

	// This is the function which removes one alignment row.
	static #onRemoveAlignment(event, target) {
		this.#captureForm();
		this.#draft.alignments.splice(parseInt(target.dataset.index), 1);
		this.render();
	}

	// This is the function which adds a blank tendency row.
	static #onAddTendency(event, target) {
		this.#captureForm();
		this.#draft.tendencies.push({ name: "", list: "any" });
		this.render();
	}

	// This is the function which removes one tendency row.
	static #onRemoveTendency(event, target) {
		this.#captureForm();
		this.#draft.tendencies.splice(parseInt(target.dataset.index), 1);
		this.render();
	}

	// This is the function which checks the draft and saves it. A blank row is dropped rather than
	// refused -- it is an Add pressed once too often -- but anything named must pass.
	static async #onSubmit(event, form, formData) {
		this.#captureForm();
		var tmpcustom = {
			alignments: this.#draft.alignments.filter(tmprow => tmprow.name != ""),
			tendencies: this.#draft.tendencies.filter(tmprow => tmprow.name != "")
		};
		var tmperrors = validateCustomAlignments(tmpcustom);
		if (tmperrors.length > 0) {
			ui.notifications.error(`Not saved. ${tmperrors.join(" ")}`, { permanent: true });
			return;
		}
		await game.settings.set("imagine-rpg", "customAlignments", normalizeCustomAlignments(tmpcustom));
		ui.notifications.info("Alignments and tendencies saved.");
		// The setting's onChange repaints open windows too; this covers a save that changed nothing.
		refreshOpenWindows();
		this.close();
	}
}
// @END (CODE)
