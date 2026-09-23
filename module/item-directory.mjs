// @START (CODE)
// @MARKER ITEM DIRECTORY
//==================================================================================================================
// Fills Foundry's Items sidebar with the system's content, in folders.
//
// The compendia remain the system's own copy and are what the importer maintains; this puts a
// working set in the world where a Game Master can see it, search it and drag from it. It is
// filled FROM THE COMPENDIA, so whatever is in them -- including gear a Game Master added by hand
// -- is what appears; the shipped JSON is only the fallback for a world whose compendia have not
// been imported yet. Daryl
// asked for it on 2026-09-21 after finding the sidebar empty, and it is the right answer to that:
// a compendium is a library, and a library you have to go and open is not where you reach for a
// sword mid-session.
//
// GROUPED THE WAY HIS OWN DATA GROUPS THINGS, where it groups them at all:
//
//     Weapons        his `type` -- Blade, Axe, Bludgeon, Pick, Piercer, Missile, Explosive, Special
//     Armour         shields first, then his flexibility classes
//     Skills         his class/social split, then the sourcebook each came from
//     Classes        his classType -- Warrior subclass, Mage subclass and the rest
//
// Races, abilities, disabilities and immunities have NO category in his tables at all, and are
// bucketed by initial letter instead, which is a way of finding things rather than a claim about
// the game, and is labelled as such below so nobody mistakes an A-C folder for one of his
// categories. Equipment is the same in his own tables -- a name and a weight and nothing else --
// but a Game Master adding gear by hand can set `equipmentType`; where that is set it groups by
// it, and only the untyped majority falls back to letter buckets.
//
// Anything, in any of the above, whose sourcebook could not be traced to a book (his own "XXX"
// mark, see availability.mjs) is pulled out of its ordinary folder into one shared top-level
// folder instead, so a Game Master can see the whole attribution gap in one list.
//==================================================================================================================

import { RETIRED_DOCUMENTS, retiredNamesToRemove } from "./content-importer.mjs";
import { MAGIC_KINDS, LORE_KINDS } from "./lore-rules.mjs";

const SOURCE_PATH = "systems/imagine-rpg/src/packs/documents";

// Items are created in batches. One call with four thousand documents in it makes Foundry
// unresponsive for the duration and gives no sign of progress; this way the notification can move.
const BATCH = 250;

// The level folders in number order -- sorted as text, "Level 10" would come before "Level 2".
const LEVEL_FOLDERS = [...Array.from({ length: 21 }, (tmpunused, tmpindex) => `Level ${tmpindex}`), "Level 21 and above"];

// @MARKER THE SHAPE OF THE DIRECTORY
// Each entry is one top-level folder. `group` returns the subfolder a document belongs in, or ""
// for none. `order` fixes the subfolder order where his data has a natural one; anything not named
// sorts alphabetically after those that are.
const DIRECTORY = [
	{
		file: "weapons", folder: "Weapons",
		// His own column. Blade, Axe and Bludgeon first because that is the order his weapon
		// tables run in, and the order a player thinks in.
		order: ["Blade", "Axe", "Bludgeon", "Pick", "Piercer", "Missile", "Explosive", "Special"],
		// Missile is 408 of the 594 weapons and would be a folder nobody could use, so it splits
		// again -- and his data says how. A weapon with NO SPEED OF ITS OWN is ammunition: an arrow
		// is loosed, not swung, and he gives it no swing. That is 317 of the 408. Each of those
		// names its launcher in its own brackets -- "Arrow(Long Bow/Normal)" -- which is both his
		// grouping and the question a player actually asks: what fits my bow? The 91 that do have a
		// speed are the bows, crossbows and thrown weapons themselves.
		group: (tmpdoc) => {
			var tmptype = tmpdoc.system?.type || "Other";
			if (tmptype != "Missile") { return tmptype; }
			if (tmpdoc.system?.speed) { return "Missile/Launchers and thrown"; }
			var tmpfor = ("" + tmpdoc.name).match(/^[^(]+\(([^/)]+)/);
			return "Missile/" + (tmpfor ? tmpfor[1].trim() : "Unstated launcher");
		}
	},
	{
		file: "armor", folder: "Armour",
		order: ["Shields", "Clothing", "Flexible", "Semi-Flexible", "Rigid",
		        "Rigid/Flexible", "Rigid/Semi-Flexible", "Rigid/Rigid", "Mixed"],
		// A shield is armour with a flag rather than a flexibility of its own, and is what a
		// player looks for by name, so it gets the first folder.
		group: (tmpdoc) => tmpdoc.system?.isShield ? "Shields" : (tmpdoc.system?.flexibility || "Other")
	},
	{
		file: "skills", folder: "Skills",
		order: ["Class skills", "Social skills"],
		// Two levels: his category, then the book it came from. Skills are the one pack where
		// the sourcebook is filled in throughout, and which book a skill is from is exactly the
		// question a Game Master running one campaign asks about it.
		// "?" is his own placeholder sourcebook, carried by Open Slot and Unavailable -- the two
		// entries in his dictionary that are slot markers rather than skills. A folder called "?"
		// says nothing; they go in with the genuinely unattributed.
		group: (tmpdoc) => {
			var tmpbook = tmpdoc.system?.sourcebook;
			if (!tmpbook || tmpbook == "?") { tmpbook = "Unattributed"; }
			return (tmpdoc.system?.category == "social" ? "Social skills" : "Class skills") + "/" + tmpbook;
		}
	},
	{
		file: "classes", folder: "Classes",
		order: ["Primary class"],
		// Beguiler's classType holds its whole 264-character description -- his description has
		// landed in the wrong column (UPSTREAM-ISSUES item 44). Anything that long is not a
		// category name and would make a folder titled with a paragraph, so it goes to Other.
		group: (tmpdoc) => {
			var tmpkind = "" + (tmpdoc.system?.classType || "Other");
			return tmpkind.length > 40 ? "Other" : tmpkind;
		}
	},
	{ file: "races",        folder: "Races",        group: byLetter },
	// His own equipment dictionary is a name and a weight, no category -- but a Game Master adding
	// gear by hand can fill in `equipmentType` (the manual Containers entries do). Where one is set
	// it wins; the untyped majority still falls back to the same letter buckets as before.
	{ file: "equipment",    folder: "Equipment",    group: byEquipmentType },
	{ file: "abilities",    folder: "Abilities",    group: byLetter },
	{ file: "disabilities", folder: "Disabilities", group: byLetter },
	{ file: "immunities",   folder: "Immunities",   group: byLetter },

	// His Magic/Lore tab, grouped as his tab groups it: by kind first. The two long lists split
	// again -- herbs (351) and runes (211) by letter, hymns by the alignment his starting lists
	// give them. Spells and invocations go by level, which is how a caster looks one up.
	//
	// All four packs are XXX throughout until an attribution pass that knows the kind exists
	// (NOT_YET_ATTRIBUTED_PACKS in build_documents.py), so they are NOT pulled out into the shared
	// XXX folder: that would move 2,486 entries out of the grouping that makes them findable and
	// into one that says nothing except that nobody has matched them to a page yet.
	{
		file: "consumables", folder: "Consumables", keepUnattributed: true,
		order: ["Herbs", "Potions", "Elixirs", "Charms"],
		group: (tmpdoc) => {
			var tmpheading = MAGIC_KINDS[tmpdoc.system?.kind]?.heading ?? "Other";
			return tmpdoc.system?.kind == "herb" ? tmpheading + "/" + byLetter(tmpdoc) : tmpheading;
		}
	},
	{
		file: "lore", folder: "Lore", keepUnattributed: true,
		order: LORE_KINDS.map(tmpkind => MAGIC_KINDS[tmpkind].heading),
		group: (tmpdoc) => {
			var tmpkind = tmpdoc.system?.kind;
			var tmpheading = MAGIC_KINDS[tmpkind]?.heading ?? "Other";
			if (tmpkind == "rune") { return tmpheading + "/" + byLetter(tmpdoc); }
			if (tmpkind == "hymn") { return tmpheading + "/" + (tmpdoc.system?.alignment || "Not on a starting list"); }
			return tmpheading;
		}
	},
	{ file: "spells",      folder: "Spells",      keepUnattributed: true, order: LEVEL_FOLDERS, group: byLevel },
	{ file: "invocations", folder: "Invocations", keepUnattributed: true, order: LEVEL_FOLDERS, group: byLevel }
];

// A spell or invocation by its level. His spells run past 20 -- a handful at 25 to 1000 -- and
// those share one folder rather than eleven nearly empty ones.
function byLevel(tmpdoc) {
	var tmplevel = parseInt(tmpdoc.system?.level) || 0;
	return tmplevel > 20 ? "Level 21 and above" : `Level ${tmplevel}`;
}

// The letter buckets, for the packs his tables give no category at all. Three letters to a folder
// so a pack of 1,154 abilities lands around a hundred per folder rather than four hundred under S.
const LETTER_BUCKETS = ["A-C", "D-F", "G-I", "J-L", "M-O", "P-R", "S-U", "V-Z"];

// The shared top-level folder for anything whose system.sourcebook is his own "XXX" mark (see
// getSourcebookId in availability.mjs). Named once here so populateItemDirectory and
// clearItemDirectory can never drift apart on the spelling.
const XXX_FOLDER_NAME = "XXX — no source found";

function byLetter(tmpdoc) {
	var tmpfirst = ("" + (tmpdoc.name ?? "")).trim().charAt(0).toUpperCase();
	if (!tmpfirst || tmpfirst < "A" || tmpfirst > "Z") { return "Other"; }
	return LETTER_BUCKETS[Math.min(LETTER_BUCKETS.length - 1,
		Math.floor((tmpfirst.charCodeAt(0) - 65) / 3))];
}

// Hand-added gear only -- his own tables never set this field (see item-equipment.mjs). Anything
// left blank falls back to the same by-letter bucketing every other uncategorised pack gets.
function byEquipmentType(tmpdoc) {
	var tmptype = ("" + (tmpdoc.system?.equipmentType ?? "")).trim();
	return tmptype || byLetter(tmpdoc);
}

	// This is the function which reads one document file shipped with the system.
	async function loadContentFile(tmpname) {
		var tmpresponse = await fetch(`${SOURCE_PATH}/${tmpname}.json`);
		if (!tmpresponse.ok) {
			throw new Error(`Imagine RPG | could not read ${tmpname}.json (${tmpresponse.status})`);
		}
		return await tmpresponse.json();
	}

	// This is the function which reads what one directory entry should contain. The world's own
	// compendium wins, because that is where content is added and corrected; the shipped file is
	// used only when that compendium is missing or empty. Returns the documents as plain data with
	// the compendium's identity stripped, so each becomes a fresh world item.
	async function loadEntryDocuments(tmpentry) {
		var tmppack = game.packs.get(`world.imagine-${tmpentry.file}`);
		if (tmppack) {
			var tmpdocs = await tmppack.getDocuments();
			if (tmpdocs.length) {
				return { source: "compendium", docs: tmpdocs.map(tmpdoc => {
					var tmpdata = tmpdoc.toObject();
					delete tmpdata._id;
					delete tmpdata._stats;
					delete tmpdata.ownership;
					delete tmpdata.folder;
					delete tmpdata.sort;
					return tmpdata;
				}) };
			}
		}
		return { source: "shipped file", docs: await loadContentFile(tmpentry.file) };
	}

	// This is the function which finds or makes one folder, by name and parent. Foundry allows two
	// folders of the same name in different places, so the parent is part of the identity -- the
	// "A-C" under Equipment must not be confused with the "A-C" under Abilities.
	async function ensureFolder(tmpname, tmpparent, tmpsort) {
		var tmpexisting = game.folders.find(tmpfolder => tmpfolder.type == "Item"
			&& tmpfolder.name == tmpname
			&& (tmpfolder.folder?.id ?? null) == (tmpparent?.id ?? null));
		if (tmpexisting) { return tmpexisting; }
		return await Folder.create({
			name: tmpname, type: "Item", folder: tmpparent?.id ?? null, sort: tmpsort ?? 0
		});
	}

	// @MARKER POPULATE
	// This is the function which fills the sidebar.
	//
	// Idempotent, like the compendium import: an item already in its folder is left alone rather
	// than duplicated, so this can be run again after the content is rebuilt and only the new
	// entries appear. It does NOT update what is already there -- a Game Master who has edited a
	// world item meant to, and a refresh that silently reverted their work would be a poor trade
	// for saving them a delete.
	export async function populateItemDirectory({ notify = true } = {}) {
		if (!game.user.isGM) {
			ui.notifications.warn("Only the Game Master can fill the Items directory.");
			return { created: 0, skipped: 0 };
		}

		var tmpcreated = 0;
		var tmpskipped = 0;
		var tmpfailed = [];
		if (notify) { ui.notifications.info("Imagine RPG | filling the Items directory, this takes a moment..."); }

		// Made the first time it is actually needed, and never otherwise -- a world where every
		// document traced to a book gets no gap folder at all. See getSourcebookId in
		// availability.mjs: "XXX" is his own build's mark for "not found in the Master Index", not a
		// sourcebook, so it is pulled out of the ordinary category folders into one place instead of
		// sitting one red field at a time inside them.
		var tmpxxxroot = null;

		for (const tmpentry of DIRECTORY) {
			var tmploaded = await loadEntryDocuments(tmpentry);
			var tmpdocs = tmploaded.docs;
			var tmproot = await ensureFolder(tmpentry.folder, null, DIRECTORY.indexOf(tmpentry) * 100000);

			// Names the system once shipped and no longer does (see RETIRED DOCUMENTS in
			// content-importer.mjs). Only inside this entry's own folder tree, so a copy a Game
			// Master filed elsewhere is theirs and stays. This is the one thing a refill removes:
			// without it, a world filled before the faeries were split listed plain Fairy forever.
			// The decision itself -- which retired names actually go -- is shared with the compendium
			// importer's own sweep; see retiredNamesToRemove in content-importer.mjs.
			var tmpretired = new Set(retiredNamesToRemove(RETIRED_DOCUMENTS[tmpentry.file],
				tmpdocs.map(tmpdoc => tmpdoc.name), game.items.map(tmpitem => tmpitem.name)));
			var tmpstale = game.items.filter(tmpitem => tmpretired.has(tmpitem.name)
				&& tmpitem.folder && (tmpitem.folder.id == tmproot.id || tmpitem.folder.ancestors?.some(tmpf => tmpf.id == tmproot.id)));
			if (tmpstale.length) {
				await Item.deleteDocuments(tmpstale.map(tmpitem => tmpitem.id));
				console.log(`Imagine RPG | ${tmpentry.folder}: ${tmpstale.length} retired item(s) removed`);
			}

			// Everything already in this tree, by folder id and name, so nothing is added twice.
			var tmpseen = new Set(game.items
				.filter(tmpitem => tmpitem.folder)
				.map(tmpitem => `${tmpitem.folder.id}::${tmpitem.name}`));

			// Pull out anything unattributed before the ordinary grouping sees it, so it lands in the
			// shared gap folder instead of buried in its usual category.
			var tmpxxxdocs = tmpentry.keepUnattributed ? [] : tmpdocs.filter(tmpdoc => tmpdoc.system?.sourcebook == "XXX");
			var tmpnormaldocs = tmpxxxdocs.length
				? tmpdocs.filter(tmpdoc => tmpdoc.system?.sourcebook != "XXX")
				: tmpdocs;

			// Group first, so each folder is made once rather than once per document.
			var tmpbygroup = {};
			for (const tmpdoc of tmpnormaldocs) {
				var tmpkey = tmpentry.group ? (tmpentry.group(tmpdoc) || "") : "";
				(tmpbygroup[tmpkey] ??= []).push(tmpdoc);
			}

			var tmpfolders = Object.keys(tmpbygroup).sort((a, b) => {
				var tmpa = (tmpentry.order ?? []).indexOf(a.split("/")[0]);
				var tmpb = (tmpentry.order ?? []).indexOf(b.split("/")[0]);
				if (tmpa != tmpb) { return (tmpa < 0 ? 999 : tmpa) - (tmpb < 0 ? 999 : tmpb); }
				return a.localeCompare(b);
			});

			var tmptocreate = [];
			for (const tmpkey of tmpfolders) {
				// A group may be two levels deep -- "Class skills/Player's Guide".
				var tmpfolder = tmproot;
				var tmpdepth = 0;
				for (const tmppart of tmpkey.split("/").filter(tmppart => tmppart)) {
					tmpfolder = await ensureFolder(tmppart, tmpfolder, tmpfolders.indexOf(tmpkey) * 1000 + tmpdepth);
					tmpdepth += 1;
				}
				for (const tmpdoc of tmpbygroup[tmpkey]) {
					if (tmpseen.has(`${tmpfolder.id}::${tmpdoc.name}`)) { tmpskipped += 1; continue; }
					tmptocreate.push({ ...tmpdoc, folder: tmpfolder.id });
				}
			}

			// The unattributed ones, filed under the shared top-level folder instead of this entry's
			// own -- subfoldered by pack so the 1,702 of them (docs/UNATTRIBUTED.md) do not land in
			// one flat list nobody can scan.
			if (tmpxxxdocs.length) {
				tmpxxxroot ??= await ensureFolder(XXX_FOLDER_NAME, null, -100000);
				var tmpxxxsub = await ensureFolder(tmpentry.folder, tmpxxxroot, DIRECTORY.indexOf(tmpentry));
				for (const tmpdoc of tmpxxxdocs) {
					if (tmpseen.has(`${tmpxxxsub.id}::${tmpdoc.name}`)) { tmpskipped += 1; continue; }
					tmptocreate.push({ ...tmpdoc, folder: tmpxxxsub.id });
				}
			}

			// A batch that Foundry refuses is reported and the rest carry on. Before this, one bad
			// document threw out of the whole run, and every folder after it was silently never made.
			var tmpmade = 0;
			for (var tmpat = 0; tmpat < tmptocreate.length; tmpat += BATCH) {
				try {
					var tmpbatch = await Item.createDocuments(tmptocreate.slice(tmpat, tmpat + BATCH), { keepId: false });
					tmpmade += tmpbatch.length;
				} catch (tmperror) {
					tmpfailed.push(`${tmpentry.folder}: ${tmperror.message}`);
					console.error(`Imagine RPG | ${tmpentry.folder}: a batch of ${BATCH} failed`, tmperror);
				}
			}
			tmpcreated += tmpmade;
			console.log(`Imagine RPG | ${tmpentry.folder}: ${tmpmade} created from the ${tmploaded.source}`);
		}

		if (notify) {
			ui.notifications.info(tmpskipped
				? `Imagine RPG | Items directory filled: ${tmpcreated} added, ${tmpskipped} already there.`
				: `Imagine RPG | Items directory filled: ${tmpcreated} items.`);
			if (tmpfailed.length) {
				ui.notifications.warn(`Imagine RPG | ${tmpfailed.length} batch(es) failed -- ${tmpfailed[0]} (see the console).`);
			}
		}
		return { created: tmpcreated, skipped: tmpskipped, failed: tmpfailed };
	}

	// @MARKER EMPTY
	// This is the function which takes it all out again, for a Game Master who tried it and would
	// rather have their sidebar back. Only the folders this made and what is inside them: an item
	// filed somewhere else, or made by hand, is not touched.
	export async function clearItemDirectory({ notify = true } = {}) {
		if (!game.user.isGM) {
			ui.notifications.warn("Only the Game Master can empty the Items directory.");
			return { removed: 0 };
		}
		var tmproots = game.folders.filter(tmpfolder => tmpfolder.type == "Item" && !tmpfolder.folder
			&& (DIRECTORY.some(tmpentry => tmpentry.folder == tmpfolder.name) || tmpfolder.name == XXX_FOLDER_NAME));
		var tmpremoved = 0;
		for (const tmpfolder of tmproots) {
			tmpremoved += tmpfolder.contents?.length ?? 0;
			// deleteSubfolders takes the whole tree; deleteContents takes the items in it.
			await tmpfolder.delete({ deleteSubfolders: true, deleteContents: true });
		}
		if (notify) { ui.notifications.info(`Imagine RPG | removed ${tmproots.length} folder tree(s).`); }
		return { removed: tmpremoved };
	}

// @MARKER ADD NEW item-directory functions HERE
// @END (CODE)
