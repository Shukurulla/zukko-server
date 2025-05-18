import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  lastname: { type: String, required: true },
  certificateUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Certificate", certificateSchema);
