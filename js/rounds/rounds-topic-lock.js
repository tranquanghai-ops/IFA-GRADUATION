/**
 * IFA+ Graduation — Round Topic Revision Lock Subsystem
 * Allows Admin to lock / unlock topic title and description revisions for a graduation round.
 * When locked ("Hết thời gian đổi tên đề tài"), students can only view and print their form.
 */

window.isRoundTopicRevisionLocked = function(roundOrId) {
  if (!roundOrId) return false;
  let round = null;
  if (typeof roundOrId === 'object') {
    round = roundOrId;
  } else {
    round = (state.rounds || []).find(r => r.id === roundOrId) ||
            (state.activeRound?.id === roundOrId ? state.activeRound : null);
  }
  return Boolean(round?.allowTopicRevision === false || round?.topicRevisionLocked === true);
};

window.updateAdminRoundTopicRevisionToolbar = function(optRoundId) {
  const roundId = optRoundId || document.getElementById('admin-round-student-select')?.value || state.selectedRoundId || state.activeRound?.id;
  const badgeEl = document.getElementById('admin-topic-revision-badge');
  const btnEl = document.getElementById('btn-admin-toggle-topic-revision');
  if (!badgeEl || !btnEl) return;

  if (!roundId) {
    badgeEl.className = 'hidden';
    btnEl.className = 'hidden';
    return;
  }

  const round = (state.rounds || []).find(r => r.id === roundId) || (state.activeRound?.id === roundId ? state.activeRound : null);
  const isLocked = window.isRoundTopicRevisionLocked(round);

  btnEl.disabled = false;
  if (!isLocked) {
    // Round is currently OPEN for topic revision
    badgeEl.className = 'px-2.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 border shadow-2xs bg-emerald-100 text-emerald-800 border-emerald-300';
    badgeEl.innerHTML = '<span>📝 Đang mở đổi đề tài</span>';
    badgeEl.title = 'Sinh viên có quyền chỉnh sửa tên đề tài & mô tả nhiều lần cho đến khi hết hạn';

    btnEl.className = 'cursor-pointer px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1';
    btnEl.innerHTML = '<span>🔒 Hết thời gian đổi đề tài</span>';
    btnEl.title = 'Bấm để khóa thời gian đổi tên đề tài của sinh viên trong đợt này';
  } else {
    // Round is LOCKED (deadline passed)
    badgeEl.className = 'px-2.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1 border shadow-2xs bg-rose-100 text-rose-800 border-rose-300';
    badgeEl.innerHTML = '<span>🔒 Đã hết hạn đổi đề tài</span>';
    badgeEl.title = 'Đợt đã hết hạn đổi tên đề tài – Sinh viên chỉ có thể xem lại thông tin';

    btnEl.className = 'cursor-pointer px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1';
    btnEl.innerHTML = '<span>🔓 Mở lại đổi đề tài</span>';
    btnEl.title = 'Bấm để mở lại thời gian đổi tên đề tài cho sinh viên';
  }
};

window.adminToggleRoundTopicRevision = async function(optRoundId) {
  if (typeof checkImpersonationWriteGuard === 'function' && !checkImpersonationWriteGuard('Khóa/mở thời gian đổi tên đề tài')) return;

  const roundId = optRoundId || document.getElementById('admin-round-student-select')?.value || state.selectedRoundId || state.activeRound?.id;
  if (!roundId) {
    if (typeof showToast === 'function') showToast('Vui lòng chọn đợt tốt nghiệp trước khi thực hiện thao tác.', 'warning');
    return;
  }

  let round = (state.rounds || []).find(r => r.id === roundId) || (state.activeRound?.id === roundId ? state.activeRound : null);
  if (!round) {
    try {
      const snap = await getDoc(doc(db, 'graduationRounds', roundId));
      if (snap.exists()) {
        round = { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.warn('[TopicLock] Fetch round notice:', e);
    }
  }

  if (!round) {
    if (typeof showToast === 'function') showToast('Không tìm thấy thông tin đợt tốt nghiệp.', 'error');
    return;
  }

  const isCurrentlyLocked = window.isRoundTopicRevisionLocked(round);
  const targetLocked = !isCurrentlyLocked;

  if (targetLocked) {
    // Confirm locking
    const confirmed = (typeof window.showConfirm === 'function')
      ? await window.showConfirm(
          'Khóa thời gian đổi tên đề tài?',
          'Sau khi bấm hết thời gian, sinh viên thuộc đợt này sẽ bị khóa chức năng đổi tên đề tài và mô tả định hướng thiết kế. Sinh viên chỉ có thể xem lại thông tin hiện có và in phiếu đăng ký.',
          {
            confirmText: 'Khóa đổi đề tài',
            cancelText: 'Hủy',
            danger: true
          }
        )
      : confirm('Khóa thời gian đổi tên đề tài?\nSau khi bấm hết thời gian, sinh viên thuộc đợt này sẽ bị khóa chức năng đổi tên đề tài và mô tả định hướng thiết kế. Sinh viên chỉ có thể xem lại thông tin hiện có và in phiếu đăng ký.');

    if (!confirmed) return;
  } else {
    // Confirm reopening
    const confirmed = (typeof window.showConfirm === 'function')
      ? await window.showConfirm(
          'Mở lại thời gian đổi tên đề tài?',
          'Sinh viên trong đợt sẽ có thể tiếp tục chỉnh sửa tên đề tài và mô tả định hướng thiết kế để gửi GVHD duyệt lại.',
          {
            confirmText: 'Mở lại đổi đề tài',
            cancelText: 'Hủy',
            danger: false
          }
        )
      : confirm('Mở lại thời gian đổi tên đề tài?\nSinh viên trong đợt sẽ có thể tiếp tục chỉnh sửa tên đề tài và mô tả định hướng thiết kế để gửi GVHD duyệt lại.');

    if (!confirmed) return;
  }

  const btnEl = document.getElementById('btn-admin-toggle-topic-revision');
  const originalHtml = btnEl ? btnEl.innerHTML : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  try {
    const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
    const actorEmail = actor?.email || state.user?.email || 'admin';
    const updatePayload = {
      allowTopicRevision: !targetLocked,
      topicRevisionLocked: targetLocked,
      updatedAt: serverTimestamp()
    };
    if (targetLocked) {
      updatePayload.topicRevisionLockedAt = serverTimestamp();
      updatePayload.topicRevisionLockedBy = actorEmail;
    } else {
      updatePayload.topicRevisionUnlockedAt = serverTimestamp();
      updatePayload.topicRevisionUnlockedBy = actorEmail;
    }

    await updateDoc(doc(db, 'graduationRounds', roundId), updatePayload);

    // Update in-memory round data
    const inList = (state.rounds || []).find(r => r.id === roundId);
    if (inList) {
      inList.allowTopicRevision = !targetLocked;
      inList.topicRevisionLocked = targetLocked;
    }
    if (state.activeRound && state.activeRound.id === roundId) {
      state.activeRound.allowTopicRevision = !targetLocked;
      state.activeRound.topicRevisionLocked = targetLocked;
    }

    window.updateAdminRoundTopicRevisionToolbar(roundId);

    // If student topic hero is rendered, refresh it
    if (state.myRegistration && (typeof renderStudentTopicHero === 'function')) {
      renderStudentTopicHero(state.myRegistration, state.activeRound);
    }

    if (typeof showToast === 'function') {
      showToast(
        targetLocked
          ? '🔒 Đã hết thời gian đổi tên đề tài. Sinh viên đã bị khóa quyền chỉnh sửa.'
          : '🔓 Đã mở lại thời gian đổi tên đề tài cho sinh viên.',
        'success'
      );
    }
  } catch (err) {
    console.error('[TopicLock] Error toggling topic revision lock:', err);
    if (typeof showToast === 'function') {
      showToast('Lỗi khi cập nhật trạng thái: ' + (err.message || err), 'error');
    }
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalHtml;
    }
    window.updateAdminRoundTopicRevisionToolbar(roundId);
  }
};
