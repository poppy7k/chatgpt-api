import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { registerActiveImageJob, unregisterActiveImageJob } from '$lib/server/image-operations';
import { generateSceneImage } from '$lib/server/game-engine';
import { createImageJob, getSessionProviderRouteSettings, getSessionView } from '$lib/server/store';

export async function POST({ params, request }) {
	const body = await request.json().catch(() => ({}));
	try {
		let targetJobId = typeof body.jobId === 'string' ? body.jobId : undefined;
		if (typeof body.prompt === 'string' && body.prompt.trim()) {
			targetJobId = createImageJob(params.sessionId, body.prompt.trim()).id;
		}
		if (!targetJobId) {
			error(400, 'Image prompt or queued job id is required');
		}
		const controller = new AbortController();
		const operationId = `chatgptop_${randomUUID().replaceAll('-', '')}`;
		const provider = getSessionProviderRouteSettings(params.sessionId);
		registerActiveImageJob({
			jobId: targetJobId,
			sessionId: params.sessionId,
			controller,
			operationId,
			provider
		});
		void generateSceneImage(params.sessionId, targetJobId, {
			signal: controller.signal,
			operationId
		})
			.catch((err) => {
				if (!(err instanceof DOMException && err.name === 'AbortError')) {
					console.error('Background image generation failed', err);
				}
			})
			.finally(() => unregisterActiveImageJob(targetJobId));
		return json(getSessionView(params.sessionId));
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Image generation failed';
		error(message.includes('not found') ? 404 : 502, message);
	}
}

export function GET({ params }) {
	return json(getSessionView(params.sessionId).imageJobs);
}
