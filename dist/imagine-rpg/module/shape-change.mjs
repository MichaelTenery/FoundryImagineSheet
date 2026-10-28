// @START (CODE)
// @MARKER SHAPE CHANGE WRITING
//==================================================================================================================
// The Foundry half of the shape-change window: reading a race from the compendium, swapping a Formless's host
// race item, and writing what module/shape-change-rules.mjs decided. Every rule is there; nothing here decides.
//
// THE HOST IS A RACE ITEM. Possessing a new body deletes the old host's race item and embeds the new one, the
// same item a dropped race or the character generator embeds; the createItem hook in natural-weapons.mjs gives
// the new body its claws and bites as it does for any race added. The OLD body's natural weapons are taken
// away with it -- the one place anything takes a natural weapon away (natural-weapons.mjs never does), because
// a psyche that leaves a Saurian does not keep its claws. Only weapons of type Natural named on the old host's
// race are removed, so a claw the player renamed or a real weapon is never touched.
//==================================================================================================================

import { resolveChangelingSwitch, resolveFormlessPossession, resolveFormlessRetention, resolveFreePsyche,
         getShapeSpecialMovement, CHANGELING_NATURAL, FORMLESS_HOST_ATTRIBUTES } from "./shape-change-rules.mjs";
import { getPackDocumentsByName } from "./pack-lookup.mjs";

const RACE_PACK = "world.imagine-races";

	// This is the function which posts one of his result lines to chat, with the die that made it.
	async function postShapeChange(tmpactor, tmptitle, tmpmessage, tmproll = null) {
		var tmpescape = foundry.utils.escapeHTML;
		var tmprollLine = (tmproll === null) ? "" : `<p class="muted">Rolled ${tmproll}</p>`;
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: tmpactor }),
			content: `<div class="imagine-card"><h3>${tmpescape(tmptitle)}</h3>${tmprollLine}<p>${tmpescape(tmpmessage)}</p></div>`
		});
	}

	// This is the function which fetches one race from the compendium, as a plain object, or null.
	export async function getRaceDocument(tmpname) {
		if (!tmpname) { return null; }
		var tmpdocs = await getPackDocumentsByName(RACE_PACK, [ tmpname ]);
		return tmpdocs[0] ?? null;
	}

	// This is the function which builds the update for the body features the window was given. A blank box leaves
	// the feature as it is, as his updateRaceAndFeatures does (127823-127845).
	function buildFeatureUpdate(tmpinputs) {
		var tmpi = tmpinputs ?? {};
		var tmpupdate = {};
		var tmpset = (tmppath, tmpvalue) => { if (tmpvalue !== undefined && tmpvalue !== null && ("" + tmpvalue).trim() !== "") { tmpupdate[tmppath] = tmpvalue; } };
		var tmpcap = (tmptext) => ("" + (tmptext ?? "")).trim().replace(/^./, (tmpc) => tmpc.toUpperCase());
		tmpset("system.identity.gender", tmpcap(tmpi.gender));
		if ((parseInt(tmpi.heightFeet) || 0) || (parseInt(tmpi.heightInches) || 0)) {
			tmpupdate["system.physical.heightFeet"] = parseInt(tmpi.heightFeet) || 0;
			tmpupdate["system.physical.heightInches"] = parseInt(tmpi.heightInches) || 0;
		}
		if ((parseFloat(tmpi.weight) || 0) > 0) { tmpupdate["system.physical.weight"] = parseFloat(tmpi.weight); }
		tmpset("system.physical.frame", tmpi.frame);
		tmpset("system.physical.hair", tmpi.hair);
		tmpset("system.physical.bodyCovering", tmpi.bodyCovering);
		tmpset("system.physical.eyes", tmpi.eyes);
		tmpset("system.physical.skin", tmpi.skin);
		return tmpupdate;
	}

	// This is the function which takes away a body: its race item, and the natural weapons its race lists.
	async function removeHostBody(tmpactor) {
		var tmphosts = tmpactor.items.filter(tmpitem => tmpitem.type == "race" && !tmpitem.system.formless);
		var tmpnatural = new Set(tmphosts.flatMap(tmprace => (tmprace.system.naturalWeapons ?? []).map(tmpentry => tmpentry.name)));
		var tmpweapons = tmpactor.items.filter(tmpitem => tmpitem.type == "weapon" && tmpitem.system.type == "Natural" && tmpnatural.has(tmpitem.name));
		var tmpids = tmphosts.concat(tmpweapons).map(tmpitem => tmpitem.id);
		if (tmpids.length) { await tmpactor.deleteEmbeddedDocuments("Item", tmpids); }
		return tmphosts.map(tmprace => tmprace.name);
	}

	// @MARKER CHANGELING SWITCH
	export async function applyChangelingSwitch(tmpactor, tmpinputs) {
		var tmpsys = tmpactor.system;
		var tmpstate = {
			name: tmpactor.name,
			raceName: tmpsys.identity.raceName,
			isChangeling: !!tmpsys.identity.isChangeling,
			form: tmpsys.identity.changeling?.form || CHANGELING_NATURAL,
			originalForm: tmpsys.identity.changeling?.originalForm || CHANGELING_NATURAL,
			slight: !!tmpsys.identity.changeling?.slight,
			origHeightInches: tmpsys.identity.changeling?.origHeightInches ?? 0,
			currentHeightInches: (parseInt(tmpsys.physical.heightFeet) || 0) * 12 + (parseInt(tmpsys.physical.heightInches) || 0)
		};
		var tmpresult = resolveChangelingSwitch(tmpstate, tmpinputs);
		if (!tmpresult.ok) {
			await postShapeChange(tmpactor, "Update Changeling Race", tmpresult.message);
			return tmpresult;
		}
		var tmpupdate = buildFeatureUpdate(tmpinputs);
		tmpupdate["system.identity.changeling.form"] = tmpresult.form == CHANGELING_NATURAL ? "" : tmpresult.form;
		tmpupdate["system.identity.changeling.slight"] = !!tmpinputs.slight;
		if (!(tmpsys.identity.changeling?.origHeightInches)) { tmpupdate["system.identity.changeling.origHeightInches"] = tmpresult.origHeightInches; }
		// Slight Physique moves the ratings themselves, as it did at creation (applyPhysique, chargen-rules.mjs).
		if (tmpresult.slightShift) {
			tmpupdate["system.attributes.agl.rating"] = Math.max(0, tmpsys.attributes.agl.rating + tmpresult.slightShift);
			tmpupdate["system.attributes.str.rating"] = Math.max(0, tmpsys.attributes.str.rating - tmpresult.slightShift);
		}
		// The body chart is the form's (his buildCharacterBody(form), 127867); the natural form is the race's own.
		if (tmpresult.form == CHANGELING_NATURAL) {
			tmpupdate["system.body.bodyType"] = "";
		} else {
			var tmpformDoc = await getRaceDocument(tmpresult.form);
			if (tmpformDoc?.system?.bodyType) { tmpupdate["system.body.bodyType"] = tmpformDoc.system.bodyType; }
		}
		// Real wings fly; the rest of his switch's special movements likewise (127872).
		tmpupdate["system.tempMods.specialType"] = getShapeSpecialMovement(tmpresult.form);
		await tmpactor.update(tmpupdate);
		await postShapeChange(tmpactor, "Update Changeling Race", tmpresult.message);
		return tmpresult;
	}

	// @MARKER FORMLESS POSSESSION
	export async function possessFormlessHost(tmpactor, tmpinputs, tmproll) {
		var tmpsys = tmpactor.system;
		var tmphostDoc = await getRaceDocument(tmpinputs?.host);
		var tmphost = tmphostDoc ? { name: tmphostDoc.name, attributeLimits: tmphostDoc.system.attributeLimits,
			attributeMods: tmphostDoc.system.attributeMods, features: tmphostDoc.system.features } : null;
		var tmpresult = resolveFormlessPossession(tmproll, {
			name: tmpactor.name, raceName: tmpsys.identity.raceName, isFormless: !!tmpsys.identity.isFormless,
			control: tmpsys.identity.formlessControl, wil: tmpsys.attributes.wil.value
		}, tmpinputs, tmphost);
		if (!tmpresult.ok || !tmpresult.success) {
			await postShapeChange(tmpactor, "Update Formless Host", tmpresult.message, tmpresult.ok ? tmproll : null);
			return tmpresult;
		}
		await removeHostBody(tmpactor);
		var tmpnewItem = foundry.utils.deepClone(tmphostDoc);
		delete tmpnewItem._id;
		await tmpactor.createEmbeddedDocuments("Item", [ tmpnewItem ]);

		var tmpupdate = buildFeatureUpdate(tmpinputs);
		for (const tmpkey of FORMLESS_HOST_ATTRIBUTES) { tmpupdate[`system.attributes.${tmpkey}.rating`] = tmpresult.ratings[tmpkey]; }
		for (const [tmpkey, tmpvalue] of Object.entries(tmpresult.state)) { tmpupdate[`system.identity.formless.${tmpkey}`] = tmpvalue; }
		var tmphistory = ("" + (tmpsys.identity.formless?.hostHistory ?? "")).trim();
		tmpupdate["system.identity.formless.hostHistory"] = tmphistory ? `${tmphistory}, ${tmphostDoc.name}` : tmphostDoc.name;
		await tmpactor.update(tmpupdate);
		await postShapeChange(tmpactor, "Update Formless Host", tmpresult.message, tmproll);
		return tmpresult;
	}

	// @MARKER FORMLESS HOSTLESS
	// His setFormlessHostless (128300): the body is gone, its five attributes are 0, and the psyche has as many
	// hours as its Will Force to find another.
	async function setFormlessHostless(tmpactor) {
		var tmpsys = tmpactor.system;
		await removeHostBody(tmpactor);
		var tmpupdate = {};
		for (const tmpkey of FORMLESS_HOST_ATTRIBUTES) { tmpupdate[`system.attributes.${tmpkey}.rating`] = 0; }
		tmpupdate["system.identity.formless.freePsycheWill"] = parseInt(tmpsys.identity.formless?.maxPeriods) || 0;
		tmpupdate["system.identity.formless.currentHost"] = "";
		tmpupdate["system.identity.formless.hostType"] = "";
		tmpupdate["system.identity.formless.periodType"] = "";
		tmpupdate["system.identity.formless.periodsOccupied"] = 0;
		await tmpactor.update(tmpupdate);
	}

	// This is the function which tells whether a Formless is wearing a body now.
	export function hasFormlessHost(tmpactor) {
		return tmpactor.items.some(tmpitem => tmpitem.type == "race" && !tmpitem.system.formless);
	}

	// @MARKER FORMLESS RETENTION
	export async function retainFormlessHost(tmpactor, tmproll) {
		var tmpsys = tmpactor.system;
		var tmpformless = tmpsys.identity.formless ?? {};
		var tmphost = tmpactor.items.find(tmpitem => tmpitem.type == "race" && !tmpitem.system.formless);
		var tmpresult = resolveFormlessRetention(tmproll, {
			name: tmpactor.name, raceName: tmpsys.identity.raceName, isFormless: !!tmpsys.identity.isFormless,
			hasHost: !!tmphost, host: tmpformless.currentHost || tmphost?.name || "",
			periodsOccupied: tmpformless.periodsOccupied, maxPeriods: tmpformless.maxPeriods,
			control: tmpsys.identity.formlessControl
		});
		if (tmpresult.ok && tmpresult.ejected) { await setFormlessHostless(tmpactor); }
		if (tmpresult.ok && tmpresult.retained) { await tmpactor.update({ "system.identity.formless.periodsOccupied": tmpresult.periodsOccupied }); }
		await postShapeChange(tmpactor, "Retain Formless Host", tmpresult.message, tmpresult.ok ? tmpresult.total : null);
		return tmpresult;
	}

	// @MARKER FREE PSYCHE
	export async function checkFreePsyche(tmpactor, tmproll, tmpsaveroll) {
		var tmpsys = tmpactor.system;
		var tmpresult = resolveFreePsyche(tmproll, tmpsaveroll, {
			name: tmpactor.name, raceName: tmpsys.identity.raceName, isFormless: !!tmpsys.identity.isFormless,
			hasHost: hasFormlessHost(tmpactor), will: tmpsys.identity.formless?.freePsycheWill,
			control: tmpsys.identity.formlessControl, wilSave: tmpsys.attributes.wil.save
		});
		if (tmpresult.ok) { await tmpactor.update({ "system.identity.formless.freePsycheWill": tmpresult.will }); }
		await postShapeChange(tmpactor, "Formless Free Psyche Resist", tmpresult.message, tmpresult.ok ? tmproll : null);
		return tmpresult;
	}
// @END (CODE)
