# Layer 0 — Data Model Design

Design pass, 2026-09-10. **Revised** the same day after discovering the sheet's embedded JavaScript (see `DECISIONS.md` → "CORRECTION: the Roll20 sheet does contain JavaScript").

**Status, 2026-09-12: implemented, and superseded in places.** The character schema is built as `module/data/actor-character.mjs` and the creature schema as `module/data/actor-creature.mjs` — the latter answering §10 question 3, which this doc had parked on the Bestiary book. Where this document and the shipped code disagree, **the code wins**: it was written against his sheet-worker line by line, and this was a design pass written before that reading was finished. Two places where they had drifted are corrected below (§9 step 2, §10). Read this for the *reasoning*; read the code for the rule.

## 0. Sources, in priority order

1. **`docs/reference/sheet-worker.js`** — 180,370 lines extracted from the Roll20 sheet's `<script type="text/worker">` block. Dev-authored, played-with computation code and ~37 data dictionaries. **Primary source.** Where this disagrees with the books, it wins (it *is* the Roll20 sheet, per the standing conflict rule).
2. The Roll20 HTML markup — field names and sheet layout.
3. `docs/reference/players-guide-fulltext.txt`, `masters-manual-fulltext.txt` — OCR'd rulebooks. Prose, rationale, and coverage for anything the JS doesn't implement.

Formulas independently reconstructed from the books *before* the JS was found have since been spot-checked against it and matched (attribute save, Endurance). That's reassuring for book-derived work, but the JS is authoritative from here.

---

## 1. What the source audit found

### The HTML is mostly workaround scaffolding
Field counts per tab, raw vs. normalized (collapsing index numbers):

| Tab | Lines | Raw fields | Real concepts | Inflation |
|---|---|---|---|---|
| profile | 418 | 160 | 138 | 1.2× |
| skills | 7,514 | 579 | **28** | 20.7× |
| combat | 9,428 | 1,040 | 353 | 2.9× |
| equipment | 2,624 | 175 | 175 | 1.0× |
| creature | 32,385 | 2,329 | 1,455 | 1.6× |

Roll20 cannot render a variable-length list declaratively, so the sheet hardcodes a separate hidden block for "1 racial skill", "2 racial skills", … "20 racial skills" and reveals the matching one. Equipment does the same via ~70 catalog dropdowns. **Neither pattern ports** — lists become embedded Items, catalogs become compendiums.

### The JavaScript is the real system
~37 data dictionaries, all sharing one shape:

```js
const <name> = {
  "Key Name": [ "col0", "col1", ... ],   // column meanings in a header comment
};
```

Machine-consistent: `skilldict` parses to 470/470 rows at exactly 10 columns; `socialskilldict` to 204/204 at exactly 8. No ragged rows.

Notable contents: `skilldict` (470 class/racial skills), six social-skill dictionaries (~204 each), `weaponvalueslist` (~596), `armorvalueslist` (~721, per-body-location), five further armor dictionaries (cost, penalty, condition, blocking, damage-type, materials), `classtitledict`, `goalupdict`, eight martial-arts dictionaries, `handtohandvalueslist`, `brawlingvalueslist`, `fatiguelist`, `racefertiledict`, and magic-phase content already present: `rituallist` (~389), `evokedict` (~1,173), `spellPrimers`.

### Sourcebook tagging already exists in the data
Every skill row carries its book and page. Distribution across 674 skills:

| Book | Skills | PDF in hand? |
|---|---|---|
| Player's Guide | 343 | yes |
| Mysteries of the Planes | 115 | yes *(extracted since this pass)* |
| Conquest of the Eternal | 80 | no |
| Master's Manual | 77 | yes |
| Legends of the Unknown | 31 | no |
| Epitaph of the Fallen | 24 | no |

~20% of skills come from books we don't have — but **their mechanical data is already in the JS**, so those PDFs are needed only for prose and edge-case rules, not to implement the skills.

The proposed `sourcebook` field is therefore not an invention imposed on the data; it is the data's native structure.

### Skill types map onto the magic toggle
`skilldict` column 5 is a comma-separated type list: Magical 200, Divine 149, Combat 41, Disciplined 33, Informational 28, Stealth/Intrusive 25. "All magic off" filters on Magical + Divine — **~74% of all class/racial skills**. That switch is far more consequential than a cosmetic tab hide.

---

## 2. Document types

**Actors:** `character`, `creature`

**Items (core scope):** `skill`, `race`, `class`, `weapon`, `armor` (with `layerType`), `equipment`

**Deferred (magic phase):** `spell`, `invocation`, `power`, `ritual`, `evoke`, and the remaining crafting/lore subsystems — all of which have source data already sitting in the JS.

## 3. Character actor schema

```
system:
  identity:
    # CORRECTED 2026-09-19: race and class are NOT UUID fields. They are embedded Items,
    # found during data preparation, because resolving a UUID synchronously while preparing
    # data is unreliable for compendium content that has not loaded yet. Dragging the item
    # onto the sheet is what sets them. A character may hold TWO races (a Half Race) and more
    # than one class (dual classing), so the model carries raceItems/classItems as lists and
    # raceItem/classItem as the first of each.
    title         number
    goal, exp     number
    alignment, tendencies, gender  string

    # the level-up queue, his titles_to_raise / goals_to_raise (2026-09-19)
    titlesToRaise, goalsToRaise    number   # >0 means a level-up is outstanding
    titleToLevel, goalToLevel      number   # which step is next
    attributeIncreases             number   # career total, for his floor at goals 12/27/42
    archSpecialMet                 bool     # the one Arch Mortal requirement only a GM can judge
    formlessBodies                 string   # stopgap: free-text record of a Formless's bodies, until switching is built

    # DERIVED, none of it stored:
    #   raceName, raceType, isHalfRace, raceWarning, race{skills,abilities,...}, raceIssues
    #   className, classType, classNames, titleName, classes[], isDualClass, isNonClassed
    #   classSlotsNeeded, dualClassIssues, cannotCast
    #   classProgression[]  per class: { rows[] (title, reached, skills), owed[] }
    #   classSkillsOwed     count of earned-but-not-held class skills
    #   classUsage[]        each class's armour and weapon usage, shown never enforced
    #   nextGoalExp, expCap, levelUpPending, goalAttributes[]
    #   combat.chosenAttackSkill  a GME picks its attack chart outright, having no class to earn it
    #   archMortal { qualified, rows[] }, archQualified

  attributes:                       # str agl vit int wis knw app chm soc aur pty wil
    <attr>: { rating: number, permMod: number, tempMod: number }
    # DERIVED: max, save, and each attribute's table-driven modifiers

  characteristics:
    endurance:  { titleBonus, raceMod, permMod, tempMod }   # base DERIVED
    perception: { titleBonus, raceMod, permMod, tempMod }
    affinity:   { titleBonus, raceMod, permMod, tempMod }
    fortune:    { titleBonus, raceMod, permMod, tempMod }

  resistances:                      # magic illusion control poison disease
    <res>: { misc: number }         # base DERIVED from attributes + race

  body:
    bodyType    string              # "Humanoid", "Humanoid(Fish Tail)", ...
    shock       number  (derived: endurance x 3)
    areas       [ { key, name, type, number,
                    enduranceMax (derived: endurance x race chart multiplier),
                    damage, effect,
                    layers: { armor[], clothing[], shield[] } } ]

  movement:   walk/jog/run/special: { hourly, tenSec, oneSec }
              travelHours, restHours, jumpStand, jumpUp

  physical:   heightFeet, heightInches, frame, weight, hair, bodyCovering,
              eyes, skin, handedness, age, apparentAge, maxAge

    # ADDED 2026-09-22 (Famorian). Empty except for a character of that race. breed and the
    # three attribute bonuses are ROLLED ONCE, at generation, and kept -- not re-derived, the
    # same reason permMod/tempMod are stored rather than recalculated. evokesAllowed is -1 for
    # his "All" (a True Breed's uncapped budget), 0 only before the first roll has landed.
    # WATCH THIS PATH if it is ever renamed: module/data/actor-character.mjs reads it as
    # this.physical.famorian, not this.identity.famorian -- the two were confused for one work
    # session (2026-09-21 to 2026-09-22) and the evokes were silently never applied at all; see
    # DECISIONS.md 2026-09-22.
    famorian: { breed: string, animalType: string, evokesAllowed: number,
                evokes: [string], strBonus, aglBonus, vitBonus: number }

  languages:  [ { name, speak: bool, write: bool } ]
  wealth:     { copper, silver, gold, platinum, special, gems[], jewelry[] }
  skillSlots: { class, racial, social, memorization }   # derived from Knowledge
  combat:     mods: { melee, missile, damage, defense, initiative, skill: { misc } }
```

### Body areas are dynamic and race-owned
The JS builds the body from the race (`buildCharacterBody(race)`) into a repeating section, supports authoring **custom body areas** (`new_bodyarea_name/_type/_end`), and `body_transform_selection` swaps `body_type` wholesale — the fish-tail transform being a worked example.

So `areas[]` stays a dynamic array, **not** a fixed humanoid slot list. `armorvalueslist`'s 19 fixed columns (Head, Neck, L/R Shoulder, Upper/Mid/Lower Torso, L/R Arm, L/R Forearm, L/R Hand, L/R Thigh, L/R Shin, L/R Foot) are the *humanoid coverage mapping* for armor, not the definition of a body. Non-humanoid bodies get their own charts and their own armor (`armor_centaur_barding_select`). Transformation is therefore a data swap, not a schema migration — the free option, taken.

## 4. Skill Item schema

Columns come straight from `skilldict`:

```
skill Item system:
  attr1, attr2     string        # governing attributes; both present = averaged, round up
  skillRating      number        # difficulty number
  startingDice     string        # "2d6%", "1d10%", "4d10%" - rolled on acquisition
  time             string        # "10 Seconds", "Varies", "1 Hour"
  types            [string]      # Magical | Divine | Combat | Disciplined | Informational | Stealth/Intrusive
  learn            string        # learn cost/time, often empty
  sourcebook       string        # "Player`s Guide", "Mysteries of the Planes", ...
  page             string
  description      string
  # per-character instance state:
  category         "class" | "racial" | "social"
  startingBonus    number        # rolled; racial skills roll x2
  abilityBonus     number
  misc             number
  acquiredAtTitle  number        # the class title it arrives at; 0 for racial and social
  isRestricted     bool          # cannot be attempted untrained. Read from the books' "Restricted: Yes/No"
                                 # for class/racial skills (366 found); social skills have no such field
  # DERIVED: combinedAttributes, baseChance, totalChance,
  #          usableByTitle + titleGateReason (his "cannot be used before <name> title")
```

Derived: `baseChance = (combinedAttributes - skillRating) x 5`, `total = baseChance + startingBonus + abilityBonus + misc`. Untrained common-skill use = base chance only, which is why the sheet's `common_skill_#` fields carry only name and base.

Class-skill Title progression belongs on the **class** Item (the sheet's `class_skill_#_#` double index is `[title][slot]`), not on the skill.

## 4b. Race Item schema

The whole schema is in `module/data/item-race.mjs`. A character may hold TWO race items, which the
port combines into his Half Race (`module/race-rules.mjs`); the combined figures are derived, and
nothing here is written back to either race.

```
race Item system:
  attributeMods    { str..wil: number }   # added to the character's rating, folded into the base
  attributeLimits  { str..wil: number }   # the highest rating a member may reach -- what
                                          # getAttributeMax reads, and load-bearing.
                                          # Title 11 discards it: 25 ordinary, 27 magical.
  endurance:
    startFormula, startMod                # Endurance at creation
    titleFormula, titleDice, titleMax, titleMod
                                          # what a title advance brings. Rolled below 11th; its
                                          # MAXIMUM at 11-12; x2, x3, x4 at 13, 14, 15.
                                          # One race writes a plain number here: Elf(Silver)'s "1".
  characteristicMods  { perception, affinity, fortune }
  resistanceMods      { magic, illusion, control, poison, disease }
  movement          walk/jog/run modifiers, speed multiplier, and a special rate with its own
                    kind and base -- these are MODIFIERS on a rate drawn from Agility, not
                    finished rates (the bug that made every race read as unable to move)
  bodyType          string                # which of the 45 body charts the character is built from

  racialSkills      [ { name, bonus } ]   # the skills a member may choose, with his bonus on each
  racialSkillNote   string                # Changeling's says its skills depend on the form worn:
                                          # his changelingRaceSkillDetailValues holds 41 lists
  abilities, disabilities, immunities  [string]
                                          # listed and shown; the MECHANICS of them (infravision,
                                          # hide values) are not ported -- see the board
  ages              { startLow, startHigh, maxAge }   # maxAge becomes "Immortal" at 11th title
  fertileWith       [string]              # which races this one can have children with; the list
                                          # his Half Race picker offers

  # ADDED 2026-09-21, when the races his sheet splits with a second dropdown became documents
  # of their own -- see DECISIONS.md "The races he split with a second dropdown..." and
  # "Formless is built...".
  sourceRace        string    # HIS name for this race -- what raceSkillDetailValues, raceAges,
                              # the colour tables, and getRaceHeightType/getRaceFrameType are
                              # keyed under. A split form's own name (Fairy(Winged)) is the
                              # port's; every OTHER race is its own sourceRace.
  physiqueLock      string    # "", "slight" or "ordinary". A winged faerie form is always of
                              # slight physique and a wingless one never is -- the wings ARE the
                              # slight-physique branch in his code -- so the generator does not
                              # offer the tick where this is set. Empty for every other race.
  formlessHosts     [string]  # which races a Formless may inhabit (Formless only, 110 of them).
                              # His formlessStartingRaceDetails plus the four faerie hosts his
                              # guard names separately, expanded through the same split every
                              # other race-name list goes through.

  # ADDED 2026-09-22, the last unbuilt race -- see DECISIONS.md "Famorian is built...".
  # Famorian only; isFamorian is false (and the rest empty) for every other race.
  famorian:
    isFamorian  bool
    breeds      [ { breed, low, high, evokes, when } ]  # his d100 table: which band, what it
                                                         # allows (a dice expression or "All"),
                                                         # and whether the evokes are always on
    evokes      [ { key, label, detail } ]   # the ~120-entry catalogue; key is his own checkbox
                                             # name, which is what a character's physical.famorian
                                             # stores. Only 15 keys change a number -- see
                                             # module/famorian-rules.mjs FAMORIAN_NUMERIC_EVOKES.
```

## 4a. Class Item schema — the parts the later passes added

The whole schema is in `module/data/item-class.mjs`, field by field with a comment on each. What
is worth naming here is what arrived after this document was first written:

```
class Item system:
  advancement:
    titles           [string]    # the title names, index 0 = Title 1
    classSkills      [string]    # per-title skill TEXT, only for hand-authored classes
    classSkillList   [ { title, name, core, requires } ]
                                 # his setClassSkillLists, all 92 classes: the skill a title
                                 # brings, whether it is a core skill (+30%), and whether it is
                                 # only for a race that can cast ("caster") or cannot ("nonCaster")
    goalAttr1, goalAttr2  string # the two attributes a goal advance may raise (his goalupdict)

  baseClass, path    string      # a class with a choice is one document per path;
                                 # "Elementalist" + "Call of Death". An availability override on
                                 # the base class reaches every path (module/availability.mjs).
  nonClassed         bool        # his GME: 0 title, no class skills, attack chart picked outright
  blockedRaces       [string]    # races that may NOT take this class; empty means any
  armorUsage, weaponUsage  string  # shown on the sheet, never enforced -- his sheet does neither

  archMortal:                    # what is needed to pass 10th title (his archmortalqualifylist)
    attributes  { str..wil: string }   # "" none, "RM" the racial maximum, n a rating,
                                       # -n the racial maximum less n, floored at 0
    skills      [ { name, chance } ]   # five core skills, each at a minimum chance
    special     string                 # a sentence only a Game Master can judge; "" if none

  # per-character state:
  title              number      # 0 means "follow the character's own title"
```

## 4c. The resistance roll

Added 2026-09-21, when Daryl's 0.11.1 Blocker report showed the Attributes tab offering the five
resistance figures (Magic, Illusion, Control, Poison, Disease) with no way to roll any of them.
The rule lives in `module/resistance-rules.mjs`, Foundry-free so it can be exercised outside it;
what follows is the shape, not a restatement of the code, which the comment above each function
already carries in full — read that for the "why", this table is for "where does it sit".

**His branch order**, kept exactly, and the same for all five tracks (his `handleMagicResist` and
four identical handlers, sheet-worker.js:1231 onward):

1. **Immune** — the track is immune; nothing is rolled and nothing is said to have been resisted,
   only that the effect had no effect.
2. **200% or more** — his "virtually immune"; resisted without consulting the roll at all.
3. **A natural 1** — an automatic success. **This is the one departure from his sheet**: none of
   his five handlers special-case a roll of 1. It is the convention every other percentile check in
   the port follows, and Daryl's bug report asked for it. It only changes the answer at a 0%
   chance, which is the one case where a natural 1 is not already a success by arithmetic.
   Flagged for his confirmation as `UPSTREAM-ISSUES.md` item 48.
4. **A natural 100** — an automatic failure.
5. **Otherwise**, his three-way comparison against the chance and its half: over the chance fails,
   over the half succeeds in full, at or under the half succeeds by half.

**His half rounds UP, not down.** `halfResistance` is `Math.floor((chance + 1) / 2)` — at 51% the
half is 26, not 25. This is `parseInt((chance + 1) / 2)` in his handlers, kept as written. It
**disagrees with the attribute save's half** in the same codebase
(`#onRollAttributeSave` in both actor sheets, `Math.floor(chance / 2)`, a plain floor) — both are
his, from different parts of his file, and the port keeps both as written rather than making them
agree. If they are meant to be one rule, that is his call, tracked in `UPSTREAM-ISSUES.md` item 48.

**Outcomes**, `RESIST_OUTCOMES`, in his own words so a chat card reads the way his sheet does:
`"Resisted by half"`, `"Resisted"`, `"Did not resist"` — plus `"Immune"`, which is not in that
table because it is said differently (`describeResistanceRoll`).

**One more repair, not a rule change.** His handlers read the chance out of `getAttrs`, which hands
back a STRING, then add the modifier with `+` — so `"50" + 0` is the string `"500"`, not the number
50. Every two-digit resistance therefore reads over 199 and reports "virtually immune" regardless
of the roll, and a one-digit one is silently multiplied by ten. `resolveResistanceRoll` parses the
chance to a number before adding the modifier, on the same footing as `lesserAge` and the Monk
column repair elsewhere in the port — it does what he evidently meant, and the slip is reported
rather than silently fixed: `UPSTREAM-ISSUES.md` item 48.

`resolveResistanceRoll(tmpChance, tmpRoll, tmpIsImmune, tmpModifier)` returns everything a chat
card needs — `chance`, `half`, `roll`, `modifier`, `resisted` (bool), `byHalf` (bool), `outcome`,
`reason` — and `describeResistanceRoll` turns that into the one line the chat card shows, shared by
the character and creature sheets so they say it the same way.

## 5. Content extraction pipeline

**Decision: parse the dictionaries mechanically; do not hand-port.**

There are roughly 7,000+ data rows across the 37 dictionaries. Hand-transcription of that volume guarantees silent errors that surface later as wrong game math, and the alternative source (OCR'd scans) is strictly worse than dev-authored JS. The dictionaries' uniform `"Key": [array]` shape and verified column consistency make parsing reliable.

Shape:
```
tools/extract/                 # build-time only, not shipped to Foundry
  parse-dictionaries.mjs       # generic: JS object literal -> JSON
  column-maps.mjs              # per-dictionary column -> field-name mapping
src/packs/                     # generated JSON, checked in and reviewable in diffs
  skills.json, weapons.json, armor.json, ...
packs/                         # compiled Foundry compendium output
```

Generated JSON is **checked in**, so regenerating produces a reviewable diff rather than an opaque binary change. Extraction is idempotent and re-runnable if the dev ships an updated sheet.

**Run extraction across all 37 dictionaries at once, including magic.** The parser cost is essentially identical for 10 dictionaries or 37; only the column maps differ. This decouples *having the content* from *implementing the mechanics*, so magic data sits ready in compendiums whenever that phase starts. It does not change core-first phasing for mechanics.

## 6. Content / sourcebook availability layer

Every content Item carries `sourcebook`. World settings:

```
imagine-rpg.sourcebooks      { "players-guide": true, "masters-manual": true, ... }
imagine-rpg.magicEnabled     bool
imagine-rpg.magicSubsystems  { runes: true, potions: false, ... }
imagine-rpg.contentOverrides { "<uuid>": false }
```

One resolver serves every toggle requirement:
```
isAvailable(item):
    if item carries a magic/divine type or belongs to a magic subsystem:
        if not magicEnabled: return false
        if item.subsystem and not magicSubsystems[item.subsystem]: return false
    if item.uuid in contentOverrides: return contentOverrides[item.uuid]
    return sourcebooks[item.system.sourcebook] ?? true
```

**Open policy question:** should disabling a sourcebook also remove *core math* it contributes (e.g. the Master's Manual's extended attribute rows 0-4 / 21-30), or only gate *content availability*? Recommendation: gate content only. Silently breaking the math when an attribute lands at 25 is worse than leaving unreachable table rows in place.

## 7. Armor layering

Rules (Player's Guide ~p.190) confirmed against the dev's data:
- Up to **3 armor layers**; the 1st must be flexible
- Each layer may only sit over material at least as flexible as itself; **rigid may not stack on rigid**
- **Shields are a 4th layer**; certain other objects also qualify
- **Clothing ≤3 armor value doesn't consume a layer** (grants one free layer above or below)
- Layers accrue wear independently; donning times are cumulative per layer

`armorvalueslist` column 1 is the flexibility class, and it includes **`Clothing` as a distinct class** alongside Flexible / Semi-Flexible / Rigid — four values, matching the dev's note that clothing and shields are discrete layers. Armor items therefore carry `flexibility` plus per-location coverage values, and the layering engine validates stacking order while walking each body area's stack.

## 8. Modifiers: ActiveEffects, with one escape hatch

The sheet hand-decomposes every modifier by source (`combat_mod_melee_str` + `combat_mod_melee_other`, `combat_mod_init_agl` + `_int` + `_other`) because Roll20 has no effect system. Foundry replaces this natively: race/class/magic/condition grants become **ActiveEffects**; one stored `misc` field per modifiable stat remains as the GM escape hatch, which is what `_other` was.

V14 specifics: effect changes live at `effect.system.changes` with `type` taking lowercase strings (`"add"`, `"override"`, `"multiply"`); custom Actor subclasses **must** call `super.prepareBaseData()` or two-phase effect application breaks silently.

## 9. Derivation order

Acyclic; order matters:

1. Attribute ratings (base + effects)
2. Attribute `max` ← **the race's limit for that attribute**, 20 before a race is chosen, and 25 from title 11 (`getAttributeMax(title, raceLimit)`); beside it, `magicalMax` ← 23 / 25 / 27 by title (`getMagicalAttributeMax(title)`), derived but not yet clamping anything
   > **Corrected again 2026-09-18.** The "flat 27" below was right about his code but wrong about his intent: on 2026-09-16 he confirmed 25 is the ordinary cap and 27 the magical one, and his own `setMagicalAttributeMaximums` (sheet-worker.js:123007) turned out to carry the title tiers after all. See `DECISIONS.md` 2026-09-17.
   > **Corrected 2026-09-12.** This step originally read "Title/being-type table (Title 0→23, 1-10→25, 11-15→27, 16+→30)", taken from the Master's Manual. Nothing in his sheet implements those tiers: every `*_max` assignment was checked, there is no deity handler at title 16, and the only caps that exist are the per-race limits (sheet-worker.js:8099) and the flat arch-mortal 27 (`setArchMortalAttributesMax`, line 27549). The sheet wins on conflict, so the tiers are gone and `IMAGINE.attributeCaps` with them. See `DECISIONS.md` → "CORRECTION: a character's attribute maximum follows his sheet", and `UPSTREAM-ISSUES.md` item 16 for his comment/code disagreement at the call site.
3. Attribute saves ← `getAttribSave`: `<18 → rating x5`; `18-20 → 90`; `>20 → 90 + (rating-20)`
4. Attribute-derived modifiers ← lookup tables
5. **Endurance** ← `((STR+AGL+VIT)/3)` rounded up, + class modifier + title bonus + race mod + temp/perm mods
6. **Shock** ← Endurance × 3
7. **Body area maxima** ← Endurance × race chart multiplier (recomputes on any Endurance change)
8. Resistances ← attribute modifiers + race
9. Skill slots ← Knowledge table
10. Skill base chances ← governing attributes − skill rating, ×5
11. Skill totals ← base + starting + ability + misc
12. Encumbrance ← carried weight vs. STR load limit. Each weapon, armour and equipment item
    has a `quality` (`""`/Shoddy/Poor/Good/High/Master) that scales its weight, applied only when its
    `magicBonus` is 0 -- a magic plus replaces it, never stacks (his `getItemWeight`,
    sheet-worker.js:81979-81990; `QUALITY_WEIGHT_MULTIPLIERS` in combat-rules.mjs)
13. Movement ← race base − encumbrance penalties
14. Combat modifiers ← attribute modifiers + effects + misc

Steps 3 and 5 are transcribed from the dev's `getAttribSave` and `changeCharacteristics` respectively, not inferred.

## 10. Open questions

*Status reviewed 2026-09-12. One of the six is still genuinely open.*

1. ~~**Sourcebook gating policy** — content-only, or core math too?~~ **RESOLVED: content only**, as recommended, and question 5 moots the hard case anyway — his attribute tables are already flattened, so no sourcebook contributes a detachable row of core math. Built as `module/availability.mjs`; see Epic 1 on the board.
2. **Is `sheet-worker.js` current?** — **STILL OPEN, and the only one.** The dev described `getArmorCombatValues` from memory rather than sending it. Worth confirming this file reflects his intended present ruleset and not a superseded version. *This has since become load-bearing:* ~7,000 rows, 4,367 built documents and every combat rule now derive from it, so a superseded file would invalidate far more than it would have in September. Tracked on the board as blocking Epic 6.
3. ~~**Creature schema** — shared with the character, or separate and leaner?~~ **RESOLVED: separate and leaner.** Built as `module/data/actor-creature.mjs` with three creature-only item types; the Bestiary material this question waited on is in `docs/reference/`. See Epic 4 and `DECISIONS.md` → "Creature/NPC implementation".
4. ~~**"Made by half" vs the ±20% critical rule** — which applies where?~~ **RESOLVED, and the guess in this question was right:** the two rules govern different rolls. Attribute **saves** use his half-chance tier (`roll_str_save`), skills use the Player's Guide's ±20% margin (p.93). Both are implemented as such — "Succeeded by half" is at `module/sheets/actor-character-sheet.mjs:246`, the skill margin in the skill-check resolver. Nothing had to be chosen between them.
5. ~~**Attribute tables are already flattened in his code** — follow his flattening?~~ **RESOLVED: yes, followed.** `strRatingValues` is one table over ratings 0-30 with the two books' ranges merged, and the port keeps it merged rather than splitting it back into sourcebook fragments. This is also what makes question 1 easy.
6. **Which remaining PDFs are actually worth ingesting** — **partly answered.** *Mysteries of the Planes* (115 skills) and *Aspects of the Wild* have since been extracted, so the "PDF in hand?" column in §1 is out of date for Mysteries. Still absent: **Conquest of the Eternal** (80 skills), **Legends of the Unknown** (31) and **Epitaph of the Fallen** (24) — 135 skills, ~20% of the 674. Their mechanical data is already in the JS, so these are wanted for prose and edge-case rules, not to implement the skills.
