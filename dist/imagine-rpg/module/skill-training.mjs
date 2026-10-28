// @START (CODE)
// @MARKER SKILL TRAINING
//==================================================================================================================
// The Foundry side of Add Racial/Social Skill and Train Up Racial/Social Skill: reading the skill compendium
// for what can be learned, keeping each skill's training record on the actor, rolling the d100 and the
// improvement through Foundry's own random source, writing the skill, and saying what happened in chat.
// The rules are module/skill-training-rules.mjs and what the windows show is module/skill-training-view.mjs;
// neither needs Foundry, so tools/skill-training-test.html drives them. The windows are
// module/apps/skill-training.mjs.
//
// WHERE THE RECORDS LIVE. His four history strings (racial_skill_learn_history and its three siblings) are
// kept as actor flags, scope "imagine-rpg", key "skillTraining": { learn: { racial: [], social: [] },
// improve: { racial: [], social: [] } }, each a list of records (see getRecord in the rules). Flags rather
// than schema fields so nothing in the actor's data model changes for a record only these windows read.
//
// WHAT A SKILL IS ON THE ACTOR. A skill item with category "racial" or "social", its starting bonus the
// rolled dice and its ability bonus the fixed terms (the character's other skills lifting it) -- the same
// split character creation makes (module/chargen-rules.mjs). Training adds to the ability bonus, as his
// improveRacialSkill adds to race_skill_N_ability (126604).
//==================================================================================================================

import { TRAINING_KINDS, getLearnHours, getLearnStartModifier, isBlockedSocialSkill, getOpenSlots,
         getRecord, setRecord, applyHours, resolveLearnTry, resolveImproveTry, rollImprovement,
         recordAfterLearnFailure, recordAfterImproveFailure, recordAfterImproveSuccess,
         getTrainingChance, describeLearnTry, describeImproveTry } from "./skill-training-rules.mjs";
import { rollDicePool } from "./chargen-rules.mjs";
import { getActorSkillModContext } from "./class-advancement.mjs";
import { getSocialModRaceName } from "./social-skill-rules.mjs";
import { getPackDocumentsByName } from "./pack-lookup.mjs";
import { explainAvailability } from "./availability.mjs";

const SKILL_PACK = "world.imagine-skills";
const FLAG_SCOPE = "imagine-rpg";
const INDEX_FIELDS = ["system.category", "system.types", "system.sourcebook", "system.attr1", "system.attr2",
                      "system.skillRating", "system.learn", "system.startingDice"];

	// @MARKER DICE
	// One die through Foundry's own random source, so the world's dice settings apply here as everywhere.
	export function rollDie(tmpsides) {
		return Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1;
	}

	// @MARKER WHAT CAN BE LEARNED
	// This is the function which lists the skills of one kind that can be learned: every skill of that
	// category in the compendium the character does not hold, that the campaign's switches allow, by name.
	// His dropdown (all_race_skills, all_social_skills) was a fixed list of every skill of the kind; this is
	// the same list read from the compendium. A skill held only as a COMMON skill is still learnable -- it
	// is not in a slot. Returns [{ name, system }], empty when the content has not been imported.
	export async function loadLearnableSkills(tmpactor, tmpkind) {
		var tmppack = game.packs.get(SKILL_PACK);
		if (!tmppack) { return []; }
		var tmpcategory = TRAINING_KINDS[tmpkind]?.category;
		var tmpheld = new Set((tmpactor?.items ?? []).filter(tmpitem => tmpitem.type == "skill" && !tmpitem.system?.isCommon)
			.map(tmpitem => tmpitem.name));
		var tmprules = game.imagine?.getAvailabilityRules?.();
		var tmpindex = [...await tmppack.getIndex({ fields: INDEX_FIELDS })];
		return tmpindex
			.filter(tmpentry => tmpentry.system?.category == tmpcategory && !tmpheld.has(tmpentry.name))
			.filter(tmpentry => explainAvailability({ name: tmpentry.name, type: "skill", system: tmpentry.system }, tmprules).available)
			.sort((tmpa, tmpb) => tmpa.name.localeCompare(tmpb.name))
			.map(tmpentry => ({ name: tmpentry.name, system: tmpentry.system }));
	}

	// This is the function which lists the skills of one kind a character holds and can train, in the
	// order his lists had them (the slots'), with each one's current chance -- his improve_..._list and
	// improve_..._chance_list, which skipped "Open Slot" and "Unavailable". Common skills are not held.
	export function getTrainableSkills(tmpactor, tmpkind) {
		var tmpcategory = TRAINING_KINDS[tmpkind]?.category;
		return [...(tmpactor?.items ?? [])]
			.filter(tmpitem => tmpitem.type == "skill" && tmpitem.system?.category == tmpcategory && !tmpitem.system?.isCommon)
			.map(tmpitem => ({ id: tmpitem.id, name: tmpitem.name, chance: Math.round(tmpitem.system?.totalChance ?? 0),
				base: Math.round(tmpitem.system?.baseChance ?? 0), system: tmpitem.system }));
	}

	// @MARKER THE RECORDS
	export function getHistory(tmpactor, tmpmode, tmpkind) {
		var tmplist = tmpactor?.getFlag?.(FLAG_SCOPE, `skillTraining.${tmpmode}.${tmpkind}`);
		return Array.isArray(tmplist) ? tmplist : [];
	}
	export async function saveHistory(tmpactor, tmpmode, tmpkind, tmplist) {
		await tmpactor.setFlag(FLAG_SCOPE, `skillTraining.${tmpmode}.${tmpkind}`, tmplist);
	}

	// This is the function which keeps the hours typed into a window -- his change:..._hours_trained.
	export async function saveHours(tmpactor, tmpmode, tmpkind, tmpname, tmpneeded, tmphours) {
		if (!tmpname) { return; }
		var tmpold = getHistory(tmpactor, tmpmode, tmpkind);
		var tmpnew = applyHours(tmpold, tmpname, tmpmode, tmpneeded, tmphours);
		if (tmpnew !== tmpold) { await saveHistory(tmpactor, tmpmode, tmpkind, tmpnew); }
	}

	// @MARKER WHAT A SELECTED SKILL IS
	// This is the function which gives the figures of a skill about to be learned -- his
	// setRacialSkillLearnDetails: the base chance off the character's attributes, the learn time, the start
	// dice, and what the character's other skills will add to it. entry is a compendium index row.
	export function getLearnDetails(tmpactor, tmpkind, tmpentry) {
		var tmpsys = tmpentry?.system ?? {};
		var tmpcontext = { ...getActorSkillModContext(tmpactor), skillName: tmpentry?.name };
		var tmpracename = tmpcontext.raceName ?? getSocialModRaceName(tmpactor?.system?.raceItems?.[0]);
		return {
			base: Math.round(tmpactor?.system?.getCommonSkillChance?.(tmpsys.attr1, tmpsys.attr2, tmpsys.skillRating) ?? 0),
			hoursNeeded: getLearnHours(tmpsys),
			startingDice: tmpsys.startingDice ?? "",
			modifier: getLearnStartModifier(tmpkind, tmpentry?.name, tmpcontext),
			raceName: tmpracename,
			blocked: tmpkind == "social" && isBlockedSocialSkill(tmpentry?.name, tmpracename)
		};
	}

	// @MARKER SAYING IT
	async function say(tmpactor, tmpline) {
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			content: `<p>${foundry.utils.escapeHTML(tmpline)}</p>`
		});
	}

	// @MARKER LEARN
	// This is the function behind the LEARN button -- his handleRacialSkillLearnTry. Returns
	// { outcome, message } so the window can refresh; it has already said it in chat.
	//
	//   tmpstate = { name, hours, chance, book, library, mode }  (the window's own answers)
	export async function tryLearnSkill(tmpactor, tmpkind, tmpstate) {
		var tmpk = TRAINING_KINDS[tmpkind];
		var tmpname = tmpstate?.name ?? "";
		var tmpentry = (await loadLearnableSkills(tmpactor, tmpkind)).find(tmpcandidate => tmpcandidate.name == tmpname);
		var tmpdetails = tmpentry ? getLearnDetails(tmpactor, tmpkind, tmpentry) : null;
		var tmphistory = getHistory(tmpactor, "learn", tmpkind);
		var tmprecord = getRecord(tmphistory, tmpname, "learn", tmpdetails?.hoursNeeded);
		var tmpopts = { kindLabel: tmpk.label, skill: tmpname };

		// No slot (it may have been taken since the window opened), or a skill the race may not take.
		var tmpslots = getOpenSlots(tmpactor.system?.skillSlots, tmpkind, tmpactor.name);
		if (tmpname && !tmpslots.allowed) { await say(tmpactor, tmpslots.message); return { outcome: "noSlot", message: tmpslots.message }; }
		if (tmpdetails?.blocked) {
			var tmpblocked = `${tmpdetails.raceName || "This race"} cannot acquire ${tmpname}. Nothing done.`;
			await say(tmpactor, tmpblocked);
			return { outcome: "blocked", message: tmpblocked };
		}

		var tmpchance = getTrainingChance({ base: tmpdetails?.base, book: tmpstate.book, library: tmpstate.library,
			mode: tmpstate.mode, fails: tmprecord.fails }).total;
		var tmpfirst = resolveLearnTry({ name: tmpentry ? tmpname : "", hours: tmpstate.hours, needed: tmpdetails?.hoursNeeded,
			chance: tmpchance, roll: null });
		var tmpresult = tmpfirst;
		var tmproll = null;
		if (tmpfirst.needsRoll) {
			tmproll = rollDie(100);
			tmpresult = resolveLearnTry({ name: tmpname, hours: tmpstate.hours, needed: tmpdetails.hoursNeeded, chance: tmpchance, roll: tmproll });
		}
		tmpopts.roll = tmproll; tmpopts.chance = tmpchance;

		if (tmpresult.outcome == "failed") {
			await saveHistory(tmpactor, "learn", tmpkind, setRecord(tmphistory, recordAfterLearnFailure(
				{ ...tmprecord, hours: parseInt(tmpstate.hours) || 0 })));
		}
		if (tmpresult.outcome == "learned") {
			var tmpdoc = (await getPackDocumentsByName(SKILL_PACK, [tmpname]))[0];
			if (!tmpdoc) {
				var tmpmissing = `${tmpname} is not in the skill compendium. Nothing done.`;
				await say(tmpactor, tmpmissing);
				return { outcome: "missing", message: tmpmissing };
			}
			tmpopts.dice = tmpdetails.startingDice || "0";
			tmpopts.startingBonus = rollDicePool(tmpdetails.startingDice, rollDie);
			tmpopts.modifier = tmpdetails.modifier.total;
			var tmpsystem = { ...foundry.utils.deepClone(tmpdoc.system ?? {}), category: tmpk.category, acquiredAtTitle: 0,
				startingBonus: tmpopts.startingBonus, abilityBonus: tmpdetails.modifier.total, misc: 0, isCommon: false };
			// A skill the character already held as a COMMON one becomes the learned skill, not a second copy.
			var tmpcommon = tmpactor.items.find(tmpitem => tmpitem.type == "skill" && tmpitem.name == tmpname && tmpitem.system?.isCommon);
			if (tmpcommon) { await tmpcommon.update({ system: tmpsystem }); }
			else { await tmpactor.createEmbeddedDocuments("Item", [{ name: tmpdoc.name, type: "skill", img: tmpdoc.img, system: tmpsystem }]); }
		}
		var tmpmessage = describeLearnTry(tmpactor.name, tmpresult, tmpopts);
		await say(tmpactor, tmpmessage);
		return { outcome: tmpresult.outcome, message: tmpmessage };
	}

	// @MARKER IMPROVE
	// This is the function behind the IMPROVE button -- his handleRacialSkillImproveTry.
	//
	//   tmpstate = { name, hours, book, library, mode, teacherChance, instructorChance }
	export async function tryImproveSkill(tmpactor, tmpkind, tmpstate) {
		var tmpk = TRAINING_KINDS[tmpkind];
		var tmpname = tmpstate?.name ?? "";
		var tmpitem = getTrainableSkills(tmpactor, tmpkind).find(tmpcandidate => tmpcandidate.name == tmpname);
		var tmphistory = getHistory(tmpactor, "improve", tmpkind);
		var tmpneeded = tmpitem ? getLearnHours(tmpitem.system) : 0;
		var tmprecord = getRecord(tmphistory, tmpname, "improve", tmpneeded);
		var tmpchance = getTrainingChance({ base: tmpitem?.base, book: tmpstate.book, library: tmpstate.library, mode: tmpstate.mode,
			fails: tmprecord.fails, improves: tmprecord.improves }).total;
		var tmpcommon = { name: tmpitem ? tmpname : "", hours: tmpstate.hours, needed: tmpneeded, chance: tmpchance, mode: tmpstate.mode,
			teacherChance: tmpstate.teacherChance, instructorChance: tmpstate.instructorChance, currentChance: tmpitem?.chance };
		var tmpresult = resolveImproveTry({ ...tmpcommon, roll: null });
		var tmproll = null;
		if (tmpresult.needsRoll) {
			tmproll = rollDie(100);
			tmpresult = resolveImproveTry({ ...tmpcommon, roll: tmproll });
		}
		var tmpopts = { kindLabel: tmpk.label, skill: tmpname, roll: tmproll, chance: tmpchance, improvement: 0 };

		if (tmpresult.outcome == "failed") {
			await saveHistory(tmpactor, "improve", tmpkind, setRecord(tmphistory, recordAfterImproveFailure(
				{ ...tmprecord, hours: parseInt(tmpstate.hours) || 0 })));
		}
		if (tmpresult.outcome == "improved") {
			tmpopts.improvement = rollImprovement(tmpresult.dice.expr, rollDie);
			var tmpskill = tmpactor.items.get(tmpitem.id);
			await tmpskill.update({ "system.abilityBonus": (parseInt(tmpskill.system.abilityBonus) || 0) + tmpopts.improvement });
			await saveHistory(tmpactor, "improve", tmpkind, setRecord(tmphistory, recordAfterImproveSuccess(
				{ ...tmprecord, hours: parseInt(tmpstate.hours) || 0 })));
		}
		var tmpmessage = describeImproveTry(tmpactor.name, tmpresult, tmpopts);
		await say(tmpactor, tmpmessage);
		return { outcome: tmpresult.outcome, message: tmpmessage };
	}

// @MARKER ADD NEW skill training functions HERE
// @END (CODE)
