# 2026-09-22 — The Sonnet backlog, worked through: what is left

Covers version 0.17.0. Every numbered item in every note in this folder was checked against the code
on this date. **This note is the current status of all of them**; where an older note disagrees, this
one wins. See `DECISIONS.md` 2026-09-22 "The Sonnet backlog, worked through".

**Already decided, do not re-litigate:**
- Strings are not localised (`DECISIONS.md` 2026-09-19). Every "localise" item in every note is closed.
- The race sheet's racialSkills/abilities/disabilities/immunities stay read-only chips.
- Famorian evokes are not restricted by animal; Formless body-switching and the race-description
  clean-up are **Pinned** by the user.
- `RETIRED_DOCUMENTS` is an explicit list, never "whatever the file lacks".
- Source matching: no plural rule (tried, rejected, see the comment in `extract_sources.py`).

---

## Mechanical follow-through (do these)

1. **Multi-missile acquisition button.** The rules are ported (`resolveMissileComboAcquisition` in
   `module/combat/combat-rules.mjs`, tested in `tools/combat-test.html`). Add a Roll action beside
   the two multi-missile lists on the Combat tab, following `#onRollSkill`'s pattern: 1d100, a chat
   message, and on `"succeeded"` write `.list` back to `system.multiMissileKnowList` /
   `multiMissileLoreList`. Files: `templates/actor/tab-combat.hbs`,
   `module/sheets/actor-character-sheet.mjs`. Done when a success adds the combination and a
   failure changes nothing (there is NO lockout on failure — his code has none).

2. **`tools/importer-test.html` checks the pack NAMES in `RETIRED_DOCUMENTS`** (currently classes,
   races, skills). When a future rebuild retires a document from a new pack, update that check too.

## Needs a call from the user first

3. **Untrained-skill list on the Skills tab.** The rule is `getUntrainedSkillOptions`
   (`module/skills-rules.mjs`); about 370 skills qualify, so ask whether it is a count plus a search
   box, or a full list, before building it.
4. **A pack for creature attacks and powers** (`2026-09-19-adding-content.md` item 3) — the note
   says ask first.
5. **Creature attacks get no lore modifier** (`2026-09-12-lore-corrections.md` item 2) — a design
   pass, not mechanical.
6. **Racial bonuses to social skills** — his `getRaceClassSocialMod` table (sheet-worker.js:57649)
   is not ported, and his caller looks broken (`UPSTREAM-ISSUES.md` item 52). Porting it waits on his
   answer.

## Waiting on the developer (nothing to do until he answers)

`UPSTREAM-ISSUES.md` items 21 (projectile lore), 25 (magical flight), 28/29 (multi-missile), 30
(Language Lore / racial-slot sacrifice), 40 (starting money — parts 1, 3 and 4 are transcribable, the
Fortune comparison is not), 51 (Mixed flexibility), 52 (social skills). The four missing class
templates (`2026-09-12-elemental-dancer.md` items 1–2) need his `.doc` files.

## Only in a running Foundry V14

`2026-09-16-skills-module.md` item 3, `2026-09-21-items-from-compendium.md` item 3, and the whole of
`populateItemDirectory` / `clearItemDirectory` / the What's New window. Nothing here has run in V14.

## Only if asked

`items-from-compendium.md` item 1 (`syncItems`), `equip-buttons.md` items 2, 3 and 5 (weapons,
shields), `first-install-bugs.md` item 7 (creature handedness), `progress-tool.md` item 3 (a "waiting
on" filter).

## Not mechanical, set down for whoever picks it up

- **Table-aware book extraction** (`source-attribution.md` item 3): the PDFs are real text, not scans,
  and PyMuPDF's `find_tables()` recovers the armour tables, but merges several rows into one cell
  inconsistently. Cleaning that is real work. The PDFs are in the user's Downloads folder.
- **1,683 documents are still XXX.** General name rules are close to exhausted; what is left mostly
  needs a person with the books.
