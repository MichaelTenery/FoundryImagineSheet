// @START (CODE)
// @MARKER SKILL TRAINING RULES
//==================================================================================================================
// Adding a racial or social skill to a made character, and training one up: the Character Updater's
// "Add Racial Skill", "Add Social Skill", "Train Up Racial Skill" and "Train Up Social Skill" (his
// update_add_race_skill, update_add_social_skill, update_improve_race_skill, update_improve_social_skill).
// Nothing here rolls a die or talks to Foundry; the dice arrive as arguments and the windows are in
// module/apps/skill-training.mjs, the writing in module/skill-training.mjs.
//
// Ported from his sheet-worker.js. The two kinds are the same code written twice, with the names changed:
//
//                            racial                            social
//   open slot test           checkForOpenRacialSkillSlot       checkForOpenSocialSkillSlot        125356 / 125849
//   pick the skill           setRacialSkillLearnDetails        setSocialSkillLearnDetails         125386 / 125879
//   learn chance             checkAllLearnRacialSkillModifiers checkAllLearnSocialSkillModifiers  125462 / 125955
//   learn roll               handleRacialSkillLearnTry         handleSocialSkillLearnTry          125523 / 126016
//   what the new skill gets  getNewRacialSkillModifier         getNewSocialSkillModifier          125617 / 125637
//   pick one to train        setRacialSkillImproveDetails      setSocialSkillImproveDetails       126327 / 126824
//   train chance             checkAllImproveRacialSkillModifiers  ...Social...                    126401 / 126898
//   train roll               handleRacialSkillImproveTry       handleSocialSkillImproveTry        126466 / 126963
//   the improvement          improveRacialSkill                improveSocialSkill                 126604 / 127101
//
// THE SHAPE OF IT, which is his and the Player's Guide's (p.164, "Learning New Skills" and "Improving
// Learned Skills (Training)"):
//   - LEARN: needs an open slot of that kind. Hours trained must reach the skill's learn time, then one
//     d100 against  base chance + circumstance modifiers + 10% per earlier failure.
//   - TRAIN: the same, with -5% for every earlier success (the first learning counts as one), and a
//     success adds to the skill's ability bonus -- 2d4%, or per full 10% a teacher has over the student.
//   - Circumstance: a book +10, a library +20; and ONE of self-taught +0, a teacher +20, an instructor +50.
//
// WHERE THE PORT DEPARTS FROM HIS CODE, stated rather than done silently (each is for the user to rule on):
//   1. A FAILED training roll does not count as a success. His failure branch writes the history's
//      "improvements" field as previous + 1 (126541), under his own comment "add a success to the record" --
//      while the live field is not touched. The book says only successes count (p.164). A failure adds its
//      +10% and nothing else here.
//   2. The book's two caps -- the Learn chance never below 5%, and a student never above the teacher's total
//      chance (p.164) -- are in neither his sheet nor here. His sheet wins; the figures are shown as his are.
//   3. His "must make Instruction roll" for an instructor is a note on his panel, not a check in his handler;
//      it is the same here. The teacher's and instructor's own skill chances are typed in, as his are.
//   4. A new racial skill starts with its dice and what the character's social skills give it
//      (getNewRacialSkillModifier). His learn does NOT add the race's own bonus on that skill, and does not
//      double the dice as creation does (setRacialSkillAbility, 53452); neither does this.
//==================================================================================================================

import { getSocialToRaceClassBonus, getExtraSocialMods, getSocialSkillRaceMod } from "./social-skill-rules.mjs";

// @MARKER THE TWO KINDS
//
//              key        label       skill-slot key on system.skillSlots
export const TRAINING_KINDS = {
	racial: { key: "racial", label: "Racial", slots: "racial", usedKey: "racialUsed", category: "racial" },
	social: { key: "social", label: "Social", slots: "social", usedKey: "socialUsed", category: "social" }
};

// His circumstance figures (checkAllLearn...Modifiers, checkAllImprove...Modifiers).
export const BOOK_BONUS        = 10;
export const LIBRARY_BONUS     = 20;
export const TEACHER_BONUS     = 20;
export const INSTRUCTOR_BONUS  = 50;
export const FAILURE_BONUS     = 10;   // per earlier failure
export const SUCCESS_PENALTY   = 5;    // per earlier success (training only)
export const HOURS_PER_DAY     = 8;    // his "Hours Trained (max. 8 per day)"

// One of three: his self / teacher / instructor ticks switch each other off.
export const TEACHING_MODES = [ "self", "teacher", "instructor" ];

// This is the function which says whether the kind is one of the two.
export function getKind(tmpkind) {
	return TRAINING_KINDS[tmpkind] ?? null;
}

// @MARKER OPEN SLOTS
// This is the function which says whether a character has a slot for a new skill of this kind --
// his checkForOpenRacialSkillSlot / checkForOpenSocialSkillSlot, which look for a row reading "Open Slot".
// The port has no rows: a slot is open when the allowance (Knowledge's, after any trades) is more than
// the skills held (skillSlots in data/actor-character.mjs). Returns { allowed, open, message }; the message
// is his own wording when there is none.
export function getOpenSlots(tmpskillslots, tmpkind, tmpname) {
	var tmpk = getKind(tmpkind);
	if (!tmpk) { return { allowed: false, open: 0, message: "Not a skill kind." }; }
	var tmpallowance = parseInt(tmpskillslots?.[tmpk.slots]) || 0;
	var tmpused = parseInt(tmpskillslots?.[tmpk.usedKey]) || 0;
	var tmpopen = tmpallowance - tmpused;
	if (tmpopen > 0) { return { allowed: true, open: tmpopen, message: "" }; }
	return { allowed: false, open: Math.max(0, tmpopen),
		message: `${tmpname || "This character"} does not have any open slots for a new ${tmpk.label} Skill. `
			+ `Improve Knowledge rating before trying to learn a new ${tmpk.label} Skill.` };
}

// @MARKER LEARN TIME
// This is the function which gives the hours a skill takes to learn: the skill's own Learn column when it
// has one, otherwise four times its rating (getRacialSkillLearnTime 53254, getSocialSkillLearnTime 56769).
export function getLearnHours(tmpskillsystem) {
	var tmplearn = parseInt(tmpskillsystem?.learn);
	if (Number.isFinite(tmplearn) && ("" + (tmpskillsystem?.learn ?? "")).trim() !== "") { return tmplearn; }
	return (parseInt(tmpskillsystem?.skillRating) || 0) * 4;
}

// @MARKER TEACHING MODE
// This is the function which keeps his three ticks one-of-three (the whatChanged "Self" / "Teacher" /
// "Instructor" branches): switching one on switches the others off; switching the one that is on OFF
// puts self-taught back, since "none of the others are on, so self_taught has to be rechecked".
export function setTeachingMode(tmpcurrent, tmpchanged, tmpon) {
	if (!TEACHING_MODES.includes(tmpchanged)) { return TEACHING_MODES.includes(tmpcurrent) ? tmpcurrent : "self"; }
	if (tmpon) { return tmpchanged; }
	return tmpcurrent == tmpchanged ? "self" : (TEACHING_MODES.includes(tmpcurrent) ? tmpcurrent : "self");
}

// @MARKER THE CHANCE
// This is the function which works out the chance a try is made against, with each term kept for the
// panel. His checkAll... functions: the base, then +10 book, +20 library, +20 teacher or +50 instructor,
// then +10 per failure -- and, training only, -5 per earlier success.
//
//   tmpopts = { base, book, library, mode, fails, improves (training only; undefined for a learn) }
//
// Not floored and not capped (departure 2 above): a character with many successes can read under 5%,
// or negative, which is simply a chance that cannot be made.
export function getTrainingChance(tmpopts) {
	var tmpbase = parseInt(tmpopts?.base) || 0;
	var tmpparts = [];
	var tmpadd = (tmplabel, tmpvalue) => { if (tmpvalue) { tmpparts.push({ label: tmplabel, value: tmpvalue }); } };
	if (tmpopts?.book)    { tmpadd("With Book", BOOK_BONUS); }
	if (tmpopts?.library) { tmpadd("With Library", LIBRARY_BONUS); }
	if (tmpopts?.mode == "teacher")    { tmpadd("Teacher Taught", TEACHER_BONUS); }
	if (tmpopts?.mode == "instructor") { tmpadd("Instructor Taught", INSTRUCTOR_BONUS); }
	if (tmpopts?.improves !== undefined) {
		var tmpimproves = Math.max(0, parseInt(tmpopts.improves) || 0);
		tmpadd("Previous Improvements", -SUCCESS_PENALTY * tmpimproves);
	}
	var tmpfails = Math.max(0, parseInt(tmpopts?.fails) || 0);
	tmpadd("Previous Failures", FAILURE_BONUS * tmpfails);
	var tmptotal = tmpbase + tmpparts.reduce((tmpsum, tmppart) => tmpsum + tmppart.value, 0);
	return { base: tmpbase, parts: tmpparts, total: tmptotal };
}

// @MARKER THE IMPROVEMENT
// This is the function which says what a successful training roll adds, from how the student was taught
// (handleRacialSkillImproveTry, 126466-126497):
//   instructor with a difference over the student   (2d4+2) per full 10%   -> "{2n}d4+{2n}"
//   teacher with a difference over the student      2d4 per full 10%       -> "{2n}d4"
//   otherwise                                       2d4
// where n is the whole tens of the teacher's chance over the student's, truncated as his
// parseInt([a-b]/10) does. A teacher or instructor ticked with no difference teaches nothing, and his
// handler refuses before the roll ("does not have enough skill to teach anything. Nothing done.").
//
//   tmpopts = { mode, teacherChance, instructorChance, currentChance }
// Returns { expr, dice, sides, plus, difference, ok, reason }.
export function getImprovementDice(tmpopts) {
	var tmpcurrent = parseInt(tmpopts?.currentChance) || 0;
	var tmpdiff = (tmpvalue) => parseInt((((parseInt(tmpvalue)) || 0) - tmpcurrent) / 10) || 0;
	var tmpteacher = tmpdiff(tmpopts?.teacherChance);
	var tmpinstructor = tmpdiff(tmpopts?.instructorChance);

	if (tmpopts?.mode == "instructor") {
		if (tmpinstructor < 1) {
			return { expr: "", dice: 0, sides: 4, plus: 0, difference: tmpinstructor, ok: false,
				reason: "'s instructor does not have enough skill to teach anything. Nothing done." };
		}
		return { expr: `${tmpinstructor * 2}d4+${tmpinstructor * 2}`, dice: tmpinstructor * 2, sides: 4,
			plus: tmpinstructor * 2, difference: tmpinstructor, ok: true, reason: "" };
	}
	if (tmpopts?.mode == "teacher") {
		if (tmpteacher < 1) {
			return { expr: "", dice: 0, sides: 4, plus: 0, difference: tmpteacher, ok: false,
				reason: "'s teacher does not have enough skill to teach anything. Nothing done." };
		}
		return { expr: `${tmpteacher * 2}d4`, dice: tmpteacher * 2, sides: 4, plus: 0, difference: tmpteacher, ok: true, reason: "" };
	}
	return { expr: "2d4", dice: 2, sides: 4, plus: 0, difference: 0, ok: true, reason: "" };
}

// This is the function which rolls one of those expressions, "2d4" or "4d4+4" -- his rollDiceFromString
// for the only two shapes the improvement takes. tmproll(sides) rolls one die.
export function rollImprovement(tmpexpr, tmproll) {
	var tmpmatch = ("" + (tmpexpr ?? "")).trim().toLowerCase().match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
	if (!tmpmatch) { return 0; }
	var tmptotal = parseInt(tmpmatch[3] ?? "0");
	for (var i = 0; i < parseInt(tmpmatch[1]); i++) { tmptotal = tmptotal + tmproll(parseInt(tmpmatch[2])); }
	return tmptotal;
}

// @MARKER WHAT THE NEW SKILL STARTS WITH
// This is the function which gives what the character's other skills add to a skill being learned:
//   racial   what the social skills give it         getNewRacialSkillModifier -> getRacialModsFromSocial
//   social   what the racial, class and social      getNewSocialSkillModifier -> getRaceClassSocialMod
//            skills held give it                      and getSocialSkillModsToSocialSkills
// Both are the same tables character creation reads, through module/social-skill-rules.mjs, so a skill
// learned now takes the terms it would have taken at creation (see departure 4 above for what is left out).
// For a social skill that is getExtraSocialMods, which is a little more than his learn code asks -- it
// also gives Falconry and Swimming their extras, as creation does -- so the two never disagree.
//
//   tmpcontext = getActorSkillModContext(actor) in module/class-advancement.mjs (buildSkillModContext)
// Returns { total, parts }.
export function getLearnStartModifier(tmpkind, tmpskillname, tmpcontext) {
	if (tmpkind == "racial") { return getSocialToRaceClassBonus(tmpskillname, tmpcontext?.socialSkills); }
	return getExtraSocialMods(tmpskillname, tmpcontext);
}

// This is the function which says whether the race may take a social skill at all. His copy button
// refuses a skill his race table marks BLOCKED (sheet-worker.js:7420); the learn code never asks. After
// creation it is the Game Master's call, by his ruling of 2026-10-27, so this only says it needs one.
export function isBlockedSocialSkill(tmpskillname, tmpracename) {
	return !!getSocialSkillRaceMod(tmpskillname, tmpracename).blocked;
}

// @MARKER THE HISTORY
// What his four history strings keep (racial_skill_learn_history, social_skill_learn_history,
// racial_skill_improve_history, social_skill_improve_history), as lists of records instead of
// "name,hours,needed,base,fails|name,..." strings. A record per skill, kept across sessions, so hours
// trained and failures survive picking another skill and coming back:
//
//   learn    { name, hours, needed, fails }
//   improve  { name, hours, needed, improves, fails }       improves starts at 1 -- "includes initial learning"
//
// His records also hold the base chance and the chance at the time; here those are read live off the
// skill, which a re-roll of the attributes would otherwise leave stale.
export function getRecord(tmplist, tmpname, tmpmode, tmpneeded) {
	var tmpfound = (Array.isArray(tmplist) ? tmplist : []).find(tmprecord => tmprecord?.name == tmpname);
	var tmpblank = tmpmode == "improve"
		? { name: tmpname, hours: 0, needed: tmpneeded || 0, improves: 1, fails: 0 }
		: { name: tmpname, hours: 0, needed: tmpneeded || 0, fails: 0 };
	return { ...tmpblank, ...(tmpfound ?? {}) };
}

// This is the function which puts a record back in the list, replacing its earlier one.
export function setRecord(tmplist, tmprecord) {
	var tmpother = (Array.isArray(tmplist) ? tmplist : []).filter(tmpold => tmpold?.name != tmprecord.name);
	return [...tmpother, { ...tmprecord }];
}

// His "change:..._hours_trained" handler: a record is only created once there are hours to keep
// (tmpHoursTrained!=0), but one that exists is always updated.
export function applyHours(tmplist, tmpname, tmpmode, tmpneeded, tmphours) {
	var tmpexists = (Array.isArray(tmplist) ? tmplist : []).some(tmprecord => tmprecord?.name == tmpname);
	var tmpvalue = Math.max(0, parseInt(tmphours) || 0);
	if (!tmpexists && tmpvalue == 0) { return Array.isArray(tmplist) ? tmplist : []; }
	return setRecord(tmplist, { ...getRecord(tmplist, tmpname, tmpmode, tmpneeded), hours: tmpvalue });
}

// @MARKER THE TRIES
// This is the function which settles a LEARN try, in his order (handleRacialSkillLearnTry):
//   nothing picked -> not enough hours -> failed the roll -> learned.
// The roll is only made when the first two let it through.
//
//   tmpopts = { name, hours, needed, chance, roll }       roll is the d100, or null when not yet rolled
// Returns { outcome, needsRoll, hoursShort }.
export function resolveLearnTry(tmpopts) {
	if (!tmpopts?.name || tmpopts.name == "None") { return { outcome: "none", needsRoll: false, hoursShort: 0 }; }
	var tmpshort = (parseInt(tmpopts.needed) || 0) - (parseInt(tmpopts.hours) || 0);
	if (tmpshort > 0) { return { outcome: "hours", needsRoll: false, hoursShort: tmpshort }; }
	if (tmpopts.roll === null || tmpopts.roll === undefined) { return { outcome: "ready", needsRoll: true, hoursShort: 0 }; }
	return { outcome: tmpopts.roll > (parseInt(tmpopts.chance) || 0) ? "failed" : "learned", needsRoll: false, hoursShort: 0 };
}

// This is the function which settles a TRAINING try (handleRacialSkillImproveTry): nothing picked ->
// not enough hours -> a teacher or instructor with nothing to teach -> failed the roll -> improved.
//
//   tmpopts = { name, hours, needed, chance, roll, mode, teacherChance, instructorChance, currentChance }
// Returns { outcome, needsRoll, hoursShort, dice }.
export function resolveImproveTry(tmpopts) {
	var tmpdice = getImprovementDice(tmpopts);
	if (!tmpopts?.name || tmpopts.name == "None") { return { outcome: "none", needsRoll: false, hoursShort: 0, dice: tmpdice }; }
	var tmpshort = (parseInt(tmpopts.needed) || 0) - (parseInt(tmpopts.hours) || 0);
	if (tmpshort > 0) { return { outcome: "hours", needsRoll: false, hoursShort: tmpshort, dice: tmpdice }; }
	if (!tmpdice.ok) { return { outcome: tmpopts.mode == "instructor" ? "noInstructor" : "noTeacher", needsRoll: false, hoursShort: 0, dice: tmpdice }; }
	if (tmpopts.roll === null || tmpopts.roll === undefined) { return { outcome: "ready", needsRoll: true, hoursShort: 0, dice: tmpdice }; }
	return { outcome: tmpopts.roll > (parseInt(tmpopts.chance) || 0) ? "failed" : "improved", needsRoll: false, hoursShort: 0, dice: tmpdice };
}

// The record after each result. A failure: hours cleared, one more failure (+10% next time). A success:
// hours cleared, one more success on record, failures reset ("Success eliminates failure modifiers for next
// roll", 126583). Learning a skill leaves its record where it is, as his does.
export function recordAfterLearnFailure(tmprecord) {
	return { ...tmprecord, hours: 0, fails: (parseInt(tmprecord.fails) || 0) + 1 };
}
export function recordAfterImproveFailure(tmprecord) {
	// departure 1: his history also counts this as a success; the book and his live field do not.
	return { ...tmprecord, hours: 0, fails: (parseInt(tmprecord.fails) || 0) + 1 };
}
export function recordAfterImproveSuccess(tmprecord) {
	return { ...tmprecord, hours: 0, improves: (parseInt(tmprecord.improves) || 0) + 1, fails: 0 };
}

// @MARKER WORDING
// His chat lines (the finishRoll text of each handler), kept as his words with the character's name
// first. A function per line rather than one switch, so the test reads them.
export function describeLearnTry(tmpname, tmpresult, tmpopts) {
	var tmpwho = tmpname || "The character";
	if (tmpresult.outcome == "none") { return `${tmpwho} did not select a ${tmpopts.kindLabel} Skill to learn. Nothing done.`; }
	if (tmpresult.outcome == "hours") { return `${tmpwho} needs ${tmpresult.hoursShort} more hours trained to try to learn ${tmpopts.skill}.`; }
	if (tmpresult.outcome == "failed") {
		return `${tmpwho} rolled a ${tmpopts.roll} and needed a ${tmpopts.chance} and did not learn ${tmpopts.skill}. Train more to try again.`;
	}
	var tmpmods = tmpopts.modifier > 0
		? ` and skill modifiers of ${tmpopts.modifier} totaling ${tmpopts.startingBonus + tmpopts.modifier}` : "";
	return `${tmpwho} rolled a ${tmpopts.roll} and succeeded, learning ${tmpopts.skill} with a starting bonus of `
		+ `(${tmpopts.dice})=${tmpopts.startingBonus}${tmpmods}. Added to the ${tmpopts.kindLabel} Skills.`;
}

export function describeImproveTry(tmpname, tmpresult, tmpopts) {
	var tmpwho = tmpname || "The character";
	if (tmpresult.outcome == "none") { return `${tmpwho} did not select a ${tmpopts.kindLabel} Skill to learn. Nothing done.`; }
	if (tmpresult.outcome == "hours") { return `${tmpwho} needs ${tmpresult.hoursShort} more hours trained to try to learn ${tmpopts.skill}.`; }
	if (tmpresult.outcome == "noTeacher" || tmpresult.outcome == "noInstructor") { return `${tmpwho}${tmpresult.dice.reason}`; }
	if (tmpresult.outcome == "failed") {
		return `${tmpwho} rolled a ${tmpopts.roll} and needed a ${tmpopts.chance} and did not learn ${tmpopts.skill}. Train more to try again.`;
	}
	return `${tmpwho} rolled a ${tmpopts.roll} and succeeded, improving ${tmpopts.skill} by (${tmpresult.dice.expr})=${tmpopts.improvement}.`;
}

// @MARKER ADD NEW skill training functions HERE
// @END (CODE)
