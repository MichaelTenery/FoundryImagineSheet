// @START (CODE)
// @MARKER WEAPON CUSTOMIZATION RULES
//==================================================================================================================
// What can be done to a weapon, and what it then does in a fight, with no Foundry dependency so it can
// be tested outside it. The window is module/apps/weapon-mods.mjs; the attack reads this through
// getWeaponAttackExtras and resolveWeaponSpecials (module/combat/attack.mjs).
//
// TWO KINDS OF THING, KEPT APART.
//
//     PERMANENT   his Equipment tab's CUSTOMIZE ITEMS panel (sheet HTML, "START ITEM CUSTOMIZATION";
//                 customizeItem, sheet-worker.js:78903): condition, quality, a magical plus, a base
//                 Aura, magical abilities, runes with a level, energy, divine abilities with a base
//                 Piety Control, physical customizations (Serrated, Silvering...), and any spell or
//                 invocation imbued. His panel writes each as a bracketed tag into the item's NAME
//                 and his attack reads the tags back out; the port keeps them as fields, so a
//                 customized Long Sword is still called Long Sword and still matches the lore lists.
//
//     TEMPORARY   something done to a weapon for a while and then gone. His sheet has none -- the
//                 table's answer was a second, customized copy of the weapon, used while it mattered.
//                 The one the rules name is Bless (Player's Guide, Bless skill, "Holy Weapon"):
//                 +1 to hit and +1 damage in a good being's hands, -1 and -1 in an evil being's,
//                 for one day. A Game Master's own (an oil, a spell's edge) are the same shape.
//
// A PERMANENT BLESSING is his panel's "Blessed" magical choice, and the same Player's Guide rule
// made to last by the blesser giving up a point of Will Force. In his numbers it is +0 -- his
// getItemPlus never reads "Blessed" -- so the port applies the book's holy-weapon figures to it,
// as it does to the temporary kind. Blessed and a +N are one or the other, as his panel has them.
//
// NUMBERS FOLLOW HIS ATTACK CODE, with one correction taken from his own prose. A rune on the
// weapon gives +level to hit (only +1 if the weapon already has a magical to-hit, his "Rune + to
// hit can only stack 1 with magic +") and, by his rune dictionary and by the tag his own panel
// writes, "+level d6 + level" damage. His damage code instead adds level dice of the WEAPON'S die,
// and adds the flat +level only in verbose mode. The dictionary and the tag agree with each other
// and the Player's Guide, so they are taken as what he meant; UPSTREAM-ISSUES.
//==================================================================================================================

import { WEAPON_CUSTOMIZATION_RULES, ENERGY_DICE, PLUS_FROM_AURA, PLUS_FROM_PIETY, ABILITY_MODES, RUNE_MODES,
         DIVINE_BRAND_DICE, DIVINE_ENERGY_LABELS, REBUKE_STROKES, WEAPON_LISTING_CHANGES,
         MAGIC_PLUS_LISTING } from "./weapon-custom-tables.mjs";

	// @MARKER DICE
	// This is the function which rolls a plain dice string -- "2d6+3", "0d6+2" (which is 2), "4d4".
	export function rollCustomDice(tmpExpression, tmpRoll) {
		var tmpMatch = ("" + (tmpExpression ?? "")).replace(/\s+/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
		if (!tmpMatch) { return 0; }
		var tmpTotal = 0;
		for (var i = 0; i < parseInt(tmpMatch[1]); i++) { tmpTotal += tmpRoll(parseInt(tmpMatch[2])); }
		return tmpTotal + (parseInt(tmpMatch[3] ?? "0") || 0);
	}

	// This is the function which counts the dice in a damage string -- his getNumberOfDice. A flat
	// damage ("1", "3") has none.
	export function countDice(tmpDamage) {
		var tmpMatch = ("" + (tmpDamage ?? "")).match(/^\s*(\d+)d\d+/i);
		return tmpMatch ? parseInt(tmpMatch[1]) : 0;
	}


	// @MARKER WHICH WEAPONS TAKE WHICH CUSTOMIZATION
	// This is the function which says whether a physical customization suits a weapon -- his
	// checkWeaponCustomization (sheet-worker.js:81496). Returns { ok, reason }.
	//
	//   tmpWeapon   { name, system } -- system.type is his weapon type, system.material his material,
	//               system.speed his weapon's speed (his row's column 2, the maximum)
	export function checkWeaponCustomization(tmpWeapon, tmpCustomization) {
		var tmpRule = WEAPON_CUSTOMIZATION_RULES[tmpCustomization];
		if (!tmpRule) { return { ok: false, reason: `${tmpCustomization} is not one of his weapon customizations.` }; }
		var tmpSystem = tmpWeapon?.system ?? {};
		if (!tmpSystem.type) { return { ok: false, reason: "Only a weapon can be customized this way." }; }
		if (tmpRule.any) { return { ok: true, reason: "" }; }
		if (tmpRule.types && !tmpRule.types.includes(tmpSystem.type)) {
			return { ok: false, reason: `${tmpCustomization} is for a ${tmpRule.types.join(" or ")} weapon; this is a ${tmpSystem.type}.` };
		}
		if (tmpRule.materials && !tmpRule.materials.includes(tmpSystem.material)) {
			return { ok: false, reason: `${tmpCustomization} needs a ${tmpRule.materials.join(" or ")} weapon.` };
		}
		if (tmpRule.nameIncludes && !tmpRule.nameIncludes.some(tmpPart => ("" + tmpWeapon.name).toLowerCase().includes(tmpPart))) {
			return { ok: false, reason: `${tmpCustomization} is for a ${tmpRule.nameIncludes.join(" or ")}.` };
		}
		if (tmpRule.speedAbove !== undefined) {
			var tmpSpeed = parseInt(tmpSystem.speed) || 0;
			if (!(tmpSpeed > tmpRule.speedAbove && tmpSpeed < tmpRule.speedBelow)) {
				return { ok: false, reason: `${tmpCustomization} is for a weapon of speed ${tmpRule.speedAbove + 1} to ${tmpRule.speedBelow - 1}.` };
			}
		}
		return { ok: true, reason: "" };
	}


	// @MARKER THE PLUS
	// This is the function which works out a weapon's magical plus after a magical or divine ability
	// is put on it -- his updateMagicPlus (sheet-worker.js:81461). Accuracy, Piercing, Sharpness and
	// Disruption are worth +1 per 5 base Aura, and the ten brands and Divine Weapon +1 per 5 base Piety
	// Control; on a weapon that already has a plus, either simply adds one to it.
	export function updateMagicPlus(tmpCurrentPlus, tmpMagicAbility, tmpBaseAura, tmpDivineAbility, tmpBasePiety) {
		var tmpPlus = parseInt(tmpCurrentPlus) || 0;
		if (PLUS_FROM_AURA.includes(tmpMagicAbility)) {
			return tmpPlus == 0 ? Math.floor((parseInt(tmpBaseAura) || 0) / 5) : tmpPlus + 1;
		}
		if (PLUS_FROM_PIETY.includes(tmpDivineAbility)) {
			return tmpPlus == 0 ? Math.floor((parseInt(tmpBasePiety) || 0) / 5) : tmpPlus + 1;
		}
		return tmpPlus;
	}


	// @MARKER BLESSED
	// This is the function which gives a blessed weapon's figures for its wielder -- the Player's
	// Guide's Holy Weapon (Bless skill): +1 to hit and +1 damage in the hands of a good being, -1 and
	// -1 in an evil one's. The book says nothing of anyone else, so for them it is 0 and 0. Read with
	// "includes", as his own alignment tests are.
	export function getBlessingModifier(tmpAlignment) {
		var tmpText = "" + (tmpAlignment ?? "");
		if (tmpText.includes("Evil") && !tmpText.includes("Non-Evil")) { return { toHit: -1, damage: -1 }; }
		if (tmpText.includes("Good") && !tmpText.includes("Non-Good")) { return { toHit: 1, damage: 1 }; }
		return { toHit: 0, damage: 0 };
	}

	// The two temporary effects the window offers ready-made, and how long each lasts.
	export const TEMPORARY_PRESETS = {
		blessed: { name: "Blessed", seconds: 86400, lasts: "1 day",
		           notes: "Holy Weapon (Bless skill, Player's Guide): +1 to hit and +1 damage for a good wielder, -1 and -1 for an evil one." }
	};

	// The spans a custom temporary effect can be given, in the window's dropdown.
	export const TEMPORARY_SPANS = [
		//  label                seconds
		{ label: "Until removed", seconds: 0 },
		{ label: "1 minute",      seconds: 60 },
		{ label: "10 minutes",    seconds: 600 },
		{ label: "1 hour",        seconds: 3600 },
		{ label: "1 day",         seconds: 86400 },
		{ label: "1 week",        seconds: 604800 }
	];

	// This is the function which says whether a temporary effect still holds. One with no end
	// (until 0) holds until it is taken off; one with an end holds while the world's clock is short
	// of it. A world whose clock is never advanced keeps them all, which is why each one can also
	// be taken off by hand.
	export function isTemporaryActive(tmpEffect, tmpWorldTime) {
		var tmpUntil = parseInt(tmpEffect?.until) || 0;
		return tmpUntil == 0 || (parseFloat(tmpWorldTime) || 0) < tmpUntil;
	}

	// This is the function which makes a temporary effect ready to store on the weapon.
	export function makeTemporaryEffect(tmpInput, tmpWorldTime) {
		var tmpSeconds = parseInt(tmpInput.seconds) || 0;
		return {
			id: tmpInput.id ?? ("" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)),
			name: ("" + (tmpInput.name ?? "")).trim() || "Temporary",
			kind: tmpInput.kind ?? "custom",
			toHit: parseInt(tmpInput.toHit) || 0,
			damage: parseInt(tmpInput.damage) || 0,
			notes: ("" + (tmpInput.notes ?? "")).trim(),
			until: tmpSeconds > 0 ? (parseFloat(tmpWorldTime) || 0) + tmpSeconds : 0,
			lasts: tmpInput.lasts ?? ""
		};
	}


	// @MARKER WHAT IT DOES TO THE WEAPON'S FIGURES
	// His setEquippedWeaponInCombatSheet (sheet-worker.js:83420) puts an equipped weapon on the combat
	// sheet through his fifteen "listing changes" functions: a Chain Weapon has a die more, two more
	// seconds and six more inches; a Serrated edge adds one a die and keeps a third of its strength; a
	// Master weapon is a second quicker and +1 to hit; a Worn one is -2 damage, a second slower and -1
	// to hit; a +3 weapon is two seconds quicker and +10% to its skills. Those tables are
	// WEAPON_LISTING_CHANGES and MAGIC_PLUS_LISTING, generated from his functions; this applies them.
	//
	// WHAT IS LEFT TO THE REST OF THE PORT. The plus's own +N to hit and +N damage are the attack's
	// "Magic" figures already (getToHitModifiers, and the damage roll's @magic), and weight -- the
	// plus's and the quality's -- is resolveEncumbrance's (combat-rules.mjs), from his getItemWeight.
	// Applying them here too would count them twice, so those rows are read and skipped.
	//
	// ONE ALIAS. His panel offers a "Doubling Blade" and writes "[Doubling Blade]" into the name; his
	// listing functions test for "[Double Blade]" beside "[Double Head]". So in his sheet a Doubling
	// Blade changes nothing. Read here as the same customization -- UPSTREAM-ISSUES.
	const LISTING_TAG_ALIASES = { "Doubling Blade": "Double Blade" };
	// The figures the plus's ladder moves that the port already applies elsewhere (see above).
	const LISTING_APPLIED_ELSEWHERE = ["diceMod", "altDiceMod", "toHit", "weight"];

	// This is the function which lists the tags his listing functions would find in the weapon's name:
	// its quality, its condition, its physical customizations and its magical abilities.
	export function getWeaponListingTags(tmpSystem) {
		var tmpCustom = tmpSystem?.custom ?? {};
		var tmpTags = [];
		if (tmpSystem?.quality) { tmpTags.push(tmpSystem.quality); }
		if (tmpSystem?.condition) { tmpTags.push(tmpSystem.condition); }
		for (const tmpTag of [...(tmpCustom.customizations ?? []), ...(tmpCustom.magicAbilities ?? [])]) {
			tmpTags.push(tmpTag);
			if (LISTING_TAG_ALIASES[tmpTag]) { tmpTags.push(LISTING_TAG_ALIASES[tmpTag]); }
		}
		return tmpTags;
	}

	// This is the function which reads "2d6+1" as { dice: 2, sides: 6, mod: 1 }, or null for a damage
	// that is not plain dice ("1", "Special"), which his functions would also leave alone.
	function readDamage(tmpDamage) {
		var tmpMatch = ("" + (tmpDamage ?? "")).replace(/\s+/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
		return tmpMatch ? { dice: parseInt(tmpMatch[1]), sides: parseInt(tmpMatch[2]), mod: parseInt(tmpMatch[3] ?? "0") || 0 } : null;
	}

	// This is the function which writes it back as his does: "3d6+2", "3d6-1", "3d6"; and "1" if the
	// dice have gone below one (his "if (newNumberOfDice<1) { newWeaponCombatDamage="1"; }").
	function writeDamage(tmpDamage) {
		if (tmpDamage.dice < 1) { return "1"; }
		return `${tmpDamage.dice}d${tmpDamage.sides}${tmpDamage.mod > 0 ? "+" + tmpDamage.mod : (tmpDamage.mod < 0 ? tmpDamage.mod : "")}`;
	}

	// This is the function which reads a Gravity rune: the weight it adds or takes off, as his rune
	// tag writes it (level x10 percent, from -99 to +200), what that multiplies the weight by, and the
	// speed/dice steps -- one per full 30% (his tempthirtylevel).
	//
	// THE MULTIPLIER IS THE RUNE'S OWN WORDS, NOT HIS ARITHMETIC. His getGravityRuneWeightMod runs the
	// tag's "+30%" through convertPercentNumToMulti, which reads a positive figure as a percentage OF
	// the weight (the "200 = double" convention of his weight box) -- so a +30% Gravity rune makes a
	// weapon 0.3 of its weight, lighter, where the rune says "its weight is increased". The prose is
	// taken as meant: +30% is x1.3, -50% is x0.5 (which his arithmetic also gives). UPSTREAM item 66.
	//
	// Returns { percent, weightMulti, steps } -- all neutral (0, 1, 0) with no Gravity rune.
	export function getGravityRune(tmpSystem) {
		var tmpRune = (tmpSystem?.custom?.runes ?? []).find(tmpR => tmpR.name == "Gravity");
		var tmpLevel = parseInt(tmpRune?.level) || 0;
		if (!tmpLevel) { return { percent: 0, weightMulti: 1, steps: 0 }; }
		var tmpPercent = Math.max(-99, Math.min(200, tmpLevel * 10));
		return { percent: tmpPercent, weightMulti: 1 + (tmpPercent / 100), steps: Math.trunc(tmpPercent / 30) };
	}

	// This is the function which gives the weapon as his combat sheet would carry it: a copy of its
	// system data with damage, damageAlt, speed, minSpeed, reloadSpeed, reloadMinSpeed, length,
	// skillsMod, structuralStrength and the attack modes changed, plus
	//
	//     listingToHit     his weapon to-hit change from quality and condition, for the attack to add
	//     listingChanges   what changed, "speed 5 -> 6" and so on, for anyone asking why
	//     listingApplied   true, so that passing the result in again changes nothing more
	//
	// Nothing is stored: the weapon's own figures stay what the compendium or the Game Master set.
	export function getCustomizedWeapon(tmpSystem) {
		if (!tmpSystem || tmpSystem.listingApplied) { return tmpSystem; }
		var tmpOut = { ...tmpSystem, listingToHit: 0, listingChanges: [], listingApplied: true };
		var tmpTags = new Set(getWeaponListingTags(tmpSystem));
		var tmpPlus = MAGIC_PLUS_LISTING["" + (parseInt(tmpSystem.magicBonus) || 0)] ?? [];
		var tmpCustom = tmpSystem.custom ?? {};
		// Runes change the listing too (see @MARKER RUNES AND SELF-REPAIR below), so a weapon with only
		// a rune on it is not left as it was.
		if (!tmpTags.size && !tmpPlus.length && !(tmpCustom.runes ?? []).length) { return tmpOut; }

		var tmpDamage = readDamage(tmpSystem.damage);
		var tmpAlt = readDamage(tmpSystem.damageAlt);
		var tmpFigures = {
			speed: parseInt(tmpSystem.speed) || 0, minSpeed: parseInt(tmpSystem.minSpeed) || 0,
			reloadSpeed: parseInt(tmpSystem.reloadSpeed) || 0, reloadMinSpeed: parseInt(tmpSystem.reloadMinSpeed) || 0,
			structuralStrength: parseFloat(tmpSystem.structuralStrength) || 0,
			length: parseInt(tmpSystem.length) || 0,    // his parseInt: a 4.5' weapon is 4 to his arithmetic
			skillsMod: parseInt(tmpSystem.skillsMod) || 0, toHit: 0
		};
		var tmpTouched = new Set();
		var tmpStageTouched = new Set();

		// One row: [figure, how, by]. Damage figures live on the parsed damage; the rest on tmpFigures.
		var tmpApply = (tmpFigure, tmpHow, tmpBy) => {
			var tmpHolder = tmpFigures;
			var tmpKey = tmpFigure;
			if (tmpFigure == "dice" || tmpFigure == "diceMod") { tmpHolder = tmpDamage; tmpKey = tmpFigure == "dice" ? "dice" : "mod"; }
			if (tmpFigure == "altDice" || tmpFigure == "altDiceMod") { tmpHolder = tmpAlt; tmpKey = tmpFigure == "altDice" ? "dice" : "mod"; }
			if (!tmpHolder) { return; }
			if (tmpHow == "add") { tmpHolder[tmpKey] += tmpBy; }
			else if (tmpHow == "times") { tmpHolder[tmpKey] = tmpHolder[tmpKey] * tmpBy; }
			else if (tmpHow == "perDie") { tmpHolder[tmpKey] += tmpHolder.dice; }
			tmpTouched.add(tmpFigure);
			tmpStageTouched.add(tmpFigure);
		};
		// His speed functions floor the starting speed at the minimum, each time they change it.
		var tmpFloorSpeeds = () => {
			if (tmpFigures.speed < tmpFigures.minSpeed) { tmpFigures.speed = tmpFigures.minSpeed; }
			if (tmpFigures.reloadSpeed && tmpFigures.reloadSpeed < tmpFigures.reloadMinSpeed) { tmpFigures.reloadSpeed = tmpFigures.reloadMinSpeed; }
		};

		// His order: every non-magic function, then every magic one, the plus's ladder in its own.
		var tmpStages = [];
		for (const [tmpFunction, tmpRowTags, tmpFigure, tmpHow, tmpBy] of WEAPON_LISTING_CHANGES) {
			if (!tmpStages.length || tmpStages[tmpStages.length - 1].name != tmpFunction) { tmpStages.push({ name: tmpFunction, rows: [] }); }
			if (tmpRowTags.some(tmpTag => tmpTags.has(tmpTag))) { tmpStages[tmpStages.length - 1].rows.push([tmpFigure, tmpHow, tmpBy]); }
		}
		for (const tmpStage of tmpStages) {
			var tmpMagic = tmpStage.name.startsWith("getMagic");
			tmpStageTouched.clear();
			for (const tmpRow of tmpStage.rows) { tmpApply(...tmpRow); }
			// The plus's ladder, in the magic function that owns each figure.
			if (tmpMagic) {
				for (const [tmpFigure, tmpHow, tmpBy] of tmpPlus) {
					if (LISTING_APPLIED_ELSEWHERE.includes(tmpFigure)) { continue; }
					var tmpOwner = { structuralStrength: "getMagicWeaponSTR", speed: "getMagicWeaponSpeed", reloadSpeed: "getMagicWeaponSpeed",
					                 skillsMod: "getMagicWeaponSkill" }[tmpFigure];
					if (tmpOwner == tmpStage.name) { tmpApply(tmpFigure, tmpHow, tmpBy); }
				}
			}
			if (tmpStage.name.endsWith("WeaponSpeed") && (tmpStageTouched.has("speed") || tmpStageTouched.has("reloadSpeed"))) { tmpFloorSpeeds(); }
			// His strength functions end in parseInt.
			if (tmpStage.name.endsWith("WeaponSTR")) { tmpFigures.structuralStrength = Math.trunc(tmpFigures.structuralStrength); }
		}
		// The two magic functions with no tag rows of their own (strength, skill) still carry the ladder.
		for (const tmpName of ["getMagicWeaponSTR", "getMagicWeaponSkill"]) {
			if (tmpStages.some(tmpStage => tmpStage.name == tmpName)) { continue; }
			for (const [tmpFigure, tmpHow, tmpBy] of tmpPlus) {
				if ((tmpName == "getMagicWeaponSTR" && tmpFigure == "structuralStrength") || (tmpName == "getMagicWeaponSkill" && tmpFigure == "skillsMod")) {
					tmpApply(tmpFigure, tmpHow, tmpBy);
				}
			}
			if (tmpName == "getMagicWeaponSTR") { tmpFigures.structuralStrength = Math.trunc(tmpFigures.structuralStrength); }
		}

		// Written back, and each change noted.
		var tmpNote = (tmpLabel, tmpBefore, tmpAfter) => { if ("" + tmpBefore != "" + tmpAfter) { tmpOut.listingChanges.push(`${tmpLabel} ${tmpBefore} -> ${tmpAfter}`); } };
		if (tmpDamage) { tmpOut.damage = writeDamage(tmpDamage); tmpNote("damage", tmpSystem.damage, tmpOut.damage); }
		if (tmpAlt) { tmpOut.damageAlt = writeDamage(tmpAlt); tmpNote("second damage", tmpSystem.damageAlt, tmpOut.damageAlt); }
		for (const tmpKey of ["speed", "minSpeed", "reloadSpeed", "reloadMinSpeed", "structuralStrength", "skillsMod"]) {
			if (!tmpTouched.has(tmpKey)) { continue; }
			tmpOut[tmpKey] = tmpFigures[tmpKey];
			tmpNote(tmpKey, tmpSystem[tmpKey], tmpOut[tmpKey]);
		}
		if (tmpTouched.has("length")) {
			tmpOut.length = `${tmpFigures.length}'`;
			tmpNote("length", tmpSystem.length, tmpOut.length);
		}
		tmpOut.listingToHit = tmpFigures.toHit;

		// @MARKER RUNES AND SELF-REPAIR ON THE LISTING
		// What his listing functions read out of a rune's tag, and the self-repairing abilities
		// (getWeaponMinSpeedListingChanges, getWeaponDamageListingChanges, getWeaponSTRListingChanges,
		// getWeaponSpeedListingChanges, sheet-worker.js:89978-90295):
		//   Gravity   one second of speed and minimum speed, and one damage die, per full 30% of weight
		//             it adds or takes off -- neither speed under 1, the starting speed never under the
		//             minimum. Its weight is read where the weight is, in resolveEncumbrance.
		//   Strenghthen Metal/Wood  +5 weapon strength (the rune), +10 (the greater rune, level 2)
		//   Repair, Invulnerability  the strength becomes "[R]" / "[I]" -- it mends itself, or cannot
		//             break -- whatever it was
		var tmpGravity = getGravityRune(tmpSystem);
		if (tmpGravity.steps) {
			var tmpBeforeSpeed = tmpOut.speed, tmpBeforeMin = tmpOut.minSpeed, tmpBeforeDamage = tmpOut.damage;
			tmpOut.minSpeed = Math.max(1, (parseInt(tmpOut.minSpeed) || 0) + tmpGravity.steps);
			tmpOut.speed = Math.max(1, (parseInt(tmpOut.speed) || 0) + tmpGravity.steps, tmpOut.minSpeed);
			var tmpGravDamage = readDamage(tmpOut.damage);
			if (tmpGravDamage) { tmpGravDamage.dice = tmpGravDamage.dice + tmpGravity.steps; tmpOut.damage = writeDamage(tmpGravDamage); }
			tmpNote("speed", tmpBeforeSpeed, tmpOut.speed);
			tmpNote("minSpeed", tmpBeforeMin, tmpOut.minSpeed);
			tmpNote("damage", tmpBeforeDamage, tmpOut.damage);
		}
		var tmpRuneNames = (tmpCustom.runes ?? []).map(tmpR => tmpR.name);
		var tmpAbilities = tmpCustom.magicAbilities ?? [];
		var tmpBeforeStrength = tmpOut.structuralStrength;
		if (tmpAbilities.includes("Repair")) {
			tmpOut.structuralStrength = "[R]";
		} else if (tmpAbilities.includes("Invulnerability") || tmpRuneNames.includes("Invulnerability")) {
			tmpOut.structuralStrength = "[I]";
		} else {
			var tmpStrengthen = (tmpCustom.runes ?? []).find(tmpR => tmpR.name == "Strenghthen Metal" || tmpR.name == "Strenghthen Wood");
			if (tmpStrengthen) {
				var tmpAdd = (parseInt(tmpStrengthen.level) >= 2) ? 10 : 5;
				tmpOut.structuralStrength = Math.trunc((parseFloat(tmpOut.structuralStrength) || 0) + tmpAdd);
			}
		}
		tmpNote("structuralStrength", tmpBeforeStrength, tmpOut.structuralStrength);

		// Dulling turns the edge and the point into a blunt head: no thrust, no cut, and a smash if it had
		// none (setEquippedWeaponInCombatSheet's "special dulling rules (changes weapon type)").
		if (tmpTags.has("Dulling")) {
			tmpOut.thrust = { available: false, mod: 0 };
			tmpOut.cut = { available: false, mod: 0 };
			if (!tmpSystem.smash?.available) { tmpOut.smash = { available: true, mod: 0 }; }
			tmpOut.listingChanges.push("Dulling: smashes only");
		}
		return tmpOut;
	}


	// @MARKER WHAT THE ATTACK ADDS
	// This is the function which gathers what a weapon's customization and temporary effects add to
	// one attack BEFORE the dice are rolled -- the to-hit entries (labelled as the card lists them),
	// the extra damage dice a rune adds, and the flat damage.
	//
	//   tmpInput = { system, mode, alignment, worldTime }
	// Returns { toHit: [{ label, value }], runeDice: "2d6+2" or "", damage: [{ label, value }],
	//           blessed: bool }
	export function getWeaponAttackExtras(tmpInput) {
		var tmpSystem = tmpInput.system ?? {};
		var tmpCustom = tmpSystem.custom ?? {};
		var tmpOut = { toHit: [], runeDice: "", damage: [], blessed: false };

		// Quality and condition move the weapon's own to-hit -- his getWeaponToHitListingChanges. A
		// system already through getCustomizedWeapon carries it; anything else is worked out here.
		var tmpListing = getCustomizedWeapon(tmpSystem);
		if (tmpListing?.listingToHit) { tmpOut.toHit.push({ label: "Quality/condition", value: tmpListing.listingToHit }); }

		// A rune works on the attacks of its own kind: Piercing on a thrust, Sharpness on a cut,
		// Disruption on a smash, Accuracy on a missile.
		for (const tmpRune of tmpCustom.runes ?? []) {
			if (RUNE_MODES[tmpRune.name] != tmpInput.mode) { continue; }
			var tmpLevel = parseInt(tmpRune.level) || 0;
			if (tmpLevel < 1) { continue; }
			var tmpHit = (parseInt(tmpSystem.magicBonus) || 0) > 0 ? 1 : tmpLevel;
			tmpOut.toHit.push({ label: `Rune of ${tmpRune.name}`, value: tmpHit });
			tmpOut.runeDice = `${tmpLevel}d6+${tmpLevel}`;
			break;
		}

		// Blessed, permanently or for now. Its figures count once, however it came to be blessed.
		var tmpActive = (tmpSystem.tempEffects ?? []).filter(tmpEffect => isTemporaryActive(tmpEffect, tmpInput.worldTime));
		var tmpBlessed = !!tmpCustom.blessed || tmpActive.some(tmpEffect => tmpEffect.kind == "blessed");
		if (tmpBlessed) {
			tmpOut.blessed = true;
			var tmpBless = getBlessingModifier(tmpInput.alignment);
			if (tmpBless.toHit) { tmpOut.toHit.push({ label: "Blessed", value: tmpBless.toHit }); }
			if (tmpBless.damage) { tmpOut.damage.push({ label: "Blessed", value: tmpBless.damage }); }
		}
		for (const tmpEffect of tmpActive) {
			if (tmpEffect.kind == "blessed") { continue; }
			if (tmpEffect.toHit) { tmpOut.toHit.push({ label: tmpEffect.name, value: tmpEffect.toHit }); }
			if (tmpEffect.damage) { tmpOut.damage.push({ label: tmpEffect.name, value: tmpEffect.damage }); }
		}
		return tmpOut;
	}


	// @MARKER WHAT THE HIT DOES
	// This is the function which works out a weapon's special damage once it has hit -- the whole of
	// his setMagicDamageDetails (sheet-worker.js:91318), in his order.
	//
	//   tmpInput = {
	//       system       the weapon's system data
	//       mode         thrust, cut, smash or missile
	//       natural      the natural d20 of the attack
	//       baseDice     the weapon's own damage for this mode, before anything is added ("1d8")
	//   }
	//
	// Returns {
	//     extraDamage   added to the blow before its multipliers (a mode ability's dice)
	//     doubles       true when the natural roll doubles the blow (his "natural N does double"),
	//                   which the caller adds to its multipliers -- x3 if it was already doubled
	//     foeStrike     { extra, doubles } or null -- a separate "against its foe type" figure
	//     lines         [ text ] -- each one written the way his card writes it
	// }
	//
	// tmpInput.maximize is the attack's maximum damage (a Focused Attack, a Perfect Shot, an immobile
	// target). His setMagicDamageDetails gives the MAGICAL dice their highest under it -- the mode
	// ability's and Foe Strike's, getMaxValueFromDiceString at sheet-worker.js:91530 and 91609 -- and
	// rolls the energy and divine dice as usual, so only those two take it here.
	export function resolveWeaponSpecials(tmpInput, tmpRoll) {
		var tmpSystem = tmpInput.system ?? {};
		var tmpMagicRoll = tmpInput.maximize ? (tmpSides => tmpSides) : tmpRoll;
		var tmpCustom = tmpSystem.custom ?? {};
		var tmpAura5 = Math.floor((parseInt(tmpCustom.baseAura) || 0) / 5);
		var tmpBasePiety = parseInt(tmpCustom.basePiety) || 0;
		var tmpPiety5 = Math.floor(tmpBasePiety / 5);
		var tmpMagicDamageMod = countDice(tmpInput.baseDice) + tmpAura5;
		var tmpNatRequired = 21 - tmpAura5;
		var tmpNatural = parseInt(tmpInput.natural) || 0;
		var tmpOut = { extraDamage: 0, doubles: false, foeStrike: null, lines: [] };

		// Accuracy, Piercing, Sharpness or Disruption, on the attack of its own kind: (Aura/5)d6 plus
		// the weapon's dice and Aura/5 more, and a natural roll of 21 - Aura/5 or better doubles the lot.
		var tmpModeAbility = (tmpCustom.magicAbilities ?? []).find(tmpA => ABILITY_MODES[tmpA] == tmpInput.mode);
		if (tmpModeAbility) {
			var tmpDice = `${tmpAura5}d6+${tmpMagicDamageMod}`;
			tmpOut.extraDamage = rollCustomDice(tmpDice, tmpMagicRoll);
			tmpOut.lines.push(`${tmpModeAbility} (+${tmpDice}) = ${tmpOut.extraDamage} more damage.`);
			if (tmpNatural >= tmpNatRequired) {
				tmpOut.doubles = true;
				tmpOut.lines.push(`A natural ${tmpNatural} with ${tmpModeAbility} doubles the blow.`);
			}
		}

		// Foe Strike: the same again, but only against the one kind of foe it was made against --
		// his "Total physical damage[vs type]". Reported beside the ordinary figure, for the Game
		// Master to take if the target is that kind.
		if ((tmpCustom.magicAbilities ?? []).includes("Foe Strike")) {
			var tmpFoeDice = `${tmpAura5}d6+${tmpMagicDamageMod}`;
			var tmpFoeExtra = rollCustomDice(tmpFoeDice, tmpMagicRoll);
			tmpOut.foeStrike = { extra: tmpFoeExtra, doubles: tmpNatural >= tmpNatRequired };
			tmpOut.lines.push(`Foe Strike, against its foe type only: +${tmpFoeDice} = ${tmpFoeExtra} more damage`
				+ (tmpOut.foeStrike.doubles ? `, and the natural ${tmpNatural} doubles it.` : "."));
		}

		// Energy: a Magic Resistance or the damage.
		if (tmpCustom.energyType && (parseInt(tmpCustom.energyDice) || 0) > 0) {
			var tmpEnergy = ENERGY_DICE[tmpCustom.energyType];
			if (tmpEnergy) {
				var tmpCount = parseInt(tmpCustom.energyDice);
				var tmpEnergyDice = `${tmpCount}d${tmpEnergy.sides}${tmpEnergy.plusPerDie ? "+" + (tmpCount * tmpEnergy.plusPerDie) : ""}`;
				tmpOut.lines.push(`Energy: the target makes a Magic Resistance or takes ${rollCustomDice(tmpEnergyDice, tmpRoll)}`
					+ ` (${tmpEnergyDice}) magical ${tmpCustom.energyType} damage.`);
			}
		}

		// Bane.
		if ((tmpCustom.magicAbilities ?? []).includes("Bane")) {
			tmpOut.lines.push("Bane: a target of its type makes a Magic Resistance or dies.");
		}

		// Divine. The brands roll one die of their own per 5 base Piety Control; Divine Might half the
		// base Piety Control in d6; all of it is one "divine damage" of every kind the weapon carries.
		var tmpDivine = tmpCustom.divineAbilities ?? [];
		var tmpDivineDamage = 0;
		var tmpDivineDice = [];
		for (const tmpBrand of tmpDivine) {
			if (DIVINE_BRAND_DICE[tmpBrand] && tmpPiety5 > 0) {
				var tmpBrandDice = `${tmpPiety5}d${DIVINE_BRAND_DICE[tmpBrand]}`;
				tmpDivineDice.push(tmpBrandDice);
				tmpDivineDamage += rollCustomDice(tmpBrandDice, tmpRoll);
			}
		}
		if (tmpDivine.includes("Divine Might")) {
			var tmpMightDice = `${Math.floor(tmpBasePiety / 2) || 1}d6`;
			tmpDivineDice.push(tmpMightDice);
			tmpDivineDamage += rollCustomDice(tmpMightDice, tmpRoll);
		}
		if (tmpDivineDamage > 0) {
			var tmpKinds = tmpDivine.filter(tmpA => DIVINE_ENERGY_LABELS[tmpA]).map(tmpA => DIVINE_ENERGY_LABELS[tmpA]);
			tmpOut.lines.push(`Divine: the target makes a Magic Resistance or takes ${tmpDivineDamage} (${tmpDivineDice.join(" + ")})`
				+ ` divine ${[...new Set(tmpKinds)].join(", ")} damage.`);
		}

		// Rebuke: a d2 for chest or head. The chest takes (PC/3)d6 and risks a heart attack (PC/4 %,
		// 6d6 more); the head takes (PC/4)d4 and risks a stroke (PC/4 %, 5d4 more, and his d100 for how bad).
		if (tmpDivine.includes("Rebuke")) {
			var tmpChance = Math.floor(tmpBasePiety / 4) || 1;
			if (tmpRoll(2) == 1) {
				var tmpChest = rollCustomDice(`${Math.floor(tmpBasePiety / 3) || 1}d6`, tmpRoll);
				if (tmpRoll(100) <= tmpChance) {
					tmpOut.lines.push(`Rebuke: the target makes a Magic Resistance or takes ${tmpChest} to the Upper Torso and suffers`
						+ ` a heart attack for ${rollCustomDice("6d6", tmpRoll)} Upper Torso over the next minute. Lose 1 level of`
						+ ` fatigue. No actions may be taken for 1d4 minutes. A Vitality save or lose 1 point of Vitality permanently.`);
				} else {
					tmpOut.lines.push(`Rebuke: the target makes a Magic Resistance or takes ${tmpChest} to the Upper Torso. Lose 1 level of fatigue.`);
				}
			} else {
				var tmpHead = rollCustomDice(`${Math.floor(tmpBasePiety / 4) || 1}d4`, tmpRoll);
				if (tmpRoll(100) <= tmpChance) {
					var tmpSeverity = tmpRoll(100);
					var tmpStroke = REBUKE_STROKES.find(([tmpBelow]) => tmpSeverity < tmpBelow)?.[1] ?? "";
					tmpOut.lines.push(`Rebuke: the target makes a Magic Resistance or takes ${tmpHead} to the Head and suffers a stroke`
						+ ` for ${rollCustomDice("5d4", tmpRoll)} Head damage over the next minute. ${tmpStroke}`);
				} else {
					tmpOut.lines.push(`Rebuke: the target makes a Magic Resistance or takes ${tmpHead} to the Head. Loses concentration. Suffers mental fatigue.`);
				}
			}
		}

		// Divine Blast (and Retribution, which his code gives the Blast's circles) and Divine Wrath:
		// rings of divine damage around the struck target, each wider and weaker.
		var tmpHalf = Math.floor(tmpBasePiety / 2) || 1;
		if (tmpDivine.includes("Divine Wrath")) {
			var tmpWrath = [12, 10, 8, 6].map((tmpSides, tmpIndex) =>
				`${rollCustomDice(`${tmpHalf}d${tmpSides}`, tmpRoll)} divine damage out to ${tmpHalf * (tmpIndex + 1)} feet`);
			tmpOut.lines.push(`Divine Wrath: a divine explosion radiates outward -- ${tmpWrath.join(", then ")}.`);
		}
		if (tmpDivine.includes("Divine Blast") || tmpDivine.includes("Divine Retribution")) {
			var tmpBlast = [10, 8, 6].map((tmpSides, tmpIndex) =>
				`${rollCustomDice(`${tmpHalf}d${tmpSides}`, tmpRoll)} divine damage out to ${tmpHalf * (tmpIndex + 1)} feet`);
			tmpOut.lines.push(`Divine Blast: a divine explosion radiates outward -- ${tmpBlast.join(", then ")}.`);
		}
		return tmpOut;
	}


	// @MARKER WHAT IT SAYS ON THE WEAPON
	// This is the function which lists a weapon's customization and live temporary effects as short
	// tags for its row on the sheet -- "+2", "Blessed", "Sharpness", "Rune of Piercing 2", "2d6 Flame".
	export function getWeaponCustomTags(tmpSystem, tmpWorldTime) {
		var tmpCustom = tmpSystem?.custom ?? {};
		var tmpTags = [];
		if ((parseInt(tmpSystem?.magicBonus) || 0) > 0) { tmpTags.push(`+${parseInt(tmpSystem.magicBonus)}`); }
		if (tmpCustom.blessed) { tmpTags.push("Blessed"); }
		if (tmpSystem?.quality) { tmpTags.push(tmpSystem.quality); }
		if (tmpSystem?.condition) { tmpTags.push(tmpSystem.condition); }
		for (const tmpA of tmpCustom.magicAbilities ?? []) { tmpTags.push(tmpA); }
		for (const tmpR of tmpCustom.runes ?? []) { tmpTags.push(`Rune of ${tmpR.name} ${tmpR.level}`); }
		if (tmpCustom.energyType && tmpCustom.energyDice) { tmpTags.push(`${tmpCustom.energyDice}d${ENERGY_DICE[tmpCustom.energyType]?.sides ?? "?"} ${tmpCustom.energyType}`); }
		for (const tmpA of tmpCustom.divineAbilities ?? []) { tmpTags.push(tmpA); }
		for (const tmpC of tmpCustom.customizations ?? []) { tmpTags.push(tmpC); }
		for (const tmpE of [...(tmpCustom.magicalEffects ?? []), ...(tmpCustom.divineEffects ?? [])]) { tmpTags.push(tmpE); }
		for (const tmpE of (tmpSystem?.tempEffects ?? []).filter(tmpE => isTemporaryActive(tmpE, tmpWorldTime))) {
			tmpTags.push(`${tmpE.name} (${tmpE.lasts || "temporary"})`);
		}
		return tmpTags;
	}

	// This is the function which shows a weapon's name as his panel would print it, prefix and suffix
	// and all, WITHOUT renaming the item -- the lore lists match weapons by name.
	export function getWeaponDisplayName(tmpName, tmpSystem) {
		var tmpCustom = tmpSystem?.custom ?? {};
		return [tmpCustom.prefix, tmpName, tmpCustom.suffix].filter(tmpPart => ("" + (tmpPart ?? "")).trim()).join(" ");
	}


	// @MARKER APPLYING THE PANEL
	// This is the function which lays one use of his panel over a weapon -- customizeItem
	// (sheet-worker.js:78903), as fields. Only what was chosen changes; an empty choice leaves the
	// weapon as it was, as his does. Returns { system, issues }: the new system data (a copy), and
	// anything refused, with the reason.
	//
	//   tmpChoices = { prefix, suffix, condition, quality, plus ("" | "Blessed" | "+1".."+10"),
	//                  baseAura, basePiety, magicAbility, rune, runeLevel, energyType, energyDice,
	//                  divineAbility, customization, magicalEffect, divineEffect, setWeight, adjustWeight }
	//
	// His rules kept: a magical plus clears quality and condition ("Magic plus overrides quality");
	// Blessed and a +N are one or the other; a base Aura or base Piety Control, once set, is not
	// changed by a later customizing ("item already has a base aura. We don't update this").
	export function applyWeaponCustomization(tmpWeapon, tmpChoices) {
		var tmpSystem = structuredClone(tmpWeapon?.system ?? {});
		var tmpCustom = tmpSystem.custom = {
			prefix: "", suffix: "", blessed: false, baseAura: 0, basePiety: 0, magicAbilities: [], runes: [],
			energyType: "", energyDice: 0, divineAbilities: [], customizations: [], magicalEffects: [], divineEffects: [],
			...(tmpSystem.custom ?? {})
		};
		var tmpIssues = [];
		var tmpText = (tmpValue) => ("" + (tmpValue ?? "")).trim();

		if (tmpText(tmpChoices.prefix)) { tmpCustom.prefix = tmpText(tmpChoices.prefix).slice(0, 30); }
		if (tmpText(tmpChoices.suffix)) { tmpCustom.suffix = tmpText(tmpChoices.suffix).slice(0, 30); }
		if (tmpChoices.quality !== undefined && tmpChoices.quality !== null && tmpText(tmpChoices.quality) !== "-") {
			tmpSystem.quality = tmpText(tmpChoices.quality) == "Average" ? "" : tmpText(tmpChoices.quality);
		}
		if (tmpChoices.condition !== undefined && tmpChoices.condition !== null && tmpText(tmpChoices.condition) !== "-") {
			tmpSystem.condition = tmpText(tmpChoices.condition) == "Undamaged" ? "" : tmpText(tmpChoices.condition);
		}

		// The base Aura and Piety Control first: the plus an ability raises is worked out from them.
		if (!(parseInt(tmpCustom.baseAura) > 0) && parseInt(tmpChoices.baseAura) > 0) { tmpCustom.baseAura = parseInt(tmpChoices.baseAura); }
		if (!(parseInt(tmpCustom.basePiety) > 0) && parseInt(tmpChoices.basePiety) > 0) { tmpCustom.basePiety = parseInt(tmpChoices.basePiety); }

		var tmpPlusChosen = tmpText(tmpChoices.plus);
		if (tmpPlusChosen == "Blessed") {
			tmpCustom.blessed = true;
			tmpSystem.magicBonus = 0;
		} else if (tmpPlusChosen) {
			tmpCustom.blessed = false;
			tmpSystem.magicBonus = parseInt(tmpPlusChosen.replace("+", "")) || 0;
		}

		var tmpMagic = tmpText(tmpChoices.magicAbility);
		if (tmpMagic && !tmpCustom.magicAbilities.includes(tmpMagic)) { tmpCustom.magicAbilities.push(tmpMagic); }
		var tmpDivine = tmpText(tmpChoices.divineAbility);
		if (tmpDivine && !tmpCustom.divineAbilities.includes(tmpDivine)) { tmpCustom.divineAbilities.push(tmpDivine); }
		if (tmpMagic || tmpDivine) {
			var tmpNewPlus = updateMagicPlus(tmpSystem.magicBonus, tmpMagic, tmpCustom.baseAura, tmpDivine, tmpCustom.basePiety);
			if (tmpNewPlus != (parseInt(tmpSystem.magicBonus) || 0)) {
				tmpSystem.magicBonus = tmpNewPlus;
				tmpCustom.blessed = false;
			}
		}
		// Magic plus overrides quality and condition, as his panel has it.
		if ((parseInt(tmpSystem.magicBonus) || 0) > 0 && (tmpPlusChosen || tmpMagic || tmpDivine)) {
			tmpSystem.quality = "";
			tmpSystem.condition = "";
		}

		var tmpRune = tmpText(tmpChoices.rune);
		if (tmpRune) {
			var tmpLevel = parseInt(tmpChoices.runeLevel) || 0;
			// A Gravity rune's level is signed -- his takes weight off below zero -- every other rune's is 1 or more.
			if ((tmpRune == "Gravity") ? (tmpLevel == 0) : (tmpLevel < 1)) {
				tmpIssues.push(`A rune needs a level; ${tmpRune} was not added.`);
			} else {
				tmpCustom.runes = tmpCustom.runes.filter(tmpR => tmpR.name != tmpRune);
				tmpCustom.runes.push({ name: tmpRune, level: tmpLevel });
			}
		}
		if (tmpText(tmpChoices.energyType)) {
			if (!(parseInt(tmpChoices.energyDice) > 0)) {
				tmpIssues.push("Energy needs a number of dice; it was not added.");
			} else {
				tmpCustom.energyType = tmpText(tmpChoices.energyType);
				tmpCustom.energyDice = parseInt(tmpChoices.energyDice);
			}
		}
		var tmpCustomization = tmpText(tmpChoices.customization);
		if (tmpCustomization) {
			var tmpCheck = checkWeaponCustomization(tmpWeapon, tmpCustomization);
			if (!tmpCheck.ok) { tmpIssues.push(tmpCheck.reason); }
			else if (!tmpCustom.customizations.includes(tmpCustomization)) { tmpCustom.customizations.push(tmpCustomization); }
		}
		if (tmpText(tmpChoices.magicalEffect) && !tmpCustom.magicalEffects.includes(tmpText(tmpChoices.magicalEffect))) {
			tmpCustom.magicalEffects.push(tmpText(tmpChoices.magicalEffect));
		}
		if (tmpText(tmpChoices.divineEffect) && !tmpCustom.divineEffects.includes(tmpText(tmpChoices.divineEffect))) {
			tmpCustom.divineEffects.push(tmpText(tmpChoices.divineEffect));
		}

		// Weight: set outright, or adjusted by a percentage of what it is ("200=double, -50=half").
		if (parseFloat(tmpChoices.setWeight) > 0) { tmpSystem.weight = parseFloat(tmpChoices.setWeight); }
		var tmpAdjust = parseFloat(tmpChoices.adjustWeight);
		if (tmpAdjust) {
			var tmpFactor = tmpAdjust > 0 ? tmpAdjust / 100 : 1 + (tmpAdjust / 100);
			tmpSystem.weight = Math.max(0, Math.round((parseFloat(tmpSystem.weight) || 0) * tmpFactor * 100) / 100);
		}
		return { system: tmpSystem, issues: tmpIssues };
	}

	// This is the function which takes one thing back off a weapon -- a chip's × in the window.
	//   tmpWhat = { group: "magicAbilities" | "divineAbilities" | "customizations" | "magicalEffects" |
	//                      "divineEffects" | "runes" | "energy" | "blessed" | "plus", value }
	export function removeWeaponCustomization(tmpSystem, tmpWhat) {
		var tmpOut = structuredClone(tmpSystem ?? {});
		var tmpCustom = tmpOut.custom ?? (tmpOut.custom = {});
		if (tmpWhat.group == "runes") { tmpCustom.runes = (tmpCustom.runes ?? []).filter(tmpR => tmpR.name != tmpWhat.value); }
		else if (tmpWhat.group == "energy") { tmpCustom.energyType = ""; tmpCustom.energyDice = 0; }
		else if (tmpWhat.group == "blessed") { tmpCustom.blessed = false; }
		else if (tmpWhat.group == "plus") { tmpOut.magicBonus = 0; }
		else if (Array.isArray(tmpCustom[tmpWhat.group])) {
			tmpCustom[tmpWhat.group] = tmpCustom[tmpWhat.group].filter(tmpV => tmpV != tmpWhat.value);
		}
		return tmpOut;
	}

// @MARKER ADD NEW weapon customization rules HERE
// @END (CODE)
