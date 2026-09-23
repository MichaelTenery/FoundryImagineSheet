// @START (CODE)
// @MARKER SITUATION MODS WINDOW
//==================================================================================================================
// The Situation Mods window: his "SITUATION MODS" bar and the two panels it opens, "Set melee
// modifiers" and "Set missile modifiers", as one window beside the sheet.
//
// Pick the kind, tick what applies -- position, the target's state, visibility, size -- and the
// totals along the bottom are what every attack of that kind reads until they are cleared. They
// are written to the actor as they are ticked, so an attack made with the window still open sees
// them, and the character's own defence changes with them for anyone attacking THEM.
//
// Six options are set by a skill roll instead of a tick (Critical, Focused Attack, Surprise Attack,
// Brace, Perfect Shot, Quick Load); each has its own Roll button, made with the chosen weapon's
// skills modifier, and a critical result sets the matching Crit or Crit Fail as well.
//
// Open it from the Combat tab of a character or creature, or from a macro:
//     game.imagine.situationMods(actor)
//
// Nothing here is a rule. The figures are in combat-rules.mjs (@MARKER SITUATIONAL MODIFIERS) and
// what is shown is built by module/situational-view.mjs, which the preview renders too.
//==================================================================================================================

import { toggleSituationalOption, getSituationalRollResult, getSituationalOptions,
         getLoreModifiers, resolveOffhandPenalties, getSecondWeaponFlags } from "../combat/combat-rules.mjs";
import { resolveSkillOutcome } from "../skills-rules.mjs";
import { buildSituationalView } from "../situational-view.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineSituationalMods extends HandlebarsApplicationMixin(ApplicationV2) {

	// @MARKER SHEET THEME
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);

		// The two dropdowns -- the kind, and the one-of groups shown as a dropdown -- change rather
		// than click, and an ApplicationV2 action is dispatched from a click, so these two are
		// bound here instead.
		this.element.querySelector("select[name='kind']")
			?.addEventListener("change", (event) => this.#setKind(event.target.value));
		for (const tmpselect of this.element.querySelectorAll("select[data-group-select]")) {
			tmpselect.addEventListener("change", (event) => this.#setGroupChoice(event.target));
		}
		this.element.querySelector("select[name='weaponId']")
			?.addEventListener("change", (event) => this.#update({ weaponId: event.target.value }));
	}

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "situation-mods"],
		window: { title: "Situation Mods", resizable: true },
		position: { width: 560, height: 680 },
		actions: {
			toggleOption:  ImagineSituationalMods.#onToggleOption,
			rollOption:    ImagineSituationalMods.#onRollOption,
			clearAll:      ImagineSituationalMods.#onClearAll,
			done:          ImagineSituationalMods.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/situational-mods.hbs", scrollable: [".situation-body"] }
	};

	#actor = null;

	// One window per actor: a fixed id would have a second actor's window steal the first's.
	constructor(tmpactor, tmpoptions = {}) {
		super({ ...tmpoptions, id: `imagine-situation-mods-${tmpactor?.id ?? "unknown"}` });
		this.#actor = tmpactor;
	}

	get title() {
		return `Situation Mods: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open
	// already -- two windows under one id would have ApplicationV2 refuse the second.
	static open(tmpactor) {
		var tmpexisting = foundry.applications.instances.get(`imagine-situation-mods-${tmpactor?.id ?? "unknown"}`);
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineSituationalMods(tmpactor).render(true);
	}

	// Registered with the actor so the window re-renders whenever the actor changes -- a tick
	// made from here, and a roll, both come back through the actor's update.
	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		this.#actor.apps[this.id] = this;
	}

	_onClose(options) {
		super._onClose?.(options);
		delete this.#actor.apps[this.id];
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpsystem = this.#actor.system;
		var tmpsituation = tmpsystem.combat.situation ?? {};
		tmpcontext.actor = this.#actor;
		Object.assign(tmpcontext, buildSituationalView(tmpsituation, tmpsystem.combat.situational,
			ImagineSituationalMods.#getWeapons(this.#actor), ImagineSituationalMods.#getChances(this.#actor, tmpsituation.kind)));
		return tmpcontext;
	}

	// This is the function which lists the weapons a situational skill roll can be made with, and
	// the skills modifier each carries: its lore's skills bonus, and the off hand's skills penalty
	// after any Second Weapon Knowledge or Lore -- his weapon's "Skills Mod" column, which is what
	// his sit_weapon_skills_melee reads. A creature has none.
	static #getWeapons(tmpactor) {
		if (tmpactor.type != "character") { return []; }
		var tmpcombat = tmpactor.system.combat;
		var tmpout = [];
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "weapon") { continue; }
			var tmpw = tmpitem.system;
			if (tmpw.location != "equipped" && tmpw.location != "carried") { continue; }
			var tmpmode = ["thrust", "cut", "smash", "missile"].find(m => tmpw[m]?.available) ?? "thrust";
			var tmplore = getLoreModifiers({
				mode: tmpmode, weaponName: tmpitem.name,
				hasWeaponLore: tmpcombat.hasWeaponLore, hasMissileLore: tmpcombat.hasMissileLore,
				weaponLoreList: tmpcombat.weaponLoreNames, missileLoreList: tmpcombat.missileLoreNames
			});
			var tmpsecond = getSecondWeaponFlags({
				weaponName: tmpitem.name,
				hasSecondWeaponKnowledge: tmpcombat.hasSecondWeaponKnowledge,
				hasSecondWeaponLore: tmpcombat.hasSecondWeaponLore,
				secondWeaponKnowList: tmpcombat.secondWeaponKnowNames,
				secondWeaponLoreList: tmpcombat.secondWeaponLoreNames
			});
			var tmpoffhand = resolveOffhandPenalties({ ...tmpw, ...tmpsecond }, tmpactor.system.attributes.agl.rating,
				tmpactor.system.physical?.handedness, tmpcombat.secondWeaponKnowChance);
			tmpout.push({ id: tmpitem.id, name: tmpitem.name, skillsMod: tmplore.skills + tmpoffhand.skill });
		}
		return tmpout;
	}

	// This is the function which reads each rollable option's skill chance off the actor. A
	// character's is its skill item's total, the best of several copies (a skill held both racially
	// and by class); a creature's is the flat percentage on its stat block.
	static #getChances(tmpactor, tmpkind) {
		var tmpout = {};
		for (const tmpoption of Object.values(getSituationalOptions(tmpkind))) {
			if (!tmpoption.skill || (tmpoption.skill in tmpout)) { continue; }
			var tmpchance = ImagineSituationalMods.#getSkillChance(tmpactor, tmpoption.skill);
			if (tmpchance !== null) { tmpout[tmpoption.skill] = tmpchance; }
		}
		return tmpout;
	}

	// Null when the actor does not have the skill at all, which his rolls report differently
	// from a skill held at 0% ("does not have the skill" against "has no skill chance").
	static #getSkillChance(tmpactor, tmpname) {
		if (tmpactor.type == "character") {
			var tmpcopies = tmpactor.items.filter(i => i.type == "skill" && i.name == tmpname);
			if (!tmpcopies.length) { return null; }
			return Math.max(...tmpcopies.map(i => parseInt(i.system.totalChance) || 0));
		}
		var tmpskill = (tmpactor.system.skills ?? []).find(s => s.name == tmpname);
		return tmpskill ? (parseInt(tmpskill.chance) || 0) : null;
	}

	// @MARKER WRITING
	async #update(tmpchanges) {
		var tmpupdate = {};
		for (const [tmpkey, tmpvalue] of Object.entries(tmpchanges)) {
			tmpupdate[`system.combat.situation.${tmpkey}`] = tmpvalue;
		}
		await this.#actor.update(tmpupdate);
	}

	// Choosing a panel starts it clean, as his dropdown does: choosing melee clears whatever
	// missile modifiers were set, and the other way round.
	async #setKind(tmpkind) {
		await this.#update({ kind: tmpkind, selected: [] });
	}

	async #setGroupChoice(tmpselect) {
		var tmpsituation = this.#actor.system.combat.situation;
		var tmpgroup = tmpselect.dataset.groupSelect;
		var tmpoptions = getSituationalOptions(tmpsituation.kind);
		var tmpselected = (tmpsituation.selected ?? []).filter(k => tmpoptions[k]?.group != tmpgroup);
		if (tmpselect.value) { tmpselected = toggleSituationalOption(tmpsituation.kind, tmpselected, tmpselect.value); }
		await this.#update({ selected: tmpselected });
	}

	static async #onToggleOption(event, target) {
		var tmpsituation = this.#actor.system.combat.situation;
		var tmpselected = toggleSituationalOption(tmpsituation.kind, tmpsituation.selected, target.dataset.key);
		await this.#update({ selected: tmpselected });
	}

	static async #onClearAll(event, target) {
		await this.#update({ kind: "", selected: [] });
	}

	static async #onDone(event, target) {
		await this.close();
	}

	// @MARKER SKILL ROLLS
	// His ROLL and MOD buttons as one: the modifier box beside the weapon stands in for his MOD
	// prompt, and at 0 it is his plain ROLL. The roll reads the skill's chance plus the chosen
	// weapon's skills modifier; the outcome sets the option, and its Crit or Crit Fail.
	static async #onRollOption(event, target) {
		var tmpactor = this.#actor;
		var tmpsituation = tmpactor.system.combat.situation;
		var tmpkey = target.dataset.key;
		var tmpoption = getSituationalOptions(tmpsituation.kind)[tmpkey];
		if (!tmpoption?.skill) { return; }

		var tmpchance = ImagineSituationalMods.#getSkillChance(tmpactor, tmpoption.skill);
		if (tmpchance === null || tmpchance <= 0) {
			// Either way his roll clears the three boxes and says why.
			await this.#update({ selected: getSituationalRollResult(tmpsituation.kind, tmpsituation.selected, tmpkey, "Failed") });
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
				content: `<div class="imagine-chat skill-roll"><p>${foundry.utils.escapeHTML(tmpactor.name)} attempted to
					${foundry.utils.escapeHTML(tmpoption.skill)} but ${tmpchance === null ? "does not have the skill" : "has no skill chance"}.</p></div>`
			});
			return;
		}

		var tmpweapon = ImagineSituationalMods.#getWeapons(tmpactor).find(w => w.id == tmpsituation.weaponId);
		var tmpmod = parseInt(this.element?.querySelector("input[name='rollMod']")?.value) || 0;
		var tmptotal = tmpchance + (tmpweapon?.skillsMod ?? 0) + tmpmod;

		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveSkillOutcome(tmptotal, tmproll.total);

		await this.#update({ selected: getSituationalRollResult(tmpsituation.kind, tmpsituation.selected, tmpkey, tmpresult.outcome) });

		var tmpwith = tmpweapon ? ` with ${foundry.utils.escapeHTML(tmpweapon.name)}` : "";
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			rolls: [tmproll],
			content: `<div class="imagine-chat skill-roll">
				<header><strong>${foundry.utils.escapeHTML(tmpactor.name)}</strong> &mdash; ${foundry.utils.escapeHTML(tmpoption.skill)} (situational)</header>
				<p>Rolled ${tmproll.total} against ${tmptotal}%${tmpwith}: <strong>${tmpresult.outcome}</strong>.</p>
				<p class="hint">${ImagineSituationalMods.#describeRollEffect(tmpoption, tmpresult.outcome)}</p></div>`
		});
	}

	// This is the function which says in a sentence what a roll's outcome set.
	static #describeRollEffect(tmpoption, tmpoutcome) {
		if (tmpoutcome == "Critical success") { return `${tmpoption.label} is set, with its critical bonus.`; }
		if (tmpoutcome == "Succeeded")        { return `${tmpoption.label} is set.`; }
		if (tmpoutcome == "Critical failure") { return `${tmpoption.label} is not set, and its critical failure is.`; }
		return `${tmpoption.label} is not set.`;
	}
}
// @END (CODE)
