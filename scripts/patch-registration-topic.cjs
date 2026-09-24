const fs = require('fs');

let s = fs.readFileSync('js/students/registration.js', 'utf8');

const functionsCode = `
// ============================================================================
// STUDENT EDIT TOPIC TITLE & RESUBMIT FOR SUPERVISOR REVIEW
// ============================================================================

window.openEditTopicTitleModal = function() {
  const modal = document.getElementById('modal-student-edit-topic');
  if (!modal) return;

  const reg = state.myRegistration;
  if (!reg) {
    showToast('Chưa tìm thấy thông tin đăng ký để chỉnh sửa.', 'warning');
    return;
  }

  const currentTitle = reg.topicTitle || reg.topic || reg.proposalTitle || '';
  const currentVersion = Number(reg.topicTitleVersion || 1);
  const nextVersion = currentVersion + 1;

  const inputEl = document.getElementById('input-edit-topic-title');
  if (inputEl) {
    inputEl.value = currentTitle;
    inputEl.focus();
  }

  const curVerEl = document.getElementById('edit-topic-current-version');
  if (curVerEl) curVerEl.textContent = \`Lần \${currentVersion}\`;

  const nextVerEl = document.getElementById('edit-topic-next-version');
  if (nextVerEl) nextVerEl.textContent = \`Lần \${nextVersion}\`;

  modal.classList.remove('hidden');
};

window.closeEditTopicTitleModal = function() {
  const modal = document.getElementById('modal-student-edit-topic');
  if (modal) modal.classList.add('hidden');
};

window.submitUpdatedTopicTitle = async function() {
  if (!checkImpersonationWriteGuard('Chỉnh sửa tên đề tài')) return;

  const reg = state.myRegistration;
  const roundId = state.selectedRoundId || state.activeRound?.id;
  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const mssv = state.isPreviewMode ? state.previewMssv : (actor?.studentMssv || state.studentMssv);

  if (!reg || !roundId || !mssv) {
    showToast('Không xác định được đợt hoặc thông tin sinh viên.', 'error');
    return;
  }

  const inputEl = document.getElementById('input-edit-topic-title');
  const newTitle = (inputEl?.value || '').trim();

  if (!newTitle) {
    showToast('Vui lòng nhập tên đề tài mới.', 'warning');
    inputEl?.focus();
    return;
  }

  if (!newTitle.toLowerCase().startsWith('thiết kế nội thất')) {
    showToast('Tên đề tài BẮT BUỘC phải bắt đầu bằng cụm từ "Thiết kế nội thất".', 'error');
    inputEl?.focus();
    return;
  }

  if (newTitle.length < 10) {
    showToast('Tên đề tài quá ngắn. Vui lòng nhập đầy đủ tên đề tài.', 'warning');
    inputEl?.focus();
    return;
  }

  if (newTitle === (reg.topicTitle || '').trim()) {
    showToast('Tên đề tài chưa có thay đổi so với hiện tại.', 'info');
    return;
  }

  const btn = document.getElementById('btn-submit-edit-topic');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang gửi...</span>';
  }

  try {
    const currentVersion = Number(reg.topicTitleVersion || 1);
    const previousHistory = Array.isArray(reg.topicTitleHistory) ? reg.topicTitleHistory : [];
    const nextVersion = Math.max(currentVersion + 1, previousHistory.length + 1);

    const historyEntry = {
      version: nextVersion,
      title: newTitle,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    const topicTitleHistory = previousHistory.concat([historyEntry]);

    const updatePayload = {
      topicTitle: newTitle,
      topicTitleVersion: nextVersion,
      topicTitleHistory: topicTitleHistory,
      topicApprovalStatus: 'pending',
      topicApprovalNote: '',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.email || state.user?.email || mssv
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv), updatePayload);

    // Cập nhật state cục bộ để UI phản ánh tức thì
    state.myRegistration = {
      ...reg,
      ...updatePayload,
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    // Re-render hero topic card & timeline
    if (typeof renderRoundHeader === 'function' && state.activeRound) {
      renderRoundHeader(state.activeRound);
    }
    if (typeof renderStudentTimelineWeeks === 'function') {
      renderStudentTimelineWeeks();
    }

    closeEditTopicTitleModal();
    showToast(\`🎉 Đã cập nhật tên đề tài (Lần \${nextVersion}) và chuyển GVHD duyệt lại!\`, 'success');
  } catch (err) {
    console.error('Lỗi khi cập nhật tên đề tài:', err);
    showToast('Lỗi cập nhật tên đề tài: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀 Gửi GVHD duyệt lại</span>';
    }
  }
};
`;

const normS = s.replace(/\r\n/g, '\n');
const bridgeMarker = '// --- SUBMODULE WINDOW BRIDGE ---';
let baseContent = normS;
if (baseContent.includes(bridgeMarker)) {
  baseContent = baseContent.substring(0, baseContent.indexOf(bridgeMarker)).trimEnd();
}

const updatedContent = `${baseContent}\n${functionsCode}\n\n${bridgeMarker}\nif (typeof window !== 'undefined') {\n  if (typeof openEditTopicTitleModal !== 'undefined') window.openEditTopicTitleModal = openEditTopicTitleModal;\n  if (typeof closeEditTopicTitleModal !== 'undefined') window.closeEditTopicTitleModal = closeEditTopicTitleModal;\n  if (typeof submitUpdatedTopicTitle !== 'undefined') window.submitUpdatedTopicTitle = submitUpdatedTopicTitle;\n}\n`;

fs.writeFileSync('js/students/registration.js', updatedContent, 'utf8');
console.log('Successfully updated registration.js with edit topic modal functions.');
