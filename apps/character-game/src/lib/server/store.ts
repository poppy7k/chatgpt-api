import type {
	CharacterProfile,
	GameChoice,
	GameSession,
	GameSettings,
	GameState,
	ImageJob,
	MessageRecord,
	PlayerProfile,
	ProviderRouteSettings,
	ReasoningEffort,
	ScenePlan,
	SessionView,
	StartProfile,
	WorldProfile
} from '$lib/types';
import { catalog } from './catalog';
import { getConfig, publicProviderRouteSettings, sanitizeProviderRouteSettings } from './config';
import { getDb } from './db';

const IMAGE_MODES = new Set(['off', 'suggest', 'force']);
const REASONING_EFFORTS = new Set([
	'instant',
	'standard',
	'extended',
	'max',
	'pro-standard',
	'pro-extended'
]);

const DEFAULT_SETTINGS: GameSettings = {
	model: getConfig().chatModel,
	imageModel: getConfig().imageModel,
	imageMode: 'suggest',
	reasoningEffort: 'instant',
	temperature: 0.75
};

export function normalizeImageMode(value: unknown): GameSettings['imageMode'] | undefined {
	return typeof value === 'string' && IMAGE_MODES.has(value)
		? (value as GameSettings['imageMode'])
		: undefined;
}

function safeModelSlug(value: unknown, fallback: string) {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : fallback;
}

function normalizeReasoningEffort(value: unknown): ReasoningEffort {
	return typeof value === 'string' && REASONING_EFFORTS.has(value)
		? (value as ReasoningEffort)
		: DEFAULT_SETTINGS.reasoningEffort;
}

function safeTemperature(value: unknown, fallback: number) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	return Math.min(1.2, Math.max(0, value));
}

export function sanitizeSettings(settings?: Partial<GameSettings>): GameSettings {
	const reasoningEffort = normalizeReasoningEffort(settings?.reasoningEffort);
	return {
		model: safeModelSlug(settings?.model, modelForReasoningEffort(reasoningEffort)),
		imageModel: safeModelSlug(settings?.imageModel, DEFAULT_SETTINGS.imageModel),
		imageMode: normalizeImageMode(settings?.imageMode) ?? DEFAULT_SETTINGS.imageMode,
		reasoningEffort,
		temperature: safeTemperature(settings?.temperature, DEFAULT_SETTINGS.temperature)
	};
}

export function modelForReasoningEffort(effort: ReasoningEffort) {
	if (effort === 'standard') return 'gpt-5-5-thinking-standard';
	if (effort === 'extended') return 'gpt-5-5-thinking-extended';
	if (effort === 'max') return 'gpt-5-5-thinking-max';
	if (effort === 'pro-standard') return 'gpt-5-5-pro-standard';
	if (effort === 'pro-extended') return 'gpt-5-5-pro-extended';
	return 'auto';
}

function now() {
	return new Date().toISOString();
}

function id(prefix: string) {
	return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
}

function parseJson<T>(value: string | null, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function toProviderRouteSettings(row: Record<string, unknown> | undefined | null) {
	return sanitizeProviderRouteSettings(
		parseJson<Partial<ProviderRouteSettings> | null>(
			row?.provider_json ? String(row.provider_json) : null,
			null
		)
	);
}

function toSession(row: Record<string, unknown>): GameSession {
	return {
		id: String(row.id),
		title: String(row.title),
		world: parseJson<WorldProfile>(String(row.world_json), catalog.worlds[0]),
		character: parseJson<CharacterProfile>(String(row.character_json), catalog.characters[0]),
		player: parseJson<PlayerProfile>(String(row.player_json), { name: 'Player' }),
		state: parseJson<GameState>(String(row.state_json), {}),
		settings: parseJson<GameSettings>(String(row.settings_json), DEFAULT_SETTINGS),
		latestHint: row.latest_hint ? String(row.latest_hint) : null,
		latestChoices: parseJson<GameChoice[]>(String(row.latest_choices_json), []),
		latestScene: parseJson<ScenePlan | null>(
			row.latest_scene_json ? String(row.latest_scene_json) : null,
			null
		),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at)
	};
}

function toMessage(row: Record<string, unknown>): MessageRecord {
	return {
		id: String(row.id),
		sessionId: String(row.session_id),
		role: String(row.role) as MessageRecord['role'],
		content: String(row.content),
		meta: parseJson<Record<string, never> | undefined>(
			row.meta_json ? String(row.meta_json) : null,
			undefined
		),
		createdAt: String(row.created_at)
	};
}

function toImageJob(row: Record<string, unknown>): ImageJob {
	return {
		id: String(row.id),
		sessionId: String(row.session_id),
		status: String(row.status) as ImageJob['status'],
		prompt: String(row.prompt),
		assetUrl: row.asset_url ? String(row.asset_url) : null,
		localPath: row.local_path ? String(row.local_path) : null,
		error: row.error ? String(row.error) : null,
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at)
	};
}

export function createSession(input: {
	worldId: string;
	characterId: string;
	startId?: string;
	customOrigin?: string;
	playerName?: string;
	settings?: Partial<GameSettings>;
	provider?: Partial<ProviderRouteSettings>;
}) {
	const world = catalog.worlds.find((item) => item.id === input.worldId) ?? catalog.worlds[0];
	const character =
		catalog.characters.find((item) => item.id === input.characterId) ?? catalog.characters[0];
	const start = catalog.starts.find((item) => item.id === input.startId) ?? catalog.starts[0];
	const customOrigin = input.customOrigin?.trim();
	const activeStart: StartProfile = customOrigin
		? {
				...start,
				id: 'custom-origin',
				title: 'Custom Origin',
				summary: customOrigin.slice(0, 240),
				opening: customOrigin,
				imagePrompt: `${customOrigin}, ${start.imagePrompt}`,
				statePatch: { ...start.statePatch, origin: 'custom_origin' }
			}
		: start;
	const createdAt = now();
	const settings = sanitizeSettings(input.settings);
	const provider = sanitizeProviderRouteSettings(input.provider);
	const session: GameSession = {
		id: id('sess'),
		title: `${activeStart.title} / ${world.name}`,
		world,
		character,
		player: { name: input.playerName?.trim() || 'Wanderer' },
		state: {
			...activeStart.statePatch,
			route_id: activeStart.id,
			base_start_id: start.id,
			route_title: activeStart.title,
			custom_origin: customOrigin || '',
			cast_hook: character.id,
			location: activeStart.location,
			chapter: 1,
			state_source: 'model_pending'
		},
		settings,
		latestHint: 'Treat every menu choice as optional; you can type your own action.',
		latestChoices: activeStart.choices,
		latestScene: {
			title: activeStart.title,
			summary: activeStart.summary,
			imagePrompt: activeStart.imagePrompt,
			imageRecommended: false
		},
		createdAt,
		updatedAt: createdAt
	};

	const db = getDb();
	db.prepare(
		`INSERT INTO sessions (
			id, title, world_json, character_json, player_json, state_json, settings_json,
			provider_json, latest_hint, latest_choices_json, latest_scene_json, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		session.id,
		session.title,
		JSON.stringify(session.world),
		JSON.stringify(session.character),
		JSON.stringify(session.player),
		JSON.stringify(session.state),
		JSON.stringify(session.settings),
		JSON.stringify(provider),
		session.latestHint,
		JSON.stringify(session.latestChoices),
		JSON.stringify(session.latestScene),
		session.createdAt,
		session.updatedAt
	);

	appendMessage({
		sessionId: session.id,
		role: 'system',
		content: [
			`Opening route: ${activeStart.title}`,
			`Opening premise: ${activeStart.opening}`,
			`Custom origin: ${customOrigin || 'none'}`,
			`Featured cast hook: ${character.name} (${character.role}). This is optional; do not force them into the first scene unless it fits.`
		].join('\n'),
		meta: { hidden: true, kind: 'route_seed' }
	});

	return getSessionView(session.id);
}

export function getSession(id: string) {
	const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
		| Record<string, unknown>
		| undefined;
	return row ? toSession(row) : null;
}

export function getSessionView(id: string): SessionView {
	const session = getSession(id);
	if (!session) throw new Error(`Session not found: ${id}`);
	const sessionRow = getDb().prepare('SELECT provider_json FROM sessions WHERE id = ?').get(id) as
		| Record<string, unknown>
		| undefined;

	const messages = getDb()
		.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
		.all(id)
		.map((row) => toMessage(row as Record<string, unknown>));

	const imageJobs = getDb()
		.prepare('SELECT * FROM image_jobs WHERE session_id = ? ORDER BY created_at DESC')
		.all(id)
		.map((row) => toImageJob(row as Record<string, unknown>));

	return {
		session,
		messages,
		imageJobs,
		provider: publicProviderRouteSettings(toProviderRouteSettings(sessionRow))
	};
}

export function getSessionProviderRouteSettings(id: string) {
	const row = getDb().prepare('SELECT provider_json FROM sessions WHERE id = ?').get(id) as
		| Record<string, unknown>
		| undefined;
	if (!row) throw new Error(`Session not found: ${id}`);
	return toProviderRouteSettings(row);
}

export function appendMessage(input: {
	sessionId: string;
	role: MessageRecord['role'];
	content: string;
	meta?: MessageRecord['meta'];
}) {
	const record: MessageRecord = {
		id: id('msg'),
		sessionId: input.sessionId,
		role: input.role,
		content: input.content,
		meta: input.meta,
		createdAt: now()
	};

	getDb()
		.prepare(
			'INSERT INTO messages (id, session_id, role, content, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.run(
			record.id,
			record.sessionId,
			record.role,
			record.content,
			record.meta ? JSON.stringify(record.meta) : null,
			record.createdAt
		);

	return record;
}

export function updateSession(id: string, patch: Partial<GameSession>) {
	const current = getSession(id);
	if (!current) throw new Error(`Session not found: ${id}`);
	const next = { ...current, ...patch, updatedAt: now() };

	getDb()
		.prepare(
			`UPDATE sessions
			 SET title = ?, state_json = ?, settings_json = ?, latest_hint = ?,
			     latest_choices_json = ?, latest_scene_json = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			next.title,
			JSON.stringify(next.state),
			JSON.stringify(next.settings),
			next.latestHint,
			JSON.stringify(next.latestChoices),
			JSON.stringify(next.latestScene),
			next.updatedAt,
			id
		);

	return getSession(id);
}

export function createImageJob(sessionId: string, prompt: string) {
	const createdAt = now();
	const job: ImageJob = {
		id: id('img'),
		sessionId,
		status: 'queued',
		prompt,
		assetUrl: null,
		localPath: null,
		error: null,
		createdAt,
		updatedAt: createdAt
	};
	getDb()
		.prepare(
			`INSERT INTO image_jobs
			 (id, session_id, status, prompt, asset_url, local_path, error, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			job.id,
			job.sessionId,
			job.status,
			job.prompt,
			job.assetUrl,
			job.localPath,
			job.error,
			job.createdAt,
			job.updatedAt
		);
	return job;
}

export function getImageJob(jobId: string) {
	const row = getDb().prepare('SELECT * FROM image_jobs WHERE id = ?').get(jobId) as
		| Record<string, unknown>
		| undefined;
	return row ? toImageJob(row) : null;
}

export function latestQueuedImageJob(sessionId: string) {
	const row = getDb()
		.prepare(
			"SELECT * FROM image_jobs WHERE session_id = ? AND status = 'queued' ORDER BY created_at DESC LIMIT 1"
		)
		.get(sessionId) as Record<string, unknown> | undefined;
	return row ? toImageJob(row) : null;
}

export function updateImageJob(jobId: string, patch: Partial<ImageJob>) {
	const current = getImageJob(jobId);
	if (!current) throw new Error(`Image job not found: ${jobId}`);
	const next = { ...current, ...patch, updatedAt: now() };
	getDb()
		.prepare(
			`UPDATE image_jobs
			 SET status = ?, asset_url = ?, local_path = ?, error = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(next.status, next.assetUrl, next.localPath, next.error, next.updatedAt, jobId);
	return getImageJob(jobId);
}

export function cancelImageJobs(sessionId: string) {
	const cancelledAt = now();
	getDb()
		.prepare(
			`UPDATE image_jobs
			 SET status = 'cancelled', error = 'Cancelled by player', updated_at = ?
			 WHERE session_id = ? AND status IN ('queued', 'running')`
		)
		.run(cancelledAt, sessionId);
	return getSessionView(sessionId);
}
