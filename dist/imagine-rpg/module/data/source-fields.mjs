// @START (CODE)
// @MARKER SOURCE FIELDS
//==================================================================================================================
// Repairs for an item's sourcebook and page as they are read.
//
// Found in the 2026-09-23 bug sweep: the weapon, equipment and skill sheets each drew the sourcebook
// and page twice -- once in the shared header and once in the body's "Where it comes from" panel. Two
// inputs of one name come back from Foundry's form as an array, and a text field saves an array as the
// values joined by commas, so every edit of those sheets turned "Custom" into "Custom,Custom", then
// "Custom,Custom,Custom,Custom". A doubled book no longer matches its on/off switch (availability.mjs),
// and a doubled "XXX" no longer reads as unattributed. The templates are mended; this puts right what
// they already wrote.
//
// No book or page of his holds a comma, so a value whose comma-separated parts are ALL the same is
// taken back to one part. Anything else -- a comma a Game Master typed on purpose -- is left alone.
//==================================================================================================================

	// This is the function which gives back a value doubled by the old sheets as it was typed, and any
	// other value untouched.
	export function undoubleSourceValue(tmpValue) {
		if (typeof tmpValue != "string" || !tmpValue.includes(",")) { return tmpValue; }
		var tmpParts = tmpValue.split(",").map(tmpPart => tmpPart.trim());
		if (tmpParts.every(tmpPart => tmpPart == tmpParts[0])) { return tmpParts[0]; }
		return tmpValue;
	}

	// This is the function which a data model's migrateData calls with the item's source data: the
	// sourcebook and page, each put right by undoubleSourceValue. Changes the object it is given.
	export function undoubleSource(tmpSource) {
		if (!tmpSource || typeof tmpSource != "object") { return tmpSource; }
		for (const tmpKey of ["sourcebook", "page"]) {
			if (tmpKey in tmpSource) { tmpSource[tmpKey] = undoubleSourceValue(tmpSource[tmpKey]); }
		}
		return tmpSource;
	}

// @MARKER ADD NEW source field functions HERE
// @END (CODE)
