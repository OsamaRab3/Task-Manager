import mongoose from "mongoose"

const UserActivitySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  tasksCreated: {
    type: Number,
    default: 0,
  },
  tasksCompleted: {
    type: Number,
    default: 0,
  },
  timeSpent: {
    type: Number,
    default: 0,
  },
  pomodorosCompleted: {
    type: Number,
    default: 0,
  },
})

// Compound index to ensure uniqueness of userId + date
UserActivitySchema.index({ userId: 1, date: 1 }, { unique: true })

export default mongoose.models.UserActivity || mongoose.model("UserActivity", UserActivitySchema)
