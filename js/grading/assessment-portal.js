// ============================================================================
// PHASE 4: ASSESSMENT PORTAL ENGINE
// ============================================================================

state.assessmentTab = 'duyet-1';
state.assessmentFilter = 'all';
state.assessmentSearchQuery = '';
state.selectedAssessmentRoundId = null;
state.selectedAssessmentCouncilId = null;

export function checkUserAssessmentCapabilities(round, userEmail = null, userId = null) {
  const actor = getEffectiveActor();
  const uEmail = (userEmail || actor.email || '').toLowerCase().trim();
  const uId = userId || actor.uid || actor.email;

  if (actor.isAdmin) {
    return {
      isRoundAdmin: true,
      canDuyet1: true,
      canDuyet2: true,
      canDuyet3: true,
      canThesis: true,
      canPreliminary: true,
      canDefense: true,
      canSummary: true,
      hasAnyCapability: true
    };
  }

  if (!round) {
    return {
      isRoundAdmin: false,
      canDuyet1: false,
      canDuyet2: false,
      canDuyet3: false,
      canThesis: false,
      canPreliminary: false,
      canDefense: false,
      canSummary: false,
      hasAnyCapability: false
    };
  }

  // Check if supervisor in round
  const isSupervisor = (round.supervisors || []).some(s => (s.email && s.email.toLowerCase() === uEmail) || s.id === uId);

  // Check official supervised students
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (round.eligibleStudents || []);

  const hasSupervisedStudents = allRegs.some(s => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  // Check reviewer assignments
  const reviewerAssignments = round.reviewerAssignments || {};
  const hasReviewerAssignments = allRegs.some(s => {
    const sid = s.mssv || s.studentId;
    return reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail;
  });

  // Check council membership in any activity
  const actsWithCouncils = (round.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils));
  let hasDefenseDuty = false;
  for (const act of actsWithCouncils) {
    for (const c of (act.councils || [])) {
      const members = Object.values(c.membersBySlot || {});
      if (members.some(m => m.memberEmail && m.memberEmail.toLowerCase() === uEmail)) {
        hasDefenseDuty = true;
        break;
      }
    }
    if (hasDefenseDuty) break;
  }

  const canDuyet1 = hasSupervisedStudents || isSupervisor;
  const canDuyet2 = hasSupervisedStudents || isSupervisor;
  const canDuyet3 = hasSupervisedStudents || isSupervisor;
  const canThesis = hasSupervisedStudents || hasReviewerAssignments;
  const canPreliminary = isSupervisor;
  const canDefense = hasDefenseDuty;
  const canSummary = state.isAdmin;

  const hasAnyCapability = canDuyet1 || canDuyet2 || canDuyet3 || canThesis || canPreliminary || canDefense || canSummary;

  return {
    isRoundAdmin: false,
    canDuyet1,
    canDuyet2,
    canDuyet3,
    canThesis,
    canPreliminary,
    canDefense,
    canSummary,
    hasAnyCapability
  };
}
window.checkUserAssessmentCapabilities = checkUserAssessmentCapabilities;

window.initAssessmentPortal = async function() {
  if (!state.user) return;

  const allRounds = state.rounds || [];
  const eligibleRounds = allRounds.filter(r => checkUserAssessmentCapabilities(r).hasAnyCapability);

  const deniedEl = document.getElementById('assessment-access-denied');
  const containerEl = document.getElementById('assessment-workspace-container');

  if (eligibleRounds.length === 0) {
    if (deniedEl) deniedEl.classList.remove('hidden');
    if (containerEl) containerEl.classList.add('hidden');
    return;
  }

  if (deniedEl) deniedEl.classList.add('hidden');
  if (containerEl) containerEl.classList.remove('hidden');

  // Populate Round Selector
  const roundSelect = document.getElementById('assessment-round-select');
  if (roundSelect) {
    roundSelect.innerHTML = eligibleRounds.map(r => {
      const isCur = r.isCurrentRound || r.status === 'in_progress';
      return `<option value="${r.id}">${r.title || 'Đợt'} (${r.academicYear || '--'})${isCur ? ' — [Hiện hành]' : ''}</option>`;
    }).join('');

    // Determine default selected round
    let defaultRound = eligibleRounds.find(r => r.id === state.selectedAssessmentRoundId);
    if (!defaultRound) defaultRound = eligibleRounds.find(r => r.id === state.selectedRoundId);
    if (!defaultRound) defaultRound = eligibleRounds.find(r => r.isCurrentRound || r.status === 'in_progress');
    if (!defaultRound) defaultRound = eligibleRounds[0];

    state.selectedAssessmentRoundId = defaultRound.id;
    state.selectedRoundId = defaultRound.id;
    roundSelect.value = defaultRound.id;
  }

  await renderAssessmentWorkspace();
};

window.onAssessmentRoundChange = async function(roundId) {
  state.selectedAssessmentRoundId = roundId;
  state.selectedRoundId = roundId;
  state.selectedAssessmentCouncilId = null;
  await renderAssessmentWorkspace();
};

window.renderAssessmentWorkspace = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const caps = checkUserAssessmentCapabilities(targetRound);

  // 1. Tab visibility
  const tabConfig = [
    { key: 'duyet-1', visible: caps.canDuyet1 },
    { key: 'duyet-2', visible: caps.canDuyet2 },
    { key: 'duyet-3', visible: caps.canDuyet3 },
    { key: 'thesis', visible: caps.canThesis },
    { key: 'preliminary', visible: caps.canPreliminary },
    { key: 'defense', visible: caps.canDefense },
    { key: 'summary', visible: caps.canSummary }
  ];

  tabConfig.forEach(tab => {
    const btn = document.getElementById('atab-btn-' + tab.key);
    if (btn) {
      if (tab.visible) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    }
  });

  // Ensure current active tab is visible
  const activeTabConfig = tabConfig.find(t => t.key === state.assessmentTab);
  if (!activeTabConfig || !activeTabConfig.visible) {
    const firstVisible = tabConfig.find(t => t.visible);
    if (firstVisible) state.assessmentTab = firstVisible.key;
  }

  // Update role badge in top bar
  const roleBadge = document.getElementById('assessment-user-role-badge');
  if (roleBadge) {
    if (state.isAdmin) {
      roleBadge.textContent = 'Quản trị viên';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200';
    } else if (caps.canDefense) {
      roleBadge.textContent = 'Thành viên Hội đồng';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200';
    } else {
      roleBadge.textContent = 'Cán bộ Đánh giá';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200';
    }
  }

  // Render Hero Card and Tab
  renderAssessmentHeroCard();
  switchAssessmentTab(state.assessmentTab);
};

window.renderAssessmentHeroCard = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  // Update Evaluator Profile Pill
  const actor = getEffectiveActor();
  const evalHeroName = document.getElementById('hero-assessment-name');
  const evalHeroEmail = document.getElementById('hero-assessment-email');
  const evalHeroAvatar = document.getElementById('hero-assessment-avatar');
  if (evalHeroName) evalHeroName.textContent = actor.displayName || 'Giảng viên';
  if (evalHeroEmail) evalHeroEmail.textContent = actor.email || '--';
  if (evalHeroAvatar) {
    const photoUrl = actor.photoURL;
    evalHeroAvatar.src = (photoUrl && photoUrl.trim()) ? photoUrl : getSupervisorAvatarSvgDataUri(actor.displayName || 'GV');
  }

  const titleEl = document.getElementById('assessment-hero-round-title');
  if (titleEl) {
    titleEl.textContent = `${targetRound.title || 'Đồ án tốt nghiệp'} — ${targetRound.academicYear || ''}`;
  }

  // Calculate nearest milestone deadline
  const now = new Date();
  let nearestDeadline = null;
  let nearestActTitle = '';
  (targetRound.activities || []).forEach(a => {
    const deadlineStr = a.deadline || a.endTime;
    if (deadlineStr) {
      const d = new Date(deadlineStr);
      if (d > now && (!nearestDeadline || d < nearestDeadline)) {
        nearestDeadline = d;
        nearestActTitle = a.title || 'Mốc tiếp theo';
      }
    }
  });

  const deadlineEl = document.getElementById('assessment-stat-deadline');
  if (deadlineEl) {
    if (nearestDeadline) {
      const daysLeft = Math.ceil((nearestDeadline - now) / (1000 * 60 * 60 * 24));
      deadlineEl.textContent = `${fmtIsoToVietnameseDateTime(nearestDeadline.toISOString())} (${daysLeft} ngày nữa — ${nearestActTitle})`;
    } else {
      deadlineEl.textContent = 'Đã qua các hạn chót';
    }
  }

  // Metrics computation for user
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  let neededCount = 0;
  let scoredCount = 0;
  let draftCount = 0;

  // 1. Duyet 1, 2, 3
  const supervised = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  [1, 2, 3].forEach(phase => {
    supervised.forEach(s => {
      neededCount++;
      const sid = s.mssv || s.studentId;
      const sc = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
      if (sc && sc.status && sc.status !== 'draft') scoredCount++;
      else if (sc && sc.status === 'draft') draftCount++;
    });
  });

  // 2. Thesis (Reviewer)
  const reviewerAssignments = targetRound.reviewerAssignments || {};
  const myReviewerStudents = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const sid = s.mssv || s.studentId;
    return reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail;
  });
  myReviewerStudents.forEach(s => {
    neededCount++;
    const sid = s.mssv || s.studentId;
    const sc = targetRound.thesisScores?.[sid]?.pb;
    if (sc && sc.status === 'completed') scoredCount++;
    else if (sc && sc.status === 'draft') draftCount++;
  });

  const unscoredCount = Math.max(0, neededCount - scoredCount - draftCount);

  const neededEl = document.getElementById('assessment-stat-needed');
  const scoredEl = document.getElementById('assessment-stat-scored');
  const unscoredEl = document.getElementById('assessment-stat-unscored');
  const draftEl = document.getElementById('assessment-stat-draft');

  if (neededEl) neededEl.textContent = neededCount;
  if (scoredEl) scoredEl.textContent = scoredCount;
  if (unscoredEl) unscoredEl.textContent = unscoredCount;
  if (draftEl) draftEl.textContent = draftCount;
};

window.switchAssessmentTab = function(tabKey) {
  state.assessmentTab = tabKey;

  // Update Tab Buttons UI
  const tabKeys = ['duyet-1', 'duyet-2', 'duyet-3', 'thesis', 'preliminary', 'defense', 'summary'];
  tabKeys.forEach(key => {
    const btn = document.getElementById('atab-btn-' + key);
    if (btn) {
      if (key === tabKey) {
        btn.classList.add('bg-purple-600', 'text-white', 'shadow-xs');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-purple-600', 'text-white', 'shadow-xs');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    }

    const panel = document.getElementById('assessment-panel-' + key);
    if (panel) {
      if (key === tabKey) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  // Filter toolbar visibility
  const filterToolbar = document.getElementById('assessment-filter-toolbar');
  if (filterToolbar) {
    if (tabKey === 'summary') filterToolbar.classList.add('hidden');
    else filterToolbar.classList.remove('hidden');
  }

  renderCurrentAssessmentTab();
};

window.setAssessmentFilter = function(filterType) {
  state.assessmentFilter = filterType;
  const filterBtns = ['all', 'unscored', 'draft', 'completed'];
  filterBtns.forEach(f => {
    const btn = document.getElementById('afilter-btn-' + f);
    if (btn) {
      if (f === filterType) {
        btn.className = 'assessment-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white shadow-xs';
      } else {
        btn.className = 'assessment-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    }
  });
  renderCurrentAssessmentTab();
};

window.onAssessmentSearch = function(query) {
  state.assessmentSearchQuery = String(query || '').toLowerCase().trim();
  renderCurrentAssessmentTab();
};

window.renderCurrentAssessmentTab = function() {
  switch (state.assessmentTab) {
    case 'duyet-1':
      renderAssessmentDuyetList(1);
      break;
    case 'duyet-2':
      renderAssessmentDuyetList(2);
      break;
    case 'duyet-3':
      renderAssessmentDuyetList(3);
      break;
    case 'thesis':
      renderAssessmentThesisList();
      break;
    case 'preliminary':
      renderAssessmentPreliminaryList();
      break;
    case 'defense':
      renderAssessmentDefenseList();
      break;
    case 'summary':
      renderAssessmentSummaryTable();
      break;
  }
};

// Helper: Filter Students by search and filter status
function filterStudentList(students, scoreResolver) {
  const q = state.assessmentSearchQuery;
  const f = state.assessmentFilter;

  return students.filter(s => {
    const sid = String(s.mssv || s.studentId || '').toLowerCase();
    const name = String(s.fullName || s.studentName || '').toLowerCase();
    const topic = String(s.topicTitle || '').toLowerCase();

    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q)) return false;

    const scInfo = scoreResolver(s);
    if (f === 'unscored' && scInfo.status !== 'unscored') return false;
    if (f === 'draft' && scInfo.status !== 'draft') return false;
    if (f === 'completed' && scInfo.status !== 'completed') return false;

    return true;
  });
}

function updateFilterCountBadges(students, scoreResolver, badgeId = null) {
  let cntAll = students.length;
  let cntUnscored = 0;
  let cntDraft = 0;
  let cntCompleted = 0;

  students.forEach(s => {
    const scInfo = scoreResolver(s);
    if (scInfo.status === 'completed') cntCompleted++;
    else if (scInfo.status === 'draft') cntDraft++;
    else cntUnscored++;
  });

  const bAll = document.getElementById('afilter-cnt-all');
  const bUnscored = document.getElementById('afilter-cnt-unscored');
  const bDraft = document.getElementById('afilter-cnt-draft');
  const bCompleted = document.getElementById('afilter-cnt-completed');

  if (bAll) bAll.textContent = cntAll;
  if (bUnscored) bUnscored.textContent = cntUnscored;
  if (bDraft) bDraft.textContent = cntDraft;
  if (bCompleted) bCompleted.textContent = cntCompleted;

  if (badgeId) {
    const tabBadge = document.getElementById(badgeId);
    if (tabBadge) tabBadge.textContent = cntAll;
  }
}

// 1. DUYỆT 1, 2, 3
window.renderAssessmentDuyetList = function(phase) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-duyet-' + phase);
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const candidates = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const sc = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
    if (sc && (sc.status === 'passed' || sc.status === 'failed' || sc.status === 'completed')) {
      return { status: 'completed', score: sc.score, isPassed: sc.score >= 5 };
    }
    if (sc && sc.status === 'draft') {
      return { status: 'draft', score: sc.score };
    }
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(candidates, scoreResolver, 'atab-badge-duyet-' + phase);
  const filtered = filterStudentList(candidates, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc trong đợt Duyệt ${phase}.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);
    const scInfo = scoreResolver(s);

    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa chấm</span>';
    let scoreDisplay = '--';
    if (scInfo.status === 'completed') {
      statusBadge = scInfo.isPassed
        ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>'
        : '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
      scoreDisplay = `<span class="text-sm font-black text-purple-900">${Number(scInfo.score).toFixed(1)}/10</span>`;
    } else if (scInfo.status === 'draft') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Bản nháp</span>';
      scoreDisplay = `<span class="text-sm font-bold text-amber-700">${scInfo.score != null ? Number(scInfo.score).toFixed(1) : '--'}</span>`;
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Student Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisor info & Metadata (STRICTLY NO FILE VIEW/DOWNLOAD) -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Giảng viên Hướng dẫn</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Giai đoạn</span>
            <span class="font-bold text-purple-800">Duyệt tiến độ ${phase}</span>
          </div>
        </div>

        <!-- Right: Status & Score Action -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div>${scoreDisplay}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openScoreEntryModal('duyet_${phase}', '${sid}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✍️</span> <span>${scInfo.status === 'completed' ? 'Sửa điểm' : 'Chấm điểm'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// 2. THUYẾT MINH (HD & PB)
window.renderAssessmentThesisList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-thesis');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const reviewerAssignments = targetRound.reviewerAssignments || {};

  const candidates = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const sid = s.mssv || s.studentId;
    const isReviewer = (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    return isReviewer || isSup;
  });

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const scObj = targetRound.thesisScores?.[sid] || {};
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    const isReviewer = (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);

    let sc = null;
    if (isReviewer && !isSup) sc = scObj.pb;
    else if (isSup && !isReviewer) sc = scObj.hd;
    else sc = scObj.pb || scObj.hd;

    if (sc && sc.status === 'completed') return { status: 'completed', score: sc.score };
    if (sc && sc.status === 'draft') return { status: 'draft', score: sc.score };
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(candidates, scoreResolver, 'atab-badge-thesis');
  const filtered = filterStudentList(candidates, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc Thuyết minh.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);

    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = state.isAdmin || officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    const isReviewer = state.isAdmin || (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);

    const thesisObj = targetRound.thesisScores?.[sid] || {};
    const hdScore = thesisObj.hd?.score;
    const pbScore = thesisObj.pb?.score;

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Scores overview -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div class="flex items-center gap-3">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TM HD</span>
              <span class="font-bold ${hdScore != null ? 'text-emerald-700 font-mono text-sm' : 'text-slate-400'}">${hdScore != null ? Number(hdScore).toFixed(1) : '--'}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TM PB</span>
              <span class="font-bold ${pbScore != null ? 'text-blue-700 font-mono text-sm' : 'text-slate-400'}">${pbScore != null ? Number(pbScore).toFixed(1) : '--'}</span>
            </div>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center justify-between md:justify-end gap-2 shrink-0">
          ${isSup ? `
            <button type="button" onclick="openScoreEntryModal('tm_hd', '${sid}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
              <span>✍️</span> <span>TM GVHD</span>
            </button>
          ` : ''}
          ${isReviewer ? `
            <button type="button" onclick="openScoreEntryModal('tm_pb', '${sid}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
              <span>✍️</span> <span>TM Phản biện</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

// 3. SƠ KHẢO
window.renderAssessmentPreliminaryList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-preliminary');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const key = `prelim_${sid}_${uId}`;
    const sc = targetRound.preliminaryScores?.[key];
    if (sc && sc.status === 'completed') return { status: 'completed', score: sc.score };
    if (sc && sc.status === 'draft') return { status: 'draft', score: sc.score };
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(allRegs, scoreResolver, 'atab-badge-preliminary');
  const filtered = filterStudentList(allRegs, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc Sơ khảo.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);
    const scInfo = scoreResolver(s);

    // Summary of preliminary average
    const prelimSummary = getPreliminarySummary(sid, targetRound.id);
    const avgStr = prelimSummary.average != null ? Number(prelimSummary.average).toFixed(1) : '--';

    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa chấm</span>';
    let myScoreText = '--';
    if (scInfo.status === 'completed') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đã chấm</span>';
      myScoreText = `<span class="text-sm font-black text-purple-900">${Number(scInfo.score).toFixed(1)}/10</span>`;
    } else if (scInfo.status === 'draft') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Bản nháp</span>';
      myScoreText = `<span class="text-sm font-bold text-amber-700">${scInfo.score != null ? Number(scInfo.score).toFixed(1) : '--'}</span>`;
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisor & Score stats -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TB Sơ khảo (${prelimSummary.count} lượt)</span>
            <span class="font-bold text-indigo-700 text-sm font-mono">${avgStr}</span>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div>${myScoreText}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openScoreEntryModal('preliminary', '${sid}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✍️</span> <span>${scInfo.status === 'completed' ? 'Sửa điểm' : 'Chấm sơ khảo'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// 4. BẢO VỆ (HỘI ĐỒNG)
window.renderAssessmentDefenseList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-defense');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();

  // Find all activities with councils
  const actsWithCouncils = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  let availableCouncils = [];

  actsWithCouncils.forEach(act => {
    act.councils.forEach(c => {
      const members = Object.values(c.membersBySlot || {});
      const isMember = members.some(m => m.memberEmail && m.memberEmail.toLowerCase() === uEmail);
      if (actor.isAdmin || isMember) {
        availableCouncils.push({ act, council: c });
      }
    });
  });

  const councilSelect = document.getElementById('assessment-council-select');
  if (availableCouncils.length === 0) {
    if (councilSelect) councilSelect.innerHTML = '<option value="">-- Chưa được phân công Hội đồng nào --</option>';
    container.innerHTML = '<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">Thầy/Cô chưa có phân công trong Hội đồng bảo vệ nào của đợt này.</div>';
    return;
  }

  if (councilSelect) {
    councilSelect.innerHTML = availableCouncils.map(item => {
      return `<option value="${item.council.id}">${item.council.name} (${item.act.title})</option>`;
    }).join('');

    if (!state.selectedAssessmentCouncilId || !availableCouncils.some(item => item.council.id === state.selectedAssessmentCouncilId)) {
      state.selectedAssessmentCouncilId = availableCouncils[0].council.id;
    }
    councilSelect.value = state.selectedAssessmentCouncilId;
  }

  // Current council info
  const currentItem = availableCouncils.find(item => item.council.id === state.selectedAssessmentCouncilId) || availableCouncils[0];
  const act = currentItem.act;
  const council = currentItem.council;

  // Banner details
  const nameEl = document.getElementById('assessment-cinfo-name');
  const statusEl = document.getElementById('assessment-cinfo-status');
  const timeRoomEl = document.getElementById('assessment-cinfo-time-room');
  const chairEl = document.getElementById('assessment-cinfo-chair');
  const secEl = document.getElementById('assessment-cinfo-secretary');
  const memEl = document.getElementById('assessment-cinfo-members');

  if (nameEl) nameEl.textContent = council.name || 'Hội đồng Bảo vệ';
  if (statusEl) {
    const stMap = { preparing: 'Chuẩn bị', active: 'Đang diễn ra', ended: 'Kết thúc', finalized: 'Đã khóa' };
    statusEl.textContent = stMap[council.status] || 'Chuẩn bị';
  }
  if (timeRoomEl) {
    timeRoomEl.textContent = `📍 Phòng: ${council.room || 'Chưa cập nhật'} • 📅 Ngày: ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})`;
  }

  const membersBySlot = council.membersBySlot || {};
  if (chairEl) chairEl.textContent = membersBySlot['chair']?.memberName || '--';
  if (secEl) secEl.textContent = membersBySlot['secretary']?.memberName || '--';
  if (memEl) {
    const otherMembers = Object.entries(membersBySlot)
      .filter(([k]) => k !== 'chair' && k !== 'secretary')
      .map(([, v]) => v.memberName)
      .filter(Boolean);
    memEl.textContent = otherMembers.join(', ') || '--';
  }

  // Assigned students in this council
  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === council.id);
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const studentsInCouncil = assignments.map(a => {
    const sObj = allRegs.find(s => (s.mssv || s.studentId) === a.studentId) || { studentId: a.studentId };
    return { ...sObj, ...a };
  });

  const tabBadge = document.getElementById('atab-badge-defense');
  if (tabBadge) tabBadge.textContent = studentsInCouncil.length;

  if (studentsInCouncil.length === 0) {
    container.innerHTML = '<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">Hội đồng này hiện chưa có sinh viên nào được phân công.</div>';
    return;
  }

  container.innerHTML = studentsInCouncil.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const supName = formatStudentSupervisorsForDisplay(s);
    const initial = (name || 'SV').charAt(0).toUpperCase();

    // Defense status from council engine
    const defenseScore = s.defenseScore != null ? Number(s.defenseScore).toFixed(1) : '--';
    const defenseStatus = s.presentationStatus || 'pending';
    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa báo cáo</span>';
    if (defenseStatus === 'presenting') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">Đang báo cáo</span>';
    } else if (defenseStatus === 'completed') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã hoàn tất</span>';
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${idx + 1}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisors & presentation order -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Thứ tự báo cáo</span>
            <span class="font-bold text-slate-800">Lượt #${s.presentationOrder || (idx + 1)}</span>
          </div>
        </div>

        <!-- Right: Status & Workspace button -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div class="text-sm font-black text-purple-900">${defenseScore !== '--' ? defenseScore + '/10' : '--'}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openCouncilWorkspace('${targetRound.id}', '${act.id}', '${council.id}', '${sid}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>🏛️</span> <span>Vào phòng chấm</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.onAssessmentCouncilChange = function(councilId) {
  state.selectedAssessmentCouncilId = councilId;
  renderAssessmentDefenseList();
};

window.launchAssessmentCouncilWorkspace = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const councilId = state.selectedAssessmentCouncilId;
  if (!councilId) {
    showToast('Chưa chọn Hội đồng nào!', 'warning');
    return;
  }

  let actId = null;
  (targetRound.activities || []).forEach(a => {
    if (a.councilEnabled && (a.councils || []).some(c => c.id === councilId)) {
      actId = a.id;
    }
  });

  if (targetRound.id && actId && councilId) {
    openCouncilWorkspace(targetRound.id, actId, councilId);
  } else {
    showToast('Không tìm thấy dữ liệu Hội đồng!', 'error');
  }
};

// 5. TỔNG KẾT (ADMIN ONLY)
window.renderAssessmentSummaryTable = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const tbody = document.getElementById('assessment-summary-tbody');
  if (!targetRound || !tbody) return;

  const ranking = computeRoundRanking(targetRound.id);
  const allStudents = [...(ranking.rankedStudents || []), ...(ranking.incompleteStudents || [])];

  const tabBadge = document.getElementById('atab-badge-summary');
  if (tabBadge) tabBadge.textContent = allStudents.length;

  if (allStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-400">Chưa có dữ liệu tổng kết điểm cho đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = allStudents.map((st, idx) => {
    const isRanked = st.rank != null;
    const gvhdScore = st.components?.gvhd?.raw != null ? Number(st.components.gvhd.raw).toFixed(1) : '--';
    const tmHdScore = targetRound.thesisScores?.[st.studentId]?.hd?.score != null ? Number(targetRound.thesisScores[st.studentId].hd.score).toFixed(1) : '--';
    const tmPbScore = targetRound.thesisScores?.[st.studentId]?.pb?.score != null ? Number(targetRound.thesisScores[st.studentId].pb.score).toFixed(1) : '--';
    const tmScore = st.components?.tm?.raw != null ? Number(st.components.tm.raw).toFixed(1) : '--';
    const defenseScore = st.components?.defense?.raw != null ? Number(st.components.defense.raw).toFixed(1) : '--';
    const finalScore = isRanked && st.rawScore != null ? Number(st.rawScore).toFixed(2) : '--';
    const rankDisplay = isRanked ? `#${st.rank}` : '--';
    const titleDisplay = st.title || (isRanked ? 'Hoàn thành' : 'Chưa đủ điểm');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${rankDisplay}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${st.studentId}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${st.fullName}</td>
        <td class="p-3 text-slate-600 whitespace-nowrap">${formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))}</td>
        <td class="p-3 text-center font-mono text-slate-700">${gvhdScore}</td>
        <td class="p-3 text-center font-mono text-slate-700">${tmHdScore}</td>
        <td class="p-3 text-center font-mono text-slate-700">${tmPbScore}</td>
        <td class="p-3 text-center font-mono font-semibold text-blue-800">${tmScore}</td>
        <td class="p-3 text-center font-mono font-semibold text-purple-800">${defenseScore}</td>
        <td class="p-3 text-center font-mono font-black text-slate-900 bg-slate-50">${finalScore}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isRanked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${titleDisplay}
          </span>
        </td>
      </tr>
    `;
  }).join('');
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof checkUserAssessmentCapabilities !== 'undefined') window.checkUserAssessmentCapabilities = checkUserAssessmentCapabilities;
  if (typeof filterStudentList !== 'undefined') window.filterStudentList = filterStudentList;
  if (typeof updateFilterCountBadges !== 'undefined') window.updateFilterCountBadges = updateFilterCountBadges;
  if (typeof scoreResolver !== 'undefined') window.scoreResolver = scoreResolver;
}
