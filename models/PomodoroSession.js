import mongoose from "mongoose"

const PomodoroSessionSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    default: null,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  duration: {
    type: Number,
    required: [true, "Please provide a duration for this session"],
  },
  userId: {
    type: String,
    required: true,
  },
})

export default mongoose.models.PomodoroSession || mongoose.model("PomodoroSession", PomodoroSessionSchema)
