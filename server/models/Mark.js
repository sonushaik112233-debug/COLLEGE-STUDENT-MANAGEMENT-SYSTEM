
const mongoose = require("mongoose");

const markSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    assignment1: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    assignment2: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    mid1: {
      type: Number,
      default: 0,
      min: 0,
      max: 30,
    },
    mid2: {
      type: Number,
      default: 0,
      min: 0,
      max: 30,
    },
    attendancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    seeMarks: {
      type: Number,
      default: 0,
      min: 0,
      max: 60,
    },
  },
  { timestamps: true }
);

markSchema.index(
  { studentId: 1, subjectId: 1, semester: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.Mark || mongoose.model("Mark", markSchema);
