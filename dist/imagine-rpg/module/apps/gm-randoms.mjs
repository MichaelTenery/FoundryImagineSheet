// @START (CODE)
// @MARKER GM RANDOMS WINDOW
//==================================================================================================================
// The Game Master's Randoms/Extras window: his creature page's CREATURE UPDATER/GM TOOLS option of the
// same name, as one window beside the sheet -- dice, encounter chance, direction, double reflection,
// insanity, animal, substance, element, plane, subject, skill, social skill, race, class, alignment,
// alignment colour, magic chaos effect and the two random spells.
//
// Each panel has its ROLL (or GET) button and a read-only answer. The answer is also whispered to the
// Game Masters as a chat card, which his box could not do and a table wants: the next roll does not
// overwrite what was said.
//
// Game Master only. It needs no actor -- the tools roll nothing for anyone -- but is opened from the
// creature sheet's GM Tools bar, or from a macro:
//     game.imagine.gmRandoms(actor)        or        game.imagine.gmRandoms()
//
// Nothing here is a rule. The tables are in module/random-tables.mjs, the rolling in
// module/random-rules.mjs, and what is shown is built by module/random-view.mjs, which the test
// renders too.
//==================================================================================================================

import { buildRandomsView, RANDOM_ROLLERS, RANDOM_SECTIONS } from "../random-view.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineGmRandoms extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "imagine-gm-randoms",
		tag: "div",
		classes: ["imagine", "gm-randoms"],
		window: { title: "GM Tools: Randoms/Extras", resizable: true },
		position: { width: 520, height: 720 },
		actions: {
			roll: ImagineGmRandoms.#onRoll
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/gm-randoms.hbs", scrollable: [".gm-randoms-body"] }
	};

	// What has been rolled, and what the panels' own boxes hold -- kept across the re-render a roll
	// causes, which would otherwise wipe the dice string and the dropdowns.
	#results = {};
	#working = {};
	#actor = null;

	constructor(tmpactor = null, tmpoptions = {}) {
		super(tmpoptions);
		this.#actor = tmpactor;
	}

	get title() {
		return this.#actor?.name ? `GM Tools: Randoms/Extras (${this.#actor.name})` : "GM Tools: Randoms/Extras";
	}

	// This is the function which opens the window, or brings it forward if it is open.
	static open(tmpactor = null) {
		if (!game.user?.isGM) {
			ui.notifications?.warn("The Randoms/Extras tools are for the Game Master.");
			return null;
		}
		var tmpexisting = foundry.applications.instances.get(ImagineGmRandoms.DEFAULT_OPTIONS.id);
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineGmRandoms(tmpactor).render(true);
	}

	// @MARKER SHEET THEME
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", () => this.#capture());
		}
	}

	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		Object.assign(tmpcontext, buildRandomsView(this.#results, this.#working));
		return tmpcontext;
	}

	// The panels' boxes, read as the window stands.
	#capture() {
		var tmproot = this.element;
		this.#working = {
			dice: tmproot.querySelector("input[name='dice']")?.value ?? this.#working.dice,
			max: !!tmproot.querySelector("input[name='max']")?.checked,
			chance: tmproot.querySelector("select[name='chance']")?.value ?? this.#working.chance,
			align: tmproot.querySelector("select[name='align']")?.value ?? this.#working.align,
			level: tmproot.querySelector("input[name='level']")?.value ?? this.#working.level
		};
	}

	// @MARKER DICE
	// Through Foundry's own random source, so the world's dice settings apply here too (as the Level
	// Up window does).
	static #die(tmpsides) {
		return Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1;
	}

	// @MARKER THE ROLL
	static async #onRoll(event, target) {
		event.preventDefault();
		this.#capture();
		var tmpkey = target.dataset.key;
		var tmproller = RANDOM_ROLLERS[tmpkey];
		if (!tmproller) { return; }
		var tmpresult = tmproller(ImagineGmRandoms.#die, this.#working);
		this.#results[tmpkey] = tmpresult;
		await this.#post(tmpkey, tmpresult);
		this.render();
	}

	// This is the function which whispers the answer to the Game Masters.
	async #post(tmpkey, tmpresult) {
		var tmprow = RANDOM_SECTIONS.find(tmpsection => tmpsection[0] == tmpkey);
		var tmptitle = foundry.utils.escapeHTML(tmprow?.[1] ?? tmpkey);
		var tmptext = foundry.utils.escapeHTML("" + tmpresult) || "&mdash;";
		try {
			await ChatMessage.create({
				content: `<div class="imagine-chat gm-randoms-card"><h3>${tmptitle}</h3><p>${tmptext}</p></div>`,
				whisper: ChatMessage.getWhisperRecipients("GM").map(tmpuser => tmpuser.id),
				speaker: ChatMessage.getSpeaker({ actor: this.#actor })
			});
		} catch (tmperr) { console.error("Imagine RPG | the random roll could not be posted to chat", tmperr); }
	}
}
// @END (CODE)
