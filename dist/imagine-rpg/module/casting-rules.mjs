// @START (CODE)
// @MARKER CASTING RULES
//==================================================================================================================
// Casting spells and invoking, worked out with no Foundry dependency so every rule can be tested
// outside it. Three parts:
//
//   HOW FAR A CASTER HAS COME -- his setMagicDivineLore (sheet-worker.js:96635), which puts together
//       Aura Control, the Aura Pool, the regeneration rate and Piety Control out of the class, the
//       title and the attributes. The per-class and per-title figures are his own functions,
//       carried across in module/casting-titles.mjs; the COMBINING is here. The character's prepare
//       step (actor-character.mjs _prepareMagic) calls it.
//
//   A CAST -- his useSpell (161282) and useInvocation (153430): everything that decides whether a
//       spell goes off and at what Aura, before the effect. resolveSpellCast is the decision alone,
//       with dice passed in; performSpellCast runs it and then his doSpellAction (module/casting-
//       worker.mjs, generated) for what the spell does. The same for an invocation.
//
//   PRAYING FOR AN INVOCATION -- his handlePrayForInvocation (152516) and handleReprayForInvocation
//       (153326): the Divine Knowledge roll and the six things that stop a prayer before it.
//
// WHAT SCALES A SPELL. The Aura put into it. The caster chooses it; Aura Control is the most they may
// put in (and the highest level they can cast safely), and the Aura Pool is what they have left.
// Aura Control grows with title and class and Intelligence; the pool is their Aura. Every case of his
// doSpellAction then works its range, duration, dice and number of bolts from that Aura, and a case
// of doInvocationAction from the invoker's Piety Control, which grows with title and Wisdom.
//
// WHAT IS NOT BUILT, and says so rather than guessing: his spell TUNING (speed casting, stabilizing,
// overloading, Aura reach and burning Aura), COMBINED casting, caster SPECIALIZATION, and HERMETIC
// casting (which needs his ingredient panel -- a Hermeticist is told so and nothing is cast). See
// docs/sonnet/2026-09-24-casting.md. The days a memorized spell lasts, and his MEM and Sleep buttons,
// came across 2026-09-24 from the parallel magic branch: MEMORY below. A Wilder's halving did NOT --
// his sheet's reading stands until the user rules on it: THE WILDER'S HALVING below.
//==================================================================================================================

import { getAuraControlTitleMod, getPietyControlTitleMod, getSpellLoreWhen, getMaxAuraControl, getMaxAuraPool,
         getAuraRegenRate, checkDevotion, getLightFireSpellsWithoutLevel, getAllShadowFrostSpellsWithoutLevel,
         getHalfCastingTime } from "./casting-titles.mjs";
import { beginCasting, endCasting } from "./casting-helpers.mjs";
import { resolveResistanceRoll } from "./resistance-rules.mjs";

// @MARKER THE CASTING SKILLS
// The skill a caster casts with -- the best of these the character holds, as his storeBestCastingSkill
// (sheet-worker.js:98254) finds it. Only two change how a cast is resolved: Arcane Pact (a Sorcerer
// rolls it every cast) and Hermetic Lore (a ritual of ingredients, not built). The other three are
// read for the practitioner title and nothing else, since an ordinary caster makes no roll to cast.
export const ARCANE_PACT = "Arcane Pact";
export const HERMETIC_LORE = "Hermetic Lore";

// The Aura Control a class's Spell Lore -- or, for a Wilder, Winds of Wild Magic -- is worth while it
// is held. His "spellLoreBonus" and "windsOfWildMagicDouble" in setMagicDivineLore.
export const SPELL_LORE_BONUS = 2;


//==================================================================================================================
// @MARKER AURA CONTROL
//==================================================================================================================

	// This is the function which works out Aura Control -- his setMagicDivineLore, the AURA CASTER and
	// AURA BURROWER (Sorcerer) branches, read line for line.
	//
	//   tmpinput = {
	//       className         his class name (the class item's baseClass, e.g. "Witch(White)")
	//       title             the class's title
	//       casterStartTitle  the title the class starts casting (0: not a caster)
	//       intAdjust         Intelligence's Aura Control adjustment (his int_aura_control)
	//       metaphysics       holds the social skill Metaphysics (+1, his mod_aura_control_metaphysics)
	//       boost             his aura_control_boost -- runes and items; the Game Master's figure
	//       spellLore         holds Spell Lore with a chance (never read for a Wilder: see below)
	//       windsOfWildMagic  a Wilder holding Winds of Wild Magic with a chance
	//       suppressed        magically suppressed: Aura Control is 0
	//   }
	//
	// THE TITLE ADDITIONS. His sheet does not work these out, it ADDS them up: on each title reached
	// from the class's caster start, getOtherTitleImprovements (95997) puts the class's figure
	// (getAuraControlTitleMod) into aura_control_added, plus a one-off +2 on the title the class gains
	// Spell Lore (getSpellLoreWhen). A title reached is a title from 2 up -- title 1 is not "reached".
	// The port has no history to add up, so it sums the same figures over the same titles, which is
	// the same number for anyone who advanced one title at a time.
	//
	// A caster who STARTS at title 1 also has the class figure as a starting Aura Control; one who
	// starts later has none, and gets the class figure first on reaching the start title.
	//
	// Spell Lore held adds +2 more ONLY above the start title, and a Wilder's Winds of Wild Magic
	// instead DOUBLES the whole. So a class gets +2 at the title it gains Spell Lore AND +2 while it
	// holds it. The Player's Guide gives Spell Lore "+2 Aura Control" once (p.132); his sheet gives it
	// twice. His sheet is followed; the question is UPSTREAM-ISSUES.md item 71.
	//
	// A WILDER NEVER HAS SPELL LORE'S +2. His setMagicDivineLore reads Winds of Wild Magic in its place
	// for a Wilder, and sets spellLoreBonus to 0 whether Winds is held or not (sheet-worker.js:
	// 96636-96670); getSpellLoreWhen gives a Wilder no Spell Lore title (95680). Until 2026-09-24 a
	// Wilder holding Spell Lore without Winds took the +2 here.
	//
	// @MARKER THE WILDER'S HALVING
	// NOT APPLIED -- HIS SHEET'S READING STANDS, AND THE QUESTION IS ASKED (2026-09-24). The Master's
	// Manual p.47 says of the Wilder: "All Aura Control modifiers are halved (round down); apply to dual
	// class Wilders as well" (masters-manual-fulltext.txt:7119), and the same page gives "Title
	// Advancement: +1 Aura Control per Title". His sheet encodes exactly that page: a Wilder's
	// getAuraControlTitleMod is 1 where a Mage's is 2 (sheet-worker.js:96291), and Intelligence,
	// Metaphysics and the boost are added in full, then doubled by Winds of Wild Magic (96729-96733).
	//
	// His errata's "Should Read" block for p.47 (MM.txt, "Pg: 47 (Wilder Class)") repeats the halving
	// sentence WORD FOR WORD; what it actually changes on that page is elsewhere -- the "18 skill
	// points, +1 WIL 5%, +1 AUR 5%" moved to Goal Advancement, and the animal Affinity reworded. So on
	// the halving the errata restates the book, and his sheet, which outranks the book, already read
	// that same sentence. Whether a restated, unchanged sentence counts as the errata disagreeing with
	// the sheet (CLAUDE.md, the 2026-09-21 ruling) is the user's call, not the port's. Until it is made
	// the sheet is followed -- which is also what this function did before 2026-09-24 -- and the
	// question is in docs/UPSTREAM-ISSUES.md and docs/ERRATA.md.
	//
	// What following the errata's wording instead would change: a Wilder at title 5 with Intelligence
	// +2 and Winds is (5 + 2) x 2 = 14 on his sheet, and would be (5 + 1) x 2 = 12 with every modifier
	// halved -- "round down" taken as Math.floor, so a penalty halves AWAY from 0 (-3 to -2), not
	// toward it as parseInt would.
	export function getAuraControl(tmpinput) {
		var tmpclass = "" + (tmpinput.className ?? "");
		var tmptitle = parseInt(tmpinput.title) || 0;
		var tmpstart = parseInt(tmpinput.casterStartTitle) || 0;
		var tmpsorcerer = tmpclass == "Sorcerer";
		var tmpwilder = tmpclass == "Wilder";
		var tmpresult = { value: 0, max: getMaxAuraControl(tmptitle), isCaster: tmpsorcerer || tmpstart > 0,
			parts: [], suppressed: !!tmpinput.suppressed, doubled: false };
		if (!tmpresult.isCaster) { return tmpresult; }

		var tmpclassmod = parseInt(getAuraControlTitleMod(tmpclass)) || 0;
		var tmpspelllorewhen = parseInt(getSpellLoreWhen(tmpclass)) || 0;
		var tmpadded = 0;
		for (var tmpt = 2; tmpt <= tmptitle; tmpt++) {
			if (tmpt < tmpstart) { continue; }
			var tmpmod = tmpclassmod;
			if (tmpt == tmpspelllorewhen) { tmpmod = tmpmod + 2; }
			if (tmpmod > 0) { tmpadded = tmpadded + tmpmod; }
		}
		var tmpstartac = 0;
		if (tmpsorcerer) {
			if (tmptitle > 0) { tmpstartac = tmpclassmod; }
		} else if (tmpstart == 1) {
			tmpstartac = tmpclassmod;
		}
		var tmpint = parseInt(tmpinput.intAdjust) || 0;
		var tmpmeta = tmpinput.metaphysics ? 1 : 0;
		var tmpboost = parseInt(tmpinput.boost) || 0;
		// his spellLoreBonus: 2 with Spell Lore found, and never for a Wilder (96663-96670)
		var tmplore = (!tmpsorcerer && !tmpwilder && tmptitle > tmpstart && tmpinput.spellLore) ? SPELL_LORE_BONUS : 0;

		var tmpvalue = tmpstartac + tmpint + tmpmeta + tmpadded + tmpboost + tmplore;
		if (tmpwilder && tmptitle > tmpstart && tmpinput.windsOfWildMagic) {
			tmpvalue = tmpvalue * 2; // Winds of Wild Magic doubles total Aura Control.
			tmpresult.doubled = true;
		}
		tmpresult.parts = [
			{ label: tmpstart == 1 || tmpsorcerer ? "Class at the start" : "", value: tmpstartac },
			{ label: "Titles as a caster", value: tmpadded },
			{ label: "Intelligence", value: tmpint },
			{ label: "Metaphysics", value: tmpmeta },
			{ label: "Spell Lore", value: tmplore },
			{ label: "Boost", value: tmpboost }
		].filter(tmppart => tmppart.label && tmppart.value);
		if (tmpvalue > tmpresult.max) { tmpvalue = tmpresult.max; tmpresult.capped = true; }
		if (tmpinput.suppressed) { tmpvalue = 0; } // Magical Ability is supressed.
		tmpresult.value = tmpvalue;
		return tmpresult;
	}


//==================================================================================================================
// @MARKER THE AURA POOL
//==================================================================================================================

	// This is the function which works out the Aura Pool -- his setMagicDivineLore and drainAuraPoolByAmount.
	// A full pool is the Aura rating plus any additional Aura (items, his additional_aura), held to his
	// ceiling for the title (getMaxAuraPool: twice the Aura up to title 11, then fixed figures). What is
	// drained comes off it; drained is never more than the pool, as his drain holds it.
	export function getAuraPool(tmpinput) {
		var tmptitle = parseInt(tmpinput.title) || 0;
		var tmpaura = parseInt(tmpinput.aura) || 0;
		var tmpmax = parseInt(getMaxAuraPool(tmptitle, tmpaura)) || 0;
		var tmpfull = tmpaura + (parseInt(tmpinput.additional) || 0);
		if (tmpfull > tmpmax) { tmpfull = tmpmax; }
		if (tmpfull < 0) { tmpfull = 0; }
		var tmpdrained = parseInt(tmpinput.drained) || 0;
		if (tmpdrained < 0) { tmpdrained = 0; }
		if (tmpdrained > tmpfull) { tmpdrained = tmpfull; }
		return { max: tmpmax, full: tmpfull, drained: tmpdrained, current: tmpfull - tmpdrained };
	}

	// This is the function which says how much is drained after a cast drains some more.
	export function drainAura(tmppool, tmpamount) {
		var tmpdrained = (parseInt(tmppool.drained) || 0) + (parseInt(tmpamount) || 0);
		if (tmpdrained > tmppool.full) { tmpdrained = tmppool.full; }
		if (tmpdrained < 0) { tmpdrained = 0; }
		return tmpdrained;
	}

	// This is the function which gives the rate the pool refills -- his getAuraRegenRate, with his
	// double (aura_regen_double) and the High Aura bonus (aur_regen_bonus) passed through.
	export function getAuraRegen(tmpinput) {
		return getAuraRegenRate("" + (tmpinput.className ?? ""), parseInt(tmpinput.title) || 0,
			parseInt(tmpinput.casterStartTitle) || 0, tmpinput.double ? "on" : "", "" + (tmpinput.bonus ?? ""));
	}

	// This is the function which works out how much Aura comes back after a while -- his
	// regenAuraPoolByTime (161036). tmpunit is "sec", "min" or "hour"; the rate is his, "3/per Second".
	// Returns { regained, reset } -- reset when all of it is back.
	//
	// ONE LINE ADDED. His hours branch knows rates per second, per ten minutes and per minute, and not
	// his own slowest rate, "1/per Hour" -- so a caster at practitioner title 0 got nothing back for
	// any number of hours. That rate is counted here, an hour at a time. UPSTREAM-ISSUES.md item 72.
	export function regenAuraByTime(tmprate, tmpunits, tmpunit, tmpdrained) {
		var tempAuraRegenRate = "" + (tmprate ?? "");
		var tempTimeUnits = parseInt(tmpunits) || 0;
		var tempTimeUnitType = "" + tmpunit;
		var tempDrainedAura = parseInt(tmpdrained) || 0;
		var auraToRegen = 0;
		var tempRegenUnits = parseInt(tempAuraRegenRate) || 1;
		if (tempRegenUnits < 1) { tempRegenUnits = 1; }
		if (tempTimeUnitType == "hour" && tempTimeUnits > 0) {
			if (tempAuraRegenRate.includes("Second")) {
				return { regained: tempDrainedAura, reset: true }; // give all their aura back.
			} else if (tempAuraRegenRate.includes("10 Minutes")) {
				auraToRegen = parseInt((tempTimeUnits * 6) * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("Minute")) {
				auraToRegen = parseInt((tempTimeUnits * 60) * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("Hour")) { // not in his sheet: see above
				auraToRegen = parseInt(tempTimeUnits * tempRegenUnits);
			}
		} else if (tempTimeUnitType == "min" && tempTimeUnits > 0) {
			if (tempAuraRegenRate.includes("10 Minutes")) {
				if (tempTimeUnits > 9) { auraToRegen = parseInt((tempTimeUnits / 10) * tempRegenUnits); }
			} else if (tempAuraRegenRate.includes("Minute")) {
				auraToRegen = parseInt(tempTimeUnits * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("30 Seconds")) {
				auraToRegen = parseInt((tempTimeUnits * 2) * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("10 Seconds")) {
				auraToRegen = parseInt((tempTimeUnits * 6) * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("5 Seconds")) {
				auraToRegen = parseInt((tempTimeUnits * 12) * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("2 Seconds")) {
				auraToRegen = parseInt((tempTimeUnits * 30) * tempRegenUnits);
			} else if (tempAuraRegenRate.includes("Second")) {
				auraToRegen = parseInt((tempTimeUnits * 60) * tempRegenUnits);
			}
		} else if (tempTimeUnitType == "sec" && tempTimeUnits > 0) {
			if (tempAuraRegenRate.includes("30 Seconds")) {
				if (tempTimeUnits > 29) { auraToRegen = parseInt((tempTimeUnits / 30) * tempRegenUnits); }
			} else if (tempAuraRegenRate.includes("10 Seconds")) {
				if (tempTimeUnits > 9) { auraToRegen = parseInt((tempTimeUnits / 10) * tempRegenUnits); }
			} else if (tempAuraRegenRate.includes("5 Seconds")) {
				if (tempTimeUnits > 4) { auraToRegen = parseInt((tempTimeUnits / 5) * tempRegenUnits); }
			} else if (tempAuraRegenRate.includes("2 Seconds")) {
				if (tempTimeUnits > 1) { auraToRegen = parseInt((tempTimeUnits / 2) * tempRegenUnits); }
			} else if (tempAuraRegenRate.includes("Second")) {
				auraToRegen = parseInt(tempTimeUnits * tempRegenUnits);
			}
		}
		if (auraToRegen >= tempDrainedAura) { return { regained: tempDrainedAura, reset: true }; }
		return { regained: auraToRegen > 0 ? auraToRegen : 0, reset: false };
	}


//==================================================================================================================
// @MARKER PIETY CONTROL
//==================================================================================================================

	// This is the function which works out Piety Control -- the Divine Magic end of his
	// setMagicDivineLore. Nothing before the invoker start title; on it, a starting 2 plus Wisdom's
	// figure and Theology's +1; above it, the class's figure for every title reached from the start as
	// well (his piety_control_added, summed as the Aura Control additions are). Divine Denial makes it 0.
	// The Piety LEVEL an invocation is worked at is Piety Control plus any boost (his piety_invoke).
	//
	// THE START TITLE'S FIGURE, followed as his code has it. His title-up adds the class figure at every
	// title from the invoker start ON, the start's own included (getOtherTitleImprovements, 96015, ">="),
	// but at the start title he reads only the starting 2 (96778) and above it adds the whole sum
	// (96783-96784) -- so a class starting above title 1 jumps by twice its figure on the title after its
	// start: a Monk (start 3, +2 a title) is 2 at title 3 and 6 at 4, where the book's 2 x practitioner
	// title gives 4 (PG p.285). His own comment, "already covered by getPietyControlTitleMod (when
	// acquired)", reads as if he meant the start's figure to be counted once. The parallel magic branch
	// took that reading; the reconciliation of 2026-09-24 kept his code, and it is asked upstream.
	export function getPietyControl(tmpinput) {
		var tmpclass = "" + (tmpinput.className ?? "");
		var tmptitle = parseInt(tmpinput.title) || 0;
		var tmpstart = parseInt(tmpinput.invokerStartTitle) || 0;
		var tmpresult = { value: 0, level: 0, isInvoker: tmpstart > 0, parts: [], denial: !!tmpinput.denial };
		if (tmpstart <= 0 || tmptitle < tmpstart) { return tmpresult; }
		var tmpwis = parseInt(tmpinput.wisAdjust) || 0;
		var tmptheo = tmpinput.theology ? 1 : 0;
		var tmpadded = 0;
		if (tmptitle > tmpstart) {
			var tmpclassmod = parseInt(getPietyControlTitleMod(tmpclass)) || 0;
			for (var tmpt = 2; tmpt <= tmptitle; tmpt++) {
				if (tmpt >= tmpstart && tmpclassmod > 0) { tmpadded = tmpadded + tmpclassmod; }
			}
		}
		var tmpvalue = 2 + tmpwis + tmptheo + tmpadded; // 2 is his "Starting Piety Control"
		tmpresult.parts = [
			{ label: "Starting", value: 2 }, { label: "Titles as an invoker", value: tmpadded },
			{ label: "Wisdom", value: tmpwis }, { label: "Theology", value: tmptheo }
		].filter(tmppart => tmppart.value);
		tmpresult.level = tmpvalue + (parseInt(tmpinput.levelBoost) || 0);
		if (tmpinput.denial) { tmpvalue = 0; }
		tmpresult.value = tmpvalue;
		return tmpresult;
	}

	// This is the function which gives the uses an invocation is prayed for -- his addUsageByName
	// (153417): the invocation's "uses per" figure times Piety Control, plus .9, cut down.
	export function getInvocationUses(tmpusesper, tmppietycontrol) {
		return parseInt(((parseFloat(tmpusesper) || 0) * (parseFloat(tmppietycontrol) || 0)) + 0.9) || 0;
	}

	// This is the function which says whether an alignment is barred from an invocation -- the
	// alignment test at the head of his handlePrayForInvocation, his order and his words.
	export function isAlignmentBarred(tmprestriction, tmpalignment) {
		var tempAlignRestrict = "" + (tmprestriction ?? "");
		var tempAlignment = "" + (tmpalignment ?? "");
		if (tempAlignRestrict == "Non-Evil" && tempAlignment.includes("Evil")) { return true; }
		if (tempAlignRestrict == "Non-Good" && tempAlignment.includes("Good")) { return true; }
		if (tempAlignRestrict == "Non-Neutral" && tempAlignment.includes("Neutral")) { return true; }
		if (tempAlignRestrict == "Good" && !(tempAlignment.includes("Good"))) { return true; }
		if (tempAlignRestrict == "Evil" && !(tempAlignment.includes("Evil"))) { return true; }
		if (tempAlignRestrict == "Neutral" && !(tempAlignment.includes("Neutral"))) { return true; }
		if (tempAlignRestrict == "Active" && !(tempAlignment.includes("Active"))) { return true; }
		if (tempAlignRestrict == "Fanatical" && !(tempAlignment.includes("Fanatical"))) { return true; }
		return false;
	}

	// This is the function which says whether an invocation is in one of the invoker's devotions -- his
	// devotion loop, over his comma-separated current_devotions. Ignoring devotions always says yes.
	export function isInDevotion(tmpname, tmpdevotions, tmpignore) {
		if (tmpignore) { return true; }
		for (const tmpdevotion of ("" + (tmpdevotions ?? "")).split(",")) {
			var tmpclean = tmpdevotion.replace(/^\s+/g, "").replace(/\s+$/g, "");
			if (tmpclean && checkDevotion(tmpname, tmpclean)) { return true; }
		}
		return false;
	}

	// The sixteen devotions of his getDevotionList, for the sheet's picker.
	export const DEVOTIONS = ["Body", "Celestial", "Combat", "Control", "Divination", "Elemental", "General",
		"Healing", "Mind", "Nature", "Necromancy", "Protection", "Summoning"];


//==================================================================================================================
// @MARKER PRAYING FOR AN INVOCATION
//==================================================================================================================

	// This is the function which settles a prayer -- his handlePrayForInvocation (a new invocation) and
	// handleReprayForInvocation (uses again for one already known). His checks, in his order, then the
	// Divine Knowledge roll: 200% always prays, a 100 always fails, more than 20 over the chance is a
	// critical failure and 24 hours of Divine Denial.
	//
	//   tmpinput = { repray, name, chance, modifier, alreadyKnown, memorized, restriction, alignment,
	//                level, pietyControl, denial, memoryUsed, memoryAvailable, inDevotion }
	// Returns { outcome, roll, total } -- outcome one of "alreadyKnown", "notMemorized", "wrongAlignment",
	// "overPietyControl", "denial", "noMemory", "noDevotion", "grandmaster", "fumble", "critical",
	// "failure", "success".
	export function resolvePrayer(tmpinput, tmproll) {
		var tmptotal = (parseInt(tmpinput.chance) || 0) + (parseInt(tmpinput.modifier) || 0);
		if (tmptotal > 200) { tmptotal = 200; }
		var tmpresult = { outcome: "", roll: parseInt(tmproll) || 0, total: tmptotal };
		if (tmpinput.repray) {
			if (!tmpinput.memorized) { tmpresult.outcome = "notMemorized"; return tmpresult; }
			if (tmpinput.denial) { tmpresult.outcome = "denial"; return tmpresult; }
			if (!tmpinput.inDevotion) { tmpresult.outcome = "noDevotion"; return tmpresult; }
		} else {
			if (tmpinput.alreadyKnown) { tmpresult.outcome = "alreadyKnown"; return tmpresult; }
			if (isAlignmentBarred(tmpinput.restriction, tmpinput.alignment)) { tmpresult.outcome = "wrongAlignment"; return tmpresult; }
			if ((parseInt(tmpinput.level) || 0) > (parseInt(tmpinput.pietyControl) || 0)) { tmpresult.outcome = "overPietyControl"; return tmpresult; }
			if (tmpinput.denial) { tmpresult.outcome = "denial"; return tmpresult; }
			// His memorization allowance: the first thing memorized is allowed whatever it costs.
			var tmpenough = (parseInt(tmpinput.memoryUsed) || 0) == 0 || (parseInt(tmpinput.level) || 0) <= (parseInt(tmpinput.memoryAvailable) || 0);
			if (!tmpenough) { tmpresult.outcome = "noMemory"; return tmpresult; }
			if (!tmpinput.inDevotion) { tmpresult.outcome = "noDevotion"; return tmpresult; }
		}
		if (tmptotal == 200) { tmpresult.outcome = "grandmaster"; return tmpresult; }
		if (tmpresult.roll == 100) { tmpresult.outcome = "fumble"; return tmpresult; }
		if (tmpresult.roll > (tmptotal + 20)) { tmpresult.outcome = "critical"; return tmpresult; }
		if (tmpresult.roll > tmptotal) { tmpresult.outcome = "failure"; return tmpresult; }
		tmpresult.outcome = "success";
		return tmpresult;
	}

	// This is the function which says whether a prayer went through.
	export function isPrayerAnswered(tmpoutcome) {
		return tmpoutcome == "success" || tmpoutcome == "grandmaster";
	}


//==================================================================================================================
// @MARKER MEMORY
//==================================================================================================================
// How long a memorized spell stays in mind, and his MEM button that refreshes it. Brought across
// 2026-09-24 from the parallel magic branch (wip/magic-m1): main had the memorize tick and no days.

// His addSpellByName and addSpellDays: 30 days less the spell's Aura level, never under 1.
export const MEMORY_DAYS = 30;

	// This is the function which gives the days a spell stays in memory once memorized -- his
	// addSpellDays (sheet-worker.js:160855): 30 less its Aura level, at least 1. The book agrees
	// (Player's Guide p.215, "30 days, minus one day per Aura Level").
	export function getSpellDays(tmplevel) {
		var tempDays = parseInt(MEMORY_DAYS - (parseInt(tmplevel) || 0));
		if (tempDays < 1) { tempDays = 1; }
		return tempDays;
	}

	// This is the function which reads the days a spell has left. A spell's days are null until they
	// are first counted (item-spell.mjs, DAYS OF MEMORY): a memorized one reads its full count, as his
	// add would have given it, and one not memorized has none.
	export function getSpellDaysLeft(tmpsystem) {
		var tmpdays = tmpsystem?.days;
		if (tmpdays === null || tmpdays === undefined || tmpdays === "") {
			return tmpsystem?.memorized ? getSpellDays(tmpsystem?.level) : 0;
		}
		return parseInt(tmpdays) || 0;
	}

	// This is the function behind his Sleep button for one spell -- subtractDayFromAllSpells
	// (160889): a day less, none below 0. The pool is refilled by the caller.
	export function sleepSpellDays(tmpdays) {
		var tempDays = parseInt(tmpdays) || 0;
		if (tempDays != 0) { tempDays--; }
		if (tempDays < 0) { tempDays = 0; } // just in case they clicked it really fast.
		return tempDays;
	}

	// This is the function which settles his MEM button -- handleRemorizeSpell (160766): the best
	// casting skill, plus his MOD button's modifier when Shift is held, capped at 200. Magic suppressed
	// refuses before any roll. His outcomes, in his order:
	//     200% always rememorizes ("a Grandmaster of ... automatically")
	//     a 100 fails
	//     more than 20 over the chance is a critical failure (nothing more happens)
	//     over the chance fails
	//     otherwise it is rememorized
	// A success memorizes the spell (his checkSpellMemorize) with its full days (addSpellDays), so MEM
	// works on a spell not ticked as well. The book wants no roll to re-memorize (PG p.215); his sheet
	// rolls, and his sheet wins.
	//
	// A SORCERER'S spell types are not checked. His handler refuses an Arcane Pact caster a spell not
	// of the pact's types (checkSorcSpellType, 160793; refused at 160804); the port has no pact types yet (they come with
	// learning spells), so the roll is made and the result says the check was not made -- refusing
	// instead would leave a Sorcerer's spells forgotten for good after their first Sleep.
	//
	//   tmpinput = { suppressed, castingSkill: { name, chance }, modifier, level }
	// Returns { outcome ("suppressed", "grandmaster", "fumble", "critical", "failure", "success"),
	//           roll, total, days (the spell's new days on a success, else null), pactUnchecked }.
	export function resolveRememorize(tmpinput, tmproll) {
		var tmpskill = tmpinput?.castingSkill ?? { name: "", chance: 0 };
		var totalChance = (parseInt(tmpskill.chance) || 0) + (parseInt(tmpinput?.modifier) || 0);
		if (totalChance > 200) { totalChance = 200; }
		var total = parseInt(tmproll) || 0;
		var tmpresult = { outcome: "", roll: total, total: totalChance, days: null, pactUnchecked: tmpskill.name == ARCANE_PACT };
		if (tmpinput?.suppressed) { tmpresult.outcome = "suppressed"; tmpresult.roll = null; return tmpresult; }
		if (totalChance == 200) { tmpresult.outcome = "grandmaster"; }
		else if (total == 100) { tmpresult.outcome = "fumble"; }
		else if (total > (totalChance + 20)) { tmpresult.outcome = "critical"; }
		else if (total > totalChance) { tmpresult.outcome = "failure"; }
		else { tmpresult.outcome = "success"; }
		if (tmpresult.outcome == "grandmaster" || tmpresult.outcome == "success") { tmpresult.days = getSpellDays(tmpinput?.level); }
		return tmpresult;
	}

	// This is the function which says what a MEM roll did -- his handleRemorizeSpell's lines, word for
	// word but for his spelling ("supressed").
	//   tmpwords = { name, spell, skill, memTime }
	export function describeRememorize(tmpresult, tmpwords) {
		var tmpname = tmpwords?.name ?? "";
		var tmpspell = tmpwords?.spell ?? "";
		var tmpskill = tmpwords?.skill || "no casting skill";
		var tmpafter = tmpwords?.memTime ? ` after ${tmpwords.memTime}` : "";
		var tmpline = "";
		switch (tmpresult?.outcome) {
			case "suppressed":  return `${tmpname} is currently magically suppressed and cannot rememorize any spells. Nothing done.`;
			case "grandmaster": tmpline = `${tmpname} is a Grandmaster of ${tmpskill} and automatically rememorized the ${tmpspell} spell${tmpafter}`; break;
			case "fumble":      tmpline = `${tmpname} rolled a ${tmpresult.roll}% ${tmpskill} and failed to rememorize the ${tmpspell} spell${tmpafter}`; break;
			case "critical":    tmpline = `${tmpname} rolled a ${tmpresult.roll}% against a ${tmpresult.total}% ${tmpskill} and critically failed to rememorize the ${tmpspell} spell.`; break;
			case "failure":     tmpline = `${tmpname} rolled a ${tmpresult.roll}% against a ${tmpresult.total}% ${tmpskill} and failed to rememorize the ${tmpspell} spell${tmpafter}`; break;
			default:            tmpline = `${tmpname} rolled a ${tmpresult?.roll}% against a ${tmpresult?.total}% ${tmpskill} and rememorized the ${tmpspell} spell${tmpafter}`; break;
		}
		if (tmpresult?.pactUnchecked) {
			tmpline = tmpline + ` (Whether it is of a type the Arcane Pact allows is not checked yet: the Game Master decides.)`;
		}
		return tmpline;
	}


//==================================================================================================================
// @MARKER A CAST
//==================================================================================================================

	// This is the function which decides a cast -- his useSpell up to the effect, with the parts not
	// built left out (see the header). Dice come from tmpdie(sides), rolled in his order: the cast's own
	// d100 first (his startRoll roll1, which only a Sorcerer reads), then the failure roll if the spell
	// is above Aura Control, then the mishap roll if it failed, then the High Aura save.
	//
	//   tmpcast = {
	//       level, fail          the spell's Aura Level and its failure % per level above Aura Control
	//       aura                 the Aura the caster puts in
	//       castTime             "10 sec." -- halved when the spell is mastered
	//       memorized, mastered  his mem and mastery ticks
	//       days                 the days of memory left (getSpellDaysLeft); left out, not checked
	//       suppressed, halfMagic
	//       auraControl, auraPool, title, auraSave
	//       castingSkill         { name, chance } -- the best casting skill held
	//   }
	//
	// Returns { outcome, ... }. Outcomes, in his order of precedence:
	//   "notMemorized"  "forgotten"  "suppressed"  "noAura"
	//                                               nothing cast, nothing drained. "forgotten" is a
	//                                               memorized spell out of days (never a Hermeticist's)
	//   "hermetic"                                  not built; nothing cast
	//   "mishap"                                    the failure roll came up: the Aura is drained and
	//                                               getMagicalMishap is rolled (mishapRoll)
	//   "overControl"   "overPool"                  more Aura than may be put in, or than is left: fizzles
	//   "pactCritical"  "pactFailed"                a Sorcerer's Arcane Pact roll failed (critically:
	//                                               suppressed for an hour)
	//   "cast"                                      the spell goes off at castAura
	export function resolveSpellCast(tmpcast, tmpdie) {
		var tmproll = parseInt(tmpdie(100)) || 0;
		var tmpAC = (parseInt(tmpcast.auraControl) || 0) + (tmpcast.mastered ? 2 : 0); // Spell mastery modifier
		var tmpaura = parseInt(tmpcast.aura) || 0;
		var tmplevel = parseInt(tmpcast.level) || 0;
		var tmppool = parseInt(tmpcast.auraPool) || 0;
		var tmpskill = tmpcast.castingSkill ?? { name: "", chance: 0 };
		var tmpresult = { outcome: "", roll: tmproll, auraControl: tmpAC, aura: tmpaura, castAura: tmpaura, drain: 0,
			failChance: 0, difference: tmplevel - tmpAC, castTime: "" + (tmpcast.castTime ?? ""), notes: [] };

		// MAGICAL MISHAP -- a spell above Aura Control: its failure % for every level it is above.
		// Rolled before anything is refused, as his is, but only answered in its place below.
		var tmpfailed = false;
		if (tmpAC < tmplevel) {
			var tmpfailure = parseInt(tmpcast.fail) || 0;
			var tmpchance = (tmpfailure > 0 && tmpresult.difference > 0) ? tmpfailure * tmpresult.difference : 0;
			if (tmpchance < 0) { tmpchance = 0; }
			if (tmpchance > 100) { tmpchance = 100; }
			tmpresult.failChance = tmpchance;
			if (tmpchance > 0) {
				tmpresult.failRoll = parseInt(tmpdie(100)) || 0;
				if (tmpresult.failRoll <= tmpchance) {
					tmpfailed = true;
					tmpresult.mishapRoll = parseInt(tmpdie(100)) || 0;
				}
			}
		}

		// OUTPUT, in his order.
		if (!tmpcast.memorized) { tmpresult.outcome = "notMemorized"; return tmpresult; }
		// currently out of days of memorization -- his tempSpellDays<1 && !isHermetics (161896)
		var tmpdays = tmpcast.days;
		if (tmpdays !== undefined && tmpdays !== null && (parseInt(tmpdays) || 0) < 1 && tmpskill.name != HERMETIC_LORE) {
			tmpresult.outcome = "forgotten"; return tmpresult;
		}
		if (tmpcast.suppressed) { tmpresult.outcome = "suppressed"; return tmpresult; }
		if (tmpaura < 1) { tmpresult.outcome = "noAura"; return tmpresult; }
		if (tmpskill.name == HERMETIC_LORE) { tmpresult.outcome = "hermetic"; return tmpresult; }
		if (tmpfailed) { tmpresult.outcome = "mishap"; tmpresult.drain = tmpaura; return tmpresult; }
		if (tmpaura > tmpAC) { tmpresult.outcome = "overControl"; return tmpresult; }
		if (tmpaura > tmppool) { tmpresult.outcome = "overPool"; return tmpresult; }

		// SORCERER -- the Arcane Pact is rolled every cast. His critical success and his Grandmaster
		// both put +2 Aura into the spell on top of what was drained.
		if (tmpskill.name == ARCANE_PACT) {
			var tmppact = parseInt(tmpskill.chance) || 0;
			tmpresult.pact = { chance: tmppact };
			if (tmppact == 200) {
				tmpresult.drain = tmpaura; tmpresult.castAura = tmpaura + 2; tmpresult.pact.result = "grandmaster";
			} else if (tmproll > (tmppact + 20)) {
				tmpresult.outcome = "pactCritical"; return tmpresult;
			} else if (tmproll > tmppact) {
				tmpresult.outcome = "pactFailed"; return tmpresult;
			} else if (tmproll < (tmppact - 20)) {
				tmpresult.drain = tmpaura; tmpresult.castAura = tmpaura + 2; tmpresult.pact.result = "critical";
			} else {
				tmpresult.drain = tmpaura; tmpresult.pact.result = "success";
			}
			tmpresult.outcome = "cast";
			return tmpresult;
		}

		// Success (Non-Sorceror, Non-Hermeticist)
		tmpresult.drain = tmpaura;
		// HALF MAGIC -- his divideWithMinRoundUp, which returns a STRING ("3") that his later sums would
		// have joined rather than added; the number is kept here.
		if (tmpcast.halfMagic) {
			tmpresult.castAura = Math.max(1, Math.round((tmpaura + 0.99) / 2));
		}
		// High Aura effects for beings under 11 Title -- an Aura save, or Aura Fatigue.
		if ((parseInt(tmpcast.title) || 0) < 11 && tmpresult.castAura > 21) {
			var tmpsave = parseInt(tmpcast.auraSave) || 0;
			var tmpsaveroll = parseInt(tmpdie(100)) || 0;
			tmpresult.highAura = { roll: tmpsaveroll, save: tmpsave, fatigue: tmpsaveroll > tmpsave };
			if (tmpresult.highAura.fatigue) {
				var tmpfatigue = getAuraFatigue(tmpresult.castAura);
				tmpresult.highAura.attributes = tmpfatigue.attributes;
				tmpresult.highAura.text = tmpfatigue.text;
				tmpresult.highAura.halfMagic = tmpfatigue.halfMagic;
			}
		}
		if (tmpcast.mastered) { tmpresult.castTime = getHalfCastingTime(tmpresult.castTime); }
		tmpresult.outcome = "cast";
		return tmpresult;
	}

	// This is the function which gives Aura Fatigue for an Aura put into a spell by a mortal (under
	// title 11) who failed the Aura save -- his table in useSpell, which is the Player's Guide's (p.217).
	export function getAuraFatigue(tmpaura) {
		var tmpvalue = parseInt(tmpaura) || 0;
		if (tmpvalue == 22) { return { attributes: -1, halfMagic: false, text: "Aura Fatigue (-1 All Attributes)." }; }
		if (tmpvalue == 23) { return { attributes: -2, halfMagic: false, text: "Aura Fatigue (-2 All Attributes)." }; }
		if (tmpvalue == 24) { return { attributes: -3, halfMagic: false, text: "Aura Fatigue (-3 All Attributes. Immobile requiring VIT save for all physical actions for 1 minute)." }; }
		return { attributes: -4, halfMagic: true, text: "Aura Fatigue (-4 All Attributes. Immobile requiring VIT save for all physical actions for 1 minute). Spell effects are at half the Aura put into the spell for 1 hour." };
	}

	// This is the function which says whether an Illuminator or Shadowfrost Caster is casting one of
	// their own spells -- his flags at the head of useSpell, which doSpellAction reads for its closing
	// words.
	export function getSpecialCasterFlags(tmpclassname, tmpskillname, tmpspellname) {
		var tmpflags = { isLightfireCaster: false, isLightfireSpell: false, isShadowfrostCaster: false, isShadowfrostSpell: false };
		if (tmpclassname == "Illuminator" || tmpskillname == "Lightfire Knowledge") {
			tmpflags.isLightfireCaster = true;
			tmpflags.isLightfireSpell = getLightFireSpellsWithoutLevel().includes(tmpspellname);
		} else if (tmpclassname == "Shadowfrost Caster" || tmpskillname == "Shadowfrost Knowledge") {
			tmpflags.isShadowfrostCaster = true;
			tmpflags.isShadowfrostSpell = getAllShadowFrostSpellsWithoutLevel().includes(tmpspellname);
		}
		return tmpflags;
	}


	// @MARKER RUNNING A CAST
	// This is the function which casts: resolveSpellCast, and then his doSpellAction for what it does,
	// or his mishap for what went wrong -- with everything the cast would have done to the caster
	// recorded (module/casting-helpers.mjs). The worker is module/casting-worker.mjs, passed in because
	// it is large and loaded only when needed.
	//
	//   tmpcaster = {
	//       name, title (class title), practitionerTitle, effectList, alignment, powers,
	//       int, wil, wis, aur, end, intSave, wilSave, absorbAuraChance, missileMod,
	//       attackSkill, chart (combat-rules.mjs getAttackChart), className, attrs (for getAttrs)
	//   }
	//   tmpoptions = { self: true to target the caster, missileDefense }
	//
	// Returns { outcome, text, resolved, attacks, changes, effectsAdded, effectsRemoved, powersAdded,
	//           powersRemoved, forgetSpell, drain, suppressAfter, halfMagicAfter, mishapEffects }.
	// mishapEffects are a mishap's lasting changes to the caster, for the card's Apply buttons
	// (getMishapEffects); the same changes are left out of the card's list of changes.
	export function performSpellCast(tmpworker, tmpspell, tmpcast, tmpcaster, tmpoptions, tmpdie) {
		var tmpresolved = resolveSpellCast(tmpcast, tmpdie);
		var tmpname = tmpcaster.name ?? "";
		var tmpout = { outcome: tmpresolved.outcome, resolved: tmpresolved, text: "", attacks: [], changes: [],
			effectsAdded: [], effectsRemoved: [], powersAdded: [], powersRemoved: [], forgetSpell: false,
			drain: tmpresolved.drain, suppressAfter: false, halfMagicAfter: false, mishapEffects: [] };
		var tmpself = tmpoptions?.self ? "on" : "";
		var tmpflags = getSpecialCasterFlags(tmpcaster.className, tmpcast.castingSkill?.name, tmpspell.name);
		var tmpchart = tmpcaster.chart ?? {};

		// One call of his doSpellAction, with the caster's figures in his argument order.
		var tmpaction = (tmpspellname, tmpaura, tmpselfflag, tmpmastery) => tmpworker.doSpellAction(tmpspellname, tmpaura,
			tmpselfflag, tmpcaster.title, tmpcaster.practitionerTitle, tmpcaster.effectList ?? "", tmpcaster.int, tmpcaster.wil,
			tmpcaster.intSave, tmpcaster.wilSave, tmpcaster.end, tmpcaster.absorbAuraChance, tmpcaster.missileMod,
			tmpcaster.intSave, tmpcaster.attackSkill, tmpchart.hitCenter, tmpchart.hitRight, tmpchart.hitHigh,
			tmpchart.hitLeft, tmpchart.hitLow, tmpchart.missRight, tmpchart.missHigh, tmpchart.missLeft, tmpchart.missLow,
			tmpchart.missShort, tmpmastery, tmpcaster.alignment ?? "", tmpcaster.aur, tmpcaster.wis, tmpcaster.powers ?? "",
			tmpflags.isLightfireCaster, tmpflags.isLightfireSpell, tmpflags.isShadowfrostCaster, tmpflags.isShadowfrostSpell, false);

		tmpworker.setHisGlobals?.({ tmpEND: tmpcaster.end, tempAlignment: tmpcaster.alignment ?? "" });
		beginCasting({ attrs: tmpcaster.attrs ?? {}, missileDefense: tmpoptions?.missileDefense ?? 0 });
		try {
			switch (tmpresolved.outcome) {
				case "notMemorized":
					tmpout.text = ` ${tmpname} has not memorized the ${tmpspell.name} spell. Cannot remember how to cast this spell.`;
					break;
				case "forgotten":
					tmpout.text = ` ${tmpname} has forgotten ${tmpspell.name} spell and must refresh it. Cannot remember how to cast this spell.`;
					break;
				case "suppressed":
					tmpout.text = ` ${tmpname} is currently in magically supressed and cannot cast spells. The Aura pocket does not form.`;
					break;
				case "noAura":
					tmpout.text = ` ${tmpname} put no Aura into the spell. The spell fizzles.`;
					break;
				case "hermetic":
					tmpout.text = ` ${tmpname} casts with Hermetic Lore, which mixes ingredients into a ritual. Hermetic casting is not built yet; the Game Master settles it.`;
					break;
				case "overControl":
					// His sentence has the subtraction the wrong way round, (tmpAC-tempSpellAura), so it
					// reads "Reduce 8 by -3" (sheet-worker.js:161955, 161962); the amount to take off is the
					// Aura put in less the Aura Control. Reported upstream 2026-09-24.
					tmpout.text =` ${tmpname} cannot put more than ${tmpresolved.auraControl} Aura into a spell. Reduce ${tmpresolved.aura} by ${tmpresolved.aura - tmpresolved.auraControl} or more, and recast. The spell fizzles.`;
					break;
				case "overPool":
					tmpout.text = ` ${tmpname} does not have ${tmpresolved.aura} Aura in their pool. They have ${tmpcast.auraPool} Aura remaining. The spell fizzles.`;
					break;
				case "pactCritical":
					tmpout.suppressAfter = true;
					tmpout.text = ` ${tmpname} rolled a ${tmpresolved.roll}% against a ${tmpresolved.pact.chance}% ${ARCANE_PACT}, and critically failed. The spell fizzles and they are magically supressed for 1 hour.`;
					break;
				case "pactFailed":
					tmpout.text = ` ${tmpname} rolled a ${tmpresolved.roll}% against a ${tmpresolved.pact.chance}% ${ARCANE_PACT}, and failed. The spell fizzles.`;
					break;
				case "mishap":
					var tmpmishap = runMishap(tmpworker, tmpspell, tmpresolved, tmpname, tmpaction, tmpself);
					tmpout.text = tmpmishap.text;
					tmpout.mishapEffects = getMishapEffects(tmpmishap.result);
					break;
				case "cast":
					var tmpmastery = tmpcast.mastered ? "on" : "";
					var tmpeffect = tmpaction(tmpspell.name, tmpresolved.castAura, tmpself, tmpmastery);
					var tmplead = `spent ${tmpresolved.castTime} with a final intonation of “${tmpspell.magicName ?? ""}”, casting ${tmpspell.name} at ${tmpresolved.castAura} Aura to `;
					if (tmpresolved.pact?.result == "grandmaster") {
						tmpout.text = ` ${tmpname} is a Grandmaster of ${ARCANE_PACT} and always critically succeeds, adding +2 Aura to the spell. ${tmpname} ${tmplead}${tmpeffect}`;
					} else if (tmpresolved.pact?.result == "critical") {
						tmpout.text = ` ${tmpname} rolled a ${tmpresolved.roll}% against a ${tmpresolved.pact.chance}% ${ARCANE_PACT}, and critically succeeded, adding +2 Aura to the spell. ${tmpname} ${tmplead}${tmpeffect}`;
					} else if (tmpresolved.pact?.result == "success") {
						tmpout.text = ` ${tmpname} rolled a ${tmpresolved.roll}% against a ${tmpresolved.pact.chance}% ${ARCANE_PACT}, and succeeded. ${tmpname} ${tmplead}${tmpeffect}`;
					} else {
						tmpout.text = ` ${tmpname} ${tmplead}${tmpeffect}`;
					}
					if (tmpresolved.highAura) {
						var tmphigh = tmpresolved.highAura;
						tmpout.text = tmpout.text + ` HIGH AURA: as a mortal (under 11th title) ${tmpresolved.castAura} Aura was put into a spell. A roll of ${tmphigh.roll}% against a ${tmphigh.save}% Aura save was made to avoid Aura Fatigue, `
							+ (tmphigh.fatigue ? `fail:  ${tmphigh.text}` : "success.");
						if (tmphigh.fatigue) { tmpout.halfMagicAfter = !!tmphigh.halfMagic; }
					}
					break;
			}
		} finally {
			var tmprecord = endCasting();
			Object.assign(tmpout, {
				attacks: tmprecord.attacks, changes: tmprecord.changes, effectsAdded: tmprecord.effectsAdded,
				effectsRemoved: tmprecord.effectsRemoved, powersAdded: tmprecord.powersAdded,
				powersRemoved: tmprecord.powersRemoved, forgetSpell: tmprecord.forgetSpell
			});
		}
		if (tmpresolved.highAura?.fatigue) {
			tmpout.changes.unshift({ label: "Every attribute (Magic, Aura Fatigue)", before: null, after: "" + tmpresolved.highAura.attributes });
		}
		// A change a mishap's Apply button makes is not listed a second time in words.
		var tmpapplied = tmpout.mishapEffects.map(tmpeffect => MISHAP_EFFECT_ATTRIBUTES[tmpeffect.kind]);
		if (tmpapplied.length) { tmpout.changes = tmpout.changes.filter(tmpchange => !tmpapplied.includes(tmpchange.key)); }
		return tmpout;
	}

	// This is the function which writes a mishap, and runs the ones that cast something -- the MAGICAL
	// MISHAP block of his useSpell. A Backfire casts the spell anyway (on the caster, for the table to
	// read); a Double one at twice the Aura; Chaos casts a random spell instead; Raging and Continuous
	// Chaos a string of them; Incineration and Explosion cast those spells at the caster.
	function runMishap(tmpworker, tmpspell, tmpresolved, tmpname, tmpaction, tmpself) {
		var tempSpellAura = tmpresolved.aura;
		var tempMishapResult = tmpworker.getMagicalMishap("", tempSpellAura, tmpresolved.mishapRoll);
		var tempSpellAction = "";
		var tmpdouble = tempSpellAura > 0 ? tempSpellAura * 2 : 0;
		var tmpcasttime = tmpresolved.castTime;
		if (tempMishapResult.includes("Double Backfire")) {
			tempSpellAction = ` ${tmpname} spent ${tmpcasttime} and cast ${tmpspell.name} at ${tmpdouble} Aura to ` + tmpaction(tmpspell.name, tmpdouble, tmpself, "");
		} else if (tempMishapResult.includes("Backfire")) {
			tempSpellAction = ` ${tmpname} spent ${tmpcasttime} and cast ${tmpspell.name} at ${tempSpellAura} Aura to ` + tmpaction(tmpspell.name, tempSpellAura, tmpself, "");
		} else if (tempMishapResult.includes("Raging Chaos") || tempMishapResult.includes("Continuous Chaos")) {
			// A string of random spells, Raging at an Aura each ("Finger of Fire/12 Aura"), Continuous
			// at the original spell's. His code takes every space out before it looks the names up, so
			// a spell of two words was never cast; the names are read whole here. UPSTREAM-ISSUES.md item 73.
			var tmplist = tempMishapResult.slice(tempMishapResult.indexOf("(3d12)") + 6);
			tmplist = tmplist.slice(tmplist.indexOf("(") + 1, tmplist.lastIndexOf(")"));
			tmplist.split(", ").forEach((tmpentry, i) => {
				var tmpspellname = tmpentry.split("/")[0].trim();
				var tmpaura = tmpentry.includes("/") ? (parseInt(tmpentry.split("/")[1]) || 0) : tempSpellAura;
				tempSpellAction = tempSpellAction + ` SPELL ${i + 1}: ${tmpspellname} at ${tmpaura} Aura to ` + tmpaction(tmpspellname, tmpaura, tmpself, "");
			});
		} else if (tempMishapResult.includes("Double Immediate Effect") || tempMishapResult.includes("Double Strength Effect")
				|| tempMishapResult.includes("Double Permanent Effect")) {
			tempSpellAction = ` ${tmpname} spent ${tmpcasttime} and cast ${tmpspell.name} at ${tmpdouble} Aura to ` + tmpaction(tmpspell.name, tmpdouble, tmpself, "");
			if (tempMishapResult.includes("Permanent")) { tempSpellAction = tempSpellAction + " Duration becomes permanent."; }
		} else if (tempMishapResult.includes("Immediate Effect") || tempMishapResult.includes("Permanent Effect")) {
			tempSpellAction = ` ${tmpname} spent ${tmpcasttime} and cast ${tmpspell.name} at ${tempSpellAura} Aura to ` + tmpaction(tmpspell.name, tempSpellAura, tmpself, "");
			if (tempMishapResult.includes("Permanent")) { tempSpellAction = tempSpellAction + " Duration becomes permanent."; }
		} else if (tempMishapResult.includes("Chaos: A random magical spell")) {
			var tmprandom = tempMishapResult.replace("Chaos: A random magical spell (", "")
				.replace(") is cast at the Aura level of the original spell instead. The target becomes random within range (of the caster). ", "");
			tempSpellAction = ` MISHAP SPELL: ${tmprandom} at ${tempSpellAura} Aura to ` + tmpaction(tmprandom, tempSpellAura, tmpself, "")
				+ " Target(s) are randomly determined.";
		} else if (tempMishapResult.includes("Incineration")) {
			tempSpellAction = ` MISHAP SPELL: Incinerate at ${tmpresolved.auraControl} Aura to ` + tmpaction("Incinerate", tmpresolved.auraControl, "on", "");
		} else if (tempMishapResult.includes("Double Strength Explosion")) {
			tempSpellAction = ` MISHAP SPELL: Explosion at ${tmpdouble} Aura to ` + tmpaction("Explosion", tmpdouble, "on", "");
		} else if (tempMishapResult.includes("Explosion")) {
			tempSpellAction = ` MISHAP SPELL: Explosion at ${tempSpellAura} Aura to ` + tmpaction("Explosion", tempSpellAura, "on", "");
		}
		return { result: tempMishapResult,
			text: ` ${tmpname} tried to cast ${tmpspell.name} that was ${tmpresolved.difference} levels higher than their Aura Control, giving a ${tmpresolved.failChance}% failure chance. `
				+ `${tmpresolved.failRoll}% rolled resulting in mishap! Rolled a ${tmpresolved.mishapRoll}% for a magical mishap of ${tempMishapResult}${tempSpellAction}` };
	}

	// @MARKER A MISHAP'S LASTING EFFECTS
	// What his getMagicalMishap does to the caster for good (sheet-worker.js:28871), read back off his
	// own words for the band that came up, for the cast card's Apply buttons. Brought across 2026-09-24
	// from the parallel magic branch; main listed these on the card in words and applied none of them.
	//
	// His sheet applied them on the spot, through setAttrs in a getAttrs callback. Here they wait for a
	// button, as a poison's damage does -- a permanent AUR loss is not a thing to happen by itself on a
	// character sheet a player may have misclicked on -- and the button can be pressed once only
	// (casting-actions.mjs applyMishapEffect). A Loss of Spell is not here: it is applied with the
	// cast, the spell unticked and its days cleared, as main has done since the cast was built.
	//
	//   his band        his words                                      the Apply button
	//   Aura Loss       "1d3=N AUR lost permanently"                   AUR -N, its permanent modifier
	//   Aura Gain       "1d3=N AUR gained permanently"                 AUR +N
	//   Will Loss       "1d4=N WIL lost permanently"                   WIL -N
	//   Will Gain       "1d4=N WIL gained permanently"                 WIL +N
	//   Burnout         "The ability to use Aura for spellcasting      magically suppressed
	//                    is lost"
	//   Wild Wish       "make a wish or lose 1d4=N AUR permanently"    AUR -N, if no wish is made --
	//                                                                  his sheet leaves this one to the
	//                                                                  table; the button is the table's
	//
	// Which of his attribute names each kind is (casting-helpers.mjs records his setAttrs by them), so
	// a change the Apply button makes is not also listed in words.
	export const MISHAP_EFFECT_ATTRIBUTES = { aur: "aura", wil: "willforce", suppress: "magic_suppression" };

	// This is the function which reads a mishap's lasting effects off his words for it.
	// Returns [{ kind ("aur", "wil", "suppress"), value (the change; 0 for suppress), label }].
	export function getMishapEffects(tmpmishaptext) {
		var tmptext = "" + (tmpmishaptext ?? "");
		var tmpout = [];
		var tmpmatch = null;
		if ((tmpmatch = tmptext.match(/^Aura (Loss|Gain): 1d3=(\d+) AUR/))) {
			var tmpaur = parseInt(tmpmatch[2]) || 0;
			tmpout.push({ kind: "aur", value: tmpmatch[1] == "Loss" ? -tmpaur : tmpaur,
				label: `${tmpmatch[1] == "Loss" ? "Lose" : "Gain"} ${tmpaur} AUR permanently` });
		} else if ((tmpmatch = tmptext.match(/^Will (Loss|Gain): 1d4=(\d+) WIL/))) {
			var tmpwil = parseInt(tmpmatch[2]) || 0;
			tmpout.push({ kind: "wil", value: tmpmatch[1] == "Loss" ? -tmpwil : tmpwil,
				label: `${tmpmatch[1] == "Loss" ? "Lose" : "Gain"} ${tmpwil} WIL permanently` });
		} else if (/^Burnout:/.test(tmptext)) {
			tmpout.push({ kind: "suppress", value: 0, label: "Burned out: magically suppressed, no casting" });
		} else if ((tmpmatch = tmptext.match(/^Wild Wish:.*lose 1d4=(\d+) AUR permanently/))) {
			var tmpwish = parseInt(tmpmatch[1]) || 0;
			tmpout.push({ kind: "aur", value: -tmpwish, label: `No wish made within the minute: lose ${tmpwish} AUR permanently` });
		}
		return tmpout;
	}


//==================================================================================================================
// @MARKER AN INVOCATION
//==================================================================================================================

	// This is the function which invokes -- his useInvocation (153430): memorized, uses left and no
	// Divine Denial, and then a use is spent and his doInvocationAction says what it does, at the
	// invoker's Piety level (Piety Control plus any boost).
	//
	//   tmpinvocation = { name, invokeTime, memorized, uses }
	//   tmpinvoker    = { name, title, pietyLevel, effectList, pty, wil, blessChance, blasphemyChance,
	//                     divineKnowledgeChance, missileMod, intSave, attackSkill, chart, end, alignment,
	//                     denial, attrs }
	// Returns { outcome ("notMemorized", "noUses", "denial", "invoked"), text, usesAfter, attacks, ... }.
	export function performInvocation(tmpworker, tmpinvocation, tmpinvoker, tmpoptions) {
		var tmpname = tmpinvoker.name ?? "";
		var tmpuses = parseInt(tmpinvocation.uses) || 0;
		var tmpout = { outcome: "", text: "", usesAfter: tmpuses, attacks: [], changes: [], effectsAdded: [],
			effectsRemoved: [], powersAdded: [], powersRemoved: [] };
		if (!tmpinvocation.memorized) {
			tmpout.outcome = "notMemorized";
			tmpout.text = ` ${tmpname} has not memorized the ${tmpinvocation.name} invocation. Nothing done.`;
			return tmpout;
		}
		if (tmpuses < 1) {
			tmpout.outcome = "noUses";
			tmpout.text = ` ${tmpname} has no uses remaining for ${tmpinvocation.name} invocation. Nothing done.`;
			return tmpout;
		}
		if (tmpinvoker.denial) {
			tmpout.outcome = "denial";
			tmpout.text = ` ${tmpname} is currently in divine denial and cannot use any invocations. Nothing done.`;
			return tmpout;
		}
		var tmpchart = tmpinvoker.chart ?? {};
		tmpworker.setHisGlobals?.({ tmpEND: tmpinvoker.end, tempAlignment: tmpinvoker.alignment ?? "" });
		beginCasting({ attrs: tmpinvoker.attrs ?? {}, missileDefense: tmpoptions?.missileDefense ?? 0 });
		var tmpaction = "";
		try {
			tmpaction = tmpworker.doInvocationAction(tmpinvocation.name, tmpoptions?.self ? "on" : "", tmpinvoker.pietyLevel,
				tmpinvoker.title, tmpinvoker.effectList ?? "", tmpinvoker.pty, tmpinvoker.wil, tmpinvoker.blessChance,
				tmpinvoker.blasphemyChance, tmpinvoker.divineKnowledgeChance, tmpinvoker.missileMod, tmpinvoker.intSave,
				tmpinvoker.attackSkill, tmpchart.hitCenter, tmpchart.hitRight, tmpchart.hitHigh, tmpchart.hitLeft,
				tmpchart.hitLow, tmpchart.missRight, tmpchart.missHigh, tmpchart.missLeft, tmpchart.missLow, tmpchart.missShort);
		} finally {
			var tmprecord = endCasting();
			Object.assign(tmpout, { attacks: tmprecord.attacks, changes: tmprecord.changes, effectsAdded: tmprecord.effectsAdded,
				effectsRemoved: tmprecord.effectsRemoved, powersAdded: tmprecord.powersAdded, powersRemoved: tmprecord.powersRemoved });
		}
		tmpout.outcome = "invoked";
		tmpout.usesAfter = tmpuses - 1;
		tmpout.text = ` ${tmpname} spent ${tmpinvocation.invokeTime ?? ""} and invoked ${tmpinvocation.name} to ${tmpaction}`;
		return tmpout;
	}


//==================================================================================================================
// @MARKER ON THE TARGETS
//==================================================================================================================
// Nothing here is in his sheet, which never knew who a spell was aimed at: it wrote "MR is used to
// avoid damage" and left the roll to the table. The port knows the targets, so it rolls for them.

// The resistance a spell's or invocation's Save column names, as a key of the actor's resistances.
// "None" and the few that name something else ("STR save", "Varies", "Special") roll nothing and are
// left to the table.
export const SAVE_RESISTANCES = {
	"Magic":    "magic",
	"Control":  "control",
	"Illusion": "illusion",
	"Disease":  "disease",       // three invocations (the plagues)
	"Poison":   "poison"
};

// His damage types, as his damage handler's own list names them (combat-tables.mjs ARMOR_BLOCKING).
// A spell says "Fire" where his body damage says "Flame". Where a spell deals two ("Cold/Fire"), each
// half of the damage takes its own.
export const SPELL_DAMAGE_TYPES = {
	//  spell          his damage type
	"Magical":        "Aura/Divine",
	"Chaos":          "Aura/Divine",
	"Fire":           "Flame",
	"Cold":           "Frost",
	"Electricity":    "Electricity",
	"Acid":           "Acid",
	"Sound":          "Sonic",
	"Force":          "Force",
	"Life":           "Life/Death",
	"Death":          "Life/Death",
	"Obliteration":   "Obliteration",
	"Deterioration":  "Other"
};

	// This is the function which gives the body-damage type for a spell's damage type, or each half of
	// "Cold/Fire".
	export function getSpellDamageTypes(tmptype) {
		return ("" + (tmptype ?? "")).split("/").map(tmppart => SPELL_DAMAGE_TYPES[tmppart.trim()] ?? "Other");
	}

	// This is the function which says whether a magical attack's damage goes straight past worn armour,
	// by his own note on it: "bypassing non-magic armor", or a finger's "leather absorbs 1 for 1" (every
	// other armour "does not protect"). The Game Master can change it when the damage is applied.
	export function isSpellBypassingArmor(tmpspecial) {
		return /bypass|leather absorbs/i.test("" + (tmpspecial ?? ""));
	}

	// This is the function which says how much of a spell's damage a target takes after their
	// resistance roll: all of it on a failure, none on a success -- except where the spell's own words
	// say otherwise, read from his text and the book's together (tmpdescription):
	//     half for a success not made by half -- his "Made but not by half causes half damage", the
	//         book's "made, but was greater than a 1/2 save, then half damage" (the Finger spells)
	//     all of it whatever the roll -- "with no save at all except for magical armor" (the Aura
	//         daggers, arrows and bolts, which only a magical armour's own resistance stops)
	// No roll (no resistance named) is all of it.
	export function getResistedFraction(tmpresistance, tmpdescription) {
		var tmpwords = "" + (tmpdescription ?? "");
		if (!tmpresistance) { return 1; }
		if (!tmpresistance.resisted) { return 1; }
		if (/no save at all/i.test(tmpwords)) { return 1; }
		if (tmpresistance.byHalf) { return 0; }
		return /not by half causes half|greater than a 1\/2 save, then half/i.test(tmpwords) ? 0.5 : 0;
	}

	// The modifier a MASTERED spell puts on everyone else's resistance: his masteryText, "all
	// resistances/saves are -20% for other beings".
	export const MASTERY_RESIST_MOD = -20;

// The words a resistance's key is written in, on the card.
export const RESIST_LABELS = { magic: "Magic", control: "Control", illusion: "Illusion", disease: "Disease", poison: "Poison" };

	// This is the function which says whether a spell or invocation can only be aimed at its caster --
	// his self tick, which his change handlers force on for a spell whose range or distance is "Self"
	// and an invocation whose AREA or distance is (sheet-worker.js:22101-22140). Each as he wrote it.
	// The Cast and Invoke dialogs open on the caster for one.
	export function isSelfOnly(tmptype, tmpsystem) {
		if (tmptype == "invocation") { return tmpsystem?.area == "Self" || tmpsystem?.distance == "Self"; }
		return tmpsystem?.range == "Self" || tmpsystem?.distance == "Self";
	}

	// This is the function which gives the resistance a Save column names, or null.
	export function getSaveResistance(tmpsave) {
		return SAVE_RESISTANCES[("" + (tmpsave ?? "")).trim()] ?? null;
	}

	// His text writes an apostrophe as a backtick ("caster`s"); on a card it reads as one.
	export function hisWords(tmptext) {
		return ("" + (tmptext ?? "")).replaceAll("`", "\u2019").trim();
	}

	// This is the function which settles one target's resistance to a cast: the track the Save names,
	// rolled (the d100 passed in) with any modifier, and the share of the damage that leaves them.
	//   tmpvictim = { uuid, name, track } -- track is their resistances[key], or null if they have none
	export function resolveTargetResistance(tmpvictim, tmpkey, tmpmodifier, tmproll, tmpdescription) {
		var tmpentry = { uuid: tmpvictim.uuid, name: tmpvictim.name, resist: null, fraction: 1 };
		if (tmpkey && tmpvictim.track) {
			var tmpres = resolveResistanceRoll(tmpvictim.track.value, tmproll, tmpvictim.track.immune, tmpmodifier);
			tmpentry.resist = { label: RESIST_LABELS[tmpkey], outcome: tmpres.outcome, reason: tmpres.reason,
				resisted: tmpres.resisted, byHalf: tmpres.byHalf, immune: tmpres.outcome == "Immune" };
			tmpentry.fraction = getResistedFraction(tmpres, tmpdescription);
		} else if (tmpkey) {
			tmpentry.note = `has no ${RESIST_LABELS[tmpkey]} Resistance to roll; the Game Master decides.`;
		}
		tmpentry.fractionLabel = tmpentry.fraction == 1 ? "takes it all" : (tmpentry.fraction == 0 ? "takes none of it" : "takes half");
		return tmpentry;
	}

	// This is the function which lays a cast out for its chat card (templates/chat/cast-card.hbs), and
	// for the card's flag, which its Apply buttons read back.
	//   tmpcaster = { uuid, name }
	//   tmpcast   = { kind, name, aura, pietyLevel, usesLeft, outcome, went, drained, text, attacks, changes,
	//                 effectsAdded, effectsRemoved, powersAdded, powersRemoved, forgot, save, self, seconds,
	//                 mishapEffects }
	//   tmptargets  from resolveTargetResistance
	export function buildCastCard(tmpcaster, tmpcast, tmptargets) {
		var tmpresistkey = getSaveResistance(tmpcast.save);
		var tmpattacks = (tmpcast.attacks ?? []).map((tmpa, tmpi) => ({
			index: tmpi, name: tmpa.name, kind: tmpa.kind, isHit: tmpa.isHit, zone: tmpa.zone,
			natural: tmpa.natural, modifier: tmpa.modifier ?? 0, defense: tmpa.defense ?? 0, total: tmpa.total, save: tmpa.save,
			dice: tmpa.dice, damage: tmpa.damage ?? 0, amounts: tmpa.amounts ?? [], damageType: tmpa.damageType,
			bodyTypes: getSpellDamageTypes(tmpa.damageType), special: hisWords(tmpa.special),
			bypass: isSpellBypassingArmor(tmpa.special), applied: []
		}));
		return {
			casterUuid: tmpcaster.uuid, casterName: tmpcaster.name, kind: tmpcast.kind, name: tmpcast.name,
			aura: tmpcast.aura, pietyLevel: tmpcast.pietyLevel, usesLeft: tmpcast.usesLeft,
			outcome: tmpcast.outcome, went: !!tmpcast.went, drained: tmpcast.drained ?? 0,
			text: hisWords(tmpcast.text), attacks: tmpattacks, targets: tmptargets ?? [],
			hitCount: tmpattacks.filter(tmpa => tmpa.isHit).length,
			resistKey: tmpresistkey, resistLabel: tmpresistkey ? RESIST_LABELS[tmpresistkey] : "", save: tmpcast.save ?? "",
			changes: (tmpcast.changes ?? []).map(tmpc => ({ label: tmpc.label,
				text: (tmpc.before !== null && tmpc.before !== undefined && tmpc.before !== "") ? `${tmpc.before} \u2192 ${tmpc.after}` : `${tmpc.after}` })),
			effectsAdded: tmpcast.effectsAdded ?? [], effectsRemoved: tmpcast.effectsRemoved ?? [],
			powersAdded: tmpcast.powersAdded ?? [], powersRemoved: tmpcast.powersRemoved ?? [],
			forgot: !!tmpcast.forgot, self: !!tmpcast.self,
			seconds: tmpcast.seconds ?? 0, spent: false,
			// A mishap's lasting effects, each with its own Apply button and its own once-only mark.
			mishapEffects: (tmpcast.mishapEffects ?? []).map((tmpeffect, tmpi) => ({ index: tmpi, kind: tmpeffect.kind,
				value: tmpeffect.value, label: tmpeffect.label, applied: false }))
		};
	}

// @MARKER THE EFFECTS LIST
	// This is the function which lays a cast's additions to and removals from the effects list onto
	// the list -- his standardSpellAddEffect ("Spell: Fly" joined with ", ") and standardSpellRemovalEffect.
	export function updateEffectList(tmplist, tmpadded, tmpremoved) {
		var tmpentries = ("" + (tmplist ?? "")).split(",").map(tmpe => tmpe.trim()).filter(tmpe => tmpe && tmpe != "None");
		for (const tmpentry of tmpremoved ?? []) { tmpentries = tmpentries.filter(tmpe => tmpe != tmpentry); }
		for (const tmpentry of tmpadded ?? []) { if (!tmpentries.includes(tmpentry)) { tmpentries.push(tmpentry); } }
		return tmpentries.join(", ");
	}


// @MARKER ADD NEW casting rules HERE
// @END (CODE)
