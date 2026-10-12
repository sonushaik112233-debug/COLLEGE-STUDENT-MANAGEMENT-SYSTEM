import React, { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  GraduationCap, Mail, Lock, User, ArrowRight, BookOpen, Users,
  ShieldCheck, Hash, LayoutDashboard, UserCheck, RefreshCw, LogOut,
  CheckCircle, Clock, CalendarCheck, Calculator, ChartPie, BookMarked,
  ClipboardList, Save, Pencil, Trash2, Plus, X,
} from "lucide-react";
import "./App.css";

type Role = "admin" | "student";
type AdminSection =
  | "dashboard" | "students" | "attendance" | "marks"
  | "subjects" | "approvals" | "calculation" | "attendance-chart";
type AttendanceStatus = "Present" | "Absent" | "Late" | "Not Marked";

type Student = {
  _id: string;
  name?: string;
  email: string;
  registrationNumber?: string;
  approved: boolean;
  semester?: number | null;
  attendancePercentage?: number | null;
  overallAttendancePercentage?: number | null;
  createdAt?: string;
};

type AttendanceStudent = Student & {
  attendanceStatus: AttendanceStatus;
  attendancePercentage: number | null;
};

type Subject = {
  _id: string;
  name: string;
  code: string;
  semester: number;
  createdBy?: string;
};

type MarkRecord = {
  _id: string;
  studentId: string | { _id: string };
  subjectId: string | { _id: string };
  semester: number;
  assignment1: number;
  assignment2: number;
  mid1: number;
  mid2: number;
  attendancePercentage: number;
  seeMarks: number;
};

type MarkForm = {
  assignment1: string;
  assignment2: string;
  mid1: string;
  mid2: string;
  attendancePercentage: string;
  seeMarks: string;
};

type LoggedInUser = {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  registrationNumber?: string;
  role?: Role;
  semester?: number | null;
  approved?: boolean;
};

const emptyMarkForm: MarkForm = {
  assignment1: "0",
  assignment2: "0",
  mid1: "0",
  mid2: "0",
  attendancePercentage: "0",
  seeMarks: "0",
};

function getRelatedId(value: string | { _id: string }): string {
  return typeof value === "string" ? value : value._id;
}

function getLocalDate(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

async function readResponse(response: Response): Promise<any> {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(
  `404 DEBUG — URL: ${response.url} | Status: ${response.status} | ` +
  `Content-Type: ${response.headers.get("content-type") || "unknown"}`
);
    }

    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error("Invalid server response:", {
      url: response.url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      responseText: text.slice(0, 1000),
    });

    throw new Error(
      `Invalid server response (${response.status}). ` +
      `Content-Type: ${response.headers.get("content-type") || "unknown"}. ` +
      `Response: ${text.slice(0, 200)}`
    );
  }
}
type StudentAttendanceRecord = {
  _id: string;
  date: string;
  status: "Present" | "Absent" | "Late";
};

type StudentAttendanceSummary = {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  attendancePercentage: number | null;
};

type StudentMarkView = {
  _id: string;
  semester?: number;
  subject: {
    _id: string;
    name: string;
    code?: string;
    semester?: number;
  } | null;
  assignment1?: number;
  assignment2?: number;
  mid1?: number;
  mid2?: number;
  attendancePercentage?: number;
  seeMarks?: number;
};

function App() {
  const [role, setRole] = useState<Role>("student");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [dashboardRole, setDashboardRole] = useState<Role | null>(null);
  const [activeSection, setActiveSection] =
    useState<AdminSection>("dashboard");

  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState("");

  // Semester assignment
  const [studentSemesterFilter, setStudentSemesterFilter] = useState("all");
  const [updatingSemesterId, setUpdatingSemesterId] =
    useState<string | null>(null);

  // Dynamic subjects
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectMessage, setSubjectMessage] = useState("");
  const [subjectMessageType, setSubjectMessageType] =
    useState<"success" | "error" | "">("");
  const [deletingSubjectId, setDeletingSubjectId] =
    useState<string | null>(null);

  // Attendance
  const [attendanceDate, setAttendanceDate] = useState(getLocalDate());
  const [attendanceSemester, setAttendanceSemester] = useState<number | "">("");
  const [attendanceStudents, setAttendanceStudents] =
    useState<AttendanceStudent[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceMessageType, setAttendanceMessageType] =
    useState<"success" | "error" | "">("");

  /*
   * Store submitted state by date + semester.
   * The backend remains the authoritative source.
   */
  const [submittedAttendanceKeys, setSubmittedAttendanceKeys] =
    useState<Record<string, boolean>>({});

  const attendanceKey =
    attendanceSemester === ""
      ? ""
      : `${attendanceDate}__semester_${attendanceSemester}`;

  // Subject-wise marks
  const [markStudentId, setMarkStudentId] = useState("");
  const [markSubjectId, setMarkSubjectId] = useState("");
  const [markRecords, setMarkRecords] = useState<MarkRecord[]>([]);
  const [markForm, setMarkForm] = useState<MarkForm>({ ...emptyMarkForm });
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);
  const [marksMessage, setMarksMessage] = useState("");
  const [marksMessageType, setMarksMessageType] =
    useState<"success" | "error" | "">("");
    const [studentView, setStudentView] = useState<
  "attendance" | "marks" | null
>(null);

   const [studentAttendanceLoading, setStudentAttendanceLoading] =useState(false);
   const [studentAttendanceError, setStudentAttendanceError] = useState("");
   const [studentAttendanceSummary, setStudentAttendanceSummary] =useState<StudentAttendanceSummary | null>(null);
   const [studentAttendanceRecords, setStudentAttendanceRecords] =useState<StudentAttendanceRecord[]>([]);
   const [studentMarksLoading, setStudentMarksLoading] = useState(false);
   const [studentMarksError, setStudentMarksError] = useState("");
   const [studentMarks, setStudentMarks] = useState<StudentMarkView[]>([]);
    

  const panelStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #DDE9DD",
    borderRadius: "16px",
    padding: "24px",
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #DDE9DD",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#24452D",
    font: "inherit",
  };

  const primaryButtonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "11px 15px",
    background: "#72B879",
    color: "#FFFFFF",
    border: 0,
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 600,
  };

  const getToken = () => localStorage.getItem("token");
  // Refresh the logged-in student's profile so the assigned semester
// shown on the dashboard matches the semester saved by the admin.
const loadStudentAttendance = async () => {
  setStudentView("attendance");
  setStudentAttendanceLoading(true);
  setStudentAttendanceError("");

  try {
    const token = getToken();

    if (!token) {
      throw new Error("Please log in again to view your attendance.");
    }

    const response = await fetch("/api/student/attendance", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "Unable to load attendance.");
    }

    setStudentAttendanceSummary(data.summary ?? null);
    setStudentAttendanceRecords(data.attendance ?? []);
  } catch (error) {
    setStudentAttendanceError(
      error instanceof Error
        ? error.message
        : "Unable to load attendance."
    );
  } finally {
    setStudentAttendanceLoading(false);
  }
};

const loadStudentMarks = async () => {
  setStudentView("marks");
  setStudentMarksLoading(true);
  setStudentMarksError("");

  try {
    const token = getToken();

    if (!token) {
      throw new Error("Please log in again to view your marks.");
    }

    const response = await fetch("/api/student/marks", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "Unable to load subject marks.");
    }

    setStudentMarks(data.marks ?? []);
  } catch (error) {
    setStudentMarksError(
      error instanceof Error
        ? error.message
        : "Unable to load subject marks."
    );
  } finally {
    setStudentMarksLoading(false);
  }
};
useEffect(() => {
  if (dashboardRole !== "student") {
    return;
  }

  let cancelled = false;

  const loadStudentProfile = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      const response = await fetch("/api/student/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load your student profile."
        );
      }

      // Support the common response shapes without changing the API.
      const profile =
        data.student ?? data.profile ?? data.user ?? data;

      if (!profile || cancelled) {
        return;
      }

      const rawSemester =
        profile.semester ?? profile.assignedSemester ?? null;

      const semester =
        rawSemester === null ||
        rawSemester === "" ||
        !Number.isFinite(Number(rawSemester))
          ? null
          : Number(rawSemester);

      setLoggedInUser((current) => {
        if (!current || cancelled) {
          return current;
        }

        const updatedUser: LoggedInUser = {
          ...current,
          ...profile,
          semester,
        };

        // Keep the saved login information synchronized.
        localStorage.setItem("user", JSON.stringify(updatedUser));

        return updatedUser;
      });
    } catch (error) {
      console.error("Unable to refresh student profile:", error);
    }
  };

  void loadStudentProfile();

  return () => {
    cancelled = true;
  };
}, [dashboardRole]);
  const showSubjectMessage = (
    text: string,
    type: "success" | "error"
  ) => {
    setSubjectMessage(text);
    setSubjectMessageType(type);
  };

  const loadPendingStudents = async () => {
    const token = getToken();

    if (!token) {
      setDashboardError("Please log in again to continue.");
      return;
    }

    setLoadingStudents(true);
    setDashboardError("");

    try {
      const response = await fetch("/api/admin/pending-students", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load pending students.");
      }

      setPendingStudents(
        Array.isArray(data) ? data : data.students || []
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to load pending students."
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadApprovedStudents = async () => {
    const token = getToken();

    if (!token) {
      setDashboardError("Please log in again to continue.");
      return;
    }

    setLoadingStudents(true);
    setDashboardError("");

    try {
      const response = await fetch("/api/admin/students", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load students.");
      }

      setApprovedStudents(
        Array.isArray(data) ? data : data.students || []
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Unable to load students."
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  const refreshStudents = async () => {
    await Promise.all([
      loadPendingStudents(),
      loadApprovedStudents(),
    ]);
  };

  const assignSemester = async (
    studentId: string,
    semesterValue: string
  ) => {
    const token = getToken();

    if (!token) {
      setDashboardError("Please log in again to continue.");
      return;
    }

    const semester = semesterValue === "" ? null : Number(semesterValue);

    setUpdatingSemesterId(studentId);
    setDashboardError("");

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/semester`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ semester }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to update semester.");
      }

      setApprovedStudents((current) =>
        current.map((student) =>
          student._id === studentId ? data.student : student
        )
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Unable to update semester."
      );

      await loadApprovedStudents();
    } finally {
      setUpdatingSemesterId(null);
    }
  };

  // Subjects
  const loadSubjects = async () => {
    const token = getToken();

    if (!token) {
      showSubjectMessage("Please log in again to continue.", "error");
      return;
    }

    setLoadingSubjects(true);
    setSubjectMessage("");
    setSubjectMessageType("");

    try {
      const response = await fetch(
        `/api/subjects?semester=${selectedSemester}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load subjects.");
      }

      setSubjects(data.subjects || []);
    } catch (error) {
      showSubjectMessage(
        error instanceof Error
          ? error.message
          : "Unable to load subjects.",
        "error"
      );
    } finally {
      setLoadingSubjects(false);
    }
  };

  const resetSubjectForm = () => {
    setEditingSubjectId(null);
    setSubjectName("");
    setSubjectCode("");
  };

  const saveSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = getToken();

    if (!token) {
      showSubjectMessage("Please log in again to continue.", "error");
      return;
    }

    if (!subjectName.trim() || !subjectCode.trim()) {
      showSubjectMessage(
        "Enter both the subject name and subject code.",
        "error"
      );
      return;
    }

    setSavingSubject(true);
    setSubjectMessage("");

    try {
      const isEditing = editingSubjectId !== null;

      const response = await fetch(
        isEditing
          ? `/api/subjects/${editingSubjectId}`
          : "/api/subjects",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: subjectName.trim(),
            code: subjectCode.trim().toUpperCase(),
            semester: selectedSemester,
          }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to save subject.");
      }

      showSubjectMessage(
        data.message || "Subject saved successfully.",
        "success"
      );

      resetSubjectForm();
      await loadSubjects();
    } catch (error) {
      showSubjectMessage(
        error instanceof Error ? error.message : "Unable to save subject.",
        "error"
      );
    } finally {
      setSavingSubject(false);
    }
  };

  const startEditingSubject = (subject: Subject) => {
    setEditingSubjectId(subject._id);
    setSubjectName(subject.name);
    setSubjectCode(subject.code);
    setSubjectMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteSubject = async (subject: Subject) => {
    if (!window.confirm(`Delete ${subject.name} (${subject.code})?`)) {
      return;
    }

    const token = getToken();

    if (!token) {
      showSubjectMessage("Please log in again to continue.", "error");
      return;
    }

    setDeletingSubjectId(subject._id);
    setSubjectMessage("");

    try {
      const response = await fetch(`/api/subjects/${subject._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete subject.");
      }

      setSubjects((current) =>
        current.filter((item) => item._id !== subject._id)
      );

      if (editingSubjectId === subject._id) {
        resetSubjectForm();
      }

      showSubjectMessage(
        data.message || "Subject deleted successfully.",
        "success"
      );
    } catch (error) {
      showSubjectMessage(
        error instanceof Error ? error.message : "Unable to delete subject.",
        "error"
      );
    } finally {
      setDeletingSubjectId(null);
    }
  };

  // Load attendance independently for the selected date and semester.
  const loadAttendance = async (preserveMessage = false) => {
    if (attendanceSemester === "") {
      setAttendanceStudents([]);
      setAttendanceLocked(false);
      return;
    }

    const token = getToken();

    if (!token) {
      setAttendanceMessage("Please log in again to continue.");
      setAttendanceMessageType("error");
      return;
    }

    const requestDate = attendanceDate;
    const requestSemester = attendanceSemester;
    const requestKey = `${requestDate}__semester_${requestSemester}`;

    setLoadingAttendance(true);

    if (!preserveMessage) {
      setAttendanceMessage("");
      setAttendanceMessageType("");
    }

    try {
      const response = await fetch(
        `/api/admin/attendance?date=${encodeURIComponent(
          requestDate
        )}&semester=${requestSemester}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load attendance.");
      }

      const records = Array.isArray(data)
        ? data
        : Array.isArray(data.attendance)
          ? data.attendance
          : [];

      const percentages =
        data.percentages && typeof data.percentages === "object"
          ? data.percentages
          : {};

      const alreadySubmitted =
        (!Array.isArray(data) && data.locked === true) ||
        records.length > 0;

      setSubmittedAttendanceKeys((current) => ({
        ...current,
        [requestKey]: alreadySubmitted,
      }));

      if (
        requestDate !== attendanceDate ||
        requestSemester !== attendanceSemester
      ) {
        return;
      }

      setAttendanceLocked(alreadySubmitted);

      const semesterStudents = approvedStudents.filter(
        (student) =>
          student.approved &&
          Number(student.semester) === requestSemester
      );

      const mergedStudents: AttendanceStudent[] = semesterStudents.map(
        (student) => {
          const record = records.find((item: any) => {
            const recordStudentId =
              typeof item.studentId === "object" &&
              item.studentId !== null
                ? item.studentId._id
                : item.studentId;

            return String(recordStudentId) === String(student._id);
          });

          const status: AttendanceStatus =
            record?.status === "Present" ||
            record?.status === "Absent" ||
            record?.status === "Late"
              ? record.status
              : "Not Marked";

          const rawPercentage =
            percentages[student._id] ??
            record?.attendancePercentage ??
            record?.overallAttendancePercentage ??
            student.attendancePercentage ??
            student.overallAttendancePercentage;

          const percentage =
            rawPercentage !== undefined &&
            rawPercentage !== null &&
            Number.isFinite(Number(rawPercentage))
              ? Number(rawPercentage)
              : null;

          return {
            ...student,
            attendanceStatus: status,
            attendancePercentage: percentage,
          };
        }
      );

      setAttendanceStudents(mergedStudents);
    } catch (error) {
      setAttendanceMessage(
        error instanceof Error
          ? error.message
          : "Unable to load attendance."
      );
      setAttendanceMessageType("error");
    } finally {
      setLoadingAttendance(false);
    }
  };

  const updateAttendanceStatus = (
    studentId: string,
    status: AttendanceStatus
  ) => {
    if (
      attendanceLocked ||
      submittedAttendanceKeys[attendanceKey] ||
      loadingAttendance ||
      savingAttendance
    ) {
      return;
    }

    setAttendanceStudents((current) =>
      current.map((student) =>
        student._id === studentId
          ? { ...student, attendanceStatus: status }
          : student
      )
    );

    setAttendanceMessage("");
    setAttendanceMessageType("");
  };

  const saveAttendance = async () => {
    if (
      attendanceLocked ||
      (attendanceKey !== "" && submittedAttendanceKeys[attendanceKey])
    ) {
      setAttendanceLocked(true);
      setAttendanceMessage(
        `Attendance for Semester ${attendanceSemester} on ${attendanceDate} has already been submitted.`
      );
      setAttendanceMessageType("error");
      return;
    }

    if (savingAttendance) {
      return;
    }

    const token = getToken();

    if (!token) {
      setAttendanceMessage("Please log in again to continue.");
      setAttendanceMessageType("error");
      return;
    }

    if (attendanceSemester === "") {
      setAttendanceMessage("Please select a semester first.");
      setAttendanceMessageType("error");
      return;
    }

    if (attendanceStudents.length === 0) {
      setAttendanceMessage(
        "There are no students to save attendance for."
      );
      setAttendanceMessageType("error");
      return;
    }

    const records = attendanceStudents
      .filter((student) => student.attendanceStatus !== "Not Marked")
      .map((student) => ({
        studentId: student._id,
        status: student.attendanceStatus,
      }));

    if (!records.length) {
      setAttendanceMessage(
        "Please mark at least one student before saving."
      );
      setAttendanceMessageType("error");
      return;
    }

    const requestDate = attendanceDate;
    const requestSemester = attendanceSemester;
    const requestKey = `${requestDate}__semester_${requestSemester}`;

    setSavingAttendance(true);
    setAttendanceMessage("");
    setAttendanceMessageType("");

    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: requestDate,
          semester: requestSemester,
          records,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        if (response.status === 409) {
          setAttendanceLocked(true);
          setSubmittedAttendanceKeys((current) => ({
            ...current,
            [requestKey]: true,
          }));
        }

        throw new Error(
          data.message || "Unable to save attendance."
        );
      }

      setAttendanceLocked(true);
      setSubmittedAttendanceKeys((current) => ({
        ...current,
        [requestKey]: true,
      }));

      setAttendanceMessage(
        `${data.message || "Attendance saved successfully."} (${
          data.savedCount ?? records.length
        } records)`
      );
      setAttendanceMessageType("success");

      await loadAttendance(true);
    } catch (error) {
      setAttendanceMessage(
        error instanceof Error
          ? error.message
          : "Unable to save attendance."
      );
      setAttendanceMessageType("error");
    } finally {
      setSavingAttendance(false);
    }
  };

  // Marks
  const loadMarks = async (preserveMessage = false) => {
    const token = getToken();

    if (!token) {
      setMarksMessage("Please log in again to continue.");
      setMarksMessageType("error");
      return;
    }

    setLoadingMarks(true);

    if (!preserveMessage) {
      setMarksMessage("");
      setMarksMessageType("");
    }

    try {
      const response = await fetch(
        `/api/admin/marks?semester=${selectedSemester}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load marks.");
      }

      setMarkRecords(data.marks || []);
    } catch (error) {
      setMarksMessage(
        error instanceof Error ? error.message : "Unable to load marks."
      );
      setMarksMessageType("error");
    } finally {
      setLoadingMarks(false);
    }
  };

  const selectedMarkRecord = markRecords.find(
    (record) =>
      getRelatedId(record.studentId) === markStudentId &&
      getRelatedId(record.subjectId) === markSubjectId &&
      record.semester === selectedSemester
  );

  useEffect(() => {
    if (selectedMarkRecord) {
      setMarkForm({
        assignment1: String(selectedMarkRecord.assignment1 ?? 0),
        assignment2: String(selectedMarkRecord.assignment2 ?? 0),
        mid1: String(selectedMarkRecord.mid1 ?? 0),
        mid2: String(selectedMarkRecord.mid2 ?? 0),
        attendancePercentage: String(
          selectedMarkRecord.attendancePercentage ?? 0
        ),
        seeMarks: String(selectedMarkRecord.seeMarks ?? 0),
      });
    } else {
      setMarkForm({ ...emptyMarkForm });
    }
  }, [
    markStudentId,
    markSubjectId,
    selectedSemester,
    markRecords,
  ]);

  const saveMarks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = getToken();

    if (!token) {
      setMarksMessage("Please log in again to continue.");
      setMarksMessageType("error");
      return;
    }

    if (!markStudentId || !markSubjectId) {
      setMarksMessage("Select both a student and a subject.");
      setMarksMessageType("error");
      return;
    }

    for (const [field, value] of Object.entries(markForm)) {
      const number = Number(value);

      const maximum =
        field === "assignment1" || field === "assignment2"
          ? 10
          : field === "mid1" || field === "mid2"
            ? 30
            : field === "attendancePercentage"
              ? 100
              : 60;

      if (
        value.trim() === "" ||
        !Number.isFinite(number) ||
        number < 0 ||
        number > maximum
      ) {
        setMarksMessage(
          `${field} must be between 0 and ${maximum}.`
        );
        setMarksMessageType("error");
        return;
      }
    }

    setSavingMarks(true);
    setMarksMessage("");
    setMarksMessageType("");

    try {
      const response = await fetch("/api/admin/marks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: markStudentId,
          subjectId: markSubjectId,
          semester: selectedSemester,
          assignment1: Number(markForm.assignment1),
          assignment2: Number(markForm.assignment2),
          mid1: Number(markForm.mid1),
          mid2: Number(markForm.mid2),
          attendancePercentage: Number(
            markForm.attendancePercentage
          ),
          seeMarks: Number(markForm.seeMarks),
        }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to save marks.");
      }

      setMarksMessage(data.message || "Marks saved successfully.");
      setMarksMessageType("success");

      await loadMarks(true);
    } catch (error) {
      setMarksMessage(
        error instanceof Error
          ? error.message
          : "Unable to save marks."
      );
      setMarksMessageType("error");
    } finally {
      setSavingMarks(false);
    }
  };

  // Load dashboard data.
  useEffect(() => {
    if (dashboardRole === "admin") {
      void refreshStudents();
    }
  }, [dashboardRole]);

  // Reload attendance for the selected date and semester.
  useEffect(() => {
    if (
      dashboardRole === "admin" &&
      activeSection === "attendance"
    ) {
      if (attendanceSemester !== "") {
        void loadAttendance();
      } else {
        setAttendanceStudents([]);
        setAttendanceLocked(false);
      }
    }
  }, [
    dashboardRole,
    activeSection,
    attendanceDate,
    attendanceSemester,
    approvedStudents,
  ]);

  // Load subjects and marks for the selected semester.
  useEffect(() => {
    if (
      dashboardRole === "admin" &&
      activeSection === "subjects"
    ) {
      void loadSubjects();
    }

    if (
      dashboardRole === "admin" &&
      activeSection === "marks"
    ) {
      void loadSubjects();
      void loadMarks();
    }
  }, [dashboardRole, activeSection, selectedSemester]);

  const handleApprove = async (studentId: string) => {
    const token = getToken();

    if (!token) {
      setDashboardError("Please log in again to continue.");
      return;
    }

    setApprovingId(studentId);
    setDashboardError("");

    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/approve`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to approve student.");
      }

      setPendingStudents((current) =>
        current.filter((student) => student._id !== studentId)
      );

      await loadApprovedStudents();
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to approve student."
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setDashboardRole(null);
    setLoggedInUser(null);
    setActiveSection("dashboard");
    setPendingStudents([]);
    setApprovedStudents([]);
    setDashboardError("");

    setAttendanceStudents([]);
    setAttendanceSemester("");
    setAttendanceLocked(false);
    setAttendanceMessage("");
    setAttendanceMessageType("");
    setSubmittedAttendanceKeys({});

    setSubjects([]);
    setMarkRecords([]);
    setMarkStudentId("");
    setMarkSubjectId("");
    setMarkForm({ ...emptyMarkForm });
    setMarksMessage("");
    setMarksMessageType("");

    resetSubjectForm();

    setMessage("");
    setMessageType("");
    setRole("student");
    setIsRegister(false);
  };

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setIsRegister(false);
    setMessage("");
    setMessageType("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const name = String(formData.get("name") || "").trim();
    const confirmPassword = String(
      formData.get("confirmPassword") || ""
    );

    if (isRegister && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister
        ? "/api/auth/register"
        : "/api/auth/login";

      const body = isRegister
        ? { name, email, password }
        : { identifier: email, password, role };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || "Request failed. Please try again."
        );
      }

      if (isRegister) {
        setMessage(
          `Registration successful! Your registration number is ${data.registrationNumber}. Your account is awaiting admin approval.`
        );
        setMessageType("success");
        setIsRegister(false);
        form.reset();
      } else {
        if (!data.user || !data.token) {
          throw new Error("Login response is missing user or token information.");
        }

        const authenticatedRole = data.user.role as Role;

        if (authenticatedRole !== "admin" && authenticatedRole !== "student") {
          throw new Error("Invalid user role returned by the server.");
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setLoggedInUser(data.user);

        setDashboardRole(authenticatedRole);
        setActiveSection("dashboard");
        setMessage("");
        setMessageType("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", icon: Users },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "marks", label: "Marks", icon: ClipboardList },
    { id: "subjects", label: "Subjects", icon: BookMarked },
    { id: "approvals", label: "Approvals", icon: UserCheck },
    { id: "calculation", label: "Marks Calculation", icon: Calculator },
    { id: "attendance-chart", label: "Attendance Pie Chart", icon: ChartPie },
  ] as const;

  const attendanceCounts = {
    present: attendanceStudents.filter(
      (student) => student.attendanceStatus === "Present"
    ).length,
    absent: attendanceStudents.filter(
      (student) => student.attendanceStatus === "Absent"
    ).length,
    late: attendanceStudents.filter(
      (student) => student.attendanceStatus === "Late"
    ).length,
    unmarked: attendanceStudents.filter(
      (student) => student.attendanceStatus === "Not Marked"
    ).length,
  };

  // Restore the existing login session after a page refresh.
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token && loggedInUser?.role) {
      setDashboardRole(loggedInUser.role);
    }
  }, []);

  if (dashboardRole === "student") {
    const student = loggedInUser;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F1F8F0",
          color: "#24452D",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
            padding: "20px 28px",
            background: "#FFFFFF",
            borderBottom: "1px solid #DDE9DD",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                padding: "10px",
                borderRadius: "12px",
                background: "#72B879",
                color: "#FFFFFF",
              }}
            >
              <GraduationCap size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>CampusConnect</h2>
              <p style={{ margin: "4px 0 0", color: "#65766B" }}>
                Student Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...primaryButtonStyle,
              background: "#FFF0EF",
              color: "#B42318",
            }}
          >
            <LogOut size={17} /> Logout
          </button>
        </header>

        <main
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "28px",
            boxSizing: "border-box",
          }}
        >
          <section
            style={{
              padding: "30px",
              borderRadius: "18px",
              background: "#B9E3B9",
              marginBottom: "24px",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "1px",
              }}
            >
              STUDENT DASHBOARD
            </p>
            <h1 style={{ margin: "0 0 10px", fontSize: "30px" }}>
              Welcome, {student?.name || "Student"}!
            </h1>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              Welcome to your CampusConnect student portal. You can access
              your student information here.
            </p>
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            <section style={panelStyle}>
              <User size={28} color="#72B879" />
              <p style={{ color: "#65766B", marginBottom: "8px" }}>
                Account Status
              </p>
              <h2 style={{ margin: 0, fontSize: "23px" }}>
                {student?.approved === false ? "Pending Approval" : "Logged In"}
              </h2>
            </section>

            <section style={panelStyle}>
              <BookOpen size={28} color="#72B879" />
              <p style={{ color: "#65766B", marginBottom: "8px" }}>
                Assigned Semester
              </p>
              <h2 style={{ margin: 0, fontSize: "23px" }}>
                {student?.semester
                  ? `Semester ${student.semester}`
                  : "Not assigned"}
              </h2>
            </section>

            <section style={panelStyle}>
              <Hash size={28} color="#72B879" />
              <p style={{ color: "#65766B", marginBottom: "8px" }}>
                Registration Number
              </p>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  overflowWrap: "anywhere",
                }}
              >
                {student?.registrationNumber || "Not available"}
              </h2>
            </section>
          </div>

          <section style={{ ...panelStyle, marginBottom: "24px" }}>
            <h2 style={{ marginTop: 0 }}>My Profile</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <p style={{ marginBottom: "5px", color: "#65766B" }}>
                  Full name
                </p>
                <strong>{student?.name || "Not available"}</strong>
              </div>
              <div>
                <p style={{ marginBottom: "5px", color: "#65766B" }}>
                  Email address
                </p>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {student?.email || "Not available"}
                </strong>
              </div>
              <div>
                <p style={{ marginBottom: "5px", color: "#65766B" }}>
                  Role
                </p>
                <strong>Student</strong>
              </div>
            </div>
          </section>
          <>
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
    <button
      type="button"
      onClick={loadStudentAttendance}
      className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
          <CalendarCheck size={26} />
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-800">
            My Attendance
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            View your attendance percentage and attendance history.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-700">
          View Attendance
        </span>
        <ArrowRight size={18} className="text-blue-700" />
      </div>
    </button>

    <button
      type="button"
      onClick={loadStudentMarks}
      className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-purple-100 p-3 text-purple-700">
          <ClipboardList size={26} />
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-800">
            My Subject Marks
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            View your assignment, midterm, attendance, and SEE marks.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-semibold text-purple-700">
          View Marks
        </span>
        <ArrowRight size={18} className="text-purple-700" />
      </div>
    </button>
  </div>

  {studentView === "attendance" && (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            My Attendance
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Your attendance summary and class history.
          </p>
        </div>

        <button
          type="button"
          onClick={loadStudentAttendance}
          disabled={studentAttendanceLoading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={studentAttendanceLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {studentAttendanceLoading ? (
        <div className="flex items-center gap-2 py-8 text-slate-500">
          <RefreshCw size={18} className="animate-spin" />
          Loading attendance...
        </div>
      ) : studentAttendanceError ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {studentAttendanceError}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Classes</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {studentAttendanceSummary?.totalClasses ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-sm text-green-700">Present</p>
              <p className="mt-2 text-2xl font-bold text-green-800">
                {studentAttendanceSummary?.present ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm text-red-700">Absent</p>
              <p className="mt-2 text-2xl font-bold text-red-800">
                {studentAttendanceSummary?.absent ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-sm text-blue-700">Attendance</p>
              <p className="mt-2 text-2xl font-bold text-blue-800">
                {studentAttendanceSummary?.attendancePercentage == null
                  ? "—"
                  : `${studentAttendanceSummary.attendancePercentage}%`}
              </p>
            </div>
          </div>

          <h4 className="mb-3 font-bold text-slate-800">
            Attendance History
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody>
                {studentAttendanceRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No attendance records available.
                    </td>
                  </tr>
                ) : (
                  studentAttendanceRecords.map((record) => (
                    <tr
                      key={record._id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            record.status === "Present"
                              ? "bg-green-100 text-green-700"
                              : record.status === "Absent"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )}

  {studentView === "marks" && (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            My Subject Marks
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Marks assigned to your subjects by the admin.
          </p>
        </div>

        <button
          type="button"
          onClick={loadStudentMarks}
          disabled={studentMarksLoading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={studentMarksLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {studentMarksLoading ? (
        <div className="flex items-center gap-2 py-8 text-slate-500">
          <RefreshCw size={18} className="animate-spin" />
          Loading subject marks...
        </div>
      ) : studentMarksError ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {studentMarksError}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-3 font-semibold">Semester</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Assignment 1</th>
                <th className="px-4 py-3 font-semibold">Assignment 2</th>
                <th className="px-4 py-3 font-semibold">Mid 1</th>
                <th className="px-4 py-3 font-semibold">Mid 2</th>
                <th className="px-4 py-3 font-semibold">Attendance %</th>
                <th className="px-4 py-3 font-semibold">SEE</th>
              </tr>
            </thead>

            <tbody>
              {studentMarks.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No subject marks have been assigned yet.
                  </td>
                </tr>
              ) : (
                studentMarks.map((record) => (
                  <tr
                    key={record._id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {record.subject?.semester ??
                        record.semester ??
                        loggedInUser?.semester ??
                        "—"}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {record.subject?.name ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {record.subject?.code ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {record.assignment1 ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {record.assignment2 ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {record.mid1 ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {record.mid2 ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {record.attendancePercentage == null
                        ? "—"
                        : `${record.attendancePercentage}%`}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {record.seeMarks ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )}
</>

          <p
            style={{
              textAlign: "center",
              color: "#65766B",
              marginTop: "28px",
              fontSize: "13px",
            }}
          >
            CampusConnect · College Student Management System
          </p>
        </main>
      </div>
    );
  }

  if (dashboardRole === "admin") {
    const filteredStudents =
      studentSemesterFilter === "all"
        ? approvedStudents
        : approvedStudents.filter(
            (student) =>
              String(student.semester ?? "") === studentSemesterFilter
          );

    const semesterMarkStudents = approvedStudents.filter(
      (student) =>
        !student.semester ||
        Number(student.semester) === selectedSemester
    );

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F1F8F0",
          color: "#24452D",
          display: "flex",
          flexWrap: "wrap",
        }}
      >
        <aside
          style={{
            width: "245px",
            flexShrink: 0,
            background: "#FFFFFF",
            borderRight: "1px solid #DDE9DD",
            padding: "24px 16px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "#72B879",
                color: "#FFFFFF",
                padding: "9px",
                borderRadius: "10px",
                display: "flex",
              }}
            >
              <GraduationCap size={28} />
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: "19px" }}>
                CampusConnect
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#65766B",
                  fontSize: "12px",
                }}
              >
                Admin Portal
              </p>
            </div>
          </div>

          <div>
            <p
              style={{
                color: "#87948B",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1px",
                paddingLeft: "12px",
              }}
            >
              MAIN MENU
            </p>

            <nav style={{ display: "grid", gap: "6px" }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const selected = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "12px",
                      border: 0,
                      borderRadius: "9px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: selected ? "#3F8D4B" : "#56675C",
                      background: selected ? "#DDF3DF" : "transparent",
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>

                    {item.id === "approvals" &&
                      pendingStudents.length > 0 && (
                        <span
                          style={{
                            marginLeft: "auto",
                            background: "#FFF0D6",
                            color: "#925D08",
                            borderRadius: "20px",
                            padding: "2px 7px",
                            fontSize: "12px",
                          }}
                        >
                          {pendingStudents.length}
                        </span>
                      )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div style={{ marginTop: "auto" }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "12px",
                border: 0,
                borderRadius: "9px",
                background: "#FFF1F0",
                color: "#B42318",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: "280px",
            padding: "28px",
            boxSizing: "border-box",
          }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "28px",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 5px",
                  color: "#65766B",
                  fontSize: "13px",
                }}
              >
                CampusConnect / Admin
              </p>

              <h1 style={{ margin: 0, fontSize: "27px" }}>
                {navItems.find((item) => item.id === activeSection)?.label}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeSection === "attendance") {
                  void loadAttendance();
                } else if (activeSection === "subjects") {
                  void loadSubjects();
                } else if (activeSection === "marks") {
                  void loadSubjects();
                  void loadMarks();
                } else {
                  void refreshStudents();
                }
              }}
              disabled={
                loadingStudents ||
                loadingAttendance ||
                savingAttendance ||
                loadingSubjects ||
                loadingMarks
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                border: "1px solid #DDE9DD",
                borderRadius: "9px",
                background: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={16} />
              {loadingStudents ||
              loadingAttendance ||
              loadingSubjects ||
              loadingMarks
                ? "Loading..."
                : "Refresh"}
            </button>
          </header>

          {dashboardError && (
            <p
              role="alert"
              style={{
                color: "#B42318",
                background: "#FFF1F0",
                padding: "12px",
                borderRadius: "8px",
                overflowWrap: "anywhere",
                marginBottom: "20px",
              }}
            >
              {dashboardError}
            </p>
          )}

          {activeSection === "dashboard" && (
            <>
              <section
                style={{
                  background: "#B9E3B9",
                  color: "#24452D",
                  padding: "28px",
                  borderRadius: "16px",
                  marginBottom: "24px",
                }}
              >
                <LayoutDashboard size={30} />
                <h2 style={{ margin: "12px 0 8px" }}>
                  Welcome, Admin!
                </h2>
                <p style={{ margin: 0, lineHeight: 1.7 }}>
                  Manage students, review registrations, and access your
                  college management tools from the sidebar.
                </p>
              </section>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "18px",
                  marginBottom: "24px",
                }}
              >
                <div style={panelStyle}>
                  <Clock color="#B7791F" size={27} />
                  <p style={{ color: "#65766B", marginBottom: "6px" }}>
                    Pending Approvals
                  </p>
                  <h2 style={{ fontSize: "32px", margin: 0 }}>
                    {loadingStudents ? "..." : pendingStudents.length}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection("approvals")}
                    style={{
                      marginTop: "12px",
                      color: "#3F8D4B",
                      cursor: "pointer",
                      border: 0,
                      background: "none",
                      padding: 0,
                    }}
                  >
                    Review registrations →
                  </button>
                </div>

                <div style={panelStyle}>
                  <UserCheck color="#72B879" size={27} />
                  <p style={{ color: "#65766B", marginBottom: "6px" }}>
                    Approved Students
                  </p>
                  <h2 style={{ fontSize: "32px", margin: 0 }}>
                    {loadingStudents ? "..." : approvedStudents.length}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection("students")}
                    style={{
                      marginTop: "12px",
                      color: "#3F8D4B",
                      cursor: "pointer",
                      border: 0,
                      background: "none",
                      padding: 0,
                    }}
                  >
                    View students →
                  </button>
                </div>

                <div style={panelStyle}>
                  <BookMarked color="#72B879" size={27} />
                  <p style={{ color: "#65766B", marginBottom: "6px" }}>
                    Managed Subjects
                  </p>
                  <h2 style={{ fontSize: "32px", margin: 0 }}>
                    {subjects.length}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveSection("subjects")}
                    style={{
                      marginTop: "12px",
                      color: "#3F8D4B",
                      cursor: "pointer",
                      border: 0,
                      background: "none",
                      padding: 0,
                    }}
                  >
                    Manage subjects →
                  </button>
                </div>
              </div>

              <section style={panelStyle}>
                <h2 style={{ marginTop: 0 }}>Quick access</h2>
                <p style={{ color: "#65766B", lineHeight: 1.7 }}>
                  Choose a section from the sidebar to manage student
                  records, semester assignments, approvals, attendance,
                  marks, and subjects.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection("approvals")}
                  style={primaryButtonStyle}
                >
                  View pending approvals
                </button>
              </section>
            </>
          )}

          {activeSection === "students" && (
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Student Management</h2>
              <p style={{ color: "#65766B" }}>
                Assign each approved student to a semester from 1 to 8.
                Overall attendance is shown beside the semester assignment.
              </p>

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  maxWidth: "280px",
                  marginBottom: "18px",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "13px" }}>
                  Filter by semester
                </span>
                <select
                  value={studentSemesterFilter}
                  onChange={(event) =>
                    setStudentSemesterFilter(event.target.value)
                  }
                  style={fieldStyle}
                >
                  <option value="all">All semesters</option>
                  <option value="unassigned">Not assigned</option>
                  {semesters.map((semester) => (
                    <option key={semester} value={String(semester)}>
                      Semester {semester}
                    </option>
                  ))}
                </select>
              </label>

              {loadingStudents && approvedStudents.length === 0 ? (
                <p>Loading approved students...</p>
              ) : filteredStudents.filter((student) =>
                  studentSemesterFilter === "unassigned"
                    ? !student.semester
                    : true
                ).length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 12px" }}>
                  <Users size={40} color="#72B879" />
                  <h3>No students found</h3>
                  <p style={{ color: "#65766B" }}>
                    Approved students matching this filter will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      minWidth: "900px",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#F1F8F0" }}>
                        <th style={{ padding: "12px" }}>Student</th>
                        <th style={{ padding: "12px" }}>Registration No.</th>
                        <th style={{ padding: "12px" }}>Email</th>
                        <th style={{ padding: "12px" }}>Semester</th>
                        <th style={{ padding: "12px" }}>Overall Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents
                        .filter((student) =>
                          studentSemesterFilter === "unassigned"
                            ? !student.semester
                            : true
                        )
                        .map((student) => {
                          const percentage =
                            student.attendancePercentage ??
                            student.overallAttendancePercentage ??
                            null;

                          return (
                            <tr
                              key={student._id}
                              style={{ borderBottom: "1px solid #E1E9E3" }}
                            >
                              <td style={{ padding: "12px" }}>
                                {student.name || "Student"}
                              </td>
                              <td style={{ padding: "12px", fontWeight: 600 }}>
                                {student.registrationNumber || "—"}
                              </td>
                              <td style={{ padding: "12px" }}>
                                {student.email}
                              </td>
                              <td style={{ padding: "12px" }}>
                                <select
                                  aria-label={`Semester for ${
                                    student.name || student.email
                                  }`}
                                  value={
                                    student.semester
                                      ? String(student.semester)
                                      : ""
                                  }
                                  disabled={updatingSemesterId === student._id}
                                  onChange={(event) =>
                                    void assignSemester(
                                      student._id,
                                      event.target.value
                                    )
                                  }
                                  style={{
                                    ...fieldStyle,
                                    minWidth: "150px",
                                  }}
                                >
                                  <option value="">Not assigned</option>
                                  {semesters.map((semester) => (
                                    <option
                                      key={semester}
                                      value={String(semester)}
                                    >
                                      Semester {semester}
                                    </option>
                                  ))}
                                </select>
                                {updatingSemesterId === student._id && (
                                  <small>Saving...</small>
                                )}
                              </td>
                              <td style={{ padding: "12px" }}>
                                {percentage === null ||
                                !Number.isFinite(Number(percentage)) ? (
                                  <span style={{ color: "#65766B" }}>
                                    Not available
                                  </span>
                                ) : (
                                  <strong
                                    style={{
                                      color:
                                        Number(percentage) >= 75
                                          ? "#237A3B"
                                          : "#B42318",
                                    }}
                                  >
                                    {Number(percentage).toFixed(2)}%
                                  </strong>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "subjects" && (
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Subject Management</h2>
              <p style={{ color: "#65766B", lineHeight: 1.6 }}>
                Create and maintain subjects separately for each semester.
                Subject codes must be unique within their semester.
              </p>

              <label
                style={{
                  display: "grid",
                  gap: "6px",
                  maxWidth: "300px",
                  marginBottom: "22px",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "13px" }}>
                  Select semester
                </span>
                <select
                  value={selectedSemester}
                  onChange={(event) => {
                    setSelectedSemester(Number(event.target.value));
                    resetSubjectForm();
                    setSubjectMessage("");
                  }}
                  style={fieldStyle}
                >
                  {semesters.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </select>
              </label>

              <form
                onSubmit={(event) => void saveSubject(event)}
                style={{
                  padding: "18px",
                  background: "#F7FBF6",
                  border: "1px solid #DDE9DD",
                  borderRadius: "12px",
                  marginBottom: "24px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {editingSubjectId
                    ? "Edit subject"
                    : `Add subject — Semester ${selectedSemester}`}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      Subject name
                    </span>
                    <input
                      value={subjectName}
                      onChange={(event) => setSubjectName(event.target.value)}
                      placeholder="e.g. Database Management Systems"
                      maxLength={120}
                      required
                      style={fieldStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      Subject code
                    </span>
                    <input
                      value={subjectCode}
                      onChange={(event) =>
                        setSubjectCode(event.target.value.toUpperCase())
                      }
                      placeholder="e.g. DBMS"
                      maxLength={30}
                      required
                      style={fieldStyle}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginTop: "16px",
                  }}
                >
                  <button
                    type="submit"
                    disabled={savingSubject}
                    style={primaryButtonStyle}
                  >
                    {editingSubjectId ? (
                      <Save size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    {savingSubject
                      ? "Saving..."
                      : editingSubjectId
                        ? "Update subject"
                        : "Add subject"}
                  </button>

                  {editingSubjectId && (
                    <button
                      type="button"
                      onClick={resetSubjectForm}
                      style={{
                        ...primaryButtonStyle,
                        background: "#65766B",
                      }}
                    >
                      <X size={17} /> Cancel edit
                    </button>
                  )}
                </div>
              </form>

              {subjectMessage && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background:
                      subjectMessageType === "success"
                        ? "#E2F6E6"
                        : "#FFF0EF",
                    color:
                      subjectMessageType === "success"
                        ? "#237A3B"
                        : "#B42318",
                    overflowWrap: "anywhere",
                  }}
                >
                  {subjectMessage}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  margin: "22px 0 12px",
                }}
              >
                <h3 style={{ margin: 0 }}>
                  Semester {selectedSemester} subjects ({subjects.length})
                </h3>
                <button
                  type="button"
                  onClick={() => void loadSubjects()}
                  disabled={loadingSubjects}
                  style={{
                    ...primaryButtonStyle,
                    background: "#FFFFFF",
                    color: "#3F8D4B",
                    border: "1px solid #DDE9DD",
                  }}
                >
                  <RefreshCw size={16} /> Refresh subjects
                </button>
              </div>

              {loadingSubjects ? (
                <p>Loading subjects...</p>
              ) : subjects.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "30px 12px",
                    background: "#F7FBF6",
                    borderRadius: "12px",
                  }}
                >
                  <BookMarked size={40} color="#72B879" />
                  <h3>
                    No subjects added for Semester {selectedSemester}
                  </h3>
                  <p style={{ color: "#65766B" }}>
                    Use the form above to add the first subject.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      minWidth: "600px",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#F1F8F0" }}>
                        <th style={{ padding: "13px" }}>#</th>
                        <th style={{ padding: "13px" }}>Subject name</th>
                        <th style={{ padding: "13px" }}>Subject code</th>
                        <th style={{ padding: "13px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject, index) => (
                        <tr
                          key={subject._id}
                          style={{ borderBottom: "1px solid #E1E9E3" }}
                        >
                          <td style={{ padding: "13px" }}>{index + 1}</td>
                          <td style={{ padding: "13px", fontWeight: 600 }}>
                            {subject.name}
                          </td>
                          <td style={{ padding: "13px" }}>{subject.code}</td>
                          <td style={{ padding: "13px" }}>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => startEditingSubject(subject)}
                                style={{
                                  ...primaryButtonStyle,
                                  padding: "8px 10px",
                                  background: "#E2F6E6",
                                  color: "#237A3B",
                                }}
                              >
                                <Pencil size={15} /> Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => void deleteSubject(subject)}
                                disabled={deletingSubjectId === subject._id}
                                style={{
                                  ...primaryButtonStyle,
                                  padding: "8px 10px",
                                  background: "#FFF0EF",
                                  color: "#B42318",
                                }}
                              >
                                <Trash2 size={15} />
                                {deletingSubjectId === subject._id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "approvals" && (
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Pending Student Approvals</h2>
              <p style={{ color: "#65766B" }}>
                Review new registrations and approve student accounts.
              </p>

              {loadingStudents && pendingStudents.length === 0 ? (
                <p>Loading pending students...</p>
              ) : pendingStudents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 12px" }}>
                  <CheckCircle size={42} color="#72B879" />
                  <h3>No pending students</h3>
                  <p style={{ color: "#65766B" }}>
                    New registrations awaiting approval will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      minWidth: "650px",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#F1F8F0" }}>
                        <th style={{ padding: "14px" }}>Student</th>
                        <th style={{ padding: "14px" }}>Registration No.</th>
                        <th style={{ padding: "14px" }}>Email</th>
                        <th style={{ padding: "14px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingStudents.map((student) => (
                        <tr
                          key={student._id}
                          style={{ borderBottom: "1px solid #E1E9E3" }}
                        >
                          <td style={{ padding: "14px" }}>
                            {student.name || "Student"}
                          </td>
                          <td style={{ padding: "14px", fontWeight: 600 }}>
                            {student.registrationNumber || "—"}
                          </td>
                          <td style={{ padding: "14px" }}>{student.email}</td>
                          <td style={{ padding: "14px" }}>
                            <button
                              type="button"
                              onClick={() => void handleApprove(student._id)}
                              disabled={approvingId !== null}
                              style={primaryButtonStyle}
                            >
                              <CheckCircle size={16} />
                              {approvingId === student._id
                                ? "Approving..."
                                : "Approve"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "attendance" && (
            <section style={panelStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2 style={{ margin: "0 0 8px" }}>Daily Attendance</h2>
                  <p style={{ margin: 0, color: "#65766B" }}>
                    Select a semester and date before marking attendance.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      Select semester
                    </span>
                    <select
                      value={attendanceSemester}
                      onChange={(event) => {
                        const value = event.target.value;
                        const nextSemester = value === "" ? "" : Number(value);

                        setAttendanceSemester(nextSemester);
                        setAttendanceStudents([]);
                        setAttendanceLocked(
                          nextSemester !== "" &&
                            Boolean(
                              submittedAttendanceKeys[
                                `${attendanceDate}__semester_${nextSemester}`
                              ]
                            )
                        );
                        setAttendanceMessage("");
                        setAttendanceMessageType("");
                      }}
                      style={{
                        ...fieldStyle,
                        minWidth: "170px",
                      }}
                    >
                      <option value="">Select semester first</option>
                      {semesters.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      Select date
                    </span>
                    <input
                      type="date"
                      value={attendanceDate}
                      max={getLocalDate()}
                      onChange={(event) => {
                        const nextDate = event.target.value;

                        setAttendanceDate(nextDate);
                        setAttendanceLocked(
                          attendanceSemester !== "" &&
                            Boolean(
                              submittedAttendanceKeys[
                                `${nextDate}__semester_${attendanceSemester}`
                              ]
                            )
                        );
                        setAttendanceMessage("");
                        setAttendanceMessageType("");
                      }}
                      style={fieldStyle}
                    />
                  </label>
                </div>
              </div>

              {attendanceSemester === "" ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 12px",
                    background: "#F7FBF6",
                    borderRadius: "12px",
                  }}
                >
                  <CalendarCheck size={42} color="#72B879" />
                  <h3>Select a semester to continue</h3>
                  <p style={{ color: "#65766B" }}>
                    Attendance can only be marked after selecting a semester.
                  </p>
                </div>
              ) : (
                <>
                  {attendanceLocked && (
                    <div
                      role="status"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "14px",
                        marginBottom: "18px",
                        borderRadius: "10px",
                        border: "1px solid #B9DDBD",
                        background: "#E2F6E6",
                        color: "#237A3B",
                      }}
                    >
                      <CheckCircle size={20} />
                      <div>
                        <strong>Attendance already submitted</strong>
                        <p style={{ margin: "5px 0 0", lineHeight: 1.6 }}>
                          Attendance for Semester {attendanceSemester} on{" "}
                          {attendanceDate} has already been submitted.
                          Editing and resubmission are disabled for this
                          semester and date only.
                        </p>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: "12px",
                      marginBottom: "22px",
                    }}
                  >
                    {[
                      {
                        label: "Present",
                        count: attendanceCounts.present,
                        color: "#237A3B",
                        background: "#E2F6E6",
                      },
                      {
                        label: "Absent",
                        count: attendanceCounts.absent,
                        color: "#B42318",
                        background: "#FFF0EF",
                      },
                      {
                        label: "Late",
                        count: attendanceCounts.late,
                        color: "#925D08",
                        background: "#FFF4D9",
                      },
                      {
                        label: "Not Marked",
                        count: attendanceCounts.unmarked,
                        color: "#56675C",
                        background: "#F0F3F0",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: "16px",
                          borderRadius: "12px",
                          background: item.background,
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 8px",
                            fontSize: "13px",
                            color: item.color,
                          }}
                        >
                          {item.label}
                        </p>
                        <h2
                          style={{
                            margin: 0,
                            color: item.color,
                            fontSize: "26px",
                          }}
                        >
                          {item.count}
                        </h2>
                      </div>
                    ))}
                  </div>

                  {attendanceMessage && (
                    <p
                      role="status"
                      aria-live="polite"
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background:
                          attendanceMessageType === "success"
                            ? "#E2F6E6"
                            : "#FFF0EF",
                        color:
                          attendanceMessageType === "success"
                            ? "#237A3B"
                            : "#B42318",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {attendanceMessage}
                    </p>
                  )}

                  {loadingAttendance ? (
                    <p>Loading attendance...</p>
                  ) : attendanceStudents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "36px 12px" }}>
                      <Users size={42} color="#72B879" />
                      <h3>
                        No students assigned to Semester {attendanceSemester}
                      </h3>
                      <p style={{ color: "#65766B" }}>
                        Approve students and assign them to this semester in
                        Student Management before marking attendance.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            textAlign: "left",
                            minWidth: "850px",
                          }}
                        >
                          <thead>
                            <tr style={{ background: "#F1F8F0" }}>
                              <th style={{ padding: "13px" }}>Student</th>
                              <th style={{ padding: "13px" }}>
                                Registration No.
                              </th>
                              <th style={{ padding: "13px" }}>
                                Overall Attendance
                              </th>
                              <th style={{ padding: "13px" }}>
                                Attendance Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceStudents.map((student) => (
                              <tr
                                key={student._id}
                                style={{
                                  borderBottom: "1px solid #E1E9E3",
                                }}
                              >
                                <td style={{ padding: "13px" }}>
                                  <strong>{student.name || "Student"}</strong>
                                  <p
                                    style={{
                                      fontSize: "12px",
                                      color: "#65766B",
                                      margin: "4px 0 0",
                                    }}
                                  >
                                    {student.email}
                                  </p>
                                </td>

                                <td style={{ padding: "13px" }}>
                                  {student.registrationNumber || "—"}
                                </td>

                                <td style={{ padding: "13px" }}>
                                  {student.attendancePercentage === null ? (
                                    <span style={{ color: "#65766B" }}>
                                      Not available
                                    </span>
                                  ) : (
                                    <strong
                                      style={{
                                        color:
                                          student.attendancePercentage >= 75
                                            ? "#237A3B"
                                            : "#B42318",
                                      }}
                                    >
                                      {student.attendancePercentage.toFixed(2)}
                                      %
                                    </strong>
                                  )}
                                </td>

                                <td style={{ padding: "13px" }}>
                                  <select
                                    value={student.attendanceStatus}
                                    aria-label={`Attendance status for ${
                                      student.name || student.email
                                    }`}
                                    disabled={
                                      attendanceLocked ||
                                      Boolean(
                                        attendanceKey &&
                                          submittedAttendanceKeys[attendanceKey]
                                      ) ||
                                      loadingAttendance ||
                                      savingAttendance
                                    }
                                    onChange={(event) =>
                                      updateAttendanceStatus(
                                        student._id,
                                        event.target.value as AttendanceStatus
                                      )
                                    }
                                    style={{
                                      ...fieldStyle,
                                      width: "155px",
                                      cursor: attendanceLocked
                                        ? "not-allowed"
                                        : "pointer",
                                      opacity: attendanceLocked ? 0.7 : 1,
                                      background:
                                        student.attendanceStatus === "Present"
                                          ? "#E2F6E6"
                                          : student.attendanceStatus ===
                                              "Absent"
                                            ? "#FFF0EF"
                                            : student.attendanceStatus ===
                                                "Late"
                                              ? "#FFF4D9"
                                              : "#FFFFFF",
                                    }}
                                  >
                                    <option value="Not Marked">
                                      Not Marked
                                    </option>
                                    <option value="Present">Present</option>
                                    <option value="Absent">Absent</option>
                                    <option value="Late">Late</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                          marginTop: "22px",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            color: "#65766B",
                            fontSize: "13px",
                          }}
                        >
                          Semester {attendanceSemester} ·{" "}
                          {attendanceStudents.length} student(s) ·{" "}
                          {attendanceDate}
                        </p>

                        <button
                          type="button"
                          onClick={() => void saveAttendance()}
                          disabled={
                            attendanceLocked ||
                            Boolean(
                              attendanceKey &&
                                submittedAttendanceKeys[attendanceKey]
                            ) ||
                            savingAttendance ||
                            loadingAttendance
                          }
                          style={{
                            ...primaryButtonStyle,
                            background: attendanceLocked
                              ? "#65766B"
                              : "#72B879",
                            opacity: attendanceLocked ? 0.8 : 1,
                            cursor: attendanceLocked
                              ? "not-allowed"
                              : "pointer",
                          }}
                        >
                          {attendanceLocked ? (
                            <CheckCircle size={18} />
                          ) : (
                            <Save size={18} />
                          )}

                          {attendanceLocked
                            ? "Attendance Already Submitted"
                            : savingAttendance
                              ? "Saving..."
                              : "Save Attendance"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}

          {activeSection === "marks" && (
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Subject-wise Marks Entry</h2>
              <p style={{ color: "#65766B", lineHeight: 1.7 }}>
                Select a semester, student, and subject. Existing marks for
                that student and subject will load automatically and can be
                updated.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "22px",
                }}
              >
                <label style={{ display: "grid", gap: "7px" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>
                    Semester
                  </span>
                  <select
                    value={selectedSemester}
                    onChange={(event) => {
                      setSelectedSemester(Number(event.target.value));
                      setMarkStudentId("");
                      setMarkSubjectId("");
                      setMarksMessage("");
                      setMarksMessageType("");
                    }}
                    style={fieldStyle}
                  >
                    {semesters.map((semester) => (
                      <option key={semester} value={semester}>
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: "7px" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>
                    Student
                  </span>
                  <select
                    value={markStudentId}
                    onChange={(event) => {
                      setMarkStudentId(event.target.value);
                      setMarksMessage("");
                      setMarksMessageType("");
                    }}
                    style={fieldStyle}
                    required
                  >
                    <option value="">Select a student</option>
                    {semesterMarkStudents.map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.name || "Student"} —{" "}
                        {student.registrationNumber || student.email}
                        {!student.semester
                          ? " (semester not assigned)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: "7px" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>
                    Subject
                  </span>
                  <select
                    value={markSubjectId}
                    onChange={(event) => {
                      setMarkSubjectId(event.target.value);
                      setMarksMessage("");
                      setMarksMessageType("");
                    }}
                    style={fieldStyle}
                    required
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject._id} value={subject._id}>
                        {subject.name} ({subject.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {marksMessage && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background:
                      marksMessageType === "success"
                        ? "#E2F6E6"
                        : "#FFF0EF",
                    color:
                      marksMessageType === "success"
                        ? "#237A3B"
                        : "#B42318",
                    overflowWrap: "anywhere",
                  }}
                >
                  {marksMessage}
                </p>
              )}

              {loadingMarks && (
                <p style={{ color: "#65766B" }}>
                  Loading saved marks...
                </p>
              )}

              {subjects.length === 0 && !loadingSubjects && (
                <p
                  style={{
                    color: "#B42318",
                    background: "#FFF0EF",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  No subjects are available for Semester {selectedSemester}.
                  Add subjects in the Subjects section first.
                </p>
              )}

              {approvedStudents.length === 0 && !loadingStudents && (
                <p
                  style={{
                    color: "#B42318",
                    background: "#FFF0EF",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  No approved students are available. Approve a student
                  before entering marks.
                </p>
              )}

              <form onSubmit={(event) => void saveMarks(event)}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {(
                    [
                      { key: "assignment1", label: "Assignment 1", max: 10 },
                      { key: "assignment2", label: "Assignment 2", max: 10 },
                      { key: "mid1", label: "Mid Exam 1", max: 30 },
                      { key: "mid2", label: "Mid Exam 2", max: 30 },
                      {
                        key: "attendancePercentage",
                        label: "Attendance Percentage",
                        max: 100,
                      },
                      { key: "seeMarks", label: "SEE Marks", max: 60 },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      style={{ display: "grid", gap: "7px" }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        {item.label} (Max {item.max})
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={item.max}
                        step="any"
                        required
                        value={markForm[item.key]}
                        onChange={(event) => {
                          setMarkForm((current) => ({
                            ...current,
                            [item.key]: event.target.value,
                          }));
                          setMarksMessage("");
                          setMarksMessageType("");
                        }}
                        style={fieldStyle}
                      />
                    </label>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginTop: "22px",
                  }}
                >
                  <button
                    type="submit"
                    disabled={
                      savingMarks ||
                      loadingMarks ||
                      !markStudentId ||
                      !markSubjectId
                    }
                    style={{
                      ...primaryButtonStyle,
                      opacity:
                        savingMarks ||
                        loadingMarks ||
                        !markStudentId ||
                        !markSubjectId
                          ? 0.65
                          : 1,
                    }}
                  >
                    <Save size={17} />
                    {savingMarks
                      ? "Saving marks..."
                      : selectedMarkRecord
                        ? "Update Marks"
                        : "Save Marks"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMarkForm({ ...emptyMarkForm });
                      setMarksMessage("");
                      setMarksMessageType("");
                    }}
                    style={{
                      ...primaryButtonStyle,
                      background: "#65766B",
                    }}
                  >
                    <X size={17} /> Clear form
                  </button>
                </div>
              </form>

              <div style={{ marginTop: "28px" }}>
                <h3>Saved Marks — Semester {selectedSemester}</h3>

                {markRecords.length === 0 && !loadingMarks ? (
                  <p style={{ color: "#65766B" }}>
                    No marks have been saved for this semester yet.
                  </p>
                ) : markRecords.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        textAlign: "left",
                        minWidth: "850px",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#F1F8F0" }}>
                          <th style={{ padding: "12px" }}>Student ID</th>
                          <th style={{ padding: "12px" }}>Subject ID</th>
                          <th style={{ padding: "12px" }}>Assignment 1</th>
                          <th style={{ padding: "12px" }}>Assignment 2</th>
                          <th style={{ padding: "12px" }}>Mid 1</th>
                          <th style={{ padding: "12px" }}>Mid 2</th>
                          <th style={{ padding: "12px" }}>Attendance %</th>
                          <th style={{ padding: "12px" }}>SEE</th>
                          <th style={{ padding: "12px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {markRecords.map((record) => (
                          <tr
                            key={record._id}
                            style={{ borderBottom: "1px solid #E1E9E3" }}
                          >
                            <td style={{ padding: "12px" }}>
                              {getRelatedId(record.studentId).slice(-8)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              {getRelatedId(record.subjectId).slice(-8)}
                            </td>
                            <td style={{ padding: "12px" }}>
                              {record.assignment1}
                            </td>
                            <td style={{ padding: "12px" }}>
                              {record.assignment2}
                            </td>
                            <td style={{ padding: "12px" }}>
                              {record.mid1}
                            </td>
                            <td style={{ padding: "12px" }}>
                              {record.mid2}
                            </td>
                            <td style={{ padding: "12px" }}>
                              {record.attendancePercentage}%
                            </td>
                            <td style={{ padding: "12px" }}>
                              {record.seeMarks}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setMarkStudentId(
                                    getRelatedId(record.studentId)
                                  );
                                  setMarkSubjectId(
                                    getRelatedId(record.subjectId)
                                  );
                                  setMarkForm({
                                    assignment1: String(
                                      record.assignment1 ?? 0
                                    ),
                                    assignment2: String(
                                      record.assignment2 ?? 0
                                    ),
                                    mid1: String(record.mid1 ?? 0),
                                    mid2: String(record.mid2 ?? 0),
                                    attendancePercentage: String(
                                      record.attendancePercentage ?? 0
                                    ),
                                    seeMarks: String(record.seeMarks ?? 0),
                                  });
                                  setMarksMessage("");
                                  setMarksMessageType("");
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  });
                                }}
                                style={{
                                  ...primaryButtonStyle,
                                  padding: "8px 10px",
                                }}
                              >
                                <Pencil size={15} /> Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {![
            "dashboard",
            "students",
            "approvals",
            "attendance",
            "subjects",
            "marks",
          ].includes(activeSection) && (
            <section style={panelStyle}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  background: "#DDF3DF",
                  color: "#3F8D4B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "18px",
                }}
              >
                {activeSection === "calculation" && (
                  <Calculator size={28} />
                )}
                {activeSection === "attendance-chart" && (
                  <ChartPie size={28} />
                )}
              </div>

              <h2 style={{ marginTop: 0 }}>
                {navItems.find((item) => item.id === activeSection)?.label}
              </h2>
              <p style={{ color: "#65766B", lineHeight: 1.7 }}>
                This section will be connected to the semester and subject
                data next. Marks calculation remains separate until the
                calculation rules are implemented.
              </p>

              {activeSection === "attendance-chart" && (
                <p style={{ color: "#65766B" }}>
                  The attendance pie chart remains set aside until the
                  underlying attendance data is ready.
                </p>
              )}
            </section>
          )}

          <p
            style={{
              textAlign: "center",
              color: "#65766B",
              marginTop: "28px",
              fontSize: "13px",
            }}
          >
            CampusConnect · College Student Management System
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="welcome-panel">
          <div className="brand">
            <div className="brand-icon">
              <GraduationCap size={30} />
            </div>
            <span>
              Campus<span className="brand-highlight">Connect</span>
            </span>
          </div>

          <div className="welcome-content">
            <span className="welcome-tag">
              COLLEGE MANAGEMENT PORTAL
            </span>
            <h1>
              Your campus.
              <br />
              Your future.
              <br />
              <span>One platform.</span>
            </h1>
            <p>
              A smarter way to manage student information, academic records,
              attendance, and college activities.
            </p>

            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3>Academic Records</h3>
                  <p>Manage marks and subject details.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">
                  <Users size={20} />
                </div>
                <div>
                  <h3>Student Management</h3>
                  <p>Keep student information organized.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3>Secure Access</h3>
                  <p>Separate access for admins and students.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="welcome-footer">
            © 2026 CampusConnect · College Student Management
          </div>
        </section>

        <section className="form-panel">
          <div className="mobile-brand">
            <GraduationCap size={30} />
            <span>CampusConnect</span>
          </div>

          <div className="form-wrapper">
            <div className="form-heading">
              <span className="form-eyebrow">
                {isRegister ? "JOIN OUR CAMPUS" : "WELCOME BACK"}
              </span>
              <h2>
                {isRegister
                  ? "Create student account"
                  : role === "admin"
                    ? "Admin sign in"
                    : "Student sign in"}
              </h2>
              <p>
                {isRegister
                  ? "Register to access your college portal."
                  : role === "admin"
                    ? "Sign in to manage your college."
                    : "Sign in to access your student dashboard."}
              </p>
            </div>

            <div className="role-selector">
              <button
                type="button"
                className={`role-option ${
                  role === "admin" ? "selected" : ""
                }`}
                onClick={() => handleRoleChange("admin")}
              >
                <ShieldCheck size={18} />
                <span>Admin</span>
              </button>

              <button
                type="button"
                className={`role-option ${
                  role === "student" ? "selected" : ""
                }`}
                onClick={() => handleRoleChange("student")}
              >
                <GraduationCap size={18} />
                <span>Student</span>
              </button>
            </div>

            {role === "student" && (
              <div className="auth-tabs">
                <button
                  type="button"
                  className={!isRegister ? "active" : ""}
                  onClick={() => {
                    setIsRegister(false);
                    setMessage("");
                    setMessageType("");
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={isRegister ? "active" : ""}
                  onClick={() => {
                    setIsRegister(true);
                    setMessage("");
                    setMessageType("");
                  }}
                >
                  Register
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <label className="field">
                  <span>Full name</span>
                  <div className="input-wrapper">
                    <User size={19} />
                    <input
                      type="text"
                      name="name"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>
              )}

              <label className="field">
                <span>
                  {isRegister
                    ? "Email address"
                    : "Email or registration number"}
                </span>
                <div className="input-wrapper">
                  {role === "student" && !isRegister ? (
                    <Hash size={19} />
                  ) : (
                    <Mail size={19} />
                  )}
                  <input
                    type={
                      role === "admin" || isRegister ? "email" : "text"
                    }
                    name="email"
                    placeholder={
                      role === "admin"
                        ? "Enter admin email"
                        : isRegister
                          ? "Enter your email"
                          : "Email or registration number"
                    }
                    autoComplete="username"
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Password</span>
                <div className="input-wrapper">
                  <Lock size={19} />
                  <input
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    minLength={isRegister ? 8 : 1}
                    required
                  />
                </div>
              </label>

              {isRegister && (
                <label className="field">
                  <span>Confirm password</span>
                  <div className="input-wrapper">
                    <Lock size={19} />
                    <input
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>
              )}

              {!isRegister && (
                <div className="form-options">
                  <label className="remember-option">
                    <input type="checkbox" name="remember" />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      alert("Password recovery will be added later.")
                    }
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {message && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    color: messageType === "success" ? "green" : "crimson",
                    margin: "12px 0",
                    overflowWrap: "anywhere",
                  }}
                >
                  {message}
                </p>
              )}

              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isRegister
                    ? "Create student account"
                    : role === "admin"
                      ? "Admin sign in"
                      : "Student sign in"}
                {!loading && <ArrowRight size={19} />}
              </button>
            </form>

            {role === "student" && (
              <p className="switch-account">
                {isRegister
                  ? "Already have an account?"
                  : "New to CampusConnect?"}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setMessage("");
                    setMessageType("");
                  }}
                >
                  {isRegister ? "Sign in" : "Create an account"}
                </button>
              </p>
            )}

            {role === "admin" && (
              <p className="admin-note">
                Admin access is restricted to authorized administrators.
              </p>
            )}

            <div className="form-divider">
              <span>COLLEGE STUDENT MANAGEMENT SYSTEM</span>
            </div>
          </div>

          <div className="security-note">
            <ShieldCheck size={16} />
            Secure portal access
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;