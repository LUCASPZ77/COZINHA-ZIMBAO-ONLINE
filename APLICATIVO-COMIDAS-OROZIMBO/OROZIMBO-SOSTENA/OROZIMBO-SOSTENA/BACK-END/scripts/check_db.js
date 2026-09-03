import env from '../config/env.js';
import { Pool } from 'pg';

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL not set. Add it to .env or export it in your shell.');
  process.exit(1);
}

const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function check() {
  const client = await pool.connect();
  try {
    const resUsers = await client.query('SELECT COUNT(*) AS count FROM usuarios');
    const resStock = await client.query('SELECT COUNT(*) AS count FROM estoque');
    const resLogs = await client.query('SELECT COUNT(*) AS count FROM consumo_log');

    console.log('Counts:');
    console.log('  usuarios:', resUsers.rows[0].count);
    console.log('  estoque :', resStock.rows[0].count);
    console.log('  consumo_log:', resLogs.rows[0].count);

    console.log('\nSample rows (up to 5 each):');
    const usersSample = await client.query('SELECT id, nome, email, cpf, cargo, created_at FROM usuarios ORDER BY id LIMIT 5');
    console.table(usersSample.rows);

    const stockSample = await client.query('SELECT id, item, quantidade, lote, validade FROM estoque ORDER BY id LIMIT 5');
    console.table(stockSample.rows);

    const logsSample = await client.query('SELECT id, item_id, usuario_id, quantidade, timestamp FROM consumo_log ORDER BY id DESC LIMIT 5');
    console.table(logsSample.rows);
  } catch (e) {
    console.error('Error checking DB:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

check();
