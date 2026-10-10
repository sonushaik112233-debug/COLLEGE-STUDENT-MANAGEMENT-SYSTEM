
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from server/.env");
    }

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "Add ADMIN_EMAIL and ADMIN_PASSWORD to server/.env"
      );
    }

    if (password.length < 12) {
      throw new Error(
        "Admin password must be at least 12 characters."
      );
    }

    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (existingAdmin) {
      console.log("An admin account already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: "admin",
      approved: true,
    });

    console.log("Admin account created successfully.");
    console.log("Admin email:", email);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

createAdmin();
