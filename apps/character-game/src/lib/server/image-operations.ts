import { cancelProviderOperation } from './openai-compatible';
import type { ProviderRouteSettings } from '$lib/types';

type ActiveImageJob = {
	sessionId: string;
	controller: AbortController;
	operationId: string;
	provider: ProviderRouteSettings;
};

const activeImageJobs = new Map<string, ActiveImageJob>();

export function registerActiveImageJob(input: ActiveImageJob & { jobId: string }) {
	activeImageJobs.set(input.jobId, {
		sessionId: input.sessionId,
		controller: input.controller,
		operationId: input.operationId,
		provider: input.provider
	});
}

export function unregisterActiveImageJob(jobId: string) {
	activeImageJobs.delete(jobId);
}

export async function cancelActiveImageJobs(sessionId: string) {
	const jobs = [...activeImageJobs.entries()].filter(([, job]) => job.sessionId === sessionId);
	for (const [, job] of jobs) job.controller.abort();
	const results = await Promise.allSettled(
		jobs.map(([, job]) => cancelProviderOperation(job.operationId, job.provider))
	);
	return {
		cancelled: jobs.length,
		results: results.map((result) =>
			result.status === 'fulfilled'
				? { ok: true, value: result.value }
				: {
						ok: false,
						error: result.reason instanceof Error ? result.reason.message : String(result.reason)
					}
		)
	};
}
