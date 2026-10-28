// @START (CODE)
// @MARKER TEMPORARY MODIFIERS WINDOW
//==================================================================================================================
// The Temporary Modifiers window: his "Add/Remove Temporary Modifiers" panel of the Character Updater (Roll20 sheet
// HTML 56640-57226) as one window beside the sheet -- effect names, then attributes, characteristics, resistances,
// movement, combat, equipment and fatigue, each with its own SET and CLEAR, then Berserking, the non-skill Evoke,
// CLEAR ALL and CLOSE.
//
// Type what is wanted in a section's boxes and press its SET: nothing is written until then. What is typed and not
// yet SET is the window's own and is kept across the re-render every actor update causes (the pattern of
// brawling.mjs's #working).
//
// Open it from the Updater, or from a macro:
//     game.imagine.tempModifiers(actor)
//
// Nothing here is a rule. The arithmetic is in module/temp-mods-rules.mjs, what is shown is built by
// module/temp-mods-view.mjs, and what the actor does with the figures is in actor-character.mjs
// (@MARKER TEMPORARY MODIFIERS) and the attacks.
//==================================================================================================================

import { buildTempModsView } from "../temp-mods-view.mjs";
import { resolveSetUpdate, resolveClearUpdate, resolveBerserk, addEffect, removeEffects } from "../temp-mods-rules.mjs";
import { postMagic } from "../magic-actions.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// The names for the three dropdowns, read once from the compendia's indexes and kept: a few hundred strings.
var tmpNameCache = null;

export default class ImagineTempModifiers extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "temp-modifiers"],
		window: { title: "Temporary Modifiers", resizable: true },
		position: { width: 720, height: 780 },
		actions: {
			setSection:    ImagineTempModifiers.#onSetSection,
			clearSection:  ImagineTempModifiers.#onClearSection,
			clearAll:      ImagineTempModifiers.#onClearAll,
			addEffect:     ImagineTempModifiers.#onAddEffect,
			removeEffect:  ImagineTempModifiers.#onRemoveEffect,
			berserk:       ImagineTempModifiers.#onBerserk,
			evoke:         ImagineTempModifiers.#onEvoke,
			clearEvokes:   ImagineTempModifiers.#onClearEvokes,
			done:          ImagineTempModifiers.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/temp-modifiers.hbs", scrollable: [".temp-mods-window"] }
	};

	#actor = null;
	// What the boxes held when last changed, by section then field -- kept across a re-render, dropped for a
	// section once its SET or CLEAR has been pressed.
	#working = {};

	// One window per actor, keyed by uuid as the Brawling and Situation Mods windows are.
	static windowId(tmpactor) {
		return `imagine-temp-mods-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineTempModifiers.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `Temporary Modifiers: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImagineTempModifiers.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineTempModifiers(tmpactor).render(true);
	}

	// Registered with the actor so the window follows its changes (a modifier set, a spell cast).
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
		// Every box is captured as it changes, and put back after a re-render.
		for (const tmpfield of this.element.querySelectorAll("[data-sec][data-field]")) {
			var tmpsection = tmpfield.dataset.sec;
			var tmpname = tmpfield.dataset.field;
			var tmpsaved = this.#working[tmpsection]?.[tmpname];
			if (tmpsaved !== undefined) {
				if (tmpfield.type == "checkbox") { tmpfield.checked = !!tmpsaved; } else { tmpfield.value = tmpsaved; }
			}
			tmpfield.addEventListener("change", () => this.#capture(tmpfield));
		}
	}

	#capture(tmpfield) {
		var tmpsection = tmpfield.dataset.sec;
		this.#working[tmpsection] = this.#working[tmpsection] ?? {};
		this.#working[tmpsection][tmpfield.dataset.field] = (tmpfield.type == "checkbox") ? tmpfield.checked : tmpfield.value;
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		tmpcontext.actor = this.#actor;
		Object.assign(tmpcontext, buildTempModsView(this.#actor.system, await ImagineTempModifiers.#getNames()));
		return tmpcontext;
	}

	// This is the function which reads the spell, invocation and evoke names from the compendia's indexes.
	static async #getNames() {
		if (tmpNameCache) { return tmpNameCache; }
		var tmpnames = (tmppackid) => {
			var tmppack = game.packs.get(tmppackid);
			if (!tmppack?.index?.[Symbol.iterator]) { return []; }
			return [...new Set(Array.from(tmppack.index).map(tmpentry => tmpentry.name))].sort((tmpa, tmpb) => tmpa.localeCompare(tmpb));
		};
		var tmpevokes = [];
		var tmplore = game.packs.get("world.imagine-lore");
		if (tmplore) {
			try {
				var tmpindex = await tmplore.getIndex({ fields: ["system.kind"] });
				tmpevokes = [...new Set(Array.from(tmpindex).filter(tmpentry => tmpentry.system?.kind == "evoke")
					.map(tmpentry => tmpentry.name))].sort((tmpa, tmpb) => tmpa.localeCompare(tmpb));
			} catch (tmperror) { tmpevokes = []; }
		}
		// Not kept when nothing was found: the packs may simply not be built yet.
		var tmplists = { spells: tmpnames("world.imagine-spells"), invocations: tmpnames("world.imagine-invocations"), evokes: tmpevokes };
		if (tmplists.spells.length || tmplists.invocations.length || tmplists.evokes.length) { tmpNameCache = tmplists; }
		return tmplists;
	}

	// @MARKER READING THE BOXES
	// A section's boxes as { field: value }; a tick is a boolean, a dropdown or number its text.
	#read(tmpsection) {
		var tmpout = {};
		for (const tmpfield of this.element.querySelectorAll(`[data-sec="${tmpsection}"][data-field]`)) {
			tmpout[tmpfield.dataset.field] = (tmpfield.type == "checkbox") ? tmpfield.checked : tmpfield.value;
		}
		return tmpout;
	}

	async #write(tmpupdate, tmpmessage) {
		if (Object.keys(tmpupdate).length) { await this.#actor.update(tmpupdate); }
		if (tmpmessage) { ui.notifications.info(tmpmessage); }
	}

	// @MARKER SET AND CLEAR
	static async #onSetSection(event, target) {
		event.preventDefault();
		var tmpsection = target.dataset.section;
		var tmpupdate = resolveSetUpdate(tmpsection, this.#actor.system, this.#read(tmpsection));
		delete this.#working[tmpsection];
		if (!Object.keys(tmpupdate).length) { this.render(); return; }
		await this.#write(tmpupdate);
	}

	static async #onClearSection(event, target) {
		event.preventDefault();
		var tmpsection = target.dataset.section;
		delete this.#working[tmpsection];
		await this.#write(resolveClearUpdate(tmpsection, this.#actor.system));
		this.render();
	}

	static async #onClearAll(event, target) {
		event.preventDefault();
		this.#working = {};
		await this.#write(resolveClearUpdate(null, this.#actor.system), "All temporary modifiers cleared.");
		this.render();
	}

	// @MARKER EFFECT NAMES
	static async #onAddEffect(event, target) {
		event.preventDefault();
		var tmpkind = target.dataset.kind;
		var tmpbox = this.element.querySelector({ open: "input[name='openEffect']", spell: "select[name='spellEffect']",
			invoke: "select[name='divineEffect']" }[tmpkind]);
		var tmpname = ("" + (tmpbox?.value ?? "")).trim();
		if (!tmpname) { return; }
		var tmpentry = (tmpkind == "spell") ? `Spell: ${tmpname}` : ((tmpkind == "invoke") ? `Invoke: ${tmpname}` : tmpname);
		await this.#write({ "system.magic.effectList": addEffect(this.#actor.system.magic?.effectList, tmpentry) });
	}

	static async #onRemoveEffect(event, target) {
		event.preventDefault();
		var tmpname = ("" + (this.element.querySelector("select[name='removeEffect']")?.value ?? "")).trim();
		if (!tmpname) { return; }
		await this.#write({ "system.magic.effectList": removeEffects(this.#actor.system.magic?.effectList, (tmpe) => tmpe == tmpname) });
	}

	// @MARKER BERSERKING
	static async #onBerserk(event, target) {
		event.preventDefault();
		var tmpresult = resolveBerserk(target.dataset.what, this.#actor.system);
		if (!tmpresult.ok) { ui.notifications.warn(`${this.#actor.name}: ${tmpresult.message}`); return; }
		await this.#write(tmpresult.update, `${this.#actor.name}: ${tmpresult.message}`);
	}

	// @MARKER NON-SKILL EVOKE
	// The evoke goes on the effects list as "Evoke: <name>" and its description to chat, as the Magic tab posts one.
	// What a body-changing evoke alters is not worked out (his doEvokeOnAction); the note on the window says so.
	static async #onEvoke(event, target) {
		event.preventDefault();
		var tmpname = ("" + (this.element.querySelector("select[name='evokeName']")?.value ?? "")).trim();
		if (!tmpname) { ui.notifications.warn("Select a magical evoke first."); return; }
		await this.#write({ "system.magic.effectList": addEffect(this.#actor.system.magic?.effectList, `Evoke: ${tmpname}`) });
		var tmpitem = this.#actor.items.find(tmpi => tmpi.type == "lore" && tmpi.system.kind == "evoke" && tmpi.name == tmpname);
		if (tmpitem) { await postMagic(this.#actor, tmpitem); }
	}

	static async #onClearEvokes(event, target) {
		event.preventDefault();
		await this.#write({ "system.magic.effectList": removeEffects(this.#actor.system.magic?.effectList, (tmpe) => tmpe.startsWith("Evoke:")) });
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
