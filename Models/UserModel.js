import mongoose from "mongoose";

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
    virtualNumber:{ type: String, unique: true },
    role: {
      type: String,
      enum: ["user", "Admin"],
      default: "user",
    },
    kycVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
