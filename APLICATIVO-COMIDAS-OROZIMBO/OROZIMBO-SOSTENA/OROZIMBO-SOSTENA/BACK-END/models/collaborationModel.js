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
      recipient_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      reply_to_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
      forwarded_from_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
      deleted_for_all_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_all_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (sender_user_id, recipient_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS messages_sender_recipient_page_idx ON messages (sender_user_id, recipient_user_id, id DESC);
    CREATE INDEX IF NOT EXISTS messages_recipient_sender_page_idx ON messages (recipient_user_id, sender_user_id, id DESC);

    CREATE TABLE IF NOT EXISTS message_hidden_for_user (
      user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, message_id)
    );
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

export async function removeNotification(id) {
  const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING id', [id]);
  return result.rows[0];
}

export async function deleteExpiredNotifications() {
  const result = await pool.query("DELETE FROM notifications WHERE event_type = 'baixa' AND created_at <= NOW() - INTERVAL '30 days'");
  return result.rowCount;
}

export async function listChatContacts(userId) {
  const result = await pool.query(
    `SELECT id, nome, sobrenome, cargo
     FROM usuarios
     WHERE id <> $1 AND cargo IN ('Diretor', 'Cozinheira')
     ORDER BY CASE cargo WHEN 'Diretor' THEN 0 ELSE 1 END, nome, sobrenome`,
    [userId]
  );
  return result.rows;
}

export async function getChatContact(userId, contactId) {
  const result = await pool.query(
    `SELECT id, nome, sobrenome, cargo
     FROM usuarios
     WHERE id = $1 AND id <> $2 AND cargo IN ('Diretor', 'Cozinheira')`,
    [contactId, userId]
  );
  return result.rows[0];
}

export async function getMessageById(id) {
  const result = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return result.rows[0];
}

export async function getConversationMessages(userId, contactId, beforeId = null, pageSize = 51) {
  const result = await pool.query(
    `SELECT m.*, m.sender_user_id = $1 AS is_mine,
            reply.sender_name AS reply_sender_name,
            reply.body AS reply_body,
            reply.deleted_for_all_at AS reply_deleted_for_all_at,
            forward.sender_name AS forwarded_sender_name
     FROM messages m
     LEFT JOIN messages reply ON reply.id = m.reply_to_message_id
     LEFT JOIN messages forward ON forward.id = m.forwarded_from_id
     WHERE (
       (m.sender_user_id = $1 AND m.recipient_user_id = $2)
       OR (m.sender_user_id = $2 AND m.recipient_user_id = $1)
      OR (m.recipient_user_id IS NULL AND m.recipient_role = 'Cozinheira' AND m.sender_user_id IN ($1, $2))
     )
       AND ($3::bigint IS NULL OR m.id < $3)
       AND m.deleted_for_all_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM message_hidden_for_user hidden
         WHERE hidden.message_id = m.id AND hidden.user_id = $1
       )
     ORDER BY m.id DESC
     LIMIT $4`,
    [userId, contactId, beforeId, pageSize]
  );
  return result.rows.reverse();
}

export async function createMessage({ senderUserId, senderName, recipientUserId, recipientRole, body, replyToMessageId, forwardedFromId }) {
  const result = await pool.query(
    `INSERT INTO messages (sender_user_id, sender_name, recipient_user_id, recipient_role, body, reply_to_message_id, forwarded_from_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [senderUserId, senderName, recipientUserId, recipientRole, body, replyToMessageId || null, forwardedFromId || null]
  );
  return result.rows[0];
}

export async function deleteMessageForEveryone(messageId, userId) {
  const result = await pool.query(
    `UPDATE messages SET deleted_for_all_at = NOW()
     WHERE id = $1 AND sender_user_id = $2 AND deleted_for_all_at IS NULL
     RETURNING id, sender_user_id, recipient_user_id`,
    [messageId, userId]
  );
  return result.rows[0];
}

export async function hideMessageForUser(messageId, userId) {
  await pool.query(
    `INSERT INTO message_hidden_for_user (user_id, message_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, messageId]
  );
}