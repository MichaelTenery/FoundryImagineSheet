# Handlebars Templates

The ApplicationV2 PARTS templates for every Imagine window. Each part renders ONE root element,
as the framework requires; the sheets list their parts in `static PARTS` and the tabs in
`static TABS` (`module/sheets/*.mjs`, `module/apps/*.mjs`).

- `actor/` -- the character sheet (`header.hbs`, `tab-*.hbs`) and the creature sheet
  (`creature-header.hbs`, `tab-creature-*.hbs`), plus the partials both Combat tabs include:
  `martial-panel.hbs` (registered by `loadMartialTemplates`, `module/combat/martial-attack.mjs`)
  and `body-figure.hbs` (registered by `loadBodyTemplates`, `module/body-view.mjs`).
- `item/` -- the thirteen item sheets, sharing `item-header.hbs`.
- `apps/` -- the character generator, Level Up, Content Availability, Alignments & Tendencies,
  the Situation Mods bar, the Weapon Mods window and the Mr. Initiative round clock.
- `combat/` -- the combat tracker's rows and the clock drawn under each.
- `chat/` -- the cards (attack, damage, skill, casting), rendered through `renderTemplate` so
  every value is escaped.

Everything a template shows is prepared in a `*-view.mjs` or `*-rules.mjs` module or in the
sheet's `_prepareContext`; templates carry no arithmetic. Text the player typed goes through
`{{ }}` (escaped), never `{{{ }}}`. `tools/*-preview.html` render these same files against real
content with Foundry stubbed, which is the quickest way to look at a change.
