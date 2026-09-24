// @START (CODE)
// @MARKER INVOCATION ITEM DATA MODEL
//==================================================================================================================
// Schema for an invocation -- one row of his invocationslist (sheet-worker.js:152811), 460 of them.
//
// As with spells, every column is kept as he wrote it. "Uses/Per" is the uses each point of Piety
// Control buys when it is prayed for (his addUsageByName: uses x Piety Control, + .9, cut down), and
// "15 min./PC" a duration in Piety Control, which his doInvocationAction works out when it is invoked
// (module/casting-worker.mjs). An invocation is prayed for with Divine Knowledge (his pray and
// re-pray buttons), which memorizes it and gives it its uses; each invoke spends one.
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
			// His invoc_uses: the uses left from the last prayer. A prayer sets it; each invoke takes one.
			usesLeft:  new fields.NumberField({ required: true, integer: true, initial: 0, min: 0, label: "Uses Left" }),

			// @MARKER PROVENANCE
			sourcebook:  new fields.StringField({ required: true, initial: "" }),
			page:        new fields.StringField({ required: true, initial: "" }),
			description: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	// @MARKER ADD NEW invocation data model functions HERE
}
// @END (CODE)
