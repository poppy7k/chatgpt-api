import Database from 'better-sqlite3';
import { getConfig } from './config';

let database: Database.Database | null = null;

export function getDb() {
	if (database) return database;

	const config = getConfig();
	database = new Database(config.dbPath);
	if (config.dbPath !== ':memory:') database.pragma('journal_mode = WAL');
	database.pragma('foreign_keys = ON');
	migrate(database);
	return database;
}

function migrate(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			world_json TEXT NOT NULL,
			character_json TEXT NOT NULL,
			player_json TEXT NOT NULL,
			state_json TEXT NOT NULL,
			settings_json TEXT NOT NULL,
			latest_hint TEXT,
			latest_choices_json TEXT NOT NULL,
			latest_scene_json TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			meta_json TEXT,
			created_at TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS messages_session_created_idx
			ON messages(session_id, created_at);

		CREATE TABLE IF NOT EXISTS image_jobs (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
			status TEXT NOT NULL,
			prompt TEXT NOT NULL,
			asset_url TEXT,
			local_path TEXT,
			error TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS image_jobs_session_created_idx
			ON image_jobs(session_id, created_at);
	`);

	const sessionColumns = db.pragma('table_info(sessions)') as Array<{ name: string }>;
	if (!sessionColumns.some((column) => column.name === 'provider_json')) {
		db.exec('ALTER TABLE sessions ADD COLUMN provider_json TEXT');
	}
}
