// @START (CODE)
// @MARKER BODY FIGURE VIEW
//==================================================================================================================
// The body figure on the Combat tab: the character's (or creature's) body drawn as a thing to click,
// each area tinted by its state, with a panel beside it that says everything the sheet knows about
// the area clicked -- its Endurance and wounds, the armour and shield over it, what that armour is
// made of, and what is running on the being.
//
// Asked for by the user, 2026-10-07: "look at my bodyform and click on each body part to see its
// status (health, various protections, and any buffs/debuffs)". Nothing here is a new number. Every
// figure comes from body.areas, which _prepareBody (actor-character.mjs) and _prepareBody
// (actor-creature.mjs) already derive; this module only decides WHERE each area is drawn and WHAT
// the panel says. The body table beneath it stays, for the Game Master who wants every area at once.
//
// TWO PICTURES, ONE CODE PATH. His 45 body charts (BODY_CHARTS, module/combat-tables.mjs) run from a
// Tiny's one area to a Segmented Worm's fifty-one, and no single drawing fits them all. So:
//   figure   a drawn silhouette, for the Humanoid family (Humanoid, Humanoid(Wings), Saurian and the
//            rest that share the nineteen human areas plus a tail, wings, hooves or a fish tail).
//            Each area is a shape at fixed coordinates in HUMANOID_FIGURE below.
//   map      three columns -- the being's left side, its centre line, its right side -- with one
//            tile per area in chart order, for every other body. A Centaur's left foreleg sits in
//            the left column under its left hand; a Snake is one column. The columns are read off
//            the area NAMES, which his charts write as "Left Foreleg" / "Right Foreleg", so a custom
//            body a Game Master builds area by area lays itself out the same way.
// Both carry the same per-area record and the same clicked-area panel, so the sheet, the template
// and the stylesheet do not care which one they got.
//
// THE FIGURE FACES THE VIEWER. Its left arm is on the viewer's right, as on any anatomical chart,
// and the template says so under the picture. The map keeps the same convention so the two agree.
//
// This is also the attack-chart "dartboard"'s body half (PROGRESS, Epic 3): the aim point is
// picked ON the target's own body (the attack dialog shows this same figure as its picker), and
// @MARKER AIM AND ADJACENCY below turns a chart zone -- Hit(High), Hit(Left) -- into the area that
// sits that way from the aim, read off the drawing's geometry for a figure and off the columns
// for a map. Built 2026-10-07 on the user's 2026-09-16 reading: a zone is relative to wherever the
// attack was aimed, not a fixed per-body table.
//
// Pure: no Foundry. Everything is a function of body.areas and a few options, so
// tools/body-test.html runs it headless.
//==================================================================================================================

// @MARKER AREA STATES
// The four states _prepareBody gives an area, with the words the sheet uses for them. The table in
// tab-combat.hbs still writes its own words (it predates this module); these are for the figure.
//                         state           label                 severity (for "most hurt")
export const AREA_STATES = {
	sound:        { label: "Sound",             severity: 0 },
	wounded:      { label: "Wounded",           severity: 1 },
	vitalitySave: { label: "Vitality save",     severity: 2 },
	effect:       { label: "Effect triggered",  severity: 3 }
};

// @MARKER HUMANOID FIGURE
// Where each area of the Humanoid family is drawn, in a 200 x 440 box. Every entry is a rounded
// rectangle: x, y, width, height and the corner radius. The nineteen areas of "Humanoid" are the
// skeleton; the extras below them appear only when the chart has them -- wings outside the arms,
// a tail below the feet, hooves in place of feet, and a finned tail where the legs would be.
//
// Left and Right are the BEING'S, so Left is drawn on the viewer's right (the figure faces you).
//                                   x     y     w     h    rx
export const HUMANOID_FIGURE = {
	"Head":            { x:  78, y:   6, w:  44, h:  48, rx: 20 },
	"Neck":            { x:  88, y:  56, w:  24, h:  16, rx:  5 },
	"Right Shoulder":  { x:  52, y:  72, w:  30, h:  22, rx:  8 },
	"Left Shoulder":   { x: 118, y:  72, w:  30, h:  22, rx:  8 },
	"Upper Torso":     { x:  72, y:  72, w:  56, h:  58, rx:  6 },
	"Right Arm":       { x:  28, y:  96, w:  22, h:  52, rx:  8 },
	"Left Arm":        { x: 150, y:  96, w:  22, h:  52, rx:  8 },
	"Right Forearm":   { x:  28, y: 150, w:  20, h:  50, rx:  7 },
	"Left Forearm":    { x: 152, y: 150, w:  20, h:  50, rx:  7 },
	"Mid Torso":       { x:  74, y: 132, w:  52, h:  36, rx:  4 },
	"Right Hand":      { x:  28, y: 202, w:  20, h:  26, rx:  7 },
	"Left Hand":       { x: 152, y: 202, w:  20, h:  26, rx:  7 },
	"Lower Torso":     { x:  70, y: 170, w:  60, h:  48, rx:  6 },
	"Right Thigh":     { x:  70, y: 220, w:  28, h:  72, rx:  8 },
	"Left Thigh":      { x: 102, y: 220, w:  28, h:  72, rx:  8 },
	"Right Shin":      { x:  72, y: 294, w:  24, h:  70, rx:  7 },
	"Left Shin":       { x: 104, y: 294, w:  24, h:  70, rx:  7 },
	"Right Foot":      { x:  70, y: 366, w:  26, h:  22, rx:  6 },
	"Left Foot":       { x: 104, y: 366, w:  26, h:  22, rx:  6 },
	// The extras. Hooves stand where feet do; a fish tail takes the whole of the legs' room.
	"Right Hoof":      { x:  70, y: 366, w:  26, h:  22, rx:  6 },
	"Left Hoof":       { x: 104, y: 366, w:  26, h:  22, rx:  6 },
	"Right Wing":      { x:   2, y:  50, w:  22, h: 150, rx: 10 },
	"Left Wing":       { x: 176, y:  50, w:  22, h: 150, rx: 10 },
	"Tail":            { x:  88, y: 392, w:  24, h:  40, rx:  9 },
	"Finned Tail":     { x:  74, y: 220, w:  52, h: 170, rx: 22 }
};

// The drawing's own box, for the template's viewBox.
export const HUMANOID_FIGURE_BOX = { width: 200, height: 440 };

// When the figure is used rather than the map: at least twelve of the chart's areas must be in
// HUMANOID_FIGURE, AND they must be two thirds of the chart. Both, because each alone is wrong
// somewhere: a Centaur has exactly twelve human areas (its arms and head) above a horse the drawing
// cannot show, and a Snake(Arms) is ten human areas out of twelve with its lengths and tail
// unplaceable. A Game Master's custom body built from a Humanoid, with a few areas of its own,
// still gets the picture, with the extras as tiles under it.
const FIGURE_MINIMUM_KNOWN = 12;
const FIGURE_MINIMUM_SHARE = 2 / 3;

// @MARKER LAYING OUT
	// This is the function which says which column of the map an area belongs in, from its name --
	// "left", "centre" or "right". His charts name a sided area "Left Foreleg" / "Right Hindfoot";
	// anything else is on the centre line.
	export function getAreaSide(tmpname) {
		var tmpn = String(tmpname ?? "").trim();
		if (/^Left\b/i.test(tmpn))  { return "left"; }
		if (/^Right\b/i.test(tmpn)) { return "right"; }
		return "centre";
	}

	// This is the function which gives one area's record for either picture: the derived figures
	// _prepareBody worked out, the state's word, and the tooltip the pointer shows before a click.
	//     tmparea     one entry of body.areas
	//     tmpselected the name of the area clicked, if any
	function describeShape(tmparea, tmpselected) {
		var tmpstate = AREA_STATES[tmparea.state] ? tmparea.state : "sound";
		var tmpname = String(tmparea.name ?? "");
		var tmparmor = tmparea.protectedByArmor ? `armour ${parseInt(tmparea.armor) || 0}` : "no armour";
		return {
			name: tmpname,
			type: tmparea.type ?? "Limb",
			state: tmpstate,
			stateLabel: AREA_STATES[tmpstate].label,
			endurance: parseInt(tmparea.endurance) || 0,
			wounds: parseInt(tmparea.wounds) || 0,
			selected: !!tmpselected && tmpselected == tmpname,
			justHit: false,
			tooltip: `${tmpname} · ${tmparea.type ?? "Limb"} · ${parseInt(tmparea.wounds) || 0} / ${parseInt(tmparea.endurance) || 0} · ${tmparmor} · ${AREA_STATES[tmpstate].label}`
		};
	}

	// This is the function which lays the body out, and returns what the body-figure partial draws:
	//     {
	//       kind:      "figure" | "map",
	//       bodyType:  the chart's name, for the caption,
	//       box:       { width, height }                        figure only: the SVG viewBox
	//       shapes:    [ { name, x, y, w, h, rx, state, ... } ]  figure only: one per drawn area
	//       unplaced:  [ { name, state, ... } ]                  figure only: areas the drawing has no
	//                                                           place for (a custom body's extra arm),
	//                                                           listed as tiles under it so none is lost
	//       columns:   { left: [...], centre: [...], right: [...] }   map only, tiles in chart order
	//       selected:  the clicked area's panel (describeArea), or null
	//       worst:     the most-hurt area's name, or "" when all are sound
	//       count:     how many areas there are
	//     }
	//     tmpareas    body.areas as either actor derives it
	//     tmpoptions  { bodyType, selected, effects, lastHit, now, picker }
	//                 effects  the actor-wide list of what is running on the being
	//                          (buildMagicPanel's `effects`), shown in the panel
	//                 lastHit  { area, at } -- the blow most recently applied (the actor's
	//                          flags.imagine-rpg.lastHit); that area flashes (justHit) for
	//                          JUST_HIT_SECONDS after `at`, so a wound just taken is seen landing
	//                 now      the clock to read `at` against (Date.now() unless a test says)
	//                 picker   true when the figure is an aim picker in the attack dialog: the
	//                          panel is left out and the shapes carry no sheet action
	export function buildBodyFigure(tmpareas, tmpoptions) {
		var tmpopts = tmpoptions ?? {};
		var tmplist = Array.isArray(tmpareas) ? tmpareas : [];
		var tmpselectedname = String(tmpopts.selected ?? "");
		var tmpselectedarea = tmplist.find(tmpa => tmpa.name == tmpselectedname) ?? null;
		var tmpjusthit = getJustHitName(tmpopts.lastHit, tmpopts.now);

		// The most-hurt area, so the heading can point at it before anything is clicked.
		var tmpworst = "";
		var tmpworstseverity = 0;
		var tmpworstwounds = 0;
		for (const tmparea of tmplist) {
			var tmpsev = AREA_STATES[tmparea.state]?.severity ?? 0;
			var tmphurt = parseInt(tmparea.wounds) || 0;
			if (tmpsev == 0) { continue; }
			// A worse state wins; within one state the greater wound count does, so two Wounded
			// areas are told apart. The first of an exact tie keeps its place.
			if (tmpsev > tmpworstseverity || (tmpsev == tmpworstseverity && tmphurt > tmpworstwounds)) {
				tmpworst = tmparea.name;
				tmpworstseverity = tmpsev;
				tmpworstwounds = tmphurt;
			}
		}

		var tmpresult = {
			kind: "map",
			bodyType: String(tmpopts.bodyType ?? ""),
			count: tmplist.length,
			worst: tmpworst,
			picker: !!tmpopts.picker,
			selected: (tmpselectedarea && !tmpopts.picker) ? describeArea(tmpselectedarea, tmpopts) : null
		};

		// The figure, when enough of the chart is the human one.
		var tmpknown = tmplist.filter(tmpa => HUMANOID_FIGURE[tmpa.name]).length;
		if (tmpknown >= FIGURE_MINIMUM_KNOWN && tmpknown >= tmplist.length * FIGURE_MINIMUM_SHARE) {
			tmpresult.kind = "figure";
			tmpresult.box = { ...HUMANOID_FIGURE_BOX };
			tmpresult.shapes = [];
			tmpresult.unplaced = [];
			for (const tmparea of tmplist) {
				var tmpplace = HUMANOID_FIGURE[tmparea.name];
				var tmpshape = describeShape(tmparea, tmpselectedname);
				tmpshape.justHit = tmpshape.name == tmpjusthit;
				if (tmpplace) { tmpresult.shapes.push({ ...tmpshape, ...tmpplace }); }
				else { tmpresult.unplaced.push(tmpshape); }
			}
			return tmpresult;
		}

		// The map, for every other body.
		tmpresult.columns = { left: [], centre: [], right: [] };
		for (const tmparea of tmplist) {
			var tmptile = describeShape(tmparea, tmpselectedname);
			tmptile.justHit = tmptile.name == tmpjusthit;
			tmpresult.columns[getAreaSide(tmparea.name)].push(tmptile);
		}
		return tmpresult;
	}

	// How long a struck area keeps its flash on the figure.
	export const JUST_HIT_SECONDS = 12;

	// This is the function which says which area, if any, was struck recently enough to flash.
	function getJustHitName(tmplasthit, tmpnow) {
		if (!tmplasthit?.area) { return ""; }
		var tmpat = parseInt(tmplasthit.at) || 0;
		var tmpclock = (tmpnow === undefined) ? Date.now() : (parseInt(tmpnow) || 0);
		return (tmpclock - tmpat) <= JUST_HIT_SECONDS * 1000 ? String(tmplasthit.area) : "";
	}

// @MARKER AIM AND ADJACENCY
// The dartboard's second half. An attack is aimed at one area of the target (the attack dialog's
// "Aimed at", picked on this figure); the chart then says Hit(Center), Hit(High), Hit(Low),
// Hit(Left) or Hit(Right). Centre is the aim itself. The other four are whatever sits that way
// from the aim ON THIS BODY -- so aiming at the neck and rolling High lands on the head, aiming at
// the chest and rolling High lands on the neck (the user's walkthrough, 2026-09-16).
//
// HOW "THAT WAY" IS READ. For a figure, off the drawing: the nearest shape above (High) or below
// (Low) that overlaps the aim horizontally, the nearest shape to the being's left (the viewer's
// right, larger x) or right that overlaps it vertically. For a map, off the columns: High and Low
// are the previous and next tile in the aim's own column (his charts run head to tail); Left and
// Right step one column over -- centre to a side, a side to the centre -- to the tile at the same
// relative height. Off the edge of the body (High of the head, Left of the left hand) there is
// nothing, and the table decides, as it did before this existed.
//
// This is a READING of his directional zones, not a rule he wrote down; the damage dialog shows
// the answer as a default and says where it came from, and the player may still pick otherwise.
	// The chart zones that carry a direction, and the direction each carries.
	export const ZONE_DIRECTIONS = {
		"Hit(Center)": "centre",
		"Hit(High)":   "high",
		"Hit(Low)":    "low",
		"Hit(Left)":   "left",
		"Hit(Right)":  "right"
	};

	// This is the function which names the area a hit lands on:
	//     { area, how, text }
	//       area  the struck area's name, or "" when nothing lies that way
	//       how   "aim"      a centre hit, or a zone with no direction: the aim itself
	//             "adjacent" the area that sits that way from the aim on this body
	//             "none"     nothing lies that way; the table decides
	//             "noAim"    no aim was declared, so nothing can be read
	//       text  one line for the damage dialog saying what was read
	//     tmpareas   body.areas of the target
	//     tmpaim     the area the attack was aimed at, by name
	//     tmpzone    the chart result's zone, "Hit(High)" and the like
	export function getStruckArea(tmpareas, tmpaim, tmpzone) {
		var tmplist = Array.isArray(tmpareas) ? tmpareas : [];
		var tmpaimname = String(tmpaim ?? "");
		var tmpdirection = ZONE_DIRECTIONS[String(tmpzone ?? "")] ?? "centre";
		if (!tmpaimname || !tmplist.some(tmpa => tmpa.name == tmpaimname)) {
			return { area: "", how: "noAim", text: "No aim was declared, so where it lands is the table's call." };
		}
		if (tmpdirection == "centre") {
			return { area: tmpaimname, how: "aim", text: `It lands where it was aimed: the ${tmpaimname}.` };
		}
		var tmpfound = (buildBodyFigure(tmplist, {}).kind == "figure")
			? getAdjacentOnFigure(tmplist, tmpaimname, tmpdirection)
			: getAdjacentOnMap(tmplist, tmpaimname, tmpdirection);
		if (!tmpfound) {
			return { area: "", how: "none",
				text: `${describeDirection(tmpdirection)} of the ${tmpaimname} there is nothing on this body: the table decides where it lands.` };
		}
		return { area: tmpfound, how: "adjacent",
			text: `${describeDirection(tmpdirection)} of the ${tmpaimname}, where it was aimed, lies the ${tmpfound}.` };
	}

	function describeDirection(tmpdirection) {
		return { high: "High", low: "Low", left: "To the being's left", right: "To the being's right" }[tmpdirection] ?? tmpdirection;
	}

	// This is the function which reads adjacency off the drawing. Shapes are compared by their
	// boxes; "overlaps" is the loose test (any shared width or height) so a shoulder counts as
	// above an arm even where they do not line up exactly.
	function getAdjacentOnFigure(tmpareas, tmpaimname, tmpdirection) {
		var tmpaim = HUMANOID_FIGURE[tmpaimname];
		if (!tmpaim) { return null; }
		var tmpbest = null;
		var tmpbestgap = Infinity;
		for (const tmparea of tmpareas) {
			if (tmparea.name == tmpaimname) { continue; }
			var tmpbox = HUMANOID_FIGURE[tmparea.name];
			if (!tmpbox) { continue; }
			var tmpgap;
			if (tmpdirection == "high" || tmpdirection == "low") {
				var tmpacross = (tmpbox.x < tmpaim.x + tmpaim.w) && (tmpbox.x + tmpbox.w > tmpaim.x);
				if (!tmpacross) { continue; }
				tmpgap = (tmpdirection == "high") ? tmpaim.y - (tmpbox.y + tmpbox.h) : tmpbox.y - (tmpaim.y + tmpaim.h);
			} else {
				var tmpalong = (tmpbox.y < tmpaim.y + tmpaim.h) && (tmpbox.y + tmpbox.h > tmpaim.y);
				if (!tmpalong) { continue; }
				// The being's left is the viewer's right: larger x.
				tmpgap = (tmpdirection == "left") ? tmpbox.x - (tmpaim.x + tmpaim.w) : tmpaim.x - (tmpbox.x + tmpbox.w);
			}
			// A shape has to lie that way (a small overlap is allowed, the drawing's shapes touch),
			// and the nearest one wins.
			if (tmpgap < -12) { continue; }
			if (tmpgap < tmpbestgap) { tmpbestgap = tmpgap; tmpbest = tmparea.name; }
		}
		return tmpbest;
	}

	// This is the function which reads adjacency off the map's columns.
	function getAdjacentOnMap(tmpareas, tmpaimname, tmpdirection) {
		var tmpcolumns = { left: [], centre: [], right: [] };
		for (const tmparea of tmpareas) { tmpcolumns[getAreaSide(tmparea.name)].push(tmparea.name); }
		var tmpside = getAreaSide(tmpaimname);
		var tmpcolumn = tmpcolumns[tmpside];
		var tmpindex = tmpcolumn.indexOf(tmpaimname);
		if (tmpindex < 0) { return null; }
		if (tmpdirection == "high") { return tmpindex > 0 ? tmpcolumn[tmpindex - 1] : null; }
		if (tmpdirection == "low")  { return tmpindex < tmpcolumn.length - 1 ? tmpcolumn[tmpindex + 1] : null; }
		// One column over, towards that side; off the edge is nothing.
		var tmptoward = (tmpdirection == "left")
			? { right: "centre", centre: "left", left: null }[tmpside]
			: { left: "centre", centre: "right", right: null }[tmpside];
		if (!tmptoward || !tmpcolumns[tmptoward].length) { return null; }
		var tmpother = tmpcolumns[tmptoward];
		var tmpat = tmpcolumn.length > 1 ? Math.round(tmpindex * (tmpother.length - 1) / (tmpcolumn.length - 1)) : 0;
		return tmpother[Math.max(0, Math.min(tmpother.length - 1, tmpat))];
	}

// @MARKER MINI FIGURE
// The body on a chat card, small, with the struck area marked -- so the damage card shows where
// the blow landed without opening the sheet. Drawn as positioned <div>s rather than an <svg>,
// because a chat message's HTML is cleaned on its way to the other clients and inline boxes
// survive that where an SVG may not. Figures only; a map body gets words instead ("").
	export const MINI_SCALE = 0.3;

	// This is the function which gives the mini figure's HTML, or "" when the body is not drawn.
	//     tmpareas   body.areas of the being
	//     tmpstruck  the area to mark, by name
	export function renderBodyMini(tmpareas, tmpstruck) {
		var tmpfigure = buildBodyFigure(tmpareas, {});
		if (tmpfigure.kind != "figure") { return ""; }
		var tmpw = Math.round(tmpfigure.box.width * MINI_SCALE);
		var tmph = Math.round(tmpfigure.box.height * MINI_SCALE);
		var tmpboxes = tmpfigure.shapes.map(tmps => {
			var tmpclass = `mini-area area-${tmps.state}${tmps.name == tmpstruck ? " struck" : ""}`;
			var tmpstyle = `left:${Math.round(tmps.x * MINI_SCALE)}px;top:${Math.round(tmps.y * MINI_SCALE)}px;`
				+ `width:${Math.round(tmps.w * MINI_SCALE)}px;height:${Math.round(tmps.h * MINI_SCALE)}px;`
				+ `border-radius:${Math.round(tmps.rx * MINI_SCALE)}px`;
			return `<div class="${tmpclass}" style="${tmpstyle}" title="${escapeText(tmps.name)}"></div>`;
		});
		return `<div class="body-mini" style="width:${tmpw}px;height:${tmph}px" title="${escapeText(tmpstruck ?? "")}">${tmpboxes.join("")}</div>`;
	}

	// This is the function which escapes text for an attribute; names are user-editable.
	function escapeText(tmptext) {
		return String(tmptext ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

// @MARKER THE CLICKED AREA
	// This is the function which says everything the sheet knows about one area, for the panel
	// beside the picture:
	//     {
	//       name, type, state, stateLabel,
	//       endurance, wounds, left,              left = Endurance less wounds, never below 0
	//       vitalityAt, effectAt,                 the wound counts at which the next two states begin
	//       armor, shield, armorDamage, material, as _prepareBody gives them
	//       layers:  [ "Chain Mail Shirt", "Buckler", ... ]   every worn layer and shield over it
	//       protected: whether anything covers it at all
	//       effects: [ "Spell: Fly", ... ]        what is running on the whole being (no effect is
	//                                             kept per area; see the note below)
	//       canHeal: wounds > 0                   whether the Heal button has anything to do
	//     }
	//     tmparea     one entry of body.areas
	//     tmpoptions  { effects }  the actor-wide running-effects list, already split into names
	//
	// WHY EFFECTS ARE THE WHOLE BEING'S. His sheet keeps "Spell: Fly, Invoke: Chill" as one list on
	// the character (magic.effectList); nothing in his data ties an effect to an area, and the
	// board's dartboard row records that wounds-by-type-within-an-area is a schema question still
	// to settle. Until it is, the panel shows the list the being carries, under its own heading, so
	// a buff or debuff is in view without pretending it belongs to the shin.
	export function describeArea(tmparea, tmpoptions) {
		var tmpopts = tmpoptions ?? {};
		var tmpstate = AREA_STATES[tmparea.state] ? tmparea.state : "sound";
		var tmpendurance = parseInt(tmparea.endurance) || 0;
		var tmpwounds = parseInt(tmparea.wounds) || 0;
		var tmpvitality = parseInt(tmpopts.vitality) || 0;
		var tmplayers = Array.isArray(tmparea.layers) ? tmparea.layers.map(tmpl => String(tmpl)) : [];
		var tmpeffects = Array.isArray(tmpopts.effects)
			? tmpopts.effects.map(tmpe => String(tmpe ?? "").trim()).filter(tmpe => tmpe && tmpe != "None")
			: [];
		return {
			name: String(tmparea.name ?? ""),
			type: tmparea.type ?? "Limb",
			multiplier: tmparea.multiplier ?? 1,
			state: tmpstate,
			stateLabel: AREA_STATES[tmpstate].label,
			endurance: tmpendurance,
			wounds: tmpwounds,
			left: Math.max(0, tmpendurance - tmpwounds),
			// The thresholds _prepareBody tests: over Endurance is a Vitality save, over Endurance plus
			// Vitality the area's effect. Shown so a player can see how close the next one is.
			vitalityAt: tmpendurance + 1,
			effectAt: tmpendurance + tmpvitality + 1,
			armor: parseInt(tmparea.armor) || 0,
			shield: parseInt(tmparea.shield) || 0,
			armorDamage: parseInt(tmparea.armorDamage) || 0,
			material: tmparea.material ?? "",
			layers: tmplayers,
			protected: !!tmparea.protectedByArmor,
			effects: tmpeffects,
			canHeal: tmpwounds > 0
		};
	}

// @MARKER WOUNDS BY BUTTON
// The panel's −1 / +1 / Heal, shared by both sheets so the rule is in one place. Wounds are stored
// state under system.body.wounds.<area name> (the table's input writes the same key), never below 0.
	// This is the function which adds tmpdelta wounds to one area (negative to take some off).
	// Returns the new count, or null when the area is not on the body.
	export async function adjustBodyWound(tmpactor, tmpareaname, tmpdelta) {
		var tmparea = (tmpactor?.system?.body?.areas ?? []).find(tmpa => tmpa.name == tmpareaname);
		if (!tmparea) { return null; }
		var tmpnew = Math.max(0, (parseInt(tmparea.wounds) || 0) + (parseInt(tmpdelta) || 0));
		await tmpactor.update({ [`system.body.wounds.${tmpareaname}`]: tmpnew });
		return tmpnew;
	}

	// This is the function which clears every wound on one area.
	export async function healBodyArea(tmpactor, tmpareaname) {
		var tmparea = (tmpactor?.system?.body?.areas ?? []).find(tmpa => tmpa.name == tmpareaname);
		if (!tmparea) { return null; }
		await tmpactor.update({ [`system.body.wounds.${tmpareaname}`]: 0 });
		return 0;
	}

// @MARKER PARTIAL
// The partial both Combat tabs include, loaded the way the martial panel's is (loadMartialTemplates
// in module/combat/martial-attack.mjs): once at init, and awaited again by each sheet before it
// renders. Foundry-bound, but only when called, so the tests above it still import cleanly.
const BODY_PARTIALS = {
	"imagine-body-figure": "systems/imagine-rpg/templates/actor/body-figure.hbs"
};
var tmpBodyTemplatesReady = null;

	// This is the function which loads the figure's partial, once.
	export function loadBodyTemplates() {
		if (!tmpBodyTemplatesReady) {
			tmpBodyTemplatesReady = foundry.applications.handlebars.loadTemplates(BODY_PARTIALS);
		}
		return tmpBodyTemplatesReady;
	}

// @MARKER ADD NEW body view functions HERE
// @END (CODE)
