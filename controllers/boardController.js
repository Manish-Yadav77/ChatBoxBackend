// controllers/boardController.js
import User from '../Models/UserModel.js';

export const getBoards = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({ data: user.boardData });
  } catch (error) {
    console.error("Get Boards Error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

export const saveBoards = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: "User not found" });

    user.boardData = req.body.data;
    await user.save();

    res.status(200).json({ msg: "Boards saved successfully" });
  } catch (error) {
    console.error("Save Boards Error:", error);
    res.status(500).json({ msg: "Server error" });
  }
};
