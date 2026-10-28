// @START (CODE)
// @MARKER TEMPORARY MODIFIERS RULES
//==================================================================================================================
// The Temporary Modifiers panel: his "Add/Remove Temporary Modifiers" (update_temp_modifiers, Roll20 sheet
// HTML 56640-57226, handlers sheet-worker.js:123051-125290). Nothing here talks to Foundry or rolls a die.
// The window (module/apps/temp-modifiers.mjs) reads its boxes, calls resolveSetUpdate / resolveClearUpdate
// here, and writes what comes back to the actor in one update.
//
// WHERE EACH MODIFIER LIVES. His sheet kept a separate "tmp_*" value for every row and added it into the final
// number; the port already has a slot for most of them, so those are used rather than doubled:
//
//     his row                          the port's field                         read by
//     attribute, mundane               attributes.<k>.tempMod                   prepareBaseData
//     attribute, magic                 tempMods.magicAttr.<k>        (new)      _prepareAttributes
//     Endurance .. Fortune             characteristics.<k>.tempMod              _setCharacteristic
//     resistance modifier / immunity   resistances.<k>.misc / .immune           _setResistance
//     melee/missile/damage/defensive/
//       initiative/skills              combat.<x>Misc                           attacks, initiative, skills
//     pain threshold, speed seconds,
//       force/spirit/outer kinetic,
//       damage absorption              combat.painThreshold ... damageAbsorb    the damage code
//     hide                             body.hide                                the damage code
//     everything else                  tempMods.* (new)                         see actor-character.mjs
//
// HIS SET BUTTONS REPLACE, they do not add: the figure typed becomes the modifier, so "+2" typed twice is +2.
// His blank box means "leave it" (he re-reads the stored value as the input), and so does ours; a typed 0 is how
// one modifier is taken off alone. The two EXTRA DAMAGE boxes are the exception and do add, as his
// setExtraCombatDamageModifiers does. (His note under each CLEAR says to type the opposite value to remove one
// modifier; that is true only of those two, and the window's own note says so.)
//==================================================================================================================

export const ATTRIBUTE_KEYS = [ "str", "agl", "vit", "int", "wis", "knw", "app", "chm", "soc", "aur", "pty", "wil" ];
export const CHARACTERISTIC_KEYS = [ "endurance", "perception", "affinity", "fortune" ];
export const RESISTANCE_KEYS = [ "magic", "illusion", "control", "poison", "disease" ];

// @MARKER FATIGUE TABLE
// His fatigue table as the sheet SHOWS it (HTML 56750-56800), which is also the Player's Guide's table on p.199
// (Fatigue Levels and Penalties). His CODE's table (getFatigueLevelValues, sheet-worker.js:125130) disagrees in
// two columns: its Movement runs .25 .25 .25 .5 .5 .5 .5 .75 .75 .75 -- a character that moves FASTER the more
// tired it is -- and its Faint reads "WIL Save". The sheet's table and the book agree with each other, so they
// are used and the code's is recorded in docs/DECISIONS.md rather than copied.
//
//          level   Skill%   Melee   Missile  Damage   Movement   WpnSpeed   Faint
export const FATIGUE_TABLE = {
	0:            [   0,       0,      0,       0,       1,         0,        "None"          ],
	1:            [  -5,       0,      0,       0,       .75,       1,        "None"          ],
	2:            [ -10,       0,      0,      -1,       .75,       1,        "None"          ],
	3:            [ -15,      -1,     -1,      -2,       .75,       2,        "None"          ],
	4:            [ -20,      -2,     -2,      -3,       .5,        2,        "VIT Save"      ],
	5:            [ -25,      -3,     -3,      -4,       .5,        3,        "VIT Save-5%"   ],
	6:            [ -30,      -4,     -4,      -5,       .5,        3,        "VIT Save-10%"  ],
	7:            [ -35,      -5,     -5,      -6,       .5,        4,        "VIT Save-15%"  ],
	8:            [ -40,      -6,     -6,      -7,       .25,       4,        "VIT Save-20%"  ],
	9:            [ -45,      -7,     -7,      -8,       .25,       5,        "VIT Save-25%"  ],
	10:           [ -50,      -8,     -8,      -9,       .25,       5,        "VIT Save-30%"  ]
};

// Mental fatigue: "-5% to all skills per level" (his label beside the select).
export const MENTAL_FATIGUE_PER_LEVEL = 5;

// His getFatigueLevelValues: a level outside 0-10 is held to it.
export function getFatigueLevelValues(tmplevel) {
	var tmpl = Math.min(10, Math.max(0, parseInt(tmplevel) || 0));
	var tmprow = FATIGUE_TABLE[tmpl];
	return { level: tmpl, skill: tmprow[0], melee: tmprow[1], missile: tmprow[2], damage: tmprow[3],
	         movement: tmprow[4], weaponSpeed: tmprow[5], faint: tmprow[6] };
}

// @MARKER WHAT THE ACTOR GETS
// This is the function which works out what the stored temporary modifiers do, for the data model to fold in.
// tmptemp is system.tempMods (may be missing on an actor made before it existed). The Skills box itself is
// combat.skillMisc and is added by the model; what is here is what FATIGUE adds to it.
//
//     skills        percent, from fatigue and mental fatigue together (mental is also given on its own)
//     melee/missile to hit, from fatigue          damage    to damage, from fatigue
//     weaponSpeed   seconds added: the Weapon Speed box + fatigue
//     movement      multiplier from fatigue (1 = none)     faint    what the Faint column asks for
export function getTempEffects(tmptemp) {
	var tmpt = tmptemp ?? {};
	var tmpfat = tmpt.fatigue ?? {};
	var tmpphysical = tmpfat.immune ? getFatigueLevelValues(0) : getFatigueLevelValues(tmpfat.level);
	var tmpmental = tmpfat.mentalImmune ? 0 : (Math.max(0, parseInt(tmpfat.mentalLevel) || 0) * -MENTAL_FATIGUE_PER_LEVEL);
	return {
		skills:      tmpphysical.skill + tmpmental,
		melee:       tmpphysical.melee,
		missile:     tmpphysical.missile,
		damage:      tmpphysical.damage,
		weaponSpeed: (parseInt(tmpt.weaponSpeed) || 0) + tmpphysical.weaponSpeed,
		movement:    tmpphysical.movement,
		faint:       tmpphysical.faint,
		mental:      tmpmental,
		fatigueLevel: tmpphysical.level
	};
}

// @MARKER EXTRA DICE
// His extra damage dice and extra damage per die (sheet-worker.js:64980-64990, 65571-65584). Extra dice are more
// of the weapon's OWN die -- 2d6 with 1 extra is 3d6 -- and the extra per die is worked out on the dice count
// AFTER the extra dice are added. A flat weapon damage ("1", "2") has no dice and gets neither.
//   tmpdice   the weapon's damage as written ("2d6", "1d8+1", "3")
// Returns { dice, flat }: the dice to roll in place of tmpdice and the flat figure to add.
export function applyExtraDice(tmpdice, tmpextradice, tmpextraperdie) {
	var tmpextra = parseInt(tmpextradice) || 0;
	var tmpper = parseInt(tmpextraperdie) || 0;
	var tmpmatch = ("" + (tmpdice ?? "")).match(/^\s*(\d+)\s*d\s*(\d+)(.*)$/i);
	if (!tmpmatch || (tmpextra == 0 && tmpper == 0)) { return { dice: tmpdice, flat: 0 }; }
	var tmpcount = Math.max(0, parseInt(tmpmatch[1]) + tmpextra);
	return { dice: `${tmpcount}d${tmpmatch[2]}${tmpmatch[3] ?? ""}`, flat: tmpcount * tmpper };
}

// @MARKER ATTRIBUTES
// This is the function which ports setSTRAttributeModifiers and its eleven twins (sheet-worker.js:123083-123622).
// The input REPLACES the modifier of its own column; the mundane modifier is held so the attribute does not pass
// its natural maximum, the magic one so it does not pass the magical maximum, and neither goes below 0.
//
//   tmpin = { original, max, magicalMax, mundaneMod, magicMod, mundaneInput, magicInput }
//   original is the attribute with neither modifier in it. An input of "" or null leaves its modifier as it was.
// Returns { mundane, magic } -- the modifiers to store.
export function resolveAttributeMods(tmpin) {
	var tmporiginal = parseFloat(tmpin.original) || 0;
	var tmpmax = parseFloat(tmpin.max) || 0;
	var tmpmagicmax = parseFloat(tmpin.magicalMax) || 0;

	var tmpmundane = getInput(tmpin.mundaneInput, tmpin.mundaneMod);
	var tmpwithmundane = Math.min(tmpmax, Math.max(0, tmporiginal + tmpmundane));
	var tmpmundanemod = tmpwithmundane - tmporiginal;

	var tmpmagic = getInput(tmpin.magicInput, tmpin.magicMod);
	var tmpwithmagic = Math.min(tmpmagicmax, Math.max(0, tmpwithmundane + tmpmagic));
	var tmpmagicmod = tmpwithmagic - tmpwithmundane;

	return { mundane: Math.round(tmpmundanemod), magic: Math.round(tmpmagicmod) };
}

// A box that is empty keeps the stored figure (his "treat it like it was reinput"); anything typed replaces it.
function getInput(tmpinput, tmpstored) {
	var tmptext = ("" + (tmpinput ?? "")).trim();
	if (tmptext == "") { return parseFloat(tmpstored) || 0; }
	var tmpnumber = parseFloat(tmptext);
	return isNaN(tmpnumber) ? (parseFloat(tmpstored) || 0) : tmpnumber;
}

// @MARKER CHARACTERISTICS AND RESISTANCES
// His four characteristic and five resistance setters share one shape (sheet-worker.js:123829-124230): the
// modifier is held so the figure does not go below 0. tmpoptions = { original, input, stored }.
export function resolveFloorMod(tmpoptions) {
	var tmporiginal = parseFloat(tmpoptions.original) || 0;
	var tmpwanted = getInput(tmpoptions.input, tmpoptions.stored);
	return Math.round(Math.max(0, tmporiginal + tmpwanted) - tmporiginal);
}

// A figure that cannot be less than 1 -- his "cannot be less than 1" test, which sets anything under 1 to 0.
function atLeastOne(tmpvalue) {
	var tmpn = parseFloat(tmpvalue) || 0;
	return (tmpn < 1) ? 0 : tmpn;
}

function blank(tmpvalue) {
	return ("" + (tmpvalue ?? "")).trim() == "";
}

// @MARKER THE SIX SECTIONS
//   Each section is { set(system, inputs), clear(system) } and returns an object of actor update paths.
//   "system" is the actor's DERIVED system data; "inputs" is what the window's boxes held.
const SECTIONS = {

	attributes: {
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			for (const tmpk of ATTRIBUTE_KEYS) {
				var tmpa = tmpsys.attributes?.[tmpk];
				if (!tmpa) { continue; }
				var tmpmagicnow = parseFloat(tmpsys.tempMods?.magicAttr?.[tmpk]) || 0;
				var tmpmundanenow = parseFloat(tmpa.tempMod) || 0;
				var tmpresult = resolveAttributeMods({
					original: (parseFloat(tmpa.value) || 0) - tmpmundanenow - tmpmagicnow,
					max: tmpa.max, magicalMax: tmpa.magicalMax,
					mundaneMod: tmpmundanenow, magicMod: tmpmagicnow,
					mundaneInput: tmpinputs[`${tmpk}Mundane`], magicInput: tmpinputs[`${tmpk}Magic`]
				});
				if (tmpresult.mundane != tmpmundanenow) { tmpout[`system.attributes.${tmpk}.tempMod`] = tmpresult.mundane; }
				if (tmpresult.magic != tmpmagicnow)     { tmpout[`system.tempMods.magicAttr.${tmpk}`] = tmpresult.magic; }
			}
			return tmpout;
		},
		clear(tmpsys) {
			var tmpout = {};
			for (const tmpk of ATTRIBUTE_KEYS) {
				tmpout[`system.attributes.${tmpk}.tempMod`] = 0;
				tmpout[`system.tempMods.magicAttr.${tmpk}`] = 0;
			}
			return tmpout;
		}
	},

	characteristics: {
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			for (const tmpk of CHARACTERISTIC_KEYS) {
				var tmpc = tmpsys.characteristics?.[tmpk];
				if (!tmpc) { continue; }
				var tmpnow = parseFloat(tmpc.tempMod) || 0;
				var tmpmod = resolveFloorMod({ original: (parseFloat(tmpc.value) || 0) - tmpnow,
					input: tmpinputs[tmpk], stored: tmpnow });
				if (tmpmod != tmpnow) { tmpout[`system.characteristics.${tmpk}.tempMod`] = tmpmod; }
			}
			return tmpout;
		},
		clear() {
			var tmpout = {};
			for (const tmpk of CHARACTERISTIC_KEYS) { tmpout[`system.characteristics.${tmpk}.tempMod`] = 0; }
			return tmpout;
		}
	},

	resistances: {
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			for (const tmpk of RESISTANCE_KEYS) {
				var tmpr = tmpsys.resistances?.[tmpk];
				if (!tmpr) { continue; }
				var tmpnow = parseFloat(tmpr.misc) || 0;
				// base + race is the figure with no modifier in it, whether or not an immunity hides the total.
				var tmpmod = resolveFloorMod({ original: (parseFloat(tmpr.base) || 0) + (parseFloat(tmpr.raceMod) || 0),
					input: tmpinputs[tmpk], stored: tmpnow });
				if (tmpmod != tmpnow) { tmpout[`system.resistances.${tmpk}.misc`] = tmpmod; }
				var tmpimmune = !!tmpinputs[`${tmpk}Immune`];
				if (tmpimmune != !!tmpr.immune) { tmpout[`system.resistances.${tmpk}.immune`] = tmpimmune; }
			}
			return tmpout;
		},
		clear() {
			var tmpout = {};
			for (const tmpk of RESISTANCE_KEYS) {
				tmpout[`system.resistances.${tmpk}.misc`] = 0;
				tmpout[`system.resistances.${tmpk}.immune`] = false;
			}
			return tmpout;
		}
	},

	movement: {
		// walk jog run special are one figure that becomes three: hourly, x10 for ten seconds, x1 for one second.
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			var tmpt = tmpsys.tempMods ?? {};
			for (const tmpk of [ "walk", "jog", "run", "special", "dailyMove", "dailyRest", "standJump", "upJump" ]) {
				if (blank(tmpinputs[tmpk])) { continue; }
				var tmpvalue = parseFloat(tmpinputs[tmpk]);
				if (!isNaN(tmpvalue) && tmpvalue != (parseFloat(tmpt[tmpk]) || 0)) { tmpout[`system.tempMods.${tmpk}`] = tmpvalue; }
			}
			// His movement multiplier modifier: 1 (or 0) is "none"; anything else replaces the racial multiplier.
			if (!blank(tmpinputs.moveMulti)) {
				var tmpmulti = parseFloat(tmpinputs.moveMulti);
				if (!isNaN(tmpmulti)) { tmpout["system.tempMods.moveMulti"] = (tmpmulti <= 0) ? 1 : tmpmulti; }
			}
			// The special movement type is always taken from its select, as his setSpecialMovementType does.
			if (tmpinputs.specialType !== undefined) {
				var tmptype = ("" + tmpinputs.specialType == "None:") ? "" : ("" + tmpinputs.specialType);
				if (tmptype != (tmpt.specialType ?? "")) { tmpout["system.tempMods.specialType"] = tmptype; }
			}
			if (!blank(tmpinputs.specialSpeed)) {
				var tmpspeed = parseFloat(tmpinputs.specialSpeed);
				if (!isNaN(tmpspeed)) { tmpout["system.tempMods.specialSpeed"] = (tmpspeed <= 0) ? 1 : tmpspeed; }
			}
			return tmpout;
		},
		clear() {
			var tmpout = {};
			for (const tmpk of [ "walk", "jog", "run", "special", "dailyMove", "dailyRest", "standJump", "upJump" ]) {
				tmpout[`system.tempMods.${tmpk}`] = 0;
			}
			tmpout["system.tempMods.moveMulti"] = 1;
			tmpout["system.tempMods.specialType"] = "";
			tmpout["system.tempMods.specialSpeed"] = 1;
			return tmpout;
		}
	},

	combat: {
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			var tmpc = tmpsys.combat ?? {};
			var tmpt = tmpsys.tempMods ?? {};
			// path, input name, how to read it. Plain signed figures replace; "floor" ones that cannot be
			// below 1 go to 0 (his hide, armour, absorption, fumble and called shot setters).
			//     input             stored at                       was                          kind
			var tmpplain = [
				[ "damage",       "system.combat.damageMisc",      tmpc.damageMisc,       "signed" ],
				[ "defensive",    "system.combat.defenseMisc",     tmpc.defenseMisc,      "signed" ],
				[ "melee",        "system.combat.meleeMisc",       tmpc.meleeMisc,        "signed" ],
				[ "missile",      "system.combat.missileMisc",     tmpc.missileMisc,      "signed" ],
				[ "initiative",   "system.combat.initiativeMisc",  tmpc.initiativeMisc,   "signed" ],
				[ "weaponSpeed",  "system.tempMods.weaponSpeed",   tmpt.weaponSpeed,      "signed" ],
				[ "skills",       "system.combat.skillMisc",       tmpc.skillMisc,        "signed" ],
				[ "painThreshold","system.combat.painThreshold",   tmpc.painThreshold,    "signed" ],
				[ "hide",         "system.body.hide",              tmpsys.body?.hide,     "floor"  ],
				[ "forceArmor",   "system.combat.forceArmor",      tmpc.forceArmor,       "floor"  ],
				[ "spiritArmor",  "system.combat.spiritArmor",     tmpc.spiritArmor,      "floor"  ],
				[ "outerKinetic", "system.combat.outerKinetic",    tmpc.outerKinetic,     "floor"  ],
				[ "damageAbsorb", "system.combat.damageAbsorb",    tmpc.damageAbsorb,     "floor"  ],
				[ "fumble",       "system.tempMods.fumble",        tmpt.fumble,           "floor"  ],
				[ "calledShot",   "system.tempMods.calledShot",    tmpt.calledShot,       "floor"  ]
			];
			for (const [tmpname, tmppath, tmpwas, tmpkind] of tmpplain) {
				if (blank(tmpinputs[tmpname])) { continue; }
				var tmpvalue = Math.round(parseFloat(tmpinputs[tmpname]));
				if (isNaN(tmpvalue)) { continue; }
				if (tmpkind == "floor") { tmpvalue = atLeastOne(tmpvalue); }
				if (tmpvalue != (parseFloat(tmpwas) || 0)) { tmpout[tmppath] = tmpvalue; }
			}
			// The two extra damage boxes ADD (his setExtraCombatDamageModifiers). The second box in his code reads
			// the first box's input -- a slip -- and here each reads its own.
			if (!blank(tmpinputs.extraDice)) {
				var tmpdice = (parseInt(tmpt.extraDice) || 0) + (Math.round(parseFloat(tmpinputs.extraDice)) || 0);
				tmpout["system.tempMods.extraDice"] = tmpdice;
			}
			if (!blank(tmpinputs.extraPerDie)) {
				var tmpper = (parseInt(tmpt.extraPerDie) || 0) + (Math.round(parseFloat(tmpinputs.extraPerDie)) || 0);
				tmpout["system.tempMods.extraPerDie"] = tmpper;
			}
			// Speed Seconds is a select of 0-10.
			if (!blank(tmpinputs.speedSeconds)) {
				var tmpsec = Math.min(10, Math.max(0, parseInt(tmpinputs.speedSeconds) || 0));
				if (tmpsec != (parseInt(tmpc.speedSeconds) || 0)) { tmpout["system.combat.speedSeconds"] = tmpsec; }
			}
			if (tmpinputs.ambidextrous !== undefined && !!tmpinputs.ambidextrous != !!tmpt.ambidextrous) {
				tmpout["system.tempMods.ambidextrous"] = !!tmpinputs.ambidextrous;
			}
			if (tmpinputs.shockImmune !== undefined && !!tmpinputs.shockImmune != !!tmpt.shockImmune) {
				tmpout["system.tempMods.shockImmune"] = !!tmpinputs.shockImmune;
			}
			return tmpout;
		},
		clear() {
			return {
				"system.combat.damageMisc": 0, "system.combat.defenseMisc": 0, "system.combat.meleeMisc": 0,
				"system.combat.missileMisc": 0, "system.combat.initiativeMisc": 0, "system.combat.skillMisc": 0,
				"system.combat.painThreshold": 0, "system.combat.speedSeconds": 0,
				"system.combat.forceArmor": 0, "system.combat.spiritArmor": 0, "system.combat.outerKinetic": 0,
				"system.combat.damageAbsorb": 0, "system.body.hide": 0,
				"system.tempMods.weaponSpeed": 0, "system.tempMods.extraDice": 0, "system.tempMods.extraPerDie": 0,
				"system.tempMods.fumble": 0, "system.tempMods.calledShot": 0,
				"system.tempMods.ambidextrous": false, "system.tempMods.shockImmune": false
			};
		}
	},

	// The two multipliers: 2 is x2, .5 is x1/2. Blank leaves it; 0 or less is "none" (1).
	equipment: {
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			var tmpt = tmpsys.tempMods ?? {};
			for (const tmpk of [ "weightMulti", "capacityMulti" ]) {
				if (blank(tmpinputs[tmpk])) { continue; }
				var tmpvalue = parseFloat(tmpinputs[tmpk]);
				if (isNaN(tmpvalue)) { continue; }
				if (tmpvalue <= 0) { tmpvalue = 1; }
				if (tmpvalue != (parseFloat(tmpt[tmpk]) || 1)) { tmpout[`system.tempMods.${tmpk}`] = tmpvalue; }
			}
			return tmpout;
		},
		clear() { return { "system.tempMods.weightMulti": 1, "system.tempMods.capacityMulti": 1 }; }
	},

	// Fatigue and mental fatigue. Immunity forces the level to 0, as setFatigueModifier does (125010-125040).
	fatigue: {
		set(tmpsys, tmpinputs) {
			var tmpout = {};
			var tmpf = tmpsys.tempMods?.fatigue ?? {};
			var tmpimmune = !!tmpinputs.immune;
			var tmplevel = tmpimmune ? 0 : Math.min(10, Math.max(0, parseInt(tmpinputs.level) || 0));
			var tmpmentalimmune = !!tmpinputs.mentalImmune;
			var tmpmental = tmpmentalimmune ? 0 : Math.min(10, Math.max(0, parseInt(tmpinputs.mentalLevel) || 0));
			if (tmplevel != (tmpf.level ?? 0))              { tmpout["system.tempMods.fatigue.level"] = tmplevel; }
			if (tmpimmune != !!tmpf.immune)                 { tmpout["system.tempMods.fatigue.immune"] = tmpimmune; }
			if (tmpmental != (tmpf.mentalLevel ?? 0))       { tmpout["system.tempMods.fatigue.mentalLevel"] = tmpmental; }
			if (tmpmentalimmune != !!tmpf.mentalImmune)     { tmpout["system.tempMods.fatigue.mentalImmune"] = tmpmentalimmune; }
			return tmpout;
		},
		clear() {
			return { "system.tempMods.fatigue.level": 0, "system.tempMods.fatigue.immune": false,
			         "system.tempMods.fatigue.mentalLevel": 0, "system.tempMods.fatigue.mentalImmune": false };
		}
	}
};

export const SECTION_NAMES = Object.keys(SECTIONS);

// This is the function which says what a section's SET writes. tmpsys is the actor's derived system data.
export function resolveSetUpdate(tmpsection, tmpsys, tmpinputs) {
	var tmpsec = SECTIONS[tmpsection];
	return tmpsec ? tmpsec.set(tmpsys ?? {}, tmpinputs ?? {}) : {};
}

// This is the function which says what a section's CLEAR writes, or with no section, CLEAR ALL: every section,
// the berserk state, and the evokes.
export function resolveClearUpdate(tmpsection, tmpsys) {
	if (tmpsection) {
		var tmpsec = SECTIONS[tmpsection];
		return tmpsec ? tmpsec.clear(tmpsys ?? {}) : {};
	}
	var tmpout = {};
	for (const tmpname of SECTION_NAMES) { Object.assign(tmpout, SECTIONS[tmpname].clear(tmpsys ?? {})); }
	tmpout["system.tempMods.berserk"] = "";
	tmpout["system.magic.effectList"] = removeEffects(tmpsys?.magic?.effectList, (tmpe) => /^Evoke:|^Berserking/.test(tmpe));
	return tmpout;
}

// @MARKER EFFECT NAMES
// His effect names are the caster's effect list (tmp_effect_list), which the port keeps as magic.effectList: a
// comma-separated string, "Spell: Fly, Invoke: Chill, Berserking". Display only -- the figures are the sections'.
export function splitEffects(tmplist) {
	return ("" + (tmplist ?? "")).split(",").map(tmpe => tmpe.trim()).filter(tmpe => tmpe && tmpe != "None");
}

export function addEffect(tmplist, tmpname) {
	var tmpentries = splitEffects(tmplist);
	var tmpnew = ("" + (tmpname ?? "")).replace(/,/g, " ").replace(/\s+/g, " ").trim();   // "No Commas!", as his box says
	if (!tmpnew || tmpentries.includes(tmpnew)) { return tmpentries.join(", "); }
	tmpentries.push(tmpnew);
	return tmpentries.join(", ");
}

export function removeEffects(tmplist, tmptest) {
	return splitEffects(tmplist).filter(tmpe => !tmptest(tmpe)).join(", ");
}

// @MARKER BERSERKING
// His three buttons (sheet-worker.js:12385-12470, 128423-128515), as updates on top of the actor's modifiers.
//
//   BERSERK  Endurance +half, STR/AGL/VIT/WIL +2 (magic), INT/WIS/KNW -half (magic), shock immunity, and "Berserking"
//            on the effects list. Refused when already berserk (or on Berserker Root), or in the after state.
//   AFTER    Endurance back to 0, STR/AGL/VIT a further -4 (so -2 net of the +2), INT/WIS/KNW/WIL cleared, shock
//            immunity off; "Berserking" becomes "Berserking(after effects)". Only from a berserk state.
//   CLEAR    the after effects off: STR/AGL/VIT +2 back, END 0, the effect removed. Only from the after state.
// Returns { ok, message, update } -- an update is empty when refused.
export function resolveBerserk(tmpwhat, tmpsys) {
	var tmpeffects = tmpsys.magic?.effectList ?? "";
	var tmplist = splitEffects(tmpeffects);
	var tmpberserking = tmplist.some(tmpe => tmpe == "Berserking" || tmpe == "Herb: Berserker Root");
	var tmpafter = tmplist.includes("Berserking(after effects)");
	var tmpmagic = (tmpk) => parseFloat(tmpsys.tempMods?.magicAttr?.[tmpk]) || 0;
	var tmpupdate = {};

	// Moves one attribute's magic modifier by a delta, held to the attribute's magical maximum and to 0.
	var tmpnudge = (tmpk, tmpdelta) => {
		var tmpa = tmpsys.attributes?.[tmpk];
		if (!tmpa) { return; }
		var tmpwant = (tmpupdate[`system.tempMods.magicAttr.${tmpk}`] ?? tmpmagic(tmpk)) + tmpdelta;
		var tmpwithout = (parseFloat(tmpa.value) || 0) - tmpmagic(tmpk);
		var tmpfinal = Math.min(parseFloat(tmpa.magicalMax) || 0, Math.max(0, tmpwithout + tmpwant));
		tmpupdate[`system.tempMods.magicAttr.${tmpk}`] = Math.round(tmpfinal - tmpwithout);
	};

	if (tmpwhat == "berserk") {
		if (tmpafter) { return { ok: false, message: "In a berserk after state and needs recovery before going berserk again.", update: {} }; }
		if (tmpberserking) { return { ok: false, message: "Already berserk. Cannot go more berserk.", update: {} }; }
		var tmpend = parseInt(tmpsys.characteristics?.endurance?.value) || 0;
		tmpupdate["system.characteristics.endurance.tempMod"] = Math.floor(tmpend * 0.5);
		for (const tmpk of [ "str", "agl", "vit", "wil" ]) { tmpnudge(tmpk, 2); }
		for (const tmpk of [ "int", "wis", "knw" ]) {
			var tmprating = parseInt(tmpsys.attributes?.[tmpk]?.value) || 0;
			if (tmprating > 1) { tmpnudge(tmpk, -Math.round(tmprating / 2)); }
		}
		tmpupdate["system.tempMods.shockImmune"] = true;
		tmpupdate["system.tempMods.berserk"] = "berserk";
		tmpupdate["system.magic.effectList"] = addEffect(tmpeffects, "Berserking");
		return { ok: true, message: "Berserk. All modifiers set.", update: tmpupdate };
	}

	if (tmpwhat == "after") {
		if (tmpafter) { return { ok: false, message: "Already in the berserk after state.", update: {} }; }
		if (!tmpberserking) { return { ok: false, message: "Not berserk, so there are no after effects to set.", update: {} }; }
		tmpupdate["system.characteristics.endurance.tempMod"] = 0;
		for (const tmpk of [ "str", "agl", "vit" ]) { tmpnudge(tmpk, -4); }
		for (const tmpk of [ "int", "wis", "knw", "wil" ]) {
			tmpupdate[`system.attributes.${tmpk}.tempMod`] = 0;
			tmpupdate[`system.tempMods.magicAttr.${tmpk}`] = 0;
		}
		tmpupdate["system.tempMods.shockImmune"] = false;
		tmpupdate["system.tempMods.berserk"] = "after";
		tmpupdate["system.magic.effectList"] = addEffect(removeEffects(tmpeffects,
			(tmpe) => tmpe == "Berserking" || tmpe == "Herb: Berserker Root"), "Berserking(after effects)");
		return { ok: true, message: "Berserk after effects set.", update: tmpupdate };
	}

	// clear
	if (!tmpafter) { return { ok: false, message: "No berserk after effects to clear.", update: {} }; }
	tmpupdate["system.characteristics.endurance.tempMod"] = 0;
	for (const tmpk of [ "str", "agl", "vit" ]) { tmpnudge(tmpk, 2); }
	tmpupdate["system.tempMods.berserk"] = "";
	tmpupdate["system.magic.effectList"] = removeEffects(tmpeffects, (tmpe) => tmpe == "Berserking(after effects)");
	return { ok: true, message: "Berserk after effects cleared.", update: tmpupdate };
}

// @MARKER TEMPORARY SPECIAL MOVEMENT
// His "Replace Special Movement Type" (calcSpecialMovement, sheet-worker.js:32180-32290): the special rate is
// worked out from the character's own finished walk and run rather than from the race. The speed multiplier
// applies when it is not 1, and the flat modifier is added after (Sprint is the one that is nothing BUT the
// modifier). Each figure is { hourly, tenSec, oneSec }; the flat mod is in hourly units and x10 for ten seconds.
//
//   tmptype      "Swim:" "Climb:" "Fly:" "Fly(S):" "Sprint:" "Scurry:" "Gallop:" "Slither:"
//   tmpmovement  { walk, run }          tmpspeed  the temp special speed multiplier (1 = none)
//   tmpracemulti the race's speed multiplier (1 when none)        tmpint  the character's Intelligence
//   tmpmod       the Swim box's modifier
export const TEMP_SPECIAL_TYPES = [ "Swim:", "Climb:", "Fly:", "Fly(S):", "Sprint:", "Scurry:", "Gallop:", "Slither:" ];
export const TEMP_SPECIAL_LABELS = { "Fly:": "Fly(Wings):", "Fly(S):": "Fly(Magic):" };

export function resolveTempSpecialMovement(tmptype, tmpmovement, tmpspeed, tmpracemulti, tmpint, tmpmod) {
	var tmpspd = (parseFloat(tmpspeed) || 0) > 0 ? parseFloat(tmpspeed) : 1;
	var tmprace = (parseFloat(tmpracemulti) || 0) > 0 ? parseFloat(tmpracemulti) : 1;
	var tmpscales = [ [ "hourly", 1 ], [ "tenSec", 10 ], [ "oneSec", 1 ] ];
	var tmpout = { hourly: 0, tenSec: 0, oneSec: 0 };
	for (const [tmpscale, tmpscalemod] of tmpscales) {
		var tmpwalk = parseFloat(tmpmovement?.walk?.[tmpscale]) || 0;
		var tmprun = parseFloat(tmpmovement?.run?.[tmpscale]) || 0;
		var tmpadd = (parseFloat(tmpmod) || 0) * tmpscalemod;
		var tmpvalue = 0;
		switch (tmptype) {
			case "Swim:":    tmpvalue = (tmpwalk * tmpspd * 0.5) + tmpadd; break;
			case "Climb:":   tmpvalue = (tmpwalk * 0.25 * tmpspd) + tmpadd; break;
			case "Fly:":     tmpvalue = (tmprun * tmprace * tmpspd) + tmpadd; break;
			// Magical flight reads Intelligence, 3 / 30 / 3, with no multiplier (his 32197-32200).
			case "Fly(S):":  tmpvalue = ((parseFloat(tmpint) || 0) * (tmpscale == "tenSec" ? 30 : 3)) + tmpadd; break;
			case "Sprint:":  tmpvalue = tmpadd * tmprace * tmpspd; break;
			case "Scurry:":
			case "Gallop:":  tmpvalue = (tmpwalk * tmprace * 4 * tmpspd) + tmpadd; break;
			case "Slither:": tmpvalue = (tmpwalk * tmpspd) + tmpadd; break;
			default:         tmpvalue = 0;
		}
		tmpout[tmpscale] = Math.round(Math.max(0, tmpvalue) * 10) / 10;
	}
	return tmpout;
}

// @MARKER ADD NEW temporary modifier rule functions HERE
// @END (CODE)
