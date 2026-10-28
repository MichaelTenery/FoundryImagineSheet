// @START (CODE)
// @MARKER ARMOR KNOWLEDGE WINDOW
//==================================================================================================================
// The Armor Knowledge / Armor Lore window: his Updater options "Select Armor Know. Config." and
// "Select Armor Lore Config." as one window beside the sheet, switched between the two by a dropdown.
//
// Wear the armour that makes the configuration, open the window, press ROLL (or MOD, which asks for a
// modifier first -- his "+20% for 1-3 minor changes, +5% per 2 points of armor magic +" prompt). A success
// writes the set worn onto the character; from then on wearing that set eases the armour's penalties
// (Armor Knowledge: levels of them; Armor Lore: all of them).
//
// Open it from the Updater, or from a macro:
//     game.imagine.armorKnowledge(actor)            Armor Knowledge
//     game.imagine.armorKnowledge(actor, "lore")    Armor Lore
//
// Nothing here is a rule. The rules are module/armor-know-rules.mjs and what is shown is built by
// module/armor-know-view.mjs, which the test renders too.
//==================================================================================================================

import { ARMOR_KNOWLEDGE, ARMOR_LORE, getEquippedArmorSet, isConfigLearned, addConfig, getConfigSlots,
         getArmorSkillPanel, resolveArmorConfigRoll, describeArmorConfigRoll, removeConfig,
         parseConfigList, getCreatureArmorStanding } from "../armor-know-rules.mjs";
import { buildArmorKnowView } from "../armor-know-view.mjs";
import { getSkillStanding } from "../lore-rules.mjs";
import { getNonAcquiredLookup } from "../non-acquired.mjs";
import { askRollModifier } from "../roll-modifier.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineArmorKnowledge extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "armor-know"],
		window: { title: "Armor Knowledge", resizable: true },
		position: { width: 560, height: "auto" },
		actions: {
			rollConfig:    ImagineArmorKnowledge.#onRoll,
			rollConfigMod: ImagineArmorKnowledge.#onRollMod,
			removeConfig:  ImagineArmorKnowledge.#onRemove,
			done:          ImagineArmorKnowledge.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/armor-knowledge.hbs" }
	};

	#actor = null;
	#kind = "know";

	// One window per actor, keyed by uuid as the other windows are.
	static windowId(tmpactor) {
		return `imagine-armor-know-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpkind, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineArmorKnowledge.windowId(tmpactor) });
		this.#actor = tmpactor;
		this.#kind = tmpkind == "lore" ? "lore" : "know";
	}

	get title() {
		return `${this.#kind == "lore" ? ARMOR_LORE : ARMOR_KNOWLEDGE}: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the actor's window, or brings it forward if it is open.
	static open(tmpactor, tmpkind) {
		var tmpexisting = foundry.applications.instances.get(ImagineArmorKnowledge.windowId(tmpactor));
		if (tmpexisting) {
			if (tmpkind) { tmpexisting.#kind = tmpkind == "lore" ? "lore" : "know"; tmpexisting.render(); }
			tmpexisting.bringToFront();
			return tmpexisting;
		}
		return new ImagineArmorKnowledge(tmpactor, tmpkind).render(true);
	}

	// Registered with the actor so the window follows its changes (armour put on, a set learned).
	_onFirstRender(context, options) {
		super._onFirstRender?.(context, options);
		this.#actor.apps[this.id] = this;
	}

	_onClose(options) {
		super._onClose?.(options);
		delete this.#actor.apps[this.id];
	}

	// @MARKER SHEET THEME
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
		// The dropdown changes rather than clicks, so it is bound here.
		this.element.querySelector("select[name='kind']")
			?.addEventListener("change", (event) => { this.#kind = event.target.value == "lore" ? "lore" : "know"; this.render(); });
		// His creature-only "Automatic" tick, written straight onto the creature as his checkbox was.
		this.element.querySelector("input[name='automatic']")
			?.addEventListener("change", (event) => this.#actor.update({
				[`system.combat.${this.#kind == "lore" ? "automaticArmorLore" : "automaticArmorKnow"}`]: event.target.checked }));
	}

	// @MARKER STANDING
	// This is the function which says where the character stands in the skill this window is on: the
	// standing (held, or common footing for Armor Knowledge), which of his three panels that makes, and the
	// practitioner title the slots are counted from.
	async #getStanding(tmpkind) {
		var tmpactor = this.#actor;
		var tmpname = tmpkind == "lore" ? ARMOR_LORE : ARMOR_KNOWLEDGE;
		// A creature reads its stat block, both skills off the Armor Knowledge entry -- his creature branch,
		// slip and all (getCreatureArmorStanding).
		if (tmpactor.type == "creature") {
			var tmpcreature = getCreatureArmorStanding(tmpactor.system._getCreatureSkillChance?.("Armor Knowledge") ?? 0,
				tmpactor.system?.identity?.level);
			return { name: tmpname, standing: tmpcreature, panel: tmpcreature.panel };
		}
		var tmplookup = await getNonAcquiredLookup(tmpactor);
		// Armor Lore is never tried unheld, so it is given no footing to stand on.
		var tmpstanding = getSkillStanding(tmpactor.items.filter(tmpitem => tmpitem.type == "skill"), tmpname,
			tmpactor.system?.identity?.title, tmpkind == "lore" ? null : tmplookup);
		var tmpcomeslater = tmplookup?.nonAcquiredNames?.includes(tmpname) ?? false;
		return { name: tmpname, standing: tmpstanding, panel: getArmorSkillPanel(tmpstanding, tmpkind == "lore", tmpcomeslater) };
	}

	#getWorn() {
		return getEquippedArmorSet(getWornArmorOf(this.#actor));
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpactor = this.#actor;
		var tmpstate = await this.#getStanding(this.#kind);
		var tmpclass = tmpactor.items.find(tmpitem => tmpitem.type == "class");
		var tmpiscreature = tmpactor.type == "creature";
		tmpcontext.actor = tmpactor;
		Object.assign(tmpcontext, buildArmorKnowView(this.#kind, {
			characterName: tmpactor.name,
			className: tmpiscreature ? "creature" : (tmpclass?.system?.baseClass || tmpclass?.name || ""),
			wornNames: this.#getWorn(),
			list: tmpactor.system.combat[this.#kind == "lore" ? "armorLoreList" : "armorKnowList"],
			panel: tmpstate.panel,
			practitionerTitle: tmpstate.standing.practitionerTitle,
			chance: tmpstate.standing.chance,
			canRemove: game.user?.isGM || tmpactor.isOwner,
			isCreature: tmpiscreature,
			automatic: tmpiscreature && !!tmpactor.system.combat[this.#kind == "lore" ? "automaticArmorLore" : "automaticArmorKnow"]
		}));
		return tmpcontext;
	}

	// @MARKER THE ROLL
	// His handleArmorKnowRoll / handleArmorLoreRoll, with the d100 through Foundry's own dice.
	async #roll(tmpmodifier) {
		var tmpactor = this.#actor;
		var tmpkind = this.#kind;
		var tmpstate = await this.#getStanding(tmpkind);
		var tmplist = tmpactor.system.combat[tmpkind == "lore" ? "armorLoreList" : "armorKnowList"];
		var tmpworn = this.#getWorn();
		var tmpheld = tmpstate.panel == "ok";

		var tmpinput = {
			held: tmpheld,
			alreadyLearned: isConfigLearned(tmpworn, tmplist),
			slotsOpen: getConfigSlots(tmpstate.standing.practitionerTitle, tmplist),
			chance: tmpstate.standing.chance,
			modifier: tmpmodifier,
			// His "Automatic" tick, creatures only.
			automatic: tmpactor.type == "creature" && !!tmpactor.system.combat[tmpkind == "lore" ? "automaticArmorLore" : "automaticArmorKnow"]
		};
		// Nothing is rolled for a refusal, so the die is only thrown when the roll will count.
		var tmproll = null;
		if (tmpheld && !tmpinput.alreadyLearned && tmpinput.slotsOpen >= 1 && tmpworn.length && !tmpinput.automatic) {
			var tmpdie = new Roll("1d100");
			await tmpdie.evaluate();
			tmproll = tmpdie.total;
		}
		var tmpresult = tmpworn.length
			? resolveArmorConfigRoll(tmpinput, tmproll)
			: { outcome: "noArmor", roll: null, total: tmpinput.chance + tmpmodifier };
		var tmpline = tmpresult.outcome == "noArmor"
			? `${tmpactor.name} is wearing no armor to make a configuration of. Nothing done.`
			: describeArmorConfigRoll(tmpresult, tmpstate.name, tmpactor.name);

		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `Add ${tmpstate.name} Config.${tmpmodifier ? ` Mod (${tmpmodifier > 0 ? "+" : ""}${tmpmodifier})` : ""}`,
			content: `<div class="imagine-skill-card"><p>${foundry.utils.escapeHTML(tmpline)}</p></div>`
		});

		if (tmpresult.outcome == "success" || tmpresult.outcome == "automatic") {
			await tmpactor.update({
				[`system.combat.${tmpkind == "lore" ? "armorLoreList" : "armorKnowList"}`]: addConfig(tmplist, tmpworn)
			});
		}
	}

	static async #onRoll(event, target) {
		event.preventDefault();
		await this.#roll(0);
	}

	static async #onRollMod(event, target) {
		event.preventDefault();
		var tmpmodifier = await askRollModifier({}, "Modifier",
			"Modifier to the chance (+20% for 1-3 minor changes, +5% per 2 points of armor magic +, ...):");
		if (tmpmodifier === null) { return; }
		await this.#roll(tmpmodifier);
	}

	// @MARKER FORGETTING A SET
	// Takes one learned set off the list, after asking. The port's own -- his sheet never could (see
	// removeConfig in module/armor-know-rules.mjs). The Game Master or the actor's owner only.
	static async #onRemove(event, target) {
		event.preventDefault();
		var tmpactor = this.#actor;
		if (!(game.user?.isGM || tmpactor.isOwner)) { return; }
		var tmpfield = this.#kind == "lore" ? "armorLoreList" : "armorKnowList";
		var tmplist = tmpactor.system.combat[tmpfield];
		var tmpindex = parseInt(target.dataset.index);
		var tmpset = parseConfigList(tmplist)[tmpindex];
		if (!tmpset) { return; }
		var tmpskill = this.#kind == "lore" ? ARMOR_LORE : ARMOR_KNOWLEDGE;
		var tmpok = await foundry.applications.api.DialogV2.confirm({
			window: { title: `Forget ${tmpskill} set` },
			content: `<p>Forget this ${foundry.utils.escapeHTML(tmpskill)} configuration? Its slot opens again.</p>`
			       + `<p><b>${foundry.utils.escapeHTML(tmpset.join(", "))}</b></p>`
		});
		if (!tmpok) { return; }
		await tmpactor.update({ [`system.combat.${tmpfield}`]: removeConfig(tmplist, tmpindex) });
	}

	static async #onDone(event, target) {
		await this.close();
	}
}

// This is the function which gives the armour the character wears -- items of type armor located
// "equipped". The sheet's own _getWornArmor does the same off the data model.
function getWornArmorOf(tmpactor) {
	return typeof tmpactor.system?._getWornArmor == "function"
		? tmpactor.system._getWornArmor()
		: tmpactor.items.filter(tmpitem => tmpitem.type == "armor" && tmpitem.system.location == "equipped");
}
// @END (CODE)
