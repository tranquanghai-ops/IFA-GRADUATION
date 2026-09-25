
const resolveRoundWeekTitle = (w, t) => (typeof window !== 'undefined' && window.resolveRoundWeekTitle ? window.resolveRoundWeekTitle(w, t) : (t || ('Tuần ' + w)));
const getRoundTimelineDefaultTitle = (w) => (typeof window !== 'undefined' && window.getRoundTimelineDefaultTitle ? window.getRoundTimelineDefaultTitle(w) : ('Tuần ' + w));

// --- Module Bridges ---
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);
const getSupervisorAssignmentMode = (rnd) => (typeof window !== 'undefined' && window.getSupervisorAssignmentMode ? window.getSupervisorAssignmentMode(rnd) : 'student_preference');
const renderAdminRoundsCards = () => window.renderAdminRoundsCards?.();
const populateRoundSelectors = () => window.populateRoundSelectors?.();
const loadAdminStats = () => window.loadAdminStats?.();
const loadRounds = () => window.loadRounds?.();
const switchAdminTab = (tab) => window.switchAdminTab?.(tab);
/**
 * IFA+ Graduation — Admin Rounds Cards, Workspace & Actions Module
 */
window.softDeleteRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  if (!(await showConfirm('Chuyển vào Thùng rác', `Bạn có chắc chắn muốn chuyển đợt "${r.title}" vào Thùng rác?`, { confirmText: 'Chuyển vào Thùng rác', danger: true }))) return;

  try {
    const wasActive = Boolean(r.isActive);
    r.deleted = true;
    r.deletedAt = new Date().toISOString();
    r.isActive = false;

    renderAdminRoundsTable();
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    populateRoundSelectors();
    loadAdminStats().catch(() => {});

    await updateDoc(doc(db, 'graduationRounds', roundId), {
      deleted: true,
      deletedAt: serverTimestamp(),
      isActive: false,
      updatedAt: serverTimestamp()
    });

    showToast('Đã chuyển đợt vào Thùng rác.', 'warning');
  } catch (err) {
    console.error('Lỗi xóa đợt:', err);
    showToast('Lỗi xóa đợt: ' + err.message, 'error');
  }
};

window.restoreRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  try {
    r.deleted = false;
    r.deletedAt = null;
    r.isActive = false; // Never auto-reactivate

    renderAdminTrashTable();
    renderAdminRoundsTable();
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    populateRoundSelectors();
    loadAdminStats().catch(() => {});

    await updateDoc(doc(db, 'graduationRounds', roundId), {
      deleted: false,
      deletedAt: null,
      isActive: false,
      updatedAt: serverTimestamp()
    });

    showToast(`Đã khôi phục đợt "${r.title}". Đợt ở trạng thái không hiện hành.`, 'info');
  } catch (err) {
    console.error('Lỗi khôi phục đợt:', err);
    showToast('Lỗi khôi phục đợt: ' + err.message, 'error');
  }
};

window.permanentDeleteRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  const title = r ? r.title : roundId;

  if (!(await showConfirm('XÓA VĨNH VIỄN ĐỢT', `⚠️ HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC!\nBạn có chắc chắn muốn XÓA VĨNH VIỄN đợt "${title}"?`, { confirmText: 'Xóa vĩnh viễn', danger: true }))) return;

  try {
    state.rounds = state.rounds.filter(x => x.id !== roundId);
    renderAdminTrashTable();

    await deleteDoc(doc(db, 'graduationRounds', roundId));
    showToast('Đã xóa vĩnh viễn đợt khỏi cơ sở dữ liệu.', 'warning');
  } catch (err) {
    console.error('Lỗi xóa vĩnh viễn đợt:', err);
    showToast('Lỗi xóa vĩnh viễn: ' + err.message, 'error');
  }
};

function renderAdminTrashTable() {
  const tbody = document.getElementById('admin-trash-tbody');
  if (!tbody) return;

  const now = Date.now();
  const trashedRounds = (state.rounds || []).filter(r => r.deleted === true);

  // Auto purge items older than 30 days
  trashedRounds.forEach(r => {
    const delTime = r.deletedAt ? new Date(r.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
    if (daysPassed >= 30) {
      permanentDeleteRound(r.id).catch(console.warn);
    }
  });

  if (trashedRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Thùng rác trống</td></tr>';
    return;
  }

  tbody.innerHTML = trashedRounds.map(r => {
    const delTime = r.deletedAt ? new Date(r.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 30 - daysPassed);
    const delDateStr = fmt24h(r.deletedAt);

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-bold text-slate-900">${r.title}</td>
        <td class="p-3.5 text-slate-600">${r.academicYear || '--'}</td>
        <td class="p-3.5 text-slate-500 font-mono text-[11px]">${delDateStr}</td>
        <td class="p-3.5">
          <span class="badge ${daysRemaining <= 5 ? 'badge-closed' : 'bg-amber-100 text-amber-800'}">Còn ${daysRemaining} ngày</span>
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button onclick="restoreRound('${r.id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-300">Khôi phục</button>
          <button onclick="permanentDeleteRound('${r.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-300">Xóa vĩnh viễn</button>
        </td>
      </tr>
    `;
  }).join('');
}


// --- ADMIN: ROUNDS TABLE ---
function renderAdminRoundsTable() {
  const tbody = document.getElementById('admin-rounds-tbody');
  if (!tbody) return;

  const activeRounds = (state.rounds || []).filter(r => !r.deleted);

  if (activeRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Chưa có đợt tốt nghiệp nào. Bấm "+ Tạo đợt mới" để bắt đầu.</td></tr>';
    return;
  }

  tbody.innerHTML = activeRounds.map(r => {
    const timeRangeStr = fmtDateRange24h(r.openAtDate, r.closeAtDate);
    const isCurrentActive = Boolean(r.isActive);
    const shortCode = r.shortCode || r.roundName || r.slug || r.id;

    // Determine configuration status
    const isPreEligible = Boolean(r.allowRegistrationBeforeEligibility);
    const isIncomplete = (r.configStatus === 'incomplete') || (!isPreEligible && typeof r.eligibleCount === 'number' && r.eligibleCount === 0) || (typeof r.supervisorCount === 'number' && r.supervisorCount === 0);

    let statusColHtml = '';
    if (isCurrentActive) {
      statusColHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300">● Đợt hiện hành</span>';
    } else if (isIncomplete) {
      statusColHtml = `
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Thiếu SV đủ điều kiện hoặc GVHD">⚠️ Chưa hoàn tất</span>
          <button onclick="setActiveRound('${r.id}')" class="mt-1 block text-[11px] text-slate-500 hover:text-slate-800 underline">Kích hoạt</button>
        </div>
      `;
    } else {
      statusColHtml = `
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Sẵn sàng</span>
          <button onclick="setActiveRound('${r.id}')" class="mt-1 block text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline">Đặt làm hiện hành</button>
        </div>
      `;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-slate-900">${r.title}</span>
            ${isPreEligible ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold" title="Cho phép đăng ký trước danh sách đủ điều kiện">Chờ xét ĐK</span>' : ''}
          </div>
          <span class="text-[10px] font-mono text-slate-400 block mt-0.5">Mã: ${shortCode}</span>
        </td>
        <td class="p-3.5 text-slate-600 font-semibold">${r.academicYear}</td>
        <td class="p-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">${timeRangeStr}</td>
        <td class="p-3.5 font-bold text-slate-800">${typeof r.supervisorCount === 'number' ? r.supervisorCount : (r.supervisorsCount || '--')}</td>
        <td class="p-3.5 font-bold text-slate-800">${typeof r.eligibleCount === 'number' ? r.eligibleCount : (r.registrationsCount || '--')}</td>
        <td class="p-3.5">
          <span class="badge badge-${r.status}">${r.status}</span>
        </td>
        <td class="p-3.5">
          ${statusColHtml}
        </td>
        <td class="p-3.5">
          <button onclick="copyRoundLink('${r.id}', '${shortCode}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-tdtu-blue rounded-lg font-bold text-xs flex items-center gap-1 border border-blue-200 transition-colors" title="Sao chép link ?x=${shortCode}">
            <span>📋 Link</span>
          </button>
        </td>
        <td class="p-3.5 text-right space-x-1.5 whitespace-nowrap">
          <button onclick="openRoundTimeline('${r.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs border border-indigo-200 transition-colors" title="Kế hoạch mốc thời gian">📅 Kế hoạch</button>
          <button onclick="editRoundModal('${r.id}')" class="text-blue-600 hover:underline font-bold text-xs">Sửa</button>
          <button onclick="softDeleteRound('${r.id}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================

// PHASE 1: IFAA-STYLE ROUNDS MANAGEMENT & CARD VIEW
// ============================================================================

state.adminRoundsFilter = 'all';
state.adminRoundsSearch = '';

window.filterAdminRounds = function(filterKey) {
  state.adminRoundsFilter = filterKey;
  document.querySelectorAll('#admin-rounds-filter-pills .round-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filterKey) {
      btn.className = 'round-filter-btn px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white shadow-xs transition-all';
    } else {
      btn.className = 'round-filter-btn px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all';
    }
  });
  renderAdminRoundsCards();
};

window.searchAdminRounds = function(query) {
  state.adminRoundsSearch = (query || '').trim().toLowerCase();
  renderAdminRoundsCards();
};

function getRoundStatusCategory(r) {
  if (r.deleted || r.isDeleted) return 'deleted';
  if (r.hidden || r.status === 'hidden' || r.isHidden) return 'hidden';
  
  const now = Date.now();
  const openTime = r.openAtDate ? new Date(r.openAtDate).getTime() : (r.openAt ? new Date(r.openAt.toDate ? r.openAt.toDate() : r.openAt).getTime() : null);
  const closeTime = r.closeAtDate ? new Date(r.closeAtDate).getTime() : (r.closeAt ? new Date(r.closeAt.toDate ? r.closeAt.toDate() : r.closeAt).getTime() : null);
  
  if (r.status === 'closed' || r.status === 'ended' || (closeTime && !isNaN(closeTime) && now > closeTime)) {
    return 'ended';
  }
  if (r.status === 'upcoming' || (openTime && !isNaN(openTime) && now < openTime)) {
    return 'upcoming';
  }
  return 'running';
}


window.moveAdminRoundCard = async function(roundId, neighborId) {
  if (!state.isAdmin || !neighborId || state.roundOrderSaving) return;
  const ordered = (state.rounds || []).filter(round => !round.deleted && !round.isDeleted);
  const sourceIndex = ordered.findIndex(round => round.id === roundId);
  const neighborIndex = ordered.findIndex(round => round.id === neighborId);
  if (sourceIndex < 0 || neighborIndex < 0) return;
  [ordered[sourceIndex], ordered[neighborIndex]] = [ordered[neighborIndex], ordered[sourceIndex]];
  state.roundOrderSaving = true;
  try {
    for (let offset = 0; offset < ordered.length; offset += 450) {
      const batch = writeBatch(db);
      ordered.slice(offset, offset + 450).forEach((round, index) => {
        batch.update(doc(db, 'graduationRounds', round.id), { displayOrder: offset + index });
      });
      await batch.commit();
    }
    ordered.forEach((round, index) => { round.displayOrder = index; });
    const omitted = (state.rounds || []).filter(round => round.deleted || round.isDeleted);
    state.rounds = [...ordered, ...omitted];
    renderAdminRoundsCards();
    renderAdminRoundsTable();
    renderRoundsDropdowns();
    showToast('Đã lưu thứ tự các đợt tốt nghiệp.', 'success');
  } catch (error) {
    showToast('Không thể lưu thứ tự đợt: ' + error.message, 'error');
  } finally {
    state.roundOrderSaving = false;
  }
};

window.renderAdminRoundsCards = function() {
  const container = document.getElementById('admin-rounds-cards');
  if (!container) return;

  if (!state.roundsLoaded && (!state.rounds || state.rounds.length === 0)) {
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-slate-200 rounded-2xl w-full">
        <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p class="text-sm font-semibold text-slate-600">Đang tải danh sách đợt tốt nghiệp...</p>
      </div>
    `;
    return;
  }

  if (state.roundsLoadError && (!state.rounds || state.rounds.length === 0)) {
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-rose-200 rounded-2xl w-full">
        <div class="text-3xl text-rose-500 font-bold">⚠️</div>
        <p class="text-base font-bold text-rose-800">Không thể tải danh sách đợt tốt nghiệp.</p>
        <p class="text-xs text-slate-500">${escapeHtml(state.roundsLoadError.message || 'Lỗi kết nối cơ sở dữ liệu.')}</p>
        <div class="pt-2">
          <button type="button" onclick="loadRounds()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
            🔄 Thử lại
          </button>
        </div>
      </div>
    `;
    return;
  }

  try {
    const totalBadge = document.getElementById('admin-rounds-total-badge');
    const allNonDeleted = (state.rounds || []).filter(r => !r.deleted && !r.isDeleted);
    if (totalBadge) totalBadge.textContent = `${allNonDeleted.length} đợt`;

    const filter = state.adminRoundsFilter || 'all';
    const searchQuery = (state.adminRoundsSearch || '').trim().toLowerCase();

    let filtered = allNonDeleted.filter(r => {
      const cat = getRoundStatusCategory(r);
      if (filter === 'all') return true;
      if (filter === 'hidden') return cat === 'hidden';
      if (filter === 'upcoming') return cat === 'upcoming';
      if (filter === 'running') return cat === 'running';
      if (filter === 'ended') return cat === 'ended';
      return true;
    });

    if (searchQuery) {
      filtered = filtered.filter(r => {
        const title = (r.title || '').toLowerCase();
        const code = (r.shortCode || r.slug || r.roundName || r.id || '').toLowerCase();
        const year = (r.academicYear || '').toLowerCase();
        return title.includes(searchQuery) || code.includes(searchQuery) || year.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card-surface p-10 text-center space-y-3 bg-white border border-dashed border-slate-300 rounded-2xl w-full">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
            📁
          </div>
          <p class="text-base font-bold text-slate-800">Không có đợt tốt nghiệp nào ở mục này</p>
          <p class="text-sm text-slate-500">Bạn có thể chuyển bộ lọc hoặc bấm "Tạo đợt tốt nghiệp" để thêm mới.</p>
          <div class="pt-1">
            <button onclick="openCreateRoundModal()" class="px-4 py-2 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-xl text-sm font-semibold shadow-xs transition-all">
              + Tạo đợt tốt nghiệp
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((r, cardIndex) => {
      const directAssignment = isDirectSupervisorAssignment(r);
      const cat = getRoundStatusCategory(r);
      const shortCode = r.shortCode || r.slug || r.roundName || r.id;
      const timeRangeStr = fmtDateRange24h(r.openAtDate, r.closeAtDate);
      const isCurrentActive = Boolean(r.isActive);

      let statusBadgeHtml = '';
      if (cat === 'running') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Đang diễn ra</span>';
      } else if (cat === 'upcoming') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Sắp mở</span>';
      } else if (cat === 'ended') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Đã kết thúc</span>';
      } else if (cat === 'hidden') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Đã ẩn</span>';
      }

      const activeBadgeHtml = isCurrentActive 
        ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">★ Đợt hiện hành</span>'
        : '';

      const modeBadgeHtml = directAssignment
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Khoa phân công GVHD</span>'
        : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Nguyện vọng GVHD</span>';

      // Metrics
      const eligibleCount = typeof r.eligibleCount === 'number' ? r.eligibleCount : (r.eligibleStudentsCount || 0);
      const supCount = typeof r.supervisorCount === 'number' ? r.supervisorCount : (r.supervisorsCount || 0);
      const regCount = typeof r.registrationsCount === 'number' ? r.registrationsCount : 0;
      const actCount = Array.isArray(r.activities) ? r.activities.length : (typeof r.activitiesCount === 'number' ? r.activitiesCount : 0);
      const assignedCount = typeof r.assignedCount === 'number'
        ? r.assignedCount
        : (typeof r.officialAssignmentsCount === 'number' ? r.officialAssignmentsCount : null);
      const unassignedCount = assignedCount === null ? null : Math.max(eligibleCount - assignedCount, 0);
      const driveRootId = r.driveRootFolderId || r.rootDriveFolderId || '';
      const driveRootUrl = r.driveRootFolderUrl || r.rootDriveFolderUrl || (driveRootId ? `https://drive.google.com/drive/folders/${driveRootId}` : '');
      const driveFoldersCount = Array.isArray(r.driveFolderStructure)
        ? r.driveFolderStructure.length
        : normalizeRoundDriveFolderNames(r.driveSubfolderNames || []).length;

      let phaseInfo = '';
      if (directAssignment && r.reviewStatus !== 'completed') {
        phaseInfo = 'Khoa phân công trực tiếp';
      } else if (r.reviewStatus === 'completed') {
        phaseInfo = 'Đã chốt phân công GVHD';
      } else if (r.currentRank) {
        phaseInfo = `Đang xét NV${r.currentRank}`;
      } else if (cat === 'running') {
        phaseInfo = 'Đang nhận đăng ký';
      } else if (cat === 'upcoming') {
        phaseInfo = 'Chưa mở cổng';
      } else {
        phaseInfo = 'Đã đóng đợt';
      }

      const isClosed = cat === 'ended';
      const isHidden = cat === 'hidden';

      return `
        <article class="card-surface rounded-2xl overflow-hidden border ${isCurrentActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} shadow-sm hover:shadow-lg transition-all w-full">
          <header class="relative bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-4 sm:p-5">
            <div class="absolute right-4 top-4 flex items-center gap-1 z-10" aria-label="Sắp xếp thứ tự đợt">
              <button type="button" onclick="moveAdminRoundCard('${r.id}', '${filtered[cardIndex - 1]?.id || ''}')" ${cardIndex === 0 ? 'disabled' : ''} title="Đưa đợt lên trên" aria-label="Đưa ${escapeHtml(r.title || 'đợt')} lên trên" class="h-6 w-7 rounded-lg border border-white/25 bg-white/10 text-xs leading-none hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer">▲</button>
              <button type="button" onclick="moveAdminRoundCard('${r.id}', '${filtered[cardIndex + 1]?.id || ''}')" ${cardIndex === filtered.length - 1 ? 'disabled' : ''} title="Đưa đợt xuống dưới" aria-label="Đưa ${escapeHtml(r.title || 'đợt')} xuống dưới" class="h-6 w-7 rounded-lg border border-white/25 bg-white/10 text-xs leading-none hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer">▼</button>
            </div>
            <button type="button" onclick="copyRoundLink('${r.id}', '${shortCode}')" title="Bấm để sao chép liên kết đợt" class="block w-full text-left group mb-2.5 pr-20">
              <h3 class="text-lg sm:text-xl xl:text-2xl font-black tracking-tight leading-tight lg:whitespace-nowrap group-hover:text-blue-200 transition-colors inline-flex flex-wrap items-center gap-2">
                <span>${escapeHtml(r.title || '')}</span>
                <span class="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-amber-300 font-bold border border-white/15">NH ${escapeHtml(r.academicYear || '—')}</span>
              </h3>
            </button>
            <div class="flex flex-wrap items-center gap-2 mb-2.5">
              ${statusBadgeHtml}
              <span class="inline-flex items-center gap-2 whitespace-nowrap">
                ${activeBadgeHtml}
                ${modeBadgeHtml}
              </span>
            </div>
            <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
              <div class="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span class="inline-flex items-center gap-1.5"><span>🗓️</span><span>${timeRangeStr}</span></span>
                <span class="inline-flex items-center gap-1.5"><span>📌</span><strong class="text-slate-100">${phaseInfo}</strong></span>
                <span class="inline-flex items-center gap-1.5"><span>📁</span><span class="${driveRootUrl ? 'text-emerald-300' : 'text-amber-300'}">${driveRootUrl ? `Drive đã kết nối · ${driveFoldersCount} thư mục con` : 'Chưa cấu hình Drive'}</span></span>
              </div>
              <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 mt-3 xl:mt-0">
                ${driveRootUrl ? `<a href="${escapeHtml(driveRootUrl)}" target="_blank" rel="noopener noreferrer" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm text-center"><span>↗</span><span>Thư mục Drive</span></a>` : ''}
                <button type="button" onclick="editRoundModal('${r.id}')" class="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition text-center cursor-pointer">✏️ Sửa đợt</button>
                <button type="button" onclick="toggleRoundCloseStatus('${r.id}')" class="px-3 py-2 ${isClosed ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-amber-400 hover:bg-amber-300'} text-slate-950 font-black text-xs rounded-xl transition text-center cursor-pointer">${isClosed ? '↺ Mở lại' : 'Kết thúc đợt'}</button>
                <button type="button" onclick="toggleRoundHiddenStatus('${r.id}')" class="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs rounded-xl transition text-center cursor-pointer">${isHidden ? '👁️ Hiện lại' : 'Lưu trữ'}</button>
              </div>
            </div>
          </header>

          <div class="grid grid-cols-2 lg:grid-cols-4 bg-slate-50/80 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200">
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'eligible-students')" class="px-3 py-2.5 text-center hover:bg-blue-50 transition group cursor-pointer">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-blue-700 uppercase tracking-wider">Tổng sinh viên ↗</div>
              <div class="text-xl font-black text-slate-950 mt-0.5">${eligibleCount}</div>
            </button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'review', 'assigned')" class="px-3 py-2.5 text-center hover:bg-emerald-50 transition group cursor-pointer">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 uppercase tracking-wider">Đã phân GVHD ↗</div>
              <div class="text-xl font-black text-emerald-600 mt-0.5">${assignedCount === null ? '—' : assignedCount} ${unassignedCount === null ? '<span class="text-[10px] font-normal text-slate-400">chưa tổng hợp</span>' : `<span class="text-[10px] font-normal text-slate-500">(${unassignedCount} chưa)</span>`}</div>
            </button>
            <button type="button" onclick="editRoundModal('${r.id}', 'supervisors')" class="px-3 py-2.5 text-center hover:bg-indigo-50 transition group cursor-pointer">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-indigo-700 uppercase tracking-wider">GVHD tham gia ↗</div>
              <div class="text-xl font-black text-indigo-700 mt-0.5">${supCount}</div>
            </button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'timeline')" class="px-3 py-2.5 text-center hover:bg-purple-50 transition group cursor-pointer">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-purple-700 uppercase tracking-wider">Mốc kế hoạch ↗</div>
              <div class="text-xl font-black text-purple-700 mt-0.5">${actCount}</div>
            </button>
          </div>

          ${renderAdminRoundTimelinePreview(r)}

          <div class="p-3 sm:p-4 bg-white flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'timeline')" class="flex-1 sm:flex-initial min-w-[120px] sm:min-w-0 text-center px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800 transition shadow-2xs cursor-pointer">📅 Kế hoạch (${actCount})</button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'eligible-students')" class="flex-1 sm:flex-initial min-w-[120px] sm:min-w-0 text-center px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800 transition shadow-2xs cursor-pointer">🎓 Sinh viên (${eligibleCount})</button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'registrations')" class="flex-1 sm:flex-initial min-w-[120px] sm:min-w-0 text-center px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 transition shadow-2xs cursor-pointer">📝 Đăng ký (${regCount})</button>
            ${directAssignment ? '' : `<button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'review')" class="flex-1 sm:flex-initial min-w-[120px] sm:min-w-0 text-center px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-800 transition shadow-2xs cursor-pointer">🎯 Xét nguyện vọng</button>`}
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'review', 'assigned')" class="flex-1 sm:flex-initial min-w-[120px] sm:min-w-0 text-center px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-800 transition shadow-2xs cursor-pointer">👥 ${directAssignment ? 'Phân công GVHD' : 'Kết quả phân công'}</button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'scoring-dashboard')" class="flex-1 sm:flex-initial min-w-[120px] sm:min-w-0 text-center px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-300 text-slate-800 transition shadow-2xs cursor-pointer">📊 Quản lý điểm</button>
            <div class="w-full sm:w-auto flex items-center justify-center gap-1.5 mt-1 sm:mt-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-100 sm:border-slate-200 sm:pl-2 text-xs">
              ${!isCurrentActive ? `<button type="button" onclick="setActiveRound('${r.id}')" class="px-2.5 py-1.5 text-blue-700 hover:bg-blue-50 rounded-lg font-bold transition cursor-pointer">⭐ Hiện hành</button>` : ''}
              <button type="button" onclick="softDeleteRound('${r.id}')" class="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition cursor-pointer">🗑️ Thùng rác</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (renderErr) {
    console.error('[Rounds] renderAdminRoundsCards error:', renderErr);
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-rose-200 rounded-2xl w-full">
        <div class="text-3xl text-rose-500 font-bold">⚠️</div>
        <p class="text-base font-bold text-rose-800">Lỗi hiển thị danh sách đợt tốt nghiệp.</p>
        <p class="text-xs text-slate-500">${escapeHtml(renderErr.message || String(renderErr))}</p>
        <div class="pt-2">
          <button type="button" onclick="renderAdminRoundsCards()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
            🔄 Thử lại
          </button>
        </div>
      </div>
    `;
  }
};

window.navigateToRoundAction = async function(roundId, actionKey, subSection = null) {
  if (!roundId) return;
  state.selectedRoundId = roundId;
  state.activeRound = (state.rounds || []).find(r => r.id === roundId) || null;

  // Sync selectors across all admin views
  const dropdownIds = [
    'select-active-round',
    'admin-timeline-round-select',
    'admin-round-student-select',
    'admin-round-reg-select',
    'admin-review-round-select',
    'admin-round-sup-select',
    'admin-scoring-round-select'
  ];
  dropdownIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = roundId;
  });

  if (typeof window.switchAdminTab === 'function') {
    await window.switchAdminTab(actionKey);
  }

  if (actionKey === 'review' && subSection === 'assigned') {
    setTimeout(() => {
      const targetSection = document.getElementById('admin-official-supervisors-section') ||
                            document.getElementById('admin-assigned-supervisors-tbody') ||
                            document.getElementById('admin-review-assigned-card');
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  }
};

window.openRoundWorkspaceModal = async function(roundId, actionKey, subSection = null) {
  if (!roundId || !actionKey) return;
  if (state.roundWorkspaceModal?.panel) window.closeRoundWorkspaceModal();

  await window.navigateToRoundAction(roundId, actionKey, subSection);

  const panel = document.getElementById(`atab-panel-${actionKey}`);
  const modal = document.getElementById('modal-round-workspace');
  const body = document.getElementById('modal-round-workspace-body');
  const title = document.getElementById('modal-round-workspace-title');
  const subtitle = document.getElementById('modal-round-workspace-subtitle');
  if (!panel || !modal || !body) return;

  const round = (state.rounds || []).find(item => item.id === roundId);
  const labels = {
    timeline: 'Kế hoạch đợt',
    'eligible-students': 'Danh sách sinh viên',
    registrations: 'Danh sách đăng ký',
    review: isDirectSupervisorAssignment(round) ? 'Phân công GVHD' : 'Xét nguyện vọng & Phân công',
    'scoring-dashboard': 'Quản lý điểm'
  };

  const placeholder = document.createComment(`round-workspace-${actionKey}`);
  panel.parentNode?.insertBefore(placeholder, panel);
  body.replaceChildren(panel);
  panel.classList.remove('hidden');

  state.roundWorkspaceModal = {
    panel,
    placeholder,
    previousBodyOverflow: document.body.style.overflow
  };
  if (title) title.textContent = labels[actionKey] || 'Quản lý đợt tốt nghiệp';
  if (subtitle) subtitle.textContent = round?.title || 'Đợt tốt nghiệp';
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');

  if (actionKey === 'review' && subSection === 'assigned') {
    setTimeout(() => {
      document.getElementById('admin-official-supervisors-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }
};

window.closeRoundWorkspaceModal = function() {
  const modalState = state.roundWorkspaceModal;
  const modal = document.getElementById('modal-round-workspace');
  if (modalState?.panel && modalState?.placeholder?.parentNode) {
    modalState.placeholder.parentNode.insertBefore(modalState.panel, modalState.placeholder);
    modalState.placeholder.remove();
    modalState.panel.classList.add('hidden');
  }
  document.body.style.overflow = modalState?.previousBodyOverflow || '';
  state.roundWorkspaceModal = null;
  modal?.classList.add('hidden');
  window.switchAdminTab('rounds');
};

window.updateRoundBreadcrumb = function(tabKey) {
  const roundSubTabs = ['timeline', 'eligible-students', 'registrations', 'review', 'preview-student', 'scoring-dashboard'];
  if (!roundSubTabs.includes(tabKey)) return;

  const bEl = document.getElementById(`round-breadcrumb-${tabKey}`);
  if (!bEl) return;

  const currentRound = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const roundTitle = currentRound ? (currentRound.title || 'Đợt tốt nghiệp') : 'Chưa chọn đợt';
  const roundYear = currentRound ? (currentRound.academicYear || '') : '';

  const tabLabels = {
    'timeline': 'Kế hoạch đợt',
    'eligible-students': 'Danh sách SV thực hiện',
    'registrations': 'Danh sách đăng ký',
    'review': 'Xét nguyện vọng',
    'preview-student': 'Xem trước giao diện Sinh viên',
    'scoring-dashboard': 'Quản lý điểm'
  };
  const currentLabel = tabKey === 'review' && isDirectSupervisorAssignment(currentRound)
    ? 'Phân công GVHD'
    : (tabLabels[tabKey] || tabKey);

  bEl.innerHTML = `
    <div class="flex items-center justify-between gap-3 bg-slate-100/90 hover:bg-slate-100 px-4 py-3 rounded-xl border border-slate-200/80 text-sm transition-colors">
      <div class="flex items-center gap-2 min-w-0">
        <button type="button" onclick="switchAdminTab('rounds')" class="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 shrink-0 transition-colors">
          <span>←</span>
          <span>Đợt tốt nghiệp</span>
        </button>
        <span class="text-slate-300 font-bold">/</span>
        <span class="font-bold text-slate-800 truncate" title="${roundTitle}">${roundTitle}</span>
        <span class="text-slate-300 font-bold">/</span>
        <span class="text-slate-500 font-semibold shrink-0">${currentLabel}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${roundYear ? `<span class="text-xs font-bold px-2.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">${roundYear}</span>` : ''}
        <button type="button" onclick="switchAdminTab('rounds')" class="text-xs text-slate-500 hover:text-slate-900 font-medium underline">Đổi đợt</button>
      </div>
    </div>
  `;
};

window.duplicateRoundModal = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) {
    showToast('Không tìm thấy đợt tốt nghiệp cần sao chép!', 'error');
    return;
  }

  // Open create round modal
  await window.openCreateRoundModal();

  // Populate from source
  document.getElementById('modal-round-title').textContent = 'Sao chép Đợt Đồ án Tốt nghiệp';
  document.getElementById('round-form-id').value = '';
  document.getElementById('round-form-title').value = `(Bản sao) ${r.title || ''}`;
  document.getElementById('round-form-year').value = r.academicYear || '';
  document.getElementById('round-form-name').value = `${(r.shortCode || r.slug || 'round')}-copy`;
  document.getElementById('round-form-status').value = 'draft';
  document.getElementById('round-form-pref-count').value = r.preferenceCount || '3';
  document.getElementById('round-form-selection-mode').value = r.selectionMode || 'cards';
  const assignmentMode = getSupervisorAssignmentMode(r);
  const assignmentModeInput = document.querySelector(`input[name="supervisor-assignment-mode"][value="${assignmentMode}"]`);
  if (assignmentModeInput) assignmentModeInput.checked = true;
  if (document.getElementById('round-form-allow-edit')) {
    document.getElementById('round-form-allow-edit').checked = r.allowStudentEdit !== false;
  }
  if (document.getElementById('round-form-allow-topic-edit')) {
    document.getElementById('round-form-allow-topic-edit').checked = r.allowTopicEdit !== false;
  }
  if (document.getElementById('round-form-allow-pref-edit')) {
    document.getElementById('round-form-allow-pref-edit').checked = r.allowPreferenceEdit !== false;
  }

  const folderNamesInput = document.getElementById('round-drive-subfolder-names');
  if (folderNamesInput) {
    folderNamesInput.value = normalizeRoundDriveFolderNames(
      r.driveSubfolderNames || (r.driveFolderStructure || []).map(item => item?.name || item?.folderName)
    ).join('\n');
    updateRoundDriveFolderPreview();
  }

  showToast('Đã điền thông tin từ đợt gốc. Vui lòng kiểm tra và lưu đợt mới.', 'info');
};

window.toggleRoundCloseStatus = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;
  const isClosed = (r.status === 'closed') || (r.closeAtDate && Date.now() > new Date(r.closeAtDate).getTime());
  const newStatus = isClosed ? 'open' : 'closed';
  const actionText = isClosed ? 'Mở lại' : 'Kết thúc';

  const ok = await showConfirm(`Xác nhận ${actionText.toLowerCase()} đợt "${r.title}"?`);
  if (!ok) return;

  try {
    showLoading(`Đang ${actionText.toLowerCase()} đợt...`);
    const payload = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };
    if (isClosed) {
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      payload.closeAt = in30d;
      payload.status = 'open';
    }
    await updateDoc(doc(db, 'graduationRounds', roundId), payload);
    r.status = payload.status;
    if (payload.closeAt) r.closeAtDate = payload.closeAt;
    showToast(`Đã ${actionText.toLowerCase()} đợt thành công!`, 'success');
    renderAdminRoundsCards();
  } catch (err) {
    console.error('toggleRoundCloseStatus error:', err);
    showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

window.toggleRoundHiddenStatus = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;
  const isHidden = r.hidden || r.status === 'hidden';
  const newHidden = !isHidden;
  const actionText = newHidden ? 'Ẩn' : 'Bỏ ẩn (Hiện)';

  const ok = await showConfirm(`Xác nhận ${actionText.toLowerCase()} đợt "${r.title}"?`);
  if (!ok) return;

  try {
    showLoading(`Đang ${actionText.toLowerCase()} đợt...`);
    const payload = {
      hidden: newHidden,
      status: newHidden ? 'hidden' : 'open',
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db, 'graduationRounds', roundId), payload);
    r.hidden = newHidden;
    r.status = payload.status;
    showToast(`Đã ${actionText.toLowerCase()} đợt thành công!`, 'success');
    renderAdminRoundsCards();
  } catch (err) {
    console.error('toggleRoundHiddenStatus error:', err);
    showToast('Lỗi cập nhật trạng thái ẩn: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
    if (typeof refreshRoundCardMetrics !== 'undefined') window.refreshRoundCardMetrics = refreshRoundCardMetrics;
      if (typeof resolveStudentSupervisorProfiles !== 'undefined') window.resolveStudentSupervisorProfiles = resolveStudentSupervisorProfiles;
        if (typeof renderAdminTrashTable !== 'undefined') window.renderAdminTrashTable = renderAdminTrashTable;
  if (typeof renderAdminRoundsTable !== 'undefined') window.renderAdminRoundsTable = renderAdminRoundsTable;
  if (typeof getRoundStatusCategory !== 'undefined') window.getRoundStatusCategory = getRoundStatusCategory;
                              }
