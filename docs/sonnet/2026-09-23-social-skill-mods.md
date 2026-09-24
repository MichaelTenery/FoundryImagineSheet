# Race and cross-skill modifiers on starting skills: what the pass left for a cheaper window

The rules are built and wired: `tools/extract/extract_social_skill_tables.py` generates
`module/social-skill-tables.mjs`; `module/social-skill-rules.mjs` works the terms out; they reach a
skill's `abilityBonus` through `getClassSkillBonuses` / `getRacialSkillBonuses` /
`getSocialSkillBonuses` in `module/chargen-rules.mjs` (an optional trailing `tmpContext`), from
`assembleCharacter` and from `grantClassSkills` in `module/class-advancement.mjs`. The generator's Skills
step shows each social skill's race modifier and refuses a BLOCKED pick; the Review lists each skill's
breakdown. Tests: `tools/social-mods-test.html` (80), `tools/chargen-test.html` (91).

The project notes called these "social-class skill modifiers". **Nothing in them reads Social Class.**
The right name is "race and cross-skill modifiers".

**Already decided, do not re-open** (each the recommended default, taken 2026-09-23 while the user was
away; provisional until the user confirms). **The DECISIONS entry and the UPSTREAM items that record
these are NOT on this branch**: this stream may not edit those files, so their text went back with the
pass and is written at the merge. Section 4 lists what they must contain -- check it after the merge.
- What `getExtraClassRacialMods` was written to add IS added, though on his live sheet it always returns
  0 (it returns before its own `getAttrs` callback, 53546 vs 53471).
- UPSTREAM 52 fixed: each held racial AND class skill is asked of `getRaceClassSocialMod`. At creation
  the class skills are EVERY title's (`laterClassSkills`): his sheet writes them all at creation (63288)
  and his `getNewSocialSkillModifier` reads them all (125658), so an Assassin's title-2 Disguise lifts
  Acting from the start. `grantClassSkills` never goes back to a social skill -- it was counted. A class
  added later (a dual class; his sheet has none) lifts no social skill already held.
- The Famorian evokes count only while a race item is a Famorian (`buildSkillModContext`), as the
  character's model reads them; stale evokes after a race swap reach nothing.
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

## 4. The durable docs: written at the merge, not on this branch

**DONE 2026-09-24, at the 0.20 integration:** the DECISIONS entry, UPSTREAM 83-89, item 52's
amendment and the PROGRESS rows are written in. The list below is kept as the record of what they
had to contain.

This stream may not edit `docs/DECISIONS.md`, `docs/UPSTREAM-ISSUES.md` or `docs/PROGRESS.md` (other
streams edit them the same day). Their text went back with the pass and is applied at the merge, and the
code's "(DECISIONS.md)" citations rest on that. **After the merge, check each item below is there;
write any that is missing from this list.**

**`docs/DECISIONS.md`: a 2026-09-23 entry, "Race and cross-skill modifiers on starting skills".** Every
ruling marked *provisional: the recommended default, taken 2026-09-23 while the user was away -- confirm
or overrule*:
1. Port what `getExtraClassRacialMods` meant (it returns before its `getAttrs` callback: 53468, 53471,
   53546). Departs from what his sheet does.
2. UPSTREAM 52 fixed for racial AND class skills (125673-125679); at creation every title's class skills
   (125658, 63288); the grant never goes back to a social skill; a dual class added later lifts nothing.
3. The excess rule (53524) kept, except when the trait switch gave nothing (Brok Tame Animal -10%).
   Brachara Climb +30 and the CORE +30 comparison kept and asked.
4. Four data slips repaired and printed on every run: 57748, 57756 (Botany/Botanist), 57714 (Artisan
   twice), 57259 ("Truth Tell "); "A|B" names in the tables.
5. A Half Race: the first race only (`race_list1`, 17028, 53598), against Player's Guide p.33 rule 6.
6. The errata's 13 race-modifier changes from `ERRATA_CHANGES`, re-checked against the local files.
7. Swimming +50 / Webbed +30 only when Swimming is taken (Legends Pg 42 says "Grants").
8. Instinct(Navigation) fixed at creation (53495-53497), though its text says "per Title".
9. Rope Use's +10% matches Set Trap(w) and Set Trap(u) (57267; UPSTREAM 43).
10. A BLOCKED social skill: refused on the Skills step, created with an issue by `assembleCharacter`,
    never removed.
11. Loud gives Surprise Attack -20 (the 46914 typo).

Also in the entry, not rulings: the racial-penalty fix in `assembleCharacter`; the evokes read only with
a Famorian race; and the correction to the 2026-09-19 generator entry (~2454): "social-class skill
modifiers" is this work, misnamed -- read "race and cross-skill modifiers".

**`docs/UPSTREAM-ISSUES.md`: seven new items**, numbered on from the last:
- `getExtraClassRacialMods` always returns 0 (53468 / 53471 / 53546). Callers 53462 and 63786. Check on
  his sheet: a Famorian with Enhanced Hearing and a racial Listen shows dice x2, not dice x2 + 30.
- Loud is written to `tmp_tmp_disabilities_loud` (46914). The reads are `tmp_disabilities_loud` (63914)
  and `disabilities_loud` (48847), so Surprise Attack -20 (53518-53522) never applies.
- The excess rule (53524): (1) no trait, negative race bonus: Brok Tame Animal -10% becomes +10;
  (2) a trait under the race bonus adds in full: Brachara Climb +20 with Climbing +10 is +30, while
  Cervara Listen +30 with Enhanced Hearing +30 stays +30; (3) class skills compare against CORE +30: a
  Climbing evoke adds 10 on a core Climb and 40 on a non-core one.
- Four slips: Farming/Planting (57748) and Foraging/Forestry (57756) are out of pairs at "Botany",
  "Botanist", so neither ever gets a social bonus (are Botany and Botanist one skill?); Calligraphy lists
  Artisan twice (57714); "Truth Tell " has a trailing space (57259); Rope Use's "Set Trap" (57267).
  Harmless: Avian(Forest) twice under Falconry (55569), the `templist` typo (55712).
- Only `race_list1` counts for a Half Race (17028-17031, 53598): is that deliberate, given p.33 rule 6?
- `getNewSocialSkillModifier` reads `socialbonusfromsocial` backwards (125662-125670; p.156 has
  Mathematics giving Accounting +10%). Also: both learn loops stop at `socialskills.length` (125626,
  125665), and neither learn flow applies the race's modifier or BLOCKED.
- Famorian evokes whose bonus is only text: Blowhole +20% Swimming (47211), Sticky/Suction Pad +40% Climb
  (47460), Swimming +50% (47469), Webbed Feet/Hands +30% (47487). Instinct(Navigation)'s "per Title"
  against 53495-53497. `famorian_evoke_hooves_final` set to "Hooves" (33265) but tested for "Yes"
  (53483), harmless. Legends Pg 42's "Grants Swimming Social Skill at +50%": does it grant the skill?

**`docs/UPSTREAM-ISSUES.md` item 52, amended:**
- Status: "answered in the port 2026-09-23, pending your reply".
- Severity: the table is unreachable as written, and the port now applies it.
- `", "` becomes `","`: an array compared with `==` is joined with a bare comma.
- "The port does not carry this table at all" is replaced. The port now applies the six-row table: each
  racial skill, and each class skill of every title at creation, is asked in turn, as
  `getNewSocialSkillModifier` does (125658, 125673-125679).
- A question for him: should a class skill of a later title count before the character reaches that title?

**`docs/PROGRESS.md`:**
- The Character Generation row drops "social-class skill modifiers" from "Still remaining" and names
  what landed.
- The test-routine table gains `tools/social-mods-test.html` (80).

## Not mechanical -- listed so they are not lost

- **A "learn a new skill" flow.** His `handleRacialSkillLearnTry` (125523) and
  `handleSocialSkillLearnTry` (126016) add these same bonuses when a skill is learned later. The port
  has no such flow; a skill dragged on gets 0. If one is built it should call the functions here --
  and NOT copy his `getNewSocialSkillModifier`, which reads `socialbonusfromsocial` backwards
  (125662-125670; UPSTREAM 88).
- **The class's Required and Recommended social skills** (`setSocialSkillLists`, 53591-55407, 93 cases):
  the Player's Guide p.xv step 8 says "take all that are required". Class documents do not carry them
  and the generator does not enforce them. Its own story; the switch is regular and extractable.
- **The Famorian evokes that only SAY a skill bonus**: Swimming ("+50% Swimming"), Webbed Feet/Hands
  ("+30% Swimming"), Blowhole ("+20% Swimming"), Sticky/Suction Pad ("+40% Climb"). His code applies
  none of them (`getExtraSocialMods` reads the race's ability flags, never the evokes). They are asked
  of him in UPSTREAM 89; do not add them until he answers.
- **A class added later: a dual class.** Its skills lift no social skill the character already holds,
  because `grantClassSkills` never goes back to a social skill. His sheet has no second class, so there
  is nothing to port. The Player's Guide (Dual Class Characters, Class Determination rule 5, "learns the
  skills of both classes", p.45-46) does not settle it either. It is the user's call, recorded in
  ruling 2.
