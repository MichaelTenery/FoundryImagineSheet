// @START (CODE)
// @MARKER NATURAL WEAPONS
//==================================================================================================================
// A race's claws, bites, horns and stingers, put on the character as ordinary weapons.
//
// His sheet gives a race its natural attacks in setRacialNaturalAttacks (sheet-worker.js:100946)
// and shows them in a block of their own. Here each one is a WEAPON in the weapons pack ("Saurian
// Claws"), listed on the race as naturalWeapons, and given to the character with the race -- so it
// sits in the Weapons section with the rest of their gear and is rolled like any other weapon. A
// player who does not want one deletes it. The user's call, 2026-09-23; see DECISIONS.md.
//
// WHEN IT RUNS. Two ways a race reaches a character:
//     the character generator       assembleCharacter adds them with the race (chargen-rules.mjs)
//     a race dropped on a sheet     the createItem hook below
// and game.imagine.grantNaturalWeapons(actor) for a character made before this existed.
//
// WHAT IT NEVER DOES. It never removes a weapon, and never gives one the character already has by
// that name -- so deleting a claw is not undone by the next race change, and running it twice gives
// nothing twice.
//==================================================================================================================

const WEAPON_PACK = "world.imagine-weapons";

// Actors a grant is running for right now, for the same reason class-advancement.mjs keeps one: two
// grants racing on one actor would each read the held weapons before either had created anything.
const granting = new Set();

	// @MARKER WHICH BODY
	// This is the function which picks the race whose body the character has. His switch opens with
	// the answer (sheet-worker.js:100947-100951):
	//
	//     half race        "half races set body by the first race"      -> the first race
	//     Formless         the race it "Appears as"                     -> its host, never itself
	//
	// A Formless race item carries formless:true and every other race does not, so both rules come
	// to the same thing here: the first race that is not Formless. Returns the race's system data,
	// or null for a character with no body race at all (a Formless with no host yet).
	export function getBodyRace(tmpRaceSystems) {
		return (tmpRaceSystems ?? []).find(tmpSystem => tmpSystem && !tmpSystem.formless) ?? null;
	}

	// This is the function which lists the natural weapons a character is born with, by name.
	//
	// tmpSlight is the character's slight physique: true, false, or null where it is not known. It
	// matters to one attack -- the Apocritara's Stinger, which his switch gives to the slight branch
	// only. The actor does not store the physique (only the generator knows it), so a race dropped on
	// a sheet passes null, and an attack of one physique is then left for the player to drag from the
	// weapons pack rather than guessed.
	export function getNaturalWeaponNames(tmpRaceSystems, tmpSlight) {
		var tmpBody = getBodyRace(tmpRaceSystems);
		var tmpNames = [];
		for (const tmpEntry of tmpBody?.naturalWeapons ?? []) {
			var tmpPhysique = tmpEntry.physique ?? "";
			if (tmpPhysique == "slight" && tmpSlight !== true) { continue; }
			if (tmpPhysique == "ordinary" && tmpSlight !== false) { continue; }
			if (tmpEntry.name) { tmpNames.push(tmpEntry.name); }
		}
		return tmpNames;
	}

	// This is the function which lists the natural weapons a character's race gives and it does not
	// hold, by name -- what the Equipment tab's "Add natural weapons" button would add. The physique is
	// not known on a sheet, so an attack of one physique only is never listed (see above).
	export function getMissingNaturalWeaponNames(tmpRaceSystems, tmpHeldNames) {
		var tmpHeld = new Set(tmpHeldNames ?? []);
		return getNaturalWeaponNames(tmpRaceSystems, null).filter(tmpName => !tmpHeld.has(tmpName));
	}

	// This is the function which says which hand a natural weapon is in. A claw is not held, but the
	// weapon attack reads the hand to decide the off-hand penalty, and a character's own claws are
	// never their off hand -- so it is their dominant hand, and "right" for the Ambidextrous (who have
	// no off hand at all) and for anyone whose handedness is not set yet.
	export function getNaturalWeaponHand(tmpHandedness) {
		return ("" + (tmpHandedness ?? "")).toLowerCase() == "left" ? "left" : "right";
	}

	// This is the function which builds the item data for each natural weapon a character should
	// have and does not hold, from the weapon documents given. Returns { items, missing }: a name the
	// pack does not hold is reported, not invented.
	export function buildNaturalWeaponItems(tmpNames, tmpWeaponDocs, tmpHeldNames, tmpHandedness) {
		var tmpItems = [];
		var tmpMissing = [];
		var tmpHeld = new Set(tmpHeldNames ?? []);
		for (const tmpName of tmpNames ?? []) {
			if (tmpHeld.has(tmpName)) { continue; }
			var tmpDoc = (tmpWeaponDocs ?? []).find(tmpCandidate => tmpCandidate.name == tmpName);
			if (!tmpDoc) { tmpMissing.push(tmpName); continue; }
			tmpItems.push({
				name: tmpDoc.name, type: "weapon", img: tmpDoc.img,
				system: { ...structuredClone(tmpDoc.system ?? {}),
					location: "equipped", hand: getNaturalWeaponHand(tmpHandedness) }
			});
			tmpHeld.add(tmpName);
		}
		return { items: tmpItems, missing: tmpMissing };
	}


// @MARKER THE GRANT
	// This is the function which gives an actor every natural weapon its body race has and it does
	// not hold. Returns { granted, missing }.
	export async function grantNaturalWeapons(tmpactor, { notify = true } = {}) {
		var tmpnothing = { granted: [], missing: [] };
		if (!tmpactor || tmpactor.type != "character") { return tmpnothing; }
		if (granting.has(tmpactor.id)) { return tmpnothing; }
		granting.add(tmpactor.id);

		try {
			var tmpraces = tmpactor.items.filter(tmpitem => tmpitem.type == "race").map(tmpitem => tmpitem.system);
			var tmpnames = getNaturalWeaponNames(tmpraces, null);
			if (!tmpnames.length) { return tmpnothing; }

			var tmpheld = tmpactor.items.filter(tmpitem => tmpitem.type == "weapon").map(tmpitem => tmpitem.name);
			if (tmpnames.every(tmpname => tmpheld.includes(tmpname))) { return tmpnothing; }

			var tmppack = game.packs.get(WEAPON_PACK);
			var tmpdocs = tmppack ? (await tmppack.getDocuments()).map(tmpdoc => tmpdoc.toObject()) : [];
			var tmpbuilt = buildNaturalWeaponItems(tmpnames, tmpdocs, tmpheld, tmpactor.system.physical?.handedness);
			if (tmpbuilt.items.length) { await tmpactor.createEmbeddedDocuments("Item", tmpbuilt.items); }

			if (notify && tmpbuilt.items.length) {
				ui.notifications.info(`${tmpactor.name} has natural weapons: `
					+ `${tmpbuilt.items.map(tmpitem => tmpitem.name).join(", ")}. Delete any that are not wanted.`);
			}
			if (notify && tmpbuilt.missing.length) {
				ui.notifications.warn(`${tmpactor.name}: ${tmpbuilt.missing.join(", ")} `
					+ `${tmpbuilt.missing.length == 1 ? "is" : "are"} not in the weapons compendium. `
					+ `Import the content again (game.imagine.importContent()).`);
			}
			return { granted: tmpbuilt.items.map(tmpitem => tmpitem.name), missing: tmpbuilt.missing };
		} finally {
			granting.delete(tmpactor.id);
		}
	}

	// This is the function which gives a character their natural weapons when a race item arrives on
	// them -- dragged from the compendium, or dropped from the sidebar. Only the user who made the
	// change runs it, so a race added by one player is not granted once per connected client.
	export function registerNaturalWeapons() {
		Hooks.on("createItem", function (tmpitem, tmpoptions, tmpuserid) {
			if (tmpuserid != game.user.id) { return; }
			if (tmpitem.type != "race" || tmpitem.parent?.type != "character") { return; }
			grantNaturalWeapons(tmpitem.parent);
		});
	}

// @MARKER ADD NEW natural weapon functions HERE
// @END (CODE)
