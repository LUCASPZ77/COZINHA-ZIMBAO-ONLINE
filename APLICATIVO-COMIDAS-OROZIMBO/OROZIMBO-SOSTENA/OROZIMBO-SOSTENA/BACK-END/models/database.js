import { Pool } from 'pg';
import env from '../config/env.js';

const pool = new Pool({
	connectionString: env.DATABASE_URL || undefined,
	ssl: env.NODE_ENV === 'production' && env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export default pool;
export const query = (text, params) => pool.query(text, params);
