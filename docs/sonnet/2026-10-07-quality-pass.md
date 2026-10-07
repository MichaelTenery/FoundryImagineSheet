# 2026-10-07 — Quality pass: what's left for a cheaper window

Already decided; see DECISIONS 2026-10-07 and don't re-open: the body figure is a pure view over
`body.areas` (no per-area effects until the schema question is settled); the colour schemes are one
dictionary written as palette variables (no CSS blocks per scheme); the Lore chart is rolled on
whenever the lore's +2 applies, with the Grandmaster natural-1 rule; damage spellings go through
`getBlockingDamageType`; caches are dropped by the hooks named at each cache.

Each item below is a pattern already established somewhere in the code. Do it the way the named
example does it, run `node tools/run-tests.mjs`, and tick it off here.

1. **A shared actor-sheet base class.** `actor-character-sheet.mjs` and `actor-creature-sheet.mjs`
   duplicate `_preparePartContext`, the theme `_onRender`, `#saveFormFirst`, `#onOpenItem`,
   `#onDeleteItem`, the `customAlignments` read, and now the three body-figure handlers. Make
   `module/sheets/actor-sheet-base.mjs` holding them (private `#` methods become ordinary `_`
   methods so subclasses can reach them), both sheets extend it. Done when both sheets' diffs are
   deletions only and every suite still passes.
2. **Level Up keeps its picks across a re-render.** `templates/apps/level-up.hbs:89-94, 113-118`:
   the attribute `<select name="pick{{r.index}}">`, the skill dropdown and the points field reset
   on every Place/Undo (`level-up.mjs:168/174` call `this.render()`). Store the current pick, the
   last skill and the points in `#working` on `change`, render them back with `selected`/`value`.
   Pattern: `alignment-config.mjs`'s `#captureForm`. Done when a pick survives Place.
3. **Scope the CSS.** 212 top-level rules in `styles/imagine-rpg.css` are not under `.imagine`
   (`.panel`, `.panel h3`, `.col-num`, `.muted`, `.empty`, `.attr-grid`, `.skill-group`...) and leak
   into every Foundry window. Wrap them in `.imagine { ... }` nesting block by block, checking each
   preview page after each block (specificity rises: a rule that was overridden by a later
   unscoped rule may now win). Also: line 899's `var(--color-text-dark-secondary, #666)` →
   `var(--imagine-muted)`; line 1201's `#fff` → `var(--imagine-on-accent)`; merge the duplicate
   clock colours at 1574-1575 into 1049-1050. Done when `tools/window-test.html` and every preview
   look the same under paper and Foundry standard.
4. **Localisation, cheapest wins first.** Settings `name`/`hint` accept i18n keys directly: move
   every `game.settings.register` string in `imagine-rpg.mjs` and `availability.mjs` to
   `lang/en.json` under `IMAGINE.Settings.<key>.Name/Hint`. Then `static LOCALIZATION_PREFIXES` on
   each data model for the 115 field labels. Templates (about 1,200 runs) are a later pass. Done
   when the settings list reads from `lang/`.
5. **One dice grammar.** Eight parsers (`lore-rules.mjs:110`, `weapon-custom-rules.mjs:43`,
   `chargen-rules.mjs:79`, `advancement-rules.mjs:365`, `casting-helpers.mjs:368`,
   `physique-rules.mjs:35`, `famorian-rules.mjs:71`, `race-rules.mjs:475`) read "1d4+1" and "d6"
   differently. Write `parseDice(text) -> { count, sides, drop, mod } | null` in a new
   `module/dice-rules.mjs`, keep each caller's own quirk wrapper (his "dl0" is d10), and a test
   matrix feeding every parser the same inputs. Done when all eight agree on the matrix.
6. **`MAGIC_KINDS` data-driven.** `lore-rules.mjs:79-86, 760` restate the kind lists
   (`CONSUMABLE_KINDS`, `LORE_KINDS`, `MEMORIZED_KINDS`, `STARTING_LIST_BY_KIND`) and "charm" is
   special-cased in five places (`lore-rules.mjs:281`, `magic-actions.mjs:101`,
   `magic-view.mjs:99-105`, `item-sheet.mjs:647`). Add `memorized`, `startingList`, `usesDoses` to
   each `MAGIC_KINDS` row and derive the lists; `item-picker.mjs:51-60` reads labels from it. Done
   when adding a kind is one row.
7. **Race rules off race names.** `chargen-rules.mjs:155` `CIVILIZED_HUMANS`,
   `starting-money.mjs:241/259`, `equip-rules.mjs:127` `canBodyWearArmor`,
   `social-skill-rules.mjs:189`'s switch. Make them race-item fields (`civilizedHuman`, `coinage`,
   `bardingType`) and an ability-to-skill-bonus table, defaults generated from his lists in
   `tools/extract/`. Done when a homebrew race gets each rule from its own fields.
8. **The generator derives once per render.** `character-generator.mjs:316, 331, 364, 380` each
   call `#derive()` and `buildGeneratorView` derives again (`chargen-view.mjs:505`). Derive once,
   pass the result in; warn about missing content in `_onFirstRender` only (`:395-397` warns every
   render). Done when a select change derives once (count with a console.log, then remove it).
9. **Tracker sort keys once per sort.** `combat-document.mjs:101-104` resolves both clocks on every
   comparison. Decorate–sort–undecorate in `setupTurns`. Done when `round-test` passes unchanged.
10. **Class progression off the derive.** `actor-character.mjs:1055, 1205, 1710` rebuild
    `buildClassProgression` and run `getWholeCareerRows` twice per derive. Group the class skill
    list by title once (a Map), compute career rows once and pass to both callers, use Sets for
    the held-name checks. Done when `derive-test` passes unchanged.
11. **One `_prepareBody`.** Extract `buildBodyAreas({ bodyType, chart, endurance, vitality, worn,
    shields, handedness, wounds, armorDamage })` into `combat-rules.mjs` and have both actor models
    call it. Done when `creature-test` and `derive-test` pass unchanged.
12. **Stored movement fields the derive overwrites.** `actor-character.mjs:206-216`
    (`movement.walk/jog/run/special`, `jumpStand/jumpUp`) are schema fields `_prepareMovement`
    replaces whenever there is a race. Either drop them from the schema (a data migration in
    `data-fixes.mjs`) or add per-mode `misc` fields the derive adds in. **Ask the user which**
    before touching the schema.
13. **Skill lookups take the best copy.** `actor-character.mjs` `_getSkillChance` and
    `_getMartialSkill` use `items.find` (first copy) and ignore `usableByTitle`; `getSkillStanding`
    (`lore-rules.mjs:164`) already does it right. Switch both and add a test holding one skill at
    30% and 55%. Done when the better copy wins regardless of item order.
14. **Data fixes reach token and compendium copies.** `data-fixes.mjs`'s Botanist fix walks
    `game.actors` only; also walk `game.scenes` → unlinked `token.actor`, and `game.items`.
15. **Build check for content files.** `tools/build_system.py:623` counts a referenced directory as
    met if non-empty; parse `CONTENT_PACKS`' `file:` names out of `content-importer.mjs` (the build
    already parses `RETIRED_DOCUMENTS` from it) and check each `src/packs/documents/<file>.json`
    exists; add `.css` to the path scan.
16. **Release packaging (user's call, not Sonnet's).** `system.json`'s `download` points at
    `main/dist/imagine-rpg.zip`; the zip is committed every release (repo pack 22.8 MB). The fix
    is a GitHub Release asset per version and a workflow that builds it. Raise with the user.
17. **Accessibility.** 43 icon-only buttons have `data-tooltip` and no `aria-label` (12 in
    `tab-magic.hbs`, 6 in `tab-creature-combat.hbs`); the wealth inputs
    (`tab-equipment.hbs:39-56`) have no `<label>` or `name`. Add `aria-label` = the tooltip text;
    wrap the wealth inputs in labels.
18. **Chat cards under a dark interface.** `.imagine-chat` keeps literal hexes (CSS 1026-1062) and
    reads `#1c1a17` on a dark card. Give it its own small variable set overridden under
    `.theme-dark .imagine-chat`.
19. **Apply Damage trusts the card's flags.** `attack.mjs` applies `flags.imagine-rpg.attack
    .damage.total`, which the message's author could edit. Store which of `message.rolls` the
    damage came from and re-derive the total on apply. Low urgency at a trusted table; note it.
20. **Live checks** in a running V14 for what this pass could not run: `_onFirstRender` on the
    alignment window, `isActiveGM` at first launch with two GMs, `htmlFields` cleaning a trait
    description, the SVG body rects taking clicks and tooltips, `getDocuments({ _id__in })` on a
    LevelDB pack, the `updateCompendium` hook's argument shape. Tick each off here.

## Feature ideas the audits noticed (for the user to pick from)

- `resolveAttack` already takes `calledShotMod` and `fumbleMod` (his `tmpFumbleMod`) and no caller
  passes them: called-shot bonuses and a wider fumble range are a dialog field away.
- `applyAreaDamage` returns `armorPierced` and the card never prints it.
- `getAreaAttackSize` sizes a cone or line breath; a button could place a Foundry template.
- `getTriggeredEffects` lists a hit's riders (poison, disease, bleeding with duration): save
  buttons or Active Effects instead of text.
- `getShockBar` returns `wounds` too -- a second token bar for free.
- A "Grant owed skills" button where `classProgression[].owed` is non-empty.
- `attributes.*.magicalMax` is derived and clamps nothing; warn when a magical effect passes it.
- `resolveCriticalFumble`'s d8 direction could drop a "weapon here" marker by the token.
- One `postCard(template, data)` chat helper, escaping by default, themeable.
- A limited-view creature sheet (portrait, name, public description) for players with LIMITED.
- `<prose-mirror>` + `enrichHTML` for descriptions (they are HTMLFields already): @UUID links,
  GM-only secrets.
- Prebuilt LevelDB packs under `packs` in system.json, so content updates with the system; keep
  the runtime importer for `manual/` homebrew.
- Import progress with `ui.notifications.info(msg, { progress: true })`; a report of what changed.
- A default icon per item type (all 7,004 shipped documents use Foundry's default image).
- `flags.hotReload` in system.json for development.
- The body figure as the dartboard's aim-point picker: next is the adjacency model per chart.
