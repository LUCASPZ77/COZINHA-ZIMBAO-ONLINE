import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const getEnv = (key, fallback) => process.env[key] || fallback;

const env = {
  PORT: Number(getEnv('PORT', 3000)),
  DB_PATH: getEnv('DB_PATH', './db/escola.db'),
  DATABASE_URL: getEnv('DATABASE_URL', null),
  JWT_SECRET: getEnv('JWT_SECRET', 'change_this_secret'),
  JWT_EXPIRATION: getEnv('JWT_EXPIRATION', '8h'),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
};

export default env;
