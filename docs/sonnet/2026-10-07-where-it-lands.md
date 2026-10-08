# 2026-10-07 — Where it lands: what's left for a cheaper window

The user's suggestion: declare the intended body target before the to-hit roll, and after the
roll say, from the target's body, where the hit lands. 0.24.0 already had the aim picker and the
struck-area default; this pass added the card's "Where it lands" line (`getLanding`,
`module/combat/attack.mjs`) and the target's figure as the damage dialog's picker, the aim dashed
and the landing solid (`buildBodyFigure`'s `aimed`, `module/body-view.mjs`). See DECISIONS
2026-10-07 ("Where it lands, said on the card").

Already decided; do not re-open: the question is answered on the card and CONFIRMED at Apply
(the Game Master's step), not with a second dialog thrown at the attacker after the roll; a
Random Location from the Situation Mods overrides the aim and is left to the table's roll; the
landing on the card is the reading made at roll time and the dialog reuses it rather than
re-reading, so the two can never disagree.

1. **Release.** Not cut here: the working tree also carried the uncommitted "players create
   characters" pass (`docs/sonnet/2026-10-07-players-create.md`), and a build would have shipped
   it half-done. When both are in: bump `system.json` to 0.25.0, add the CHANGELOG entry below,
   `python tools/build_system.py --zip`, commit as "Release 0.25.0: ...".

   > **Where it lands, said on the card.** After the to-hit roll the attack card says where the
   > blow lands, read off the target's own body from the aim and the zone ("High of the Neck,
   > where it was aimed, lies the Head"); a Random Location from the Situation Mods says so
   > instead. Apply damage now shows the target's figure as the picker, the aim outlined dashed
   > and the landing solid, and a click moves the landing. The reading is still offered, not
   > imposed (UPSTREAM 118).

2. **Live check in a running V14**, with the 0.24.0 list in `2026-10-07-fun-pass.md` item 1:
   the damage dialog's figure rendering inside DialogV2 (the partial is rendered by path, as the
   attack dialog's is), the click moving the "Area struck" select, the dashed `aimed` stroke
   under the solid `selected` one when both fall on one area, and the card's landing line
   surviving the chat sanitiser (plain text in a div; it should).

3. **The creature's attack card.** `creature-attack.mjs` builds its own card and flag; it does not
   carry `landing`. Mirror it: call the same reading (lift `getLanding` into `combat-rules.mjs` or
   export it from `attack.mjs`) where the creature's result is built, add the same
   `{{#if landing}}` line to `templates/chat/creature-attack-card.hbs`, and a check in
   `tools/creature-test.html`. Its damage goes through `applyAttackDamage` already, so the dialog
   side is done.

4. **Styling of the damage dialog.** `.imagine-damage-dialog` has no rules of its own; the picker
   borrows `.imagine-aim-picker`. If the figure crowds the dialog, give the damage dialog a
   two-column layout (hint and selects left, figure right) rather than shrinking the figure.

Everything in `docs/sonnet/2026-10-07-fun-pass.md` and `2026-10-07-players-create.md` still stands.
