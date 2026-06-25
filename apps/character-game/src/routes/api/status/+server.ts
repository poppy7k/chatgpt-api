import { json } from '@sveltejs/kit';
import { getProviderStatus } from '$lib/server/openai-compatible';

export async function GET() {
	return json(await getProviderStatus());
}

export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	const provider = typeof body.provider === 'object' && body.provider ? body.provider : undefined;
	return json(await getProviderStatus(provider));
}
