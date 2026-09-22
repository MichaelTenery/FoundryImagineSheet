# 2026-09-22 — Play-testing feedback on 0.16.0

Covers version 0.16.1. See `DECISIONS.md` 2026-09-22 "Play-testing feedback on 0.16.0" and
`UPSTREAM-ISSUES.md` item 50.

**Already decided, do not re-litigate:**
- Retired documents are removed from an **explicit list only** (`RETIRED_DOCUMENTS`,
  `module/content-importer.mjs`), never "whatever the shipped file lacks" — that would delete
  homebrew.
- Race sheet's Skill note field has **no placeholder**.
- The D'Wisp note is on both Dark Fairy forms via `src/packs/manual/races.json`. The Animal Shape
  **skill** is NOT added; that waits on item 50.
- Famorian evokes stay **unrestricted** by animal; the Game Master polices it (user's call, and his
  sheet's behaviour). The restriction is a Backlog row, not a task.
- Formless body-switching and the race-description clean-up are **Pinned** by the user. Do not
  start either without being asked.

---

## Mechanical follow-through

1. **Automated check that `RETIRED_DOCUMENTS` is complete.** Found by hand this pass: every name in
   any past `src/packs/documents/<pack>.json` in git history that is not in the current one must be
   in `RETIRED_DOCUMENTS[<pack>]`. Add it to `tools/build_system.py` as a warning (names only, no
   failure), using `git log --format=%h -- <file>` + `git show <c>:<file>`. Done when the build
   prints nothing today and names a document if one is deleted from `races.json` locally.

2. **Test for the retirement logic.** `importPack` and the sidebar fill are Foundry-bound, so pull
   the pure part — "given shipped names, existing names and the retired list, which ids go" — into a
   small function in `content-importer.mjs` and test it in `tools/derive-test.html` (or a new
   suite if that fits the pattern better). Cases: retired and present → deleted; retired but back in
   the shipped file → kept; not retired and absent from the file (homebrew) → kept. Done when the
   three pass and `importPack` calls the extracted function.

3. **Check `Folder#ancestors` on V14.** `module/item-directory.mjs` uses
   `tmpitem.folder.ancestors` to find items anywhere under a root folder. It is in the V12/V13 API;
   confirm it against the V14 docs and record it in `docs/FIRST-RUN.md` beside the other checked
   paths. If it has gone, walk `.folder` up by hand.

4. **Localise** the new Description-tab strings ("Formless: Bodies" and its explanation,
   `templates/actor/tab-description.hbs`) if the other tabs go through `lang/en.json`; same rule as
   the earlier sonnet notes.
