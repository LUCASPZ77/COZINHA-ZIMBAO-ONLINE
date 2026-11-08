import pool from './database.js';

export async function createCollaborationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      actor_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      sender_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      sender_name TEXT NOT NULL,
      recipient_role TEXT NOT NULL DEFAULT 'Cozinheira',
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);
  `);
}

export async function createNotification({ actorUserId, actorName, eventType, message, metadata }) {
  const result = await pool.query(
    `INSERT INTO notifications (actor_user_id, actor_name, event_type, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
    [actorUserId, actorName, eventType, message, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
}

export async function getNotifications() {
  const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100');
  return result.rows;
}

export async function markAllNotificationsRead() {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL');
}

export async function createMessage({ senderUserId, senderName, body }) {
  const result = await pool.query(
    `INSERT INTO messages (sender_user_id, sender_name, body)
     VALUES ($1, $2, $3) RETURNING *`,
    [senderUserId, senderName, body]
  );
  return result.rows[0];
}

export async function getMessages() {
  const result = await pool.query('SELECT * FROM (SELECT * FROM messages ORDER BY created_at DESC LIMIT 100) recent ORDER BY created_at ASC');
  return result.rows;
}