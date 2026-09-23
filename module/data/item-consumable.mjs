// @START (CODE)
// @MARKER CONSUMABLE ITEM DATA MODEL
//==================================================================================================================
// Schema for a consumable -- a herb, a potion, an elixir, a charm or a poison, held as doses.
//
// These are the five repeating sections under CONSUMABLES on his Magic/Lore tab (repeating_herb,
// _potion, _elixir, _charm, _poison), and one item type rather than five because they are one
// thing to the character: something carried a number of times, spent one use at a time, gone
// when the last one is. The kind says which, and it is his own section name, so it also says which
// magic switch turns it off (MAGIC_KINDS in module/lore-rules.mjs).
//
// The columns are his, and each kind uses the ones its dictionary has:
//     herb     herblist     type, value, potency, duration                   sheet-worker.js:128573
//     potion   potionlist   value, duration                                  133023
//     elixir   elixirlist   value, duration                                  134740
//     charm    charmlist    form, Will cost, duration                        135629
//     poison   (none)       type, potency, form, onset, duration             getPoisonDetails, 135117
//
// A POISON IS NOT A ROW OF HIS. It is built from a type (I-XXV) and a potency (A-Q) by
// getPoisonDetails, so no poison ships in a compendium; the Magic & Lore tab makes one from the
// two, and so does the starting-lore roll. See getPoisonDetails in module/lore-rules.mjs.
//==================================================================================================================

import { CONSUMABLE_KINDS, POISON_FORMS } from "../lore-rules.mjs";

const fields = foundry.data.fields;

export default class ImagineConsumableData extends foundry.abstract.TypeDataModel {

	static defineSchema() {
		return {

			// @MARKER KIND
			kind:      new fields.StringField({ required: true, initial: "herb", choices: CONSUMABLE_KINDS, label: "Kind" }),
			// Which of the magic switches this answers to (module/availability.mjs reads it). Set
			// from the kind by the build and by everything that makes one; stored rather than worked
			// out, because a compendium INDEX -- which is what the item picker filters -- carries
			// stored fields and nothing else.
			subsystem: new fields.StringField({ required: true, initial: "herbalism", label: "Magic Subsystem" }),

			// @MARKER DOSES
			// His *_doses column. A charm has none -- it is an object -- and his useCharm never reads
			// one, so for a charm this is simply how many are carried.
			doses: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, label: "Doses" }),

			// @MARKER HIS COLUMNS
			herbType:  new fields.StringField({ required: true, initial: "", label: "Part Used" }),        // herb: Leaf, Root, Bark...
			value:     new fields.StringField({ required: true, initial: "", label: "Value" }),            // "2-4 sp."
			potency:   new fields.StringField({ required: true, initial: "", label: "Potency" }),          // herb: how long it keeps
			duration:  new fields.StringField({ required: true, initial: "", label: "Duration" }),
			willCost:  new fields.StringField({ required: true, initial: "", label: "Will Cost" }),        // charm: "1/5 WIL"
			// A charm's form is the object it is made as ("Animal Figurine"); a poison's is how it is
			// delivered (Ingestive, Contact, Gaseous). One field, since each kind uses only its own.
			form:      new fields.StringField({ required: true, initial: "", label: "Form" }),

			// @MARKER POISON
			poisonType:    new fields.StringField({ required: true, blank: true, initial: "", label: "Poison Type" }),
			poisonPotency: new fields.StringField({ required: true, blank: true, initial: "", label: "Poison Potency" }),
			startTime:     new fields.StringField({ required: true, initial: "", label: "Onset" }),

			// @MARKER PROVENANCE
			sourcebook:  new fields.StringField({ required: true, initial: "" }),
			page:        new fields.StringField({ required: true, initial: "" }),
			description: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	// @MARKER ADD NEW consumable data model functions HERE

	// The three forms a poison is made in, for a sheet's dropdown.
	static get POISON_FORMS() { return POISON_FORMS; }
}
// @END (CODE)
