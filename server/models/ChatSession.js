import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['assistant', 'user'], required: true },
    content: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ChatSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    threadId: { type: String, required: true, default: 'default', index: true },
    scope: { type: String, enum: ['coin', 'expert'], required: true, index: true },
    coinId: { type: String, index: true },
    title: { type: String },
    messages: { type: [ChatMessageSchema], default: [] },
  },
  { timestamps: true }
);

ChatSessionSchema.index({ sessionId: 1, scope: 1, coinId: 1, threadId: 1 }, { unique: true });

const ChatSession =
  mongoose.models.ChatSession || mongoose.model('ChatSession', ChatSessionSchema);

export default ChatSession;
