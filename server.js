import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./database.js";
import sendMail from "./config/nodemailerConfig.js";
import authenticateToken from "./middleware/auth.js";

import User from "./Models/UserModel.js";
import Call from "./Models/Call.js";
import ChatMessage from "./Models/ChatMessage.js";
import { encrypt } from "./utils/encryption.js";
import { decrypt } from "./utils/encryption.js";

// Initialize
dotenv.config();
const app = express();
connectDB();

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://chatbox3.netlify.app"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://chatbox3.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());

// Generate unique 11-digit virtual number
const generate11DigitNumber = () =>
  Math.floor(10000000000 + Math.random() * 90000000000).toString();

// ================== AUTH ROUTES ================== //

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    let virtualNumber;
    let isUnique = false;
    while (!isUnique) {
      virtualNumber = generate11DigitNumber();
      const existingNumber = await User.findOne({ virtualNumber });
      if (!existingNumber) isUnique = true;
    }

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      virtualNumber,
      role: "user",
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      virtualNumber,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful 🚀",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        virtualNumber: user.virtualNumber,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Account
app.delete("/user/delete", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ================== CALL ROUTES ================== //

// Save a call record
app.post("/calls", async (req, res) => {
  try {
    const { phoneNumber, callType } = req.body;
    if (!phoneNumber || !callType) {
      return res.status(400).json({ message: "Phone number and call type are required" });
    }

    const newCall = new Call({ phoneNumber, callType });
    await newCall.save();
    res.status(201).json({ message: "Call saved successfully", call: newCall });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get call history
app.get("/calls/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const calls = await Call.find({ phoneNumber }).sort({ timestamp: -1 });
    res.json(calls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================== CHAT ROUTES ================== //

// Check user by virtual number
app.get("/users/exists/:virtualNumber", async (req, res) => {
  const { virtualNumber } = req.params;
  const user = await User.findOne({ virtualNumber });
  res.json({ exists: !!user });
});

// Helper: Generate chatId
function getChatId(senderVirtualNumber, receiverVirtualNumber) {
  return [senderVirtualNumber, receiverVirtualNumber].sort().join("_");
}

// POST /send — Save a message to the chat thread
app.post("/send", async (req, res) => {
  const { senderVirtualNumber, receiverVirtualNumber, message } = req.body;

  if (!senderVirtualNumber || !receiverVirtualNumber || !message) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const { encryptedData, iv } = encrypt(message); // your encryption util
  const chatId = getChatId(senderVirtualNumber, receiverVirtualNumber);
  const participants = [senderVirtualNumber, receiverVirtualNumber].sort();

  const newMessage = {
    senderVirtualNumber,
    encryptedMessage: encryptedData,
    iv,
    timestamp: new Date()
  };

  try {
    let chat = await ChatMessage.findOne({ chatId });

    if (!chat) {
      chat = new ChatMessage({
        chatId,
        participants,
        messages: [newMessage],
      });
    } else {
      chat.messages.push(newMessage);
    }

    await chat.save();
    res.status(201).json({ message: "Message saved", chat });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// Get chat thread between two virtual numbers
app.get("/chats/:sender/:receiver", async (req, res) => {
  const { sender, receiver } = req.params;
  const chatId = getChatId(sender, receiver);

  try {
    const chat = await ChatMessage.findOne({ chatId });
    if (!chat) {
      return res.status(404).json({ message: "No chat found" });
    }

    const decryptedMessages = chat.messages.map(msg => ({
      senderVirtualNumber: msg.senderVirtualNumber,
      message: decrypt(msg.encryptedMessage, msg.iv),
      timestamp: msg.timestamp
    }));

    res.json({ chat: { ...chat.toObject(), messages: decryptedMessages } });
  } catch (error) {
    console.error("Error fetching chat thread:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all chat threads for a user (either as sender or receiver)
app.get("/chats/user/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const chats = await ChatMessage.find({
      participants: phoneNumber
    }).sort({ updatedAt: -1 });

    res.json({ chats });
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// get chat history but only the number and name
app.get('/users/chats', async (req, res) => {
  const currentUser = req.query.number;
  if (!currentUser) {
    return res.status(400).json({ error: 'Missing user number' });
  }

  try {
    const chats = await ChatMessage.find({
      participants: currentUser
    });

    const userList = chats.map(chat => {
      const otherNumber = chat.participants.find(p => p !== currentUser);

      let name = null;

      if (
        chat.savedNames &&
        typeof chat.savedNames === 'object' &&
        chat.savedNames.get
      ) {
        name = chat.savedNames.get(currentUser);
      } else if (chat.savedNames && chat.savedNames[currentUser]) {
        name = chat.savedNames[currentUser];
      }

      return {
        number: otherNumber,
        name: name || otherNumber
      };
    });

    res.json(userList);
  } catch (err) {
    console.error('Error fetching user chats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ================== Personal or All data API ================== //

// Get logged-in user's data
app.get("/me", authenticateToken, async (req, res) => {
  try {    
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get all users (Admin access only)
app.get("/users", authenticateToken, async (req, res) => {
  if (req.user.role !== "Admin")
    return res.status(403).json({ message: "Access denied" });
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// =============== SOCKET.IO ==================== //
io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  socket.on("send-message", async (data) => {
    const { senderVirtualNumber, receiverVirtualNumber, message } = data;

    if (!senderVirtualNumber || !receiverVirtualNumber || !message) {
      return;
    }

    // Encrypt message before saving
    const { encryptedData, iv } = encrypt(message);

    const chatId = getChatId(senderVirtualNumber, receiverVirtualNumber);

    try {
      let chat = await ChatMessage.findOne({ chatId });

      const newMsg = {
        senderVirtualNumber,
        encryptedMessage: encryptedData,
        iv,
        timestamp: new Date()
      };

      if (!chat) {
        chat = new ChatMessage({
          chatId,
          participants: [senderVirtualNumber, receiverVirtualNumber].sort(),
          messages: [newMsg],
        });
      } else {
        chat.messages.push(newMsg);
      }

      await chat.save();

      // Broadcast decrypted message to the room (both participants)
      io.to(chatId).emit("receive-message", {
        senderVirtualNumber,
        message,
        timestamp: newMsg.timestamp,
      });
    } catch (err) {
      console.error("Socket save message error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

// =============== SERVER START ================== //
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
