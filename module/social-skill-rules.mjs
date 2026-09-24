// @START (CODE)
// @MARKER RACE AND CROSS-SKILL MODIFIERS
//==================================================================================================================
// The modifiers his sheet adds to a new character's skills beyond the dice, the race's own bonus on a
// racial skill, and the class's +30 CORE and type modifiers on a class skill. Rules only -- no Foundry
// here, so tools/social-mods-test.html drives the lot. The project notes called these "social-class
// skill modifiers"; nothing in them reads Social Class, and the right name is the one above.
//
// Four terms, from three of his functions:
//
//   on a SOCIAL skill -- setSocialSkillAbility (sheet-worker.js:56962):
//       ability = dice + the race's modifier + getExtraSocialMods (57589)
//       the race's modifier      getSocialSkillMods (55499), or BLOCKED              SOCIAL_SKILL_RACE_MODS
//       racial/class -> social   getRaceClassSocialMod (57649)                        RACE_CLASS_TO_SOCIAL_BONUS
//       Falconry                 +15 with Animal Training and a racial animal skill   (57609-57620)
//       social -> social         getSocialSkillModsToSocialSkills (57680)             SOCIAL_FROM_SOCIAL_BONUS
//       Swimming                 +50 for the ability Swimming, +30 for Webbed         (57641-57644)
//
//   on a RACIAL or CLASS skill -- getExtraClassRacialMods (53467), from setRacialSkillAbility (53452)
//   and setClassSkillAbility (63767):
//       the trait switch         Famorian evokes, Climbing, Hearing, Smell, Loud      (53473-53523)
//       his "only the excess"    the trait's value less the bonus already there       (53524)
//       social -> racial/class   getRacialModsFromSocial (57118)                      SOCIAL_TO_RACE_CLASS_BONUS
//
// Everything here reads NAMES -- the skills held, the race's traits, the evokes -- never another
// skill's worked-out chance, so the terms can be added in any order once the names are known. His
// sheet adds them into a skill's ability ONCE, when the skill is gained, and never works them out
// again; the port stores them the same way, in the skill's abilityBonus.
//
// WHERE THE PORT DEPARTS FROM HIS CODE -- each the recommended option, taken 2026-09-23 while the user
// was away, provisional until confirmed (DECISIONS.md):
//   1. getExtraClassRacialMods RETURNS BEFORE ITS OWN getAttrs CALLBACK RUNS (53546 against 53471), so
//      on his live sheet it always gives 0: no evoke, no Climbing, no Hearing, no social bonus ever
//      reaches a racial or class skill. What it was written to add is added here. His comment at
//      63786, his evoke text ("+40% Climb", "+30% to Listen") and the Player's Guide p.xv step 9C
//      ("add all bonuses listed next to the social skill to those skills as well") all say it should.
//   2. UPSTREAM 52: getExtraSocialMods hands getRaceClassSocialMod the whole racial-skill ARRAY, so a
//      racial skill never lifts a social one. Here each racial AND class skill held is asked in turn,
//      as his own later getNewSocialSkillModifier does (125673-125679). That function reads EVERY
//      title's class-skill rows, class_skill_1_1 to class_skill_15_1 (125658), and his sheet has them
//      all from creation (63288 onward) -- so at creation the class skills asked are every title's,
//      and an Assassin's Disguise, which arrives at title 2, lifts Acting from the start. The later
//      grant (class-advancement.mjs) never goes back to a social skill: it was counted already.
//   3. The "only the excess" rule is skipped when the trait switch gave nothing. As written it turns
//      a published race penalty into a bonus: a Brok's Tame Animal -10% becomes 0 - (-10) = +10.
//   4. The Loud disability takes Surprise Attack -20. His sheet writes "tmp_tmp_disabilities_loud"
//      (46914) where it reads "tmp_disabilities_loud", so it never could, even without item 1.
//   5. Only the FIRST race's modifiers and BLOCKs count on a social skill, as his race_list1 (17028,
//      53598) -- the Player's Guide's Half Race rule 6 (p.33) would average both. Kept as his code.
//   6. The Famorian's Instinct(Navigation) is fixed when the skill is gained, at the creation title
//      (at least 1), as his code does (53495-53497); his evoke text says "per Title".
//   7. Swimming's +50 only when Swimming is taken, as his code has it. His errata (Legends Pg 42)
//      says the ability "Grants Swimming Social Skill at +50%", which may mean more.
// The four data slips (Botany/Botanist out of pairs, Artisan twice, "Truth Tell ", Rope Use's bare
// "Set Trap") are repaired in the tables, by tools/extract/extract_social_skill_tables.py.
//==================================================================================================================

import { SOCIAL_SKILL_RACE_MODS, SOCIAL_FROM_SOCIAL_BONUS, SOCIAL_TO_RACE_CLASS_BONUS,
	RACE_CLASS_TO_SOCIAL_BONUS, SOCIAL_GENERAL_MODS } from "./social-skill-tables.mjs";

	// @MARKER NAMES
	// This is the function which says whether a name out of the tables matches a skill. A table name
	// may answer to more than one skill, written "A|B" -- "Botany|Botanist", which are one skill under
	// two names, and "Set Trap|Set Trap(w)|Set Trap(u)", which players only ever hold as a variant.
	export function matchesSkillName(tmpTableName, tmpSkillName) {
		if (!tmpTableName || !tmpSkillName) { return false; }
		return ("" + tmpTableName).split("|").includes("" + tmpSkillName);
	}

	// This is the function which gives the race name his social tables are keyed by: the FIRST race,
	// as his race_list1. A split form of the port's own -- Fairy(Winged), Maginos(Clay) -- reads the
	// race it was split from (sourceRace), which is the name his tables use.
	export function getSocialModRaceName(tmpRaceDoc) {
		if (!tmpRaceDoc) { return ""; }
		return tmpRaceDoc.system?.sourceRace || tmpRaceDoc.name || "";
	}

	// @MARKER CONTEXT
	// This is the function which gathers every name the modifiers read, once per character, so
	// creation (chargen-rules.mjs assembleCharacter) and a later title's class skills
	// (class-advancement.mjs grantClassSkills) build it the same way.
	//
	//   raceDocs          the race documents or items, first race first
	//   famorianEvokes    the evoke keys a Famorian took ("climbing", "hooves" ...), or nothing
	//   title             the title the skill is gained at, for Instinct(Navigation)
	//   socialSkillNames, racialSkillNames, classSkillNames   the skills held, by name
	//   laterClassSkills  [{ name, title }]: the class's skills of titles 2 and up, which his sheet
	//                     already holds AT CREATION (setFinalClassSkills writes every title's rows,
	//                     63288 onward) -- given only by character creation; see assembleCharacter
	//
	// The abilities and disabilities are every race's, joined: his flags (abilities_climbing and the
	// rest) are set from the whole race line-up, and a Half Race holds both parents' traits.
	//
	// The evokes count only while a race is a Famorian one, as the character's own model reads them
	// (module/data/actor-character.mjs, @MARKER FAMORIAN). Nothing clears physical.famorian.evokes
	// when a race item is swapped on the sheet, so a Famorian made Human still carries its old evoke
	// keys -- and they must not reach a later title's Climb or Listen.
	export function buildSkillModContext(tmpParts) {
		var tmpRaceDocs = (tmpParts?.raceDocs ?? []).filter(tmpDoc => tmpDoc);
		var tmpAbilities = [];
		var tmpDisabilities = [];
		for (const tmpDoc of tmpRaceDocs) {
			for (const tmpName of tmpDoc.system?.abilities ?? []) { if (!tmpAbilities.includes(tmpName)) { tmpAbilities.push(tmpName); } }
			for (const tmpName of tmpDoc.system?.disabilities ?? []) { if (!tmpDisabilities.includes(tmpName)) { tmpDisabilities.push(tmpName); } }
		}
		var tmpIsFamorian = tmpRaceDocs.some(tmpDoc => tmpDoc.system?.famorian?.isFamorian);
		var tmpRacialSkills = [...(tmpParts?.racialSkillNames ?? [])].filter(tmpName => tmpName);
		var tmpClassSkills = [...(tmpParts?.classSkillNames ?? [])].filter(tmpName => tmpName);
		// A later title's class skill counts as a class skill held; the title it arrives at is kept
		// only to say so on the Review step, and only for one the character does not hold already.
		// A class listing the skill at two titles gives it at the earlier (getClassSkillTitle).
		var tmpHeldNow = [...tmpRacialSkills, ...tmpClassSkills];
		var tmpLaterTitles = {};
		for (const tmpSkill of tmpParts?.laterClassSkills ?? []) {
			if (!tmpSkill?.name || tmpHeldNow.includes(tmpSkill.name)) { continue; }
			var tmpTitle = parseInt(tmpSkill.title) || 0;
			if (!(tmpSkill.name in tmpLaterTitles)) { tmpClassSkills.push(tmpSkill.name); }
			if (!(tmpSkill.name in tmpLaterTitles) || tmpTitle < tmpLaterTitles[tmpSkill.name]) {
				tmpLaterTitles[tmpSkill.name] = tmpTitle;
			}
		}
		return {
			raceName: getSocialModRaceName(tmpRaceDocs[0]),
			abilities: tmpAbilities,
			disabilities: tmpDisabilities,
			evokes: tmpIsFamorian ? [...(tmpParts?.famorianEvokes ?? [])] : [],
			title: parseInt(tmpParts?.title) || 0,
			socialSkills: [...(tmpParts?.socialSkillNames ?? [])].filter(tmpName => tmpName),
			racialSkills: tmpRacialSkills,
			classSkills: tmpClassSkills,
			laterClassSkillTitles: tmpLaterTitles
		};
	}

	// @MARKER RACE MODIFIER
	// This is the function which gives the race's modifier on one social skill -- his getSocialSkillMods
	// (sheet-worker.js:55499), with his errata laid over his table.
	//
	// Returns { percent, blocked, text }: text is his own form, "+10%" or "BLOCKED" or "". A BLOCKED
	// skill is worth 0, which is what his percentStringToInt makes of the word; his copy button refuses
	// the pick outright ("A skill was selected that this race cannot acquire. Nothing done.", 7420).
	// A skill his table does not list gives nothing -- his code would throw on a name missing from his
	// dictionary (55716); every one of the port's 202 social skills is in it, a homebrew one would not be.
	export function getSocialSkillRaceMod(tmpSkillName, tmpRaceName) {
		var tmpNone = { percent: 0, blocked: false, text: "" };
		if (!tmpSkillName || !tmpRaceName) { return tmpNone; }
		var tmpMod = SOCIAL_SKILL_RACE_MODS[tmpSkillName]?.[tmpRaceName];
		if (tmpMod === undefined) { return tmpNone; }
		if (tmpMod == "BLOCKED") { return { percent: 0, blocked: true, text: "BLOCKED" }; }
		var tmpPercent = parseInt(tmpMod) || 0;
		return { percent: tmpPercent, blocked: false, text: (tmpPercent < 0 ? "" : "+") + tmpPercent + "%" };
	}

	// @MARKER TRAIT SWITCH
	// This is the function which works out his trait switch on one racial or class skill, and then his
	// "only add the amount this mod is over to the already existing mod" -- getExtraClassRacialMods,
	// sheet-worker.js:53473-53524, carried here by hand. tools/extract/extract_social_skill_tables.py
	// checks on every run that each case and figure below is still in his code.
	//
	//     skill                 when                                                  value    his lines
	//     Berserking            Famorian evoke Berserking                              +50     53477-53479
	//     Climb                 Famorian evoke Hooves                                  -50     53482-53484
	//                           Famorian evoke Climbing                            adds +40     53485-53487
	//                           racial ability Climbing                            adds +10     53488-53490
	//     Direction Knowledge   Famorian evoke Instinct(Navigation)          10 x title (min 1)  53493-53498
	//     Listen                evoke Enhanced Hearing, else ability Enhanced
	//                           Hearing, else Exceptional Hearing (not added up)       +30     53501-53508
	//     Smell                 evoke Enhanced Smell, else ability Enhanced Smell      +30     53511-53515
	//     Surprise Attack       racial disability Loud                                 -20     53518-53522
	//
	// His evoke test reads "famorian_evoke_X_final == 'Yes' || famorian_evoke_X == 'on'"; the port's
	// evokes are the keys the character took, so either is simply "the key is there". (His Hooves
	// _final is set to "Hooves", not "Yes", 33265, so only the checkbox ever matched -- same result.)
	//
	// THE EXCESS RULE, then: "if (tmpextramods>=tmpmod) { tmpextramods=tmpextramods-tmpmod; }", where
	// tmpmod is the race's bonus on a racial skill, and 30 or 0 (CORE or not) on a class skill (63786).
	// So a Cervara's Listen, +30 from its race, gains nothing more from Enhanced Hearing, while a
	// Brachara's Climb (+20) with Climbing (+10) gains the full +10 because 10 is not over 20. Kept as
	// written, both oddities included -- they are his to answer. EXCEPT that the rule is skipped when
	// no trait fired: as written, 0 >= -10 turns a Brok's Tame Animal -10% into 0. Departure 3 above.
	//
	// Returns { total, parts }, parts being [{ label, percent }] for the Review step to show.
	export function getTraitSkillBonus(tmpSkillName, tmpExistingMod, tmpContext) {
		var tmpEvokes = tmpContext?.evokes ?? [];
		var tmpAbilities = tmpContext?.abilities ?? [];
		var tmpDisabilities = tmpContext?.disabilities ?? [];
		var tmpParts = [];
		var tmpExtra = 0;
		switch (tmpSkillName) {
			case "Berserking":
				if (tmpEvokes.includes("berserking")) { tmpExtra = 50; tmpParts.push({ label: "Famorian evoke Berserking", percent: 50 }); }
				break;
			case "Climb":
				if (tmpEvokes.includes("hooves")) { tmpExtra = -50; tmpParts.push({ label: "Famorian evoke Hooves", percent: -50 }); }
				if (tmpEvokes.includes("climbing")) { tmpExtra = tmpExtra + 40; tmpParts.push({ label: "Famorian evoke Climbing", percent: 40 }); }
				if (tmpAbilities.includes("Climbing")) { tmpExtra = tmpExtra + 10; tmpParts.push({ label: "ability Climbing", percent: 10 }); }
				break;
			case "Direction Knowledge":
				if (tmpEvokes.includes("instinct_navigation")) {
					var tmpTitle = parseInt(tmpContext?.title) || 0;
					if (tmpTitle < 1) { tmpTitle = 1; }
					tmpExtra = tmpTitle * 10;
					tmpParts.push({ label: `Famorian evoke Instinct(Navigation), title ${tmpTitle}`, percent: tmpExtra });
				}
				break;
			case "Listen":
				if (tmpEvokes.includes("enhanced_hearing")) {
					tmpExtra = 30; tmpParts.push({ label: "Famorian evoke Enhanced Hearing", percent: 30 });
				} else if (tmpAbilities.includes("Enhanced Hearing")) {
					tmpExtra = 30; tmpParts.push({ label: "ability Enhanced Hearing", percent: 30 });
				} else if (tmpAbilities.includes("Exceptional Hearing")) {
					tmpExtra = 30; tmpParts.push({ label: "ability Exceptional Hearing", percent: 30 });
				}
				break;
			case "Smell":
				if (tmpEvokes.includes("enhanced_smell")) {
					tmpExtra = 30; tmpParts.push({ label: "Famorian evoke Enhanced Smell", percent: 30 });
				} else if (tmpAbilities.includes("Enhanced Smell")) {
					tmpExtra = 30; tmpParts.push({ label: "ability Enhanced Smell", percent: 30 });
				}
				break;
			case "Surprise Attack":
				if (tmpDisabilities.includes("Loud")) { tmpExtra = -20; tmpParts.push({ label: "disability Loud", percent: -20 }); }
				break;
		}
		var tmpMod = parseInt(tmpExistingMod) || 0;
		// only add the amount this mod is over to the already existing mod (his 53524) -- and only
		// when the switch gave something (departure 3).
		if (tmpParts.length && tmpExtra >= tmpMod && tmpMod != 0) {
			tmpExtra = tmpExtra - tmpMod;
			tmpParts.push({ label: `only the part over the ${(tmpMod < 0 ? "" : "+") + tmpMod}% already there counts`, percent: -tmpMod });
		}
		return { total: tmpExtra, parts: tmpParts };
	}

	// @MARKER SOCIAL TO RACIAL AND CLASS
	// This is the function which adds what the character's social skills give one racial or class
	// skill -- the loop at the end of getExtraClassRacialMods (53526-53544) over getRacialModsFromSocial.
	// Keyed by the GIVING social skill; each social skill held gives at most once (his j=tmplist.length
	// break, 53536), and separate social skills add up: Acting (+15) and Cosmetics (+10) give Disguise +25.
	export function getSocialToRaceClassBonus(tmpSkillName, tmpSocialSkillNames) {
		var tmpParts = [];
		var tmpTotal = 0;
		for (const tmpSocial of new Set(tmpSocialSkillNames ?? [])) {
			for (const [tmpTarget, tmpPercent] of SOCIAL_TO_RACE_CLASS_BONUS[tmpSocial] ?? []) {
				if (matchesSkillName(tmpTarget, tmpSkillName)) {
					tmpTotal = tmpTotal + tmpPercent;
					tmpParts.push({ label: tmpSocial, percent: tmpPercent });
					break;
				}
			}
		}
		return { total: tmpTotal, parts: tmpParts };
	}

	// @MARKER EXTRA CLASS AND RACIAL MODS
	// This is the function which gives everything getExtraClassRacialMods was written to add to a
	// racial or class skill: the trait switch with its excess rule, then the social skills' bonuses in
	// full (his order -- the excess rule runs before the social term, 53524 against 53526).
	//
	//   tmpExistingMod   the race's bonus on a racial skill; 30 or 0 on a class skill, CORE or not
	//                    (only the CORE +30, never the class-type modifiers: his tmpmod at 63786)
	export function getExtraClassRacialMods(tmpSkillName, tmpExistingMod, tmpContext) {
		var tmpTrait = getTraitSkillBonus(tmpSkillName, tmpExistingMod, tmpContext);
		var tmpSocial = getSocialToRaceClassBonus(tmpSkillName, tmpContext?.socialSkills);
		return { total: tmpTrait.total + tmpSocial.total, parts: [...tmpTrait.parts, ...tmpSocial.parts] };
	}

	// @MARKER EXTRA SOCIAL MODS
	// This is the function which gives everything getExtraSocialMods (57589-57647) adds to one social
	// skill, besides the race's own modifier:
	//   #1  each racial and class skill held, asked of getRaceClassSocialMod -- Disguise gives Acting
	//       and Begging +15, Speak to Animal and Tame Animal each give Animal Training +15 (UPSTREAM
	//       52, departure 2). A skill held twice counts once. At creation the class skills are every
	//       title's (laterClassSkills, departure 2); one not arrived yet says its title in the label.
	//   #2  Falconry +15 with Animal Training held as a social skill AND Speak to Animal or Tame Animal
	//       held as a RACIAL skill -- his loop reads raceskills only (57615-57618).
	//   #3  each social skill held that his table lists as lifting this one.
	//   #4  Swimming: +50 for the racial ability Swimming, +30 for Webbed Feet/Hands.
	// No cap: his function adds all four and returns the sum.
	export function getExtraSocialMods(tmpSkillName, tmpContext) {
		var tmpParts = [];
		var tmpTotal = 0;
		var tmpAdd = (tmpLabel, tmpPercent) => { tmpTotal = tmpTotal + tmpPercent; tmpParts.push({ label: tmpLabel, percent: tmpPercent }); };
		if (!tmpSkillName) { return { total: 0, parts: [] }; }
		var tmpSocialHeld = tmpContext?.socialSkills ?? [];
		var tmpRacialHeld = tmpContext?.racialSkills ?? [];

		// #1 racial and class skills
		for (const tmpHeld of new Set([...tmpRacialHeld, ...(tmpContext?.classSkills ?? [])])) {
			var tmpLater = tmpContext?.laterClassSkillTitles?.[tmpHeld];
			for (const [tmpGiver, tmpPercent] of RACE_CLASS_TO_SOCIAL_BONUS[tmpSkillName] ?? []) {
				if (matchesSkillName(tmpGiver, tmpHeld)) {
					tmpAdd(tmpLater ? `${tmpHeld} (class skill, title ${tmpLater})` : tmpHeld, tmpPercent);
				}
			}
		}

		// #2 Falconry -- hark I hear a raptor cry!
		if (tmpSkillName == "Falconry" && tmpSocialHeld.includes("Animal Training")
			&& (tmpRacialHeld.includes("Speak to Animal") || tmpRacialHeld.includes("Tame Animal"))) {
			tmpAdd("Animal Training with a racial Speak to Animal or Tame Animal", 15);
		}

		// #3 social skills that boost each other
		for (const [tmpGiver, tmpPercent] of SOCIAL_FROM_SOCIAL_BONUS[tmpSkillName] ?? []) {
			var tmpFound = tmpSocialHeld.find(tmpHeld => matchesSkillName(tmpGiver, tmpHeld));
			if (tmpFound) { tmpAdd(tmpFound, tmpPercent); }
		}

		// #4 abilities that help social skills
		if (tmpSkillName == "Swimming") {
			var tmpAbilities = tmpContext?.abilities ?? [];
			if (tmpAbilities.includes("Swimming")) { tmpAdd("ability Swimming", 50); }
			if (tmpAbilities.includes("Webbed Feet/Hands")) { tmpAdd("ability Webbed Feet/Hands", 30); }
		}
		return { total: tmpTotal, parts: tmpParts };
	}

	// @MARKER GENERAL MODIFIERS
	// This is the function which lists the lines his "Social Skill Modifiers:" box shows for the social
	// skills held (setSocialSkillGeneralModifiers, 57342). Display only; not yet shown on the sheet --
	// see docs/sonnet/2026-09-23-social-skill-mods.md.
	export function getSocialSkillGeneralModifiers(tmpSocialSkillNames) {
		return (tmpSocialSkillNames ?? []).map(tmpName => SOCIAL_GENERAL_MODS[tmpName]).filter(tmpText => tmpText);
	}

	// @MARKER DESCRIBE
	// This is the function which says a skill's modifiers in one line, for the generator's Review step:
	// "race +10%, Mathematics +10%". Nothing when there are none.
	export function describeSkillBonusParts(tmpParts) {
		return (tmpParts ?? []).filter(tmpPart => tmpPart.percent)
			.map(tmpPart => `${tmpPart.label} ${tmpPart.percent < 0 ? "" : "+"}${tmpPart.percent}%`).join(", ");
	}

// @MARKER ADD NEW race and cross-skill modifier functions HERE
// @END (CODE)
