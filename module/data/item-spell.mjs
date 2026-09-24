// @START (CODE)
// @MARKER SPELL ITEM DATA MODEL
//==================================================================================================================
// Schema for a spell -- one row of his spellslist (sheet-worker.js:160160), 550 of them.
//
// Every column of his is kept, as he wrote it: "5 sec./AUR" for a duration, "2`/AUR" for a range,
// "Cre, Dis, Eng" for the aspects. They stay text: what a spell does at the Aura put into it is
// worked out when it is CAST, by his own doSpellAction (module/casting-worker.mjs, generated), which
// has each spell's arithmetic case by case. A spell is known, memorized -- at its level in
// memorization points, as his recalcMemorizationPoints counts it -- for so many DAYS (below), read,
// and cast (module/casting-actions.mjs castSpell).
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
			// His spell_mastery_check: a mastered spell is cast at +2 Aura Control, in half the time,
			// at three times the range and twice the duration, and everyone else resists it at -20%.
			mastered:  new fields.BooleanField({ required: true, initial: false, label: "Mastered" }),

			// @MARKER DAYS OF MEMORY
			// His spell_days: how many days the spell stays in memory. 30 less its Aura level, at least
			// 1, when it is memorized (his addSpellByName and addSpellDays, sheet-worker.js:160095,
			// 160855; the Player's Guide agrees, p.215); one lost at every Sleep (160889); at 0 it is
			// "forgotten" and cannot be cast until MEM refreshes it (useSpell, 161896). Unticking
			// Memorized clears it (22116).
			//
			// NULL IS "NOT COUNTED YET", not none. A spell held before 2026-09-24, or dragged fresh
			// from a compendium, has never had its days counted; his add would have given it the full
			// count. So null reads as the full count while the spell is memorized (casting-rules.mjs,
			// getSpellDaysLeft) until the first Sleep, MEM or untick writes a number -- which keeps
			// every existing caster's memorized spells castable with no migration.
			days:      new fields.NumberField({ required: false, nullable: true, integer: true, initial: null, min: 0, label: "Days Left" }),

			// @MARKER PROVENANCE
			sourcebook:  new fields.StringField({ required: true, initial: "" }),
			page:        new fields.StringField({ required: true, initial: "" }),
			description: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	// @MARKER ADD NEW spell data model functions HERE
}
// @END (CODE)
