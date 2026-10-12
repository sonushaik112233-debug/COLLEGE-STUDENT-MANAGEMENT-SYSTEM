
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Mark = require("../models/Mark");

const router = express.Router();

// ==================== STUDENT AUTHENTICATION ====================

const requireStudent = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Server authentication is not configured",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "student" || !decoded.userId) {
      return res.status(403).json({
        message: "Student access required",
      });
    }

    req.studentId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

// Verify that the student still exists and is approved.
const getApprovedStudent = async (studentId) => {
  return User.findOne({
    _id: studentId,
    role: "student",
    approved: true,
  }).select("-password");
};

// ==================== STUDENT PROFILE ====================

// GET /api/student/profile
router.get("/profile", requireStudent, async (req, res) => {
  try {
    const student = await getApprovedStudent(req.studentId);

    if (!student) {
      return res.status(404).json({
        message: "Approved student account not found",
      });
    }

    return res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        registrationNumber: student.registrationNumber,
        semester: student.semester,
      },
    });
  } catch (error) {
    console.error("Failed to fetch student profile:", error);

    return res.status(500).json({
      message: "Failed to fetch student profile",
    });
  }
});

// ==================== STUDENT ATTENDANCE ====================

// GET /api/student/attendance
// Students can access only their own attendance.
router.get("/attendance", requireStudent, async (req, res) => {
  try {
    const student = await getApprovedStudent(req.studentId);

    if (!student) {
      return res.status(404).json({
        message: "Approved student account not found",
      });
    }

    const attendanceRecords = await Attendance.find({
      student: student._id,
      status: {
        $in: ["Present", "Absent", "Late"],
      },
    }).sort({
      date: -1,
      createdAt: -1,
    });

    let present = 0;
    let absent = 0;
    let late = 0;

    for (const record of attendanceRecords) {
      if (record.status === "Present") {
        present++;
      } else if (record.status === "Absent") {
        absent++;
      } else if (record.status === "Late") {
        late++;
      }
    }

    const totalClasses = present + absent + late;

    const attendancePercentage =
      totalClasses === 0
        ? null
        : Number(
            (
              ((present + late * 0.5) / totalClasses) *
              100
            ).toFixed(2)
          );

    return res.json({
      summary: {
        totalClasses,
        present,
        absent,
        late,
        attendancePercentage,
      },
      attendance: attendanceRecords.map((record) => ({
        _id: record._id,
        date: record.date,
        status: record.status,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch student attendance:", error);

    return res.status(500).json({
      message: "Failed to fetch student attendance",
    });
  }
});

// ==================== STUDENT SUBJECT-WISE MARKS ====================

// GET /api/student/marks
// Students can access only their own saved marks.
router.get("/marks", requireStudent, async (req, res) => {
  try {
    const student = await getApprovedStudent(req.studentId);

    if (!student) {
      return res.status(404).json({
        message: "Approved student account not found",
      });
    }

    const filter = {
      studentId: student._id,
    };

    // Restrict results to the student's assigned semester
    // when a semester has been assigned.
    if (
      student.semester !== undefined &&
      student.semester !== null &&
      student.semester !== ""
    ) {
      filter.semester = Number(student.semester);
    }

    const marks = await Mark.find(filter)
      .populate("subjectId", "name code semester")
      .sort({
        semester: 1,
        createdAt: -1,
      });

    return res.json({
      marks: marks.map((record) => ({
        _id: record._id,
        semester: record.semester,
        subject: record.subjectId
          ? {
              _id: record.subjectId._id,
              name: record.subjectId.name,
              code: record.subjectId.code,
              semester: record.subjectId.semester,
            }
          : null,
        assignment1: record.assignment1,
        assignment2: record.assignment2,
        mid1: record.mid1,
        mid2: record.mid2,
        attendancePercentage: record.attendancePercentage,
        seeMarks: record.seeMarks,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch student marks:", error);

    return res.status(500).json({
      message: "Failed to fetch student marks",
    });
  }
});

module.exports = router;
