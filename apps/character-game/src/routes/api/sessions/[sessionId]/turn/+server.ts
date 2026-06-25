import { error, json } from '@sveltejs/kit';
import { runTurn } from '$lib/server/game-engine';

export async function POST({ params, request }) {
	const body = await request.json().catch(() => ({}));
	try {
		const view = await runTurn({
			sessionId: params.sessionId,
			message: String(body.message ?? ''),
			choiceId: typeof body.choiceId === 'string' ? body.choiceId : undefined,
			imageMode: body.imageMode
		});
		return json(view);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Turn failed';
		error(message.includes('not found') ? 404 : 502, message);
	}
}
