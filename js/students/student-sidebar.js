
// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
/**
 * IFA+ Graduation — Student Personal Sidebar & Profile Modal
 */
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

if (typeof window !== "undefined" && typeof updateStudentPersonalSidebar !== "undefined") { window.updateStudentPersonalSidebar = updateStudentPersonalSidebar; }
