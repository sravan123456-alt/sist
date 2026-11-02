// Application State
let appData = null;
let currentTarget = 80;
let currentTab = 'hourwise';
let currentFilter = 'all';
let searchQuery = '';

// Simulation State
let simActive = false;
let simDeltaPresent = 0;
let simDeltaConducted = 0;
const simSubjectDeltas = {}; // { [subjectId]: { presentDelta: 0, conductedDelta: 0 } }

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const headerUserActions = document.getElementById('headerUserActions');
const headerSemBadge = document.getElementById('headerSemBadge');
const loginForm = document.getElementById('loginForm');
const regNoInput = document.getElementById('regNo');
const passwordInput = document.getElementById('password');
const rememberRegCheckbox = document.getElementById('rememberReg');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnIcon = document.getElementById('submitBtnIcon');
const loginError = document.getElementById('loginError');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const printBtn = document.getElementById('printBtn');
const shareBtn = document.getElementById('shareBtn');
const shareBtnText = document.getElementById('shareBtnText');

// Nav & Header Elements
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
const tabHourwiseText = document.getElementById('tabHourwiseText');
const tabDaywiseText = document.getElementById('tabDaywiseText');
const daywiseSemNote = document.getElementById('daywiseSemNote');
const absentDaysSemTitle = document.getElementById('absentDaysSemTitle');
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

// Simulator Elements
const toggleSimulatorBtn = document.getElementById('toggleSimulatorBtn');
const simulatorPanel = document.getElementById('simulatorPanel');
const simulatorChevron = document.getElementById('simulatorChevron');
const simActiveBadge = document.getElementById('simActiveBadge');
const resetSimBtn = document.getElementById('resetSimBtn');
const simPreviewDelta = document.getElementById('simPreviewDelta');

// Toast Elements
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMsg = document.getElementById('toastMsg');
let toastTimer = null;

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.debug('ServiceWorker registration skipped:', err);
    });
  }

  // Restore remembered Register Number
  const savedReg = localStorage.getItem('sist_saved_regno');
  if (savedReg) {
    regNoInput.value = savedReg;
    rememberRegCheckbox.checked = true;
  }

  // Restore cached session
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
  togglePasswordBtn.addEventListener('click', () => {
    const isPass = passwordInput.type === 'password';
    passwordInput.type = isPass ? 'text' : 'password';
    togglePasswordBtn.innerHTML = isPass
      ? '<i class="fa-regular fa-eye-slash text-xs"></i>'
      : '<i class="fa-regular fa-eye text-xs"></i>';
  });

  loginForm.addEventListener('submit', handleLoginSubmit);
  logoutBtn.addEventListener('click', handleLogout);

  refreshBtn.addEventListener('click', () => {
    const reg = appData?.student?.registerNumber || regNoInput.value;
    const pass = passwordInput.value;
    if (reg && pass) {
      resetSimulation();
      fetchAttendance(reg, pass, currentTarget);
    } else {
      showToast('Please login again to sync fresh data from ERP.', false);
      handleLogout();
    }
  });

  printBtn.addEventListener('click', () => {
    window.print();
  });

  shareBtn.addEventListener('click', handleShareSummary);

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

  tabHourwise.addEventListener('click', () => switchTab('hourwise'));
  tabDaywise.addEventListener('click', () => switchTab('daywise'));

  subjectSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderSubjectCards();
  });

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

  // Simulator Toggle
  toggleSimulatorBtn.addEventListener('click', () => {
    const isHidden = simulatorPanel.classList.contains('hidden');
    if (isHidden) {
      simulatorPanel.classList.remove('hidden');
      simulatorChevron.classList.add('rotate-180');
    } else {
      simulatorPanel.classList.add('hidden');
      simulatorChevron.classList.remove('rotate-180');
    }
  });

  // Quick Preset Simulator Buttons
  document.querySelectorAll('.sim-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const hours = Number(btn.dataset.hours);
      if (action === 'miss') {
        simDeltaConducted += hours;
      } else if (action === 'attend') {
        simDeltaConducted += hours;
        simDeltaPresent += hours;
      }
      simActive = true;
      updateAdvisorAndCards();
      showToast(`Simulated: ${action === 'miss' ? 'Missed' : 'Attended'} ${hours}h`);
    });
  });

  resetSimBtn.addEventListener('click', () => {
    resetSimulation();
    updateAdvisorAndCards();
    showToast('Simulation reset to actual ERP data.');
  });
}

function resetSimulation() {
  simActive = false;
  simDeltaPresent = 0;
  simDeltaConducted = 0;
  Object.keys(simSubjectDeltas).forEach(k => delete simSubjectDeltas[k]);
  simActiveBadge.classList.add('hidden');
  resetSimBtn.classList.add('hidden');
  simPreviewDelta.textContent = '';
}

function showToast(message, isSuccess = true) {
  if (toastTimer) clearTimeout(toastTimer);
  toastMsg.textContent = message;
  toastIcon.className = isSuccess
    ? 'fa-solid fa-circle-check text-emerald-400'
    : 'fa-solid fa-circle-exclamation text-amber-400';

  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
  toast.classList.add('opacity-100', 'translate-y-0');

  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
  }, 2500);
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

async function handleLoginSubmit(e) {
  e.preventDefault();
  loginError.classList.add('hidden');

  const regNo = regNoInput.value.trim();
  const password = passwordInput.value.trim();

  if (!regNo || !password) return;

  if (rememberRegCheckbox.checked) {
    localStorage.setItem('sist_saved_regno', regNo);
  } else {
    localStorage.removeItem('sist_saved_regno');
  }

  submitLoginBtn.disabled = true;
  submitBtnText.textContent = 'Authenticating with ERP...';
  submitBtnIcon.className = 'fa-solid fa-spinner fa-spin text-xs';

  await fetchAttendance(regNo, password, currentTarget);

  submitLoginBtn.disabled = false;
  submitBtnText.textContent = 'View Total Attendance';
  submitBtnIcon.className = 'fa-solid fa-arrow-right text-xs';
}

async function fetchAttendance(registerNumber, password, targetPercent) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerNumber, password, targetPercent })
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('Non-JSON response received:', text.slice(0, 300));
      throw new Error('Sathyabama ERP took too long or returned an unexpected format. Please try again in 5 seconds.');
    }

    if (!data.success) {
      loginErrorMsg.textContent = data.message || 'Login failed. Please check your credentials.';
      loginError.classList.remove('hidden');
      return;
    }

    appData = data.data;
    sessionStorage.setItem('sathyabama_session', JSON.stringify(appData));
    resetSimulation();
    renderDashboard();

  } catch (err) {
    loginErrorMsg.textContent = err.message || 'Unable to connect to ERP.';
    loginError.classList.remove('hidden');
  }
}

function handleLogout() {
  appData = null;
  resetSimulation();
  sessionStorage.removeItem('sathyabama_session');
  dashboardSection.classList.add('hidden');
  headerUserActions.classList.add('hidden');
  headerSemBadge.classList.add('hidden');
  loginSection.classList.remove('hidden');
  passwordInput.value = '';
}

function handleShareSummary() {
  if (!appData) return;

  const s = appData.student;
  const hw = appData.hourwiseSummary;
  const dw = appData.dailySummary;
  const buf = computeSubjectBuffer(hw.totalEffectivePresent, hw.totalConductedHours, currentTarget);

  const summary = [
    `🎓 *SIST Attendance Tracker*`,
    `👤 ${s.name} (${s.registerNumber})`,
    `📚 Semester ${s.currentSemester} • ${s.course} (${s.programme})`,
    `📊 Overall Attendance: ${hw.overallPercentage.toFixed(1)}%`,
    `⏱️ Hours: ${hw.totalEffectivePresent}/${hw.totalConductedHours} hrs attended`,
    `🛡️ Advisor (${currentTarget}% Target): ${buf.label}`,
    `📅 Working Days: ${dw.daysPresent}/${dw.totalWorkingDays} days (${dw.percentage.toFixed(1)}%)`,
    `\nCheck your total attendance at SIST Attendance Tracker!`
  ].join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(summary).then(() => {
      showToast('Attendance summary copied to clipboard! 📋');
      shareBtnText.textContent = 'Copied!';
      setTimeout(() => { shareBtnText.textContent = 'Share'; }, 2000);
    }).catch(() => {
      prompt('Copy your attendance summary:', summary);
    });
  } else {
    prompt('Copy your attendance summary:', summary);
  }
}

function renderDashboard() {
  if (!appData) return;

  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  headerUserActions.classList.remove('hidden');

  const student = appData.student;
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=4f46e5&color=fff&size=128`;
  const photo = student.photoUrl || defaultAvatar;

  // Header dynamic badge
  headerSemBadge.textContent = `Semester ${student.currentSemester}`;
  headerSemBadge.classList.remove('hidden');

  navAvatar.src = photo;
  navStudentName.textContent = student.name;
  navRegNo.textContent = student.registerNumber;

  dashAvatar.src = photo;
  dashStudentName.textContent = student.name;
  dashRegBadge.textContent = student.registerNumber;
  dashCourseDetails.textContent = `${student.course} - ${student.programme}`;
  dashSemText.textContent = student.currentSemester;
  dashYearText.textContent = student.currentYear;
  dashSecText.textContent = student.section;
  dashDateRangeText.textContent = appData.currentSemester?.dateRange || 'Current Academic Semester';

  // Dynamic Semester references
  daywiseSemNote.textContent = `Strictly for Semester ${student.currentSemester}`;
  absentDaysSemTitle.innerHTML = `<i class="fa-solid fa-circle-exclamation text-rose-400 text-[10px]"></i> Recorded Absent Days (Semester ${student.currentSemester}):`;

  const dw = appData.dailySummary;
  dwWorkingDays.textContent = dw.totalWorkingDays;
  dwPresent.textContent = dw.daysPresent;
  dwAbsent.textContent = dw.daysAbsent;
  dwPercentage.textContent = `${dw.percentage.toFixed(1)}%`;
  tabDaywiseText.textContent = `Day-Wise Working Days (${dw.percentage.toFixed(1)}%)`;

  absentDatesContainer.innerHTML = '';
  if (dw.absences && dw.absences.length > 0) {
    dw.absences.forEach(abs => {
      const chip = document.createElement('span');
      chip.className = 'px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono inline-flex items-center gap-1.5';
      chip.innerHTML = `<i class="fa-regular fa-calendar-xmark text-rose-400"></i> ${abs.date}`;
      absentDatesContainer.appendChild(chip);
    });
  } else {
    absentDatesContainer.innerHTML = '<span class="text-xs text-emerald-400 font-mono">Zero recorded absent days!</span>';
  }

  updateAdvisorAndCards();
}

function computeSubjectBuffer(present, conducted, targetPercent) {
  const target = targetPercent / 100;
  const pct = conducted > 0 ? (present / conducted) * 100 : 0;

  if (pct >= targetPercent) {
    const canSkip = Math.floor((present - target * conducted) / target);
    return {
      isSafe: true,
      canSkip: Math.max(0, canSkip),
      needToAttend: 0,
      label: `Can skip ${Math.max(0, canSkip)}h`
    };
  } else {
    const needToAttend = Math.ceil((target * conducted - present) / (1 - target));
    return {
      isSafe: false,
      canSkip: 0,
      needToAttend: Math.max(1, needToAttend),
      label: `Attend next ${Math.max(1, needToAttend)}h`
    };
  }
}

function updateAdvisorAndCards() {
  if (!appData) return;

  const hw = appData.hourwiseSummary;

  // Apply Simulation Deltas
  const totalPres = hw.totalEffectivePresent + simDeltaPresent;
  const totalCond = hw.totalConductedHours + simDeltaConducted;
  const pct = totalCond > 0 ? Number(((totalPres / totalCond) * 100).toFixed(1)) : 0;

  overallPctText.textContent = `${pct.toFixed(1)}%`;
  subtextAttended.textContent = totalPres;
  subtextConducted.textContent = totalCond;
  tilePresent.textContent = `${totalPres}h`;
  tileAbsent.textContent = `${Math.max(0, totalCond - totalPres)}h`;
  tileScheduled.textContent = `${hw.totalScheduledHours}h`;
  tabHourwiseText.textContent = `Subject-Wise Classes (${pct.toFixed(1)}%)`;

  const circumference = 314.159;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  overallProgressRing.style.strokeDashoffset = offset;

  const overallBuffer = computeSubjectBuffer(totalPres, totalCond, currentTarget);

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

  // Simulator UI feedback
  if (simDeltaConducted !== 0 || Object.keys(simSubjectDeltas).length > 0) {
    simActive = true;
    simActiveBadge.classList.remove('hidden');
    resetSimBtn.classList.remove('hidden');
    const origPct = hw.overallPercentage;
    const diff = Number((pct - origPct).toFixed(1));
    const sign = diff >= 0 ? `+${diff}%` : `${diff}%`;
    simPreviewDelta.textContent = `Original: ${origPct.toFixed(1)}% → Simulated: ${pct.toFixed(1)}% (${sign})`;
  } else {
    simActiveBadge.classList.add('hidden');
    resetSimBtn.classList.add('hidden');
    simPreviewDelta.textContent = '';
  }

  renderSubjectCards();
}

function handleSubjectSim(subjectId, action) {
  if (!simSubjectDeltas[subjectId]) {
    simSubjectDeltas[subjectId] = { presentDelta: 0, conductedDelta: 0 };
  }

  if (action === 'miss') {
    simSubjectDeltas[subjectId].conductedDelta += 1;
    simDeltaConducted += 1;
  } else if (action === 'attend') {
    simSubjectDeltas[subjectId].presentDelta += 1;
    simSubjectDeltas[subjectId].conductedDelta += 1;
    simDeltaPresent += 1;
    simDeltaConducted += 1;
  }

  simActive = true;
  updateAdvisorAndCards();
}

function renderSubjectCards() {
  if (!appData || !appData.subjects) return;

  const filtered = appData.subjects.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery) || s.code.toLowerCase().includes(searchQuery);
    if (!matchSearch) return false;

    const subDelta = simSubjectDeltas[s.id] || { presentDelta: 0, conductedDelta: 0 };
    const curPres = s.effectivePresent + subDelta.presentDelta;
    const curCond = s.conductedHours + subDelta.conductedDelta;
    const curPct = curCond > 0 ? (curPres / curCond) * 100 : 0;

    if (currentFilter === 'shortage') {
      return curPct < currentTarget;
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
    const subDelta = simSubjectDeltas[sub.id] || { presentDelta: 0, conductedDelta: 0 };
    const curPres = sub.effectivePresent + subDelta.presentDelta;
    const curCond = sub.conductedHours + subDelta.conductedDelta;
    const pctNum = curCond > 0 ? Number(((curPres / curCond) * 100).toFixed(1)) : 0;

    const buffer = computeSubjectBuffer(curPres, curCond, currentTarget);
    const isSafe = buffer.isSafe;
    const pctStr = `${pctNum.toFixed(1)}%`;

    const pctColor = isSafe ? 'text-emerald-400' : 'text-rose-400';
    const barFillColor = isSafe
      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
      : 'bg-gradient-to-r from-rose-500 to-red-400';

    const pillClass = isSafe
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    const pillDot = isSafe
      ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1"></span>'
      : '<span class="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block mr-1"></span>';

    let shortageWarning = '';
    if (!isSafe && buffer.needToAttend > sub.hoursLeft) {
      shortageWarning = `<span class="text-[10px] text-amber-400 block mt-1.5"><i class="fa-solid fa-circle-exclamation text-[9px] mr-1"></i>Deficit exceeds remaining syllabus hours (${buffer.needToAttend}h needed vs ~${sub.hoursLeft}h left).</span>`;
    }

    const isSimulated = subDelta.conductedDelta > 0;
    const simIndicator = isSimulated
      ? `<span class="text-[10px] text-amber-400 font-mono">(sim: +${subDelta.presentDelta}/${subDelta.conductedDelta}h)</span>`
      : '';

    return `
      <div class="subject-card bg-[#121320] border border-[#20233a] rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 class="text-sm sm:text-base font-bold text-white tracking-tight">${sub.name}</h3>
            <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${sub.type === 'PRACTICAL' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-[#1e2034] text-slate-300'}">
                ${sub.type}
              </span>
              <span class="font-mono text-slate-400">${sub.code}</span>
              <span class="text-slate-600">•</span>
              <span class="font-mono text-slate-300">${curPres}/${curCond} hrs</span>
              ${simIndicator}
            </div>
          </div>

          <div class="text-right flex-shrink-0 flex flex-col items-end gap-1">
            <span class="text-lg sm:text-xl font-extrabold font-mono ${pctColor}">${pctStr}</span>
            <div class="flex items-center gap-1">
              <button onclick="handleSubjectSim(${sub.id}, 'miss')" title="Simulate missing 1 hour"
                class="px-1.5 py-0.5 rounded bg-[#181a2d] hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-mono transition">
                -1h
              </button>
              <button onclick="handleSubjectSim(${sub.id}, 'attend')" title="Simulate attending 1 hour"
                class="px-1.5 py-0.5 rounded bg-[#181a2d] hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono transition">
                +1h
              </button>
            </div>
          </div>
        </div>

        <div class="relative my-3">
          <div class="progress-container w-full h-1.5 bg-[#1b1d30] rounded-full overflow-hidden">
            <div class="h-full ${barFillColor} rounded-full transition-all duration-700" style="width: ${Math.min(100, pctNum)}%"></div>
          </div>
          <div class="progress-notch" style="left: ${currentTarget}%" title="Target: ${currentTarget}%"></div>
        </div>

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
