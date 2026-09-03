import pool from './database.js';

export const createConsumoLogTable = async () => {
  await pool.query(`
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
};

export const getAllLogs = async () => {
  const res = await pool.query(`SELECT consumo_log.*, usuarios.nome AS usuario, estoque.item AS item, consumo_log.timestamp AS data_hora FROM consumo_log LEFT JOIN usuarios ON consumo_log.usuario_id = usuarios.id LEFT JOIN estoque ON consumo_log.item_id = estoque.id ORDER BY consumo_log.id DESC`);
  return res.rows;
};

export const createLog = async ({ item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp }) => {
  const res = await pool.query(`INSERT INTO consumo_log (item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp]);
  return res.rows[0];
};

export const deleteLog = async (id) => {
  await pool.query('DELETE FROM consumo_log WHERE id = $1', [id]);
};
