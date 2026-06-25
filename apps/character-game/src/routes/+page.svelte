<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		ArrowRight,
		Ban,
		Bolt,
		Check,
		CircleAlert,
		Image,
		LoaderCircle,
		Maximize2,
		MessageCircle,
		Plus,
		RefreshCw,
		Send,
		Sparkles,
		Wand2,
		X
	} from 'lucide-svelte';
	import type {
		ImageJob,
		ImageMode,
		MessageRecord,
		ProviderRouteSettings,
		ProviderStatus,
		ReasoningEffort,
		SessionView
	} from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type ModelTier = 'auto' | 'core' | 'thinking' | 'pro';
	type StorySignal = { key: string; label: string; value: number };
	const TURN_TIMEOUT_MS = 45_000;
	const IMAGE_VISIBLE_TIMEOUT_MS = 90_000;
	const ACTIVE_SESSION_STORAGE_KEY = 'characterGame.activeSessionId';
	const SESSION_QUERY_KEY = 'session';

	const modelTiers: Array<{
		id: ModelTier;
		label: string;
		model: string;
		effort: ReasoningEffort;
		description: string;
	}> = [
		{
			id: 'auto',
			label: 'Auto',
			model: 'auto',
			effort: 'instant',
			description: 'Recommended. Lets the API pick an available ChatGPT route.'
		},
		{
			id: 'core',
			label: 'GPT-5.5',
			model: 'gpt-5-5',
			effort: 'instant',
			description: 'Direct core model when this account exposes it.'
		},
		{
			id: 'thinking',
			label: 'Thinking',
			model: 'gpt-5-5-thinking-standard',
			effort: 'standard',
			description: 'More planning for mystery turns and route pivots.'
		},
		{
			id: 'pro',
			label: 'Pro',
			model: 'gpt-5-5-pro-standard',
			effort: 'pro-standard',
			description: 'Highest quality, slower and quota sensitive.'
		}
	];

	const effortOptions: Record<
		ModelTier,
		Array<{ id: ReasoningEffort; label: string; model: string; description: string }>
	> = {
		auto: [
			{
				id: 'instant',
				label: 'Instant',
				model: 'auto',
				description: 'Fastest and safest for Free/Go accounts.'
			}
		],
		core: [
			{
				id: 'instant',
				label: 'Instant',
				model: 'gpt-5-5',
				description: 'No extra thinking. Best default for roleplay.'
			}
		],
		thinking: [
			{
				id: 'standard',
				label: 'Medium',
				model: 'gpt-5-5-thinking-standard',
				description: 'Small planning boost.'
			},
			{
				id: 'extended',
				label: 'High',
				model: 'gpt-5-5-thinking-extended',
				description: 'Use for major reveals.'
			},
			{
				id: 'max',
				label: 'Extra',
				model: 'gpt-5-5-thinking-max',
				description: 'Slowest. Save for chapter turns.'
			}
		],
		pro: [
			{
				id: 'pro-standard',
				label: 'Standard',
				model: 'gpt-5-5-pro-standard',
				description: 'Pro route without the longest wait.'
			},
			{
				id: 'pro-extended',
				label: 'Extended',
				model: 'gpt-5-5-pro-extended',
				description: 'Deep route planning.'
			}
		]
	};

	const originPresets = [
		'I died after clearing a mobile dungeon game, then woke up in a white void while a broken status window asked what I expected from another world.',
		'I was summoned as the wrong hero: no holy sword, no prophecy, only a defective blessing and a court that thinks I am a fraud.',
		'I entered an F-rank gate as the weakest porter, but the dungeon whispered a private quest that no hunter was supposed to receive.',
		'I woke up as the villainess bodyguard minutes before the public execution route begins.',
		'I am a broke dungeon porter who accidentally made a blood contract with the healer.',
		'I transferred into the academy with memories of a manhwa ending where everyone dies.'
	];

	let selectedWorldId = $state('tower-system');
	let selectedCharacterId = $state('ensemble-cast');
	let selectedStartId = $state('system-awakening');
	let playerName = $state('Wanderer');
	let customOrigin = $state('');
	let modelTier = $state<ModelTier>('auto');
	let reasoningEffort = $state<ReasoningEffort>('instant');
	let imageMode = $state<ImageMode>('suggest');
	let temperature = $state(0.75);
	function providerDefaults() {
		return data.providerDefaults;
	}

	let apiBaseUrl = $state(providerDefaults().baseUrl);
	let apiAuthMode = $state<ProviderRouteSettings['authMode']>(providerDefaults().authMode);
	let apiKey = $state('');
	let savedApiBaseUrl = $state(providerDefaults().baseUrl);
	let savedApiAuthMode = $state<ProviderRouteSettings['authMode']>(providerDefaults().authMode);
	let savedApiKey = $state('');
	let routeTesting = $state(false);
	let routeSaving = $state(false);
	let routeSavedAt = $state<string | null>(null);
	let draft = $state('');
	let session = $state<SessionView | null>(null);
	let status = $state<ProviderStatus | null>(null);
	let creating = $state(false);
	let sending = $state(false);
	let opening = $state(false);
	let restoringSession = $state(false);
	let generating = $state(false);
	let turnAbortController = $state<AbortController | null>(null);
	let activeTurnOperationId = $state<string | null>(null);
	let imageAbortController = $state<AbortController | null>(null);
	let pendingUserMessage = $state<MessageRecord | null>(null);
	let streamingAssistantMessage = $state<MessageRecord | null>(null);
	let errorText = $state<string | null>(null);
	let artNotice = $state('Scene art keeps the previous image visible until a new one is ready.');
	let timeline: HTMLDivElement | null = $state(null);
	let artPreviewOpen = $state(false);
	let restoreRequestId = 0;

	let selectedWorld = $derived(
		data.catalog.worlds.find((world) => world.id === selectedWorldId) ?? data.catalog.worlds[0]
	);
	let selectedCharacter = $derived(
		data.catalog.characters.find((character) => character.id === selectedCharacterId) ??
			data.catalog.characters[0]
	);
	let selectedStart = $derived(
		data.catalog.starts.find((start) => start.id === selectedStartId) ?? data.catalog.starts[0]
	);
	let activeWorld = $derived(session?.session.world ?? selectedWorld);
	let activeCharacter = $derived(session?.session.character ?? selectedCharacter);
	let activeChoices = $derived(session?.session.latestChoices ?? selectedStart.choices);
	let activeScene = $derived(session?.session.latestScene ?? null);
	let activeEfforts = $derived(effortOptions[modelTier]);
	let selectedEffort = $derived(
		activeEfforts.find((effort) => effort.id === reasoningEffort) ?? activeEfforts[0]
	);
	let selectedModel = $derived(selectedEffort.model);
	let modelUnavailable = $derived(!isModelAvailable(selectedModel));
	let latestGeneratedImage = $derived(latestGeneratedImageJob(session?.imageJobs ?? []));
	let runningImage = $derived(
		session?.imageJobs.find((job) => job.status === 'queued' || job.status === 'running') ?? null
	);
	let latestFailedImage = $derived(
		session?.imageJobs.find((job) => job.status === 'failed') ?? null
	);
	let latestCancelledImage = $derived(
		session?.imageJobs.find((job) => job.status === 'cancelled') ?? null
	);
	let imageProblem = $derived(isImageQuotaIssue(latestFailedImage?.error));
	let sceneImage = $derived(
		latestGeneratedImage?.assetUrl
			? `${latestGeneratedImage.assetUrl}?v=${encodeURIComponent(latestGeneratedImage.updatedAt)}`
			: activeWorld.seedSceneImage
	);
	let showCastPortrait = $derived(!latestGeneratedImage && activeCharacter.id !== 'ensemble-cast');
	let visibleMessages = $derived(session ? session.messages.filter(isVisibleMessage) : []);
	let lastVisibleMessage = $derived(visibleMessages.at(-1) ?? null);
	let routeNeedsOpeningRetry = $derived(
		Boolean(
			session &&
				!sending &&
				!opening &&
				!restoringSession &&
				visibleMessages.length === 0 &&
				sessionStateText('state_source') === 'model_pending'
		)
	);
	let turnNeedsRetry = $derived(
		Boolean(session && !sending && !opening && !restoringSession && lastVisibleMessage?.role === 'user')
	);
	let needsRecovery = $derived(routeNeedsOpeningRetry || turnNeedsRetry);
	let pendingDisplayMessage = $derived(visiblePendingMessage());
	let displayMessages = $derived([
		...visibleMessages,
		...(pendingDisplayMessage ? [pendingDisplayMessage] : []),
		...(streamingAssistantMessage?.content ? [streamingAssistantMessage] : [])
	]);
	let routeDraftChanged = $derived(
		Boolean(
			session &&
			(session.session.world.id !== selectedWorldId ||
				session.session.character.id !== selectedCharacterId ||
				sessionStateText('base_start_id') !== selectedStartId ||
				sessionStateText('custom_origin').trim() !== customOrigin.trim())
		)
	);
	let apiRouteDirty = $derived(
		apiBaseUrl.trim() !== savedApiBaseUrl ||
			apiAuthMode !== savedApiAuthMode ||
			apiKey.trim() !== savedApiKey
	);
	let storyLocation = $derived(currentStoryLocation());
	let storyChapter = $derived(currentStoryChapter());
	let storySignals = $derived(storyStateSignals());
	let storyNotes = $derived(storyStateNotes());

	onMount(() => {
		loadSavedApiRoute();
		void refreshStatus();
		void restoreSavedSession();
		const cancelOnLeave = () => cancelSessionWorkInBackground();
		window.addEventListener('pagehide', cancelOnLeave);
		window.addEventListener('beforeunload', cancelOnLeave);
		return () => {
			cancelOnLeave();
			window.removeEventListener('pagehide', cancelOnLeave);
			window.removeEventListener('beforeunload', cancelOnLeave);
		};
	});

	$effect(() => {
		if (!session || (!generating && !runningImage)) return;
		const timer = window.setInterval(() => void refreshSession(), 2500);
		return () => window.clearInterval(timer);
	});

	async function refreshStatus(provider: ProviderRouteSettings = providerPayload()) {
		try {
			const response = await fetch('/api/status', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ provider })
			});
			status = await response.json();
		} catch (error) {
			status = {
				mode: 'live',
				baseUrl: 'unknown',
				chatModel: 'unknown',
				imageModel: 'unknown',
				authMode: apiAuthMode,
				ok: false,
				error: error instanceof Error ? error.message : 'Status request failed',
				models: []
			};
		}
	}

	async function testApiRoute() {
		routeTesting = true;
		try {
			await refreshStatus(draftProviderPayload());
		} finally {
			routeTesting = false;
		}
	}

	async function saveApiRoute() {
		routeSaving = true;
		try {
			savedApiBaseUrl = apiBaseUrl.trim();
			savedApiAuthMode = apiAuthMode;
			savedApiKey = apiAuthMode === 'bearer' ? apiKey.trim() : '';
			persistSavedApiRoute();
			routeSavedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			await refreshStatus();
		} finally {
			routeSaving = false;
		}
	}

	async function refreshSession() {
		if (!session) return;
		try {
			const response = await fetch(sessionPath(session.session.id));
			const nextSession = await readJsonResponse(response);
			const ready = nextSession.imageJobs.find(
				(job: { status: string; assetUrl?: string | null }) =>
					job.status === 'generated' && job.assetUrl
			);
			const failed = nextSession.imageJobs.find(
				(job: { status: string; error?: string | null }) => job.status === 'failed' && job.error
			);
			setActiveSession(nextSession);
			if (ready) artNotice = 'New scene art is ready.';
			else if (failed) artNotice = failed.error ?? 'Image generation failed';
		} catch {
			// Polling is only a recovery path for slow image jobs; keep the current view on failure.
		}
	}

	function selectModelTier(next: ModelTier) {
		modelTier = next;
		reasoningEffort = modelTiers.find((tier) => tier.id === next)?.effort ?? 'instant';
	}

	function selectEffort(next: ReasoningEffort) {
		reasoningEffort = next;
	}

	function isModelAvailable(model: string) {
		const models = status?.models ?? [];
		if (!models.length || model === 'auto') return true;
		const raw = model.replace(/^chatgpt-web\//, '');
		return models.includes(model) || models.includes(raw);
	}

	function modelLockReason() {
		if (!modelUnavailable) return '';
		return 'This API did not report that model. Free/Go accounts should stay on Auto.';
	}

	function providerPayload(): ProviderRouteSettings {
		return {
			baseUrl: savedApiBaseUrl.trim(),
			authMode: savedApiAuthMode,
			apiKey: savedApiAuthMode === 'bearer' ? savedApiKey.trim() || undefined : undefined
		};
	}

	function draftProviderPayload(): ProviderRouteSettings {
		return {
			baseUrl: apiBaseUrl.trim(),
			authMode: apiAuthMode,
			apiKey: apiAuthMode === 'bearer' ? apiKey.trim() || undefined : undefined
		};
	}

	function useLocalApi() {
		apiBaseUrl = 'http://127.0.0.1:8000/v1';
	}

	function useLanApiFromPageHost() {
		if (typeof window === 'undefined') return;
		apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:8000/v1`;
	}

	function loadSavedApiRoute() {
		if (typeof window === 'undefined') return;
		const raw = window.localStorage.getItem('characterGame.apiRoute');
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as Partial<ProviderRouteSettings>;
			if (typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()) {
				apiBaseUrl = parsed.baseUrl.trim();
				savedApiBaseUrl = parsed.baseUrl.trim();
			}
			if (parsed.authMode === 'bearer' || parsed.authMode === 'none') {
				apiAuthMode = parsed.authMode;
				savedApiAuthMode = parsed.authMode;
			}
			if (typeof parsed.apiKey === 'string') {
				apiKey = parsed.apiKey;
				savedApiKey = parsed.apiKey;
			}
		} catch {
			// Ignore stale local route settings.
		}
	}

	function persistSavedApiRoute() {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem('characterGame.apiRoute', JSON.stringify(providerPayload()));
	}

	async function restoreSavedSession() {
		if (typeof window === 'undefined') return;
		const sessionId = activeSessionIdFromLocation();
		if (!sessionId) return;
		const requestId = ++restoreRequestId;
		restoringSession = true;
		try {
			const response = await fetch(sessionPath(sessionId));
			const nextSession = await readJsonResponse(response);
			if (requestId !== restoreRequestId) return;
			setActiveSession(nextSession, { syncSetup: true });
			artNotice = latestGeneratedImageJob(nextSession.imageJobs)
				? 'Restored the previous route and scene art.'
				: 'Restored the previous route.';
			await refreshStatus();
			await scrollTimeline('auto');
			maybeStartQueuedImage();
		} catch (error) {
			if (requestId !== restoreRequestId) return;
			clearActiveSessionId(sessionId);
			errorText =
				error instanceof Error
					? `Saved route could not be restored: ${error.message}`
					: 'Saved route could not be restored';
		} finally {
			if (requestId === restoreRequestId) restoringSession = false;
		}
	}

	function startNewChat() {
		restoreRequestId += 1;
		cancelSessionWorkInBackground();
		turnAbortController?.abort();
		imageAbortController?.abort();
		if (session) clearActiveSessionId(session.session.id);
		else clearActiveSessionId();
		session = null;
		creating = false;
		sending = false;
		opening = false;
		restoringSession = false;
		generating = false;
		turnAbortController = null;
		activeTurnOperationId = null;
		imageAbortController = null;
		pendingUserMessage = null;
		streamingAssistantMessage = null;
		errorText = null;
		draft = '';
		artNotice = 'Scene art keeps the previous image visible until a new one is ready.';
	}

	function setActiveSession(nextSession: SessionView, options: { syncSetup?: boolean } = {}) {
		session = nextSession;
		persistActiveSessionId(nextSession.session.id);
		if (options.syncSetup) syncSetupFromSession(nextSession);
	}

	function syncSetupFromSession(nextSession: SessionView) {
		selectedWorldId = nextSession.session.world.id;
		selectedCharacterId = nextSession.session.character.id;
		const startId = nextSession.session.state.base_start_id;
		if (typeof startId === 'string' && data.catalog.starts.some((start) => start.id === startId)) {
			selectedStartId = startId;
		}
		const origin = nextSession.session.state.custom_origin;
		customOrigin = typeof origin === 'string' ? origin : '';
		playerName = nextSession.session.player.name;
		imageMode = nextSession.session.settings.imageMode;
		temperature = nextSession.session.settings.temperature;
		syncModelSelection(nextSession.session.settings.model, nextSession.session.settings.reasoningEffort);
		if (nextSession.provider.baseUrl) {
			apiBaseUrl = nextSession.provider.baseUrl;
			savedApiBaseUrl = nextSession.provider.baseUrl;
			apiAuthMode = nextSession.provider.authMode;
			savedApiAuthMode = nextSession.provider.authMode;
			if (!nextSession.provider.apiKeySet) {
				apiKey = '';
				savedApiKey = '';
			}
		}
	}

	function syncModelSelection(model: string, effort: ReasoningEffort) {
		const exactTier = modelTiers.find((tier) =>
			effortOptions[tier.id].some((option) => option.model === model && option.id === effort)
		);
		const modelTierMatch =
			exactTier ??
			modelTiers.find((tier) => effortOptions[tier.id].some((option) => option.model === model)) ??
			modelTiers.find((tier) => effortOptions[tier.id].some((option) => option.id === effort));
		modelTier = modelTierMatch?.id ?? 'auto';
		const availableEfforts = effortOptions[modelTier];
		reasoningEffort = availableEfforts.some((option) => option.id === effort)
			? effort
			: (availableEfforts.find((option) => option.model === model)?.id ?? availableEfforts[0].id);
	}

	function activeSessionIdFromLocation() {
		const fromUrl = new URL(window.location.href).searchParams.get(SESSION_QUERY_KEY)?.trim();
		if (fromUrl) return fromUrl;
		return window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)?.trim() ?? '';
	}

	function persistActiveSessionId(sessionId: string) {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
		const url = new URL(window.location.href);
		if (url.searchParams.get(SESSION_QUERY_KEY) === sessionId) return;
		url.searchParams.set(SESSION_QUERY_KEY, sessionId);
		window.history.replaceState(window.history.state, '', url);
	}

	function clearActiveSessionId(sessionId?: string) {
		if (typeof window === 'undefined') return;
		if (!sessionId || window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) === sessionId) {
			window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
		}
		const url = new URL(window.location.href);
		if (!sessionId || url.searchParams.get(SESSION_QUERY_KEY) === sessionId) {
			url.searchParams.delete(SESSION_QUERY_KEY);
			window.history.replaceState(window.history.state, '', url);
		}
	}

	function sessionPath(sessionId: string, suffix = '') {
		return `/api/sessions/${encodeURIComponent(sessionId)}${suffix}`;
	}

	function apiRouteStatusText() {
		if (routeTesting) return 'Checking this route...';
		if (routeSaving) return 'Saving route...';
		if (!status) return 'Press Test to check this route.';
		if (!status.ok) return status.error || 'Provider route is offline.';
		if (status.authWarning) return status.authWarning;
		if (status.authMode === 'bearer' && status.authValidated) {
			return `Connected to ${status.baseUrl}. Bearer auth accepted.`;
		}
		return `Connected to ${status.baseUrl}.`;
	}

	function openingPrompt() {
		const custom = customOrigin.trim();
		return [
			'I take my first breath in this game route. Run this as a game master, not as a one-character chat.',
			`Game route: ${selectedStart.title}.`,
			`World: ${selectedWorld.name}.`,
			`Featured cast hook: ${selectedCharacter.name} (${selectedCharacter.role}). This is optional and may enter later.`,
			`Premise: ${custom || selectedStart.opening}`,
			'If this route has a system, dungeon, tower, summon, rank, blessing, or quest premise, start with the system assessment: what I expected, what I actually receive, the first boon, the flaw/cost, and the first playable objective.',
			'Do not let me choose perfect power for free. The world decides whether I am weak, average, chosen, cursed, or secretly dangerous.',
			'Introduce NPCs, system voices, rivals, monsters, or party members only when the scene needs them. Do not force the featured cast to speak.',
			'Open with the scene already moving. Do not ask setup questions.'
		].join('\n');
	}

	async function startSession() {
		if (creating || sending) return;
		creating = true;
		opening = true;
		errorText = null;
		artNotice = 'Opening route through the API. The first reply is generated, not canned.';
		try {
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					worldId: selectedWorldId,
					characterId: selectedCharacterId,
					startId: selectedStartId,
					customOrigin: customOrigin.trim() || undefined,
					playerName,
					settings: {
						model: selectedModel,
						imageModel: 'auto',
						imageMode,
						reasoningEffort,
						temperature
					},
					provider: providerPayload()
				})
			});
			setActiveSession(await readJsonResponse(response), { syncSetup: true });
			await tick();
			await sendTurn(openingPrompt(), undefined, true);
		} catch (error) {
			errorText = error instanceof Error ? error.message : 'Failed to start route';
		} finally {
			creating = false;
			opening = false;
		}
	}

	async function retryInterruptedTurn() {
		if (!session || sending) return;
		if (routeNeedsOpeningRetry) {
			await sendTurn(openingPrompt(), undefined, true);
			return;
		}
		const lastUser = lastVisibleUserMessage();
		if (!lastUser) return;
		await sendTurn(
			[
				'Continue the interrupted response to the player action below.',
				'Do not repeat setup. Do not duplicate the player action as dialogue.',
				`Last player action: ${lastUser.content}`
			].join('\n'),
			undefined,
			true
		);
	}

	async function sendTurn(message = draft, choiceId?: string, hiddenUserMessage = false) {
		if (!session || sending) return;
		const text = message.trim();
		if (!text) return;

		sending = true;
		errorText = null;
		if (!hiddenUserMessage) {
			cancelSceneImageInBackground(
				'New story turn sent. Cancelling older scene art so the next image matches the latest beat.'
			);
		}
		if (!hiddenUserMessage) draft = '';
		if (!hiddenUserMessage) {
			pendingUserMessage = {
				id: `pending_${Date.now()}`,
				sessionId: session.session.id,
				role: 'user',
				content: text,
				createdAt: new Date().toISOString(),
				meta: choiceId ? { choiceId } : undefined
			};
		}
		streamingAssistantMessage = {
			id: `streaming_${Date.now()}`,
			sessionId: session.session.id,
			role: 'assistant',
			content: '',
			createdAt: new Date().toISOString(),
			meta: { streaming: true }
		};
		await scrollTimeline('auto');
		const controller = new AbortController();
		turnAbortController = controller;
		activeTurnOperationId = null;
		const timeout = window.setTimeout(() => {
			controller.abort();
			void cancelActiveTurnProvider();
		}, TURN_TIMEOUT_MS);

		try {
			const response = await fetch(sessionPath(session.session.id, '/turn/stream'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({ message: text, choiceId, imageMode, hiddenUserMessage })
			});
			if (!response.ok || !response.body) {
				setActiveSession(await readJsonResponse(response));
			} else {
				await readTurnStream(response);
			}
			pendingUserMessage = null;
			streamingAssistantMessage = null;
			await refreshStatus();
			await scrollTimeline();
			maybeStartQueuedImage();
		} catch (error) {
			errorText =
				error instanceof DOMException && error.name === 'AbortError'
					? 'The API did not stream a reply within 45 seconds. Try Auto, switch account, or retry this turn.'
					: error instanceof Error
						? error.message
						: 'Turn failed';
			if (!hiddenUserMessage) draft = text;
			pendingUserMessage = null;
			streamingAssistantMessage = null;
		} finally {
			window.clearTimeout(timeout);
			if (turnAbortController === controller) turnAbortController = null;
			activeTurnOperationId = null;
			sending = false;
		}
	}

	function maybeStartQueuedImage() {
		if (!session || imageMode === 'off' || generating) return;
		const queued = session.imageJobs.find((job) => job.status === 'queued');
		if (queued) void generateSceneImage(undefined, queued.id);
	}

	function currentSceneImagePrompt() {
		const scene = activeScene;
		return [
			scene?.imagePrompt ?? scene?.summary ?? selectedStart.summary,
			`Featured cast hook if present in this scene: ${activeCharacter.name}, ${activeCharacter.role}.`,
			`Location: ${storyLocation}.`,
			'Create immersive manga/manhwa scene art for the current story beat only. Show the environment and present characters, not an interface. No game UI, no chat window, no captions, no text.'
		].join(' ');
	}

	async function generateSceneImage(prompt?: string, jobId?: string) {
		if (!session || generating) return;
		generating = true;
		errorText = null;
		artNotice = 'Generating a new scene image. The current image stays visible until it finishes.';
		const controller = new AbortController();
		imageAbortController = controller;
		const timeout = window.setTimeout(() => controller.abort(), IMAGE_VISIBLE_TIMEOUT_MS);
		try {
			const response = await fetch(sessionPath(session.session.id, '/images'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({ prompt, jobId })
			});
			setActiveSession(await readJsonResponse(response));
			artNotice = runningImage
				? 'Scene art is rendering in the background. Keep chatting.'
				: 'Scene art request started. Keep chatting while it renders.';
			await refreshStatus();
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				artNotice =
					'Scene art is taking longer than expected. The old image stays visible while the job is checked.';
			} else {
				artNotice = error instanceof Error ? error.message : 'Image generation failed';
			}
		} finally {
			window.clearTimeout(timeout);
			if (imageAbortController === controller) imageAbortController = null;
			generating = false;
			await refreshSession();
		}
	}

	async function cancelSceneImage() {
		if (!session) return;
		imageAbortController?.abort();
		generating = false;
		artNotice = 'Cancelling scene art and keeping the current image.';
		try {
			const response = await fetch(sessionPath(session.session.id, '/images/cancel'), {
				method: 'POST'
			});
			setActiveSession(await readJsonResponse(response));
		} catch (error) {
			errorText = error instanceof Error ? error.message : 'Failed to cancel scene art';
		}
	}

	function cancelSceneImageInBackground(notice: string) {
		if (!session || (!generating && !runningImage)) return;
		imageAbortController?.abort();
		generating = false;
		artNotice = notice;
		void fetch(sessionPath(session.session.id, '/images/cancel'), { method: 'POST' })
			.then(readJsonResponse)
			.then((nextSession) => {
				setActiveSession(nextSession);
			})
			.catch(() => null);
	}

	async function cancelActiveTurnProvider() {
		if (!session || !activeTurnOperationId) return;
		await fetch(sessionPath(session.session.id, '/cancel'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operationId: activeTurnOperationId })
		}).catch(() => null);
	}

	function cancelSessionWorkInBackground() {
		if (!session) return;
		turnAbortController?.abort();
		imageAbortController?.abort();
		const payload = JSON.stringify({ operationId: activeTurnOperationId });
		const url = sessionPath(session.session.id, '/cancel');
		const blob = new Blob([payload], { type: 'application/json' });
		if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, blob)) return;
		void fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: payload,
			keepalive: true
		}).catch(() => null);
	}

	async function readJsonResponse(response: Response) {
		const json = await response.json().catch(() => null);
		if (!response.ok) {
			throw new Error(
				json?.message ?? json?.error?.message ?? `Request failed: ${response.status}`
			);
		}
		return json;
	}

	async function readTurnStream(response: Response) {
		const reader = response.body?.getReader();
		if (!reader) throw new Error('Turn stream was empty');
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			buffer = consumeTurnStream(buffer);
		}
		buffer += decoder.decode();
		consumeTurnStream(buffer);
	}

	function consumeTurnStream(buffer: string) {
		let remaining = buffer;
		let index = remaining.indexOf('\n\n');
		while (index !== -1) {
			const frame = remaining.slice(0, index);
			remaining = remaining.slice(index + 2);
			index = remaining.indexOf('\n\n');
			const payload = frame
				.split(/\r?\n/)
				.filter((line) => line.startsWith('data:'))
				.map((line) => line.slice(5).trim())
				.join('\n');
			if (!payload) continue;
			handleTurnStreamEvent(JSON.parse(payload));
		}
		return remaining;
	}

	function handleTurnStreamEvent(event: {
		type?: string;
		text?: string;
		message?: string;
		operationId?: string;
		session?: SessionView;
	}) {
		if (event.type === 'operation' && event.operationId) {
			activeTurnOperationId = event.operationId;
			return;
		}
		if (event.type === 'reply_delta' && event.text && streamingAssistantMessage) {
			streamingAssistantMessage = {
				...streamingAssistantMessage,
				content: `${streamingAssistantMessage.content}${event.text}`
			};
			void scrollTimeline();
			return;
		}
		if (event.type === 'done' && event.session) {
			pendingUserMessage = null;
			streamingAssistantMessage = null;
			setActiveSession(event.session);
			return;
		}
		if (event.type === 'error') {
			throw new Error(event.message ?? 'Turn failed');
		}
	}

	function sessionStateText(key: string) {
		const value = session?.session.state?.[key];
		return typeof value === 'string' ? value : '';
	}

	async function scrollTimeline(behavior: ScrollBehavior = 'smooth') {
		await tick();
		timeline?.scrollTo({ top: timeline.scrollHeight, behavior });
	}

	function isVisibleMessage(message: MessageRecord) {
		return message.role !== 'system' && message.meta?.hidden !== true;
	}

	function visiblePendingMessage() {
		const pending = pendingUserMessage;
		if (!pending) return null;
		const pendingAt = Date.parse(pending.createdAt);
		const isAlreadyPersisted = visibleMessages.some((message) => {
			if (message.role !== 'user' || message.content !== pending.content) return false;
			const messageAt = Date.parse(message.createdAt);
			return Number.isFinite(messageAt) && Number.isFinite(pendingAt)
				? messageAt >= pendingAt - 1000
				: true;
		});
		return isAlreadyPersisted ? null : pending;
	}

	function lastVisibleUserMessage() {
		return [...visibleMessages].reverse().find((message) => message.role === 'user') ?? null;
	}

	function isImageQuotaIssue(error?: string | null) {
		if (!error) return false;
		const lowered = error.toLowerCase();
		return (
			lowered.includes('quota') ||
			lowered.includes('limit') ||
			lowered.includes('blocked') ||
			lowered.includes('no asset')
		);
	}

	function imageModeLabel(mode: ImageMode) {
		if (mode === 'off') return 'Off';
		if (mode === 'force') return 'Every reply';
		return 'AI director';
	}

	function imageModeDescription(mode: ImageMode) {
		if (mode === 'off') return 'Text stays fast. Manual image button is still available.';
		if (mode === 'force') return 'Generate after every reply. Good for showcases, heavy on quota.';
		return 'The story model spends quota only on major scene changes, reveals, or action beats.';
	}

	function latestGeneratedImageJob(jobs: ImageJob[]) {
		return (
			jobs
				.filter((job) => job.status === 'generated' && job.assetUrl)
				.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
		);
	}

	function shortTime(value: string) {
		return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function currentStoryLocation() {
		const value = session?.session.state.location;
		return typeof value === 'string' && value.trim() ? value : activeWorld.name;
	}

	function currentStoryChapter() {
		const value = session?.session.state.chapter;
		if (typeof value === 'number' && Number.isFinite(value)) return `Chapter ${value}`;
		if (typeof value === 'string' && value.trim()) {
			return value.toLowerCase().startsWith('chapter') ? value : `Chapter ${value}`;
		}
		return 'Opening';
	}

	function storyStateSignals(): StorySignal[] {
		if (!session) return [];
		const hidden = hiddenStateKeys();
		return Object.entries(session.session.state)
			.filter(
				([key, value]) => !hidden.has(key) && typeof value === 'number' && Number.isFinite(value)
			)
			.slice(0, 4)
			.map(([key, value]) => ({
				key,
				label: humanizeStateKey(key),
				value: clampPercent(Number(value))
			}));
	}

	function storyStateNotes() {
		if (!session) return [];
		const hidden = hiddenStateKeys();
		return Object.entries(session.session.state)
			.filter(
				([key, value]) =>
					!hidden.has(key) && typeof value !== 'number' && typeof value !== 'boolean'
			)
			.slice(0, 2)
			.map(([key, value]) => ({
				key,
				label: humanizeStateKey(key),
				value: formatStateValue(value)
			}));
	}

	function humanizeStateKey(key: string) {
		return key
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase())
			.replace(/\bNpc\b/g, 'NPC')
			.replace(/\bHp\b/g, 'HP');
	}

	function clampPercent(value: number) {
		return Math.max(0, Math.min(100, Math.round(value)));
	}

	function formatStateValue(value: unknown) {
		if (Array.isArray(value)) return value.map(String).join(', ');
		if (value && typeof value === 'object') return Object.values(value).map(String).join(', ');
		return String(value);
	}

	function hiddenStateKeys() {
		return new Set([
			'route_id',
			'route_title',
			'state_source',
			'cast_hook',
			'location',
			'chapter',
			'origin',
			'cheat_claim_blocked'
		]);
	}
</script>

<svelte:head>
	<title>Afterdark Routes</title>
	<meta
		name="description"
		content="A dark manga roleplay use case for a local OpenAI-shaped ChatGPT Web API."
	/>
</svelte:head>

<main class="app-shell">
	<section class="setup-pane" aria-label="Story setup">
		<header class="brand">
			<div class="brand-icon"><Sparkles size={21} /></div>
			<div>
				<span>Open source use case</span>
				<strong>Afterdark Routes</strong>
			</div>
		</header>

		<section class="setup-section">
			<div class="section-heading">
				<span>1</span>
				<div>
					<strong>Game route</strong>
					<small>The GM streams this opening through the API.</small>
				</div>
			</div>
			<div class="start-list">
				{#each data.catalog.starts as start (start.id)}
					<button
						class:active={selectedStartId === start.id}
						onclick={() => (selectedStartId = start.id)}
					>
						<strong>{start.title}</strong>
						<span>{start.summary}</span>
					</button>
				{/each}
			</div>
			<label class="field">
				<span>Custom origin</span>
				<textarea
					bind:value={customOrigin}
					rows="4"
					placeholder="Write a custom first-life setup, reincarnation hook, debt, secret, or relationship..."
				></textarea>
			</label>
			<div class="origin-presets">
				{#each originPresets as preset (preset)}
					<button onclick={() => (customOrigin = preset)}>{preset}</button>
				{/each}
			</div>
		</section>

		<section class="setup-section">
			<div class="section-heading">
				<span>2</span>
				<div>
					<strong>World style</strong>
					<small>Sets the dungeon, academy, noir, or system atmosphere.</small>
				</div>
			</div>
			<div class="world-list">
				{#each data.catalog.worlds as world (world.id)}
					<button
						class:active={selectedWorldId === world.id}
						onclick={() => (selectedWorldId = world.id)}
					>
						<img src={world.seedSceneImage} alt="" />
						<div>
							<strong>{world.name}</strong>
							<span>{world.tagline}</span>
						</div>
					</button>
				{/each}
			</div>
		</section>

		<section class="setup-section">
			<div class="section-heading">
				<span>3</span>
				<div>
					<strong>Cast hook</strong>
					<small>Optional. The GM can bring this person in later with other NPCs.</small>
				</div>
			</div>
			<div class="character-grid">
				{#each data.catalog.characters as character (character.id)}
					<button
						class:active={selectedCharacterId === character.id}
						onclick={() => (selectedCharacterId = character.id)}
					>
						<img src={character.avatar} alt="" />
						<span>{character.role}</span>
						<strong>{character.name}</strong>
					</button>
				{/each}
			</div>
		</section>

		<section class="setup-section settings-block">
			<div class="section-heading">
				<span>4</span>
				<div>
					<strong>Model and art</strong>
					<small>Auto is safest for Free/Go.</small>
				</div>
			</div>
			<div class="tier-grid">
				{#each modelTiers as tier (tier.id)}
					<button class:active={modelTier === tier.id} onclick={() => selectModelTier(tier.id)}>
						<strong>{tier.label}</strong>
						<span>{tier.description}</span>
					</button>
				{/each}
			</div>
			<div class="effort-strip">
				{#each activeEfforts as effort (effort.id)}
					<button
						class:active={reasoningEffort === effort.id}
						disabled={!isModelAvailable(effort.model)}
						title={effort.description}
						onclick={() => selectEffort(effort.id)}
					>
						<Bolt size={14} />
						{effort.label}
					</button>
				{/each}
			</div>
			{#if modelUnavailable}
				<p class="warning-line">{modelLockReason()}</p>
			{/if}
			<div class="mode-grid">
				{#each ['suggest', 'force', 'off'] as ImageMode[] as mode (mode)}
					<button class:active={imageMode === mode} onclick={() => (imageMode = mode)}>
						<strong>{imageModeLabel(mode)}</strong>
						<span>{imageModeDescription(mode)}</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="setup-section api-route-card">
			<div class="section-heading">
				<span>5</span>
				<div>
					<strong>API route</strong>
					<small>Consumer setting only. Full account management lives in the API console.</small>
				</div>
			</div>
			<label class="field">
				<span>OpenAI-shaped base URL</span>
				<input bind:value={apiBaseUrl} placeholder="http://127.0.0.1:8000/v1" />
			</label>
			<div class="route-buttons">
				<button type="button" onclick={useLocalApi}>Local</button>
				<button type="button" onclick={useLanApiFromPageHost}>This host:8000</button>
				<button type="button" disabled={routeTesting} onclick={testApiRoute}>
					{routeTesting ? 'Testing...' : 'Test'}
				</button>
				<button type="button" disabled={routeSaving} onclick={saveApiRoute}>
					{routeSaving ? 'Saving...' : 'Save'}
				</button>
			</div>
			<div class="auth-grid">
				<button
					type="button"
					class:active={apiAuthMode === 'bearer'}
					onclick={() => (apiAuthMode = 'bearer')}
				>
					Bearer key
				</button>
				<button
					type="button"
					class:active={apiAuthMode === 'none'}
					onclick={() => (apiAuthMode = 'none')}
				>
					No auth
				</button>
			</div>
			<label class="field">
				<span>API key</span>
				<input
					bind:value={apiKey}
					disabled={apiAuthMode === 'none'}
					type="password"
					placeholder="blank uses server default, e.g. local-dev-key"
				/>
			</label>
			<p class:warn={Boolean(status?.authWarning)} class="route-note">{apiRouteStatusText()}</p>
			{#if apiRouteDirty}
				<p class="route-note warn">Route settings changed. Save before starting a new route.</p>
			{:else if routeSavedAt}
				<p class="route-note">Saved at {routeSavedAt}.</p>
			{/if}
		</section>
	</section>

	<section class:playing={Boolean(session)} class="play-pane">
		<header class="route-topbar">
			<div>
				<span>{session ? 'Live game' : 'Game preview'}</span>
				<strong>{activeScene?.title ?? selectedStart.title} / {activeWorld.name}</strong>
			</div>
			<div class="topbar-actions">
				<button
					class="new-chat-button"
					disabled={!session && !restoringSession}
					onclick={startNewChat}
				>
					<Plus size={15} />
					New chat
				</button>
				<div class="api-pill" class:online={status?.ok}>
					<span></span>
					<div>
						<strong>{status?.ok ? 'API online' : 'API offline'}</strong>
						<small>{status?.baseUrl ?? 'checking...'}</small>
					</div>
					<button onclick={() => refreshStatus()} aria-label="Refresh API status">
						<RefreshCw size={14} />
					</button>
				</div>
			</div>
		</header>

		<section
			class:art-ready={Boolean(latestGeneratedImage)}
			class="scene-stage"
			aria-label="Scene art"
		>
			<img
				class:generated={Boolean(latestGeneratedImage)}
				class="scene-bg"
				src={sceneImage}
				alt=""
			/>
			<div class="scene-gradient"></div>
			<div class="scene-noise"></div>
			{#if showCastPortrait}
				<img class="character-portrait" src={activeCharacter.avatar} alt="" />
			{/if}
			<button
				class="scene-art-hitbox"
				disabled={!sceneImage}
				aria-label="Open scene art preview"
				onclick={() => (artPreviewOpen = true)}
			></button>
			<div class="scene-copy">
				<span>{session ? 'GM-led route' : 'API-generated opening'}</span>
				<h1>{activeScene?.title ?? selectedStart.title}</h1>
				<p>{activeScene?.summary ?? selectedStart.summary}</p>
			</div>
			<div class="art-status" class:problem={imageProblem}>
				{#if generating || runningImage}
					<LoaderCircle class="spin" size={16} />
					<span>Generating new scene, old image kept</span>
					<button onclick={cancelSceneImage}>Cancel</button>
				{:else if imageProblem}
					<CircleAlert size={16} />
					<span>Image blocked: {latestFailedImage?.error}</span>
				{:else if latestCancelledImage}
					<Ban size={16} />
					<span>{artNotice}</span>
				{:else}
					<Image size={16} />
					<span>{artNotice}</span>
				{/if}
			</div>
			<div class="scene-actions">
				<button
					class="secondary-art-button"
					disabled={!sceneImage}
					onclick={() => (artPreviewOpen = true)}
				>
					<Maximize2 size={16} />
					View art
				</button>
				<button
					class="primary-art-button"
					disabled={!session || generating || Boolean(runningImage)}
					onclick={() => generateSceneImage(currentSceneImagePrompt())}
				>
					{#if generating || runningImage}
						<LoaderCircle class="spin" size={16} />
						Creating
					{:else}
						<Wand2 size={16} />
						Generate scene
					{/if}
				</button>
				<button
					class="secondary-art-button"
					disabled={!session || (!generating && !runningImage)}
					onclick={cancelSceneImage}
				>
					<Ban size={16} />
					Cancel art
				</button>
			</div>
		</section>

		{#if errorText}
			<div class="error-banner">
				<CircleAlert size={17} />
				<span>{errorText}</span>
			</div>
		{/if}

		<section class="chat-shell">
			<div class="chat-header">
				<div>
					<span>Roleplay stream</span>
					<strong>{session ? session.session.title : 'No route started'}</strong>
				</div>
				<div class="model-readout">
					<span>{selectedModel}</span>
				</div>
			</div>

			{#if session}
				<div class="state-strip" aria-label="Story state">
					<div class="state-meta">
						<span>{storyChapter}</span>
						<strong>{storyLocation}</strong>
					</div>
					{#if storySignals.length || storyNotes.length}
						<div class="state-signals">
							{#each storySignals as signal (signal.key)}
								<div class="state-signal">
									<div>
										<span>{signal.label}</span>
										<strong>{signal.value}%</strong>
									</div>
									<i style={`--value: ${signal.value}%`}></i>
								</div>
							{/each}
							{#each storyNotes as note (note.key)}
								<span class="state-note"><strong>{note.label}</strong>{note.value}</span>
							{/each}
						</div>
					{:else}
						<div class="state-empty">
							The route will surface relationship, danger, or clue signals as it develops.
						</div>
					{/if}
				</div>
			{/if}

			{#if !session}
				<div class="empty-chat">
					<MessageCircle size={30} />
					<h2>{restoringSession ? 'Restoring your last route.' : 'The first scene is not prewritten.'}</h2>
					<p>
						{restoringSession
							? 'The saved session is being loaded from the local game database.'
							: 'Press start and this app immediately streams the opening from your local API using the route, world, optional cast hook, and custom origin above.'}
					</p>
					<button
						class="start-button"
						disabled={creating || restoringSession || modelUnavailable}
						onclick={startSession}
					>
						{#if restoringSession}
							<LoaderCircle class="spin" size={18} />
							Restoring route
						{:else if creating || opening}
							<LoaderCircle class="spin" size={18} />
							Opening route
						{:else}
							Start and stream first scene
							<ArrowRight size={18} />
						{/if}
					</button>
				</div>
			{:else}
				<div class="messages" bind:this={timeline}>
					{#each displayMessages as message (message.id)}
						<article class:user={message.role === 'user'} class="message">
							{#if message.role === 'assistant'}
								<img src={activeCharacter.avatar} alt="" />
							{/if}
							<div class="bubble">
								<header>
									<strong
										>{message.role === 'user'
											? session.session.player.name
											: activeCharacter.name}</strong
									>
									<span>
										{message.id.startsWith('pending_')
											? 'sent'
											: message.id.startsWith('streaming_')
												? 'streaming'
												: shortTime(message.createdAt)}
									</span>
								</header>
								<p>{message.content}</p>
							</div>
						</article>
					{/each}
					{#if sending && !streamingAssistantMessage?.content}
						<article class="message">
							<img src={activeCharacter.avatar} alt="" />
							<div class="typing">
								<span></span><span></span><span></span>
								<strong>Waiting for the first streamed line</strong>
							</div>
						</article>
					{/if}
					{#if needsRecovery}
						<article class="recovery-card">
							<div>
								<strong>
									{routeNeedsOpeningRetry
										? 'Opening was interrupted'
										: 'Last reply was interrupted'}
								</strong>
								<p>
									{routeNeedsOpeningRetry
										? 'The route exists in SQLite, but the first generated scene did not finish before the page refreshed.'
										: 'Your last action is saved, but the assistant reply did not finish before the page refreshed.'}
								</p>
							</div>
							<div class="recovery-actions">
								<button disabled={sending} onclick={retryInterruptedTurn}>
									<RefreshCw size={15} />
									{routeNeedsOpeningRetry ? 'Retry opening' : 'Retry reply'}
								</button>
								<button onclick={startNewChat}>
									<Plus size={15} />
									New chat
								</button>
							</div>
						</article>
					{/if}
				</div>

				<div class="choice-row">
					{#each activeChoices as choice, index (choice.id)}
						<button disabled={sending || needsRecovery} onclick={() => sendTurn(choice.text, choice.id)}>
							<span>{index + 1}</span>
							{choice.text}
						</button>
					{/each}
				</div>
			{/if}

			<form
				class="composer"
				onsubmit={(event) => {
					event.preventDefault();
					sendTurn();
				}}
			>
				<textarea
					bind:value={draft}
					placeholder={session
						? sending
							? 'Keep typing your next move. Send unlocks when the reply finishes.'
							: 'Type dialogue or action...'
						: 'Start a route first.'}
					disabled={!session}
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey && !sending) {
							event.preventDefault();
							sendTurn();
						}
					}}></textarea>
				<button disabled={!session || sending || !draft.trim()} aria-label="Send">
					{#if sending}
						<LoaderCircle class="spin" size={20} />
					{:else}
						<Send size={20} />
					{/if}
				</button>
			</form>
		</section>

		{#if routeDraftChanged}
			<div class="draft-toast">
				<Check size={16} />
				<span>Setup changed. Press start again to open a new route with those choices.</span>
				<button onclick={startSession}>Start new route</button>
			</div>
		{/if}
	</section>

	{#if artPreviewOpen}
		<div
			class="art-lightbox"
			role="dialog"
			aria-modal="true"
			aria-label="Scene art preview"
			onclick={(event) => {
				if (event.currentTarget === event.target) artPreviewOpen = false;
			}}
			onkeydown={(event) => {
				if (event.key === 'Escape') artPreviewOpen = false;
			}}
			tabindex="0"
		>
			<div class="art-lightbox-panel">
				<header>
					<div>
						<span>Scene art</span>
						<strong>{activeScene?.title ?? selectedStart.title}</strong>
					</div>
					<button aria-label="Close art preview" onclick={() => (artPreviewOpen = false)}>
						<X size={18} />
					</button>
				</header>
				<img src={sceneImage} alt="" />
				<p>{activeScene?.summary ?? selectedStart.summary}</p>
			</div>
		</div>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at 18% -8%, rgba(236, 72, 153, 0.22), transparent 30rem),
			radial-gradient(circle at 86% 12%, rgba(56, 189, 248, 0.16), transparent 28rem), #06070d;
		color: #f7f1ff;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	button,
	textarea {
		font: inherit;
	}

	button {
		color: inherit;
		cursor: pointer;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.48;
	}

	.app-shell {
		display: grid;
		grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
		min-height: 100vh;
	}

	.setup-pane {
		height: 100vh;
		overflow: auto;
		border-right: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(8, 9, 17, 0.9);
		padding: 1.1rem;
	}

	.brand,
	.route-topbar,
	.chat-header,
	.section-heading,
	.api-pill,
	.topbar-actions,
	.art-status,
	.scene-actions,
	.choice-row,
	.model-readout,
	.new-chat-button,
	.recovery-actions,
	.draft-toast {
		display: flex;
		align-items: center;
	}

	.brand {
		gap: 0.8rem;
		margin-bottom: 1.2rem;
	}

	.brand-icon {
		display: grid;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 1px solid rgba(244, 114, 182, 0.5);
		border-radius: 14px;
		background: linear-gradient(135deg, rgba(244, 114, 182, 0.22), rgba(96, 165, 250, 0.14));
		color: #f9a8d4;
	}

	.brand span,
	.section-heading small,
	.field span,
	.route-topbar span,
	.api-pill small,
	.chat-header span,
	.model-readout span,
	.art-status span,
	.warning-line,
	.world-list span,
	.start-list span,
	.mode-grid span,
	.tier-grid span,
	.character-grid span {
		color: #a9a3bb;
	}

	.brand strong {
		display: block;
		font-size: 1.24rem;
		letter-spacing: 0.02em;
	}

	.setup-section {
		margin-top: 0.78rem;
	}

	.section-heading {
		gap: 0.7rem;
		margin-bottom: 0.55rem;
	}

	.section-heading > span {
		display: grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border-radius: 50%;
		background: #f472b6;
		color: #170711;
		font-weight: 800;
	}

	.section-heading strong,
	.chat-header strong,
	.route-topbar strong {
		display: block;
	}

	.character-grid {
		display: flex;
		gap: 0.58rem;
		overflow-x: auto;
		padding-bottom: 0.15rem;
	}

	.character-grid button,
	.world-list button,
	.start-list button,
	.tier-grid button,
	.mode-grid button,
	.origin-presets button {
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.055);
		text-align: left;
		transition:
			border-color 0.18s ease,
			background 0.18s ease,
			transform 0.18s ease;
	}

	.character-grid button:hover,
	.world-list button:hover,
	.start-list button:hover,
	.tier-grid button:hover,
	.mode-grid button:hover {
		transform: translateY(-1px);
		border-color: rgba(244, 114, 182, 0.5);
	}

	.character-grid button {
		flex: 0 0 132px;
		min-height: 126px;
		overflow: hidden;
		border-radius: 18px;
		padding: 0;
		position: relative;
	}

	.character-grid button::after {
		position: absolute;
		inset: 0;
		content: '';
		background: linear-gradient(180deg, transparent 35%, rgba(0, 0, 0, 0.82));
	}

	.character-grid img {
		width: 100%;
		height: 100%;
		min-height: 126px;
		object-fit: cover;
	}

	.character-grid strong,
	.character-grid span {
		position: absolute;
		z-index: 1;
		left: 0.8rem;
		right: 0.8rem;
	}

	.character-grid span {
		bottom: 2.25rem;
		font-size: 0.78rem;
	}

	.character-grid strong {
		bottom: 0.75rem;
	}

	button.active {
		border-color: rgba(244, 114, 182, 0.78);
		background: rgba(244, 114, 182, 0.14);
		box-shadow: 0 0 0 1px rgba(244, 114, 182, 0.16) inset;
	}

	.world-list,
	.start-list,
	.origin-presets,
	.tier-grid,
	.mode-grid {
		display: grid;
		gap: 0.58rem;
	}

	.world-list,
	.start-list {
		display: flex;
		overflow-x: auto;
		padding-bottom: 0.12rem;
	}

	.world-list button {
		display: grid;
		grid-template-columns: 58px 1fr;
		flex: 0 0 270px;
		gap: 0.62rem;
		align-items: center;
		border-radius: 16px;
		padding: 0.34rem;
	}

	.world-list img {
		width: 58px;
		height: 48px;
		object-fit: cover;
		border-radius: 12px;
	}

	.world-list strong,
	.start-list strong,
	.tier-grid strong,
	.mode-grid strong {
		display: block;
		margin-bottom: 0.25rem;
	}

	.world-list span,
	.start-list span,
	.tier-grid span,
	.mode-grid span {
		display: block;
		font-size: 0.78rem;
		line-height: 1.35;
	}

	.start-list button,
	.tier-grid button,
	.mode-grid button,
	.origin-presets button {
		border-radius: 14px;
		padding: 0.62rem;
	}

	.start-list button {
		flex: 0 0 250px;
		min-height: 88px;
	}

	.field {
		display: grid;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.field textarea,
	.field input,
	.composer textarea {
		width: 100%;
		resize: vertical;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.065);
		color: #fff;
		outline: none;
		padding: 0.85rem;
	}

	.field textarea:focus,
	.field input:focus,
	.composer textarea:focus {
		border-color: rgba(244, 114, 182, 0.72);
		box-shadow: 0 0 0 3px rgba(244, 114, 182, 0.12);
	}

	.field input:disabled {
		color: #7c738a;
		background: rgba(255, 255, 255, 0.035);
	}

	.api-route-card {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 0.8rem;
	}

	.route-buttons,
	.auth-grid {
		display: flex;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.route-buttons button,
	.auth-grid button {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.46rem 0.68rem;
		font-size: 0.78rem;
	}

	.route-note {
		margin: 0.55rem 0 0;
		color: #a9a3bb;
		font-size: 0.78rem;
		line-height: 1.35;
	}

	.route-note.warn {
		color: #f8d47a;
	}

	.origin-presets {
		display: flex;
		overflow-x: auto;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.origin-presets button {
		flex: 0 0 230px;
		font-size: 0.8rem;
		color: #d9d2e8;
	}

	.effort-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.65rem;
	}

	.effort-strip button,
	.scene-actions button,
	.choice-row button,
	.api-pill button,
	.start-button,
	.composer button,
	.draft-toast button,
	.art-status button {
		border: 0;
	}

	.effort-strip button {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		padding: 0.48rem 0.68rem;
	}

	.warning-line {
		margin: 0.55rem 0 0;
		color: #fecdd3;
		font-size: 0.82rem;
	}

	.mode-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 0.75rem;
	}

	.tier-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.tier-grid button,
	.mode-grid button {
		min-height: 78px;
	}

	.tier-grid span,
	.mode-grid span {
		font-size: 0.74rem;
	}

	.play-pane {
		min-width: 0;
		padding: 1rem;
	}

	.play-pane.playing {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(340px, 440px);
		grid-template-rows: auto minmax(0, 1fr);
		grid-template-areas:
			'top top'
			'chat scene';
		gap: 1rem;
		height: 100vh;
		overflow: hidden;
	}

	.play-pane.playing .route-topbar {
		grid-area: top;
		margin-bottom: 0;
	}

	.play-pane.playing .scene-stage {
		grid-area: scene;
		height: 100%;
		min-height: 0;
	}

	.play-pane.playing .chat-shell {
		grid-area: chat;
		min-height: 0;
		margin-top: 0;
	}

	.play-pane.playing .error-banner {
		grid-column: 1 / -1;
	}

	.route-topbar {
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.topbar-actions {
		justify-content: flex-end;
		gap: 0.65rem;
		min-width: 0;
	}

	.new-chat-button {
		flex: 0 0 auto;
		gap: 0.42rem;
		min-height: 38px;
		border: 1px solid rgba(255, 255, 255, 0.13);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.07);
		color: #f7f1ff;
		padding: 0 0.78rem;
		font-size: 0.86rem;
		font-weight: 800;
	}

	.api-pill {
		gap: 0.6rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.44rem 0.48rem 0.44rem 0.8rem;
		max-width: 46vw;
	}

	.api-pill > span {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: #fb7185;
	}

	.api-pill.online > span {
		background: #34d399;
	}

	.api-pill small {
		display: block;
		max-width: 32vw;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.api-pill button {
		display: grid;
		width: 32px;
		height: 32px;
		place-items: center;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
	}

	.scene-stage {
		position: relative;
		overflow: hidden;
		min-height: 38vh;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 28px;
		background: #0d0f18;
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
	}

	.scene-stage.art-ready {
		background:
			radial-gradient(circle at 50% 12%, rgba(244, 114, 182, 0.16), transparent 38%), #080a12;
	}

	.scene-bg,
	.scene-gradient,
	.scene-noise {
		position: absolute;
		inset: 0;
	}

	.scene-bg {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(1.04) contrast(1.04);
	}

	.scene-bg.generated {
		object-fit: contain;
		padding: 0.8rem;
		filter: none;
	}

	.scene-gradient {
		background:
			linear-gradient(90deg, rgba(5, 6, 13, 0.92), rgba(5, 6, 13, 0.38), rgba(5, 6, 13, 0.82)),
			linear-gradient(0deg, rgba(5, 6, 13, 0.88), transparent 62%);
	}

	.scene-stage.art-ready .scene-gradient {
		background:
			linear-gradient(0deg, rgba(5, 6, 13, 0.72), transparent 34%, rgba(5, 6, 13, 0.3)),
			linear-gradient(90deg, rgba(5, 6, 13, 0.35), transparent 44%, rgba(5, 6, 13, 0.35));
	}

	.scene-noise {
		opacity: 0.22;
		background-image: linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
		background-size: 100% 4px;
	}

	.character-portrait {
		position: absolute;
		z-index: 1;
		right: 8%;
		bottom: -10%;
		width: min(34vw, 420px);
		max-height: 112%;
		object-fit: contain;
		filter: drop-shadow(0 24px 36px rgba(0, 0, 0, 0.65));
	}

	.scene-art-hitbox {
		position: absolute;
		z-index: 1;
		inset: 0;
		border: 0;
		background: transparent;
		cursor: zoom-in;
	}

	.scene-art-hitbox:focus-visible {
		outline: 2px solid rgba(244, 114, 182, 0.9);
		outline-offset: -8px;
	}

	.scene-art-hitbox:disabled {
		cursor: default;
	}

	.scene-copy {
		position: relative;
		z-index: 2;
		width: min(58ch, 62%);
		padding: clamp(1.4rem, 5vw, 3.4rem);
	}

	.scene-stage.art-ready .scene-copy {
		position: absolute;
		left: 0.85rem;
		right: 0.85rem;
		bottom: 4.6rem;
		width: auto;
		border: 1px solid rgba(255, 255, 255, 0.13);
		border-radius: 20px;
		background: rgba(5, 6, 13, 0.68);
		padding: 0.85rem;
		backdrop-filter: blur(16px);
	}

	.scene-copy span {
		display: inline-flex;
		border: 1px solid rgba(244, 114, 182, 0.38);
		border-radius: 999px;
		background: rgba(244, 114, 182, 0.12);
		color: #fbcfe8;
		padding: 0.34rem 0.62rem;
		font-size: 0.8rem;
	}

	.scene-copy h1 {
		margin: 0.85rem 0 0.6rem;
		font-size: clamp(2.3rem, 7vw, 5.6rem);
		line-height: 0.9;
		letter-spacing: -0.04em;
	}

	.scene-stage.art-ready .scene-copy h1 {
		margin: 0.45rem 0 0.25rem;
		font-size: clamp(1.15rem, 2vw, 1.8rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.scene-copy p {
		margin: 0;
		max-width: 48ch;
		color: #ded6ef;
		font-size: clamp(0.98rem, 1.5vw, 1.18rem);
		line-height: 1.6;
	}

	.scene-stage.art-ready .scene-copy p {
		display: -webkit-box;
		overflow: hidden;
		font-size: 0.88rem;
		line-height: 1.45;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.art-status {
		position: absolute;
		z-index: 3;
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		justify-content: space-between;
		gap: 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 18px;
		background: rgba(4, 5, 10, 0.68);
		padding: 0.65rem;
		backdrop-filter: blur(16px);
	}

	.art-status.problem {
		border-color: rgba(251, 113, 133, 0.55);
	}

	.art-status button,
	.scene-actions button,
	.choice-row button,
	.start-button,
	.draft-toast button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		border-radius: 999px;
		background: #f472b6;
		color: #190713;
		font-weight: 800;
		padding: 0.58rem 0.8rem;
	}

	.scene-actions {
		position: absolute;
		z-index: 3;
		top: 1rem;
		right: 1rem;
		left: 1rem;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.scene-actions .secondary-art-button,
	.art-status button,
	.choice-row button,
	.draft-toast button {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.scene-actions .secondary-art-button {
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(14px);
	}

	.art-lightbox {
		position: fixed;
		z-index: 30;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(2, 3, 8, 0.86);
		padding: clamp(0.75rem, 3vw, 2rem);
		backdrop-filter: blur(18px);
	}

	.art-lightbox-panel {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: min(1180px, 96vw);
		height: min(860px, 92vh);
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 28px;
		background:
			radial-gradient(circle at 50% 0%, rgba(244, 114, 182, 0.16), transparent 34%), #070913;
		box-shadow: 0 40px 120px rgba(0, 0, 0, 0.7);
	}

	.art-lightbox-panel header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.85rem 1rem;
	}

	.art-lightbox-panel header span {
		display: block;
		color: #a9a3bb;
		font-size: 0.78rem;
	}

	.art-lightbox-panel header strong {
		display: block;
		color: #fff;
	}

	.art-lightbox-panel header button {
		display: grid;
		width: 38px;
		height: 38px;
		place-items: center;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
	}

	.art-lightbox-panel img {
		width: 100%;
		height: 100%;
		min-height: 0;
		object-fit: contain;
		background: #03040a;
	}

	.art-lightbox-panel p {
		margin: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		color: #d9d2e8;
		padding: 0.8rem 1rem;
		line-height: 1.5;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 1rem 0;
		border: 1px solid rgba(251, 113, 133, 0.4);
		border-radius: 16px;
		background: rgba(127, 29, 29, 0.2);
		color: #fecdd3;
		padding: 0.75rem 0.9rem;
	}

	.chat-shell {
		display: flex;
		flex-direction: column;
		margin-top: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 26px;
		background: rgba(10, 11, 20, 0.74);
		overflow: hidden;
	}

	.chat-header {
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.95rem 1rem;
	}

	.state-strip {
		display: grid;
		grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
		gap: 0.75rem;
		overflow-x: auto;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.8rem 1rem;
	}

	.state-meta {
		display: grid;
		align-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.055);
		padding: 0.65rem 0.75rem;
	}

	.state-meta span {
		color: #a9a3bb;
		font-size: 0.75rem;
	}

	.state-meta strong {
		overflow: hidden;
		color: #fff;
		font-size: 0.9rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.state-signals {
		display: flex;
		align-items: stretch;
		gap: 0.52rem;
		min-width: 0;
		overflow-x: auto;
	}

	.state-signal {
		display: grid;
		flex: 0 0 154px;
		gap: 0.45rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.055);
		padding: 0.6rem;
	}

	.state-signal div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.state-signal span {
		overflow: hidden;
		color: #d9d2e8;
		font-size: 0.74rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.state-signal strong {
		color: #f9a8d4;
		font-size: 0.78rem;
	}

	.state-signal i {
		position: relative;
		display: block;
		height: 5px;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
	}

	.state-signal i::after {
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--value);
		border-radius: inherit;
		background: linear-gradient(90deg, #f472b6, #60a5fa);
		content: '';
	}

	.state-note {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.4rem;
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #d9d2e8;
		padding: 0.38rem 0.62rem;
		font-size: 0.78rem;
	}

	.state-note strong {
		color: #f9a8d4;
	}

	.state-empty {
		align-self: center;
		color: #a9a3bb;
		font-size: 0.82rem;
	}

	.model-readout {
		gap: 0.45rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.model-readout span {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.065);
		padding: 0.34rem 0.55rem;
		font-size: 0.78rem;
	}

	.empty-chat {
		display: grid;
		place-items: center;
		min-height: 340px;
		padding: 2rem;
		text-align: center;
	}

	.empty-chat h2 {
		margin: 0.75rem 0 0.4rem;
		font-size: clamp(1.7rem, 4vw, 3rem);
		letter-spacing: -0.04em;
	}

	.empty-chat p {
		max-width: 48ch;
		margin: 0 auto 1.2rem;
		color: #bcb4cd;
		line-height: 1.65;
	}

	.start-button {
		min-height: 46px;
		padding-inline: 1rem;
	}

	.messages {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		height: min(54vh, 680px);
		min-height: 300px;
		overflow: auto;
		padding: 1rem;
		scroll-behavior: smooth;
	}

	.play-pane.playing .messages {
		height: auto;
		min-height: 0;
	}

	.message {
		display: flex;
		align-items: flex-start;
		gap: 0.68rem;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message img {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		object-fit: cover;
	}

	.bubble {
		max-width: min(72ch, 78%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.075);
		padding: 0.82rem 0.95rem;
	}

	.message.user .bubble {
		background: linear-gradient(135deg, rgba(244, 114, 182, 0.26), rgba(96, 165, 250, 0.14));
	}

	.bubble header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.42rem;
		font-size: 0.82rem;
	}

	.bubble header span {
		color: #9d95ad;
	}

	.bubble p {
		margin: 0;
		white-space: pre-wrap;
		line-height: 1.68;
	}

	.typing {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.075);
		padding: 0.72rem 0.9rem;
		color: #d9d2e8;
	}

	.typing span {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: #f9a8d4;
		animation: pulse 1s infinite ease-in-out;
	}

	.typing span:nth-child(2) {
		animation-delay: 0.16s;
	}

	.typing span:nth-child(3) {
		animation-delay: 0.32s;
	}

	.recovery-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border: 1px solid rgba(251, 191, 36, 0.3);
		border-radius: 20px;
		background:
			linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(244, 114, 182, 0.08)),
			rgba(255, 255, 255, 0.06);
		padding: 1rem;
	}

	.recovery-card strong {
		color: #fde68a;
	}

	.recovery-card p {
		margin: 0.25rem 0 0;
		color: #d7ccbc;
		line-height: 1.55;
	}

	.recovery-actions {
		flex: 0 0 auto;
		gap: 0.5rem;
	}

	.recovery-actions button {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 38px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		color: #fff7ed;
		font-weight: 800;
	}

	.recovery-actions button:first-child {
		background: #fde68a;
		color: #241406;
	}

	.choice-row {
		gap: 0.5rem;
		overflow-x: auto;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.78rem 1rem;
	}

	.choice-row button {
		flex: 0 0 auto;
		max-width: 300px;
		background: rgba(255, 255, 255, 0.09);
		color: #f8f4ff;
		font-weight: 650;
		white-space: normal;
	}

	.choice-row button span {
		display: grid;
		width: 22px;
		height: 22px;
		place-items: center;
		border-radius: 50%;
		background: rgba(244, 114, 182, 0.22);
		color: #fbcfe8;
	}

	.composer {
		display: grid;
		grid-template-columns: 1fr 52px;
		gap: 0.65rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding: 1rem;
	}

	.composer textarea {
		min-height: 54px;
		max-height: 140px;
		resize: vertical;
	}

	.composer button {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 18px;
		background: #f472b6;
		color: #190713;
	}

	.draft-toast {
		position: sticky;
		bottom: 1rem;
		z-index: 5;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 1rem auto 0;
		width: min(820px, 100%);
		border: 1px solid rgba(244, 114, 182, 0.38);
		border-radius: 18px;
		background: rgba(12, 13, 24, 0.9);
		padding: 0.7rem;
		backdrop-filter: blur(16px);
	}

	:global(.spin) {
		animation: spin 0.85s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse {
		0%,
		80%,
		100% {
			opacity: 0.35;
			transform: translateY(0);
		}
		40% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}

	@media (max-width: 1050px) {
		.app-shell {
			grid-template-columns: 1fr;
		}

		.play-pane.playing {
			display: block;
			height: auto;
			overflow: visible;
		}

		.play-pane.playing .route-topbar {
			margin-bottom: 1rem;
		}

		.play-pane.playing .scene-stage {
			height: auto;
			min-height: 520px;
		}

		.play-pane.playing .chat-shell {
			margin-top: 1rem;
		}

		.setup-pane {
			height: auto;
			border-right: 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		}

		.scene-copy {
			width: 78%;
		}

		.character-portrait {
			opacity: 0.52;
			right: -4%;
		}
	}

	@media (max-width: 680px) {
		.play-pane,
		.setup-pane {
			padding: 0.75rem;
		}

		.character-grid {
			grid-template-columns: 1fr 1fr;
		}

		.route-topbar {
			align-items: flex-start;
			flex-direction: column;
		}

		.topbar-actions {
			align-items: stretch;
			flex-wrap: wrap;
			width: 100%;
		}

		.new-chat-button {
			justify-content: center;
		}

		.api-pill,
		.api-pill small {
			max-width: 100%;
		}

		.api-pill {
			flex: 1 1 230px;
		}

		.scene-stage {
			min-height: 430px;
			border-radius: 22px;
		}

		.scene-copy {
			width: 100%;
			padding: 1.2rem;
		}

		.scene-stage.art-ready .scene-copy {
			position: relative;
			inset: auto;
			margin: 1rem;
		}

		.scene-copy h1 {
			font-size: 3rem;
		}

		.character-portrait {
			width: 88%;
			right: -18%;
			bottom: -7%;
		}

		.art-status,
		.scene-actions {
			position: relative;
			inset: auto;
			margin: 0.75rem;
		}

		.scene-actions {
			justify-content: flex-start;
		}

		.state-strip {
			grid-template-columns: 1fr;
		}

		.messages {
			height: 48vh;
		}

		.recovery-card,
		.recovery-actions {
			align-items: stretch;
			flex-direction: column;
		}

		.recovery-actions button {
			justify-content: center;
		}

		.bubble {
			max-width: 88%;
		}
	}
</style>
