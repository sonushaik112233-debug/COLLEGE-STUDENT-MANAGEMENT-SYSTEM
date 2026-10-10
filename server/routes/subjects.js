
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Subject = require("../models/Subject");

const router = express.Router();

// Verify that only authenticated admins can manage subjects.
function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    const token = authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

// Validate semester numbers from 1 to 8.
function isValidSemester(semester) {
  return (
    Number.isInteger(semester) &&
    semester >= 1 &&
    semester <= 8
  );
}

// Get all subjects, optionally filtered by semester.
// GET /api/subjects?semester=1
router.get("/", requireAdmin, async (req, res) => {
  try {
    const filter = {};

    if (req.query.semester !== undefined) {
      const semester = Number(req.query.semester);

      if (!isValidSemester(semester)) {
        return res.status(400).json({
          message: "Semester must be a number from 1 to 8.",
        });
      }

      filter.semester = semester;
    }

    const subjects = await Subject.find(filter)
      .sort({ semester: 1, name: 1 })
      .lean();

    res.json({ subjects });
  } catch (error) {
    console.error("Load subjects error:", error.message);

    res.status(500).json({
      message: "Unable to load subjects.",
    });
  }
});

// Add a subject.
// POST /api/subjects
// Body: { "name": "Database Management Systems",
//         "code": "DBMS", "semester": 3 }
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, code, semester } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof code !== "string" ||
      !code.trim()
    ) {
      return res.status(400).json({
        message: "Subject name and subject code are required.",
      });
    }

    if (!isValidSemester(semester)) {
      return res.status(400).json({
        message: "Semester must be a whole number from 1 to 8.",
      });
    }

    const adminId = req.user.id || req.user._id || req.user.userId;

    if (!adminId || !mongoose.isValidObjectId(adminId)) {
      return res.status(401).json({
        message: "Unable to identify the authenticated admin.",
      });
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      semester,
      createdBy: adminId,
    });

    res.status(201).json({
      message: "Subject added successfully.",
      subject,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This subject code already exists in that semester.",
      });
    }

    console.error("Add subject error:", error.message);

    res.status(500).json({
      message: "Unable to add subject.",
    });
  }
});

// Edit a subject.
// PATCH /api/subjects/:id
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid subject ID.",
      });
    }

    const updates = {};
    const { name, code, semester } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Subject name cannot be empty.",
        });
      }

      updates.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== "string" || !code.trim()) {
        return res.status(400).json({
          message: "Subject code cannot be empty.",
        });
      }

      updates.code = code.trim().toUpperCase();
    }

    if (semester !== undefined) {
      if (!isValidSemester(semester)) {
        return res.status(400).json({
          message: "Semester must be a whole number from 1 to 8.",
        });
      }

      updates.semester = semester;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update.",
      });
    }

    const subject = await Subject.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found.",
      });
    }

    res.json({
      message: "Subject updated successfully.",
      subject,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This subject code already exists in that semester.",
      });
    }

    console.error("Update subject error:", error.message);

    res.status(500).json({
      message: "Unable to update subject.",
    });
  }
});

// Delete a subject.
// DELETE /api/subjects/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid subject ID.",
      });
    }

    const subject = await Subject.findByIdAndDelete(req.params.id);

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found.",
      });
    }

    res.json({
      message: "Subject deleted successfully.",
      subjectId: subject._id,
    });
  } catch (error) {
    console.error("Delete subject error:", error.message);

    res.status(500).json({
      message: "Unable to delete subject.",
    });
  }
});

module.exports = router;
