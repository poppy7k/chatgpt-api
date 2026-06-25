import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { error, redirect } from '@sveltejs/kit';
import { getImageJob } from '$lib/server/store';

export async function GET({ params }) {
	const job = getImageJob(params.jobId);
	if (!job) error(404, 'Image job not found');
	if (job.assetUrl?.startsWith('http')) redirect(302, job.assetUrl);
	if (!job.localPath || !existsSync(job.localPath)) error(404, 'Image file not found');

	const info = await stat(job.localPath);
	return new Response(createReadStream(job.localPath) as unknown as BodyInit, {
		headers: {
			'content-type': 'image/png',
			'content-length': String(info.size),
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
}
