import { json } from '@sveltejs/kit';
import { cancelActiveImageJobs } from '$lib/server/image-operations';
import { cancelProviderOperation } from '$lib/server/openai-compatible';
import {
	cancelImageJobs,
	getSessionProviderRouteSettings,
	getSessionView
} from '$lib/server/store';

export async function POST({ params, request }) {
	const body = await request.json().catch(() => ({}));
	const operationId = typeof body.operationId === 'string' ? body.operationId : null;
	const results: Record<string, unknown> = {};
	const provider = getSessionProviderRouteSettings(params.sessionId);

	if (operationId) {
		results.turn = await cancelProviderOperation(operationId, provider).catch((error) => ({
			error: error instanceof Error ? error.message : String(error)
		}));
	}

	cancelImageJobs(params.sessionId);
	results.images = await cancelActiveImageJobs(params.sessionId);

	return json({ status: 'ok', results, session: getSessionView(params.sessionId) });
}
