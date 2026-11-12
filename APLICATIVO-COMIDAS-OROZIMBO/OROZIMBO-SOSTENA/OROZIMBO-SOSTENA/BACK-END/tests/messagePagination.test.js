import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../models/database.js';
import { listMessagesController } from '../controllers/collaborationController.js';

test('conversation endpoint returns 50 messages and a hasMore flag', async () => {
  const originalQuery = pool.query;
  let conversationQuery = '';
  pool.query = async (sql, values) => {
    if (/SELECT id, nome, sobrenome, cargo/.test(sql)) {
      return { rows: [{ id: 22, nome: 'Contato', cargo: 'Cozinheira' }] };
    }
    conversationQuery = sql;
    assert.deepEqual(values, [10, 22, 400, 51]);
    return { rows: Array.from({ length: 51 }, (_, index) => ({ id: 500 - index })) };
  };
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  try {
    await listMessagesController(
      { query: { contactId: '22', before: '400' }, user: { id: 10 } },
      response,
      error => { throw error; }
    );

    assert.match(conversationQuery, /ORDER BY m\.id DESC/);
    assert.match(conversationQuery, /LIMIT \$4/);
    assert.equal(response.payload.messages.length, 50);
    assert.equal(response.payload.hasMore, true);
    assert.equal(response.payload.messages[0].id, 451);
  } finally { pool.query = originalQuery; }
});

test('conversation endpoint rejects an invalid page cursor', async () => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  await listMessagesController(
    { query: { contactId: '22', before: 'bad' }, user: { id: 10 } },
    response,
    error => { throw error; }
  );

  assert.equal(response.statusCode, 400);
});