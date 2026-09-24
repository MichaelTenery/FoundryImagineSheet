// @START (CODE)
// @MARKER CREATURE ATTACK
//==================================================================================================================
// Rolling one of a creature's natural attacks, and writing it to chat.
//
// The thin Foundry layer over combat/creature-rules.mjs, in the same shape as combat/attack.mjs
// is over combat-rules.mjs: this asks how the attack is being made, rolls the dice, and renders
// the card. Every rule it applies lives in the pure module.
//
// The card carries the same "attack" flag a weapon attack does, so the Apply Damage and Spend
// Seconds buttons already wired by registerAttackCardListeners work on it unchanged.
//==================================================================================================================

import { addMartialDice } from "./martial-arts.mjs";
import { resolveAttack, resolveFumble, resolveOffhandPenalties, combineDamageMultipliers,
         getSituationalForAttack, getSituationalNotes, getNumberOfDice } from "./combat-rules.mjs";
import {
	getCreatureAttackBehaviour, getAreaAttackSize, resolveTouchAttack,
	getCreatureToHitModifiers, getCreatureDamageMods, getTriggeredEffects, getCreatureAttackSeconds,
	getCreatureMartialModifiers } from "./creature-rules.mjs";
import { getActionHand } from "./round-rules.mjs";
import { findActorCombatant } from "./combat-document.mjs";

	// This is the function which rolls a single die and returns the number.
	async function rollDie(tmpformula) {
		var tmproll = await new Roll(tmpformula).evaluate();
		return tmproll.total;
	}

	// This is the function which escapes text for chat. Item and actor names are editable, so
	// they never go into markup raw.
	function esc(tmptext) {
		return foundry.utils.escapeHTML(String(tmptext ?? ""));
	}

	// This is the function which finds an actor's combatant in the current combat, if they have
	// one -- findActorCombatant (combat-document.mjs), which matches a token's own actor rather than
	// its base actor's id, so each unlinked token is charged for its own swing.
	function findCombatant(tmpactor) {
		return findActorCombatant(tmpactor, game.combat);
	}


// @MARKER ATTACK DIALOG

	// This is the function which asks how the attack is being made. A creature's attack has one
	// type rather than a choice of modes, so this asks only what varies: where it is aimed, any
	// situational modifier, whether a called shot is declared, and whether the target is able to
	// avoid it. Returns null if cancelled.
	async function askCreatureAttackOptions(tmpactor, tmpattack, tmptarget) {
		var tmpbehaviour = getCreatureAttackBehaviour(tmpattack.system.attackType);
		var tmpareas = tmptarget?.actor?.system?.body?.areas ?? [];
		var tmpaim = tmpareas.length
			? tmpareas.map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join("")
			: `<option value="">(no target selected)</option>`;

		// An attack that hits without a roll cannot be aimed or called.
		var tmpisauto = tmpbehaviour.resolve == "auto";

		// The creature's standing Situation Mods, as they apply to this attack's kind.
		var tmpsitmods = getSituationalForAttack(tmpactor.system.combat.situational, tmpbehaviour.mods);
		var tmpcalled = tmpsitmods.special.includes("Called Shot");
		var tmptargetnodef = !!tmptarget?.actor?.system?.combat?.noDefense;

		var tmpcontent = `
			<div class="imagine-attack-dialog">
				<p class="hint">${esc(tmpattack.name)} &mdash; ${esc(tmpattack.system.attackType)}${tmpisauto
					? ": this hits without a roll." : ""}</p>
				<div class="form-group"><label>Aimed at</label><select name="aim">${tmpaim}</select></div>
				${tmpsitmods.labels.length ? `<div class="form-group situation-summary"><label>Situation Mods</label>
					<p class="hint">${esc(tmpsitmods.labels.join(", "))}. Change them from the Combat tab.</p></div>` : ""}
				<div class="form-group"><label>Other modifier</label>
					<input type="number" name="situational" value="0"></div>
				<div class="form-group"><label>Other damage</label>
					<input type="number" name="situationalDamage" value="0"></div>
				${tmpisauto ? "" : `<div class="form-group"><label>Called shot</label>
					<input type="checkbox" name="calledShot" ${tmpcalled ? "checked" : ""}>
					<p class="hint">Needs an unmodified roll of 21 minus the attack skill level, takes one
					more second and does half damage whether it lands or not.</p></div>`}
				${(tmptarget && !tmpisauto) ? `<div class="form-group"><label>Target is avoiding the blow</label>
					<input type="checkbox" name="useDefense" ${tmptargetnodef ? "" : "checked"}>
					<p class="hint">${tmptargetnodef
						? `${esc(tmptarget.name)} has No Defense from their own Situation Mods.`
						: `Applies ${esc(tmptarget.name)}'s defensive adjustment.`} Untick if they
					are held, surprised or otherwise cannot move.</p></div>` : ""}
			</div>`;

		return await foundry.applications.api.DialogV2.prompt({
			window: { title: `${tmpattack.name} — Attack` },
			content: tmpcontent,
			rejectClose: false,
			ok: {
				label: "Attack",
				callback: (event, button) => {
					var tmpform = button.form.elements;
					return {
						aim: tmpform.aim ? tmpform.aim.value : "",
						situational: parseInt(tmpform.situational.value) || 0,
						situationalDamage: parseInt(tmpform.situationalDamage.value) || 0,
						calledShot: tmpform.calledShot ? tmpform.calledShot.checked : false,
						useDefense: tmpform.useDefense ? tmpform.useDefense.checked : false
					};
				}
			}
		});
	}


// @MARKER ATTACK ROLL

// This is the function which makes one of a creature's natural attacks and writes it to chat.
export async function rollCreatureAttack(tmpactor, tmpattackitem) {
	var tmptargets = Array.from(game.user.targets);
	var tmptarget = tmptargets.length == 1 ? tmptargets[0] : null;
	if (tmptargets.length > 1) {
		ui.notifications.info("Several tokens are targeted; attacking without a target's defence. Target one to include it.");
	}

	var tmpoptions = await askCreatureAttackOptions(tmpactor, tmpattackitem, tmptarget);
	if (!tmpoptions) { return null; }

	var tmpsys = tmpactor.system;
	var tmpa = tmpattackitem.system;
	var tmpbehaviour = getCreatureAttackBehaviour(tmpa.attackType);

	// The Situation Mods, cut to this attack's kind. See getSituationalForAttack.
	var tmpsitmods = getSituationalForAttack(tmpsys.combat.situational, tmpbehaviour.mods);
	if (tmpsitmods.noAttack) {
		ui.notifications.warn(`${tmpactor.name} is in Desperate Defense and cannot attack. Clear it from the Situation Mods first.`);
		return null;
	}

	// Martial arts, for a creature that holds them: the to-hit by the attack's kind, the damage
	// whatever its kind, and nothing at all for a touch -- see getCreatureMartialModifiers in
	// creature-rules.mjs, which corrects the old reading here of "no damage, no missile". A Flip in
	// progress forbids any attack.
	//
	// His multiplier line has a slip -- "damMult=MAModMulti", not damMulti, so a martial multiplier
	// with no situational one never applies (180008). The evident intent is followed, as on the
	// character's weapon attack; already docs/UPSTREAM-ISSUES.md item 14.
	var tmpistouch = (tmpbehaviour.resolve == "touch");
	var tmpmartial = getCreatureMartialModifiers(tmpsys.martial?.state, tmpbehaviour);
	if (tmpmartial.noAttack) {
		ui.notifications.warn(`${tmpactor.name} cannot attack: ${tmpmartial.noAttackReason}.`);
		return null;
	}
	var tmpmartialhit = tmpmartial.list;
	var tmpmartialdamage = tmpmartial.damage;

	// What fighting with this attack in the off hand costs. Blank hand means the attack is not
	// hand-based at all -- a bite, a tail slap, a breath -- and is never off-hand; only an attack
	// with a hand actually set (a claw, a punch) is even asked. Creatures have no Second Weapon
	// Knowledge or Lore item flags to buy the penalty down, so it always resolves to the plain
	// Agility-banded tier once it applies. See combat.offhandHandedness in actor-creature.mjs.
	var tmpoffhand = tmpa.hand
		? resolveOffhandPenalties(tmpa, tmpsys.attributes.agl.rating, tmpsys.combat.offhandHandedness, 0)
		: { offhand: false, tier: "none", melee: 0, damage: 0, skill: 0 };

	// To hit. Weapon or Missile Lore's +2, by the attack's kind, for anything but a Touch -- whose roll
	// his code gives nothing but Agility (see the martial note above).
	var tmplorehit = tmpistouch ? 0
		: ((tmpbehaviour.mods == "missile") ? tmpsys.combat.loreMissile : tmpsys.combat.loreMelee);
	var tmpmods = getCreatureToHitModifiers({
		mods: tmpbehaviour.mods,
		attacker: {
			meleeAttack: tmpsys.combat.meleeAttack,
			missileAttack: tmpsys.combat.missileAttack,
			meleeMisc: tmpsys.combat.meleeMisc,
			missileMisc: tmpsys.combat.missileMisc
		},
		target: (tmptarget && tmpoptions.useDefense) ? { defensiveAdjust: tmptarget.actor?.system?.combat?.defensiveAdjust } : null,
		situation: tmpsitmods.attack,
		situational: tmpoptions.situational,
		offhand: tmpoffhand.melee,
		lore: tmplorehit
	});
	tmpmods.list.push(...tmpmartialhit);
	tmpmods.total = tmpmods.total + tmpmartialhit.reduce((tmpsum, tmpm) => tmpsum + tmpm.value, 0);

	// The roll, in whichever of the three ways this type resolves.
	var tmprolls = [];
	var tmpresult = null;
	var tmptouch = null;

	if (tmpbehaviour.resolve == "auto") {
		// Direct, Gaze and Voice need no roll at all. The zone is named for what it is rather
		// than borrowed from the chart, so the card does not claim a centre hit it never rolled.
		tmpresult = {
			natural: 0, final: 0, skill: tmpsys.combat.attackSkill,
			zone: tmpa.attackType, isHit: true, isFumble: false,
			calledShotDeclared: false, isCalledShot: false
		};
	} else if (tmpbehaviour.resolve == "touch") {
		var tmptouchd20 = await new Roll("1d20").evaluate();
		tmprolls.push(tmptouchd20);
		tmptouch = resolveTouchAttack(tmptouchd20.total, tmpmods.total);
		tmpresult = {
			natural: tmptouch.natural, final: tmptouch.total, skill: tmpsys.combat.attackSkill,
			zone: tmptouch.touched ? "Touched" : "Missed", isHit: tmptouch.touched, isFumble: false,
			calledShotDeclared: false, isCalledShot: false
		};
	} else {
		var tmpd20 = await new Roll("1d20").evaluate();
		tmprolls.push(tmpd20);
		tmpresult = resolveAttack({
			natural: tmpd20.total,
			mods: tmpmods.total,
			skill: tmpsys.combat.attackSkill,
			calledShot: tmpoptions.calledShot
		});
	}

	// How long it takes. A creature's attack carries its own seconds; there is no weapon speed
	// modifier to fold in. A called shot takes one more second (Player's Guide, Called Shots).
	var tmpspeed = getCreatureAttackSeconds(tmpa, tmpoptions.calledShot);

	// A fumble, on the same three tiers a weapon attack uses.
	var tmpfumble = null;
	if (tmpresult.isFumble) {
		tmpfumble = resolveFumble(tmpsys.attributes.agl.save, tmpbehaviour.mods == "missile", {
			saveRoll: await rollDie("1d100"),
			recoveryRoll: await rollDie("1d4"),
			severityRoll: await rollDie("1d100"),
			effectRoll: await rollDie(tmpbehaviour.mods == "missile" ? "1d6" : "1d20"),
			// His critical fumble table, rolled up front so the rules stay free of dice.
			criticalRoll: await rollDie("1d100"),
			variantRoll: await rollDie("1d100"),
			standRoll: await rollDie("1d6"),
			throwRoll: await rollDie("1d20"),
			directionRoll: await rollDie("1d8"),
			stunRoll: await rollDie("1d3")
		});
	}

	// The area an attack of this shape covers, sized from the creature's own Endurance.
	var tmpshape = null;
	if (tmpbehaviour.shape) {
		var tmpconedice = tmpbehaviour.shape == "cone" ? await rollDie("1d4") : 0;
		tmpshape = getAreaAttackSize(tmpbehaviour.shape, tmpbehaviour.tier,
			tmpsys.characteristics.endurance.value, tmpconedice);
	}

	// Damage.
	//
	// A called shot does half whether or not it is made, as for a character. His creature path
	// does not halve it, though his character path and the book both do -- recorded in
	// docs/UPSTREAM-ISSUES.md item 15 -- and the two actor types are kept consistent here.
	//
	// An attack with no damage entered does none, whatever its modifiers. His code turns a blank damage
	// into "0" and still adds combat_mod_damage to it (179919-179925), so a creature's damage-less gaze
	// would do its Strength and weight in damage -- +17 for a buffalo's stare. That cannot be meant, and
	// the port has never done it; it is part of the question put to him about which attacks the
	// standing damage belongs on (docs/UPSTREAM-ISSUES.md, 2026-09-23).
	var tmpdamage = null;
	// A damage that is not dice ("2d6 poison", "special") is not handed to Roll, which would throw
	// after the attack was rolled and post nothing; the card says the table settles it. Tested on the
	// damage as entered, before any martial die is added to it.
	var tmpdicenote = "";
	if (tmpresult.isHit && tmpa.damage && !Roll.validate(tmpa.damage)) {
		tmpdicenote = `The damage "${tmpa.damage}" is not a dice roll; the table settles it.`;
	}
	if (tmpresult.isHit && tmpa.damage && !tmpdicenote) {
		// A stance's or a move's extra dice (his "+1 Die Dam"), which then count for everything worked
		// out per die below. A flat damage figure takes none -- see addMartialDice.
		var tmpdice = addMartialDice(tmpa.damage, tmpmartialdamage.extraDice);
		var tmpdammods = getCreatureDamageMods({
			resolve: tmpbehaviour.resolve,
			strength: tmpsys.combat.meleeDamage,
			weight: tmpsys.combat.weightDamage,
			lore: tmpsys.combat.loreDamage,
			damageMisc: tmpsys.combat.damageMisc,
			martial: tmpmartialdamage.flat + (tmpmartialdamage.perDie * getNumberOfDice(tmpdice)),
			situation: tmpsitmods.damage + (tmpsitmods.perDie * getNumberOfDice(tmpdice)),
			situational: tmpoptions.situationalDamage,
			offhand: tmpoffhand.damage
		});

		// Maximum damage from the Situation Mods is his "Max" special, which his touch branch never
		// reads (it rolls its dice plainly), so a touch rolls them plainly here too.
		var tmpmaximize = tmpsitmods.maxDamage && !tmpistouch;
		var tmpdmgroll = await new Roll(`${tmpdice} + @mods`, { mods: tmpdammods.total })
			.evaluate({ maximize: tmpmaximize });
		tmprolls.push(tmpdmgroll);

		// The Situation Mods' multiplier and a martial one, then a called shot or a critically failed
		// Perfect Shot halving it, held at x3 -- as for a character. A touch has none of his multiplier
		// handling, which sits in his non-touch branch.
		var tmpmultipliers = [];
		if (!tmpistouch && tmpsitmods.multi != 1) { tmpmultipliers.push(tmpsitmods.multi); }
		if (tmpmartialdamage.multiplier != 1) { tmpmultipliers.push(tmpmartialdamage.multiplier); }
		if (tmpoptions.calledShot) { tmpmultipliers.push(0.5); }
		if (tmpsitmods.halfDamage) { tmpmultipliers.push(0.5); }
		var tmpmulti = combineDamageMultipliers(tmpmultipliers);
		var tmptotal = Math.max(0, parseInt(tmpdmgroll.total * tmpmulti) || 0);

		tmpdamage = {
			dice: tmpdice, str: tmpistouch ? 0 : (parseInt(tmpsys.combat.meleeDamage) || 0), magic: 0,
			misc: tmpdammods.total, list: tmpdammods.list,
			rolled: tmpdmgroll.total, multiplier: tmpmulti, total: tmptotal,
			maximized: tmpmaximize, situationMulti: tmpistouch ? 1 : tmpsitmods.multi,
			martialMulti: tmpmartialdamage.multiplier,
			type: tmpa.damageType || "Other"
		};
	}

	// Which rider effects this result sets off.
	var tmpeffects = getTriggeredEffects(tmpa.effects, {
		isHit: tmpresult.isHit,
		isCalledShot: tmpresult.isCalledShot,
		damageTotal: tmpdamage ? tmpdamage.total : 0
	});

	// The chat card. Same flag shape as a weapon attack, so Apply Damage and Spend Seconds work.
	var tmpattack = {
		attackerUuid: tmpactor.uuid,
		weapon: tmpattackitem.name,
		mode: tmpa.attackType,
		aim: tmpoptions.aim,
		targetUuid: tmptarget?.actor?.uuid ?? null,
		targetName: tmptarget?.name ?? null,
		result: tmpresult,
		mods: tmpmods,
		speed: tmpspeed,
		// Which clock the attack runs on. Blank hand -- a bite, a breath -- is never the off hand.
		hand: getActionHand(tmpa.hand, tmpsys.combat.offhandHandedness),
		fumble: tmpfumble,
		damage: tmpdamage,
		situation: { labels: tmpsitmods.labels, notes: getSituationalNotes(tmpsitmods.special).concat(tmpdicenote ? [tmpdicenote] : []) },
		// The stance's and moves' own prose, for the table -- as the weapon card carries it.
		martialNotes: tmpmartial.special,
		applied: false
	};

	var tmphtml = await foundry.applications.handlebars.renderTemplate(
		"systems/imagine-rpg/templates/chat/creature-attack-card.hbs",
		{
			...tmpattack,
			actorName: tmpactor.name,
			attackType: tmpa.attackType,
			speedSpecial: tmpa.speedSpecial,
			shape: tmpshape,
			effects: tmpeffects,
			resolveKind: tmpbehaviour.resolve,
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
