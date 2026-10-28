// @START (CODE)
// @MARKER WEAPON CHOICES RULES
//==================================================================================================================
// The seven weapon choices of his Updater: Add Weapon Proficiency, and the weapons (or projectiles) named for
// Weapon Lore, Missile Lore, Second Weapon Knowledge, Second Weapon Lore, Projectile Knowledge and Projectile
// Lore. Nothing here talks to Foundry; the dice arrive as arguments and the window is
// module/apps/weapon-choices.mjs.
//
// Ported from:
//     setWeaponProfSheet ............. sheet-worker.js:49807   which proficiency panel (initial / normal)
//     setWeaponLoreSheet and the five beside it ........ 49825-50120   the refusal panels and the slots
//     setWeaponProfTotals / getWeaponProfPenalty ....... 83369 / 83390  total, used, available, the penalty
//     handleFreeWeaponProf ........... 87188   the initial (free) proficiency, while experience is 0
//     handleRollWeaponProf ........... 87276   the Weapon Knowledge roll, with Weapon and Missile Lore as
//                                              second and third chances
//     isProficientWithLauncher ....... 86965   ammunition is proficient through its launcher
//     handleRollWeaponLoreWeapon ..... 87727   and handleRollMissileLoreWeapon (87936),
//     handleRollSecondWeaponKnowWeapon 88147   handleRollSecondWeaponLoreWeapon (88338),
//     handleRollProjKnowProj ......... 88528   handleRollProjLoreProj (88645)
//     checkEquippedWeaponsAgainstProjectileKnowledgeList 90931   what Projectile Knowledge does to ranges
//
// FOUR OF HIS SLIPS ARE NOT CARRIED OVER, each said where it is:
//   - setWeaponLoreSheet works out the practitioner title BEFORE it has read when the class acquires Weapon
//     Lore (49846-49847), so its slot count is the title plus one. Missile Lore's, three lines away, has the
//     right order; that order is used for all of them.
//   - handleRollProjKnowProj adds the projectile to the list on a FAILED roll too (88604-88610), under a
//     chat line that says "Succeeded? = false". Read as a copied branch; a failure adds nothing here.
//   - His already-held and proficient tests compare whole names, but isProficientWithLauncher tests the
//     list as one string (`includes`), so "Crossbow" would be found inside "Crossbow(Heavy)". Names are
//     compared whole here.
//   - His gates are written `currentTitle=>whenAcquired`, an arrow function, always true. The correct
//     `title >= when` is used, as hasLore in combat-rules.mjs already does.
//==================================================================================================================

import { getSimplifiedName, parseLoreList, isProjectileWeapon } from "./combat/combat-rules.mjs";

// @MARKER THE SEVEN CHOICES
// One row per Updater option. `list` is the field on system.combat the choice writes, in his shape (one
// comma-separated string of simplified names). `skill` is the skill rolled. `from` says what may be chosen:
//     "weapons"      any weapon that is not ammunition (his all_weapons; "you cannot be proficient in
//                    projectiles, only launchers")
//     "proficient"   a weapon the character is proficient in -- his lore and second-weapon rolls all
//                    refuse "is not proficient in X and so cannot be ... with it"
//     "projectiles"  ammunition (his all_proj_weapons)
// `slots`: limited to one per title held in the skill (his practitioner title less those named).
// `firstFree`: the first one is chosen without a roll ("The first weapon chosen is automatic.").
// `extraSlotBonus`: +10% for every slot past the first, "represents a title skipped" (Weapon and Missile
// Lore only; the two second-weapon rolls and Projectile Lore have no such line).
//
//      kind               his value                          label                              list field               skill                        title field               from          slots  firstFree extraSlotBonus
export const WEAPON_CHOICE_KINDS = [
	[ "proficiency",    "update_weapon_prof",                "Add Weapon Proficiency",           "weaponProfList",        "Weapon Knowledge",          "",                       "weapons",     false, false,    false ],
	[ "weaponLore",     "update_weapon_lore_weapons",        "Select Weapon Lore Weapons",       "weaponLoreList",        "Weapon Lore",               "weaponLoreTitle",        "proficient",  true,  true,     true  ],
	[ "missileLore",    "update_missile_lore_weapons",       "Select Missile Lore Weapons",      "missileLoreList",       "Missile Lore",              "missileLoreTitle",       "proficient",  true,  true,     true  ],
	[ "secondKnow",     "update_second_weap_know_weapons",   "Select 2nd Weapon Know. Weapons",  "secondWeaponKnowList",  "Second Weapon Knowledge",   "secondWeaponKnowTitle",  "proficient",  true,  true,     false ],
	[ "secondLore",     "update_second_weap_lore_weapons",   "Select 2nd Weapon Lore Weapons",   "secondWeaponLoreList",  "Second Weapon Lore",        "secondWeaponLoreTitle",  "proficient",  true,  true,     false ],
	[ "projectileKnow", "update_proj_know_proj",             "Select Projectile Know. Projectile", "projectileKnowList",  "Projectile Knowledge",      "",                       "projectiles", false, false,    false ],
	[ "projectileLore", "update_proj_lore_proj",             "Select Projectile Lore Projectile", "projectileLoreList",   "Projectile Lore",           "projectileLoreTitle",    "projectiles", true,  true,     false ]
];

// This is the function which reads one row of the table above into named fields.
export function getWeaponChoiceKind(tmpkind) {
	var tmprow = WEAPON_CHOICE_KINDS.find(tmpr => tmpr[0] == tmpkind);
	if (!tmprow) { return null; }
	var [ tmpid, tmphis, tmplabel, tmplist, tmpskill, tmptitle, tmpfrom, tmpslots, tmpfirst, tmpbonus ] = tmprow;
	return { kind: tmpid, hisValue: tmphis, label: tmplabel, listField: tmplist, skill: tmpskill, titleField: tmptitle,
		from: tmpfrom, slots: tmpslots, firstFree: tmpfirst, extraSlotBonus: tmpbonus };
}

// @MARKER NON-PROFICIENCY PENALTY
// getWeaponProfPenalty (sheet-worker.js:83390): the to-hit penalty for a weapon the character is not
// proficient with, banded by Weapon Knowledge's chance. Five times it comes off a parry roll
// (non_prof_skills_penalty) -- the port has no parry roll yet, so that half is worked out and not used.
//
//      below   penalty
const NON_PROFICIENCY_BANDS = [
	[  11,   -11 ],
	[  21,   -10 ],
	[  31,    -9 ],
	[  41,    -8 ],
	[  51,    -7 ],
	[  61,    -6 ],
	[  71,    -5 ],
	[  81,    -4 ],
	[  91,    -3 ],
	[ 101,    -2 ],
	[ 200,    -1 ]
];

// This is the function which gives the to-hit penalty for a weapon not proficient in.
export function getNonProficiencyPenalty(tmpchance) {
	var tmpvalue = parseInt(tmpchance) || 0;
	for (const [ tmpbelow, tmppenalty ] of NON_PROFICIENCY_BANDS) {
		if (tmpvalue < tmpbelow) { return tmppenalty; }
	}
	return 0;
}

// @MARKER PROFICIENCY TOTALS
// setWeaponProfTotals (sheet-worker.js:83369): a proficiency for every whole 10% of Weapon Knowledge; used
// is how many are on the list (setWeaponProfValues, 83132, counts the list rather than trusting the stored
// count); available is what is left, and may go below zero if Knowledge has fallen.
export function getWeaponProfTotals(tmpchance, tmplist) {
	var tmpvalue = parseInt(tmpchance) || 0;
	var tmptotal = Math.floor(tmpvalue / 10);
	var tmpused = parseLoreList(tmplist).length;
	var tmppenalty = getNonProficiencyPenalty(tmpvalue);
	return { total: tmptotal, used: tmpused, available: tmptotal - tmpused,
		penalty: tmppenalty, skillsPenalty: tmppenalty * 5 };
}

// @MARKER AMMUNITION THROUGH ITS LAUNCHER
// isProficientWithLauncher (sheet-worker.js:86965-87079), in his order: ammunition is never on the list
// itself, so an arrow is proficient when the bow that fires it is. Each row is the start of the simplified
// projectile name, and the launchers any one of which makes it proficient.
//
//      projectile name begins          launchers
const PROJECTILE_LAUNCHERS = [
	[ "Arrow(Long Bow",             [ "Bow(Long)" ] ],
	[ "Arrow(Composite Bow",        [ "Bow(Composite)" ] ],
	[ "Arrow(Compound Bow",         [ "Bow(Compound)" ] ],
	[ "Arrow(Great Bow",            [ "Bow(Great)" ] ],
	[ "Arrow(Horn Bow",             [ "Bow(Horn)" ] ],
	[ "Arrow(Recurve Bow",          [ "Bow(Recurve)" ] ],
	[ "Arrow(Short Bow",            [ "Bow(Short)" ] ],
	[ "Arrow(Welsh Bow",            [ "Bow(Welsh)" ] ],
	[ "Bolt(Crossbow",              [ "Crossbow", "Crossbow(Double)", "Crossbow(Over-Under)", "Crossbow(Repeating)" ] ],
	[ "Bolt(Hand Crossbow",         [ "Crossbow(Hand)", "Crossbow(Hand/Double)", "Crossbow(Hand/Over-Under)", "Crossbow(Hand/Repeating)" ] ],
	[ "Bolt(Heavy Crossbow",        [ "Crossbow(Heavy)", "Crossbow(Heavy/Double)", "Crossbow(Heavy/Over-Under)", "Crossbow(Heavy/Repeating)" ] ],
	[ "Rock(Sling",                 [ "Sling" ] ],
	[ "Rock(Wrist Sling",           [ "Wrist Sling" ] ],
	[ "Bullet(Sling",               [ "Sling" ] ],
	[ "Bullet(Wrist Sling",         [ "Wrist Sling" ] ],
	[ "Arrow(Primitive Bow",        [ "Bow(Primitive)" ] ],
	[ "Dart(Blow Gun",              [ "Blow Gun" ] ],
	[ "Javelin(Wood)",              [ "At’alta(Javelin Thrower)" ] ],
	[ "Stick(Throwing)",            [ "At’alta(Javelin Thrower)" ] ],
	[ "Arrow(Fairy Composite Bow",  [ "Fairy Composite Bow" ] ],
	[ "Arrow(Fairy Great Bow",      [ "Fairy Great Bow" ] ],
	[ "Arrow(Fairy Long Bow",       [ "Fairy Long Bow" ] ],
	[ "Arrow(Fairy Short Bow",      [ "Fairy Short Bow" ] ],
	[ "Arrow(Fairy Hand Crossbow",  [ "Fairy Hand Crossbow" ] ],
	[ "Arrow(Fairy Heavy Crossbow", [ "Fairy Heavy Crossbow" ] ],
	[ "Arrow(Fairy Crossbow",       [ "Fairy Crossbow" ] ],
	[ "Pebble(Fairy Sling)",        [ "Fairy Sling" ] ],
	[ "Bullet(Fairy Sling)",        [ "Fairy Sling" ] ],
	[ "Bolt(Ballista",              [ "Ballista" ] ],
	[ "Shot(Ballista",              [ "Ballista" ] ],
	[ "Bolt(Heavy Ballista",        [ "Ballista(Heavy)" ] ],
	[ "Shot(Heavy Ballista",        [ "Ballista(Heavy)" ] ],
	[ "Bolt(Light Ballista",        [ "Ballista(Light)" ] ],
	[ "Shot(Light Ballista",        [ "Ballista(Light)" ] ],
	[ "Boulder(Catapult)",          [ "Catapult" ] ],
	[ "Greek Fire(Catapult)",       [ "Catapult" ] ],
	[ "Boulder(Trebuchet)",         [ "Trebuchet" ] ],
	[ "Greek Fire(Trebuchet)",      [ "Trebuchet" ] ],
	[ "Arrow(Giant Short Bow",      [ "Giant Short Bow" ] ],
	[ "Arrow(Giant Long Bow",       [ "Giant Long Bow" ] ],
	[ "Arrow(Giant Great Bow",      [ "Giant Great Bow" ] ],
	[ "Arrow(Titan Bow",            [ "Titan Bow" ] ],
	[ "Ball(Cannon)",               [ "Cannon(Early)", "Cannon", "Cannon(Heavy)" ] ],
	[ "Grape Shot(Cannon)",         [ "Cannon(Early)", "Cannon", "Cannon(Heavy)" ] ],
	[ "Exploding(Cannon)",          [ "Cannon(Early)", "Cannon", "Cannon(Heavy)" ] ],
	[ "Lead Ball(Early Gun)",       [ "Early Derringer", "Single Shot Pistol", "Blunder Buss", "Long Rifle" ] ]
];

// This is the function which says whether a character is proficient with a weapon: the weapon by its
// simplified name on the list (isProficientWithWeapon, 89711), or, for ammunition, its launcher
// (isProficientWithLauncher -- his handlePhysicalAttacks clears the penalty this way, 64648).
export function isProficientWith(tmpweaponname, tmplist) {
	var tmpnames = parseLoreList(tmplist);
	var tmpname = getSimplifiedName(tmpweaponname);
	if (!tmpname) { return false; }
	if (tmpnames.includes(tmpname)) { return true; }
	for (const [ tmpstart, tmplaunchers ] of PROJECTILE_LAUNCHERS) {
		if (tmpname.startsWith(tmpstart)) {
			return tmplaunchers.some(tmplauncher => tmpnames.includes(tmplauncher));
		}
	}
	return false;
}

// @MARKER THE PENALTY ON AN ATTACK
// handlePhysicalAttacks (sheet-worker.js:64549-64551 and 64648): a weapon not proficient in takes the
// non-proficiency penalty to hit.
//
// TRACKED ONLY ONCE THE LIST IS STARTED. A character made before this window existed -- every character
// the port has made -- has an empty list, and his sheet would put every one of their weapons at up to -11
// overnight. So an empty list means proficiencies are not being kept for this character, and nothing is
// taken off; the first proficiency recorded turns it on. The window says so. The lead's DECISIONS entry
// carries this; it is a port ruling, not his.
export function getProficiencyToHit(tmpweaponname, tmplist, tmpchance) {
	if (parseLoreList(tmplist).length == 0) { return 0; }
	if (isProficientWith(tmpweaponname, tmplist)) { return 0; }
	return getNonProficiencyPenalty(tmpchance);
}

// @MARKER WHERE THE CHARACTER STANDS
// The panel his set*Sheet functions pick: "never" (the class never acquires it), "notYet" (it does, at a
// title not reached), or "acquired". Proficiency and Projectile Knowledge have no title: proficiency is
// always open, and Projectile Knowledge is open when the skill is held at all, reached or not (his
// proj_know_roll covers "Found", "Not acquired" and "No chance" alike).
//
//   tmpfacts = { when, title, held }     when: the title the class acquires it at (0 = never)
//                                        held: the character has the skill (Projectile Knowledge only)
export function getChoiceStanding(tmpkind, tmpfacts) {
	var tmpk = getWeaponChoiceKind(tmpkind);
	var tmpf = tmpfacts ?? {};
	if (!tmpk) { return "never"; }
	if (tmpk.kind == "proficiency") { return "acquired"; }
	if (tmpk.kind == "projectileKnow") { return tmpf.held ? "acquired" : "never"; }
	var tmpwhen = parseInt(tmpf.when) || 0;
	if (tmpwhen <= 0) { return "never"; }
	if ((parseInt(tmpf.title) || 0) < tmpwhen) { return "notYet"; }
	return "acquired";
}

// This is the function which gives the slots left: one per title held in the skill, less those named --
// (title - when + 1) - named, as Missile Lore's setMissileLoreSheet works it (49900).
export function getChoiceSlots(tmptitle, tmpwhen, tmplist) {
	var tmpw = parseInt(tmpwhen) || 0;
	if (tmpw <= 0) { return 0; }
	var tmppractitioner = Math.max(0, ((parseInt(tmptitle) || 0) - tmpw) + 1);
	return tmppractitioner - parseLoreList(tmplist).length;
}

// @MARKER THE ROLL
// This is the function which decides one attempt, in his order of refusals, and says what to write.
//
//   tmpinput = {
//       kind            one of WEAPON_CHOICE_KINDS
//       name            the weapon or projectile chosen
//       characterName
//       list            the current list for this kind (string)
//       profList        the proficiency list (for the lore and second-weapon kinds)
//       chance          the skill's chance
//       slots           slots left (the kinds with slots)
//       standing        getChoiceStanding's answer
//       initial         Add Weapon Proficiency only: the free, rollless initial proficiency (his
//                       weapon_prof_initial panel, offered while experience is 0)
//       available       Add Weapon Proficiency only: proficiencies available
//       isMelee, isMissile   Add Weapon Proficiency only: what the weapon can do, for the second chances
//       weaponLoreChance, missileLoreChance   Add Weapon Proficiency only
//       roll            the d100
//       roll2, roll3    the second and third chances' d100s (Weapon Lore, Missile Lore)
//   }
// Returns { ok, added, message, newList, rolled } -- ok false with no newList means nothing is written.
export function resolveWeaponChoice(tmpinput) {
	var tmpi = tmpinput ?? {};
	var tmpk = getWeaponChoiceKind(tmpi.kind);
	var tmpwho = "" + (tmpi.characterName ?? "");
	var tmpname = getSimplifiedName(tmpi.name);
	var tmplist = parseLoreList(tmpi.list);
	var tmpnone = (tmpmessage) => ({ ok: false, added: false, message: tmpmessage, newList: null, rolled: false });
	var tmpadd = () => tmplist.concat([ tmpname ]).join(",");
	if (!tmpk) { return tmpnone("Nothing to choose."); }
	var tmpthing = tmpk.from == "projectiles" ? "projectile" : "weapon";

	if (tmpi.standing == "never") { return tmpnone(`${tmpwho}'s class does not ever acquire ${tmpk.skill}. Nothing done.`); }
	if (tmpi.standing == "notYet") { return tmpnone(`${tmpwho} has not acquired ${tmpk.skill}. Cannot select a ${tmpk.skill} ${tmpthing}, yet.`); }

	// @MARKER PROFICIENCY
	if (tmpk.kind == "proficiency") {
		if (tmpname && isProjectileWeapon(tmpname)) { return tmpnone(`${tmpwho} cannot be proficient in projectiles (only launchers). Nothing done.`); }
		if (tmpname && tmplist.includes(tmpname)) { return tmpnone(`${tmpwho} is already proficient with ${tmpname}. Nothing done.`); }
		if ((parseInt(tmpi.available) || 0) < 1) { return tmpnone(`${tmpwho} does not currently have enough proficiency slots for ${tmpname || "a weapon"}. Nothing done.`); }
		if (!tmpname) { return tmpnone(`${tmpwho} did not select a weapon to be proficient with. Nothing done.`); }
		if (tmpi.initial) {
			return { ok: true, added: true, message: `${tmpwho} is now proficient with ${tmpname}.`, newList: tmpadd(), rolled: false };
		}
		var tmpchance = parseInt(tmpi.chance) || 0;
		var tmproll = parseInt(tmpi.roll) || 0;
		var tmptext = `${tmpwho} attempted Weapon Knowledge to become proficient with ${tmpname}. Rolled a ${tmproll}% against a ${tmpchance}%.`;
		if (tmproll <= tmpchance) {
			return { ok: true, added: true, message: `${tmptext} Succeeded and is now proficient with ${tmpname}.`, newList: tmpadd(), rolled: true };
		}
		// The second chance with Weapon Lore (a melee weapon), then the third with Missile Lore (a missile one).
		var tmpwl = parseInt(tmpi.weaponLoreChance) || 0;
		var tmpml = parseInt(tmpi.missileLoreChance) || 0;
		var tmpsaid = " and failed.";
		if (tmpwl > 0 && tmpi.isMelee) {
			var tmpr2 = parseInt(tmpi.roll2) || 0;
			tmpsaid = tmpsaid + ` A second chance with Weapon Lore rolled ${tmpr2}% against ${tmpwl}%`;
			if (tmpr2 <= tmpwl) {
				return { ok: true, added: true, message: `${tmptext}${tmpsaid} and succeeded: now proficient with ${tmpname}.`, newList: tmpadd(), rolled: true };
			}
			tmpsaid = tmpsaid + " and failed.";
		}
		if (tmpml > 0 && tmpi.isMissile) {
			var tmpr3 = parseInt(tmpi.roll3) || 0;
			tmpsaid = tmpsaid + ` A ${tmpwl > 0 && tmpi.isMelee ? "third" : "second"} chance with Missile Lore rolled ${tmpr3}% against ${tmpml}%`;
			if (tmpr3 <= tmpml) {
				return { ok: true, added: true, message: `${tmptext}${tmpsaid} and succeeded: now proficient with ${tmpname}.`, newList: tmpadd(), rolled: true };
			}
			tmpsaid = tmpsaid + " and failed.";
		}
		return { ok: true, added: false, message: `${tmptext}${tmpsaid} Not proficient.`, newList: null, rolled: true };
	}

	// @MARKER THE LORE AND KNOWLEDGE LISTS
	var tmpverb = tmpk.skill;
	if (!tmpname) { return tmpnone(`${tmpwho} selected no ${tmpthing} for ${tmpverb}. Nothing done.`); }
	if (tmplist.includes(tmpname)) { return tmpnone(`${tmpwho} already has ${tmpverb} with ${tmpname}. Nothing done.`); }
	if (tmpk.from == "proficient" && !isProficientWith(tmpname, tmpi.profList)) {
		return tmpnone(`${tmpwho} is not proficient in ${tmpname} and so cannot take ${tmpverb} with it. Nothing done.`);
	}
	var tmpslots = parseInt(tmpi.slots) || 0;
	// The first is chosen without a roll (and without a chance), as his "first (automatic) choice" is.
	// His test is only that the list is empty; the standing gate above has already made sure the skill is
	// acquired, so there is always a slot for it.
	if (tmpk.firstFree && tmplist.length == 0) {
		return { ok: true, added: true, message: `${tmpwho} has selected ${tmpname} as their first (automatic) choice and now has ${tmpverb} with it.`, newList: tmpadd(), rolled: false };
	}
	var tmpchance2 = parseInt(tmpi.chance) || 0;
	if (tmpk.slots && tmpchance2 < 1) { return tmpnone(`${tmpwho} has no ${tmpverb} chance, so cannot take a ${tmpthing}, even if acquired. Nothing done.`); }
	if (tmpk.slots && tmpslots < 1) { return tmpnone(`${tmpwho} has no ${tmpverb} slots available. Nothing done.`); }
	var tmpbonus = (tmpk.extraSlotBonus && tmpslots > 1) ? (tmpslots - 1) * 10 : 0;
	var tmptotal = tmpchance2 + tmpbonus;
	var tmproll2 = parseInt(tmpi.roll) || 0;
	var tmpchanceText = tmpbonus ? `${tmpchance2}% increased by ${tmpbonus}% (${tmpslots - 1} slot${tmpslots - 1 == 1 ? "" : "s"} unspent) to ${tmptotal}%` : `${tmptotal}%`;
	var tmptext2 = `${tmpwho} attempted ${tmpverb} with ${tmpname}. Rolled a ${tmproll2}% against ${tmpchanceText}.`;
	if (tmproll2 <= tmptotal) {
		return { ok: true, added: true, message: `${tmptext2} Succeeded.`, newList: tmpadd(), rolled: true };
	}
	return { ok: true, added: false, message: `${tmptext2} Failed.`, newList: null, rolled: true };
}

// @MARKER PROJECTILE KNOWLEDGE RANGES
// checkEquippedWeaponsAgainstProjectileKnowledgeList (sheet-worker.js:90931): Projectile Knowledge in a
// projectile moves its medium range out by 20% for every whole 20% of the skill, taking the distance from
// the long band, then the extreme band. Ranges arrive as numbers (0 for a band the weapon lacks).
// Returns { medium, long, extreme, percent }.
export function getProjectileKnowledgeRanges(tmpranges, tmpchance) {
	var tmpmed = parseInt(tmpranges?.medium) || 0;
	var tmplong = parseInt(tmpranges?.long) || 0;
	var tmpextreme = parseInt(tmpranges?.extreme) || 0;
	var tmplevels = Math.floor((parseInt(tmpchance) || 0) / 20);
	var tmpadjust = Math.floor(((tmplevels * 20) / 100) * tmpmed);
	if (tmpadjust <= (tmplong - tmpmed)) {
		return { medium: tmpmed + tmpadjust, long: tmplong, extreme: tmpextreme, percent: tmplevels * 20 };
	}
	var tmpremainder = tmpadjust - (tmplong - tmpmed);
	if (tmpremainder <= (tmpextreme - tmplong)) {
		return { medium: tmplong + tmpremainder, long: 0, extreme: tmpextreme, percent: tmplevels * 20 };
	}
	return { medium: tmpextreme, long: 0, extreme: 0, percent: tmplevels * 20 };
}
// @END (CODE)
