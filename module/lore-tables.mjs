// @START (CODE)
// @MARKER LORE TABLES
//==================================================================================================================
// GENERATED FILE -- do not edit by hand.
// Produced by tools/extract/extract_lore_tables.py from the original Roll20 sheet-worker.
// Regenerate rather than editing, or this will drift from his sheet.
//
// What his sheet hands a new character for the lores it holds -- provideRandomLoreAndLoreItems,
// sheet-worker.js:146686, run when "Provide random lore" is ticked on the last creation step --
// and the two tables that chain leans on: his poisons, which are built from a type and a potency
// rather than listed, and the starting spells a new caster is given.
//
// The rules that USE these are in module/lore-rules.mjs.
//==================================================================================================================

// @MARKER THE CHAIN -- one step per lore, in his order. "skills" are the one or two skill
// names the step counts (storeSkillCountForSkills); "stock" is the consumable a step also
// hands out doses of, beside the known entry.
export const STARTING_LORE_CHAIN = [
	{"kind": "ballad", "skills": ["Ballad Lore"], "from": "checkBalladLore (sheet-worker.js:146691)"},
	{"kind": "candlelore", "skills": ["Candle Lore"], "from": "checkCandleLore (sheet-worker.js:146731)"},
	{"kind": "empathymagic", "skills": ["Empathy Magic"], "from": "checkEmpathyMagic (sheet-worker.js:146771)"},
	{"kind": "glyph", "skills": ["Glyph"], "from": "checkGlyph (sheet-worker.js:146811)"},
	{"kind": "hymn", "skills": ["Intone", "Hymn Lore"], "from": "checkHymn (sheet-worker.js:146851)"},
	{"kind": "poem", "skills": ["Recite", "Poem Lore"], "from": "checkPoemLore (sheet-worker.js:146925)"},
	{"kind": "poisonrecipe", "skills": ["Poison Lore"], "from": "checkPoisonRecipeLore (sheet-worker.js:146965)", "stock": "poison"},
	{"kind": "potionrecipe", "skills": ["Potion Lore"], "from": "checkPotionLore (sheet-worker.js:147051)", "stock": "potion"},
	{"kind": "ritual", "skills": ["Ritual Lore"], "from": "checkRitualLore (sheet-worker.js:147092)"},
	{"kind": "rune", "skills": ["Rune Lore"], "from": "checkRuneLore (sheet-worker.js:147132)"},
	{"kind": "song", "skills": ["Sing", "Song Lore"], "from": "checkSongLore (sheet-worker.js:147172)"},
	{"kind": "sympathymagic", "skills": ["Sympathy Magic"], "from": "checkSympathyMagic (sheet-worker.js:147212)"},
	{"kind": "herb", "skills": ["Herb Lore"], "from": "checkHerbLore (sheet-worker.js:147252)"}
];

// @MARKER THE LISTS -- what each step draws from, keyed by his own function name.
export const STARTING_LORE_LISTS = {
	"getBalladLoreList":        ["Angel's Sorrow", "Animate", "Awaken", "Awaken Volcano", "Avalanche", "Banshee Resolve", "Belief", "Blood of the Vampire", "Bravery", "Control", "Deadwalk", "Decomposition", "Devil's Regret", "Dragon's Rest", "Dreamweave", "Find Enemy", "Firescreen", "Firesight", "Gateway", "Ghoul's Bite", "Greater Soothing", "Greater Animal Entrancement", "Greater Tranquility", "Healing", "Icemelt", "Illusion", "Insanity", "Joy", "Mask of Death", "Memory", "Mythbreaker", "Oasis", "Place of Safety", "Pain", "Plant Entrancement", "Remove Supernatural Influence", "Rockfall", "Rotting Wood", "Seafaring", "Shadow's Touch", "Sorrow", "Stonespeak", "Translation", "Waterwalk"],
	"getCandleLoreList":        ["Bind Animal Familiar", "Bound Return", "Break Love", "Brimstone", "Calm Sea", "Cast Shadow", "Coexist with Undead", "Control", "Comfort", "Create Love", "Death Stench", "Delay Angel", "Delay Devil", "Desert", "Divining Rod", "Endure Acid", "Endure Aura/Chaos", "Endure Cold", "Endure Darkness/Death", "Endure Fire", "Endure Electricity", "Endure Light/Life", "Harm Enemy", "Health", "Locate Animal", "Luck", "Mask Life Force", "Message", "Obscure Shadow", "Power", "Protection", "Protection from Elements", "Protection from Undead", "Reopening", "Relieve Disease", "Relieve Poison", "Returning", "Sailing", "Scrying", "Sense Animal", "Sense Elemental", "Smokescreen", "Soothe Dead", "Spirit Bind", "Spirit Speak", "Spirit Trace", "Treasure"],
	"getEmpathyMagicList":      ["Angel Ask", "Bind Magical Animal Familiar", "Censure", "Concentration", "Consign Spirit", "Deftness", "Deny Evil", "Fellowship", "Gather the Dead", "Heal", "Health Binding", "Holy Barrier", "Love", "Luck", "Message", "Mind Swap", "Mystic Binding", "Plant Bond", "Plant Projection", "Power", "Protection", "Remembrance", "Sanctify", "Scrutiny", "Seal Crypt", "Spirit Sight", "Still Evil", "Transfer", "Tree Meld", "Truth Binding", "Vital Binding", "Wealth", "Will Binding", "Wings", "Youthful"],
	"getGlyphList":             ["Angel's Glyph", "Armor Enchantment", "Deva's Glyph", "Devil's Glyph", "Final Peace", "Fortification", "Health", "Mobility", "Planar Travel", "Sensuality", "Speed", "Weapon Enchantment", "Weapons Glyph"],
	"getGoodHymnList":          ["Absolution", "Altruism", "Amenity", "Apology", "Beauty", "Benediction", "Call Celestial", "Comfort", "Confession", "Courage", "Creation(Clay/Cloth)", "Creation(Wood)", "Creation(Stone/Metal/Gem)", "Creation(Composite)", "Exorcism", "Fellowship", "Forgiveness", "Glorification", "Health", "Humility", "Judgment", "Justice", "Illumination", "Inhibition", "Loyalty", "Noontide", "Peace", "Prudence", "Purging", "Purification", "Regeneration", "Repentance", "Resurrection", "Salvation", "Sanctification", "Splendor", "Submission", "Thanksgiving", "Tolerance", "Truth", "Virtue"],
	"getEvilHymnList":          ["Concealment", "Condemnation", "Contamination", "Covetousness", "Damnation", "Darkness", "Deafness", "Deception", "Defilement", "Degeneration", "Depravation", "Enmity", "Estrangement", "Exoneration", "Frailty", "Greed", "Hatred", "Idiocy", "Infirmity", "Indulgence", "Ineptness", "Infliction", "Insolence", "Instillation", "Insubordination", "Isolation", "Jealousy", "Malady", "Malevolence", "Midnight", "Murder", "Necromancy", "Perversion", "Possession", "Prejudice", "Pride", "Revulsion", "Sacrilege", "Temptation", "Territorialism", "Vanity"],
	"getNeutralHymnList":       ["Aeromancy", "Alchemy", "Ancestry", "Animalism", "Apathy", "Arborism", "Aridity(Damage Elemental)", "Aridity(Dry Air)", "Aridity(Dry Skin)", "Aridity(Evaporate)", "Benevolence", "Call Deva", "Clairvoyance", "Cognition", "Conjuration", "Cryomancy", "Decay", "Decomposition", "Deterioration", "Diminishment", "Druidism", "Earth", "Elementalism", "Evocation", "Fertilization", "Geomancy", "Gnosticism", "Growth", "Humidity(Create Water)", "Humidity(Heal Elemental)", "Humidity(Hydromancy)", "Humidity(Wet Air)", "Humidity(Wet Skin)", "Immaterialism", "Mediocrity", "Mysticism", "Naturism", "Neutralization", "Preservation", "Pyromancy", "Recompense", "Reincarnation", "Rejuvenation", "Savagery", "Seasons", "Spirit", "Twilight", "Volcanism", "Winds", "Witchcraft"],
	"getUnalignedHymnList":     ["Communion", "Conversion", "Defection", "Desecration", "Destruction", "Determination", "Discernment", "Discipline", "Disintegration", "Divinity", "Doctrine", "Doubt", "Endangerment", "Endurance", "Enlightenment", "Erudition", "Fear", "Fervor", "Faith", "Fortune", "Foulness", "Hesitation", "Hindrance", "History", "Imbuement", "Injury", "Insight", "Invitation", "Invocation", "Joy", "Lethargy", "Manifestation", "Martyrdom", "Meditation", "Misfortune", "Mourning", "Nationalism", "Obliviousness", "Perception", "Piety", "Praise", "Prophecy", "Propitiation", "Protection", "Purity", "Refuge", "Renunciation", "Requiem", "Restoration", "Revelation", "Ritualism", "Revitalization", "Shielding", "Stealth", "Strength", "Suffocation", "Supplication", "Sustenance", "Timidity", "Transformation", "Warfare", "Velocity", "Vision(Enhanced Night Vision)", "Vision(Exceptional Eyesight)", "Vision(Far Sight)", "Vision(Infravision)", "Vision(Ultravision)", "Zeal"],
	"getPoemLoreList":          ["Anger", "Assemble", "Awaken", "Binding", "Blindness", "Boughbreak", "Compass", "Control", "Darkness", "Deep Sight", "Discernment", "Disassemble", "Dreaming Slumber", "Drowsiness", "Enrichment", "Fire", "Focus", "Free Spirit", "Frostbite", "Guilt", "Healing", "Illusion", "Listening", "Love", "Luck", "Night Vision", "Origin", "Pain", "Phase Door", "Preparation", "Return", "Reuse Portal", "Revealing", "Reveal Portal", "Shadow", "Shadow Door", "Shifting Sands", "Sleepwalk", "Snowdrift", "Snowwalk", "Soothe Undead", "Soothing", "Spirit Trap", "Springing", "Undead Fire Protection", "Undead Poison Protection", "Unlucky", "Warmth", "Water Finding", "Weather", "Webfoot"],
	"getPoisonTypeEvilList":    ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV"],
	"getPoisonTypeNeutralList": ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"],
	"getPoisonTypeGoodList":    ["I", "II", "III", "IV", "V"],
	"getPoisonPotencyList":     ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"],
	"getPotionLoreList":        ["Enhancing(All)", "Enhancing(Hearing)", "Enhancing(Sight)", "Enhancing(Smell)", "Enhancing(Taste)", "Enhancing(Touch)", "Enhancing(Hearing/Sight)", "Enhancing(Hearing/Smell)", "Enhancing(Hearing/Taste)", "Enhancing(Hearing/Touch)", "Enhancing(Sight/Smell)", "Enhancing(Sight/Taste)", "Enhancing(Sight/Touch)", "Enhancing(Smell/Taste)", "Enhancing(Smell/Touch)", "Enhancing(Taste/Touch)", "Enlarging", "Flight of the Zephyr", "Flying", "Healing", "Holy Fog", "Invisibility", "Life Giving", "Life Saving", "Life Sensing", "Masking Body", "Masking Mind", "Masking Spirit", "Masking Soul", "Mental Power", "Mystical Mage", "Nightmare", "Non-Detection", "Phase", "Pious Priest", "Plane Shifting", "Polymorphing", "Protection(Animals)", "Protection(Align:Evil)", "Protection(Align:Good)", "Protection(Align:Neutral)", "Protection(Angels/Archons)", "Protection(Demons/Devils)", "Protection(Dragons)", "Protection(Enemies)", "Protection(Giants)", "Protection(Humanoids)", "Protection(Supernatural)", "Protection(Undead)", "Reducing", "Regeneration", "Salamander's Touch", "Shadow Walking", "Silence", "Sleeping Potion(Strong)", "Speed", "Super Healing", "Telekinesis", "Teleportation", "Telepathy", "Tricky Thief", "True Sight", "Turn a Deaf Ear", "Vampire Repulsion", "Wondrous Warrior"],
	"getRitualLoreList":        ["Air Pass", "Atonement", "Bind Form", "Bind Magical Animal Familiar", "Break Love", "Burial", "Cause Love", "Chaos Pass", "Clarity of Intent", "Clarity of Purpose", "Clarity of Reality", "Clarity of Focus", "Clarity of Order", "Clarity of Chaos", "Clarity of Body", "Clarity of Mind", "Clarity of Spirit", "Clarity of Soul", "Concealment", "Conceal Dead", "Control", "Cure", "Death Pass", "Deva Demand", "Dream Pass", "Disguise Life Force", "Earth Pass", "Enhanced Breath", "Epitaph", "Final Acts", "Fire Pass", "Grave", "Guide Wind", "Health", "Impervious Forest", "Life Pass", "Link", "Locate Magical Animal", "Luck", "Magnify Shadow", "Negative Life Vapor", "Neutralize Curse", "Nightmare", "Obituary", "Pact", "Pact of Service", "Positive Life Vapor", "Power", "Preservation", "Protection", "Purification", "Rain Dance", "Release Dead", "Release Soul", "Release Spirit", "Remove Shadow", "Resonate Stone", "Reveal Life Force", "Scrying", "Seek Portal", "Sense Magical Animal", "Snow Storm", "Spiritual Advice", "Transcription", "Trap Swarm", "Treasure", "Unravel", "Water Pass", "Weather", "Wedding", "Wound Enemy"],
	"getRuneLoreList":          ["Absolve Control", "Absorption", "Accuracy", "Aethermark", "Ambidexterity", "Angel's Wings", "Anti-Divinity", "Anti-Magic", "Armor", "Balance", "Binding", "Boiling", "Collapse", "Corruption", "Cloudblend", "Day", "Deva's Mark", "Devil's Duplicity", "Direction", "Disguise Life Force", "Disruption", "Doorway", "Dreammark", "Dreamward", "Endure(Acid)", "Endure(Aura)", "Endure(Ice)", "Endure(Fire)", "Endure(Light)", "Endure(Lightning)", "Endure(Repulsion)", "Endure(Sound)", "Evocation", "Fear", "Fearless", "Fireblend", "Flame", "Force Armor", "Foresight(Day)", "Foresight(Week)", "Foresight(Month)", "Foresight(6 Months)", "Foresight(Year)", "Foresight(5 Years)", "Foresight(10 Years)", "Foresight(30 Years)", "Foresight(60 Years)", "Freezing", "Giddiness", "Gravestone", "Gravity", "Guardian Angel", "Health", "Hearth", "Iceblend", "Infusion", "Inner Chill", "Inner Warmth", "Ignore Protection", "Invulnerability", "Life", "Locating", "Locking", "Lostmark", "Lostward", "Luck", "Mark of Death", "Mark of Distinction", "Mark of Pain", "Mark of Ruin", "Marksmanship", "Mesmerization", "Melting", "Might", "Music", "Natural Darkness Rune", "Natural Darkness Sphere", "Natural Sunlight Rune", "Natural Sunlight Sphere", "Night", "Phasemark", "Phaseward", "Piercing", "Planarbind", "Planarmark", "Planarward", "Power", "Protection", "Protection from Undead", "Retrieval", "Reveal Life Force", "Righteousness", "Rune of Dissolution", "Rhythm", "Sandblend", "Scribing", "Sharpness", "Shadowmark", "Shadowward", "Sight", "Sobriety", "Soulmark", "Sound", "Speaking(Animal)", "Speaking(Empathy)", "Speaking(Plant)", "Speaking(Spirit)", "Speaking(Telepathy)", "Speed", "Sputter", "Stoneblend", "Strenghthen Wood", "Strenghthen Metal", "Truth", "Turn Undead", "Twilight", "Veil", "Wandering", "Warding(Animals)", "Warding(Elementals)", "Warding(Magical Animals)", "Warding(Humanoids)", "Warding(Undead)", "Warding(Supernatural)", "Waterblend", "Wavebreaker", "Wither"],
	"getSongLoreList":          ["Acid", "Anger", "Animal Entrancement", "Arms of the First", "Blindness", "Burrowing", "Calm Mind", "Calm Undead", "Calm Waves", "Chaos", "Cloudwalk", "Cold", "Control", "Crashing Waves", "Death Warrior", "Decay", "Dimensional Repair", "Discord", "Dream Item", "Electricity", "Elemental Transit", "Feasting", "Fear", "Fire", "Firewalk", "Flying", "Frozen Bones", "Gates of Glory", "Gates of Suffering", "Healing", "Illumination", "Illusion", "Incorruption", "Listening", "Love", "Luck", "Pain", "Paralysis", "Planar Traveling", "Protection", "Remembrance", "Replenishment", "Repulsive Sound", "Resist Supernatural Influence", "Return", "Return of the Lost", "Revealing", "Reveal Origin", "Rope Move", "Slumber", "Snowmelt", "Snowsight", "Spirit Grip", "Summon", "Sustaining", "Timeless Ruins", "Traveling", "Terror", "Tranquility", "Tree Parting", "Unlucky", "Undead Chill Protection", "Undead Disease Protection", "Untying", "Valor", "Warding", "Waterspeak", "Wayfaring", "Weariness", "Weave Plants"],
	"getSympathyMagicList":     ["Bind the Dead", "Blood Bond", "Burning", "Clumsiness", "Conscript Spirit", "Corrupt Health", "Corrupt Mystic", "Corrupt Truth", "Corrupt Vital", "Corrupt Will", "Crack Crypt", "Death Pact", "Deny Good", "Devil Debt", "Distraction", "Doubt", "Drain", "Enfeeble", "Expulsion", "Feral Instinct", "Forced Mind Swap", "Forgetfulness", "Frostbite", "Fumble", "Hate", "Hurt", "Leech", "Lycanthropy", "Poverty", "Reveal Spirit", "Still Good", "Trap Psyche", "Trust", "Unholy Barrier", "Unlucky", "Vulnerable", "Wingless"],
	"getHerbLoreList":          ["Aetherwart", "Aloe Vera", "Angel Feather", "Angel Fire", "Angel's Bane", "Angel's Sight Bark", "Angelica", "Angelwing", "Archon's Truth", "Arctic Lupine", "Ardentia", "Arnica", "Ash Lotus", "Ashbloom", "Ashbloom(Plane of Fire)", "Badger Thorn", "Bane Bulb", "Baneberry(Berry)", "Baneberry(Root)", "Baneflower", "Barrel Cactus", "Baywood Tree(Bark)", "Baywood Tree(Leaves-Tea)", "Baywood Tree(Leaves-Salve)", "Bearded Djinnroot", "Berserker Root", "Black Lotus", "Blazing Camel", "Blood Moss", "Bloodbone Rose", "Bloodfire Bark", "Bloodberry", "Bloodwort", "Blue Bay Creeper", "Bluebrine", "Bluesward", "Bluetide", "Borin's Salve", "Brinytop", "Brittlebush", "Bull's Horn", "Burning Lady", "Cage Vine", "Camelback", "Cankermist Creeper", "Castaway", "Cinderbane", "Clarifyne", "Clearcap", "Clearleaf", "Cloudbloom", "Cloudpuff", "Cracken Root", "Crowberry(Berries)", "Crowberry(Root)", "Crown Hickory", "Crowning Glory", "Crystalflare", "Crystoria", "Dabbledew", "Dead Man's Ghost", "Death's Head", "Death Berry", "Death Blossom", "Death Grin", "Deeproot", "Deepsprout", "Demon's Breath", "Desert Sage", "Desert Tea", "Devil's Bane", "Devil's Crown", "Devil's Grip", "Devil's Hemlock", "Devil's Root", "Devil's Walk", "Dragon Scale", "Dragonfyre", "Dragon's Fruit", "Dragon's Thorn", "Dragon's Wart", "Dreamberry", "Drifting Spider", "Driftvine", "Drybone", "Duskdawn Rose", "Dwarf's Head", "Eagle's Eye", "Earthblood", "Earth Heart(Bark)", "Earth Heart(Berry)", "Echinacea", "Elderberry(Berry)", "Elderberry(Flower)", "Elderberry(Leaves)", "Elf Leaf", "Eon Flower", "Essence Bulb", "Ever Bulb", "Everbloom", "Fateberry", "Fadegrass", "Feathergrass", "Fetterbone", "Fever Vine", "Feverweed", "Fierna's Folly", "Fiery Fingers", "Fire Cone", "Fire Bark", "Fireskin", "Firemoon", "Firepeak Moss", "Fireseed(Seed)", "Fireseed(Tree)", "Firestone Vine", "Fireweed", "First Tree Leaf", "Flaming Skull", "Flash Needle", "Fogweed", "Fool's Ear", "Frankincense", "Frostbloom", "Frostseed(Seed)", "Frostseed(Tree)", "Frostwolf", "Gagroot", "Gazing Heartfrond", "Garlic", "Gemstar", "Ghostberry", "Ghostroot", "Ginseng", "Ginkgo Biloba", "Glistening Fern", "Glowmoss", "Glowgate", "Glowscale", "Goblin Bane", "God's Eye", "Goldcrown", "Goldreed", "Golden Apple", "Golden Silkseed", "Gorgevine", "Gorin", "Gotu Kola", "Gravelseed(Seed)", "Gravelseed(Tree)", "Gray Lotus", "Greybreeze(Flower)", "Greybreeze(Leaf)", "Graymoss", "Graytusk Root", "Gray Wolf Bark", "Green Berry", "Grent(Bark)", "Grent(Leaf)", "Grent(Root)", "Grent(Sap)", "Grinning Zephyr", "Gypsy Rose(Flower)", "Gypsy Rose(Thorn)", "Handmaiden", "Harborsong", "Harmony Rose", "Hawthorn", "Heart Flower", "Heartbean", "Heaven's Gate", "Holly", "Horse Clover", "Hive Fruit", "Hubris Horns", "Hyssop", "Ice Melon", "Icebreaker", "Icepetal", "Jeering Skullcap", "Kava Kava", "Kindle Rose", "King's Clover", "King's Hyacinth", "Knotted Silverstring", "Licheblade", "Life Berry", "Lifewood Tree(Leaf)", "Lifewood Tree(Tree)", "Liverbean", "Lotus", "Lotus(with Alcohol)", "Lovelace(Ingested)", "Lovelace(Inhaled)", "Maggot's Kiss", "Mandrake", "Meta Root", "Methara", "Mephyt Toe", "Merweed", "Mire Cap", "Mistletoe", "Misty Thistle", "Misty Violet", "Moondrop", "Monk's Hood", "Mosstoe", "Mummy Dust", "Myrrh", "Naga Scum", "Nightmoon Tears", "Nighteyes", "Nightshade", "Nixie Fingers", "Nymph Tears", "Obsidia", "Painted Elf Tear", "Painted Toad's Cap", "Paleberry", "Pearl Grass", "Plagueseed", "Platinum Thistle", "Prism Cone", "Purple Kelp", "Puissant Passionfruit", "Pure Sap", "Pyreroot", "Quickleaf", "Radiant Cherry", "Rainberry", "Rainbow Leaf", "Rainpetal", "Reekweed(Leaves)", "Reekweed(Flower)", "Rememberries", "Retchbone", "Rockfist Tree(Bark)", "Rockfist Tree(Root)", "Rotting Eyestalk", "Rotting Silkseed", "Royal Sweetsilk", "Rue", "Ruler's Root", "Saltweed", "Samuel's Pear", "Sandthorn(Golden)", "Sandthorn(Scarlet)", "Salamander Tail", "Sand Flower", "Scaldroot", "Scalewart", "Scarlet Tail", "Scorchleaf", "Scourgebud", "Screaming Devilfingers", "Screechberry", "Seaspray", "Seastalk", "Sevenstar", "Shadestar", "Shadowdoom Tree(Leaf)", "Shadowdoom Tree(Tree)", "Shardleaf", "Shifting Heartblade", "Shrivelmoss", "Shrivelworm", "Sighing Willow", "Silver Berry", "Silver Lotus", "Silver Puff", "Silver Thistle", "Silvercap", "Silverscale", "Siren's Kiss", "Sirenbane", "Skullcap", "Skymoss", "Skunk Cabbage", "Sludge Stalk", "Slumberheart", "Smogthorn", "Smoldering Eye", "Snowbell", "Soul Flower", "Speckled Dreamstar", "Spider Moss", "Spiritseed(Seed)", "Spiritseed(Tree)", "Spying Lady", "Star Violet", "St. John's Wort", "Sticklewort", "Sunbeam Blossom", "Sunfruit", "Sunweed", "Thornblaze", "Thunderseed(Seed)", "Thunderseed(Tree)", "Tombseed(Seed)", "Tombseed(Tree)", "Trance Thistle", "Treasure Berries", "Tree Horn", "Troll's Hair", "Twisted Roperoot", "Ubortha", "Undead Bane", "Vaporleaf", "Vitalia", "Wanderstalk", "Wargweed", "Warrior Rose", "Wattle Tree(Bark)", "Wattle Tree(Flower)", "Waverider", "Weeping Mindseed", "Wellspring", "Whaleback", "White Willow Bark", "White Wood(Bark)", "White Wood(Sap)", "White Wood(Root Sap)", "White Wood(Leaves)", "White Wood(Wood)", "Wild Iris", "Wild Scarlytte", "Wildtail Fern", "Witch's Cap", "Witch's Thimble", "Witherfinger", "Withersprite", "Witherwhiff", "Wizard's Cap", "Wolf's Ear", "Wormroot", "Wraith Heart", "Yellow Reed", "Zazor(Fairy Fingers)", "Zebra Gras", "Aria's Tee Leaf", "Golden Gift Berry", "Light's Latch", "Monk's Repose Spores", "Paranoia Root", "Priest's Cowl", "Seer's Eye Beans", "Shadow's Grip", "Shadow Sward", "Thessa's Tubers", "Xavier's Moss", "Zera's Nectar"]
};

// @MARKER POISONS -- getPoisonDetails, and getPoisonRating (a recipe's memorization
// cost is its type's number). {onset} in an effect is the potency's onset.
export const POISON_TYPES = {
	"I":     {"rating": 1, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: sleep. Effect starts: {onset}"},
	"II":    {"rating": 2, "duration": "10-40 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: sleep. Effect starts: {onset}"},
	"III":   {"rating": 3, "duration": "1d4 hours", "effect": "If Poison Resistance succeeds: -2 Physical Attributes. If Poison Resistance fails: sleep. Effect starts: {onset}"},
	"IV":    {"rating": 4, "duration": "1d10 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: paralysis. Effect starts: {onset}"},
	"V":     {"rating": 5, "duration": "1d4 hours", "effect": "If Poison Resistance succeeds: -2 Physical Attributes. If Poison Resistance fails: paralysis. Effect starts: {onset}"},
	"VI":    {"rating": 6, "duration": "2d4 hours", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 1d4 Base Endurance damage per hour. Effect starts: {onset}"},
	"VII":   {"rating": 7, "duration": "10-60 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 1d4 Base Endurance damage per 10 minutes. Effect starts: {onset}"},
	"VIII":  {"rating": 8, "duration": "1d6 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 1d4 Base Endurance damage per 1 minute. Effect starts: {onset}"},
	"IX":    {"rating": 9, "duration": "1d6 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 1d6 Base Endurance damage per 1 minute. Effect starts: {onset}"},
	"X":     {"rating": 10, "duration": "1d6 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 1d8 Base Endurance damage per 1 minute. Effect starts: {onset}"},
	"XI":    {"rating": 11, "duration": "1d6 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 1d10 Base Endurance damage per 1 minute. Effect starts: {onset}"},
	"XII":   {"rating": 12, "duration": "1d6 minutes", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: 2d6 Base Endurance damage per 1 minute. Effect starts: {onset}"},
	"XIII":  {"rating": 13, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: 1d4 Base Endurance damage per 1 minute. If Poison Resistance fails: 1d4 Base Endurance damage per 10 seconds. Effect starts: {onset}"},
	"XIV":   {"rating": 14, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: 1d4 Base Endurance damage per 1 minute. If Poison Resistance fails: 1d6 Base Endurance damage per 10 seconds. Effect starts: {onset}"},
	"XV":    {"rating": 15, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: 1d6 Base Endurance damage per 1 minute. If Poison Resistance fails: 1d6 Base Endurance damage per 10 seconds. Effect starts: {onset}"},
	"XVI":   {"rating": 16, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: 1d6 Base Endurance damage per 1 minute. If Poison Resistance fails: 1d8 Base Endurance damage per 10 seconds. Effect starts: {onset}"},
	"XVII":  {"rating": 17, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: 1d8 Base Endurance damage per 1 minute. If Poison Resistance fails: 1d8 Base Endurance damage per 10 seconds. Effect starts: {onset}"},
	"XVIII": {"rating": 18, "duration": "1d4 minutes", "effect": "If Poison Resistance succeeds: 1d8 Base Endurance damage per 1 minute. If Poison Resistance fails: 1d10 Base Endurance damage per 10 seconds. Effect starts: {onset}"},
	"XIX":   {"rating": 19, "duration": "Immediate", "effect": "If Poison Resistance succeeds: no damage or effect. If Poison Resistance fails: death. Effect starts: {onset}"},
	"XX":    {"rating": 20, "duration": "1d6 minutes", "effect": "If Poison Resistance succeeds: 1d4 Base Endurance damage per 1 minute. If Poison Resistance fails: death. Effect starts: {onset}"},
	"XXI":   {"rating": 21, "duration": "1d8 minutes", "effect": "If Poison Resistance succeeds: 1d6 Base Endurance damage per 1 minute. If Poison Resistance fails: death. Effect starts: {onset}"},
	"XXII":  {"rating": 22, "duration": "1d10 minutes", "effect": "If Poison Resistance succeeds: 1d8 Base Endurance damage per 1 minute. If Poison Resistance fails: death. Effect starts: {onset}"},
	"XXIII": {"rating": 23, "duration": "2d6 minutes", "effect": "If Poison Resistance succeeds: 1d10 Base Endurance damage per 1 minute. If Poison Resistance fails: death. Effect starts: {onset}"},
	"XXIV":  {"rating": 24, "duration": "3d6 minutes", "effect": "If Poison Resistance succeeds: 2d6 Base Endurance damage per 1 minute. If Poison Resistance fails: death. Effect starts: {onset}"},
	"XXV":   {"rating": 25, "duration": "Immediate", "effect": "If Poison Resistance succeeds: death. If Poison Resistance fails: death. Effect starts: {onset}"}
};

export const POISON_POTENCIES = {
	"A": "2d8 hours",
	"B": "2d6 hours",
	"C": "2d4 hours",
	"D": "1d6 hours",
	"E": "1d4 hours",
	"F": "10-60 minutes",
	"G": "10-40 minutes",
	"H": "10-30 minutes",
	"I": "1d10 minutes",
	"J": "1d8 minutes",
	"K": "1d6 minutes",
	"L": "1d4 minutes",
	"M": "10-60 seconds",
	"N": "10-40 seconds",
	"O": "10-30 seconds",
	"P": "1d10 seconds",
	"Q": "Instantly"
};

// @MARKER STARTING SPELLS -- the five skills storeBestCastingSkill looks for, and
// the three d100 ladders. [below, name]: a roll LESS THAN below takes the name.
export const CASTING_SKILLS = [
	"Hermetic Lore",
	"Scroll Knowledge",
	"Arcane Pact",
	"Lightfire Knowledge",
	"Shadowfrost Knowledge"
];

export const STARTING_SPELL_LADDERS = {
	"offensive": [
		[5, "Hold Plant"],
		[12, "Trip"],
		[19, "Fumble"],
		[26, "Hold Animal"],
		[33, "Shock"],
		[40, "Static Charge"],
		[44, "Plant Control"],
		[51, "Produce Fire"],
		[57, "Entwine"],
		[64, "Fast Freeze"],
		[71, "Finger of Dissonance"],
		[77, "Fist of Magic"],
		[89, "Hold"],
		[96, "Ignite"],
		[101, "Soak"]
	],
	"defensive": [
		[4, "Magic Skin"],
		[7, "Distract"],
		[11, "Endure Light"],
		[14, "Hide"],
		[17, "Jump"],
		[21, "Magic Nose"],
		[25, "Produce Smoke"],
		[29, "Produce Sound"],
		[33, "Catch"],
		[37, "Enhance Smell"],
		[41, "Force Shield"],
		[45, "Magic Ear"],
		[49, "Mask Odor"],
		[53, "Night Vision"],
		[57, "Produce Clothing"],
		[61, "Produce Fog"],
		[65, "Tree Sound"],
		[69, "Water Sound"],
		[73, "Alarm"],
		[77, "Detect Enemy"],
		[81, "Illusion of Smell"],
		[85, "Magic Eye"],
		[89, "Mask Heat"],
		[93, "Plant Move"],
		[97, "Sand Swim"],
		[101, "Static Shield"]
	],
	"utility":   [
		[4, "Chill"],
		[5, "Clean"],
		[7, "Color"],
		[9, "Detect Temperature"],
		[11, "Enhance Taste"],
		[13, "Flicker"],
		[15, "Magic Tongue"],
		[18, "Message"],
		[21, "Move"],
		[23, "Plant Speak"],
		[26, "Produce Food"],
		[29, "Produce Light"],
		[32, "Produce Scent"],
		[35, "Produce Taste"],
		[37, "Produce Water"],
		[40, "Tarnish"],
		[42, "Tree Message"],
		[44, "Water Message"],
		[46, "Warm"],
		[48, "Animal Speak"],
		[51, "Climb"],
		[54, "Dig"],
		[56, "Draw Water"],
		[59, "Float"],
		[61, "Illusion of Taste"],
		[64, "Mend"],
		[67, "Predict Weather"],
		[69, "Produce Texture"],
		[73, "Read"],
		[76, "Read Aura"],
		[79, "Adhere"],
		[82, "Freshen"],
		[84, "Interdimensional Message"],
		[87, "Levitate"],
		[89, "Enhance Touch"],
		[93, "External Focus"],
		[96, "Magic Voice"],
		[99, "Mystical Mapping"],
		[101, "Quick Dry"]
	]
};

// @MARKER SPELL PRIMERS -- getCantripBook. A new caster who makes an Affinity or a
// Fortune roll starts with one of these, at random, among their equipment.
export const SPELL_PRIMERS = {
	"Alteration":   "Alteration Primer(Spells: Clean/Color/Climb/Dig/Float/Read/Levitate/Night Vision/Fast Freeze/Ignite/Quick Dry/Soak)",
	"Controlling":  "Controlling Primer(Spells: Distract/Hold Animal/Hold)",
	"Creation":     "Creation Primer(Spells: Magic Skin,Magic Tongue/Produce Food/Produce Light/Produce Water/Magic Nose/Mend/Produce Smoke/Force Shield/Magic Ear/Produce Clothing/Produce Fog/Alarm/Magic Eye/Magic Voice/Mystical Mapping)",
	"Dimensional":  "Dimensional Primer(Spell: Interdimensional Message)",
	"Displacing":   "Displacing Primer(Spells: Move/Trip/Fumble/Jump/Catch/Force Shield/Levitate)",
	"Energy":       "Energy Primer(Spells: Chill/Flicker/Warm/Shock/Static Charge/Produce Fire/Finger of Dissonance/Fist of Magic/Static Shield)",
	"Illusion":     "Illusion Primer(Spells: Illusion of Taste/Illusion of Smell)",
	"Mental":       "Mental Primer(Spells: Enhance Taste/Message/Plant Speak/Animal Speak/Read/Enhance Smell/Enhance Touch/Mystical Mapping)",
	"Natural":      "Natural Primer(Spells: Tree Message/Clean/Produce Food/Produce Water/Tarnish/Climb/Dig/Draw Water/Produce Smoke/Freshen/Tree Sound/Entwine/Fast Freeze/Plant Move/Quick Dry)",
	"Sensing":      "Sensing Primer(Spells: Predict Weather/Read Aura/Detect Enemy)",
	"Transference": "Transference Primer(Spells: Magic Skin/Magic Tongue/Draw Water/Magic Nose/Magic Ear/Magic Eye/Magic Voice)",
	"Warding":      "Warding Primer(Spells: Endure Light/Mask Odor)"
};

// @MARKER NAMES HIS DICTIONARIES DO NOT HOLD -- reported by the extraction, and left
// in the lists: his sheet draws them too, and adds a blank row for each.
export const LORE_NAMES_NOT_FOUND = {
	"getUnalignedHymnList": ["Injury"],
	"getHerbLoreList":      ["Zebra Gras"]
};

// @END (CODE)
