// @START (CODE)
// @MARKER GM EXPERIENCE LOOKUPS
//==================================================================================================================
// The part of valuing a character that needs Foundry: the level of each Additional Power, which is the
// level of the spell or invocation it names (his getPowerExp, sheet-worker.js:176093: getSpellDetails,
// then getInvocationDetails, the level in the second place). The arithmetic is module/gm-exp-rules.mjs.
// Shared by the GM Tools window and the main tab's "Experience Value" line, so neither works it out twice.
//==================================================================================================================

import { getPackDocumentsByName } from "./pack-lookup.mjs";
import { calcCharacterExp } from "./gm-exp-rules.mjs";

	// This is the function which gives each of the character's powers' levels, in order: the spell's or
	// invocation's level where the name (without its "(3x Day)" at the end) is in either compendium, 0
	// where it is in neither -- a power he typed in is worth nothing, as his is.
	export async function getPowerLevels(tmpactor) {
		var tmpnames = (tmpactor?.items ?? []).filter(tmpitem => tmpitem.type == "power")
			.map(tmpitem => tmpitem.name.replace(/\([^()]*\)\s*$/, "").trim());
		if (!tmpnames.length) { return []; }
		var tmpspells = await getPackDocumentsByName("world.imagine-spells", tmpnames);
		var tmpinvocations = await getPackDocumentsByName("world.imagine-invocations", tmpnames);
		return tmpnames.map(tmpname => {
			var tmpdoc = tmpspells.find(tmpentry => tmpentry.name == tmpname) ?? tmpinvocations.find(tmpentry => tmpentry.name == tmpname);
			return parseInt(tmpdoc?.system?.level) || 0;
		});
	}

	// This is the function which values a character from the live actor.
	export async function valueCharacter(tmpactor) {
		return calcCharacterExp(tmpactor, await getPowerLevels(tmpactor));
	}

// @MARKER ADD NEW gm experience lookups HERE
// @END (CODE)
