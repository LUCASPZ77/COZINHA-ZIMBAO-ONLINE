import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSseTicket, issueSseTicket, publishToRole, subscribeToEvents } from '../services/realtimeHub.js';

test('SSE ticket is temporary and can only be consumed once', () => {
  const user = { id: 7, cargo: 'Diretor' };
  const ticket = issueSseTicket(user);

  assert.equal(consumeSseTicket(ticket), user);
  assert.equal(consumeSseTicket(ticket), null);
});

test('SSE events are delivered only to subscribers of the target role', () => {
  const directorFrames = [];
  const cookFrames = [];
  const unsubscribeDirector = subscribeToEvents({ cargo: 'Diretor' }, frame => directorFrames.push(frame));
  const unsubscribeCook = subscribeToEvents({ cargo: 'Cozinheira' }, frame => cookFrames.push(frame));

  publishToRole('Diretor', 'notification', { id: 1 });
  unsubscribeDirector();
  unsubscribeCook();

  assert.deepEqual(directorFrames, ['event: notification\ndata: {"id":1}\n\n']);
  assert.deepEqual(cookFrames, []);
});