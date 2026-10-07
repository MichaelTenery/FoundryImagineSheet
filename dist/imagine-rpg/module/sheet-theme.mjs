// @START (CODE)
// @MARKER SHEET THEME
//==================================================================================================================
// Which palette the Imagine windows paint themselves in.
//
// The system's own look is cream paper with brown ink -- a deliberate choice, because a character
// sheet with this many numbers on it reads better as a printed page than as a dark panel, and
// because entered values and derived values are told apart by field-against-flat-text, which needs
// a light ground to work. That look is kept as the default.
//
// But it is not everyone's, and a Game Master running a dark table had the Imagine windows glaring
// out of an otherwise dark screen with no way to say otherwise. So it is a setting, and the other
// choice is simply to stop overriding: "Foundry standard" hands the colours back to whatever theme
// Foundry itself is using, light or dark, and the sheets follow the rest of the interface.
//
// THE CLASSES ARE PUT ON AT RENDER, not declared in DEFAULT_OPTIONS.classes. A window's static
// classes are fixed when it is constructed, so a sheet already open when the setting changed would
// have kept the old palette until it was closed and reopened. Doing it in _onRender means an
// ordinary re-render repaints it, which is what the setting's onChange asks every open window to do.
//==================================================================================================================

// The palettes, and what each puts on the window's root element.
//   paper     the system's own cream: Foundry's light theme variables, plus the overrides in
//             styles/imagine-rpg.css that this file's "themed"/"theme-light" pair switch on
//   foundry   no override at all: imagine-foundry maps the system's colour variables onto
//             Foundry's own, so the sheets take the interface's theme, dark or light
const THEME_CLASSES = {
	//  setting value   classes added to the window root
	paper:   ["themed", "theme-light"],
	foundry: ["imagine-foundry"]
};

// Every class this module might add, so switching themes can take the other one's off again.
const ALL_THEME_CLASSES = ["themed", "theme-light", "imagine-foundry"];

// @MARKER PANEL COLOUR SCHEMES
// His Roll20 sheet's "Color Scheme" select (HTML 57271-57279): seven schemes, each three tints that
// alternate across the panels so a long tab reads in bands rather than as one field of text, and
// "Standard" -- white, no scheme at all. Asked for here 2026-10-07 ("Michael had the ability to
// change the theme of the sheets, green, pink, grey etc, to make reading the skills easier").
// The three tints are his own named CSS colours, exactly as his stylesheet has them
// (ImagineTabbedCharacterSheet.css 3482-3552): primary is the strong one, secondary the middle,
// tertiary the pale ground. ONE DICTIONARY, NOT SEVEN CSS BLOCKS: applyPanelScheme writes these
// onto the window as the palette variables (--imagine-paper and the rest, styles/imagine-rpg.css
// @MARKER PALETTE), so adding a scheme is one row here and nothing in the stylesheet. A scheme
// applies on top of "Imagine paper" only; under "Foundry standard" the sheets follow Foundry's own
// theme and these light tints would fight a dark one.
//  key       label (his words)             primary        secondary       tertiary
export const PANEL_SCHEMES = {
	none:   { label: "None (plain paper)",           primary: "",             secondary: "",              tertiary: "" },
	gray:   { label: "Alternating gray panels",      primary: "darkgray",     secondary: "gainsboro",     tertiary: "whitesmoke" },
	blue:   { label: "Alternating blue panels",      primary: "lightskyblue", secondary: "powderblue",    tertiary: "mintcream" },
	green:  { label: "Alternating green panels",     primary: "palegreen",    secondary: "darkseagreen",  tertiary: "honeydew" },
	red:    { label: "Alternating red panels",       primary: "salmon",       secondary: "lightsalmon",   tertiary: "linen" },
	brown:  { label: "Alternating brown panels",     primary: "burlywood",    secondary: "antiquewhite",  tertiary: "cornsilk" },
	pink:   { label: "Alternating pink panels",      primary: "hotpink",      secondary: "lightpink",     tertiary: "lavenderblush" },
	purple: { label: "Alternating purple panels",    primary: "orchid",       secondary: "plum",          tertiary: "thistle" }
};

// Which palette variable each tint paints. His sheet alternates primary / secondary / tertiary
// panels down the page; here the page itself is the pale tint, every panel and table row the
// middle one, and headings and the row under the pointer the strong one -- the same three bands,
// placed by the job each colour already has. Fields stay white (--imagine-field is not here) so
// an entered value is still told from a derived one, the whole reason the paper look exists.
//  palette variable         tint
const SCHEME_VARIABLES = [
	["--imagine-paper",       "tertiary"],
	["--imagine-panel",       "secondary"],
	["--imagine-row-alt",     "secondary"],
	["--imagine-rule-soft",   "secondary"],
	["--imagine-head",        "primary"],
	["--imagine-row-hover",   "primary"]
];

// This is the function which gives the setting its choices, his labels, in his order.
export function getPanelSchemeChoices() {
	return Object.fromEntries(Object.entries(PANEL_SCHEMES).map(([tmpkey, tmprow]) => [tmpkey, tmprow.label]));
}

// This is the function which reads the scheme setting, "none" by default. Guarded as getSheetTheme is.
export function getPanelScheme() {
	try {
		return game?.settings?.get("imagine-rpg", "panelScheme") ?? "none";
	} catch (tmperror) {
		return "none";
	}
}

// This is the function which says what one scheme writes onto a window: { "--imagine-paper":
// "honeydew", ... }, or null for "none" and for a name that is not a scheme -- in which case
// nothing is painted and the paper look stands.
export function getPanelSchemeVariables(tmpname) {
	var tmprow = Object.hasOwn(PANEL_SCHEMES, tmpname) ? PANEL_SCHEMES[tmpname] : null;
	if (!tmprow || !tmprow.tertiary) { return null; }
	return Object.fromEntries(SCHEME_VARIABLES.map(([tmpvariable, tmptint]) => [tmpvariable, tmprow[tmptint]]));
}

// This is the function which paints one scheme onto one window, or takes every scheme off it
// (tmpname "none", unknown, or omitted). Written as inline style properties on the window root,
// which outrank the stylesheet's .imagine block and so re-point the palette for everything inside.
export function applyPanelScheme(tmpelement, tmpname) {
	if (!tmpelement?.style) { return; }
	var tmpvariables = getPanelSchemeVariables(tmpname);
	for (const [tmpvariable] of SCHEME_VARIABLES) {
		if (tmpvariables) { tmpelement.style.setProperty(tmpvariable, tmpvariables[tmpvariable]); }
		else { tmpelement.style.removeProperty(tmpvariable); }
	}
}

// This is the function which reads the setting, defaulting to the paper look. Guarded because a
// sheet can render before the settings are registered -- and during the preview harnesses, where
// there is no `game` at all.
export function getSheetTheme() {
	try {
		return game?.settings?.get("imagine-rpg", "sheetTheme") ?? "paper";
	} catch (tmperror) {
		return "paper";
	}
}

// This is the function which paints one window. Called from _onRender on each sheet and app.
export function applySheetTheme(tmpelement) {
	if (!tmpelement?.classList) { return; }
	var tmpwanted = THEME_CLASSES[getSheetTheme()] ?? THEME_CLASSES.paper;
	for (const tmpclass of ALL_THEME_CLASSES) {
		tmpelement.classList.toggle(tmpclass, tmpwanted.includes(tmpclass));
	}
	// His colour scheme, on the paper look only; any other theme takes it off again.
	applyPanelScheme(tmpelement, getSheetTheme() == "paper" ? getPanelScheme() : "none");
	applyVersionBadge(tmpelement);
}

// @MARKER VERSION BADGE
// The system's version in every Imagine window's title bar -- "v0.18.0" -- so which build a table
// is actually running is in front of everyone without opening Foundry's setup screen. On
// 2026-09-20 a fixed import error was reported twice from a stale install with nothing on screen to
// tell the builds apart; this is the same answer as the console line at init, made visible. A
// client setting, on by default, turns it off. Put on here because every Imagine window already
// calls applySheetTheme from _onRender, so each redraw keeps it -- and removes it when turned off.

// This is the function which reads the setting, on unless it says otherwise. Guarded for the same
// reasons getSheetTheme is.
export function getShowVersion() {
	try {
		return game?.settings?.get("imagine-rpg", "showVersion") ?? true;
	} catch (tmperror) {
		return true;
	}
}

// This is the function which puts the badge in one window's header, or takes it out.
export function applyVersionBadge(tmpelement) {
	var tmpheader = tmpelement?.querySelector?.(".window-header");
	if (!tmpheader) { return; }
	var tmpbadge = tmpheader.querySelector(".imagine-version");
	var tmpversion = game?.system?.version ?? "";
	if (!getShowVersion() || !tmpversion) {
		tmpbadge?.remove();
		return;
	}
	if (!tmpbadge) {
		tmpbadge = document.createElement("span");
		tmpbadge.className = "imagine-version";
		var tmptitle = tmpheader.querySelector(".window-title");
		if (tmptitle) { tmptitle.after(tmpbadge); } else { tmpheader.prepend(tmpbadge); }
	}
	tmpbadge.textContent = `v${tmpversion}`;
	tmpbadge.dataset.tooltip = `Imagine Role Playing System ${tmpversion}`;
}

// This is the function which repaints everything already on screen, for the setting's onChange.
// Re-rendering is enough because the classes are applied in _onRender rather than at construction.
export function refreshOpenWindows() {
	for (const tmpapp of Object.values(ui.windows ?? {})) { tmpapp.render?.(false); }
	for (const tmpapp of (foundry.applications?.instances?.values?.() ?? [])) {
		if (tmpapp.element?.classList?.contains("imagine")) { tmpapp.render?.(false); }
	}
}

// @MARKER ADD NEW theme functions HERE
// @END (CODE)
