// @START (CODE)
// @MARKER CREATURE GENERATOR WINDOW
//==================================================================================================================
// The window that walks a Game Master through designing a creature by the Master's Manual's Creature
// Creation Guide (pp.281-298), step by step, and creates it.
//
// It holds the choices and nothing else. What each step shows is worked out by buildCreatureGenView
// (module/creature-gen-view.mjs), the arithmetic by module/creature-gen-rules.mjs and the tables by
// module/creature-gen-tables.mjs, all three without Foundry, so all three are tested outside it
// (tools/creature-gen-test.html). This file is only the Foundry face: reading the form, rolling the
// dice, loading the compendiums and creating the actor -- the shape of the character generator
// (module/apps/character-generator.mjs), which it follows closely so the two windows feel the same.
//
// Open it from the Create Creature button in the Actors directory (Game Masters only), or from a macro:
//     game.imagine.generateCreature()
//==================================================================================================================

import { STEPS, newCreatureGenState, buildCreatureGenView, checkStep, deriveCreatureDesign, assembleFromState,
	enduranceDiceFor, rollAllAttributes } from "../creature-gen-view.mjs";
import { rollDice } from "../creature-gen-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// The compendiums the generator draws from, as the content importer names them. The three trait
// packs are read as one list, each document already carrying its category.
const CREATURE_GEN_PACKS = {
	skills: ["world.imagine-skills"],
	spells: ["world.imagine-spells"],
	invocations: ["world.imagine-invocations"],
	traits: ["world.imagine-abilities", "world.imagine-disabilities", "world.imagine-immunities"]
};

export default class ImagineCreatureGenerator extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "imagine-creature-generator",
		tag: "form",
		// character-generator as well as its own class, so the window takes the generator's layout rules
		// (styles/imagine-rpg.css, "The step-by-step window") without a second copy of them.
		classes: ["imagine", "character-generator", "creature-generator"],
		window: { title: "Imagine RPG — New Creature", resizable: true },
		position: { width: 800, height: 780 },
		form: { handler: ImagineCreatureGenerator.#onSubmit, submitOnChange: false, closeOnSubmit: false },
		actions: {
			nextStep:          ImagineCreatureGenerator.#onNextStep,
			previousStep:      ImagineCreatureGenerator.#onPreviousStep,
			goToStep:          ImagineCreatureGenerator.#onGoToStep,
			rollBaseWeight:    ImagineCreatureGenerator.#onRollBaseWeight,
			averageBaseWeight: ImagineCreatureGenerator.#onAverageBaseWeight,
			rollEndurance:     ImagineCreatureGenerator.#onRollEndurance,
			averageEndurance:  ImagineCreatureGenerator.#onAverageEndurance,
			rollAttributes:    ImagineCreatureGenerator.#onRollAttributes,
			resetBands:        ImagineCreatureGenerator.#onResetBands,
			addBoughtAttack:   ImagineCreatureGenerator.#onAddBoughtAttack,
			removeBoughtAttack: ImagineCreatureGenerator.#onRemoveBoughtAttack,
			resetMovement:     ImagineCreatureGenerator.#onResetMovement,
			addMovement:       ImagineCreatureGenerator.#onAddMovement,
			removeMovement:    ImagineCreatureGenerator.#onRemoveMovement,
			addAbility:        ImagineCreatureGenerator.#onAddAbility,
			removeAbility:     ImagineCreatureGenerator.#onRemoveAbility,
			addCustomAbility:  ImagineCreatureGenerator.#onAddCustomAbility,
			addSkill:          ImagineCreatureGenerator.#onAddSkill,
			removeSkill:       ImagineCreatureGenerator.#onRemoveSkill,
			addPower:          ImagineCreatureGenerator.#onAddPower,
			removePower:       ImagineCreatureGenerator.#onRemovePower,
			createCreature:    ImagineCreatureGenerator.#onCreateCreature
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/creature-generator.hbs", scrollable: [".chargen-body"] }
	};

	#state = newCreatureGenState();
	#content = null;
	// True while Create is writing the creature: a second click must not make a second creature.
	#busy = false;

	// @MARKER DICE
	// This is the function which rolls one die, through Foundry's own random source.
	static #die(tmpsides) {
		return Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1;
	}

	// @MARKER CONTENT
	// This is the function which loads the skills, spells, invocations and traits once, as plain data.
	// A pack that is missing loads as empty; the window still works, pricing unknown names by hand.
	async #loadContent() {
		if (this.#content) { return this.#content; }
		var tmpcontent = { skills: [], spells: [], invocations: [], traits: [], customAlignments: null };
		for (const [tmpkey, tmpids] of Object.entries(CREATURE_GEN_PACKS)) {
			for (const tmpid of tmpids) {
				var tmppack = game.packs.get(tmpid);
				if (!tmppack) { continue; }
				tmpcontent[tmpkey] = tmpcontent[tmpkey].concat((await tmppack.getDocuments()).map(tmpdoc => tmpdoc.toObject()));
			}
		}
		// The Game Master's custom alignments, for the Concept step's suggestion lists. Unreadable is none.
		try { tmpcontent.customAlignments = game.settings.get("imagine-rpg", "customAlignments") ?? null; }
		catch (tmperr) { console.warn("Imagine RPG | the custom alignments setting could not be read", tmperr); }
		this.#content = tmpcontent;
		return tmpcontent;
	}

	// @MARKER FORM
	// This is the function which copies what is on screen into the choices. Only the current step's
	// inputs exist, so only its choices change. A blank number is null -- "work it out" -- never 0.
	#captureForm() {
		if (!this.element) { return; }
		var tmpdata = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
		var tmpstate = this.#state;
		var tmpnullable = (tmpvalue) => (tmpvalue === "" || tmpvalue === null || tmpvalue === undefined || isNaN(Number(tmpvalue))) ? null : Number(tmpvalue);

		for (const tmpkey of ["name", "creatureType", "subtype", "lifecycle", "climate", "habitat", "alignment", "tendencies", "notes",
		                      "bodyType", "frame", "form", "sizeOverride", "attackChart", "hideKind", "attackNotes", "speedName",
		                      "baseWeightNote", "enduranceNote", "poisonType", "expNote"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = tmpdata[tmpkey] ?? ""; }
		}
		for (const tmpkey of ["heightFeet", "heightInches", "hidePoints"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = Math.max(0, Number(tmpdata[tmpkey]) || 0); }
		}
		for (const tmpkey of ["baseWeight", "weight", "endurance", "levelOverride", "expOverride"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = tmpnullable(tmpdata[tmpkey]); }
		}
		for (const tmpkey of ["hideOverCap", "shockImmune"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = tmpdata[tmpkey] === true; }
		}
		// A new body type or type starts the body figures afresh: a rolled base weight was rolled for a
		// height, and stands, but a typed weight or size was typed for the old body.
		if ("bands" in tmpdata) {
			tmpstate.bands = {};
			for (const [tmpkey, tmpband] of Object.entries(tmpdata.bands)) { if (tmpband) { tmpstate.bands[tmpkey] = tmpband; } }
		}
		if ("ratings" in tmpdata) {
			tmpstate.ratings = {};
			for (const [tmpkey, tmpvalue] of Object.entries(tmpdata.ratings)) {
				var tmpnumber = tmpnullable(tmpvalue);
				if (tmpnumber !== null) { tmpstate.ratings[tmpkey] = tmpnumber; }
			}
		}
		if ("standardAttacks" in tmpdata) {
			tmpstate.standardAttacks = {};
			for (const [tmpname, tmpdamage] of Object.entries(tmpdata.standardAttacks)) { if (tmpdamage) { tmpstate.standardAttacks[tmpname] = tmpdamage; } }
		}
		if ("boughtAttacks" in tmpdata) {
			for (const [tmpindex, tmprow] of Object.entries(tmpdata.boughtAttacks)) {
				var tmppick = tmpstate.boughtAttacks[parseInt(tmpindex)];
				if (!tmppick) { continue; }
				if ("damage" in tmprow) { tmppick.damage = tmprow.damage ?? ""; }
				if ("count" in tmprow) { tmppick.count = Math.max(1, parseInt(tmprow.count) || 1); }
			}
		}
		if ("gaits" in tmpdata) {
			for (const tmpkey of ["gallop", "fly", "swim", "hop"]) { tmpstate.gaits[tmpkey] = tmpdata.gaits[tmpkey] === true; }
		}
		// The movement list is read only while it is the Game Master's own: the worked-out one is drawn
		// read-only, and Edit copies it into the state first.
		if ("movementModes" in tmpdata && Array.isArray(tmpstate.movementModes)) {
			tmpstate.movementModes = Object.values(tmpdata.movementModes).map(tmprow => ({
				name: tmprow.name ?? "", hourly: Number(tmprow.hourly) || 0, tenSec: Number(tmprow.tenSec) || 0, oneSec: Number(tmprow.oneSec) || 0 }));
		}
		if ("abilities" in tmpdata) {
			for (const [tmpindex, tmprow] of Object.entries(tmpdata.abilities)) {
				var tmpability = tmpstate.abilities[parseInt(tmpindex)];
				if (tmpability && "count" in tmprow) { tmpability.count = Math.max(1, parseInt(tmprow.count) || 1); }
			}
		}
		if ("customAbilities" in tmpdata) {
			for (const [tmpindex, tmprow] of Object.entries(tmpdata.customAbilities)) {
				var tmpcustom = tmpstate.customAbilities[parseInt(tmpindex)];
				if (!tmpcustom) { continue; }
				if ("pp" in tmprow) { tmpcustom.pp = Number(tmprow.pp) || 0; }
				if ("list" in tmprow) { tmpcustom.list = tmprow.list || "animal"; }
			}
		}
		if ("skills" in tmpdata) {
			for (const [tmpindex, tmprow] of Object.entries(tmpdata.skills)) {
				var tmpskill = tmpstate.skills[parseInt(tmpindex)];
				if (!tmpskill) { continue; }
				if ("chance" in tmprow) { tmpskill.chance = Math.max(0, parseInt(tmprow.chance) || 0); }
				if ("pp" in tmprow) { tmpskill.pp = Math.max(0, parseInt(tmprow.pp) || 0); }
			}
		}
		if ("powers" in tmpdata) {
			for (const [tmpindex, tmprow] of Object.entries(tmpdata.powers)) {
				var tmppower = tmpstate.powers[parseInt(tmpindex)];
				if (!tmppower) { continue; }
				if ("uses" in tmprow) { tmppower.uses = Math.max(1, parseInt(tmprow.uses) || 1); }
				if ("atWill" in tmprow) { tmppower.atWill = tmprow.atWill === true; }
				if ("level" in tmprow) { tmppower.level = Math.max(0, parseInt(tmprow.level) || 0); }
			}
		}
		if ("expSpecials" in tmpdata) {
			tmpstate.expSpecials = {};
			for (const [tmpkey, tmpon] of Object.entries(tmpdata.expSpecials)) { if (tmpon === true) { tmpstate.expSpecials[tmpkey] = true; } }
		}
		// What is typed into the Add boxes, kept across a redraw so a redraw caused by another control
		// does not empty them. Not part of the design.
		this.#adding = {
			bought: tmpdata.addBought ?? "", boughtCount: parseInt(tmpdata.addBoughtCount) || 1,
			ability: tmpdata.addAbility ?? "", abilityCount: parseInt(tmpdata.addAbilityCount) || 1,
			customName: tmpdata.addCustomName ?? "", customList: tmpdata.addCustomList ?? "animal", customPP: Number(tmpdata.addCustomPP) || 0,
			skillName: tmpdata.addSkillName ?? "", skillChance: parseInt(tmpdata.addSkillChance) || 0, skillPP: parseInt(tmpdata.addSkillPP) || 0,
			powerName: tmpdata.addPowerName ?? "", powerUses: parseInt(tmpdata.addPowerUses) || 1, powerAtWill: tmpdata.addPowerAtWill === true,
			powerLevel: parseInt(tmpdata.addPowerLevel) || 0,
			moveName: tmpdata.addMoveName ?? ""
		};
	}
	#adding = {};

	// @MARKER RENDERING
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpcontent = await this.#loadContent();
		Object.assign(tmpcontext, buildCreatureGenView(this.#state, tmpcontent));
		tmpcontext.adding = this.#adding;
		tmpcontext.noContent = !tmpcontent.skills.length && !tmpcontent.traits.length;
		tmpcontext.isGM = !!game.user?.isGM;
		return tmpcontext;
	}

	// Selects, checkboxes and numbers redraw the step as soon as they change, so everything that
	// follows from them -- the weight, the size, the Endurance row, the PP, the level -- is always
	// current. Text fields are read when a button is pressed instead, so typing is never interrupted.
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
		if (context.noContent) {
			ui.notifications.warn("No Imagine content found. The Game Master needs to import it first: game.imagine.importContent(). The generator still works; unknown skills and powers are priced by hand.");
		}
		for (const tmpinput of this.element.querySelectorAll("select, input[type='checkbox'], input[type='number']")) {
			// The Add boxes' own number and select controls do not redraw: nothing follows from them.
			if (tmpinput.name?.startsWith("add")) { continue; }
			tmpinput.addEventListener("change", () => { this.#captureForm(); this.render(); });
		}
	}

	// @MARKER ACTION HANDLERS

	static #onSubmit(event, form, formData) {
		this.#captureForm();
		this.render();
	}

	// This is the function which moves on a step, if the current one is finished.
	static #onNextStep(event, target) {
		this.#captureForm();
		var tmpblocker = checkStep(this.#state, deriveCreatureDesign(this.#state, this.#content));
		if (tmpblocker) { ui.notifications.warn(tmpblocker); this.render(); return; }
		this.#state.step = Math.min(this.#state.step + 1, STEPS.length - 1);
		this.render();
	}

	static #onPreviousStep(event, target) {
		this.#captureForm();
		this.#state.step = Math.max(this.#state.step - 1, 0);
		this.render();
	}

	static #onGoToStep(event, target) {
		this.#captureForm();
		var tmpstep = parseInt(target.dataset.step);
		if (!isNaN(tmpstep) && tmpstep <= this.#state.step) { this.#state.step = tmpstep; }
		this.render();
	}

	// @MARKER BODY ACTIONS
	// This is the function which rolls the base weight for the height, the book's dice for its band
	// (MM p.284), and says so in chat as the character generator's physique roll does.
	static async #onRollBaseWeight(event, target) {
		this.#captureForm();
		var tmpderived = deriveCreatureDesign(this.#state, this.#content);
		var tmprow = tmpderived.baseWeightRow;
		if (!tmprow.dice) { ui.notifications.warn("No dice for this height; enter the weight."); this.render(); return; }
		this.#state.baseWeight = rollDice(tmprow.dice, ImagineCreatureGenerator.#die);
		this.#state.baseWeightNote = `rolled ${tmprow.dice}`;
		await ImagineCreatureGenerator.#say(this.#state.name, `Base weight: <strong>${this.#state.baseWeight} lb</strong> (${tmprow.dice}, the book's ${tmprow.low}-${tmprow.high} for this height)`);
		this.render();
	}

	static #onAverageBaseWeight(event, target) {
		this.#captureForm();
		this.#state.baseWeight = null;
		this.#state.baseWeightNote = "";
		this.render();
	}

	// This is the function which rolls Endurance for the size, the book's dice for its row (MM p.286).
	static async #onRollEndurance(event, target) {
		this.#captureForm();
		var tmpdice = enduranceDiceFor(this.#state, this.#content);
		this.#state.endurance = rollDice(tmpdice, ImagineCreatureGenerator.#die);
		this.#state.enduranceNote = `rolled ${tmpdice}`;
		await ImagineCreatureGenerator.#say(this.#state.name, `Endurance: <strong>${this.#state.endurance}</strong> (${tmpdice})`);
		this.render();
	}

	static #onAverageEndurance(event, target) {
		this.#captureForm();
		this.#state.endurance = null;
		this.#state.enduranceNote = "";
		this.render();
	}

	// @MARKER ATTRIBUTE ACTIONS
	// This is the function which rolls all twelve attributes from their bands, the book's "record this
	// range so that ... you will have created a creature template" with one instance rolled from it.
	static async #onRollAttributes(event, target) {
		this.#captureForm();
		this.#state.ratings = rollAllAttributes(this.#state, this.#content, ImagineCreatureGenerator.#die);
		var tmpline = Object.entries(this.#state.ratings).map(([tmpkey, tmpvalue]) => `${tmpkey.toUpperCase()} ${tmpvalue}`).join(", ");
		await ImagineCreatureGenerator.#say(this.#state.name, `Attributes rolled from their bands: ${tmpline}`);
		this.render();
	}

	// This is the function which puts every band back to what the size and type suggest, and every
	// rating back to its band's average.
	static #onResetBands(event, target) {
		this.#captureForm();
		this.#state.bands = {};
		this.#state.ratings = {};
		this.render();
	}

	// @MARKER COMBAT ACTIONS
	static #onAddBoughtAttack(event, target) {
		this.#captureForm();
		var tmpname = this.#adding.bought;
		if (!tmpname) { ui.notifications.warn("Choose an attack to add."); this.render(); return; }
		this.#state.boughtAttacks.push({ name: tmpname, damage: "", count: Math.max(1, this.#adding.boughtCount || 1) });
		this.#adding.bought = "";
		this.render();
	}

	static #onRemoveBoughtAttack(event, target) {
		this.#captureForm();
		var tmpindex = parseInt(target.dataset.index);
		if (!isNaN(tmpindex)) { this.#state.boughtAttacks.splice(tmpindex, 1); }
		this.render();
	}

	// @MARKER MOVEMENT ACTIONS
	// Edit copies the worked-out modes into the state, where they can be changed; Reset throws the
	// copy away and the book's figures come back.
	static #onResetMovement(event, target) {
		this.#captureForm();
		var tmpderived = deriveCreatureDesign(this.#state, this.#content);
		this.#state.movementModes = Array.isArray(this.#state.movementModes) ? null : tmpderived.movementAuto.map(tmpmode => ({ ...tmpmode }));
		this.render();
	}

	static #onAddMovement(event, target) {
		this.#captureForm();
		var tmpderived = deriveCreatureDesign(this.#state, this.#content);
		if (!Array.isArray(this.#state.movementModes)) { this.#state.movementModes = tmpderived.movementAuto.map(tmpmode => ({ ...tmpmode })); }
		this.#state.movementModes.push({ name: this.#adding.moveName || "Other", hourly: 0, tenSec: 0, oneSec: 0 });
		this.#adding.moveName = "";
		this.render();
	}

	static #onRemoveMovement(event, target) {
		this.#captureForm();
		var tmpindex = parseInt(target.dataset.index);
		if (Array.isArray(this.#state.movementModes) && !isNaN(tmpindex)) { this.#state.movementModes.splice(tmpindex, 1); }
		this.render();
	}

	// @MARKER ABILITY ACTIONS
	static #onAddAbility(event, target) {
		this.#captureForm();
		// The select's value is "list|name" (creature-gen-view.mjs): a name can be on two lists.
		var tmpparts = ("" + (this.#adding.ability ?? "")).split("|");
		var tmplist = tmpparts.length > 1 ? tmpparts[0] : "";
		var tmpname = tmpparts.length > 1 ? tmpparts.slice(1).join("|") : tmpparts[0];
		if (!tmpname) { ui.notifications.warn("Choose an ability to add."); this.render(); return; }
		// The same ability twice is one row with a higher count (the chapter's "4 PP per spike").
		var tmpexisting = this.#state.abilities.find(tmppick => tmppick.name == tmpname && (tmppick.list ?? "") == tmplist);
		if (tmpexisting) { tmpexisting.count = Math.max(1, parseInt(tmpexisting.count) || 1) + Math.max(1, this.#adding.abilityCount || 1); }
		else { this.#state.abilities.push({ name: tmpname, list: tmplist, count: Math.max(1, this.#adding.abilityCount || 1) }); }
		this.#adding.ability = "";
		this.render();
	}

	static #onRemoveAbility(event, target) {
		this.#captureForm();
		var tmpindex = parseInt(target.dataset.index);
		var tmpcount = this.#state.abilities.length;
		if (isNaN(tmpindex)) { this.render(); return; }
		// Rows are drawn in one list, the chosen abilities first and then the custom ones.
		if (tmpindex < tmpcount) { this.#state.abilities.splice(tmpindex, 1); }
		else { this.#state.customAbilities.splice(tmpindex - tmpcount, 1); }
		this.render();
	}

	// "Players are free to create new types of abilities, and should give an appropriate power point
	// cost when doing so." (MM p.293)
	static #onAddCustomAbility(event, target) {
		this.#captureForm();
		var tmpname = (this.#adding.customName ?? "").trim();
		if (!tmpname) { ui.notifications.warn("Name the ability."); this.render(); return; }
		this.#state.customAbilities.push({ name: tmpname, list: this.#adding.customList || "animal", pp: this.#adding.customPP || 0, note: "An ability of the Game Master's own." });
		this.#adding.customName = ""; this.#adding.customPP = 0;
		this.render();
	}

	static #onAddSkill(event, target) {
		this.#captureForm();
		var tmpname = (this.#adding.skillName ?? "").trim();
		if (!tmpname) { ui.notifications.warn("Name the skill."); this.render(); return; }
		this.#state.skills.push({ name: tmpname, chance: this.#adding.skillChance || 0, pp: this.#adding.skillPP || 0 });
		this.#adding.skillName = ""; this.#adding.skillChance = 0; this.#adding.skillPP = 0;
		this.render();
	}

	static #onRemoveSkill(event, target) {
		this.#captureForm();
		var tmpindex = parseInt(target.dataset.index);
		if (!isNaN(tmpindex)) { this.#state.skills.splice(tmpindex, 1); }
		this.render();
	}

	static #onAddPower(event, target) {
		this.#captureForm();
		var tmpname = (this.#adding.powerName ?? "").trim();
		if (!tmpname) { ui.notifications.warn("Name the spell or invocation."); this.render(); return; }
		this.#state.powers.push({ name: tmpname, uses: Math.max(1, this.#adding.powerUses || 1), atWill: !!this.#adding.powerAtWill, level: this.#adding.powerLevel || 0 });
		this.#adding.powerName = ""; this.#adding.powerUses = 1; this.#adding.powerAtWill = false; this.#adding.powerLevel = 0;
		this.render();
	}

	static #onRemovePower(event, target) {
		this.#captureForm();
		var tmpindex = parseInt(target.dataset.index);
		if (!isNaN(tmpindex)) { this.#state.powers.splice(tmpindex, 1); }
		this.render();
	}

	// @MARKER CREATE
	static async #onCreateCreature(event, target) {
		if (this.#busy) { return; }
		this.#busy = true;
		try {
			await ImagineCreatureGenerator.#createCreatureNow.call(this, event, target);
		} finally {
			this.#busy = false;
		}
	}

	static async #createCreatureNow(event, target) {
		this.#captureForm();
		var tmpassembled = assembleFromState(this.#state, this.#content);
		try {
			var tmpactor = await Actor.create({ ...tmpassembled.actor, items: tmpassembled.items,
				flags: { "imagine-rpg": { creatureDesign: foundry.utils.deepClone(this.#state) } } });
			ui.notifications.info(`${tmpactor.name} is created.`);
			var tmpderived = deriveCreatureDesign(this.#state, this.#content);
			await ImagineCreatureGenerator.#say(tmpactor.name,
				`<div>${tmpderived.size} ${this.#state.creatureType}, level <strong>${tmpderived.level}</strong>`
				+ ` (base ${tmpderived.baseLevel} + ${tmpderived.levelAuto.fromPoints} from ${tmpderived.powerPoints.total} PP${tmpderived.levelOverridden ? ", set by hand" : ""}).</div>`
				+ `<div>Endurance ${tmpderived.endurance}, hide ${tmpderived.hide.points}, ${tmpderived.weight} lb. Experience value <strong>${tmpderived.expValue}</strong>.</div>`);
			this.close();
			tmpactor.sheet.render(true);
		} catch (err) {
			console.error("Imagine RPG | creature creation failed", err);
			ui.notifications.error("The creature could not be created. See the console.");
		}
	}

	// This is the function which puts a line in the chat for the Game Master, as the character
	// generator's rolls do. Its own try: a card that cannot be posted is not a failure of the window.
	static async #say(tmpname, tmphtml) {
		try {
			await ChatMessage.create({
				content: `<h3>${foundry.utils.escapeHTML(tmpname || "A new creature")}</h3>${tmphtml}`,
				speaker: ChatMessage.getSpeaker(),
				whisper: ChatMessage.getWhisperRecipients("GM").map(tmpuser => tmpuser.id)
			});
		} catch (tmperr) { console.error("Imagine RPG | the creature generator could not post to chat", tmperr); }
	}
}

// @MARKER DIRECTORY BUTTON
// This is the function which puts a Create Creature button at the top of the Actors directory, beside
// Create Character, for Game Masters -- a creature is the Game Master's to make.
export function registerCreatureGeneratorButton() {
	Hooks.on("renderActorDirectory", (tmpapp, tmphtml) => {
		if (!game.user.isGM) { return; }
		var tmproot = (tmphtml instanceof HTMLElement) ? tmphtml : tmphtml[0];
		var tmpheader = tmproot?.querySelector(".header-actions");
		if (!tmpheader || tmpheader.querySelector(".imagine-creaturegen-button")) { return; }
		var tmpbutton = document.createElement("button");
		tmpbutton.type = "button";
		tmpbutton.className = "imagine-creaturegen-button";
		tmpbutton.innerHTML = `<i class="fa-solid fa-dragon"></i> Create Creature`;
		tmpbutton.addEventListener("click", () => new ImagineCreatureGenerator().render(true));
		tmpheader.append(tmpbutton);
	});
}

// @END (CODE)
