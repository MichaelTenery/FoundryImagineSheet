// @START (CODE)
// @MARKER CHANGELOG
//==================================================================================================================
// The "What's New" window. After the system is updated, each user is shown the CHANGELOG.md entries
// for every version newer than the last one they saw -- once -- and can open it again at any time
// from Configure Settings, or with game.imagine.showChangelog().
//
// WHY THE CHANGELOG ITSELF RATHER THAN A SECOND COPY. CHANGELOG.md is already written for the
// people updating, is shipped inside the system archive by tools/build_system.py, and is fetched
// here at runtime. A separate "release notes" string in the code would be a second copy, and a
// second copy is one that drifts.
//
// PER USER, NOT PER WORLD. The version last seen is a client setting, so a player who was away
// for three updates sees all three, and a Game Master dismissing it does not dismiss it for the
// table.
//
// WHAT IS SHOWN. Only the version sections ("## 0.16.1 — 2026-09-22"). The preamble above the first
// of them is about publishing -- the manifest cache window and the like -- and is for whoever
// pushes an update, not for whoever receives one. A heading that is not a version ("## What to look
// at in 0.14.0, if you are testing") belongs to the release below it, which is where it is written.
//
// The parsing and the Markdown are pure functions with no Foundry in them, so tools/changelog-test.html
// can check them without a running world.
//==================================================================================================================

const CHANGELOG_PATH = "systems/imagine-rpg/CHANGELOG.md";

// @MARKER VERSIONS
// This is the function which reads the leading "x.y.z" off a heading, or returns null for a heading
// that is not a version. "0.3.0 and earlier" reads as 0.3.0.
export function readVersion(tmpheading) {
	var tmpmatch = ("" + (tmpheading ?? "")).trim().match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
	if (!tmpmatch) { return null; }
	return [parseInt(tmpmatch[1]), parseInt(tmpmatch[2]), parseInt(tmpmatch[3] ?? "0")].join(".");
}

// This is the function which compares two "x.y.z" strings: negative when the first is older,
// positive when it is newer, 0 when equal. A blank or unreadable version counts as older than
// everything, which is what "never seen one" means.
export function compareVersions(tmpa, tmpb) {
	var tmpfirst  = readVersion(tmpa);
	var tmpsecond = readVersion(tmpb);
	if (!tmpfirst && !tmpsecond) { return 0; }
	if (!tmpfirst)  { return -1; }
	if (!tmpsecond) { return 1; }
	var tmpx = tmpfirst.split(".").map(Number);
	var tmpy = tmpsecond.split(".").map(Number);
	for (var tmpi = 0; tmpi < 3; tmpi++) {
		if (tmpx[tmpi] != tmpy[tmpi]) { return tmpx[tmpi] - tmpy[tmpi]; }
	}
	return 0;
}


// @MARKER PARSE
// This is the function which splits CHANGELOG.md into its releases, newest first as written:
//     [ { version: "0.16.1", heading: "0.16.1 — 2026-09-22", body: "...markdown..." }, ... ]
// A non-version "## " section is carried down into the release that follows it.
export function parseChangelog(tmptext) {
	var tmpentries = [];
	var tmpcarried = "";
	var tmpsections = ("\n" + (tmptext ?? "").replace(/\r\n/g, "\n")).split(/\n## /);

	// The first piece is the preamble -- everything before the first "## ". Not shown.
	for (var tmpi = 1; tmpi < tmpsections.length; tmpi++) {
		var tmpsection = tmpsections[tmpi];
		var tmpbreak   = tmpsection.indexOf("\n");
		var tmpheading = (tmpbreak < 0 ? tmpsection : tmpsection.slice(0, tmpbreak)).trim();
		var tmpbody    = (tmpbreak < 0 ? "" : tmpsection.slice(tmpbreak + 1)).trim();
		var tmpversion = readVersion(tmpheading);

		if (!tmpversion) {
			tmpcarried += "### " + tmpheading + "\n\n" + tmpbody + "\n\n";
			continue;
		}
		tmpentries.push({ version: tmpversion, heading: tmpheading, body: (tmpbody + "\n\n" + tmpcarried).trim() });
		tmpcarried = "";
	}
	return tmpentries;
}

// This is the function which picks the releases a user has not seen: newer than tmplastseen and no
// newer than tmpcurrent. Someone who has never seen one is shown only the current release -- a new
// table does not need the history of every version before it joined.
export function entriesSince(tmpentries, tmplastseen, tmpcurrent) {
	if (!readVersion(tmplastseen)) {
		return tmpentries.filter(tmpentry => compareVersions(tmpentry.version, tmpcurrent) == 0);
	}
	return tmpentries.filter(tmpentry => compareVersions(tmpentry.version, tmplastseen) > 0
		&& compareVersions(tmpentry.version, tmpcurrent) <= 0);
}


// @MARKER MARKDOWN
// A small Markdown reader, for exactly what CHANGELOG.md uses: "##"/"###" headings, paragraphs
// wrapped across lines, "- " and "1. " lists with indented continuation lines, "> " quotes, "---",
// **bold**, *italic*, `code` and [links](url). Written out rather than borrowed because nothing in
// Foundry's public API promises a Markdown converter, and a changelog that renders as raw asterisks
// is worse than one that renders plainly.

// This is the function which escapes text for HTML. Everything is escaped BEFORE the inline marks
// are turned into tags, so nothing in the changelog can inject markup of its own.
function escapeHTML(tmptext) {
	return ("" + tmptext).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// This is the function which renders the inline marks of one run of already-escaped text.
function renderInline(tmptext) {
	var tmpout = escapeHTML(tmptext);
	tmpout = tmpout.replace(/`([^`]+)`/g, "<code>$1</code>");
	tmpout = tmpout.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	tmpout = tmpout.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>");
	// Links only to http(s): the URL has been escaped already, and anything else is left as text.
	tmpout = tmpout.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
		"<a href=\"$2\" target=\"_blank\" rel=\"noopener\">$1</a>");
	return tmpout;
}

// This is the function which renders one release's Markdown body to HTML.
export function renderChangelogMarkdown(tmptext) {
	var tmplines = ("" + (tmptext ?? "")).replace(/\r\n/g, "\n").split("\n");
	var tmphtml  = [];
	var tmppara  = [];          // lines of the paragraph being gathered
	var tmplist  = null;        // { tag: "ul"|"ol", items: [[lines]] } while inside a list
	var tmpquote = [];          // lines of the quote being gathered

	function flushPara() {
		if (tmppara.length) { tmphtml.push("<p>" + renderInline(tmppara.join(" ")) + "</p>"); }
		tmppara = [];
	}
	function flushList() {
		if (tmplist) {
			tmphtml.push("<" + tmplist.tag + ">"
				+ tmplist.items.map(tmpitem => "<li>" + renderInline(tmpitem.join(" ")) + "</li>").join("")
				+ "</" + tmplist.tag + ">");
		}
		tmplist = null;
	}
	function flushQuote() {
		if (tmpquote.length) {
			tmphtml.push("<blockquote>" + renderChangelogMarkdown(tmpquote.join("\n")) + "</blockquote>");
		}
		tmpquote = [];
	}
	function flushAll() { flushPara(); flushList(); flushQuote(); }

	for (const tmpline of tmplines) {
		var tmptrim = tmpline.trim();
		var tmpbullet  = tmpline.match(/^[-*]\s+(.*)$/);
		var tmpnumber  = tmpline.match(/^\d+\.\s+(.*)$/);
		var tmpheading = tmpline.match(/^(#{2,4})\s+(.*)$/);

		if (tmpline.startsWith(">")) {
			flushPara(); flushList();
			tmpquote.push(tmpline.replace(/^>\s?/, ""));
			continue;
		}
		flushQuote();

		if (!tmptrim) { flushPara(); flushList(); continue; }
		if (/^-{3,}$/.test(tmptrim)) { flushAll(); tmphtml.push("<hr>"); continue; }
		if (tmpheading) {
			flushAll();
			// A release's own heading is the window's; anything inside it steps down one level.
			var tmplevel = Math.min(6, tmpheading[1].length + 1);
			tmphtml.push("<h" + tmplevel + ">" + renderInline(tmpheading[2]) + "</h" + tmplevel + ">");
			continue;
		}
		if (tmpbullet || tmpnumber) {
			flushPara();
			var tmptag = tmpbullet ? "ul" : "ol";
			if (tmplist && tmplist.tag != tmptag) { flushList(); }
			tmplist ??= { tag: tmptag, items: [] };
			tmplist.items.push([(tmpbullet ?? tmpnumber)[1]]);
			continue;
		}
		// An indented line inside a list continues the item above it.
		if (tmplist && /^\s+/.test(tmpline)) {
			tmplist.items[tmplist.items.length - 1].push(tmptrim);
			continue;
		}
		flushList();
		tmppara.push(tmptrim);
	}
	flushAll();
	return tmphtml.join("\n");
}


// @MARKER THE WINDOW
// Built lazily: ApplicationV2 exists only inside Foundry, and the pure functions above must still
// import cleanly in the browser test suite.
var tmpwindowclass = null;

// This is the function which returns the window class, defining it the first time it is asked for.
export function getChangelogWindowClass() {
	if (tmpwindowclass) { return tmpwindowclass; }
	const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

	tmpwindowclass = class ImagineChangelog extends HandlebarsApplicationMixin(ApplicationV2) {

		// tmpoptions.releases, when given, is the list to show (the ones not yet seen). Opened from
		// Configure Settings it is not given, and every release is shown.
		constructor(tmpoptions = {}) {
			super(tmpoptions);
			this.releases = tmpoptions.releases ?? null;
		}

		static DEFAULT_OPTIONS = {
			id: "imagine-changelog",
			classes: ["imagine", "imagine-changelog"],
			window: { title: "Imagine RPG — What's New", resizable: true },
			position: { width: 620, height: 640 }
		};

		static PARTS = {
			body: { template: "systems/imagine-rpg/templates/apps/changelog.hbs", scrollable: [".changelog-releases"] }
		};

		async _prepareContext(tmpoptions) {
			var tmpreleases = this.releases;
			var tmpall = false;
			if (!tmpreleases) {
				tmpreleases = parseChangelog(await loadChangelogText());
				tmpall = true;
			}
			return {
				version:  game.system.version,
				showingAll: tmpall,
				empty:    !tmpreleases.length,
				releases: tmpreleases.map(tmpentry => ({
					heading: tmpentry.heading,
					html:    renderChangelogMarkdown(tmpentry.body)
				}))
			};
		}

		// Painted with the sheet theme, as every other Imagine window is. See module/sheet-theme.mjs.
		async _onRender(tmpcontext, tmpoptions) {
			await super._onRender?.(tmpcontext, tmpoptions);
			var { applySheetTheme } = await import("./sheet-theme.mjs");
			applySheetTheme(this.element);
		}
	};
	return tmpwindowclass;
}

// This is the function which fetches CHANGELOG.md from the installed system. A missing file is not
// an error worth a notification: an older build shipped without one.
async function loadChangelogText() {
	try {
		var tmpresponse = await fetch(CHANGELOG_PATH, { cache: "no-cache" });
		if (!tmpresponse.ok) { return ""; }
		return await tmpresponse.text();
	} catch (tmperror) {
		console.warn("Imagine RPG | could not read CHANGELOG.md", tmperror);
		return "";
	}
}


// @MARKER PUBLIC ENTRY POINTS

// This is the function which opens the window showing every release. game.imagine.showChangelog().
export function showChangelog() {
	var tmpclass = getChangelogWindowClass();
	return new tmpclass().render(true);
}

// This is the function which registers the setting and the Configure Settings button. Called at init.
export function registerChangelog() {
	// The version this user last saw the changelog for. Client scope: see the header.
	game.settings.register("imagine-rpg", "changelogSeenVersion", {
		scope: "client",
		config: false,
		type: String,
		default: ""
	});

	game.settings.registerMenu("imagine-rpg", "changelogMenu", {
		name: "What's New",
		label: "Show Changelog",
		hint: "What has changed in each version of the Imagine RPG system.",
		icon: "fa-solid fa-scroll",
		type: getChangelogWindowClass(),
		restricted: false
	});
}

// This is the function which, at ready, shows this user the releases they have not seen, then
// records that they have. Recorded when shown rather than when closed, so reloading with the window
// open does not show it twice.
export async function showChangelogIfNew() {
	var tmpcurrent  = game.system.version;
	var tmplastseen = game.settings.get("imagine-rpg", "changelogSeenVersion");
	if (compareVersions(tmplastseen, tmpcurrent) >= 0) { return; }

	var tmpunseen = entriesSince(parseChangelog(await loadChangelogText()), tmplastseen, tmpcurrent);
	await game.settings.set("imagine-rpg", "changelogSeenVersion", tmpcurrent);
	if (!tmpunseen.length) { return; }

	var tmpclass = getChangelogWindowClass();
	new tmpclass({ releases: tmpunseen }).render(true);
}

// @MARKER ADD NEW changelog functions HERE
// @END (CODE)
