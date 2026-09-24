const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  createConversation,
  getOrCreateConversation,
  sendMessage,
  markMessagesAsRead,
  deleteConversation
} = require('../controllers/chatController');

// All chat routes require authentication
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET /api/chat/conversations/:userId
// @desc    Get all conversations for a user
// @access  Private
router.get('/conversations/:userId', authMiddleware, getConversations);

// @route   GET /api/chat/messages/:conversationId
// @desc    Get messages for a conversation
// @access  Private
router.get('/messages/:conversationId', authMiddleware, getMessages);

// @route   POST /api/chat/conversations
// @desc    Create a new conversation
// @access  Private
router.post('/conversations', authMiddleware, createConversation);

// @route   POST /api/chat/conversations/get-or-create
// @desc    Get or create conversation
// @access  Private
router.post('/conversations/get-or-create', authMiddleware, getOrCreateConversation);

// @route   POST /api/chat/messages
// @desc    Send a message via HTTP API (fallback)
// @access  Private
router.post('/messages', authMiddleware, sendMessage);

// @route   PUT /api/chat/messages/:conversationId/read
// @desc    Mark messages as read
// @access  Private
router.put('/messages/:conversationId/read', authMiddleware, markMessagesAsRead);

// @route   DELETE /api/chat/conversations/:conversationId
// @desc    Delete conversation
// @access  Private
router.delete('/conversations/:conversationId', authMiddleware, deleteConversation);

module.exports = router;