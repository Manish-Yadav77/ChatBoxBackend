import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import connectDB from "./database.js";
import sendMail from "./config/nodemailerConfig.js";
import authenticateToken from "./middleware/auth.js";

import User from "./Models/UserModel.js";
import Call from "./Models/Call.js";
import ChatMessage from "./Models/ChatMessage.js";

// Initialize
dotenv.config();
const app = express();
connectDB();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://tasks-managerr.netlify.app"],
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

// POST /send — Save a message to the chat thread
app.post("/send", async (req, res) => {
  const { senderVirtualNumber, receiverVirtualNumber, message } = req.body;

  if (!senderVirtualNumber || !receiverVirtualNumber || !message) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const participants = [senderVirtualNumber, receiverVirtualNumber].sort(); // Ensure consistent order
  const newMessage = {
    senderVirtualNumber,
    message,
    timestamp: new Date()
  };

  try {
    let chat = await ChatMessage.findOne({ participants });

    if (!chat) {
      // Create a new chat thread
      chat = new ChatMessage({
        participants,
        messages: [newMessage]
      });
    } else {
      // Append to existing messages
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
  const participants = [sender, receiver].sort(); // Ensure consistent ordering

  try {
    const chat = await ChatMessage.findOne({ participants });

    if (!chat) {
      return res.status(404).json({ message: "No chat found between these numbers" });
    }

    res.json({ chat });
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
    }).sort({ updatedAt: -1 }); // most recent chats first

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

      // Since savedNames is a Map<String, String> like { "32028736061": "Testing" },
      // it means currentUser has saved a name for otherNumber under THEIR OWN number
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
    console.error('Error fetching chat users:', err);
    res.status(500).json({ error: 'Backend server error while getting chat users' });
  }
});

// update or save the name for every user...
app.post('/users/save-name', async (req, res) => {
  const { currentUser, targetNumber, name } = req.body;

  if (!currentUser || !targetNumber || !name) {
    return res.status(400).json({ error: 'Missing fields in request' });
  }

  try {
    const chat = await ChatMessage.findOneAndUpdate(
      {
        participants: { $all: [currentUser, targetNumber] }
      },
      {
        $set: { [`savedNames.${currentUser}`]: name }
      },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found between the users' });
    }

    res.status(200).json({ message: 'Name saved successfully.', chat });
  } catch (err) {
    console.error('Error saving name:', err);
    res.status(500).json({ error: 'Failed to save name' });
  }
});

// ================== KYC ROUTES ================== //

// In-memory OTP store
const otpStore = new Map();

// Send OTP
app.post("/send-otp", async (req, res) => {
  const { email, phone } = req.body;

  if (!email || !phone || phone.length !== 10) {
    return res.status(400).json({ message: "Invalid email or phone" });
  }

  const user = await User.findOne({ email, phone });
  if (!user) {
    return res.status(400).json({ message: "Email and phone do not match any user" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, otp);

  const subject = "Your OTP for KYC Verification";
  const text = `Your OTP is ${otp}. It is valid for 10 minutes.`;
  const html = `<p>Your OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`;

  try {
    await sendMail(email, subject, text, html);
    res.json({ message: "OTP sent" });
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const savedOtp = otpStore.get(email);
  if (!savedOtp || savedOtp !== otp) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  try {
    otpStore.delete(email);
    const updatedUser = await User.findOneAndUpdate({ email }, { kycVerified: true }, { new: true });

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({ verified: true, message: "KYC Verified Successfully" });
  } catch (error) {
    console.error("Error updating KYC status:", error);
    res.status(500).json({ message: "Server error" });
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




// ================== START SERVER ================== //

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
