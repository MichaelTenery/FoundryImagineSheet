#!/usr/bin/env python3
"""
extract_sources.py -- work out which book each piece of content comes from, and what page.

Build-time tooling. Not shipped with the Foundry system.

WHY THIS EXISTS. His skill dictionary carries a sourcebook and a page per row, which is why
Animal Husbandry's sheet reads "Player's Guide 147". No other dictionary does. WEAPONVALUESLIST,
ARMORVALUESLIST, EQUIPVALUESLIST, the race and class tables and the trait lists have no such
column, so 3,715 of the 4,395 documents shipped with a blank sourcebook and a blank page.

HIS MASTER INDEX ANSWERS IT. `Nearly-master-index.pdf` is the "Imagine Master Index", version
0.976, his own consolidation of "all the disparate pieces of the Imagine Role Playing System ...
found across many books from the Player's Guide to the various Bestiaries". Its tables carry a
SOURCE COLUMN naming the originating book, and its own introduction says to "see the original
source material in the volumes indicated". That is his answer to this exact question, so under the
project's source-of-truth rule it outranks anything this tool could infer from the books' prose.

It also reaches books we do not have PDFs of at all -- Conquest of the Eternal, Legends of the
Unknown, Epitaph of the Fallen -- which is why Angel Sword could not be found in any of the four
books on disk. It is a Heroic Melee Weapon on Master Index page 326, and his table says so.

PROVEN BEFORE USE. Skills already carry his own sourcebook for all 680 rows, so this method was
run against them as a ground truth before being allowed to write anything. It reproduced his
answer 662 times out of the 664 it committed to -- 99%. The two it missed, Apparokinesis and
Shadow Form, appear in more than one book, so they are ambiguous rather than wrong. Re-run that
check any time this tool changes:

    python tools/extract/extract_sources.py --verify

WHAT IT WRITES. src/packs/named/itemSources.json, committed, mapping a content name to its book
and -- where a book's own index confirms it -- a page in that book. The extracted book text is
NOT committed (see .gitignore), so the map has to be a build artefact of its own: a checkout
without the PDFs must still be able to build the system with attribution intact. The map is a
name-to-book index, which is metadata about the books rather than their text.

Usage:
    python tools/extract/extract_sources.py            # rebuild the map
    python tools/extract/extract_sources.py --verify   # ground-truth it against skills
"""

import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
REFERENCE = os.path.join(ROOT, "docs", "reference")
OUTPATH = os.path.join(ROOT, "src", "packs", "named", "itemSources.json")

# @MARKER THE BOOKS
# How he abbreviates a book in a Source column, and the full title it means. He writes both
# "Players" and "Player's Guide" in the same column, so the prefix is what is matched on.
BOOK_PREFIXES = [
    #  prefix he writes        the title it means
    ("players",               "Player's Guide"),
    ("player",                "Player's Guide"),
    ("masters",               "Master's Manual"),
    ("master",                "Master's Manual"),
    ("aspects",               "Aspects of the Wild"),
    ("mysteries",             "Mysteries of the Planes"),
    ("legends",               "Legends of the Unknown"),
    ("epitaph",               "Epitaph of the Fallen"),
    ("conquest",              "Conquest of the Eternal"),
]

# TRIED AND REJECTED: preferring the earliest book he published when a name appears in several,
# on the reasoning that a thing is introduced in the base rules and referred back to later. It
# sounds right and it is wrong -- measured against his own skill answers it fell from 98% to 97%,
# because it drags anything the Player's Guide so much as mentions onto the Player's Guide
# (Discord, Geas, Harmony and Summon are all his, and all landed there). The first Source column
# in his page order is the better signal: his index lists a name in the section of the book that
# actually defines it. Do not re-litigate this without re-running --verify.

# The books whose own index we can read, and the offset between the PDF's page count and the
# page number PRINTED on the paper. His skill pages are printed numbers -- Animal Husbandry is
# 147 in the book, not the 165th sheet of the scan -- so everything here is converted to printed.
BOOK_INDEXES = [
    #  file stem                  title                       index pages (PDF)   pdf - printed
    ("players-guide",            "Player's Guide",            range(362, 367),    18),
    ("masters-manual",           "Master's Manual",           range(316, 320),    10),
    ("mysteries-of-the-planes",  "Mysteries of the Planes",   range(650, 657),     6),
    ("legends-of-the-unknown",   "Legends of the Unknown",    range(462, 466),     6),
    # Epitaph of the Fallen and Aspects of the Wild are NOT absent by oversight: both were
    # extracted and checked and neither carries a back-of-book index, so there is no page map in
    # them to read. Content of theirs is still attributed -- his Master Index names the book --
    # it simply cannot be given a page this way. Do not go looking for these again.
]

MASTER_INDEX = "master-index"


# @MARKER TEXT HANDLING

# This is the function which flattens the OCR's quotation marks and spacing so two spellings of
# the same name compare equal. His books use a backtick where an apostrophe belongs often enough
# that leaving them alone loses matches on every name with one in it.
def norm(tmpvalue):
    tmptext = str(tmpvalue)
    for tmpfrom, tmpto in (("’", "'"), ("‘", "'"), ("`", "'"),
                           ("“", '"'), ("”", '"'),
                           ("–", "-"), ("—", "-")):
        tmptext = tmptext.replace(tmpfrom, tmpto)
    return re.sub(r"\s+", " ", tmptext).strip().lower()


# This is the function which reads one extracted book into a page-numbered dictionary.
def load_book(tmpstem):
    tmppath = os.path.join(REFERENCE, "%s-fulltext.txt" % tmpstem)
    if not os.path.exists(tmppath):
        return None
    tmpparts = re.split(r"===== PAGE (\d+) =====", open(tmppath, encoding="utf8").read())
    return {int(tmpparts[i]): tmpparts[i + 1] for i in range(1, len(tmpparts), 2)}


# This is the function which strips a trailing range/distance number off a name, bare or in feet --
# "Infravision 60", "Infravision 60'" and "Infravision60" are all his Infravision entry crossed with
# a range column, the same relationship "Dagger(Parrying)" has to "Dagger", just without brackets to
# mark it. Returns None rather than a stem shorter than 3 characters, same floor as everywhere else.
def strip_number_suffix(tmpname):
    tmpmatch = re.match(r"^(.+?)\s*\d{1,3}['’]?$", tmpname)
    if tmpmatch and len(tmpmatch.group(1).strip()) > 2:
        return tmpmatch.group(1).strip()
    return None


# TRIED AND REJECTED: singularising a plain trailing plural ("Claws" -> "Claw"). It looked like the
# same shape as the number-suffix rule below, but his Master Index reads one cell to a line with no
# structure telling a body-parts table from a spell list or a Hermetic Lore ingredients table, and a
# bare singular is common enough prose ("spring water", "vulture feather", "suction pad" as alchemy
# ingredients) that it kept landing "Springs(Assorted)" and "Feathers" on his Hermetic Lore tables
# instead of on anything to do with equipment or creature anatomy -- wrong page, sometimes wrong book
# entirely. Exactly the bare-word risk the qualifier guard above exists for. Do not re-add it without
# a way to tell which table a hit came from.


# This is the function which turns one of his names into the spellings a book might print it as.
#
# He writes a qualifier in brackets -- "Dagger(Parrying)" -- where a book prints "Dagger, Parrying".
# A BARE QUALIFIER IS NEVER A VARIANT: letting "Boomerang(Wood)" match an index entry for "wood",
# or "Ballista(Light)" match "light", made two independent methods look like they disagreed five
# times out of five when they did not disagree at all. The base name alone is fair; the qualifier
# alone is not.
def variants(tmpname):
    tmpbase = str(tmpname).strip()
    tmpout = {tmpbase}
    tmpmatch = re.match(r"^([^(]+)\(([^)]*)\)$", tmpbase)
    if tmpmatch:
        tmpstem = tmpmatch.group(1).strip()
        tmpqual = tmpmatch.group(2).strip()
        tmpout |= {"%s, %s" % (tmpstem, tmpqual), "%s %s" % (tmpstem, tmpqual),
                   "%s %s" % (tmpqual, tmpstem), tmpstem}
        for tmppart in re.split(r"[/,]", tmpqual):
            tmppart = tmppart.strip()
            if tmppart:
                tmpout |= {"%s, %s" % (tmpstem, tmppart), "%s %s" % (tmpstem, tmppart)}
    else:
        tmpstem = tmpbase

    # Strips a trailing range number off a bare stem -- never off a bracketed qualifier, so the same
    # "no bare qualifier" guard above still holds for it.
    for tmpcandidate in (tmpbase, tmpstem):
        tmpnum = strip_number_suffix(tmpcandidate)
        if tmpnum:
            tmpout.add(tmpnum)

    return {norm(v) for v in tmpout if len(norm(v)) > 2}


# This is the function which strips his bracketed qualifier off, leaving the thing itself.
# "Breeches(Cloth)", "Breeches(Wool)" and "Breeches(Silk)" are one garment crossed with a
# materials table, not three entries in a book, so they inherit whatever the base name resolves to.
def base_name(tmpname):
    return re.sub(r"\(.*", "", str(tmpname)).strip()


# @MARKER READING HIS MASTER INDEX

# This is the function which reads the Source column out of one line of his tables.
def book_of(tmpline):
    tmpkey = norm(tmpline).split(",")[0].split("(")[0].strip()
    for tmpprefix, tmptitle in BOOK_PREFIXES:
        if tmpkey.startswith(tmpprefix):
            return tmptitle
    return None


# This is the function which indexes his Master Index: every name that begins a line, the page it
# is on, and the book his Source column gives it.
#
# The text layer arrives one cell to a line, so a table row is a name followed by its columns.
# Looking ahead a bounded number of lines for a book name finds the Source cell of THAT row --
# the bound is what stops a row with no Source of its own from borrowing the next row's.
def read_master_index(tmppages):
    tmprows = collections.defaultdict(list)
    for tmppage, tmptext in tmppages.items():
        tmplines = [l.strip() for l in tmptext.split("\n")]
        # The page number PRINTED on this sheet, read off the sheet itself rather than by
        # subtracting a fixed offset. His Master Index restarts its numbering partway through --
        # 424 sheets run five ahead of the printed folio and another 165 run nineteen ahead -- so
        # one global offset would be silently wrong for a sixth of the book.
        tmpfolio = None
        for tmpline in tmplines[:8]:
            if re.fullmatch(r"\d{1,3}", tmpline.strip()):
                tmpfolio = int(tmpline.strip())
                break
        for tmpat, tmpline in enumerate(tmplines):
            tmpname = norm(tmpline)
            if not (2 < len(tmpname) < 80):
                continue
            tmpbook = None
            for tmpahead in range(tmpat + 1, min(tmpat + 14, len(tmplines))):
                tmpbook = book_of(tmplines[tmpahead])
                if tmpbook:
                    break
            tmprows[tmpname].append((tmpfolio if tmpfolio is not None else tmppage, tmpbook))
    return tmprows


# @MARKER KIND-TAGGED TABLES
#
# WHY THIS EXISTS. read_master_index() above answers "what book is NAME in," which is ambiguous
# for the four Magic & Lore packs -- his rune Balance would take the Balance skill's page, and his
# spell Chill and invocation Chill are different entries on different pages (docs/sonnet/
# 2026-09-22-magic-lore-tab.md, item 6). Six of his tables print their OWN kind in the header and
# a Source column of their own, one row per line same as everywhere else in this file, so those six
# can be read into a kind-scoped index instead: (kind, name) -> [(page, book), ...], never merged
# into the name-only tmprows above, so a lookup here can never be satisfied by a different kind's
# row.
#
# FOUND: the sixteen spell-type tables (Alteration, Control, Create, ... Warding, each headed
# "Spell / Level / Source") plus the three "Roll (or select) / Offensive|Defensive|Utility Spell /
# Level / Source" tables all print kind "spell"; the thirteen Devotion tables ("Invocation / Level
# / Alignment / Source") print kind "invocation"; and "All Runes:", "Poems:", "Songs:" and
# "Ballads:" each head one table of their own kind ("Runes|Poem|Songs|Ballads / Rating / Modifier
# / Source"). Sixteen spell tables + three roll tables + thirteen invocation tables + four lore
# tables = 36 header hits, which is exactly what a count against the extracted text turns up.
#
# NOT FOUND, despite the plan in the hand-off note assuming herbs and potions would have their own
# tables the way spells and invocations do: no Herb, Elixir or Charm table anywhere in the index,
# and the one "Potion Costs" table (page 552 printed) carries Potion and Cost only -- no Source
# column, so it cannot name a book even where a name happens to match. Also not found: tables for
# candlelore, empathymagic, glyph, hymn, ritual, sympathymagic or evoke -- those are prose
# ("All Candle Lore Rituals", "Charms (All)", etc.), not one-row-per-line tables, so this method has
# nothing to read for them. Those eleven kinds are left XXX rather than guessed at.
KIND_TABLE_HEADERS = (
    # kind          the header cells, contiguous and lower-cased      row width  name  book
    ("spell",       ("spell", "level", "source"),                     3,         0,    2),
    ("invocation",  ("invocation", "level", "alignment", "source"),   4,         0,    3),
    ("rune",        ("runes", "rating", "modifier", "source"),        4,         0,    3),
    ("poem",        ("poem", "rating", "modifier", "source"),         4,         0,    3),
    ("song",        ("songs", "rating", "modifier", "source"),        4,         0,    3),
    ("ballad",      ("ballads", "rating", "modifier", "source"),      4,         0,    3),
)


# This is the function which recognises one of the header windows above (or the odd-one-out "Roll
# (or select) / <Something> Spell / Level / Source" header his three "roll a die" spell tables use)
# starting at tmpat, and returns (kind, row width, name column, book column, header length) or
# (None, 0, 0, 0, 0) if nothing starts there.
def match_kind_header(tmplower, tmpat):
    if (tmpat + 4 < len(tmplower) and tmplower[tmpat] == "roll" and tmplower[tmpat + 1] == "(or select)"
            and "spell" in tmplower[tmpat + 2] and tmplower[tmpat + 3] == "level"
            and tmplower[tmpat + 4] == "source"):
        return "spell", 4, 1, 3, 5
    for tmpkind, tmpheader, tmpwidth, tmpnameat, tmpbookat in KIND_TABLE_HEADERS:
        tmpn = len(tmpheader)
        if tmplower[tmpat:tmpat + tmpn] == list(tmpheader):
            return tmpkind, tmpwidth, tmpnameat, tmpbookat, tmpn
    return None, 0, 0, 0, 0


# This is the function which reads the six kind-tagged tables above into a (kind, name)-keyed
# index, the same shape as read_master_index() but never crossing kinds. A row is trusted only
# while its own book cell resolves through book_of() -- the first row that does not is the end of
# that table (its own next header, a "such-and-such:" label, or ordinary prose), and scanning just
# continues looking for the next header rather than guessing where the table restarts.
def read_kind_tables(tmppages):
    tmprows = collections.defaultdict(list)
    for tmppage, tmptext in tmppages.items():
        tmplines = [l.strip() for l in tmptext.split("\n")]
        tmplower = [norm(l) for l in tmplines]
        tmpfolio = None
        for tmpline in tmplines[:8]:
            if re.fullmatch(r"\d{1,3}", tmpline.strip()):
                tmpfolio = int(tmpline.strip())
                break
        tmppagenum = tmpfolio if tmpfolio is not None else tmppage

        tmpat = 0
        while tmpat < len(tmplines):
            tmpkind, tmpwidth, tmpnameat, tmpbookat, tmpheaderlen = match_kind_header(tmplower, tmpat)
            if not tmpkind:
                tmpat += 1
                continue
            tmpat += tmpheaderlen
            while tmpat + tmpwidth <= len(tmplines):
                tmprow = tmplines[tmpat:tmpat + tmpwidth]
                tmpname = norm(tmprow[tmpnameat])
                tmpbook = book_of(tmprow[tmpbookat])
                if not tmpbook or not (2 < len(tmpname) < 80):
                    break
                tmprows[(tmpkind, tmpname)].append((tmppagenum, tmpbook))
                tmpat += tmpwidth
    return tmprows


# The four Magic & Lore packs (docs/sonnet/2026-09-22-magic-lore-tab.md, item 6): a bare name is
# never trusted for these, in itemSources.json as much as in build_documents.py's KIND_KEYED_PACKS
# and the importer. Kept here, not imported, because this script runs standalone against
# src/packs/documents/*.json without depending on build_documents.py.
KIND_KEYED_SOURCE_PACKS = {"consumables", "lore", "spells", "invocations"}


# This is the function which says what kind one document of a kind-keyed pack answers to, for the
# "kind|Name" lookup -- fixed for spells and invocations (the whole pack is that one kind), read
# off the document's own "kind" field for consumables and lore (his herb/potion/elixir/charm and
# his eleven lores plus evokes). None means the document cannot be kind-keyed at all (an evoke, say
# -- see @MARKER KIND-TAGGED TABLES for which kinds have no table read at all), and is left XXX
# rather than matched some other way.
def doc_kind(tmppack, tmpdoc):
    if tmppack == "spells":
        return "spell"
    if tmppack == "invocations":
        return "invocation"
    if tmppack in ("consumables", "lore"):
        return tmpdoc.get("system", {}).get("kind") or None
    return None


# This is the function which decides one name's book and page, restricted to its OWN kind's
# tables -- resolve()'s kind-safe twin. Never falls back to a table of a different kind: no match
# here means XXX, not a guess from wherever the plain name happens to also appear.
#
# CAUGHT BY SPOT-CHECKING, NOT BY --verify: resolve() finds a real book's own PAGE by reading that
# book's back-of-book index off read_book_indexes() -- one alphabetical list per book, everything
# in it in one pot. That is fine for a bare name, but wrong here: Player's Guide's own back index
# gave the invocation Detect Evil page 104 (a skill of the same name) and the invocation Create
# Food page 243 (not even close to its actual 293), while its OWN "Invocations by Name" table
# (printed page 289 on) gives 295 and 293 respectively. A kind-keyed lookup asking that pot for a
# page is exactly the bare-name mistake this whole pass exists to stop making, just moved from the
# book to the page within it. So resolve_kind() does not call read_book_indexes() at all: the page
# it returns is only ever tmpmipage, his Master Index's own page for the row, carried up to
# apply_sources() as an "Imagine Master Index" citation when no Source-column book was found for
# it either. Reading Player's Guide's own "Spells (A-Z)" and "Invocations by Name (A-P)" tables the
# way read_book_indexes() reads a back index would recover a real page for these two kinds; nobody
# has written that yet, so a kind-keyed spell or invocation with a book carries no page rather than
# a wrong one.
def resolve_kind(tmpname, tmpkind, tmpkindrows):
    tmpbook = None
    tmpmipage = None
    for tmpvariant in variant_order(tmpname):
        for tmppage, tmpsource in tmpkindrows.get((tmpkind, tmpvariant), []):
            if tmpmipage is None:
                tmpmipage = tmppage
            if tmpsource and not tmpbook:
                tmpbook = tmpsource
        if tmpbook:
            break
    return tmpbook, tmpmipage


# This is the function which reads the back-of-book index out of the books we do hold, giving a
# name the PRINTED page it is discussed on. His own skill pages are printed numbers, so these are
# converted on the way in and everything downstream is in the same units.
def read_book_indexes():
    tmpout = {}
    for tmpstem, tmptitle, tmprange, _offset in BOOK_INDEXES:
        tmppages = load_book(tmpstem)
        if not tmppages:
            continue
        tmpfound = {}
        for tmppage in tmprange:
            for tmpline in tmppages.get(tmppage, "").split("\n"):
                tmpline = tmpline.strip()
                if not tmpline or tmpline.lower() == "index":
                    continue
                # "Name, 12, 34"  and his Master's Manual form "Name 12, 34"
                tmpmatch = re.match(r"^(.*?)[,\s]\s*(\d{1,3}(?:\s*[-,]\s*\d{1,3})*)\s*$", tmpline)
                if not tmpmatch:
                    continue
                tmpname = norm(tmpmatch.group(1)).rstrip(",")
                if len(tmpname) < 3 or tmpname.startswith("see "):
                    continue
                tmpfirst = re.match(r"\d{1,3}", tmpmatch.group(2).strip())
                if tmpfirst:
                    tmpfound.setdefault(tmpname, int(tmpfirst.group()))
        tmpout[tmptitle] = tmpfound
    return tmpout


# @MARKER RESOLUTION

# This is the function which puts a name's spellings in the order they are tried: longest first, as
# before, and then -- the part that was missing -- a FIXED order among spellings of the same length.
# variants() returns a set, and Python orders a set of strings differently on every run, so two
# spellings of equal length ("tongs(large)" and "tongs, large") used to win by chance: a rebuild on
# 2026-09-22 moved Tongs(Large) from his equipment price table (p.411) to a passing mention in a
# skill's tool list (p.442) with no change to the code. Among equals the book's own printed form
# ("Stem, Qualifier") goes first, because his bracketed spelling is how he writes a name in HIS
# lists and cross-references, while the book prints the table entry the comma way.
def variant_order(tmpname):
    return sorted(variants(tmpname), key=lambda tmpv: (-len(tmpv), "(" in tmpv, tmpv))


# This is the function which decides one name's book and page.
#
# The book comes from his Master Index. The page comes from the originating book's OWN index, and
# only when that index is the book he named -- a page number from the wrong book is worse than no
# page at all, so the two have to agree before a page is recorded.
def resolve(tmpname, tmprows, tmpindexes):
    tmpbook = None
    tmpmipage = None
    for tmpvariant in variant_order(tmpname):
        for tmppage, tmpsource in tmprows.get(tmpvariant, []):
            if tmpmipage is None:
                tmpmipage = tmppage
            if tmpsource and not tmpbook:
                tmpbook = tmpsource
        if tmpbook:
            break

    tmppage = ""
    if tmpbook and tmpbook in tmpindexes:
        for tmpvariant in variant_order(tmpname):
            if tmpvariant in tmpindexes[tmpbook]:
                tmppage = str(tmpindexes[tmpbook][tmpvariant])
                break
    return tmpbook, tmppage, tmpmipage


# @MARKER GROUND TRUTH

# This is the function which proves the method against the one pack that already knows the answer.
# Skills carry his own sourcebook on all 680 rows. If this cannot recover what he already told us,
# it has no business writing the 3,715 answers he did not.
def verify(tmprows, tmpindexes):
    tmpskills = json.load(open(os.path.join(ROOT, "src", "packs", "documents", "skills.json"),
                               encoding="utf8"))
    tmpstat = collections.Counter()
    tmpmisses = []
    for tmpskill in tmpskills:
        tmptruth = str(tmpskill["system"].get("sourcebook", "")).replace("`", "'")
        if not tmptruth or tmptruth == "?":
            tmpstat["no answer of his to check"] += 1
            continue
        tmpbook, _page, tmpmipage = resolve(tmpskill["name"], tmprows, tmpindexes)
        if not tmpbook:
            tmpstat["not in his index" if tmpmipage is None else "found, no Source column"] += 1
            continue
        if tmpbook == tmptruth:
            tmpstat["CORRECT"] += 1
        else:
            tmpstat["WRONG"] += 1
            if len(tmpmisses) < 12:
                tmpmisses.append((tmpskill["name"], tmptruth, tmpbook))

    print("Ground truth -- his own sourcebook on %d skills:" % len(tmpskills))
    for tmpkind, tmpcount in tmpstat.most_common():
        print("   %-30s %5d" % (tmpkind, tmpcount))
    tmpdecided = tmpstat["CORRECT"] + tmpstat["WRONG"]
    if tmpdecided:
        print("\n   committed to a book %d times, right %d of them -- %d%%"
              % (tmpdecided, tmpstat["CORRECT"], 100 * tmpstat["CORRECT"] // tmpdecided))
    if tmpmisses:
        print("\n   disagreements (his answer, then ours):")
        for tmpmiss in tmpmisses:
            print("      %-28s %-26s %s" % tmpmiss)
    return tmpstat


# @MARKER MAIN

def main():
    tmppages = load_book(MASTER_INDEX)
    if not tmppages:
        print("docs/reference/%s-fulltext.txt is not there. Extract it first:" % MASTER_INDEX)
        print('   python tools/extract/extract_book_text.py "<Nearly-master-index.pdf>" master-index')
        return 1

    print("reading his Master Index (%d pages)..." % len(tmppages))
    tmprows = read_master_index(tmppages)
    tmpkindrows = read_kind_tables(tmppages)
    tmpindexes = read_book_indexes()
    print("   %d distinct names, %d kind-tagged rows, %d book indexes for page numbers"
          % (len(tmprows), len(tmpkindrows), len(tmpindexes)))

    if "--verify" in sys.argv:
        verify(tmprows, tmpindexes)
        return 0

    # Every name the system ships, resolved once. Variants inherit their base name's answer, so
    # the 719 armour rows do not each have to be found: "Breeches" carries all of its materials.
    tmpout = {}
    tmpstat = collections.Counter()
    tmppackdir = os.path.join(ROOT, "src", "packs", "documents")
    for tmpfile in sorted(os.listdir(tmppackdir)):
        if not tmpfile.endswith(".json"):
            continue
        tmppack = tmpfile[:-len(".json")]
        tmpdocs = json.load(open(os.path.join(tmppackdir, tmpfile), encoding="utf8"))
        for tmpdoc in tmpdocs:
            tmpname = tmpdoc["name"]

            # The four Magic & Lore packs: a bare name is never enough (see @MARKER KIND-TAGGED
            # TABLES), so these are looked up as "kind|Name" against read_kind_tables() above and
            # never fall through to the name-only resolve() below.
            if tmppack in KIND_KEYED_SOURCE_PACKS:
                tmpkind = doc_kind(tmppack, tmpdoc)
                if not tmpkind:
                    tmpstat["no kind to key on"] += 1
                    continue
                tmpkey = "%s|%s" % (tmpkind, tmpname)
                if tmpkey in tmpout:
                    continue
                tmpkbook, tmpkmi = resolve_kind(tmpname, tmpkind, tmpkindrows)
                if tmpkbook:
                    # No page -- see resolve_kind()'s own comment for why a kind-keyed lookup does
                    # not trust the book's generic back-of-book index for one.
                    tmpout[tmpkey] = {"sourcebook": tmpkbook}
                    tmpstat["a book of his (kind-keyed)"] += 1
                elif tmpkmi is not None:
                    tmpout[tmpkey] = {"sourcebook": "Imagine Master Index", "page": str(tmpkmi)}
                    tmpstat["his Master Index (kind-keyed)"] += 1
                else:
                    tmpstat["NO SOURCE FOUND (kind-keyed)"] += 1
                continue

            if tmpname in tmpout:
                continue
            tmpbook, tmppage, tmpmi = resolve(tmpname, tmprows, tmpindexes)
            if not tmpbook:
                tmpbase = base_name(tmpname)
                tmpbook, tmppage, tmpbasemi = resolve(tmpbase, tmprows, tmpindexes)
                if tmpmi is None:
                    tmpmi = tmpbasemi
                if tmpbook:
                    tmpstat["by base name"] += 1

            if tmpbook:
                # His Source column named the originating book.
                tmpout[tmpname] = {"sourcebook": tmpbook}
                if tmppage:
                    tmpout[tmpname]["page"] = tmppage
                    tmpstat["with a page too"] += 1
                tmpstat["a book of his"] += 1
            elif tmpmi is not None:
                # He lists it, but that table carries no Source column -- his Heroic Melee
                # Weapons table is name and stats and nothing else, which is why Angel Sword
                # has no book. The Master Index is itself a source of his and a real place to
                # look the thing up, so it is cited as one rather than thrown away.
                tmpout[tmpname] = {"sourcebook": "Imagine Master Index", "page": str(tmpmi)}
                tmpstat["his Master Index"] += 1
            else:
                tmpstat["NO SOURCE FOUND"] += 1

    tmppayload = {
        "_source": {
            "file": "Imagine Master Index (Nearly-master-index.pdf), version 0.976",
            "author": "W. Michael Tenery III",
            "tool": "tools/extract/extract_sources.py",
        },
        "_note": ("Which book each piece of content comes from, out of the Source column of HIS "
                  "Master Index. A page is recorded only where the named book's own index "
                  "confirms it, so a page never belongs to a different book than the sourcebook "
                  "beside it. Names absent here were not found in his index and are marked XXX "
                  "by build_documents.py. An entry keyed \"kind|Name\" (spell|, invocation|, "
                  "rune|, poem|, song| or ballad|) comes from one of the six kind-tagged tables "
                  "his consumables, lore, spells and invocations packs need -- a bare name is "
                  "ambiguous across their kinds, so these are never looked up any other way; see "
                  "KIND_TABLE_HEADERS and docs/sonnet/2026-09-22-magic-lore-tab.md item 6. "
                  "Regenerate with tools/extract/extract_sources.py."),
        "entries": dict(sorted(tmpout.items())),
    }
    json.dump(tmppayload, open(OUTPATH, "w", encoding="utf8"), indent=1, ensure_ascii=False)

    print("\nwrote %s" % os.path.relpath(OUTPATH, ROOT))
    for tmpkind, tmpcount in tmpstat.most_common():
        print("   %-24s %5d" % (tmpkind, tmpcount))
    return 0


if __name__ == "__main__":
    sys.exit(main())
