import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig, resolveProviderConfig } from './config';
import type { ProviderRouteSettings } from '$lib/types';

export class ProviderRequestError extends Error {
	status: number;
	code: string;
	details: unknown;

	constructor(message: string, status: number, code: string, details: unknown) {
		super(message);
		this.name = 'ProviderRequestError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

async function readProviderJson(response: Response) {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return { raw: text };
	}
}

function providerHeaders(config: { authMode: 'bearer' | 'none'; apiKey?: string }, json = false) {
	const headers: Record<string, string> = json ? { 'content-type': 'application/json' } : {};
	if (config.authMode === 'bearer' && config.apiKey)
		headers.authorization = `Bearer ${config.apiKey}`;
	return headers;
}

export async function completeChat(input: {
	messages: ChatMessage[];
	model?: string;
	thinkingEffort?: string | null;
	temperature?: number;
	provider?: Partial<ProviderRouteSettings>;
}) {
	const config = resolveProviderConfig(input.provider);

	if (config.mode === 'mock') {
		return JSON.stringify({
			reply:
				'Mira watches your expression before answering. "That is the right question, which means it is also the dangerous one."',
			state_patch: { trust: 38, suspicion: 17 },
			choices: [
				{ id: 'press', text: 'Press her for the name of the vanished district.', intent: 'bold' },
				{ id: 'trade', text: 'Offer a secret of your own.', intent: 'diplomatic' },
				{ id: 'observe', text: 'Watch the compass instead of Mira.', intent: 'cautious' }
			],
			hint: 'Her compass moves when someone avoids the truth.',
			scene: {
				title: 'A compass turns',
				summary: 'The brass compass rotates toward the west balcony while Mira goes still.',
				image_prompt:
					'cinematic fantasy tavern table, brass compass glowing, rain-lit floating city through teal windows, warm lanterns',
				image_recommended: true
			}
		});
	}

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: providerHeaders(config, true),
		body: JSON.stringify({
			model: input.model ?? config.chatModel,
			thinking_effort: input.thinkingEffort ?? undefined,
			messages: input.messages,
			temperature: input.temperature ?? 0.75
		})
	});

	const json = await readProviderJson(response);
	if (!response.ok) {
		const error = (json as { error?: { message?: string; code?: string } } | null)?.error;
		throw new ProviderRequestError(
			error?.message ?? `Provider returned ${response.status}`,
			response.status,
			error?.code ?? 'provider_error',
			json
		);
	}

	const content = (json as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
		?.message?.content;
	if (!content) {
		throw new ProviderRequestError(
			'Provider returned no assistant content',
			502,
			'empty_response',
			json
		);
	}
	return content;
}

export async function streamChat(input: {
	messages: ChatMessage[];
	model?: string;
	thinkingEffort?: string | null;
	temperature?: number;
	onContentDelta?: (delta: string) => void;
	onOperationId?: (operationId: string) => void;
	signal?: AbortSignal;
	provider?: Partial<ProviderRouteSettings>;
}) {
	const config = resolveProviderConfig(input.provider);

	if (config.mode === 'mock') {
		const content = await completeChat(input);
		for (const chunk of content.match(/[\s\S]{1,48}/g) ?? []) {
			input.onContentDelta?.(chunk);
		}
		return content;
	}

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: providerHeaders(config, true),
		signal: input.signal,
		body: JSON.stringify({
			model: input.model ?? config.chatModel,
			thinking_effort: input.thinkingEffort ?? undefined,
			messages: input.messages,
			temperature: input.temperature ?? 0.75,
			stream: true
		})
	});

	if (!response.ok) {
		const json = await readProviderJson(response);
		const error = (json as { error?: { message?: string; code?: string } } | null)?.error;
		throw new ProviderRequestError(
			error?.message ?? `Provider returned ${response.status}`,
			response.status,
			error?.code ?? 'provider_error',
			json
		);
	}
	if (!response.body) {
		throw new ProviderRequestError('Provider returned no response body', 502, 'empty_stream', null);
	}
	const operationId = response.headers.get('x-chatgpt-operation-id');
	if (operationId) input.onOperationId?.(operationId);

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let content = '';

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const result = consumeSseBuffer(buffer, (event) => {
			const delta = event.choices?.[0]?.delta?.content;
			if (typeof delta === 'string' && delta) {
				content += delta;
				input.onContentDelta?.(delta);
			}
		});
		buffer = result.remaining;
	}

	buffer += decoder.decode();
	consumeSseBuffer(buffer, (event) => {
		const delta = event.choices?.[0]?.delta?.content;
		if (typeof delta === 'string' && delta) {
			content += delta;
			input.onContentDelta?.(delta);
		}
	});

	if (!content) {
		throw new ProviderRequestError(
			'Provider returned no assistant content',
			502,
			'empty_response',
			null
		);
	}
	return content;
}

function consumeSseBuffer(
	buffer: string,
	onEvent: (event: { choices?: Array<{ delta?: { content?: string } }> }) => void
) {
	let remaining = buffer;
	let index = remaining.indexOf('\n\n');
	while (index !== -1) {
		const frame = remaining.slice(0, index);
		remaining = remaining.slice(index + 2);
		index = remaining.indexOf('\n\n');
		const data = frame
			.split(/\r?\n/)
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice(5).trim())
			.join('\n');
		if (!data || data === '[DONE]') continue;
		try {
			onEvent(JSON.parse(data));
		} catch {
			// Ignore malformed stream frames; the final provider response still validates.
		}
	}
	return { remaining };
}

export async function generateImage(input: {
	prompt: string;
	model?: string;
	jobId: string;
	operationId?: string;
	signal?: AbortSignal;
	provider?: Partial<ProviderRouteSettings>;
}) {
	const config = resolveProviderConfig(input.provider);

	if (config.mode === 'mock') {
		return {
			assetUrl: '/seed/silvermarket-tavern.png',
			localPath: null
		};
	}

	const response = await fetch(`${config.baseUrl}/images/generations`, {
		method: 'POST',
		headers: providerHeaders(config, true),
		signal: input.signal,
		body: JSON.stringify({
			model: input.model ?? config.imageModel,
			prompt: input.prompt,
			n: 1,
			response_format: 'b64_json',
			chatgpt_operation_id: input.operationId
		})
	});

	const json = await readProviderJson(response);
	if (!response.ok) {
		const error = (json as { error?: { message?: string; code?: string } } | null)?.error;
		throw new ProviderRequestError(
			imageErrorMessage(
				error?.message ?? `Image provider returned ${response.status}`,
				error?.code
			),
			response.status,
			error?.code ?? 'image_provider_error',
			json
		);
	}

	const image = (
		json as {
			data?: Array<{ b64_json?: string; url?: string; download_url?: string; path?: string }>;
		}
	)?.data?.[0];
	if (!image)
		throw new ProviderRequestError('Image provider returned no asset', 502, 'empty_image', json);

	if (image.b64_json) {
		const localPath = join(config.imageDir, `${input.jobId}.png`);
		await writeFile(localPath, Buffer.from(image.b64_json, 'base64'));
		return { assetUrl: `/api/assets/images/${input.jobId}`, localPath };
	}

	const imageUrl = image.download_url ?? image.url;
	if (imageUrl?.startsWith('http')) return { assetUrl: imageUrl, localPath: null };
	if (imageUrl?.startsWith('/')) {
		return { assetUrl: new URL(imageUrl, config.publicBaseUrl).toString(), localPath: null };
	}
	if (imageUrl?.startsWith('file://')) {
		return { assetUrl: `/api/assets/images/${input.jobId}`, localPath: fileURLToPath(imageUrl) };
	}
	if (image.path) return { assetUrl: `/api/assets/images/${input.jobId}`, localPath: image.path };

	throw new ProviderRequestError(
		'Image provider returned unsupported asset shape',
		502,
		'bad_image',
		json
	);
}

export async function cancelProviderOperation(
	operationId: string,
	provider?: Partial<ProviderRouteSettings>
) {
	const config = resolveProviderConfig(provider);
	if (config.mode === 'mock') return null;
	const response = await fetch(`${config.baseUrl}/chatgpt/operations/${operationId}/cancel`, {
		method: 'POST',
		headers: providerHeaders(config, true),
		body: '{}'
	});
	return readProviderJson(response);
}

function imageErrorMessage(message: string, code?: string) {
	const normalized = `${code ?? ''} ${message}`.toLowerCase();
	if (
		normalized.includes('limit') ||
		normalized.includes('quota') ||
		normalized.includes('blocked') ||
		normalized.includes('chatgpt_image_no_asset') ||
		normalized.includes('no image asset')
	) {
		return 'Image quota or model access blocked this request. Try again later, switch account/model in the API server, or keep playing with images off.';
	}
	return message;
}

export async function getProviderStatus(provider?: Partial<ProviderRouteSettings>) {
	const config = resolveProviderConfig(provider);
	if (config.mode === 'mock') {
		return {
			mode: config.mode,
			baseUrl: config.publicBaseUrl,
			chatModel: config.chatModel,
			imageModel: config.imageModel,
			authMode: config.authMode,
			apiKeyRequired: false,
			authValidated: true,
			authWarning: null,
			ok: true,
			error: null,
			models: ['mock/chat', 'mock/image']
		};
	}

	try {
		const response = await fetch(`${config.baseUrl}/models`, {
			headers: providerHeaders(config)
		});
		const json = (await readProviderJson(response)) as { data?: Array<{ id?: string }> } | null;
		const adminStatus = response.ok ? await getBridgeAdminStatus(config) : null;
		const apiKeyRequired =
			typeof adminStatus?.server?.api_key_required === 'boolean'
				? adminStatus.server.api_key_required
				: null;
		const authWarning =
			response.ok && config.authMode === 'bearer' && apiKeyRequired === false
				? 'This bridge reports no API auth is enabled, so the Bearer key is ignored. Start the API with --api-key to validate keys.'
				: null;
		return {
			mode: config.mode,
			baseUrl: config.publicBaseUrl,
			chatModel: config.chatModel,
			imageModel: config.imageModel,
			authMode: config.authMode,
			apiKeyRequired,
			authValidated: response.ok && (config.authMode === 'none' || apiKeyRequired !== false),
			authWarning,
			ok: response.ok,
			error: response.ok ? null : `Provider status ${response.status}`,
			models: json?.data?.map((item) => item.id).filter(Boolean) ?? []
		};
	} catch (error) {
		return {
			mode: config.mode,
			baseUrl: config.publicBaseUrl,
			chatModel: config.chatModel,
			imageModel: config.imageModel,
			authMode: config.authMode,
			apiKeyRequired: null,
			authValidated: false,
			authWarning: null,
			ok: false,
			error: error instanceof Error ? error.message : 'Provider unavailable',
			models: []
		};
	}
}

async function getBridgeAdminStatus(config: ReturnType<typeof resolveProviderConfig>) {
	try {
		const response = await fetch(`${config.baseUrl}/chatgpt/admin/status`, {
			headers: providerHeaders(config)
		});
		if (!response.ok) return null;
		const json = await readProviderJson(response);
		return json as { server?: { api_key_required?: boolean } } | null;
	} catch {
		return null;
	}
}
