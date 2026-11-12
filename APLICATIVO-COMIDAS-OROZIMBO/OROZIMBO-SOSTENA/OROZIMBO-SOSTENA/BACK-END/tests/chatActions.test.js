import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../models/database.js';
import { deleteMessageController, forwardMessageController } from '../controllers/collaborationController.js';
import { subscribeToEvents } from '../services/realtimeHub.js';

function responseSpy() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('only the author can delete a message for everyone', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push(sql);
    if (/SELECT \* FROM messages WHERE id/.test(sql)) {
      return { rows: [{ id: 33, sender_user_id: 7, recipient_user_id: 8, deleted_for_all_at: null }] };
    }
    return { rows: [] };
  };
  const response = responseSpy();

  try {
    await deleteMessageController(
      { params: { id: '33' }, query: { scope: 'everyone' }, user: { id: 8 } },
      response,
      error => { throw error; }
    );

    assert.equal(response.statusCode, 403);
    assert.equal(calls.some(sql => /UPDATE messages/.test(sql)), false);
  } finally { pool.query = originalQuery; }
});

test('recipient can hide a message only from their own view', async () => {
  const originalQuery = pool.query;
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT \* FROM messages WHERE id/.test(sql)) {
      return { rows: [{ id: 34, sender_user_id: 7, recipient_user_id: 8, deleted_for_all_at: null }] };
    }
    return { rows: [] };
  };
  const response = responseSpy();

  try {
    await deleteMessageController(
      { params: { id: '34' }, query: { scope: 'me' }, user: { id: 8 } },
      response,
      error => { throw error; }
    );

    assert.equal(response.statusCode, 200);
    assert.ok(calls.some(call => /INSERT INTO message_hidden_for_user/.test(call.sql) && call.values[0] === 8));
  } finally { pool.query = originalQuery; }
});

test('forwarding copies a conversation message to the selected contact', async () => {
  const originalQuery = pool.query;
  const frames = [];
  const unsubscribe = subscribeToEvents({ id: 22, cargo: 'Cozinheira', nome: 'Bia' }, frame => frames.push(frame));
  pool.query = async (sql, values) => {
    if (/SELECT \* FROM messages WHERE id/.test(sql)) {
      return { rows: [{ id: 35, sender_user_id: 10, recipient_user_id: 11, body: 'Separar frutas', deleted_for_all_at: null }] };
    }
    if (/SELECT id, nome, sobrenome, cargo/.test(sql)) {
      return { rows: [{ id: 22, nome: 'Bia', sobrenome: 'Teste', cargo: 'Cozinheira' }] };
    }
    assert.match(sql, /INSERT INTO messages/);
    return { rows: [{ id: 36, sender_user_id: values[0], sender_name: values[1], recipient_user_id: values[2], body: values[4], forwarded_from_id: values[6], created_at: '2026-01-02T10:00:00.000Z' }] };
  };
  const response = responseSpy();

  try {
    await forwardMessageController(
      { params: { id: '35' }, body: { recipientUserId: 22 }, user: { id: 10, nome: 'Diretor', sobrenome: 'Teste' } },
      response,
      error => { throw error; }
    );

    assert.equal(response.statusCode, 201);
    assert.equal(response.payload.body, 'Separar frutas');
    assert.equal(response.payload.forwarded_from_id, 35);
    assert.ok(frames.some(frame => frame.includes('event: message') && frame.includes('Separar frutas')));
  } finally {
    pool.query = originalQuery;
    unsubscribe();
  }
});