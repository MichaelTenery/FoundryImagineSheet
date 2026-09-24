// @START (CODE)
// @MARKER SHOP
//==================================================================================================================
// Buying equipment: his ADD/BUY ITEMS panel, his seven price levels and his payForIt, as rules with no
// Foundry in them, so tools/shop-test.html can drive every purchase with known purses and no dice at all.
//
// Where it comes from:
//     what may be bought     his ADD/BUY ITEMS panel, Equipment tab             ImagineTabbedCharacterSheet.html
//                                                                                  17783-18672 (shop-tables.mjs)
//     what it costs          weaponcostlist / equipmentcostlist / armorcostlist  sheet-worker.js:76678 / 77291 /
//                            seven columns, 1/4 low to triple high                 77918 (shop-tables.mjs)
//     reading a price        getCoins, getCoinType                               78645, 78659
//     paying                 payForIt, payForItOpen                              78641, 78671-78799
//     where it goes          add_item: "they have to carry it out of the store"  13955-14330, 14297
//
// His step 8, Money and Equipment (roll_confirm_money_equip, 7935), buys nothing: on his sheet buying is
// done afterwards, on the Equipment tab. The book puts it IN creation -- step 10, "Buy equipment ... Buy
// all the equipment you want or can afford" (Player's Guide p.xv), and "This money is used to purchase all
// of the belongings a player has upon character creation" (p.207) -- so the character generator has an
// Equipment step that sells from his panel at his prices and pays his way. module/chargen-view.mjs draws
// it; the window only reads the form.
//
// Where the port parts company with his code, each the recommended default taken on 2026-09-23 while the
// user was away (docs/DECISIONS.md, to confirm or overrule):
//     - a lower coin pays when the higher ones cannot, changed up ten for one      @MARKER CHANGING COINS UP
//     - the change his code makes takes Math.ceil, not his "+1"                   @MARKER PAY FOR IT
//     - hemp and silk rope are sold 50 feet at a time, as the book prices them     @MARKER BUNDLES
//     - "1O cp" is read as 10 cp and "3 bp" as 3 gp, and both are reported         @MARKER READING A PRICE
//     - fifteen names his panel spells differently from his values are aliased     @MARKER NAME ALIASES
//     - creature-hide armour is not sold: his panel needs a creature and a value   @MARKER CREATURE HIDE
//     - a document's own system.cost is its price, so homebrew can be sold          @MARKER HOMEBREW
//     - ...but a Cost his reading would misread is not sold, and a GM is told      @MARKER GAPS
//==================================================================================================================

import { SHOP_CATEGORIES, WEAPON_COSTS, EQUIPMENT_COSTS, ARMOR_COSTS } from "./shop-tables.mjs";
import { COIN_ABBREVIATIONS } from "./starting-money.mjs";
import { isProjectileWeapon } from "./combat/combat-rules.mjs";

	// @MARKER PRICE LEVELS
	// His Set Cost select (HTML 17761-17770), less "Free", in his order, and the column of his price
	// tables each one reads. The Game Master chooses one for the world -- "the GM determines if the cost
	// for items is low, medium, or high, depending upon the economics of his world setting" (p.207) --
	// and Medium is the default, the middle of the book's three. His Quarter/Half Low and Double/Triple
	// High are his own additions; Double and Triple High match the Master's Manual's Economy Cost
	// Multipliers (MM p.127).
	export const PRICE_LEVELS = [
		// key           his label        his column
		["quarterLow",   "Quarter Low",   0],
		["halfLow",      "Half Low",      1],
		["low",          "Low",           2],
		["medium",       "Medium",        3],
		["high",         "High",          4],
		["doubleHigh",   "Double High",   5],
		["tripleHigh",   "Triple High",   6]
	];
	export const DEFAULT_PRICE_LEVEL = "medium";

	// His "Free", the default of his select ("who said the best things in life aren`t free?", 14285). A
	// table tool for a Game Master handing out gear, so in the generator only a Game Master sees it: a
	// player choosing Free would be spending nothing and ignoring the money roll.
	export const FREE_LEVEL = "free";
	export const FREE_LABEL = "Free";

	// @MARKER COINS
	// The four coins in copper, the Player's Guide's coinage table (p.207): Platinum 10 gold, Gold 1,
	// Silver 1/10, Copper 1/100. The same ratios as his calculateWealth arithmetic (78832). Crysteel,
	// Adamantium and Mithreel are in the book's table but not on his sheet, and not here.
	export const COIN_VALUES = {
		// coin       in copper
		copper:       1,
		silver:       10,
		gold:         100,
		platinum:     1000
	};
	export const COIN_ORDER = ["copper", "silver", "gold", "platinum"];

	// @MARKER SHOP TYPES
	// His Type select (HTML 17742-17747), and where each type's documents and prices are.
	export const SHOP_TYPES = {
		// his Type    his label          document type   content key    his price table
		Armor:     { label: "Armor/Clothing", docType: "armor",     content: "armor",     costs: ARMOR_COSTS     },
		Weapon:    { label: "Weapon",         docType: "weapon",    content: "weapons",   costs: WEAPON_COSTS    },
		Equipment: { label: "Equipment",      docType: "equipment", content: "equipment", costs: EQUIPMENT_COSTS }
	};
	export const SHOP_TYPE_ORDER = ["Armor", "Weapon", "Equipment"];

	// The kind a homebrew item is listed under -- see @MARKER HOMEBREW. His panel has no such radio.
	export const OTHER_SUBTYPE = "Other (Game Master's)";

	// @MARKER NAME ALIASES
	// Names his panel and his price tables use for an item that his VALUE tables -- and so the packs,
	// which are built from them -- call something else. Without these the item could be priced but not
	// created. Fifteen of them:
	//   - his fairy crossbow bolts are priced as "Arrow(Fairy ... Crossbow/...)" (77196-77217) and
	//     valued as "Bolt(Fairy ... Crossbow/...)" (79792 on), which is what they are;
	//   - "Gauntlets(Stainless Steel)" is "Gauntlets(Stainless Steel" in both his price and value
	//     tables (78111), with no closing parenthesis, so the price is looked up under that name too.
	// Three of his offers are left out altogether, because there is nothing true to alias them to:
	// Arrow(Fairy Crossbow/True Flight) and Arrow(Fairy Long Bow/True Flight) have a price and no values
	// (his value table has Bolt(Fairy Crossbow/Normal) twice, 79794 and 79796, the second perhaps meant
	// for True Flight), and Arrow(Horn Bow/True Flight/Far Flight) has values (79537) and no price.
	// All eighteen are filed with him. The recommended default, taken 2026-09-23 while the user was away.
	//
	// His launcher code knows the fairy crossbow bolts only by his panel's spelling -- "Arrow(Fairy Hand
	// Crossbow" (getLauncherFromProjectile 86842, and the ammunition test at 86547) -- so bought under the
	// pack's "Bolt(...)" they would be valued and never matched to their crossbow. The port's launcher
	// table (MISSILE_LAUNCHER_MATCHES, module/combat/combat-rules.mjs) carries the Bolt spelling beside his
	// Arrow one for that reason, and tools/shop-test.html checks a bought bolt finds its crossbow.
	export const SHOP_NAME_ALIASES = {
		// his shop name                                  the pack's document
		"Arrow(Fairy Crossbow/Far Flight)":               "Bolt(Fairy Crossbow/Far Flight)",
		"Arrow(Fairy Crossbow/Heavy)":                    "Bolt(Fairy Crossbow/Heavy)",
		"Arrow(Fairy Crossbow/Normal)":                   "Bolt(Fairy Crossbow/Normal)",
		"Arrow(Fairy Crossbow/Piercing)":                 "Bolt(Fairy Crossbow/Piercing)",
		"Arrow(Fairy Heavy Crossbow/Far Flight)":         "Bolt(Fairy Heavy Crossbow/Far Flight)",
		"Arrow(Fairy Heavy Crossbow/Heavy)":              "Bolt(Fairy Heavy Crossbow/Heavy)",
		"Arrow(Fairy Heavy Crossbow/Normal)":             "Bolt(Fairy Heavy Crossbow/Normal)",
		"Arrow(Fairy Heavy Crossbow/Piercing)":           "Bolt(Fairy Heavy Crossbow/Piercing)",
		"Arrow(Fairy Heavy Crossbow/True Flight)":        "Bolt(Fairy Heavy Crossbow/True Flight)",
		"Arrow(Fairy Hand Crossbow/Far Flight)":          "Bolt(Fairy Hand Crossbow/Far Flight)",
		"Arrow(Fairy Hand Crossbow/Heavy)":               "Bolt(Fairy Hand Crossbow/Heavy)",
		"Arrow(Fairy Hand Crossbow/Normal)":              "Bolt(Fairy Hand Crossbow/Normal)",
		"Arrow(Fairy Hand Crossbow/Piercing)":            "Bolt(Fairy Hand Crossbow/Piercing)",
		"Arrow(Fairy Hand Crossbow/True Flight)":         "Bolt(Fairy Hand Crossbow/True Flight)",
		"Gauntlets(Stainless Steel)":                     "Gauntlets(Stainless Steel"
	};

	// The three offers left out on purpose, named above. They are in the catalog's left like anything
	// else the shop does not sell, marked known, so a Game Master is only told about what is missing
	// from THEIR world (describeShopGaps), not about his data every time.
	export const SHOP_LEFT_OUT = [
		"Arrow(Fairy Crossbow/True Flight)",
		"Arrow(Fairy Long Bow/True Flight)",
		"Arrow(Horn Bow/True Flight/Far Flight)"
	];

	// @MARKER BUNDLES
	// Thirty of his equipment names are bundles -- "10 Arrow Head", "7 Rations(per day)", "50 Twine(per
	// ’)" -- and his price row for each is the price of the BUNDLE. A bundle is found in the packs by its
	// name less the count, and buying one gives that many of the item. That is how his own sheet reads one
	// once bought: add_item stores the name as it is, "10 Nails", and everything that reads it afterwards
	// takes the count off the front first (getNumOfItems 76336, getItemWithoutCount 76359, getItemWeight
	// 81938). So "10 Nails" and "10 Needles(Assorted)" are ten Nails and ten Needles(Assorted) like the
	// rest, although his values also carry a "10 Nails" row (.06 lb) and a "10 Needles(Assorted)" row
	// (.03 lb) that nothing on his sheet reaches through a purchase.
	//
	// Two more are sold one foot at a time on his sheet, at the prices the book gives for FIFTY feet:
	// "Rope, Hemp (per 50 feet) 2 sp 4 sp 6 sp 10 lb." and silk 3/5/8 gp (p.212). His weight agrees with
	// the book -- .2 lb a foot, which is the book's 10 lb for fifty -- and every other thing sold by the
	// foot in his panel is already a "50 X" bundle (twine, chain, wire, spidersilk rope). So these two are
	// sold fifty feet at a time too; on his sheet as written fifty feet of hemp rope costs 20 gp. Steel
	// wire (8 cp a foot, not in the book) is left as he has it. The recommended default, taken 2026-09-23
	// while the user was away; filed with him.
	export const SHOP_BUNDLE_OVERRIDES = {
		// his shop name          sold in bundles of
		"Rope(Hemp per’)":        50,
		"Rope(Silk per’)":        50
	};

	// @MARKER CREATURE HIDE
	// This is the function which says whether an armour name is one of his creature-hide pieces. His
	// add_item refuses them unless a creature and an armour value are entered (14102, 14270-14283), and
	// then renames the piece after the creature (setCreatureArmorName, 78802). The port has neither field
	// yet, and a hide sold bare would protect as nothing his rules make it, so the generator's shop leaves
	// all sixty out. The recommended default, taken 2026-09-23 while the user was away.
	export function isCreatureHide(tmpName) {
		var tmpText = "" + (tmpName ?? "");
		return tmpText.includes("Giant Chitin") || tmpText.includes("Giant Leather") || tmpText.includes("Giant Scales");
	}

	// @MARKER NAMES
	// This is the function which puts a name in the one form both sides can be compared in. His sheet
	// writes an apostrophe as ’ in one table and a backtick in another -- his values have both
	// "Rope(Hemp per’)" and "Rope(Hemp per`)", and the packs, which clean the backtick to ', carry
	// both spellings -- and his inch mark is “. A U+FFFD, the mark a bad decode leaves where a ’ was,
	// is read as one too, so a world whose data ever passed through one still matches. Runs of spaces
	// count as one.
	export function normalizeItemName(tmpName) {
		return ("" + (tmpName ?? ""))
			.replace(/[\u2019\u2018`\uFFFD]/g, "'")
			.replace(/[\u201C\u201D]/g, "\"")
			.replace(/\s+/g, " ")
			.trim();
	}

	// @MARKER READING A PRICE
	// This is the function which reads one of his price strings: "7 gp", "60  gp", "4 gp ".
	//
	// His getCoins takes the number before the first space, and his getCoinType tests the string for
	// "cp", then "sp", then "gp", then "pp" -- in that order, so the first found wins. The same here.
	// "0 gp" is a price of nothing, which his code pays (a cost of 0 is always covered). A string with no
	// number or no coin is no price at all -- his "0" for a name missing from his tables is one of these.
	//
	// Two of his strings are slips, read here as they are plainly meant (the footing the port's "dl0" as
	// d10 is on, UPSTREAM-ISSUES item 34) and reported in the returned issue:
	//     "1O cp"   a capital O for the 0 of 10 -- Cup(Measuring), Glass Flask(1 cup) and Oil(Rubbing) at
	//               Medium. His parseInt stops at the O and charges 1 cp.
	//     "3 bp"    Helm(Heavy Bone) at Half Low; no coin his getCoinType knows, so his sheet cannot sell
	//               it there. Read as gp, the coin of every other column of that row.
	// The recommended default, taken 2026-09-23 while the user was away.
	//
	// A price a Game Master TYPES -- an item's Cost field, @MARKER HOMEBREW -- can be something none of
	// his strings is, and that his getCoins and getCoinType would misread without a word:
	//     "2 gp 5 sp"   more than one coin: his order finds "sp" first and charges 2 sp
	//     "1.5 gp"      a fraction: his parseInt stops at the point and charges 1 gp
	// These are still read his way, so his reading and the port's never part, but marked doubtful with
	// the reason in issue. The shop will not sell at a doubtful price (readDocumentCost) and says why
	// instead. None of his own price strings is either.
	//
	// Returns { amount, coin, copper, text, raw, issue, doubtful }, or null when there is no price.
	export function parsePrice(tmpText) {
		var tmpRaw = ("" + (tmpText ?? "")).trim();
		if (!tmpRaw) { return null; }
		var tmpIssue = "";
		var tmpClean = tmpRaw;
		if (/^\d+O\b/.test(tmpClean)) {
			tmpClean = tmpClean.replace(/^(\d+)O/, (tmpAll, tmpDigits) => tmpDigits + "0");
			tmpIssue = `"${tmpRaw}" has a letter O for a zero; read as ${tmpClean}.`;
		}
		var tmpNumber = tmpClean.match(/^(\d+)/);
		if (!tmpNumber) { return null; }
		var tmpCoin = "";
		if      (tmpClean.includes("cp")) { tmpCoin = "copper"; }
		else if (tmpClean.includes("sp")) { tmpCoin = "silver"; }
		else if (tmpClean.includes("gp")) { tmpCoin = "gold"; }
		else if (tmpClean.includes("pp")) { tmpCoin = "platinum"; }
		else if (tmpClean.includes("bp")) {
			tmpCoin = "gold";
			tmpIssue = `"${tmpRaw}" names no coin his sheet knows; read as gp.`;
		}
		if (!tmpCoin) { return null; }
		var tmpAmount = parseInt(tmpNumber[1]) || 0;
		// the two misreadings above
		var tmpDoubt = "";
		if ((tmpClean.match(/cp|sp|gp|pp/g) ?? []).length > 1) {
			tmpDoubt = `"${tmpRaw}" names more than one coin, and would be charged as ${formatCoins(tmpAmount, tmpCoin)}; `
				+ `write it in one coin, such as "25 sp" for 2 gp 5 sp.`;
		} else if (/^\d+[.,]\d/.test(tmpClean)) {
			tmpDoubt = `"${tmpRaw}" is not a whole number of coins, and would be charged as ${formatCoins(tmpAmount, tmpCoin)}; `
				+ `write it in a smaller coin, such as "15 sp" for 1.5 gp.`;
		}
		return {
			amount: tmpAmount, coin: tmpCoin, copper: tmpAmount * COIN_VALUES[tmpCoin],
			text: formatCoins(tmpAmount, tmpCoin), raw: tmpRaw, issue: tmpDoubt || tmpIssue, doubtful: !!tmpDoubt
		};
	}

	// This is the function which reads a document's own Cost -- the price a Game Master gave it, see
	// @MARKER HOMEBREW. Returns { price, problem }: price is parsePrice's reading, or null when the field
	// is empty or cannot be charged as written; problem says why, when it is not empty and cannot. An
	// item whose Cost has a problem is not sold at all (joinShopCatalog) -- neither at the misread price
	// nor at his table's, which is not the price the Game Master meant either -- and the Game Master is
	// told (describeShopGaps).
	export function readDocumentCost(tmpDoc) {
		var tmpRaw = ("" + (tmpDoc?.system?.cost ?? "")).trim();
		if (!tmpRaw) { return { price: null, problem: "" }; }
		var tmpPrice = parsePrice(tmpRaw);
		if (!tmpPrice) {
			return { price: null, problem: `its Cost, "${tmpRaw}", is not a whole number and a coin (cp, sp, gp or pp), such as "5 gp"` };
		}
		if (tmpPrice.doubtful) { return { price: null, problem: `its Cost: ${tmpPrice.issue}` }; }
		return { price: tmpPrice, problem: "" };
	}

	// This is the function which writes an amount of one coin the way his tables do: "7 gp".
	export function formatCoins(tmpAmount, tmpCoin) {
		return `${tmpAmount} ${COIN_ABBREVIATIONS[tmpCoin] ?? tmpCoin}`;
	}

	// @MARKER PURSE
	// This is the function which gives a purse -- { copper, silver, gold, platinum } -- as whole coins,
	// each read the way his getAttrs values are (parseInt, or 0).
	export function readPurse(tmpPurse) {
		return {
			copper:   parseInt(tmpPurse?.copper) || 0,
			silver:   parseInt(tmpPurse?.silver) || 0,
			gold:     parseInt(tmpPurse?.gold) || 0,
			platinum: parseInt(tmpPurse?.platinum) || 0
		};
	}

	// This is the function which says what a purse is worth, in copper.
	export function getPurseValue(tmpPurse) {
		var tmpCoins = readPurse(tmpPurse);
		return COIN_ORDER.reduce((tmpSum, tmpCoin) => tmpSum + tmpCoins[tmpCoin] * COIN_VALUES[tmpCoin], 0);
	}

	// @MARKER PAY FOR IT
	// This is the function which pays a price the way his payForItOpen does (sheet-worker.js:78671-78799),
	// line for line: from the price's own coin first; failing that, breaking higher coins into it one
	// rung at a time; and where silver or copper had to be broken out of platinum or gold, gathering the
	// change left over back up into the higher coin ("making better coin change").
	//
	// ONE departure. Where he works out how many higher coins to break he writes
	//     highercoin=(parseInt(shortfall/10)||0)+1;
	// which takes one coin too many whenever the shortfall is an exact multiple -- and when the purse held
	// exactly enough, drives the higher coin NEGATIVE: 1 pp buying a 10 gp item leaves -1 pp and 10 gp.
	// The value is right and the purse is impossible, and it contradicts the test his code has just made
	// ("do we have enough gold+platinum to cover it?") and his own comment ("how much platinum we still
	// need"). Here it takes only what is needed, Math.ceil; his line is kept beside each use. The
	// recommended default, taken 2026-09-23 while the user was away; filed with him.
	//
	//   tmpPurse    { copper, silver, gold, platinum }
	//   tmpNumber   how many are bought
	//   tmpAmount   the price of one, in tmpCoin
	//   tmpCoin     "copper" / "silver" / "gold" / "platinum" (his "Copper" ... "Platinum" read too)
	//
	// Returns { ok, purse }: the purse after paying, or the purse untouched when it cannot pay. Never
	// changes the purse it is given.
	export function payForItOpen(tmpPurse, tmpNumber, tmpAmount, tmpCoin) {
		var tmpplatinum = parseInt(tmpPurse?.platinum) || 0;
		var tmpgold = parseInt(tmpPurse?.gold) || 0;
		var tmpsilver = parseInt(tmpPurse?.silver) || 0;
		var tmpcopper = parseInt(tmpPurse?.copper) || 0;
		var tmpNumberofitems = parseInt(tmpNumber) || 0;
		var tmpcointype = ("" + (tmpCoin ?? "")).toLowerCase();
		var tmpcoins = parseInt(tmpAmount) || 0;
		var tmpcoincost = tmpNumberofitems * tmpcoins;
		var shortfall = 0;
		var highercoin = 0;
		var paidinfull = false;
		// how many higher coins make up a shortfall -- see the note above
		var tmpHowMany = (tmpShort, tmpRatio) => Math.ceil(tmpShort / tmpRatio);
		// var tmpHowMany = (tmpShort, tmpRatio) => (parseInt(tmpShort / tmpRatio) || 0) + 1;   // his line as written
		switch (tmpcointype) {
			case "platinum":
				if (tmpcoincost <= tmpplatinum) { // do we have the right number of the correct coin?
					tmpplatinum = tmpplatinum - tmpcoincost;
					paidinfull = true;
				}
				break;
			case "gold":
				if (tmpcoincost <= tmpgold) { // do we have the right number of the correct coin?
					tmpgold = tmpgold - tmpcoincost;
					paidinfull = true;
				} else if (tmpcoincost <= tmpgold + (tmpplatinum * 10)) { // enough gold+platinum to cover it?
					shortfall = tmpcoincost - tmpgold; // how many gold coins are we short?
					highercoin = tmpHowMany(shortfall, 10);
					tmpplatinum = tmpplatinum - highercoin;
					tmpgold = tmpgold + (highercoin * 10) - tmpcoincost;
					paidinfull = true;
				}
				break;
			case "silver":
				if (tmpcoincost <= tmpsilver) { // do we have the right number of the correct coin?
					tmpsilver = tmpsilver - tmpcoincost;
					paidinfull = true;
				} else if (tmpcoincost <= tmpsilver + (tmpgold * 10)) { // enough silver+gold to cover it?
					shortfall = tmpcoincost - tmpsilver; // how many silver coins are we short?
					highercoin = tmpHowMany(shortfall, 10);
					tmpgold = tmpgold - highercoin;
					tmpsilver = tmpsilver + (highercoin * 10) - tmpcoincost;
					paidinfull = true;
				} else if (tmpcoincost <= tmpsilver + (tmpgold * 10) + (tmpplatinum * 100)) { // silver+gold+platinum?
					tmpsilver = tmpsilver + (tmpgold * 10); // add all our gold to silver
					tmpgold = 0;
					shortfall = tmpcoincost - tmpsilver; // short after adding in all the gold
					highercoin = tmpHowMany(shortfall, 100); // this is how much platinum we still need
					tmpplatinum = tmpplatinum - highercoin;
					tmpsilver = tmpsilver + (highercoin * 100) - tmpcoincost;
					// making better coin change (silver to gold)
					highercoin = parseInt(tmpsilver / 10) || 0;
					tmpsilver = tmpsilver - (highercoin * 10);
					tmpgold = highercoin;
					paidinfull = true;
				}
				break;
			case "copper":
				if (tmpcoincost <= tmpcopper) { // do we have the right number of the correct coin?
					tmpcopper = tmpcopper - tmpcoincost;
					paidinfull = true;
				} else if (tmpcoincost <= tmpcopper + (tmpsilver * 10)) { // enough copper+silver to cover it?
					shortfall = tmpcoincost - tmpcopper; // how many copper coins are we short?
					highercoin = tmpHowMany(shortfall, 10);
					tmpsilver = tmpsilver - highercoin;
					tmpcopper = tmpcopper + (highercoin * 10) - tmpcoincost;
					paidinfull = true;
				} else if (tmpcoincost <= tmpcopper + (tmpsilver * 10) + (tmpgold * 100)) { // copper+silver+gold?
					tmpcopper = tmpcopper + (tmpsilver * 10); // add all our silver to copper
					tmpsilver = 0;
					shortfall = tmpcoincost - tmpcopper;
					highercoin = tmpHowMany(shortfall, 100); // this is how much gold we still need
					tmpgold = tmpgold - highercoin;
					tmpcopper = tmpcopper + (highercoin * 100) - tmpcoincost;
					// making better coin change (copper to silver)
					highercoin = parseInt(tmpcopper / 10) || 0;
					tmpcopper = tmpcopper - (highercoin * 10);
					tmpsilver = highercoin;
					paidinfull = true;
				} else if (tmpcoincost <= tmpcopper + (tmpsilver * 10) + (tmpgold * 100) + (tmpplatinum * 1000)) { // and platinum?
					tmpcopper = tmpcopper + (tmpsilver * 10); // add all our silver to copper
					tmpsilver = 0;
					tmpcopper = tmpcopper + (tmpgold * 100); // add all our gold to copper
					tmpgold = 0;
					shortfall = tmpcoincost - tmpcopper;
					highercoin = tmpHowMany(shortfall, 1000); // this is how much platinum we still need
					tmpplatinum = tmpplatinum - highercoin;
					tmpcopper = tmpcopper + (highercoin * 1000) - tmpcoincost;
					// making better coin change (copper to silver)
					highercoin = parseInt(tmpcopper / 10) || 0;
					tmpcopper = tmpcopper - (highercoin * 10);
					tmpsilver = highercoin;
					// making better coin change (silver to gold)
					highercoin = parseInt(tmpsilver / 10) || 0;
					tmpsilver = tmpsilver - (highercoin * 10);
					tmpgold = highercoin;
					paidinfull = true;
				}
				break;
		}
		if (!paidinfull) { return { ok: false, purse: readPurse(tmpPurse) }; }
		return { ok: true, purse: { copper: tmpcopper, silver: tmpsilver, gold: tmpgold, platinum: tmpplatinum } };
	}

	// @MARKER CHANGING COINS UP
	// His payForItOpen never pays with a coin LOWER than the price's coin. As written that means a gold
	// price cannot be paid in silver and a platinum price cannot be paid in gold -- and starting money for
	// social classes 9 to 16 comes in gold (module/starting-money.mjs STARTING_MONEY), so none of them could
	// buy any of the 111 things priced in platinum at Medium, every Player's Guide armour suit among them
	// (Leather 6 pp, Chain 12 pp). A Baron's child with 275 gp could not buy a leather suit, which the book's
	// own step 10 recommends ("buying whole suits of armor").
	//
	// So where his order refuses and the purse is WORTH the price, lower coins are changed up ten for one
	// (the book's coinage, p.207) into the price's coin, and his order is tried again. Wherever his sheet
	// pays, this pays exactly as his sheet does; it only pays where his refuses. The recommended default,
	// taken 2026-09-23 while the user was away; filed with him.
	//
	// This is the function which changes tmpCount coins of tmpCoin up from the coin below it, changing up
	// from further down in turn when that one runs short. Changes the purse it is given. Returns false if
	// the coins below are not worth enough -- having changed up what it could, value for value.
	export function changeCoinsUp(tmpPurse, tmpCoin, tmpCount) {
		var tmpIndex = COIN_ORDER.indexOf(tmpCoin);
		var tmpWanted = parseInt(tmpCount) || 0;
		if (tmpWanted < 1) { return true; }
		if (tmpIndex <= 0) { return false; }
		var tmpLower = COIN_ORDER[tmpIndex - 1];
		var tmpHave = parseInt(tmpPurse[tmpLower]) || 0;
		if (tmpHave < tmpWanted * 10) {
			if (!changeCoinsUp(tmpPurse, tmpLower, tmpWanted * 10 - tmpHave)) { return false; }
		}
		tmpPurse[tmpLower] = (parseInt(tmpPurse[tmpLower]) || 0) - tmpWanted * 10;
		tmpPurse[tmpCoin] = (parseInt(tmpPurse[tmpCoin]) || 0) + tmpWanted;
		return true;
	}

	// This is the function which changes ONE coin up -- ten of the coin below for one of tmpCoin.
	export function changeOneUp(tmpPurse, tmpCoin) {
		return changeCoinsUp(tmpPurse, tmpCoin, 1);
	}

	// @MARKER PAY A PRICE
	// This is the function which pays for tmpNumber of something at one price (parsePrice): his order
	// first, and only if that refuses, the change-up above. Changing up one coin at a time and trying his
	// order after each would stop at exactly the count worked out here -- the value his order can reach
	// is the coins at or above the price's coin, which is a whole number of that coin -- so it is done in
	// one go.
	//
	// Returns { ok, purse, how, cost }: how is "free", "his" (paid exactly as his sheet would),
	// "changed up", or "refused"; cost is what it came to, in copper. Never changes the purse it is given.
	export function payPrice(tmpPurse, tmpNumber, tmpPrice) {
		var tmpCount = parseInt(tmpNumber) || 0;
		var tmpStart = readPurse(tmpPurse);
		if (!tmpPrice || tmpCount < 1) { return { ok: false, purse: tmpStart, how: "refused", cost: 0 }; }
		var tmpCost = tmpCount * tmpPrice.copper;
		if (tmpCost <= 0) { return { ok: true, purse: tmpStart, how: "free", cost: 0 }; }

		var tmpHis = payForItOpen(tmpStart, tmpCount, tmpPrice.amount, tmpPrice.coin);
		if (tmpHis.ok) { return { ok: true, purse: tmpHis.purse, how: "his", cost: tmpCost }; }
		if (getPurseValue(tmpStart) < tmpCost) { return { ok: false, purse: tmpStart, how: "refused", cost: tmpCost }; }

		// What his order can reach: the price's coin and every coin above it.
		var tmpUnit = COIN_VALUES[tmpPrice.coin];
		var tmpReach = COIN_ORDER.filter(tmpCoin => COIN_VALUES[tmpCoin] >= tmpUnit)
			.reduce((tmpSum, tmpCoin) => tmpSum + tmpStart[tmpCoin] * COIN_VALUES[tmpCoin], 0);
		var tmpChanged = { ...tmpStart };
		if (!changeCoinsUp(tmpChanged, tmpPrice.coin, Math.ceil((tmpCost - tmpReach) / tmpUnit))) {
			return { ok: false, purse: tmpStart, how: "refused", cost: tmpCost };
		}
		var tmpAfter = payForItOpen(tmpChanged, tmpCount, tmpPrice.amount, tmpPrice.coin);
		if (!tmpAfter.ok) { return { ok: false, purse: tmpStart, how: "refused", cost: tmpCost }; }
		return { ok: true, purse: tmpAfter.purse, how: "changed up", cost: tmpCost };
	}

	// @MARKER DESCRIBING MONEY
	// This is the function which says what a purse holds, richest coin first: "40 pp, 3 gp", or "" for
	// nothing -- the generator's Review line, which used to do this inline.
	export function describeCoins(tmpPurse) {
		var tmpCoins = readPurse(tmpPurse);
		return [...COIN_ORDER].reverse().filter(tmpCoin => tmpCoins[tmpCoin])
			.map(tmpCoin => formatCoins(tmpCoins[tmpCoin], tmpCoin)).join(", ");
	}

	// This is the function which says what an amount of copper is worth in gold, silver and copper --
	// "11 gp, 7 sp" -- for what was spent. No platinum, as his Wealth(in Gold) counts in gold.
	export function describeValue(tmpCopper) {
		var tmpValue = Math.max(0, parseInt(tmpCopper) || 0);
		return describeCoins({ gold: Math.floor(tmpValue / 100), silver: Math.floor((tmpValue % 100) / 10),
			copper: tmpValue % 10 });
	}

	// @MARKER THE CATALOG
	// This is the function which works out everything the shop sells, from his panel and his prices,
	// joined to the documents the world actually holds.
	//
	//   tmpContent      { equipment, armor, weapons }: plain documents, as the compendiums hold them
	//   tmpIsAvailable  the campaign's content switches, tmpIsAvailable(doc) -> true/false
	//
	// An offer is one of his select names, not a document: "10 Arrow Head" is an offer of the document
	// "Arrow Head", ten at a time, at his bundle price. Each offer:
	//     key          "Weapon|Long Sword" -- his Type and his name, unique
	//     type         his Type; subtypes, the radios his panel lists it under
	//     name         his name, as his tables spell it; label, what the shop shows
	//     docName      the document's name; docType, "weapon" / "armor" / "equipment"; doc, the document
	//     bundle       how many of the document one purchase gives
	//     prices       his seven price strings (for a homebrew item, its own cost seven times)
	//     unitWeight   one of the document; weight, one purchase
	//     stacks       true: bought copies become ONE item with a quantity (see buildPurchasedEntries)
	//     homebrew     true for a document his panel does not list, sold at its own cost
	//
	// Returns { offers, byKey, categories, left }: categories is each Type's kinds for the shop's Kind
	// select, and left is what the shop does not sell that it otherwise would -- his offers, and items
	// with a Cost of their own it cannot read -- each { key, type, name, reason, known }, so a Game Master
	// can be told rather than finding it silently missing (describeShopGaps, shown on the Equipment step).
	// known marks the ones left out on purpose, the same in every world: creature hide and SHOP_LEFT_OUT.
	// The joining is done once per content and kept; the content switches are applied afresh each call,
	// as a Game Master may change them at any time.
	const CATALOG_MEMO = new WeakMap();
	export function buildShopCatalog(tmpContent, tmpIsAvailable) {
		var tmpAvail = tmpIsAvailable ?? (() => true);
		var tmpBase = (tmpContent && typeof tmpContent == "object") ? CATALOG_MEMO.get(tmpContent) : null;
		if (!tmpBase) {
			tmpBase = joinShopCatalog(tmpContent ?? {});
			if (tmpContent && typeof tmpContent == "object") { CATALOG_MEMO.set(tmpContent, tmpBase); }
		}
		var tmpOffers = tmpBase.offers.filter(tmpOffer => tmpAvail(tmpOffer.doc));
		var tmpByKey = {};
		for (const tmpOffer of tmpOffers) { tmpByKey[tmpOffer.key] = tmpOffer; }
		var tmpCategories = {};
		for (const tmpType of SHOP_TYPE_ORDER) {
			tmpCategories[tmpType] = (SHOP_CATEGORIES[tmpType] ?? []).map(([tmpValue, tmpLabel]) => ({ value: tmpValue, label: tmpLabel }));
			if (tmpOffers.some(tmpOffer => tmpOffer.type == tmpType && tmpOffer.homebrew)) {
				tmpCategories[tmpType].push({ value: OTHER_SUBTYPE, label: OTHER_SUBTYPE });
			}
		}
		return { offers: tmpOffers, byKey: tmpByKey, categories: tmpCategories, left: tmpBase.left };
	}

	// This is the function which does the joining for buildShopCatalog: his panel, his prices, the
	// documents. Nothing here depends on the content switches, which is why it can be kept.
	function joinShopCatalog(tmpContent) {
		var tmpOffers = [];
		var tmpByKey = {};
		var tmpLeft = [];
		// @MARKER HOMEBREW (the documents his panel already sells, so they are not listed twice -- the documents
		// themselves, not their names: Leecher's Tools is not the Leecher’s Tools his panel sells)
		var tmpSold = {};

		for (const tmpType of SHOP_TYPE_ORDER) {
			var tmpDef = SHOP_TYPES[tmpType];
			var tmpDocs = tmpContent[tmpDef.content] ?? [];
			// Two indexes of the documents: by exact name, and by normalizeItemName. A name is looked up
			// exactly first, and only failing that by its normalized spelling. The packs hold many items
			// twice, once with his ’ and once with a plain ' (where his values wrote a backtick), and three
			// such pairs are NOT the same item -- Leecher’s Tools is .5 lb and Leecher's Tools 2 lb (his values,
			// sheet-worker.js:80774 and 81342), and so with Canvas(Waterproof/sq.’) and Leather Cord(1’).
			// His panel sells the ’ one, and the ’ one is what his add_item adds. Within each index the
			// first of a name wins, but that is never what decides between the pair: a world's compendium
			// does not keep the order the packs were written in (the importer gives every document a new
			// id), so which of two spellings comes first cannot be relied on.
			var tmpExact = new Map();
			var tmpIndex = new Map();
			for (const tmpDoc of tmpDocs) {
				var tmpDocName = "" + (tmpDoc?.name ?? "");
				if (tmpDocName && !tmpExact.has(tmpDocName)) { tmpExact.set(tmpDocName, tmpDoc); }
				var tmpNorm = normalizeItemName(tmpDocName);
				if (tmpNorm && !tmpIndex.has(tmpNorm)) { tmpIndex.set(tmpNorm, tmpDoc); }
			}
			var tmpFind = (tmpWanted) => tmpExact.get(tmpWanted) ?? tmpIndex.get(normalizeItemName(tmpWanted)) ?? null;
			tmpSold[tmpType] = new Set();

			for (const [tmpSubtype, tmpSubLabel, tmpNames] of SHOP_CATEGORIES[tmpType] ?? []) {
				for (const tmpName of tmpNames) {
					var tmpKey = tmpType + "|" + tmpName;
					if (tmpByKey[tmpKey]) {
						if (!tmpByKey[tmpKey].subtypes.includes(tmpSubtype)) { tmpByKey[tmpKey].subtypes.push(tmpSubtype); }
						continue;
					}
					if (tmpLeft.some(tmpEntry => tmpEntry.key == tmpKey)) { continue; }

					// The document: through an alias; or, for a name that starts with a count, by his
					// name less the count, that many at a time (@MARKER BUNDLES -- as his own sheet reads
					// "10 Nails" once bought); or by his name whole.
					var tmpAlias = SHOP_NAME_ALIASES[tmpName] ?? "";
					var tmpDoc = null;
					var tmpBundle = 1;
					if (tmpAlias) {
						tmpDoc = tmpFind(tmpAlias);
					} else {
						var tmpCount = tmpName.match(/^(\d+) (.+)$/);
						if (tmpCount) {
							tmpDoc = tmpFind(tmpCount[2]);
							if (tmpDoc) { tmpBundle = parseInt(tmpCount[1]) || 1; }
						}
						if (!tmpDoc) { tmpDoc = tmpFind(tmpName); }
					}
					if (SHOP_BUNDLE_OVERRIDES[tmpName]) { tmpBundle = SHOP_BUNDLE_OVERRIDES[tmpName]; }
					var tmpPrices = tmpDef.costs[tmpName] ?? (tmpAlias ? tmpDef.costs[tmpAlias] : null) ?? null;

					var tmpWhy = "";
					if (tmpType == "Armor" && isCreatureHide(tmpName)) {
						tmpWhy = "creature hide: his sheet needs the creature and its armour value, which are not ported yet";
					} else if (!tmpDoc) {
						tmpWhy = "not in the compendium";
					} else if (!tmpPrices) {
						tmpWhy = "no price in his tables";
					} else {
						// A Game Master gave it a Cost of its own that cannot be charged as written. The
						// document counts as his panel's all the same, so it is not reported twice below.
						tmpWhy = readDocumentCost(tmpDoc).problem;
						if (tmpWhy) { tmpSold[tmpType].add(tmpDoc); }
					}
					if (tmpWhy) {
						tmpLeft.push({ key: tmpKey, type: tmpType, name: tmpName, reason: tmpWhy,
							known: (tmpType == "Armor" && isCreatureHide(tmpName)) || SHOP_LEFT_OUT.includes(tmpName) });
						continue;
					}

					var tmpOffer = makeOffer(tmpType, tmpName, tmpSubtype, tmpDoc, tmpBundle, tmpPrices, false);
					tmpOffer.label = SHOP_BUNDLE_OVERRIDES[tmpName] ? `${tmpBundle} ${tmpName}` : tmpName;
					tmpOffers.push(tmpOffer);
					tmpByKey[tmpKey] = tmpOffer;
					tmpSold[tmpType].add(tmpDoc);
				}
			}

			// @MARKER HOMEBREW
			// A document with a cost of its own that his panel does not list -- a Game Master's new
			// item -- is sold under "Other (Game Master's)" at that cost, whatever the price level.
			// That is how homebrew gets a price with no code change (CLAUDE.md: custom entries must work
			// without one), and it is why prices live in this module and not on the pack documents: a
			// world only takes new document data when its Game Master re-imports the content. The
			// recommended default, taken 2026-09-23 while the user was away.
			// A Cost that cannot be charged as written ("5 gold", "2 gp 5 sp") keeps the item off the
			// shelf, and goes in left to be told to the Game Master, rather than being sold at a misreading.
			for (const tmpDoc of tmpDocs) {
				var tmpCost = readDocumentCost(tmpDoc);
				if ((!tmpCost.price && !tmpCost.problem) || tmpSold[tmpType].has(tmpDoc)) { continue; }
				var tmpHomeKey = tmpType + "|" + tmpDoc.name;
				if (tmpByKey[tmpHomeKey] || tmpLeft.some(tmpEntry => tmpEntry.key == tmpHomeKey)) { continue; }
				if (tmpCost.problem) {
					tmpLeft.push({ key: tmpHomeKey, type: tmpType, name: tmpDoc.name, reason: tmpCost.problem, known: false });
					continue;
				}
				var tmpHome = makeOffer(tmpType, tmpDoc.name, OTHER_SUBTYPE, tmpDoc, 1,
					Array(PRICE_LEVELS.length).fill(tmpCost.price.text), true);
				tmpOffers.push(tmpHome);
				tmpByKey[tmpHomeKey] = tmpHome;
			}
		}
		return { offers: tmpOffers, byKey: tmpByKey, left: tmpLeft };
	}

	// This is the function which builds one offer -- see buildShopCatalog for its fields.
	function makeOffer(tmpType, tmpName, tmpSubtype, tmpDoc, tmpBundle, tmpPrices, tmpHomebrew) {
		var tmpDef = SHOP_TYPES[tmpType];
		var tmpSystem = tmpDoc?.system ?? {};
		// Ammunition, which stacks: his own projectile name chain (isProjectileWeapon, combat-rules.mjs --
		// arrows, bolts, bullets, pebbles, and his throwing stick and wooden javelin), or a Missile weapon
		// with no speed of its own, the test module/item-directory.mjs files ammunition by. Either alone
		// misses some: 34 of his fairy arrows and bolts carry a speed of 1, and his chain does not name
		// ballista shot.
		var tmpAmmunition = tmpDef.docType == "weapon"
			&& (isProjectileWeapon(tmpDoc.name) || (tmpSystem.type == "Missile" && !tmpSystem.speed));
		var tmpUnitWeight = parseFloat(tmpSystem.weight) || 0;
		return {
			key: tmpType + "|" + tmpName, type: tmpType, subtypes: [tmpSubtype],
			name: tmpName, label: tmpName,
			docName: tmpDoc.name, docType: tmpDef.docType, doc: tmpDoc,
			bundle: tmpBundle, prices: [...tmpPrices],
			unitWeight: tmpUnitWeight, weight: Math.round(tmpUnitWeight * tmpBundle * 100) / 100,
			isAmmunition: tmpAmmunition,
			stacks: tmpDef.docType == "equipment" || tmpAmmunition,
			homebrew: !!tmpHomebrew
		};
	}

	// @MARKER PRICE OF AN OFFER
	// This is the function which gives an offer's price at a price level: parsePrice of his column, or
	// nothing at Free. A document whose own system.cost is set is sold at that, at every level -- see
	// @MARKER HOMEBREW. A document's cost is the price of ONE, so a bundle of ten "Arrow Head" costs ten
	// of it; his bundle rows are already the price of the bundle. Returns the parsed price, with
	// fromDocument set when it came from the document, or null when there is none to pay.
	export function getOfferPrice(tmpOffer, tmpLevel) {
		if (!tmpOffer) { return null; }
		if (tmpLevel == FREE_LEVEL) {
			return { amount: 0, coin: "copper", copper: 0, text: FREE_LABEL, raw: FREE_LABEL, issue: "", free: true };
		}
		// A Cost that cannot be charged as written is never charged at all -- see readDocumentCost.
		var tmpOwnCost = readDocumentCost(tmpOffer.doc);
		if (tmpOwnCost.problem) { return null; }
		var tmpOwn = tmpOwnCost.price;
		if (tmpOwn) {
			var tmpBundle = parseInt(tmpOffer.bundle) || 1;
			var tmpAmount = tmpOwn.amount * tmpBundle;
			return { ...tmpOwn, amount: tmpAmount, copper: tmpAmount * COIN_VALUES[tmpOwn.coin],
				text: formatCoins(tmpAmount, tmpOwn.coin), fromDocument: true };
		}
		var tmpColumn = (PRICE_LEVELS.find(([tmpKey]) => tmpKey == tmpLevel) ?? PRICE_LEVELS.find(([tmpKey]) => tmpKey == DEFAULT_PRICE_LEVEL))[2];
		return parsePrice((tmpOffer.prices ?? [])[tmpColumn]);
	}

	// This is the function which gives a price level's label: his words, or Free.
	export function getPriceLevelLabel(tmpLevel) {
		if (tmpLevel == FREE_LEVEL) { return FREE_LABEL; }
		return (PRICE_LEVELS.find(([tmpKey]) => tmpKey == tmpLevel) ?? [])[1] ?? "Medium";
	}

	// This is the function which lists all seven of an offer's prices, as his setCostAndType shows them
	// (72846) -- the shop's tooltip.
	export function describeOfferPrices(tmpOffer) {
		if (!tmpOffer) { return ""; }
		var tmpOwn = readDocumentCost(tmpOffer.doc).price;
		if (tmpOwn) { return `Its own price, at every level: ${tmpOwn.text}${(tmpOffer.bundle ?? 1) > 1 ? " each" : ""}`; }
		return PRICE_LEVELS.map(([tmpKey, tmpLabel, tmpColumn]) =>
			`${tmpLabel} ${(tmpOffer.prices ?? [])[tmpColumn] ?? "--"}`).join(" · ");
	}

	// @MARKER BROWSING
	// This is the function which picks the offers the shop shows: one Type, one kind of it (or all), and
	// a search on the name. At most tmpLimit are returned -- the item picker's cap -- with the full count,
	// so the shop can say how many more a narrower search would show. His order within a kind; across a
	// whole Type, his order kind by kind.
	export function listShopOffers(tmpCatalog, tmpType, tmpSubtype, tmpSearch, tmpLimit) {
		var tmpWords = normalizeItemName(tmpSearch).toLowerCase().split(" ").filter(tmpWord => tmpWord);
		var tmpMatches = (tmpCatalog?.offers ?? []).filter(tmpOffer => tmpOffer.type == tmpType
			&& (!tmpSubtype || tmpOffer.subtypes.includes(tmpSubtype))
			&& tmpWords.every(tmpWord => normalizeItemName(tmpOffer.label).toLowerCase().includes(tmpWord)));
		var tmpCap = parseInt(tmpLimit) || 60;
		return { offers: tmpMatches.slice(0, tmpCap), total: tmpMatches.length };
	}

	// @MARKER GAPS
	// This is the function which says, for a Game Master, what the shop is not selling in THIS world that
	// it otherwise would -- the catalog's left, less what is left out on purpose everywhere (creature
	// hide, SHOP_LEFT_OUT): one of his items missing from the world's compendiums (not imported since a
	// build, or deleted), or an item whose own Cost cannot be charged as written (readDocumentCost). At
	// most tmpLimit are named. Returns "" when there is nothing to say.
	export function describeShopGaps(tmpCatalog, tmpLimit) {
		var tmpGaps = (tmpCatalog?.left ?? []).filter(tmpEntry => !tmpEntry.known);
		if (!tmpGaps.length) { return ""; }
		var tmpCap = parseInt(tmpLimit) || 5;
		var tmpNamed = tmpGaps.slice(0, tmpCap).map(tmpEntry => `${tmpEntry.name} (${tmpEntry.reason})`);
		var tmpMore = tmpGaps.length - tmpNamed.length;
		var tmpText = `The shop is not selling ${tmpGaps.length} item${tmpGaps.length == 1 ? "" : "s"} it otherwise would: `
			+ tmpNamed.join("; ") + (tmpMore > 0 ? `; and ${tmpMore} more` : "") + ".";
		if (tmpGaps.some(tmpEntry => tmpEntry.reason == "not in the compendium")) {
			tmpText += " Importing the Imagine content again (game.imagine.importContent()) restores what the system ships.";
		}
		return tmpText;
	}

	// @MARKER THE CART
	// This is the function which prices everything on the list against a purse, in the order it was
	// added -- one purchase at a time, as his panel buys, so the change each makes is decided before the
	// next is paid.
	//
	//   tmpPurse      the coins there are to spend
	//   tmpPurchases  [{ key, count, level }] -- level only counts for a Game Master (tmpOptions.isGM),
	//                 and "" means the world's level
	//   tmpCatalog    buildShopCatalog
	//   tmpLevel      the world's price level (the "priceLevel" setting)
	//   tmpOptions    { isGM }
	//
	// A line that cannot be paid -- the money was re-rolled, a Game Master changed the coins or the
	// price level, the item was switched off -- is marked, left unpaid, and the lines after it are still
	// tried. The generator will not go on while any line is marked (checkStep, chargen-view.mjs).
	//
	// Returns { lines, purse, spent, blocked, issues }: purse is what is left, spent is in copper.
	export function priceCart(tmpPurse, tmpPurchases, tmpCatalog, tmpLevel, tmpOptions) {
		var tmpWorld = PRICE_LEVELS.some(([tmpKey]) => tmpKey == tmpLevel) ? tmpLevel : DEFAULT_PRICE_LEVEL;
		var tmpIsGM = !!tmpOptions?.isGM;
		var tmpNow = readPurse(tmpPurse);
		var tmpLines = (tmpPurchases ?? []).map((tmpPurchase, tmpIndex) => {
			var tmpOffer = tmpCatalog?.byKey?.[tmpPurchase?.key] ?? null;
			var tmpCount = parseInt(tmpPurchase?.count) || 0;
			var tmpLineLevel = (tmpIsGM && tmpPurchase?.level) ? tmpPurchase.level : tmpWorld;
			var tmpLine = {
				index: tmpIndex, key: tmpPurchase?.key ?? "", label: tmpOffer?.label ?? (("" + (tmpPurchase?.key ?? "")).split("|")[1] ?? ""),
				count: tmpCount, units: tmpCount * (tmpOffer?.bundle ?? 1),
				level: tmpPurchase?.level ?? "", levelLabel: getPriceLevelLabel(tmpLineLevel),
				unitPrice: "", total: "", cost: 0, weight: 0, ok: false, how: "", reason: "", issue: ""
			};
			if (!tmpOffer) {
				tmpLine.reason = `${tmpLine.label || "This item"} is no longer offered.`;
				return tmpLine;
			}
			var tmpPrice = getOfferPrice(tmpOffer, tmpLineLevel);
			if (!tmpPrice) {
				tmpLine.reason = `${tmpOffer.label} has no price at ${tmpLine.levelLabel}.`;
				return tmpLine;
			}
			tmpLine.unitPrice = tmpPrice.text;
			tmpLine.total = tmpPrice.free ? FREE_LABEL : formatCoins(tmpCount * tmpPrice.amount, tmpPrice.coin);
			tmpLine.cost = tmpCount * tmpPrice.copper;
			tmpLine.issue = tmpPrice.issue ?? "";
			tmpLine.weight = Math.round(tmpOffer.unitWeight * tmpLine.units * 100) / 100;
			var tmpPaid = payPrice(tmpNow, tmpCount, tmpPrice);
			tmpLine.ok = tmpPaid.ok;
			tmpLine.how = tmpPaid.how;
			if (tmpPaid.ok) { tmpNow = tmpPaid.purse; }
			else if (tmpCount < 1) { tmpLine.reason = `Buy at least one ${tmpOffer.label}.`; }
			else { tmpLine.reason = `${tmpCount} ${tmpOffer.label} can no longer be afforded (${tmpLine.total}).`; }
			return tmpLine;
		});
		var tmpSpent = getPurseValue(tmpPurse) - getPurseValue(tmpNow);
		var tmpFailed = tmpLines.filter(tmpLine => !tmpLine.ok);
		return {
			lines: tmpLines, purse: tmpNow, spent: tmpSpent,
			weight: Math.round(tmpLines.filter(tmpLine => tmpLine.ok).reduce((tmpSum, tmpLine) => tmpSum + tmpLine.weight, 0) * 100) / 100,
			blocked: tmpFailed.length > 0, issues: tmpFailed.map(tmpLine => tmpLine.reason)
		};
	}

	// @MARKER BUY
	// This is the function which puts something on the list, if it can be paid for after everything
	// already on it -- his add_item pays each purchase from the purse the purchases before it left
	// (14285-14293), so the new copies are tried as a line of their own at the END of the list, whatever
	// is already on it. If they can be paid for there, they are then added to a paid line of the same
	// thing at the same level, if there is one, as his addEquipmentItems adds to the count of an item
	// already carried (76233).
	//
	// Adding to the earlier line first and pricing that would pay the new copies at the earlier line's
	// place, ahead of everything bought since: with 14 gp and a Dagger and then a Long Sword on the list,
	// five more Daggers would be taken, and the Long Sword the player already had would be the line that
	// could no longer be paid. His sheet says "couldn`t afford 5 Dagger" there. Tried at the end, it says
	// the same, whatever order the list is in. Moving them up to the earlier line afterwards never leaves
	// a line unpaid that was paid before: whether a line can be paid depends only on what the purse is
	// WORTH when its turn comes (payPrice changes coins up or down as needed), and every paid line from
	// the earlier one on still has what it needs, since what was left at the end covered the new copies.
	// A line of the same thing that is NOT paid (the purse was re-rolled since) is not added to: the new
	// copies would go unpaid with it, although they were just shown to be affordable. They take a line of
	// their own.
	//
	// Refused, it says so in his words -- "<name> couldn`t afford N X. Nothing done." (add_item, 14312) --
	// and the list is left as it was. Returns { ok, purchases, message }.
	export function addPurchase(tmpPurse, tmpPurchases, tmpCatalog, tmpLevel, tmpKey, tmpCount, tmpOptions, tmpWho) {
		var tmpList = (tmpPurchases ?? []).map(tmpPurchase => ({ ...tmpPurchase }));
		var tmpOffer = tmpCatalog?.byKey?.[tmpKey] ?? null;
		var tmpNumber = parseInt(tmpCount) || 1;
		var tmpName = tmpWho || "This character";
		if (!tmpOffer) { return { ok: false, purchases: tmpPurchases ?? [], message: "Nothing was selected to add. Nothing done." }; }
		if (tmpNumber < 1) { return { ok: false, purchases: tmpPurchases ?? [], message: "Can`t add less than one item. Nothing done." }; }
		var tmpLineLevel = tmpOptions?.isGM ? (tmpOptions?.level ?? "") : "";
		// Paid for after everything already on the list?
		var tmpTrial = tmpList.concat([{ key: tmpKey, count: tmpNumber, level: tmpLineLevel }]);
		var tmpPriced = priceCart(tmpPurse, tmpTrial, tmpCatalog, tmpLevel, tmpOptions);
		if (!tmpPriced.lines[tmpTrial.length - 1]?.ok) {
			return { ok: false, purchases: tmpPurchases ?? [],
				message: `${tmpName} couldn\`t afford ${tmpNumber} ${tmpOffer.label}. Nothing done.` };
		}
		// Yes: onto a paid line of the same thing at the same level, or a line of its own. (Every line
		// before the trial one is priced exactly as the list stands, so its ok is the list's own.)
		var tmpAt = tmpList.findIndex((tmpPurchase, tmpIndex) => tmpPurchase.key == tmpKey
			&& (tmpPurchase.level ?? "") == tmpLineLevel && tmpPriced.lines[tmpIndex]?.ok);
		if (tmpAt >= 0) { tmpList[tmpAt].count = (parseInt(tmpList[tmpAt].count) || 0) + tmpNumber; }
		else { tmpList.push({ key: tmpKey, count: tmpNumber, level: tmpLineLevel }); }
		return { ok: true, purchases: tmpList,
			message: `${tmpName} bought or added ${tmpNumber} ${tmpOffer.label}. It was added to Carried items.` };
	}

	// @MARKER WHAT IS BOUGHT
	// This is the function which turns a priced list into the items to create: one entry per document,
	// every paid line for it added together. Only lines that were paid for.
	//
	// Stacking. Equipment and ammunition become ONE item carrying the quantity -- twenty arrows or a
	// week of rations as twenty or seven separate items would flood the sheet -- which is his "N Name"
	// stacking (addEquipmentItems, 76233). Armour and every other weapon become one item per copy, as the
	// starting kit makes them, because in the port each weapon is held in a hand of its own and each
	// armour piece worn on a layer of its own, and two daggers for two hands must be two items. His sheet
	// stacks everything, but it has no per-item hand. The recommended default, taken 2026-09-23 while the
	// user was away.
	//
	// Returns [{ docName, docType, quantity, split, label }].
	export function buildPurchasedEntries(tmpPricedCart, tmpCatalog) {
		var tmpOut = [];
		for (const tmpLine of tmpPricedCart?.lines ?? []) {
			if (!tmpLine.ok || tmpLine.units < 1) { continue; }
			var tmpOffer = tmpCatalog?.byKey?.[tmpLine.key];
			if (!tmpOffer) { continue; }
			var tmpEntry = tmpOut.find(tmpOne => tmpOne.docName == tmpOffer.docName && tmpOne.docType == tmpOffer.docType);
			if (tmpEntry) { tmpEntry.quantity += tmpLine.units; continue; }
			tmpOut.push({ docName: tmpOffer.docName, docType: tmpOffer.docType, quantity: tmpLine.units,
				split: !tmpOffer.stacks, label: tmpOffer.label });
		}
		return tmpOut;
	}

	// @MARKER DESCRIBE THE CART
	// This is the function which says in one line what was bought, for the chat card the generator posts
	// when the character is made -- his add_item posts each purchase as it happens; the generator buys
	// them all at once, so they are posted together.
	export function describeCart(tmpPricedCart) {
		var tmpPaid = (tmpPricedCart?.lines ?? []).filter(tmpLine => tmpLine.ok);
		if (!tmpPaid.length) { return ""; }
		return tmpPaid.map(describeCartLine).join(", ")
			+ `. Spent ${describeValue(tmpPricedCart.spent) || "nothing"}; left ${describeCoins(tmpPricedCart.purse) || "nothing"}.`;
	}

	// This is the function which says what one line bought: "Long Sword (10 gp)", "10 Arrow Head ×2 (2 gp)"
	// -- the count after the name, as the starting kit's preview writes it, since a bundle's name already
	// starts with one.
	export function describeCartLine(tmpLine) {
		return `${tmpLine.label}${tmpLine.count > 1 ? " ×" + tmpLine.count : ""} (${tmpLine.total})`;
	}

// @MARKER ADD NEW shop functions HERE
// @END (CODE)
