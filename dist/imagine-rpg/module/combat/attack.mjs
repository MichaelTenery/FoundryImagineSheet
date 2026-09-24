// @START (CODE)
// @MARKER WEAPON ATTACKS
//==================================================================================================================
// The part of combat that talks to Foundry: asking how the attack is made, rolling it, writing it
// to chat, and applying the damage to whoever was hit.
//
// All of the arithmetic lives in combat-rules.mjs and is tested there. This file only gathers the
// inputs, rolls the dice, and records the results.
//
// The attack follows the Player's Guide's sequence: the attacker declares where they are aiming,
// rolls a d20, and the modified result read against their attack chart says whether the blow
// lands and where relative to the aim. A centre hit lands exactly where aimed. An off-centre hit
// lands on whatever area sits that way from the aim on the target -- which depends on the attack's
// motion and the target's shape, so the Game Master picks it when damage is applied, just as the
// original sheet left it to the table.
//==================================================================================================================

import {
	MELEE_MODES, MODE_DAMAGE_TYPES,
	resolveAttack, resolveFumble, getToHitModifiers, resolveOffhandPenalties,
	getWeaponDamageDice, combineDamageMultipliers,
	resolveAreaDamage, applyAreaDamage, applyPainThreshold, absorbDamage, blowLands,
	applyMagicalReductions, getWeaveValue, isEndured, isRebounded, getAreaArmorSlot,
	getLoreModifiers, getProjectileLoreDamage, getWeaponSpeed,
	resolveMultiMissile, MULTI_MISSILE_MODES, getSecondWeaponFlags,
	getSituationalForAttack, getSituationalNotes, getNumberOfDice
} from "./combat-rules.mjs";
import { ARMOR_BLOCKING } from "../combat-tables.mjs";
import { getWeaponAttackExtras, resolveWeaponSpecials, getWeaponDisplayName, getCustomizedWeapon } from "../weapon-custom-rules.mjs";
import { getMartialAttackModifiers, addMartialDice, getWeaponMartialStrength } from "./martial-arts.mjs";
import { getActionHand } from "./round-rules.mjs";
import { findActorCombatant } from "./combat-document.mjs";
import { resolveCoatingDelivery, isEnvenomed } from "../lore-rules.mjs";
import { resolveTouchAttack } from "./creature-rules.mjs";
import { postPoisonOnVictims, registerPoisonCardListeners } from "../magic-actions.mjs";

const MODE_LABELS = { thrust: "Thrust", cut: "Cut", smash: "Smash", missile: "Missile" };


	// This is the function which rolls a single die and returns the number, for the dice the rules
	// functions take as arguments.
	async function rollDie(tmpformula) {
		var tmproll = await new Roll(tmpformula).evaluate();
		return tmproll.total;
	}

	// This is the function which finds an actor's combatant in the current combat, if they have
	// one -- findActorCombatant (combat-document.mjs), which matches a token's own actor rather than
	// its base actor's id, so each unlinked token is charged for its own swing.
	function findCombatant(tmpactor) {
		return findActorCombatant(tmpactor, game.combat);
	}

	// This is the function which escapes text for safe inclusion in chat HTML. Item and actor
	// names are user-editable, so they are never put into markup raw.
	function esc(tmptext) {
		return foundry.utils.escapeHTML(String(tmptext ?? ""));
	}


// @MARKER ATTACK DIALOG

	// This is the function which describes the attacker's standing Situation Mods for the attack
	// dialog, so the player can see what the roll will read without opening the window.
	function describeSituation(tmpsituation) {
		if (!tmpsituation?.kind || !(tmpsituation.labels ?? []).length) { return ""; }
		var tmpkind = tmpsituation.kind == "missile" ? "missile" : "melee";
		var tmpfigures = [];
		if (tmpsituation.attack) { tmpfigures.push(`${tmpsituation.attack > 0 ? "+" : ""}${tmpsituation.attack} to hit`); }
		if (tmpsituation.damage) { tmpfigures.push(`${tmpsituation.damage > 0 ? "+" : ""}${tmpsituation.damage} damage`); }
		if (tmpsituation.multi > 1) { tmpfigures.push(`x${tmpsituation.multi} damage`); }
		for (const tmpword of tmpsituation.special ?? []) { tmpfigures.push(tmpword.replace("`", "'")); }
		return `<div class="form-group situation-summary"><label>Situation Mods</label>
			<p class="hint">Set for <strong>${tmpkind}</strong> attacks, and only those: ${esc(tmpsituation.labels.join(", "))}
			${tmpfigures.length ? `&mdash; ${esc(tmpfigures.join(", "))}` : ""}. Change them from the Combat tab.</p></div>`;
	}

	// This is the function which asks how the attack is being made: which mode, where it is aimed,
	// whether it is a called shot, and any situational modifier. Returns null if cancelled.
	//
	// The Situation Mods the attacker has set are shown, and fill in the called shot and the
	// firing mode they imply; the player can still change either here.
	async function askAttackOptions(tmpweapon, tmptarget, tmpsituation) {
		// A Dulled weapon smashes only -- his listing changes; see getCustomizedWeapon.
		var tmpcustomized = getCustomizedWeapon(tmpweapon.system);
		var tmpmodes = ["thrust", "cut", "smash", "missile"].filter(m => tmpcustomized[m]?.available);
		if (!tmpmodes.length) {
			ui.notifications.warn(`${tmpweapon.name} has no attack modes.`);
			return null;
		}

		var tmpareas = tmptarget?.actor?.system?.body?.areas ?? [];
		var tmpaim = tmpareas.length
			? tmpareas.map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join("")
			: `<option value="">(no target selected)</option>`;

		var tmpcalled = (tmpsituation?.special ?? []).includes("Called Shot");
		var tmpfiring = tmpsituation?.multiMissile ?? "";
		// A target who cannot defend -- blind, or unable to see this attacker -- has lost their
		// defensive adjustment, so the box starts unticked for them.
		var tmptargetnodef = !!tmptarget?.actor?.system?.combat?.noDefense;

		var tmpcontent = `
			<div class="imagine-attack-dialog">
				<div class="form-group"><label>Attack</label>
					<select name="mode">${tmpmodes.map(m =>
						`<option value="${m}">${MODE_LABELS[m]} (${tmpweapon.system[m].mod >= 0 ? "+" : ""}${tmpweapon.system[m].mod})</option>`).join("")}
					</select></div>
				<div class="form-group"><label>Aimed at</label><select name="aim">${tmpaim}</select></div>
				${describeSituation(tmpsituation)}
				${tmpweapon.system.missile?.available ? `<div class="form-group"><label>Firing</label>
					<select name="multiMissile">
						<option value="">One at a time</option>
						${Object.entries(MULTI_MISSILE_MODES).map(([k, m]) =>
							`<option value="${k}" ${k == tmpfiring ? "selected" : ""}>${m.label} (${m.attack} to hit${m.damage ? `, ${m.damage} damage` : ""})</option>`).join("")}
					</select>
					<p class="hint">Double and triple missile fire is only allowed at point blank or short
					range. Multiple Missile Knowledge or Lore for this launcher and missile pays the
					penalty down or removes it.</p></div>` : ""}
				<div class="form-group"><label>Other modifier</label>
					<input type="number" name="situational" value="0">
					<p class="hint">Anything the Situation Mods do not list.</p></div>
				<div class="form-group"><label>Called shot</label>
					<input type="checkbox" name="calledShot" ${tmpcalled ? "checked" : ""}>
					<p class="hint">Needs an unmodified roll of 21 minus your attack skill level, takes one more
					second and does half damage whether it lands or not.</p></div>
				${tmptarget ? `<div class="form-group"><label>Target is avoiding the blow</label>
					<input type="checkbox" name="useDefense" ${tmptargetnodef ? "" : "checked"}>
					<p class="hint">${tmptargetnodef
						? `${esc(tmptarget.name)} has No Defense from their own Situation Mods.`
						: `Applies ${esc(tmptarget.name)}'s defensive adjustment.`} Untick if they
					are held, surprised or otherwise cannot move.</p></div>` : ""}
			</div>`;

		return await foundry.applications.api.DialogV2.prompt({
			window: { title: `${tmpweapon.name} — Attack` },
			content: tmpcontent,
			rejectClose: false,
			ok: {
				label: "Attack",
				callback: (event, button) => {
					var tmpform = button.form.elements;
					return {
						mode: tmpform.mode.value,
						aim: tmpform.aim.value,
						situational: parseInt(tmpform.situational.value) || 0,
						calledShot: tmpform.calledShot.checked,
						useDefense: tmpform.useDefense ? tmpform.useDefense.checked : false,
						multiMissile: tmpform.multiMissile ? tmpform.multiMissile.value : ""
					};
				}
			}
		});
	}


// @MARKER ATTACK ROLL

// This is the function which makes a weapon attack and writes it to chat.
export async function rollWeaponAttack(tmpactor, tmpweapon) {
	var tmptargets = Array.from(game.user.targets);
	var tmptarget = tmptargets.length == 1 ? tmptargets[0] : null;
	if (tmptargets.length > 1) {
		ui.notifications.info("Several tokens are targeted; attacking without a target's defence. Target one to include it.");
	}

	var tmpoptions = await askAttackOptions(tmpweapon, tmptarget, tmpactor.system.combat.situational);
	if (!tmpoptions) { return null; }

	var tmpsys = tmpactor.system;
	// The weapon as his combat sheet carries it: its customizations, quality, condition and plus
	// already worked into its damage, speed and modes (his setEquippedWeaponInCombatSheet). The
	// stored figures are left as they are. See getCustomizedWeapon.
	var tmpw = getCustomizedWeapon(tmpweapon.system);
	var tmpmode = tmpoptions.mode;

	// The Situation Mods, cut to this kind of attack: set for missile, a sword blow reads none of
	// them. See getSituationalForAttack.
	var tmpsitmods = getSituationalForAttack(tmpsys.combat.situational, tmpmode);

	// Desperate Defense: "No Attack" while it is set. His attack roll stops here with a message.
	if (tmpsitmods.noAttack) {
		ui.notifications.warn(`${tmpactor.name} is in Desperate Defense and cannot attack. Clear it from the Situation Mods first.`);
		return null;
	}

	// Martial arts: the stance held and the moves made count on a weapon attack too, as his
	// handlePhysicalAttacks reads martial_arts_mod_* and martial_stance_mod_* beside the rest. A
	// missile attack takes only the stance's missile to-hit. The stance's defence, initiative and
	// speed are already in the character's standing figures, so they are not added again here.
	var tmpmartial = getMartialAttackModifiers(tmpsys.martial?.state, { mode: tmpmode, martialAttack: false });
	if (tmpmartial.noAttack) {
		ui.notifications.warn(`${tmpactor.name} cannot attack: ${tmpmartial.noAttackReason}. Clear it from the Martial Arts panel first.`);
		return null;
	}

	// Weapon or Missile Lore, if this character has it. It is worth a flat set of figures for
	// every weapon of the right kind, and a larger set INSTEAD for a weapon specifically lored.
	// Melee reads Weapon Lore, missile reads Missile Lore, and neither touches the other.
	var tmplore = getLoreModifiers({
		mode: tmpmode,
		weaponName: tmpweapon.name,
		hasWeaponLore: tmpsys.combat.hasWeaponLore,
		hasMissileLore: tmpsys.combat.hasMissileLore,
		weaponLoreList: tmpsys.combat.weaponLoreNames,
		missileLoreList: tmpsys.combat.missileLoreNames
	});

	// What fighting with this weapon in the off hand costs. Off-handedness is derived from the
	// weapon's hand against the character's handedness, so nothing is stored and an Ambidextrous
	// character is simply never off-hand. Applies to missile attacks as well as melee -- see the
	// note in getToHitModifiers. The Knowledge chance is already gated by title eligibility on
	// the actor (0 if the class has not reached it), so it is passed through as-is.
	//
	// Which discipline this weapon is held under comes from the character's two lists of weapon
	// names, not from the weapon -- his per-weapon flags were only ever set from those lists.
	var tmpsecond = getSecondWeaponFlags({
		weaponName: tmpweapon.name,
		hasSecondWeaponKnowledge: tmpsys.combat.hasSecondWeaponKnowledge,
		hasSecondWeaponLore: tmpsys.combat.hasSecondWeaponLore,
		secondWeaponKnowList: tmpsys.combat.secondWeaponKnowNames,
		secondWeaponLoreList: tmpsys.combat.secondWeaponLoreNames
	});
	var tmpoffhand = resolveOffhandPenalties({ ...tmpw, ...tmpsecond }, tmpsys.attributes.agl.rating,
		tmpsys.physical?.handedness, tmpsys.combat.secondWeaponKnowChance);

	// Firing more than one missile at a time, and what the two multi-missile skills pay back of
	// the penalty for it. Learned per launcher/missile combination rather than held in general,
	// so both lists are passed and the weapon in hand is matched against them.
	var tmpmissiles = resolveMultiMissile({
		// Firing two or three at once is a missile attack's only: his sheet reads it only when the
		// attack is a missile (tempMissileCheck). A Dagger THRUST must not take the Firing box's -4,
		// which the dialog shows for any weapon that can be thrown and fills from the missile mods.
		mode: tmpmode == "missile" ? tmpoptions.multiMissile : "",
		weaponName: tmpweapon.name,
		knowChance: tmpsys.combat.multiMissileKnowChance,
		knowList: tmpsys.combat.multiMissileKnowList,
		loreList: tmpsys.combat.multiMissileLoreList
	});

	// To hit
	var tmpmods = getToHitModifiers({
		mode: tmpmode,
		weapon: tmpw,
		attacker: {
			meleeAttack: tmpsys.combat.meleeAttack,
			missileAttack: tmpsys.combat.missileAttack,
			meleeMisc: tmpsys.combat.meleeMisc,
			missileMisc: tmpsys.combat.missileMisc
		},
		target: (tmptarget && tmpoptions.useDefense) ? { defensiveAdjust: tmptarget.actor?.system?.combat?.defensiveAdjust } : null,
		situation: tmpsitmods.attack,
		situational: tmpoptions.situational,
		lore: tmplore.attack,
		offhand: tmpoffhand.melee,
		multiMissile: tmpmissiles.attack
	});
	// The martial entries go onto the same list, labelled as his card labels them ("Stance",
	// "Martial"), so the chat card shows them by name with everything else.
	tmpmods.list.push(...tmpmartial.list);
	tmpmods.total = tmpmods.total + tmpmartial.total;

	// What has been done to the weapon: a rune of its attack's kind, Blessed (for now or for good),
	// and the Game Master's own temporary effects. The magical plus is already "Magic" above. See
	// module/weapon-custom-rules.mjs and the weapon mods window.
	var tmpcustom = getWeaponAttackExtras({ system: tmpw, mode: tmpmode, alignment: tmpsys.identity?.alignment,
		worldTime: game.time?.worldTime ?? 0 });
	for (const tmpentry of tmpcustom.toHit) {
		tmpmods.list.push(tmpentry);
		tmpmods.total = tmpmods.total + tmpentry.value;
	}

	var tmpd20 = await new Roll("1d20").evaluate();
	var tmpresult = resolveAttack({
		natural: tmpd20.total,
		mods: tmpmods.total,
		skill: tmpsys.combat.attackSkill,
		calledShot: tmpoptions.calledShot
	});

	// @MARKER TOUCH ATTACK
	// A touch -- a Brok's Harm Touch, a Mephyt's Heat Skin, a Centaur's Trample -- is not read down
	// the attack chart. His handleNaturalAttack sends every natural attack whose type names a Touch to
	// handleTouchAttack (sheet-worker.js:70044-70052, 67731): the d20, the declared modifier and the
	// Agility missile modifier (his combat_mod_missile_agl), 10 or better makes contact, a 1 always
	// misses. No Strength, lore, situation or martial figure reaches it, and there is no fumble and no
	// called shot. The creature path's touch (creature-attack.mjs) reads the same rule.
	var tmpistouch = !!tmpw.touch;
	if (tmpistouch) {
		var tmpaglmod = parseInt(tmpsys.combat.missileAttack) || 0;
		var tmptyped = parseInt(tmpoptions.situational) || 0;
		tmpmods = { list: [], total: tmpaglmod + tmptyped };
		if (tmpaglmod) { tmpmods.list.push({ label: "Agility", value: tmpaglmod }); }
		if (tmptyped) { tmpmods.list.push({ label: "Modifier", value: tmptyped }); }
		var tmptouch = resolveTouchAttack(tmpd20.total, tmpmods.total);
		tmpresult = {
			natural: tmptouch.natural, final: tmptouch.total, skill: tmpsys.combat.attackSkill,
			zone: tmptouch.touched ? "Touched" : "Missed", isHit: tmptouch.touched, isFumble: false,
			calledShotDeclared: false, isCalledShot: false, touch: true
		};
	}

	// Time. A called shot takes one more second (Player's Guide, Called Shots).
	// Lore makes a swing quicker, and its speed figure is a total rather than an extra: a lored
	// weapon is -2, not -1 general and -2 again. See LORE_GENERAL / LORE_SPECIFIC.
	var tmpspeed = getWeaponSpeed(tmpw.speed, tmpw.minSpeed,
		tmpsys.combat.weaponSpeedMod + tmplore.speed);
	if (tmpoptions.calledShot && !tmpistouch) { tmpspeed = tmpspeed + 1; }
	// A move made takes its own time on top (a Spin, a Jump); a stance's is already in the speed.
	tmpspeed = tmpspeed + tmpmartial.seconds;

	// A fumble
	var tmpfumble = null;
	if (tmpresult.isFumble) {
		tmpfumble = resolveFumble(tmpsys.attributes.agl.save, tmpmode == "missile", {
			saveRoll: await rollDie("1d100"),
			recoveryRoll: await rollDie("1d4"),
			severityRoll: await rollDie("1d100"),
			effectRoll: await rollDie(tmpmode == "missile" ? "1d6" : "1d20"),
			// His critical fumble table, rolled up front so the rules stay free of dice.
			criticalRoll: await rollDie("1d100"),
			variantRoll: await rollDie("1d100"),
			standRoll: await rollDie("1d6"),
			throwRoll: await rollDie("1d20"),
			directionRoll: await rollDie("1d8"),
			stunRoll: await rollDie("1d3")
		});
	}

	// Damage. A called shot does half, whether or not it is made.
	var tmpdamage = null;
	var tmprolls = [tmpd20];
	// A damage that is not dice -- the Early Gun's Lead Ball reads "Varies", and a homebrew weapon may
	// read anything -- is not handed to Roll, which would throw after the d20 was already rolled and
	// post nothing at all. The hit is carried with no damage rolled, and the card says why.
	var tmpdicenote = "";
	var tmpcheckdice = getWeaponDamageDice(tmpw, tmpmode);
	if (tmpresult.isHit && tmpcheckdice && !Roll.validate(tmpcheckdice)) {
		tmpdicenote = `The damage "${tmpcheckdice}" is not a dice roll; the table settles it.`;
	}
	if (tmpresult.isHit && tmpdicenote) {
		// Nothing to roll or to apply; the note goes on the card below.
	} else if (tmpresult.isHit && tmpistouch) {
		// A touch that makes contact rolls its own dice and nothing else: his
		// damageRolled=rollDiceFromString(naturalAttackDamage) in the touch branch (70047).
		var tmptouchdice = getWeaponDamageDice(tmpw, tmpmode);
		var tmptouchroll = await new Roll(tmptouchdice || "0").evaluate();
		tmprolls.push(tmptouchroll);
		var tmptouchtotal = Math.max(0, parseInt(tmptouchroll.total) || 0);
		tmpdamage = {
			dice: tmptouchdice, magic: 0, touch: true, shots: 1, perShot: tmptouchtotal,
			rolled: tmptouchtotal, multiplier: 1, total: tmptouchtotal, type: MODE_DAMAGE_TYPES[tmpmode]
		};
	} else if (tmpresult.isHit) {
		// A martial move or stance can add whole dice (a Jump, the Drunken stance), which then count
		// for everything worked out per die below. A flat-damage weapon takes none -- see addMartialDice.
		var tmpdice = addMartialDice(getWeaponDamageDice(tmpw, tmpmode), tmpmartial.damage.extraDice);
		// Held in both hands is what doubles a Strength bonus, and that is now read off the weapon's
		// hand rather than a separate twoHanded boolean which could contradict it. A martial move can
		// change that -- Tension doubles it (triples it two-handed) -- and with no move made this is
		// getStrengthDamageMod exactly. Melee only either way; see getWeaponMartialStrength.
		var tmpstrmod = getWeaponMartialStrength(tmpsys.combat.meleeDamage, tmpmode,
			tmpmartial.damage.strength, tmpw.hand == "both");
		// The martial damage: flat, and per die of what this attack actually rolls.
		var tmpmartialdamage = tmpmartial.damage.flat + (tmpmartial.damage.perDie * getNumberOfDice(tmpdice));
		var tmpmagic = parseInt(tmpw.magicBonus) || 0;
		var tmpmisc = MELEE_MODES.includes(tmpmode) ? (parseInt(tmpsys.combat.damageMisc) || 0) : 0;

		// Projectile Lore is worth damage PER DIE, so it needs the dice this attack actually
		// rolls and cannot be worked out with the flat modifiers above.
		var tmpprojlore = getProjectileLoreDamage({
			weaponName: tmpweapon.name,
			damageDice: tmpdice,
			hasProjectileLore: tmpsys.combat.hasProjectileLore,
			projectileLoreList: tmpsys.combat.projectileLoreNames
		});

		// The Situation Mods' damage: a flat figure, plus or minus one per die at point blank or
		// extreme range (so a flat-damage weapon gets nothing from either, like Projectile Lore).
		var tmpsitdamage = tmpsitmods.damage + (tmpsitmods.perDie * getNumberOfDice(tmpdice));

		// Maximum damage -- a Focused Attack, a Perfect Shot, an immobile target -- rolls every die
		// at its highest, which is his getMaxValueFromDiceString. The flat additions still add.
		// The weapon's own: a rune's dice (its level in d6, plus its level) and Blessed's or a
		// temporary effect's flat figure.
		var tmpcustomdamage = tmpcustom.damage.reduce((tmpsum, tmpentry) => tmpsum + tmpentry.value, 0);
		var tmpdmgroll = await new Roll(
			`${tmpdice}${tmpcustom.runeDice ? " + " + tmpcustom.runeDice : ""} + @str + @magic + @misc + @lore + @projlore + @offhand + @missiles + @situation + @martial + @custom`,
			{ str: tmpstrmod, magic: tmpmagic, misc: tmpmisc, lore: tmplore.damage,
			  projlore: tmpprojlore.damage, offhand: tmpoffhand.damage,
			  missiles: tmpmissiles.damage, situation: tmpsitdamage, martial: tmpmartialdamage, custom: tmpcustomdamage })
			.evaluate({ maximize: tmpsitmods.maxDamage });
		tmprolls.push(tmpdmgroll);

		// What the weapon does once it has hit -- his setMagicDamageDetails: a magical ability of this
		// attack's kind adds its dice and may double the blow on a high natural roll; Foe Strike,
		// energy, Bane and the divine abilities are written out for the table. See resolveWeaponSpecials.
		var tmpspecials = resolveWeaponSpecials({ system: tmpw, mode: tmpmode, natural: tmpd20.total,
			baseDice: getWeaponDamageDice(tmpw, tmpmode), maximize: tmpsitmods.maxDamage },
			(tmpsides) => Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1);

		// Multipliers. The Situation Mods' own is already his additive total (two x2s are x3);
		// a called shot and a critically failed Perfect Shot each halve it. combineDamageMultipliers
		// holds the whole at x3.
		var tmpmultipliers = [];
		if (tmpsitmods.multi != 1) { tmpmultipliers.push(tmpsitmods.multi); }
		// A martial multiplier (a Flying kick, a stance's) joins it. His code adds the two where
		// this multiplies them, but either way the x3 cap is reached with any two, so they agree.
		if (tmpmartial.damage.multiplier != 1) { tmpmultipliers.push(tmpmartial.damage.multiplier); }
		if (tmpoptions.calledShot) { tmpmultipliers.push(0.5); }
		if (tmpsitmods.halfDamage) { tmpmultipliers.push(0.5); }
		// A magical ability's natural-roll double -- his "triple" when the blow was already doubled,
		// which the additive combining gives by itself (two x2s are x3).
		if (tmpspecials.doubles) { tmpmultipliers.push(2); }
		var tmpmulti = combineDamageMultipliers(tmpmultipliers);
		var tmpeach = Math.max(0, parseInt((tmpdmgroll.total + tmpspecials.extraDamage) * tmpmulti) || 0);

		// Two or three projectiles are ONE roll, and the others land on the same target for the
		// same damage again -- "2nd projectile hits the same target for the same damage"
		// (sheet-worker.js:65172). The Player's Guide says instead to "roll each attack
		// separately" (p.182); his sheet is the source of truth where they disagree, and the
		// disagreement is recorded in docs/UPSTREAM-ISSUES.md for him to confirm.
		//
		// Firing two WEAPONS is not this: those are two separate attacks, each rolled through
		// here on its own, which is why only the projectile modes repeat.
		var tmptotal = tmpmissiles.repeats ? (tmpeach * tmpmissiles.shots) : tmpeach;

		tmpdamage = {
			dice: tmpdice, str: tmpstrmod, magic: tmpmagic, misc: tmpmisc, lore: tmplore.damage,
			loreSpecific: tmplore.specific,
			projectileLore: tmpprojlore.damage, projectileLorePerDie: tmpprojlore.perDie,
			multiMissile: tmpmissiles.damage, multiMissileTier: tmpmissiles.tier,
			offhand: tmpoffhand.damage, offhandTier: tmpoffhand.tier,
			situation: tmpsitdamage, maximized: tmpsitmods.maxDamage,
			situationMulti: tmpsitmods.multi, halfDamage: tmpsitmods.halfDamage,
			martial: tmpmartialdamage, martialMulti: tmpmartial.damage.multiplier,
			runeDice: tmpcustom.runeDice, custom: tmpcustomdamage, special: tmpspecials.extraDamage,
			specialDoubles: tmpspecials.doubles,
			shots: tmpmissiles.shots, perShot: tmpeach,
			rolled: tmpdmgroll.total + tmpspecials.extraDamage, multiplier: tmpmulti, total: tmptotal,
			type: MODE_DAMAGE_TYPES[tmpmode]
		};
	}

	// The chat card
	var tmpattack = {
		attackerUuid: tmpactor.uuid,
		weapon: tmpweapon.name,
		mode: tmpmode,
		aim: tmpoptions.aim,
		targetUuid: tmptarget?.actor?.uuid ?? null,
		targetName: tmptarget?.name ?? null,
		result: tmpresult,
		mods: tmpmods,
		speed: tmpspeed,
		// His "S" speed: the card says "special timing" and offers no Spend (see attack-card.hbs).
		speedSpecial: !!tmpw.speedSpecial,
		// Which of the attacker's two clocks the swing runs on: a weapon in the off hand spends the
		// off hand's own seconds, not the round's (Player's Guide p.178; module/combat/round-rules.mjs).
		hand: getActionHand(tmpw.hand, tmpsys.physical?.handedness),
		fumble: tmpfumble,
		damage: tmpdamage,
		// What the Situation Mods set, and the words among them that are for the table to act
		// on rather than arithmetic -- a random hit location, half reload time, and the like.
		situation: { labels: tmpsitmods.labels, notes: getSituationalNotes(tmpsitmods.special) },
		// The stance's and moves' own prose, for the table -- what his card printed beside them.
		martialNotes: tmpmartial.special,
		// What the weapon's customization does on a hit, written out for the table (Foe Strike,
		// energy, Bane, the divine abilities), and the name as his panel would print it.
		// A touch rolls no specials (tmpspecials is never set on that path).
		weaponSpecials: [tmpdicenote].concat((tmpdamage && tmpspecials) ? tmpspecials.lines : []).filter(tmpline => tmpline),
		weaponDisplay: getWeaponDisplayName(tmpweapon.name, tmpw),
		// The weapon itself, so a hit can find its poison coating when the damage is applied, and the
		// coating as it stood when the blow was struck, for the card (lore-rules.mjs, POISON ON A WEAPON).
		weaponId: tmpweapon.id,
		coating: (parseInt(tmpweapon.system.coating?.doses) || 0) > 0
			? { name: tmpweapon.system.coating.name, doses: tmpweapon.system.coating.doses, envenomed: isEnvenomed(tmpweapon.system) }
			: null,
		// Once set, the Apply Damage button stops offering itself, so a hit cannot be applied twice.
		applied: false
	};

	var tmphtml = await foundry.applications.handlebars.renderTemplate(
		"systems/imagine-rpg/templates/chat/attack-card.hbs",
		{ ...tmpattack, modeLabel: MODE_LABELS[tmpmode], actorName: tmpactor.name, inCombat: !!findCombatant(tmpactor) });

	return await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
		content: tmphtml,
		rolls: tmprolls,
		flags: { "imagine-rpg": { attack: tmpattack } }
	});
}


// @MARKER DAMAGE APPLICATION

	// This is the function which asks where the blow landed and what kind of damage it is.
	async function askDamageOptions(tmptargetactor, tmpattack) {
		var tmpareas = tmptargetactor.system.body?.areas ?? [];
		if (!tmpareas.length) {
			ui.notifications.warn(`${tmptargetactor.name} has no body areas to damage.`);
			return null;
		}
		// Only a chart result is "Hit(...)". A touch ("Touched") and a creature's gaze, voice or
		// direct attack (its type) were never read down the chart, so there is no off-centre to
		// speak of: they land where they were aimed, as a centre hit does.
		var tmpzone = "" + (tmpattack.result.zone ?? "");
		var tmpcentre = tmpzone == "Hit(Center)";
		var tmpoffcentre = tmpzone.startsWith("Hit(") && !tmpcentre;
		var tmpdefault = tmpoffcentre ? "" : tmpattack.aim;
		var tmpareahint = tmpcentre
			? `A centre hit: it lands where it was aimed (${esc(tmpattack.aim)}).`
			: tmpoffcentre
			? `An off-centre hit, <strong>${esc(tmpzone.replace("Hit(", "").replace(")", ""))}</strong> of
			   where it was aimed (${esc(tmpattack.aim) || "no aim declared"}). Pick the area that sits that way on the target.`
			: `${esc(tmpzone)}: not read down the attack chart, so it lands where it was aimed
			   (${esc(tmpattack.aim) || "no aim declared"}).`;

		var tmpcontent = `
			<div class="imagine-damage-dialog">
				<p>${tmpareahint}</p>
				<div class="form-group"><label>Area struck</label>
					<select name="area">${tmpareas.map(a =>
						`<option value="${esc(a.name)}" ${a.name == tmpdefault ? "selected" : ""}>${esc(a.name)} (armour ${a.armor})</option>`).join("")}
					</select></div>
				<div class="form-group"><label>Damage type</label>
					<select name="type">${Object.keys(ARMOR_BLOCKING).map(t =>
						`<option value="${t}" ${t == tmpattack.damage.type ? "selected" : ""}>${t}</option>`).join("")}
					</select></div>
				<div class="form-group"><label>Bypasses armour</label><input type="checkbox" name="bypass">
					<p class="hint">For a called shot that goes through a gap, or damage armour cannot stop.</p></div>
			</div>`;

		return await foundry.applications.api.DialogV2.prompt({
			window: { title: `Apply damage to ${tmptargetactor.name}` },
			content: tmpcontent,
			rejectClose: false,
			ok: {
				label: "Apply",
				callback: (event, button) => {
					var tmpform = button.form.elements;
					return { area: tmpform.area.value, type: tmpform.type.value, bypass: tmpform.bypass.checked };
				}
			}
		});
	}

// This is the function which applies an attack's damage to its target: through the armour at the
// struck area, onto the area's wounds, and reports what that means.
export async function applyAttackDamage(tmpmessage) {
	var tmpattack = tmpmessage.getFlag("imagine-rpg", "attack");
	if (!tmpattack?.damage) { return; }
	if (tmpattack.applied) {
		ui.notifications.warn("That damage has already been applied.");
		return;
	}
	// Only someone who can mark the card applied may apply it -- its author or the Game Master. Anyone
	// else could put the wounds on and leave the button live, and the Game Master, seeing it, would put
	// them on again: a player applying a Game Master's blow to their own character did exactly that
	// (bug sweep 2026-09-23).
	if (!tmpmessage.isOwner) {
		ui.notifications.warn("Only the Game Master or whoever made this attack can apply its damage, so it is never applied twice. Ask the Game Master.");
		return;
	}

	var tmptargetactor = tmpattack.targetUuid ? await fromUuid(tmpattack.targetUuid) : null;
	if (!tmptargetactor) {
		var tmptargets = Array.from(game.user.targets);
		tmptargetactor = tmptargets.length == 1 ? tmptargets[0].actor : null;
	}
	if (!tmptargetactor) {
		ui.notifications.warn("Target the token that was hit, then apply the damage.");
		return;
	}
	if (!tmptargetactor.isOwner) {
		ui.notifications.warn(`You do not have permission to change ${tmptargetactor.name}. Ask the Game Master to apply it.`);
		return;
	}

	// A poisoned weapon's hit is applied whole or not at all. Its poison comes off the attacker's
	// weapon, so whoever applies it must be able to change that weapon as well as the target. Found in
	// the 2026-09-23 bug sweep: a player applying a Game Master's poisoned blow used to put the wounds on
	// and then be told to "ask the Game Master to apply this hit" -- who, doing so, dealt it twice.
	if (tmpattack.coating && tmpattack.weaponId) {
		var tmpcoatowner = await fromUuid(tmpattack.attackerUuid);
		var tmpcoatitem = tmpcoatowner?.items?.get(tmpattack.weaponId) ?? null;
		if (tmpcoatitem && (parseInt(tmpcoatitem.system.coating?.doses) || 0) > 0 && !tmpcoatitem.isOwner) {
			ui.notifications.warn(`The blow from ${tmpcoatitem.name} carries a poison you cannot take off that weapon. `
				+ `Ask the Game Master to apply this hit.`);
			return;
		}
	}

	var tmpoptions = await askDamageOptions(tmptargetactor, tmpattack);
	if (!tmpoptions) { return; }

	var tmpsys = tmptargetactor.system;
	var tmparea = tmpsys.body.areas.find(a => a.name == tmpoptions.area);
	if (!tmparea) { return; }

	// Whether the blow lands at all is read off the RAW figure, before any modifier touches it.
	// His whole apply block sits inside that test, so a hit that rolled under 1 does nothing --
	// no wounds, no armour damage, no absorption spent.
	var tmpraw = parseInt(tmpattack.damage.total) || 0;
	if (!blowLands(tmpraw, false)) {
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmptargetactor }),
			content: `<div class="imagine-chat damage-result"><p>The blow lands on
				<strong>${esc(tmptargetactor.name)}</strong> for no damage. Nothing is hurt.</p></div>`
		});
		if (tmpmessage.isOwner) { await tmpmessage.setFlag("imagine-rpg", "attack.applied", true); }
		return;
	}

	// Endured and rebounded blows do nothing at all: his handler branches past the whole apply
	// block for both, so there is no damage, no armour wear and no effect.
	var tmpwornnames = (tmptargetactor.items ?? [])
		.filter(i => i.type == "armor" && i.system.location == "equipped")
		.map(i => i.name);
	if (isEndured(tmpoptions.type, tmpwornnames) || isRebounded(tmpoptions.type, tmpwornnames)) {
		var tmpwhy = isEndured(tmpoptions.type, tmpwornnames) ? "endures" : "rebounds";
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmptargetactor }),
			content: `<div class="imagine-chat damage-result"><p><strong>${esc(tmptargetactor.name)}</strong>
				${tmpwhy} ${esc(tmpoptions.type)} damage. The blow does nothing.</p></div>`
		});
		if (tmpmessage.isOwner) { await tmpmessage.setFlag("imagine-rpg", "attack.applied", true); }
		return;
	}

	// The target's pain threshold comes off -- or goes on -- before armour sees the blow, which
	// is the first thing his handler does with it. A negative threshold is a tougher target.
	var tmpthreshold = parseInt(tmpsys.combat.painThreshold) || 0;
	var tmpfelt = applyPainThreshold(tmpraw, tmpthreshold, tmpsys.combat.highPainThreshold);

	// Then everything magical protecting the target, still above the armour. A magical weave is
	// counted as hide here, so it has to come back out of the armour total before blocking, or
	// it would be counted a second time -- which is what his own code does.
	var tmpworn = (tmptargetactor.items ?? [])
		.filter(i => i.type == "armor" && i.system.location == "equipped" && !i.system.isShield);
	var tmpslot = getAreaArmorSlot(tmpsys.body.type, tmparea.name).slot;
	var tmpmagical = applyMagicalReductions(tmpfelt, {
		invulnerable: tmpsys.combat.invulnerable,
		// The weapon's magical plus, which is what invulnerability reads to decide whether the
		// blow touches the target at all. Both attack cards record it as damage.magic.
		magicPlus:    tmpattack.damage.magic ?? 0,
		spiritArmor:  tmpsys.combat.spiritArmor,
		forceArmor:   tmpsys.combat.forceArmor,
		outerKinetic: tmpsys.combat.outerKinetic,
		magicShield:  tmpsys.combat.magicShield,
		weave:        getWeaveValue(tmpworn, tmpslot),
		bypass:       tmpoptions.bypass
	});

	var tmpblow = resolveAreaDamage({
		damage: tmpmagical.damage,
		type: tmpoptions.type,
		totalArmor: Math.max(0, tmparea.armor - tmpmagical.weave),
		bypass: tmpoptions.bypass,
		hide: tmpsys.body.hide,
		material: tmparea.material,
		isMagicArmor: false
	});

	// Absorption is the last thing to touch the damage, after armour and hide, and it is spent
	// by what it takes. See absorbDamage.
	var tmpabsorbed = absorbDamage(tmpblow.net, tmpsys.combat.damageAbsorb);
	var tmpafter = applyAreaDamage({
		damage: tmpabsorbed.damage,
		areaWounds: tmparea.wounds,
		areaEndurance: tmparea.endurance,
		vitality: tmpsys.attributes.vit.value,
		totalWounds: tmpsys.body.totalWounds,
		shock: tmpsys.body.shock
	});

	var tmpupdate = {};
	tmpupdate[`system.body.wounds.${tmparea.name}`] = tmpafter.wounds;
	if (tmpblow.armorDamage > 0) {
		tmpupdate[`system.body.armorDamage.${tmparea.name}`] = tmparea.armorDamage + tmpblow.armorDamage;
	}
	if (tmpabsorbed.pool != tmpsys.combat.damageAbsorb) {
		tmpupdate["system.combat.damageAbsorb"] = tmpabsorbed.pool;
	}
	await tmptargetactor.update(tmpupdate);

	var tmpnotes = [];
	if (tmpafter.effectTriggered) { tmpnotes.push(`<strong>${esc(tmparea.name)} is past Endurance plus Vitality: its effect is triggered.</strong>`); }
	else if (tmpafter.vitalitySaveNeeded) { tmpnotes.push(`${esc(tmparea.name)} is past its Endurance: a Vitality save is needed.`); }
	if (tmpafter.inShock) { tmpnotes.push(`<strong>${esc(tmptargetactor.name)} is in shock.</strong>`); }
	if (tmpblow.armorDamage > 0) { tmpnotes.push(`The armour there takes ${tmpblow.armorDamage} damage.`); }
	if (tmpabsorbed.damage != tmpblow.net) {
		tmpnotes.push(`Absorption takes ${tmpblow.net - tmpabsorbed.damage}; `
			+ `${tmpabsorbed.pool} left in the pool.`);
	}
	if (tmpmagical.damage != tmpfelt) {
		tmpnotes.push(`Magical protection takes ${tmpfelt - tmpmagical.damage} before armour.`);
	}

	// @MARKER POISONED WEAPON
	// A coated weapon's poison goes in with a hit that reaches the flesh -- or, from an Envenomed
	// blade, a thrust of 10 or more (resolveCoatingDelivery). It is read off the weapon as it is now,
	// so a coating another hit already spent is not spent twice. Spending it needs the right to
	// change the attacker's weapon, as applying the damage needs the right to change the target.
	var tmpdelivery = null;
	var tmpcoatedweapon = null;
	if (tmpattack.coating && tmpattack.weaponId) {
		var tmpattacker = await fromUuid(tmpattack.attackerUuid);
		tmpcoatedweapon = tmpattacker?.items?.get(tmpattack.weaponId) ?? null;
		if (tmpcoatedweapon) {
			tmpdelivery = resolveCoatingDelivery({ coating: tmpcoatedweapon.system.coating, envenomed: isEnvenomed(tmpcoatedweapon.system),
				mode: tmpattack.mode, fleshDamage: tmpabsorbed.damage });
			if (tmpdelivery.delivers && !tmpcoatedweapon.isOwner) {
				// Refused before any damage above; kept so a weapon changing hands mid-dialog still
				// spends nothing it may not. The wounds are on, so the Game Master applies only the poison.
				tmpnotes.push(`The poison on ${esc(tmpcoatedweapon.name)} would go in, but you cannot change that weapon. `
					+ `The wounds are applied; the Game Master should use the poison on the target from that weapon by hand.`);
				tmpdelivery = null;
			} else if (!tmpdelivery.delivers && tmpdelivery.reason != "not poisoned") {
				tmpnotes.push(`The poison on ${esc(tmpcoatedweapon.name)} is not delivered: ${esc(tmpdelivery.reason)}.`);
			}
		}
	}
	if (tmpfelt != tmpraw) {
		tmpnotes.push(`Pain threshold ${tmpthreshold > 0 ? "+" : ""}${tmpthreshold}`
			+ `${tmpsys.combat.highPainThreshold ? " and a high pain threshold" : ""}`
			+ `: felt as ${tmpfelt} before armour.`);
	}

	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: tmptargetactor }),
		content: `<div class="imagine-chat damage-result">
			<p><strong>${esc(tmptargetactor.name)}</strong> takes ${tmpattack.damage.total} ${esc(tmpoptions.type)}
			damage to the ${esc(tmparea.name)}${tmpoptions.bypass ? " (bypassing armour)" : ` (armour ${tmparea.armor})`}.</p>
			<p>${tmpblow.blocked} stopped, <strong>${tmpabsorbed.damage}</strong> through.
			Wounds there: ${tmpafter.wounds} / ${tmparea.endurance}.</p>
			${tmpnotes.map(n => `<p>${n}</p>`).join("")}
		</div>`
	});

	// Only the message's author or the Game Master may mark it -- and only they get this far (see the
	// test at the head of this function), so the mark is always written.
	if (tmpmessage.isOwner) { await tmpmessage.setFlag("imagine-rpg", "attack.applied", true); }

	// The poison delivered: the target rolls their Poison Resistance on its own card, as a poison used
	// from the tab does, and a dose comes off the weapon -- the coating gone with its last one.
	if (tmpdelivery?.delivers) {
		var tmpcoat = tmpcoatedweapon.system.coating;
		await tmpcoatedweapon.update({ "system.coating": tmpdelivery.remaining > 0 ? { ...tmpcoat, doses: tmpdelivery.remaining }
			: { name: "", poisonType: "", poisonPotency: "", form: "", doses: 0 } });
		await postPoisonOnVictims({
			speaker: tmpcoatedweapon.parent,
			flavor: `The poison on <strong>${esc(tmpcoatedweapon.name)}</strong> goes in: <strong>${esc(tmpcoat.name)}</strong>`
				+ (tmpcoat.form ? ` (${esc(tmpcoat.form)})` : ""),
			poison: { poisonType: tmpcoat.poisonType, poisonPotency: tmpcoat.poisonPotency },
			victims: [tmptargetactor], modifier: 0,
			footer: tmpdelivery.remaining > 0 ? `${tmpdelivery.remaining} dose(s) left in the hilt.` : "The coating is spent."
		});
	}
}

// This is the function which spends the attack's seconds for the attacker, if they are fighting:
// on the round clock, against the hand the attack was made with, and named for the weapon so the
// clock can say what the seconds went on. Once spent, the card says so and the button stops
// offering itself -- a second click would charge the same swing twice. A slip is taken back from
// the clock itself (its undo button), not from here.
//
// A card being spent right now is held in spendingCards until its write lands: the spent mark is only
// set after the clock's own write, so a quick double-click once read "not spent" twice and charged the
// same swing twice (bug sweep 2026-09-23). A special-timing card (his "S") has nothing to spend.
const spendingCards = new Set();
export async function spendAttackTime(tmpmessage) {
	var tmpattack = tmpmessage.getFlag("imagine-rpg", "attack");
	if (!tmpattack || !game.combat) { return; }
	if (tmpattack.speedSpecial || !((parseInt(tmpattack.speed) || 0) > 0)) { return; }
	if (tmpattack.spent) {
		ui.notifications.info("These seconds have already been spent.");
		return;
	}
	if (spendingCards.has(tmpmessage.id)) { return; }
	spendingCards.add(tmpmessage.id);
	try {
		var tmpactor = await fromUuid(tmpattack.attackerUuid);
		var tmpcombatant = findCombatant(tmpactor);
		if (!tmpcombatant) {
			ui.notifications.warn("The attacker is not in the current combat.");
			return;
		}
		if (!tmpcombatant.isOwner) { return; }
		var tmpresult = await game.combat.spendSeconds(tmpcombatant, tmpattack.speed,
			{ hand: tmpattack.hand ?? "main", label: tmpattack.weapon ?? "" });
		if (tmpresult && tmpmessage.isOwner) { await tmpmessage.setFlag("imagine-rpg", "attack.spent", true); }
	} finally {
		spendingCards.delete(tmpmessage.id);
	}
}

// This is the function which wires the chat card's buttons whenever an attack card is shown.
export function registerAttackCardListeners() {
	// A poisoned weapon's hit posts a poison card, whose Apply buttons are wired here too.
	registerPoisonCardListeners();
	Hooks.on("renderChatMessageHTML", function (tmpmessage, tmphtml) {
		var tmpattack = tmpmessage.getFlag("imagine-rpg", "attack");
		if (!tmpattack) { return; }
		tmphtml.querySelector("[data-imagine-action='applyDamage']")
			?.addEventListener("click", () => applyAttackDamage(tmpmessage));
		var tmpspend = tmphtml.querySelector("[data-imagine-action='spendTime']");
		if (tmpspend && tmpattack.spent) {
			tmpspend.disabled = true;
			tmpspend.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${parseInt(tmpattack.speed) || 0}s spent`;
		}
		tmpspend?.addEventListener("click", () => spendAttackTime(tmpmessage));
	});
}
// @END (CODE)
