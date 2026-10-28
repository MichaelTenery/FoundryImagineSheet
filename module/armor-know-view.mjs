// @START (CODE)
// @MARKER ARMOR KNOWLEDGE VIEW
//==================================================================================================================
// What the Armor Knowledge / Armor Lore window shows, worked out without Foundry so the test can render the same
// template against the same view -- the arrangement brawling-view.mjs keeps.
//
// His two panels are the same shape (armor_know_acquired / armor_lore_acquired, HTML 51000-51075): the set worn,
// the slots, the sets learned, a ROLL and a MOD button. Before them, one of two refusals -- "does not ever
// acquire" and "has not acquired" -- which replace the panel altogether.
//==================================================================================================================

import { ARMOR_KNOWLEDGE, ARMOR_LORE, parseConfigList, isConfigLearned, getConfigSlots,
         describeArmorPanel } from "./armor-know-rules.mjs";

	// This is the function which builds everything the window renders for ONE of the two skills.
	//
	//   tmpkind = "know" | "lore"
	//   tmpo = {
	//       characterName, className
	//       wornNames          the set worn (getEquippedArmorSet)
	//       list               the learned sets, his string
	//       panel              "never" | "notYet" | "ok"  (getArmorSkillPanel)
	//       practitionerTitle  the title the slots are counted from
	//       chance             the skill's chance
	//       canRemove          true when the user may forget a learned set (the Game Master or the owner)
	//       isCreature         true on a creature, which has his "Automatic" tick
	//       automatic          that tick's state, for this skill
	//   }
	export function buildArmorKnowView(tmpkind, tmpo) {
		var tmpO = tmpo ?? {};
		var tmpSkill = tmpkind == "lore" ? ARMOR_LORE : ARMOR_KNOWLEDGE;
		var tmpSets = parseConfigList(tmpO.list);
		var tmpWorn = tmpO.wornNames ?? [];
		var tmpPanel = tmpO.panel ?? "never";
		return {
			kind: tmpkind,
			isLore: tmpkind == "lore",
			skillName: tmpSkill,
			heading: `${tmpSkill.toUpperCase()} CONFIGURATION SELECTION:`,
			panel: tmpPanel,
			refusal: describeArmorPanel(tmpPanel, tmpSkill, tmpO.characterName ?? "", tmpO.className ?? ""),
			acquired: tmpPanel == "ok",
			// "Arm Bracer(Plate), Gauntlets(Chain), ..." as his span shows it.
			wornText: tmpWorn.join(", "),
			hasWorn: tmpWorn.length > 0,
			slots: getConfigSlots(tmpO.practitionerTitle, tmpO.list),
			chance: parseInt(tmpO.chance) || 0,
			// Each learned set with its place in the list, which the Remove button names (removeConfig).
			sets: tmpSets.map((tmpSet, tmpIndex) => ({ index: tmpIndex, pieces: tmpSet.join(", ") })),
			canRemove: !!tmpO.canRemove,
			isCreature: !!tmpO.isCreature,
			automatic: !!tmpO.automatic,
			// His span: sets joined with "|" between pieces, shown as they are stored.
			setsText: tmpSets.map(tmpSet => tmpSet.join("|")).join(","),
			hasSets: tmpSets.length > 0,
			wornLearned: isConfigLearned(tmpWorn, tmpO.list),
			rollNote: tmpkind == "lore"
				? "click here to roll Armor Lore for equipped configuration to remove all armor penalties."
				: "click here to roll Armor Knowledge for equipped configuration to lower armor penalties.",
			modNote: "click here for mod roll (add +20% for 1-3 minor changes, if previous critical success, +5% per 2 points of armor magic +, etc.)"
		};
	}

// @MARKER ADD NEW armor knowledge view functions HERE
// @END (CODE)
