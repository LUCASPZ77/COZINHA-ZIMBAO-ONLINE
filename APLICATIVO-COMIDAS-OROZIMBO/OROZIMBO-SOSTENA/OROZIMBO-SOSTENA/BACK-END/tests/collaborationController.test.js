import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../models/database.js';
import { createBaixaNotification, sendMessageController } from '../controllers/collaborationController.js';
import { subscribeToEvents } from '../services/realtimeHub.js';

test('completed baja notification is persisted and broadcast to directors', async () => {
  const originalQuery = pool.query;
  const frames = [];
  const unsubscribe = subscribeToEvents({ id: 9, cargo: 'Diretor', nome: 'Diretor' }, frame => frames.push(frame));
  let insertedValues;
  pool.query = async (sql, values) => {
    assert.match(sql, /INSERT INTO notifications/);
    insertedValues = values;
    return { rows: [{ id: '18', actor_name: values[1], message: values[3], created_at: '2026-01-02T10:00:00.000Z', read_at: null }] };
  };

  try {
    const notification = await createBaixaNotification(
      { id: 7, nome: 'Cozinheira', sobrenome: 'Teste' },
      'Arroz com feijão',
      'Almoço',
      [{ id: 3 }]
    );

    assert.equal(insertedValues[0], 7);
    assert.equal(notification.actor_name, 'Cozinheira Teste');
    assert.ok(frames.some(frame => frame.includes('event: notification') && frame.includes('"actor_name":"Cozinheira Teste"')));
  } finally {
    pool.query = originalQuery;
    unsubscribe();
  }
});

test('director message is persisted and broadcast to cooks', async () => {
  const originalQuery = pool.query;
  const frames = [];
  const unsubscribe = subscribeToEvents({ id: 7, cargo: 'Cozinheira', nome: 'Cozinheira' }, frame => frames.push(frame));
  pool.query = async (sql, values) => {
    if (/SELECT id, nome, sobrenome, cargo/.test(sql)) return { rows: [{ id: 7, nome: 'Cozinheira', sobrenome: 'Teste', cargo: 'Cozinheira' }] };
    assert.match(sql, /INSERT INTO messages/);
    return { rows: [{ id: '29', sender_user_id: values[0], sender_name: values[1], recipient_user_id: values[2], body: values[4], created_at: '2026-01-02T10:00:00.000Z' }] };
  };
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  try {
    await sendMessageController(
      { body: { body: 'Separar frutas amanhã', recipientUserId: 7 }, user: { id: 2, nome: 'Diretora', sobrenome: 'Teste' } },
      response,
      error => { throw error; }
    );

    assert.equal(response.statusCode, 201);
    assert.equal(response.payload.body, 'Separar frutas amanhã');
    assert.ok(frames.some(frame => frame.includes('event: message') && frame.includes('Separar frutas amanhã')));
  } finally {
    pool.query = originalQuery;
    unsubscribe();
  }
});