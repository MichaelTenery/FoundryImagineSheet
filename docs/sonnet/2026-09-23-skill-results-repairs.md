# His eight skill results, and the repairs the books settle: mechanical follow-through (2026-09-23)

This pass ported his `handleSkillRollDetails` (sheet-worker.js:29426) into every skill roll, gave both
sheets' attribute saves his `divideWithMin` half, and applied the race and kit fixes his errata and the
books settle as logged repairs. Reasoning: the 2026-09-23 DECISIONS entry "His eight skill results, and
the repairs the books settle". **Everything in "Already decided" is settled; do not re-open it.**

## Already decided

- **Three readers, kept apart.** `resolveSkillRoll` (his eight results) for every skill roll: skills,
  untrained skills, a creature's skills, the martial knowledge and lore rolls. `resolveAttributeSave`
  (three results, half rounded DOWN with a floor of 1) for the saves on both sheets. `resolveSkillOutcome`
  (four results, no Grandmaster, no 100 rule, no half) ONLY for the Situation Mods window's six
  roll-set options, because his situational handlers (19112ff) read their own dice inline. Lore use,
  lore learning and brewing (`lore-rules.mjs settleRoll`) and the acquisition rolls (stances, missile
  combinations) are his own inline readers too and are not skill rolls. Do not merge any of them.
- **A skill's half rounds UP** (`parseInt((chance+1)/2)`); a save's rounds DOWN with a minimum of 1.
  Both are his. **No natural-01 success** on a skill roll: his function has none, the sheet outranks
  the book (PG p.326), and it is a question for him (new upstream item), not a gap to fill.
- **A card says the result and whether it passed** (`describeSkillResult`): "Made by half (succeeded)",
  "Rolled 100 (failed)", as his cards end "Result=... Succeeded? = ...".
- **Repairs are data, printed every run, and step aside for a corrected sheet.**
  `column_maps.RACE_VALUE_REPAIRS` (race cells), `column_maps.RACE_SECOND_SPECIAL_MOVEMENT` (Nixie's
  swim), `KIT_BREAK_REPAIRS` and `@MARKER DIE SWITCH` in `extract_starting_kit.py` (kits). Each names
  the value it expects to find and reports "no longer needed" when his row changes. Never hand-edit
  `src/packs/documents/*.json` or `module/starting-kit-tables.mjs`; rerun the extractor.
  **Run `build_documents.py --write` only where the rulebook text is present** (the main checkout):
  in a worktree without `docs/reference/*-fulltext.txt` it flips 305 skills' `isRestricted` to false.
- **Gaunt's -1d4 is rolled once, into the character's own copy of the race** (`rollStartingEndurance`,
  `race-rules.mjs`): `startMod` holds the result, `startRolled` says it is done. The race document keeps
  `startMod 0`, `startRolled false`. Rolled by the generator, by the `createItem` hook when a race is
  dropped on a character, and by the header's "Roll -1d4" button for a copy made before
  (`module/race-endurance.mjs`). Never re-rolled.
- **A second special movement is derived, never stored on the character** (`movement.secondSpecial`,
  `_prepareMovement`), and a half race takes the first race's, as it takes the first special.

## 1. The two other rates that break the ten-times rule

- **What:** `tools/derive-test.html` lists two rows whose 10-second rate is not ten times the 1-second
  one: **Midfolk(Town) run** and **Testudara run**, both `-1 / -10 / -10` (sheet-worker.js:34098,
  34117). Look each up in the book text (Town Midfolk, Player's Guide p.23; Testudara, Mysteries of the
  Planes). If the book prints `-1/-10/-1`, add a `RACE_VALUE_REPAIRS` entry (`run1Sec`, `-10`, `-1`,
  "PG errata p.36 ...; <book> p.N prints -1/-10/-1") and empty the test's expected list. If the book
  prints something else, leave the data alone and add the finding to the new upstream item on these
  two rows.
- **Files:** `tools/extract/column_maps.py`, then `python tools/extract/build_documents.py --write` (in
  the main checkout, see above); `tools/derive-test.html`.
- **Done looks like:** the build prints the new REPAIRED lines; the derive check "every other rate keeps
  ten seconds at ten times one second" expects `[]`; everything else unchanged.
- **Already decided:** PG errata p.36 ("All 10 second movement times now match 10x1 second movement") is
  the rule. **Needs the user's yes first** -- these two were not in the list the provisional ruling of
  2026-09-23 covered, so ask before applying, even if the book agrees.

## 2. Give the eight results a colour on the chat card

- **What:** every skill card now names one of his eight results in `<strong>`. Add a class per result
  (e.g. `result-made-by-half`, `result-critical-failure`) from the result's flags -- `made`, `critical`,
  `byHalf`, `criticalFail`, all on what `resolveSkillRoll` returns -- and style them in
  `styles/imagine-rpg.css` beside the existing `.skill-roll-line.chosen`, using the sheet's own theme
  variables. The wording does not change.
- **Files:** `module/skills-rules.mjs` (`describeSkillResult` can carry the class), both sheets' skill
  cards, `templates/chat/martial-card.hbs`, `styles/imagine-rpg.css`.
- **Done looks like:** a critical success and a critical failure read differently at a glance; the
  derive-test checks on `describeSkillRoll`/`describeSkillResult` are updated to the new markup and
  still pass.

## 3. Record the status changes in UPSTREAM-ISSUES.md

- **What:** this pass settles or acts on items 2 (Gaunt), 4 (made by half vs +/-20), 24 (Sea/Ice Elf),
  39.1 (Podling jog), 42 (kit breaks) and 47 (Nixie swim). Add to each a dated line saying what the port
  now does and on what evidence (the evidence is in the DECISIONS entry), and change item 4's status to
  answered by his own code. Item 42's "What the port does meanwhile" paragraph is now wrong: the bands
  are repaired, not followed.
- **Files:** `docs/UPSTREAM-ISSUES.md` only.
- **Done looks like:** no item still describes the old behaviour.

## Waiting on the user, not mechanical

- **Characters already made keep their own copy of their race.** A Sea or Ice Elf made before this still
  has Disease 0, a Podling jogs -60 and a Nixie has no swim (a Gaunt gets the header's Roll button). The
  fix for each is to run `game.imagine.importContent()` and then REMOVE the race from the character and
  add it again -- removing first, because dropping a second race on makes a half race. Whether to write a
  migration instead is the user's call; a system `migrateData` cannot do it cleanly, since it is not
  given the item's name.
