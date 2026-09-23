// @START (CODE)
// @MARKER IMAGINE COMBAT TRACKER
//==================================================================================================================
// Foundry's combat tracker, with each combatant's round clock drawn under their row: the ten
// seconds of the round (lost to a late start, spent, left, and where they stand now), the off
// hand's seconds, and buttons to spend a second, spend several, take the last spend back, and
// carry over what runs past the end of the round. A stopwatch at the top opens the Mr. Initiative
// window, which lines everyone's clock up on one chart.
//
// Nothing about the tracker's own template is replaced -- the clock is added under each row after
// Foundry has drawn it -- so a Foundry update to the tracker's layout does not have to be copied
// here. The clock itself is the combatant's (module/combat/combat-document.mjs); drawing it is
// module/round-view.mjs; the buttons are shared with the window (module/apps/round-clock.mjs).
//==================================================================================================================

import ImagineRoundClock, {
	buildCombatantClockView, loadClockTemplates, onClockSpend, onClockUndo, onClockCarry
} from "../apps/round-clock.mjs";

const CombatTracker = foundry.applications.sidebar.tabs.CombatTracker;
const CLOCK_ROW_TEMPLATE = "systems/imagine-rpg/templates/combat/clock-row.hbs";

export default class ImagineCombatTracker extends CombatTracker {

	static DEFAULT_OPTIONS = {
		actions: {
			imagineSpendSeconds: ImagineCombatTracker.#onSpend,
			imagineUndoSeconds:  ImagineCombatTracker.#onUndo,
			imagineToggleCarry:  ImagineCombatTracker.#onCarry,
			imagineRoundClock:   ImagineCombatTracker.#onOpenRoundClock
		}
	};

	// This is the function which adds each combatant's clock, drawn, to what the tracker knows
	// about their row. Nothing is drawn for someone with no initiative yet: their row already has
	// Foundry's roll button, and an empty chart would say nothing more.
	async _prepareTurnContext(tmpcombat, tmpcombatant, tmpindex) {
		var tmpturn = await super._prepareTurnContext(tmpcombat, tmpcombatant, tmpindex);
		var tmpview = buildCombatantClockView(tmpcombat, tmpcombatant);
		tmpturn.imagineClock = "";
		if (tmpview.ready) {
			await loadClockTemplates();
			tmpturn.imagineClock = await foundry.applications.handlebars.renderTemplate(CLOCK_ROW_TEMPLATE, tmpview);
		}
		return tmpturn;
	}

	// This is the function which puts each clock under its row once Foundry has drawn the tracker,
	// and the stopwatch into the header. Only the parts that were redrawn are touched: the header
	// and the list re-render separately.
	async _onRender(tmpcontext, tmpoptions) {
		await super._onRender(tmpcontext, tmpoptions);
		var tmpparts = tmpoptions?.parts ?? ["header", "tracker", "footer"];

		if (tmpparts.includes("tracker")) {
			for (const tmpturn of (tmpcontext.turns ?? [])) {
				var tmprow = this.element.querySelector(`li.combatant[data-combatant-id="${tmpturn.id}"]`);
				if (!tmprow) { continue; }
				tmprow.querySelector(".imagine-clock-row")?.remove();
				tmprow.classList.toggle("imagine-clocked", !!tmpturn.imagineClock);
				if (!tmpturn.imagineClock) { continue; }
				tmprow.insertAdjacentHTML("beforeend", tmpturn.imagineClock);

				// Two quick +1s are a double click, which the tracker takes as "open this actor's
				// sheet" -- so a double click on the clock goes no further than the clock.
				tmprow.querySelector(".imagine-clock-row")
					?.addEventListener("dblclick", (event) => event.stopPropagation());
			}
		}
		if (tmpparts.includes("header")) { this.#addRoundClockButton(); }

		ImagineRoundClock.refresh();
	}

	// This is the function which puts the stopwatch for the Mr. Initiative window into the header's
	// right-hand controls, in the place Foundry leaves empty with a spacer.
	#addRoundClockButton() {
		var tmpcontrols = this.element.querySelector(".encounter-controls .control-buttons.right");
		if (!tmpcontrols || tmpcontrols.querySelector("[data-action='imagineRoundClock']")) { return; }
		var tmpbutton = document.createElement("button");
		tmpbutton.type = "button";
		tmpbutton.className = "inline-control combat-control icon fa-solid fa-stopwatch";
		tmpbutton.dataset.action = "imagineRoundClock";
		tmpbutton.dataset.tooltip = "Mr. Initiative: every combatant's seconds this round";
		tmpbutton.setAttribute("aria-label", "Mr. Initiative");
		var tmpspacer = tmpcontrols.querySelector(".spacer");
		if (tmpspacer) { tmpspacer.replaceWith(tmpbutton); } else { tmpcontrols.prepend(tmpbutton); }
	}

	static async #onSpend(event, target) { await onClockSpend(this.viewed, target); }
	static async #onUndo(event, target) { await onClockUndo(this.viewed, target); }
	static async #onCarry(event, target) { await onClockCarry(this.viewed, target); }
	static #onOpenRoundClock() { ImagineRoundClock.open(); }
}
// @END (CODE)
