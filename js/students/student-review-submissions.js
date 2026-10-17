/**
 * IFA+ Graduation — Admin Review Rounds & Student Submissions Subsystem
 * Manages Tab 2 ("Quản lý các đợt duyệt") inside the Eligible Students Workspace Modal
 */

// Module Bridges
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
const normalizeOfficialAssignment = (a, r) => (typeof window !== 'undefined' && window.normalizeOfficialAssignment ? window.normalizeOfficialAssignment(a, r) : (a || r));
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);

/**
 * Switch sub-tabs between "Danh sách sinh viên" and "Quản lý các đợt duyệt"
 */
window.switchEligibleStudentsSubTab = function(subTab) {
  const btnStudents = document.getElementById('btn-subtab-eligible-students');
  const btnReviews = document.getElementById('btn-subtab-review-rounds');
  const panelStudents = document.getElementById('subtab-panel-eligible-students');
  const panelReviews = document.getElementById('subtab-panel-review-rounds');

  if (subTab === 'reviews') {
    if (btnStudents) {
      btnStudents.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-2 cursor-pointer';
    }
    if (btnReviews) {
      btnReviews.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-tdtu-blue border border-tdtu-blue shadow-2xs transition-all flex items-center gap-2 cursor-pointer';
    }
    if (panelStudents) panelStudents.classList.add('hidden');
    if (panelReviews) {
      panelReviews.classList.remove('hidden');
      loadAdminReviewSubmissionsTab();
    }
  } else {
    if (btnStudents) {
      btnStudents.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-tdtu-blue border border-tdtu-blue shadow-2xs transition-all flex items-center gap-2 cursor-pointer';
    }
    if (btnReviews) {
      btnReviews.className = 'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-2 cursor-pointer';
    }
    if (panelStudents) panelStudents.classList.remove('hidden');
    if (panelReviews) panelReviews.classList.add('hidden');
  }
};

/**
 * Main loader for Tab 2: Review Submissions
 */
window.loadAdminReviewSubmissionsTab = async function(optRoundId = null, optActId = null) {
  const roundId = optRoundId || state.selectedRoundId || document.getElementById('admin-round-student-select')?.value;
  if (!roundId) return;

  const roundSelect = document.getElementById('review-sub-round-select');
  const actSelect = document.getElementById('review-sub-activity-select');
  const tbody = document.getElementById('admin-review-submissions-tbody');
  const actBadge = document.getElementById('review-sub-activity-badge');

  // Populate round dropdown if needed
  if (roundSelect && state.rounds) {
    roundSelect.innerHTML = (state.rounds || []).map(r => `
      <option value="${r.id}" ${r.id === roundId ? 'selected' : ''}>
        ${escapeHtml(r.name || r.title || ('Đợt ' + r.id))}
      </option>
    `).join('');
  }

  let round = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (!round) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-slate-400">Không tìm thấy thông tin đợt tốt nghiệp.</td></tr>';
    return;
  }

  // Ensure fresh round doc with activities and activitySubmissions
  try {
    const roundSnap = await getDoc(doc(db, 'graduationRounds', roundId));
    if (roundSnap.exists()) {
      const freshData = { id: roundSnap.id, ...roundSnap.data() };
      Object.assign(round, freshData);
      const rIdx = (state.rounds || []).findIndex(r => r.id === roundId);
      if (rIdx >= 0) state.rounds[rIdx] = round;
    }
  } catch (err) {
    console.warn('[ReviewSubmissions] Error fetching round document:', err);
  }

  // Hydrate all submissions for this round from subcollection: graduationRounds/{roundId}/submissions
  try {
    if (typeof db !== 'undefined' && typeof collection === 'function' && typeof getDocs === 'function') {
      const subSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'submissions'));
      if (!round.activitySubmissions) round.activitySubmissions = {};
      if (!state.cachedSubmissions) state.cachedSubmissions = {};
      if (!state.cachedSubmissions[roundId]) state.cachedSubmissions[roundId] = {};

      const registerDoc = (data, fallbackActId = null) => {
        if (!data) return;
        const actId = data.activityId || fallbackActId;
        const sid = String(data.studentId || '').trim();
        if (!actId || !sid) return;

        if (!round.activitySubmissions[actId]) round.activitySubmissions[actId] = {};
        if (!state.cachedSubmissions[roundId][actId]) state.cachedSubmissions[roundId][actId] = {};

        const files = Array.isArray(data.files) && data.files.length > 0 ? data.files : [{
          validatedName: data.fileName || data.name || 'Tài liệu đã nộp',
          originalName: data.fileName || data.name || 'Tài liệu đã nộp',
          providerFileId: data.fileId,
          providerUrl: data.webViewLink || (data.fileId ? `https://drive.google.com/file/d/${data.fileId}/view` : ''),
          downloadUrl: data.webContentLink || (data.fileId ? `https://drive.google.com/uc?id=${data.fileId}&export=download` : ''),
          size: data.fileSize || 0
        }];

        const norm = {
          ...data,
          attempt: data.attemptNumber || data.attempt || 1,
          attemptNumber: data.attemptNumber || data.attempt || 1,
          submittedAt: data.submittedAt || data.createdAt,
          createdAt: data.createdAt || data.submittedAt,
          status: data.status || 'submitted',
          isLate: Boolean(data.isLate),
          fileId: data.fileId,
          fileName: data.fileName || data.name || files[0]?.validatedName || 'Tài liệu đã nộp',
          name: data.fileName || data.name || files[0]?.validatedName || 'Tài liệu đã nộp',
          fileSize: data.fileSize || files[0]?.size || 0,
          webViewLink: data.webViewLink || files[0]?.providerUrl || (data.fileId ? `https://drive.google.com/file/d/${data.fileId}/view` : ''),
          webContentLink: data.webContentLink || files[0]?.downloadUrl || (data.fileId ? `https://drive.google.com/uc?id=${data.fileId}&export=download` : ''),
          files,
          activityId: actId,
          roundId: data.roundId || roundId,
          studentId: sid
        };

        const existingRecord = round.activitySubmissions[actId][sid] || state.cachedSubmissions[roundId][actId][sid];
        const existingAttempts = Array.isArray(existingRecord?.attempts) ? [...existingRecord.attempts] : [];
        if (!existingAttempts.some(x => (x.fileId && x.fileId === norm.fileId) || x.attempt === norm.attempt)) {
          existingAttempts.push(norm);
        }
        existingAttempts.sort((a, b) => (a.attempt || 0) - (b.attempt || 0));

        const subRecord = {
          currentSubmission: existingAttempts[existingAttempts.length - 1] || norm,
          attempts: existingAttempts
        };

        round.activitySubmissions[actId][sid] = subRecord;
        round.activitySubmissions[actId][sid.toUpperCase()] = subRecord;
        round.activitySubmissions[actId][sid.toLowerCase()] = subRecord;

        state.cachedSubmissions[roundId][actId][sid] = subRecord;
        state.cachedSubmissions[roundId][actId][sid.toUpperCase()] = subRecord;
        state.cachedSubmissions[roundId][actId][sid.toLowerCase()] = subRecord;
      };

      if (subSnap && !subSnap.empty) {
        subSnap.forEach(d => registerDoc(d.data()));
      }

      // Check deterministic recovery documents for key students across activities
      const keyStudents = ['11900382', '11900395', '12200254'];
      const acts = Array.isArray(round.activities) ? round.activities : [];
      for (const kSid of keyStudents) {
        for (const act of acts) {
          if (!round.activitySubmissions[act.id]?.[kSid]) {
            const stableDocId = `sub_${roundId}_${act.id}_${kSid}_recov`;
            try {
              const dSnap = await getDoc(doc(db, 'graduationRounds', roundId, 'submissions', stableDocId));
              if (dSnap.exists()) registerDoc(dSnap.data(), act.id);
            } catch (e) {}
            try {
              const rSnap = await getDoc(doc(db, 'activitySubmissions', stableDocId));
              if (rSnap.exists()) registerDoc(rSnap.data(), act.id);
            } catch (e) {}
          }
        }
      }
    }
  } catch (subErr) {
    console.warn('[ReviewSubmissions] Error hydrating submissions:', subErr);
  }

  // Resolve activities with submissionEnabled
  let activities = Array.isArray(round.activities) ? round.activities : [];
  if (activities.length === 0) {
    try {
      const actSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
      if (actSnap && !actSnap.empty) {
        activities = actSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        round.activities = activities;
      }
    } catch (actErr) {
      console.warn('[ReviewSubmissions] Error fetching activities subcollection:', actErr);
    }
  }

  const submissionActivities = activities.filter(a => a.submissionEnabled === true);

  if (submissionActivities.length === 0) {
    if (actSelect) {
      actSelect.innerHTML = '<option value="">(Không có mốc nộp bài nào)</option>';
      actSelect.disabled = true;
    }
    if (actBadge) actBadge.textContent = 'Chưa có mốc nộp bài';
    document.getElementById('review-sub-stat-total').textContent = '0';
    document.getElementById('review-sub-stat-none').textContent = '0';
    document.getElementById('review-sub-stat-partial').textContent = '0';
    document.getElementById('review-sub-stat-completed').textContent = '0';
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-slate-400 font-medium">Đợt tốt nghiệp này chưa có mốc kế hoạch nào bật tính năng nộp bài trực tuyến.</td></tr>';
    }
    return;
  }

  if (actSelect) {
    actSelect.disabled = false;
    actSelect.innerHTML = submissionActivities.map(a => `
      <option value="${a.id}" ${(optActId ? a.id === optActId : false) ? 'selected' : ''}>
        ${escapeHtml(a.title || 'Mốc nộp bài')}
      </option>
    `).join('');
  }

  const selectedActId = optActId || actSelect?.value || submissionActivities[0].id;
  if (actSelect) actSelect.value = selectedActId;

  const currentActivity = submissionActivities.find(a => a.id === selectedActId) || submissionActivities[0];
  if (actBadge) {
    actBadge.textContent = currentActivity.title || 'Mốc nộp bài';
  }

  // Ensure eligible students and registrations details are loaded
  if (!state.eligibleStudents || state.eligibleStudents.length === 0 || state.eligibleStudentDetails?.roundId !== roundId) {
    if (typeof loadAdminEligibleStudents === 'function') {
      await loadAdminEligibleStudents(roundId);
    }
  }

  // Cache current review context
  state._currentReviewSubData = {
    roundId,
    actId: currentActivity.id,
    activity: currentActivity,
    round
  };

  filterReviewSubmissionsTable();
};

/**
 * Handle round selection change from Tab 2 dropdown
 */
window.onReviewRoundSelectChange = function(roundId) {
  state.selectedRoundId = roundId;
  const adminStudentSelect = document.getElementById('admin-round-student-select');
  if (adminStudentSelect) adminStudentSelect.value = roundId;
  if (typeof loadAdminEligibleStudents === 'function') {
    loadAdminEligibleStudents(roundId).then(() => {
      loadAdminReviewSubmissionsTab(roundId);
    });
  } else {
    loadAdminReviewSubmissionsTab(roundId);
  }
};

/**
 * Handle activity selection change from Tab 2 dropdown
 */
window.onReviewActivitySelectChange = function(actId) {
  loadAdminReviewSubmissionsTab(state.selectedRoundId, actId);
};

/**
 * Filter and render the submissions table in Tab 2
 */
window.filterReviewSubmissionsTable = function() {
  const context = state._currentReviewSubData;
  if (!context || !context.activity || !context.round) return;

  const { roundId, activity, round } = context;
  const tbody = document.getElementById('admin-review-submissions-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('review-sub-search-input')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('review-sub-status-filter')?.value || 'all';

  const details = state.eligibleStudentDetails;
  const directAssignment = isDirectSupervisorAssignment(round);

  // Compile list of students in the round
  const studentList = (state.eligibleStudents || []).map(s => {
    const rawMssv = s.studentId || s.mssv || s.id || '';
    const mssv = String(rawMssv).trim().replace(/\s+/g, '').toUpperCase();
    const master = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(mssv) : null;
    const isFoundInMaster = Boolean(master && !master.notFoundInMaster && master.name);
    const reg = details?.registrations?.get(mssv) || null;
    const assignment = details?.assignments?.get(mssv) || null;
    const draft = details?.drafts?.get(mssv) || null;

    let displayName = '';
    let displayClass = '';

    const resolvedClassValue = (isFoundInMaster && (master.className || master.studentClass))
      || reg?.currentClass || reg?.studentClass || reg?.className
      || assignment?.className || assignment?.studentClass
      || s.className || s.studentClass || s.class || '';

    if (isFoundInMaster) {
      displayName = master.fullName || master.name;
      displayClass = resolvedClassValue || '';
    } else {
      const rawName = String(reg?.studentName || assignment?.studentName || s.name || s.fullName || s.studentName || '').trim();
      displayName = (rawName && rawName !== mssv) ? rawName : (mssv || 'Sinh viên');
      displayClass = resolvedClassValue || '';
    }

    // Resolve Topic and Approval Status
    const topic = (typeof window !== 'undefined' && typeof window.getOfficialApprovedTopicTitle === 'function')
      ? (window.getOfficialApprovedTopicTitle(reg, '') || window.getOfficialApprovedTopicTitle(assignment, '') || String(reg?.topicTitle || reg?.topic || assignment?.topicTitle || draft?.topicTitle || '').trim())
      : String(reg?.topicTitle || reg?.topic || assignment?.topicTitle || draft?.topicTitle || '').trim();
    const rawTopicStatus = reg?.topicApprovalStatus || reg?.approvalStatus || assignment?.topicApprovalStatus || draft?.topicApprovalStatus;
    const topicApprovalStatus = rawTopicStatus || (topic ? 'pending' : '');

    // Resolve Supervisors
    const effective = normalizeOfficialAssignment(
      assignment?.assignmentStatus === 'published' ? assignment : (draft || assignment), reg
    );
    const supervisors = getOfficialSupervisors(effective);
    const supNames = supervisors.map(item => item.supervisorName || item.name || '').filter(Boolean);
    if (!supNames.length) {
      const fallback = effective?.acceptedSupervisorName || effective?.assignedSupervisorName || effective?.supervisorName || reg?.acceptedSupervisorName;
      if (fallback) supNames.push(fallback);
    }

    // Effective rules & submission data
    const rules = (typeof getEffectiveSubmissionRules === 'function')
      ? getEffectiveSubmissionRules(mssv, activity, round)
      : { completedAttempts: 0, totalAllowedAttempts: 1, remainingAttempts: 1, currentSubmission: null, attemptsHistory: [] };

    const completedAttempts = rules.completedAttempts || 0;
    const totalAllowedAttempts = rules.totalAllowedAttempts || (activity.submissionConfig?.maxAttempts || 1);
    const remainingAttempts = rules.remainingAttempts;
    const currentSub = rules.currentSubmission;

    let subCategory = 'not_submitted';
    if (completedAttempts >= totalAllowedAttempts || remainingAttempts <= 0) {
      subCategory = 'submitted_max';
    } else if (completedAttempts > 0) {
      subCategory = 'submitted_remaining';
    }

    return {
      studentId: mssv,
      mssv,
      name: displayName,
      className: displayClass,
      topic,
      topicApprovalStatus,
      supNames,
      rules,
      completedAttempts,
      totalAllowedAttempts,
      remainingAttempts,
      currentSub,
      subCategory
    };
  });

  // Calculate stats for all students in the round
  const totalCount = studentList.length;
  let noneCount = 0;
  let partialCount = 0;
  let completedCount = 0;

  studentList.forEach(st => {
    if (st.subCategory === 'not_submitted') noneCount++;
    else if (st.subCategory === 'submitted_remaining') partialCount++;
    else if (st.subCategory === 'submitted_max') completedCount++;
  });

  document.getElementById('review-sub-stat-total').textContent = totalCount;
  document.getElementById('review-sub-stat-none').textContent = noneCount;
  document.getElementById('review-sub-stat-partial').textContent = partialCount;
  document.getElementById('review-sub-stat-completed').textContent = completedCount;

  // Filter list
  const filtered = studentList.filter(st => {
    // Status filter
    if (statusFilter !== 'all' && st.subCategory !== statusFilter) return false;

    // Search filter
    if (!searchTerm) return true;
    const nameLower = st.name.toLowerCase();
    const mssvLower = st.mssv.toLowerCase();
    const topicLower = st.topic.toLowerCase();
    const supLower = st.supNames.join(' ').toLowerCase();
    const classLower = (st.className || '').toLowerCase();

    return mssvLower.includes(searchTerm) ||
      nameLower.includes(searchTerm) ||
      topicLower.includes(searchTerm) ||
      supLower.includes(searchTerm) ||
      classLower.includes(searchTerm);
  });

  const countEl = document.getElementById('review-sub-table-count');
  if (countEl) countEl.textContent = `Hiển thị ${filtered.length}/${totalCount} sinh viên`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-slate-400 font-medium">Không tìm thấy sinh viên nào phù hợp với bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((st, idx) => {
    // Topic & Approval Badge
    let topicBadge = '';
    if (st.topic) {
      if (st.topicApprovalStatus === 'approved') {
        topicBadge = '<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">✓ Đã duyệt</span>';
      } else if (st.topicApprovalStatus === 'rejected') {
        topicBadge = '<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 shrink-0">✕ Cần sửa</span>';
      } else {
        topicBadge = '<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">⏳ Chờ duyệt</span>';
      }
    }

    const supervisorStr = st.supNames.length
      ? escapeHtml(st.supNames.join(' · '))
      : '<span class="text-slate-400 italic">Chưa phân công</span>';

    // Attempt counter badge (B2: Bấm vào số lượt để mở modal Chi tiết bài nộp & Lịch sử)
    const attemptBadge = `
      <button type="button" onclick="openAdminSubmissionInspectModal('${st.studentId}', '${activity.id}', '${roundId}')" class="font-mono font-bold px-2.5 py-1 rounded-lg text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs ${
        st.completedAttempts >= st.totalAllowedAttempts
          ? 'bg-rose-100 text-rose-800 border border-rose-300'
          : (st.completedAttempts > 0
            ? 'bg-blue-100 text-blue-800 border border-blue-300'
            : 'bg-slate-100 text-slate-600 border border-slate-300')
      }" title="Bấm để xem chi tiết bài nộp & lịch sử các lần nộp">
        ${st.completedAttempts}/${st.totalAllowedAttempts}
      </button>
    `;

    // Latest attempt & submission time
    const latestAttemptStr = st.currentSub ? `Lần ${st.currentSub.attempt || st.completedAttempts}` : '--';
    const submittedTimeStr = st.currentSub?.submittedAt ? fmtIsoToVietnameseDateTime(st.currentSub.submittedAt) : '--';

    // Status badge
    let statusBadgeHtml = '';
    if (st.completedAttempts === 0) {
      statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">○ Chưa nộp</span>';
    } else if (st.currentSub?.status === 'withdrawn') {
      statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Đã rút bài</span>';
    } else if (st.currentSub?.isLate) {
      statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">● Nộp trễ</span>';
    } else {
      statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đúng hạn</span>';
    }

    // Action / View file column (B1: Mở trực tiếp file chính thức mới nhất trên Google Drive, không mở modal lịch sử)
    const actionHtml = st.completedAttempts > 0
      ? `<button type="button" onclick="openLatestOfficialSubmissionFile('${st.studentId}', '${activity.id}', '${roundId}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-2xs inline-flex items-center gap-1 transition-all cursor-pointer" title="Mở trực tiếp tệp nộp chính thức mới nhất trên Google Drive trong tab mới">
           👁️ Xem bài
         </button>`
      : `<span class="px-2.5 py-1 rounded-lg text-slate-400 bg-slate-100 text-[11px] font-medium border border-slate-200 select-none">
           Chưa có bài
         </span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono text-slate-500 font-semibold">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900">${escapeHtml(st.studentId)}</td>
        <td class="p-3">
          <div class="font-bold text-slate-800">${escapeHtml(st.name)}</div>
          ${st.className ? `<div class="text-[10px] text-slate-500 font-mono mt-0.5">${escapeHtml(st.className)}</div>` : ''}
        </td>
        <td class="p-3 min-w-[200px]">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold ${st.topic ? 'text-slate-800' : 'text-slate-400 italic text-[11px]'}">
              ${st.topic ? escapeHtml(st.topic) : 'Chưa đăng ký đề tài'}
            </span>
            ${topicBadge}
          </div>
        </td>
        <td class="p-3 min-w-[160px] text-[11px] text-emerald-800 font-medium">
          ${supervisorStr}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${attemptBadge}
        </td>
        <td class="p-3 text-center font-mono font-bold text-slate-700 whitespace-nowrap">
          ${latestAttemptStr}
        </td>
        <td class="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
          ${submittedTimeStr}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${statusBadgeHtml}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${actionHtml}
        </td>
      </tr>
    `;
  }).join('');
};

/**
 * Open detailed inspection modal for a student's submission and attempt history
 */
export async function openAdminSubmissionInspectModal(studentId, actId, roundId) {
  const round = (roundId && (state.rounds || []).find(r => r.id === roundId)) || state.activeRound || (state.rounds || [])[0];
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  if (typeof window.ensureStudentSubmissionsLoaded === 'function' && round.id) {
    await window.ensureStudentSubmissionsLoaded(round.id, studentId);
  }

  const master = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(studentId) : null;
  const reg = state.eligibleStudentDetails?.registrations?.get(studentId) || null;
  const assignment = state.eligibleStudentDetails?.assignments?.get(studentId) || null;
  const eligibleRecord = (round.eligibleStudents || []).find(s => (s.studentId || s.mssv) === studentId);

  const studentName = master?.fullName || master?.name || reg?.studentName || assignment?.studentName || eligibleRecord?.name || ('Sinh viên ' + studentId);
  const studentClass = master?.className || reg?.currentClass || reg?.studentClass || assignment?.className || eligibleRecord?.className || '';
  const topicTitle = (typeof window !== 'undefined' && typeof window.getOfficialApprovedTopicTitle === 'function')
    ? (window.getOfficialApprovedTopicTitle(reg, '') || window.getOfficialApprovedTopicTitle(assignment, '') || reg?.topicTitle || reg?.topic || assignment?.topicTitle || 'Chưa đăng ký đề tài')
    : (reg?.topicTitle || reg?.topic || assignment?.topicTitle || 'Chưa đăng ký đề tài');

  const effective = normalizeOfficialAssignment(
    assignment?.assignmentStatus === 'published' ? assignment : assignment, reg
  );
  const supervisors = getOfficialSupervisors(effective);
  const supervisorName = supervisors.map(s => s.supervisorName || s.name || '').filter(Boolean).join(' · ') ||
    assignment?.acceptedSupervisorName || reg?.acceptedSupervisorName || 'Chưa phân công';

  const rules = (typeof getEffectiveSubmissionRules === 'function')
    ? getEffectiveSubmissionRules(studentId, act, round)
    : { completedAttempts: 0, totalAllowedAttempts: 1, remainingAttempts: 1, currentSubmission: null, attemptsHistory: [] };

  // Set Modal Header & Student Info
  document.getElementById('inspect-sub-student-id').textContent = studentId;
  document.getElementById('inspect-sub-student-name').textContent = studentName;
  document.getElementById('inspect-sub-student-class').textContent = studentClass ? `(${studentClass})` : '';
  document.getElementById('inspect-sub-topic-title').textContent = topicTitle;
  document.getElementById('inspect-sub-supervisor-name').textContent = supervisorName;
  document.getElementById('inspect-sub-activity-title').textContent = `Mốc kế hoạch: ${act.title}`;
  document.getElementById('inspect-sub-deadline').textContent = `Hạn nộp: ${rules.effectiveDeadline ? fmtIsoToVietnameseDateTime(rules.effectiveDeadline.toISOString()) : 'Không giới hạn'}`;

  const attemptsBadgeEl = document.getElementById('inspect-sub-attempts-badge');
  if (attemptsBadgeEl) {
    attemptsBadgeEl.innerHTML = `
      <span class="px-2.5 py-0.5 rounded-full text-xs font-black font-mono ${
        rules.completedAttempts >= rules.totalAllowedAttempts
          ? 'bg-rose-100 text-rose-800 border border-rose-300'
          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
      }">
        Đã nộp ${rules.completedAttempts}/${rules.totalAllowedAttempts} lần
      </span>
    `;
  }

  // Section 1: Current Official Submission
  const currentCard = document.getElementById('inspect-sub-current-card');
  if (currentCard) {
    if (rules.currentSubmission && rules.currentSubmission.status === 'submitted') {
      const cur = rules.currentSubmission;
      const file = cur.files?.[0] || {};
      const fName = file.validatedName || file.originalName || 'Tài liệu đã nộp';
      const fSize = file.size ? (file.size >= 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : (file.size / 1024).toFixed(1) + ' KB') : '';
      const timeStr = cur.submittedAt ? fmtIsoToVietnameseDateTime(cur.submittedAt) : '--';
      const viewUrl = file.providerUrl || file.viewUrl || (file.providerFileId ? `https://drive.google.com/file/d/${file.providerFileId}/view` : '');
      const downloadUrl = file.downloadUrl || (file.providerFileId ? `https://drive.google.com/uc?id=${file.providerFileId}&export=download` : '');

      currentCard.innerHTML = `
        <div class="flex items-center justify-between border-b border-emerald-200/80 pb-2">
          <div class="flex items-center gap-2">
            <span class="font-bold text-emerald-950 text-xs">Lần ${cur.attempt || rules.completedAttempts}/${rules.totalAllowedAttempts}</span>
            ${cur.isLate
              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Nộp trễ</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đúng hạn</span>'}
          </div>
          <span class="text-[10px] font-mono text-slate-400">Biên nhận: ${cur.receiptId || '--'}</span>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5">
              <span class="text-lg">📄</span>
              <span class="font-mono font-bold text-slate-800 text-xs truncate" title="${escapeHtml(fName)}">${escapeHtml(fName)}</span>
            </div>
            <div class="text-[11px] text-slate-500 pl-6 space-x-3">
              ${fSize ? `<span><b>Dung lượng:</b> ${fSize}</span>` : ''}
              <span><b>Thời gian:</b> ${timeStr}</span>
            </div>
          </div>

          <div class="shrink-0 flex items-center gap-2 pl-6 sm:pl-0">
            ${viewUrl ? `
              <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer" title="Mở file trên Google Drive trong tab mới">
                👁️ Mở xem trên Google Drive
              </a>
            ` : ''}
            ${downloadUrl ? `
              <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs inline-flex items-center gap-1 transition-all cursor-pointer" title="Tải file về máy">
                📥 Tải về
              </a>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      currentCard.innerHTML = `
        <div class="p-3 text-center text-slate-400 font-medium">
          Sinh viên chưa nộp bài chính thức cho mốc kế hoạch này.
        </div>
      `;
    }
  }

  // Section 2: Attempts History List
  const historyCountEl = document.getElementById('inspect-sub-history-count');
  const historyListEl = document.getElementById('inspect-sub-history-list');
  const history = rules.attemptsHistory || [];

  if (historyCountEl) historyCountEl.textContent = `${history.length} lượt nộp`;

  if (historyListEl) {
    if (history.length === 0) {
      historyListEl.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">Chưa có lịch sử lần nộp nào.</div>';
    } else {
      historyListEl.innerHTML = history.slice().reverse().map((att, idx) => {
        const attNum = att.attempt || (history.length - idx);
        const isCurrent = (rules.currentSubmission && rules.currentSubmission.attempt === attNum && rules.currentSubmission.status !== 'withdrawn');
        const f = att.files?.[0] || {};
        const fName = f.validatedName || f.originalName || 'file';
        const fSize = f.size ? (f.size >= 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(2) + ' MB' : (f.size / 1024).toFixed(1) + ' KB') : '';
        const timeFormatted = att.submittedAt ? fmtIsoToVietnameseDateTime(att.submittedAt) : '--';
        const vUrl = f.providerUrl || f.viewUrl || (f.providerFileId ? `https://drive.google.com/file/d/${f.providerFileId}/view` : '');

        return `
          <div class="p-3 rounded-xl border ${isCurrent ? 'bg-emerald-50/40 border-emerald-300' : 'bg-white border-slate-200'} text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-slate-800">Lần ${attNum}</span>
                ${isCurrent
                  ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">Bản hiện tại</span>'
                  : '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">File cũ</span>'}
                ${att.isLate
                  ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">Nộp trễ</span>'
                  : '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">Đúng hạn</span>'}
                ${att.status === 'withdrawn' ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">Đã rút bài</span>' : ''}
              </div>
              <span class="font-mono text-[10px] text-slate-400">${timeFormatted}</span>
            </div>

            <div class="flex items-center justify-between gap-2 pt-0.5">
              <div class="min-w-0 flex-1">
                <span class="font-mono text-slate-800 text-[11px] block truncate" title="${escapeHtml(fName)}">📁 ${escapeHtml(fName)} ${fSize ? `(${fSize})` : ''}</span>
                <span class="text-[10px] text-slate-400 font-mono block">Biên nhận: ${att.receiptId || '--'}</span>
              </div>
              <div class="shrink-0 flex items-center gap-1.5">
                ${vUrl ? `
                  <a href="${vUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer" title="Mở file trên Drive">
                    👁️ Mở Drive
                  </a>
                ` : ''}
                ${state.isAdmin && att.status !== 'withdrawn' ? `
                  <button type="button" onclick="adminDeleteStudentSubmission('${studentId}', '${act.id}', '${round.id}', ${attNum}); closeAdminSubmissionInspectModal();" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer" title="Admin xóa lần nộp này để sinh viên nộp lại">
                    🗑️ Xóa bài
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Section 3: Admin Actions (Override shortcut)
  const adminActionsEl = document.getElementById('inspect-sub-admin-actions');
  if (adminActionsEl) {
    if (state.isAdmin) {
      adminActionsEl.innerHTML = `
        <button type="button" onclick="closeAdminSubmissionInspectModal(); openSubmissionOverrideModal('${studentId}', '${act.id}', '${round.id}')" class="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer">
          <span>⭐</span> <span>Cấp thêm lượt / Gia hạn riêng</span>
        </button>
      `;
    } else {
      adminActionsEl.innerHTML = '';
    }
  }

  document.getElementById('modal-admin-submission-inspect')?.classList.remove('hidden');
};
window.openAdminSubmissionInspectModal = function(studentId, actId, roundId) {
  return openAdminSubmissionInspectModal(studentId, actId, roundId);
};

/**
 * Close detailed inspection modal
 */
window.closeAdminSubmissionInspectModal = function() {
  document.getElementById('modal-admin-submission-inspect')?.classList.add('hidden');
};

/**
 * Open latest official submission file directly on Google Drive in new tab (B1)
 */
export function openLatestOfficialSubmissionFile(studentId, actId, roundId) {
  return (async () => {
    const round = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
    const act = (round?.activities || []).find(a => a.id === actId);
    if (!round || !act) {
      if (typeof showToast === 'function') showToast('Không tìm thấy thông tin đợt hoặc mốc hoạt động.', 'warning');
      return;
    }
    if (typeof window.ensureStudentSubmissionsLoaded === 'function') {
      try {
        await window.ensureStudentSubmissionsLoaded(round.id, studentId);
      } catch (e) {
        console.warn('[openLatestOfficialSubmissionFile] ensureStudentSubmissionsLoaded error:', e);
      }
    }
    const rules = (typeof getEffectiveSubmissionRules === 'function')
      ? getEffectiveSubmissionRules(studentId, act, round)
      : { currentSubmission: null };

    const cur = rules.currentSubmission;
    const file = cur?.files?.[0];
    const viewUrl = file?.providerUrl || file?.viewUrl || (file?.providerFileId ? `https://drive.google.com/file/d/${file.providerFileId}/view` : null);

    if (viewUrl) {
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    } else {
      if (typeof showToast === 'function') {
        showToast('Không tìm thấy liên kết Google Drive của bài nộp hoặc sinh viên chưa có bài nộp.', 'warning');
      }
    }
  })();
}
window.openLatestOfficialSubmissionFile = openLatestOfficialSubmissionFile;
