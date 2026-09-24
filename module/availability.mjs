// @START (CODE)
// @MARKER CONTENT AVAILABILITY
//==================================================================================================================
// Decides whether a piece of content may be used in this campaign.
//
// Three layers of control, checked in this order:
//
//   1. MAGIC SWITCHES -- a master "all magic off" switch, and one switch per magic subsystem.
//      These are a hard ceiling. Nothing below can re-enable something a magic switch has
//      turned off, which is what "all magic off" has to mean to be worth having.
//
//   2. OVERRIDES -- the Game Master allowing or forbidding one specific item, keyed by
//      "type:name" (e.g. "class:Monk"). This is how a single class is disallowed in a
//      campaign, or a single entry from a disabled book is let back in.
//
//   3. SOURCEBOOKS -- whole books switched on or off. Content that carries no sourcebook is
//      always available here; it can still be forbidden individually by an override.
//
// Anything not explicitly switched off is on. A sourcebook or subsystem added later is
// therefore enabled by default rather than silently vanishing.
//
// Nothing is ever deleted when a switch flips. Content already on a character is flagged
// unavailable and shown as such, because removing a player's things behind their back is
// not an acceptable side effect of a settings change.
//
// None of this exists in the original Roll20 sheet -- its Config tab covers sheet style,
// equipment handling and experience display, not content availability. This layer is new.
//==================================================================================================================

import { MAGIC_KINDS } from "./lore-rules.mjs";
import { ARCH_MORTAL_INVULNERABILITY } from "./advancement-rules.mjs";

// @MARKER SOURCEBOOKS
// Every book the extracted content cites, plus Custom for homebrew. Books not listed here
// are still picked up from the content itself at runtime; this list just gives them names
// and a stable order.
export const SOURCEBOOKS = {
	"players-guide":           "Player's Guide",
	"masters-manual":          "Master's Manual",
	"aspects-of-the-wild":     "Aspects of the Wild",
	"mysteries-of-the-planes": "Mysteries of the Planes",
	"conquest-of-the-eternal": "Conquest of the Eternal",
	"legends-of-the-unknown":  "Legends of the Unknown",
	"epitaph-of-the-fallen":   "Epitaph of the Fallen",
	// His own cross-book consolidation, and a real place to look something up. It is where the
	// content build gets a page for anything his per-book Source columns do not cover -- the
	// Heroic Melee Weapons table names no book, so Angel Sword cites the Master Index at 326.
	"imagine-master-index":    "Imagine Master Index",
	"custom":                  "Custom / Homebrew"
};

// @MARKER MAGIC SUBSYSTEMS
// One entry per independently switchable kind of magic. "sections" records which repeating
// sections of the original Roll20 sheet each one covers, so the grouping can be checked
// against his sheet -- and split further if a finer switch is ever wanted.
//
// SPLIT 2026-09-24, from the parallel magic branch (wip/magic-m1): "bardic" was ballads, hymns,
// poems and songs under one switch, and "herbalism" herbs, potions and elixirs. Hymns are divine and
// the other three arcane, so a Game Master could not keep the one without the others; and CLAUDE.md
// promises "20+ individually-toggleable" subsystems. Now one switch per repeating section of his, 21
// in all. A world that switched "bardic" or "herbalism" off keeps its successors off -- see LEGACY
// SUBSYSTEMS below.
//
//   switch        label                         his repeating sections
export const MAGIC_SUBSYSTEMS = {
	arcane:      { label: "Arcane Magic (Aura)",    sections: ["spells"] },
	divine:      { label: "Divine Magic (Piety)",   sections: ["invocations"] },
	evoke:       { label: "Evocation",              sections: ["evoketree", "evokeskill"] },
	powers:      { label: "Powers",                 sections: ["powers"] },
	enchanting:  { label: "Magic Item Empowering",  sections: ["mitempowers"] },
	divineItems: { label: "Divine Item Empowering", sections: ["ditempowers"] },
	herbs:       { label: "Herbs",                  sections: ["herb"] },
	potions:     { label: "Potions",                sections: ["potion", "potionrecipe"] },
	elixirs:     { label: "Elixirs",                sections: ["elixir"] },
	poisons:     { label: "Poisons",                sections: ["poison", "poisonrecipe"] },
	charms:      { label: "Charms",                 sections: ["charm"] },
	ballads:     { label: "Ballads",                sections: ["ballad"] },
	hymns:       { label: "Hymns",                  sections: ["hymn"] },
	poems:       { label: "Poems",                  sections: ["poem"] },
	songs:       { label: "Songs",                  sections: ["song"] },
	candlelore:  { label: "Candle Lore",            sections: ["candlelore"] },
	empathy:     { label: "Empathy Magic",          sections: ["empathymagic"] },
	sympathy:    { label: "Sympathy Magic",         sections: ["sympathymagic"] },
	glyphs:      { label: "Glyphs",                 sections: ["glyph"] },
	runes:       { label: "Runes",                  sections: ["rune"] },
	rituals:     { label: "Rituals",                sections: ["ritual"] }
};

// @MARKER LEGACY SUBSYSTEMS
// The two switches the split above retired, and what each became. Kept so nothing a world stored
// under the old names is lost: a campaign setting of { bardic: false } still switches all four off
// (normalizeMagicSubsystems), and an item made before the split, carrying subsystem "bardic",
// answers to its own kind's switch (getLegacySubsystem, which the item data models call on load).
//
//   old switch    became                                         read by the kind
export const LEGACY_SUBSYSTEMS = {
	bardic:    ["ballads", "hymns", "poems", "songs"],       // ballad, hymn, poem, song
	herbalism: ["herbs", "potions", "elixirs"]               // herb, potion (and potionrecipe), elixir
};

// Skill types that make a skill magical, and which subsystem each one answers to.
// A skill typed "Magical,Divine" belongs to both, and needs both switched on (DECISIONS 2026-09-11).
//
// ONE ADDITION, 2026-09-24: a magical skill that LEARNS or USES one of his lore kinds answers to that
// kind's switch AS WELL -- Ballad Lore to Ballads, Intone and Hymn Lore to Hymns, Recite and Poem Lore
// to Poems, Sing and Song Lore to Songs, Rune Lore to Runes, Candle Lore to Candle Lore, Evoke to
// Evocation (MAGIC_KINDS in lore-rules.mjs names them). An ADDITION, never a replacement: the skill
// still answers to its types' switches, so every one of them has to be on. His skilldict types these
// skills three ways, and all three keep the 2026-09-11 rule:
//     Magical          Ballad Lore, Poem Lore, Recite, Song Lore, Sing, Rune Lore, Glyph, Empathy Magic,
//                      Sympathy Magic                              -- Arcane Magic and the kind's switch
//     Divine           Hymn Lore, Intone, Evoke                    -- Divine Magic and the kind's switch
//     Magical,Divine   Candle Lore, Potion Lore, Ritual Lore       -- both, and the kind's switch
// So Sing needs Arcane Magic and Songs; Intone needs Divine Magic and Hymns. A world with Divine Magic
// off still has no Evoke, Intone or Hymn Lore, and one with Arcane Magic off no Sing or Rune Lore --
// as before the split. What is new is only that switching a kind off now reaches the skills that learn
// and use it too, where until now it reached the kind's own items and left the skill (Songs off left
// Sing). getSkillSubsystems below. (The first port of this, the same day, REPLACED the types' switches
// with the kind's, which brought Evoke, Intone and Hymn Lore back into worlds with Divine Magic off, and
// Sing and Rune Lore into worlds with Arcane Magic off. Corrected on review before it was merged.)
const SKILL_TYPE_SUBSYSTEMS = {
	"Magical": "arcane",
	"Divine":  "divine"
};

// @MARKER MAGIC RULES
// Optional casting rules -- rules, not content, so they never flag an item unavailable; they change
// what a roll does. A world setting of their own (magicRules) beside the switches, each rule also
// needing its sourcebook switched on, and the master switch above them all (isMagicRuleOn).
//
// EMPTY FOR NOW, deliberately: casting plays only what his sheet always does. Registered now, from
// the parallel magic branch's design, so the first optional rule has a home to arrive in. The ones
// that design expected first:
//     highAuraFatigue   the AUR save above 21 Aura under title 11      Player's Guide p.217
//     spellTuning       speed casting, stabilizing, overloading, reach  Mysteries of the Planes pp.389-390
//     burningAura       one AUR burned for 20 Aura                     Player's Guide p.217
//     specialization    aspect mastery, +/-3 Aura Control              (his 16538, 170522)
//     combinedCasting   the Combine spell's circle                     (his 161574)
//
//   rule     label     sourcebook (a key of SOURCEBOOKS, or "" for none)     default
export const MAGIC_RULES = {
};


// @MARKER GENERAL PURPOSE FUNCTIONS

	// This is the function which turns a sourcebook name into the key its switch is stored
	// under. His data writes a backtick where an apostrophe belongs, so "Player`s Guide" and
	// "Player's Guide" have to land on the same key. Returns "" for untagged content, and
	// for the "?" his data uses where the book is unknown.
	export function getSourcebookId(tmpname) {
		var tmptext = String(tmpname ?? "").toLowerCase();

		// "XXX" IS A MARK, NOT A BOOK. The content build writes it into the sourcebook field of
		// anything his Master Index does not list, so that a gap is searchable rather than an
		// empty box. It must not become a switchable sourcebook: this window discovers books from
		// the content, so an "XXX" row would appear beside the real ones and one tick would hide
		// the 1,702 items that merely have not been traced to a book yet. Returning no id puts
		// them on the same footing as content that carries no sourcebook at all -- always
		// available here, and still forbiddable one at a time by an override.
		if (tmptext == "xxx") { return ""; }

		tmptext = tmptext.replace(/[`']/g, "");
		tmptext = tmptext.replace(/[^a-z0-9]+/g, "-");
		tmptext = tmptext.replace(/^-+|-+$/g, "");
		return tmptext;
	}

	// This is the function which builds the name-to-switch table for the skills that learn or use a
	// lore kind, once, from MAGIC_KINDS -- so a kind that changes its skill carries its switch with it.
	var kindSkillSubsystems = null;
	function getKindSkillTable() {
		if (kindSkillSubsystems) { return kindSkillSubsystems; }
		kindSkillSubsystems = {};
		for (const tmpdef of Object.values(MAGIC_KINDS)) {
			for (const tmpname of [tmpdef.learn, tmpdef.use]) {
				if (tmpname && !kindSkillSubsystems[tmpname]) { kindSkillSubsystems[tmpname] = tmpdef.subsystem; }
			}
		}
		return kindSkillSubsystems;
	}

	// This is the function which says which switches a MAGICAL skill (typed Magical or Divine)
	// answers to: its types' switches, as the 2026-09-11 entry has it, and then -- if it learns or
	// uses one of his lore kinds -- that kind's switch as well. A wilderness or underground form
	// ("Rune Lore(w)") is read as its plain name. Every switch returned has to be on for the skill to
	// be available (explainAvailability). A skill that is not magical answers to none, whatever it is
	// called (Poison Lore is typed Informational), so no kind's switch reaches it either.
	//
	//     Sing           ["Magical"]              ->  ["arcane", "songs"]
	//     Intone         ["Divine"]               ->  ["divine", "hymns"]
	//     Candle Lore    ["Magical", "Divine"]    ->  ["arcane", "divine", "candlelore"]
	//     Abasement      ["Magical"]              ->  ["arcane"]
	export function getSkillSubsystems(tmpname, tmptypes) {
		var tmpmagical = (tmptypes ?? []).filter(tmptype => SKILL_TYPE_SUBSYSTEMS[tmptype]);
		if (!tmpmagical.length) { return []; }

		// Its types' switches first -- never dropped (DECISIONS 2026-09-11).
		var tmpout = [];
		for (const tmptype of tmpmagical) {
			var tmpsub = SKILL_TYPE_SUBSYSTEMS[tmptype];
			if (!tmpout.includes(tmpsub)) { tmpout.push(tmpsub); }
		}

		// Then its kind's switch, if it learns or uses one of his lore kinds.
		var tmptable = getKindSkillTable();
		var tmpplain = ("" + (tmpname ?? "")).replace(/\((w|u)\)$/, "");
		var tmpkind = tmptable[tmpname] ?? tmptable[tmpplain];
		if (tmpkind && !tmpout.includes(tmpkind)) { tmpout.push(tmpkind); }
		return tmpout;
	}

	// This is the function which says what a subsystem stored before the 2026-09-24 split became,
	// for one item of a given kind: "bardic" on a hymn is "hymns", "herbalism" on a potion recipe is
	// "potions". Anything that is not a retired switch comes back as it was. Pure, so the item data
	// models can call it from migrateData.
	export function getLegacySubsystem(tmpsubsystem, tmpkind) {
		if (!LEGACY_SUBSYSTEMS[tmpsubsystem]) { return tmpsubsystem; }
		var tmpnow = MAGIC_KINDS[tmpkind]?.subsystem ?? "";
		if (LEGACY_SUBSYSTEMS[tmpsubsystem].includes(tmpnow)) { return tmpnow; }
		// A kind the old switch never covered: the first of the switches it became.
		return LEGACY_SUBSYSTEMS[tmpsubsystem][0];
	}

	// This is the function which reads a stored set of magic switches in today's names. A world that
	// switched "bardic" off before the split has all four of its successors off, unless one of them
	// has been set since; the retired names are dropped, so the next save stores only today's.
	export function normalizeMagicSubsystems(tmpstored) {
		var tmpout = {};
		for (const [tmpkey, tmpvalue] of Object.entries(tmpstored ?? {})) {
			if (!LEGACY_SUBSYSTEMS[tmpkey]) { tmpout[tmpkey] = tmpvalue; }
		}
		for (const [tmpold, tmpnew] of Object.entries(LEGACY_SUBSYSTEMS)) {
			if (tmpstored?.[tmpold] === undefined) { continue; }
			for (const tmpkey of tmpnew) {
				if (tmpout[tmpkey] === undefined) { tmpout[tmpkey] = tmpstored[tmpold]; }
			}
		}
		return tmpout;
	}

	// This is the function which works out which magic subsystems an item belongs to.
	//
	//     a title's power   none -- his Arch Mortal invulnerability, or any power stored with the
	//                       switch "none" (isTitlePower). Not magic, so no switch reaches it
	//     magic content     its own stored subsystem -- a spell, an invocation, a lore, a consumable,
	//                       a power; one stored under a retired switch reads as its successor
	//     a power           with none stored (made before 2026-09-24), from its kind: a magic item's
	//                       power answers to Magic Item Empowering, a divine item's to Divine Item
	//                       Empowering, anything else to Powers -- his three repeating sections
	//     a magical skill   getSkillSubsystems: its types' switches, and its kind's as well
	//     anything else     none
	export function getItemMagicSubsystems(tmpitem) {
		var tmpsystem = tmpitem?.system ?? {};
		// Before the stored subsystem, because a title's power may carry "powers" -- the field's
		// initial value -- from before it was told apart.
		if (isTitlePower(tmpitem)) { return []; }
		if (tmpsystem.subsystem) { return [getLegacySubsystem(tmpsystem.subsystem, tmpsystem.kind)]; }

		if (tmpitem?.type == "power") { return [getPowerSubsystem(tmpsystem.powerKind)]; }
		if (tmpitem?.type == "skill" && Array.isArray(tmpsystem.types)) {
			return getSkillSubsystems(tmpitem.name, tmpsystem.types);
		}
		return [];
	}

	// This is the function which says which switch a power of a given kind answers to. The power
	// item's data model gives the same to one stored before it carried a switch.
	export function getPowerSubsystem(tmppowerkind) {
		if (tmppowerkind == "magicItem") { return "enchanting"; }
		if (tmppowerkind == "divineItem") { return "divineItems"; }
		return "powers";
	}

	// @MARKER A TITLE'S POWER
	// This is the function which says whether a power is a TITLE'S BENEFIT rather than magic, and so
	// answers to no magic switch at all -- not Powers, and not the master "all magic off" either.
	//
	// His Arch Mortal invulnerability is the one there is. His setArchMortalInvulnerability
	// (sheet-worker.js:27574-27593) writes it into the plain "powers" text attribute (attr_powers),
	// NOT his repeating_powers section, which is the one the Powers switch stands for (MAGIC SUBSYSTEMS
	// above). It is what reaching 11th, 13th and 15th title gives an Arch Mortal, like the attribute
	// maximums and Sense Supernatural beside it, and a campaign that switches creature powers off has
	// not switched off the titles. Before 2026-09-24 no power answered to any switch, so this keeps
	// every Arch Mortal as they were.
	//
	// Two ways to be one:
	//     its stored switch is "none"      what advancement.mjs gives the power it creates since
	//                                      2026-09-24, and what the power sheet's "Magic switch" can set
	//     its name is one of his three     the power main's advancement created before then, stored
	//     invulnerability wordings         with no switch -- which the data model's migrateData has
	//                                      filled in as "powers" by the time anything reads it, so the
	//                                      name, his own text word for word, is what tells it apart
	export const NO_MAGIC_SWITCH = "none";
	var titlePowerNames = null;
	export function isTitlePower(tmpitem) {
		if (tmpitem?.type != "power") { return false; }
		if (tmpitem.system?.subsystem == NO_MAGIC_SWITCH) { return true; }
		if (!titlePowerNames) { titlePowerNames = Object.values(ARCH_MORTAL_INVULNERABILITY); }
		return titlePowerNames.includes(tmpitem.name);
	}

	// This is the function which says whether one of the optional casting rules (MAGIC_RULES) is in
	// play: never with all magic off, never with its sourcebook off, and otherwise as the world's
	// magicRules setting says, or its own default when the setting has never been touched.
	export function isMagicRuleOn(tmprule, tmprules) {
		var tmpdef = MAGIC_RULES[tmprule];
		if (!tmpdef) { return false; }
		if (tmprules?.magicEnabled === false) { return false; }
		if (tmpdef.sourcebook && tmprules?.sourcebooks?.[tmpdef.sourcebook] === false) { return false; }
		var tmpset = tmprules?.magicRules?.[tmprule];
		return tmpset === undefined ? !!tmpdef.default : !!tmpset;
	}

	// This is the function which builds the key an override is stored under.
	export function getOverrideKey(tmptype, tmpname) {
		return `${tmptype}:${tmpname}`;
	}

	// This is the function which lists the override keys an item answers to, most specific
	// first. Nearly everything answers to one key, its own name.
	//
	// A class with a choice in it is one document per path -- "Elementalist(Call of Death)",
	// "Knight(Dark Templar)" -- so a Game Master switching off "Elementalist" would otherwise
	// have switched off nothing at all, six documents being named something else. The base
	// class is therefore a second key BELOW the path's own: setting the path decides it, and
	// setting the base class decides every path that has no key of its own.
	//
	// The base class comes from the document's own baseClass field where it has one (that is
	// what build_documents.py writes), and from the name before the bracket otherwise, so a
	// path a Game Master authored by hand behaves the same way.
	export function getOverrideKeys(tmpitem) {
		var tmpkeys = [getOverrideKey(tmpitem.type, tmpitem.name)];
		if (tmpitem.type != "class") { return tmpkeys; }

		var tmpbase = tmpitem.system?.baseClass || ("" + tmpitem.name).split("(")[0].trim();
		if (tmpbase && tmpbase != tmpitem.name) { tmpkeys.push(getOverrideKey("class", tmpbase)); }
		return tmpkeys;
	}

	// This is the function which decides whether an item may be used, and says why.
	// Returns { available, reason }. Pure -- everything it needs arrives in tmprules, so it
	// can be tested without Foundry running.
	//
	// tmprules = {
	//     magicEnabled:    bool,
	//     magicSubsystems: { arcane: true, runes: false, ... },
	//     overrides:       { "class:Monk": false, ... },
	//     sourcebooks:     { "players-guide": true, "mysteries-of-the-planes": false, ... }
	// }
	export function explainAvailability(tmpitem, tmprules) {
		if (!tmprules) { return { available: true, reason: "" }; }

		// 1. Magic switches -- a ceiling nothing else can lift. Switches stored under the names the
		// 2026-09-24 split retired are read as their successors.
		var tmpsubsystems = getItemMagicSubsystems(tmpitem);
		if (tmpsubsystems.length) {
			if (tmprules.magicEnabled === false) {
				return { available: false, reason: "All magic is switched off in this campaign." };
			}
			var tmpswitches = normalizeMagicSubsystems(tmprules.magicSubsystems);
			for (const tmpsub of tmpsubsystems) {
				if (tmpswitches[tmpsub] === false) {
					var tmplabel = MAGIC_SUBSYSTEMS[tmpsub]?.label ?? tmpsub;
					return { available: false, reason: `${tmplabel} is switched off in this campaign.` };
				}
			}
		}

		// 2. Individual overrides. Most specific key first -- a class path's own key answers
		// before the base class's, so one path can be allowed out of a class that is otherwise
		// switched off.
		for (const tmpkey of getOverrideKeys(tmpitem)) {
			if (!tmprules.overrides) { break; }
			if (!Object.prototype.hasOwnProperty.call(tmprules.overrides, tmpkey)) { continue; }
			var tmpallowed = tmprules.overrides[tmpkey] === true;
			return {
				available: tmpallowed,
				reason: tmpallowed ? "" : `${tmpitem.name} is disallowed in this campaign.`
			};
		}

		// 3. Sourcebooks. Untagged content is always available at this level.
		var tmpbook = tmpitem.system?.sourcebook ?? "";
		var tmpbookid = getSourcebookId(tmpbook);
		if (tmpbookid && tmprules.sourcebooks?.[tmpbookid] === false) {
			return { available: false, reason: `${tmpbook} is switched off in this campaign.` };
		}

		return { available: true, reason: "" };
	}

	// This is the function which answers the plain yes-or-no question.
	export function isItemAvailable(tmpitem, tmprules) {
		return explainAvailability(tmpitem, tmprules).available;
	}


// @MARKER SETTINGS

	// This is the function which reads the current campaign's rules out of the world settings,
	// in the shape explainAvailability expects.
	export function getAvailabilityRules() {
		return {
			magicEnabled:    game.settings.get("imagine-rpg", "magicEnabled"),
			magicSubsystems: normalizeMagicSubsystems(game.settings.get("imagine-rpg", "magicSubsystems")),
			overrides:       game.settings.get("imagine-rpg", "contentOverrides"),
			sourcebooks:     game.settings.get("imagine-rpg", "sourcebooks"),
			magicRules:      game.settings.get("imagine-rpg", "magicRules")
		};
	}

	// This is the function which refreshes every character after a switch changes, so the
	// unavailable flags on their items update without anyone having to reload.
	//
	// An unlinked token's actor is its own document, and resetting the base actor does not reach it
	// (bug sweep 2026-09-23), so an open sheet of one kept its old markings. Every actor a sheet is
	// open for is reset as well, which takes in the token actors that anyone is looking at.
	function refreshAfterChange() {
		for (const tmpactor of game.actors) { tmpactor.reset(); }
		for (const tmpapp of foundry.applications.instances.values()) {
			if (tmpapp.document?.documentName == "Actor" && tmpapp.rendered) {
				if (tmpapp.document.isToken) { tmpapp.document.reset(); }
				tmpapp.render();
			}
		}
	}

	// This is the function which registers the five world settings the switches live in.
	// All are hidden from the default settings list; they are edited through the
	// Content Availability window instead, where they make sense together.
	export function registerAvailabilitySettings() {
		game.settings.register("imagine-rpg", "magicEnabled", {
			scope: "world", config: false, type: Boolean, default: true,
			onChange: refreshAfterChange
		});
		game.settings.register("imagine-rpg", "magicSubsystems", {
			scope: "world", config: false, type: Object, default: {},
			onChange: refreshAfterChange
		});
		game.settings.register("imagine-rpg", "contentOverrides", {
			scope: "world", config: false, type: Object, default: {},
			onChange: refreshAfterChange
		});
		game.settings.register("imagine-rpg", "sourcebooks", {
			scope: "world", config: false, type: Object, default: {},
			onChange: refreshAfterChange
		});
		// The optional casting rules (MAGIC_RULES), { rule: true/false }. Empty until the first of
		// them is built; registered now so the setting exists before anything reads it.
		game.settings.register("imagine-rpg", "magicRules", {
			scope: "world", config: false, type: Object, default: {},
			onChange: refreshAfterChange
		});

		// Carry sourcebook and type in the compendium index, so the availability window can
		// find every book the content actually cites without loading thousands of documents.
		CONFIG.Item.compendiumIndexFields.push("system.sourcebook", "system.types");
	}


// @MARKER ENFORCEMENT

	// This is the function which stops disallowed content being added to a character.
	//
	// It sits on item creation rather than on any one sheet or drop handler, so it holds no
	// matter how the item arrives -- dragged from a compendium, created by a macro, copied
	// from another actor.
	//
	// Players are blocked outright. A Game Master is allowed through with a warning, because
	// the Game Master is the one who decides what is in the campaign and may be making a
	// deliberate exception.
	export function registerAvailabilityEnforcement() {
		Hooks.on("preCreateItem", function (tmpitem, tmpdata, tmpoptions, tmpuserid) {
			if (tmpitem.parent?.documentName != "Actor") { return true; }

			var tmpresult = explainAvailability(tmpitem, getAvailabilityRules());
			if (tmpresult.available) { return true; }

			if (game.user.isGM) {
				ui.notifications.warn(`${tmpresult.reason} Added anyway, because you are the Game Master.`);
				return true;
			}
			ui.notifications.warn(`${tmpresult.reason} It cannot be added.`);
			return false;
		});
	}

// @MARKER ADD NEW availability functions HERE
// @END (CODE)
