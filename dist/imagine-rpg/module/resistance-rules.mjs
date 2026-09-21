// @START (CODE)
// @MARKER RESISTANCE RULES
//==================================================================================================================
// Resolving a resistance roll, with no Foundry dependency, so it can be tested outside it.
//
// The five tracks -- Magic, Illusion, Control, Poison, Disease -- are each a percentage the
// character rolls d100 UNDER, like every other percentile check in the system. His sheet has a
// handler per track (handleMagicResist, sheet-worker.js:1231, and four more identical to it), and
// all five agree on the order the answers are given in:
//
//     1. IMMUNE            the track is immune, and nothing is rolled at all
//     2. 200% OR MORE      "virtually immune" -- resisted without regard to the roll
//     3. A ROLL OF 100     an automatic failure
//     4. otherwise         the roll against the chance, with a better result at half or under
//
// Reported by Daryl on 2026-09-21 as version 0.11.1's one Blocker: the Attributes tab showed the
// five figures and offered no way to roll any of them.
//
// A ROLL OF 1 ALWAYS SUCCEEDS, which his own handlers do NOT say. It came from the bug report, it
// is the convention every other percentile check in the game follows, and it changes the answer
// only where the chance is 0 -- his code fails a roll of 1 against a 0% chance, which is the one
// case where a natural 1 is not already a success by arithmetic. Logged as the one part of this
// that is not read off his sheet: UPSTREAM-ISSUES.md item 48.
//
// HIS HALF IS NOT MATH.FLOOR(CHANCE / 2). It is parseInt((chance + 1) / 2), which rounds UP on an
// odd chance: at 51% his half is 26, not 25. That is a point in the character's favour and it is
// his, so it is kept -- and it differs from the attribute save's half in the same codebase, which
// really is a floor. Both are ported as written rather than made to agree.
//==================================================================================================================

// @MARKER OUTCOMES
// The three ordinary answers, in his own words, so a chat card reads the way his sheet does.
export const RESIST_OUTCOMES = {
	half:   "Resisted by half",
	full:   "Resisted",
	failed: "Did not resist"
};

	// This is the function which says what half a resistance chance is, his own rounding.
	//
	// parseInt((chance + 1) / 2) in his code. On an even chance it is the plain half; on an odd
	// one it rounds up, so 51% halves to 26. Written as a floor of (chance + 1) / 2 because that
	// is the same number without depending on parseInt's habit of truncating towards zero.
	export function halfResistance(tmpChance) {
		var tmpNumber = parseInt(tmpChance) || 0;
		if (tmpNumber <= 0) { return 0; }
		return Math.floor((tmpNumber + 1) / 2);
	}

	// This is the function which resolves one resistance roll.
	//
	// Takes the chance as a number, the d100, whether the track is immune, and any modifier the
	// player was asked for (his _mod buttons prompt for one; a plain roll passes 0). Returns
	// everything a chat card needs, and never throws on a missing figure.
	//
	// NOTE ON HIS CODE, which this deliberately does not reproduce: his handlers read the chance
	// out of getAttrs, which hands back a STRING, and then add the modifier to it -- so "50" + 0
	// is "500", not 50. Every two-digit resistance therefore passes his `resistchance > 199` test
	// and reports "virtually immune", and a one-digit one is multiplied by ten. Checked in a real
	// JavaScript engine against his exact lines. It is a slip rather than a rule, so the port does
	// what he evidently meant -- the same call already made for lesserAge and the Monk row --
	// and it is reported as UPSTREAM-ISSUES.md item 48.
	export function resolveResistanceRoll(tmpChance, tmpRoll, tmpIsImmune, tmpModifier) {
		var tmpModified = (parseInt(tmpChance) || 0) + (parseInt(tmpModifier) || 0);
		var tmpDie = parseInt(tmpRoll) || 0;
		var tmpHalf = halfResistance(tmpModified);
		var tmpResult = {
			chance: tmpModified,
			half: tmpHalf,
			roll: tmpDie,
			modifier: parseInt(tmpModifier) || 0,
			resisted: true,
			byHalf: false,
			reason: ""
		};

		// 1. Immunity answers before anything is rolled: his handler says so first, and says the
		//    effect never happened rather than that the character resisted it.
		if (tmpIsImmune) {
			tmpResult.outcome = "Immune";
			tmpResult.reason = "immune -- it had no effect";
			tmpResult.byHalf = true;
			return tmpResult;
		}

		// 2. 200% or more is his "virtually immune", and it beats a rolled 100.
		if (tmpModified > 199) {
			tmpResult.outcome = RESIST_OUTCOMES.full;
			tmpResult.reason = "a 200% chance (virtually immune)";
			return tmpResult;
		}

		// 3. A natural 1 always succeeds. From the bug report, not from his handlers -- see above.
		if (tmpDie == 1) {
			tmpResult.outcome = RESIST_OUTCOMES.half;
			tmpResult.byHalf = true;
			tmpResult.reason = "a natural 1 -- an automatic success";
			return tmpResult;
		}

		// 4. A rolled 100 always fails.
		if (tmpDie == 100) {
			tmpResult.outcome = RESIST_OUTCOMES.failed;
			tmpResult.resisted = false;
			tmpResult.reason = "a natural 100 -- an automatic failure";
			return tmpResult;
		}

		// 5. His three-way comparison, in his order.
		if (tmpDie > tmpModified) {
			tmpResult.outcome = RESIST_OUTCOMES.failed;
			tmpResult.resisted = false;
		} else if (tmpDie > tmpHalf) {
			tmpResult.outcome = RESIST_OUTCOMES.full;
		} else {
			tmpResult.outcome = RESIST_OUTCOMES.half;
			tmpResult.byHalf = true;
		}
		tmpResult.reason = `rolled ${tmpDie}% against ${tmpModified}%`;
		return tmpResult;
	}

	// This is the function which writes the one line a resistance roll puts in chat.
	//
	// Kept beside the rule so the character sheet and the creature sheet say the same thing, and
	// so a test can read it without a chat message existing.
	export function describeResistanceRoll(tmpTrackLabel, tmpResult) {
		if (tmpResult.outcome == "Immune") {
			return `${tmpTrackLabel} Resistance &mdash; <strong>Immune</strong> &mdash; it had no effect`;
		}
		return `${tmpTrackLabel} Resistance &mdash; ${tmpResult.reason} &mdash; <strong>${tmpResult.outcome}</strong>`;
	}
// @END (CODE)
