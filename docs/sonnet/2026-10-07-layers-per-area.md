# 2026-10-07 — Every layer on a body area, with what each gives

Player request, relayed by the user 2026-10-07: "once we do the combat tab, show all layers
affecting a body area." Logged on the board (Epic 7, "Combat tab: every layer on a body area").
Not built in this pass; it is a mechanical extension of what is there.

Already decided, do not re-litigate:
- Armour damage is **per area**, not per layer (`body.armorDamage[areaName]`), as his sheet keeps
  it (`bodyarea*_damage`). Show it once against the area's total; do not try to spread it over
  the pieces.
- The shield is the **fifth layer** over the four armour layers (his `bodyarea*_shield_layer5`),
  untouched by armour damage. It is listed last.
- Nothing in his data ties a running effect to an area; the panel's "Effects" list stays the
  whole being's. This request is about armour layers only.
- The body figure is a pure view over `body.areas`; no new numbers are derived there.

What to do:

1. **`getAreaArmor` (`module/combat/combat-rules.mjs`, ~1382).** Keep `armor`, `materials`,
   `layers` as they are (callers and 27 suites read them) and add `pieces`: one object per
   contributing item, in wearing order innermost first --
   `{ name, value, material, place, kind }` where `value` is the piece's coverage at
   `tmpcover.slot`, `place` is its 1-based position in
   `getLocationStack(tmpworn, tmpcover.slot).stack` (`module/equip-rules.mjs:76`; pass
   `tmpcheckfirst = false`, legality is not the question here), and `kind` is `"clothing"` when
   `consumesLayer(item)` is false (`equip-rules.mjs:63`), else `"armour"`. A gated area
   (`requiresItem`, barding) filters exactly as the existing loop does.
2. **`getAreaShield` (same file, ~1487).** Add `pieces` the same way: `{ name, value, material,
   place: 5, kind: "shield" }`, `value` being the share that shield adds at this area.
3. **Both actor models.** `_prepareBody` in `module/data/actor-character.mjs` (~918) and
   `module/data/actor-creature.mjs` (~782) push `layers: tmplayers.concat(tmpshielded.layers)`.
   Add `pieces: tmpcover.pieces.concat(tmpshielded.pieces)` beside it. Leave `layers` (names)
   in place: the tooltips, `describeArea` and the tests read it.
4. **`describeArea` (`module/body-view.mjs`, ~392).** Pass `pieces` through as it passes
   `layers`, defaulting to `[]`, and document it in the shape comment above the function.
5. **`templates/actor/body-figure.hbs` (~99).** Replace the plain `<ul class="body-layers">` of
   names with one row per piece: place, name, value, material -- e.g. "1 Padding 2 (Cloth)",
   "2 Chain Mail Shirt 6 (Chain)", "5 Buckler 8 (shield)" -- then the area's damage and total
   as now. Clothing that takes no layer shows "—" for its place.
6. **`templates/actor/tab-combat.hbs` (~282) and `tab-creature-combat.hbs` (~290).** The
   request is "show", not "show on hover". Keep the tooltip, and add under the Armour value a
   `muted` line of the pieces in order, "Padding 2 · Chain Mail Shirt 6 · Buckler 8". If the
   table gets too wide, a second row per area is acceptable; do not drop the tooltip.
7. **Tests.** `tools/body-test.html` ~128 builds an armoured area with `layers: [...]`; give it
   `pieces` as well and check `describeArea` carries them in order. The combat suite that covers
   `getAreaArmor` (grep `getAreaArmor` under `tools/`) gets one check that `pieces` sums to
   `armor` and is in stack order, and one that a shield piece carries `place: 5`.
8. **Changelog.** One line under the next release in `module/changelog.mjs`: "Each body area
   now shows every layer covering it, with what each gives."

"Done" looks like: the clicked-area panel and both Combat tab tables show each covering piece
with its place, value and material, innermost first and shield last, and the pieces' values add
up to the area's armour before damage. Existing checks unchanged; the new checks pass.
