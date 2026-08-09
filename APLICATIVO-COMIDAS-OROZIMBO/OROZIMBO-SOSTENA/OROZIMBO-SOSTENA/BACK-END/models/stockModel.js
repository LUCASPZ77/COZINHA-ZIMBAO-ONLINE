import db from './database.js';

export const createStockTable = () => db.exec(`
CREATE TABLE IF NOT EXISTS estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

export const getAllStock = () => db.prepare('SELECT * FROM estoque WHERE quantidade > 0 ORDER BY item ASC').all();
export const getStockById = (id) => db.prepare('SELECT * FROM estoque WHERE id = ?').get(id);
export const getStockByItemLote = (item, lote) => db.prepare('SELECT * FROM estoque WHERE item = ? AND lote = ?').get(item, lote);
export const addOrUpdateStock = ({ item, quantidade, qtd_unidades, lote, validade, created_at, updated_at }) =>
  db.prepare(`INSERT INTO estoque (item, quantidade, qtd_unidades, lote, validade, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item, lote) DO UPDATE SET quantidade = quantidade + excluded.quantidade, qtd_unidades = qtd_unidades + excluded.qtd_unidades, validade = excluded.validade, updated_at = excluded.updated_at`)
    .run(item, quantidade, qtd_unidades, lote, validade, created_at, updated_at);
export const upsertStock = ({ item, quantidade, qtd_unidades, lote, validade, created_at, updated_at }) =>
  db.prepare(`INSERT INTO estoque (item, quantidade, qtd_unidades, lote, validade, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item, lote) DO UPDATE SET quantidade = excluded.quantidade, qtd_unidades = excluded.qtd_unidades, validade = excluded.validade, updated_at = excluded.updated_at`)
    .run(item, quantidade, qtd_unidades, lote, validade, created_at, updated_at);
export const updateStock = ({ id, quantidade, qtd_unidades, updated_at }) =>
  db.prepare('UPDATE estoque SET quantidade = ?, qtd_unidades = ?, updated_at = ? WHERE id = ?')
    .run(quantidade, qtd_unidades, updated_at, id);
export const deleteStock = (id) => db.prepare('DELETE FROM estoque WHERE id = ?').run(id);
