// @START (CODE)
// @MARKER ROLLED STARTING ENDURANCE
//==================================================================================================================
// The Foundry face of a race whose starting Endurance is a die rather than a number.
//
// One race has one: Gaunt, "Starting Endurance -1d4" (Epitaph of the Fallen p.7). His row carries it
// as the live expression [0-getDieRoll(4)] beside the label "-1d4=" (sheet-worker.js:34058), so his
// sheet rolls it whenever the race is applied and writes the figure to that character's
// race_start_tmp_end_mod (33722). Until 2026-09-23 nothing in the port rolled it, and every Gaunt
// started at 0 (UPSTREAM-ISSUES item 2).
//
// The rule itself -- reading the die out of his formula, rolling it into the character's own copy of
// the race, never rolling a copy twice -- is in race-rules.mjs (@MARKER ROLLED STARTING ENDURANCE),
// Foundry-free and tested there. This file only rolls Foundry's dice for it, in the two places the
// character generator cannot reach:
//
//     a race added to a character    the createItem hook below: a race dragged onto the sheet or
//                                    created by a macro is rolled the moment it arrives, as his sheet
//                                    rolls it the moment the race is applied
//     a Gaunt made before the fix    the sheet's Roll button beside Endurance (rollStartingEndurance
//                                    on the character sheet), shown only while the copy is unrolled,
//                                    and asking first if its Start mod is not 0
//                                    (confirmRaceStartingEnduranceRoll below)
//
// The generator rolls its own (assembleCharacter, chargen-rules.mjs), because it creates the actor
// and its items in one operation, which Foundry does not pass through createItem.
//
// NO RE-ROLL, for the reason handedness, the Famorian breed and starting money have none: a button
// that rolls until a 1 comes up is the same as choosing it. Once rolled, the button is gone. A Game
// Master who wants another figure types it into the race's Start roll on its own sheet, or unticks
// Start rolled there so the button comes back -- and the new roll then REPLACES the old one, because
// the roll is written to Start roll alone (never added to Start mod; see race-rules.mjs for why).
//
// The button asks first when the copy's Start mod is not 0 (getStartingEnduranceRollWarning): on a
// Gaunt made before 2026-09-23 that figure was typed by hand, and may be standing in for this roll.
//==================================================================================================================

import { parseStartingEnduranceDie, rollStartingEndurance, needsStartingEnduranceRoll,
         getStartingEnduranceLabel, getStartingEnduranceRollWarning } from "./race-rules.mjs";


// @MARKER ROLL ONE RACE

	// This is the function which rolls one race item's starting Endurance, writes it to that item, and
	// posts the roll to chat so the record of it stays whatever the field says later. Does nothing, and
	// returns null, for a race with nothing to roll or one already rolled -- asked again here rather than
	// trusted from the caller, since a stale sheet could still show the button.
	//
	// Returns the item's new endurance block, or null.
	export async function rollRaceStartingEndurance(tmpactor, tmpitem) {
		if (!tmpitem || tmpitem.type != "race") { return null; }
		if (!needsStartingEnduranceRoll(tmpitem.system)) { return null; }

		var tmpdie = parseStartingEnduranceDie(tmpitem.system.endurance.startFormula);
		var tmproll = await new Roll(`${tmpdie.count}d${tmpdie.sides}`).evaluate();

		// The faces Foundry rolled, handed to the rule one at a time as its tmpRoll(sides).
		var tmpfaces = (tmproll.dice?.[0]?.results ?? []).map(tmpresult => tmpresult.result);
		var tmpnext = 0;
		var tmpendurance = rollStartingEndurance({ ...tmpitem.system.endurance },
			() => tmpfaces[tmpnext++] ?? 1);

		// Start roll alone, never Start mod: a re-roll replaces, and a hand-typed Start mod stays as
		// it was (the button has already asked about one).
		await tmpitem.update({
			"system.endurance.startRoll": tmpendurance.startRoll,
			"system.endurance.startRolled": true
		});

		var tmpsigned = (tmpendurance.startRoll > 0 ? "+" : "") + tmpendurance.startRoll;
		await tmproll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			flavor: `${foundry.utils.escapeHTML(tmpactor?.name ?? "")}: ${foundry.utils.escapeHTML(tmpitem.name)} starting `
				+ `Endurance ${getStartingEnduranceLabel(tmpitem.system.endurance.startFormula)} &mdash; `
				+ `<strong>${tmpsigned}</strong>, rolled once`
		});
		return tmpendurance;
	}

	// This is the function which asks, before the header's Roll button rolls, whether to go on when the
	// copy's Start mod is not 0 -- a figure typed by hand, on a Gaunt made before 2026-09-23, that may be
	// standing in for this very roll (getStartingEnduranceRollWarning, race-rules.mjs, says what is
	// asked). Only the button asks: the generator and the createItem hook roll a fresh copy of the
	// document, whose Start mod is the race's own.
	//
	// Returns true to roll, false to leave it.
	export async function confirmRaceStartingEnduranceRoll(tmpitem) {
		var tmpwarning = tmpitem ? getStartingEnduranceRollWarning(tmpitem.name, tmpitem.system) : "";
		if (!tmpwarning) { return true; }
		var tmpconfirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: `${tmpitem.name}: starting Endurance` },
			content: `<p>${foundry.utils.escapeHTML(tmpwarning)}</p>`,
			rejectClose: false,
			modal: true
		});
		return !!tmpconfirmed;
	}


// @MARKER REGISTRATION

	// This is the function which rolls a race's starting Endurance when the race is added to a
	// character, the same hook natural weapons are granted from (natural-weapons.mjs). Only the user
	// who added the race rolls, so a table of four does not roll four times.
	export function registerRolledStartingEndurance() {
		Hooks.on("createItem", function (tmpitem, tmpoptions, tmpuserid) {
			if (tmpuserid != game.user.id) { return; }
			if (tmpitem.type != "race" || tmpitem.parent?.type != "character") { return; }
			rollRaceStartingEndurance(tmpitem.parent, tmpitem);
		});
	}

// @MARKER ADD NEW rolled starting Endurance functions HERE
// @END (CODE)
