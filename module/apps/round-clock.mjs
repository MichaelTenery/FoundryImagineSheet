// @START (CODE)
// @MARKER MR. INITIATIVE WINDOW
//==================================================================================================================
// The Mr. Initiative window: his round-timing chart (Master's Manual pp.98-100), every combatant's
// ten seconds on one chart, lined up by second so a Game Master can see at a glance who is where
// in the round -- "a visual system that the GM can use to keep up with the timing relationships of
// all combatants in the 10 second combat round". His chart was a sheet to photocopy with markers
// on it; here each marker is a combatant's clock (module/combat/round-rules.mjs), and the same
// clock is drawn under every combatant in the combat tracker too.
//
// What each row shows, left to right: the Split Second (a roll below 1, ordering the first second),
// the ten seconds (lost, carried, spent, free; the combatant's place marked), the off hand's
// seconds as pips, the extra seconds from a Speed effect (editable by whoever owns the actor), and
// what runs into the next round with the button that carries it or declines it. Underneath, where
// they stand, what they have spent, and the buttons that spend time.
//
// Open it from the stopwatch at the top of the Combat tracker, or from a macro:
//     game.imagine.roundClock()
//
// The functions under @MARKER CLOCK ACTIONS are shared with the tracker's rows, so a button does
// the same thing wherever it is pressed.
//==================================================================================================================

import { getCombatantClock, getCombatantClockState } from "../combat/combat-document.mjs";
import { resolveRoundClock, getClockOptions, isRoundOver, MAX_EXTRA_SECONDS } from "../combat/round-rules.mjs";
import { buildClockView, buildRoundView } from "../round-view.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// The shared bar, registered as a partial under this name so both templates can include it.
const CLOCK_PARTIALS = {
	"imagine-clock-bar": "systems/imagine-rpg/templates/combat/clock-bar.hbs"
};
var tmpClockTemplatesReady = null;

// This is the function which loads the clock's shared partial, once. Called at init, and awaited
// again before anything renders a clock, so a tracker that draws before the fetch has finished
// waits for it rather than failing on a missing partial.
export function loadClockTemplates() {
	if (!tmpClockTemplatesReady) {
		tmpClockTemplatesReady = foundry.applications.handlebars.loadTemplates(CLOCK_PARTIALS);
	}
	return tmpClockTemplatesReady;
}

// This is the function which builds one combatant's clock as the current user sees it: the owner
// of a combatant (and the Game Master) may spend its time; the owner of its actor may set its
// Speed seconds.
export function buildCombatantClockView(tmpcombat, tmpcombatant) {
	var tmpclock = getCombatantClock(tmpcombatant);
	var tmpstate = resolveRoundClock(tmpclock, getClockOptions(tmpcombatant.actor));
	return buildClockView(tmpstate, tmpclock, {
		id: tmpcombatant.id,
		name: tmpcombatant.name,
		img: tmpcombatant.img,
		current: tmpcombat?.combatant?.id == tmpcombatant.id,
		canSpend: tmpcombatant.isOwner,
		speedSeconds: tmpcombatant.actor?.system?.combat?.speedSeconds ?? 0,
		canEditSpeed: !!tmpcombatant.actor?.isOwner
	});
}


//==================================================================================================================
// @MARKER CLOCK ACTIONS
//==================================================================================================================

	// This is the function which finds the combatant a clicked clock button belongs to: every row,
	// in the tracker and in the window, carries its combatant's id.
	function getClickedCombatant(tmpcombat, tmptarget) {
		var tmpid = tmptarget?.closest("[data-combatant-id]")?.dataset.combatantId;
		return tmpid ? (tmpcombat?.combatants.get(tmpid) ?? null) : null;
	}

	// This is the function which escapes text for a dialog. Combatant names are user-editable.
	function esc(tmptext) {
		return foundry.utils.escapeHTML(String(tmptext ?? ""));
	}

	// This is the function which spends time from a clock button: one second outright (holding,
	// passing, a quick action -- "a character will not always be fighting every second"), or as
	// many as asked, on either hand. A weapon's own swing is spent from its attack card instead,
	// which knows the weapon's speed and which hand holds it.
	export async function onClockSpend(tmpcombat, tmptarget) {
		var tmpcombatant = getClickedCombatant(tmpcombat, tmptarget);
		if (!tmpcombatant || typeof tmpcombat.spendSeconds != "function") { return; }
		if (tmptarget.dataset.seconds != "ask") {
			return await tmpcombat.spendSeconds(tmpcombatant, parseInt(tmptarget.dataset.seconds) || 1, { hand: "main" });
		}
		var tmpanswer = await askSpendSeconds(tmpcombatant);
		if (!tmpanswer) { return; }
		return await tmpcombat.spendSeconds(tmpcombatant, tmpanswer.seconds,
			{ hand: tmpanswer.hand, label: tmpanswer.label });
	}

	// This is the function which takes back the last spend from a clock button.
	export async function onClockUndo(tmpcombat, tmptarget) {
		var tmpcombatant = getClickedCombatant(tmpcombat, tmptarget);
		if (!tmpcombatant || typeof tmpcombat.undoSeconds != "function") { return; }
		return await tmpcombat.undoSeconds(tmpcombatant);
	}

	// This is the function which flips whether a combatant carries over what runs past the round.
	export async function onClockCarry(tmpcombat, tmptarget) {
		var tmpcombatant = getClickedCombatant(tmpcombat, tmptarget);
		if (!tmpcombatant || typeof tmpcombat.setCarryOver != "function") { return; }
		return await tmpcombat.setCarryOver(tmpcombatant, getCombatantClock(tmpcombatant).carryOver === false);
	}

	// This is the function which asks how many seconds to spend, on which hand, and on what. The
	// hand's own seconds left are shown beside it, since the off hand runs out on its own.
	async function askSpendSeconds(tmpcombatant) {
		var tmpstate = getCombatantClockState(tmpcombatant);
		var tmpname = esc(tmpcombatant.name);
		var tmpcontent = `<div class="imagine-dialog">
			<div class="form-group"><label>Seconds</label>
				<input type="number" name="seconds" value="1" min="1" max="60" autofocus></div>
			<div class="form-group"><label>Hand</label>
				<select name="hand">
					<option value="main">Main hand (${tmpstate.left} left)</option>
					<option value="off">Off hand (${tmpstate.offhand.left} left)</option>
				</select>
				<p class="hint">An off-hand action runs alongside the main hand -- a shield parry while the sword
				swings -- so it spends the off hand's seconds and does not move ${tmpname} along the round.</p></div>
			<div class="form-group"><label>On</label>
				<input type="text" name="label" placeholder="Parry, draw a weapon, move, reload..."></div>
		</div>`;
		return await foundry.applications.api.DialogV2.prompt({
			window: { title: `${tmpcombatant.name}: spend seconds` },
			content: tmpcontent,
			rejectClose: false,
			ok: {
				label: "Spend",
				callback: (event, button) => {
					var tmpform = button.form.elements;
					return {
						seconds: Math.max(1, parseInt(tmpform.seconds.value) || 1),
						hand: tmpform.hand.value == "off" ? "off" : "main",
						label: ("" + tmpform.label.value).trim()
					};
				}
			}
		});
	} // END askSpendSeconds


//==================================================================================================================
// @MARKER THE WINDOW
//==================================================================================================================

export default class ImagineRoundClock extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "imagine-round-clock",
		tag: "div",
		classes: ["imagine", "round-clock-window"],
		window: { title: "Mr. Initiative", icon: "fa-solid fa-stopwatch", resizable: true },
		position: { width: 820, height: 440 },
		actions: {
			imagineSpendSeconds: ImagineRoundClock.#onSpend,
			imagineUndoSeconds:  ImagineRoundClock.#onUndo,
			imagineToggleCarry:  ImagineRoundClock.#onCarry,
			nextRound:           ImagineRoundClock.#onNextRound
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/round-clock.hbs", scrollable: [".round-clock-body"] }
	};

	// This is the function which opens the window, or brings it forward if it is open already.
	static open() {
		var tmpexisting = foundry.applications.instances.get("imagine-round-clock");
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineRoundClock().render(true);
	}

	// This is the function which redraws the window if it is open. The combat tracker calls it
	// every time it redraws itself, which it does on every change to the combat or a combatant --
	// so the window needs no hooks of its own.
	static refresh() {
		var tmpexisting = foundry.applications.instances.get("imagine-round-clock");
		if (tmpexisting?.rendered) { tmpexisting.render(); }
	}

	// The combat on show: whichever the tracker is viewing, else the active one.
	get combat() {
		return ui.combat?.viewed ?? game.combat ?? null;
	}

	// @MARKER SHEET THEME
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);

		// The Speed box changes rather than clicks, and an ApplicationV2 action is dispatched from a
		// click, so it is bound here.
		for (const tmpinput of this.element.querySelectorAll("input[name='speedSeconds']")) {
			tmpinput.addEventListener("change", (event) => this.#setSpeedSeconds(event.target));
		}
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		await loadClockTemplates();
		var tmpcombat = this.combat;
		var tmprows = [];
		var tmpover = false;
		if (tmpcombat) {
			for (const tmpcombatant of tmpcombat.turns) {
				if (!tmpcombatant.visible) { continue; }
				tmprows.push(buildCombatantClockView(tmpcombat, tmpcombatant));
			}
			tmpover = isRoundOver(tmpcombat.combatants.filter(c => !c.isDefeated).map(c => getCombatantClockState(c)));
		}
		Object.assign(tmpcontext, buildRoundView(tmprows, {
			round: tmpcombat?.round ?? 0, isGM: game.user.isGM, over: tmpover
		}));
		return tmpcontext;
	}

	// This is the function which writes the extra seconds a Speed effect gives onto the actor, where
	// his sheet kept them (tmp_speed_seconds), so they last as long as the effect does rather than
	// one round. Ten at most.
	async #setSpeedSeconds(tmpinput) {
		var tmpcombatant = getClickedCombatant(this.combat, tmpinput);
		if (!tmpcombatant?.actor?.isOwner) { return; }
		var tmpvalue = Math.min(MAX_EXTRA_SECONDS, Math.max(0, parseInt(tmpinput.value) || 0));
		await tmpcombatant.actor.update({ "system.combat.speedSeconds": tmpvalue });
	}

	static async #onSpend(event, target) { await onClockSpend(this.combat, target); }
	static async #onUndo(event, target) { await onClockUndo(this.combat, target); }
	static async #onCarry(event, target) { await onClockCarry(this.combat, target); }
	static async #onNextRound() { await this.combat?.nextRound(); }
}
// @END (CODE)
