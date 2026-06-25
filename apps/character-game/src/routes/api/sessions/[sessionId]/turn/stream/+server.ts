import { runTurn } from '$lib/server/game-engine';

function encodeEvent(data: unknown) {
	return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST({ params, request }) {
	const body = await request.json().catch(() => ({}));
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (data: unknown) => controller.enqueue(encoder.encode(encodeEvent(data)));
			try {
				send({ type: 'started' });
				const view = await runTurn({
					sessionId: params.sessionId,
					message: String(body.message ?? ''),
					choiceId: typeof body.choiceId === 'string' ? body.choiceId : undefined,
					imageMode: body.imageMode,
					hiddenUserMessage: body.hiddenUserMessage === true,
					onReplyDelta: (text) => send({ type: 'reply_delta', text }),
					onOperationId: (operationId) => send({ type: 'operation', operationId }),
					signal: request.signal
				});
				send({ type: 'done', session: view });
			} catch (error) {
				send({
					type: 'error',
					message: error instanceof Error ? error.message : 'Turn failed'
				});
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'content-type': 'text/event-stream; charset=utf-8'
		}
	});
}
