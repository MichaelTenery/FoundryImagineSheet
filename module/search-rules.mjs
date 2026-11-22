// @START (CODE)
// @MARKER SEARCH RULES
//==================================================================================================================
// The forgiving name search, for every box where a name is typed to find an item.
//
// WHY THIS EXISTS. His item names are written the way his sheet's tables write them -- the kind
// first, the variety in brackets: "Bow(Recurve)", "Arrow(Recurve Bow/Heavy)", "Helm(Heavy Bone)".
// Nobody types that. A player wants the recurve bow and types "recurve bow", or "bow, recurve", or
// "recurve", or "bows", or "recurv bow" -- and a plain "does the name contain what was typed" search
// finds none of the first two, because the words are in another order and a bracket sits between
// them. Feature request, 2026-11-22: "allow multiple variations that might be correct for the
// search ... Enable fuzzy searching."
//
// So a name and a search are both broken into WORDS -- brackets, commas, slashes, dashes and
// spaces are all just gaps -- and the search matches when every word typed matches some word of
// the name, in any order. A word typed matches a word of the name when it is:
//
//     the same word                    "bow"      bow
//     the start of it                  "rec"      recurve       (the list narrows as you type)
//     the same word, one plural off    "bows"     bow           "arrow"   arrows
//     one slip of the finger off       "recurv"   recurve       "bwo"     bow
//                                      (a word of four letters or more; one of eight or more may
//                                       be two slips off. A three-letter word is forgiven only two
//                                       letters swapped, or "bow" would find "box", "cow" and "row".)
//
// The little words -- "a", "an", "the", "of", "and", "with" -- are dropped from the search, so
// "potion of healing" finds "Potion(Healing)".
//
// The matches are then RANKED, so the thing asked for comes first and its twenty arrows after it:
// a closer word scores more, the name's own first word (its kind -- the Bow of "Bow(Recurve)")
// scores more, and a name with fewer words left over scores more. Ties keep the order the list
// already had -- his order, in the shop.
//==================================================================================================================

// What each kind of word match is worth. A typing-slip match is worth least, so an exact name
// always outranks one that only looks like it.
const SEARCH_SCORES = {
	//  how it matched          points
	exact:                      10,
	plural:                     9,
	prefix:                     6,
	typo:                       3,
	// Added once when the name's first word -- its kind -- is one of the words matched.
	kindWord:                   5,
	// Taken off for each word of the name the search did not ask for, so "Bow(Recurve)" outranks
	// "Arrow(Recurve Bow/True Flight/Far Flight/Piercing/Barbed)" for "recurve bow".
	leftOverWord:               1
};

// The little words a search ignores.
const SEARCH_SKIP_WORDS = ["a", "an", "the", "of", "and", "with", "for"];

// @MARKER WORDS
// This is the function which breaks a name or a search into its words: lower case, the apostrophe
// dropped so "Cobbler's" and "cobblers" are one word, and everything that is not a letter or a
// digit a gap -- "Bow(Recurve)" is "bow recurve", "Arrow(Recurve Bow/Heavy)" is "arrow recurve
// bow heavy". The curly ’ and his backtick are apostrophes too (shop-rules.mjs normalizeItemName).
export function getSearchWords(tmpText) {
	return ("" + (tmpText ?? "")).toLowerCase()
		.replace(/['’‘`�]/g, "")
		.split(/[^a-z0-9]+/)
		.filter(tmpWord => tmpWord);
}

// This is the function which counts the slips between two words -- letters put in, left out,
// changed, or two side by side swapped ("bwo" for "bow") -- giving up once past tmpLimit, which
// is all the caller needs to know.
function countWordSlips(tmpA, tmpB, tmpLimit) {
	if (Math.abs(tmpA.length - tmpB.length) > tmpLimit) { return tmpLimit + 1; }
	var tmpRows = [];
	for (var tmpI = 0; tmpI <= tmpA.length; tmpI++) {
		tmpRows[tmpI] = [tmpI];
		for (var tmpJ = 1; tmpJ <= tmpB.length; tmpJ++) {
			if (tmpI == 0) { tmpRows[0][tmpJ] = tmpJ; continue; }
			var tmpCost = tmpA[tmpI - 1] == tmpB[tmpJ - 1] ? 0 : 1;
			tmpRows[tmpI][tmpJ] = Math.min(
				tmpRows[tmpI - 1][tmpJ] + 1,            // a letter left out
				tmpRows[tmpI][tmpJ - 1] + 1,            // a letter put in
				tmpRows[tmpI - 1][tmpJ - 1] + tmpCost); // a letter changed
			if (tmpI > 1 && tmpJ > 1 && tmpA[tmpI - 1] == tmpB[tmpJ - 2] && tmpA[tmpI - 2] == tmpB[tmpJ - 1]) {
				tmpRows[tmpI][tmpJ] = Math.min(tmpRows[tmpI][tmpJ], tmpRows[tmpI - 2][tmpJ - 2] + 1); // two swapped
			}
		}
	}
	return tmpRows[tmpA.length][tmpB.length];
}

// This is the function which says the plain form of a word, for the plural test: "arrows" arrow,
// "boxes" box, "staves" stave -- near enough for his item names, which is all it is asked about.
function getPlainWord(tmpWord) {
	if (tmpWord.length > 4 && tmpWord.endsWith("ies")) { return tmpWord.slice(0, -3) + "y"; }
	if (tmpWord.length > 3 && /(xes|ches|shes|sses)$/.test(tmpWord)) { return tmpWord.slice(0, -2); }
	if (tmpWord.length > 2 && tmpWord.endsWith("s") && !tmpWord.endsWith("ss")) { return tmpWord.slice(0, -1); }
	return tmpWord;
}

// This is the function which says how one typed word matches one word of a name: "exact",
// "plural", "prefix", "typo", or "" for not at all.
function getWordMatch(tmpTyped, tmpNameWord) {
	if (tmpTyped == tmpNameWord) { return "exact"; }
	if (getPlainWord(tmpTyped) == getPlainWord(tmpNameWord)) { return "plural"; }
	if (tmpNameWord.startsWith(tmpTyped)) { return "prefix"; }
	// A three-letter word is forgiven two letters swapped and nothing else: "bwo" is bow, but
	// "box" is not.
	if (tmpTyped.length == 3 && tmpNameWord.length == 3 && tmpTyped != tmpNameWord
		&& [...tmpTyped].sort().join("") == [...tmpNameWord].sort().join("")
		&& [0, 1].some(tmpI => tmpTyped[tmpI] == tmpNameWord[tmpI + 1] && tmpTyped[tmpI + 1] == tmpNameWord[tmpI]
			&& tmpTyped[2 - tmpI * 2] == tmpNameWord[2 - tmpI * 2])) { return "typo"; }
	if (tmpTyped.length >= 4) {
		var tmpAllowed = tmpTyped.length >= 8 ? 2 : 1;
		if (countWordSlips(tmpTyped, tmpNameWord, tmpAllowed) <= tmpAllowed) { return "typo"; }
		// A word still being typed with a slip in it: "recru" on its way to "recurve".
		if (tmpNameWord.length > tmpTyped.length
			&& countWordSlips(tmpTyped, tmpNameWord.slice(0, tmpTyped.length), 1) <= 1) { return "typo"; }
	}
	return "";
}

// @MARKER SCORING
// This is the function which scores one name against a search: 0 for no match, more for a closer
// one. An empty search matches everything, at 1, so a caller can filter on it either way.
export function scoreItemSearch(tmpName, tmpSearch) {
	var tmpTyped = getSearchWords(tmpSearch).filter(tmpWord => !SEARCH_SKIP_WORDS.includes(tmpWord));
	if (!tmpTyped.length) { return 1; }
	var tmpNameWords = getSearchWords(tmpName);
	if (!tmpNameWords.length) { return 0; }

	var tmpScore = 0;
	var tmpUsed = new Set();
	for (const tmpWord of tmpTyped) {
		// The best word of the name for this typed word. Each word of the name is matched once,
		// so "bow bow" does not find a name with one Bow in it -- unless it has two.
		var tmpBest = -1;
		var tmpBestScore = 0;
		tmpNameWords.forEach((tmpNameWord, tmpIndex) => {
			if (tmpUsed.has(tmpIndex)) { return; }
			var tmpHow = getWordMatch(tmpWord, tmpNameWord);
			if (tmpHow && SEARCH_SCORES[tmpHow] > tmpBestScore) { tmpBest = tmpIndex; tmpBestScore = SEARCH_SCORES[tmpHow]; }
		});
		if (tmpBest < 0) { return 0; }
		tmpUsed.add(tmpBest);
		tmpScore += tmpBestScore;
	}
	if (tmpUsed.has(0)) { tmpScore += SEARCH_SCORES.kindWord; }
	tmpScore -= (tmpNameWords.length - tmpUsed.size) * SEARCH_SCORES.leftOverWord;
	// Never 0 for a match, however many words were left over.
	return Math.max(tmpScore, 1);
}

// This is the function which filters and ranks a list by a search. tmpGetName reads the name
// from an entry. An empty search returns the list as it was; otherwise the matches, closest first,
// ties in the list's own order.
export function searchItemList(tmpList, tmpSearch, tmpGetName) {
	var tmpRead = tmpGetName ?? (tmpEntry => tmpEntry?.name);
	if (!getSearchWords(tmpSearch).length) { return [...(tmpList ?? [])]; }
	return (tmpList ?? [])
		.map((tmpEntry, tmpIndex) => ({ tmpEntry, tmpIndex, tmpScore: scoreItemSearch(tmpRead(tmpEntry), tmpSearch) }))
		.filter(tmpRow => tmpRow.tmpScore > 0)
		.sort((a, b) => (b.tmpScore - a.tmpScore) || (a.tmpIndex - b.tmpIndex))
		.map(tmpRow => tmpRow.tmpEntry);
}

// @MARKER ADD NEW search functions HERE
// @END (CODE)
