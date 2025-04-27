import mongoose from "mongoose"

const SessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  expires: {
    type: Date,
  },
  sessionToken: {
    type: String,
    unique: true,
  },
})

export default mongoose.models.Session || mongoose.model("Session", SessionSchema)
