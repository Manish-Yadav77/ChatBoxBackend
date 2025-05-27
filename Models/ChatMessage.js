const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderVirtualNumber: { type: String, required: true },
    encryptedMessage: { type: String, required: true },
    iv: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    chatId: { type: String, unique: true, required: true },
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length === 2,
        message: "A chat must have exactly 2 participants"
      }
    },
    savedNames: {
      type: Map,
      of: String,
      default: {}
    },
    messages: {
      type: [messageSchema],
      default: []
    }
  },
  { timestamps: true }
);

// ✅ Only index on chatId, NOT participants
chatMessageSchema.index({ chatId: 1 }, { unique: true });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
