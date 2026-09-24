// @START (CODE)
// @MARKER MAGIC ACTIONS
//==================================================================================================================
// What the Magic & Lore tab's buttons do. The rules are in module/lore-rules.mjs and are pure; this
// is the Foundry side of them -- the dice, the dialogs, the item updates and the chat cards. The
// sheet (module/sheets/actor-character-sheet.mjs) only routes a click here.
//
// His buttons, and what each became:
//     USE on a consumable        useConsumable       a dose spent; the last one removes the row
//     USE on a poison            usePoison           on the targets, on self, on a weapon (a
//                                                    coating) or on no one; each victim rolls
//                                                    their own Poison Resistance, and its damage
//                                                    goes on from the card (applyPoisonDamage)
//     USE / MOD on a lore row    useLore             the use skill against chance + modifier
//     USE / MOD on a recipe      brewRecipe          the lore against its chance; a batch of doses
//     the memorized tick         toggleMemorized
//     add poison (type/potency)  addPoison           his poisons are built, not picked
//     (nothing of his)           postMagic           a spell, invocation or evoke read out to chat
//
// His MOD buttons asked for a situational modifier before rolling. Here that is Shift held on the
// click -- the same button, so the tab keeps one control per row rather than two.
//
// WHAT A USE DOES NOT DO YET. His use handlers end in a do<Kind>Action switch that writes the
// effect with the practitioner title worked in and sometimes changes the character. Those are not
// ported (see the header of lore-rules.mjs); a use here reports the roll, the practitioner title
// and the entry's own description, and the effect is the Game Master's to apply.
//==================================================================================================================

import { MAGIC_KINDS, getItemKind, getSkillStanding, resolveLoreUse, resolveBrew, isLoreSuccess,
         useConsumableDose, makePoisonSystem, POISON_FORMS, resolvePoisonOnVictim,
         describePoisonOnVictim, getPoisonIntervalsDue, getPoisonDamageToApply, applyOverallDamage,
         coatWeapon, isEnvenomed, ENVENOMED_THRESHOLD } from "./lore-rules.mjs";
import { resolveResistanceRoll, describeResistanceRoll } from "./resistance-rules.mjs";
import { POISON_TYPES, POISON_POTENCIES } from "./lore-tables.mjs";

	// The words each outcome is reported in, as his chat lines put them.
	const OUTCOME_WORDS = {
		success:      "succeeded",
		grandmaster:  "succeeded outright -- a Grandmaster",
		failure:      "failed",
		fumble:       "rolled a 100, which always fails",
		notMemorized: "has not memorized it. Nothing done",
		noBatch:      "has set no batch doses to be made. Nothing done"
	};

	// This is the function which escapes text for a chat card.
	function escapeText(tmpvalue) {
		return ("" + (tmpvalue ?? "")).replace(/[&<>"]/g, (tmpchar) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[tmpchar]);
	}

	// This is the function which asks for his MOD buttons' situational modifier, when Shift is held.
	// Returns 0 without asking otherwise, and null if the dialog is closed (nothing is rolled).
	async function askModifier(tmpevent, tmptitle) {
		if (!tmpevent?.shiftKey) { return 0; }
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: tmptitle },
			content: `<p>Situational modifier:</p><input type="number" name="modifier" value="0" autofocus>`,
			ok: { label: "Roll", callback: (tmpe, tmpbutton) => tmpbutton.form.elements.modifier.value }
		}).catch(() => null);
		if (tmpanswer === null) { return null; }
		return parseInt(tmpanswer) || 0;
	}

	// This is the function which reads the character's standing in a skill, for a roll.
	function standingFor(tmpactor, tmpname) {
		return getSkillStanding(tmpactor.items.filter(tmpitem => tmpitem.type == "skill"), tmpname,
			tmpactor.system?.identity?.title);
	}

	// This is the function which adds doses to a consumable the character carries, or makes a new
	// stack. Used by a brew, and by adding a poison. Returns the new total.
	async function addToStack(tmpactor, tmpdata, tmpdoses) {
		var tmpstack = tmpactor.items.find(tmpitem => tmpitem.type == "consumable"
			&& tmpitem.system.kind == tmpdata.system.kind && tmpitem.name == tmpdata.name
			&& (tmpitem.system.form ?? "") == (tmpdata.system.form ?? ""));
		if (tmpstack) {
			var tmptotal = (parseInt(tmpstack.system.doses) || 0) + tmpdoses;
			await tmpstack.update({ "system.doses": tmptotal });
			return tmptotal;
		}
		tmpdata.system.doses = tmpdoses;
		await tmpactor.createEmbeddedDocuments("Item", [tmpdata]);
		return tmpdoses;
	}


	// @MARKER CONSUMABLES
	// This is the function which takes one dose of a consumable -- useHerb, usePotion, useElixir,
	// usePoison and useCharm (sheet-worker.js:128949 and on). The last dose removes the row, as his
	// removeRepeatingRow does; nothing left means nothing done.
	export async function useConsumable(tmpactor, tmpitem) {
		var tmpkind = tmpitem.system.kind;
		if (tmpkind == "poison") { return await usePoison(tmpactor, tmpitem); }
		var tmpresult = useConsumableDose(tmpkind, tmpitem.system.doses);
		var tmplabel = (MAGIC_KINDS[tmpkind]?.label ?? tmpkind).toLowerCase();
		if (!tmpresult.used) {
			ui.notifications.warn(`${tmpactor.name} has no doses left of the ${tmplabel} ${tmpitem.name}. Nothing done.`);
			return;
		}
		var tmpremaining = tmpkind == "charm" ? "" : ` Remaining doses: ${tmpresult.remaining}.`;
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `Uses the ${tmplabel} <strong>${escapeText(tmpitem.name)}</strong>`,
			content: `<div class="imagine-magic-card"><p>${escapeText(tmpitem.system.description)}</p>`
			       + (tmpitem.system.duration ? `<p class="muted">Duration: ${escapeText(tmpitem.system.duration)}</p>` : "")
			       + `<p class="muted">${tmpremaining.trim()}</p></div>`
		});
		if (tmpresult.remove) {
			await tmpitem.delete();
		} else if (tmpkind != "charm") {
			await tmpitem.update({ "system.doses": tmpresult.remaining });
		}
	}

	// @MARKER POISON AGAINST A VICTIM
	// This is the function which uses a dose of poison ON someone -- his usePoison and doPoisonAction
	// (sheet-worker.js:135316, 135358). His row has an "on self" tick that rolls the user's own Poison
	// Resistance; everyone else was the table's to roll. Here the victim can be the tokens the user has
	// targeted as well, each rolling their own Poison Resistance (with its immunity), or no one at all
	// -- a dose spent to bait a trap or hand over -- or a weapon the user carries, coated with it
	// (lore-rules.mjs, POISON ON A WEAPON; the hit that delivers it is applyAttackDamage's).
	//
	// His row's Poison Resistance modifier becomes the modifier asked for here. What follows from the
	// roll is resolvePoisonOnVictim (lore-rules.mjs): the success or failure clause, the onset and
	// duration rolled, and any Endurance damage over the duration rolled interval by interval, to be
	// applied from the card as it lands (applyPoisonDamage below).
	export async function usePoison(tmpactor, tmpitem) {
		var tmpresult = useConsumableDose("poison", tmpitem.system.doses);
		if (!tmpresult.used) {
			ui.notifications.warn(`${tmpactor.name} has no doses left of ${tmpitem.name}. Nothing done.`);
			return;
		}
		var tmppoison = readPoison(tmpitem);

		var tmptargets = Array.from(game.user.targets ?? []).map(tmptoken => tmptoken.actor).filter(tmpa => tmpa);
		var tmptargetnames = tmptargets.map(tmpa => escapeText(tmpa.name)).join(", ");
		var tmpweapons = tmpactor.items.filter(tmpi => tmpi.type == "weapon");
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: `Use ${tmpitem.name}` },
			content: `<div class="form-group"><label>Who takes it</label><select name="who">
					${tmptargets.length ? `<option value="targets">Targeted: ${tmptargetnames}</option>` : ""}
					<option value="self">${escapeText(tmpactor.name)} (on self)</option>
					${tmpweapons.map(tmpw => `<option value="coat:${tmpw.id}">Coat a weapon: ${escapeText(tmpw.name)}</option>`).join("")}
					<option value="none">No one &mdash; just take a dose (a trap, a gift)</option>
				</select></div>
				<div class="form-group"><label>Poison Resistance modifier</label>
				<input type="number" name="modifier" value="0"></div>
				${tmptargets.length ? "" : `<p class="hint">Target a token first to use it on someone else.</p>`}`,
			rejectClose: false,
			ok: { label: "Use", callback: (tmpe, tmpbutton) => ({ who: tmpbutton.form.elements.who.value,
				modifier: parseInt(tmpbutton.form.elements.modifier.value) || 0 }) }
		});
		if (!tmpanswer) { return; }

		// A weapon coated: refused (and no dose spent) when the rules say it cannot take it.
		if (tmpanswer.who.startsWith("coat:")) {
			var tmpweapon = tmpactor.items.get(tmpanswer.who.slice(5));
			if (!tmpweapon) { return; }
			var tmpcoat = coatWeapon({ name: tmpitem.name, ...tmppoison, form: tmpitem.system.form }, tmpweapon.system);
			if (!tmpcoat.ok) { ui.notifications.warn(`${tmpweapon.name}: ${tmpcoat.reason}`); return; }
			await tmpweapon.update({ "system.coating": tmpcoat.coating });
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
				flavor: `Coats <strong>${escapeText(tmpweapon.name)}</strong> with poison <strong>${escapeText(tmpitem.name)}</strong>`
					+ (tmpitem.system.form ? ` (${escapeText(tmpitem.system.form)})` : ""),
				content: `<div class="imagine-magic-card"><p>${isEnvenomed(tmpweapon.system)
						? `Its Envenomed hilt now holds ${tmpcoat.coating.doses} dose(s); a thrust that does ${ENVENOMED_THRESHOLD} or more actual damage delivers one.`
						: "The next hit that does actual damage delivers it, and the coating is spent."}</p>`
					+ `<p class="muted">Remaining doses: ${tmpresult.remaining}.</p></div>`
			});
			if (tmpresult.remove) { await tmpitem.delete(); } else { await tmpitem.update({ "system.doses": tmpresult.remaining }); }
			return;
		}

		var tmpvictims = tmpanswer.who == "targets" ? tmptargets : (tmpanswer.who == "self" ? [tmpactor] : []);
		await postPoisonOnVictims({
			speaker: tmpactor,
			flavor: `Uses poison <strong>${escapeText(tmpitem.name)}</strong>${tmpitem.system.form ? ` (${escapeText(tmpitem.system.form)})` : ""}`,
			poison: tmppoison, victims: tmpvictims, modifier: tmpanswer.modifier,
			empty: `A dose taken, on no one yet. ${escapeText(tmpitem.system.description)}`,
			footer: `Remaining doses: ${tmpresult.remaining}.`
		});
		if (tmpresult.remove) { await tmpitem.delete(); } else { await tmpitem.update({ "system.doses": tmpresult.remaining }); }
	}

	// This is the function which reads a poison's type and potency off an item. A poison made by
	// hand may carry only its name, "Type: IV, Potency: C".
	export function readPoison(tmpitem) {
		var tmpnamed = ("" + (tmpitem?.name ?? "")).match(/Type:\s*([IVX]+),\s*Potency:\s*([A-Q])/i) ?? [];
		return { poisonType: tmpitem?.system?.poisonType || tmpnamed[1] || "", poisonPotency: tmpitem?.system?.poisonPotency || tmpnamed[2] || "" };
	}

	// This is the function which rolls each victim's Poison Resistance, works out what the poison does
	// to them, and posts the card -- for a poison used from the tab and for one a weapon delivers.
	// A victim whose poison deals Endurance damage gets an Apply button on the card (applyPoisonDamage).
	//
	//   tmpinput = { speaker, flavor, poison: { poisonType, poisonPotency }, victims, modifier, empty, footer, lead }
	export async function postPoisonOnVictims(tmpinput) {
		var tmpdie = (tmpsides) => Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1;
		var tmpsections = tmpinput.lead ? [tmpinput.lead] : [];
		var tmprolls = [];
		var tmpflagged = [];
		for (const tmpvictim of tmpinput.victims ?? []) {
			var tmpresist = tmpvictim.system?.resistances?.poison;
			if (!tmpresist) {
				tmpsections.push(`<p><strong>${escapeText(tmpvictim.name)}</strong>: has no Poison Resistance to roll; the Game Master decides.</p>`);
				continue;
			}
			var tmproll = await new Roll("1d100").evaluate();
			tmprolls.push(tmproll);
			var tmpresistance = resolveResistanceRoll(tmpresist.value, tmproll.total, tmpresist.immune, tmpinput.modifier ?? 0);
			var tmpeffect = resolvePoisonOnVictim({ type: tmpinput.poison.poisonType, potency: tmpinput.poison.poisonPotency,
				resistance: tmpresistance }, tmpdie);
			var tmpbutton = "";
			if (tmpeffect.damage) {
				tmpbutton = `<p><button type="button" data-imagine-action="applyPoison" data-index="${tmpflagged.length}">`
					+ `<i class="fa-solid fa-skull-crossbones"></i> Apply to overall Endurance</button></p>`;
				tmpflagged.push({ uuid: tmpvictim.uuid, name: tmpvictim.name, damage: tmpeffect.damage,
					onsetSeconds: tmpeffect.onset?.seconds ?? 0, applied: 0 });
			}
			tmpsections.push(`<p><strong>${escapeText(tmpvictim.name)}</strong> &mdash; ${describeResistanceRoll("Poison", tmpresistance)}</p>`
				+ describePoisonOnVictim(tmpeffect).map(tmpline => `<p>${escapeText(tmpline)}</p>`).join("") + tmpbutton);
		}
		if (!(tmpinput.victims ?? []).length && tmpinput.empty) {
			tmpsections.push(`<p class="muted">${tmpinput.empty}</p>`);
		}
		return await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpinput.speaker }),
			flavor: tmpinput.flavor,
			content: `<div class="imagine-magic-card">${tmpsections.join("")}`
			       + (tmpinput.footer ? `<p class="muted">${tmpinput.footer}</p>` : "") + `</div>`,
			rolls: tmprolls,
			// usedAt is the world time the poison was taken, which the Apply button reads the
			// intervals landed from; applied, per victim, is how many have been put on.
			flags: tmpflagged.length ? { "imagine-rpg": { poison: { usedAt: game.time?.worldTime ?? 0, victims: tmpflagged } } } : {}
		});
	}

	// @MARKER POISON DAMAGE
	// This is the function behind a poison card's Apply button: the Endurance damage of the intervals
	// that have landed goes onto the victim's OVERALL Endurance -- body.overallWounds, counted in total
	// wounds and so toward shock -- by the user's ruling (lore-rules.mjs, POISON DAMAGE LANDING). The
	// dialog offers what the world clock says has landed since the poison was taken, or all that is
	// left when the clock has not moved past the first; the Game Master may put on any number.
	//
	// Guarded as the attack card's Apply Damage is: a victim's intervals are counted on the message,
	// so none is put on twice, and only someone who may change the victim may apply it.
	export async function applyPoisonDamage(tmpmessage, tmpindex) {
		var tmppoison = tmpmessage.getFlag("imagine-rpg", "poison");
		var tmpentry = tmppoison?.victims?.[tmpindex];
		if (!tmpentry) { return; }
		var tmpleft = getPoisonDamageToApply(tmpentry.damage, tmpentry.applied, 0);
		if (tmpleft.done) {
			ui.notifications.warn(`All of that poison's damage has already been applied to ${tmpentry.name}.`);
			return;
		}
		// The intervals applied are counted on the card, and only its author or the Game Master can
		// write that count. Anyone else could put the damage on and leave it uncounted, to be put on
		// again (bug sweep 2026-09-23) -- so they are asked to leave it to the Game Master.
		if (!tmpmessage.isOwner) {
			ui.notifications.warn("Only the Game Master or whoever used the poison can apply its damage, so none is applied twice. Ask the Game Master.");
			return;
		}
		var tmpvictim = await fromUuid(tmpentry.uuid);
		if (!tmpvictim) { ui.notifications.warn(`${tmpentry.name} is no longer there.`); return; }
		if (!tmpvictim.isOwner) {
			ui.notifications.warn(`You do not have permission to change ${tmpvictim.name}. Ask the Game Master to apply it.`);
			return;
		}
		var tmpdue = getPoisonIntervalsDue(tmpentry.damage, tmpentry.onsetSeconds, (game.time?.worldTime ?? 0) - (tmppoison.usedAt ?? 0));
		var tmpoffer = tmpdue > tmpentry.applied ? tmpdue - tmpentry.applied : tmpleft.remaining;
		var tmpcount = await foundry.applications.api.DialogV2.prompt({
			window: { title: `Poison damage to ${tmpvictim.name}` },
			content: `<p>${tmpentry.damage.dice} every ${tmpentry.damage.everySeconds} seconds, ${tmpentry.damage.times} time(s) in all;
					${tmpentry.applied} applied, ${tmpleft.remaining} to come. By the world clock ${tmpdue} have landed.</p>
				<div class="form-group"><label>Intervals to apply now</label>
				<input type="number" name="count" value="${tmpoffer}" min="1" max="${tmpleft.remaining}"></div>`,
			rejectClose: false,
			ok: { label: "Apply", callback: (tmpe, tmpb) => parseInt(tmpb.form.elements.count.value) || 0 }
		});
		if (!tmpcount || tmpcount < 1) { return; }

		// Read the flag again: someone else may have applied some while the dialog was open.
		tmppoison = tmpmessage.getFlag("imagine-rpg", "poison");
		tmpentry = tmppoison.victims[tmpindex];
		var tmpnow = getPoisonDamageToApply(tmpentry.damage, tmpentry.applied, tmpcount);
		if (tmpnow.amount <= 0 && tmpnow.applied == tmpentry.applied) { return; }
		var tmpsys = tmpvictim.system;
		var tmpafter = applyOverallDamage({ damage: tmpnow.amount, overallWounds: tmpsys.body?.overallWounds,
			totalWounds: tmpsys.body?.totalWounds, shock: tmpsys.body?.shock, endurance: tmpsys.characteristics?.endurance?.value });
		await tmpvictim.update({ "system.body.overallWounds": tmpafter.overallWounds });

		var tmpnotes = [];
		if (tmpafter.inShock) { tmpnotes.push(`<strong>${escapeText(tmpvictim.name)} is in shock.</strong>`); }
		if (tmpafter.pastEndurance) { tmpnotes.push(`<strong>Total wounds are past ${escapeText(tmpvictim.name)}'s whole Endurance.</strong>`); }
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpvictim }),
			content: `<div class="imagine-chat damage-result"><p><strong>${escapeText(tmpvictim.name)}</strong> takes
				${tmpnow.amount} poison damage to overall Endurance (${tmpnow.applied - tmpentry.applied} interval(s); ${tmpnow.remaining} to come).
				Total wounds: ${tmpafter.totalWounds}${tmpsys.body?.shock ? ` / shock ${tmpsys.body.shock}` : ""}.</p>
				${tmpnotes.map(tmpn => `<p>${tmpn}</p>`).join("")}</div>`
		});
		// Only the message's author or the Game Master may mark it, as with an attack's damage. If
		// someone else applied it the count cannot be written, so the Game Master should apply it.
		if (tmpmessage.isOwner) {
			var tmpvictims = foundry.utils.deepClone(tmppoison.victims);
			tmpvictims[tmpindex].applied = tmpnow.applied;
			await tmpmessage.setFlag("imagine-rpg", "poison.victims", tmpvictims);
		}
	}

	// This is the function which wires a poison card's Apply buttons whenever one is shown, and
	// retires a button once all of its victim's damage is on.
	export function registerPoisonCardListeners() {
		Hooks.on("renderChatMessageHTML", function (tmpmessage, tmphtml) {
			var tmppoison = tmpmessage.getFlag("imagine-rpg", "poison");
			if (!tmppoison) { return; }
			for (const tmpbutton of tmphtml.querySelectorAll("[data-imagine-action='applyPoison']")) {
				var tmpentry = tmppoison.victims?.[parseInt(tmpbutton.dataset.index)];
				if (tmpentry && getPoisonDamageToApply(tmpentry.damage, tmpentry.applied, 0).done) {
					tmpbutton.disabled = true;
					tmpbutton.textContent = "Applied";
					continue;
				}
				tmpbutton.addEventListener("click", () => applyPoisonDamage(tmpmessage, parseInt(tmpbutton.dataset.index)));
			}
		});
	}

	// This is the function which adds one dose to a consumable already carried -- bought, found or
	// gathered. His sheet has no button for it (the doses field was typed into); this is that field.
	export async function addDose(tmpactor, tmpitem) {
		await tmpitem.update({ "system.doses": (parseInt(tmpitem.system.doses) || 0) + 1 });
	}


	// @MARKER MEMORIZED
	// This is the function which ticks or unticks an entry as memorized. His tick is free and it is
	// his recalculation that complains -- "has too many things memorized. Forget a few things" -- so
	// this does not refuse either; the tab's memorization line turns red instead.
	export async function toggleMemorized(tmpactor, tmpitem) {
		await tmpitem.update({ "system.memorized": !tmpitem.system.memorized });
	}


	// @MARKER USING A LORE
	// This is the function which uses a known entry -- handleUseBallad and its twelve siblings
	// (sheet-worker.js:136961): the use skill (Intone for a hymn, Recite for a poem, Sing for a song,
	// the lore itself otherwise), plus a situational modifier if Shift was held, plus the entry's own
	// modifier. It must be memorized; an evoke is the exception, having no memorization of its own.
	export async function useLore(tmpactor, tmpitem, tmpevent) {
		var tmpkind = getItemKind(tmpitem);
		var tmpdef = MAGIC_KINDS[tmpkind] ?? {};
		var tmpskill = tmpdef.use || tmpdef.learn;
		var tmpsituational = await askModifier(tmpevent, `Use ${tmpitem.name}`);
		if (tmpsituational === null) { return; }

		var tmpstanding = standingFor(tmpactor, tmpskill);
		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveLoreUse({ chance: tmpstanding.chance, situational: tmpsituational,
			entryModifier: tmpitem.system.modifier, memorized: tmpitem.system.memorized,
			needsMemorized: tmpkind != "evoke" }, tmproll.total);

		var tmpsuccess = isLoreSuccess(tmpresult.outcome);
		var tmplines = [];
		if (tmpresult.outcome == "notMemorized") {
			tmplines.push(`${escapeText(tmpactor.name)} ${OUTCOME_WORDS.notMemorized}.`);
		} else {
			tmplines.push(`${escapeText(tmpskill)} ${tmpresult.total}%${tmpstanding.held ? "" : " (not held)"}`
				+ `${tmpsituational ? ` (situational ${tmpsituational > 0 ? "+" : ""}${tmpsituational})` : ""}`
				+ `${tmpitem.system.modifier ? `, entry ${tmpitem.system.modifier > 0 ? "+" : ""}${tmpitem.system.modifier}` : ""}: `
				+ `rolled ${tmpresult.roll} &mdash; ${OUTCOME_WORDS[tmpresult.outcome] ?? tmpresult.outcome}.`);
		}
		if (tmpsuccess) {
			tmplines.push(`<p>${escapeText(tmpitem.system.description)}</p>`);
			tmplines.push(`<p class="muted">Practitioner title ${tmpstanding.practitionerTitle}`
				+ (tmpitem.system.duration ? ` &middot; lasts ${escapeText(tmpitem.system.duration)}` : "")
				+ `. His effect for this entry is not worked out by the system yet; apply it from the description.</p>`);
		}
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `${escapeText(tmpdef.label ?? tmpkind)}: ${escapeText(tmpitem.name)} &mdash; `
			      + `<strong>${tmpresult.outcome == "notMemorized" ? "not memorized" : (tmpsuccess ? "success" : "failure")}</strong>`,
			content: `<div class="imagine-magic-card">${tmplines.join("")}</div>`,
			rolls: tmpresult.outcome == "notMemorized" ? [] : [tmproll]
		});
	}


	// @MARKER BREWING
	// This is the function which brews a batch from a known recipe -- handleUsePotionRecipe and
	// handleUsePoisonRecipe (sheet-worker.js:142851, 142626). The batch size is asked for, starting
	// from the recipe's own (his *_doses column on the recipe row). A success adds the batch to the
	// character's consumables; a recipe need not be memorized to be brewed, as his handlers never
	// read the tick.
	export async function brewRecipe(tmpactor, tmpitem, tmpevent) {
		var tmpkind = getItemKind(tmpitem);
		var tmpskill = MAGIC_KINDS[tmpkind]?.use || "Potion Lore";

		// A poison recipe must name one of his poisons -- read as usePoison reads it, from its fields or
		// else its name ("Type: IV, Potency: C"). One that names none once rolled, said "success" and
		// made nothing, with no word why (bug sweep 2026-09-23); now it is said before anything is rolled.
		var tmpbrewpoison = null;
		if (tmpkind == "poisonrecipe") {
			var tmpread = readPoison(tmpitem);
			tmpbrewpoison = makePoisonSystem(("" + tmpread.poisonType).toUpperCase(), ("" + tmpread.poisonPotency).toUpperCase(),
				tmpitem.system.form, false);
			if (!tmpbrewpoison) {
				ui.notifications.warn(`${tmpitem.name} names no poison: give it a type (I to XXV) and a potency (A to Q) first.`);
				return;
			}
		}

		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: `Brew ${tmpitem.name}` },
			content: `<div class="form-group"><label>Doses in this batch</label>
				<input type="number" name="doses" min="0" value="${parseInt(tmpitem.system.batchDoses) || 1}" autofocus></div>
				<div class="form-group"><label>Situational modifier</label>
				<input type="number" name="modifier" value="0"></div>`,
			rejectClose: false,
			ok: { label: "Brew", callback: (tmpe, tmpbutton) => ({
				doses: parseInt(tmpbutton.form.elements.doses.value) || 0,
				modifier: parseInt(tmpbutton.form.elements.modifier.value) || 0 }) }
		});
		if (!tmpanswer) { return; }
		if (tmpanswer.doses != tmpitem.system.batchDoses) { await tmpitem.update({ "system.batchDoses": tmpanswer.doses }); }

		var tmpstanding = standingFor(tmpactor, tmpskill);
		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveBrew({ chance: tmpstanding.chance, situational: tmpanswer.modifier,
			batchDoses: tmpanswer.doses }, tmproll.total);

		var tmpmade = "";
		if (isLoreSuccess(tmpresult.outcome)) {
			var tmpstock = null;
			if (tmpkind == "poisonrecipe") {
				tmpstock = { name: tmpbrewpoison.name, type: "consumable", system: tmpbrewpoison.system };
			} else {
				// The potion itself, from the compendium, so the stock carries everything his row has.
				var tmppack = game.packs.get("world.imagine-consumables");
				var tmpindex = tmppack ? await tmppack.getIndex({ fields: ["system.kind"] }) : [];
				var tmpentry = [...tmpindex].find(tmpe => tmpe.name == tmpitem.name && tmpe.system?.kind == "potion");
				var tmpdoc = tmpentry ? await tmppack.getDocument(tmpentry._id) : null;
				tmpstock = tmpdoc ? tmpdoc.toObject() : { name: tmpitem.name, type: "consumable",
					system: { kind: "potion", subsystem: "herbalism", value: tmpitem.system.value,
					          duration: tmpitem.system.duration, description: tmpitem.system.description } };
				delete tmpstock._id;
			}
			if (tmpstock) {
				var tmptotal = await addToStack(tmpactor, tmpstock, tmpanswer.doses);
				tmpmade = ` Made ${tmpanswer.doses} dose(s)${tmpkind == "poisonrecipe" ? ` in ${escapeText(tmpitem.system.form)} form` : ""}; `
				        + `${tmptotal} carried now.`;
			}
		}
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `Brews ${escapeText(tmpitem.name)} &mdash; <strong>${isLoreSuccess(tmpresult.outcome) ? "success" : "failure"}</strong>`,
			content: `<div class="imagine-magic-card">${escapeText(tmpskill)} ${tmpresult.total}%${tmpstanding.held ? "" : " (not held)"}`
			       + (tmpresult.roll === null ? `: ${OUTCOME_WORDS[tmpresult.outcome]}.` : `: rolled ${tmpresult.roll} &mdash; ${OUTCOME_WORDS[tmpresult.outcome] ?? tmpresult.outcome}.`)
			       + tmpmade + `</div>`,
			rolls: tmpresult.roll === null ? [] : [tmproll]
		});
	}


	// @MARKER POISONS
	// This is the function which adds a poison -- as doses carried, or as a recipe known. His sheet's
	// poison panel is three dropdowns (select_poison, select_poison_potency, select_poison_form) and
	// this is the same three, plus the doses and whether it is the recipe.
	export async function addPoison(tmpactor, tmpasrecipe) {
		var tmptypes = Object.keys(POISON_TYPES).map(tmpt => `<option value="${tmpt}">Type ${tmpt}</option>`).join("");
		var tmppotencies = Object.keys(POISON_POTENCIES).map(tmpp =>
			`<option value="${tmpp}">${tmpp} &mdash; starts in ${POISON_POTENCIES[tmpp]}</option>`).join("");
		var tmpforms = POISON_FORMS.map(tmpf => `<option value="${tmpf}">${tmpf}</option>`).join("");
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: tmpasrecipe ? "Add a poison recipe" : "Add a poison" },
			content: `<p class="hint">His poisons are built from a type (I is the mildest, XXV death either way)
				and a potency (A is slowest to start, Q instant).</p>
				<div class="form-group"><label>Type</label><select name="type">${tmptypes}</select></div>
				<div class="form-group"><label>Potency</label><select name="potency">${tmppotencies}</select></div>
				<div class="form-group"><label>Form</label><select name="form">${tmpforms}</select></div>
				${tmpasrecipe ? "" : `<div class="form-group"><label>Doses</label><input type="number" name="doses" min="1" value="1"></div>`}`,
			rejectClose: false,
			ok: { label: "Add", callback: (tmpe, tmpbutton) => ({
				type: tmpbutton.form.elements.type.value, potency: tmpbutton.form.elements.potency.value,
				form: tmpbutton.form.elements.form.value,
				doses: parseInt(tmpbutton.form.elements.doses?.value) || 1 }) }
		});
		if (!tmpanswer) { return; }

		var tmppoison = makePoisonSystem(tmpanswer.type, tmpanswer.potency, tmpanswer.form, !!tmpasrecipe);
		if (!tmppoison) { return; }
		if (tmpasrecipe) {
			var tmpknown = tmpactor.items.find(tmpitem => getItemKind(tmpitem) == "poisonrecipe" && tmpitem.name == tmppoison.name);
			if (tmpknown) { ui.notifications.info(`${tmpactor.name} already knows the recipe for ${tmppoison.name}.`); return; }
			await tmpactor.createEmbeddedDocuments("Item", [{ name: tmppoison.name, type: "lore", system: tmppoison.system }]);
			return;
		}
		await addToStack(tmpactor, { name: tmppoison.name, type: "consumable", system: tmppoison.system }, tmpanswer.doses);
	}


	// @MARKER READING OUT
	// This is the function which posts a spell, invocation or evoke to chat as the book gives it.
	// Casting and invoking are the deferred magic phase's (CLAUDE.md, Layer 4); until then this is how
	// a table reads what one does without opening its sheet.
	export async function postMagic(tmpactor, tmpitem) {
		var tmpkind = getItemKind(tmpitem);
		var tmpsystem = tmpitem.system;
		var tmpfacts = [];
		var tmpadd = (tmplabel, tmpvalue) => { if (tmpvalue !== "" && tmpvalue !== undefined && tmpvalue !== null) {
			tmpfacts.push(`<strong>${tmplabel}</strong> ${escapeText(tmpvalue)}`); } };
		if (tmpkind == "spell") {
			tmpadd("Level", tmpsystem.level); tmpadd("Aspects", tmpsystem.spellTypes); tmpadd("Cast", tmpsystem.castTime);
			tmpadd("Range", tmpsystem.range); tmpadd("Area", tmpsystem.area); tmpadd("Duration", tmpsystem.duration);
			tmpadd("Save", tmpsystem.save);
		} else if (tmpkind == "invocation") {
			tmpadd("Level", tmpsystem.level); tmpadd("Alignment", tmpsystem.alignment); tmpadd("Invoke", tmpsystem.invokeTime);
			tmpadd("Range", tmpsystem.range); tmpadd("Area", tmpsystem.area); tmpadd("Duration", tmpsystem.duration);
			tmpadd("Save", tmpsystem.save);
		}
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `${escapeText(MAGIC_KINDS[tmpkind]?.label ?? tmpkind)}: <strong>${escapeText(tmpitem.name)}</strong>`,
			content: `<div class="imagine-magic-card">${tmpfacts.length ? `<p>${tmpfacts.join(" &middot; ")}</p>` : ""}`
			       + `<p>${escapeText(tmpsystem.description)}</p></div>`
		});
	}

// @MARKER ADD NEW magic actions HERE
// @END (CODE)
