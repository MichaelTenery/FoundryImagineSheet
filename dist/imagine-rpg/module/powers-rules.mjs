// @START (CODE)
// @MARKER POWERS AND ABILITIES RULES
//==================================================================================================================
// His "Add/Remove Powers/Abilities" step of the Character Updater, without Foundry, so the test can
// run it. The window is module/apps/powers.mjs; what it shows is module/powers-view.mjs.
//
// HIS DATA, AND WHAT THE PORT KEEPS INSTEAD. His sheet keeps one comma-separated text attribute,
// `powers` ("Fireball(2x Day), Fly(Constant)"), shown as "Additional Powers/Abilities", and for a
// MAGICAL or DIVINE entry also files a row in his repeating_powers section holding the name and the
// uses (createSinglePowerByName, sheet-worker.js:174603). The port already has that second thing: a
// `power` item, with the uses on it -- and its Arch Mortal invulnerability and its power count for the
// Arch Mortal qualification already read those items rather than a text. So an entry here IS a power
// item, named as his text names it, and the text his sheet shows is the item names in order. One store,
// no second list to fall out of step with the first. His OPEN entries (typed in, no spell behind them)
// are the one difference: his sheet files only the text for those; here they are items too, with no
// magic switch (subsystem "none"), because an item is the only thing there is to remove later.
//
// Ported from roll_add_open_ability .. roll_add_divine_power and remove_power (sheet-worker.js:11566-
// 11840), getRealUsage (174615) and the left/right arrows (11725-11783).
//==================================================================================================================

	// His activation dropdown (HTML 54118-54128), in his order. "(By Title)" is the default.
	//                                value
	export const POWER_ACTIVATIONS = [
		"(By Title)",
		"(1x Year)",
		"(1x Month)",
		"(1x Week)",
		"(1x Day)",
		"(2x Day)",
		"(3x Day)",
		"(4x Day)",
		"(5x Day)",
		"(At Will)"
	];

	// The three ways an entry is made, as the window's three groups of controls name them.
	//                            label                  kind in the item     pack that supplies the dropdown
	export const POWER_SOURCES = {
		open:     [ "Open (typed in)",   "unknown",     ""                          ],
		magical:  [ "Magical (spell)",   "spell",       "world.imagine-spells"      ],
		divine:   [ "Divine (invocation)", "invocation", "world.imagine-invocations" ]
	};

	// This is the function which gives the number of uses a title's "(By Title)" power has, or
	// "Infinite" -- his getRealUsage (174615): title 0 once a month, 1-3 once a week, 4-6 once a day,
	// 7-9 twice, 10-12 three times, 13-15 four, 16-19 five, 20 and over at will. A fixed activation
	// reads its own number ("(3x Day)" -> 3, a year, month or week one use of that period); "(At Will)"
	// and "(Constant)" are unlimited.
	export function getRealUsage(tmpactivation, tmptitle) {
		var tmptext = "" + (tmpactivation ?? "");
		var tmplevel = parseInt(tmptitle) || 0;
		if (tmptext.includes("By Title")) {
			if (tmplevel < 1) { return 1; }
			if (tmplevel < 4) { return 1; }
			if (tmplevel < 7) { return 1; }
			if (tmplevel < 10) { return 2; }
			if (tmplevel < 13) { return 3; }
			if (tmplevel < 16) { return 4; }
			if (tmplevel < 20) { return 5; }
			return "Infinite";
		}
		if (tmptext.includes("At Will") || tmptext.includes("Constant")) { return "Infinite"; }
		var tmpnumber = parseInt((tmptext.match(/\d+/) ?? [])[0]);
		return tmpnumber || 1;
	}

	// This is the function which says how often a "(By Title)" power is used at a title, in words, as
	// his note under the controls does: "0=1x month, 1-3=1x week ...".
	export function describeTitleUsage(tmptitle) {
		var tmpuses = getRealUsage("(By Title)", tmptitle);
		var tmplevel = parseInt(tmptitle) || 0;
		if (tmpuses == "Infinite") { return "at will"; }
		if (tmplevel < 1) { return "1x month"; }
		if (tmplevel < 4) { return "1x week"; }
		return `${tmpuses}x day`;
	}

	// This is the function which makes the entry for one add: the name his text carries, and the item
	// it becomes. tmpkind is "open" | "magical" | "divine"; tmpisability is true for the ABILITY
	// controls, which are always constant ("(Constant)"), false for a power with an activation.
	// Returns null for a blank name, which his handlers also do nothing with.
	//
	// No commas in the name: his list is split on them, and his own box says "(No Commas!)". They are
	// taken out rather than refused, since the name is a typed one and the word still reads.
	export function buildPowerEntry(tmpkind, tmpname, tmpactivation, tmptitle, tmpisability) {
		var tmpclean = ("" + (tmpname ?? "")).replace(/,/g, " ").replace(/\s+/g, " ").trim();
		if (!tmpclean || tmpclean == "None") { return null; }
		var tmpsource = POWER_SOURCES[tmpkind] ?? POWER_SOURCES.open;
		var tmpusage = tmpisability ? "(Constant)" : ("" + (tmpactivation || "(By Title)"));
		var tmpuses = getRealUsage(tmpusage, tmptitle);
		var tmpunlimited = tmpuses == "Infinite";
		var tmpcount = tmpunlimited ? 0 : tmpuses;
		return {
			name: tmpclean + tmpusage,
			baseName: tmpclean,
			isAbility: !!tmpisability,
			kind: tmpkind,
			system: {
				unlimited: tmpunlimited, uses: tmpcount, usesMax: tmpcount, selfOnly: false,
				powerKind: tmpsource[1],
				// An open entry answers to no magic switch; a spell's or invocation's to the Powers switch.
				subsystem: tmpkind == "open" ? "none" : "powers",
				sourcebook: "", page: "",
				description: tmpisability ? "An additional ability, added from the Updater." : "An additional power, added from the Updater."
			}
		};
	}

	// This is the function which walks the remove selector one step, wrapping round at either end as his
	// arrows do (11725-11783): from nothing it goes to the first (right) or last (left). tmpnames is the
	// list in order; tmpcurrent the name now shown; tmpdirection "left" | "right". Returns the new name,
	// or "" for an empty list.
	export function stepPowerSelection(tmpnames, tmpcurrent, tmpdirection) {
		var tmplist = tmpnames ?? [];
		if (!tmplist.length) { return ""; }
		var tmpat = tmplist.indexOf(tmpcurrent);
		if (tmpdirection == "left") {
			if (tmpat < 0) { return tmplist[tmplist.length - 1]; }
			return tmplist[(tmpat - 1 + tmplist.length) % tmplist.length];
		}
		if (tmpat < 0) { return tmplist[0]; }
		return tmplist[(tmpat + 1) % tmplist.length];
	}

	// This is the function which gives his "powers" text for a list of names: joined with ", ", or
	// "None" for no entries, which is what his hidden attribute holds.
	export function joinPowerText(tmpnames) {
		return (tmpnames ?? []).length ? tmpnames.join(", ") : "None";
	}

// @MARKER ADD NEW powers rule functions HERE
// @END (CODE)
