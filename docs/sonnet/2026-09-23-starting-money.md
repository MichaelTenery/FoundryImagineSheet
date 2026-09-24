# Starting money: what the pass left for a cheaper window

The rule itself is built: `module/starting-money.mjs`, wired through `module/chargen-view.mjs`
(@MARKER STARTING MONEY) and `module/apps/character-generator.mjs`. See `docs/DECISIONS.md`,
"Starting money is rolled, on the user's three rulings (2026-09-23)". Nothing below needs a rules
judgement. Every rules question it touches has already been ruled on.

**Already decided, do not re-open:**
- The Fortune roll is made at or under Fortune (UPSTREAM 40, the user's ruling). His literal reading
  sits beside it as a comment in `checkStartingFortune`. Leave both lines.
- Nobles (15-20) get the book's x5/x10 (UPSTREAM 67). The `times` column in `STARTING_MONEY`.
- The Fortune is his whole `changeCharacteristics` Fortune, race and class and first title
  (UPSTREAM 68). `getStartingFortune`.
- It rolls by itself on the Details step and there is no re-roll button, deliberately, the same as
  handedness. Do not add one.
- Gear by culture replaces the coins entirely. It does not add to them.

## 1. Release it

**What to do.** Bump `system.json` to the next patch version, add a `CHANGELOG.md` entry in the voice
of the 0.18.2 one ("**New characters start with money.** …": rolled by itself on Details, the one-line
account and the chat card, Gear by culture takes their place, a Game Master can still edit the four
fields), and run `python tools/build_system.py` to rebuild `dist/`.

**Wait for the natural-weapons session's work to be committed first.** It had uncommitted changes to
`module/chargen-rules.mjs` and others in the same working tree when this pass ended, and
`build_system.py` copies the working tree. Building now would ship half of that work.

**Done looks like.** `dist/imagine-rpg/module/starting-money.mjs` exists, the build's self-check
passes (it compares `tools/syntax-check.html`'s list against `module/`; `starting-money.mjs` is already
listed), and the changelog entry names the version.

## 2. Say which races his sheet gives gear instead of coins

**What to do.** His `setMoneyEquipmentByRace` (sheet-worker.js:73467) gives most races coins, and gives
a few wilderness gear by default: Chetahl, Dwarf(Mountain), Gnome, Goblin(Forest), Goblin(Mountain),
Goblin(Mountain:Magic), Human(Barbaric), Ogre, Ogre(Magic), Saurian, Troll, Troll(Ice), Troll(Rock).
The book agrees for Barbaric Human, Mountain Dwarf and Ogre (Player's Guide step 10). On this port Gear
by culture stays OFF by default for everyone (DECISIONS 2026-09-20, "The three optional starting-kit
rules"). Don't change that default. Add a one-line hint under the Money heading on the Details step,
for these races only: "His sheet gives a <race> wilderness gear instead of coins: tick Gear by culture
below to take it." Put the race list in `module/starting-money.mjs` as an exported constant with a
column comment citing 73467. It can be written by hand: thirteen names, read straight off the switch.

His Brownie, Fairy, Fairy(Dark), Gnome, Nixie, Podling and Sporeling cases also set
`tmp_special_coins`: "Due to their small size, this race uses fairy-sized `coins` that are small gem
wafers of the same value as standard coins." Show that sentence under the Money heading for those
races too, from a second constant beside the first.

**Done looks like.** Both hints appear in `tools/chargen-preview.html` for a Human(Barbaric) and a
Nixie and nowhere for a Human(Civilized:Village). Two checks in `tools/starting-money-test.html`
cover the two lists.

## 3. The character sheet's own Fortune (and Perception, Affinity) is short

**Not a money task, found in passing,** and offered to the user as its own chip. His
`changeCharacteristics` (30279-30348) adds a title bonus (+1 Perception, +2 Affinity, +1 Fortune per
title, including the first, set at 8155-8158 and raised at 94802) and the class's "+5% Perception",
"+5% Affinity", "+5% Fortune" and "+5 Endurance". On this port `characteristics.*.titleBonus` is only
ever written for Endurance (`module/advancement.mjs`, `commitTitle`), and the Active Effects that
`module/data/item-class.mjs` @MARKER CLASS BONUSES says carry `classMods` were never created. So the
sheet's Fortune for a title-1 Mage is 6 below his. This needs deciding how, and is NOT mechanical:
whether to write `titleBonus` at creation and on each title, or derive it from `identity.title`. Leave it
to a pass that is given it.
