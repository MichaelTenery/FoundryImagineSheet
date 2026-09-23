# Hand-off: the Magic & Lore tab (2026-09-22)

What the Magic & Lore pass left undone because it is mechanical extension of what it built. The
design calls are made and are in `docs/DECISIONS.md` ("The Magic & Lore tab, his starting lore, and
the content behind both"); do not re-open them. Rules live in `module/lore-rules.mjs`, the tab's view
in `module/magic-view.mjs`, its buttons in `module/magic-actions.mjs`, starting lore in
`module/starting-lore.mjs`, and `MAGIC_KINDS` (lore-rules.mjs) is the one table of kinds.

Run `tools/lore-test.html` (103) and `tools/window-test.html` (27) after any of these, served with
`Cache-Control: no-store`, and `python tools/extract/test_manual_content.py` (122) after 3.

## 1. Release it (when the user asks, and only when the working tree is quiet)

This pass did NOT bump the version or rebuild `dist/`: another session had uncommitted work in the
tree, and `tools/build_system.py` packs the working tree. When the user asks for a release:

- Bump `system.json` `version` (0.17.0 was the last release; martial arts and Situation Mods also
  landed since, from another session, so the release covers all three).
- Add a `## 0.18.0 — <date>` section at the TOP of `CHANGELOG.md`. Do not add an "Unreleased"
  heading: `module/changelog.mjs` carries a non-version section down into the release below it.
  Draft text for this pass's part:

  > **A Magic & Lore tab.** Every character sheet has a sixth tab. Herbs, potions, elixirs, charms
  > and poisons are carried as doses, and Use takes one. Each lore the character holds (ballads,
  > candle rituals, empathy and sympathy magic, glyphs, hymns, poems, rituals, runes, songs, poison
  > and potion recipes, evokes) has its own group showing the skill that learns it and the skill that
  > uses it, with Use and Brew rolls on his rules (Shift-click for a situational modifier).
  > Memorization points are counted against Knowledge. Spells and invocations can be known,
  > memorized and read out, but casting them is still to come.
  >
  > **2,486 new compendium entries**, from his own tables: 351 herbs, 107 potions, 15 elixirs, 42
  > charms, 961 lore entries, 550 spells and 460 invocations. Poisons are made from a type and a
  > potency, as on his sheet. Run `game.imagine.importContent()` to bring them in.
  >
  > **Starting lore.** New characters get what his sheet's "Provide random lore" gives: an entry for
  > every lore skill, starting herbs, potions and poisons with doses, and starting spells for a
  > caster. It is a tick on the generator's last step, on by default. For a character made before
  > this update, the Game Master has a "Provide starting lore" button on the Magic & Lore tab.
  >
  > **What a use does is not worked out yet.** A successful use shows the entry's description and
  > the practitioner title, and the Game Master applies it.

- Then `python tools/build_system.py` (it warns if the version was not bumped), and commit
  `system.json`, `CHANGELOG.md` and `dist/` together.

## 2. Show the tab in the main sheet preview

`tools/sheet-preview.html` renders five tabs and not the sixth. Add a `<button data-t="magic">` to
the tab strip, `"magic"` to the tab loop, and `magic: V.buildMagicPanel({ items: allItems, system:
character }, game.imagine.getAvailabilityRules(), true)` to `ctx` (import `../module/magic-view.mjs`
as `V`). Its Warrior holds no lore, so it shows the empty state, which is worth seeing. Keep it small:
`tools/magic-preview.html` is the preview of a full tab.

## 3. `docs/ADDING-CONTENT.md`: the four new packs

It still says there are nine packs. Add consumables, lore, spells and invocations, and say the one
new rule: in consumables and lore, names repeat between kinds, so every manual entry should give
`"kind"` (an override with no kind is refused when its name is shared; see `KIND_KEYED_PACKS` in
`tools/extract/build_documents.py`). List the kinds: consumables `herb potion elixir charm` (poisons
are not listed, they are built); lore `ballad candlelore empathymagic glyph hymn poem poisonrecipe
potionrecipe ritual rune song sympathymagic evoke`. A new entry needs `subsystem` too; the value for
each kind is in `MAGIC_KINDS`, or `MAGIC_SUBSYSTEM_OF` in build_documents.py.

## 4. `tools/item-preview.html`: the four new item sheets

It previews the other item sheets against real content; add the consumable (use a poison from
`makePoisonSystem`, the fullest consumable), lore (a candle ritual, which has a component, and a
potion recipe, which shows the recipe panel), spell and invocation. The contexts to mirror are
`buildConsumableContext` and `buildLoreContext` in `tools/window-test.html`.

## 5. `docs/DATA-MODEL.md`: the four item types

Add a short section per type from the schema comments in `module/data/item-consumable.mjs`,
`item-lore.mjs`, `item-spell.mjs` and `item-invocation.mjs`. The code is the source; the doc
follows it (standing rule, DECISIONS 2026-09-12).

## 6. Attribution of the four magic packs (a little judgement, mostly mechanical)

All 2,486 are `sourcebook: "XXX"` because `apply_sources` matches by name and names collide across
kinds. What is decided: attribution for these packs must key on kind as well as name, and nothing is
attributed from a table of a different kind. What is left is finding, per kind, which table of his
Master Index (`docs/reference/master-index-fulltext.txt`, local only) lists it -- spells and
invocations have their own chapters in the Player's Guide, herbs and potions their own tables -- and
teaching `tools/extract/extract_sources.py` to emit `kind|name` keys for them, then taking the pack
out of `NOT_YET_ATTRIBUTED_PACKS` in build_documents.py. Do one kind at a time and spot-check ten
entries of each against the book. If a kind's table cannot be found, leave it XXX.

## Not for this note (judgement, on the board instead)

- **Lore use effects**: porting his `do<Kind>Action` switches. Many cases are regular (a dice
  expression scaled by practitioner title) but many change the character or branch on a roll, and
  deciding how those land in Foundry is design work. Board row "Lore use effects".
- Casting spells and invoking: Layer 4, "Base Magic" and "Base Divine Magic".
- UPSTREAM 57-60 need his answers.
