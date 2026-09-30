# The errata, and what to do with it

He supplied an errata set on **2026-09-21**: corrections for six books plus three tables that are
not in any published book. The files themselves are **not committed** — they are his rules content,
some of it unpublished, and `.gitignore` keeps `docs/reference/errata/` local for the same reason it
keeps the book text local. This file is the map of what is in them, and the record of the ruling on
how they rank against his sheet — **the errata wins**, decided 2026-09-21; see below.

## What arrived

| File | Non-blank lines | Last updated by him |
|---|---|---|
| `PG.txt` — Player's Guide | 755 | 2025-03-15 |
| `MM.txt` — Master's Manual | 577 | 2026-07-17 |
| `MM - grammar.txt` | 248 | — |
| `Aspects.txt` — Aspects of the Wild | 236 | 2026-08-19 |
| `Legends.txt` — Legends of the Unknown | 219 | 2026-07-17 |
| `Mysteries.txt` — Mysteries of the Planes | 193 | 2026-07-17 |
| `Epitaph.txt` — Epitaph of the Fallen | 146 | 2025-01-03 |
| `aspectsfixes.txt`, `todo.txt` | 10 | — |

**2,384 lines in total.** Plus three documents that are not errata at all but new content:

- **Alternate Advancement Class Training** (`.docx`/`.pdf`) — an alternative advancement rule.
- **Racial/Social Skill Mods for Aspects and Epitaph** (`.docx`/`.pdf`) — skill modifier tables.
- **Supernatural Summoning Table** (`.docx`) — a summoning table.

`todo.txt` is **his own working list**, not errata: it records things he intends to change and has
not yet (spell percentage boosts capped at +50%, the Fire elemental's diameter, Aura elemental
damage being d12 aura rather than d6 fire). Those are not decided rules and must not be built.

## The finding that matters: the errata mostly AGREES with the sheet

Before treating this as a pile of overrides, ten class/race restriction changes — the errata's most
directly mechanical content, mapping straight onto each class's `blockedRaces` — were checked
against what the port already builds from `sheet-worker.js`. **Most were already true in his sheet:**

| Errata says | The sheet already |
|---|---|
| Fairies can be Tricksters | allows it ✔ |
| Mountain and Forest Goblins can be Martial Artists | allows it ✔ |
| Kenku can be Mage | allows it ✔ |
| Dark Fairies cannot be Berserkers, Bounty Hunters or Martial Artists | bars all three ✔ |
| Dark Fairies cannot be **Monks** | **does not bar it** ✘ |

So he keeps the sheet current with his errata, and the errata reads as a record of changes already
made rather than a set of corrections waiting to be applied. That **lowers the risk considerably**
and changes what this work is: not "re-derive the rules from a newer source" but "check the sheet
against his own newer statement of the rules, and report the handful of places they differ".

## RULED, 2026-09-21: the errata wins over the sheet

**The user's ruling: option 2 below — the errata outranks `sheet-worker.js`.** `CLAUDE.md`'s Source
of truth rule is rewritten accordingly, and the order is now errata → sheet → rulebooks.

What that means in practice, given the finding above:

- Where the errata and the sheet **agree** — which is most of what has been checked — nothing
  changes, and the sheet stays the convenient machine-readable form of the same rules.
- Where they **disagree**, the errata governs and the port follows it. Each difference is still
  recorded, in `UPSTREAM-ISSUES.md` or a decision entry, so a reader can see what was changed and
  why rather than finding a figure that matches neither source.
- The errata reader (`tools/extract/check_errata.py`, not yet written) therefore becomes a
  **build input** rather than only a report, and its report becomes the record of what it changed.
- `todo.txt` is still excluded: it is his working list of intentions, not rules.

The discussion that produced the ruling is kept below, because the third option was live and the
reasoning for it is worth not losing.

## The source-of-truth question — RULED above, discussion kept

`CLAUDE.md` says: **when the Roll20 sheet and a rulebook disagree, the Roll20 sheet wins** — it
reflects what the table actually plays with. That rule was written when the only other source was
the books. The errata is a **third** source and, dated 2025–2026, the most recent statement of the
rules; several files are newer than anything else in hand.

Three ways to take it, and this has **not been decided**:

1. **Errata as a check, not an override** (what the finding above supports). Build nothing from the
   errata directly. Run it against the sheet-derived documents, report every disagreement, and take
   them to him one at a time — exactly how `UPSTREAM-ISSUES.md` already works. The sheet stays the
   source of truth; the errata becomes the best test of it yet.
2. **Errata wins over the sheet.** The most recent statement of the rules governs. This inverts the
   project's central rule and would need to be written into `CLAUDE.md`.
3. **Errata wins over the books only**, leaving the sheet on top. A narrower change: it would settle
   prose and gaps the sheet is silent on without touching anything the sheet states.

**Recommended (1); the user ruled (2).** The recommendation was that (1) costs least and cannot
silently change a rule anyone is playing. The ruling is that his most recent statement of the rules
should govern, which is (2) -- and the finding above is what makes it safe: the two sources rarely
disagree, so ranking the errata first changes little in practice while removing the awkwardness of
the port knowingly building a figure he has since corrected.

## What is already known to be affected

- **`blockedRaces` on 103 class documents** — ten restriction changes, at least one a real delta.
- **Maginos hide by material** (`Mysteries.txt`, Pg. 30) — Clay 1 per 6 END max 10, Wood 1 per 5 max
  15, Stone 1 per 4 max 20, Metal 1 per 3 max 25. **Directly relevant**: the four Maginos material
  races were built on 2026-09-21 and carry no hide at all, his sheet having none for them.
- **Brownie STR max 13** (`Aspects.txt`) — an attribute limit, which the port reads from his row.
- **Race trait changes across Legends, Aspects, Epitaph and Mysteries** — abilities, disabilities and
  immunities added or renamed on individual races.
- **A creature-wide hide cap of 5 × level** (`Aspects.txt`, `aspectsfixes.txt`, and `MM.txt` "Pg: 290") —
  **modelled 2026-09-23 as a warning, not a clamp**: `body.hideMax`/`hideOverCap` on the creature, flagged
  on its sheet; plants, magical plants and the new Titanic size exempt (DECISIONS 2026-09-23, D4).
- **Undead** (`Epitaph.txt`) — shadowform vs phaseable form by alignment. Relevant to the undead
  transformations noted as absent on 2026-09-21.
- **Race modifiers on social skills — APPLIED 2026-09-23.** `Aspects.txt` "Pg 23(After)",
  `Epitaph.txt` "Pg: 57 (After)" and `Legends.txt` "Pg. 71" carry his race-by-social-skill tables.
  All 215 entries were compared with his `socialskillmoddict`; **13 differ**, and the errata's figure
  is used: Brok Climatology +5 (sheet +10) and Astronomy +5 (none); Gaunt Astronomy +10 and
  Undertaking +10 (both +5); Changeling Dancing +15 (+10); Fairy(Dark) Dancing +10 (+5) and
  Pyrotechnics +5 (+10); Dryad History +5 (none); Katara — the errata's Lamia — Wood Working +5
  (+15); Ratahl Mining/Tunneling +20 (+10); Se’eth Torturing +20 (+5); Sylph Heavy Drinking
  **BLOCKED** (allowed); Equara Running +20 (none). A race the errata leaves out of a skill keeps the
  sheet's value — the Dread Elf row plainly omits the generic Elf entries. The thirteen are a
  committed list in `tools/extract/extract_social_skill_tables.py` (`ERRATA_CHANGES`), since these
  files are not committed; when they are present the extractor re-reads all three and reports any
  entry that no longer agrees. `Legends.txt` Pg 42's "Grants Swimming Social Skill at +50%" is read as
  his code reads it (+50 when Swimming is taken), pending his answer.

- **The Wilder's Aura Control — NOT APPLIED; a ruling is needed (2026-09-24).** `MM.txt` "Pg: 47
  (Wilder Class)", "Should Read", includes "All Aura Control modifiers are halved (round down); apply
  to dual class Wilders as well." That sentence is **word for word the book's own p.47**
  (`masters-manual-fulltext.txt:7119`), and the same page gives "Title Advancement: +1 Aura Control per
  Title". What the errata block actually changes on p.47 is elsewhere: the "18 skill points, +1 WIL 5%,
  +1 AUR 5%" move to Goal Advancement, and the animal Affinity is reworded. His sheet encodes the page
  as +1 a title for a Wilder (`getAuraControlTitleMod`, sheet-worker.js:96291, where a Mage has 2) and
  adds Intelligence, Metaphysics and the boost in full (96729-96733).
  - A first port on 2026-09-24 applied the halving to every modifier as "errata over sheet". It was
    withdrawn on review before merging: the errata restates the book here rather than correcting it,
    and the sheet, which outranks the book, had already read the same sentence.
  - **The question for the user:** does restated, unchanged book text in the errata count as "errata
    disagreeing with the sheet" under the 2026-09-21 ruling? Until that is answered his sheet is
    followed, as it was before 2026-09-24 (`module/casting-rules.mjs`, THE WILDER'S HALVING).
  - What applying it would change: a Wilder at title 5 with Intelligence +2 and Winds of Wild Magic is
    14 on his sheet, and would be 12 with every modifier halved. "Round down" would be `Math.floor`, so
    a penalty halves away from 0 (Intelligence -3 to -2).
  - The separate fix beside it stands, and is his sheet's own: a Wilder never takes Spell Lore's +2
    (his setMagicDivineLore sets spellLoreBonus 0 for a Wilder, 96663-96670).

## Two files in the folder are NOT the 2025–26 errata (flagged 2026-09-26)

`PGErrata_limited.pdf` and `MMErrata_limited.pdf` sit in `docs/reference/errata/` beside the `.txt`
set, but they are **1998 printing errata** for the first printings, not part of the set he supplied
on 2026-09-21 as his current word. They are superseded, and the "errata wins over the sheet" ruling
above does **not** apply to them: where one of them disagrees with the sheet, the sheet wins as
before, and the `.txt` files remain the only errata ranked above it. They were missing from the
"What arrived" table above for that reason; they are listed here so nobody promotes them by mistake.

## Applied so far

| Date | Errata line | What changed | Where |
|---|---|---|---|
| 2026-09-26 | `MM.txt`, "Pg: 46 (Healer Class) Social Skills" | Healer's social skill Philosophy → **Physiology** (his sheet still says Philosophy, sheet-worker.js:54353) | `tools/extract/extract_class_social_skills.py` `ERRATA_REPAIRS`, re-checked against the local `MM.txt` on each run; printed as a repair |

## Next step

Nothing has been built from any of this yet. The question above is settled, so the next pass is
`tools/extract/check_errata.py` — a reader that parses the errata's own regular shape (`Pg. N`
headings, race and class names, "should read" lines), reports every disagreement against
`src/packs/documents/` the way `check_race_references` and `check_skill_references` already report
against his dictionaries, and — because the errata now outranks the sheet — **applies** what it
finds, printing each change on every run.

Start with the ten class/race restrictions and the Maginos hide table: they are the most structured
parts of the errata and they land on content already built. Expect most of the file to be prose that
no reader can apply mechanically; that part stays a report for a human to work through, and the
honest measure of the tool is how much of the 2,384 lines it can classify, not how much it changes.

## 2026-09-30 — rulings that arrived with his bug reports

Ten bug reports (`Bug Report 0.20.1` to `0.20.10`, filed 2026-09-30 against 0.20.0) and four notes
on class skills. Three of them are rulings on his own data rather than defects, and rank as his
newest statement, above the sheet and the books:

| Ruling | Where it now lives |
|---|---|
| **Botanist is Botany** (0.20.5). His skilldict, socialskilldict, race-modifier table and Herb Lore link all carried both, identical (Mysteries p.165). Only Botany exists now; his Aspects errata's "Dryad: Botanist +20%" is read as Botany. | `build_documents.py` SKILL_RENAMES; the social-skill and kit extractors; `content-importer.mjs` RETIRED_DOCUMENTS; `module/data-fixes.mjs` for characters already made |
| **The Long Sleeve Shirt table** (0.20.6), from the upcoming Conquest of the Eternal: sixteen materials, low/medium/high and a weight for a 6' human. Applied to Long Sleeve Shirt alone; Full Shirt and Long Shirt, which look transposed the same way, are UPSTREAM 116. The other four price columns follow his own rows' rule (low/4, low/2, high x2, high x3). | `column_maps.py` ARMOR_VALUE_REPAIRS (weights), `extract_shop_tables.py` COST_REPAIRS (prices); both reported on every run |
| **The Common Skills Listing** (0.20.7): the Player's Guide p.77 table of the 64 class and racial skills anyone may attempt untrained. Every other class skill is restricted -- attemptable only as a non-acquired skill. It settles the 74 Conquest of the Eternal skills the port has no book for, and overrides the Player's Guide's own "Restricted: No" on four (UPSTREAM 117). | `src/packs/named/commonSkillsListing.json`, read by `build_documents.py` build_skills |
| **Spell Lore may not be used non-acquired** (0.20.8): stated by him; the Player's Guide entry says only Restricted: Yes. | `src/packs/manual/skills.json`, an `_override` |

His four notes on class skills (a character is exposed to the whole class table in training,
chooses at creation what she keeps within Knowledge's class slots, and a skill not kept is not a
class skill for her at all) are the rule the 2026-09-26 whole-career plan already built
(DECISIONS "Character generation: alignments, social skill lists, and the whole-career class skill
plan", §4); they were written against 0.20.0, before that shipped.
