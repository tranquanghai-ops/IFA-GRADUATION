// PHASE 2: STUDENT PORTAL ENHANCEMENTS
// ============================================================================

window.startStudentRegistration = function() {
  const ctaCard = document.getElementById('registration-cta-card');
  const flowContainer = document.getElementById('registration-flow-container');
  if (ctaCard) ctaCard.classList.add('hidden');
  positionStudentRegistrationCta();
  if (flowContainer) {
    flowContainer.classList.remove('hidden');
    flowContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  state.selectedPreferences = [];
  const topicInput = document.getElementById('input-topic-title');
  if (topicInput) topicInput.value = '';
  setSelectedProjectTypes([]);
  populateRegistrationStudentForm();
  goToStep(1);
};

window.cancelRegistrationEdit = function() {
  const flowContainer = document.getElementById('registration-flow-container');
  const ctaCard = document.getElementById('registration-cta-card');
  const alreadyCard = document.getElementById('already-registered-card');
  if (flowContainer) flowContainer.classList.add('hidden');
  if (state.myRegistration) {
    if (alreadyCard) alreadyCard.classList.remove('hidden');
  } else {
    if (ctaCard) ctaCard.classList.remove('hidden');
  }
  positionStudentRegistrationCta();
};

window.updateStudentJourneyStepper = function() {
  positionStudentRegistrationCta();
  const container = document.getElementById('journey-steps-list');
  if (!container) return;

  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const userMssv = mssv || state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const round = state.activeRound;
  const reg = state.myRegistration;
  const effectiveAssignment = normalizeOfficialAssignment(state.myOfficialAssignment, reg);
  const officialList = effectiveAssignment ? getOfficialSupervisors(effectiveAssignment) : [];
  const hasOfficialSup = (state.myOfficialAssignment?.assignmentStatus === 'published')
    ? (officialList.length > 0 || Boolean(effectiveAssignment?.assignedSupervisorId || effectiveAssignment?.officialSupervisor || effectiveAssignment?.acceptedSupervisorName))
    : (officialList.length > 0 || Boolean(reg?.assignedSupervisorId || reg?.officialSupervisor));

  const activities = Array.isArray(round?.activities) ? round.activities : [];

  const findAct = (pattern) => activities.find(a => {
    const text = `${a.title || ''} ${a.name || ''} ${a.activityType || ''} ${a.slug || ''}`.toLowerCase();
    return pattern.test(text);
  });

  const getActStepStatus = (act, prevCompleted) => {
    if (!act) {
      return prevCompleted ? { status: 'upcoming', label: 'Chờ mở' } : { status: 'upcoming', label: 'Chưa tới' };
    }
    const actStatus = (typeof getActivityStatus === 'function') ? getActivityStatus(act) : 'upcoming';
    let isSubmitted = false;
    if (typeof getEffectiveSubmissionRules === 'function' && userMssv) {
      try {
        const rules = getEffectiveSubmissionRules(userMssv, act, round);
        if (rules?.currentSubmission && rules.currentSubmission.status === 'submitted') {
          isSubmitted = true;
        }
      } catch (e) {}
    }

    if (isSubmitted) {
      return { status: 'completed', label: 'Hoàn tất' };
    }
    if (actStatus === 'ongoing') {
      return { status: 'active', label: 'Đang mở' };
    }
    if (actStatus === 'past') {
      return { status: 'completed', label: 'Đã qua' };
    }
    if (prevCompleted) {
      return { status: 'active', label: 'Chuẩn bị' };
    }
    return { status: 'upcoming', label: 'Chưa tới' };
  };

  // 1. Phân công GVHD
  // Yêu cầu: khi khoa đã công bố GVHD rồi thì mục này sẽ xanh lên
  let s1Status = 'upcoming';
  let s1Label = 'Chờ phân công';
  if (hasOfficialSup) {
    s1Status = 'completed'; // Green
    s1Label = 'Đã công bố';
  } else if (round?.status === 'reviewing' || round?.status === 'open' || round?.status === 'finalized') {
    s1Status = 'active';
    s1Label = 'Đang phân công';
  }

  // 2. Đăng ký đề tài
  let s2Status = 'upcoming';
  let s2Label = 'Chưa đăng ký';
  const hasTopic = Boolean(reg?.topicTitle || reg?.topic || reg?.proposalTitle || reg?.title || reg?.topicName);
  if (hasTopic) {
    s2Status = 'completed';
    s2Label = 'Đã đăng ký';
  } else if (s1Status === 'completed' || round?.status === 'open') {
    s2Status = 'active';
    s2Label = 'Đang nhận ĐK';
  }

  // 3. Duyệt đợt 1
  const actDuyet1 = findAct(/(duyệt\s*(đợt)?\s*1|duyet\s*1|review\s*1)/i);
  const s3 = getActStepStatus(actDuyet1, s2Status === 'completed');

  // 4. Duyệt Đợt 2
  const actDuyet2 = findAct(/(duyệt\s*(đợt)?\s*2|duyet\s*2|review\s*2)/i);
  const s4 = getActStepStatus(actDuyet2, s3.status === 'completed');

  // 5. Duyệt Đợt 3
  const actDuyet3 = findAct(/(duyệt\s*(đợt)?\s*3|duyet\s*3|review\s*3)/i);
  const s5 = getActStepStatus(actDuyet3, s4.status === 'completed');

  // 6. Kiểm tra đạo văn
  const actDaoVan = findAct(/(đạo\s*văn|dao\s*van|turnitin|plagiarism)/i);
  const s6 = getActStepStatus(actDaoVan, s5.status === 'completed');

  // 7. Nộp Thuyết minh
  const actThuyetMinh = findAct(/(thuyết\s*minh|thuyet\s*minh)/i);
  const s7 = getActStepStatus(actThuyetMinh, s6.status === 'completed');

  // 8. Nộp Sơ Khảo
  const actSoKhao = findAct(/(sơ\s*khảo|so\s*khao)/i);
  const s8 = getActStepStatus(actSoKhao, s7.status === 'completed');

  // 9. Bảo vệ TN
  const actBaoVe = findAct(/(bảo\s*vệ|bao\s*ve|defense|hội\s*đồng)/i);
  let s9Status = 'upcoming';
  let s9Label = 'Chưa tới';
  const hasDefenseScore = Boolean(reg?.defenseScore || reg?.finalDefenseScore || state.studentDefenseScore);
  if (hasDefenseScore) {
    s9Status = 'completed';
    s9Label = 'Đã bảo vệ';
  } else if (actBaoVe) {
    const actBvStatus = (typeof getActivityStatus === 'function') ? getActivityStatus(actBaoVe) : 'upcoming';
    if (actBvStatus === 'ongoing') {
      s9Status = 'active';
      s9Label = 'Đang diễn ra';
    } else if (actBvStatus === 'past') {
      s9Status = 'completed';
      s9Label = 'Đã diễn ra';
    } else if (s8.status === 'completed') {
      s9Status = 'active';
      s9Label = 'Chuẩn bị BV';
    }
  } else if (s8.status === 'completed') {
    s9Status = 'active';
    s9Label = 'Chuẩn bị BV';
  }

  // 10. Kết quả
  let s10Status = 'upcoming';
  let s10Label = 'Chưa tới';
  const isResultsPublished = Boolean(round?.publishFinalScoreToStudents || round?.resultsPublished || (round?.status === 'finalized' && hasDefenseScore));
  if (isResultsPublished) {
    s10Status = 'completed';
    s10Label = 'Đã công bố';
  } else if (s9Status === 'completed' || s9Status === 'active') {
    s10Status = 'active';
    s10Label = 'Chờ công bố';
  }

  const steps = [
    { num: 1, title: 'Phân công GVHD', shortTitle: '1. Phân công GVHD', status: s1Status, label: s1Label },
    { num: 2, title: 'Đăng ký đề tài', shortTitle: '2. Đăng ký đề tài', status: s2Status, label: s2Label },
    { num: 3, title: 'Duyệt đợt 1', shortTitle: '3. Duyệt đợt 1', status: s3.status, label: s3.label },
    { num: 4, title: 'Duyệt Đợt 2', shortTitle: '4. Duyệt Đợt 2', status: s4.status, label: s4.label },
    { num: 5, title: 'Duyệt Đợt 3', shortTitle: '5. Duyệt Đợt 3', status: s5.status, label: s5.label },
    { num: 6, title: 'Kiểm tra đạo văn', shortTitle: '6. Đạo văn', status: s6.status, label: s6.label },
    { num: 7, title: 'Nộp Thuyết minh', shortTitle: '7. Thuyết minh', status: s7.status, label: s7.label },
    { num: 8, title: 'Nộp Sơ Khảo', shortTitle: '8. Sơ Khảo', status: s8.status, label: s8.label },
    { num: 9, title: 'Bảo vệ TN', shortTitle: '9. Bảo vệ TN', status: s9Status, label: s9Label },
    { num: 10, title: 'Kết quả', shortTitle: '10. Kết quả', status: s10Status, label: s10Label }
  ];

  const statusStyles = {
    completed: {
      circle: 'bg-emerald-600 text-white font-black shadow-sm',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      border: 'border-emerald-200 bg-emerald-50/50',
      icon: '✓'
    },
    active: {
      circle: 'bg-blue-600 text-white font-black shadow-sm animate-pulse',
      badge: 'bg-blue-50 text-blue-800 border-blue-300 font-bold',
      border: 'border-blue-300 bg-blue-50/70 shadow-xs ring-1 ring-blue-300',
      icon: '●'
    },
    warning: {
      circle: 'bg-rose-600 text-white font-black shadow-sm',
      badge: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
      border: 'border-rose-200 bg-rose-50/50',
      icon: '✕'
    },
    upcoming: {
      circle: 'bg-slate-200 text-slate-600 font-bold',
      badge: 'bg-slate-50 text-slate-500 border-slate-200',
      border: 'border-slate-100 bg-slate-50/60',
      icon: null
    }
  };

  container.innerHTML = steps.map(s => {
    const st = statusStyles[s.status] || statusStyles.upcoming;
    return `
      <div class="p-2 sm:p-2.5 rounded-xl border ${st.border} flex flex-col items-center text-center transition-all min-w-0">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${st.circle}">
          ${st.icon || s.num}
        </div>
        <span class="font-bold text-[10px] sm:text-[11px] text-slate-800 leading-tight mb-1 whitespace-nowrap overflow-hidden text-ellipsis w-full" title="${s.title}">${s.shortTitle}</span>
        <span class="text-[9px] px-1 py-0.5 rounded-full border ${st.badge} whitespace-nowrap leading-none">${s.label}</span>
      </div>
    `;
  }).join('');
};

window.onRoundStartDateChanged = function(val) {
  const input = document.getElementById('round-form-start-date');
  const feedback = document.getElementById('round-start-date-feedback');
  if (!val) {
    if (feedback) feedback.innerHTML = '<span class="text-slate-500 italic">Chưa chọn ngày bắt đầu (mặc định sẽ dùng ngày mở đợt).</span>';
    window.refreshRoundWeekDayPickers?.();
    return;
  }
  const parts = val.split('-');
  if (parts.length !== 3) return;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const day = d.getDay(); // 0: Sun, 1: Mon, ...
  const pad = n => String(n).padStart(2, '0');

  if (day !== 1) {
    // Auto-snap to Monday of this week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const monStr = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
    if (input) input.value = monStr;
    if (feedback) {
      feedback.innerHTML = `<span class="text-blue-700 font-bold">✓ Đã tự động chuyển về Thứ Hai: <b>${monStr}</b></span>`;
    }
  } else {
    if (feedback) {
      feedback.innerHTML = `<span class="text-emerald-700 font-bold">✓ Hợp lệ: Thứ Hai (${val})</span>`;
    }
  }
  window.refreshRoundWeekDayPickers?.();
};

window.prevTimelineWeek = function() {
  if (typeof state.timelineTrackIndex !== 'number') state.timelineTrackIndex = 0;
  if (state.timelineTrackIndex > 0) {
    state.timelineTrackIndex--;
    renderStudentTimelineWeeks();
  }
};

window.nextTimelineWeek = function() {
  if (typeof state.timelineTrackIndex !== 'number') state.timelineTrackIndex = 0;
  const track = document.getElementById('timeline-cards-track');
  if (!track) return;
  const totalCards = track.children.length;
  const visibleCount = _getTimelineVisibleCount();
  const maxIndex = Math.max(0, totalCards - visibleCount);
  if (state.timelineTrackIndex < maxIndex) {
    state.timelineTrackIndex++;
    renderStudentTimelineWeeks();
  }
};

// Aliases for compatibility
window.prevTimelineWeeksPage = window.prevTimelineWeek;
window.nextTimelineWeeksPage = window.nextTimelineWeek;

// Helper: determine how many cards are visible based on container width
function _getTimelineVisibleCount() {
  const wrapper = document.getElementById('timeline-cards-track')?.parentElement;
  if (!wrapper) return 4;
  const w = wrapper.offsetWidth;
  if (w < 720) return 1;
  if (w < 1150) return 2;
  return 3;
}

function renderSupervisorRoundTimeline(round) {
  const container = document.getElementById('supervisor-round-timeline');
  if (!container) return;
  if (typeof renderUnifiedRoundTimeline === 'function') {
    const html = renderUnifiedRoundTimeline(round, { role: 'supervisor' });
    container.innerHTML = html;
    container.classList.toggle('hidden', !html);
    return;
  }
  const allWeeks = getRoundTimelineWeeksWithActivities(round, true);
  const weeks = allWeeks.filter(week => week.visible);
  rememberRoundTimelineEvents(round.id, weeks);
  container.classList.toggle('hidden', weeks.length === 0);
  if (!weeks.length) return;
  const current = allWeeks.find(week => week.status === 'ongoing');
  const completed = allWeeks.filter(week => week.status === 'completed').length;
  const currentTitle = current ? resolveRoundWeekTitle(current.week, current.title) : null;
  const hasCustomSokhao = allWeeks.some(w => w.week >= 13 && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('sơ khảo')) || allWeeks.length >= 13;
  const hasCustomBaove = allWeeks.some(w => w.week >= 14 && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('bảo vệ')) || allWeeks.length >= 14;
  const hasCustomKetqua = allWeeks.some(w => w.week >= 15 && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('kết quả')) || allWeeks.length >= 15;
  const stageCard = (icon, title, note) => `<div class="ifa-timeline-card min-w-[290px] max-w-[290px] snap-start rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center justify-center text-center"><span class="mb-2 text-2xl">${icon}</span><strong class="text-xs text-slate-900">${title}</strong><span class="mt-1 text-[10px] text-slate-500">${note}</span></div>`;
  container.innerHTML = `<div class="mb-3 flex flex-wrap items-center justify-between gap-2"><div class="flex items-center gap-2"><span class="text-xl">🗓️</span><div><h2 class="text-sm font-black text-slate-900">Lộ trình đồ án tốt nghiệp & tiến độ thực hiện</h2><p class="text-[11px] text-slate-500">Kế hoạch ${allWeeks.length} tuần · Chọn sự kiện để xem chi tiết</p></div></div><span class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">${current ? `Đang diễn ra: ${escapeHtml(currentTitle)}` : `Đã qua ${completed}/${allWeeks.length} tuần`}</span></div>
    <div class="flex gap-3 overflow-x-auto pb-2 snap-x">${stageCard('📝', 'Đăng ký đề tài', 'Sinh viên đăng ký đề tài')}${stageCard('👨‍🏫', 'Phân công GVHD', isDirectSupervisorAssignment(round) ? 'Khoa phân công' : 'Xét nguyện vọng')}${weeks.map(week => {
      const resolvedTitle = resolveRoundWeekTitle(week.week, week.title);
      const circleContent = week.status === 'completed' ? '✓' : week.status === 'ongoing' ? '●' : (week.week > 12 ? (week.week === 13 ? '📄' : week.week === 14 ? '🎓' : '📌') : week.week);
      return `<div class="ifa-timeline-card min-w-[290px] max-w-[290px] snap-start rounded-2xl border p-3 ${week.status === 'ongoing' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}">
      <div class="flex items-center justify-between gap-1"><strong class="text-xs text-slate-900 whitespace-nowrap">${escapeHtml(resolvedTitle)}</strong>${week.milestone ? `<span class="rounded-md bg-amber-500 px-1.5 py-0.5 text-center text-[9px] font-black leading-tight text-white">🚩 ${escapeHtml(week.milestone)}</span>` : ''}<span class="text-[10px] font-bold text-slate-500 whitespace-nowrap">${week.status === 'ongoing' ? 'Đang diễn ra' : week.status === 'completed' ? 'Đã qua' : 'Chưa tới'}</span></div>
      <div class="mx-auto my-2 flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${week.status === 'ongoing' ? 'bg-blue-600 text-white' : week.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">${circleContent}</div>
      <p class="mt-2 text-center font-mono text-[11px] font-bold text-slate-700">${week.dateText}</p>
      ${renderTimelineWeekDays(week.days, week.events, week.week, round.id)}
      ${renderTimelineWeekEvents(week.events, week.week, round.id)}
      ${week.note ? `<p class="mt-2 text-[10px] text-slate-600">${escapeHtml(week.note)}</p>` : ''}
    </div>`;
    }).join('')}${!hasCustomSokhao ? stageCard('📄', 'Nộp Sơ khảo', 'Sau giai đoạn thực hiện') : ''}${!hasCustomBaove ? stageCard('🎓', 'Bảo vệ Tốt nghiệp', 'Theo lịch của Khoa') : ''}${!hasCustomKetqua ? stageCard('🏆', 'Kết quả', 'Sau bảo vệ tốt nghiệp') : ''}</div>`;
}

function renderSupervisorPlanList(round) {
  const section = document.getElementById('supervisor-plan-section');
  const container = document.getElementById('supervisor-plan-list');
  if (!section || !container) return;
  section.classList.remove('hidden');
  if (typeof renderUnifiedPlanList === 'function') {
    renderUnifiedPlanList(round, { role: 'supervisor', container, prefix: 'sup' });
    return;
  }
  const activities = (Array.isArray(round.activities) ? round.activities : [])
    .map((activity, index) => normalizeActivity(activity, round.id, index))
    .filter(activity => isActivityPublished(activity))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!activities.length) {
    container.innerHTML = '<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">Khoa chưa công bố mốc kế hoạch cho đợt này.</div>';
    return;
  }
  const nearest = findNearestMilestone(activities);
  container.innerHTML = activities.map(activity => {
    const isNearest = Boolean(nearest && nearest.act && nearest.act.id === activity.id);
    return renderUnifiedActivityCard(activity, round, {
      isStudent: false,
      isNearest,
      nearestType: nearest?.type || 'ongoing',
      nearestTargetMs: nearest?.targetMs || null,
      prefix: 'sup'
    });
  }).join('');
  startMilestoneCountdownTicker();
}

let studentRegistrationCtaOriginalPosition = null;
function positionStudentRegistrationCta() {
  const cta = document.getElementById('registration-cta-card');
  const journey = document.getElementById('student-journey-card');
  if (!cta || !journey) return;
  if (!studentRegistrationCtaOriginalPosition) {
    studentRegistrationCtaOriginalPosition = document.createComment('registration-cta-original-position');
    cta.parentNode?.insertBefore(studentRegistrationCtaOriginalPosition, cta);
  }
  if (!state.myRegistration && !cta.classList.contains('hidden')) {
    journey.parentNode?.insertBefore(cta, journey);
  } else if (studentRegistrationCtaOriginalPosition.parentNode) {
    studentRegistrationCtaOriginalPosition.parentNode.insertBefore(cta, studentRegistrationCtaOriginalPosition.nextSibling);
  }
}

window.renderStudentTimelineWeeks = function() {
  // NEW: target the card slider track (old grid is kept hidden for compat)
  const track = document.getElementById('timeline-cards-track');
  const rangeEl = document.getElementById('timeline-weeks-dates-range');
  const badgeEl = document.getElementById('timeline-weeks-current-badge');
  if (!track) return;

  const round = state.activeRound || (state.rounds || []).find(r => r.id === state.selectedRoundId) || (state.rounds || [])[0];
  positionStudentRegistrationCta();
  const durationWeeks = parseInt(round?.durationWeeks, 10) || 12;

  // ── Date helpers ──────────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');
  const fmtShortDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const fmtFullDate  = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  // ── Determine starting Monday ──────────────────────────────────
  let startMonday = null;
  const configuredStart = round?.startDate || round?.datnStartDate;
  if (configuredStart) {
    let d = new Date(configuredStart?.toDate ? configuredStart.toDate() : configuredStart);
    if (!isNaN(d.getTime())) {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startMonday = new Date(d.setDate(diff));
      startMonday.setHours(0, 0, 0, 0);
    }
  }
  if (!startMonday) {
    let d = round?.openAt ? new Date(round.openAt?.toDate ? round.openAt.toDate() : round.openAt) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    startMonday = new Date(d.setDate(diff));
    startMonday.setHours(0, 0, 0, 0);
  }

  const now = new Date();
  let currentWeekNum = null;
  const weeks = [];

  for (let w = 0; w < durationWeeks; w++) {
    const wStart = new Date(startMonday.getTime() + w * 7 * 24 * 3600 * 1000);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(wStart.getTime() + 6 * 24 * 3600 * 1000);
    wEnd.setHours(23, 59, 59, 999);
    const weekNum = w + 1;
    let status = 'upcoming';
    if (now > wEnd) {
      status = 'completed';
    } else if (now >= wStart && now <= wEnd) {
      status = 'ongoing';
      currentWeekNum = weekNum;
    }
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(wStart.getTime() + dayIndex * 86400000);
      return { dayIndex, shortName: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dayIndex], date, label: fmtShortDate(date), key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
    });
    weeks.push({ num: weekNum, start: wStart, end: wEnd,
      dateText: `${fmtFullDate(wStart)} – ${fmtFullDate(wEnd)}`, status, days });
  }

  // ── Header badge & date range ──────────────────────────────────
  const firstWeekStart = weeks[0]?.start;
  const lastWeekEnd   = weeks[weeks.length - 1]?.end;
  if (rangeEl && firstWeekStart && lastWeekEnd) {
    rangeEl.textContent = `Kế hoạch ${durationWeeks} tuần: ${fmtFullDate(firstWeekStart)} – ${fmtFullDate(lastWeekEnd)}`;
  }
  if (badgeEl) {
    if (currentWeekNum) {
      const weeklyConfigLocal = Array.isArray(round?.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
      const activeTitle = (typeof resolveRoundWeekTitle === 'function') ? resolveRoundWeekTitle(currentWeekNum, (weeklyConfigLocal.find(c => c.week === currentWeekNum) || {}).title) : ('Tuần ' + currentWeekNum);
      badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 animate-pulse';
      badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> Đang diễn ra: ${escapeHtml(activeTitle)}`;
    } else if (firstWeekStart && now < firstWeekStart) {
      badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200';
      badgeEl.textContent = `Sắp bắt đầu (${fmtShortDate(firstWeekStart)})`;
    } else {
      badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200';
      badgeEl.textContent = `✓ Đã kết thúc ${durationWeeks} tuần`;
    }
  }

  // ── Derive student state for intro/outro cards ────────────────
  const reg        = state.myRegistration;
  const hasTopic   = !!(reg?.topicTitle || reg?.topic);
  const effectiveAssignment = normalizeOfficialAssignment(state.myOfficialAssignment, reg);
  const officialSups = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(effectiveAssignment) : [];
  const hasGVHD = officialSups.length > 0 || Boolean(effectiveAssignment?.acceptedSupervisorId || effectiveAssignment?.assignedSupervisorId || reg?.supervisorName);
  const directAssign = round?.supervisorAssignmentMode === 'direct_assignment';

  // ── Default milestone labels per week (overrideable by admin) ──
  const defaultMilestones = { 4: 'Duyệt đợt 1', 8: 'Duyệt đợt 2', 12: 'Duyệt đợt 3' };
  const weeklyConfig = Array.isArray(round?.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
  const activitySource = state.studentVisibleActivities?.roundId === round?.id
    ? state.studentVisibleActivities.activities
    : (Array.isArray(round?.activities) ? round.activities : []);
  const toLocalDateKey = value => {
    if (!value) return '';
    const date = new Date(value?.toDate ? value.toDate() : value);
    return isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const activityEvents = activitySource
    .filter(activity => isActivityPublished(activity) && (activity.startAt || activity.endAt))
    .map(activity => {
      const startDate = toLocalDateKey(activity.startAt || activity.endAt);
      const endDate = toLocalDateKey(activity.endAt || activity.startAt);
      return { id: `activity-${activity.id}`, activityId: activity.id, activity,
        title: String(activity.title || '').trim(), startDate: startDate <= endDate ? startDate : endDate,
        endDate: startDate <= endDate ? endDate : startDate, color: normalizeRoundWeekEventColor(activity.color) };
    }).filter(event => event.title && event.startDate && event.endDate);

  // ── Build the full unified card array (17 cards) ──────────────
  const allCards = [];

  // Card 0 – Đăng ký đề tài
  allCards.push({
    type: 'milestone',
    id: 'reg-topic',
    icon: '📝',
    title: 'Đăng ký đề tài',
    subtitle: hasTopic ? (reg.topicTitle || reg.topic || 'Đề tài ĐATN') : 'Đề tài ĐATN',
    status: hasTopic ? 'completed' : (round?.status === 'open' ? 'active' : 'upcoming'),
    note: hasTopic ? '✓ Đã đăng ký' : (round?.status === 'open' ? 'Đang mở đăng ký' : 'Chưa mở'),
  });

  // Card 1 – Phân công GVHD
  let gvhdStatus = 'upcoming';
  if (hasGVHD) {
    gvhdStatus = 'completed';
  } else if (directAssign || round?.status === 'reviewing') {
    gvhdStatus = 'active';
  }
  const supervisorProfiles = hasGVHD ? resolveStudentSupervisorProfiles(officialSups, effectiveAssignment).slice(0, 2) : [];
  allCards.push({
    type: 'milestone',
    id: 'gvhd',
    icon: '👨‍🏫',
    title: 'Phân công GVHD',
    subtitle: hasGVHD
      ? ''
      : (directAssign ? 'Khoa đang phân công' : 'Chờ kết quả xét'),
    status: gvhdStatus,
    note: hasGVHD ? '✓ Đã phân công' : (gvhdStatus === 'active' ? 'Đang xử lý' : 'Chưa phân công'),
    supervisors: supervisorProfiles,
  });

  // Cards 2–13 – 12 weekly cards (or durationWeeks)
  weeks.forEach((w, i) => {
    const cfg = weeklyConfig.find(c => c.week === w.num) || {};
    if (cfg.visible === false) return;
    const defMilestone = defaultMilestones[w.num] || null;
    const milestone = cfg.milestone || (defMilestone ? defMilestone : null);
    const manualEvents = (Array.isArray(cfg.events) ? cfg.events : []).map((event, index) => ({
      id: event.id || `legacy-${w.num}-${index}`,
      title: String(event.title || event.name || '').trim(),
      dayIndex: Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      date: event.date || event.startDate || '',
      startDayIndex: Number.isInteger(Number(event.startDayIndex)) ? Math.max(0, Math.min(6, Number(event.startDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      endDayIndex: Number.isInteger(Number(event.endDayIndex)) ? Math.max(0, Math.min(6, Number(event.endDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || event.date || '',
      color: normalizeRoundWeekEventColor(event.color)
    })).filter(event => event.title);
    const firstDay = w.days[0]?.key;
    const lastDay = w.days[6]?.key;
    const events = distinguishOverlappingTimelineEvents(
      [...manualEvents, ...activityEvents.filter(event => event.startDate <= lastDay && event.endDate >= firstDay)], w.days
    );
    const resolvedTitle = resolveRoundWeekTitle(w.num, cfg.title);
    allCards.push({
      type: 'week',
      num: w.num,
      dateText: w.dateText,
      status: w.status,
      title: resolvedTitle,
      subtitle: cfg.note || '',
      milestone,
      days: w.days,
      events,
    });
  });
  state.studentTimelineEventMap = new Map(allCards.filter(card => card.type === 'week').map(card => [card.num, card.events]));

  const hasCustomSokhaoWeek = weeks.some(w => w.num >= 13 && resolveRoundWeekTitle(w.num, (weeklyConfig.find(c => c.week === w.num) || {}).title).toLowerCase().includes('sơ khảo')) || durationWeeks >= 13;
  const hasCustomBaoveWeek = weeks.some(w => w.num >= 14 && resolveRoundWeekTitle(w.num, (weeklyConfig.find(c => c.week === w.num) || {}).title).toLowerCase().includes('bảo vệ')) || durationWeeks >= 14;
  const hasCustomKetquaWeek = weeks.some(w => w.num >= 15 && resolveRoundWeekTitle(w.num, (weeklyConfig.find(c => c.week === w.num) || {}).title).toLowerCase().includes('kết quả')) || durationWeeks >= 15;

  const afterWeeks = lastWeekEnd ? now > lastWeekEnd : false;

  // Card N – Sơ khảo (only show if not covered in weekly cards)
  if (!hasCustomSokhaoWeek) {
    allCards.push({
      type: 'milestone',
      id: 'sokhao',
      icon: '📄',
      title: 'Nộp Sơ khảo',
      subtitle: 'Nộp hồ sơ Sơ khảo',
      status: afterWeeks ? 'completed' : 'upcoming',
      note: afterWeeks ? '✓ Đã nộp' : 'Sau 12 tuần',
    });
  }

  // Card N+1 – Bảo vệ TN (only show if not covered in weekly cards)
  if (!hasCustomBaoveWeek) {
    allCards.push({
      type: 'milestone',
      id: 'baove',
      icon: '🎓',
      title: 'Bảo vệ Tốt nghiệp',
      subtitle: 'Trình bày & Hội đồng chấm',
      status: afterWeeks ? 'completed' : 'upcoming',
      note: afterWeeks ? '✓ Đã bảo vệ' : 'Lịch do Khoa thông báo',
    });
  }

  // Card N+2 – Kết quả (only show if not covered in weekly cards)
  if (!hasCustomKetquaWeek) {
    allCards.push({
      type: 'milestone',
      id: 'ketqua',
      icon: '🏆',
      title: 'Kết quả',
      subtitle: 'Điểm tổng kết chính thức',
      status: afterWeeks ? 'completed' : 'upcoming',
      note: afterWeeks ? '✓ Đã công bố' : 'Sau bảo vệ TN',
    });
  }

  // ── Compute card pixel width ────────────────────────────────────
  const visibleCount = _getTimelineVisibleCount();
  const trackWrapper = track.parentElement;
  const gap = 12; // gap-3 = 12px
  const totalGaps = (visibleCount - 1) * gap;
  const cardPxWidth = Math.floor((trackWrapper.offsetWidth - totalGaps) / visibleCount);

  // ── Render cards into track ─────────────────────────────────────
  const stMap = {
    completed: {
      card: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      icon_bg: 'bg-emerald-600 text-white shadow-sm',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      label: 'Hoàn thành',
    },
    active: {
      card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 text-blue-950',
      icon_bg: 'bg-blue-600 text-white shadow-sm animate-pulse',
      badge: 'bg-blue-600 text-white border-blue-600',
      label: 'Đang diễn ra',
    },
    ongoing: {
      card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 text-blue-950',
      icon_bg: 'bg-blue-600 text-white shadow-sm animate-pulse',
      badge: 'bg-blue-600 text-white border-blue-600',
      label: 'Đang diễn ra',
    },
    upcoming: {
      card: 'bg-slate-50 border-slate-200 text-slate-600',
      icon_bg: 'bg-slate-200 text-slate-500',
      badge: 'bg-slate-100 text-slate-500 border-slate-200',
      label: 'Chưa tới',
    },
  };

  track.innerHTML = allCards.map((card, idx) => {
    const st = stMap[card.status] || stMap.upcoming;
    const isActive = card.status === 'ongoing' || card.status === 'active';

    if (card.type === 'week') {
      // Weekly card
      const milestoneHtml = card.milestone
        ? `<span class="min-w-0 rounded-md bg-amber-500 px-1.5 py-0.5 text-center text-[9px] font-black leading-tight text-white">🚩 ${escapeHtml(card.milestone)}</span>`
        : '';
      const noteHtml = card.subtitle
        ? `<p class="text-[10px] text-slate-500 mt-1 leading-tight line-clamp-2">${card.subtitle}</p>`
        : '';
      const circleContent = card.status === 'completed' ? '✓' : (card.status === 'ongoing' || card.status === 'active') ? '●' : (card.num > 12 ? (card.num === 13 ? '📄' : card.num === 14 ? '🎓' : '📌') : card.num);
      return `<div class="ifa-timeline-card flex-shrink-0 rounded-2xl border ${st.card} flex flex-col items-center text-center p-3 shadow-xs relative overflow-hidden transition-all ${isActive ? 'shadow-md' : ''}"
                   style="width:${cardPxWidth}px;min-width:${cardPxWidth}px;">
        <div class="flex items-center justify-between gap-1 w-full mb-1.5">
          <span class="font-black text-sm text-inherit whitespace-nowrap">${escapeHtml(card.title)}</span>
          ${milestoneHtml}
          <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${st.badge} font-bold whitespace-nowrap leading-none">${st.label}</span>
        </div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${st.icon_bg} my-1">
          ${circleContent}
        </div>
        <span class="text-[13px] font-mono font-bold text-slate-700 tracking-tight">${card.dateText}</span>
        ${renderTimelineWeekDays(card.days, card.events, card.num)}
        ${renderTimelineWeekEvents(card.events, card.num)}
        ${noteHtml}
      </div>`;
    } else {
      // Milestone card (intro/outro)
      const isGvhdCompleted = card.id === 'gvhd' && card.status === 'completed';
      const cardBg = isGvhdCompleted ? 'bg-emerald-50 border-emerald-300' : (card.status === 'completed' ? 'bg-emerald-50 border-emerald-300' : card.status === 'active' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' : 'bg-slate-50 border-slate-200');
      const iconBg = card.status === 'completed' ? 'bg-emerald-600 text-white' : card.status === 'active' ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500';
      const noteColor = card.status === 'completed' ? 'text-emerald-700 font-bold' : card.status === 'active' ? 'text-blue-700 font-bold' : 'text-slate-400';
      const supervisorInfo = card.id === 'gvhd' && card.supervisors?.length
        ? `<div class="grid w-full ${card.supervisors.length > 1 ? 'grid-cols-2 gap-2' : 'grid-cols-1'}">${card.supervisors.map(profile => {
          const fallback = getSupervisorAvatarSvgDataUri(profile.name);
          const avatar = profile.photoUrl || fallback;
          const phoneHref = String(profile.phone || '').replace(/[^\d+]/g, '');
          return `<div class="min-w-0 flex flex-col items-center text-center"><span class="mb-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-900">${profile.label}</span><img src="${escapeHtml(avatar)}" data-fallback="${escapeHtml(fallback)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(profile.name)}" class="${card.supervisors.length > 1 ? 'h-16 w-16' : 'h-24 w-24'} rounded-2xl border-2 border-emerald-300 object-cover shadow-sm"><b class="mt-2 block w-full break-words text-xs text-emerald-950">${escapeHtml(profile.name)}</b>${profile.email ? `<small class="mt-1 block w-full break-all text-[10px] text-emerald-700">${escapeHtml(profile.email)}</small>` : ''}${profile.phone ? `<a href="tel:${escapeHtml(phoneHref)}" class="mt-1 text-[11px] font-bold text-emerald-800 hover:underline">📞 ${escapeHtml(profile.phone)}</a>` : ''}</div>`;
        }).join('')}</div>`
        : '';
      if (card.id === 'gvhd' && card.supervisors?.length) {
        return `<div class="ifa-timeline-card flex-shrink-0 rounded-2xl border ${cardBg} flex flex-col items-center justify-center text-center p-4 shadow-xs relative overflow-hidden transition-all"
                     style="width:${cardPxWidth}px;min-width:${cardPxWidth}px;">
          ${supervisorInfo}
        </div>`;
      }
      return `<div class="ifa-timeline-card flex-shrink-0 rounded-2xl border ${cardBg} flex flex-col items-center text-center p-3 shadow-xs relative overflow-hidden transition-all"
                   style="width:${cardPxWidth}px;min-width:${cardPxWidth}px;">
        <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl ${iconBg} mb-2 shadow-xs">
          ${card.icon}
        </div>
        <span class="font-black text-sm text-slate-900 leading-tight">${card.title}</span>
        ${card.subtitle ? `<span class="text-xs text-slate-600 mt-1 leading-snug line-clamp-3">${escapeHtml(card.subtitle)}</span>` : ''}
        <span class="mt-2 text-[11px] ${noteColor}">${card.note}</span>
        ${supervisorInfo}
      </div>`;
    }
  }).join('');

  // ── Track index management ──────────────────────────────────────
  const totalCards = allCards.length;
  const maxTrackIndex = Math.max(0, totalCards - visibleCount);

  // Reset on round change
  if (state.timelineWeeksRoundId !== round?.id) {
    state.timelineWeeksRoundId = round?.id;
    state.timelineTrackIndex = null;
  }

  // Auto-scroll to the currently active card
  if (typeof state.timelineTrackIndex !== 'number') {
    if (currentWeekNum) {
      const activeIdx = allCards.findIndex(card => card.type === 'week' && card.num === currentWeekNum);
      state.timelineTrackIndex = activeIdx >= 0
        ? Math.max(0, Math.min(maxTrackIndex, activeIdx - 1))
        : 0;
    } else if (hasTopic && !hasGVHD) {
      state.timelineTrackIndex = 1; // scroll to show GVHD card
    } else {
      state.timelineTrackIndex = 0;
    }
  }
  state.timelineTrackIndex = Math.max(0, Math.min(maxTrackIndex, state.timelineTrackIndex));

  // Apply CSS transform to slide the track
  const slideOffset = state.timelineTrackIndex * (cardPxWidth + gap);
  track.style.transform = `translateX(-${slideOffset}px)`;

  // ── Navigation buttons ─────────────────────────────────────────
  const prevBtn = document.getElementById('timeline-weeks-prev-btn');
  const nextBtn = document.getElementById('timeline-weeks-next-btn');
  if (prevBtn) prevBtn.classList.toggle('hidden', state.timelineTrackIndex <= 0);
  if (nextBtn) nextBtn.classList.toggle('hidden', state.timelineTrackIndex >= maxTrackIndex);

  // ── Step indicator ─────────────────────────────────────────────
  const stepIndicator = document.getElementById('timeline-track-step-indicator');
  if (stepIndicator) {
    stepIndicator.textContent = `${state.timelineTrackIndex + 1} / ${totalCards}`;
  }
  // Legacy page indicator compat
  const pageIndicator = document.getElementById('timeline-weeks-page-indicator');
  if (pageIndicator && weeks.length > 0) {
    const startW = Math.max(1, state.timelineTrackIndex - 1);
    pageIndicator.textContent = `${startW} / ${durationWeeks} tuần`;
  }
};

async function loadStudentSelfProfile(mssv) {
  if (!mssv) return null;
  try {
    const snap = await getDoc(doc(db, 'graduationStudentProfiles', mssv));
    state.studentSelfProfile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[StudentProfile] Unable to load self profile:', err.message);
    state.studentSelfProfile = null;
  }
  return state.studentSelfProfile;
}

function getRegistrationStudentIdentity() {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  return {
    mssv,
    fullName: studentObj?.fullName || studentObj?.name || state.myRegistration?.studentName || state.user?.displayName || `Sinh viên ${mssv}`,
    major: studentObj?.major || state.myRegistration?.major || 'Thiết kế nội thất',
    email: state.myRegistration?.email || (state.impersonation?.target?.email) || state.user?.email || `${mssv}@student.tdtu.edu.vn`
  };
}

function populateRegistrationStudentForm() {
  const identity = getRegistrationStudentIdentity();
  const reg = state.myRegistration || {};
  const profile = state.studentSelfProfile || {};
  const values = {
    'registration-student-name': identity.fullName,
    'registration-student-id': identity.mssv,
    'registration-student-major': identity.major,
    'registration-personal-email': reg.personalEmail || profile.personalEmail || '',
    'registration-current-class': reg.currentClass || profile.currentClass || '',
    'registration-student-phone': reg.studentPhone || profile.phone || '',
    'registration-student-permanent-address': reg.studentPermanentAddress || profile.permanentAddress || '',
    'registration-student-temporary-address': reg.studentTemporaryAddress || reg.studentAddress || profile.temporaryAddress || profile.address || '',
    'registration-course-name': reg.courseName || 'Đồ án tốt nghiệp',
    'registration-course-code': reg.courseCode || '',
    'registration-course-group': reg.courseGroup || '',
    'input-topic-description': reg.topicDescription || ''
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const counter = document.getElementById('topic-description-char-count');
  if (counter) counter.textContent = String(values['input-topic-description'].length);
}

function collectOfficialFormFields() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  return {
    currentClass: val('registration-current-class'),
    personalEmail: val('registration-personal-email'),
    studentPhone: val('registration-student-phone'),
    studentPermanentAddress: val('registration-student-permanent-address'),
    studentTemporaryAddress: val('registration-student-temporary-address'),
    studentAddress: val('registration-student-temporary-address'),
    courseName: val('registration-course-name'),
    courseCode: val('registration-course-code'),
    courseGroup: val('registration-course-group'),
    topicDescription: val('input-topic-description')
  };
}

function validateOfficialFormFields(fields) {
  const labels = {
    currentClass: 'lớp', personalEmail: 'email cá nhân', studentPhone: 'số điện thoại',
    studentPermanentAddress: 'địa chỉ thường trú', studentTemporaryAddress: 'địa chỉ tạm trú',
    courseName: 'môn học', courseCode: 'mã môn học', courseGroup: 'nhóm', topicDescription: 'mô tả định hướng thiết kế'
  };
  const missing = Object.entries(labels).find(([key]) => !String(fields[key] || '').trim());
  if (missing) {
    showToast(`Vui lòng nhập ${missing[1]} để hoàn thiện phiếu đăng ký chính thức.`, 'warning');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.personalEmail)) {
    showToast('Email cá nhân chưa đúng định dạng.', 'warning');
    return false;
  }
  return true;
}

export function getCleanRegistrationAddress(st, studentObj = null) {
  const isInvalid = (val) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return s === '' || s === 'không có' || s === 'khong co' || s === 'không' || s === 'khong' || 
           s === 'k' || s === 'ko' || s === 'none' || s === '-' || s === '--' || s === 'n/a';
  };

  const temp = st?.studentTemporaryAddress || st?.temporaryAddress || '';
  const perm = st?.studentPermanentAddress || st?.permanentAddress || '';
  const gen = st?.studentAddress || st?.address || studentObj?.address || '';

  if (!isInvalid(temp)) return temp.trim();
  if (!isInvalid(perm)) return perm.trim();
  if (!isInvalid(gen)) return gen.trim();
  return temp || perm || gen || '--';
}
window.getCleanRegistrationAddress = getCleanRegistrationAddress;

window.printOfficialTopicRegistrationPaper = function(targetStudentId = null) {
  const paper = document.getElementById('topic-preview-paper');
  if (!paper) {
    if (typeof window.downloadOfficialTopicRegistrationPdf === 'function') {
      window.downloadOfficialTopicRegistrationPdf(targetStudentId);
    }
    return;
  }

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const doc = printFrame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Phieu-dang-ky-de-tai</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
            font-family: 'Times New Roman', Times, serif !important;
            color: #000 !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            font-size: 13pt;
            line-height: 1.4;
          }
          table {
            border-collapse: collapse;
          }
          td.has-value {
            border-bottom: 0 !important;
          }
        </style>
      </head>
      <body>
        ${paper.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  const innerPaper = doc.getElementById('topic-preview-paper');
  if (innerPaper) {
    innerPaper.style.boxShadow = 'none';
    innerPaper.style.border = 'none';
    innerPaper.style.padding = '0';
    innerPaper.style.margin = '0';
    innerPaper.style.width = '100%';
    innerPaper.style.minWidth = '100%';
    innerPaper.style.minHeight = 'auto';
  }

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn('Iframe print notice:', e);
      window.print();
    }
    setTimeout(() => {
      printFrame.remove();
    }, 2000);
  }, 250);
};

window.downloadOfficialTopicRegistrationPdf = function(targetStudentId = null) {
  let reg = null;
  let identity = null;

  if (targetStudentId && typeof targetStudentId === 'string') {
    reg = (state.supervisorAssignedStudents || []).find(st => (st.studentId || st.id) === targetStudentId) ||
      (typeof findStudentInRound === 'function' ? findStudentInRound(targetStudentId) : null);
    const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(targetStudentId) : null;
    identity = {
      mssv: targetStudentId,
      fullName: reg?.studentName || studentObj?.fullName || studentObj?.name || targetStudentId,
      major: reg?.major || studentObj?.major || 'Thiết kế nội thất',
      email: reg?.personalEmail || reg?.email || studentObj?.email || `${targetStudentId}@student.tdtu.edu.vn`
    };
  } else {
    reg = state.myRegistration;
    identity = getRegistrationStudentIdentity();
  }

  if (!reg) {
    showToast('Không tìm thấy thông tin đăng ký.', 'warning');
    return;
  }
  if (!targetStudentId && reg.topicApprovalStatus !== 'approved') {
    showToast('Phiếu PDF chỉ được tải sau khi GVHD xác nhận tên đề tài.', 'warning');
    return;
  }
  if (!window.pdfMake) {
    showToast('Bộ tạo PDF chưa tải xong. Vui lòng thử lại sau vài giây.', 'warning');
    return;
  }

  identity = identity || getRegistrationStudentIdentity();
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(identity.mssv) : null;
  const round = state.activeRound || {};
  const approvedDate = reg.topicReviewedAt?.toDate ? reg.topicReviewedAt.toDate() : new Date();
  const dd = String(approvedDate.getDate()).padStart(2, '0');
  const mm = String(approvedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = approvedDate.getFullYear();
  const roundLabel = round.title || round.roundName || 'ĐỒ ÁN TỐT NGHIỆP';
  const version = Number(reg.topicTitleVersion || 1);
  const normalizedRoundLabel = roundLabel.toUpperCase().replace(/\s+/g, ' ').trim();
  const roundHeadingMatch = normalizedRoundLabel.match(/^(.*?)(?:\s*-\s*)?(ĐỢT\s+.+)$/);
  const programHeading = roundHeadingMatch?.[1] || 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP';
  const roundHeading = roundHeadingMatch?.[2] || (round.roundName ? `ĐỢT ${round.roundName}` : '');
  const descriptionText = String(reg.topicDescription || '').trim();
  const studentClass = reg.currentClass || reg.studentClass || reg.className || studentObj?.className || studentObj?.studentClass || '--';
  const studentAddress = getCleanRegistrationAddress(reg, studentObj);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [54, 36, 54, 36],
    defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.2 },
    content: [
      {
        columns: [
          {
            width: '46%',
            stack: [
              { text: 'TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG', fontSize: 10.5, alignment: 'center' },
              { text: 'KHOA MỸ THUẬT CÔNG NGHIỆP', fontSize: 10.5, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
              { canvas: [{ type: 'line', x1: 25, y1: 0, x2: 175, y2: 0, lineWidth: 0.8 }] }
            ]
          },
          {
            width: '54%',
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', fontSize: 10.5, bold: true, alignment: 'center' },
              { text: 'Độc lập -Tự do – Hạnh phúc', fontSize: 10.5, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
              { canvas: [{ type: 'line', x1: 45, y1: 0, x2: 175, y2: 0, lineWidth: 0.8 }] }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      },
      { text: 'PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC', bold: true, fontSize: 15, alignment: 'center' },
      { text: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP', bold: true, fontSize: 13.5, alignment: 'center', margin: [0, 2, 0, 0] },
      ...(roundHeading
        ? [{ text: roundHeading, bold: true, italics: true, fontSize: 13.5, alignment: 'center', margin: [0, 2, 0, 18] }]
        : [{ text: '', margin: [0, 0, 0, 18] }]),

      // Thông tin sinh viên (inline, không bị cách xa, không bold giá trị)
      {
        columns: [
          {
            width: '62%',
            text: [
              { text: 'HỌ VÀ TÊN: ', bold: true },
              { text: identity.fullName || '', bold: false }
            ]
          },
          {
            width: '38%',
            text: [
              { text: 'MSSV: ', bold: true },
              { text: identity.mssv || '', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        columns: [
          {
            width: '46%',
            text: [
              { text: 'LỚP: ', bold: true },
              { text: studentClass, bold: false }
            ]
          },
          {
            width: '54%',
            text: [
              { text: 'NGÀNH: ', bold: true },
              { text: reg.major || identity.major || 'Thiết kế nội thất', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'EMAIL: ', bold: true },
          { text: reg.personalEmail || identity.email || '', bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'ĐIỆN THOẠI: ', bold: true },
          { text: reg.studentPhone || '', bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'ĐỊA CHỈ: ', bold: true },
          { text: studentAddress, bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        columns: [
          {
            width: '45%',
            text: [
              { text: 'MÔN HỌC: ', bold: true },
              { text: reg.courseName || reg.projectType || 'Đồ án tốt nghiệp', bold: false }
            ]
          },
          {
            width: '35%',
            text: [
              { text: 'MÃ MÔN HỌC: ', bold: true },
              { text: reg.courseCode || '', bold: false }
            ]
          },
          {
            width: '20%',
            text: [
              { text: 'NHÓM: ', bold: true },
              { text: reg.courseGroup || '1', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 14]
      },
      {
        text: `Đăng ký đề tài chính thức lần thứ : ${version}`,
        italics: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 14]
      },
      {
        text: [
          { text: 'TÊN ĐỀ TÀI : ', bold: true },
          { text: reg.topicTitle || '', bold: false }
        ],
        lineHeight: 1.35,
        margin: [0, 0, 0, 14]
      },
      {
        text: 'MÔ TẢ CHI TIẾT ĐỊNH HƯỚNG THIẾT KẾ CỦA ĐỀ TÀI :',
        bold: true,
        alignment: 'center',
        fontSize: 12,
        margin: [0, 0, 0, 8]
      },
      {
        text: descriptionText || '',
        alignment: 'justify',
        fontSize: 12,
        lineHeight: 1.35,
        margin: [0, 0, 0, 14]
      },
      {
        text: 'Tôi xin cam đoan thực hiện đúng đề tài đã đăng ký.',
        bold: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 4, 0, 18]
      },
      {
        columns: [
          {
            width: '56%',
            stack: [
              { text: 'Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN', bold: true, fontSize: 12, alignment: 'center', margin: [0, 18, 0, 0] }
            ]
          },
          {
            width: '44%',
            stack: [
              { text: `Tp.HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`, italics: true, fontSize: 12, alignment: 'center' },
              { text: 'NGƯỜI ĐĂNG KÝ', bold: true, fontSize: 12, alignment: 'center', margin: [0, 3, 0, 0] },
              { text: '(ký và ghi rõ họ tên)', italics: true, fontSize: 11, alignment: 'center', margin: [0, 1, 0, 40] },
              { text: identity.fullName, bold: false, fontSize: 12, alignment: 'center' }
            ]
          }
        ]
      }
    ],
    styles: {}
  };

  const safeId = String(identity.mssv || 'sinh-vien').replace(/[^0-9A-Za-z_-]/g, '');
  window.pdfMake.createPdf(docDefinition).download(`Phieu-dang-ky-de-tai-${safeId}-lan-${version}.pdf`);
};

window.updateStudentPersonalSidebar = function() {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const heroName = document.getElementById('hero-student-name');
  const heroMssv = document.getElementById('hero-student-mssv');
  const heroAvatar = document.getElementById('hero-student-avatar');
  const modalBody = document.getElementById('student-profile-modal-body');

  if (!mssv) {
    if (heroName) heroName.textContent = state.user?.displayName || 'Sinh viên';
    if (heroMssv) heroMssv.textContent = 'Chưa đăng nhập';
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          Vui lòng đăng nhập bằng tài khoản @student.tdtu.edu.vn để xem thông tin cá nhân.
        </div>
      `;
    }
    return;
  }

  const impTarget = (state.impersonation && state.impersonation.target?.type === 'student') ? state.impersonation.target : null;
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  const fullName = impTarget?.name || studentObj?.fullName || studentObj?.name || state.myRegistration?.studentName || state.user?.displayName || `Sinh viên ${mssv}`;
  const studentClass = state.studentSelfProfile?.currentClass || state.myRegistration?.currentClass || impTarget?.currentClass || impTarget?.studentClass || impTarget?.className || studentObj?.className || studentObj?.studentClass || 'Chưa cập nhật';
  const major = impTarget?.major || studentObj?.major || state.myRegistration?.major || 'Thiết kế nội thất';

  const avatarUrl = state.user?.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%2394a3b8'/%3E%3Cpath fill='%2394a3b8' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/%3E%3C/svg%3E";

  // Update Hero Banner Pill
  if (heroName) heroName.textContent = fullName;
  if (heroMssv) heroMssv.textContent = `MSSV: ${mssv}`;
  if (heroAvatar) heroAvatar.src = avatarUrl;

  if (!state.facultyStudentsLoaded && typeof loadFacultyDatasetFromIFAA === 'function') {
    loadFacultyDatasetFromIFAA().then(() => {
      updateStudentPersonalSidebar();
    }).catch(() => {});
  }

  // Eligibility
  let eligibilityBadge = '<span class="text-[11px] font-bold text-slate-500">Chưa xác định</span>';
  if (state.isEligible === true) {
    eligibilityBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đủ điều kiện</span>';
  } else if (state.isEligible === 'pending') {
    eligibilityBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">⏳ Chờ xác nhận</span>';
  } else if (state.isEligible === false) {
    eligibilityBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Chưa đủ ĐK</span>';
  }

  // Registration
  let regBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Chưa đăng ký</span>';
  if (state.myRegistration) {
    regBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã đăng ký</span>';
  } else if (state.activeRound?.status === 'open') {
    regBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">● Đang mở ĐK</span>';
  }

  // Assignment & Supervisor
  let supDisplay = 'Chưa phân công';
  let assignBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Chưa có</span>';
  
  const officialList = state.myRegistration ? getOfficialSupervisors(state.myRegistration) : [];
  if (officialList.length > 0) {
    const primary = officialList.find(s => s.role === 'primary') || officialList[0];
    supDisplay = primary.supervisorName || 'GVHD chính thức';
    assignBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã phân công</span>';
  } else if (state.myRegistration && (state.activeRound?.status === 'reviewing' || (state.activeRound?.reviewStatus && state.activeRound.reviewStatus.startsWith('round_')))) {
    assignBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">Đang xét duyệt</span>';
  }

  // Upcoming Submission
  let upcomingText = 'Không có mốc nộp bài sắp tới';
  let upcomingBadge = '';
  if (state.activeRound) {
    const activities = Array.isArray(state.activeRound.activities) ? state.activeRound.activities : [];
    const submissionActs = activities.filter(a => a.submissionEnabled && (a.closeAtDate || a.endDate || a.date));
    const now = new Date();
    const upcoming = submissionActs
      .map(a => ({
        title: a.title,
        deadline: a.closeAtDate ? new Date(a.closeAtDate) : (a.endDate ? new Date(a.endDate) : new Date(a.date))
      }))
      .filter(a => !isNaN(a.deadline.getTime()) && a.deadline >= now)
      .sort((a, b) => a.deadline - b.deadline)[0];

    if (upcoming) {
      upcomingText = `${upcoming.title}`;
      upcomingBadge = `<span class="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Hạn: ${fmtIsoToVietnameseDateTime(upcoming.deadline.toISOString())}</span>`;
    }
  }

  // Populate Modal Body
  if (modalBody) {
    modalBody.innerHTML = `
      <!-- Header -->
      <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
        <img src="${avatarUrl}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" alt="Avatar">
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-sm text-slate-900 truncate leading-snug">${fullName}</h3>
          <p class="text-xs text-slate-500 font-mono">MSSV: <span class="font-bold text-tdtu-blue">${mssv}</span></p>
        </div>
      </div>

      <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2.5">
        <div>
          <span class="font-black text-xs text-blue-900 block">Thông tin sinh viên tự cập nhật</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label class="text-[11px] font-bold text-slate-600">Lớp<input id="profile-current-class" maxlength="50" value="${escapeHtml(state.studentSelfProfile?.currentClass || state.myRegistration?.currentClass || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
          <label class="text-[11px] font-bold text-slate-600">Điện thoại<input id="profile-student-phone" maxlength="20" value="${escapeHtml(state.studentSelfProfile?.phone || state.myRegistration?.studentPhone || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        </div>
        <label class="text-[11px] font-bold text-slate-600 block">Email cá nhân<input id="profile-personal-email" type="email" maxlength="120" value="${escapeHtml(state.studentSelfProfile?.personalEmail || state.myRegistration?.personalEmail || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        <label class="text-[11px] font-bold text-slate-600 block">Địa chỉ thường trú<input id="profile-student-permanent-address" maxlength="250" value="${escapeHtml(state.studentSelfProfile?.permanentAddress || state.myRegistration?.studentPermanentAddress || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        <label class="text-[11px] font-bold text-slate-600 block">Địa chỉ tạm trú<input id="profile-student-temporary-address" maxlength="250" value="${escapeHtml(state.studentSelfProfile?.temporaryAddress || state.myRegistration?.studentTemporaryAddress || state.studentSelfProfile?.address || state.myRegistration?.studentAddress || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        <button type="button" onclick="saveStudentSelfProfile()" class="w-full px-3 py-2 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-lg text-xs font-black">Lưu thông tin sinh viên</button>
      </div>

      <!-- Student Details -->
      <div class="space-y-2.5 text-xs">
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Lớp:</span>
          <span class="font-bold text-slate-800 font-mono">${studentClass}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Ngành:</span>
          <span class="font-bold text-slate-800">${major}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Điều kiện ĐATN:</span>
          ${eligibilityBadge}
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Trạng thái đăng ký:</span>
          ${regBadge}
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Phân công GVHD:</span>
          ${assignBadge}
        </div>
        <div class="py-1 border-b border-slate-50">
          <div class="flex items-center justify-between">
            <span class="text-slate-500">GVHD chính:</span>
            <span class="font-bold text-slate-900">${supDisplay}</span>
          </div>
        </div>
        <div class="pt-1">
          <span class="text-slate-500 block mb-1">Mốc nộp bài gần nhất:</span>
          <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span class="font-bold text-slate-800 text-[11px] block">${upcomingText}</span>
            ${upcomingBadge ? `<div>${upcomingBadge}</div>` : ''}
          </div>
        </div>
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">Tài khoản sinh viên</span>
          <button type="button" onclick="handleStudentLogout()" class="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    `;
  }
};

window.openStudentProfileModal = function() {
  updateStudentPersonalSidebar();
  const modal = document.getElementById('modal-student-profile');
  if (modal) modal.classList.remove('hidden');
};

window.closeStudentProfileModal = function() {
  const modal = document.getElementById('modal-student-profile');
  if (modal) modal.classList.add('hidden');
};

window.handleStudentLogout = async function() {
  try {
    await signOut(auth);
  } catch (e) {}
  window.location.reload();
};

window.updateTeacherPersonalModal = function() {
  const actor = getEffectiveActor();
  const modalBody = document.getElementById('teacher-profile-modal-body');
  if (!modalBody) return;

  const emailLower = (actor.email || '').toLowerCase().trim();
  const currentSup = (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower) ||
                    (state.supervisorsMaster || []).find(s => (s.email || '').toLowerCase().trim() === emailLower);
  
  const displayName = currentSup?.name || actor.displayName || 'Giảng viên';
  const email = currentSup?.email || actor.email || '--';
  const dept = currentSup?.department || 'Khoa Mỹ thuật Công nghiệp';
  const photoUrl = currentSup?.photoUrl || actor.photoURL || '';
  const avatarSrc = (photoUrl && photoUrl.trim()) ? photoUrl : getSupervisorAvatarSvgDataUri(displayName);

  let roleBadges = [];
  if (actor.isAdmin) roleBadges.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Quản trị viên</span>');
  if (actor.isSupervisor || currentSup) roleBadges.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Giảng viên Hướng dẫn</span>');
  roleBadges.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Hội đồng / Đánh giá</span>');

  modalBody.innerHTML = `
    <div class="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
      <img src="${avatarSrc}" class="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" alt="${escapeHtml(displayName)}">
      <div class="min-w-0 flex-1">
        <h4 class="font-bold text-sm text-slate-900 truncate">${escapeHtml(displayName)}</h4>
        <p class="text-xs text-slate-500 font-mono truncate">${escapeHtml(email)}</p>
        <p class="text-[11px] text-tdtu-blue font-semibold mt-0.5">${escapeHtml(dept)}</p>
      </div>
    </div>

    <div class="space-y-2 text-xs">
      <div>
        <span class="text-slate-500 block mb-1 font-semibold">Vai trò hệ thống:</span>
        <div class="flex flex-wrap gap-1.5">${roleBadges.join('')}</div>
      </div>
      <div>
        <span class="text-slate-500 block mb-1 font-semibold">Đợt đang xem:</span>
        <span class="font-bold text-slate-800 block p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">${escapeHtml(state.activeRound?.title || '--')} (${escapeHtml(state.activeRound?.academicYear || '--')})</span>
      </div>
    </div>

    <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <a href="/graduation/" class="text-xs text-blue-600 font-bold hover:underline">🎓 Cổng SV</a>
        ${actor.isAdmin ? '<a href="/graduation/admin/" class="text-xs text-amber-600 font-bold hover:underline ml-2">⚙️ Quản trị</a>' : ''}
      </div>
      <button type="button" onclick="handleTeacherLogout()" class="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200 cursor-pointer">
        <span>🚪</span>
        <span>Đăng xuất</span>
      </button>
    </div>
  `;
};

window.handleTeacherLogout = async function() {
  try {
    await signOut(auth);
  } catch (e) {}
  window.location.reload();
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderSupervisorRoundTimeline !== 'undefined') window.renderSupervisorRoundTimeline = renderSupervisorRoundTimeline;
  if (typeof renderSupervisorPlanList !== 'undefined') window.renderSupervisorPlanList = renderSupervisorPlanList;
  if (typeof positionStudentRegistrationCta !== 'undefined') window.positionStudentRegistrationCta = positionStudentRegistrationCta;
  if (typeof loadStudentSelfProfile !== 'undefined') window.loadStudentSelfProfile = loadStudentSelfProfile;
  if (typeof getRegistrationStudentIdentity !== 'undefined') window.getRegistrationStudentIdentity = getRegistrationStudentIdentity;
  if (typeof populateRegistrationStudentForm !== 'undefined') window.populateRegistrationStudentForm = populateRegistrationStudentForm;
  if (typeof collectOfficialFormFields !== 'undefined') window.collectOfficialFormFields = collectOfficialFormFields;
  if (typeof validateOfficialFormFields !== 'undefined') window.validateOfficialFormFields = validateOfficialFormFields;
  if (typeof getCleanRegistrationAddress !== 'undefined') window.getCleanRegistrationAddress = getCleanRegistrationAddress;
  if (typeof findAct !== 'undefined') window.findAct = findAct;
  if (typeof getActStepStatus !== 'undefined') window.getActStepStatus = getActStepStatus;
  if (typeof pad !== 'undefined') window.pad = pad;
  if (typeof stageCard !== 'undefined') window.stageCard = stageCard;
  if (typeof fmtShortDate !== 'undefined') window.fmtShortDate = fmtShortDate;
  if (typeof fmtFullDate !== 'undefined') window.fmtFullDate = fmtFullDate;
  if (typeof toLocalDateKey !== 'undefined') window.toLocalDateKey = toLocalDateKey;
  if (typeof val !== 'undefined') window.val = val;
  if (typeof isInvalid !== 'undefined') window.isInvalid = isInvalid;
}
