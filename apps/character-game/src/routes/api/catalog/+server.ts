import { json } from '@sveltejs/kit';
import { catalog } from '$lib/server/catalog';

export function GET() {
	return json(catalog);
}
