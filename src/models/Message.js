const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderProfileImage: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'system'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ status: 1 });

// Method to mark message as read by user
messageSchema.methods.markAsReadBy = function(userId) {
  if (!this.isRead) {
    const alreadyRead = this.readBy.some(
      read => read.userId.toString() === userId.toString()
    );
    
    if (!alreadyRead && this.senderId.toString() !== userId.toString()) {
      this.readBy.push({ userId, readAt: new Date() });
      this.isRead = true;
      this.status = 'read';
    }
  }
  return this.save();
};

// Static method to get messages for conversation
messageSchema.statics.getConversationMessages = async function(conversationId, limit = 50, skip = 0) {
  return this.find({ conversationId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to mark all messages as read for user in conversation
messageSchema.statics.markConversationAsRead = async function(conversationId, userId) {
  return this.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      isRead: false
    },
    {
      $set: { isRead: true, status: 'read' },
      $push: {
        readBy: { userId, readAt: new Date() }
      }
    }
  );
};

// Static method to get unread count for user
messageSchema.statics.getUnreadCount = async function(userId) {
  const conversations = await mongoose.model('Conversation').find({
    $or: [{ customerId: userId }, { providerId: userId }]
  }).select('_id');

  const conversationIds = conversations.map(c => c._id);

  return this.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: userId },
    isRead: false
  });
};

module.exports = mongoose.model('Message', messageSchema);