// @START (CODE)
// @MARKER SPELL ITEM DATA MODEL
//==================================================================================================================
// Schema for a spell -- one row of his spellslist (sheet-worker.js:160160), 550 of them.
//
// Every column of his is kept, as he wrote it: "5 sec./AUR" for a duration, "2`/AUR" for a range,
// "Cre, Dis, Eng" for the aspects. They are text because they are formulas in Aura, and working
// them out is the spell engine's job, which belongs to the deferred magic phase (CLAUDE.md,
// Layer 4) along with Aura Control, spell lore, specialization and casting itself. What a spell
// item does NOW is be known, be memorized -- at its level in memorization points, as his
// recalcMemorizationPoints counts it -- and be read.
//==================================================================================================================

const fields = foundry.data.fields;

export default class ImagineSpellData extends foundry.abstract.TypeDataModel {

	static defineSchema() {
		return {

			// Always "arcane"; kept as a field so the magic switches can read it off an index.
			subsystem: new fields.StringField({ required: true, initial: "arcane", label: "Magic Subsystem" }),

			// @MARKER HIS COLUMNS
			//                                                                     his header
			level:      new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, label: "Level" }),       // Level
			magicName:  new fields.StringField({ required: true, initial: "", label: "Magic Name" }),                     // Magic Name
			save:       new fields.StringField({ required: true, initial: "", label: "Save" }),                           // Save
			memTime:    new fields.StringField({ required: true, initial: "", label: "Memorization Time" }),              // Mem Time
			spellTypes: new fields.StringField({ required: true, initial: "", label: "Aspects" }),                        // Type
			fail:       new fields.StringField({ required: true, initial: "", label: "Fail" }),                           // Fail
			castTime:   new fields.StringField({ required: true, initial: "", label: "Cast Time" }),                      // Cast Time
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

	// @MARKER ADD NEW spell data model functions HERE
}
// @END (CODE)
