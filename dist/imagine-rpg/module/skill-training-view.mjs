// @START (CODE)
// @MARKER SKILL TRAINING VIEW
//==================================================================================================================
// What the Add Skill and Train Up Skill windows show, worked out from the facts the window gathers, so the
// preview renders the same template against the same view and the two cannot drift apart (the pattern of
// module/brawling-view.mjs). No Foundry here.
//
// ADD (his "LEARN NEW RACIAL SKILL" / "LEARN NEW SOCIAL SKILL" panel): a dropdown of every skill of the kind
// not yet held and a SELECT; then the skill's learn time, hours trained, the learn chance with its circumstance
// ticks, and a LEARN button. With no open slot the panel is the one line his "no_racial_skill_slots" div shows.
//
// TRAIN (his "IMPROVE RACIAL SKILL" panel, as in the bug report's screenshot): Select Skill to Improve with
// its left and right arrows and the skill's chance, SELECT; Skill to Train and its chance; Hours Trained and
// Training Hours Needed; the base, the modifiers, the previous improvements and failures; TOTAL CHANCE;
// IMPROVE.
//==================================================================================================================

import { TRAINING_KINDS, HOURS_PER_DAY, BOOK_BONUS, LIBRARY_BONUS, TEACHER_BONUS, INSTRUCTOR_BONUS,
         getOpenSlots, getTrainingChance, getImprovementDice, FAILURE_BONUS, SUCCESS_PENALTY } from "./skill-training-rules.mjs";

// The three circumstances laid out the way his panel does, each with what it adds.
function buildModes(tmpmode, tmptrain) {
	var tmprows = [
		{ key: "self", label: "Self Taught", bonus: "+0%", on: tmpmode == "self",
		  improvement: tmptrain ? "2d4%" : "" },
		{ key: "teacher", label: "Teacher Taught", bonus: `+${TEACHER_BONUS}%`, on: tmpmode == "teacher",
		  improvement: tmptrain ? "2d4% (per 10% difference in skill chances)" : "", asksChance: tmptrain,
		  chanceName: "teacherChance", chanceLabel: "Teacher's Skill Chance",
		  chanceNote: "must be 10%+ higher than skill chance" },
		{ key: "instructor", label: "Instructor Taught", bonus: `+${INSTRUCTOR_BONUS}%`, on: tmpmode == "instructor",
		  improvement: tmptrain ? "2d4+2% (per 10% difference in skill chances)" : "", asksChance: tmptrain,
		  chanceName: "instructorChance", chanceLabel: "Instructor's Skill Chance",
		  chanceNote: "must be 10%+ higher than skill chance", extra: "must make Instruction roll" }
	];
	return tmprows;
}

function describeParts(tmpparts) {
	return (tmpparts ?? []).map(tmppart => `${tmppart.label} ${tmppart.value < 0 ? "" : "+"}${tmppart.value}%`).join(", ");
}

// @MARKER THE ADD WINDOW
//
//   tmpf = { characterName, kind, skillSlots, options: [names], dropdown: the name picked in the list,
//            chosen: the name SELECTed, details: { base, hoursNeeded, startingDice, blocked, modifier: {total, parts} },
//            record: { hours, fails }, working: { book, library, mode } }
export function buildAddView(tmpf) {
	var tmpkind = TRAINING_KINDS[tmpf?.kind] ?? TRAINING_KINDS.racial;
	var tmpslots = getOpenSlots(tmpf?.skillSlots, tmpkind.key, tmpf?.characterName);
	var tmpview = { isAdd: true, isTrain: false, kind: tmpkind.key, kindLabel: tmpkind.label,
		characterName: tmpf?.characterName ?? "", hasSlots: tmpslots.allowed, openSlots: tmpslots.open, noSlotsMessage: tmpslots.message,
		title: `Learn New ${tmpkind.label} Skill` };
	if (!tmpslots.allowed) { return tmpview; }

	var tmpchosen = tmpf?.chosen ?? "";
	tmpview.options = (tmpf?.options ?? []).map(tmpname => ({ name: tmpname, selected: tmpname == (tmpf?.dropdown ?? tmpchosen) }));
	tmpview.chosen = tmpchosen;
	tmpview.hasChosen = !!tmpchosen;
	tmpview.blocked = !!tmpf?.details?.blocked;
	// BLOCKED binds at creation only. After it, his ruling of 2026-10-27: "I want that option in the
	// hands of the GM" -- a dwarf may never swim, or the Game Master may hand them floaties.
	tmpview.isGM = !!tmpf?.isGM;
	tmpview.blockedMessage = !tmpview.blocked ? "" : tmpview.isGM
		? `${tmpf.details.raceName || "This race"} cannot take ${tmpchosen} at creation. As Game Master you may allow it now.`
		: `${tmpf.details.raceName || "This race"} cannot take ${tmpchosen} without the Game Master's say-so: they can open this window on your character and add it.`;
	if (!tmpchosen) { return tmpview; }

	var tmpd = tmpf?.details ?? {};
	var tmpw = tmpf?.working ?? {};
	var tmprec = tmpf?.record ?? {};
	var tmpmode = tmpw.mode ?? "self";
	var tmpchance = getTrainingChance({ base: tmpd.base, book: !!tmpw.book, library: !!tmpw.library, mode: tmpmode, fails: tmprec.fails });
	tmpview.baseChance = tmpchance.base;
	tmpview.hours = tmprec.hours ? tmprec.hours : "";
	tmpview.hoursNeeded = tmpd.hoursNeeded ?? 0;
	tmpview.hoursMax = HOURS_PER_DAY;
	tmpview.startingDice = tmpd.startingDice || "none";
	tmpview.fails = parseInt(tmprec.fails) || 0;
	tmpview.failBonus = tmpview.fails * FAILURE_BONUS;
	tmpview.book = !!tmpw.book;
	tmpview.library = !!tmpw.library;
	tmpview.bookBonus = `+${BOOK_BONUS}%`;
	tmpview.libraryBonus = `+${LIBRARY_BONUS}%`;
	tmpview.modes = buildModes(tmpmode, false);
	tmpview.totalChance = tmpchance.total;
	tmpview.chanceParts = describeParts(tmpchance.parts);
	tmpview.hoursShort = Math.max(0, tmpview.hoursNeeded - (parseInt(tmprec.hours) || 0));
	tmpview.modifierText = tmpd.modifier?.total ? `${tmpd.modifier.total >= 0 ? "+" : ""}${tmpd.modifier.total}% from skills held (${describeParts(
		(tmpd.modifier.parts ?? []).map(tmppart => ({ label: tmppart.label, value: tmppart.percent })))})` : "";
	tmpview.canLearn = !tmpview.blocked || tmpview.isGM;
	return tmpview;
}

// @MARKER THE TRAIN WINDOW
//
//   tmpf = { characterName, kind, held: [{ name, chance }]  the skills of the kind that can be trained, in order,
//            index: where the arrows stand, chosen: the name SELECTed, base, hoursNeeded, currentChance,
//            record: { hours, improves, fails }, working: { book, library, mode, teacherChance, instructorChance } }
export function buildTrainView(tmpf) {
	var tmpkind = TRAINING_KINDS[tmpf?.kind] ?? TRAINING_KINDS.racial;
	var tmpheld = tmpf?.held ?? [];
	var tmpview = { isAdd: false, isTrain: true, kind: tmpkind.key, kindLabel: tmpkind.label,
		characterName: tmpf?.characterName ?? "", title: `Improve ${tmpkind.label} Skill`, hasSkills: tmpheld.length > 0,
		noSkillsMessage: `${tmpf?.characterName || "This character"} has no ${tmpkind.label.toLowerCase()} skills to train.` };
	if (!tmpheld.length) { return tmpview; }

	var tmpindex = Math.max(0, Math.min(tmpheld.length - 1, parseInt(tmpf?.index) || 0));
	var tmpcurrent = tmpheld[tmpindex];
	tmpview.index = tmpindex;
	tmpview.selectName = tmpcurrent.name;
	tmpview.selectChance = tmpcurrent.chance;
	tmpview.count = tmpheld.length;

	var tmpchosen = tmpf?.chosen ?? "";
	tmpview.chosen = tmpchosen;
	tmpview.hasChosen = !!tmpchosen;
	tmpview.trainName = tmpchosen || "None";
	tmpview.trainChance = tmpchosen ? (tmpf?.currentChance ?? 0) : 0;
	var tmpw = tmpf?.working ?? {};
	var tmprec = tmpf?.record ?? {};
	var tmpmode = tmpw.mode ?? "self";
	var tmpchance = getTrainingChance({ base: tmpchosen ? tmpf?.base : 0, book: tmpchosen && !!tmpw.book, library: tmpchosen && !!tmpw.library,
		mode: tmpchosen ? tmpmode : "self",
		fails: tmpchosen ? tmprec.fails : 0, improves: tmpchosen ? tmprec.improves : 0 });
	tmpview.hours = tmprec.hours ? tmprec.hours : "";
	tmpview.hoursNeeded = tmpchosen ? (tmpf?.hoursNeeded ?? 0) : 0;
	tmpview.hoursMax = HOURS_PER_DAY;
	tmpview.baseChance = tmpchance.base;
	tmpview.book = !!tmpw.book;
	tmpview.library = !!tmpw.library;
	tmpview.bookBonus = `+${BOOK_BONUS}%`;
	tmpview.libraryBonus = `+${LIBRARY_BONUS}%`;
	tmpview.modes = buildModes(tmpmode, true).map(tmprow => ({ ...tmprow,
		chance: tmprow.key == "teacher" ? (tmpw.teacherChance ?? "") : tmprow.key == "instructor" ? (tmpw.instructorChance ?? "") : "" }));
	tmpview.improves = tmpchosen ? (parseInt(tmprec.improves) || 0) : 0;
	tmpview.fails = tmpchosen ? (parseInt(tmprec.fails) || 0) : 0;
	tmpview.improvesPenalty = tmpview.improves * SUCCESS_PENALTY;
	tmpview.failBonus = tmpview.fails * FAILURE_BONUS;
	tmpview.totalChance = tmpchance.total;
	tmpview.chanceParts = describeParts(tmpchance.parts);
	var tmpdice = getImprovementDice({ mode: tmpmode, teacherChance: tmpw.teacherChance, instructorChance: tmpw.instructorChance,
		currentChance: tmpf?.currentChance });
	tmpview.improvement = tmpdice.ok ? tmpdice.expr + "%" : "";
	tmpview.improvementProblem = (!tmpdice.ok && tmpchosen) ? (tmpmode == "instructor" ? "The instructor" : "The teacher") + " needs a skill chance 10%+ higher than "
		+ (tmpf?.currentChance ?? 0) + "% to teach anything." : "";
	tmpview.hoursShort = tmpchosen ? Math.max(0, tmpview.hoursNeeded - (parseInt(tmprec.hours) || 0)) : 0;
	tmpview.improveLabel = tmpchosen ? tmpchosen : "None";
	return tmpview;
}

// @MARKER ADD NEW skill training view functions HERE
// @END (CODE)
