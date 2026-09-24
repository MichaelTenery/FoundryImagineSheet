# Character generator stuck on Details: mechanical follow-through (2026-09-23)

This pass fixed the Review step's crash with "Gear by culture" ticked (0.18.2). Reasoning:
`docs/DECISIONS.md`, "A preview's fixed die is a 1, and a die-indexed pick is held to its list".
**Everything in "Already decided" is settled.**

## Already decided

- Dice are `tmpRoll(sides) -> 1..sides` everywhere. A preview's fixed die is `() => 1`.
- A pick made by a die is held to its list the way `rollWildernessKit` now does it
  (`module/starting-kit.mjs`, @MARKER BY CULTURE): `parseInt(die) || 1`, then clamped to 1..n; a missing
  entry becomes an issue, never a throw. An in-contract die must pick exactly what it picked before.
- The kit preview and the Review list show the FIRST alternative; creation rolls. Leave that alone
  unless the user rules otherwise.

## 1. Hold lore-rules' die-indexed picks to their lists

- **What:** apply the same clamp to the unguarded picks in `module/lore-rules.mjs` -- `drawDistinct`
  (~line 678), the hymn pick in `rollStartingLore` (~760), the poison type and potency picks (~782-783)
  and the primer pick in `rollStartingSpells` (~866). At ~786, push an issue instead of reading
  `tmpDetails.name` when `getPoisonDetails` returns null.
- **Also:** give `drawDistinct`'s `while (tmpOut.length < tmpWanted)` a guard like the hymn and spell
  steps already have (they stop after 1000 tries). With any fixed die it can never find a second
  distinct name and spins for ever, which freezes the tab with no error. That is worse than a throw.
- **Files:** `module/lore-rules.mjs`; tests in `tools/lore-test.html`.
- **Done looks like:** every existing lore test unchanged; new checks that dice 0, n+1 and NaN neither
  throw nor hang in each of the four picks, and that `drawDistinct` with `() => 1` and a count of 2
  returns (with fewer names, or an issue) instead of looping.
- **Why deferred:** no user can reach any of it today -- the only caller, `provideStartingLore`, passes an
  in-contract die. It is the same shape that bit the generator, in waiting.

## 2. Run the derive-test Review loop across social classes too

- **What:** `tools/derive-test.html`, "the Review step, with the starting kit ticked", runs each race at
  the default state's social class only (nothing rolled, so the apparent-class path). Also run each race
  with a manual social class of 5, 12 and 20, so the bands with four and eight alternatives are drawn.
- **Done looks like:** the two checks still pass with the wider loop.
