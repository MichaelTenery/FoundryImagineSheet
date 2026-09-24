// @START (CODE)
// @MARKER CHARACTER GENERATOR VIEW
//==================================================================================================================
// What each step of the character generator shows, worked out from the generator's state and the
// content. No Foundry dependency: the generator window (module/apps/character-generator.mjs) and
// the preview harness (tools/chargen-preview.html) both call buildGeneratorView, so the preview
// renders exactly what the window would rather than a hand-kept copy of it.
//
// The state is plain data, one field per choice. The steps, in his order where his sheet has one:
//     0 Basics      name, character type, physique           (his step 9 name, PG step 2-3)
//     1 Race        one race, or a Half Race of two          (his step 1)
//     2 Attributes  roll or enter, adjust, Civilized Human   (his step 2)
//     3 Class       class or path, qualification             (his step 5)
//     4 Skills      class, racial and social                 (his step 6)
//     5 Details     handedness, age, looks, languages,       (his steps 3, 4, 7, 8)
//                   alignment, money
//     6 Review      everything, and Create
//==================================================================================================================

import { ATTRIBUTE_TABLES } from "./config-tables.mjs";
import { combineHalfRace, isClassBlockedForRaces, applySlightPhysique, resolvePhysiqueLock,
	readFormlessPair, combineFormless } from "./race-rules.mjs";
import { applyFamorianEvokes, checkEvokeBudget } from "./famorian-rules.mjs";
import { buildStartingKit } from "./starting-kit.mjs";
import { getStartingFortune, rollStartingMoney, describeStartingMoney,
	GEAR_INSTEAD_OF_COINS_RACES, FAIRY_COIN_RACES, FAIRY_COIN_NOTE } from "./starting-money.mjs";
import {
	ATTRIBUTE_ORDER, CHARACTER_TYPES, buildRatings, checkFinalAttributes, getCivilizedHumanAllowance,
	checkClassQualification, getStartingClassSkills, assembleCharacter
} from "./chargen-rules.mjs";

	export const STEPS = ["Basics", "Race", "Attributes", "Class", "Skills", "Details", "Review"];

	// The clothing styles his setClothing tests for, in the order it tests them.
	export const CLOTHING_STYLES = ["western", "renaissance", "eastern", "african", "kilted"];

	// This is the function which lists the colours a race is found in, for one of the three
	// features. A Half Race is offered both parents' lists, with anything on both shown once.
	// "Other" is always last, so a player who wants a colour his tables do not list can still
	// type one -- which is what his own sheet allows, the lists being a prompt rather than a rule.
	export function colourChoices(tmpRaceDocs, tmpWhich, tmpChosen) {
		var tmpAll = [];
		for (const tmpRace of tmpRaceDocs ?? []) {
			for (const tmpColour of tmpRace?.system?.features?.[tmpWhich] ?? []) {
				if (!tmpAll.includes(tmpColour)) { tmpAll.push(tmpColour); }
			}
		}
		var tmpOptions = tmpAll.map(tmpColour =>
			({ value: tmpColour, label: tmpColour, selected: tmpColour == tmpChosen }));
		// Something typed that is not on the list keeps its place at the top rather than vanishing.
		if (tmpChosen && !tmpAll.includes(tmpChosen)) {
			tmpOptions.unshift({ value: tmpChosen, label: tmpChosen + " (typed)", selected: true });
		}
		return tmpOptions;
	}

	const ATTRIBUTE_LABELS = {
		str: "Strength", agl: "Agility", vit: "Vitality", int: "Intelligence", wis: "Wisdom", knw: "Knowledge",
		app: "Appearance", chm: "Charm", soc: "Social Class", aur: "Aura", pty: "Piety", wil: "Will Force"
	};

	// This is the function which gives a fresh generator its starting state.
	export function newGeneratorState() {
		return {
			step: 0,
			name: "", gender: "", slightPhysique: false, charType: "adventurer",
			race1: "", race2: "",
			rolled: null, manual: false, manualBase: {},
			swaps: [], humanBonuses: ["", "", ""], humanMoves: [],
			className: "", override: false, chosenAttackSkill: "Beginner",
			racialSkillNames: [], socialSkillNames: [],
			handedness: "", age: 0, heightFeet: 0, heightInches: 0, weight: 0,
			// @MARKER FAMORIAN
			// Empty except for a Famorian, the same shape as system.physical.famorian -- see
			// module/data/actor-character.mjs -- so choicesFromState passes it straight through.
			famorian: { breed: "", animalType: "", evokesAllowed: 0, evokes: [],
			            strBonus: 0, aglBonus: 0, vitBonus: 0 },
			// What the last height/frame/weight roll said, kept so the Details step can show it.
			physiqueSummary: "", physiqueIssues: [],
			frame: "", hair: "", eyes: "", skin: "",
			alignment: "", languages: [], wealth: { copper: 0, silver: 0, gold: 0, platinum: 0 },
			// @MARKER STARTING MONEY
			// The last starting-money roll, whole -- see module/starting-money.mjs and
			// rollStartingMoneyIfDue below. Null until the Details step first rolls it.
			startingMoney: null,
			// @MARKER STARTING KIT
			// His three optional ways of giving a new character its kit, each its own tick and all
			// three off unless asked for -- see module/starting-kit.mjs. The style only matters to
			// the clothing, and only for the races whose wardrobe varies by it.
			startingKit: { byCulture: false, byStatus: false, bySkills: false },
			clothingStyle: "western",
			// @MARKER STARTING LORE
			// His last creation step's "Provide random lore for starting spells, all relevant skills,
			// and related consumables" (attr_do_random_lore) -- see module/starting-lore.mjs. ON here,
			// where his sheet leaves it off: the port had no way to give a character its lore at all,
			// which is what was reported, and "If unchecked GM can provide after generation" is still
			// true -- the Magic & Lore tab has the Game Master's button. DECISIONS.md 2026-09-22.
			randomLore: true
		};
	}

	// This is the function which works out everything that follows from the choices so far --
	// the race, the ratings, the final attributes, the class and its qualification, the slots --
	// so each step's view and the Next checks read one consistent picture.
	export function deriveGenerator(tmpState, tmpContent, tmpIsAvailable) {
		var tmpAvail = tmpIsAvailable ?? (() => true);
		var tmpFind = (tmpDocs, tmpName) => (tmpDocs ?? []).find(tmpDoc => tmpDoc.name == tmpName) ?? null;

		var tmpRace1 = tmpFind(tmpContent.races, tmpState.race1);
		var tmpRace2 = tmpState.race2 ? tmpFind(tmpContent.races, tmpState.race2) : null;
		var tmpRaceNames = [tmpRace1?.name, tmpRace2?.name].filter(tmpName => tmpName);
		// HIS name for each race, which is what the height and frame tables are keyed by. A split
		// form -- Fairy(Winged), Maginos(Clay) -- is a name of the port's own, and his getRaceHeightType
		// has never heard of it; sourceRace is the race it was split from. Every other race gives
		// back its own name, so this is the same list for all but the twelve.
		// A FORMLESS IS DROPPED FROM THIS LIST, because a psyche has no height: his own
		// getRaceHeightType answers "N/A" for it (35626). The host's body is what is measured, so
		// leaving the Formless in would average a real height against nothing.
		var tmpRaceSourceNames = [tmpRace1, tmpRace2]
			.filter(tmpDoc => tmpDoc && !tmpDoc.system?.formless)
			.map(tmpDoc => tmpDoc.system?.sourceRace || tmpDoc.name);

		// @MARKER RACE FORMS
		// A winged race is always of slight physique and a wingless one never is, so where the race
		// says which, the tick is not the player's to set and its value comes from here instead.
		var tmpPhysique = resolvePhysiqueLock([tmpRace1?.system, tmpRace2?.system]);
		var tmpIsSlight = tmpPhysique.locked ? tmpPhysique.value : tmpState.slightPhysique;

		// The slight-physique form is chosen BEFORE the two halves are combined, so a half race
		// gets the right form of each parent rather than the ordinary form of both.
		var tmpSystem1 = tmpRace1 ? applySlightPhysique(tmpRace1.system, tmpIsSlight) : null;
		var tmpSystem2 = tmpRace2 ? applySlightPhysique(tmpRace2.system, tmpIsSlight) : null;

		// @MARKER FAMORIAN
		// A Famorian's race is BUILT out of the evokes it has taken, exactly as the character
		// model builds it once the actor exists (module/data/actor-character.mjs
		// _getEffectiveRace) -- so the ratings shown while generating are the ratings the
		// finished character actually has, not a preview of a different calculation.
		var tmpIsFamorian = !!tmpRace1?.system?.famorian?.isFamorian;
		if (tmpIsFamorian) {
			var tmpFamState = tmpState.famorian ?? {};
			tmpSystem1 = applyFamorianEvokes(tmpSystem1, tmpFamState.evokes ?? [], {
				str: tmpFamState.strBonus ?? 0, agl: tmpFamState.aglBonus ?? 0, vit: tmpFamState.vitBonus ?? 0
			});
		}

		// @MARKER FORMLESS
		// A Formless is NOT half of a Half Race -- his own code says so outright ("formless can't
		// be half races", 34003). The two races a Formless character holds are a psyche and the
		// body it wears, and they are combined by taking each half whole rather than by averaging.
		var tmpFormless = readFormlessPair([tmpSystem1, tmpSystem2], tmpRaceNames);
		var tmpRace = null;
		if (tmpFormless.isFormless) {
			tmpRace = tmpFormless.host ? combineFormless(tmpFormless.psyche, tmpFormless.host)
				: tmpFormless.psyche;
		} else if (tmpSystem1) {
			tmpRace = tmpSystem2 ? combineHalfRace(tmpSystem1, tmpSystem2) : tmpSystem1;
		}

		var tmpType = CHARACTER_TYPES[tmpState.charType] ?? CHARACTER_TYPES.adventurer;
		var tmpBase = tmpState.manual ? tmpState.manualBase : (tmpState.rolled?.best ?? null);
		var tmpHasBase = !!tmpBase && ATTRIBUTE_ORDER.every(tmpKey => (parseInt(tmpBase[tmpKey]) || 0) > 0);
		var tmpNumericBase = {};
		for (const tmpKey of ATTRIBUTE_ORDER) { tmpNumericBase[tmpKey] = parseInt(tmpBase?.[tmpKey]) || 0; }

		var tmpHuman = getCivilizedHumanAllowance(tmpRaceNames);
		var tmpBuilt = buildRatings({
			base: tmpNumericBase, slightPhysique: tmpIsSlight, ratio: tmpType.ratio,
			swaps: tmpState.swaps,
			humanBonuses: tmpState.humanBonuses.slice(0, tmpHuman.bonus),
			humanMoves: tmpState.humanMoves.slice(0, tmpHuman.moves)
		});
		var tmpFinals = checkFinalAttributes(tmpBuilt.ratings, tmpRace);

		var tmpClass = tmpFind(tmpContent.classes, tmpState.className);
		var tmpBlocked = tmpClass ? isClassBlockedForRaces(tmpClass.system.blockedRaces, tmpRaceNames) : false;
		var tmpClassIssues = tmpClass ? checkClassQualification(tmpClass.system, tmpFinals, tmpRaceNames, tmpBlocked) : [];
		var tmpCannotCast = (tmpRace?.disabilities ?? []).includes("Cannot Cast Spells");
		var tmpNonClassed = !!tmpClass?.system?.nonClassed;
		var tmpClassSkills = (tmpClass && !tmpNonClassed) ? getStartingClassSkills(tmpClass.system, tmpCannotCast) : [];

		// Skill slots are Knowledge's, as the character itself reads them (ATTRIBUTE_TABLES.knw).
		var tmpKnwRow = ATTRIBUTE_TABLES.knw[Math.max(0, Math.min(30, tmpFinals.knw.final))] ?? {};

		// @MARKER STARTING FORTUNE
		// The Fortune the starting money is rolled against: his whole FORTUNE calculation on the day
		// the character is made, race and class and first title included (getStartingFortune).
		var tmpFortune = getStartingFortune(tmpFinals.aur.final, tmpFinals.pty.final, tmpFinals.wil.final,
			tmpRace?.characteristicMods?.fortune, tmpClass?.system?.classMods, tmpNonClassed);

		return {
			race1: tmpRace1, race2: tmpRace2, raceNames: tmpRaceNames, race: tmpRace,
			raceSourceNames: tmpRaceSourceNames, physique: tmpPhysique, slightPhysique: tmpIsSlight,
			formless: tmpFormless,
			type: tmpType, hasBase: tmpHasBase, ratings: tmpBuilt.ratings, ratingIssues: tmpBuilt.issues,
			finals: tmpFinals, human: tmpHuman,
			klass: tmpClass, blocked: tmpBlocked, classIssues: tmpClassIssues, cannotCast: tmpCannotCast,
			nonClassed: tmpNonClassed, classSkills: tmpClassSkills, fortune: tmpFortune,
			slots: {
				class: parseInt(tmpKnwRow.classSkills) || 0,
				racial: parseInt(tmpKnwRow.raceSkills) || 0,
				social: parseInt(tmpKnwRow.socialSkills) || 0
			},
			intRow: ATTRIBUTE_TABLES.int[Math.max(0, Math.min(30, tmpFinals.int.final))] ?? {},
			available: tmpAvail
		};
	}

	// This is the function which says whether the current step is finished well enough to go on,
	// and if not, why. Rules the player may knowingly break (an unqualified class with the
	// override ticked) do not block; missing essentials do.
	export function checkStep(tmpState, tmpDerived) {
		switch (STEPS[tmpState.step]) {
			case "Race":
				if (!tmpDerived.race1) { return "Choose a race."; }
				return "";
			case "Attributes":
				if (!tmpDerived.hasBase) { return "Roll the attributes, or enter all twelve."; }
				return "";
			case "Class":
				if (!tmpDerived.klass) { return "Choose a class."; }
				if (tmpDerived.classIssues.length && !tmpState.override) {
					return "This character does not qualify. Tick the override to take the class anyway.";
				}
				return "";
			case "Skills":
				if (tmpState.racialSkillNames.length > tmpDerived.slots.racial) {
					return `Only ${tmpDerived.slots.racial} racial skills are allowed; ${tmpState.racialSkillNames.length} are chosen.`;
				}
				if (tmpState.socialSkillNames.length > tmpDerived.slots.social) {
					return `Only ${tmpDerived.slots.social} social skills are allowed; ${tmpState.socialSkillNames.length} are chosen.`;
				}
				return "";
		}
		return "";
	}

	// This is the function which builds everything the template renders.
	export function buildGeneratorView(tmpState, tmpContent, tmpIsAvailable) {
		var tmpD = deriveGenerator(tmpState, tmpContent, tmpIsAvailable);
		var tmpStepName = STEPS[tmpState.step];
		var tmpOption = (tmpValue, tmpLabel, tmpSelected, tmpExtra) => ({ value: tmpValue, label: tmpLabel,
			selected: tmpValue == tmpSelected, ...(tmpExtra ?? {}) });
		var tmpAttrOptions = (tmpSelected, tmpWithSoc) => [tmpOption("", "--", tmpSelected)]
			.concat(ATTRIBUTE_ORDER.filter(tmpKey => tmpWithSoc || tmpKey != "soc")
			.map(tmpKey => tmpOption(tmpKey, tmpKey.toUpperCase(), tmpSelected)));

		var tmpView = {
			state: tmpState,
			steps: STEPS.map((tmpName, tmpIndex) => ({ name: tmpName, index: tmpIndex,
				current: tmpIndex == tmpState.step, done: tmpIndex < tmpState.step })),
			stepName: tmpStepName,
			isFirst: tmpState.step == 0,
			isLast: tmpState.step == STEPS.length - 1,
			blocker: checkStep(tmpState, tmpD),
			["is" + tmpStepName]: true
		};

		// @MARKER BASICS
		// The tick is on this step and the race is chosen on the next, so a player may tick it and
		// then choose a race that decides it for them. The DERIVED value is what the character is
		// built from either way; coming back here shows the tick locked and says what locked it.
		tmpView.slightPhysique = tmpD.slightPhysique;
		tmpView.physiqueLocked = tmpD.physique.locked;
		tmpView.physiqueConflict = tmpD.physique.conflict;
		tmpView.physiqueReason = tmpD.physique.reason;
		tmpView.charTypes = Object.entries(CHARACTER_TYPES).map(([tmpKey, tmpDef]) => tmpOption(tmpKey,
			`${tmpDef.label} -- ${tmpDef.sets == 1 ? "one roll" : tmpDef.sets + " rolls, best kept"}, ${tmpDef.ratio}:1`
			+ (tmpDef.fromBook ? " (Player's Guide; not on his sheet)" : ""), tmpState.charType));

		// @MARKER RACE
		var tmpRaces = (tmpContent.races ?? []).filter(tmpDoc => tmpD.available(tmpDoc))
			.sort((a, b) => a.name.localeCompare(b.name));
		tmpView.race1Options = [tmpOption("", "-- choose --", tmpState.race1)]
			.concat(tmpRaces.map(tmpDoc => tmpOption(tmpDoc.name, tmpDoc.name, tmpState.race1)));
		// His Half Race picker offers only the first race's fertile partners (racefertiledict) --
		// EXCEPT for a Formless, whose second race is not a mate but a body, and whose choices are
		// therefore its host list rather than its (empty) fertility list.
		var tmpIsFormless = !!tmpD.race1?.system?.formless;
		var tmpSecond = tmpIsFormless
			? (tmpD.race1?.system?.formlessHosts ?? [])
			: (tmpD.race1?.system?.fertileWith ?? []);
		tmpView.race2Options = [tmpOption("", tmpIsFormless ? "-- choose a host --" : "-- one race only --", tmpState.race2)]
			.concat(tmpRaces.filter(tmpDoc => tmpSecond.includes(tmpDoc.name))
			.map(tmpDoc => tmpOption(tmpDoc.name, tmpDoc.name, tmpState.race2)));
		tmpView.canBeHalf = tmpSecond.length > 0;
		tmpView.isFormless = tmpIsFormless;
		tmpView.formlessIssue = tmpD.formless?.issue ?? "";
		tmpView.raceName = tmpD.raceNames.join("|");
		tmpView.race = tmpD.race;

		// @MARKER FAMORIAN
		// A picker for the breed, animal type and evokes, shown only when the chosen race is one.
		// The window rolls the breed and the three attribute bonuses (@MARKER FAMORIAN in
		// character-generator.mjs); everything here is display and the budget arithmetic.
		var tmpIsFamorianRace = !!tmpD.race1?.system?.famorian?.isFamorian;
		tmpView.isFamorian = tmpIsFamorianRace;
		if (tmpIsFamorianRace) {
			var tmpFamSys = tmpD.race1.system.famorian;
			var tmpFamPicked = tmpState.famorian ?? {};
			tmpView.famorianBreedOptions = tmpFamSys.breeds.map(tmpBreed =>
				tmpOption(tmpBreed.breed, `${tmpBreed.breed} (${tmpBreed.evokes} evoke${tmpBreed.evokes == "1" ? "" : "s"})`,
					tmpFamPicked.breed));
			tmpView.famorianBreed = tmpFamPicked.breed;
			// -1 is the stored form of his "All" (a True Breed); 0 means not rolled yet.
			var tmpAllowed = tmpFamPicked.evokesAllowed < 0 ? null : (tmpFamPicked.evokesAllowed || null);
			var tmpBudget = checkEvokeBudget(tmpFamPicked.evokes ?? [], tmpAllowed);
			tmpView.famorianBudget = {
				used: tmpBudget.used,
				allowedLabel: tmpFamPicked.evokesAllowed < 0 ? "All" : (tmpFamPicked.evokesAllowed || "?"),
				issue: tmpBudget.issue
			};
			// Alphabetical by label, so a player looking for a name can find it; the fifteen that
			// change a number are flagged so they read differently from the ~105 that are only
			// colour, without being separated into a second list a player has to check twice.
			tmpView.famorianEvokes = [...tmpFamSys.evokes]
				.map(tmpEvoke => ({ ...tmpEvoke, checked: (tmpFamPicked.evokes ?? []).includes(tmpEvoke.key) }))
				.sort((a, b) => a.label.localeCompare(b.label));
		}

		// @MARKER ATTRIBUTES
		tmpView.typeLabel = tmpD.type.label;
		tmpView.ratio = tmpD.type.ratio;
		tmpView.rolledSets = tmpState.rolled?.sets?.length ?? 0;
		tmpView.attributes = ATTRIBUTE_ORDER.map(tmpKey => {
			var tmpFinal = tmpD.finals[tmpKey];
			return {
				key: tmpKey, label: ATTRIBUTE_LABELS[tmpKey],
				rolls: (tmpState.rolled?.sets ?? []).map(tmpSet => tmpSet[tmpKey]),
				manual: tmpState.manualBase?.[tmpKey] ?? "",
				base: tmpState.manual ? (parseInt(tmpState.manualBase?.[tmpKey]) || 0) : (tmpState.rolled?.best?.[tmpKey] ?? ""),
				rating: tmpD.ratings[tmpKey],
				raceMod: parseInt(tmpD.race?.attributeMods?.[tmpKey]) || 0,
				final: tmpFinal.final, limit: tmpFinal.limit,
				overLimit: tmpFinal.overLimit, underMinimum: tmpFinal.underMinimum
			};
		});
		tmpView.swaps = tmpState.swaps.map((tmpSwap, tmpIndex) => ({
			index: tmpIndex,
			toOptions: tmpAttrOptions(tmpSwap.to, false),
			from: Array.from({ length: tmpD.type.ratio }, (_, tmpN) => ({ n: tmpN,
				options: tmpAttrOptions((tmpSwap.from ?? [])[tmpN], false) }))
		}));
		tmpView.ratingIssues = tmpD.ratingIssues;
		tmpView.human = tmpD.human;
		tmpView.humanBonuses = Array.from({ length: tmpD.human.bonus }, (_, tmpN) => ({ n: tmpN,
			options: tmpAttrOptions(tmpState.humanBonuses[tmpN], false) }));
		tmpView.humanMoves = Array.from({ length: tmpD.human.moves }, (_, tmpN) => ({ n: tmpN,
			fromOptions: tmpAttrOptions(tmpState.humanMoves[tmpN]?.from, false),
			toOptions: tmpAttrOptions(tmpState.humanMoves[tmpN]?.to, false) }));

		// @MARKER CLASS
		// Every class the campaign allows is offered, and each one that this character cannot take
		// SAYS SO IN ITS OWN LABEL rather than only after it has been picked.
		//
		// This list used to be bare names. Picking one and being told "This character does not
		// qualify" was the only way to find out, so a player had to walk the dropdown one entry at
		// a time -- and for a character with a low attribute that is most of the list. Daryl
		// reported it on 2026-09-20 as "cannot select any class but GME", which is exactly what it
		// looks like from the outside: GME is the one class with no attribute requirement at all,
		// so on a Nixie -- Strength capped at 11 by its race, against the 13, 14 or 15 that 28
		// classes ask for -- it can be the only name that does not refuse.
		//
		// Nothing is hidden and nothing is disabled. The requirement is a rule the player may
		// knowingly break with the override tick, so the entry stays selectable and the label
		// carries the reason; hiding them would silently shrink a list the Game Master expects to
		// be complete, and would make the override unreachable for the very classes it is for.
		var tmpClasses = (tmpContent.classes ?? []).filter(tmpDoc => tmpD.available(tmpDoc))
			.sort((a, b) => a.name.localeCompare(b.name));
		var tmpQualifiedCount = 0;
		tmpView.classOptions = [tmpOption("", "-- choose --", tmpState.className)]
			.concat(tmpClasses.map(tmpDoc => {
				var tmpDocBlocked = isClassBlockedForRaces(tmpDoc.system.blockedRaces, tmpD.raceNames);
				var tmpDocIssues = tmpD.hasBase
					? checkClassQualification(tmpDoc.system, tmpD.finals, tmpD.raceNames, false) : [];
				if (!tmpDocIssues.length && !tmpDocBlocked) { tmpQualifiedCount += 1; }

				// "Needs STR 13; has 6." is the right sentence once a class has been chosen and
				// there is room to explain. In a dropdown it has to fit beside ninety-nine others,
				// so the shortfalls collapse to "needs STR 13, INT 15".
				var tmpWhy = [];
				if (tmpDocIssues.length) {
					tmpWhy.push("needs " + tmpDocIssues
						.map(tmpIssue => (tmpIssue.match(/Needs (\w+ \d+)/) ?? [])[1])
						.filter(tmpShort => tmpShort).join(", "));
				}
				if (tmpDocBlocked) { tmpWhy.push("not usual for this race"); }
				return tmpOption(tmpDoc.name,
					tmpDoc.name + (tmpWhy.length ? " — " + tmpWhy.join("; ") : ""),
					tmpState.className, { qualified: !tmpDocIssues.length && !tmpDocBlocked });
			}));
		tmpView.classQualifiedCount = tmpQualifiedCount;
		tmpView.classOfferedCount = tmpClasses.length;
		tmpView.klass = tmpD.klass ? {
			name: tmpD.klass.name, classType: tmpD.klass.system.classType,
			alignment: tmpD.klass.system.requirements?.alignment ?? "",
			focus: tmpD.klass.system.requirements?.focusAttributes ?? "",
			attackSkillList: tmpD.klass.system.attackSkillList,
			description: tmpD.klass.system.description,
			classMods: (tmpD.klass.system.classMods ?? []).join("; ")
		} : null;
		tmpView.classIssues = tmpD.classIssues;
		tmpView.nonClassed = tmpD.nonClassed;
		tmpView.attackSkillOptions = ["Beginner", "Novice", "Intermediate", "Advanced", "Expert", "Master"]
			.map(tmpSkill => tmpOption(tmpSkill, tmpSkill, tmpState.chosenAttackSkill));

		// @MARKER SKILLS
		tmpView.slots = tmpD.slots;
		tmpView.classSkills = tmpD.classSkills;
		tmpView.cannotCast = tmpD.cannotCast;
		// A GME may take any racial skill (UPSTREAM-ISSUES.md item 22, his words), so its list is
		// every race's; anyone else chooses from their own race's -- a Half Race's is both.
		var tmpRacialList = tmpD.nonClassed
			? [...new Map((tmpContent.races ?? []).flatMap(tmpDoc => tmpDoc.system.racialSkills ?? [])
				.map(tmpSkill => [tmpSkill.name, tmpSkill])).values()]
			: (tmpD.race?.racialSkills ?? []);
		tmpView.racialSkills = tmpRacialList.map(tmpSkill => ({ name: tmpSkill.name, bonus: tmpSkill.bonus,
			checked: tmpState.racialSkillNames.includes(tmpSkill.name) }))
			.sort((a, b) => a.name.localeCompare(b.name));
		tmpView.socialSkills = (tmpContent.skills ?? [])
			.filter(tmpDoc => tmpDoc.system?.category == "social" && tmpD.available(tmpDoc))
			.map(tmpDoc => ({ name: tmpDoc.name, checked: tmpState.socialSkillNames.includes(tmpDoc.name) }))
			.sort((a, b) => a.name.localeCompare(b.name));
		tmpView.racialChosen = tmpState.racialSkillNames.length;
		tmpView.socialChosen = tmpState.socialSkillNames.length;

		// @MARKER DETAILS
		tmpView.handednessOptions = ["", "Right", "Left", "Ambidextrous"]
			.map(tmpValue => tmpOption(tmpValue, tmpValue || "-- roll or choose --", tmpState.handedness));

		// @MARKER STARTING KIT
		// The styles his clothing tables actually carry, and a preview of what the ticked rules
		// would bring. The preview is built with a FIXED die rather than a random one: it is there to
		// show the shape of the kit before the character is made, and a list that reshuffled itself on
		// every keystroke would be worse than none. The real kit is rolled once, at creation.
		tmpView.clothingStyles = CLOTHING_STYLES.map(tmpStyle =>
			tmpOption(tmpStyle, tmpStyle.charAt(0).toUpperCase() + tmpStyle.slice(1), tmpState.clothingStyle));
		tmpView.startingKitPreview = [];
		var tmpWanted = tmpState.startingKit ?? {};
		if (tmpD.race1 && (tmpWanted.byCulture || tmpWanted.byStatus || tmpWanted.bySkills)) {
			var tmpPreview = buildStartingKit({
				raceName: tmpD.raceNames[0] ?? "", social: getKitSocialClass(tmpState, tmpD),
				gender: tmpState.gender, style: tmpState.clothingStyle,
				socialSkillNames: tmpState.socialSkillNames,
				byCulture: !!tmpWanted.byCulture, byStatus: !!tmpWanted.byStatus, bySkills: !!tmpWanted.bySkills
			}, () => 1);
			tmpView.startingKitPreview = tmpPreview.items.map(tmpEntry =>
				tmpEntry.count > 1 ? `${tmpEntry.name} ×${tmpEntry.count}` : tmpEntry.name);
		}
		// @MARKER STARTING MONEY
		// "Gear by culture" is taken INSTEAD of coins, so while it is ticked the coin fields are not
		// shown at all -- a field that would silently be ignored at creation is worse than none. What
		// was rolled is kept, and comes back if the tick is taken off again, as his override_no_coins
		// keeps money already there (sheet-worker.js:6816).
		tmpView.moneyByCulture = !!tmpWanted.byCulture;
		tmpView.startingMoney = tmpState.startingMoney
			? { summary: describeStartingMoney(tmpState.startingMoney) } : null;
		// His name for the first race (a split form reads its sourceRace), for his two race hints.
		var tmpMoneyRace = tmpD.race1 ? (tmpD.race1.system?.sourceRace || tmpD.race1.name) : "";
		tmpView.moneyGearRace = GEAR_INSTEAD_OF_COINS_RACES.includes(tmpMoneyRace) ? tmpMoneyRace : "";
		tmpView.moneyFairyNote = FAIRY_COIN_RACES.includes(tmpMoneyRace) ? FAIRY_COIN_NOTE : "";
		tmpView.ages = tmpD.race?.ages ?? null;
		// @MARKER COLOURING
		// The colours a member of this race is found in. Offered as choices with anything already
		// typed kept alongside: his sheet lists them and still lets a player write their own, and
		// a Half Race is offered both parents' lists.
		tmpView.hairChoices = colourChoices([tmpD.race1, tmpD.race2], "hair", tmpState.hair);
		tmpView.eyesChoices = colourChoices([tmpD.race1, tmpD.race2], "eyes", tmpState.eyes);
		tmpView.skinChoices = colourChoices([tmpD.race1, tmpD.race2], "skin", tmpState.skin);
		// What the last physique roll said, for the line under the fields.
		tmpView.physique = tmpState.physiqueSummary ? { summary: tmpState.physiqueSummary } : null;
		tmpView.languageAllowance = { spoken: tmpD.intRow.spokenLanguages ?? 0, written: tmpD.intRow.writtenLanguages ?? 0 };
		tmpView.languages = [0, 1, 2, 3, 4, 5].map(tmpN => ({ n: tmpN, name: tmpState.languages[tmpN]?.name ?? "",
			write: !!tmpState.languages[tmpN]?.write }));

		// @MARKER REVIEW
		// The same FIXED die as the kit preview above, and for the same reason -- so the Review list
		// is the kit the Details step just showed. It must be a 1 and never a 0: every rule takes its
		// dice as 1..sides (chargen-rules.mjs), and a 0 chose the kit alternative BEFORE the first,
		// which is nothing. That threw on every redraw and left the window stuck on Details for any
		// race whose culture kit offers a choice at its social class.
		if (tmpStepName == "Review") {
			var tmpAssembled = assembleCharacter(choicesFromState(tmpState, tmpD), tmpContent, () => 1);
			tmpView.review = {
				items: tmpAssembled.items.map(tmpItem => ({ name: tmpItem.name, type: tmpItem.type,
					category: tmpItem.system.category ?? "" })),
				issues: [...tmpD.ratingIssues, ...tmpD.classIssues.map(tmpIssue => "Class: " + tmpIssue), ...tmpAssembled.issues],
				title: tmpAssembled.actor.system.identity.title,
				// What the character's purse will hold, richest coin first: "40 pp, 3 gp", or nothing.
				money: [["platinum", "pp"], ["gold", "gp"], ["silver", "sp"], ["copper", "cp"]]
					.filter(([tmpCoin]) => tmpAssembled.actor.system.wealth[tmpCoin])
					.map(([tmpCoin, tmpAbbrev]) => `${tmpAssembled.actor.system.wealth[tmpCoin]} ${tmpAbbrev}`).join(", ")
			};
		}
		return tmpView;
	}

	// This is the function which turns the generator's state into the choices assembleCharacter
	// takes. Kept here, beside the view, so the window and the preview make identical characters.
	export function choicesFromState(tmpState, tmpDerived) {
		return {
			// The DERIVED physique, not the ticked one: a winged race sets it for the character.
			name: tmpState.name, gender: tmpState.gender, slightPhysique: tmpDerived.slightPhysique,
			raceNames: tmpDerived.raceNames, className: tmpState.className,
			ratings: tmpDerived.ratings,
			classSkills: tmpDerived.classSkills,
			racialSkillNames: tmpState.racialSkillNames, socialSkillNames: tmpState.socialSkillNames,
			chosenAttackSkill: tmpState.chosenAttackSkill,
			handedness: tmpState.handedness, age: tmpState.age, famorian: tmpState.famorian,
			heightFeet: tmpState.heightFeet, heightInches: tmpState.heightInches, weight: tmpState.weight,
			frame: tmpState.frame, hair: tmpState.hair, eyes: tmpState.eyes, skin: tmpState.skin,
			alignment: tmpState.alignment, languages: tmpState.languages,
			// No coins with Gear by culture: the kit is his wilderness equipment, taken INSTEAD.
			wealth: tmpState.startingKit?.byCulture ? { copper: 0, silver: 0, gold: 0, platinum: 0 } : tmpState.wealth,
			startingKit: tmpState.startingKit, clothingStyle: tmpState.clothingStyle,
			socialClass: getKitSocialClass(tmpState, tmpDerived),
			maxAge: tmpDerived.race?.ages?.maxAge ?? ""
		};
	}

	// @MARKER STARTING MONEY
	// This is the function which says whether the starting money needs rolling now.
	//
	// His sheet rolls it by itself, once, when the racial features are confirmed (sheet-worker.js:6439)
	// -- nobody presses a button for it. The port rolls it the first time the Details step is drawn,
	// which is the first point at which everything it reads is known: the Social Class and the three
	// mystical attributes from the Attributes step, and the class, whose "+5% Fortune" and first title
	// are part of the Fortune it is rolled against.
	//
	// It is due:
	//     - on the Details step, with a race, attributes and a class chosen,
	//     - when "Gear by culture" is NOT ticked -- that kit is taken instead of coins, and his sheet
	//       rolls coins only on the coins side of the switch (override_no_coins, 6798), and
	//     - when there is no roll yet, OR the roll there is was made for a different Social Class or
	//       a different Fortune -- the player went back and changed the character, and money rolled
	//       for a peasant is not a noble's. His sheet does the same: confirming the features again
	//       clears the money and rolls it afresh (clearMoneyEquipmentValues, 6438).
	//
	// There is deliberately no re-roll button, for the reason handedness has none: a button that
	// re-rolls until the multiplier comes up x10 is the same as choosing it. The coin fields stay
	// editable, because the book says the Game Master "may alter the resources available to
	// starting characters as she sees fit" (p.207), and the roll goes to chat, so what was rolled is
	// on the record whatever the fields say afterwards.
	export function startingMoneyIsDue(tmpState, tmpDerived) {
		if (STEPS[tmpState.step] != "Details") { return false; }
		if (!tmpDerived.race1 || !tmpDerived.hasBase || !tmpDerived.klass) { return false; }
		if (tmpState.startingKit?.byCulture) { return false; }
		var tmpLast = tmpState.startingMoney;
		if (!tmpLast) { return true; }
		return tmpLast.realSocialClass != (tmpDerived.finals?.soc?.final ?? 0) || tmpLast.fortune != tmpDerived.fortune;
	}

	// This is the function which rolls the starting money if it is due, and puts it on the choices:
	// the whole roll in startingMoney, and the coins in the four wealth fields. Returns the roll, or
	// null when nothing was rolled, so the window knows whether there is anything to post to chat.
	export function rollStartingMoneyIfDue(tmpState, tmpDerived, tmpRoll) {
		if (!startingMoneyIsDue(tmpState, tmpDerived)) { return null; }
		var tmpMoney = rollStartingMoney(tmpDerived.finals?.soc?.final ?? 0, tmpDerived.fortune, tmpRoll);
		tmpState.startingMoney = tmpMoney;
		tmpState.wealth = { copper: tmpMoney.copper, silver: tmpMoney.silver, gold: tmpMoney.gold, platinum: tmpMoney.platinum };
		return tmpMoney;
	}

	// This is the function which gives the Social Class the starting kit is worked out from.
	//
	// A class below 5 or above 20 has no standing in the mortal realms, and an apparent one is rolled
	// in its place -- by the money AND by the kit (module/starting-kit.mjs @MARKER APPARENT SOCIAL
	// CLASS). Rolled twice, the same character could look like a slave to its purse and a noble to its
	// tailor. So once the money has rolled one, the kit is handed that one; buildStartingKit then finds
	// a class already between 5 and 20 and rolls nothing further. Only while the money roll still
	// belongs to this character's real class, which startingMoneyIsDue keeps true on the Details step.
	export function getKitSocialClass(tmpState, tmpDerived) {
		var tmpSocial = tmpDerived.finals?.soc?.final ?? 0;
		var tmpMoney = tmpState.startingMoney;
		if (tmpMoney?.apparent && tmpMoney.realSocialClass == tmpSocial) { return tmpMoney.socialClass; }
		return tmpSocial;
	}

// @MARKER ADD NEW character generator view functions HERE
// @END (CODE)
