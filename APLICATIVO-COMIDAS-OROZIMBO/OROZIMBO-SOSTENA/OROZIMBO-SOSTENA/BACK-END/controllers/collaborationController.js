import {
  createMessage,
  createNotification,
  deleteMessageForEveryone,
  getChatContact,
  getConversationMessages,
  getMessageById,
  getNotifications,
  hideMessageForUser,
  listChatContacts,
  markAllNotificationsRead,
} from '../models/collaborationModel.js';
import { consumeSseTicket, getOnlineUsers, issueSseTicket, publishToRole, publishToUser, subscribeToEvents } from '../services/realtimeHub.js';

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
  const contactId = Number(req.query.contactId);
  if (!Number.isSafeInteger(contactId) || contactId < 1 || contactId === req.user.id) {
    return res.status(400).json({ error: 'Selecione um contato válido.' });
  }
  try {
    const contact = await getChatContact(req.user.id, contactId);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });
    res.json(await getConversationMessages(req.user.id, contactId));
  } catch (error) { next(error); }
}

export async function sendMessageController(req, res, next) {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const recipientUserId = Number(req.body.recipientUserId);
  const replyToMessageId = req.body.replyToMessageId ? Number(req.body.replyToMessageId) : null;
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: 'A mensagem deve ter entre 1 e 2000 caracteres.' });
  }
  if (!Number.isSafeInteger(recipientUserId) || recipientUserId < 1 || recipientUserId === req.user.id) {
    return res.status(400).json({ error: 'Selecione um contato válido.' });
  }

  try {
    const contact = await getChatContact(req.user.id, recipientUserId);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });
    if (replyToMessageId) {
      const repliedMessage = await getMessageById(replyToMessageId);
      const belongsToConversation = repliedMessage && (
        (repliedMessage.sender_user_id === req.user.id && repliedMessage.recipient_user_id === recipientUserId)
        || (repliedMessage.sender_user_id === recipientUserId && repliedMessage.recipient_user_id === req.user.id)
      );
      if (!belongsToConversation || repliedMessage.deleted_for_all_at) {
        return res.status(400).json({ error: 'A mensagem respondida não pertence a esta conversa.' });
      }
    }
    const message = await createMessage({
      senderUserId: req.user.id,
      senderName: actorName(req.user) || 'Direção',
      recipientUserId,
      recipientRole: contact.cargo,
      body,
      replyToMessageId,
    });
    publishToUser(recipientUserId, 'message', { ...message, is_mine: false });
    publishToUser(req.user.id, 'message', { ...message, is_mine: true });
    res.status(201).json(message);
  } catch (error) { next(error); }
}

export async function listChatContactsController(req, res, next) {
  try {
    const contacts = await listChatContacts(req.user.id);
    const onlineIds = new Set(getOnlineUsers().map(user => Number(user.id)));
    res.json(contacts.map(contact => ({
      id: contact.id,
      nome: contact.nome,
      sobrenome: contact.sobrenome,
      cargo: contact.cargo,
      online: onlineIds.has(Number(contact.id)),
    })));
  } catch (error) { next(error); }
}

export async function deleteMessageController(req, res, next) {
  const messageId = Number(req.params.id);
  if (!Number.isSafeInteger(messageId) || messageId < 1) return res.status(400).json({ error: 'Mensagem inválida.' });
  const deleteForEveryone = req.query.scope === 'everyone';

  try {
    const message = await getMessageById(messageId);
    if (!message || message.deleted_for_all_at) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    const isParticipant = message.sender_user_id === req.user.id || message.recipient_user_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Você não participa desta conversa.' });

    if (deleteForEveryone) {
      if (message.sender_user_id !== req.user.id) return res.status(403).json({ error: 'Só quem enviou pode apagar para todos.' });
      const deleted = await deleteMessageForEveryone(messageId, req.user.id);
      if (!deleted) return res.status(404).json({ error: 'Mensagem não encontrada.' });
      const event = { id: messageId, deletedForEveryone: true };
      publishToUser(deleted.sender_user_id, 'message_deleted', event);
      publishToUser(deleted.recipient_user_id, 'message_deleted', event);
    } else {
      await hideMessageForUser(messageId, req.user.id);
      publishToUser(req.user.id, 'message_deleted', { id: messageId, deletedForEveryone: false });
    }
    res.json({ message: 'Mensagem apagada.' });
  } catch (error) { next(error); }
}

export async function forwardMessageController(req, res, next) {
  const messageId = Number(req.params.id);
  const recipientUserId = Number(req.body.recipientUserId);
  if (!Number.isSafeInteger(messageId) || messageId < 1 || !Number.isSafeInteger(recipientUserId) || recipientUserId < 1 || recipientUserId === req.user.id) {
    return res.status(400).json({ error: 'Mensagem ou contato inválido.' });
  }

  try {
    const source = await getMessageById(messageId);
    if (!source || source.deleted_for_all_at) return res.status(404).json({ error: 'Mensagem não encontrada.' });
    if (source.sender_user_id !== req.user.id && source.recipient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Você não pode compartilhar esta mensagem.' });
    }
    const contact = await getChatContact(req.user.id, recipientUserId);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado.' });
    const forwarded = await createMessage({
      senderUserId: req.user.id,
      senderName: actorName(req.user) || 'Usuário',
      recipientUserId,
      recipientRole: contact.cargo,
      body: source.body,
      forwardedFromId: source.id,
    });
    publishToUser(recipientUserId, 'message', { ...forwarded, is_mine: false });
    publishToUser(req.user.id, 'message', { ...forwarded, is_mine: true });
    res.status(201).json(forwarded);
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