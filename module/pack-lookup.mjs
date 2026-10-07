// @START (CODE)
// @MARKER PACK LOOKUP
//==================================================================================================================
// Fetching a few named documents from a compendium without loading the whole of it.
//
// Three hooks used to call pack.getDocuments() for everything -- 675 skills to grant three, 689
// weapons to make a claw, the whole skill pack to find Sense Supernatural -- on every title change,
// every race added, every level-up (quality pass 2026-10-07). The index is already in memory on
// every client; filtering it by name and asking for only those ids is what getDocuments is for.
//==================================================================================================================

	// This is the function which returns the documents of one pack whose names are wanted, as plain
	// objects (toObject), in no particular order. A pack that does not exist, or a name the pack
	// does not have, simply yields nothing -- the same quiet answer the character generator gives a
	// missing pack. tmpnames may be an array or a Set.
	export async function getPackDocumentsByName(tmppackid, tmpnames) {
		var tmppack = game.packs.get(tmppackid);
		if (!tmppack) { return []; }
		var tmpwanted = tmpnames instanceof Set ? tmpnames : new Set(tmpnames ?? []);
		if (!tmpwanted.size) { return []; }
		// No index to read (the test harnesses' stub packs have only getDocuments): read the whole
		// pack and keep the names wanted, which is what every caller did before.
		if (!tmppack.index?.[Symbol.iterator]) {
			return (await tmppack.getDocuments()).filter(tmpdoc => tmpwanted.has(tmpdoc.name)).map(tmpdoc => tmpdoc.toObject());
		}
		var tmpids = [];
		for (const tmpentry of tmppack.index) {
			if (tmpwanted.has(tmpentry.name)) { tmpids.push(tmpentry._id); }
		}
		if (!tmpids.length) { return []; }
		var tmpdocs = await tmppack.getDocuments({ _id__in: tmpids });
		return tmpdocs.map(tmpdoc => tmpdoc.toObject());
	}

// @MARKER ADD NEW pack lookup functions HERE
// @END (CODE)
