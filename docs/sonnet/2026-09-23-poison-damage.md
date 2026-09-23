# Hand-off: poison damage on overall Endurance, and poisoned weapons (2026-09-23)

Decided, not to be re-opened (DECISIONS 2026-09-23): poison damage goes on `body.overallWounds` only,
counted in `totalWounds`; each interval lands at the end of the interval after the onset; a plain
coating is one dose spent by the first hit that does actual flesh damage; an Envenomed blade holds 5
and delivers one per thrust of 10+ (Mysteries of the Planes p.175); gases cannot coat.

## 1. Show and edit overall wounds on both sheets

`templates/actor/tab-combat.hbs` and `tab-creature-combat.hbs` list per-area wounds (inputs named
`system.body.wounds.<area>`) and total wounds / shock. Add one row, "Overall (poison)", with a number
input named `system.body.overallWounds`, so the table can heal it. **Done when** both sheets show it,
typing in it changes the total, and the sheet preview renders it.

## 2. Test the model's inclusion

Add to `tools/derive-test.html` and `tools/creature-test.html` a check that `body.overallWounds` of 7
adds 7 to `totalWounds` and can tip `inShock`, beside their existing "total wounds are summed" checks.

## 3. Document the fields

`docs/DATA-MODEL.md`: `body.overallWounds` (both actors) and the weapon's `system.coating`
{ name, poisonType, poisonPotency, form, doses } -- wording from the field comments in
`module/data/actor-character.mjs` and `module/data/item-weapon.mjs`.

## 4. Changelog text (with the next release)

> **Poison hurts.** A poison card has an Apply button for each victim its damage reaches: the damage
> goes on overall Endurance, counting toward shock, as each interval of its duration ends. **Poisoned
> weapons.** A poison's Use can coat a weapon you carry; the next hit that draws blood delivers it and
> rolls the target's Poison Resistance. An Envenomed blade holds up to five doses and delivers one with
> each thrust of 10 or more.
