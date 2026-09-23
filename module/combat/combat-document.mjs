// @START (CODE)
// @MARKER IMAGINE COMBAT
//==================================================================================================================
// The combat tracker, adapted to the 10 second round.
//
// In Imagine, initiative is not a place in a queue -- it is the SECOND of the round in which a
// combatant starts acting, rolled on a d10 with Agility or Intelligence modifying it. Lower is
// earlier. So the tracker sorts lowest first, which is the reverse of Foundry's default.
//
// Every action then costs time: a swing takes as many seconds as the weapon's speed. Spending
// seconds moves a combatant later in the round by that much, and the tracker re-sorts, so whoever
// has the earliest free second is always at the top. That is the event-time round -- built from
// the tracker Foundry already has, rather than a separate clock.
//
// @MARKER ROUND CLOCK
// Each combatant also carries a CLOCK for the round (module/combat/round-rules.mjs): the initiative
// they rolled and every spend since, main hand and off hand, so the tracker can draw his "Mr.
// Initiative" chart -- the seconds lost to a late start, spent, and left -- and so a spend can be
// taken back. It is kept in the combatant's flags because a player may write the flags and the
// initiative of their own combatant and nothing else of it (BaseCombatant's update permission).
// The initiative number stays what the tracker sorts and shows; the clock is the history behind it.
//
// Any initiative written by anything other than the clock -- a roll, the Game Master typing one
// into the tracker -- is a new start, and the clock starts again from it (ImagineCombatant below).
//
// When every combatant is past the tenth second the round is over, and a new one begins with fresh
// initiative, as the Player's Guide describes -- except for anyone CARRYING OVER an action still
// under way, or an initiative that lay past the tenth second (Player's Guide p.168, Carry-Over).
// They start the new round where the carry puts them, with no roll; an action that finishes in
// the new round rolls for the reaction then, and adds it to its last second.
//
// @MARKER SURPRISE
// Before round 1 there may be a SURPRISE: seconds of unanswered action a surpriser spends before
// initiative is rolled (Player's Guide p.168; his chart's Surprise row). It is kept beside the clock
// in the combatant's flags, as flags.imagine-rpg.surprise, and while a combatant has one, every spend
// and undo of theirs is the surprise's rather than the round's. The Game Master gives it
// (giveSurprise, from the Mr. Initiative window) and ends it (endSurprise), which begins round 1:
// an action still under way is carried into it, and anything unspent is gone.
//==================================================================================================================

import {
	resolveRoundClock, getClockOptions, getClockSortKey, getClockInitiative, isRoundOver,
	newRoundClock, copyClock, addClockSpend, removeLastClockSpend,
	getCarryForNextRound, getNextRoundClock, needsCarryRoll, setCarryRoll,
	newSurprise, copySurprise, isSurpriseActive, addSurpriseSpend, removeLastSurpriseSpend,
	resolveSurprise, getSurpriseCarry, getSurpriseSortKey
} from "./round-rules.mjs";

// This is the function which reads a combatant's clock for the round in play. A clock stored for
// another round is not this round's, and neither is one whose initiative has since been cleared
// (the tracker's Reset Initiative writes the whole combat at once and never touches the flags); in
// either case the clock is started afresh from the initiative as it stands, or not at all.
export function getCombatantClock(tmpcombatant) {
	var tmpround = tmpcombatant?.parent?.round ?? 0;
	var tmpinitiative = tmpcombatant?.initiative;
	var tmphasinitiative = Number.isFinite(tmpinitiative);
	var tmpstored = tmpcombatant?.flags?.["imagine-rpg"]?.clock;
	if (tmpstored && (tmpstored.round == tmpround) && tmphasinitiative) { return copyClock(tmpstored); }
	return newRoundClock(tmpround, tmphasinitiative ? tmpinitiative : null);
}

// This is the function which works out what a combatant's clock means this round.
export function getCombatantClockState(tmpcombatant) {
	return resolveRoundClock(getCombatantClock(tmpcombatant), getClockOptions(tmpcombatant?.actor));
}

// This is the function which reads a combatant's surprise, or null if they have none running.
// Unlike the clock it is not keyed by round: it belongs to the time before round 1, and lasts until
// the Game Master ends it.
export function getCombatantSurprise(tmpcombatant) {
	var tmpstored = tmpcombatant?.flags?.["imagine-rpg"]?.surprise;
	return isSurpriseActive(tmpstored) ? copySurprise(tmpstored) : null;
}

// This is the function which works out what a combatant's surprise means, or null without one.
export function getCombatantSurpriseState(tmpcombatant) {
	var tmpsurprise = getCombatantSurprise(tmpcombatant);
	return tmpsurprise ? resolveSurprise(tmpsurprise) : null;
}

// This is the function which says whether any combatant in a combat still has a surprise running.
export function hasActiveSurprise(tmpcombat) {
	return !!tmpcombat?.combatants?.some(c => !!getCombatantSurprise(c));
}

// This is the function which says whether a combatant is carrying over what runs past the end of
// the time they are in: the surprise while they have one, else the round.
export function isCarryOverElected(tmpcombatant) {
	var tmpsurprise = getCombatantSurprise(tmpcombatant);
	if (tmpsurprise) { return tmpsurprise.carryOver !== false; }
	return getCombatantClock(tmpcombatant).carryOver !== false;
}

export default class ImagineCombat extends Combat {

	// This is the function which orders the tracker: earliest second first, a sped combatant's
	// extra half-second ahead of the ordinary second it splits, a negative roll ordering the first
	// second (getClockSortKey). On a tie, the higher Agility goes first, and if that is tied too,
	// the higher Intelligence (Player's Guide, Initiative). Anyone who has not rolled goes to the
	// bottom. Foundry calls this unbound, so it reads the round off each combatant, not off `this`.
	_sortCombatants(tmpa, tmpb) {
		// A surpriser with surprise seconds still to spend goes ahead of everyone (getSurpriseSortKey).
		var tmpia = getSurpriseSortKey(getCombatantSurpriseState(tmpa)) ?? getClockSortKey(getCombatantClockState(tmpa));
		var tmpib = getSurpriseSortKey(getCombatantSurpriseState(tmpb)) ?? getClockSortKey(getCombatantClockState(tmpb));
		if (tmpia != tmpib) { return tmpia - tmpib; }

		var tmpagla = tmpa.actor?.system?.attributes?.agl?.value ?? 0;
		var tmpaglb = tmpb.actor?.system?.attributes?.agl?.value ?? 0;
		if (tmpagla != tmpaglb) { return tmpaglb - tmpagla; }

		var tmpinta = tmpa.actor?.system?.attributes?.int?.value ?? 0;
		var tmpintb = tmpb.actor?.system?.attributes?.int?.value ?? 0;
		if (tmpinta != tmpintb) { return tmpintb - tmpinta; }

		return tmpa.id > tmpb.id ? 1 : -1;
	}

	// This is the function which spends a combatant's time. A main-hand spend moves them on by that
	// many seconds and the tracker jumps back to the top, which is now whoever is free soonest; an
	// off-hand spend comes out of the off hand's own seconds and moves nobody.
	//
	//   tmpoptions = { hand: "main" | "off", label: what the seconds went on }
	//
	// Nothing is refused. Spending past the end of the round runs into the next (carried over if
	// the round ends that way), and an off hand spent past what it had is shown in red on the
	// clock; either is said, because the Game Master may know better -- a held action, a ruling.
	async spendSeconds(tmpcombatant, tmpseconds, tmpoptions = {}) {
		// During a surprise the seconds are the surprise's (@MARKER SURPRISE below).
		if (getCombatantSurprise(tmpcombatant)) { return await this.spendSurpriseSeconds(tmpcombatant, tmpseconds, tmpoptions); }
		var tmpactoroptions = getClockOptions(tmpcombatant.actor);
		var tmpclock = getCombatantClock(tmpcombatant);
		var tmpbefore = resolveRoundClock(tmpclock, tmpactoroptions);
		if (!tmpbefore.ready) {
			ui.notifications.warn(`${tmpcombatant.name} has not rolled initiative this round.`);
			return null;
		}

		var tmphand = tmpoptions.hand == "off" ? "off" : "main";
		var tmpafterclock = addClockSpend(tmpclock, tmpseconds, tmphand, tmpoptions.label);
		var tmpafter = resolveRoundClock(tmpafterclock, tmpactoroptions);
		var tmpspent = tmpafterclock.spent[tmpafterclock.spent.length - 1].seconds;

		if (tmphand == "main" && tmpbefore.done) {
			ui.notifications.info(`${tmpcombatant.name} has no seconds left this round; `
				+ `these ${tmpspent} run into the next.`);
		}
		if (tmphand == "off" && tmpspent > tmpbefore.offhand.left) {
			ui.notifications.warn(`${tmpcombatant.name}'s off hand had ${tmpbefore.offhand.left} `
				+ `second${tmpbefore.offhand.left == 1 ? "" : "s"} left this round, and ${tmpspent} were spent.`);
		}

		await this.#writeClock(tmpcombatant, tmpafterclock, tmpafter);
		if (!tmpbefore.done && tmpafter.done) { this.#announceRoundOver(); }
		return tmpafter;
	}

	// This is the function which takes back the last seconds a combatant spent.
	async undoSeconds(tmpcombatant) {
		var tmpsurprise = getCombatantSurprise(tmpcombatant);
		if (tmpsurprise) {
			if (!tmpsurprise.spent.length) {
				ui.notifications.info(`${tmpcombatant.name} has spent nothing of the surprise to take back.`);
				return null;
			}
			var tmpaftersurprise = removeLastSurpriseSpend(tmpsurprise);
			await this.#writeSurprise(tmpcombatant, tmpaftersurprise);
			return resolveSurprise(tmpaftersurprise);
		}
		var tmpclock = getCombatantClock(tmpcombatant);
		if (!tmpclock.spent.length) {
			ui.notifications.info(`${tmpcombatant.name} has spent nothing this round to take back.`);
			return null;
		}
		var tmpafterclock = removeLastClockSpend(tmpclock);
		var tmpafter = resolveRoundClock(tmpafterclock, getClockOptions(tmpcombatant.actor));
		await this.#writeClock(tmpcombatant, tmpafterclock, tmpafter);
		return tmpafter;
	}

	// This is the function which records whether a combatant carries over what is running past the
	// end of this round. On by default, since an action under way is usually meant to finish;
	// turned off, the combatant rolls a fresh initiative next round instead.
	async setCarryOver(tmpcombatant, tmpelected) {
		var tmpsurprise = getCombatantSurprise(tmpcombatant);
		if (tmpsurprise) {
			tmpsurprise.carryOver = !!tmpelected;
			await this.#writeSurprise(tmpcombatant, tmpsurprise);
			return;
		}
		var tmpclock = getCombatantClock(tmpcombatant);
		tmpclock.carryOver = !!tmpelected;
		await tmpcombatant.update({ "flags.imagine-rpg.clock": tmpclock }, { imagineClock: true });
	}

	// This is the function which writes a clock and the initiative that goes with it, then puts the
	// tracker's turn back on whoever is free soonest. The imagineClock option tells
	// ImagineCombatant that this initiative is the clock's own, not a new start.
	async #writeClock(tmpcombatant, tmpclock, tmpstate) {
		await tmpcombatant.update({
			initiative: getClockInitiative(tmpstate),
			"flags.imagine-rpg.clock": tmpclock
		}, { imagineClock: true });
		if (this.canUserModify(game.user, "update", { turn: 0 })) { await this.update({ turn: 0 }); }
	}

	// This is the function which says so when the round is over -- everyone still standing is past
	// their last second. The round itself is advanced by the Game Master, not by this, since an
	// off hand may still have something to do.
	#announceRoundOver() {
		var tmpstates = this.combatants.filter(c => !c.isDefeated).map(c => getCombatantClockState(c));
		if (isRoundOver(tmpstates)) {
			ui.notifications.info("Every combatant is past the tenth second. The round is over.");
		}
	}

	// @MARKER SURPRISE
	// The Surprise row of his chart: seconds a surpriser spends before round 1. See the notes at the
	// head of this file and @MARKER SURPRISE in round-rules.mjs.

	// This is the function which gives surprise seconds to the combatants chosen, replacing any
	// surprise they had. A figure of 0 takes a combatant's surprise away. The Game Master rolls the
	// 1d4+1 (or rules on a figure) before this is called, from the Mr. Initiative window.
	//
	//   tmpentries = [ { combatant, seconds } ]
	async giveSurprise(tmpentries) {
		var tmpupdates = [];
		for (const tmpentry of (tmpentries ?? [])) {
			var tmpcombatant = tmpentry?.combatant;
			if (!tmpcombatant) { continue; }
			var tmpsurprise = newSurprise(tmpentry.seconds);
			tmpupdates.push({
				_id: tmpcombatant.id,
				"flags.imagine-rpg.surprise": isSurpriseActive(tmpsurprise) ? tmpsurprise : null
			});
		}
		if (!tmpupdates.length) { return; }
		await this.updateEmbeddedDocuments("Combatant", tmpupdates, { imagineClock: true, turnEvents: false });
		if (this.canUserModify(game.user, "update", { turn: 0 })) { await this.update({ turn: 0 }); }
	}

	// This is the function which spends a surpriser's seconds. Like a spend in the round, nothing is
	// refused: an action that runs past the surprise is carried into round 1 when it ends (unless
	// declined), and that is said. An off-hand spend is recorded and costs the surprise nothing.
	async spendSurpriseSeconds(tmpcombatant, tmpseconds, tmpoptions = {}) {
		var tmpsurprise = getCombatantSurprise(tmpcombatant);
		if (!tmpsurprise) { return null; }
		var tmpbefore = resolveSurprise(tmpsurprise);
		var tmphand = tmpoptions.hand == "off" ? "off" : "main";
		var tmpaftersurprise = addSurpriseSpend(tmpsurprise, tmpseconds, tmphand, tmpoptions.label);
		var tmpafter = resolveSurprise(tmpaftersurprise);

		if (tmphand == "main" && tmpafter.overrun > tmpbefore.overrun) {
			ui.notifications.info(`${tmpcombatant.name} had ${tmpbefore.left} second${tmpbefore.left == 1 ? "" : "s"} `
				+ `of surprise left; the rest of this action runs into round 1.`);
		}

		await this.#writeSurprise(tmpcombatant, tmpaftersurprise);
		if (!tmpbefore.done && tmpafter.done) { this.#announceSurpriseUsed(); }
		return tmpafter;
	}

	// This is the function which ends the surprise and begins round 1. Each surpriser's surprise is
	// cleared; one whose action runs past it carries that action into the round -- no initiative
	// until it finishes, then a reaction roll added to its last second, rolled now and posted, as
	// nextRound does for a carry. Everyone else rolls initiative as usual. The combat is started if
	// it had not been, since the combat round begins when the surprise is over.
	async endSurprise() {
		var tmpsurprisers = this.combatants.filter(c => !!getCombatantSurprise(c));
		if (!tmpsurprisers.length) { return null; }
		if (!this.started) { await this.startCombat(); }

		var tmpupdates = [];
		var tmpmessages = [];
		for (const tmpcombatant of tmpsurprisers) {
			var tmpsurprise = getCombatantSurprise(tmpcombatant);
			var tmpcarry = getSurpriseCarry(resolveSurprise(tmpsurprise), tmpsurprise);
			var tmpupdate = { _id: tmpcombatant.id, "flags.imagine-rpg.surprise": null };
			if (tmpcarry) {
				var tmpoptions = getClockOptions(tmpcombatant.actor);
				var tmpnewclock = getNextRoundClock(tmpcarry, this.round);
				if (needsCarryRoll(tmpnewclock, tmpoptions)) {
					var tmproll = tmpcombatant.getInitiativeRoll();
					await tmproll.evaluate();
					tmpnewclock = setCarryRoll(tmpnewclock, tmproll.total);
					tmpmessages.push(await this.#carryRollMessage(tmpcombatant, tmproll,
						resolveRoundClock(tmpnewclock, tmpoptions), "the action begun in surprise"));
				}
				tmpupdate.initiative = getClockInitiative(resolveRoundClock(tmpnewclock, tmpoptions));
				tmpupdate["flags.imagine-rpg.clock"] = tmpnewclock;
			}
			tmpupdates.push(tmpupdate);
		}
		await this.updateEmbeddedDocuments("Combatant", tmpupdates, { imagineClock: true, turnEvents: false });
		if (tmpmessages.length) { await ChatMessage.implementation.create(tmpmessages); }
		if (this.canUserModify(game.user, "update", { turn: 0 })) { await this.update({ turn: 0 }); }
		ui.notifications.info(`The surprise is over. Round ${this.round} begins: roll initiative.`);
		return tmpupdates.length;
	} // END endSurprise

	// This is the function which writes a surprise, and puts the tracker's turn back on whoever is
	// free soonest -- a surpriser still spending, else the round's order.
	async #writeSurprise(tmpcombatant, tmpsurprise) {
		await tmpcombatant.update({ "flags.imagine-rpg.surprise": tmpsurprise }, { imagineClock: true });
		if (this.canUserModify(game.user, "update", { turn: 0 })) { await this.update({ turn: 0 }); }
	}

	// This is the function which says so when every surpriser has used their surprise seconds. The
	// Game Master ends the surprise, as a round is ended, since someone may yet have something to do.
	#announceSurpriseUsed() {
		var tmpstates = this.combatants.map(c => getCombatantSurpriseState(c)).filter(s => !!s);
		if (tmpstates.length && tmpstates.every(s => s.done)) {
			ui.notifications.info("Every surpriser has used their surprise seconds. End the surprise to begin the round.");
		}
	}

	// This is the function which starts a new round: carry-over first, then fresh initiative for
	// everyone else. A surprise still running is ended first, so what it carries is in the round
	// that is ending.
	async nextRound() {
		if (hasActiveSurprise(this)) { await this.endSurprise(); }

		// CARRY-OVER is read off the round that is ending, before its initiative is cleared.
		var tmpcarries = [];
		for (const tmpcombatant of this.combatants) {
			var tmpclock = getCombatantClock(tmpcombatant);
			var tmpstate = resolveRoundClock(tmpclock, getClockOptions(tmpcombatant.actor));
			var tmpcarry = getCarryForNextRound(tmpstate, tmpclock);
			if (tmpcarry) { tmpcarries.push({ combatant: tmpcombatant, carry: tmpcarry }); }
		}

		await this.resetAll();
		var tmpresult = await super.nextRound();

		// Those carrying something in start from it, with no initiative rolled -- except an action
		// that finishes this round, whose reaction roll is made now and posted like any initiative.
		// Batched into one write, as rollInitiative batches its own.
		var tmpupdates = [];
		var tmpmessages = [];
		for (const tmpentry of tmpcarries) {
			var tmpcombatant = tmpentry.combatant;
			var tmpoptions = getClockOptions(tmpcombatant.actor);
			var tmpnewclock = getNextRoundClock(tmpentry.carry, this.round);
			if (needsCarryRoll(tmpnewclock, tmpoptions)) {
				var tmproll = tmpcombatant.getInitiativeRoll();
				await tmproll.evaluate();
				tmpnewclock = setCarryRoll(tmpnewclock, tmproll.total);
				tmpmessages.push(await this.#carryRollMessage(tmpcombatant, tmproll,
					resolveRoundClock(tmpnewclock, tmpoptions)));
			}
			var tmpnewstate = resolveRoundClock(tmpnewclock, tmpoptions);
			tmpupdates.push({
				_id: tmpcombatant.id,
				initiative: getClockInitiative(tmpnewstate),
				"flags.imagine-rpg.clock": tmpnewclock
			});
		}
		if (tmpupdates.length) {
			await this.updateEmbeddedDocuments("Combatant", tmpupdates, { imagineClock: true, turnEvents: false });
		}
		if (tmpmessages.length) { await ChatMessage.implementation.create(tmpmessages); }

		await this.rollAll();
		await this.update({ turn: 0 });
		return tmpresult;
	} // END nextRound

	// This is the function which writes up a carried action's reaction roll for chat, as a private
	// roll for a hidden combatant the way Foundry's own initiative rolls are.
	async #carryRollMessage(tmpcombatant, tmproll, tmpstate, tmpwhat = "last round's action") {
		var tmpcarry = tmpstate.carriedIn;
		var tmpfinish = tmpstate.ticks[Math.max(0, tmpcarry.seconds - 1)]?.label ?? tmpcarry.seconds;
		var tmpnext = tmpstate.done ? "next round" : `second ${tmpstate.ticks[tmpstate.next].label}`;
		var tmpname = foundry.utils.escapeHTML(tmpcombatant.name);
		var tmprollmode = tmpcombatant.hidden ? CONST.DICE_ROLL_MODES.PRIVATE : game.settings.get("core", "rollMode");
		return await tmproll.toMessage({
			speaker: ChatMessage.implementation.getSpeaker({
				actor: tmpcombatant.actor, token: tmpcombatant.token, alias: tmpcombatant.name
			}),
			flavor: `${tmpname} finishes ${tmpwhat} in second ${tmpfinish} and rolls initiative: `
				+ `the next action starts in ${tmpnext}.`
		}, { rollMode: tmprollmode, create: false });
	}
}

// @MARKER IMAGINE COMBATANT
// A combatant whose clock starts again whenever its initiative is set from outside the clock: a
// roll, the Game Master typing a number into the tracker, a reset to nothing. The clock's own
// writes pass { imagineClock: true } and are left alone.
export class ImagineCombatant extends Combatant {
	async _preUpdate(tmpchanged, tmpoptions, tmpuser) {
		var tmpallowed = await super._preUpdate(tmpchanged, tmpoptions, tmpuser);
		if (tmpallowed === false) { return false; }
		if (("initiative" in tmpchanged) && !tmpoptions?.imagineClock) {
			foundry.utils.setProperty(tmpchanged, "flags.imagine-rpg.clock",
				newRoundClock(this.parent?.round ?? 0, tmpchanged.initiative));
		}
		return tmpallowed;
	}
}
// @END (CODE)
