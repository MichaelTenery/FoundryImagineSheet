// @START (CODE)
// @MARKER RACE RULES
//==================================================================================================================
// Rules for combining races, with no Foundry dependency, so they can be tested outside it.
//
// His sheet lets a character be of more than one race. race_type offers One Race, Half Race,
// Multi Race(3), Multi Race(4), Part Race and Trace Race (sheet-worker.js:32591-32726), but only
// Half Race is actually implemented: applyRaceToAttribs (32966) answers the other four with
// "not yet implemented. Nothing done." So Half Race is ported here from his code, and the others
// are not guessed at -- see UPSTREAM-ISSUES.md item 32.
//
// A Half Race is at least 40 percent each of two races (Player's Guide, Mixed Races, p.33). His
// applyHalfRaceToAttribs (33770) takes the two races' raceStatsAndMoveDetails rows and combines
// them field by field:
//
//     field                                  how                            where in his code
//     attribute modifiers                    averageTwoFloatsRounded        33889-33900
//     attribute maximums                     averageTwoFloatsRounded        33901-33912
//     starting Endurance modifier            averageTwoFloatsRounded        8147-8152
//     Endurance formulas (start, title)      kept as a "first|second" pair  33913-33926
//     Perception/Affinity/Fortune mods       averageTwoFloatsRounded        33927-33929
//     the five resistance mods               averageTwoFloatsRounded        33930-33934
//     speed multiplier, walk/jog/run mods    averageTwoFloatsRounded        33935-33947
//     special movement                       the FIRST race's, whole        33945-34000
//     standing and upward jump               averageTwoFloatsRounded        34001-34002
//     formless                               never -- "formless can't be half races"   34003
//     can swim                               if either race can             34004-34008
//
// "Averaged" is his averageTwoFloatsRounded, and it is not a plain average. It is the Player's
// Guide's own rule (Half Race, item 1): a modifier only one race has is taken in FULL, two
// bonuses are averaged rounding up, two penalties are averaged rounding towards the bigger
// penalty, and a bonus against a penalty is simply added.
//==================================================================================================================

	// This is the function which combines two races' figures the way his half race does. Ported
	// from averageTwoFloatsRounded (sheet-worker.js), branch for branch:
	//
	//     both 0                      0
	//     both above 0                average, +.099, rounded      +3 and +1 give +2
	//     both below 0                average, -.099, rounded      -2 and -3 give -3
	//     anything else               the two ADDED, +.099, rounded   +2 and 0 give +2
	//
	// The .099 nudges a .5 the way he wants it before toFixed(0) rounds -- up for bonuses, away
	// from zero for penalties -- and his toFixedWithoutZeros turns the result back into a number.
	export function averageTwoFloatsRounded(tmpFloat1, tmpFloat2) {
		var tmpValue1 = parseFloat(tmpFloat1) || 0;
		var tmpValue2 = parseFloat(tmpFloat2) || 0;
		var tmpResult = 0.0;
		if (tmpValue1 == 0 && tmpValue2 == 0) {
			tmpResult = 0;
		} else if (tmpValue1 > 0 && tmpValue2 > 0) {
			tmpResult = ((tmpValue1 + tmpValue2) / 2) + 0.099;
		} else if (tmpValue1 < 0 && tmpValue2 < 0) {
			tmpResult = ((tmpValue1 + tmpValue2) / 2) - 0.099;
		} else { // 0 or 1 is negative, 1 positive (average by addition)
			tmpResult = (tmpValue1 + tmpValue2) + 0.099;
		}
		return Number.parseFloat(tmpResult.toFixed(0));
	}

	// This is the function which gives the name his sheet writes for a character of two races --
	// full_race_name, "first|second" (sheet-worker.js:33771).
	export function getHalfRaceName(tmpName1, tmpName2) {
		return "" + tmpName1 + "|" + tmpName2;
	}

	// This is the function which averages every key of two flat objects of numbers with
	// averageTwoFloatsRounded -- used for the attribute, characteristic and resistance blocks.
	function averageEachKey(tmpBlock1, tmpBlock2) {
		var tmpOut = {};
		var tmpKeys = new Set([...Object.keys(tmpBlock1 ?? {}), ...Object.keys(tmpBlock2 ?? {})]);
		for (const tmpKey of tmpKeys) {
			tmpOut[tmpKey] = averageTwoFloatsRounded((tmpBlock1 ?? {})[tmpKey], (tmpBlock2 ?? {})[tmpKey]);
		}
		return tmpOut;
	}

	// This is the function which joins two formula strings into his "first|second" pair. He only
	// writes a pair when at least one side has something, and fills an empty side with "0"
	// (sheet-worker.js:33913-33919).
	function pairFormulas(tmpFormula1, tmpFormula2) {
		var tmpText1 = ("" + (tmpFormula1 ?? "")).trim();
		var tmpText2 = ("" + (tmpFormula2 ?? "")).trim();
		if (tmpText1 == "" && tmpText2 == "") { return ""; }
		return (tmpText1 == "" ? "0" : tmpText1) + "|" + (tmpText2 == "" ? "0" : tmpText2);
	}

	// This is the function which reads one of his racial-skill bonuses ("+20%", "-10%", or blank)
	// as a number.
	function percentToNumber(tmpPercent) {
		return parseInt(("" + (tmpPercent ?? "")).replace("%", "").replace("+", "")) || 0;
	}

	// This is the function which merges two races' racial-skill lists as his
	// combineTwoRaceSkillDetails does: every skill from both, once, in the first race's order and
	// then the second's, a skill both offer keeping the BETTER bonus.
	//
	// "Better" is the evident intent rather than what his code does. His getBestModifierPercent
	// declares both its parameters as numberString1, so the second shadows the first and a shared
	// skill always takes the SECOND race's bonus. UPSTREAM-ISSUES.md item 32.
	export function mergeRacialSkills(tmpSkills1, tmpSkills2) {
		var tmpOut = [];
		var tmpSeen = {};
		for (const tmpSkill of [...(tmpSkills1 ?? []), ...(tmpSkills2 ?? [])]) {
			if (tmpSeen[tmpSkill.name] !== undefined) {
				var tmpKept = tmpOut[tmpSeen[tmpSkill.name]];
				if (percentToNumber(tmpSkill.bonus) > percentToNumber(tmpKept.bonus)) { tmpKept.bonus = tmpSkill.bonus; }
				continue;
			}
			tmpSeen[tmpSkill.name] = tmpOut.length;
			tmpOut.push({ name: tmpSkill.name, bonus: tmpSkill.bonus ?? "" });
		}
		return tmpOut;
	}

	// This is the function which merges two name lists with duplicates removed, as his half race
	// merges abilities, disabilities and immunities (mergeTwoStringLists, removeDuplicatesInArray).
	// His further steps are NOT ported: removeLesserAbilities (keep only the stronger of two
	// versions of one ability, as the Player's Guide asks) and remove2ndRaceBodyAbilities (drop the
	// second race's abilities that need a body the character has not got). Both are name-matching
	// rules over his ability vocabulary; until the racial ability mechanics are ported the lists
	// are display only, so a lesser version showing beside a greater one misleads nobody.
	export function mergeNameLists(tmpList1, tmpList2) {
		return [...new Set([...(tmpList1 ?? []), ...(tmpList2 ?? [])])].sort();
	}

	// This is the function which takes the lesser of two ages, as his setAge does for a half race.
	// A maximum age can be a word ("Immortal"), which is longer than any number of years, so a
	// number always wins against one; two words keep the first. His lesserOfTwoNumbers compares
	// a word as NaN and falls through to the first, which gets "Immortal" and 100 wrong one way
	// round -- the port reads what he evidently means.
	export function lesserAge(tmpAge1, tmpAge2) {
		var tmpNumber1 = parseFloat(tmpAge1);
		var tmpNumber2 = parseFloat(tmpAge2);
		if (isNaN(tmpNumber1) && isNaN(tmpNumber2)) { return tmpAge1; }
		if (isNaN(tmpNumber1)) { return tmpAge2; }
		if (isNaN(tmpNumber2)) { return tmpAge1; }
		return (tmpNumber2 < tmpNumber1) ? tmpAge2 : tmpAge1;
	}

	// This is the function which says whether a class is closed to a character's race or races,
	// from the class's blockedRaces. His setClassDetails: one race is barred if it is on the list;
	// a half race only if BOTH are ("isRace1Blocked && isRace2Blocked"). His sheet also lets the
	// player override the bar, so this reports rather than refuses.
	export function isClassBlockedForRaces(tmpBlockedRaces, tmpRaceNames) {
		var tmpNames = (tmpRaceNames ?? []).slice(0, 2);
		if (tmpNames.length == 0) { return false; }
		var tmpBlocked = tmpBlockedRaces ?? [];
		return tmpNames.every(tmpName => tmpBlocked.includes(tmpName));
	}

	// This is the function which says whether two races can have children together. His sheet
	// only offers the first race's fertileWith list as the second race, so an incompatible pair
	// cannot be picked there; the port has no picker to restrict, so it reports the pair instead.
	export function canRacesBreed(tmpRace1Name, tmpRace1FertileWith, tmpRace2Name) {
		if (tmpRace1Name == tmpRace2Name) { return true; }
		return (tmpRace1FertileWith ?? []).includes(tmpRace2Name);
	}

	// This is the function which builds the race a Half Race character actually has, out of the
	// two races' data. It returns the same shape as a race item's system data, so everything that
	// reads a race reads this unchanged.
	//
	// Two numbers are taken from the first race only, as the schema holds one number where he
	// holds a pair: titleMax and titleMod. Nothing in the port reads either yet -- the title
	// Endurance roll (his setNewCharacteristics) is not ported -- and his pair is kept whole in
	// titleFormula/titleDice beside them, so the second race's figures are not lost.
	// @MARKER SLIGHT PHYSIQUE
	// This is the function which gives back a race as a character of slight build has it.
	//
	// Slight Physique is a CHOICE on his Roll20 sheet, not a consequence of gender. The original
	// rules applied it to every female of every race; he cut it loose when he built the sheet, so a
	// slighter male and a stronger female are both ordinary characters. He confirmed this on
	// 2026-09-20, which is what closed UPSTREAM-ISSUES item 38.
	//
	// For almost every race the choice is only -1 Strength and +1 Agility, which applyPhysique
	// handles on the ratings and which never touches the race. ONE race still carries a second
	// difference here, and it is a TRADE rather than a bonus:
	//     Gremlin   flies either way; the ORDINARY form gains Climb.
	//
	// Fairy, Fairy(Dark), Podling and Sporeling used to be the other four -- their slight form had
	// wings, and for the two Fairies the wingless form traded them for extra racial skills. As of
	// 2026-09-21 those four are no longer reached here: his sheet's wings-ARE-slight-physique
	// branch became a second dropdown, and the port turned each branch into a race document of its
	// own (`Fairy(Winged)`, `Fairy(Wingless)`, and so on) rather than a variant of one document.
	// See @MARKER RACE FORMS below, `resolvePhysiqueLock`, and DECISIONS.md 2026-09-21 "The races
	// he split with a second dropdown become races of their own". This block is not dead code --
	// a homebrew race may still declare a `slightPhysique` variant the same way Gremlin does -- but
	// Gremlin is now the only race the port itself ships one for.
	//
	// @MARKER RACE FORMS
	// This is the function which says whether a character's race decides their physique for them.
	//
	// Four faerie races are split into a winged form and a wingless one, because in his code the
	// wings ARE the slight-physique branch -- his slight branch sets "Fly:" where his ordinary one
	// sets "None:". Michael's call, 2026-09-21: they are one choice, not two. So a winged form
	// forces the tick on and a wingless form forces it off, and the generator stops offering it.
	//
	// Takes the race systems a character holds -- one, or the two halves of a Half Race, BEFORE
	// they are combined, since combining loses which document each half came from. Returns what the
	// tick must be, whether it is the character's to set, and why.
	//
	// A Half Race can hold one of each, and there is no answer that is not wrong for one parent.
	// That is REPORTED rather than refused, which is what the port already does with a barred class
	// and an infertile pair: the tick is left as the player set it and the header says so.
	export function resolvePhysiqueLock(tmpRaceSystems) {
		var tmpLocks = (tmpRaceSystems ?? []).filter(tmpSystem => tmpSystem)
			.map(tmpSystem => tmpSystem.physiqueLock ?? "")
			.filter(tmpLock => tmpLock);
		if (!tmpLocks.length) { return { locked: false, value: null, conflict: false, reason: "" }; }
		if (tmpLocks.includes("slight") && tmpLocks.includes("ordinary")) {
			return {
				locked: false, value: null, conflict: true,
				reason: "One of these races is winged and the other wingless, and the wings are the "
					+ "slight physique. Neither form can be right for both halves; the choice is "
					+ "left with you and the Game Master."
			};
		}
		var tmpIsSlight = tmpLocks[0] == "slight";
		return {
			locked: true, value: tmpIsSlight, conflict: false,
			reason: tmpIsSlight
				? "This race is the winged form, and its wings are its slight physique, so it is "
					+ "always of slight build (-1 Strength, +1 Agility)."
				: "This race is the wingless form. Wings are the slight physique for it, so it is "
					+ "never of slight build."
		};
	}

	// Returns the race untouched when it has no second form, so a caller may pass anything.
	export function applySlightPhysique(tmpRaceSystem, tmpIsSlight) {
		if (!tmpIsSlight || !tmpRaceSystem?.slightPhysique?.hasVariant) { return tmpRaceSystem; }
		var tmpVariant = tmpRaceSystem.slightPhysique;
		var tmpOut = { ...tmpRaceSystem };

		// Flight, where the two forms differ in it.
		tmpOut.movement = {
			...tmpRaceSystem.movement,
			specialName: tmpVariant.specialName,
			special: { ...tmpVariant.special }
		};
		tmpOut.canSwim = tmpVariant.canSwim;

		// The skills are carried only where they differ, so an empty list means "the same list",
		// not "no racial skills at all". Getting that backwards would silently strip a Podling of
		// all thirteen of its skills for ticking a box about its build.
		if ((tmpVariant.racialSkills ?? []).length) {
			tmpOut.racialSkills = tmpVariant.racialSkills.map(tmpSkill => ({ ...tmpSkill }));
		}
		return tmpOut;
	}

	// @MARKER FORMLESS
	// This is the function which says which of two races a character holds is the psyche and which
	// is the body, and whether the pair is a legal Formless at all.
	//
	// Returns the psyche and the host where exactly one race is formless, so a caller never has to
	// care which order the two items were dropped on the sheet in.
	export function readFormlessPair(tmpRaceSystems, tmpRaceNames) {
		var tmpSystems = (tmpRaceSystems ?? []).filter(tmpSystem => tmpSystem);
		var tmpNames = tmpRaceNames ?? [];
		var tmpFormlessAt = tmpSystems.map((tmpSystem, tmpIndex) => tmpSystem.formless ? tmpIndex : -1)
			.filter(tmpIndex => tmpIndex >= 0);
		if (!tmpFormlessAt.length) { return { isFormless: false }; }
		if (tmpFormlessAt.length > 1) {
			return { isFormless: true, psyche: tmpSystems[tmpFormlessAt[0]], host: null,
				issue: "A Formless cannot inhabit another Formless: neither has a body to lend." };
		}
		var tmpAt = tmpFormlessAt[0];
		var tmpOther = tmpSystems.filter((tmpSystem, tmpIndex) => tmpIndex != tmpAt);
		if (!tmpOther.length) {
			return { isFormless: true, psyche: tmpSystems[tmpAt], host: null,
				issue: "A Formless has no body of its own and needs a host race. Add the host's "
					+ "race item beside this one; until then the physical half of this character "
					+ "is blank." };
		}
		if (tmpOther.length > 1) {
			return { isFormless: true, psyche: tmpSystems[tmpAt], host: tmpOther[0],
				issue: "A Formless inhabits ONE host. The first of the other races is being used." };
		}
		var tmpHostName = (tmpNames.filter((tmpName, tmpIndex) => tmpIndex != tmpAt))[0] ?? "";
		var tmpAllowed = tmpSystems[tmpAt].formlessHosts ?? [];
		var tmpIssue = "";
		// Reported, never refused -- the call already made for a barred class and an infertile pair.
		if (tmpHostName && tmpAllowed.length && !tmpAllowed.includes(tmpHostName)) {
			tmpIssue = `A Formless cannot inhabit a ${tmpHostName}: it is not among the `
				+ `${tmpAllowed.length} races his sheet offers as a host.`;
		}
		return { isFormless: true, psyche: tmpSystems[tmpAt], host: tmpOther[0],
			hostName: tmpHostName, issue: tmpIssue };
	}

	// This is the function which builds the race a Formless character actually has, out of the
	// psyche and the body it wears. It returns the same shape as a race item's system data, so
	// everything that reads a race reads this unchanged -- as combineHalfRace does.
	//
	// IT IS NOT AN AVERAGE. A Half Race is two races blended; a Formless is two HALVES of one
	// character, and each half is taken whole:
	//
	//     from the HOST (setFormlessStartingRace, sheet-worker.js:34880)
	//         STR, AGL, VIT, APP, SOC -- modifiers and limits
	//         starting Endurance, Perception
	//         speed multiplier, walk/jog/run, special movement, both jumps, swimming
	//         the body chart, and the colours, because they are the body's
	//     from the PSYCHE (applySingleRaceToAttribs case "Formless", 33625)
	//         INT, WIS, KNW, CHM, AUR, PTY, WIL -- modifiers and limits
	//         the per-title Endurance roll, Affinity, Fortune, all five resistances
	//         its own racial skills -- "Formless have their own racial skills and do not get
	//         these from the host they inhabit" is his own comment at 4577
	//
	// The traits are the one thing that COMBINES rather than choosing: setFormlessRaceAbilities
	// (4576) prefixes its own with "FORMLESS: " and appends the host's after "HOST: ", so a
	// Formless keeps Superior Regeneration and its host's Infravision at once. The port keeps them
	// as two lists joined, since the sheet already shows each as its own chip.
	const FORMLESS_PHYSICAL = ["str", "agl", "vit", "app", "soc"];

	export function combineFormless(tmpPsyche, tmpHost) {
		if (!tmpHost) { return tmpPsyche; }

		var tmpMods = {};
		var tmpLimits = {};
		for (const tmpKey of Object.keys(tmpPsyche.attributeMods ?? {})) {
			var tmpFromHost = FORMLESS_PHYSICAL.includes(tmpKey);
			tmpMods[tmpKey] = (tmpFromHost ? tmpHost.attributeMods?.[tmpKey] : tmpPsyche.attributeMods?.[tmpKey]) ?? 0;
			tmpLimits[tmpKey] = (tmpFromHost ? tmpHost.attributeLimits?.[tmpKey] : tmpPsyche.attributeLimits?.[tmpKey]) ?? 20;
		}

		var tmpHostEnd = tmpHost.endurance ?? {};
		var tmpPsycheEnd = tmpPsyche.endurance ?? {};

		return {
			...tmpPsyche,
			attributeMods: tmpMods,
			attributeLimits: tmpLimits,
			endurance: {
				// The body decides what a character starts with; the psyche decides what each
				// title adds, which is why a Formless gains 1 a title whatever it is wearing.
				startFormula: tmpHostEnd.startFormula ?? "",
				startMod:     tmpHostEnd.startMod ?? 0,
				titleFormula: tmpPsycheEnd.titleFormula ?? "",
				titleDice:    tmpPsycheEnd.titleDice ?? "",
				titleMax:     tmpPsycheEnd.titleMax ?? 0,
				titleMod:     tmpPsycheEnd.titleMod ?? 0
			},
			characteristicMods: {
				perception: tmpHost.characteristicMods?.perception ?? 0,
				affinity:   tmpPsyche.characteristicMods?.affinity ?? 0,
				fortune:    tmpPsyche.characteristicMods?.fortune ?? 0
			},
			// All five are the psyche's: a Formless is immune to Control whatever it inhabits.
			resistanceMods: { ...(tmpPsyche.resistanceMods ?? {}) },
			movement: structuredClone(tmpHost.movement ?? {}),
			canSwim:  !!tmpHost.canSwim,
			bodyType: tmpHost.bodyType ?? "Humanoid",
			// The body's, because they describe the body.
			features: structuredClone(tmpHost.features ?? { hair: [], eyes: [], skin: [] }),
			// His own, never the host's (4577).
			racialSkills: (tmpPsyche.racialSkills ?? []).map(tmpSkill => ({ ...tmpSkill })),
			// The one thing that is both, in his order: FORMLESS first, then HOST.
			abilities:    [...(tmpPsyche.abilities ?? []), ...(tmpHost.abilities ?? [])],
			disabilities: [...(tmpPsyche.disabilities ?? []), ...(tmpHost.disabilities ?? [])],
			immunities:   [...(tmpPsyche.immunities ?? []), ...(tmpHost.immunities ?? [])],
			// Infertile is one of its own disabilities, so it breeds with nothing whatever it wears.
			fertileWith: [],
			formless: true
		};
	}

	export function combineHalfRace(tmpRace1, tmpRace2) {
		var tmpMove1 = tmpRace1.movement ?? {};
		var tmpMove2 = tmpRace2.movement ?? {};

		var tmpMovement = {
			speedMultiplier: averageTwoFloatsRounded(tmpMove1.speedMultiplier, tmpMove2.speedMultiplier),
			// his special movement always comes from the first race -- every branch of his
			// Fly/Gallop/Scurry/Swim switch reads tempRaceStatMoves1, and so does the fallback
			specialName: tmpMove1.specialName ?? "",
			special:     structuredClone(tmpMove1.special ?? {}),
			jumpStand:   averageTwoFloatsRounded(tmpMove1.jumpStand, tmpMove2.jumpStand),
			jumpUp:      averageTwoFloatsRounded(tmpMove1.jumpUp, tmpMove2.jumpUp)
		};
		for (const tmpMode of ["walk", "jog", "run"]) {
			tmpMovement[tmpMode] = averageEachKey(tmpMove1[tmpMode], tmpMove2[tmpMode]);
		}

		var tmpEnd1 = tmpRace1.endurance ?? {};
		var tmpEnd2 = tmpRace2.endurance ?? {};

		return {
			attributeMods:      averageEachKey(tmpRace1.attributeMods, tmpRace2.attributeMods),
			attributeLimits:    averageEachKey(tmpRace1.attributeLimits, tmpRace2.attributeLimits),
			endurance: {
				startFormula: pairFormulas(tmpEnd1.startFormula, tmpEnd2.startFormula),
				startMod:     averageTwoFloatsRounded(tmpEnd1.startMod, tmpEnd2.startMod),
				titleFormula: pairFormulas(tmpEnd1.titleFormula, tmpEnd2.titleFormula),
				titleDice:    pairFormulas(tmpEnd1.titleDice, tmpEnd2.titleDice),
				titleMax:     tmpEnd1.titleMax ?? 0,
				titleMod:     tmpEnd1.titleMod ?? 0
			},
			characteristicMods: averageEachKey(tmpRace1.characteristicMods, tmpRace2.characteristicMods),
			resistanceMods:     averageEachKey(tmpRace1.resistanceMods, tmpRace2.resistanceMods),
			movement:           tmpMovement,
			formless:           false,
			canSwim:            !!(tmpRace1.canSwim || tmpRace2.canSwim),
			// The body is the first race's. His half race keeps the first race's body type and
			// strips the second race's body-specific abilities to fit it (remove2ndRaceBodyAbilities,
			// sheet-worker.js:46254).
			bodyType:           tmpRace1.bodyType ?? "Humanoid",
			racialSkills:       mergeRacialSkills(tmpRace1.racialSkills, tmpRace2.racialSkills),
			racialSkillNote:    [tmpRace1.racialSkillNote, tmpRace2.racialSkillNote].filter(n => n).join("; "),
			abilities:          mergeNameLists(tmpRace1.abilities, tmpRace2.abilities),
			disabilities:       mergeNameLists(tmpRace1.disabilities, tmpRace2.disabilities),
			immunities:         mergeNameLists(tmpRace1.immunities, tmpRace2.immunities),
			// A half race's own children are not modelled; the first race's list is carried so
			// the field is never missing.
			fertileWith:        [...(tmpRace1.fertileWith ?? [])],
			// setAge: the lesser of each (sheet-worker.js:38986-38991). Apparent age, which he
			// averages, is entered on the sheet rather than derived, so there is nothing to combine.
			ages: {
				startLow:  lesserAge(tmpRace1.ages?.startLow ?? 0, tmpRace2.ages?.startLow ?? 0),
				startHigh: lesserAge(tmpRace1.ages?.startHigh ?? 0, tmpRace2.ages?.startHigh ?? 0),
				maxAge:    "" + lesserAge(tmpRace1.ages?.maxAge ?? "", tmpRace2.ages?.maxAge ?? "")
			},
			sourcebook:         "",
			page:               "",
			description:        ""
		};
	}

// @MARKER ADD NEW race rule functions HERE
// @END (CODE)
