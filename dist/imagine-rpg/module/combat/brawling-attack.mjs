// @START (CODE)
// @MARKER BRAWLING ATTACKS
//==================================================================================================================
// The part of brawling that talks to Foundry: rolling the attack and writing it to chat. The
// questions are asked by the Brawling window (module/apps/brawling.mjs), the arithmetic is in
// brawling-rules.mjs and is tested there; this gathers the inputs, rolls the dice and records the
// results -- the division attack.mjs keeps for weapons.
//
// The chat card carries the weapon card's own "imagine-rpg.attack" flag, in the same shape, so its
// Apply Damage and Spend Seconds buttons are wired by attack.mjs's listener and run through exactly
// the same damage pipeline. A twist's damage bypasses armour, and the card says so and the damage
// dialog starts with its box ticked.
//
// His handleBrawling (sheet-worker.js:69670) in Foundry's order: the twists first, since they roll
// no d20; then the d20 down the attack chart, the fumble, the damage, the multiples.
//==================================================================================================================

import { resolveAttack, getSituationalForAttack, getSituationalNotes, getWeightDamageAdjust } from "./combat-rules.mjs";
import { getBrawlingValues, getBrawlingSpeed, getBrawlingToHitModifiers, isTwist, isForceTwist,
         isHandToHand, resolveForceTwist, resolveBrawlingFumble, resolveBrawlingDamage, isFlatDamage }
	from "./brawling-rules.mjs";
import { getMartialAttackModifiers, addMartialDice, getWeaponMartialStrength, getStanceSkillBonus } from "./martial-arts.mjs";
import { findActorCombatant } from "./combat-document.mjs";

	// This is the function which rolls one die formula and returns the Roll, so it can be attached
	// to the chat message and shown with Foundry's own dice.
	async function rollFormula(tmpformula, tmpoptions) {
		return await new Roll(tmpformula).evaluate(tmpoptions ?? {});
	}

	// This is the function which rolls a single die and returns the number, for the dice the rules
	// functions take as arguments.
	async function rollDie(tmpformula) {
		return (await rollFormula(tmpformula)).total;
	}

	// This is the function which finds an actor's combatant in the current combat, if they have one.
	function findCombatant(tmpactor) {
		return findActorCombatant(tmpactor, game.combat);
	}

// @MARKER THE FORCE SKILL
	// This is the function which reads an actor's Force skill chance, for a Force Twist. A
	// character's is its skill item's total, the best of several copies; a creature's is the flat
	// percentage on its stat block, plus a held stance's bonus. Null when the skill is not held at
	// all -- the Situation Mods window's #getSkillChance, which this follows.
	export function getForceChance(tmpactor) {
		if (!tmpactor) { return null; }
		if (tmpactor.type == "character") {
			var tmpcopies = tmpactor.items.filter(tmpitem => tmpitem.type == "skill" && tmpitem.name == "Force");
			if (!tmpcopies.length) { return null; }
			return Math.max(...tmpcopies.map(tmpitem => parseInt(tmpitem.system.totalChance) || 0));
		}
		var tmpskill = (tmpactor.system.skills ?? []).find(tmpentry => tmpentry.name == "Force");
		if (!tmpskill) { return null; }
		return (parseInt(tmpskill.chance) || 0) + getStanceSkillBonus(tmpactor.system.martial?.state?.bonuses, "Force", []);
	}

// @MARKER THE ROLL
// This is the function which makes a brawling attack and writes it to chat.
//
//   tmpoptions = {
//       name:          the row chosen ("Fist(Punch)", "Weapon Twist")
//       aim:           the area aimed at -- for a twist, the area the weapon is set in
//       situational:   a typed modifier to hit, his ?{Modifier}
//       calledShot, calledShotMod, fumbleMod, useDefense   as the weapon attack's dialog gives them
//   }
//   tmptarget   the targeted token, or null
export async function rollBrawlingAttack(tmpactor, tmpoptions, tmptarget) {
	var tmprow = getBrawlingValues(tmpoptions?.name);
	if (!tmprow) {
		// His "selected no brawling attack. Nothing done."
		ui.notifications.warn(`${tmpactor.name} selected no brawling attack. Nothing done.`);
		return null;
	}
	var tmpsys = tmpactor.system;
	var tmpo = tmpoptions ?? {};

	// The Situation Mods, cut to a melee attack: a brawl reads the melee panel and nothing of the
	// missile one, as his handleBrawling reads situational_mod_melee.
	var tmpsitmods = getSituationalForAttack(tmpsys.combat.situational, "smash");
	if (tmpsitmods.noAttack) {
		ui.notifications.warn(`${tmpactor.name} is in Desperate Defense and cannot attack. Clear it from the Situation Mods first.`);
		return null;
	}

	// Martial arts: the stance held and the moves made count on a brawl as on a weapon attack --
	// his handleBrawling reads martial_arts_mod_* and martial_stance_mod_* beside the rest. The
	// stance's speed is already in weaponSpeedMod, which getBrawlingSpeed reads.
	var tmpmartial = getMartialAttackModifiers(tmpsys.martial?.state, { mode: "smash", martialAttack: false });
	if (tmpmartial.noAttack) {
		ui.notifications.warn(`${tmpactor.name} cannot attack: ${tmpmartial.noAttackReason}. Clear it from the Martial Arts panel first.`);
		return null;
	}

	var tmptwist = isTwist(tmprow.name);
	var tmpforce = isForceTwist(tmprow.name);
	var tmprolls = [];
	var tmpresult = null;
	var tmpmods = { list: [], total: 0 };
	var tmpskill = null;
	var tmpdamagerow = tmprow;

	if (tmptwist) {
		// @MARKER A TWIST
		// No roll to hit: the weapon is in the wound. A Force Twist rolls the Force skill first, and
		// failed is a Weapon Twist of its size -- resolveForceTwist.
		if (tmpforce) {
			var tmpchance = getForceChance(tmpactor);
			var tmpd100 = await rollFormula("1d100");
			tmprolls.push(tmpd100);
			tmpskill = resolveForceTwist(tmprow.name, tmpchance, tmpd100.total);
			tmpdamagerow = tmpskill.damageRow;
		}
		tmpresult = { natural: 0, final: 0, skill: tmpsys.combat.attackSkill, isLore: false,
		              zone: "Twist", isHit: true, isFumble: false, calledShotDeclared: false, isCalledShot: false,
		              twist: true };
	} else {
		// @MARKER DOWN THE CHART
		tmpmods = getBrawlingToHitModifiers({
			attacker: { meleeAttack: tmpsys.combat.meleeAttack, meleeMisc: tmpsys.combat.meleeMisc },
			target: (tmptarget && tmpo.useDefense) ? { defensiveAdjust: tmptarget.actor?.system?.combat?.defensiveAdjust } : null,
			situation: tmpsitmods.attack,
			situational: tmpo.situational,
			martial: tmpmartial.list
		});
		var tmpd20 = await rollFormula("1d20");
		tmprolls.push(tmpd20);
		tmpresult = resolveAttack({
			natural: tmpd20.total, mods: tmpmods.total, skill: tmpsys.combat.attackSkill,
			calledShot: !!tmpo.calledShot, calledShotMod: tmpo.calledShotMod, fumbleMod: tmpo.fumbleMod
		});
	}

	// Time: the row's speed with the character's modifier, never under its minimum; a called shot
	// one more; a move made its own seconds on top.
	var tmpspeed = getBrawlingSpeed(tmprow.name, tmpsys.combat.weaponSpeedMod) + tmpmartial.seconds;
	if (tmpo.calledShot && !tmptwist) { tmpspeed = tmpspeed + 1; }
	if (tmpspeed < 1) { tmpspeed = 1; }

	// A fumble: his brawling one, with no weapon to throw.
	var tmpfumble = null;
	if (tmpresult.isFumble) {
		tmpfumble = resolveBrawlingFumble(tmpsys.attributes.agl.save, {
			saveRoll: await rollDie("1d100"), recoveryRoll: await rollDie("1d4"), severityRoll: await rollDie("1d100"),
			standRoll: await rollDie("1d6"), criticalRoll: await rollDie("1d100"), variantRoll: await rollDie("1d100"),
			throwRoll: await rollDie("1d20"), directionRoll: await rollDie("1d8"), stunRoll: await rollDie("1d3")
		});
	}

	// @MARKER DAMAGE
	var tmpdamage = null;
	if (tmpresult.isHit) {
		// A stance's extra die goes onto the dice (a flat "1" takes none -- addMartialDice keeps his
		// "cannot add dice to '1'"), and everything flat is added after the roll, in his order.
		var tmpdice = addMartialDice(tmpdamagerow.damage, tmpmartial.damage.extraDice);
		var tmpdmgroll = await rollFormula(tmpdice, tmpsitmods.maxDamage ? { maximize: true } : {});
		tmprolls.push(tmpdmgroll);
		// His combat_mod_damage on a brawl is Strength and body weight (setCombatModifierValues,
		// 82322, with no weapon in hand): Strength through the move made (Tension, Snap), signed
		// weight for a character and floored for a creature. The Game Master's temporary damage
		// modifier beside them, as every other attack reads it.
		var tmpstr = getWeaponMartialStrength(tmpsys.combat.meleeDamage, "smash", tmpmartial.damage.strength, false);
		var tmpweight = getWeightDamageAdjust(tmpsys.physical?.weight, tmpactor.type == "creature");
		var tmpmisc = parseInt(tmpsys.combat.damageMisc) || 0;
		var tmpmultipliers = [];
		if (tmpsitmods.multi != 1) { tmpmultipliers.push(tmpsitmods.multi); }
		if (tmpmartial.damage.multiplier != 1) { tmpmultipliers.push(tmpmartial.damage.multiplier); }
		var tmpresolved = resolveBrawlingDamage({
			rolled: tmpdmgroll.total, dice: tmpdice, strength: tmpstr, weight: tmpweight, misc: tmpmisc,
			flat: tmpmartial.damage.flat + tmpsitmods.damage,
			perDie: tmpmartial.damage.perDie + tmpsitmods.perDie,
			multipliers: tmpmultipliers,
			halve: (!tmptwist && !!tmpo.calledShot) || tmpsitmods.halfDamage
		});
		tmpdamage = {
			dice: tmpdice, flatDice: isFlatDamage(tmpdice), rolled: tmpdmgroll.total,
			str: tmpstr, weight: tmpweight, misc: tmpmisc,
			flat: tmpmartial.damage.flat + tmpsitmods.damage, perDie: tmpresolved.perDie,
			maximized: !!tmpsitmods.maxDamage,
			multiplier: tmpresolved.multiplier, halved: tmpresolved.halved, total: tmpresolved.total,
			type: tmpdamagerow.damageType,
			// A twist goes straight to the area the weapon is in: the damage dialog starts with its
			// armour box ticked (askDamageOptions, attack.mjs).
			bypass: tmptwist,
			// Read by the damage pipeline's invulnerability test: a fist has no magical plus.
			magic: 0
		};
	}

	// @MARKER THE CARD
	var tmpattack = {
		attackerUuid: tmpactor.uuid,
		weapon: tmprow.name,
		mode: "smash",
		aim: tmpo.aim ?? "",
		targetUuid: tmptarget?.actor?.uuid ?? null,
		targetName: tmptarget?.name ?? null,
		result: tmpresult,
		mods: tmpmods,
		speed: tmpspeed,
		speedSpecial: false,
		// A brawl is the main hand's seconds: there is no off hand to a headbutt.
		hand: "main",
		fumble: tmpfumble,
		damage: tmpdamage,
		situation: { labels: tmpsitmods.labels, notes: getSituationalNotes(tmpsitmods.special) },
		martialNotes: tmpmartial.special,
		applied: false
	};

	var tmphtml = await foundry.applications.handlebars.renderTemplate(
		"systems/imagine-rpg/templates/chat/brawling-card.hbs", {
			...tmpattack, actorName: tmpactor.name,
			row: tmprow, isTwist: tmptwist, isForceTwist: tmpforce, isHandToHand: isHandToHand(tmprow.name),
			force: tmpskill, damageRowName: tmpdamagerow.name,
			inCombat: !!findCombatant(tmpactor)
		});

	return await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
		content: tmphtml,
		rolls: tmprolls,
		flags: { "imagine-rpg": { attack: tmpattack } }
	});
}
// @END (CODE)
