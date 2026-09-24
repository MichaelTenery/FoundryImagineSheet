// @START (CODE)
// @MARKER SKILL RULES
//==================================================================================================================
// The skill arithmetic, as plain functions.
//
// Nothing in this file touches Foundry, in the same shape as combat/combat-rules.mjs: every
// function takes values and returns values, dice results included, which the caller rolls and
// passes in. Line numbers against docs/reference/sheet-worker.js are given with each rule.
//
// Three things live here that the chance formula in the character model does not cover: how a
// percentile roll is READ (his eight skill results, his attribute save, and his situational
// rolls, which are three different readers in his sheet), what happens when the same skill is
// held more than once, and the slot economy the Player's Guide calls "slot tricks" -- trading
// skill slots between categories, or giving one up for a bonus.
//==================================================================================================================


// @MARKER SKILL ROLL RESULTS

	// His eight results for a skill roll, best first, from handleSkillRollDetails
	// (sheet-worker.js:29426-29456). EVERY skill roll on his sheet goes through that one function --
	// the race, social, class, high-title and common skill rolls (63940-64331), the common social
	// skill (3614), a creature's skill (175374), the martial knowledge and lore rolls (66168-68725)
	// and the weapon, shield and body parries (65364, 70808, 70997) -- 25 calls in all, and every
	// one of them reads "Succeeded?" off the same split: the first five results pass and the last
	// three fail (3616-3620, and the same two lines after each call).
	//
	// An earlier pass wrote here that "his skill roll template only reports the number" and ported
	// four results off the Player's Guide instead. That was wrong -- the function above was missed.
	// The four-result reader below it (resolveSkillOutcome) is kept for the one place that is not
	// a skill roll of his: the situational Critical / Focused Attack / Surprise rolls.
	//
	//   made          the roll succeeded -- his `pass`
	//   critical      a critical success: made by 21 or more (roll < chance - 20)
	//   byHalf        made by half: rolled at or under half the chance, rounded UP (see below)
	//   criticalFail  missed by 21 or more (roll > chance + 20)
	//   line          the sheet-worker.js line that writes it
	//
	//                                          made   critical  byHalf  criticalFail  line
	//                                          -----  --------  ------  ------------  -----
	export const SKILL_ROLL_RESULTS = {
		"Grandmaster":                       { made: true,  critical: false, byHalf: false, criticalFail: false, line: 29435 },
		"Critical Success and made by half": { made: true,  critical: true,  byHalf: true,  criticalFail: false, line: 29444 },
		"Critical Success":                  { made: true,  critical: true,  byHalf: false, criticalFail: false, line: 29446 },
		"Made by half":                      { made: true,  critical: false, byHalf: true,  criticalFail: false, line: 29450 },
		"Success":                           { made: true,  critical: false, byHalf: false, criticalFail: false, line: 29452 },
		"Failure":                           { made: false, critical: false, byHalf: false, criticalFail: false, line: 29441 },
		"Rolled 100":                        { made: false, critical: false, byHalf: false, criticalFail: false, line: 29437 },
		"Critical Failure":                  { made: false, critical: false, byHalf: false, criticalFail: true,  line: 29439 }
	};

	// The eight in order, best first, for ranking one against another (pickBestSkillRoll).
	//
	// His function has no ranking -- it returns one word and his handlers only ask pass or fail --
	// so the order is ours, and only the order WITHIN a side matters. Grandmaster heads it because
	// it is the one result that cannot be taken away; a critical beats an ordinary success, and
	// made-by-half beats a plain success. "Rolled 100" sits between an ordinary failure and a
	// critical one: it fails outright but is not a critical failure in his code (a chance of 60
	// rolling 100 reads "Rolled 100", never "Critical Failure", because that test comes first).
	export const SKILL_ROLL_ORDER = Object.keys(SKILL_ROLL_RESULTS);

	// This is the function which reads one skill roll the way his handleSkillRollDetails does
	// (sheet-worker.js:29426). Tested in this order, first match wins, exactly as his if-chain:
	//
	//     chance over 199        Grandmaster -- "Grandmasters don't have to roll. They always succeed."
	//     rolled 100             Rolled 100  -- "always a failure (unless you are a grandmaster)"
	//     roll > chance + 20     Critical Failure
	//     roll > chance          Failure
	//     roll < chance - 20     Critical Success, and made by half as well if roll <= half
	//     otherwise              Success, or Made by half if roll <= half
	//
	// HALF ROUNDS UP here: parseInt((chance+1)/2), so a 35% skill is made by half on 18 or under.
	// An attribute SAVE rounds its half DOWN, with a floor of 1 (divideWithMin, 25595) -- see
	// resolveAttributeSave below. The two are his, written differently, and are kept so.
	//
	// His function takes a third argument, a "combined total" separate from the natural roll, so the
	// 100 test can read the die while the others read the die plus modifiers. Every one of his 25
	// callers passes the die twice (the weapon parry's finalresult is set to originalRoll first,
	// 65362), so the modifiers always go on the CHANCE, and one roll is all this takes.
	//
	// The Player's Guide agrees on the two absolutes (p.79, "Skill Notes": a roll of 00 is still a
	// failure, and at 200% "the practitioner will never fail, and does not need to make a skill
	// roll"). It also says a natural 01 always succeeds (p.326, "Automatic Failure and Success");
	// his function has no such rule -- a 0% skill rolling 01 is a Failure -- and the sheet outranks
	// the book, so there is none here either.
	//
	// Returns { chance, roll, margin, half, outcome, made, critical, byHalf, criticalFail }. The
	// margin (chance minus roll) is kept for the card and for breaking a tie between two copies.
	export function resolveSkillRoll(tmpchance, tmproll) {
		var tmpTotalChanceValue = parseInt(tmpchance) || 0;
		var tmpOriginalRollValue = parseInt(tmproll) || 0;
		var tmpTotalHalfChanceValue = parseInt((tmpTotalChanceValue + 1) / 2) || 0;
		var tmpTotalCriticalFailChanceValue = tmpTotalChanceValue + 20;
		var tmpTotalCriticalChanceValue = tmpTotalChanceValue - 20;

		var tmpSkillResult = "";
		if (tmpTotalChanceValue > 199) {
			tmpSkillResult = "Grandmaster";                          // never has to roll, always succeeds
		} else if (tmpOriginalRollValue == 100) {
			tmpSkillResult = "Rolled 100";                           // always a failure below 200%
		} else if (tmpOriginalRollValue > tmpTotalCriticalFailChanceValue) {
			tmpSkillResult = "Critical Failure";                     // missed by more than 20
		} else if (tmpOriginalRollValue > tmpTotalChanceValue) {
			tmpSkillResult = "Failure";
		} else if (tmpOriginalRollValue < tmpTotalCriticalChanceValue) {
			if (tmpOriginalRollValue < (tmpTotalHalfChanceValue + 1)) {
				tmpSkillResult = "Critical Success and made by half"; // made by 21 or more AND by half
			} else {
				tmpSkillResult = "Critical Success";                 // made by 21 or more
			}
		} else {
			if (tmpOriginalRollValue < (tmpTotalHalfChanceValue + 1)) {
				tmpSkillResult = "Made by half";
			} else {
				tmpSkillResult = "Success";
			}
		}

		var tmpDetails = SKILL_ROLL_RESULTS[tmpSkillResult];
		return {
			chance: tmpTotalChanceValue,
			roll: tmpOriginalRollValue,
			margin: tmpTotalChanceValue - tmpOriginalRollValue,
			half: tmpTotalHalfChanceValue,
			outcome: tmpSkillResult,
			made: tmpDetails.made,
			critical: tmpDetails.critical,
			byHalf: tmpDetails.byHalf,
			criticalFail: tmpDetails.criticalFail
		};
	}

	// This is the function which words a resolved result the way his cards end theirs. His race skill
	// card reads "...rolled a 23% against a 45%. Result=Made by half. Succeeded? = true"
	// (handleRaceSkillRoll, sheet-worker.js:63963), and every other skill card the same: the result,
	// and then plainly whether it passed, since "Rolled 100" and "Grandmaster" do not say so
	// themselves. So: "<strong>Made by half</strong> (succeeded)". A Grandmaster's die is said not to
	// matter, since his sheet rolls it anyway and then ignores it.
	export function describeSkillResult(tmpresult) {
		if (!tmpresult) { return ""; }
		var tmpnote = tmpresult.made ? "succeeded" : "failed";
		if (tmpresult.outcome == "Grandmaster") { tmpnote = "succeeded, no roll needed"; }
		return `<strong>${tmpresult.outcome}</strong> (${tmpnote})`;
	}

	// This is the function which says in words what a resolved skill roll came to, for a chat card:
	// "rolled 23 against 45% -- Made by half (succeeded)".
	export function describeSkillRoll(tmpresult) {
		if (!tmpresult) { return ""; }
		return `rolled ${tmpresult.roll} against ${tmpresult.chance}% &mdash; ${describeSkillResult(tmpresult)}`;
	}


// @MARKER ATTRIBUTE SAVES

	// This is the function which reads one attribute save, as his twelve save handlers do (the
	// Strength one is sheet-worker.js:42-58; the other eleven are the same lines with the attribute
	// changed). Three results only: a save has no criticals and no 100 rule.
	//
	//     roll > chance    Failed
	//     roll > half      Succeeded
	//     otherwise        Succeeded by half
	//
	// The half is divideWithMin(chance, 2) (25595): rounded DOWN, but never below 1. The port used
	// Math.floor with no floor of its own until 2026-09-23, which differed from his only at a
	// chance of 1 -- a roll of 1 there is made by half on his sheet and was only "Succeeded" here.
	// Both sheets' save buttons read this now, so the two cannot drift apart again.
	//
	// Returns { chance, roll, half, outcome, made, byHalf }.
	export function resolveAttributeSave(tmpchance, tmproll) {
		var tmpnumchance = parseInt(tmpchance) || 0;
		var tmpnumroll = parseInt(tmproll) || 0;
		var tmphalfChance = parseInt(tmpnumchance / 2) || 0;
		if (tmphalfChance < 1) { tmphalfChance = 1; } // divideWithMin's floor

		var tmpoutcome = "Succeeded by half";
		if (tmpnumroll > tmpnumchance)       { tmpoutcome = "Failed"; }
		else if (tmpnumroll > tmphalfChance) { tmpoutcome = "Succeeded"; }

		return {
			chance: tmpnumchance,
			roll: tmpnumroll,
			half: tmphalfChance,
			outcome: tmpoutcome,
			made: tmpoutcome != "Failed",
			byHalf: tmpoutcome == "Succeeded by half"
		};
	}


// @MARKER SITUATIONAL SKILL ROLLS

	// The four outcomes of a SITUATIONAL skill roll, best first -- the Critical, Focused Attack,
	// Surprise Attack, Brace, Perfect Shot and Quick Load buttons of his Situation Mods panel.
	//
	// These are not handleSkillRollDetails. Each of those handlers reads its own roll inline
	// (roll_critical_sit, sheet-worker.js:19112, and the same shape after it): critical failure
	// over chance + 20, failure over the chance, critical success under chance - 20, success
	// otherwise (19130-19197). No Grandmaster, no 100 rule, no made by half -- so a 120% Critical
	// rolling 100 still succeeds there. They are kept as he wrote them, and this reader is theirs.
	export const SKILL_OUTCOMES = ["Critical success", "Succeeded", "Failed", "Critical failure"];

	// This is the function which reads one situational roll against one chance.
	//
	// Rolled at or under the chance succeeds. Beating it by more than 20 is a critical success;
	// missing it by more than 20 is a critical failure. The margin is reported because the card
	// prints it.
	export function resolveSkillOutcome(tmpchance, tmproll) {
		var tmpnumchance = parseInt(tmpchance) || 0;
		var tmpnumroll = parseInt(tmproll) || 0;
		var tmpmargin = tmpnumchance - tmpnumroll;

		var tmpoutcome = "";
		if (tmpnumroll <= tmpnumchance) {
			tmpoutcome = (tmpmargin > 20) ? "Critical success" : "Succeeded";
		} else {
			tmpoutcome = (tmpmargin < -20) ? "Critical failure" : "Failed";
		}

		return { chance: tmpnumchance, roll: tmpnumroll, margin: tmpmargin, outcome: tmpoutcome };
	}


// @MARKER DUPLICATE SKILLS

	// Each situational outcome stands at the same place as its skill-roll twin, so that a result of
	// either reader ranks against the other on one scale (see getSkillResultRank).
	const SITUATIONAL_OUTCOME_TWINS = {
		// situational          skill-roll result
		"Critical success":     "Critical Success",
		"Succeeded":            "Success",
		"Failed":               "Failure",
		"Critical failure":     "Critical Failure"
	};

	// This is the function which says where one result stands, 0 being the best. It reads his
	// eight results in SKILL_ROLL_ORDER, and the four situational words at their twins' places. A
	// word neither list knows ranks last, so a malformed result never beats a real one.
	export function getSkillResultRank(tmpoutcome) {
		var tmpname = SITUATIONAL_OUTCOME_TWINS[tmpoutcome] ?? tmpoutcome;
		var tmprank = SKILL_ROLL_ORDER.indexOf(tmpname);
		return tmprank < 0 ? SKILL_ROLL_ORDER.length : tmprank;
	}

	// This is the function which picks the best of several rolls of the same skill.
	//
	// Player's Guide, "Duplicate Class and Racial Skills": a character may hold the same skill both
	// racially and as a class skill, and then "a skill roll can be made for each multiple of the
	// same skill, and the best roll can be chosen". His own worked example is a Civilized Human
	// Rogue with Move Unseen both ways -- one roll failed and one made is a success, and a critical
	// alongside an ordinary success may be taken as the critical.
	//
	// THE TWO ROLLS ARE NOT AGAINST THE SAME NUMBER. Each instance carries its own chance (the
	// racial one may have a racial bonus, the class one its own starting bonus and points), so each
	// is resolved against its own and only then compared -- which is why this takes resolved
	// results rather than one chance and a list of dice.
	//
	// Ranking is by outcome first, in SKILL_ROLL_ORDER -- his eight results since 2026-09-23, so a
	// copy made by half beats a copy merely made. Where two rolls share an outcome the larger
	// margin is named the chosen one; that tie-break is presentation only, since two ordinary
	// successes do the same thing, and the book leaves the choice to the player anyway. Every roll
	// is returned, not just the winner, so the card can show what was given up.
	export function pickBestSkillRoll(tmpresults) {
		var tmplist = Array.isArray(tmpresults) ? tmpresults : [];
		if (!tmplist.length) { return { rolls: [], best: null, bestIndex: -1 }; }

		var tmpbestindex = 0;
		for (var i = 1; i < tmplist.length; i++) {
			var tmprank = getSkillResultRank(tmplist[i].outcome);
			var tmpbestrank = getSkillResultRank(tmplist[tmpbestindex].outcome);
			if (tmprank < tmpbestrank) { tmpbestindex = i; }
			else if (tmprank == tmpbestrank && tmplist[i].margin > tmplist[tmpbestindex].margin) { tmpbestindex = i; }
		}

		return { rolls: tmplist, best: tmplist[tmpbestindex], bestIndex: tmpbestindex };
	}


// @MARKER UNTRAINED SKILLS

	// This is the function which works out which skills a character could still try untrained.
	//
	// Player's Guide, "Who Can Use a Skill": a skill already held is rolled as itself, not as a
	// common skill ("any skill for which the character has rolled a starting bonus can no longer
	// be attempted as a common skill"), and a restricted skill cannot be tried at all. Both limits
	// were already applied inline where the untrained picker builds its dropdown
	// (actor-character-sheet.mjs #onRollUntrainedSkill); this pulls the same two filters out as a
	// plain function so a second caller -- a list on the Skills tab itself, rather than only the
	// dialog -- does not have to duplicate them.
	//
	// docs/sonnet/2026-09-16-skills-module.md item 1 gave `isRestricted` real data from the books
	// (366 of 674 skills; the rest report as not-found rather than guessed), so this filter now
	// does something: before that pass every skill read as unrestricted and this list would have
	// been all 674. It still is not SHORT -- of the 676 skills in the pack, 305 now carry
	// `isRestricted: true`, so an untrained character is typically offered a few hundred, not a
	// handful -- which is why item 2 of that note is still a judgement call about presentation
	// (a full inline list, a count, a search box) rather than a mechanical one this function
	// settles on its own.
	//
	//   tmpheldnames  = names of skills already on the character (any category)
	//   tmpskillindex = the skill compendium's index rows, each { name, system: { isRestricted } }
	//                   (the same shape tmppack.getIndex({ fields: [...] }) returns)
	export function getUntrainedSkillOptions(tmpheldnames, tmpskillindex) {
		var tmpheld = new Set(Array.isArray(tmpheldnames) ? tmpheldnames : []);
		var tmpindex = Array.isArray(tmpskillindex) ? tmpskillindex : [];
		return tmpindex
			.filter(e => !tmpheld.has(e.name) && !e.system?.isRestricted)
			.sort((a, b) => a.name.localeCompare(b.name));
	}


// @MARKER SKILL SLOT TRICKS

	// What one slot may be traded for, from his four conversion functions. Each is one move; a
	// character wanting two social slots out of two racial ones makes the same move twice.
	//
	//                                     from        to          cost  gain   sheet-worker.js
	//                                     ----------  ----------  ----  ----   ---------------
	export const SLOT_TRANSFERS = {
		racialToClass:   { from: "racial", to: "class",  cost: 1, gain: 1, source: 52649 },
		racialToSocial:  { from: "racial", to: "social", cost: 1, gain: 2, source: 52336 },
		socialToRacial:  { from: "social", to: "racial", cost: 2, gain: 1, source: 56119 },
		socialToClass:   { from: "social", to: "class",  cost: 2, gain: 1, source: 56433 }
	};

	// A slot may also be given up for nothing but a bonus to a skill already held: 2d4%, added to
	// that skill's modifier (sacrificeRacialSkillSlot, sheet-worker.js:52310; the social one at
	// 55824 rolls the same 2d4). His code lets the result stay negative where the skill already
	// carried a penalty larger than the bonus, so the bonus is added rather than floored.
	//
	// ONLY RACIAL AND SOCIAL SLOTS CAN BE GIVEN UP. There is no class equivalent in his sheet, and
	// no class conversion out of class either -- class slots are what every other slot is traded
	// FOR, never traded away.
	export const SLOT_SACRIFICE_DICE = "2d4";
	export const SACRIFICEABLE_SLOTS = ["racial", "social"];

	// This is the function which works out how many slots each category actually has, after the
	// trades a character has made. The base figures come from the Knowledge table; everything here
	// is the arithmetic of his four conversion functions and his two sacrifices, applied to them.
	//
	//   tmpbase  = { class, racial, social }, the Knowledge allowance
	//   tmpmoves = how many times each transfer was made, plus the two sacrifice counts
	//
	// Nothing is floored: a character who has traded away more than they had reads as negative,
	// which the sheet shows as over-allocated rather than silently correcting. His sheet cannot
	// reach that state because it blocks the move at the point of making it; this model records
	// the moves instead, so it can show the arithmetic that got there.
	export function getSlotAllowance(tmpbase, tmpmoves) {
		var tmpout = {
			class:  parseInt(tmpbase?.class) || 0,
			racial: parseInt(tmpbase?.racial) || 0,
			social: parseInt(tmpbase?.social) || 0
		};

		for (const tmpkey of Object.keys(SLOT_TRANSFERS)) {
			var tmptransfer = SLOT_TRANSFERS[tmpkey];
			var tmpcount = parseInt(tmpmoves?.[tmpkey]) || 0;
			if (tmpcount <= 0) { continue; }
			tmpout[tmptransfer.from] = tmpout[tmptransfer.from] - (tmptransfer.cost * tmpcount);
			tmpout[tmptransfer.to]   = tmpout[tmptransfer.to]   + (tmptransfer.gain * tmpcount);
		}

		tmpout.racial = tmpout.racial - (parseInt(tmpmoves?.racialSacrificed) || 0);
		tmpout.social = tmpout.social - (parseInt(tmpmoves?.socialSacrificed) || 0);

		return tmpout;
	}

	// This is the function which says whether one more of a given move can be made.
	//
	// His guard is that the source category must have an OPEN slot to give up -- "There are no open
	// slots to convert. Nothing done." (sheet-worker.js:7353), and the same shape for a sacrifice.
	// A slot already filled by a skill is not open, so the test is against what is left unused,
	// not against the allowance.
	//
	// His social-to-racial move carries a second guard, that racial must have an unavailable slot
	// for the new one to open into (sheet-worker.js:7607). That is his twenty-row sheet running out
	// of rows, not a rule, and there are no rows here, so it is deliberately not ported.
	export function canTransferSlot(tmpkey, tmpallowance, tmpused) {
		var tmptransfer = SLOT_TRANSFERS[tmpkey];
		if (!tmptransfer) { return { allowed: false, reason: "No such transfer." }; }

		var tmpfree = (parseInt(tmpallowance?.[tmptransfer.from]) || 0) - (parseInt(tmpused?.[tmptransfer.from]) || 0);
		if (tmpfree < tmptransfer.cost) {
			return { allowed: false, reason: `Needs ${tmptransfer.cost} unused ${tmptransfer.from} slot${tmptransfer.cost > 1 ? "s" : ""}; ${tmpfree} left.` };
		}
		return { allowed: true, reason: "" };
	}

	// This is the function which says whether a slot of a category can be given up for a bonus.
	// The same open-slot test as a transfer, plus his rule that the bonus must land on a skill the
	// character actually holds -- "Cannot select an Open Slot to receive modifiers from Sacrifice"
	// (sheet-worker.js:7244).
	export function canSacrificeSlot(tmpcategory, tmpallowance, tmpused, tmphasskill) {
		if (!SACRIFICEABLE_SLOTS.includes(tmpcategory)) {
			return { allowed: false, reason: "Only racial and social slots can be given up." };
		}
		var tmpfree = (parseInt(tmpallowance?.[tmpcategory]) || 0) - (parseInt(tmpused?.[tmpcategory]) || 0);
		if (tmpfree < 1) { return { allowed: false, reason: `No unused ${tmpcategory} slot to give up.` }; }
		if (!tmphasskill) { return { allowed: false, reason: "The bonus needs a skill to land on." }; }
		return { allowed: true, reason: "" };
	}
// @END (CODE)
