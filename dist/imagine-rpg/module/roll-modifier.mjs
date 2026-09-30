// @START (CODE)
// @MARKER ROLL MODIFIER
//==================================================================================================================
// The one modifier prompt every roll button asks through -- his "?{Modifier}" prompt, and his
// roll_x / roll_x_mod button pairs folded into one button.
//
// Bug report 0.20.2:1 (Blocker, 2026-09-30): "all of the roll buttons do not currently allow for
// modifiers ... just add a modifier field to every roll that occurs before the actual roll goes
// out. Much in the same way that attack rolls in combat currently do." Before this, the prompt
// was only asked when the button was SHIFT-clicked (Daryl 2026-09-25), which nobody could find.
//
// So it is now the other way round, which is also Foundry's own convention (a plain click opens
// the dialog, shift-click "fast-forwards" past it):
//     click          ask for the modifier, then roll
//     shift-click    roll at once with no modifier
//
// Returns the number typed (0 for a shift-click), or null if the dialog was closed -- the caller
// then rolls nothing. Every caller that used to build its own DialogV2 for this goes through here,
// so the wording and the shortcut are the same on the character sheet, the creature sheet, the
// martial panel, the Magic & Lore tab and the casting actions.
//==================================================================================================================

	// This is the function which asks for a roll modifier.
	//
	//   tmpevent    the click, whose shiftKey skips the prompt
	//   tmptitle    the dialog's title ("Roll Modifier", "Pray for Bravery")
	//   tmpprompt   the line above the field ("Modifier to this STR save:")
	//   tmpoklabel  the button's word, "Roll" unless a caller says "Pray" or "Attempt it"
	export async function askRollModifier(tmpevent, tmptitle, tmpprompt, tmpoklabel) {
		if (tmpevent?.shiftKey) { return 0; }
		var tmpanswer = await foundry.applications.api.DialogV2.prompt({
			window: { title: tmptitle || "Roll Modifier" },
			content: `<p>${tmpprompt || "Modifier to the roll:"}</p>
				<input type="number" name="modifier" value="0" autofocus>
				<p class="hint">Shift-click a roll button to skip this.</p>`,
			rejectClose: false,
			ok: { label: tmpoklabel || "Roll", callback: (tmpe, tmpbutton) => tmpbutton.form.elements.modifier.value }
		}).catch(() => null);
		if (tmpanswer === null || tmpanswer === undefined) { return null; }
		return parseInt(tmpanswer) || 0;
	}

	// This is the function which writes a modifier into a chat flavor line -- " (modifier +3)", or
	// nothing at all for zero -- so every card says it the same way.
	export function describeModifier(tmpmodifier) {
		var tmpvalue = parseInt(tmpmodifier) || 0;
		if (!tmpvalue) { return ""; }
		return ` (modifier ${tmpvalue > 0 ? "+" : ""}${tmpvalue})`;
	}

// @MARKER ADD NEW roll modifier functions HERE
// @END (CODE)
