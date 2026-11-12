import { randomBytes } from 'node:crypto';

const TICKET_TTL_MS = 30_000;
const tickets = new Map();
const subscribers = new Set();

export function issueSseTicket(user) {
  for (const [existingTicket, entry] of tickets) {
    if (entry.expiresAt < Date.now()) tickets.delete(existingTicket);
  }
  const ticket = randomBytes(32).toString('hex');
  tickets.set(ticket, { user, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

export function consumeSseTicket(ticket) {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.user;
}

export function subscribeToEvents(user, write) {
  const subscriber = { id: user.id == null ? null : Number(user.id), name: [user.nome, user.sobrenome].filter(Boolean).join(' '), role: user.cargo, write };
  const wasOnline = [...subscribers].some(existing => existing.id === subscriber.id);
  subscribers.add(subscriber);
  if (!wasOnline) publishPresence();
  return () => {
    subscribers.delete(subscriber);
    if (![...subscribers].some(existing => existing.id === subscriber.id)) publishPresence();
  };
}

export function publishToRole(role, eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const subscriber of subscribers) {
    if (subscriber.role !== role) continue;
    try { subscriber.write(frame); }
    catch { subscribers.delete(subscriber); }
  }
}

export function publishToUser(userId, eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const subscriber of subscribers) {
    if (subscriber.id !== Number(userId)) continue;
    try { subscriber.write(frame); }
    catch { subscribers.delete(subscriber); }
  }
}

export function getOnlineUsers() {
  const users = new Map();
  for (const subscriber of subscribers) {
    if (!users.has(subscriber.id)) {
      users.set(subscriber.id, { id: subscriber.id, nome: subscriber.name, cargo: subscriber.role, online: true });
    }
  }
  return [...users.values()];
}

function publishPresence() {
  const event = { users: getOnlineUsers() };
  for (const subscriber of subscribers) {
    try { subscriber.write(`event: presence\ndata: ${JSON.stringify(event)}\n\n`); }
    catch { subscribers.delete(subscriber); }
  }
}