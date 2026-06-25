import { describe, expect, it } from 'vitest';
import {
	buildSceneImagePrompt,
	mergeGameState,
	parseModelTurn,
	shouldQueueImageForTurn
} from './game-engine';
import { sanitizeSettings } from './store';
import type { SessionView } from '$lib/types';

describe('game engine', () => {
	it('merges state patches without dropping nested state', () => {
		expect.assertions(1);

		const merged = mergeGameState(
			{
				trust: 20,
				relationship: { debt: 1, mood: 'guarded' },
				flags: ['new_arrival']
			},
			{
				trust: 24,
				relationship: { mood: 'curious' }
			}
		);

		expect(merged).toEqual({
			trust: 24,
			relationship: { debt: 1, mood: 'curious' },
			flags: ['new_arrival']
		});
	});

	it('parses strict model JSON into the app scene shape', () => {
		expect.assertions(3);

		const parsed = parseModelTurn(`{
			"reply": "Mira smiles.",
			"state_patch": { "trust": 2 },
			"choices": [{ "id": "ask", "text": "Ask about the compass", "intent": "curious" }],
			"hint": "Watch the compass.",
			"scene": {
				"title": "Compass",
				"summary": "A brass compass turns.",
				"image_prompt": "brass compass on tavern table",
				"image_recommended": true
			}
		}`);

		expect(parsed.reply).toBe('Mira smiles.');
		expect(parsed.choices).toHaveLength(1);
		expect(parsed.scene?.imagePrompt).toBe('brass compass on tavern table');
	});

	it('normalizes common model JSON drift before validation', () => {
		expect.assertions(4);

		const parsed = parseModelTurn(`{
			"reply": "Seraphina laughs softly.",
			"choices": ["Ask about the contract", "Step closer"],
			"scene": {
				"summary": "Moonlight falls through the conservatory glass.",
				"image_prompt": "moonlit academy conservatory, elegant villainess, cinematic manhwa",
				"image_recommended": "true"
			}
		}`);

		expect(parsed.choices[0]).toEqual({ id: 'choice-1', text: 'Ask about the contract' });
		expect(parsed.choices[1]?.id).toBe('choice-2');
		expect(parsed.scene?.imageRecommended).toBe(true);
		expect(parsed.scene?.imagePrompt).toContain('moonlit academy');
	});

	it('queues suggested art only when the model explicitly recommends it', () => {
		expect.assertions(4);

		const scene = {
			summary: 'A quiet dialogue continues in the same tavern booth.',
			imagePrompt: 'same tavern booth, quiet conversation',
			imageRecommended: false
		};

		expect(shouldQueueImageForTurn('suggest', scene)).toBe(false);
		expect(shouldQueueImageForTurn('force', scene)).toBe(true);
		expect(shouldQueueImageForTurn('off', { ...scene, imageRecommended: true })).toBe(false);
		expect(shouldQueueImageForTurn('suggest', { ...scene, imageRecommended: true })).toBe(true);
	});

	it('sanitizes client-provided session settings', () => {
		expect.assertions(1);

		expect(
			sanitizeSettings({
				model: ' chatgpt-web/auto ',
				imageModel: '',
				imageMode: 'on_demand' as never,
				reasoningEffort: 'extended',
				temperature: 99
			})
		).toEqual({
			model: 'chatgpt-web/auto',
			imageModel: 'chatgpt-web/auto',
			imageMode: 'suggest',
			reasoningEffort: 'extended',
			temperature: 1.2
		});
	});

	it('builds scene-only image prompts and strips interface leakage', () => {
		expect.assertions(4);

		const prompt = buildSceneImagePrompt(
			{
				session: {
					id: 'sess_test',
					title: 'Mira at Arcadia',
					world: {
						id: 'arcadia',
						name: 'Arcadia',
						tagline: 'Floating city',
						description: 'A rain-lit floating city of taverns and vanished districts.',
						tone: 'mysterious, romantic, dangerous',
						seedSceneImage: '/seed/silvermarket-tavern.png',
						defaultFlags: []
					},
					character: {
						id: 'mira',
						name: 'Mira Vale',
						role: 'cartographer spy',
						avatar: '/seed/mira-vale.png',
						persona: 'guarded but curious',
						speakingStyle: 'dry and precise',
						secrets: [],
						initialStats: {}
					},
					player: { name: 'Wanderer' },
					state: { location: 'Silvermarket Tavern' },
					settings: {
						model: 'chatgpt-web/auto',
						imageModel: 'chatgpt-web/auto',
						imageMode: 'suggest',
						reasoningEffort: 'instant',
						temperature: 0.8
					},
					latestHint: null,
					latestChoices: [],
					latestScene: {
						title: 'Compass',
						summary: 'A brass compass trembles on the tavern table.',
						imagePrompt: 'unused',
						imageRecommended: true
					},
					createdAt: '2026-06-24T00:00:00Z',
					updatedAt: '2026-06-24T00:00:00Z'
				},
				messages: [],
				imageJobs: [],
				provider: {
					baseUrl: 'http://127.0.0.1:8000/v1',
					authMode: 'bearer',
					apiKeySet: false
				}
			} satisfies SessionView,
			'game window screenshot with buttons and chat UI, brass compass on tavern table'
		);

		expect(prompt).toContain('brass compass on tavern table');
		expect(prompt).toContain('Strict exclusions: no game UI');
		expect(prompt).not.toMatch(/Visual direction:.*game window/i);
		expect(prompt).not.toMatch(/Visual direction:.*screenshot/i);
	});
});
