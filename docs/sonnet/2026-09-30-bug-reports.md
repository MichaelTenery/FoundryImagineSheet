# 2026-09-30 — His ten bug reports: what's left for a cheaper window

Already decided. See DECISIONS 2026-09-30 ("His ten bug reports of 2026-09-30, and the model
behind untrained skills"); don't re-open these. In particular: click prompts for a modifier and
shift-click skips (not the other way); two hands is +2 DAMAGE, not to hit, and the book's −2 speed
is asked not built; his Common Skills Listing settles `isRestricted` for class skills; Spell Lore's
`noNonAcquiredUse` is a manual override; non-acquired stops at 10th title; Botanist is Botany
everywhere; only Long Sleeve Shirt takes his table.

1. **Live Foundry checks.** Nothing here has run in a real V14. In a world, check each and fix
   only what fails:
   - `module/sheets/actor-character-sheet.mjs` `_onDropItem(event, item)`: V13+'s
     `ActorSheetV2` passes the Item document; if V14 passes drag data instead, resolve it with
     `Item.implementation.fromDropData` first. Drop a compendium Rope on a character that holds
     one: the quantity rises, no second row. Drop a Sword: a second item, as before.
   - The ✂ Split button (`splitItem`): appears only at quantity > 1; splits N off into a row.
   - `module/data-fixes.mjs`: on the GM's first load of a world holding a "Botanist" skill item
     it is renamed (or dropped if Botany is also held), the console says so, and the setting
     `dataFixesApplied` holds `["botanist-to-botany"]`; a second load does nothing.
   - The untrained dialog's two `<optgroup>`s render in DialogV2 and the chosen id comes back.
   - The Class Progression row buttons (`rollNonAcquiredSkill`) roll and the lock icons tooltip.
   - Every roll button now prompts; Shift-click does not. The creature sheet's attribute save
     prompts too.
   Done when each is ticked off in a reply to this note, with any fix and a test where one fits.

2. **Styles for the new row buttons.** `.non-acquired-roll` on the Skills tab and the ✂ on the
   Equipment tab use the existing `.row-button` class; if they crowd the row, give
   `.non-acquired-roll` a smaller font and `margin-left: .25em` in `styles/`. Done when the rows
   look like the neighbouring ones in `tools/sheet-preview.html`.

3. **`tools/chargen-preview.html` and `tools/sheet-preview.html`:** show a non-acquired skill.
   The sheet preview's Warrior has no class rows; the Elemental Dancer render lower on the page
   does. Pass a lookup built with `buildNonAcquiredLookup(actor, index)` (index from
   `skills.json`) into `#buildClassProgress`'s duplicated harness copy so the buttons render.
   Done when the preview shows a dice button on an unreached row with no console errors.

4. **Graphify rebuild.** New modules `module/roll-modifier.mjs`, `module/data-fixes.mjs`,
   `module/non-acquired.mjs`. Run the three commands in `CLAUDE.md`. Done when
   `graphify query "non-acquired skills"` finds `canUseNonAcquired`.

5. **UPSTREAM items 115-117 are `open`.** When the user passes them on, set them to `raised` with
   the date. If he answers 116 "yes, all three shirt families", add the Full Shirt and Long Shirt
   rows to `COST_REPAIRS` and `ARMOR_VALUE_REPAIRS` with the same numbers and rerun both
   extractors; the shop test's disorder count drops by one more (Full Shirt(Giant Scales)).

6. **`docs/task-dependencies.json` and the board** carry the new rows; `tools/progress.html`
   should show no warning. Done when it does not.

Not for this window (they need a ruling): the −2 weapon speed for two hands (UPSTREAM 115); the
four PG skills his listing omits (117); whether a removed class skill (given up at creation) is
attemptable as common at all -- his note says "they don't even have a base score to roll", the port
leaves it attemptable only if it is on his Common Skills Listing, which none of the removable
(non-core) ones need be.
