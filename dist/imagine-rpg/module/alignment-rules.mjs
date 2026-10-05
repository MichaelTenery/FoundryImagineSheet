// @START (CODE)
// @MARKER ALIGNMENT RULES
//==================================================================================================================
// Which alignments and tendencies a class allows, and the Game Master's own custom ones.
//
// His Roll20 sheet does this in step 7 of the character configurator. checkClassQualification copies
// the class row's alignment requirement (classDetails[7], sheet-worker.js:51009) into
// tmp_align_requirements (51202); setAlignmentSelection (73081-73301) switches on that exact string
// and shows one of 21 blocks of dropdowns (HTML 45293-45833). Nothing in his sheet reads the
// requirement text itself: the dropdown IS the restriction. So the lists here are transcribed from
// HIS DROPDOWNS, not from the wording of the requirement -- where the two disagree (see the notes
// on each row) his dropdown is what his table played with, and it wins (user's ruling 2026-09-26).
//
// Pure: no game.settings, no Foundry. The Game Master's custom alignments (the world setting
// imagine-rpg.customAlignments) arrive as the tmpCustom argument; with none given, his lists alone.
//
// Storage is his exact SPACED strings, "Fanatical Good (Active)", because every reader of an
// alignment (isAlignmentBarred, getHymnList, getStartingPoisonTypes, getBlessingModifier, his
// getAuraColor) matches on those words. A custom alignment must therefore carry its axis words in
// its own name -- validateCustomAlignment -- so those readers keep working unchanged.
//==================================================================================================================


// @MARKER ALIGNMENT LIST
// His fifteen alignments and Insane, sixteen entries, in his dropdown order and spelling (HTML 45302-45317; the
// Player's Guide pp.39-41 has the fifteen, Insane is his sheet's). Each is laid out on the three
// axes the class lists are drawn along, so a custom alignment can be tested against the same lists:
//     moral      Good / Neutral Good / Neutral / Neutral Evil / Evil, or None for Insane
//     activity   Active / Passive / True (True Neutral only), or None for Insane
//     fanatical  the Fanatical Good and Fanatical Evil four
export const ALIGNMENT_AXES = {
	// alignment                    moral             activity    fanatical
	"Fanatical Good (Active)":   { moral: "Good",         activity: "Active",  fanatical: true  },
	"Fanatical Good (Passive)":  { moral: "Good",         activity: "Passive", fanatical: true  },
	"Good (Active)":             { moral: "Good",         activity: "Active",  fanatical: false },
	"Good (Passive)":            { moral: "Good",         activity: "Passive", fanatical: false },
	"Neutral Good (Active)":     { moral: "Neutral Good", activity: "Active",  fanatical: false },
	"Neutral Good (Passive)":    { moral: "Neutral Good", activity: "Passive", fanatical: false },
	"Neutral (Active)":          { moral: "Neutral",      activity: "Active",  fanatical: false },
	"True Neutral":              { moral: "Neutral",      activity: "True",    fanatical: false },
	"Neutral (Passive)":         { moral: "Neutral",      activity: "Passive", fanatical: false },
	"Neutral Evil (Active)":     { moral: "Neutral Evil", activity: "Active",  fanatical: false },
	"Neutral Evil (Passive)":    { moral: "Neutral Evil", activity: "Passive", fanatical: false },
	"Evil (Active)":             { moral: "Evil",         activity: "Active",  fanatical: false },
	"Evil (Passive)":            { moral: "Evil",         activity: "Passive", fanatical: false },
	"Fanatical Evil (Active)":   { moral: "Evil",         activity: "Active",  fanatical: true  },
	"Fanatical Evil (Passive)":  { moral: "Evil",         activity: "Passive", fanatical: true  },
	"Insane":                    { moral: "None",         activity: "None",    fanatical: false }
};
export const ALIGNMENT_LIST = Object.keys(ALIGNMENT_AXES);

// Insane is in every one of his lists (every select in HTML 45298-45833 ends with it), whatever the
// class. It is always offered, always last, and never filtered.
export const ALIGNMENT_INSANE = "Insane";

// What he writes when there is no alignment: setFinalAlignment (73395-73429) gives "N/A" to the
// Alignmentless (tmp_alignmentless, "GM Discretion", HTML 45267-45268) and "None" to a blank field.
export const ALIGNMENT_NOT_APPLICABLE = "N/A";
export const ALIGNMENT_NONE = "None";


// @MARKER TENDENCY LIST
// His eight tendencies, one combined string each, in his dropdown order (HTML 45320-45328).
// Two of his blocks offer only part of the list:
//     order      Order, Moral/Order, Immoral/Order         (HTML 45785-45789, 45809-45813)
//     immoral    Immoral, Immoral/Order, Immoral/Chaos     (HTML 45828-45832)
export const TENDENCY_LIST = ["Moral", "Moral/Order", "Moral/Chaos", "Order", "Immoral", "Immoral/Order", "Immoral/Chaos", "Chaos"];
export const TENDENCY_LISTS = {
	// list        tendencies
	"any":         TENDENCY_LIST,
	"order":       ["Order", "Moral/Order", "Immoral/Order"],
	"immoral":     ["Immoral", "Immoral/Order", "Immoral/Chaos"]
};


// @MARKER CLASS REQUIREMENT LISTS
// One row per case of setAlignmentSelection (73081-73301), keyed by the requirement string EXACTLY
// as his class rows (and so src/packs/documents/classes.json) spell it. The alignments column is his
// dropdown, transcribed in his order with Insane left off (it is added to every list):
//     FG-A Fanatical Good (Active)   G-A Good (Active)   NG-A Neutral Good (Active)   N-A Neutral (Active)
//     FG-P Fanatical Good (Passive)  G-P Good (Passive)  NG-P Neutral Good (Passive)  N-P Neutral (Passive)
//     TN   True Neutral
//     NE-A Neutral Evil (Active)     E-A Evil (Active)   FE-A Fanatical Evil (Active)
//     NE-P Neutral Evil (Passive)    E-P Evil (Passive)  FE-P Fanatical Evil (Passive)
// The moral / activity / fanatical columns are the same list said as a rule, for a custom
// alignment: its moral axis must be in "moral" (null = any, including None), its activity in
// "activity" (null = any), and it must be fanatical where "fanatical" is true. The test page proves
// the rule gives back exactly his list for his fifteen.
//
// Where his dropdown is wider than his own words (his slip, logged, his dropdown kept):
//     "Good (Active), Fanatical Good (Active)"  offers the Passive two as well (HTML 45420-45427)
//     "Evil (Active), Fanatical Evil (Active)"  likewise (HTML 45717-45724), and so its Immoral twin
//     "True Neutral or Neutral Good"            offers Neutral (Active) and (Passive) too
//     "True Neutral or Neutral Evil"            likewise
//     "No Active or Fanatical Good"             keeps Neutral Good (Active) and (Passive)
const ALIGNMENT_REQUIREMENT_TABLE = {
	// requirement (his case key)                          case    HTML    alignments offered                                                   moral                                              activity     fanatical  tendencies  default
	"Any":                                              [73115, 45298, "FG-A FG-P G-A G-P NG-A NG-P N-A TN N-P NE-A NE-P E-A E-P FE-A FE-P", null,                                              null,        false,     "any",      ""],
	"Any (but must match one part of the Patron's)":    [73123, 45298, "FG-A FG-P G-A G-P NG-A NG-P N-A TN N-P NE-A NE-P E-A E-P FE-A FE-P", null,                                              null,        false,     "any",      ""],
	"Any Active":                                       [73131, 45334, "FG-A G-A NG-A N-A NE-A E-A FE-A",                                     null,                                              ["Active"],  false,     "any",      ""],
	"Any Non-Neutral":                                  [73139, 45362, "FG-A FG-P G-A G-P E-A E-P FE-A FE-P",                                 ["Good", "Evil"],                                  null,        false,     "any",      ""],
	"Any Good":                                         [73147, 45391, "FG-A FG-P G-A G-P NG-A NG-P",                                         ["Good", "Neutral Good"],                          null,        false,     "any",      ""],
	"Good (Active), Fanatical Good (Active)":           [73155, 45418, "FG-A FG-P G-A G-P",                                                   ["Good"],                                          null,        false,     "any",      ""],
	"Fanatical Good":                                   [73163, 45443, "FG-A FG-P",                                                           ["Good"],                                          null,        true,      "any",      ""],
	"Any Non-Evil, Passive":                            [73171, 45466, "FG-P G-P NG-P N-P",                                                   ["Good", "Neutral Good", "Neutral"],               ["Passive"], false,     "any",      ""],
	"No Evil":                                          [73179, 45491, "FG-A FG-P G-A G-P NG-A NG-P N-A TN N-P",                              ["Good", "Neutral Good", "Neutral"],               null,        false,     "any",      ""],
	"True Neutral or Neutral Good":                     [73187, 45521, "NG-A NG-P N-A TN N-P",                                                ["Neutral Good", "Neutral"],                       null,        false,     "any",      ""],
	"Any Neutral":                                      [73195, 45547, "NG-A NG-P N-A TN N-P NE-A NE-P",                                      ["Neutral Good", "Neutral", "Neutral Evil"],       null,        false,     "any",      ""],
	"True Neutral or Neutral Evil":                     [73203, 45575, "N-A TN N-P NE-A NE-P",                                                ["Neutral", "Neutral Evil"],                       null,        false,     "any",      ""],
	"No Good":                                          [73211, 45602, "N-A TN N-P NE-A NE-P E-A E-P FE-A FE-P",                              ["Neutral", "Neutral Evil", "Evil"],               null,        false,     "any",      ""],
	"No Active or Fanatical Good":                      [73219, 45632, "NG-A NG-P N-A TN N-P NE-A NE-P E-A E-P FE-A FE-P",                    ["Neutral Good", "Neutral", "Neutral Evil", "Evil"], null,      false,     "any",      ""],
	"Any Evil":                                         [73227, 45664, "NE-A NE-P E-A E-P FE-A FE-P",                                         ["Neutral Evil", "Evil"],                          null,        false,     "any",      ""],
	"Any Evil, Passive":                                [73235, 45691, "NE-P E-P FE-P",                                                       ["Neutral Evil", "Evil"],                          ["Passive"], false,     "any",      ""],
	"Evil (Active), Fanatical Evil (Active)":           [73243, 45715, "E-A E-P FE-A FE-P",                                                   ["Evil"],                                          null,        false,     "any",      ""],
	"Fanatical Evil":                                   [73251, 45740, "FE-A FE-P",                                                           ["Evil"],                                          null,        true,      "any",      ""],
	"Any, Order":                                       [73259, 45763, "FG-A FG-P G-A G-P NG-A NG-P N-A TN N-P NE-A NE-P E-A E-P FE-A FE-P", null,                                              null,        false,     "order",    "Order"],
	"No Evil, Order":                                   [73267, 45793, "FG-A FG-P G-A G-P NG-A NG-P N-A TN N-P",                              ["Good", "Neutral Good", "Neutral"],               null,        false,     "order",    "Order"],
	"Evil (Active), Fanatical Evil (Active), Immoral":  [73275, 45817, "E-A E-P FE-A FE-P",                                                   ["Evil"],                                          null,        false,     "immoral",  "Immoral"]
};

// The short codes of the table above, spelled out.
const ALIGNMENT_CODES = {
	"FG-A": "Fanatical Good (Active)", "FG-P": "Fanatical Good (Passive)", "G-A": "Good (Active)", "G-P": "Good (Passive)",
	"NG-A": "Neutral Good (Active)", "NG-P": "Neutral Good (Passive)", "N-A": "Neutral (Active)", "TN": "True Neutral",
	"N-P": "Neutral (Passive)", "NE-A": "Neutral Evil (Active)", "NE-P": "Neutral Evil (Passive)", "E-A": "Evil (Active)",
	"E-P": "Evil (Passive)", "FE-A": "Fanatical Evil (Active)", "FE-P": "Fanatical Evil (Passive)"
};

// His Special line for the one requirement that has one (tmp_align_special, 73128). Every other
// requirement sets it to "None".
const ALIGNMENT_SPECIAL = {
	"Any (but must match one part of the Patron's)": "One part of the Alignment (Good, Evil, Neutral, Active, Passive, or Fanatical) must match the character's sorcery patron. Ask the GM to supply this."
};

// The table laid out as the rest of the system reads it:
//     requirement -> { alignments, moral, activity, fanatical, tendencyList, defaultTendency, special, caseLine, htmlLine }
// alignments ends with Insane, as every one of his lists does.
export const ALIGNMENT_REQUIREMENT_LISTS = {};
for (const [tmpRequirement, tmpRow] of Object.entries(ALIGNMENT_REQUIREMENT_TABLE)) {
	var tmpAlignments = tmpRow[2].split(" ").map(tmpCode => ALIGNMENT_CODES[tmpCode]);
	tmpAlignments.push(ALIGNMENT_INSANE);
	ALIGNMENT_REQUIREMENT_LISTS[tmpRequirement] = {
		alignments:      tmpAlignments,
		moral:           tmpRow[3],
		activity:        tmpRow[4],
		fanatical:       tmpRow[5],
		tendencyList:    tmpRow[6],
		// His HTML preselects Order and Immoral (45786, 45810, 45829), but setAlignmentSelection clears
		// the value (73086, 73262, 73270, 73278), so his final tendency comes out "None" unless the
		// player touches the select. The default is kept here and pre-set -- his slip, not ported.
		defaultTendency: tmpRow[7],
		special:         ALIGNMENT_SPECIAL[tmpRequirement] ?? "",
		caseLine:        tmpRow[0],
		htmlLine:        tmpRow[1]
	};
}


// @MARKER CUSTOM ALIGNMENTS
// The world setting imagine-rpg.customAlignments, as the Alignments & Tendencies window saves it:
//     { alignments: [{ name, readsAs, activity, fanatical }], tendencies: [{ name, list }] }
//     readsAs    Good / Neutral / Evil / None -- which of his moral words the rules read it as
//     activity   Active / Passive / True
//     fanatical  true or false
//     list       any / order / immoral -- which of his tendency lists it joins. An order or immoral
//                tendency joins the full list too, since the full list holds every order and
//                immoral tendency of his.
// Nothing in his sheet, the books or the errata adds alignments; this is the port's, for tables
// that play the Legends p.23 forms or their own.
export const CUSTOM_READS_AS = ["Good", "Neutral", "Evil", "None"];
export const CUSTOM_ACTIVITY = ["Active", "Passive", "True"];
export const CUSTOM_TENDENCY_LISTS = ["any", "order", "immoral"];

// The words the readers look for. Case matters: they use includes().
const MORAL_WORDS = ["Good", "Neutral", "Evil"];

// This is the function which tidies a stored setting into the shape above, so a missing or
// half-written value never throws. Rows without a name are dropped.
export function normalizeCustomAlignments(tmpCustom) {
	var tmpResult = { alignments: [], tendencies: [] };
	if (!tmpCustom || typeof tmpCustom != "object") { return tmpResult; }
	for (const tmpRow of (Array.isArray(tmpCustom.alignments) ? tmpCustom.alignments : [])) {
		var tmpName = ("" + (tmpRow?.name ?? "")).trim();
		if (tmpName == "") { continue; }
		tmpResult.alignments.push({
			name:      tmpName,
			readsAs:   CUSTOM_READS_AS.includes(tmpRow.readsAs) ? tmpRow.readsAs : "None",
			activity:  CUSTOM_ACTIVITY.includes(tmpRow.activity) ? tmpRow.activity : "Active",
			fanatical: tmpRow.fanatical === true || tmpRow.fanatical === "true" || tmpRow.fanatical === "on"
		});
	}
	for (const tmpRow of (Array.isArray(tmpCustom.tendencies) ? tmpCustom.tendencies : [])) {
		var tmpName = ("" + (tmpRow?.name ?? "")).trim();
		if (tmpName == "") { continue; }
		tmpResult.tendencies.push({
			name: tmpName,
			list: CUSTOM_TENDENCY_LISTS.includes(tmpRow.list) ? tmpRow.list : "any"
		});
	}
	return tmpResult;
}

// This is the function which checks one custom alignment: its name must say what its axes say, in
// the words the readers look for, so that every reader treats it as its axes declare --
//     readsAs Good/Neutral/Evil   the name contains that word, and neither of the other two
//     readsAs None                the name contains none of Good, Neutral, Evil
//     activity Active             the name contains "Active"; otherwise it must not
//     fanatical                   the name contains "Fanatical" exactly when it is fanatical
// and it must not contain "Non-" (getBlessingModifier reads "Non-Evil" as not evil, while
// isAlignmentBarred reads it as evil), nor be one of his own, "N/A", "None", or a repeat.
// Returns a list of plain-English problems; empty means it is fine.
export function validateCustomAlignment(tmpEntry, tmpOthers) {
	var tmpErrors = [];
	var tmpName = ("" + (tmpEntry?.name ?? "")).trim();
	if (tmpName == "") { return ["A custom alignment needs a name."]; }
	var tmpReadsAs = tmpEntry.readsAs;
	var tmpActivity = tmpEntry.activity;
	var tmpFanatical = tmpEntry.fanatical === true;

	if (!CUSTOM_READS_AS.includes(tmpReadsAs)) { tmpErrors.push(`"${tmpName}": choose whether it reads as Good, Neutral, Evil or None.`); }
	if (!CUSTOM_ACTIVITY.includes(tmpActivity)) { tmpErrors.push(`"${tmpName}": choose Active, Passive or True.`); }
	if (ALIGNMENT_LIST.includes(tmpName) || tmpName == ALIGNMENT_NOT_APPLICABLE || tmpName == ALIGNMENT_NONE) {
		tmpErrors.push(`"${tmpName}" is already one of the standard alignments.`);
	}
	if ((tmpOthers ?? []).some(tmpOther => tmpOther !== tmpEntry && ("" + (tmpOther?.name ?? "")).trim() == tmpName)) {
		tmpErrors.push(`"${tmpName}" is listed twice.`);
	}
	if (tmpName.includes("Non-")) {
		tmpErrors.push(`"${tmpName}": the name cannot contain "Non-"; the rules read "Non-Evil" as evil in some places and not in others.`);
	}
	for (const tmpWord of MORAL_WORDS) {
		var tmpHas = tmpName.includes(tmpWord);
		if (tmpWord == tmpReadsAs && !tmpHas) {
			tmpErrors.push(`"${tmpName}" reads as ${tmpReadsAs}, so its name must contain the word "${tmpWord}" -- that is what the rules look for.`);
		}
		if (tmpWord != tmpReadsAs && tmpHas) {
			tmpErrors.push(`"${tmpName}" contains "${tmpWord}", so the rules would read it as ${tmpWord}; it is set to read as ${tmpReadsAs}.`);
		}
	}
	if (tmpActivity == "Active" && !tmpName.includes("Active")) {
		tmpErrors.push(`"${tmpName}" is Active, so its name must contain the word "Active".`);
	}
	if (tmpActivity != "Active" && tmpName.includes("Active")) {
		tmpErrors.push(`"${tmpName}" contains "Active" but is set to ${tmpActivity}; the rules would read it as Active.`);
	}
	if (tmpFanatical && !tmpName.includes("Fanatical")) {
		tmpErrors.push(`"${tmpName}" is Fanatical, so its name must contain the word "Fanatical".`);
	}
	if (!tmpFanatical && tmpName.includes("Fanatical")) {
		tmpErrors.push(`"${tmpName}" contains "Fanatical" but is not set as fanatical; the rules would read it as Fanatical.`);
	}
	return tmpErrors;
}

// This is the function which checks the whole setting before it is saved: every custom alignment
// by the rules above, and every custom tendency for a name, a list, and no repeat of his or another.
// Returns a list of plain-English problems; empty means it can be saved.
export function validateCustomAlignments(tmpCustom) {
	var tmpErrors = [];
	var tmpAlignments = Array.isArray(tmpCustom?.alignments) ? tmpCustom.alignments : [];
	var tmpTendencies = Array.isArray(tmpCustom?.tendencies) ? tmpCustom.tendencies : [];
	for (const tmpEntry of tmpAlignments) {
		tmpErrors.push(...validateCustomAlignment(tmpEntry, tmpAlignments));
	}
	for (const tmpEntry of tmpTendencies) {
		var tmpName = ("" + (tmpEntry?.name ?? "")).trim();
		if (tmpName == "") { tmpErrors.push("A custom tendency needs a name."); continue; }
		if (!CUSTOM_TENDENCY_LISTS.includes(tmpEntry.list)) { tmpErrors.push(`"${tmpName}": choose which tendency list it joins.`); }
		if (TENDENCY_LIST.includes(tmpName) || tmpName == ALIGNMENT_NOT_APPLICABLE || tmpName == ALIGNMENT_NONE) {
			tmpErrors.push(`"${tmpName}" is already one of the standard tendencies.`);
		}
		if (tmpTendencies.some(tmpOther => tmpOther !== tmpEntry && ("" + (tmpOther?.name ?? "")).trim() == tmpName)) {
			tmpErrors.push(`"${tmpName}" is listed twice.`);
		}
	}
	// One message per problem, however many rows share it.
	return [...new Set(tmpErrors)];
}


// @MARKER AXES
// This is the function which gives an alignment's axes: his fifteen and Insane from ALIGNMENT_AXES,
// a custom one from its declared axes (readsAs maps onto the moral axis as the same word). Anything
// else is undefined.
export function getAlignmentAxes(tmpAlignment, tmpCustom) {
	var tmpName = "" + (tmpAlignment ?? "");
	if (ALIGNMENT_AXES[tmpName]) { return ALIGNMENT_AXES[tmpName]; }
	var tmpEntry = normalizeCustomAlignments(tmpCustom).alignments.find(tmpRow => tmpRow.name == tmpName);
	if (!tmpEntry) { return undefined; }
	return { moral: tmpEntry.readsAs, activity: tmpEntry.activity, fanatical: tmpEntry.fanatical };
}

// This is the function which says whether a set of axes passes one requirement row's rule.
export function isAxesAllowed(tmpRow, tmpAxes) {
	if (!tmpRow || !tmpAxes) { return false; }
	if (tmpRow.moral && !tmpRow.moral.includes(tmpAxes.moral)) { return false; }
	if (tmpRow.activity && !tmpRow.activity.includes(tmpAxes.activity)) { return false; }
	if (tmpRow.fanatical && !tmpAxes.fanatical) { return false; }
	return true;
}


// @MARKER OPTIONS
// This is the function which finds a requirement's row. A requirement none of his cases know is not
// dropped: his unreachable default (73283-73289, no "default:" label, so an unknown string left the
// previous block showing) is replaced by the full list with unknown set, for the window to warn on.
// A blank requirement -- no class yet -- is the full list, not unknown.
export function getAlignmentRequirement(tmpRequirement) {
	var tmpKey = ("" + (tmpRequirement ?? "")).trim();
	if (ALIGNMENT_REQUIREMENT_LISTS[tmpKey]) { return { key: tmpKey, unknown: false, row: ALIGNMENT_REQUIREMENT_LISTS[tmpKey] }; }
	return { key: tmpKey, unknown: tmpKey != "", row: ALIGNMENT_REQUIREMENT_LISTS["Any"] };
}

// This is the function which gives everything a window needs to draw a class's alignment choice:
//     { alignments, tendencies, defaultTendency, special, unknown }
// alignments is his list for the requirement with every custom alignment whose axes pass the row's
// rule slotted in before Insane; tendencies is his list with the custom tendencies that join it.
export function getAlignmentChoices(tmpRequirement, tmpCustom) {
	var tmpFound = getAlignmentRequirement(tmpRequirement);
	var tmpRow = tmpFound.row;
	var tmpNormal = normalizeCustomAlignments(tmpCustom);

	var tmpAlignments = tmpRow.alignments.filter(tmpName => tmpName != ALIGNMENT_INSANE);
	for (const tmpEntry of tmpNormal.alignments) {
		if (tmpAlignments.includes(tmpEntry.name)) { continue; }
		if (isAxesAllowed(tmpRow, { moral: tmpEntry.readsAs, activity: tmpEntry.activity, fanatical: tmpEntry.fanatical })) {
			tmpAlignments.push(tmpEntry.name);
		}
	}
	tmpAlignments.push(ALIGNMENT_INSANE);

	var tmpTendencies = [...TENDENCY_LISTS[tmpRow.tendencyList]];
	for (const tmpEntry of tmpNormal.tendencies) {
		if (tmpTendencies.includes(tmpEntry.name)) { continue; }
		if (tmpRow.tendencyList == "any" || tmpEntry.list == tmpRow.tendencyList) { tmpTendencies.push(tmpEntry.name); }
	}

	return {
		alignments:      tmpAlignments,
		tendencies:      tmpTendencies,
		defaultTendency: tmpRow.defaultTendency,
		special:         tmpRow.special,
		unknown:         tmpFound.unknown
	};
}

// This is the function which gives just the alignments a requirement allows.
export function getAlignmentOptions(tmpRequirement, tmpCustom) {
	return getAlignmentChoices(tmpRequirement, tmpCustom).alignments;
}

// This is the function which gives just the tendencies a requirement allows.
export function getTendencyOptions(tmpRequirement, tmpCustom) {
	return getAlignmentChoices(tmpRequirement, tmpCustom).tendencies;
}

// This is the function which says whether an alignment is in a requirement's list.
export function isAlignmentAllowed(tmpRequirement, tmpAlignment, tmpCustom) {
	return getAlignmentOptions(tmpRequirement, tmpCustom).includes("" + (tmpAlignment ?? ""));
}

// This is the function which says whether a tendency is in a requirement's list.
export function isTendencyAllowed(tmpRequirement, tmpTendency, tmpCustom) {
	return getTendencyOptions(tmpRequirement, tmpCustom).includes("" + (tmpTendency ?? ""));
}


// @MARKER DUAL CLASS
// This is the function which gives the choice for a character of more than one class: only what
// every class allows. No book rule exists (PG Dual Class, players-guide 8265+, is silent); the
// intersection is the port's call (user's ruling 2026-09-26), and empty is reported for the window
// to warn on. The default tendency is the first class's that survives, else the first left when
// the list was narrowed, else none.
//     { alignments, tendencies, defaultTendency, special, unknown, empty }
export function getAlignmentChoicesForClasses(tmpRequirements, tmpCustom) {
	var tmpList = (tmpRequirements ?? []).filter(tmpReq => tmpReq !== undefined && tmpReq !== null);
	if (tmpList.length == 0) { tmpList = [""]; }
	var tmpEach = tmpList.map(tmpReq => getAlignmentChoices(tmpReq, tmpCustom));

	var tmpAlignments = tmpEach[0].alignments.filter(tmpName => tmpEach.every(tmpOne => tmpOne.alignments.includes(tmpName)));
	// Tendencies in the order of the narrowest list, so an Order class's list reads as his does.
	var tmpNarrowest = tmpEach.reduce((tmpBest, tmpOne) => tmpOne.tendencies.length < tmpBest.tendencies.length ? tmpOne : tmpBest);
	var tmpTendencies = tmpNarrowest.tendencies.filter(tmpName => tmpEach.every(tmpOne => tmpOne.tendencies.includes(tmpName)));

	var tmpDefault = "";
	var tmpNarrowed = tmpEach.some(tmpOne => tmpOne.defaultTendency != "");
	for (const tmpOne of tmpEach) {
		if (tmpOne.defaultTendency != "" && tmpTendencies.includes(tmpOne.defaultTendency)) { tmpDefault = tmpOne.defaultTendency; break; }
	}
	if (tmpDefault == "" && tmpNarrowed && tmpTendencies.length > 0) { tmpDefault = tmpTendencies[0]; }

	return {
		alignments:      tmpAlignments,
		tendencies:      tmpTendencies,
		defaultTendency: tmpDefault,
		special:         tmpEach.map(tmpOne => tmpOne.special).filter(tmpText => tmpText).join(" "),
		unknown:         tmpEach.some(tmpOne => tmpOne.unknown),
		// Insane is in every list, so an intersection holding only Insane is as good as empty.
		empty:           tmpAlignments.filter(tmpName => tmpName != ALIGNMENT_INSANE).length == 0 || tmpTendencies.length == 0
	};
}


// @MARKER DESCRIPTIONS
// His description of each alignment, getAlignmentDescription (73303-73359), shown under the
// dropdown as selected_align_descrip. His backtick apostrophes (Roll20 escaping) are plain here.
export const ALIGNMENT_DESCRIPTIONS = {
	// alignment                description
	"Fanatical Good (Active)":  "These characters believe in a philosophy of the 'greater good'. This philosophy states that good must triumph, no matter what the cost. As long as the goals of the righteous path are achieved then nothing else matters. These characters approach their goals with a single-minded fervor, especially concerning ideals of justice and matters of law. Those weaker should be protected, and the right to free choice can be taken away if the character deems that a being is incapable of making the right choices. Those not of the same ideals can be tolerated, but only to a certain degree. These characters will always keep their word.",
	"Fanatical Good (Passive)": "Passive fanatical good characters are not interested in forcing their belief systems upon others. They offer to teach the way when asked, but are generally more aloof and withdrawn about their belief system. These characters like to form close-knit communities of their brethren who feel similarly. Fanatical good characters have highly ethical and structured belief systems. They have an unfailing sense of duty to others and of mercy and justice. Passive fanatical good characters offer mercy to their enemies and believe that all life is sacred; that it can be salvaged for the purposes of good. They kill only as a last resort.",
	"Good (Active)":            "These characters are good people who have a sense of duty to their society. They often serve as politicians or leaders. They demand fair treatment for all. Active good characters often feel strongly about justice being served in their world and act upon their feelings. They often adventure with others to end suffering. These characters do not shirk battle as long as it is with purpose. They offer their enemies fair treatment, but will resort to unorthodox measures to obtain the desired outcome.",
	"Good (Passive)":           "These passive characters are somewhat quiet about their beliefs. They serve as seers, healers, teachers, counselors. etc. They often help in ways that are not high profile. These people are confident and patient. They despise suffering and the pain that people are forced to endure and will intervene on behalf of the needy. They do not attempt to pull others into their beliefs. To serve the purposes of good is sufficient. That they can make a small difference is what counts.",
	"Neutral Good (Active)":    "These are generally well-meaning people who have normal faults. They avoid killing whenever possible because they find it distasteful. They have a law-abiding nature and try to do right; however, violent and selfish acts are not beyond their scope. When they do commit an illegal act, they tend to rationalize their behavior or misconduct as acceptable. Their intentions are not to hurt others, but if it happens, they are sorry. They may surface as leaders in their communities and will occasionally rise to face a threat.",
	"Neutral Good (Passive)":   "Passive neutral good characters are less likely to lead others. They prefer to hang around the edges of society. They accept law and morality, but will avoid confrontation with evil and manage to justify their behavior as reasonable under the circumstances. They do not want to upset the order in their world. They are often craft-persons, innkeepers, etc. They do not spend a lot of time involved in moral issues. They do not kill without provocation.",
	"Neutral (Active)":         "Nearly sociopaths, these characters care little about the feelings of others. They suffer from an inability to see the world from any perspective other than their own. Active neutral characters are often thieves or bandits. They do not specifically enjoy violence or killing; however, they will engage in any behavior that serves their purposes. These characters are unpredictable and generally immoral. They do not have any structured set of values other than self-preservation. Although they can be charming and seem dedicated to purposes set by others, this is a sham. These characters rarely ever adventure for moral reasons; rather they join adventures in search of personal gain or revenge.",
	"True Neutral":             "A difficult alignment to maintain. The true neutral being is active or passive in different situations. They remain completely unwavering between evil and good. They also cannot be characterized as overly moral or immoral, ordered or chaotic. True neutral characters seek to maintain a balance amongst all forces. Few beings who are not of supernatural origin can retain this level of neutrality for long. These beings are often mistaken for another alignment.",
	"Neutral (Passive)":        "These characters have an unusual set of values. They tend to see things in what others call convenient terms. Passive neutral characters avoid confrontations, but are not averse to killing as long as they can justify the reason. These characters are often Seers, Druids or hermits. They may also see life as a balance between forces. Good protects the weak which should be left to perish that the strong may propagate, while evil is a force that takes pleasure in sadism and destruction. These people believe that the world is a 'gray' zone where right and wrong are not clear. They may avoid any actions that would tip the scales in favor of one force or another. They adventure for their own reasons, which may or may not be in line with a party's goals.",
	"Neutral Evil (Active)":    "Exceedingly dangerous, these people serve their own ends to the detriment of others. They prey upon the weak and gullible. They tend to be con-artists, charlatans or thugs. Actively neutral evil characters experience no remorse or guilt for actions that harm others. They have disdain for law and order and may flaunt their ability to circumvent it. After joining a party, they may steal from its members and then leave. These characters do not enjoy pain or causing it, but they do not avoid murder. These are extremely vengeful people. They respect only strength and power.",
	"Neutral Evil (Passive)":   "These characters are petty people who have no care for the pain they may cause others. They are vicious when crossed but do not openly mock the laws of their society. They may be thrifty and covetous of the possessions of others. They avoid open confrontation but enjoy stealing. As long as they can get away with it, these people will kill, without remorse, anyone who disrupts their plans. They are spouse abusers, jailers and drunkards.",
	"Evil (Active)":            "These characters feel that 'might is right' and will kill anyone who gets in their way. They enjoy inflicting pain and suffering upon others. They would sooner twist a sword in a wound as kill quickly. They are exceedingly ruthless and vengeful. These characters will murder for hire and take pride in their work, sometimes keeping trophies from their victims. They adventure often to seek personal fortune and will attempt to dominate other characters into subservience through threat, blackmail, extortion or torture. They are often Dark Knights, Assassins and Dark Priests.",
	"Evil (Passive)":           "These characters feel that the weak should be exterminated but won't go out of their way to do it. The weak are like animals to be harnessed for the needs of these people. They keep slaves and body servants. Their tastes run into sadism and they may enjoy perverse pleasures such as torture or self-mutilation. These beings may offer themselves to supernatural forces as hosts if the pay-off suits them. They hoard money and magic and are obsessive about their possessions.",
	"Fanatical Evil (Active)":  "This is the farthest end of the spectrum for maniacal, homicidal and self-indulgent behavior. Characters of this alignment have an almost religious approach to inflicting pain and suffering upon all others. They do not have the ability to experience love or joy as others know it. Their ultimate expression of self is in destruction. The player who plays the actively fanatical evil character will attempt to dominate an entire adventure and twist it towards their will.",
	"Fanatical Evil (Passive)": "These characters lie like cancerous cells within a society. They prefer to send servants and minions out to do their bidding while they pull strings at the fringes of society to cause the downfall of empires. Under false guises of help they twist the intentions of others toward evil goals. They revel in the grief that they can cause. These characters are exceptionally cruel. Passively fanatical evil beings have disdain for all others. They have their own, very personal and twisted goals. They have no ability to feel guilt.",
	"Insane":                   "These characters have some form of permanent psychosis which makes choosing an Alignment impossible as they are driven by the Insanity and not a moral code or outlook. GM approval required.",
};

// His description of each tendency, getTendencyDescription (73361-73393). The three Immoral texts
// read "tum a chaotic situation" in his sheet (73380, 73383, 73386), an OCR slip for "turn" (PG
// p.41, players-guide-fulltext.txt); corrected here.
export const TENDENCY_DESCRIPTIONS = {
	// tendency                 description
	"Moral":                    "These beings tend to follow a rational code. They see the code as a way to fit into their society whether the society is an order of knights or a town of thugs. Moral beings will have reasons why they make decisions. They tend to rationalize more than to feel their way through a choice.",
	"Moral/Order":              "These beings tend to follow a rational code. They see the code as a way to fit into their society whether the society is an order of knights or a town of thugs. Moral beings will have reasons why they make decisions. They tend to rationalize more than to feel their way through a choice. These beings tend to enjoy order in their lives and in society around them. They are very stable. They form lasting relationships and are easily understood by others. They are often considered to be joiners. In new situations they find their place before acting. ",
	"Moral/Chaos":              "These beings tend to follow a rational code. They see the code as a way to fit into their society whether the society is an order of knights or a town of thugs. Moral beings will have reasons why they make decisions. They tend to rationalize more than to feel their way through a choice. These entities feel their way through most situations. They are spontaneous and are often labeled flaky or unreliable. They live for the moment and see the world as a jumble of experiences and activities with themselves at the center.",
	"Order":                    "These beings tend to enjoy order in their lives and in society around them. They are very stable. They form lasting relationships and are easily understood by others. They are often considered to be joiners. In new situations they find their place before acting.",
	"Immoral":                  "These beings tend to use the system against itself. They can turn a chaotic situation or an intricate plan to their own favor and do so for their own gain. They do not consider the emotions of others as important as their own. They do not feel a need to explain their actions unless this will benefit them.",
	"Immoral/Order":            "These beings tend to use the system against itself. They can turn a chaotic situation or an intricate plan to their own favor and do so for their own gain. They do not consider the emotions of others as important as their own. They do not feel a need to explain their actions unless this will benefit them. These beings tend to enjoy order in their lives and in society around them. They are very stable. They form lasting relationships and are easily understood by others. They are often considered to be joiners. In new situations they find their place before acting.",
	"Immoral/Chaos":            "These beings tend to use the system against itself. They can turn a chaotic situation or an intricate plan to their own favor and do so for their own gain. They do not consider the emotions of others as important as their own. They do not feel a need to explain their actions unless this will benefit them. These entities feel their way through most situations. They are spontaneous and are often labeled flaky or unreliable. They live for the moment and see the world as a jumble of experiences and activities with themselves at the center.",
	"Chaos":                    "These entities feel their way through most situations. They are spontaneous and are often labeled flaky or unreliable. They live for the moment and see the world as a jumble of experiences and activities with themselves at the center.",
};

// This is the function which gives an alignment's description; a custom one has none of his, so
// it is described by its axes.
export function getAlignmentDescription(tmpAlignment, tmpCustom) {
	var tmpName = "" + (tmpAlignment ?? "");
	if (ALIGNMENT_DESCRIPTIONS[tmpName]) { return ALIGNMENT_DESCRIPTIONS[tmpName]; }
	var tmpEntry = normalizeCustomAlignments(tmpCustom).alignments.find(tmpRow => tmpRow.name == tmpName);
	if (!tmpEntry) { return ""; }
	var tmpReads = tmpEntry.readsAs == "None" ? "unaligned" : tmpEntry.readsAs;
	return `A custom alignment of this campaign. The rules treat it as ${tmpEntry.fanatical ? "Fanatical " : ""}${tmpReads}, ${tmpEntry.activity}.`;
}

// This is the function which gives a tendency's description; a custom one has none.
export function getTendencyDescription(tmpTendency) {
	return TENDENCY_DESCRIPTIONS["" + (tmpTendency ?? "")] ?? "";
}

// @MARKER SELECT OPTIONS
// This is the function which lays a list out as a dropdown's options, { value, label, selected }, the
// shape every select of the port walks. A stored value that is not on the list -- an alignment typed
// before the dropdown existed, one his other class allowed, a custom one since deleted -- is KEPT at the
// top as "(current)" rather than silently changed to the first option on the next save: the same call
// colourChoices makes for a typed colour (chargen-view.mjs). tmpBlankLabel, when given, adds a blank
// option first, as every one of his selects starts with one (HTML 45293-45833).
export function buildAlignmentSelectOptions(tmpList, tmpCurrent, tmpBlankLabel) {
	var tmpValue = "" + (tmpCurrent ?? "");
	var tmpOptions = [];
	if (tmpBlankLabel !== undefined && tmpBlankLabel !== null) {
		tmpOptions.push({ value: "", label: tmpBlankLabel, selected: tmpValue == "" });
	}
	for (const tmpName of tmpList ?? []) {
		if (tmpName == "" && tmpOptions.length) { continue; }
		tmpOptions.push({ value: tmpName, label: tmpName, selected: tmpName == tmpValue });
	}
	if (tmpValue != "" && !tmpOptions.some(tmpOption => tmpOption.value == tmpValue)) {
		tmpOptions.unshift({ value: tmpValue, label: tmpValue + " (current)", selected: true });
	}
	return tmpOptions;
}

// @MARKER ANY MEANS ANY
// Bug report 0.22:1 (Blocker, 2026-10-04): a Mage -- "(Any)" -- showed "Neutral Good is not an
// alignment the class allows (Any)", and a Gray Witch "(Any Neutral)" the same. Two causes, both
// from characters made before the alignment lists (0.21.0) stored a plain word:
//   - the plain word ("Neutral Good", "Good", "Evil") is not one of his fifteen, which each carry
//     Active or Passive; a plain word is allowed when ANY of its Active/Passive forms is.
//   - a class that allows every one of his fifteen ("Any") has nothing to object to whatever is
//     stored, a custom alignment or free text included; likewise a class whose tendency list is all
//     eight.
const ALIGNMENT_PLAIN_FORMS = {
	// plain word            the forms of his that it stands for
	"Fanatical Good":        ["Fanatical Good (Active)", "Fanatical Good (Passive)"],
	"Good":                  ["Good (Active)", "Good (Passive)"],
	"Neutral Good":          ["Neutral Good (Active)", "Neutral Good (Passive)"],
	"Neutral":               ["Neutral (Active)", "True Neutral", "Neutral (Passive)"],
	"Neutral Evil":          ["Neutral Evil (Active)", "Neutral Evil (Passive)"],
	"Evil":                  ["Evil (Active)", "Evil (Passive)"],
	"Fanatical Evil":        ["Fanatical Evil (Active)", "Fanatical Evil (Passive)"]
};

// This is the function which says whether a stored alignment passes a class's choices.
export function isAlignmentWithinChoices(tmpChoices, tmpAlignment) {
	var tmpName = ("" + (tmpAlignment ?? "")).trim();
	if (tmpChoices.alignments.includes(tmpName)) { return true; }
	if (ALIGNMENT_LIST.filter(tmpOne => tmpOne != ALIGNMENT_INSANE).every(tmpOne => tmpChoices.alignments.includes(tmpOne))) { return true; }
	return (ALIGNMENT_PLAIN_FORMS[tmpName] ?? []).some(tmpForm => tmpChoices.alignments.includes(tmpForm));
}

// This is the function which says whether a stored tendency passes a class's choices.
export function isTendencyWithinChoices(tmpChoices, tmpTendency) {
	if (tmpChoices.tendencies.includes(("" + (tmpTendency ?? "")).trim())) { return true; }
	return TENDENCY_LIST.every(tmpOne => tmpChoices.tendencies.includes(tmpOne));
}

// This is the function which says what is wrong with a character's alignment and tendency against
// its class or classes -- the sheet's warning, the generator's refusal. Nothing is wrong with:
//     N/A in both      Alignmentless Imagine (his setFinalAlignment, 73409-73412; MM pp.170-171)
//     blank or None    nothing chosen; not the class's to object to
//     no class at all  nothing to be checked against
// A requirement none of his cases know is reported once, since his lists cannot be checked
// against it. Returns a list of sentences, empty when it is all allowed.
export function checkAlignmentForClasses(tmpRequirements, tmpAlignment, tmpTendency, tmpCustom) {
	var tmpIssues = [];
	var tmpList = (tmpRequirements ?? []).filter(tmpReq => tmpReq !== undefined && tmpReq !== null);
	if (tmpList.length == 0) { return tmpIssues; }
	var tmpChoices = getAlignmentChoicesForClasses(tmpList, tmpCustom);
	var tmpAlign = ("" + (tmpAlignment ?? "")).trim();
	var tmpTend = ("" + (tmpTendency ?? "")).trim();
	var tmpSkip = (tmpValue) => tmpValue == "" || tmpValue == ALIGNMENT_NONE || tmpValue == ALIGNMENT_NOT_APPLICABLE;
	var tmpWords = tmpList.map(tmpReq => ("" + tmpReq).trim()).filter(tmpReq => tmpReq != "").join("; ");
	if (tmpChoices.unknown) {
		tmpIssues.push(`The class alignment requirement "${tmpWords}" is not one of his; it cannot be checked.`);
		return tmpIssues;
	}
	// Dual class (F1 ruling): the choices are the classes' intersection, and when that holds nothing
	// (Insane aside, it being in every list) it is said once, whatever is chosen or left blank.
	if (tmpList.length > 1 && tmpChoices.empty) {
		tmpIssues.push(`The classes have no alignment and tendency in common (${tmpWords}).`);
	}
	if (!tmpSkip(tmpAlign) && !isAlignmentWithinChoices(tmpChoices, tmpAlign)) {
		tmpIssues.push(`${tmpAlign} is not an alignment the class allows (${tmpWords}).`);
	}
	if (!tmpSkip(tmpTend) && !isTendencyWithinChoices(tmpChoices, tmpTend)) {
		tmpIssues.push(`${tmpTend} is not a tendency the class allows (${tmpWords}).`);
	}
	return tmpIssues;
}

// @MARKER CREATURE SUGGESTIONS
// This is the function which gives a creature's alignment and tendency suggestions: every alignment
// and tendency of his, the Game Master's custom ones, and his None and N/A. A creature has no class to
// narrow them, and the bestiaries write things no list holds ("Evil (generally passive)", "Any (with
// Order tendency)"), so these are suggestions under a free-text field, never a closed list.
//     { alignments: [...], tendencies: [...] }
export function getCreatureAlignmentSuggestions(tmpCustom) {
	var tmpNormal = normalizeCustomAlignments(tmpCustom);
	var tmpAlignments = ALIGNMENT_LIST.filter(tmpName => tmpName != ALIGNMENT_INSANE);
	for (const tmpEntry of tmpNormal.alignments) { if (!tmpAlignments.includes(tmpEntry.name)) { tmpAlignments.push(tmpEntry.name); } }
	tmpAlignments.push(ALIGNMENT_INSANE, ALIGNMENT_NONE, ALIGNMENT_NOT_APPLICABLE);
	var tmpTendencies = [...TENDENCY_LIST];
	for (const tmpEntry of tmpNormal.tendencies) { if (!tmpTendencies.includes(tmpEntry.name)) { tmpTendencies.push(tmpEntry.name); } }
	tmpTendencies.push(ALIGNMENT_NONE, ALIGNMENT_NOT_APPLICABLE);
	return { alignments: tmpAlignments, tendencies: tmpTendencies };
}

// @MARKER ADD NEW alignment functions HERE
// @END (CODE)
