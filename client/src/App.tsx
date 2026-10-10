
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
  createdAt?: string;
};

type AttendanceStudent = Student & {
  attendanceStatus: AttendanceStatus;
};

type Subject = {
  _id: string;
  name: string;
  code: string;
  semester: number;
  createdBy?: string;
};

function getLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

async function readResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The server returned an invalid response. Check the backend terminal.");
  }
}

function App() {
  const [role, setRole] = useState<Role>("student");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [dashboardRole, setDashboardRole] = useState<Role | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");

  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState("");

  // Semester assignment
  const [studentSemesterFilter, setStudentSemesterFilter] = useState("all");
  const [updatingSemesterId, setUpdatingSemesterId] = useState<string | null>(null);

  // Dynamic subjects
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectMessage, setSubjectMessage] = useState("");
  const [subjectMessageType, setSubjectMessageType] = useState<"success" | "error" | "">("");
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);

  // Attendance
  const [attendanceDate, setAttendanceDate] = useState(getLocalDate());
  const [attendanceStudents, setAttendanceStudents] = useState<AttendanceStudent[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceMessageType, setAttendanceMessageType] = useState<"success" | "error" | "">("");

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

  const showSubjectMessage = (text: string, type: "success" | "error") => {
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
      if (!response.ok) throw new Error(data.message || "Unable to load pending students.");
      setPendingStudents(data.students || []);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to load pending students.");
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
      if (!response.ok) throw new Error(data.message || "Unable to load students.");
      setApprovedStudents(data.students || []);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to load students.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const refreshStudents = async () => {
    await Promise.all([loadPendingStudents(), loadApprovedStudents()]);
  };

  // Assign a student to a semester or clear the assignment.
  const assignSemester = async (studentId: string, semesterValue: string) => {
    const token = getToken();
    if (!token) {
      setDashboardError("Please log in again to continue.");
      return;
    }

    const semester = semesterValue === "" ? null : Number(semesterValue);
    setUpdatingSemesterId(studentId);
    setDashboardError("");

    try {
      const response = await fetch(`/api/admin/students/${studentId}/semester`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ semester }),
      });

      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to update semester.");

      setApprovedStudents((current) =>
        current.map((student) =>
          student._id === studentId ? data.student : student
        )
      );
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to update semester.");
      await loadApprovedStudents();
    } finally {
      setUpdatingSemesterId(null);
    }
  };

  // Load subjects for the selected semester.
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
      const response = await fetch(`/api/subjects?semester=${selectedSemester}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to load subjects.");
      setSubjects(data.subjects || []);
    } catch (error) {
      showSubjectMessage(error instanceof Error ? error.message : "Unable to load subjects.", "error");
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
      showSubjectMessage("Enter both the subject name and subject code.", "error");
      return;
    }

    setSavingSubject(true);
    setSubjectMessage("");

    try {
      const isEditing = editingSubjectId !== null;
      const response = await fetch(
        isEditing ? `/api/subjects/${editingSubjectId}` : "/api/subjects",
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
      if (!response.ok) throw new Error(data.message || "Unable to save subject.");

      showSubjectMessage(data.message || "Subject saved successfully.", "success");
      resetSubjectForm();
      await loadSubjects();
    } catch (error) {
      showSubjectMessage(error instanceof Error ? error.message : "Unable to save subject.", "error");
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
    if (!window.confirm(`Delete ${subject.name} (${subject.code})?`)) return;

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
      if (!response.ok) throw new Error(data.message || "Unable to delete subject.");

      setSubjects((current) => current.filter((item) => item._id !== subject._id));
      if (editingSubjectId === subject._id) resetSubjectForm();
      showSubjectMessage(data.message || "Subject deleted successfully.", "success");
    } catch (error) {
      showSubjectMessage(error instanceof Error ? error.message : "Unable to delete subject.", "error");
    } finally {
      setDeletingSubjectId(null);
    }
  };

  const loadAttendance = async () => {
    const token = getToken();
    if (!token) {
      setAttendanceMessage("Please log in again to continue.");
      setAttendanceMessageType("error");
      return;
    }

    setLoadingAttendance(true);
    setAttendanceMessage("");
    setAttendanceMessageType("");

    try {
      const response = await fetch(
        `/api/admin/attendance?date=${encodeURIComponent(attendanceDate)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to load attendance.");
      setAttendanceStudents(data.attendance || []);
    } catch (error) {
      setAttendanceMessage(error instanceof Error ? error.message : "Unable to load attendance.");
      setAttendanceMessageType("error");
    } finally {
      setLoadingAttendance(false);
    }
  };

  const updateAttendanceStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceStudents((current) =>
      current.map((student) =>
        student._id === studentId ? { ...student, attendanceStatus: status } : student
      )
    );
    setAttendanceMessage("");
    setAttendanceMessageType("");
  };

  const saveAttendance = async () => {
    const token = getToken();
    if (!token) {
      setAttendanceMessage("Please log in again to continue.");
      setAttendanceMessageType("error");
      return;
    }

    if (attendanceStudents.length === 0) {
      setAttendanceMessage("There are no students to save attendance for.");
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
      setAttendanceMessage("Please mark at least one student before saving.");
      setAttendanceMessageType("error");
      return;
    }

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
        body: JSON.stringify({ date: attendanceDate, records }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to save attendance.");

      setAttendanceMessage(`${data.message || "Attendance saved successfully."} (${data.savedCount ?? records.length} records)`);
      setAttendanceMessageType("success");
      await loadAttendance();
    } catch (error) {
      setAttendanceMessage(error instanceof Error ? error.message : "Unable to save attendance.");
      setAttendanceMessageType("error");
    } finally {
      setSavingAttendance(false);
    }
  };

  useEffect(() => {
    if (dashboardRole === "admin") void refreshStudents();
  }, [dashboardRole]);

  useEffect(() => {
    if (dashboardRole === "admin" && activeSection === "attendance") {
      void loadAttendance();
    }
  }, [dashboardRole, activeSection, attendanceDate]);

  useEffect(() => {
    if (dashboardRole === "admin" && activeSection === "subjects") {
      void loadSubjects();
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
      const response = await fetch(`/api/admin/students/${studentId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Unable to approve student.");

      setPendingStudents((current) => current.filter((student) => student._id !== studentId));
      await loadApprovedStudents();
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Unable to approve student.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setDashboardRole(null);
    setActiveSection("dashboard");
    setPendingStudents([]);
    setApprovedStudents([]);
    setDashboardError("");
    setAttendanceStudents([]);
    setAttendanceMessage("");
    setSubjects([]);
    resetSubjectForm();
    setMessage("");
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
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (isRegister && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { name, email, password }
        : { identifier: email, password, role };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");

      if (isRegister) {
        setMessage(`Registration successful! Your registration number is ${data.registrationNumber}. Your account is awaiting admin approval.`);
        setMessageType("success");
        setIsRegister(false);
        form.reset();
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        if (data.user.role === "admin") {
          setDashboardRole("admin");
          setActiveSection("dashboard");
        } else {
          setMessage("Login successful! Welcome Student.");
          setMessageType("success");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect to the server.");
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
    present: attendanceStudents.filter((student) => student.attendanceStatus === "Present").length,
    absent: attendanceStudents.filter((student) => student.attendanceStatus === "Absent").length,
    late: attendanceStudents.filter((student) => student.attendanceStatus === "Late").length,
    unmarked: attendanceStudents.filter((student) => student.attendanceStatus === "Not Marked").length,
  };

  if (dashboardRole === "admin") {
    const filteredStudents = studentSemesterFilter === "all"
      ? approvedStudents
      : approvedStudents.filter((student) => String(student.semester ?? "") === studentSemesterFilter);

    return (
      <div style={{ minHeight: "100vh", background: "#F1F8F0", color: "#24452D", display: "flex", flexWrap: "wrap" }}>
        <aside style={{ width: "245px", flexShrink: 0, background: "#FFFFFF", borderRight: "1px solid #DDE9DD", padding: "24px 16px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "#72B879", color: "#FFFFFF", padding: "9px", borderRadius: "10px", display: "flex" }}>
              <GraduationCap size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "19px" }}>CampusConnect</h2>
              <p style={{ margin: "4px 0 0", color: "#65766B", fontSize: "12px" }}>Admin Portal</p>
            </div>
          </div>

          <div>
            <p style={{ color: "#87948B", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", paddingLeft: "12px" }}>MAIN MENU</p>
            <nav style={{ display: "grid", gap: "6px" }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const selected = activeSection === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px", border: 0, borderRadius: "9px", textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: selected ? "#3F8D4B" : "#56675C", background: selected ? "#DDF3DF" : "transparent" }}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.id === "approvals" && pendingStudents.length > 0 && (
                      <span style={{ marginLeft: "auto", background: "#FFF0D6", color: "#925D08", borderRadius: "20px", padding: "2px 7px", fontSize: "12px" }}>{pendingStudents.length}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div style={{ marginTop: "auto" }}>
            <button type="button" onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px", border: 0, borderRadius: "9px", background: "#FFF1F0", color: "#B42318", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>
              <LogOut size={18} /> Logout
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: "280px", padding: "28px", boxSizing: "border-box" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "28px" }}>
            <div>
              <p style={{ margin: "0 0 5px", color: "#65766B", fontSize: "13px" }}>CampusConnect / Admin</p>
              <h1 style={{ margin: 0, fontSize: "27px" }}>{navItems.find((item) => item.id === activeSection)?.label}</h1>
            </div>
            <button type="button" onClick={() => {
              if (activeSection === "attendance") void loadAttendance();
              else if (activeSection === "subjects") void loadSubjects();
              else void refreshStudents();
            }} disabled={loadingStudents || loadingAttendance || savingAttendance || loadingSubjects} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", border: "1px solid #DDE9DD", borderRadius: "9px", background: "#FFFFFF", cursor: "pointer" }}>
              <RefreshCw size={16} />
              {loadingStudents || loadingAttendance || loadingSubjects ? "Loading..." : "Refresh"}
            </button>
          </header>

          {dashboardError && <p role="alert" style={{ color: "#B42318", background: "#FFF1F0", padding: "12px", borderRadius: "8px", overflowWrap: "anywhere", marginBottom: "20px" }}>{dashboardError}</p>}

          {activeSection === "dashboard" && (
            <>
              <section style={{ background: "#B9E3B9", color: "#24452D", padding: "28px", borderRadius: "16px", marginBottom: "24px" }}>
                <LayoutDashboard size={30} />
                <h2 style={{ margin: "12px 0 8px" }}>Welcome, Admin!</h2>
                <p style={{ margin: 0, lineHeight: 1.7 }}>Manage students, review registrations, and access your college management tools from the sidebar.</p>
              </section>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "18px", marginBottom: "24px" }}>
                <div style={panelStyle}>
                  <Clock color="#B7791F" size={27} />
                  <p style={{ color: "#65766B", marginBottom: "6px" }}>Pending Approvals</p>
                  <h2 style={{ fontSize: "32px", margin: 0 }}>{loadingStudents ? "..." : pendingStudents.length}</h2>
                  <button type="button" onClick={() => setActiveSection("approvals")} style={{ marginTop: "12px", color: "#3F8D4B", cursor: "pointer", border: 0, background: "none", padding: 0 }}>Review registrations →</button>
                </div>
                <div style={panelStyle}>
                  <UserCheck color="#72B879" size={27} />
                  <p style={{ color: "#65766B", marginBottom: "6px" }}>Approved Students</p>
                  <h2 style={{ fontSize: "32px", margin: 0 }}>{loadingStudents ? "..." : approvedStudents.length}</h2>
                  <button type="button" onClick={() => setActiveSection("students")} style={{ marginTop: "12px", color: "#3F8D4B", cursor: "pointer", border: 0, background: "none", padding: 0 }}>View students →</button>
                </div>
                <div style={panelStyle}>
                  <BookMarked color="#72B879" size={27} />
                  <p style={{ color: "#65766B", marginBottom: "6px" }}>Managed Subjects</p>
                  <h2 style={{ fontSize: "32px", margin: 0 }}>{subjects.length}</h2>
                  <button type="button" onClick={() => setActiveSection("subjects")} style={{ marginTop: "12px", color: "#3F8D4B", cursor: "pointer", border: 0, background: "none", padding: 0 }}>Manage subjects →</button>
                </div>
              </div>
              <section style={panelStyle}>
                <h2 style={{ marginTop: 0 }}>Quick access</h2>
                <p style={{ color: "#65766B", lineHeight: 1.7 }}>Choose a section from the sidebar to manage student records, semester assignments, approvals, attendance, marks, and subjects.</p>
                <button type="button" onClick={() => setActiveSection("approvals")} style={primaryButtonStyle}>View pending approvals</button>
              </section>
            </>
          )}

          {activeSection === "students" && (
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Student Management</h2>
              <p style={{ color: "#65766B" }}>Assign each approved student to a semester from 1 to 8.</p>

              <label style={{ display: "grid", gap: "6px", maxWidth: "280px", marginBottom: "18px" }}>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Filter by semester</span>
                <select value={studentSemesterFilter} onChange={(event) => setStudentSemesterFilter(event.target.value)} style={fieldStyle}>
                  <option value="all">All semesters</option>
                  <option value="unassigned">Not assigned</option>
                  {semesters.map((semester) => <option key={semester} value={String(semester)}>Semester {semester}</option>)}
                </select>
              </label>

              {loadingStudents && approvedStudents.length === 0 ? <p>Loading approved students...</p> : filteredStudents.filter((student) => studentSemesterFilter === "unassigned" ? !student.semester : true).length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 12px" }}>
                  <Users size={40} color="#72B879" />
                  <h3>No students found</h3>
                  <p style={{ color: "#65766B" }}>Approved students matching this filter will appear here.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "780px" }}>
                    <thead><tr style={{ background: "#F1F8F0" }}>
                      <th style={{ padding: "12px" }}>Student</th>
                      <th style={{ padding: "12px" }}>Registration No.</th>
                      <th style={{ padding: "12px" }}>Email</th>
                      <th style={{ padding: "12px" }}>Semester</th>
                    </tr></thead>
                    <tbody>
                      {filteredStudents.filter((student) => studentSemesterFilter === "unassigned" ? !student.semester : true).map((student) => (
                        <tr key={student._id} style={{ borderBottom: "1px solid #E1E9E3" }}>
                          <td style={{ padding: "12px" }}>{student.name || "Student"}</td>
                          <td style={{ padding: "12px", fontWeight: 600 }}>{student.registrationNumber || "—"}</td>
                          <td style={{ padding: "12px" }}>{student.email}</td>
                          <td style={{ padding: "12px" }}>
                            <select aria-label={`Semester for ${student.name || student.email}`} value={student.semester ? String(student.semester) : ""} disabled={updatingSemesterId === student._id} onChange={(event) => void assignSemester(student._id, event.target.value)} style={{ ...fieldStyle, minWidth: "150px" }}>
                              <option value="">Not assigned</option>
                              {semesters.map((semester) => <option key={semester} value={String(semester)}>Semester {semester}</option>)}
                            </select>
                            {updatingSemesterId === student._id && <small>Saving...</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "subjects" && (
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Subject Management</h2>
              <p style={{ color: "#65766B", lineHeight: 1.6 }}>Create and maintain subjects separately for each semester. Subject codes must be unique within their semester.</p>

              <label style={{ display: "grid", gap: "6px", maxWidth: "300px", marginBottom: "22px" }}>
                <span style={{ fontWeight: 600, fontSize: "13px" }}>Select semester</span>
                <select value={selectedSemester} onChange={(event) => { setSelectedSemester(Number(event.target.value)); resetSubjectForm(); setSubjectMessage(""); }} style={fieldStyle}>
                  {semesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                </select>
              </label>

              <form onSubmit={(event) => void saveSubject(event)} style={{ padding: "18px", background: "#F7FBF6", border: "1px solid #DDE9DD", borderRadius: "12px", marginBottom: "24px" }}>
                <h3 style={{ marginTop: 0 }}>{editingSubjectId ? "Edit subject" : `Add subject — Semester ${selectedSemester}`}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>Subject name</span>
                    <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="e.g. Database Management Systems" maxLength={120} required style={fieldStyle} />
                  </label>
                  <label style={{ display: "grid", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>Subject code</span>
                    <input value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} placeholder="e.g. DBMS" maxLength={30} required style={fieldStyle} />
                  </label>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "16px" }}>
                  <button type="submit" disabled={savingSubject} style={primaryButtonStyle}>
                    {editingSubjectId ? <Save size={17} /> : <Plus size={17} />}
                    {savingSubject ? "Saving..." : editingSubjectId ? "Update subject" : "Add subject"}
                  </button>
                  {editingSubjectId && <button type="button" onClick={resetSubjectForm} style={{ ...primaryButtonStyle, background: "#65766B" }}><X size={17} /> Cancel edit</button>}
                </div>
              </form>

              {subjectMessage && <p role="status" aria-live="polite" style={{ padding: "12px", borderRadius: "8px", background: subjectMessageType === "success" ? "#E2F6E6" : "#FFF0EF", color: subjectMessageType === "success" ? "#237A3B" : "#B42318", overflowWrap: "anywhere" }}>{subjectMessage}</p>}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", margin: "22px 0 12px" }}>
                <h3 style={{ margin: 0 }}>Semester {selectedSemester} subjects ({subjects.length})</h3>
                <button type="button" onClick={() => void loadSubjects()} disabled={loadingSubjects} style={{ ...primaryButtonStyle, background: "#FFFFFF", color: "#3F8D4B", border: "1px solid #DDE9DD" }}><RefreshCw size={16} /> Refresh subjects</button>
              </div>

              {loadingSubjects ? <p>Loading subjects...</p> : subjects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 12px", background: "#F7FBF6", borderRadius: "12px" }}>
                  <BookMarked size={40} color="#72B879" />
                  <h3>No subjects added for Semester {selectedSemester}</h3>
                  <p style={{ color: "#65766B" }}>Use the form above to add the first subject.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "600px" }}>
                    <thead><tr style={{ background: "#F1F8F0" }}>
                      <th style={{ padding: "13px" }}>#</th>
                      <th style={{ padding: "13px" }}>Subject name</th>
                      <th style={{ padding: "13px" }}>Subject code</th>
                      <th style={{ padding: "13px" }}>Actions</th>
                    </tr></thead>
                    <tbody>
                      {subjects.map((subject, index) => (
                        <tr key={subject._id} style={{ borderBottom: "1px solid #E1E9E3" }}>
                          <td style={{ padding: "13px" }}>{index + 1}</td>
                          <td style={{ padding: "13px", fontWeight: 600 }}>{subject.name}</td>
                          <td style={{ padding: "13px" }}>{subject.code}</td>
                          <td style={{ padding: "13px" }}>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button type="button" onClick={() => startEditingSubject(subject)} style={{ ...primaryButtonStyle, padding: "8px 10px", background: "#E2F6E6", color: "#237A3B" }}><Pencil size={15} /> Edit</button>
                              <button type="button" onClick={() => void deleteSubject(subject)} disabled={deletingSubjectId === subject._id} style={{ ...primaryButtonStyle, padding: "8px 10px", background: "#FFF0EF", color: "#B42318" }}><Trash2 size={15} /> {deletingSubjectId === subject._id ? "Deleting..." : "Delete"}</button>
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
              <p style={{ color: "#65766B" }}>Review new registrations and approve student accounts.</p>
              {loadingStudents && pendingStudents.length === 0 ? <p>Loading pending students...</p> : pendingStudents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 12px" }}><CheckCircle size={42} color="#72B879" /><h3>No pending students</h3><p style={{ color: "#65766B" }}>New registrations awaiting approval will appear here.</p></div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "650px" }}>
                    <thead><tr style={{ background: "#F1F8F0" }}><th style={{ padding: "14px" }}>Student</th><th style={{ padding: "14px" }}>Registration No.</th><th style={{ padding: "14px" }}>Email</th><th style={{ padding: "14px" }}>Action</th></tr></thead>
                    <tbody>{pendingStudents.map((student) => (
                      <tr key={student._id} style={{ borderBottom: "1px solid #E1E9E3" }}>
                        <td style={{ padding: "14px" }}>{student.name || "Student"}</td>
                        <td style={{ padding: "14px", fontWeight: 600 }}>{student.registrationNumber || "—"}</td>
                        <td style={{ padding: "14px" }}>{student.email}</td>
                        <td style={{ padding: "14px" }}><button type="button" onClick={() => void handleApprove(student._id)} disabled={approvingId !== null} style={primaryButtonStyle}><CheckCircle size={16} />{approvingId === student._id ? "Approving..." : "Approve"}</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === "attendance" && (
            <section style={panelStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
                <div><h2 style={{ margin: "0 0 8px" }}>Daily Attendance</h2><p style={{ margin: 0, color: "#65766B" }}>Mark attendance for approved students.</p></div>
                <label style={{ display: "grid", gap: "6px" }}><span style={{ fontSize: "13px", fontWeight: 600 }}>Select date</span><input type="date" value={attendanceDate} max={getLocalDate()} onChange={(event) => { setAttendanceDate(event.target.value); setAttendanceMessage(""); }} style={fieldStyle} /></label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "22px" }}>
                {[
                  { label: "Present", count: attendanceCounts.present, color: "#237A3B", background: "#E2F6E6" },
                  { label: "Absent", count: attendanceCounts.absent, color: "#B42318", background: "#FFF0EF" },
                  { label: "Late", count: attendanceCounts.late, color: "#925D08", background: "#FFF4D9" },
                  { label: "Not Marked", count: attendanceCounts.unmarked, color: "#56675C", background: "#F0F3F0" },
                ].map((item) => <div key={item.label} style={{ padding: "16px", borderRadius: "12px", background: item.background }}><p style={{ margin: "0 0 8px", fontSize: "13px", color: item.color }}>{item.label}</p><h2 style={{ margin: 0, color: item.color, fontSize: "26px" }}>{item.count}</h2></div>)}
              </div>

              {attendanceMessage && <p role="status" aria-live="polite" style={{ padding: "12px", borderRadius: "8px", background: attendanceMessageType === "success" ? "#E2F6E6" : "#FFF0EF", color: attendanceMessageType === "success" ? "#237A3B" : "#B42318", overflowWrap: "anywhere" }}>{attendanceMessage}</p>}

              {loadingAttendance ? <p>Loading attendance...</p> : attendanceStudents.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 12px" }}><Users size={42} color="#72B879" /><h3>No approved students found</h3><p style={{ color: "#65766B" }}>Approve student registrations before marking attendance.</p></div>
              ) : (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "680px" }}>
                      <thead><tr style={{ background: "#F1F8F0" }}><th style={{ padding: "13px" }}>Student</th><th style={{ padding: "13px" }}>Registration No.</th><th style={{ padding: "13px" }}>Attendance Status</th></tr></thead>
                      <tbody>{attendanceStudents.map((student) => (
                        <tr key={student._id} style={{ borderBottom: "1px solid #E1E9E3" }}>
                          <td style={{ padding: "13px" }}><strong>{student.name || "Student"}</strong><p style={{ fontSize: "12px", color: "#65766B", margin: "4px 0 0" }}>{student.email}</p></td>
                          <td style={{ padding: "13px" }}>{student.registrationNumber || "—"}</td>
                          <td style={{ padding: "13px" }}><select value={student.attendanceStatus} aria-label={`Attendance status for ${student.name || student.email}`} onChange={(event) => updateAttendanceStatus(student._id, event.target.value as AttendanceStatus)} style={{ ...fieldStyle, width: "155px", background: student.attendanceStatus === "Present" ? "#E2F6E6" : student.attendanceStatus === "Absent" ? "#FFF0EF" : student.attendanceStatus === "Late" ? "#FFF4D9" : "#FFFFFF" }}><option value="Not Marked">Not Marked</option><option value="Present">Present</option><option value="Absent">Absent</option><option value="Late">Late</option></select></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginTop: "22px" }}>
                    <p style={{ margin: 0, color: "#65766B", fontSize: "13px" }}>{attendanceStudents.length} approved student(s) · {attendanceDate}</p>
                    <button type="button" onClick={() => void saveAttendance()} disabled={savingAttendance || loadingAttendance} style={primaryButtonStyle}><Save size={18} />{savingAttendance ? "Saving..." : "Save Attendance"}</button>
                  </div>
                </>
              )}
            </section>
          )}

          {!["dashboard", "students", "approvals", "attendance", "subjects"].includes(activeSection) && (
            <section style={panelStyle}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#DDF3DF", color: "#3F8D4B", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px" }}>
                {activeSection === "marks" && <ClipboardList size={28} />}
                {activeSection === "calculation" && <Calculator size={28} />}
                {activeSection === "attendance-chart" && <ChartPie size={28} />}
              </div>
              <h2 style={{ marginTop: 0 }}>{navItems.find((item) => item.id === activeSection)?.label}</h2>
              <p style={{ color: "#65766B", lineHeight: 1.7 }}>This section will be connected to the semester and subject data next. Your marks calculation will use the assignment, mid-exam, attendance, and SEE rules we discussed.</p>
              {activeSection === "attendance-chart" && <p style={{ color: "#65766B" }}>The attendance pie chart remains set aside until the underlying attendance data is ready.</p>}
            </section>
          )}

          <p style={{ textAlign: "center", color: "#65766B", marginTop: "28px", fontSize: "13px" }}>CampusConnect · College Student Management System</p>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="welcome-panel">
          <div className="brand">
            <div className="brand-icon"><GraduationCap size={30} /></div>
            <span>Campus<span className="brand-highlight">Connect</span></span>
          </div>
          <div className="welcome-content">
            <span className="welcome-tag">COLLEGE MANAGEMENT PORTAL</span>
            <h1>Your campus.<br />Your future.<br /><span>One platform.</span></h1>
            <p>A smarter way to manage student information, academic records, attendance, and college activities.</p>
            <div className="feature-list">
              <div className="feature-item"><div className="feature-icon"><BookOpen size={20} /></div><div><h3>Academic Records</h3><p>Manage marks and subject details.</p></div></div>
              <div className="feature-item"><div className="feature-icon"><Users size={20} /></div><div><h3>Student Management</h3><p>Keep student information organized.</p></div></div>
              <div className="feature-item"><div className="feature-icon"><ShieldCheck size={20} /></div><div><h3>Secure Access</h3><p>Separate access for admins and students.</p></div></div>
            </div>
          </div>
          <div className="welcome-footer">© 2026 CampusConnect · College Student Management</div>
        </section>

        <section className="form-panel">
          <div className="mobile-brand"><GraduationCap size={30} /><span>CampusConnect</span></div>
          <div className="form-wrapper">
            <div className="form-heading">
              <span className="form-eyebrow">{isRegister ? "JOIN OUR CAMPUS" : "WELCOME BACK"}</span>
              <h2>{isRegister ? "Create student account" : role === "admin" ? "Admin sign in" : "Student sign in"}</h2>
              <p>{isRegister ? "Register to access your college portal." : role === "admin" ? "Sign in to manage your college." : "Sign in to access your student dashboard."}</p>
            </div>

            <div className="role-selector">
              <button type="button" className={`role-option ${role === "admin" ? "selected" : ""}`} onClick={() => handleRoleChange("admin")}><ShieldCheck size={18} /><span>Admin</span></button>
              <button type="button" className={`role-option ${role === "student" ? "selected" : ""}`} onClick={() => handleRoleChange("student")}><GraduationCap size={18} /><span>Student</span></button>
            </div>

            {role === "student" && <div className="auth-tabs">
              <button type="button" className={!isRegister ? "active" : ""} onClick={() => { setIsRegister(false); setMessage(""); }}>Login</button>
              <button type="button" className={isRegister ? "active" : ""} onClick={() => { setIsRegister(true); setMessage(""); }}>Register</button>
            </div>}

            <form onSubmit={handleSubmit}>
              {isRegister && <label className="field"><span>Full name</span><div className="input-wrapper"><User size={19} /><input type="text" name="name" placeholder="Enter your full name" autoComplete="name" required /></div></label>}

              <label className="field">
                <span>{isRegister ? "Email address" : "Email or registration number"}</span>
                <div className="input-wrapper">
                  {role === "student" && !isRegister ? <Hash size={19} /> : <Mail size={19} />}
                  <input type={role === "admin" || isRegister ? "email" : "text"} name="email" placeholder={role === "admin" ? "Enter admin email" : isRegister ? "Enter your email" : "Email or registration number"} autoComplete="username" required />
                </div>
              </label>

              <label className="field"><span>Password</span><div className="input-wrapper"><Lock size={19} /><input type="password" name="password" placeholder="Enter your password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : 1} required /></div></label>
              {isRegister && <label className="field"><span>Confirm password</span><div className="input-wrapper"><Lock size={19} /><input type="password" name="confirmPassword" placeholder="Confirm your password" autoComplete="new-password" required /></div></label>}

              {!isRegister && <div className="form-options"><label className="remember-option"><input type="checkbox" name="remember" /><span>Remember me</span></label><button type="button" className="text-button" onClick={() => alert("Password recovery will be added later.")}>Forgot password?</button></div>}

              {message && <p role="status" aria-live="polite" style={{ color: messageType === "success" ? "green" : "crimson", margin: "12px 0", overflowWrap: "anywhere" }}>{message}</p>}

              <button type="submit" className="submit-button" disabled={loading}>{loading ? "Please wait..." : isRegister ? "Create student account" : role === "admin" ? "Admin sign in" : "Student sign in"}{!loading && <ArrowRight size={19} />}</button>
            </form>

            {role === "student" && <p className="switch-account">{isRegister ? "Already have an account?" : "New to CampusConnect?"}<button type="button" onClick={() => { setIsRegister(!isRegister); setMessage(""); }}>{isRegister ? "Sign in" : "Create an account"}</button></p>}
            {role === "admin" && <p className="admin-note">Admin access is restricted to authorized administrators.</p>}
            <div className="form-divider"><span>COLLEGE STUDENT MANAGEMENT SYSTEM</span></div>
          </div>
          <div className="security-note"><ShieldCheck size={16} />Secure portal access</div>
        </section>
      </div>
    </div>
  );
}

export default App;
