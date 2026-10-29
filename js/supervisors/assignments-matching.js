const renderRoundHeader = () => window.renderRoundHeader?.();

// --- Module Bridges ---
const renderAdminRoundsTable = () => window.renderAdminRoundsTable?.();
const renderAdminRoundsCards = () => window.renderAdminRoundsCards?.();
const populateRoundSelectors = () => window.populateRoundSelectors?.();
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
  let officials = [];
  if (Array.isArray(reg.officialSupervisors) && reg.officialSupervisors.length > 0) {
    officials = reg.officialSupervisors;
  } else {
    // Backward compatibility: derive from acceptedSupervisorId / finalSupervisorId
    const primaryId = reg.acceptedSupervisorId || reg.finalSupervisorId;
    if (primaryId) {
      officials = [{
        supervisorId: primaryId,
        supervisorName: reg.acceptedSupervisorName || '',
        source: 'preference',
        role: 'primary',
        addedAt: reg.acceptedAt || reg.updatedAt || new Date().toISOString()
      }];
    }
  }
  return officials.map(item => {
    const supId = item.supervisorId || item.id;
    const supEmail = item.supervisorEmail || item.email;
    const resolvedName = (typeof window !== 'undefined' && typeof window.resolveSupervisorName === 'function')
      ? window.resolveSupervisorName(supId || supEmail, item.supervisorName)
      : item.supervisorName;
    const profile = (typeof window !== 'undefined' && typeof window.resolveSupervisorProfile === 'function')
      ? window.resolveSupervisorProfile(supId || supEmail, item)
      : item;
    return {
      ...item,
      supervisorName: resolvedName || item.supervisorName || '',
      supervisorEmail: profile?.email || item.supervisorEmail || item.email || '',
      photoUrl: profile?.photoUrl || item.photoUrl || ''
    };
  });
}

export function normalizeOfficialAssignment(assignment, registration = null) {
  if (!assignment && !registration) return null;
  const source = assignment || {};
  const legacy = registration || {};
  const rawSupervisors = Array.isArray(source.supervisors) && source.supervisors.length > 0
    ? source.supervisors
    : getOfficialSupervisors(legacy);
  const supervisors = rawSupervisors.map(item => {
    const supId = item.supervisorId || item.id;
    const supEmail = item.supervisorEmail || item.email;
    const resolvedName = (typeof window !== 'undefined' && typeof window.resolveSupervisorName === 'function')
      ? window.resolveSupervisorName(supId || supEmail, item.supervisorName)
      : item.supervisorName;
    const profile = (typeof window !== 'undefined' && typeof window.resolveSupervisorProfile === 'function')
      ? window.resolveSupervisorProfile(supId || supEmail, item)
      : item;
    return {
      ...item,
      supervisorName: resolvedName || item.supervisorName || '',
      supervisorEmail: profile?.email || item.supervisorEmail || item.email || '',
      photoUrl: profile?.photoUrl || item.photoUrl || ''
    };
  });
  const primary = supervisors.find(s => s.role === 'primary') || supervisors[0] || null;
  const acceptedSupId = source.acceptedSupervisorId || primary?.supervisorId || legacy.acceptedSupervisorId || '';
  const acceptedSupName = (typeof window !== 'undefined' && typeof window.resolveSupervisorName === 'function')
    ? window.resolveSupervisorName(acceptedSupId, source.acceptedSupervisorName || primary?.supervisorName || legacy.acceptedSupervisorName || '')
    : (source.acceptedSupervisorName || primary?.supervisorName || legacy.acceptedSupervisorName || '');
  return {
    ...legacy,
    ...source,
    studentId: source.studentId || legacy.studentId || source.id || legacy.id || '',
    studentName: source.studentName || legacy.studentName || '',
    email: source.studentEmail || source.email || legacy.email || '',
    topicTitle: legacy.topicTitle || source.topicTitle || '',
    projectType: legacy.projectType || source.projectType || '',
    supervisors: supervisors,
    officialSupervisors: supervisors,
    acceptedSupervisorId: acceptedSupId,
    acceptedSupervisorName: acceptedSupName,
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
  const allSupervisorEmails = new Set();
  enrichedSupervisors.forEach(item => {
    if (item.supervisorEmail) allSupervisorEmails.add(item.supervisorEmail.toLowerCase().trim());
    if (item.email) allSupervisorEmails.add(item.email.toLowerCase().trim());
    const profile = (state.adminReviewData?.supervisors || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId)
      || (state.supervisorsMaster || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId);
    if (profile?.email) allSupervisorEmails.add(profile.email.toLowerCase().trim());
    if (profile?.personalEmail) allSupervisorEmails.add(profile.personalEmail.toLowerCase().trim());
    if (profile?.institutionalEmail) allSupervisorEmails.add(profile.institutionalEmail.toLowerCase().trim());
    if (Array.isArray(profile?.emails)) profile.emails.forEach(e => e && allSupervisorEmails.add(e.toLowerCase().trim()));
  });
  return {
    studentId,
    studentName: resolveStudentName(studentId, row.registration?.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name || row.effective?.studentName),
    studentEmail: row.registration?.email || row.eligibleStudent?.email || row.effective?.email || `${studentId.toLowerCase()}@student.tdtu.edu.vn`,
    supervisors: enrichedSupervisors,
    supervisorIds: enrichedSupervisors.map(item => item.supervisorId),
    supervisorEmails: Array.from(allSupervisorEmails).filter(Boolean),
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

if (typeof window !== 'undefined') {
  window.getPreliminaryExcludedSupervisorIds = getPreliminaryExcludedSupervisorIds;
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
      const master = (state.supervisorsMaster || []).find(item => item.id === roundSupervisor.supervisorId || item.id === roundSupervisor.id || (roundSupervisor.email && item.email && item.email.toLowerCase().trim() === roundSupervisor.email.toLowerCase().trim()));
      // Master profile is the SINGLE SOURCE OF TRUTH for lecturer profile attributes.
      return {
        ...roundSupervisor,
        ...(master || {}),
        capacity: typeof roundSupervisor.capacity === 'number' ? roundSupervisor.capacity : (master?.defaultQuota || 10),
        activeInRound: roundSupervisor.activeInRound !== false,
        roundProgress: roundSupervisor.roundProgress || {},
        sortOrder: roundSupervisor.sortOrder || 1
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
        <button type="button" onclick="event.stopPropagation(); selectWizardPreference('${s.id}', '${encodeURIComponent(s.name)}')" class="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${isSelectedForCurrentWizard ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
          ${isSelectedForCurrentWizard ? '✓ Đang chọn cho NV' + state.wizardRank : 'Chọn cho NV' + state.wizardRank}
        </button>
      `;
    } else {
      if (isSelected) {
        buttonHtml = `
          <button type="button" onclick="event.stopPropagation(); removePreference('${s.id}')" class="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all">
            ✕ Bỏ chọn (NV${assignedRank})
          </button>
        `;
      } else {
        const canAddMore = state.selectedPreferences.length < maxPref;
        buttonHtml = `
          <button type="button" onclick="event.stopPropagation(); addCardPreference('${s.id}', '${encodeURIComponent(s.name)}')" ${!canAddMore ? 'disabled' : ''} class="w-full py-2 px-3 bg-tdtu-blue hover:bg-tdtu-dark disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
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
      ? `<button type="button" onclick="event.stopPropagation(); openBioModal('${s.id}')" class="px-2.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold shrink-0" title="Xem hồ sơ chi tiết">
           ℹ️ Chi tiết
         </button>`
      : '';

    return `
      <div class="card-surface p-3.5 sm:p-4 flex flex-col justify-between h-full card-hover relative rounded-2xl border border-slate-200/90 shadow-sm cursor-pointer select-none transition-all group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/25 border-blue-400' : 'bg-white hover:border-blue-300 hover:shadow-md'}"
           tabindex="0"
           role="button"
           aria-label="${isSelected ? `Bỏ chọn nguyện vọng cho ${escapedName}` : `Chọn ${escapedName} làm nguyện vọng`}"
           onclick="handleSupervisorCardClick(event, '${s.id}', '${encodeURIComponent(s.name)}', ${isWizard}, ${isSelected})"
           onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleSupervisorCardClick(event, '${s.id}', '${encodeURIComponent(s.name)}', ${isWizard}, ${isSelected});}">
        <div class="flex-1 flex flex-col">
          <!-- Portrait photo with fixed aspect-[3/4] and object-contain to strictly prevent face/head cropping -->
          <div class="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 mb-3 border border-slate-200/80 shadow-2xs group-hover:opacity-95 transition-opacity flex items-center justify-center">
            <!-- Blurred ambient backdrop layer of the same photo for aesthetic framing -->
            <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="absolute inset-0 w-full h-full object-cover blur-sm opacity-20 scale-110 pointer-events-none select-none" alt="" aria-hidden="true">
            <!-- Sharp, uncropped portrait photo with object-contain -->
            <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="relative z-10 w-full h-full object-contain p-0.5 select-none" alt="${escapedName}">
            ${isSelected ? `<span class="absolute right-2.5 top-2.5 z-20 px-2.5 py-1 rounded-full bg-amber-500 text-slate-900 font-black text-xs shadow-md">NV${assignedRank}</span>` : ''}
          </div>

          <!-- Supervisor Information -->
          <div class="space-y-1 mb-2 flex-1">
            <h3 class="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 min-h-[2.5rem] flex items-start" title="${escapedName}">${escapedName}</h3>
            <p class="text-xs text-slate-500 font-medium truncate">${escapeHtml(dept)}</p>
            ${email ? `
              <p class="text-xs text-blue-600 truncate flex items-center gap-1.5 font-mono pt-1" title="${escapeHtml(email)}">
                <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span class="truncate">${escapeHtml(email)}</span>
              </p>
            ` : ''}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2">
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

window.handleSupervisorCardClick = function(event, supervisorId, encName, isWizard, isSelected) {
  // Prevent double trigger if clicked directly on an interactive button, link, or input
  if (event.target && event.target.closest('button, a, input, textarea, select')) {
    return;
  }
  if (isWizard) {
    if (typeof window.selectWizardPreference === 'function') {
      window.selectWizardPreference(supervisorId, encName);
    }
  } else {
    if (isSelected) {
      if (typeof window.removePreference === 'function') {
        window.removePreference(supervisorId);
      }
    } else {
      if (typeof window.addCardPreference === 'function') {
        window.addCardPreference(supervisorId, encName);
      }
    }
  }
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
      const supDisplayName = (typeof window !== 'undefined' && typeof window.resolveSupervisorName === 'function')
        ? window.resolveSupervisorName(pref.supervisorId || pref.id || pref.email, pref.supervisorName)
        : pref.supervisorName;
      html += `
        <div class="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs shadow-sm">
          <span class="w-5 h-5 rounded-full bg-amber-500 text-slate-900 font-extrabold text-[10px] flex items-center justify-center">NV${rank}</span>
          <span class="font-bold text-slate-100 max-w-[120px] truncate" title="${escapeHtml(supDisplayName)}">${escapeHtml(supDisplayName)}</span>
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

  if (typeof ensureSupervisorsMasterLoaded === 'function') {
    try { await ensureSupervisorsMasterLoaded(); } catch (e) {}
  }

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase().trim();
  const currentSup = (typeof resolveSupervisorIdentity === 'function')
    ? resolveSupervisorIdentity(actor, state.roundSupervisors, state.supervisorsMaster)
    : (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));

  const greetingEl = document.getElementById('supervisor-greeting-name');
  const roundInfoEl = document.getElementById('supervisor-round-info');
  const activeBadgeEl = document.getElementById('sup-active-round-badge');

  const supDisplayName = currentSup?.name || actor?.displayName || state.user?.displayName || 'Thầy/Cô';
  if (greetingEl) greetingEl.innerHTML = `Kính chào Thầy/Cô<br class="sm:hidden"> <span class="font-black">${escapeHtml(supDisplayName)}</span>`;
  const roundYear = state.activeRound?.academicYear ? ` (${state.activeRound?.academicYear})` : '';
  if (roundInfoEl) roundInfoEl.textContent = `${state.activeRound?.title || ''}${roundYear}`;
  if (activeBadgeEl) activeBadgeEl.textContent = state.activeRound?.roundName || state.activeRound?.title || 'Đợt ĐATN';

  if (!currentSup) {
    const ids = ['sup-stat-total-cap', 'sup-stat-accepted-prev', 'sup-stat-selected-curr', 'sup-stat-remaining-cap',
                 'sup-review-stat-total-cap', 'sup-review-stat-accepted-prev', 'sup-review-stat-selected-curr', 'sup-review-stat-remaining-cap', 'sup-review-stat-waiting'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
    const ind = document.getElementById('sup-round-review-indicator');
    if (ind) ind.textContent = 'Thầy/Cô chưa tham gia đợt này';
    const tbody = document.getElementById('sup-candidates-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Thầy/Cô chưa được cấu hình vào danh sách GVHD đợt này.</td></tr>';
    return;
  }

  try {
    // 1. Load round supervisors fresh
    const supDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id));
    const supData = supDoc.exists() ? supDoc.data() : (currentSup.rawRoundSupervisor || currentSup);
    state.supervisorRoundProgress = supData.roundProgress || {};

    // 2. Load all registrations for this round
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const allRegistrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Load decisions made in this round
    let allDecisions = [];
    try {
      if (actor?.isAdmin) {
        const decSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'reviewDecisions'));
        allDecisions = decSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        const q = query(
          collection(db, 'graduationRounds', roundId, 'reviewDecisions'),
          where('supervisorEmail', '==', emailLower)
        );
        const decSnap = await getDocs(q);
        allDecisions = decSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (decErr) {
      console.warn('[SupervisorPortal] Could not query reviewDecisions by supervisorEmail:', decErr);
      allDecisions = [];
    }

    const currentReviewRound = Number(state.activeRound?.currentReviewRound || 1);
    const reviewStatus = state.activeRound?.reviewStatus || 'round_1';
    const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentReviewRound]);
    const isCompleted = state.supervisorRoundProgress['round_' + currentReviewRound]?.status === 'completed';

    // Map supervisor capacities to determine if NV2 supervisor was FULL from Round 1
    const supCapacityMap = new Map();
    (state.roundSupervisors || []).forEach(s => {
      supCapacityMap.set(s.id, {
        total: typeof s.capacity === 'number' ? s.capacity : (typeof s.maxQuota === 'number' ? s.maxQuota : 10),
        acceptedCount: s.acceptedCount || 0
      });
    });

    // 4. Candidate identification per 3-Round rules (including Rule 3.5 early skip to NV3)
    const candidates = [];
    allRegistrations.forEach(registration => {
      if (registration.reviewStatus === 'accepted' || registration.reviewStatus === 'manually_assigned' ||
          registration.eligibilityStatus === 'not_eligible' || registration.draft === true) return;

      const studentId = String(registration.studentId || registration.id || '').trim().toUpperCase();
      const pref1 = (registration.preferences || []).find(p => Number(p.rank) === 1);
      const pref2 = (registration.preferences || []).find(p => Number(p.rank) === 2);
      const pref3 = (registration.preferences || []).find(p => Number(p.rank) === 3);

      const matchesSup = (pref) => {
        if (!pref) return false;
        if (typeof currentSup.matchesPreference === 'function') return currentSup.matchesPreference(pref);
        const pId = String(pref.supervisorId || pref.id || '').trim();
        const pEmail = String(pref.supervisorEmail || pref.email || '').toLowerCase().trim();
        return (pId && (pId === currentSup.id || pId === currentSup.supervisorId)) ||
               (pEmail && pEmail === emailLower);
      };

      const matchesDecision = (d, roundNum) => {
        if (String(d.studentId).trim().toUpperCase() !== studentId) return false;
        if (Number(d.round) !== roundNum) return false;
        if (d.supervisorId && (d.supervisorId === currentSup.id || d.supervisorId === currentSup.supervisorId)) return true;
        if (d.supervisorEmail && (d.supervisorEmail.toLowerCase().trim() === emailLower || (currentSup.candidateEmails && currentSup.candidateEmails.has(d.supervisorEmail.toLowerCase().trim())))) return true;
        return false;
      };

      if (currentReviewRound === 1 || reviewStatus === 'round_1' || reviewStatus === 'not_started' || reviewStatus === 'draft' || !reviewStatus) {
        // Round 1: Only students who chose this supervisor as NV1
        if (matchesSup(pref1)) {
          const dec = allDecisions.find(d => matchesDecision(d, 1));
          candidates.push({
            ...registration,
            studentId,
            candidateRank: 1,
            isEarlyTransition: false,
            currentDecision: dec?.decision === 'selected' ? 'selected' : ''
          });
        }
      } else if (currentReviewRound === 2 || reviewStatus === 'round_2') {
        // Round 2: Regular NV2, PLUS students whose NV2 supervisor was FULL from Round 1 (Rule 3.5 early skip to NV3)
        const nv2SupCap = pref2 ? supCapacityMap.get(pref2.supervisorId) : null;
        const nv2IsFullFromR1 = nv2SupCap && (nv2SupCap.acceptedCount >= nv2SupCap.total);
        const isExplicitlySkippedToNv3 = registration.skipNV2Reason === 'nv2_full' || (registration.currentPrefRank === 3 && registration.isEarlyTransition);

        if ((nv2IsFullFromR1 || isExplicitlySkippedToNv3) && matchesSup(pref3)) {
          // Rule 3.5: NV3 supervisor sees this student in Round 2!
          const dec = allDecisions.find(d => matchesDecision(d, 3));
          candidates.push({
            ...registration,
            studentId,
            candidateRank: 3,
            isEarlyTransition: true,
            currentDecision: dec?.decision === 'selected' ? 'selected' : ''
          });
        } else if (!nv2IsFullFromR1 && !isExplicitlySkippedToNv3 && matchesSup(pref2)) {
          // Regular NV2 candidate
          const dec = allDecisions.find(d => matchesDecision(d, 2));
          candidates.push({
            ...registration,
            studentId,
            candidateRank: 2,
            isEarlyTransition: false,
            currentDecision: dec?.decision === 'selected' ? 'selected' : ''
          });
        }
      } else if (currentReviewRound === 3 || reviewStatus === 'round_3') {
        // Round 3: NV3 candidates
        if (matchesSup(pref3)) {
          const dec = allDecisions.find(d => matchesDecision(d, 3));
          candidates.push({
            ...registration,
            studentId,
            candidateRank: 3,
            isEarlyTransition: false,
            currentDecision: dec?.decision === 'selected' ? 'selected' : ''
          });
        }
      }
    });

    state.supervisorCandidates = candidates;
    const candidatesBadge = document.getElementById('sup-candidates-count-badge');
    if (candidatesBadge) candidatesBadge.textContent = candidates.length;

    // Filter Accepted Students across rounds for this supervisor
    const acceptedStudents = allRegistrations.filter(r => {
      const isAcceptedStatus = r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned';
      if (!isAcceptedStatus) return false;
      const accId = String(r.acceptedSupervisorId || '').trim();
      const accEmail = String(r.acceptedSupervisorEmail || r.supervisorEmail || '').toLowerCase().trim();
      return (accId && (accId === currentSup.id || accId === currentSup.supervisorId || (currentSup.identityIds && currentSup.identityIds.has(accId)))) ||
             (accEmail && (accEmail === emailLower || (currentSup.candidateEmails && currentSup.candidateEmails.has(accEmail))));
    });
    state.supervisorAcceptedStudents = acceptedStudents;

    // Build decisions map
    const decisionsMap = {};
    candidates.forEach(candidate => {
      if (candidate.currentDecision === 'selected') decisionsMap[candidate.studentId] = 'selected';
    });
    state.supervisorDecisions = decisionsMap;

    // Calculate quota
    const totalCapacity = typeof supData.capacity === 'number'
      ? supData.capacity
      : (typeof supData.maxQuota === 'number'
          ? supData.maxQuota
          : (typeof currentSup.capacity === 'number' ? currentSup.capacity : (currentSup.defaultQuota || 10)));
    const acceptedPrev = acceptedStudents.length || (supData.acceptedCount || 0);
    const selectedCurr = candidates.filter(c => decisionsMap[c.studentId] === 'selected').length;
    const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

    // Update Top Badges & Detailed Review Stats Grid
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('sup-stat-total-cap', totalCapacity);
    setVal('sup-stat-accepted-prev', acceptedPrev);
    setVal('sup-stat-selected-curr', selectedCurr);
    setVal('sup-stat-remaining-cap', remainingCap);

    setVal('sup-review-stat-total-cap', totalCapacity);
    setVal('sup-review-stat-accepted-prev', acceptedPrev);
    setVal('sup-review-stat-selected-curr', selectedCurr);
    setVal('sup-review-stat-remaining-cap', remainingCap);
    setVal('sup-review-stat-waiting', candidates.length);

    setVal('sup-accepted-count-badge', acceptedStudents.length);
    setVal('sup-total-accepted-text', `Tổng: ${acceptedStudents.length} SV`);

    // Render review UI
    renderSupervisorReviewUI(currentSup, currentReviewRound, reviewStatus, isLocked, isCompleted, remainingCap);
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
    if (rankBadge) rankBadge.textContent = 'PHÂN CÔNG TRỰC TIẾP';
    if (stateTag) stateTag.textContent = 'Khoa phân công trực tiếp';
    if (indicator) indicator.textContent = 'Khoa/Admin phân công GVHD trực tiếp; danh sách sinh viên đã được phân công hiển thị bên dưới.';
    if (actionBtns) actionBtns.innerHTML = '<span class="text-xs text-slate-400 italic">Không có bước xét nguyện vọng trong đợt này.</span>';
    const tbody = document.getElementById('sup-candidates-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400">Đợt này sử dụng phân công trực tiếp. Vui lòng xem danh sách sinh viên đã được phân công.</td></tr>';
    return;
  }

  if (rankBadge) rankBadge.textContent = `XÉT NGUYỆN VỌNG ${currentRound}`;

  if (isLocked) {
    if (stateTag) stateTag.textContent = `Đã chốt Vòng ${currentRound}`;
    if (indicator) indicator.textContent = `Trạng thái: Vòng ${currentRound} đã được Quản trị viên khóa cố định.`;
    if (actionBtns) actionBtns.innerHTML = '<span class="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold">🔒 Đã khóa danh sách</span>';
  } else if (isCompleted) {
    if (stateTag) stateTag.textContent = 'Đã hoàn thành lựa chọn';
    if (indicator) indicator.textContent = `Trạng thái: Thầy/Cô đã hoàn tất lựa chọn Vòng ${currentRound}. Bấm Mở lại nếu muốn chỉnh sửa trước khi Quản trị viên chốt vòng.`;
    if (actionBtns) actionBtns.innerHTML = `
      <button onclick="reopenSupervisorRound()" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5">
        <span>🔄 Mở lại để chỉnh sửa</span>
      </button>
    `;
  } else {
    if (stateTag) stateTag.textContent = `Đang mở xét Vòng ${currentRound}`;
    if (indicator) indicator.textContent = `Thầy/Cô chọn các sinh viên muốn nhận hướng dẫn trong chỉ tiêu. Bấm Xác nhận hoàn tất khi đã chọn xong.`;
    if (actionBtns) actionBtns.innerHTML = `
      <button onclick="openSupervisorConfirmModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5">
        <span>✓ Xác nhận hoàn tất Vòng ${currentRound}</span>
      </button>
    `;
  }

  // Render candidates table
  renderSupervisorCandidatesTable(isLocked);
}

function renderSupervisorCandidatesTable(readOnly) {
  const tbody = document.getElementById('sup-candidates-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('search-sup-candidates')?.value || '').toLowerCase().trim();
  const currentFilter = state.supervisorCandidateFilter || 'all';

  const allCandidates = state.supervisorCandidates || [];
  const selectedCountAll = allCandidates.filter(c => state.supervisorDecisions[c.studentId] === 'selected').length;
  const unselectedCountAll = allCandidates.length - selectedCountAll;

  // Update filter counter badges
  const setElText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setElText('sup-cand-cnt-all', allCandidates.length);
  setElText('sup-cand-cnt-selected', selectedCountAll);
  setElText('sup-cand-cnt-unselected', unselectedCountAll);

  const filtered = allCandidates.filter(c => {
    const isSelected = state.supervisorDecisions[c.studentId] === 'selected';
    if (currentFilter === 'selected' && !isSelected) return false;
    if (currentFilter === 'unselected' && isSelected) return false;

    if (!searchTerm) return true;
    return (
      (c.studentId || '').toLowerCase().includes(searchTerm) ||
      (c.studentName || '').toLowerCase().includes(searchTerm) ||
      (c.className || '').toLowerCase().includes(searchTerm) ||
      (c.topicTitle || '').toLowerCase().includes(searchTerm)
    );
  });

  if (filtered.length === 0) {
    const emptyMsg = searchTerm
      ? 'Không tìm thấy ứng viên nào phù hợp với từ khóa tìm kiếm.'
      : (currentFilter === 'selected'
        ? 'Chưa có ứng viên nào được chọn nhận trong đợt này.'
        : (currentFilter === 'unselected'
          ? 'Tất cả ứng viên trong danh sách đều đã được chọn nhận.'
          : 'Không có ứng viên nào đăng ký Thầy/Cô ở Nguyện vọng này (hoặc đã được nhận ở vòng trước).'));
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 font-medium">${emptyMsg}</td></tr>`;
    return;
  }

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase().trim();
  const currentSup = (typeof resolveSupervisorIdentity === 'function')
    ? resolveSupervisorIdentity(actor, state.roundSupervisors, state.supervisorsMaster)
    : (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));
  const totalCap = currentSup?.capacity ?? 10;
  const acceptedPrev = (state.supervisorAcceptedStudents || []).length || (currentSup?.acceptedCount || 0);
  const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
  const remainingCap = Math.max(0, totalCap - acceptedPrev - selectedCurr);

  tbody.innerHTML = filtered.map((c, idx) => {
    const isSelected = state.supervisorDecisions[c.studentId] === 'selected';
    const isLoading = Boolean(state.supervisorDecisionLoading && state.supervisorDecisionLoading[c.studentId]);
    const topicTitle = String(c.topicTitle || 'Chưa cập nhật tên đề tài');
    const topicDescription = String(c.topicDescription || 'Sinh viên chưa bổ sung mô tả định hướng thiết kế.');
    const isExpanded = Boolean(state.expandedDescriptions && state.expandedDescriptions[c.studentId]);
    const hasLongDesc = topicDescription.length > 120;

    let prefBadge = '';
    if (c.isEarlyTransition) {
      prefBadge = '<span class="mt-1.5 inline-flex px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-black">⚡ NV3 (Chuyển sớm - NV2 đầy)</span>';
    } else if (Number(c.candidateRank) === 1) {
      prefBadge = '<span class="mt-1.5 inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border-amber-200 border text-[10px] font-black">NV1</span>';
    } else if (Number(c.candidateRank) === 2) {
      prefBadge = '<span class="mt-1.5 inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border-blue-200 border text-[10px] font-black">NV2</span>';
    } else {
      prefBadge = '<span class="mt-1.5 inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border-indigo-200 border text-[10px] font-black">NV3</span>';
    }

    let actionBtn = '';
    if (isLoading) {
      actionBtn = `
        <div class="flex flex-col gap-1.5 items-center justify-center">
          <button disabled class="w-28 h-8 rounded-xl text-[11px] font-bold inline-flex items-center justify-center bg-slate-100 text-slate-500 border border-slate-300 cursor-wait">
            ⏳ Đang lưu...
          </button>
        </div>
      `;
    } else if (readOnly) {
      actionBtn = `
        <div class="flex flex-col gap-1.5 items-center justify-center">
          ${isSelected
            ? '<span class="w-28 h-8 rounded-xl text-[11px] font-bold inline-flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">✓ Đã chọn</span>'
            : '<span class="w-28 h-8 rounded-xl text-[11px] font-semibold inline-flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200">Chưa chọn</span>'}
        </div>
      `;
    } else {
      if (isSelected) {
        actionBtn = `
          <div class="flex flex-col gap-1.5 items-center justify-center">
            <span class="w-28 h-8 rounded-xl text-[11px] font-bold inline-flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">✓ Đã chọn</span>
            <button type="button" onclick="setSupervisorDecision('${c.studentId}', 'unselected')" class="w-28 h-8 rounded-xl text-[11px] font-bold inline-flex items-center justify-center bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 hover:border-rose-400 transition-all cursor-pointer shadow-2xs">✕ Bỏ chọn</button>
          </div>
        `;
      } else {
        if (remainingCap <= 0) {
          actionBtn = `
            <div class="flex flex-col gap-1.5 items-center justify-center">
              <button disabled class="w-28 h-8 rounded-xl text-[11px] font-bold inline-flex items-center justify-center bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" title="Đã hết chỉ tiêu (${totalCap} SV)">✓ Chọn nhận SV</button>
            </div>
          `;
        } else {
          actionBtn = `
            <div class="flex flex-col gap-1.5 items-center justify-center">
              <button type="button" onclick="setSupervisorDecision('${c.studentId}', 'selected')" class="w-28 h-8 rounded-xl text-[11px] font-bold inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer">✓ Chọn nhận SV</button>
            </div>
          `;
        }
      }
    }

    return `
      <tr class="border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/30' : (idx % 2 === 1 ? 'bg-slate-50/20' : 'bg-white')}">
        <td class="p-3.5 align-top font-mono font-bold text-slate-900">${c.studentId}</td>
        <td class="p-3.5 align-top">
          <span class="font-bold text-slate-900 block leading-tight">${escapeHtml(c.studentName || '--')}</span>
          <span class="text-[11px] text-slate-500 block mt-0.5">Lớp: ${escapeHtml(c.className || '--')}</span>
          ${prefBadge}
        </td>
        <td class="p-3.5 align-top">
          <p class="font-bold text-slate-900 leading-snug">${escapeHtml(topicTitle)}</p>
          <div class="mt-1.5 pt-1.5 border-t border-slate-100">
            <span class="text-[10px] font-black uppercase tracking-wider text-tdtu-blue block">Mô tả định hướng</span>
            <p class="mt-0.5 text-[11px] leading-relaxed text-slate-600 whitespace-pre-line text-justify ${!isExpanded && hasLongDesc ? 'line-clamp-3' : ''}">${escapeHtml(topicDescription)}</p>
            ${hasLongDesc ? `
              <button type="button" onclick="toggleSupervisorCandidateDesc('${c.studentId}')" class="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer inline-flex items-center gap-1">
                ${isExpanded ? 'Thu gọn ▲' : 'Xem thêm ▼'}
              </button>
            ` : ''}
          </div>
        </td>
        <td class="p-3.5 align-top text-slate-700 text-xs whitespace-normal break-words leading-relaxed">${escapeHtml(c.projectType || '--')}</td>
        <td class="p-3.5 align-top text-center">${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

window.setSupervisorCandidateFilter = function(filter) {
  state.supervisorCandidateFilter = filter;
  ['all', 'selected', 'unselected'].forEach(f => {
    const btn = document.getElementById(`sup-cand-flt-${f}`);
    if (!btn) return;
    if (f === filter) {
      if (f === 'selected') {
        btn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-700 text-white shadow-xs cursor-pointer transition-all';
      } else {
        btn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-900 text-white shadow-xs cursor-pointer transition-all';
      }
    } else {
      if (f === 'selected') {
        btn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-pointer transition-all';
      } else {
        btn.className = 'px-3 py-1.5 rounded-xl font-bold text-xs bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 cursor-pointer transition-all';
      }
    }
  });
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + (state.activeRound?.currentReviewRound || 1)]);
  renderSupervisorCandidatesTable(isLocked);
};

window.toggleSupervisorCandidateDesc = function(studentId) {
  state.expandedDescriptions = state.expandedDescriptions || {};
  state.expandedDescriptions[studentId] = !state.expandedDescriptions[studentId];
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + (state.activeRound?.currentReviewRound || 1)]);
  renderSupervisorCandidatesTable(isLocked);
};

window.filterSupervisorCandidates = function() {
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + (state.activeRound?.currentReviewRound || 1)]);
  renderSupervisorCandidatesTable(isLocked);
};

window.setSupervisorDecision = async function(studentId, nextDecision) {
  if (state.supervisorDecisionLoading?.[studentId]) return;
  if (!checkImpersonationWriteGuard('Thay đổi quyết định chọn sinh viên')) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const roundId = state.selectedRoundId;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase().trim();
  const currentSup = (typeof resolveSupervisorIdentity === 'function')
    ? resolveSupervisorIdentity(actor, state.roundSupervisors, state.supervisorsMaster)
    : (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));

  if (!roundId || !currentSup) return;

  const candidate = (state.supervisorCandidates || []).find(item => String(item.studentId) === String(studentId));
  const decisionRank = Number(candidate?.candidateRank || state.activeRound?.currentReviewRound || 1);

  // If selecting, check remaining quota
  if (nextDecision === 'selected') {
    const totalCap = currentSup.capacity ?? 10;
    const acceptedPrev = (state.supervisorAcceptedStudents || []).length || (currentSup?.acceptedCount || 0);
    const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
    const remaining = totalCap - acceptedPrev - selectedCurr;

    if (remaining <= 0) {
      showToast(`Thầy/Cô đã đạt giới hạn chỉ tiêu (${totalCap} SV). Vui lòng bỏ chọn sinh viên khác trước khi chọn thêm.`, 'info');
      return;
    }
    state.supervisorDecisions[studentId] = 'selected';
  } else {
    delete state.supervisorDecisions[studentId];
  }

  // Set loading state for this candidate
  state.supervisorDecisionLoading = state.supervisorDecisionLoading || {};
  state.supervisorDecisionLoading[studentId] = true;

  // Update local state immediately for snappy UI
  renderSupervisorCandidatesTable(false);

  // Recalculate and update stats badges
  const totalCapacity = currentSup.capacity ?? 10;
  const acceptedPrev = (state.supervisorAcceptedStudents || []).length || (currentSup?.acceptedCount || 0);
  const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
  const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setVal('sup-stat-selected-curr', selectedCurr);
  setVal('sup-stat-remaining-cap', remainingCap);
  setVal('sup-review-stat-selected-curr', selectedCurr);
  setVal('sup-review-stat-remaining-cap', remainingCap);

  // Update hero stat if in preference review phase
  const isAssignmentPublished = typeof isSupervisorRoundAssignmentPublished === 'function' ? isSupervisorRoundAssignmentPublished(state.activeRound) : false;
  if (!isAssignmentPublished) {
    setVal('sup-stat-assigned-total', selectedCurr);
  }

  // Persist decision to Firestore
  try {
    const decId = `r${decisionRank}_${studentId}_${currentSup.id}`;
    if (nextDecision === 'selected') {
      await setDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', decId), {
        round: decisionRank,
        studentId,
        supervisorId: currentSup.id,
        supervisorEmail: emailLower,
        decision: 'selected',
        decidedAt: serverTimestamp(),
        decidedBy: emailLower
      }, { merge: true });
      showToast(`Đã chọn nhận sinh viên ${studentId} ở NV${decisionRank}.`, 'success');
    } else {
      await deleteDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', decId)).catch(async () => {
        await setDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', decId), {
          round: decisionRank,
          studentId,
          supervisorId: currentSup.id,
          supervisorEmail: emailLower,
          decision: 'unselected',
          decidedAt: serverTimestamp(),
          decidedBy: emailLower
        }, { merge: true });
      });
      showToast(`Đã bỏ chọn sinh viên ${studentId}.`, 'info');
    }
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    console.error('Error saving review decision:', err);
    showToast('Lỗi lưu quyết định: ' + err.message, 'error');
  } finally {
    state.supervisorDecisionLoading[studentId] = false;
    renderSupervisorCandidatesTable(false);
  }
};

window.toggleSupervisorDecision = function(studentId) {
  const currentDecision = state.supervisorDecisions[studentId];
  return window.setSupervisorDecision(studentId, currentDecision === 'selected' ? 'unselected' : 'selected');
};

window.openSupervisorConfirmModal = function() {
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase().trim();
  const currentSup = (typeof resolveSupervisorIdentity === 'function')
    ? resolveSupervisorIdentity(actor, state.roundSupervisors, state.supervisorsMaster)
    : (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));
  const totalCap = currentSup?.capacity ?? 10;
  const acceptedPrev = (state.supervisorAcceptedStudents || []).length || (currentSup?.acceptedCount || 0);
  const selectedCount = Object.values(state.supervisorDecisions || {}).filter(v => v === 'selected').length;
  const remCount = Math.max(0, totalCap - acceptedPrev - selectedCount);

  const titleEl = document.getElementById('modal-sup-confirm-round-title');
  if (titleEl) titleEl.textContent = `Xét duyệt Nguyện vọng ${currentRound}`;
  const selEl = document.getElementById('modal-sup-selected-count');
  if (selEl) selEl.textContent = `${selectedCount} SV`;
  const remEl = document.getElementById('modal-sup-rem-count');
  if (remEl) remEl.textContent = `${remCount} SV`;
  const totalEl = document.getElementById('modal-sup-total-cap');
  if (totalEl) totalEl.textContent = `${totalCap} SV`;

  document.getElementById('modal-supervisor-confirm')?.classList.remove('hidden');
};

window.closeSupervisorConfirmModal = function() {
  document.getElementById('modal-supervisor-confirm')?.classList.add('hidden');
};

window.confirmSupervisorRoundCompletion = async function() {
  if (!checkImpersonationWriteGuard('Xác nhận hoàn thành vòng chọn sinh viên')) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const emailLower = (actor?.email || state.user?.email || '').toLowerCase().trim();
  const currentSup = (typeof resolveSupervisorIdentity === 'function')
    ? resolveSupervisorIdentity(actor, state.roundSupervisors, state.supervisorsMaster)
    : (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));

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

  const emailLower = (actor?.email || state.user?.email || '').toLowerCase().trim();
  const currentSup = (typeof resolveSupervisorIdentity === 'function')
    ? resolveSupervisorIdentity(actor, state.roundSupervisors, state.supervisorsMaster)
    : (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower || (actor?.uid && (s.id === actor.uid || s.supervisorId === actor.uid)));
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
  const isDirect = typeof isDirectSupervisorAssignment === 'function' ? isDirectSupervisorAssignment(state.activeRound) : false;
  const isAssignmentPublished = typeof isSupervisorRoundAssignmentPublished === 'function' ? isSupervisorRoundAssignmentPublished(state.activeRound) : true;

  if (!isAssignmentPublished && (tabKey === 'assigned' || tabKey === 'accepted')) {
    tabKey = 'review';
  }

  state.supervisorTab = tabKey;
  state.currentSupervisorTab = tabKey;

  const btnAssigned = document.getElementById('sup-tab-btn-assigned');
  const btnReview = document.getElementById('sup-tab-btn-review');
  const btnAccepted = document.getElementById('sup-tab-btn-accepted');
  const btnPrelim = document.getElementById('sup-tab-btn-preliminary');
  const btnReviewer = document.getElementById('sup-tab-btn-reviewer');

  const panelAssigned = document.getElementById('sup-panel-assigned');
  const panelReview = document.getElementById('sup-panel-review');
  const panelAccepted = document.getElementById('sup-panel-accepted');
  const panelPrelim = document.getElementById('sup-panel-preliminary');
  const panelReviewer = document.getElementById('sup-panel-reviewer');

  const allBtns = [
    { btn: btnAssigned, panel: panelAssigned, key: 'assigned', activeCls: 'bg-tdtu-blue text-white' },
    { btn: btnReview, panel: panelReview, key: 'review', activeCls: 'bg-slate-900 text-white' },
    { btn: btnAccepted, panel: panelAccepted, key: 'accepted', activeCls: 'bg-emerald-600 text-white' },
    { btn: btnPrelim, panel: panelPrelim, key: 'preliminary', activeCls: 'bg-amber-600 text-white' },
    { btn: btnReviewer, panel: panelReviewer, key: 'reviewer', activeCls: 'bg-blue-600 text-white' }
  ];

  allBtns.forEach(item => {
    if (!item.btn || !item.panel) return;
    if (!isAssignmentPublished && (item.key === 'assigned' || item.key === 'accepted')) {
      item.btn.classList.add('hidden');
      item.panel.classList.add('hidden');
      return;
    }
    if (item.key === 'accepted') {
      item.btn.classList.add('hidden');
      item.panel.classList.add('hidden');
      return;
    }
    if (isDirect && (item.key === 'review' || item.key === 'accepted')) {
      item.btn.classList.add('hidden');
      item.panel.classList.add('hidden');
      return;
    }
    if (item.key === tabKey) {
      item.btn.className = `px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${item.activeCls}`;
      item.panel.classList.remove('hidden');
    } else {
      item.btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
      item.panel.classList.add('hidden');
    }
  });

  if (tabKey === 'accepted' && typeof renderSupervisorAcceptedTable === 'function') renderSupervisorAcceptedTable();
  else if (tabKey === 'assigned' && typeof renderSupervisorAssignedStudents === 'function') renderSupervisorAssignedStudents();
  else if (tabKey === 'preliminary' && typeof renderSupervisorPreliminaryList === 'function') renderSupervisorPreliminaryList();
  else if (tabKey === 'reviewer' && typeof renderSupervisorReviewerList === 'function') renderSupervisorReviewerList();
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

window.switchAdminTab = async function(tabKey) {
  // Guard Owner-only tabs (Chỉ Owner mới được truy cập Quản lý Admin và Cài đặt hệ thống)
  if ((tabKey === 'admin-management' || tabKey === 'system-settings') && !state.realIsOwner) {
    if (typeof showToast === 'function') {
      showToast('Từ chối truy cập: Chức năng này chỉ dành riêng cho Chủ sở hữu hệ thống (Owner).', 'error', 4000);
    }
    tabKey = 'rounds';
  }

  state.currentAdminTab = tabKey;

  // 1. Always bind currentRoundId to state.selectedRoundId
  if (!state.selectedRoundId && state.rounds && state.rounds.length > 0) {
    state.selectedRoundId = state.rounds[0].id;
  }

  // 2. Active button styling in clean sidebar
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('bg-slate-900', 'text-white', 'shadow-xs', 'font-bold');
    b.classList.add('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-semibold');
  });

  const activeBtn = document.getElementById('atab-btn-' + tabKey);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-medium');
    activeBtn.classList.add('bg-slate-900', 'text-white', 'shadow-xs', 'font-bold');
  }

  // 3. Tab panels toggle
  ['overview', 'review', 'rounds', 'faculty-students', 'supervisors-master', 'round-supervisors', 'eligible-students', 'project-types', 'registrations', 'preview-student', 'trash', 'timeline', 'scoring-dashboard', 'system-settings', 'admin-management', 'councils'].forEach(t => {
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
  else if (tabKey === 'review') { if (roundId) await loadAdminReviewData(roundId); }
  else if (tabKey === 'rounds') {
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    renderAdminRoundsTable();
  }
  else if (tabKey === 'supervisors-master') await loadAdminSupervisorsMaster();
  else if (tabKey === 'round-supervisors' && roundId) await loadAdminRoundSupervisors(roundId);
  else if (tabKey === 'eligible-students' && roundId) {
    const sel = document.getElementById('admin-round-student-select');
    if (sel && sel.value !== roundId) sel.value = roundId;
    await loadAdminEligibleStudents(roundId);
  }
  else if (tabKey === 'registrations' && roundId) await loadAdminRegistrations(roundId);
  else if (tabKey === 'preview-student') preparePreviewStudentDropdown();
  else if (tabKey === 'trash') renderAdminTrashTable();
  else if (tabKey === 'scoring-dashboard') loadAdminScoringDashboard();
  else if (tabKey === 'system-settings') loadAdminSystemSettings();
  else if (tabKey === 'admin-management') {
    if (typeof window.loadAdminsList === 'function') await window.loadAdminsList();
  }
  else if (tabKey === 'councils' && roundId) {
    if (typeof window.loadAdminRoundCouncils === 'function') await window.loadAdminRoundCouncils(roundId);
  }
  else if (tabKey === 'timeline') {
    if (roundId) {
      const sel = document.getElementById('admin-timeline-round-select');
      if (sel) sel.value = roundId;
      await loadAdminRoundActivities(roundId);
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
  if (typeof loadAdminStats !== 'undefined') window.loadAdminStats = loadAdminStats;
  if (typeof switchAdminTab !== 'undefined') window.switchAdminTab = switchAdminTab;
  if (typeof loadSupervisorReviewData !== 'undefined') window.loadSupervisorReviewData = loadSupervisorReviewData;
  if (typeof renderSupervisorReviewCards !== 'undefined') window.renderSupervisorReviewCards = renderSupervisorReviewCards;
  if (typeof renderSupervisorCandidatesTable !== 'undefined') window.renderSupervisorCandidatesTable = renderSupervisorCandidatesTable;
  if (typeof renderSupervisorReviewUI !== 'undefined') window.renderSupervisorReviewUI = renderSupervisorReviewUI;
  if (typeof acceptCandidate !== 'undefined') window.acceptCandidate = acceptCandidate;
  if (typeof rejectCandidate !== 'undefined') window.rejectCandidate = rejectCandidate;
  if (typeof undoCandidateDecision !== 'undefined') window.undoCandidateDecision = undoCandidateDecision;
  if (typeof submitSupervisorReviewBatch !== 'undefined') window.submitSupervisorReviewBatch = submitSupervisorReviewBatch;
}

if (typeof window !== 'undefined') {
  window.loadRoundSupervisors = loadRoundSupervisors;
  window.renderSupervisorsGrid = renderSupervisorsGrid;
  window.getAdminAssignmentRows = getAdminAssignmentRows;
  window.normalizeOfficialAssignment = normalizeOfficialAssignment;
  window.isAssignmentEditingLocked = isAssignmentEditingLocked;
  window.ensureAssignmentEditingAllowed = ensureAssignmentEditingAllowed;
  window.getSupervisorAssignmentCount = getSupervisorAssignmentCount;
}
