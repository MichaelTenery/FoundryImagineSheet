# 2026-10-05 — His 0.22 reports: what's left for a cheaper window

Already decided. See DECISIONS 2026-10-05; don't re-open these. In particular: "Any" objects to
nothing and a plain alignment word matches any of its Active/Passive forms; two hands is +2 DAMAGE only -- the
+2 to hit was retracted by him 2026-10-07 and is out again (UPSTREAM 115 keeps only the -2 speed); tail coverings are Saurian-only and the other
Humanoid(Tail) races are not given the slot.

1. **0.22.6, rolls vanish from the screen too quickly (not built).** The pop-up is Foundry's chat
   notification, not a system element. In a running V14, find how the notification's duration is
   set (the core chat notification code, or a client setting) and either set it from a system
   setting ("Keep roll pop-ups on screen until clicked") or pin the popups of this system's own
   cards. Done when a roll's pop-up stays until clicked, with a world or client setting to turn it
   off, and a note here of which V14 API did it.
2. **Live checks of the tail slot.** On an armour item sheet the grid has a Tail (Saurian) row; a
   Saurian character wearing Tail Covering(Chain) shows Tail armour 15 on the Combat tab and a
   Humanoid does not offer it under Equip Best Armour. Done when each is ticked off here.
3. **Humanoid(Tail) races.** Whether Lagara, Ursara and the other Humanoid(Tail) races also take
   tail coverings is his call; if yes, map their "Tail" area to "tail" in the Humanoid family in
   `tools/extract/extract_combat_tables.py` (the same line as the Saurian's) and widen
   `canBodyWearArmor` from "Saurian" to any body containing "Tail". Done when he answers.
4. **UPSTREAM 115's update** marked `raised` when the user passes it on.
