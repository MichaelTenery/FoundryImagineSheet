# 2026-09-26 — Alignments, class social lists, whole-career class skills: what's left for a cheaper window

Already decided. See DECISIONS 2026-09-26 ("Character generation: alignments, social skill lists,
and the whole-career class skill plan"); don't re-open these. In particular: his dropdowns (not his
requirement strings) are the lists; custom alignment names must contain their axis words; the sheet
reserves the whole career and older low-Knowledge characters showing "over" is accepted, not gated;
MM p.55 swaps are generator-only behind `classCustomization`; rule 4 is advisory.

1. **Live Foundry checks.** Nothing in this pass has run in a real V14. In a world, check each and
   fix only what fails:
   - Alignments & Tendencies window (`module/apps/alignment-config.mjs`): the fanatical checkbox
     arrives from FormDataExtended as a boolean; a failed save shows the error and keeps the window
     open; typing survives a theme change (outside re-render).
   - Generator: `alignmentless`, `socialOverride`, `classSlotOverride` checkboxes arrive as booleans
     (the code tests `=== true`); `classRemovePick` boxes and the two CONVERT number inputs redraw on
     change; `classSwaps.N.out` / `.in` selects arrive through FormDataExtended; scroll is kept in
     `.chargen-social-class`, `.chargen-social-other` and `.chargen-career`.
   - Character sheet header alignment select and Description tendency select save; the warning line
     shows for a disallowed value; creature header datalists render in Foundry's CSS.
   Done when each is ticked off in a reply to this note, with any fix and a test where one fits.

2. **Language strings.** New strings are hard-coded English (as the rest of the generator and
   `availability-config` are): `templates/apps/alignment-config.hbs`, the new parts of
   `templates/apps/character-generator.hbs`, `templates/actor/header.hbs` warning line,
   `templates/actor/tab-skills.hbs` "still to come", the settings' names and hints in
   `module/imagine-rpg.mjs`. Only do this if the project moves the generator to `lang/en.json` as a
   whole; otherwise leave it. Done when either all are keyed or this item is closed as "matches house
   style".

3. **`tools/chargen-preview.html`: show the new Skills step.** It renders the class social lists
   and alignment selects but not the whole-career table, the CONVERT inputs or the swap panel. Add a
   short-Knowledge Warrior (KNW 12, the case in `tools/class-edits-test.html`) with two removals and
   one swap so the preview shows them. Done when the preview renders them with no console errors.

4. **Graphify rebuild.** New modules `module/alignment-rules.mjs`, `module/apps/alignment-config.mjs`
   and the extractor `tools/extract/extract_class_social_skills.py`. Run the three commands in
   `CLAUDE.md` (use the venv python if the shim misbehaves). Done when `graphify query "alignment
   choices"` finds `getAlignmentChoicesForClasses`.

5. **UPSTREAM items 105-114 and the 33 amendment are `open`.** When the user passes them on, set
   them to `raised` with the date. Nothing else to do until he answers.

6. **Daryl's 2026-09-25 note, item 1 is done** (his changes are in the 0.21.0 CHANGELOG entry and
   the version is bumped). Mark it so in `docs/sonnet/2026-09-25-daryl-notes.md` if you touch it.

Not for this window (they need judgement or a ruling; they are Backlog rows on the board): MM
skill prerequisites and minimum titles (swap rule 4), PG p.78 class slot sacrifice, PG p.75
Additional Social Skills table, "up to N" counts for the 37 classes with no book text, MM p.55's
closing line on a swapped-in skill used non-acquired, a separate alignment override (currently the
class-qualification override), and any grandfather gate for older characters' class slots.
