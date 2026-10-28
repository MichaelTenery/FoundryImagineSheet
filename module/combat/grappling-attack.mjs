// @START (CODE)
// @MARKER GRAPPLING ATTACKS
//==================================================================================================================
// The part of grappling that talks to Foundry: rolling the d20 and the d100 and writing the result to
// chat. The question is asked by the Grappling window (module/apps/grappling.mjs); the arithmetic is in
// grappling-rules.mjs and is tested there. His handleGrappling (sheet-worker.js:69156) read these off the
// sheet; this gathers the same figures from the actor.
//
//     combat_mod_missile_agl   -> combat.missileAttack     (the touch's Agility modifier)
//     str_save, agl_save       -> attributes.str.save, attributes.agl.save
//     attack_skill_hit_called_shot -> the attack chart's called shot number for the attack skill
//     combat_mod_damage + situational_mod_damage + martial_*_mod_damage
//                              -> Strength and body weight, the Game Master's damage modifier, the
//                                 Situation Mods' and the martial arts' flat damage (as brawling reads them)
//
// A grapple move's damage goes through the same Apply Damage button and dialog as every other blow
// (applyAttackDamage, attack.mjs): the card carries an "attack" flag of the weapon card's shape. Where
// it lands is getGrappleLanding's (grappling-rules.mjs) -- his "1 random area", the ear, an eye, the
// neck -- read against the targeted token's body when there is one at the roll, and otherwise when
// the damage is applied (askDamageOptions). The Game Master can move it on the figure either way.
//==================================================================================================================

import { getAttackChart, getSituationalForAttack, getWeightDamageAdjust } from "./combat-rules.mjs";
import { getMartialAttackModifiers, getWeaponMartialStrength } from "./martial-arts.mjs";
import { resolveGrappleMove, getGrapplingValues, canMakeMove, getGrappleLanding } from "./grappling-rules.mjs";

// @MARKER THE ROLL
// This is the function which makes a grapple move and writes it to chat.
//
//   tmpoptions = { name: the move chosen, modifier: his ?{Modifier} (0 for his plain ROLL) }
export async function rollGrapplingMove(tmpactor, tmpoptions) {
	var tmprow = getGrapplingValues(tmpoptions?.name);
	if (!tmprow) {
		// His "selected no grappling move or attack. Nothing done."
		ui.notifications.warn(`${tmpactor.name} selected no grappling move or attack. Nothing done.`);
		return null;
	}
	var tmpsys = tmpactor.system;
	var tmpnohands = (tmpsys.identity?.race?.disabilities ?? []).includes("All manipulator limbs lost");
	if (!canMakeMove(tmprow.name, tmpnohands)) {
		ui.notifications.warn(`${tmpactor.name} has lost every manipulator limb and can only Touch or Escape.`);
		return null;
	}

	// The Situation Mods cut to a melee attack, and the martial arts held, as a brawl reads them.
	var tmpsitmods = getSituationalForAttack(tmpsys.combat.situational, "smash");
	var tmpmartial = getMartialAttackModifiers(tmpsys.martial?.state, { mode: "smash", martialAttack: false });
	var tmpstr = getWeaponMartialStrength(tmpsys.combat.meleeDamage, "smash", tmpmartial.damage.strength, false);
	var tmpweight = getWeightDamageAdjust(tmpsys.physical?.weight, tmpactor.type == "creature");
	var tmpmisc = parseInt(tmpsys.combat.damageMisc) || 0;

	var tmprolls = [];
	var tmpd20 = await new Roll("1d20").evaluate();
	var tmpd100 = await new Roll("1d100").evaluate();
	tmprolls.push(tmpd20, tmpd100);

	// Damage dice are rolled inside the resolver, only when the move landed. Foundry's own Roll, evaluated
	// synchronously, so the dice can be attached to the message beside the d20 and the d100.
	var tmproll = (tmpformula) => {
		var tmpr = new Roll(tmpformula).evaluateSync();
		tmprolls.push(tmpr);
		return tmpr.total;
	};

	var tmpresult = resolveGrappleMove({
		move: tmprow.name,
		d20: tmpd20.total, d100: tmpd100.total,
		mod: tmpoptions.modifier,
		aglMod: tmpsys.combat.missileAttack,
		strSave: tmpsys.attributes.str.save, aglSave: tmpsys.attributes.agl.save,
		calledShot: getAttackChart(tmpsys.combat.attackSkill)?.calledShot,
		damMods: tmpstr + tmpweight + tmpmisc + tmpmartial.damage.flat + tmpsitmods.damage,
		// His tmp_extra_dice / tmp_extra_per_die from the Temporary Modifiers window as well (characters
		// only; a creature has neither, so they read as 0).
		extraDice: tmpmartial.damage.extraDice + (parseInt(tmpsys.combat.extraDice) || 0),
		extraPerDie: tmpmartial.damage.perDie + tmpsitmods.perDie + (parseInt(tmpsys.combat.extraPerDie) || 0),
		rollDice: tmproll
	});

	// @MARKER WHERE IT LANDS
	// Only a move that did damage has anywhere to land. The one targeted token, as the brawl reads it:
	// several targeted is none, and then the landing is chosen when the damage is applied.
	var tmptargets = Array.from(game.user?.targets ?? []);
	var tmptarget = tmptargets.length == 1 ? tmptargets[0] : null;
	var tmpattack = null;
	if (tmpresult.damage) {
		var tmplanding = getGrappleLanding(tmprow.name, tmptarget?.actor?.system?.body?.areas ?? [],
			(tmpsides) => Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1);
		tmpattack = {
			attackerUuid: tmpactor.uuid,
			weapon: tmprow.name,
			mode: "grapple",
			// A fixed landing is the aim as well, so the damage dialog takes it as declared; a random one
			// is a Random Location, which the dialog takes whatever the aim.
			aim: tmplanding.how == "fixed" ? tmplanding.area : "",
			landing: { area: tmplanding.area, how: tmplanding.how == "random" ? "random" : "aimed", text: tmplanding.text },
			grappleMove: tmprow.name,
			targetUuid: tmptarget?.actor?.uuid ?? null,
			targetName: tmptarget?.name ?? null,
			result: { zone: "Grapple", isHit: true },
			damage: { total: tmpresult.damage, type: tmplanding.type, bypass: tmplanding.bypass, magic: 0,
				dice: tmpresult.damageDice ?? "", rolled: tmpresult.damageRolled ?? 0 },
			applied: false
		};
	}

	var tmphtml = await foundry.applications.handlebars.renderTemplate(
		"systems/imagine-rpg/templates/chat/grappling-card.hbs", { ...tmpresult, actorName: tmpactor.name,
			landing: tmpattack?.landing ?? null, damageType: tmpattack?.damage.type ?? "",
			bypass: !!tmpattack?.damage.bypass, targetName: tmpattack?.targetName ?? null });

	return await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
		content: tmphtml,
		rolls: tmprolls,
		// The weapon card's flag, so Apply Damage (registerAttackCardListeners, attack.mjs) finds it.
		flags: tmpattack ? { "imagine-rpg": { attack: tmpattack } } : {}
	});
}
// @END (CODE)
