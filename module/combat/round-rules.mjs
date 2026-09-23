// @START (CODE)
// @MARKER ROUND CLOCK
//==================================================================================================================
// The 10 second round, second by second, for each combatant: where their initiative put them, what
// they have spent, what they have left, and what runs over into the next round.
//
// This is his "Mr. Initiative" chart (Master's Manual pp.98-100) worked out as numbers. The chart
// is a board a Game Master moves markers along -- a Split Second row for negative rolls, the
// Combat Round row of ten seconds, an Extra Seconds row with every second cut in two (1a 1b 2a
// 2b ...), an Off-Hand row of five (ten for the ambidextrous) and a Carry Over grid for actions
// that run into later rounds. Everything the chart does by moving a marker, this file does by
// counting, and module/round-view.mjs draws it back as the chart.
//
// Nothing in this file touches Foundry, in the same shape as combat-rules.mjs beside it: every
// function takes values and returns values, dice results included, which the caller rolls and
// passes in. combat-document.mjs keeps each combatant's clock and asks this file what it means.
//
// THE RULES, and where each comes from:
//
//   - Initiative is the second a combatant can first act in: d10 plus the better of the Agility
//     and Intelligence adjustments (Player's Guide p.168, Initiative). "Those who start on a
//     second later in the round than the first lose all previous seconds and can do nothing
//     during them." A negative result only orders combatants within the first second -- "there
//     are no negative seconds" -- which is his chart's Split Second row, -10 to -1.
//
//   - Every action costs event time, and "event times add together consecutively until the
//     character has spent the total seconds allotted him for the round" (p.167). "No event can
//     ever take less than one second for combat purposes" (p.168).
//
//   - A roll below -10 buys extra seconds: "adding one new second per point rolled below -10. The
//     bonus of +10 seconds is the most that can be achieved this way" (Master's Manual p.2,
//     Initiative Adjustment). A Speed potion, spell, rune or glyph gives extra seconds too -- his
//     sheet's tmp_speed_seconds, which the actor carries as combat.speedSeconds. Ten at most in
//     all: his chart's Extra Seconds row has ten places.
//
//   - Extra seconds split the first seconds of the round in two, from the first on (Master's
//     Manual p.100, Extra event time: "his marker moved from 1a to 1b to 2a to 2b and so on until
//     he reached 5b, at which point his marker would advance to second 6"). His sheet adds that
//     "speed seconds occur before the normal second", and tells the player to set a sped
//     character's initiative to -10 less the speed seconds (so 3 speed seconds is -13) -- which
//     puts them first, whatever they rolled. The sheet is followed: a combatant with extra seconds
//     starts at 1a, and "a" is the extra half, before anyone's ordinary second.
//
//   - The off hand has five seconds of its own, one more per 20% of Second Weapon Lore, ten for
//     the ambidextrous (getOffhandSecondsCap), used alongside the main hand rather than after it.
//     A late start costs it half the seconds lost, rounded up -- all of them if ambidextrous --
//     and it can never have more left than the round has (Player's Guide p.178, Timing in the
//     Combat Round).
//
//   - An action still under way when the round ends can be CARRIED OVER. "No initiative is rolled
//     for that character until the action is finished. A new initiative is rolled at the point
//     when the character finishes the action, and is added to his last second" (p.168,
//     Carry-Over). So is an initiative past the tenth second: the character simply starts that
//     far into the next round. Carrying over is the player's choice; not carrying rolls afresh.
//==================================================================================================================

import { getOffhandSecondsCap } from "./combat-rules.mjs";


//==================================================================================================================
// @MARKER ROUND CONSTANTS
//==================================================================================================================

	// Seconds in a combat round, and the most extra seconds anyone can have in one.
	export const ROUND_SECONDS = 10;
	export const MAX_EXTRA_SECONDS = 10;


//==================================================================================================================
// @MARKER EXTRA SECONDS
//==================================================================================================================

	// This is the function which gives the extra seconds an initiative roll earns: one for every
	// point below -10, ten at most. A -11 is one; a -15 is five (Master's Manual p.100's own
	// example); anything from -20 down is ten.
	export function getRollExtraSeconds(tmprolled) {
		var tmproll = parseInt(tmprolled);
		if (!Number.isFinite(tmproll) || tmproll > -11) { return 0; }
		return Math.min(MAX_EXTRA_SECONDS, -10 - tmproll);
	}

	// This is the function which gives all a combatant's extra seconds this round: what their roll
	// earned and what an effect grants (his tmp_speed_seconds), ten at most between them.
	export function getExtraSeconds(tmprolled, tmpeffectseconds) {
		var tmpeffect = Math.max(0, parseInt(tmpeffectseconds) || 0);
		return Math.min(MAX_EXTRA_SECONDS, getRollExtraSeconds(tmprolled) + tmpeffect);
	}

	// This is the function which lays out one combatant's seconds for the round -- the places on
	// his chart their marker can stand on. Ten, one per second, except that each extra second
	// splits one of the first seconds into two halves: three extra seconds give thirteen places,
	// 1a 1b 2a 2b 3a 3b 4 5 6 7 8 9 10.
	//
	//   { second, half, extra, label }
	//     second  1 to 10
	//     half    "a" or "b" for a split second, "" for an ordinary one
	//     extra   true for the extra half ("a" -- his sheet puts speed seconds before the normal one)
	//     label   what the chart prints: "3", "2a"
	export function getRoundTicks(tmpextra) {
		var tmpout = [];
		var tmpsplit = Math.min(MAX_EXTRA_SECONDS, Math.max(0, parseInt(tmpextra) || 0));
		for (var tmpsecond = 1; tmpsecond <= ROUND_SECONDS; tmpsecond++) {
			if (tmpsecond <= tmpsplit) {
				tmpout.push({ second: tmpsecond, half: "a", extra: true,  label: tmpsecond + "a" });
				tmpout.push({ second: tmpsecond, half: "b", extra: false, label: tmpsecond + "b" });
			} else {
				tmpout.push({ second: tmpsecond, half: "",  extra: false, label: "" + tmpsecond });
			}
		}
		return tmpout;
	} // END getRoundTicks


//==================================================================================================================
// @MARKER OFF HAND AND CARRY OVER
//==================================================================================================================

	// This is the function which gives the off-hand seconds a late start costs. "When a combatant
	// loses seconds due to a poor initiative roll, he also loses a proportional amount of time in
	// his off-hand. Ambidextrous characters will lose an equal amount of time, while other
	// characters will lose 1/2 of those seconds (rounded up.)" -- Player's Guide p.178, whose own
	// example is a start on the 5th second: four lost, two of them from the off hand.
	export function getOffhandLoss(tmplost, tmphandedness) {
		var tmpseconds = Math.max(0, parseInt(tmplost) || 0);
		if (("" + (tmphandedness ?? "")) == "Ambidextrous") { return tmpseconds; }
		return Math.ceil(tmpseconds / 2);
	}

	// This is the function which says which of a combatant's two clocks an action with a weapon
	// runs on: "main", the one their initiative follows, or "off", the off hand's own seconds. A
	// weapon held in both hands, or an attack that is not hand-based at all (a bite, a breath), is
	// main. An ambidextrous combatant still has two hands of ten seconds each; the right is taken
	// as the main one, as his sheet's shield code reads Ambidextrous as right-handed.
	//
	// This is not isOffhandWeapon (combat-rules.mjs), which asks whether the off-hand PENALTY
	// applies and so is never true for the ambidextrous -- they pay no penalty, but a sword in the
	// left hand is still on the left hand's seconds.
	export function getActionHand(tmphand, tmphandedness) {
		var tmpwielded = ("" + (tmphand ?? "")).toLowerCase();
		if (tmpwielded != "left" && tmpwielded != "right") { return "main"; }
		var tmpprimary = (("" + (tmphandedness ?? "")) == "Left") ? "left" : "right";
		return tmpwielded == tmpprimary ? "main" : "off";
	}

	// This is the function which gives how many seconds after the last second of a carried-over
	// action the combatant can act again: the initiative rolled when it finishes. "He rolls a 3,
	// and adds this to the 2 seconds carry-over time, and thus must wait until the 5th second to
	// begin his next action. Negative initiative rolls do not subtract." (Player's Guide p.168.)
	//
	// A 1 therefore means the very next second, as a 1 means the very first second at the start of
	// a round -- nothing lost either way. "Do not subtract" is read as nothing lower than that: a
	// 0 or a negative also means the next second. Read literally, a 0 would add nothing and start
	// the next action in the same second the last one finished in, which is two actions in one
	// second. Recorded in docs/DECISIONS.md and asked in docs/UPSTREAM-ISSUES.md.
	export function getCarryReaction(tmproll) {
		return Math.max(1, parseInt(tmproll) || 0);
	}


//==================================================================================================================
// @MARKER THE CLOCK
//==================================================================================================================

	// A combatant's clock for one round, as combat-document.mjs stores it on the combatant:
	//
	//   {
	//       round:     which round it belongs to; a clock from another round is not this one's
	//       rolled:    the modified initiative as rolled, or null (not rolled, or carrying in)
	//       carry:     { seconds, action, roll } carried in from the round before, or null
	//                    seconds  how far into this round the carried thing runs
	//                    action   true for an action under way, false for a late start waited out
	//                    roll     the initiative rolled when the action finishes, once rolled
	//       spent:     [ { seconds, hand, label } ] every spend this round, in order
	//                    hand     "main" moves the combatant along; "off" spends the off hand
	//       carryOver: whether, if this round ends with something running over, it is carried
	//   }

	// This is the function which starts a clock: a fresh round, from an initiative just rolled or
	// typed in. A null initiative is a clock that has not started.
	export function newRoundClock(tmpround, tmprolled) {
		var tmproll = parseInt(tmprolled);
		return {
			round: parseInt(tmpround) || 0,
			rolled: Number.isFinite(tmproll) ? tmproll : null,
			carry: null,
			spent: [],
			carryOver: true
		};
	}

	// This is the function which spends seconds on a clock, returning a new clock (the one passed
	// is left alone, so the caller can compare before and after). "No event can ever take less
	// than one second for combat purposes" (Player's Guide p.168), so less than one is one.
	export function addClockSpend(tmpclock, tmpseconds, tmphand, tmplabel) {
		var tmpout = copyClock(tmpclock);
		tmpout.spent.push({
			seconds: Math.max(1, parseInt(tmpseconds) || 0),
			hand: tmphand == "off" ? "off" : "main",
			label: "" + (tmplabel ?? "")
		});
		return tmpout;
	}

	// This is the function which takes back the last spend, for a slip of the finger or a Game
	// Master's correction. A clock with nothing spent comes back as it was.
	export function removeLastClockSpend(tmpclock) {
		var tmpout = copyClock(tmpclock);
		tmpout.spent.pop();
		return tmpout;
	}

	// This is the function which copies a clock deep enough that changing the copy's spends or
	// carry never reaches the original.
	export function copyClock(tmpclock) {
		return {
			round: tmpclock?.round ?? 0,
			rolled: tmpclock?.rolled ?? null,
			carry: tmpclock?.carry ? { ...tmpclock.carry } : null,
			spent: Array.isArray(tmpclock?.spent) ? tmpclock.spent.map(s => ({ ...s })) : [],
			carryOver: tmpclock?.carryOver !== false
		};
	}

	// This is the function which works out everything a clock means for the round -- the heart of
	// the chart. tmpoptions carries what comes off the actor (getClockOptions):
	//
	//   speedSeconds  extra seconds from an effect (his tmp_speed_seconds)
	//   offhandCap    the off hand's seconds before any loss; getOffhandSecondsCap if not given
	//   handedness    "Ambidextrous" loses off-hand time one for one
	//
	// and it returns
	//
	//   ready        false until there is an initiative or something carried in
	//   rolled, extra, ticks          the roll, the extra seconds, and the places (getRoundTicks)
	//                                 each with a state: lost, carried, spent, free
	//   start        the place the combatant begins at; next, the place they act at now
	//   done         nothing left this round; overrun, seconds past its end
	//   splitSecond  a roll below 1, still ordering the first second (null once they have acted)
	//   used, left   action seconds spent and still to spend on the main hand
	//   secondsLeft  whole seconds of the round left from where they stand (the off hand's ceiling)
	//   lost         seconds lost to initiative this round -- what the off hand pays half of
	//   offhand      { cap, lost, pool, spent, left, expired, over }
	//   carry        what runs into the next round if carried ({ seconds, action }), or null
	//   carriedIn    the carry this round began with, or null
	export function resolveRoundClock(tmpclock, tmpoptions = {}) {
		var tmprolledvalue = parseInt(tmpclock?.rolled);
		var tmprolled = Number.isFinite(tmprolledvalue) ? tmprolledvalue : null;
		var tmpcarry = tmpclock?.carry ?? null;
		var tmpspent = Array.isArray(tmpclock?.spent) ? tmpclock.spent : [];

		// Someone carrying something in rolled no initiative this round, so only an effect's
		// extra seconds count for them.
		var tmpextra = getExtraSeconds(tmpcarry ? null : tmprolled, tmpoptions.speedSeconds);
		var tmpticks = getRoundTicks(tmpextra);
		var tmplength = tmpticks.length;

		var tmpstate = {
			ready: false, rolled: tmprolled, extra: tmpextra, ticks: tmpticks,
			start: 0, next: 0, done: false, overrun: 0, splitSecond: null,
			used: 0, left: 0, secondsLeft: 0, lost: 0,
			offhand: { cap: 0, lost: 0, pool: 0, spent: 0, left: 0, expired: 0, over: 0 },
			carry: null, carriedIn: tmpcarry ? { ...tmpcarry } : null
		};
		for (const tmptick of tmpticks) { tmptick.state = "free"; }
		if (!tmpcarry && tmprolled === null) { return tmpstate; }
		tmpstate.ready = true;

		// WHERE THEY BEGIN
		// A carried action fills the first places; when it finishes, the initiative rolled then
		// is added to its last second. A late start carried in is simply waited out.
		var tmpstart = 0;
		var tmplost = 0;
		var tmpcarried = 0;
		if (tmpcarry) {
			tmpcarried = Math.max(0, parseInt(tmpcarry.seconds) || 0);
			if (!tmpcarry.action) {
				tmpstart = tmpcarried;
				tmplost = tmpcarried;
			} else if (tmpcarried < tmplength && tmpcarry.roll !== null && tmpcarry.roll !== undefined) {
				var tmpreaction = getCarryReaction(tmpcarry.roll);
				tmpstart = tmpcarried - 1 + tmpreaction;
				tmplost = tmpreaction - 1;
			} else {
				tmpstart = tmpcarried;   // still under way all round, or its roll not yet made
			}
		} else if (tmpextra > 0 || tmprolled <= 1) {
			tmpstart = 0;                // at the first place: sped, a 1, or the split second
			if (tmpextra == 0 && tmprolled < 1) { tmpstate.splitSecond = tmprolled; }
		} else if (tmprolled <= ROUND_SECONDS) {
			tmpstart = tmprolled - 1;    // no extra seconds, so the places are the seconds
			tmplost = tmprolled - 1;
		} else {
			tmpstart = tmplength + (tmprolled - ROUND_SECONDS - 1);
			tmplost = ROUND_SECONDS;     // the whole round, and the start is in the next one
		}
		for (var tmpi = 0; tmpi < Math.min(tmpstart, tmplength); tmpi++) {
			tmpticks[tmpi].state = (tmpcarry?.action && tmpi < tmpcarried) ? "carried" : "lost";
			if (tmpcarry && tmpi < tmpcarried) { tmpticks[tmpi].title = tmpcarry.action ? "Carried over" : "Waiting"; }
		}

		// WHAT THEY HAVE SPENT
		// The main hand moves the marker along its places; the off hand is counted on its own.
		// Each place spent carries which main-hand action it went to (0 for the first, 1 for the
		// next...), so the chart can shade one action apart from the one after it.
		var tmpnext = tmpstart;
		var tmpused = 0;
		var tmpoffspent = 0;
		var tmpactions = 0;
		for (const tmpentry of tmpspent) {
			var tmpseconds = Math.max(0, parseInt(tmpentry?.seconds) || 0);
			if (tmpentry?.hand == "off") { tmpoffspent = tmpoffspent + tmpseconds; continue; }
			for (var tmpk = 0; tmpk < tmpseconds; tmpk++) {
				var tmptick = tmpticks[tmpnext + tmpk];
				if (!tmptick) { continue; }   // past the end of the round: carried, not drawn
				tmptick.state = "spent";
				tmptick.action = tmpactions;
				tmptick.title = "" + (tmpentry.label ?? "");
			}
			tmpnext = tmpnext + tmpseconds;
			tmpused = tmpused + tmpseconds;
			tmpactions = tmpactions + 1;
		}
		if (tmpused > 0) { tmpstate.splitSecond = null; }

		tmpstate.start = tmpstart;
		tmpstate.next = tmpnext;
		tmpstate.used = tmpused;
		tmpstate.lost = tmplost;
		tmpstate.done = tmpnext >= tmplength;
		tmpstate.overrun = Math.max(0, tmpnext - tmplength);
		tmpstate.left = Math.max(0, tmplength - tmpnext);
		if (!tmpstate.done) {
			tmpticks[tmpnext].now = true;
			tmpstate.secondsLeft = ROUND_SECONDS + 1 - tmpticks[tmpnext].second;
		}

		// THE OFF HAND
		// Its cap, less what the late start cost it, less what it has spent -- and never more than
		// the round has left. What it cannot use because the round is running out has EXPIRED; what
		// has been spent past its pool is OVER, shown rather than refused.
		var tmpoffcap = (tmpoptions.offhandCap === undefined || tmpoptions.offhandCap === null)
			? getOffhandSecondsCap(tmpoptions.handedness, 0)
			: Math.max(0, parseInt(tmpoptions.offhandCap) || 0);
		var tmpofflost = Math.min(tmpoffcap, getOffhandLoss(tmplost, tmpoptions.handedness));
		var tmpoffpool = tmpoffcap - tmpofflost;
		var tmpoffremaining = tmpoffpool - tmpoffspent;
		var tmpoffleft = Math.max(0, Math.min(tmpoffremaining, tmpstate.secondsLeft));
		tmpstate.offhand = {
			cap: tmpoffcap, lost: tmpofflost, pool: tmpoffpool, spent: tmpoffspent,
			left: tmpoffleft,
			expired: Math.max(0, tmpoffremaining - tmpoffleft),
			over: Math.max(0, -tmpoffremaining)
		};

		// WHAT RUNS OVER
		// An action still going at the end of the round carries its remaining seconds, and rolls
		// for the reaction when it finishes. A start that lies past the end carries the wait, with
		// no roll. An action that ends exactly on the tenth second carries nothing: a fresh roll
		// next round is the same as a reaction roll added to second 10.
		if (tmpstate.done) {
			var tmpbusy = tmpused > 0 || (!!tmpcarry?.action && tmpcarried >= tmplength);
			if (tmpbusy && tmpstate.overrun > 0) {
				tmpstate.carry = { seconds: tmpstate.overrun, action: true };
			} else if (!tmpbusy && tmpstart >= tmplength) {
				tmpstate.carry = { seconds: tmpstart - tmplength, action: false };
			}
		}
		return tmpstate;
	} // END resolveRoundClock


//==================================================================================================================
// @MARKER ORDER AND INITIATIVE
//==================================================================================================================

	// This is the function which gives the key the tracker sorts by: the time of the combatant's
	// next place. An extra "a" half is half a second before the ordinary second it splits, so a
	// sped combatant acts before anyone else in that second. A roll below 1 that has not yet acted
	// orders the first second by its value, lowest first -- his chart's Split Second row, "considered
	// part of the first second". Anyone done for the round sorts after everyone who is not, by when
	// they come back; anyone not started sorts last of all.
	export function getClockSortKey(tmpstate) {
		if (!tmpstate?.ready) { return Infinity; }
		if (tmpstate.done) { return ROUND_SECONDS + 1 + tmpstate.overrun; }
		var tmptick = tmpstate.ticks[tmpstate.next];
		var tmpkey = tmptick.second - (tmptick.half == "a" ? 0.5 : 0);
		if (tmpstate.splitSecond !== null) { tmpkey = tmpkey + ((tmpstate.splitSecond - 1) / 100); }
		// Two sped combatants both waiting on 1a: the one with more extra seconds goes first, as his
		// "-10 minus the # of speed seconds" initiative puts them.
		if (tmpstate.next == 0 && tmpstate.used == 0 && tmpstate.extra > 0) { tmpkey = tmpkey - (tmpstate.extra / 1000); }
		return tmpkey;
	}

	// This is the function which gives the number the tracker shows as the combatant's initiative.
	// Until they have spent anything it is the roll itself, so a -3 stays a -3 and still orders
	// the first second; after that it is the second they next act in. Past the end of the round it
	// keeps counting, so a 13 is the third second of the next round -- as before this clock
	// existed, when spending seconds simply added them to the initiative.
	export function getClockInitiative(tmpstate) {
		if (!tmpstate?.ready) { return null; }
		if (tmpstate.used == 0 && !tmpstate.carriedIn && tmpstate.rolled !== null) { return tmpstate.rolled; }
		if (tmpstate.done) { return ROUND_SECONDS + 1 + tmpstate.overrun; }
		return tmpstate.ticks[tmpstate.next].second;
	}

	// This is the function which says whether the round is over: everyone with a clock running is
	// past their last place. A round with nobody started is not over -- it has not begun.
	export function isRoundOver(tmpstates) {
		var tmpready = (tmpstates ?? []).filter(s => s?.ready);
		return tmpready.length > 0 && tmpready.every(s => s.done);
	}


//==================================================================================================================
// @MARKER NEXT ROUND
//==================================================================================================================

	// This is the function which gives what a clock carries into the next round: its carry, if it
	// has one and the combatant has not declined it. Declining means a fresh initiative roll.
	export function getCarryForNextRound(tmpstate, tmpclock) {
		if (!tmpstate?.carry) { return null; }
		if (tmpclock?.carryOver === false) { return null; }
		return { seconds: tmpstate.carry.seconds, action: tmpstate.carry.action };
	}

	// This is the function which starts the next round's clock for someone carrying something in.
	// No initiative is rolled for them now (Player's Guide p.168). Whether one is wanted as soon as
	// the round begins is needsCarryRoll's question.
	export function getNextRoundClock(tmpcarry, tmpround) {
		var tmpclock = newRoundClock(tmpround, null);
		tmpclock.carry = {
			seconds: Math.max(0, parseInt(tmpcarry?.seconds) || 0),
			action: !!tmpcarry?.action,
			roll: null
		};
		return tmpclock;
	}

	// This is the function which says whether a carried action finishes within this round, and so
	// wants its reaction roll. The book has it rolled "at the point when the character finishes the
	// action"; the Game Master's client rolls it as the round begins instead, because nothing about
	// the roll depends on when it is made, and it means the carried combatant already sits in the
	// right place in the tracker. An action that runs past this round too waits for a later one.
	export function needsCarryRoll(tmpclock, tmpoptions = {}) {
		var tmpcarry = tmpclock?.carry;
		if (!tmpcarry?.action) { return false; }
		if (tmpcarry.roll !== null && tmpcarry.roll !== undefined) { return false; }
		var tmplength = getRoundTicks(getExtraSeconds(null, tmpoptions.speedSeconds)).length;
		return (parseInt(tmpcarry.seconds) || 0) < tmplength;
	}

	// This is the function which records the reaction roll on a carried clock.
	export function setCarryRoll(tmpclock, tmptotal) {
		var tmpout = copyClock(tmpclock);
		if (tmpout.carry) { tmpout.carry.roll = parseInt(tmptotal) || 0; }
		return tmpout;
	}


//==================================================================================================================
// @MARKER CLOCK OPTIONS
//==================================================================================================================

	// This is the function which reads what a clock needs off an actor: its extra seconds from
	// effects, its off-hand seconds and its handedness. A character's handedness is on its physical
	// description; a creature's is the one its off-hand attacks are judged by, which an
	// Ambidextrous ability overrides (actor-creature.mjs, combat.offhandHandedness).
	export function getClockOptions(tmpactor) {
		var tmpsystem = tmpactor?.system ?? {};
		var tmphandedness = tmpactor?.type == "creature"
			? (tmpsystem.combat?.offhandHandedness ?? "")
			: (tmpsystem.physical?.handedness ?? "");
		return {
			speedSeconds: parseInt(tmpsystem.combat?.speedSeconds) || 0,
			offhandCap: tmpsystem.combat?.offhandSecondsCap ?? getOffhandSecondsCap(tmphandedness, 0),
			handedness: tmphandedness
		};
	}
// @END (CODE)
