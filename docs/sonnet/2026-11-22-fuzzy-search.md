# 2026-11-22 — forgiving item search

The judgement is done: `module/search-rules.mjs` (see DECISIONS, "A forgiving item search").
Left for a cheaper pass:

1. **Other name lists that filter by typing, if any appear.** Today only the item picker and the
   chargen shop have a search box. A new one should call `searchItemList(list, search, getName)`,
   not write its own `includes`. Done when the new box finds `Bow(Recurve)` from "recurve bow".
2. **CHANGELOG entry at the next release:** a short line, "Search forgives: words in any order,
   brackets and commas ignored, plurals and a typo forgiven, closest match first." Not written now
   because the release is cut when the user says push.
3. **A V14 look:** open Add weapon on a character, type "recurve bow" and "bow, recurve", and
   confirm Bow(Recurve) is the first row. Not checked in a running Foundry.

Decided, do not re-open: no fuzziness on 1-2 letter words, only a swap on 3-letter ones; the
stop-words list; ranking ties keep the list's own order.
