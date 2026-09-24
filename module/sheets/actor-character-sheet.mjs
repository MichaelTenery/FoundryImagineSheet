// @START (CODE)
// @MARKER CHARACTER SHEET
//==================================================================================================================
// The character sheet, built on ApplicationV2 with the Handlebars mixin.
//
// Every tab is its own PART with a single root element. That is not a style preference -- the
// framework's two-pass rendering relies on it to preserve focus and scroll position, and a
// shared container with swapped-in placeholders breaks both. On a sheet this field-dense,
// losing focus mid-edit every time a value recalculates would make it unusable.
//
// Interactions are declared with data-action attributes rather than bound by hand, and the
// handlers are static methods on the class.
//==================================================================================================================

import { rollWeaponAttack } from "../combat/attack.mjs";
import { chooseBestArmor } from "../equip-rules.mjs";
import { GEM_TYPES, COIN_TYPES, getWealthInGold, changeCoins, changeValuables } from "../wealth-rules.mjs";
import { canRollStartingMoney, getCharacterMoneyInputs, rollStartingMoney, describeStartingMoney } from "../starting-money.mjs";
import { rollHandedness } from "../chargen-rules.mjs";
import { grantNaturalWeapons, getMissingNaturalWeaponNames } from "../natural-weapons.mjs";
import { getWeaponSpeed, getLoreModifiers, resolveOffhandPenalties,
         getSecondWeaponFlags, resolveMissileComboAcquisition, isThrownWeapon, isProjectileWeapon,
         isLauncherWeapon } from "../combat/combat-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";
import { describeSituationalTotals } from "../situational-view.mjs";
import { resolveResistanceRoll, describeResistanceRoll } from "../resistance-rules.mjs";
import ImagineItemPicker from "../apps/item-picker.mjs";
import { buildMagicPanel } from "../magic-view.mjs";
import { useConsumable, addDose, toggleMemorized, useLore, brewRecipe, addPoison,
         postMagic } from "../magic-actions.mjs";
import { provideStartingLore } from "../starting-lore.mjs";
import { castSpell, invokeInvocation, prayForInvocation, resetAuraPool, regenerateAura,
         removeMagicEffect } from "../casting-actions.mjs";
import { getWeaponCustomTags, getWeaponDisplayName, getCustomizedWeapon } from "../weapon-custom-rules.mjs";
import ImagineWeaponMods from "../apps/weapon-mods.mjs";
import { rollMartialAttack, rollMartialSubskill, rollMartialMove, rollMartialLoreValue,
         learnMartialStance, masterMartialStance, learnMartialSubskill,
         learnMartialLoreValue, loadMartialTemplates } from "../combat/martial-attack.mjs";
import { parseMartialList } from "../combat/martial-arts.mjs";
import { buildMartialPanel } from "../martial-view.mjs";
import { getActorSheetClock } from "../apps/round-clock.mjs";
import {
	resolveSkillOutcome, pickBestSkillRoll, canTransferSlot, canSacrificeSlot,
	SLOT_TRANSFERS, SLOT_SACRIFICE_DICE, SACRIFICEABLE_SLOTS
} from "../skills-rules.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export default class ImagineCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
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


	static DEFAULT_OPTIONS = {
		classes: ["imagine", "sheet", "actor", "character"],
		position: { width: 820, height: 720 },
		window: { resizable: true },
		form: { submitOnChange: true },
		actions: {
			// The Magic & Lore tab, all in the @MARKER MAGIC AND LORE block below; what each does is
			// in module/magic-actions.mjs.
			addMagic: ImagineCharacterSheet.#onAddMagic,
			addOtherMagic: ImagineCharacterSheet.#onAddOtherMagic,
			useConsumable: ImagineCharacterSheet.#onUseConsumable,
			addDose: ImagineCharacterSheet.#onAddDose,
			toggleMemorized: ImagineCharacterSheet.#onToggleMemorized,
			useLore: ImagineCharacterSheet.#onUseLore,
			brewRecipe: ImagineCharacterSheet.#onBrewRecipe,
			postMagic: ImagineCharacterSheet.#onPostMagic,
			// Casting and invoking -- module/casting-actions.mjs.
			castSpell: ImagineCharacterSheet.#onCastSpell,
			toggleMastered: ImagineCharacterSheet.#onToggleMastered,
			invokeInvocation: ImagineCharacterSheet.#onInvokeInvocation,
			prayForInvocation: ImagineCharacterSheet.#onPrayForInvocation,
			resetAuraPool: ImagineCharacterSheet.#onResetAuraPool,
			regenerateAura: ImagineCharacterSheet.#onRegenerateAura,
			removeMagicEffect: ImagineCharacterSheet.#onRemoveMagicEffect,
			provideStartingLore: ImagineCharacterSheet.#onProvideStartingLore,
			openWeaponMods: ImagineCharacterSheet.#onOpenWeaponMods,
			rollAttributeSave: ImagineCharacterSheet.#onRollAttributeSave,
			rollResistance: ImagineCharacterSheet.#onRollResistance,
			rollCharacteristic: ImagineCharacterSheet.#onRollCharacteristic,
			rollSkill: ImagineCharacterSheet.#onRollSkill,
			rollWeaponAttack: ImagineCharacterSheet.#onRollWeaponAttack,
			setWeaponHand: ImagineCharacterSheet.#onSetWeaponHand,
			rollUntrainedSkill: ImagineCharacterSheet.#onRollUntrainedSkill,
			stepClassTitle: ImagineCharacterSheet.#onStepClassTitle,
			openLevelUp: ImagineCharacterSheet.#onOpenLevelUp,
			openSituation: ImagineCharacterSheet.#onOpenSituation,
			clearSituation: ImagineCharacterSheet.#onClearSituation,
			transferSlot: ImagineCharacterSheet.#onTransferSlot,
			sacrificeSlot: ImagineCharacterSheet.#onSacrificeSlot,
			addLanguage: ImagineCharacterSheet.#onAddLanguage,
			deleteLanguage: ImagineCharacterSheet.#onDeleteLanguage,
			createGear: ImagineCharacterSheet.#onCreateGear,
			openItem: ImagineCharacterSheet.#onOpenItem,
			deleteItem: ImagineCharacterSheet.#onDeleteItem,
				removeAllArms: ImagineCharacterSheet.#onRemoveAllArms,
				equipBestArmor: ImagineCharacterSheet.#onEquipBestArmor,
				changeWealth: ImagineCharacterSheet.#onChangeWealth,
				rollStartingMoney: ImagineCharacterSheet.#onRollStartingMoney,
				rollHandedness: ImagineCharacterSheet.#onRollHandedness,
				grantNaturalWeapons: ImagineCharacterSheet.#onGrantNaturalWeapons,
				learnMissileCombo: ImagineCharacterSheet.#onLearnMissileCombo,
			// Martial arts, all in the @MARKER MARTIAL ARTS block at the foot of this class.
			toggleMartialPanel: ImagineCharacterSheet.#onToggleMartialPanel,
			rollMartialAttack: ImagineCharacterSheet.#onRollMartialAttack,
			rollMartialSubskill: ImagineCharacterSheet.#onRollMartialSubskill,
			rollMartialMove: ImagineCharacterSheet.#onRollMartialMove,
			toggleMartialMove: ImagineCharacterSheet.#onToggleMartialMove,
			rollMartialLoreValue: ImagineCharacterSheet.#onRollMartialLoreValue,
			toggleMartialLoreValue: ImagineCharacterSheet.#onToggleMartialLoreValue,
			clearMartialMoves: ImagineCharacterSheet.#onClearMartialMoves,
			learnMartialStance: ImagineCharacterSheet.#onLearnMartialStance,
			masterMartialStance: ImagineCharacterSheet.#onMasterMartialStance,
			learnMartialSubskill: ImagineCharacterSheet.#onLearnMartialSubskill,
			learnMartialLoreValue: ImagineCharacterSheet.#onLearnMartialLoreValue
		}
	};

	// @MARKER SHEET PARTS
	// Header first, then the tab strip, then one part per tab.
	static PARTS = {
		header:      { template: "systems/imagine-rpg/templates/actor/header.hbs" },
		tabs:        { template: "templates/generic/tab-navigation.hbs" },
		attributes:  { template: "systems/imagine-rpg/templates/actor/tab-attributes.hbs", scrollable: [""] },
		skills:      { template: "systems/imagine-rpg/templates/actor/tab-skills.hbs", scrollable: [""] },
		combat:      { template: "systems/imagine-rpg/templates/actor/tab-combat.hbs", scrollable: [""] },
		equipment:   { template: "systems/imagine-rpg/templates/actor/tab-equipment.hbs", scrollable: [""] },
		description: { template: "systems/imagine-rpg/templates/actor/tab-description.hbs", scrollable: [""] },
		magic:       { template: "systems/imagine-rpg/templates/actor/tab-magic.hbs", scrollable: [""] }
	};

	static TABS = {
		primary: {
			tabs: [
				{ id: "attributes",  icon: "fa-solid fa-dice-d20" },
				{ id: "skills",      icon: "fa-solid fa-list-check" },
				{ id: "combat",      icon: "fa-solid fa-khanda" },
				{ id: "equipment",   icon: "fa-solid fa-sack" },
				{ id: "description", icon: "fa-solid fa-scroll" },
				// His Magic/Lore tab ("e", sheet-magiclore): consumables, lores, spells, invocations.
				{ id: "magic",       icon: "fa-solid fa-hat-wizard" }
			],
			initial: "attributes",
			labelPrefix: "IMAGINE.Tab"
		}
	};

	// This is the function which assembles the data every template renders against.
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);

		tmpcontext.actor = this.document;
		tmpcontext.system = this.document.system;
		tmpcontext.attributes = ImagineCharacterSheet.#buildAttributeRows(this.document.system);
		tmpcontext.skills = ImagineCharacterSheet.#buildSkillRows(this.document);
		tmpcontext.gear = this.document.items.filter(i =>
			["weapon", "armor", "equipment"].includes(i.type));
		tmpcontext.weapons = ImagineCharacterSheet.#buildWeaponRows(this.document);
		// The natural weapons the race gives and the character does not hold: a character made before
		// natural weapons existed, or one whose race was changed. The Equipment tab offers to add them.
		tmpcontext.missingNaturalWeapons = getMissingNaturalWeaponNames(
			this.document.items.filter(tmpitem => tmpitem.type == "race").map(tmpitem => tmpitem.system),
			this.document.items.filter(tmpitem => tmpitem.type == "weapon").map(tmpitem => tmpitem.name));
		// Handedness is rolled rather than chosen unless the Game Master has ticked the setting,
		// so the dropdown is built only when it will actually be shown -- see the @MARKER
		// HANDEDNESS note in imagine-rpg.mjs for why rolling is the default.
		tmpcontext.handednessSelectable = game.settings.get("imagine-rpg", "handednessSelectable");
		tmpcontext.handednessChoices =
			ImagineCharacterSheet.#buildHandednessChoices(this.document.system.physical.handedness);
		tmpcontext.handednessLabel = ImagineCharacterSheet.#buildHandednessChoices(
			this.document.system.physical.handedness).find(tmpchoice => tmpchoice.selected)?.label ?? "Right (default)";
		// A GME picks its attack chart outright; the same selected-flag list the handedness
		// dropdown uses, so it renders the same way everywhere.
		tmpcontext.chosenAttackSkillChoices = ["Beginner", "Novice", "Intermediate", "Advanced", "Expert", "Master"]
			.map(tmpskill => ({ value: tmpskill, label: tmpskill,
			                    selected: tmpskill == this.document.system.combat.chosenAttackSkill }));
		// The Magic & Lore tab, worked out in module/magic-view.mjs. The magic switches decide which
		// of its sections exist at all.
		tmpcontext.magic = buildMagicPanel(this.document, game.imagine?.getAvailabilityRules?.() ?? null, game.user?.isGM);
		tmpcontext.lore = ImagineCharacterSheet.#buildLorePanel(this.document.system);
		// The Situation Mods bar, one line, as his combat page shows it.
		tmpcontext.situationLine = describeSituationalTotals(this.document.system.combat.situational);
		tmpcontext.languages = ImagineCharacterSheet.#buildLanguageRows(this.document.system);
		// @MARKER WEALTH -- his Loose Equipment money panel, on the Equipment tab. module/wealth-rules.mjs.
		tmpcontext.wealthPanel = {
			inGold: getWealthInGold(this.document.system.wealth),
			coinTypes: COIN_TYPES.map(([tmplabel]) => tmplabel),
			gemTypes: GEM_TYPES,
			gems: (this.document.system.wealth.gems || "").split(",").map(tmpentry => tmpentry.trim()).filter(tmpentry => tmpentry),
			jewelry: (this.document.system.wealth.jewelry || "").split(",").map(tmpentry => tmpentry.trim()).filter(tmpentry => tmpentry),
			// "Roll starting money", for a character the generator never made -- canRollStartingMoney.
			canRollStart: canRollStartingMoney(this.document.system.wealth,
				this.document.getFlag?.("imagine-rpg", "startingMoney"), game.user?.isGM),
			startRecord: this.document.getFlag?.("imagine-rpg", "startingMoney") ?? ""
		};
		tmpcontext.classProgress = ImagineCharacterSheet.#buildClassProgress(this.document.system);
		tmpcontext.slotTransfers = ImagineCharacterSheet.#buildSlotTransfers(this.document);
		tmpcontext.martial = buildMartialPanel(this.document.system, !!this._martialOpen);
		// The martial panel is a partial; see loadMartialTemplates.
		await loadMartialTemplates();

		// @MARKER ROUND CLOCK
		// The round clock beside the Off-Hand Seconds box, read-only: "3 of 5 left this round" and
		// where the main hand stands while the character is in the combat on show, the plain allowance
		// otherwise. _imagineClockShown is what lets the combat tracker redraw this tab when a clock
		// changes (refreshActorSheetClocks in module/apps/round-clock.mjs).
		tmpcontext.roundClock = getActorSheetClock(this.document);
		this._imagineClockShown = tmpcontext.roundClock.inCombat;

		return tmpcontext;
	}

	// This is the function which lists every slot trick with whether it can be taken right now, so
	// one that has nothing left to spend explains itself on hover rather than failing on click.
	// The rates themselves come from SLOT_TRANSFERS and are not restated here.
	//
	// The four trades and the two sacrifices are one list because the tab shows them as one row of
	// buttons; a sacrifice carries no destination, which is what `sacrifice` marks.
	static #buildSlotTransfers(tmpactor) {
		var tmpslots = tmpactor.system.skillSlots;
		var tmpallowance = { class: tmpslots.class, racial: tmpslots.racial, social: tmpslots.social };
		var tmpused = { class: tmpslots.classUsed, racial: tmpslots.racialUsed, social: tmpslots.socialUsed };
		var tmphasskill = tmpactor.items.some(i => i.type == "skill");

		var tmprows = [];
		for (const tmpkey of Object.keys(SLOT_TRANSFERS)) {
			var tmptransfer = SLOT_TRANSFERS[tmpkey];
			var tmpcheck = canTransferSlot(tmpkey, tmpallowance, tmpused);
			tmprows.push({
				key: tmpkey, sacrifice: false,
				from: tmptransfer.from, to: tmptransfer.to,
				cost: tmptransfer.cost, gain: tmptransfer.gain,
				allowed: tmpcheck.allowed, reason: tmpcheck.reason
			});
		}

		for (const tmpcategory of SACRIFICEABLE_SLOTS) {
			var tmpsac = canSacrificeSlot(tmpcategory, tmpallowance, tmpused, tmphasskill);
			tmprows.push({
				key: tmpcategory, sacrifice: true,
				from: tmpcategory, to: `${SLOT_SACRIFICE_DICE}%`,
				cost: 1, gain: 1,
				allowed: tmpsac.allowed, reason: tmpsac.reason
			});
		}
		return tmprows;
	}

	// This is the function which shows each class's whole skill progression -- every title that
	// brings skills, which ones, and whether the character has reached it yet.
	//
	// It reads what the data model has already worked out (identity.classProgression, built by
	// buildClassProgression in class-rules.mjs), so the sheet and the character generator's preview
	// cannot drift apart. A dual-classed character gets one panel per class, each on its own title.
	//
	// ROW CORRECTED 2026-09-19: this used to read advancement.classSkills, the per-title TEXT, and
	// said in a comment that his sheet-worker carried no per-title skills. It does -- his
	// setClassSkillLists holds all 92 classes' progressions -- and classSkillList is where the
	// extraction now puts them, so every class has something to show here rather than the handful
	// authored from his Word templates.
	static #buildClassProgress(tmpsystem) {
		var tmpclasses = (tmpsystem.identity.classProgression ?? []).filter(tmpclass => tmpclass.rows.length);
		if (!tmpclasses.length) { return { show: false, classes: [], owed: 0 }; }

		return {
			show: true,
			// Named only when there is more than one, the way the title steppers are.
			showNames: tmpclasses.length > 1,
			classes: tmpclasses.map(tmpclass => ({
				name: tmpclass.name,
				title: tmpclass.title,
				rows: tmpclass.rows
			})),
			// Ordinarily zero: the grant runs on every title change. A number here means a
			// character who earned skills the grant could not give them -- worth saying so.
			owed: tmpsystem.identity.classSkillsOwed ?? 0,
			usage: tmpsystem.identity.classUsage ?? []
		};
	}

	// This is the function which numbers the character's languages so a row can be written back
	// to the right entry -- the same reason the creature attack's rider effects are numbered.
	//
	// Each row also carries the slot it sits in and its two flags, which the data model has
	// already worked out (assignLanguageSlots) -- they are only merged in here.
	static #buildLanguageRows(tmpsystem) {
		var tmpslotrows = tmpsystem.languageAllowance?.rows ?? [];
		return (tmpsystem.languages ?? []).map((tmplang, tmpindex) =>
			({ ...tmplang, ...(tmpslotrows[tmpindex] ?? {}), index: tmpindex }));
	}

	// This is the function which assembles the Lore panel. Holding Weapon or Missile Lore at all
	// comes from the class and the title, so it is derived; the two lists only name the weapons
	// singled out for the larger bonus. Built here rather than in the template because joining a
	// list and testing two flags at once both need Handlebars helpers. Foundry V14 does provide
	// them (eq, gt, lt, and, or -- confirmed against the V14 API docs 2026-09-19), so this could
	// now be done in the template; it is built here because the previews render the same file
	// through plain Handlebars, which has them only if the harness registers them.
	static #buildLorePanel(tmpsystem) {
		var tmpweapon = !!tmpsystem.combat.hasWeaponLore;
		var tmpmissile = !!tmpsystem.combat.hasMissileLore;
		var tmpprojectile = !!tmpsystem.combat.hasProjectileLore;

		// The two multi-missile lists are shown on different terms from the three above. Those
		// name weapons singled out for a LARGER bonus, so they only matter once the class has
		// granted the lore. A multi-missile combination is what makes its skill apply at all, and
		// Knowledge has no class title gating it whatever -- so the Knowledge row shows whenever
		// the character actually holds that skill, and only the Lore row waits on a title.
		var tmpknowchance = parseInt(tmpsystem.combat.multiMissileKnowChance) || 0;
		var tmpmultiknow = tmpknowchance > 0;
		var tmpmultilore = !!tmpsystem.combat.hasMultiMissileLore;

		// Second Weapon Knowledge and Lore. Both wait on a class title, and each is held in the
		// weapons named on its own list -- one more weapon for every title held in it.
		var tmpsecondknow = !!tmpsystem.combat.hasSecondWeaponKnowledge;
		var tmpsecondlore = !!tmpsystem.combat.hasSecondWeaponLore;

		var tmpkinds = [];
		if (tmpweapon) { tmpkinds.push("Weapon"); }
		if (tmpmissile) { tmpkinds.push("Missile"); }
		if (tmpprojectile) { tmpkinds.push("Projectile"); }
		if (tmpmultiknow || tmpmultilore) { tmpkinds.push("Multiple Missile"); }
		if (tmpsecondknow || tmpsecondlore) { tmpkinds.push("Second Weapon"); }

		return {
			show: tmpweapon || tmpmissile || tmpprojectile || tmpmultiknow || tmpmultilore
			   || tmpsecondknow || tmpsecondlore,
			hasWeapon: tmpweapon,
			hasMissile: tmpmissile,
			hasProjectile: tmpprojectile,
			hasMultiKnow: tmpmultiknow,
			hasMultiLore: tmpmultilore,
			hasSecondKnow: tmpsecondknow,
			hasSecondLore: tmpsecondlore,
			secondKnowText: tmpsystem.combat.secondWeaponKnowList ?? "",
			secondLoreText: tmpsystem.combat.secondWeaponLoreList ?? "",
			secondKnowChance: parseInt(tmpsystem.combat.secondWeaponKnowChance) || 0,
			secondKnowLevels: Math.floor((parseInt(tmpsystem.combat.secondWeaponKnowChance) || 0) / 20),
			secondKnowSlots: parseInt(tmpsystem.combat.secondWeaponKnowSlots) || 0,
			secondLoreSlots: parseInt(tmpsystem.combat.secondWeaponLoreSlots) || 0,
			label: tmpkinds.join(", "),
			weaponText: tmpsystem.combat.weaponLoreList ?? "",
			missileText: tmpsystem.combat.missileLoreList ?? "",
			projectileText: tmpsystem.combat.projectileLoreList ?? "",
			multiKnowText: tmpsystem.combat.multiMissileKnowList ?? "",
			multiLoreText: tmpsystem.combat.multiMissileLoreList ?? "",
			multiKnowChance: tmpknowchance,
			multiKnowLevels: Math.floor(tmpknowchance / 25)
		};
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

	// This is the function which flattens the twelve attributes into rows a template can walk,
	// keeping the Player's Guide's order and category grouping.
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
					// The modifiers each attribute contributes differ from one to the next, so
					// they are rendered as name/value pairs rather than fixed columns.
					mods: Object.entries(tmpattrib.mods ?? {}).map(([k, v]) => ({ key: k, value: v }))
				});
			}
		}
		return tmprows;
	}

	// This is the function which gathers the character's skills, grouped by category and
	// sorted by name, with the totals the actor already derived.
	static #buildSkillRows(tmpactor) {
		var tmpout = { class: [], racial: [], social: [] };

		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "skill") { continue; }
			var tmpsys = tmpitem.system;
			var tmprow = {
				id: tmpitem.id,
				name: tmpitem.name,
				attr1: tmpsys.attr1,
				attr2: tmpsys.attr2,
				skillRating: tmpsys.skillRating,
				baseChance: tmpsys.baseChance,
				totalChance: tmpsys.totalChance,
				sourcebook: tmpsys.sourcebook,
				// Flagged rather than hidden: a skill the campaign's switches disallow stays
				// visible, with the reason, so nothing vanishes from a player's sheet.
				available: tmpsys.available !== false,
				unavailableReason: tmpsys.unavailableReason ?? "",
				// A class skill whose title has not been reached: held, shown, and refused on the
				// roll -- his "this skill cannot be used before <name> title".
				usableByTitle: tmpsys.usableByTitle !== false,
				titleGateReason: tmpsys.titleGateReason ?? "",
				acquiredAtTitle: parseInt(tmpsys.acquiredAtTitle) || 0
			};
			if (tmpout[tmpsys.category]) { tmpout[tmpsys.category].push(tmprow); }
		}

		for (const tmpkey of Object.keys(tmpout)) {
			tmpout[tmpkey].sort((a, b) => a.name.localeCompare(b.name));
		}
		return tmpout;
	}

	// This is the function which lists the character's ready weapons for the Combat tab, with
	// the attack modes each allows and how long a swing takes once every speed modifier is in.
	// Only weapons equipped or carried are offered; a sword left in a stash cannot be swung.
	static #buildWeaponRows(tmpactor) {
		var tmprows = [];
		var tmpspeedmod = tmpactor.system.combat.weaponSpeedMod;
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type != "weapon") { continue; }
			// As his combat sheet carries it: customizations, quality, condition and plus worked in.
			var tmpw = getCustomizedWeapon(tmpitem.system);
			if (tmpw.location != "equipped" && tmpw.location != "carried") { continue; }
			var tmpmodes = [];
			for (const tmpmode of ["thrust", "cut", "smash", "missile"]) {
				if (tmpw[tmpmode]?.available) {
					tmpmodes.push({ mode: tmpmode, mod: tmpw[tmpmode].mod });
				}
			}
			// Lore, for whichever kind this weapon is used as. A weapon with both melee and
			// missile modes is shown by its first mode, which is how it will most often swing;
			// the attack itself works the mode out properly when it is rolled.
			var tmplore = getLoreModifiers({
				mode: tmpmodes.length ? tmpmodes[0].mode : "thrust",
				weaponName: tmpitem.name,
				hasWeaponLore: tmpactor.system.combat.hasWeaponLore,
				hasMissileLore: tmpactor.system.combat.hasMissileLore,
				weaponLoreList: tmpactor.system.combat.weaponLoreNames,
				missileLoreList: tmpactor.system.combat.missileLoreNames
			});

			// What the off hand costs with this weapon, after whichever of Second Weapon
			// Knowledge or Lore the character holds in it -- the same figures the attack uses.
			var tmpcombat = tmpactor.system.combat;
			var tmpsecond = getSecondWeaponFlags({
				weaponName: tmpitem.name,
				hasSecondWeaponKnowledge: tmpcombat.hasSecondWeaponKnowledge,
				hasSecondWeaponLore: tmpcombat.hasSecondWeaponLore,
				secondWeaponKnowList: tmpcombat.secondWeaponKnowNames,
				secondWeaponLoreList: tmpcombat.secondWeaponLoreNames
			});
			var tmpoffhand = resolveOffhandPenalties({ ...tmpw, ...tmpsecond },
				tmpactor.system.attributes?.agl?.rating, tmpactor.system.physical?.handedness,
				tmpcombat.secondWeaponKnowChance);

			tmprows.push({
				id: tmpitem.id,
				name: tmpitem.name,
				damage: tmpw.damage,
				speed: tmpw.speedSpecial ? "Special"
					: getWeaponSpeed(tmpw.speed, tmpw.minSpeed, tmpspeedmod + tmplore.speed),
				reload: tmpw.reloadSpeed || "",
				modes: tmpmodes,
				lore: tmplore.attack ? tmplore : null,
				equipped: tmpw.location == "equipped",

				// Which hand it is in, and whether that makes it the off hand for THIS character.
				// The flag is derived rather than stored, so it follows a change of handedness
				// without anything having to be re-tagged.
				hand: tmpw.hand || "right",
				offhand: tmpoffhand.offhand,
				offhandTier: tmpoffhand.tier,
				offhandTip: ImagineCharacterSheet.#describeOffhand(tmpoffhand),

				// What has been done to it -- his Customize panel's tags, and anything on it for now --
				// and its name as his panel prints it, prefix and suffix and all.
				customTags: getWeaponCustomTags(tmpw, game.time?.worldTime ?? 0),
				displayName: getWeaponDisplayName(tmpitem.name, tmpw),
				listingTip: tmpw.listingChanges?.length ? "Changed by what has been done to it: " + tmpw.listingChanges.join("; ") : ""
			});
		}
		return tmprows;
	}

	// This is the function which words an off-hand weapon's cost for its tooltip.
	static #describeOffhand(tmpoffhand) {
		if (!tmpoffhand.offhand) { return ""; }
		if (tmpoffhand.tier == "lore") { return "Off hand, Second Weapon Lore: no penalty"; }
		var tmpwho = (tmpoffhand.tier == "knowledge") ? "Off hand, Second Weapon Knowledge" : "Off hand";
		return `${tmpwho}: attack ${tmpoffhand.melee}, damage ${tmpoffhand.damage}, skills ${tmpoffhand.skill}%`;
	}

	// @MARKER ACTION HANDLERS

	// This is the function which makes a weapon attack from the Combat tab.
	static async #onRollWeaponAttack(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }
		await rollWeaponAttack(this.document, tmpitem);
	}

	// This is the function which tags a weapon as being in the left hand, the right, or both.
	//
	// The tag lives on the weapon because that is what the user asked for -- a simple selection on
	// the combat page -- and off-handedness is worked out from it against this character's
	// handedness rather than being tagged separately. Changing the tag re-renders, so the off-hand
	// marker beside the weapon follows immediately.
	//
	// Three buttons rather than a dropdown, because an ApplicationV2 data-action is dispatched
	// from a CLICK: a <select> would need its own change binding, and that cannot be verified
	// without a running Foundry V14. Buttons use the same path rollWeaponAttack already does.
	static async #onSetWeaponHand(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }
		await tmpitem.update({ "system.hand": target.dataset.hand });
	}

	// This is the function which adds a blank language row. No ceiling here, unlike the creature
	// attack's rider effects -- the Intelligence table caps how many are worth having, not how
	// many the array can hold, and that cap is the Attributes module's to enforce, not this tab's.
	//
	// Both language buttons rebuild the whole list from the character, so a name typed and not yet
	// saved -- its change event and this click arrive together -- would be written over by the old
	// list. The form is saved first, so the list read here is the one on screen (bug sweep 2026-09-23).
	static async #onAddLanguage(event, target) {
		await ImagineCharacterSheet.#saveFormFirst(this);
		var tmplanguages = [...(this.document.system.languages ?? [])];
		tmplanguages.push({ name: "", speak: true, write: false });
		await this.document.update({ "system.languages": tmplanguages });
	}

	// This is the function which saves what is typed on the sheet before a button reads the character.
	// A form that will not save (a value the model refuses) is left to say so on its own change; the
	// button still does what it was pressed for.
	static async #saveFormFirst(tmpsheet) {
		try { await tmpsheet.submit(); } catch (tmperr) { console.warn("imagine-rpg | the sheet could not be saved first", tmperr); }
	}

	// This is the function which removes one language.
	static async #onDeleteLanguage(event, target) {
		await ImagineCharacterSheet.#saveFormFirst(this);
		var tmpindex = parseInt(target.dataset.index);
		var tmplanguages = [...(this.document.system.languages ?? [])];
		if (isNaN(tmpindex) || tmpindex < 0 || tmpindex >= tmplanguages.length) { return; }
		tmplanguages.splice(tmpindex, 1);
		await this.document.update({ "system.languages": tmplanguages });
	}

	// This is the function which rolls an attribute save. A save succeeds on a percentile roll
	// equal to or under the save chance, and succeeding by half the chance or better is a
	// distinct and better result -- which is how his sheet reports it.
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

	// @MARKER CHARACTERISTIC ROLL
	// Bug report 0.18.1:1 (Blocker): the header showed Perception, Affinity and Fortune and gave no
	// way to roll them. His sheet has ROLL buttons for all three plus a DBL for Perception
	// (clicked:roll_perception and its siblings, sheet HTML ~99967). Endurance has none, there or here.
	//
	// The three-way result is the bug report's, which is newer than his handlers and goes further:
	// his Perception and Affinity are pass/fail only, and his Fortune tests the misfortune band
	// BEFORE the fortune band, so a chance over 50% could call a low roll misfortunate. Here the
	// chance is tested first, as the report orders it:
	//     roll <= chance                 -> the good result
	//     roll >  100 - (single chance)  -> the bad result
	//     anything else                  -> the neither result
	// Double Perception doubles only the chance; the Inattentive band stays 100 minus the SINGLE
	// chance, as the report writes it.
	static CHARACTERISTIC_RESULTS = {
		//  key                good                  bad                neither
		perception:     [ "Perceived",          "Inattentive",     "Nothing Perceived" ],
		affinity:       [ "Affinity ensues",    "Enmity ensues",   "Neither Affinity or Enmity" ],
		fortune:        [ "Fortunate",          "Misfortunate",    "Neither fortunate nor misfortunate" ]
	};

	static async #onRollCharacteristic(event, target) {
		var tmpkey = target.dataset.characteristic;
		var tmpresults = ImagineCharacterSheet.CHARACTERISTIC_RESULTS[tmpkey];
		if (!tmpresults) { return; }

		var tmpdouble = target.dataset.double === "true";
		var tmpbase = parseInt(this.document.system.characteristics[tmpkey]?.value) || 0;
		var tmpchance = tmpdouble ? tmpbase * 2 : tmpbase;

		var tmproll = await new Roll("1d100").evaluate();
		var tmpoutcome = tmpresults[2];
		if (tmproll.total <= tmpchance)           { tmpoutcome = tmpresults[0]; }
		else if (tmproll.total > 100 - tmpbase)   { tmpoutcome = tmpresults[1]; }

		var tmplabel = tmpkey.charAt(0).toUpperCase() + tmpkey.slice(1);
		if (tmpdouble) { tmplabel = "Double " + tmplabel; }
		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `${tmplabel} Check &mdash; ${tmpchance}% &mdash; <strong>${tmpoutcome}</strong>`
		});
	}

	// @MARKER RESISTANCE ROLL
	// Daryl's 0.11.1 Blocker: the Attributes tab showed the five resistance figures and gave no
	// way to roll any of them. The rule itself is in module/resistance-rules.mjs, beside a note on
	// the one thing his own handlers get wrong; this only rolls the die and says what happened.
	//
	// A modifier is asked for when the button is SHIFT-clicked, which is his two buttons per track
	// (roll_resist_magic and roll_resist_magic_mod) folded into one, since a sheet with five tracks
	// does not want ten buttons on it.
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

	// This is the function which rolls a skill. Player's Guide p.93: the roll succeeds on
	// equal to or under the total chance, and a margin of more than 20% either way is a
	// critical success or failure.
	// This is the function which rolls a skill, once for every copy of it the character holds.
	//
	// Player's Guide, "Duplicate Class and Racial Skills": the same skill held both racially and as
	// a class skill is rolled for each copy and the best result taken. The copies do NOT share a
	// chance -- each carries its own bonuses -- so each is rolled against its own and compared
	// afterwards, which is what pickBestSkillRoll does. Every roll is shown, not just the winner.
	//
	// Copies are found by name, which is what makes two items one skill here. His sheet matches the
	// same way when it refuses a duplicate within a category (sheet-worker.js:7017).
	static async #onRollSkill(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }

		// His handleHighTitleClassSkillRoll refuses a class skill the character's title has not
		// reached, and says so instead of rolling (sheet-worker.js:64169). The skill is on the
		// sheet before its title -- that is how his own sheet writes it -- so the refusal is here
		// rather than the row being hidden.
		if (tmpitem.system.usableByTitle === false) {
			ui.notifications.warn(`${this.document.name}: ${tmpitem.system.titleGateReason}`);
			return;
		}

		var tmpcopies = this.document.items.filter(i => i.type == "skill" && i.name == tmpitem.name);
		if (!tmpcopies.length) { tmpcopies = [tmpitem]; }

		var tmprolls = [];
		var tmpresults = [];
		for (const tmpcopy of tmpcopies) {
			var tmproll = await new Roll("1d100").evaluate();
			tmprolls.push(tmproll);
			var tmpresult = resolveSkillOutcome(tmpcopy.system.totalChance, tmproll.total);
			tmpresult.category = tmpcopy.system.category;
			tmpresults.push(tmpresult);
		}

		var tmpbest = pickBestSkillRoll(tmpresults);

		var tmplines = tmpresults.map(function (tmpresult, tmpindex) {
			var tmpchosen = tmpindex == tmpbest.bestIndex;
			var tmplabel = tmpresult.category ? `${tmpresult.category} ` : "";
			return `<div class="skill-roll-line${tmpchosen ? " chosen" : ""}">${tmplabel}${tmpresult.chance}%:
				rolled ${tmpresult.roll} &mdash; <strong>${tmpresult.outcome}</strong></div>`;
		}).join("");

		var tmpheading = tmpresults.length > 1
			? `${tmpitem.name} &mdash; held ${tmpresults.length} times, best taken`
			: `${tmpitem.name}`;

		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `${tmpheading} &mdash; <strong>${tmpbest.best.outcome}</strong>`,
			content: `<div class="imagine-skill-roll">${tmplines}</div>`,
			rolls: tmprolls
		});
	}

	// @MARKER INVENTORY
	// This is the function which makes a new piece of gear on the character, for something a
	// compendium does not hold -- a rope cut in half, a Game Master's invention, a sword taken
	// from an orc and not yet written up.
	//
	// It creates the item and opens its sheet straight away, because a thing called "New
	// Equipment" weighing nothing is not what anyone wanted; the sheet is where it becomes real.
	// Dragging from a compendium still works and is still the better route for anything the
	// system already knows -- see docs/ADDING-CONTENT.md for putting it in a pack instead.
	// This used to create a blank "New Weapon" outright, which is why Daryl could not find a way to
	// put a real one on a character on 2026-09-21: the system's content lives in COMPENDIA and
	// nothing is ever put in Foundry's Items sidebar, so an empty sidebar and a button that made
	// blanks left no route to the 594 weapons that exist. It opens the picker now, which lists
	// them; the blank is still one click away inside it, for homebrew.
	static async #onCreateGear(event, target) {
		event.preventDefault();
		var tmptype = target.dataset.type || "equipment";
		new ImagineItemPicker(this.document, tmptype).render(true);
	}

	// This is the function which opens a carried item's own sheet, to edit what it is.
	static async #onOpenItem(event, target) {
		event.preventDefault();
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (tmpitem) { tmpitem.sheet.render(true); }
	}

	// This is the function which removes a carried item from the character. Asked first: an item
	// deleted here is gone, and a mis-click on a row of small buttons is easy.
	static async #onDeleteItem(event, target) {
		event.preventDefault();
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }

		var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: "Imagine RPG" },
			content: `<p>Remove <strong>${tmpitem.name}</strong> from ${this.document.name}?</p>`,
			rejectClose: false,
			modal: true
		});
		if (tmpconfirmed) { await tmpitem.delete(); }
	}

	// @MARKER MAGIC AND LORE
	// The Magic & Lore tab's buttons. Each finds its item and hands it on; the work is in
	// module/magic-actions.mjs, the rules in module/lore-rules.mjs.

	// This is the function which opens the picker on one kind -- a herb, a ballad, a spell. A poison
	// is not picked: his poisons are built from a type and a potency, so it has its own small form.
	static async #onAddMagic(event, target) {
		event.preventDefault();
		var tmpwhat = target.dataset.what;
		if (tmpwhat == "poison" || tmpwhat == "poisonrecipe") {
			await addPoison(this.document, tmpwhat == "poisonrecipe");
			return;
		}
		new ImagineItemPicker(this.document, tmpwhat).render(true);
	}

	// This is the function behind "Add other lore": the same, for the kind chosen in the dropdown
	// beside the button.
	static async #onAddOtherMagic(event, target) {
		event.preventDefault();
		var tmpselect = target.closest(".magic-other")?.querySelector("select");
		if (!tmpselect?.value) { return; }
		target.dataset.what = tmpselect.value;
		await ImagineCharacterSheet.#onAddMagic.call(this, event, target);
	}

	// This is the function which finds the item a Magic & Lore row's button belongs to.
	#magicItem(target) {
		return this.document.items.get(target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId);
	}

	static async #onUseConsumable(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await useConsumable(this.document, tmpitem); }
	}

	static async #onAddDose(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await addDose(this.document, tmpitem); }
	}

	static async #onToggleMemorized(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await toggleMemorized(this.document, tmpitem); }
	}

	static async #onUseLore(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await useLore(this.document, tmpitem, event); }
	}

	static async #onBrewRecipe(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await brewRecipe(this.document, tmpitem, event); }
	}

	static async #onPostMagic(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await postMagic(this.document, tmpitem); }
	}

	// @MARKER CASTING AND INVOKING
	// The spell and invocation buttons, and the Aura pool's. The work is in module/casting-actions.mjs.
	static async #onCastSpell(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await castSpell(this.document, tmpitem); }
	}

	// His spell_mastery_check: +2 Aura Control, half the time, three times the range, twice the duration.
	static async #onToggleMastered(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await tmpitem.update({ "system.mastered": !tmpitem.system.mastered }); }
	}

	static async #onInvokeInvocation(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await invokeInvocation(this.document, tmpitem); }
	}

	static async #onPrayForInvocation(event, target) {
		var tmpitem = this.#magicItem(target);
		if (tmpitem) { await prayForInvocation(this.document, tmpitem, event); }
	}

	static async #onResetAuraPool(event, target) {
		event.preventDefault();
		await resetAuraPool(this.document);
	}

	static async #onRegenerateAura(event, target) {
		event.preventDefault();
		await regenerateAura(this.document);
	}

	static async #onRemoveMagicEffect(event, target) {
		event.preventDefault();
		if (target.dataset.effect) { await removeMagicEffect(this.document, target.dataset.effect); }
	}

	// This is the function behind the Game Master's "Provide starting lore" -- his "If unchecked GM
	// can provide after generation". Asked first, since it rolls and adds, and running it on a
	// character who already had it gives them more (never the same entry twice, but more doses).
	static async #onProvideStartingLore(event, target) {
		event.preventDefault();
		if (!game.user?.isGM) { return; }
		var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: "Provide starting lore" },
			content: `<p>Roll ${this.document.name}'s starting lore, as his character creation does? One entry for
				every lore skill held, stocks of herbs, potions and poisons, and starting spells for a caster.</p>
				<p class="hint">Nothing already known is added twice; doses of anything already carried are added to it.</p>`,
			rejectClose: false,
			modal: true
		});
		if (tmpconfirmed) { await provideStartingLore(this.document); }
	}

	// This is the function behind a weapon row's wand: the weapon mods window -- Bless it for now, or
	// customize it for good as his panel does. module/apps/weapon-mods.mjs.
	static async #onOpenWeaponMods(event, target) {
		event.preventDefault();
		var tmpweapon = this.document.items.get(target.dataset.itemId);
		if (tmpweapon?.type == "weapon") { new ImagineWeaponMods(this.document, tmpweapon).render(true); }
	}

	// @MARKER MULTIPLE MISSILE COMBINATIONS
	// This is the function which rolls to learn one launcher/missile combination for Multiple Missile
	// Knowledge or Lore (data-skill "know" or "lore") -- his handleRollMultiMissileKnow and
	// handleRollMultiMissileLore (sheet-worker.js:88800, 88950). The launcher and missile are asked
	// for, 1d100 is rolled against the skill's own chance, and resolveMissileComboAcquisition
	// (combat-rules.mjs) says what came of it in his early-exit order. Only a success writes the
	// combination onto the list; a failure changes nothing and locks nothing out -- his code has no
	// lockout, so it may be tried again.
	static async #onLearnMissileCombo(event, target) {
		event.preventDefault();
		var tmpactor = this.document;
		var tmplore = target.dataset.skill == "lore";
		var tmpskillname = tmplore ? "Multiple Missile Lore" : "Multiple Missile Knowledge";
		var tmplistfield = tmplore ? "multiMissileLoreList" : "multiMissileKnowList";
		var tmpchance = tmpactor.system._getSkillChance(tmpskillname);

		// What to offer: every weapon the character holds that launches, or is fired or thrown, and
		// "Thrown" for a weapon thrown from the hand. Typing another name is allowed -- the rule, not
		// this list, decides whether the pair goes together.
		var tmpweaponnames = [...new Set(tmpactor.items.filter(tmpitem => tmpitem.type == "weapon").map(tmpitem => tmpitem.name))];
		var tmplaunchers = ["Thrown"].concat(tmpweaponnames.filter(tmpname => isLauncherWeapon(tmpname)));
		var tmpmissiles = tmpweaponnames.filter(tmpname => isProjectileWeapon(tmpname) || isThrownWeapon(tmpname));
		var tmpesc = (tmptext) => foundry.utils.escapeHTML(String(tmptext ?? ""));
		var tmpchoice = await foundry.applications.api.DialogV2.prompt({
			window: { title: `${tmpskillname}: learn a combination` },
			content: `<div class="imagine-attack-dialog">
				<p class="hint">${tmpesc(tmpactor.name)} rolls against ${tmpchance}% to add a launcher and missile to
				the list. A failure changes nothing, and may be tried again.</p>
				<div class="form-group"><label>Launcher</label><input type="text" name="launcher" list="imagine-mm-launchers">
					<datalist id="imagine-mm-launchers">${tmplaunchers.map(tmpname => `<option value="${tmpesc(tmpname)}">`).join("")}</datalist></div>
				<div class="form-group"><label>Missile</label><input type="text" name="missile" list="imagine-mm-missiles">
					<datalist id="imagine-mm-missiles">${tmpmissiles.map(tmpname => `<option value="${tmpesc(tmpname)}">`).join("")}</datalist></div>
			</div>`,
			rejectClose: false,
			ok: { label: "Roll", callback: (tmpevent, tmpbutton) => ({
				launcher: tmpbutton.form.elements.launcher.value, missile: tmpbutton.form.elements.missile.value }) }
		});
		if (!tmpchoice) { return; }

		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveMissileComboAcquisition({ launcher: tmpchoice.launcher, missile: tmpchoice.missile,
			chance: tmpchance, list: tmpactor.system.combat[tmplistfield], roll: tmproll.total });
		if (tmpresult.outcome == "succeeded") {
			await tmpactor.update({ [`system.combat.${tmplistfield}`]: tmpresult.list });
		}
		// Only a real attempt shows the dice; "nothing done" outcomes are his card's words alone.
		var tmprolled = tmpresult.outcome == "succeeded" || tmpresult.outcome == "failed";
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `${tmpskillname}: ${tmpesc(tmpchoice.launcher)}/${tmpesc(tmpchoice.missile)}`,
			content: `<div class="imagine-chat">${tmpesc(tmpresult.reason)}${tmpresult.outcome == "succeeded"
				? ` <strong>${tmpesc(tmpchoice.launcher.trim())}/${tmpesc(tmpchoice.missile.trim())}</strong> is added.` : ""}</div>`,
			rolls: tmprolled ? [tmproll] : []
		});
	}

	// @MARKER NATURAL WEAPONS
	// This is the function which adds the race's natural weapons the character does not hold -- the
	// generator and a race dropped on the sheet already give them, so this is for a character made
	// before they existed. The same grant as game.imagine.grantNaturalWeapons(actor); nothing held by
	// that name is given twice (module/natural-weapons.mjs).
	static async #onGrantNaturalWeapons(event, target) {
		event.preventDefault();
		var tmpresult = await grantNaturalWeapons(this.document);
		if (!tmpresult.granted.length && !tmpresult.missing.length) {
			ui.notifications.info(`${this.document.name} already has every natural weapon the race gives.`);
		}
	}

	// This is the function which TAKES OFF every weapon and every piece of armour, shields
	// included, leaving them carried.
	//
	// It used to delete them outright, which is what Daryl reported on 2026-09-20: "The Remove all
	// Weapons and Armor button deletes the items from the character entirely, rather than
	// unequipping them." It was doing what its tooltip said, and what it said was the wrong thing
	// to offer. This button sits beside Equip Best Armour and is read as its opposite -- and the
	// opposite of dressing is undressing, not burning the wardrobe. Destroying a character's whole
	// kit is not an everyday action and does not belong one careless click from wearing it; an item
	// that really is to go still has its own delete on its row.
	// No confirmation now, because there is nothing to confirm: everything is still there, still
	// carried, and Equip Best Armour puts it back on.
	static async #onRemoveAllArms(event, target) {
		event.preventDefault();
		var tmpworn = this.document.items.filter(tmpitem => ["weapon", "armor"].includes(tmpitem.type)
			&& tmpitem.system.location == "equipped");
		if (!tmpworn.length) {
			ui.notifications.info(`${this.document.name} has nothing equipped.`);
			return;
		}
		await this.document.updateEmbeddedDocuments("Item",
			tmpworn.map(tmpitem => ({ _id: tmpitem.id, "system.location": "carried" })));
		ui.notifications.info(`${this.document.name} takes off ${tmpworn.length} item(s), still carried.`);
	}

	// This is the function which puts the character in the best armour they own: the strongest
	// legal set under the layering rules (see module/equip-rules.mjs). Armour already worn but not in
	// that set is taken off, to carried. Shields and weapons are not touched.
	// @MARKER WEALTH
	// This is the function which runs one of his six money buttons: ADD or SUBTRACT on the coins, the
	// gems or the jewelry row (data-kind, data-mode). The row's inputs carry no name, so typing in
	// them never writes to the character; they are read here, cleared, and the result goes to chat in
	// his words, as his buttons post theirs.
	// @MARKER ROLL STARTING MONEY
	// This is the function which rolls starting money on the sheet, for a character the generator never
	// made -- the generator's own roll, from this character's final Social Class and the Fortune it had
	// on its first day (module/starting-money.mjs @MARKER ROLL ON THE SHEET). Checked again here and not
	// only in the template, since a player's stale window could still show the button.
	static async #onRollStartingMoney(event, target) {
		event.preventDefault();
		var tmpactor = this.document;
		if (!canRollStartingMoney(tmpactor.system.wealth, tmpactor.getFlag("imagine-rpg", "startingMoney"), game.user?.isGM)) {
			ui.notifications.warn(`${tmpactor.name} already has money, or has already rolled it. Ask the Game Master.`);
			return;
		}
		var tmpinputs = getCharacterMoneyInputs(tmpactor.system, tmpactor.items.filter(tmpitem => tmpitem.type == "class").map(tmpitem => tmpitem.system));
		var tmpmoney = rollStartingMoney(tmpinputs.social, tmpinputs.fortune,
			(tmpsides) => Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1);
		var tmpsummary = describeStartingMoney(tmpmoney);
		await tmpactor.update({
			"system.wealth.copper": tmpmoney.copper, "system.wealth.silver": tmpmoney.silver,
			"system.wealth.gold": tmpmoney.gold, "system.wealth.platinum": tmpmoney.platinum,
			"flags.imagine-rpg.startingMoney": tmpsummary
		});
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `${tmpactor.name} counts their coins`,
			content: `<div>${tmpsummary}</div>`
		});
	}

	static async #onChangeWealth(event, target) {
		event.preventDefault();
		var tmprow = target.closest(".wealth-update");
		var tmpread = (tmpfield) => tmprow?.querySelector(`[data-wealth="${tmpfield}"]`)?.value ?? "";
		var tmpadd = target.dataset.mode == "add";
		var tmpwealth = this.document.system.wealth;
		var tmpresult;
		var tmpupdate = {};
		var tmptitle = "";
		if (target.dataset.kind == "coins") {
			tmptitle = tmpadd ? "Adding Coins" : "Subtracting Coins";
			tmpresult = changeCoins(tmpwealth, tmpread("type"), tmpread("count"), tmpadd);
			for (const [tmpkey, tmpvalue] of Object.entries(tmpresult.update)) { tmpupdate["system.wealth." + tmpkey] = tmpvalue; }
		} else {
			var tmpgems = target.dataset.kind == "gems";
			tmptitle = tmpgems ? (tmpadd ? "Adding Gem(s)" : "Subtracting Gem(s)")
				: (tmpadd ? "Adding Jewelry or other valuables" : "Subtracting Jewelry or other valuables");
			tmpresult = changeValuables(tmpgems ? tmpwealth.gems : tmpwealth.jewelry, tmpread("name"), tmpread("count"),
				tmpread("value"), tmpadd, tmpgems ? "gems" : "item(s)");
			if (tmpresult.ok) { tmpupdate[tmpgems ? "system.wealth.gems" : "system.wealth.jewelry"] = tmpresult.list; }
		}
		if (tmpresult.ok) { await this.document.update(tmpupdate); }
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: tmptitle,
			content: `<div>${tmpresult.message}</div>`
		});
		if (!tmpresult.ok) { ui.notifications.warn(tmpresult.message); }
	}

	static async #onEquipBestArmor(event, target) {
		event.preventDefault();
		// Only armour on the character -- worn or carried. Armour left in a stash or on a mount stays
		// there; this once dressed the character from the stash and took barding off the horse (bug
		// sweep 2026-09-23).
		var tmparmor = this.document.items.filter(tmpitem => tmpitem.type == "armor" && !tmpitem.system.isShield
			&& ["equipped", "carried"].includes(tmpitem.system.location));
		if (!tmparmor.length) { ui.notifications.info(`${this.document.name} has no armour to wear.`); return; }

		// toObject() is the stored data alone; the campaign's availability (a sourcebook switched off) is
		// worked out on the item, so it is passed on beside it for chooseBestArmor to honour.
		var tmpbest = chooseBestArmor(tmparmor.map(tmpitem => ({ id: tmpitem.id, name: tmpitem.name,
			type: tmpitem.type, system: { ...tmpitem.system.toObject(), available: tmpitem.system.available } })));
		var tmpupdates = tmparmor.map(tmpitem => {
			var tmpwear = tmpbest.worn.includes(tmpitem.id);
			var tmpchange = { _id: tmpitem.id, "system.location": tmpwear ? "equipped" : "carried" };
			if (tmpwear) { tmpchange["system.layer"] = tmpbest.layers[tmpitem.id]; }
			return tmpchange;
		});
		await this.document.updateEmbeddedDocuments("Item", tmpupdates);

		if (!tmpbest.worn.length) { ui.notifications.warn("None of the armour carried can be worn."); return; }
		ui.notifications.info(`${this.document.name} now wears ${tmpbest.worn.length} piece(s) of armour.`);
	}

	// @MARKER HANDEDNESS
	// This is the function which rolls handedness, the same roll the character generator makes and
	// through the same rules function -- his determineHandedness, sheet-worker.js:49200. It is on
	// the sheet as well as in the generator because a character made by hand in the Actors
	// directory never passes through the generator, and with the dropdown gone there would
	// otherwise be no way to give that character a handedness at all.
	// The die is CONFIG.Dice.randomUniform, the same one the character generator's #die uses and
	// for the same reason: it goes through Foundry's own random source, so a world using a
	// third-party dice module gets that module's randomness here too. Deliberately NOT a Roll with
	// a chat card, unlike the attribute saves and skill checks above -- those are moments at the
	// table, and this is a detail of who the character is, settled once and quietly.
	static async #onRollHandedness(event, target) {
		event.preventDefault();
		var tmpabilities = this.document.system.identity?.race?.abilities ?? [];
		var tmphandedness = rollHandedness(tmpabilities,
			(tmpsides) => Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1);
		await this.document.update({ "system.physical.handedness": tmphandedness });
		ui.notifications.info(`${this.document.name} is ${tmphandedness.toLowerCase()}-handed.`);
	}

	// This is the function which opens the Level Up window. Experience, goals and titles are all
	// taken there rather than typed onto the sheet, because each has decisions and refusals in it
	// -- see module/apps/level-up.mjs.
	static async #onOpenLevelUp(event, target) {
		event.preventDefault();
		game.imagine.levelUp(this.document);
	}

	// This is the function which opens the Situation Mods window from the Combat tab's bar.
	static async #onOpenSituation(event, target) {
		event.preventDefault();
		game.imagine.situationMods(this.document);
	}

	// This is the function which clears every Situation Mod -- his "Clear all modifiers".
	static async #onClearSituation(event, target) {
		event.preventDefault();
		await this.document.update({ "system.combat.situation.kind": "", "system.combat.situation.selected": [] });
	}

	// This is the function which advances or steps back one class's own title.
	//
	// Only a dual-classed character has these: with one class the title lives on the character,
	// where it always has, and this never renders. A class whose title is still zero is following
	// the character's, so the first step starts from there rather than from nothing.
	static async #onStepClassTitle(event, target) {
		var tmpitem = this.document.items.get(target.dataset.itemId);
		if (!tmpitem) { return; }

		var tmpstep = parseInt(target.dataset.step) || 0;
		var tmpnow = (parseInt(tmpitem.system.title) || 0)
			|| (parseInt(this.document.system.identity.title) || 0);
		// Never below 1: a class title of 0 means "follow the character's title" (_getClassTitle), so
		// stepping a class down from 1 once jumped it UP to the character's title (bug sweep 2026-09-23).
		await tmpitem.update({ "system.title": Math.max(1, tmpnow + tmpstep) });
	}

	// This is the function which attempts a skill the character has never learned.
	//
	// Player's Guide, "Who Can Use a Skill": almost any skill may be tried untrained, at the base
	// chance with no starting bonus. Two limits come from the same passage and are applied here
	// rather than in the chance itself: a skill already held is rolled as itself instead (the book
	// is explicit -- "any skill for which the character has rolled a starting bonus can no longer
	// be attempted as a common skill"), and a restricted skill cannot be tried at all.
	//
	// THE RESTRICTED FLAG HAS NO DATA BEHIND IT YET. His skilldict carries no restricted column --
	// the book states it per skill and he never brought it across -- so `isRestricted` is on the
	// schema, honoured here, and false on all 674 extracted skills until something populates it.
	// Filtering on it now rather than later means nothing has to be rewired when it lands.
	static async #onRollUntrainedSkill(event, target) {
		var tmppack = game.packs.get("world.imagine-skills");
		if (!tmppack) {
			ui.notifications.warn("No skill compendium in this world. Import the system content first.");
			return;
		}

		var tmpindex = await tmppack.getIndex({ fields: ["system.attr1", "system.attr2",
			"system.skillRating", "system.isRestricted"] });
		var tmpheld = new Set(this.document.items.filter(i => i.type == "skill").map(i => i.name));
		var tmpoffer = tmpindex
			.filter(e => !tmpheld.has(e.name) && !e.system?.isRestricted)
			.sort((a, b) => a.name.localeCompare(b.name));
		if (!tmpoffer.length) {
			ui.notifications.info("No skill left to attempt untrained.");
			return;
		}

		var tmpoptions = tmpoffer
			.map(e => `<option value="${e._id}">${foundry.utils.escapeHTML(e.name)}</option>`).join("");
		var tmpchoice = await foundry.applications.api.DialogV2.prompt({
			window: { title: "Attempt a Skill Untrained" },
			content: `<p class="hint">The base chance alone, with no starting bonus.</p>
				<div class="form-group"><label>Skill</label><select name="skill">${tmpoptions}</select></div>
				<div class="form-group"><label>Modifier</label>
					<input type="number" name="modifier" value="0"></div>`,
			rejectClose: false,
			ok: {
				label: "Attempt it",
				callback: (event, button) => ({
					id: button.form.elements.skill.value,
					modifier: parseInt(button.form.elements.modifier.value) || 0
				})
			}
		});
		if (!tmpchoice) { return; }

		var tmpentry = tmpoffer.find(e => e._id == tmpchoice.id);
		if (!tmpentry) { return; }

		var tmpchance = this.document.system.getCommonSkillChance(
			tmpentry.system?.attr1, tmpentry.system?.attr2, tmpentry.system?.skillRating)
			+ tmpchoice.modifier;

		var tmproll = await new Roll("1d100").evaluate();
		var tmpresult = resolveSkillOutcome(tmpchance, tmproll.total);

		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `${tmpentry.name} (untrained) &mdash; ${tmpresult.chance}% &mdash;
				<strong>${tmpresult.outcome}</strong>`
		});
	}

	// This is the function which trades one category's skill slots for another's -- the Player's
	// Guide's "slot tricks", ported from his four conversion functions. The rates are in
	// SLOT_TRANSFERS; nothing about them is decided here.
	//
	// It asks first. His sheet's trade is a one-way door (there is no function that undoes one),
	// and this port keeps that, so a mis-click would otherwise cost a slot with no way back.
	static async #onTransferSlot(event, target) {
		var tmpkey = target.dataset.transfer;
		var tmptransfer = SLOT_TRANSFERS[tmpkey];
		if (!tmptransfer) { return; }

		var tmpslots = this.document.system.skillSlots;
		var tmpallowed = canTransferSlot(tmpkey,
			{ class: tmpslots.class, racial: tmpslots.racial, social: tmpslots.social },
			{ class: tmpslots.classUsed, racial: tmpslots.racialUsed, social: tmpslots.socialUsed });
		if (!tmpallowed.allowed) {
			ui.notifications.warn(tmpallowed.reason);
			return;
		}

		var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: "Trade Skill Slots" },
			content: `<p>Give up ${tmptransfer.cost} ${tmptransfer.from} slot${tmptransfer.cost > 1 ? "s" : ""}
				for ${tmptransfer.gain} ${tmptransfer.to} slot${tmptransfer.gain > 1 ? "s" : ""}?</p>
				<p class="hint">This cannot be undone.</p>`
		});
		if (!tmpconfirmed) { return; }

		var tmpmoves = this.document.system.skillSlotMoves;
		await this.document.update({ [`system.skillSlotMoves.${tmpkey}`]: (parseInt(tmpmoves[tmpkey]) || 0) + 1 });
	}

	// This is the function which gives up a slot outright for a bonus to a skill already held:
	// 2d4%, added to that skill's own modifier, from his sacrificeRacialSkillSlot and its social
	// twin. The bonus is added rather than floored at zero, as his code adds it -- a skill carrying
	// a larger penalty stays negative.
	static async #onSacrificeSlot(event, target) {
		var tmpcategory = target.dataset.category;
		var tmpslots = this.document.system.skillSlots;
		var tmpskills = this.document.items.filter(i => i.type == "skill");

		var tmpallowed = canSacrificeSlot(tmpcategory,
			{ class: tmpslots.class, racial: tmpslots.racial, social: tmpslots.social },
			{ class: tmpslots.classUsed, racial: tmpslots.racialUsed, social: tmpslots.socialUsed },
			tmpskills.length > 0);
		if (!tmpallowed.allowed) {
			ui.notifications.warn(tmpallowed.reason);
			return;
		}

		var tmpoptions = tmpskills
			.map(s => `<option value="${s.id}">${foundry.utils.escapeHTML(s.name)}</option>`).join("");
		var tmptarget = await foundry.applications.api.DialogV2.prompt({
			window: { title: "Give Up a Skill Slot" },
			content: `<p>Give up one ${tmpcategory} slot. The skill chosen gains ${SLOT_SACRIFICE_DICE}%.</p>
				<div class="form-group"><label>Skill</label><select name="skill">${tmpoptions}</select></div>
				<p class="hint">This cannot be undone.</p>`,
			rejectClose: false,
			ok: { label: "Give it up", callback: (event, button) => button.form.elements.skill.value }
		});
		if (!tmptarget) { return; }

		var tmpskill = this.document.items.get(tmptarget);
		if (!tmpskill) { return; }

		var tmproll = await new Roll(SLOT_SACRIFICE_DICE).evaluate();
		var tmpmoves = this.document.system.skillSlotMoves;
		var tmpkey = tmpcategory == "racial" ? "racialSacrificed" : "socialSacrificed";

		await this.document.update({ [`system.skillSlotMoves.${tmpkey}`]: (parseInt(tmpmoves[tmpkey]) || 0) + 1 });
		await tmpskill.update({ "system.misc": (parseInt(tmpskill.system.misc) || 0) + tmproll.total });

		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.document }),
			flavor: `Gave up a ${tmpcategory} skill slot &mdash; ${tmpskill.name} gains the bonus`
		});
	}

	//==============================================================================================
	// @MARKER MARTIAL ARTS
	//==============================================================================================
	// The Combat tab's martial arts panel: one heading that opens into the discipline, the stance,
	// the moves and every subskill. What it shows is laid out by module/martial-view.mjs (so the
	// preview renders the same thing), from what _prepareMartialArts derived; the rolls are in
	// module/combat/martial-attack.mjs, the rules in module/combat/martial-arts.mjs. The handlers are
	// kept together here so the panel's behaviour is one block to read.

	// This is the function which opens or closes the panel. Held on the sheet itself rather than
	// the actor -- it is how this window is laid out, not a fact about the character -- so it
	// survives the re-render every roll and every choice causes.
	static async #onToggleMartialPanel(event, target) {
		event.preventDefault();
		this._martialOpen = !this._martialOpen;
		this.render({ parts: ["combat"] });
	}

	// This is the function which makes a martial attack.
	static async #onRollMartialAttack(event, target) {
		await rollMartialAttack(this.document, target.dataset.name);
	}

	// This is the function which rolls a block, a hold or a throw.
	static async #onRollMartialSubskill(event, target) {
		await rollMartialSubskill(this.document, target.dataset.family, target.dataset.name, event);
	}

	// This is the function which rolls a move; made, it goes into play.
	static async #onRollMartialMove(event, target) {
		await rollMartialMove(this.document, target.dataset.name, event);
	}

	// This is the function which rolls a Martial Lore value; made, it goes into play.
	static async #onRollMartialLoreValue(event, target) {
		await rollMartialLoreValue(this.document, target.dataset.name, event);
	}

	// This is the function which marks a move made or clears it by hand. His sheet's success box
	// could be ticked directly too; it is the Game Master's way of saying "that happened".
	static async #onToggleMartialMove(event, target) {
		var tmplist = parseMartialList(this.document.system.martial?.activeMoves);
		var tmpname = target.dataset.name;
		tmplist = tmplist.includes(tmpname) ? tmplist.filter(n => n != tmpname) : [...tmplist, tmpname];
		await this.document.update({ "system.martial.activeMoves": tmplist.join(",") });
	}

	// This is the function which marks a Martial Lore value made or clears it by hand.
	static async #onToggleMartialLoreValue(event, target) {
		var tmplist = parseMartialList(this.document.system.martial?.activeLoreValues);
		var tmpname = target.dataset.name;
		tmplist = tmplist.includes(tmpname) ? tmplist.filter(n => n != tmpname) : [...tmplist, tmpname];
		await this.document.update({ "system.martial.activeLoreValues": tmplist.join(",") });
	}

	// This is the function which clears every move and Martial Lore value made -- his CLEAR buttons
	// beside SET (handleMartialModifierClear and handleMartialLoreModifierClear). The stance is
	// left alone; it is changed from its own dropdown.
	static async #onClearMartialMoves(event, target) {
		await this.document.update({ "system.martial.activeMoves": "", "system.martial.activeLoreValues": "" });
	}

	// These are the functions which learn something new, each one roll.
	static async #onLearnMartialStance(event, target) { await learnMartialStance(this.document); }
	static async #onMasterMartialStance(event, target) { await masterMartialStance(this.document); }
	static async #onLearnMartialSubskill(event, target) { await learnMartialSubskill(this.document); }
	static async #onLearnMartialLoreValue(event, target) { await learnMartialLoreValue(this.document); }
}
// @END (CODE)
