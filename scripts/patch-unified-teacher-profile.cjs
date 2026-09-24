const fs = require('fs');

// 1. Update assignments.js
let assignCode = fs.readFileSync('js/supervisors/assignments.js', 'utf8');

const updatedTeacherModalFunc = `// --- UNIFIED TEACHER / SUPERVISOR PROFILE & BIO MODAL ---
window.openTeacherProfileModal = function(supId = null) {
  const modal = document.getElementById('modal-teacher-profile');
  if (!modal) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const isSelf = !supId || (actor?.email && (supId === actor.email || supId === actor.id));
  const isSupervisorSelf = isSelf && (state.currentRole === 'supervisor');

  let sup = null;
  if (supId) {
    sup = (state.roundSupervisors || []).find(s => s.id === supId || s.email === supId) ||
          (state.supervisorsMaster || []).find(s => s.id === supId || s.email === supId);
  }
  
  if (!sup && isSelf) {
    sup = {
      name: actor?.displayName || state.supervisorName || actor?.email || 'Giảng viên',
      email: actor?.email || state.supervisorEmail || '',
      department: 'Khoa Mỹ thuật Công nghiệp',
      degree: 'Thạc sĩ',
      expertise: state.supervisorExpertise || 'Đồ án Tốt nghiệp & Nghiên cứu ứng dụng',
      bio: state.supervisorBio || 'Thông tin giảng viên hướng dẫn.',
      photoUrl: actor?.photoURL || ''
    };
  }

  if (!sup) {
    showToast('Không tìm thấy thông tin giảng viên.', 'warning');
    return;
  }

  const nameEl = document.getElementById('teacher-profile-name');
  if (nameEl) nameEl.textContent = sup.name || sup.displayName || '--';

  const deptEl = document.getElementById('teacher-profile-dept');
  if (deptEl) deptEl.textContent = sup.department || 'Khoa Mỹ thuật Công nghiệp • TDTU';

  const degreeBadge = document.getElementById('teacher-profile-degree-badge');
  if (degreeBadge) degreeBadge.textContent = sup.degree || 'Giảng viên';

  const expEl = document.getElementById('teacher-profile-expertise');
  if (expEl) expEl.textContent = sup.bio || sup.expertise || 'Chưa có thông tin giới thiệu.';

  const emailEl = document.getElementById('teacher-profile-email');
  if (emailEl) {
    emailEl.textContent = sup.email || '--';
    emailEl.href = sup.email ? 'mailto:' + sup.email : '#';
  }

  const phoneWrap = document.getElementById('teacher-profile-phone-wrap');
  const phoneEl = document.getElementById('teacher-profile-phone');
  if (phoneWrap && phoneEl) {
    if (sup.phone) {
      phoneWrap.classList.remove('hidden');
      phoneEl.textContent = sup.phone;
      phoneEl.href = 'tel:' + sup.phone;
    } else {
      phoneWrap.classList.add('hidden');
    }
  }

  const quotaWrap = document.getElementById('teacher-profile-quota-wrap');
  const quotaEl = document.getElementById('teacher-profile-quota');
  if (quotaWrap && quotaEl) {
    if (sup.quota !== undefined && (state.isAdmin || state.currentRole === 'supervisor')) {
      quotaWrap.classList.remove('hidden');
      quotaEl.textContent = \`\${sup.currentAssigned || 0} / \${sup.quota} sinh viên\`;
    } else {
      quotaWrap.classList.add('hidden');
    }
  }

  const photoEl = document.getElementById('teacher-profile-photo');
  if (photoEl) {
    const fallback = (typeof getSupervisorAvatarSvgDataUri === 'function') ? getSupervisorAvatarSvgDataUri(sup.name || 'GV') : '';
    photoEl.src = sup.photoUrl || fallback;
    photoEl.onerror = function() {
      this.onerror = null;
      this.src = fallback;
    };
  }

  const logoutBtn = document.getElementById('btn-teacher-profile-logout');
  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', !isSupervisorSelf);
  }

  const adminEditBtn = document.getElementById('btn-teacher-profile-admin-edit');
  if (adminEditBtn) {
    adminEditBtn.classList.toggle('hidden', !state.isAdmin);
    if (state.isAdmin && sup.id) {
      adminEditBtn.onclick = () => {
        closeTeacherProfileModal();
        if (typeof openAdminEditSupervisorModal === 'function') {
          openAdminEditSupervisorModal(sup.id);
        }
      };
    }
  }

  modal.classList.remove('hidden');
};

window.closeTeacherProfileModal = function() {
  const modal = document.getElementById('modal-teacher-profile');
  if (modal) modal.classList.add('hidden');
};

window.openBioModal = function(supId) {
  window.openTeacherProfileModal(supId);
};

window.closeBioModal = function() {
  window.closeTeacherProfileModal();
};`;

const sIdx = assignCode.indexOf('// --- SUPERVISOR BIO MODAL ---');
const eIdx = assignCode.indexOf('window.closeBioModal = function() {');

if (sIdx !== -1 && eIdx !== -1) {
  const endClose = assignCode.indexOf('};', eIdx);
  assignCode = assignCode.substring(0, sIdx) + updatedTeacherModalFunc + '\n\n' + assignCode.substring(endClose + 2);
  fs.writeFileSync('js/supervisors/assignments.js', assignCode, 'utf8');
  console.log('assignments.js patched successfully!');
} else {
  console.error('Marker not found in assignments.js');
}

// 2. Remove obsolete modal-sup-bio.html if exists
if (fs.existsSync('templates/modals/supervisors/modal-sup-bio.html')) {
  fs.unlinkSync('templates/modals/supervisors/modal-sup-bio.html');
  console.log('Deleted obsolete modal-sup-bio.html');
}
