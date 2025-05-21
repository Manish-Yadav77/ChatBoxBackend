// models/Call.js
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  callType: { type: String, enum: ['incoming', 'outgoing'], required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Call', callSchema);
