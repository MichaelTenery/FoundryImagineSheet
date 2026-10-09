// @START (CODE)
// @MARKER BRAWLING WINDOW
//==================================================================================================================
// The Brawling window: his BRAWLER row -- a dropdown of fifty brawling weapons, ROLL and MOD, and
// the four boxes Type, Speed, Min and Damage -- stood up as one window beside the sheet.
//
// Pick what to brawl with (a fist, a chair, a bottle; or a weapon already in a wound, twisted), see
// its figures, answer the questions every attack of this system asks -- where it is aimed, on the
// target's own figure; a called shot; any other modifier; whether the target is avoiding it -- and
// press Brawl. The choice is written to the actor as his all_brawling_weapons was, so it is there
// next time; the questions are the window's own and are kept across its re-renders.
//
// Open it from the Combat tab of a character or creature, or from a macro:
//     game.imagine.brawling(actor)
//
// Nothing here is a rule. The figures are in module/combat/brawling-rules.mjs, the roll is
// module/combat/brawling-attack.mjs, and what is shown is built by module/brawling-view.mjs, which
// the test renders too.
//==================================================================================================================

import { buildBrawlingView } from "../brawling-view.mjs";
import { rollBrawlingAttack, getForceChance } from "../combat/brawling-attack.mjs";
import { describeSituationalTotals } from "../situational-view.mjs";
import { buildBodyFigure, loadBodyTemplates } from "../body-view.mjs";
import { wireAimPicker } from "../combat/attack.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineBrawling extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "brawling"],
		window: { title: "Brawling", resizable: true },
		position: { width: 520, height: "auto" },
		actions: {
			brawl: ImagineBrawling.#onBrawl,
			done:  ImagineBrawling.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/brawling.hbs" }
	};

	#actor = null;
	// The window's own answers -- aim, modifier, called shot, the dials, the defence tick -- kept
	// across the re-render an actor update causes, which would otherwise wipe them (the pattern of
	// alignment-config's #captureForm).
	#working = {};
	#targetHook = null;

	// One window per actor, keyed by uuid as the Situation Mods window is, so an unlinked token's
	// window is its own and not its base actor's.
	static windowId(tmpactor) {
		return `imagine-brawling-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineBrawling.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `Brawling: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImagineBrawling.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineBrawling(tmpactor).render(true);
	}

	// Registered with the actor so the window follows the actor's changes (the choice written, a
	// stance taken, Situation Mods set), and with the targeting hook so the aim picker shows the
	// token targeted now.
	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		this.#actor.apps[this.id] = this;
		this.#targetHook = Hooks.on("targetToken", (tmpuser) => {
			if (tmpuser?.id == game.user.id && this.rendered) { this.render(); }
		});
	}

	_onClose(options) {
		super._onClose?.(options);
		delete this.#actor.apps[this.id];
		if (this.#targetHook) { Hooks.off("targetToken", this.#targetHook); this.#targetHook = null; }
	}

	// @MARKER SHEET THEME
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
		// The dropdown changes rather than clicks, so it is bound here: the choice goes onto the actor.
		this.element.querySelector("select[name='name']")
			?.addEventListener("change", (event) => this.#choose(event.target.value));
		// Every other answer is the window's own; captured as it changes so a re-render keeps it.
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", () => this.#capture());
		}
		wireAimPicker(this.element);
		// A click on the figure sets the select without a change event, so it is captured here too
		// (after the picker's own listener, which was bound first).
		this.element.querySelector(".imagine-aim-picker")?.addEventListener("click", () => this.#capture());
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpactor = this.#actor;
		var tmpsys = tmpactor.system;
		var tmptarget = ImagineBrawling.#getTarget();
		var tmpareas = tmptarget?.actor?.system?.body?.areas ?? [];
		var tmpsituational = tmpsys.combat.situational;

		tmpcontext.actor = tmpactor;
		Object.assign(tmpcontext, buildBrawlingView(tmpsys.combat.brawlingWeapon, {
			weaponSpeedMod: tmpsys.combat.weaponSpeedMod,
			forceChance: getForceChance(tmpactor),
			areas: tmpareas,
			targetName: tmptarget?.name ?? "",
			targetNoDefense: !!tmptarget?.actor?.system?.combat?.noDefense,
			situationLine: describeSituationalTotals(tmpsituational),
			situationMelee: tmpsituational?.kind == "melee"
		}));

		// The window's own answers, back into their boxes.
		var tmpw = this.#working;
		tmpcontext.working = {
			aim: tmpw.aim ?? (tmpareas[0]?.name ?? ""),
			situational: tmpw.situational ?? 0,
			calledShot: !!tmpw.calledShot,
			calledShotMod: tmpw.calledShotMod ?? 0,
			fumbleMod: tmpw.fumbleMod ?? 0,
			useDefense: (tmpw.useDefense === undefined) ? !tmpcontext.targetNoDefense : !!tmpw.useDefense
		};
		tmpcontext.areas = tmpcontext.areas.map(tmparea => ({ ...tmparea, selected: tmparea.name == tmpcontext.working.aim }));

		// The target's own body as the aim picker (module/body-view.mjs), as the attack dialog has it.
		if (tmpareas.length && tmpcontext.askAim) {
			tmpcontext.bodyFigure = buildBodyFigure(tmpareas, { bodyType: tmptarget.actor.system.body?.type,
				picker: true, selected: tmpcontext.working.aim });
			await loadBodyTemplates();
		}
		return tmpcontext;
	}

	// This is the function which gives the one targeted token, or null -- several targeted is none,
	// as the weapon attack treats it.
	static #getTarget() {
		var tmptargets = Array.from(game.user?.targets ?? []);
		return tmptargets.length == 1 ? tmptargets[0] : null;
	}

	// @MARKER WRITING
	async #choose(tmpname) {
		await this.#actor.update({ "system.combat.brawlingWeapon": tmpname });
	}

	#capture() {
		var tmpform = this.element;
		var tmpread = (tmpselector) => tmpform.querySelector(tmpselector);
		this.#working = {
			aim: tmpread("select[name='aim']")?.value ?? this.#working.aim,
			situational: parseInt(tmpread("input[name='situational']")?.value) || 0,
			calledShot: !!tmpread("input[name='calledShot']")?.checked,
			calledShotMod: parseInt(tmpread("input[name='calledShotMod']")?.value) || 0,
			fumbleMod: Math.max(0, parseInt(tmpread("input[name='fumbleMod']")?.value) || 0),
			useDefense: tmpread("input[name='useDefense']") ? !!tmpread("input[name='useDefense']").checked : this.#working.useDefense
		};
	}

	// @MARKER THE ROLL
	// His ROLL and MOD as one: the modifier box stands in for his ?{Modifier} prompt, and at 0 it is
	// his plain ROLL.
	static async #onBrawl(event, target) {
		event.preventDefault();
		this.#capture();
		var tmpw = this.#working;
		await rollBrawlingAttack(this.#actor, {
			name: this.#actor.system.combat.brawlingWeapon,
			aim: tmpw.aim ?? "",
			situational: tmpw.situational ?? 0,
			calledShot: !!tmpw.calledShot,
			calledShotMod: tmpw.calledShotMod ?? 0,
			fumbleMod: tmpw.fumbleMod ?? 0,
			useDefense: (tmpw.useDefense === undefined) ? true : !!tmpw.useDefense
		}, ImagineBrawling.#getTarget());
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
