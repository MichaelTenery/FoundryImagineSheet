# 2026-09-25 — Daryl's notes pass: what's left for a cheaper window

Already decided. See DECISIONS 2026-09-25; don't re-open these.

1. **CHANGELOG + version bump.** Add an entry covering: Fortune for starting money is now AUR/PTY/WIL only; shift-click modifiers now work on the character sheet's saves, Perception/Affinity/Fortune and skills; the untrained picker shows each skill's chance; the skills tab shows Source, Page. Then bump `system.json` and rebuild the zip, following the existing release routine. Done when the build shows no "unbumped" warning.
2. **Shift-click on weapon attacks.** `#onRollWeaponAttack` (module/sheets/actor-character-sheet.mjs) doesn't ask for a modifier yet. Add it the same way, with `#askModifier` and the result added to the chance. Check `module/combat/` for where the chance is formed first.
3. **Stale comment.** `getCharacterMoneyInputs(tmpSystem, tmpClassSystems)` no longer uses its second argument. Either drop it from the function and its callers, or leave a comment saying it's unused.
