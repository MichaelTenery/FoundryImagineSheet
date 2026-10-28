// @START (CODE)
// @MARKER RANDOM TABLES
//==================================================================================================================
// The tables behind the Game Master's "Randoms/Extras" tool -- his CREATURE UPDATER/GM TOOLS option
// of the same name (HTML 84290, update_random_extras; handlers at sheet-worker.js:72712-72850, the
// tables in the functions named beside each).
//
// Data only; the rolling is in module/random-rules.mjs. A table that is read by a d100 is written as
// rows of  [ low, high, text ]  so that the test can prove it covers 1-100 with no gap and no overlap.
// A "%" in a row's text is where a dice string in the row's fourth column is rolled and written in
// (his  ", lasts "+rollDiceFromString("1d4")+" hour(s)."  as data).
//
// WHERE THE PORT DEPARTS FROM HIS CODE, each one said here and in docs/DECISIONS.md:
//   1. Neurotic disorders: his chain tests "<71" twice, so Hypochondria can never be rolled and Nervous
//      Tic and Stammering each take five points too many. The Master's Manual table (masters-manual-fulltext.txt:15137, "Neurotic
//      Disorders", 71-80 Hypochondria, 81-85 Nervous Tic, 86-90 Stammering) is what his dead branch was
//      reaching for, and is followed here.
//   2. The aura-colour dropdown: his second "Fanatical Good" option has the value "Fanatical Good
//      (Active)" where its label says Passive, so Golden Yellow can never be picked. Fixed here.
//   3. His random alignment spells "Good(Active)" and his aura colour looks for "Good (Active)", so a
//      rolled alignment never found its colour; the colour lookup here ignores the space.
//==================================================================================================================

// @MARKER DIRECTIONS (getRandomDirection, sheet-worker.js:26444: a d8, clockwise from north)
export const RANDOM_DIRECTIONS = [
	"North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"
];

// @MARKER ENCOUNTER CHANCE (HTML 92583: the value is the die, "1d"+value, and a 1 is an encounter)
//                                  Die    Label
export const ENCOUNTER_CHANCES = [
	[ 2,   "1 in 2 (Likely)"     ],
	[ 4,   "1 in 4 (Often)"      ],
	[ 6,   "1 in 6 (Regularly)"  ],
	[ 8,   "1 in 8 (Uncommon)"   ],
	[ 10,  "1 in 10 (Unlikely)"  ],
	[ 20,  "1 in 20 (Rarely)"    ]
];
export const DEFAULT_ENCOUNTER_CHANCE = 6;

// @MARKER DOUBLE REFLECTION (getReflectionResult, sheet-worker.js:27641: a d100, plus a d20 distance and
// a d2 for whom the protection spell affects; "%D" is the distance with his tick, "%W" the direction)
//      Low   High  Result
export const REFLECTION_RESULTS = [
	[ 1,    30,  "Spell or weapon loses speed with each reflection. It fades and will drop in 10 seconds. Anyone caught between the two reflection points before the 10 seconds will take the effect at 1/2 original strength." ],
	[ 31,   50,  "Spell or weapon reflects off %D` %W." ],
	[ 51,   75,  "Spell or weapon will affect the lower Aura protection spell. If equal Aura spells (%T)." ],
	[ 76,   95,  "Spell or weapon strikes 1 individual for full effect and reflects back, also striking, and doing damage or equal effect to the other." ],
	[ 96,   100, "Spell or weapon strikes 1 individual for double effect and reflects back, also striking, and doing double damage or double effect to the other." ]
];
// Who is affected when the third row is rolled: a 1 on his d2 is the opponent.
export const REFLECTION_AFFECTED = [ "the caster`s opponent is affected", "the caster is affected" ];

// @MARKER INSANITY (getRandomInsanity, sheet-worker.js:28371-28560; the book's tables are the Master's
// Manual's Insanity pages). The type is a d100 on the first table, then a d100 on that type's own.
//      Low   High  Kind
export const INSANITY_TYPES = [
	[ 1,    20,  "depressive" ],
	[ 21,   80,  "neurotic"   ],
	[ 81,   100, "psychotic"  ]
];

//      Low   High  Disorder
export const DEPRESSIVE_DISORDERS = [
	[ 1,    70,  "Depression"       ],
	[ 71,   90,  "Fugue State"      ],
	[ 91,   100, "Manic Depressive" ]
];

// Amnesia is the last neurotic row and opens a bracket the loss closes: "Amnesia (forgets ...)".
//      Low   High  Disorder
export const NEUROTIC_DISORDERS = [
	[ 1,    50,  "Phobia (choose as appropriate)" ],
	[ 51,   60,  "Insomnia"                       ],
	[ 61,   70,  "Sleepwalking"                   ],
	[ 71,   80,  "Hypochondria"                   ],
	[ 81,   85,  "Nervous Tic"                    ],
	[ 86,   90,  "Stammering"                     ],
	[ 91,   100, "Amnesia ("                      ]
];

// getAmnesiaLoss (sheet-worker.js:28430): what is forgotten.
//      Low   High  Text                                                     Dice
export const AMNESIA_LOSSES = [
	[ 1,    25,  "forgets stressful event that caused the insanity)",          ""     ],
	[ 26,   40,  "forgets last % hour(s))",                                    "1d4"  ],
	[ 41,   50,  "forgets last % hour(s))",                                    "2d6"  ],
	[ 51,   60,  "forgets 1 full day)",                                        ""     ],
	[ 61,   70,  "forgets last % day(s))",                                     "1d4"  ],
	[ 71,   80,  "forgets last % week(s))",                                    "1d4"  ],
	[ 81,   85,  "forgets last % month(s))",                                   "1d4"  ],
	[ 86,   90,  "forgets last % year(s))",                                    "1d4"  ],
	[ 91,   93,  "forgets a skill)",                                           ""     ],
	[ 94,   96,  "forgets class skills and abilities)",                        ""     ],
	[ 97,   99,  "forgets identity, but can speak and function)",              ""     ],
	[ 100,  100, "forgets everything, animal instincts remain)",               ""     ]
];

//      Low   High  Disorder
export const PSYCHOTIC_DISORDERS = [
	[ 1,    25,  "schizophrenia"                ],
	[ 26,   40,  "Depressive Personality"       ],
	[ 41,   55,  "Antisocial Personality"       ],
	[ 56,   70,  "Borderline Personality"       ],
	[ 71,   85,  "Conversion Reaction"          ],
	[ 86,   100, "multiple"                     ]
];

//      Low   High  Disorder
export const SCHIZOPHRENIAS = [
	[ 1,    65,  "Schizophrenia(Simple)"    ],
	[ 66,   90,  "Schizophrenia(Paranoid)"  ],
	[ 91,   100, "Schizophrenia(Catatonic)" ]
];

// Multiple Personality: a d100; "%" is the number of personalities, a fixed number plus a die where he
// rolls one. His last four rows are 4+1d6, 5+1d8, 6+1d10 and 8+1d12.
//      Low   High  Text                                                Base  Dice
export const MULTIPLE_PERSONALITIES = [
	[ 1,    75,  "Multiple Personality(2, Any Align)",                    0,   ""     ],
	[ 76,   80,  "Multiple Personality(2, 1 Opposed)",                    0,   ""     ],
	[ 81,   85,  "Multiple Personality(3, 1 Opposed)",                    0,   ""     ],
	[ 86,   90,  "Multiple Personality(3, 2 Opposed)",                    0,   ""     ],
	[ 91,   92,  "Multiple Personality(4, Any Align)",                    0,   ""     ],
	[ 93,   94,  "Multiple Personality(4, 2 Opposed)",                    0,   ""     ],
	[ 95,   96,  "Multiple Personality(%, Any Align)",                    4,   "1d6"  ],
	[ 97,   98,  "Multiple Personality(%, Any Align)",                    5,   "1d8"  ],
	[ 99,   99,  "Multiple Personality(%, Any Align)",                    6,   "1d10" ],
	[ 100,  100, "Multiple Personality(%, Any Align)",                    8,   "1d12" ]
];

// getRandomInsanityDuration (sheet-worker.js:28384). The last row has no dice.
//      Low   High  Text                           Dice
export const INSANITY_DURATIONS = [
	[ 1,    15,  ", lasts % minute(s).",            "10d4" ],
	[ 16,   30,  ", lasts % hour(s).",              "1d4"  ],
	[ 31,   40,  ", lasts % day(s).",               "1d4"  ],
	[ 41,   60,  ", lasts % week(s).",              "1d4"  ],
	[ 61,   80,  ", lasts % month(s).",             "1d6"  ],
	[ 81,   90,  ", lasts % year(s).",              "1d4"  ],
	[ 91,   100, ", lasts permanently.",            ""     ]
];

// @MARKER AURA COLOUR (getAuraColor, sheet-worker.js:27664; the dropdown is HTML 92647)
// "" is the unaligned case, which rolls a d3 among the first three below.
//      Alignment                    Colour
export const AURA_COLORS = {
	"Fanatical Good (Active)":   "Pure Incandescent White",
	"Fanatical Good (Passive)":  "Golden Yellow",
	"Good (Active)":             "Light Blue",
	"Good (Passive)":            "Dark Blue",
	"Neutral Good (Active)":     "Light Green",
	"Neutral Good (Passive)":    "Dark Green",
	"Neutral (Active)":          "Tan (Light Brown)",
	"True Neutral":              "Gray",
	"Neutral (Passive)":         "Earth (Dark Brown)",
	"Neutral Evil (Active)":     "Orange",
	"Neutral Evil (Passive)":    "Umber (Brown/Orange)",
	"Evil (Active)":             "Dark Red",
	"Evil (Passive)":            "Light Red",
	"Fanatical Evil (Active)":   "Pure Black",
	"Fanatical Evil (Passive)":  "Charcoal",
	"Insane":                    "Swirling of near random colors"
};
export const AURA_COLORS_UNALIGNED = [
	"Translucent, glittering soft, diffuse yellow",
	"Translucent, glittering soft, diffuse red",
	"Translucent, glittering soft, diffuse blue"
];
export const AURA_COLOR_DEFAULT = "Translucent";

// @MARKER MAGIC CHAOS EFFECT (getRandomChaosEffect, sheet-worker.js:29204: a d100)
//      Low   High  Effect
export const CHAOS_EFFECTS = [
	[ 1,    9,   "Aura Reveal: in the area of effect, Aura glows its true color (see GM TOOLS for Aura Color by Alignment)." ],
	[ 10,   14,  "Aura Leech: The area of effect steals Aura at a rate of 1d4 per minute unless a Magic Resistance is made each minute." ],
	[ 15,   19,  "Aura Field: The area gives Aura at a rate of 1d4 per minute unless a Magic Resistance is made each minute." ],
	[ 20,   24,  "Liquid Magic: Any liquids left in the area of effect for 10 minutes or more become magical." ],
	[ 25,   29,  "Potion Creation: Lquids left in the area become random potion (GM sets frequency)." ],
	[ 30,   34,  "Plant Awakening: Plants rooted in the area of effect become alive as Awaken Plant." ],
	[ 35,   39,  "Animal Endowment: Animals sleeping or eating in the area of effect become intelligence as the spell Endow Intelligence." ],
	[ 40,   44,  "Magic Item Enhance: Magic items in the area intensify for 1d4 additional base Aura for 1 full day." ],
	[ 45,   49,  "Magic Item Drain: Magic items in the area are drained for 1d4 less base Aura for 1 full day." ],
	[ 50,   54,  "Magical Portal: a portal opens to another place on the same plane (GM determines location)." ],
	[ 55,   59,  "Planar Portal: a portal opens to another plane (GM determines plane and location)." ],
	[ 60,   64,  "Telepathic Insight: All beings have limited telepathy in the area of effect (cannot initiate mental combat)." ],
	[ 65,   69,  "Dancing Things: objects animate in the area of effect randomly and harmlessly." ],
	[ 70,   74,  "Things Attack: armor and weapons animate and attack individuals in the area of effect." ],
	[ 75,   79,  "Undead Animation: The area creates undead of a certain type (GM determines type and frequency)." ],
	[ 80,   84,  "Supernatural Spawning: the area draws supernatural beings to it (GM sets frequency and which beings appear)." ],
	[ 85,   89,  "Spell Enhance: All spells cast in the area are +1d4 Aura." ],
	[ 90,   94,  "Spell Drain: All spells cast in the area are -1d4 Aura." ],
	[ 95,   95,  "Warp Spell: All spells cast in the area are nullified and instead a Warp Magic effect causes the casting of another random spell of the same level." ],
	[ 96,   96,  "Chaos Spell: All spells cast in the area are nullified and instead a Warp Magic effect causes the casting of another random spell at a random Aura level (d20)." ],
	[ 97,   97,  "Spell Storm: The area casts a random spell of a random Aura level (d20) (GM sets frequency)." ],
	[ 98,   98,  "Null Magic: Area is devoid of magic. No spells, powers or magical skills can be used." ],
	[ 99,   99,  "Divine Isolation: The area is isolated from divine contact. No divine powers, skills or invocations can be used." ],
	[ 100,  100, "Wish Maker: Area produces a wish at a set frequency and a set number 1d4, etc. but a ritual and or unknown conditions must be met; good children who throw pennies in the Aura residue in a well will receive a wish once a year until the 3 wishes on the residue are exhausted." ]
];

// @MARKER THE LISTS
// Each is read by a plain draw: a die of as many sides as the list has entries. They are his own
// hard-coded lists, not the compendia (his sheet never reads the compendia), so a race or skill added
// to the port later is not in them until his sheet's is.

// getRandomLandAnimal (sheet-worker.js:29118). The bare "Horse", "Insect", "Snake" and "Spider" rows send the roll on to the four lists below, as his code does.
export const RANDOM_ANIMALS = [
		"Addax", "Alligator", "Antelope/Gazelle", "Badger", "Bat", "Bat(Vampire)", "Bear(Black)", "Bear(Brown)",
		"Bear(Polar)", "Beaver", "Boar(Wild)", "Buffalo", "Camel", "Cat(House)", "Chameleon", "Cheetah",
		"Chimpanzee", "Condor", "Cougar", "Cow/Ox", "Coyote", "Crab", "Crocodile", "Cuttlefish", "Deer",
		"Dog(Attack)", "Dog(Guard)", "Dog(Hunting)", "Dolphin", "Donkey", "Eagle", "Elephant", "Elk", "Emu(Giant)",
		"Feeder", "Fish", "Floater", "Fox", "Frog/Toad", "Gila Monster", "Goat", "Gorilla", "Grim", "Hawk/Falcon",
		"High Mite", "Hippopotamus", "Horse", "Hyena(Brown)", "Hyena(Spotted)", "Insect", "Jackal", "Jellyfish",
		"Jellyfish(Giant)", "Kangaroo", "Leech", "Leopard", "Lion", "Lizard", "Llama", "Lobster", "Lynx", "Manatee",
		"Marten/Fisher/Sable", "Meerkat", "Mink", "Monkey", "Moose", "Narwhal", "Octopus", "Octopus(Giant)",
		"Opossum", "Orangutan", "Ostrich", "Otter", "Owl", "Penguin", "Pig", "Porcupine", "Porpoise", "Rabbit/Hare",
		"Raccoon", "Ram(Bighorn)", "Rat/Mouse", "Raven/Crow", "Rhinoceros", "Salamander", "Salamander(Gecko)",
		"Sea Anemone", "Sea Anemone(Giant)", "Sea Lion", "Seahorse", "Seal", "Seal(Elephant)", "Scorpion", "Shark",
		"Shark(Giant)", "Shark(Whale)", "Sheep", "Squid", "Squid(Colossal)", "Squid(Giant)", "Skunk", "Slug",
		"Snail", "Snake", "Spider", "Squirrel", "Squirrel(Flying)", "Tiger", "Tiger(Saber-toothed)", "Tortoise",
		"Turtle", "Turtle(Sea)", "Walrus", "Warthog", "Weasel", "Whale", "Wolf", "Wolverine", "Wooly Mammoth",
		"Wooly Rhinoceros", "Worm", "Worm(Bore)", "Worm(Glow)", "Zebra"
];

// horselist
export const RANDOM_HORSES = [
		"Horse(Draft)", "Horse(Heavy War)", "Horse(Light War)", "Horse(Medium War)", "Horse(Racing)",
		"Horse(Riding)"
];

// insectlist
export const RANDOM_INSECTS = [
		"Insect(Ant)", "Insect(Bee)", "Insect(Beetle)", "Insect(Floating)", "Insect(Glowing)", "Insect(Grasshopper)",
		"Insect(Praying Mantis)", "Insect(Wasp)", "Insect(Disease Bearing Insects)", "Insect(Venomous)",
		"Insect(Water)", "Insect(Web Weaving)", "Insect(Weak Venomous)", "Insect(Web Weaving/Venomous)",
		"Insect(Web Weaving/Weak Venomous)"
];

// snakelist
export const RANDOM_SNAKES = [
		"Snake(Boa Constrictor)", "Snake(Rattlesnake)", "Snake(Cobra)", "Snake(Spitting Cobra)",
		"Snake(Watermoccassin)"
];

// spiderlist
export const RANDOM_SPIDERS = [
		"Spider(Jumping)", "Spider(Trap Door)", "Spider(Venomous)", "Spider(Water)", "Spider(Weak Venomous)",
		"Spider(Web Weaving)"
];

// getElementType (sheet-worker.js:28798)
export const RANDOM_ELEMENTS = [
		"Water", "Air", "Earth", "Fire", "Life", "Death", "Chaos"
];

// getRandomSubstance (sheet-worker.js:29166)
export const RANDOM_SUBSTANCES = [
		"Wood", "Stone", "Metal", "Crystal"
];

// getRandomPlane (sheet-worker.js:29173). "Fae," keeps his comma.
export const RANDOM_PLANES = [
		"Natural Universe", "Phase Plane", "Shadow Plane", "Plane of Water", "Plane of Fire", "Plane of Air",
		"Plane of Earth", "Plane of Light/Life", "Plane of Death/Void", "Plane of Chaos", "Fae,", "Rockholm",
		"Veil of Dreams", "Plane of the Lost/Junk", "Ethereal Plane", "Plane of Order", "Balance(Entrance)",
		"The Hells(Entrance)", "The Heavens(Entrance)", "Abyss(Entrance)", "Perfection(Entrance)",
		"Alternate Reality"
];

// getRandomSubject (sheet-worker.js:29180). "Betrayl" is his spelling.
export const RANDOM_SUBJECTS = [
		"History", "Skill", "Social Skill", "Spell", "Warning", "Betrayl", "Story", "Advice", "Politics",
		"Philosophy", "Prophecy", "Religion", "Gossip", "Legends", "Soothing Comfort"
];

// getRandomSkill (sheet-worker.js:29190): his own hard-coded list, 471 names.
export const RANDOM_SKILLS = [
		"Abasement", "Absorb Aura", "Acrobatics", "Alter Destiny", "Amplify Item", "Animal Lore",
		"Animal Projection", "Animal Shape", "Anticipation", "Apathy", "Apparokinesis", "Arcane Arrow",
		"Arcane Pact", "Arcane Ascendance", "Arch Ritual", "Area Sense", "Armor Knowledge", "Armor Lore",
		"Artifact Lore", "Artificer Lore", "Assassinate", "Aura Arrow", "Aura Blast", "Aura of Life",
		"Aura of Protection", "Aurakinesis", "Awaken Forest", "Awaken Plant", "Awe", "Balance", "Balanced Mind",
		"Ballad Lore", "Banish", "Battle Cry", "Beautify", "Beguile", "Bellow", "Berserking", "Bestiary Lore",
		"Bind Control", "Bind Element", "Bind Form", "Bind Soul", "Bind Spirit", "Bind Supernatural", "Blasphemy",
		"Blend", "Bless", "Blood Lust", "Body Control", "Body Parry", "Bone Lore", "Brace", "Break Fall",
		"Cacophony", "Call of Air", "Call of Aura", "Call of Death", "Call of Earth", "Call of Flame",
		"Call of Life", "Call of the Light", "Call of Water", "Call Spirit", "Call Undead", "Candle Lore",
		"Cartography", "Cause Disease", "Caustokinesis", "Channel Life Force", "Chant", "Charming", "Cheat",
		"Chi Sense", "Climb", "Coexist with Undead", "Condition Undead", "Confess", "Confusion",
		"Consecutive Normal Punches", "Conspicuous Concealment", "Control Growth", "Control Supernatural",
		"Control Undead", "Convert", "Convert Negative Life Force", "Counter Divinity", "Counter Magic", "Convince",
		"Cover Tracks", "Critical", "Cryokinesis", "Crystal Lore", "Cure Disease", "Cure Insanity", "Cure Poison",
		"Curse", "Danger Knowledge", "Darkness", "Death Visage", "Deception", "Decipher", "Defy Divinity",
		"Defy Magic", "Demysticize", "Depth Knowledge", "Destiny", "Destroy Undead", "Destruction",
		"Detect Alignment", "Detect Aura", "Detect Curse", "Detect Evil", "Detect Good", "Detect Magic",
		"Detect Supernatural", "Detect Trap(u)", "Detect Trap(w)", "Devastation", "Devout Supplication",
		"Direction Knowledge", "Disable", "Disappear", "Disarm", "Discord", "Disenchant", "Disguise",
		"Distance Knowledge", "Divination", "Divine Knowledge", "Divine Protection", "Divine Shield",
		"Divine Speaker", "Dodge", "Draw Power", "Dream Call", "Dream Create", "Dream Enchant", "Dream Shift",
		"Dream Summon", "Drum", "Echoes of Creation", "Electrokinesis", "Elemental Arrow", "Elemental Knowledge",
		"Elemental Mastery", "Elemental Supremacy", "Elixir", "Emanant Peace", "Empathy", "Empathy Magic", "Empower",
		"Enchant Item", "Enchant Ship", "Enchanting Lore", "Enchanted Voice", "Endow Weapon",
		"Energetic Dissolution", "Enfeeblement", "Enigma", "Enthrall", "Entropy", "Equalize", "Eradication",
		"Escape", "Evoke", "Excommunicate", "Exemplar Mounted Archer", "Exorcism", "Expulsion", "False Attack",
		"Familiar", "Fate", "Fear", "Fearless", "Feint", "Fencing", "Festival Lore", "Find Legend", "Find Treasure",
		"Finding", "Flesh Lore", "Flowing Thought", "Focused Attack", "Force", "Foresee", "Foretell", "Forgery",
		"Future Shadows", "Gaea Lore", "Gate", "Gateway", "Geas", "Glorious Redemption", "Glyph", "Gravikinesis",
		"Gullibility", "Gypsy Wagon", "Harmony", "Haunted Grove", "Healing", "Herb Lore", "Hermetic Lore",
		"Heroic Endurance", "Hex", "Horsemanship", "Hymn Lore", "Identify", "Identify Artifact",
		"Illusion Knowledge", "Illusion Lore", "Imbue", "Imbue Armor", "Imbue Weapon", "Immaculate Grace",
		"Impart Potential", "Impunity", "Incite", "Indominable Speed", "Inescapable", "Inevitable", "Infinite Jest",
		"Influence the Dead", "Infusion", "Insanity", "Intercede", "Interdict", "Interpose", "Intervene",
		"Intimidation", "Intone", "Intrepid Countenance", "Item Tell", "Jewelry Knowledge", "Kinetic Blast",
		"Kinetics Knowledge", "Kinetics Lore", "Kinetics Mastery", "Know", "Language Lore", "Law", "Leap",
		"Legend Lore", "Lethargy", "Levitation", "Lie", "Life Sense", "Life Strike", "Light", "Lightfire Knowledge",
		"Lightfire Lore", "Lightfire Mastery", "Light Step", "Listen", "Living Strike", "Luck", "Luminous Form",
		"Lumokinesis", "Magnetokinesis", "Malaise", "Mark of the Pursuer", "Martial Knowledge", "Martial Lore",
		"Mask Life Force", "Mass Delusion", "Mass Ritual", "Massmind", "Matter Lore", "Meditate", "Mesmerization",
		"Metal Lore", "Mimic", "Mind Blast", "Mind Dance", "Mind Link", "Misconception", "Missile Lore", "Mock",
		"Move Unheard", "Move Unseen", "Multiple Missile Knowledge", "Multiple Missile Lore", "Musical Purity",
		"Narrate", "Nature Lore", "Nature’s Ground", "Navigate", "Nerve Strike", "Numinous Conviction", "Omen",
		"Open Locks", "Order Knowledge", "Order Lore", "Order Mastery", "Percussion Lore", "Perfect Shot", "Phase",
		"Plague", "Planar Lore", "Plane Shift", "Plane Walk", "Plant Shape", "Play", "Poem Lore", "Poison Lore",
		"Possession", "Potion Lore", "Predation", "Predict", "Prestidigitation", "Projectile Knowledge",
		"Projectile Lore", "Protection from Evil", "Protection from Good", "Protection from Supernatural",
		"Psalm Lore", "Pyrokinesis", "Quest", "Quick Load", "Radiant Life Force", "Rain of Missiles",
		"Raise Undead Horde", "Rally", "Rally Undead", "Read Dream", "Read Past", "Recite", "Recover",
		"Regeneration", "Reincarnation", "Relentless Pursuit", "Remove Curse", "Remove Fear", "Remove Trap(u)",
		"Remove Trap(w)", "Resplendent Faith", "Restore Life Force", "Resurrection", "Retain Control", "Rhythm Lore",
		"Rhythmic Mastery", "Ritual Lore", "Ruins Lore", "Rune Lore", "Sacred Grove", "Sail", "Schism",
		"Scroll Knowledge", "Scrying", "Seal Aura", "Second Weapon Knowledge", "Second Weapon Lore",
		"Sense Projection", "Sense Supernatural", "Serious Punch", "Set Trap(u)", "Set Trap(w)", "Sever",
		"Shadow Form", "Shadowfrost Knowledge", "Shadowfrost Lore", "Shadowfrost Mastery", "Shadow Shift",
		"Shadow Walk", "Shadowing", "Shadows of Heroes Past", "Shape Shift", "Shield Knowledge", "Shield Parry",
		"Shift Time", "Sidestep", "Sigil", "Sing", "Slay", "Sleight of Hand", "Slow Fall", "Smell", "Somnolence",
		"Song Lore", "Sonokinesis", "Soothe", "Soul Break", "Soul Knowledge", "Soul Rend", "Soul Shackle",
		"Soul Tap", "Soul Touch", "Soulbound Item", "Speaker of the Gods", "Speak to Animal", "Speak to Dead",
		"Speak to Plant", "Speak to Stone", "Spell Arrow", "Spell Lore", "Spin Strike", "Spirit Dance",
		"Spirit Strike", "Spirit Travel", "Spirit Weapon", "Steadfast", "Steadfast Bulwark", "Steal", "Steal Magic",
		"Steal Negative Life Force", "Still Life Force", "Stone Lore", "Street Knowledge", "Street Lore", "Stun",
		"Stupor", "Summon", "Summon Animal", "Summon Object", "Summon Supernatural", "Suppress Undead Compulsion",
		"Surprise Attack", "Susceptibility", "Sweep", "Sympathize", "Sympathy", "Sympathy Magic",
		"Synthesize Material", "Talisman", "Tame Animal", "Telekinesis", "Temporokinesis", "Thought Projection",
		"Torpor", "Totem Call", "Track", "Tranquil Mind", "Tranquility", "Transcendent Archery", "Transmogrify",
		"Transmutation", "Trap Weapon", "Trip", "True Banish", "True Dream", "True Faith", "True Recovery",
		"Truth Tell", "Turn of the Tide", "Turn Undead", "Umbrakinesis", "Undead Lore", "Unification",
		"Usurp Control", "Valiant Physique", "Voice of Cacophony", "Voice of Purity", "Warp Thought", "Water Lore",
		"Weapon Call", "Weapon Dance", "Weapon Knowledge", "Weapon Lore", "Weapon Parry", "Weather Lore",
		"Weave Magic", "Wellspring", "Whisper", "Wild Magic", "Will Strike", "Winds of Wild Magic",
		"Winged Deliverance", "Withering", "Wood Lore", "Wounding", "Zen Archery"
];

// getRandomSocialSkill (sheet-worker.js:29197): his own hard-coded list, 201 names.
export const RANDOM_SOCIAL_SKILLS = [
		"Accounting", "Acting", "Administration", "Animal Husbandry", "Animal Training", "Anthropology", "Appraisal",
		"Archaeology", "Architecture/Engineering", "Armoring", "Artisan", "Astrology", "Astronomy", "Baking/Cooking",
		"Ballooning", "Banker/Broker", "Bar/Inn Keeping", "Barbering", "Barrel Making", "Bartering/Haggling",
		"Basket Weaving", "Bee Keeping/Insect Handling", "Begging", "Boat Wright", "Bookbinder", "Botanist",
		"Brewing", "Butcher", "Butler", "Cabinetry", "Cage Making", "Calligraphy", "Candle/Oil Making", "Carousing",
		"Carving", "Chariot Driving", "Chariot Making", "Chemistry", "Chirugeon", "Climatology", "Clowning/Jesting",
		"Cobbling", "Collecting", "Composer", "Cosmetics", "Courtesan", "Craftsman", "Crying/Hawking", "Dancing",
		"Debating", "Diplomacy", "Diving", "Doll Making", "Drawing/Sketching", "Drilling", "Drudgery", "Dyer",
		"Economics", "Engraving/Etching", "Espionage", "Etiquette", "Excavation", "Explorer", "Exploser", "Falconry",
		"Farming/Planting", "Fashion", "Ferrier", "Fire Making", "Fishing", "Fletching/Bow Making", "Flint Knapping",
		"Florist/Horticulturist", "Foraging/Forestry", "Forensics", "Fortune Telling", "Furniture Making",
		"Gambling", "Gemology", "Genealogy", "Geography", "Geology", "Glass Blowing", "Gossip Mongery",
		"Haberdasher", "Harlotry", "Harvesting", "Heavy Drinking", "Heraldry", "History", "Hunting/Trapping",
		"Hydrology", "Instruction", "Instrument Making", "Instrument Playing", "Inventor", "Irrigation", "Juggling",
		"Kite Flying", "Laborer", "Lady Servant", "Leadership", "Leather Working", "Leeching", "Lens Making",
		"Librarian", "Lip Reading", "Locksmith", "Logic", "Loom Mastery", "Lumberjack", "Massage Therapy",
		"Mathematics", "Metal Working", "Metallurgy", "Metaphysics", "Meteorology", "Midwife", "Milling",
		"Mining/Tunneling", "Mocking", "Mountaineering", "Music Theory", "Oceanography", "Overseer/Manager", "Page",
		"Painting", "Paving/Road Building", "Perfume/Scent Making", "Philosophy", "Physics", "Physiology",
		"Plumbing", "Politics", "Pottery Making", "Printing/Typesetting", "Prospecting", "Psychology", "Pulper",
		"Puppetry", "Pyrotechnics", "Recite Poetry", "Reporting/Journalism", "Riding", "Rope Making", "Rope Use",
		"Rowing", "Running", "Sapping", "Scavenging", "Scholar", "Science", "Scribing", "Sculpting", "Sewing",
		"Shepherdry", "Signaling", "Sing Songs", "Skinning/Tanning", "Slave Driving", "Smithy", "Soap Making",
		"Soldiering", "Spelunking", "Spinning", "Squire", "Steam Power", "Stone Masonry", "Store Keeping",
		"Story Telling", "Supplier", "Surfing", "Surveyor", "Survival", "Swimming", "Tactics/Strategy", "Tailoring",
		"Tattoo Artistry", "Taxidermy", "Theology", "Tightrope Walking", "Tobacconist", "Tool Making", "Torturing",
		"Translating", "Tumbling", "Undertaking", "Upholstery", "Valet", "Ventriloquism", "Wagon/Carriage Driving",
		"Wagon/Carriage Making", "Water/Wind Power", "Weapon Making", "Weaving", "Wheel Wright", "Wigweaving",
		"Wood Curing", "Wood Cutting", "Wood Working", "Writing"
];

// getRandomRace (sheet-worker.js:28103)
export const RANDOM_RACES = [
		"Apocritara", "Arachen", "Avian(Dark)", "Avian(Forest)", "Avian(Mountain)", "Ba’Cora", "Beastman",
		"Brachara", "Brok", "Brownie", "Centaur", "Cervara", "Changeling", "Chetahl", "Crystori", "Dao", "Djinn",
		"Dryad", "Dwarf(Civilized)", "Dwarf(Dark)", "Dwarf(Fire)", "Dwarf(Iron)", "Dwarf(Mountain)", "Dwarf(Stone)",
		"Elf(Dark)", "Elf(Desert)", "Elf(Dread)", "Elf(Gray)", "Elf(High)", "Elf(Ice)", "Elf(Sea)", "Elf(Shadow)",
		"Elf(Silver)", "Elf(Wild)", "Elf(Wood)", "Equara", "Fairy", "Fairy(Dark)", "Famorian", "Formless", "Gaunt",
		"Geebra", "Giant(Civilized)", "Giant(True)", "Gnome", "Goblin(Forest)", "Goblin(Mountain)", "Goblin(Plains)",
		"Grahl", "Gremlin", "Grethen", "Gryphara", "Hippotara", "Hobgoblin", "Human(Barbaric)", "Human(Civilized)",
		"Ifrit", "Jumara", "Katara", "Kenku", "Kerasara", "Lagara", "Leprechaun", "Lissara", "Lotara", "Loxodara",
		"Lutrinara", "Maginos", "Marid", "Mechanos", "Mellivara", "Mephyt(Fire)", "Mephyt(Ice)", "Merfolk",
		"Midfolk(Forest)", "Midfolk(River)", "Midfolk(Town)", "Nixie", "Nymph", "Ogre", "Planar", "Podling",
		"Ratahl", "S’rett", "Sasquatch/Yeti", "Satyr/Fawn", "Saurian", "Scethen", "Se’eth", "Sha’Cora", "Sporeling",
		"Sura’keth", "Sura’rath", "Susara", "Sylph", "Taurian", "Testudara", "Troll", "Troll(Ice)", "Troll(Rock)",
		"Ursara", "Vulpara", "Whalrog", "Wildling", "Wolfen", "Xar’Xeth"
];

// getRandomClass (sheet-worker.js:28119)
export const RANDOM_CLASSES = [
		"Acrobat", "Alchemist", "Arcanist", "Archer", "Archer(Arcane)", "Archer(Zen)", "Assassin", "Bandit",
		"Banisher", "Bard", "Battlemancer", "Beastmaster", "Beguiler", "Berserker", "Border Scout", "Bounty Hunter",
		"Buccaneer", "Cacophonist", "Cajoler", "Cavalier", "Channeler", "Conqueror", "Crypt Robber", "Curse Breaker",
		"Delver", "Dervish", "Dreamer", "Druid", "Duelist", "Elemental Dancer", "Elementalist", "Enchanter",
		"Exorcist", "Explorer", "Gypsy", "Harbinger", "Harmonist", "Healer", "Heretic", "Hermeticist", "Hero",
		"Hunter", "Illuminator", "Innominate", "Inquisitor", "Intercessor", "Investigator", "Jester", "Kineticist",
		"Knight", "Knight(Dark)", "Knight(Death)", "Legendier", "Luckster", "Mage", "Martial Artist", "Medium",
		"Mentalist", "Minstrel", "Missionary", "Monk", "Mounted Archer", "Necromancer", "Obscuratum", "Paladin",
		"Plunderer", "Priest", "Priest(Dark)", "Psychokineticist", "Ranger", "Ritual Leader", "Rogue", "Runesmith",
		"Sage", "Seer", "Shadow Stalker", "Shadowfrost Caster", "Shaman", "Shaman(Drum)", "Shaman(Rune)", "Sorcerer",
		"Summoner", "Trickster", "Vivisectionist", "Warden", "Warrior", "Wilder", "Witch(Black)", "Witch(Gray)",
		"Witch(White)", "Witch Hunter"
];

// getRandomAlignment (sheet-worker.js:28130)
export const RANDOM_ALIGNMENTS = [
		"Fanatical Good(Active)", "Fanatical Good(Passive)", "Good(Active)", "Good(Passive)", "Neutral Good(Active)",
		"Neutral Good(Passive)", "Neutral(Active)", "True Neutral", "Neutral(Passive)", "Neutral Evil(Active)",
		"Neutral Evil(Passive)", "Evil(Active)", "Evil(Passive)", "Fanatical Evil(Active)",
		"Fanatical Evil(Passive)", "Insane"
];

// getRandomSpellByLevel (sheet-worker.js:170027): one list per Aura level; a level with no list gives nothing, as his switch does.
export const RANDOM_SPELLS_BY_AURA = {
	1: [
		"Chill", "Clean", "Color", "Enhance Taste", "Flicker", "Hold Plant", "Magic Skin", "Magic Tongue", "Message",
		"Move", "Plant Speak", "Produce Food", "Produce Light", "Produce Water", "Trip", "Warm",
		"Detect Temperature", "Tree Message", "Produce Scent", "Produce Taste", "Water Message"
	],
	2: [
		"Animal Speak", "Climb", "Dig", "Distract", "Float", "Hide", "Hold Animal", "Illusion of Taste", "Jump",
		"Mend", "Predict Weather", "Produce Smoke", "Read", "Read Aura", "Shock", "Draw Water", "Static Charge",
		"Endure Light", "Produce Sound", "Produce Texture"
	],
	3: [
		"Adhere", "Catch", "Enhance Smell", "Force Shield", "Freshen", "Interdimensional Message", "Levitate",
		"Magic Ear", "Night Vision", "Plant Control", "Produce Clothing", "Produce Fire", "Produce Fog", "Mask Odor",
		"Static Charge", "Tree Sound", "Water Sound"
	],
	4: [
		"Alarm", "Detect Enemy", "Enhance Touch", "Entwine", "Fast Freeze", "Fist of Magic", "Hold", "Ignite",
		"Illusion of Smell", "Magic Eye", "Magic Voice", "Mystical Mapping", "Plant Move", "Quick Dry", "Soak",
		"Mask Heat", "Sand Swim", "Static Shield", "Finger of Dissonance", "External Focus"
	],
	5: [
		"Call Animal", "Control Animal", "Fly", "Deafen", "Mind Beast", "Mold", "Plant Growth", "Protection",
		"Reduce Fatigue", "Reveal Aura", "Seal", "Slumber", "Throw", "Protection from Plants", "Shade Touch",
		"Shadowless", "Evaporate", "Sense Land", "Tree Sight", "Depilate", "Hypertrichosis", "Imbue Magical Aura",
		"Produce Earth", "Water Sight", "Item Tether", "Magic Underlayment"
	],
	6: [
		"Control Water Elemental", "Darkness", "Detect Illusion", "Finger of Cold", "Glamour", "Illusion of Sound",
		"Mind Wipe", "Path Find", "Produce Wood", "Repulsion", "Runes", "Silence", "Storm of Dust", "Symbiosis",
		"Telepathy", "Tumble", "Web of Entanglement", "Earth Swim", "Circle of Cold", "Dismiss Familiar",
		"Hold Magical Plant", "Protection from Animals", "Leaves of Marking", "Endure Dissonance", "Lighten Load",
		"Phase Adhere", "Shadow Adhere", "Storm of Dissonance", "Wall of Dissonance", "Shadow Blend"
	],
	7: [
		"Bars", "Bind", "Blind", "Breathless", "Create Door", "Delay", "Detect Traps", "Distortion",
		"Enhance Hearing", "Enhance Perception", "Far Slumber", "Force Limb", "Locate", "Misdirection", "Mute",
		"Produce Stone", "Remove Poison", "Slow", "Call Familiar", "Hold Magical Animal", "Protection from Slime",
		"Wraith Touch", "Leaves of Fellowship", "Tokens of Marking", "Dismiss Supernatural Familiar",
		"Transformation Pocket", "Magic Mail"
	],
	8: [
		"Accuracy", "Control Air Elemental", "Control Humanoid", "Detect Invisibility", "Endure Cold",
		"Finger of Fire", "Illusion of Sight", "Mind Change", "Produce Metal", "Propel", "Protection from Undead",
		"Statue", "Storm of Cold", "Tumblers", "Wall of Wood", "Circle of Fire", "Recall Buoy", "Sense Movement",
		"Protection from Magical Plant", "Life Blindness", "Wall of Darkness", "Wall of Light",
		"Tokens of Fellowship", "Tree Summon", "Absorb Dissonance", "Aura of Dissonance",
		"Call Supernatural Familiar", "Endure Pressure", "Fade", "Freewalk", "Mask Life", "Mimic Mind",
		"Water Summon"
	],
	9: [
		"Call", "Control Undead", "Endure Poison", "Enhance Sight", "Phase Weapon", "Set", "Stone Swim",
		"Storm of Daggers", "Wall of Ice", "Warding", "Wizard Rune", "Control Slime", "Protection from Humanoid",
		"Ghoul Touch", "Manipulate Light", "Manipulate Shadow", "Lesser Force Weapon", "Ice Swim", "Sense Ship",
		"Tree Mind Touch", "Bind Supernatural Familiar", "Shadow Weapon", "Water Mind Touch", "Magic Plate"
	],
	10: [
		"Control Earth Elemental", "Disruption", "Duplicate Self", "Endure Heat", "Enhance Speed",
		"Finger of Electricity", "Illusion of Feeling", "Invisibility", "Mind Monster", "Mind Set", "Mirror Wall",
		"Non-Detection", "Piercing", "Produce Shelter", "Protection from Supernatural", "Reflection", "Sharpness",
		"Storm of Fire", "Telekinesis", "Transmute to Flesh", "Wall of Fire", "Wall of Stone",
		"Circle of Electricity", "Teleport Buoy", "Bind Familiar", "Hold Magical Humanoid", "Control Magical Plant",
		"Protection from Magical Animal", "Discern Control", "Aura of Ice", "Winds of Traveling", "Absorb Cold",
		"Change Gender", "Disrupt Coordination", "Earthbound", "Eavesdrop", "Enhance Coordination", "Fulcrum",
		"Kinetic Barrier", "Stasis Shield"
	],
	11: [
		"Animate Object", "Confuse", "Control Temperature", "Detect Protection", "Dispel Invisibility", "Extend",
		"Mask Aura", "Paralyzation", "Repair", "Scrying", "Slovenliness", "Storm of Arrows", "True Flight",
		"Unphase", "Wall of Metal", "Wall of Protection", "Control Magical Animal", "Protection from Magical Animal",
		"Vampiric Touch", "Blink Token", "Mists of the Sea", "Wall of Crystal", "Wall of Silence",
		"Finger of Repulsion", "Scenic Portal", "Unshadow"
	],
	12: [
		"Conceal Magic", "Control Fire Elemental", "Dispel Illusion", "Elemental Water Form", "Endure Electricity",
		"Entrancement", "Feeblemindedness", "Finger of Deterioration", "Frictionless", "Illusion of Sensing",
		"Mirror Maze", "Produce Poison", "Sphere of Protection", "Storm of Electricity", "Summon Water Elemental",
		"Thunderclap", "Transmute to Stone", "Wall of Electricity", "Control Magical Humanoid", "Avoid Protection",
		"Grave Mapping", "Aura of Fire", "Produce Crystal", "Tree Walk", "Absorb Heat", "Chaos Touch",
		"Duplicate Mind", "Portrait Portal", "Water Walk"
	],
	13: [
		"Animate Bone", "Animate Flesh", "Brilliance", "Dispel Protection", "Invulnerability", "Merge", "Phase",
		"Size Change", "Teleport", "Touch of Pain", "Transport", "Weakness", "Know Movement",
		"Control Death Elemental", "Control Life Elemental", "Deep Walk", "Sunder", "Dampen", "Endure Repulsion",
		"Portrait Summons", "Shadow Shift", "Shifting Pocket", "Storm of Repulsion", "Wall of Repulsion"
	],
	14: [
		"Change Self", "Command Word(Sleep)", "Command Word(Fear)", "Command Word(Truth)", "Command Word(Surrender)",
		"Command Word(Kill)", "Command Word(Pain)", "Command Word(Death)", "Control Aura Elemental", "Discourage",
		"Elemental Air Form", "Finger of Acid", "Force Armor", "Frost Fire", "Life Sensing", "Mind Link",
		"Mind Swap", "Persuasion", "Summon Air Elemental", "Transmute to Wood", "Circle of Acid",
		"Illusion of Control", "Aura of Electricity", "Snow Form", "Absorb Repulsion", "Air Shroud", "Simulacrum",
		"Force Duplicate Item"
	],
	15: [
		"Change Other", "Construct", "Dispel Magic", "Enhance Personal", "Geas", "Inflict Insanity", "Luck",
		"Mind Trap", "Raise Undead Spirit", "Stasis", "Storm of Spears", "Summon", "Time Sight", "Wall of Power",
		"Reinforce Control", "Dry Drowning", "Interchange", "Sand Form", "Aura of Repulsion", "Item Pocket",
		"Produce Any", "Void Walk", "Control Magical", "Foe Strike", "Mind Horror", "Rebound"
	],
	16: [
		"Combine", "Control Gravity", "Disrupt Spell", "Duplicate Spell", "Elemental Earth Form", "Endure Acid",
		"Enhance Mental", "Seeking", "Sphere of Power", "Storm of Acid", "Storm of Paralysis",
		"Summon Earth Elemental", "Transmute to Crystal", "Unlucky", "Circle of Deterioration", "Aura of Acid",
		"Fog Form", "Absorb Electricity", "Improve"
	],
	17: [
		"Blink", "Change True", "Dimension", "Enchant Area", "Enhance Physical", "Improved Telepathy", "Incinerate",
		"Intensify", "Plane Shift", "Raise Greater Undead", "Spell Merge", "Storm of Bolts", "Warp Magic",
		"Circle of Paralysis", "Commandeer", "Shadow Attack", "Ice Form", "Nullify"
	],
	18: [
		"Anti-Divinity", "Bane", "Banish", "Disintegrate", "Elemental Fire Form", "Endow Intelligence",
		"Enhance Mystical", "Explosion", "Spell Absorption", "Storm of Deterioration", "Summon Fire Elemental",
		"Force Weapon", "Endure Aura", "Rock Form", "Absorb Acid", "Air Pocket", "Endure Deterioration",
		"Illusion of Memory", "Interconnected", "Spark Splash", "Conditional Enchantment", "Transmute to Metal"
	],
	19: [
		"Aura Strike", "Cache", "Permanency", "Raise Greater Undead Spirit", "Rebirth", "Reincarnate",
		"Spell Turning", "Withering", "Fortify", "See Movement", "Elemental Death Form", "Elemental Life Form",
		"Summon Death Elemental", "Summon Life Elemental", "Ash Form", "True Duplicate", "Enchant Emblem"
	],
	20: [
		"Corrupt", "Creation", "Elemental Aura Form", "Enchantment", "Summon Aura Elemental", "Wish", "Vanish",
		"Ignore Protection", "Aura of Chaos", "Crystal Form", "Endure Death", "Endure Life", "Finger of Chaos",
		"Absorb Chaos", "Aura of Deterioration", "Absorb Divinity"
	],
	21: [
		"Mass Move", "Time Shift", "True Sight", "Lava Form"
	],
	22: [
		"Duplicate Item", "Mass Produce", "Stone Sleep", "Endure All", "Absorb Death", "Absorb Life"
	],
	23: [
		"Mass Flight", "Mass Invisibility", "Phylactery"
	],
	24: [
		"Morale", "Steal Personal"
	],
	25: [
		"Mass Summon", "Maelstrom", "Steal Mental", "Transmutation", "Finger of Death", "Finger of Life",
		"Aura of Death", "Aura of Life", "Storm of Chaos", "Wall of Chaos", "Inscrutable", "Recursion",
		"Time Barrier"
	],
	26: [
		"Call Army", "Relocation", "Steal Physical"
	],
	27: [
		"Mass Change", "Protect Area", "Steal Mystical"
	],
	28: [
		"Distribute", "Divine Immunity", "Magic Immunity", "Time Displacement", "Absorb Obliteration"
	],
	29: [
		"Cataclysm", "Finger of Obliteration", "Pocket Dimension"
	],
	30: [
		"Genesis", "Storm of Death", "Storm of Life", "Absorb All", "Endure Obliteration", "Establish", "Fate Trap"
	],
	35: [
		"Aura of Obliteration", "Storm of Obliteration", "Wall of Obliteration"
	],
	40: [
		"Aura of All", "Finger of All"
	],
	50: [
		"Storm of All"
	],
	100: [
		"Unlimited Wish", "Mass Persuasion", "Pocket Universe", "Soul Jar", "Timeswept Lands", "Undying Lands"
	],
	500: [
		"Alter Reality"
	],
	1000: [
		"Universal Armageddon", "Universal Genesis"
	]
};

// @END (CODE)
