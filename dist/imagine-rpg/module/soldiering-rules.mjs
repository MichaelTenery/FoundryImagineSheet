// @START (CODE)
// @MARKER SOLDIERING RULES
//==================================================================================================================
// The social skill Soldiering: "+1 to hit and to damage with single weapon" (his skill note, sheet-worker.js:57531).
// A character who holds it names ONE weapon in the Updater ("Select Soldiering Weapon") and that weapon
// is +1 to hit and +1 damage, melee or missile.
//
// Ported from three places in his code:
//   roll_update_soldiering_weapon   (sheet-worker.js:11008)  choosing the weapon: refused with a message when
//                                   Soldiering is not among the character's social skills ("does not have
//                                   Soldiering as a Social Skill. Nothing done."), and the old weapon is replaced
//   setGeneralCombatModifierDisplay (82478-82491)            the +1/+1 is switched on once a weapon is named, and the
//                                   Specific Combat Modifiers line reads "Soldiering[<weapon>](To Hit/Damage):+1"
//                                   or, with none chosen, "Soldiering[select weapon in updater](To Hit/Damage):+1"
//   handlePhysicalAttacks           (64398-64407, 64760-64762) the bonus applies only when the weapon in hand is the
//                                   named one (compared by simplified name), and is zeroed when the same blow reads
//                                   a Weapon Lore bonus
//
// THE BONUSES DO NOT STACK, AT ALL. His code zeroes soldiering only for a lored melee weapon, but the report that
// asked for this (0.25.1:9, 2026-10-27) rules it plainly: "any magical, or master weapon, overrides this modifier
// with their own (ignoring the soldiering bonus)". Both are applied, and so is his Weapon Lore case -- a weapon
// that earns a bonus of its own from anywhere takes that and not this on top. The ruling is the report's; it is
// not a line of his code, and DECISIONS records it as such.
//
// Nothing here talks to Foundry or rolls a die.
//==================================================================================================================

import { getSimplifiedName } from "./combat/combat-rules.mjs";

	// The bonus itself: his combat_tohit_mod_soldiering and combat_damage_mod_soldiering, each set to 1.
	export const SOLDIERING_TO_HIT = 1;
	export const SOLDIERING_DAMAGE = 1;
	export const SOLDIERING_SKILL = "Soldiering";

	// His placeholder when the skill is held and no weapon is named yet (setGeneralCombatModifierDisplay, 82480).
	export const SOLDIERING_UNSET = "select weapon in updater";

	// This is the function which says what Soldiering gives for the weapon in hand.
	//
	//   tmpinput = {
	//       held:             the character has the Soldiering skill
	//       soldieringWeapon: the weapon named in the Updater, "" for none
	//       weaponName:       the weapon being swung (customised names are simplified, as his are)
	//       magicBonus:       the weapon's magical plus
	//       listingTags:      the weapon's quality/condition/customization tags (getWeaponListingTags)
	//       lored:            this blow reads a Weapon Lore bonus (his modWL branch)
	//   }
	//
	// Returns { toHit, damage, active, reason } -- reason says why it came to nothing, for the card and the panel.
	export function getSoldieringModifiers(tmpinput) {
		var tmpnone = (tmpreason) => ({ toHit: 0, damage: 0, active: false, reason: tmpreason });
		if (!tmpinput?.held) { return tmpnone("not held"); }

		var tmpnamed = getSimplifiedName(tmpinput.soldieringWeapon);
		if (!tmpnamed) { return tmpnone("no weapon chosen"); }
		if (tmpnamed != getSimplifiedName(tmpinput.weaponName)) { return tmpnone("another weapon"); }

		// Anything that earns a bonus of its own takes it instead.
		if ((parseInt(tmpinput.magicBonus) || 0) > 0) { return tmpnone("magical weapon"); }
		if ((tmpinput.listingTags ?? []).includes("Master")) { return tmpnone("master weapon"); }
		if (tmpinput.lored) { return tmpnone("weapon lore"); }

		return { toHit: SOLDIERING_TO_HIT, damage: SOLDIERING_DAMAGE, active: true, reason: "" };
	}

	// This is the function which writes the Specific Combat Modifiers line, in his words.
	export function describeSoldiering(tmpweaponname) {
		var tmpname = getSimplifiedName(tmpweaponname) || SOLDIERING_UNSET;
		return `Soldiering[${tmpname}](To Hit/Damage):+${SOLDIERING_TO_HIT}`;
	}

	// This is the function which checks a choice before it is written, as his roll does: the skill must be held
	// and a weapon must be named. Returns { ok, replaced, message }.
	export function checkSoldieringChoice(tmpheld, tmpoldweapon, tmpnewweapon, tmpcharactername) {
		var tmpwho = tmpcharactername || "The character";
		var tmpnew = getSimplifiedName(tmpnewweapon);
		var tmpold = getSimplifiedName(tmpoldweapon);
		if (!tmpnew)  { return { ok: false, replaced: false, message: `${tmpwho} selected no weapon for Soldiering bonuses. Nothing done.` }; }
		if (!tmpheld) { return { ok: false, replaced: false, message: `${tmpwho} does not have Soldiering as a Social Skill. Nothing done.` }; }
		if (tmpold && tmpold != "None") {
			return { ok: true, replaced: true,
				message: `${tmpwho} is replacing ${tmpold} with ${tmpnew} as the weapon for Soldiering bonuses.` };
		}
		return { ok: true, replaced: false, message: `${tmpwho} selected ${tmpnew} as the weapon for Soldiering bonuses.` };
	}

	// This is the function which builds what the Select Soldiering Weapon window shows: whether the skill
	// is held, the weapon now named, and the dropdown -- what the character carries first, then every
	// weapon the compendium names, each once, by simplified name (his all_weapons list).
	export function buildSoldieringView(tmpheld, tmpcurrent, tmpowned, tmppackNames) {
		var tmpcurrentname = getSimplifiedName(tmpcurrent);
		var tmpseen = new Set();
		var tmpgroups = [];
		var tmpadd = (tmplabel, tmpnames) => {
			var tmpoptions = [];
			for (const tmpname of [...new Set((tmpnames ?? []).map(getSimplifiedName).filter(tmpn => tmpn))].sort()) {
				if (tmpseen.has(tmpname)) { continue; }
				tmpseen.add(tmpname);
				tmpoptions.push({ name: tmpname, selected: tmpname == tmpcurrentname });
			}
			if (tmpoptions.length) { tmpgroups.push({ label: tmplabel, options: tmpoptions }); }
		};
		tmpadd("Carried", tmpowned);
		tmpadd("All weapons", tmppackNames);
		return {
			held: !!tmpheld,
			current: tmpcurrentname,
			line: describeSoldiering(tmpcurrentname),
			groups: tmpgroups
		};
	}

// @MARKER ADD NEW soldiering functions HERE
// @END (CODE)
