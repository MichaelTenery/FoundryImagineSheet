// @START (CODE)
// @MARKER CHARACTER GENERATOR WINDOW
//==================================================================================================================
// The window that walks a player through making a character, step by step, and creates it.
//
// It holds the choices and nothing else. What each step shows is worked out by
// buildGeneratorView (module/chargen-view.mjs), the rules by module/chargen-rules.mjs, and the
// character itself is assembled by assembleCharacter -- all three without Foundry, so all three
// are tested and previewed outside it. This file is only the Foundry face: reading the form,
// rolling the dice, loading the compendiums and creating the actor.
//
// Open it from the Create Character button in the Actors directory, or from a macro:
//     game.imagine.generateCharacter()
//==================================================================================================================

import { explainAvailability } from "../availability.mjs";
import { rollAttributeSets, rollHandedness, rollStartingAge, assembleCharacter, ATTRIBUTE_ORDER } from "../chargen-rules.mjs";
import { rollPhysique } from "../physique-rules.mjs";
import { getFamorianBreed, rollEvokeBudget } from "../famorian-rules.mjs";
import { STEPS, newGeneratorState, deriveGenerator, checkStep, buildGeneratorView, choicesFromState,
	colourChoices, rollStartingMoneyIfDue, getSecondRaceNames } from "../chargen-view.mjs";
import { describeStartingMoney } from "../starting-money.mjs";
import { addPurchase, describeCart, DEFAULT_PRICE_LEVEL } from "../shop-rules.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";
import { provideStartingLore } from "../starting-lore.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// The compendiums the generator draws from, as the content importer names them.
// The kit rules name items by the same names the equipment, armour and weapon packs carry, so
// those three are loaded as well -- without them the optional starting-kit rules would create
// every item by name only.
const CHARGEN_PACKS = { races: "world.imagine-races", classes: "world.imagine-classes", skills: "world.imagine-skills",
	equipment: "world.imagine-equipment", armor: "world.imagine-armor", weapons: "world.imagine-weapons" };

export default class ImagineCharacterGenerator extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "imagine-character-generator",
		tag: "form",
		classes: ["imagine", "character-generator"],
		window: { title: "Imagine RPG — New Character", resizable: true },
		position: { width: 760, height: 760 },
		// Enter in a text field submits the form; that only records the choices and redraws.
		form: { handler: ImagineCharacterGenerator.#onSubmit, submitOnChange: false, closeOnSubmit: false },
		actions: {
			nextStep:        ImagineCharacterGenerator.#onNextStep,
			previousStep:    ImagineCharacterGenerator.#onPreviousStep,
			goToStep:        ImagineCharacterGenerator.#onGoToStep,
			rollAttributes:  ImagineCharacterGenerator.#onRollAttributes,
			addSwap:         ImagineCharacterGenerator.#onAddSwap,
			removeSwap:      ImagineCharacterGenerator.#onRemoveSwap,
			rollHandedness:  ImagineCharacterGenerator.#onRollHandedness,
			rollFamorianBreed: ImagineCharacterGenerator.#onRollFamorianBreed,
			rollAge:         ImagineCharacterGenerator.#onRollAge,
			rollPhysique:    ImagineCharacterGenerator.#onRollPhysique,
			rollColours:     ImagineCharacterGenerator.#onRollColours,
			buyOffer:        ImagineCharacterGenerator.#onBuyOffer,
			removePurchase:  ImagineCharacterGenerator.#onRemovePurchase,
			searchShop:      ImagineCharacterGenerator.#onSearchShop,
			createCharacter: ImagineCharacterGenerator.#onCreateCharacter
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/character-generator.hbs", scrollable: [".chargen-body"] }
	};

	#state = newGeneratorState();
	#content = null;
	// True while Create is writing the character. Foundry runs a second click's action whatever the
	// first is still doing, so a double-click once made two identical characters (bug sweep 2026-09-23).
	#busy = false;

	// @MARKER DICE
	// This is the function which rolls one die, through Foundry's own random source so any dice
	// settings the world uses apply here as well.
	static #die(tmpsides) {
		return Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1;
	}

	// @MARKER CONTENT
	// This is the function which loads the races, classes and skills once, as plain data. A pack
	// that is missing -- content never imported -- loads as empty, and the window says so.
	async #loadContent() {
		if (this.#content) { return this.#content; }
		var tmpcontent = { races: [], classes: [], skills: [], equipment: [], armor: [], weapons: [] };
		for (const [tmpkey, tmpid] of Object.entries(CHARGEN_PACKS)) {
			var tmppack = game.packs.get(tmpid);
			if (!tmppack) { continue; }
			tmpcontent[tmpkey] = (await tmppack.getDocuments()).map(tmpdoc => tmpdoc.toObject());
		}
		this.#content = tmpcontent;
		return tmpcontent;
	}

	// This is the function which gives a test of whether the campaign's content switches allow an item.
	// The switches are read ONCE, when the test is made, rather than for every document it is asked
	// about: the Equipment step's shop asks it of some 1,800 items at a time, and each reading is four
	// settings.
	static #availability() {
		var tmprules = game.imagine.getAvailabilityRules();
		return (tmpdoc) => explainAvailability(tmpdoc, tmprules).available;
	}

	// @MARKER SHOP
	// This is the function which gives the shop what it needs from Foundry: the world's price level (the
	// "priceLevel" setting, module/imagine-rpg.mjs) and whether a Game Master is at the window, who alone
	// may set a line's own level or his Free. Read here, not in chargen-view.mjs, for the reason the
	// handedness setting is (see @MARKER HANDEDNESS below).
	static #shopOptions() {
		var tmplevel = DEFAULT_PRICE_LEVEL;
		try { tmplevel = game.settings.get("imagine-rpg", "priceLevel") || DEFAULT_PRICE_LEVEL; }
		catch (tmperr) { console.warn("Imagine RPG | the price level setting could not be read; Medium is used", tmperr); }
		return { priceLevel: tmplevel, isGM: !!game.user?.isGM };
	}

	// This is the function which works out the generator's whole picture -- deriveGenerator, with this
	// world's content switches and shop options.
	#derive() {
		return deriveGenerator(this.#state, this.#content, ImagineCharacterGenerator.#availability(),
			ImagineCharacterGenerator.#shopOptions());
	}

	// @MARKER FORM
	// This is the function which copies what is on screen into the choices. Only the current
	// step's inputs exist, so only its choices change.
	#captureForm() {
		if (!this.element) { return; }
		var tmpdata = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
		var tmpstate = this.#state;
		var tmplist = (tmpvalue) => Object.values(tmpvalue ?? {});

		// Attributes are rolled FOR a character type -- a Legendary gets the best of three sets -- so a
		// roll does not survive a change of type: kept, a Legendary's sets went on under Normal's
		// cheaper swaps (bug sweep 2026-09-23). The Roll button is always there to roll again.
		if ("charType" in tmpdata && (tmpdata.charType ?? "") !== tmpstate.charType && tmpstate.rolled) {
			tmpstate.rolled = null;
		}
		for (const tmpkey of ["name", "gender", "charType", "race1", "race2", "className", "chosenAttackSkill",
		                      "handedness", "frame", "hair", "eyes", "skin", "alignment"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = tmpdata[tmpkey] ?? ""; }
		}
		for (const tmpkey of ["age", "heightFeet", "heightInches", "weight"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = Number(tmpdata[tmpkey]) || 0; }
		}
		for (const tmpkey of ["slightPhysique", "manual", "override"]) {
			if (tmpkey in tmpdata) { tmpstate[tmpkey] = tmpdata[tmpkey] === true; }
		}
		if ("clothingStyle" in tmpdata) { tmpstate.clothingStyle = tmpdata.clothingStyle ?? "western"; }
		if ("randomLore" in tmpdata) { tmpstate.randomLore = tmpdata.randomLore === true; }
		if ("startingKit" in tmpdata) {
			for (const tmpkey of ["byCulture", "byStatus", "bySkills"]) {
				if (tmpkey in tmpdata.startingKit) {
					tmpstate.startingKit[tmpkey] = tmpdata.startingKit[tmpkey] === true;
				}
			}
		}
		if ("manualBase" in tmpdata) { tmpstate.manualBase = tmpdata.manualBase; }
		if ("swaps" in tmpdata) {
			tmpstate.swaps = tmplist(tmpdata.swaps).map(tmpswap => ({ to: tmpswap.to ?? "", from: tmplist(tmpswap.from) }));
		}
		if ("humanBonuses" in tmpdata) { tmpstate.humanBonuses = tmplist(tmpdata.humanBonuses); }
		if ("humanMoves" in tmpdata) { tmpstate.humanMoves = tmplist(tmpdata.humanMoves); }
		if ("languages" in tmpdata) {
			tmpstate.languages = tmplist(tmpdata.languages).map(tmplang => ({ name: tmplang.name ?? "", write: tmplang.write === true }));
		}
		if ("wealth" in tmpdata) { tmpstate.wealth = { ...tmpstate.wealth, ...tmpdata.wealth }; }

		// @MARKER SHOP
		// What the shop is showing. A new Type starts at every kind of it, since the kind chosen under
		// the last one is not one of this one's.
		if ("shop" in tmpdata) {
			var tmpshop = tmpdata.shop;
			if ("type" in tmpshop && tmpshop.type !== tmpstate.shop.type) {
				tmpstate.shop.type = tmpshop.type || "Weapon";
				tmpstate.shop.subtype = "";
			} else if ("subtype" in tmpshop) {
				tmpstate.shop.subtype = tmpshop.subtype ?? "";
			}
			if ("search" in tmpshop) { tmpstate.shop.search = tmpshop.search ?? ""; }
			if ("count" in tmpshop) { tmpstate.shop.count = Math.max(1, parseInt(tmpshop.count) || 1); }
		}
		// The list: each line's number, and -- for a Game Master only -- its price level. A line
		// brought down to nothing is taken off, as his sheet refuses to add "less than one item".
		if ("purchases" in tmpdata) {
			for (const [tmpindex, tmpline] of Object.entries(tmpdata.purchases ?? {})) {
				var tmppurchase = tmpstate.purchases[parseInt(tmpindex)];
				if (!tmppurchase) { continue; }
				if ("count" in tmpline) { tmppurchase.count = parseInt(tmpline.count) || 0; }
				if ("level" in tmpline && game.user?.isGM) { tmppurchase.level = tmpline.level ?? ""; }
			}
			tmpstate.purchases = tmpstate.purchases.filter(tmppurchase => (parseInt(tmppurchase.count) || 0) > 0);
		}

		// @MARKER FAMORIAN
		if ("famorianAnimalType" in tmpdata) { tmpstate.famorian.animalType = tmpdata.famorianAnimalType ?? ""; }
		// A new breed needs a new budget roll -- but every change event re-reads the select's
		// CURRENT value regardless of whether it actually changed, so the reset only fires when
		// the value is genuinely different, or a real roll would be thrown away on every keystroke
		// elsewhere on the step.
		if ("famorianBreed" in tmpdata && tmpdata.famorianBreed !== tmpstate.famorian.breed) {
			tmpstate.famorian.breed = tmpdata.famorianBreed ?? "";
			tmpstate.famorian.evokesAllowed = 0;
		}
		// The evoke checkboxes share one name, the same reason the two skill pick lists do below.
		if (tmpstate.step == STEPS.indexOf("Race")) {
			tmpstate.famorian.evokes = [...this.element.querySelectorAll("input[name='famorianEvoke']:checked")].map(tmpbox => tmpbox.value);
		}

		// The two skill pick lists are many checkboxes sharing one name, which the form data object
		// would fold into one value, so they are read straight off the page.
		if (tmpstate.step == STEPS.indexOf("Skills")) {
			tmpstate.racialSkillNames = [...this.element.querySelectorAll("input[name='racialPick']:checked")].map(tmpbox => tmpbox.value);
			tmpstate.socialSkillNames = [...this.element.querySelectorAll("input[name='socialPick']:checked")].map(tmpbox => tmpbox.value);
		}
		// A new first race can leave the second one no longer a fertile partner, and carries no
		// Famorian breed, animal type or evokes of its own -- resetting here stops anything chosen
		// for an earlier Famorian leaking onto whatever race was picked afterwards.
		//
		// A Formless's second race is its HOST, offered from formlessHosts, not fertileWith (the Race
		// step's list, chargen-view.mjs) -- a Formless is fertile with no one, so testing fertileWith
		// here once wiped every host chosen on the next change, and every Formless made was a bare
		// psyche (bug sweep 2026-09-23). The same list the step offers is the one kept.
		var tmpfirst = (this.#content?.races ?? []).find(tmpdoc => tmpdoc.name == tmpstate.race1);
		var tmpsecondallowed = getSecondRaceNames(tmpfirst);
		if (tmpstate.race2 && !tmpsecondallowed.includes(tmpstate.race2)) {
			tmpstate.race2 = "";
		}
		if (!tmpfirst?.system?.famorian?.isFamorian) {
			tmpstate.famorian = { breed: "", animalType: "", evokesAllowed: 0, evokes: [],
			                      strBonus: 0, aglBonus: 0, vitBonus: 0 };
		}
	}

	// @MARKER RENDERING
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpcontent = await this.#loadContent();

		// @MARKER HANDEDNESS
		// Rolled as soon as a race is known, unless the Game Master has ticked the setting -- his
		// determineHandedness fires the moment a race is applied, so waiting for the player to
		// reach the Details step and press a button would be a choice about WHEN, which is still
		// a choice. Guarded on being blank so it rolls once and then stands: this runs on every
		// render, and a re-roll on each keystroke would be a slot machine.
		// The setting is read here rather than inside chargen-view.mjs on purpose. That module and
		// chargen-rules.mjs are pure and Foundry-free, which is what lets tools/chargen-test.html
		// import and drive them with no Foundry present; reaching for game.settings there would
		// end that.
		tmpcontext.handednessSelectable = game.settings.get("imagine-rpg", "handednessSelectable");
		if (!tmpcontext.handednessSelectable && !this.#state.handedness) {
			var tmpderived = this.#derive();
			if (tmpderived.race) {
				this.#state.handedness = rollHandedness(tmpderived.race.abilities ?? [],
					ImagineCharacterGenerator.#die);
			}
		}

		// @MARKER FAMORIAN
		// Rolled the same way and for the same reason as handedness above -- his sheet rolls the
		// breed the moment the race is applied (setRacialFeatures, 16736) -- with the budget rolled
		// straight after, since a breed with no evoke count yet is not a usable breed. Both are
		// guarded on being blank, so they roll once and stand; the three attribute evokes are
		// rolled the moment they are TAKEN and dropped the moment they are not, since unlike the
		// breed they are a repeatable choice rather than a single roll at the top of the step.
		tmpcontext.famorianBreedSelectable = game.settings.get("imagine-rpg", "famorianBreedSelectable");
		var tmpfamderived = this.#derive();
		if (tmpfamderived.race1?.system?.famorian?.isFamorian) {
			var tmpfam = this.#state.famorian;
			var tmpbreeds = tmpfamderived.race1.system.famorian.breeds;
			if (!tmpcontext.famorianBreedSelectable && !tmpfam.breed) {
				var tmpband = getFamorianBreed(tmpbreeds, ImagineCharacterGenerator.#die(100));
				if (tmpband) { tmpfam.breed = tmpband.breed; }
			}
			if (tmpfam.breed && !tmpfam.evokesAllowed) {
				var tmpchosenband = tmpbreeds.find(tmpone => tmpone.breed == tmpfam.breed);
				if (tmpchosenband) {
					var tmpbudget = rollEvokeBudget(tmpchosenband, ImagineCharacterGenerator.#die);
					tmpfam.evokesAllowed = (tmpbudget === null) ? -1 : tmpbudget;
				}
			}
			for (const tmpattr of ["str", "agl", "vit"]) {
				var tmpbonuskey = tmpattr + "Bonus";
				if (tmpfam.evokes.includes(tmpattr)) {
					if (!tmpfam[tmpbonuskey]) { tmpfam[tmpbonuskey] = ImagineCharacterGenerator.#die(3); }
				} else {
					tmpfam[tmpbonuskey] = 0;
				}
			}
		}

		// @MARKER STARTING MONEY
		// Rolled by itself the first time the Equipment step is drawn (the Details step until the shop
		// arrived, 2026-09-23), and again only if the character it was rolled for has since changed --
		// see startingMoneyIsDue in module/chargen-view.mjs for when, and why there is no re-roll
		// button. The state is set BEFORE the chat card is awaited, so a second render arriving in the
		// meantime finds the money already rolled and leaves it. A re-roll re-prices the shopping list
		// against the new purse, which is how a list that no longer fits comes to be marked.
		var tmpmoney = rollStartingMoneyIfDue(this.#state,
			this.#derive(), ImagineCharacterGenerator.#die);
		// The card has its own try: this runs while the window is being drawn, and a chat message that
		// could not be posted must not leave the player looking at a window that will not open.
		if (tmpmoney) {
			try {
				await ChatMessage.create({
					content: `<h3>${this.#state.name || "A new character"} counts their coins</h3>`
						+ `<div>${describeStartingMoney(tmpmoney)}</div>`,
					speaker: ChatMessage.getSpeaker()
				});
			} catch (tmperr) { console.error("Imagine RPG | the starting money roll could not be posted to chat", tmperr); }
		}

		Object.assign(tmpcontext, buildGeneratorView(this.#state, tmpcontent,
			ImagineCharacterGenerator.#availability(), ImagineCharacterGenerator.#shopOptions()));
		tmpcontext.noContent = !tmpcontent.races.length;
		return tmpcontext;
	}

	// Selects, checkboxes and numbers redraw the step as soon as they change, so everything that
	// follows from them -- the combined race, the final attributes, the class check, the slot
	// counts -- is always current. Text fields are read when a button is pressed instead, so typing
	// is never interrupted by a redraw.
	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);
		if (context.noContent) {
			ui.notifications.warn("No Imagine content found. The Game Master needs to import it first: game.imagine.importContent()");
		}
		for (const tmpinput of this.element.querySelectorAll("select, input[type='checkbox'], input[type='number']")) {
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
		var tmpblocker = checkStep(this.#state, this.#derive());
		if (tmpblocker) { ui.notifications.warn(tmpblocker); this.render(); return; }
		this.#state.step = Math.min(this.#state.step + 1, STEPS.length - 1);
		this.render();
	}

	static #onPreviousStep(event, target) {
		this.#captureForm();
		this.#state.step = Math.max(this.#state.step - 1, 0);
		this.render();
	}

	// This is the function which jumps back to a finished step from the step list.
	static #onGoToStep(event, target) {
		this.#captureForm();
		var tmpstep = parseInt(target.dataset.step);
		if (!isNaN(tmpstep) && tmpstep <= this.#state.step) { this.#state.step = tmpstep; }
		this.render();
	}

	// This is the function which rolls the attributes for the chosen character type, and puts
	// the rolls in the chat, as his sheet's rolling buttons do.
	static async #onRollAttributes(event, target) {
		this.#captureForm();
		this.#state.rolled = rollAttributeSets(this.#state.charType, ImagineCharacterGenerator.#die);
		this.#state.manual = false;
		var tmplines = this.#state.rolled.sets.map((tmpset, tmpindex) =>
			`<p>Set ${tmpindex + 1}: ` + ATTRIBUTE_ORDER.map(tmpkey => `${tmpkey.toUpperCase()} ${tmpset[tmpkey]}`).join(", ") + "</p>");
		await ChatMessage.create({ content: `<h3>${this.#state.name || "A new character"} rolls attributes</h3>${tmplines.join("")}`,
			speaker: ChatMessage.getSpeaker() });
		this.render();
	}

	static #onAddSwap(event, target) {
		this.#captureForm();
		this.#state.swaps.push({ to: "", from: [] });
		this.render();
	}

	static #onRemoveSwap(event, target) {
		this.#captureForm();
		this.#state.swaps.splice(parseInt(target.dataset.index), 1);
		this.render();
	}

	static #onRollHandedness(event, target) {
		this.#captureForm();
		var tmpderived = this.#derive();
		this.#state.handedness = rollHandedness(tmpderived.race?.abilities ?? [], ImagineCharacterGenerator.#die);
		this.render();
	}

	// The convenience roll offered beside the dropdown when "Players may choose Famorian breed" is
	// on -- see the setting's own comment in module/imagine-rpg.mjs. Re-rolls the budget too, since
	// a breed with the previous breed's evoke count is not a usable breed.
	static #onRollFamorianBreed(event, target) {
		this.#captureForm();
		var tmpderived = this.#derive();
		var tmpbreeds = tmpderived.race1?.system?.famorian?.breeds ?? [];
		var tmpband = getFamorianBreed(tmpbreeds, ImagineCharacterGenerator.#die(100));
		if (!tmpband) { this.render(); return; }
		this.#state.famorian.breed = tmpband.breed;
		var tmpbudget = rollEvokeBudget(tmpband, ImagineCharacterGenerator.#die);
		this.#state.famorian.evokesAllowed = (tmpbudget === null) ? -1 : tmpbudget;
		this.render();
	}

	static #onRollAge(event, target) {
		this.#captureForm();
		var tmpderived = this.#derive();
		this.#state.age = rollStartingAge(tmpderived.race?.ages, ImagineCharacterGenerator.#die);
		this.render();
	}

	// This is the function which creates the character. Its skills' starting bonuses are rolled
	// here, once, as his sheet rolls them when the skills are confirmed.
	// This is the function which rolls height, frame and weight together, his Apply Height/Frame
	// button (roll_apply_height_frame). They go together because his tables make them depend on
	// one another -- see the note at the top of module/physique-rules.mjs -- and because rolling
	// them one at a time would let a player re-roll a height until the weight suited them.
	//
	// It uses the character's FINAL attributes, race included, since the frame is read off
	// Strength less Agility and a racial modifier moves both.
	// @MARKER COLOURING
	// This is the function which picks hair, eyes and skin from the colours his tables say a member
	// of this race is found in -- the same lists the dropdowns offer, so rolling can never produce
	// a colour that could not have been chosen. Asked for on 2026-09-20: the fields were pick-only.
	//
	// Only fills what is still empty, so a player who has chosen a hair colour and wants the rest
	// decided for them does not lose it. Nothing is re-rolled; pressing it again fills any gaps and
	// leaves the rest alone, which is the same restraint the handedness roll shows for the same
	// reason.
	static async #onRollColours(event, target) {
		event.preventDefault();
		this.#captureForm();
		var tmpderived = this.#derive();
		var tmpraces = [tmpderived.race1, tmpderived.race2].filter(tmpdoc => tmpdoc);

		var tmpfilled = [];
		for (const tmpwhich of ["hair", "eyes", "skin"]) {
			if (this.#state[tmpwhich]) { continue; }
			var tmpoptions = colourChoices(tmpraces, tmpwhich, "").map(tmpoption => tmpoption.value);
			if (!tmpoptions.length) { continue; }
			this.#state[tmpwhich] = tmpoptions[ImagineCharacterGenerator.#die(tmpoptions.length) - 1];
			tmpfilled.push(`${tmpwhich} ${this.#state[tmpwhich]}`);
		}
		if (!tmpfilled.length) {
			ui.notifications.info("Nothing left to roll -- clear a colour to have it decided for you.");
		}
		this.render();
	}

	static async #onRollPhysique(event, target) {
		event.preventDefault();
		this.#captureForm();
		var tmpderived = this.#derive();
		var tmpfinals = tmpderived.finals ?? {};
		// The race names come from the DERIVED object, not from the choices. The choices hold
		// `race1` and `race2`; `raceNames` is what deriveGenerator builds out of them, dropping a
		// blank second race. Reading it off #state gave undefined, so rollPhysique was asked for
		// the physique of a character with no race at all -- it found no height table, returned no
		// height, and with no height there is no weight either. That is Daryl's "Rolling Age works.
		// Rolling Height does not" on 2026-09-20: age is rolled from the race's own ages object and
		// was never affected.
		// HIS names for the races, not the port's: a split form (Fairy(Winged), Maginos(Clay)) is a
		// name of ours and his getRaceHeightType and getRaceFrameType have never heard of it.
		var tmprolled = rollPhysique(tmpderived.raceSourceNames ?? tmpderived.raceNames ?? [],
			tmpfinals.str?.final ?? 0, tmpfinals.agl?.final ?? 0, ImagineCharacterGenerator.#die);

		if (tmprolled.height) {
			this.#state.heightFeet = tmprolled.height.feet;
			this.#state.heightInches = tmprolled.height.inchesPart;
		}
		if (tmprolled.frame) { this.#state.frame = tmprolled.frame; }
		if (tmprolled.weight) { this.#state.weight = tmprolled.weight.weight; }
		this.#state.physiqueIssues = tmprolled.issues;
		// The one-line account shown under the fields, so the roll is not only in chat.
		this.#state.physiqueSummary = [
			tmprolled.height ? `${tmprolled.height.type} build: ${tmprolled.height.low.feet}'${tmprolled.height.low.inches}" to ${tmprolled.height.high.feet}'${tmprolled.height.high.inches}"` : "",
			tmprolled.frame ? `${tmprolled.frame} frame (${tmprolled.frameType}, STR less AGL ${tmprolled.frameMeasure})` : "",
			tmprolled.weight ? `that frame at that height runs ${tmprolled.weight.low} to ${tmprolled.weight.high} lb` : ""
		].filter(tmppart => tmppart).join(" &mdash; ");

		var tmplines = [];
		if (tmprolled.height) {
			tmplines.push(`<div>Height: <strong>${tmprolled.height.feet}' ${tmprolled.height.inchesPart}"</strong>`
				+ ` &mdash; a ${tmprolled.height.type} race runs ${tmprolled.height.low.feet}'`
				+ ` ${tmprolled.height.low.inches}" to ${tmprolled.height.high.feet}' ${tmprolled.height.high.inches}"</div>`);
		}
		if (tmprolled.frame) {
			tmplines.push(`<div>Frame: <strong>${tmprolled.frame}</strong>`
				+ ` &mdash; a ${tmprolled.frameType} build, Strength less Agility ${tmprolled.frameMeasure}</div>`);
		}
		if (tmprolled.weight) {
			tmplines.push(`<div>Weight: <strong>${tmprolled.weight.weight} lb</strong>`
				+ ` &mdash; that frame at that height runs ${tmprolled.weight.low} to ${tmprolled.weight.high} lb</div>`);
		}
		for (const tmpissue of tmprolled.issues) { tmplines.push(`<div class="alarm">${tmpissue}</div>`); }

		await ChatMessage.create({
			content: `<h3>${this.#state.name || "A new character"} takes shape</h3>${tmplines.join("")}`,
			speaker: ChatMessage.getSpeaker()
		});
		this.render();
	}

	// @MARKER SHOP ACTIONS
	// This is the function which puts an offer on the shopping list, his ADD button: the number in the
	// No# box, at the world's price level, if the purse can pay for it after everything already on the
	// list. If not, his words -- "couldn`t afford N X. Nothing done." -- and nothing changes. Nothing is
	// paid yet; the list is paid for, line by line, when the character is created.
	static #onBuyOffer(event, target) {
		event.preventDefault();
		this.#captureForm();
		var tmpderived = this.#derive();
		if (this.#state.startingKit?.byCulture) {
			ui.notifications.warn("Gear by culture is taken instead of starting coins, so there is nothing to buy with.");
			this.render();
			return;
		}
		var tmpoptions = ImagineCharacterGenerator.#shopOptions();
		var tmpresult = addPurchase(this.#state.wealth, this.#state.purchases, tmpderived.catalog, tmpoptions.priceLevel,
			target.dataset.offer, this.#state.shop.count, tmpoptions, this.#state.name || "This character");
		if (!tmpresult.ok) { ui.notifications.warn(tmpresult.message); }
		else { this.#state.purchases = tmpresult.purchases; }
		this.render();
	}

	// This is the function which takes a line off the list.
	static #onRemovePurchase(event, target) {
		event.preventDefault();
		this.#captureForm();
		var tmpindex = parseInt(target.dataset.index);
		if (!isNaN(tmpindex)) { this.#state.purchases.splice(tmpindex, 1); }
		this.render();
	}

	// This is the function which runs the shop's search -- the text is read when a button is pressed,
	// as every text field in this window is, so typing is never interrupted by a redraw.
	static #onSearchShop(event, target) {
		event.preventDefault();
		this.#captureForm();
		this.render();
	}

	static async #onCreateCharacter(event, target) {
		if (this.#busy) { return; }
		this.#busy = true;
		try {
			await ImagineCharacterGenerator.#createCharacterNow.call(this, event, target);
		} finally {
			this.#busy = false;
		}
	}

	static async #createCharacterNow(event, target) {
		this.#captureForm();
		var tmpderived = this.#derive();
		// The Equipment step will not let a list that cannot be paid for past it, but the price level is a
		// world setting a Game Master can change while this window is open. A character is never made
		// owing money, nor with only part of what was on the list.
		if (tmpderived.cart?.blocked) {
			ui.notifications.warn(tmpderived.cart.issues[0] + " Go back to the Equipment step to remove it or buy fewer.");
			return;
		}
		var tmpassembled = assembleCharacter(choicesFromState(this.#state, tmpderived), this.#content, ImagineCharacterGenerator.#die);
		try {
			// The starting money's record, so the sheet's own "Roll starting money" (for characters the
			// generator never made) is not offered to this one as well. Gear by culture is a record too:
			// it was taken INSTEAD of coins.
			var tmpmoneyrecord = this.#state.startingKit?.byCulture ? "Gear by culture, taken instead of coins."
				: (this.#state.startingMoney ? describeStartingMoney(this.#state.startingMoney) : "Entered in the character generator.");
			var tmpactor = await Actor.create({ ...tmpassembled.actor, items: tmpassembled.items,
				flags: { "imagine-rpg": { startingMoney: tmpmoneyrecord } } });
			ui.notifications.info(`${tmpactor.name} is created.`);
			// @MARKER SHOP
			// What was bought, on one card. His add_item posts each purchase as it is made; the generator
			// makes them all at once, when the character is created, so they are posted together. Its own
			// try, as the money card's: a card that cannot be posted is not a failure to create.
			var tmpbought = describeCart(tmpderived.cart);
			if (tmpbought) {
				try {
					await ChatMessage.create({
						content: `<h3>${tmpactor.name} goes shopping</h3><div>${tmpbought}</div>`,
						speaker: ChatMessage.getSpeaker()
					});
				} catch (tmperr) { console.error("Imagine RPG | the purchases could not be posted to chat", tmperr); }
			}
			// His "Provide random lore", run on the character as created, because it reads what the
			// character model works out -- a skill's chance, Affinity, Fortune -- and there is no
			// working that out before the actor exists. module/starting-lore.mjs.
			// Its own try: a failure here is not a failure to create, and must not be reported as one.
			if (this.#state.randomLore) {
				try { await provideStartingLore(tmpactor); }
				catch (tmperr) {
					console.error("Imagine RPG | starting lore failed", tmperr);
					ui.notifications.warn(`${tmpactor.name} is created, but the starting lore could not be given (see the console). `
						+ "The Game Master can give it from the Magic & Lore tab.");
				}
			}
			this.close();
			tmpactor.sheet.render(true);
		} catch (err) {
			console.error("Imagine RPG | character creation failed", err);
			ui.notifications.error("The character could not be created. You may not have permission to create actors; ask the Game Master.");
		}
	}
}

// @MARKER DIRECTORY BUTTON
// This is the function which puts a Create Character button at the top of the Actors directory,
// for anyone allowed to create actors.
export function registerCharacterGeneratorButton() {
	Hooks.on("renderActorDirectory", (tmpapp, tmphtml) => {
		if (!game.user.can("ACTOR_CREATE")) { return; }
		var tmproot = (tmphtml instanceof HTMLElement) ? tmphtml : tmphtml[0];
		var tmpheader = tmproot?.querySelector(".header-actions");
		if (!tmpheader || tmpheader.querySelector(".imagine-chargen-button")) { return; }
		var tmpbutton = document.createElement("button");
		tmpbutton.type = "button";
		tmpbutton.className = "imagine-chargen-button";
		tmpbutton.innerHTML = `<i class="fa-solid fa-dice-d20"></i> Create Character`;
		tmpbutton.addEventListener("click", () => new ImagineCharacterGenerator().render(true));
		tmpheader.append(tmpbutton);
	});
}

// @END (CODE)
