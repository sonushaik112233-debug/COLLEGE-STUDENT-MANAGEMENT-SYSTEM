
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

const router = express.Router();

// Verify that the requester is an authenticated admin
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

// Validate a real calendar date in YYYY-MM-DD format
function isValidDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

// Get students awaiting approval
router.get("/pending-students", requireAdmin, async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      approved: false,
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ students });
  } catch (error) {
    console.error("Load pending students error:", error.message);

    res.status(500).json({
      message: "Unable to load pending students.",
    });
  }
});

// Get all approved students
router.get("/students", requireAdmin, async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      approved: true,
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ students });
  } catch (error) {
    console.error("Load students error:", error.message);

    res.status(500).json({
      message: "Unable to load students.",
    });
  }
});

// Assign or update a student's semester (1 to 8)
// Send { "semester": 1 } through { "semester": 8 }.
// Send { "semester": null } to remove the assignment.
router.patch(
  "/students/:id/semester",
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { semester } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid student ID.",
        });
      }

      if (
        semester !== null &&
        (
          !Number.isInteger(semester) ||
          semester < 1 ||
          semester > 8
        )
      ) {
        return res.status(400).json({
          message: "Semester must be a whole number from 1 to 8, or null.",
        });
      }

      const student = await User.findOneAndUpdate(
        {
          _id: id,
          role: "student",
        },
        {
          $set: { semester },
        },
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

      if (!student) {
        return res.status(404).json({
          message: "Student not found.",
        });
      }

      res.json({
        message:
          semester === null
            ? "Student semester assignment removed successfully."
            : `Student assigned to semester ${semester} successfully.`,
        student,
      });
    } catch (error) {
      console.error("Assign student semester error:", error.message);

      res.status(500).json({
        message: "Unable to update the student's semester.",
      });
    }
  }
);

// Approve a student
router.patch("/students/:id/approve", requireAdmin, async (req, res) => {
  try {
    const student = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "student",
        approved: false,
      },
      { $set: { approved: true } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!student) {
      return res.status(404).json({
        message: "Pending student not found.",
      });
    }

    res.json({
      message: "Student approved successfully.",
      student,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid student ID.",
      });
    }

    console.error("Approve student error:", error.message);

    res.status(500).json({
      message: "Unable to approve student.",
    });
  }
});

// Get attendance for all approved students on a selected date
router.get("/attendance", requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;

    if (!isValidDate(date)) {
      return res.status(400).json({
        message: "Please provide a valid date in YYYY-MM-DD format.",
      });
    }

    const students = await User.find({
      role: "student",
      approved: true,
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const attendanceRecords = await Attendance.find({ date }).lean();

    const attendanceByStudent = new Map(
      attendanceRecords.map((record) => [
        record.student.toString(),
        record.status,
      ])
    );

    const attendance = students.map((student) => ({
      ...student,
      attendanceStatus:
        attendanceByStudent.get(student._id.toString()) || "Not Marked",
    }));

    res.json({ date, attendance });
  } catch (error) {
    console.error("Load attendance error:", error.message);

    res.status(500).json({
      message: "Unable to load attendance.",
    });
  }
});

// Save or update attendance for approved students
router.post("/attendance", requireAdmin, async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!isValidDate(date)) {
      return res.status(400).json({
        message: "Please provide a valid date in YYYY-MM-DD format.",
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        message: "Please provide at least one attendance record.",
      });
    }

    const allowedStatuses = ["Present", "Absent", "Late"];
    const seenStudentIds = new Set();

    for (const record of records) {
      if (
        !record ||
        typeof record.studentId !== "string" ||
        !mongoose.isValidObjectId(record.studentId)
      ) {
        return res.status(400).json({
          message: "An attendance record contains an invalid student ID.",
        });
      }

      const studentId = record.studentId;

      if (seenStudentIds.has(studentId)) {
        return res.status(400).json({
          message: "Duplicate student IDs are not allowed.",
        });
      }

      seenStudentIds.add(studentId);

      if (!allowedStatuses.includes(record.status)) {
        return res.status(400).json({
          message: "Attendance status must be Present, Absent, or Late.",
        });
      }
    }

    const studentIds = records.map((record) => record.studentId);

    const approvedStudents = await User.find({
      _id: { $in: studentIds },
      role: "student",
      approved: true,
    }).select("_id");

    if (approvedStudents.length !== records.length) {
      return res.status(400).json({
        message:
          "One or more students do not exist or are not approved.",
      });
    }

    const adminId = req.user.id || req.user._id || req.user.userId;

    if (!adminId || !mongoose.isValidObjectId(adminId)) {
      return res.status(401).json({
        message: "Unable to identify the authenticated admin.",
      });
    }

    const operations = records.map((record) => ({
      updateOne: {
        filter: {
          student: record.studentId,
          date,
        },
        update: {
          $set: {
            status: record.status,
            markedBy: adminId,
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(operations, { ordered: true });

    res.json({
      message: "Attendance saved successfully.",
      date,
      savedCount: records.length,
    });
  } catch (error) {
    console.error("Save attendance error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "A duplicate attendance record was detected. Please reload and try again.",
      });
    }

    res.status(500).json({
      message: "Unable to save attendance.",
    });
  }
});

// Get attendance totals for the pie chart
router.get("/attendance/summary", requireAdmin, async (req, res) => {
  try {
    const summary = await Attendance.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totals = {
      Present: 0,
      Absent: 0,
      Late: 0,
    };

    summary.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(totals, item._id)) {
        totals[item._id] = item.count;
      }
    });

    const total =
      totals.Present + totals.Absent + totals.Late;

    res.json({
      totals,
      total,
    });
  } catch (error) {
    console.error("Attendance summary error:", error.message);

    res.status(500).json({
      message: "Unable to load attendance summary.",
    });
  }
});

module.exports = router;
