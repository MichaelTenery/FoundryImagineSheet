# 2026-10-07 — Players create characters

Done: module/imagine-rpg.mjs grants ACTOR_CREATE to the Player role once per world (setting `playersMayCreate`). See DECISIONS.md.

Left for Sonnet (mechanical):
- Mention in README.md (and dist/imagine-rpg/README.md) that the GM must log in once after updating, and that Configure Permissions can revoke it.
- Add a line to the changelog entry (module/changelog.mjs) for the next release.
- Rebuild dist with tools/build_system.py.
Already decided, do not re-litigate: no socket relay; grant once, never re-apply.
