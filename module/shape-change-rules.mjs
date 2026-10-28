// @START (CODE)
// @MARKER SHAPE CHANGE RULES
//==================================================================================================================
// The four Updater options that change what body a character wears: a Changeling switching form, and a
// Formless possessing a new host, holding on to the one it has, and -- once ejected -- surviving without one.
//
// Ported from his handlers:
//   update_changeling_race       handleUpdateChangelingRace        (sheet-worker.js:127288)
//                                updateChangelingAttributes        (127358)  the per-form STR/AGL/VIT/APP table
//                                updateBodyAndSpecialMovement      (127850)  the body chart and wings
//   update_formless_race         handleUpdateFormlessHost          (128001)
//                                updateFormlessHostType            (128133)  the period a host lasts
//                                updateFormlessAttributes          (128148)  the five physical attributes
//                                setFormlessSpecialControlResistance (128175)
//   update_formless_retention    handleUpdateRetainFormlessHost    (128245)
//                                setFormlessHostless               (128300)
//   update_formless_free_psyche  handleUpdateFormlessFreePsycheCheck (128347)
// and his panels in the sheet's HTML (52712-53110).
//
// HOW THE PORT HOLDS A FORM, which is not how his sheet does. His sheet writes a form's attribute changes
// straight into the stored ratings and takes them back out on the next switch -- two tables, one to add and
// one to remove. Here the form is STORED (identity.changeling.form) and its changes are worked out on every
// prepare, the way a race's modifiers are. So there is one table, not two, and nothing can drift: his remove
// table is the exact negation of his add table for 39 of his 40 forms, and the 40th (Elf(Sea)) adds +1 APP
// on the way out where it should take 1 off, so each round trip through Elf(Sea) left his Changeling 2 APP
// prettier. The add table is the one kept.
//
// A Formless host IS a race item -- the second race beside the psyche (DECISIONS 2026-09-21, "Formless is
// built") -- so possessing a new host swaps that item, and the physical half follows from it exactly as it
// did at creation. Only the five attributes the player sets for the new body are written as ratings.
//
// Nothing here talks to Foundry or rolls a die: the dice arrive as arguments. The writing is
// module/shape-change.mjs.
//==================================================================================================================

	// @MARKER CHANGELING FORMS
	// His select_changeling_race, in his order: the value he stores and the label he shows. "Natural Form" is
	// his first option (Changeling[Natural Form]) and carries no change.
	//
	//      value                         label
	export const CHANGELING_FORMS = [
		[ "Natural Form",               "Changeling[Natural Form]"   ],
		[ "Avian(Dark)",                "Avian(Dark)"                ],
		[ "Avian(Forest)",              "Avian(Forest)"              ],
		[ "Avian(Mountain)",            "Avian(Mountain)"            ],
		[ "Beastman",                   "Beastman(Ram)"              ],
		[ "Cervara",                    "Cervara(Deer,Elk,etc.)"     ],
		[ "Chetahl",                    "Chetahl(Cat)"               ],
		[ "Djinn",                      "Djinn"                      ],
		[ "Dryad",                      "Dryad"                      ],
		[ "Elf(Dark)",                  "Elf(Dark)"                  ],
		[ "Elf(Desert)",                "Elf(Desert)"                ],
		[ "Elf(Dread)",                 "Elf(Dread)"                 ],
		[ "Elf(Gray)",                  "Elf(Gray)"                  ],
		[ "Elf(High)",                  "Elf(High)"                  ],
		[ "Elf(Ice)",                   "Elf(Ice)"                   ],
		[ "Elf(Sea)",                   "Elf(Sea)"                   ],
		[ "Elf(Wild)",                  "Elf(Wild)"                  ],
		[ "Elf(Wood)",                  "Elf(Wood)"                  ],
		[ "Equara",                     "Equara(Horse)"              ],
		[ "Gaunt",                      "Gaunt"                      ],
		[ "Goblin(Forest)",             "Goblin(Forest)"             ],
		[ "Goblin(Plains)",             "Goblin(Plains)"             ],
		[ "Grahl",                      "Grahl(Dog)"                 ],
		[ "Hobgoblin",                  "Hobgoblin"                  ],
		[ "Human(Barbaric)",            "Human(Barbaric)"            ],
		[ "Human(Civilized:City)",      "Human(Civilized:City)"      ],
		[ "Human(Civilized:Port)",      "Human(Civilized:Port)"      ],
		[ "Human(Civilized:Town)",      "Human(Civilized:Town)"      ],
		[ "Human(Civilized:Village)",   "Human(Civilized:Village)"   ],
		[ "Ifrit",                      "Ifrit"                      ],
		[ "Jumara",                     "Jumara(Giraffe)"            ],
		[ "Kenku",                      "Kenku(Hawk)"                ],
		[ "Lissara",                    "Lissara(Newt)"              ],
		[ "Marid",                      "Marid"                      ],
		[ "Merfolk",                    "Merfolk"                    ],
		[ "Nymph",                      "Nymph"                      ],
		[ "Planar",                     "Planar"                     ],
		[ "Satyr/Fawn",                 "Satyr/Fawn(Goat)"           ],
		[ "Sylph",                      "Sylph"                      ],
		[ "Testudara",                  "Testudara(Tortoise)"        ],
		[ "Vulpara",                    "Vulpara(Fox)"               ]
	];

	export const CHANGELING_NATURAL = "Natural Form";

	// His "add modifiers by new race form" switch (sheet-worker.js:127589-127791). A form not listed -- the four
	// Civilized Humans -- changes nothing. Elf(Shadow) and Elf(Silver) are in his switch but not his dropdown, and
	// are kept so the table is his whole table; Fawn and Satyr are his own spare spellings of Satyr/Fawn.
	//
	//      form                     STR   AGL   VIT   APP
	export const CHANGELING_FORM_MODS = {
		"Avian(Dark)":           [ -1,    2,   -2,    0 ],
		"Avian(Forest)":         [ -2,    2,    0,    0 ],
		"Avian(Mountain)":       [ -1,    2,   -2,    0 ],
		"Beastman":              [  1,    1,    0,   -4 ],
		"Cervara":               [ -1,    2,    0,    1 ],
		"Chetahl":               [ -1,    4,    0,    0 ],
		"Djinn":                 [  0,    2,   -2,    1 ],
		"Dryad":                 [ -1,    0,    3,    0 ],
		"Elf(Dark)":             [ -1,    2,   -1,    0 ],
		"Elf(Desert)":           [ -1,    2,   -1,    0 ],
		"Elf(Dread)":            [ -1,    2,   -1,   -1 ],
		"Elf(Gray)":             [ -1,    0,   -2,    0 ],
		"Elf(High)":             [ -1,    2,   -2,    1 ],
		"Elf(Ice)":              [ -1,    1,   -1,    1 ],
		"Elf(Sea)":              [ -1,    2,   -1,    1 ],
		"Elf(Shadow)":           [ -1,    1,   -1,    3 ],
		"Elf(Silver)":           [ -1,    1,   -1,    3 ],
		"Elf(Wild)":             [  0,    3,   -1,    2 ],
		"Elf(Wood)":             [ -1,    2,   -1,    1 ],
		"Equara":                [  2,    1,    2,    0 ],
		"Gaunt":                 [ -1,    2,   -2,   -2 ],
		"Goblin(Forest)":        [  1,    2,    1,   -2 ],
		"Goblin(Plains)":        [  2,    1,    2,   -4 ],
		"Grahl":                 [  2,    1,    3,   -2 ],
		"Hobgoblin":             [  4,    0,    2,   -3 ],
		"Human(Barbaric)":       [  3,    1,    2,    0 ],
		"Ifrit":                 [  0,    2,   -1,    0 ],
		"Jumara":                [ -2,    2,    0,    0 ],
		"Kenku":                 [ -1,    2,   -2,    0 ],
		"Lissara":               [ -2,    2,    0,   -1 ],
		"Marid":                 [  2,    1,   -1,    2 ],
		"Merfolk":               [  0,    2,    1,    2 ],
		"Nymph":                 [ -1,    2,   -1,    2 ],
		"Planar":                [  0,    1,   -2,   -1 ],
		"Fawn":                  [ -1,    2,   -1,    1 ],
		"Satyr":                 [ -1,    2,   -1,    1 ],
		"Satyr/Fawn":            [ -1,    2,   -1,    1 ],
		"Sylph":                 [ -1,    2,   -2,    2 ],
		"Testudara":             [  2,   -2,    0,   -1 ],
		"Vulpara":               [ -1,    2,    0,    2 ]
	};

	// His updateBodyAndSpecialMovement switch (127872-127906): "set special movement type Fly because they have
	// actual wings". Djinn, the Fairies, the Mephyts and Sylph are commented out in his code -- "They do not gain
	// magical abilities like flight" -- and are left out here for the same reason.
	//
	//      body                    special movement
	export const SHAPE_SPECIAL_MOVEMENT = {
		"Apocritara":           "Fly:",
		"Avian(Dark)":          "Fly:",
		"Avian(Forest)":        "Fly:",
		"Avian(Mountain)":      "Fly:",
		"Ba’Cora":              "Fly:",
		"Gryphara":             "Fly:",
		"Kenku":                "Fly:",
		"Sura’keth":            "Fly:",
		"Arachen":              "Scurry:",
		"Brachara":             "Scurry:",
		"Scethen":              "Scurry:",
		"Centaur":              "Gallop:",
		"Katara":               "Gallop:",
		"Se’eth":               "Slither:"
	};

	// The four attributes a form can move, in the table's column order.
	const FORM_ATTRIBUTES = [ "str", "agl", "vit", "app" ];

	// His minimum after a form change (127794-127797): nothing drops below 5.
	export const SHAPE_ATTRIBUTE_MIN = 5;

	// This is the function which says whether a character is a Changeling: his test is the race's name
	// (setChangelingRaceUpdateSheet, 127279, tmpRace.includes("Changeling")).
	export function isChangelingRace(tmpracenames) {
		return (tmpracenames ?? []).some(tmpname => ("" + tmpname).includes("Changeling"));
	}

	// This is the function which gives a form's attribute changes, as { str, agl, vit, app }. A Changeling in
	// the form it was made in has none -- his "if they are in their original borrowed race form there is
	// nothing to modify" (127380) -- and neither has the natural form.
	export function getChangelingFormMods(tmpform, tmporiginal = CHANGELING_NATURAL) {
		var tmpzero = { str: 0, agl: 0, vit: 0, app: 0 };
		var tmpname = "" + (tmpform ?? "");
		if (!tmpname || tmpname == CHANGELING_NATURAL || tmpname == (tmporiginal || CHANGELING_NATURAL)) { return tmpzero; }
		var tmprow = CHANGELING_FORM_MODS[tmpname];
		if (!tmprow) { return tmpzero; }
		var tmpout = {};
		FORM_ATTRIBUTES.forEach((tmpkey, tmpindex) => { tmpout[tmpkey] = tmprow[tmpindex]; });
		return tmpout;
	}

	// This is the function which lays a form's changes onto the attribute values, held where his are held: not
	// below 5, and not above the race's limit (127793-127802). Only an attribute the form moved is held -- a
	// value already below 5 or above its limit for some other reason is not this function's to change.
	//
	//   tmpvalues   { str, agl, vit, app, ... } the values before the form
	//   tmplimits   the race's attributeLimits
	// Returns a new object.
	export function applyChangelingForm(tmpvalues, tmpmods, tmplimits) {
		var tmpout = { ...tmpvalues };
		for (const tmpkey of FORM_ATTRIBUTES) {
			var tmpmod = parseInt(tmpmods?.[tmpkey]) || 0;
			if (!tmpmod) { continue; }
			var tmpnew = (parseInt(tmpout[tmpkey]) || 0) + tmpmod;
			if (tmpmod < 0 && tmpnew < SHAPE_ATTRIBUTE_MIN) { tmpnew = Math.min(SHAPE_ATTRIBUTE_MIN, parseInt(tmpout[tmpkey]) || 0); }
			var tmplimit = parseInt(tmplimits?.[tmpkey]);
			if (tmpmod > 0 && tmplimit > 0 && tmpnew > tmplimit) { tmpnew = Math.max(tmplimit, parseInt(tmpout[tmpkey]) || 0); }
			tmpout[tmpkey] = tmpnew;
		}
		return tmpout;
	}

	// This is the function which checks a Changeling's new height and weight (127323-127332): within a foot and a
	// half of the height it was made with, and between 50 and 300 lb. Both left blank is allowed -- the form is
	// changed and the body left as it was.
	export function checkChangelingSize(tmpnewInches, tmpnewWeight, tmporigInches) {
		var tmpheight = parseInt(tmpnewInches) || 0;
		var tmpweight = parseInt(tmpnewWeight) || 0;
		var tmporig = parseInt(tmporigInches) || 0;
		if (tmpheight == 0 && tmpweight == 0) { return true; }
		if (tmpheight < tmporig - 18 || tmpheight > tmporig + 18) { return false; }
		if (tmpweight < 50 || tmpweight > 300) { return false; }
		return true;
	}

	// This is the function which decides a Changeling's switch of form.
	//
	//   tmpstate = { name, isChangeling, form, originalForm, slight, origHeightInches, currentHeightInches }
	//   tmpinputs = { form, gender, slight, heightFeet, heightInches, weight, frame, hair, bodyCovering, eyes, skin }
	//
	// Returns { ok, message, form, raceName, slightShift, sizeChanged } -- slightShift is +1 when Slight Physique is
	// newly taken (+1 AGL / -1 STR on the ratings, his 127369-127378), -1 when it is given up, else 0.
	export function resolveChangelingSwitch(tmpstate, tmpinputs) {
		var tmps = tmpstate ?? {};
		var tmpi = tmpinputs ?? {};
		var tmpname = tmps.name ?? "";
		if (!tmps.isChangeling) {
			return { ok: false, message: `${tmpname} is ${tmps.raceName ?? "not a Changeling"} and not a Changeling. Cannot change race.` };
		}
		var tmpform = "" + (tmpi.form || CHANGELING_NATURAL);
		if (!CHANGELING_FORMS.some(tmprow => tmprow[0] == tmpform)) {
			return { ok: false, message: `${tmpform} is not a form a Changeling can take.` };
		}
		var tmpnewInches = (parseInt(tmpi.heightFeet) || 0) * 12 + (parseInt(tmpi.heightInches) || 0);
		// The height it was made with is kept from the first switch on, as his orig_height_* are
		// (storeOriginalFeatures, 125303): before that, the height it has now is the original.
		var tmporigInches = parseInt(tmps.origHeightInches) || parseInt(tmps.currentHeightInches) || 0;
		if (!checkChangelingSize(tmpnewInches, tmpi.weight, tmporigInches)) {
			return { ok: false, message: `${tmpname}'s new height and/or weight is out of range for changeling forms. Nothing done.` };
		}
		var tmpoldRace = (tmps.form && tmps.form != CHANGELING_NATURAL) ? `Changeling[${tmps.form}]` : "Changeling[Natural Form]";
		var tmpnewRace = (tmpform == CHANGELING_NATURAL) ? "Changeling[Natural Form]" : `Changeling[${tmpform}]`;
		var tmpshift = 0;
		if (!!tmpi.slight != !!tmps.slight) { tmpshift = tmpi.slight ? 1 : -1; }
		return {
			ok: true,
			message: `${tmpname} is switching Changeling race from ${tmpoldRace} to ${tmpnewRace}`,
			form: tmpform,
			raceName: tmpnewRace,
			slightShift: tmpshift,
			sizeChanged: tmpnewInches > 0,
			origHeightInches: tmporigInches
		};
	}

	// @MARKER FORMLESS HOSTS
	// His select_formless_host_type, and what each sets as the period a possession is counted in
	// (updateFormlessHostType, 128138-128144). Animal Corpse is in his code and commented out of his dropdown,
	// so it is kept here and offered no more than he offers it.
	//
	//      host type              period   offered
	export const FORMLESS_HOST_TYPES = [
		[ "Mindless Husk",       "Week",  true  ],
		[ "Humanoid Corpse",     "Day",   true  ],
		[ "Animal Corpse",       "Hour",  false ]
	];

	// His panel's note: "-5% Control Resistance to possess per full hour dead (not used for mindless husks)",
	// and the race's own Corporeal Possession text ("Humanoid Corpse: -5% Control Resist for each hour it has
	// already been dead"). His handler reads the hours (128010) and never uses them; the note is applied here.
	export const FORMLESS_HOURS_DEAD_PENALTY = 5;

	// What each further period occupied costs the retention roll (128256-128258): 5 per period.
	export const FORMLESS_RETAIN_PENALTY = 5;

	// The five attributes a new host sets outright (updateFormlessAttributes, 128148).
	export const FORMLESS_HOST_ATTRIBUTES = [ "str", "agl", "vit", "app", "soc" ];

	// This is the function which gives the period a host type is counted in.
	export function getFormlessPeriodType(tmphosttype) {
		var tmprow = FORMLESS_HOST_TYPES.find(tmptype => ("" + tmphosttype).includes(tmptype[0]));
		return tmprow ? tmprow[1] : "Hour";
	}

	// This is the function which works out the Formless's special Control Resistance (setFormlessSpecialControl-
	// Resistance, 128175): the Control Resistance it would have if it were not immune to control -- Will Force's,
	// with Intelligence's and Wisdom's adjustments, the race's and the temporary modifier. His class modifiers
	// ("+10% Control Resist", "+5% all Resists") and the +20 of Stubborn are added where the port has them, which
	// is through tmpextra (the class bonus arrives as an Active Effect on resistances.control.misc).
	export function getFormlessControl(tmpcontrol, tmpextra = 0) {
		var tmpc = tmpcontrol ?? {};
		return (parseInt(tmpc.base) || 0) + (parseInt(tmpc.raceMod) || 0) + (parseInt(tmpc.misc) || 0) + (parseInt(tmpextra) || 0);
	}

	// This is the function which checks the possession form is filled in, as his allFormlessFieldsEntered does
	// (128059-128089). Hair, body covering, eyes and skin are only asked for where the host has them -- his
	// "None" names; here, the host race's features lists that are not empty (getHostFeatureNeeds).
	export function checkFormlessHostFields(tmpinputs) {
		var tmpi = tmpinputs ?? {};
		var tmpneeds = tmpi.needs ?? { hair: false, bodyCovering: false, eyes: false, skin: false };
		if (!tmpi.host) { return false; }
		if (!tmpi.hostType) { return false; }
		if (!tmpi.gender) { return false; }
		if (!(parseInt(tmpi.heightFeet) || 0) && !(parseInt(tmpi.heightInches) || 0)) { return false; }
		if (!tmpi.frame) { return false; }
		if ((parseInt(tmpi.weight) || 0) < 1) { return false; }
		for (const tmpkey of [ "hair", "bodyCovering", "eyes", "skin" ]) {
			if (tmpneeds[tmpkey] && !("" + (tmpi[tmpkey] ?? "")).trim()) { return false; }
		}
		return true;
	}

	// This is the function which says which features a host race has to be described: those its race lists any
	// choices for (a Saurian has no hair to colour). His sheet names the missing ones "None" (setRacialFeature-
	// NamesByRace, 127966); the port's races carry the lists themselves.
	export function getHostFeatureNeeds(tmpfeatures) {
		var tmpf = tmpfeatures ?? {};
		var tmphas = (tmpkey) => Array.isArray(tmpf[tmpkey]) && tmpf[tmpkey].length > 0;
		return { hair: tmphas("hair"), bodyCovering: tmphas("bodyCovering"), eyes: tmphas("eyes"), skin: tmphas("skin") };
	}

	// This is the function which holds a new host's attribute between 5 and the host race's limit
	// (updateFormlessAttributes, 128150-128160).
	export function clampHostAttribute(tmpvalue, tmplimit) {
		var tmpv = parseInt(tmpvalue) || 0;
		var tmpmax = parseInt(tmplimit) || 0;
		if (tmpv < SHAPE_ATTRIBUTE_MIN) { tmpv = SHAPE_ATTRIBUTE_MIN; }
		if (tmpmax > 0 && tmpv > tmpmax) { tmpv = tmpmax; }
		return tmpv;
	}

	// This is the function which decides an attempt to possess a new host.
	//
	//   tmproll    the d100
	//   tmpstate = { name, isFormless, control (the special Control Resistance), wil (Will Force) }
	//   tmpinputs  the form (see checkFormlessHostFields), plus hoursDead and attributes { str, agl, vit, app, soc }
	//   tmphost  = { name, attributeLimits, attributeMods, features } the host race, or null
	//
	// Returns { ok, success, message, chance, ratings, state } -- ratings are the STORED ratings to write (the
	// value chosen less the host's racial modifier, which the model adds back), state the new identity.formless.
	export function resolveFormlessPossession(tmproll, tmpstate, tmpinputs, tmphost) {
		var tmps = tmpstate ?? {};
		var tmpi = tmpinputs ?? {};
		var tmpname = tmps.name ?? "";
		if (!tmps.isFormless) {
			return { ok: false, success: false, message: `${tmpname} is ${tmps.raceName ?? ""} and not a Formless. Cannot possess a new host.` };
		}
		if (!tmphost || !checkFormlessHostFields({ ...tmpi, needs: getHostFeatureNeeds(tmphost.features) })) {
			return { ok: false, success: false, message: `${tmpname}'s didn\`t fill all needed Formless attributes and features. Nothing done.` };
		}
		var tmpchance = parseInt(tmps.control) || 0;
		if (!("" + tmpi.hostType).includes("Mindless Husk")) {
			tmpchance -= FORMLESS_HOURS_DEAD_PENALTY * Math.max(0, parseInt(tmpi.hoursDead) || 0);
		}
		var tmptotal = parseInt(tmproll) || 0;
		if (tmptotal > tmpchance) {
			return { ok: true, success: false, chance: tmpchance,
				message: `${tmpname}'s rolled a ${tmptotal}, failing the special Control Resistance of ${tmpchance}% to possess this host and may not try to possess this host again.` };
		}
		var tmpratings = {};
		for (const tmpkey of FORMLESS_HOST_ATTRIBUTES) {
			var tmpvalue = clampHostAttribute(tmpi.attributes?.[tmpkey], tmphost.attributeLimits?.[tmpkey]);
			tmpratings[tmpkey] = Math.max(0, tmpvalue - (parseInt(tmphost.attributeMods?.[tmpkey]) || 0));
		}
		return {
			ok: true, success: true, chance: tmpchance, ratings: tmpratings,
			message: `${tmpname}'s rolled a ${tmptotal}, suceeding the special Control Resistance of ${tmpchance}% to possess the ${tmphost.name}`,
			state: {
				currentHost: tmphost.name,
				hostType: tmpi.hostType,
				periodsOccupied: 0,
				maxPeriods: parseInt(tmps.wil) || 0,
				periodType: getFormlessPeriodType(tmpi.hostType)
			}
		};
	}

	// This is the function which decides the roll to keep a host for another period
	// (handleUpdateRetainFormlessHost, 128245). Run out of periods, or failed, and the psyche is ejected.
	//
	//   tmpstate = { name, hasHost, host, periodsOccupied, maxPeriods, periodType, control }
	// Returns { ok, retained, ejected, message, total, periodsOccupied }.
	export function resolveFormlessRetention(tmproll, tmpstate) {
		var tmps = tmpstate ?? {};
		var tmpname = tmps.name ?? "";
		if (!tmps.isFormless) {
			return { ok: false, message: `${tmpname} is ${tmps.raceName ?? ""} and not a Formless. Is not possessing a host.` };
		}
		if (!tmps.hasHost) {
			return { ok: false, message: `${tmpname} is a Formless with no host to retain.` };
		}
		var tmpperiods = parseInt(tmps.periodsOccupied) || 0;
		var tmpmax = parseInt(tmps.maxPeriods) || 0;
		var tmpcontrol = parseInt(tmps.control) || 0;
		var tmptotal = (parseInt(tmproll) || 0) + (tmpperiods > 0 ? FORMLESS_RETAIN_PENALTY * tmpperiods : 0);
		var tmpejected = `The psyche is ejected and they are now hostless. The psyche has ${tmpmax} hours to find a new host. `
			+ "Each hour after this they must make a Control Resistance to avoid the temporary loss of 1 Will Force and a Will "
			+ "Force save to avoid becoming insane (GM Determines type). If the Formless reaches 0 Will Force it dies and becomes a New Ghost.";
		if (tmpperiods >= tmpmax) {
			return { ok: true, retained: false, ejected: true, total: tmptotal,
				message: `${tmpname}'s has run out of possession periods for this host. ${tmpejected}` };
		}
		if (tmptotal > tmpcontrol) {
			return { ok: true, retained: false, ejected: true, total: tmptotal,
				message: `${tmpname}'s rolled a ${tmptotal}, failing the special Control Resistance of ${tmpcontrol}% to retain the ${tmps.host} host. ${tmpejected}` };
		}
		return { ok: true, retained: true, ejected: false, total: tmptotal, periodsOccupied: tmpperiods + 1,
			message: `${tmpname}'s rolled a ${tmptotal}, suceeding the special Control Resistance of ${tmpcontrol}% to retain the ${tmps.host} host for another period.` };
	}

	// This is the function which decides the hourly check of a free psyche (handleUpdateFormlessFreePsycheCheck,
	// 128347): a special Control Resistance, and if that fails, 1 Will Force lost and a Will Force save against
	// insanity. At 0 Will Force it is dead, a New Ghost.
	//
	//   tmpstate = { name, isFormless, hasHost, will (the free psyche's Will Force), control, wilSave }
	// Returns { ok, will, dead, insane, message }.
	export function resolveFreePsyche(tmproll, tmpsaveroll, tmpstate) {
		var tmps = tmpstate ?? {};
		var tmpname = tmps.name ?? "";
		if (!tmps.isFormless) {
			return { ok: false, message: `${tmpname} is ${tmps.raceName ?? ""} and not a Formless. No free psyche to check.` };
		}
		if (tmps.hasHost) {
			return { ok: false, message: `${tmpname} is a Formless but has a current host. No free psyche to check.` };
		}
		var tmptotal = parseInt(tmproll) || 0;
		var tmpcontrol = parseInt(tmps.control) || 0;
		var tmpwill = parseInt(tmps.will) || 0;
		if (tmptotal <= tmpcontrol) {
			return { ok: true, will: tmpwill, dead: false, insane: false,
				message: `${tmpname}'s rolled a ${tmptotal}, succeeding the special Control Resistance of ${tmpcontrol}% to avoid Will Force loss and possible insanity.` };
		}
		// His test is "== 1" (128361), so a psyche already at 0 would run on into negative Will Force; at or
		// below 1 it is dead here.
		if (tmpwill <= 1) {
			return { ok: true, will: 0, dead: true, insane: false,
				message: `${tmpname}'s rolled a ${tmptotal}, failing the special Control Resistance of ${tmpcontrol}%. Will Force is reaches 0. ${tmpname} has died, becoming a New Ghost.` };
		}
		var tmpsave = parseInt(tmpsaveroll) || 0;
		var tmpwilSave = parseInt(tmps.wilSave) || 0;
		var tmpinsane = tmpsave > tmpwilSave;
		return { ok: true, will: tmpwill - 1, dead: false, insane: tmpinsane,
			message: `${tmpname}'s rolled a ${tmptotal}, failing the special Control Resistance of ${tmpcontrol}% Will Force reduces by 1. `
				+ `Will Save of ${tmpsave} rolled against a chance of ${tmpwilSave}%. `
				+ (tmpinsane ? `Failure ${tmpname} is inflicted with insanity (GM determines).` : "Success insanity is avoided.") };
	}

	// This is the function which gives the special movement a body brings, or "" (his default).
	export function getShapeSpecialMovement(tmprace) {
		return SHAPE_SPECIAL_MOVEMENT[tmprace] ?? "";
	}
// @END (CODE)
