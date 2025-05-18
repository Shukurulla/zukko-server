import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    school: {
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
      type: Array,
      default: [],
    },
    role: {
      type: String,
      default: "student",
    },
    certificate: {
      id: {
        type: String,
      },
      issueDate: {
        type: Date,
      },
      filename: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

const studentModel = mongoose.model("student", studentSchema);

export default studentModel;
