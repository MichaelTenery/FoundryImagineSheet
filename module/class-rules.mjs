// @START (CODE)
// @MARKER CLASS RULES
//==================================================================================================================
// Rules for what a class gives a character as it advances, with no Foundry dependency, so they can
// be tested outside it. The race half of the module lives in race-rules.mjs; this is the class half.
//
// HIS MODEL, which this follows. setClassSkillLists (sheet-worker.js:57903) gives a class its whole
// skill progression at once -- every skill, each tagged with the title it arrives at -- and
// setFinalClassSkills (63177) writes all fifteen titles onto the sheet at creation. Only the FIRST
// title's skills get a live ability and chance there; every later title's are written with
// "_ability"=0 and "_chance"=0 (63292, 63327, and so on down to 63692). They are on the sheet, and
// they do not work yet.
//
// A later title's skills come alive when the character reaches that title. handleLevelTitle (66058)
// asks getTitleToAcquireSkillsByGoal (92462) which title's skills a goal buys, and its answer is
// the plain title boundary -- goal 0 gives title 1, 3 gives 2, 6 gives 3, up to 42 giving 15 -- so
// reaching title N is exactly when title N's skills are acquired. That is what makes granting on
// the title faithful rather than a simplification.
//
// His two gates on USING one, from handleHighTitleClassSkillRoll (64169) and its Mod twin:
//     the skill's title is above the character's      "this skill cannot be used before <name> title."
//     the skill has no ability yet                    the roll falls back to the base chance alone
// The first is ported here as checkClassSkillTitle. The second needs no rule: a skill the character
// does not hold has no bonuses to read.
//
// WHAT IS NOT HERE. Whether the character has a free class skill slot for the skill; the slot
// accounting lives in skills-rules.mjs and _prepareSkillSlots.
//
// "REMOVED" IS THE PLAYER'S CHOICE, NOT AN AUTOMATIC MARK. His Step 6 lists the whole career, every
// title 1-15 with its CORE marker and a tick box (HTML 40148-40153), and compares it with the class
// slots Knowledge gives. The player ticks the non-core skills to give up and presses REMOVE (sheet-worker.js
// 7675-7736), which refuses a CORE one ("CORE skills cannot be removed. Nothing done.") and writes
// "REMOVED" over the rest; or converts racial or social slots to class slots. Step 6 will not confirm
// while the slots are still short (7828-7835). setFinalClassSkills (63268) then leaves the REMOVED rows
// off the sheet, so the skill never arrives at its title. (This comment used to call it "automatic
// marking of the excess"; that was wrong, corrected 2026-09-26.) Here a removed row keeps its place
// in the class item's classSkillList with removed:true, and every reader skips it.
//
// @MARKER CLASS CUSTOMIZATION
// A row may also have been SWAPPED, the Master's Manual's "Customizing Classes" (MM p.55): its name is
// the incoming skill and replaces holds the one it replaced. Nothing here treats a swapped row
// differently -- that is the point of rewriting the name: it is granted, counted and shown as the
// class's own skill at that title, which is what "the player is actually changing the class itself"
// means. His sheet has no general swap; its Knight(Templar) is the book's worked example, fixed.
//==================================================================================================================
//==================================================================================================================

	// This is the function which decides whether a class skill is for this character at all.
	// His nocast, set by the racial disability "Cannot Cast Spells": a few casting classes give a
	// race that cannot cast a different skill in the same slot, so each of the pair is tagged and
	// only one of them is ever this character's.
	//
	// A row the player gave up at creation (removed, see above) is no one's.
	export function isClassSkillForCharacter(tmpskill, tmpcannotcast) {
		if (tmpskill?.removed) { return false; }
		if (tmpskill?.requires == "nonCaster") { return !!tmpcannotcast; }
		if (tmpskill?.requires == "caster")    { return !tmpcannotcast; }
		return true;
	}

	// This is the function which lists the class skills that arrive AT one title.
	export function getClassSkillsAtTitle(tmpclasssystem, tmptitle, tmpcannotcast) {
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		return tmplist
			.filter(tmpskill => (parseInt(tmpskill.title) || 0) == (parseInt(tmptitle) || 0))
			.filter(tmpskill => isClassSkillForCharacter(tmpskill, tmpcannotcast))
			.map(tmpskill => ({ name: tmpskill.name, core: !!tmpskill.core, title: parseInt(tmpskill.title) || 0,
			                    replaces: tmpskill.replaces ?? "" }));
	}

	// This is the function which lists every class skill the character's title entitles them to --
	// this title's and every earlier one's, because a character who reached title 5 passed through
	// 1 to 4 to get there.
	export function getClassSkillsThroughTitle(tmpclasssystem, tmptitle, tmpcannotcast) {
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		var tmpat = parseInt(tmptitle) || 0;
		return tmplist
			.filter(tmpskill => {
				var tmpneeded = parseInt(tmpskill.title) || 0;
				return tmpneeded > 0 && tmpneeded <= tmpat;
			})
			.filter(tmpskill => isClassSkillForCharacter(tmpskill, tmpcannotcast))
			.map(tmpskill => ({ name: tmpskill.name, core: !!tmpskill.core, title: parseInt(tmpskill.title) || 0,
			                    replaces: tmpskill.replaces ?? "" }));
	}

	// This is the function which lists every class skill the class gives this character, at every
	// title. His setFinalClassSkills writes all of them to the sheet AT CREATION, titles 2 to 15 as
	// well as the first (sheet-worker.js:63288 onward), and his getNewSocialSkillModifier reads them
	// all back, class_skill_1_1 to class_skill_15_1 (125658) -- which is why a later title's skill
	// can lift a social skill before the character reaches it (chargen-rules.mjs assembleCharacter).
	export function getEveryClassSkill(tmpclasssystem, tmpcannotcast) {
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		return tmplist
			.filter(tmpskill => (parseInt(tmpskill.title) || 0) > 0)
			.filter(tmpskill => isClassSkillForCharacter(tmpskill, tmpcannotcast))
			.map(tmpskill => ({ name: tmpskill.name, core: !!tmpskill.core, title: parseInt(tmpskill.title) || 0,
			                    replaces: tmpskill.replaces ?? "" }));
	}

	// This is the function which says which entitled class skills the character does not hold yet,
	// so they can be granted. A skill already on the character is never granted a second time,
	// whoever put it there -- a player who added it by hand keeps their copy and its bonuses.
	//
	// A non-classed character (his GME) is entitled to nothing: it picks its skills one at a time,
	// which is the whole point of it. Its skill list is empty anyway, so this is belt and braces.
	export function getClassSkillsToGrant(tmpclasssystem, tmptitle, tmpcannotcast, tmpheldnames) {
		if (tmpclasssystem?.nonClassed) { return []; }

		var tmpheld = (tmpheldnames ?? []).map(tmpname => "" + tmpname);
		return getClassSkillsThroughTitle(tmpclasssystem, tmptitle, tmpcannotcast)
			.filter(tmpskill => !tmpheld.includes(tmpskill.name));
	}

	// This is the function which says at which title a named skill arrives in a class, or 0 if the
	// class never gives it. Where a class lists the same skill twice, the EARLIEST title wins: the
	// character has it from then on, and the later entry cannot take it away again.
	export function getClassSkillTitle(tmpclasssystem, tmpname) {
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		var tmpearliest = 0;
		for (const tmpskill of tmplist) {
			if (tmpskill.name != tmpname) { continue; }
			if (tmpskill.removed) { continue; }   // given up at creation: the class no longer gives it
			var tmptitle = parseInt(tmpskill.title) || 0;
			if (tmptitle > 0 && (tmpearliest == 0 || tmptitle < tmpearliest)) { tmpearliest = tmptitle; }
		}
		return tmpearliest;
	}

	// This is the function which answers whether a skill may be used yet, ported from his
	// handleHighTitleClassSkillRoll (sheet-worker.js:64169): "classtitle<titleNeeded" refuses the
	// roll and says so by title NAME, not number, which is how a player reads their own sheet.
	//
	// Only a class skill is ever gated this way. A racial or social skill is acquired outside the
	// class progression altogether and has no title to wait for -- acquiredAtTitle is 0 on those,
	// which this reads as "no gate", his own convention.
	export function checkClassSkillTitle(tmpacquiredattitle, tmpcurrenttitle, tmptitlename) {
		var tmpneeded = parseInt(tmpacquiredattitle) || 0;
		var tmphas = parseInt(tmpcurrenttitle) || 0;
		if (tmpneeded <= 0 || tmphas >= tmpneeded) { return { usable: true, reason: "" }; }

		var tmplabel = tmptitlename ? `${tmptitlename} (title ${tmpneeded})` : `title ${tmpneeded}`;
		return { usable: false, reason: `This skill cannot be used before ${tmplabel}.` };
	}

	// This is the function which builds the progression panel the sheet shows: one row per title
	// the class has skills at, each saying whether the character has reached it and which skills
	// it brings. Built here rather than in the sheet so it can be tested without Foundry, and so
	// the generator's preview and the sheet cannot drift apart.
	//
	// Rows run from title 1 to the highest title the class lists, and a title with no skills of its
	// own is left out rather than rendered empty -- most classes have several.
	//
	// A row given up at creation is still listed, struck through (removedSkills / removedText), so the
	// player can see what the class would have given and was declined; a swapped row reads
	// "Shield Knowledge (replaces Stun)". A title whose every skill was given up still has its row.
	export function buildClassProgression(tmpclasssystem, tmptitle, tmpcannotcast) {
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		var tmpat = parseInt(tmptitle) || 0;
		var tmphighest = tmplist.reduce((tmpmax, tmpskill) =>
			Math.max(tmpmax, parseInt(tmpskill.title) || 0), 0);

		var tmprows = [];
		for (var tmpwhich = 1; tmpwhich <= tmphighest; tmpwhich++) {
			var tmpskills = getClassSkillsAtTitle(tmpclasssystem, tmpwhich, tmpcannotcast);
			// The rows this character would have had at this title and gave up -- the caster test
			// alone, so the other half of a caster/non-caster pair is not shown as "removed".
			var tmpremoved = tmplist
				.filter(tmpskill => tmpskill.removed && (parseInt(tmpskill.title) || 0) == tmpwhich)
				.filter(tmpskill => isClassSkillForCharacter({ ...tmpskill, removed: false }, tmpcannotcast))
				.map(tmpskill => ({ name: tmpskill.name, core: !!tmpskill.core, title: tmpwhich, removed: true }));
			if (!tmpskills.length && !tmpremoved.length) { continue; }
			tmprows.push({
				title:     tmpwhich,
				reached:   tmpat >= tmpwhich,
				current:   tmpat == tmpwhich,
				skills:    tmpskills,
				skillText: tmpskills.map(tmpskill => tmpskill.name
					+ (tmpskill.core ? " (core)" : "")
					+ (tmpskill.replaces ? ` (replaces ${tmpskill.replaces})` : "")).join(", "),
				removedSkills: tmpremoved,
				removedText:   tmpremoved.map(tmpskill => tmpskill.name).join(", ")
			});
		}
		return tmprows;
	}

	// @MARKER WHOLE CAREER
	// This is the function which lists the whole career the way his Step 6 lays it out (HTML
	// 40148-40153): every row of the class this character could have, title by title, with its CORE
	// marker, whether it was given up, and what it replaced if it was swapped. The other half of a
	// caster/non-caster pair is left out, as his nocast leaves it out of his list.
	export function getWholeCareerRows(tmpclasssystem, tmpcannotcast) {
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		return tmplist
			.filter(tmpskill => (parseInt(tmpskill.title) || 0) > 0)
			.filter(tmpskill => isClassSkillForCharacter({ ...tmpskill, removed: false }, tmpcannotcast))
			.map(tmpskill => ({ title: parseInt(tmpskill.title) || 0, name: tmpskill.name, core: !!tmpskill.core,
			                    removed: !!tmpskill.removed, replaces: tmpskill.replaces ?? "" }));
	}

	// This is the function which counts the class slots the whole career takes -- his
	// getSlotsNeededForClass (sheet-worker.js:62881), less whatever was given up. Counted from the rows
	// rather than read from his table, so a removal, a swap or a homebrew class is always right: his
	// figure and his own rows agree for all but two classes, Bard (46 against 47 rows) and Hero (48
	// against 49), where the rows are what his Step 6 actually lists. A caster/non-caster pair counts
	// once, the half this character gets -- which is how his figure counts it for the other 99.
	export function countClassSlotsNeeded(tmpclasssystem, tmpcannotcast) {
		if (tmpclasssystem?.nonClassed) { return 0; }
		return getWholeCareerRows(tmpclasssystem, tmpcannotcast).filter(tmpskill => !tmpskill.removed).length;
	}

	// @MARKER CLASS CUSTOMIZATION
	// This is the function which gives a class's skill list with the player's edits made to it, as the
	// character's own class item will carry it. Swaps first, then removals (a swapped row cannot also be
	// removed -- a removal naming it is ignored):
	//     tmpswaps    [{ title, out, in }]   the row at that title named out becomes in, replaces:out.
	//                                        Its CORE mark is kept as it was: a core row cannot be
	//                                        swapped (MM p.55 rule 2, checkClassSkillSwaps), so it is
	//                                        false on every row a valid swap touches.
	//     tmpremoved  [{ title, name }]      that row (by the name it has AFTER the swaps) is removed:true.
	//                                        A CORE row is never removed, whatever is asked.
	// Every row comes back with removed and replaces set, so the class item's list is whole.
	// Incomplete swaps (no out or no in) are skipped: a half-filled row on screen changes nothing.
	export function applyClassSkillEdits(tmpclasssystem, tmpswaps, tmpremoved) {
		var tmplist = (tmpclasssystem?.advancement?.classSkillList ?? []).map(tmpskill => ({
			...tmpskill, removed: !!tmpskill.removed, replaces: tmpskill.replaces ?? "" }));
		for (const tmpswap of tmpswaps ?? []) {
			if (!tmpswap?.out || !tmpswap?.in) { continue; }
			var tmprow = tmplist.find(tmpskill => tmpskill.name == tmpswap.out && !tmpskill.replaces
				&& (parseInt(tmpskill.title) || 0) == (parseInt(tmpswap.title) || 0));
			if (!tmprow) { continue; }
			tmprow.replaces = tmprow.name;
			tmprow.name = tmpswap.in;
		}
		for (const tmpremove of tmpremoved ?? []) {
			var tmpgone = tmplist.find(tmpskill => tmpskill.name == tmpremove?.name
				&& (parseInt(tmpskill.title) || 0) == (parseInt(tmpremove?.title) || 0));
			if (!tmpgone || tmpgone.core || tmpgone.replaces) { continue; }
			tmpgone.removed = true;
		}
		return tmplist;
	}

	// The most rows a class may have swapped (MM p.55 rule 6).
	export const CLASS_SKILL_SWAP_LIMIT = 3;

	// This is the function which reads a skill's types off its document. One skill carries "ALL"
	// (Know); MM p.235 says a skill in two types counts for both, and ALL is read the same way, as
	// every type at once.
	function getSkillTypes(tmpdoc) {
		return (tmpdoc?.system?.types ?? []).map(tmptype => "" + tmptype);
	}

	// This is the function which says whether two skills share a type (MM p.55 rule 1). A skill with
	// no type at all -- every social skill -- shares none.
	export function doSkillTypesMatch(tmpdoca, tmpdocb) {
		var tmpa = getSkillTypes(tmpdoca);
		var tmpb = getSkillTypes(tmpdocb);
		if (!tmpa.length || !tmpb.length) { return false; }
		if (tmpa.includes("ALL") || tmpb.includes("ALL")) { return true; }
		return tmpa.some(tmptype => tmpb.includes(tmptype));
	}

	// This is the function which lists the rows that may be swapped OUT (MM p.55): this character's
	// rows, not CORE (rule 2), not given up, not already swapped, and not a prerequisite of another row
	// (rule 5). Rule 5 reads the rows' requires field, the only prerequisite data a class list has --
	// and in his data requires only ever says "caster" or "nonCaster", never a skill's name, so today it
	// excludes nothing. The skills' own prerequisites (MM pp.238-242) are not extracted; see
	// describeSwapAdvice.
	// tmpremoved, when given, is the rows the player has given up ([{ title, name }], as
	// applyClassSkillEdits takes them): those are not offered either, since a swap applied first would
	// quietly take back the removal (a removal names the row as it reads after the swaps).
	export function getSwapOutCandidates(tmpclasssystem, tmpcannotcast, tmpremoved) {
		if (tmpremoved && tmpremoved.length) {
			tmpclasssystem = { ...tmpclasssystem, advancement: { ...(tmpclasssystem?.advancement ?? {}),
				classSkillList: applyClassSkillEdits(tmpclasssystem, [], tmpremoved) } };
		}
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		var tmprequired = tmplist.map(tmpskill => tmpskill.requires).filter(tmpname => tmpname
			&& tmpname != "caster" && tmpname != "nonCaster");
		return getWholeCareerRows(tmpclasssystem, tmpcannotcast)
			.filter(tmpskill => !tmpskill.core && !tmpskill.removed && !tmpskill.replaces)
			.filter(tmpskill => !tmprequired.includes(tmpskill.name));
	}

	// This is the function which lists the skills that may come IN for one outgoing skill: a class or
	// racial skill (MM p.55 "from the class/racial skills lists" -- the social list is not one), of a
	// type the outgoing one has (rule 1), not already anywhere in the class (rule 3, both halves of a
	// caster pair counted), and allowed in this campaign. tmpskilldocs are the skill documents;
	// tmpavail the campaign's availability test. Sorted by name.
	export function getSwapInCandidates(tmpclasssystem, tmpoutname, tmpskilldocs, tmpavail) {
		var tmpisavail = tmpavail ?? (() => true);
		var tmpoutdoc = (tmpskilldocs ?? []).find(tmpdoc => tmpdoc.name == tmpoutname);
		if (!tmpoutdoc) { return []; }
		var tmpinclass = (tmpclasssystem?.advancement?.classSkillList ?? []).flatMap(tmpskill =>
			[tmpskill.name, tmpskill.replaces].filter(tmpname => tmpname));
		return (tmpskilldocs ?? [])
			.filter(tmpdoc => tmpdoc.system?.category != "social")
			.filter(tmpdoc => !tmpinclass.includes(tmpdoc.name))
			.filter(tmpdoc => doSkillTypesMatch(tmpdoc, tmpoutdoc))
			.filter(tmpdoc => tmpisavail(tmpdoc))
			.map(tmpdoc => tmpdoc.name)
			.sort((a, b) => a.localeCompare(b));
	}

	// This is the function which checks the player's swaps against MM p.55, against the class's OWN
	// list (before any edit). Returns the problems, [] when there are none. Rules 1, 2, 3, 5 and 6 are
	// enforced; rule 4 (the incoming skill's minimum title and prerequisites, MM pp.238-242) is advice
	// only, because neither his sheet nor the port has those pages' data (user's ruling 2026-09-26).
	// A row with nothing chosen yet is not a problem, only unfinished.
	// tmpremoved (optional) is the rows given up; swapping one of those out is refused, see
	// getSwapOutCandidates.
	export function checkClassSkillSwaps(tmpclasssystem, tmpswaps, tmpskilldocs, tmpcannotcast, tmpremoved) {
		var tmpissues = [];
		var tmpchosen = (tmpswaps ?? []).filter(tmpswap => tmpswap?.out || tmpswap?.in);
		if (tmpchosen.length > CLASS_SKILL_SWAP_LIMIT) {
			tmpissues.push(`No more than ${CLASS_SKILL_SWAP_LIMIT} skills can be substituted; ${tmpchosen.length} are.`);
		}
		var tmplist = tmpclasssystem?.advancement?.classSkillList ?? [];
		var tmpoutable = getSwapOutCandidates(tmpclasssystem, tmpcannotcast, tmpremoved);
		var tmpinclass = tmplist.map(tmpskill => tmpskill.name);
		var tmpfind = (tmpname) => (tmpskilldocs ?? []).find(tmpdoc => tmpdoc.name == tmpname) ?? null;
		var tmpusedrows = [];
		var tmpusedins = [];
		for (const tmpswap of tmpchosen) {
			if (!tmpswap.out || !tmpswap.in) { continue; }
			var tmptitle = parseInt(tmpswap.title) || 0;
			var tmprow = tmplist.find(tmpskill => tmpskill.name == tmpswap.out && (parseInt(tmpskill.title) || 0) == tmptitle);
			var tmprowkey = tmptitle + ":" + tmpswap.out;
			if (!tmprow) {
				tmpissues.push(`The class has no ${tmpswap.out} at title ${tmptitle}.`);
				continue;
			}
			if (tmprow.core) {
				tmpissues.push(`${tmpswap.out} is a core skill; core skills cannot be substituted.`);
			} else if (!tmpoutable.some(tmpskill => tmpskill.name == tmpswap.out && tmpskill.title == tmptitle)) {
				tmpissues.push(`${tmpswap.out} cannot be taken out of the class.`);
			}
			if (tmpusedrows.includes(tmprowkey)) {
				tmpissues.push(`${tmpswap.out} at title ${tmptitle} is substituted twice.`);
			}
			tmpusedrows.push(tmprowkey);
			if (tmpinclass.includes(tmpswap.in)) {
				tmpissues.push(`${tmpswap.in} is already in the class.`);
			}
			if (tmpusedins.includes(tmpswap.in)) {
				tmpissues.push(`${tmpswap.in} is brought in twice.`);
			}
			tmpusedins.push(tmpswap.in);
			var tmpindoc = tmpfind(tmpswap.in);
			var tmpoutdoc = tmpfind(tmpswap.out);
			if (!tmpindoc) {
				tmpissues.push(`${tmpswap.in} is not in the skill compendium.`);
			} else if (tmpindoc.system?.category == "social") {
				tmpissues.push(`${tmpswap.in} is a social skill; only class and racial skills can be substituted in.`);
			} else if (!doSkillTypesMatch(tmpindoc, tmpoutdoc)) {
				tmpissues.push(`${tmpswap.in} (${getSkillTypes(tmpindoc).join("/") || "no type"}) is not the same type as `
					+ `${tmpswap.out} (${getSkillTypes(tmpoutdoc).join("/") || "no type"}).`);
			}
		}
		return tmpissues;
	}

	// This is the function which gives MM p.55 rule 4 as advice for one swap: the incoming skill "must
	// meet all of the skill requirements listed on pages 238-242", a minimum title and prerequisite
	// skills "in the class at the same or previous Titles". Those pages are not extracted, so this only
	// says what to check and where.
	export function describeSwapAdvice(tmpswap) {
		if (!tmpswap?.in) { return ""; }
		return `Check ${tmpswap.in}'s minimum title and prerequisites (Master's Manual pp.238-242): it arrives at `
			+ `title ${parseInt(tmpswap.title) || 0}, and its prerequisites must be in the class at that title or earlier.`;
	}

	// @MARKER USAGE RESTRICTIONS
	// This is the function which reads a class's armour and weapon usage for display. His sheet
	// carries both as text and shows them (tmp_class_armor_usage / tmp_class_weapon_usage, set at
	// sheet-worker.js:51018-51019 and written to the sheet at 51297-51298) and NEVER compares them
	// against what the character is wearing or wielding -- the Game Master does that at the table.
	//
	// So this shows them and stops there. Deciding whether a given piece of armour is "Leather or
	// less" would mean inventing a comparison he does not make, against strings the extraction
	// found in 40-odd shapes. The Player's Guide's cost for breaking the rule -- experience, and
	// the use of non-combat class skills -- is likewise the Game Master's to apply.
	export function getClassUsageRestrictions(tmpclassitems) {
		return (tmpclassitems ?? [])
			.filter(tmpclass => tmpclass && !tmpclass.system?.nonClassed)
			.map(tmpclass => ({
				name:        tmpclass.name,
				armorUsage:  tmpclass.system?.armorUsage || "Any",
				weaponUsage: tmpclass.system?.weaponUsage || "Any"
			}));
	}

// @MARKER ADD NEW class rules functions HERE
// @END (CODE)
