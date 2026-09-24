# His casting comments -- left for a cheaper window (2026-09-24)

He sent ten notes on casting. Every one but Refill matches what is built; see `docs/DECISIONS.md`,
"His comments on casting (2026-09-24)". This pass changed no rule. It relabelled the pool's
"Reset pool" button to his word, **Refill**, and asked UPSTREAM 104. Already decided, **not to be
re-litigated**: Aura is chosen per cast up to Aura Control, an invocation goes off at Piety Control
plus his boost box, and spell and creature damage stay separate.

## 1. Refill by an amount -- ONLY if his answer to UPSTREAM 104 says so

- **What to do:** if he says Refill adds a typed amount, give `resetAuraPool` (module/casting-actions.mjs)
  a dialog shaped like `drainAuraPoolNow`'s ("Aura to add"). Take the amount off
  `system.magic.drainedAura`, never below 0: his addAuraPoolByAmount (sheet-worker.js:160985) does this.
  Put the pure half in casting-rules.mjs beside `drainAura` so it can be tested. Leave the tooltip in
  templates/actor/tab-magic.hbs naming his REFILL.
- **If he says full is right:** mark 104 answered with his words, and do nothing else.
- **Done when:** a test in tools/casting-test.html pins that adding 3 to a pool drained by 5 leaves 2
  drained, and that adding 9 leaves 0. `node tools/run-tests.mjs` passes.

## 2. Aura Reach

Already item 4 of `docs/sonnet/2026-09-24-casting.md` (spell tuning). His note confirms the rule:
Aura Reach allows 1 over Aura Control. That matches his useSpell: +1 Aura on an Aura save, then a
Fortune roll for the burnt Aura. Nothing new to decide.
