// @START (CODE)
// @MARKER TEMPORARY MODIFIERS VIEW
//==================================================================================================================
// What the Temporary Modifiers window shows: his panel's rows, worked out from the actor's derived system data.
// Nothing here needs Foundry, so the test renders the same template against the same view.
//
// A box is { field, value } where value is what the actor holds now; a figure is shown beside it as he shows
// "Mundane Modifiers" and the rest. The window keeps what has been typed and not yet SET itself (its #working),
// so nothing is read back into the boxes here except the states that are ticks and dropdowns.
//==================================================================================================================

import { ATTRIBUTE_KEYS, CHARACTERISTIC_KEYS, RESISTANCE_KEYS, FATIGUE_TABLE, splitEffects,
         getFatigueLevelValues, TEMP_SPECIAL_TYPES, TEMP_SPECIAL_LABELS } from "./temp-mods-rules.mjs";

const ATTRIBUTE_LABELS = { str: "STR", agl: "AGL", vit: "VIT", int: "INT", wis: "WIS", knw: "KNW", app: "APP",
                           chm: "CHM", soc: "SOC", aur: "AUR", pty: "PTY", wil: "WIL" };
const CHARACTERISTIC_LABELS = { endurance: "Endurance", perception: "Perception", affinity: "Affinity", fortune: "Fortune" };
const RESISTANCE_LABELS = { magic: "Magic", illusion: "Illusion", control: "Control", poison: "Poison", disease: "Disease" };

function num(tmpvalue) { return parseFloat(tmpvalue) || 0; }
function signed(tmpvalue) { var tmpn = num(tmpvalue); return (tmpn > 0 ? "+" : "") + tmpn; }

// The select 0-10, with the one held marked.
function levelOptions(tmpcurrent) {
	return Array.from({ length: 11 }, (tmpv, tmpi) => ({ value: tmpi, label: "" + tmpi, selected: tmpi == tmpcurrent }));
}

// This is the function which builds the whole view.
//   tmpsys      the actor's derived system data
//   tmplists    { spells, invocations, evokes } -- names for the three dropdowns, from the compendia
export function buildTempModsView(tmpsys, tmplists) {
	var tmpt = tmpsys.tempMods ?? {};
	var tmplist = tmplists ?? {};
	var tmpview = {};

	// @MARKER EFFECT NAMES
	tmpview.effects = splitEffects(tmpsys.magic?.effectList);
	tmpview.hasEffects = tmpview.effects.length > 0;
	tmpview.spellNames = (tmplist.spells ?? []).map(tmpname => ({ name: tmpname }));
	tmpview.invocationNames = (tmplist.invocations ?? []).map(tmpname => ({ name: tmpname }));
	tmpview.evokeNames = (tmplist.evokes ?? []).map(tmpname => ({ name: tmpname }));
	tmpview.removable = tmpview.effects.map(tmpname => ({ name: tmpname }));

	// @MARKER ATTRIBUTES
	// One column per attribute; rows down: the rating now, the two input boxes and the two modifiers held, and the
	// two ceilings, in his order.
	tmpview.attributes = ATTRIBUTE_KEYS.map(tmpk => {
		var tmpa = tmpsys.attributes?.[tmpk] ?? {};
		return { key: tmpk, label: ATTRIBUTE_LABELS[tmpk], current: num(tmpa.value),
			mundaneMod: num(tmpa.tempMod), magicMod: num(tmpt.magicAttr?.[tmpk]),
			max: num(tmpa.max), magicalMax: num(tmpa.magicalMax) };
	});

	tmpview.characteristics = CHARACTERISTIC_KEYS.map(tmpk => {
		var tmpc = tmpsys.characteristics?.[tmpk] ?? {};
		return { key: tmpk, label: CHARACTERISTIC_LABELS[tmpk], current: num(tmpc.value), mod: num(tmpc.tempMod) };
	});

	tmpview.resistances = RESISTANCE_KEYS.map(tmpk => {
		var tmpr = tmpsys.resistances?.[tmpk] ?? {};
		return { key: tmpk, label: RESISTANCE_LABELS[tmpk], current: tmpr.immune ? "Immune" : num(tmpr.value),
			mod: num(tmpr.misc), immune: !!tmpr.immune };
	});

	// @MARKER MOVEMENT
	var tmpmove = tmpsys.movement ?? {};
	var tmprate = (tmpm) => tmpm ? `${num(tmpm.hourly)}/${num(tmpm.tenSec)}/${num(tmpm.oneSec)}` : "0/0/0";
	tmpview.movement = {
		rows: [
			{ field: "walk", label: "Walk", current: tmprate(tmpmove.walk), mod: num(tmpt.walk), scaled: true },
			{ field: "jog",  label: "Jog",  current: tmprate(tmpmove.jog),  mod: num(tmpt.jog),  scaled: true },
			{ field: "run",  label: "Run",  current: tmprate(tmpmove.run),  mod: num(tmpt.run),  scaled: true },
			{ field: "special", label: tmpmove.specialName ? tmpmove.specialName.replace(/:$/, "") : "Special",
			  current: tmpmove.specialName ? tmprate(tmpmove.special) : "none", mod: num(tmpt.special), scaled: true },
			{ field: "dailyMove", label: "Travel (daily)", current: "", mod: num(tmpt.dailyMove), scaled: false },
			{ field: "dailyRest", label: "Travel (rest)",  current: "", mod: num(tmpt.dailyRest), scaled: false },
			{ field: "standJump", label: "Jump (stand)", current: num(tmpmove.jumpStand) + "'", mod: num(tmpt.standJump), scaled: false },
			{ field: "upJump",    label: "Jump (up)",    current: num(tmpmove.jumpUp) + "'",    mod: num(tmpt.upJump),    scaled: false }
		],
		moveMulti: num(tmpt.moveMulti) || 1,
		specialSpeed: num(tmpt.specialSpeed) || 1,
		specialTypes: [ { value: "None:", label: "None:", selected: !tmpt.specialType } ].concat(
			TEMP_SPECIAL_TYPES.map(tmptype => ({ value: tmptype, label: TEMP_SPECIAL_LABELS[tmptype] ?? tmptype,
				selected: tmpt.specialType == tmptype }))),
		specialType: tmpt.specialType || "None:"
	};

	// @MARKER COMBAT
	var tmpc = tmpsys.combat ?? {};
	tmpview.combat = {
		// Current Values / Input / Modifiers, the seven he lists across the top.
		rows: [
			{ field: "damage",      label: "Damage",       mod: num(tmpc.damageMisc) },
			{ field: "defensive",   label: "Defensive",    mod: num(tmpc.defenseMisc) },
			{ field: "melee",       label: "Melee",        mod: num(tmpc.meleeMisc) },
			{ field: "missile",     label: "Missile",      mod: num(tmpc.missileMisc) },
			{ field: "initiative",  label: "Initiative",   mod: num(tmpc.initiativeMisc) },
			{ field: "weaponSpeed", label: "Weapon Speed", mod: num(tmpt.weaponSpeed) },
			{ field: "skills",      label: "Skills",       mod: num(tmpc.skillMisc) }
		],
		current: { damage: num(tmpc.meleeDamage), defensive: num(tmpc.defensiveAdjust), melee: num(tmpc.meleeAttack),
			missile: num(tmpc.missileAttack), initiative: num(tmpc.initiativeMod), weaponSpeed: num(tmpc.weaponSpeedMod),
			skills: num(tmpc.armorSkillPenalty) + num(tmpc.tempSkillMod) },
		extraDice: num(tmpt.extraDice), extraPerDie: num(tmpt.extraPerDie),
		ambidextrous: !!tmpt.ambidextrous, shockImmune: !!tmpt.shockImmune,
		speedSeconds: num(tmpc.speedSeconds),
		speedOptions: Array.from({ length: 11 }, (tmpv, tmpi) => ({ value: tmpi, label: "" + tmpi, selected: tmpi == num(tmpc.speedSeconds) })),
		// "Modifier: n" beside each of the rest.
		singles: [
			{ field: "hide",          label: "Hide",                            mod: num(tmpsys.body?.hide) },
			{ field: "forceArmor",    label: "Force Armor (non-armor effect)",  mod: num(tmpc.forceArmor) },
			{ field: "spiritArmor",   label: "Spiritual Armor (non-armor effect)", mod: num(tmpc.spiritArmor) },
			{ field: "outerKinetic",  label: "Outer Kinetic Armor (non-armor effect)", mod: num(tmpc.outerKinetic) },
			{ field: "damageAbsorb",  label: "Damage Absorption (non-armor effect)", mod: num(tmpc.damageAbsorb) },
			{ field: "painThreshold", label: "Pain Threshold",                  mod: num(tmpc.painThreshold) },
			{ field: "fumble",        label: "Fumble Range (increase)",         mod: num(tmpt.fumble) },
			{ field: "calledShot",    label: "Called Shot (increase)",          mod: num(tmpt.calledShot) }
		]
	};

	// @MARKER EQUIPMENT
	tmpview.equipment = { weightMulti: num(tmpt.weightMulti) || 1, capacityMulti: num(tmpt.capacityMulti) || 1 };

	// @MARKER FATIGUE
	var tmpf = tmpt.fatigue ?? {};
	var tmpnow = getFatigueLevelValues(tmpf.immune ? 0 : tmpf.level);
	tmpview.fatigue = {
		levelOptions: levelOptions(num(tmpf.level)),
		mentalOptions: levelOptions(num(tmpf.mentalLevel)),
		immune: !!tmpf.immune, mentalImmune: !!tmpf.mentalImmune,
		level: tmpnow.level, mentalLevel: tmpf.mentalImmune ? 0 : num(tmpf.mentalLevel),
		// The table he prints: level, then Combat Skill, Melee, Missile, Damage, Movement, Weapon Speed, Faint.
		table: Object.keys(FATIGUE_TABLE).map(tmpl => {
			var tmpv = getFatigueLevelValues(tmpl);
			return { level: tmpv.level, skill: signed(tmpv.skill) + "%", melee: signed(tmpv.melee), missile: signed(tmpv.missile),
				damage: signed(tmpv.damage), movement: tmpv.movement, weaponSpeed: signed(tmpv.weaponSpeed), faint: tmpv.faint,
				current: tmpv.level == tmpnow.level };
		}),
		// "Modifiers" along the top of his section: what the held level is worth now.
		now: { skill: signed(tmpnow.skill) + "%", melee: signed(tmpnow.melee), missile: signed(tmpnow.missile),
			damage: signed(tmpnow.damage), movement: tmpnow.movement, weaponSpeed: signed(tmpnow.weaponSpeed), faint: tmpnow.faint },
		mentalValue: (tmpf.mentalImmune ? 0 : num(tmpf.mentalLevel)) * -5
	};

	// @MARKER BERSERK
	tmpview.berserk = { state: tmpt.berserk || "", label: tmpt.berserk == "berserk" ? "Berserk" : (tmpt.berserk == "after" ? "After effects" : "None") };

	return tmpview;
}

// @MARKER ADD NEW temporary modifier view functions HERE
// @END (CODE)
