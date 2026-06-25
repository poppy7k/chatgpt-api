import { json } from '@sveltejs/kit';
import { cancelActiveImageJobs } from '$lib/server/image-operations';
import { cancelImageJobs, getSessionView } from '$lib/server/store';

export async function POST({ params }) {
	cancelImageJobs(params.sessionId);
	await cancelActiveImageJobs(params.sessionId);
	return json(getSessionView(params.sessionId));
}
