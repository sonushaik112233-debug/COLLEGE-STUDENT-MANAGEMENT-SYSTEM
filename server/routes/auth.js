const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// STUDENT REGISTRATION
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const studentCount = await User.countDocuments({
      role: "student",
    });

    const registrationNumber =
      `STU${String(studentCount + 1).padStart(5, "0")}`;

    const hashedPassword = await bcrypt.hash(password, 12);

    const student = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "student",
      registrationNumber,
      approved: false,
    });

    return res.status(201).json({
      message: "Registration submitted. Await admin approval.",
      registrationNumber: student.registrationNumber,
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Registration failed",
    });
  }
});

// ADMIN AND STUDENT LOGIN
router.post("/login", async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password || !role) {
      return res.status(400).json({
        message: "Identifier, password and role are required",
      });
    }

    if (!["admin", "student"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    const query =
      role === "admin"
        ? {
            email: normalizedIdentifier,
            role: "admin",
          }
        : {
            role: "student",
            $or: [
              { email: normalizedIdentifier },
              {
                registrationNumber:
                  identifier.trim().toUpperCase(),
              },
            ],
          };

    const user = await User.findOne(query);

    if (!user) {
      return res.status(401).json({
        message: "Invalid login credentials",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid login credentials",
      });
    }

    if (user.role === "student" && !user.approved) {
      return res.status(403).json({
        message: "Your account is awaiting admin approval",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationNumber: user.registrationNumber,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed",
    });
  }
});

module.exports = router;