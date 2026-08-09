import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import env from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = env.DB_PATH.startsWith('.') ? join(__dirname, '..', env.DB_PATH) : env.DB_PATH;
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

export default db;
