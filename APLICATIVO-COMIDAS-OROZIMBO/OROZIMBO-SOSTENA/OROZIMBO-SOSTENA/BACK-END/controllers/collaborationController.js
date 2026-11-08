import {
  createMessage,
  createNotification,
  getMessages,
  getNotifications,
  markAllNotificationsRead,
} from '../models/collaborationModel.js';
import { consumeSseTicket, issueSseTicket, subscribeToEvents, publishToRole } from '../services/realtimeHub.js';

const actorName = user => [user.nome, user.sobrenome].filter(Boolean).join(' ');

export async function createBaixaNotification(user, prato, periodo, items) {
  const name = actorName(user) || 'Cozinheira';
  const notification = await createNotification({
    actorUserId: user.id,
    actorName: name,
    eventType: 'baixa',
    message: `${name} registrou a refeição "${prato}".`,
    metadata: { prato, periodo, itemCount: items.length },
  });
  publishToRole('Diretor', 'notification', notification);
  return notification;
}

export async function listNotificationsController(req, res, next) {
  try { res.json(await getNotifications()); } catch (error) { next(error); }
}

export async function markNotificationsReadController(req, res, next) {
  try {
    await markAllNotificationsRead();
    res.json({ message: 'Notificações marcadas como lidas.' });
  } catch (error) { next(error); }
}

export async function listMessagesController(req, res, next) {
  try { res.json(await getMessages()); } catch (error) { next(error); }
}

export async function sendMessageController(req, res, next) {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: 'A mensagem deve ter entre 1 e 2000 caracteres.' });
  }

  try {
    const message = await createMessage({
      senderUserId: req.user.id,
      senderName: actorName(req.user) || 'Direção',
      body,
    });
    publishToRole('Cozinheira', 'message', message);
    res.status(201).json(message);
  } catch (error) { next(error); }
}

export function createSseTicketController(req, res) {
  res.json({ ticket: issueSseTicket(req.user) });
}

export function eventStreamController(req, res) {
  const user = consumeSseTicket(req.query.ticket);
  if (!user) return res.status(401).json({ error: 'Conexão em tempo real inválida. Tente novamente.' });

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const unsubscribe = subscribeToEvents(user, frame => res.write(frame));
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}