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
// This is the first piece of the attack-chart "dartboard" on the board (PROGRESS, Epic 4): the
// design there needs an aim point picked ON the target's own body, and a clickable area is that
// picker. The adjacency model (which area is High, Low, Left, Right of the aim) is not here yet.
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
	//     tmpoptions  { bodyType, selected, effects } -- effects is the actor-wide list of what is
	//                 running on the being (buildMagicPanel's `effects`), shown in the panel
	export function buildBodyFigure(tmpareas, tmpoptions) {
		var tmpopts = tmpoptions ?? {};
		var tmplist = Array.isArray(tmpareas) ? tmpareas : [];
		var tmpselectedname = String(tmpopts.selected ?? "");
		var tmpselectedarea = tmplist.find(tmpa => tmpa.name == tmpselectedname) ?? null;

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
			selected: tmpselectedarea ? describeArea(tmpselectedarea, tmpopts) : null
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
				if (tmpplace) { tmpresult.shapes.push({ ...tmpshape, ...tmpplace }); }
				else { tmpresult.unplaced.push(tmpshape); }
			}
			return tmpresult;
		}

		// The map, for every other body.
		tmpresult.columns = { left: [], centre: [], right: [] };
		for (const tmparea of tmplist) {
			tmpresult.columns[getAreaSide(tmparea.name)].push(describeShape(tmparea, tmpselectedname));
		}
		return tmpresult;
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
