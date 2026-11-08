import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateSession, requireRole } from '../middlewares/authenticateSession.js';
import { signToken } from '../services/authService.js';

function responseSpy() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('protected request rejects missing bearer token', () => {
  const response = responseSpy();
  let continued = false;
  authenticateSession({ get: () => '' }, response, () => { continued = true; });

  assert.equal(response.statusCode, 401);
  assert.equal(continued, false);
});

test('valid signed session carries user role into request', () => {
  const user = { id: 8, cargo: 'Diretor', nome: 'Diretora', cpf: '00000000000' };
  const token = signToken(user);
  const request = { get: () => `Bearer ${token}` };
  let continued = false;

  authenticateSession(request, responseSpy(), () => { continued = true; });

  assert.equal(continued, true);
  assert.equal(request.user.id, user.id);
  assert.equal(request.user.cargo, 'Diretor');
});

test('role guard denies cooks from director-only actions', () => {
  const response = responseSpy();
  let continued = false;
  requireRole('Diretor')({ user: { cargo: 'Cozinheira' } }, response, () => { continued = true; });

  assert.equal(response.statusCode, 403);
  assert.equal(continued, false);
});