const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get all conversations for a user
// @route   GET /api/chat/conversations/:userId
// @access  Private
const getConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all conversations where user is either customer or provider
    const conversations = await Conversation.find({
      $or: [
        { customerId: userId },
        { providerId: userId }
      ],
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .lean();

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userId },
          isRead: false
        });

        return {
          ...conv,
          unreadCount
        };
      })
    );

    res.json(conversationsWithUnread);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/messages/:conversationId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await Message.getConversationMessages(
      conversationId,
      parseInt(limit),
      parseInt(skip)
    );

    // Reverse to show oldest first (frontend expects chronological order)
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};

// @desc    Create a new conversation
// @route   POST /api/chat/conversations
// @access  Private
const createConversation = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerProfileImage,
      providerId,
      providerName,
      providerProfileImage
    } = req.body;

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      customerId,
      providerId
    });

    if (conversation) {
      return res.json(conversation);
    }

    // Create new conversation
    conversation = await Conversation.create({
      customerId,
      customerName,
      customerProfileImage: customerProfileImage || '',
      providerId,
      providerName,
      providerProfileImage: providerProfileImage || ''
    });

    // Emit socket event for conversation creation
    const io = req.app.get('io');
    if (io) {
      io.to(customerId.toString()).emit('conversation_updated', conversation);
      io.to(providerId.toString()).emit('conversation_updated', conversation);
    }

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Error creating conversation', error: error.message });
  }
};

// @desc    Get or create conversation
// @route   POST /api/chat/conversations/get-or-create
// @access  Private
const getOrCreateConversation = async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerProfileImage,
      providerId,
      providerName,
      providerProfileImage
    } = req.body;

    // Get or create conversation
    const conversation = await Conversation.getOrCreate(
      customerId,
      providerId,
      { name: customerName, profileImage: customerProfileImage },
      { name: providerName, profileImage: providerProfileImage }
    );

    // Emit socket event for conversation update
    const io = req.app.get('io');
    if (io) {
      io.to(customerId.toString()).emit('conversation_updated', conversation);
      io.to(providerId.toString()).emit('conversation_updated', conversation);
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error getting or creating conversation:', error);
    res.status(500).json({ message: 'Error getting or creating conversation', error: error.message });
  }
};

// @desc    Send a message via HTTP API (fallback)
// @route   POST /api/chat/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      senderId,
      senderName,
      senderProfileImage,
      content,
      type = 'text'
    } = req.body;

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.isParticipant(senderId)) {
      return res.status(403).json({ message: 'Not authorized to send message in this conversation' });
    }

    // Create message
    const message = await Message.create({
      conversationId,
      senderId,
      senderName,
      senderProfileImage: senderProfileImage || '',
      content,
      type,
      status: 'sent'
    });

    // Update conversation last message
    conversation.lastMessage = content;
    conversation.lastMessageTime = message.createdAt;
    
    // Increment unread count for recipient
    const recipientId = conversation.customerId.toString() === senderId.toString() 
      ? conversation.providerId 
      : conversation.customerId;
    
    conversation.unreadCount = await Message.countDocuments({
      conversationId,
      senderId: { $ne: recipientId },
      isRead: false
    });

    await conversation.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Emit to conversation room
      io.to(conversationId.toString()).emit('chat_message', message);
      
      // Emit conversation update to both participants
      io.to(conversation.customerId.toString()).emit('conversation_updated', conversation);
      io.to(conversation.providerId.toString()).emit('conversation_updated', conversation);
      
      // Emit message sent confirmation
      io.emit('message_sent', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/chat/messages/:conversationId/read
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    // Mark all messages as read
    await Message.markConversationAsRead(conversationId, userId);

    // Update conversation unread count
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      conversation.unreadCount = await Message.countDocuments({
        conversationId,
        senderId: { $ne: userId },
        isRead: false
      });
      await conversation.save();

      // Emit conversation update
      const io = req.app.get('io');
      if (io) {
        io.to(conversation.customerId.toString()).emit('conversation_updated', conversation);
        io.to(conversation.providerId.toString()).emit('conversation_updated', conversation);
      }
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Error marking messages as read', error: error.message });
  }
};

// @desc    Delete conversation
// @route   DELETE /api/chat/conversations/:conversationId
// @access  Private
const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({ message: 'Not authorized to delete this conversation' });
    }

    // Soft delete - mark as inactive
    conversation.isActive = false;
    await conversation.save();

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Error deleting conversation', error: error.message });
  }
};

module.exports = {
  getConversations,
  getMessages,
  createConversation,
  getOrCreateConversation,
  sendMessage,
  markMessagesAsRead,
  deleteConversation
};