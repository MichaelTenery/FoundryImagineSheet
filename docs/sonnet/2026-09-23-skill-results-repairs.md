# His eight skill results, and the repairs the books settle: mechanical follow-through (2026-09-23)

This pass ported his `handleSkillRollDetails` (sheet-worker.js:29426) into every skill roll, gave both
sheets' attribute saves his `divideWithMin` half, and applied the race and kit fixes his errata and the
books settle as logged repairs. Reasoning: `docs/DECISIONS.md`, 2026-09-23, "His eight skill results,
and the repairs the books settle" (this stream may not edit DECISIONS.md; the entry is written in when
the branch is merged, and the evidence item 3 below needs is repeated there in full, so nothing here
depends on it). **Everything in "Already decided" is settled; do not re-open it.**

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
  the book (PG p.326), and it is a question for him (UPSTREAM 98, "A natural 01 on a skill roll"),
  not a gap to fill.
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
  `race-rules.mjs`). The result is SET in its own field, `startRoll` -- never added into `startMod` --
  and `startRolled` says it is done. The character's modifier is `startMod + startRoll`
  (`getStartingEnduranceMod`, which the character model, `combineHalfRace` and `combineFormless` all
  read). The race document keeps `startMod 0`, `startRoll 0`, `startRolled false`. Rolled by the
  generator, by the `createItem` hook when a race is dropped on a character, and by the header's
  "Roll -1d4" button for a copy made before (`module/race-endurance.mjs`), which asks first when that
  copy's `startMod` is not 0 (`getStartingEnduranceRollWarning`), since before 2026-09-23 typing the
  penalty there was the only way to give a Gaunt one. Never re-rolled by the port; a Game Master who
  unticks Start rolled gets the button back, and the new roll replaces the old.
- **A Formless in a Gaunt body starts at its host copy's -1d4**, not the flat +4 his Formless copy of
  the Gaunt row carries (`formlessRace.json` `hostCopyDiffers`). That follows the 2026-09-21 call that
  the host's own race document is read, never his second copy of it.
- **A second special movement is derived, never stored on the character** (`movement.secondSpecial`,
  `_prepareMovement`), and a half race takes the first race's, as it takes the first special.

## 1. The two other rates that break the ten-times rule

- **What:** `tools/derive-test.html` lists two rows whose 10-second rate is not ten times the 1-second
  one: **Midfolk(Town) run** and **Testudara run**, both `-1 / -10 / -10` (sheet-worker.js:34098,
  34117). Look each up in the book text (Town Midfolk, Player's Guide p.23; Testudara, Mysteries of the
  Planes). If the book prints `-1/-10/-1`, add a `RACE_VALUE_REPAIRS` entry (`run1Sec`, `-10`, `-1`,
  "PG errata p.36 ...; <book> p.N prints -1/-10/-1") and empty the test's expected list. If the book
  prints something else, leave the data alone and add the finding to UPSTREAM 100, "Two more rows
  break the ten-times movement rule: Midfolk(Town) and Testudara".
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

**DONE 2026-09-24, at the 0.20 integration.** Items 2 and 4 are marked answered; 24, 39.1, 42 and 47
carry a dated line saying what the port now does; the three new items are 98, 99 and 100.

- **What:** this pass settles or acts on six items. Add to each a line dated 2026-09-23 saying what the
  port now does and on what evidence, as below, and change item 4's status to answered by his own code.
  Item 42's "What the port does meanwhile" paragraph is now wrong: the bands are repaired, not followed.

  | Item | What the port now does | Evidence |
  |---|---|---|
  | 2 (Gaunt) | rolls -1d4 once into the character's copy of the race (`startRoll`) | Epitaph of the Fallen p.7, "Starting Endurance -1d4"; his row's live `[0-getDieRoll(4)]` beside "-1d4=" (sheet-worker.js:34058) |
  | 4 (made by half vs +/-20) | skills get both, via `handleSkillRollDetails` ported as `resolveSkillRoll`; saves get made by half only | his own `handleSkillRollDetails` (29426) and `divideWithMin` (25595) |
  | 24 (Sea/Ice Elf) | Disease -10 at index 37; speed multiplier 0 at 38 | Legends p.27 (Ice) and p.28 (Sea), "Disease -10%" and "Movement: as Elven"; his Formless copies (34950-34951) have the multiplier at 0 |
  | 39.1 (Podling jog) | 1-second jog -6, not -60 | PG errata p.36, "All 10 second movement times now match 10x1 second movement" |
  | 42 (kit breaks) | social 5 (five kits) and 12-13 (four kits) get their own band | MM errata p.30 (Trolls, social 5 and 6 printed apart); PG errata p.31 (Saurian 12-13); PG p.15, p.21, MM p.26, p.27 race kit tables |
  | 47 (Nixie swim) | swims (Walk x5) as well as flies, as a second special movement | Legends p.33, "Enhanced Swimming (5x walking speed)" beside "Magical Flight"; his Formless copy of the row (34996) |

  Also add the three new items this pass raised, from the branch's hand-off text if the merge has not
  already put them in: "A natural 01 on a skill roll", "The Standard kit's social 12-13 weapon roll has
  no breaks", and "Two more rows break the ten-times movement rule: Midfolk(Town) and Testudara".
- **Files:** `docs/UPSTREAM-ISSUES.md` only.
- **Done looks like:** no item still describes the old behaviour, and the three new items are there.

## 4. His errata's "STR max is now 13", on eight races

- **What:** four of his errata files give eight races a Strength maximum of 13, "allowing them to
  qualify to be warriors". The built documents still carry his sheet's older limits:

  | His race (built as) | Limit now | Errata |
  |---|---|---|
  | Brownie | 12 | Aspects errata p.2 (Brownies) |
  | Fairy(Dark) (Fairy(Dark Winged), Fairy(Dark Wingless)) | 11 | Aspects errata p.4 (Dark Fairy) |
  | Fairy (Fairy(Winged), Fairy(Wingless)) | 10 | MM errata p.24 (Fairy) |
  | Mephyt(Fire) | 11 | Legends errata p.30 |
  | Mephyt(Ice) | 12 | Legends errata p.31 |
  | Nixie | 11 | Legends errata p.33 |
  | Podling (Podling(Winged), Podling(Wingless)) | 9 | Mysteries errata p.36 |
  | Sporeling (Sporeling(Winged), Sporeling(Wingless)) | 11 | Mysteries errata p.37 |

  If the user says yes, add one `("strLimit", <limit now>, 13, "<book> errata p.N: 'Attribute STR max
  is now 13'")` line per race to `column_maps.RACE_VALUE_REPAIRS`, keyed by his race name, as the Podling
  jog repair is (it already reaches both forms of a split race). Check a Formless wearing one of them
  follows: the host's own document is read, so it should with no further change.
- **Files:** `tools/extract/column_maps.py`, then `python tools/extract/build_documents.py --write` (in
  the main checkout, see above); `tools/derive-test.html` (one check reading the twelve built limits);
  `docs/ERRATA.md` ("What is already known to be affected" names only Brownie).
- **Done looks like:** the build prints twelve new REPAIRED lines; the twelve documents carry `str` 13;
  everything else unchanged.
- **Already decided:** the errata outranks the sheet (the user's ruling of 2026-09-21). **Needs the
  user's yes first all the same** -- it predates this stream and was not in the list the 2026-09-23
  provisional ruling covered. It is the kind of line the planned errata reader
  (`tools/extract/check_errata.py`, `docs/ERRATA.md` "Next step") is meant to apply, so if that reader
  is built first, this item is done by it.

## Waiting on the user, not mechanical

- **Characters already made keep their own copy of their race.** A Sea or Ice Elf made before this still
  has Disease 0, a Podling jogs -60 and a Nixie has no swim (a Gaunt gets the header's Roll button, which
  asks first if someone has already typed a penalty into its Start mod). The
  fix for each is to run `game.imagine.importContent()` and then REMOVE the race from the character and
  add it again -- removing first, because dropping a second race on makes a half race. Whether to write a
  migration instead is the user's call; a system `migrateData` cannot do it cleanly, since it is not
  given the item's name.
