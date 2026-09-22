#!/usr/bin/env python3
"""
build_system.py -- assemble the installable Foundry system into dist/imagine-rpg/.

Build-time tooling. Not shipped with the system (it builds the thing that is).

WHAT SHIPS AND WHAT DOES NOT. A Foundry system is a folder under Data/systems/ named after the
system's id. It needs the manifest, the code, the templates, the stylesheet, the language files and
-- for this system -- the generated content documents, which the importer fetches at runtime rather
than being compiled into packs ahead of time.

Everything else in this repository is how the system was BUILT, not part of it: the extraction
tooling, the raw and named intermediate data, the browser test suites and previews, the original
Roll20 export, and the project's own documentation. None of that belongs in a game's Data folder.

    shipped                             not shipped
    system.json                         tools/
    module/**.mjs                       src/packs/raw/, named/, manual/
    templates/**.hbs                    ImagineRoll20CharacterSheet-main/
    styles/*.css                        docs/ (except FIRST-RUN.md, which is for whoever installs it)
    lang/*.json                         CLAUDE.md, .claude/, .git/
    src/packs/documents/*.json

THE CHECK IS THE POINT. Copying files is easy to get right by accident and wrong by accident. So
after assembling, this reads every `systems/imagine-rpg/...` path the shipped code and templates
mention, plus every file the manifest names, and proves each one is present in the output. A
template referenced but not copied would otherwise show up as an empty sheet in someone's game.

Usage:
    python tools/build_system.py
    python tools/build_system.py --zip
"""

import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DIST = os.path.join(ROOT, "dist")
SYSTEM_ID = "imagine-rpg"
OUT = os.path.join(DIST, SYSTEM_ID)

# What goes in, as (source, destination) directory pairs and single files.
SHIPPED_DIRS = [
    ("module", "module"),
    ("templates", "templates"),
    ("styles", "styles"),
    ("lang", "lang"),
    (os.path.join("src", "packs", "documents"), os.path.join("src", "packs", "documents")),
]
SHIPPED_FILES = [
    ("system.json", "system.json"),
    (os.path.join("docs", "FIRST-RUN.md"), "FIRST-RUN.md"),
    # Read at runtime by the What's New window (module/changelog.mjs), from the system's root.
    ("CHANGELOG.md", "CHANGELOG.md"),
]

problems = []

# The schema file that declares each document TYPE, for the choices/blank sweep below. Keyed by
# the "type" a document carries (src/packs/documents/*.json), not by pack file name -- three packs
# (abilities, disabilities, immunities) all hold type "trait" and share one schema.
DOC_TYPE_SCHEMA_FILES = {
    "weapon": "item-weapon.mjs", "armor": "item-armor.mjs", "equipment": "item-equipment.mjs",
    "skill": "item-skill.mjs", "race": "item-race.mjs", "class": "item-class.mjs",
    "trait": "item-trait.mjs",
}

INSTALL_NOTE = """# Imagine Role Playing System — Foundry VTT system

Version {version}. A conversion of the Imagine Role Playing System from its Roll20 character sheet,
built with permission from the rights holder. Foundry VTT **V14** or later.

## Installing

This folder IS the system. Put it in your Foundry data folder, under `Data/systems/`, so that the
path reads:

    Data/systems/imagine-rpg/system.json

Then restart Foundry. The system appears in the Game Systems list and can be chosen when creating a
world. (If you have the zip, unpack it so its contents land directly in a folder of that name —
the archive has no top-level folder of its own.)

## Updating

**Version {version} and later update themselves.** In Foundry's **Game Systems** tab, press
**Check for Updates**; if a newer version has been published, an **Update** button appears and
Foundry fetches and installs it. Nothing needs to be copied by hand.

This works because the manifest names where to look:

    manifest   the current system.json in the project repository
    download   the archive beside it

Foundry compares the version in your installed `system.json` against the version in the manifest,
and offers the update when they differ. It compares the version number and **nothing else** — not
dates, not file contents — so a build published without raising the version is invisible to every
existing install.

One catch, once: an install from BEFORE {version} has no `download` in its manifest and cannot
update itself. Replace that folder by hand one last time, and every update after it is a button.

After updating, rebuild the compendium content so new and corrected entries come through — the
packs are built in your world, not shipped:

    game.imagine.importContent()

## First launch

The system ships its content as JSON and builds the compendium packs when you first use it, rather
than shipping pre-built packs. On the first launch of a new world it offers to do that; accept, and
it creates nine compendia holding 4,384 entries — skills, weapons, armour, equipment, races,
classes, and the ability, disability and immunity lists.

If you decline, or want to rebuild them later after updating the system, run this in the console as
the Game Master:

    game.imagine.importContent()

It matches documents by name and updates them in place, so anything already dragged onto a character
keeps pointing at the same document.

## Before you trust it

**This system has never been run in Foundry.** `FIRST-RUN.md`, beside this file, lists what was
checked against the V14 API ahead of time, what could not be, and a ten-step smoke test in the order
things are likely to break. Step 5 is the one that matters most.

## What is not here

Everything that built this: the extraction tooling, the intermediate data, the test suites, the
original Roll20 export and the project documentation. Those live in the project repository; this
folder is only what a game needs.
"""


# ---------------------------------------------------------------------------------
# @MARKER RETIRED DOCUMENTS SWEEP
# docs/sonnet/2026-09-22-playtest-feedback.md item 1. RETIRED_DOCUMENTS in
# module/content-importer.mjs is an EXPLICIT list, by design (see the comment beside it) -- it is
# never derived from "whatever the shipped file lacks", because that would delete a Game Master's
# own homebrew the moment they add a document the shipped file does not also carry. Being
# explicit means it can go stale by hand: a name gets renamed or split in src/packs/documents/ and
# nobody remembers to add its old name here, so an old install keeps a document the packs it was
# rebuilt from are supposed to have retired.
#
# This is a WARNING, not a build failure -- unlike the choices/blank sweep below, which is a real
# schema bug, a document that dropped out of history and was never retired is a judgement call
# (was it meant to go, or did it just move file?) and the build should not block on a judgement
# call. It only has to be loud enough that the judgement gets made.

def parse_retired_documents(tmptext):
    """Pull RETIRED_DOCUMENTS out of module/content-importer.mjs with a regex rather than a JS
    parser -- the same call schema_field_names() in build_documents.py makes, and for the same
    reason: there is no Node on this machine. The object is small and hand-written, one quoted
    array per pack, so this does not need to be more general than that."""
    tmpmatch = re.search(r'RETIRED_DOCUMENTS\s*=\s*\{', tmptext)
    if not tmpmatch:
        return {}
    tmpdepth = 0
    tmpi = tmpmatch.end() - 1
    while True:
        if tmptext[tmpi] == "{":
            tmpdepth += 1
        elif tmptext[tmpi] == "}":
            tmpdepth -= 1
            if tmpdepth == 0:
                break
        tmpi += 1
    tmpbody = tmptext[tmpmatch.end():tmpi]

    tmpretired = {}
    for tmppack, tmplist in re.findall(r'(\w+)\s*:\s*\[([^\]]*)\]', tmpbody):
        tmpretired[tmppack] = set(re.findall(r'"([^"]*)"', tmplist))
    return tmpretired


# This is the function which lists every document name a pack's file has EVER shipped, across its
# whole git history, one `git show` per commit that touched it. Bounded by construction: the `--`
# pathspec on `git log` already limits it to commits that touched this one file, which stays small
# (each pack file has changed a few dozen times at most) -- no separate cache is needed at this
# repository's size, and adding one would be one more thing that could go stale. Revisit if a
# pack's history ever runs long enough to make this slow.
def historical_document_names(tmprelpath):
    tmpnames = set()
    tmpcommits = git_output(["git", "log", "--format=%h", "--", tmprelpath])
    if not tmpcommits:
        return tmpnames
    for tmpcommit in tmpcommits.split():
        tmptext = git_output(["git", "show", "%s:%s" % (tmpcommit, tmprelpath)])
        if not tmptext:
            continue
        try:
            tmpdocs = json.loads(tmptext)
        except ValueError:
            continue
        for tmpdoc in tmpdocs:
            if isinstance(tmpdoc, dict) and tmpdoc.get("name"):
                tmpnames.add(tmpdoc["name"])
    return tmpnames


# This is the function which warns about any document name a pack used to ship, no longer does,
# and RETIRED_DOCUMENTS does not know left. Prints nothing when the list is complete.
def check_retired_documents_complete():
    with open(os.path.join(ROOT, "module", "content-importer.mjs"), encoding="utf-8") as fh:
        tmpretired = parse_retired_documents(fh.read())

    tmpmissing = {}
    for tmpfile in sorted(os.listdir(os.path.join(ROOT, "src", "packs", "documents"))):
        if not tmpfile.endswith(".json"):
            continue
        tmppack = tmpfile[:-5]
        tmprelpath = os.path.join("src", "packs", "documents", tmpfile).replace("\\", "/")
        with open(os.path.join(ROOT, "src", "packs", "documents", tmpfile), encoding="utf-8") as fh:
            tmpcurrent = {tmpdoc["name"] for tmpdoc in json.load(fh)}

        tmpeverseen = historical_document_names(tmprelpath)
        tmpgone = tmpeverseen - tmpcurrent - tmpretired.get(tmppack, set())
        if tmpgone:
            tmpmissing[tmppack] = sorted(tmpgone)

    if not tmpmissing:
        print("  RETIRED_DOCUMENTS is complete: every name missing from a current pack is accounted for")
        return

    print("\n  WARNING: RETIRED_DOCUMENTS in module/content-importer.mjs is missing some names.")
    print("  These names appear in an earlier version of a pack's file, are not in the current one,")
    print("  and are not in RETIRED_DOCUMENTS -- an old world that has them stays with them forever:")
    for tmppack, tmpnames in tmpmissing.items():
        for tmpname in tmpnames:
            print("    %-12s %s" % (tmppack, tmpname))


# ---------------------------------------------------------------------------------
# @MARKER CHOICES / BLANK SWEEP
# docs/sonnet/2026-09-20-first-install-bugs.md item 3. Foundry sets a StringField's `blank`
# implicitly to false the moment `choices` is given, so a field whose choices include "" needs
# `blank: true` said OUT LOUD or the empty string -- the ordinary "nothing chosen yet" value --
# fails validation and refuses the whole pack's import. Two fatal import errors on 2026-09-20 were
# both this. Nine fields across five data models were fixed by hand that day; this makes the sweep
# permanent so the bug cannot come back unnoticed.
#
# Two passes, matching the note's two bullets:
#   A. every StringField declared in module/data/*.mjs whose choices contains "" (or whose
#      initial is "") must say blank: true.
#   B. every value src/packs/documents/*.json actually carries for such a field must be one of
#      its declared choices.
#
# PARSED WITH A REGEX, NOT A JS ENGINE -- same reason as parse_retired_documents above. A choices
# list built by spreading a table (["", ...CREATURE_TYPES]) or a SchemaField/ArrayField built by a
# helper function (attackEffectField(), coverageField()) cannot be resolved this way without
# executing the file, so those are SKIPPED and counted rather than silently treated as clean.

def strip_js_comments(tmptext):
    """Blank out // and /* */ comments, character for character (so positions do not shift),
    without touching string contents -- so a stray ( or { in an explanatory comment (this file is
    full of them, by house style) can never be mistaken for code structure."""
    tmpout = []
    tmpi, tmpn = 0, len(tmptext)
    tmpinstring = None
    while tmpi < tmpn:
        tmpc = tmptext[tmpi]
        if tmpinstring:
            tmpout.append(tmpc)
            if tmpc == "\\" and tmpi + 1 < tmpn:
                tmpout.append(tmptext[tmpi + 1])
                tmpi += 2
                continue
            if tmpc == tmpinstring:
                tmpinstring = None
            tmpi += 1
            continue
        if tmpc in ("'", '"', "`"):
            tmpinstring = tmpc
            tmpout.append(tmpc)
            tmpi += 1
            continue
        if tmpc == "/" and tmpi + 1 < tmpn and tmptext[tmpi + 1] == "/":
            while tmpi < tmpn and tmptext[tmpi] != "\n":
                tmpout.append(" ")
                tmpi += 1
            continue
        if tmpc == "/" and tmpi + 1 < tmpn and tmptext[tmpi + 1] == "*":
            tmpout.append("  ")
            tmpi += 2
            while tmpi < tmpn and not (tmptext[tmpi] == "*" and tmpi + 1 < tmpn and tmptext[tmpi + 1] == "/"):
                tmpout.append("\n" if tmptext[tmpi] == "\n" else " ")
                tmpi += 1
            if tmpi < tmpn:
                tmpout.append("  ")
                tmpi += 2
            continue
        tmpout.append(tmpc)
        tmpi += 1
    return "".join(tmpout)


def find_matching_bracket(tmptext, tmpopenpos):
    """The index of the ([{ at tmptext[tmpopenpos]'s matching close, skipping string contents."""
    tmpopenchar = tmptext[tmpopenpos]
    tmpclosechar = {"(": ")", "[": "]", "{": "}"}[tmpopenchar]
    tmpdepth = 0
    tmpi = tmpopenpos
    tmpinstring = None
    tmpn = len(tmptext)
    while tmpi < tmpn:
        tmpc = tmptext[tmpi]
        if tmpinstring:
            if tmpc == "\\" and tmpi + 1 < tmpn:
                tmpi += 2
                continue
            if tmpc == tmpinstring:
                tmpinstring = None
            tmpi += 1
            continue
        if tmpc in ("'", '"', "`"):
            tmpinstring = tmpc
            tmpi += 1
            continue
        if tmpc == tmpopenchar:
            tmpdepth += 1
        elif tmpc == tmpclosechar:
            tmpdepth -= 1
            if tmpdepth == 0:
                return tmpi
        tmpi += 1
    return -1


FIELD_DECLARATION = re.compile(r'(\w+)\s*:\s*new\s+fields\.(\w+)Field\(')
INLINE_FIELD_CALL = re.compile(r'new\s+fields\.(\w+)Field\(')


# This is the function which walks one defineSchema() body and lists every *Field it declares
# inline, as a dotted path (an ArrayField of objects gets a trailing "[]", so a document-value
# check below knows to iterate a list rather than read one value). Recurses into a SchemaField's
# own body, and into an ArrayField's, when they are written inline; a helper-function call like
# attackEffectField() cannot be followed this way and is reported through tmpskipped instead of
# silently skipped.
def extract_declared_fields(tmptext, tmpstart, tmpend, tmppath, tmpout, tmpskipped):
    tmpi = tmpstart
    while True:
        tmpmatch = FIELD_DECLARATION.search(tmptext, tmpi, tmpend)
        if not tmpmatch:
            break
        tmpname, tmpkind = tmpmatch.group(1), tmpmatch.group(2)
        tmpopenparen = tmpmatch.end() - 1
        tmpcloseparen = find_matching_bracket(tmptext, tmpopenparen)
        if tmpcloseparen == -1 or tmpcloseparen > tmpend:
            break
        tmpcalltext = tmptext[tmpopenparen:tmpcloseparen + 1]

        if tmpkind == "Schema":
            if re.match(r'\(\s*\{', tmpcalltext):
                tmpbraceopen = tmpopenparen + tmpcalltext.index("{")
                tmpbraceclose = find_matching_bracket(tmptext, tmpbraceopen)
                extract_declared_fields(tmptext, tmpbraceopen + 1, tmpbraceclose, tmppath + [tmpname],
                                         tmpout, tmpskipped)
            else:
                tmpskipped.append(".".join(tmppath + [tmpname]) + " (a SchemaField built by a helper function)")
        elif tmpkind == "Array":
            tmpinner = INLINE_FIELD_CALL.match(tmpcalltext, 1)
            if not tmpinner:
                tmpskipped.append(".".join(tmppath + [tmpname]) + " (array element built by a helper function)")
            else:
                tmpinnerkind = tmpinner.group(1)
                tmpinneropen = tmpopenparen + tmpinner.end() - 1
                tmpinnerclose = find_matching_bracket(tmptext, tmpinneropen)
                if tmpinnerkind == "Schema":
                    tmpinnercall = tmptext[tmpinneropen:tmpinnerclose + 1]
                    if re.match(r'\(\s*\{', tmpinnercall):
                        tmpbraceopen = tmpinneropen + tmpinnercall.index("{")
                        tmpbraceclose = find_matching_bracket(tmptext, tmpbraceopen)
                        extract_declared_fields(tmptext, tmpbraceopen + 1, tmpbraceclose,
                                                 tmppath + [tmpname + "[]"], tmpout, tmpskipped)
                    else:
                        tmpskipped.append(".".join(tmppath + [tmpname]) + "[] (a SchemaField built by a helper function)")
                else:
                    tmpout.append({"path": ".".join(tmppath + [tmpname + "[]"]), "kind": tmpinnerkind,
                                    "call": tmptext[tmpinneropen:tmpinnerclose + 1]})
        else:
            tmpout.append({"path": ".".join(tmppath + [tmpname]), "kind": tmpkind, "call": tmpcalltext})

        tmpi = tmpcloseparen + 1


# This is the function which reads one module/data/*.mjs and returns (fields, skipped) for its
# defineSchema() body -- fields is a flat list of every *Field declared inline, skipped is every
# path that could not be followed because a helper function built it.
def parse_schema_file(tmppath):
    with open(tmppath, encoding="utf-8") as fh:
        tmpraw = fh.read()
    tmptext = strip_js_comments(tmpraw)
    tmpmethod = re.search(r'static\s+defineSchema\s*\(\s*\)\s*\{', tmptext)
    if not tmpmethod:
        return [], []
    tmpreturn = re.search(r'return\s*\{', tmptext[tmpmethod.end():])
    if not tmpreturn:
        return [], []
    tmpbraceopen = tmpmethod.end() + tmpreturn.end() - 1
    tmpbraceclose = find_matching_bracket(tmptext, tmpbraceopen)
    tmpout, tmpskipped = [], []
    extract_declared_fields(tmptext, tmpbraceopen + 1, tmpbraceclose, [], tmpout, tmpskipped)
    return tmpout, tmpskipped


# This is the function which reads a StringField's own "choices" option out of its call text.
# Returns (values, resolvable): resolvable is False for a spread (["", ...TABLE]) or a bare
# UPPER_CASE table reference (Object.keys(TABLE)), which is built at runtime and cannot be read
# without executing the file -- see the @MARKER comment above. Returns (None, True) when the field
# has no choices option at all, which is the ordinary case and not a thing to check.
def extract_choices_option(tmpcalltext):
    tmpmatch = re.search(r'choices\s*:', tmpcalltext)
    if not tmpmatch:
        return None, True
    tmpafter = tmpcalltext[tmpmatch.end():]
    tmpstripped = tmpafter.lstrip()
    if not tmpstripped or tmpstripped[0] not in "[{":
        # choices: SOME_IDENTIFIER or choices: Object.keys(...) -- a table reference, not a
        # literal, so nothing here to parse at all.
        return [], False
    tmpopenpos = tmpmatch.end() + (len(tmpafter) - len(tmpstripped))
    tmpclosepos = find_matching_bracket(tmpcalltext, tmpopenpos)
    tmpbody = tmpcalltext[tmpopenpos + 1:tmpclosepos]
    if re.search(r'\.\.\.[A-Za-z_]', tmpbody):
        return [], False

    if tmpcalltext[tmpopenpos] == "{":
        # An object form -- choices: { "": "Any race", caster: "Casting races", ... } -- where the
        # VALID VALUES are the keys, quoted or bare.
        tmpquotedkeys = re.findall(r'["\']((?:[^"\'\\]|\\.)*)["\']\s*:', tmpbody)
        tmpbarekeys = re.findall(r'(?:^|[{,])\s*(\w+)\s*:', tmpbody)
        return sorted(set(tmpquotedkeys) | set(tmpbarekeys)), True

    return re.findall(r'["\']((?:[^"\'\\]|\\.)*)["\']', tmpbody), True


# This is the function which runs pass A -- every StringField's choices/blank pairing -- across
# every module/data/*.mjs, and returns the resolvable {schema file: [(path, set(values)), ...]}
# map that pass B (document values) needs, so the same parse is not done twice.
def check_choices_blank_sweep():
    tmpdatadir = os.path.join(ROOT, "module", "data")
    tmpchecked = 0
    tmpviolations = []
    tmpskippedtotal = 0
    tmpresolvable = {}

    for tmpfilename in sorted(os.listdir(tmpdatadir)):
        if not tmpfilename.endswith(".mjs"):
            continue
        tmpfields, tmpskipped = parse_schema_file(os.path.join(tmpdatadir, tmpfilename))
        tmpskippedtotal += len(tmpskipped)
        tmpresolvable[tmpfilename] = []

        for tmpfield in tmpfields:
            if tmpfield["kind"] != "String":
                continue
            tmpchecked += 1
            tmpvalues, tmpresolvableflag = extract_choices_option(tmpfield["call"])
            if tmpvalues is None:
                continue  # no choices declared -- nothing to check
            if not tmpresolvableflag:
                tmpskippedtotal += 1
                continue

            tmpresolvable[tmpfilename].append((tmpfield["path"], set(tmpvalues)))
            tmphasblank = bool(re.search(r'blank\s*:\s*true', tmpfield["call"]))
            tmpinitialempty = bool(re.search(r'initial\s*:\s*["\']\s*["\']', tmpfield["call"]))
            if ("" in tmpvalues or tmpinitialempty) and not tmphasblank:
                tmpviolations.append(
                    "%s: %s has \"\" in choices %s without blank: true" % (tmpfilename, tmpfield["path"], tmpvalues))

    print("  choices/blank sweep: %d StringField(s) checked, %d skipped (built by a helper function "
          "or a spread table)" % (tmpchecked, tmpskippedtotal))
    if tmpviolations:
        problems.extend(tmpviolations)
    return tmpresolvable


# This is the function which walks one document's system object along a dotted/[]-marked path,
# yielding every value found there -- more than one for a "foo[]" segment, since that means
# "for every item in this list". A path that runs into a document with the field simply absent
# (the schema default was never written out) yields nothing, which is correct: an absent field is
# not a wrong value, it is Foundry's own default filling in.
def resolve_document_path(tmpvalue, tmpparts):
    if not tmpparts:
        yield tmpvalue
        return
    tmppart = tmpparts[0]
    if tmppart.endswith("[]"):
        tmpkey = tmppart[:-2]
        if not isinstance(tmpvalue, dict) or not isinstance(tmpvalue.get(tmpkey), list):
            return
        for tmpitem in tmpvalue[tmpkey]:
            yield from resolve_document_path(tmpitem, tmpparts[1:])
    else:
        if not isinstance(tmpvalue, dict) or tmppart not in tmpvalue:
            return
        yield from resolve_document_path(tmpvalue[tmppart], tmpparts[1:])


# This is the function which runs pass B -- every value the shipped documents actually carry for a
# field pass A could resolve, checked against that field's own choices.
def check_document_choices(tmpresolvablefields):
    tmpdocsdir = os.path.join(ROOT, "src", "packs", "documents")
    tmpchecked = 0
    tmpviolations = []

    for tmpfilename in sorted(os.listdir(tmpdocsdir)):
        if not tmpfilename.endswith(".json"):
            continue
        with open(os.path.join(tmpdocsdir, tmpfilename), encoding="utf-8") as fh:
            tmpdocs = json.load(fh)
        for tmpdoc in tmpdocs:
            tmpschemafile = DOC_TYPE_SCHEMA_FILES.get(tmpdoc.get("type"))
            if not tmpschemafile:
                continue
            for tmppath, tmpvalues in tmpresolvablefields.get(tmpschemafile, []):
                for tmpvalue in resolve_document_path(tmpdoc.get("system", {}), tmppath.split(".")):
                    tmpchecked += 1
                    if tmpvalue not in tmpvalues:
                        tmpviolations.append("%s %r: %s = %r is not one of %s"
                                              % (tmpfilename, tmpdoc.get("name"), tmppath, tmpvalue,
                                                 sorted(tmpvalues)))

    print("  choices/blank sweep: %d document value(s) checked against their field's choices" % tmpchecked)
    if tmpviolations:
        problems.extend(tmpviolations)


def copy_tree(tmpsource, tmpdest, tmpsuffixes):
    """Copy a directory, keeping only the file types that belong in a system."""
    tmpcount = 0
    for tmpdir, _, tmpfiles in os.walk(tmpsource):
        for tmpfile in tmpfiles:
            if tmpsuffixes and not tmpfile.endswith(tuple(tmpsuffixes)):
                continue
            tmpfrom = os.path.join(tmpdir, tmpfile)
            tmpto = os.path.join(tmpdest, os.path.relpath(tmpfrom, tmpsource))
            os.makedirs(os.path.dirname(tmpto), exist_ok=True)
            shutil.copy2(tmpfrom, tmpto)
            tmpcount += 1
    return tmpcount


def main():
    ap = argparse.ArgumentParser()
    # The zip is written on EVERY build, and --no-zip is the escape rather than --zip being the
    # opt-in it used to be. system.json's `download` points at that archive, so it is not a
    # convenience copy any more -- it is what Foundry fetches when someone presses Update. A build
    # that refreshed dist/ and left the zip alone would serve the previous version's code under the
    # new version's manifest, which is the one failure this whole mechanism exists to prevent.
    ap.add_argument("--zip", action="store_true",
                    help="deprecated: the zip is always written now, the flag is accepted and ignored")
    ap.add_argument("--no-zip", action="store_true",
                    help="skip the zip (for a scratch build that will not be committed)")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    # A clean build every time: a file deleted from the repository must not survive in the output.
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    print("building %s" % os.path.relpath(OUT, ROOT))
    tmptotal = 0
    for tmpsource, tmpdest in SHIPPED_DIRS:
        tmpsuffixes = {"module": [".mjs"], "templates": [".hbs"], "styles": [".css"],
                       "lang": [".json"]}.get(tmpsource, [".json"])
        tmpcount = copy_tree(os.path.join(ROOT, tmpsource), os.path.join(OUT, tmpdest), tmpsuffixes)
        print("  %-28s %4d files" % (tmpsource + "/", tmpcount))
        tmptotal += tmpcount
    for tmpsource, tmpdest in SHIPPED_FILES:
        tmpfrom = os.path.join(ROOT, tmpsource)
        if not os.path.exists(tmpfrom):
            problems.append("%s is named to ship and does not exist" % tmpsource)
            continue
        shutil.copy2(tmpfrom, os.path.join(OUT, tmpdest))
        print("  %-28s    1 file" % tmpsource)
        tmptotal += 1

    # A short note for whoever installs it, written here rather than kept as a file so it cannot
    # fall out of step with what the build actually contains.
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(INSTALL_NOTE.format(version=json.load(open(os.path.join(ROOT, "system.json"),
                                                            encoding="utf-8"))["version"]))

    # A stamp, so "is this build current?" is answerable by looking rather than by guessing. The
    # commit it was built from is the useful part: a deliverable is easy to hand over and forget,
    # and a stale one is worse than none.
    tmpcommit = ""
    try:
        tmpcommit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                                   capture_output=True, text=True).stdout.strip()
    except Exception:
        pass

    # ---------------------------------------------------------------------------------
    # @MARKER THE CHECK
    # Everything the shipped code asks Foundry to load, proved present in the output.
    with open(os.path.join(OUT, "system.json"), encoding="utf-8") as fh:
        tmpmanifest = json.load(fh)

    tmpwanted = set()
    for tmpkey in ("esmodules", "styles"):
        tmpwanted.update(tmpmanifest.get(tmpkey, []))
    for tmplanguage in tmpmanifest.get("languages", []):
        tmpwanted.add(tmplanguage["path"])

    # Every "systems/imagine-rpg/..." path written in the shipped code or templates.
    tmpreferenced = set()
    for tmpdir, _, tmpfiles in os.walk(OUT):
        for tmpfile in tmpfiles:
            if not tmpfile.endswith((".mjs", ".hbs")):
                continue
            with open(os.path.join(tmpdir, tmpfile), encoding="utf-8", errors="replace") as fh:
                for tmppath in re.findall(r'systems/%s/([A-Za-z0-9/._-]+)' % SYSTEM_ID, fh.read()):
                    tmpreferenced.add(tmppath)

    for tmppath in sorted(tmpwanted | tmpreferenced):
        tmpfull = os.path.join(OUT, tmppath.replace("/", os.sep))
        # A reference to a directory (the importer fetches documents by name from one) counts as
        # met when the directory is there and has something in it.
        if os.path.isdir(tmpfull):
            if not os.listdir(tmpfull):
                problems.append("%s is referenced and is empty" % tmppath)
            continue
        if not os.path.exists(tmpfull):
            problems.append("%s is referenced by the code and is NOT in the build" % tmppath)

    # The content the importer will build its packs from.
    tmpdocs = os.path.join(OUT, "src", "packs", "documents")
    tmpcounts = {}
    for tmpfile in sorted(os.listdir(tmpdocs)) if os.path.isdir(tmpdocs) else []:
        with open(os.path.join(tmpdocs, tmpfile), encoding="utf-8") as fh:
            tmpcounts[tmpfile[:-5]] = len(json.load(fh))

    # Nothing that belongs to the workshop rather than the game.
    for tmpdir, _, tmpfiles in os.walk(OUT):
        for tmpfile in tmpfiles:
            if tmpfile.endswith((".py", ".pyc")) or tmpfile in ("CLAUDE.md",):
                problems.append("%s should not ship" % os.path.relpath(os.path.join(tmpdir, tmpfile), OUT))

    tmpbytes = sum(os.path.getsize(os.path.join(tmpdir, tmpfile))
                   for tmpdir, _, tmpfiles in os.walk(OUT) for tmpfile in tmpfiles)

    print()
    print("  %d files, %.1f MB" % (tmptotal, tmpbytes / 1024 / 1024))
    print("  content: %s" % ", ".join("%s %d" % (k, v) for k, v in tmpcounts.items()))
    print("  total documents: %d" % sum(tmpcounts.values()))
    print("  every referenced path checked: %d" % len(tmpwanted | tmpreferenced))

    # @MARKER SYNTAX-CHECK DRIFT
    # tools/syntax-check.html holds a HARDCODED list of modules, because a static page cannot glob
    # its own directory -- so a module added without touching that list is never parse-checked, and
    # says nothing about it. Seven had drifted out of it by 2026-09-21, two of them written that
    # day and five months older, and the suite reported a cheerful 41 modules the whole time.
    # Reported here rather than left to be noticed again.
    tmpchecked = set(re.findall(r'"\.\./(module/[^"]+\.mjs)"',
                                open(os.path.join(ROOT, "tools", "syntax-check.html"),
                                     encoding="utf-8").read()))
    tmpmodules = set()
    for tmpdir, _, tmpfiles in os.walk(os.path.join(ROOT, "module")):
        for tmpfile in tmpfiles:
            if tmpfile.endswith(".mjs"):
                tmpmodules.add(os.path.relpath(os.path.join(tmpdir, tmpfile), ROOT).replace("\\", "/"))
    tmpunchecked = sorted(tmpmodules - tmpchecked)
    tmpstale = sorted(tmpchecked - tmpmodules)
    if tmpunchecked or tmpstale:
        print("  WARNING: tools/syntax-check.html is out of step with module/")
        for tmpname in tmpunchecked:
            print("     never parse-checked: %s" % tmpname)
        for tmpname in tmpstale:
            print("     listed but missing:  %s" % tmpname)
    else:
        print("  syntax-check covers all %d modules" % len(tmpmodules))

    # @MARKER RETIRED DOCUMENTS SWEEP AND CHOICES/BLANK SWEEP
    # See the @MARKER comments above main() for what each of these does and why one is a warning
    # and the other fails the build.
    check_retired_documents_complete()
    tmpresolvablechoicefields = check_choices_blank_sweep()
    check_document_choices(tmpresolvablechoicefields)

    if problems:
        print("\n  %d PROBLEM(S):" % len(problems))
        for tmpproblem in problems:
            print("    " + tmpproblem)
        raise SystemExit(1)
    print("  no problems")

    tmpstamp = [
        "Imagine RPG system build",
        "version   %s" % tmpmanifest["version"],
        "built     %s" % datetime.date.today().isoformat(),
        "commit    %s" % (tmpcommit or "unknown"),
        "files     %d" % tmptotal,
        "documents %d (%s)" % (sum(tmpcounts.values()),
                               ", ".join("%s %d" % (k, v) for k, v in tmpcounts.items())),
        "",
        "Rebuild with:  python tools/build_system.py",
        "If the commit above is not the current HEAD, this build is stale.",
        "",
    ]
    with open(os.path.join(OUT, "BUILD.txt"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(tmpstamp))

    if not args.no_zip:
        tmpzip = os.path.join(DIST, SYSTEM_ID + ".zip")
        with zipfile.ZipFile(tmpzip, "w", zipfile.ZIP_DEFLATED) as fh:
            for tmpdir, _, tmpfiles in os.walk(OUT):
                for tmpfile in tmpfiles:
                    tmpfull = os.path.join(tmpdir, tmpfile)
                    # Zipped WITHOUT the top folder, which is how Foundry's manual install expects
                    # it: the archive's contents go straight into Data/systems/imagine-rpg/.
                    fh.write(tmpfull, os.path.relpath(tmpfull, OUT))
        print("  wrote %s (%.1f MB)" % (os.path.relpath(tmpzip, ROOT),
                                        os.path.getsize(tmpzip) / 1024 / 1024))

    # @MARKER RELEASE CHECK
    # Foundry decides whether an update exists by comparing the version in the INSTALLED
    # system.json against the version in the one at the manifest URL. Nothing else is consulted --
    # not a date, not a hash, not the contents of the archive. So shipping changed code under an
    # unchanged version number is invisible: every existing install keeps reporting itself
    # up to date and nobody is ever offered the fix. That is precisely what happened on
    # 2026-09-20, twice, with a version that had read 0.1.0 since the file was created.
    #
    # Hence this check, and why it is a warning rather than a failure: building repeatedly without
    # bumping is the normal state of a working day, and only becomes a mistake at the moment the
    # build is committed and pushed.
    check_release_version(tmpmanifest["version"])


# This is the function which says whether this build could actually reach anybody. It compares the
# version being built against the version in the last commit, and only speaks up when shipped files
# have changed and the version has not -- the one combination that silently strands every install.
def check_release_version(tmpversion):
    tmphead = git_output(["git", "show", "HEAD:system.json"])
    if not tmphead:
        return
    try:
        tmpwas = json.loads(tmphead).get("version")
    except ValueError:
        return

    # Only the files that actually ship matter here. A change to docs/ or tools/ reaches nobody
    # through the system and needs no version bump.
    tmpchanged = [tmpline[3:] for tmpline in (git_output(["git", "status", "--porcelain"]) or "").splitlines()
                  if tmpline[3:].startswith(("module/", "templates/", "styles/", "lang/",
                                             "src/packs/", "system.json"))]
    if tmpversion != tmpwas:
        print("  version    %s (was %s at HEAD) -- this build is an update" % (tmpversion, tmpwas))
        return
    if not tmpchanged:
        print("  version    %s, unchanged, and no shipped file has changed" % tmpversion)
        return
    print("")
    print("  VERSION NOT BUMPED. %d shipped file(s) changed and system.json still says %s."
          % (len(tmpchanged), tmpversion))
    print("  Commit this as it stands and no existing install will ever be offered it:")
    print("  Foundry compares version numbers and nothing else. Raise the version in system.json")
    print("  before pushing, or this build reaches only a fresh manual install.")


# This is the function which runs a git command and returns its output, or None where git is not
# available or the command fails -- a build outside a checkout must still work.
#
# encoding="utf-8" is not optional here: git show'ing a historical src/packs/documents/*.json
# (the RETIRED DOCUMENTS SWEEP below does this a few hundred times) hits names with a real curly
# apostrophe ('Ba'Cora'). subprocess's text=True with no encoding falls back to the console's own
# codepage, cp1252 on this machine, which cannot represent that character at all -- it does not
# raise where you would notice, it corrupts silently on some Python builds and raises inside a
# background reader thread on others, and either way the string that comes back does not match
# the UTF-8 the rest of this codebase reads and writes everywhere else.
def git_output(tmpargs):
    try:
        tmpresult = subprocess.run(tmpargs, cwd=ROOT, capture_output=True, text=True, timeout=15,
                                    encoding="utf-8", errors="replace")
    except (OSError, subprocess.SubprocessError):
        return None
    return tmpresult.stdout if tmpresult.returncode == 0 else None


if __name__ == "__main__":
    main()
