# Chat Backend Implementation Documentation

## Overview
Complete backend implementation for the real-time chat system using Node.js, Express, MongoDB, and Socket.io. This backend handles all chat-related API endpoints and WebSocket events for the Flutter chat system.

## Architecture

### Database Models

#### Conversation Model (`src/models/Conversation.js`)
- **Purpose**: Represents conversations between customers and providers
- **Fields**:
  - `customerId`: Reference to User (customer)
  - `customerName`: Customer's name (denormalized for performance)
  - `customerProfileImage`: Customer's profile image URL
  - `providerId`: Reference to User (provider)
  - `providerName`: Provider's name (denormalized for performance)
  - `providerProfileImage`: Provider's profile image URL
  - `lastMessage`: Last message content (for preview)
  - `lastMessageTime`: Timestamp of last message
  - `unreadCount`: Number of unread messages
  - `isActive`: Conversation status (soft delete)
- **Indexes**: 
  - Unique composite index on (customerId, providerId)
  - Individual indexes on customerId and providerId
  - Index on updatedAt for sorting

#### Message Model (`src/models/Message.js`)
- **Purpose**: Represents individual messages in conversations
- **Fields**:
  - `conversationId`: Reference to Conversation
  - `senderId`: Reference to User (sender)
  - `senderName`: Sender's name (denormalized)
  - `senderProfileImage`: Sender's profile image URL
  - `content`: Message content
  - `type`: Message type (text, image, system)
  - `status`: Message status (sending, sent, delivered, read, failed)
  - `isRead`: Read status
  - `readBy`: Array of users who read the message with timestamps
- **Indexes**:
  - Composite index on (conversationId, createdAt)
  - Index on senderId
  - Index on status

### API Endpoints

#### GET `/api/chat/conversations/:userId`
- **Purpose**: Get all conversations for a user
- **Authentication**: Required
- **Response**: Array of conversations with unread counts
- **Logic**: 
  - Finds conversations where user is customer or provider
  - Calculates unread count for each conversation
  - Returns sorted by most recent activity

#### GET `/api/chat/messages/:conversationId`
- **Purpose**: Get messages for a conversation
- **Authentication**: Required
- **Query Params**: `limit` (default: 50), `skip` (default: 0)
- **Response**: Array of messages in chronological order
- **Logic**: 
  - Fetches messages with pagination
  - Reverses to show oldest first (for frontend)

#### POST `/api/chat/conversations`
- **Purpose**: Create a new conversation
- **Authentication**: Required
- **Body**: customerId, customerName, customerProfileImage, providerId, providerName, providerProfileImage
- **Response**: Created conversation object
- **Logic**: 
  - Checks if conversation already exists
  - Creates new conversation if not exists
  - Emits socket event to both participants

#### POST `/api/chat/conversations/get-or-create`
- **Purpose**: Get existing conversation or create new one
- **Authentication**: Required
- **Body**: Same as create conversation
- **Response**: Conversation object
- **Logic**: 
  - Uses static method `getOrCreate` for atomic operation
  - Emits socket event to both participants

#### POST `/api/chat/messages`
- **Purpose**: Send message via HTTP (fallback for socket failures)
- **Authentication**: Required
- **Body**: conversationId, senderId, senderName, senderProfileImage, content, type
- **Response**: Created message object
- **Logic**: 
  - Verifies conversation exists and user is participant
  - Creates message with 'sent' status
  - Updates conversation last message and unread count
  - Emits socket events to conversation room and participants

#### PUT `/api/chat/messages/:conversationId/read`
- **Purpose**: Mark messages as read for a user
- **Authentication**: Required
- **Body**: userId
- **Response**: Success message
- **Logic**: 
  - Marks all unread messages as read
  - Updates conversation unread count
  - Emits conversation update to participants

#### DELETE `/api/chat/conversations/:conversationId`
- **Purpose**: Soft delete a conversation
- **Authentication**: Required
- **Body**: userId
- **Response**: Success message
- **Logic**: 
  - Verifies user is participant
  - Sets isActive to false (soft delete)

### Socket Events

#### Client → Server Events

##### `join_room(userId)`
- **Purpose**: Join user's private room for notifications
- **Security**: Only allows joining own room or if not authenticated

##### `join_conversation(conversationId)`
- **Purpose**: Join a conversation room for real-time messaging
- **Security**: Verifies user is participant in conversation
- **Logic**: 
  - Checks conversation exists and user is participant
  - Joins socket room
  - Clears typing indicator for user

##### `leave_conversation(conversationId)`
- **Purpose**: Leave a conversation room
- **Logic**: 
  - Leaves socket room
  - Clears typing indicator for user

##### `send_message(messageData)`
- **Purpose**: Send message via socket (primary method)
- **Body**: conversationId, senderId, senderName, senderProfileImage, content, type
- **Security**: Verifies user authentication and participation
- **Logic**: 
  - Creates message with 'sent' status
  - Updates conversation metadata
  - Emits to conversation room
  - Emits conversation updates to participants
  - Sends confirmation to sender

##### `typing_indicator(data)`
- **Purpose**: Send typing status updates
- **Body**: conversationId, userId, userName, isTyping
- **Security**: Verifies user authentication and participation
- **Logic**: 
  - Broadcasts to conversation room (excluding sender)
  - Includes timestamp for auto-clear logic

#### Server → Client Events

##### `chat_message(message)`
- **Purpose**: New message received
- **Broadcast**: To conversation room
- **Data**: Complete message object

##### `conversation_updated(conversation)`
- **Purpose**: Conversation metadata updated
- **Broadcast**: To both participants' private rooms
- **Data**: Updated conversation object

##### `typing_indicator(data)`
- **Purpose**: User typing status
- **Broadcast**: To conversation room (excluding sender)
- **Data**: conversationId, userId, userName, isTyping, timestamp

##### `message_sent(message)`
- **Purpose**: Message send confirmation
- **Broadcast**: To sender only
- **Data**: Sent message object

##### `message_error(error)`
- **Purpose**: Message send failed
- **Broadcast**: To sender only
- **Data**: Error object

## Security Features

### Authentication
- JWT token verification for all API endpoints
- Socket authentication via handshake auth token
- User verification for all socket events

### Authorization
- Conversation participation verification
- User ID matching for message sending
- Room join security (only own room or conversation rooms)

### Data Validation
- Required field validation in schemas
- Enum validation for message types and status
- Reference validation for foreign keys

## Performance Optimizations

### Database Indexes
- Composite indexes for common query patterns
- Individual indexes for filtering operations
- Sorted indexes for chronological queries

### Caching Strategy
- Denormalized user data in conversations (name, profile image)
- Last message caching in conversation document
- Unread count calculation optimized

### Socket Room Management
- Room-based message broadcasting (efficient targeting)
- User private rooms for personal notifications
- Conversation rooms for message isolation

### Query Optimization
- Lean queries for API responses
- Pagination support for message history
- Efficient unread count calculation

## Error Handling

### API Errors
- 404: Resource not found
- 403: Unauthorized access
- 500: Server errors with detailed logging
- Consistent error response format

### Socket Errors
- Connection error handling
- Event error try-catch blocks
- Error events sent to clients
- Detailed console logging

### Database Errors
- Mongoose validation errors
- Duplicate key handling
- Connection error handling
- Transaction safety

## Testing Considerations

### Unit Tests Needed
- Model methods (getOtherParticipant, isParticipant)
- Static methods (getOrCreate, markConversationAsRead)
- Controller functions
- Socket event handlers

### Integration Tests Needed
- API endpoint testing with authentication
- Socket event flow testing
- Database operation testing
- Real-time message flow testing

### Load Testing Considerations
- Concurrent message sending
- Multiple simultaneous conversations
- Socket connection handling under load
- Database query performance

## Deployment Notes

### Environment Variables
- `PORT`: Server port (default: 5000)
- `JWT_SECRET`: JWT signing secret
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development/production)

### Database Setup
- MongoDB connection via Mongoose
- Automatic index creation on model load
- Connection pooling configured by Mongoose

### Production Considerations
- Use production MongoDB instance
- Enable SSL/TLS for socket connections
- Implement rate limiting
- Add request logging
- Enable CORS for specific domains only
- Use process manager (PM2) for stability

## Monitoring and Logging

### Current Logging
- Socket connection/disconnection events
- Room join/leave events
- Message send events
- Error events with stack traces

### Recommended Monitoring
- Message volume metrics
- Socket connection metrics
- API response times
- Database query performance
- Error rate tracking

## Troubleshooting

### Common Issues

#### Socket Connection Fails
- Check JWT token validity
- Verify Socket.io server is running
- Check CORS configuration
- Verify user authentication

#### Messages Not Sending
- Check conversation exists
- Verify user is participant
- Check socket room membership
- Verify database connection

#### Typing Indicators Not Working
- Check socket room membership
- Verify event listener setup
- Check timestamp logic in frontend
- Verify user authentication

#### Unread Count Incorrect
- Check message read status updates
- Verify conversation update logic
- Check database indexes
- Verify socket event emission

### Debug Tips
- Enable detailed socket logging
- Monitor database queries
- Check network tab in browser
- Verify JWT token expiration
- Test API endpoints separately

## Future Enhancements

### Recommended Features
- Message search functionality
- Message encryption
- File upload handling (images, documents)
- Voice message support
- Message reactions/emoji
- Conversation archiving
- Push notification integration
- Message editing/deletion
- Online status indicators
- Blocked user handling

### Performance Improvements
- Redis caching for frequently accessed data
- Message pagination with cursor-based pagination
- Database read replicas
- Load balancing for socket servers
- CDN integration for file storage

### Security Enhancements
- End-to-end message encryption
- Rate limiting per user
- Content moderation
- Spam detection
- IP-based blocking
- Message expiration

## Conclusion

This backend implementation provides a solid foundation for real-time chat functionality with proper security, performance optimization, and scalability considerations. The system is designed to handle concurrent users and messages efficiently while maintaining data consistency and user privacy.