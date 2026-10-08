# 2026-10-08 — The aim asked for at Apply Damage: what's left for a cheaper window

Done: with no aim declared at the roll, the damage dialog asks for it on the target's figure and
reads the landing from the zone (DECISIONS 2026-10-08). Already decided; do not re-open: the
torso is the first guess; the attack dialog does not offer a stand-in body when there is no
target.

1. **Live check in a running V14.** Roll an attack with NO token targeted, then target the
   token and press Apply damage: the dialog should open with "Aimed at" above "Area struck", the
   figure's click moving the dashed aim and the solid landing together, the hint reading
   "High of the Upper Torso, where it was aimed, lies the Neck" for a Hit(High). Then the same
   with a token targeted: the old dialog, no "Aimed at".
2. **Release.** Changelog line for the next release, with the three already waiting in
   `2026-10-07-where-it-lands.md`, `2026-10-07-off-hand-bar.md` and
   `2026-10-07-smashing-armour.md`: "**Damage no longer goes to the head by default.** When an
   attack was rolled with no token targeted, Apply damage now asks where it was aimed, on the
   target's own figure, and reads where it lands from the roll, as his report of 2026-10-08
   proposed. Before, the dialog fell back to the first area of the body, which is the head."
3. **The card's words after an aim chosen at apply time.** The flag now carries the aim and the
   landing, but the card's HTML was rendered at the roll and still reads "Aimed at: " blank. If
   wanted, re-render the card's content in `applyAttackDamageInner` after the flag update, with
   the same context `rollWeaponAttack` renders it with (modeLabel, actorName, inCombat), and
   mirror it for the creature, brawling and martial cards' own render contexts.
