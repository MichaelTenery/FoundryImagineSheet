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
//     5 Details     handedness, age, looks, languages,       (his steps 3, 4, 7)
//                   alignment
//     6 Equipment   money, starting kit, and the shop        (his step 8, and the book's step 10)
//     7 Review      everything, and Create
//
// The Equipment step was added on 2026-09-23 (docs/sonnet/2026-09-23-equipment-shop.md). The money and the
// starting kit moved there from Details, because the money, the Gear by culture tick (which REPLACES the
// coins) and what the coins buy decide one another and belong on one page -- his own step 8 is "MONEY
// AND EQUIPMENT". Height and weight are rolled on Details, one step earlier, so the load can be shown.
//==================================================================================================================

import { ATTRIBUTE_TABLES } from "./config-tables.mjs";
import { resolveEncumbrance } from "./combat/combat-rules.mjs";
import { buildShopCatalog, priceCart, buildPurchasedEntries, listShopOffers, getOfferPrice, describeOfferPrices,
	describeCoins, describeCartLine, describeValue, getPurseValue, getPriceLevelLabel, PRICE_LEVELS, DEFAULT_PRICE_LEVEL, FREE_LEVEL,
	FREE_LABEL, SHOP_TYPES, SHOP_TYPE_ORDER, describeShopGaps } from "./shop-rules.mjs";
import { combineHalfRace, isClassBlockedForRaces, applySlightPhysique, resolvePhysiqueLock,
	readFormlessPair, combineFormless } from "./race-rules.mjs";
import { applyFamorianEvokes, checkEvokeBudget } from "./famorian-rules.mjs";
import { buildStartingKit } from "./starting-kit.mjs";
import { getStartingFortune, rollStartingMoney, describeStartingMoney,
	GEAR_INSTEAD_OF_COINS_RACES, FAIRY_COIN_RACES, FAIRY_COIN_NOTE } from "./starting-money.mjs";
import { getSocialModRaceName, getSocialSkillRaceMod } from "./social-skill-rules.mjs";
import { getAlignmentChoicesForClasses, buildAlignmentSelectOptions, getAlignmentDescription, getTendencyDescription,
	ALIGNMENT_NOT_APPLICABLE } from "./alignment-rules.mjs";
import { applyClassSkillEdits, countClassSlotsNeeded, getWholeCareerRows, getSwapOutCandidates, getSwapInCandidates,
	checkClassSkillSwaps, describeSwapAdvice, CLASS_SKILL_SWAP_LIMIT } from "./class-rules.mjs";
import { SLOT_TRANSFERS, getSlotAllowance } from "./skills-rules.mjs";
import {
	ATTRIBUTE_ORDER, CHARACTER_TYPES, buildRatings, checkFinalAttributes, getCivilizedHumanAllowance,
	checkClassQualification, getStartingClassSkills, assembleCharacter
} from "./chargen-rules.mjs";

	export const STEPS = ["Basics", "Race", "Attributes", "Class", "Skills", "Details", "Equipment", "Review"];

	// The most offers the shop lists at once -- the item picker's cap. A kind of thing is rarely longer,
	// and a search narrows anything that is.
	export const SHOP_OFFER_LIMIT = 60;

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
			alignment: "", languages: [],
			// @MARKER ALIGNMENT
			// His step 7: the alignment, the tendency (his one combined string, "Moral/Order"), and his
			// Alignmentless tick (tmp_alignmentless, HTML 45267-45268, "GM Discretion"), which writes N/A
			// to both. alignmentFor is the class the two were last checked against -- see
			// reconcileAlignment -- so a new class re-checks them and an unchanged one never does.
			tendencies: "", alignmentless: false, alignmentFor: null,
			// @MARKER SOCIAL SKILLS
			// The Skills step's own override, for the class's Required social skills and its "up to N"
			// (checkStep). Separate from the class-qualification override: a player allowed an
			// unqualified class has not thereby been allowed to skip its Required skills.
			socialOverride: false,
			// @MARKER WHOLE CAREER
			// His Step 6 plan for the whole career (HTML 40148-40153): the rows given up ([{ title, name }],
			// his REMOVE, sheet-worker.js:7675-7736), his two CONVERT buttons as counts -- racial slots
			// given for class slots and social PAIRS given for class slots (7324, 7627) -- and the Game
			// Master's way past "Not enough slots for all Class Skills" (7831), which his sheet has not.
			removedClassSkills: [], slotMoves: { racialToClass: 0, socialToClass: 0 }, classSlotOverride: false,
			// @MARKER CLASS CUSTOMIZATION
			// The Master's Manual's swaps (MM p.55), [{ title, out, in }], at most three -- offered only
			// while the world's "Allow Master's Manual class customization" setting is on.
			classSkillSwaps: [],
			wealth: { copper: 0, silver: 0, gold: 0, platinum: 0 },
			// @MARKER STARTING MONEY
			// The last starting-money roll, whole -- see module/starting-money.mjs and
			// rollStartingMoneyIfDue below. Null until the Equipment step first rolls it.
			startingMoney: null,
			// @MARKER SHOP
			// What is to be bought, in the order it was put on the list: [{ key, count, level }] -- see
			// module/shop-rules.mjs priceCart. Nothing is paid until the character is created; the list
			// is priced afresh against the purse every time it is drawn, so a re-rolled purse or a new
			// price level is always reflected. level is a Game Master's per-line price level ("" for the
			// world's). shop is what the browser is showing: a Type, a kind of it, a search, and the
			// number the next Buy takes -- his "No#".
			purchases: [],
			shop: { type: "Weapon", subtype: "", search: "", count: 1 },
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
	// the race, the ratings, the final attributes, the class and its qualification, the slots, the
	// shopping list priced against the purse -- so each step's view and the Next checks read one
	// consistent picture.
	//
	//   tmpOptions  { priceLevel, isGM } -- the world's price level (the "priceLevel" setting) and
	//               whether a Game Master is at the window. Passed in rather than read from
	//               game.settings, so this module stays Foundry-free; left out, Medium and a player.
	export function deriveGenerator(tmpState, tmpContent, tmpIsAvailable, tmpOptions) {
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

		// @MARKER CLASS CUSTOMIZATION
		// MM p.55's swaps, when the world allows them -- the classCustomization setting, read by the window
		// and passed in (tmpOptions.classCustomization); none passed, none offered, so a caller that knows
		// nothing of the setting gets his sheet, which has no general swap. Swaps made and then switched off
		// are kept in the state but not applied.
		var tmpCustomize = tmpOptions?.classCustomization === true && !!tmpClass && !tmpNonClassed;
		var tmpSwaps = tmpCustomize ? (tmpState.classSkillSwaps ?? []) : [];
		var tmpSwapIssues = tmpCustomize ? checkClassSkillSwaps(tmpClass.system, tmpSwaps, tmpContent.skills, tmpCannotCast,
			tmpState.removedClassSkills ?? []) : [];

		// @MARKER WHOLE CAREER
		// The class as this character will carry it: swaps first, then the rows given up
		// (applyClassSkillEdits, class-rules.mjs). Every figure below reads this edited class, so the
		// first title's skills, the slots needed and the class item written at creation all agree.
		var tmpEditedList = (tmpClass && !tmpNonClassed)
			? applyClassSkillEdits(tmpClass.system, tmpSwaps, tmpState.removedClassSkills ?? []) : null;
		var tmpEditedSystem = tmpEditedList
			? { ...tmpClass.system, advancement: { ...(tmpClass.system?.advancement ?? {}), classSkillList: tmpEditedList } }
			: (tmpClass?.system ?? null);
		var tmpClassSkills = (tmpClass && !tmpNonClassed) ? getStartingClassSkills(tmpEditedSystem, tmpCannotCast) : [];

		// @MARKER ALIGNMENT
		// What the class allows -- module/alignment-rules.mjs, his step-7 dropdowns (HTML 45293-45833) --
		// with the Game Master's custom alignments and tendencies, which the window reads from the
		// customAlignments setting and passes in (tmpOptions.customAlignments); none passed, his alone.
		// The generator makes one class, so this is one class's list; the intersection function is used
		// so a dual class, when the generator has one, needs no change here. No class yet is his full list.
		var tmpCustomAlignments = tmpOptions?.customAlignments ?? null;
		var tmpAlignmentChoices = getAlignmentChoicesForClasses(
			tmpClass ? [tmpClass.system?.requirements?.alignment ?? ""] : [], tmpCustomAlignments);
		var tmpAlignmentAllowed = !tmpState.alignment || tmpAlignmentChoices.alignments.includes(tmpState.alignment);
		var tmpTendencyAllowed = !tmpState.tendencies || tmpAlignmentChoices.tendencies.includes(tmpState.tendencies);

		// @MARKER SOCIAL SKILLS
		// The class's own social-skill list, his setSocialSkillLists (sheet-worker.js:53591-55406) as
		// extracted onto the class document (system.socialSkills, tools/extract/extract_class_social_skills.py).
		// None for a GME (non-classed) or a class whose list is "any" -- Sage and GME, his
		// social_skill_select_none and _special -- which choose from the full list only, as his Step 6 shows.
		var tmpSocialSource = tmpClass?.system?.socialSkills ?? null;
		var tmpClassSocial = {
			required:    (tmpNonClassed || tmpSocialSource?.anyList) ? [] : [...(tmpSocialSource?.required ?? [])],
			recommended: (tmpNonClassed || tmpSocialSource?.anyList) ? [] : [...(tmpSocialSource?.recommended ?? [])],
			upTo:        (tmpSocialSource?.upTo === null || tmpSocialSource?.upTo === undefined || tmpSocialSource?.upTo === "")
				? null : (parseInt(tmpSocialSource.upTo) || 0),
			upToSource:  tmpSocialSource?.upToSource ?? "",
			anyList:     !!tmpSocialSource?.anyList || tmpNonClassed
		};
		// The Required ones this character CAN take: a skill the campaign has switched off, or one the
		// first race is BLOCKED from (his race table), cannot be demanded -- the step refuses a BLOCKED
		// pick outright, so demanding it too would leave no way on but the override.
		var tmpSocialRace = getSocialModRaceName(tmpRace1);
		tmpClassSocial.requiredOpen = tmpClassSocial.required.filter(tmpName =>
			(tmpContent.skills ?? []).some(tmpDoc => tmpDoc.name == tmpName && tmpDoc.system?.category == "social" && tmpAvail(tmpDoc))
			&& !getSocialSkillRaceMod(tmpName, tmpSocialRace).blocked);

		// Skill slots are Knowledge's, as the character itself reads them (ATTRIBUTE_TABLES.knw).
		var tmpKnwRow = ATTRIBUTE_TABLES.knw[Math.max(0, Math.min(30, tmpFinals.knw.final))] ?? {};

		// @MARKER WHOLE CAREER
		// His two CONVERT buttons into class slots, as counts: a racial slot for a class slot (1 for 1,
		// sheet-worker.js:7324 / 52649) and two social slots for a class slot (7627 / 56433) -- the same
		// SLOT_TRANSFERS the Skills tab trades with, so the finished sheet shows the allowance shown here.
		// Held to what Knowledge gives: his buttons need an open slot to convert ("There are no open slots
		// to convert. Nothing done.", 7353), and a slot a pick is filling is refused below by the count.
		var tmpBaseSlots = {
			class:  parseInt(tmpKnwRow.classSkills) || 0,
			racial: parseInt(tmpKnwRow.raceSkills) || 0,
			social: parseInt(tmpKnwRow.socialSkills) || 0
		};
		var tmpMoves = {
			racialToClass: Math.max(0, Math.min(tmpBaseSlots.racial, parseInt(tmpState.slotMoves?.racialToClass) || 0)),
			socialToClass: Math.max(0, Math.min(Math.floor(tmpBaseSlots.social / SLOT_TRANSFERS.socialToClass.cost),
				parseInt(tmpState.slotMoves?.socialToClass) || 0))
		};
		var tmpSlots = getSlotAllowance(tmpBaseSlots, tmpMoves);
		// What the whole career needs, less what was given up (countClassSlotsNeeded: a caster/non-caster
		// pair once, as his getSlotsNeededForClass counts it), against the class slots after converting.
		var tmpClassNeeded = (tmpClass && !tmpNonClassed) ? countClassSlotsNeeded(tmpEditedSystem, tmpCannotCast) : 0;
		var tmpClassShort = Math.max(0, tmpClassNeeded - tmpSlots.class);

		// @MARKER STARTING FORTUNE
		// The Fortune the starting money is rolled against: Aura, Piety and Will Force alone, race and
		// class left out -- the 2026-09-25 ruling, and what his setCoins does (getStartingFortune).
		var tmpFortune = getStartingFortune(tmpFinals.aur.final, tmpFinals.pty.final, tmpFinals.wil.final);

		// @MARKER SHOP
		// The shopping list, priced against the purse in the order it was made -- module/shop-rules.mjs.
		// With Gear by culture ticked nothing is bought: that kit is taken INSTEAD of coins, so there is
		// nothing to pay with. The list itself is kept, and comes back priced if the tick is taken off,
		// the same as the coins do.
		var tmpShopOptions = { priceLevel: tmpOptions?.priceLevel || DEFAULT_PRICE_LEVEL, isGM: !!tmpOptions?.isGM };
		var tmpCatalog = buildShopCatalog(tmpContent, tmpAvail);
		var tmpByCulture = !!tmpState.startingKit?.byCulture;
		var tmpCart = priceCart(tmpByCulture ? {} : tmpState.wealth, tmpByCulture ? [] : (tmpState.purchases ?? []),
			tmpCatalog, tmpShopOptions.priceLevel, tmpShopOptions);

		// @MARKER RACE AND CROSS-SKILL MODIFIERS
		// The race his social-skill table is read for: the FIRST race only, as his race_list1 (17028) --
		// a Half Race's second race neither adds its modifiers nor BLOCKs. See social-skill-rules.mjs.
		var tmpSocialRaceName = getSocialModRaceName(tmpRace1);

		return {
			race1: tmpRace1, race2: tmpRace2, raceNames: tmpRaceNames, race: tmpRace,
			socialRaceName: tmpSocialRaceName,
			raceSourceNames: tmpRaceSourceNames, physique: tmpPhysique, slightPhysique: tmpIsSlight,
			formless: tmpFormless,
			type: tmpType, hasBase: tmpHasBase, ratings: tmpBuilt.ratings, ratingIssues: tmpBuilt.issues,
			finals: tmpFinals, human: tmpHuman,
			klass: tmpClass, blocked: tmpBlocked, classIssues: tmpClassIssues, cannotCast: tmpCannotCast,
			nonClassed: tmpNonClassed, classSkills: tmpClassSkills, fortune: tmpFortune,
			alignmentChoices: tmpAlignmentChoices, alignmentAllowed: tmpAlignmentAllowed, tendencyAllowed: tmpTendencyAllowed,
			customAlignments: tmpCustomAlignments, classSocial: tmpClassSocial,
			slots: tmpSlots, baseSlots: tmpBaseSlots, slotMoves: tmpMoves,
			classSkillList: tmpEditedList, editedClassSystem: tmpEditedSystem,
			classNeeded: tmpClassNeeded, classShort: tmpClassShort,
			customize: tmpCustomize, swaps: tmpSwaps, swapIssues: tmpSwapIssues,
			intRow: ATTRIBUTE_TABLES.int[Math.max(0, Math.min(30, tmpFinals.int.final))] ?? {},
			available: tmpAvail,
			shopOptions: tmpShopOptions, catalog: tmpCatalog, cart: tmpCart,
			purchases: buildPurchasedEntries(tmpCart, tmpCatalog)
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
				// @MARKER CLASS CUSTOMIZATION
				// A swap MM p.55 does not allow is refused outright: it is a rule of the book the player
				// chose to use, and the fix is on the same page. The first problem is named.
				if ((tmpDerived.swapIssues ?? []).length) {
					return tmpDerived.swapIssues[0];
				}
				// @MARKER WHOLE CAREER
				// His REMOVE refuses a CORE skill -- "CORE skills cannot be removed. Nothing done." (7707).
				// The table offers no box on a core row, so this is only for a state made some other way.
				var tmpCoreGone = (tmpState.removedClassSkills ?? []).filter(tmpGone =>
					(tmpDerived.klass?.system?.advancement?.classSkillList ?? []).some(tmpRow => tmpRow.core
						&& tmpRow.name == tmpGone.name && (parseInt(tmpRow.title) || 0) == (parseInt(tmpGone.title) || 0)));
				if (tmpCoreGone.length) {
					return `CORE skills cannot be removed (${tmpCoreGone.map(tmpGone => tmpGone.name).join(", ")}).`;
				}
				// His Step 6 confirm: "Not enough slots for all Class Skills. Remove Class Skills or convert
				// Race or Social slots to Class slots. Nothing done." (7828-7835). His sheet has no way past;
				// the Game Master's override tick is the port's (user's ruling 2026-09-26), as it is for an
				// unqualified class.
				if (tmpDerived.classShort > 0 && !tmpState.classSlotOverride) {
					return `Not enough slots for all Class Skills: the whole career needs ${tmpDerived.classNeeded}, `
						+ `Knowledge gives ${tmpDerived.slots.class}, ${tmpDerived.classShort} short. Remove Class Skills or `
						+ "convert Race or Social slots to Class slots, or tick the override.";
				}
				if (tmpState.racialSkillNames.length > tmpDerived.slots.racial) {
					return `Only ${tmpDerived.slots.racial} racial skills are allowed; ${tmpState.racialSkillNames.length} are chosen.`;
				}
				if (tmpState.socialSkillNames.length > tmpDerived.slots.social) {
					return `Only ${tmpDerived.slots.social} social skills are allowed; ${tmpState.socialSkillNames.length} are chosen.`;
				}
				// His copy button refuses a social skill the race is BLOCKED from: "A skill was selected
				// that this race cannot acquire. Nothing done." (sheet-worker.js:7393, refused at
				// 7420-7427). Refused here the same way, at the point of choice, and the reason names
				// the skill so the player knows which box to untick.
				var tmpBlocked = tmpState.socialSkillNames.filter(tmpName =>
					getSocialSkillRaceMod(tmpName, tmpDerived.socialRaceName ?? "").blocked);
				if (tmpBlocked.length) {
					return `This race cannot acquire ${tmpBlocked.join(", ")}: his race table marks `
						+ `${tmpBlocked.length == 1 ? "it" : "them"} BLOCKED for ${tmpDerived.socialRaceName}. Untick to go on.`;
				}
				// @MARKER SOCIAL SKILLS
				// The class's Required social skills must be taken -- his step 6 confirm (7789-7843), "1 or
				// more Required Social Skills were not selected. Nothing Done." (7841), and PG p.47 "must be
				// learned by a starting character of this class before other social skills can be learned".
				// His check indexes the found flags by j where it means k, and reads three of its five types
				// under names that are never set (7791), so only Required #1 and #3 ever counted; every one
				// counts here. Where Knowledge gives fewer slots than the class has Required skills (KNW 7-10
				// gives one slot, the Hunter has three), the slots are what can be asked for: min(required,
				// slots), user's ruling 2026-09-26, until his slot conversions reach the generator.
				var tmpSocial = tmpDerived.classSocial ?? { requiredOpen: [], required: [], upTo: null };
				var tmpOverride = !!tmpState.socialOverride;
				var tmpRequiredNeeded = Math.min(tmpSocial.requiredOpen.length, tmpDerived.slots.social);
				var tmpRequiredTaken = tmpSocial.requiredOpen.filter(tmpName => tmpState.socialSkillNames.includes(tmpName));
				if (tmpRequiredTaken.length < tmpRequiredNeeded && !tmpOverride) {
					var tmpMissing = tmpSocial.requiredOpen.filter(tmpName => !tmpState.socialSkillNames.includes(tmpName));
					return `1 or more Required Social Skills were not selected: ${tmpMissing.join(", ")}`
						+ (tmpRequiredNeeded < tmpSocial.requiredOpen.length ? ` (${tmpRequiredNeeded} of them, as Knowledge allows)` : "")
						+ ". Tick the override to go on without.";
				}
				// "Up to N" (PG p.47): the class's book count, where a book gives one. The Required skills
				// are not part of it -- the books print "Required: Tumbling. Up to two from the following"
				// (Acrobat, PG p.55) -- and every other social skill is, from the class's list or not:
				// "may choose social skills up to the number listed, but may not choose more until the player
				// has rolled on the additional social skills table". That table (PG p.75) is not in his
				// sheet and is deferred, so going over warns and needs the override (user's ruling
				// 2026-09-26) rather than being impossible. His sheet has no count at all; Knowledge,
				// checked above, still caps everything.
				if (tmpSocial.upTo !== null && tmpSocial.upTo !== undefined) {
					var tmpExtra = tmpState.socialSkillNames.filter(tmpName => !tmpSocial.required.includes(tmpName));
					if (tmpExtra.length > tmpSocial.upTo && !tmpOverride) {
						return `The ${tmpDerived.klass?.name ?? "class"} starts with up to ${tmpSocial.upTo} social skills`
							+ `${tmpSocial.required.length ? " besides its Required ones" : ""}`
							+ `${tmpSocial.upToSource ? " (" + tmpSocial.upToSource + ")" : ""}; ${tmpExtra.length} are chosen. `
							+ "More need a roll on the Additional Social Skills table (PG p.75): tick the override to take them.";
					}
				}
				return "";
			case "Details":
				// @MARKER ALIGNMENT
				// His step 7 confirm (7883-7932): Alignmentless needs nothing; otherwise "Not playing
				// Alignmentless Imagine and The Young Adult needs a world view! No Alignment selected.
				// Nothing done." (7907-7912). His confirm never tested the choice against the class -- his
				// dropdown only offered what the class allows. Here the dropdown offers the same, and a
				// value it does not (kept from before a class change, or typed by an old save) is refused
				// unless the class-qualification override is ticked, the GM's way through (user's ruling
				// 2026-09-26). His confirm never checks the tendency; a blank one is allowed and becomes
				// "None", as his setFinalAlignment writes it (73418-73422).
				if (tmpState.alignmentless) { return ""; }
				if (!tmpState.alignment) {
					return "Not playing Alignmentless Imagine and the young adult needs a world view! No alignment selected.";
				}
				if (!tmpDerived.alignmentAllowed && !tmpState.override) {
					return `The ${tmpDerived.klass?.name ?? "class"} does not allow ${tmpState.alignment} `
						+ `(${tmpDerived.klass?.system?.requirements?.alignment ?? ""}). Choose another, or tick the override.`;
				}
				if (!tmpDerived.tendencyAllowed && !tmpState.override) {
					return `The ${tmpDerived.klass?.name ?? "class"} does not allow the ${tmpState.tendencies} tendency. `
						+ "Choose another, or tick the override.";
				}
				return "";
			case "Equipment":
				// A line that can no longer be paid for -- the purse was re-rolled or changed, or the
				// price level was -- has to be taken off or cut down first: the character cannot leave
				// the shop owing money. Nothing is taken off for the player, who may prefer to drop
				// something else.
				if (tmpDerived.cart?.blocked) {
					return tmpDerived.cart.issues[0] + " Remove it or buy fewer.";
				}
				return "";
		}
		return "";
	}

	// This is the function which builds everything the template renders. tmpOptions is deriveGenerator's.
	export function buildGeneratorView(tmpState, tmpContent, tmpIsAvailable, tmpOptions) {
		var tmpD = deriveGenerator(tmpState, tmpContent, tmpIsAvailable, tmpOptions);
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
		var tmpSecond = getSecondRaceNames(tmpD.race1);
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

		// @MARKER WHOLE CAREER
		// His Step 6 table (HTML 40148-40153, 45245-45254): every title's class skills, CORE marked, a
		// tick box on each non-core row to give it up. A swapped row shows what it replaced and has no
		// box -- a row is swapped or removed, not both. The header is his comparison, needed against
		// Knowledge's class slots, and the two CONVERT controls sit beside it.
		var tmpRemovedKeys = (tmpState.removedClassSkills ?? []).map(tmpGone => (parseInt(tmpGone.title) || 0) + "|" + tmpGone.name);
		tmpView.career = {
			has: !!tmpD.klass && !tmpD.nonClassed,
			rows: (tmpD.klass && !tmpD.nonClassed) ? getWholeCareerRows(tmpD.editedClassSystem, tmpD.cannotCast).map(tmpRow => ({
				...tmpRow,
				key: tmpRow.title + "|" + tmpRow.name,
				removable: !tmpRow.core && !tmpRow.replaces,
				checked: tmpRemovedKeys.includes(tmpRow.title + "|" + tmpRow.name)
			})) : [],
			slots: tmpD.slots.class, baseSlots: tmpD.baseSlots.class, converted: tmpD.slots.class != tmpD.baseSlots.class,
			needed: tmpD.classNeeded, short: tmpD.classShort,
			removedCount: (tmpD.classSkillList ?? []).filter(tmpRow => tmpRow.removed).length,
			racialToClass: tmpD.slotMoves.racialToClass, racialToClassMax: tmpD.baseSlots.racial,
			socialToClass: tmpD.slotMoves.socialToClass,
			socialToClassMax: Math.floor(tmpD.baseSlots.social / SLOT_TRANSFERS.socialToClass.cost),
			showOverride: !!tmpState.classSlotOverride || tmpD.classShort > 0
		};

		// @MARKER CLASS CUSTOMIZATION
		// MM p.55's swap rows, copying the attribute swap rows' Add / trash pattern. "Out" is a row that
		// may leave (getSwapOutCandidates, keyed "title|name"); "In" is what may take its place
		// (getSwapInCandidates). A choice the rules now refuse stays on screen with the reason, rather
		// than vanishing.
		if (tmpD.customize) {
			var tmpOutRows = getSwapOutCandidates(tmpD.klass.system, tmpD.cannotCast, tmpState.removedClassSkills ?? []);
			tmpView.classSwaps = {
				show: true,
				limit: CLASS_SKILL_SWAP_LIMIT,
				canAdd: tmpD.swaps.length < CLASS_SKILL_SWAP_LIMIT,
				issues: tmpD.swapIssues,
				rows: tmpD.swaps.map((tmpSwap, tmpIndex) => {
					var tmpOutKey = tmpSwap.out ? (parseInt(tmpSwap.title) || 0) + "|" + tmpSwap.out : "";
					var tmpOutOptions = [tmpOption("", "-- skill to replace --", tmpOutKey)]
						.concat(tmpOutRows.map(tmpRow => tmpOption(tmpRow.title + "|" + tmpRow.name,
							`${tmpRow.name} (title ${tmpRow.title})`, tmpOutKey)));
					if (tmpOutKey && !tmpOutOptions.some(tmpO => tmpO.value == tmpOutKey)) {
						tmpOutOptions.push(tmpOption(tmpOutKey, `${tmpSwap.out} (title ${tmpSwap.title})`, tmpOutKey));
					}
					var tmpIns = tmpSwap.out ? getSwapInCandidates(tmpD.klass.system, tmpSwap.out, tmpContent.skills, tmpD.available) : [];
					if (tmpSwap.in && !tmpIns.includes(tmpSwap.in)) { tmpIns.unshift(tmpSwap.in); }
					return {
						index: tmpIndex,
						outOptions: tmpOutOptions,
						inOptions: [tmpOption("", tmpSwap.out ? "-- skill to bring in --" : "-- choose the one to replace first --", tmpSwap.in)]
							.concat(tmpIns.map(tmpName => tmpOption(tmpName, tmpName, tmpSwap.in))),
						advice: describeSwapAdvice(tmpSwap)
					};
				})
			};
		} else {
			tmpView.classSwaps = { show: false, rows: [] };
		}
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
		// Each social skill with the first race's modifier beside it, "+10%" or "BLOCKED", as his
		// class-recommended lists show it (setSocialSkillLists). A BLOCKED one stays in the list --
		// hiding it would leave a player wondering where it went -- and the step refuses it.
		//
		// @MARKER SOCIAL SKILLS
		// Two lists, as his Step 6 has them (HTML 35527-35600): the class's own first -- its Required
		// ones flagged, then its Recommend ones, in his order -- and then every other social skill, A-Z.
		// Each skill is in exactly one of the two, and both share name="socialPick", because the window
		// reads every ticked socialPick on the page (character-generator.mjs @MARKER FORM). A skill the
		// class lists but the campaign has switched off is left out of both. Sage and GME have no class
		// list, only the full one.
		var tmpSocialRow = (tmpDoc, tmpRequired) => {
			var tmpRaceMod = getSocialSkillRaceMod(tmpDoc.name, tmpD.socialRaceName);
			return { name: tmpDoc.name, checked: tmpState.socialSkillNames.includes(tmpDoc.name),
			         mod: tmpRaceMod.text, blocked: tmpRaceMod.blocked, required: !!tmpRequired };
		};
		var tmpSocialDocs = new Map((tmpContent.skills ?? [])
			.filter(tmpDoc => tmpDoc.system?.category == "social" && tmpD.available(tmpDoc))
			.map(tmpDoc => [tmpDoc.name, tmpDoc]));
		var tmpClassSocialNames = [];
		tmpView.classSocialSkills = [];
		for (const [tmpName, tmpRequired] of [...tmpD.classSocial.required.map(tmpN => [tmpN, true]),
		                                      ...tmpD.classSocial.recommended.map(tmpN => [tmpN, false])]) {
			if (tmpClassSocialNames.includes(tmpName) || !tmpSocialDocs.has(tmpName)) { continue; }
			tmpClassSocialNames.push(tmpName);
			tmpView.classSocialSkills.push(tmpSocialRow(tmpSocialDocs.get(tmpName), tmpRequired));
		}
		tmpView.otherSocialSkills = [...tmpSocialDocs.values()]
			.filter(tmpDoc => !tmpClassSocialNames.includes(tmpDoc.name))
			.map(tmpDoc => tmpSocialRow(tmpDoc, false))
			.sort((a, b) => a.name.localeCompare(b.name));
		// Kept whole, both lists in the order shown, for anything that wants every row at once.
		tmpView.socialSkills = [...tmpView.classSocialSkills, ...tmpView.otherSocialSkills];
		tmpView.classSocial = {
			has: tmpView.classSocialSkills.length > 0,
			className: tmpD.klass?.name ?? "",
			upTo: tmpD.classSocial.upTo,
			hasUpTo: tmpD.classSocial.upTo !== null,
			upToSource: tmpD.classSocial.upToSource,
			requiredCount: tmpD.classSocial.required.length,
			anyList: tmpD.classSocial.anyList && !tmpD.nonClassed,
			// The override is offered only when the step would otherwise stop on one of the two rules
			// it is for, or is already ticked -- see checkStep.
			showOverride: !!tmpState.socialOverride || /Required Social Skills|Additional Social Skills/.test(tmpView.blocker)
		};
		tmpView.socialRaceName = tmpD.socialRaceName;
		tmpView.racialChosen = tmpState.racialSkillNames.length;
		tmpView.socialChosen = tmpState.socialSkillNames.length;

		// @MARKER DETAILS
		// @MARKER ALIGNMENT
		// His step 7: the class's alignment list and tendency list (module/alignment-rules.mjs), each a
		// dropdown with his description of the one chosen under it (selected_align_descrip,
		// getAlignmentDescription 73303 / getTendencyDescription 73361). A value not on the list -- kept
		// from before a class change the player overrode -- stays shown as "(current)" rather than
		// vanishing. His Order and Immoral lists have no blank option (HTML 45785-45789, 45828-45832).
		var tmpChoices = tmpD.alignmentChoices;
		tmpView.alignment = {
			requirement: tmpD.klass?.system?.requirements?.alignment ?? "",
			options: buildAlignmentSelectOptions(tmpChoices.alignments, tmpState.alignment, "-- choose --"),
			tendencyOptions: buildAlignmentSelectOptions(tmpChoices.tendencies, tmpState.tendencies,
				tmpChoices.defaultTendency ? null : "-- none --"),
			description: getAlignmentDescription(tmpState.alignment, tmpD.customAlignments),
			tendencyDescription: getTendencyDescription(tmpState.tendencies),
			special: tmpChoices.special,
			unknown: tmpChoices.unknown,
			empty: tmpChoices.empty,
			alignmentless: !!tmpState.alignmentless,
			allowed: tmpD.alignmentAllowed && tmpD.tendencyAllowed,
			// The class-qualification override, shown here too when it is what would let this through.
			showOverride: !!tmpState.override || !(tmpD.alignmentAllowed && tmpD.tendencyAllowed)
		};
		tmpView.handednessOptions = ["", "Right", "Left", "Ambidextrous"]
			.map(tmpValue => tmpOption(tmpValue, tmpValue || "-- roll or choose --", tmpState.handedness));

		// @MARKER STARTING KIT
		// On the Equipment step, with the money it can replace. The styles his clothing tables actually
		// carry, and a preview of what the ticked rules would bring. The preview is built with a FIXED
		// die rather than a random one: it is there to show the shape of the kit before the character
		// is made, and a list that reshuffled itself on every keystroke would be worse than none. The
		// real kit is rolled once, at creation.
		tmpView.clothingStyles = CLOTHING_STYLES.map(tmpStyle =>
			tmpOption(tmpStyle, tmpStyle.charAt(0).toUpperCase() + tmpStyle.slice(1), tmpState.clothingStyle));
		tmpView.startingKitPreview = [];
		var tmpWanted = tmpState.startingKit ?? {};
		if (tmpD.race1 && (tmpWanted.byCulture || tmpWanted.byStatus || tmpWanted.bySkills)) {
			var tmpPreview = buildStartingKit({
				raceName: tmpD.raceNames[0] ?? "", sourceRace: tmpD.race1?.system?.sourceRace ?? "",
				social: getKitSocialClass(tmpState, tmpD),
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

		// @MARKER SHOP
		// The Equipment step's shop -- module/shop-rules.mjs for every rule. Worked out only on that step,
		// since the load line assembles the whole character to weigh it.
		if (tmpStepName == "Equipment") {
			tmpView.shop = buildShopView(tmpState, tmpD, tmpContent);
		}

		// @MARKER REVIEW
		// The same FIXED die as the kit preview above, and for the same reason -- so the Review list
		// is the kit the Equipment step just showed. It must be a 1 and never a 0: every rule takes its
		// dice as 1..sides (chargen-rules.mjs), and a 0 chose the kit alternative BEFORE the first,
		// which is nothing. That threw on every redraw and left the window stuck on Details for any
		// race whose culture kit offers a choice at its social class.
		if (tmpStepName == "Review") {
			var tmpAssembled = assembleCharacter(choicesFromState(tmpState, tmpD), tmpContent, () => 1);
			tmpView.review = {
				items: tmpAssembled.items.map(tmpItem => ({ name: tmpItem.name, type: tmpItem.type,
					category: tmpItem.system.category ?? "",
					quantity: (tmpItem.system.quantity ?? 1) > 1 ? tmpItem.system.quantity : 0 })),
				issues: [...tmpD.ratingIssues, ...tmpD.classIssues.map(tmpIssue => "Class: " + tmpIssue), ...tmpAssembled.issues],
				// Every skill whose fixed bonus is more than nothing, and what it is made of --
				// "Surveyor +45%: Explorer +15%, Mathematics +20%, Scholar +10%". The dice are rolled at
				// creation and are not shown here.
				skillBonuses: (tmpAssembled.skillBonuses ?? []).filter(tmpEntry => tmpEntry.summary)
					.map(tmpEntry => ({ name: tmpEntry.name, category: tmpEntry.category,
						total: (tmpEntry.abilityBonus < 0 ? "" : "+") + tmpEntry.abilityBonus + "%", summary: tmpEntry.summary })),
				title: tmpAssembled.actor.system.identity.title,
				// What the character will carry as its world view -- N/A for Alignmentless, "None" for no tendency.
				alignment: tmpAssembled.actor.system.identity.alignment,
				tendencies: tmpAssembled.actor.system.identity.tendencies,
				// What the character's purse will hold, richest coin first: "40 pp, 3 gp", or nothing.
				// After the shopping, which is what the character actually starts with.
				money: describeCoins(tmpAssembled.actor.system.wealth),
				// What was bought, and what it came to.
				bought: tmpD.cart.lines.filter(tmpLine => tmpLine.ok).map(describeCartLine),
				spent: describeValue(tmpD.cart.spent)
			};
		}
		return tmpView;
	}

	// @MARKER SHOP VIEW
	// This is the function which builds the Equipment step's shop: the purse before and after, the list
	// with what each line costs, the load, and the offers to choose from.
	function buildShopView(tmpState, tmpD, tmpContent) {
		var tmpOption = (tmpValue, tmpLabel, tmpSelected) => ({ value: tmpValue, label: tmpLabel, selected: tmpValue == tmpSelected });
		var tmpShop = tmpState.shop ?? {};
		var tmpType = SHOP_TYPES[tmpShop.type] ? tmpShop.type : "Weapon";
		var tmpIsGM = !!tmpD.shopOptions.isGM;
		var tmpWorldLevel = tmpD.shopOptions.priceLevel;
		var tmpCart = tmpD.cart;
		var tmpByCulture = !!tmpState.startingKit?.byCulture;

		var tmpView = {
			byCulture: tmpByCulture,
			keptCount: (tmpState.purchases ?? []).length,
			isGM: tmpIsGM,
			priceLevelLabel: getPriceLevelLabel(tmpWorldLevel),
			count: Math.max(1, parseInt(tmpShop.count) || 1),
			search: tmpShop.search ?? "",
			typeOptions: SHOP_TYPE_ORDER.map(tmpKey => tmpOption(tmpKey, SHOP_TYPES[tmpKey].label, tmpType)),
			subtypeOptions: [tmpOption("", "-- every kind --", tmpShop.subtype)]
				.concat((tmpD.catalog.categories[tmpType] ?? []).map(tmpCat => tmpOption(tmpCat.value, tmpCat.label, tmpShop.subtype))),
			// The purse line: "Purse 14 gp. After the list: 2 gp, 3 sp. Spent 11 gp, 7 sp."
			purse: describeCoins(tmpState.wealth) || "empty",
			purseAfter: describeCoins(tmpCart.purse) || "nothing",
			spent: describeValue(tmpCart.spent) || "nothing",
			blocked: tmpCart.blocked,
			// For a Game Master only: what the shop would sell and cannot, in this world -- one of his
			// items missing from its compendiums, or an item whose own Cost cannot be read. A player can
			// do nothing about either.
			gaps: tmpIsGM ? describeShopGaps(tmpD.catalog) : ""
		};

		// The list, as priced. A Game Master may set any line's level, his Free included; a player shops
		// at the world's level, which is the Game Master's to set (p.207).
		var tmpLevelChoices = [["", `World (${getPriceLevelLabel(tmpWorldLevel)})`]]
			.concat(PRICE_LEVELS.map(([tmpKey, tmpLabel]) => [tmpKey, tmpLabel]), [[FREE_LEVEL, FREE_LABEL]]);
		tmpView.lines = tmpCart.lines.map(tmpLine => ({
			...tmpLine,
			weightText: tmpLine.weight ? `${tmpLine.weight} lb` : "",
			levelOptions: tmpIsGM ? tmpLevelChoices.map(([tmpKey, tmpLabel]) => tmpOption(tmpKey, tmpLabel, tmpLine.level)) : []
		}));

		// @MARKER LOAD
		// What the character would carry out of the shop -- the kit, what was bought, the race's natural
		// weapons and the armour put on -- weighed exactly as the character sheet weighs it
		// (resolveEncumbrance, combat-rules.mjs), from exactly the items the Review step will list. Shown,
		// never refused: his add_item fetches the encumbrance weights and does not use them, and the
		// book's step 10 asks only that the weight of each thing bought be recorded.
		var tmpWeight = parseFloat(tmpState.weight) || 0;
		if (tmpWeight > 0) {
			var tmpItems = assembleCharacter(choicesFromState(tmpState, tmpD), tmpContent, () => 1).items;
			var tmpStr = Math.max(0, Math.min(30, tmpD.finals?.str?.final ?? 0));
			var tmpInches = ((parseInt(tmpState.heightFeet) || 0) * 12) + (parseInt(tmpState.heightInches) || 0);
			var tmpEnc = resolveEncumbrance(tmpItems, ATTRIBUTE_TABLES.str[tmpStr]?.loadLimit, tmpWeight, tmpInches);
			tmpView.load = { carried: tmpEnc.carried, maxLoad: tmpEnc.maxLoad, status: tmpEnc.status,
				penalty: tmpEnc.penalty, over: tmpEnc.speedFactor < 1 };
		} else {
			tmpView.load = null;
		}

		// The offers: one Type, one kind of it or every kind, and a search on the name.
		var tmpListed = listShopOffers(tmpD.catalog, tmpType, tmpShop.subtype ?? "", tmpShop.search ?? "", SHOP_OFFER_LIMIT);
		tmpView.offers = tmpListed.offers.map(tmpOffer => {
			var tmpPrice = getOfferPrice(tmpOffer, tmpWorldLevel);
			return {
				key: tmpOffer.key, label: tmpOffer.label,
				price: tmpPrice ? tmpPrice.text : "no price",
				priceIssue: tmpPrice?.issue ?? "",
				prices: describeOfferPrices(tmpOffer),
				weight: tmpOffer.weight ? `${tmpOffer.weight} lb` : "",
				homebrew: tmpOffer.homebrew,
				// Could one more be paid for after everything on the list? The purse being worth it is
				// enough, since change is made up or down as needed (shop-rules.mjs payPrice). A hint
				// only -- Buy works it out again, and says so in his words if not.
				affordable: !!tmpPrice && tmpPrice.copper <= getPurseValue(tmpCart.purse)
			};
		});
		tmpView.offerTotal = tmpListed.total;
		tmpView.offerMore = Math.max(0, tmpListed.total - tmpListed.offers.length);
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
			// @MARKER WHOLE CAREER
			// The class's list as edited in the Skills step -- rows given up, rows swapped -- which
			// assembleCharacter writes onto the character's own class item; and his CONVERTs.
			classSkillList: tmpDerived.classSkillList ?? null,
			skillSlotMoves: tmpDerived.slotMoves ?? null,
			// which of a caster/non-caster pair of class skills is this character's, at every title --
			// read for the later titles' skills that lift a social skill (assembleCharacter)
			cannotCast: tmpDerived.cannotCast,
			racialSkillNames: tmpState.racialSkillNames, socialSkillNames: tmpState.socialSkillNames,
			chosenAttackSkill: tmpState.chosenAttackSkill,
			handedness: tmpState.handedness, age: tmpState.age, famorian: tmpState.famorian,
			heightFeet: tmpState.heightFeet, heightInches: tmpState.heightInches, weight: tmpState.weight,
			frame: tmpState.frame, hair: tmpState.hair, eyes: tmpState.eyes, skin: tmpState.skin,
			// @MARKER ALIGNMENT
			// Alignmentless writes N/A to both, his setFinalAlignment (73409-73412); assembleCharacter
			// writes "None" for a blank, as it does (73414-73422).
			alignment: tmpState.alignmentless ? ALIGNMENT_NOT_APPLICABLE : tmpState.alignment,
			tendencies: tmpState.alignmentless ? ALIGNMENT_NOT_APPLICABLE : tmpState.tendencies,
			languages: tmpState.languages,
			// No coins with Gear by culture: the kit is his wilderness equipment, taken INSTEAD. Otherwise
			// what is LEFT once the shopping is paid for -- deriveGenerator priced it (@MARKER SHOP), and
			// the items it bought go in as purchases, for assembleCharacter to create.
			wealth: tmpState.startingKit?.byCulture ? { copper: 0, silver: 0, gold: 0, platinum: 0 }
				: (tmpDerived.cart?.purse ?? tmpState.wealth),
			purchases: tmpState.startingKit?.byCulture ? [] : (tmpDerived.purchases ?? []),
			startingKit: tmpState.startingKit, clothingStyle: tmpState.clothingStyle,
			socialClass: getKitSocialClass(tmpState, tmpDerived),
			maxAge: tmpDerived.race?.ages?.maxAge ?? "",
			// The body the armour is put on at creation -- barding only on the body it was made for.
			bodyType: tmpDerived.race?.bodyType ?? ""
		};
	}

	// @MARKER STARTING MONEY
	// This is the function which says whether the starting money needs rolling now.
	//
	// His sheet rolls it by itself, once, when the racial features are confirmed (sheet-worker.js:6439)
	// -- nobody presses a button for it. The port rolls it the first time the Equipment step is drawn --
	// the step that holds the money, and the first at which everything it reads is known: the Social
	// Class and the three mystical attributes from the Attributes step, and the class, whose "+5%
	// Fortune" and first title are part of the Fortune it is rolled against. (It was the Details step
	// until 2026-09-23, when the money moved to the new Equipment step with the shop it pays for.)
	//
	// It is due:
	//     - on the Equipment step, with a race, attributes and a class chosen,
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
		if (STEPS[tmpState.step] != "Equipment") { return false; }
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

	// This is the function which names the races that may be a character's second race, given the
	// first race's document: its fertile partners for a Half Race, or -- for a Formless, whose second
	// race is not a mate but a body -- its host list. The Race step offers these, and the generator
	// keeps a second race only while it is one of them (character-generator.mjs, @MARKER FORM).
	export function getSecondRaceNames(tmpRace1Doc) {
		return tmpRace1Doc?.system?.formless
			? (tmpRace1Doc?.system?.formlessHosts ?? [])
			: (tmpRace1Doc?.system?.fertileWith ?? []);
	}

	// This is the function which gives the Social Class the starting kit is worked out from.
	//
	// A class below 5 or above 20 has no standing in the mortal realms, and an apparent one is rolled
	// in its place -- by the money AND by the kit (module/starting-kit.mjs @MARKER APPARENT SOCIAL
	// CLASS). Rolled twice, the same character could look like a slave to its purse and a noble to its
	// tailor. So once the money has rolled one, the kit is handed that one; buildStartingKit then finds
	// a class already between 5 and 20 and rolls nothing further. Only while the money roll still
	// belongs to this character's real class, which startingMoneyIsDue keeps true on the Equipment step.
	export function getKitSocialClass(tmpState, tmpDerived) {
		var tmpSocial = tmpDerived.finals?.soc?.final ?? 0;
		var tmpMoney = tmpState.startingMoney;
		if (tmpMoney?.apparent && tmpMoney.realSocialClass == tmpSocial) { return tmpMoney.socialClass; }
		return tmpSocial;
	}

	// @MARKER ALIGNMENT
	// This is the function which keeps the alignment and tendency in step with the class, and is run by
	// the window before every draw. Only when the class has CHANGED since they were last checked
	// (alignmentFor), so an alignment kept on purpose with the override is not taken away on the next
	// keystroke:
	//     - an alignment the new class does not allow is cleared, for the player to choose again;
	//     - a tendency it does not allow is cleared;
	//     - an Order or Immoral class's default tendency is put in when the tendency is blank -- his
	//       HTML preselects it (45786, 45810, 45829) and his code then clears it (73086, 73262-73278),
	//       so on his sheet it came out "None"; that slip is not ported.
	// Always re-derived from the class chosen NOW, never from a stale one: his path handlers set the
	// requirement but never re-ran setAlignmentSelection (6504-6547), leaving the old dropdown up.
	// Returns true when it changed anything.
	export function reconcileAlignment(tmpState, tmpDerived) {
		var tmpClassName = tmpState.className ?? "";
		if (tmpState.alignmentFor === tmpClassName) { return false; }
		var tmpChoices = tmpDerived.alignmentChoices;
		var tmpChanged = false;
		if (tmpState.alignment && !tmpChoices.alignments.includes(tmpState.alignment)) {
			tmpState.alignment = ""; tmpChanged = true;
		}
		if (tmpState.tendencies && !tmpChoices.tendencies.includes(tmpState.tendencies)) {
			tmpState.tendencies = ""; tmpChanged = true;
		}
		if (!tmpState.tendencies && tmpChoices.defaultTendency) {
			tmpState.tendencies = tmpChoices.defaultTendency; tmpChanged = true;
		}
		tmpState.alignmentFor = tmpClassName;
		return tmpChanged;
	}

// @MARKER ADD NEW character generator view functions HERE
// @END (CODE)
