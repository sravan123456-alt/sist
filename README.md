# Sathyabama ERP Total Attendance Tracker & Bunk Advisor

A web application for **Sathyabama Institute of Science and Technology (SIST)** students to view their **consolidated total attendance percentage**, scheduled vs conducted hours, shortage warnings, and dynamic bunk/target calculations for the **current semester**.

The official ERP portal (`erp.sathyabama.ac.in`) only displays hour-wise breakdown per subject without aggregating the total semester attendance or advising students on how many classes they can afford to miss.

---

## Features

- **Consolidated Semester Attendance**: Aggregates all subjects to compute total conducted hours, total attended hours, absent hours, and the overall semester attendance percentage.
- **Strictly Current Semester Data**: Targets the active semester (e.g. Semester 3, July–October 2026 for Batch 2025–2029) directly from the ERP backend.
- **Smart Bunk & Target Advisor**:
  - Interactive slider for minimum targets (75%, 80%, 85%).
  - Computes how many classes a student can safely miss without falling below the target.
  - Or how many consecutive classes must be attended to recover from a shortage.
- **Subject-by-Subject Breakdown**:
  - Theory and Practical categories.
  - Color-coded progress bars (Green $\ge 75\%$, Amber, Red $< 75\%$).
  - Per-subject bunk or recovery margin.
- **Dual Mode**:
  - **Hour-Wise Attendance**: Based on scheduled lecture/lab hours.
  - **Day-Wise Attendance**: Based on working days with a detailed log of recorded absences.
- **Zero External Dependencies**: Pure Node.js built-in HTTP server (`node:http`, `node:fs`, `node:path`, native `fetch`).
- **Mobile-Responsive**: Designed with Tailwind CSS for mobile phones and desktops.
- **Print / PDF Export**: One-click printable view for parent/mentor submissions.

---

## How to Run

1. Make sure **Node.js** (v18+) is installed.
2. Open a terminal in this directory (`c:\Users\sarav\OneDrive\Desktop\sabs`).
3. Start the server (no `npm install` needed!):
   ```bash
   node server.js
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Login Credentials

Any Sathyabama student can log in using their ERP credentials:
- **Register Number**: e.g., `145130595`
- **Password / DOB**: Usually Date of Birth in `YYYY-MM-DD` format (e.g., `2007-10-08`).

---

## Technical Architecture

- **Backend**: Zero-dependency Node.js server acting as an authenticated proxy to Sathyabama ERP APIs (`MasterStudent/login_y`, `MasterStudent/view`, `StudentAttendanceHourly/getStudentAcademicHourwise`, `StudentDailyAttendance/StudentWiseAttendance`).
- **Security**: Direct HTTPS calls to ERP; student credentials are never stored or logged on disk.
- **Frontend**: Responsive modern UI built with Tailwind CSS, Chart gauge SVG, Lucide/FontAwesome icons, and Vanilla JS.
