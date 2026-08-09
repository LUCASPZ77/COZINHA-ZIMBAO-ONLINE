import db from './database.js';

export const createConsumoLogTable = () => {
  // Create with nullable usuario_id for compatibility; if old table has NOT NULL, migrate safely
  db.exec(`
    CREATE TABLE IF NOT EXISTS consumo_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      usuario_id INTEGER,
      quantidade REAL NOT NULL,
      unidades INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      hora TEXT NOT NULL,
      tipo TEXT NOT NULL,
      lote TEXT NOT NULL,
      prato TEXT,
      periodo TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES estoque(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `);

  // Check existing schema and migrate if usuario_id was previously NOT NULL
  try {
    const cols = db.prepare("PRAGMA table_info(consumo_log)").all();
    const usuarioCol = cols.find(c => c.name === 'usuario_id');
    if (usuarioCol && usuarioCol.notnull === 1) {
      // migrate to new table allowing NULL usuario_id
      db.exec('BEGIN');
      db.exec(`
        CREATE TABLE IF NOT EXISTS consumo_log_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL,
          usuario_id INTEGER,
          quantidade REAL NOT NULL,
          unidades INTEGER NOT NULL DEFAULT 0,
          data TEXT NOT NULL,
          hora TEXT NOT NULL,
          tipo TEXT NOT NULL,
          lote TEXT NOT NULL,
          prato TEXT,
          periodo TEXT,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (item_id) REFERENCES estoque(id) ON DELETE CASCADE,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
      `);
      db.exec('INSERT INTO consumo_log_new (id, item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp) SELECT id, item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp FROM consumo_log');
      db.exec('DROP TABLE consumo_log');
      db.exec('ALTER TABLE consumo_log_new RENAME TO consumo_log');
      db.exec('COMMIT');
    }
  } catch (e) {
    // Non-fatal migration error — log and continue
    console.error('consumo_log migration:', e.message);
  }
};

export const getAllLogs = () => db.prepare('SELECT consumo_log.*, usuarios.nome AS usuario, estoque.item AS item, consumo_log.timestamp AS data_hora FROM consumo_log LEFT JOIN usuarios ON consumo_log.usuario_id = usuarios.id LEFT JOIN estoque ON consumo_log.item_id = estoque.id ORDER BY consumo_log.id DESC').all();
export const createLog = ({ item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp }) =>
  db.prepare(`INSERT INTO consumo_log (item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(item_id, usuario_id, quantidade, unidades, data, hora, tipo, lote, prato, periodo, timestamp);
export const deleteLog = (id) => db.prepare('DELETE FROM consumo_log WHERE id = ?').run(id);
