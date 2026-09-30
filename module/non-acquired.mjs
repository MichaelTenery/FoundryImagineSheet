// @START (CODE)
// @MARKER NON-ACQUIRED LOOKUP
//==================================================================================================================
// The Foundry side of module/skills-rules.mjs's common and non-acquired skills: what a character
// may attempt WITHOUT holding it, and at what chance. Reads the skill compendium once and answers
// by name, so a lore roll, the Magic & Lore tab, the item picker and the untrained-skill dialog
// all say the same thing about the same skill.
//
// Bug reports 0.20.7:1 and 0.20.8:1 (2026-09-30): Candle Lore, a Gray Witch's 2nd-title skill,
// was missing from the untrained list, and a candle ritual could not be learned at all -- "Not
// Held ... 0%" -- although the Player's Guide (p.77) lets a non-acquired class skill be tried as
// a common skill. The pack index carries the two flags that decide it (isRestricted,
// noNonAcquiredUse) and the attributes the base chance needs.
//==================================================================================================================

import { getNonAcquiredSkillNames, canUseNonAcquired, getUntrainedSkillGroups } from "./skills-rules.mjs";

const SKILL_PACK = "world.imagine-skills";
const INDEX_FIELDS = ["system.attr1", "system.attr2", "system.skillRating", "system.category",
                      "system.isRestricted", "system.noNonAcquiredUse"];

	// This is the function which reads the skill compendium's index, with the fields the footing
	// and the base chance need. Empty when the content has not been imported.
	export async function loadSkillIndex() {
		var tmppack = game.packs.get(SKILL_PACK);
		if (!tmppack) { return []; }
		return [...await tmppack.getIndex({ fields: INDEX_FIELDS })];
	}

	// This is the function which builds a lookup for one character: (name) -> { chance, footing,
	// reason, entry } for a skill not held, or null for a name the compendium does not have. The
	// chance is the base chance alone -- getCommonSkillChance, the Player's Guide's "common skill
	// chance is simply the base chance without the starting bonus". The lookup is synchronous once
	// built, so the pure rules modules can take it as their fallback.
	export async function getNonAcquiredLookup(tmpactor) {
		var tmpindex = await loadSkillIndex();
		return buildNonAcquiredLookup(tmpactor, tmpindex);
	}

	// The same, from an index already read -- for a caller that has one, and for the previews.
	export function buildNonAcquiredLookup(tmpactor, tmpindex) {
		var tmpsystem = tmpactor?.system ?? {};
		var tmpheld = (tmpactor?.items ?? []).filter(tmpitem => tmpitem.type == "skill").map(tmpitem => tmpitem.name);
		var tmpnonacquired = getNonAcquiredSkillNames(tmpsystem.identity?.classProgression, tmpsystem.identity?.title);
		var tmpbyname = new Map((tmpindex ?? []).map(tmpentry => [tmpentry.name, tmpentry]));

		var tmplookup = function (tmpname) {
			var tmpentry = tmpbyname.get(tmpname);
			if (!tmpentry) { return null; }
			var tmpanswer = canUseNonAcquired({ name: tmpentry.name, ...(tmpentry.system ?? {}) }, tmpheld, tmpnonacquired);
			var tmpchance = tmpanswer.usable && typeof tmpsystem.getCommonSkillChance == "function"
				? tmpsystem.getCommonSkillChance(tmpentry.system?.attr1, tmpentry.system?.attr2, tmpentry.system?.skillRating)
				: 0;
			return { chance: tmpchance, footing: tmpanswer.usable ? tmpanswer.footing : "", reason: tmpanswer.reason, entry: tmpentry };
		};
		// The two lists the untrained dialog offers, from the same reading.
		tmplookup.groups = function () { return getUntrainedSkillGroups(tmpheld, tmpindex, tmpnonacquired); };
		tmplookup.nonAcquiredNames = tmpnonacquired;
		return tmplookup;
	}

// @MARKER ADD NEW non-acquired functions HERE
// @END (CODE)
