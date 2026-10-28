# 2026-10-28 — Missing Features 0.25.1:1-11: what's left for a cheaper window

Already decided. See DECISIONS 2026-10-28 ("His Missing Feature reports 0.25.1:1-11"); don't re-open:
one Updater list that opens a window per option; powers are `power` items; the fatigue table is the
book's; no proficiency penalty until a first proficiency is recorded; Changeling form stored, not
written into ratings.

Each item: what to do, files, done when.

1. **Specific Combat Modifiers: Projectile Knowledge line.** `combat.projectileKnowList` now exists
   (weapon-choices); `module/combat/racial-combat-rules.mjs` / `combat-panel-view.mjs` list every other
   line of his (82451-82777). Add his Projectile Know. line in his wording. Done when
   `tools/combat-panel-test.html` checks it.
2. **Off Hand Defensive and Weapon Speed** show "-" in the combat panel. If his sheet fills them,
   port it; if it doesn't, leave "-" and say so in the view's header. `combat-panel-view.mjs`.
3. **Creature Shield/Body Parry** don't take the armour skill penalty, because creature skills are
   stored figures. Apply `combat.armorSkillPenalty` where the creature's skill roll totals its chance
   (`actor-creature.mjs`, the creature skill roll). Done when armor-know-test covers it.
4. **Strangle damage each round.** The card applies once; his text says "at the end of each round".
   Add a "Again" button to the grappling card that re-rolls the strangle damage only.
   `combat/grappling-attack.mjs`, `templates/chat/grappling-card.hbs`.
5. **Proficiency penalty on parries** (5x the to-hit penalty, worked out in
   `weapon-choices-rules.mjs`) waits on a parry roll existing. Nothing to do until it does; when it
   does, take its half from `weapon-choices-rules.mjs` (his `non_prof_skills_penalty`, see line 72).
6. **Projectile Knowledge range stretch** is ported and tested but nothing reads ranges. Same: wire it
   when attacks read range.
7. **Changeling: Slight Physique at creation** isn't recorded on the actor, so a Changeling made slight
   starts its first switch unticked. Record `physical.slightPhysique` in `assembleCharacter`
   (chargen-rules.mjs) and default the switch to it. `shape-change-view.mjs`.
8. **Formless control resistance** leaves out his class "+% Control Resist" string and Stubborn's +20.
   Add both to `identity.formlessControl` (actor-character.mjs) from his handler.
9. **Failed possessions** aren't remembered; his sheet bars retrying a host that refused. Add a list to
   `identity.formless` and the refusal to `shape-change-rules.mjs`.
10. **Non-skill evokes** only go on the effects list and post their text; his body-changing evoke
    effects aren't worked out. Needs the evoke system (Layer 4), so park it there.
11. **Travel hours / daily rest temporary modifiers** are stored and shown but the port has no travel
    figure. Wire when one exists.
12. **Powers window refill buttons.** His Refill buttons live on the powers list, not the Updater; add a
    Refill per power with uses on the Magic & Lore tab list (`templates/actor/tab-magic.hbs`).

Not verified anywhere but headless: open every Updater row in a real V14 world once and tick off what
renders, as `docs/FIRST-RUN.md` does for the rest.
