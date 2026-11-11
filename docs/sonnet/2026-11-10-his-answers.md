# 2026-11-10 — His answers to the upstream list: what's left for a cheaper window

Already decided; see DECISIONS 2026-11-10 and do not re-open: presets limit, Custom is his grid; a rune rolls
the weapon's die and keeps its flat +level; of two bonuses only the larger; BLOCKED is the GM's call after creation.

1. **Choose the discipline in the character generator.** Today it is the Choose button on the Combat tab after
   creation. A step or a prompt when Martial Knowledge is among the character's skills, reusing
   `buildMartialKnowView` and `resolveMartialKnowCommit`. Done when a generated martial artist has a discipline
   without visiting the sheet. `module/apps/character-generator.mjs`, `chargen-view.mjs`.
2. **Stale wording in `UPSTREAM-ISSUES.md`.** The "What the port does" paragraphs of 58, 62, 63, 70, 83, 85, 97
   and 99 predate his answers; each now carries his answer above its status line. Bring the paragraphs into
   line, or delete them. No code.
3. **The Standard kit's "reads as a choice" comment** (`extract_starting_kit.py`, 222-228): say that he has
   confirmed the breaks. Comment only; UPSTREAM 99.
4. **His page numbers.** Injury is `sourcebook: "XXX"`, as every hymn is. Fill in with the rest when the magic
   content attribution row on the board is done.

Not verified anywhere but headless: open the discipline window in a real V14 world, commit a preset and a
Custom, and confirm the panel's lists change.
