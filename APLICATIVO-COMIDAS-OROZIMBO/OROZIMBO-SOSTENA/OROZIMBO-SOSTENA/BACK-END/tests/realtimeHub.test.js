import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSseTicket, issueSseTicket, publishToRole, publishToUser, subscribeToEvents } from '../services/realtimeHub.js';

test('SSE ticket is temporary and can only be consumed once', () => {
  const user = { id: 7, cargo: 'Diretor' };
  const ticket = issueSseTicket(user);

  assert.equal(consumeSseTicket(ticket), user);
  assert.equal(consumeSseTicket(ticket), null);
});

test('SSE events are delivered only to subscribers of the target role', () => {
  const directorFrames = [];
  const cookFrames = [];
  const unsubscribeDirector = subscribeToEvents({ id: 1, cargo: 'Diretor', nome: 'Diretor' }, frame => directorFrames.push(frame));
  const unsubscribeCook = subscribeToEvents({ id: 2, cargo: 'Cozinheira', nome: 'Cozinheira' }, frame => cookFrames.push(frame));

  publishToRole('Diretor', 'notification', { id: 1 });
  unsubscribeDirector();
  unsubscribeCook();

  assert.ok(directorFrames.includes('event: notification\ndata: {"id":1}\n\n'));
  assert.equal(cookFrames.some(frame => frame.includes('event: notification')), false);
});

test('SSE presence lists distinct connected users and direct events reach only their user', () => {
  const directorFrames = [];
  const cookFrames = [];
  const extraCookFrames = [];
  const unsubscribeDirector = subscribeToEvents({ id: 11, cargo: 'Diretor', nome: 'Diretora' }, frame => directorFrames.push(frame));
  const unsubscribeCook = subscribeToEvents({ id: 12, cargo: 'Cozinheira', nome: 'Cozinheira A' }, frame => cookFrames.push(frame));
  const unsubscribeExtraCook = subscribeToEvents({ id: 13, cargo: 'Cozinheira', nome: 'Cozinheira B' }, frame => extraCookFrames.push(frame));

  publishToUser(12, 'message', { id: 90 });
  unsubscribeExtraCook();
  unsubscribeCook();
  unsubscribeDirector();

  assert.ok(directorFrames.some(frame => frame.includes('event: presence') && frame.includes('"id":13')));
  assert.ok(cookFrames.some(frame => frame === 'event: message\ndata: {"id":90}\n\n'));
  assert.equal(extraCookFrames.some(frame => frame.includes('"id":90')), false);
});