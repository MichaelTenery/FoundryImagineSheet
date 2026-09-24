# Creature sheet, authoring and damage: what the pass left for a cheaper window

This pass closed the creature audit's gaps G1, G2, G4, G7 (with the size field, D6), G10, G11 and G13
on the creature side. The rules are in `module/creature-sheet-rules.mjs` (new),
`module/combat/creature-rules.mjs` (`getCreatureDamageMods`, `getCreatureMartialModifiers`) and
`module/combat/combat-rules.mjs` (`getWeightDamageAdjust`, `getShockBar`). The sheet is
`module/sheets/actor-creature-sheet.mjs` (@MARKER AUTHORING). Tests are in `tools/creature-test.html`
(223). See `docs/DECISIONS.md`, "Creatures can be built on their sheet, and hit as hard as his sheet
says (2026-09-23)".

**Already decided, do not re-open.** Each of these is provisional until the user confirms, but a Sonnet
pass should build on it as it stands:
- D2. Strength, body weight, Weapon Lore's +4 and the temporary modifier go on every natural attack
  except a Touch. That includes breath, gaze and area attacks, as `handleCreatureAttack` does. An attack
  with no damage entered does no damage.
- D3. A small creature's negative Strength figure stands. Only the weight part is floored at 0.
- D4. The errata hide cap is a sheet warning. `body.hide` is never clamped in derivation.
- D6. `identity.size` uses the Master's Manual p.295 list (`CREATURE_SIZES`). Blank means not given.
- D7. The sheet is edited in place. His Configurator stage-then-Finish flow is not ported.
- D9. The token bar is `body.shockBar`, which is Shock minus total wounds, on both actor types.
- Martial arts on a natural attack: the to-hit follows the attack's kind, the damage applies whatever
  the kind, and a Touch gets nothing. This corrects DECISIONS 2026-09-22.
- A creature's Weapon Lore and Missile Lore give the general figures if the creature holds the skill by
  its exact name at level 1 or higher.

## 1. The character's melee weapon damage gains the signed body-weight term

**What to do.** In `module/combat/attack.mjs`, in the damage block (the `@str` term), add
`getWeightDamageAdjust(tmpsys.physical.weight, false)` as `@weight` for **melee modes only**. His
character path zeroes it for missiles (sheet-worker.js:64621-64626, 65030-65033). Put the figure on
the card's `damage` object as `weight`, then add `{{#if damage.weight}} ±N weight{{/if}}` to
`templates/chat/attack-card.hbs` beside STR. The function already exists, is signed for a character and
is tested against his `getWeightDamageAdj` at every pound from 0 to 12,000.

**Why not done here.** It is the character's attack path, outside this stream. Other streams working in
`attack.mjs` today would have conflicted with it.

**Done looks like.** Two checks in `tools/combat-test.html`: a 60 lb Midfolk's melee damage carries -2,
and its missile damage carries 0. Light characters (Fairy -4, Midfolk -2, Elf -1) hit a little softer
and heavy ones harder, as the Player's Guide p.179 table says. Add a CHANGELOG line.

## 2. The Modifiers panel on the character sheet (G13, character side)

**What to do.** Mirror the creature's Stats-tab panel (`tab-creature-stats.hbs`, @MARKER MODIFIERS
PANEL, and `#buildModifierRows`) on the character sheet. The panel needs attribute `permMod`/`tempMod`,
the characteristics' `tempMod`, resistance `tempMod`/`permMod`, and `combat.meleeMisc`, `missileMisc`,
`damageMisc`, `defenseMisc` and `initiativeMisc`. Open/closed is sheet state (`_modifiersOpen`), as the
martial panel is. First check the character schema's own field names in `actor-character.mjs`: they
are not all the creature's.

**Leave out `combat.skillMisc`.** No code reads it on either actor. His creature skill roll never reads
`combat_mod_skill` either (handleCreatureSkillRoll, 175374). Whether the character's skill rolls should
read it is a separate question.

**Done looks like.** Every field listed appears in `tools/sheet-preview.html` and writes back.

## 3. One copy of the characteristic-roll table

**What to do.** `CHARACTERISTIC_RESULTS` and the three-band rule now live in
`module/creature-sheet-rules.mjs` as `resolveCharacteristicRoll`, and the creature sheet uses them. The
character sheet still has its own identical copy (`actor-character-sheet.mjs`, @MARKER CHARACTERISTIC
ROLL). Make the character's `#onRollCharacteristic` call `resolveCharacteristicRoll` and delete its
table. While there, add the shift-click modifier the creature's buttons have (his `+mod` buttons).

**Done looks like.** Nothing in the character's chat output changes except the optional modifier
wording. `grep CHARACTERISTIC_RESULTS module` finds one definition.

## 4. A "Paste list" for creature skills

**What to do.** Add a button on the Skills tab that opens a `DialogV2` with a textarea. It runs
`ImagineCreatureData.parseSkillList` (his `createAllCreatureSkills` format, "Ambush 45%, Blend 30%")
and appends the rows. It should also report, without refusing them, any names not found in
`world.imagine-skills` (index names), as his rejected list does (22816-22905). His ten book-format
clean-ups ("Skills:", " and", "*", "[ ]") belong to the stat-block importer (G3) and are not needed
here.

**Done looks like.** Pasting "Ambush 45%, Blend 30%" adds two rows. An unknown name is listed in a
notification.

## 5. PHY / MEN / PER / MYS quick-set

**What to do.** Add four small inputs above the attribute table. Each writes the value to all three
attributes of its group, and only when the value is above 0, as his handlers do (22215-22261). The
books print grouped attributes ("MEN 2, MYS 2"). The inputs are not stored: use an action that reads
the input's value and updates the three ratings.

**Done looks like.** Typing 2 in MEN sets Intelligence, Wisdom and Knowledge to 2.

## 6. Pick traits from the compendia, not only blanks

**What to do.** The Traits tab's Add buttons create a blank trait and open it. Point them at the item
picker (`module/apps/item-picker.mjs`) instead, as the Equipment tab's Add buttons do. Add three
`PICKER_PACKS` rows: `world.imagine-abilities`, `-disabilities` and `-immunities`, type `trait`.
`#onPickItem` must not stamp `location: "carried"` on a trait. The blank-item path must set
`system.category`. The picker's "already knows" check is fine for traits.

**Why not done here.** `item-picker.mjs` is shared, and other streams edit its table.

## 7. The creature's carried gear: an equip toggle

**What to do.** The Combat tab's new "Carried" list only opens and removes items. Add the equip toggle
(`location` carried/equipped) the character's Equipment tab has. This is the first mechanical part of
G8 (creatures using weapons). The weapon Attack button and proficiency (D10) are the rest of G8 and are
not mechanical.

## 8. Small mirrors

- `tools/derive-test.html`: one check that a character carries `body.shockBar` (Shock less total
  wounds). Only the pure `getShockBar` and the creature's copy are tested now.
- `system.json`: set `"primaryTokenAttribute": "body.shockBar"` so new tokens of either type show the
  bar without being configured. The `CONFIG.Actor.trackableAttributes` side is done, in
  `imagine-rpg.mjs` @MARKER TOKEN BARS. This is a release step, left to whoever bumps the version.
- `tools/creature-preview.html`: the modifier panel's attribute rows use the key as the label ("str").
  Use the names, as the sheet does.

## Not mechanical, left out of this stream on purpose

These need judgement or a decision first, so do not pick them up as Sonnet work:
- The creature compendium (D1, a publication decision; local-only generator).
- The stat-block paste importer (G3, D5, D11, D12).
- Powers: period, refill and lookup (G5, D8).
- Creatures using weapons (G8, D10).
- Common skills for creatures (G9).
- Multi-type headers (G12, D5).
- Body-area rolls (G14), grappling (G15), and race-to-creature conversion (G16).
- The size rules the new field could drive (Master's Manual p.127: Bear Hug, Smash, Squish).
- Clamping the hide cap on imported data (D4's second half belongs to the importer).
- Whether a creature's martial ATTACKS (`rollMartialAttack`, a Martial Punch) should also take the weight
  term. His `getMartialDamageDetails` was not checked for it in this pass.
