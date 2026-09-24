/**
 * IFA+ Graduation — Supervisors Master, Reviews & Assignments Module
 */
// ============================================================================
// OFFICIAL SUPERVISORS HELPERS (v1.6.0-beta.3)
// ============================================================================
export function getOfficialSupervisors(reg) {
  if (!reg) return [];
  if (Array.isArray(reg.officialSupervisors) && reg.officialSupervisors.length > 0) {
    return reg.officialSupervisors;
  }
  // Backward compatibility: derive from acceptedSupervisorId / finalSupervisorId
  const primaryId = reg.acceptedSupervisorId || reg.finalSupervisorId;
  if (primaryId) {
    return [{
      supervisorId: primaryId,
      supervisorName: reg.acceptedSupervisorName || '',
      source: 'preference',
      role: 'primary',
      addedAt: reg.acceptedAt || reg.updatedAt || new Date().toISOString()
    }];
  }
  return [];
}

export function normalizeOfficialAssignment(assignment, registration = null) {
  if (!assignment && !registration) return null;
  const source = assignment || {};
  const legacy = registration || {};
  const supervisors = Array.isArray(source.supervisors) && source.supervisors.length > 0
    ? source.supervisors
    : getOfficialSupervisors(legacy);
  const primary = supervisors.find(s => s.role === 'primary') || supervisors[0] || null;
  return {
    ...legacy,
    ...source,
    studentId: source.studentId || legacy.studentId || source.id || legacy.id || '',
    studentName: source.studentName || legacy.studentName || '',
    email: source.studentEmail || source.email || legacy.email || '',
    topicTitle: legacy.topicTitle || source.topicTitle || '',
    projectType: legacy.projectType || source.projectType || '',
    officialSupervisors: supervisors,
    acceptedSupervisorId: source.acceptedSupervisorId || primary?.supervisorId || legacy.acceptedSupervisorId || '',
    acceptedSupervisorName: source.acceptedSupervisorName || primary?.supervisorName || legacy.acceptedSupervisorName || '',
    acceptedRank: source.acceptedRank || legacy.acceptedRank || 'manual',
    reviewStatus: supervisors.length > 0 ? 'manually_assigned' : (legacy.reviewStatus || 'unassigned'),
    assignmentStatus: source.assignmentStatus || (legacy.reviewStatus === 'accepted' || legacy.reviewStatus === 'manually_assigned' ? 'published' : '')
  };
}

function getAdminAssignmentRows() {
  const registrations = state.adminReviewData?.registrations || [];
  const eligible = state.adminReviewData?.eligible || [];
  const assignments = state.adminReviewData?.officialAssignments || [];
  const drafts = state.adminReviewData?.assignmentDrafts || [];
  const normalizeId = value => String(value || '').trim().toUpperCase();
  const ids = new Set();
  registrations.forEach(r => ids.add(normalizeId(r.studentId || r.id)));
  eligible.filter(e => e.eligible !== false).forEach(e => ids.add(normalizeId(e.studentId || e.mssv || e.id)));
  assignments.forEach(a => ids.add(normalizeId(a.studentId || a.id)));
  drafts.forEach(a => ids.add(normalizeId(a.studentId || a.id)));
  ids.delete('');

  return [...ids].map(studentId => {
    const registration = registrations.find(r => normalizeId(r.studentId || r.id) === studentId) || null;
    const eligibleStudent = eligible.find(e => normalizeId(e.studentId || e.mssv || e.id) === studentId) || null;
    const assignment = assignments.find(a => normalizeId(a.studentId || a.id) === studentId) || null;
    const draft = drafts.find(a => normalizeId(a.studentId || a.id) === studentId) || null;
    const effective = normalizeOfficialAssignment(draft || assignment, registration) || { studentId };
    return {
      studentId,
      registration,
      eligibleStudent,
      assignment,
      draft,
      effective,
      isRegistered: Boolean(registration),
      isAssigned: getOfficialSupervisors(effective).length > 0
    };
  });
}

function buildOfficialAssignmentPayload(row, supervisors, assignmentStatus = 'draft') {
  const enrichedSupervisors = supervisors.map(item => {
    const profile = (state.adminReviewData?.supervisors || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId)
      || (state.supervisorsMaster || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId);
    return {
      ...item,
      supervisorEmail: (item.supervisorEmail || item.email || profile?.email || '').toLowerCase().trim()
    };
  });
  const primary = enrichedSupervisors.find(item => item.role === 'primary') || enrichedSupervisors[0] || {};
  const studentId = row.studentId;
  return {
    studentId,
    studentName: resolveStudentName(studentId, row.registration?.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name || row.effective?.studentName),
    studentEmail: row.registration?.email || row.eligibleStudent?.email || row.effective?.email || `${studentId.toLowerCase()}@student.tdtu.edu.vn`,
    supervisors: enrichedSupervisors,
    supervisorIds: enrichedSupervisors.map(item => item.supervisorId),
    supervisorEmails: enrichedSupervisors.map(item => item.supervisorEmail).filter(Boolean),
    acceptedSupervisorId: primary.supervisorId || '',
    acceptedSupervisorName: primary.supervisorName || '',
    acceptedRank: row.effective?.acceptedRank || 'manual',
    source: row.assignment?.source || row.effective?.source || 'manually_assigned',
    assignmentStatus,
    updatedAt: serverTimestamp(),
    updatedBy: state.user?.email || 'admin'
  };
}

function buildAssignmentDraftPayload(row, supervisors, source = 'manually_assigned') {
  return {
    ...buildOfficialAssignmentPayload(row, supervisors, 'draft'),
    source,
    basePublishedAt: row.assignment?.publishedAt || null
  };
}

function isAssignmentEditingLocked() {
  // Admin may keep correcting or completing supervisor assignments after the
  // first publication. Changes are stored as drafts and become visible to
  // students after the existing "Công bố lại" action.
  return false;
}

function ensureAssignmentEditingAllowed() {
  if (!isAssignmentEditingLocked()) return true;
  showToast('Kết quả đã công bố. Vui lòng bấm “Mở khóa chỉnh sửa” trước khi thay đổi phân công.', 'warning', 5000);
  return false;
}

function getSupervisorAssignmentCount(supervisorId, excludeStudentId = '') {
  const sid = String(supervisorId || '');
  const excluded = String(excludeStudentId || '').trim().toUpperCase();
  return getAdminAssignmentRows().filter(row => {
    if (excluded && row.studentId === excluded) return false;
    return getOfficialSupervisors(row.effective).some(s => s.supervisorId === sid);
  }).length;
}

export function isOfficialSupervisor(reg, supervisorId) {
  if (!reg || !supervisorId) return false;
  const list = getOfficialSupervisors(reg);
  return list.some(s => s.supervisorId === supervisorId);
}

export function getPreliminaryExcludedSupervisorIds(reg) {
  if (!reg) return [];
  const list = getOfficialSupervisors(reg);
  return list.map(s => s.supervisorId);
}

export function getSupervisorTotalAssignedCount(supId, registrations = []) {
  if (!supId || !Array.isArray(registrations)) return 0;
  return registrations.filter(r => {
    if (r.reviewStatus !== 'accepted' && r.reviewStatus !== 'manually_assigned') return false;
    return isOfficialSupervisor(r, supId);
  }).length;
}

// A missing field is intentionally treated as the legacy preference workflow.
export function getSupervisorAssignmentMode(round = state?.activeRound) {
  return round?.supervisorAssignmentMode === 'direct_assignment'
    ? 'direct_assignment'
    : 'student_preference';
}

function isDirectSupervisorAssignment(round = state?.activeRound) {
  return getSupervisorAssignmentMode(round) === 'direct_assignment';
}

function shouldSkipStudentSupervisorPreference(round = state?.activeRound) {
  return isDirectSupervisorAssignment(round)
    || state.myOfficialAssignment?.assignmentStatus === 'published';
}

/** IFA+ Graduation Beta Studio v2.6.0-beta.1 (Admin Impersonation / Act-As Test Mode) **/

// Override native alert to use non-blocking toast
window.alert = function(msg) {
  if (window.showToast) {
    window.showToast(String(msg), 'info');
  } else {
    console.log('[Alert]', msg);
  }
};


window.handleSupervisorDeptChange = function(val) {
  const customInput = document.getElementById('sup-form-dept-custom');
  const hiddenDept = document.getElementById('sup-form-dept');
  if (val === '__other__') {
    if (customInput) customInput.classList.remove('hidden');
    if (hiddenDept && customInput) hiddenDept.value = customInput.value.trim() || 'Khác';
  } else {
    if (customInput) customInput.classList.add('hidden');
    if (hiddenDept) hiddenDept.value = val;
  }
};



// --- ROUND SUPERVISORS ---
async function loadRoundSupervisors(roundId) {
  try {
    const [snap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'supervisors')),
      ensureSupervisorsMasterLoaded().catch(() => [])
    ]);
    state.roundSupervisors = snap.docs.map(d => {
      const roundSupervisor = { id: d.id, ...d.data() };
      const master = (state.supervisorsMaster || []).find(item => item.id === roundSupervisor.supervisorId || item.id === roundSupervisor.id);
      // Old round records can predate a phone/email change in the master list.
      // Prefer the per-round snapshot, then seamlessly fall back to Master.
      return {
        ...master,
        ...roundSupervisor,
        email: roundSupervisor.email || master?.email || '',
        phone: roundSupervisor.phone || master?.phone || '',
        photoUrl: roundSupervisor.photoUrl || master?.photoUrl || ''
      };
    });
    renderSupervisorsGrid();
    if (state.activeRound?.id === roundId) renderRoundHeader();
  } catch (e) {
    console.error('Error loading round supervisors:', e);
  }
}

function renderSupervisorsGrid() {
  const grid = document.getElementById('supervisors-grid');
  if (!grid) return;

  const searchTerm = (document.getElementById('search-supervisor-input')?.value || '').toLowerCase();
  const maxPref = state.activeRound?.preferenceCount || 3;
  const isWizard = state.activeRound?.selectionMode === 'wizard';

  const wizardHeader = document.getElementById('wizard-sub-stepper');
  if (wizardHeader) {
    if (isWizard) {
      wizardHeader.classList.remove('hidden');
      document.getElementById('wizard-current-rank-label').textContent = `ĐANG CHỌN: NGUYỆN VỌNG ${state.wizardRank} / ${maxPref}`;
    } else {
      wizardHeader.classList.add('hidden');
    }
  }

  const activeSupervisors = state.roundSupervisors.filter(s => {
    if (s.activeInRound === false) return false;
    const matchName = (s.name || '').toLowerCase().includes(searchTerm);
    const matchExp = (s.expertise || '').toLowerCase().includes(searchTerm);
    const matchDept = (s.department || '').toLowerCase().includes(searchTerm);
    return matchName || matchExp || matchDept;
  });

  document.getElementById('supervisors-count-badge').textContent = `${activeSupervisors.length} giảng viên`;

  if (activeSupervisors.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400 text-xs">Không tìm thấy giảng viên nào phù hợp.</div>';
    renderPreferencesTray();
    return;
  }

    const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cbd5e1'/%3E%3Cpath fill='%23cbd5e1' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/%3E%3C/svg%3E";

  grid.innerHTML = activeSupervisors.map(s => {
    const prefIndex = state.selectedPreferences.findIndex(p => p.supervisorId === s.id);
    const isSelected = prefIndex !== -1;
    const assignedRank = isSelected ? state.selectedPreferences[prefIndex].rank : null;

    let buttonHtml = '';
    if (isWizard) {
      const isSelectedForCurrentWizard = (assignedRank === state.wizardRank);
      buttonHtml = `
        <button type="button" onclick="selectWizardPreference('${s.id}', '${encodeURIComponent(s.name)}')" class="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${isSelectedForCurrentWizard ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
          ${isSelectedForCurrentWizard ? '✓ Đang chọn cho NV' + state.wizardRank : 'Chọn cho NV' + state.wizardRank}
        </button>
      `;
    } else {
      if (isSelected) {
        buttonHtml = `
          <button type="button" onclick="removePreference('${s.id}')" class="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all">
            ✕ Bỏ chọn (NV${assignedRank})
          </button>
        `;
      } else {
        const canAddMore = state.selectedPreferences.length < maxPref;
        buttonHtml = `
          <button type="button" onclick="addCardPreference('${s.id}', '${encodeURIComponent(s.name)}')" ${!canAddMore ? 'disabled' : ''} class="w-full py-2 px-3 bg-tdtu-blue hover:bg-tdtu-dark disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
            + Chọn Nguyện vọng
          </button>
        `;
      }
    }

    const escapedName = escapeHtml(s.name || '');
    const avatarSrc = (s.showPhoto !== false && s.photoUrl && s.photoUrl.trim()) ? s.photoUrl : getSupervisorAvatarSvgDataUri(s.name);
    const dept = s.department || 'Bộ môn TKNT';
    const email = s.email || '';

    // Check if supervisor has actual bio/details (hide button if empty or placeholder)
    const hasDetails = Boolean(
      (s.bio && s.bio.trim() && s.bio.trim() !== 'Chưa có thông tin giới thiệu.') ||
      (s.expertise && s.expertise.trim() && s.expertise.trim() !== 'Đang cập nhật') ||
      (s.description && s.description.trim())
    );

    const detailBtnHtml = hasDetails
      ? `<button type="button" onclick="openBioModal('${s.id}')" class="px-2.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold shrink-0" title="Xem hồ sơ chi tiết">
           ℹ️ Chi tiết
         </button>`
      : '';

    return `
      <div class="card-surface p-4 flex flex-col justify-between card-hover relative rounded-2xl border border-slate-200/90 shadow-sm ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20' : 'bg-white'}">
        <div>
          <!-- Portrait photo matching ifa.tdtu.edu.vn/gioi-thieu -->
          <div class="relative w-full aspect-[4/5] overflow-hidden rounded-xl bg-slate-100 mb-3.5 border border-slate-200/80 shadow-2xs">
            <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="w-full h-full object-cover object-top" alt="${escapedName}">
            ${isSelected ? `<span class="absolute right-2.5 top-2.5 px-2.5 py-1 rounded-full bg-amber-500 text-slate-900 font-black text-xs shadow-md">NV${assignedRank}</span>` : ''}
          </div>

          <!-- Supervisor Information -->
          <div class="space-y-1">
            <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-snug">${escapedName}</h3>
            <p class="text-xs text-slate-500 font-medium">${escapeHtml(dept)}</p>
            ${email ? `
              <p class="text-xs text-blue-600 truncate flex items-center gap-1.5 font-mono pt-1">
                <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span class="truncate">${escapeHtml(email)}</span>
              </p>
            ` : ''}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
          ${detailBtnHtml}
          <div class="flex-1 min-w-0">
            ${buttonHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  renderPreferencesTray();
}

window.filterSupervisorsList = function() {
  renderSupervisorsGrid();
};

window.addCardPreference = function(supervisorId, encName) {
  const name = decodeURIComponent(encName);
  const maxPref = state.activeRound?.preferenceCount || 3;
  if (state.selectedPreferences.length >= maxPref) {
    showToast(`Bạn chỉ được chọn tối đa ${maxPref} nguyện vọng.`, 'info');
    return;
  }

  const nextRank = state.selectedPreferences.length + 1;
  const sup = state.roundSupervisors.find(s => s.id === supervisorId);

  state.selectedPreferences.push({
    rank: nextRank,
    supervisorId: supervisorId,
    supervisorName: name,
    department: sup?.department || '',
    photoUrl: sup?.photoUrl || ''
  });

  renderSupervisorsGrid();
};

window.removePreference = function(supervisorId) {
  state.selectedPreferences = state.selectedPreferences.filter(p => p.supervisorId !== supervisorId);
  state.selectedPreferences.forEach((p, idx) => p.rank = idx + 1);
  renderSupervisorsGrid();
};

window.movePreferenceOrder = function(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.selectedPreferences.length) return;
  const item = state.selectedPreferences.splice(fromIndex, 1)[0];
  state.selectedPreferences.splice(toIndex, 0, item);
  state.selectedPreferences.forEach((p, idx) => p.rank = idx + 1);
  renderSupervisorsGrid();
};

window.selectWizardPreference = function(supervisorId, encName) {
  const name = decodeURIComponent(encName);
  const maxPref = state.activeRound?.preferenceCount || 3;
  const currentRank = state.wizardRank;

  const sup = state.roundSupervisors.find(s => s.id === supervisorId);

  state.selectedPreferences = state.selectedPreferences.filter(p => p.rank !== currentRank);

  state.selectedPreferences.push({
    rank: currentRank,
    supervisorId,
    supervisorName: name,
    department: sup?.department || '',
    photoUrl: sup?.photoUrl || ''
  });

  state.selectedPreferences.sort((a, b) => a.rank - b.rank);

  if (currentRank < maxPref) {
    state.wizardRank = currentRank + 1;
  }
  renderSupervisorsGrid();
};

window.stepWizardRank = function(delta) {
  const maxPref = state.activeRound?.preferenceCount || 3;
  const target = state.wizardRank + delta;
  if (target >= 1 && target <= maxPref) {
    state.wizardRank = target;
    renderSupervisorsGrid();
  }
};

function renderPreferencesTray() {
  const tray = document.getElementById('preferences-tray-items');
  if (!tray) return;

  const maxPref = state.activeRound?.preferenceCount || 3;

  let html = '';
  for (let rank = 1; rank <= maxPref; rank++) {
    const pref = state.selectedPreferences.find(p => p.rank === rank);
    if (pref) {
      const idx = state.selectedPreferences.indexOf(pref);
      html += `
        <div class="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs shadow-sm">
          <span class="w-5 h-5 rounded-full bg-amber-500 text-slate-900 font-extrabold text-[10px] flex items-center justify-center">NV${rank}</span>
          <span class="font-bold text-slate-100 max-w-[120px] truncate" title="${pref.supervisorName}">${pref.supervisorName}</span>
          <div class="flex items-center gap-0.5 ml-1">
            <button type="button" onclick="movePreferenceOrder(${idx}, ${idx - 1})" ${idx === 0 ? 'disabled' : ''} class="p-0.5 text-slate-400 hover:text-white disabled:opacity-20 text-[10px]">▲</button>
            <button type="button" onclick="movePreferenceOrder(${idx}, ${idx + 1})" ${idx === state.selectedPreferences.length - 1 ? 'disabled' : ''} class="p-0.5 text-slate-400 hover:text-white disabled:opacity-20 text-[10px]">▼</button>
            <button type="button" onclick="removePreference('${pref.supervisorId}')" class="p-0.5 text-rose-400 hover:text-rose-300 text-xs ml-1">✕</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="flex items-center gap-1.5 bg-slate-800/40 border border-dashed border-slate-700 px-2.5 py-1.5 rounded-xl text-xs text-slate-400">
          <span class="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center justify-center">${rank}</span>
          <span>Chưa chọn</span>
        </div>
      `;
    }
  }

  tray.innerHTML = html;
}


// =========================================================================
// --- PHASE 2A: SUPERVISOR REVIEW WORKFLOW ---
// =========================================================================

export async function loadSupervisorReviewData(roundId) {
  if (!roundId) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));

  const greetingEl = document.getElementById('supervisor-greeting-name');
  const roundInfoEl = document.getElementById('supervisor-round-info');
  const activeBadgeEl = document.getElementById('sup-active-round-badge');

  if (greetingEl) greetingEl.textContent = `Kính chào Thầy/Cô ${currentSup?.name || actor?.displayName || state.user?.displayName || ''}`;
  if (roundInfoEl) roundInfoEl.textContent = `Đợt tốt nghiệp: ${state.activeRound?.title || ''} (${state.activeRound?.academicYear || ''})`;
  if (activeBadgeEl) activeBadgeEl.textContent = state.activeRound?.roundName || state.activeRound?.title || 'Đợt ĐATN';

  if (!currentSup) {
    document.getElementById('sup-stat-total-cap').textContent = '0';
    document.getElementById('sup-stat-accepted-prev').textContent = '0';
    document.getElementById('sup-stat-selected-curr').textContent = '0';
    document.getElementById('sup-stat-remaining-cap').textContent = '0';
    document.getElementById('sup-round-review-indicator').textContent = 'Thầy/Cô chưa tham gia đợt này';
    document.getElementById('sup-candidates-tbody').innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Thầy/Cô chưa được cấu hình vào danh sách GVHD đợt này.</td></tr>';
    return;
  }

  try {
    // 1. Load round supervisors fresh
    const supDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id));
    const supData = supDoc.exists() ? supDoc.data() : currentSup;
    state.supervisorRoundProgress = supData.roundProgress || {};

    // 2. Load all registrations for this round
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const allRegistrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Load decisions made in this round
    const decSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'reviewDecisions'));
    const allDecisions = decSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const currentReviewRound = 1;
    const reviewStatus = state.activeRound?.reviewStatus || 'round_1';
    const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentReviewRound]);
    const isCompleted = state.supervisorRoundProgress['round_' + currentReviewRound]?.status === 'completed';

    const decisionByStudentRank = new Map();
    allDecisions.forEach(decision => {
      if (!decision.studentId || !decision.round || !decision.decision) return;
      decisionByStudentRank.set(`${String(decision.studentId).trim().toUpperCase()}:${Number(decision.round)}`, decision);
    });

    // Rolling preference review: a student starts at NV1. A "Không chọn"
    // decision immediately advances the application to the next preference,
    // so one supervisor can see NV1, NV2 and NV3 candidates together.
    const candidates = [];
    allRegistrations.forEach(registration => {
      if (registration.reviewStatus === 'accepted' || registration.reviewStatus === 'manually_assigned' || registration.eligibilityStatus === 'not_eligible') return;
      const studentId = String(registration.studentId || registration.id || '').trim().toUpperCase();
      const preferences = [...(registration.preferences || [])].sort((a, b) => Number(a.rank) - Number(b.rank));
      for (const preference of preferences) {
        const rank = Number(preference.rank || 1);
        const decision = decisionByStudentRank.get(`${studentId}:${rank}`);
        if (decision?.decision === 'not_selected') continue;

        const belongsToCurrentSupervisor = preference.supervisorId === currentSup.id || preference.supervisorId === currentSup.supervisorId;
        if (belongsToCurrentSupervisor) {
          candidates.push({
            ...registration,
            studentId,
            candidateRank: rank,
            currentDecision: decision?.decision || ''
          });
        }
        // Stop at the first preference that has not rejected the student. A
        // selected or pending application must not leak to later choices.
        break;
      }
    });

    state.supervisorCandidates = candidates;
    const candidatesBadge = document.getElementById('sup-candidates-count-badge');
    if (candidatesBadge) candidatesBadge.textContent = candidates.length;

    // Filter Accepted Students across rounds for this supervisor
    const acceptedStudents = allRegistrations.filter(r => {
      return (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') &&
        (r.acceptedSupervisorId === currentSup.id || r.acceptedSupervisorId === currentSup.supervisorId);
    });
    state.supervisorAcceptedStudents = acceptedStudents;

    // Build decisions map for each candidate's effective preference rank.
    const decisionsMap = {};
    candidates.forEach(candidate => {
      if (candidate.currentDecision) decisionsMap[candidate.studentId] = candidate.currentDecision;
    });
    state.supervisorDecisions = decisionsMap;

    // Calculate quota
    const totalCapacity = supData.capacity || 10;
    const acceptedPrev = acceptedStudents.length || (supData.acceptedCount || 0);
    const selectedCurr = candidates.filter(c => decisionsMap[c.studentId] === 'selected').length;
    const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

    // Update Top Badges
    document.getElementById('sup-stat-total-cap').textContent = totalCapacity;
    document.getElementById('sup-stat-accepted-prev').textContent = acceptedPrev;
    document.getElementById('sup-stat-selected-curr').textContent = selectedCurr;
    document.getElementById('sup-stat-remaining-cap').textContent = remainingCap;
    document.getElementById('sup-accepted-count-badge').textContent = acceptedStudents.length;
    document.getElementById('sup-total-accepted-text').textContent = `Tổng: ${acceptedStudents.length} SV`;

    // Render review UI
    renderSupervisorReviewUI(currentSup, currentReviewRound, reviewStatus, isLocked, false, remainingCap);
    renderSupervisorAcceptedTable();
  } catch (e) {
    console.error('Error loading supervisor review data:', e);
  }
}

function renderSupervisorReviewUI(currentSup, currentRound, reviewStatus, isLocked, isCompleted, remainingCap) {
  const rankBadge = document.getElementById('sup-review-rank-badge');
  const stateTag = document.getElementById('sup-round-state-tag');
  const actionBtns = document.getElementById('sup-review-action-btns');
  const indicator = document.getElementById('sup-round-review-indicator');

  if (isDirectSupervisorAssignment()) {
    rankBadge.textContent = 'PHÂN CÔNG TRỰC TIẾP';
    stateTag.textContent = 'Khoa phân công trực tiếp';
    indicator.textContent = 'Khoa/Admin phân công GVHD trực tiếp; danh sách sinh viên đã được phân công hiển thị bên dưới.';
    actionBtns.innerHTML = '<span class="text-xs text-slate-400 italic">Không có bước xét nguyện vọng trong đợt này.</span>';
    const tbody = document.getElementById('sup-candidates-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Đợt này sử dụng phân công trực tiếp. Vui lòng xem danh sách sinh viên đã được phân công.</td></tr>';
    return;
  }

  rankBadge.textContent = 'XÉT NGUYỆN VỌNG 1 → 3';

  if (reviewStatus === 'not_started' || reviewStatus === 'draft') {
    stateTag.textContent = 'Đang xét Nguyện vọng 1';
    indicator.textContent = 'Trạng thái: Vòng 1 bắt đầu ngay khi sinh viên đăng ký chọn GVHD.';
    actionBtns.innerHTML = '<span class="text-xs text-blue-200 font-semibold">Quyết định được lưu ngay và tự động chuyển nguyện vọng</span>';
  } else if (reviewStatus === 'completed' || state.activeRound?.status === 'published') {
    stateTag.textContent = 'Đã hoàn tất & Công bố';
    indicator.textContent = 'Trạng thái: Đã kết thúc toàn bộ quy trình xét duyệt.';
    actionBtns.innerHTML = '<span class="text-xs text-emerald-400 font-bold">✓ Đã công bố kết quả</span>';
  } else if (isLocked) {
    stateTag.textContent = 'Đã chốt vòng';
    indicator.textContent = `Trạng thái: Vòng ${currentRound} đã được Quản trị viên khóa cố định.`;
    actionBtns.innerHTML = '<span class="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold">🔒 Đã khóa danh sách</span>';
  } else if (isCompleted) {
    stateTag.textContent = 'Đã hoàn thành lựa chọn';
    indicator.textContent = `Trạng thái: Thầy/Cô đã hoàn tất lựa chọn Vòng ${currentRound}.`;
    actionBtns.innerHTML = `
      <button onclick="reopenSupervisorRound()" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5">
        <span>🔄 Mở lại để chỉnh sửa</span>
      </button>
    `;
  } else {
    stateTag.textContent = 'Đang xét cuốn chiếu';
    indicator.textContent = 'Trạng thái: Hiển thị chung ứng viên NV1, NV2 và NV3 đang đến lượt Thầy/Cô xét.';
    actionBtns.innerHTML = '<span class="text-xs text-blue-200 font-semibold">Quyết định được lưu ngay và tự động chuyển nguyện vọng</span>';
  }

  // Render candidates table
  renderSupervisorCandidatesTable(isLocked);
}

function renderSupervisorCandidatesTable(readOnly) {
  const tbody = document.getElementById('sup-candidates-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('search-sup-candidates')?.value || '').toLowerCase();
  const filtered = state.supervisorCandidates.filter(c => {
    return (c.studentId || '').toLowerCase().includes(searchTerm) || (c.studentName || '').toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Không có ứng viên nào đăng ký Thầy/Cô ở Nguyện vọng này (hoặc đã được nhận ở vòng trước).</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const isSelected = state.supervisorDecisions[c.studentId] === 'selected';
    const topicTitle = String(c.topicTitle || 'Chưa cập nhật tên đề tài');
    const topicDescription = String(c.topicDescription || 'Sinh viên chưa bổ sung mô tả định hướng thiết kế.');

    let actionBtn = '';
    if (readOnly) {
      actionBtn = isSelected
        ? '<span class="badge bg-emerald-100 text-emerald-800 font-bold">✓ Đã chọn</span>'
        : '<span class="text-slate-400 font-semibold text-xs">Không chọn</span>';
    } else {
      actionBtn = `
        <div class="flex flex-col gap-1.5 min-w-[112px]">
          <button onclick="setSupervisorDecision('${c.studentId}', 'selected')" class="px-3 py-1.5 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'} font-bold rounded-xl shadow-sm transition-all text-xs">✓ Chọn SV</button>
          <button onclick="setSupervisorDecision('${c.studentId}', 'not_selected')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl transition-all text-xs">✕ Không chọn</button>
        </div>
      `;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}">
        <td class="p-3.5 font-mono font-bold text-slate-900">${c.studentId}</td>
        <td class="p-3.5">
          <span class="font-semibold text-slate-800 block">${escapeHtml(c.studentName || '--')}</span>
          <span class="text-[11px] text-slate-500">Lớp: ${escapeHtml(c.className || '--')}</span>
          <span class="mt-1.5 inline-flex px-2 py-0.5 rounded-full ${Number(c.candidateRank) === 1 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-blue-100 text-blue-800 border-blue-200'} border text-[10px] font-black">NV${Number(c.candidateRank || 1)}</span>
        </td>
        <td class="p-3.5 max-w-lg">
          <p class="font-bold text-slate-900 leading-snug">${escapeHtml(topicTitle)}</p>
          <div class="mt-1.5 pt-1.5 border-t border-slate-100">
            <span class="text-[10px] font-black uppercase tracking-wide text-blue-700">Mô tả định hướng</span>
            <p class="mt-0.5 text-[11px] leading-relaxed text-slate-600 whitespace-pre-line text-justify">${escapeHtml(topicDescription)}</p>
          </div>
        </td>
        <td class="p-3.5 text-slate-600">${c.projectType || '--'}</td>
        <td class="p-3.5 text-center">${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

window.filterSupervisorCandidates = function() {
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + (state.activeRound?.currentReviewRound || 1)]);
  renderSupervisorCandidatesTable(isLocked);
};

window.setSupervisorDecision = async function(studentId, nextDecision) {
  if (!checkImpersonationWriteGuard('Thay đổi quyết định chọn sinh viên')) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const roundId = state.selectedRoundId;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));

  if (!roundId || !currentSup) return;

  const currentDecision = state.supervisorDecisions[studentId];
  if (!['selected', 'not_selected'].includes(nextDecision) || currentDecision === nextDecision) return;
  const candidate = (state.supervisorCandidates || []).find(item => String(item.studentId) === String(studentId));
  const decisionRank = Number(candidate?.candidateRank || 1);

  // If selecting, check remaining quota
  if (nextDecision === 'selected') {
    const totalCap = currentSup.capacity || 10;
    const acceptedPrev = (state.supervisorAcceptedStudents || []).length || (currentSup.acceptedCount || 0);
    const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
    const remaining = totalCap - acceptedPrev - selectedCurr;

    if (remaining <= 0) {
      showToast(`Thầy/Cô đã đạt giới hạn chỉ tiêu (${totalCap} SV). Vui lòng bỏ chọn sinh viên khác trước khi chọn thêm.`, 'info');
      return;
    }
  }

  // Update local state immediately for snappy UI
  state.supervisorDecisions[studentId] = nextDecision;
  renderSupervisorCandidatesTable(false);

  // Recalculate and update stats badges
  const totalCapacity = currentSup.capacity || 10;
  const acceptedPrev = (state.supervisorAcceptedStudents || []).length || (currentSup.acceptedCount || 0);
  const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
  const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

  document.getElementById('sup-stat-selected-curr').textContent = selectedCurr;
  document.getElementById('sup-stat-remaining-cap').textContent = remainingCap;

  // Persist decision to Firestore
  try {
    const decId = `r${decisionRank}_${studentId}_${currentSup.id}`;
    await setDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', decId), {
      round: decisionRank,
      studentId,
      supervisorId: currentSup.id,
      supervisorEmail: emailLower,
      decision: nextDecision,
      decidedAt: serverTimestamp(),
      decidedBy: emailLower
    }, { merge: true });
    showToast(nextDecision === 'selected'
      ? `Đã chọn sinh viên ${studentId} ở NV${decisionRank}.`
      : `Đã không chọn sinh viên ${studentId}; hồ sơ được chuyển tự động sang nguyện vọng tiếp theo.`, 'success');
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    console.error('Error saving review decision:', err);
    showToast('Lỗi lưu quyết định: ' + err.message, 'error');
  }
};

window.toggleSupervisorDecision = function(studentId) {
  const currentDecision = state.supervisorDecisions[studentId];
  return window.setSupervisorDecision(studentId, currentDecision === 'selected' ? 'not_selected' : 'selected');
};

window.openSupervisorConfirmModal = function() {
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const selectedCount = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
  const remCount = document.getElementById('sup-stat-remaining-cap')?.textContent || '0';

  document.getElementById('modal-sup-confirm-round-title').textContent = `Xét duyệt Nguyện vọng ${currentRound}`;
  document.getElementById('modal-sup-selected-count').textContent = `${selectedCount} Sinh viên`;
  document.getElementById('modal-sup-rem-count').textContent = `${remCount} Sinh viên`;

  document.getElementById('modal-supervisor-confirm').classList.remove('hidden');
};

window.closeSupervisorConfirmModal = function() {
  document.getElementById('modal-supervisor-confirm').classList.add('hidden');
};

window.confirmSupervisorRoundCompletion = async function() {
  if (!checkImpersonationWriteGuard('Xác nhận hoàn thành vòng chọn sinh viên')) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));

  if (!roundId || !currentSup) return;

  try {
    const roundKey = `round_${currentRound}`;
    const updatePayload = {};
    updatePayload[`roundProgress.${roundKey}`] = {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedBy: emailLower
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id), updatePayload);

    closeSupervisorConfirmModal();
    showToast(`✓ Thầy/Cô đã hoàn tất lựa chọn Vòng ${currentRound} thành công!`, 'info');
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    showToast('Lỗi cập nhật trạng thái hoàn thành: ' + err.message, 'error');
  }
};

window.reopenSupervisorRound = async function() {
  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentRound]);

  if (isLocked) {
    showToast('Vòng này đã được Quản trị viên chốt. Không thể mở lại để chỉnh sửa.', 'warning');
    return;
  }

  const emailLower = (actor?.email || state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));
  if (!roundId || !currentSup) return;

  if (!(await showConfirm('Mở lại vòng lựa chọn', `Mở lại Vòng ${currentRound} để chỉnh sửa danh sách lựa chọn?`, { confirmText: 'Mở lại vòng', danger: false }))) return;

  try {
    const roundKey = `round_${currentRound}`;
    const updatePayload = {};
    updatePayload[`roundProgress.${roundKey}`] = {
      status: 'pending',
      reopenedAt: serverTimestamp(),
      reopenedBy: emailLower
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id), updatePayload);
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    showToast('Lỗi mở lại vòng: ' + err.message, 'error');
  }
};

window.switchSupervisorTab = function(tabKey) {
  state.supervisorTab = tabKey;
  const btnReview = document.getElementById('sup-tab-btn-review');
  const btnAccepted = document.getElementById('sup-tab-btn-accepted');
  const btnPrelim = document.getElementById('sup-tab-btn-preliminary');
  const btnReviewer = document.getElementById('sup-tab-btn-reviewer');

  const panelReview = document.getElementById('sup-panel-review');
  const panelAccepted = document.getElementById('sup-panel-accepted');
  const panelPrelim = document.getElementById('sup-panel-preliminary');
  const panelReviewer = document.getElementById('sup-panel-reviewer');

  const allBtns = [
    { btn: btnReview, panel: panelReview, key: 'review', activeCls: 'bg-indigo-600 text-white' },
    { btn: btnAccepted, panel: panelAccepted, key: 'accepted', activeCls: 'bg-emerald-600 text-white' },
    { btn: btnPrelim, panel: panelPrelim, key: 'preliminary', activeCls: 'bg-amber-600 text-white' },
    { btn: btnReviewer, panel: panelReviewer, key: 'reviewer', activeCls: 'bg-blue-600 text-white' }
  ];

  allBtns.forEach(item => {
    if (!item.btn || !item.panel) return;
    if (item.key === tabKey) {
      item.btn.className = `px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${item.activeCls}`;
      item.panel.classList.remove('hidden');
    } else {
      item.btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all';
      item.panel.classList.add('hidden');
    }
  });

  if (tabKey === 'accepted') renderSupervisorAcceptedTable();
  else if (tabKey === 'preliminary') renderSupervisorPreliminaryList();
  else if (tabKey === 'reviewer') renderSupervisorReviewerList();
};

function renderSupervisorAcceptedTable() {
  const tbody = document.getElementById('sup-accepted-tbody');
  if (!tbody) return;

  if (state.supervisorAcceptedStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">Chưa có sinh viên nào trúng tuyển chính thức.</td></tr>';
    return;
  }

  tbody.innerHTML = state.supervisorAcceptedStudents.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5 font-mono font-bold text-slate-900">${s.studentId}</td>
      <td class="p-3.5 font-semibold text-slate-800">${s.studentName || '--'}</td>
      <td class="p-3.5 max-w-xs font-medium text-blue-900 truncate" title="${s.topicTitle}">${s.topicTitle}</td>
      <td class="p-3.5">
        <span class="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">
          ${s.acceptedRank === 'manual' ? 'Phân công Khoa' : 'Nguyện vọng ' + s.acceptedRank}
        </span>
      </td>
    </tr>
  `).join('');
}



export async function loadAdminStats() {
  try {
    const nonDeleted = (state.rounds || []).filter(r => !r.deleted && !r.isDeleted);
    const statEl = document.getElementById('stat-rounds-count');
    if (statEl) statEl.textContent = nonDeleted.length;
    
    const supMasterSnap = await getDocs(collection(db, 'supervisorMaster'));
    const supStatEl = document.getElementById('stat-supervisors-count');
    if (supStatEl) supStatEl.textContent = supMasterSnap.size;

    if (state.selectedRoundId) {
      const elSnap = await getDocs(collection(db, 'graduationRounds', state.selectedRoundId, 'eligibleStudents'));
      document.getElementById('stat-eligible-count').textContent = elSnap.size;

      const regSnap = await getDocs(collection(db, 'graduationRounds', state.selectedRoundId, 'registrations'));
      document.getElementById('stat-registrations-count').textContent = regSnap.size;
    }
  } catch (e) {
    console.error('Error loading admin stats:', e);
  }
}

window.toggleAdminRoundsAccordion = function(forceOpen) {
  const sub = document.getElementById('atab-sub-rounds');
  const chevron = document.getElementById('atab-chevron-rounds');
  if (!sub) return;
  const isCurrentlyOpen = !sub.classList.contains('hidden');
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;

  if (shouldOpen) {
    sub.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180');
  } else {
    sub.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
  }
};

window.switchAdminTab = function(tabKey) {
  state.currentAdminTab = tabKey;

  // 1. Always bind currentRoundId to state.selectedRoundId
  if (!state.selectedRoundId && state.rounds && state.rounds.length > 0) {
    state.selectedRoundId = state.rounds[0].id;
  }

  // 2. Active button styling in clean sidebar
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('bg-slate-900', 'text-white', 'shadow-xs', 'font-bold');
    b.classList.add('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-semibold', 'text-base');
  });

  const activeBtn = document.getElementById('atab-btn-' + tabKey);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-medium');
    activeBtn.classList.add('bg-slate-900', 'text-white', 'shadow-xs', 'font-bold', 'text-base');
  }

  // 3. Tab panels toggle
  ['overview', 'review', 'rounds', 'faculty-students', 'supervisors-master', 'round-supervisors', 'eligible-students', 'project-types', 'registrations', 'preview-student', 'trash', 'timeline', 'scoring-dashboard', 'system-settings'].forEach(t => {
    const p = document.getElementById('atab-panel-' + t);
    if (p) {
      if (t === tabKey) p.classList.remove('hidden');
      else p.classList.add('hidden');
    }
  });

  // 4. Update Breadcrumb for sub-views
  if (typeof updateRoundBreadcrumb === 'function') {
    updateRoundBreadcrumb(tabKey);
  }

  // 5. Data loaders bound to current round
  const roundId = state.selectedRoundId;
  if (tabKey === 'overview') loadAdminStats();
  else if (tabKey === 'faculty-students') openFacultyStudentsTab();
  else if (tabKey === 'review') { if (roundId) loadAdminReviewData(roundId); }
  else if (tabKey === 'rounds') {
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    renderAdminRoundsTable();
  }
  else if (tabKey === 'supervisors-master') loadAdminSupervisorsMaster();
  else if (tabKey === 'round-supervisors' && roundId) loadAdminRoundSupervisors(roundId);
  else if (tabKey === 'eligible-students' && roundId) {
    const sel = document.getElementById('admin-round-student-select');
    if (sel && sel.value !== roundId) sel.value = roundId;
    loadAdminEligibleStudents(roundId);
  }
  else if (tabKey === 'registrations' && roundId) loadAdminRegistrations(roundId);
  else if (tabKey === 'preview-student') preparePreviewStudentDropdown();
  else if (tabKey === 'trash') renderAdminTrashTable();
  else if (tabKey === 'scoring-dashboard') loadAdminScoringDashboard();
  else if (tabKey === 'system-settings') loadAdminSystemSettings();
  else if (tabKey === 'timeline') {
    if (roundId) {
      const sel = document.getElementById('admin-timeline-round-select');
      if (sel) sel.value = roundId;
      loadAdminRoundActivities(roundId);
    }
  }
};

window.setActiveRound = async function(roundId) {
  if (!state.isAdmin) return;
  try {
    const targetRound = state.rounds.find(r => r.id === roundId);
    if (!targetRound) return;

    // VALIDATION BEFORE ACTIVATION:
    const missingItems = [];

    // 1. Time validity
    const openTime = targetRound.openAtDate ? new Date(targetRound.openAtDate).getTime() : 0;
    const closeTime = targetRound.closeAtDate ? new Date(targetRound.closeAtDate).getTime() : 0;
    if (!openTime || !closeTime || openTime >= closeTime) {
      missingItems.push('Thời gian mở/đóng đợt chưa hợp lệ');
    }

    // 2. Minimum 1 Eligible Student
    let elCount = targetRound.eligibleCount;
    if (typeof elCount !== 'number') {
      try {
        const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
        elCount = snap.docs.length;
        targetRound.eligibleCount = elCount;
      } catch (e) { elCount = 0; }
    }
    if (elCount < 1) {
      missingItems.push('Chưa có sinh viên đủ điều kiện');
    }

    // 3. Minimum 1 Supervisor
    let supCount = targetRound.supervisorCount;
    if (typeof supCount !== 'number') {
      try {
        const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
        supCount = snap.docs.length;
        targetRound.supervisorCount = supCount;
      } catch (e) { supCount = 0; }
    }
    if (supCount < 1) {
      missingItems.push('Chưa có giảng viên hướng dẫn');
    }

    if (missingItems.length > 0) {
      const msg = 'Đợt chưa hoàn tất cấu hình:\n\n• ' + missingItems.join('\n• ');
      showToast(msg, 'warning', 6000);
      return;
    }

    // 1. Deactivate other rounds in local state
    state.rounds.forEach(r => {
      if (r.id === roundId) r.isActive = true;
      else r.isActive = false;
    });

    state.activeRound = targetRound;
    state.selectedRoundId = roundId;

    renderAdminRoundsTable();
    populateRoundSelectors();

    // 2. Persist in Firestore
    await updateDoc(doc(db, 'graduationRounds', roundId), { isActive: true, updatedAt: serverTimestamp() });
    for (const r of state.rounds) {
      if (r.id !== roundId && r.isActive !== false) {
        await updateDoc(doc(db, 'graduationRounds', r.id), { isActive: false, updatedAt: serverTimestamp() }).catch(() => {});
      }
    }
    showToast(`Đã đặt "${targetRound.title}" làm đợt hiện hành!`, 'info');
  } catch (err) {
    console.error('Lỗi đặt đợt hiện hành:', err);
    showToast('Lỗi đặt đợt hiện hành: ' + err.message, 'error');
  }
};



// --- PHASE 2A: ADMIN REVIEW MANAGEMENT MODULE ---
// =========================================================================

window.loadAdminReviewData = async function(roundId) {
  if (!roundId) return;

  try {
    if (typeof ensureFacultyDatasetLoaded === 'function' && (!state.facultyStudents || state.facultyStudents.length === 0)) {
      await ensureFacultyDatasetLoaded().catch(e => console.warn('[ReviewData] Faculty dataset load notice:', e));
    }
    // 1. Fetch Round doc
    const roundDoc = await getDoc(doc(db, 'graduationRounds', roundId));
    if (roundDoc.exists()) {
      const data = roundDoc.data();
      const cachedRound = (state.rounds || []).find(item => item.id === roundId);
      if (cachedRound) Object.assign(cachedRound, data);
      state.activeRound = {
        id: roundDoc.id,
        ...data,
        openAtDate: data.openAt ? (data.openAt.toDate ? data.openAt.toDate() : new Date(data.openAt)) : null,
        closeAtDate: data.closeAt ? (data.closeAt.toDate ? data.closeAt.toDate() : new Date(data.closeAt)) : null
      };
    }

    // 2. Fetch Supervisors
    const supSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
    const supervisors = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Fetch Registrations
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const registrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Fetch Decisions
    const decSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'reviewDecisions'));
    const decisions = decSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 5. Fetch Eligible Students
    const elSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    const eligible = elSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 6. Fetch assignments independently from registrations.
    const assignmentSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments'));
    const officialAssignments = assignmentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Admin-only working copy. Student/GVHD never read this collection.
    const draftSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'assignmentDrafts'));
    const assignmentDrafts = draftSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    state.adminReviewData = {
      supervisors,
      registrations,
      decisions,
      eligible,
      officialAssignments,
      assignmentDrafts
    };

    await refreshRoundCardMetrics(roundId);
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();
    renderAdminManualAssignmentTable();
    renderAdminAssignedSupervisorsTable();
  } catch (e) {
    console.error('Error loading admin review data:', e);
  }
};

function renderAdminReviewDashboard() {
  const round = state.activeRound;
  if (!round) return;

  const directAssignment = isDirectSupervisorAssignment(round);

  const currentRound = round.currentReviewRound || 0;
  const reviewStatus = round.reviewStatus || 'not_started';
  const preferenceCount = round.preferenceCount || 3;

  const statusPill = document.getElementById('admin-review-status-pill');
  const titleEl = document.getElementById('admin-review-current-title');
  const descEl = document.getElementById('admin-review-current-desc');
  const actionsWrap = document.getElementById('admin-review-actions-wrap');
  const isPublished = round.status === 'published' || reviewStatus === 'completed';
  const editingUnlocked = isPublished && round.assignmentEditingUnlocked === true;

  // Compute Stats
  const assignmentRows = getAdminAssignmentRows();
  const totalReg = state.adminReviewData.registrations.length;
  const acceptedCount = assignmentRows.filter(row => row.isAssigned).length;
  const unassignedCount = assignmentRows.filter(row => !row.isAssigned).length;
  const totalQuota = state.adminReviewData.supervisors.reduce((sum, s) => sum + (s.capacity || 10), 0);
  const fillRate = totalQuota > 0 ? Math.round((acceptedCount / totalQuota) * 100) : 0;

  document.getElementById('adm-stat-total-reg').textContent = totalReg;
  document.getElementById('adm-stat-accepted').textContent = acceptedCount;
  document.getElementById('adm-stat-unassigned').textContent = unassignedCount;
  document.getElementById('adm-stat-total-quota').textContent = totalQuota;
  document.getElementById('adm-stat-fill-rate').textContent = `${fillRate}%`;
  const unassignedCountTag = document.getElementById('adm-unassigned-count-tag');
  if (unassignedCountTag) unassignedCountTag.textContent = `${unassignedCount} SV`;

  const reviewSupervisorsSection = document.getElementById('admin-review-supervisors-section');
  const preferencesHeader = document.getElementById('admin-manual-preferences-header');
  const workflowKicker = document.getElementById('admin-review-workflow-kicker');
  const manualSectionTitle = document.querySelector('#admin-manual-assignment-section h3 span:first-child');
  const manualSectionDescription = document.querySelector('#admin-manual-assignment-section p');
  if (reviewSupervisorsSection) reviewSupervisorsSection.classList.toggle('hidden', directAssignment);
  if (preferencesHeader) preferencesHeader.classList.toggle('hidden', directAssignment);
  if (workflowKicker) workflowKicker.textContent = directAssignment ? 'BẢNG ĐIỀU KHIỂN PHÂN CÔNG GVHD' : 'BẢNG ĐIỀU KHIỂN QUY TRÌNH XÉT DUYỆT';
  if (manualSectionTitle) manualSectionTitle.textContent = directAssignment ? '🛠️ Phân công GVHD trực tiếp' : '🛠️ Phân công Thủ công (Sinh viên chưa có GVHD)';
  if (manualSectionDescription) manualSectionDescription.textContent = directAssignment
    ? 'Phân công trực tiếp cho sinh viên đã đăng ký. Chỉ tiêu GVHD vẫn được áp dụng.'
    : 'Dành cho sinh viên chưa trúng tuyển sau các vòng nguyện vọng, hoặc điều phối bổ sung.';

  if (isPublished) {
    const hasDraftChanges = (state.adminReviewData?.assignmentDrafts || []).length > 0;
    statusPill.className = hasDraftChanges
      ? 'badge bg-amber-200 text-amber-900 font-black'
      : 'badge bg-emerald-500 text-white font-black';
    statusPill.textContent = hasDraftChanges ? 'Có thay đổi chưa công bố' : 'Đã hoàn tất & Công bố';
    titleEl.textContent = hasDraftChanges ? 'Đang cập nhật phân công sau công bố' : 'Đã Hoàn tất & Công bố Kết quả ĐATN';
    descEl.textContent = hasDraftChanges
      ? 'Bạn vẫn có thể đổi hoặc bổ sung GVHD. Sinh viên sẽ thấy thay đổi sau khi bấm Công bố lại.'
      : 'Kết quả đã công bố; bạn vẫn có thể đổi GVHD hoặc bổ sung GVHD cho sinh viên chưa được phân công.';
    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 ${hasDraftChanges ? 'Lưu & Công bố lại kết quả' : 'Công bố lại khi có thay đổi'}</span>
      </button>
    `;
    return;
  }

  if (directAssignment) {
    statusPill.className = 'badge bg-indigo-200 text-indigo-900 font-black';
    statusPill.textContent = 'Phân công trực tiếp';
    titleEl.textContent = 'Giai đoạn: Khoa phân công GVHD trực tiếp';
    descEl.textContent = `Có ${unassignedCount} sinh viên chưa có GVHD. Phân công trực tiếp theo chỉ tiêu, sau đó công bố kết quả theo quy trình hiện có.`;
    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC</span>
      </button>
    `;
    return;
  }

  if (reviewStatus === 'not_started' || reviewStatus === 'draft' || currentRound === 0) {
    statusPill.className = 'badge bg-slate-200 text-slate-800 font-black';
    statusPill.textContent = 'Chưa bắt đầu xét';
    titleEl.textContent = 'Chưa bắt đầu Xét Nguyện vọng';
    descEl.textContent = 'Đợt đăng ký đã có ' + totalReg + ' hồ sơ. Bấm Bắt đầu Xét Nguyện vọng 1 để mở quyền lựa chọn cho Giảng viên.';
    actionsWrap.innerHTML = `
      <button onclick="startAdminReviewRound1()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>▶️ BẮT ĐẦU XÉT NGUYỆN VỌNG 1</span>
      </button>
    `;
  } else if (reviewStatus.startsWith('round_')) {
    statusPill.className = 'badge bg-amber-400 text-slate-900 font-black';
    statusPill.textContent = `Đang xét Nguyện vọng ${currentRound}`;
    titleEl.textContent = `Đang tiến hành: Xét duyệt Nguyện vọng ${currentRound} / ${preferenceCount}`;
    descEl.textContent = `Theo dõi tiến độ hoàn thành của các GVHD. Khi các GVHD đã chọn xong, bấm Chốt vòng để cập nhật kết quả và chuyển sang vòng tiếp theo.`;

    actionsWrap.innerHTML = `
      <button type="button" onclick="openAdminLockRoundModal()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>🔒 CHỐT NGUYỆN VỌNG ${currentRound} & CHUYỂN VÒNG →</span>
      </button>
      ${currentRound <= 2 ? `<button type="button" onclick="openAdminLockRoundModal(true)" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"><span>📢 CHỐT & CÔNG BỐ SAU VÒNG ${currentRound}</span></button>` : ''}
    `;
  } else if (reviewStatus === 'manual_assignment') {
    const endedAfterRound = Number(round.reviewEndedAfterRound || 0);
    const endedEarly = endedAfterRound >= 1 && endedAfterRound <= 2;
    statusPill.className = 'badge bg-indigo-200 text-indigo-900 font-black';
    statusPill.textContent = endedEarly ? `Đã chốt sau NV${endedAfterRound}` : 'Phân công thủ công';
    titleEl.textContent = endedEarly
      ? `Đã chốt sau Nguyện vọng ${endedAfterRound} — Sẵn sàng công bố`
      : 'Giai đoạn: Phân công GVHD Thủ công';
    descEl.textContent = endedEarly
      ? `Không cần xét các nguyện vọng còn lại. Còn ${unassignedCount} sinh viên chưa có GVHD; bạn có thể phân công bổ sung hoặc công bố ngay kết quả hiện tại.`
      : `Tất cả ${preferenceCount} vòng nguyện vọng đã kết thúc. Còn ${unassignedCount} sinh viên chưa có GVHD. Hãy phân công sinh viên vào các GVHD còn chỉ tiêu trước khi Công bố kết quả.`;

    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC</span>
      </button>
    `;
  }
}

window.unlockSupervisorAssignmentEditing = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;
  const confirmed = await showConfirm(
    'Mở khóa chỉnh sửa phân công',
    'Kết quả phân công đã được công bố. Bạn có muốn mở khóa để chỉnh sửa phân công GVHD?',
    { confirmText: 'Mở khóa chỉnh sửa', danger: false }
  );
  if (!confirmed) return;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      assignmentEditingUnlocked: true,
      assignmentPublicationState: 'editing',
      assignmentEditingUnlockedAt: serverTimestamp(),
      assignmentEditingUnlockedBy: state.user?.email || 'admin',
      updatedAt: serverTimestamp()
    });
    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment_publication',
      action: 'Mở khóa chỉnh sửa phân công GVHD',
      target: roundId,
      detail: 'Mở bản nháp chỉnh sửa; bản đã công bố tiếp tục hiển thị cho sinh viên và giảng viên',
      by: state.user?.email || 'admin'
    });
    showToast('Đã mở khóa chỉnh sửa. Bản công bố hiện tại vẫn được giữ nguyên.', 'success');
    await loadAdminReviewData(roundId);
  } catch (error) {
    showToast('Không thể mở khóa chỉnh sửa: ' + error.message, 'error');
  }
};

function renderAdminReviewSupervisorsTable() {
  const tbody = document.getElementById('admin-review-supervisors-tbody');
  if (!tbody) return;

  const currentRound = state.activeRound?.currentReviewRound || 1;
  const supervisors = state.adminReviewData.supervisors;
  const registrations = state.adminReviewData.registrations;
  const decisions = state.adminReviewData.decisions;

  let completedCount = 0;

  tbody.innerHTML = supervisors.map(s => {
    const totalCap = s.capacity || 10;
    
    // Accepted previously in rounds < currentRound
    const acceptedPrev = registrations.filter(r => {
      return (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') &&
        (r.acceptedSupervisorId === s.id || r.acceptedSupervisorId === s.supervisorId) &&
        (r.acceptedRank < currentRound);
    }).length;

    // Candidates in current round
    const candidates = registrations.filter(r => {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return false;
      const pref = (r.preferences || []).find(p => p.rank === currentRound);
      return pref && (pref.supervisorId === s.id || pref.supervisorId === s.supervisorId);
    });

    // Currently selected in this round
    const selectedCount = candidates.filter(c => {
      const dec = decisions.find(d => d.round === currentRound && (d.supervisorId === s.id || d.supervisorId === s.supervisorId) && d.studentId === c.studentId);
      return dec && dec.decision === 'selected';
    }).length;

    const remainingCap = Math.max(0, totalCap - acceptedPrev - selectedCount);

    const isCompleted = s.roundProgress && s.roundProgress['round_' + currentRound]?.status === 'completed';
    const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentRound]);

    if (isCompleted || isLocked) completedCount++;

    let statusBadge = '';
    if (isLocked) {
      statusBadge = '<span class="badge bg-slate-800 text-slate-200 font-bold">🔒 Đã khóa</span>';
    } else if (isCompleted) {
      statusBadge = '<span class="badge bg-emerald-100 text-emerald-800 font-bold">✓ Đã xong</span>';
    } else {
      statusBadge = '<span class="badge bg-amber-100 text-amber-800 font-bold">⏳ Đang chờ</span>';
    }

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
        <td class="p-3.5 text-slate-600">${s.department || '--'}</td>
        <td class="p-3.5 text-center font-bold text-slate-800">${totalCap}</td>
        <td class="p-3.5 text-center font-bold text-emerald-600">${acceptedPrev}</td>
        <td class="p-3.5 text-center font-bold text-indigo-600">${candidates.length}</td>
        <td class="p-3.5 text-center font-bold text-blue-700">${selectedCount}</td>
        <td class="p-3.5 text-center font-bold ${remainingCap > 0 ? 'text-amber-600' : 'text-slate-400'}">${remainingCap}</td>
        <td class="p-3.5 text-center">${statusBadge}</td>
        <td class="p-3.5 text-right">
          <button onclick="openAdminInspectSupModal('${s.id}')" class="text-blue-600 hover:underline font-bold text-xs">Xem chi tiết</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('adm-sup-progress-ratio').textContent = `${completedCount} / ${supervisors.length} GV hoàn tất`;
}

function renderAdminManualAssignmentTable() {
  const tbody = document.getElementById('admin-manual-assign-tbody');
  if (!tbody) return;

  const registrations = state.adminReviewData.registrations;
  const directAssignment = isDirectSupervisorAssignment();
  const unassigned = getAdminAssignmentRows().filter(row => !row.isAssigned);

  if (unassigned.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${directAssignment ? 6 : 7}" class="p-6 text-center text-emerald-700 font-bold bg-emerald-50/50">🎉 Tất cả sinh viên đã được phân công Giảng viên hướng dẫn!</td></tr>`;
    return;
  }

  tbody.innerHTML = unassigned.map(row => {
    const r = row.registration || {};
    const studentId = row.studentId;
    const studentDisplayName = resolveStudentName(studentId, r.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
    const prefsText = (r.preferences || []).map(p => `NV${p.rank}: ${p.supervisorName}`).join(' • ') || '--';

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono font-bold text-slate-900">${studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${escapeHtml(studentDisplayName)}</td>
        <td class="p-3.5 max-w-xs font-medium text-slate-900" title="${r.topicTitle || 'Chưa đăng ký đề tài'}">${r.topicTitle || '<span class="text-slate-400 italic">Chưa đăng ký đề tài</span>'}</td>
        <td class="p-3.5 text-slate-600">${r.projectType || '--'}</td>
        ${directAssignment ? '' : `<td class="p-3.5 text-[11px] text-slate-500 max-w-xs truncate" title="${prefsText}">${prefsText}</td>`}
        <td class="p-3.5 font-bold text-amber-700 text-xs">Chưa phân công</td>
        <td class="p-3.5 text-right">
          <button onclick="openAdminManualAssignModal('${studentId}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm">
            Phân công GVHD
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.startAdminReviewRound1 = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  if (!(await showConfirm('Bắt đầu Xét duyệt', 'Bắt đầu quy trình xét duyệt Nguyện vọng 1? Giảng viên hướng dẫn sẽ có thể đăng nhập và chọn sinh viên.', { confirmText: 'Bắt đầu ngay', danger: false }))) return;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      currentReviewRound: 1,
      reviewStatus: 'round_1',
      status: 'reviewing',
      updatedAt: serverTimestamp()
    });

    showToast('▶️ Đã bắt đầu xét duyệt Nguyện vọng 1 thành công!', 'success');
    await loadAdminReviewData(roundId);
  } catch (e) {
    showToast('Lỗi bắt đầu xét duyệt: ' + e.message, 'error');
  }
};

window.openAdminLockRoundModal = function(publishEarly = false) {
  const currentRound = state.activeRound?.currentReviewRound || 1;
  if (publishEarly && (currentRound < 1 || currentRound > 2)) {
    showToast('Chỉ có thể chốt và công bố sớm sau vòng 1 hoặc vòng 2.', 'warning');
    return;
  }
  const supervisors = state.adminReviewData?.supervisors || [];
  const pendingSups = supervisors.filter(s => {
    return !(s.roundProgress && s.roundProgress['round_' + currentRound]?.status === 'completed');
  });

  const preferenceCount = state.activeRound?.preferenceCount || 3;
  const titleEl = document.getElementById('modal-admin-lock-round-title');
  const detailEl = document.getElementById('modal-admin-lock-round-detail');
  const confirmBtn = document.getElementById('btn-confirm-admin-lock-round');
  if (titleEl) titleEl.textContent = publishEarly
    ? `Chốt Nguyện vọng ${currentRound} & Công bố kết quả`
    : `Khóa & Chốt Nguyện vọng ${currentRound}`;
  if (detailEl) detailEl.textContent = publishEarly
    ? `Sau khi chốt, hệ thống sẽ đưa bạn đến bước công bố kết quả. Nguyện vọng còn lại sẽ không tiếp tục xét.`
    : `Sinh viên chưa được chọn sẽ chuyển sang ${currentRound < preferenceCount ? `Nguyện vọng ${currentRound + 1}` : 'phân công thủ công'}.`;
  if (confirmBtn) {
    confirmBtn.dataset.publishEarly = publishEarly ? 'true' : 'false';
    confirmBtn.textContent = publishEarly ? '📢 Chốt & sang bước công bố' : '🔒 Xác nhận Chốt Vòng';
  }
  
  const warningEl = document.getElementById('modal-admin-lock-warning');
  if (pendingSups.length > 0) {
    document.getElementById('modal-admin-pending-sups-count').textContent = pendingSups.length;
    warningEl.classList.remove('hidden');
  } else {
    warningEl.classList.add('hidden');
  }

  document.getElementById('modal-admin-lock-round').classList.remove('hidden');
};

window.closeAdminLockRoundModal = function() {
  document.getElementById('modal-admin-lock-round').classList.add('hidden');
};

window.confirmAdminLockRound = async function() {
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const preferenceCount = state.activeRound?.preferenceCount || 3;
  const supervisors = state.adminReviewData?.supervisors || [];
  const registrations = state.adminReviewData?.registrations || [];
  const decisions = state.adminReviewData?.decisions || [];
  const confirmBtn = document.getElementById('btn-confirm-admin-lock-round');
  const publishEarly = confirmBtn?.dataset.publishEarly === 'true';

  if (!roundId) return;
  if (publishEarly && (currentRound < 1 || currentRound > 2)) {
    showToast('Chỉ có thể công bố sớm sau vòng 1 hoặc vòng 2.', 'warning');
    return;
  }

  const btn = confirmBtn || document.querySelector('#modal-admin-lock-round button.bg-rose-600');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang thực hiện chốt vòng...';
  }

  try {
    const batch = writeBatch(db);

    const supAcceptedIncrements = {};
    supervisors.forEach(s => supAcceptedIncrements[s.id] = 0);

    // 1. Process candidate students in current round
    registrations.forEach(r => {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return;

      const pref = (r.preferences || []).find(p => p.rank === currentRound);
      if (!pref) return;

      const supId = pref.supervisorId;
      const dec = decisions.find(d => d.round === currentRound && (d.supervisorId === supId) && d.studentId === r.studentId);

      const isSelected = dec && dec.decision === 'selected';

      if (isSelected) {
        // Mark Student as Accepted
        const regRef = doc(db, 'graduationRounds', roundId, 'registrations', r.studentId);
        batch.update(regRef, {
          reviewStatus: 'accepted',
          acceptedSupervisorId: supId,
          acceptedSupervisorName: pref.supervisorName,
          acceptedRank: currentRound,
          acceptedAt: serverTimestamp(),
          acceptedBy: state.user?.email || 'admin'
        });

        if (supAcceptedIncrements[supId] !== undefined) {
          supAcceptedIncrements[supId] += 1;
        }
      } else {
        // Check if student has next preference
        const hasNextPref = (r.preferences || []).some(p => p.rank === currentRound + 1);
        const regRef = doc(db, 'graduationRounds', roundId, 'registrations', r.studentId);

        if (!hasNextPref || currentRound >= preferenceCount) {
          batch.update(regRef, {
            reviewStatus: 'unassigned',
            updatedAt: serverTimestamp()
          });
        }
      }
    });

    // 2. Update supervisor acceptedCount
    supervisors.forEach(s => {
      const inc = supAcceptedIncrements[s.id] || 0;
      if (inc > 0) {
        const currentCount = s.acceptedCount || 0;
        const supRef = doc(db, 'graduationRounds', roundId, 'supervisors', s.id);
        batch.update(supRef, {
          acceptedCount: currentCount + inc,
          updatedAt: serverTimestamp()
        });
      }
    });

    // 3. Lock current round & Advance round
    const roundRef = doc(db, 'graduationRounds', roundId);
    const lockKey = `reviewLocks.round_${currentRound}`;
    const nextRound = currentRound + 1;
    const nextStatus = publishEarly
      ? 'manual_assignment'
      : (nextRound <= preferenceCount ? `round_${nextRound}` : 'manual_assignment');

    const roundUpdate = {
      currentReviewRound: publishEarly ? currentRound : nextRound,
      reviewStatus: nextStatus,
      updatedAt: serverTimestamp()
    };
    if (publishEarly) roundUpdate.reviewEndedAfterRound = currentRound;
    roundUpdate[lockKey] = {
      lockedAt: serverTimestamp(),
      lockedBy: state.user?.email || 'admin'
    };

    batch.update(roundRef, roundUpdate);

    await batch.commit();

    closeAdminLockRoundModal();
    if (publishEarly) {
      showToast(`🔒 Đã chốt Nguyện vọng ${currentRound}. Xác nhận công bố kết quả ở bước tiếp theo.`, 'success');
      await loadAdminReviewData(roundId);
      await publishAdminResults();
      return;
    }
    showToast(`🔒 ĐÃ CHỐT THÀNH CÔNG NGUYỆN VỌNG ${currentRound}!\nChuyển sang: ${nextStatus === 'manual_assignment' ? 'Phân công thủ công' : 'Xét Nguyện vọng ' + nextRound}`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi khi chốt vòng:', err);
    showToast('Lỗi chốt vòng: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = publishEarly ? '📢 Chốt & sang bước công bố' : '🔒 Xác nhận Chốt Vòng';
    }
  }
};

window.openAdminInspectSupModal = function(supId) {
  state.inspectingSupervisorId = supId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const sup = state.adminReviewData.supervisors.find(s => s.id === supId);
  if (!sup) return;

  const totalCap = sup.capacity || 10;
  const acceptedPrev = (state.adminReviewData.registrations || []).filter(r => {
    return (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') &&
      (r.acceptedSupervisorId === sup.id) &&
      (r.acceptedRank < currentRound);
  }).length;

  const candidates = (state.adminReviewData.registrations || []).filter(r => {
    if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return false;
    const pref = (r.preferences || []).find(p => p.rank === currentRound);
    return pref && (pref.supervisorId === sup.id);
  });

  const decisions = state.adminReviewData.decisions;

  document.getElementById('inspect-sup-name').textContent = `Chi tiết Xét duyệt: ${sup.name}`;
  document.getElementById('inspect-sup-quota-info').textContent = `Chỉ tiêu: ${totalCap} | Đã nhận trước: ${acceptedPrev} | Ứng viên Vòng ${currentRound}: ${candidates.length}`;

  const tbody = document.getElementById('inspect-sup-candidates-tbody');
  if (candidates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400">Không có ứng viên nào đăng ký trong vòng này.</td></tr>';
  } else {
    tbody.innerHTML = candidates.map(c => {
      const dec = decisions.find(d => d.round === currentRound && d.supervisorId === sup.id && d.studentId === c.studentId);
      const isSelected = dec && dec.decision === 'selected';
      const cStudentName = resolveStudentName(c.studentId, c.studentName);

      return `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-mono font-bold text-slate-900">${c.studentId}</td>
          <td class="p-3 font-semibold text-slate-800">${escapeHtml(cStudentName)}</td>
          <td class="p-3 max-w-xs font-medium text-slate-700 truncate" title="${c.topicTitle}">${c.topicTitle}</td>
          <td class="p-3">
            ${isSelected ? '<span class="badge bg-emerald-100 text-emerald-800 font-bold">✓ Giảng viên đã chọn</span>' : '<span class="text-slate-400 font-semibold">Chưa chọn</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('modal-admin-inspect-sup').classList.remove('hidden');
};

window.closeAdminInspectSupModal = function() {
  document.getElementById('modal-admin-inspect-sup').classList.add('hidden');
};

window.openAdminManualAssignModal = function(studentId) {
  if (!ensureAssignmentEditingAllowed()) return;
  state.manualAssignStudentId = studentId;
  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  if (!row) return;
  const reg = row.registration || {};

  const directAssignment = isDirectSupervisorAssignment();
  const modalTitle = document.querySelector('#modal-admin-manual-assign h3');
  if (modalTitle) modalTitle.textContent = directAssignment ? 'Phân công GVHD trực tiếp' : 'Phân công GVHD Thủ công';

  const studentDisplayName = resolveStudentName(row.studentId, reg.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
  document.getElementById('manual-assign-student-info').textContent = `${row.studentId} — ${studentDisplayName}`;
  document.getElementById('manual-assign-topic-info').textContent = reg.topicTitle
    ? `Đề tài: ${reg.topicTitle} (${reg.projectType || '--'})`
    : 'Đề tài: Chưa đăng ký đề tài';

  const select = document.getElementById('select-manual-supervisor');
  select.innerHTML = state.adminReviewData.supervisors.map(s => {
    const supMaster = (state.supervisorsMaster || []).find(x => x.id === s.id);
    const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || s);
    const configuredCap = typeof s.capacity === 'number' ? s.capacity : (s.maxQuota || maxCap);
    const allowedCap = Math.min(configuredCap, maxCap);

    const acceptedCount = getSupervisorAssignmentCount(s.id, row.studentId);
    const remaining = allowedCap - acceptedCount;
    const typeLabel = employmentType === 'adjunct' ? 'Thỉnh giảng' : 'Cơ hữu';

    if (remaining <= 0) {
      return `<option value="${s.id}" disabled class="text-slate-400 bg-slate-100">${s.name} (${typeLabel} • ĐÃ ĐỦ CHỈ TIÊU: ${acceptedCount}/${allowedCap})</option>`;
    }
    return `<option value="${s.id}">${s.name} (${typeLabel} • Còn ${remaining} chỗ • ${acceptedCount}/${allowedCap})</option>`;
  }).join('');

  document.getElementById('modal-admin-manual-assign').classList.remove('hidden');
};

window.closeAdminManualAssignModal = function() {
  document.getElementById('modal-admin-manual-assign').classList.add('hidden');
};

window.saveAdminManualAssign = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const studentId = state.manualAssignStudentId;
  const supervisorId = document.getElementById('select-manual-supervisor')?.value;

  if (!roundId || !studentId || !supervisorId) return;

  const sup = state.adminReviewData.supervisors.find(s => s.id === supervisorId);
  if (!sup) {
    showToast('Vui lòng chọn Giảng viên hướng dẫn.', 'warning');
    return;
  }

  const supMaster = (state.supervisorsMaster || []).find(x => x.id === sup.id);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || sup);
  const configuredCap = typeof sup.capacity === 'number' ? sup.capacity : (sup.maxQuota || maxCap);
  const allowedCap = Math.min(configuredCap, maxCap);

  const acceptedCount = getSupervisorAssignmentCount(sup.id, studentId);
  const remaining = allowedCap - acceptedCount;

  if (remaining <= 0) {
    const typeText = employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5 SV)' : 'Cơ hữu (tối đa 10 SV)';
    showToast(`Thầy/Cô ${sup.name} đã đủ chỉ tiêu phân công (${acceptedCount}/${allowedCap} SV - ${typeText}). Theo quy định của Nhà trường, không được phép phân công vượt quá chỉ tiêu.`, 'error', 6000);
    return;
  }

  try {
    const batch = writeBatch(db);

    const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
    if (!row) throw new Error('Không tìm thấy sinh viên trong danh sách đủ điều kiện hoặc đăng ký.');
    const existingAssignment = row.draft || row.assignment || {};
    const existingSupervisors = getOfficialSupervisors(normalizeOfficialAssignment(existingAssignment, row.registration));
    const supportSupervisors = existingSupervisors.filter(item => item.role === 'support' && item.supervisorId !== supervisorId);
    const supervisors = [{
      supervisorId: sup.id,
      supervisorName: sup.name || 'GVHD',
      supervisorEmail: (sup.email || '').toLowerCase().trim(),
      role: 'primary',
      source: 'manually_assigned',
      addedAt: new Date().toISOString()
    }, ...supportSupervisors];
    const studentDisplayName = resolveStudentName(studentId, row.registration?.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
    const studentEmail = row.registration?.email || row.eligibleStudent?.email || `${studentId.toLowerCase()}@student.tdtu.edu.vn`;
    const assignmentPayload = buildAssignmentDraftPayload(row, supervisors, 'admin_assigned');

    // Source of truth: assignment exists independently from registration.
    const assignmentRef = doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId);
    batch.set(assignmentRef, {
      ...assignmentPayload,
      studentName: studentDisplayName,
      studentEmail,
      createdAt: existingAssignment.createdAt || serverTimestamp(),
      createdBy: existingAssignment.createdBy || state.user?.email || 'admin'
    }, { merge: true });

    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Phân công GVHD',
      target: studentId,
      detail: `Phân công ${sup.name || supervisorId} làm GVHD chính; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    closeAdminManualAssignModal();
    showToast(`✓ Đã phân công sinh viên ${studentDisplayName} (${studentId}) cho Thầy/Cô ${sup?.name} thành công!`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    showToast('Lỗi phân công: ' + err.message, 'error');
  }
};

window.publishAdminResults = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  const assignmentRows = getAdminAssignmentRows();
  const unassignedCount = assignmentRows.filter(row => !row.isAssigned).length;
  const alreadyPublished = state.activeRound?.status === 'published' || state.activeRound?.reviewStatus === 'completed';
  const changedRows = assignmentRows.filter(row => Boolean(row.draft));

  if (alreadyPublished && changedRows.length === 0) {
    showToast('Không có thay đổi phân công mới để công bố lại.', 'info');
    return;
  }

  if (unassignedCount > 0) {
    if (!(await showConfirm('Công bố Kết quả Chính thức', `Vẫn còn ${unassignedCount} sinh viên chưa được phân công GVHD. Bạn có chắc chắn muốn hoàn tất và CÔNG BỐ KẾT QUẢ CHÍNH THỨC không?`, { confirmText: 'Công bố kết quả', danger: true }))) return;
  } else {
    if (!(await showConfirm('Công bố Kết quả Chính thức', 'Xác nhận HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC cho sinh viên và giảng viên?', { confirmText: 'Xác nhận công bố', danger: false }))) return;
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'graduationRounds', roundId), {
      reviewStatus: 'completed',
      status: 'published',
      assignmentEditingUnlocked: false,
      assignmentPublicationState: 'published',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Publish every assigned student through the existing round-level publish action.
    // Legacy registration assignments are projected into the independent source here.
    const rowsToPublish = alreadyPublished ? changedRows : assignmentRows.filter(row => row.isAssigned);
    rowsToPublish.filter(row => row.isAssigned).forEach(row => {
      const effective = row.effective;
      const supervisors = getOfficialSupervisors(effective);
      const publishedPayload = buildOfficialAssignmentPayload(row, supervisors, 'published');
      const primary = publishedPayload.supervisors.find(item => item.role === 'primary') || publishedPayload.supervisors[0];
      batch.set(doc(db, 'graduationRounds', roundId, 'officialAssignments', row.studentId), {
        ...publishedPayload,
        source: row.assignment?.source || effective.source || 'legacy_migration',
        publishedAt: serverTimestamp(),
        publishedBy: state.user?.email || 'admin'
      }, { merge: true });
      if (row.draft) {
        batch.delete(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', row.studentId));
      }
      if (row.registration) {
        batch.update(doc(db, 'graduationRounds', roundId, 'registrations', row.studentId), {
          reviewStatus: 'manually_assigned',
          officialSupervisors: publishedPayload.supervisors,
          acceptedSupervisorId: primary?.supervisorId || effective.acceptedSupervisorId || '',
          acceptedSupervisorName: primary?.supervisorName || effective.acceptedSupervisorName || '',
          acceptedRank: effective.acceptedRank || 'manual',
          acceptedAt: serverTimestamp(),
          acceptedBy: state.user?.email || 'admin',
          updatedAt: serverTimestamp()
        });
      }
    });

    await batch.commit();
    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment_publication',
      action: alreadyPublished ? 'Công bố lại phân công GVHD' : 'Công bố phân công GVHD',
      target: roundId,
      detail: `${alreadyPublished ? 'Công bố lại' : 'Công bố'} ${rowsToPublish.filter(row => row.isAssigned).length} phân công chính thức`,
      by: state.user?.email || 'admin'
    });

    showToast('🎉 ĐÃ CÔNG BỐ KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP CHÍNH THỨC THÀNH CÔNG!', 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    showToast('Lỗi công bố kết quả: ' + err.message, 'error');
  }
};


// --- SUPERVISOR BIO MODAL ---
window.openBioModal = function(supId) {
  const sup = state.roundSupervisors.find(s => s.id === supId) || state.supervisorsMaster.find(s => s.id === supId);
  if (!sup) return;

  const bioPhoto = document.getElementById('bio-modal-photo');
  const avatarSrc = (sup.showPhoto !== false && sup.photoUrl && sup.photoUrl.trim()) ? sup.photoUrl : getSupervisorAvatarSvgDataUri(sup.name);
  if (bioPhoto) {
    bioPhoto.onerror = function() {
      this.onerror = null;
      this.src = getSupervisorAvatarSvgDataUri(sup.name);
    };
    bioPhoto.src = avatarSrc;
    bioPhoto.alt = escapeHtml(sup.name || 'Giảng viên');
  }
  document.getElementById('bio-modal-name').textContent = sup.name || '--';
  document.getElementById('bio-modal-dept').textContent = sup.department || '--';
  document.getElementById('bio-modal-expertise').textContent = sup.expertise || 'Đang cập nhật';
  document.getElementById('bio-modal-text').textContent = sup.bio || 'Chưa có thông tin giới thiệu.';

  // Requirement 7: Hide email and phone during registration / before published
  let contactHtml = '';
  const isPublished = state.activeRound?.status === 'published' || state.activeRound?.reviewStatus === 'completed';
  if (isPublished && state.activeRound?.showEmailAfterPublish !== false && sup.email) {
    contactHtml += `<div class="flex items-center gap-1.5 text-slate-600"><span>✉️ Email:</span> <a href="mailto:${sup.email}" class="text-blue-600 hover:underline">${sup.email}</a></div>`;
  }
  if (isPublished && state.activeRound?.showPhoneAfterPublish !== false && sup.phone) {
    contactHtml += `<div class="flex items-center gap-1.5 text-slate-600"><span>📞 SĐT:</span> <a href="tel:${sup.phone}" class="text-blue-600 hover:underline">${sup.phone}</a></div>`;
  }
  if (!isPublished) {
    contactHtml = '<div class="text-[11px] text-slate-400 italic">Thông tin liên hệ (Email, SĐT) sẽ được hiển thị sau khi Khoa công bố kết quả phân công chính thức.</div>';
  }
  document.getElementById('bio-modal-contacts').innerHTML = contactHtml;

  document.getElementById('modal-sup-bio').classList.remove('hidden');
};

window.closeBioModal = function() {
  document.getElementById('modal-sup-bio').classList.add('hidden');
};


// ============================================================================
// ADMIN OFFICIAL & SUPPORT SUPERVISORS MANAGEMENT TABLE (v1.6.0-beta.3)
// ============================================================================
window.exportSupervisorAssignmentsExcel = function() {
  if (typeof window.XLSX === 'undefined') {
    showToast('Thư viện Excel chưa được tải.', 'error');
    return;
  }
  const rows = getAdminAssignmentRows();
  if (rows.length === 0) {
    showToast('Đợt chưa có sinh viên đủ điều kiện để xuất.', 'warning');
    return;
  }

  const data = [[
    'STT', 'MSSV', 'Họ và tên', 'Ngành', 'Lớp', 'Tên đề tài', 'Trạng thái đăng ký',
    'Email GVHD 1', 'Tên GVHD 1', 'Email GVHD 2', 'Tên GVHD 2'
  ]];
  rows.forEach((row, index) => {
    const master = typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(row.studentId) : null;
    const officials = getOfficialSupervisors(row.effective);
    const primary = officials.find(item => item.role === 'primary') || officials[0] || {};
    const support = officials.find(item => item.role === 'support') || {};
    data.push([
      index + 1,
      sanitizeExcelCell(row.studentId),
      sanitizeExcelCell(master?.fullName || master?.name || resolveStudentName(row.studentId, row.effective?.studentName)),
      sanitizeExcelCell(master?.major || row.eligibleStudent?.major || ''),
      sanitizeExcelCell(master?.className || master?.studentClass || ''),
      sanitizeExcelCell(row.registration?.topicTitle || 'Chưa đăng ký đề tài'),
      row.isRegistered ? 'Đã đăng ký' : 'Chưa đăng ký',
      sanitizeExcelCell(primary.supervisorEmail || ''),
      sanitizeExcelCell(primary.supervisorName || ''),
      sanitizeExcelCell(support.supervisorEmail || ''),
      sanitizeExcelCell(support.supervisorName || '')
    ]);
  });

  const workbook = window.XLSX.utils.book_new();
  const worksheet = window.XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 45 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 30 }, { wch: 28 }];
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'PHAN_CONG_GVHD');
  const roundCode = state.activeRound?.shortCode || state.activeRound?.slug || state.selectedRoundId || 'ROUND';
  window.XLSX.writeFile(workbook, `PHAN_CONG_GVHD_${roundCode}.xlsx`);
  showToast(`Đã xuất ${rows.length} sinh viên ra Excel.`, 'success');
};

function normalizeAssignmentImportHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAssignmentImportCell(row, aliases) {
  const aliasSet = new Set(aliases.map(normalizeAssignmentImportHeader));
  const key = Object.keys(row).find(item => aliasSet.has(normalizeAssignmentImportHeader(item)));
  return key ? row[key] : '';
}

window.handleSupervisorAssignmentExcel = function(event) {
  if (!ensureAssignmentEditingAllowed()) {
    event.target.value = '';
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = loadEvent => {
    try {
      const workbook = window.XLSX.read(new Uint8Array(loadEvent.target.result), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      buildSupervisorAssignmentImportPreview(rawRows);
    } catch (error) {
      showToast('Không đọc được file Excel: ' + error.message, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};

function buildSupervisorAssignmentImportPreview(rawRows) {
  const allRows = getAdminAssignmentRows();
  const rowsByStudent = new Map(allRows.map(row => [row.studentId, row]));
  const supervisors = state.adminReviewData?.supervisors || [];
  const supervisorByEmail = new Map(supervisors.filter(s => s.email).map(s => [String(s.email).trim().toLowerCase(), s]));
  const seenStudents = new Map();

  const preview = rawRows.map((raw, index) => {
    const studentId = String(getAssignmentImportCell(raw, ['MSSV', 'Ma sinh vien', 'Student ID']) || '').trim().replace(/\s+/g, '').toUpperCase();
    const primaryEmail = String(getAssignmentImportCell(raw, ['Email GVHD 1', 'GVHD 1 Email', 'Primary Supervisor Email']) || '').trim().toLowerCase();
    const supportEmail = String(getAssignmentImportCell(raw, ['Email GVHD 2', 'GVHD 2 Email', 'Support Supervisor Email']) || '').trim().toLowerCase();
    const row = rowsByStudent.get(studentId);
    const errors = [];
    if (!studentId) errors.push('Thiếu MSSV');
    if (studentId && !row) errors.push('MSSV không thuộc Round');
    if (studentId) {
      if (seenStudents.has(studentId)) {
        errors.push(`MSSV trùng với dòng ${seenStudents.get(studentId)}`);
      } else {
        seenStudents.set(studentId, index + 2);
      }
    }

    const current = row ? getOfficialSupervisors(row.effective) : [];
    const currentPrimary = current.find(item => item.role === 'primary') || current[0] || null;
    const currentSupport = current.find(item => item.role === 'support') || null;
    const primary = primaryEmail ? supervisorByEmail.get(primaryEmail) : null;
    const support = supportEmail ? supervisorByEmail.get(supportEmail) : null;
    if (primaryEmail && !primary) errors.push(`Email GVHD 1 không thuộc danh sách GVHD của Round: ${primaryEmail}`);
    if (supportEmail && !support) errors.push(`Email GVHD 2 không thuộc danh sách GVHD của Round: ${supportEmail}`);
    if (primaryEmail && supportEmail && primaryEmail === supportEmail) errors.push('GVHD 1 và GVHD 2 trùng nhau');

    const nextPrimary = primary || currentPrimary;
    const nextSupport = support || currentSupport;
    if (nextPrimary && nextSupport && nextPrimary.id === nextSupport.id) errors.push('GVHD 1 và GVHD 2 trùng nhau');
    const nextSupervisors = [
      ...(nextPrimary ? [{
        supervisorId: nextPrimary.id || nextPrimary.supervisorId,
        supervisorName: nextPrimary.name || nextPrimary.supervisorName,
        supervisorEmail: String(nextPrimary.email || nextPrimary.supervisorEmail || '').trim().toLowerCase(),
        role: 'primary', source: 'excel_import', addedAt: new Date().toISOString()
      }] : []),
      ...(nextSupport ? [{
        supervisorId: nextSupport.id || nextSupport.supervisorId,
        supervisorName: nextSupport.name || nextSupport.supervisorName,
        supervisorEmail: String(nextSupport.email || nextSupport.supervisorEmail || '').trim().toLowerCase(),
        role: 'support', source: 'excel_import', addedAt: new Date().toISOString()
      }] : [])
    ];
    const currentIds = current.map(item => `${item.role}:${item.supervisorId}`).sort().join('|');
    const nextIds = nextSupervisors.map(item => `${item.role}:${item.supervisorId}`).sort().join('|');
    const changed = currentIds !== nextIds;
    const status = !changed ? 'unchanged' : (current.length === 0 ? 'new' : 'changed');
    return { line: index + 2, studentId, row, primaryEmail, supportEmail, supervisors: nextSupervisors, errors, status };
  });

  // Duplicate MSSV: mark every occurrence, not only the later row.
  const duplicateIds = new Set(preview.filter((item, index) => item.studentId && preview.some((other, otherIndex) => otherIndex !== index && other.studentId === item.studentId)).map(item => item.studentId));
  preview.forEach(item => {
    if (duplicateIds.has(item.studentId) && !item.errors.some(error => error.startsWith('MSSV trùng'))) item.errors.push('MSSV xuất hiện nhiều dòng trong file');
  });

  // Simulate final state and validate quota before any write.
  const previewByStudent = new Map(preview.filter(item => item.row && item.errors.length === 0).map(item => [item.studentId, item]));
  const studentsBySupervisor = new Map();
  allRows.forEach(row => {
    const planned = previewByStudent.get(row.studentId)?.supervisors || getOfficialSupervisors(row.effective);
    new Set(planned.map(item => item.supervisorId).filter(Boolean)).forEach(supervisorId => {
      if (!studentsBySupervisor.has(supervisorId)) studentsBySupervisor.set(supervisorId, new Set());
      studentsBySupervisor.get(supervisorId).add(row.studentId);
    });
  });
  preview.forEach(item => {
    if (!item.row || item.errors.length > 0 || item.status === 'unchanged') return;
    item.supervisors.forEach(assigned => {
      const sup = supervisors.find(s => s.id === assigned.supervisorId);
      const master = (state.supervisorsMaster || []).find(s => s.id === assigned.supervisorId);
      const { maxCap } = getSupervisorDefaultAndMaxQuota(master || sup);
      const configured = typeof sup?.capacity === 'number' ? sup.capacity : (sup?.maxQuota || maxCap);
      const cap = Math.min(configured, maxCap);
      const used = studentsBySupervisor.get(assigned.supervisorId)?.size || 0;
      if (used > cap) item.errors.push(`${assigned.supervisorName} vượt quota ${used}/${cap}`);
    });
  });

  state.assignmentImportPreview = preview;
  renderSupervisorAssignmentImportPreview();
}

function renderSupervisorAssignmentImportPreview() {
  const preview = state.assignmentImportPreview || [];
  const valid = preview.filter(item => item.errors.length === 0);
  const errorCount = preview.length - valid.length;
  const counts = {
    total: preview.length,
    valid: valid.length,
    errors: errorCount,
    new: valid.filter(item => item.status === 'new').length,
    changed: valid.filter(item => item.status === 'changed').length,
    unchanged: valid.filter(item => item.status === 'unchanged').length
  };
  const summary = document.getElementById('assignment-import-summary');
  if (summary) summary.innerHTML = [
    ['Tổng dòng', counts.total, 'slate'], ['Hợp lệ', counts.valid, 'emerald'], ['Lỗi', counts.errors, 'rose'],
    ['Phân công mới', counts.new, 'blue'], ['Thay đổi', counts.changed, 'amber'], ['Không đổi', counts.unchanged, 'slate']
  ].map(([label, value, color]) => `<div class="p-2 rounded-xl bg-${color}-50 border border-${color}-200"><span class="block text-[10px] text-${color}-600">${label}</span><strong class="text-lg text-${color}-900">${value}</strong></div>`).join('');

  const tbody = document.getElementById('assignment-import-preview-tbody');
  if (tbody) tbody.innerHTML = preview.map(item => {
    const master = item.studentId && typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(item.studentId) : null;
    const primary = item.supervisors.find(s => s.role === 'primary');
    const support = item.supervisors.find(s => s.role === 'support');
    const statusText = item.errors.length > 0 ? item.errors.join('; ') : ({ new: 'Phân công mới', changed: 'Thay đổi', unchanged: 'Không thay đổi' }[item.status]);
    return `<tr class="${item.errors.length ? 'bg-rose-50' : ''}"><td class="p-2 font-mono">${item.line}</td><td class="p-2 font-mono font-bold">${escapeHtml(item.studentId)}</td><td class="p-2">${escapeHtml(master?.fullName || master?.name || item.row?.effective?.studentName || '--')}</td><td class="p-2">${escapeHtml(primary?.supervisorName || '--')}</td><td class="p-2">${escapeHtml(support?.supervisorName || '--')}</td><td class="p-2 ${item.errors.length ? 'text-rose-700' : 'text-emerald-700'} font-semibold">${escapeHtml(statusText)}</td></tr>`;
  }).join('');
  const confirmButton = document.getElementById('btn-confirm-assignment-import');
  if (confirmButton) confirmButton.disabled = errorCount > 0 || (counts.new + counts.changed) === 0;
  document.getElementById('modal-assignment-excel-preview')?.classList.remove('hidden');
}

window.closeSupervisorAssignmentExcelPreview = function() {
  document.getElementById('modal-assignment-excel-preview')?.classList.add('hidden');
  state.assignmentImportPreview = [];
};

window.confirmSupervisorAssignmentExcelImport = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const changed = (state.assignmentImportPreview || []).filter(item => item.errors.length === 0 && item.status !== 'unchanged');
  if (!roundId || changed.length === 0) return;
  try {
    for (let offset = 0; offset < changed.length; offset += 400) {
      const batch = writeBatch(db);
      changed.slice(offset, offset + 400).forEach(item => {
        batch.set(
          doc(db, 'graduationRounds', roundId, 'assignmentDrafts', item.studentId),
          buildAssignmentDraftPayload(item.row, item.supervisors, 'excel_import'),
          { merge: true }
        );
      });
      await batch.commit();
    }
    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment', action: 'Import Excel phân công GVHD', target: roundId,
      detail: `Lưu ${changed.length} thay đổi vào bản nháp; chưa công bố`, by: state.user?.email || 'admin'
    });
    closeSupervisorAssignmentExcelPreview();
    showToast(`Đã lưu ${changed.length} phân công vào bản nháp.`, 'success');
    await loadAdminReviewData(roundId);
  } catch (error) {
    showToast('Lỗi lưu phân công từ Excel: ' + error.message, 'error');
  }
};

window.filterAdminAssignedTable = function(filterVal) {
  renderAdminAssignedSupervisorsTable(filterVal);
};

window.renderAdminAssignedSupervisorsTable = function(filterVal = '') {
  const tbody = document.getElementById('admin-assigned-supervisors-tbody');
  const countTag = document.getElementById('adm-accepted-count-tag');
  const statusMsgEl = document.getElementById('adm-assignment-status-msg');
  if (!tbody) return;

  const allRows = getAdminAssignmentRows();
  const assignedRows = allRows.filter(row => row.isAssigned);
  const registeredUnassigned = allRows.filter(row => row.isRegistered && !row.isAssigned);
  const unregistered = allRows.filter(row => !row.isRegistered && !row.isAssigned);

  if (countTag) countTag.textContent = `${assignedRows.length}/${allRows.length} SV`;
  if (statusMsgEl) {
    let msg = '';
    if (registeredUnassigned.length > 0) {
      msg = `⚠️ Còn ${registeredUnassigned.length} sinh viên đã đăng ký chưa được phân công GVHD.`;
    } else if (unregistered.length > 0) {
      msg = `✓ Tất cả sinh viên đã đăng ký đã được phân công. Còn ${unregistered.length} sinh viên chưa đăng ký.`;
    } else if (allRows.length > 0 && assignedRows.length >= allRows.length) {
      msg = '✓ Tất cả sinh viên đã được phân công GVHD.';
    } else {
      msg = 'Chưa có dữ liệu sinh viên.';
    }
    statusMsgEl.textContent = msg;
  }

  const q = String(filterVal || '').trim().toLowerCase();
  const filtered = allRows.filter(row => {
    if (!q) return true;
    const reg = row.effective;
    const supNames = getOfficialSupervisors(reg).map(s => s.supervisorName || '').join(' ').toLowerCase();
    const name = resolveStudentName(row.studentId, reg.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
    return row.studentId.toLowerCase().includes(q) ||
      (reg.studentName || '').toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      (reg.topicTitle || '').toLowerCase().includes(q) ||
      supNames.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400">
          ${allRows.length === 0 ? 'Chưa có sinh viên đủ điều kiện hoặc đăng ký trong đợt này.' : 'Không tìm thấy sinh viên phù hợp từ khóa tìm kiếm.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((row, idx) => {
    const mssv = row.studentId;
    const reg = row.effective;
    const isRegistered = row.isRegistered;
    const isAssigned = row.isAssigned;
    const studentDisplayName = resolveStudentName(mssv, reg.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);

    let regStatusHtml = '';
    if (isRegistered) {
      regStatusHtml = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Đã đăng ký</span>';
    } else {
      regStatusHtml = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Chưa đăng ký</span>';
    }

    const officials = isAssigned ? getOfficialSupervisors(reg) : [];
    const primary = officials.find(s => s.role === 'primary') || officials[0];
    const supports = officials.filter(s => s.role === 'support');

    const editingLocked = isAssignmentEditingLocked();
    const primaryHtml = (isAssigned && primary) ? `
      <button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminEditSupervisorModal('${mssv}')"`} class="text-left ${editingLocked ? 'cursor-default' : 'hover:bg-blue-50 cursor-pointer'} p-1.5 -m-1.5 rounded-lg transition-colors" title="${editingLocked ? 'Mở khóa chỉnh sửa để thay đổi GVHD 1' : 'Bấm để đổi GVHD 1'}">
        <span class="font-bold text-slate-900 text-xs block">${escapeHtml(primary.supervisorName || 'GVHD 1')}</span>
        <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">GVHD 1</span>
        ${row.draft ? '<span class="block text-[9px] font-bold text-amber-700 mt-1">Chưa công bố</span>' : ''}
      </button>
    ` : `<button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminManualAssignModal('${mssv}')"`} class="font-bold text-[11px] ${editingLocked ? 'text-slate-400 cursor-default' : 'text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer'}">Chưa phân công</button>`;

    const supportsHtml = (isAssigned && supports.length > 0) ? `
      <div class="space-y-1.5">
        ${supports.map(sup => `
          <div class="flex items-center justify-between gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminEditSupervisorModal('${mssv}')"`} class="font-bold text-slate-800 text-xs block ${editingLocked ? 'cursor-default' : 'hover:text-indigo-700 hover:underline'}">${escapeHtml(sup.supervisorName)}</button>
              <span class="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-bold border border-indigo-200">GVHD 2</span>
            </div>
            <button type="button" ${editingLocked ? 'disabled' : `onclick="removeSupportSupervisor('${mssv}', '${sup.supervisorId}', '${escapeHtml(sup.supervisorName)}', '${escapeHtml(studentDisplayName)}')"`} class="px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[10px] font-bold border border-rose-200 transition-colors disabled:opacity-40" title="Gỡ GVHD 2 khỏi sinh viên này">
              Gỡ
            </button>
          </div>
        `).join('')}
      </div>
    ` : (isAssigned
      ? `<button type="button" ${editingLocked ? 'disabled' : `onclick="openAddSupportSupervisorModal('${mssv}')"`} class="font-bold text-[11px] ${editingLocked ? 'text-slate-400 cursor-default' : 'text-indigo-700 hover:underline cursor-pointer'}" title="Bấm để chọn GVHD 2">Chưa có</button>`
      : `<button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminEditSupervisorModal('${mssv}')"`} class="font-bold text-[11px] ${editingLocked ? 'text-slate-400 cursor-default' : 'text-indigo-700 hover:underline cursor-pointer'}" title="Bấm để chọn GVHD chính và GVHD 2">Chưa có</button>`);

    const masterStudent = typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(mssv) : null;
    const major = masterStudent?.major || row.eligibleStudent?.major || 'Thiết kế Nội thất';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 text-slate-400 font-bold">${idx + 1}</td>
        <td class="p-3.5 font-mono font-bold text-slate-900">${mssv}</td>
        <td class="p-3.5 font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(studentDisplayName)}</td>
        <td class="p-3.5 max-w-xs">
          <span class="font-medium text-slate-900 block truncate" title="${escapeHtml(reg?.topicTitle || 'Chưa đăng ký đề tài')}">${escapeHtml(reg?.topicTitle || 'Chưa đăng ký đề tài')}</span>
          <span class="text-[11px] text-slate-500">${escapeHtml(major)}${reg?.projectType ? ` • ${escapeHtml(reg.projectType)}` : ''}</span>
        </td>
        <td class="p-3.5 whitespace-nowrap">${regStatusHtml}</td>
        <td class="p-3.5 whitespace-nowrap">${primaryHtml}</td>
        <td class="p-3.5 min-w-[180px]">${supportsHtml}</td>
      </tr>
    `;
  }).join('');
};

window.openAddSupportSupervisorModal = function(studentId) {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  if (!row || !reg || !row.isAssigned) {
    showToast('Không tìm thấy thông tin sinh viên!', 'error');
    return;
  }

  document.getElementById('support-target-student-id').value = studentId;
  const studentInfoEl = document.getElementById('add-support-student-info');
  const studentDisplayName = resolveStudentName(reg.studentId, reg.studentName);
  if (studentInfoEl) studentInfoEl.textContent = `Sinh viên: ${studentDisplayName} (MSSV: ${studentId})`;

  const officials = getOfficialSupervisors(reg);
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const supports = officials.filter(s => s.role === 'support');

  const summaryEl = document.getElementById('support-current-supervisors-summary');
  if (summaryEl) {
    let htmlStr = `• GVHD chính: <strong>${primary?.supervisorName || 'Chưa xác định'}</strong>`;
    if (supports.length > 0) {
      htmlStr += `<br>• GVHD 2: ${supports.map(s => s.supervisorName).join(', ')}`;
    }
    summaryEl.innerHTML = htmlStr;
  }

  // Populate Supervisors dropdown with duplicate protection & quota check
  const select = document.getElementById('select-support-supervisor');
  const supervisors = state.adminReviewData?.supervisors || [];
  const assignedSupsSet = new Set(officials.map(s => s.supervisorId));

  select.innerHTML = '<option value="">-- Chọn GVHD 2 --</option>' + supervisors.map(s => {
    const isAlreadyAssigned = assignedSupsSet.has(s.id);
    const supMaster = (state.supervisorsMaster || []).find(x => x.id === s.id);
    const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || s);
    const configuredCap = typeof s.capacity === 'number' ? s.capacity : (s.maxQuota || maxCap);
    const cap = Math.min(configuredCap, maxCap);
    const totalAssigned = getSupervisorAssignmentCount(s.id, studentId);
    const remaining = cap - totalAssigned;
    const isFull = (remaining <= 0);
    const isAdjunct = (employmentType === 'adjunct');

    let label = `${s.name} (${isAdjunct ? 'Thỉnh giảng' : 'Cơ hữu'} • ${totalAssigned}/${cap} SV)`;
    if (isAlreadyAssigned) {
      label += ' — Đã là GVHD của SV';
    } else if (isFull) {
      label += ' — Đã đủ Quota';
    }

    const disabledAttr = (isAlreadyAssigned || isFull) ? 'disabled' : '';
    return `<option value="${s.id}" data-remaining="${remaining}" data-cap="${cap}" data-assigned="${totalAssigned}" ${disabledAttr}>${label}</option>`;
  }).join('');

  document.getElementById('support-supervisor-quota-hint').textContent = '';
  document.getElementById('btn-confirm-add-support').disabled = true;

  document.getElementById('modal-add-support-supervisor')?.classList.remove('hidden');
};

window.closeAddSupportSupervisorModal = function() {
  document.getElementById('modal-add-support-supervisor')?.classList.add('hidden');
};

window.onSelectSupportSupervisorChange = function(supId) {
  const submitBtn = document.getElementById('btn-confirm-add-support');
  const hint = document.getElementById('support-supervisor-quota-hint');
  if (!supId) {
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.textContent = '';
    return;
  }

  const select = document.getElementById('select-support-supervisor');
  const opt = select.options[select.selectedIndex];
  const remaining = parseInt(opt.getAttribute('data-remaining') || '0', 10);
  const cap = parseInt(opt.getAttribute('data-cap') || '10', 10);
  const assigned = parseInt(opt.getAttribute('data-assigned') || '0', 10);

  if (remaining <= 0) {
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.innerHTML = '<span class="text-rose-600 font-bold">⚠️ Giảng viên này đã đủ chỉ tiêu (hết quota) trong đợt!</span>';
  } else {
    if (submitBtn) submitBtn.disabled = false;
    if (hint) hint.innerHTML = `<span class="text-emerald-700 font-bold">✓ Chỉ tiêu khả dụng: còn ${remaining} chỗ (Đang hướng dẫn ${assigned}/${cap} SV).</span>`;
  }
};

window.executeAddSupportSupervisor = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const studentId = document.getElementById('support-target-student-id')?.value;
  const supervisorId = document.getElementById('select-support-supervisor')?.value;

  if (!roundId || !studentId || !supervisorId) return;

  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  const sup = (state.adminReviewData?.supervisors || []).find(s => s.id === supervisorId);

  if (!row || !reg || !sup) {
    showToast('Không tìm thấy thông tin sinh viên hoặc giảng viên!', 'error');
    return;
  }

  // Quota validation
  const supMaster = (state.supervisorsMaster || []).find(x => x.id === sup.id);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || sup);
  const configuredCap = typeof sup.capacity === 'number' ? sup.capacity : (sup.maxQuota || maxCap);
  const cap = Math.min(configuredCap, maxCap);
  const currentAssigned = getSupervisorAssignmentCount(sup.id, studentId);
  if (currentAssigned >= cap) {
    const typeLabel = employmentType === 'adjunct' ? 'Thỉnh giảng tối đa 5 SV' : 'Cơ hữu tối đa 10 SV';
    showToast(`Giảng viên ${sup.name} đã đủ chỉ tiêu (${currentAssigned}/${cap} SV - ${typeLabel}) theo quy định của Trường!`, 'warning');
    return;
  }

  // Duplicate protection
  const officials = getOfficialSupervisors(reg);
  if (officials.some(s => s.supervisorId === supervisorId)) {
    showToast(`Thầy/Cô ${sup.name} đã là GVHD của sinh viên này!`, 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-confirm-add-support');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang lưu...';
  }

  try {
    const updatedOfficials = [...officials, {
      supervisorId: sup.id,
      supervisorName: sup.name,
      supervisorEmail: (sup.email || '').toLowerCase().trim(),
      source: 'admin_added',
      role: 'support',
      addedAt: new Date().toISOString()
    }];

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId),
      buildAssignmentDraftPayload(row, updatedOfficials, 'admin_added_support'),
      { merge: true }
    );
    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Thêm GVHD 2',
      target: studentId,
      detail: `Thêm ${sup.name || supervisorId} làm GVHD 2; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    closeAddSupportSupervisorModal();
    renderAdminAssignedSupervisorsTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    const sName = resolveStudentName(studentId, reg.studentName);
    showToast(`✓ Đã thêm Thầy/Cô ${sup.name} làm GVHD 2 cho sinh viên ${sName}!`, 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi thêm GVHD 2:', err);
    showToast('Lỗi: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Thêm GVHD 2';
    }
  }
};

window.removeSupportSupervisor = async function(studentId, supervisorId, supervisorName, studentName) {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  if (!roundId || !studentId || !supervisorId) return;

  const confirmed = await showConfirm(
    'Gỡ GVHD 2',
    `Bạn có chắc chắn muốn gỡ Thầy/Cô "${supervisorName}" khỏi vai trò GVHD 2 của sinh viên "${studentName}" không?`,
    { confirmText: 'Gỡ GVHD 2', danger: true }
  );
  if (!confirmed) return;

  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  if (!row || !row.isAssigned) return;

  try {
    const officials = getOfficialSupervisors(row.effective);
    const updatedOfficials = officials.filter(s => !(s.role === 'support' && s.supervisorId === supervisorId));

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId),
      buildAssignmentDraftPayload(row, updatedOfficials, 'admin_removed_support'),
      { merge: true }
    );
    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Gỡ GVHD 2',
      target: studentId,
      detail: `Gỡ ${supervisorName || supervisorId} khỏi vai trò GVHD 2; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    renderAdminAssignedSupervisorsTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    showToast(`Đã gỡ GVHD 2 khỏi sinh viên ${studentName}.`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi gỡ GVHD 2:', err);
    showToast('Lỗi gỡ GVHD 2: ' + err.message, 'error');
  }
};

// --- ADMIN: EDIT / REASSIGN OFFICIAL SUPERVISOR (works even after publish) ---
function computeSupervisorQuotaInfo(supId, excludeStudentId = null) {
  const sup = (state.adminReviewData?.supervisors || []).find(s => s.id === supId);
  if (!sup) return null;
  const supMaster = (state.supervisorsMaster || []).find(x => x.id === sup.id);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || sup);
  const configuredCap = typeof sup.capacity === 'number' ? sup.capacity : (sup.maxQuota || maxCap);
  const allowedCap = Math.min(configuredCap, maxCap);
  const used = getSupervisorAssignmentCount(supId, excludeStudentId || '');
  return { sup, employmentType, allowedCap, used, remaining: allowedCap - used };
}

function buildEditSupervisorOptions(selectEl, currentSupervisorId, allowEmpty = false) {
  const supervisors = state.adminReviewData?.supervisors || [];
  const currentReg = state.editSupStudentId ? getAdminAssignmentRows().find(row => row.studentId === state.editSupStudentId)?.effective : null;
  selectEl.innerHTML = (allowEmpty ? '<option value="">-- Không có GVHD 2 --</option>' : '') + supervisors.map(s => {
    const info = computeSupervisorQuotaInfo(s.id, state.editSupStudentId);
    if (!info) return '';
    const isSelf = currentReg ? isOfficialSupervisor(currentReg, s.id) : (s.id === currentSupervisorId);
    const typeLabel = info.employmentType === 'adjunct' ? 'Thỉnh giảng' : 'Cơ hữu';
    if (info.remaining <= 0 && !isSelf) {
      return `<option value="${s.id}" disabled class="text-slate-400 bg-slate-100">${s.name} (${typeLabel} • ĐÃ ĐỦ CHỈ TIÊU: ${info.used}/${info.allowedCap})</option>`;
    }
    return `<option value="${s.id}">${s.name} (${typeLabel} • Còn ${info.remaining} chỗ • ${info.used}/${info.allowedCap})</option>`;
  }).join('');
}

window.openAdminEditSupervisorModal = function(studentId) {
  if (!ensureAssignmentEditingAllowed()) return;
  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  if (!row || !reg) {
    showToast('Không tìm thấy thông tin sinh viên này.', 'warning');
    return;
  }

  state.editSupStudentId = studentId;
  const officials = getOfficialSupervisors(reg);
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const secondary = officials.find(s => s.role === 'support');

  document.getElementById('edit-sup-student-info').textContent = `${reg.studentId} — ${resolveStudentName(reg.studentId, reg.studentName)}`;
  document.getElementById('edit-sup-topic-info').textContent = `Đề tài: ${reg.topicTitle || '--'}${reg.projectType ? ' (' + reg.projectType + ')' : ''}`;
  document.getElementById('edit-sup-round-info').textContent = `Đợt tốt nghiệp: ${state.activeRound?.title || state.activeRound?.name || state.selectedRoundId || '--'}`;
  document.getElementById('edit-sup-current-primary').textContent = primary?.supervisorName || 'Chưa phân công';
  document.getElementById('edit-sup-current-secondary').textContent = secondary?.supervisorName || 'Chưa có';

  buildEditSupervisorOptions(document.getElementById('select-edit-primary-supervisor'), primary?.supervisorId || '');
  buildEditSupervisorOptions(document.getElementById('select-edit-secondary-supervisor'), secondary?.supervisorId || '', true);
  document.getElementById('select-edit-primary-supervisor').value = primary?.supervisorId || '';
  document.getElementById('select-edit-secondary-supervisor').value = secondary?.supervisorId || '';

  // Warn if scoring data exists for this student (must not be moved/deleted).
  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const hasScoring = Boolean(round?.supervisorScores?.[studentId]);
  document.getElementById('edit-sup-scoring-warning').classList.toggle('hidden', !hasScoring);

  document.getElementById('edit-sup-hint').textContent = 'GVHD chính và GVHD 2 không được là cùng một người. Preference NV1/NV2/NV3 của sinh viên được giữ nguyên.';
  document.getElementById('modal-admin-edit-supervisor').classList.remove('hidden');
};

window.closeAdminEditSupervisorModal = function() {
  document.getElementById('modal-admin-edit-supervisor').classList.add('hidden');
  state.editSupStudentId = null;
};

window.saveAdminEditSupervisor = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const studentId = state.editSupStudentId;
  if (!roundId || !studentId) return;

  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  if (!row || !reg) return;

  const newPrimaryId = document.getElementById('select-edit-primary-supervisor')?.value || '';
  const newSecondaryId = document.getElementById('select-edit-secondary-supervisor')?.value || '';

  if (!newPrimaryId) {
    showToast('Vui lòng chọn GVHD chính.', 'warning');
    return;
  }
  if (newSecondaryId && newSecondaryId === newPrimaryId) {
    showToast('GVHD chính và GVHD 2 không được là cùng một người.', 'warning');
    return;
  }

  const officials = getOfficialSupervisors(reg);
  const oldPrimary = officials.find(s => s.role === 'primary') || officials[0];
  const oldSecondary = officials.find(s => s.role === 'support');

  if (newPrimaryId === (oldPrimary?.supervisorId || '') && newSecondaryId === (oldSecondary?.supervisorId || '')) {
    showToast('Phân công không thay đổi.', 'info');
    return;
  }

  // Quota validation (excluding the student being edited to avoid double-count)
  const newPrimaryInfo = computeSupervisorQuotaInfo(newPrimaryId, studentId);
  if (!newPrimaryInfo) {
    showToast('Không tìm thấy thông tin GVHD chính mới.', 'warning');
    return;
  }
  if (newPrimaryId !== oldPrimary?.supervisorId && newPrimaryInfo.remaining <= 0) {
    const typeText = newPrimaryInfo.employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5 SV)' : 'Cơ hữu (tối đa 10 SV)';
    showToast(`Thầy/Cô ${newPrimaryInfo.sup.name} đã đủ chỉ tiêu (${newPrimaryInfo.used}/${newPrimaryInfo.allowedCap} SV - ${typeText}). Không thể phân công vượt chỉ tiêu.`, 'error', 6000);
    return;
  }
  if (newSecondaryId && newSecondaryId !== oldSecondary?.supervisorId) {
    const newSecondaryInfo = computeSupervisorQuotaInfo(newSecondaryId, studentId);
    if (!newSecondaryInfo || newSecondaryInfo.remaining <= 0) {
      const typeText = newSecondaryInfo?.employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5 SV)' : 'Cơ hữu (tối đa 10 SV)';
      showToast(`GVHD 2: Thầy/Cô ${newSecondaryInfo?.sup.name || '--'} đã đủ chỉ tiêu (${newSecondaryInfo?.used || '?'}/${newSecondaryInfo?.allowedCap || '?'} SV - ${typeText}).`, 'error', 6000);
      return;
    }
  }

  const newPrimary = newPrimaryInfo.sup;
  const newSecondary = newSecondaryId ? (state.adminReviewData?.supervisors || []).find(s => s.id === newSecondaryId) : null;
  const otherSupports = officials.filter(s => s.role === 'support' && s.supervisorId !== (oldSecondary?.supervisorId || '') && s.supervisorId !== newSecondaryId);

  const nowIso = new Date().toISOString();
  const updatedOfficials = [
    {
      supervisorId: newPrimary.id,
      supervisorName: newPrimary.name,
      supervisorEmail: (newPrimary.email || '').toLowerCase().trim(),
      source: newPrimaryId === oldPrimary?.supervisorId ? (oldPrimary.source || 'preference') : 'admin_edited',
      role: 'primary',
      addedAt: newPrimaryId === oldPrimary?.supervisorId ? (oldPrimary.addedAt || nowIso) : nowIso
    },
    ...(newSecondary ? [{
      supervisorId: newSecondary.id,
      supervisorName: newSecondary.name,
      supervisorEmail: (newSecondary.email || '').toLowerCase().trim(),
      source: newSecondaryId === oldSecondary?.supervisorId ? (oldSecondary.source || 'admin_added') : 'admin_added',
      role: 'support',
      addedAt: nowIso
    }] : []),
    ...otherSupports
  ];

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId),
      buildAssignmentDraftPayload(row, updatedOfficials, 'admin_edited'),
      { merge: true }
    );

    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Cập nhật phân công GVHD',
      target: studentId,
      detail: `GVHD chính: ${oldPrimary?.supervisorName || oldPrimary?.supervisorId || '--'} → ${newPrimary.name}; GVHD 2: ${oldSecondary?.supervisorName || oldSecondary?.supervisorId || '--'} → ${newSecondary?.name || '--'}; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    // Update local cache so UI stays consistent without a refetch round-trip
    closeAdminEditSupervisorModal();
    renderAdminAssignedSupervisorsTable();
    renderAdminManualAssignmentTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    showToast(`✓ Đã cập nhật phân công GVHD cho sinh viên ${resolveStudentName(studentId, reg.studentName)}: GVHD chính ${newPrimary.name}${newSecondary ? `, GVHD 2 ${newSecondary.name}` : ''}.`, 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi chỉnh sửa phân công GVHD:', err);
    showToast('Lỗi lưu phân công: ' + err.message, 'error');
  }
};



// ============================================================================

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getOfficialSupervisors !== 'undefined') window.getOfficialSupervisors = getOfficialSupervisors;
  if (typeof normalizeOfficialAssignment !== 'undefined') window.normalizeOfficialAssignment = normalizeOfficialAssignment;
  if (typeof getAdminAssignmentRows !== 'undefined') window.getAdminAssignmentRows = getAdminAssignmentRows;
  if (typeof buildOfficialAssignmentPayload !== 'undefined') window.buildOfficialAssignmentPayload = buildOfficialAssignmentPayload;
  if (typeof buildAssignmentDraftPayload !== 'undefined') window.buildAssignmentDraftPayload = buildAssignmentDraftPayload;
  if (typeof isAssignmentEditingLocked !== 'undefined') window.isAssignmentEditingLocked = isAssignmentEditingLocked;
  if (typeof ensureAssignmentEditingAllowed !== 'undefined') window.ensureAssignmentEditingAllowed = ensureAssignmentEditingAllowed;
  if (typeof getSupervisorAssignmentCount !== 'undefined') window.getSupervisorAssignmentCount = getSupervisorAssignmentCount;
  if (typeof isOfficialSupervisor !== 'undefined') window.isOfficialSupervisor = isOfficialSupervisor;
  if (typeof getPreliminaryExcludedSupervisorIds !== 'undefined') window.getPreliminaryExcludedSupervisorIds = getPreliminaryExcludedSupervisorIds;
  if (typeof getSupervisorTotalAssignedCount !== 'undefined') window.getSupervisorTotalAssignedCount = getSupervisorTotalAssignedCount;
  if (typeof getSupervisorAssignmentMode !== 'undefined') window.getSupervisorAssignmentMode = getSupervisorAssignmentMode;
  if (typeof isDirectSupervisorAssignment !== 'undefined') window.isDirectSupervisorAssignment = isDirectSupervisorAssignment;
  if (typeof shouldSkipStudentSupervisorPreference !== 'undefined') window.shouldSkipStudentSupervisorPreference = shouldSkipStudentSupervisorPreference;
  if (typeof loadRoundSupervisors !== 'undefined') window.loadRoundSupervisors = loadRoundSupervisors;
  if (typeof renderSupervisorsGrid !== 'undefined') window.renderSupervisorsGrid = renderSupervisorsGrid;
  if (typeof renderPreferencesTray !== 'undefined') window.renderPreferencesTray = renderPreferencesTray;
  if (typeof loadSupervisorReviewData !== 'undefined') window.loadSupervisorReviewData = loadSupervisorReviewData;
  if (typeof renderSupervisorReviewUI !== 'undefined') window.renderSupervisorReviewUI = renderSupervisorReviewUI;
  if (typeof renderSupervisorCandidatesTable !== 'undefined') window.renderSupervisorCandidatesTable = renderSupervisorCandidatesTable;
  if (typeof renderSupervisorAcceptedTable !== 'undefined') window.renderSupervisorAcceptedTable = renderSupervisorAcceptedTable;
  if (typeof loadAdminStats !== 'undefined') window.loadAdminStats = loadAdminStats;
  if (typeof renderAdminReviewDashboard !== 'undefined') window.renderAdminReviewDashboard = renderAdminReviewDashboard;
  if (typeof renderAdminReviewSupervisorsTable !== 'undefined') window.renderAdminReviewSupervisorsTable = renderAdminReviewSupervisorsTable;
  if (typeof renderAdminManualAssignmentTable !== 'undefined') window.renderAdminManualAssignmentTable = renderAdminManualAssignmentTable;
  if (typeof normalizeAssignmentImportHeader !== 'undefined') window.normalizeAssignmentImportHeader = normalizeAssignmentImportHeader;
  if (typeof getAssignmentImportCell !== 'undefined') window.getAssignmentImportCell = getAssignmentImportCell;
  if (typeof buildSupervisorAssignmentImportPreview !== 'undefined') window.buildSupervisorAssignmentImportPreview = buildSupervisorAssignmentImportPreview;
  if (typeof renderSupervisorAssignmentImportPreview !== 'undefined') window.renderSupervisorAssignmentImportPreview = renderSupervisorAssignmentImportPreview;
  if (typeof computeSupervisorQuotaInfo !== 'undefined') window.computeSupervisorQuotaInfo = computeSupervisorQuotaInfo;
  if (typeof buildEditSupervisorOptions !== 'undefined') window.buildEditSupervisorOptions = buildEditSupervisorOptions;
  if (typeof normalizeId !== 'undefined') window.normalizeId = normalizeId;
}
