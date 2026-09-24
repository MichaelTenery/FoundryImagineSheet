// @START (CODE)
// @MARKER CREATURE SHEET
//==================================================================================================================
// The creature sheet, built on ApplicationV2 with the Handlebars mixin.
//
// Same construction as the character sheet: one PART per tab, each with a single root element,
// because the framework's two-pass rendering relies on it to keep focus and scroll position.
//
// Four tabs rather than the character's four-plus: Stats (what the stat block states), Skills
// (a name and a flat percentage each), Combat (the attack chart, the creature's natural attacks
// and the state of its body) and Traits (abilities, disabilities, immunities and Powers).
//
// The attack roll is reached through game.imagine rather than imported, which is how the system
// already exposes rollWeaponAttack. It keeps the sheet loadable on its own.
//
// AUTHORED IN PLAY since 2026-09-23. Before then only what a creature already had could be edited --
// no skill could be added, no body type chosen, no movement mode written, and an attack dropped on
// by mistake could not be taken off without the console. His creature is built on a Configurator tab
// and committed with Finish (handleCreatureFinish, sheet-worker.js:174660); this sheet edits in place
// instead, the Foundry way (the provisional D7 of the creature audit, docs/DECISIONS.md 2026-09-23).
// The rules behind the new controls are in module/creature-sheet-rules.mjs.
//==================================================================================================================

import { CREATURE_TYPES, CREATURE_BODY_TYPES, CREATURE_ATTACK_CHARTS, CREATURE_SIZES,
         BODY_AREA_TYPES } from "../creature-tables.mjs";
import { resolveCharacteristicRoll, readBodyChartRows, serializeBodyChart, getStockBodyChart,
         BODY_AREA_MULTIPLIERS, moveListEntry, removeListEntry } from "../creature-sheet-rules.mjs";
import { isOffhandWeapon } from "../combat/combat-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";
import { describeSituationalTotals } from "../situational-view.mjs";
import { resolveResistanceRoll, describeResistanceRoll } from "../resistance-rules.mjs";
import { rollMartialAttack, rollMartialSubskill, rollMartialMove, rollMartialLoreValue,
         learnMartialStance, masterMartialStance, learnMartialSubskill,
         learnMartialLoreValue, loadMartialTemplates } from "../combat/martial-attack.mjs";
import { parseMartialList, getStanceSkillBonus } from "../combat/martial-arts.mjs";
import { buildMartialPanel } from "../martial-view.mjs";
import { getActorSheetClock } from "../apps/round-clock.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export default class ImagineCreatureSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	// @MARKER TAB STATE
	// Hands each tab part its own entry from the prepared tab data, which is what lets the template
	// render the `active` class. Foundry's own sheets all do this and ours did not, and the symptom
	// was odd enough to be worth recording: a tab went BLANK the moment anything on it was added or
	// deleted, and came back if you clicked to another tab and back again.
	// The reason is that `changeTab` -- the only thing that puts `active` on a section -- runs on a
	// CLICK and nowhere else, and it early-returns when the group is already on that tab. So the
	// class survived only until the next re-render regenerated the part's HTML from a template that
	// never wrote it, after which the section was still `.tab` with no `.active`, and `.tab` is
	// display:none. Adding a language or a piece of gear updates the document, the document
	// re-renders the sheet, and the tab the player was looking at disappeared.
	async _preparePartContext(partId, context, options) {
		var tmpcontext = await super._preparePartContext(partId, context, options);
		if (tmpcontext.tabs && (partId in tmpcontext.tabs)) { tmpcontext.tab = tmpcontext.tabs[partId]; }
		return tmpcontext;
	}

	// @MARKER SHEET THEME
	// Painted at render rather than declared in DEFAULT_OPTIONS.classes, so a window already open
	// when the Game Master changes the theme repaints on its next render instead of having to be
	// closed and reopened. See module/sheet-theme.mjs.
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
	}

	// @MARKER BODY CHART FORM
	// The body chart is ONE string in the schema -- his "Name(Type:xN),..." (body.bodyChart) -- and a
	// list of rows on the sheet, so the rows the form hands back are written into the string here
	// before the document ever sees them, the same shape as the skill sheet's types
	// (ImagineSkillSheet._processFormData). The rows are named bodyChartRows.N.name / .type /
	// .multiplier, outside `system`, so nothing else in the form can collide with them. A row whose
	// name is emptied is dropped (serializeBodyChart).
	_processFormData(event, form, formData) {
		var tmpdata = super._processFormData(event, form, formData);
		if (tmpdata?.bodyChartRows) {
			var tmprows = Object.entries(tmpdata.bodyChartRows)
				.sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0))
				.map(([tmpindex, tmprow]) => tmprow);
			tmpdata.system ??= {};
			tmpdata.system.body ??= {};
			tmpdata.system.body.bodyChart = serializeBodyChart(tmprows);
			delete tmpdata.bodyChartRows;
		}
		return tmpdata;
	}


	static DEFAULT_OPTIONS = {
		classes: ["imagine", "sheet", "actor", "creature"],
		position: { width: 820, height: 720 },
		window: { resizable: true },
		form: { submitOnChange: true },
		actions: {
			rollAttributeSave: ImagineCreatureSheet.#onRollAttributeSave,
			rollResistance: ImagineCreatureSheet.#onRollResistance,
			rollCharacteristic: ImagineCreatureSheet.#onRollCharacteristic,
			rollCreatureSkill: ImagineCreatureSheet.#onRollCreatureSkill,
			rollCreatureAttack: ImagineCreatureSheet.#onRollCreatureAttack,
			setAttackHand: ImagineCreatureSheet.#onSetAttackHand,
			usePower: ImagineCreatureSheet.#onUsePower,
			// Every item on a creature can be opened and taken off again, as on the character sheet.
			openItem: ImagineCreatureSheet.#onOpenItem,
			deleteItem: ImagineCreatureSheet.#onDeleteItem,
			openSituation: ImagineCreatureSheet.#onOpenSituation,
			clearSituation: ImagineCreatureSheet.#onClearSituation,
			// Authoring in play, all in the @MARKER AUTHORING block below: the creature's own items,
			// its skill and movement lists, its body chart and the modifiers panel.
			// (openItem and deleteItem, above, open and remove what these create.)
			createCreatureItem: ImagineCreatureSheet.#onCreateCreatureItem,
			addSkill: ImagineCreatureSheet.#onAddSkill,
			removeSkill: ImagineCreatureSheet.#onRemoveSkill,
			addMovement: ImagineCreatureSheet.#onAddMovement,
			removeMovement: ImagineCreatureSheet.#onRemoveMovement,
			moveMovement: ImagineCreatureSheet.#onMoveMovement,
			customizeBodyChart: ImagineCreatureSheet.#onCustomizeBodyChart,
			resetBodyChart: ImagineCreatureSheet.#onResetBodyChart,
			addBodyArea: ImagineCreatureSheet.#onAddBodyArea,
			removeBodyArea: ImagineCreatureSheet.#onRemoveBodyArea,
			toggleModifiers: ImagineCreatureSheet.#onToggleModifiers,
			// Martial arts, all in the @MARKER MARTIAL ARTS block at the foot of this class -- the
			// same panel, rolls and handlers the character sheet has.
			toggleMartialPanel: ImagineCreatureSheet.#onToggleMartialPanel,
			rollMartialAttack: ImagineCreatureSheet.#onRollMartialAttack,
			rollMartialSubskill: ImagineCreatureSheet.#onRollMartialSubskill,
			rollMartialMove: ImagineCreatureSheet.#onRollMartialMove,
			toggleMartialMove: ImagineCreatureSheet.#onToggleMartialMove,
			rollMartialLoreValue: ImagineCreatureSheet.#onRollMartialLoreValue,
			toggleMartialLoreValue: ImagineCreatureSheet.#onToggleMartialLoreValue,
			clearMartialMoves: ImagineCreatureSheet.#onClearMartialMoves,
			learnMartialStance: ImagineCreatureSheet.#onLearnMartialStance,
			masterMartialStance: ImagineCreatureSheet.#onMasterMartialStance,
			learnMartialSubskill: ImagineCreatureSheet.#onLearnMartialSubskill,
			learnMartialLoreValue: ImagineCreatureSheet.#onLearnMartialLoreValue
		}
	};

	// This is the function which opens one of the creature's items -- an attack, a power, a trait, a piece
	// of gear.
	static async #onOpenItem(event, target) {
		event.preventDefault();
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (tmpitem) { tmpitem.sheet.render(true); }
	}

	// This is the function which takes an item off the creature. Asked first, as on the character
	// sheet: an item deleted here is gone, and a mis-click on a row of small buttons is easy.
	static async #onDeleteItem(event, target) {
		event.preventDefault();
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }
		var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: "Imagine RPG" },
			content: `<p>Remove <strong>${foundry.utils.escapeHTML(tmpitem.name)}</strong> from ${foundry.utils.escapeHTML(this.document.name)}?</p>`,
			rejectClose: false,
			modal: true
		});
		if (tmpconfirmed) { await tmpitem.delete(); }
	}

	// @MARKER SHEET PARTS
	static PARTS = {
		header: { template: "systems/imagine-rpg/templates/actor/creature-header.hbs" },
		tabs:   { template: "templates/generic/tab-navigation.hbs" },
		stats:  { template: "systems/imagine-rpg/templates/actor/tab-creature-stats.hbs", scrollable: [""] },
		skills: { template: "systems/imagine-rpg/templates/actor/tab-creature-skills.hbs", scrollable: [""] },
		combat: { template: "systems/imagine-rpg/templates/actor/tab-creature-combat.hbs", scrollable: [""] },
		traits: { template: "systems/imagine-rpg/templates/actor/tab-creature-traits.hbs", scrollable: [""] }
	};

	static TABS = {
		primary: {
			tabs: [
				{ id: "stats",  icon: "fa-solid fa-dice-d20" },
				{ id: "skills", icon: "fa-solid fa-list-check" },
				{ id: "combat", icon: "fa-solid fa-khanda" },
				{ id: "traits", icon: "fa-solid fa-paw" }
			],
			initial: "stats",
			labelPrefix: "IMAGINE.Tab"
		}
	};

	// This is the function which assembles the data every template renders against.
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);

		tmpcontext.actor = this.document;
		tmpcontext.system = this.document.system;
		tmpcontext.attributes = ImagineCreatureSheet.#buildAttributeRows(this.document.system);
		tmpcontext.skills = ImagineCreatureSheet.#buildSkillRows(this.document.system);
		tmpcontext.attacks = ImagineCreatureSheet.#buildAttackRows(this.document);
		tmpcontext.traits = ImagineCreatureSheet.#buildTraitRows(this.document);
		tmpcontext.powers = ImagineCreatureSheet.#buildPowerRows(this.document);
		tmpcontext.gear = this.document.items.filter(i =>
			["weapon", "armor", "equipment"].includes(i.type));

		// The option lists the header and combat tab render as dropdowns. Passed in rather than
		// reached through a global so the templates can be rendered outside Foundry for preview.
		tmpcontext.config = {
			creatureTypes: CREATURE_TYPES,
			bodyTypes: CREATURE_BODY_TYPES,
			attackCharts: CREATURE_ATTACK_CHARTS,
			sizes: CREATURE_SIZES,
			bodyAreaTypes: BODY_AREA_TYPES,
			bodyMultipliers: BODY_AREA_MULTIPLIERS.map(([tmplabel]) => tmplabel)
		};

		// @MARKER AUTHORING CONTEXT
		// The movement modes with their place in the list, so a row knows whether it can move up or
		// down; the body chart as editable rows when the creature has its own; and whether the
		// modifiers panel is open, which is the sheet's own state, as the martial panel's is.
		tmpcontext.movementRows = ImagineCreatureSheet.#buildMovementRows(this.document.system);
		tmpcontext.bodyChart = ImagineCreatureSheet.#buildBodyChart(this.document.system);
		tmpcontext.modifiers = ImagineCreatureSheet.#buildModifierRows(this.document.system);
		tmpcontext.modifiersOpen = !!this._modifiersOpen;

		tmpcontext.handednessChoices =
			ImagineCreatureSheet.#buildHandednessChoices(this.document.system.identity.handedness);

		// The Situation Mods bar, one line -- his creature page carries the same bar.
		tmpcontext.situationLine = describeSituationalTotals(this.document.system.combat.situational);

		// The martial arts panel, the same partial and view the character's Combat tab uses.
		tmpcontext.martial = buildMartialPanel(this.document.system, !!this._martialOpen);
		await loadMartialTemplates();

		// @MARKER ROUND CLOCK
		// The round clock on the Combat tab, as the character sheet shows it: live in the combat on
		// show, the off hand's plain allowance otherwise. See the character sheet's note.
		tmpcontext.roundClock = getActorSheetClock(this.document);
		this._imagineClockShown = tmpcontext.roundClock.inCombat;

		return tmpcontext;
	}

	// This is the function which builds the handedness dropdown. A shield is held in the off hand,
	// so which one a character favours decides which side of the body it covers. His sheet takes
	// the same three values, set from a race's abilities (sheet-worker.js:49203); anything that is
	// not exactly "Left" is treated as right-handed by his equipShield, blank included.
	static #buildHandednessChoices(tmpcurrent) {
		const tmpchoices = [
			{ value: "",             label: "Right (default)" },
			{ value: "Right",        label: "Right" },
			{ value: "Left",         label: "Left" },
			{ value: "Ambidextrous", label: "Ambidextrous (shields right)" }
		];
		for (const tmpchoice of tmpchoices) {
			tmpchoice.selected = (tmpchoice.value == ("" + (tmpcurrent ?? "")));
		}
		return tmpchoices;
	}

	// This is the function which flattens the twelve attributes into rows, in the Player's Guide's
	// order and grouping. Same shape the character sheet builds, so the markup matches.
	static #buildAttributeRows(tmpsystem) {
		const tmpgroups = [
			{ label: "Physical", keys: ["str", "agl", "vit"] },
			{ label: "Mental",   keys: ["int", "wis", "knw"] },
			{ label: "Personal", keys: ["app", "chm", "soc"] },
			{ label: "Mystical", keys: ["aur", "pty", "wil"] }
		];

		var tmprows = [];
		for (const tmpgroup of tmpgroups) {
			for (const tmpkey of tmpgroup.keys) {
				var tmpattrib = tmpsystem.attributes[tmpkey];
				tmprows.push({
					key: tmpkey,
					group: tmpgroup.label,
					label: `IMAGINE.Attribute.${tmpkey}`,
					rating: tmpattrib.rating,
					value: tmpattrib.value,
					max: tmpattrib.max,
					save: tmpattrib.save,
					mods: Object.entries(tmpattrib.mods ?? {}).map(([k, v]) => ({ key: k, value: v }))
				});
			}
		}
		return tmprows;
	}

	// This is the function which lists the movement modes with their index and whether each can move
	// up or down -- his Configurator asks for them slowest first, special modes last (HTML 81003-81007).
	static #buildMovementRows(tmpsystem) {
		var tmplist = tmpsystem.movement?.modes ?? [];
		return tmplist.map((tmpmode, tmpindex) => ({
			index: tmpindex, name: tmpmode.name, hourly: tmpmode.hourly, tenSec: tmpmode.tenSec, oneSec: tmpmode.oneSec,
			first: tmpindex == 0, last: tmpindex == tmplist.length - 1
		}));
	}

	// This is the function which says what the Combat tab's body controls show. With no chart of its
	// own the creature uses its body type's stock chart, and the rows are not editable until "Edit
	// areas" copies that chart into the creature; once it has its own, every row is an input.
	static #buildBodyChart(tmpsystem) {
		var tmpstored = String(tmpsystem.body?.bodyChart ?? "").trim();
		var tmpbodytype = tmpsystem.body?.bodyType || "Humanoid";
		return {
			own: !!tmpstored,
			rows: readBodyChartRows(tmpstored).map((tmprow, tmpindex) => ({ ...tmprow, index: tmpindex })),
			hasStock: !!getStockBodyChart(tmpbodytype),
			isCustom: tmpbodytype == "Custom"
		};
	}

	// This is the function which lays out the modifiers panel: every manual adjustment the creature's
	// schema already carries and no template ever showed -- his GM Tools and Magic/Lore tabs hold the
	// same temporary modifiers (HTML 84286 onward, 70414 onward). Each row names the field it writes.
	static #buildModifierRows(tmpsystem) {
		const tmpattributes = [["str", "Strength"], ["agl", "Agility"], ["vit", "Vitality"],
			["int", "Intelligence"], ["wis", "Wisdom"], ["knw", "Knowledge"],
			["app", "Appearance"], ["chm", "Charm"], ["soc", "Social Class"],
			["aur", "Aura"], ["pty", "Piety"], ["wil", "Will Force"]];
		const tmpcombat = [
			//  field              label                what it reaches
			["meleeMisc",      "Melee to hit",      "every melee-kind attack"],
			["missileMisc",    "Missile to hit",    "every missile-kind attack"],
			["damageMisc",     "Damage",            "every attack but a touch"],
			["defenseMisc",    "Defence",           "the creature's defensive adjustment"],
			["initiativeMisc", "Initiative",        "the initiative modifier"]
		];
		return {
			attributes: tmpattributes.map(([tmpkey, tmplabel]) => ({
				key: tmpkey, label: tmplabel,
				permMod: tmpsystem.attributes[tmpkey]?.permMod ?? 0,
				tempMod: tmpsystem.attributes[tmpkey]?.tempMod ?? 0
			})),
			characteristics: ["endurance", "perception", "affinity", "fortune"].map(tmpkey => ({
				key: tmpkey, label: tmpkey.charAt(0).toUpperCase() + tmpkey.slice(1),
				tempMod: tmpsystem.characteristics[tmpkey]?.tempMod ?? 0
			})),
			resistances: Object.entries(tmpsystem.resistances ?? {}).map(([tmpkey, tmpresist]) => ({
				key: tmpkey, label: tmpkey.charAt(0).toUpperCase() + tmpkey.slice(1),
				tempMod: tmpresist.tempMod ?? 0, permMod: tmpresist.permMod ?? 0
			})),
			combat: tmpcombat.map(([tmpkey, tmplabel, tmpnote]) => ({
				key: tmpkey, label: tmplabel, note: tmpnote, value: tmpsystem.combat?.[tmpkey] ?? 0
			}))
		};
	}

	// This is the function which lists the creature's skills, with their index, so a row can be
	// written back to the right entry in the stored list.
	static #buildSkillRows(tmpsystem) {
		var tmprows = [];
		var tmplist = tmpsystem.skills ?? [];
		for (var i = 0; i < tmplist.length; i++) {
			tmprows.push({ index: i, name: tmplist[i].name, chance: tmplist[i].chance });
		}
		return tmprows;
	}

	// This is the function which lists the creature's natural attacks, with how long each takes
	// and the rider effects it carries.
	static #buildAttackRows(tmpactor) {
		var tmprows = [];
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "creatureAttack") { continue; }
			var tmpa = tmpitem.system;
			tmprows.push({
				id: tmpitem.id,
				name: tmpitem.name,
				attackType: tmpa.attackType,
				damage: tmpa.damage,
				damageType: tmpa.damageType,
				speed: tmpa.speedSpecial ? "Special" : tmpa.speed,
				minSpeed: tmpa.speedSpecial ? "" : tmpa.effectiveMinSpeed,
				effects: tmpa.effects ?? [],
				available: tmpa.available !== false,
				unavailableReason: tmpa.unavailableReason ?? "",
				// Blank means not hand-based at all -- a bite, a tail slap -- and is never off-hand.
				hand: tmpa.hand,
				offhand: tmpa.hand
					? isOffhandWeapon(tmpa.hand, tmpactor.system.combat?.offhandHandedness) : false
			});
		}
		return tmprows.sort((a, b) => a.name.localeCompare(b.name));
	}

	// This is the function which groups the creature's traits by category. Abilities,
	// disabilities and immunities are one item type separated by a category field, because they
	// are one shape in his data.
	static #buildTraitRows(tmpactor) {
		var tmpout = { ability: [], disability: [], immunity: [] };
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "trait") { continue; }
			var tmpt = tmpitem.system;
			var tmprow = {
				id: tmpitem.id,
				name: tmpitem.name,
				canonicalName: tmpt.canonicalName,
				value1: tmpt.value1,
				value2: tmpt.value2,
				description: tmpt.description,
				available: tmpt.available !== false,
				unavailableReason: tmpt.unavailableReason ?? ""
			};
			if (tmpout[tmpt.category]) { tmpout[tmpt.category].push(tmprow); }
		}
		for (const tmpkey of Object.keys(tmpout)) {
			tmpout[tmpkey].sort((a, b) => a.name.localeCompare(b.name));
		}
		return tmpout;
	}

	// This is the function which lists the creature's Powers and how many uses are left.
	static #buildPowerRows(tmpactor) {
		var tmprows = [];
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "power") { continue; }
			var tmpp = tmpitem.system;
			tmprows.push({
				id: tmpitem.id,
				name: tmpitem.name,
				unlimited: tmpp.unlimited,
				uses: tmpp.uses,
				usesMax: tmpp.usesMax,
				selfOnly: tmpp.selfOnly,
				powerKind: tmpp.powerKind,
				hasUseLeft: tmpp.hasUseLeft,
				available: tmpp.available !== false,
				unavailableReason: tmpp.unavailableReason ?? ""
			});
		}
		return tmprows.sort((a, b) => a.name.localeCompare(b.name));
	}

	// @MARKER ACTION HANDLERS

	// This is the function which rolls an attribute save. Same rule as a character's: a save
	// succeeds on a percentile roll at or under the chance, and succeeding by half or better is
	// a distinct and better result, which is how his sheet reports it.
	static async #onRollAttributeSave(event, target) {
		var tmpkey = target.dataset.attribute;
		var tmpattrib = this.document.system.attributes[tmpkey];
		if (!tmpattrib) { return; }

		var tmproll = await new Roll("1d100").evaluate();
		var tmpchance = tmpattrib.save;
		var tmphalf = Math.floor(tmpchance / 2);

		var tmpoutcome = "Failed";
		if (tmproll.total <= tmphalf)        { tmpoutcome = "Succeeded by half"; }
		else if (tmproll.total <= tmpchance) { tmpoutcome = "Succeeded"; }

		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `${game.i18n.localize(`IMAGINE.Attribute.${tmpkey}`)} Save &mdash; ${tmpchance}% &mdash; <strong>${tmpoutcome}</strong>`
		});
	}

	// @MARKER RESISTANCE ROLL
	// The same roll the character sheet offers, and the same rule module. A creature's five
	// resistances are figures its stat block states rather than derived ones, but they are rolled
	// against identically, and a Game Master rolling a creature's Poison resistance wants the same
	// card a player gets. Shift-click asks for a modifier.
	static async #onRollResistance(event, target) {
		var tmpkey = target.dataset.resistance;
		var tmpresist = this.document.system.resistances[tmpkey];
		if (!tmpresist) { return; }

		var tmpmodifier = 0;
		if (event.shiftKey) {
			var tmpanswer = await foundry.applications.api.DialogV2.prompt({
				window: { title: "Resistance Modifier" },
				content: `<p>Modifier to this ${tmpkey} resistance roll:</p>
					<input type="number" name="modifier" value="0" autofocus>`,
				ok: { label: "Roll", callback: (tmpevent, tmpbutton) => tmpbutton.form.elements.modifier.value }
			}).catch(() => null);
			if (tmpanswer === null) { return; }
			tmpmodifier = parseInt(tmpanswer) || 0;
		}

		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveResistanceRoll(tmpresist.value, tmproll.total, tmpresist.immune, tmpmodifier);
		var tmplabel = tmpkey.charAt(0).toUpperCase() + tmpkey.slice(1);

		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: describeResistanceRoll(tmplabel, tmpresult)
		});
	}

	// @MARKER CHARACTERISTIC ROLL
	// Perception (and double Perception), Affinity and Fortune -- his creature header's ROLL, DBL and
	// MOD buttons (roll_creature_per and its siblings, sheet-worker.js:24510-24648; HTML 57780-57791).
	// The header showed the three figures and gave no way to roll them. The same three-way reading the
	// character sheet's buttons give (bug report 0.18.1:1), worked out by resolveCharacteristicRoll in
	// creature-sheet-rules.mjs. His separate MOD buttons are a shift-click here, as the resistance
	// rolls' are.
	static async #onRollCharacteristic(event, target) {
		var tmpkey = target.dataset.characteristic;
		var tmpbase = parseInt(this.document.system.characteristics[tmpkey]?.value) || 0;
		var tmpdouble = target.dataset.double === "true";

		var tmpmodifier = 0;
		if (event.shiftKey) {
			var tmpanswer = await ImagineCreatureSheet.#askModifier(`Modifier to this ${tmpkey} roll:`);
			if (tmpanswer === null) { return; }
			tmpmodifier = tmpanswer;
		}

		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveCharacteristicRoll(tmpkey, tmpbase, tmproll.total, tmpdouble, tmpmodifier);
		if (!tmpresult) { return; }
		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `${tmpresult.label} Check &mdash; ${tmpresult.chance}%${tmpmodifier
				? ` (modifier ${tmpmodifier > 0 ? "+" : ""}${tmpmodifier})` : ""} &mdash; <strong>${tmpresult.outcome}</strong>`
		});
	}

	// This is the function which asks for a modifier to a roll -- his "?{Modifier}" prompt. Returns
	// the number, or null if the dialog was closed.
	static async #askModifier(tmpprompt) {
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: "Roll Modifier" },
			content: `<p>${tmpprompt}</p><input type="number" name="modifier" value="0" autofocus>`,
			ok: { label: "Roll", callback: (tmpevent, tmpbutton) => tmpbutton.form.elements.modifier.value }
		}).catch(() => null);
		if (tmpanswer === null || tmpanswer === undefined) { return null; }
		return parseInt(tmpanswer) || 0;
	}

	// This is the function which rolls one of the creature's skills.
	//
	// A creature's skill chance is the flat percentage its stat block states, not something
	// worked out from attributes, so there is nothing to compute here. The outcome follows the
	// Player's Guide p.93 rule the character sheet uses: at or under the chance succeeds, and a
	// margin of more than 20% either way is critical.
	//
	// Shift-click asks for a modifier first -- his skill-rollmod button (sheet-worker.js:24660,
	// handleCreatureSkillRollMod at 175399), which adds it to the chance.
	static async #onRollCreatureSkill(event, target) {
		var tmpindex = parseInt(target.dataset.skillIndex);
		var tmpskill = this.document.system.skills?.[tmpindex];
		if (!tmpskill) { return; }

		var tmpmodifier = 0;
		if (event.shiftKey) {
			var tmpanswer = await ImagineCreatureSheet.#askModifier(`Modifier to ${foundry.utils.escapeHTML(String(tmpskill.name ?? ""))}:`);
			if (tmpanswer === null) { return; }
			tmpmodifier = tmpanswer;
		}

		// A held martial stance's bonus to this skill (the user's ruling of 2026-09-22). A creature's
		// chance is its entered figure, so the bonus is added here rather than derived onto it.
		var tmpstancebonus = getStanceSkillBonus(this.document.system.martial?.state?.bonuses, tmpskill.name, []);
		var tmpchance = (parseInt(tmpskill.chance) || 0) + tmpstancebonus + tmpmodifier;
		var tmproll = await new Roll("1d100").evaluate();
		var tmpmargin = tmpchance - tmproll.total;

		var tmpoutcome = "Failed";
		if (tmproll.total <= tmpchance) {
			tmpoutcome = (tmpmargin > 20) ? "Critical success" : "Succeeded";
		} else {
			tmpoutcome = (tmpmargin < -20) ? "Critical failure" : "Failed";
		}

		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `${foundry.utils.escapeHTML(String(tmpskill.name ?? ""))} &mdash; ${tmpchance}%${tmpstancebonus ? ` (stance +${tmpstancebonus})` : ""}`
				+ `${tmpmodifier ? ` (modifier ${tmpmodifier > 0 ? "+" : ""}${tmpmodifier})` : ""} &mdash; <strong>${tmpoutcome}</strong>`
		});
	}

	// This is the function which makes one of the creature's natural attacks.
	static async #onRollCreatureAttack(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }
		if (!game.imagine?.rollCreatureAttack) {
			ui.notifications.warn("Creature attacks are not available in this world.");
			return;
		}
		await game.imagine.rollCreatureAttack(this.document, tmpitem);
	}

	// This is the function which opens the Situation Mods window, reached through game.imagine
	// as the attack roll is.
	static async #onOpenSituation(event, target) {
		event.preventDefault();
		game.imagine?.situationMods(this.document);
	}

	// This is the function which clears every Situation Mod -- his "Clear all modifiers".
	static async #onClearSituation(event, target) {
		event.preventDefault();
		await this.document.update({ "system.combat.situation.kind": "", "system.combat.situation.selected": [] });
	}

	// This is the function which sets which limb an attack comes from -- or clears it back to
	// blank, for an attack that is not hand-based at all and must never read as off-hand.
	static async #onSetAttackHand(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }
		await tmpitem.update({ "system.hand": target.dataset.hand });
	}

	// This is the function which uses one of the creature's Powers.
	//
	// A Power is an innate spell or invocation, and actually resolving one needs the spell and
	// invocation engine, which is the deferred magic phase. So this spends the use and reports
	// what was used, and says plainly that the effect is not being worked out -- rather than
	// pretending to cast it.
	static async #onUsePower(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }
		var tmppower = tmpitem.system;

		if (!tmppower.hasUseLeft) {
			ui.notifications.warn(`${tmpitem.name} has no uses left.`);
			return;
		}

		if (!tmppower.unlimited) {
			await tmpitem.update({ "system.uses": Math.max(0, (parseInt(tmppower.uses) || 0) - 1) });
		}

		var tmpremaining = tmppower.unlimited
			? "unlimited"
			: `${Math.max(0, (parseInt(tmppower.uses) || 0) - 1)} of ${tmppower.usesMax}`;

		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			content: `<div class="imagine-chat power-use">
				<p><strong>${this.document.name}</strong> uses <strong>${tmpitem.name}</strong>
				at level ${this.document.system.identity.powerLevel}${tmppower.selfOnly ? ", on itself" : ""}.</p>
				<p class="muted">Uses left: ${tmpremaining}.</p>
				${tmppower.description ? `<div class="power-text">${tmppower.description}</div>` : ""}
				<p class="muted">A Power is an innate spell or invocation. Working out its effect needs the
				magic phase, which is not built yet, so the Game Master resolves it.</p>
			</div>`
		});
	}

	//==============================================================================================
	// @MARKER AUTHORING
	//==============================================================================================
	// Building and changing a creature on its own sheet. Each handler writes one field or one item;
	// the list arithmetic is in creature-sheet-rules.mjs.

	// This is the function which puts a new attack, power or trait on the creature and opens its sheet,
	// because a blank "New Attack" is not what anyone wanted -- its sheet is where it becomes a Bite.
	// data-type is the item type (creatureAttack, power, trait) and data-category a trait's kind
	// (ability, disability, immunity). Dragging from the Imagine Abilities, Disabilities and Immunities
	// compendia still works and is the better route for anything his dictionaries already hold.
	static async #onCreateCreatureItem(event, target) {
		event.preventDefault();
		const tmpnames = {
			//  type / category       name
			creatureAttack: "New Attack",
			power:          "New Power",
			ability:        "New Ability",
			disability:     "New Disability",
			immunity:       "New Immunity"
		};
		var tmptype = target.dataset.type;
		if (!["creatureAttack", "power", "trait"].includes(tmptype)) { return; }
		var tmpcategory = target.dataset.category || "ability";
		var tmpdata = { name: tmpnames[tmptype == "trait" ? tmpcategory : tmptype] ?? "New Item", type: tmptype };
		if (tmptype == "trait") { tmpdata.system = { category: tmpcategory }; }
		var tmpcreated = await this.document.createEmbeddedDocuments("Item", [tmpdata]);
		if (tmpcreated?.length) { tmpcreated[0].sheet.render(true); }
	}

	// This is the function which adds an empty skill row, a name and a flat percentage, as his
	// creature skills are (repeating_creatureskills). The row's inputs name it.
	static async #onAddSkill(event, target) {
		event.preventDefault();
		var tmpskills = [...(this.document.system._source?.skills ?? this.document.system.skills ?? [])];
		tmpskills.push({ name: "", chance: 0 });
		await this.document.update({ "system.skills": tmpskills });
	}

	static async #onRemoveSkill(event, target) {
		event.preventDefault();
		var tmpskills = removeListEntry(this.document.system._source?.skills ?? this.document.system.skills,
			target.dataset.skillIndex);
		await this.document.update({ "system.skills": tmpskills });
	}

	// This is the function which adds an empty movement mode -- his Configurator's "Walk, Jog, Run,
	// Gallop, Scurry, Slither, Fly, etc." with three rates each (HTML 81003-81007).
	static async #onAddMovement(event, target) {
		event.preventDefault();
		var tmpmodes = [...(this.document.system._source?.movement?.modes ?? this.document.system.movement?.modes ?? [])];
		tmpmodes.push({ name: "", hourly: 0, tenSec: 0, oneSec: 0 });
		await this.document.update({ "system.movement.modes": tmpmodes });
	}

	static async #onRemoveMovement(event, target) {
		event.preventDefault();
		var tmpmodes = removeListEntry(this.document.system._source?.movement?.modes ?? this.document.system.movement?.modes,
			target.dataset.index);
		await this.document.update({ "system.movement.modes": tmpmodes });
	}

	// Up is -1, down is +1: the order is his "slowest first, special modes last".
	static async #onMoveMovement(event, target) {
		event.preventDefault();
		var tmpmodes = moveListEntry(this.document.system._source?.movement?.modes ?? this.document.system.movement?.modes,
			target.dataset.index, target.dataset.offset);
		await this.document.update({ "system.movement.modes": tmpmodes });
	}

	// This is the function which gives the creature a body chart of its own to edit, starting from its
	// body type's stock chart -- or, for a Custom body, from one Vital area at x1, which is where his
	// custom body builder starts (new_bodyarea_type "Vital", new_bodyarea_end "x1", 22284-22287).
	static async #onCustomizeBodyChart(event, target) {
		event.preventDefault();
		var tmpstock = getStockBodyChart(this.document.system.body?.bodyType || "Humanoid");
		var tmpchart = tmpstock || serializeBodyChart([{ name: "Body", type: "Vital", multiplier: "x1" }]);
		await this.document.update({ "system.body.bodyChart": tmpchart });
	}

	// This is the function which throws the creature's own chart away and goes back to its body type's
	// stock one. Asked first: the areas it had are gone, and so is any wound recorded against an area
	// the stock chart does not have.
	static async #onResetBodyChart(event, target) {
		event.preventDefault();
		var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: "Imagine RPG" },
			content: `<p>Discard ${foundry.utils.escapeHTML(this.document.name)}'s own body chart and use the stock
				chart for its body type?</p>`,
			rejectClose: false,
			modal: true
		});
		if (tmpconfirmed) { await this.document.update({ "system.body.bodyChart": "" }); }
	}

	// Adding and removing an area of the creature's own chart: his ADD and REMOVE buttons on the custom
	// body builder (22296 onward). A new area goes on the end -- his note reads "add custom body areas
	// in order (head to feet)" -- and a Limb at x1 is the commonest thing to add.
	static async #onAddBodyArea(event, target) {
		event.preventDefault();
		var tmprows = readBodyChartRows(this.document.system.body?.bodyChart);
		tmprows.push({ name: "New Area", type: "Limb", multiplier: "x1" });
		await this.document.update({ "system.body.bodyChart": serializeBodyChart(tmprows) });
	}

	static async #onRemoveBodyArea(event, target) {
		event.preventDefault();
		var tmprows = removeListEntry(readBodyChartRows(this.document.system.body?.bodyChart), target.dataset.index);
		await this.document.update({ "system.body.bodyChart": serializeBodyChart(tmprows) });
	}

	// This is the function which opens and closes the Stats tab's modifiers panel. Its state is the
	// sheet's own, as the martial panel's is, so it survives the re-render every edit causes.
	static async #onToggleModifiers(event, target) {
		event.preventDefault();
		this._modifiersOpen = !this._modifiersOpen;
		this.render({ parts: ["stats"] });
	}

	//==============================================================================================
	// @MARKER MARTIAL ARTS
	//==============================================================================================
	// The same martial arts panel the character's Combat tab has, for a creature that holds Martial
	// Knowledge -- his creature sheet carries the same section. The rolls in martial-attack.mjs read
	// only what both actor types have (system.martial, the attack chart, Agility's save and missile
	// modifier, Strength's melee figures), so they are called unchanged. The panel's open state is the
	// sheet's own, as it is on the character's.
	static async #onToggleMartialPanel(event, target) {
		event.preventDefault();
		this._martialOpen = !this._martialOpen;
		this.render({ parts: ["combat"] });
	}

	static async #onRollMartialAttack(event, target) {
		await rollMartialAttack(this.document, target.dataset.name);
	}

	static async #onRollMartialSubskill(event, target) {
		await rollMartialSubskill(this.document, target.dataset.family, target.dataset.name, event);
	}

	static async #onRollMartialMove(event, target) {
		await rollMartialMove(this.document, target.dataset.name, event);
	}

	static async #onRollMartialLoreValue(event, target) {
		await rollMartialLoreValue(this.document, target.dataset.name, event);
	}

	// This is the function which marks a move made or clears it by hand -- the Game Master's way of
	// saying "that happened".
	static async #onToggleMartialMove(event, target) {
		var tmplist = parseMartialList(this.document.system.martial?.activeMoves);
		var tmpname = target.dataset.name;
		tmplist = tmplist.includes(tmpname) ? tmplist.filter(n => n != tmpname) : [...tmplist, tmpname];
		await this.document.update({ "system.martial.activeMoves": tmplist.join(",") });
	}

	static async #onToggleMartialLoreValue(event, target) {
		var tmplist = parseMartialList(this.document.system.martial?.activeLoreValues);
		var tmpname = target.dataset.name;
		tmplist = tmplist.includes(tmpname) ? tmplist.filter(n => n != tmpname) : [...tmplist, tmpname];
		await this.document.update({ "system.martial.activeLoreValues": tmplist.join(",") });
	}

	static async #onClearMartialMoves(event, target) {
		await this.document.update({ "system.martial.activeMoves": "", "system.martial.activeLoreValues": "" });
	}

	static async #onLearnMartialStance(event, target) { await learnMartialStance(this.document); }
	static async #onMasterMartialStance(event, target) { await masterMartialStance(this.document); }
	static async #onLearnMartialSubskill(event, target) { await learnMartialSubskill(this.document); }
	static async #onLearnMartialLoreValue(event, target) { await learnMartialLoreValue(this.document); }
}
// @END (CODE)
