// @START (CODE)
// @MARKER ITEM ICONS
//==================================================================================================================
// A default image per item type. Every one of the 7,004 shipped documents carried Foundry's own
// default image (the bag), so a skill, a sword, a race and a spell all looked alike in every list,
// in the shop and in the picker. One table here; ImagineItem.getDefaultArtwork (item-document.mjs)
// reads it for anything created in Foundry, and the content importer reads it for the packs, on
// import and again on a re-import for a document still wearing the bag.
//
// The images are Foundry's own SVG set (icons/svg/), which every install has; a homebrew item with
// its own image keeps it, because only a blank or default image is replaced.
//==================================================================================================================

// Foundry's default, the one these replace.
export const FOUNDRY_DEFAULT_ICON = "icons/svg/item-bag.svg";

// By type, then where a type has kinds, by kind. "" means the type's own default.
//   type             kind          image
export const ITEM_ICONS = {
	skill:          { "":            "icons/svg/book.svg" },
	race:           { "":            "icons/svg/mystery-man.svg" },
	class:          { "":            "icons/svg/tower-flag.svg" },
	weapon:         { "":            "icons/svg/sword.svg" },
	armor:          { "":            "icons/svg/shield.svg" },
	equipment:      { "":            "icons/svg/item-bag.svg" },
	creatureAttack: { "":            "icons/svg/combat.svg" },
	power:          { "":            "icons/svg/aura.svg" },
	trait:          { "":            "icons/svg/upgrade.svg",
	                  ability:       "icons/svg/upgrade.svg",
	                  disability:    "icons/svg/downgrade.svg",
	                  immunity:      "icons/svg/holy-shield.svg" },
	consumable:     { "":            "icons/svg/pill.svg",
	                  herb:          "icons/svg/oak.svg",
	                  potion:        "icons/svg/pill.svg",
	                  elixir:        "icons/svg/tankard.svg",
	                  charm:         "icons/svg/card-joker.svg",
	                  poison:        "icons/svg/poison.svg" },
	lore:           { "":            "icons/svg/card-hand.svg" },
	spell:          { "":            "icons/svg/lightning.svg" },
	invocation:     { "":            "icons/svg/angel.svg" }
};

	// This is the function which gives the image for an item of a type, and a kind or category
	// where the type has one (consumable.kind, trait.category). Unknown types get Foundry's own.
	export function getDefaultItemImage(tmptype, tmpsystem) {
		var tmprow = Object.hasOwn(ITEM_ICONS, String(tmptype ?? "")) ? ITEM_ICONS[tmptype] : null;
		if (!tmprow) { return FOUNDRY_DEFAULT_ICON; }
		var tmpkind = String(tmpsystem?.kind ?? tmpsystem?.category ?? "");
		return (tmpkind && Object.hasOwn(tmprow, tmpkind)) ? tmprow[tmpkind] : tmprow[""];
	}

	// This is the function which says whether an image is one worth replacing: blank, or the bag.
	export function isDefaultItemImage(tmpimage) {
		var tmpimg = String(tmpimage ?? "");
		return !tmpimg || tmpimg == FOUNDRY_DEFAULT_ICON;
	}

// @MARKER ADD NEW item icon functions HERE
// @END (CODE)
