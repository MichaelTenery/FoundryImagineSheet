// @START (CODE)
// @MARKER ITEM PICKER
//==================================================================================================================
// A searchable list of the system's own content, for putting a real item on a character.
//
// WHY THIS EXISTS. The system's content lives in COMPENDIA -- world.imagine-weapons and its eight
// siblings, built by the importer -- and nothing is ever put in Foundry's Items sidebar. That is
// deliberate: four and a half thousand documents in the sidebar would bury whatever a Game Master
// actually made themselves. But it left a dead end, which Daryl walked into on 2026-09-21: "the
// items menu is empty, so I can't add items to my character". The Items directory IS empty, and
// the Equipment tab's Add buttons made a blank "New Weapon" rather than offering the 594 real
// ones. Dragging out of an open compendium window was the only way to get a real item onto a
// character, and nothing said so.
//
// So the Add buttons open this instead. The blank item is still one click away, for homebrew.
//
// Availability is honoured: a weapon from a sourcebook the campaign has switched off does not
// appear, the same rule the character generator applies to races and classes.
//==================================================================================================================

import { explainAvailability } from "../availability.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";
import { MAGIC_KINDS, getItemKind, getSkillStanding, resolveLoreLearn, isLoreSuccess,
         makePotionRecipe } from "../lore-rules.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// Which compendium each thing is picked from, and how to name it on screen. The first three are
// gear, by item type. The rest are the Magic & Lore tab's, by his kind: several kinds share one
// compendium (every lore is in world.imagine-lore) and are told apart by system.kind, which is why
// "kind" is here and the index is filtered by it.
//
// A potion RECIPE is picked from the potions -- a recipe is knowing how to make one -- and becomes
// a lore item on the way (makePotionRecipe). A poison is not picked at all: his poisons are built
// from a type and a potency, so the tab has its own small form for them.
// MAGIC says the entry is magic -- a dose or a lore known, never added twice, the Magic & Lore tab's --
// rather than gear. It was once worked out as "the item type is not the picker's own key", which is
// false for spells and invocations (both keyed by their type), so the same spell could be added over
// and over and memorized twice (bug sweep 2026-09-23). Said outright now.
const PICKER_PACKS = {
	//  what           compendium                          item type          kind                  magic        heading
	weapon:        { pack: "world.imagine-weapons",     type: "weapon",     kind: "",              magic: false, label: "Weapon" },
	armor:         { pack: "world.imagine-armor",       type: "armor",      kind: "",              magic: false, label: "Armour" },
	equipment:     { pack: "world.imagine-equipment",   type: "equipment",  kind: "",              magic: false, label: "Equipment" },
	herb:          { pack: "world.imagine-consumables", type: "consumable", kind: "herb",          magic: true,  label: "Herb" },
	potion:        { pack: "world.imagine-consumables", type: "consumable", kind: "potion",        magic: true,  label: "Potion" },
	elixir:        { pack: "world.imagine-consumables", type: "consumable", kind: "elixir",        magic: true,  label: "Elixir" },
	charm:         { pack: "world.imagine-consumables", type: "consumable", kind: "charm",         magic: true,  label: "Charm" },
	potionrecipe:  { pack: "world.imagine-consumables", type: "lore",       kind: "potion",        magic: true,  label: "Potion recipe", becomes: "potionrecipe" },
	ballad:        { pack: "world.imagine-lore",        type: "lore",       kind: "ballad",        magic: true,  label: "Ballad" },
	candlelore:    { pack: "world.imagine-lore",        type: "lore",       kind: "candlelore",    magic: true,  label: "Candle ritual" },
	empathymagic:  { pack: "world.imagine-lore",        type: "lore",       kind: "empathymagic",  magic: true,  label: "Empathy ritual" },
	glyph:         { pack: "world.imagine-lore",        type: "lore",       kind: "glyph",         magic: true,  label: "Glyph" },
	hymn:          { pack: "world.imagine-lore",        type: "lore",       kind: "hymn",          magic: true,  label: "Hymn" },
	poem:          { pack: "world.imagine-lore",        type: "lore",       kind: "poem",          magic: true,  label: "Poem" },
	ritual:        { pack: "world.imagine-lore",        type: "lore",       kind: "ritual",        magic: true,  label: "Ritual" },
	rune:          { pack: "world.imagine-lore",        type: "lore",       kind: "rune",          magic: true,  label: "Rune" },
	song:          { pack: "world.imagine-lore",        type: "lore",       kind: "song",          magic: true,  label: "Song" },
	sympathymagic: { pack: "world.imagine-lore",        type: "lore",       kind: "sympathymagic", magic: true,  label: "Sympathy ritual" },
	evoke:         { pack: "world.imagine-lore",        type: "lore",       kind: "evoke",         magic: true,  label: "Evoke" },
	// A spell's and an invocation's kind is their item type (getItemKind), which "becomes" says, so the
	// "already known" test finds one already held.
	spell:         { pack: "world.imagine-spells",      type: "spell",      kind: "",              magic: true,  label: "Spell", becomes: "spell" },
	invocation:    { pack: "world.imagine-invocations", type: "invocation", kind: "",              magic: true,  label: "Invocation", becomes: "invocation" }
};

// The kind an item made by this picker ends up as -- a potion recipe is picked FROM the potions.
function resultKind(tmpdefinition) {
	return tmpdefinition.becomes ?? tmpdefinition.kind;
}

// Long lists are cut to this until a search narrows them. Nine hundred rows of armour render
// slowly and read worse; the count above the list always says how many matched in full.
const PICKER_SHOWN = 60;

export default class ImagineItemPicker extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "imagine-item-picker",
		classes: ["imagine", "item-picker"],
		window: { title: "Imagine RPG — Add an item", resizable: true },
		position: { width: 560, height: 620 },
		actions: {
			pickItem:  ImagineItemPicker.#onPickItem,
			blankItem: ImagineItemPicker.#onBlankItem
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/item-picker.hbs", scrollable: [".picker-body"] }
	};

	#actor = null;
	#type = "equipment";
	#search = "";
	#entries = null;
	// His learn roll, for a lore he learns with a skill: on, as his add buttons always roll. Off
	// adds the entry outright -- for a Game Master handing one out, or a sheet being caught up.
	#learnByRoll = true;

	constructor(tmpactor, tmptype, tmpoptions) {
		super(tmpoptions ?? {});
		this.#actor = tmpactor;
		this.#type = PICKER_PACKS[tmptype] ? tmptype : "equipment";
	}

	// The skill his add button rolls to learn this kind, or "" for a kind that is simply added.
	get #learnSkill() {
		return MAGIC_KINDS[resultKind(PICKER_PACKS[this.#type])]?.learn ?? "";
	}

	get title() {
		return `Add ${(PICKER_PACKS[this.#type]?.label ?? "Equipment").toLowerCase()} to ${this.#actor?.name ?? ""}`;
	}

	// @MARKER CONTENT
	// This is the function which loads the pack once, as plain index data rather than documents.
	// The index carries the name and the type, which is all the list needs; the document itself is
	// only fetched for the one entry actually picked. Loading 594 weapons as documents to show a
	// list of names would be slow for no gain.
	async #loadEntries() {
		if (this.#entries) { return this.#entries; }
		var tmpdefinition = PICKER_PACKS[this.#type];
		var tmppack = game.packs.get(tmpdefinition.pack);
		if (!tmppack) { this.#entries = []; return this.#entries; }

		var tmprules = game.imagine?.getAvailabilityRules?.() ?? null;
		var tmpindex = await tmppack.getIndex({ fields: ["system.sourcebook", "system.types", "system.kind",
			"system.subsystem", "system.level", "system.rating"] });
		this.#entries = tmpindex
			.map(tmpentry => ({ id: tmpentry._id, name: tmpentry.name, type: tmpentry.type,
			                    system: tmpentry.system ?? {} }))
			.filter(tmpentry => !tmpdefinition.kind || tmpentry.system.kind == tmpdefinition.kind)
			.filter(tmpentry => explainAvailability(tmpentry, tmprules).available)
			.sort((a, b) => a.name.localeCompare(b.name));
		return this.#entries;
	}

	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpall = await this.#loadEntries();
		var tmpneedle = this.#search.trim().toLowerCase();
		var tmpmatched = tmpneedle
			? tmpall.filter(tmpentry => tmpentry.name.toLowerCase().includes(tmpneedle))
			: tmpall;

		tmpcontext.label = PICKER_PACKS[this.#type].label;
		// What a row shows beside the name: a spell's or invocation's level, a lore's rating.
		for (const tmpentry of tmpmatched.slice(0, PICKER_SHOWN)) {
			tmpentry.detail = tmpentry.system.level ? `level ${tmpentry.system.level}`
				: (tmpentry.system.rating ? `rating ${tmpentry.system.rating}` : "");
		}
		tmpcontext.learnSkill = this.#learnSkill;
		tmpcontext.learnByRoll = this.#learnByRoll;
		tmpcontext.isMagic = !!PICKER_PACKS[this.#type].magic;
		if (this.#learnSkill) {
			var tmpstanding = getSkillStanding(this.#actor?.items?.filter(i => i.type == "skill"),
				this.#learnSkill, this.#actor?.system?.identity?.title);
			tmpcontext.learnChance = tmpstanding.held ? tmpstanding.chance : 0;
			tmpcontext.learnHeld = tmpstanding.held;
		}
		tmpcontext.search = this.#search;
		tmpcontext.total = tmpall.length;
		tmpcontext.matched = tmpmatched.length;
		tmpcontext.shown = tmpmatched.slice(0, PICKER_SHOWN);
		tmpcontext.truncated = tmpmatched.length > PICKER_SHOWN;
		tmpcontext.limit = PICKER_SHOWN;
		tmpcontext.noContent = !tmpall.length;
		return tmpcontext;
	}

	_onRender(context, options) {
		super._onRender?.(context, options);
		applySheetTheme(this.element);

		// Typing filters as it goes, and the box keeps focus and caret across the re-render it
		// causes -- a search that jumped to the end of the text on every keystroke would be
		// unusable on a list this size.
		var tmplearn = this.element.querySelector("input[name='learnByRoll']");
		tmplearn?.addEventListener("change", (tmpevent) => { this.#learnByRoll = tmpevent.target.checked; });

		var tmpsearch = this.element.querySelector("input[name='search']");
		if (!tmpsearch) { return; }
		tmpsearch.addEventListener("input", (tmpevent) => {
			this.#search = tmpevent.target.value;
			this.render();
		});
		if (this.#search) {
			tmpsearch.focus();
			tmpsearch.setSelectionRange(tmpsearch.value.length, tmpsearch.value.length);
		}
	}

	// @MARKER ACTIONS
	// This is the function which puts the chosen item on the character. The full document is
	// fetched now, so the item carries every field the compendium entry has rather than the few
	// the index holds.
	static async #onPickItem(event, target) {
		event.preventDefault();
		var tmpid = target.dataset.id;
		var tmppack = game.packs.get(PICKER_PACKS[this.#type].pack);
		var tmpdoc = tmpid ? await tmppack?.getDocument(tmpid) : null;
		if (!tmpdoc) { ui.notifications.warn("That item could not be loaded."); return; }

		var tmpdata = tmpdoc.toObject();
		delete tmpdata._id;
		var tmpdefinition = PICKER_PACKS[this.#type];
		if (tmpdefinition.magic) {
			await this.#pickMagic(tmpdata, tmpdefinition);
			this.render();
			return;
		}
		// Carried, not equipped: a thing just acquired is in a pack, not in a hand.
		tmpdata.system = { ...tmpdata.system, location: "carried" };
		await this.#actor.createEmbeddedDocuments("Item", [tmpdata]);
		ui.notifications.info(`${tmpdoc.name} added to ${this.#actor.name}, carried.`);

		// Left open on purpose: kitting a character out is many additions, not one, and reopening
		// the window and retyping the search for each would be its own annoyance.
		this.render();
	}

	// @MARKER MAGIC
	// This is the function which puts a Magic & Lore entry on the character.
	//
	//     a consumable      added to the stack already carried, one dose more, or a new stack of one
	//     a known entry     never twice; and for a lore learned with a skill, his learn roll first --
	//                       learnNewBallad and its siblings (sheet-worker.js:136744): the lore skill,
	//                       no entry modifier, 200% learns outright, a natural 100 fails
	async #pickMagic(tmpdata, tmpdefinition) {
		var tmpkind = resultKind(tmpdefinition);
		var tmpactor = this.#actor;

		if (tmpdefinition.type == "consumable") {
			var tmpstack = tmpactor.items.find(tmpitem => tmpitem.type == "consumable"
				&& tmpitem.system.kind == tmpkind && tmpitem.name == tmpdata.name);
			if (tmpstack) {
				var tmpnow = (parseInt(tmpstack.system.doses) || 0) + 1;
				await tmpstack.update({ "system.doses": tmpnow });
				ui.notifications.info(`${tmpdata.name}: ${tmpactor.name} now carries ${tmpnow}.`);
			} else {
				tmpdata.system.doses = 1;
				await tmpactor.createEmbeddedDocuments("Item", [tmpdata]);
				ui.notifications.info(`${tmpdata.name} added to ${tmpactor.name}.`);
			}
			return;
		}

		if (tmpkind == "potionrecipe") {
			tmpdata = { name: tmpdata.name, type: "lore", img: tmpdata.img, system: makePotionRecipe(tmpdata.system) };
		}
		tmpdata.system.memorized = false;

		var tmplabel = (MAGIC_KINDS[tmpkind]?.label ?? tmpkind).toLowerCase();
		var tmpalready = tmpactor.items.find(tmpitem => getItemKind(tmpitem) == tmpkind && tmpitem.name == tmpdata.name);
		if (tmpalready) {
			ui.notifications.info(`${tmpactor.name} already knows the ${tmplabel} ${tmpdata.name}.`);
			return;
		}

		var tmpskill = this.#learnSkill;
		if (tmpskill && this.#learnByRoll) {
			var tmpstanding = getSkillStanding(tmpactor.items.filter(i => i.type == "skill"), tmpskill,
				tmpactor.system?.identity?.title);
			var tmproll = await new Roll("1d100").evaluate();
			var tmpresult = resolveLoreLearn({ chance: tmpstanding.chance, situational: 0, alreadyKnown: false }, tmproll.total);
			var tmpwords = { success: "learned", grandmaster: "learned it outright, a Grandmaster of " + tmpskill,
			                 failure: "failed to learn", fumble: "rolled a 100 and failed to learn" };
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
				flavor: `Learn ${tmplabel}: ${tmpdata.name} &mdash; `
				      + `<strong>${isLoreSuccess(tmpresult.outcome) ? "learned" : "not learned"}</strong>`,
				content: `<div class="imagine-skill-roll">${tmpskill} ${tmpresult.total}%${tmpstanding.held ? "" : " (not held)"}: `
				       + `rolled ${tmpresult.roll} &mdash; ${tmpwords[tmpresult.outcome] ?? tmpresult.outcome}.</div>`,
				rolls: [tmproll]
			});
			if (!isLoreSuccess(tmpresult.outcome)) { return; }
		}

		await tmpactor.createEmbeddedDocuments("Item", [tmpdata]);
		ui.notifications.info(`${tmpdata.name} added to ${tmpactor.name}.`);
	}

	// This is the function which makes an empty item of this type, for something his tables do not
	// carry. The same thing the Add buttons used to do, kept because homebrew needs a way in.
	static async #onBlankItem(event, target) {
		event.preventDefault();
		var tmpdefinition = PICKER_PACKS[this.#type];
		var tmplabel = tmpdefinition.label;
		var tmpkind = resultKind(tmpdefinition);
		var tmpsystem = { location: "carried", quantity: 1, weight: 0 };
		if (tmpdefinition.magic) {
			tmpsystem = tmpkind ? { kind: tmpkind, subsystem: MAGIC_KINDS[tmpkind]?.subsystem ?? "" } : {};
		}
		var tmpcreated = await this.#actor.createEmbeddedDocuments("Item", [{
			name: `New ${tmplabel}`,
			type: tmpdefinition.type,
			system: tmpsystem
		}]);
		await this.close();
		if (tmpcreated?.length) { tmpcreated[0].sheet.render(true); }
	}
}

// @MARKER ADD NEW picker functions HERE
// @END (CODE)
