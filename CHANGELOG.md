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

## 0.20.0 — 2026-09-24

**New characters can buy their equipment.** The character generator has a new **Equipment** step
between Details and Review. It holds the money, which is now rolled there rather than on Details,
and the starting-kit ticks, and it adds a shop. The shop sells everything his sheet's ADD/BUY ITEMS
panel sells, at his prices. Pick Armor/Clothing, Weapon or Equipment, narrow the list by kind or
search by name, set the number and press **Buy**. Each Buy is paid from whatever the list already
leaves. If the purse cannot cover it, you are told so in his words and nothing is added. The purse
line shows what the character has, what the list leaves, and what it has spent. Each item's weight
is shown, with the load the character would carry. Nothing is paid until the character is created.
If the money is re-rolled or changed and something on the list no longer fits, it is marked and Next
waits until you remove it or buy fewer. Everything bought is carried, and bought armour is put on.
Barding is only put on the body it was made for: a Centaur wears its Centaur Barding, and a Human who
buys horse barding carries it. Arrows, rations and other gear arrive as one stack. Swords and armour
arrive one item each, so each can be held or worn. The Review shows what was bought and the purse
left over, and the purchases go to chat when the character is made.

**Paying works the way his sheet pays, with two fixes.** Change is made his way, from the price's
own coin and then from higher coins. When his sheet would refuse because the coins are the wrong
kind, the port changes lower coins up ten for one instead. A Baron's child with 275 gp can now buy a
6 pp leather suit, and a peasant with 31 sp can buy a 3 gp sword. His sheet's habit of taking one
coin too many, which could leave a coin below zero, is also fixed. Hemp and silk rope are sold fifty
feet at a time, at the book's price for fifty feet. Creature-hide armour is not sold yet. The fairy
crossbow bolts the shop sells now pair with their fairy crossbows.

**A new world setting, Price level**, under Configure Settings: his seven price columns from Quarter
Low to Triple High, Medium by default. A Game Master in the generator can also set any line's price
level, including Free. Homebrew weapons, armour and gear with a **cost** of their own are sold at that
cost; see `docs/ADDING-CONTENT.md`. A cost must be a whole number and one coin, such as "25 sp". One
the shop cannot read, such as "2 gp 5 sp" or "1.5 gp", is not sold rather than being charged wrongly.
A Game Master opening the Equipment step is told which items those are, and which of his items the
world's compendiums are missing.

**Equip Best Armour** on the character sheet no longer puts barding on a body it was not made for.

**Starting skills take their race and cross-skill modifiers.** A new character's skills now get the
modifiers his sheet lists, not just the dice. A Dwarf's Smithy starts at +20%, a Merfolk's Swimming
at +90%; holding Mathematics gives Accounting +10%, holding Explorer gives Cartography +25%, and a
Famorian's Climbing evoke gives Climb +40%. A class skill counts toward a social skill whatever title
it comes at, as on his sheet: an Assassin, whose Disguise comes at title 2, starts with Acting +15%.
Where his errata corrects his race table (Gaunt Astronomy, Sylph Heavy Drinking and eleven others),
the errata's figure is used. On the generator's Skills step, each social skill shows the race's
modifier. A skill the race may not take is marked BLOCKED, and the step will not continue until it
is unticked. The Review step lists what each skill's bonus is made of. Class skills granted at a
later title get the same modifiers. A race's penalty on a racial skill (a Brok's Tame Animal -10%)
is no longer lost when the character is made.

**Creatures can be built on their own sheet.** A creature's body type is now a dropdown on the Combat
tab. **Edit areas** gives it its own body chart, which you can change area by area (name,
Vital/Limb/Other/Wing, Endurance multiplier), and **Use stock chart** puts the stock one back. New
areas get names of their own, and the sheet warns you when two areas share a name. Skills and
movement modes have Add and Remove buttons, and movement modes can also be moved up and down. A name
you type just before clicking Add is kept. Attacks, Powers, abilities, disabilities and immunities
each have an Add button that creates one and opens it. The gear a creature carries is listed on its
Combat tab, to open or remove. The tame bonus, tendencies, experience note, attack notes and a
description are now on the sheet. A **Modifiers** panel on the Stats tab holds every temporary and
permanent adjustment.

**Creatures hit as hard as their stat blocks say.** Every natural attack except a touch now adds the
creature's Strength damage, its body weight and Weapon Lore's +4. Strength and weight never take
anything away: a weak or light creature does its own dice, as its stat line's "+0" says. A 1,200 lb
buffalo's horns roll 6d6+17, as its stat line prints. The Combat tab shows the figure as **Damage**,
and the attack card lists each part by name. An attack with no damage, blank or "0", does none. A
creature's martial stance and moves now add their damage as well as their to-hit, and a stance's
extra dice count too. A spitting or bolt attack takes the stance's missile bonus. Weapon Lore and
Missile Lore on a creature's skill list now give their +2 to hit.

**Martial attacks count body weight.** A Martial Punch or Kick, by a character or a creature, now adds
the attacker's weight to its damage, as Strength already was: light characters hit a little softer
and heavy ones harder.

**Perception, Affinity and Fortune can be rolled from a creature's header**, with Double Perception.
Shift-click any of them, or a skill's Roll, to add a modifier.

**Hide over the errata's cap is flagged.** The cap is 5 per level. A creature over it shows a
warning, and its Hide stays as you entered it. Creatures now have a **Size**, and Titanic creatures,
plants and magical plants are exempt from the cap. **Jumps are worked out from Agility**, as his
sheet does, with a modifier for each jump.

**Tokens can show a wound bar.** Characters and creatures both offer **Shock** (`body.shockBar`) as a
token resource bar: how far the creature or character is from shock. Pick it in a token's Resources
tab.

**Skill rolls say what your roll achieved, the way the original sheet does.** A skill card now names
one of eight results: Critical Success, Critical Success and made by half, Made by half, Success,
Failure, Critical Failure, Rolled 100 (always a failure below 200%) and Grandmaster (a skill at 200%
or more never needs to roll). It also says plainly whether the roll succeeded. "Made by half" means
rolling at or under half the chance, rounded up. This covers character skills, untrained attempts,
creature skills and the martial arts rolls. When a skill is held twice, a copy made by half now
beats a copy that is merely made. An attribute save of 1% rolled on a 1 now counts as made by half,
as on the original sheet.

**Five race and kit corrections from the author's errata and the books:**
- **Sea and Ice Elves** resist disease at -10% (their -10 was one column off, where it read as a
  speed penalty).
- **Podlings** jog 6 feet a second slower, not 60.
- **Nixies** swim at five times their walk as well as flying.
- **A Gaunt's starting Endurance** is rolled at -1d4, once, when the character is made or the race is
  added, and the roll is shown as Start roll on the character's copy of the race. A Gaunt made before
  this update gets a **Roll -1d4** button beside Endurance. If you had already typed the penalty into
  that race's Start mod, the button asks before rolling, because the two would be added together.
- **With Gear by culture,** social class 5 and 12-13 get their own kits instead of the next band's.
  For example, a social-5 Troll now gets a club and a stone or obsidian knife.

Each correction is printed every time the content is built, so the author can see it and undo it.
To pick these up in an existing world, run `game.imagine.importContent()`. A character made before
this update keeps its old copy of its race: to update it, remove the race from the character and add
it again (remove it first, because adding a second race makes a half race). For a half race, remove
both races and add them back in their original order.

**Spells now last a number of days.** A memorized spell stays in mind for 30 days less its level, and the Magic & Lore tab shows the days left. **Sleep** takes a day from every spell and refills the Aura pool. A spell out of days is marked *forgotten* and can't be cast until its **Mem** button rolls the casting skill to refresh it (Shift-click adds a modifier). Starting spells now arrive memorized, with their days. Unticking a spell's Memorized clears its days, and unticking an invocation clears its uses, as on the Roll20 sheet. Spells your characters already have memorized keep working.

**Drain** takes a chosen amount of Aura from the pool (a skill, an item, a spell cast at the table). A spell whose range is Self now opens its Cast dialog on the caster.

**Magical mishaps can be applied from the card.** An Aura or Will loss or gain, a Burnout, or a Wild Wish's Aura loss gets an **Apply** button. Each can be pressed once, by the Game Master or whoever cast the spell. Aura and Will changes go onto the attribute's permanent modifier, where they can be seen and undone.

**Wilders no longer gain Spell Lore's +2 Aura Control,** as on the Roll20 sheet.

**Finer magic switches.** Content Availability now has 21 magic switches: Ballads, Hymns, Poems and Songs are separate switches, and so are Herbs, Potions and Elixirs. A campaign that had switched off Bardic Magic or Herbalism keeps those kinds off.

The skills that learn or use a kind now follow that kind's switch too, as well as Arcane or Divine Magic. Switching off Songs now also hides Sing and Song Lore, and switching off Arcane Magic still hides them. **If your campaign had Runes, Glyphs, Rituals, Evocation, Candle Lore, Bardic Magic or Herbalism switched off,** the matching skills (Rune Lore, Glyph, Ritual Lore, Evoke, Candle Lore, Intone, Sing, Potion Lore and the like) are now unavailable as well. They are flagged on characters who hold them, not removed.

The Powers, Magic Item Empowering and Divine Item Empowering switches now reach power items. An Arch Mortal's invulnerability is a benefit of the title rather than a power, and no switch touches it.

**Double-clicks are harmless.** Pressing Cast, Invoke, Pray, Mem, Sleep, Drain, Reset or Regenerate twice in quick succession now counts as one press.

## 0.19.3 — 2026-09-23

**A bug sweep.** The whole system was read through for faults, and 36 were fixed. The ones you are
most likely to have met:

- **Editing a weapon, equipment or skill no longer doubles its sourcebook** ("Custom" becoming
  "Custom,Custom" on every change, which then escaped its book's on/off switch). Items already
  doubled read back as they were typed, with nothing to do.
- **A Formless keeps the host you choose** in the character generator. Before, the host was wiped on
  the next click and every Formless came out a bare psyche.
- **Winged and wingless Fairies, Podlings, Sporelings, Dark Fairies and the Brachara get their
  starting kit and clothing** when "Gear by culture" or "Clothing by status" is ticked. They got none.
- **Several tokens of one creature each spend their own seconds.** Three Goblins made from one actor
  all charged the first Goblin's clock, and shared one Situation Mods window.
- **Portraits can be changed** by clicking them, on every sheet.
- **The weapon sheet's Kind field works** (Blade, Axe…). It showed blank and kept nothing.
- **Damage from a card is applied by whoever made the attack, or by the Game Master**, so it can no
  longer go on twice. A player applying the Game Master's blow to their own character is now asked to
  leave it to the Game Master.
- **Only the Game Master begins the next round**, going back a round and forward again keeps
  everyone's seconds, and seconds are spent only once the combat has begun (surprise excepted).
- **Level-up rolls a half race's Endurance from both races**, as it should, and a Formless from its
  psyche.

Also: a thrust with a throwable weapon no longer takes the two/three-missile penalty; a Gravity rune
below zero keeps its level; a Scissor Strike has one Spend button, not two; a weapon whose damage is
"Varies" posts its card instead of failing; a lance or garrote's card says "special timing"; Equip
Best Armour leaves the stash and the mount alone; the martial stance is no longer cleared by editing
something else while Martial Knowledge is not usable; a class's title can't be stepped below 1; blind
fighting's bonus reaches Second Weapon Knowledge's off-hand figures; the same spell can't be added
twice; brewing a poison recipe that names no poison says so; and `game.imagine.clearItems()` removes
only what `populateItems()` made, never a folder of your own.

**Natural touch attacks roll as touches.** A Brok's Harm Touch, a Mephyt's Heat or Cold Skin, a
Centaur's Trample and a Sha'Cora's Chafing Skin roll a d20 plus the Agility modifier, needing 10 to
make contact, and on contact roll their own dice. Run `game.imagine.importContent()` for the weapons
compendium to learn this, then delete and re-add those weapons on characters who already have them.

**Add natural weapons** is a button on the Equipment tab when the race gives natural weapons the
character does not have. **Learn a combination** sits under each multiple-missile list on the Combat
tab: it rolls the skill, and a success adds the launcher and missile. **A creature's attacks, powers
and traits** can now be opened and removed from its sheet.

If you filled the Items directory before this version, clearing it and filling it again
(`game.imagine.clearItems()`, then `game.imagine.populateItems()`) puts the "Rigid/Flexible" armour
and crossover classes in single folders.

## 0.19.2 — 2026-09-23

**Characters the generator never made can roll their starting money on the sheet.** Reported on
0.19.1: only the Create Character window rolled money, so a character made before 0.19, or made
blank with Foundry's own Create Actor button, still had none. The Equipment tab now has a **Roll
starting money** button, shown only while the purse is completely empty. It rolls exactly as the
generator does, from the character's Social Class and first-day Fortune, and posts the roll to chat.
A player gets one roll; the Game Master can roll again for any empty purse. Characters made in the
generator never see it.

**His money panel is on the Equipment tab.** Wealth (in Gold), the four coins, gems, jewelry and
special, with his Update Coins, Update Gems and Update Jewelry/Other rows: pick, enter a number (and a
value each), then Add or Subtract. Each change goes to chat in his words, and you cannot take more
than the character has. Wealth in gold is his own sum: platinum x10, gold, silver /10, copper /100,
plus every gem and jewelry line at count x value. The Description tab still edits the same fields.

**Perception, Affinity and Fortune have roll buttons** in the sheet header, like Endurance.

## 0.19.1 — 2026-09-23

**Perception, Affinity and Fortune are no longer short.** They now take his per-title bonus (+1
Perception, +2 Affinity, +1 Fortune for every title, the first included) and a class's "+5%"
modifier, as does Endurance's "+5 Endurance". A new Mage's Fortune goes up by 6. Nothing to do: every
character, old or new, is corrected the next time its sheet opens.

## 0.19.0 — 2026-09-23

**New characters start with money.** The character generator rolls it by itself when you reach
Details, from the Social Class, as his sheet does: a Fortune roll for anyone below Noble that can
double their money or better, and a Noble's family paid the book's x5 or x10. The coins fill the four
fields, a line under them says how the roll went, and the roll goes to chat. There is no re-roll
button, the same as handedness. If you go back and change the Social Class or the attributes behind
Fortune, it rolls again. The Game Master can still change the fields. Ticking "Gear by culture" now
really takes the gear instead of the coins, and unticking it brings the coins back. Races his sheet
gives wilderness gear by default (a Barbaric Human, a Troll…) say so, and the small folk are told
their coins are gem wafers.

**Races with natural weapons now have them on the sheet.** A Saurian starts with Saurian Claws,
Saurian Bite and Saurian Tail Slap in its Weapons section, equipped and rolled like any other weapon.
There are 95 of them across 48 races, taken from his sheet. They arrive with the race, in the
character generator or when a race is dropped on a character. Delete any you don't want and they
stay deleted. For a character made before this, re-import the content, then run
`game.imagine.grantNaturalWeapons(actor)` in the console. Touch attacks (Brok, the Mephyts) still
need the 10-or-better touch roll made at the table.

## 0.18.2 — 2026-09-23

Found at a real table on 0.18.1.

**The character generator no longer gets stuck on Details.** With "Gear by culture" ticked, Next
did nothing: the Review page failed to draw, and the console showed "Cannot read properties of
undefined (reading 'armorClothing')". It hit most races, any whose culture kit offers a choice of
gear at the character's social class. The Review page now draws and lists the same kit the Details
page previewed. Which of the kits on offer the character actually gets is still rolled when it is
created, as before. If you unticked "Gear by culture" to get past it, you can tick it again.

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
