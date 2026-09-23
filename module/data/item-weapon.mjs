// @START (CODE)
// @MARKER WEAPON ITEM DATA MODEL
//==================================================================================================================
// Schema for a weapon.
//
// Fields map onto the 18 columns of weaponvalueslist in the original sheet-worker, whose
// header comment documents the layout and which was cross-checked against how the code
// consumes the row (tempweaponcombatvalues, sheet-worker.js:83991-84023).
//
// A weapon can be used in up to four attack modes -- missile, thrust, cut and smash -- and
// each carries its own modifier. The source data writes "Non" where a mode is unavailable to
// that weapon, which is why each mode has an "available" flag rather than a modifier of zero:
// a dagger with no smash mode is not the same as one that smashes at +0.
//==================================================================================================================

const fields = foundry.data.fields;

	// This is the function which builds one attack mode. available is false where the source
	// data reads "Non", meaning the weapon cannot be used that way at all.
	function attackModeField() {
		return new fields.SchemaField({
			available: new fields.BooleanField({ required: true, initial: false }),
			mod:       new fields.NumberField({ required: true, integer: true, initial: 0 })
		});
	}


export default class ImagineWeaponData extends foundry.abstract.TypeDataModel {

	static defineSchema() {
		return {

			// @MARKER COMBAT VALUES
			damage: new fields.StringField({ required: true, initial: "", label: "Damage" }),

			// Speed is how long a swing takes in the 10 second round; minSpeed is the floor it
			// can be driven down to no matter how much Strength or Agility shortens it.
			speed:    new fields.NumberField({ required: true, integer: true, initial: 0 }),
			minSpeed: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			length:   new fields.StringField({ required: true, initial: "" }),

			// Some weapons have no ordinary swing speed at all -- a lance depends on the
			// charge, caltrops are placed rather than swung, a garrote is a grapple. The
			// source writes "S" for these, and the Game Master sets the timing in play.
			speedSpecial: new fields.BooleanField({ required: true, initial: false }),

			// A few weapons do different damage in one particular attack mode, which the source
			// writes in parentheses after the main damage. His code applies exactly two:
			// a Spear is "4d6(5d6)" and does 5d6 when THROWN; an Axe Hammer is "5d6(2d6)" and
			// does only 2d6 when THRUSTING. Stored as data tied to the mode rather than as
			// weapon names in code, so a homebrew weapon can use the same rule.
			damageAlt:     new fields.StringField({ required: true, initial: "" }),
			damageAltMode: new fields.StringField({ required: true, blank: true, initial: "",
			                   choices: ["", "missile", "thrust", "cut", "smash"] }),

			// Launched missile weapons reload between shots, and the source writes the reload
			// time in parentheses after the speed: a Crossbow is "1(15)" -- it fires in 1 second
			// and takes 15 to reload. His code reads it this way whenever the minimum speed
			// carries parentheses (sheet-worker.js:82953).
			reloadSpeed:    new fields.NumberField({ required: true, integer: true, initial: 0 }),
			reloadMinSpeed: new fields.NumberField({ required: true, integer: true, initial: 0 }),

			// Magical bonus. Each +1 adds +1 to the attack roll and +1 to damage (Player's
			// Guide, Magic Weapons). Kept apart from the attack mode modifiers because some
			// creatures can only be struck by a magical bonus, not by any other kind.
			magicBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),

			// @MARKER ATTACK MODES
			missile: attackModeField(),
			thrust:  attackModeField(),
			cut:     attackModeField(),
			smash:   attackModeField(),

			// Flat modifier this weapon applies to combat skill rolls, e.g. "+5%".
			skillsMod: new fields.NumberField({ required: true, integer: true, initial: 0 }),

			// @MARKER CONSTRUCTION
			// structuralStrength is how much punishment the weapon takes before it breaks --
			// NOT a Strength requirement to wield it. The original sheet scales this by the
			// weapon's construction quality: [Tempered] x1.5, [Double Head] x1.2, [Good] x1.1,
			// [Poor] x0.9, [Shoddy] x0.75, [Serrated] x0.33.
			structuralStrength: new fields.NumberField({ required: true, initial: 0 }),

			// This is a DIFFERENT quality notion from the one above -- his getItemWeight
			// (sheet-worker.js:81979-81990) reads the same bracketed tags out of the item's
			// NAME and scales the item's WEIGHT by them, with a different set of multipliers:
			// [Shoddy] x1.75, [Poor] x1.1, [Good] x.9, [High] x.8, [Master] x.75. Blank means
			// average, which is x1. Stored here as a field rather than parsed from the name,
			// the same tidying the [Float] marker got. A magical plus replaces this multiplier
			// rather than stacking with it -- see resolveEncumbrance in combat-rules.mjs.
			quality: new fields.StringField({ required: true, blank: true, initial: "",
			             choices: ["", "Shoddy", "Poor", "Good", "High", "Master"] }),
			weight:   new fields.NumberField({ required: true, initial: 0 }),
			// Weighs nothing to carry: his "[Float]" marker, which his own sheet reads out of the
			// item's NAME (sheet-worker.js:81815). The name is still honoured -- see itemFloats in
			// combat-rules.mjs -- and this is the tidier way to say it on a sheet with real fields.
			floats: new fields.BooleanField({ required: true, initial: false, label: "Floats (no carried weight)" }),
			type:     new fields.StringField({ required: true, initial: "" }),  // Blade, Bludgeon, ...
			material: new fields.StringField({ required: true, initial: "" }),

			// @MARKER RANGES
			// Blank on a melee weapon. The source writes "-" for a range band that does not apply.
			ranges: new fields.SchemaField({
				pointBlank: new fields.StringField({ required: true, initial: "" }),
				short:      new fields.StringField({ required: true, initial: "" }),
				medium:     new fields.StringField({ required: true, initial: "" }),
				long:       new fields.StringField({ required: true, initial: "" }),
				extreme:    new fields.StringField({ required: true, initial: "" })
			}),

			// @MARKER CARRIED STATE
			// The original sheet tracked three places a thing could be: carried and ready,
			// stowed on a mount, or left in a stash. Only equipped weight counts fully toward
			// encumbrance.
			location:  new fields.StringField({ required: true, initial: "carried",
			               choices: ["equipped", "carried", "mount", "stash"] }),
			quantity:  new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),

			// @MARKER WHICH HAND
			// Which hand or hands the weapon is being used in. This is WIELDING STATE, not a
			// property of the weapon -- nothing in his weaponvalueslist says how a thing is held,
			// and neither of the two booleans this replaces was ever populated from his data.
			//
			// It replaces `twoHanded` and `offhand`, which were separate booleans that could
			// contradict each other: a weapon cannot be held in both hands AND in the off hand,
			// but two booleans can say so. One three-state field cannot express the contradiction.
			//
			//     "both"   -> held in two hands. This is what doubles the Strength damage bonus
			//                 (and halves a negative one) in getStrengthDamageMod.
			//     "left"   -> held in the left hand
			//     "right"  -> held in the right hand
			//
			// OFF-HANDEDNESS IS DERIVED FROM THIS, never stored: a weapon is off-hand when its
			// hand is not the wielder's dominant hand, which is read from the actor's `handedness`.
			// An Ambidextrous wielder has no off hand at all. See isOffhandWeapon in combat-rules.
			hand: new fields.StringField({ required: true, initial: "right",
			          choices: ["right", "left", "both"] }),

			// @MARKER CUSTOMIZATION
			// His Equipment tab's CUSTOMIZE ITEMS panel (customizeItem, sheet-worker.js:78903), which
			// writes each customization into the item's NAME as a bracketed tag -- "+2 {Long Sword}
			// [Sharpness] [Base Aura:10]" -- for his attack to read back out. Kept as fields here,
			// so the weapon keeps its own name and still matches the lore lists by it. What each does
			// is in module/weapon-custom-rules.mjs; the window that sets them is apps/weapon-mods.mjs.
			// The magical plus itself is magicBonus, above; "Blessed" is the flag below.
			//
			// condition is his wear: blank for Undamaged, as his panel treats it.
			condition: new fields.StringField({ required: true, blank: true, initial: "",
			               choices: ["", "Restored", "Repaired", "Worn", "Lightly Damaged", "Damaged", "Heavily Damaged"] }),
			custom: new fields.SchemaField({
				// Shown before and after the name, never written into it (see above).
				prefix:          new fields.StringField({ required: true, initial: "" }),
				suffix:          new fields.StringField({ required: true, initial: "" }),
				// His "Blessed" magical choice, made permanent by the blesser's point of Will Force.
				blessed:         new fields.BooleanField({ required: true, initial: false }),
				// What the magical and divine abilities are worked from: +1 per 5 of each.
				baseAura:        new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				basePiety:       new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				magicAbilities:  new fields.ArrayField(new fields.StringField(), { initial: [] }),
				divineAbilities: new fields.ArrayField(new fields.StringField(), { initial: [] }),
				runes:           new fields.ArrayField(new fields.SchemaField({
				                     name:  new fields.StringField({ required: true, initial: "" }),
				                     level: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 })
				                 }), { initial: [] }),
				energyType:      new fields.StringField({ required: true, initial: "" }),
				energyDice:      new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				// Physical work: Serrated, Silvering, Envenomed and the rest (checkWeaponCustomization).
				customizations:  new fields.ArrayField(new fields.StringField(), { initial: [] }),
				// Any spell or invocation imbued -- his "All Magical Effects" and "All Divine Effects".
				magicalEffects:  new fields.ArrayField(new fields.StringField(), { initial: [] }),
				divineEffects:   new fields.ArrayField(new fields.StringField(), { initial: [] })
			}),

			// @MARKER TEMPORARY EFFECTS
			// Something done to the weapon for a while: Bless (Player's Guide, Holy Weapon, a day) or
			// a Game Master's own. until is the world time it ends at, 0 for "until taken off"; the
			// attack ignores one whose time has passed, and the window lists it to be removed.
			tempEffects: new fields.ArrayField(new fields.SchemaField({
				id:     new fields.StringField({ required: true, initial: "" }),
				name:   new fields.StringField({ required: true, initial: "" }),
				kind:   new fields.StringField({ required: true, initial: "custom" }),
				toHit:  new fields.NumberField({ required: true, integer: true, initial: 0 }),
				damage: new fields.NumberField({ required: true, integer: true, initial: 0 }),
				notes:  new fields.StringField({ required: true, initial: "" }),
				until:  new fields.NumberField({ required: true, initial: 0 }),
				lasts:  new fields.StringField({ required: true, initial: "" })
			}), { initial: [] }),

			// @MARKER POISON COATING
			// A poison put on the weapon -- a dose spent from the Magic & Lore tab's poison USE ("Coat
			// a weapon"). His sheet has no such thing; the rules are the books' and are in
			// lore-rules.mjs (POISON ON A WEAPON): a plain coating is one dose, delivered by the first
			// hit that does actual flesh damage; an Envenomed blade's hilt holds up to 5 doses, one
			// delivered by each thrust that does 10 or more (Mysteries of the Planes p.175). doses 0 is
			// no coating. poisonType and poisonPotency are the poison's, as a poison item carries them.
			coating: new fields.SchemaField({
				name:          new fields.StringField({ required: true, initial: "" }),
				poisonType:    new fields.StringField({ required: true, initial: "" }),
				poisonPotency: new fields.StringField({ required: true, initial: "" }),
				form:          new fields.StringField({ required: true, initial: "" }),
				doses:         new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
			}),

			// Second Weapon Knowledge and Lore are NOT stored here. His per-weapon flags
			// (weaponN_2weapknow / weaponN_2weaplore) were only ever set from the character's own
			// lists of weapon names, so the lists live on the character and the flags are worked
			// out from them -- see getSecondWeaponFlags in combat-rules.mjs.

			// @MARKER PROVENANCE
			cost:        new fields.StringField({ required: true, initial: "" }),
			sourcebook:  new fields.StringField({ required: true, initial: "" }),
			page:        new fields.StringField({ required: true, initial: "" }),
			description: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	// @MARKER ADD NEW weapon data model functions HERE
}
// @END (CODE)
