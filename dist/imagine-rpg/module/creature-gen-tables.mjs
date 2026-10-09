// @START (CODE)
// @MARKER CREATURE GENERATOR TABLES
//==================================================================================================================
// The figures a creature is designed from: the Master's Manual's "Designing Creatures" chapter, its
// Creature Creation Guide (MM pp.281-298, "The Creature Creation Guide"), and his own creature
// experience tables (calcCreatureExp and its helpers, sheet-worker.js:175518-176185, which carry the
// Master's Manual p.181 combat-experience table WITH the errata's level 0 row already in them).
//
// His Roll20 sheet has no creature DESIGNER -- his Configurator (CREATURE CONFIGURATOR FINISH ACTION,
// 23879, and handleCreatureFinish, 174660) takes a finished stat block and files it. The design rules
// live only in the book, so this is the one place the book is the first source for a mechanic: the
// sheet has nothing to say, and the errata's two corrections to the chapter (the hide cap, p.290, and
// Enhanced Affinity, p.294) are applied where they fall. See docs/DECISIONS.md 2026-10-07, "A Create
// Creature window".
//
// Every table is transcribed from the chapter, page given per table, and PDF reading slips corrected
// where the arithmetic makes the right figure plain (noted where done). Hand-maintained, not generated.
//
// The book's own caveat heads the chapter and is kept here: "Guidelines are not hard and fast rules,
// and the designer has some freedom in modifying the numbers where they do not make good sense."
// Every figure the generator works out can be overridden on its step for that reason.
//==================================================================================================================

// @MARKER POWER POINTS
// "for every full 40 PP, the creature should have one level added to its base level." (MM p.281)
export const POWER_POINTS_PER_LEVEL = 40;

// @MARKER CLIMATES AND HABITATS
// The chapter's own lists (MM p.281), offered as suggestions under free-text fields: the bestiaries
// write things no list holds.
export const CLIMATES = [
	"Desert", "Highland (mountain)", "Humid Continental", "Humid Oceanic", "Humid Subtropical (jungle)",
	"Icecap (polar)", "Semiarid", "Subtropical Dry Summer", "Tropical Wet (rain forest)",
	"Tropical Wet and Dry", "Tundra"
];
export const HABITATS = [
	"Coastal", "Desert", "Exotic (clouds)", "Exotic (elemental)", "Exotic (magical places)",
	"Exotic (other planar)", "Exotic (space/ether)", "Exotic (subterranean sea)", "Forest", "Hills",
	"Jungle", "Lake", "Marsh", "Mountain", "Ocean/Sea (deep)", "Ocean/Sea (floor)",
	"Ocean/Sea (middle depths)", "Ocean/Sea (near surface)", "Ocean/Sea (surface)", "Plains", "Polar",
	"Rain forest", "River", "Savanna", "Scrubland", "Subterranean (deep)", "Subterranean (near surface)",
	"Swamp", "Tundra", "Wasteland"
];

// @MARKER BODY FAMILIES
// Which of the chapter's body-type families each of his 45 body types (CREATURE_BODY_TYPES,
// creature-tables.mjs) belongs to. The family decides the weight multiplier (MM p.284), which
// size table is read (humanoid or animal, pp.284-285), which walking table (p.288) and which speed
// modifier table (p.288), and whether the creature "walks", "crawls" or "swims".
//
//   kind       "humanoid" reads the Humanoid/Avian/Saurian size and Endurance rows; "animal" the rest
//   weight     the body-type weight multiplier (MM p.284 "Body Type -- Multiply the Base Weight by")
//   walk       which base walking table: "humanoid", "quadruped", "crawl", "tiny" or "" (none: the
//              Game Master enters movement)
//   speedMods  which speed-modifier table: "humanoid", "quadruped", "insect", "crawl"
//   gait       the name of the base movement mode
//                                 kind        weight  walk        speedMods   gait
export const BODY_FAMILIES = {
	"Humanoid":                  [ "humanoid", 1,      "humanoid", "humanoid", "Walk"  ],
	"Avian":                     [ "humanoid", 1,      "humanoid", "humanoid", "Walk"  ],
	"Saurian":                   [ "humanoid", 1,      "humanoid", "humanoid", "Walk"  ],
	"Centaur":                   [ "animal",   2,      "quadruped","quadruped","Walk"  ],
	"Bird":                      [ "animal",   0.5,    "humanoid", "humanoid", "Walk"  ],
	"Quadruped":                 [ "animal",   6,      "quadruped","quadruped","Walk"  ],
	"Reptile":                   [ "animal",   1,      "quadruped","quadruped","Walk"  ],
	"Insect":                    [ "animal",   0.25,   "quadruped","insect",   "Walk"  ],
	"Spider":                    [ "animal",   0.5,    "quadruped","insect",   "Walk"  ],
	"Fish":                      [ "animal",   0.75,   "humanoid", "humanoid", "Swim"  ],
	"Sea Mammal":                [ "animal",   1,      "humanoid", "humanoid", "Swim"  ],
	"Mollusk":                   [ "animal",   2,      "crawl",    "crawl",    "Crawl" ],
	"Snake/Worm":                [ "animal",   0.1,    "crawl",    "crawl",    "Crawl" ],
	"Segmented Worm":            [ "animal",   0.5,    "crawl",    "crawl",    "Crawl" ],
	"Small":                     [ "animal",   1,      "quadruped","quadruped","Walk"  ],
	"Tiny":                      [ "animal",   1,      "tiny",     "",         "Crawl" ],
	"Plant":                     [ "animal",   1,      "",         "",         ""      ],
	"Amorphous":                 [ "animal",   1,      "crawl",    "crawl",    "Flow"  ],
	"Insubstantial":             [ "animal",   1,      "",         "",         ""      ]
};

// His 45 body types, each to its family. Everything "Humanoid(...)" is Humanoid; Arachen, Brachara and
// Scethen are his own humanoid races' charts; Floating Orb has no walking table and is entered by hand.
export const BODY_TYPE_FAMILY = {
	"Amorphous/Sectional": "Amorphous", "Arachen": "Humanoid", "Bird": "Bird", "Brachara": "Humanoid",
	"Centaur": "Centaur", "Crustacean": "Spider", "Custom": "Humanoid", "Fish": "Fish",
	"Floating Orb": "Insubstantial", "Giant Insect": "Insect", "Giant Insect(Wings)": "Insect",
	"Giant Spider": "Spider", "Humanoid": "Humanoid", "Humanoid(Fish Tail)": "Humanoid",
	"Humanoid(Hooves)": "Humanoid", "Humanoid(Hooves/Tail)": "Humanoid", "Humanoid(Tail)": "Humanoid",
	"Humanoid(Large Tail)": "Humanoid", "Humanoid(Wings)": "Avian", "Humanoid(Wings/Tail)": "Avian",
	"Humanoid(Wings/Large Tail)": "Avian", "Humanoid(Hooves/Wings/Tail)": "Avian",
	"Humanoid(Hooves/Wings/Large Tail)": "Avian", "Insectoid": "Insect", "Insectoid(Wings)": "Insect",
	"Insectoid(Wings/Stinger)": "Insect", "Insubstantial(None)": "Insubstantial", "Mollusk": "Mollusk",
	"Mollusk(No Limbs)": "Mollusk", "Plant": "Plant", "Quadruped": "Quadruped", "Quadruped(Tail)": "Quadruped",
	"Quadruped(Wings)": "Quadruped", "Quadruped(Tail/Wings)": "Quadruped", "Reptile": "Reptile",
	"Saurian": "Saurian", "Scethen": "Humanoid", "Sea Mammal": "Sea Mammal",
	"Sea Mammal(Dorsal Finned)": "Sea Mammal", "Sea Mammal(Tusk)": "Sea Mammal", "Segmented Worm": "Segmented Worm",
	"Small": "Small", "Snake": "Snake/Worm", "Snake(Arms)": "Snake/Worm", "Tiny": "Tiny", "Tree": "Plant"
};

// @MARKER HEIGHT AND WEIGHT
// "Height/Length -- Base Weight -- Range" (MM p.284). Height in inches (the top of each band), the base
// weight as dice, and the book's own printed range so an average can be taken without rolling. A base
// weight is then multiplied by the body type, the frame and the form.
//
// Two of the book's rows are read as the arithmetic says rather than as the PDF prints: "2' 6" - 2' 11"
// 24 + 8d4 (32-56)" is kept (the range is right for 8d4); "7' - 7' 11"" is one row where the book
// jumps to a one-foot band. Beyond 100' the book says only "100,000+".
//                        up to (inches)  dice           low     high
export const BASE_WEIGHT_BY_HEIGHT = [
	[   4,   "1d4",          1,     4      ],
	[  11,   "1d10/2+6",     7,     11     ],
	[  17,   "1d6+10",       11,    16     ],
	[  23,   "1d10/2+15",    16,    20     ],
	[  29,   "1d10+25",      26,    35     ],
	[  35,   "8d4+24",       32,    56     ],
	[  41,   "1d20+40",      41,    60     ],
	[  47,   "3d10+58",      61,    88     ],
	[  53,   "6d6+78",       84,    114    ],
	[  59,   "8d6+83",       91,    131    ],
	[  65,   "10d10+91",     101,   191    ],
	[  71,   "10d6+121",     131,   181    ],
	[  77,   "10d12+151",    161,   271    ],
	[  83,   "12d6+189",     201,   261    ],
	[  95,   "10d10+251",    261,   361    ],
	[  107,  "15d12+286",    301,   466    ],
	[  119,  "15d20+400",    415,   715    ],
	[  131,  "15d20+550",    565,   850    ],
	[  143,  "15d20+700",    715,   1000   ],
	[  155,  "15d20+800",    815,   1100   ],
	[  167,  "15d20+900",    915,   1200   ],
	[  179,  "15d20+1000",   1015,  1300   ],
	[  191,  "15d20+1100",   1115,  1400   ],
	[  215,  "15d100+1750",  1765,  3250   ],
	[  239,  "15d100+2500",  2515,  4000   ],
	[  299,  "20d100+3250",  3270,  5250   ],
	[  359,  "20d100+4000",  4020,  6000   ],
	[  419,  "30d100+6000",  6030,  9000   ],
	[  479,  "40d100+8000",  8040,  12000  ],
	[  539,  "50d100+10000", 10050, 15000  ],
	[  599,  "20d100x10+10000", 12000, 30000 ],
	[  899,  "30d100x10+20000", 23000, 50000 ],
	[  1200, "50d100x10+50000", 55000, 100000 ]
];
// "100'+ -- 100,000+": nothing to roll; the Game Master enters it.
export const BASE_WEIGHT_BEYOND_TABLE = 100000;

// "Frame" (MM p.284): the base weight is also multiplied by the frame.
//                        label           multiplier  examples
export const FRAMES = [
	[ "Wispy",            0.5,   "Hummingbird, Fairy" ],
	[ "Light",            0.75,  "Elf, Greyhound, Bream, Tree Snake" ],
	[ "Medium",           1,     "Human, Wolf, Bass, Ground Snake" ],
	[ "Heavy",            1.25,  "Charger, Bull, Dwarf, Water Snake" ],
	[ "Extra Heavy",      1.5,   "Elephant, Rhino, Whale, Giant" ]
];

// "Additional Weight Modifiers for Forms" (MM p.284). Solid is the book's unstated default of x1.
//                        label                         multiplier  examples
export const FORMS = [
	[ "Solid",                       1,     "" ],
	[ "Gaseous (greatly dispersed)", 0.1,   "Gaseous Form" ],
	[ "Skeletal (dispersed weight)", 0.25,  "Skeletal Form" ],
	[ "Dense",                       2,     "Partial stone, or made of all wood" ],
	[ "Very Dense",                  4,     "Creature made of stone; Stone Golem" ],
	[ "Incredibly Dense",            6,     "Creature made of metal; Iron Golem" ]
];

// @MARKER BODY SIZE
// "Final body weight and size" (MM pp.284-285): a weight's size classification, the humanoid table
// for Humanoids, Avians and Saurians and the animal table for everything else. The sizes are the
// CREATURE_SIZES of creature-tables.mjs (Divine Being is never reached by weight). "Minuscule" is the
// animal table's "Insect" row, the chapter's own word for it on the Endurance and attack tables.
//                        up to (lb)   size             example
export const HUMANOID_SIZES = [
	[ 19,      "Tiny",          "Imp, Fairy" ],
	[ 75,      "Small",         "Midfolk" ],
	[ 150,     "Medium Small",  "Elf" ],
	[ 250,     "Medium",        "Human" ],
	[ 500,     "Medium Large",  "Saurian" ],
	[ 800,     "Large",         "Ogre" ],
	[ 1000,    "Very Large",    "Troll" ],
	[ 1300,    "Huge",          "Small Giant" ],
	[ 1800,    "Giant",         "Civilized Giant" ],
	[ 4000,    "Mammoth",       "Mountain Giant" ],
	[ 8000,    "Gargantuan",    "Cloud Giant" ],
	[ Infinity,"Titanic",       "Titan" ]
];
export const ANIMAL_SIZES = [
	[ 0.125,   "Minuscule",     "Spider, Fly" ],
	[ 1,       "Tiny",          "Mouse, Vole" ],
	[ 5,       "Small",         "Squirrel, Rat" ],
	[ 100,     "Medium Small",  "Small Dog" ],
	[ 300,     "Medium",        "Wolf" ],
	[ 600,     "Medium Large",  "Alligator" ],
	[ 900,     "Large",         "Winter Wolf, Bear" ],
	[ 1500,    "Very Large",    "Dire Wolf, Lion" ],
	[ 2500,    "Huge",          "Griffon, Warhorse" ],
	[ 7500,    "Giant",         "Manticore" ],
	[ 15000,   "Mammoth",       "Elephant" ],
	[ 50000,   "Gargantuan",    "Giant Worm" ],
	[ Infinity,"Titanic",       "Dragon" ]
];

// The sizes in order, smallest first, for walking the attack and movement tables. Minuscule is
// below Tiny; Divine Being is above Titanic and appears only on the attribute tables.
export const SIZE_ORDER = [
	"Minuscule", "Tiny", "Small", "Medium Small", "Medium", "Medium Large", "Large", "Very Large",
	"Huge", "Giant", "Mammoth", "Gargantuan", "Titanic", "Divine Being"
];

// @MARKER ENDURANCE BY SIZE
// "Endurance (Animals, Magical Animals, Humanoids, Magical Humanoids)" (MM p.286): the dice, the
// book's bracketed average, and the BASE LEVEL the size carries -- the level the power points are
// added to. Keyed by size and kind. The animal rows at Minuscule, Tiny and Small are printed as
// plain ranges ("1-2", "1-3"); they are given dice with the same range.
//                              dice         average  baseLevel  example
export const ENDURANCE_BY_SIZE = {
	humanoid: {
		"Tiny":          [ "3d4",       7,    1,   "Imp, Fairy" ],
		"Small":         [ "4d4",       10,   1,   "Midfolk" ],
		"Medium Small":  [ "4d4+10",    20,   1,   "Elf" ],
		"Medium":        [ "6d4+10",    25,   1,   "Human" ],
		"Medium Large":  [ "4d10+20",   40,   2,   "Saurian" ],
		"Large":         [ "4d10+40",   60,   2,   "Ogre" ],
		"Very Large":    [ "8d10+70",   115,  3,   "Troll" ],
		"Huge":          [ "8d10+110",  155,  4,   "Small Giant" ],
		"Giant":         [ "8d10+130",  175,  5,   "Small Giant" ],
		"Mammoth":       [ "9d10+250",  300,  6,   "Mountain Giant" ],
		"Gargantuan":    [ "9d10+350",  400,  7,   "Cloud Giant" ],
		"Titanic":       [ "9d10+450",  500,  8,   "Titan" ]
	},
	animal: {
		"Minuscule":     [ "1",         1,    0,   "Spider, Fly" ],
		"Tiny":          [ "1d2",       1,    0,   "Mouse, Vole" ],
		"Small":         [ "1d3",       2,    1,   "Squirrel, Rat" ],
		"Medium Small":  [ "5d4+2",     15,   1,   "Small Dog" ],
		"Medium":        [ "4d10+10",   30,   1,   "Wolf" ],
		"Medium Large":  [ "4d10+30",   50,   2,   "Alligator" ],
		"Large":         [ "4d10+50",   70,   2,   "Winter Wolf, Horse" ],
		"Very Large":    [ "4d10+60",   80,   3,   "Dire Wolf, Lion" ],
		"Huge":          [ "4d10+70",   90,   3,   "Griffon" ],
		"Giant":         [ "8d10+90",   135,  4,   "Manticore" ],
		"Mammoth":       [ "8d10+120",  165,  5,   "Elephant" ],
		"Gargantuan":    [ "9d10+150",  200,  6,   "Giant Worm" ],
		"Titanic":       [ "9d10+750",  800,  8,   "Dragon" ]
	}
};

// "Tree weights and attributes" (MM p.285): a tree's height picks its weight, Endurance, damage and
// base level together. "The stats max at 99' (even if tree is larger)."
//                   height(ft) weight   dice        avgLow avgHigh damage   baseLevel
export const TREE_TABLE = [
	[ 3,   25,    "1d10+8",   9,   18,   "1d10",  0 ],
	[ 6,   100,   "2d10+10",  12,  30,   "2d10",  0 ],
	[ 9,   500,   "3d10+12",  15,  42,   "3d10",  0 ],
	[ 12,  1000,  "6d10+14",  20,  74,   "4d10",  1 ],
	[ 15,  2000,  "9d10+16",  25,  106,  "5d10",  1 ],
	[ 18,  3000,  "12d10+18", 30,  138,  "6d10",  2 ],
	[ 21,  4000,  "15d10+20", 35,  170,  "7d10",  2 ],
	[ 24,  5000,  "18d10+22", 40,  202,  "8d10",  2 ],
	[ 27,  6000,  "21d10+24", 45,  234,  "9d10",  2 ],
	[ 30,  7000,  "24d10+26", 50,  266,  "10d10", 3 ],
	[ 33,  8000,  "27d10+28", 55,  298,  "11d10", 3 ],
	[ 36,  9000,  "30d10+30", 60,  330,  "12d10", 3 ],
	[ 39,  10000, "33d10+32", 65,  362,  "13d10", 3 ],
	[ 42,  12000, "36d10+34", 70,  394,  "14d10", 3 ],
	[ 45,  14000, "39d10+36", 75,  426,  "15d10", 4 ],
	[ 48,  16000, "42d10+38", 80,  458,  "16d10", 4 ],
	[ 51,  18000, "45d10+40", 85,  490,  "17d10", 4 ],
	[ 54,  20000, "48d10+42", 90,  522,  "18d10", 4 ],
	[ 57,  22000, "51d10+44", 95,  554,  "19d10", 5 ],
	[ 60,  24000, "54d10+46", 100, 586,  "20d10", 5 ],
	[ 63,  26000, "57d10+48", 105, 618,  "21d10", 5 ],
	[ 66,  28000, "60d10+50", 110, 650,  "22d10", 6 ],
	[ 69,  30000, "63d10+52", 115, 682,  "23d10", 6 ],
	[ 72,  32000, "66d10+54", 120, 714,  "24d10", 6 ],
	[ 75,  34000, "69d10+56", 125, 746,  "25d10", 7 ],
	[ 78,  36000, "72d10+58", 130, 778,  "26d10", 7 ],
	[ 81,  38000, "75d10+60", 135, 810,  "27d10", 7 ],
	[ 84,  40000, "78d10+62", 140, 842,  "28d10", 8 ],
	[ 87,  42000, "81d10+64", 145, 874,  "29d10", 8 ],
	[ 90,  44000, "84d10+66", 150, 906,  "30d10", 8 ],
	[ 93,  48000, "87d10+68", 155, 938,  "31d10", 9 ],
	[ 96,  50000, "90d10+70", 160, 970,  "32d10", 9 ],
	[ 99,  52000, "93d10+72", 165, 1002, "33d10", 9 ]
];

// @MARKER ATTRIBUTE BANDS
// The five attribute tables (MM pp.285-286), one band list per group. Each band: its name, the
// book's printed range, dice with that range, and the PP it costs. The Tiny/Lethargic/Basic rows print
// "0-1 (1-2/2)" and the Small ones "2-4 (1-3+1)"; both are given dice with the printed range.
//
// Which group the twelve attributes fall in:
//   body    Strength, Vitality          "Physical Attributes (Strength and Vitality)" -- by body size
//   speed   Agility                     "Physical Attributes (Agility)"
//   mind    Intelligence, Wisdom, Knowledge
//   soul    Appearance, Charm, Social Class   ("N/A" for the soulless: animals, mindless undead)
//   spirit  Aura, Piety, Will Force
//
// The PP is charged PER ATTRIBUTE at the band chosen for it (so a Medium creature average in
// everything is 25 PP -- eleven at 2 and Average Agility at 3 -- under one level's worth: a human is
// level 1, which is right).
// "Enhanced Strength" and its kin in the abilities list say "Cost: listed on the attribute table":
// that is this, a higher band for the one attribute, so the generator lets a band be chosen per
// attribute and charges the band.
//                               band                         low  high  dice          pp
export const ATTRIBUTE_BANDS = {
	body: [
		[ "Tiny",                     0,   1,   "1d2-1",       0  ],
		[ "Small",                    2,   4,   "1d3+1",       0  ],
		[ "Medium Small",             5,   11,  "2d4+3",       1  ],
		[ "Medium",                   7,   16,  "3d4+4",       2  ],
		[ "Medium Large",             12,  18,  "2d4+10",      3  ],
		[ "Large",                    14,  20,  "2d4+12",      4  ],
		[ "Very Large",               16,  22,  "2d4+14",      5  ],
		[ "Huge",                     18,  24,  "2d4+16",      6  ],
		[ "Giant",                    20,  26,  "2d4+18",      8  ],
		[ "Mammoth",                  21,  27,  "2d4+19",      10 ],
		[ "Gargantuan",               22,  28,  "2d4+20",      15 ],
		[ "Titanic",                  23,  29,  "2d4+21",      20 ],
		[ "Divine Being",             26,  30,  "1d10/2+25",   25 ]
	],
	speed: [
		[ "Lethargic",                0,   1,   "1d2-1",       0  ],
		[ "Very Slow",                2,   4,   "1d3+1",       0  ],
		[ "Slow",                     5,   8,   "1d4+4",       1  ],
		[ "Medium Slow",              7,   12,  "1d6+6",       2  ],
		[ "Average",                  11,  14,  "1d4+10",      3  ],
		[ "Medium Fast",              13,  16,  "1d4+12",      4  ],
		[ "Fast",                     15,  18,  "1d4+14",      5  ],
		[ "Very Fast",                17,  20,  "1d4+16",      6  ],
		[ "Supernatural Speed",       19,  22,  "1d4+18",      10 ],
		[ "Immortal Speed",           22,  25,  "1d4+21",      15 ],
		[ "Divine Speed",             26,  30,  "1d10/2+25",   20 ]
	],
	mind: [
		[ "Basic Drives and Instincts", 0, 1,   "1d2-1",       0  ],
		[ "Animal Intelligence",      2,   4,   "1d3+1",       0  ],
		[ "Below Average Intelligence", 5, 11,  "2d4+3",       1  ],
		[ "Average Intelligence",     11,  14,  "1d4+10",      2  ],
		[ "Above Average Mind",       13,  16,  "1d4+12",      3  ],
		[ "Highly Intelligent",       15,  18,  "1d4+14",      4  ],
		[ "Genius",                   19,  20,  "1d2+18",      5  ],
		[ "Supernatural Intelligence", 21, 22,  "1d2+20",      10 ],
		[ "Immortal Intelligence",    23,  24,  "1d2+22",      15 ],
		[ "Divine Intelligence",      26,  30,  "1d10/2+25",   20 ]
	],
	soul: [
		[ "N/A (no soul)",            0,   0,   "0",           0  ],
		[ "Condemned/Damned Soul",    0,   1,   "1d2-1",       0  ],
		[ "Tortured/Lost Soul",       2,   4,   "1d3+1",       0  ],
		[ "Below Average Soul",       5,   11,  "2d4+3",       1  ],
		[ "Average Soul",             11,  14,  "1d4+10",      2  ],
		[ "Above Average Soul",       13,  16,  "1d4+12",      3  ],
		[ "Very Likeable Soul",       15,  18,  "1d4+14",      4  ],
		[ "Superior Soul",            19,  20,  "1d2+18",      5  ],
		[ "Immortal Soul",            21,  24,  "1d4+20",      10 ],
		[ "Divine Soul",              25,  28,  "1d4+24",      15 ],
		[ "Supreme Soul",             29,  30,  "1d2+28",      20 ]
	],
	spirit: [
		[ "Basic Spirit",             0,   1,   "1d2-1",       0  ],
		[ "Animal Spirit",            2,   4,   "1d3+1",       0  ],
		[ "Below Average Spirit",     5,   11,  "2d4+3",       1  ],
		[ "Average Spirit",           11,  14,  "1d4+10",      2  ],
		[ "Above Average Spirit",     13,  16,  "1d4+12",      3  ],
		[ "Highly Magical Spirit",    15,  18,  "1d4+14",      4  ],
		[ "Superior Spirit",          19,  20,  "1d2+18",      5  ],
		[ "Immortal Spirit",          21,  24,  "1d4+20",      10 ],
		[ "Divine Spirit",            25,  28,  "1d4+24",      15 ],
		[ "Supreme Spirit",           29,  30,  "1d2+28",      20 ]
	]
};

// The twelve attributes, each to its group and label, in his order.
//                      group     label
export const ATTRIBUTE_GROUPS = {
	str: [ "body",   "Strength" ],
	agl: [ "speed",  "Agility" ],
	vit: [ "body",   "Vitality" ],
	int: [ "mind",   "Intelligence" ],
	wis: [ "mind",   "Wisdom" ],
	knw: [ "mind",   "Knowledge" ],
	app: [ "soul",   "Appearance" ],
	chm: [ "soul",   "Charm" ],
	soc: [ "soul",   "Social Class" ],
	aur: [ "spirit", "Aura" ],
	pty: [ "spirit", "Piety" ],
	wil: [ "spirit", "Will Force" ]
};

// Which body band a size suggests for Strength and Vitality: the body table's bands ARE the sizes
// (Minuscule has no band of its own and takes Tiny's).
export const BODY_BAND_BY_SIZE = {
	"Minuscule": "Tiny", "Tiny": "Tiny", "Small": "Small", "Medium Small": "Medium Small", "Medium": "Medium",
	"Medium Large": "Medium Large", "Large": "Large", "Very Large": "Very Large", "Huge": "Huge",
	"Giant": "Giant", "Mammoth": "Mammoth", "Gargantuan": "Gargantuan", "Titanic": "Titanic",
	"Divine Being": "Divine Being"
};

// @MARKER STANDARD ATTACKS
// "Standard Attacks" (MM p.287): "Any animals with teeth can have a bite attack, any with basic limbs
// a kick, and any with fists a punch. Trample is for any creature that will try and do a move into
// (and over) its opponent." No PP: these come with the body. Damage by size; "0" is no attack.
// Ranges are written as the book prints them and read by readDamageRange (creature-gen-rules.mjs).
//                       Bite     Punch   Kick    Trample
export const STANDARD_ATTACKS = {
	"Minuscule":        [ "0-1",   "0",    "0",    "0"     ],
	"Tiny":             [ "1",     "0-1",  "0-1",  "0"     ],
	"Small":            [ "1",     "0-1",  "1",    "0"     ],
	"Medium Small":     [ "1-2",   "1",    "1",    "1d4"   ],
	"Medium":           [ "1-3",   "1",    "1-2",  "2d4"   ],
	"Medium Large":     [ "1d4",   "1-2",  "1-3",  "5d6"   ],
	"Large":            [ "1d6",   "1-3",  "1d6",  "6d6"   ],
	"Very Large":       [ "2d4",   "1d4",  "2d6",  "8d6"   ],
	"Huge":             [ "3d4",   "2d4",  "3d6",  "10d6"  ],
	"Giant":            [ "3d6",   "3d6",  "5d6",  "12d6"  ],
	"Mammoth":          [ "6d6",   "6d6",  "7d6",  "14d6"  ],
	"Gargantuan":       [ "7d6",   "7d6",  "8d6",  "16d6"  ],
	"Titanic":          [ "8d6",   "8d6",  "9d6",  "20d6"  ],
	"Divine Being":     [ "8d6",   "8d6",  "9d6",  "20d6"  ]
};
// The standard attacks' columns, with the damage type each does and his attack type. No seconds are
// printed for them; his creatureAttack item's default of 3 stands, for the Game Master to change.
//                      name       column  damageType   attackType
export const STANDARD_ATTACK_KINDS = [
	[ "Bite",      0, "Crushing",  "Melee" ],
	[ "Punch",     1, "Smashing",  "Melee" ],
	[ "Kick",      2, "Smashing",  "Melee" ],
	[ "Trample",   3, "Crushing",  "Melee" ]
];

// @MARKER BOUGHT ATTACKS
// "Attacks (Abilities chosen from list)" (MM p.287): damage by size for the attacks bought from the
// animal abilities list. "Creatures are given a range of damage from which to choose" -- a low and a
// high, "3d4-4d4". Minuscule takes Tiny's row; Divine Being takes Titanic's.
//                       Fangs/Maw/Beak  LargeFangs/Horns/Spikes/Tusks  SmallClaws  MedClaws  LargeClaws/Quills/Pincers
export const BOUGHT_ATTACKS = {
	"Tiny":             [ "1-2",          "1-3",                        "1",        "1",      "1-2"    ],
	"Small":            [ "1-3",          "2d4",                        "1-2",      "1-2",    "1d4"    ],
	"Medium Small":     [ "2d4-3d4",      "3d4-4d4",                    "1-3",      "1d4",    "2d4"    ],
	"Medium":           [ "3d4-4d4",      "4d4-5d4",                    "1d4",      "2d4",    "3d4"    ],
	"Medium Large":     [ "4d4-5d4",      "4d6-5d6",                    "2d4",      "3d4",    "3d6"    ],
	"Large":            [ "4d6-5d6",      "5d6-6d6",                    "3d4",      "3d6",    "4d6"    ],
	"Very Large":       [ "5d6-6d6",      "6d6-7d6",                    "3d6",      "4d6",    "5d6"    ],
	"Huge":             [ "6d6-7d6",      "7d6-8d6",                    "4d6",      "5d6",    "6d6"    ],
	"Giant":            [ "7d6-8d6",      "8d6-9d6",                    "5d6",      "6d6",    "7d6"    ],
	"Mammoth":          [ "8d6-9d6",      "10d6-11d6",                  "6d6",      "7d6",    "8d6"    ],
	"Gargantuan":       [ "9d6-10d6",     "12d6-13d6",                  "7d6",      "8d6",    "9d6"    ],
	"Titanic":          [ "10d6-11d6",    "13d6-14d6",                  "8d6",      "9d6",    "10d6"   ]
};

// The attack abilities themselves (MM pp.289-291, "Animal Abilities"): which damage column each reads,
// its PP, its seconds and minimum, its damage type and his attack type. Seconds and types are the
// ability's own words ("Fangs: 5 second attack (3 min., piercing...)"). Pincers and Tail Slap print no
// seconds; the item default stands. Quills are thrown (a Missile, 2 seconds). "Raking" claws do the
// primary claws' damage +1 per die and are left to the Game Master to write on the attack.
//                           column  pp  seconds  minimum  damageType    attackType  note
export const ATTACK_ABILITIES = {
	"Fangs":                 [ 0,   6,   5,   3,   "Piercing",   "Melee",   "5 second attack (3 min.)" ],
	"Fangs (Large)":         [ 1,   8,   6,   4,   "Piercing",   "Melee",   "6 second attack (4 min.)" ],
	"Beak":                  [ 0,   5,   5,   4,   "Smashing",   "Melee",   "5 second attack (4 min.)" ],
	"Maw":                   [ 0,   5,   7,   7,   "Crushing",   "Melee",   "7 second attack (7 min.); grinds and swallows" ],
	"Rending Teeth":         [ 0,   5,   4,   3,   "Crushing",   "Melee",   "4 second attack (3 min.); rows of tearing teeth" ],
	"Horns":                 [ 1,   4,   5,   4,   "Thrusting",  "Melee",   "As Spikes: 5 second attack (4 min.), 4 PP per horn" ],
	"Spikes":                [ 1,   4,   5,   4,   "Thrusting",  "Melee",   "5 second attack (4 min.), 4 PP per spike" ],
	"Tusks":                 [ 1,   4,   5,   4,   "Thrusting",  "Melee",   "As Spikes: 5 second attack (4 min.), 4 PP per tusk" ],
	"Antlers":               [ 1,   4,   5,   4,   "Smashing",   "Melee",   "As Spikes, but smashing damage" ],
	"Claws (Small)":         [ 2,   2,   4,   2,   "Cutting",    "Melee",   "4 second attack (2 min.)" ],
	"Claws (Medium)":        [ 3,   6,   5,   3,   "Cutting",    "Melee",   "5 second attack (3 min.)" ],
	"Claws (Large)":         [ 4,   8,   6,   4,   "Cutting",    "Melee",   "6 second attack (4 min.)" ],
	"Quills":                [ 4,   10,  2,   0,   "Piercing",   "Missile", "Thrown, 2 seconds; each extra quill thrown is -1 to hit; barbed" ],
	"Pincers/Mandibles":     [ 4,   8,   3,   0,   "Crushing",   "Grappling", "Grabs a smaller creature: contest of Strength to escape every 3 seconds" ],
	"Stinger":               [ 1,   5,   6,   4,   "Thrusting",  "Melee",   "6 second attack (4 min.); venom type must be bought (Venom ability)" ],
	"Tail Slap":             [ 1,   5,   3,   0,   "Smashing",   "Melee",   "Damage based on size; adds a tail (x1/2) if the body has none" ]
};

// "Attack Skill" (MM p.287): the attack chart's PP cost. His Grandmaster chart is not priced in the
// book; it is offered at Master's cost plus the same step (12) and marked as the generator's own.
//                        chart           pp
export const ATTACK_SKILL_PP = {
	"None":          0,
	"Beginner":      1,
	"Novice":        2,
	"Intermediate":  4,
	"Advanced":      6,
	"Expert":        8,
	"Master":        10,
	"Grandmaster":   12
};

// @MARKER HIDE KINDS
// The Hide abilities (MM p.290, with Bark and Fibrous from the plant list, p.292, and Supernatural
// Hide from the magical list, p.296). Each gives at most so many points per so much Endurance, at a
// PP cost per point. His errata's cap -- 5 per level, level 0 counting as 1, plants and the Titanic
// exempt -- sits over all of them (HIDE_CAP, creature-tables.mjs) and is applied in
// creature-gen-rules.mjs.
//                        perEndurance  ppPerPoint  flatPP  note
export const HIDE_KINDS = {
	"None":                  [ 0,     0,     0,   "" ],
	"Skin":                  [ 6,     1,     0,   "1 point per 6 Endurance" ],
	"Feathers":              [ 6,     1,     0,   "1 point per 6 Endurance" ],
	"Fur":                   [ 5,     1,     0,   "1 point per 5 Endurance" ],
	"Scales":                [ 3,     1,     0,   "1 point per 3 Endurance" ],
	"Bone":                  [ 2,     1,     0,   "1 point per 2 Endurance (Carapace, a Mollusk's shell)" ],
	"Chitinous":             [ 1,     1,     0,   "1 point per Endurance" ],
	"Bark":                  [ 2,     2,     0,   "1 point per 4 to 1 per 2 Endurance; plants only. 2 PP per point" ],
	"Fibrous":               [ 5,     0.5,   0,   "1 point per 5 Endurance; plants only. 1 PP per 2 points" ],
	"Supernatural":          [ 0,     1,     5,   "An invisible magic hide, as Force Armor. 5 PP + 1 per point; no Endurance limit" ]
};

// @MARKER MOVEMENT
// "Movement Tables" (MM p.288). Base walking speed by family and size as [hourly miles, feet per
// 10 seconds, feet per second]. The crawling table is for Snake, Mollusk and Worm; the humanoid table
// also serves Sea Mammals for swimming. Two printed slips corrected by the pattern: Mammoth humanoid
// "80 feet" per second reads 8, and the crawling Medium Small "I foot" reads 1.
export const WALKING_BASE = {
	humanoid: {
		"Minuscule":     [ 1,    10,   1   ],
		"Tiny":          [ 1,    10,   1   ],
		"Small":         [ 2,    20,   2   ],
		"Medium Small":  [ 3,    30,   3   ],
		"Medium":        [ 4,    40,   4   ],
		"Medium Large":  [ 5,    50,   5   ],
		"Large":         [ 6,    60,   6   ],
		"Very Large":    [ 7,    70,   7   ],
		"Huge":          [ 7,    70,   7   ],
		"Giant":         [ 8,    80,   8   ],
		"Mammoth":       [ 8,    80,   8   ],
		"Gargantuan":    [ 8,    80,   8   ],
		"Titanic":       [ 8,    80,   8   ],
		"Divine Being":  [ 8,    80,   8   ]
	},
	quadruped: {
		"Minuscule":     [ 3,    30,   3   ],
		"Tiny":          [ 3,    30,   3   ],
		"Small":         [ 4,    40,   4   ],
		"Medium Small":  [ 5,    50,   5   ],
		"Medium":        [ 6,    60,   6   ],
		"Medium Large":  [ 7,    70,   7   ],
		"Large":         [ 8,    80,   8   ],
		"Very Large":    [ 9,    90,   9   ],
		"Huge":          [ 10,   100,  10  ],
		"Giant":         [ 10,   100,  10  ],
		"Mammoth":       [ 10,   100,  10  ],
		"Gargantuan":    [ 10,   100,  10  ],
		"Titanic":       [ 10,   100,  10  ],
		"Divine Being":  [ 10,   100,  10  ]
	},
	crawl: {
		"Minuscule":     [ 0.25, 2,    0.25 ],
		"Tiny":          [ 0.25, 2,    0.25 ],
		"Small":         [ 0.5,  5,    0.5  ],
		"Medium Small":  [ 1,    10,   1   ],
		"Medium":        [ 2,    20,   2   ],
		"Medium Large":  [ 3,    30,   3   ],
		"Large":         [ 4,    40,   4   ],
		"Very Large":    [ 5,    50,   5   ],
		"Huge":          [ 6,    60,   6   ],
		"Giant":         [ 6,    60,   6   ],
		"Mammoth":       [ 6,    60,   6   ],
		"Gargantuan":    [ 5,    50,   5   ],
		"Titanic":       [ 5,    50,   5   ],
		"Divine Being":  [ 5,    50,   5   ]
	}
};

// "Tiny Creature Movement" (MM p.288): fixed speeds, "(mostly insects)". Hourly in feet where the
// book gives feet (250', 200'), so they are converted to miles here (5280' to the mile).
//                      name        hourly(miles)  tenSec(ft)  oneSec(ft)
export const TINY_MOVEMENT = [
	[ "Crawl",     250 / 5280,   1,    1 / 12 ],
	[ "Fly",       10,           10,   10     ],
	[ "Hop",       5,            50,   5      ],
	[ "Swim",      200 / 5280,   2,    2 / 12 ]
];

// "Modifiers to Base Walking Speeds" (MM p.288): added to the three figures by the creature's
// conceptual speed, per family. The speed names are the Agility table's, with its three top bands
// taken together as the movement table's "Incredibly fast". Humanoid "Incredibly fast" per second is
// printed +3 beside +4 miles and +40 feet; the pattern (and every other table) says +4.
//                        Lethargic  VerySlow  Slow     MedSlow  Average  MedFast  Fast     VeryFast  Incredibly
export const SPEED_MODIFIERS = {
	humanoid:  [ [-4,-40,-4], [-3,-30,-3], [-2,-20,-2], [-1,-10,-1], [0,0,0],    [1,10,1],  [2,20,2],  [3,30,3],  [4,40,4]  ],
	quadruped: [ [-2,-20,-2], [-1,-10,-1], [0,0,0],     [1,10,1],    [2,20,2],   [3,30,3],  [4,40,4],  [5,50,5],  [6,60,6]  ],
	insect:    [ [-1,-10,-1], [0,0,0],     [1,10,1],    [2,20,2],    [3,30,3],   [4,40,4],  [5,50,5],  [6,60,6],  [7,70,7]  ],
	crawl:     [ [-5,-50,-5], [-4,-40,-4], [-3,-30,-3], [-2,-20,-2], [-1,-10,-1],[0,0,0],   [1,10,1],  [2,20,2],  [3,30,3]  ]
};
export const SPEED_NAMES = [
	"Lethargic", "Very Slow", "Slow", "Medium Slow", "Average", "Medium Fast", "Fast", "Very Fast", "Incredibly Fast"
];
// The Agility band each speed name answers to (the three top bands are all "Incredibly Fast").
export const SPEED_BY_AGILITY_BAND = {
	"Lethargic": "Lethargic", "Very Slow": "Very Slow", "Slow": "Slow", "Medium Slow": "Medium Slow",
	"Average": "Average", "Medium Fast": "Medium Fast", "Fast": "Fast", "Very Fast": "Very Fast",
	"Supernatural Speed": "Incredibly Fast", "Immortal Speed": "Incredibly Fast", "Divine Speed": "Incredibly Fast"
};

// The gaits that follow from the base (MM pp.287-288): "Jogging ... x2", "Running ... x3", "Galloping
// (or sprinting) ... x4" for quadrupeds and some reptiles, and with Hooves (x4); "Flying ... x4" with
// Flight or Magical Flight; "Swimming ... x3" with the Swimming ability. The crawlers "have no
// jogging or running speeds".
//                      name       multiplier
export const GAIT_MULTIPLIERS = {
	"Jog":     2,
	"Run":     3,
	"Gallop":  4,
	"Fly":     4,
	"Swim":    3
};

// @MARKER ABILITIES
// The chapter's five ability lists and their PP (MM pp.289-298), one row each:
//
//   list   "animal"      may be chosen by any creature type other than plants and magical plants
//          (a name can be on two lists -- Insanity is a disability and an immunity -- so a pick
//          carries its list as well as its name)
//          "plant"       plants, magical plants and slimes
//          "mplant"      magical plants and slimes
//          "magical"     any type that is not a non-magical plant or non-magical animal
//          "disability"  a GAIN of PP (negative cost here)
//          "immunity"    any creature
//   pp     the cost, per unit where a unit is named
//   unit   "" for a flat cost; otherwise what one unit is ("+1 hide", "1d10 damage", "+10%")
//   note   the book's own words, short, for the trait's description when the pack has no entry
//
// A cost the book states as "plus Venom cost" or "plus disease cost" is the flat part; the rider is
// its own row (Venom, Disease Bearing) or an Other entry. Attack abilities (Fangs, Claws...) are in
// ATTACK_ABILITIES above and are bought on the Combat step, not here; Hide in HIDE_KINDS; the
// Strength, Agility, Vitality and Endurance abilities are bands and Endurance points, bought on their
// own steps. Enhanced Affinity is given as the errata reads it (p.294: "+1% to Affinity per 2 PP,
// +20% max"). Enhance Taste is the errata's missing p.289 entry.
//                                           list        pp   unit               note
export const ABILITY_LIST = [
	// -- Animal abilities (MM pp.289-291) --
	[ "Acid Spitting",                       "animal",   10,  "3' range and 1d10", "Spits acid in a concentrated stream. Each 10 PP gives 3' range and 1d10 damage." ],
	[ "Ambidextrous",                        "animal",   10,  "",                "Humanoids or humanoid-like animals only: 10 seconds and no penalties in both primary limbs." ],
	[ "Berserking",                          "animal",   2,   "+10%",            "Gains the Berserking skill; 2 PP per +10%." ],
	[ "Chameleon Skin",                      "animal",   5,   "",                "Skin changes to the colour of the environment: +20% Blend, +10% Move Unseen." ],
	[ "Digging",                             "animal",   5,   "",                "Burrows with claws or hooks: 10 cubic feet a minute in soft earth, down to 5 per 2 hours in granite." ],
	[ "Claws (Raking)",                      "animal",   5,   "",                "A second set of limbs rakes while grappling: the primary claws' damage, +1 per die." ],
	[ "Climbing",                            "animal",   2,   "+10%",            "Claws, hooks or limbs ideal for climbing; gains the Climb skill. 2 PP per +10%." ],
	[ "Dance Language",                      "animal",   2,   "",                "Complex somatic communication with its fellows that onlookers do not see as communication." ],
	[ "Digestive Fluid",                     "animal",   6,   "1d10 damage",     "Secretes a fluid that dissolves its food source (name it: Digestive Fluid (Wood)); acts as acid, excreted not spat." ],
	[ "Disease Bearing",                     "animal",   5,   "",                "Carries a random disease; roll on the disease table on appropriate contact." ],
	[ "Diving",                              "animal",   5,   "",                "Gains the Diving skill: aerial dive attacks without saves, or holding breath up to half an hour." ],
	[ "Echo Location",                       "animal",   2,   "",                "Locates objects within hearing range by emitted waves." ],
	[ "Enhanced Disease Resistance",         "animal",   1,   "+5% Disease Resistance", "Especially resistant to disease." ],
	[ "Enhanced Hearing",                    "animal",   2,   "+10% Listen",     "Exceptional hearing; gains Listen at base chance plus the bonus." ],
	[ "Enhanced Poison Resistance",          "animal",   1,   "+5% Poison Resistance", "Especially resistant to poison." ],
	[ "Enhanced Smell",                      "animal",   2,   "+10% Smell",      "Exceptional smell; gains the Smell skill with the bonus." ],
	[ "Enhanced Touch",                      "animal",   3,   "",                "Exceptionally sensitive touch: fine detail, temperature, texture; +15% Perception when touching." ],
	[ "Enhance Taste",                       "animal",   3,   "",                "Errata, p.289: detects poison at 30% within a single drop; +50% to resist Illusions of Taste." ],
	[ "Exceptional Sight",                   "animal",   3,   "",                "As Player's Guide p.39." ],
	[ "Eyestalks",                           "animal",   3,   "",                "Looks around corners and retracts its eyes; -50% to be surprised when extended." ],
	[ "Far Sight",                           "animal",   4,   "",                "As Player's Guide p.39." ],
	[ "Gas Bag",                             "animal",   5,   "",                "A pouch that shoots a gas; choose the effect with Venom. Refills once a minute." ],
	[ "Gills",                               "animal",   5,   "",                "Breathes under water, by slits or porous skin." ],
	[ "Glide Wings",                         "animal",   5,   "",                "Membrane arm to thigh for a slow descending glide; each wing a x1/2 Endurance area." ],
	[ "Glue Secretion",                      "animal",   4,   "",                "A fast-hardening adhesive, 20 lb per square inch; Strength save at -20% to break free." ],
	[ "Heat Sensing",                        "animal",   2,   "",                "As Echo Location, by heat." ],
	[ "Hibernation",                         "animal",   2,   "",                "Sleeps on stored fat up to 3 months; wakes ravenous, physicals -1 per month, 2% weight lost per month." ],
	[ "High Metabolism",                     "animal",   4,   "",                "+10% food, -10% weight, -2 Initiative." ],
	[ "High Pain Threshold",                 "animal",   5,   "",                "Takes 1 less point of physical damage per blow from weapons or energy." ],
	[ "Hooves",                              "animal",   10,  "",                "Gains a Gallop (x4 walking)." ],
	[ "Hypnotic Gaze",                       "animal",   10,  "",                "Meeting its eyes: Control Resistance or stand motionless 1d4 seconds." ],
	[ "Inflation",                           "animal",   5,   "",                "Inflates areas up to 4 times; all damage but piercing halved, piercing doubled and deflates." ],
	[ "Insect Limbs",                        "animal",   4,   "",                "An extra pair of thin arms at 1/2 Endurance with Chitinous hide; 5 seconds each, 2d4; +20% Climb per pair." ],
	[ "Instinct (Danger)",                   "animal",   4,   "+10% Danger Knowledge", "Acquires Danger Knowledge." ],
	[ "Instinct (Food)",                     "animal",   1,   "",                "Senses the direction and distance of the nearest food." ],
	[ "Instinct (Life)",                     "animal",   3,   "",                "Senses the distance and direction of the nearest life form." ],
	[ "Instinct (Navigation)",               "animal",   1,   "+10% Direction Knowledge", "An acute sense of direction." ],
	[ "Instinct (Social)",                   "animal",   1,   "",                "Senses the nearest animal of its type." ],
	[ "Instinct (Water)",                    "animal",   1,   "",                "Senses the nearest water." ],
	[ "Jumping",                             "animal",   5,   "",                "x2 to upward leaps, x3 to forward leaps." ],
	[ "Light Sleeper",                       "animal",   3,   "",                "Awakens in 1-3 seconds after any disturbing noise (1/2 Listen) or a Danger Knowledge roll." ],
	[ "Marsupial Pouch",                     "animal",   2,   "",                "A hidden fold holding 6 cubic inches per 20 Endurance." ],
	[ "Mucous",                              "animal",   7,   "",                "Thick secreted mucous: Strength save or stuck, retried each 10 seconds." ],
	[ "Musk Spray",                          "animal",   5,   "use per minute",  "A stream of obnoxious liquid: Vitality save per 10 seconds or incapacitated 1d10x3 seconds; -4 Charm and Appearance after." ],
	[ "Night Vision",                        "animal",   3,   "",                "As Player's Guide p.39." ],
	[ "Night Vision (Enhanced)",             "animal",   5,   "",                "As Night Vision, and sees normally in daylight." ],
	[ "Patterned Fur",                       "animal",   2,   "",                "+10% Blend, +5% Move Unseen in the environment the pattern matches." ],
	[ "Poisonous Skin",                      "animal",   4,   "",                "As Venom, but takes effect on touching the skin (contact). Cost is Venom +4." ],
	[ "Poisonous Spit",                      "animal",   20,  "",                "Spits poison of the contact variety. Cost is Venom +20." ],
	[ "Prehensile Tail/Trunk",               "animal",   3,   "",                "A third hand without fine manipulation; x1 Endurance, +20% Climb." ],
	[ "Quiet Flier",                         "animal",   2,   "",                "+20% to surprise when attacking from the air." ],
	[ "Regeneration (Natural)",              "animal",   15,  "",                "Lost limbs regrow at normal healing rate; not from fire or acid, nor if head and heart are parted." ],
	[ "Regeneration (Budding)",              "animal",   15,  "",                "Each severed section grows into a smaller version of the creature." ],
	[ "Roar/Scream",                         "animal",   10,  "",                "A cry causing fear (as the skill): all failing a Control Resistance flee; Will Force 15+ unaffected." ],
	[ "Shocking Sting",                      "animal",   8,   "1d8 damage",      "Electrifies one or more areas; 20 seconds to recharge." ],
	[ "Slippery Skin",                       "animal",   6,   "",                "Oily skin: grapplers at -40% to grappling saves and -4 to other grappling rolls." ],
	[ "Social Bonding",                      "animal",   3,   "",                "Calls the nearest animal or group of its type." ],
	[ "Speed",                               "animal",   8,   "",                "Very quick in bursts: -2 defensive adjustment, -2 weapon speed on body attacks, -2 initiative." ],
	[ "Stealth",                             "animal",   5,   "",                "+50% to surprise, +20% to Surprise Attack when moving across the ground." ],
	[ "Sticky Tongue",                       "animal",   4,   "",                "Extends 3 times its length; grabs under 1 lb per foot of creature; 3 seconds; Strength save to free." ],
	[ "Sticky/Suction Pads",                 "animal",   4,   "",                "+40% Climb; climbs surfaces past 90 degrees." ],
	[ "Stubborn",                            "animal",   4,   "",                "+20% Control Resistance, even where animals normally get none; may balk (-20% to handling skills)." ],
	[ "Swimming",                            "animal",   2,   "",                "+50% Swimming, and a swimming movement of x3 walking." ],
	[ "Venom",                               "animal",   2,   "level of type (+1 per level of potency)", "Ingestive poison on an attack: 2 PP per level of type, +1 PP per level of potency; type XX at most. Errata: insinuative." ],
	[ "Vibration Sensing",                   "animal",   5,   "",                "Senses subtle vibrations and movement on a surface." ],
	[ "Water Sac",                           "animal",   5,   "",                "Stores water: goes without for up to a month." ],
	[ "Web Weaving (Sticky)",                "animal",   5,   "",                "A sticky web with object strength = Endurance and threshold = Vitality; contest of Strength to escape." ],
	[ "Web Weaving (Strong)",                "animal",   5,   "",                "A strong web with object strength = twice Endurance and threshold = twice Vitality." ],
	[ "Webbed Feet/Hands",                   "animal",   2,   "",                "+30% to Swimming." ],
	[ "Well Tanned Skin",                    "animal",   3,   "",                "No damage from exposure to the sun." ],
	[ "Wings",                               "animal",   10,  "",                "Errata, p.291: wings can be added to any body type as a x1 Endurance area. Gives the ability to fly (short flights without Flight)." ],
	[ "Wood Cutting",                        "animal",   5,   "inch of wood per minute", "Teeth, claws or pincers for cutting wood; as a bite or punch if used to attack." ],
	// -- Plant abilities (MM pp.291-292) --
	[ "Absorption/Conversion (Plant)",       "plant",    2,   "",                "Absorbs plant material into its own form, 1 cubic inch an hour; heals 1 Endurance an hour." ],
	[ "Absorption (Self)",                   "plant",    3,   "",                "Merges with other plants of its type." ],
	[ "Acid Sap",                            "plant",    6,   "",                "Corrosive sap, 1d4 an hour to flesh; may be stored in pitchers that close when touched." ],
	[ "Bark, Sharp",                         "plant",    2,   "",                "1-3 to areas contacting it." ],
	[ "Bark, Irritant",                      "plant",    5,   "",                "See Irritant." ],
	[ "Bark, Poisonous",                     "plant",    5,   "",                "Venomed bark; plus the Venom cost." ],
	[ "Bark, Diseased",                      "plant",    2,   "",                "Carries a disease; plus the disease cost." ],
	[ "Bark, Parasitic",                     "plant",    5,   "",                "A parasitic agent; plus the agent cost." ],
	[ "Chemical Conversion",                 "plant",    2,   "",                "Lives on chemicals (blood, sulphur, salt) in place of photosynthesis." ],
	[ "Evergreen",                           "plant",    0,   "",                "Green all year." ],
	[ "Fruit/Flower/Bud/Seed, Poisonous",    "plant",    2,   "",                "As Venom in fruit form; plus the Venom cost." ],
	[ "Fruit/Flower/Bud/Seed, Diseased",     "plant",    1,   "",                "Carries a disease; plus the disease cost." ],
	[ "Fruit/Flower/Bud/Seed, Parasitic",    "plant",    2,   "",                "A parasitic agent; plus the agent cost." ],
	[ "Fruit/Flower/Bud/Seed, Irritant",     "plant",    1,   "",                "See Irritant; plus the irritant cost." ],
	[ "Heat Constriction",                   "plant",    5,   "",                "Constricts on warmth: vines 1d4+1, branches 2d6+2, trunks 3d6+3 per 10 seconds. (No cost printed; 5 PP as the kindred abilities.)" ],
	[ "Irritant",                            "plant",    5,   "",                "A rash within 24 hours lasting 3d4 days, 1 damage a day if itched (Will Force save)." ],
	[ "Leaves, Sharp",                       "plant",    1,   "1-2 points",      "Sharpened leaves or nettles." ],
	[ "Leaves, Irritant",                    "plant",    1,   "",                "See Irritant; plus the irritant cost." ],
	[ "Leaves, Venomous",                    "plant",    5,   "",                "Venomed leaves; plus the Venom cost." ],
	[ "Leaves, Diseased",                    "plant",    2,   "",                "Carries a disease; plus the disease cost." ],
	[ "Leaves, Parasitic",                   "plant",    5,   "",                "A parasitic agent; plus the agent cost." ],
	[ "Light-based Regeneration",            "plant",    10,  "",                "1 point per 10 minutes in full sunlight, all wounded areas." ],
	[ "Parasitic, Simple",                   "plant",    4,   "",                "Infection on a failed Disease Resistance: -1-3 physical, -1-2 mental. 4 PP for 1d4+1 days, 8 weeks, 12 months, 30 lifetime." ],
	[ "Parasitic, Mood Altering (Violent)",  "plant",    10,  "",                "Disease Resistance or uncontrollably violent (+50% Berserking); rage leaves in 1d4 minutes." ],
	[ "Parasitic, Mood Altering (Passive)",  "plant",    8,   "",                "Disease Resistance or nearly catatonic for 1d4 hours." ],
	[ "Parasitic, Mood Altering (Paranoia)", "plant",    6,   "",                "Disease Resistance or deeply afraid for 1d4 hours." ],
	[ "Regeneration (Complete)",             "plant",    30,  "",                "Any part regrows a whole plant; no vital areas." ],
	[ "Regeneration (Plant)",                "plant",    5,   "",                "Severed areas grow back at 5 Endurance a day." ],
	[ "Regeneration (Root)",                 "plant",    4,   "",                "Any trunk or stem roots if watered." ],
	[ "Seasonal Dormancy",                   "plant",    0,   "",                "Dormant in fall and winter." ],
	[ "Spores",                              "plant",    5,   "",                "Poison Resistance or 1d10 seconds sneezing; 1-5% allergic. No more than once a week." ],
	[ "Spores, Poisonous",                   "plant",    9,   "",                "As Venom in spore form; plus the Venom cost." ],
	[ "Spores, Diseased",                    "plant",    8,   "",                "Carries a disease; plus the disease cost." ],
	[ "Spores, Irritant",                    "plant",    6,   "",                "See Irritant; plus the irritant cost." ],
	[ "Spores, Parasitic",                   "plant",    9,   "",                "A parasitic agent; plus the agent cost." ],
	[ "Sticky Surface",                      "plant",    4,   "",                "Strength save each 10 seconds to remove, -5% per square foot contacting." ],
	[ "Thorns, Small",                       "plant",    1,   "1-2 points",      "Damage to all areas contacting the thorns." ],
	[ "Thorns, Barbed",                      "plant",    3,   "",                "+1 per thorn; 1d6+2 break off and do 1 each when removed." ],
	[ "Thorns, Diseased",                    "plant",    2,   "",                "Carries a disease; plus the disease cost." ],
	[ "Thorns, Irritant",                    "plant",    2,   "",                "See Irritant; plus the irritant cost." ],
	[ "Thorns, Parasitic",                   "plant",    3,   "",                "A parasitic agent; plus the agent cost." ],
	// -- Magical plant abilities (MM pp.292-293) --
	[ "Absorption/Conversion (Animal)",      "mplant",   20,  "",                "Absorbs living animals: adherence on contact, half a cubic foot converted a minute." ],
	[ "Brain",                               "mplant",   2,   "",                "Self-aware, a brain in one vital region; plus the mental attribute costs." ],
	[ "Bark, Razor",                         "mplant",   5,   "",                "1d6+2 to all areas contacting it." ],
	[ "Cellular Division",                   "mplant",   10,  "",                "Visible cells, each a body region, dividing under stress with Endurance shared equally." ],
	[ "Chill",                               "mplant",   1,   "1d4 damage",      "Draws heat: 1d4 per cubic foot to beings contacting it; an hour to recharge per 1d4." ],
	[ "Electric",                            "mplant",   4,   "1d8 damage",      "1d8 per cubic foot to beings contacting it; an hour to recharge per d4." ],
	[ "Fibrous Hearing",                     "mplant",   21,  "",                "Hears through thin fibres (needs Nervous System)." ],
	[ "Force of Wood",                       "mplant",   5,   "",                "+30% Force if it controls its limbs; 1 structural damage a minute." ],
	[ "Growth Conversion",                   "mplant",   10,  "year of growth",  "Converts energy, a drained rating or a cubic foot of a substance into a year's growth." ],
	[ "Heat",                                "mplant",   12,  "1d6 damage",      "Magical heat: 1d6 per cubic foot on contact; an hour to recharge per d6." ],
	[ "Leaves, Razor",                       "mplant",   5,   "",                "1d4+2 to all areas contacting them. (No cost printed; 5 PP as Razor Bark.)" ],
	[ "Leaves, Sonic",                       "mplant",   0,   "",                "Stiff leaves vibrated into a song voice. Cost: the rating of the songs produced (enter as Other)." ],
	[ "Magical Acid Sap",                    "mplant",   5,   "1d10 damage",     "Extremely corrosive sap, 1d10 per 10 seconds; one dose per cubic foot an hour." ],
	[ "Maw (Plant)",                         "mplant",   5,   "maw",             "A grinding mouth; damage by size. Buy the Maw attack on the Combat step as well." ],
	[ "Mobility",                            "mplant",   80,  "",                "Moves its branches and even uproots itself." ],
	[ "Nervous System",                      "mplant",   3,   "",                "Senses and reacts to touch beyond the local spot." ],
	[ "Parasitic, Massmind",                 "mplant",   80,  "",                "Control Resistance on contact or joined to a massmind." ],
	[ "Parasitic Conversion (Plant)",        "mplant",   60,  "",                "Disease Resistance on touch or an unwakeable sleep, converting to the plant over 1d4+1 days." ],
	[ "Parasitic Conversion (Food)",         "mplant",   100, "",                "Disease Resistance on touch or sleep and death in 1d4 hours, decaying to fertiliser." ],
	[ "Parasitic Mood Altering (Protect)",   "mplant",   40,  "",                "Disease Resistance or intense protectiveness; Control Resistance too, or a bound guardian for 1d4 days." ],
	[ "Plant Eyes",                          "mplant",   3,   "",                "Eyes or eye stalks (needs Nervous System)." ],
	[ "Thick Roots",                         "mplant",   5,   "",                "+20% Brace and to saves against being moved or toppled." ],
	// -- Magical abilities (MM pp.293-296) --
	[ "Acid Blood",                          "magical",  5,   "1d10 damage",     "Acidic blood lowers the object strength of what touches it and burns flesh." ],
	[ "Acid Skin",                           "magical",  8,   "1d10 damage",     "Acidic skin, as Acid Blood, for anything that touches the creature." ],
	[ "Additional Limbs",                    "magical",  10,  "limb",            "Extra limbs on the body chart, 5 seconds of action each." ],
	[ "Aura Container",                      "magical",  20,  "100 points capacity", "A separate container for Aura taken from others." ],
	[ "Aura Sense",                          "magical",  5,   "",                "Senses Aura ratings, Aura magics and active spells." ],
	[ "Bonding",                             "magical",  5,   "",                "Telepathy with lovers and friends, Improved Telepathy with its life mate. (No cost printed; 5 PP as the senses.)" ],
	[ "Blood Siphon",                        "magical",  10,  "",                "Siphons 1d4 Endurance every 5 seconds through some physical means." ],
	[ "Breath Attack (Acid)",                "magical",  10,  "1d10 damage",     "A cone no longer than twice its length, once a minute; each 10 PP more is another use a minute." ],
	[ "Breath Attack (Aura Fire)",           "magical",  12,  "1d12 damage",     "As Aura Strike, in a cone twice its length, once a minute." ],
	[ "Breath Attack (Fire)",                "magical",  6,   "1d6 damage",      "A cone of fire twice its length, once a minute." ],
	[ "Breath Attack (Frost)",               "magical",  4,   "1d4 damage",      "A cone of frost twice its length, once a minute." ],
	[ "Breath Attack (Lightning)",           "magical",  8,   "1d8 damage",      "A rough cone of electricity twice its length, once a minute." ],
	[ "Breath Attack (Poison)",              "magical",  2,   "level of type (+1 per level of potency)", "A gaseous venom 3x its length and as wide as itself, once a minute." ],
	[ "Chill Touch",                         "magical",  2,   "1d4 damage",      "A contact point steals heat, through armour (magic armour saves)." ],
	[ "Combat Emotion",                      "magical",  5,   "",                "+10% to combat skills under one emotion." ],
	[ "Control Drain",                       "magical",  20,  "",                "Added to a drain: a rating below zero transforms the victim into a controlled creature of similar type." ],
	[ "Control Gaze",                        "magical",  10,  "",                "Control Resistance or Control Humanoid while in sight." ],
	[ "Control Touch",                       "magical",  6,   "",                "Control Resistance on touch or Control Humanoid while in sight." ],
	[ "Control Voice",                       "magical",  12,  "",                "Control Resistance on hearing it or Control Humanoid while it can be heard." ],
	[ "Death Drain",                         "magical",  20,  "",                "Added to a drain: a rating below zero kills, and the drain is permanent in any later form." ],
	[ "Destroy Divinity",                    "magical",  20,  "",                "Contact dispels divine items and invocations as Dispel Divinity at 2 Piety Control per level." ],
	[ "Destroy Magic",                       "magical",  20,  "",                "Contact dispels Aura items and spells as Dispel Magic (errata) at 2 Aura per level." ],
	[ "Divine Emotion",                      "magical",  5,   "",                "+10% to divine magical skills under one emotion." ],
	[ "Divine Isolation",                    "magical",  50,  "",                "Cannot use, create or be the focus of divine magic." ],
	[ "Divine Sense",                        "magical",  5,   "",                "Senses divine magic, active invocations and supernatural beings." ],
	[ "Dormant State",                       "magical",  5,   "",                "A dormant state needing no food, losing 1 Endurance a month." ],
	[ "Dormant State (Advanced)",            "magical",  10,  "",                "As Dormant State, losing Endurance yearly." ],
	[ "Electrical Skin",                     "magical",  6,   "1d8 damage",      "Contact gives electrical damage on a failed Magic Resistance; through metal weapons." ],
	[ "Emotion Sense",                       "magical",  3,   "",                "Senses emotion in others." ],
	[ "Endurance Conversion",                "magical",  20,  "Endurance gained", "Converts energy, a drained rating or a cubic foot of a substance into Endurance (to double starting)." ],
	[ "Enhanced Healing",                    "magical",  5,   "",                "+2 Vitality for healing and fatigue." ],
	[ "Enhanced Magic Resistance",           "magical",  1,   "+1% Magic Resistance", "Especially magically resistant." ],
	[ "Enhanced Illusion Resistance",        "magical",  1,   "+1% Illusion Resistance", "Especially good at spotting illusions." ],
	[ "Enhanced Control Resistance",         "magical",  1,   "+1% Control Resistance", "Very difficult to control." ],
	[ "Enhanced Affinity",                   "magical",  2,   "+1% Affinity (20 max)", "Errata, p.294: +1% to Affinity per 2 PP, +20% max." ],
	[ "Enhanced Fortune",                    "magical",  2,   "+1% Fortune (20 max)", "+1% to Fortune per 2 PP, +20% max." ],
	[ "Exceptionally Hearty",                "magical",  8,   "",                "Four times as long to fatigue." ],
	[ "Fear Gaze",                           "magical",  10,  "",                "Control Resistance or run in fear 1d4 minutes." ],
	[ "Flame Footed",                        "magical",  6,   "",                "Fire flows from its feet when it runs: 1d4 beside any trample." ],
	[ "Fleet Footed",                        "magical",  5,   "+1 mile/+10'/+1' of movement", "Extra ground movement." ],
	[ "Food Conversion",                     "magical",  20,  "meal gained",     "Converts energy, a drained rating or a cubic foot of a substance into food." ],
	[ "Frost Skin",                          "magical",  2,   "1d4 damage",      "Contact gives cold damage on a failed Magic Resistance." ],
	[ "Gaseous Form",                        "magical",  10,  "",                "Turns gaseous: unharmed physically, subject to winds." ],
	[ "Gift of Gesture",                     "magical",  8,   "",                "2 more language slots, gestural only." ],
	[ "Gift of the Tongue",                  "magical",  10,  "",                "2 more spoken language slots." ],
	[ "Gift of the Word",                    "magical",  12,  "",                "2 more written language slots." ],
	[ "Healing Conversion",                  "magical",  10,  "healing gained",  "Converts energy, a drained rating or a cubic foot of a substance into healing." ],
	[ "Hearty",                              "magical",  4,   "",                "Twice as long to fatigue." ],
	[ "Heat Skin",                           "magical",  4,   "1d6 damage",      "Contact gives heat damage on a failed Magic Resistance." ],
	[ "Heat Touch",                          "magical",  3,   "1d6 damage",      "A contact point flashes heat, through armour (magic armour saves)." ],
	[ "Infravision",                         "magical",  3,   "",                "As Player's Guide p.39." ],
	[ "Improved Phasing",                    "magical",  30,  "",                "Phases all or part of its body and exists on both planes." ],
	[ "Improved Telepathy",                  "magical",  40,  "",                "Mental contact by sight or visualisation within a mile per Will Force; mental combat by sight." ],
	[ "Insanity Touch",                      "magical",  6,   "",                "Will Force save on touch or an insanity." ],
	[ "Insanity Voice",                      "magical",  12,  "",                "Will Force save on hearing it or an insanity." ],
	[ "Insubstantial",                       "magical",  20,  "",                "No physical body; its vital area is a magical energy centre (as Spirit Bound) seen by detect magic." ],
	[ "Invisibility",                        "magical",  40,  "use per day",     "Invisible as the spell, Aura treated as twice its level." ],
	[ "Life Sense",                          "magical",  5,   "",                "Senses positive and negative life energies, as the skill." ],
	[ "Limited Telepathy",                   "magical",  15,  "",                "Mental contact within sight, no mental combat." ],
	[ "Magic Absorption",                    "magical",  10,  "",                "A made Magic Resistance absorbs the spell's Aura into its own pool." ],
	[ "Magic Emotion",                       "magical",  5,   "",                "+10% to magical skills under one emotion." ],
	[ "Magical Disease Bearing",             "magical",  10,  "",                "Carries a magical disease." ],
	[ "Magical Fear",                        "magical",  10,  "",                "Its sight makes beings flee on a failed Control Resistance." ],
	[ "Magical Feeling",                     "magical",  1,   "",                "Feels without physical nerves." ],
	[ "Magical Flight",                      "magical",  20,  "",                "Constant flight at x4 walking a second, or 3' x its highest mental or mystical attribute." ],
	[ "Magical Hearing",                     "magical",  2,   "",                "Hears without ears." ],
	[ "Magical Insanity",                    "magical",  10,  "",                "So hideous or weird that all who view it save Will Force or go insane." ],
	[ "Magical Poisonous Skin",              "magical",  5,   "",                "As Magical Venom on contact. Cost is Magical Venom +5." ],
	[ "Magical Poisonous Spit",              "magical",  20,  "",                "Spits contact poison. Cost is Magical Venom +20." ],
	[ "Magical Smell",                       "magical",  1,   "",                "Smells without a nose." ],
	[ "Magical Sight",                       "magical",  3,   "",                "Sees without eyes." ],
	[ "Magical Taste",                       "magical",  1,   "",                "Tastes without a tongue." ],
	[ "Magical Venom",                       "magical",  10,  "",                "Magical poison (type XXI and up) on an attack: 10 PP + 2 per level of type + 1 per level of potency (enter the rest as Other)." ],
	[ "Magical Voice",                       "magical",  1,   "",                "Speaks without a physical means." ],
	[ "Mental Drain",                        "magical",  8,   "",                "Drains 1d4 of a mental attribute on touch into its own; +5 PP per further 1d4." ],
	[ "Mimic",                               "magical",  5,   "",                "Copies voices and sounds, as Mimic, on a single hearing." ],
	[ "Mind Sense",                          "magical",  3,   "",                "Senses sapient minds within range of its other senses." ],
	[ "Mystical Drain",                      "magical",  10,  "",                "Drains 1d4 of a mystical attribute on touch into its own; +5 PP per further 1d4." ],
	[ "Morphing",                            "magical",  60,  "",                "Changes shape, size and colour to anything it knows." ],
	[ "Null Magic",                          "magical",  50,  "",                "Cannot use, create or be the focus of Aura magic." ],
	[ "Paralysis Touch",                     "magical",  6,   "",                "Control Resistance on touch or Paralysis while in sight." ],
	[ "Personal Drain",                      "magical",  5,   "",                "Drains 1d4 of a personal attribute (not Social Class) on touch; +5 PP per further 1d4." ],
	[ "Phasing",                             "magical",  20,  "",                "Phases and unphases at will." ],
	[ "Physical Drain",                      "magical",  8,   "",                "Drains 1d4 of a physical attribute on touch into its own; +5 PP per further 1d4." ],
	[ "Quick Breed",                         "magical",  10,  "",                "Offspring in half the time." ],
	[ "Regeneration",                        "magical",  20,  "",                "1d4 to all areas a minute; not from fire or acid, nor if head and heart are parted." ],
	[ "Regeneration (Greater)",              "magical",  30,  "",                "1d4 to all wounded areas per 10 seconds." ],
	[ "Regeneration (Superior)",             "magical",  35,  "",                "1d6 to all wounded areas per 10 seconds." ],
	[ "Sense Supernatural",                  "magical",  5,   "",                "As the skill." ],
	[ "Sleep Gaze",                          "magical",  10,  "",                "Control Resistance or asleep until awakened." ],
	[ "Sleep Touch",                         "magical",  6,   "",                "Control Resistance on touch or asleep until awakened." ],
	[ "Sleep Voice",                         "magical",  12,  "",                "Control Resistance on hearing it or asleep until awakened." ],
	[ "Spirit Bound",                        "magical",  10,  "",                "Bound to its form by an energy centre in one vital area; destroying it is the only way to kill the creature." ],
	[ "Stealth Emotion",                     "magical",  5,   "",                "+10% to stealth and intrusive skills under one emotion." ],
	[ "Strength Conversion",                 "magical",  10,  "",                "Converts energy, a drained rating or a cubic foot of a substance into Strength, to its maximum." ],
	[ "Substance Sense",                     "magical",  5,   "sense",           "Senses one substance (Gold Sense, Steel Sense, Water Sense)." ],
	[ "Supernatural Speed",                  "magical",  10,  "",                "+1d4 seconds a round; 2 PP per +1 more, to +6 (enter the extra as Other)." ],
	[ "Supernatural Strength",               "magical",  3,   "+1 Strength (8 max)", "A Strength above what its body allows." ],
	[ "Supernatural Vitality",               "magical",  3,   "+1 Vitality (8 max)", "A Vitality above what its body allows." ],
	[ "Symbiosis",                           "magical",  10,  "",                "Bonds with another creature as the spell." ],
	[ "Transfixing Gaze",                    "magical",  10,  "",                "Control Resistance or motionless until disturbed." ],
	[ "Transfixing Touch",                   "magical",  6,   "",                "Control Resistance on touch or motionless until disturbed." ],
	[ "Transfixing Voice",                   "magical",  12,  "",                "Control Resistance on hearing it or motionless until disturbed." ],
	[ "Transformation Drain",                "magical",  15,  "",                "Added to a drain: a rating below zero transforms the victim into a creature of similar type." ],
	[ "Transmuting Gaze",                    "magical",  20,  "",                "Magic Resistance or transmuted to Crystal, Flesh, Metal (errata), Stone or Wood." ],
	[ "Transmuting Touch",                   "magical",  15,  "",                "Magic Resistance on touch or transmuted to Crystal, Flesh, Metal, Stone or Wood." ],
	[ "Transmuting Voice",                   "magical",  30,  "",                "Magic Resistance on hearing it or transmuted to Crystal, Flesh, Metal, Stone or Wood." ],
	[ "Transmute Self",                      "magical",  10,  "",                "Transmutes itself to Crystal, Flesh, Metal, Stone or Wood and back." ],
	[ "Ultravision",                         "magical",  5,   "",                "As Player's Guide p.39." ],
	[ "Undetectable",                        "magical",  60,  "",                "Detected only by Detect Protection." ],
	[ "Undead Body",                         "magical",  20,  "",                "A dead body kept by negative life force bound to one vital area; all other areas are limbs." ],
	[ "Venom Blood",                         "magical",  2,   "level of type (+1 per level of potency)", "Poisonous blood: Poison Resistance on touching it. 2 PP + 2 per level of type + 1 per potency (the printed acid line is the errata's deletion)." ],
	[ "Will Force Container",                "magical",  20,  "100 points capacity", "A separate container for Will Force taken from others." ],
	// -- Disabilities (MM pp.296-297): a GAIN of power points --
	[ "Acid Sensitivity",                    "disability", -5,  "",              "+1 damage per die from acid; -10% to resistances involving acid." ],
	[ "Bad Swimmer",                         "disability", -2,  "",              "Cannot swim, or cannot keep its head up more than moments." ],
	[ "Blind",                               "disability", -5,  "",              "Cannot physically see." ],
	[ "Clumsiness",                          "disability", -5,  "",              "+1 Initiative, -10% to Agility saves." ],
	[ "Deaf",                                "disability", -4,  "",              "Cannot physically hear." ],
	[ "Diseased",                            "disability", -5,  "",              "A hereditary disease of its type." ],
	[ "Divine Magnetic",                     "disability", -10, "",              "Invocations within 1' per Will Force strike the creature instead." ],
	[ "Earthbound",                          "disability", -3,  "",              "Cannot fly even when magically aided." ],
	[ "Easily Tracked",                      "disability", -3,  "",              "+50% to Track rolls against it." ],
	[ "Electrical Sensitivity",              "disability", -4,  "",              "+1 damage per die from electricity; -10% to resistances involving it." ],
	[ "Emotion (Combat)",                    "disability", -2,  "",              "-10% to combat skills except under one emotion." ],
	[ "Emotion (Divine)",                    "disability", -2,  "",              "-10% to divine magical skills except under one emotion." ],
	[ "Emotion (Magic)",                     "disability", -2,  "",              "-10% to magical skills except under one emotion." ],
	[ "Emotion (Stealth)",                   "disability", -2,  "",              "-10% to stealth and intrusive skills except under one emotion." ],
	[ "Energy Cannibalization",              "disability", -3,  "Endurance lost per use", "Loses Endurance each time a power or ability is used." ],
	[ "Fair Skinned",                        "disability", -2,  "",              "Double damage from sunlight exposure. (No gain printed; 2 PP as Fire Sensitivity's lesser kin.)" ],
	[ "Fire Sensitivity",                    "disability", -3,  "",              "+1 damage per die from fire; -10% to resistances involving fire." ],
	[ "Flightless",                          "disability", -1,  "",              "Wings and feathers too weak even to glide." ],
	[ "Frost Sensitivity",                   "disability", -2,  "",              "+1 damage per die from cold; -10% to resistances involving cold." ],
	[ "Hatred",                              "disability", -3,  "",              "Goes berserk in the presence of a set enemy type." ],
	[ "Heavy Sleeper",                       "disability", -2,  "",              "6+3d6 seconds to awaken." ],
	[ "Insanity",                            "disability", -5,  "",              "A type of insanity." ],
	[ "Light Intolerance",                   "disability", -8,  "",              "Blinded 1d6+1 seconds by moderate light, then -2 to hit and +1 initiative; sunlight 3-30 seconds, -4/+2, and 1 damage an hour." ],
	[ "Light Sensitivity",                   "disability", -6,  "",              "Blinded 2d6+2 seconds by bright light, then -3 to hit and -2 initiative." ],
	[ "Light Torpid",                        "disability", -10, "",              "In daylight -6 to hit and damage, +2 defensive adjustment, +6 initiative." ],
	[ "Loner",                               "disability", -1,  "",              "Cannot form close ties with its own type." ],
	[ "Long Gestation",                      "disability", -3,  "",              "Twice as long to be born." ],
	[ "Loud",                                "disability", -4,  "",              "-50% to surprise, -20% to Surprise Attack." ],
	[ "Loud Flier",                          "disability", -2,  "",              "-20% surprising from the air." ],
	[ "Low Circulation",                     "disability", -3,  "",              "Fatigues at x3. (No gain printed; 3 PP, above Poor Circulation's unprinted 2.)" ],
	[ "Low Pain Threshold",                  "disability", -3,  "",              "+1 physical damage per blow or energy attack." ],
	[ "Magical Light Aversion",              "disability", -20, "",              "Light destroys it, petrifies it, or the like." ],
	[ "Magic Magnetic",                      "disability", -10, "",              "Spells within 1' per Will Force strike the creature instead. (No gain printed; 10 PP as Divine Magnetic.)" ],
	[ "Mute",                                "disability", -3,  "",              "Cannot speak." ],
	[ "No Feeling",                          "disability", -2,  "",              "No tactile sense." ],
	[ "No Sense of Smell/Taste",             "disability", -1,  "",              "No olfactory senses." ],
	[ "Odd Coloration",                      "disability", -5,  "",              "-25% Blend, Move Unseen and Move Unheard." ],
	[ "Plane Fixed",                         "disability", -5,  "",              "Cannot travel to other planes, not even phase." ],
	[ "Poor Circulation",                    "disability", -2,  "",              "Fatigues at x2. (No gain printed; 2 PP.)" ],
	[ "Poor Flexibility",                    "disability", -2,  "",              "+1 weapon speed and +1 defensive adjustment." ],
	[ "Poor Healing",                        "disability", -2,  "",              "Heals at half rate." ],
	[ "Poor Mimic",                          "disability", -1,  "",              "-25% to mimicking and disguise skills." ],
	[ "Pressure Sensitive",                  "disability", -3,  "",              "Cannot dive or be submerged: 1d6 a minute at any depth." ],
	[ "Slow",                                "disability", -5,  "",              "Loses 1d4+1 seconds a round and moves at half speed for its size." ],
	[ "Slow Footed",                         "disability", -5,  "-1 mile/-10'/-1' of movement", "Slow ground movement, never below 1/10/1." ],
	[ "Slow Metabolism",                     "disability", -5,  "",              "-10% food, +10% weight, +1 initiative, -10% Agility saves." ],
	[ "Sticky Skin",                         "disability", -5,  "",              "Easily grappled: +4 or +20% to the attacker's grappling and Martial Knowledge rolls." ],
	[ "Telepathically Blocked",              "disability", -5,  "",              "No telepathy even when aided; -2 to mental combat." ],
	[ "Thin Skin",                           "disability", -6,  "",              "1d4 less Endurance than its size allows." ],
	[ "Weak Cry",                            "disability", -1,  "",              "Its calls make predators lose fear." ],
	[ "Weak Vision",                         "disability", -2,  "",              "-20% to surprise; sees half the distance." ],
	[ "Weakness (Fire)",                     "disability", -6,  "",              "x2 damage from heat and fire; -20% to resistances involving them." ],
	[ "Weakness (Acid)",                     "disability", -10, "",              "x2 damage from acid; -20% to resistances involving it." ],
	[ "Weakness (Electricity)",              "disability", -8,  "",              "x2 damage from electricity; -20% to resistances involving it." ],
	[ "Weakness (Frost)",                    "disability", -4,  "",              "x2 damage from cold; -20% to resistances involving it." ],
	[ "Worsened Acid Weakness",              "disability", -20, "",              "x3 damage from acid; -30% to resistances involving it." ],
	[ "Worsened Electrical Weakness",        "disability", -16, "",              "x3 damage from electricity; -30% to resistances involving it." ],
	[ "Worsened Fire Weakness",              "disability", -12, "",              "x3 damage from heat and fire; -30% to resistances involving them." ],
	[ "Worsened Frost Weakness",             "disability", -8,  "",              "x3 damage from cold; -30% to resistances involving it." ],
	// -- Immunities (MM pp.297-298) --
	[ "Acid",                                "immunity", 20,  "",                "No damage or effect from acid, normal, magical or divine." ],
	[ "Acid Hardened",                       "immunity", 5,   "",                "-1 per die from acid; +10% to Magic Resistances involving acid." ],
	[ "Acid Resistant",                      "immunity", 10,  "",                "Half damage from acid; +20% to Magic Resistances involving acid." ],
	[ "Aging",                               "immunity", 20,  "",                "Does not age or decay; aging effects do nothing." ],
	[ "Control",                             "immunity", 20,  "",                "Immune to control in any form save true names." ],
	[ "Death, Greater",                      "immunity", 80,  "",                "Killing magic returns it to its home plane or soul container instead." ],
	[ "Death, Lesser",                       "immunity", 10,  "",                "Death and negative life-force magics do nothing, or heal it." ],
	[ "Divinity, Lesser",                    "immunity", 25,  "",                "Immune to divine magic that does not target its type." ],
	[ "Divinity, Greater",                   "immunity", 50,  "",                "Immune to all divine magic." ],
	[ "Disease",                             "immunity", 5,   "",                "Unaffected by parasites, infections and diseases." ],
	[ "Electricity",                         "immunity", 16,  "",                "No damage or effect from electricity." ],
	[ "Electricity Hardened",                "immunity", 4,   "",                "-1 per die from electricity; +10% to Magic Resistances involving it." ],
	[ "Electrically Resistant",              "immunity", 8,   "",                "Half damage from electricity; +20% to Magic Resistances involving it." ],
	[ "Energy, Greater",                     "immunity", 60,  "",                "Energy attacks and effects do nothing." ],
	[ "Energy, Lesser",                      "immunity", 30,  "",                "Energy attacks and effects do half." ],
	[ "Fatigue",                             "immunity", 10,  "",                "Unaffected by the fatigue rules." ],
	[ "Fear",                                "immunity", 8,   "",                "Immune to fear." ],
	[ "Fire",                                "immunity", 12,  "",                "No damage or effect from fire." ],
	[ "Fire Hardened",                       "immunity", 3,   "",                "-1 per die from heat and fire; +10% to Magic Resistances involving them." ],
	[ "Fire Resistant",                      "immunity", 6,   "",                "Half damage from fire; +20% to Magic Resistances involving it." ],
	[ "Frost",                               "immunity", 8,   "",                "No damage or effect from frost or cold." ],
	[ "Frost Hardened",                      "immunity", 2,   "",                "-1 per die from cold; +10% to Magic Resistances involving it." ],
	[ "Frost Resistant",                     "immunity", 4,   "",                "Half damage from cold; +20% to Magic Resistances involving it." ],
	[ "Hold",                                "immunity", 4,   "",                "Cannot be held by the Hold spell or invocation." ],
	[ "Illusion",                            "immunity", 15,  "",                "Always passes an Illusion Resistance." ],
	[ "Insanity",                            "immunity", 5,   "",                "Cannot be driven insane." ],
	[ "Magic",                               "immunity", 50,  "",                "Immune to all Aura magic, skills and spells." ],
	[ "Magic, Lesser",                       "immunity", 25,  "",                "Immune to Aura magic that does not target its type." ],
	[ "Magic, One Type",                     "immunity", 10,  "",                "Immune to all magic of one type (double if both magic and divine of that type)." ],
	[ "Mind, Greater",                       "immunity", 20,  "",                "Cannot be contacted or attacked mentally." ],
	[ "Mind, Lesser",                        "immunity", 10,  "",                "No mental contact except mental combat; immune to mind effects not targeting its type." ],
	[ "Physical, Arch",                      "immunity", 40,  "",                "No damage from normal or blessed weapons; +1/+2 do 1/4, +3/+4 or magical 1/2, +5/+6 3/4, +7 full." ],
	[ "Physical, Complete",                  "immunity", 80,  "",                "No physical weapon harms it; energy and physical magical effects still do." ],
	[ "Physical, Greater",                   "immunity", 30,  "",                "No damage from normal weapons; blessed 1/4, +1/+2 1/2, +3/+4 or magical 3/4, +5 full." ],
	[ "Physical, Lesser",                    "immunity", 10,  "",                "No damage from normal weapons; blessed or magical do full." ],
	[ "Physical, Major",                     "immunity", 20,  "",                "No damage from normal weapons; blessed and +1/+2 half, +3 or magical full." ],
	[ "Physical, Minor",                     "immunity", 15,  "",                "No damage from normal weapons; blessed half, +1 or magical full." ],
	[ "Poison, Lesser",                      "immunity", 8,   "",                "Unaffected by non-magical poisons." ],
	[ "Poison, Greater",                     "immunity", 16,  "",                "Unaffected by any poison." ],
	[ "Shock",                               "immunity", 10,  "",                "Unaffected by shock." ],
	[ "Time",                                "immunity", 40,  "",                "Time around it cannot be altered: Stasis, Time Sight and the like." ],
	[ "Transformation of Form",              "immunity", 20,  "",                "Cannot be changed from its physical form (all Alteration)." ],
	[ "Weapon Damage Immunity",              "immunity", 3,   "25% reduction of one damage type", "Partial damage from one or more damage types." ]
];

// Which lists each creature type may draw on (MM pp.289, 291, 292, 293). Disabilities and immunities
// are open to all.
//                            animal  plant  mplant  magical
export const ABILITY_LISTS_BY_TYPE = {
	"Animal":           [ true,   false, false,  false ],
	"Magical Animal":   [ true,   false, false,  true  ],
	"Humanoid":         [ true,   false, false,  true  ],
	"Magical Humanoid": [ true,   false, false,  true  ],
	"Magical":          [ true,   false, false,  true  ],
	"Plant":            [ false,  true,  false,  false ],
	"Magical Plant":    [ false,  true,  true,   true  ],
	"Slime":            [ true,   true,  true,   true  ],
	"Undead":           [ true,   false, false,  true  ],
	"Supernatural":     [ true,   false, false,  true  ],
	"Deity":            [ true,   false, false,  true  ]
};

// A Humanoid is a race in all but name, and a Humanoid creature's abilities are the book's racial ones
// (Aspects of the Wild, "Race to Creature Conversions"); the book's "Humanoid" row above is read as
// the chapter's own: "any creature type other than plants and magical plants".

// @MARKER SKILLS AND POWERS
// "Skills -- Giving skills to creatures: Any skill can be bought in PP for 1/2 the cost of its rating
// (round up). The skill gets its maximum starting bonus." "Enhanced [skill]: 1 PP per +10% for common
// and social skills, 2 PP per +10% for restricted skills." (MM p.298) The errata (p.181) adds that
// social skills are not worth experience.
export const SKILL_PP_DIVISOR = 2;
export const ENHANCED_SKILL_PP = { common: 1, restricted: 2 };
export const ENHANCED_SKILL_STEP = 10;

// "Powers ... can be added at the cost in PPs at the Aura Level of the spell or the Piety Level of the
// invocation; add 1 PP for each time per day it can be used beyond the first, up to 10. Beyond 10 a
// power can be made to be 'at will' for a 15 PP." (MM p.298)
export const POWER_EXTRA_USE_PP = 1;
export const POWER_MAX_COUNTED_USES = 10;
export const POWER_AT_WILL_PP = 15;

// @MARKER EXPERIENCE VALUE
// His creature experience tables, transcribed from calcCreatureExp's helpers (sheet-worker.js
// 175738-176110): getLevelExp, getAttribExp, getENDExp, getResistExp, getSkillExp, getPowerExp. They
// carry the Master's Manual p.181 combat-experience table with the errata's added level 0 row
// ("0 | 0 | 0/+1 | 15/+1 | 10/+1 | x1 | 10%/+5"), which his code already has as its "<1" branch.
//
// One row per level, 0 to 21+. For each: the base experience; Endurance over/per; attribute over/per;
// resistance over(%)/per (each of the five above the figure); skill over(%)/per (each race or class
// skill above the figure); power per level of the power.
//   level  base      endOver endPer  attrOver attrPer  resistOver resistPer  skillOver skillPer  powerPer
export const CREATURE_EXP_TABLE = [
	[ 0,     0,        0,      1,      15,      1,       10,        5,         10,       1,        1     ],
	[ 1,     50,       20,     1,      16,      1,       30,        5,         30,       2,        1     ],
	[ 2,     100,      20,     2,      16,      2,       30,        10,        30,       5,        2     ],
	[ 3,     150,      20,     3,      16,      3,       30,        15,        30,       7,        3     ],
	[ 4,     500,      30,     10,     17,      10,      40,        50,        40,       25,       10    ],
	[ 5,     1000,     30,     20,     17,      20,      40,        100,       40,       50,       20    ],
	[ 6,     1500,     30,     30,     17,      30,      40,        150,       40,       75,       30    ],
	[ 7,     4000,     40,     80,     18,      80,      50,        400,       50,       200,      80    ],
	[ 8,     8000,     40,     160,    18,      160,     50,        800,       50,       400,      160   ],
	[ 9,     12000,    40,     240,    18,      240,     50,        1200,      50,       600,      240   ],
	[ 10,    20000,    50,     400,    19,      400,     60,        2000,      60,       1000,     400   ],
	[ 11,    25000,    50,     500,    19,      500,     60,        2500,      60,       1250,     500   ],
	[ 12,    30000,    50,     600,    19,      600,     60,        3000,      60,       1500,     600   ],
	[ 13,    50000,    60,     1000,   20,      1000,    70,        5000,      70,       2500,     1000  ],
	[ 14,    75000,    60,     1500,   20,      1500,    70,        7500,      70,       3750,     1500  ],
	[ 15,    100000,   60,     2000,   20,      2000,    70,        10000,     70,       5000,     2000  ],
	[ 16,    150000,   70,     3000,   22,      3000,    80,        12000,     80,       7500,     3000  ],
	[ 17,    200000,   70,     4000,   22,      4000,    80,        15000,     80,       10000,    4000  ],
	[ 18,    250000,   70,     5000,   22,      5000,    80,        20000,     80,       12500,    5000  ],
	[ 19,    500000,   80,     10000,  24,      7500,    90,        25000,     90,       25000,    8000  ],
	[ 20,    750000,   80,     15000,  24,      10000,   90,        30000,     90,       37500,    10000 ],
	[ 21,    1000000,  90,     20000,  25,      15000,   90,        50000,     90,       50000,    12000 ]
];

// His Configurator's special experience ticks (HTML 81447-81470; calcCreatureExp 175551-175640), each
// a share of the BASE experience for the level. Poison is its type (I-XXV) times the base; Hide over
// 29 is (hide - 20) / 10 (at least 1) times the base; each immunity is a fifth of the base.
//                           share   label
export const EXP_SPECIALS = {
	slaying:       [ 1,     "Slaying" ],
	characterClass:[ 1,     "Character Class (GMCs)" ],
	caster:        [ 2,     "Caster/Invoker" ],
	damageTouch:   [ 0.1,   "Damaging Touch" ],
	drainTouch:    [ 0.25,  "Draining Touch" ],
	breath:        [ 0.25,  "Breath Attack" ],
	convert:       [ 0.1,   "Convert to Type" ],
	gaze:          [ 0.1,   "Gaze Attack" ],
	chameleon:     [ 0.25,  "Chameleon Power" ],
	mindControl:   [ 0.5,   "Mind Control" ],
	invisibility:  [ 0.1,   "Invisibility" ]
};
export const EXP_IMMUNITY_SHARE = 0.2;
export const EXP_HIDE_THRESHOLD = 29;

// @MARKER ADD NEW creature generator tables HERE
// @END (CODE)
