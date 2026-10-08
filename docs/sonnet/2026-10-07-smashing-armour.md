# 2026-10-07 — Smashing through armour (bug report 0.22.7:1): what's left for a cheaper window

Done: `ARMOR_BLOCKING`'s Smashing row is the book's half, corrected in the generator
(`BLOCKING_CORRECTIONS`) so it survives regeneration; `blockDamage` rounds up; UPSTREAM 119 is
answered and closed; `BLOCKING_TYPE_OF` is emitted by the generator again. See DECISIONS
2026-10-07 ("Smashing through armour"). Already decided; do not re-open: rounding up applies to
every fractional band, not Smashing alone.

1. **Release.** Changelog line for the next release, with the two already waiting in
   `2026-10-07-where-it-lands.md` and `2026-10-07-off-hand-bar.md`:
   "**Smashing damage through armour, his bug report 0.22.7:1.** Between half and full armour a
   smashing blow now puts half its damage through, as the Player's Guide's table and examples
   have it (p.189), not a quarter; and the fractions round up, as the book's examples do. 22
   smashing against 38 armour lands 11, where 0.24 landed 5."
2. **The constriction footnote** (armour halved each consecutive round of constriction) is still
   not built; neither his sheet nor the port does it. If wanted: a "round of constriction" count
   on the damage dialog that halves the armour value passed to `blockDamage`, with a test from
   the book's boa example (15, 8, 4, 2, 1).
3. **Reply to his report.** The wording for him is in UPSTREAM 119's resolved entry.
