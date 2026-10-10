import { useState } from "react";

type Student = {
  id: string;
  name: string;
  regNo: string;
};

type AttendanceStatus = "Present" | "Absent" | "Late";

const initialStudents: Student[] = [
  { id: "1", name: "Student One", regNo: "REG001" },
  { id: "2", name: "Student Two", regNo: "REG002" },
  { id: "3", name: "Student Three", regNo: "REG003" },
  { id: "4", name: "Student Four", regNo: "REG004" },
  { id: "5", name: "Student Five", regNo: "REG005" },
];

export default function Attendance() {
  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );

  const [attendance, setAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});

  const [saved, setSaved] = useState(false);

  const updateStatus = (id: string, status: AttendanceStatus) => {
    setAttendance((previous) => ({
      ...previous,
      [id]: status,
    }));
    setSaved(false);
  };

  const presentCount = Object.values(attendance).filter(
    (status) => status === "Present"
  ).length;

  const absentCount = Object.values(attendance).filter(
    (status) => status === "Absent"
  ).length;

  const lateCount = Object.values(attendance).filter(
    (status) => status === "Late"
  ).length;

  const markedCount = Object.keys(attendance).length;

  const saveAttendance = () => {
    if (markedCount !== initialStudents.length) {
      alert("Please mark attendance for every student first.");
      return;
    }

    localStorage.setItem(
      `attendance-${date}`,
      JSON.stringify(attendance)
    );

    setSaved(true);
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div>
          <h1>Attendance Management</h1>
          <p>Mark and manage daily student attendance.</p>
        </div>

        <label className="attendance-date">
          Attendance Date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              const selectedDate = event.target.value;
              setDate(selectedDate);

              const existing = localStorage.getItem(
                `attendance-${selectedDate}`
              );

              setAttendance(existing ? JSON.parse(existing) : {});
              setSaved(false);
            }}
          />
        </label>
      </div>

      <div className="attendance-summary">
        <div className="attendance-stat">
          <span>Total Students</span>
          <strong>{initialStudents.length}</strong>
        </div>

        <div className="attendance-stat">
          <span>Present</span>
          <strong>{presentCount}</strong>
        </div>

        <div className="attendance-stat">
          <span>Absent</span>
          <strong>{absentCount}</strong>
        </div>

        <div className="attendance-stat">
          <span>Late</span>
          <strong>{lateCount}</strong>
        </div>
      </div>

      <div className="attendance-table-card">
        <div className="attendance-table-heading">
          <h2>Student Attendance</h2>
          <span>
            {markedCount} of {initialStudents.length} marked
          </span>
        </div>

        <div className="attendance-table-wrapper">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Registration Number</th>
                <th>Student Name</th>
                <th>Attendance Status</th>
              </tr>
            </thead>

            <tbody>
              {initialStudents.map((student, index) => (
                <tr key={student.id}>
                  <td>{index + 1}</td>
                  <td>{student.regNo}</td>
                  <td>{student.name}</td>
                  <td>
                    <select
                      className={`attendance-status ${
                        attendance[student.id]?.toLowerCase() || ""
                      }`}
                      value={attendance[student.id] || ""}
                      onChange={(event) =>
                        updateStatus(
                          student.id,
                          event.target.value as AttendanceStatus
                        )
                      }
                    >
                      <option value="" disabled>
                        Select status
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

        <div className="attendance-footer">
          {saved && (
            <span className="attendance-success">
              Attendance saved successfully!
            </span>
          )}

          <button
            className="attendance-save-button"
            onClick={saveAttendance}
          >
            Save Attendance
          </button>
        </div>
      </div>
    </div>
  );
}