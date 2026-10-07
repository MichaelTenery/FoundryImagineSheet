# 2026-10-07 -- Upstream issues reconciled: what's left for a cheaper window

Already decided; see DECISIONS 2026-10-07 (the reconcile entry) and don't re-open: the file keeps
its original wording with a dated Update beneath; Status is his side only and Port is ours; only a
repository document counts as his answer; Daryl's answers are Daryl's.

1. **Item 75: cap `divideWithMinAndMax` in the generated spell code.** `module/casting-worker.mjs:204-208`
   still has `tempValue=>tmpMaxValue`; Diffuse Soma calls it at line 4653 with a cap of 10. Add a
   second entry to `CORRECTIONS` in `tools/extract/extract_casting.py` (the `breakAcid` one is the
   pattern, around lines 119-122), regenerate `casting-worker.mjs`, run `node tools/run-tests.mjs
   casting`, and add a check that the function returns its maximum. Done when item 75's Port line
   can read "Solved in the port" and the Update is replaced by one saying so. Do not edit the
   generated file by hand.
2. **Item 37: the physique extractor's regex.** `tools/extract/extract_physique_tables.py:95` only
   reads a `case "X": racetmpheighttype=` on one line, so it misses fall-through cases (Giant(Civilized),
   the City/Port/Town Humans, 35629 and 35644-35647). Make it read a run of `case` lines that share
   one assignment, regenerate `module/physique-tables.mjs` (the committed copy is older than the
   extractor's output: it will gain Winged/Wingless keys for Fairy, Podling and Sporeling), run
   `physique`-related suites, and drop the "substitution" report. NB: the script ignores `--help`
   and regenerates its output.
3. **DONE 2026-10-07 (by the same session).** Six code comments (seven edits) that contradicted the code, corrected, comments only; kept for the record of what each said: `combat-rules.mjs:882-885`
   (says +2 to hit is not built; it is, at 453-458); `starting-money.mjs:19-23` (lists item 68 among
   departures from his code; it now follows it) and `:119` (says item 40 is "still open with him";
   Daryl answered it); `social-skill-rules.mjs:62-64` (a "Botany|Botanist" pairing that no longer
   exists); `actor-creature.mjs:923` (the character cap is "four tiers"; it is 25 or 27 plus the race
   limit); `combat-rules.mjs:2294-2296` and `:2382` (the negative-floor wording for the Elf speed
   multiplier, overtaken by the -10 repair). Comments only; no behaviour changes.
4. **Item 34: the compendium stores `5dl0%` in eight skill documents.** It rolls correctly
   (`chargen-rules.mjs:78-81`) but a player reading the skill sees the typo. Add the eight to a
   `_override` in `src/packs/manual/skills.json` (the way Spell Lore is) rewriting it to `5d10%`, or
   display-normalise it. Ask first which: it is his data.
5. **Passing items to him.** Nothing is marked `raised`; when the user passes any on, change that
   issue's Status to `raised` with the date. The ledger at the top of the file is generated from a
   table in this pass's script, not maintained by hand: after any Status or Port change, update the
   matching ledger row and the count table by hand.
