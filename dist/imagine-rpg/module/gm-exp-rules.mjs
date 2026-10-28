// @START (CODE)
// @MARKER GM EXPERIENCE TOOLS RULES
//==================================================================================================================
// What a Game Master does with a character or creature the table is going to KILL: value it in
// experience, and split that among the people who earned it. His Character Sheet Config tab's "Calc/Show
// Experience Value" and "Split Experience" (HTML 57300-57370), for GMCs and GMEs; the window is
// module/apps/gm-tools.mjs, what it shows is module/gm-tools-view.mjs.
//
// THE VALUE reuses the creature side's valuation outright -- calcCreatureExp (creature-gen-rules.mjs),
// his Master's Manual p.181 table -- because his character handler (handleCalcExp, sheet-worker.js:
// 72337-72580) is the same arithmetic with the character's own figures put in for the creature's:
//
//     level        the character's TITLE (getLevelExp(tmpTitle))
//     attributes   the twelve attribute scores as they stand
//     endurance    the Endurance characteristic
//     resistances  the five NUMERIC resistances (an immunity is skipped)
//     skills       class and racial skills held above the row's chance; social skills are not counted
//                  (his getSkillExp asks getRaceClassSkillDetails, which answers only for those)
//     powers       each Additional Power's level (its spell's or invocation's) times the row's figure
//     the ticks    his Experience Bonuses, each a share of the base experience for the level
//     hide         over 29, (hide - 20) / 10, at least 1, times the base
//     immunities   a fifth of the base each -- his racial immunities, counted off the race (his
//                  getRacialFeatureAbilities(...)[2]). Unlike the creature side's, a character with
//                  none is valued as having none: his split of an empty text gives one only where he
//                  reads a creature's list (UPSTREAM 120), not here.
//
// THE SPLIT is handleSplitExp (72668) exactly: the amount times the difficulty, whole numbers, divided
// among the people; the remainder is what is left over.
//==================================================================================================================

import { calcCreatureExp, readPoisonType } from "./creature-gen-rules.mjs";
import { EXP_SPECIALS } from "./creature-gen-tables.mjs";

	// His Difficulty select (HTML 57358), in his order, each with its multiplier. His labels are kept as
	// printed -- "Difficult" appears twice (60% and 80%), which is his.
	//                          factor   label
	export const EXP_DIFFICULTIES = [
		[ 0.1,  "10% (Fled/Can Return)" ],
		[ 0.2,  "20% (Pushover)"        ],
		[ 0.3,  "30% (Very Easy)"       ],
		[ 0.4,  "40% (Easy)"            ],
		[ 0.5,  "50% (Average)"         ],
		[ 0.6,  "60% (Difficult)"       ],
		[ 0.7,  "70% (Hard)"            ],
		[ 0.8,  "80% (Difficult)"       ],
		[ 0.9,  "90% (Very Difficult)"  ],
		[ 1,    "100% (Maximum)"        ]
	];

	// His poison types, I to XXV (the Poison Type select).
	export const POISON_TYPES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV",
		"XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV"];

	// The ticks of the Experience Bonuses, in the order of his panel. The shares are the creature
	// table's own (EXP_SPECIALS); the labels here are his character panel's.
	//                           key              his label
	export const EXP_BONUS_TICKS = [
		[ "slaying",        "Slaying?"                         ],
		[ "characterClass", "Character Class? (GMCs)"          ],
		[ "caster",         "Caster/Invoker?"                  ],
		[ "damageTouch",    "Damaging Touch?"                  ],
		[ "drainTouch",     "Draining Touch?"                  ],
		[ "breath",         "Breath Weapon?"                   ],
		[ "convert",        "Convert Victim?"                  ],
		[ "gaze",           "Gaze Attack?"                     ],
		[ "chameleon",      "Chameleon?"                       ],
		[ "mindControl",    "Mind Control?"                    ],
		[ "invisibility",   "Invisibility?"                    ]
	];

	// This is the function which gives the figures a character's experience value is worked from, out of an
	// actor-shaped object: { system, items }. tmppowerLevels is what the window looked up (the level of each
	// power's spell or invocation, 0 where neither is found), since that needs the compendia.
	export function getCharacterExpInputs(tmpactor, tmppowerLevels) {
		var tmpsystem = tmpactor?.system ?? {};
		var tmpratings = {};
		for (const [tmpkey, tmpattr] of Object.entries(tmpsystem.attributes ?? {})) { tmpratings[tmpkey] = parseInt(tmpattr?.value) || 0; }

		var tmpresistances = {};
		for (const [tmpkey, tmptrack] of Object.entries(tmpsystem.resistances ?? {})) {
			tmpresistances[tmpkey] = { value: parseInt(tmptrack?.value) || 0, immune: !!tmptrack?.immune };
		}

		// Skills held at a chance. Social skills are not counted (his class/race-only test).
		var tmpskills = [];
		for (const tmpitem of tmpactor?.items ?? []) {
			if (tmpitem.type != "skill") { continue; }
			var tmpchance = parseInt(tmpitem.system?.totalChance) || 0;
			if (tmpchance > 0) { tmpskills.push({ chance: tmpchance, counted: tmpitem.system?.category != "social" }); }
		}

		var tmpbonuses = tmpsystem.gmExp ?? {};
		var tmpspecials = {};
		for (const tmpkey of Object.keys(EXP_SPECIALS)) { tmpspecials[tmpkey] = !!tmpbonuses[tmpkey]; }

		return {
			level: parseInt(tmpsystem.identity?.title) || 0,
			ratings: tmpratings,
			endurance: parseInt(tmpsystem.characteristics?.endurance?.value) || 0,
			resistances: tmpresistances,
			skills: tmpskills,
			powerLevels: tmppowerLevels ?? [],
			specials: tmpspecials,
			poisonType: readPoisonType(tmpbonuses.poisonType),
			hide: parseInt(tmpsystem.body?.hide) || 0,
			immunityCount: (tmpsystem.identity?.race?.immunities ?? []).length
		};
	}

	// This is the function which values the character: his handleCalcExp. Returns { total, parts, row }
	// as calcCreatureExp does.
	export function calcCharacterExp(tmpactor, tmppowerLevels) {
		return calcCreatureExp(getCharacterExpInputs(tmpactor, tmppowerLevels));
	}

	// This is the function which splits experience among a party -- his handleSplitExp (72668). The
	// amount is first scaled by the difficulty and cut to a whole number; nothing to split or nobody to
	// give it to is zero for each and zero left over. Returns { total, perPerson, remainder }.
	export function splitExperience(tmpamount, tmppeople, tmpdifficulty) {
		var tmpexp = parseInt(tmpamount) || 0;
		var tmpnumber = parseInt(tmppeople) || 0;
		var tmpfactor = parseFloat(tmpdifficulty) || 1;
		if (tmpexp > 0 && tmpnumber > 0) {
			var tmptotal = Math.trunc(tmpexp * tmpfactor) || 0;
			return { total: tmptotal, perPerson: Math.trunc(tmptotal / tmpnumber) || 0, remainder: Math.trunc(tmptotal % tmpnumber) || 0 };
		}
		return { total: 0, perPerson: 0, remainder: 0 };
	}

// @MARKER ADD NEW gm experience rule functions HERE
// @END (CODE)
