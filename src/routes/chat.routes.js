const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// All routes protected
router.use(requireAuth);

// POST /api/v1/chat/conversations - Create or Get conversation
router.post('/conversations', ChatController.createOrGetConversation);

// GET /api/v1/chat/conversations - Get all conversations for user
router.get('/conversations', ChatController.getConversations);

// GET /api/v1/chat/unread - Get total unread count
router.get('/unread', ChatController.getUnreadCount);

// GET /api/v1/chat/conversations/:id/messages - Get messages
router.get('/conversations/:id/messages', ChatController.getMessages);

// POST /api/v1/chat/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', ChatController.sendMessage);

// POST /api/v1/chat/conversations/:id/read - Mark messages as read
router.post('/conversations/:id/read', ChatController.markAsRead);

module.exports = router;
