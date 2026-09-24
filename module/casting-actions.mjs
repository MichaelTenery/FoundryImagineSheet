// @START (CODE)
// @MARKER CASTING ACTIONS
//==================================================================================================================
// What the spell and invocation buttons on the Magic & Lore tab do in Foundry: the dialogs, the dice,
// the updates to the caster, and the chat card -- on which each target's resistance is already
// rolled and each bolt, dart or finger that hit has an Apply button. The rules are pure, in
// module/casting-rules.mjs; what a spell or invocation DOES is his own code, generated into
// module/casting-worker.mjs and loaded the first time anything is cast.
//
// His buttons, and what each became:
//     USE on a spell row            castSpell            the Aura to put in, and on whom
//     MEM / MOD on a spell row      rememorizeSpell      his handleRemorizeSpell: the days refreshed
//     PRAY / REPRAY on an invocation prayForInvocation   Divine Knowledge; memorized, and its uses
//     USE on an invocation          invokeInvocation     a use spent, on whom
//     RESET AURA POOL               resetAuraPool        a full pool
//     SLEEP                         sleepSpells          his subtractDayFromAllSpells: a day of every
//                                                        spell's memory gone, and a full pool
//     DRAIN (set_aura)              drainAuraPool        his drainAuraPoolByAmount
//     REGEN (time and unit)         regenerateAura       his regenAuraPoolByTime
//     (his effects list)            removeMagicEffect    a spell or invocation running on oneself, ended
//     (a mishap's card)             applyMishapEffect    a mishap's AUR, WIL or Burnout, once
// MEM, Sleep and Drain, and the mishap's Apply, came across 2026-09-24 from the parallel magic branch.
//
// WHAT HIS SHEET COULD NOT DO. It never knew who a spell was aimed at: it wrote "MR is used to avoid
// damage" and left the rest to the table. Here the targets are the tokens the caster has targeted.
// Each target rolls the resistance the spell's Save names, at -20% against a mastered spell, and each
// attack that hit is applied from the card through the same blow a weapon's goes through
// (combat/attack.mjs applyBlowToActor), after the target's resistance has taken its share.
//==================================================================================================================

import { performSpellCast, performInvocation, resolvePrayer, isPrayerAnswered, isInDevotion, getInvocationUses,
         regenAuraByTime, drainAura, MASTERY_RESIST_MOD, updateEffectList, getSaveResistance,
         resolveTargetResistance, buildCastCard, getSpellDaysLeft, sleepSpellDays, resolveRememorize,
         describeRememorize, isSelfOnly } from "./casting-rules.mjs";
import { getDieRoll } from "./casting-helpers.mjs";
import { getAttackChart } from "./combat/combat-rules.mjs";
import { ARMOR_BLOCKING } from "./combat-tables.mjs";
import { applyBlowToActor } from "./combat/attack.mjs";
import { findActorCombatant } from "./combat/combat-document.mjs";
import { getItemKind, getMemorizationTotals } from "./lore-rules.mjs";

	// The generated worker, loaded the first time something is cast: it is about 1.5 MB.
	var castingWorker = null;
	async function loadWorker() {
		if (!castingWorker) { castingWorker = await import("./casting-worker.mjs"); }
		return castingWorker;
	}

	// This is the function which escapes text for a chat card or a dialog.
	function esc(tmptext) {
		return foundry.utils.escapeHTML(String(tmptext ?? ""));
	}

	// @MARKER ONE AT A TIME
	// A button pressed again before its first press has written anything -- a quick double-click --
	// reads the same uses, days or pool twice: two "invoked" cards for one use spent, two Sleeps with
	// every spell losing a day each time, two prayers for one invocation. ApplicationV2's buttons have
	// no debounce, and the bug sweep of 2026-09-23 found the same on the attack card's spend-time. So
	// each action is held here by its key until its writes land -- the actor and the spell or
	// invocation, or the actor's pool -- and a second press on the same one meanwhile does nothing. A
	// different spell, or another character, is never held up; a dialog left open counts as in
	// flight. From the parallel magic branch, 2026-09-24.
	const castingInFlight = new Set();
	async function oneAtATime(tmpkey, tmpaction) {
		if (castingInFlight.has(tmpkey)) { return null; }
		castingInFlight.add(tmpkey);
		try {
			return await tmpaction();
		} finally {
			castingInFlight.delete(tmpkey);
		}
	}

	// This is the function which gives the key an action on one spell or invocation is held by.
	function itemKey(tmpactor, tmpitem) {
		return `${tmpactor?.uuid ?? tmpactor?.id ?? ""}:${tmpitem?.id ?? ""}`;
	}

	// This is the function which gives the key an action on the actor's Aura pool is held by.
	function poolKey(tmpactor) {
		return `${tmpactor?.uuid ?? tmpactor?.id ?? ""}:pool`;
	}


// @MARKER READING THE CASTER
	// This is the function which gathers, off a character, every figure his doSpellAction and
	// doInvocationAction are handed -- in his names, for getAttrs, as well.
	function readCaster(tmpactor) {
		var tmpsys = tmpactor.system;
		var tmpchart = getAttackChart(tmpsys.combat?.attackSkill);
		var tmpaura = tmpsys.magic?.aura ?? {};
		var tmppiety = tmpsys.magic?.piety ?? {};
		var tmpvalue = (tmpkey) => parseInt(tmpsys.attributes?.[tmpkey]?.value) || 0;
		var tmpsave = (tmpkey) => parseInt(tmpsys.attributes?.[tmpkey]?.save) || 0;
		var tmpendurance = parseInt(tmpsys.characteristics?.endurance?.value) || 0;
		return {
			name: tmpactor.name,
			title: parseInt(tmpsys.identity?.title) || 0,
			practitionerTitle: tmpaura.casting?.practitionerTitle ?? 0,
			className: tmpaura.className ?? "",
			effectList: tmpsys.magic?.effectList ?? "",
			alignment: tmpsys.identity?.alignment ?? "",
			powers: "",
			int: tmpvalue("int"), wil: tmpvalue("wil"), wis: tmpvalue("wis"), aur: tmpvalue("aur"), pty: tmpvalue("pty"),
			end: tmpendurance,
			intSave: tmpsave("int"), wilSave: tmpsave("wil"), auraSave: tmpsave("aur"),
			absorbAuraChance: tmpaura.absorbAura ?? 0,
			missileMod: (parseInt(tmpsys.combat?.missileAttack) || 0) + (parseInt(tmpsys.combat?.missileMisc) || 0),
			attackSkill: tmpchart.skill,
			chart: tmpchart,
			pietyLevel: tmppiety.level ?? 0,
			blessChance: tmppiety.bless ?? 0,
			blasphemyChance: tmppiety.blasphemy ?? 0,
			divineKnowledgeChance: tmppiety.divineKnowledge ?? 0,
			denial: !!tmpsys.magic?.divineDenial,
			// For his getAttrs: the caster's own values under his attribute names.
			attrs: {
				character_name: tmpactor.name, title: parseInt(tmpsys.identity?.title) || 0,
				aura: tmpvalue("aur"), willforce: tmpvalue("wil"), intelligence: tmpvalue("int"), wisdom: tmpvalue("wis"),
				piety: tmpvalue("pty"), endurance: tmpendurance, alignment: tmpsys.identity?.alignment ?? "",
				piety_control: tmppiety.control ?? 0, aura_control: tmpaura.control ?? 0,
				tmp_effect_list: tmpsys.magic?.effectList ?? "", powers: "",
				tmp_spirit_armor_mod: parseInt(tmpsys.combat?.spiritArmor) || 0,
				tmp_force_armor_mod: parseInt(tmpsys.combat?.forceArmor) || 0,
				pain_threshold: parseInt(tmpsys.combat?.painThreshold) || 0
			}
		};
	}

	// This is the function which gives the actors the user has targeted, one per token.
	function targetedActors() {
		return Array.from(game.user?.targets ?? []).map(tmptoken => tmptoken.actor).filter(tmpa => tmpa);
	}

	// This is the function which turns a casting time ("10 sec.", "2 sec.") into round seconds. A time
	// in minutes or longer is not a round's to spend, and gives none.
	function castSeconds(tmptime) {
		var tmpmatch = ("" + (tmptime ?? "")).match(/^\s*(\d+)\s*sec/i);
		return tmpmatch ? parseInt(tmpmatch[1]) : 0;
	}


// @MARKER CASTING A SPELL
	// This is the function behind a spell's Cast button -- his USE, useSpell (sheet-worker.js:161282).
	// Asks the Aura to put in (his spell_aura box, which he cleared after every cast) and on whom (his
	// "self" tick; here, the targeted tokens as well), casts, and posts the card. A spell whose range
	// or distance is Self opens on the caster, as his self tick is forced on for one.
	export async function castSpell(tmpactor, tmpitem) {
		return await oneAtATime(itemKey(tmpactor, tmpitem), () => castSpellNow(tmpactor, tmpitem));
	}
	async function castSpellNow(tmpactor, tmpitem) {
		var tmpsys = tmpactor.system;
		var tmpaura = tmpsys.magic?.aura ?? {};
		var tmpspell = tmpitem.system;
		var tmpcontrol = (parseInt(tmpaura.control) || 0) + (tmpspell.mastered ? 2 : 0);
		var tmppool = tmpaura.pool?.current ?? 0;
		var tmptargets = targetedActors();
		var tmplevel = parseInt(tmpspell.level) || 0;
		var tmpfailper = parseInt(tmpspell.fail) || 0;
		var tmpfailchance = (tmplevel > tmpcontrol && tmpfailper > 0) ? Math.min(100, tmpfailper * (tmplevel - tmpcontrol)) : 0;
		var tmpsuggest = Math.max(1, Math.min(tmpcontrol, tmppool));
		var tmpselfdefault = isSelfOnly("spell", tmpspell);

		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: `Cast ${tmpitem.name}` },
			content: `<div class="imagine-cast-dialog">
				<p class="hint">Aura Control ${tmpcontrol}${tmpspell.mastered ? " (+2 mastered)" : ""} &middot; Aura Pool ${tmppool} of ${tmpaura.pool?.full ?? 0}
					&middot; Aura Level ${tmplevel}${tmpfailchance ? ` &mdash; <strong>${tmpfailchance}% chance of a magical mishap</strong>, ${tmplevel - tmpcontrol} level(s) above Aura Control` : ""}</p>
				<div class="form-group"><label>Aura to put in</label>
					<input type="number" name="aura" min="1" value="${tmpsuggest}" autofocus>
					<p class="hint">The more Aura, the stronger the spell. No more than Aura Control, and no more than is in the pool.</p></div>
				<div class="form-group"><label>Cast on</label><select name="on">
					${tmptargets.length ? `<option value="targets" ${tmpselfdefault ? "" : "selected"}>Targeted: ${tmptargets.map(tmpa => esc(tmpa.name)).join(", ")}</option>` : ""}
					<option value="other">Another, or an area (no token targeted)</option>
					<option value="self" ${tmpselfdefault ? "selected" : ""}>${esc(tmpactor.name)} (self)</option>
				</select>${tmptargets.length ? "" : `<p class="hint">Target a token first to cast at someone: they then roll their resistance, and a bolt that hits can be applied to them from the card.</p>`}</div>
				${tmptargets.length == 1 ? `<div class="form-group"><label>Target is avoiding</label>
					<input type="checkbox" name="defense" ${tmptargets[0].system?.combat?.noDefense ? "" : "checked"}>
					<p class="hint">An Aura dart, arrow or bolt is rolled like a missile weapon: ${esc(tmptargets[0].name)}'s defensive adjustment applies unless they cannot move.</p></div>` : ""}
			</div>`,
			rejectClose: false,
			ok: { label: "Cast", callback: (tmpe, tmpbutton) => ({
				aura: parseInt(tmpbutton.form.elements.aura.value) || 0,
				on: tmpbutton.form.elements.on.value,
				defense: tmpbutton.form.elements.defense ? tmpbutton.form.elements.defense.checked : false }) }
		});
		if (!tmpanswer) { return null; }

		var tmpworker = await loadWorker();
		var tmpcaster = readCaster(tmpactor);
		var tmpvictims = tmpanswer.on == "targets" ? tmptargets : [];
		var tmpdefense = (tmpvictims.length == 1 && tmpanswer.defense) ? (parseInt(tmpvictims[0].system?.combat?.defensiveAdjust) || 0) : 0;
		var tmpresult = performSpellCast(tmpworker,
			{ name: tmpitem.name, magicName: tmpspell.magicName },
			{ level: tmplevel, fail: tmpfailper, aura: tmpanswer.aura, castTime: tmpspell.castTime,
			  memorized: tmpspell.memorized, days: getSpellDaysLeft(tmpspell), mastered: tmpspell.mastered,
			  suppressed: tmpsys.magic?.magicSuppressed,
			  halfMagic: tmpsys.magic?.halfMagic, auraControl: tmpaura.control, auraPool: tmppool,
			  title: tmpcaster.title, auraSave: tmpcaster.auraSave, castingSkill: tmpaura.casting ?? { name: "", chance: 0 } },
			tmpcaster, { self: tmpanswer.on == "self", missileDefense: tmpdefense }, getDieRoll);

		// What the cast does to the caster: the Aura drained, the effects list, and his suppression
		// and half magic. Everything else it would have changed is listed on the card.
		var tmpupdate = {};
		if (tmpresult.drain > 0) { tmpupdate["system.magic.drainedAura"] = drainAura(tmpaura.pool, tmpresult.drain); }
		var tmpeffects = updateEffectList(tmpsys.magic?.effectList, tmpresult.effectsAdded, tmpresult.effectsRemoved);
		if (tmpeffects != (tmpsys.magic?.effectList ?? "")) { tmpupdate["system.magic.effectList"] = tmpeffects; }
		if (tmpresult.suppressAfter) { tmpupdate["system.magic.magicSuppressed"] = true; }
		if (tmpresult.halfMagicAfter) { tmpupdate["system.magic.halfMagic"] = true; }
		if (Object.keys(tmpupdate).length) { await tmpactor.update(tmpupdate); }
		// Loss of Spell: his uncheckSpellMemorize and clearSpellDays.
		if (tmpresult.forgetSpell) { await tmpitem.update({ "system.memorized": false, "system.days": 0 }); }

		var tmpwent = tmpresult.outcome == "cast" || tmpresult.outcome == "mishap";
		// Only a spell that went off reaches the targets; a mishap is the caster's, and the card says so.
		var tmpreached = tmpresult.outcome == "cast";
		return await postCastCard(tmpactor, {
			kind: "spell", name: tmpitem.name, aura: tmpresult.resolved.castAura,
			outcome: tmpresult.outcome, went: tmpwent,
			text: tmpresult.text, attacks: tmpresult.attacks, changes: tmpresult.changes,
			effectsAdded: tmpresult.effectsAdded, effectsRemoved: tmpresult.effectsRemoved,
			powersAdded: tmpresult.powersAdded, powersRemoved: tmpresult.powersRemoved,
			forgot: tmpresult.forgetSpell, save: tmpspell.save, description: tmpspell.description,
			resistModifier: tmpspell.mastered ? MASTERY_RESIST_MOD : 0,
			victims: tmpreached ? tmpvictims : [], self: tmpanswer.on == "self",
			seconds: tmpwent ? castSeconds(tmpresult.resolved.castTime) : 0,
			drained: tmpresult.drain,
			mishapEffects: tmpresult.mishapEffects
		});
	}

// @MARKER INVOKING
	// This is the function behind an invocation's Invoke button -- his USE, useInvocation (153430).
	export async function invokeInvocation(tmpactor, tmpitem) {
		return await oneAtATime(itemKey(tmpactor, tmpitem), () => invokeInvocationNow(tmpactor, tmpitem));
	}
	async function invokeInvocationNow(tmpactor, tmpitem) {
		var tmpsys = tmpactor.system;
		var tmpinvocation = tmpitem.system;
		var tmptargets = targetedActors();
		var tmpselfdefault = isSelfOnly("invocation", tmpinvocation);
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: `Invoke ${tmpitem.name}` },
			content: `<div class="imagine-cast-dialog">
				<p class="hint">Piety level ${tmpsys.magic?.piety?.level ?? 0} &middot; ${parseInt(tmpinvocation.usesLeft) || 0} use(s) left</p>
				<div class="form-group"><label>Invoke on</label><select name="on">
					${tmptargets.length ? `<option value="targets" ${tmpselfdefault ? "" : "selected"}>Targeted: ${tmptargets.map(tmpa => esc(tmpa.name)).join(", ")}</option>` : ""}
					<option value="other">Another, or an area (no token targeted)</option>
					<option value="self" ${tmpselfdefault ? "selected" : ""}>${esc(tmpactor.name)} (self)</option>
				</select></div>
				${tmptargets.length == 1 ? `<div class="form-group"><label>Target is avoiding</label>
					<input type="checkbox" name="defense" ${tmptargets[0].system?.combat?.noDefense ? "" : "checked"}></div>` : ""}
			</div>`,
			rejectClose: false,
			ok: { label: "Invoke", callback: (tmpe, tmpbutton) => ({ on: tmpbutton.form.elements.on.value,
				defense: tmpbutton.form.elements.defense ? tmpbutton.form.elements.defense.checked : false }) }
		});
		if (!tmpanswer) { return null; }

		var tmpworker = await loadWorker();
		var tmpinvoker = readCaster(tmpactor);
		var tmpvictims = tmpanswer.on == "targets" ? tmptargets : [];
		var tmpdefense = (tmpvictims.length == 1 && tmpanswer.defense) ? (parseInt(tmpvictims[0].system?.combat?.defensiveAdjust) || 0) : 0;
		var tmpresult = performInvocation(tmpworker,
			{ name: tmpitem.name, invokeTime: tmpinvocation.invokeTime, memorized: tmpinvocation.memorized, uses: tmpinvocation.usesLeft },
			tmpinvoker, { self: tmpanswer.on == "self", missileDefense: tmpdefense });

		if (tmpresult.outcome == "invoked") {
			await tmpitem.update({ "system.usesLeft": tmpresult.usesAfter });
			var tmpeffects = updateEffectList(tmpsys.magic?.effectList, tmpresult.effectsAdded, tmpresult.effectsRemoved);
			if (tmpeffects != (tmpsys.magic?.effectList ?? "")) { await tmpactor.update({ "system.magic.effectList": tmpeffects }); }
		}
		var tmpwent = tmpresult.outcome == "invoked";
		return await postCastCard(tmpactor, {
			kind: "invocation", name: tmpitem.name, pietyLevel: tmpinvoker.pietyLevel,
			outcome: tmpresult.outcome, went: tmpwent, usesLeft: tmpresult.usesAfter,
			text: tmpresult.text, attacks: tmpresult.attacks, changes: tmpresult.changes,
			effectsAdded: tmpresult.effectsAdded, effectsRemoved: tmpresult.effectsRemoved,
			powersAdded: tmpresult.powersAdded, powersRemoved: tmpresult.powersRemoved,
			save: tmpinvocation.save, description: tmpinvocation.description, resistModifier: 0,
			victims: tmpwent ? tmpvictims : [], self: tmpanswer.on == "self",
			seconds: tmpwent ? castSeconds(tmpinvocation.invokeTime) : 0
		});
	}


// @MARKER PRAYING
	// This is the function behind an invocation's Pray button -- his PRAY (handlePrayForInvocation, the
	// first time: alignment, Piety Control, memory and devotion are all checked) and REPRAY
	// (handleReprayForInvocation, once memorized: new uses). Shift-click asks for his MOD button's
	// modifier. An answered prayer memorizes it and gives it its uses; a roll more than 20 over the
	// chance brings 24 hours of Divine Denial.
	export async function prayForInvocation(tmpactor, tmpitem, tmpevent) {
		return await oneAtATime(itemKey(tmpactor, tmpitem), () => prayForInvocationNow(tmpactor, tmpitem, tmpevent));
	}
	async function prayForInvocationNow(tmpactor, tmpitem, tmpevent) {
		var tmpsys = tmpactor.system;
		var tmppiety = tmpsys.magic?.piety ?? {};
		var tmpmodifier = 0;
		if (tmpevent?.shiftKey) {
			var tmpasked = await foundry.applications.api.DialogV2.prompt({
				window: { title: `Pray for ${tmpitem.name}` },
				content: `<p>Situational modifier:</p><input type="number" name="modifier" value="0" autofocus>`,
				rejectClose: false,
				ok: { label: "Pray", callback: (tmpe, tmpb) => tmpb.form.elements.modifier.value }
			});
			if (tmpasked === null || tmpasked === undefined) { return null; }
			tmpmodifier = parseInt(tmpasked) || 0;
		}
		var tmprepray = !!tmpitem.system.memorized;
		var tmplevel = parseInt(tmpitem.system.level) || 0;

		// His memorization check counts what is memorized now, not counting this invocation.
		var tmpknwpoints = parseInt(tmpsys.attributes?.knw?.mods?.memorizationPoints) || 0;
		var tmpentries = tmpactor.items.filter(tmpi => ["lore", "spell", "invocation"].includes(tmpi.type) && tmpi.id != tmpitem.id)
			.map(tmpi => ({ kind: getItemKind(tmpi), rating: tmpi.system?.rating, level: tmpi.system?.level, memorized: !!tmpi.system?.memorized }));
		var tmpmemory = getMemorizationTotals(tmpknwpoints, tmpsys.identity?.goal, tmpentries);

		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolvePrayer({
			repray: tmprepray, name: tmpitem.name, chance: tmppiety.divineKnowledge, modifier: tmpmodifier,
			alreadyKnown: false, memorized: tmpitem.system.memorized, restriction: tmpitem.system.alignment,
			alignment: tmpsys.identity?.alignment, level: tmplevel, pietyControl: tmppiety.control,
			denial: tmpsys.magic?.divineDenial, memoryUsed: tmpmemory.used, memoryAvailable: tmpmemory.available,
			inDevotion: isInDevotion(tmpitem.name, tmpsys.magic?.devotions, tmpsys.magic?.ignoreDevotions)
		}, tmproll.total);

		var tmpname = esc(tmpactor.name);
		var tmpinv = esc(tmpitem.name);
		var tmpverb = tmprepray ? "repray" : "pray";
		var tmpwords = {
			notMemorized:     `${tmpname} has not memorized ${tmpinv}. Nothing done.`,
			wrongAlignment:   `${tmpname} is blocked from praying for ${tmpinv} invocation with an alignment restriction of ${esc(tmpitem.system.alignment)} by their alignment of ${esc(tmpsys.identity?.alignment)}. Nothing done.`,
			overPietyControl: `${tmpname} has PC of ${tmppiety.control ?? 0} and cannot pray for ${tmpinv} because a PC of ${tmplevel} is required. Nothing done.`,
			denial:           `${tmpname} is currently in divine denial and cannot pray for any invocations. Nothing done.`,
			noMemory:         `${tmpname} does not have enough memorization points to pray for ${tmpinv}. Nothing done.`,
			noDevotion:       `${tmpname} does not have a devotion that contains ${tmpinv}. Nothing done.`,
			grandmaster:      `${tmpname} is a Grandmaster of Divine Knowledge and automatically ${tmpverb}ed for ${tmpinv} invocation.`,
			fumble:           `${tmpname} rolled a ${tmpresult.roll}% Divine Knowledge and failed to ${tmpverb} for ${tmpinv} invocation.`,
			critical:         `${tmpname} rolled a ${tmpresult.roll}% against a ${tmpresult.total}% Divine Knowledge and critically failed to ${tmpverb} for ${tmpinv} invocation. They are subject to Divine Denial for 24 hours.`,
			failure:          `${tmpname} rolled a ${tmpresult.roll}% against a ${tmpresult.total}% Divine Knowledge and failed to ${tmpverb} for ${tmpinv} invocation.`,
			success:          `${tmpname} rolled a ${tmpresult.roll}% against a ${tmpresult.total}% Divine Knowledge and ${tmpverb}ed for ${tmpinv} invocation.`
		};
		var tmpline = tmpwords[tmpresult.outcome] ?? tmpresult.outcome;
		var tmprolled = ["grandmaster", "fumble", "critical", "failure", "success"].includes(tmpresult.outcome);
		if (isPrayerAnswered(tmpresult.outcome)) {
			var tmpuses = getInvocationUses(tmpitem.system.uses, tmppiety.control);
			await tmpitem.update({ "system.memorized": true, "system.usesLeft": tmpuses });
			tmpline = tmpline + ` ${tmpuses} use(s).`;
		}
		if (tmpresult.outcome == "critical") { await tmpactor.update({ "system.magic.divineDenial": true }); }
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `${tmprepray ? "Repray" : "Pray"} for invocation: <strong>${tmpinv}</strong>${tmpitem.system.prayerTime ? ` (${esc(tmpitem.system.prayerTime)})` : ""}`,
			content: `<div class="imagine-magic-card"><p>${tmpline}</p></div>`,
			rolls: tmprolled ? [tmproll] : []
		});
		return tmpresult;
	}


// @MARKER MEMORY
	// This is the function behind a spell's MEM button -- his spell-remem, and his MOD beside it when
	// Shift is held (handleRemorizeSpell, sheet-worker.js:160766): the best casting skill is rolled,
	// and on a success the spell is memorized with its full days again (addSpellDays and
	// checkSpellMemorize). Memorizing takes the spell's Mem Time; the card says so, and the time is the
	// table's to pass.
	export async function rememorizeSpell(tmpactor, tmpitem, tmpevent) {
		return await oneAtATime(itemKey(tmpactor, tmpitem), () => rememorizeSpellNow(tmpactor, tmpitem, tmpevent));
	}
	async function rememorizeSpellNow(tmpactor, tmpitem, tmpevent) {
		var tmpsys = tmpactor.system;
		var tmpskill = tmpsys.magic?.aura?.casting ?? null;
		var tmpmodifier = 0;
		if (tmpevent?.shiftKey) {
			var tmpasked = await foundry.applications.api.DialogV2.prompt({
				window: { title: `Rememorize ${tmpitem.name}` },
				content: `<p>Situational modifier:</p><input type="number" name="modifier" value="0" autofocus>`,
				rejectClose: false,
				ok: { label: "Roll", callback: (tmpe, tmpb) => tmpb.form.elements.modifier.value }
			});
			if (tmpasked === null || tmpasked === undefined) { return null; }
			tmpmodifier = parseInt(tmpasked) || 0;
		}
		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveRememorize({ suppressed: tmpsys.magic?.magicSuppressed, castingSkill: tmpskill ?? { name: "", chance: 0 },
			modifier: tmpmodifier, level: tmpitem.system.level }, tmproll.total);
		if (tmpresult.days !== null) {
			await tmpitem.update({ "system.memorized": true, "system.days": tmpresult.days });
		}
		var tmpline = describeRememorize(tmpresult, { name: tmpactor.name, spell: tmpitem.name, skill: tmpskill?.name ?? "",
			memTime: tmpitem.system.memTime });
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `Rememorize spell: <strong>${esc(tmpitem.name)}</strong>`,
			content: `<div class="imagine-magic-card"><p>${esc(tmpline)}</p>`
				+ (tmpresult.days !== null ? `<p class="muted">${tmpresult.days} day(s) of memory.</p>` : "") + `</div>`,
			rolls: tmpresult.roll !== null ? [tmproll] : []
		});
		return tmpresult;
	}


// @MARKER THE AURA POOL
	// This is the function which refills the pool -- his resetAuraPoolMessaged: nothing drained.
	export async function resetAuraPool(tmpactor) {
		return await oneAtATime(poolKey(tmpactor), async () => {
			await tmpactor.update({ "system.magic.drainedAura": 0 });
			await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
				content: `<div class="imagine-magic-card"><p>${esc(tmpactor.name)} refilled their Aura pool.</p></div>` });
		});
	}

	// This is the function behind his Sleep button -- subtractDayFromAllSpells (160889): every spell
	// loses a day of memory, none below 0, and the Aura pool is refilled (his resetAuraPool). A spell
	// whose days were never counted reads its full count (getSpellDaysLeft) and loses a day of that; one
	// with none left, or never counted and not memorized, has none to lose and is left alone.
	export async function sleepSpells(tmpactor) {
		return await oneAtATime(poolKey(tmpactor), () => sleepSpellsNow(tmpactor));
	}
	async function sleepSpellsNow(tmpactor) {
		var tmpupdates = [];
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "spell") { continue; }
			var tmpdays = getSpellDaysLeft(tmpitem.system);
			if (tmpdays == 0) { continue; }
			tmpupdates.push({ _id: tmpitem.id, "system.days": sleepSpellDays(tmpdays) });
		}
		if (tmpupdates.length) { await tmpactor.updateEmbeddedDocuments("Item", tmpupdates); }
		await tmpactor.update({ "system.magic.drainedAura": 0 });
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: "Sleep (End Spell Day)",
			content: `<div class="imagine-magic-card"><p>${esc(tmpactor.name)} slept, refilled their Aura pool, and lost 1 day of usage from all memorized spells.</p></div>` });
	}

	// This is the function behind his Drain button -- drainAuraPoolByAmount (160962), with his set_aura
	// box asked for: so much Aura taken from the pool (an Aura user's skill, a spell cast at the table,
	// an item), never more than it holds. His posts nothing; the tab's pool line shows it.
	export async function drainAuraPool(tmpactor) {
		return await oneAtATime(poolKey(tmpactor), () => drainAuraPoolNow(tmpactor));
	}
	async function drainAuraPoolNow(tmpactor) {
		var tmpaura = tmpactor.system.magic?.aura ?? {};
		var tmpamount = await foundry.applications.api.DialogV2.prompt({
			window: { title: "Drain Aura" },
			content: `<p class="hint">The pool holds ${tmpaura.pool?.current ?? 0} of ${tmpaura.pool?.full ?? 0}.</p>
				<div class="form-group"><label>Aura to drain</label><input type="number" name="amount" min="1" value="1" autofocus></div>`,
			rejectClose: false,
			ok: { label: "Drain", callback: (tmpe, tmpb) => parseInt(tmpb.form.elements.amount.value) || 0 }
		});
		if (!tmpamount || tmpamount < 1) { return; }
		var tmpnow = tmpactor.system.magic?.aura?.pool ?? { drained: 0, full: 0 };
		await tmpactor.update({ "system.magic.drainedAura": drainAura(tmpnow, tmpamount) });
	}

	// This is the function which gives back what a while's rest regenerates -- his regenAuraPoolByTime,
	// asked for a time and a unit as his regen_units box and dropdown were.
	export async function regenerateAura(tmpactor) {
		return await oneAtATime(poolKey(tmpactor), () => regenerateAuraNow(tmpactor));
	}
	async function regenerateAuraNow(tmpactor) {
		var tmpaura = tmpactor.system.magic?.aura ?? {};
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: "Regenerate Aura" },
			content: `<p class="hint">Regenerates at ${esc(tmpaura.regen ?? "1/per Hour")}. ${tmpaura.pool?.drained ?? 0} Aura drained.</p>
				<div class="form-group"><label>Time passed</label><input type="number" name="units" min="1" value="1" autofocus>
				<select name="unit"><option value="sec">seconds</option><option value="min">minutes</option><option value="hour" selected>hours</option></select></div>`,
			rejectClose: false,
			ok: { label: "Regenerate", callback: (tmpe, tmpb) => ({ units: parseInt(tmpb.form.elements.units.value) || 0, unit: tmpb.form.elements.unit.value }) }
		});
		if (!tmpanswer) { return; }
		var tmpdrained = tmpaura.pool?.drained ?? 0;
		var tmpregen = regenAuraByTime(tmpaura.regen, tmpanswer.units, tmpanswer.unit, tmpdrained);
		var tmpname = esc(tmpactor.name);
		var tmpline = "";
		if (tmpregen.reset) {
			await tmpactor.update({ "system.magic.drainedAura": 0 });
			tmpline = `${tmpname} regenerated all of the Aura in their pool after ${tmpanswer.units} ${tmpanswer.unit}.`;
		} else if (tmpregen.regained > 0) {
			await tmpactor.update({ "system.magic.drainedAura": Math.max(0, tmpdrained - tmpregen.regained) });
			tmpline = `${tmpname} regenerated ${tmpregen.regained} Aura to their pool after ${tmpanswer.units} ${tmpanswer.unit}.`;
		} else {
			tmpline = `Not enough time passed to regenerate any Aura to ${tmpname}'s pool.`;
		}
		await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			content: `<div class="imagine-magic-card"><p>${tmpline}</p></div>` });
	}

	// This is the function which ends a spell or invocation running on the caster -- his
	// standardSpellRemovalEffect, by hand.
	export async function removeMagicEffect(tmpactor, tmpentry) {
		var tmplist = updateEffectList(tmpactor.system.magic?.effectList, [], [tmpentry]);
		await tmpactor.update({ "system.magic.effectList": tmplist });
	}


// @MARKER THE CARD
	// This is the function which rolls each target's resistance and posts a cast's chat card.
	async function postCastCard(tmpactor, tmpcast) {
		var tmpresistkey = getSaveResistance(tmpcast.save);
		var tmprolls = [];
		var tmptargets = [];
		for (const tmpvictim of tmpcast.victims ?? []) {
			var tmptrack = tmpresistkey ? tmpvictim.system?.resistances?.[tmpresistkey] : null;
			var tmproll = null;
			if (tmptrack) {
				tmproll = await new Roll("1d100").evaluate();
				tmprolls.push(tmproll);
			}
			tmptargets.push(resolveTargetResistance({ uuid: tmpvictim.uuid, name: tmpvictim.name, track: tmptrack },
				tmpresistkey, tmpcast.resistModifier ?? 0, tmproll?.total ?? 0, `${tmpcast.text ?? ""} ${tmpcast.description ?? ""}`));
		}
		var tmpcard = buildCastCard({ uuid: tmpactor.uuid, name: tmpactor.name }, tmpcast, tmptargets);
		var tmphtml = await foundry.applications.handlebars.renderTemplate("systems/imagine-rpg/templates/chat/cast-card.hbs",
			{ ...tmpcard, inCombat: !!findActorCombatant(tmpactor, game.combat) });
		return await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			content: tmphtml,
			rolls: tmprolls,
			flags: { "imagine-rpg": { cast: tmpcard } }
		});
	}


// @MARKER APPLYING THE DAMAGE
	// This is the function which asks where on the target a spell's damage lands, what kind it is,
	// whether armour stops it, and how much -- the attack's damage, cut by the target's resistance
	// (getResistedFraction), which the Game Master may change.
	async function askSpellDamage(tmptarget, tmpheading, tmpamount, tmptypes, tmpbypass, tmphint) {
		var tmpareas = tmptarget.system?.body?.areas ?? [];
		if (!tmpareas.length) { ui.notifications.warn(`${tmptarget.name} has no body areas to damage.`); return null; }
		return await foundry.applications.api.DialogV2.prompt({
			window: { title: `${tmpheading} — ${tmptarget.name}` },
			content: `<div class="imagine-damage-dialog">
				${tmphint ? `<p class="hint">${tmphint}</p>` : ""}
				<div class="form-group"><label>Damage</label><input type="number" name="amount" min="0" value="${tmpamount ?? ""}" autofocus></div>
				<div class="form-group"><label>Area struck</label><select name="area">${tmpareas.map(tmpa =>
					`<option value="${esc(tmpa.name)}">${esc(tmpa.name)} (armour ${tmpa.armor})</option>`).join("")}</select></div>
				<div class="form-group"><label>Damage type</label><select name="type">${Object.keys(ARMOR_BLOCKING).map(tmpt =>
					`<option value="${tmpt}" ${tmpt == tmptypes[0] ? "selected" : ""}>${tmpt}</option>`).join("")}</select></div>
				<div class="form-group"><label>Bypasses armour</label><input type="checkbox" name="bypass" ${tmpbypass ? "checked" : ""}>
					<p class="hint">Ticked where the spell's own words say armour does not stop it.</p></div>
				${tmptarget.system?.combat?.invulnerable ? `<div class="form-group"><label>Magical plus</label>
					<input type="number" name="plus" value="5"><p class="hint">${esc(tmptarget.name)} is invulnerable, which reads a weapon's
					magical plus. A spell has none of its own: +5 lands in full, +3 a half, +1 a quarter, 0 nothing. The Game Master's call.</p></div>` : ""}
			</div>`,
			rejectClose: false,
			ok: { label: "Apply", callback: (tmpe, tmpb) => ({
				amount: parseInt(tmpb.form.elements.amount.value) || 0, area: tmpb.form.elements.area.value,
				type: tmpb.form.elements.type.value, bypass: tmpb.form.elements.bypass.checked,
				plus: tmpb.form.elements.plus ? (parseInt(tmpb.form.elements.plus.value) || 0) : 5 }) }
		});
	}

	// This is the function which picks the target a card's damage goes to: the only one, one of
	// several (asked), or with none on the card, the one token the user has targeted now.
	async function pickCardTarget(tmpcard, tmpindex) {
		var tmptargets = tmpcard.targets ?? [];
		if (tmpindex !== undefined && tmptargets[tmpindex]) { return { entry: tmptargets[tmpindex], index: tmpindex }; }
		if (tmptargets.length == 1) { return { entry: tmptargets[0], index: 0 }; }
		if (tmptargets.length > 1) {
			var tmpchosen = await foundry.applications.api.DialogV2.prompt({
				window: { title: "Which target?" },
				content: `<div class="form-group"><label>Target</label><select name="who">${tmptargets.map((tmpt, i) =>
					`<option value="${i}">${esc(tmpt.name)}${tmpt.resist ? ` (${esc(tmpt.resist.outcome)})` : ""}</option>`).join("")}</select></div>`,
				rejectClose: false,
				ok: { label: "Next", callback: (tmpe, tmpb) => parseInt(tmpb.form.elements.who.value) }
			});
			if (tmpchosen === null || tmpchosen === undefined || isNaN(tmpchosen)) { return null; }
			return { entry: tmptargets[tmpchosen], index: tmpchosen };
		}
		var tmpnow = targetedActors();
		if (tmpnow.length != 1) { ui.notifications.warn("Target the one token the spell struck, then apply its damage."); return null; }
		return { entry: { uuid: tmpnow[0].uuid, name: tmpnow[0].name, fraction: 1 }, index: -1 };
	}

	// This is the function behind a card's Apply button on an attack that hit: one bolt, dart or
	// finger onto one target. Guarded as a weapon card's is -- only the card's author or the Game Master
	// applies it, so it is never applied twice -- and a bolt already applied to a target says so.
	export async function applySpellAttack(tmpmessage, tmpattackindex) {
		var tmpcard = tmpmessage.getFlag("imagine-rpg", "cast");
		var tmpattack = tmpcard?.attacks?.[tmpattackindex];
		if (!tmpattack?.isHit) { return; }
		if (!tmpmessage.isOwner) {
			ui.notifications.warn("Only the Game Master or whoever cast this can apply its damage, so it is never applied twice. Ask the Game Master.");
			return;
		}
		var tmppicked = await pickCardTarget(tmpcard);
		if (!tmppicked) { return; }
		if ((tmpattack.applied ?? []).includes(tmppicked.entry.uuid)) {
			ui.notifications.warn(`${tmpattack.name} has already been applied to ${tmppicked.entry.name}.`);
			return;
		}
		var tmptarget = await fromUuid(tmppicked.entry.uuid);
		if (!tmptarget) { ui.notifications.warn(`${tmppicked.entry.name} is no longer there.`); return; }
		if (!tmptarget.isOwner) { ui.notifications.warn(`You do not have permission to change ${tmptarget.name}. Ask the Game Master to apply it.`); return; }

		var tmprolled = (tmpattack.amounts ?? []).reduce((tmps, tmpv) => tmps + tmpv, 0);
		var tmpfraction = tmppicked.entry.fraction ?? 1;
		var tmpamount = parseInt(tmprolled * tmpfraction) || 0;
		var tmphint = `${esc(tmpattack.name)} rolled ${esc(tmpattack.dice)} = ${esc(tmpattack.damage)} ${esc(tmpattack.damageType)}`
			+ (tmppicked.entry.resist ? `; ${esc(tmppicked.entry.name)} ${esc(tmppicked.entry.resist.outcome.toLowerCase())}, so ${tmppicked.entry.fractionLabel ?? ""}` : "")
			+ (tmpattack.special ? `. His note: ${esc(tmpattack.special)}.` : ".")
			+ (tmpattack.amounts?.length > 1 ? ` Two kinds of damage: apply each part in turn if they meet different armour.` : "");
		var tmpoptions = await askSpellDamage(tmptarget, tmpattack.name, tmpamount, tmpattack.bodyTypes ?? ["Other"], tmpattack.bypass, tmphint);
		if (!tmpoptions) { return; }
		var tmplanded = await applyBlowToActor(tmptarget, { total: tmpoptions.amount, type: tmpoptions.type, area: tmpoptions.area,
			bypass: tmpoptions.bypass, magicPlus: tmpoptions.plus });
		if (!tmplanded) { return; }
		// Read the flag again: another application may have landed while the dialog was open.
		var tmpnow = foundry.utils.deepClone(tmpmessage.getFlag("imagine-rpg", "cast"));
		var tmpnowattack = tmpnow.attacks[tmpattackindex];
		tmpnowattack.applied = [...new Set([...(tmpnowattack.applied ?? []), tmppicked.entry.uuid])];
		await tmpmessage.setFlag("imagine-rpg", "cast.attacks", tmpnow.attacks);
	}

	// This is the function behind a target's own Apply button: damage a spell does with no attack roll
	// of its own -- a storm, an explosion, a cloud, whose dice are in his words above -- onto that
	// target, after their resistance. The amount is the Game Master's to read off the card.
	export async function applySpellToTarget(tmpmessage, tmptargetindex) {
		var tmpcard = tmpmessage.getFlag("imagine-rpg", "cast");
		var tmpentry = tmpcard?.targets?.[tmptargetindex];
		if (!tmpentry) { return; }
		if (!tmpmessage.isOwner) {
			ui.notifications.warn("Only the Game Master or whoever cast this can apply its damage. Ask the Game Master.");
			return;
		}
		var tmptarget = await fromUuid(tmpentry.uuid);
		if (!tmptarget) { ui.notifications.warn(`${tmpentry.name} is no longer there.`); return; }
		if (!tmptarget.isOwner) { ui.notifications.warn(`You do not have permission to change ${tmptarget.name}. Ask the Game Master to apply it.`); return; }
		var tmphint = `The damage in the spell's words, as it falls on ${esc(tmpentry.name)}`
			+ (tmpentry.resist ? `, who ${esc(tmpentry.resist.outcome.toLowerCase())} and so ${tmpentry.fractionLabel}` : "") + ".";
		var tmpoptions = await askSpellDamage(tmptarget, tmpcard.name, "", ["Other"], false, tmphint);
		if (!tmpoptions) { return; }
		await applyBlowToActor(tmptarget, { total: tmpoptions.amount, type: tmpoptions.type, area: tmpoptions.area,
			bypass: tmpoptions.bypass, magicPlus: tmpoptions.plus });
	}

	// This is the function which spends a cast's seconds on the caster's round clock, as a weapon
	// card's Spend does (combat/attack.mjs spendAttackTime), once.
	const spendingCasts = new Set();
	export async function spendCastTime(tmpmessage) {
		var tmpcard = tmpmessage.getFlag("imagine-rpg", "cast");
		if (!tmpcard || !game.combat || !(tmpcard.seconds > 0)) { return; }
		if (tmpcard.spent) { ui.notifications.info("These seconds have already been spent."); return; }
		if (spendingCasts.has(tmpmessage.id)) { return; }
		spendingCasts.add(tmpmessage.id);
		try {
			var tmpactor = await fromUuid(tmpcard.casterUuid);
			var tmpcombatant = findActorCombatant(tmpactor, game.combat);
			if (!tmpcombatant) { ui.notifications.warn("The caster is not in the current combat."); return; }
			if (!tmpcombatant.isOwner) { return; }
			var tmpresult = await game.combat.spendSeconds(tmpcombatant, tmpcard.seconds, { hand: "main", label: tmpcard.name });
			if (tmpresult && tmpmessage.isOwner) { await tmpmessage.setFlag("imagine-rpg", "cast.spent", true); }
		} finally {
			spendingCasts.delete(tmpmessage.id);
		}
	}

// @MARKER A MISHAP'S LASTING EFFECTS
	// This is the function behind a mishap card's Apply button: one of the lasting effects his
	// getMagicalMishap puts on the caster (casting-rules.mjs, getMishapEffects), once. AUR and WIL go
	// onto the attribute's PERMANENT modifier (permMod) -- his sheet rewrote the rating itself and noted
	// it among the character's powers ("Magical Mishap:-2 AUR", which the card lists); the modifier keeps
	// the rolled rating and the change apart, where a Game Master can see and undo it. Burnout suppresses
	// the caster's magic until the tick on the tab is taken off.
	//
	// ONCE, WHOEVER PRESSES IT, HOWEVER FAST -- as the bolt's Apply and the poison card's are guarded:
	//     only the card's author or the Game Master may apply it, since only they can mark it applied;
	//     anyone else would change the caster and leave the button live for the next press
	//     one press at a time (applyingMishaps), so a double-click is one press
	//     the mark is read again after the waits and written BEFORE the caster is changed: were a write
	//     to fail part-way the button is spent and the Game Master puts it right by hand, where the
	//     other way round a second press would take the AUR twice
	const applyingMishaps = new Set();
	export async function applyMishapEffect(tmpmessage, tmpindex) {
		var tmpcard = tmpmessage.getFlag("imagine-rpg", "cast");
		var tmpeffect = tmpcard?.mishapEffects?.[tmpindex];
		if (!tmpeffect) { return; }
		if (tmpeffect.applied) { ui.notifications.warn("That has already been applied."); return; }
		if (!tmpmessage.isOwner) {
			ui.notifications.warn("Only the Game Master or whoever cast the spell can apply a mishap, so none is applied twice. Ask the Game Master.");
			return;
		}
		var tmpkey = `${tmpmessage.id ?? tmpmessage.uuid ?? ""}:${tmpindex}`;
		if (applyingMishaps.has(tmpkey)) { return; }
		applyingMishaps.add(tmpkey);
		try {
			var tmpactor = await fromUuid(tmpcard.casterUuid);
			if (!tmpactor) { ui.notifications.warn("The caster is no longer there."); return; }
			if (!tmpactor.isOwner) {
				ui.notifications.warn(`You do not have permission to change ${tmpactor.name}. Ask the Game Master to apply it.`);
				return;
			}
			// Read the mark again -- the card may have changed while the caster was fetched -- and set it.
			var tmpnow = foundry.utils.deepClone(tmpmessage.getFlag("imagine-rpg", "cast"));
			tmpeffect = tmpnow?.mishapEffects?.[tmpindex];
			if (!tmpeffect) { return; }
			if (tmpeffect.applied) { ui.notifications.warn("That has already been applied."); return; }
			tmpnow.mishapEffects[tmpindex].applied = true;
			await tmpmessage.setFlag("imagine-rpg", "cast.mishapEffects", tmpnow.mishapEffects);

			var tmpdone = "";
			if (tmpeffect.kind == "aur" || tmpeffect.kind == "wil") {
				var tmpattr = tmpactor.system.attributes?.[tmpeffect.kind];
				var tmpperm = (parseInt(tmpattr?.permMod) || 0) + (parseInt(tmpeffect.value) || 0);
				await tmpactor.update({ [`system.attributes.${tmpeffect.kind}.permMod`]: tmpperm });
				tmpdone = `${tmpeffect.kind.toUpperCase()} ${tmpeffect.value > 0 ? "+" : ""}${tmpeffect.value} permanently (its permanent modifier is now ${tmpperm}).`;
			} else if (tmpeffect.kind == "suppress") {
				await tmpactor.update({ "system.magic.magicSuppressed": true });
				tmpdone = "magic burned out: magically suppressed until the tick is taken off.";
			}
			await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
				flavor: "Magical mishap applied",
				content: `<div class="imagine-magic-card"><p><strong>${esc(tmpactor.name)}</strong>: ${esc(tmpdone)}</p></div>` });
		} finally {
			applyingMishaps.delete(tmpkey);
		}
	}

	// This is the function which wires a cast card's buttons whenever one is shown.
	export function registerCastCardListeners() {
		Hooks.on("renderChatMessageHTML", function (tmpmessage, tmphtml) {
			var tmpcard = tmpmessage.getFlag("imagine-rpg", "cast");
			if (!tmpcard) { return; }
			for (const tmpbutton of tmphtml.querySelectorAll("[data-imagine-action='applySpellAttack']")) {
				var tmpattack = tmpcard.attacks?.[parseInt(tmpbutton.dataset.index)];
				if (tmpattack?.applied?.length) {
					var tmpnames = (tmpcard.targets ?? []).filter(tmpt => tmpattack.applied.includes(tmpt.uuid)).map(tmpt => tmpt.name);
					tmpbutton.title = `Applied to ${tmpnames.join(", ") || tmpattack.applied.length + " target(s)"}`;
					tmpbutton.classList.add("applied");
				}
				tmpbutton.addEventListener("click", () => applySpellAttack(tmpmessage, parseInt(tmpbutton.dataset.index)));
			}
			for (const tmpbutton of tmphtml.querySelectorAll("[data-imagine-action='applySpellTarget']")) {
				tmpbutton.addEventListener("click", () => applySpellToTarget(tmpmessage, parseInt(tmpbutton.dataset.index)));
			}
			// A mishap's lasting effects: a button once applied is spent.
			for (const tmpbutton of tmphtml.querySelectorAll("[data-imagine-action='applyMishapEffect']")) {
				var tmpeffect = tmpcard.mishapEffects?.[parseInt(tmpbutton.dataset.index)];
				if (tmpeffect?.applied) {
					tmpbutton.disabled = true;
					tmpbutton.classList.add("applied");
					tmpbutton.innerHTML = `<i class="fa-solid fa-check"></i> Applied`;
					continue;
				}
				tmpbutton.addEventListener("click", () => applyMishapEffect(tmpmessage, parseInt(tmpbutton.dataset.index)));
			}
			var tmpspend = tmphtml.querySelector("[data-imagine-action='spendCastTime']");
			if (tmpspend && tmpcard.spent) {
				tmpspend.disabled = true;
				tmpspend.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${tmpcard.seconds}s spent`;
			}
			tmpspend?.addEventListener("click", () => spendCastTime(tmpmessage));
		});
	}

// @MARKER ADD NEW casting actions HERE
// @END (CODE)
