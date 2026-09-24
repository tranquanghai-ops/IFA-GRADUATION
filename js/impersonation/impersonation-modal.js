/**
 * IFA+ Graduation — Admin Impersonate Modal & Candidate Search
 */
export async function gatherRoundCandidates(roundFilter = 'all', roleFilter = 'all', searchQuery = '') {
  const candidates = [];
  const candidateKeys = new Set();
  const candidatesByKey = new Map();

  function addCandidate(cand) {
    const key = `${cand.type}_${cand.email || cand.id || cand.mssv}_${cand.roundId || ''}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(cand);
      candidatesByKey.set(key, cand);
    } else if (cand.type === 'student' && cand.registrationStatus === 'Đã đăng ký') {
      Object.assign(candidatesByKey.get(key), cand);
    }
  }

  // 1. SUPERVISORS (from state.supervisorsMaster and rounds)
  if (roleFilter === 'all' || roleFilter === 'supervisor') {
    let sups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
      ? state.supervisorsMaster
      : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);
    if (roundFilter !== 'all') {
      try {
        const roundSupervisorSnap = await getDocs(collection(db, 'graduationRounds', roundFilter, 'supervisors'));
        sups = roundSupervisorSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (error) {
        console.warn('[ActAs] Không thể tải GVHD của đợt:', error.message);
      }
    }
    
    const selRound = roundFilter !== 'all' ? (state.rounds || []).find(r => r.id === roundFilter) : null;

    sups.forEach(s => {
      if (s.active !== false && s.email) {
        addCandidate({
          type: 'supervisor',
          id: s.id || s.email,
          name: s.name || s.displayName || s.email,
          email: s.email,
          code: s.code || s.lecturerCode || '',
          department: s.department || '',
          roundId: (roundFilter !== 'all' ? roundFilter : ''),
          roundTitle: selRound ? (selRound.title || selRound.roundName || selRound.id) : '',
          roundShortCode: selRound?.shortCode || '',
          roundAcademicYear: selRound?.academicYear || '',
          roleLabel: 'Giảng viên hướng dẫn (GVHD)'
        });
      }
    });
  }

  // 2. STUDENTS (from registrations and eligible students in rounds)
  if (roleFilter === 'all' || roleFilter === 'student') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []).filter(r => !r.deleted);

    for (const r of targetRounds) {
      // In-memory registrations
      const regs = r.registrations || (state.adminReviewData?.registrations && state.selectedRoundId === r.id ? state.adminReviewData.registrations : []);
      regs.forEach(st => {
        const sid = st.mssv || st.studentId;
        if (sid) {
          addCandidate({
            type: 'student',
            id: sid,
            mssv: sid,
            name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
            email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roundShortCode: r.shortCode || '',
            roundAcademicYear: r.academicYear || '',
            topicTitle: st.topicTitle || '',
            registrationStatus: 'Đã đăng ký',
            roleLabel: 'Sinh viên'
          });
        }
      });

      // Eligible students if any
      const eligible = r.eligibleStudents || [];
      eligible.forEach(st => {
        const sid = st.mssv || st.studentId;
        if (sid) {
          addCandidate({
            type: 'student',
            id: sid,
            mssv: sid,
            name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
            email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roundShortCode: r.shortCode || '',
            roundAcademicYear: r.academicYear || '',
            topicTitle: '',
            registrationStatus: regs.some(reg => String(reg.studentId || reg.mssv || reg.id).trim().toUpperCase() === String(sid).trim().toUpperCase()) ? 'Đã đăng ký' : 'Chưa đăng ký',
            roleLabel: 'Sinh viên'
          });
        }
      });

      // Exact Act-as must query both collections even when registrations already exist.
      if (roundFilter !== 'all') {
        try {
          const snap = await getDocs(collection(db, 'graduationRounds', r.id, 'registrations'));
          snap.docs.forEach(d => {
            const st = d.data();
            const sid = d.id || st.mssv || st.studentId;
            if (sid) {
              addCandidate({
                type: 'student',
                id: sid,
                mssv: sid,
                name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
                email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                roundShortCode: r.shortCode || '',
                roundAcademicYear: r.academicYear || '',
                topicTitle: st.topicTitle || '',
                registrationStatus: 'Đã đăng ký',
                roleLabel: 'Sinh viên'
              });
            }
          });
        } catch (e) {}

        try {
          const snapEligible = await getDocs(collection(db, 'graduationRounds', r.id, 'eligibleStudents'));
          snapEligible.docs.forEach(d => {
            const st = d.data();
            const sid = d.id || st.mssv || st.studentId;
            if (sid) {
              addCandidate({
                type: 'student',
                id: sid,
                mssv: sid,
                name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
                email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                roundShortCode: r.shortCode || '',
                roundAcademicYear: r.academicYear || '',
                topicTitle: '',
                registrationStatus: 'Chưa đăng ký',
                roleLabel: 'Sinh viên'
              });
            }
          });
        } catch (e) {}
      }
    }

    // Also check facultyStudents if candidates are empty
    if (candidates.filter(c => c.type === 'student').length === 0 && Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
      state.facultyStudents.slice(0, 50).forEach(fs => {
        const sid = fs.mssv || fs.studentId;
        if (sid) {
          addCandidate({
            type: 'student',
            id: sid,
            mssv: sid,
            name: fs.name || fs.fullName || sid,
            email: fs.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: '',
            roundTitle: '',
            roundShortCode: '',
            roundAcademicYear: '',
            topicTitle: '',
            registrationStatus: 'Chưa đăng ký',
            roleLabel: 'Sinh viên'
          });
        }
      });
    }
  }

  // 3. REVIEWERS (from round.reviewerAssignments)
  if (roleFilter === 'all' || roleFilter === 'reviewer') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []);

    for (const r of targetRounds) {
      const reviewerAssignments = r.reviewerAssignments || {};
      const distinctReviewerIds = [...new Set(Object.values(reviewerAssignments))];
      distinctReviewerIds.forEach(revId => {
        if (!revId) return;
        const supInfo = (state.supervisorsMaster || []).find(s => s.id === revId || s.email === revId);
        addCandidate({
          type: 'reviewer',
          id: revId,
          name: supInfo?.name || revId,
          email: supInfo?.email || (revId.includes('@') ? revId : ''),
          roundId: r.id,
          roundTitle: r.roundName || r.title || r.id,
          roundShortCode: r.shortCode || '',
          roundAcademicYear: r.academicYear || '',
          roleLabel: 'Giảng viên phản biện (Reviewer)'
        });
      });
    }
  }

  // 4. COUNCIL MEMBERS (from round.activities councils)
  if (roleFilter === 'all' || roleFilter === 'council') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []);

    for (const r of targetRounds) {
      const actsWithCouncils = (r.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils));
      for (const act of actsWithCouncils) {
        for (const c of (act.councils || [])) {
          const members = Object.values(c.membersBySlot || {});
          for (const m of members) {
            if (m.memberEmail) {
              const roleTitle = m.slotName || m.memberRole || 'Thành viên Hội đồng';
              addCandidate({
                type: 'council',
                id: m.memberId || m.memberEmail,
                name: m.memberName || m.memberEmail,
                email: m.memberEmail,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                roundShortCode: r.shortCode || '',
                roundAcademicYear: r.academicYear || '',
                councilId: c.id,
                councilName: c.councilName || c.name || 'Hội đồng',
                councilRole: roleTitle,
                activityName: act.title || act.name,
                roleLabel: `${roleTitle} - ${c.councilName || c.name || 'Hội đồng'}`
              });
            }
          }
        }
      }
    }
  }

  // 5. PRELIMINARY (Cán bộ Sơ khảo)
  if (roleFilter === 'all' || roleFilter === 'preliminary') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []);

    for (const r of targetRounds) {
      const scorerIds = r.preliminaryConfig?.scorerIds || [];
      scorerIds.forEach(scorerId => {
        const s = (state.supervisorsMaster || []).find(item => item.id === scorerId || item.email === scorerId);
        const scorerEmail = s?.email || (String(scorerId).includes('@') ? String(scorerId) : '');
        if (scorerEmail) {
          addCandidate({
            type: 'preliminary',
            id: s?.id || scorerId,
            name: s?.name || scorerEmail,
            email: scorerEmail,
            department: s?.department || '',
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roundShortCode: r.shortCode || '',
            roundAcademicYear: r.academicYear || '',
            roleLabel: 'Cán bộ chấm Sơ khảo'
          });
        }
      });
    }
  }

  // Enrich students from the authoritative Faculty Student Master after the
  // eligibleStudents + registrations union has been built and deduplicated.
  candidates.filter(c => c.type === 'student').forEach(candidate => {
    const sid = String(candidate.mssv || candidate.id || '').trim().replace(/\s+/g, '').toUpperCase();
    candidate.id = sid;
    candidate.mssv = sid;
    const master = typeof window.getFacultyStudentByMssv === 'function'
      ? window.getFacultyStudentByMssv(sid)
      : null;
    if (master) {
      candidate.name = master.fullName || master.name || candidate.name || sid;
      candidate.email = master.email || candidate.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`;
      candidate.major = master.major || master.majorName || '';
      candidate.className = master.className || master.studentClass || '';
      candidate.notFoundInMaster = false;
    } else {
      const currentName = String(candidate.name || '').trim();
      candidate.name = currentName && currentName.toUpperCase() !== sid ? currentName : sid;
      candidate.notFoundInMaster = state.facultyStudentsLoaded === true;
    }
  });

  // Filter candidates by search query
  const filtered = candidates.filter(c => {
    if (!searchQuery) return true;
    const matchName = (c.name || '').toLowerCase().includes(searchQuery);
    const matchEmail = (c.email || '').toLowerCase().includes(searchQuery);
    const matchMssv = (c.mssv || '').toLowerCase().includes(searchQuery);
    const matchCode = (c.code || '').toLowerCase().includes(searchQuery);
    const matchDept = (c.department || '').toLowerCase().includes(searchQuery);
    const matchTopic = (c.topicTitle || '').toLowerCase().includes(searchQuery);
    const matchRole = (c.roleLabel || '').toLowerCase().includes(searchQuery);
    return matchName || matchEmail || matchMssv || matchCode || matchDept || matchTopic || matchRole;
  });

  return filtered;
}
window.gatherRoundCandidates = gatherRoundCandidates;

window.openAdminImpersonateModal = function() {
  if (!state.allowImpersonation || !state.realIsAdmin) {
    showToast('Tính năng đóng vai chưa được bật trong Cài đặt hệ thống hoặc bạn không có quyền.', 'warning');
    return;
  }

  const roundSelect = document.getElementById('impersonate-filter-round');
  if (roundSelect) {
    const rounds = (state.rounds || []).filter(r => !r.deleted);
    let opts = '<option value="all">-- Tất cả các đợt --</option>';
    rounds.forEach(r => {
      const isAct = r.isActive ? ' (Hiện hành)' : '';
      opts += `<option value="${r.id}">${escapeHtml(r.roundName || r.title || r.id)}${isAct}</option>`;
    });
    roundSelect.innerHTML = opts;
    if (state.selectedRoundId && rounds.some(r => r.id === state.selectedRoundId)) {
      roundSelect.value = state.selectedRoundId;
    }
  }

  const roleSelect = document.getElementById('impersonate-filter-role');
  if (roleSelect) roleSelect.value = 'all';

  const searchInput = document.getElementById('impersonate-search-input');
  if (searchInput) searchInput.value = '';

  const modal = document.getElementById('modal-admin-impersonate');
  if (modal) modal.classList.remove('hidden');

  state.selectedImpersonateCandidate = null;
  const confirmBtn = document.getElementById('btn-confirm-impersonate');
  const confirmText = document.getElementById('btn-confirm-impersonate-text');
  if (confirmBtn) confirmBtn.disabled = true;
  if (confirmText) confirmText.textContent = 'Bắt đầu đóng vai';

  gatherAndRenderImpersonateCandidates();
};

window.closeAdminImpersonateModal = function() {
  const modal = document.getElementById('modal-admin-impersonate');
  if (modal) modal.classList.add('hidden');
};

window.onImpersonateFiltersChange = function() {
  state.selectedImpersonateCandidate = null;
  const confirmBtn = document.getElementById('btn-confirm-impersonate');
  const confirmText = document.getElementById('btn-confirm-impersonate-text');
  if (confirmBtn) confirmBtn.disabled = true;
  if (confirmText) confirmText.textContent = 'Bắt đầu đóng vai';

  gatherAndRenderImpersonateCandidates();
};

let impersonateSearchTimer = null;
window.onImpersonateSearchInput = function() {
  clearTimeout(impersonateSearchTimer);
  impersonateSearchTimer = setTimeout(() => {
    gatherAndRenderImpersonateCandidates();
  }, 250);
};

async function gatherAndRenderImpersonateCandidates() {
  const roundFilter = document.getElementById('impersonate-filter-round')?.value || 'all';
  const roleFilter = document.getElementById('impersonate-filter-role')?.value || 'all';
  const searchQuery = (document.getElementById('impersonate-search-input')?.value || '').trim().toLowerCase();
  const listEl = document.getElementById('impersonate-candidates-list');
  const countEl = document.getElementById('impersonate-candidate-count');

  if (listEl) {
    listEl.innerHTML = '<div class="text-center py-6 text-slate-400">Đang tải danh sách người dùng thực tế...</div>';
  }

  if ((roleFilter === 'student' || roleFilter === 'all') && typeof ensureFacultyDatasetLoaded === 'function') {
    await ensureFacultyDatasetLoaded().catch(error => console.warn('[ActAs] Student Master load notice:', error));
  }
  if (roleFilter !== 'student' && typeof ensureSupervisorsMasterLoaded === 'function') {
    await ensureSupervisorsMasterLoaded().catch(error => console.warn('[ActAs] Lecturer directory load notice:', error));
  }

  const filtered = await gatherRoundCandidates(roundFilter, roleFilter, searchQuery);

  filtered.forEach((c, idx) => {
    c.candKey = `cand_${idx}`;
  });
  state.impersonateCandidates = filtered;

  if (countEl) countEl.textContent = String(filtered.length);

  if (listEl) {
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Không tìm thấy người dùng thực tế phù hợp với bộ lọc.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      let roleBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
      if (c.type === 'supervisor') roleBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      else if (c.type === 'reviewer') roleBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
      else if (c.type === 'council') roleBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
      else if (c.type === 'preliminary') roleBadgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';

      const isSelected = state.selectedImpersonateCandidate && state.selectedImpersonateCandidate.candKey === c.candKey;

      return `
        <div onclick="selectImpersonateCandidate('${c.candKey}')"
             ondblclick="confirmImpersonateCandidateDirectly('${c.candKey}')"
             id="cand-card-${c.candKey}"
             class="impersonate-candidate-card cursor-pointer p-3 bg-white hover:bg-amber-50/50 rounded-xl border ${isSelected ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/40' : 'border-slate-200'} transition-all flex items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="flex items-center justify-center shrink-0 pr-1">
              <input type="radio" name="impersonate_candidate_radio" id="radio-${c.candKey}"
                     value="${c.candKey}"
                     ${isSelected ? 'checked' : ''}
                     onchange="selectImpersonateCandidate('${c.candKey}')"
                     class="w-4 h-4 text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer">
            </div>
            <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
              ${c.type === 'student' ? '🎓' : (c.type === 'supervisor' ? '👨‍🏫' : (c.type === 'reviewer' ? '🔍' : (c.type === 'council' ? '⚖️' : '📋')))}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-slate-900 text-xs truncate">${escapeHtml(c.name)}</span>
                ${c.mssv ? `<span class="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">${escapeHtml(c.mssv)}</span>` : ''}
                ${c.type === 'student' ? `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${c.registrationStatus === 'Đã đăng ký' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}">${escapeHtml(c.registrationStatus || 'Chưa đăng ký')}</span>` : ''}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${roleBadgeColor}">
                  ${escapeHtml(c.roleLabel)}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2 flex-wrap">
                <span>✉️ ${escapeHtml(c.email || '--')}</span>
                ${c.department ? `<span>• BM: ${escapeHtml(c.department)}</span>` : ''}
                ${c.className ? `<span>• Lớp: ${escapeHtml(c.className)}</span>` : ''}
                ${c.major ? `<span>• Ngành: ${escapeHtml(c.major)}</span>` : ''}
                ${c.notFoundInMaster ? '<span class="text-amber-700 font-semibold">• Chưa tìm thấy thông tin sinh viên</span>' : ''}
                ${c.roundTitle ? `<span class="text-amber-800 font-medium">• ${escapeHtml(c.roundTitle)}</span>` : ''}
                ${c.topicTitle ? `<span class="text-blue-700 font-medium italic truncate">• Đề tài: ${escapeHtml(c.topicTitle)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="shrink-0">
            <button type="button" onclick="event.stopPropagation(); selectImpersonateCandidate('${c.candKey}'); confirmImpersonateSelectedCandidate();" class="px-3 py-1.5 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
              <span>🎭</span> <span>Chọn</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}
window.gatherAndRenderImpersonateCandidates = gatherAndRenderImpersonateCandidates;

window.selectImpersonateCandidate = function(candKey) {
  const list = state.impersonateCandidates || [];
  const cand = list.find(c => c.candKey === candKey);
  if (!cand) return;

  state.selectedImpersonateCandidate = cand;

  // Uncheck / unhighlight other cards
  document.querySelectorAll('.impersonate-candidate-card').forEach(el => {
    el.classList.remove('border-amber-500', 'bg-amber-50/80', 'ring-2', 'ring-amber-400/40');
    el.classList.add('border-slate-200', 'bg-white');
  });

  const card = document.getElementById(`cand-card-${candKey}`);
  if (card) {
    card.classList.remove('border-slate-200', 'bg-white');
    card.classList.add('border-amber-500', 'bg-amber-50/80', 'ring-2', 'ring-amber-400/40');
  }

  const radio = document.getElementById(`radio-${candKey}`);
  if (radio) {
    radio.checked = true;
  }

  const confirmBtn = document.getElementById('btn-confirm-impersonate');
  const confirmText = document.getElementById('btn-confirm-impersonate-text');
  if (confirmBtn) {
    confirmBtn.disabled = false;
  }
  if (confirmText) {
    const ident = cand.mssv || cand.email || cand.id || '';
    confirmText.textContent = `Bắt đầu đóng vai: ${cand.name} (${ident})`;
  }
};

window.confirmImpersonateCandidateDirectly = function(candKey) {
  window.selectImpersonateCandidate(candKey);
  window.confirmImpersonateSelectedCandidate();
};

window.confirmImpersonateSelectedCandidate = function() {
  if (!state.selectedImpersonateCandidate) {
    showToast('Vui lòng chọn một người dùng cụ thể từ danh sách.', 'warning');
    return;
  }
  window.startImpersonating(state.selectedImpersonateCandidate);
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof preparePreviewStudentDropdown !== 'undefined') window.preparePreviewStudentDropdown = preparePreviewStudentDropdown;
  if (typeof isImpersonating !== 'undefined') window.isImpersonating = isImpersonating;
  if (typeof getRealUser !== 'undefined') window.getRealUser = getRealUser;
  if (typeof getEffectiveActor !== 'undefined') window.getEffectiveActor = getEffectiveActor;
  if (typeof checkImpersonationWriteGuard !== 'undefined') window.checkImpersonationWriteGuard = checkImpersonationWriteGuard;
  if (typeof loadSystemSettingsDoc !== 'undefined') window.loadSystemSettingsDoc = loadSystemSettingsDoc;
  if (typeof setupSystemSettingsRealtimeListener !== 'undefined') window.setupSystemSettingsRealtimeListener = setupSystemSettingsRealtimeListener;
  if (typeof loadAdminSystemSettings !== 'undefined') window.loadAdminSystemSettings = loadAdminSystemSettings;
  if (typeof updateSettingsActAsSessionUI !== 'undefined') window.updateSettingsActAsSessionUI = updateSettingsActAsSessionUI;
  if (typeof onSettingsActAsRoundOrRoleChange !== 'undefined') window.onSettingsActAsRoundOrRoleChange = onSettingsActAsRoundOrRoleChange;
  if (typeof onSettingsActAsSearchInput !== 'undefined') window.onSettingsActAsSearchInput = onSettingsActAsSearchInput;
  if (typeof populateSettingsActAsCandidates !== 'undefined') window.populateSettingsActAsCandidates = populateSettingsActAsCandidates;
  if (typeof onSettingsActAsStartClick !== 'undefined') window.onSettingsActAsStartClick = onSettingsActAsStartClick;
  if (typeof loadImpersonationSession !== 'undefined') window.loadImpersonationSession = loadImpersonationSession;
  if (typeof applyImpersonationActor !== 'undefined') window.applyImpersonationActor = applyImpersonationActor;
  if (typeof gatherRoundCandidates !== 'undefined') window.gatherRoundCandidates = gatherRoundCandidates;
  if (typeof addCandidate !== 'undefined') window.addCandidate = addCandidate;
  if (typeof gatherAndRenderImpersonateCandidates !== 'undefined') window.gatherAndRenderImpersonateCandidates = gatherAndRenderImpersonateCandidates;
}
