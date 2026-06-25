import { catalog } from '$lib/server/catalog';
import { publicProviderRouteSettings } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { catalog, providerDefaults: publicProviderRouteSettings() };
};
