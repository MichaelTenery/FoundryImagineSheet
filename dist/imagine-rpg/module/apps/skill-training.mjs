// @START (CODE)
// @MARKER SKILL TRAINING WINDOW
//==================================================================================================================
// The Add Skill and Train Up Skill windows: his Character Updater panels "Add Racial Skill", "Add Social
// Skill", "Train Up Racial Skill" and "Train Up Social Skill", each one window beside the sheet. One class
// does both, told apart by its mode and kind; the template is templates/apps/skill-training.hbs.
//
// ADD: pick a skill of the kind from the list, SELECT it, train the hours it needs (his "Hours Trained"),
// tick how it is learned (a book, a library, self, a teacher, an instructor) and press LEARN: one d100
// against the chance shown. Only while the character has an open slot of that kind.
// TRAIN: step through the skills held with the arrows, SELECT one, the same hours and ticks (and the
// teacher's or instructor's own chance), and press IMPROVE; a success adds to the skill's ability bonus.
//
// Open it from the Character Updater, or from a macro:
//     game.imagine.addSkill(actor, "racial")     game.imagine.addSkill(actor, "social")
//     game.imagine.trainSkill(actor, "racial")   game.imagine.trainSkill(actor, "social")
//
// Nothing here is a rule. The rules are module/skill-training-rules.mjs, the reading and writing is
// module/skill-training.mjs, and what is shown is built by module/skill-training-view.mjs.
//==================================================================================================================

import { buildAddView, buildTrainView } from "../skill-training-view.mjs";
import { TRAINING_KINDS, getRecord, getLearnHours, setTeachingMode } from "../skill-training-rules.mjs";
import { loadLearnableSkills, getTrainableSkills, getHistory, getLearnDetails, saveHours,
         tryLearnSkill, tryImproveSkill } from "../skill-training.mjs";
import { applySheetTheme } from "../sheet-theme.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class ImagineSkillTraining extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		tag: "div",
		classes: ["imagine", "skill-training"],
		window: { title: "Skill", resizable: true },
		position: { width: 560, height: "auto" },
		actions: {
			selectSkill: ImagineSkillTraining.#onSelect,
			stepLeft:    ImagineSkillTraining.#onStepLeft,
			stepRight:   ImagineSkillTraining.#onStepRight,
			go:          ImagineSkillTraining.#onGo,
			done:        ImagineSkillTraining.#onDone
		}
	};

	static PARTS = {
		body: { template: "systems/imagine-rpg/templates/apps/skill-training.hbs", scrollable: [".skill-training-body"] }
	};

	#actor = null;
	#mode = "add";          // "add" | "train"
	#kind = "racial";       // "racial" | "social"
	// The window's own answers, kept across the re-render an actor update causes.
	#working = { dropdown: "", chosen: "", index: 0, book: false, library: false, teaching: "self",
	             teacherChance: "", instructorChance: "" };

	// One window per actor, mode and kind, keyed by uuid so an unlinked token's window is its own.
	static windowId(tmpactor, tmpmode, tmpkind) {
		return `imagine-skill-${tmpmode}-${tmpkind}-${(tmpactor?.uuid ?? "unknown").replace(/\./g, "-")}`;
	}

	constructor(tmpactor, tmpmode, tmpkind, tmpoptions = {}) {
		super({ ...tmpoptions, id: ImagineSkillTraining.windowId(tmpactor, tmpmode, tmpkind) });
		this.#actor = tmpactor;
		this.#mode = tmpmode == "train" ? "train" : "add";
		this.#kind = TRAINING_KINDS[tmpkind] ? tmpkind : "racial";
	}

	get title() {
		var tmplabel = TRAINING_KINDS[this.#kind].label;
		return `${this.#mode == "train" ? "Train Up" : "Add"} ${tmplabel} Skill: ${this.#actor?.name ?? ""}`;
	}

	// This is the function which opens the window, or brings it forward if it is open.
	static open(tmpactor, tmpmode, tmpkind) {
		if (!tmpactor || tmpactor.type != "character") {
			ui.notifications.warn("Skills are added and trained on a character.");
			return null;
		}
		var tmpexisting = foundry.applications.instances.get(ImagineSkillTraining.windowId(tmpactor, tmpmode, tmpkind));
		if (tmpexisting) { tmpexisting.bringToFront(); return tmpexisting; }
		return new ImagineSkillTraining(tmpactor, tmpmode, tmpkind).render(true);
	}

	// The window follows the actor: a skill learned, a slot traded.
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
		// The list changes rather than clicks, so it is bound here; it only notes the pick -- his
		// SELECT button is what takes it.
		this.element.querySelector("select[name='skill']")
			?.addEventListener("change", (event) => { this.#working.dropdown = event.target.value; });
		// The ticks and boxes whose change alters the chance shown.
		for (const tmpfield of this.element.querySelectorAll("[data-working]")) {
			tmpfield.addEventListener("change", (event) => this.#onField(event));
		}
	}

	// @MARKER WHAT THE WINDOW SHOWS
	async _prepareContext(options) {
		var tmpcontext = await super._prepareContext(options);
		var tmpactor = this.#actor;
		var tmpw = this.#working;
		var tmpworking = { book: tmpw.book, library: tmpw.library, mode: tmpw.teaching,
			teacherChance: tmpw.teacherChance, instructorChance: tmpw.instructorChance };
		tmpcontext.actor = tmpactor;

		if (this.#mode == "add") {
			var tmpoptions = await loadLearnableSkills(tmpactor, this.#kind);
			// A skill learned since the last render is no longer a pick.
			if (tmpw.chosen && !tmpoptions.some(tmpoption => tmpoption.name == tmpw.chosen)) { tmpw.chosen = ""; }
			var tmpentry = tmpoptions.find(tmpoption => tmpoption.name == tmpw.chosen);
			var tmpdetails = tmpentry ? getLearnDetails(tmpactor, this.#kind, tmpentry) : null;
			var tmprecord = tmpentry
				? getRecord(getHistory(tmpactor, "learn", this.#kind), tmpw.chosen, "learn", tmpdetails.hoursNeeded) : null;
			Object.assign(tmpcontext, buildAddView({
				characterName: tmpactor.name, kind: this.#kind, skillSlots: tmpactor.system.skillSlots,
				options: tmpoptions.map(tmpoption => tmpoption.name), dropdown: tmpw.dropdown || tmpw.chosen,
				chosen: tmpw.chosen, details: tmpdetails, record: tmprecord, working: tmpworking
			}));
		} else {
			var tmpheld = getTrainableSkills(tmpactor, this.#kind);
			if (tmpw.chosen && !tmpheld.some(tmpskill => tmpskill.name == tmpw.chosen)) { tmpw.chosen = ""; }
			var tmpitem = tmpheld.find(tmpskill => tmpskill.name == tmpw.chosen);
			var tmpneeded = tmpitem ? getLearnHours(tmpitem.system) : 0;
			Object.assign(tmpcontext, buildTrainView({
				characterName: tmpactor.name, kind: this.#kind, held: tmpheld, index: tmpw.index, chosen: tmpw.chosen,
				base: tmpitem?.base, hoursNeeded: tmpneeded, currentChance: tmpitem?.chance,
				record: tmpitem ? getRecord(getHistory(tmpactor, "improve", this.#kind), tmpw.chosen, "improve", tmpneeded) : null,
				working: tmpworking
			}));
		}
		return tmpcontext;
	}

	// @MARKER THE WINDOW'S ANSWERS
	// This is the function which reads the boxes off the form into the window's own state.
	#capture() {
		var tmpform = this.element;
		if (!tmpform) { return; }
		var tmpread = (tmpname) => tmpform.querySelector(`[name='${tmpname}']`);
		var tmpw = this.#working;
		if (tmpread("book"))    { tmpw.book = !!tmpread("book").checked; }
		if (tmpread("library")) { tmpw.library = !!tmpread("library").checked; }
		if (tmpread("teacherChance"))    { tmpw.teacherChance = tmpread("teacherChance").value; }
		if (tmpread("instructorChance")) { tmpw.instructorChance = tmpread("instructorChance").value; }
		if (tmpread("skill")) { tmpw.dropdown = tmpread("skill").value; }
	}

	// This is the function behind every tick and box: a mode tick keeps his one-of-three, hours are
	// kept on the actor as his change handler kept them, and the totals are shown afresh.
	async #onField(event) {
		var tmpfield = event.target;
		var tmpw = this.#working;
		this.#capture();
		var tmpname = tmpfield.name;
		if (["self", "teacher", "instructor"].includes(tmpname)) {
			tmpw.teaching = setTeachingMode(tmpw.teaching, tmpname, !!tmpfield.checked);
		}
		if (tmpname == "hours" && tmpw.chosen) {
			var tmpmodekey = this.#mode == "train" ? "improve" : "learn";
			var tmpitem = this.#mode == "train" ? getTrainableSkills(this.#actor, this.#kind).find(tmpskill => tmpskill.name == tmpw.chosen) : null;
			var tmpentry = this.#mode == "add" ? (await loadLearnableSkills(this.#actor, this.#kind)).find(tmpoption => tmpoption.name == tmpw.chosen) : null;
			var tmpneeded = this.#mode == "train" ? getLearnHours(tmpitem?.system) : getLearnDetails(this.#actor, this.#kind, tmpentry).hoursNeeded;
			await saveHours(this.#actor, tmpmodekey, this.#kind, tmpw.chosen, tmpneeded, tmpfield.value);
		}
		this.render();
	}

	// His SELECT: take the skill the list or the arrows show, and start its panel afresh -- the ticks
	// cleared, self-taught back on -- as setRacialSkillLearnDetails does.
	#choose(tmpname) {
		var tmpw = this.#working;
		tmpw.chosen = tmpname;
		tmpw.book = false; tmpw.library = false; tmpw.teaching = "self";
		tmpw.teacherChance = ""; tmpw.instructorChance = "";
	}

	static async #onSelect(event, target) {
		event.preventDefault();
		this.#capture();
		if (this.#mode == "add") {
			this.#choose(this.#working.dropdown);
		} else {
			var tmpheld = getTrainableSkills(this.#actor, this.#kind);
			this.#choose(tmpheld[this.#working.index]?.name ?? "");
		}
		this.render();
	}

	static async #onStepLeft(event, target) { this.#step(-1); }
	static async #onStepRight(event, target) { this.#step(1); }
	#step(tmpdelta) {
		var tmpcount = getTrainableSkills(this.#actor, this.#kind).length;
		if (!tmpcount) { return; }
		this.#working.index = (this.#working.index + tmpdelta + tmpcount) % tmpcount;
		this.render();
	}

	// @MARKER THE TRY
	// His LEARN / IMPROVE button. The hours are read off the form, as his handler read the attribute.
	static async #onGo(event, target) {
		event.preventDefault();
		this.#capture();
		var tmpw = this.#working;
		var tmphours = parseInt(this.element.querySelector("[name='hours']")?.value) || 0;
		var tmpstate = { name: tmpw.chosen, hours: tmphours, book: tmpw.book, library: tmpw.library, mode: tmpw.teaching,
			teacherChance: tmpw.teacherChance, instructorChance: tmpw.instructorChance };
		var tmpresult = this.#mode == "add"
			? await tryLearnSkill(this.#actor, this.#kind, tmpstate)
			: await tryImproveSkill(this.#actor, this.#kind, tmpstate);
		// A learned skill is done with; an improved or failed one stays, its record moved on. His
		// clearAll...Values put the panel back afresh after a success.
		if (tmpresult.outcome == "learned") { this.#choose(""); }
		if (tmpresult.outcome == "improved") { this.#choose(""); }
		this.render();
	}

	static async #onDone(event, target) {
		await this.close();
	}
}
// @END (CODE)
