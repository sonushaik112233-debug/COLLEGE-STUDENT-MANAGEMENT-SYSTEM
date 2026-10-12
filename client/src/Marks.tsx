
import { useEffect, useState } from "react";

const API_URL = "/api/admin";

type Student = {
  _id: string;
  name?: string;
  username?: string;
  email?: string;
  registrationNumber?: string;
  semester?: number;
};

type Subject = {
  _id: string;
  name: string;
  code?: string;
  semester?: number;
};

type Marks = {
  assignment1: number;
  assignment2: number;
  mid1: number;
  mid2: number;
  attendancePercentage: number;
  seeMarks: number;
};

const emptyMarks: Marks = {
  assignment1: 0,
  assignment2: 0,
  mid1: 0,
  mid2: 0,
  attendancePercentage: 0,
  seeMarks: 0,
};

export default function MarksPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [semester, setSemester] = useState("1");
  const [marks, setMarks] = useState<Marks>(emptyMarks);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    "";

  const requestHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentsResponse, subjectsResponse] = await Promise.all([
          fetch(`${API_URL}/students`, {
            headers: requestHeaders(),
          }),
          fetch("/api/subjects", {
            headers: requestHeaders(),
          }),
        ]);

        if (!studentsResponse.ok || !subjectsResponse.ok) {
          throw new Error("Unable to load students or subjects. Check your login and API routes.");
        }

        const studentsData = await studentsResponse.json();
        const subjectsData = await subjectsResponse.json();

        const studentList = Array.isArray(studentsData)
          ? studentsData
          : studentsData.students || [];

        const subjectList = Array.isArray(subjectsData)
          ? subjectsData
          : subjectsData.subjects || [];

        setStudents(studentList);
        setSubjects(subjectList);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to load data."
        );
      }
    };

    loadData();
  }, []);

  const selectedStudent = students.find(
    (student) => student._id === studentId
  );

  const filteredSubjects = subjects.filter(
    (subject) =>
      subject.semester === undefined ||
      subject.semester === Number(semester)
  );

  useEffect(() => {
    setSubjectId("");
    setMarks(emptyMarks);
  }, [studentId, semester]);

  useEffect(() => {
    if (!studentId || !subjectId) return;

    const loadMarks = async () => {
      try {
        const response = await fetch(
          `${API_URL}/marks?studentId=${encodeURIComponent(studentId)}&subjectId=${encodeURIComponent(subjectId)}&semester=${semester}`,
          { headers: requestHeaders() }
        );

        if (!response.ok) {
          throw new Error("Unable to load saved marks.");
        }

        const data = await response.json();
        const saved = data.marks?.[0];

        if (saved) {
          setMarks({
            assignment1: saved.assignment1 ?? 0,
            assignment2: saved.assignment2 ?? 0,
            mid1: saved.mid1 ?? 0,
            mid2: saved.mid2 ?? 0,
            attendancePercentage: saved.attendancePercentage ?? 0,
            seeMarks: saved.seeMarks ?? 0,
          });
        } else {
          setMarks(emptyMarks);
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to load marks."
        );
      }
    };

    loadMarks();
  }, [studentId, subjectId, semester]);

  const updateMark = (field: keyof Marks, value: string) => {
    const numberValue = value === "" ? 0 : Number(value);

    setMarks((previous) => ({
      ...previous,
      [field]: numberValue,
    }));
  };

  const assignmentTotal =
    ((marks.assignment1 + marks.assignment2) / 20) * 15;

  const higherMid = Math.max(marks.mid1, marks.mid2);
  const lowerMid = Math.min(marks.mid1, marks.mid2);
  const midTotal = ((higherMid * 0.75 + lowerMid * 0.25) / 30) * 20;

  const attendanceTotal = (marks.attendancePercentage / 100) * 5;

  const cieTotal = assignmentTotal + midTotal + attendanceTotal;
  const totalMarks = cieTotal + marks.seeMarks;

  const saveMarks = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!studentId || !subjectId) {
      setMessage("Please select a student and subject.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/marks`, {
        method: "POST",
        headers: requestHeaders(),
        body: JSON.stringify({
          studentId,
          subjectId,
          semester: Number(semester),
          ...marks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save marks.");
      }

      setMessage("Marks saved successfully!");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save marks."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 850, margin: "30px auto", padding: 20 }}>
      <h1>Student Marks Management</h1>
      <p>Assign marks for each student and subject.</p>

      {message && (
        <p role="status" style={{ padding: 12, background: "#f1f5f9" }}>
          {message}
        </p>
      )}

      <form onSubmit={saveMarks}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="semester">Semester</label>
          <br />
          <select
            id="semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            style={{ width: "100%", padding: 10 }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
              <option key={value} value={value}>
                Semester {value}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="student">Student</label>
          <br />
          <select
            id="student"
            required
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            style={{ width: "100%", padding: 10 }}
          >
            <option value="">Select a student</option>
            {students
              .filter(
                (student) =>
                  student.semester === undefined ||
                  student.semester === Number(semester)
              )
              .map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name || student.username || student.email}{" "}
                  {student.registrationNumber
                    ? `(${student.registrationNumber})`
                    : ""}
                </option>
              ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="subject">Subject</label>
          <br />
          <select
            id="subject"
            required
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            style={{ width: "100%", padding: 10 }}
          >
            <option value="">Select a subject</option>
            {filteredSubjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
                {subject.code ? ` (${subject.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        <h2>Internal Marks</h2>

        {(
          [
            ["assignment1", "Assignment 1", 10],
            ["assignment2", "Assignment 2", 10],
            ["mid1", "Mid Exam 1", 30],
            ["mid2", "Mid Exam 2", 30],
            ["attendancePercentage", "Attendance Percentage", 100],
          ] as [keyof Marks, string, number][]
        ).map(([field, label, max]) => (
          <div key={field} style={{ marginBottom: 16 }}>
            <label htmlFor={field}>
              {label} (out of {max})
            </label>
            <br />
            <input
              id={field}
              type="number"
              min="0"
              max={max}
              step="0.01"
              required
              value={marks[field]}
              onChange={(event) => updateMark(field, event.target.value)}
              style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
            />
          </div>
        ))}

        <h2>External Marks</h2>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="seeMarks">SEE Marks (out of 60)</label>
          <br />
          <input
            id="seeMarks"
            type="number"
            min="0"
            max="60"
            step="0.01"
            required
            value={marks.seeMarks}
            onChange={(event) => updateMark("seeMarks", event.target.value)}
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
        </div>

        <h2>Calculated Result</h2>

        <div
          style={{
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <p>Assignment contribution: {assignmentTotal.toFixed(2)} / 15</p>
          <p>Mid-exam contribution: {midTotal.toFixed(2)} / 20</p>
          <p>Attendance contribution: {attendanceTotal.toFixed(2)} / 5</p>
          <p>
            <strong>CIE: {cieTotal.toFixed(2)} / 40</strong>
          </p>
          <p>SEE: {marks.seeMarks.toFixed(2)} / 60</p>
          <p>
            <strong>Total: {totalMarks.toFixed(2)} / 100</strong>
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px 24px", cursor: "pointer" }}
        >
          {loading ? "Saving..." : "Save Marks"}
        </button>
      </form>
    </div>
  );
}

