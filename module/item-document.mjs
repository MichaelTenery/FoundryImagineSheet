// @START (CODE)
// @MARKER ITEM DOCUMENT
//==================================================================================================================
// The system's Item class: Foundry's own, with the default image taken from the item's type
// (module/item-icons.mjs) rather than the one bag for everything. Registered as
// CONFIG.Item.documentClass in imagine-rpg.mjs.
//==================================================================================================================

import { getDefaultItemImage } from "./item-icons.mjs";

export default class ImagineItem extends Item {
	// This is the function Foundry asks for the image of a new item that was given none.
	static getDefaultArtwork(tmpitemdata) {
		return { img: getDefaultItemImage(tmpitemdata?.type, tmpitemdata?.system) };
	}
}

// @MARKER ADD NEW item document functions HERE
// @END (CODE)
