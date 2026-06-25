import { error, json } from '@sveltejs/kit';
import { getSessionView } from '$lib/server/store';

export function GET({ params }) {
	try {
		return json(getSessionView(params.sessionId));
	} catch {
		error(404, 'Session not found');
	}
}
