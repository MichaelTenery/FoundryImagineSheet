// @START (CODE)
// @MARKER MAGIC VIEW
//==================================================================================================================
// What the character sheet's Magic & Lore tab shows, worked out with no Foundry dependency, so the
// whole tab can be built and checked outside it -- the same split as martial-view.mjs and
// chargen-view.mjs. The sheet (module/sheets/actor-character-sheet.mjs) only hands this the actor
// and renders templates/actor/tab-magic.hbs against the result; what the buttons DO is in
// module/magic-actions.mjs.
//
// His Magic/Lore tab shows a section only where it applies -- the evoke sheet for an evoker, the
// aura sheets for a caster -- and this does the same. A lore's group appears when the character
// holds the skill that learns it or the skill that uses it, or already knows an entry of it, so a
// Ranger sees Herbs and not Hymns; anything else can still be added from the "Add other lore" list,
// which is how a Game Master hands out a scroll's worth of runes to someone with no Rune Lore.
//
// A kind whose magic switch is off (module/availability.mjs) is not shown at all, and with all
// magic off the tab says so and shows nothing else. Consumables are the exception to "only where it
// applies": anybody can carry a potion.
//==================================================================================================================

import { MAGIC_KINDS, CONSUMABLE_KINDS, LORE_KINDS, getItemKind, getSkillStanding,
         getMemorizationTotals } from "./lore-rules.mjs";
import { CASTING_SKILLS } from "./lore-tables.mjs";
import { normalizeMagicSubsystems } from "./availability.mjs";
import { getSpellDaysLeft } from "./casting-rules.mjs";

	// The skills that make the Invocations section worth showing: his pray button rolls Divine
	// Knowledge (sheet-worker.js:10605), and the wilderness form is how some classes carry it.
	const INVOKING_SKILLS = ["Divine Knowledge", "Divine Knowledge(w)"];

	// This is the function which turns an entry's description into one plain line for a row's
	// tooltip. The build stores his text as-is, but a Game Master's own may carry markup.
	function plainText(tmpvalue) {
		return ("" + (tmpvalue ?? "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
	}

	// This is the function which says whether a kind's magic switch lets it be shown. Switches stored
	// under the names the 2026-09-24 split retired ("bardic", "herbalism") are read as their successors.
	function isKindEnabled(tmpkind, tmprules) {
		if (!tmprules) { return true; }
		if (tmprules.magicEnabled === false) { return false; }
		return normalizeMagicSubsystems(tmprules.magicSubsystems)[MAGIC_KINDS[tmpkind]?.subsystem] !== false;
	}

	// @MARKER THE PANEL
	// This is the function which builds everything the tab renders.
	//
	//   tmpactor   an actor, or anything shaped like one ({ items, system })
	//   tmprules   the campaign's availability rules ({ magicEnabled, magicSubsystems }), or null
	//   tmpisgm    whether the viewer is the Game Master -- the starting-lore button is theirs
	export function buildMagicPanel(tmpactor, tmprules, tmpisgm) {
		var tmpsystem = tmpactor?.system ?? {};
		var tmpitems = [...(tmpactor?.items ?? [])];
		var tmpskills = tmpitems.filter(tmpitem => tmpitem.type == "skill");
		var tmptitle = parseInt(tmpsystem.identity?.title) || 0;
		var tmpstanding = (tmpname) => getSkillStanding(tmpskills, tmpname, tmptitle);
		var tmpbykind = (tmpkind) => tmpitems.filter(tmpitem => getItemKind(tmpitem) == tmpkind)
			.sort((a, b) => a.name.localeCompare(b.name));

		var tmppanel = { isGM: !!tmpisgm, magicOff: tmprules?.magicEnabled === false };
		if (tmppanel.magicOff) { return tmppanel; }

		// @MARKER MEMORIZATION
		// (goal + 1) x Knowledge's memorization points, against what is ticked -- getMemorizationTotals.
		var tmpknwpoints = parseInt(tmpsystem.attributes?.knw?.mods?.memorizationPoints)
		                || parseInt(tmpsystem.skillSlots?.memorization) || 0;
		var tmpentries = tmpitems.filter(tmpitem => ["lore", "spell", "invocation"].includes(tmpitem.type))
			.map(tmpitem => ({ kind: getItemKind(tmpitem), rating: tmpitem.system?.rating,
			                   level: tmpitem.system?.level, memorized: !!tmpitem.system?.memorized }));
		tmppanel.memorization = getMemorizationTotals(tmpknwpoints, tmpsystem.identity?.goal, tmpentries);
		tmppanel.memorization.perGoal = tmpknwpoints;

		// @MARKER CONSUMABLES
		// His consumables panel shows charms alone to a race that takes nothing in ("No Intake",
		// setConsumablesSheet, sheet-worker.js:128536). Rows already carried are shown whatever they
		// are -- only the Add buttons are narrowed.
		var tmpnointake = (tmpsystem.identity?.race?.disabilities ?? []).includes("No Intake");
		var tmpconsumablekinds = CONSUMABLE_KINDS.filter(tmpkind => isKindEnabled(tmpkind, tmprules));
		tmppanel.consumables = {
			show: tmpconsumablekinds.length > 0,
			noIntake: tmpnointake,
			rows: tmpitems.filter(tmpitem => tmpitem.type == "consumable")
				.filter(tmpitem => isKindEnabled(tmpitem.system?.kind, tmprules))
				.sort((a, b) => (CONSUMABLE_KINDS.indexOf(a.system?.kind) - CONSUMABLE_KINDS.indexOf(b.system?.kind))
				             || a.name.localeCompare(b.name))
				.map(tmpitem => ({
					id: tmpitem.id ?? tmpitem._id, name: tmpitem.name,
					kind: tmpitem.system?.kind, kindLabel: MAGIC_KINDS[tmpitem.system?.kind]?.label ?? "",
					doses: parseInt(tmpitem.system?.doses) || 0,
					isCharm: tmpitem.system?.kind == "charm",
					canUse: tmpitem.system?.kind == "charm" || (parseInt(tmpitem.system?.doses) || 0) > 0,
					detail: [tmpitem.system?.form, tmpitem.system?.value, tmpitem.system?.duration].filter(tmpv => tmpv).join(" · "),
					tooltip: plainText(tmpitem.system?.description)
				})),
			add: tmpconsumablekinds
				.filter(tmpkind => !tmpnointake || tmpkind == "charm")
				.map(tmpkind => ({ what: tmpkind, label: MAGIC_KINDS[tmpkind].label, poison: tmpkind == "poison" }))
		};

		// @MARKER LORE GROUPS
		tmppanel.loreGroups = [];
		tmppanel.otherLore = [];
		for (const tmpkind of LORE_KINDS) {
			if (!isKindEnabled(tmpkind, tmprules)) { continue; }
			var tmpdef = MAGIC_KINDS[tmpkind];
			var tmplearn = tmpdef.learn ? tmpstanding(tmpdef.learn) : null;
			var tmpuse = tmpdef.use ? tmpstanding(tmpdef.use) : null;
			var tmprows = tmpbykind(tmpkind);
			var tmpaddwhat = tmpkind == "poisonrecipe" ? "" : tmpkind;
			if (!tmprows.length && !tmplearn?.held && !tmpuse?.held) {
				tmppanel.otherLore.push({ what: tmpkind, label: tmpdef.heading, poison: tmpkind == "poisonrecipe" });
				continue;
			}
			var tmprecipe = tmpkind == "potionrecipe" || tmpkind == "poisonrecipe";
			tmppanel.loreGroups.push({
				kind: tmpkind, heading: tmpdef.heading, label: tmpdef.label,
				// "Learn a Ballad", "Learn an Empathy ritual" -- learned with a skill; evokes are added.
				addLabel: `${tmplearn ? "Learn" : "Add"} ${/^[aeiou]/i.test(tmpdef.label) ? "an" : "a"} ${tmpdef.label}`,
				learn: tmplearn, use: (tmpuse && tmpdef.use != tmpdef.learn) ? tmpuse : null,
				// The skill a use (or a brew) is rolled with, and the title its effects scale by.
				rollSkill: tmpuse ?? tmplearn,
				isRecipe: tmprecipe, isEvoke: tmpkind == "evoke", isPoisonRecipe: tmpkind == "poisonrecipe",
				addWhat: tmpaddwhat,
				rows: tmprows.map(tmpitem => ({
					id: tmpitem.id ?? tmpitem._id, name: tmpitem.name,
					rating: parseInt(tmpitem.system?.rating) || 0,
					modifier: parseInt(tmpitem.system?.modifier) || 0,
					timing: [tmpitem.system?.startTime, tmpitem.system?.duration].filter(tmpv => tmpv).join(" / "),
					extra: tmpitem.system?.component || tmpitem.system?.runeType || tmpitem.system?.form || tmpitem.system?.value || "",
					memorized: !!tmpitem.system?.memorized,
					batchDoses: parseInt(tmpitem.system?.batchDoses) || 0,
					tooltip: plainText(tmpitem.system?.description)
				}))
			});
		}

		// @MARKER SPELLS AND INVOCATIONS
		var tmpspells = tmpbykind("spell");
		var tmpcasting = CASTING_SKILLS.map(tmpname => tmpstanding(tmpname)).filter(tmps => tmps.held)
			.sort((a, b) => b.chance - a.chance)[0] ?? null;
		// How far the character has come as a caster -- derived on the actor (actor-character.mjs
		// _prepareMagic, from casting-rules.mjs); an actor prepared without it reads as no caster.
		var tmpaura = tmpsystem.magic?.aura ?? {};
		var tmpcontrol = parseInt(tmpaura.control) || 0;
		tmppanel.aura = {
			isCaster: !!tmpaura.isCaster,
			control: tmpcontrol,
			controlMax: parseInt(tmpaura.controlMax) || 0,
			controlTooltip: (tmpaura.controlParts ?? []).map(tmppart => `${tmppart.label} ${tmppart.value > 0 ? "+" : ""}${tmppart.value}`).join(", ")
				+ (tmpaura.controlDoubled ? "; doubled by Winds of Wild Magic" : "")
				+ (tmpaura.controlHalved ? "; a Wilder: every modifier halved (his errata, Master's Manual p.47)" : "")
				+ (tmpaura.controlCapped ? ` (held to ${tmpaura.controlMax} at this title)` : ""),
			pool: tmpaura.pool ?? { current: 0, full: 0, drained: 0 },
			regen: tmpaura.regen ?? "",
			absorbAura: parseInt(tmpaura.absorbAura) || 0,
			fatigueWarning: !!tmpaura.fatigueWarning,
			suppressed: !!tmpsystem.magic?.magicSuppressed,
			halfMagic: !!tmpsystem.magic?.halfMagic,
			// The Game Master's two figures, stored (his additional_aura and aura_control_boost).
			additional: parseInt(tmpsystem.magic?.additionalAura) || 0,
			boost: parseInt(tmpsystem.magic?.auraControlBoost) || 0,
			hermetic: tmpcasting?.name == "Hermetic Lore"
		};
		tmppanel.spells = {
			show: isKindEnabled("spell", tmprules) && (tmpspells.length > 0 || !!tmpcasting || !!tmpaura.isCaster),
			casting: tmpcasting,
			rows: tmpspells.map(tmpitem => {
				var tmplevel = parseInt(tmpitem.system?.level) || 0;
				var tmpeffectivecontrol = tmpcontrol + (tmpitem.system?.mastered ? 2 : 0);
				var tmpfailper = parseInt(tmpitem.system?.fail) || 0;
				var tmpmemorized = !!tmpitem.system?.memorized;
				// His days of memory (item-spell.mjs): out of them, a memorized spell is "forgotten" and
				// must be refreshed with MEM before it can be cast -- except a Hermeticist's (useSpell).
				var tmpdays = getSpellDaysLeft(tmpitem.system);
				return {
					id: tmpitem.id ?? tmpitem._id, name: tmpitem.name, level: tmplevel,
					memTime: tmpitem.system?.memTime ?? "", castTime: tmpitem.system?.castTime ?? "",
					range: tmpitem.system?.range ?? "", duration: tmpitem.system?.duration ?? "",
					save: tmpitem.system?.save ?? "",
					memorized: tmpmemorized, mastered: !!tmpitem.system?.mastered,
					days: tmpdays, forgotten: tmpmemorized && tmpdays < 1 && tmpcasting?.name != "Hermetic Lore",
					// Above Aura Control: his fail figure for every level over, as the cast will roll it.
					aboveControl: tmplevel > tmpeffectivecontrol,
					failChance: (tmplevel > tmpeffectivecontrol && tmpfailper > 0) ? Math.min(100, tmpfailper * (tmplevel - tmpeffectivecontrol)) : 0,
					tooltip: plainText(tmpitem.system?.description)
				};
			})
		};
		if (!tmppanel.spells.show && isKindEnabled("spell", tmprules)) {
			tmppanel.otherLore.push({ what: "spell", label: "Spells" });
		}

		var tmpinvocations = tmpbykind("invocation");
		var tmpknowledge = INVOKING_SKILLS.map(tmpname => tmpstanding(tmpname)).find(tmps => tmps.held) ?? null;
		var tmppiety = tmpsystem.magic?.piety ?? {};
		tmppanel.piety = {
			isInvoker: !!tmppiety.isInvoker,
			control: parseInt(tmppiety.control) || 0,
			level: parseInt(tmppiety.level) || 0,
			controlTooltip: (tmppiety.controlParts ?? []).map(tmppart => `${tmppart.label} +${tmppart.value}`).join(", "),
			denial: !!tmpsystem.magic?.divineDenial,
			boost: parseInt(tmpsystem.magic?.pietyLevelBoost) || 0,
			devotions: tmpsystem.magic?.devotions ?? "",
			ignoreDevotions: !!tmpsystem.magic?.ignoreDevotions
		};
		tmppanel.invocations = {
			show: isKindEnabled("invocation", tmprules) && (tmpinvocations.length > 0 || !!tmpknowledge || !!tmppiety.isInvoker),
			knowledge: tmpknowledge,
			rows: tmpinvocations.map(tmpitem => ({
				id: tmpitem.id ?? tmpitem._id, name: tmpitem.name, level: parseInt(tmpitem.system?.level) || 0,
				alignment: tmpitem.system?.alignment ?? "", prayerTime: tmpitem.system?.prayerTime ?? "",
				invokeTime: tmpitem.system?.invokeTime ?? "", uses: tmpitem.system?.uses ?? "",
				usesLeft: parseInt(tmpitem.system?.usesLeft) || 0,
				duration: tmpitem.system?.duration ?? "",
				// A Piety Level above Piety Control cannot be prayed for (his handlePrayForInvocation).
				overControl: (parseInt(tmpitem.system?.level) || 0) > (parseInt(tmppiety.control) || 0),
				memorized: !!tmpitem.system?.memorized, tooltip: plainText(tmpitem.system?.description)
			}))
		};

		// @MARKER RUNNING ON THE CHARACTER
		// His effects list, "Spell: Fly, Invoke: Chill" -- what the character has cast or invoked on
		// themselves and is still running. A cross ends one (his standardSpellRemovalEffect, by hand).
		tmppanel.effects = ("" + (tmpsystem.magic?.effectList ?? "")).split(",").map(tmpe => tmpe.trim())
			.filter(tmpe => tmpe && tmpe != "None");
		if (!tmppanel.invocations.show && isKindEnabled("invocation", tmprules)) {
			tmppanel.otherLore.push({ what: "invocation", label: "Invocations" });
		}

		tmppanel.nothingYet = !tmppanel.consumables.rows.length && !tmppanel.loreGroups.length
			&& !tmppanel.spells.show && !tmppanel.invocations.show;
		return tmppanel;
	}

// @MARKER ADD NEW magic view functions HERE
// @END (CODE)
