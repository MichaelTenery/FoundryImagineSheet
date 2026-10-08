// @START (CODE)
// @MARKER CREATURE GENERATOR VIEW
//==================================================================================================================
// What each step of the creature generator shows, worked out from the generator's state and the
// content. No Foundry dependency, as chargen-view.mjs has none: the window
// (module/apps/creature-generator.mjs) and tools/creature-gen-test.html both call these.
//
// The state is plain data, one field per choice, null where "work it out for me". The steps follow
// the Master's Manual's Creature Creation Guide in its own order (pp.281-298):
//     0 Concept      name, type, subtype, habits, climate, habitat, alignment     (p.281)
//     1 Body         body type, height, frame, form -> weight -> size -> Endurance (pp.281-286)
//     2 Attributes   a band per attribute, each a PP cost                           (pp.285-286)
//     3 Combat       attack skill, hide, standard and bought attacks                (pp.286-287, 289-291)
//     4 Movement     the gaits by family, size and speed                            (pp.287-288)
//     5 Abilities    the five lists, skills and powers                              (pp.289-298)
//     6 Review       power points -> level, the experience value, and Create
//==================================================================================================================

import { CREATURE_TYPES, CREATURE_BODY_TYPES, CREATURE_ATTACK_CHARTS, CREATURE_SIZES } from "./creature-tables.mjs";
import { getCreatureAlignmentSuggestions } from "./alignment-rules.mjs";
import { CLIMATES, HABITATS, FRAMES, FORMS, ATTRIBUTE_GROUPS, HIDE_KINDS, SPEED_NAMES, EXP_SPECIALS,
	POWER_POINTS_PER_LEVEL } from "./creature-gen-tables.mjs";
import {
	getBodyFamily, getBaseWeightRow, getFrameMultiplier, getFormMultiplier, computeWeight,
	getSizeClass, getEnduranceRow, getTreeRow, listBands, suggestBands, resolveAttributes, getLevelAttributeCap,
	deriveResistances, readResistanceAbilities, getStandardAttacks, getBoughtAttacks, getAttackSkillPP, resolveHide,
	speedForAgilityBand, buildMovementModes, readGaitAbilities, listAbilitiesFor, priceAbilities, priceSkill,
	pricePower, levelFromPowerPoints, calcCreatureExp, readPoisonType, assembleCreature, rollDice
} from "./creature-gen-rules.mjs";

	export const STEPS = ["Concept", "Body", "Attributes", "Combat", "Movement", "Abilities", "Review"];

	// This is the function which gives a fresh generator its starting state.
	export function newCreatureGenState() {
		return {
			step: 0,
			// @MARKER CONCEPT
			name: "", creatureType: "", subtype: "", lifecycle: "", climate: "", habitat: "",
			alignment: "", tendencies: "", notes: "",
			// @MARKER BODY
			// baseWeight, weight and endurance are null until rolled or typed: null means "the book's
			// average", so the figures follow the height until the Game Master decides otherwise.
			bodyType: "Humanoid", heightFeet: 0, heightInches: 0,
			baseWeight: null, baseWeightNote: "", frame: "Medium", form: "Solid",
			weight: null, sizeOverride: "", endurance: null, enduranceNote: "",
			// @MARKER ATTRIBUTES
			// bands holds only the bands the Game Master has set; the rest are suggested from the size
			// and type each time. ratings holds typed figures (null: the band's average).
			bands: {}, ratings: {},
			// @MARKER COMBAT
			attackChart: "Beginner", hideKind: "None", hidePoints: 0, hideOverCap: false,
			standardAttacks: {}, boughtAttacks: [], attackNotes: "", shockImmune: false,
			// @MARKER MOVEMENT
			speedName: "", gaits: { gallop: false, fly: false, swim: false, hop: false }, movementModes: null,
			// @MARKER ABILITIES
			abilities: [], customAbilities: [], skills: [], powers: [],
			// @MARKER REVIEW
			levelOverride: null, expOverride: null, expSpecials: {}, poisonType: "", expNote: ""
		};
	}

	// This is the function which finds a compendium document by name, case and spacing aside.
	function findByName(tmpDocs, tmpName) {
		var tmpWanted = cleanName(tmpName);
		if (!tmpWanted) { return null; }
		return (tmpDocs ?? []).find(tmpDoc => cleanName(tmpDoc.name) == tmpWanted
			|| cleanName(tmpDoc.system?.canonicalName) == tmpWanted) ?? null;
	}
	function cleanName(tmpName) {
		return String(tmpName ?? "").toLowerCase().replace(/[\s()\/,.-]+/g, "");
	}

	// This is the function which finds a trait in the packs by name and category: the exact name first,
	// then his own spellings ("Fangs(Large)" for "Fangs (Large)", "Hide(Fur)"), then the name with its
	// bracket turned round ("Claws (Large)" -> "Claws(Large)" is covered by cleanName; "Fangs Large" too).
	export function findTrait(tmpTraits, tmpName, tmpCategory) {
		var tmpPool = (tmpTraits ?? []).filter(tmpDoc => !tmpCategory || tmpDoc.system?.category == tmpCategory);
		return findByName(tmpPool, tmpName) ?? findByName(tmpTraits, tmpName);
	}

	// @MARKER DERIVATION
	// This is the function which works out the whole design from the state: every figure the steps show
	// and everything assembleCreature needs. tmpContent is { skills, spells, invocations, traits }, each
	// a list of plain documents (toObject()), any of them empty.
	export function deriveCreatureDesign(tmpState, tmpContent) {
		var tmpC = tmpContent ?? {};
		var tmpD = { issues: [] };

		// -- body, weight, size, endurance --
		tmpD.family = getBodyFamily(tmpState.bodyType);
		tmpD.isTree = tmpState.bodyType == "Tree";
		tmpD.inches = (parseInt(tmpState.heightFeet) || 0) * 12 + (parseInt(tmpState.heightInches) || 0);
		tmpD.frameMultiplier = getFrameMultiplier(tmpState.frame);
		tmpD.formMultiplier = getFormMultiplier(tmpState.form);
		if (tmpD.isTree) {
			tmpD.tree = getTreeRow(tmpD.inches / 12);
			tmpD.baseWeightRow = { dice: "", low: tmpD.tree.weight, high: tmpD.tree.weight, beyond: false };
			tmpD.baseWeight = tmpState.baseWeight ?? tmpD.tree.weight;
			tmpD.weightComputed = computeWeight(tmpD.baseWeight, 1, tmpD.frameMultiplier, tmpD.formMultiplier);
		} else {
			tmpD.baseWeightRow = getBaseWeightRow(tmpD.inches);
			tmpD.baseWeight = tmpState.baseWeight ?? Math.round((tmpD.baseWeightRow.low + tmpD.baseWeightRow.high) / 2);
			tmpD.weightComputed = computeWeight(tmpD.baseWeight, tmpD.family.weight, tmpD.frameMultiplier, tmpD.formMultiplier);
		}
		tmpD.weight = tmpState.weight ?? tmpD.weightComputed;
		// A tree's size is read off the animal table ("To determine size category, use the animal
		// weights table above", MM p.285).
		tmpD.sizeClass = getSizeClass(tmpD.weight, tmpD.isTree ? "animal" : tmpD.family.kind);
		tmpD.size = tmpState.sizeOverride || tmpD.sizeClass.size;
		if (tmpD.isTree) {
			tmpD.enduranceRow = { dice: tmpD.tree.dice, average: Math.round((tmpD.tree.low + tmpD.tree.high) / 2), baseLevel: tmpD.tree.baseLevel, example: `${tmpD.tree.height}' tree` };
		} else {
			tmpD.enduranceRow = getEnduranceRow(tmpD.size, tmpD.family.kind);
		}
		tmpD.endurance = tmpState.endurance ?? tmpD.enduranceRow.average;
		tmpD.baseLevel = tmpD.enduranceRow.baseLevel;

		// -- attributes --
		tmpD.suggestedBands = suggestBands(tmpD.size, tmpState.creatureType);
		tmpD.bands = { ...tmpD.suggestedBands, ...(tmpState.bands ?? {}) };
		tmpD.attributes = resolveAttributes(tmpD.bands, tmpState.ratings);
		tmpD.ratings = tmpD.attributes.ratings;

		// -- abilities, and what they bring --
		tmpD.abilityLists = listAbilitiesFor(tmpState.creatureType);
		var tmpPicks = (tmpState.abilities ?? []).concat((tmpState.customAbilities ?? []).map(tmpRow => ({ ...tmpRow, custom: true })));
		tmpD.abilities = priceAbilities(tmpPicks);
		var tmpResistAbilities = readResistanceAbilities(tmpD.abilities.rows);
		tmpD.resistances = deriveResistances(tmpD.ratings, tmpResistAbilities.enhancements, tmpResistAbilities.immune);
		tmpD.gaits = { ...readGaitAbilities(tmpD.abilities.rows) };
		for (const [tmpKey, tmpOn] of Object.entries(tmpState.gaits ?? {})) { if (tmpOn) { tmpD.gaits[tmpKey] = true; } }
		tmpD.immunityCount = tmpD.abilities.rows.filter(tmpRow => tmpRow.list == "immunity").length;

		// -- combat --
		tmpD.attackSkillPP = getAttackSkillPP(tmpState.attackChart);
		tmpD.standardAttacks = getStandardAttacks(tmpD.size).map(tmpRow => {
			var tmpChosen = tmpState.standardAttacks?.[tmpRow.name] ?? "";
			return { ...tmpRow, chosen: tmpChosen, taken: !!tmpChosen };
		});
		tmpD.boughtCatalog = getBoughtAttacks(tmpD.size);
		tmpD.boughtAttacks = (tmpState.boughtAttacks ?? []).map((tmpPick, tmpIndex) => {
			var tmpRow = tmpD.boughtCatalog.find(tmpOne => tmpOne.name == tmpPick.name);
			if (!tmpRow) { return null; }
			var tmpCount = Math.max(1, parseInt(tmpPick.count) || 1);
			var tmpDamage = tmpPick.damage || tmpRow.choices[0]?.value || "";
			return { index: tmpIndex, name: tmpRow.name, count: tmpCount, damage: tmpDamage, choices: tmpRow.choices,
				pp: tmpRow.pp * tmpCount, speed: tmpRow.speed, minSpeed: tmpRow.minSpeed, damageType: tmpRow.damageType,
				attackType: tmpRow.attackType, note: tmpRow.note };
		}).filter(tmpRow => tmpRow);
		tmpD.attacksPP = tmpD.boughtAttacks.reduce((tmpSum, tmpRow) => tmpSum + tmpRow.pp, 0);

		// -- skills and powers --
		tmpD.skills = (tmpState.skills ?? []).map((tmpPick, tmpIndex) => {
			var tmpDoc = findByName(tmpC.skills, tmpPick.name);
			var tmpPrice = priceSkill(tmpPick, tmpDoc);
			return { index: tmpIndex, name: tmpPick.name, chance: parseInt(tmpPick.chance) || 0, pp: tmpPrice.pp, known: tmpPrice.known,
				rating: tmpPrice.rating, base: tmpPrice.base, social: tmpDoc?.system?.category == "social",
				counted: !!tmpDoc && tmpDoc.system?.category != "social", typedPP: parseInt(tmpPick.pp) || 0 };
		});
		tmpD.skillsPP = tmpD.skills.reduce((tmpSum, tmpRow) => tmpSum + tmpRow.pp, 0);
		tmpD.powers = (tmpState.powers ?? []).map((tmpPick, tmpIndex) => {
			var tmpSpell = findByName(tmpC.spells, tmpPick.name);
			var tmpInvocation = tmpSpell ? null : findByName(tmpC.invocations, tmpPick.name);
			var tmpPrice = pricePower(tmpPick, tmpSpell, tmpInvocation);
			return { index: tmpIndex, name: tmpPick.name, uses: Math.max(1, parseInt(tmpPick.uses) || 1), atWill: !!tmpPick.atWill,
				level: tmpPrice.level, pp: tmpPrice.pp, known: tmpPrice.known, kind: tmpPrice.kind, typedLevel: parseInt(tmpPick.level) || 0 };
		});
		tmpD.powersPP = tmpD.powers.reduce((tmpSum, tmpRow) => tmpSum + tmpRow.pp, 0);

		// -- hide and level, which lean on each other: the hide's PP count towards the level, and the
		//    errata caps the hide by the level. Worked once without the hide, then again with it. --
		var tmpWithoutHide = tmpD.attributes.pp + tmpD.attackSkillPP + tmpD.attacksPP + tmpD.abilities.pp + tmpD.skillsPP + tmpD.powersPP;
		var tmpProvisional = tmpState.levelOverride ?? levelFromPowerPoints(tmpD.baseLevel, tmpWithoutHide).level;
		tmpD.hide = resolveHide(tmpState.hideKind, tmpState.hidePoints, tmpD.endurance, tmpProvisional, tmpState.creatureType, tmpD.size, tmpState.hideOverCap);
		var tmpTotal = tmpWithoutHide + tmpD.hide.pp;
		tmpD.levelAuto = levelFromPowerPoints(tmpD.baseLevel, tmpTotal);
		tmpD.levelOverridden = tmpState.levelOverride !== null && tmpState.levelOverride !== undefined && tmpState.levelOverride !== "";
		tmpD.level = tmpD.levelOverridden ? (parseInt(tmpState.levelOverride) || 0) : tmpD.levelAuto.level;
		if (tmpD.level != tmpProvisional) {
			tmpD.hide = resolveHide(tmpState.hideKind, tmpState.hidePoints, tmpD.endurance, tmpD.level, tmpState.creatureType, tmpD.size, tmpState.hideOverCap);
			tmpTotal = tmpWithoutHide + tmpD.hide.pp;
			if (!tmpD.levelOverridden) { tmpD.levelAuto = levelFromPowerPoints(tmpD.baseLevel, tmpTotal); tmpD.level = tmpD.levelAuto.level; }
		}
		tmpD.powerPoints = { attributes: tmpD.attributes.pp, attackSkill: tmpD.attackSkillPP, attacks: tmpD.attacksPP, hide: tmpD.hide.pp,
			abilities: tmpD.abilities.pp, skills: tmpD.skillsPP, powers: tmpD.powersPP, total: tmpTotal, perLevel: POWER_POINTS_PER_LEVEL };
		tmpD.attributeCap = getLevelAttributeCap(tmpD.level);
		tmpD.overCap = tmpD.attributes.rows.filter(tmpRow => tmpRow.rating > tmpD.attributeCap).map(tmpRow => tmpRow.label);

		// -- movement --
		tmpD.speedName = tmpState.speedName || speedForAgilityBand(tmpD.bands.agl);
		tmpD.movementAuto = buildMovementModes(tmpD.family, tmpD.size, tmpD.speedName, tmpD.gaits);
		tmpD.movementModes = tmpState.movementModes ?? tmpD.movementAuto;
		tmpD.movementEdited = Array.isArray(tmpState.movementModes);

		// -- attacks for the actor --
		tmpD.attacks = tmpD.standardAttacks.filter(tmpRow => tmpRow.taken).map(tmpRow => ({
			name: tmpRow.name, damage: tmpRow.chosen, damageType: tmpRow.damageType, attackType: tmpRow.attackType, speed: 3, minSpeed: 0,
			note: "A standard attack of the body (Master's Manual p.287)." }));
		for (const tmpRow of tmpD.boughtAttacks) {
			for (var tmpi = 0; tmpi < tmpRow.count; tmpi++) {
				tmpD.attacks.push({ name: tmpRow.name + (tmpRow.count > 1 ? ` ${tmpi + 1}` : ""), damage: tmpRow.damage, damageType: tmpRow.damageType,
					attackType: tmpRow.attackType, speed: tmpRow.speed, minSpeed: tmpRow.minSpeed, note: tmpRow.note });
			}
		}

		// -- experience --
		tmpD.poisonType = readPoisonType(tmpState.poisonType);
		tmpD.exp = calcCreatureExp({
			level: tmpD.level, ratings: tmpD.ratings, endurance: tmpD.endurance, resistances: tmpD.resistances,
			skills: tmpD.skills, powerLevels: tmpD.powers.map(tmpRow => tmpRow.level), specials: tmpState.expSpecials ?? {},
			poisonType: tmpD.poisonType, hide: tmpD.hide.points, immunityCount: tmpD.immunityCount
		});
		tmpD.expOverridden = tmpState.expOverride !== null && tmpState.expOverride !== undefined && tmpState.expOverride !== "";
		tmpD.expValue = tmpD.expOverridden ? (parseInt(tmpState.expOverride) || 0) : tmpD.exp.total;

		// -- what to say --
		if (!tmpState.creatureType) { tmpD.issues.push("No creature type chosen."); }
		if (tmpD.baseWeightRow.beyond) { tmpD.issues.push("Over 100 feet: the book gives no base weight beyond 100,000 lb. Enter the weight."); }
		for (const tmpRow of tmpD.attributes.rows) {
			if (tmpRow.outside) { tmpD.issues.push(`${tmpRow.label} ${tmpRow.rating} is outside its ${tmpRow.band} band (${tmpRow.low}-${tmpRow.high}).`); }
		}
		if (tmpD.overCap.length) { tmpD.issues.push(`Above the level ${tmpD.level} maximum of ${tmpD.attributeCap}: ${tmpD.overCap.join(", ")}. The sheet will hold them to it.`); }
		if (tmpD.hide.overCap) {
			tmpD.issues.push(tmpState.hideOverCap
				? `Hide ${tmpD.hide.points} is above the errata's cap of ${tmpD.hide.errataMax} (5 per level) and is being allowed.`
				: `Hide was held to the errata's cap of ${tmpD.hide.errataMax} (5 per level, level 0 counting as 1).`);
		}
		if (tmpD.hide.overKind && !tmpD.hide.overCap && !tmpState.hideOverCap) {
			tmpD.issues.push(`${tmpD.hide.kind} gives at most ${tmpD.hide.kindMax} hide at ${tmpD.endurance} Endurance; held to it.`);
		}
		for (const tmpRow of tmpD.skills) { if (!tmpRow.known) { tmpD.issues.push(`The skill "${tmpRow.name}" is not in the compendium; priced at the PP typed.`); } }
		for (const tmpRow of tmpD.powers) { if (!tmpRow.known) { tmpD.issues.push(`The power "${tmpRow.name}" is neither a spell nor an invocation in the compendium; priced at the level typed.`); } }
		if (tmpD.family.walk == "" && !tmpD.movementEdited) { tmpD.issues.push("This body has no movement table in the book; add its movement by hand if it moves."); }
		return tmpD;
	}

	// @MARKER STEP CHECKS
	// This is the function which says what stops the current step being left, or "" if nothing does.
	export function checkStep(tmpState, tmpDerived) {
		switch (STEPS[tmpState.step]) {
			case "Concept":
				if (!tmpState.name?.trim()) { return "Give the creature a name."; }
				if (!tmpState.creatureType) { return "Choose a creature type."; }
				return "";
			case "Body":
				if (!tmpState.bodyType) { return "Choose a body type."; }
				if (tmpDerived.inches <= 0 && tmpState.weight === null) { return "Enter a height or length, or a weight."; }
				if (tmpDerived.baseWeightRow.beyond && tmpState.weight === null) { return "Over 100 feet the book gives no weight: enter one."; }
				return "";
			default:
				return "";
		}
	}

	// @MARKER VIEW
	// This is the function which builds what the template shows for the current step.
	export function buildCreatureGenView(tmpState, tmpContent) {
		var tmpD = deriveCreatureDesign(tmpState, tmpContent);
		var tmpStepName = STEPS[tmpState.step];
		var tmpOption = (tmpValue, tmpLabel, tmpSelected, tmpExtra) => ({ value: tmpValue, label: tmpLabel,
			selected: tmpValue == tmpSelected, ...(tmpExtra ?? {}) });
		var tmpView = {
			state: tmpState,
			steps: STEPS.map((tmpName, tmpIndex) => ({ name: tmpName, index: tmpIndex, current: tmpIndex == tmpState.step, done: tmpIndex < tmpState.step })),
			stepName: tmpStepName,
			isFirst: tmpState.step == 0,
			isLast: tmpState.step == STEPS.length - 1,
			blocker: checkStep(tmpState, tmpD),
			["is" + tmpStepName]: true,
			summary: `${tmpState.name || "New creature"}: ${tmpD.size} ${tmpState.creatureType || "creature"}, level ${tmpD.level}, ${tmpD.powerPoints.total} PP`
		};

		// @MARKER CONCEPT
		tmpView.typeOptions = [tmpOption("", "-- choose --", tmpState.creatureType)]
			.concat(CREATURE_TYPES.map(tmpName => tmpOption(tmpName, tmpName, tmpState.creatureType)));
		tmpView.climates = CLIMATES;
		tmpView.habitats = HABITATS;
		// His creature header's own suggestion lists (the sheet's datalists), custom alignments included.
		var tmpSuggestions = getCreatureAlignmentSuggestions(tmpContent?.customAlignments ?? null);
		tmpView.alignments = tmpSuggestions.alignments ?? [];
		tmpView.tendencies = tmpSuggestions.tendencies ?? [];

		// @MARKER BODY
		tmpView.bodyTypeOptions = CREATURE_BODY_TYPES.map(tmpName => tmpOption(tmpName, tmpName, tmpState.bodyType));
		tmpView.frameOptions = FRAMES.map(tmpRow => tmpOption(tmpRow[0], `${tmpRow[0]} (x${tmpRow[1]})${tmpRow[2] ? " -- " + tmpRow[2] : ""}`, tmpState.frame));
		tmpView.formOptions = FORMS.map(tmpRow => tmpOption(tmpRow[0], `${tmpRow[0]} (x${tmpRow[1]})${tmpRow[2] ? " -- " + tmpRow[2] : ""}`, tmpState.form));
		tmpView.sizeOptions = [tmpOption("", `By weight: ${tmpD.sizeClass.size}`, tmpState.sizeOverride)]
			.concat(["Minuscule"].concat(CREATURE_SIZES).map(tmpName => tmpOption(tmpName, tmpName, tmpState.sizeOverride)));
		tmpView.body = {
			family: tmpD.family, isTree: tmpD.isTree, tree: tmpD.tree,
			baseWeightRow: tmpD.baseWeightRow, baseWeight: tmpD.baseWeight, baseWeightIsAverage: tmpState.baseWeight === null,
			baseWeightNote: tmpState.baseWeightNote,
			frameMultiplier: tmpD.frameMultiplier, formMultiplier: tmpD.formMultiplier,
			weightComputed: tmpD.weightComputed, weight: tmpD.weight, weightOverridden: tmpState.weight !== null,
			size: tmpD.size, sizeExample: tmpD.sizeClass.example, sizeOverridden: !!tmpState.sizeOverride,
			enduranceRow: tmpD.enduranceRow, endurance: tmpD.endurance, enduranceIsAverage: tmpState.endurance === null,
			enduranceNote: tmpState.enduranceNote, baseLevel: tmpD.baseLevel
		};

		// @MARKER ATTRIBUTES
		tmpView.attributeRows = tmpD.attributes.rows.map(tmpRow => ({
			...tmpRow,
			typed: tmpState.ratings?.[tmpRow.key] ?? "",
			suggested: tmpD.suggestedBands[tmpRow.key],
			bandOptions: listBands(tmpRow.group).map(tmpBand => tmpOption(tmpBand.name,
				`${tmpBand.name} (${tmpBand.low}-${tmpBand.high}, ${tmpBand.pp} PP)`, tmpRow.band)),
			overCap: tmpRow.rating > tmpD.attributeCap
		}));
		tmpView.attributesPP = tmpD.attributes.pp;
		tmpView.attributeCap = tmpD.attributeCap;
		tmpView.resistances = ["magic", "illusion", "control", "poison", "disease"].map(tmpKey => ({
			key: tmpKey, label: tmpKey.charAt(0).toUpperCase() + tmpKey.slice(1), ...tmpD.resistances[tmpKey] }));

		// @MARKER COMBAT
		tmpView.attackChartOptions = CREATURE_ATTACK_CHARTS.map(tmpName => tmpOption(tmpName, `${tmpName} (${getAttackSkillPP(tmpName)} PP)`, tmpState.attackChart));
		tmpView.hideKindOptions = Object.entries(HIDE_KINDS).map(([tmpName, tmpRow]) => tmpOption(tmpName,
			tmpName == "None" ? "None" : `${tmpName} -- ${tmpRow[3]}`, tmpState.hideKind));
		tmpView.hide = tmpD.hide;
		tmpView.standardAttacks = tmpD.standardAttacks.map(tmpRow => ({
			...tmpRow,
			options: [tmpOption("", "-- not taken --", tmpRow.chosen)].concat(tmpRow.choices.map(tmpChoice => tmpOption(tmpChoice.value, tmpChoice.label, tmpRow.chosen)))
		}));
		tmpView.boughtCatalogOptions = tmpD.boughtCatalog.map(tmpRow => tmpOption(tmpRow.name,
			`${tmpRow.name} (${tmpRow.pp} PP${tmpRow.choices.length ? ", " + tmpRow.choices.map(tmpChoice => tmpChoice.label).join(" or ") : ""})`, ""));
		tmpView.boughtAttacks = tmpD.boughtAttacks.map(tmpRow => ({
			...tmpRow,
			damageOptions: tmpRow.choices.map(tmpChoice => tmpOption(tmpChoice.value, tmpChoice.label, tmpRow.damage))
		}));
		tmpView.attacksPP = tmpD.attacksPP;
		tmpView.attackSkillPP = tmpD.attackSkillPP;

		// @MARKER MOVEMENT
		tmpView.speedOptions = [tmpOption("", `From Agility: ${speedForAgilityBand(tmpD.bands.agl)}`, tmpState.speedName)]
			.concat(SPEED_NAMES.map(tmpName => tmpOption(tmpName, tmpName, tmpState.speedName)));
		tmpView.movement = { family: tmpD.family, speedName: tmpD.speedName, gaits: tmpD.gaits, modes: tmpD.movementModes,
			edited: tmpD.movementEdited, hasTable: tmpD.family.walk != "" };

		// @MARKER ABILITIES
		var tmpListLabels = { animal: "Animal abilities", plant: "Plant abilities", mplant: "Magical plant abilities",
			magical: "Magical abilities", disability: "Disabilities (a gain of PP)", immunity: "Immunities" };
		tmpView.abilityGroups = Object.entries(tmpD.abilityLists).filter(([, tmpRows]) => tmpRows.length).map(([tmpList, tmpRows]) => ({
			list: tmpList, label: tmpListLabels[tmpList],
			// The value carries the list as well as the name ("immunity|Insanity"), since a name can be on two lists.
			options: tmpRows.map(tmpRow => tmpOption(`${tmpList}|${tmpRow.name}`, `${tmpRow.name} (${tmpRow.pp} PP${tmpRow.unit ? " per " + tmpRow.unit : ""})`, ""))
		}));
		// One list, the chosen abilities first and the Game Master's own after, as the window's remove
		// handler expects; a custom row also carries its place in customAbilities for its PP box.
		var tmpChosenCount = (tmpState.abilities ?? []).length;
		tmpView.abilityRows = tmpD.abilities.rows.map((tmpRow, tmpIndex) => ({ ...tmpRow, index: tmpIndex,
			customIndex: tmpIndex >= tmpChosenCount ? tmpIndex - tmpChosenCount : null,
			listLabel: tmpListLabels[tmpRow.list] ?? tmpRow.list }));
		tmpView.customListOptions = Object.entries(tmpListLabels).map(([tmpList, tmpLabel]) => tmpOption(tmpList, tmpLabel, "animal"));
		tmpView.abilitiesPP = tmpD.abilities.pp;
		tmpView.skills = tmpD.skills;
		tmpView.skillsPP = tmpD.skillsPP;
		tmpView.skillNames = (tmpContent?.skills ?? []).map(tmpDoc => tmpDoc.name).sort();
		tmpView.powers = tmpD.powers;
		tmpView.powersPP = tmpD.powersPP;
		tmpView.powerNames = (tmpContent?.spells ?? []).concat(tmpContent?.invocations ?? []).map(tmpDoc => tmpDoc.name).sort();

		// @MARKER REVIEW
		tmpView.powerPoints = tmpD.powerPoints;
		tmpView.level = tmpD.level;
		tmpView.levelAuto = tmpD.levelAuto;
		tmpView.levelOverridden = tmpD.levelOverridden;
		tmpView.baseLevel = tmpD.baseLevel;
		tmpView.exp = tmpD.exp;
		tmpView.expValue = tmpD.expValue;
		tmpView.expOverridden = tmpD.expOverridden;
		tmpView.expSpecials = Object.entries(EXP_SPECIALS).map(([tmpKey, [tmpShare, tmpLabel]]) => ({
			key: tmpKey, label: tmpLabel, share: tmpShare, checked: !!tmpState.expSpecials?.[tmpKey] }));
		tmpView.attacks = tmpD.attacks;
		tmpView.issues = tmpD.issues;
		tmpView.derived = tmpD;
		return tmpView;
	}

	// @MARKER ASSEMBLY
	// This is the function which turns the state into the actor and items, through deriveCreatureDesign
	// and assembleCreature. tmpContent as for the view; the traits are looked up by name.
	export function assembleFromState(tmpState, tmpContent) {
		var tmpD = deriveCreatureDesign(tmpState, tmpContent);
		var tmpDesign = {
			name: tmpState.name, creatureType: tmpState.creatureType, subtype: tmpState.subtype, lifecycle: tmpState.lifecycle,
			climate: tmpState.climate, habitat: tmpState.habitat, alignment: tmpState.alignment, tendencies: tmpState.tendencies,
			notes: tmpState.notes, size: tmpD.size, level: tmpD.level, levelOverridden: tmpD.levelOverridden, baseLevel: tmpD.baseLevel,
			powerPoints: tmpD.powerPoints, expValue: tmpD.expValue,
			expNote: tmpState.expNote || (tmpD.expOverridden ? "set by hand" : `by his creature experience table at level ${tmpD.level}`),
			ratings: tmpD.ratings, endurance: tmpD.endurance, shockImmune: !!tmpState.shockImmune, resistances: tmpD.resistances,
			bodyType: tmpState.bodyType, hide: tmpD.hide.points, hideKind: tmpState.hideKind,
			heightFeet: tmpState.heightFeet, heightInches: tmpState.heightInches, weight: tmpD.weight,
			movementModes: tmpD.movementModes, skills: tmpD.skills, attackChart: tmpState.attackChart, attackNotes: tmpState.attackNotes,
			attacks: tmpD.attacks, abilityRows: tmpD.abilities.rows, powers: tmpD.powers
		};
		var tmpLookup = {
			trait: (tmpName, tmpCategory) => findTrait(tmpContent?.traits, tmpName, tmpCategory),
			skill: (tmpName) => findByName(tmpContent?.skills, tmpName),
			spell: (tmpName) => findByName(tmpContent?.spells, tmpName),
			invocation: (tmpName) => findByName(tmpContent?.invocations, tmpName)
		};
		return assembleCreature(tmpDesign, tmpLookup);
	}

	// This is the function which gives the Endurance dice to roll for the current design, so the window
	// can roll what the book says for this size.
	export function enduranceDiceFor(tmpState, tmpContent) {
		return deriveCreatureDesign(tmpState, tmpContent).enduranceRow.dice;
	}

	// This is the function which rolls every attribute from its band, through tmpRoll(sides).
	export function rollAllAttributes(tmpState, tmpContent, tmpRoll) {
		var tmpD = deriveCreatureDesign(tmpState, tmpContent);
		var tmpOut = {};
		for (const tmpRow of tmpD.attributes.rows) {
			tmpOut[tmpRow.key] = rollBand(tmpRow.dice, tmpRoll);
		}
		return tmpOut;
	}
	// A band with dice "0" (N/A) rolls 0; nothing rolls outside 0-30.
	function rollBand(tmpDice, tmpRoll) {
		return tmpDice == "0" ? 0 : Math.max(0, Math.min(30, rollDice(tmpDice, tmpRoll)));
	}

// @MARKER ADD NEW creature generator view functions HERE
// @END (CODE)
