// @START (CODE)
// @MARKER ARMOR KNOWLEDGE AND LORE RULES
//==================================================================================================================
// Armor Knowledge and Armor Lore: learn an ARMOUR CONFIGURATION -- the set of pieces worn together -- and
// wearing exactly that set stops the armour costing you as much. Knowledge lowers each penalty by levels;
// Lore removes them all. No Foundry and no dice here: the roll arrives as an argument, so every rule is
// testable with known dice (the practice of combat-rules.mjs and lore-rules.mjs). The window is
// module/apps/armor-knowledge.mjs, what it shows is module/armor-know-view.mjs, and the penalties it eases are
// totalled in actor-character.mjs (_prepareArmorSkills).
//
// Ported from his Updater options "Select Armor Know. Config." and "Select Armor Lore Config.":
//     handleArmorKnowRoll / handleArmorLoreRoll         sheet-worker.js:89279, 89424   the roll that learns a set
//     setArmorKnowSheet / setArmorLoreSheet             sheet-worker.js:50441, 50476   which of his three panels
//     setArmorKnowUpdateValues / ...LoreUpdateValues    sheet-worker.js:118385, 118419 the slots
//     checkEquippedArmorSetAgainstArmorKnowSets / Lore  sheet-worker.js:118487, 118513 "already learned?"
//     setArmorKnowModifiers / setArmorLoreModifiers     sheet-worker.js:118539, 118608 what a learned set does
//
// HOW HIS SHEET KEEPS IT: armor_know_list and armor_lore_list are one string each. The pieces of ONE set are
// joined with "|" and the sets with ",": "Arm Bracer(Plate)|Gauntlets(Chain),Headgear(Chain)|Leggings(Chain)".
// The port keeps the same two strings on combat.armorKnowList / combat.armorLoreList.
//
// A SET IS NAMED BY WHAT IS WORN: every piece of armour on the character's body, EXCLUDING shields and
// clothing -- his `!tempWornName.includes("Shield") && type != "Clothing"` (89330, and in every sibling).
//==================================================================================================================

	// The two skills, as the compendium names them.
	export const ARMOR_KNOWLEDGE = "Armor Knowledge";
	export const ARMOR_LORE      = "Armor Lore";

	// What each is worked from when the character does not hold it but may still try it as a common skill
	// (module/non-acquired.mjs). The compendium's own figures for Armor Knowledge: STR/AGL, rating 14.
	// Armor Lore is NEVER tried unheld -- the report asks for it ("cannot be used until acquired").
	//
	//                         attr1  attr2  rating
	export const ARMOR_KNOWLEDGE_BASE = { attr1: "STR", attr2: "AGL", rating: 14 };

	// @MARKER THE SET
	// This is the function which names the set worn: the names of the armour items worn, shields and clothing
	// left out, in the order given. Takes anything with { name, system: { isShield, flexibility } }.
	export function getEquippedArmorSet(tmpWornItems) {
		var tmpNames = [];
		for (const tmpItem of tmpWornItems ?? []) {
			if (tmpItem?.system?.isShield) { continue; }
			if (tmpItem?.system?.flexibility == "Clothing") { continue; }
			if (tmpItem?.name) { tmpNames.push(tmpItem.name); }
		}
		return tmpNames;
	}

	// This is the function which reads one of his list strings into sets of piece names.
	//     "A|B,C|D" -> [["A","B"],["C","D"]]
	export function parseConfigList(tmpList) {
		var tmpText = ("" + (tmpList ?? "")).trim();
		if (tmpText == "" || tmpText == "undefined") { return []; }
		return tmpText.split(",").map(tmpSet => tmpSet.split("|").map(tmpPiece => tmpPiece.trim()).filter(tmpPiece => tmpPiece != ""))
		              .filter(tmpSet => tmpSet.length > 0);
	}

	// This is the function which writes sets back as his string.
	export function formatConfigList(tmpSets) {
		return (tmpSets ?? []).map(tmpSet => tmpSet.join("|")).join(",");
	}

	// This is the function which says whether the set worn is already learned. His check: ANY learned set that
	// has every piece worn in it -- so a learned set larger than the one worn still covers it. Nothing worn
	// is never "learned" (his empty-array test).
	//
	// THE ONE DEPARTURE: he looks each worn piece up with String.includes inside the learned set's text, so
	// "Headgear(Chain)" would also be found inside a set that only held "Headgear(Chain Mail)". Here a piece
	// must equal a piece of the set. Recorded in DECISIONS.
	export function isConfigLearned(tmpWornNames, tmpList) {
		if (!tmpWornNames?.length) { return false; }
		for (const tmpSet of parseConfigList(tmpList)) {
			if (tmpWornNames.every(tmpPiece => tmpSet.includes(tmpPiece))) { return true; }
		}
		return false;
	}

	// This is the function which adds the set worn to a list, as the ones he joins with "|" and ",".
	export function addConfig(tmpList, tmpWornNames) {
		var tmpSets = parseConfigList(tmpList);
		tmpSets.push([...tmpWornNames]);
		return formatConfigList(tmpSets);
	}

	// @MARKER SLOTS
	// This is the function which counts the open slots: the practitioner title less the sets already learned
	// (his tempSlotsOpen = practitionerTitle - set count, 89334). A slot is one set.
	export function getConfigSlots(tmpPractitionerTitle, tmpList) {
		var tmpTitle = parseInt(tmpPractitionerTitle) || 0;
		return tmpTitle - parseConfigList(tmpList).length;
	}

	// @MARKER WHICH PANEL
	// This is the function which says which of his three panels a character gets for one of the skills --
	// setArmorKnowSheet / setArmorLoreSheet (50441, 50476), whose three messages are "Not found",
	// "Not acquired" and "Found":
	//
	//     "never"   the class never acquires it         armor_know_willnot_acquire
	//     "notYet"  the class acquires it at a later    armor_know_not_acquired
	//               title than the character has reached
	//     "ok"      acquired                            armor_know_acquired
	//
	//   tmpStanding   a getSkillStanding answer (lore-rules.mjs), given the common footing as its fallback for
	//                 Armor Knowledge only
	//   tmpIsLore     true for Armor Lore, which is never tried unheld
	//
	// A skill held and reached is "ok". Held but not reached is "notYet". Not held: Armor Knowledge on a common
	// or non-acquired footing is "ok" at the base chance -- the report: "Armor Knowledge can [be used]" -- and
	// anything else is "never". Armor Lore unheld is "notYet" when the class gives it later (the
	// non-acquired list names it) and "never" otherwise; the caller passes that in as tmpLoreComesLater.
	export function getArmorSkillPanel(tmpStanding, tmpIsLore, tmpLoreComesLater) {
		if (tmpStanding?.held) { return tmpStanding.reached ? "ok" : "notYet"; }
		if (tmpIsLore) { return tmpLoreComesLater ? "notYet" : "never"; }
		if (tmpStanding?.footing == "common" || tmpStanding?.footing == "nonAcquired") { return "ok"; }
		return "never";
	}

	// His three messages, worded as his panels word them.
	export function describeArmorPanel(tmpPanel, tmpSkillName, tmpCharacterName, tmpClassName) {
		var tmpLore = tmpSkillName == ARMOR_LORE;
		var tmpEffect = tmpLore ? "remove penalties for" : "lower penalties for";
		if (tmpPanel == "never") {
			return `${tmpCharacterName}'s class (${tmpClassName}) does not ever acquire ${tmpSkillName}. Cannot select armor configuration to ${tmpEffect}.`;
		}
		if (tmpPanel == "notYet") {
			return `${tmpCharacterName} has not acquired ${tmpSkillName}. Cannot select armor configuration to ${tmpEffect}, yet.`;
		}
		return "";
	}

	// @MARKER THE ROLL
	// This is the function which settles a roll to learn the set worn -- handleArmorKnowRoll and
	// handleArmorLoreRoll. His order of refusals, which it keeps:
	//     does not have the skill            "... and cannot learn armor configurations. Nothing done."
	//     set already learned                "... has already learned this armor configuration ... Nothing done."
	//     no open slot                       "... has no open ... slots. Nothing done."
	// then the roll: a d100 that does not exceed the chance plus the MOD button's modifier passes (89341).
	// There is no natural-100 rule and no cap here -- his armor roll has neither, and neither is added.
	//
	//   tmpInput = { held, alreadyLearned, slotsOpen, chance, modifier, automatic }
	//   returns { outcome, roll, total }  outcome: "noSkill" | "alreadyLearned" | "noSlots" |
	//                                     "automatic" | "success" | "failure"
	export function resolveArmorConfigRoll(tmpInput, tmpRollValue) {
		var tmpTotal = (parseInt(tmpInput.chance) || 0) + (parseInt(tmpInput.modifier) || 0);
		if (!tmpInput.held) { return { outcome: "noSkill", roll: null, total: tmpTotal }; }
		if (tmpInput.alreadyLearned) { return { outcome: "alreadyLearned", roll: null, total: tmpTotal }; }
		if (!(tmpInput.slotsOpen >= 1)) { return { outcome: "noSlots", roll: null, total: tmpTotal }; }
		if (tmpInput.automatic) { return { outcome: "automatic", roll: null, total: tmpTotal }; }
		var tmpRoll = parseInt(tmpRollValue) || 0;
		return { outcome: tmpRoll > tmpTotal ? "failure" : "success", roll: tmpRoll, total: tmpTotal };
	}

	// This is the function which words the result as his chat lines do.
	export function describeArmorConfigRoll(tmpResult, tmpSkillName, tmpCharacterName) {
		var tmpKnow = tmpSkillName == ARMOR_KNOWLEDGE;
		switch (tmpResult.outcome) {
			case "noSkill":
				return `${tmpCharacterName} does not have ${tmpSkillName} and cannot learn armor configurations. Nothing done.`;
			case "alreadyLearned":
				return `${tmpCharacterName} has already learned this armor configuration with ${tmpSkillName}. Nothing done.`;
			case "noSlots":
				return `${tmpCharacterName} has no open ${tmpSkillName} slots. Nothing done.`;
			case "automatic":
				return `${tmpCharacterName} is using override automatic choice. Armor set is now ${tmpKnow ? "Armor Know'ed" : "Armor Lored"}. Succeeded? = true`;
			default:
				return `${tmpCharacterName} attempted to learn this armor configuration with ${tmpSkillName}. Rolled a ${tmpResult.roll}% against a ${tmpResult.total}% chance. Succeeded? = ${tmpResult.outcome == "success"}`;
		}
	}

	// @MARKER WHAT A LEARNED SET DOES
	// His penalty levels for Armor Knowledge (118565): parseInt(chance / 25) || 1 -- a 25% chance is one level,
	// 50% two, and a chance under 25 still one (the || 1). Each level is 5 on the skills penalty and 1 on
	// each of defence, initiative and speed.
	export function getKnowledgeLevels(tmpChance) {
		return (parseInt((parseInt(tmpChance) || 0) / 25)) || 1;
	}

	// This is the function which eases the penalties of worn armour. His setArmorKnowModifiers and
	// setArmorLoreModifiers (118539-118640), on the TOTALS:
	//
	//     Armor Knowledge  skills +5 per level, defence / initiative / speed -1 per level, each only as far
	//                      as its own penalty goes (his "if (... > 0) { ... = 0 }" clamps)
	//     Armor Lore       every penalty is 0 -- and it runs second in his code, so it overrides Knowledge
	//
	// Penalty signs are the port's: skills is NEGATIVE, the other three POSITIVE (item-armor.mjs, and
	// _prepareCombat's own comment).
	//
	//   tmpRaw = { skills, defense, initiative, speed }   the worn armour's totals
	//   tmpOn  = { know, knowChance, lore }               a learned set is worn, and Knowledge's chance
	//   returns { skills, defense, initiative, speed, levels, source }  source "none" | "knowledge" | "lore"
	export function applyArmorSkills(tmpRaw, tmpOn) {
		var tmpSkills    = parseInt(tmpRaw?.skills) || 0;
		var tmpDefense   = parseInt(tmpRaw?.defense) || 0;
		var tmpInitiative = parseInt(tmpRaw?.initiative) || 0;
		var tmpSpeed     = parseInt(tmpRaw?.speed) || 0;
		if (tmpOn?.lore) {
			return { skills: 0, defense: 0, initiative: 0, speed: 0, levels: 0, source: "lore" };
		}
		if (!tmpOn?.know) {
			return { skills: tmpSkills, defense: tmpDefense, initiative: tmpInitiative, speed: tmpSpeed, levels: 0, source: "none" };
		}
		var tmpLevels = getKnowledgeLevels(tmpOn.knowChance);
		return {
			skills:     tmpSkills < 0     ? Math.min(0, tmpSkills + tmpLevels * 5) : tmpSkills,
			defense:    tmpDefense > 0    ? Math.max(0, tmpDefense - tmpLevels)    : tmpDefense,
			initiative: tmpInitiative > 0 ? Math.max(0, tmpInitiative - tmpLevels) : tmpInitiative,
			speed:      tmpSpeed > 0      ? Math.max(0, tmpSpeed - tmpLevels)      : tmpSpeed,
			levels: tmpLevels,
			source: "knowledge"
		};
	}

	// @MARKER FORGETTING A SET
	// This is the function which takes one learned set off a list, by its place in the list (0 first). His
	// sheet has NO way to do this -- the only writes to armor_know_list / armor_lore_list are the two that
	// add a set (sheet-worker.js:89392, 89535), so a set learned by mistake stayed for good. Asked for by
	// the user 2026-10-27; the port's own addition. A place out of range leaves the list as it was.
	export function removeConfig(tmpList, tmpIndex) {
		var tmpSets = parseConfigList(tmpList);
		var tmpAt = parseInt(tmpIndex);
		if (!(tmpAt >= 0 && tmpAt < tmpSets.length)) { return formatConfigList(tmpSets); }
		tmpSets.splice(tmpAt, 1);
		return formatConfigList(tmpSets);
	}

	// @MARKER WHICH SKILLS PAY THE ARMOUR'S SKILL PENALTY
	// His armor_skill_penalty is read by exactly two rolls: Shield Parry (handleShieldParry,
	// sheet-worker.js:70724-70736) and the per-area Body Parry (handleBodyParry, 70972-70979), each adding it
	// to the chance -- "Armor: N%" on the card. No other skill roll in his code reads it (searched
	// 2026-10-27: armor_skill_penalty appears at 70724, 70972, the combat table 82168 and the Know/Lore
	// setters, nowhere else). So it is these two skills' totals that a learned set improves, and only these.
	export const ARMOR_PENALTY_SKILLS = [ "Shield Parry", "Body Parry" ];

	// @MARKER CREATURES
	// This is the function which gives a creature's standing in either skill -- his creature branch of
	// handleArmorKnowRoll / handleArmorLoreRoll (sheet-worker.js:89290-89304, 89436-89449):
	//     the chance is the stat block's "Armor Knowledge NN%" (getCreatureSkillChance, 178815); 0 is "Not found"
	//     the skill is taken at level 1, so the practitioner title -- the slots -- is the creature's level
	//     his "Automatic" tick (attr_automatic_armor_know / _lore, HTML 87800, 87830) makes the roll a success
	//
	// HIS SLIP, KEPT AND FLAGGED: the Lore branch reads "Armor Knowledge" off the stat block too (89438), not
	// "Armor Lore". So a creature listing Armor Knowledge may learn Lore sets, and one listing only Armor Lore
	// may not. Kept as he wrote it; recorded for him in DECISIONS.
	//
	//   tmpKnowChance   the stat block's Armor Knowledge chance (the Lore branch reads the same figure)
	//   tmpLevel        the creature's level
	//   returns { held, reached, chance, practitionerTitle, panel }
	export function getCreatureArmorStanding(tmpKnowChance, tmpLevel) {
		var tmpChance = parseInt(tmpKnowChance) || 0;
		if (tmpChance == 0) {
			return { held: false, reached: false, chance: 0, practitionerTitle: 0, panel: "never" };
		}
		var tmpTitle = parseInt(tmpLevel) || 0;
		return { held: true, reached: true, chance: tmpChance, practitionerTitle: (tmpTitle - 1) + 1, panel: "ok" };
	}

	// This is the function which words the Combat tab's line for his two boxes (armor_know_check /
	// armor_lore_check): what the armour worn now has eased, or "" when neither applies.
	export function describeArmorSkillsLine(tmpKnowOn, tmpLoreOn, tmpLevels) {
		if (tmpLoreOn) { return "Armor Lore: the configuration worn is mastered -- no armour penalties."; }
		if (tmpKnowOn) {
			var tmpL = parseInt(tmpLevels) || 1;
			return `Armor Knowledge: the configuration worn is known -- penalties eased ${tmpL} level${tmpL == 1 ? "" : "s"} (+${tmpL * 5}% skills, -${tmpL} defence, initiative, speed).`;
		}
		return "";
	}

// @MARKER ADD NEW armor knowledge functions HERE
// @END (CODE)
