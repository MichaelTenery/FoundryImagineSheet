# 2026-10-07 — Players create characters

Done: module/imagine-rpg.mjs grants ACTOR_CREATE to the Player role once per world (setting `playersMayCreate`). See DECISIONS.md.

Done 2026-10-09, in the 0.25.0 release pass:
- README.md and dist's README (the install note in tools/build_system.py) say the GM must log in once after updating, and that Configure Permissions can revoke it.
- The changelog entry (CHANGELOG.md, 0.25.0; module/changelog.mjs reads that file, there is no second copy).
- dist rebuilt with tools/build_system.py.

Already decided, do not re-litigate: no socket relay; grant once, never re-apply.

Left: a live check in a running V14 -- log in as the Game Master once, see the notice, then as a Player see the Create Character button and make one.
