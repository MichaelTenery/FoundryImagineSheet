// @START (CODE)
// @MARKER ROUND CLOCK VIEW
//==================================================================================================================
// What the round clock shows: the bar under each combatant in the combat tracker, and the Mr.
// Initiative window that lines every combatant up on one ten-second chart. Both are built from
// resolveRoundClock's state (module/combat/round-rules.mjs) and share one template for the bar
// itself, templates/combat/clock-bar.hbs.
//
// No Foundry here, so tools/round-preview.html renders the real templates from the real view.
//
// THE BAR is ten columns, one per second. An ordinary second is one cell; a second split by extra
// seconds is two, "a" and "b", as his chart's Extra Seconds row draws them. Each cell is
//     lost      before the combatant could act -- a late initiative
//     carried   still finishing an action from last round
//     spent     used, shaded alternately so one action reads apart from the next
//     free      still to spend; the one marked "now" is where the combatant stands
//==================================================================================================================

import { ROUND_SECONDS } from "./combat/round-rules.mjs";

// What a cell's state means, for its tooltip.
//
//                     tooltip
const CLOCK_STATE_TITLES = {
	lost:              "lost to initiative",
	carried:           "finishing last round's action",
	spent:             "spent",
	free:              "free"
};

// This is the function which builds one combatant's clock for display. tmpclock is what the
// combatant stores (for its spends and its carry election); tmpinfo is what the caller knows
// about the combatant and the user:
//
//   { id, name, img, canSpend, current, speedSeconds, canEditSpeed }
export function buildClockView(tmpstate, tmpclock, tmpinfo = {}) {
	var tmpview = {
		id: tmpinfo.id ?? "",
		name: tmpinfo.name ?? "",
		img: tmpinfo.img ?? "",
		current: !!tmpinfo.current,
		ready: !!tmpstate?.ready,
		done: !!tmpstate?.done,
		canSpend: !!tmpinfo.canSpend,
		canUndo: !!tmpinfo.canSpend && (tmpclock?.spent?.length ?? 0) > 0,
		speedSeconds: parseInt(tmpinfo.speedSeconds) || 0,
		canEditSpeed: !!tmpinfo.canEditSpeed,
		extra: tmpstate?.extra ?? 0,
		split: "",
		columns: [],
		status: "",
		nowLabel: "",
		offhand: null,
		carry: null,
		carriedIn: "",
		log: []
	};
	if (!tmpstate?.ready) {
		tmpview.status = "Initiative not rolled";
		return tmpview;
	}

	// THE TEN COLUMNS
	for (var tmpsecond = 1; tmpsecond <= ROUND_SECONDS; tmpsecond++) {
		tmpview.columns.push({ second: tmpsecond, split: false, cells: [] });
	}
	for (const tmptick of tmpstate.ticks) {
		var tmpcolumn = tmpview.columns[tmptick.second - 1];
		if (tmptick.half) { tmpcolumn.split = true; }
		var tmpwhat = CLOCK_STATE_TITLES[tmptick.state] ?? tmptick.state;
		if (tmptick.state == "spent" && tmptick.title) { tmpwhat = tmptick.title; }
		tmpcolumn.cells.push({
			label: tmptick.label,
			state: tmptick.state,
			now: !!tmptick.now,
			extra: !!tmptick.extra,
			alt: tmptick.state == "spent" && (tmptick.action % 2) == 1,
			title: `Second ${tmptick.label}${tmptick.extra ? " (extra)" : ""}: ${tmpwhat}${tmptick.now ? " -- acts now" : ""}`
		});
	}

	// WHERE THEY STAND
	if (tmpstate.splitSecond !== null) { tmpview.split = "" + tmpstate.splitSecond; }
	if (tmpstate.done) {
		tmpview.nowLabel = "done";
		if (tmpstate.carry?.action) {
			tmpview.status = `Done: ${tmpstate.carry.seconds}s of the last action run into next round`;
		} else if (tmpstate.carry) {
			tmpview.status = `Done: initiative puts them at second ${tmpstate.carry.seconds + 1} of next round`;
		} else {
			tmpview.status = "Done for the round";
		}
	} else {
		var tmpnow = tmpstate.ticks[tmpstate.next];
		tmpview.nowLabel = tmpnow.label;
		tmpview.status = `Second ${tmpnow.label}`
			+ (tmpview.split ? ` (split ${tmpview.split})` : "")
			+ ` · ${tmpstate.left} left`;
	}

	// WHAT THEY CARRIED IN
	var tmpin = tmpstate.carriedIn;
	if (tmpin?.action) {
		tmpview.carriedIn = (tmpin.roll === null || tmpin.roll === undefined)
			? `Carrying ${tmpin.seconds}s of last round's action`
			: `Carried ${tmpin.seconds}s, then initiative ${tmpin.roll}`;
	} else if (tmpin) {
		tmpview.carriedIn = `Waited ${tmpin.seconds}s from last round's initiative`;
	}

	// THE OFF HAND, as pips: lost to the late start, spent, left, and run out with the round.
	var tmpoff = tmpstate.offhand;
	var tmppips = [];
	var tmpshownspent = Math.min(tmpoff.spent, tmpoff.pool);
	for (var tmpp = 0; tmpp < tmpoff.lost; tmpp++) { tmppips.push({ state: "lost" }); }
	for (var tmpp = 0; tmpp < tmpshownspent; tmpp++) { tmppips.push({ state: "spent" }); }
	for (var tmpp = 0; tmpp < tmpoff.left; tmpp++) { tmppips.push({ state: "free" }); }
	for (var tmpp = 0; tmpp < tmpoff.expired; tmpp++) { tmppips.push({ state: "expired" }); }
	tmpview.offhand = {
		pips: tmppips,
		left: tmpoff.left,
		pool: tmpoff.pool,
		over: tmpoff.over,
		text: `${tmpoff.left} of ${tmpoff.cap}`,
		overText: tmpoff.over ? `off hand over by ${tmpoff.over}` : "",
		title: `Off hand: ${tmpoff.cap} seconds, ${tmpoff.lost} lost to initiative, ${tmpoff.spent} spent, `
			+ `${tmpoff.left} left` + (tmpoff.expired ? `, ${tmpoff.expired} run out with the round` : "")
			+ (tmpoff.over ? `, ${tmpoff.over} more spent than it had` : "")
	};

	// WHAT RUNS OVER, and whether the combatant is carrying it.
	if (tmpstate.carry) {
		tmpview.carry = {
			seconds: tmpstate.carry.seconds,
			action: tmpstate.carry.action,
			elected: tmpclock?.carryOver !== false,
			text: tmpstate.carry.action ? `${tmpstate.carry.seconds}s` : `wait ${tmpstate.carry.seconds}s`,
			title: tmpstate.carry.action
				? "Carry the action over: no initiative next round until it finishes, then roll and add it"
				: "Carry the late start over: begin next round that far in, with no new roll"
		};
	}

	// WHAT THEY SPENT, in order
	for (const tmpentry of (tmpclock?.spent ?? [])) {
		tmpview.log.push(`${tmpentry.hand == "off" ? "off hand " : ""}${tmpentry.seconds}s`
			+ (tmpentry.label ? ` ${tmpentry.label}` : ""));
	}
	return tmpview;
} // END buildClockView

// @MARKER SURPRISE VIEW
// A surpriser's seconds before round 1, his chart's Surprise row, drawn in the same bar and the same
// row as a round clock so the tracker and the window need nothing new to show it. The places are the
// first columns of the bar -- surprise second 1 under second 1 -- so the bar still lines up; an
// action running past the surprise shows its extra seconds as "over", the ones carried into round 1.
//
//                     tooltip
const SURPRISE_STATE_TITLES = {
	spent:             "spent",
	free:              "free",
	over:              "runs into round 1"
};

// This is the function which builds one surpriser's surprise for display, in buildClockView's
// shape (with surprise: true), from resolveSurprise's state and the surprise as stored.
export function buildSurpriseView(tmpstate, tmpsurprise, tmpinfo = {}) {
	var tmpview = buildClockView(null, null, tmpinfo);
	tmpview.surprise = true;
	tmpview.ready = !!tmpstate?.active;
	tmpview.done = !!tmpstate?.done;
	tmpview.canUndo = !!tmpinfo.canSpend && (tmpsurprise?.spent?.length ?? 0) > 0;
	tmpview.status = "";
	if (!tmpstate?.active) { return tmpview; }

	for (const tmptick of tmpstate.ticks) {
		var tmpwhat = SURPRISE_STATE_TITLES[tmptick.state] ?? tmptick.state;
		if (tmptick.state != "free" && tmptick.title) { tmpwhat = tmptick.title + (tmptick.state == "over" ? ", into round 1" : ""); }
		tmpview.columns.push({ second: tmptick.second, split: false, cells: [{
			label: tmptick.label,
			state: tmptick.state,
			now: !!tmptick.now,
			extra: false,
			alt: tmptick.state == "spent" && (tmptick.action % 2) == 1,
			title: `Surprise second ${tmptick.second}: ${tmpwhat}${tmptick.now ? " -- acts now" : ""}`
		}] });
	}

	if (tmpstate.done) {
		tmpview.nowLabel = "done";
		tmpview.status = tmpstate.carry
			? `Surprise used: ${tmpstate.carry.seconds}s of the last action run into round 1`
			: "Surprise used: roll initiative for round 1";
	} else {
		tmpview.nowLabel = tmpstate.ticks[tmpstate.next].label;
		tmpview.status = `Surprise second ${tmpstate.next + 1} of ${tmpstate.seconds} · ${tmpstate.left} left`;
	}

	if (tmpstate.carry) {
		tmpview.carry = {
			seconds: tmpstate.carry.seconds,
			action: true,
			elected: tmpsurprise?.carryOver !== false,
			text: `${tmpstate.carry.seconds}s`,
			title: "Carry the action into round 1: no initiative until it finishes, then roll and add it"
		};
	}

	for (const tmpentry of (tmpsurprise?.spent ?? [])) {
		tmpview.log.push(`${tmpentry.hand == "off" ? "off hand " : ""}${tmpentry.seconds}s`
			+ (tmpentry.label ? ` ${tmpentry.label}` : ""));
	}
	return tmpview;
} // END buildSurpriseView


// @MARKER SHEET CLOCK
// What the Combat tab shows of the round clock, beside its Off-Hand Seconds box: read-only, the
// buttons stay in the tracker and the window.
//
//   tmpview    what buildClockView or buildSurpriseView built for the actor's combatant, or null
//              when the actor is not in the combat on show
//   tmpcap     the off hand's seconds, as the box shows them out of combat
//
// and it returns { inCombat, offhand, offhandSub, status, over }: the off hand's "3 of 5" and
// "left this round" when a round clock is running, the plain allowance otherwise, and the main
// hand's status line ("Second 7 · 4 left", or where the surprise stands).
export function buildSheetClockView(tmpview, tmpcap) {
	var tmpallowance = "" + (parseInt(tmpcap) || 0);
	var tmpout = { inCombat: false, offhand: tmpallowance, offhandSub: "", status: "", over: false };
	if (!tmpview) { return tmpout; }
	tmpout.inCombat = true;
	tmpout.status = tmpview.status ?? "";
	if (tmpview.surprise) {
		tmpout.offhandSub = "surprise: the off hand acts alongside";
	} else if (tmpview.ready && tmpview.offhand) {
		tmpout.offhand = tmpview.offhand.text;
		tmpout.offhandSub = "left this round";
		tmpout.over = !!tmpview.offhand.over;
		if (tmpout.over) { tmpout.offhandSub = tmpview.offhand.overText; }
	}
	return tmpout;
}

// This is the function which builds the Mr. Initiative window: every combatant's clock on one
// chart, in turn order, with the second the round has reached marked along the top.
//
//   tmprows   [ view from buildClockView or buildSurpriseView ] in turn order
//   tmpinfo   { round, isGM, over }
export function buildRoundView(tmprows, tmpinfo = {}) {
	var tmpnow = null;
	var tmpsurprise = (tmprows ?? []).some(r => r.surprise);
	for (const tmprow of tmprows ?? []) {
		if (!tmprow.ready || tmprow.done || tmprow.surprise) { continue; }
		var tmpsecond = parseInt(tmprow.nowLabel) || 0;
		if (tmpnow === null || tmpsecond < tmpnow) { tmpnow = tmpsecond; }
	}
	var tmpheaders = [];
	for (var tmpsecond = 1; tmpsecond <= ROUND_SECONDS; tmpsecond++) {
		tmpheaders.push({ label: "" + tmpsecond, now: tmpsecond === tmpnow });
	}
	var tmpover = !!tmpinfo.over;
	return {
		round: tmpinfo.round ?? 0,
		isGM: !!tmpinfo.isGM,
		rows: tmprows ?? [],
		headers: tmpheaders,
		over: tmpover,
		surprise: tmpsurprise,
		nowText: tmpsurprise ? "Surprise: the surprisers act before initiative is rolled"
			: !tmpinfo.round ? "Combat has not begun"
			: tmpover ? "Every combatant is past the tenth second"
			: tmpnow === null ? "Waiting on initiative"
			: `Second ${tmpnow}`
	};
}
// @END (CODE)
