const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ==================== API ROUTES ====================

app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/subjects", require("./routes/subjects"));
app.use("/api/student", require("./routes/student"));

// ==================== SERVER STATUS ====================

app.get("/", (req, res) => {
  res.json({
    message: "Student Management System API is running",
  });
});

// ==================== DATABASE HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// ==================== TEMPORARY STUDENT ROUTE TEST ====================

app.get("/api/student/route-test", (req, res) => {
  res.json({
    message: "Student routes are reaching the correct backend",
  });
});

// ==================== SERVER STARTUP ====================

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();