// @START (CODE)
// @MARKER RANDOMS VIEW
//==================================================================================================================
// What the Randoms/Extras window shows: his twenty panels in his order, each with the box it reads (if any),
// its ROLL or GET button, and the answer. Needs no Foundry, so the test renders the same template
// against the same view and the two cannot drift apart.
//
// A section's  roll(tmpdie, tmpinput)  gives the text his handler wrote into the answer box. The input is
// what the panel's own box held: the dice string and its maximum tick, the encounter chance, the
// alignment, the Aura level.
//==================================================================================================================

import { rollDiceTool, rollEncounter, getRandomDirection, getReflectionResult, rollInsanityTool,
         getRandomAnimal, getRandomSubstance, getRandomElement, getRandomPlane, getRandomSubject,
         getRandomSkill, getRandomSocialSkill, getRandomRace, getRandomClass, getRandomAlignment,
         getAuraColor, getRandomChaosEffect, getRandomSpell, rollSpellByLevelTool } from "./random-rules.mjs";
import { ENCOUNTER_CHANCES, DEFAULT_ENCOUNTER_CHANCE, AURA_COLORS } from "./random-tables.mjs";

// @MARKER THE PANELS
// His order on the creature sheet (HTML 92560-92700). "input" names the kind of box the panel reads,
// "wide" is for a long answer (his full-width box).
//      Key          Title                 Button  Caption                          Answer label   Input      Wide
export const RANDOM_SECTIONS = [
	[ "dice",       "Dice",                "ROLL", "Roll dice",                     "Dice Result", "dice",    false ],
	[ "encounter",  "Random Encounter",    "ROLL", "Roll for encounter",            "Encounter?",  "chance",  false ],
	[ "direction",  "Random Direction",    "ROLL", "Roll for random direction",     "Direction?",  "",        false ],
	[ "reflection", "Double Reflection",   "ROLL", "Roll for double reflection result", "Result?",  "",        true  ],
	[ "insanity",   "Random Insanity",     "ROLL", "Roll for random insanity (and duration)", "Insanity?", "", true  ],
	[ "animal",     "Random Animal",       "ROLL", "Roll for random animal",        "Animal?",     "",        false ],
	[ "substance",  "Random Substance",    "ROLL", "Roll for random substance",     "Substance?",  "",        false ],
	[ "element",    "Random Element",      "ROLL", "Roll for random element",       "Element?",    "",        false ],
	[ "plane",      "Random Plane",        "ROLL", "Roll for random plane",         "Plane?",      "",        false ],
	[ "subject",    "Random Subject",      "ROLL", "Roll for random subject",       "Subject?",    "",        false ],
	[ "skill",      "Random Skill",        "ROLL", "Roll for random skill",         "Skill?",      "",        false ],
	[ "socialskill","Random Social Skill", "ROLL", "Roll for random social skill",  "Social Skill?", "",      false ],
	[ "race",       "Random Race",         "ROLL", "Roll for random race",          "Race?",       "",        false ],
	[ "class",      "Random Class",        "ROLL", "Roll for random class",         "Class?",      "",        false ],
	[ "align",      "Random Alignment",    "ROLL", "Roll for random alignment",     "Alignment?",  "",        false ],
	[ "aura",       "Alignment Color",     "GET",  "Get Aura color",                "Aura Color?", "align",   false ],
	[ "chaos",      "Magic Chaos Effect",  "ROLL", "Roll magic chaos effect",       "Chaos Effect?", "",      true  ],
	[ "spell",      "Random Spell (1-20)", "ROLL", "Roll random spell (1-20)",      "Spell?",      "",        false ],
	[ "spelllevel", "Random Spell (by level)", "ROLL", "Roll random spell (by Aura level)", "Spell?", "level", false ]
];

// This is the function which does what a panel's button does: the text for its answer box. A dice
// string that is not one gives 0, as his box shows.
export const RANDOM_ROLLERS = {
	dice:        (tmpdie, tmpin) => "" + rollDiceTool(tmpin?.dice ?? "", !!tmpin?.max, tmpdie),
	encounter:   (tmpdie, tmpin) => rollEncounter(tmpin?.chance ?? DEFAULT_ENCOUNTER_CHANCE, tmpdie),
	direction:   (tmpdie) => getRandomDirection(tmpdie),
	reflection:  (tmpdie) => getReflectionResult(tmpdie),
	insanity:    (tmpdie) => rollInsanityTool(tmpdie),
	animal:      (tmpdie) => getRandomAnimal(tmpdie),
	substance:   (tmpdie) => getRandomSubstance(tmpdie),
	element:     (tmpdie) => getRandomElement(tmpdie),
	plane:       (tmpdie) => getRandomPlane(tmpdie),
	subject:     (tmpdie) => getRandomSubject(tmpdie),
	skill:       (tmpdie) => getRandomSkill(tmpdie),
	socialskill: (tmpdie) => getRandomSocialSkill(tmpdie),
	race:        (tmpdie) => getRandomRace(tmpdie),
	class:       (tmpdie) => getRandomClass(tmpdie),
	align:       (tmpdie) => getRandomAlignment(tmpdie),
	aura:        (tmpdie, tmpin) => getAuraColor(tmpin?.align ?? "", tmpdie),
	chaos:       (tmpdie) => getRandomChaosEffect(tmpdie),
	spell:       (tmpdie) => getRandomSpell(tmpdie),
	spelllevel:  (tmpdie, tmpin) => rollSpellByLevelTool(tmpin?.level ?? "", tmpdie)
};

// This is the function which builds the window's context. tmpresults is { key: text } of what has been
// rolled, tmpworking the panels' own boxes { dice, max, chance, align, level }.
export function buildRandomsView(tmpresults = {}, tmpworking = {}) {
	var tmpchance = parseInt(tmpworking.chance) || DEFAULT_ENCOUNTER_CHANCE;
	return {
		sections: RANDOM_SECTIONS.map(tmprow => ({
			key: tmprow[0], title: tmprow[1], button: tmprow[2], caption: tmprow[3], answerLabel: tmprow[4],
			isDice: tmprow[5] == "dice", isChance: tmprow[5] == "chance",
			isAlign: tmprow[5] == "align", isLevel: tmprow[5] == "level",
			wide: tmprow[6], result: tmpresults[tmprow[0]] ?? ""
		})),
		dice: tmpworking.dice ?? "", max: !!tmpworking.max, level: tmpworking.level ?? "",
		chances: ENCOUNTER_CHANCES.map(tmprow => ({ value: tmprow[0], label: tmprow[1], selected: tmprow[0] == tmpchance })),
		aligns: [ "", ...Object.keys(AURA_COLORS) ].map(tmpname => ({ value: tmpname, label: tmpname,
			selected: tmpname == (tmpworking.align ?? "") }))
	};
}
// @END (CODE)
