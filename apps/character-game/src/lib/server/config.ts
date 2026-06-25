import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ProviderRouteSettings, PublicProviderRouteSettings } from '$lib/types';

export interface AppConfig {
	openaiBaseUrl: string;
	publicOpenaiBaseUrl: string;
	openaiApiKey: string;
	chatModel: string;
	imageModel: string;
	mode: 'live' | 'mock';
	dbPath: string;
	imageDir: string;
}

export interface RuntimeProviderConfig extends ProviderRouteSettings {
	publicBaseUrl: string;
	chatModel: string;
	imageModel: string;
	mode: 'live' | 'mock';
	imageDir: string;
}

function trimSlash(value: string) {
	return value.replace(/\/+$/, '');
}

export function getConfig(): AppConfig {
	const dbPath =
		process.env.CHATGAME_DB_PATH === undefined
			? ':memory:'
			: process.env.CHATGAME_DB_PATH === ':memory:'
				? ':memory:'
				: resolve(process.env.CHATGAME_DB_PATH);
	const imageDir = resolve(process.env.CHATGAME_IMAGE_DIR ?? '.data/images');

	if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
	mkdirSync(imageDir, { recursive: true });

	return {
		openaiBaseUrl: trimSlash(process.env.CHATGAME_OPENAI_BASE_URL ?? 'http://127.0.0.1:8000/v1'),
		publicOpenaiBaseUrl: trimSlash(
			process.env.CHATGAME_PUBLIC_OPENAI_BASE_URL ??
				process.env.CHATGAME_OPENAI_BASE_URL ??
				'http://127.0.0.1:8000/v1'
		),
		openaiApiKey: process.env.CHATGAME_OPENAI_API_KEY ?? 'local-dev-key',
		chatModel: process.env.CHATGAME_CHAT_MODEL ?? 'chatgpt-web/auto',
		imageModel: process.env.CHATGAME_IMAGE_MODEL ?? 'chatgpt-web/auto',
		mode: process.env.CHATGAME_AI_MODE === 'mock' ? 'mock' : 'live',
		dbPath,
		imageDir
	};
}

function safeBaseUrl(value: unknown, fallback: string) {
	if (typeof value !== 'string') return fallback;
	const trimmed = trimSlash(value.trim());
	if (!trimmed) return fallback;
	try {
		const url = new URL(trimmed);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
		return trimSlash(url.toString());
	} catch {
		return fallback;
	}
}

function safeAuthMode(value: unknown): ProviderRouteSettings['authMode'] {
	return value === 'none' ? 'none' : 'bearer';
}

function safeApiKey(value: unknown) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export function sanitizeProviderRouteSettings(input?: Partial<ProviderRouteSettings> | null) {
	const config = getConfig();
	return {
		baseUrl: safeBaseUrl(input?.baseUrl, config.publicOpenaiBaseUrl),
		authMode: safeAuthMode(input?.authMode),
		apiKey: safeApiKey(input?.apiKey)
	} satisfies ProviderRouteSettings;
}

export function resolveProviderConfig(input?: Partial<ProviderRouteSettings> | null) {
	const config = getConfig();
	const route = sanitizeProviderRouteSettings(input);
	const internalBaseUrl =
		route.baseUrl === config.publicOpenaiBaseUrl ? config.openaiBaseUrl : route.baseUrl;
	return {
		...route,
		baseUrl: internalBaseUrl,
		publicBaseUrl: route.baseUrl,
		apiKey: route.apiKey ?? config.openaiApiKey,
		chatModel: config.chatModel,
		imageModel: config.imageModel,
		mode: config.mode,
		imageDir: config.imageDir
	} satisfies RuntimeProviderConfig;
}

export function publicProviderRouteSettings(
	input?: Partial<ProviderRouteSettings> | null
): PublicProviderRouteSettings {
	const route = sanitizeProviderRouteSettings(input);
	return {
		baseUrl: route.baseUrl,
		authMode: route.authMode,
		apiKeySet: Boolean(route.apiKey)
	};
}
