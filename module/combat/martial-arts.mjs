// @START (CODE)
// @MARKER MARTIAL ARTS
//==================================================================================================================
// Martial Knowledge and Martial Lore, as plain functions.
//
// Nothing in this file touches Foundry, in the same shape as combat-rules.mjs beside it: every
// function takes values and returns values, dice results included, which the caller rolls and
// passes in. The tables are generated from his sheet into module/combat-tables.mjs by
// tools/extract/extract_combat_tables.py; nothing here restates a number his tables carry.
//
// HOW HIS SUBSYSTEM WORKS, as read from his code (sheet-worker.js:66168-69100 and 98801-100838)
// and the Player's Guide (pp.95-97):
//
//   - Martial Knowledge is ONE class skill, and everything under it is a SUBSKILL rolled against
//     its chance plus the subskill's own modifier (Player's Guide p.93: the parent's rating less
//     the subskill's, x5% -- a Martial Punch, rating 10 against Martial Knowledge's 16, is +30%).
//     Martial Lore is a second, restricted class skill with twelve subskills of its own, measured
//     against its rating of 18.
//
//   - Which subskills a character knows comes from a DISCIPLINE chosen once, when Martial
//     Knowledge is acquired: Offensive, Defensive, Balanced, Contact, or Custom (pick your own).
//     Martial Lore then lets any further one be learned, one at a time, by a Martial Lore roll.
//
//   - There are five families. ATTACKS are rolled twice: a skill roll (Martial Knowledge + the
//     attack's modifier) and an ordinary d20 to hit on the character's own attack chart. A hit
//     whose skill roll failed still does HALF damage -- "In the case of unsuccessful martial
//     attacks, 1/2 damage is still done if the roll to hit was successful" (p.95), and his
//     getMartialDamageDetails halves on !skillSuccess. BLOCKS are a skill roll that halves a
//     blow. HOLDS and THROWS need a touch first (d20 + the Agility missile modifier, 10 or better,
//     a natural 1 always failing -- his handleTouchAttack) and then the skill roll. MOVES are a
//     skill roll that, made, adds its effect to the attacks after it -- the only family that
//     changes numbers elsewhere.
//
//   - STANCES are learned one at a time by a Martial Knowledge roll and MASTERED by a Martial
//     Lore roll (Mysteries of the Planes p.167). One is held at a time, entered in 3 seconds with
//     no roll, and while held the Furious Attack and Desperate Defense engagements cannot be used
//     -- his handleMeleeSet's `if(!inMartialStance)`.
//
// Where his code and his own dictionary prose disagree, the CORRECTIONS below say which was
// followed and why; every one is also in docs/UPSTREAM-ISSUES.md for him. Where his code and the
// book disagree and his sheet is consistent with itself, his sheet is followed, per the standing
// rule, and the difference is only noted.
//==================================================================================================================

import {
	MARTIAL_ATTACKS, MARTIAL_BLOCKS, MARTIAL_HOLDS, MARTIAL_MOVES, MARTIAL_THROWS,
	MARTIAL_LORE_VALUES, MARTIAL_PARENT_RATINGS, MARTIAL_STANCES, MARTIAL_STANCE_MODS,
	MARTIAL_MOVE_MODS, MARTIAL_LORE_MODS, MARTIAL_DISCIPLINES, MARTIAL_LORE_BLIND
} from "../combat-tables.mjs";
import { MELEE_MODES, getWeaponSpeed, getNumberOfDice, combineDamageMultipliers } from "./combat-rules.mjs";


//==================================================================================================================
// @MARKER MARTIAL TABLE INDEX
//==================================================================================================================

	// The five Martial Knowledge families, each with its generated table and the word his sheet
	// uses for it in the Lore value "Type" column (Attack, Block, Hold, Move, Throw).
	//
	//                         table            loreType
	export const MARTIAL_FAMILIES = {
		attacks: { table: MARTIAL_ATTACKS, loreType: "Attack", label: "Attacks" },
		blocks:  { table: MARTIAL_BLOCKS,  loreType: "Block",  label: "Blocks" },
		holds:   { table: MARTIAL_HOLDS,   loreType: "Hold",   label: "Holds" },
		moves:   { table: MARTIAL_MOVES,   loreType: "Move",   label: "Moves" },
		throws:  { table: MARTIAL_THROWS,  loreType: "Throw",  label: "Throws" }
	};

	// The disciplines a player may choose, in his dropdown's order (all_martial_know_arts). Custom
	// is the one with no fixed list: its subskills are whatever the player picks.
	export const MARTIAL_DISCIPLINE_NAMES = ["Offensive", "Defensive", "Balanced", "Contact", "Custom"];

	// The five stances, in his dropdown's order.
	export const MARTIAL_STANCE_NAMES = Object.keys(MARTIAL_STANCES);

	// What kind of damage each martial attack does. HIS SHEET CARRIES NO DAMAGE TYPE for them at
	// all -- getMartialDamageDetails rolls the dice and stops -- so this is the Player's Guide's,
	// "Attacks" (pp.95-96), and is kept by hand for that reason. A Counter Punch or Kick is "the
	// same as" the punch or kick it counters, and a Scissor Strike is "two martial punches".
	//
	//                                      damage type
	export const MARTIAL_ATTACK_DAMAGE_TYPES = {
		"Martial Punch":                    "Smashing",
		"Martial Kick":                     "Smashing",
		"Elbow Smash":                      "Smashing",
		"Knee Smash":                       "Smashing",
		"Head Butt":                        "Smashing",
		"Heel Strike":                      "Smashing",
		"Rake":                             "Cutting",
		"Finger Punch":                     "Thrusting",
		"Counter Punch":                    "Smashing",
		"Counter Kick":                     "Smashing",
		"Scissor Strike":                   "Smashing"
	};


//==================================================================================================================
// @MARKER CORRECTIONS
//==================================================================================================================
// Every place this port does something other than what his code executes, and why. Each has an
// UPSTREAM-ISSUES.md entry (item 56) so he can say which he meant. The rule used to decide:
// where his code and his OWN prose for the same thing disagree, and the Player's Guide sides with
// the prose, the prose is taken as what he meant and the code as the slip. Where his code is
// consistent with itself and only the book differs, his code is followed and nothing is here.

	// A subskill's modifier that does not fit his own rating column.
	//
	// Immoveable Stance is rating 17, which by the subskill rule is -5% against Martial Knowledge's
	// 16 -- and the Player's Guide prints "Immovable Stance (Rating 17 / -5%)". His table says +5.
	// Rating, rule and book agree against one cell, so -5 is used.
	//
	// Jump is the other misfit (rating 14 by the rule is +10%, his table says +20%), and it is NOT
	// corrected: the book prints "Jump (Rating 14 / +20%)" too, so his table and his book agree and
	// only the arithmetic says otherwise.
	//
	//                                      his   used
	export const MARTIAL_SKILLMOD_CORRECTIONS = {
		"Immoveable Stance":                { his: 5, used: -5 }
	};

	// What a move adds once it is made, where his handleMartialModifierSet and his own move prose
	// (martialmovevalueslist) disagree. The generated MARTIAL_MOVE_MODS is his code, untouched;
	// these are laid over it by getMoveModifiers.
	//
	//   Flying        his code adds +1 damage beside the x2. The prose says "To hit +4, Dam x2" and
	//                 the book "doubles damage rolled"; the +1 is Jump's line, copied. Not added.
	//   Spinning      his code adds +4 to hit. The prose says "To hit +2" and the book "by 2".
	//                 SETTLED by the user 2026-09-22: +2, the book's figure. Not to be reverted to +4.
	//   Double Attack his code says "-1 Sec Martial Attack". His own table's speed is "+1", its
	//                 prose "Adds 1 second to each attack", and the book "Adds one second".
	//
	// And three things his code only PRINTS, which are made real here because the move does
	// nothing otherwise -- each is the move's whole point in both his prose and the book:
	//
	//   Jump          "+1 Die Dam" reaches his martial attacks but not a weapon (his weapon path
	//                 only reads a stance's extra die). The book: "This can be applied to weapon
	//                 attacks as well as martial attacks." So it is returned for both.
	//   Snap          "-1 Sec Martial Attack, No STR Mod" -- nothing in his sheet reads either.
	//   Tension       read by his weapon path ("STR Dam bonus x2") but not by his martial one, where
	//                 the book says it harnesses "a stronger weapon or martial attack".
	//
	// seconds is what the move ADDS to the attack it is combined with, from the book's timing for
	// each (Jump one, Flying two, Spinning two, Tension two, Double Attack one each, Snap minus
	// one). His table's speed column carries the same figures for all six.
	//
	//                      melee damage multiplier extraDice perDie seconds strength  martialOnly
	export const MARTIAL_MOVE_CORRECTIONS = {
		"Jump":          { melee: 2, damage: 1, multiplier: 1, extraDice: 1, perDie: 0, seconds: 1,  strength: "",        martialOnly: false },
		"Flying":        { melee: 4, damage: 0, multiplier: 2, extraDice: 0, perDie: 0, seconds: 2,  strength: "",        martialOnly: false },
		"Spinning":      { melee: 2, damage: 0, multiplier: 1, extraDice: 0, perDie: 2, seconds: 2,  strength: "",        martialOnly: false },
		"Snap":          { melee: 0, damage: 0, multiplier: 1, extraDice: 0, perDie: 0, seconds: -1, strength: "snap",    martialOnly: true },
		"Tension":       { melee: 0, damage: 0, multiplier: 1, extraDice: 0, perDie: 0, seconds: 2,  strength: "tension", martialOnly: false },
		"Double Attack": { melee: 0, damage: 0, multiplier: 1, extraDice: 0, perDie: 0, seconds: 1,  strength: "",        martialOnly: true }
	};

	// What a stance does, where handleStanceOn and the stance's own prose disagree.
	//
	//   Drunken fighting  his code writes "+1 Die Dam" (and "+2 Die Dam" mastered) -- an extra die.
	//                     His own prose says "+1 per die of damage" (+2 mastered), and so does
	//                     Mysteries of the Planes p.167. A per-die bonus is used.
	//   Flow as water     "+1 second to offensive actions starting speed" is in his text, but his
	//                     parser only ever looks for "-1 second" and "-2 seconds", so it is never
	//                     applied. The book says the same "+1 second per action". Applied.
	//
	//                                      form        perDie  extraDice  seconds
	export const MARTIAL_STANCE_CORRECTIONS = {
		"Drunken fighting": { knowledge: { perDie: 1, extraDice: 0 },
		                      lore:      { perDie: 2, extraDice: 0 } },
		"Flow as water":    { knowledge: { seconds: 1 } }
	};


//==================================================================================================================
// @MARKER SUBSKILLS
//==================================================================================================================

	// This is the function which reads a comma-separated list of his into names. Kept as his shape
	// on the actor (martial_know_attacks and siblings are single strings), so a text field can write
	// it back; parsed here once. Blanks and stray spaces are dropped.
	export function parseMartialList(tmplist) {
		if (Array.isArray(tmplist)) { return tmplist.map(n => ("" + n).trim()).filter(n => n); }
		return ("" + (tmplist ?? "")).split(",").map(n => n.trim()).filter(n => n);
	}

	// This is the function which says whether a name is in one of his lists. By EXACT name, not by
	// his includes(): his "already known?" tests use tempMKHoldsList.includes("Arm"), which is true
	// for anyone who knows "Torso(1 Arm)" -- so a character with that hold could never learn the
	// Arm hold. See UPSTREAM-ISSUES.md item 56.
	export function hasMartialName(tmplist, tmpname) {
		return parseMartialList(tmplist).includes(("" + (tmpname ?? "")).trim());
	}

	// This is the function which gives one subskill's modifier to its parent skill's chance, with
	// the one correction above. Zero for a name his tables do not hold.
	export function getMartialSkillMod(tmpfamily, tmpname) {
		if (MARTIAL_SKILLMOD_CORRECTIONS[tmpname] && tmpfamily == "moves") {
			return MARTIAL_SKILLMOD_CORRECTIONS[tmpname].used;
		}
		var tmptable = (tmpfamily == "lore") ? MARTIAL_LORE_VALUES : MARTIAL_FAMILIES[tmpfamily]?.table;
		return parseInt(tmptable?.[tmpname]?.skillMod) || 0;
	}

	// This is the function which gives a subskill's chance: its parent skill's chance plus its own
	// modifier. A character without the parent skill has no chance at all -- not the modifier on
	// its own, which for a Martial Punch would be a free 30%.
	export function getMartialSubskillChance(tmpparentchance, tmpfamily, tmpname) {
		var tmpparent = parseInt(tmpparentchance) || 0;
		if (tmpparent <= 0) { return 0; }
		return tmpparent + getMartialSkillMod(tmpfamily, tmpname);
	}

	// This is the function which works out which subskills a character knows: the discipline's own
	// list, then anything learned beyond it -- a Custom pick, or a subskill added with Martial Lore
	// -- in the order it was learned, each named once. A name his tables do not hold is dropped and
	// reported, rather than shown as a row of zeroes.
	//
	//   tmpdiscipline  one of MARTIAL_DISCIPLINE_NAMES, or "" for none chosen
	//   tmplearned     { attacks, blocks, holds, moves, throws } -- his comma-separated strings
	//
	// Returns { attacks: [...], blocks: [...], holds: [...], moves: [...], throws: [...], unknown: [...] }.
	export function resolveMartialKnown(tmpdiscipline, tmplearned) {
		var tmpout = { unknown: [] };
		var tmppreset = MARTIAL_DISCIPLINES[tmpdiscipline] ?? {};
		for (const tmpfamily of Object.keys(MARTIAL_FAMILIES)) {
			var tmptable = MARTIAL_FAMILIES[tmpfamily].table;
			var tmpnames = [];
			for (const tmpname of [...(tmppreset[tmpfamily] ?? []), ...parseMartialList(tmplearned?.[tmpfamily])]) {
				if (tmpnames.includes(tmpname)) { continue; }
				if (!tmptable[tmpname]) { tmpout.unknown.push(tmpname); continue; }
				tmpnames.push(tmpname);
			}
			tmpout[tmpfamily] = tmpnames;
		}
		return tmpout;
	}

	// This is the function which lays out the subskills a character knows as rows, with each one's
	// chance and time.
	//
	// An attack's time is its speed plus every weapon-speed modifier (Strength, Agility, armour and
	// a stance), never under its own minimum -- his setMartialKnowDisplayValues, sheet-worker.js
	// :99750. The other families show his table's figure as it stands, as his sheet does.
	//
	//   tmpknown        what resolveMartialKnown returned
	//   tmpknowchance   Martial Knowledge's resolved chance (0 if not held)
	//   tmpspeedmod     the character's weapon speed modifier
	export function buildMartialRows(tmpknown, tmpknowchance, tmpspeedmod) {
		var tmpout = {};
		for (const tmpfamily of Object.keys(MARTIAL_FAMILIES)) {
			var tmptable = MARTIAL_FAMILIES[tmpfamily].table;
			tmpout[tmpfamily] = (tmpknown?.[tmpfamily] ?? []).map(function (tmpname) {
				var tmprow = tmptable[tmpname];
				var tmpspeed = parseInt(tmprow.speed) || 0;
				if (tmpfamily == "attacks") {
					tmpspeed = getWeaponSpeed(tmprow.speed, tmprow.minSpeed, tmpspeedmod);
				}
				return {
					name: tmpname,
					family: tmpfamily,
					rating: tmprow.rating,
					skillMod: getMartialSkillMod(tmpfamily, tmpname),
					chance: getMartialSubskillChance(tmpknowchance, tmpfamily, tmpname),
					speed: tmpspeed,
					speedText: tmprow.speedText ?? ("" + tmprow.speed),
					minSpeed: tmprow.minSpeed ?? null,
					damage: tmprow.damage ?? "",
					damageType: MARTIAL_ATTACK_DAMAGE_TYPES[tmpname] ?? "",
					special: (tmprow.special == "None") ? "" : (tmprow.special ?? "")
				};
			});
		}
		return tmpout;
	}

	// How long each Martial Lore value takes. HIS SHEET CARRIES NO TIME FOR THEM -- martiallorevalueslist
	// has no speed column, unlike every Martial Knowledge table -- so these are the Player's Guide's
	// (pp.97-98) and the Master's Manual's (p.101), BY THE USER'S RULING of 2026-09-22 ("book").
	// Kept by hand for that reason, as MARTIAL_ATTACK_DAMAGE_TYPES is.
	//
	//   seconds  what the value itself takes, or adds to what it is joined to
	//   joins    the family it adds its seconds to when made: a Feather Block is "combined with any
	//            other block, adding +1 second", a Slam "adds +2 seconds to the other Throw". Blank
	//            means it takes its own time (Flip, "the move takes 2 seconds") or none at all.
	//   text     how the panel and the card word it; the values the books give no time for happen
	//            WITH the attack, hold or throw they go with, which is what their text says
	//
	//                        seconds joins     text
	export const MARTIAL_LORE_TIMING = {
		"Combined Attack":    { seconds: 0, joins: "",       text: "the longer of the two attacks" },
		"Stunning Head Blow": { seconds: 0, joins: "",       text: "with the two Martial Punches" },
		"Eye Gouge":          { seconds: 0, joins: "",       text: "with the two Finger Punches" },
		"Death Strike":       { seconds: 0, joins: "",       text: "with the Rake or Heel Strike" },
		"Feather Block":      { seconds: 1, joins: "blocks", text: "+1 second to the block" },
		"Crushing Hold":      { seconds: 0, joins: "",       text: "with the hold; 3d6 per full 5 seconds held" },
		"Punch Throw":        { seconds: 0, joins: "",       text: "simultaneous with the throw" },
		"Kick Throw":         { seconds: 0, joins: "",       text: "simultaneous with the throw" },
		"Slam":               { seconds: 2, joins: "throws", text: "+2 seconds to the throw" },
		"Martial Disarm":     { seconds: 0, joins: "",       text: "a contest; no time given" },
		"Flip":               { seconds: 2, joins: "",       text: "2 seconds" },
		"Wall Jump":          { seconds: 0, joins: "",       text: "with the Jump or Flying move" }
	};

	// This is the function which lays out the Martial Lore values a character knows, each rolled
	// against Martial Lore's own chance.
	//
	// HIS CODE ROLLS THEM AGAINST MARTIAL KNOWLEDGE (handleMLSkillRoll, sheet-worker.js:68651,
	// calls storeTempSkillChanceAndMessage("Martial Knowledge")). But every one of his twelve
	// modifiers is worked from Martial Lore's rating of 18, not Knowledge's 16 -- Combined Attack,
	// 17, is +5 -- and the book lists them under Martial Lore. His handler was copied from the move
	// roll above it and the skill name came with it. Martial Lore is used; UPSTREAM item 56.
	export function buildMartialLoreRows(tmpnames, tmplorechance) {
		var tmpout = [];
		for (const tmpname of parseMartialList(tmpnames)) {
			var tmprow = MARTIAL_LORE_VALUES[tmpname];
			if (!tmprow) { continue; }
			tmpout.push({
				name: tmpname,
				type: tmprow.type,
				rating: tmprow.rating,
				skillMod: tmprow.skillMod,
				chance: getMartialSubskillChance(tmplorechance, "lore", tmpname),
				speed: MARTIAL_LORE_TIMING[tmpname]?.seconds ?? 0,
				speedText: MARTIAL_LORE_TIMING[tmpname]?.text ?? "",
				special: tmprow.special
			});
		}
		return tmpout;
	}


//==================================================================================================================
// @MARKER STANCES
//==================================================================================================================

	// This is the function which reads the seconds a stance adds to or takes off an offensive
	// action's starting speed, out of his prose -- which is what his own code does
	// (handleGrappleMoveChange and setAdjustmentsForLoreWeaponSpeed look for "-2 seconds to
	// offensive" and "-1 second to offensive"). "+1 second" is read too; see the correction above.
	function readStanceSeconds(tmpspecial) {
		var tmptext = "" + (tmpspecial ?? "");
		var tmpmatch = tmptext.match(/([+-]\d+) seconds? to offensive/);
		return tmpmatch ? parseInt(tmpmatch[1]) : 0;
	}

	// This is the function which reads a stance's initiative change out of his prose, as his
	// handleIntiativeUpdate does ("Initiative -2" / "Initiative -4"). Lower acts sooner.
	function readStanceInitiative(tmpspecial) {
		var tmpmatch = ("" + (tmpspecial ?? "")).match(/Initiative ([+-]\d+)/);
		return tmpmatch ? parseInt(tmpmatch[1]) : 0;
	}

	// This is the function which says what a stance does, learned or mastered.
	//
	// Returns every number his handleStanceOn sets, renamed, plus the initiative and speed his
	// other functions read out of its prose, with the two corrections above laid over:
	//
	//   { name, mastered, melee, missile, damage, multiplier, defensive, blindFighting,
	//     blindFullDefense, initiative, seconds, extraDice, perDie, special, text }
	//
	// defensive is added to the character's defensive adjustment, where lower is better -- Flow as
	// water's -6 makes them harder to hit, Strike as wind's +2 easier. blindFighting is what the -8
	// for fighting blind becomes easier by; his sentinel of -8 ("no such stance") reads as 0.
	// Returns null for no stance.
	export function getStanceModifiers(tmpname, tmpmastered) {
		var tmpforms = MARTIAL_STANCE_MODS[tmpname];
		if (!tmpforms) { return null; }
		var tmpform = tmpmastered ? "lore" : "knowledge";
		var tmpmods = tmpforms[tmpform] ?? {};
		var tmpspecial = "" + (tmpmods.mod_special ?? "");

		var tmpout = {
			name: tmpname,
			mastered: !!tmpmastered,
			melee: parseInt(tmpmods.mod_melee) || 0,
			missile: parseInt(tmpmods.mod_missile) || 0,
			damage: parseInt(tmpmods.mod_damage) || 0,
			multiplier: parseFloat(tmpmods.mod_damage_multi) || 1,
			defensive: parseInt(tmpmods.mod_defensive) || 0,
			blindFighting: Math.max(0, parseInt(tmpmods.blind_fighting) || 0),
			blindFullDefense: ("" + (tmpmods.blind_defense ?? "")) == "Full Defensive Mod",
			initiative: readStanceInitiative(tmpspecial),
			seconds: readStanceSeconds(tmpspecial),
			// His "+1 Die Dam" / "+2 Die Dam", before the correction below replaces it.
			extraDice: /\+2 Die Dam/.test(tmpspecial) ? 2 : (/\+1 Die Dam/.test(tmpspecial) ? 1 : 0),
			perDie: 0,
			special: tmpspecial,
			text: MARTIAL_STANCES[tmpname]?.[tmpform] ?? ""
		};
		Object.assign(tmpout, MARTIAL_STANCE_CORRECTIONS[tmpname]?.[tmpform] ?? {});
		return tmpout;
	}

	// What a stance does to OTHER figures -- skills, saves, resistances -- which his sheet only
	// prints (mod_special, and the stance prose in MARTIAL_STANCES). BY THE USER'S RULING of
	// 2026-09-22 they apply automatically while the stance is held, with a toggle for each that
	// depends on something the sheet cannot see. Every figure is his own prose's, learned and
	// mastered; kept by hand because his tables carry them only as sentences.
	//
	//   skills         by exact skill name
	//   skillsNamed    every skill whose name contains the word -- "Parries" is Weapon, Shield
	//                  and Body Parry
	//   combatSkills   every skill typed Combat (his "combat skills")
	//   martialAttacks Martial Knowledge attacks and Martial Lore attack values (his "martial
	//                  know/lore skill attack rolls")
	//   saves          attribute saves, by attribute key
	//   resistances    resistances, by name
	//   holdResist     every resistance, but only against "effects which hold or affect movement"
	//                  -- applied while the character's "resisting a hold" toggle is ticked
	//   intoxication   the Drunken stance works only "after failing 1 VIT Save for intoxication"
	//                  and is lost "if more than 3 VIT Saves" (5 mastered) -- the count of failed
	//                  saves is the character's own figure; outside it the stance does NOTHING,
	//                  its to-hit and damage included
	//
	//                                      skills / skillsNamed / combatSkills / martialAttacks / saves / resistances / holdResist / intoxication
	export const MARTIAL_STANCE_BONUSES = {
		"See without eyes":  { knowledge: {}, lore: {} },
		"Flow as water":     { knowledge: { skills: { "Dodge": 30, "Feint": 30, "Sidestep": 30 } },
		                       lore:      { skills: { "Dodge": 50, "Feint": 50, "Sidestep": 50 } } },
		"Strike as wind":    { knowledge: { skills: { "Critical": 20, "Focused Attack": 20, "Perfect Shot": 20 } },
		                       lore:      { skills: { "Critical": 50, "Focused Attack": 50, "Perfect Shot": 50 } } },
		"Calm in the storm": { knowledge: { skills: { "Disarm": 10, "Trap Weapon": 10 }, skillsNamed: { "Parry": 10 },
		                                    saves: { agl: 20 }, resistances: { control: 10 }, holdResist: 25 },
		                       lore:      { skills: { "Disarm": 25, "Trap Weapon": 25 }, skillsNamed: { "Parry": 25 },
		                                    saves: { agl: 40 }, resistances: { control: 20 }, holdResist: 50 } },
		"Drunken fighting":  { knowledge: { combatSkills: 10, martialAttacks: 10, intoxication: { min: 1, max: 3 } },
		                       lore:      { combatSkills: 20, martialAttacks: 20, intoxication: { min: 1, max: 5 } } }
	};

	// This is the function which says what the stance held adds to other figures, given the two
	// things only the player can say: how many VIT saves for intoxication have been failed, and
	// whether a hold or movement effect is being resisted right now.
	//
	// Returns { active, reason, skills, skillsNamed, combatSkills, martialAttacks, saves,
	// resistances, allResistances, lines } -- active false (with the reason) when the Drunken
	// stance is outside its intoxication window, in which case nothing at all applies; lines is the
	// bonuses in words, for the panel.
	export function getStanceBonuses(tmpstance, tmpconditions) {
		var tmpout = { active: true, reason: "", skills: {}, skillsNamed: {}, combatSkills: 0, martialAttacks: 0,
		               saves: {}, resistances: {}, allResistances: 0, lines: [] };
		if (!tmpstance) { return tmpout; }
		var tmpform = MARTIAL_STANCE_BONUSES[tmpstance.name]?.[tmpstance.mastered ? "lore" : "knowledge"] ?? {};

		if (tmpform.intoxication) {
			var tmpfailed = parseInt(tmpconditions?.intoxication) || 0;
			if (tmpfailed < tmpform.intoxication.min || tmpfailed > tmpform.intoxication.max) {
				tmpout.active = false;
				tmpout.reason = (tmpfailed < tmpform.intoxication.min)
					? `${tmpstance.name} needs at least ${tmpform.intoxication.min} failed VIT save for intoxication`
					: `${tmpstance.name} is lost past ${tmpform.intoxication.max} failed VIT saves`;
				return tmpout;
			}
		}

		Object.assign(tmpout.skills, tmpform.skills ?? {});
		Object.assign(tmpout.skillsNamed, tmpform.skillsNamed ?? {});
		Object.assign(tmpout.saves, tmpform.saves ?? {});
		Object.assign(tmpout.resistances, tmpform.resistances ?? {});
		tmpout.combatSkills = parseInt(tmpform.combatSkills) || 0;
		tmpout.martialAttacks = parseInt(tmpform.martialAttacks) || 0;
		if (tmpform.holdResist && tmpconditions?.resistingHold) { tmpout.allResistances = tmpform.holdResist; }

		for (const [tmpname, tmpvalue] of Object.entries(tmpout.skills)) { tmpout.lines.push(`${tmpname} +${tmpvalue}%`); }
		for (const [tmpword, tmpvalue] of Object.entries(tmpout.skillsNamed)) { tmpout.lines.push(`every ${tmpword} +${tmpvalue}%`); }
		if (tmpout.combatSkills) { tmpout.lines.push(`combat skills +${tmpout.combatSkills}%`); }
		if (tmpout.martialAttacks) { tmpout.lines.push(`martial attacks +${tmpout.martialAttacks}%`); }
		for (const [tmpkey, tmpvalue] of Object.entries(tmpout.saves)) { tmpout.lines.push(`${tmpkey.toUpperCase()} saves +${tmpvalue}%`); }
		for (const [tmpname, tmpvalue] of Object.entries(tmpout.resistances)) {
			tmpout.lines.push(`${tmpname.charAt(0).toUpperCase() + tmpname.slice(1)} Resistance +${tmpvalue}%`);
		}
		if (tmpform.holdResist) {
			tmpout.lines.push(`every resistance +${tmpform.holdResist}% against holds and movement effects`
				+ (tmpout.allResistances ? " (applied now)" : " (tick when resisting one)"));
		}
		return tmpout;
	}

	// This is the function which gives what the stance held adds to one skill, by its name and its
	// types (a character's skill item carries a types list; a creature's skill has none, so only the
	// by-name bonuses reach it). A skill that qualifies twice -- a Combat skill also named -- takes
	// both, since his prose lists them as separate bonuses.
	export function getStanceSkillBonus(tmpbonuses, tmpskillname, tmpskilltypes) {
		if (!tmpbonuses || !tmpbonuses.active) { return 0; }
		var tmpname = "" + (tmpskillname ?? "");
		var tmpadd = parseInt(tmpbonuses.skills?.[tmpname]) || 0;
		for (const [tmpword, tmpvalue] of Object.entries(tmpbonuses.skillsNamed ?? {})) {
			if (tmpname.includes(tmpword)) { tmpadd = tmpadd + (parseInt(tmpvalue) || 0); }
		}
		if ((tmpskilltypes ?? []).includes("Combat")) { tmpadd = tmpadd + (parseInt(tmpbonuses.combatSkills) || 0); }
		return tmpadd;
	}


//==================================================================================================================
// @MARKER MOVES
//==================================================================================================================

	// This is the function which works out what the moves a character has MADE add to what they do
	// next -- his handleMartialModifierSet (sheet-worker.js:68113), with the corrections above.
	//
	// Only a move whose skill roll succeeded counts; that is what tmpactive lists. His combination
	// rule is kept: without Martial Lore, Spinning cannot go with Jump or Flying, and if both were
	// made, ALL of them are void -- his code writes "Illegal Combo" for each rather than keeping one.
	// Martial Lore lifts the rule (his martialLoreOverride; the book: "A Martial Lore practitioner
	// can combine Spinning with Flying or Jumping").
	//
	// Jump and Flying together are NOT refused. The book says Flying "replaces" Jump, but his code
	// has no such test and his move prose only forbids Spinning with either, so his sheet is
	// followed and both apply.
	//
	// Returns
	//   { melee, damage, multiplier, extraDice, perDie, seconds, strength, noDefense,
	//     martialOnly: { seconds, strength }, illegal: [names], made: [names], special: [strings] }
	// where martialOnly holds what applies to a martial attack but not to a weapon (Snap, Double
	// Attack), and strength is "tension" or "" (Snap's "no Strength" is martial-only).
	export function getMoveModifiers(tmpactive, tmphaslore) {
		var tmpmade = parseMartialList(tmpactive).filter(n => MARTIAL_MOVE_MODS[n] || MARTIAL_MOVES[n]);
		var tmpout = {
			melee: 0, damage: 0, multiplier: 1, extraDice: 0, perDie: 0, seconds: 0, strength: "",
			noDefense: false, martialOnly: { seconds: 0, strength: "" },
			illegal: [], made: tmpmade, special: []
		};

		var tmpjumporfly = tmpmade.includes("Jump") || tmpmade.includes("Flying");
		var tmpspinning = tmpmade.includes("Spinning");
		var tmpmultipliers = [];

		for (const tmpname of tmpmade) {
			var tmphis = MARTIAL_MOVE_MODS[tmpname] ?? { comboGate: "", special: "" };
			var tmpgate = tmphis.comboGate;
			if (!tmphaslore && ((tmpgate == "spinning" && tmpspinning) || (tmpgate == "jumpOrFly" && tmpjumporfly))) {
				tmpout.illegal.push(tmpname);
				continue;
			}

			var tmpmove = MARTIAL_MOVE_CORRECTIONS[tmpname];
			if (tmpmove) {
				tmpout.melee = tmpout.melee + tmpmove.melee;
				tmpout.damage = tmpout.damage + tmpmove.damage;
				if (tmpmove.multiplier > 1) { tmpmultipliers.push(tmpmove.multiplier); }
				tmpout.extraDice = tmpout.extraDice + tmpmove.extraDice;
				tmpout.perDie = tmpout.perDie + tmpmove.perDie;
				if (tmpmove.martialOnly) {
					tmpout.martialOnly.seconds = tmpout.martialOnly.seconds + tmpmove.seconds;
					if (tmpmove.strength) { tmpout.martialOnly.strength = tmpmove.strength; }
				} else {
					tmpout.seconds = tmpout.seconds + tmpmove.seconds;
					if (tmpmove.strength) { tmpout.strength = tmpmove.strength; }
				}
			}

			// Immoveable Stance: the defensive adjustment is lost while it is held, and the amount the
			// roll was made by goes to any Strength contest. His "No Defense" override.
			if (("" + tmphis.special).includes("No Defense")) { tmpout.noDefense = true; }

			var tmptext = MARTIAL_MOVES[tmpname]?.special ?? "";
			if (tmptext) { tmpout.special.push(`${tmpname}: ${tmptext}`); }
		}

		tmpout.multiplier = combineDamageMultipliers(tmpmultipliers);
		return tmpout;
	}


//==================================================================================================================
// @MARKER MARTIAL LORE VALUES
//==================================================================================================================

	// This is the function which works out what the Martial Lore values a character has MADE add,
	// from his handleMartialLoreModifierSet (sheet-worker.js:68276). Only Flip changes a number --
	// -4 to be hit, and no attack while flipping. The rest are what his sheet prints, and are
	// returned as that line so the card can print it too.
	//
	// His list of which were made reads martial5_MOVE_success where martial5_lore_success is meant
	// (line 68280), so the fifth Lore value on his sheet takes its success from the fifth MOVE.
	// Each value's own success is used here.
	//
	// A made Feather Block or Slam also adds its seconds to the next block or throw
	// (MARTIAL_LORE_TIMING); those come back as blockSeconds and throwSeconds.
	export function getLoreValueModifiers(tmpactive) {
		var tmpout = { defensive: 0, noAttack: false, made: [], special: [], blockSeconds: 0, throwSeconds: 0 };
		for (const tmpname of parseMartialList(tmpactive)) {
			var tmpmods = MARTIAL_LORE_MODS[tmpname];
			if (!tmpmods) { continue; }
			tmpout.made.push(tmpname);
			tmpout.defensive = tmpout.defensive + (parseInt(tmpmods.defensive) || 0);
			if (("" + tmpmods.special).includes("No Attack")) { tmpout.noAttack = true; }
			tmpout.special.push(`${tmpname}: ${MARTIAL_LORE_VALUES[tmpname]?.special ?? tmpmods.special}`);
			var tmptiming = MARTIAL_LORE_TIMING[tmpname];
			if (tmptiming?.joins == "blocks") { tmpout.blockSeconds = tmpout.blockSeconds + tmptiming.seconds; }
			if (tmptiming?.joins == "throws") { tmpout.throwSeconds = tmpout.throwSeconds + tmptiming.seconds; }
		}
		return tmpout;
	}

	// What each full 25% of Martial Lore is worth when fighting blind or in the dark. THE BOOK'S
	// FIGURES, BY THE USER'S RULING of 2026-09-22 ("book"): "For every full 25% of the Martial Lore
	// skill chance, the practitioner reduces his penalties when fighting blind or in the dark: +2 to
	// hit with melee and missile weapons, +1 damage and +5% to combat skills" (Player's Guide p.97).
	// His setMartialLoreDisplayValues (sheet-worker.js:100370) gives one point of to-hit per level
	// and nothing else -- MARTIAL_LORE_BLIND, still generated and still what "per level" is counted in.
	//
	//                           toHit damage skills
	export const MARTIAL_LORE_BLIND_BOOK = { toHit: 2, damage: 1, skills: 5 };

	// This is the function which gives Martial Lore's blind fighting on its own, per level of the
	// skill (a full MARTIAL_LORE_BLIND.percentPerLevel, 25%), and the defensive adjustment kept when
	// blind from 100%.
	//
	// The to-hit is an OFFSET against the blindness penalty -- "the practitioner does not gain
	// additional bonuses once the blindness penalties are negated" -- so the Situation Mods cap it at
	// the penalty it offsets (resolveSituationalMods). It is the only one of the three that is also
	// the See without eyes stance's figure, and the better of the two is used, as his handleMeleeSet
	// takes the better of stance and lore.
	//
	// His blind DEFENCE test compares against "Full Defense Mod" where it writes "Full Defensive
	// Mod" (setBodyHeaderValues, line 102808), so on his sheet 100% Martial Lore never actually
	// keeps a blind character's defence. The intent is plain from the value he writes; used here.
	//
	// Returns { blindFighting, damage, skills, fullDefense } -- blindFighting being the to-hit.
	export function getLoreBlindFighting(tmplorechance) {
		var tmpchance = parseInt(tmplorechance) || 0;
		if (tmpchance <= 0) { return { blindFighting: 0, damage: 0, skills: 0, fullDefense: false }; }
		var tmplevels = Math.floor(tmpchance / MARTIAL_LORE_BLIND.percentPerLevel);
		return {
			blindFighting: tmplevels * MARTIAL_LORE_BLIND_BOOK.toHit,
			damage: tmplevels * MARTIAL_LORE_BLIND_BOOK.damage,
			skills: tmplevels * MARTIAL_LORE_BLIND_BOOK.skills,
			fullDefense: tmpchance >= MARTIAL_LORE_BLIND.fullDefenseAt
		};
	}


//==================================================================================================================
// @MARKER MARTIAL STATE
//==================================================================================================================

	// This is the function which puts everything a character has in play together: the stance held,
	// the moves made, the Martial Lore values made. It is what the character model stores as
	// system.martial.state and what every attack reads.
	//
	//   tmpinput = {
	//       stance:        the stance held, or ""
	//       mastered:      the stances mastered with Martial Lore (his comma-separated string)
	//       activeMoves:   the moves made (comma-separated)
	//       activeLore:    the Martial Lore values made (comma-separated)
	//       hasLore:       whether the character holds Martial Lore (lifts the combination rule)
	//       loreChance:    Martial Lore's chance, for blind fighting
	//   }
	//
	// Returns { stance, moves, lore, defense: { adjust, noDefense, reasons }, initiative, seconds,
	//           blind: { blindFighting, fullDefense, inStance } }.
	//
	// defense.adjust, initiative and seconds are CHARACTER-WIDE: the character model folds them into
	// combat.defensiveAdjust, combat.initiativeMod and combat.weaponSpeedMod, so every attack against
	// the character, the initiative roll and every weapon's time follow them without being told.
	// blind is his handleMeleeSet's pair of blind-fighting figures, the better of stance and Lore.
	//
	// Two more inputs, the player's own: intoxication (VIT saves failed for intoxication, for the
	// Drunken stance) and resistingHold (a hold or movement effect is being resisted now, for Calm
	// in the storm). The stance's bonuses to skills, saves and resistances come back as bonuses; a
	// Drunken stance outside its window is still HELD (so it still bars the special engagements)
	// but adds nothing at all.
	export function resolveMartialState(tmpinput) {
		var tmpstance = tmpinput?.stance ? getStanceModifiers(tmpinput.stance,
			hasMartialName(tmpinput.mastered, tmpinput.stance)) : null;
		var tmpbonuses = getStanceBonuses(tmpstance, { intoxication: tmpinput?.intoxication,
			resistingHold: tmpinput?.resistingHold });
		if (tmpstance && !tmpbonuses.active) {
			tmpstance = { ...tmpstance, melee: 0, missile: 0, damage: 0, perDie: 0, extraDice: 0, multiplier: 1,
			              inactive: tmpbonuses.reason };
		}
		var tmpmoves = getMoveModifiers(tmpinput?.activeMoves, !!tmpinput?.hasLore);
		var tmplore = getLoreValueModifiers(tmpinput?.activeLore);
		var tmploreblind = getLoreBlindFighting(tmpinput?.loreChance);

		var tmpreasons = [];
		var tmpadjust = 0;
		if (tmpstance && tmpstance.defensive) {
			tmpadjust = tmpadjust + tmpstance.defensive;
			tmpreasons.push(`${tmpstance.name} ${tmpstance.defensive > 0 ? "+" : ""}${tmpstance.defensive}`);
		}
		if (tmplore.defensive) {
			tmpadjust = tmpadjust + tmplore.defensive;
			tmpreasons.push(`Flip ${tmplore.defensive}`);
		}
		if (tmpmoves.noDefense) { tmpreasons.push("Immoveable Stance: no defence"); }

		return {
			stance: tmpstance,
			moves: tmpmoves,
			lore: tmplore,
			bonuses: tmpbonuses,
			defense: { adjust: tmpadjust, noDefense: tmpmoves.noDefense, reasons: tmpreasons },
			initiative: tmpstance ? tmpstance.initiative : 0,
			seconds: tmpstance ? tmpstance.seconds : 0,
			// His handleMeleeSet takes the better of the two; with no stance his sentinel is -8,
			// so Martial Lore's figure is what counts. See without eyes is a MELEE stance ("reduced
			// to -4 melee"), so a missile's offset is Martial Lore's alone -- the book gives Lore's
			// to "melee and missile weapons". Damage and combat skills are Lore's only.
			blind: {
				blindFighting: Math.max(tmpstance ? tmpstance.blindFighting : 0, tmploreblind.blindFighting),
				missileBlindFighting: tmploreblind.blindFighting,
				damage: tmploreblind.damage,
				skills: tmploreblind.skills,
				fullDefense: !!(tmpstance?.blindFullDefense || tmploreblind.fullDefense),
				inStance: !!tmpstance
			}
		};
	}


	// This is the function which works out everything a martial artist's panel and attacks read,
	// for EITHER actor type: what is known, what is in play, the state, and the rows with their
	// chances and times. The two data models differ only in where the two skills' chances come from
	// (a character's skill items, a creature's flat stat-block percentages) and in how they lay the
	// character-wide figures onto their own combat block, so those stay with them.
	//
	//   tmpmartial  the actor's system.martial (his comma-separated strings, and the two conditions)
	//   tmpskills = {
	//       know:           { held, chance } for Martial Knowledge
	//       lore:           { held, chance } for Martial Lore
	//       weaponSpeedMod: the actor's weapon speed modifier BEFORE the stance's seconds
	//   }
	//
	// Returns { known, state, rows, loreRows, stanceRows, activeMoveNames, activeLoreNames,
	// standFromProne }. Nothing applies without Martial Knowledge held: a stance or move written on
	// an actor who does not hold it is shown and does nothing.
	export function deriveMartialArts(tmpmartial, tmpskills) {
		var tmpm = tmpmartial ?? {};
		var tmpknow = tmpskills?.know ?? { held: false, chance: 0 };
		var tmplore = tmpskills?.lore ?? { held: false, chance: 0 };
		var tmpout = {};

		// What is known: the discipline's list and anything learned beyond it.
		tmpout.known = resolveMartialKnown(tmpm.discipline, {
			attacks: tmpm.learnedAttacks, blocks: tmpm.learnedBlocks,
			holds: tmpm.learnedHolds, moves: tmpm.learnedMoves, throws: tmpm.learnedThrows
		});

		// What is in play, held to what is actually known: a stance must have been learned to be
		// held, and a move or Lore value must be one the actor has.
		var tmpstances = parseMartialList(tmpm.stances).filter(tmpname => MARTIAL_STANCES[tmpname]);
		var tmpstance = tmpstances.includes(tmpm.activeStance) ? tmpm.activeStance : "";
		var tmpmoves = parseMartialList(tmpm.activeMoves).filter(tmpname => tmpout.known.moves.includes(tmpname));
		var tmplorevalues = parseMartialList(tmpm.activeLoreValues).filter(tmpname => hasMartialName(tmpm.loreValues, tmpname));

		tmpout.state = resolveMartialState({
			stance:        tmpknow.held ? tmpstance : "",
			mastered:      tmpm.masteredStances,
			activeMoves:   tmpknow.held ? tmpmoves.join(",") : "",
			activeLore:    tmplore.held ? tmplorevalues.join(",") : "",
			hasLore:       tmplore.held,
			loreChance:    tmplore.chance,
			intoxication:  tmpm.intoxication,
			resistingHold: tmpm.resistingHold
		});

		// The rows, each with its chance and time. A martial attack is an offensive action, so its
		// time takes the stance's seconds on top of the actor's own weapon speed modifier. The
		// Drunken stance's "+10% to martial know/lore skill attack rolls" lands on the attack rows and
		// the Martial Lore attack values.
		var tmpspeedmod = (parseInt(tmpskills?.weaponSpeedMod) || 0) + tmpout.state.seconds;
		tmpout.rows = buildMartialRows(tmpout.known, tmpknow.chance, tmpspeedmod);
		tmpout.loreRows = buildMartialLoreRows(tmpm.loreValues, tmplore.chance);
		var tmpattackbonus = tmpout.state.bonuses.active ? (parseInt(tmpout.state.bonuses.martialAttacks) || 0) : 0;
		if (tmpattackbonus) {
			for (const tmprow of tmpout.rows.attacks ?? []) { if (tmprow.chance > 0) { tmprow.chance = tmprow.chance + tmpattackbonus; } }
			for (const tmprow of tmpout.loreRows) { if (tmprow.type == "Attack" && tmprow.chance > 0) { tmprow.chance = tmprow.chance + tmpattackbonus; } }
		}
		tmpout.stanceRows = tmpstances.map(tmpname => ({
			name: tmpname,
			mastered: hasMartialName(tmpm.masteredStances, tmpname),
			held: tmpname == tmpstance,
			text: MARTIAL_STANCES[tmpname][hasMartialName(tmpm.masteredStances, tmpname) ? "lore" : "knowledge"]
		}));
		tmpout.activeMoveNames = tmpmoves;
		tmpout.activeLoreNames = tmplorevalues;

		// Every martial artist gets up quickly: "All martial artists take only 1-3 seconds to jump to
		// their feet rather than the usual 2-7" (p.97), his martial_arts_stand_from_prone.
		tmpout.standFromProne = tmpknow.held ? "Jump to feet (1-3 seconds)" : "Stand up (2-7 seconds)";
		return tmpout;
	}


//==================================================================================================================
// @MARKER ATTACK MODIFIERS
//==================================================================================================================

	// This is the function which gives what the martial state adds to ONE attack -- a weapon attack
	// or a martial one -- in the same { label, value } shape getToHitModifiers lists its entries in,
	// so the caller can append these to that list and the chat card shows them by name.
	//
	//   tmpstate   what resolveMartialState returned (system.martial.state on a character)
	//   tmpinput = {
	//       mode:           "thrust" | "cut" | "smash" | "missile"
	//       martialAttack:  true for a martial attack (a punch, a kick), false for a weapon
	//   }
	//
	// Returns {
	//   list:      [{ label, value }]    to-hit entries; add to the attack's modifier list
	//   total:     their sum
	//   damage:    { flat, extraDice, perDie, multiplier, strength, list: [{ label, value }] }
	//   seconds:   added to THIS attack's time (moves); a stance's speed is NOT here, being already
	//              in the character's weapon speed modifier
	//   noAttack:  true when something held forbids attacking at all; noAttackReason says what
	//   special:   lines of his prose for the card
	// }
	//
	// MISSILE ATTACKS take only the stance's missile to-hit. His handlePhysicalAttacks zeroes every
	// martial move modifier and the stance's damage on its missile branch (sheet-worker.js:64627
	// onward), so a Strike as wind archer is +3 to hit and not +3 damage.
	//
	// Blind fighting is NOT in here. It only offsets the situational penalty for fighting blind, so
	// it belongs with that penalty; the character model hands it to the Situation Mods through
	// combat.martialBlind, where his handleMeleeSet applies it.
	export function getMartialAttackModifiers(tmpstate, tmpinput) {
		var tmpout = {
			list: [], total: 0,
			damage: { flat: 0, extraDice: 0, perDie: 0, multiplier: 1, strength: "", list: [] },
			seconds: 0, noAttack: false, noAttackReason: "", special: []
		};
		if (!tmpstate) { return tmpout; }

		var tmpmissile = !MELEE_MODES.includes(tmpinput?.mode) && !tmpinput?.martialAttack;
		var tmpmartial = !!tmpinput?.martialAttack;
		var tmpstance = tmpstate.stance;
		var tmpmoves = tmpstate.moves ?? getMoveModifiers("", false);
		var tmpmultipliers = [];

		// The stance.
		if (tmpstance) {
			var tmphit = tmpmissile ? tmpstance.missile : tmpstance.melee;
			if (tmphit) { tmpout.list.push({ label: `Stance (${tmpstance.name})`, value: tmphit }); }
			if (!tmpmissile) {
				if (tmpstance.damage) { tmpout.damage.list.push({ label: `stance`, value: tmpstance.damage }); }
				tmpout.damage.flat = tmpout.damage.flat + tmpstance.damage;
				tmpout.damage.perDie = tmpout.damage.perDie + tmpstance.perDie;
				tmpout.damage.extraDice = tmpout.damage.extraDice + tmpstance.extraDice;
				if (tmpstance.multiplier > 1) { tmpmultipliers.push(tmpstance.multiplier); }
			}
			if (tmpstance.special) { tmpout.special.push(`${tmpstance.name}: ${tmpstance.special}`); }
		}

		// The moves, melee and martial attacks only.
		if (!tmpmissile) {
			if (tmpmoves.melee) { tmpout.list.push({ label: "Martial Moves", value: tmpmoves.melee }); }
			if (tmpmoves.damage) { tmpout.damage.list.push({ label: "moves", value: tmpmoves.damage }); }
			tmpout.damage.flat = tmpout.damage.flat + tmpmoves.damage;
			tmpout.damage.extraDice = tmpout.damage.extraDice + tmpmoves.extraDice;
			tmpout.damage.perDie = tmpout.damage.perDie + tmpmoves.perDie;
			if (tmpmoves.multiplier > 1) { tmpmultipliers.push(tmpmoves.multiplier); }
			tmpout.seconds = tmpout.seconds + tmpmoves.seconds;
			tmpout.damage.strength = tmpmoves.strength;
			if (tmpmartial) {
				tmpout.seconds = tmpout.seconds + tmpmoves.martialOnly.seconds;
				// Snap wins over Tension: "no Strength adjustment can be applied" is absolute.
				if (tmpmoves.martialOnly.strength) { tmpout.damage.strength = tmpmoves.martialOnly.strength; }
			}
			tmpout.special.push(...tmpmoves.special);
		}
		if (tmpmoves.illegal.length) {
			tmpout.special.push(`Illegal combination, no effect: ${tmpmoves.illegal.join(", ")}`);
		}

		// Martial Lore values: only Flip forbids anything.
		var tmplore = tmpstate.lore ?? { noAttack: false, special: [] };
		if (tmplore.noAttack) {
			tmpout.noAttack = true;
			tmpout.noAttackReason = "Flip: no attack while flipping";
		}
		tmpout.special.push(...(tmplore.special ?? []));

		tmpout.damage.multiplier = combineDamageMultipliers(tmpmultipliers);
		tmpout.total = tmpout.list.reduce((tmpsum, tmpm) => tmpsum + tmpm.value, 0);
		return tmpout;
	}

	// This is the function which adds dice to a damage string -- a Jump's extra die, a Drunken
	// stance's. "2d4+2" with one more is "3d4+2". His rule is kept: "cannot add dice to '1'
	// damage", so a flat figure comes back unchanged.
	export function addMartialDice(tmpdice, tmpextra) {
		var tmptext = ("" + (tmpdice ?? "")).trim();
		var tmpadd = parseInt(tmpextra) || 0;
		var tmpmatch = tmptext.match(/^(\d+)d(\d+)(.*)$/);
		if (!tmpadd || !tmpmatch) { return tmptext; }
		return `${Math.max(0, parseInt(tmpmatch[1]) + tmpadd)}d${tmpmatch[2]}${tmpmatch[3]}`;
	}

	// This is the function which gives the Strength damage modifier for an attack under a move.
	//
	//   tension  -- his "STR Dam bonus x2/STR penalty halved". With a weapon in both hands the book
	//               makes it x3, "tripled (not quadrupled)" (p.97); his weapon path tests two hands
	//               first and never reaches Tension, which gives x2. The book's note is explicit
	//               about exactly that case, so it is followed.
	//   snap     -- no Strength at all, "no Strength adjustment can be applied to the martial attack".
	//   ""       -- two hands double a bonus and halve a penalty, as getStrengthDamageMod does.
	//
	// parseInt truncates toward zero, as his code does, so -3 halves to -1.
	export function getMartialStrengthDamage(tmpstrdamage, tmpstrength, tmptwohanded) {
		var tmpmod = parseInt(tmpstrdamage) || 0;
		if (tmpstrength == "snap") { return 0; }
		if (tmpstrength == "tension") {
			if (tmpmod > 0) { return tmpmod * (tmptwohanded ? 3 : 2); }
			if (tmpmod < 0) { return parseInt(tmpmod / 2); }
			return 0;
		}
		if (tmptwohanded) {
			if (tmpmod > 0) { return tmpmod * 2; }
			if (tmpmod < 0) { return parseInt(tmpmod / 2); }
		}
		return tmpmod;
	}

	// This is the function which gives a WEAPON attack's Strength damage under whatever move is
	// made. Strength is melee only -- a missile gets none, whatever the move says, which
	// getMartialStrengthDamage does not itself check -- and with no move made this is exactly
	// getStrengthDamageMod in combat-rules.mjs, so the weapon attack can call it unconditionally.
	export function getWeaponMartialStrength(tmpstrdamage, tmpmode, tmpstrength, tmptwohanded) {
		if (!MELEE_MODES.includes(tmpmode)) { return 0; }
		return getMartialStrengthDamage(tmpstrdamage, tmpstrength, tmptwohanded);
	}


//==================================================================================================================
// @MARKER MARTIAL ATTACK
//==================================================================================================================

	// This is the function which works out a martial attack's damage from the dice already rolled.
	// Ported from getMartialDamageDetails (sheet-worker.js:66718), in his order:
	//   1. the dice, plus Strength, plus every flat modifier, plus anything per die rolled
	//   2. floored at zero
	//   3. multiplied -- never past x3
	//   4. HALVED, rounding up, if the Martial Knowledge roll for the attack was failed or a called
	//      shot missed -- the book's "1/2 damage is still done if the roll to hit was successful"
	//
	//   tmpinput = {
	//       rolled:      what the dice came to
	//       dice:        the dice string rolled, for the per-die bonuses
	//       strength:    the Strength damage modifier, already through getMartialStrengthDamage
	//       flat:        every other flat modifier (martial, stance, situational)
	//       perDie:      damage per die rolled
	//       multipliers: [x2, ...] -- a Flying move, a Scissor Strike landing both blows
	//       skillMade:   the Martial Knowledge roll succeeded
	//       halve:       any other reason to halve (a called shot that missed)
	//   }
	//
	// His halving is parseInt((damage*0.5)+0.9), which rounds a half up.
	export function resolveMartialAttackDamage(tmpinput) {
		var tmpdice = getNumberOfDice(tmpinput?.dice);
		var tmpperdie = (parseInt(tmpinput?.perDie) || 0) * tmpdice;
		var tmpbase = (parseInt(tmpinput?.rolled) || 0) + (parseInt(tmpinput?.strength) || 0)
		            + (parseInt(tmpinput?.flat) || 0) + tmpperdie;
		if (tmpbase < 0) { tmpbase = 0; }

		var tmpmultiplier = combineDamageMultipliers(tmpinput?.multipliers ?? []);
		var tmptotal = tmpbase * tmpmultiplier;
		var tmphalved = !tmpinput?.skillMade || !!tmpinput?.halve;
		if (tmphalved) { tmptotal = parseInt((tmptotal * 0.5) + 0.9) || 0; }

		return { base: tmpbase, perDie: tmpperdie, multiplier: tmpmultiplier, halved: tmphalved,
		         total: parseInt(tmptotal) || 0 };
	}

	// This is the function which says whether a Scissor Strike doubles its damage: it is two
	// punches, one at the arm and one at the forearm, and "if both are successful and the Scissor
	// Strike skill roll is made, then damage is doubled for both areas" (p.96). His code is the
	// same: tmpMADamMulti+1.0 when skillSuccess && firstHit && secondHit.
	export function isScissorStrikeDoubled(tmpskillmade, tmpfirsthit, tmpsecondhit) {
		return !!(tmpskillmade && tmpfirsthit && tmpsecondhit);
	}

	// This is the function which reads a touch roll -- what a hold or a throw needs before its skill
	// roll counts. His handleTouchAttack (sheet-worker.js:67731): the d20 plus the modifier, 10 or
	// better, and a natural 1 always fails whatever is added to it.
	export function resolveMartialTouch(tmpnatural, tmpmodifier) {
		var tmproll = parseInt(tmpnatural) || 0;
		var tmptotal = tmproll + (parseInt(tmpmodifier) || 0);
		return { natural: tmproll, total: tmptotal, touched: (tmproll != 1) && (tmptotal > 9) };
	}

	// This is the function which says what a failed move costs, from his handleMoveSkillRoll
	// (sheet-worker.js:68011): Jump, Flying and Sweep need an Agility save to stay standing, and a
	// fall costs 1d6+1 seconds to stand; a failed Spinning needs an Agility save or 1d3 seconds are
	// lost. The dice are passed in: saveRoll d100, proneRoll d6, lossRoll d3.
	export function resolveFailedMove(tmpname, tmpaglsave, tmpdice) {
		var tmpsave = parseInt(tmpaglsave) || 0;
		var tmproll = parseInt(tmpdice?.saveRoll) || 0;
		if (["Jump", "Flying", "Sweep"].includes(tmpname)) {
			if (tmproll > tmpsave) {
				var tmpprone = (parseInt(tmpdice?.proneRoll) || 0) + 1;
				return { saved: false, secondsLost: tmpprone,
				         text: `Agility save failed: falls prone, ${tmpprone} second(s) to stand.` };
			}
			return { saved: true, secondsLost: 0, text: "Agility save made: stays standing." };
		}
		if (tmpname == "Spinning") {
			if (tmproll > tmpsave) {
				var tmploss = parseInt(tmpdice?.lossRoll) || 0;
				return { saved: false, secondsLost: tmploss, text: `Agility save failed: loses ${tmploss} second(s).` };
			}
			return { saved: true, secondsLost: 0, text: "Agility save made." };
		}
		return { saved: true, secondsLost: 0, text: "" };
	}


//==================================================================================================================
// @MARKER LEARNING
//==================================================================================================================
// Every way his sheet lets a character add to what it knows, each one roll against one chance.
// Ported as the pure outcome of that roll, in his own early-exit order, the same shape
// resolveMissileComboAcquisition in combat-rules.mjs takes: the caller rolls, reads the result,
// and writes `list` back only on success.

	// This is the function which learns a stance with Martial Knowledge. His handleMartialKnowStance
	// (sheet-worker.js:89096): nothing picked, already known, then pass or fail against the chance.
	export function resolveLearnStance(tmpinput) {
		var tmpstance = ("" + (tmpinput?.stance ?? "")).trim();
		var tmpchance = parseInt(tmpinput?.chance) || 0;
		var tmproll = parseInt(tmpinput?.roll) || 0;
		var tmpout = { outcome: "", reason: "", list: tmpinput?.list ?? "" };
		if (!tmpstance || !MARTIAL_STANCES[tmpstance]) {
			tmpout.outcome = "noStance";
			tmpout.reason = "No stance was picked. Nothing done.";
		} else if (hasMartialName(tmpinput?.list, tmpstance)) {
			tmpout.outcome = "alreadyKnown";
			tmpout.reason = `${tmpstance} is already known. Nothing done.`;
		} else if (tmproll > tmpchance) {
			tmpout.outcome = "failed";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% chance. Failed.`;
		} else {
			tmpout.outcome = "succeeded";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% chance. Learned.`;
			tmpout.list = parseMartialList(tmpinput?.list).concat(tmpstance).join(",");
		}
		return tmpout;
	}

	// This is the function which masters a stance with Martial Lore. His handleMartialLoreStance
	// (sheet-worker.js:89167): no Martial Lore, nothing picked, not yet learned, already mastered,
	// then the roll. A stance must be learned with Martial Knowledge before it can be mastered.
	export function resolveMasterStance(tmpinput) {
		var tmpstance = ("" + (tmpinput?.stance ?? "")).trim();
		var tmpchance = parseInt(tmpinput?.chance) || 0;
		var tmproll = parseInt(tmpinput?.roll) || 0;
		var tmpout = { outcome: "", reason: "", list: tmpinput?.mastered ?? "" };
		if (!tmpinput?.hasLore) {
			tmpout.outcome = "noLore";
			tmpout.reason = "Martial Lore is needed to master a stance. Nothing done.";
		} else if (!tmpstance || !MARTIAL_STANCES[tmpstance]) {
			tmpout.outcome = "noStance";
			tmpout.reason = "No stance was picked. Nothing done.";
		} else if (!hasMartialName(tmpinput?.known, tmpstance)) {
			tmpout.outcome = "notLearned";
			tmpout.reason = `${tmpstance} must be learned with Martial Knowledge before it can be mastered.`;
		} else if (hasMartialName(tmpinput?.mastered, tmpstance)) {
			tmpout.outcome = "alreadyMastered";
			tmpout.reason = `${tmpstance} is already mastered. Nothing done.`;
		} else if (tmproll > tmpchance) {
			tmpout.outcome = "failed";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% chance. Failed.`;
		} else {
			tmpout.outcome = "succeeded";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% chance. Mastered.`;
			tmpout.list = parseMartialList(tmpinput?.mastered).concat(tmpstance).join(",");
		}
		return tmpout;
	}

	// This is the function which learns a Martial Knowledge subskill from outside the character's
	// discipline, with a Martial Lore roll -- his handleMartialLoreAddMartialKnowValueRoll
	// (sheet-worker.js:68430); the book: "a Martial Lore skill roll to learn the attack, block, hold
	// or move can be made when the martial artist is exposed to Martial Knowledge disciplines other
	// than his chosen one" (p.97).
	//
	//   { family, name, chance (Martial Lore), known (the family's names), learned (the stored
	//     string for that family), roll }
	export function resolveLearnSubskill(tmpinput) {
		var tmpfamily = tmpinput?.family;
		var tmpname = ("" + (tmpinput?.name ?? "")).trim();
		var tmpchance = parseInt(tmpinput?.chance) || 0;
		var tmproll = parseInt(tmpinput?.roll) || 0;
		var tmpout = { outcome: "", reason: "", list: tmpinput?.learned ?? "" };
		if (!MARTIAL_FAMILIES[tmpfamily] || !MARTIAL_FAMILIES[tmpfamily].table[tmpname]) {
			tmpout.outcome = "noValue";
			tmpout.reason = "No Martial Knowledge subskill was picked. Nothing done.";
		} else if ((tmpinput?.known ?? []).includes(tmpname)) {
			tmpout.outcome = "alreadyKnown";
			tmpout.reason = `${tmpname} is already known. Nothing done.`;
		} else if (tmproll > tmpchance) {
			tmpout.outcome = "failed";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% Martial Lore chance. Failed.`;
		} else {
			tmpout.outcome = "succeeded";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% Martial Lore chance. Learned.`;
			tmpout.list = parseMartialList(tmpinput?.learned).concat(tmpname).join(",");
		}
		return tmpout;
	}

	// This is the function which learns one of the twelve Martial Lore values -- his
	// handleMartialLoreAddValueRoll (sheet-worker.js:68559): already known, nothing picked, then
	// the Martial Lore roll.
	export function resolveLearnLoreValue(tmpinput) {
		var tmpname = ("" + (tmpinput?.name ?? "")).trim();
		var tmpchance = parseInt(tmpinput?.chance) || 0;
		var tmproll = parseInt(tmpinput?.roll) || 0;
		var tmpout = { outcome: "", reason: "", list: tmpinput?.list ?? "" };
		if (tmpname && hasMartialName(tmpinput?.list, tmpname)) {
			tmpout.outcome = "alreadyKnown";
			tmpout.reason = `${tmpname} is already known. Nothing done.`;
		} else if (!tmpname || !MARTIAL_LORE_VALUES[tmpname]) {
			tmpout.outcome = "noValue";
			tmpout.reason = "No Martial Lore value was picked. Nothing done.";
		} else if (tmproll > tmpchance) {
			tmpout.outcome = "failed";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% chance. Failed.`;
		} else {
			tmpout.outcome = "succeeded";
			tmpout.reason = `Rolled ${tmproll}% against a ${tmpchance}% chance. Learned.`;
			tmpout.list = parseMartialList(tmpinput?.list).concat(tmpname).join(",");
		}
		return tmpout;
	}

// @MARKER ADD NEW martial arts functions HERE
// @END (CODE)
