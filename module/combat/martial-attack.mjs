// @START (CODE)
// @MARKER MARTIAL ARTS ROLLS
//==================================================================================================================
// The part of martial arts that talks to Foundry: asking how a martial attack is made, rolling it,
// rolling a block, hold, throw, move or Martial Lore value, learning something new, and writing
// each to chat.
//
// All of the arithmetic lives in martial-arts.mjs (and the attack chart in combat-rules.mjs) and
// is tested there. This file only gathers the inputs, rolls the dice and records the results --
// the same division attack.mjs keeps for weapons.
//
// A martial attack's chat card carries the same "imagine-rpg.attack" flag a weapon attack's does,
// in the same shape, so its Apply Damage and Spend Seconds buttons are wired by attack.mjs's own
// listener and run through exactly the same damage pipeline. Nothing about damage is repeated here.
//==================================================================================================================

import * as CombatRules from "./combat-rules.mjs";
import {
	MARTIAL_FAMILIES, MARTIAL_STANCE_NAMES,
	getMartialAttackModifiers, getMartialStrengthDamage, addMartialDice, resolveMartialAttackDamage,
	isScissorStrikeDoubled, resolveMartialTouch, resolveFailedMove, parseMartialList,
	resolveLearnStance, resolveMasterStance, resolveLearnSubskill, resolveLearnLoreValue
} from "./martial-arts.mjs";
import { MARTIAL_LORE_VALUES } from "../combat-tables.mjs";
import { findActorCombatant } from "./combat-document.mjs";
import { resolveSkillRoll, describeSkillRoll } from "../skills-rules.mjs";

const { resolveAttack, resolveCriticalFumble } = CombatRules;

// The martial arts panel, a partial both Combat tabs include under this name.
const MARTIAL_PARTIALS = {
	"imagine-martial-panel": "systems/imagine-rpg/templates/actor/martial-panel.hbs"
};
var tmpMartialTemplatesReady = null;

// This is the function which loads the panel's partial, once. Called at init, and awaited again
// by both sheets before they render, so a sheet opened before the fetch has finished waits for it
// rather than failing on a missing partial -- the round clock's arrangement.
export function loadMartialTemplates() {
	if (!tmpMartialTemplatesReady) {
		tmpMartialTemplatesReady = foundry.applications.handlebars.loadTemplates(MARTIAL_PARTIALS);
	}
	return tmpMartialTemplatesReady;
}


	// This is the function which escapes text for chat. Names are user-editable.
	function esc(tmptext) {
		return foundry.utils.escapeHTML(String(tmptext ?? ""));
	}

	// This is the function which rolls one die formula and returns the Roll, so it can be attached
	// to the chat message and shown with Foundry's own dice.
	async function rollFormula(tmpformula, tmpoptions) {
		return await new Roll(tmpformula).evaluate(tmpoptions ?? {});
	}

	// This is the function which finds an actor's combatant in the current combat, if they have
	// one -- findActorCombatant (combat-document.mjs), which matches a token's own actor rather than
	// its base actor's id, so each unlinked token is charged for its own swing.
	function findCombatant(tmpactor) {
		return findActorCombatant(tmpactor, game.combat);
	}

	// This is the function which reads the attacker's standing Situation Mods for one attack. The
	// Situation Mods window is its own piece of work (combat-rules.mjs, @MARKER SITUATIONAL
	// MODIFIERS); read through the namespace so a character with none, or a build without them,
	// simply gets nothing added rather than failing to load.
	function getSituation(tmpactor) {
		var tmpnone = { attack: 0, damage: 0, multi: 1, special: [], noAttack: false,
		                maxDamage: false, halfDamage: false, perDie: 0, labels: [] };
		if (typeof CombatRules.getSituationalForAttack != "function") { return tmpnone; }
		return CombatRules.getSituationalForAttack(tmpactor.system.combat?.situational, "smash") ?? tmpnone;
	}

	// This is the function which writes one plain martial arts result to chat.
	async function postMartialCard(tmpactor, tmptitle, tmplines, tmprolls) {
		return await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			content: `<div class="imagine-chat martial-card"><header><strong>${esc(tmpactor.name)}</strong>
				&mdash; ${esc(tmptitle)}</header>${tmplines.map(l => `<p>${l}</p>`).join("")}</div>`,
			rolls: tmprolls ?? []
		});
	}

	// This is the function which rolls one percentile skill check and words it.
	//
	// His martial knowledge and lore rolls -- attack, block, hold, throw, move and lore value
	// (handleMartialAttackSkillRoll, sheet-worker.js:66168, and its siblings to 68725) -- all read
	// the die through handleSkillRollDetails, so this does too: his eight results, "made" being
	// the first five of them (resolveSkillRoll carries it).
	async function rollSkillCheck(tmpchance) {
		var tmproll = await rollFormula("1d100");
		var tmpresult = resolveSkillRoll(tmpchance, tmproll.total);
		tmpresult.rollObject = tmproll;
		tmpresult.text = describeSkillRoll(tmpresult);
		return tmpresult;
	}

	// This is the function which asks for a modifier to a skill roll, the MOD button beside each
	// ROLL on his sheet. Only asked when the button is shift-clicked, the resistance roll's
	// convention, so an ordinary click rolls straight away. Returns null if cancelled.
	async function askModifier(tmpevent, tmptitle) {
		if (!tmpevent?.shiftKey) { return 0; }
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: tmptitle },
			content: `<p>Modifier to the roll:</p><input type="number" name="modifier" value="0" autofocus>`,
			rejectClose: false,
			ok: { label: "Roll", callback: (tmpe, tmpbutton) => tmpbutton.form.elements.modifier.value }
		});
		if (tmpanswer === null || tmpanswer === undefined) { return null; }
		return parseInt(tmpanswer) || 0;
	}


// @MARKER MARTIAL ATTACK

	// This is the function which asks how a martial attack is being made: where it is aimed, a
	// called shot, any other modifier, and whether the target is defending. Returns null if
	// cancelled. The same questions the weapon attack asks, less the attack mode -- a martial
	// attack's kind of blow is fixed by what it is.
	async function askMartialAttackOptions(tmprow, tmptarget) {
		var tmpareas = tmptarget?.actor?.system?.body?.areas ?? [];
		var tmpaim = tmpareas.length
			? tmpareas.map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join("")
			: `<option value="">(no target selected)</option>`;
		var tmptargetnodef = !!tmptarget?.actor?.system?.combat?.noDefense;

		var tmpcontent = `
			<div class="imagine-attack-dialog">
				<p class="hint">${esc(tmprow.name)}: skill ${tmprow.chance}%, ${esc(tmprow.damage)} ${esc(tmprow.damageType)},
				${tmprow.speed} seconds.${tmprow.special ? ` ${esc(tmprow.special)}` : ""}</p>
				<div class="form-group"><label>Aimed at</label><select name="aim">${tmpaim}</select></div>
				<div class="form-group"><label>Skill modifier</label><input type="number" name="skillMod" value="0"></div>
				<div class="form-group"><label>To-hit modifier</label><input type="number" name="situational" value="0">
					<p class="hint">Anything the Situation Mods do not list.</p></div>
				<div class="form-group"><label>Called shot</label><input type="checkbox" name="calledShot"></div>
				${tmptarget ? `<div class="form-group"><label>Target is avoiding the blow</label>
					<input type="checkbox" name="useDefense" ${tmptargetnodef ? "" : "checked"}></div>` : ""}
			</div>`;

		return await foundry.applications.api.DialogV2.prompt({
			window: { title: `${tmprow.name} — Martial Attack` },
			content: tmpcontent,
			rejectClose: false,
			ok: {
				label: "Attack",
				callback: (event, button) => {
					var tmpform = button.form.elements;
					return {
						aim: tmpform.aim.value,
						skillMod: parseInt(tmpform.skillMod.value) || 0,
						situational: parseInt(tmpform.situational.value) || 0,
						calledShot: tmpform.calledShot.checked,
						useDefense: tmpform.useDefense ? tmpform.useDefense.checked : false
					};
				}
			}
		});
	}

	// This is the function which works out a martial fumble. His martial attack takes a failed
	// Agility save straight to the critical fumble table, with no ordinary 80/20 split first
	// (handleMartialAttackToHit, sheet-worker.js:66570) -- there is no weapon to drop or jam.
	async function rollMartialFumble(tmpaglsave) {
		var tmpsave = await rollFormula("1d100");
		if (tmpsave.total <= (parseInt(tmpaglsave) || 0)) {
			var tmprecovery = (await rollFormula("1d4")).total + 1;
			return { saved: true, critical: false, secondsLost: tmprecovery,
			         text: `Agility save made: recovers, losing ${tmprecovery} seconds.` };
		}
		var tmpcritical = resolveCriticalFumble(false, {
			criticalRoll: (await rollFormula("1d100")).total, variantRoll: (await rollFormula("1d100")).total,
			standRoll: (await rollFormula("1d6")).total, throwRoll: (await rollFormula("1d20")).total,
			directionRoll: (await rollFormula("1d8")).total, stunRoll: (await rollFormula("1d3")).total
		});
		return { saved: false, critical: true, secondsLost: tmpcritical.secondsLost,
		         target: tmpcritical.target, damageMultiplier: tmpcritical.damageMultiplier,
		         text: `Agility save failed: CRITICAL fumble -- ${tmpcritical.text}.` };
	}

// This is the function which makes a martial attack and writes it to chat.
//
// It rolls BOTH halves his sheet splits across two buttons: the Martial Knowledge skill roll for
// the attack, and the d20 to hit on the character's own attack chart. A hit whose skill roll failed
// still lands for half damage (Player's Guide p.95, and his getMartialDamageDetails). A Scissor
// Strike is two blows, one at the arm and one at the forearm, and is posted as two cards.
export async function rollMartialAttack(tmpactor, tmpname) {
	var tmpsys = tmpactor.system;
	var tmpmartial = tmpsys.martial ?? {};
	var tmprow = (tmpmartial.rows?.attacks ?? []).find(r => r.name == tmpname);
	if (!tmprow) { return null; }
	if (!tmpmartial.hasKnowledge) {
		ui.notifications.warn(`${tmpactor.name} does not hold Martial Knowledge.`);
		return null;
	}

	var tmpmods = getMartialAttackModifiers(tmpmartial.state, { mode: "smash", martialAttack: true });
	var tmpsit = getSituation(tmpactor);
	if (tmpmods.noAttack || tmpsit.noAttack) {
		ui.notifications.warn(`${tmpactor.name} cannot attack: ${tmpmods.noAttack ? tmpmods.noAttackReason : "a situational modifier does not allow it"}.`);
		return null;
	}

	var tmptargets = Array.from(game.user.targets);
	var tmptarget = tmptargets.length == 1 ? tmptargets[0] : null;
	var tmpoptions = await askMartialAttackOptions(tmprow, tmptarget);
	if (!tmpoptions) { return null; }

	// To hit: Strength (unless Snap took it away), the martial state, the Situation Mods, anything
	// else, and the target's defence -- his handleMartialAttackToHit sums the same, less the target,
	// which his sheet never knew about.
	var tmplist = [];
	if (tmpmods.damage.strength != "snap" && tmpsys.combat.meleeAttack) {
		tmplist.push({ label: "STR", value: parseInt(tmpsys.combat.meleeAttack) || 0 });
	}
	tmplist.push(...tmpmods.list);
	if (tmpsit.attack) { tmplist.push({ label: "Situation", value: tmpsit.attack }); }
	if (tmpoptions.situational) { tmplist.push({ label: "Other", value: tmpoptions.situational }); }
	var tmptargetsys = tmptarget?.actor?.system;
	if (tmptargetsys && tmpoptions.useDefense) {
		var tmpdef = parseInt(tmptargetsys.combat?.defensiveAdjust) || 0;
		if (tmpdef) { tmplist.push({ label: "Target Defence", value: tmpdef }); }
	}
	var tmptotal = tmplist.reduce((tmpsum, tmpm) => tmpsum + tmpm.value, 0);

	// The skill roll, once for the whole attack -- a Scissor Strike's two blows share it.
	var tmpskill = await rollSkillCheck(tmprow.chance + tmpoptions.skillMod);
	var tmprolls = [tmpskill.rollObject];

	var tmpblows = (tmpname == "Scissor Strike") ? ["arm", "forearm"] : [""];
	var tmpresults = [];
	for (const tmpblow of tmpblows) {
		var tmpd20 = await rollFormula("1d20");
		tmprolls.push(tmpd20);
		tmpresults.push({ blow: tmpblow, roll: tmpd20, result: resolveAttack({
			natural: tmpd20.total, mods: tmptotal, skill: tmpsys.combat.attackSkill,
			calledShot: tmpoptions.calledShot }) });
	}
	var tmpdoubled = (tmpresults.length == 2)
		&& isScissorStrikeDoubled(tmpskill.made, tmpresults[0].result.isHit, tmpresults[1].result.isHit);

	// Time: the attack's own, plus what the moves add to it, plus one for a called shot. A Snap can
	// take it below the attack's minimum but "will always take at least one second" (p.97).
	var tmpspeed = Math.max(1, (parseInt(tmprow.speed) || 0) + tmpmods.seconds + (tmpoptions.calledShot ? 1 : 0));

	var tmpmessages = [];
	for (const tmpentry of tmpresults) {
		// Each card carries its own dice: the first the skill roll with its blow, the second its blow
		// alone -- once the second card was given the first blow's d20 and no damage roll at all.
		var tmpcardrolls = tmpmessages.length ? [tmpentry.roll] : [tmpskill.rollObject, tmpentry.roll];
		var tmpfumble = tmpentry.result.isFumble ? await rollMartialFumble(tmpsys.attributes.agl.save) : null;
		var tmpdamage = null;
		if (tmpentry.result.isHit) {
			var tmpdice = addMartialDice(tmprow.damage, tmpmods.damage.extraDice);
			var tmpdmgroll = await rollFormula(tmpdice, tmpsit.maxDamage ? { maximize: true } : {});
			tmprolls.push(tmpdmgroll);
			tmpcardrolls.push(tmpdmgroll);
			var tmpstr = getMartialStrengthDamage(tmpsys.combat.meleeDamage, tmpmods.damage.strength, false);
			var tmpmultipliers = [tmpmods.damage.multiplier, tmpsit.multi];
			if (tmpdoubled) { tmpmultipliers.push(2); }
			var tmpresolved = resolveMartialAttackDamage({
				rolled: tmpdmgroll.total, dice: tmpdice, strength: tmpstr,
				flat: tmpmods.damage.flat + tmpsit.damage, perDie: tmpmods.damage.perDie + tmpsit.perDie,
				multipliers: tmpmultipliers, skillMade: tmpskill.made,
				halve: (tmpoptions.calledShot && !tmpentry.result.isCalledShot) || tmpsit.halfDamage
			});
			tmpdamage = {
				dice: tmpdice, rolled: tmpdmgroll.total, str: tmpstr,
				flat: tmpmods.damage.flat + tmpsit.damage, perDie: tmpresolved.perDie,
				multiplier: tmpresolved.multiplier, halved: tmpresolved.halved, total: tmpresolved.total,
				type: tmprow.damageType || "Smashing",
				// Read by the damage pipeline's invulnerability test: a fist has no magical plus.
				magic: 0
			};
		}

		var tmpattack = {
			attackerUuid: tmpactor.uuid,
			weapon: tmpentry.blow ? `${tmpname} (${tmpentry.blow})` : tmpname,
			mode: "smash",
			aim: tmpentry.blow ? tmpoptions.aim || tmpentry.blow : tmpoptions.aim,
			targetUuid: tmptarget?.actor?.uuid ?? null,
			targetName: tmptarget?.name ?? null,
			result: tmpentry.result,
			mods: { list: tmplist, total: tmptotal },
			// A Scissor Strike's two blows are ONE attack's seconds: the first card carries them and
			// its Spend button, the second none -- two buttons once charged the strike twice.
			speed: tmpmessages.length ? 0 : tmpspeed,
			fumble: tmpfumble,
			damage: tmpdamage,
			applied: false
		};

		var tmphtml = await foundry.applications.handlebars.renderTemplate(
			"systems/imagine-rpg/templates/chat/martial-card.hbs", {
				...tmpattack, actorName: tmpactor.name, attackName: tmpattack.weapon,
				skill: tmpskill, doubled: tmpdoubled, special: tmpmods.special,
				inCombat: !tmpmessages.length && !!findCombatant(tmpactor)
			});
		tmpmessages.push(await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			content: tmphtml,
			rolls: tmpcardrolls,
			flags: { "imagine-rpg": { attack: tmpattack } }
		}));
	}
	return tmpmessages;
}


// @MARKER BLOCKS, HOLDS AND THROWS

// This is the function which rolls a block, a hold or a throw.
//
// A block is one skill roll: made, it takes half the blow on the limb or torso that blocked.
// A hold or a throw needs a TOUCH first -- d20 plus the Agility missile modifier, 10 or better, a
// natural 1 always failing -- and then the skill roll; his sheet splits these across two buttons
// and a checkbox, which is one click here. A Spin Throw needs no touch ("Does not require touch
// before using") and adds +2 damage to a throw made with it.
export async function rollMartialSubskill(tmpactor, tmpfamily, tmpname, tmpevent) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmprow = (tmpmartial.rows?.[tmpfamily] ?? []).find(r => r.name == tmpname);
	if (!tmprow) { return null; }
	if (!tmpmartial.hasKnowledge) {
		ui.notifications.warn(`${tmpactor.name} does not hold Martial Knowledge.`);
		return null;
	}
	var tmpmod = await askModifier(tmpevent, `${tmpname} — Modifier`);
	if (tmpmod === null) { return null; }

	var tmplines = [];
	var tmprolls = [];
	var tmpneedstouch = (tmpfamily == "holds") || (tmpfamily == "throws" && tmpname != "Spin Throw");
	if (tmpneedstouch) {
		var tmptouchroll = await rollFormula("1d20");
		tmprolls.push(tmptouchroll);
		var tmptouch = resolveMartialTouch(tmptouchroll.total, tmpactor.system.combat.missileAttack);
		tmplines.push(`Touch: d20 ${tmptouch.natural} ${tmpactor.system.combat.missileAttack >= 0 ? "+" : ""}${tmpactor.system.combat.missileAttack || 0}
			= ${tmptouch.total}, needing 10 &mdash; <strong>${tmptouch.touched ? "contact" : "no contact"}</strong>`);
		if (!tmptouch.touched) {
			tmplines.push(`No contact, so no ${esc(tmpname)} ${tmpfamily == "holds" ? "hold" : "throw"}.`);
			return await postMartialCard(tmpactor, tmpname, tmplines, tmprolls);
		}
	}

	var tmpskill = await rollSkillCheck(tmprow.chance + tmpmod);
	tmprolls.push(tmpskill.rollObject);
	tmplines.push(`${esc(tmpname)}: ${tmpskill.text}`);

	if (tmpskill.made && tmpfamily == "throws" && tmprow.damage && tmprow.damage != "+2") {
		var tmpthrow = await rollFormula(tmprow.damage);
		tmprolls.push(tmpthrow);
		tmplines.push(`If the contest is won: ${esc(tmprow.damage)} = <strong>${tmpthrow.total}</strong> damage
			(+2 with a Spin Throw made; +1 per die against stone, +2 per die against metal).`);
	}

	// Time. The row's own figure, and what a made Feather Block adds to a block or a made Slam to a
	// throw -- the book's timings, by the user's ruling of 2026-09-22 (MARTIAL_LORE_TIMING).
	var tmplorestate = tmpmartial.state?.lore ?? {};
	var tmpadded = (tmpfamily == "blocks") ? (parseInt(tmplorestate.blockSeconds) || 0)
	             : (tmpfamily == "throws") ? (parseInt(tmplorestate.throwSeconds) || 0) : 0;
	var tmpbase = parseInt(tmprow.speed) || 0;
	if (tmpbase || tmpadded) {
		tmplines.push(`Time: ${tmpbase + tmpadded} second(s)${tmpadded
			? ` (${tmpbase} + ${tmpadded} for ${tmpfamily == "blocks" ? "Feather Block" : "Slam"})` : ""}.`);
	}
	if (tmprow.special) { tmplines.push(`<span class="muted">${esc(tmprow.special)}</span>`); }
	return await postMartialCard(tmpactor, tmpname, tmplines, tmprolls);
}


// @MARKER MOVES AND LORE VALUES

// This is the function which rolls a move. Made, it is added to the moves in play and adds its
// effect to the attacks that follow, until cleared -- his move success box and SET button, in one.
// Failed, it is taken out, and Jump, Flying, Sweep and Spinning ask their Agility save (his
// handleMoveSkillRoll).
export async function rollMartialMove(tmpactor, tmpname, tmpevent) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmprow = (tmpmartial.rows?.moves ?? []).find(r => r.name == tmpname);
	if (!tmprow || !tmpmartial.hasKnowledge) { return null; }
	var tmpmod = await askModifier(tmpevent, `${tmpname} — Modifier`);
	if (tmpmod === null) { return null; }

	var tmpskill = await rollSkillCheck(tmprow.chance + tmpmod);
	var tmprolls = [tmpskill.rollObject];
	var tmplines = [`${esc(tmpname)}: ${tmpskill.text}`];

	var tmpactive = parseMartialList(tmpmartial.activeMoves).filter(n => n != tmpname);
	if (tmpskill.made) {
		tmpactive.push(tmpname);
		tmplines.push(`<span class="muted">${esc(tmprow.special)}</span>`);
	} else {
		var tmpsave = await rollFormula("1d100");
		var tmpfailed = resolveFailedMove(tmpname, tmpactor.system.attributes.agl.save, {
			saveRoll: tmpsave.total, proneRoll: (await rollFormula("1d6")).total, lossRoll: (await rollFormula("1d3")).total });
		if (tmpfailed.text) { tmprolls.push(tmpsave); tmplines.push(tmpfailed.text); }
	}
	await tmpactor.update({ "system.martial.activeMoves": tmpactive.join(",") });
	return await postMartialCard(tmpactor, `${tmpname} (move)`, tmplines, tmprolls);
}

// This is the function which rolls a Martial Lore value, against Martial Lore. Made, it is in play
// until cleared, as a move is. A failed Flip needs an Agility save to land on the feet (his
// handleMLSkillRoll).
export async function rollMartialLoreValue(tmpactor, tmpname, tmpevent) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmprow = (tmpmartial.loreRows ?? []).find(r => r.name == tmpname);
	if (!tmprow || !tmpmartial.hasLore) { return null; }
	var tmpmod = await askModifier(tmpevent, `${tmpname} — Modifier`);
	if (tmpmod === null) { return null; }

	var tmpskill = await rollSkillCheck(tmprow.chance + tmpmod);
	var tmprolls = [tmpskill.rollObject];
	var tmplines = [`${esc(tmpname)}: ${tmpskill.text}`];

	// Its time, the book's (MARTIAL_LORE_TIMING): Flip's own 2 seconds, or what it adds to the block
	// or throw it goes with, or "with" whatever it is part of.
	if (tmprow.speedText) { tmplines.push(`Time: ${esc(tmprow.speedText)}.`); }

	var tmpactive = parseMartialList(tmpmartial.activeLoreValues).filter(n => n != tmpname);
	if (tmpskill.made) {
		tmpactive.push(tmpname);
		tmplines.push(`<span class="muted">${esc(tmprow.special)}</span>`);
	} else if (tmpname == "Flip") {
		var tmpsave = await rollFormula("1d100");
		tmprolls.push(tmpsave);
		if (tmpsave.total > (parseInt(tmpactor.system.attributes.agl.save) || 0)) {
			var tmplost = (await rollFormula("1d3")).total;
			tmplines.push(`Agility save failed: falls prone, ${tmplost} second(s) to jump to feet.`);
		} else {
			tmplines.push("Agility save made: lands on the feet.");
		}
	}
	await tmpactor.update({ "system.martial.activeLoreValues": tmpactive.join(",") });
	return await postMartialCard(tmpactor, `${tmpname} (Martial Lore)`, tmplines, tmprolls);
}


// @MARKER LEARNING

	// This is the function which asks for one thing from a list. Returns null if cancelled.
	async function askPick(tmptitle, tmplabel, tmpchoices, tmphint) {
		if (!tmpchoices.length) { return null; }
		var tmpoptions = tmpchoices.map(c => `<option value="${esc(c.value)}">${esc(c.label)}</option>`).join("");
		return await foundry.applications.api.DialogV2.prompt({
			window: { title: tmptitle },
			content: `${tmphint ? `<p class="hint">${tmphint}</p>` : ""}
				<div class="form-group"><label>${esc(tmplabel)}</label><select name="pick">${tmpoptions}</select></div>`,
			rejectClose: false,
			ok: { label: "Roll", callback: (event, button) => button.form.elements.pick.value }
		});
	}

// This is the function which learns a stance with a Martial Knowledge roll (Mysteries of the
// Planes p.167: thirty-six hours of training per attempt).
export async function learnMartialStance(tmpactor) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmpknown = parseMartialList(tmpmartial.stances);
	var tmpstance = await askPick("Learn a Martial Stance", "Stance",
		MARTIAL_STANCE_NAMES.filter(n => !tmpknown.includes(n)).map(n => ({ value: n, label: n })),
		"A Martial Knowledge roll, after thirty-six hours of training per attempt.");
	if (!tmpstance) { return null; }
	var tmproll = await rollFormula("1d100");
	var tmpresult = resolveLearnStance({ stance: tmpstance, chance: tmpmartial.knowChance,
		list: tmpmartial.stances, roll: tmproll.total });
	if (tmpresult.outcome == "succeeded") { await tmpactor.update({ "system.martial.stances": tmpresult.list }); }
	return await postMartialCard(tmpactor, `Learn ${tmpstance}`, [tmpresult.reason], [tmproll]);
}

// This is the function which masters a learned stance with a Martial Lore roll.
export async function masterMartialStance(tmpactor) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmpmastered = parseMartialList(tmpmartial.masteredStances);
	var tmpstance = await askPick("Master a Martial Stance", "Stance",
		parseMartialList(tmpmartial.stances).filter(n => !tmpmastered.includes(n)).map(n => ({ value: n, label: n })),
		"A Martial Lore roll, after thirty-six more hours of practice per attempt.");
	if (!tmpstance) {
		ui.notifications.info("No learned stance is left to master.");
		return null;
	}
	var tmproll = await rollFormula("1d100");
	var tmpresult = resolveMasterStance({ stance: tmpstance, hasLore: tmpmartial.hasLore,
		chance: tmpmartial.loreChance, known: tmpmartial.stances, mastered: tmpmartial.masteredStances,
		roll: tmproll.total });
	if (tmpresult.outcome == "succeeded") { await tmpactor.update({ "system.martial.masteredStances": tmpresult.list }); }
	return await postMartialCard(tmpactor, `Master ${tmpstance}`, [tmpresult.reason], [tmproll]);
}

// This is the function which learns a Martial Knowledge subskill from outside the character's
// discipline, with a Martial Lore roll. The book: "when the martial artist is exposed to Martial
// Knowledge disciplines other than his chosen one" -- the Game Master's call, not the sheet's.
export async function learnMartialSubskill(tmpactor) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmpchoices = [];
	for (const [tmpfamily, tmpinfo] of Object.entries(MARTIAL_FAMILIES)) {
		for (const tmpname of Object.keys(tmpinfo.table)) {
			if ((tmpmartial.known?.[tmpfamily] ?? []).includes(tmpname)) { continue; }
			tmpchoices.push({ value: `${tmpfamily}|${tmpname}`, label: `${tmpname} (${tmpinfo.loreType})` });
		}
	}
	var tmppick = await askPick("Learn with Martial Lore", "Subskill", tmpchoices,
		"A Martial Lore roll to learn a Martial Knowledge subskill outside the character's discipline.");
	if (!tmppick) { return null; }
	var [tmpfamily, tmpname] = tmppick.split("|");
	var tmpkey = "learned" + tmpfamily.charAt(0).toUpperCase() + tmpfamily.slice(1);
	var tmproll = await rollFormula("1d100");
	var tmpresult = resolveLearnSubskill({ family: tmpfamily, name: tmpname, chance: tmpmartial.loreChance,
		known: tmpmartial.known?.[tmpfamily] ?? [], learned: tmpmartial[tmpkey], roll: tmproll.total });
	if (tmpresult.outcome == "succeeded") { await tmpactor.update({ [`system.martial.${tmpkey}`]: tmpresult.list }); }
	return await postMartialCard(tmpactor, `Learn ${tmpname}`, [tmpresult.reason], [tmproll]);
}

// This is the function which learns one of the twelve Martial Lore values.
export async function learnMartialLoreValue(tmpactor) {
	var tmpmartial = tmpactor.system.martial ?? {};
	var tmpknown = parseMartialList(tmpmartial.loreValues);
	var tmpname = await askPick("Learn a Martial Lore Value", "Value",
		Object.keys(MARTIAL_LORE_VALUES).filter(n => !tmpknown.includes(n))
			.map(n => ({ value: n, label: `${n} (${MARTIAL_LORE_VALUES[n].type})` })),
		"A Martial Lore roll.");
	if (!tmpname) { return null; }
	var tmproll = await rollFormula("1d100");
	var tmpresult = resolveLearnLoreValue({ name: tmpname, chance: tmpmartial.loreChance,
		list: tmpmartial.loreValues, roll: tmproll.total });
	if (tmpresult.outcome == "succeeded") { await tmpactor.update({ "system.martial.loreValues": tmpresult.list }); }
	return await postMartialCard(tmpactor, `Learn ${tmpname}`, [tmpresult.reason], [tmproll]);
}
// @END (CODE)
