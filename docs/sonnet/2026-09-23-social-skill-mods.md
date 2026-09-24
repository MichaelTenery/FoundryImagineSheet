# Race and cross-skill modifiers on starting skills: what the pass left for a cheaper window

The rules are built and wired: `tools/extract/extract_social_skill_tables.py` generates
`module/social-skill-tables.mjs`; `module/social-skill-rules.mjs` works the terms out; they reach a
skill's `abilityBonus` through `getClassSkillBonuses` / `getRacialSkillBonuses` /
`getSocialSkillBonuses` in `module/chargen-rules.mjs` (an optional trailing `tmpContext`), from
`assembleCharacter` and from `grantClassSkills` in `module/class-advancement.mjs`. The generator's Skills
step shows each social skill's race modifier and refuses a BLOCKED pick; the Review lists each skill's
breakdown. Tests: `tools/social-mods-test.html` (70), `tools/chargen-test.html` (91).

The project notes called these "social-class skill modifiers". **Nothing in them reads Social Class.**
The right name is "race and cross-skill modifiers".

**Already decided, do not re-open** (each the recommended default, taken 2026-09-23 while the user was
away; provisional until the user confirms -- see the DECISIONS entry of that date):
- What `getExtraClassRacialMods` was written to add IS added, though on his live sheet it always returns
  0 (it returns before its own `getAttrs` callback, 53546 vs 53471).
- UPSTREAM 52 fixed: each held racial AND class skill is asked of `getRaceClassSocialMod`.
- The excess rule (53524) is kept as written, except it is skipped when the trait switch gave nothing.
- The four data slips are repaired in the extractor and printed on every run: Botany/Botanist read as
  one giver, Calligraphy's Artisan once, "Truth Tell " trimmed, Rope Use's "Set Trap" matches both
  variants ("A|B" alternatives in the tables).
- A Half Race: the FIRST race only, as his `race_list1`.
- The 13 errata changes come from `ERRATA_CHANGES` in the extractor; with the errata files present it
  re-checks all three tables (`--errata <dir>` points it elsewhere).
- Swimming +50 / Webbed +30 only when Swimming is taken. Famorian Instinct(Navigation) fixed at the
  creation title. Loud gives Surprise Attack -20.
- A BLOCKED social skill: refused on the generator's Skills step; created with an issue by
  `assembleCharacter`; never removed from a character.
- The bonuses are stored once, in `abilityBonus`, when the skill is gained -- never re-derived. No
  schema change, nothing to migrate.

## 1. The sheet's "Social Skill Modifiers" panel

**What to do.** His sheet shows a "Social Skill Modifiers:" box (`attr_social_skills_gen_mods`, sheet
HTML ~20111) listing, for each social skill held, the text in `SOCIAL_GENERAL_MODS` -- "Accounting:
+10% with abacus" and the like. `getSocialSkillGeneralModifiers(names)` in `module/social-skill-rules.mjs`
already returns the lines. Derive them in `_prepareSkills` (`module/data/actor-character.mjs`, ~1579)
from the held skills with `system.category == "social"` onto something like `this.skills.socialNotes`
(derived, never stored), and show them as a short list under the social skills on the Skills tab
(`templates/actor/tab-skills.hbs`).

**Not** the two flags his `setSocialSkillGeneralModifiers` also sets (`mod_aura_control_metaphysics`,
`mod_piety_control_theology`, 57356-57357): those feed Aura and Piety Control, which is Layer 4.

**Done looks like.** A character holding Accounting and Animal Husbandry shows both lines; one holding
neither shows no panel; a derive-test check for the list.

## 2. Flag a BLOCKED social skill dropped onto the sheet

**What to do.** A social skill dragged from the compendium onto a character whose first race is
BLOCKED from it (`getSocialSkillRaceMod(name, getSocialModRaceName(firstRaceItem)).blocked`) should be
flagged the way availability already flags items -- a warning notification on drop and/or a mark
beside the skill on the Skills tab. **Flag, do not refuse** (the port's rule: nothing is taken from a
character behind the Game Master's back). The first race item is `actor.system.raceItems[0]`.

**Done looks like.** Dropping Heavy Drinking on an Elf(High) warns; on a Dwarf it does not.

## 3. A walk-through in the preview

**What to do.** In `tools/chargen-preview.html`, add a Merfolk walk-through that ticks Swimming,
Explorer and Surveyor on the Skills step and shows the Review. It should show "Swimming +10%" beside
the option, and on Review "Swimming (social) +90%: race +10%, ability Swimming +50%, ability Webbed
Feet/Hands +30%" and Surveyor's Explorer +15%. Add an Elf(High) with Heavy Drinking ticked to show the
step's refusal text.

**Done looks like.** The preview renders both, in a browser (it is not run by `run-tests.mjs`).

## 4. Rename in the durable docs

**What to do.** Where `docs/PROGRESS.md` (Character Generation row: "Still remaining: ... social-class
skill modifiers") and `docs/DECISIONS.md` (the 2026-09-19 generator entry, ~2454) say "social-class
skill modifiers", the new DECISIONS entry of 2026-09-23 records the correction; the PROGRESS row should
drop it from "Still remaining" and name what landed. (Left for the merge because other streams edit
those files the same day.)

## Not mechanical -- listed so they are not lost

- **A "learn a new skill" flow.** His `handleRacialSkillLearnTry` (125523) and
  `handleSocialSkillLearnTry` (126016) add these same bonuses when a skill is learned later. The port
  has no such flow; a skill dragged on gets 0. If one is built it should call the functions here --
  and NOT copy his `getNewSocialSkillModifier`, which reads `socialbonusfromsocial` backwards
  (125662-125670; new UPSTREAM item).
- **The class's Required and Recommended social skills** (`setSocialSkillLists`, 53591-55407, 93 cases):
  the Player's Guide p.xv step 8 says "take all that are required". Class documents do not carry them
  and the generator does not enforce them. Its own story; the switch is regular and extractable.
- **The Famorian evokes that only SAY a skill bonus**: Swimming ("+50% Swimming"), Webbed Feet/Hands
  ("+30% Swimming"), Blowhole ("+20% Swimming"), Sticky/Suction Pad ("+40% Climb"). His code applies
  none of them
  (`getExtraSocialMods` reads the race's ability flags, never the evokes). Asked of him in UPSTREAM;
  do not add them until he answers.
