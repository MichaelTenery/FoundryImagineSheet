// @START (CODE)
// @MARKER CASTING HELPERS
//==================================================================================================================
// Everything module/casting-worker.mjs calls that is NOT carried across from his sheet: the dice, his
// doMagicalAttack, and every function of his that would have changed the caster or talked to Roll20.
// Each keeps his name and his arguments, so the generated code calls them exactly as his sheet did.
//
// WHAT THEY DO INSTEAD. His doSpellAction does two things at once: it writes what the spell does, and
// it changes the caster -- +2 to hit, invisible, -1 Aura, "Spell: Fly" on the effects list -- through
// setAttrs, modAttrib, standardSpellAddEffect and the rest. The writing is kept exactly. The changes
// are RECORDED here, on the cast that is running, and module/casting-rules.mjs hands the record back
// with the text. Then:
//
//     "Spell: X" / "Invoke: X"   put on the caster's effects list (magic.effectList), as his was --
//                                his cases read that list to answer "is already in use"
//     every other change         listed on the cast's chat card for the Game Master to apply, in
//                                words ("Missile to hit: 0 -> 2"), since the port keeps those
//                                figures in different places or not at all
//     each doMagicalAttack       a structured attack -- to-hit, where, damage, type -- which the
//                                card turns into an Apply button on a target
//
// THE ASYNC CALLBACKS. In Roll20, getAttrs(keys, callback) runs its callback LATER, after the function
// that called it has returned -- so whatever a callback writes never reaches the text his case
// returns. The same is kept here: callbacks are queued and run by endCasting, after the text is in.
// What they then do is recorded like everything else. The values they are handed are the caster's
// where the port knows them (context.attrs), and undefined otherwise, which his "||0" turns into a
// change counted from zero -- so "+2" reads as +2.
//
// One cast at a time: doSpellAction is synchronous, so beginCasting and endCasting always pair up
// around exactly one call, and nothing else can run in between.
//==================================================================================================================

// @MARKER THE DICE
// Where every random number in a cast comes from. Foundry's own generator when there is one, so a
// cast is rolled like everything else at the table; a test sets its own with setCastingRandom.
var castingRandomSource = null;

	// This is the function which returns a random number in [0, 1), as Math.random does -- and which
	// the generated module calls wherever his code called Math.random.
	export function castingRandom() {
		if (castingRandomSource) { return castingRandomSource(); }
		var tmpuniform = globalThis.CONFIG?.Dice?.randomUniform;
		return tmpuniform ? tmpuniform() : Math.random();
	}

	// This is the function which sets where the dice come from; null goes back to the default.
	export function setCastingRandom(tmpsource) {
		castingRandomSource = tmpsource ?? null;
	}

	// His getDieRoll (sheet-worker.js:25405), one die of max sides. He sometimes passes the sides as
	// an array of one ([tempListArray.length]); multiplying coerces it, and that is kept.
	export function getDieRoll(max) {
		return Math.floor(castingRandom() * max) + 1;
	}


// @MARKER THE CAST BEING RECORDED
var currentCast = null;

	// This is the function which starts recording a cast.
	//   tmpcontext = {
	//       attrs:          his attribute names -> the caster's values, for getAttrs (title, aura, ...)
	//       missileDefense: the target's defensive adjustment, added to a Missile attack (0 if none)
	//       attackChart:    the caster's chart, as combat-rules.mjs getAttackChart reads it
	//   }
	export function beginCasting(tmpcontext) {
		currentCast = {
			context: tmpcontext ?? {},
			attrs: { ...(tmpcontext?.attrs ?? {}) },
			attacks: [],
			effectsAdded: [],
			effectsRemoved: [],
			changes: [],
			powersAdded: [],
			powersRemoved: [],
			forgetSpell: false,
			deferred: []
		};
	}

	// This is the function which stops recording, first running the callbacks his code queued with
	// getAttrs -- as Roll20 would, once the function that queued them had returned. A callback may
	// queue another; fifty rounds is far more than any case of his nests, and stops a loop.
	export function endCasting() {
		var tmpcast = currentCast;
		if (!tmpcast) { return null; }
		for (var tmpround = 0; tmpround < 50 && tmpcast.deferred.length; tmpround++) {
			var tmpqueue = tmpcast.deferred;
			tmpcast.deferred = [];
			for (const tmpcallback of tmpqueue) {
				try { tmpcallback(); } catch (tmperror) { tmpcast.changes.push({ label: "(his sheet's follow-up failed)", after: String(tmperror?.message ?? tmperror) }); }
			}
		}
		currentCast = null;
		delete tmpcast.deferred;
		return tmpcast;
	}

	// This is the function which notes one change to the caster.
	function recordChange(tmplabel, tmpbefore, tmpafter) {
		if (!currentCast) { return; }
		currentCast.changes.push({ label: tmplabel, before: tmpbefore, after: tmpafter });
	}


// @MARKER ROLL20
// The names his setAttrs writes, in words, for the chat card. Anything not here is shown by his name.
export const CASTER_ATTRIBUTE_LABELS = {
	willforce:                    "Will Force",
	aura:                         "Aura",
	endurance:                    "Endurance",
	tmp_initiative_mod:           "Initiative (temporary)",
	tmp_missile_mod:              "Missile to hit (temporary)",
	tmp_melee_mod:                "Melee to hit (temporary)",
	tmp_defensive_mod:            "Defensive adjustment (temporary)",
	tmp_weapon_speed_mod:         "Weapon speed (temporary)",
	tmp_skills_mod:               "Skills (temporary)",
	tmp_extra_per_die:            "Damage per die (temporary)",
	tmp_force_armor_mod:          "Force Armor",
	tmp_force_armor_mod_input:    null,          // his second copy of the same figure; not shown twice
	tmp_spirit_armor_mod:         "Spirit Armor",
	tmp_spirit_armor_mod_input:   null,
	tmp_mod_hide:                 "Hide (temporary)",
	tmp_damage_absorb_mod:        "Damage absorption",
	tmp_speed_seconds:            "Speed seconds",
	speed_seconds_select:         null,
	tmp_mod_shock_immunity:       "Shock immunity",
	mod_shock_immunity_check:     null,
	tmp_mod_fatigue_immunity:     "Fatigue immunity",
	mod_fatigue_immunity_check:   null,
	tmp_illusion_resist_immunity: "Illusion immunity",
	tmp_illusion_resist_immune_check: null,
	tmp_equip_weight_mod:         "Equipment weight",
	tmp_equip_capacity_mod:       "Carrying capacity",
	sit_self_visibility_invisible: "Invisible",
	sit_self_deaf:                "Deaf",
	sit_self_blind:               "Blind",
	magic_suppression:            "Magic suppressed",
	half_magic:                   "Half magic",
	piety_level_boost:            "Piety level boost",
	aura_control_boost:           "Aura Control boost",
	pain_threshold:               "Pain threshold",
	pain_threshold_input:         null,
	maximum_age:                  "Maximum age",
	armor_clothing_equip:         "Armour/clothing worn",
	combined_cast:                "Combined casting",
	combine_casters:              "Combined casters",
	fatigue_level_select:         "Fatigue level",
	mental_fatigue_level_select:  "Mental fatigue level",
	martial_arts_mod_special:     "Martial special",
	martial_arts_mod_melee:       "Martial melee",
	martial_arts_mod_defensive:   "Martial defence",
	martial_arts_mod_damage:      "Martial damage",
	// Kept on the caster by other means, so not listed as a change: the effects list (effectList)
	// and powers (listed as powers gained or lost).
	tmp_effect_list:              null,
	powers:                       null
};

	// Roll20's getAttrs: the callback is queued, and handed the caster's values as the port knows
	// them. See the header, THE ASYNC CALLBACKS.
	export function getAttrs(tmpkeys, tmpcallback) {
		if (!currentCast || typeof tmpcallback != "function") { return; }
		var tmpcast = currentCast;
		tmpcast.deferred.push(() => {
			var tmpvalues = {};
			for (const tmpkey of tmpkeys ?? []) { tmpvalues[tmpkey] = tmpcast.attrs[tmpkey]; }
			var tmpwas = currentCast;
			currentCast = tmpcast;
			try { tmpcallback(tmpvalues); } finally { currentCast = tmpwas; }
		});
	}

	// Roll20's setAttrs: each value is noted as a change to the caster, in words where it has them,
	// and kept so a later getAttrs in the same cast reads it back as his sheet would.
	export function setAttrs(tmpvalues) {
		if (!currentCast) { return; }
		for (const [tmpkey, tmpvalue] of Object.entries(tmpvalues ?? {})) {
			if (tmpkey.startsWith("repeating_")) { continue; }
			var tmplabel = (tmpkey in CASTER_ATTRIBUTE_LABELS) ? CASTER_ATTRIBUTE_LABELS[tmpkey] : tmpkey;
			if (tmplabel) { recordChange(tmplabel, currentCast.attrs[tmpkey], tmpvalue); }
			currentCast.attrs[tmpkey] = tmpvalue;
		}
	}


// @MARKER HIS SHEET, RECORDED
// Each of these changed the caster in his sheet. Here each notes what it would have done.

	// His modAttrib (sheet-worker.js:26671): a temporary change to an attribute, magical or mundane.
	export function modAttrib(tmpATTRName, tmpModType, tmpMOD) {
		recordChange(`${tmpATTRName == "ALL" ? "Every attribute" : tmpATTRName} (${tmpModType}, temporary)`, null, signed(tmpMOD));
		return true;
	}
	// His setCharacMod (28708): Endurance, Perception, Affinity or Fortune, temporarily.
	export function setCharacMod(tmpType, tmpValue) {
		recordChange(`${tmpType} (temporary)`, null, signed(tmpValue));
		return true;
	}
	// His setResistMod (28607) and setAllResistMod (28598): a resistance, temporarily.
	const RESIST_NAMES = { MR: "Magic Resistance", CR: "Control Resistance", IR: "Illusion Resistance",
	                       PR: "Poison Resistance", DR: "Disease Resistance" };
	export function setResistMod(tmpType, tmpValue) {
		recordChange(`${RESIST_NAMES[tmpType] ?? tmpType} (temporary)`, null, signed(tmpValue) + "%");
		return true;
	}
	export function setAllResistMod(tmpValue) {
		recordChange("Every resistance (temporary)", null, signed(tmpValue) + "%");
		return true;
	}
	// His addPowerName (27948) and removePowerName (27970): the caster's powers list.
	export function addPowerName(tmpPowers, newPowerName) {
		if (currentCast) { currentCast.powersAdded.push("" + newPowerName); }
		return true;
	}
	export function removePowerName(tmpPowers, tmpPowerName) {
		if (currentCast) { currentCast.powersRemoved.push("" + tmpPowerName); }
		return true;
	}
	// His standardSpellAddEffect (169988), standardInvokeAddEffect (159854) and
	// standardSpellRemovalEffect (170000): the effects list. These the port DOES keep -- see the header.
	export function standardSpellAddEffect(tempSpellName, tmpEffectsList) {
		if (currentCast && !(("" + tmpEffectsList).includes(tempSpellName))) { currentCast.effectsAdded.push("Spell: " + tempSpellName); }
		return true;
	}
	export function standardInvokeAddEffect(tempInvocationName, tmpEffectsList) {
		if (currentCast && !(("" + tmpEffectsList).includes(tempInvocationName))) { currentCast.effectsAdded.push("Invoke: " + tempInvocationName); }
		return true;
	}
	export function standardSpellRemovalEffect(tempSpellName) {
		if (currentCast) { currentCast.effectsRemoved.push("Spell: " + tempSpellName); }
		return true;
	}
	// His gainTempMagicalFly (28577): flight, as the Fly spell gives it.
	export function gainTempMagicalFly() { recordChange("Special movement", null, "Fly (magical)"); return true; }
	// His doSetFatigueLevel (28360), clearFatigue (28233) and applyNaturalHealing (28248).
	export function doSetFatigueLevel(tempFatigue, tempMentalFatigue) {
		recordChange("Fatigue", null, `${tempFatigue}, mental ${tempMentalFatigue}`);
		return true;
	}
	export function clearFatigue() { recordChange("Fatigue", null, "cleared"); return true; }
	export function applyNaturalHealing(tmpDays) { recordChange("Natural healing", null, `${tmpDays} day(s) worth`); return true; }
	// His doDirectFullBodyDamage (28346): damage to every body area at once.
	export function doDirectFullBodyDamage(tmpDamage, tmpDamageType) {
		recordChange("Damage to every body area", null, `${tmpDamage} ${tmpDamageType}`);
		return true;
	}
	// His setTempMovementRate (28519): walk, jog, run and a special movement, temporarily.
	export function setTempMovementRate(tmpWalkMod, tmpJogMod, tmpRunMod, tmpSpecialName, tmpSpecialMod) {
		recordChange("Movement (temporary)", null, `walk ${signed(tmpWalkMod)}, jog ${signed(tmpJogMod)}, run ${signed(tmpRunMod)}`
			+ (tmpSpecialName ? `, ${tmpSpecialName} ${signed(tmpSpecialMod)}` : ""));
		return true;
	}
	// His equip* functions: a skin or a mail laid over the caster's armour.
	export function equipMagicMail(armorValue1)         { recordChange("Magic Mail over the armour", null, armorValue1); return true; }
	export function equipMagicPlate(armorValue1)        { recordChange("Magic Plate over the armour", null, armorValue1); return true; }
	export function equipMagicUnderlayment(armorValue1) { recordChange("Magic Underlayment under the armour", null, armorValue1); return true; }
	export function equipCrystalskin() { recordChange("Crystalskin", null, "on (3 x Piety Control)"); return true; }
	export function equipEarthskin()   { recordChange("Earthskin", null, "on"); return true; }
	export function equipRockskin()    { recordChange("Rockskin", null, "on"); return true; }
	export function equipSteelskin()   { recordChange("Steelskin", null, "on"); return true; }
	export function equipWoodskin()    { recordChange("Woodskin", null, "on"); return true; }
	// His uncheckSpellMemorize (160882) and clearSpellDays (160868): the Loss of Spell mishap.
	export function uncheckSpellMemorize(rowid) { if (currentCast) { currentCast.forgetSpell = true; } return true; }
	export function clearSpellDays(rowid) { return true; }
	// Recalculations of his whole sheet, which the port does on every prepare anyway.
	export function checkAllValues() { return true; }
	export function handleMeleeSet() { return true; }
	export function setCombatModifiers() { return true; }
	export function changeResistances() { return true; }

	// This is the function which writes a modifier with its sign.
	function signed(tmpvalue) {
		var tmpnumber = parseFloat(tmpvalue);
		if (isNaN(tmpnumber)) { return "" + tmpvalue; }
		return (tmpnumber > 0 ? "+" : "") + tmpnumber;
	}


// @MARKER A MAGICAL ATTACK
// His doMagicalAttack (sheet-worker.js:28155), which every offensive spell calls for each bolt, dart
// or finger. Two kinds:
//     "Missile" -- a d20 plus the caster's missile modifier, read down their own attack chart like a
//                  missile weapon; Miss(Short) only for a Beginner. No fumble and no called shot.
//     "INT"     -- a d100 against the caster's Intelligence save; under it hits.
// On a hit the damage is rolled (two dice sets "a/b" rolled separately, "0" none, "1" one point).
//
// His text is returned word for word -- including a slip of his: a hit with no special note prints
// the damage TYPE where the number belongs, "causing (1d6)=Fire damage." -- and the attack is recorded
// with the number, so the chat card has it. One addition that his sheet could not make, since it never
// knew the target: a Missile attack takes the target's defensive adjustment (context.missileDefense),
// as a missile weapon does on the port's attack card. It is shown separately on the card.
export function doMagicalAttack(tempAttackName, tempAttackType, tmpModifier, tempAttackDamage, tempDamageType, tempSpecial,
		tmpINTSave, attackSkill, attackHitCenter, attackHitRight, attackHitHigh, attackHitLeft, attackHitLow,
		attackMissRight, attackMissHigh, attackMissLeft, attackMissLow, attackMissShort) {
	var tempAttackResult = "";
	var tempFinalDamage = 0;
	var tmprecord = { name: tempAttackName, kind: tmpModifier == "INT" ? "INT" : "Missile", dice: "" + tempAttackDamage,
		damageType: "" + tempDamageType, special: "" + tempSpecial, isHit: false };
	if (tmpModifier != "INT") {
		var tmpnatural = getDieRoll(20);
		var tmpdefense = parseInt(currentCast?.context?.missileDefense) || 0;
		var tmpmods = (parseInt(tmpModifier) || 0) + tmpdefense;
		// His ladder, read from the thresholds he was handed: no floor at 1 and no fumble, unlike a
		// weapon's (combat-rules.mjs resolveAttack).
		var tempToHitRoll = tmpnatural + tmpmods;
		var chartLocation = readLadder(tempToHitRoll, attackSkill, attackHitCenter, attackHitRight, attackHitHigh, attackHitLeft,
			attackHitLow, attackMissRight, attackMissHigh, attackMissLeft, attackMissLow, attackMissShort);
		tmprecord.natural = tmpnatural;
		tmprecord.modifier = parseInt(tmpModifier) || 0;
		tmprecord.defense = tmpdefense;
		tmprecord.total = tempToHitRoll;
		tmprecord.zone = chartLocation || "Miss";
		if (chartLocation.includes("Hit")) {
			tempFinalDamage = rollMagicalDamage(tempAttackDamage);
			tmprecord.isHit = true;
			if (tempSpecial != "") {
				tempAttackResult = "Used a " + tempAttackType + " attack. Rolled " + tempToHitRoll + " as a " + attackSkill + ", with a result of " + chartLocation + ", causing (" + tempAttackDamage + ")=" + tempFinalDamage + " " + tempDamageType + " damage, " + tempSpecial + ".";
			} else {
				tempAttackResult = "Used a " + tempAttackType + " attack. Rolled " + tempToHitRoll + " as a " + attackSkill + ", with a result of " + chartLocation + ", causing (" + tempAttackDamage + ")=" + tempDamageType + " damage.";
			}
		} else {
			tempAttackResult = "Used a " + tempAttackType + " attack. Rolled " + tempToHitRoll + " as a " + attackSkill + ", with a result of " + chartLocation + ".";
		}
	} else {
		var tempToHitRoll = getDieRoll(100);
		tmprecord.natural = tempToHitRoll;
		tmprecord.save = parseInt(tmpINTSave) || 0;
		tmprecord.zone = tempToHitRoll <= tmpINTSave ? "Hit" : "Miss";
		if (tempToHitRoll <= tmpINTSave) {
			tempFinalDamage = rollMagicalDamage(tempAttackDamage);
			tmprecord.isHit = true;
			if (tempSpecial != "") {
				tempAttackResult = "Used an " + tempAttackType + " attack. Rolled " + tempToHitRoll + " vs. INT Save(" + tmpINTSave + ") and hit causing (" + tempAttackDamage + ")=" + tempFinalDamage + " " + tempDamageType + " damage, " + tempSpecial + ".";
			} else {
				tempAttackResult = "Used an " + tempAttackType + " attack. Rolled " + tempToHitRoll + " vs. INT Save(" + tmpINTSave + ") and hit causing (" + tempAttackDamage + ")=" + tempFinalDamage + " " + tempDamageType + " damage.";
			}
		} else {
			tempAttackResult = "Used an " + tempAttackType + " attack. Rolled " + tempToHitRoll + " vs. INT Save(" + tmpINTSave + ") and missed.";
		}
	}
	if (tmprecord.isHit) {
		tmprecord.damage = tempFinalDamage;
		// "a/b" is two separate amounts (Frost Fire's cold and fire); both are kept.
		tmprecord.amounts = ("" + tempFinalDamage).split("/").map(tmpv => parseInt(tmpv) || 0);
	}
	tmprecord.text = tempAttackResult;
	if (currentCast) { currentCast.attacks.push(tmprecord); }
	return tempAttackResult;
}

	// This is the function which rolls a magical attack's damage his way.
	function rollMagicalDamage(tempAttackDamage) {
		if (tempAttackDamage == "0" || tempAttackDamage == 0 || tempAttackDamage == "") { return 0; }
		if (tempAttackDamage == "1" || tempAttackDamage == 1) { return 1; }
		var tmpdice = "" + tempAttackDamage;
		if (tmpdice.includes("/")) {
			var tmpparts = tmpdice.split("/");
			return "" + rollHisDice(tmpparts[0]) + "/" + rollHisDice(tmpparts[1]);
		}
		return rollHisDice(tmpdice);
	}

	// His rollDiceFromString, for "3d6+2": a number of dice, their sides, and a flat modifier.
	export function rollHisDice(tmpdice) {
		var tmpmatch = ("" + tmpdice).replace(/\s+/g, "").match(/^(\d*)d(\d+)([+-]\d+)?$/i);
		if (!tmpmatch) { return parseInt(tmpdice) || 0; }
		var tmpcount = parseInt(tmpmatch[1]) || 0;
		var tmpsides = parseInt(tmpmatch[2]) || 0;
		var tmptotal = parseInt(tmpmatch[3]) || 0;
		for (var i = 0; i < tmpcount; i++) { tmptotal = tmptotal + getDieRoll(tmpsides); }
		return tmptotal;
	}

	// This is the function which reads his attack ladder as doMagicalAttack does. His order: centre,
	// right, high, left, low, then the misses, and a short miss only for a Beginner. A threshold his
	// chart has none for ("-") is NaN, which every comparison fails, as in his code.
	function readLadder(tmptotal, tmpskill, tmphitcenter, tmphitright, tmphithigh, tmphitleft, tmphitlow,
			tmpmissright, tmpmisshigh, tmpmissleft, tmpmisslow, tmpmissshort) {
		if (tmptotal >= tmphitcenter) { return "Hit(Center)"; }
		if (tmptotal >= tmphitright)  { return "Hit(Right)"; }
		if (tmptotal >= tmphithigh)   { return "Hit(High)"; }
		if (tmptotal >= tmphitleft)   { return "Hit(Left)"; }
		if (tmptotal >= tmphitlow)    { return "Hit(Low)"; }
		if (tmptotal >= tmpmissright) { return "Miss(Right)"; }
		if (tmptotal >= tmpmisshigh)  { return "Miss(High)"; }
		if (tmptotal >= tmpmissleft)  { return "Miss(Left)"; }
		if (tmptotal >= tmpmisslow)   { return "Miss(Low)"; }
		if (tmptotal >= tmpmissshort && tmpskill == "Beginner") { return "Miss(Short)"; }
		return "";
	}

// @MARKER ADD NEW casting helpers HERE
// @END (CODE)
