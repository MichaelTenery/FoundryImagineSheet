// @START (CODE)
// @MARKER WEAPON CHOICES VIEW
//==================================================================================================================
// What the Weapon Choices window shows, worked out without Foundry so the test renders the same template
// against the same view -- the arrangement soldiering-rules.mjs and armor-know-view.mjs keep.
//
// His seven Updater panels, one at a time: the panel he would have shown (never / not yet / the list), the
// slots or proficiency totals, the current list, the dropdown, and his ADD button's note. The rules are in
// module/weapon-choices-rules.mjs.
//==================================================================================================================

import { WEAPON_CHOICE_KINDS, getWeaponChoiceKind, getChoiceStanding, isProficientWith } from "./weapon-choices-rules.mjs";
import { getSimplifiedName, parseLoreList, isProjectileWeapon } from "./combat/combat-rules.mjs";

// His ADD buttons' notes, word for word where he has one.
const ADD_NOTES = {
	proficiency:    "click here to roll a Weapon Knowledge skill and try to add the selected weapon as a proficiency.",
	weaponLore:     "click here to roll/select a Weapon Lore weapon. The first weapon chosen is automatic.",
	missileLore:    "click here to roll/select a Missile Lore weapon. The first weapon chosen is automatic.",
	secondKnow:     "click here to roll/select a Second Weapon Knowledge weapon. The first weapon chosen is automatic.",
	secondLore:     "click here to roll/select a Second Weapon Lore weapon. The first weapon chosen is automatic.",
	projectileKnow: "click here to roll for a Projectile Knowledge projectile.",
	projectileLore: "click here to roll/select a Projectile Lore projectile. The first weapon chosen is automatic."
};

// This is the function which gathers, off a character's derived system, what each kind needs. Kept here,
// beside the view, so the window and the test read the actor the same way.
export function getWeaponChoiceFacts(tmpsystem, tmpkind) {
	var tmpc = tmpsystem?.combat ?? {};
	var tmpnum = (tmpvalue) => parseInt(tmpvalue) || 0;
	//                       when field                  reached title field              chance field              slots field
	var tmpmap = {
		proficiency:    [ "",                       "",                              "weaponKnowChance",       ""                       ],
		weaponLore:     [ "weaponLoreTitle",        "weaponLoreReachedTitle",        "weaponLoreChance",       "weaponLoreSlots"        ],
		missileLore:    [ "missileLoreTitle",       "missileLoreReachedTitle",       "missileLoreChance",      "missileLoreSlots"       ],
		secondKnow:     [ "secondWeaponKnowTitle",  "secondWeaponKnowReachedTitle",  "secondWeaponKnowChance", "secondWeaponKnowSlots"  ],
		secondLore:     [ "secondWeaponLoreTitle",  "secondWeaponLoreReachedTitle",  "secondWeaponLoreChance", "secondWeaponLoreSlots"  ],
		projectileKnow: [ "",                       "",                              "projectileKnowChance",   ""                       ],
		projectileLore: [ "projectileLoreTitle",    "projectileLoreReachedTitle",    "projectileLoreChance",   "projectileLoreSlots"    ]
	};
	var [ tmpwhen, tmptitle, tmpchance, tmpslots ] = tmpmap[tmpkind] ?? [ "", "", "", "" ];
	var tmpk = getWeaponChoiceKind(tmpkind);
	return {
		when: tmpwhen ? tmpnum(tmpc[tmpwhen]) : 0,
		title: tmptitle ? tmpnum(tmpc[tmptitle]) : 0,
		held: tmpkind == "projectileKnow" ? !!tmpc.hasProjectileKnowledge : true,
		chance: tmpchance ? tmpnum(tmpc[tmpchance]) : 0,
		slots: tmpslots ? tmpnum(tmpc[tmpslots]) : 0,
		list: tmpk ? ("" + (tmpc[tmpk.listField] ?? "")) : "",
		profList: "" + (tmpc.weaponProfList ?? ""),
		profTotal: tmpnum(tmpc.weaponProfTotal),
		profUsed: tmpnum(tmpc.weaponProfUsed),
		profAvailable: tmpnum(tmpc.weaponProfAvailable),
		nonProfPenalty: tmpnum(tmpc.nonProfPenalty),
		weaponLoreChance: tmpnum(tmpc.weaponLoreChance),
		missileLoreChance: tmpnum(tmpc.missileLoreChance),
		exp: tmpnum(tmpsystem?.identity?.exp)
	};
}

// This is the function which builds everything the window renders.
//
//   tmpkind        one of WEAPON_CHOICE_KINDS
//   tmpfacts       getWeaponChoiceFacts
//   tmpweapons     the weapons that may be offered: [{ name, melee, missile }], owned and the compendium's
//   tmpselected    the name in the dropdown now, or ""
//   tmpcharactername
export function buildWeaponChoicesView(tmpkind, tmpfacts, tmpweapons, tmpselected, tmpcharactername) {
	var tmpk = getWeaponChoiceKind(tmpkind) ?? getWeaponChoiceKind("proficiency");
	var tmpf = tmpfacts ?? {};
	var tmpstanding = getChoiceStanding(tmpk.kind, tmpf);
	var tmplist = parseLoreList(tmpf.list);

	// What may be chosen, by name, once each, sorted.
	var tmpseen = new Set();
	var tmpoptions = [];
	for (const tmpweapon of (tmpweapons ?? [])) {
		var tmpname = getSimplifiedName(tmpweapon?.name);
		if (!tmpname || tmpseen.has(tmpname)) { continue; }
		var tmpammo = isProjectileWeapon(tmpname);
		if (tmpk.from == "projectiles" && !tmpammo) { continue; }
		if (tmpk.from != "projectiles" && tmpammo) { continue; }
		if (tmpk.from == "proficient" && !isProficientWith(tmpname, tmpf.profList)) { continue; }
		// Weapon Lore names a weapon swung, Missile Lore one thrown or fired, as his two dropdowns divide them.
		if (tmpk.kind == "weaponLore" && tmpweapon.melee === false) { continue; }
		if (tmpk.kind == "missileLore" && tmpweapon.missile === false) { continue; }
		if (tmplist.includes(tmpname)) { continue; }
		tmpseen.add(tmpname);
		tmpoptions.push(tmpname);
	}
	tmpoptions.sort((tmpa, tmpb) => tmpa.localeCompare(tmpb));

	var tmpwho = "" + (tmpcharactername ?? "");
	var tmpthing = tmpk.from == "projectiles" ? "projectile" : "weapon";
	var tmpblocked = "";
	if (tmpstanding == "never") { tmpblocked = `${tmpwho}'s class does not ever acquire ${tmpk.skill}. Cannot select a ${tmpk.skill} ${tmpthing}.`; }
	if (tmpstanding == "notYet") { tmpblocked = `${tmpwho} has not acquired ${tmpk.skill}. Cannot select a ${tmpk.skill} ${tmpthing}, yet.`; }

	return {
		kind: tmpk.kind,
		kinds: WEAPON_CHOICE_KINDS.map(tmprow => ({ value: tmprow[0], label: tmprow[2], selected: tmprow[0] == tmpk.kind })),
		label: tmpk.label,
		skill: tmpk.skill,
		standing: tmpstanding,
		blocked: tmpblocked,
		open: tmpstanding == "acquired",
		isProficiency: tmpk.kind == "proficiency",
		// His weapon_prof_initial panel, while experience is 0: the free ADD beside the rolled one.
		initialOffered: tmpk.kind == "proficiency" && (parseInt(tmpf.exp) || 0) < 1,
		hasSlots: tmpk.slots,
		slots: parseInt(tmpf.slots) || 0,
		chance: parseInt(tmpf.chance) || 0,
		profTotal: parseInt(tmpf.profTotal) || 0,
		profUsed: parseInt(tmpf.profUsed) || 0,
		profAvailable: parseInt(tmpf.profAvailable) || 0,
		nonProfPenalty: parseInt(tmpf.nonProfPenalty) || 0,
		// The ruling in getProficiencyToHit: an empty list is not tracked.
		profUntracked: tmpk.kind == "proficiency" && parseLoreList(tmpf.profList).length == 0,
		current: tmplist,
		currentLine: tmplist.length ? tmplist.join(", ") : "None",
		needsProficiency: tmpk.from == "proficient",
		thing: tmpthing,
		options: tmpoptions.map(tmpname => ({ name: tmpname, selected: tmpname == tmpselected })),
		hasOptions: tmpoptions.length > 0,
		addNote: ADD_NOTES[tmpk.kind] ?? ""
	};
}
// @END (CODE)
