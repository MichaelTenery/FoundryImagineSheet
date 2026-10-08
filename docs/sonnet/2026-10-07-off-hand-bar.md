# 2026-10-07 — Each hand has its own bar: what's left for a cheaper window

Built: the off hand's own ten-second bar under the main hand's (DECISIONS 2026-10-07, "Each hand
has its own bar"). Already decided; do not re-open: an off-hand action begins in the second the
spender said or where the hand stands, never behind the main hand; idle seconds are time, not
budget; the five seconds stay p.178's budget; no carry-over for the off hand, only an overrun
figure; surprise is unchanged.

1. **Live check in a running V14.** The second bar under a tracker row (the row wraps; check the
   sidebar's width still takes two bars without clipping), the window's `clock-hands` stack lining
   up under the ten headers, the "begins in second" field in the "+…" dialog, and a parry placed
   in an earlier second than the main hand (say 3 while the sword runs 1-5) drawing behind it.
2. **The creature attack card.** `creature-attack.mjs` spends time with `{ hand, label }` like the
   weapon card; neither passes `at`, so an off-hand weapon swing lands where the off hand stands.
   If the table wants the swing placed, add a "begins in second" prompt to `spendAttackTime`
   (`module/combat/attack.mjs`) for an off-hand weapon only, defaulting to the standing second.
3. **The Combat tab's box.** `buildSheetClockView` still shows "3 of 5 left this round"; it could
   add the standing second (`offhand.standing`) on a third line. Mirror the test in
   `tools/round-test.html` ("in combat: the off hand's '3 of 5'...").
4. **Release.** Not cut here (the tree carries another pass's uncommitted work). Changelog line
   for the next release: "**Each hand has its own bar.** The off hand's seconds are a second
   ten-second bar under the main hand's, and an off-hand action is placed in the second it
   happened -- say which in the spend dialog, or it lands where the off hand stands, never behind
   the main hand. Its five seconds are still the budget the Player's Guide gives it (p.178)."

Everything in `docs/sonnet/2026-10-07-where-it-lands.md` still stands.
