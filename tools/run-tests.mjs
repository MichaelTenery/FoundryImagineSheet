// @START (CODE)
// @MARKER HEADLESS TEST RUNNER
//==================================================================================================================
// Runs the tools/*-test.html suites under Node, with no browser. Each page is a <script type="module">
// that imports the modules, runs its checks and writes "N passed, M failed" into #out; this lifts the
// script out, gives it just enough of a page -- document.getElementById, a fetch that reads the
// repository's own files -- and reads #out back.
//
//     node tools/run-tests.mjs                      every suite
//     node tools/run-tests.mjs chargen wealth       only suites whose file name contains a word given
//
// Each suite runs in its own Node process, because the pages stub Foundry's globals differently and one
// suite's stubs must not leak into the next. A page that needs more of a browser than this gives (a
// real DOM, Handlebars on the page) reports an error rather than a count; open that one in a browser.
// Exit code 1 if any suite failed or errored, so a script can stop on it.
//==================================================================================================================

import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));

	// @MARKER ONE SUITE
	// This is the function which runs a single page inside this process: called as
	//     node tools/run-tests.mjs --one <file.html>
	// and prints one JSON line with what #out ended up holding.
	async function runOne(tmpFile) {
		var tmpPage = path.resolve(tmpFile);
		var tmpHtml = readFileSync(tmpPage, "utf8");
		var tmpMatch = tmpHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
		if (!tmpMatch) { console.log(JSON.stringify({ error: "no module script on the page" })); return; }

		var tmpElements = {};
		var tmpElement = (tmpId) => (tmpElements[tmpId] ??= { id: tmpId, innerHTML: "", textContent: "", style: {},
			classList: { add() {}, remove() {}, toggle() {} }, append() {}, appendChild() {}, querySelector: () => null,
			querySelectorAll: () => [], setAttribute() {}, addEventListener() {} });
		globalThis.window = globalThis;
		// A page that loads Handlebars from the CDN gets the copy Foundry itself ships, where this machine
		// has Foundry installed; otherwise it errors as before and wants a browser.
		if (/<script src="[^"]*handlebars/.test(tmpHtml)) {
			try {
				var tmpRequire = (await import("node:module")).createRequire(import.meta.url);
				globalThis.Handlebars = tmpRequire("C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/handlebars");
			} catch (tmpIgnored) { }
		}
		globalThis.document = {
			getElementById: tmpElement,
			querySelector: () => null, querySelectorAll: () => [],
			createElement: (tmpTag) => tmpElement("__" + tmpTag + Math.random()),
			body: tmpElement("__body")
		};
		// A fetch that reads the repository: every URL is taken relative to the page, as a browser would.
		globalThis.fetch = async (tmpUrl) => {
			var tmpTarget = new URL(("" + tmpUrl).split("?")[0], pathToFileURL(tmpPage));
			var tmpText = readFileSync(fileURLToPath(tmpTarget), "utf8");
			return { ok: true, status: 200, text: async () => tmpText, json: async () => JSON.parse(tmpText) };
		};

		// Written beside the page, so its relative imports ("../module/...") resolve exactly as they do in
		// a browser; removed again whatever happens.
		var tmpScript = path.join(path.dirname(tmpPage), `.run-${path.basename(tmpPage, ".html")}-${process.pid}.mjs`);
		writeFileSync(tmpScript, tmpMatch[1]);
		try {
			await import(pathToFileURL(tmpScript).href);
		} catch (tmpErr) {
			console.log(JSON.stringify({ error: `${tmpErr.name}: ${tmpErr.message}` }));
			return;
		} finally {
			try { unlinkSync(tmpScript); } catch (tmpIgnored) { }
		}
		var tmpOut = (tmpElements.out?.innerHTML || tmpElements.out?.textContent || "").replace(/<[^>]+>/g, "")
			.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, "\"");
		// Most pages end "N passed, M failed"; the rest are counted by their PASS and FAIL lines, which
		// every page writes the same way.
		var tmpLines = tmpOut.split("\n");
		var tmpFails = tmpLines.filter(tmpLine => /^\s*FAIL\b/.test(tmpLine));
		var tmpPasses = tmpLines.filter(tmpLine => /^\s*PASS\b/.test(tmpLine));
		var tmpCount = tmpOut.match(/(\d+) passed, (\d+) failed/);
		var tmpResult = tmpCount ? { passed: parseInt(tmpCount[1]), failed: parseInt(tmpCount[2]) }
			: (tmpPasses.length || tmpFails.length) ? { passed: tmpPasses.length, failed: tmpFails.length } : null;
		console.log(JSON.stringify(tmpResult ? { ...tmpResult, fails: tmpFails.slice(0, 40) }
			: { error: "no results in #out", tail: tmpOut.slice(-400) }));
	}

	// @MARKER EVERY SUITE
	// This is the function which runs each chosen page in a child process and prints the tally.
	function runAll(tmpWords) {
		var tmpPages = readdirSync(TOOLS).filter(tmpName => /-test\.html$/.test(tmpName) || tmpName == "levelup-walk.html")
			.filter(tmpName => !tmpWords.length || tmpWords.some(tmpWord => tmpName.includes(tmpWord))).sort();
		var tmpBad = 0;
		var tmpTotal = 0;
		for (const tmpName of tmpPages) {
			var tmpRun = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--one", path.join(TOOLS, tmpName)],
				{ encoding: "utf8", timeout: 180000 });
			var tmpLine = (tmpRun.stdout || "").trim().split("\n").filter(tmpText => tmpText.startsWith("{")).pop();
			var tmpResult = tmpLine ? JSON.parse(tmpLine) : { error: (tmpRun.stderr || "no output").trim().split("\n").slice(-3).join(" | ") };
			if (tmpResult.error) {
				tmpBad += 1;
				console.log(`ERROR  ${tmpName.padEnd(32)} ${tmpResult.error}`);
				continue;
			}
			tmpTotal += tmpResult.passed;
			if (tmpResult.failed) { tmpBad += 1; }
			console.log(`${tmpResult.failed ? "FAIL " : "ok   "}  ${tmpName.padEnd(32)} ${tmpResult.passed} passed, ${tmpResult.failed} failed`);
			for (const tmpFail of tmpResult.fails) { console.log("         " + tmpFail.trim()); }
		}
		console.log(`\n${tmpPages.length} suites, ${tmpTotal} checks passed, ${tmpBad} suite(s) failing or erroring`);
		process.exitCode = tmpBad ? 1 : 0;
	}

if (process.argv[2] == "--one") {
	await runOne(process.argv[3]);
} else {
	runAll(process.argv.slice(2));
}

// @END (CODE)
