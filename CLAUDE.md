# Imagine RPG → Foundry VTT Conversion

Converting the **Imagine Role Playing System™** from its Roll20 custom character sheet into a full Foundry VTT V14 game system, with the rights holder's permission for public release.

## Source material

- `ImagineRoll20CharacterSheet-main/` — the original Roll20 sheet export (HTML/CSS/sheet.json). Two actor types (Character, Creature), 10 tabs, 20+ repeating item types for magic/crafting subsystems. The HTML embeds a 180k-line `<script type="text/worker">` block — his actual computation code — extracted to `docs/reference/sheet-worker.js`. (An early audit wrongly called the sheet "logic-less"; see `DECISIONS.md`.)
**The rulebook text is local-only and deliberately not committed** (see `.gitignore`). This repository is public, and permission to build a Foundry conversion is not permission to republish four commercial books. Regenerate from your own PDFs when needed:

```
python tools/extract/extract_book_text.py "path/to/IRP_playersguide.pdf" players-guide
```

Books in use, once regenerated into `docs/reference/`:
- `players-guide-fulltext.txt` — the base rulebook (368 pages: Attributes, Races, Characters, Classes, Skills, Combat, Equipment, Magic, Divine Magic, Appendix).
- `masters-manual-fulltext.txt` — GM-facing expansion (319 pages: extended attribute ranges, class extensions, expanded combat, equipment costs, magic item design). Not a base-rules source — defers to the Player's Guide 82+ times.
- `aspects-of-the-wild-fulltext.txt` — first Bestiary Expansion (176 pages), mostly playable races plus creature-creation guidance.
- `mysteries-of-the-planes-fulltext.txt` — fourth Bestiary Expansion (657 pages), the inner planes; source of 115 of the extracted skills.

**Source of truth rule (revised 2026-09-21 — there are now three sources, not two):**

1. **His errata** wins over everything. Supplied 2026-09-21, dated 2025–2026, it is his most recent statement of the rules and it explicitly corrects the books. Kept local in `docs/reference/errata/`, never committed.
2. **The Roll20 sheet** wins over the rulebooks — it reflects what the table actually plays with.
3. **The rulebooks** are last: consulted for prose, rationale and gaps.

The errata was ranked above the sheet by the user's ruling on 2026-09-21, reversing the previous rule. In practice the two rarely disagree — he keeps the sheet current with his errata, and most of its mechanical changes were already true in `sheet-worker.js` when checked. Where they do disagree the errata governs, and the difference is recorded rather than applied silently. See `docs/ERRATA.md`.

**`todo.txt` in the errata set is NOT errata.** It is his own working list of things he intends to change and has not. Never build from it.

## Target platform

Foundry VTT **V14** (current stable line). Sheet UI is redesigned for Foundry's native conventions, not a clone of the Roll20 sheet's layout.

## Architecture

**Layer 0 — Foundation** (must be solid before anything else is built on it):
- Roll Engine: attribute-save resolver, skill-check resolver, combat resolver
- Actor data model (Character, Creature)
- Content/compendium layer: sourcebook-tagged, enable/disable at sourcebook or individual-entry level, supports custom/homebrew entries with no code changes

**Layer 1 — Character foundation:** Attributes, Races & Classes (compendium-driven), Skills

**Layer 2 — Assembly & play:** Character Generation, Combat, Equipment (compendium-driven)

**Layer 3 — Actor variant:** Creature/NPC (blocked on Bestiary source material)

**Layer 4 — Deferred:** base Magic (Aura) and Divine Magic (Piety), plus 20+ individually-toggleable magic/crafting subsystems (runes, potions, elixirs, charms, poisons, bardic magic, empathy magic, glyphs, rituals, sympathy magic, etc.) with a master "all magic off" switch. Not started until the core phase (Layers 0-3) is complete.

Full rationale for every one of these calls is in `docs/DECISIONS.md`. Full task-level status is in `docs/PROGRESS.md`.

## Working protocol

**Agile board + self-check loop.** Work is tracked in `docs/PROGRESS.md` as epics/stories with a Definition of Done per story. At the end of every work loop, before marking a story Done, run the Self-Check Checklist at the bottom of `docs/PROGRESS.md`: verify against `docs/reference/` (cite the page), verify no conflict with the Roll20 sheet (sheet wins), confirm the DoD is actually met, update the board, log any new architectural call in `docs/DECISIONS.md`, commit. The board can be browsed, filtered and checked for dependency loops at `tools/progress.html`; a new board row needs a matching entry in `docs/task-dependencies.json` or the page warns.

**Model choice for heavy work — settled: Opus.** The user's standing answer (2026-09-25) is to use Opus for all tasks, implementation included. Do not stop to ask Opus-or-Fable before starting real work. (Previously: stop and ask before any non-trivial rules encoding, architecture-locking decision or substantive system code.)

**Match the original developer's code style.** This project will be handed back to W. Michael Tenery III, who needs to pick it up without decoding an unfamiliar style. Study `docs/reference/sheet-worker.js` (~180k lines of his actual code) before writing anything, and follow his conventions: naming patterns (`tmp*`/`temp*` prefixes), `// @MARKER` comment markers, heavily-commented code, data dictionaries laid out with aligned column-header comments. This overrides default modern-JS idiom and the usual minimal-comments habit.

**Hand the mechanical follow-through to Sonnet, in writing.** Every work pass ends with a short
note in `docs/sonnet/`, named `YYYY-MM-DD-<slug>.md`, listing what the pass deliberately left
undone because it is mechanical extension of an already-established pattern. Each entry says what
to do, which files, what "done" looks like, and what has already been decided so it is not
re-litigated. The expensive window is for judgement — reading his contradictory code and deciding
what he meant; regenerating a table, mirroring a test, propagating a field through a sheet is not
that. Leaving it written down also keeps a deferral from turning into a silent omission.

**The Roll20 sheet outranks the PDFs; his errata outranks the sheet.** `sheet-worker.js` and the sheet markup beat the rulebooks, which are supplementary — consulted for prose, rationale and gaps. Above both sits the errata he supplied on 2026-09-21, which is newer than either and corrects them; see the Source of truth rule above and `docs/ERRATA.md`. Changed 2026-09-21 by the user's ruling: before that the sheet was top and there were only two sources.

**Continuity across sessions.** This file, plus `docs/DECISIONS.md` and `docs/PROGRESS.md`, are the durable record. A new conversation window should read all three before doing anything else — don't re-derive architecture from scratch or re-extract PDFs that are already in `docs/reference/`.

**Use the Graphify knowledge graph as the default first move for codebase questions.** `graphify-out/graph.json` exists at repo root — treat any question about architecture, file relationships, or "how does X work" as a `graphify query "<question>"` first, before grepping or re-reading the tree cold — same idea as the continuity files above, but for code structure instead of decisions.

Coverage is currently **JS/Python code only** (`module/` and `tools/`, via AST extraction — no LLM key needed). `styles/`, `templates/`, `packs/`, `lang/`, and the top-level docs are *not* in the graph yet: Graphify's semantic extraction for non-code files (markdown, JSON-as-data, HBS templates) needs an LLM API key set as an env var (`ANTHROPIC_API_KEY` etc.) that isn't configured — that's a separate credential from this session's own access, ask the user before setting one. `docs/reference/` (rulebook dumps) is deliberately excluded regardless — local-only, and too large to be worth it. `src/packs` (raw compendium data) is excluded as noise, not architecture.

To rebuild after code changes (the installed Graphify's command is `update`; `extract` now exits silently and writes nothing — found 2026-09-24):
```
graphify update ./module --no-cluster
graphify update ./tools --no-cluster
graphify merge-graphs ./module/graphify-out/graph.json ./tools/graphify-out/graph.json --out graphify-out/graph.json
```
Note: the `graphify.exe` shim in `.local/bin` can mis-resolve itself on multi-argument or backgrounded invocations (Windows symlink issue) — if `graphify <cmd>` fails oddly, call the venv's `python.exe -m graphify <cmd>` directly instead (find the venv with `pipx environment --value PIPX_LOCAL_VENVS` or under `AppData\Local\pipx\pipx\venvs\graphifyy`). `graphify-out/` (at any depth) is gitignored — the graph is a local cache, not something to commit or treat as source of truth over the code itself.
