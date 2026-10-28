// @START (CODE)
// @MARKER GRAPPLING WINDOW
//==================================================================================================================
// The Grappling window: his GRAPPLING row -- a dropdown of fifteen moves, ROLL and MOD, and the boxes
// Speed, Min, Mod and Damage -- stood up as one window beside the sheet.
//
// Pick a move (Touch, Grapple, Strangle, Claw, Bite, Escape, Ear Rip, Eye Gouge, Hold, Knee/Elbow, Pin,
// Punch, Tackle, Throw, Slam), see its figures and what it needs, and press Roll. The choice is written
// to the actor as his all_grapple_moves was, so it is there next time. The modifier box stands in for his
// MOD button's ?{Modifier} prompt; at 0 it is his plain ROLL.
//
// Open it from the Combat tab of a character or creature, or from a macro:
//     game.imagine.grappling(actor)
//
// Nothing here is a rule. The figures are in module/combat/grappling-rules.mjs, the roll is
// module/combat/grappling-attack.mjs, and what is shown is built by module/grappling-view.mjs, which the
// test renders too.
//==================================================================================================================

import { buildGrapplingView } from "../grappling-view.mjs";
import { rollGrapplingMove } from "../combat/grappling-attack.mjs";
import { describeSituationalTotals } from "../situational-view.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineGrappling extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "grappling"],
		window: { title: "Grappling", resizable: true },
		position: { width: 480, height: "auto" },
		actions: {
			grapple: ImagineGrappling.#onGrapple,
			done:    ImagineGrappling.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/grappling.hbs" }
	};

	#actor = null;
	// The window's own answer -- the modifier -- kept across the re-render an actor update causes.
	#working = {};

	// One window per actor, keyed by uuid as the Brawling window is, so an unlinked token's window is its
	// own and not its base actor's.
	static windowId(tmpactor) {
		return `imagine-grappling-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineGrappling.windowId(tmpactor) });
		this.#actor = tmpactor;
	}

	get title() {
		return `Grappling: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(ImagineGrappling.windowId(tmpactor));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineGrappling(tmpactor).render(true);
	}

	// Registered with the actor so the window follows the actor's changes (the choice written, a stance
	// taken, Situation Mods set).
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
		// The dropdown changes rather than clicks, so it is bound here: the choice goes onto the actor.
		this.element.querySelector("select[name='name']")
			?.addEventListener("change", (event) => this.#choose(event.target.value));
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", () => this.#capture());
		}
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpactor = this.#actor;
		var tmpsys = tmpactor.system;
		tmpcontext.actor = tmpactor;
		Object.assign(tmpcontext, buildGrapplingView(tmpsys.combat.grapplingMove, {
			weaponSpeedMod: tmpsys.combat.weaponSpeedMod,
			noHands: (tmpsys.identity?.race?.disabilities ?? []).includes("All manipulator limbs lost"),
			situationLine: describeSituationalTotals(tmpsys.combat.situational)
		}));
		tmpcontext.working = { modifier: this.#working.modifier ?? 0 };
		return tmpcontext;
	}

	// @MARKER WRITING
	async #choose(tmpname) {
		await this.#actor.update({ "system.combat.grapplingMove": tmpname });
	}

	#capture() {
		this.#working = { modifier: parseInt(this.element.querySelector("input[name='modifier']")?.value) || 0 };
	}

	// @MARKER THE ROLL
	static async #onGrapple(event, target) {
		event.preventDefault();
		this.#capture();
		await rollGrapplingMove(this.#actor, {
			name: this.#actor.system.combat.grapplingMove,
			modifier: this.#working.modifier ?? 0
		});
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
