// @START (CODE)
// @MARKER LORE ITEM DATA MODEL
//==================================================================================================================
// Schema for a lore entry -- one ballad, candle ritual, empathy ritual, glyph, hymn, poem, poison
// recipe, potion recipe, ritual, rune, song, sympathy ritual or evoke that a character KNOWS.
//
// These are the twelve repeating sections under LORE on his Magic/Lore tab, plus the evokes, and
// one item type rather than thirteen because his own rows are one shape: a name, a rating (which
// is what it costs to memorize), a modifier (added when it is used), how long it takes to start,
// how long it lasts, what it needs, a memorized tick and a description. The kind says which lore
// it belongs to, as his section name, and through MAGIC_KINDS in module/lore-rules.mjs which skill
// learns it, which skill uses it and which magic switch turns it off.
//
// NAMES ARE NOT UNIQUE ACROSS KINDS. "Break Love" is both a candle ritual and a ritual; "Anger" is
// both a song and a poem; "Healing" is a ballad, a song and a poem. So everything that looks an
// entry up -- the importer, the Items sidebar, the starting-lore roll -- looks it up by kind AND
// name, never by name alone.
//
// The columns, by kind, from the header comment above each of his dictionaries:
//     ballad, hymn, ritual, song     rating, modifier, start time, duration
//     poem                           the same, with the start time in two cells (joined here)
//     candle, empathy, sympathy      the same, and a component -- the candles, or the object
//     glyph                          rating, modifier
//     rune                           rating, modifier, rune type (Emanating, Radiating, Perceived)
//     potion recipe                  a potion's value and duration; rating 15, always
//     poison recipe                  a poison's type, potency and form; rating is the type's number
//     evoke                          a description and nothing else
//==================================================================================================================

import { LORE_KINDS } from "../lore-rules.mjs";
import { getLegacySubsystem } from "../availability.mjs";

const fields = foundry.data.fields;

export default class ImagineLoreData extends foundry.abstract.TypeDataModel {

	static defineSchema() {
		return {

			// @MARKER KIND
			kind:      new fields.StringField({ required: true, initial: "ballad", choices: LORE_KINDS, label: "Kind" }),
			// Which magic switch this answers to -- stored, for the reason given on the consumable.
			// "ballads" for the ballad the initial kind is; one made before the 2026-09-24 split may
			// carry "bardic" or "herbalism", which migrateData below reads as its kind's switch now.
			subsystem: new fields.StringField({ required: true, initial: "ballads", label: "Magic Subsystem" }),

			// @MARKER HIS COLUMNS
			// Rating is the entry's difficulty AND its memorization cost: his recalcMemorizationPoints
			// sums *_rating over every memorized row (sheet-worker.js:136587).
			rating:    new fields.NumberField({ required: true, integer: true, initial: 0, min: 0, label: "Rating" }),
			// Added to the use roll, after the situational modifier (handleUseBallad, 136961).
			modifier:  new fields.NumberField({ required: true, integer: true, initial: 0, label: "Modifier" }),
			startTime: new fields.StringField({ required: true, initial: "", label: "Start Time" }),
			duration:  new fields.StringField({ required: true, initial: "", label: "Duration" }),
			// Candle rituals burn candles ("BL,BN,GY"), empathy and sympathy rituals need an object.
			component: new fields.StringField({ required: true, initial: "", label: "Component" }),
			runeType:  new fields.StringField({ required: true, initial: "", label: "Rune Type" }),
			// A hymn's alignment -- which of his four starting lists it is on (good, evil, neutral,
			// unaligned). Blank for everything else.
			alignment: new fields.StringField({ required: true, initial: "", label: "Alignment" }),

			// @MARKER RECIPES
			// A potion recipe carries its potion's value; a poison recipe its type, potency and form.
			// batchDoses is his *_doses column on a recipe row: how many doses the next brew makes.
			value:         new fields.StringField({ required: true, initial: "", label: "Value" }),
			form:          new fields.StringField({ required: true, initial: "", label: "Form" }),
			poisonType:    new fields.StringField({ required: true, blank: true, initial: "", label: "Poison Type" }),
			poisonPotency: new fields.StringField({ required: true, blank: true, initial: "", label: "Poison Potency" }),
			batchDoses:    new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, label: "Batch Doses" }),

			// @MARKER MEMORIZED
			// His *_mem_check tick. An entry known and not memorized cannot be used ("has not memorized
			// ... Nothing done"), and a memorized one costs its rating in memorization points.
			memorized: new fields.BooleanField({ required: true, initial: false, label: "Memorized" }),

			// @MARKER PROVENANCE
			sourcebook:  new fields.StringField({ required: true, initial: "" }),
			page:        new fields.StringField({ required: true, initial: "" }),
			description: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	// @MARKER ADD NEW lore data model functions HERE

	// @MARKER MIGRATION
	// This is the function which reads a lore entry stored before the 2026-09-24 switch split: its
	// "bardic" or "herbalism" becomes its own kind's switch -- a hymn's "hymns", a potion recipe's
	// "potions". Run by Foundry every time one is loaded, so worlds need no migration pass; the new
	// value is written the next time the item is saved for any reason.
	static migrateData(tmpsource) {
		if (tmpsource?.subsystem) { tmpsource.subsystem = getLegacySubsystem(tmpsource.subsystem, tmpsource.kind); }
		return super.migrateData(tmpsource);
	}
}
// @END (CODE)
