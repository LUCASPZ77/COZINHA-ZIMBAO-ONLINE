import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import env from '../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL not set in environment. Set it and re-run.');
  process.exit(1);
}

const useSsl = env.NODE_ENV === 'production' && !/localhost|127\.0\.0\.1/.test(env.DATABASE_URL);
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    const dbFile = join(__dirname, '..', 'db.json');
    const raw = fs.readFileSync(dbFile, 'utf8');
    const db = JSON.parse(raw);

    console.log('Creating tables (if not exists)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        sobrenome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        cpf TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL,
        cargo TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS estoque (
        id SERIAL PRIMARY KEY,
        item TEXT NOT NULL,
        quantidade REAL NOT NULL,
        qtd_unidades INTEGER NOT NULL DEFAULT 0,
        lote TEXT NOT NULL,
        validade TEXT,
        unidade TEXT NOT NULL DEFAULT 'kg',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (item, lote)
      );

      CREATE TABLE IF NOT EXISTS consumo_log (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL REFERENCES estoque(id) ON DELETE CASCADE,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
        quantidade REAL NOT NULL,
        unidades INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        hora TEXT NOT NULL,
        tipo TEXT NOT NULL,
        lote TEXT NOT NULL,
        prato TEXT,
        periodo TEXT,
        timestamp TEXT NOT NULL
      );
    `);

    console.log('Beginning transaction and inserting data...');
    await client.query('BEGIN');

    if (Array.isArray(db.users)) {
      for (const u of db.users) {
        await client.query(
          `INSERT INTO usuarios (id, nome, sobrenome, email, cpf, senha_hash, cargo, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (cpf) DO UPDATE SET
             nome = EXCLUDED.nome,
             sobrenome = EXCLUDED.sobrenome,
             email = EXCLUDED.email,
             senha_hash = EXCLUDED.senha_hash,
             cargo = EXCLUDED.cargo,
             created_at = EXCLUDED.created_at,
             updated_at = EXCLUDED.updated_at;
          `,
          [u.id || null, u.nome || '', u.sobrenome || '', u.email || '', u.cpf || '', u.senha_hash || '', u.cargo || 'user', u.created_at || new Date().toISOString(), u.updated_at || new Date().toISOString()]
        );
      }
    }

    if (Array.isArray(db.stock) || Array.isArray(db.estoque)) {
      const stocks = db.stock || db.estoque || [];
      for (const s of stocks) {
        await client.query(
          `INSERT INTO estoque (id, item, quantidade, qtd_unidades, lote, validade, unidade, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (item, lote) DO UPDATE SET
             item = EXCLUDED.item,
             quantidade = EXCLUDED.quantidade,
             qtd_unidades = EXCLUDED.qtd_unidades,
             validade = EXCLUDED.validade,
             unidade = EXCLUDED.unidade,
             created_at = EXCLUDED.created_at,
             updated_at = EXCLUDED.updated_at;
          `,
          [s.id || null, s.item || '', s.quantidade || 0, s.qtd_unidades || 0, s.lote || '', s.validade || null, s.unidade || 'kg', s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString()]
        );
      }
    }

    if (Array.isArray(db.consumo_log) || Array.isArray(db.logs) || Array.isArray(db.consumoLog)) {
      const logs = db.consumo_log || db.logs || db.consumoLog || [];
      for (const l of logs) {
        await client.query(
          `INSERT INTO consumo_log (id, item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO UPDATE SET
             item_id = EXCLUDED.item_id,
             usuario_id = EXCLUDED.usuario_id,
             quantidade = EXCLUDED.quantidade,
             unidades = EXCLUDED.unidades,
             data = EXCLUDED.data,
             hora = EXCLUDED.hora,
             tipo = EXCLUDED.tipo,
             lote = EXCLUDED.lote,
             prato = EXCLUDED.prato,
             periodo = EXCLUDED.periodo,
             timestamp = EXCLUDED.timestamp;
          `,
          [l.id || null, l.item_id || l.item || null, l.usuario_id || null, l.quantidade || 0, l.unidades || 0, l.data || '', l.hora || '', l.tipo || '', l.lote || '', l.prato || null, l.periodo || null, l.timestamp || new Date().toISOString()]
        );
      }
    }

    // Fix sequences to avoid duplicate key errors on next inserts
    await client.query("SELECT setval(pg_get_serial_sequence('usuarios','id'), COALESCE((SELECT MAX(id) FROM usuarios), 1));");
    await client.query("SELECT setval(pg_get_serial_sequence('estoque','id'), COALESCE((SELECT MAX(id) FROM estoque), 1));");
    await client.query("SELECT setval(pg_get_serial_sequence('consumo_log','id'), COALESCE((SELECT MAX(id) FROM consumo_log), 1));");

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
