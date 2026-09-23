// @START (CODE)
// @MARKER INVOCATION ITEM DATA MODEL
//==================================================================================================================
// Schema for an invocation -- one row of his invocationslist (sheet-worker.js:152811), 460 of them.
//
// As with spells, every column is kept as he wrote it. "Uses/Per" is a fraction of a day -- ".166"
// is once in six days -- and "15 min./PC" a duration in Piety Control, which is the invoking
// engine's to work out when the deferred magic phase builds it (CLAUDE.md, Layer 4). Until then
// an invocation is known, memorized at its level, and read. His pray button rolls Divine Knowledge
// (sheet-worker.js:10605); that roll needs Piety Control and devotions, and is not ported yet.
//==================================================================================================================

const fields = foundry.data.fields;

export default class ImagineInvocationData extends foundry.abstract.TypeDataModel {

	static defineSchema() {
		return {

			// Always "divine"; kept as a field so the magic switches can read it off an index.
			subsystem: new fields.StringField({ required: true, initial: "divine", label: "Magic Subsystem" }),

			// @MARKER HIS COLUMNS
			//                                                                     his header
			level:      new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, label: "Level" }),       // Level
			alignment:  new fields.StringField({ required: true, initial: "", label: "Alignment" }),                      // Align
			save:       new fields.StringField({ required: true, initial: "", label: "Save" }),                           // Save
			prayerTime: new fields.StringField({ required: true, initial: "", label: "Prayer Time" }),                    // Prayer Time
			uses:       new fields.StringField({ required: true, initial: "", label: "Uses per Day" }),                   // Uses/Per
			invokeTime: new fields.StringField({ required: true, initial: "", label: "Invoke Time" }),                    // Invoke Time
			range:      new fields.StringField({ required: true, initial: "", label: "Range" }),                          // Range
			area:       new fields.StringField({ required: true, initial: "", label: "Area" }),                           // Area
			duration:   new fields.StringField({ required: true, initial: "", label: "Duration" }),                       // Duration
			distance:   new fields.StringField({ required: true, initial: "", label: "Distance" }),                       // Distance

			// @MARKER MEMORIZED
			memorized: new fields.BooleanField({ required: true, initial: false, label: "Memorized" }),

			// @MARKER PROVENANCE
			sourcebook:  new fields.StringField({ required: true, initial: "" }),
			page:        new fields.StringField({ required: true, initial: "" }),
			description: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	// @MARKER ADD NEW invocation data model functions HERE
}
// @END (CODE)
