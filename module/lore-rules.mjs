// @START (CODE)
// @MARKER LORE RULES
//==================================================================================================================
// The rules of his Magic/Lore tab -- the consumables, the lores, the spells and the invocations --
// with no Foundry dependency, so they can be tested outside it. The Magic & Lore tab on the character
// sheet (templates/actor/tab-magic.hbs) and module/starting-lore.mjs are only faces on these.
//
// His tab (sheet-magiclore, the "e" button) is five things, and this file carries the rules of each:
//
//     CONSUMABLES   herbs, potions, elixirs, charms and poisons, held as doses. His USE button
//                   takes a dose and, on the last one, removes the row (useHerb, 128949).
//     LORE          ballads, candle rituals, empathy and sympathy rituals, glyphs, hymns, poems,
//                   poison and potion recipes, rituals, runes and songs -- entries KNOWN, learned
//                   with one skill and used with another, each costing memorization points.
//     SPELLS        arcane, from his spellslist; memorized at their level.
//     INVOCATIONS   divine, from his invocationslist; memorized at their level.
//     EVOKES        the Evoke skill's abilities, from his evokedict.
//
// And one thing his creation step does with all of them: provideRandomLoreAndLoreItems
// (sheet-worker.js:146686), which hands a new character entries for every lore it holds and a
// stock of herbs, potions and poisons -- rollStartingLore below.
//
// WHAT IS NOT HERE. The EFFECT of a use. Every one of his use handlers ends in a do<Kind>Action
// switch (doBalladAction, doHerbAction ...) that writes the effect out with the practitioner title
// worked into it -- "heal all listeners for 3d4=7 damage in up to 3 wounded body area(s)" -- and
// some of them change the character (Badger Thorn adds half Endurance). Those switches run to many
// thousands of lines and are a port of their own; until it is done a use reports the roll, the
// practitioner title and the entry's own description, and leaves the effect to the Game Master.
// Spells and invocations are cast and invoked through their own switches, his doSpellAction and
// doInvocationAction, carried across whole: see module/casting-rules.mjs.
//
// Dice are passed in as a function (tmpRoll(sides) -> 1..sides), never taken from Math.random here,
// so every rule can be tested with known dice -- the same practice as the combat and generation rules.
//==================================================================================================================

import { STARTING_LORE_CHAIN, STARTING_LORE_LISTS, POISON_TYPES, POISON_POTENCIES, CASTING_SKILLS,
         STARTING_SPELL_LADDERS, SPELL_PRIMERS } from "./lore-tables.mjs";

	// @MARKER MAGIC KINDS
	// Every kind of thing his Magic/Lore tab holds, keyed by his own repeating-section name -- the
	// same key MAGIC_SUBSYSTEMS in availability.mjs groups its switches by, so a kind always knows
	// which switch turns it off.
	//
	// "learn" is the skill his add button rolls to learn an entry (learnNewBallad and its siblings);
	// "use" is the skill his use button rolls. They differ for three: a hymn is learned with Hymn
	// Lore and intoned with Intone, a poem learned with Poem Lore and recited with Recite, a song
	// learned with Song Lore and sung with Sing (sheet-worker.js:10095-10605). A consumable is used
	// without a roll; a recipe is BREWED with its lore.
	//
	//   kind              item type        subsystem       label              heading             learn            use
	export const MAGIC_KINDS = {
		herb:          { type: "consumable", subsystem: "herbalism", label: "Herb",            heading: "Herbs",            learn: "",               use: "" },
		potion:        { type: "consumable", subsystem: "herbalism", label: "Potion",          heading: "Potions",          learn: "",               use: "" },
		elixir:        { type: "consumable", subsystem: "herbalism", label: "Elixir",          heading: "Elixirs",          learn: "",               use: "" },
		charm:         { type: "consumable", subsystem: "charms",    label: "Charm",           heading: "Charms",           learn: "",               use: "" },
		poison:        { type: "consumable", subsystem: "poisons",   label: "Poison",          heading: "Poisons",          learn: "",               use: "" },
		ballad:        { type: "lore",       subsystem: "bardic",    label: "Ballad",          heading: "Ballads",          learn: "Ballad Lore",    use: "Ballad Lore" },
		candlelore:    { type: "lore",       subsystem: "candlelore",label: "Candle ritual",   heading: "Candle Lore",      learn: "Candle Lore",    use: "Candle Lore" },
		empathymagic:  { type: "lore",       subsystem: "empathy",   label: "Empathy ritual",  heading: "Empathy Magic",    learn: "Empathy Magic",  use: "Empathy Magic" },
		glyph:         { type: "lore",       subsystem: "glyphs",    label: "Glyph",           heading: "Glyphs",           learn: "Glyph",          use: "Glyph" },
		hymn:          { type: "lore",       subsystem: "bardic",    label: "Hymn",            heading: "Hymns",            learn: "Hymn Lore",      use: "Intone" },
		poem:          { type: "lore",       subsystem: "bardic",    label: "Poem",            heading: "Poems",            learn: "Poem Lore",      use: "Recite" },
		poisonrecipe:  { type: "lore",       subsystem: "poisons",   label: "Poison recipe",   heading: "Poison Recipes",   learn: "Poison Lore",    use: "Poison Lore" },
		potionrecipe:  { type: "lore",       subsystem: "herbalism", label: "Potion recipe",   heading: "Potion Recipes",   learn: "Potion Lore",    use: "Potion Lore" },
		ritual:        { type: "lore",       subsystem: "rituals",   label: "Ritual",          heading: "Rituals",          learn: "Ritual Lore",    use: "Ritual Lore" },
		rune:          { type: "lore",       subsystem: "runes",     label: "Rune",            heading: "Runes",            learn: "Rune Lore",      use: "Rune Lore" },
		song:          { type: "lore",       subsystem: "bardic",    label: "Song",            heading: "Songs",            learn: "Song Lore",      use: "Sing" },
		sympathymagic: { type: "lore",       subsystem: "sympathy",  label: "Sympathy ritual", heading: "Sympathy Magic",   learn: "Sympathy Magic", use: "Sympathy Magic" },
		evoke:         { type: "lore",       subsystem: "evoke",     label: "Evoke",           heading: "Evokes",           learn: "",               use: "Evoke" },
		spell:         { type: "spell",      subsystem: "arcane",    label: "Spell",           heading: "Spells",           learn: "",               use: "" },
		invocation:    { type: "invocation", subsystem: "divine",    label: "Invocation",      heading: "Invocations",      learn: "",               use: "Divine Knowledge" }
	};

	// The kinds each item type holds, in the order his tab lays them out.
	export const CONSUMABLE_KINDS = ["herb", "potion", "elixir", "charm", "poison"];
	export const LORE_KINDS = ["ballad", "candlelore", "empathymagic", "glyph", "hymn", "poem", "poisonrecipe",
	                           "potionrecipe", "ritual", "rune", "song", "sympathymagic", "evoke"];

	// The kinds whose entries cost memorization points, as his recalcMemorizationPoints sums them
	// (sheet-worker.js:136587): every lore but the evokes, at the entry's rating, and spells and
	// invocations at their level.
	export const MEMORIZED_KINDS = ["ballad", "candlelore", "empathymagic", "glyph", "hymn", "poem", "poisonrecipe",
	                                "potionrecipe", "ritual", "rune", "song", "sympathymagic", "spell", "invocation"];

	// His Potion Lore rating, which every potion recipe costs to memorize. From his own comment on
	// addPotionRecipeByName (sheet-worker.js:142806): "Potion Lore is rating 15 (thus all potion
	// recipes are 15 memorization points)".
	export const POTION_RECIPE_RATING = 15;

	// The three forms a poison can be made in, and his d10 for a random one (getRandomPoisonForm,
	// sheet-worker.js:147038): 1-5 ingestive, 6-8 contact, 9-10 gaseous.
	export const POISON_FORMS = ["Ingestive", "Contact", "Gaseous"];

	// This is the function which says which kind of thing an item on the character is, whatever its
	// item type -- a spell item is always a spell, the others carry their kind.
	export function getItemKind(tmpitem) {
		if (tmpitem?.type == "spell") { return "spell"; }
		if (tmpitem?.type == "invocation") { return "invocation"; }
		return tmpitem?.system?.kind ?? "";
	}


	// @MARKER DICE
	// This is the function which rolls one of the plain dice strings the lore chain uses -- "1d3",
	// "2d4+1", "3d6+1", "1d4+1" -- his rollDiceFromString. Anything it cannot read rolls as 0.
	export function rollLoreDice(tmpExpression, tmpRoll) {
		var tmpText = ("" + (tmpExpression ?? "")).replace(/\s+/g, "").toLowerCase();
		var tmpMatch = tmpText.match(/^(\d+)d(\d+)([+-]\d+)?$/);
		if (!tmpMatch) { return 0; }
		var tmpTotal = 0;
		for (var i = 0; i < parseInt(tmpMatch[1]); i++) { tmpTotal += tmpRoll(parseInt(tmpMatch[2])); }
		return tmpTotal + (parseInt(tmpMatch[3] ?? "0") || 0);
	}


	// @MARKER PRACTITIONER TITLE
	// This is the function which works out the title a lore is practised at -- his
	// temp_practitioner_title, which every effect of every lore scales by ("1d4 per Practitioner
	// Title"). From storeTempSkillChanceAndMessage (sheet-worker.js:97361):
	//
	//     a class skill        the titles since it was acquired, counting the one it came at:
	//                          (title + 1) - acquired title, never below 0
	//     a racial skill       the character's title, never below 1
	//     a common skill       the same as a racial one
	//     a social skill       0 -- his code falls through to it
	//     not held             0
	export function getPractitionerTitle(tmpCategory, tmpAcquiredAtTitle, tmpTitle) {
		var tmpCharacterTitle = parseInt(tmpTitle) || 0;
		if (tmpCategory == "class") {
			var tmpFound = parseInt(tmpAcquiredAtTitle) || 0;
			return Math.max(0, (tmpCharacterTitle + 1) - tmpFound);
		}
		if (tmpCategory == "racial" || tmpCategory == "common") { return tmpCharacterTitle || 1; }
		return 0;
	}


	// This is the function which says how a character stands in one skill -- the chance a lore roll
	// is made against and the title its effects are scaled by. His storeTempSkillChanceAndMessage,
	// read off the character's own skill items:
	//
	//     held more than once   the best copy, as a skill held twice is rolled by its best
	//     held, not yet reached a class skill his title gate refuses (usableByTitle false) reads 0,
	//                           which is what his sheet's unreached class-skill rows hold
	//     not held              0, practitioner title 0 -- "Not found"
	//
	// A name matches as itself or as its wilderness form, as his lookups do.
	//
	//   tmpSkillItems  the character's skill items (anything with name and system.totalChance,
	//                  category, acquiredAtTitle, usableByTitle)
	//   tmpName        the skill
	//   tmpTitle       the character's title
	export function getSkillStanding(tmpSkillItems, tmpName, tmpTitle) {
		var tmpStanding = { name: tmpName ?? "", held: false, chance: 0, category: "", acquiredAtTitle: 0,
		                    practitionerTitle: 0, reached: true };
		if (!tmpName) { return tmpStanding; }
		for (const tmpItem of tmpSkillItems ?? []) {
			if (tmpItem.name != tmpName && tmpItem.name != tmpName + "(w)") { continue; }
			var tmpReached = tmpItem.system?.usableByTitle !== false;
			var tmpChance = tmpReached ? (parseInt(tmpItem.system?.totalChance) || 0) : 0;
			if (tmpStanding.held && tmpChance <= tmpStanding.chance) { continue; }
			tmpStanding = {
				name: tmpName, held: true, chance: tmpChance, reached: tmpReached,
				category: tmpItem.system?.category ?? "",
				acquiredAtTitle: parseInt(tmpItem.system?.acquiredAtTitle) || 0,
				practitionerTitle: tmpReached ? getPractitionerTitle(tmpItem.system?.category,
					tmpItem.system?.acquiredAtTitle, tmpTitle) : 0
			};
		}
		return tmpStanding;
	}


	// @MARKER ROLLS
	// Three rolls his tab makes against a lore, and all three share his limits:
	//     a total chance of 200% is a Grandmaster, and succeeds without regard to the die
	//     a natural 100 always fails
	//     otherwise the roll must not exceed the total
	// Every one of them caps the total at 200 first, so a chance past it is simply a Grandmaster.
	//
	// Each returns { outcome, roll, total }, where outcome is one of "success", "grandmaster",
	// "failure", "fumble" (the natural 100) or the reason nothing was rolled at all.

	// This is the function which settles a roll to USE a known entry -- handleUseBallad and its
	// twelve siblings (sheet-worker.js:136961). The entry must be memorized: an entry known and not
	// memorized "has not memorized ... Nothing done." The situational modifier (his MOD button's
	// prompt) goes on first and the total is floored at 0; the entry's own modifier goes on after,
	// and the total is floored again -- in that order, as his code does it.
	export function resolveLoreUse(tmpInput, tmpRollValue) {
		var tmpTotal = (parseFloat(tmpInput.chance) || 0) + (parseFloat(tmpInput.situational) || 0);
		if (tmpTotal < 0) { tmpTotal = 0; }
		tmpTotal = tmpTotal + (parseFloat(tmpInput.entryModifier) || 0);
		if (tmpTotal < 0) { tmpTotal = 0; }
		if (tmpTotal > 200) { tmpTotal = 200; }

		if (tmpInput.needsMemorized !== false && !tmpInput.memorized) {
			return { outcome: "notMemorized", roll: null, total: tmpTotal };
		}
		return settleRoll(tmpTotal, tmpRollValue);
	}

	// This is the function which settles a roll to LEARN an entry -- handleLearnNewBallad and its
	// siblings (sheet-worker.js:136770). The learning skill and the situational modifier only: an
	// entry's own modifier is for using it, and is not read here. Nothing is learned twice.
	export function resolveLoreLearn(tmpInput, tmpRollValue) {
		var tmpTotal = (parseFloat(tmpInput.chance) || 0) + (parseFloat(tmpInput.situational) || 0);
		if (tmpTotal > 200) { tmpTotal = 200; }
		if (tmpInput.alreadyKnown) { return { outcome: "alreadyKnown", roll: null, total: tmpTotal }; }
		return settleRoll(tmpTotal, tmpRollValue);
	}

	// This is the function which settles a roll to BREW a batch from a known recipe --
	// handleUsePotionRecipe and handleUsePoisonRecipe (sheet-worker.js:142626, 142851). A recipe does
	// NOT need to be memorized to be brewed: neither handler reads the tick. It needs a batch size,
	// or "has set no batch doses to be made ... Nothing done".
	export function resolveBrew(tmpInput, tmpRollValue) {
		var tmpTotal = (parseFloat(tmpInput.chance) || 0) + (parseFloat(tmpInput.situational) || 0);
		if (tmpTotal < 0) { tmpTotal = 0; }
		if (tmpTotal > 200) { tmpTotal = 200; }
		if (!(parseInt(tmpInput.batchDoses) > 0)) { return { outcome: "noBatch", roll: null, total: tmpTotal }; }
		return settleRoll(tmpTotal, tmpRollValue);
	}

	// This is the function which applies his three limits to one d100 against one total.
	function settleRoll(tmpTotal, tmpRollValue) {
		var tmpRoll = parseInt(tmpRollValue) || 0;
		if (tmpTotal >= 200) { return { outcome: "grandmaster", roll: tmpRoll, total: 200 }; }
		if (tmpRoll == 100)  { return { outcome: "fumble", roll: tmpRoll, total: tmpTotal }; }
		if (tmpRoll > tmpTotal) { return { outcome: "failure", roll: tmpRoll, total: tmpTotal }; }
		return { outcome: "success", roll: tmpRoll, total: tmpTotal };
	}

	// This is the function which says whether an outcome from the three above is a success.
	export function isLoreSuccess(tmpOutcome) {
		return tmpOutcome == "success" || tmpOutcome == "grandmaster";
	}


	// @MARKER CONSUMABLES
	// This is the function which takes one dose -- his useHerb, usePotion, useElixir and usePoison
	// all do the same thing with the count: a dose is spent, and a row left with none is REMOVED
	// (removeRepeatingRow). A use with nothing left does nothing. A charm is the exception: useCharm
	// (sheet-worker.js:135686) never reads a count, since a charm is an object, not a dose.
	//
	// Returns { used, remaining, remove }.
	export function useConsumableDose(tmpKind, tmpDoses) {
		if (tmpKind == "charm") { return { used: true, remaining: parseInt(tmpDoses) || 0, remove: false }; }
		var tmpHave = parseInt(tmpDoses) || 0;
		if (tmpHave < 1) { return { used: false, remaining: 0, remove: false }; }
		return { used: true, remaining: tmpHave - 1, remove: tmpHave - 1 == 0 };
	}


	// @MARKER MEMORIZATION
	// This is the function which works out memorization points -- how much lore a character can hold
	// in mind at once. Two of his functions between them:
	//
	//     updateMemorizationPoints (sheet-worker.js:27463)
	//         total = (goal + 1) x the Knowledge table's memorization points
	//     recalcMemorizationPoints (sheet-worker.js:136587)
	//         used  = the rating of every memorized lore entry, and the level of every memorized
	//                 spell and invocation
	//
	// One allowance of his is kept: a character with ONE thing memorized may hold it even when it
	// costs more than the total -- "if (used > total && count == 1) used = total". So a first
	// ballad of rating 16 can be memorized by a character with 4 points, and a second cannot.
	//
	// tmpEntries: [{ kind, rating, level, memorized }]. Returns
	//     { total, used, available, count, over, byKind: { kind: points } }
	export function getMemorizationTotals(tmpKnowledgePoints, tmpGoal, tmpEntries) {
		var tmpTotalPoints = ((parseInt(tmpGoal) || 0) + 1) * (parseInt(tmpKnowledgePoints) || 0);
		var tmpUsed = 0;
		var tmpCount = 0;
		var tmpByKind = {};
		for (const tmpEntry of tmpEntries ?? []) {
			if (!tmpEntry?.memorized) { continue; }
			if (!MEMORIZED_KINDS.includes(tmpEntry.kind)) { continue; }
			var tmpCost = (tmpEntry.kind == "spell" || tmpEntry.kind == "invocation")
				? (parseInt(tmpEntry.level) || 0)
				: (parseInt(tmpEntry.rating) || 0);
			tmpUsed += tmpCost;
			tmpCount += 1;
			tmpByKind[tmpEntry.kind] = (tmpByKind[tmpEntry.kind] ?? 0) + tmpCost;
		}
		if (tmpUsed > tmpTotalPoints && tmpCount == 1) { tmpUsed = tmpTotalPoints; }
		return {
			total: tmpTotalPoints, used: tmpUsed, available: tmpTotalPoints - tmpUsed, count: tmpCount,
			over: tmpUsed > tmpTotalPoints && tmpCount > 1, byKind: tmpByKind
		};
	}


	// @MARKER POISONS
	// This is the function which builds a poison from its type and potency -- getPoisonDetails
	// (sheet-worker.js:135117). A poison is not a row in any dictionary of his: the type (I-XXV)
	// fixes how long it lasts and what it does, the potency (A-Q) how soon it starts, and the name is
	// simply both, "Type: IV, Potency: C". The rating -- what a recipe costs to memorize -- is the
	// type's number (getPoisonRating, 142523).
	//
	// Returns null for a type or potency he does not have, where his returns a row of zeros.
	export function getPoisonDetails(tmpType, tmpPotency) {
		var tmpTypeRow = POISON_TYPES[tmpType];
		var tmpOnset = POISON_POTENCIES[tmpPotency];
		if (!tmpTypeRow || tmpOnset === undefined) { return null; }
		return {
			name: `Type: ${tmpType}, Potency: ${tmpPotency}`,
			poisonType: tmpType,
			poisonPotency: tmpPotency,
			duration: tmpTypeRow.duration,
			startTime: tmpOnset,
			rating: tmpTypeRow.rating,
			description: tmpTypeRow.effect.replace("{onset}", tmpOnset)
		};
	}

	// @MARKER POISON AGAINST A VICTIM
	// What a dose does to whoever takes it -- his doPoisonAction (sheet-worker.js:135358), run against
	// a victim's own Poison Resistance. The resistance roll itself is resolveResistanceRoll's
	// (module/resistance-rules.mjs), made by the caller; this works out what follows from it.
	//
	//     immune          nothing happens at all
	//     resisted        the type's "if Poison Resistance succeeds" clause
	//     failed          its "if Poison Resistance fails" clause
	//
	// and in both of the last two, the potency's onset and the type's duration are rolled, and a
	// clause that deals Endurance damage "per" some interval has its damage over the whole duration
	// rolled as well -- the Master's Manual's "damage numbers apply to overall Endurance during the
	// poison's duration" (Effects of Poisons, p.103). His handler rolls the duration and leaves the
	// per-interval damage to the table; here each interval is rolled and kept, to be applied to
	// overall Endurance as it lands -- see POISON DAMAGE LANDING.
	//
	// DURATIONS FOLLOW HIS ROW AND THE BOOK, NOT HIS USE HANDLER. For types IV, VIII-XII and XX his
	// doPoisonAction writes "Effects last 1d6=N hour(s)" where his own getPoisonDetails -- the text
	// the poison's row carries -- and the Master's Manual table both say minutes. Taken to be a slip
	// in the handler's units; UPSTREAM-ISSUES.

	// The seconds in each unit his time spans are written in.
	const TIME_UNIT_SECONDS = { second: 1, minute: 60, hour: 3600, day: 86400 };

	// This is the function which rolls one of his time spans -- "1d4 minutes", "2d4 hours",
	// "10-40 minutes" (his 1d4 x 10), "10-30 seconds" (the Player's Guide's (1/2 x d6) x 10, a d3 x 10),
	// "Immediate", "Instantly". Returns { text, label, amount, unit, seconds }; label is the dice as
	// his cards write them ("1d4", "10-40") and amount the number rolled in that unit.
	export function rollTimeSpan(tmpText, tmpRoll) {
		var tmpClean = ("" + (tmpText ?? "")).trim();
		var tmpNow = /^(immediate|instant)/i.test(tmpClean);
		if (tmpNow || !tmpClean) { return { text: tmpClean || "Instantly", label: "", amount: 0, unit: "", seconds: 0 }; }
		var tmpUnitMatch = tmpClean.match(/(second|minute|hour|day)/i);
		var tmpUnit = tmpUnitMatch ? tmpUnitMatch[1].toLowerCase() : "minute";
		var tmpRange = tmpClean.match(/^(\d+)\s*-\s*(\d+)/);
		var tmpAmount = 0;
		var tmpLabel = "";
		if (tmpRange) {
			var tmpLow = parseInt(tmpRange[1]);
			var tmpHigh = parseInt(tmpRange[2]);
			tmpAmount = tmpRoll(Math.max(1, Math.round(tmpHigh / tmpLow))) * tmpLow;
			tmpLabel = `${tmpLow}-${tmpHigh}`;
		} else {
			var tmpDice = tmpClean.match(/^(\d+d\d+(?:[+-]\d+)?)/i);
			tmpLabel = tmpDice ? tmpDice[1] : "";
			tmpAmount = tmpDice ? rollLoreDice(tmpDice[1], tmpRoll) : (parseInt(tmpClean) || 0);
		}
		return { text: `${tmpLabel}=${tmpAmount} ${tmpUnit}${tmpAmount == 1 ? "" : "s"}`, label: tmpLabel,
		         amount: tmpAmount, unit: tmpUnit, seconds: tmpAmount * TIME_UNIT_SECONDS[tmpUnit] };
	}

	// This is the function which splits a type's effect into what happens on a made Poison
	// Resistance and on a failed one. His getPoisonDetails writes both into one sentence.
	export function splitPoisonEffect(tmpType) {
		var tmpText = POISON_TYPES[tmpType]?.effect ?? "";
		var tmpMatch = tmpText.match(/succeeds:\s*(.*?)\.\s*If Poison Resistance fails:\s*(.*?)\.\s*Effect starts/i);
		return tmpMatch ? { success: tmpMatch[1].trim(), fail: tmpMatch[2].trim() } : { success: "", fail: "" };
	}

	// This is the function which reads the damage out of a clause -- "1d6 Base Endurance damage per
	// 1 minute", "1d4 Base Endurance damage per 10 seconds" -- as { dice, everySeconds }, or null for
	// a clause that deals none (sleep, paralysis, death, "no damage or effect").
	export function getPoisonDamage(tmpClause) {
		var tmpMatch = ("" + (tmpClause ?? "")).match(/(\d+d\d+)\s+Base Endurance damage per\s+(\d+)?\s*(second|minute|hour|day)/i);
		if (!tmpMatch) { return null; }
		return { dice: tmpMatch[1], everySeconds: (parseInt(tmpMatch[2]) || 1) * TIME_UNIT_SECONDS[tmpMatch[3].toLowerCase()] };
	}

	// This is the function which works out what one dose does to one victim.
	//
	//   tmpInput = { type, potency, resistance } -- resistance is resolveResistanceRoll's result
	//
	// Returns { outcome: "immune" | "resisted" | "failed", clause, onset, duration, damage, death },
	// where damage is { dice, everySeconds, times, total } or null.
	export function resolvePoisonOnVictim(tmpInput, tmpRoll) {
		var tmpResistance = tmpInput.resistance ?? {};
		if (tmpResistance.outcome == "Immune") {
			return { outcome: "immune", clause: "no effect", onset: null, duration: null, damage: null, death: false };
		}
		var tmpOutcome = tmpResistance.resisted ? "resisted" : "failed";
		var tmpClauses = splitPoisonEffect(tmpInput.type);
		var tmpClause = tmpOutcome == "resisted" ? tmpClauses.success : tmpClauses.fail;
		var tmpNothing = /no damage or effect/i.test(tmpClause);
		var tmpResult = { outcome: tmpOutcome, clause: tmpClause, onset: null, duration: null, damage: null,
		                  death: /\bdeath\b/i.test(tmpClause) };
		if (tmpNothing) { return tmpResult; }

		tmpResult.onset = rollTimeSpan(POISON_POTENCIES[tmpInput.potency], tmpRoll);
		tmpResult.duration = rollTimeSpan(POISON_TYPES[tmpInput.type]?.duration, tmpRoll);
		var tmpDamage = getPoisonDamage(tmpClause);
		if (tmpDamage) {
			var tmpTimes = Math.max(1, Math.floor(tmpResult.duration.seconds / tmpDamage.everySeconds));
			var tmpDiceMatch = tmpDamage.dice.match(/^(\d+)d(\d+)$/);
			var tmpAll = `${parseInt(tmpDiceMatch[1]) * tmpTimes}d${tmpDiceMatch[2]}`;
			// Each interval rolled on its own and kept, so that it can be applied as it lands (see
			// POISON DAMAGE LANDING below). The same dice, in the same order, as rolling them all at once.
			var tmpRolls = [];
			for (var i = 0; i < tmpTimes; i++) { tmpRolls.push(rollLoreDice(tmpDamage.dice, tmpRoll)); }
			tmpResult.damage = { dice: tmpDamage.dice, everySeconds: tmpDamage.everySeconds, times: tmpTimes,
			                     all: tmpAll, total: tmpRolls.reduce((tmpSum, tmpOne) => tmpSum + tmpOne, 0), rolls: tmpRolls };
		}
		return tmpResult;
	}

	// @MARKER POISON DAMAGE LANDING
	// When a poison's Endurance damage lands, and on what. The Master's Manual: the damage numbers
	// "apply to overall Endurance during the poison's duration" (Effects of Poisons, p.103), each
	// written "per" an interval -- "1d6 per Min" for "1d6 Min". His doPoisonAction writes the clause
	// and rolls the duration, and applies nothing (sheet-worker.js:135358); there is no overall-
	// Endurance figure on his sheet to apply it to.
	//
	// READ HERE AS: nothing lands before the poison takes effect (the potency's onset); then one
	// interval's damage at the END of each interval of the duration -- 1d6 a minute for 3 minutes
	// is three blows, at onset + 1, + 2 and + 3 minutes -- so the whole of it has landed when the
	// duration ends. Onto OVERALL Endurance by the user's ruling: added to the victim's total wounds
	// (body.overallWounds, counted in totalWounds and so toward shock), on no body area, and past
	// no armour, hide, pain threshold or absorption -- it is inside the victim.

	// This is the function which says how many of a poison's intervals have landed, tmpSince seconds
	// after it was taken, given its rolled onset (seconds). Never more than it has.
	export function getPoisonIntervalsDue(tmpDamage, tmpOnsetSeconds, tmpSince) {
		if (!tmpDamage) { return 0; }
		var tmpInto = (parseFloat(tmpSince) || 0) - (parseFloat(tmpOnsetSeconds) || 0);
		if (tmpInto < tmpDamage.everySeconds) { return 0; }
		return Math.min(tmpDamage.times, Math.floor(tmpInto / tmpDamage.everySeconds));
	}

	// This is the function which works out the damage of the next tmpCount intervals, when
	// tmpApplied of them have already been applied. Returns { amount, applied, remaining, done } --
	// applied and remaining as they stand after these.
	export function getPoisonDamageToApply(tmpDamage, tmpApplied, tmpCount) {
		var tmpRolls = tmpDamage?.rolls ?? [];
		var tmpFrom = Math.max(0, Math.min(tmpRolls.length, parseInt(tmpApplied) || 0));
		var tmpTo = Math.max(tmpFrom, Math.min(tmpRolls.length, tmpFrom + (parseInt(tmpCount) || 0)));
		var tmpAmount = 0;
		for (var i = tmpFrom; i < tmpTo; i++) { tmpAmount = tmpAmount + (parseInt(tmpRolls[i]) || 0); }
		return { amount: tmpAmount, applied: tmpTo, remaining: tmpRolls.length - tmpTo, done: tmpTo >= tmpRolls.length };
	}

	// This is the function which puts damage onto overall Endurance.
	//
	//   tmpInput = { damage, overallWounds, totalWounds, shock, endurance }
	//     overallWounds   what overall Endurance has already taken (body.overallWounds)
	//     totalWounds     every wound on the victim before this, areas and overall
	//     shock           the victim's Shock (0 is none -- an immune creature's)
	//     endurance       the victim's whole Endurance (characteristics.endurance), for the report
	//
	// Returns { overallWounds, totalWounds, inShock, pastEndurance }.
	export function applyOverallDamage(tmpInput) {
		var tmpDamage = Math.max(0, parseInt(tmpInput.damage) || 0);
		var tmpTotal = (parseInt(tmpInput.totalWounds) || 0) + tmpDamage;
		var tmpShock = parseInt(tmpInput.shock) || 0;
		var tmpEndurance = parseInt(tmpInput.endurance) || 0;
		return {
			overallWounds: (parseInt(tmpInput.overallWounds) || 0) + tmpDamage,
			totalWounds: tmpTotal,
			inShock: (tmpShock != 0) && (tmpTotal > tmpShock),
			pastEndurance: (tmpEndurance > 0) && (tmpTotal > tmpEndurance)
		};
	}

	// @MARKER POISON ON A WEAPON
	// A dose of poison put on a weapon, and when a hit delivers it. His sheet has no poisoned weapon:
	// his poison USE spends a dose and describes it, and the "on self" tick is the only victim he
	// rolls for (usePoison, doPoisonAction; sheet-worker.js:135316). So these are the books':
	//
	//   THE FORMS. Ingestive "must be imbibed or introduced into the bloodstream", Contact "must
	//   contact the skin", Gaseous "must be inhaled" (Master's Manual p.103, Poison Forms; Player's
	//   Guide p.136). A blade can carry the first two into a wound; a gas cannot be put on one.
	//   His own errata for the creatures' Venom (Master's Manual p.291) calls a poison delivered
	//   by a wound "insinuative" -- a fourth word for the second of these, not a form on his sheet.
	//
	//   AN ENVENOMED BLADE (Mysteries of the Planes p.175, his Customize panel's "Envenomed"): a
	//   hollow blade and a hilt that "holds 1 dose of poison per 10% additional weapon cost (up to 5
	//   doses). When the weapon thrusts into a target and does 10 or more actual damage, then 1 dose
	//   of poison is applied to the target." Taken exactly: a thrust, 10 or more through armour and
	//   hide, one dose each time, up to 5 held. What was paid for is not recorded, so 5 is the cap.
	//
	//   A PLAIN COATING, which no book writes a rule for. READ HERE AS one dose, spent by the first
	//   hit that does actual flesh damage (1 or more through armour, hide and absorption) in any
	//   attack mode: that is the hit that reaches the skin or the blood, which both forms need. A
	//   blow the armour stops entirely reaches neither, and leaves the coating on. The 10-point
	//   threshold is the Envenomed blade's, a mechanism that squirts from the tip, and is the book's
	//   "stuck" threshold for a thrust (Player's Guide, Getting a Weapon Stuck) -- not applied to a
	//   smear on an edge. One dose coats once; a second dose on a coated weapon is refused rather
	//   than stacked, and a different poison is refused until the first is wiped off.

	// How many doses an Envenomed hilt holds (his "up to 5"), and the actual damage a thrust must do.
	export const ENVENOMED_DOSES = 5;
	export const ENVENOMED_THRESHOLD = 10;

	// This is the function which says whether the weapon is Envenomed -- his panel's customization.
	export function isEnvenomed(tmpSystem) {
		return (tmpSystem?.custom?.customizations ?? []).includes("Envenomed");
	}

	// This is the function which says whether a dose of this poison can go onto this weapon, and
	// what the weapon's coating is afterwards.
	//
	//   tmpPoison = { name, poisonType, poisonPotency, form }
	//   tmpSystem   the weapon's system
	//
	// Returns { ok, reason, coating } -- coating the weapon's system.coating once the dose is on.
	export function coatWeapon(tmpPoison, tmpSystem) {
		var tmpForm = "" + (tmpPoison?.form ?? "");
		if (tmpForm == "Gaseous") {
			return { ok: false, reason: "A gaseous poison must be inhaled; it cannot be put on a weapon.", coating: null };
		}
		var tmpHave = tmpSystem?.coating ?? {};
		var tmpDoses = parseInt(tmpHave.doses) || 0;
		var tmpSame = tmpDoses > 0 && tmpHave.name == tmpPoison.name;
		if (tmpDoses > 0 && !tmpSame) {
			return { ok: false, reason: `It is already coated with ${tmpHave.name}. Wipe that off first (weapon mods).`, coating: null };
		}
		var tmpMost = isEnvenomed(tmpSystem) ? ENVENOMED_DOSES : 1;
		if (tmpDoses >= tmpMost) {
			return { ok: false, reason: tmpMost == 1 ? `It is already coated with ${tmpHave.name}; a second dose adds nothing.`
				: `Its hilt already holds ${tmpMost} doses, the most an Envenomed blade can.`, coating: null };
		}
		return { ok: true, reason: "", coating: { name: tmpPoison.name, poisonType: tmpPoison.poisonType ?? "",
			poisonPotency: tmpPoison.poisonPotency ?? "", form: tmpForm, doses: tmpDoses + 1 } };
	}

	// This is the function which says whether a hit delivers the weapon's poison.
	//
	//   tmpInput = { coating, envenomed, mode, fleshDamage }
	//     mode          the attack's mode (thrust, cut, smash, missile)
	//     fleshDamage   what got through armour, hide and absorption onto the area
	//
	// Returns { delivers, remaining, reason } -- remaining the doses left on the weapon.
	export function resolveCoatingDelivery(tmpInput) {
		var tmpDoses = parseInt(tmpInput.coating?.doses) || 0;
		var tmpFlesh = parseInt(tmpInput.fleshDamage) || 0;
		if (tmpDoses <= 0) { return { delivers: false, remaining: 0, reason: "not poisoned" }; }
		if (tmpInput.envenomed) {
			if (tmpInput.mode != "thrust") {
				return { delivers: false, remaining: tmpDoses, reason: "an Envenomed blade delivers only on a thrust" };
			}
			if (tmpFlesh < ENVENOMED_THRESHOLD) {
				return { delivers: false, remaining: tmpDoses,
				         reason: `an Envenomed blade needs ${ENVENOMED_THRESHOLD} or more actual damage (${tmpFlesh} got through)` };
			}
			return { delivers: true, remaining: tmpDoses - 1, reason: "" };
		}
		if (tmpFlesh < 1) { return { delivers: false, remaining: tmpDoses, reason: "nothing got through to the flesh; the coating stays on" }; }
		return { delivers: true, remaining: tmpDoses - 1, reason: "" };
	}

	// This is the function which writes what resolvePoisonOnVictim worked out as the lines of a chat
	// card, kept beside the rule so a test can read it without a chat message existing.
	export function describePoisonOnVictim(tmpResult) {
		if (tmpResult.outcome == "immune") { return ["Immune to poison: it has no effect."]; }
		var tmpLines = [`${tmpResult.outcome == "resisted" ? "Resisted" : "Failed"}: ${tmpResult.clause}.`];
		if (tmpResult.onset) {
			tmpLines.push(tmpResult.onset.amount ? `Takes effect in ${tmpResult.onset.text}.` : "Takes effect at once.");
		}
		if (tmpResult.duration) {
			tmpLines.push(tmpResult.duration.amount
				? `${tmpResult.death ? "Death comes within" : "Lasts"} ${tmpResult.duration.text}.`
				: (tmpResult.death ? "Death is immediate." : ""));
		}
		if (tmpResult.damage) {
			tmpLines.push(`Endurance damage over the whole of it: ${tmpResult.damage.times} x ${tmpResult.damage.dice}`
				+ ` (${tmpResult.damage.all}) = ${tmpResult.damage.total}, to overall Endurance, one interval's`
				+ ` as each ends.`);
		}
		return tmpLines.filter(tmpLine => tmpLine);
	}

	// This is the function which rolls his random poison form (getRandomPoisonForm).
	export function rollPoisonForm(tmpRoll) {
		var tmpDie = tmpRoll(10);
		if (tmpDie < 6) { return "Ingestive"; }
		if (tmpDie < 9) { return "Contact"; }
		return "Gaseous";
	}

	// The poison types each alignment may start knowing, and the doses of each it starts with --
	// checkPoisonRecipeLore (sheet-worker.js:146965). The good and the unaligned know only the
	// mildest five, all of which put the victim to sleep or paralyse it; the evil know all 25.
	export function getStartingPoisonTypes(tmpAlignment) {
		var tmpText = "" + (tmpAlignment ?? "");
		if (tmpText.includes("Evil"))    { return { types: STARTING_LORE_LISTS.getPoisonTypeEvilList, doses: "2d6" }; }
		if (tmpText.includes("Neutral")) { return { types: STARTING_LORE_LISTS.getPoisonTypeNeutralList, doses: "2d4" }; }
		return { types: STARTING_LORE_LISTS.getPoisonTypeGoodList, doses: "1d4+1" };
	}


	// @MARKER HERBS
	// This is the function which says how many doses of a herb a new herbalist starts with, from
	// what the herb is worth -- checkHerbLore (sheet-worker.js:147285). The rarer the herb, the fewer:
	// platinum 1d2, gold 1d4+1, silver 2d4+1, copper 3d6+1, anything else 1d4. His value column reads
	// "2-4 sp.", so the coin is found by its abbreviation anywhere in the text, in his order.
	export function getHerbDoseDice(tmpValue) {
		var tmpText = "" + (tmpValue ?? "");
		if (tmpText.includes("pp.")) { return "1d2"; }
		if (tmpText.includes("gp.")) { return "1d4+1"; }
		if (tmpText.includes("sp.")) { return "2d4+1"; }
		if (tmpText.includes("cp.")) { return "3d6+1"; }
		return "1d4";
	}


	// @MARKER STARTING LORE
	// This is the function which counts how many times a character holds a lore's skill -- his
	// storeSkillCountForSkills (sheet-worker.js:98140). Each lore hands out one entry per instance,
	// so a lore held twice gives two.
	//
	// WHAT HE COUNTS, which is wider than "what the character holds today": the twenty racial skill
	// rows AND his class skill rows for titles 1 to 10 -- every class skill the class WILL give, not
	// only those already reached, because his setFinalClassSkills writes a class's whole progression
	// onto the sheet at creation (sheet-worker.js:63177, with the later titles' chances left at 0).
	// His own comment says so: "doesn't look at class skills over 10th title". So a Ranger, whose
	// Herb Lore arrives at title 2, starts with a herb. Kept as he has it; asked in UPSTREAM-ISSUES.
	//
	// A name matches as itself or as its wilderness form, "Herb Lore(w)", as his does.
	//
	//   tmpSkillNames   every racial skill name the character holds, then every class skill name of
	//                   titles 1-10, one entry per row -- see getCountedSkillNames
	//   tmpWanted       the one or two names the lore counts, e.g. ["Intone", "Hymn Lore"]
	export function countLoreSkill(tmpSkillNames, tmpWanted) {
		var tmpCount = 0;
		for (const tmpName of tmpSkillNames ?? []) {
			for (const tmpWant of tmpWanted ?? []) {
				if (tmpName == tmpWant || tmpName == tmpWant + "(w)") { tmpCount += 1; break; }
			}
		}
		return tmpCount;
	}

	// This is the function which lists the skill rows his count reads: the racial skills held, then
	// each class's skills for titles 1 to 10 in its own order. A class slot that differs for a race
	// that cannot cast counts only the one this character would get -- his nocast, as the
	// generator's own class skills do.
	//
	// A dual-classed character counts both classes. His sheet has one class and never faces it;
	// a second class's lores are as much this character's as the first's.
	export function getCountedSkillNames(tmpRacialSkillNames, tmpClassSystems, tmpCannotCast) {
		var tmpNames = [...(tmpRacialSkillNames ?? [])];
		for (const tmpClassSystem of tmpClassSystems ?? []) {
			for (const tmpSkill of tmpClassSystem?.advancement?.classSkillList ?? []) {
				var tmpTitle = parseInt(tmpSkill.title) || 0;
				if (tmpTitle < 1 || tmpTitle > 10) { continue; }
				if (tmpSkill.requires == "nonCaster" && !tmpCannotCast) { continue; }
				if (tmpSkill.requires == "caster" && tmpCannotCast) { continue; }
				tmpNames.push(tmpSkill.name);
			}
		}
		return tmpNames;
	}

	// This is the function which draws some number of DIFFERENT names from a list, his way: pick at
	// random, and pick again if it is already taken.
	//
	// Two departures, neither of which changes what a character can end up with. His "already taken"
	// test is a substring test on the joined list, so drawing "Healing" after "Super Healing" is
	// refused and redrawn; here it is the name itself. And his loop has no way out when a list is
	// shorter than the count -- an endless loop -- so the draw stops when the list runs out and says so.
	//
	// A third, for a die that breaks its 1..n promise: the draw gives up after 1000 tries, the way the
	// hymn and spell draws below already do. A fixed die (a preview's () => 1) can never find a second
	// different name, and without the guard the loop would freeze the window with no error at all. The
	// caller sees fewer names than it asked for and reports it.
	export function drawDistinct(tmpList, tmpCount, tmpRoll) {
		var tmpOut = [];
		var tmpWanted = Math.min(parseInt(tmpCount) || 0, (tmpList ?? []).length);
		var tmpGuard = 0;
		while (tmpOut.length < tmpWanted && tmpGuard < 1000) {
			tmpGuard += 1;
			var tmpPick = pickByDie(tmpList, tmpRoll);
			if (tmpPick !== undefined && !tmpOut.includes(tmpPick)) { tmpOut.push(tmpPick); }
		}
		return tmpOut;
	}

	// This is the function which picks one entry of a list by a die of its length -- his
	// list[getDieRoll(n)-1] -- with the die held to 1..n. An in-contract die picks exactly what it
	// always did; a 0, a NaN or a face past the end lands on the nearest end of the list instead of
	// reading undefined off it (the Review step's crash on 0.18.1, DECISIONS 2026-09-23 "A preview's
	// fixed die is a 1"). An empty list gives undefined, and the caller says so.
	export function pickByDie(tmpList, tmpRoll) {
		var tmpLength = (tmpList ?? []).length;
		if (tmpLength < 1) { return undefined; }
		var tmpFace = parseInt(tmpRoll(tmpLength)) || 1;
		tmpFace = Math.max(1, Math.min(tmpLength, tmpFace));
		return tmpList[tmpFace - 1];
	}

	// This is the function which picks the list a hymn is drawn from -- checkHymn
	// (sheet-worker.js:146851). The FIRST hymn is the lorist's own alignment's: good, evil, neutral,
	// or the unaligned list for anyone else. Every one after that is unaligned -- unless the lorist
	// is neutral, when each later one is a d2 between the neutral and the unaligned lists.
	//
	// His tests are "includes", so a free-text alignment is read the way he reads it: "Chaotic Good"
	// is good, and -- as his code has it -- so is "Non-Good".
	export function getHymnList(tmpAlignment, tmpFirst, tmpRoll) {
		var tmpText = "" + (tmpAlignment ?? "");
		if (tmpFirst) {
			if (tmpText.includes("Good"))    { return STARTING_LORE_LISTS.getGoodHymnList; }
			if (tmpText.includes("Evil"))    { return STARTING_LORE_LISTS.getEvilHymnList; }
			if (tmpText.includes("Neutral")) { return STARTING_LORE_LISTS.getNeutralHymnList; }
			return STARTING_LORE_LISTS.getUnalignedHymnList;
		}
		if (tmpText.includes("Neutral") && tmpRoll(2) < 2) { return STARTING_LORE_LISTS.getNeutralHymnList; }
		return STARTING_LORE_LISTS.getUnalignedHymnList;
	}

	// The list function each plain step draws from. Hymns, poisons and herbs have their own rules.
	const STARTING_LIST_BY_KIND = {
		ballad: "getBalladLoreList", candlelore: "getCandleLoreList", empathymagic: "getEmpathyMagicList",
		glyph: "getGlyphList", poem: "getPoemLoreList", potionrecipe: "getPotionLoreList",
		ritual: "getRitualLoreList", rune: "getRuneLoreList", song: "getSongLoreList",
		sympathymagic: "getSympathyMagicList", herb: "getHerbLoreList"
	};

	// This is the function which hands a new character its starting lore -- the whole of
	// provideRandomLoreAndLoreItems, in his order: ballads, candle rituals, empathy rituals, glyphs,
	// hymns, poems, poison recipes, potion recipes, rituals, runes, songs, sympathy rituals, herbs,
	// and then starting spells.
	//
	//   tmpInput = {
	//       skillNames:       getCountedSkillNames(...) -- what his count reads
	//       alignment:        free text, read with "includes" as his is
	//       herbCommonChance: the character's common-skill chance at Herb Lore (base chance alone),
	//                         or a negative number when not relevant -- see the herb step
	//       noIntake:         the race has the disability "No Intake" (it cannot eat a herb)
	//       herbValues:       { herb name: its value column }, for the dose dice
	//       casting:          { name, chance } -- the best of the five casting skills, or null
	//       affinity, fortune the two percentages the cantrip book is rolled against
	//   }
	//
	// Returns { entries, equipment, issues }:
	//     entries    [{ kind, name, doses?, form?, poisonType?, poisonPotency? }] -- one per item to
	//                make; a recipe and the stock it brought are two entries
	//     equipment  names of plain equipment to add (a spell primer)
	//     issues     anything the port did differently from his sheet, or could not do, to be shown
	export function rollStartingLore(tmpInput, tmpRoll) {
		var tmpEntries = [];
		var tmpIssues = [];
		var tmpEquipment = [];

		for (const tmpStep of STARTING_LORE_CHAIN) {
			var tmpCount = countLoreSkill(tmpInput.skillNames, tmpStep.skills);

			// @MARKER HERB STEP
			// Herb Lore is also a COMMON skill -- anyone may attempt it -- and a character who is not
			// a herbalist may still have picked up one herb before play: his checkHerbLore rolls the
			// common chance plus 20 ("time before starting class and likely aid from teacher, book,
			// etc.") and a success is one herb more. Not for a race that takes nothing in.
			if (tmpStep.kind == "herb") {
				if (!tmpInput.noIntake && (parseInt(tmpInput.herbCommonChance) || 0) > 0) {
					var tmpCommonChance = (parseInt(tmpInput.herbCommonChance) || 0) + 20;
					if (tmpRoll(100) <= tmpCommonChance) { tmpCount += 1; }
				}
			}
			if (tmpCount < 1) { continue; }

			// @MARKER HYMN STEP
			if (tmpStep.kind == "hymn") {
				var tmpHymns = [];
				var tmpGuard = 0;
				while (tmpHymns.length < tmpCount && tmpGuard < 1000) {
					tmpGuard += 1;
					var tmpList = getHymnList(tmpInput.alignment, tmpHymns.length == 0, tmpRoll);
					var tmpPick = pickByDie(tmpList, tmpRoll);
					if (tmpPick !== undefined && !tmpHymns.includes(tmpPick)) { tmpHymns.push(tmpPick); }
				}
				if (tmpHymns.length < tmpCount) {
					tmpIssues.push(`${MAGIC_KINDS.hymn?.heading ?? "hymn"}: held ${tmpCount} times, and only ${tmpHymns.length} different could be drawn.`);
				}
				for (const tmpName of tmpHymns) { tmpEntries.push({ kind: "hymn", name: tmpName }); }
				continue;
			}

			// @MARKER POISON STEP
			// One recipe per Poison Lore held, each a random type from the alignment's list, a random
			// potency and a random form, and a stock of that poison "made in the past". Types are NOT
			// drawn distinct here -- his does not check -- so two recipes may share a type at
			// different potencies.
			//
			// HIS LOOP KEEPS ONLY THE LAST ONE. It builds the list with the same first/else pattern as
			// every other step and never sets first to false, so each pass overwrites the one before
			// and a character with Poison Lore twice gets one recipe. Every sibling step sets it, and
			// the comment on this one says "provide lore for each skill instance", so this is taken to
			// be a slip and one recipe is given per instance. UPSTREAM-ISSUES.md.
			if (tmpStep.kind == "poisonrecipe") {
				var tmpPoisons = getStartingPoisonTypes(tmpInput.alignment);
				var tmpPotencies = STARTING_LORE_LISTS.getPoisonPotencyList;
				for (var tmpIndex = 0; tmpIndex < tmpCount; tmpIndex++) {
					var tmpType = pickByDie(tmpPoisons.types, tmpRoll);
					var tmpPotency = pickByDie(tmpPotencies, tmpRoll);
					var tmpForm = rollPoisonForm(tmpRoll);
					var tmpDetails = getPoisonDetails(tmpType, tmpPotency);
					if (!tmpDetails) {
						tmpIssues.push(`Poison recipe: no poison of type ${tmpType} and potency ${tmpPotency} could be made.`);
						continue;
					}
					tmpEntries.push({ kind: "poisonrecipe", name: tmpDetails.name, form: tmpForm,
					                  poisonType: tmpType, poisonPotency: tmpPotency });
					tmpEntries.push({ kind: "poison", name: tmpDetails.name, form: tmpForm,
					                  poisonType: tmpType, poisonPotency: tmpPotency,
					                  doses: rollLoreDice(tmpPoisons.doses, tmpRoll) });
				}
				continue;
			}

			// @MARKER PLAIN STEPS
			// Everything else: that many different names from the lore's list. Potions bring 1d3
			// doses of each recipe's potion with them; herbs are only doses, by value.
			var tmpListName = STARTING_LIST_BY_KIND[tmpStep.kind];
			var tmpNames = STARTING_LORE_LISTS[tmpListName] ?? [];
			if (tmpCount > tmpNames.length) {
				tmpIssues.push(`${MAGIC_KINDS[tmpStep.kind]?.heading ?? tmpStep.kind}: held ${tmpCount} times, and his list has only ${tmpNames.length} to give.`);
			}
			var tmpDrawn = drawDistinct(tmpNames, tmpCount, tmpRoll);
			if (tmpDrawn.length < Math.min(tmpCount, tmpNames.length)) {
				tmpIssues.push(`${MAGIC_KINDS[tmpStep.kind]?.heading ?? tmpStep.kind}: held ${tmpCount} times, and only ${tmpDrawn.length} different could be drawn.`);
			}
			for (const tmpName of tmpDrawn) {
				if (tmpStep.kind == "herb") {
					var tmpValue = (tmpInput.herbValues ?? {})[tmpName];
					tmpEntries.push({ kind: "herb", name: tmpName, doses: rollLoreDice(getHerbDoseDice(tmpValue), tmpRoll) });
				} else if (tmpStep.kind == "potionrecipe") {
					tmpEntries.push({ kind: "potionrecipe", name: tmpName });
					tmpEntries.push({ kind: "potion", name: tmpName, doses: rollLoreDice("1d3", tmpRoll) });
				} else {
					tmpEntries.push({ kind: tmpStep.kind, name: tmpName });
				}
			}
		}

		// @MARKER STARTING SPELLS
		var tmpSpells = rollStartingSpells(tmpInput, tmpRoll);
		for (const tmpName of tmpSpells.spells) { tmpEntries.push({ kind: "spell", name: tmpName }); }
		if (tmpSpells.primer) { tmpEquipment.push(tmpSpells.primer); }

		return { entries: tmpEntries, equipment: tmpEquipment, issues: tmpIssues };
	}

	// This is the function which hands a new caster its starting spells -- checkStartingSpells and
	// getStartingSpellList (sheet-worker.js:147318, 171008). Only for a character whose best casting
	// skill is one of his five (CASTING_SKILLS: Hermetic Lore, Scroll Knowledge, Arcane Pact,
	// Lightfire Knowledge, Shadowfrost Knowledge).
	//
	//     how many   the greater of 1d4+2 and a tenth of the casting skill's chance (at least 1),
	//                never more than 20
	//     which      offensive, defensive, utility, offensive ... in turn, each from its own d100
	//                ladder, and never the same spell twice
	//     a primer   if a d100 falls within Affinity OR a second d100 within Fortune, one of his
	//                twelve spell primers, at random, among the character's equipment (getCantripBook)
	//
	// His duplicate test here is a substring test as well -- "Hold" is refused once "Hold Plant" is
	// in -- and is the name itself here, as in drawDistinct.
	export function rollStartingSpells(tmpInput, tmpRoll) {
		var tmpCasting = tmpInput.casting;
		if (!tmpCasting || !CASTING_SKILLS.includes(tmpCasting.name)) { return { spells: [], primer: "" }; }

		var tmpAffinityRoll = tmpRoll(100);
		var tmpFortuneRoll = tmpRoll(100);
		var tmpHasPrimer = tmpAffinityRoll <= (parseInt(tmpInput.affinity) || 0)
		                || tmpFortuneRoll <= (parseInt(tmpInput.fortune) || 0);

		var tmpBySkill = Math.max(1, parseInt((parseInt(tmpCasting.chance) || 0) / 10));
		var tmpByDice = rollLoreDice("1d4+2", tmpRoll);
		var tmpHowMany = Math.min(20, Math.max(1, tmpByDice > tmpBySkill ? tmpByDice : tmpBySkill));

		var tmpSpells = [];
		var tmpOrder = ["offensive", "defensive", "utility"];
		for (var i = 0; i < tmpHowMany; i++) {
			var tmpLadder = STARTING_SPELL_LADDERS[tmpOrder[i % 3]];
			var tmpGuard = 0;
			while (tmpGuard < 1000) {
				tmpGuard += 1;
				var tmpName = climbLadder(tmpLadder, tmpRoll(100));
				if (!tmpSpells.includes(tmpName)) { tmpSpells.push(tmpName); break; }
			}
		}

		var tmpPrimer = "";
		if (tmpHasPrimer) {
			var tmpKeys = Object.keys(SPELL_PRIMERS);
			tmpPrimer = SPELL_PRIMERS[pickByDie(tmpKeys, tmpRoll)] ?? "";
		}
		return { spells: tmpSpells, primer: tmpPrimer };
	}

	// This is the function which reads one of his d100 ladders: the first rung whose "below" the
	// roll is under.
	export function climbLadder(tmpLadder, tmpRollValue) {
		for (const [tmpBelow, tmpName] of tmpLadder) {
			if (tmpRollValue < tmpBelow) { return tmpName; }
		}
		return tmpLadder[tmpLadder.length - 1][1];
	}

	// This is the function which finds a character's best casting skill -- storeBestCastingSkill
	// (sheet-worker.js:98254). A racial one with any chance wins; otherwise the first of the five in
	// the class's own list, searched title by title, at its chance if it has been reached and its
	// base chance if not.
	//
	//   tmpRacial   [{ name, chance }] -- the racial skills held
	//   tmpClass    [{ name, title, chance }] -- the class list in title order, with the chance the
	//               caller worked out (the skill's own if held, its base chance if not)
	export function findBestCastingSkill(tmpRacial, tmpClass) {
		var tmpRace = (tmpRacial ?? []).find(tmpSkill => CASTING_SKILLS.includes(tmpSkill.name));
		if (tmpRace && (parseInt(tmpRace.chance) || 0) > 0) { return { name: tmpRace.name, chance: parseInt(tmpRace.chance) || 0 }; }
		var tmpFromClass = [...(tmpClass ?? [])]
			.sort((a, b) => (parseInt(a.title) || 0) - (parseInt(b.title) || 0))
			.find(tmpSkill => CASTING_SKILLS.includes(tmpSkill.name));
		if (tmpFromClass) { return { name: tmpFromClass.name, chance: parseInt(tmpFromClass.chance) || 0 }; }
		return null;
	}

	// This is the function which turns a potion into the recipe for it -- addPotionRecipeByName
	// (sheet-worker.js:142806). A recipe carries the potion's value, duration and description, and
	// costs his fixed POTION_RECIPE_RATING to memorize.
	export function makePotionRecipe(tmpPotionSystem) {
		return {
			kind: "potionrecipe", subsystem: MAGIC_KINDS.potionrecipe.subsystem,
			rating: POTION_RECIPE_RATING, modifier: 0,
			value: tmpPotionSystem?.value ?? "", duration: tmpPotionSystem?.duration ?? "",
			description: tmpPotionSystem?.description ?? "", memorized: false, batchDoses: 1,
			sourcebook: tmpPotionSystem?.sourcebook ?? "", page: tmpPotionSystem?.page ?? ""
		};
	}

	// This is the function which builds the system data of a poison -- a dose-stock when tmpRecipe
	// is false, a known recipe when it is true -- from its type, potency and form. Null when the type
	// or potency is not one of his.
	export function makePoisonSystem(tmpType, tmpPotency, tmpForm, tmpRecipe) {
		var tmpDetails = getPoisonDetails(tmpType, tmpPotency);
		if (!tmpDetails) { return null; }
		var tmpSystem = {
			kind: tmpRecipe ? "poisonrecipe" : "poison", subsystem: "poisons",
			poisonType: tmpType, poisonPotency: tmpPotency,
			form: POISON_FORMS.includes(tmpForm) ? tmpForm : "Ingestive",
			duration: tmpDetails.duration, startTime: tmpDetails.startTime, description: tmpDetails.description
		};
		if (tmpRecipe) {
			tmpSystem.rating = tmpDetails.rating;
			tmpSystem.modifier = 0;
			tmpSystem.memorized = false;
			tmpSystem.batchDoses = 1;
		}
		return { name: tmpDetails.name, system: tmpSystem };
	}

// @MARKER ADD NEW lore rules HERE
// @END (CODE)
