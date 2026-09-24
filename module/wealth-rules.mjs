// @START (CODE)
// @MARKER WEALTH
//==================================================================================================================
// His Loose Equipment money panel (the sheet's equip_loose block): Wealth(in Gold), the four coins,
// gems, jewelry, and the Update Coins / Gems / Jewelry rows with their ADD and SUBTRACT buttons
// (sheet-worker.js:12691-13240). Rules only -- no Foundry here, so tools/wealth-test.html can drive it.
//
// Gems and jewelry are kept the way his sheet keeps them, and the way system.wealth.gems and .jewelry
// already hold them: one comma-separated string of entries written "<count> <name> w/<value each>",
// e.g. "3 Ruby w/50,1 Silver Ring w/12". A line typed by hand in the Description tab reads the same.
//==================================================================================================================

	// @MARKER GEM TYPES
	// His Update Gems select, in his order.
	export const GEM_TYPES = ["Turquoise", "Obsidian", "Lapis Lazuli", "Ivory", "Marble", "Jade", "Russet", "Amber",
		"Agate", "Aquamarine", "Amethyst", "Onyx", "Garnet", "Tiger’s Eye", "Tourmaline", "Topaz", "Peridot", "Pearl",
		"Opal", "Black Pearl", "Sapphire", "Ruby", "Diamond", "Emerald"];

	// The four coins, as his Update Coins select names them and as system.wealth stores them.
	export const COIN_TYPES = [
		// his label   field
		["Copper",     "copper"],
		["Silver",     "silver"],
		["Gold",       "gold"],
		["Platinum",   "platinum"]
	];

	// @MARKER GEM VALUE
	// This is the function which values one entry, his getGemValue (sheet-worker.js:26523): the count
	// is what comes before the first space (1 if there is none), the value each is what comes after
	// the "/", and the entry is worth the two multiplied.
	export function getGemValue(tmpEntry) {
		var tmpText = ("" + (tmpEntry ?? "")).trim();
		if (!tmpText) { return 0; }
		var tmpSpace = tmpText.indexOf(" ");
		var tmpCount = tmpSpace > 0 ? (parseInt(tmpText.slice(0, tmpSpace)) || 0) : 0;
		if (tmpCount < 1) { tmpCount = 1; }
		var tmpSlash = tmpText.indexOf("/");
		var tmpValue = tmpSlash >= 0 ? (parseInt(tmpText.slice(tmpSlash + 1)) || 0) : 0;
		return tmpValue * tmpCount;
	}

	// This is the function which values a whole gem or jewelry list.
	export function getListValue(tmpList) {
		return splitList(tmpList).reduce((tmpSum, tmpEntry) => tmpSum + getGemValue(tmpEntry), 0);
	}

	function splitList(tmpList) {
		return ("" + (tmpList ?? "")).split(",").map(tmpEntry => tmpEntry.trim()).filter(tmpEntry => tmpEntry);
	}

	// @MARKER WEALTH IN GOLD
	// This is the function which works out Wealth(in Gold), his own arithmetic from every one of his
	// update buttons: platinum x10, gold, silver /10 and copper /100 -- each coin rounded DOWN on its
	// own, as his parseInt does, so 9 silver and 90 copper add nothing -- plus every gem and every
	// piece of jewelry at count x value.
	export function getWealthInGold(tmpWealth) {
		var tmpGold = (parseInt(tmpWealth?.platinum) || 0) * 10
		            + (parseInt(tmpWealth?.gold) || 0)
		            + Math.floor((parseInt(tmpWealth?.silver) || 0) / 10)
		            + Math.floor((parseInt(tmpWealth?.copper) || 0) / 100);
		return tmpGold + getListValue(tmpWealth?.gems) + getListValue(tmpWealth?.jewelry);
	}

	// @MARKER UPDATE COINS
	// This is the function which adds or takes coins, his add_coins and subtract_coins. Nothing may
	// be taken that is not there. Returns { ok, update, message } -- the update is the one coin field
	// to write, and the message is his own words for the chat card.
	export function changeCoins(tmpWealth, tmpType, tmpCount, tmpAdd) {
		var tmpCoin = COIN_TYPES.find(([tmpLabel]) => tmpLabel == tmpType);
		var tmpNumber = parseInt(tmpCount) || 0;
		if (!tmpCoin || tmpNumber < 1) {
			return { ok: false, update: {}, message: `Cannot ${tmpAdd ? "add" : "subtract"} ${tmpNumber} coins of ${tmpType || "no type"}. Nothing done.` };
		}
		var tmpHave = parseInt(tmpWealth?.[tmpCoin[1]]) || 0;
		if (!tmpAdd && tmpNumber > tmpHave) {
			return { ok: false, update: {}, message: `Not enough coins of ${tmpType} to subtract ${tmpNumber}. Nothing done.` };
		}
		var tmpNew = { ...tmpWealth, [tmpCoin[1]]: tmpHave + (tmpAdd ? tmpNumber : -tmpNumber) };
		var tmpChange = getWealthInGold(tmpNew) - getWealthInGold(tmpWealth);
		return { ok: true, update: { [tmpCoin[1]]: tmpNew[tmpCoin[1]] },
			message: `${tmpAdd ? "Adding" : "Subtracting"} ${tmpNumber} coins of ${tmpType} resulting in a change in wealth of ${tmpChange} Gold` };
	}

	// @MARKER UPDATE GEMS AND JEWELRY
	// This is the function which adds or takes gems or jewelry, his add_gems / subtract_gems and
	// add_jewelry / subtract_jewelry, which are the same code on two lists. An entry is matched on
	// its name AND its value each, so three rubies worth 50 and one worth 500 stay two lines. Adding to
	// a match raises its count; otherwise a new line goes on the end. Taking removes a line that falls
	// to nothing, and refuses to take more than there are.
	//
	// His match is a substring test ("Ruby w/50" is found inside "3 Ruby w/500"); this one compares
	// the name and value exactly, so the two are not confused.
	export function changeValuables(tmpList, tmpName, tmpCount, tmpValue, tmpAdd, tmpNoun) {
		var tmpWhat = tmpNoun ?? "item(s)";
		var tmpLabel = ("" + (tmpName ?? "")).trim().replace(/,/g, " ");
		var tmpNumber = parseInt(tmpCount) || 0;
		var tmpEach = parseInt(tmpValue) || 0;
		var tmpVerb = tmpAdd ? "add" : "subtract";
		if (!tmpLabel || tmpNumber < 1 || tmpEach < 1) {
			return { ok: false, list: tmpList ?? "", message: `Cannot ${tmpVerb} ${tmpNumber} ${tmpWhat} of ${tmpLabel || "nothing"} each worth ${tmpEach}. Nothing done.` };
		}
		var tmpEntries = splitList(tmpList);
		var tmpIndex = tmpEntries.findIndex(tmpEntry => {
			var tmpMatch = tmpEntry.match(/^(\d+)\s+(.*?)\s+w\/(\d+)$/);
			return tmpMatch && tmpMatch[2] == tmpLabel && parseInt(tmpMatch[3]) == tmpEach;
		});
		var tmpHave = tmpIndex >= 0 ? (parseInt(tmpEntries[tmpIndex]) || 0) : 0;
		if (tmpAdd) {
			var tmpLine = `${tmpHave + tmpNumber} ${tmpLabel} w/${tmpEach}`;
			if (tmpIndex >= 0) { tmpEntries[tmpIndex] = tmpLine; } else { tmpEntries.push(tmpLine); }
		} else {
			if (tmpIndex < 0) {
				return { ok: false, list: tmpList ?? "", message: `No matching ${tmpWhat} of ${tmpLabel} each worth ${tmpEach} found to remove. Nothing done.` };
			}
			if (tmpNumber > tmpHave) {
				return { ok: false, list: tmpList ?? "", message: `Not enough ${tmpWhat} of ${tmpLabel} each worth ${tmpEach} to remove. Nothing done.` };
			}
			if (tmpNumber < tmpHave) { tmpEntries[tmpIndex] = `${tmpHave - tmpNumber} ${tmpLabel} w/${tmpEach}`; }
			else { tmpEntries.splice(tmpIndex, 1); }
		}
		var tmpChange = tmpNumber * tmpEach * (tmpAdd ? 1 : -1);
		return { ok: true, list: tmpEntries.join(","),
			message: `${tmpAdd ? "Adding" : "Subtracting"} ${tmpNumber} ${tmpWhat} of ${tmpLabel} each worth ${tmpEach} resulting in a change in wealth of ${tmpChange} Gold` };
	}

// @MARKER ADD NEW wealth functions HERE
// @END (CODE)
