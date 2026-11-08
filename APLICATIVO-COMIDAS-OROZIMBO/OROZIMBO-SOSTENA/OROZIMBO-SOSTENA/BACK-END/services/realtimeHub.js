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
  const subscriber = { role: user.cargo, write };
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function publishToRole(role, eventName, payload) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const subscriber of subscribers) {
    if (subscriber.role !== role) continue;
    try { subscriber.write(frame); }
    catch { subscribers.delete(subscriber); }
  }
}