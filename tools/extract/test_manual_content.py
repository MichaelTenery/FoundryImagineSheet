#!/usr/bin/env python3
"""
test_manual_content.py -- regression check for apply_manual_content (build_documents.py).

Build-time tooling. Not shipped with the Foundry system.

docs/sonnet/2026-09-19-adding-content.md item 2: the hand-authored-content loader
(apply_manual_content, tools/extract/build_documents.py) had no test at all. This exercises the
four outcomes docs/ADDING-CONTENT.md promises a Game Master, once per pack so a pack-specific
schema quirk cannot hide a break in the shared logic:

    add                a brand-new name is added, tagged sourcebook "Custom"
    override            "_override": true lays only the given fields over his; siblings survive
    collision            a same-name entry with no "_override" is left alone and reported
    unknown field       a misspelt field name is reported rather than silently written

It runs against a TEMPORARY COPY of src/packs/manual/, never the real thing -- MANUAL_DIR is
monkeypatched to point at the copy for the run and restored afterwards, and this file checksums
every real manual/*.json before and after to prove none of them moved.

No test framework: there is no Node on this machine and the browser suites are the JS test
pattern, so this is plain `python`, asserts, and a PASS/FAIL line per check.

Usage:
    python tools/extract/test_manual_content.py
"""

import hashlib
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REAL_MANUAL_DIR = os.path.join(HERE, "..", "..", "src", "packs", "manual")

sys.path.insert(0, HERE)
import build_documents as bd  # noqa: E402 -- must follow the sys.path insert


# @MARKER RESULT COLLECTION
# One line per check, printed at the end the way the browser suites report PASS/FAIL, so this can
# be read at a glance and so a caller scraping the output for a count sees the same shape.
results = []


def check(tmplabel, tmpcondition, tmpdetail=""):
    results.append((tmplabel, bool(tmpcondition), tmpdetail))


# @MARKER MANUAL DIRECTORY UNTOUCHED
# Hashed before and after rather than merely "not opened for writing" -- apply_manual_content only
# ever reads MANUAL_DIR, but the checksum is what actually proves nothing in src/packs/ moved,
# which is the promise this test exists to keep.
def hash_real_manual_files():
    tmphashes = {}
    for tmpname in sorted(os.listdir(REAL_MANUAL_DIR)):
        if not tmpname.endswith(".json"):
            continue
        with open(os.path.join(REAL_MANUAL_DIR, tmpname), "rb") as fh:
            tmphashes[tmpname] = hashlib.sha256(fh.read()).hexdigest()
    return tmphashes


# This is the function which picks the one example entry a manual file carries under "_example",
# skipping its "_note" key -- the same shape every src/packs/manual/<pack>.json file uses.
def example_entry(tmppayload):
    for tmpkey, tmpvalue in tmppayload.get("_example", {}).items():
        if tmpkey != "_note":
            return tmpkey, tmpvalue
    return None, None


# This is the function which builds a value that is clearly NOT the original, for whatever type
# the original field happens to be -- a scalar gets a sentinel string, a list is replaced whole
# (as merge_fields always replaces a list whole), and a dict gets one new key added alongside its
# existing ones so the override test can tell "this key changed" from "this key was wiped".
def changed_value(tmporiginal):
    if isinstance(tmporiginal, dict):
        tmpout = dict(tmporiginal)
        tmpout["__test_override_marker__"] = True
        return tmpout
    if isinstance(tmporiginal, list):
        return ["__test_override_marker__"]
    return "__test_override_marker__"


# This is the function which runs the four checks against one pack, using that pack's own
# _example entry so every field name is valid for its schema -- schema_field_names reads the real
# module/data/item-<type>.mjs, which is not monkeypatched, so an invented field name would be
# indistinguishable from a real typo and a real field name from that pack's own example is not.
def run_pack(tmppack):
    tmpdoctype, _ = bd.PACK_TYPES[tmppack]
    tmppath = os.path.join(bd.MANUAL_DIR, tmppack + ".json")
    with open(tmppath, encoding="utf-8") as fh:
        tmppayload = json.load(fh)

    tmpexamplename, tmpexamplefields = example_entry(tmppayload)
    if tmpexamplename is None:
        check("%s: has an _example to test against" % tmppack, False, "no _example entry found")
        return

    # Pick one top-level field to override, and remember every OTHER top-level field so the
    # override test can assert they survived untouched -- "override applied to its field only".
    tmpoverridekey = sorted(tmpexamplefields)[0]
    tmpoverridevalue = changed_value(tmpexamplefields[tmpoverridekey])
    tmpothersiblingkeys = [k for k in tmpexamplefields if k != tmpoverridekey]

    # "His data" -- the documents apply_manual_content is merging ONTO, standing in for what
    # build_skills()/build_races()/etc. would have produced. One document under the example's own
    # name (the override target) and one under a second name (the collision target).
    tmpexistingdoc = bd.make_doc(tmpexamplename, tmpdoctype, dict(tmpexamplefields))
    tmpcollisiontarget = bd.make_doc("Already Present " + tmppack, tmpdoctype, {})
    tmpdocs = [tmpexistingdoc, tmpcollisiontarget]

    tmpnewname = "Brand New " + tmppack
    tmptyponame = "Typo Entry " + tmppack

    tmppayload["entries"] = {
        # add: a name that does not collide with anything in tmpdocs.
        tmpnewname: {tmpoverridekey: tmpexamplefields[tmpoverridekey]},
        # override: the existing doc's own name, with "_override" and one changed field.
        tmpexamplename: {"_override": True, tmpoverridekey: tmpoverridevalue},
        # collision: the second existing doc's name, no "_override" at all.
        tmpcollisiontarget["name"]: {tmpoverridekey: tmpexamplefields[tmpoverridekey]},
        # unknown field: a brand-new name, so this is also implicitly an "add", carrying a field
        # name that is not a real field of this pack's schema.
        tmptyponame: {"zzzNotARealFieldOnAnySchema": "oops"}
    }
    with open(tmppath, "w", encoding="utf-8") as fh:
        json.dump(tmppayload, fh)

    tmpbeforeissues = len(bd.issues)
    tmpresult = bd.apply_manual_content(tmppack, tmpdocs)
    tmpnewissues = bd.issues[tmpbeforeissues:]
    tmpbyname = {tmpdoc["name"]: tmpdoc for tmpdoc in tmpresult}
    tmpkinds = [tmpissue["kind"] for tmpissue in tmpnewissues]

    # -- add --
    tmpadded = tmpbyname.get(tmpnewname)
    check("%s: add creates the new document" % tmppack, tmpadded is not None)
    if tmpadded is not None:
        check("%s: add is tagged sourcebook Custom" % tmppack,
              tmpadded["system"].get("sourcebook") == "Custom", tmpadded["system"].get("sourcebook"))

    # -- override --
    tmpoverridden = tmpbyname.get(tmpexamplename)
    check("%s: override changes the given field" % tmppack,
          tmpoverridden is not None and tmpoverridden["system"].get(tmpoverridekey) == tmpoverridevalue)
    tmpsiblingsintact = all(
        tmpoverridden["system"].get(tmpkey) == tmpexamplefields[tmpkey] for tmpkey in tmpothersiblingkeys
    ) if tmpoverridden is not None else False
    check("%s: override leaves sibling fields alone" % tmppack, tmpsiblingsintact or not tmpothersiblingkeys)
    check("%s: override is reported" % tmppack, "manual-override" in tmpkinds)

    # -- collision --
    tmpcollided = tmpbyname.get(tmpcollisiontarget["name"])
    check("%s: collision without _override is left alone" % tmppack,
          tmpcollided is not None and tmpcollided["system"] == {})
    check("%s: collision is reported" % tmppack, "manual-ignored" in tmpkinds)

    # -- unknown field --
    check("%s: typo'd field name is reported" % tmppack, "manual-unknown-field" in tmpkinds)
    check("%s: entry with the typo is still added" % tmppack, tmptyponame in tmpbyname)


def main():
    tmpbefore = hash_real_manual_files()

    tmpwaswritedir = bd.MANUAL_DIR
    tmptempdir = tempfile.mkdtemp(prefix="imagine-manual-test-")
    try:
        shutil.copytree(REAL_MANUAL_DIR, tmptempdir, dirs_exist_ok=True)
        bd.MANUAL_DIR = tmptempdir

        for tmppack in bd.PACK_TYPES:
            bd.issues = []
            run_pack(tmppack)
    finally:
        bd.MANUAL_DIR = tmpwaswritedir
        shutil.rmtree(tmptempdir, ignore_errors=True)

    tmpafter = hash_real_manual_files()
    check("src/packs/manual/ is untouched", tmpbefore == tmpafter,
          "" if tmpbefore == tmpafter else "a real manual file's checksum changed")

    tmpfailed = [r for r in results if not r[1]]
    for tmplabel, tmppassed, tmpdetail in results:
        print("%-60s %s%s" % (tmplabel, "PASS" if tmppassed else "FAIL",
                               ("  (%s)" % tmpdetail) if tmpdetail and not tmppassed else ""))
    print()
    print("%d checks, %d passed, %d failed" % (len(results), len(results) - len(tmpfailed), len(tmpfailed)))

    if tmpfailed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
