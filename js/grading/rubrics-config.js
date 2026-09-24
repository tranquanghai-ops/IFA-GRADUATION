/**
 * IFA+ Graduation — Rubric & Letter Criteria Configuration Submodule
 */
// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: SCORING CONFIG & COUNCIL OPERATION MODULE
// ============================================================================

// 1. SCORING CONFIG HELPERS
window.toggleActivityScoringConfig = function(enabled) {
  const panel = document.getElementById('activity-scoring-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.switchActivityScoringMode = function(mode) {
  const numWrap = document.getElementById('activity-scoring-numeric-wrap');
  const letterWrap = document.getElementById('activity-scoring-letter-wrap');
  const rubricWrap = document.getElementById('activity-scoring-rubric-wrap');
  const rNum = document.querySelector('input[name="activity_scoring_mode"][value="numeric"]');
  const rLet = document.querySelector('input[name="activity_scoring_mode"][value="letter"]');
  const rRub = document.querySelector('input[name="activity_scoring_mode"][value="defense_rubric"]');

  if (mode === 'letter') {
    if (rLet) rLet.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.remove('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  } else if (mode === 'defense_rubric') {
    if (rRub) rRub.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.remove('hidden');
    renderActivityRubricList();
  } else {
    if (rNum) rNum.checked = true;
    if (numWrap) numWrap.classList.remove('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  }
};

window.renderActivityRubricList = function() {
  const container = document.getElementById('activity-scoring-rubric-list');
  const totalMaxEl = document.getElementById('activity-scoring-rubric-total-max');
  if (!container) return;

  const list = state._currentActivityRubric || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có tiêu chí nào. Bấm "+ Thêm tiêu chí".</div>';
    if (totalMaxEl) totalMaxEl.textContent = '0.0';
    return;
  }

  let totalMax = 0;
  container.innerHTML = list.map((crit, idx) => {
    totalMax += Number(crit.maxScore || 0);
    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-slate-400">#${idx + 1}</span>
          <span class="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">${crit.key}</span>
          <span class="font-bold text-slate-900">${crit.label}</span>
          <span class="text-emerald-700 font-bold font-mono">(${crit.maxScore}đ)</span>
          ${crit.description ? `<span class="text-[10px] text-slate-400 truncate max-w-xs">(${crit.description})</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 text-[11px]">
          <button type="button" onclick="editRubricCriterion('${crit.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
          <button type="button" onclick="deleteRubricCriterion('${crit.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
        </div>
      </div>
    `;
  }).join('');

  if (totalMaxEl) totalMaxEl.textContent = totalMax.toFixed(1);
};

window.openAddRubricCriterionModal = function() {
  document.getElementById('rubric-criterion-id').value = '';
  document.getElementById('rubric-criterion-key').value = '';
  document.getElementById('rubric-criterion-label').value = '';
  document.getElementById('rubric-criterion-max').value = '2.5';
  document.getElementById('rubric-criterion-desc').value = '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Thêm tiêu chí Rubric mới';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.closeRubricCriterionModal = function() {
  document.getElementById('modal-rubric-criterion')?.classList.add('hidden');
};

window.editRubricCriterion = function(id) {
  const crit = (state._currentActivityRubric || []).find(c => c.id === id);
  if (!crit) return;
  document.getElementById('rubric-criterion-id').value = crit.id;
  document.getElementById('rubric-criterion-key').value = crit.key;
  document.getElementById('rubric-criterion-label').value = crit.label;
  document.getElementById('rubric-criterion-max').value = crit.maxScore;
  document.getElementById('rubric-criterion-desc').value = crit.description || '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Chỉnh sửa tiêu chí Rubric';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.deleteRubricCriterion = function(id) {
  state._currentActivityRubric = (state._currentActivityRubric || []).filter(c => c.id !== id);
  renderActivityRubricList();
};

window.saveRubricCriterion = function() {
  const id = document.getElementById('rubric-criterion-id')?.value?.trim();
  const key = document.getElementById('rubric-criterion-key')?.value?.trim().toLowerCase();
  const label = document.getElementById('rubric-criterion-label')?.value?.trim();
  const maxScore = parseFloat(document.getElementById('rubric-criterion-max')?.value);
  const desc = document.getElementById('rubric-criterion-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã tiêu chí và Tên tiêu chí!', 'warning');
    return;
  }
  if (isNaN(maxScore) || maxScore <= 0) {
    showToast('Điểm tối đa của tiêu chí phải là số dương (> 0)!', 'warning');
    return;
  }

  state._currentActivityRubric = state._currentActivityRubric || [];
  
  // Check duplicate key
  const duplicate = state._currentActivityRubric.find(c => c.key === key && c.id !== id);
  if (duplicate) {
    showToast(`Mã tiêu chí "${key}" đã tồn tại! Vui lòng chọn mã khác.`, 'warning');
    return;
  }

  if (id) {
    const idx = state._currentActivityRubric.findIndex(c => c.id === id);
    if (idx >= 0) {
      state._currentActivityRubric[idx] = {
        ...state._currentActivityRubric[idx],
        key,
        label,
        maxScore,
        description: desc
      };
    }
  } else {
    const newId = 'crit_' + Date.now().toString(36);
    state._currentActivityRubric.push({
      id: newId,
      key,
      label,
      maxScore,
      description: desc,
      order: state._currentActivityRubric.length + 1
    });
  }

  closeRubricCriterionModal();
  renderActivityRubricList();
};

window.renderActivityLetterOptions = function() {
  const container = document.getElementById('activity-scoring-letter-list');
  if (!container) return;
  const list = state._currentActivityLetterOptions || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có mức điểm chữ nào. Bấm "+ Thêm mức điểm" hoặc "↺ Khôi phục mặc định".</div>';
    return;
  }
  container.innerHTML = list.map((opt, idx) => {
    const numDisplay = (typeof opt.numericValue === 'number' && !isNaN(opt.numericValue))
      ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-xs font-bold" title="Điểm quy đổi nội bộ của Admin">Quy đổi: ${opt.numericValue} điểm</span>`
      : `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono text-[10px]" title="Chưa cấu hình điểm quy đổi">Chưa có điểm quy đổi</span>`;

    return `
    <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono text-xs">${escapeHtml(opt.key || opt.code || '')}</span>
        <span class="font-bold text-slate-800 text-xs">${escapeHtml(opt.label || '')}</span>
        ${numDisplay}
        ${opt.description ? `<span class="text-[10px] text-slate-400">(${escapeHtml(opt.description)})</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5 text-[11px] shrink-0">
        <button type="button" onclick="editLetterOption('${opt.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        <button type="button" onclick="deleteLetterOption('${opt.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </div>
    </div>
  `;
  }).join('');
};

window.resetDefaultLetterOptions = async function() {
  if (!await showConfirm('Khôi phục thang điểm chữ', 'Thao tác sẽ thay thế danh sách mức điểm chữ hiện tại bằng bộ mặc định đầy đủ 13 mức (A++ → D-). Bạn có muốn tiếp tục?', { confirmText: 'Khôi phục' })) {
    return;
  }
  state._currentActivityLetterOptions = JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));
  renderActivityLetterOptions();
  showToast('Đã khôi phục bộ 13 mức điểm chữ mặc định (A++ → D-)!', 'success');
};

window.openAddLetterOptionModal = function() {
  document.getElementById('letter-option-id').value = '';
  document.getElementById('letter-option-key').value = '';
  document.getElementById('letter-option-label').value = '';
  document.getElementById('letter-option-numeric').value = '';
  document.getElementById('letter-option-desc').value = '';
  document.getElementById('modal-letter-option-title').textContent = 'Thêm mức điểm chữ mới';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.closeLetterOptionModal = function() {
  document.getElementById('modal-add-letter-option')?.classList.add('hidden');
};

window.editLetterOption = function(id) {
  const opt = (state._currentActivityLetterOptions || []).find(o => o.id === id);
  if (!opt) return;
  document.getElementById('letter-option-id').value = opt.id;
  document.getElementById('letter-option-key').value = opt.key || opt.code || '';
  document.getElementById('letter-option-label').value = opt.label || '';
  document.getElementById('letter-option-numeric').value = (typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) ? opt.numericValue : '';
  document.getElementById('letter-option-desc').value = opt.description || '';
  document.getElementById('modal-letter-option-title').textContent = 'Chỉnh sửa mức điểm chữ';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.deleteLetterOption = function(id) {
  state._currentActivityLetterOptions = (state._currentActivityLetterOptions || []).filter(o => o.id !== id);
  renderActivityLetterOptions();
};

window.saveLetterOption = function() {
  const id = document.getElementById('letter-option-id')?.value?.trim();
  const key = document.getElementById('letter-option-key')?.value?.trim().toUpperCase();
  const label = document.getElementById('letter-option-label')?.value?.trim();
  const numRaw = document.getElementById('letter-option-numeric')?.value?.trim();
  const desc = document.getElementById('letter-option-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã mức điểm và Nhãn hiển thị', 'warning');
    return;
  }

  const numericValue = parseFloat(numRaw);
  if (isNaN(numericValue) || numericValue < 0 || numericValue > 10) {
    showToast('Vui lòng nhập Điểm quy đổi hợp lệ từ 0 đến 10 (ví dụ: 10, 9.5, 8.0...)', 'warning');
    document.getElementById('letter-option-numeric')?.focus();
    return;
  }

  state._currentActivityLetterOptions = state._currentActivityLetterOptions || [];
  if (id) {
    const idx = state._currentActivityLetterOptions.findIndex(o => o.id === id);
    if (idx >= 0) {
      state._currentActivityLetterOptions[idx] = {
        id,
        key,
        code: key,
        label,
        numericValue: Number(numericValue.toFixed(2)),
        description: desc
      };
    }
  } else {
    const newId = 'opt_' + Date.now().toString(36);
    state._currentActivityLetterOptions.push({
      id: newId,
      key,
      code: key,
      label,
      numericValue: Number(numericValue.toFixed(2)),
      description: desc
    });
  }

  closeLetterOptionModal();
  renderActivityLetterOptions();
};

// 2. AUTHORIZATION & REQUIRED SCORERS HELPERS

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof toggleActivityScoringConfig !== 'undefined') window.toggleActivityScoringConfig = toggleActivityScoringConfig;
  if (typeof switchActivityScoringMode !== 'undefined') window.switchActivityScoringMode = switchActivityScoringMode;
  if (typeof renderActivityRubricList !== 'undefined') window.renderActivityRubricList = renderActivityRubricList;
  if (typeof openAddRubricCriterionModal !== 'undefined') window.openAddRubricCriterionModal = openAddRubricCriterionModal;
  if (typeof closeRubricCriterionModal !== 'undefined') window.closeRubricCriterionModal = closeRubricCriterionModal;
  if (typeof editRubricCriterion !== 'undefined') window.editRubricCriterion = editRubricCriterion;
  if (typeof deleteRubricCriterion !== 'undefined') window.deleteRubricCriterion = deleteRubricCriterion;
  if (typeof saveRubricCriterion !== 'undefined') window.saveRubricCriterion = saveRubricCriterion;
  if (typeof renderActivityLetterOptions !== 'undefined') window.renderActivityLetterOptions = renderActivityLetterOptions;
  if (typeof resetDefaultLetterOptions !== 'undefined') window.resetDefaultLetterOptions = resetDefaultLetterOptions;
  if (typeof openAddLetterOptionModal !== 'undefined') window.openAddLetterOptionModal = openAddLetterOptionModal;
  if (typeof closeLetterOptionModal !== 'undefined') window.closeLetterOptionModal = closeLetterOptionModal;
  if (typeof editLetterOption !== 'undefined') window.editLetterOption = editLetterOption;
  if (typeof deleteLetterOption !== 'undefined') window.deleteLetterOption = deleteLetterOption;
  if (typeof saveLetterOption !== 'undefined') window.saveLetterOption = saveLetterOption;
}
