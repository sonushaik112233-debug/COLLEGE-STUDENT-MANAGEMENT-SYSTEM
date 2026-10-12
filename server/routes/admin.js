const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const Mark = require("../models/Mark");

const router = express.Router();

// ==================== ADMIN AUTHENTICATION ====================

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({
        message: "Server authentication is not configured",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

router.use(requireAdmin);

// ==================== ATTENDANCE DAY LOCK MODEL ====================

const attendanceDayLockSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },
    semester: {
      type: Number,
      required: true,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

attendanceDayLockSchema.index(
  { date: 1, semester: 1 },
  { unique: true }
);

const AttendanceDayLock =
  mongoose.models.AttendanceDayLock ||
  mongoose.model("AttendanceDayLock", attendanceDayLockSchema);

// ==================== COMMON VALIDATION HELPERS ====================

const validAttendanceStatuses = ["Present", "Absent", "Late"];

const parseSemester = (semester) => {
  if (
    semester === undefined ||
    semester === null ||
    semester === ""
  ) {
    return null;
  }

  const value = Number(semester);

  if (!Number.isInteger(value) || value < 1 || value > 8) {
    return null;
  }

  return value;
};

const validateDate = (date) => {
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
};

const validateNumericField = (value, max) => {
  if (
    value === undefined ||
    value === null ||
    typeof value === "boolean" ||
    typeof value === "object" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return false;
  }

  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0 &&
    number <= max
  );
};

// ==================== STUDENT MANAGEMENT ====================

// Get pending students.
router.get("/pending-students", async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      approved: false,
    })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.json(students);
  } catch (error) {
    console.error("Failed to fetch pending students:", error);

    return res.status(500).json({
      message: "Failed to fetch pending students",
    });
  }
});

// Get all students with their overall attendance percentage.
router.get("/students", async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const studentIds = students.map((student) => student._id);
    const percentages = await getAttendancePercentages(studentIds);

    const studentsWithAttendance = students.map((student) => ({
      ...student,
      attendancePercentage: percentages[String(student._id)],
    }));

    return res.json(studentsWithAttendance);
  } catch (error) {
    console.error("Failed to fetch students:", error);

    return res.status(500).json({
      message: "Failed to fetch students",
    });
  }
});

// Update student semester.
router.patch("/students/:id/semester", async (req, res) => {
  try {
    const { semester } = req.body;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    let semesterValue = null;

    if (
      semester !== null &&
      semester !== undefined &&
      semester !== ""
    ) {
      semesterValue = Number(semester);

      if (
        !Number.isInteger(semesterValue) ||
        semesterValue < 1 ||
        semesterValue > 8
      ) {
        return res.status(400).json({
          message: "Semester must be between 1 and 8",
        });
      }
    }

    const student = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "student",
      },
      {
        semester: semesterValue,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.json({
      message: "Semester updated successfully",
      student,
    });
  } catch (error) {
    console.error("Failed to update semester:", error);

    return res.status(500).json({
      message: "Failed to update semester",
    });
  }
});

// Approve student.
router.patch("/students/:id/approve", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    const student = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "student",
      },
      {
        approved: true,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.json({
      message: "Student approved successfully",
      student,
    });
  } catch (error) {
    console.error("Failed to approve student:", error);

    return res.status(500).json({
      message: "Failed to approve student",
    });
  }
});

// ==================== ATTENDANCE HELPERS ====================

const calculateAttendancePercentage = (present, absent, late) => {
  const totalClasses = present + absent + late;

  if (totalClasses === 0) {
    return null;
  }

  return Number(
    (((present + late * 0.5) / totalClasses) * 100).toFixed(2)
  );
};

// Calculate overall attendance for each student.
// Present = 1; Late = 0.5; Absent = 0.
async function getAttendancePercentages(studentIds) {
  const percentages = {};

  for (const studentId of studentIds) {
    percentages[String(studentId)] = null;
  }

  if (!studentIds.length) {
    return percentages;
  }

  const summary = await Attendance.aggregate([
    {
      $match: {
        student: {
          $in: studentIds.map(
            (id) => new mongoose.Types.ObjectId(String(id))
          ),
        },
        status: {
          $in: validAttendanceStatuses,
        },
      },
    },
    {
      $group: {
        _id: "$student",
        present: {
          $sum: {
            $cond: [
              { $eq: ["$status", "Present"] },
              1,
              0,
            ],
          },
        },
        absent: {
          $sum: {
            $cond: [
              { $eq: ["$status", "Absent"] },
              1,
              0,
            ],
          },
        },
        late: {
          $sum: {
            $cond: [
              { $eq: ["$status", "Late"] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  for (const item of summary) {
    percentages[String(item._id)] = calculateAttendancePercentage(
      item.present,
      item.absent,
      item.late
    );
  }

  return percentages;
}

// ==================== ATTENDANCE ====================

// GET /api/admin/attendance?date=YYYY-MM-DD&semester=1

router.get("/attendance", async (req, res) => {
  try {
    const { date, semester } = req.query;

    if (date !== undefined && !validateDate(date)) {
      return res.status(400).json({
        message: "Date must be a valid date in YYYY-MM-DD format",
      });
    }

    let semesterNumber = null;

    if (semester !== undefined && semester !== "") {
      semesterNumber = parseSemester(semester);

      if (semesterNumber === null) {
        return res.status(400).json({
          message: "Semester must be between 1 and 8",
        });
      }
    }

    const studentFilter = {
      role: "student",
      approved: true,
    };

    if (semesterNumber !== null) {
      studentFilter.semester = semesterNumber;
    }

    const students = await User.find(studentFilter).select(
      "_id name username email registrationNumber semester approved"
    );

    const studentIds = students.map((student) => student._id);

    const attendanceFilter = {
      student: {
        $in: studentIds,
      },
    };

    if (date) {
      attendanceFilter.date = date;
    }

    const attendanceRecords = await Attendance.find(attendanceFilter)
      .populate(
        "student",
        "name username email registrationNumber semester approved"
      )
      .sort({ date: -1 });

    const attendance = attendanceRecords
      .filter((record) => record.student)
      .map((record) => {
        const item = record.toObject();

        return {
          ...item,
          studentId: item.student._id,
        };
      });

    const percentages = await getAttendancePercentages(studentIds);

    let locked = false;

    if (date && semesterNumber !== null) {
      const lock = await AttendanceDayLock.findOne({
        date,
        semester: semesterNumber,
      }).select("_id");

      const existingAttendance = studentIds.length
        ? await Attendance.findOne({
            date,
            student: {
              $in: studentIds,
            },
          }).select("_id")
        : null;

      locked = Boolean(lock || existingAttendance);
    }

    return res.json({
      attendance,
      percentages,
      locked,
      date: date || null,
      semester: semesterNumber,
    });
  } catch (error) {
    console.error("Failed to fetch attendance:", error);

    return res.status(500).json({
      message: "Failed to fetch attendance",
    });
  }
});

// Save attendance once per date + semester.

router.post("/attendance", async (req, res) => {
  let lockAcquired = false;
  let attendanceSaveStarted = false;
  let date;
  let semesterNumber = null;
  let lockAdminId;
  let savedRecordIds = [];

  try {
    ({ date } = req.body);

    const { semester, records } = req.body;

    if (!validateDate(date)) {
      return res.status(400).json({
        message: "A valid date in YYYY-MM-DD format is required",
      });
    }

    semesterNumber = parseSemester(semester);

    if (semesterNumber === null) {
      return res.status(400).json({
        message: "Semester must be between 1 and 8",
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        message: "At least one attendance record is required",
      });
    }

    const seenStudentIds = new Set();

    for (const record of records) {
      if (
        !record ||
        !record.studentId ||
        !mongoose.isValidObjectId(record.studentId) ||
        !validAttendanceStatuses.includes(record.status)
      ) {
        return res.status(400).json({
          message: "Each record needs a valid studentId and attendance status",
        });
      }

      const studentId = String(record.studentId);

      if (seenStudentIds.has(studentId)) {
        return res.status(400).json({
          message: "Duplicate student IDs are not allowed in one attendance request",
        });
      }

      seenStudentIds.add(studentId);
    }

    const semesterStudents = await User.find({
      role: "student",
      approved: true,
      semester: semesterNumber,
    }).select("_id");

    const semesterStudentIds = semesterStudents.map(
      (student) => student._id
    );

    const semesterStudentIdSet = new Set(
      semesterStudentIds.map(String)
    );

    const invalidStudent = records.find(
      (record) => !semesterStudentIdSet.has(String(record.studentId))
    );

    if (invalidStudent) {
      return res.status(400).json({
        message: "Every student must be approved and assigned to the selected semester",
      });
    }

    if (semesterStudentIds.length === 0) {
      return res.status(400).json({
        message: "No approved students are assigned to this semester",
      });
    }

    if (
      records.length !== semesterStudentIds.length ||
      semesterStudentIds.some(
        (studentId) => !seenStudentIds.has(String(studentId))
      )
    ) {
      return res.status(400).json({
        message: "Submit attendance for every approved student in the selected semester.",
      });
    }

    lockAdminId =
      req.admin.id ||
      req.admin._id ||
      req.admin.userId;

    if (!mongoose.isValidObjectId(lockAdminId)) {
      return res.status(401).json({
        message: "Unable to identify the authenticated admin",
      });
    }

    await AttendanceDayLock.init();

    const existingLock = await AttendanceDayLock.findOne({
      date,
      semester: semesterNumber,
    }).select("_id");

    if (existingLock) {
      return res.status(409).json({
        message: "Attendance has already been submitted for this date and semester.",
        alreadyMarked: true,
        locked: true,
      });
    }

    const existingAttendance = await Attendance.findOne({
      date,
      student: {
        $in: semesterStudentIds,
      },
    }).select("_id");

    if (existingAttendance) {
      return res.status(409).json({
        message: "Attendance has already been submitted for this date and semester.",
        alreadyMarked: true,
        locked: true,
      });
    }

    try {
      await AttendanceDayLock.create({
        date,
        semester: semesterNumber,
        lockedBy: lockAdminId,
      });

      lockAcquired = true;
    } catch (lockError) {
      if (lockError.code === 11000) {
        return res.status(409).json({
          message: "Attendance has already been submitted for this date and semester.",
          alreadyMarked: true,
          locked: true,
        });
      }

      throw lockError;
    }

    attendanceSaveStarted = true;

    const documents = records.map((record) => ({
      student: record.studentId,
      date,
      status: record.status,
      markedBy: lockAdminId,
    }));

    const savedRecords = await Attendance.insertMany(documents, {
      ordered: true,
    });

    savedRecordIds = savedRecords.map((record) => record._id);

    const percentages = await getAttendancePercentages(
      semesterStudentIds
    );

    return res.json({
      message: "Attendance saved and locked successfully",
      savedCount: savedRecords.length,
      records: savedRecords,
      percentages,
      locked: true,
      date,
      semester: semesterNumber,
    });
  } catch (error) {
    console.error("Failed to save attendance:", error);

    if (
      lockAcquired &&
      attendanceSaveStarted &&
      date &&
      semesterNumber !== null
    ) {
      try {
        if (savedRecordIds.length > 0) {
          await Attendance.deleteMany({
            _id: {
              $in: savedRecordIds,
            },
          });
        } else {
          const submittedIds = Array.isArray(req.body.records)
            ? req.body.records
                .filter(
                  (record) =>
                    record &&
                    record.studentId &&
                    mongoose.isValidObjectId(record.studentId)
                )
                .map(
                  (record) =>
                    new mongoose.Types.ObjectId(record.studentId)
                )
            : [];

          if (submittedIds.length > 0) {
            await Attendance.deleteMany({
              date,
              student: {
                $in: submittedIds,
              },
            });
          }
        }

        await AttendanceDayLock.deleteOne({
          date,
          semester: semesterNumber,
        });
      } catch (cleanupError) {
        console.error(
          "Attendance cleanup failed; manual database inspection may be needed:",
          cleanupError
        );
      }
    }

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to save attendance",
      });
    }
  }
});

// ==================== ATTENDANCE SUMMARY ====================

router.get("/attendance/summary", async (req, res) => {
  try {
    const { semester } = req.query;
    const match = {};

    if (semester !== undefined && semester !== "") {
      const semesterNumber = parseSemester(semester);

      if (semesterNumber === null) {
        return res.status(400).json({
          message: "Semester must be between 1 and 8",
        });
      }

      const students = await User.find({
        role: "student",
        approved: true,
        semester: semesterNumber,
      }).select("_id");

      match.student = {
        $in: students.map((student) => student._id),
      };
    }

    const summary = await Attendance.aggregate([
      {
        $match: match,
      },
      {
        $match: {
          status: {
            $in: validAttendanceStatuses,
          },
        },
      },
      {
        $group: {
          _id: "$student",
          totalClasses: {
            $sum: 1,
          },
          present: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Present"] },
                1,
                0,
              ],
            },
          },
          absent: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Absent"] },
                1,
                0,
              ],
            },
          },
          late: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Late"] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          attendancePercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $add: [
                          "$present",
                          { $multiply: ["$late", 0.5] },
                        ],
                      },
                      "$totalClasses",
                    ],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $lookup: {
          from: User.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      {
        $unwind: {
          path: "$student",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "student.role": "student",
          "student.approved": true,
        },
      },
      {
        $project: {
          totalClasses: 1,
          present: 1,
          absent: 1,
          late: 1,
          attendancePercentage: 1,
          student: {
            _id: "$student._id",
            name: "$student.name",
            username: "$student.username",
            email: "$student.email",
            registrationNumber: "$student.registrationNumber",
            semester: "$student.semester",
          },
        },
      },
      {
        $sort: {
          "student.name": 1,
        },
      },
    ]);

    return res.json(summary);
  } catch (error) {
    console.error("Failed to fetch attendance summary:", error);

    return res.status(500).json({
      message: "Failed to fetch attendance summary",
    });
  }
});

// ==================== SUBJECT-WISE MARKS ====================

// Get marks, optionally filtered by semester, student, or subject.
router.get("/marks", async (req, res) => {
  try {
    const { semester, studentId, subjectId } = req.query;
    const filter = {};

    if (semester !== undefined && semester !== "") {
      const semesterNumber = parseSemester(semester);

      if (semesterNumber === null) {
        return res.status(400).json({
          message: "Semester must be between 1 and 8",
        });
      }

      filter.semester = semesterNumber;
    }

    if (studentId) {
      if (!mongoose.isValidObjectId(studentId)) {
        return res.status(400).json({
          message: "Invalid student ID",
        });
      }

      filter.studentId = studentId;
    }

    if (subjectId) {
      if (!mongoose.isValidObjectId(subjectId)) {
        return res.status(400).json({
          message: "Invalid subject ID",
        });
      }

      filter.subjectId = subjectId;
    }

    const marks = await Mark.find(filter)
      .populate(
        "studentId",
        "name username email registrationNumber semester"
      )
      .populate("subjectId", "name code semester")
      .sort({
        semester: 1,
        createdAt: -1,
      });

    return res.json({ marks });
  } catch (error) {
    console.error("Failed to fetch marks:", error);

    return res.status(500).json({
      message: "Failed to fetch marks",
    });
  }
});

// Assign or update subject-wise marks.
// One record per student, subject, and semester.
// Omitted fields remain unchanged when updating an existing record.

router.post("/marks", async (req, res) => {
  try {
    const {
      studentId,
      subjectId,
      semester,
      assignment1,
      assignment2,
      mid1,
      mid2,
      attendancePercentage,
      seeMarks,
    } = req.body;

    if (
      !studentId ||
      !subjectId ||
      !mongoose.isValidObjectId(studentId) ||
      !mongoose.isValidObjectId(subjectId)
    ) {
      return res.status(400).json({
        message: "Valid studentId and subjectId are required",
      });
    }

    const semesterNumber = parseSemester(semester);

    if (semesterNumber === null) {
      return res.status(400).json({
        message: "Semester must be between 1 and 8",
      });
    }

    const numericFields = {
      assignment1: {
        value: assignment1,
        max: 10,
      },
      assignment2: {
        value: assignment2,
        max: 10,
      },
      mid1: {
        value: mid1,
        max: 30,
      },
      mid2: {
        value: mid2,
        max: 30,
      },
      attendancePercentage: {
        value: attendancePercentage,
        max: 100,
      },
      seeMarks: {
        value: seeMarks,
        max: 60,
      },
    };

    let suppliedFieldCount = 0;

    for (const [field, item] of Object.entries(numericFields)) {
      if (item.value !== undefined) {
        suppliedFieldCount++;

        if (!validateNumericField(item.value, item.max)) {
          return res.status(400).json({
            message:
              `${field} must be a valid number between 0 and ${item.max}`,
          });
        }
      }
    }

    if (suppliedFieldCount === 0) {
      return res.status(400).json({
        message: "Provide at least one mark or attendance field to save",
      });
    }

    const student = await User.findOne({
      _id: studentId,
      role: "student",
    });

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    if (student.approved === false) {
      return res.status(400).json({
        message: "Student is not approved yet",
      });
    }

    if (
      student.semester !== undefined &&
      student.semester !== null &&
      Number(student.semester) !== semesterNumber
    ) {
      return res.status(400).json({
        message: "Semester does not match the student's current semester",
      });
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    if (
      subject.semester !== undefined &&
      subject.semester !== null &&
      Number(subject.semester) !== semesterNumber
    ) {
      return res.status(400).json({
        message: "Semester does not match the subject's semester",
      });
    }

    const values = {
      studentId,
      subjectId,
      semester: semesterNumber,
    };

    for (const [field, item] of Object.entries(numericFields)) {
      if (item.value !== undefined) {
        values[field] = Number(item.value);
      }
    }

    const marks = await Mark.findOneAndUpdate(
      {
        studentId,
        subjectId,
        semester: semesterNumber,
      },
      {
        $set: values,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    )
      .populate(
        "studentId",
        "name username email registrationNumber semester"
      )
      .populate("subjectId", "name code semester");

    return res.json({
      message: "Marks saved successfully",
      marks,
    });
  } catch (error) {
    console.error("Failed to save marks:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Marks already exist for this student, subject, and semester",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid marks data",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to save marks",
    });
  }
});

module.exports = router;