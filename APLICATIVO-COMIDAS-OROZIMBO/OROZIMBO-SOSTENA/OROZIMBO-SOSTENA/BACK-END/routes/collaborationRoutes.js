import { Router } from 'express';
import {
  createSseTicketController,
  eventStreamController,
  listMessagesController,
  listNotificationsController,
  markNotificationsReadController,
  sendMessageController,
} from '../controllers/collaborationController.js';
import { authenticateSession, requireRole } from '../middlewares/authenticateSession.js';

const router = Router();

router.get('/events/ticket', authenticateSession, createSseTicketController);
router.get('/events', eventStreamController);
router.get('/notifications', authenticateSession, requireRole('Diretor'), listNotificationsController);
router.post('/notifications/read-all', authenticateSession, requireRole('Diretor'), markNotificationsReadController);
router.get('/messages', authenticateSession, requireRole('Diretor', 'Cozinheira'), listMessagesController);
router.post('/messages', authenticateSession, requireRole('Diretor'), sendMessageController);

export default router;