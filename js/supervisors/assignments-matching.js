/**
 * IFA+ Graduation — Supervisor Assignments & Preference Matching Submodule
 */
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




// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof loadSupervisorReviewData !== 'undefined') window.loadSupervisorReviewData = loadSupervisorReviewData;
  if (typeof renderSupervisorReviewCards !== 'undefined') window.renderSupervisorReviewCards = renderSupervisorReviewCards;
  if (typeof acceptCandidate !== 'undefined') window.acceptCandidate = acceptCandidate;
  if (typeof rejectCandidate !== 'undefined') window.rejectCandidate = rejectCandidate;
  if (typeof undoCandidateDecision !== 'undefined') window.undoCandidateDecision = undoCandidateDecision;
  if (typeof submitSupervisorReviewBatch !== 'undefined') window.submitSupervisorReviewBatch = submitSupervisorReviewBatch;
}
