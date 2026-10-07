// @START (CODE)
// @MARKER DATA FIXES
//==================================================================================================================
// One-time repairs to a world's own documents after an update -- the things a rebuild of the
// shipped content cannot reach, because they are on the characters already made.
//
// The content importer matches by name and retires names the system once shipped
// (content-importer.mjs RETIRED_DOCUMENTS), which puts the COMPENDIUM right. A character who
// already holds a retired skill by its old name is untouched by that, and would keep it, so each
// fix here walks the world's actors once. Which fixes have run is a world setting, so a fix runs
// once per world and never again, and a new fix added later runs on its own.
//
// Only the Game Master's client runs them: a player cannot update another's actor, and two clients
// running the same fix would race.
//
//     key                     what it does                                            added
//     botanist-to-botany      skill items named Botanist become Botany (0.20.5:1)      2026-09-30
//==================================================================================================================

const SETTING = "dataFixesApplied";

	// @MARKER BOTANIST
	// Bug report 0.20.5:1: "There should only be Botany (not Botanist)". His data carried the one
	// skill under both names (build_documents.py SKILL_RENAMES). A character holding Botanist is
	// renamed to Botany; one holding both keeps Botany and loses the Botanist copy, since two rows
	// of one skill would roll twice. The compendium copy goes the same way if Botany is there.
	async function fixBotanistToBotany() {
		var tmprenamed = 0;
		var tmpdropped = 0;
		for (const tmpactor of game.actors.contents) {
			var tmpold = tmpactor.items.filter(tmpitem => tmpitem.type == "skill" && tmpitem.name == "Botanist");
			if (!tmpold.length) { continue; }
			var tmphasnew = tmpactor.items.some(tmpitem => tmpitem.type == "skill" && tmpitem.name == "Botany");
			if (tmphasnew) {
				await tmpactor.deleteEmbeddedDocuments("Item", tmpold.map(tmpitem => tmpitem.id));
				tmpdropped += tmpold.length;
			} else {
				await tmpold[0].update({ name: "Botany" });
				tmprenamed += 1;
				if (tmpold.length > 1) {
					await tmpactor.deleteEmbeddedDocuments("Item", tmpold.slice(1).map(tmpitem => tmpitem.id));
					tmpdropped += tmpold.length - 1;
				}
			}
		}
		var tmppack = game.packs.get("world.imagine-skills");
		if (tmppack) {
			var tmpindex = await tmppack.getIndex();
			var tmpoldentry = tmpindex.find(tmpentry => tmpentry.name == "Botanist");
			var tmpnewentry = tmpindex.find(tmpentry => tmpentry.name == "Botany");
			if (tmpoldentry && tmpnewentry) {
				var tmpdoc = await tmppack.getDocument(tmpoldentry._id);
				if (tmpdoc) { await tmpdoc.delete(); tmpdropped += 1; }
			}
		}
		return `Botanist is Botany: ${tmprenamed} character skill(s) renamed, ${tmpdropped} duplicate(s) removed.`;
	}

	// Every fix, in the order they were added. A fix returns one line for the console.
	export const DATA_FIXES = [
		//  key                      the fix
		{ key: "botanist-to-botany", apply: fixBotanistToBotany }
	];

	// This is the function which runs every fix this world has not had yet. Called once on ready,
	// by the Game Master's client; safe to call again, since a fix that has run is skipped.
	export async function applyDataFixes() {
		// The active Game Master only: a player calling this from the console got part-way through
		// the actors they own and then failed on the world setting; a second Game Master raced the
		// first (quality pass 2026-10-07).
		if (!game.user?.isActiveGM) {
			ui.notifications?.warn("Only the active Game Master can run the data fixes.");
			return;
		}
		var tmpdone = game.settings.get("imagine-rpg", SETTING) ?? [];
		var tmpapplied = [...tmpdone];
		for (const tmpfix of DATA_FIXES) {
			if (tmpdone.includes(tmpfix.key)) { continue; }
			try {
				var tmpline = await tmpfix.apply();
				console.log(`Imagine RPG | data fix ${tmpfix.key}: ${tmpline}`);
				tmpapplied.push(tmpfix.key);
			} catch (tmperror) {
				// Left unrecorded, so it is tried again next load rather than half-done and forgotten.
				console.warn(`Imagine RPG | data fix ${tmpfix.key} failed and will be retried`, tmperror);
			}
		}
		if (tmpapplied.length != tmpdone.length) {
			await game.settings.set("imagine-rpg", SETTING, tmpapplied);
		}
		return tmpapplied;
	}

	// This is the function which registers the world setting the fixes are recorded in.
	export function registerDataFixSetting() {
		game.settings.register("imagine-rpg", SETTING, {
			scope: "world",
			config: false,
			type: Array,
			default: []
		});
	}

// @MARKER ADD NEW data fix functions HERE
// @END (CODE)
