import type { Catalog } from '$lib/types';

export const catalog: Catalog = {
	worlds: [
		{
			id: 'arcadia',
			name: 'Eldoria Continent',
			tagline: 'Royal academy routes, old vows, and dangerous affection.',
			description:
				'Eldoria is a moonlit manhwa empire where academy heirs, cursed nobles, and reincarnated outsiders trade secrets under rose-colored magic.',
			tone: 'dark manhwa romance, isekai intrigue, elegant danger, fast emotional choices',
			seedSceneImage: '/seed/obsidian-academy-night.png',
			defaultFlags: ['first_night', 'academy_rumors']
		},
		{
			id: 'low-orbit-noir',
			name: 'Rainfall Capital',
			tagline: 'A noir romance city where every favor has a price.',
			description:
				'Rainfall Capital never sleeps. Lantern alleys, masked couriers, and noble spies turn every confession into leverage.',
			tone: 'rainy manhwa noir, sharp flirting, secrets, debts, midnight choices',
			seedSceneImage: '/seed/rainy-manhwa-city.png',
			defaultFlags: ['rainy_season', 'unpaid_debt']
		},
		{
			id: 'rosenfall-academy',
			name: 'Obsidian Academy',
			tagline: 'Villainess routes, magic exams, and lethal romance.',
			description:
				'Obsidian Academy crowns saints and ruins villains under the same moon. House politics, magic duels, and cursed contracts decide who survives.',
			tone: 'dark academy manhwa, slow-burn romance, sharp banter, supernatural stakes',
			seedSceneImage: '/seed/obsidian-academy-night.png',
			defaultFlags: ['first_semester', 'family_name_unproven']
		},
		{
			id: 'nine-moons-gate',
			name: 'Abyss Gate',
			tagline: 'Dungeon contracts, healer debts, and monster-lit vows.',
			description:
				'Abyss Gate opens beneath the capital when old gods wake. Survivors return with powers, debts, and companions who remember their deaths.',
			tone: 'isekai dungeon fantasy, intimate danger, party bonds, magical bargains',
			seedSceneImage: '/seed/neon-dungeon-gate.png',
			defaultFlags: ['dungeon_contract', 'abyss_mark']
		},
		{
			id: 'tower-system',
			name: 'Tower System',
			tagline: 'Status windows, bad rolls, and impossible floor quests.',
			description:
				'The Tower System reincarnates strangers into a dungeon world where gifts arrive with defects, quests have hidden costs, and romance begins after survival.',
			tone: 'dark progression isekai, quest pressure, system messages, unfair growth, fantasy survival stakes',
			seedSceneImage: '/seed/neon-dungeon-gate.png',
			defaultFlags: ['system_online', 'first_floor_unclaimed']
		}
	],
	characters: [
		{
			id: 'ensemble-cast',
			name: 'GM-led Ensemble',
			role: 'Narrator + generated cast',
			avatar: '/seed/neon-dungeon-gate.png',
			persona:
				'No single NPC owns the scene. The narrator, system, dungeon, nobles, monsters, rivals, allies, and strangers can enter whenever the route needs them.',
			speakingStyle:
				'Game master narration first, then concise dialogue from whichever NPCs are actually present.',
			secrets: [
				'The world can introduce new cast members without waiting for the player to ask.',
				'The featured route hook can stay off-screen until the story earns their entrance.'
			],
			initialStats: {
				world_pressure: 48,
				mystery: 58,
				cast_flux: 66
			}
		},
		{
			id: 'luna-everhart',
			name: 'Luna Everhart',
			role: 'Ice Princess',
			avatar: '/seed/luna-everhart.png',
			persona:
				'Cold, brilliant, and secretly lonely. Luna insults weakness but remembers every kindness.',
			speakingStyle:
				'Sharp noble phrasing, controlled emotion, teasing cruelty that softens when trust rises.',
			secrets: [
				'She already knows one future where the player abandoned her.',
				'Her ice magic reacts to jealousy and fear.'
			],
			initialStats: {
				trust: 18,
				respect: 62,
				affinity: 29,
				suspicion: 45
			}
		},
		{
			id: 'kael-drakos',
			name: 'Kael Drakos',
			role: 'Crown Prince',
			avatar: '/seed/kael-drakos.png',
			persona: 'Dominant, disciplined, and protective once convinced. Kael tests resolve before offering help.',
			speakingStyle: 'Low, precise, formal under pressure, suddenly direct when emotions break through.',
			secrets: ['He is hunting the traitor inside his own house.', 'His royal crest is slowly becoming a curse.'],
			initialStats: {
				trust: 22,
				respect: 72,
				affinity: 24,
				suspicion: 34
			}
		},
		{
			id: 'mira-celestia',
			name: 'Mira Celestia',
			role: 'Mystic Scholar',
			avatar: '/seed/mira-celestia.png',
			persona:
				'Calm, perceptive, and unsettlingly kind. Mira reads forbidden routes and notices lies immediately.',
			speakingStyle: 'Quietly analytical, gentle warnings, dry humor, precise magical observations.',
			secrets: [
				'She has read a chapter where the player dies.',
				'Her book writes new lines when someone nearby lies.'
			],
			initialStats: {
				trust: 36,
				respect: 54,
				affinity: 41,
				suspicion: 18
			}
		},
		{
			id: 'riven-ashford',
			name: 'Riven Ashford',
			role: 'Wandering Swordsman',
			avatar: '/seed/riven-ashford.png',
			persona:
				'Cool, loyal, and hard to read. Riven protects people from the shadows and hates owing anyone.',
			speakingStyle: 'Sparse, guarded, practical, with small flashes of warmth when loyalty is earned.',
			secrets: [
				'He carries the sword that killed his first master.',
				'He knows the player from a timeline that no longer exists.'
			],
			initialStats: {
				trust: 28,
				respect: 64,
				affinity: 27,
				suspicion: 26
			}
		}
	],
	starts: [
		{
			id: 'isekai-wakeup',
			title: 'Wake Up in Another World',
			summary: 'You open your eyes inside a body with debts, rumors, and no guidebook.',
			location: 'Silvermarket Tavern',
			tags: ['isekai', 'memory gap', 'soft danger'],
			opening:
				'You wake under lantern light with a name you do not recognize stitched inside your sleeve. Across the table, someone has been waiting long enough for the tea to go cold.',
			imagePrompt:
				'dark isekai bedroom awakening, moonlit noble room, unfamiliar embroidered sleeve, rain on glass, mysterious companion watching from shadow',
			statePatch: { origin: 'isekai_wakeup', courage: 34, composure: 42 },
			choices: [
				{ id: 'ask-name', text: 'Ask who has been waiting for you.', intent: 'careful' },
				{ id: 'check-sleeve', text: 'Read the name stitched inside your sleeve.', intent: 'investigate' },
				{ id: 'pretend-calm', text: 'Pretend you remember everything.', intent: 'deceptive' }
			]
		},
		{
			id: 'academy-transfer',
			title: 'Magic Academy Transfer',
			summary: 'Your first day starts with a duel invitation and a seat beside trouble.',
			location: 'Rosenfall East Lecture Hall',
			tags: ['academy', 'romance', 'rivals'],
			opening:
				'The lecture hall quiets when your transfer papers hit the professor’s desk. A sealed challenge card slides across your new seat before you can sit down.',
			imagePrompt:
				'obsidian magic academy lecture hall at night, challenge card on black polished desk, noble students whispering, violet spell sigils through stained glass',
			statePatch: { origin: 'academy_transfer', reputation: 21, composure: 48 },
			choices: [
				{ id: 'accept-duel', text: 'Accept the challenge before reading the sender.', intent: 'bold' },
				{ id: 'inspect-card', text: 'Inspect the seal and handwriting first.', intent: 'clever' },
				{ id: 'ask-seatmate', text: 'Ask your seatmate what rule you are about to break.', intent: 'social' }
			]
		},
		{
			id: 'villainess-route',
			title: 'Villainess Contract Route',
			summary: 'A doomed noble offers you a contract that could save or ruin both of you.',
			location: 'Rosenfall Winter Conservatory',
			tags: ['villainess', 'contract', 'slow burn'],
			opening:
				'A girl everyone calls the villainess waits among frost-white roses. She smiles like the ending has already been written, then offers you a contract pen.',
			imagePrompt:
				'winter conservatory with white roses, glowing contract on black marble table, crimson candles, moonlit glasshouse, dark romantic tension',
			statePatch: { origin: 'villainess_contract', affinity: 35, suspicion: 36 },
			choices: [
				{ id: 'read-contract', text: 'Read every clause before touching the pen.', intent: 'careful' },
				{ id: 'ask-price', text: 'Ask what saving her will cost you.', intent: 'direct' },
				{ id: 'sign-first', text: 'Sign first and make her explain afterward.', intent: 'reckless' }
			]
		},
		{
			id: 'dungeon-healer',
			title: 'Dungeon Healer Debt',
			summary: 'You survive a dungeon collapse because someone chose to pay the price.',
			location: 'Moonwell Infirmary',
			tags: ['healer', 'dungeon', 'intimacy'],
			opening:
				'You wake to silver bandages and the smell of rain-soaked stone. The healer beside your bed looks exhausted, and the charm on her wrist has cracked in half.',
			imagePrompt:
				'dark fantasy infirmary after dungeon collapse, silver bandages, cracked charm, cyan abyss light through stone window, intimate quiet tension',
			statePatch: { origin: 'dungeon_healer', debt: 1, affinity: 32 },
			choices: [
				{ id: 'thank-healer', text: 'Thank her and ask what she lost.', intent: 'gentle' },
				{ id: 'inspect-charm', text: 'Focus on the cracked charm.', intent: 'investigate' },
				{ id: 'try-stand', text: 'Try to stand before she stops you.', intent: 'stubborn' }
			]
		},
		{
			id: 'system-awakening',
			title: 'System Awakening Roll',
			summary:
				'You reincarnate before a cracked status window that asks what you expected from another world.',
			location: 'White Loading Room',
			tags: ['isekai', 'system', 'random boon'],
			opening:
				'Death ends like a loading screen. A cracked blue status window opens above endless white floor and asks what you expected from your second life before it rolls your rank, blessing, flaw, and first quest.',
			imagePrompt:
				'isekai status window awakening in endless white void, cracked blue holographic interface, lonely reincarnated player silhouette, floating cards of rank blessing flaw and quest, cinematic dark manhwa lighting, no readable text',
			statePatch: {
				origin: 'system_awakening',
				system_integrity: 41,
				fate_bias: 17,
				survival_instinct: 38,
				boon_status: 'unrolled',
				cheat_claim_blocked: true
			},
			choices: [
				{ id: 'expect-power', text: 'Tell the system you expected overwhelming power.', intent: 'ambitious' },
				{ id: 'expect-peace', text: 'Tell it you only wanted a quiet life.', intent: 'honest' },
				{ id: 'expect-revenge', text: 'Tell it you want enough power to defy fate.', intent: 'vengeful' }
			]
		},
		{
			id: 'f-rank-gate',
			title: 'F-Rank Gate Tutorial',
			summary:
				'The first dungeon assigns you the worst rank in the party, then quietly gives you a private quest.',
			location: 'Collapsed Subway Gate',
			tags: ['dungeon', 'quest', 'underdog'],
			opening:
				'The gate opens under a dead subway line. Everyone else receives clean class marks; your status window flickers, downgrades you to F-rank, then flashes a private quest no one else can see.',
			imagePrompt:
				'urban fantasy dungeon gate inside abandoned subway, cyan portal light, broken tiles, low rank hunter holding cracked status shard, party silhouettes ahead, tense manhwa atmosphere',
			statePatch: {
				origin: 'f_rank_gate',
				rank_pressure: 86,
				hidden_growth: 22,
				party_trust: 14,
				dungeon_threat: 61,
				boon_status: 'private_quest_locked',
				cheat_claim_blocked: true
			},
			choices: [
				{ id: 'hide-window', text: 'Hide the private quest before anyone notices.', intent: 'careful' },
				{ id: 'ask-party', text: 'Ask the party leader why your status is broken.', intent: 'social' },
				{ id: 'enter-first', text: 'Step into the gate before fear catches up.', intent: 'reckless' }
			]
		},
		{
			id: 'wrong-hero-summon',
			title: 'Wrong Hero Summon',
			summary:
				'The kingdom summoned a hero, but the ritual grabbed you by mistake and the blessing refuses to explain itself.',
			location: 'Royal Summoning Chapel',
			tags: ['isekai', 'chosen one', 'politics'],
			opening:
				'Gold magic circles burn out across the chapel floor. The court expected a radiant hero; instead, you fall through the ritual smoke with a blessing that looks defective and a goddess notification marked unreadable.',
			imagePrompt:
				'royal summoning chapel after failed hero ritual, gold magic circle cracked, confused isekai protagonist in smoke, nobles recoiling, moonlit stained glass, dark fantasy manhwa composition',
			statePatch: {
				origin: 'wrong_hero_summon',
				court_suspicion: 72,
				divine_signal: 19,
				false_hero_risk: 64,
				nerve: 33,
				boon_status: 'misfired_blessing',
				cheat_claim_blocked: true
			},
			choices: [
				{ id: 'kneel', text: 'Kneel and pretend this was intentional.', intent: 'deceptive' },
				{ id: 'inspect-blessing', text: 'Focus on the defective blessing before speaking.', intent: 'investigate' },
				{ id: 'accuse-ritual', text: 'Tell the court their ritual made the mistake.', intent: 'bold' }
			]
		}
	]
};
