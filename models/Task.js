import mongoose from "mongoose"

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please provide a title for this task"],
    maxlength: [100, "Title cannot be more than 100 characters"],
  },
  completed: {
    type: Boolean,
    default: false,
  },
  timeSpent: {
    type: Number,
    default: 0,
  },
  expectedTime: {
    type: Number,
    default: 0,
  },
  dependencies: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
  ],
  pomodoroCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  userId: {
    type: String,
    required: true,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: Number,
    default: 0, // 0: normal, 1: medium, 2: high
  },
  lastCompletedDate: {
    type: Date,
    default: null,
  },
  recurringType: {
    type: String,
    enum: ["daily", "weekly", "monthly"],
    default: "daily",
  },
})

export default mongoose.models.Task || mongoose.model("Task", TaskSchema)
