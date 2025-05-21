import User from '../Models/UserModel';

export const addTask = async (req, res) => {
  const { id, title, description, columnId } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    user.tasks.push({ id, title, description, columnId });
    await user.save();
    res.status(201).json({ message: "Task added" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, columnId } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    const task = user.tasks.find(t => t.id === id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (title) task.title = title;
    if (description) task.description = description;
    if (columnId) task.columnId = columnId;

    await user.save();
    res.json({ message: "Task updated", task });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    user.tasks = user.tasks.filter(task => task._id.toString() !== req.params.taskId);
    await user.save();
    res.status(200).json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getTasks = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.status(200).json(user.tasks);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
