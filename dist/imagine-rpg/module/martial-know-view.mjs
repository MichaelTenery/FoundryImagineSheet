// @START (CODE)
// @MARKER MARTIAL KNOWLEDGE DISCIPLINE VIEW
//==================================================================================================================
// His "Select Martial Know. Discipline" panel (Updater, HTML 50661), worked out without Foundry so the test can
// render the same template against the same view.
//
// Pick one of the four disciplines and the panel shows what it knows and nothing else; pick Custom and a grid of
// every attack, block, hold, move and throw is ticked by hand. Nothing is the character's until COMMIT, as on his
// sheet (setMartialKnowArts fills the temp_ lists at 98801, commitMartialKnowArts writes them at 98895). The window
// is module/apps/martial-know.mjs.
//
// HOW IT IS STORED. His sheet keeps one list per family and COMMIT replaces it. The port keeps the discipline and,
// apart from it, what is known BEYOND it (the learned* strings). So committing Custom writes the ticks there, and
// committing a preset after Custom empties them; a preset after a preset leaves alone anything learned with
// Martial Lore, which his replace would have thrown away.
//==================================================================================================================

import { MARTIAL_DISCIPLINE_NAMES, MARTIAL_FAMILIES, resolveMartialKnown } from "./combat/martial-arts.mjs";

	// The stored field for each family.
	//                family      field
	const LEARNED_FIELDS = {
		attacks: "learnedAttacks",
		blocks:  "learnedBlocks",
		holds:   "learnedHolds",
		moves:   "learnedMoves",
		throws:  "learnedThrows"
	};

	// His one Torso box writes all three Torso holds (martial_hold5_check, 98844-98846). The table has
	// three rows; the grid has his one box.
	const TORSO_HOLDS = ["Torso", "Torso(1 Arm)", "Torso(2 Arms)"];

	// This is the function which gives the boxes one family's column has, in his order.
	export function getMartialChoices(tmpfamily) {
		var tmpnames = Object.keys(MARTIAL_FAMILIES[tmpfamily]?.table ?? {});
		return (tmpfamily == "holds") ? tmpnames.filter(tmpname => !TORSO_HOLDS.slice(1).includes(tmpname)) : tmpnames;
	}

	// This is the function which reads the character's martial data into the window's working state. The
	// boxes start at what is known now, so going from a preset to Custom begins from that preset and loses
	// nothing learned beyond it.
	//
	//   tmpmartial   system.martial
	export function newMartialKnowWorking(tmpmartial) {
		var tmpm = tmpmartial ?? {};
		var tmpknown = resolveMartialKnown(tmpm.discipline ?? "", {
			attacks: tmpm.learnedAttacks, blocks: tmpm.learnedBlocks, holds: tmpm.learnedHolds,
			moves: tmpm.learnedMoves, throws: tmpm.learnedThrows });
		var tmppicks = {};
		for (const tmpfamily of Object.keys(LEARNED_FIELDS)) {
			tmppicks[tmpfamily] = (tmpknown[tmpfamily] ?? []).filter(tmpname => getMartialChoices(tmpfamily).includes(tmpname));
		}
		return { discipline: tmpm.discipline ?? "", picks: tmppicks };
	}

	// This is the function which lists what a working state would know, by family, as his panel's lines.
	function getKnownLines(tmpworking) {
		return Object.keys(LEARNED_FIELDS).map(tmpfamily => {
			var tmpnames = (tmpworking.discipline == "Custom")
				? (tmpworking.picks?.[tmpfamily] ?? [])
				: (resolveMartialKnown(tmpworking.discipline, {})[tmpfamily] ?? []);
			return { label: MARTIAL_FAMILIES[tmpfamily].label, names: tmpnames.join(", ") || "None" };
		});
	}

	// This is the function which builds everything the window renders.
	//
	//   tmpf = { characterName, martial: system.martial, working, isGM }
	export function buildMartialKnowView(tmpf) {
		var tmpm = tmpf?.martial ?? {};
		var tmpw = tmpf?.working ?? newMartialKnowWorking(tmpm);
		var tmpname = tmpf?.characterName || "This character";
		var tmpusable = !!tmpm.hasKnowledge || !!tmpf?.isGM;
		return {
			characterName: tmpname,
			usable: tmpusable,
			notAcquiredMessage: `${tmpname} has not acquired Martial Knowledge. Cannot select a discipline, yet.`,
			gmOverride: !tmpm.hasKnowledge && !!tmpf?.isGM,
			current: tmpm.discipline || "None",
			disciplineChoices: ["", ...MARTIAL_DISCIPLINE_NAMES].map(tmpchoice => ({
				value: tmpchoice, label: tmpchoice, selected: tmpchoice == tmpw.discipline })),
			isCustom: tmpw.discipline == "Custom",
			hasDiscipline: !!tmpw.discipline,
			lines: getKnownLines(tmpw),
			families: Object.keys(LEARNED_FIELDS).map(tmpfamily => ({
				key: tmpfamily,
				label: MARTIAL_FAMILIES[tmpfamily].label,
				options: getMartialChoices(tmpfamily).map(tmpchoice => ({
					name: tmpchoice, checked: (tmpw.picks?.[tmpfamily] ?? []).includes(tmpchoice) }))
			}))
		};
	}

	// This is the function which decides his COMMIT: returns { ok, message, update }, update being the
	// actor update to make. His sheet accepts an empty choice and clears the character, with a remark that
	// "standing still" is no discipline; that wipes a character for a stray click, so here it is refused.
	//
	//   tmpworking    the window's state
	//   tmpmartial    system.martial as stored
	export function resolveMartialKnowCommit(tmpname, tmpworking, tmpmartial) {
		var tmpdiscipline = tmpworking?.discipline ?? "";
		if (!tmpdiscipline || !MARTIAL_DISCIPLINE_NAMES.includes(tmpdiscipline)) {
			return { ok: false, message: "Choose a discipline first.", update: null };
		}
		var tmpupdate = { "system.martial.discipline": tmpdiscipline };
		if (tmpdiscipline == "Custom") {
			var tmpany = false;
			for (const [tmpfamily, tmpfield] of Object.entries(LEARNED_FIELDS)) {
				var tmppicked = getMartialChoices(tmpfamily).filter(tmpchoice => (tmpworking.picks?.[tmpfamily] ?? []).includes(tmpchoice));
				if (tmppicked.length) { tmpany = true; }
				var tmpwritten = (tmpfamily == "holds" && tmppicked.includes("Torso"))
					? tmppicked.flatMap(tmpchoice => tmpchoice == "Torso" ? TORSO_HOLDS : [tmpchoice]) : tmppicked;
				tmpupdate[`system.martial.${tmpfield}`] = tmpwritten.join(",");
			}
			if (!tmpany) {
				return { ok: false, message: "Tick at least one attack, block, hold, move or throw for a Custom discipline.", update: null };
			}
		} else if (tmpmartial?.discipline == "Custom") {
			// Custom's ticks were what those strings held; the preset brings its own.
			for (const tmpfield of Object.values(LEARNED_FIELDS)) { tmpupdate[`system.martial.${tmpfield}`] = ""; }
		}
		return { ok: true, message: `${tmpname} selected ${tmpdiscipline} as their Martial Knowledge discipline`, update: tmpupdate };
	}

// @END (CODE)
