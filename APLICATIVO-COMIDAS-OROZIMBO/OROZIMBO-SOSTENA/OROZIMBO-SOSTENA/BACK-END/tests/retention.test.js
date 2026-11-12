import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../models/database.js';
import { deleteExpiredNotifications } from '../models/collaborationModel.js';
import { deleteExpiredConsumptionLogs } from '../models/consumoLogModel.js';
import { deleteNotificationController } from '../controllers/collaborationController.js';

test('consumption retention removes only ISO dates at least 30 days old', async () => {
  const originalQuery = pool.query;
  let queryText = '';
  pool.query = async sql => {
    queryText = sql;
    return { rowCount: 4 };
  };

  try {
    assert.equal(await deleteExpiredConsumptionLogs(), 4);
    assert.match(queryText, /tipo = 'SAIDA'/);
    assert.match(queryText, /data::date <= CURRENT_DATE - 30/);
    assert.match(queryText, /ELSE FALSE/);
  } finally { pool.query = originalQuery; }
});

test('notification retention uses a rolling 30-day cutoff', async () => {
  const originalQuery = pool.query;
  let queryText = '';
  pool.query = async sql => {
    queryText = sql;
    return { rowCount: 2 };
  };

  try {
    assert.equal(await deleteExpiredNotifications(), 2);
    assert.match(queryText, /event_type = 'baixa'/);
    assert.match(queryText, /created_at <= NOW\(\) - INTERVAL '30 days'/);
  } finally { pool.query = originalQuery; }
});

test('director can delete a notification and missing notifications return 404', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, values) => {
    assert.match(sql, /DELETE FROM notifications/);
    assert.equal(values[0], 91);
    return { rows: [] };
  };
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  try {
    await deleteNotificationController({ params: { id: '91' } }, response, error => { throw error; });
    assert.equal(response.statusCode, 404);
    assert.equal(response.payload.error, 'Notificação não encontrada.');
  } finally { pool.query = originalQuery; }
});