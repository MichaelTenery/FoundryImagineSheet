// @START (CODE)
// @MARKER CREATURE ACTOR DATA MODEL
//==================================================================================================================
// Schema for a creature in the Imagine Role Playing System.
//
// A creature is NOT a character with fewer fields. The two share their attributes, their saves,
// their per-area wounds and the attack chart, but almost everything else works the other way
// round: where a character DERIVES Endurance, resistances and its attack skill from attributes,
// race and class, a creature has them written into its stat block and simply carries them.
// Ported from his creature functions (sheet-worker.js:174658 onward) -- see docs/DECISIONS.md,
// "Creature/NPC audit findings" and the CORRECTION entry that follows it.
//
// What is entered rather than worked out:
//     Endurance, Hide, Shock       -- calcAllCreatureCaracs reads them straight off the stat block
//     all five resistances         -- entered percentages plus modifiers, with no attribute table
//     the attack chart             -- chosen outright, not read off a class progression
//     the body chart               -- stored and editable, because "Custom" is a real body type
//     every skill's chance         -- a flat percentage per skill, as the Bestiary prints it
//
// What IS worked out, in prepareDerivedData:
//     attribute saves and their table modifiers, as for a character
//     Perception, Affinity and Fortune, on a creature-only formula
//     the body's areas, their Endurance and the armour over them
//     encumbrance, and the standing combat numbers
//==================================================================================================================

import { ATTRIBUTE_TABLES } from "../config-tables.mjs";
import { explainAvailability } from "../availability.mjs";
import ImagineCharacterData from "./actor-character.mjs";
import { CREATURE_TYPES, CREATURE_BODY_TYPES, CREATURE_ATTACK_CHARTS, CREATURE_SIZES } from "../creature-tables.mjs";
import {
	getBodyChart, parseBodyChart, getAreaEndurance, getStrongestMaterial,
	getInitiativeModifier, getNextAttackSkill, getAreaArmor, getAreaShield, resolveEncumbrance,
	resolveSituationalMods, getOffhandSecondsCap, getWeightDamageAdjust, getShockBar, hasLore, LORE_GENERAL
} from "../combat/combat-rules.mjs";
import { MARTIAL_DISCIPLINE_NAMES, deriveMartialArts } from "../combat/martial-arts.mjs";
import { getCreatureHideMax, getCreatureJumps } from "../creature-sheet-rules.mjs";

const fields = foundry.data.fields;

	// This is the function which builds the schema shared by all twelve attributes.
	//
	// Same shape as a character's, so anything reading attributes.<attr>.value works on either
	// actor type. rating is the stat block's figure; there is no racial modifier, because a
	// creature has no race item -- its type and body are its own.
	function attributeField(label) {
		return new fields.SchemaField({
			rating:  new fields.NumberField({ required: true, integer: true, initial: 10, min: 0, max: 30, label: label }),
			permMod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			tempMod: new fields.NumberField({ required: true, integer: true, initial: 0 })
		});
	}

	// This is the function which builds an entered characteristic -- one the stat block states
	// and the sheet does not calculate. Endurance and Hide are both of these.
	function enteredField(label) {
		return new fields.SchemaField({
			entered: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0, label: label }),
			tempMod: new fields.NumberField({ required: true, integer: true, initial: 0 })
		});
	}

	// This is the function which builds a calculated characteristic. Perception, Affinity and
	// Fortune are averaged from attributes like a character's, but with a level term and the
	// bonuses certain abilities grant, so only the manual adjustment is stored.
	function calculatedField(label) {
		return new fields.SchemaField({
			tempMod: new fields.NumberField({ required: true, integer: true, initial: 0, label: label })
		});
	}

	// This is the function which builds one resistance track.
	//
	// Unlike a character's, a creature's resistance has no attribute table behind it: the stat
	// block states a percentage. His code also accepts the word "Immune" typed into the figure
	// (calcAllCreatureResists, sheet-worker.js:178276), which is a state rather than a large
	// number, so it is a flag here.
	function resistanceField(label) {
		return new fields.SchemaField({
			entered: new fields.NumberField({ required: true, integer: true, initial: 0, label: label }),
			tempMod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			permMod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
			immune:  new fields.BooleanField({ required: true, initial: false })
		});
	}


export default class ImagineCreatureData extends foundry.abstract.TypeDataModel {

	static defineSchema() {
		return {

			// @MARKER IDENTITY
			// Type is required in his Configurator, and checkAllCreatureValues does nothing at
			// all while it is empty, so a creature with no type is an unfinished creature.
			// Subtype, life cycle and habitat are free text: his Configurator takes them as
			// typed input rather than from a list.
			identity: new fields.SchemaField({
				creatureType: new fields.StringField({ required: true, blank: true, initial: "",
				                  choices: ["", ...CREATURE_TYPES], label: "Creature Type" }),
				subtype:    new fields.StringField({ required: true, initial: "", label: "Subtype" }),
				level:      new fields.NumberField({ required: true, integer: true, initial: 1, min: 0, label: "Level" }),
				lifecycle:  new fields.StringField({ required: true, initial: "", label: "Habits / Life Cycle" }),
				habitat:    new fields.StringField({ required: true, initial: "", label: "Climate / Habitat" }),
				alignment:  new fields.StringField({ required: true, initial: "", label: "Alignment" }),
				tendencies: new fields.StringField({ required: true, initial: "", label: "Tendencies" }),
				expValue:   new fields.NumberField({ required: true, integer: true, initial: 0, label: "Experience Value" }),
				expNote:    new fields.StringField({ required: true, initial: "", label: "Experience Note" }),
				// Which hand a shield goes in. His sheet has one handedness field shared by both
				// sheets, set from a race's abilities for a character and left blank for a
				// creature; blank reads as right-handed, which is what his equipShield does with
				// anything that is not exactly "Left".
				handedness: new fields.StringField({ required: true, blank: true, initial: "",
				                choices: ["", "Right", "Left", "Ambidextrous"], label: "Handedness" }),
				// How big it is, from the Master's Manual's size classes (CREATURE_SIZES). His sheet has
				// no such field; every book body line carries one ("Body Type: Huge (quadruped)"), and
				// the errata's hide cap exempts the Titanic. Blank is "not given" -- which every creature
				// made before 2026-09-23 is, so nothing needs migrating and the cap simply applies.
				size:       new fields.StringField({ required: true, blank: true, initial: "",
				                choices: ["", ...CREATURE_SIZES], label: "Size" })
				// DERIVED: title and powerLevel, both of which are simply the level
				// (updateCreatureTitle and updatePowerLevel, sheet-worker.js:178477-178487).
			}),

			// @MARKER ATTRIBUTES
			// The same twelve as a character, and the same saves from the same function. Their
			// maximum works differently: a creature's comes from its level, not from a title.
			attributes: new fields.SchemaField({
				str: attributeField("Strength"),
				agl: attributeField("Agility"),
				vit: attributeField("Vitality"),
				int: attributeField("Intelligence"),
				wis: attributeField("Wisdom"),
				knw: attributeField("Knowledge"),
				app: attributeField("Appearance"),
				chm: attributeField("Charm"),
				soc: attributeField("Social Class"),
				aur: attributeField("Aura"),
				pty: attributeField("Piety"),
				wil: attributeField("Will Force")
			}),

			// @MARKER CHARACTERISTICS
			// Endurance is entered, NOT averaged from the physical attributes the way a
			// character's is -- there is no such formula for a creature anywhere in his code.
			// Shock is entered too, and falls back to Endurance x 3 when left at zero.
			characteristics: new fields.SchemaField({
				endurance:  enteredField("Endurance"),
				perception: calculatedField("Perception"),
				affinity:   calculatedField("Affinity"),
				fortune:    calculatedField("Fortune"),
				shock: new fields.SchemaField({
					entered: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0,
					             label: "Shock" }),          // 0 means "use Endurance x 3"
					immune:  new fields.BooleanField({ required: true, initial: false })
				})
			}),

			// A modifier to Affinity for a creature that has been tamed. His Affinity formula
			// takes it as a plain number (calcAllCreatureCaracs, sheet-worker.js:178413), and it
			// is kept as one here. Modelling the relationship it implies -- who tamed it, how
			// loyal it is -- is deliberately deferred; see docs/DECISIONS.md.
			tameBonus: new fields.NumberField({ required: true, integer: true, initial: 0, label: "Tame Bonus" }),

			// @MARKER RESISTANCES
			resistances: new fields.SchemaField({
				magic:    resistanceField("Magic Resistance"),
				control:  resistanceField("Control Resistance"),
				illusion: resistanceField("Illusion Resistance"),
				poison:   resistanceField("Poison Resistance"),
				disease:  resistanceField("Disease Resistance")
			}),

			// @MARKER BODY AND WOUNDS
			// Wounds are tracked per body area, exactly as for a character, and the same
			// functions do it.
			//
			// bodyChart is the one real difference. A character takes its chart from its race,
			// but a creature's chart is stored and editable: his Configurator seeds it from the
			// body type and then lets areas be added or removed, and "Custom" is itself a body
			// type (sheet-worker.js:22291-22361). So the chart is kept here, and the body type
			// is only used to look one up when this is empty.
			//
			// hide is the creature's rolled-up damage mitigation. His own note on the sheet:
			// "Includes natural hide, force armor, spiritual armor, and all damage mitigation
			// (except worn armor)". It sits here rather than with the characteristics so that
			// the damage pipeline, which reads body.hide for either actor type, needs no change.
			body: new fields.SchemaField({
				bodyType:  new fields.StringField({ required: true, blank: true, initial: "Humanoid",
				               choices: ["", ...CREATURE_BODY_TYPES], label: "Body Type" }),
				bodyChart: new fields.StringField({ required: true, initial: "", label: "Body Chart" }),
				hide:      new fields.NumberField({ required: true, integer: true, initial: 0, min: 0, label: "Hide" }),
				wounds:      new fields.TypedObjectField(new fields.NumberField({ integer: true, min: 0 })),
				armorDamage: new fields.TypedObjectField(new fields.NumberField({ integer: true, min: 0 })),
				// Damage to OVERALL Endurance, on no one area -- a poison's (Master's Manual p.103). It
				// counts in totalWounds and so toward shock, as the character's does.
				overallWounds: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
				// DERIVED: areas, shock, totalWounds, inShock. See _prepareBody.
			}),

			// @MARKER MOVEMENT
			// A creature's movement is an ordered list, not the character's fixed walk / jog /
			// run. His Configurator takes a typed mode name -- "Walk, Jog, Run, Gallop, Scurry,
			// Slither, Fly, etc." -- with three rates each, and asks for them slowest first with
			// special modes at the end (HTML 81003-81007).
			movement: new fields.SchemaField({
				modes: new fields.ArrayField(new fields.SchemaField({
					name:   new fields.StringField({ required: true, initial: "" }),
					hourly: new fields.NumberField({ required: true, initial: 0 }),
					tenSec: new fields.NumberField({ required: true, initial: 0 }),
					oneSec: new fields.NumberField({ required: true, initial: 0 })
				})),
				// @MARKER JUMPS
				// DERIVED since 2026-09-23, from his switch on Agility (setCreatureMovementValues,
				// sheet-worker.js:178893-179003) -- see getCreatureJumps in creature-sheet-rules.mjs.
				// The two fields stay in the schema, as the character's do, and prepareDerivedData
				// writes the worked-out distances over them. Nothing ever showed them as inputs, so a
				// figure stored in one before then is simply no longer read.
				jumpStand: new fields.NumberField({ required: true, initial: 0, label: "Standing Jump" }),
				jumpUp:    new fields.NumberField({ required: true, initial: 0, label: "Jump Up" }),
				// What IS entered: his two temporary jump modifiers (tmp_move_stand_jump_mod_input and
				// tmp_move_up_jump_mod_input), added to the Agility figures. Feet, and may be fractional.
				jumpStandMod: new fields.NumberField({ required: true, initial: 0, label: "Standing Jump Modifier" }),
				jumpUpMod:    new fields.NumberField({ required: true, initial: 0, label: "Jump Up Modifier" })
			}),

			// @MARKER PHYSICAL FEATURES
			physical: new fields.SchemaField({
				heightFeet:   new fields.NumberField({ required: true, integer: true, initial: 0 }),
				heightInches: new fields.NumberField({ required: true, integer: true, initial: 0 }),
				weight:       new fields.NumberField({ required: true, initial: 0 })
			}),

			// @MARKER SKILLS
			// A creature's skills are a name and a flat percentage, which is how the Bestiary
			// prints them and how his sheet stores them (repeating_creatureskills: skill_name and
			// skill_chance, filled from a "Name 45%" list by createAllCreatureSkills,
			// sheet-worker.js:176164). They are NOT recomputed from attributes; doing that would
			// produce different numbers from the printed stat block.
			skills: new fields.ArrayField(new fields.SchemaField({
				name:   new fields.StringField({ required: true, initial: "" }),
				chance: new fields.NumberField({ required: true, integer: true, initial: 0 })
			})),

			// @MARKER COMBAT
			// The attack chart is chosen for the creature rather than worked out. Everything
			// else here is the manual adjustment a Game Master can always reach for, and carries
			// the same field names as a character's so the shared combat code needs no change.
			combat: new fields.SchemaField({
				attackChart: new fields.StringField({ required: true, initial: "None",
				                 choices: CREATURE_ATTACK_CHARTS, label: "Attack Chart" }),
				attackNotes: new fields.StringField({ required: true, initial: "", label: "Attack Notes" }),
				meleeMisc:      new fields.NumberField({ required: true, integer: true, initial: 0 }),
				missileMisc:    new fields.NumberField({ required: true, integer: true, initial: 0 }),
				damageMisc:     new fields.NumberField({ required: true, integer: true, initial: 0 }),
				defenseMisc:    new fields.NumberField({ required: true, integer: true, initial: 0 }),
				initiativeMisc: new fields.NumberField({ required: true, integer: true, initial: 0 }),
				skillMisc:      new fields.NumberField({ required: true, integer: true, initial: 0 }),

				// @MARKER SPEED SECONDS
				// Extra seconds of action every round from a Speed potion, spell, rune or glyph -- his
				// tmp_speed_seconds, the "Speed Seconds" box among his combat modifiers. Set by hand until
				// those effects are built. Each splits one of the round's first seconds in two on the
				// round clock (module/combat/round-rules.mjs); ten at most, with any the initiative
				// roll itself earned below -10.
				speedSeconds:   new fields.NumberField({ required: true, integer: true, initial: 0, min: 0, max: 10 }),

				// @MARKER PAIN THRESHOLD
				// A SIGNED modifier on every point of damage coming in, applied before armour
				// and before anything magical takes its share. His own note beside the field
				// reads "reduces or adds to all incoming damage (-/+)", so a negative number is
				// a tougher target. (sheet-worker.js:71186-71193, and his sheet at line 56643.)
				painThreshold: new fields.NumberField({ required: true, integer: true, initial: 0 }),

				// The Famorian "High Pain Threshold" evoke, worth one further point off. Nothing
				// sets this yet -- the evoke system is a separate piece of work -- but the field
				// exists so a Game Master can tick it and so the evoke has somewhere to land.
				highPainThreshold: new fields.BooleanField({ required: true, initial: false }),

				// @MARKER DAMAGE ABSORPTION
				// A POOL, not a per-blow reduction. It takes what it can off a blow after armour
				// and hide have had theirs, and is spent by the same amount, so it wears out.
				// (sheet-worker.js:71359-71366.) His checkSpiritForceArmorModifiers refills it to
				// the best of a "Rune Absorption: +N" on worn armour and the Game Master's own
				// modifier whenever equipment changes; runes are a deferred subsystem, so for now
				// the pool is entered and spent by hand.
				damageAbsorb: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

				// @MARKER MAGICAL PROTECTION
				// These all come off a blow BEFORE any worn armour is asked to block it, in the
				// order his handler applies them (sheet-worker.js:71249-71272). They subtract
				// rather than scale, and each is the BEST of what worn magic items grant and the
				// Game Master's own modifier rather than a sum of them -- which is what his
				// checkSpiritForceArmorModifiers (line 106966) works out. The items that grant
				// them are named by the deferred magic subsystems, so for now these are entered
				// by hand.
				spiritArmor:  new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				forceArmor:   new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				outerKinetic: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				magicShield:  new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

				// Invulnerability scales rather than subtracts: a weapon with no magical plus
				// does nothing at all, +1/+2 a quarter, +3/+4 a half, +5 and better full damage.
				invulnerable: new fields.BooleanField({ required: true, initial: false }),

				// @MARKER SITUATION MODS
				// The same Situation Mods a character has -- his creature combat page carries the
				// same bar and the same two panels (change_situation_mods2). See the character model.
				situation: new fields.SchemaField({
					// blank: true outright -- see the character model.
					kind:     new fields.StringField({ required: true, blank: true, initial: "", choices: ["", "melee", "missile"] }),
					selected: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),
					weaponId: new fields.StringField({ required: true, initial: "" })
				})
			}),

			// @MARKER MARTIAL ARTS
			// The same martial section a character has: his creature sheet carries it too, reading
			// Martial Knowledge and Martial Lore off the creature's own skill list
			// (getCreatureSkillChance, sheet-worker.js). The same fields and names as the character's,
			// so the one panel partial serves both. See the character model for what each holds.
			martial: new fields.SchemaField({
				discipline:       new fields.StringField({ required: true, blank: true, initial: "",
					choices: ["", ...MARTIAL_DISCIPLINE_NAMES] }),
				learnedAttacks:   new fields.StringField({ required: true, blank: true, initial: "" }),
				learnedBlocks:    new fields.StringField({ required: true, blank: true, initial: "" }),
				learnedHolds:     new fields.StringField({ required: true, blank: true, initial: "" }),
				learnedMoves:     new fields.StringField({ required: true, blank: true, initial: "" }),
				learnedThrows:    new fields.StringField({ required: true, blank: true, initial: "" }),
				loreValues:       new fields.StringField({ required: true, blank: true, initial: "" }),
				stances:          new fields.StringField({ required: true, blank: true, initial: "" }),
				masteredStances:  new fields.StringField({ required: true, blank: true, initial: "" }),
				activeStance:     new fields.StringField({ required: true, blank: true, initial: "" }),
				activeMoves:      new fields.StringField({ required: true, blank: true, initial: "" }),
				activeLoreValues: new fields.StringField({ required: true, blank: true, initial: "" }),
				intoxication:     new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
				resistingHold:    new fields.BooleanField({ required: true, initial: false })
			}),

			// @MARKER NOTES
			notes:     new fields.StringField({ required: true, initial: "", label: "Notes" }),
			biography: new fields.HTMLField({ required: true, initial: "" })
		};
	}

	//==========================================================================================
	// @MARKER BASE DATA
	//==========================================================================================
	// Everything an Active Effect may target has to exist by the end of this step, because
	// effects are applied between prepareBaseData and prepareDerivedData. The target is
	// attributes.<attr>.value, as it is for a character.
	prepareBaseData() {
		super.prepareBaseData(); // required: skipping this silently breaks two-phase effects

		for (const tmpkey of Object.keys(this.attributes)) {
			var tmpattrib = this.attributes[tmpkey];
			tmpattrib.value = tmpattrib.rating + tmpattrib.permMod + tmpattrib.tempMod;
		}
	}

	//==========================================================================================
	// @MARKER DERIVED DATA
	//==========================================================================================
	prepareDerivedData() {
		super.prepareDerivedData();

		// Attributes come first. Identity's memorization points read the Knowledge table's figure,
		// which only exists once the attribute tables have been looked up. The cap those lookups
		// need comes from the stored level, not from anything derived here, so this order is safe.
		this._prepareAttributes();
		this._prepareIdentity();
		this._prepareCharacteristics();
		this._prepareResistances();
		this._prepareEncumbrance();
		this._prepareCombat();
		// Martial arts after the standing combat figures it adds to, and before the Situation Mods,
		// which read the blind fighting it sets -- the character's order.
		this._prepareMartialArts();
		this._prepareSituation();
		this._prepareBody();
		this._prepareMovement();
		this._prepareAvailability();

		// NOT YET IMPLEMENTED, and deliberately so rather than guessed at:
		//   ability effects      -- his creature path only ever shows an ability's description.
		//                           The few that do something (Enhanced Perception and the
		//                           senses) are handled in _prepareCharacteristics because his
		//                           code handles exactly those. Everything else is text, which
		//                           is a faithful port and not an oversight. See
		//                           UPSTREAM-ISSUES.md item 10.
		//   power resolution     -- a Power is an innate spell or invocation, and using one needs
		//                           the spell and invocation engine, which is the deferred magic
		//                           phase. Powers are carried and listed, not resolved.
		//   evoke body mutations -- the Famorian and Evoked body types build their chart from
		//                           toggles at runtime. Shared gap with the character model.
		//   movement modifiers   -- his modifiers page also takes a temporary modifier per movement
		//                           mode (tmp_walk_mod_input and its siblings, 178836). A creature's
		//                           modes are its own named list here, not his fixed four slots, so
		//                           the rates are edited directly instead. Jumps ARE derived; see
		//                           _prepareMovement.
	}

	// This is the function which fills in the values that follow from the creature's level.
	// His sheet keeps three separate fields that are all just the level: the practitioner title
	// every skill uses, the level every Power is cast at, and the level itself.
	_prepareIdentity() {
		var tmplevel = parseInt(this.identity.level) || 0;
		this.identity.title = tmplevel;
		this.identity.powerLevel = tmplevel;

		// Memorization points, from updateCreatureMemPoints (sheet-worker.js:178462): three per
		// level, multiplied by the Knowledge table's points figure.
		var tmpknw = this.attributes.knw.mods ?? {};
		this.identity.memorizationPoints = (tmplevel * 3) * (parseInt(tmpknw.memorizationPoints) || 0);
	}

	// This is the function which sets each attribute's maximum, its save and its table modifiers.
	//
	// The maximum comes from the creature's level and nothing else -- there is no race to impose
	// a stricter one. His sheet also sets a separate magical maximum to the same number; nothing
	// in the port distinguishes the two yet, so it is not carried as its own field.
	_prepareAttributes() {
		var tmpcap = ImagineCreatureData.getCreatureAttributeCap(this.identity.level);

		for (const tmpkey of Object.keys(this.attributes)) {
			var tmpattrib = this.attributes[tmpkey];

			tmpattrib.max = tmpcap;
			if (tmpattrib.value > tmpcap) { tmpattrib.value = tmpcap; }
			if (tmpattrib.value < 0) { tmpattrib.value = 0; }

			// The same save function a character uses. Kept in one place rather than copied.
			tmpattrib.save = ImagineCharacterData.getAttribSave(tmpattrib.value);

			var tmptable = ATTRIBUTE_TABLES[tmpkey];
			tmpattrib.mods = (tmptable && tmptable[tmpattrib.value]) ? tmptable[tmpattrib.value] : {};
		}

		// Strength's melee to-hit and melee damage, NEVER BELOW 0 for a creature -- his changeAttribs
		// (sheet-worker.js:29694-29697), which floors them as it sets str_melee_attack and
		// str_melee_damage themselves, so his creature page shows the 0 as well:
		//
		//     tmpSTRtoHitMelee=setIntLowBounds(tmpSTRtoHitMelee, 0);   // low STR is already factored into
		//                                                               // creature to hit melee modifiers.
		//     tmpSTRMeleeDamage=setIntLowBounds(tmpSTRMeleeDamage, 0); // low STR is already factored into
		//                                                               // creature melee damage modifiers.
		//
		// A weak creature's bite is already small on its stat block; the Strength table's penalty would
		// count its weakness twice. The bestiaries print the same: a badger of Strength 7 is "Melee +0,
		// Damage +0" (Aspects of the Wild), where the table gives -2 and -4. His test there reads the worker
		// global tmpCreatureType, which changeAttribs fetches creature_type for but never assigns
		// (29648) -- other creature handlers set it -- and his comments leave no doubt what it is for
		// (recorded for him in docs/UPSTREAM-ISSUES.md item 92, so the variable can be set there).
		// Everything built on these takes the floor with them: combat.meleeAttack and meleeDamage, so the
		// natural attack's to-hit and damage, and a creature's martial attacks (martial-attack.mjs reads the
		// same two). A copy is floored, never the shared table row. A character keeps the table's signed
		// figures (actor-character.mjs).
		var tmpstrrow = this.attributes.str?.mods;
		if (tmpstrrow) {
			this.attributes.str.mods = { ...tmpstrrow,
				meleeAttack: Math.max(0, parseInt(tmpstrrow.meleeAttack) || 0),
				meleeDamage: Math.max(0, parseInt(tmpstrrow.meleeDamage) || 0) };
		}
	}

	// This is the function which works out the four characteristics.
	// Ported from calcAllCreatureCaracs (sheet-worker.js:178346), which the creature-finish
	// handler repeats verbatim.
	//
	//     Endurance  = entered + its modifier                       (no formula at all)
	//     Shock      = entered, or Endurance x 3 when left at zero, or Immune
	//     Perception = average(INT WIS KNW) + level
	//     Affinity   = average(APP CHM SOC) + level x 2             (x2, not x1)
	//     Fortune    = average(AUR PTY WIL) + level
	//
	// Two details that are easy to get wrong, both as his code has them:
	//   - Affinity averages only APP and CHM when Social Class is 0, on the grounds that a
	//     creature outside society has no social standing to average in.
	//   - All three averages use the creature's OWN RATINGS rather than its modified values, so
	//     a temporary change to an attribute does not move them. A character works the other way.
	//     This is faithful to his sheet; making effects cascade would be a one-line change here.
	_prepareCharacteristics() {
		var tmpattribs = this.attributes;
		var tmplevel = parseInt(this.identity.level) || 0;

		// Endurance: entered, plus its manual modifier.
		var tmpend = this.characteristics.endurance;
		tmpend.base = parseInt(tmpend.entered) || 0;
		tmpend.value = tmpend.base + (parseInt(tmpend.tempMod) || 0);

		// Shock. The fallback uses the entered Endurance, before the modifier, as his does.
		var tmpshock = this.characteristics.shock;
		var tmpshockentered = parseInt(tmpshock.entered) || 0;
		this.body.shock = tmpshock.immune ? 0 : (tmpshockentered || (tmpend.base * 3));
		tmpshock.value = tmpshock.immune ? null : this.body.shock;

		// The ability and skill names his checks look at.
		var tmpabilities = this._getTraitNames("ability");
		var tmpskilltext = this.skills.map(s => String(s.name ?? "")).join(",");

		// Perception.
		var tmpper = parseInt(((tmpattribs.int.rating + tmpattribs.wis.rating + tmpattribs.knw.rating) / 3) + 0.99) || 0;
		tmpper = tmpper + tmplevel;
		if (tmpabilities.join(",").includes("Enhanced Perception")) { tmpper = tmpper + 10; }
		if (tmpskilltext.includes("Smell"))      { tmpper = tmpper + 5; }
		if (tmpskilltext.includes("Listen"))     { tmpper = tmpper + 5; }
		var tmphaslifesense = false;
		if (tmpskilltext.includes("Life Sense")) { tmpper = tmpper + 5; tmphaslifesense = true; }

		// Every special sense is worth +5, and life sense is only ever counted once however it
		// is spelled.
		for (const tmpability of tmpabilities) {
			var tmpislife = (tmpability == "Sense(Life)" || tmpability == "Life Sense" || tmpability == "Life Sensing");
			if (!tmphaslifesense && tmpislife) {
				tmpper = tmpper + 5;
				tmphaslifesense = true;
			} else if (!tmpislife && (tmpability.includes("Sense") || tmpability.includes("Sensing"))) {
				tmpper = tmpper + 5;
			}
		}

		// Affinity.
		var tmpaff = 0;
		if (tmpattribs.soc.rating > 0) {
			tmpaff = parseInt(((tmpattribs.app.rating + tmpattribs.chm.rating + tmpattribs.soc.rating) / 3) + 0.99) || 0;
		} else {
			tmpaff = parseInt(((tmpattribs.app.rating + tmpattribs.chm.rating) / 2) + 0.99) || 0;
		}
		tmpaff = tmpaff + (tmplevel * 2);
		if (tmpabilities.join(",").includes("Enhanced Affinity")) { tmpaff = tmpaff + 10; }
		tmpaff = tmpaff + (parseInt(this.tameBonus) || 0);

		// Fortune.
		var tmpfor = parseInt(((tmpattribs.aur.rating + tmpattribs.pty.rating + tmpattribs.wil.rating) / 3) + 0.99) || 0;
		tmpfor = tmpfor + tmplevel;
		if (tmpabilities.join(",").includes("Enhanced Fortune")) { tmpfor = tmpfor + 10; }

		this._setCalculated("perception", tmpper);
		this._setCalculated("affinity", tmpaff);
		this._setCalculated("fortune", tmpfor);
	}

	// This is the function which stores one calculated characteristic and its modifier.
	_setCalculated(tmpname, tmpbase) {
		var tmpchar = this.characteristics[tmpname];
		tmpchar.base = tmpbase;
		tmpchar.value = tmpbase + (parseInt(tmpchar.tempMod) || 0);
	}

	// This is the function which resolves the five resistances.
	// Ported from calcAllCreatureResists (sheet-worker.js:178273): the entered percentage plus a
	// temporary and a permanent modifier, or Immune outright.
	//
	// There is no attribute table in this at all, which is the sharpest break from a character.
	// His code also adds a flat +20 to Control, Poison or Disease for certain evoke and immunity
	// flags; those flags are only ever set on the character side, never for a creature, so they
	// are not ported here. See UPSTREAM-ISSUES.md item 10.
	_prepareResistances() {
		for (const tmpkey of Object.keys(this.resistances)) {
			var tmpresist = this.resistances[tmpkey];
			tmpresist.base = parseInt(tmpresist.entered) || 0;
			tmpresist.value = tmpresist.immune
				? null
				: tmpresist.base + (parseInt(tmpresist.tempMod) || 0) + (parseInt(tmpresist.permMod) || 0);
		}
	}

	// This is the function which separates what is worn into the four armour layers and the
	// shields over them. A shield covers a run of areas down one side rather than a single slot,
	// and his sheet keeps it in a fifth layer of its own, so the two are totalled separately and
	// a shield must not also be counted as ordinary armour -- its armour value sits in the
	// left-hand column whichever hand holds it, so counting it twice would armour the wrong hand.
	_getWornShields() {
		return this._getWornArmor().filter(tmpitem => tmpitem.system.isShield);
	}

	// This is the function which works out the creature's standing combat numbers.
	//
	// The attack chart is taken as chosen. Where a character's comes from a class progression and
	// a title, a creature's is simply what its stat block says (setCreatureAttackSkillValues,
	// sheet-worker.js:178489). A creature that knows Weapon Lore or Missile Lore also gets the
	// chart one step up for those weapons, as his code does.
	_prepareCombat() {
		var tmpaglmods = this.attributes.agl.mods ?? {};
		var tmpintmods = this.attributes.int.mods ?? {};
		var tmpstrmods = this.attributes.str.mods ?? {};

		var tmparmorinit = 0;
		var tmparmordef = 0;
		var tmparmorspeed = 0;
		var tmparmorskills = 0;
		for (const tmpitem of this._getWornArmor()) {
			var tmppen = tmpitem.system.penalties ?? {};
			tmparmorinit   = tmparmorinit   + (parseInt(tmppen.initiative) || 0);
			tmparmordef    = tmparmordef    + (parseInt(tmppen.defense) || 0);
			tmparmorspeed  = tmparmorspeed  + (parseInt(tmppen.speed) || 0);
			tmparmorskills = tmparmorskills + (parseInt(tmppen.skills) || 0);
		}

		this.combat.attackSkill = this.combat.attackChart;

		// Which handedness an off-hand attack is judged against. The Ambidextrous, Fully
		// Ambidextrous and Omnidextrous abilities all grant the same exemption isOffhandWeapon
		// reads as "Ambidextrous" -- his creature ability dictionary gives all three the identical
		// "10 seconds and no penalties" description, just over a different span of limbs -- and
		// the ability applies regardless of what the stored handedness says, since that field is
		// only ever about which side a shield covers (see the note above _prepareBody). Absent the
		// ability, the stored handedness stands, blank reading as right-handed as it does there.
		var tmpabilities = this._getTraitNames("ability").join(",");
		var tmpisambidextrous = tmpabilities.includes("Ambidextrous") || tmpabilities.includes("Omnidextrous");
		this.combat.offhandHandedness = tmpisambidextrous ? "Ambidextrous" : (this.identity.handedness || "");

		// How many of the round's seconds its off hand has, as a character's: five, or ten for the
		// ambidextrous. A creature holds no Second Weapon Lore to add to it. The round clock spends
		// it (module/combat/round-rules.mjs).
		this.combat.offhandSecondsCap = getOffhandSecondsCap(this.combat.offhandHandedness, 0);

		// The Lore chart, one step better, for a creature that has the skill for it.
		var tmpskilltext = this.skills.map(s => String(s.name ?? "")).join(",");
		this.combat.hasWeaponLore = tmpskilltext.includes("Weapon Lore");
		this.combat.hasMissileLore = tmpskilltext.includes("Missile Lore");
		this.combat.loreAttackSkill = (this.combat.hasWeaponLore || this.combat.hasMissileLore)
			? getNextAttackSkill(this.combat.attackChart)
			: "";

		this.combat.initiativeMod = getInitiativeModifier(
			tmpaglmods.initiativeAdjust, tmpintmods.initiativeAdjust,
			tmparmorinit + (parseInt(this.combat.initiativeMisc) || 0));

		this.combat.defensiveAdjust = (parseInt(tmpaglmods.defensiveAdjust) || 0)
		                            + tmparmordef + (parseInt(this.combat.defenseMisc) || 0);

		this.combat.weaponSpeedMod = (parseInt(tmpstrmods.weaponSpeed) || 0)
		                           + (parseInt(tmpaglmods.weaponSpeed) || 0) + tmparmorspeed;

		// Strength's two melee figures, already floored at 0 for a creature (_prepareAttributes, his
		// changeAttribs at sheet-worker.js:29694-29697).
		this.combat.meleeAttack   = parseInt(tmpstrmods.meleeAttack) || 0;
		this.combat.meleeDamage   = parseInt(tmpstrmods.meleeDamage) || 0;
		this.combat.missileAttack = parseInt(tmpaglmods.missileAttack) || 0;
		this.combat.armorSkillPenalty = tmparmorskills;

		// @MARKER CREATURE DAMAGE BONUS
		// The creature's standing damage figure, his combat_mod_damage (setCombatModifierValues,
		// sheet-worker.js:82167, the damage lines at 82309-82322):
		//
		//     Strength's melee damage   off the Strength table, floored at 0 for a creature (29697,
		//                               _prepareAttributes)
		//     body weight               getWeightDamageAdjust, floored at 0 for a creature (82173)
		//     Weapon Lore               +4 while the creature holds the skill (82262-82290)
		//     the temporary modifier    combat.damageMisc, his tmp_damage_mod
		//
		// His handleCreatureAttack adds it to every natural attack but a Touch (179920-179929). Before
		// 2026-09-23 the port gave a creature none of it, on a misreading that "the dice on the stat block
		// are the whole of it" -- the books' own stat lines print "Damage +17" for a 1,200 lb buffalo of
		// Strength 19, which is 5 + 12. See the CORRECTION in docs/DECISIONS.md, 2026-09-23.
		//
		// Both of the first two parts stop at 0, so a weak, light creature's attack does its dice and no
		// less, until a temporary modifier says otherwise. (The creature audit's D3 once read his
		// formula as keeping a NEGATIVE Strength figure -- Badger, Strength 7, -4. It missed the floor at
		// 29694-29697, which _prepareAttributes now applies. Corrected 2026-09-23 before it shipped.)
		this.combat.weightDamage = getWeightDamageAdjust(this.physical?.weight, true);

		// Weapon Lore and Missile Lore, held at all, are worth the general figures (LORE_GENERAL): +2 to
		// hit and +4 damage for Weapon Lore, +2 to hit for Missile Lore, which his creature branch puts in
		// combat_mod_melee_other and combat_mod_missile_other (82262-82307). A creature has no list of
		// lored weapons, so the specific tier never applies. His test is the creature's own chance for
		// the skill by its EXACT name (getCreatureSkillChance, 178814) and its level standing as the
		// title against an acquisition level of 1 -- "(currentTitle+1)>whenWeaponLoreAcquired" -- so a
		// level 0 creature holding the skill gets nothing from it. Closes the gap left open in
		// docs/DECISIONS.md 2026-09-14, "Lore corrections, item 1 done; item 2 turned out to be a real
		// gap" ("his sheet applies a real numeric Weapon/Missile Lore bonus to creature attacks").
		var tmplevel = parseInt(this.identity.level) || 0;
		var tmpweaponlore = (this._getCreatureSkillChance("Weapon Lore") > 0) && hasLore(tmplevel, 1);
		var tmpmissilelore = (this._getCreatureSkillChance("Missile Lore") > 0) && hasLore(tmplevel, 1);
		this.combat.loreMelee   = tmpweaponlore  ? LORE_GENERAL.attack : 0;
		this.combat.loreDamage  = tmpweaponlore  ? LORE_GENERAL.damage : 0;
		this.combat.loreMissile = tmpmissilelore ? LORE_GENERAL.attack : 0;

		this.combat.damageBonus = this.combat.meleeDamage + this.combat.weightDamage + this.combat.loreDamage
		                        + (parseInt(this.combat.damageMisc) || 0);
	}

	// @MARKER MARTIAL ARTS
	// This is the function which works out the creature's martial arts, the same as a character's
	// (deriveMartialArts) but for where the two skills come from: a creature's flat stat-block
	// percentages, as his creature branch reads them (getCreatureSkillChance -- set2ndWeaponKnowSheet
	// and its siblings treat a creature holding the skill at all as having acquired it, with no title
	// to reach). A stance's defence, initiative and speed fold into the creature's standing figures as
	// a character's do; its bonuses land on saves and resistances here and on a skill when it is
	// rolled, since a creature's skill chances are the entered figures themselves and cannot carry a
	// derived bonus without the sheet writing it back.
	_prepareMartialArts() {
		var tmpmartial = this.martial ?? {};
		this.martial = tmpmartial;
		var tmpknowchance = this._getCreatureSkillChance("Martial Knowledge");
		var tmplorechance = this._getCreatureSkillChance("Martial Lore");
		var tmpknow = { held: tmpknowchance > 0, chance: tmpknowchance };
		var tmplore = { held: tmplorechance > 0, chance: tmplorechance };
		tmpmartial.hasKnowledge = tmpknow.held;
		tmpmartial.hasLore = tmplore.held;
		tmpmartial.knowChance = tmpknow.chance;
		tmpmartial.loreChance = tmplore.chance;

		Object.assign(tmpmartial, deriveMartialArts(tmpmartial, {
			know: tmpknow, lore: tmplore, weaponSpeedMod: this.combat.weaponSpeedMod }));

		var tmpstate = tmpmartial.state;
		this.combat.defensiveAdjust = (parseInt(this.combat.defensiveAdjust) || 0) + tmpstate.defense.adjust;
		this.combat.initiativeMod = (parseInt(this.combat.initiativeMod) || 0) + tmpstate.initiative;
		this.combat.weaponSpeedMod = (parseInt(this.combat.weaponSpeedMod) || 0) + tmpstate.seconds;
		this.combat.martialDefense = tmpstate.defense;
		this.combat.martialBlind = tmpstate.blind;

		// A held stance's saves and resistances (the user's ruling of 2026-09-22). An immune
		// resistance has no figure and stays immune.
		var tmpbonuses = tmpstate.bonuses;
		if (tmpbonuses?.active) {
			for (const [tmpkey, tmpvalue] of Object.entries(tmpbonuses.saves ?? {})) {
				if (this.attributes[tmpkey]) { this.attributes[tmpkey].save = (parseInt(this.attributes[tmpkey].save) || 0) + tmpvalue; }
			}
			for (const [tmpname, tmpresist] of Object.entries(this.resistances ?? {})) {
				if (tmpresist?.value === null || tmpresist?.value === undefined) { continue; }
				var tmpresistadd = (parseInt(tmpbonuses.resistances?.[tmpname]) || 0) + (parseInt(tmpbonuses.allResistances) || 0);
				if (tmpresistadd) { tmpresist.value = tmpresist.value + tmpresistadd; }
			}
		}
	}

	// This is the function which reads one skill's chance off the creature's stat block, 0 if it has
	// no such skill -- his getCreatureSkillChance.
	_getCreatureSkillChance(tmpname) {
		var tmpskill = (this.skills ?? []).find(tmpentry => String(tmpentry.name ?? "").trim() == tmpname);
		return tmpskill ? (parseInt(tmpskill.chance) || 0) : 0;
	}

	// This is the function which totals the Situation Mods the creature has set. Their defence is
	// the creature's own and stands whatever it attacks with; "No Defense" takes the adjustment away
	// from anyone attacking it. Martial arts hands in blind fighting through combat.martialBlind, and
	// Immoveable Stance's No Defense is folded in, as for a character.
	_prepareSituation() {
		var tmpsituation = this.combat.situation ?? {};
		this.combat.situational = resolveSituationalMods(tmpsituation.kind, tmpsituation.selected,
			this.combat.martialBlind ?? null);
		this.combat.defensiveAdjust = (parseInt(this.combat.defensiveAdjust) || 0) + this.combat.situational.defense;
		this.combat.noDefense = this.combat.situational.noDefense || !!this.combat.martialDefense?.noDefense;
	}

	// This is the function which lays out the creature's body: every area of its chart, with its
	// Endurance, its wounds, the armour over it and what state it is in.
	//
	// The chart is the creature's own stored one where it has it, and the stock chart for its body
	// type otherwise. Everything after that is the same arithmetic a character uses.
	_prepareBody() {
		var tmpendurance = this.characteristics.endurance.value;
		var tmpvitality = this.attributes.vit.value;
		var tmpworn = this._getWornArmor().filter(tmpitem => !tmpitem.system.isShield);
		var tmpshields = this._getWornShields();
		var tmphandedness = this.identity.handedness;
		var tmpwounds = this.body.wounds ?? {};
		var tmparmordamage = this.body.armorDamage ?? {};

		// A stored chart wins. Only fall back to the body type's stock chart when there is none,
		// which is also what happens for a body type of "Custom" that has not been built yet.
		// The body type still decides which armour slots cover which area, even when the chart
		// itself was built by hand.
		var tmpbodytype = this.body.bodyType || "Humanoid";
		var tmpchart = String(this.body.bodyChart ?? "").trim();
		var tmpareadefs = tmpchart ? parseBodyChart(tmpchart) : getBodyChart(tmpbodytype);

		var tmpareas = [];
		var tmptotal = 0;
		for (const tmparea of tmpareadefs) {
			var tmpend = getAreaEndurance(tmpendurance, tmparea.multiplier);
			var tmphurt = parseInt(tmpwounds[tmparea.name]) || 0;
			tmptotal = tmptotal + tmphurt;

			// Which slot covers an area depends on the body type, and a few areas take armour
			// only from a named kind -- barding on a centaur or an arachen. See getAreaArmorSlot.
			// A creature's body type is far more likely than a character's to be one his code
			// wrote no branch for, in which case nothing worn protects it, as in his sheet.
			var tmpcover = getAreaArmor(tmpbodytype, tmparea.name, tmpworn);
			var tmparmor = tmpcover.armor;
			var tmpmaterials = tmpcover.materials;
			var tmplayers = tmpcover.layers;
			var tmpslot = tmpcover.slot;
			var tmpdamaged = parseInt(tmparmordamage[tmparea.name]) || 0;
			tmparmor = Math.max(0, tmparmor - tmpdamaged);

			// A shield is the fifth layer, added on top of the worn armour and untouched by the
			// damage that armour has taken -- his sheet tracks it in its own layer and clears it
			// wholesale when the shield comes off, rather than degrading it area by area.
			var tmpshielded = getAreaShield(tmpbodytype, tmparea.name, tmpshields, tmphandedness);
			tmparmor = tmparmor + tmpshielded.armor;

			var tmpstate = "sound";
			if (tmphurt > tmpend + tmpvitality) { tmpstate = "effect"; }
			else if (tmphurt > tmpend)          { tmpstate = "vitalitySave"; }
			else if (tmphurt > 0)               { tmpstate = "wounded"; }

			tmpareas.push({
				name: tmparea.name,
				type: tmparea.type,
				multiplier: tmparea.multiplier,
				endurance: tmpend,
				wounds: tmphurt,
				armor: tmparmor,
				armorDamage: tmpdamaged,
				material: getStrongestMaterial(tmpmaterials),
				layers: tmplayers.concat(tmpshielded.layers),
				shield: tmpshielded.armor,
				shieldLayers: tmpshielded.layers,
				protectedByArmor: !!tmpslot || tmpshielded.armor > 0,
				state: tmpstate
			});
		}

		this.body.type = this.body.bodyType;
		this.body.areas = tmpareas;
		// The areas' wounds, and whatever has been done to overall Endurance besides (a poison's).
		this.body.totalWounds = tmptotal + (parseInt(this.body.overallWounds) || 0);
		this.body.inShock = (this.body.shock != 0) && (this.body.totalWounds > this.body.shock);

		// @MARKER TOKEN BAR
		// What a token's resource bar draws, Shock less the total wounds: see getShockBar. Registered
		// as the bar attribute "body.shockBar" in imagine-rpg.mjs (CONFIG.Actor.trackableAttributes),
		// the same path on a character.
		this.body.shockBar = getShockBar(this.body.shock, this.body.totalWounds);

		// @MARKER HIDE CAP
		// His errata's cap, 5 x level (level 0 as 1), with plants and the Titanic exempt: see HIDE_CAP
		// in creature-tables.mjs. WARNED about, not enforced -- hide stays exactly what was entered, and
		// the sheet flags the excess (the provisional D4 of the creature audit). hideMax is null for an
		// exempt creature.
		this.body.hideMax = getCreatureHideMax(this.identity.level, this.identity.creatureType, this.identity.size);
		this.body.hideOverCap = (this.body.hideMax !== null) && ((parseInt(this.body.hide) || 0) > this.body.hideMax);
	}

	// This is the function which works out the creature's two jump distances from its Agility, his
	// setCreatureMovementValues switch (sheet-worker.js:178893-179003), plus its two jump modifiers.
	// The worked-out distances are written over the stored jumpStand and jumpUp, as the character's
	// are. See getCreatureJumps in creature-sheet-rules.mjs.
	//
	// His rebuild of the movement list in the same function writes each mode's hourly figure into its
	// one-second slot and writes the modified list back as the base, so the modifiers are added again
	// on every recalculation (178866-178891). Neither is reproduced: the modes are the creature's own
	// list and are edited directly. Both are recorded for him in docs/UPSTREAM-ISSUES.md item 94.
	_prepareMovement() {
		var tmpmove = this.movement;
		var tmpjumps = getCreatureJumps(this.attributes.agl.value, tmpmove.jumpStandMod, tmpmove.jumpUpMod);
		tmpmove.jumpStandBase = tmpjumps.baseStand;
		tmpmove.jumpUpBase = tmpjumps.baseUp;
		tmpmove.jumpStand = tmpjumps.stand;
		tmpmove.jumpUp = tmpjumps.up;
	}

	// This is the function which totals what the creature is carrying and how encumbered it is.
	// Same rule as a character: the Strength table's load limit times its own body weight, with
	// the bands at a quarter, half, three quarters and the whole of it. His creature recalculation
	// calls the same calcEncumbrance (checkAllCreatureValues, sheet-worker.js:178196).
	//
	// The arithmetic -- bands, size scaling of armour and gear, magical-plus weight reduction --
	// is resolveEncumbrance in combat-rules.mjs, the one port of his one calcEncumbrance.
	_prepareEncumbrance() {
		var tmpphys = this.physical ?? {};
		var tmpinches = ((parseInt(tmpphys.heightFeet) || 0) * 12) + (parseInt(tmpphys.heightInches) || 0);
		this.encumbrance = resolveEncumbrance(this.parent?.items,
			this.attributes.str.mods?.loadLimit, tmpphys.weight, tmpinches);
	}

	// This is the function which flags every item on the creature that the campaign's content
	// switches currently disallow. Items are flagged, never removed -- as for a character.
	_prepareAvailability() {
		var tmpactor = this.parent;
		if (!tmpactor || !tmpactor.items) { return; }

		var tmprules = game.imagine.getAvailabilityRules();
		for (const tmpitem of tmpactor.items) {
			var tmpresult = explainAvailability(tmpitem, tmprules);
			tmpitem.system.available = tmpresult.available;
			tmpitem.system.unavailableReason = tmpresult.reason;
		}
	}

	//==========================================================================================
	// @MARKER GENERAL PURPOSE FUNCTIONS
	//==========================================================================================

	// This is the function which returns the armour the creature is actually wearing. A creature
	// can wear armour -- his sheet gives it an equipment tab of its own -- though most do not.
	_getWornArmor() {
		var tmpactor = this.parent;
		if (!tmpactor || !tmpactor.items) { return []; }
		var tmpworn = [];
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type == "armor" && tmpitem.system.location == "equipped") { tmpworn.push(tmpitem); }
		}
		return tmpworn;
	}

	// This is the function which returns the names of the creature's traits of one category --
	// ability, disability or immunity.
	_getTraitNames(tmpcategory) {
		var tmpactor = this.parent;
		if (!tmpactor || !tmpactor.items) { return []; }
		var tmpnames = [];
		for (const tmpitem of tmpactor.items) {
			if (tmpitem.type == "trait" && tmpitem.system.category == tmpcategory) {
				tmpnames.push(String(tmpitem.name ?? ""));
			}
		}
		return tmpnames;
	}

	// This is the function which returns the highest attribute rating a creature may reach.
	// Ported from handleCreatureFinish (sheet-worker.js:174723).
	//
	// Note this is NOT the character rule. A character's cap comes from its title in four tiers;
	// a creature's comes from its level in three, and the numbers differ (28 has no character
	// equivalent). The difference is recorded in UPSTREAM-ISSUES.md item 8 as a question for him,
	// but it is his code, so it is what the port does.
	static getCreatureAttributeCap(tmpLevel) {
		var tmpLevelValue = parseInt(tmpLevel) || 0;
		if (tmpLevelValue < 10) { return 25; }
		if (tmpLevelValue < 15) { return 28; }
		return 30;
	}

	// This is the function which reads a skill list as his data writes it -- "Ambush 45%, Blend
	// 30%" -- into name and chance pairs. Kept here so a stat block can be typed or pasted in one
	// field rather than row by row. Ported from createAllCreatureSkills (sheet-worker.js:176164).
	static parseSkillList(tmpText) {
		var tmpout = [];
		for (const tmpentry of String(tmpText ?? "").split(",")) {
			var tmptrimmed = tmpentry.trim();
			if (tmptrimmed == "" || tmptrimmed == "None") { continue; }
			var tmpmatch = tmptrimmed.match(/[0-9]+/);
			var tmpchance = tmpmatch ? (parseInt(tmpmatch[0]) || 0) : 0;
			var tmpname = tmptrimmed.replace(`${tmpchance}%`, "").trim();
			tmpout.push({ name: tmpname, chance: tmpchance });
		}
		return tmpout;
	}

	// @MARKER ADD NEW creature data model functions HERE
}
// @END (CODE)
