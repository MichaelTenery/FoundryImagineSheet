// @START (CODE)
// @MARKER SYSTEM ENTRY POINT
//==================================================================================================================
// Imagine Role Playing System for Foundry VTT.
//
// Converted from the Roll20 sheet by W. Michael Tenery III, with permission. Where this code
// and the printed rulebooks disagree, the Roll20 sheet is the source of truth -- see
// docs/DECISIONS.md.
//
// Status: character and creature data models with derived values, sheets for both, a runtime
// content importer, the content availability switches, and combat phase 1 (attack charts, attack
// and damage rolls, armour, body areas and wounds, the 10 second round). Not yet built: combat
// phase 2 and the magic subsystems, which is also what a creature's Powers wait on. See
// docs/PROGRESS.md.
//==================================================================================================================

import ImagineCharacterData from "./data/actor-character.mjs";
import ImagineCreatureData from "./data/actor-creature.mjs";
import ImagineSkillData from "./data/item-skill.mjs";
import ImagineRaceData from "./data/item-race.mjs";
import ImagineClassData from "./data/item-class.mjs";
import ImagineWeaponData from "./data/item-weapon.mjs";
import ImagineArmorData from "./data/item-armor.mjs";
import ImagineEquipmentData from "./data/item-equipment.mjs";
import ImagineCreatureAttackData from "./data/item-creature-attack.mjs";
import ImaginePowerData from "./data/item-power.mjs";
import ImagineTraitData from "./data/item-trait.mjs";
import ImagineConsumableData from "./data/item-consumable.mjs";
import ImagineLoreData from "./data/item-lore.mjs";
import ImagineSpellData from "./data/item-spell.mjs";
import ImagineInvocationData from "./data/item-invocation.mjs";
import ImagineCharacterSheet from "./sheets/actor-character-sheet.mjs";
import ImagineCreatureSheet from "./sheets/actor-creature-sheet.mjs";
import {
	ImagineCreatureAttackSheet, ImaginePowerSheet, ImagineTraitSheet,
	ImagineClassSheet, ImagineArmorSheet, ImagineRaceSheet,
	ImagineEquipmentSheet, ImagineWeaponSheet, ImagineSkillSheet,
	ImagineConsumableSheet, ImagineLoreSheet, ImagineSpellSheet, ImagineInvocationSheet
} from "./sheets/item-sheet.mjs";
import { provideStartingLore } from "./starting-lore.mjs";
import { PRICE_LEVELS, DEFAULT_PRICE_LEVEL } from "./shop-rules.mjs";
import { importAllContent } from "./content-importer.mjs";
import { grantClassSkills, registerClassAdvancement } from "./class-advancement.mjs";
import { grantNaturalWeapons, registerNaturalWeapons } from "./natural-weapons.mjs";
import { registerRolledStartingEndurance } from "./race-endurance.mjs";
import { addExperience } from "./advancement.mjs";
import ImagineLevelUp from "./apps/level-up.mjs";
import ImagineSituationalMods from "./apps/situational-mods.mjs";
import ImagineAvailabilityConfig from "./apps/availability-config.mjs";
import ImagineCharacterGenerator, { registerCharacterGeneratorButton } from "./apps/character-generator.mjs";
import ImagineCombat, { ImagineCombatant } from "./combat/combat-document.mjs";
import ImagineCombatTracker from "./combat/combat-tracker.mjs";
import ImagineRoundClock, { loadClockTemplates } from "./apps/round-clock.mjs";
import { rollWeaponAttack, registerAttackCardListeners } from "./combat/attack.mjs";
import { registerCastCardListeners } from "./casting-actions.mjs";
import { rollCreatureAttack } from "./combat/creature-attack.mjs";
import { loadMartialTemplates } from "./combat/martial-attack.mjs";
import {
	SOURCEBOOKS, MAGIC_SUBSYSTEMS,
	registerAvailabilitySettings, registerAvailabilityEnforcement,
	getAvailabilityRules, explainAvailability
} from "./availability.mjs";
import { refreshOpenWindows } from "./sheet-theme.mjs";
import { populateItemDirectory, clearItemDirectory } from "./item-directory.mjs";
import { registerChangelog, showChangelog, showChangelogIfNew } from "./changelog.mjs";

// @MARKER SYSTEM CONSTANTS
export const IMAGINE = {

	// The twelve attributes, in the order the Player's Guide presents them, grouped
	// physical / mental / personal / mystical.
	attributes: {
		str: "IMAGINE.Attribute.str",
		agl: "IMAGINE.Attribute.agl",
		vit: "IMAGINE.Attribute.vit",
		int: "IMAGINE.Attribute.int",
		wis: "IMAGINE.Attribute.wis",
		knw: "IMAGINE.Attribute.knw",
		app: "IMAGINE.Attribute.app",
		chm: "IMAGINE.Attribute.chm",
		soc: "IMAGINE.Attribute.soc",
		aur: "IMAGINE.Attribute.aur",
		pty: "IMAGINE.Attribute.pty",
		wil: "IMAGINE.Attribute.wil"
	},

	// Skill types as they appear in skilldict. Magical and Divine are the two the
	// magic switches filter on.
	skillTypes: ["Magical", "Divine", "Combat", "Disciplined", "Informational", "Stealth/Intrusive"],

	// Armour flexibility classes, innermost-first. The first layer worn must always be
	// flexible, each layer may only sit over something at least as flexible as itself, and
	// rigid may never stack on rigid. Clothing is its own class and does not consume a
	// layer when its armour value is 3 or less.
	armorFlexibility: ["Clothing", "Flexible", "Semi-Flexible", "Rigid"]
};

// getAttribSave and getAttributeMax live on ImagineCharacterData as static functions, so the
// rule and the data it applies to stay in one place. Reach them via
// ImagineCharacterData.getAttribSave(rating).
//
// There is deliberately no table of attribute caps by being type here. An attribute has two
// ceilings, both worked out in ImagineCharacterData: the ordinary maximum (getAttributeMax --
// the race's limit until title 11, then 25) and the magical maximum (getMagicalAttributeMax --
// his 23 / 25 / 27 by title). He confirmed the pair on 2026-09-16 -- see docs/DECISIONS.md,
// 2026-09-17.

// @MARKER SYSTEM INITIALISATION
Hooks.once("init", function () {
	// The version is printed, not just the name. The system is installed by copying dist/imagine-rpg
	// into Foundry's systems folder, so the copy Foundry runs is not the copy being edited -- and
	// on 2026-09-20 an import error that had already been fixed was reported twice from a stale
	// install, with nothing on screen to tell the two apart. This line is the answer to "which
	// build am I actually running": read it in the console (F12) and compare it with BUILD.txt.
	console.log("Imagine RPG | Initialising system, version " + (game.system?.version ?? "unknown"));

	CONFIG.IMAGINE = IMAGINE;
	CONFIG.IMAGINE.sourcebooks = SOURCEBOOKS;
	CONFIG.IMAGINE.magicSubsystems = MAGIC_SUBSYSTEMS;

	// Register the data models against the document subtypes declared in system.json.
	CONFIG.Actor.dataModels.character = ImagineCharacterData;
	CONFIG.Actor.dataModels.creature = ImagineCreatureData;
	CONFIG.Item.dataModels.skill = ImagineSkillData;
	CONFIG.Item.dataModels.race  = ImagineRaceData;
	CONFIG.Item.dataModels.class = ImagineClassData;
	CONFIG.Item.dataModels.weapon = ImagineWeaponData;
	CONFIG.Item.dataModels.armor = ImagineArmorData;
	CONFIG.Item.dataModels.equipment = ImagineEquipmentData;

	// A creature's own item types. An attack is one of its natural strikes, a power an innate
	// spell or invocation, and a trait an ability, disability or immunity.
	CONFIG.Item.dataModels.creatureAttack = ImagineCreatureAttackData;
	CONFIG.Item.dataModels.power = ImaginePowerData;
	CONFIG.Item.dataModels.trait = ImagineTraitData;

	// @MARKER TOKEN BARS
	// What a token's resource bars may show. Without this Foundry offers no bar at all -- neither
	// actor had a {value, max} pair -- and a Game Master running a dozen creatures had to open each
	// sheet to see how hurt it was. The bar is Shock less the total wounds (getShockBar in
	// combat-rules.mjs), the provisional D9 of the creature audit (docs/DECISIONS.md 2026-09-23); it is
	// derived, so the token HUD shows it and does not offer to edit it -- wounds are healed on the sheet.
	// Naming the types here replaces Foundry's guess at every number in the schema, so the few plain
	// values worth watching are listed beside it.
	//                    bars                 plain values
	CONFIG.Actor.trackableAttributes = {
		character: { bar: ["body.shockBar"], value: ["body.totalWounds", "body.overallWounds", "combat.damageAbsorb"] },
		creature:  { bar: ["body.shockBar"], value: ["body.totalWounds", "body.overallWounds", "combat.damageAbsorb"] }
	};

	// @MARKER MAGIC AND LORE ITEMS
	// His Magic/Lore tab: consumables held as doses (herbs, potions, elixirs, charms, poisons),
	// lore entries known and memorized (ballads through runes, recipes and evokes), and spells and
	// invocations. See module/lore-rules.mjs for what each kind is.
	CONFIG.Item.dataModels.consumable = ImagineConsumableData;
	CONFIG.Item.dataModels.lore = ImagineLoreData;
	CONFIG.Item.dataModels.spell = ImagineSpellData;
	CONFIG.Item.dataModels.invocation = ImagineInvocationData;

	// @MARKER SHEET REGISTRATION
	// The default core sheet is unregistered so it does not offer itself alongside ours.
	foundry.documents.collections.Actors.unregisterSheet("core", foundry.applications.sheets.ActorSheetV2);
	foundry.documents.collections.Actors.registerSheet("imagine-rpg", ImagineCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Character"
	});

	foundry.documents.collections.Actors.registerSheet("imagine-rpg", ImagineCreatureSheet, {
		types: ["creature"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Creature"
	});

	// The creature's own item types get sheets of their own. An attack most needs one: it
	// carries up to three rider effects of seven fields each, which the default sheet renders
	// as a list nobody can author against. Class, armour and race get sheets for the same
	// reason -- each carries nested or variable-length structure the default sheet cannot show
	// usably (see docs/DECISIONS.md, "Three of the six remaining item sheets, not six"). Skill,
	// weapon and equipment stay on the default sheet on purpose: broad but flat, and read far
	// more often than written, so the core sheet is NOT unregistered here.
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineCreatureAttackSheet, {
		types: ["creatureAttack"],
		makeDefault: true,
		label: "IMAGINE.Sheet.CreatureAttack"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImaginePowerSheet, {
		types: ["power"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Power"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineTraitSheet, {
		types: ["trait"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Trait"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineClassSheet, {
		types: ["class"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Class"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineArmorSheet, {
		types: ["armor"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Armor"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineRaceSheet, {
		types: ["race"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Race"
	});

	// Equipment, weapons and skills. These three used the core default sheet until 2026-09-19,
	// when the Equipment tab gained buttons that create gear and open its sheet at once: a new
	// item landing on a sheet with no weight field is no use to anyone.
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineEquipmentSheet, {
		types: ["equipment"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Equipment"
	});

	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineWeaponSheet, {
		types: ["weapon"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Weapon"
	});

	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineSkillSheet, {
		types: ["skill"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Skill"
	});

	// The Magic & Lore tab's four item types. Each is flat, but a lore entry's memorized tick and a
	// consumable's doses are edited on the character's own tab; the sheets are for reading an entry
	// whole and for authoring homebrew.
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineConsumableSheet, {
		types: ["consumable"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Consumable"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineLoreSheet, {
		types: ["lore"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Lore"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineSpellSheet, {
		types: ["spell"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Spell"
	});
	foundry.documents.collections.Items.registerSheet("imagine-rpg", ImagineInvocationSheet, {
		types: ["invocation"],
		makeDefault: true,
		label: "IMAGINE.Sheet.Invocation"
	});

	// @MARKER SYSTEM API
	// Exposed so the content import can be run from a macro or the console at any time,
	// not only when first prompted:  game.imagine.importContent()
	// @MARKER COMBAT
	// Initiative is the second of the round a combatant starts acting in: a d10 plus the better
	// of their Agility and Intelligence adjustments and their armour. Lower is earlier, so the
	// tracker sorts lowest first -- see combat/combat-document.mjs.
	CONFIG.Combat.documentClass = ImagineCombat;
	CONFIG.Combat.initiative = { formula: "1d10 + @combat.initiativeMod", decimals: 0 };
	registerAttackCardListeners();
	// A spell's or invocation's card: its Apply buttons and its seconds (module/casting-actions.mjs).
	registerCastCardListeners();
	// The martial arts panel is a partial both Combat tabs include; loaded here, and awaited again
	// by the sheets before they render.
	loadMartialTemplates();

	// @MARKER ROUND CLOCK
	// Each combatant's seconds through the round -- his Mr. Initiative chart (Master's Manual
	// pp.98-100). The combatant keeps its clock and starts it again whenever its initiative is set
	// from outside it; the tracker draws it under every row; the Mr. Initiative window draws them
	// all on one chart. See module/combat/round-rules.mjs.
	CONFIG.Combatant.documentClass = ImagineCombatant;
	CONFIG.ui.combat = ImagineCombatTracker;
	loadClockTemplates();

	// A combatant's clock reads Speed seconds and handedness off its actor, so a change to either
	// re-sorts the tracker and redraws it (and with it the Mr. Initiative window).
	Hooks.on("updateActor", function (tmpactor, tmpchanges) {
		var tmpcombat = ui.combat?.viewed;
		if (!tmpcombat) { return; }
		var tmpclockchange = ["system.combat.speedSeconds", "system.physical.handedness", "system.identity.handedness"]
			.some(k => foundry.utils.hasProperty(tmpchanges, k));
		if (!tmpclockchange) { return; }
		if (!tmpcombat.combatants.some(c => (c.actor === tmpactor) || (c.actorId == tmpactor.id))) { return; }
		tmpcombat.setupTurns();
		ui.combat.render();
	});

	game.imagine = {
		importContent: importAllContent,
		// @MARKER ITEM DIRECTORY
		// Fills Foundry's Items sidebar from the same content, in folders -- his own groupings
		// where his tables have them. The compendia stay the system's copy; this is a working set
		// in the world, which is where a Game Master reaches for a sword mid-session.
		//     game.imagine.populateItems()   to fill it
		//     game.imagine.clearItems()      to take it out again
		populateItems: populateItemDirectory,
		clearItems: clearItemDirectory,
		rollWeaponAttack: rollWeaponAttack,
		rollCreatureAttack: rollCreatureAttack,
		getAvailabilityRules: getAvailabilityRules,
		explainAvailability: explainAvailability,
		// The step-by-step character generator; also a button in the Actors directory.
		generateCharacter: () => new ImagineCharacterGenerator().render(true),
		// @MARKER STARTING LORE
		// His "Provide random lore" -- entries for every lore the character holds, stocks of herbs,
		// potions and poisons, and starting spells. The generator runs it when its tick is on, and
		// the Magic & Lore tab has a Game Master button for a character made any other way.
		//     game.imagine.provideStartingLore(actor)
		provideStartingLore: provideStartingLore,
		// Gives a character every class skill their title has earned. It runs by itself when a
		// title changes; this is here for a character imported from elsewhere, or one whose
		// grant was refused when the content was switched off.
		grantClassSkills: grantClassSkills,
		// Gives a character the claws, bites and horns their race is born with, as weapons. It runs
		// by itself when a race is added; this is here for a character made before it existed.
		//     game.imagine.grantNaturalWeapons(actor)
		grantNaturalWeapons: grantNaturalWeapons,
		// @MARKER ADVANCEMENT
		// The Level Up window, also a button on the character sheet. Experience is added through
		// it rather than typed, because his cap, his refusals and the Arch Mortal line all apply.
		levelUp: (tmpactor) => new ImagineLevelUp(tmpactor).render(true),
		addExperience: addExperience,
		// @MARKER SITUATION MODS
		// The melee and missile situational modifiers window, also a button on the Combat tab of
		// both sheets.
		situationMods: (tmpactor) => ImagineSituationalMods.open(tmpactor),
		// @MARKER ROUND CLOCK
		// The Mr. Initiative window, also the stopwatch at the top of the Combat tracker.
		roundClock: () => ImagineRoundClock.open(),
		// @MARKER CHANGELOG
		// The What's New window, every release. It also opens by itself once per user after an
		// update; see module/changelog.mjs.
		showChangelog: showChangelog
	};

	// Records whether the content has ever been imported into this world, so the first-launch
	// prompt does not keep reappearing once it has been dealt with.
	game.settings.register("imagine-rpg", "contentImported", {
		scope: "world",
		config: false,
		type: Boolean,
		default: false
	});

	// @MARKER SHEET THEME
	// Which palette the Imagine windows paint themselves in. The system's own look is cream paper
	// with brown ink, and that is the default for a reason -- a sheet with this many numbers reads
	// better as a printed page, and entered values are told from derived ones by field-against-flat
	// text, which wants a light ground. But a Game Master running a dark table had these windows
	// glaring out of an otherwise dark screen with no way to say otherwise, so the other choice is
	// to stop overriding and let Foundry's own theme through. See module/sheet-theme.mjs.
	game.settings.register("imagine-rpg", "sheetTheme", {
		name: "Sheet colours",
		hint: "Imagine paper: the system's own cream-and-ink look, the same in every world. "
		    + "Foundry standard: follow whatever theme Foundry itself is using, light or dark.",
		scope: "client",
		config: true,
		type: String,
		choices: { paper: "Imagine paper", foundry: "Foundry standard" },
		default: "paper",
		onChange: refreshOpenWindows
	});

	// @MARKER VERSION BADGE
	// The system's version in the title bar of every Imagine window, so which build is running is
	// always in view. Per player; on by default. See module/sheet-theme.mjs.
	game.settings.register("imagine-rpg", "showVersion", {
		name: "Show the system version on windows",
		hint: "Puts the Imagine system's version (v0.18.0 and so on) in the title bar of every Imagine "
		    + "sheet and window. Turn it off to hide it.",
		scope: "client",
		config: true,
		type: Boolean,
		default: true,
		onChange: refreshOpenWindows
	});

	// @MARKER HANDEDNESS
	// Handedness is ROLLED, not chosen, because that is what his sheet does: determineHandedness
	// (sheet-worker.js:49200) rolls d100 the moment a race is applied -- 1-75 right, 76-95 left,
	// 96-100 ambidextrous -- and a race carrying the Ambidextrous ability always is, with no roll
	// at all. Nothing in his sheet offers the player a choice, so rolling is the default here too.
	// The tick is for tables that would rather pick, and is a world setting so the decision is the
	// Game Master's and is the same for everyone at that table. It is deliberately the ONLY
	// handedness switch: with it off the dropdown is not merely ignored but gone, on the character
	// sheet and in the generator both, because a control that silently does nothing is worse than
	// no control. Creatures are unaffected -- they are Game Master content and always selectable.
	game.settings.register("imagine-rpg", "handednessSelectable", {
		name: "Players may choose handedness",
		hint: "Off, as his sheet has it: handedness is rolled -- 1-75 right, 76-95 left, 96-100 "
		    + "ambidextrous, and a race with the Ambidextrous ability always is. On: it is picked "
		    + "from a dropdown instead. Affects characters only, not creatures.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	// @MARKER FAMORIAN BREED
	// The same shape as handedness, above, and for the same reason: his sheet ROLLS the breed
	// (d100 on setRacialFeatures, sheet-worker.js:16736) and never asks. Off, the breed and its
	// evoke budget are rolled once when the character generator's Famorian block first sees the
	// race and then stand, with no re-roll button -- the restraint handedness's comment names:
	// a button that re-rolls until the breed you want comes up is the same as choosing it. On,
	// a dropdown picks the breed directly, with a roll button beside it for a GM who wants the
	// convenience of a die without giving up the honesty of it being a visible choice.
	game.settings.register("imagine-rpg", "famorianBreedSelectable", {
		name: "Players may choose Famorian breed",
		hint: "Off, as his sheet has it: a Famorian's breed -- Hidden, Trace, Low, Breed, High, "
		    + "True or Inbreed, which sets how many evokes it may take -- is rolled on d100. On: "
		    + "it is picked from a dropdown instead. Affects characters only, not creatures.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	// @MARKER PRICE LEVEL
	// Which of his seven price columns the character generator's shop charges -- see module/shop-rules.mjs.
	// The book makes it the Game Master's: "the GM determines if the cost for items is low, medium, or
	// high, depending upon the economics of his world setting" (Player's Guide p.207). His own sheet has a
	// Set Cost select on every purchase instead, defaulting to Free, which is a table tool; in creation it
	// would let a player spend nothing and ignore the money roll. So it is one world setting, Medium by
	// default, and a Game Master at the generator may still set a line's own level, Free included. The
	// sheet-side shop, when it comes, reads the same setting. The recommended default, taken 2026-09-23
	// while the user was away.
	game.settings.register("imagine-rpg", "priceLevel", {
		name: "Price level",
		hint: "What goods cost in this world, from his seven price columns: Quarter Low to Triple High. "
		    + "\"The GM determines if the cost for items is low, medium, or high, depending upon the "
		    + "economics of his world setting\" (Player's Guide p.207). Used by the character generator's shop.",
		scope: "world",
		config: true,
		type: String,
		choices: Object.fromEntries(PRICE_LEVELS.map(([tmpkey, tmplabel]) => [tmpkey, tmplabel])),
		default: DEFAULT_PRICE_LEVEL
	});

	// @MARKER CONTENT AVAILABILITY
	// Sourcebook and magic switches, individual overrides, and the check that stops disallowed
	// content being added to a character. See module/availability.mjs.
	registerAvailabilitySettings();
	registerAvailabilityEnforcement();

	// @MARKER CHARACTER GENERATOR
	// A Create Character button in the Actors directory. See module/apps/character-generator.mjs.
	registerCharacterGeneratorButton();

	// @MARKER CLASS ADVANCEMENT
	// Grants a title's class skills when the title is reached. See module/class-advancement.mjs.
	registerClassAdvancement();

	// @MARKER NATURAL WEAPONS
	// Gives a character their race's natural weapons when the race is added. See module/natural-weapons.mjs.
	registerNaturalWeapons();

	// @MARKER ROLLED STARTING ENDURANCE
	// Rolls a race's starting Endurance die (Gaunt's -1d4, Epitaph p.7) when the race is added to a
	// character. See module/race-endurance.mjs.
	registerRolledStartingEndurance();

	// @MARKER CHANGELOG
	// The What's New window and its Configure Settings button. See module/changelog.mjs.
	registerChangelog();

	game.settings.registerMenu("imagine-rpg", "availabilityMenu", {
		name: "Content Availability",
		label: "Configure",
		hint: "Switch sourcebooks and magic on or off for this campaign, and allow or forbid individual items such as a class.",
		icon: "fa-solid fa-book-open",
		type: ImagineAvailabilityConfig,
		restricted: true
	});
});

// @MARKER FIRST LAUNCH
// The content packs are built from JSON at runtime rather than compiled ahead of time, so a
// fresh world starts with none. Offer to build them once, and let the Game Master decline
// without being asked again.
Hooks.once("ready", async function () {
	if (!game.user.isGM) { return; }
	if (game.settings.get("imagine-rpg", "contentImported")) { return; }

	var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
		window: { title: "Imagine RPG" },
		content: `<p>This world has no Imagine content yet.</p>
		          <p>Build the compendium packs now? This creates roughly 2,800 skills, races,
		          classes, weapons, armour and equipment entries, and takes a moment.</p>
		          <p>You can run it later from a macro with
		          <code>game.imagine.importContent()</code>.</p>`,
		rejectClose: false,
		modal: true
	});

	// Recorded either way. Declining is an answer, and repeating the question is rude.
	await game.settings.set("imagine-rpg", "contentImported", true);
	if (tmpconfirmed) { await importAllContent(); }
});

// @MARKER WHAT'S NEW
// Every user, not only the Game Master: a player updating the system on their own machine is
// updating it too, and should see what changed. Shown once per version per user.
Hooks.once("ready", async function () {
	try { await showChangelogIfNew(); }
	catch (tmperror) { console.warn("Imagine RPG | the What's New window could not be shown", tmperror); }
});

// @MARKER ADD NEW sheet specific functions HERE
// @END (CODE)
