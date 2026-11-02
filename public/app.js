// Application State
let appData = null;
let currentTarget = 80; // Default to 80% like sistpilot, with 75% toggle
let currentTab = 'hourwise'; // 'hourwise' or 'daywise'
let currentFilter = 'all'; // 'all', 'shortage', 'THEORY', 'PRACTICAL'
let searchQuery = '';

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const headerUserActions = document.getElementById('headerUserActions');
const loginForm = document.getElementById('loginForm');
const regNoInput = document.getElementById('regNo');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnIcon = document.getElementById('submitBtnIcon');
const loginError = document.getElementById('loginError');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const printBtn = document.getElementById('printBtn');

// Nav & Header Profile Elements
const navAvatar = document.getElementById('navAvatar');
const navStudentName = document.getElementById('navStudentName');
const navRegNo = document.getElementById('navRegNo');

// Dashboard Banner Elements
const dashAvatar = document.getElementById('dashAvatar');
const dashStudentName = document.getElementById('dashStudentName');
const dashRegBadge = document.getElementById('dashRegBadge');
const dashCourseDetails = document.getElementById('dashCourseDetails');
const dashSemText = document.getElementById('dashSemText');
const dashYearText = document.getElementById('dashYearText');
const dashSecText = document.getElementById('dashSecText');
const dashDateRangeText = document.getElementById('dashDateRangeText');

// Tabs & Target Buttons
const tabHourwise = document.getElementById('tabHourwise');
const tabDaywise = document.getElementById('tabDaywise');
const hourwiseSection = document.getElementById('hourwiseSection');
const daywiseSection = document.getElementById('daywiseSection');
const targetToggleBtns = document.querySelectorAll('.target-toggle-btn');
const overallAdvisorMsg = document.getElementById('overallAdvisorMsg');

// Gauge & Counter Elements
const overallProgressRing = document.getElementById('overallProgressRing');
const overallPctText = document.getElementById('overallPctText');
const overallStatusBadge = document.getElementById('overallStatusBadge');
const subtextAttended = document.getElementById('subtextAttended');
const subtextConducted = document.getElementById('subtextConducted');

// Stat Tiles
const tilePresent = document.getElementById('tilePresent');
const tileAbsent = document.getElementById('tileAbsent');
const tileScheduled = document.getElementById('tileScheduled');

// Cards Container & Search
const subjectCardsContainer = document.getElementById('subjectCardsContainer');
const subjectCountBadge = document.getElementById('subjectCountBadge');
const subjectSearchInput = document.getElementById('subjectSearchInput');
const noSubjectsState = document.getElementById('noSubjectsState');

// Day-wise Elements
const dwWorkingDays = document.getElementById('dwWorkingDays');
const dwPresent = document.getElementById('dwPresent');
const dwAbsent = document.getElementById('dwAbsent');
const dwPercentage = document.getElementById('dwPercentage');
const absentDatesContainer = document.getElementById('absentDatesContainer');

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  // Check if session was cached
  const cachedData = sessionStorage.getItem('sathyabama_session');
  if (cachedData) {
    try {
      appData = JSON.parse(cachedData);
      renderDashboard();
    } catch (e) {
      sessionStorage.removeItem('sathyabama_session');
    }
  }

  setupEventListeners();
});

function setupEventListeners() {
  // Password visibility toggle
  togglePasswordBtn.addEventListener('click', () => {
    const isPass = passwordInput.type === 'password';
    passwordInput.type = isPass ? 'text' : 'password';
    togglePasswordBtn.innerHTML = isPass ? '<i class="fa-regular fa-eye-slash text-xs"></i>' : '<i class="fa-regular fa-eye text-xs"></i>';
  });

  // Login form submit
  loginForm.addEventListener('submit', handleLoginSubmit);

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // Refresh / Sync
  refreshBtn.addEventListener('click', () => {
    const reg = appData?.student?.registerNumber || regNoInput.value;
    const pass = passwordInput.value;
    if (reg && pass) {
      fetchAttendance(reg, pass, currentTarget);
    } else {
      handleLogout();
    }
  });

  // Print
  printBtn.addEventListener('click', () => {
    window.print();
  });

  // Target Toggle Buttons (75% vs 80%)
  targetToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      targetToggleBtns.forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'shadow');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-indigo-600', 'text-white', 'shadow');
      btn.classList.remove('text-slate-400');

      currentTarget = Number(btn.dataset.target);
      updateAdvisorAndCards();
    });
  });

  // Tab Switching
  tabHourwise.addEventListener('click', () => switchTab('hourwise'));
  tabDaywise.addEventListener('click', () => switchTab('daywise'));

  // Search Input
  subjectSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderSubjectCards();
  });

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'font-medium');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-indigo-600', 'text-white', 'font-medium');
      btn.classList.remove('text-slate-400');
      currentFilter = btn.dataset.filter;
      renderSubjectCards();
    });
  });
}

function switchTab(tab) {
  currentTab = tab;
  if (tab === 'hourwise') {
    tabHourwise.classList.add('bg-indigo-600', 'text-white', 'shadow');
    tabHourwise.classList.remove('text-slate-400');
    tabDaywise.classList.remove('bg-indigo-600', 'text-white', 'shadow');
    tabDaywise.classList.add('text-slate-400');
    hourwiseSection.classList.remove('hidden');
    daywiseSection.classList.add('hidden');
  } else {
    tabDaywise.classList.add('bg-indigo-600', 'text-white', 'shadow');
    tabDaywise.classList.remove('text-slate-400');
    tabHourwise.classList.remove('bg-indigo-600', 'text-white', 'shadow');
    tabHourwise.classList.add('text-slate-400');
    hourwiseSection.classList.add('hidden');
    daywiseSection.classList.remove('hidden');
  }
}

// Handle Login Submission
async function handleLoginSubmit(e) {
  e.preventDefault();
  loginError.classList.add('hidden');

  const regNo = regNoInput.value.trim();
  const password = passwordInput.value.trim();

  if (!regNo || !password) return;

  submitLoginBtn.disabled = true;
  submitBtnText.textContent = 'Authenticating...';
  submitBtnIcon.className = 'fa-solid fa-spinner fa-spin text-xs';

  await fetchAttendance(regNo, password, currentTarget);

  submitLoginBtn.disabled = false;
  submitBtnText.textContent = 'View Total Attendance';
  submitBtnIcon.className = 'fa-solid fa-arrow-right text-xs';
}

// Fetch Attendance API
async function fetchAttendance(registerNumber, password, targetPercent) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber, password, targetPercent })
    });

    const data = await res.json();

    if (!data.success) {
      loginErrorMsg.textContent = data.message || 'Login failed. Please check your credentials.';
      loginError.classList.remove('hidden');
      return;
    }

    appData = data.data;
    sessionStorage.setItem('sathyabama_session', JSON.stringify(appData));
    renderDashboard();

  } catch (err) {
    loginErrorMsg.textContent = 'Unable to connect to ERP. ' + err.message;
    loginError.classList.remove('hidden');
  }
}

// Logout
function handleLogout() {
  appData = null;
  sessionStorage.removeItem('sathyabama_session');
  dashboardSection.classList.add('hidden');
  headerUserActions.classList.add('hidden');
  loginSection.classList.remove('hidden');
  passwordInput.value = '';
}

// Render Complete Dashboard
function renderDashboard() {
  if (!appData) return;

  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  headerUserActions.classList.remove('hidden');

  const student = appData.student;
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=4f46e5&color=fff&size=128`;
  const photo = student.photoUrl || defaultAvatar;

  // Header
  navAvatar.src = photo;
  navStudentName.textContent = student.name;
  navRegNo.textContent = student.registerNumber;

  // Banner
  dashAvatar.src = photo;
  dashStudentName.textContent = student.name;
  dashRegBadge.textContent = student.registerNumber;
  dashCourseDetails.textContent = `${student.course} - ${student.programme}`;
  dashSemText.textContent = student.currentSemester;
  dashYearText.textContent = student.currentYear;
  dashSecText.textContent = student.section;
  dashDateRangeText.textContent = appData.currentSemester?.dateRange || 'Current Academic Semester';

  // Stats Counters
  const hw = appData.hourwiseSummary;
  tilePresent.textContent = `${hw.totalPresent}h`;
  tileAbsent.textContent = `${hw.totalAbsent}h`;
  tileScheduled.textContent = `${hw.totalScheduledHours}h`;

  // Day-wise stats
  const dw = appData.dailySummary;
  dwWorkingDays.textContent = dw.totalWorkingDays;
  dwPresent.textContent = dw.daysPresent;
  dwAbsent.textContent = dw.daysAbsent;
  dwPercentage.textContent = `${dw.percentage.toFixed(1)}%`;

  // Render Day-wise Absences
  absentDatesContainer.innerHTML = '';
  if (dw.absences && dw.absences.length > 0) {
    dw.absences.forEach(abs => {
      const chip = document.createElement('span');
      chip.className = 'px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono inline-flex items-center gap-1.5';
      chip.innerHTML = `<i class="fa-regular fa-calendar-xmark text-rose-400"></i> ${abs.date}`;
      absentDatesContainer.appendChild(chip);
    });
  } else {
    absentDatesContainer.innerHTML = '<span class="text-xs text-emerald-400">Zero recorded absent days!</span>';
  }

  // Update advisor & cards
  updateAdvisorAndCards();
}

// Compute dynamic buffer for a subject based on chosen target
function computeSubjectBuffer(present, conducted, targetPercent) {
  const target = targetPercent / 100;
  const pct = conducted > 0 ? (present / conducted) * 100 : 0;

  if (pct >= targetPercent) {
    const canSkip = Math.floor((present - target * conducted) / target);
    return {
      isSafe: true,
      canSkip: Math.max(0, canSkip),
      needToAttend: 0,
      label: `Can skip ${canSkip}h`
    };
  } else {
    const needToAttend = Math.ceil((target * conducted - present) / (1 - target));
    return {
      isSafe: false,
      canSkip: 0,
      needToAttend: Math.max(1, needToAttend),
      label: `Attend next ${needToAttend}h`
    };
  }
}

// Update Advisor & Gauge
function updateAdvisorAndCards() {
  if (!appData) return;

  const hw = appData.hourwiseSummary;
  const pct = hw.overallPercentage; // Single point e.g. 79.5%

  overallPctText.textContent = `${pct.toFixed(1)}%`;
  subtextAttended.textContent = hw.totalPresent;
  subtextConducted.textContent = hw.totalConductedHours;

  // SVG Circle Stroke calculation: radius = 50 => perimeter = 314.159
  const circumference = 314.159;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  overallProgressRing.style.strokeDashoffset = offset;

  const overallBuffer = computeSubjectBuffer(hw.totalPresent, hw.totalConductedHours, currentTarget);

  if (pct >= currentTarget) {
    overallProgressRing.setAttribute('class', 'text-emerald-400 fill-none transition-all duration-700 ease-out');
    overallStatusBadge.className = 'mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25';
    overallStatusBadge.textContent = 'Safe';
    overallAdvisorMsg.textContent = `Overall attendance is above ${currentTarget}%. You can safely skip ${overallBuffer.canSkip}h across all subjects.`;
  } else {
    overallProgressRing.setAttribute('class', 'text-rose-400 fill-none transition-all duration-700 ease-out');
    overallStatusBadge.className = 'mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/25';
    overallStatusBadge.textContent = 'Shortage';
    overallAdvisorMsg.textContent = `Below ${currentTarget}% target. Need ${overallBuffer.needToAttend}h more to reach ${currentTarget}%.`;
  }

  renderSubjectCards();
}

// Render Subject Cards (Matching Sistpilot Style)
function renderSubjectCards() {
  if (!appData || !appData.subjects) return;

  let filtered = appData.subjects.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery) || s.code.toLowerCase().includes(searchQuery);
    if (!matchSearch) return false;

    if (currentFilter === 'shortage') {
      return s.percentage < currentTarget;
    }
    if (currentFilter === 'THEORY') {
      return s.type === 'THEORY';
    }
    if (currentFilter === 'PRACTICAL') {
      return s.type === 'PRACTICAL';
    }
    return true;
  });

  subjectCountBadge.textContent = `${filtered.length} of ${appData.subjects.length}`;

  if (filtered.length === 0) {
    subjectCardsContainer.innerHTML = '';
    noSubjectsState.classList.remove('hidden');
    return;
  }
  noSubjectsState.classList.add('hidden');

  subjectCardsContainer.innerHTML = filtered.map(sub => {
    const buffer = computeSubjectBuffer(sub.present, sub.conductedHours, currentTarget);
    const isSafe = buffer.isSafe;

    // Single decimal point percentage
    const pctStr = `${sub.percentage.toFixed(1)}%`;

    // Colors matching sistpilot:
    // Safe: green (#34d399 / text-emerald-400)
    // Shortage: reddish coral (#f87171 / text-rose-400)
    const pctColor = isSafe ? 'text-emerald-400' : 'text-rose-400';
    const barFillColor = isSafe ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-red-400';

    // Status pill
    const pillClass = isSafe
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    const pillDot = isSafe
      ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1"></span>'
      : '<span class="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block mr-1"></span>';

    // Deficit warning if remaining hours in semester are fewer than needed
    let shortageWarning = '';
    if (!isSafe && buffer.needToAttend > sub.hoursLeft) {
      shortageWarning = `<span class="text-[10px] text-amber-400 block mt-1"><i class="fa-solid fa-circle-exclamation text-[9px] mr-1"></i>Deficit exceeds remaining syllabus hours (${buffer.needToAttend}h needed vs ~${sub.hoursLeft}h left).</span>`;
    }

    return `
      <div class="subject-card bg-[#121320] border border-[#20233a] rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <!-- Top Row: Name, Badge, Code & Percentage -->
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 class="text-sm sm:text-base font-bold text-white tracking-tight">${sub.name}</h3>
            <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${sub.type === 'PRACTICAL' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-[#1e2034] text-slate-300'}">
                ${sub.type}
              </span>
              <span class="font-mono text-slate-400">${sub.code}</span>
              <span class="text-slate-600">•</span>
              <span class="font-mono text-slate-300">${sub.present}/${sub.conductedHours} hrs</span>
            </div>
          </div>

          <!-- Single Point Percentage -->
          <div class="text-right flex-shrink-0">
            <span class="text-lg sm:text-xl font-extrabold font-mono ${pctColor}">${pctStr}</span>
          </div>
        </div>

        <!-- Progress Bar with Target Notch Marker -->
        <div class="relative my-3">
          <div class="progress-container w-full h-1.5 bg-[#1b1d30] rounded-full overflow-hidden">
            <div class="h-full ${barFillColor} rounded-full transition-all duration-700" style="width: ${Math.min(100, sub.percentage)}%"></div>
          </div>
          <!-- Target Notch Line -->
          <div class="progress-notch" style="left: ${currentTarget}%" title="Target: ${currentTarget}%"></div>
        </div>

        <!-- Bottom Row: Status Pill (Can skip / Attend next) & Hours Left -->
        <div class="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-[#181a2c]">
          <div class="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${pillClass}">
            ${pillDot} ${buffer.label}
          </div>

          <div class="text-[11px] text-slate-400 font-mono">
            ~${sub.hoursLeft}h left this sem
          </div>
        </div>

        ${shortageWarning}
      </div>
    `;
  }).join('');
}
