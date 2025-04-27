import mongoose from "mongoose"

const VerificationTokenSchema = new mongoose.Schema({
  identifier: {
    type: String,
  },
  token: {
    type: String,
    unique: true,
  },
  expires: {
    type: Date,
  },
})

// Compound index to ensure uniqueness of identifier + token
VerificationTokenSchema.index({ identifier: 1, token: 1 }, { unique: true })

export default mongoose.models.VerificationToken || mongoose.model("VerificationToken", VerificationTokenSchema)
