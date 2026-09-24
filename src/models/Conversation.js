const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerProfileImage: {
    type: String,
    default: ''
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerName: {
    type: String,
    required: true
  },
  providerProfileImage: {
    type: String,
    default: ''
  },
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageTime: {
    type: Date,
    default: null
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
conversationSchema.index({ customerId: 1, providerId: 1 }, { unique: true });
conversationSchema.index({ customerId: 1 });
conversationSchema.index({ providerId: 1 });
conversationSchema.index({ updatedAt: -1 });

// Method to get other participant details
conversationSchema.methods.getOtherParticipant = function(userId) {
  if (this.customerId.toString() === userId.toString()) {
    return {
      id: this.providerId,
      name: this.providerName,
      profileImage: this.providerProfileImage
    };
  } else {
    return {
      id: this.customerId,
      name: this.customerName,
      profileImage: this.customerProfileImage
    };
  }
};

// Method to check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.customerId.toString() === userId.toString() || 
         this.providerId.toString() === userId.toString();
};

// Static method to get or create conversation
conversationSchema.statics.getOrCreate = async function(customerId, providerId, customerData, providerData) {
  let conversation = await this.findOne({
    customerId,
    providerId
  });

  if (!conversation) {
    conversation = await this.create({
      customerId,
      customerName: customerData.name,
      customerProfileImage: customerData.profileImage || '',
      providerId,
      providerName: providerData.name,
      providerProfileImage: providerData.profileImage || ''
    });
  }

  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);