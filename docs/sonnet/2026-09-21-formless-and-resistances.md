# 2026-09-21 — Formless, the resistance roll, and the errata's arrival

Second pass of the day. Covers the Formless race, Daryl's 0.11.1 Blocker, and triaging the errata
he sent. See `DECISIONS.md` 2026-09-21 (the three entries after the race-forms one),
`UPSTREAM-ISSUES.md` items 47 and 48, and `docs/ERRATA.md`.

**Already decided, do not re-litigate:**
- A Formless character holds **two race items** — the psyche and the host body — and they are
  combined by `combineFormless`, which takes each half WHOLE. It is not `combineHalfRace`, which
  averages, and his own code refuses the half-race path for a Formless.
- The host's physical half is read from the **host's own race document**, not from his second copy
  of it (`formlessStartingRaceDetails`). The 22 cells where the two disagree are reported every
  run. Flipping this needs his word — item 47.
- A hostless Formless, a Formless in a Formless, a second body and an unlisted host are all
  **reported, never refused**.
- The resistance roll keeps **his branch order** and **his half that rounds up**. The one departure
  is a natural 1 being an automatic success, which is the bug report's and not his — flagged in
  item 48 for his confirmation.
- **Nothing is built from the errata**, and the precedence question is the user's.

---

## Mechanical follow-through

1. **Show a Formless and its host on the character sheet.** The Description tab's Race panel shows
   one race; a Formless character has two race items and the panel should say which body it is
   wearing — "Formless [Dwarf(Mountain)]" is already the effective race's name, so the panel may
   only need the host named separately and `identity.formlessIssue` shown beside the other race
   issues (it already reaches `identity.raceIssues`, so this may be display only — check first).
   Files: `templates/actor/tab-description.hbs`, `templates/actor/header.hbs`. Done when a Formless
   with a host and one without both read correctly in `tools/sheet-preview.html`.

2. **Make `formlessHosts` editable on the race item sheet.** It is a new array field and the sheet
   cannot edit it, the same gap item 1 of `2026-09-18-races-classes.md` records for the other list
   fields. One comma-separated text field, split on save, is fine. Files:
   `module/sheets/item-sheet.mjs`, `templates/item/item-race.hbs`. Done when it round-trips in
   `tools/item-preview.html` against the real Formless document.

3. **Add the resistance roll to `docs/DATA-MODEL.md`** and the two new race fields from the earlier
   pass if item 1 of `2026-09-21-race-forms.md` has not already done so (`sourceRace`,
   `physiqueLock`, and now `formlessHosts`). The doc says the code wins where they disagree, so add
   rows and reword nothing.

4. **Localise the new strings**, if the other tabs do. The three `resolvePhysiqueLock` reasons and
   the four `readFormlessPair` issues (`module/race-rules.mjs`), the resistance outcome words
   (`module/resistance-rules.mjs`, `RESIST_OUTCOMES`), and the modifier dialog's title and label in
   both actor sheets. Same check and same rule as item 1 of `2026-09-18-language-allowance.md`.

5. **The attribute save's half disagrees with the resistance roll's.** `#onRollAttributeSave` in
   both sheets uses `Math.floor(chance / 2)`; the resistance rule uses his `(chance + 1) / 2`
   rounded down, which rounds UP on an odd chance. Both are his, from different parts of his file,
   and both are ported as written. **Do not unify them** — add it to `UPSTREAM-ISSUES.md` item 48's
   list of things to ask him, and move the attribute save's half into `resistance-rules.mjs` beside
   `halfResistance` only if he says they are one rule.

6. **`_getEffectiveRace` assigns `identity.formlessIssue` during `prepareBaseData`.** That works —
   `identity` is a SchemaField and exists by then — but it is the only place in the model where a
   base-data step writes to `identity`, which `_prepareIdentity` otherwise owns. Consider moving
   the assignment into `_prepareIdentity` and having `_getEffectiveRace` return the issue instead.
   Behaviour must not change; the derivation suite covers it.

---

## Not for a cheaper window

- **Famorian**, the remaining unbuilt race. Its spec is in `2026-09-21-race-forms.md` and the two
  architecture calls are already made by the user: evokes are **an array on the actor** (closest to
  his `famorian_evoke_*_final` flags, with the budget checked the way skill slots are), and the
  d100 breed is **rolled with a world setting to choose**, exactly as handedness was done on
  2026-09-20. What is NOT decided is how the ~130 evokes reach the body chart, since
  `tempBodyType.includes("Famorian")` with extra animal and insectoid legs selects a different
  chart (30902 and 32143). Start there.
- **The errata**, all of it. `docs/ERRATA.md` sets out the three ways to take it and recommends one.
  The user's ruling comes first; after that the work is a reader (`tools/extract/check_errata.py`)
  that reports disagreements rather than applying them.
- **Maginos hide by material** is the one errata item that lands squarely on something built the
  same day — the four material races carry no hide, his sheet having none for them, and
  `Mysteries.txt` gives a rate and a cap per material. It is small, but it is errata, so it waits
  on the same ruling.
