# Round clock: mechanical follow-through (2026-09-22)

This pass built each combatant's clock through the 10 second round -- his Mr. Initiative chart
(Master's Manual pp.98-100): the rules (`module/combat/round-rules.mjs`), the combat and combatant
that keep it (`module/combat/combat-document.mjs`), the combat tracker rows
(`module/combat/combat-tracker.mjs`), the Mr. Initiative window (`module/apps/round-clock.mjs`), the
view both draw from (`module/round-view.mjs`) and the shared bar (`templates/combat/clock-bar.hbs`).
The reasoning is in `docs/DECISIONS.md` under "The round clock". These are the pieces left because
each only extends something that already exists. **Everything in "Already decided" below is
settled. Do not reopen it.**

## Already decided

- The clock lives in `flags.imagine-rpg.clock` on the combatant, keyed by round: `{ round, rolled,
  carry: { seconds, action, roll } | null, spent: [{ seconds, hand, label }], carryOver }`. Not a
  Combatant data model: flags need no `documentTypes` entry, and a player may write them on their
  own combatant (BaseCombatant's update permission).
- The combatant's `initiative` stays the number the tracker shows: the roll until something is
  spent, then the second they next act in, counting past 10.
- Any initiative written without `{ imagineClock: true }` restarts the clock (`ImagineCombatant`).
- A sped combatant starts at 1a whatever they rolled; "a" is the extra half (his sheet over his
  chart). A carried action's reaction roll of 0 or less counts as 1. Both asked in UPSTREAM 61; do
  not change them unless he answers.
- The reaction roll is made when the new round starts, not at the second the action finishes.
- Nothing is refused: an off hand spent past its pool is shown in red, a spend after the round's end
  runs into the next.
- The round is announced over, never advanced automatically.

## 1. Release it

- **What:** version bump, CHANGELOG entry, `dist/` build, commit. Not done in this pass because the
  Magic & Lore tab (also unreleased) and a weapon-mods pass by another session were in the same
  working tree, and a release is the user's call.
- **Files:** `system.json` (version), `CHANGELOG.md`, then `python tools/build_system.py`.
- **Done looks like:** a new version section at the top of CHANGELOG.md with this (edit freely):

  > **Each combatant's seconds, round by round.** Every row of the combat tracker now shows that
  > combatant's ten seconds: the ones lost to a late initiative, the ones spent, and where they
  > stand, with +1, +… (either hand) and undo. The stopwatch at the top of the tracker opens **Mr.
  > Initiative**, the Master's Manual's round chart, with everyone lined up by second. An action
  > that runs past the tenth second carries over into the next round (untick it to roll afresh);
  > the off hand has its own seconds; Speed seconds (a new box on the Combat tab) split the first
  > seconds in two and put the character first. Spend on an attack card now charges the hand the
  > weapon is in, and only once.

  and `build_system.py` reporting no unchecked modules and no version warning.

## 2. Document the fields in DATA-MODEL.md

- **What:** `docs/DATA-MODEL.md` §3 (character schema) and the creature section do not mention
  `combat.speedSeconds` (both types, integer 0-10, his `tmp_speed_seconds`), the creature's derived
  `combat.offhandSecondsCap`, or the combatant flag above.
- **Files:** `docs/DATA-MODEL.md` only. Copy the wording from the schema comments in
  `module/data/actor-character.mjs` (@MARKER SPEED SECONDS) and the flag shape from "Already decided".
- **Done looks like:** each field named once, with where it is read (`getClockOptions` in
  `round-rules.mjs`).

## 3. Show the round clock on the Combat tab -- DONE 2026-09-23

**Done** at the user's request (see `DECISIONS.md` 2026-09-23): `buildSheetClockView` in
`round-view.mjs`, `getActorSheetClock`/`refreshActorSheetClocks` in `apps/round-clock.mjs`, the box on
both Combat tabs (the creature tab gained an Off-Hand Seconds box). The original entry follows.

- **What:** the Combat tab's Off-Hand Seconds box shows the allowance only. When the actor is in the
  viewed combat, add the clock's "left" figure beside it ("3 of 5 left this round") and the main
  hand's status line ("Second 7 · 4 left"). Read-only; the buttons stay in the tracker and window.
- **Files:** `module/sheets/actor-character-sheet.mjs` and `actor-creature-sheet.mjs`
  (`_prepareContext` or the combat part's context), `templates/actor/tab-combat.hbs`,
  `templates/actor/tab-creature-combat.hbs`. Build the figures with `getCombatantClockState(combatant)`
  from `combat-document.mjs` and the combatant found the way `findCombatant` in `combat/attack.mjs`
  finds it.
- **Done looks like:** the two boxes show the live figure in combat and the plain allowance out of
  it; the sheet re-renders on combatant updates (register the sheet in the combatant's `apps`, or
  re-render from the tracker's `_onRender` the way `ImagineRoundClock.refresh()` is called).
  **Only if the user wants it** -- ask before building; the tracker already shows it.

## Not for this note (needs a judgement call, not a pattern)

- ~~His chart's **Surprise** row~~ -- built 2026-09-23 with the user's approval; see `DECISIONS.md`
  2026-09-23 and `docs/sonnet/2026-09-23-surprise.md`.
- **Speed potions, spells, runes and glyphs setting `speedSeconds`** by themselves, and clearing it
  when they lapse: Layer 4 (magic effects), not this.
