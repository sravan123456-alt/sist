const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const ERP_BASE = 'https://erp.sathyabama.ac.in/erp/api/v1.0/';

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Calculate attendance buffer (bunk / attend required)
function calculateAttendanceBuffer(present, conducted, targetPercent = 80) {
  const target = targetPercent / 100;
  const currentPct = conducted > 0 ? (present / conducted) * 100 : 0;

  if (currentPct >= targetPercent) {
    // Can skip X hours: present / (conducted + x) >= target
    const canBunk = Math.floor((present - target * conducted) / target);
    return {
      status: 'safe',
      canBunk: Math.max(0, canBunk),
      needToAttend: 0,
      label: `Can skip ${canBunk}h`,
      message: `You can safely skip ${canBunk}h and stay above ${targetPercent}%.`
    };
  } else {
    // Must attend Y hours: (present + y) / (conducted + y) >= target
    const needToAttend = Math.ceil((target * conducted - present) / (1 - target));
    return {
      status: 'shortage',
      canBunk: 0,
      needToAttend: Math.max(1, needToAttend),
      label: `Attend next ${needToAttend}h`,
      message: `Attend next ${needToAttend}h to reach ${targetPercent}%.`
    };
  }
}

// Day-wise attendance calculation matching Sathyabama ERP Chunk 51
function calculateErpDailyAttendance(fromDate, toDate, attendanceData) {
  const m = attendanceData.AttendanceDetails || [];
  const s = attendanceData.HolidayList || [];
  const c = attendanceData.TimetableDetails;
  const p = c?.TimeSetDays ? c.TimeSetDays.split(',') : ['1', '2', '3', '4', '5'];
  const u = attendanceData.ActualWorkingDays || [];

  const start = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalHolidays = 0;
  const records = [];

  for (let n = 0; n < totalDays; n++) {
    const cur = new Date(start.getTime() + n * 24 * 60 * 60 * 1000);
    const dayOfWeek = cur.getUTCDay().toString();
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cur.getUTCDate()).padStart(2, '0');
    const ymd = `${yyyy}-${mm}-${dd}`;
    const dmy = `${dd}/${mm}/${yyyy}`;

    if (p.find(e => e == dayOfWeek)) {
      if (u.find(e => e.Date == ymd)) {
        const isAbsent = m.find(e => e.AttendanceDate == dmy);
        const isHoliday = s.find(e => e.HoliDay == dmy);

        if (isAbsent) {
          totalAbsent++;
          records.push({ date: dmy, type: 'Working Day', isPresent: 0, status: 'Absent' });
        } else if (dayOfWeek === '0') {
          totalHolidays++;
          records.push({ date: dmy, type: 'Sun Day', isPresent: '-', status: 'Sunday' });
        } else if (isHoliday) {
          totalHolidays++;
          records.push({ date: dmy, type: isHoliday.Comments, isPresent: '-', status: 'Holiday' });
        } else {
          totalPresent++;
          records.push({ date: dmy, type: 'Working Day', isPresent: 1, status: 'Present' });
        }
      }
    }
  }

  const totalWorkingDays = totalPresent + totalAbsent;
  // Format single decimal point (e.g. 78.5%)
  const percentage = totalWorkingDays > 0 ? Number(((totalPresent / totalWorkingDays) * 100).toFixed(1)) : 0;

  return {
    totalWorkingDays,
    daysPresent: totalPresent,
    daysAbsent: totalAbsent,
    holidays: totalHolidays,
    percentage,
    records,
    absences: m.map(a => ({ date: a.AttendanceDate, type: a.AttendanceType }))
  };
}

async function handleLogin(req, res) {
  try {
    const { registerNumber, password, targetPercent = 80 } = await parseBody(req);

    if (!registerNumber || !password) {
      return sendJson(res, 400, {
        success: false,
        message: 'Please enter your Register Number and Password.'
      });
    }

    // Step 1: Login to ERP API
    const loginPayload = {
      RegisterNumber: registerNumber.trim(),
      Password: password.trim(),
      CapchaKey: 'web-login-' + Date.now(),
      TurnstileToken: ''
    };

    const loginRes = await fetch(`${ERP_BASE}MasterStudent/login_y`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://erp.sathyabama.ac.in',
        'Referer': 'https://erp.sathyabama.ac.in/account/login?returnUrl=%2F',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(loginPayload)
    });

    const loginData = await loginRes.json();

    if (!loginData.status || !loginData.responseData || !loginData.responseData.login) {
      return sendJson(res, 401, {
        success: false,
        message: loginData.message || 'Invalid Register Number or Password. Please check and try again.'
      });
    }

    const { accessToken, StudentId, StudentName, DOB, Batch } = loginData.responseData.login;

    // Step 2: Fetch Student Profile
    const viewRes = await fetch(`${ERP_BASE}MasterStudent/view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Origin': 'https://erp.sathyabama.ac.in',
        'Referer': 'https://erp.sathyabama.ac.in/student/view'
      },
      body: JSON.stringify({ StudentId })
    });

    const viewData = await viewRes.json();
    const studentInfo = (viewData.responseData && viewData.responseData.StudentInfo && viewData.responseData.StudentInfo[0]) || {};

    const currentSemester = studentInfo.CurrentSemester || studentInfo.Semester || 3;
    const currentYear = studentInfo.CurrentYear || studentInfo.YearofStudy || 2;
    const academicYear = studentInfo.CurrentAcademicYear || '2026-2027';
    const startDate = studentInfo.AcademicMonthStartDate || '2026-07-01';
    const endDate = studentInfo.AcademicMonthEndDate || '2026-10-29';

    // Step 3: Fetch Current Semester Hour-wise Attendance (Academic Classes)
    const hourwiseRes = await fetch(`${ERP_BASE}StudentAttendanceHourly/getStudentAcademicHourwise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Origin': 'https://erp.sathyabama.ac.in',
        'Referer': 'https://erp.sathyabama.ac.in/student/view'
      },
      body: JSON.stringify({ StudentId })
    });

    const hourwiseData = await hourwiseRes.json();
    const rawSubjects = (hourwiseData.responseData && Array.isArray(hourwiseData.responseData)) ? hourwiseData.responseData : [];

    // Step 4: Fetch Day-wise Attendance
    let dailyData = {
      totalWorkingDays: 0,
      daysPresent: 0,
      daysAbsent: 0,
      percentage: 0,
      records: [],
      absences: []
    };

    try {
      const dailyRes = await fetch(`${ERP_BASE}StudentDailyAttendance/StudentWiseAttendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Origin': 'https://erp.sathyabama.ac.in',
          'Referer': 'https://erp.sathyabama.ac.in/student/view'
        },
        body: JSON.stringify({
          StudentId,
          FromDate: startDate,
          ToDate: endDate
        })
      });

      const dailyJson = await dailyRes.json();
      if (dailyJson.status && dailyJson.responseData) {
        dailyData = calculateErpDailyAttendance(startDate, endDate, dailyJson.responseData);
      }
    } catch (err) {
      console.warn('Failed to fetch daily attendance:', err.message);
    }

    // Step 5: Consolidate Hour-wise Statistics (Single Decimal Point)
    let totalScheduledHours = 0;
    let totalConductedHours = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalOD = 0;

    const subjects = rawSubjects.map((sub, idx) => {
      const conducted = Number(sub.WithAttendance || 0);
      const present = Number(sub.TotalPresent || 0);
      const absent = Number(sub.TotalAbsent || 0);
      const od = Number(sub.TotalOD || 0);
      const scheduled = Number(sub.TotalHours || 0);
      const effectivePresent = present + od;

      // Hours left in semester from syllabus schedule
      const hoursLeft = Math.max(0, scheduled - conducted);

      totalScheduledHours += scheduled;
      totalConductedHours += conducted;
      totalPresent += present;
      totalAbsent += absent;
      totalOD += od;

      // Format as single decimal point: e.g. 76.9, 78.4, 85.2
      const pctNum = conducted > 0 ? Number(((effectivePresent / conducted) * 100).toFixed(1)) : 0;
      const buffer = calculateAttendanceBuffer(effectivePresent, conducted, targetPercent);

      return {
        id: sub.SubjectId || idx + 1,
        code: sub.SubjectCode || 'N/A',
        name: sub.SubjectName || 'Unknown Subject',
        type: (sub.SubjectType || 'THEORY').toUpperCase(),
        scheduledHours: scheduled,
        conductedHours: conducted,
        present: present,
        absent: absent,
        od: od,
        effectivePresent: effectivePresent,
        hoursLeft: hoursLeft,
        percentage: pctNum, // single decimal point
        isShortage: pctNum < targetPercent,
        buffer: buffer,
        examDate: sub.ExamDate || null
      };
    });

    const totalEffectivePresent = totalPresent + totalOD;
    // Overall Percentage formatted as single decimal point (e.g. 79.5%)
    const overallPercentage = totalConductedHours > 0
      ? Number(((totalEffectivePresent / totalConductedHours) * 100).toFixed(1))
      : 0;

    const overallBuffer = calculateAttendanceBuffer(totalEffectivePresent, totalConductedHours, targetPercent);
    const dailyBuffer = calculateAttendanceBuffer(dailyData.daysPresent, dailyData.totalWorkingDays, targetPercent);

    return sendJson(res, 200, {
      success: true,
      data: {
        student: {
          id: StudentId,
          name: StudentName,
          registerNumber: registerNumber.trim(),
          dob: DOB,
          batch: Batch,
          course: studentInfo.CourseName || 'B.E',
          degree: studentInfo.Degree || 'UG',
          programme: studentInfo.ProgrammeName || 'Engineering',
          section: studentInfo.SectionName || 'N/A',
          currentSemester: currentSemester,
          currentYear: currentYear,
          academicYear: academicYear,
          academicStartDate: startDate,
          academicEndDate: endDate,
          photoUrl: studentInfo.Photo || null
        },
        currentSemester: {
          semesterNumber: currentSemester,
          yearOfStudy: currentYear,
          academicYear: academicYear,
          dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
          note: `All figures below are strictly for Semester ${currentSemester} (${academicYear})`
        },
        hourwiseSummary: {
          totalScheduledHours,
          totalConductedHours,
          totalPresent,
          totalAbsent,
          totalOD,
          totalEffectivePresent,
          overallPercentage, // single decimal point: 79.5%
          isShortage: overallPercentage < targetPercent,
          buffer: overallBuffer,
          totalSubjects: subjects.length,
          shortageSubjectsCount: subjects.filter(s => s.isShortage).length
        },
        dailySummary: {
          ...dailyData,
          buffer: dailyBuffer
        },
        subjects
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return sendJson(res, 500, {
      success: false,
      message: 'Server error processing attendance: ' + error.message
    });
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('File Not Found');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

if (require.main === module || (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME)) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Sathyabama Attendance Tracker running on:`);
    console.log(` http://localhost:${PORT}`);
    console.log(` Zero dependencies. Single-point percentages active.`);
    console.log(`=======================================================`);
  });
}

module.exports = server;
