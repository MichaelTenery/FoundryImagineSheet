# Onboarding for a second AI agent

For any AI coding agent (Claude Code, Codex, Cursor, or similar) joining this repository alongside the existing Claude Code sessions. Read it top to bottom before touching anything. A copy-paste starter prompt is at the end.

## 1. What this project is

A conversion of the **Imagine Role Playing System™** from its Roll20 custom character sheet into a full **Foundry VTT V14** game system, built with the rights holder's (W. Michael Tenery III) permission. The code will be **handed back to him**, so it has to read like his.

The system is already in build and has run at his table since 0.20. Do not treat it as a greenfield. `README.md` says what works and what does not.

## 2. Hard rules (breaking these does real damage)

1. **Never commit book text or errata.** The repo is public. These are gitignored and must stay that way:
   - `docs/reference/*-fulltext.txt`: extracted rulebooks, regenerated locally from PDFs with `python tools/extract/extract_book_text.py "<book.pdf>" <name>`.
   - `docs/reference/errata/`: his errata, supplied privately. Some of it is in no published book.
   - `*.pdf`, `docs/local/`, `graphify-out/`.
   Do not paste long passages of any of these into code, comments, docs or commit messages. Cite page numbers instead.
2. **Source-of-truth order, highest first:**
   1. His **errata** (local only, `docs/reference/errata/`; summary in `docs/ERRATA.md`).
   2. The **Roll20 sheet** (`ImagineRoll20CharacterSheet-main/`, and `docs/reference/sheet-worker.js`, his ~180k-line worker script).
   3. The **rulebooks**, for prose, rationale and gaps only.
   Where sources disagree, the higher one wins and the disagreement is **recorded**, not silently applied.
3. **`todo.txt` in the errata set is NOT errata.** It is his list of things he intends to change. Never build from it.
4. **Do not "fix" his rules.** If his code or data looks wrong, it goes in `docs/UPSTREAM-ISSUES.md` as a question for him. Repair it only if the errata says so, and print it as a repair.
5. **Foundry V14 only.** ApplicationV2, current DataModel and ActiveEffect APIs. No legacy or back-compat shims.
6. **Bump `system.json` version when shipped files change.** Foundry compares version numbers and nothing else. An unbumped release is invisible to every installed copy. `tools/build_system.py` warns about this.

## 3. Read first, in this order

1. `CLAUDE.md`: project context and the working protocol.
2. `docs/DECISIONS.md`: append-only log of every architectural call, with rationale. Do not re-litigate settled decisions.
3. `docs/PROGRESS.md`: the board, with a Definition of Done per story, and the **Self-Check Checklist** at the bottom.
4. `docs/STYLE.md`: his code conventions. This **overrides** default modern-JS idiom and the usual minimal-comments habit.
5. `CHANGELOG.md`, `docs/DATA-MODEL.md`, `docs/ADDING-CONTENT.md`, `docs/FIRST-RUN.md` as needed.
6. The newest notes in `docs/sonnet/`: hand-offs listing work deliberately left undone.

## 4. Code style, in short

Match `docs/STYLE.md`. In particular:

- `// @MARKER` comments are section headers and insertion points. New code goes under the right marker.
- Heavily commented code: say what he would want to know when he opens the file cold.
- `tmp*` / `temp*` prefixes for temporaries. Data dictionaries are laid out with aligned column-header comments.
- Copy the idiom of the neighbouring file. Do not introduce a new pattern when an established one exists.

## 5. Layout and commands

- `module/`: system JavaScript (`data/`, `sheets/`, `apps/`, `combat/`, plus `*-rules.mjs` and `*-tables.mjs`).
- `templates/`, `styles/`, `lang/`: Handlebars, CSS, strings.
- `src/packs/`: content in stages (`raw/`, `named/`, `documents/`, `manual/`). Edit `manual/` for hand-authored entries. Do not hand-edit generated stages.
- `tools/extract/`: build-time extraction (Python). Not shipped.
- `dist/imagine-rpg/`: the installable system. `dist/imagine-rpg.zip` is committed on purpose.

```bash
# run every headless suite (Foundry is stubbed; no install needed)
node tools/run-tests.mjs

# rebuild the installable system and zip
python tools/build_system.py --zip
```

The browser suites and previews in `tools/*.html` run over any static server. Passing tests are **not** proof the thing works in a real Foundry V14. Anything the board marks "not verified" has not been exercised in a running install.

## 6. Working loop

1. Pick a story from `docs/PROGRESS.md` (or a bug from the newest `docs/sonnet/` note). Say which one you took, before you start (see section 7).
2. Verify the rule against `docs/reference/` (cite the page), then against the Roll20 sheet. The higher source in section 2 wins.
3. Write the code in his style, with a test beside it.
4. Run `node tools/run-tests.mjs`. Report real failures with their output. Do not paper over them.
5. Run the **Self-Check Checklist** at the foot of `docs/PROGRESS.md`. Update the board, and add an entry to `docs/task-dependencies.json` for any new board row.
6. Log any new architectural call in `docs/DECISIONS.md` (append only).
7. End the pass with a short hand-off note in `docs/sonnet/YYYY-MM-DD-<slug>.md`: what you left undone because it was mechanical extension of an established pattern. Say what to do, which files, what "done" looks like, and what is already decided.
8. Commit with a clear message.

## 7. Linking up with the other agent(s)

Two agents editing the same files at the same time is how work gets lost. Use git as the channel.

- **One branch per task**, named `<agent>/<short-slug>` (for example `codex/skill-table-fix`). Never commit to `main` directly. The current working branch of the primary Claude session is `wip/bug-reports-0.20`; do not push to it.
- **Claim before you start.** Add a one-line row to `docs/sonnet/CLAIMS.md` (create it if absent): `YYYY-MM-DD | agent | branch | files or story | status`. Read it before claiming. If someone holds a file, pick something else or ask the user.
- **Stay in your lane.** Touch the files your claim names. If you need a change elsewhere, write it in your hand-off note instead of making it.
- **Rebase on the base branch** before opening a PR. Resolve conflicts, then re-run the tests.
- **Shared files are append-only or serialised:** `docs/DECISIONS.md` (append only), `docs/PROGRESS.md`, `CHANGELOG.md`, `system.json` version. Make those edits last, in a small commit, to keep conflicts small.
- **Hand-offs are in writing** in `docs/sonnet/`. Do not rely on chat memory. The other agent cannot see your conversation.
- **Ask the human** (the user) for anything in section 8.

## 8. Stop and ask the user before

- Anything involving the errata, the rulebook text, or the PDFs (what may be shared, what may be quoted).
- Reversing or reinterpreting an entry in `docs/DECISIONS.md`.
- Changing a rule because the code "looks wrong".
- Adding a dependency, build step, or non-V14 compatibility layer.
- Force-pushing, rewriting history, deleting branches, or publishing a release.
- Sending anything to W. Michael Tenery III or any outside party.

## 9. Starter prompt (copy-paste)

```text
You are joining an existing project: a conversion of the Imagine Role Playing
System from a Roll20 sheet into a Foundry VTT V14 game system, built with the
rights holder's permission. The code will be handed back to him, so it must
match his style. Another AI agent is already working in this repository.

Before doing anything, read in order: docs/AI-ONBOARDING.md, CLAUDE.md,
docs/DECISIONS.md, docs/PROGRESS.md, docs/STYLE.md, and the newest files in
docs/sonnet/. Do not re-derive architecture or re-open decisions already made.

Hard rules:
- The repo is public. Never commit rulebook text, errata, PDFs, or anything
  under docs/reference/*-fulltext.txt, docs/reference/errata/, docs/local/.
  Cite page numbers instead of quoting.
- Source of truth, highest first: his errata, then the Roll20 sheet
  (docs/reference/sheet-worker.js), then the rulebooks. Where they disagree,
  record it; do not apply it silently. todo.txt is NOT errata.
- Do not "fix" his rules. Suspected defects go in docs/UPSTREAM-ISSUES.md.
- Foundry V14 only (ApplicationV2, current DataModel APIs).
- Match docs/STYLE.md: @MARKER section comments, heavy commenting, tmp*
  prefixes, aligned data tables. This overrides your default style.

Working loop: claim your task in docs/sonnet/CLAIMS.md and work on your own
branch named <agent>/<slug>, never main. Verify the rule against the sources,
write the code with a test, run `node tools/run-tests.mjs`, run the
Self-Check Checklist at the foot of docs/PROGRESS.md, append any new
architectural call to docs/DECISIONS.md, bump system.json if shipped files
changed, and finish with a hand-off note in docs/sonnet/YYYY-MM-DD-<slug>.md
listing what you left undone and what is already decided. Report test
failures honestly with output.

Stop and ask the human before: touching errata or book text, reversing a
logged decision, changing a rule because it looks wrong, adding dependencies,
force-pushing, releasing, or contacting anyone outside the project.

Your first task: <PASTE TASK HERE>. Start by summarising back what you read
and which files you intend to touch, then wait for confirmation.
```
