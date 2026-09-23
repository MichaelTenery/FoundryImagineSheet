# Situation Mods and Second Weapon lists: mechanical follow-through (2026-09-22)

This pass built the melee and missile Situation Mods window and fixed Second Weapon Knowledge/Lore,
which had never applied. The reasoning is in `docs/DECISIONS.md` under "Situation Mods: the melee and
missile modifiers window, and Second Weapon held per weapon". These are the pieces left because each
one only repeats a pattern that already exists. **Everything in "Already decided" below is settled.
Do not reopen it.**

## 1. Creature preview: show the Situation Mods bar

- **What:** `tools/creature-preview.html` builds its own copy of the creature sheet's context. The
  real sheet now adds `situationLine` (from `describeSituationalTotals` in
  `module/situational-view.mjs`), but the copy doesn't, so the new bar always reads "none set" there.
- **Files:** `tools/creature-preview.html` only.
- **Done looks like:** give the preview creature a `combat.situation`, for example
  `{ kind: "melee", selected: ["selfFadeDark", "positionRear"], weaponId: "" }`, add
  `situationLine: SV.describeSituationalTotals(creature.combat.situational)` to its context, and
  check that its Combat tab shows the line and a Defence 8 lower. `tools/sheet-preview.html`
  already does exactly this for the character; copy that.

## 2. Changelog text for the next release

- **What:** a CHANGELOG.md section for whichever version ships this. No version was cut in this
  pass, and `system.json` and `dist/` were left alone, because releasing is the user's call.
- **Files:** `CHANGELOG.md`, plus `system.json`/`dist/` only if the user asks for a release.
- **Done looks like:** two short entries in the existing voice:
  1. "Melee / Missile Mods" on both Combat tabs opens his situational modifiers. They hold until
     cleared, and they also move the character's own Defence.
  2. Second Weapon Knowledge and Lore now work: name the weapons on the Combat tab's Lore panel.
     Before this they never applied.
- Keep the standing "not verified in a running V14" caveat.

## 3. Weapon item sheet: stop showing the removed booleans (check only)

- **What:** `secondWeaponKnowledge`/`secondWeaponLore` were removed from `item-weapon.mjs`. A grep
  found no template or preview that used them. Re-run
  `grep -rn "secondWeaponKnowledge\|secondWeaponLore" templates tools module` and confirm that
  the only hits are `combat-rules.mjs`, `attack.mjs`, the two sheets, the Situation Mods window, and
  the tests, all of which now get these flags from `getSecondWeaponFlags`.
- **Done looks like:** that grep shows nothing reading them off a weapon item's stored data.

## Already decided, do not reopen

- The Second Weapon lists are the authority; the per-weapon flag is derived. The booleans stay removed.
- Situation Mods live on the actor (`combat.situation`), not in the attack dialog.
- The figures come from `handleMeleeSet`/`handleMissileSet`, not from his labels. Multipliers add
  and cap at x3. The multi-missile boxes pick the firing mode and don't count a penalty of their
  own.
- Set for one kind, the other kind's attacks read none of it, special words included.
- The dialog's typed number is labelled "Modifier"; "Situational" means the window's figures.
- UPSTREAM-ISSUES 53-55 are questions for him. Until he answers, build what the code does, as noted
  there.
