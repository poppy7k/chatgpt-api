import { json } from '@sveltejs/kit';
import { createSession } from '$lib/server/store';

export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	const view = createSession({
		worldId: String(body.worldId ?? 'arcadia'),
		characterId: String(body.characterId ?? 'mira-vale'),
		startId: typeof body.startId === 'string' ? body.startId : undefined,
		customOrigin: typeof body.customOrigin === 'string' ? body.customOrigin : undefined,
		playerName: typeof body.playerName === 'string' ? body.playerName : undefined,
		settings: typeof body.settings === 'object' && body.settings ? body.settings : undefined,
		provider: typeof body.provider === 'object' && body.provider ? body.provider : undefined
	});
	return json(view, { status: 201 });
}
