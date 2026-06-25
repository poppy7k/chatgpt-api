export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type GameState = Record<string, JsonValue>;

export type ImageMode = 'off' | 'suggest' | 'force';
export type ReasoningEffort =
	| 'instant'
	| 'standard'
	| 'extended'
	| 'max'
	| 'pro-standard'
	| 'pro-extended';

export interface WorldProfile {
	id: string;
	name: string;
	tagline: string;
	description: string;
	tone: string;
	seedSceneImage: string;
	defaultFlags: string[];
}

export interface CharacterProfile {
	id: string;
	name: string;
	role: string;
	avatar: string;
	persona: string;
	speakingStyle: string;
	secrets: string[];
	initialStats: Record<string, number>;
}

export interface StartProfile {
	id: string;
	title: string;
	summary: string;
	location: string;
	tags: string[];
	opening: string;
	imagePrompt: string;
	statePatch: GameState;
	choices: GameChoice[];
}

export interface PlayerProfile {
	name: string;
}

export interface GameSettings {
	model: string;
	imageModel: string;
	imageMode: ImageMode;
	reasoningEffort: ReasoningEffort;
	temperature: number;
}

export interface ProviderRouteSettings {
	baseUrl: string;
	authMode: 'bearer' | 'none';
	apiKey?: string | null;
}

export interface PublicProviderRouteSettings {
	baseUrl: string;
	authMode: 'bearer' | 'none';
	apiKeySet: boolean;
}

export interface GameChoice {
	id: string;
	text: string;
	intent?: string;
}

export interface ScenePlan {
	title?: string;
	summary: string;
	imagePrompt: string;
	imageRecommended: boolean;
}

export interface GameSession {
	id: string;
	title: string;
	world: WorldProfile;
	character: CharacterProfile;
	player: PlayerProfile;
	state: GameState;
	settings: GameSettings;
	latestHint: string | null;
	latestChoices: GameChoice[];
	latestScene: ScenePlan | null;
	createdAt: string;
	updatedAt: string;
}

export interface MessageRecord {
	id: string;
	sessionId: string;
	role: 'system' | 'user' | 'assistant';
	content: string;
	createdAt: string;
	meta?: Record<string, JsonValue>;
}

export interface ImageJob {
	id: string;
	sessionId: string;
	status: 'queued' | 'running' | 'generated' | 'failed' | 'cancelled';
	prompt: string;
	assetUrl: string | null;
	localPath: string | null;
	error: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface SessionView {
	session: GameSession;
	messages: MessageRecord[];
	imageJobs: ImageJob[];
	provider: PublicProviderRouteSettings;
}

export interface Catalog {
	worlds: WorldProfile[];
	characters: CharacterProfile[];
	starts: StartProfile[];
}

export interface ProviderStatus {
	mode: 'live' | 'mock';
	baseUrl: string;
	chatModel: string;
	imageModel: string;
	authMode: 'bearer' | 'none';
	apiKeyRequired?: boolean | null;
	authValidated?: boolean;
	authWarning?: string | null;
	ok: boolean;
	error: string | null;
	models: string[];
}
