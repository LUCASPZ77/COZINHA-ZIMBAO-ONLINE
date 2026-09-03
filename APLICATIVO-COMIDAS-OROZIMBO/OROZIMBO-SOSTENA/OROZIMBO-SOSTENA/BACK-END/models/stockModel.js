import pool from './database.js';

export const createStockTable = async () => {
  await pool.query(`
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
      UNIQUE(item, lote)
    );
  `);
};

export const getAllStock = async () => {
  const res = await pool.query('SELECT * FROM estoque WHERE quantidade > 0 ORDER BY item ASC');
  return res.rows;
};

export const getStockById = async (id) => {
  const res = await pool.query('SELECT * FROM estoque WHERE id = $1', [id]);
  return res.rows[0];
};

export const getStockByItemLote = async (item, lote) => {
  const res = await pool.query('SELECT * FROM estoque WHERE item = $1 AND lote = $2 LIMIT 1', [item, lote]);
  return res.rows[0];
};

export const addOrUpdateStock = async ({ item, quantidade, qtd_unidades, lote, validade, created_at, updated_at }) => {
  await pool.query(`
    INSERT INTO estoque (item, quantidade, qtd_unidades, lote, validade, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (item, lote) DO UPDATE SET quantidade = estoque.quantidade + EXCLUDED.quantidade, qtd_unidades = estoque.qtd_unidades + EXCLUDED.qtd_unidades, validade = EXCLUDED.validade, updated_at = EXCLUDED.updated_at;
  `, [item, quantidade, qtd_unidades, lote, validade, created_at, updated_at]);
};

export const upsertStock = async ({ item, quantidade, qtd_unidades, lote, validade, created_at, updated_at }) => {
  await pool.query(`
    INSERT INTO estoque (item, quantidade, qtd_unidades, lote, validade, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (item, lote) DO UPDATE SET quantidade = EXCLUDED.quantidade, qtd_unidades = EXCLUDED.qtd_unidades, validade = EXCLUDED.validade, updated_at = EXCLUDED.updated_at;
  `, [item, quantidade, qtd_unidades, lote, validade, created_at, updated_at]);
};

export const updateStock = async ({ id, quantidade, qtd_unidades, updated_at }) => {
  await pool.query('UPDATE estoque SET quantidade = $1, qtd_unidades = $2, updated_at = $3 WHERE id = $4', [quantidade, qtd_unidades, updated_at, id]);
};

export const deleteStock = async (id) => {
  await pool.query('DELETE FROM estoque WHERE id = $1', [id]);
};
