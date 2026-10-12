
import { useState } from "react";

const API_URL =
  "https://vigilant-capybara-g4gwprq4gvg5c9p7q-5000.app.github.dev";

type Marks = {
  subject: string;
  assignment1: number;
  assignment2: number;
  mid1: number;
  mid2: number;
  external: number;
};

type Student = {
  _id?: string;
  name: string;
  registrationNumber: string;
  marks?: Marks[];
};

type Props = {
  students: Student[];
  subjects: string[];
  onBack?: () => void;
  onSaved?: () => void;
};

export default function MarksManagement({
  students,
  subjects,
  onBack,
  onSaved,
}: Props) {
  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [selectedSubject, setSelectedSubject] =
    useState("");

  const [marks, setMarks] = useState<Marks>({
    subject: "",
    assignment1: 0,
    assignment2: 0,
    mid1: 0,
    mid2: 0,
    external: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectSubject = (subject: string) => {
    setSelectedSubject(subject);

    const existing = selectedStudent?.marks?.find(
      (item) => item.subject === subject
    );

    setMarks(
      existing
        ? { ...existing }
        : {
            subject,
            assignment1: 0,
            assignment2: 0,
            mid1: 0,
            mid2: 0,
            external: 0,
          }
    );

    setMessage("");
  };

  const updateField = (
    field: keyof Omit<Marks, "subject">,
    value: string
  ) => {
    setMarks((previous) => ({
      ...previous,
      [field]: value === "" ? 0 : Number(value),
    }));
  };

  const saveMarks = async () => {
    if (!selectedStudent?._id || !selectedSubject) {
      setMessage("Select a student and subject.");
      return;
    }

    const limits = {
      assignment1: 10,
      assignment2: 10,
      mid1: 30,
      mid2: 30,
      external: 60,
    };

    for (const field of Object.keys(limits) as Array<
      keyof typeof limits
    >) {
      const value = marks[field];

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > limits[field]
      ) {
        setMessage(
          `${field} must be between 0 and ${limits[field]}.`
        );
        return;
      }
    }

    const updatedMark = {
      ...marks,
      subject: selectedSubject,
    };

    const existingMarks = selectedStudent.marks || [];

    const updatedMarks = existingMarks.some(
      (item) => item.subject === selectedSubject
    )
      ? existingMarks.map((item) =>
          item.subject === selectedSubject
            ? updatedMark
            : item
        )
      : [...existingMarks, updatedMark];

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/students/${selectedStudent._id}/marks`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            marks: updatedMarks,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.message || "Unable to save marks."
        );
        return;
      }

      setSelectedStudent((previous) =>
        previous
          ? { ...previous, marks: updatedMarks }
          : previous
      );

      setMessage("Marks saved successfully.");
      onSaved?.();
    } catch (error) {
      console.error(error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Marks Management</h1>

      <h2>Select Student</h2>

      {students.map((student) => (
        <div key={student._id || student.registrationNumber}>
          <p>{student.name}</p>
          <p>{student.registrationNumber}</p>

          <button
            type="button"
            onClick={() => {
              setSelectedStudent(student);
              setSelectedSubject("");
              setMessage("");
            }}
          >
            Select Student
          </button>

          <hr />
        </div>
      ))}

      {selectedStudent && (
        <>
          <h2>Marks for {selectedStudent.name}</h2>

          <label>
            Subject

            <select
              value={selectedSubject}
              onChange={(event) =>
                selectSubject(event.target.value)
              }
            >
              <option value="">Select subject</option>

              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>

          {selectedSubject && (
            <>
              <h3>{selectedSubject}</h3>

              <label>
                Assignment 1 (out of 10)

                <input
                  type="number"
                  min="0"
                  max="10"
                  value={marks.assignment1}
                  onChange={(event) =>
                    updateField(
                      "assignment1",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Assignment 2 (out of 10)

                <input
                  type="number"
                  min="0"
                  max="10"
                  value={marks.assignment2}
                  onChange={(event) =>
                    updateField(
                      "assignment2",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Mid 1 (out of 30)

                <input
                  type="number"
                  min="0"
                  max="30"
                  value={marks.mid1}
                  onChange={(event) =>
                    updateField("mid1", event.target.value)
                  }
                />
              </label>

              <label>
                Mid 2 (out of 30)

                <input
                  type="number"
                  min="0"
                  max="30"
                  value={marks.mid2}
                  onChange={(event) =>
                    updateField("mid2", event.target.value)
                  }
                />
              </label>

              <label>
                SEM Exam (out of 60)

                <input
                  type="number"
                  min="0"
                  max="60"
                  value={marks.external}
                  onChange={(event) =>
                    updateField(
                      "external",
                      event.target.value
                    )
                  }
                />
              </label>

              <button
                type="button"
                onClick={saveMarks}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Marks"}
              </button>

              {message && <p>{message}</p>}
            </>
          )}

          <h2>Saved Marks</h2>

          {selectedStudent.marks?.map((item) => (
            <div key={item.subject}>
              <h3>{item.subject}</h3>
              <p>Assignment 1: {item.assignment1}/10</p>
              <p>Assignment 2: {item.assignment2}/10</p>
              <p>Mid 1: {item.mid1}/30</p>
              <p>Mid 2: {item.mid2}/30</p>
              <p>SEM Exam: {item.external}/60</p>
              <hr />
            </div>
          ))}
        </>
      )}

      {onBack && (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
    </div>
  );
}
