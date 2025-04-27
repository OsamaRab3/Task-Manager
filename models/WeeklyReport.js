import mongoose from "mongoose"

const WeeklyReportSchema = new mongoose.Schema({
  weekStart: {
    type: Date,
    required: true,
  },
  tasksCompleted: {
    type: Number,
    default: 0,
  },
  totalTimeSpent: {
    type: Number,
    default: 0,
  },
  expectedVsActual: {
    type: Number,
    default: 1,
  },
  pomodoroCount: {
    type: Number,
    default: 0,
  },
  userId: {
    type: String,
    required: true,
  },
})

// Compound index to ensure uniqueness of weekStart per user
WeeklyReportSchema.index({ weekStart: 1, userId: 1 }, { unique: true })

export default mongoose.models.WeeklyReport || mongoose.model("WeeklyReport", WeeklyReportSchema)
