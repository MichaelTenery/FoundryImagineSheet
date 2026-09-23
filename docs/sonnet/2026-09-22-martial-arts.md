# Martial arts: mechanical follow-through (2026-09-22)

This pass built Martial Knowledge, Martial Lore and the stances: the tables generated from his sheet,
the rules (`module/combat/martial-arts.mjs`), the character derivation (`_prepareMartialArts` in
`module/data/actor-character.mjs`), the rolls (`module/combat/martial-attack.mjs`), and the Combat
tab's Martial Arts panel (`module/martial-view.mjs` + the martial block in
`templates/actor/tab-combat.hbs`). The reasoning is in `docs/DECISIONS.md` under "Martial Knowledge
and Martial Lore". These are the pieces left because each one only extends a pattern that already
exists. **Everything in "Already decided" below is settled. Do not reopen it.**

## 1. The weapon attack reads the martial state (if the Situation Mods pass has not already)

- **What:** a stance's and the made moves' to-hit, damage, extra dice, per-die damage, multiplier,
  Strength handling and seconds must reach a WEAPON attack. The function is ready:
  `getMartialAttackModifiers(actor.system.martial.state, { mode, martialAttack: false })`. It returns
  `{ list: [{label, value}], total, damage: { flat, extraDice, perDie, multiplier, strength, list },
  seconds, noAttack, noAttackReason, special }`.
- **Files:** `module/combat/attack.mjs` only (it was the main session's file during this pass, which
  is why it was not touched here). Check first with `grep -n martial module/combat/attack.mjs`.
- **Done looks like:** in `rollWeaponAttack`, append `tmpmartial.list` to the to-hit list passed to
  `getToHitModifiers` (or push the entries into its result); refuse the attack with
  `noAttackReason` when `noAttack`; add `damage.flat` to the damage roll; put `damage.extraDice`
  onto the dice with `addMartialDice`; add `damage.perDie x getNumberOfDice(dice)`; include
  `damage.multiplier` in `combineDamageMultipliers`; use
  `getMartialStrengthDamage(meleeDamage, damage.strength, hand == "both")` in place of
  `getStrengthDamageMod` when `damage.strength` is set; add `seconds` to the attack's time. The
  martial-card and `rollMartialAttack` in `martial-attack.mjs` do all of this already for a martial
  attack; copy that. Add a combat-test case: Strike as wind + Jump on a sword cut is +5 to hit.

## 2. Creature martial arts

- **What:** his creature sheet has the same martial section, reading Martial Knowledge and Lore off
  the creature's skill list (`getCreatureSkillChance`). The rules take a STATE, not a character, so
  nothing in `martial-arts.mjs` changes.
- **Files:** `module/data/actor-creature.mjs` (add the same `martial` SchemaField and a
  `_prepareMartialArts` reading the two chances from the creature's flat-chance skills),
  `module/sheets/actor-creature-sheet.mjs` + `templates/actor/tab-creature-combat.hbs` (the same
  panel, from `buildMartialPanel`), `module/combat/creature-attack.mjs` (append
  `getMartialAttackModifiers(...).list` as item 1 does for weapons -- his `handleCreatureAttack`
  reads `martial_arts_mod_melee` and `martial_stance_mod_melee`).
- **Done looks like:** a creature holding Martial Knowledge shows the panel and its attacks take the
  stance; a creature-test case proves it.

## 3. CHANGELOG entry for the next release

- **What:** one short entry in the existing voice. No version was cut in this pass.
- **Files:** `CHANGELOG.md` only (plus `system.json`/`dist/` if the user asks for a release).
- **Done looks like:** "Martial arts: open the Martial Arts heading on the Combat tab to choose a
  discipline and a stance, make moves, and roll martial attacks, blocks, holds and throws. A stance
  changes your defence, initiative and speed at once."

## 4. Show the made stance on the attack cards

- **What:** once item 1 is done the weapon card will list "Stance (Strike as wind)" in its to-hit
  line by name already; its damage breakdown in `templates/chat/attack-card.hbs` has no slot for
  martial damage. Add `{{#if damage.martial}} +{{damage.martial}} martial{{/if}}` the way `lore` is
  shown.
- **Files:** `templates/chat/attack-card.hbs`, `module/combat/attack.mjs`.

## 5. Parse-check and build lists

- **What:** `tools/syntax-check.html` lists the three new modules already. Run
  `python tools/build_system.py` and confirm it reports every module covered and finds
  `templates/chat/martial-card.hbs` (referenced as a `systems/imagine-rpg/...` path from
  `martial-attack.mjs`).

## Already decided (do not reopen)

- **Corrections to his code** are the three tables at the top of `martial-arts.mjs`
  (`MARTIAL_SKILLMOD_CORRECTIONS`, `MARTIAL_MOVE_CORRECTIONS`, `MARTIAL_STANCE_CORRECTIONS`) and
  nothing else; the generated tables in `combat-tables.mjs` stay his code. Each is UPSTREAM item 56.
- **Stance defence, initiative and speed are folded into `combat.defensiveAdjust`,
  `combat.initiativeMod` and `combat.weaponSpeedMod`** in `_prepareMartialArts`. Do not add them
  again at attack time; `getMartialAttackModifiers().seconds` is the MOVES' seconds only.
- **Blind fighting belongs to the Situation Mods** (`combat.martialBlind`), not to the attack
  modifiers.
- **Missile attacks take only the stance's missile to-hit**, per his missile branch.
- **Nothing applies without Martial Knowledge held and past its title.** A stance must be in
  `system.martial.stances` to be held; a move must be known to be made.
- **Martial Lore values roll against Martial Lore**, not Knowledge (UPSTREAM 56 item 7).
- **A martial attack is one click** (skill roll and roll to hit together); a failed skill roll halves.
- **Not to be built without the user or the developer:** missing-limb checks (the port has no lost
  limbs), stance bonuses to other skills and saves, and a speed for Martial Lore values -- all three
  are open questions in UPSTREAM 56.
