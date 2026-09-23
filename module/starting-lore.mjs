// @START (CODE)
// @MARKER STARTING LORE
//==================================================================================================================
// His "Provide random lore" -- the tick on his last creation step that reads, in full, "Provide
// random lore for starting spells, all relevant skills, and related consumables. If unchecked GM
// can provide after generation." -- as the Foundry side of rollStartingLore (module/lore-rules.mjs).
//
// Two routes reach it, and they do the same thing:
//     the character generator, when its tick is on (it is on by default -- see DECISIONS.md)
//     the Magic & Lore tab's "Provide starting lore" button, for the Game Master, which is his
//     "GM can provide after generation" -- and the way a character made before this existed, or
//     made by hand, gets what the generator would have given it.
//
// This file does three things. It reads the character into the plain input rollStartingLore wants
// (buildStartingLoreInput, pure, so it can be tested against a stub); it turns each entry the roll
// hands back into item data from the compendia (buildStartingLoreItems, pure as well); and it
// creates those items and says what it did (provideStartingLore, the only part that needs Foundry).
//
// RUN TWICE, IT ADDS, IT DOES NOT DUPLICATE. An entry the character already knows is not learned a
// second time -- reported instead -- and doses of something already carried are added to the stack
// that is there, as his combineInventoryDuplicates does for the starting kit.
//==================================================================================================================

import { MAGIC_KINDS, rollStartingLore, getCountedSkillNames, findBestCastingSkill, getItemKind,
         makePotionRecipe, makePoisonSystem, CONSUMABLE_KINDS } from "./lore-rules.mjs";
import { CASTING_SKILLS } from "./lore-tables.mjs";

// The compendia the starting lore draws from, as the content importer names them.
const LORE_PACKS = {
	skills:      "world.imagine-skills",
	consumables: "world.imagine-consumables",
	lore:        "world.imagine-lore",
	spells:      "world.imagine-spells"
};

	// @MARKER READING THE CHARACTER
	// This is the function which reads a character into rollStartingLore's input.
	//
	//   tmpactor     an actor, or anything shaped like one: { items: [...], system: {...} } with the
	//                character model's derived data in system (classItems, identity, characteristics)
	//   tmpcontent   { skills: [skill documents], herbValues: { name: value } } -- the skill
	//                definitions are needed for the chances of skills NOT held: Herb Lore as a
	//                common skill, and a casting skill the class gives at a later title
	export function buildStartingLoreInput(tmpactor, tmpcontent) {
		var tmpsystem = tmpactor.system ?? {};
		var tmpskillitems = [...(tmpactor.items ?? [])].filter(tmpitem => tmpitem.type == "skill");
		var tmpdefinition = (tmpname) => (tmpcontent?.skills ?? []).find(tmpdoc => tmpdoc.name == tmpname)?.system ?? null;
		var tmpbase = (tmpname) => {
			var tmpdef = tmpdefinition(tmpname);
			if (!tmpdef || typeof tmpsystem.getCommonSkillChance != "function") { return 0; }
			return tmpsystem.getCommonSkillChance(tmpdef.attr1, tmpdef.attr2, tmpdef.skillRating);
		};
		var tmpheldchance = (tmpname) => {
			var tmpheld = tmpskillitems.filter(tmpitem => tmpitem.name == tmpname);
			if (!tmpheld.length) { return null; }
			return Math.max(...tmpheld.map(tmpitem => parseInt(tmpitem.system?.totalChance) || 0));
		};

		var tmpracial = tmpskillitems.filter(tmpitem => tmpitem.system?.category == "racial");
		var tmpcannotcast = !!tmpsystem.identity?.cannotCast;
		var tmpclasses = (tmpsystem.classItems ?? []).map(tmpclass => tmpclass.system ?? {});

		// His storeBestCastingSkill reads the class list title by title: a skill already reached at
		// its own chance, one not yet reached at its base chance (sheet-worker.js:98254).
		var tmpclasscasting = [];
		for (const tmpclass of tmpclasses) {
			for (const tmpskill of tmpclass.advancement?.classSkillList ?? []) {
				if (!CASTING_SKILLS.includes(tmpskill.name)) { continue; }
				if (tmpskill.requires == "nonCaster" && !tmpcannotcast) { continue; }
				if (tmpskill.requires == "caster" && tmpcannotcast) { continue; }
				var tmpchance = tmpheldchance(tmpskill.name);
				tmpclasscasting.push({ name: tmpskill.name, title: parseInt(tmpskill.title) || 0,
				                       chance: tmpchance ?? tmpbase(tmpskill.name) });
			}
		}

		return {
			skillNames: getCountedSkillNames(tmpracial.map(tmpitem => tmpitem.name), tmpclasses, tmpcannotcast),
			alignment: tmpsystem.identity?.alignment ?? "",
			herbCommonChance: tmpbase("Herb Lore"),
			noIntake: (tmpsystem.identity?.race?.disabilities ?? []).includes("No Intake"),
			herbValues: tmpcontent?.herbValues ?? {},
			casting: findBestCastingSkill(
				tmpracial.map(tmpitem => ({ name: tmpitem.name, chance: parseInt(tmpitem.system?.totalChance) || 0 })),
				tmpclasscasting),
			affinity: parseInt(tmpsystem.characteristics?.affinity?.value) || 0,
			fortune: parseInt(tmpsystem.characteristics?.fortune?.value) || 0
		};
	}


	// @MARKER MAKING THE ITEMS
	// This is the function which turns what rollStartingLore handed back into item data, looking
	// each entry up in the compendium content by KIND and name -- never name alone, since "Healing"
	// is a ballad, a song, a poem and a potion.
	//
	//   tmprolled    rollStartingLore's result
	//   tmpcontent   { consumables: [docs], lore: [docs], spells: [docs] }
	//   tmpheld      the items the character already has
	//
	// Returns { create: [item data], update: [{ _id, "system.doses" }], added: [lines], issues }.
	export function buildStartingLoreItems(tmprolled, tmpcontent, tmpheld) {
		var tmpcreate = [];
		var tmpupdate = [];
		var tmpadded = [];
		var tmpissues = [...(tmprolled.issues ?? [])];
		var tmpfind = (tmpdocs, tmpkind, tmpname) => (tmpdocs ?? []).find(tmpdoc =>
			tmpdoc.name == tmpname && (tmpkind ? tmpdoc.system?.kind == tmpkind : true)) ?? null;
		var tmpheldof = (tmpkind, tmpname) => [...(tmpheld ?? [])].find(tmpitem =>
			getItemKind(tmpitem) == tmpkind && tmpitem.name == tmpname) ?? null;
		// A stock made twice in one run -- two recipes of the same poison -- goes on one stack.
		var tmppending = (tmpkind, tmpname) => tmpcreate.find(tmpdata =>
			tmpdata.system?.kind == tmpkind && tmpdata.name == tmpname) ?? null;

		for (const tmpentry of tmprolled.entries ?? []) {
			var tmpdef = MAGIC_KINDS[tmpentry.kind] ?? {};
			var tmplabel = tmpdef.label ?? tmpentry.kind;

			// @MARKER STOCK
			// Doses. Added to a stack already carried, or to one made earlier in this same run.
			if (CONSUMABLE_KINDS.includes(tmpentry.kind)) {
				var tmpdoses = parseInt(tmpentry.doses) || 0;
				var tmpstack = tmpheldof(tmpentry.kind, tmpentry.name);
				if (tmpstack) {
					tmpupdate.push({ _id: tmpstack.id ?? tmpstack._id,
					                 "system.doses": (parseInt(tmpstack.system?.doses) || 0) + tmpdoses });
					tmpadded.push(`${tmplabel}: ${tmpentry.name}, ${tmpdoses} more dose(s)`);
					continue;
				}
				var tmpsame = tmppending(tmpentry.kind, tmpentry.name);
				if (tmpsame) {
					tmpsame.system.doses += tmpdoses;
					tmpadded.push(`${tmplabel}: ${tmpentry.name}, ${tmpdoses} more dose(s)`);
					continue;
				}
				var tmpstock = null;
				if (tmpentry.kind == "poison") {
					tmpstock = makePoisonSystem(tmpentry.poisonType, tmpentry.poisonPotency, tmpentry.form, false);
					if (tmpstock) { tmpstock = { name: tmpstock.name, type: "consumable", system: tmpstock.system }; }
				} else {
					var tmpdoc = tmpfind(tmpcontent.consumables, tmpentry.kind, tmpentry.name);
					if (tmpdoc) { tmpstock = { name: tmpdoc.name, type: "consumable", img: tmpdoc.img, system: structuredClone(tmpdoc.system) }; }
				}
				if (!tmpstock) {
					tmpissues.push(`${tmplabel} "${tmpentry.name}" is drawn by his list but is not in his ${tmpdef.heading?.toLowerCase() ?? "tables"}; nothing added.`);
					continue;
				}
				tmpstock.system.doses = tmpdoses;
				tmpcreate.push(tmpstock);
				tmpadded.push(`${tmplabel}: ${tmpentry.name}, ${tmpdoses} dose(s)${tmpentry.form ? " (" + tmpentry.form + ")" : ""}`);
				continue;
			}

			// @MARKER KNOWN ENTRIES
			// Lore, recipes and spells. Never learned twice.
			if (tmpheldof(tmpentry.kind, tmpentry.name) || tmppending(tmpentry.kind, tmpentry.name)) {
				tmpissues.push(`${tmplabel} "${tmpentry.name}" is already known; not added again.`);
				continue;
			}
			var tmpknown = null;
			if (tmpentry.kind == "poisonrecipe") {
				var tmppoison = makePoisonSystem(tmpentry.poisonType, tmpentry.poisonPotency, tmpentry.form, true);
				if (tmppoison) { tmpknown = { name: tmppoison.name, type: "lore", system: tmppoison.system }; }
			} else if (tmpentry.kind == "potionrecipe") {
				var tmppotion = tmpfind(tmpcontent.consumables, "potion", tmpentry.name);
				if (tmppotion) { tmpknown = { name: tmppotion.name, type: "lore", img: tmppotion.img, system: makePotionRecipe(tmppotion.system) }; }
			} else if (tmpentry.kind == "spell") {
				var tmpspell = tmpfind(tmpcontent.spells, null, tmpentry.name);
				if (tmpspell) { tmpknown = { name: tmpspell.name, type: "spell", img: tmpspell.img, system: structuredClone(tmpspell.system) }; }
			} else {
				var tmplore = tmpfind(tmpcontent.lore, tmpentry.kind, tmpentry.name);
				if (tmplore) { tmpknown = { name: tmplore.name, type: "lore", img: tmplore.img, system: structuredClone(tmplore.system) }; }
			}
			if (!tmpknown) {
				tmpissues.push(`${tmplabel} "${tmpentry.name}" is drawn by his list but is not in his ${tmpdef.heading?.toLowerCase() ?? "tables"}; nothing added.`);
				continue;
			}
			// His rows arrive unmemorized -- "without recalculating mem points" -- and the player
			// chooses what to hold in mind.
			tmpknown.system.memorized = false;
			tmpcreate.push(tmpknown);
			tmpadded.push(`${tmplabel}: ${tmpentry.name}`);
		}

		// A spell primer is plain equipment -- his getCantripBook writes it into the general
		// equipment text -- and a book, so it has a weight worth having.
		for (const tmpname of tmprolled.equipment ?? []) {
			tmpcreate.push({ name: tmpname, type: "equipment", system: { location: "carried", equipmentType: "Books",
				weight: 1, quantity: 1,
				description: "A spell primer: the cantrips it names can be learned from it. From his getCantripBook -- "
				           + "a new caster who makes an Affinity or a Fortune roll starts with one." } });
			tmpadded.push(`Equipment: ${tmpname}`);
		}

		return { create: tmpcreate, update: tmpupdate, added: tmpadded, issues: tmpissues };
	}


	// @MARKER LOADING THE CONTENT
	// This is the function which loads the four compendia once per call, as plain data. A pack that
	// is missing -- content never imported -- loads as empty and the result says so.
	async function loadStartingLoreContent() {
		var tmpcontent = { skills: [], consumables: [], lore: [], spells: [], missing: [] };
		for (const [tmpkey, tmpid] of Object.entries(LORE_PACKS)) {
			var tmppack = game.packs.get(tmpid);
			if (!tmppack) { tmpcontent.missing.push(tmpid); continue; }
			tmpcontent[tmpkey] = (await tmppack.getDocuments()).map(tmpdoc => tmpdoc.toObject());
		}
		tmpcontent.herbValues = Object.fromEntries(tmpcontent.consumables
			.filter(tmpdoc => tmpdoc.system?.kind == "herb").map(tmpdoc => [tmpdoc.name, tmpdoc.system.value]));
		return tmpcontent;
	}


	// @MARKER THE ENTRY POINT
	// This is the function which gives a character its starting lore, and posts what it gave.
	// Returns the same { added, issues } it reports, or null if the content is not there to draw on.
	export async function provideStartingLore(tmpactor, { notify = true } = {}) {
		if (!tmpactor) { return null; }
		var tmpcontent = await loadStartingLoreContent();
		if (tmpcontent.missing.length == Object.keys(LORE_PACKS).length) {
			ui.notifications.warn("Imagine RPG | the content has not been imported, so there is no lore to give. "
				+ "Run game.imagine.importContent() first.");
			return null;
		}

		var tmproll = (tmpsides) => Math.ceil(CONFIG.Dice.randomUniform() * tmpsides) || 1;
		var tmpinput = buildStartingLoreInput(tmpactor, tmpcontent);
		var tmprolled = rollStartingLore(tmpinput, tmproll);
		var tmpitems = buildStartingLoreItems(tmprolled, tmpcontent, tmpactor.items);
		for (const tmpid of tmpcontent.missing) { tmpitems.issues.push(`The compendium ${tmpid} is missing.`); }

		if (tmpitems.create.length) { await tmpactor.createEmbeddedDocuments("Item", tmpitems.create); }
		if (tmpitems.update.length) { await tmpactor.updateEmbeddedDocuments("Item", tmpitems.update); }

		if (notify) {
			var tmplines = tmpitems.added.length
				? tmpitems.added.map(tmpline => `<li>${tmpline}</li>`).join("")
				: "<li>Nothing: the character holds none of the lores his sheet gives starting entries for, "
				  + "and no casting skill.</li>";
			var tmpnotes = tmpitems.issues.map(tmpissue => `<p class="muted">${tmpissue}</p>`).join("");
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
				flavor: "Starting lore",
				content: `<div class="imagine-starting-lore"><ul>${tmplines}</ul>${tmpnotes}</div>`
			});
		}
		return { added: tmpitems.added, issues: tmpitems.issues };
	}

// @MARKER ADD NEW starting lore functions HERE
// @END (CODE)
