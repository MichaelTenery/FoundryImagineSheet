# Changelog

Versions of the Imagine RPG system for Foundry VTT. Newest first.

Foundry updates the system itself: `system.json` declares both `manifest` and `download`, so a
push to `main` publishes a new version and an installed system offers it from the Game Systems tab.
The archive is committed alongside the manifest on purpose, so the two can never disagree about
what version is being offered.

> **Give a push about ten minutes before updating.** `raw.githubusercontent.com` caches the
> manifest and the archive separately, and the archive has been seen serving the previous commit
> for several minutes after a push while the manifest was already current. Updating inside that
> window can fetch the older archive. Measured on 2026-09-21; see `docs/DECISIONS.md`. The proper
> fix is to point `download` at a GitHub Release asset, whose URL is immutable — not done yet.

**Nothing below has been verified in a running Foundry V14 install** except where it says a real
install found it. That remains the standing caveat on the whole project.

---

## 0.18.1 — 2026-09-23

**The version on every window.** Each Imagine sheet and window shows the system's version in its
title bar, so which build is running is always in view. Turn it off in Configure Settings, "Show the
system version on windows" (each player chooses for themselves).

## 0.18.0 — 2026-09-23

**Melee and missile modifiers.** The Combat tab has a Situation Mods bar and a **Melee / Missile
Mods** button that opens the original sheet's two panels: position, the target's state, visibility,
cover, size, aiming and range, each worth what his sheet made it worth. They stay set until cleared,
every attack of that kind reads them, and they move your own Defence too -- Furious Attack makes you
easier to hit, and being blind takes your defence away. Critical, Focused Attack, Surprise Attack,
Brace, Perfect Shot and Quick Load are rolled from the window, as on his sheet. Creatures have the
same bar.

**Second Weapon Knowledge and Lore now work.** Name the weapons you hold them in on the Combat tab's
Lore panel (one more for every title held in the skill). Before this they never applied.

**Martial arts.** Open the Martial Arts heading on the Combat tab to choose a discipline and a stance,
make moves, and roll martial attacks, blocks, holds and throws; Martial Lore adds its own values. A
stance changes your Defence, initiative and speed at once, and now also gives the skill, save and
resistance bonuses its description lists -- with a box for failed intoxication saves (the Drunken
stance) and a tick for resisting a hold (Calm in the storm). A weapon attack takes your stance and
moves too. Martial Lore's blind fighting follows the book: +2 to hit, +1 damage and +5% combat skills
for each 25%. Creatures with Martial Knowledge have the same panel.

**A Magic & Lore tab.** Every character sheet has a sixth tab. Herbs, potions, elixirs, charms and
poisons are carried as doses, and Use takes one. Each lore the character holds (ballads, candle
rituals, empathy and sympathy magic, glyphs, hymns, poems, rituals, runes, songs, poison and potion
recipes, evokes) has its own group with the skill that learns it and the skill that uses it, and Use
and Brew rolls on his rules (Shift-click for a modifier). Memorization points are counted against
Knowledge. Spells and invocations can be known, memorized and read out; casting them is still to come.
What a lore's use actually does is not worked out yet -- a successful use shows the entry and the
Game Master applies it.

**2,486 new compendium entries**, from his own tables: herbs, potions, elixirs, charms, lore
entries, spells and invocations. Spells, invocations and four kinds of lore now carry their
sourcebook, from his Master Index. Run `game.imagine.importContent()` to bring them in.

**Starting lore.** New characters get what his sheet's "Provide random lore" gives: an entry for every
lore skill, starting herbs, potions and poisons, and starting spells for a caster. It is a tick on the
generator's last step. For an older character, the Game Master has a "Provide starting lore" button
on the Magic & Lore tab.

**Poison.** Use on a poison asks who takes it, rolls each victim's Poison Resistance, and posts when
it takes effect and for how long. Its damage now has an Apply button: it goes on overall Endurance,
counting toward shock, shown as Overall Wounds on the Combat tab. A poison can also **coat a weapon**;
the next hit that draws blood delivers it. An Envenomed blade holds up to five doses.

**Weapon mods.** Every weapon row has a wand button. Bless a weapon for a day, or add your own
temporary effect with a to-hit, a damage and how long it lasts. Below that is the whole of the
original sheet's Customize panel -- condition, quality, prefix and suffix, the magical plus or
Blessed, magical and divine abilities, runes, energy, physical customizations, and weight -- applied
to the weapon or to a customized copy. Customization does what it did on his sheet: a Chain Weapon
rolls a die more and is two seconds slower, a Gravity rune makes a weapon heavier and slower, a Rune
of Strengthen adds to its strength, and runes, Blessed and the magical abilities count in the attack.

**Each combatant's seconds, round by round.** Every row of the combat tracker shows that combatant's
ten seconds -- lost to a late initiative, spent, and left -- with buttons to spend and undo. The
stopwatch at the top of the tracker opens **Mr. Initiative**, the Master's Manual's round chart. An
action that runs past the tenth second carries into the next round; the off hand has its own seconds;
Speed seconds (a box on the Combat tab) put the character first. The Combat tab shows the same clock
while you are in the fight. The Game Master can give chosen combatants **surprise** -- 1d4+1 seconds
of unanswered action before round 1.

## 0.17.0 — 2026-09-22

**This window.** After an update, everyone now sees what changed, once, the first time they load
the world. It can be opened again at any time from Configure Settings → What's New.

**Race sheets show more of what a race is.** Which form it is (winged or wingless), the race it was
split from, Gremlin's slight-physique variant, and a Famorian's breed table (editable) and full evoke
list. The list of bodies a Formless may take as a host is now editable.

**Class sheets show what a class gives**: the races barred from it, its class skills, its base class
and path, and its Arch Mortal requirements. Several long fields that were cut off (armour and weapon
usage, class type) are now boxes large enough to read.

**The character sheet shows a Famorian's evokes** with its breed and how many of its evokes are
spent ("3 of 4"), says when a faerie race is always or never of slight physique, warns when a Half
Race mixes a winged and a wingless form, and marks a class the character does not qualify for.

**New characters wear their starting armour.** The generator now puts on the best legal armour from
the starting kit, as the sheet's Equip Best Armour button does. Weapons and shields are still left
for the player to choose.

**Item quality affects weight.** Weapons, armour and equipment have a Quality setting (Shoddy to
Master); it changes the item's weight for encumbrance, unless the item has a magic bonus, as on the
original sheet.

**Skills know whether they can be tried untrained.** Each skill's "Restricted" flag is now read from
the rulebooks: 305 skills are restricted. Social skills have no such flag in the books. The two
placeholder entries "Open Slot" and "Unavailable" are no longer imported as skills, and re-running
the import removes them.

**The Items sidebar** groups equipment by type where one is set, and gathers everything with no known
source into one "XXX — no source found" folder. Fifteen more abilities now have a source, and two
items now point at their own table rather than a passing mention (Crossbow(Heavy), Spectacles(Reading)).

**Colours follow the theme.** Warning red, confirmation green and the other highlight colours now
change with the Foundry-standard theme instead of staying fixed.

## 0.16.1 — 2026-09-22

Play-testing feedback on 0.16.0.

**"Animal Shape: (water animals only)" no longer appears on every race.** It was never on them: it
was the faint example text in the race sheet's empty Skill note field. The example is gone. Nixie
is still the one race that really carries that note.

**Plain "Fairy" and "Fairy(Dark)" are removed from the race list.** They were left behind in worlds
imported before the faeries were split into winged and wingless forms. **Re-run the import to clear
them** (`game.imagine.importContent()` from a macro): it now removes races and classes the system no
longer ships -- the two faeries, Podling, Sporeling, and the unsplit Elemental Dancer and Innominate
classes -- and only those, so anything you added by hand is untouched. If you filled the Items
sidebar, fill it again and the same names go from there too. The "Awaiting the developer" text some
race descriptions showed belonged to those old races and goes with them.

**Dark Fairies' skill note says their Animal Shape may take the form of a D'Wisp.**

**A Formless character has a "Formless: Bodies" notes field** on the Description tab, to record the
bodies it has worn until switching bodies is properly built.

**Not changed, on purpose:** a Famorian's evokes are not limited by the animal chosen -- the Game
Master decides, as on the original sheet. The race descriptions still carry notes about how the
conversion handles each race; they will be cleaned up before public release.

## 0.16.0 — 2026-09-22

**A Famorian can now be made in the character generator.** Folded into the Race step: a breed roll
or dropdown, an animal type field, and a picker over all ~120 evokes (the fifteen that change a
number picked out in bold) with a live budget ("3 of 4"). The breed rolls and stands by default,
the same restraint handedness shows — no re-roll button, unless "Players may choose Famorian
breed" is on.

**Before it could be built, a real bug turned up.** The character model was reading a Famorian's
evokes from the wrong field (`identity.famorian` instead of `physical.famorian`), so **a Famorian's
evokes were never being applied at all** — this was true from the moment Famorian shipped in
0.14.0 until today. Nothing in the released system depended on it (there was no way to set the
evokes through the UI yet), so no character was ever affected, but it is fixed now and a new
automated test would catch a repeat of exactly this mistake.

**Also fixed on the way:** a Formless character with no host, or one that isn't allowed, now
actually tells the player why — that display was built yesterday and never wired into the template.

## 0.15.0 — 2026-09-21

**Every race now says which book it comes from, and on what page.** 87 of them used to point at the
Master Index, which names itself as the source, and 14 said nothing at all. All 120 now name a real
book and a real page:

| Book | Races |
|---|---|
| Mysteries of the Planes | 47 |
| Player's Guide | 22 |
| Aspects of the Wild | 18 |
| Legends of the Unknown | 15 |
| Master's Manual | 13 |
| Epitaph of the Fallen | 5 |

**118 of those are Daryl's**, attributed by hand on his fork. Famorian (Aspects of the Wild p.6) and
Formless (Epitaph of the Fallen p.6) were added afterwards, since neither race existed when he did
the work.

**New: `src/packs/manual/sources.json`.** A sourcebook and page can now be written by hand for any
document, in any pack, and it **wins** over the table generated from the Master Index. This is where
attribution belongs — `src/packs/documents/*.json` is generated and the next build overwrites it.
See `docs/ADDING-CONTENT.md`, Route 3.

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
   can now be made through the generator too, as of 0.16.0 — breed, animal type and its evokes are
   all on the Race step.
5. **Anything that used to say a race was missing.** Every race in the original species list is now
   a document.

Known gaps, so they are not reported twice: a Formless and its host are not shown distinctly on
the Description tab (only in the generator); nothing from the errata is built yet.

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
