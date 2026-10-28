// @START (CODE)
// @MARKER UPDATER RULES
//==================================================================================================================
// The Character Updater: his "What do you want to do?" dropdown (Roll20 sheet, attr_update_what, HTML line
// 45926), as one list of everything a character can change after it is made. Nothing here talks to Foundry.
//
// His dropdown shows ONE hidden panel at a time. The port already has most of those panels as windows of
// their own (Level Up, Brawling, Situation Mods, the martial and magic panels on their tabs), and the new
// ones -- soldiering, armour knowledge and lore, adding and training skills, powers and abilities,
// temporary modifiers -- are windows too. So the Updater is the list: pick what to do, and it either opens
// that window, does the one small thing inline (the GME's attack skill), or says where on the sheet the
// thing already is. Each row is one of his dropdown values, named as he names it.
//
// A row says WHO may use it and WHEN. Where it cannot be used it stays in the list, greyed, with the
// reason -- his sheet hid the panel, which left a player wondering where it had gone.
//==================================================================================================================

// His six attack charts, lowest first. Also the choice a GME makes (gme_all_attack_skills_select).
export const GME_ATTACK_SKILLS = [ "Beginner", "Novice", "Intermediate", "Advanced", "Expert", "Master" ];

// @MARKER THE LIST
// kind:   "open"    opens the window named by `call` (a game.imagine function), with `args` after the actor
//         "inline"  done in the Updater itself
//         "where"   already on the sheet; `note` says where
//         "later"   not built yet; stays listed so it is not mistaken for forgotten
// gm:     true = Game Masters only      who:  "gme" = a character holding a non-classed class only
//
//      id                 his value                       label                              kind      call                args                note
export const UPDATER_ENTRIES = [
	[ "exp",              "update_add_exp / set_exp",      "Add or Set Experience",           "open",   "levelUp",          [],                 "Experience, goals and titles are taken in the Level Up window." ],
	[ "level",            "update_level",                  "Level Up!",                       "open",   "levelUp",          [],                 "" ],
	[ "arch",             "update_show_arch_qualify",      "Show Arch Mortal(11th) Qualifications", "where", "",            [],                 "At the 11th title the Level Up window shows what is still owed." ],
	[ "soldiering",       "update_soldiering_weapon",      "Select Soldiering Weapon",        "open",   "soldiering",       [],                 "" ],
	[ "armorKnow",        "update_armor_know_set",         "Select Armor Know. Config.",      "open",   "armorKnowledge",   [ "know" ],         "" ],
	[ "armorLore",        "update_armor_lore_set",         "Select Armor Lore Config.",       "open",   "armorKnowledge",   [ "lore" ],         "" ],
	[ "addRacial",        "update_add_race_skill",         "Add Racial Skill",                "open",   "addSkill",         [ "racial" ],       "" ],
	[ "addSocial",        "update_add_social_skill",       "Add Social Skill",                "open",   "addSkill",         [ "social" ],       "" ],
	[ "trainRacial",      "update_improve_race_skill",     "Train Up Racial Skill",           "open",   "trainSkill",       [ "racial" ],       "" ],
	[ "trainSocial",      "update_improve_social_skill",   "Train Up Social Skill",           "open",   "trainSkill",       [ "social" ],       "" ],
	[ "martial",          "update_martial_*",              "Martial Knowledge, Lore and Stances", "where", "",              [],                 "The Martial Arts panel on the Combat tab." ],
	[ "magicLists",       "update_spell_lore_set",         "Spell Mastery Spells",            "where",  "",                 [],                 "The Magic & Lore tab." ],
	[ "powers",           "update_powers",                 "Add/Remove Powers/Abilities",     "open",   "powers",           [],                 "" ],
	[ "tempMods",         "update_temp_modifiers",         "Add/Remove Temporary Modifiers",  "open",   "tempModifiers",    [],                 "" ],
	[ "gmeAttack",        "update_gme_attackskill",        "Update GME Attack Skill",         "inline", "",                 [],                 "" ],
	[ "gmTools",          "(Character Sheet Config)",      "Calculate and Split Experience (GM)", "open", "gmTools",         [],                 "" ],
	[ "weaponProf",       "update_weapon_prof",            "Add Weapon Proficiency",          "open",   "weaponChoices",    [ "proficiency" ],  "" ],
	[ "weaponLore",       "update_weapon_lore_weapons",    "Select Weapon Lore Weapons",      "open",   "weaponChoices",    [ "weaponLore" ],   "" ],
	[ "missileLore",      "update_missile_lore_weapons",   "Select Missile Lore Weapons",     "open",   "weaponChoices",    [ "missileLore" ],  "" ],
	[ "secondKnow",       "update_second_weap_know_weapons", "Select 2nd Weapon Know. Weapons", "open", "weaponChoices",    [ "secondKnow" ],   "" ],
	[ "secondLore",       "update_second_weap_lore_weapons", "Select 2nd Weapon Lore Weapons", "open",  "weaponChoices",    [ "secondLore" ],   "" ],
	[ "projectileKnow",   "update_proj_know_proj",         "Select Projectile Know. Projectile", "open", "weaponChoices",   [ "projectileKnow" ], "" ],
	[ "projectileLore",   "update_proj_lore_proj",         "Select Projectile Lore Projectile", "open", "weaponChoices",    [ "projectileLore" ], "" ],
	[ "identity",         "update_name / gender / faith / social_class / age / features", "Change Name, Gender, Faith, Social Class, Age, Features", "where", "", [], "The Description tab." ],
	[ "changeling",       "update_changeling_race",        "Changeling Switch Race",          "open",   "shapeChange",      [ "changeling" ],        "" ],
	[ "formlessHost",     "update_formless_race",          "Formless New Host",               "open",   "shapeChange",      [ "formlessHost" ],      "" ],
	[ "formlessRetention","update_formless_retention",     "Formless Host Retention",         "open",   "shapeChange",      [ "formlessRetention" ], "" ],
	[ "formlessPsyche",   "update_formless_free_psyche",   "Formless Check Free Psyche",      "open",   "shapeChange",      [ "formlessPsyche" ],    "" ]
];

// The entries that only a Game Master may use.
const GM_ONLY = [ "gmTools" ];

// This is the function which turns the table into rows the window can show, each with whether it can
// be used now and, if not, why.
//
//   tmpfacts = { isGME, isGM }       what the actor and the user are
export function buildUpdaterChoices(tmpfacts) {
	var tmpf = tmpfacts ?? {};
	return UPDATER_ENTRIES.map(tmprow => {
		var [ tmpid, tmphis, tmplabel, tmpkind, tmpcall, tmpargs, tmpnote ] = tmprow;
		var tmpwhy = "";
		if (GM_ONLY.includes(tmpid) && !tmpf.isGM) { tmpwhy = "Game Master only."; }
		if (tmpid == "gmeAttack" && !tmpf.isGME) { tmpwhy = "Only a GME (a character with a title of 0) changes attack skill; every other class takes its chart from its title."; }
		if (tmpkind == "later") { tmpwhy = "Not built yet."; }
		return { id: tmpid, hisValue: tmphis, label: tmplabel, kind: tmpkind, call: tmpcall, args: tmpargs,
			note: tmpnote, usable: tmpwhy == "", why: tmpwhy };
	});
}

// This is the function which says whether a chart name is one a GME may take.
export function isAttackSkillChoice(tmpname) {
	return GME_ATTACK_SKILLS.includes(tmpname);
}

// This is the function which decides a GME's change of attack skill: returns { ok, skill, message }.
// Blocked outright for anyone who is not a GME, as his button is ("GME only").
export function resolveGmeAttackChange(tmpisgme, tmpcurrent, tmpwanted) {
	if (!tmpisgme) { return { ok: false, skill: tmpcurrent, message: "Only a GME can change attack skill." }; }
	if (!isAttackSkillChoice(tmpwanted)) { return { ok: false, skill: tmpcurrent, message: "Choose an attack skill." }; }
	if (tmpwanted == tmpcurrent) { return { ok: false, skill: tmpcurrent, message: `Already ${tmpcurrent}.` }; }
	return { ok: true, skill: tmpwanted, message: `Attack skill is now ${tmpwanted}.` };
}
// @END (CODE)
