# Changelog

Versions of the Imagine RPG system for Foundry VTT. Newest first.

Foundry updates the system itself: `system.json` declares both `manifest` and `download`, so a
push to `main` publishes a new version and an installed system offers it from the Game Systems tab.
The archive is committed alongside the manifest on purpose, so the two can never disagree about
what version is being offered.

**Nothing below has been verified in a running Foundry V14 install** except where it says a real
install found it. That remains the standing caveat on the whole project.

---

## What to look at in 0.14.0, if you are testing

Coming from **0.11.1**, which is the version the last bug report was against.

1. **The resistance rolls** — the Blocker from that report. Attributes tab, the Resistances panel:
   each of the five now has a Roll button. Shift-click one for a modifier. Worth checking the
   wording of the result as much as the numbers.
2. **The race list is longer and some names have changed.** There is no plain `Fairy`, `Fairy(Dark)`,
   `Podling` or `Sporeling` any more — each is now a `(Winged)` and a `(Wingless)` entry. **An
   existing character holding one of the old races will not find it**; the race item has to be
   swapped for the form you want. Same for a Maginos, which now has four materials.
3. **Slight Physique is not offered for the faerie races.** Choosing a winged form ticks it and
   greys it out; a wingless form unticks it. That is deliberate — in the original sheet the wings
   *are* the slight-physique branch.
4. **Formless and Famorian exist.** A Formless needs two race items (itself and a host). A Famorian
   can be assembled on the sheet but **cannot yet be made in the character generator** — that step
   is not built, and is the next thing queued.
5. **Anything that used to say a race was missing.** Every race in the original species list is now
   a document.

Known gaps, so they are not reported twice: no Famorian step in the generator; a Formless and its
host are not shown distinctly on the Description tab; nothing from the errata is built yet.

---

## 0.14.0 — 2026-09-21

**Famorian, the last unbuilt race. Every race in his `specieslist` now exists.** A Famorian is
beast-blooded and its body is *built*: a d100 gives its breed, the breed says how many "evokes" —
beast traits — it may take, and there are about 120 to choose from. Of those, fifteen change a
number; the rest are described abilities, listed and not applied, as racial abilities already are.
A Famorian that has taken no evokes is −4 Social Class, mental limits of 19, beauty and charm at
15, +10% magic and −10% disease resistance, a 1d4 Endurance roll a title, and no special movement.

- The breed is **rolled**, with a world setting to choose instead — the same shape as handedness.
- Over-budget evokes and a missing animal type are **reported, never refused**.
- Races **119 → 120**.

**Seven modules were never being parse-checked.** The syntax-check suite holds a hardcoded list
that had drifted — it reported 41 modules with 48 on disk. Five of the seven were months old,
including the item picker and the Items directory. All are checked now, and the build fails loudly
if the list drifts again.

**The errata now outranks the Roll20 sheet** (see `docs/ERRATA.md`). Nothing is built from it yet.

## 0.13.0 — 2026-09-21

**Daryl's 0.11.1 Blocker is fixed: the five resistances can be rolled.** Both actor sheets now have
a Roll button on each of Magic, Illusion, Control, Poison and Disease. Shift-click asks for a
modifier. Immunity answers first and says the effect never happened; 200% or more is "virtually
immune"; a natural 100 always fails and a natural 1 always succeeds.

**Formless is built.** A free-floating psyche that inhabits a host body: it supplies the mental
half of a character and the host supplies the physical half. Hold **two race items** — the Formless
and the host — and they combine. 110 races may be inhabited. A Formless with no host, one inside
another Formless, a second body, and a host that is not on his list are all reported rather than
refused.

- Races **118 → 119**.
- A Formless in a winged Fairy flies, and inherits the winged form's physique.

## 0.12.0 — 2026-09-21

**The races his sheet splits with a second dropdown are now races of their own.** His sheet asks a
second question beside the race picker; a Foundry race is an Item and cannot ask one, so each form
is its own document:

- **Fairy(Winged)** / **Fairy(Wingless)**, **Fairy(Dark Winged)** / **Fairy(Dark Wingless)**,
  **Podling(Winged)** / **Podling(Wingless)**, **Sporeling(Winged)** / **Sporeling(Wingless)**.
  In his code the wings *are* the slight-physique branch, so the two are one choice: a winged form
  is always of slight build and a wingless one never is, and the generator no longer offers the
  tick for them.
- **Maginos(Clay)**, **Maginos(Metal)**, **Maginos(Stone)**, **Maginos(Wood)**, differing in
  starting Endurance and in whether they float. Plain **Maginos** stays as the `[Other]` material.
- **Gremlin is deliberately not split** — it flies either way — and keeps its free tick.
- Races **110 → 118**.

**Fixed on the way:** two forms of one race could not breed with each other, and the Dark Fairy
Wood Lore override would silently have become a new custom race.

## 0.11.1 — 2026-09-21

Legends of the Unknown taken in; the unattributed-source report is now generated on every build.

## 0.11.0 — 2026-09-21

Every item says where it came from, out of his own Master Index. 2,693 of 4,395 documents name a
source; the rest are listed in `docs/UNATTRIBUTED.md`.

## 0.10.1 — 2026-09-21

The Items sidebar reads the world's compendia rather than the shipped file, so hand-added content
reaches it. A batch Foundry refuses is reported instead of stopping the run.

## 0.10.0 — 2026-09-21

Wood Lore taken off the Dark Fairy, at the developer's instruction.

## 0.9.0 — 2026-09-21

The Items sidebar is populated: `game.imagine.populateItems()` fills Foundry's Items directory with
all documents in 86 folders; `clearItems()` takes them out.

## 0.8.0 — 2026-09-21

An item picker. The Equipment tab's Add buttons open a searchable picker over the real content
rather than making a blank item.

## 0.7.0 — 2026-09-21

Set Trap, Detect Trap and Remove Trap gained their wilderness and urban variants, which his class
and racial lists name 106 times between them.

## 0.6.0 — 2026-09-20

The three optional starting-kit rules: gear by culture, clothing by status, tools by skill.

## 0.5.0 — 2026-09-20

Slight Physique reaches the race, not just the ratings.

## 0.4.0 — 2026-09-20

Daryl's testing pass: six fixes, the worst a tab going blank whenever anything on it was added or
deleted.

## 0.3.0 and earlier — 2026-09-20

Updates ship through Foundry's own updater; sheets and windows scroll; handedness is rolled rather
than chosen; the dark-theme fields were invisible and are not any more. See `docs/PROGRESS.md` for
the full account of everything before 0.4.0.
