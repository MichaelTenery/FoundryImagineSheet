# Natural weapons — left for a cheaper window (2026-09-23)

The pass that built them is `DECISIONS.md` 2026-09-23, "Natural weapons are weapons, and a race brings
them". Already decided and **not to be re-litigated**: they are ordinary `weapon` items in the Weapons
section (the user's explicit call), named "<race> <attack>", type `Natural`, listed on the race as
`naturalWeapons`, granted by the generator and by the race-drop hook, never removed.

1. **A touch roll for touch weapons.** Brok Harm Touch, Mephyt(Fire) Heat Skin and Mephyt(Ice) Cold
   Skin are Touch attacks. His `handleTouchAttack` makes contact on d20 + the Agility modifier ≥ 10
   instead of reading the attack chart (sheet-worker.js:70044-70052). Add a `touch` boolean to
   `module/data/item-weapon.mjs`, set it in `build_natural_weapons` (build_documents.py) for types
   ending "Touch", and branch in `rollWeaponAttack` (module/combat/attack.mjs) to his touch rule.
   Done when a Brok's Harm Touch card says "needs 10+ to contact" and applies damage only on contact.
   Then remove the "roll the touch at the table" sentence from `NATURAL_TYPE_NOTES`.
2. **A lost limb loses its attack.** His `getNaturalAttackLost(name, disabilities, lostLimbs, race)`
   refuses an attack whose limb is gone. Port it into `module/natural-weapons.mjs` as a pure function,
   and have the attack refuse a `type == "Natural"` weapon it names. Read his function first; do not
   guess the limb for each attack.
3. **Famorian.** Its attacks come from its evokes (`setFamorianNaturalAttacks`). Extend
   `extract_natural_attacks.py` to walk it, keyed by evoke. Grant by the character's
   `physical.famorian.evokes` rather than the race, and re-grant when evokes change.
4. **A sheet button for characters made before this.** For now it is
   `game.imagine.grantNaturalWeapons(actor)` in the console. Put a small "Add natural weapons" button
   in the Equipment tab's weapon header, shown when the race lists some the character lacks. It calls
   the same function.
5. **Apocritara's Stinger on a race dropped by hand.** The actor stores no slight physique, so the hook
   gives only the unbranched attacks. If an actor physique field is ever added, pass it to
   `getNaturalWeaponNames` in `grantNaturalWeapons` instead of `null`.
6. **Release.** Bump `system.json` (0.19.0), move CHANGELOG's "Unreleased" under it, and run
   `tools/build_system.py`. It was not done in this pass because the tree held another session's
   uncommitted starting-money work.
