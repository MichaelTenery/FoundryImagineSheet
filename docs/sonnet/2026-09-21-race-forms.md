# 2026-09-21 — Race forms: mechanical follow-through, and the Famorian/Formless spec

> **2026-09-22: every item below was re-checked against the code and the mechanical ones built.**
> Current status of each is in `2026-09-22-sonnet-backlog.md`, which wins where this note disagrees.

Covers the pass that split the races his sheet splits with a second dropdown: the four winged
faeries and the four Maginos materials. See `DECISIONS.md` 2026-09-21 "The races he split with a
second dropdown become races of their own", and `UPSTREAM-ISSUES.md` items 45 and 46.

**Already decided, do not re-litigate:**
- Each form is ONE DOCUMENT PER FORM, named in his bracketed style with no space: `Fairy(Winged)`,
  `Fairy(Dark Winged)`, `Maginos(Clay)`. The user chose this naming over `Fairy (Winged)` and over
  `Fairy(Dark)(Winged)`.
- The four faerie bases are REPLACED — plain `Fairy`, `Fairy(Dark)`, `Podling` and `Sporeling` are
  no longer races. `Maginos` is KEPT as the `[Other]` material his sheet offers.
- Wings and slight physique are ONE choice, which is Michael's call and his code's own structure.
  `physiqueLock` on the race document forces the generator's tick and hides the choice.
- **Gremlin is not split.** It flies either way; its ordinary form gains Climb. Its tick stays free.
- `sourceRace` is how a form reaches his name-keyed tables. Nothing parses a name to find a base.
- A winged/wingless HALF RACE pair is a conflict that is REPORTED, never refused, and the tick goes
  back to the player. Same call as a barred class and an infertile pair.
- Famorian and Formless are NOT built, and a row of zeros is not an acceptable placeholder: it
  would give a character an attribute limit of 0 in all twelve.

---

## Mechanical follow-through from this pass

1. **`docs/DATA-MODEL.md` gains two race fields.** `sourceRace` (string, his name for the race, the
   key every name-keyed table is looked up under) and `physiqueLock` (`""` / `"slight"` /
   `"ordinary"`). The doc says the code wins where they disagree, so add rows and reword nothing.
   Files: `docs/DATA-MODEL.md`. Done when both appear in the race table with the other race fields.

2. **Make the two new fields visible on the race item sheet.** The race sheet shows what a race
   *gives* (added 2026-09-20) but not which form it is; the explanation is currently only in the
   generated `description`, which a Game Master authoring a homebrew race would not think to write.
   Add a read-only line in the same chip markup: "Form: winged (always slight physique)" /
   "wingless (never slight physique)" / nothing where `physiqueLock` is empty, and "Source race:
   Fairy" where `sourceRace` differs from the item's own name. Files:
   `templates/item/item-race.hbs`, `module/sheets/item-sheet.mjs` if it needs the derived labels.
   Done when `Fairy(Winged)`, `Fairy(Dark Wingless)`, `Maginos(Metal)` and `Nixie` all render
   correctly in `tools/item-preview.html` — Nixie showing neither line.

3. **Show the physique lock on the character sheet's Race panel too.** The generator explains it;
   a character made by hand, or opened later, does not. One line in the Race panel on the
   Description tab, reading off the race item's `physiqueLock`, plus the conflict line where a Half
   Race holds one of each (the text is already written — `resolvePhysiqueLock().reason`). Files:
   `templates/actor/tab-description.hbs`, and `_getRaceIssues` in `module/data/actor-character.mjs`
   for the conflict, which is where the barred-class and infertile-pair issues already live.
   Done when a Fairy(Winged) character says so on the sheet and a Fairy(Winged)/Podling(Wingless)
   character shows the conflict beside its other race issues.

4. **Localise the new strings**, if the other tabs do. Same check and same rule as item 1 of
   `2026-09-18-language-allowance.md`: the three `resolvePhysiqueLock` reasons
   (`module/race-rules.mjs`), the generator's replacement blurb
   (`templates/apps/character-generator.hbs`) and whatever items 2 and 3 add. If the other tabs go
   through `lang/en.json`, do these the same way; if not, leave them and say so.

5. **The `slightPhysique` overlay block now serves exactly one race.** With the four faeries split,
   `build_slight_physique` and `applySlightPhysique` are reached only by Gremlin. Do NOT delete
   either — a homebrew race may declare a variant, and the schema is the documented way to do it —
   but the comment blocks above both (`tools/extract/build_documents.py` @MARKER SLIGHT PHYSIQUE,
   `module/race-rules.mjs` @MARKER SLIGHT PHYSIQUE, `module/data/item-race.mjs`) still describe the
   four faeries as the reason the block exists, which is now history rather than fact. Reword them
   to say Gremlin is the one race that uses it and the faeries became documents, and point at the
   new @MARKER RACE FORMS notes. Done when no comment claims a Fairy chooses its wings.

6. **`docs/ADDING-CONTENT.md` should mention the two new fields**, since a hand-authored race can
   set them: `physiqueLock` to make a homebrew race always or never of slight build, and
   `sourceRace` to borrow another race's skills, colours, ages and height band. Both are optional
   and default to the sensible thing. Files: `docs/ADDING-CONTENT.md`. Done when the race section
   lists them with a one-line worked example.

---

## The Famorian spec

**Do not start this without reading `CLAUDE.md` on model choice.** It is a subsystem, not a row.

Nothing is built. `Famorian` is in his `specieslist` (28104) and **7 classes bar it**, so his own
class data expects it to exist; `check_race_references` reports that on every extraction run.

**Why it is not a row.** `applySingleRaceToAttribs` case `"Famorian"` (33032) does not assign a
literal. It opens a `getAttrs` over roughly 130 `famorian_evoke_*` checkboxes and builds the race
out of whichever are ticked. Three of them add attribute points by rolling:

    famorian_evoke_str     ticked -> STR + getDieRoll(3), and counts as one evoke
    famorian_evoke_agl     ticked -> AGL + getDieRoll(3), and counts as one evoke
    famorian_evoke_vit     ticked -> VIT + getDieRoll(3), and counts as one evoke

Every other evoke sets a `famorian_evoke_<name>_final` to `"Yes"` and adds 1 to the evoke count
(33060-33606). Then movement is zeroed (`race_tmp_walk_hourly` and the other eight, 33612-33620),
`setFamorianTempEvokeAbilityList()` turns the ticked evokes into an ability list, `formless` is
`"no"` and `can_swim` is `"yes"`.

**A Famorian will not apply at all without an animal type.** `applyRaceToAttribs` refuses it
(4546): *"No Famorian animal type found/selected. Nothing done."* So `famorian_animal_type` is a
required choice, as `formless_host_race` is for a Formless.

**The breed table, which is the part that makes the evokes finite.** `getRacialFeatures`-side code
at 16736 rolls d100 on race application and sets the breed, the evoke BUDGET and how the evokes
behave:

    d100     breed          evokes allowed   when they are on
    1-10     Hidden Breed   1                Only occurs during stress
    11-20    Trace Breed    1d2              Always On. Single animal package.
    21-40    Low Breed      1d4              Always On. Single animal package.
    41-60    Breed          1d4+1            Always On. Single animal package.
    61-90    High Breed     1d6+1            Always On. Single animal package.
    91-95    True Breed     All              Always On. Single animal package.
    96-100   Inbreed        1d6+2            Always On. One or more animal packages.

The budget is enforced at 7980: character creation is not "done" while
`race_famorian_tmp_evokes_used > famorian_tmp_evoke_num`, with `"All"` meaning no ceiling. That is
the shape to port — a budget, a spend, and a check — and it is the same flag-and-report pattern the
port already uses for skill slots rather than a refusal.

**The body chart moves too.** `tempBodyType.includes("Famorian")` with extra animal legs and extra
insectoid legs together, or either alone, selects a different body chart (30902 and 32143, the two
copies). So a Famorian's hit locations depend on its evokes, which is why `bodyType` as a plain
string on the race will not carry it. `item-race.mjs` already says evoke mutations are unmodelled.

**What is already in hand:** `evokedict` is extracted. Height band "Average" (35625) and frame
"Average" (36494) are both in `physique-tables.mjs` under the name `Famorian`, so a Famorian
document with `sourceRace: "Famorian"` rolls height and weight the moment it exists. `racefertiledict`
excludes it from cross-breeding (16693).

**Suggested shape, not decided:** the evokes are a repeating choice with a budget, which is closer
to skill slots than to a race field. A `Famorian` race document could carry the breed table and the
evoke catalogue, with the character holding the chosen evokes — but whether an evoke is an Item, an
array on the actor, or an Active Effect is exactly the architecture call this spec is refusing to
make on a cheap window. Ask the user, and ask Michael whether the d100 breed is rolled or chosen.

---

## The Formless spec

Nothing is built. `Formless` is in his `specieslist` and **11 classes bar it**.

**Why it is not a row — and the half of it that IS.** A Formless is a free-floating psyche that
inhabits a host body, so its physical half comes from the host race
(`setFormlessStartingRace(host, slightphysique)`, 34880, reading his `formlessStartingRaceDetails`
dictionary — 102 rows, already extracted to `src/packs/raw/`, in a reduced 36-column shape that is
NOT the 62-column `raceStatsAndMoveDetails` shape and needs its own column map).

Its MENTAL half is a literal block, and this is the find of this pass — `applySingleRaceToAttribs`
case `"Formless"` (33625-33650):

    modifiers     INT +2   WIS -2   KNW +5   CHM -2   AUR 0   PTY 0   WIL +4
    limits        INT 20   WIS 17   KNW 22   CHM 18   AUR 20  PTY 20  WIL 20
    endurance     startFormula "1", dice 1, max 1, mod 0
    characteristics   Affinity -10, Fortune +10
    resistances   magic 0, illusion 0, control 0, poison +5, disease +10
    formless      "yes"

Note there are no STR/AGL/VIT/APP/SOC figures: those come from the host, which is the whole point.

**Other Formless behaviour already located:**
- It will not apply without a host (4539: *"No Formless host race name found/selected."*).
- Its racial skills are its OWN, not the host's — `setRaceSkillSheet` is called with the Formless
  race (4577), with the comment that Formless *"do not get these from the host they inhabit"*.
- `setFormlessRaceAbilities()` (4576) adds Formless abilities AFTER the host's racial abilities.
- It cannot transform: *"Formless do not take on the magical abilities of the host"* (21838).
- It has a special Control resistance path, `setFormlessSpecialControlResistance` (29338).
- Host retention and a free-psyche state are separate mechanics with their own handlers
  (`handleUpdateFormlessHost`, `handleUpdateRetainFormlessHost`,
  `handleUpdateFormlessFreePsycheCheck`, 11552-11562; sheets at 18101-18105).
- `updateFormlessHostType(host, "Mindless Husk", will)` (32621) is how the host is recorded.
- A Formless can never be a Half Race (34003, *"formless can't be half races"*).
- Height band is `"N/A"` (35626) — so height must come from the host, not from `Formless`.

**Mind `UPSTREAM-ISSUES.md` item 46 before porting the host switch:** `setFormlessStartingRace` has
`case "Fairy"` twice and no `case "Sporeling"`, so a Sporeling host silently falls through. The
intended row is identified there. Also note that his host switch splits the four faeries by slight
physique — which the port has now turned into eight races, so a Formless host picker should offer
the FORM (`Podling(Winged)`) and read the corresponding branch, not offer `Podling` and ask again.

**Suggested shape, not decided:** a `Formless` race document carrying only the mental block, plus a
required host-race choice on the character that supplies the physical half through the same
`combineHalfRace`-adjacent path — except that it is not an average, it is a replacement, so it wants
its own function rather than a flag on that one. Ask the user before building.
