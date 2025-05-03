import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    workplace: {
      type: String,
      required: true,
    },
    rank: {
      type: String,
      required: true,
    },
    login: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    complateLessons: {
      type: Object,
      default: [],
    },
    role: {
      type: String,
      default: "teacher",
    },
  },
  {
    timestamps: true,
  }
);

const teacherModel = mongoose.model("teacher", teacherSchema);

export default teacherModel;
