// @START (CODE)
// @MARKER CONTENT IMPORTER
//==================================================================================================================
// Builds the system's compendium packs at runtime from the JSON shipped in src/packs/documents/.
//
// The usual route is to compile packs at build time with Foundry's CLI, which needs Node and a
// toolchain. Doing it at runtime instead means the content can be rebuilt from inside Foundry
// by whoever is running the game, with nothing installed -- which matters while the underlying
// game is still being written and the data changes often.
//
// The import is idempotent. Re-running it updates documents that already exist and adds the
// ones that do not, matched by name, rather than piling up duplicates. That is the behaviour
// you want when the developer sends a corrected sheet and the content needs refreshing.
//==================================================================================================================

// Which JSON file feeds which pack, and what each pack holds.
const CONTENT_PACKS = [
	{ file: "skills",    pack: "skills",    label: "Imagine Skills",    type: "Item" },
	{ file: "races",     pack: "races",     label: "Imagine Races",     type: "Item" },
	{ file: "classes",   pack: "classes",   label: "Imagine Classes",   type: "Item" },
	{ file: "weapons",   pack: "weapons",   label: "Imagine Weapons",   type: "Item" },
	{ file: "armor",     pack: "armor",     label: "Imagine Armour",    type: "Item" },
	{ file: "equipment", pack: "equipment", label: "Imagine Equipment", type: "Item" },

	// Abilities, disabilities and immunities are one item type separated by a category, but
	// three packs rather than one: 19 names appear in two categories at once -- Poison, Acid,
	// Aura, Regeneration and Insanity among them -- and documents are matched by name, so a
	// single pack would overwrite one with the other.
	{ file: "abilities",    pack: "abilities",    label: "Imagine Abilities",    type: "Item" },
	{ file: "disabilities", pack: "disabilities", label: "Imagine Disabilities", type: "Item" },
	{ file: "immunities",   pack: "immunities",   label: "Imagine Immunities",   type: "Item" },

	// His Magic/Lore tab. In the consumables and lore packs a NAME is shared between kinds --
	// "Anger" is a song and a poem, "Break Love" a candle ritual and a ritual -- so those two are
	// matched on kind and name ("matchKind"), where every other pack is matched on name alone.
	// Abilities and their siblings were split into three packs for the same collision; these are
	// not, because there are thirteen lore kinds and thirteen compendia of them would bury the rest.
	{ file: "consumables",  pack: "consumables",  label: "Imagine Consumables",  type: "Item", matchKind: true },
	{ file: "lore",         pack: "lore",         label: "Imagine Lore",         type: "Item", matchKind: true },
	{ file: "spells",       pack: "spells",       label: "Imagine Spells",       type: "Item" },
	{ file: "invocations",  pack: "invocations",  label: "Imagine Invocations",  type: "Item" }
];

const SOURCE_PATH = "systems/imagine-rpg/src/packs/documents";

// @MARKER RETIRED DOCUMENTS
// Names the shipped files USED to carry and no longer do, per pack. The import matches by name,
// so it adds and updates but can never notice a document that has left the source -- a world
// imported before a race was split kept the old, unsplit race beside its new forms, and the
// generator offered all of them. These are taken out of the compendium on the next import.
//
// AN EXPLICIT LIST, NOT "WHATEVER IS NOT IN THE FILE". A compendium is where a Game Master adds
// homebrew, and anything they put there is by definition not in the shipped file; deleting on
// absence would delete their work. Only names the system itself once shipped are ever removed.
// When a rebuild drops or renames a document, its old name goes here.
//
//   pack        retired name              replaced by
export const RETIRED_DOCUMENTS = {
	races: [
		"Fairy",                 //  Fairy(Winged), Fairy(Wingless)             split 2026-09-21
		"Fairy(Dark)",           //  Fairy(Dark Winged), Fairy(Dark Wingless)   split 2026-09-21
		"Podling",               //  Podling(Winged), Podling(Wingless)         split 2026-09-21
		"Sporeling"              //  Sporeling(Winged), Sporeling(Wingless)     split 2026-09-21
	],
	classes: [
		"Elemental Dancer",      //  one class per element                     split by path
		"Innominate"             //  Innominate(Detect Evil), (Detect Good)     split by path
	],
	skills: [
		"Open Slot",             //  (nothing -- a slot marker, not a skill)    dropped 2026-09-22
		"Unavailable"            //  (nothing -- a slot marker, not a skill)    dropped 2026-09-22
	]
};

	// This is the function which decides WHICH retired names a pack should still remove -- the pure
	// part of the retirement sweep, with no Foundry document call in it, so it can be tested without
	// Foundry and reused by item-directory.mjs's own retired-item sweep of the Items sidebar.
	//
	// A name is removed only if all three hold: it is on the retired list, the shipped file has not
	// brought it back, and something by that name is actually there to remove. See the RETIRED
	// DOCUMENTS marker above for why "on the retired list" is required at all.
	export function retiredNamesToRemove(tmpretiredlist, tmpshippednames, tmpexistingnames) {
		var tmpshipped = tmpshippednames instanceof Set ? tmpshippednames : new Set(tmpshippednames);
		var tmpexisting = tmpexistingnames instanceof Set ? tmpexistingnames : new Set(tmpexistingnames);
		return (tmpretiredlist ?? []).filter(tmpname => !tmpshipped.has(tmpname) && tmpexisting.has(tmpname));
	}


	// This is the function which says what a document is matched on when the import looks for it in
	// the compendium: its name, or -- in a pack where names repeat between kinds -- its kind and name.
	export function getImportKey(tmpdefinition, tmpname, tmpkind) {
		return tmpdefinition?.matchKind ? `${tmpkind ?? ""}|${tmpname}` : tmpname;
	}

	// This is the function which reads one document file shipped with the system.
	async function loadContentFile(tmpname) {
		var tmpresponse = await fetch(`${SOURCE_PATH}/${tmpname}.json`);
		if (!tmpresponse.ok) {
			throw new Error(`Imagine RPG | could not read ${tmpname}.json (${tmpresponse.status})`);
		}
		return await tmpresponse.json();
	}

	// This is the function which finds a system compendium, creating it if it is not there yet.
	async function ensurePack(tmpdefinition) {
		var tmpid = `world.imagine-${tmpdefinition.pack}`;
		var tmppack = game.packs.get(tmpid);
		if (tmppack) { return tmppack; }

		return await foundry.documents.collections.CompendiumCollection.createCompendium({
			label: tmpdefinition.label,
			name: `imagine-${tmpdefinition.pack}`,
			type: tmpdefinition.type,
			package: "world"
		});
	}

	// This is the function which brings one pack in line with its source file.
	//
	// Existing documents are matched by name and updated in place, so anything a Game Master
	// has already dragged onto a character keeps pointing at the same document rather than
	// being orphaned by a wholesale delete and recreate.
	async function importPack(tmpdefinition) {
		var tmpdocs = await loadContentFile(tmpdefinition.file);
		var tmppack = await ensurePack(tmpdefinition);

		var tmpwaslocked = tmppack.locked;
		if (tmpwaslocked) { await tmppack.configure({ locked: false }); }

		var tmpindex = await tmppack.getIndex({ fields: ["system.kind"] });
		var tmpexisting = new Map();
		var tmpexistingkeys = new Map();
		for (const tmpentry of tmpindex) {
			tmpexisting.set(tmpentry.name, tmpentry._id);
			tmpexistingkeys.set(getImportKey(tmpdefinition, tmpentry.name, tmpentry.system?.kind), tmpentry._id);
		}

		var tmptocreate = [];
		var tmptoupdate = [];
		for (const tmpdoc of tmpdocs) {
			var tmpid = tmpexistingkeys.get(getImportKey(tmpdefinition, tmpdoc.name, tmpdoc.system?.kind));
			if (tmpid) {
				tmptoupdate.push({ _id: tmpid, type: tmpdoc.type, system: tmpdoc.system });
			} else {
				tmptocreate.push(tmpdoc);
			}
		}

		if (tmptocreate.length) {
			await Item.createDocuments(tmptocreate, { pack: tmppack.collection, keepId: false });
		}
		if (tmptoupdate.length) {
			await Item.updateDocuments(tmptoupdate, { pack: tmppack.collection });
		}

		// Retired names go, but only if the shipped file has not brought the name back.
		var tmpshipped = new Set(tmpdocs.map(tmpdoc => tmpdoc.name));
		var tmptodelete = retiredNamesToRemove(RETIRED_DOCUMENTS[tmpdefinition.pack], tmpshipped, tmpexisting.keys())
			.map(tmpname => tmpexisting.get(tmpname));
		if (tmptodelete.length) {
			await Item.deleteDocuments(tmptodelete, { pack: tmppack.collection });
		}

		if (tmpwaslocked) { await tmppack.configure({ locked: true }); }

		return { created: tmptocreate.length, updated: tmptoupdate.length, retired: tmptodelete.length,
			total: tmpdocs.length };
	}


// @MARKER PUBLIC ENTRY POINT

// This is the function which rebuilds every content pack, reporting progress as it goes.
// Game Master only -- it writes to world compendiums.
export async function importAllContent({ notify = true } = {}) {
	if (!game.user.isGM) {
		ui.notifications.warn("Only a Game Master can import Imagine content.");
		return null;
	}

	var tmpresults = [];
	var tmpfailed = [];

	for (const tmpdefinition of CONTENT_PACKS) {
		try {
			if (notify) {
				ui.notifications.info(`Imagine RPG | importing ${tmpdefinition.label}...`);
			}
			var tmpresult = await importPack(tmpdefinition);
			tmpresults.push({ label: tmpdefinition.label, ...tmpresult });
			console.log(`Imagine RPG | ${tmpdefinition.label}: `
				+ `${tmpresult.created} created, ${tmpresult.updated} updated, ${tmpresult.retired} retired`);
		} catch (err) {
			// One bad file should not abandon the rest of the import half-done.
			console.error(`Imagine RPG | failed importing ${tmpdefinition.label}`, err);
			tmpfailed.push({ label: tmpdefinition.label, error: err.message });
		}
	}

	var tmptotal = tmpresults.reduce((sum, r) => sum + r.total, 0);
	if (notify) {
		if (tmpfailed.length) {
			ui.notifications.error(
				`Imagine RPG | imported ${tmptotal} documents, ${tmpfailed.length} pack(s) failed. See the console.`);
		} else {
			ui.notifications.info(`Imagine RPG | imported ${tmptotal} documents across ${tmpresults.length} packs.`);
		}
	}

	return { packs: tmpresults, failed: tmpfailed, total: tmptotal };
}

// @MARKER ADD NEW importer functions HERE
// @END (CODE)
