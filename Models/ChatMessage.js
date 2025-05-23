// models/ChatMessage.js
const mongoose = require("mongoose");

// Sub-schema for individual messages
const messageSchema = new mongoose.Schema(
  {
    senderVirtualNumber: { type: String, required: true },
    encryptedMessage: { type: String, required: true },
    iv: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);


// Main schema for the conversation thread
const chatMessageSchema = new mongoose.Schema(
  {
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

// Ensure only one document per participant pair
chatMessageSchema.index({ participants: 1 }, { unique: true });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
