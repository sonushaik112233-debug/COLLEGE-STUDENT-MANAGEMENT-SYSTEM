
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "student";
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "student"],
      required: true,
      default: "student",
    },
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
