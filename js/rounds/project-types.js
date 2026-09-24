// --- ADMIN: PROJECT TYPES CRUD ---
function renderAdminProjectTypesTable() {
  const tbody = document.getElementById('admin-project-types-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.projectTypes.map((p, idx) => `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5 font-mono font-bold text-slate-400">${idx + 1}</td>
      <td class="p-3.5 font-bold text-slate-900">${p.name}</td>
      <td class="p-3.5">
        <span class="badge ${p.active !== false ? 'badge-open' : 'badge-closed'}">${p.active !== false ? 'Hiển thị' : 'Đang ẩn'}</span>
      </td>
      <td class="p-3.5 text-right space-x-2">
        <button onclick="editProjectTypeModal('${p.id}')" class="text-blue-600 hover:underline font-bold text-xs">Sửa</button>
        <button onclick="toggleProjectTypeActive('${p.id}', ${p.active !== false})" class="text-slate-600 hover:underline font-bold text-xs">${p.active !== false ? 'Ẩn' : 'Hiện'}</button>
        <button onclick="deleteProjectType('${p.id}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>
      </td>
    </tr>
  `).join('');
}

window.editProjectTypeModal = function(id) {
  const pt = state.projectTypes.find(p => p.id === id);
  if (!pt) return;
  document.getElementById('pt-form-id').value = pt.id;
  document.getElementById('pt-form-name').value = pt.name || '';
  document.getElementById('pt-form-order').value = pt.order || 1;
  document.getElementById('pt-form-active').checked = pt.active !== false;
  document.getElementById('modal-project-type').classList.remove('hidden');
};

window.deleteProjectType = async function(id) {
  const pt = state.projectTypes.find(p => p.id === id);
  if (!pt) return;

  // Check if used in any rounds
  const inUse = state.rounds.some(r => (r.allowedProjectTypes || []).includes(pt.name));
  let msg = `Xóa loại hình đồ án "${pt.name}"?`;
  if (inUse) {
    msg = `⚠️ CẢNH BÁO: Loại hình đồ án "${pt.name}" đang được sử dụng trong các đợt tốt nghiệp!\n\nBạn có chắc chắn muốn xóa không?`;
  }

  const confirmed = await showConfirm('Xóa Loại hình Đồ án', msg, { confirmText: 'Xóa vĩnh viễn', danger: true });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'graduationProjectTypes', id));
    showToast(`Đã xóa loại hình "${pt.name}".`, 'success');
    await loadProjectTypes();
  } catch (err) {
    showToast('Lỗi xóa loại hình: ' + err.message, 'error');
  }
};

window.openAddProjectTypeModal = function() {
  document.getElementById('form-project-type').reset();
  document.getElementById('pt-form-id').value = '';
  document.getElementById('pt-form-order').value = state.projectTypes.length + 1;
  document.getElementById('modal-project-type').classList.remove('hidden');
};

window.closeProjectTypeModal = function() {
  document.getElementById('modal-project-type').classList.add('hidden');
};

window.saveProjectType = async function(e) {
  e.preventDefault();
  const id = document.getElementById('pt-form-id')?.value;
  const name = document.getElementById('pt-form-name').value.trim();
  const order = parseInt(document.getElementById('pt-form-order').value, 10) || 1;
  const active = document.getElementById('pt-form-active').checked;

  if (!name) {
    showToast('Vui lòng nhập tên loại hình đồ án.', 'error');
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, 'graduationProjectTypes', id), {
        name, order, active, updatedAt: serverTimestamp()
      });
      showToast('Đã cập nhật loại hình đồ án thành công!', 'success');
    } else {
      await addDoc(collection(db, 'graduationProjectTypes'), {
        name, order, active, createdAt: serverTimestamp()
      });
      showToast('Đã thêm loại hình đồ án thành công!', 'success');
    }
    closeProjectTypeModal();
    await loadProjectTypes();
  } catch (err) {
    showToast('Lỗi lưu loại hình: ' + err.message, 'error');
  }
};

window.toggleProjectTypeActive = async function(id, currentActive) {
  try {
    await updateDoc(doc(db, 'graduationProjectTypes', id), { active: !currentActive });
    await loadProjectTypes();
  } catch (e) {
    showToast('Lỗi cập nhật: ' + e.message, 'error');
  }
};


// 3. AUDIT LOGS SUBCOLLECTION HELPERS (APPEND-ONLY + DUAL-READ)
window.appendAuditLogRecord = async function(roundId, auditData) {
  if (!roundId || !auditData) return;

  const logId = auditData.id || ('log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const docPayload = {
    id: logId,
    roundId,
    type: auditData.type || 'info',
    action: auditData.action || 'Hành động',
    target: auditData.target || '',
    detail: auditData.detail || '',
    by: auditData.by || state.user?.email || 'system',
    timestamp: auditData.timestamp || new Date().toISOString()
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/auditLogs/{logId}
  try {
    const logRef = doc(db, 'graduationRounds', roundId, 'auditLogs', logId);
    await setDoc(logRef, docPayload);
  } catch (err) {
    console.warn('Notice: Subcollection auditLogs write pending rules approval:', err.message);
  }

  // 2. In-memory append to round
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (targetRound) {
    targetRound.auditLogs = targetRound.auditLogs || [];
    targetRound.auditLogs.unshift(docPayload);
  }
};

window.getRoundAuditLogs = async function(roundId, fallbackRound) {
  const targetRound = fallbackRound || (state.rounds || []).find(r => r.id === roundId);
  const legacyLogs = Array.isArray(targetRound?.auditLogs) ? targetRound.auditLogs : [];

  try {
    const logColRef = collection(db, 'graduationRounds', roundId, 'auditLogs');
    const snap = await getDocs(logColRef);
    if (snap && !snap.empty) {
      const subLogs = snap.docs.map(d => d.data());
      // Union and deduplicate by ID
      const map = new Map();
      subLogs.forEach(l => map.set(l.id, l));
      legacyLogs.forEach(l => {
        if (!map.has(l.id)) map.set(l.id, l);
      });
      return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  } catch (e) {}

  return legacyLogs;
};


// ============================================================================

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderAdminProjectTypesTable !== 'undefined') window.renderAdminProjectTypesTable = renderAdminProjectTypesTable;
}
