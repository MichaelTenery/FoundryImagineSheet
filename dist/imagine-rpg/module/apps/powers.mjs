// @START (CODE)
// @MARKER POWERS WINDOW
//==================================================================================================================
// The Add/Remove Powers/Abilities window: his Character Updater step of that name (HTML 53097) as one
// window beside the sheet. Type an ability or power, or pick a spell's or invocation's, give a power
// its activation, and Add; pick one on the selector and Remove.
//
// An entry is a `power` item on the character (see module/powers-rules.mjs for why), so it counts for
// the Arch Mortal qualification and keeps its uses where the creature side keeps them.
//
// Open it from the Updater, or from a macro:
//     game.imagine.powers(actor)
//
// Nothing here is a rule. The rules are module/powers-rules.mjs, and what is shown is built by
// module/powers-view.mjs, which the test renders too.
//==================================================================================================================

import { buildPowersView } from "../powers-view.mjs";
import { buildPowerEntry, stepPowerSelection, POWER_SOURCES } from "../powers-rules.mjs";
import { getPackDocumentsByName } from "../pack-lookup.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImaginePowers extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "powers"],
		window: { title: "Powers and Abilities", resizable: true },
		position: { width: 560, height: 640 },
		actions: {
			addAbility: ImaginePowers.#onAddAbility,
			addPower:   ImaginePowers.#onAddPower,
			stepPower:  ImaginePowers.#onStepPower,
			removePower: ImaginePowers.#onRemovePower,
			done:       ImaginePowers.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/powers.hbs", scrollable: [".powers-window"] }
	};

	#actor = null;
	// What the remove selector shows, and the window's own answers kept across the re-render an
	// actor update causes (the pattern of the Brawling window).
	#selected = "";
	#working = {};
	#names = null;

	// One window per actor, keyed by uuid as the other windows are.
	static windowId(tmpactor) {
		return `imagine-powers-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImaginePowers.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `Powers and Abilities: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImaginePowers.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImaginePowers(tmpactor).render(true);
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
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", () => this.#capture());
		}
	}

	// This is the function which reads the names for the Magical and Divine dropdowns off the two
	// compendia's indexes, once. A pack that is missing gives none, and the typed boxes still work.
	#loadNames() {
		if (this.#names) { return this.#names; }
		var tmpread = (tmppackid) => {
			var tmppack = game.packs.get(tmppackid);
			var tmplist = [];
			if (tmppack?.index?.[Symbol.iterator]) { for (const tmpentry of tmppack.index) { tmplist.push(tmpentry.name); } }
			return [...new Set(tmplist)].sort((tmpa, tmpb) => tmpa.localeCompare(tmpb));
		};
		this.#names = { spells: tmpread(POWER_SOURCES.magical[2]), invocations: tmpread(POWER_SOURCES.divine[2]) };
		return this.#names;
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpnames = this.#loadNames();
		var tmpentries = this.#actor.items.filter(tmpitem => tmpitem.type == "power").map(tmpitem => tmpitem.name);
		Object.assign(tmpcontext, buildPowersView(tmpentries, {
			title: this.#actor.system.identity?.title, spells: tmpnames.spells, invocations: tmpnames.invocations,
			selected: this.#selected, working: this.#working
		}));
		this.#selected = tmpcontext.selected;
		return tmpcontext;
	}

	#capture() {
		var tmpread = (tmpname) => this.element?.querySelector(`[name='${tmpname}']`)?.value ?? "";
		this.#working = {
			newAbility: tmpread("newAbility"), newPower: tmpread("newPower"),
			magicalAbility: tmpread("magicalAbility"), divineAbility: tmpread("divineAbility"),
			magicalPower: tmpread("magicalPower"), divinePower: tmpread("divinePower"),
			openActivation: tmpread("openActivation"), magicalActivation: tmpread("magicalActivation"),
			divineActivation: tmpread("divineActivation")
		};
	}

	// @MARKER ADDING
	// This is the function which makes one entry and puts it on the character. The name comes from the
	// box the clicked button sits beside; an entry the character already holds is not added twice (his
	// lists never carried a duplicate by design for creatures; here a second copy of a power would be a
	// second row to remove for no gain).
	async #add(tmpkind, tmpisability) {
		this.#capture();
		var tmpw = this.#working;
		var tmpname = tmpisability
			? ({ open: tmpw.newAbility, magical: tmpw.magicalAbility, divine: tmpw.divineAbility })[tmpkind]
			: ({ open: tmpw.newPower, magical: tmpw.magicalPower, divine: tmpw.divinePower })[tmpkind];
		var tmpactivation = ({ open: tmpw.openActivation, magical: tmpw.magicalActivation, divine: tmpw.divineActivation })[tmpkind];
		var tmpentry = buildPowerEntry(tmpkind, tmpname, tmpactivation, this.#actor.system.identity?.title, tmpisability);
		if (!tmpentry) { ui.notifications.warn("Name the " + (tmpisability ? "ability" : "power") + " first."); return; }
		if (this.#actor.items.some(tmpitem => tmpitem.type == "power" && tmpitem.name == tmpentry.name)) {
			ui.notifications.info(`${tmpentry.name} is already on ${this.#actor.name}.`);
			return;
		}

		// A spell's or invocation's own provenance and text, so the item says where it came from.
		if (tmpkind != "open") {
			var tmpdocs = await getPackDocumentsByName(POWER_SOURCES[tmpkind][2], [tmpentry.baseName]);
			var tmpsource = tmpdocs[0]?.system;
			if (tmpsource) {
				tmpentry.system.sourcebook = tmpsource.sourcebook ?? "";
				tmpentry.system.page = tmpsource.page ?? "";
				tmpentry.system.description = tmpsource.description ?? tmpentry.system.description;
			}
		}
		await this.#actor.createEmbeddedDocuments("Item", [{ name: tmpentry.name, type: "power", system: tmpentry.system }]);
		this.#selected = tmpentry.name;
		// His clearUpdatePowersAbilities: the boxes go back to blank and "(By Title)".
		this.#working = {};
		ui.notifications.info(`Added ${tmpentry.name} to Additional Powers and Abilities.`);
		this.render();
	}

	static async #onAddAbility(event, target) { event.preventDefault(); await this.#add(target.dataset.kind, true); }
	static async #onAddPower(event, target) { event.preventDefault(); await this.#add(target.dataset.kind, false); }

	// @MARKER REMOVING
	static #onStepPower(event, target) {
		event.preventDefault();
		var tmpnames = this.#actor.items.filter(tmpitem => tmpitem.type == "power").map(tmpitem => tmpitem.name);
		this.#selected = stepPowerSelection(tmpnames, this.#selected, target.dataset.direction);
		this.render();
	}

	// His remove takes only the first instance of a name.
	static async #onRemovePower(event, target) {
		event.preventDefault();
		var tmpitem = this.#actor.items.find(tmpitem => tmpitem.type == "power" && tmpitem.name == this.#selected);
		if (!tmpitem) { ui.notifications.info("No power or ability named. Nothing done."); return; }
		var tmpname = tmpitem.name;
		await tmpitem.delete();
		this.#selected = "";
		ui.notifications.info(`Removed ${tmpname} from Additional Powers and Abilities.`);
		this.render();
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
