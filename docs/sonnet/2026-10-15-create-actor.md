# 2026-10-15 — Create Actor opens the generator: what's left for a cheaper window

Already decided. See DECISIONS 2026-10-15; don't re-open: a blank character from Foundry's own
Create Actor dialog is refused and the generator opens; creatures are never intercepted.

1. **Live check.** In a running V14, as a Player and as the GM: the Actors directory's own Create
   Actor, type Character, name "Test" -> the generator opens with "Test" in Basics and NO actor is
   made; type Creature -> a blank creature as before; Create Character (the system's button) works
   as before; importing a character from a compendium and Duplicate still work; the generator's
   own Create still makes the character (it passes `imagineGenerated`). If `preCreateActor`'s
   `return false` leaves Foundry's dialog showing an error, swallow it (the notification already
   says what happened). Done when each is ticked off here.
2. **His two "missing" items, when his reports arrive:** Armor Lore / Armor Knowledge configuration
   (nothing in the port -- find his `armor know/lore config` handlers in sheet-worker.js first;
   they are in the Updater board row's "missing" list) and the character sheet's combat Modifiers
   panel (Backlog row "Character sheet: Modifiers panel", mirrored from the creature's). Both are
   judgement work for the expensive window, not this one; this note only says where they stand.
