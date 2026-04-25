import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listMessagesController,
  listMyConversationsController,
  sendMessageController,
  startConversationController
} from '../controllers/messages.controller.js';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.post('/conversations', startConversationController);
messagesRouter.get('/conversations', listMyConversationsController);
messagesRouter.get('/conversations/:conversationId/messages', listMessagesController);
messagesRouter.post('/conversations/:conversationId/messages', sendMessageController);
