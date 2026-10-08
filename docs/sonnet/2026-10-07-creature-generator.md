# 2026-10-07 — Create Creature window: what the pass left for a cheaper window

Done: `module/apps/creature-generator.mjs` with `creature-gen-tables.mjs`, `creature-gen-rules.mjs`,
`creature-gen-view.mjs`, `templates/apps/creature-generator.hbs`, a Create Creature button for Game
Masters, `game.imagine.generateCreature()`, and `tools/creature-gen-test.html` (169). See
`docs/DECISIONS.md` 2026-10-07 "A Create Creature window".

**Already decided, do not re-litigate:** PP are charged per attribute at its band; resistances come from
the attribute tables as a character's do; the errata's hide cap is enforced in the window with one
allow-over tick; negative PP add no level and take none away; Grandmaster is 12 PP; standard attacks
carry the item's default 3 seconds; an ability pick carries its list ("Insanity" is on two).

## 1. Release housekeeping (mechanical)
- Add a CHANGELOG.md entry for the next release (0.25.0: a new window is a feature): "Create Creature:
  a step-by-step designer by the Master's Manual's Creature Creation Guide (pp.281-298), for Game
  Masters, in the Actors directory. Power points to level, his experience table with the errata's
  level 0 row, the hide cap applied." Also carry the 2026-10-07 players-create line from
  `docs/sonnet/2026-10-07-players-create.md`, still pending.
- Bump `system.json`, rebuild `dist` with `tools/build_system.py` (it must pick up the new template
  and modules; its path check will say), mention the button in README.md and dist's README.
- `graphify update ./module --no-cluster` then the merge (CLAUDE.md), so the graph knows the four files.

## 2. A preview page (mechanical, the chargen-preview.html pattern)
`tools/creature-gen-preview.html`: render `templates/apps/creature-generator.hbs` with Handlebars
against `buildCreatureGenView` for each of the seven steps, as `tools/chargen-preview.html` does for
the character generator, so the template's bindings are seen before a V14 install is. Done looks
like: every step renders with the wolf and the dragon states from the test, no undefined in the text.

## 3. Rider effects on bought attacks (mechanical extension of an established pattern)
Venom, Stinger, Disease Bearing and the breath attacks imply a rider effect on the attack item
(`system.effects`, `attackEffectField` in `module/data/item-creature-attack.mjs`). When Venom is among
the abilities, put an effect `{ name: "Venom", trigger: "If hit", damageType: "Poison" }` on each
Fangs/Claws/Stinger item made; Disease Bearing likewise with "Disease". The trigger list is
`EFFECT_TRIGGERS` in `creature-tables.mjs`. Done looks like: the wolf test with Venom added has an
effect on its Fangs; nothing on its Bite unless Venom is ticked for it too (ask the user whether a
bite carries venom by default; the book says Venom "must be combined with claws, fangs, stinger, or
any other type of attack" -- any).

## 4. The chapter's "creature template" (mechanical)
The book asks that the ranges be recorded with the instance ("13 (1d4+10)"). The design state is
already saved on the actor (`flags.imagine-rpg.creatureDesign`). Write the bands and dice into
`system.notes` as a second paragraph ("Template: STR Medium 7-16 (3d4+4), ..."), from
`deriveCreatureDesign(...).attributes.rows`. Done looks like: the notes carry one line per attribute.

## 5. Reopen a design (not mechanical; ask first)
A "Redesign" button on the creature sheet that opens the window with the saved
`creatureDesign` flag and, on Create, UPDATES the actor instead of making a new one. Needs a decision
on what happens to items added since. Not started.

## Not done, and not mechanical
- Supernatural Servants (MM pp.299-300, replaced wholesale by the errata's tables): a design of its own.
- The Famorian and evoke body builders: the model's standing gap.
- Movement for the Amorphous and Floating Orb bodies: the book has none; the window says so.
