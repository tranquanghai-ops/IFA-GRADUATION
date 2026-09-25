/**
 * IFA+ Graduation — Round Modal Weekly Timeline & Activities Editor Module
 */
// ROUND CONFIGURATION: 4 SECTIONS (A: INFO, B: ELIGIBLE, C: SUPERVISORS, D: CONFIG)
// ============================================================================

state.roundModalEligibleStudents = [];
state.roundModalSupervisors = new Map(); // supId -> { supervisorId, name, email, department, photoUrl, maxQuota }

window.switchRoundModalTab = function(tabKey) {
  ['info', 'eligible', 'supervisors', 'config'].forEach(k => {
    const btn = document.getElementById('round-tab-btn-' + k);
    const panel = document.getElementById('round-modal-panel-' + k);
    if (btn) {
      if (k === tabKey) {
        btn.classList.remove('border-transparent', 'text-slate-500');
        btn.classList.add('border-tdtu-blue', 'text-tdtu-blue');
      } else {
        btn.classList.remove('border-tdtu-blue', 'text-tdtu-blue');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    }
    if (panel) {
      if (k === tabKey) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  updateRoundModalConfigSummary();
};

export function getSupervisorDefaultAndMaxQuota(s) {
  const empType = String(s?.employmentType || 'internal').toLowerCase().trim();
  const isAdjunct = (empType === 'adjunct' || empType === 'thinhgiang' || empType === 'thỉnh giảng' || empType === 'external');
  const maxCap = isAdjunct ? 5 : 10;

  let defQuota = maxCap;
  if (typeof s?.defaultQuota === 'number' && s.defaultQuota > 0) {
    defQuota = Math.min(s.defaultQuota, maxCap);
  } else if (typeof s?.maxQuota === 'number' && s.maxQuota > 0) {
    defQuota = Math.min(s.maxQuota, maxCap);
  }
  return {
    employmentType: isAdjunct ? 'adjunct' : 'internal',
    maxCap: maxCap,
    defaultQuota: defQuota
  };
}
window.getSupervisorDefaultAndMaxQuota = getSupervisorDefaultAndMaxQuota;

export async function ensureSupervisorsMasterLoaded(force = false) {
  if (!force && Array.isArray(state.supervisorsMaster) && state.supervisorsMaster.length > 0) {
    return state.supervisorsMaster;
  }
  try {
    const snap = await getDocs(query(collection(db, 'supervisorMaster'), orderBy('name', 'asc')));
    state.supervisorsMaster = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Error loading supervisorMaster:', e);
  }
  return state.supervisorsMaster || [];
}
window.ensureSupervisorsMasterLoaded = ensureSupervisorsMasterLoaded;

function updateRoundModalBadges() {
  const elCountBadge = document.getElementById('round-tab-eligible-count');
  const elCountCard = document.getElementById('round-eligible-count-badge');
  const supCountBadge = document.getElementById('round-tab-sup-count');
  const supCountCard = document.getElementById('round-sup-count-badge');

  const elCount = (state.roundModalEligibleStudents || []).length;
  const supCount = state.roundModalSupervisors ? state.roundModalSupervisors.size : 0;

  if (elCountBadge) elCountBadge.textContent = elCount;
  if (elCountCard) elCountCard.textContent = `${elCount} SV`;
  if (supCountBadge) supCountBadge.textContent = supCount;
  if (supCountCard) supCountCard.textContent = `${supCount} GVHD`;

  updateRoundModalConfigSummary();
}

function updateRoundModalConfigSummary() {
  const elStatus = document.getElementById('round-summary-eligible-status');
  const supStatus = document.getElementById('round-summary-sup-status');
  const alertBox = document.getElementById('round-config-alert');

  const elCount = state.roundModalEligibleStudents.length;
  const supCount = state.roundModalSupervisors.size;

  if (elStatus) {
    if (elCount > 0) {
      elStatus.className = 'font-bold text-emerald-600';
      elStatus.textContent = `${elCount} SV (✓ Đạt)`;
    } else {
      elStatus.className = 'font-bold text-amber-600';
      elStatus.textContent = '0 SV (⚠️ Chưa có)';
    }
  }

  if (supStatus) {
    if (supCount > 0) {
      supStatus.className = 'font-bold text-emerald-600';
      supStatus.textContent = `${supCount} GV (✓ Đạt)`;
    } else {
      supStatus.className = 'font-bold text-amber-600';
      supStatus.textContent = '0 GV (⚠️ Chưa có)';
    }
  }

  if (alertBox) {
    const allowPre = document.getElementById('round-allow-pre-eligibility')?.checked === true;
    if (supCount > 0 && (elCount > 0 || allowPre)) {
      alertBox.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold leading-relaxed';
      alertBox.innerHTML = (allowPre && elCount === 0)
        ? '✓ Đợt bật chế độ <b>Đăng ký trước điều kiện (Pre-eligibility)</b>. Sẵn sàng lưu và mở đăng ký để SV nộp nguyện vọng (trạng thái Chờ xét).'
        : '✓ Đợt đã hoàn tất cấu hình đầy đủ. Sẵn sàng kích hoạt thành Đợt hiện hành khi cần.';
    } else {
      alertBox.className = 'p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold leading-relaxed';
      const missing = [];
      if (elCount === 0 && !allowPre) missing.push('SV đủ điều kiện');
      if (supCount === 0) missing.push('GVHD tham gia');
      alertBox.innerHTML = `⚠️ Đợt chưa hoàn tất cấu hình (còn thiếu ${missing.join(' & ')}). Bạn vẫn có thể bấm <b>"Lưu Đợt"</b> dưới dạng bản nháp để bổ sung sau.`;
    }
  }
}

// ── Weekly Content Editor (Admin) ──────────────────────────────────────────
// Renders 12 (or durationWeeks) input cards in #round-weekly-content-grid
function getRoundWeekDaysFromForm(weekNumber) {
  const rawStart = document.getElementById('round-form-start-date')?.value || '';
  let monday;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawStart)) {
    const [year, month, day] = rawStart.split('-').map(Number);
    monday = new Date(year, month - 1, day);
  } else {
    monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
  }
  const weekday = monday.getDay();
  monday.setDate(monday.getDate() - weekday + (weekday === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  const pad = value => String(value).padStart(2, '0');
  const weekStart = new Date(monday.getTime() + (Number(weekNumber) - 1) * 7 * 86400000);
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const date = new Date(weekStart.getTime() + dayIndex * 86400000);
    return {
      dayIndex,
      shortName: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dayIndex],
      label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`,
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    };
  });
}

function getRoundWeekDraftEvents(weekNumber) {
  if (!state.roundWeekEventsDraft) state.roundWeekEventsDraft = {};
  return Array.isArray(state.roundWeekEventsDraft[weekNumber]) ? state.roundWeekEventsDraft[weekNumber] : [];
}

function normalizeRoundWeekEventColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#dc2626';
}

const ROUND_WEEK_EVENT_COLORS = [
  ['#dc2626', 'Đỏ'], ['#ea580c', 'Cam'], ['#d97706', 'Hổ phách'], ['#ca8a04', 'Vàng'],
  ['#65a30d', 'Xanh lá nhạt'], ['#16a34a', 'Xanh lá'], ['#0f766e', 'Xanh ngọc'], ['#0891b2', 'Xanh cyan'],
  ['#2563eb', 'Xanh dương'], ['#4f46e5', 'Chàm'], ['#7e22ce', 'Tím'], ['#db2777', 'Hồng']
];

function setActivityFormColor(value) {
  const selected = normalizeRoundWeekEventColor(value);
  const input = document.getElementById('activity-form-color');
  const options = document.getElementById('activity-form-color-options');
  if (input) input.value = selected;
  if (!options) return;
  options.innerHTML = ROUND_WEEK_EVENT_COLORS.map(([color, label]) =>
    `<button type="button" data-color="${color}" aria-label="${label}" title="${label}" aria-pressed="${color === selected}" onclick="setActivityFormColor('${color}')" class="h-7 w-7 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110 ${color === selected ? 'ring-2 ring-slate-800 ring-offset-2' : ''}" style="background-color:${color}"></button>`
  ).join('');
}
window.setActivityFormColor = setActivityFormColor;

function getRoundWeekEditingEventId(weekNumber) {
  return state.roundWeekEditingEvents?.[weekNumber] || '';
}

function setRoundWeekEventFormMode(weekNumber, eventId = '') {
  if (!state.roundWeekEditingEvents) state.roundWeekEditingEvents = {};
  if (eventId) state.roundWeekEditingEvents[weekNumber] = eventId;
  else delete state.roundWeekEditingEvents[weekNumber];
  const submitBtn = document.getElementById(`round-week-${weekNumber}-event-submit`);
  const cancelBtn = document.getElementById(`round-week-${weekNumber}-event-cancel`);
  if (submitBtn) submitBtn.textContent = eventId ? 'Lưu chỉnh sửa sự kiện' : 'Thêm khoảng sự kiện';
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !eventId);
}

function updateRoundWeekEventColorPresets(weekNumber, value) {
  const color = normalizeRoundWeekEventColor(value);
  document.querySelectorAll(`[data-round-week-event-color="${weekNumber}"]`).forEach(button => {
    const active = button.dataset.color === color;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('ring-2', active);
    button.classList.toggle('ring-slate-700', active);
    button.classList.toggle('ring-offset-1', active);
  });
}

function getRoundWeekEventRange(event = {}) {
  const fallback = Math.max(0, Math.min(6, Number(event.dayIndex) || 0));
  let startDayIndex = Number.isInteger(Number(event.startDayIndex))
    ? Math.max(0, Math.min(6, Number(event.startDayIndex)))
    : fallback;
  let endDayIndex = Number.isInteger(Number(event.endDayIndex))
    ? Math.max(0, Math.min(6, Number(event.endDayIndex)))
    : startDayIndex;
  if (endDayIndex < startDayIndex) [startDayIndex, endDayIndex] = [endDayIndex, startDayIndex];
  return { startDayIndex, endDayIndex };
}

function roundWeekEventOccursOnDay(event, day) {
  if (event.startDate && event.endDate && day.key) {
    return day.key >= event.startDate && day.key <= event.endDate;
  }
  const { startDayIndex, endDayIndex } = getRoundWeekEventRange(event);
  return day.dayIndex >= startDayIndex && day.dayIndex <= endDayIndex;
}

function distinguishOverlappingTimelineEvents(events, days) {
  const assigned = [];
  return events.map(event => {
    const occupied = new Set(assigned.filter(previous => days.some(day =>
      roundWeekEventOccursOnDay(event, day) && roundWeekEventOccursOnDay(previous, day)
    )).map(previous => previous.displayColor));
    const preferred = normalizeRoundWeekEventColor(event.color);
    const displayColor = occupied.has(preferred)
      ? (ROUND_WEEK_EVENT_COLORS.find(([color]) => !occupied.has(color))?.[0] || preferred)
      : preferred;
    const colored = { ...event, displayColor };
    assigned.push(colored);
    return colored;
  });
}

function renderRoundWeekDayPicker(weekNumber) {
  const daysEl = document.getElementById(`round-week-${weekNumber}-days`);
  const eventsEl = document.getElementById(`round-week-${weekNumber}-events`);
  const startSelectEl = document.getElementById(`round-week-${weekNumber}-event-start-day`);
  const endSelectEl = document.getElementById(`round-week-${weekNumber}-event-end-day`);
  if (!daysEl || !eventsEl || !startSelectEl || !endSelectEl) return;
  const days = getRoundWeekDaysFromForm(weekNumber);
  const events = getRoundWeekDraftEvents(weekNumber);

  const dayOptions = days.map(day => `<option value="${day.dayIndex}">${day.shortName} · ${day.label}</option>`).join('');
  const currentStart = startSelectEl.value;
  const currentEnd = endSelectEl.value;
  startSelectEl.innerHTML = dayOptions;
  endSelectEl.innerHTML = dayOptions;
  if (currentStart !== '') startSelectEl.value = currentStart;
  if (currentEnd !== '') endSelectEl.value = currentEnd;
  daysEl.innerHTML = days.map(day => {
    const dayEvents = events.filter(event => roundWeekEventOccursOnDay(event, day));
    const titles = dayEvents.map(event => escapeHtml(event.title)).join('\n');
    const eventColor = dayEvents.length ? normalizeRoundWeekEventColor(dayEvents[0].color) : '';
    const eventStyle = eventColor ? ` style="background-color:${eventColor}18;border-color:${eventColor};color:${eventColor}"` : '';
    return `<button type="button" onclick="selectRoundWeekEventDay(${weekNumber}, ${day.dayIndex})" title="${titles || `${day.shortName} ${day.label}: chưa có sự kiện`}" class="min-w-0 rounded-lg border px-1 py-1 text-center transition ${dayEvents.length ? 'shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}"${eventStyle}>
      <span class="block text-[8px] font-black">${day.shortName}</span><span class="block text-[9px] font-bold">${day.label}</span>${dayEvents.length ? '<span class="block text-[8px] leading-none mt-0.5">●</span>' : ''}
    </button>`;
  }).join('');
  eventsEl.innerHTML = events.length
    ? events.map(event => {
      const color = normalizeRoundWeekEventColor(event.color);
      const { startDayIndex, endDayIndex } = getRoundWeekEventRange(event);
      const startDate = event.startDate || event.date || days[startDayIndex]?.date || '';
      const endDate = event.endDate || event.date || days[endDayIndex]?.date || startDate;
      const dateText = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
      return `<div class="flex items-center justify-between gap-1 rounded-md border px-2 py-1 text-[10px]" style="background-color:${color}18;border-color:${color}55;color:${color}"><span class="truncate">📌 ${escapeHtml(dateText)} · ${escapeHtml(event.title || '')}</span><span class="flex shrink-0 items-center gap-1"><button type="button" onclick="editRoundWeekEvent(${weekNumber}, '${escapeHtml(event.id)}')" class="font-black opacity-70 hover:opacity-100" title="Sửa sự kiện">✎</button><button type="button" onclick="removeRoundWeekEvent(${weekNumber}, '${escapeHtml(event.id)}')" class="font-black opacity-70 hover:opacity-100" title="Xóa sự kiện">×</button></span></div>`;
    }).join('')
    : '<span class="text-[10px] text-slate-400 italic">Chưa có sự kiện theo ngày.</span>';
  updateRoundWeekEventColorPresets(weekNumber, document.getElementById(`round-week-${weekNumber}-event-color`)?.value);
}

window.selectRoundWeekEventDay = function(weekNumber, dayIndex) {
  const startSelect = document.getElementById(`round-week-${weekNumber}-event-start-day`);
  const endSelect = document.getElementById(`round-week-${weekNumber}-event-end-day`);
  const form = document.getElementById(`round-week-${weekNumber}-event-form`);
  if (startSelect) startSelect.value = String(dayIndex);
  if (endSelect) endSelect.value = String(dayIndex);
  if (form) form.classList.remove('hidden');
  document.getElementById(`round-week-${weekNumber}-event-title`)?.focus();
};

window.syncRoundWeekEventRange = function(weekNumber, changedField) {
  const startSelect = document.getElementById(`round-week-${weekNumber}-event-start-day`);
  const endSelect = document.getElementById(`round-week-${weekNumber}-event-end-day`);
  if (!startSelect || !endSelect) return;
  const start = Number(startSelect.value || 0);
  const end = Number(endSelect.value || 0);
  if (end < start) {
    if (changedField === 'start') endSelect.value = String(start);
    else startSelect.value = String(end);
  }
};

window.selectRoundWeekEventColor = function(weekNumber, color) {
  const input = document.getElementById(`round-week-${weekNumber}-event-color`);
  if (input) input.value = normalizeRoundWeekEventColor(color);
  updateRoundWeekEventColorPresets(weekNumber, color);
};

window.editRoundWeekEvent = function(weekNumber, eventId) {
  const event = getRoundWeekDraftEvents(weekNumber).find(item => item.id === eventId);
  if (!event) return;
  const { startDayIndex, endDayIndex } = getRoundWeekEventRange(event);
  const form = document.getElementById(`round-week-${weekNumber}-event-form`);
  const startSelect = document.getElementById(`round-week-${weekNumber}-event-start-day`);
  const endSelect = document.getElementById(`round-week-${weekNumber}-event-end-day`);
  const titleInput = document.getElementById(`round-week-${weekNumber}-event-title`);
  if (startSelect) startSelect.value = String(startDayIndex);
  if (endSelect) endSelect.value = String(endDayIndex);
  if (titleInput) titleInput.value = event.title || '';
  window.selectRoundWeekEventColor(weekNumber, event.color);
  setRoundWeekEventFormMode(weekNumber, eventId);
  form?.classList.remove('hidden');
  titleInput?.focus();
};

window.cancelRoundWeekEventEdit = function(weekNumber) {
  const titleInput = document.getElementById(`round-week-${weekNumber}-event-title`);
  if (titleInput) titleInput.value = '';
  window.selectRoundWeekEventColor(weekNumber, '#dc2626');
  setRoundWeekEventFormMode(weekNumber);
};

window.toggleRoundWeekEventForm = function(weekNumber) {
  const form = document.getElementById(`round-week-${weekNumber}-event-form`);
  form?.classList.toggle('hidden');
  if (form && !form.classList.contains('hidden')) document.getElementById(`round-week-${weekNumber}-event-title`)?.focus();
};

window.addRoundWeekEvent = function(weekNumber) {
  const titleInput = document.getElementById(`round-week-${weekNumber}-event-title`);
  const startDaySelect = document.getElementById(`round-week-${weekNumber}-event-start-day`);
  const endDaySelect = document.getElementById(`round-week-${weekNumber}-event-end-day`);
  const colorInput = document.getElementById(`round-week-${weekNumber}-event-color`);
  const title = String(titleInput?.value || '').trim();
  if (!title) {
    showToast('Nhập tên sự kiện hoặc cột mốc.', 'warning');
    titleInput?.focus();
    return;
  }
  const startDayIndex = Number(startDaySelect?.value || 0);
  const endDayIndex = Number(endDaySelect?.value || startDayIndex);
  const days = getRoundWeekDaysFromForm(weekNumber);
  const startDay = days[startDayIndex];
  const endDay = days[endDayIndex];
  if (!startDay || !endDay || endDayIndex < startDayIndex) {
    showToast('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.', 'warning');
    return;
  }
  const events = getRoundWeekDraftEvents(weekNumber);
  const editedEventId = getRoundWeekEditingEventId(weekNumber);
  const payload = {
    title,
    dayIndex: startDayIndex,
    date: startDay.date,
    startDayIndex,
    endDayIndex,
    startDate: startDay.date,
    endDate: endDay.date,
    color: normalizeRoundWeekEventColor(colorInput?.value)
  };
  const existingIndex = events.findIndex(event => event.id === editedEventId);
  if (existingIndex >= 0) events[existingIndex] = { ...events[existingIndex], ...payload };
  else events.push({ id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...payload });
  state.roundWeekEventsDraft[weekNumber] = events;
  if (titleInput) titleInput.value = '';
  window.selectRoundWeekEventColor(weekNumber, '#dc2626');
  setRoundWeekEventFormMode(weekNumber);
  renderRoundWeekDayPicker(weekNumber);
};

window.removeRoundWeekEvent = function(weekNumber, eventId) {
  state.roundWeekEventsDraft[weekNumber] = getRoundWeekDraftEvents(weekNumber).filter(event => event.id !== eventId);
  if (getRoundWeekEditingEventId(weekNumber) === eventId) window.cancelRoundWeekEventEdit(weekNumber);
  renderRoundWeekDayPicker(weekNumber);
};

window.refreshRoundWeekDayPickers = function() {
  const duration = parseInt(document.getElementById('round-form-duration-weeks')?.value, 10) || 12;
  for (let week = 1; week <= duration; week++) renderRoundWeekDayPicker(week);
};

function getRoundTimelineDefaultTitle(weekNum) {
  const n = Number(weekNum);
  if (n === 13) return 'Nộp Sơ khảo';
  if (n === 14) return 'Bảo vệ Tốt nghiệp';
  if (n === 15) return 'Tổng kết & Kết quả';
  if (n > 15) return `Mốc ${n}`;
  return `Tuần ${n}`;
}

function resolveRoundWeekTitle(weekNum, customTitle) {
  const n = Number(weekNum);
  const trimmed = String(customTitle || '').trim();
  if (trimmed && !/^Tuần\s+\d+$/i.test(trimmed)) {
    return trimmed;
  }
  if (n > 12) {
    if (!trimmed || /^Tuần\s+\d+$/i.test(trimmed)) {
      return getRoundTimelineDefaultTitle(n);
    }
  }
  return trimmed || `Tuần ${n}`;
}

function renderRoundWeeklyContentEditor(durationWeeks) {
  const grid = document.getElementById('round-weekly-content-grid');
  if (!grid) return;
  durationWeeks = Math.max(1, Math.min(24, parseInt(durationWeeks, 10) || 12));
  const defaultMilestones = { 4: 'Duyệt đợt 1', 8: 'Duyệt đợt 2', 12: 'Duyệt đợt 3' };
  grid.innerHTML = Array.from({ length: durationWeeks }, (_, i) => {
    const n = i + 1;
    const defMilestone = defaultMilestones[n] || (n === 13 ? 'Sơ khảo' : '');
    const isPostWeek12 = n > 12;
    const defaultTitle = getRoundTimelineDefaultTitle(n);
    return `
      <div data-round-week-card="${n}" class="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="font-black text-xs text-slate-800">${isPostWeek12 ? `Mốc ${n}: ${defaultTitle}` : `Tuần ${n}`}</span>
          <div class="flex items-center gap-2">
            <label class="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 cursor-pointer">
              <input type="checkbox" id="round-week-${n}-visible" checked class="rounded text-emerald-600">
              Hiển thị cho SV
            </label>
            ${n > 12 ? `<button type="button" onclick="removeRoundTimelineWeek(${n})" title="Xóa mốc này" class="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-600 hover:bg-rose-100">× Xóa</button>` : ''}
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">${isPostWeek12 ? 'Tên giai đoạn / mốc (đổi tên tùy ý)' : 'Tiêu đề tuần'}</label>
          <input type="text" id="round-week-${n}-title" placeholder="${defaultTitle}" value="${isPostWeek12 ? defaultTitle : `Tuần ${n}`}"
                 class="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none">
        </div>
        <textarea id="round-week-${n}-note" rows="2" placeholder="Ghi chú nội dung ${isPostWeek12 ? defaultTitle : `tuần ${n}`} (tuỳ chọn)"
                  class="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"></textarea>
        <select id="round-week-${n}-milestone"
                onchange="toggleRoundWeekCustomMilestone(${n})"
                class="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none">
          <option value="">-- Không có mốc --</option>
          <option value="Duyệt đợt 1" ${defMilestone === 'Duyệt đợt 1' ? 'selected' : ''}>🚩 Duyệt đợt 1</option>
          <option value="Duyệt đợt 2" ${defMilestone === 'Duyệt đợt 2' ? 'selected' : ''}>🚩 Duyệt đợt 2</option>
          <option value="Duyệt đợt 3" ${defMilestone === 'Duyệt đợt 3' ? 'selected' : ''}>🚩 Duyệt đợt 3</option>
          <option value="Sơ khảo" ${defMilestone === 'Sơ khảo' ? 'selected' : ''}>📋 Sơ khảo</option>
          <option value="Khác">📌 Khác</option>
        </select>
        <input type="text" id="round-week-${n}-milestone-custom" placeholder="Tên mốc tùy chỉnh"
               class="hidden w-full p-1.5 border border-amber-200 rounded-lg text-xs bg-amber-50 focus:ring-2 focus:ring-amber-400 focus:outline-none">
        <div class="border-t border-slate-100 pt-2 space-y-1.5">
          <div class="flex items-center justify-between"><span class="text-[10px] font-black text-slate-600">LỊCH THỨ 2 – CHỦ NHẬT</span><button type="button" onclick="toggleRoundWeekEventForm(${n})" class="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-black text-blue-700 hover:bg-blue-100">＋ Sự kiện</button></div>
          <div id="round-week-${n}-days" class="grid grid-cols-7 gap-1"></div>
          <div id="round-week-${n}-events" class="space-y-1"></div>
          <div id="round-week-${n}-event-form" class="hidden rounded-lg bg-blue-50 border border-blue-100 p-2 space-y-1.5">
            <div class="grid grid-cols-2 gap-1.5">
              <label class="min-w-0 text-[9px] font-bold text-slate-500">Bắt đầu<select id="round-week-${n}-event-start-day" onchange="syncRoundWeekEventRange(${n}, 'start')" class="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 bg-white p-1 text-[10px]"></select></label>
              <label class="min-w-0 text-[9px] font-bold text-slate-500">Kết thúc<select id="round-week-${n}-event-end-day" onchange="syncRoundWeekEventRange(${n}, 'end')" class="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 bg-white p-1 text-[10px]"></select></label>
            </div>
            <input id="round-week-${n}-event-title" type="text" maxlength="120" placeholder="VD: Sơ khảo" class="min-w-0 w-full rounded-md border border-slate-200 bg-white p-1 text-[10px]">
            <input id="round-week-${n}-event-color" type="hidden" value="#dc2626">
            <div><span class="text-[9px] font-bold text-slate-500">Màu sự kiện</span><div class="mt-1 grid grid-cols-6 gap-1">${ROUND_WEEK_EVENT_COLORS.map(([color, label]) => `<button type="button" data-round-week-event-color="${n}" data-color="${color}" onclick="selectRoundWeekEventColor(${n}, '${color}')" title="${label}" aria-label="Màu ${label}" class="h-5 rounded-md border border-white/80 shadow-sm transition hover:scale-110" style="background-color:${color}"></button>`).join('')}</div></div>
            <div class="grid grid-cols-[1fr_auto] gap-1.5"><button type="button" id="round-week-${n}-event-submit" onclick="addRoundWeekEvent(${n})" class="w-full rounded-md bg-blue-600 py-1 text-[10px] font-bold text-white hover:bg-blue-700">Thêm khoảng sự kiện</button><button type="button" id="round-week-${n}-event-cancel" onclick="cancelRoundWeekEventEdit(${n})" class="hidden rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100">Hủy</button></div>
          </div>
        </div>
      </div>`;
  }).join('');
  window.refreshRoundWeekDayPickers();
}

function readRoundWeeklyContentDraft(durationWeeks) {
  return Array.from({ length: durationWeeks }, (_, index) => {
    const week = index + 1;
    const rawTitle = document.getElementById(`round-week-${week}-title`)?.value?.trim() || '';
    return {
      title: resolveRoundWeekTitle(week, rawTitle),
      note: document.getElementById(`round-week-${week}-note`)?.value || '',
      milestone: document.getElementById(`round-week-${week}-milestone`)?.value || '',
      customMilestone: document.getElementById(`round-week-${week}-milestone-custom`)?.value || '',
      visible: document.getElementById(`round-week-${week}-visible`)?.checked !== false,
      events: [...getRoundWeekDraftEvents(week)]
    };
  });
}

function restoreRoundWeeklyContentDraft(drafts = []) {
  state.roundWeekEventsDraft = {};
  state.roundWeekEditingEvents = {};
  drafts.forEach((draft, index) => {
    const week = index + 1;
    const titleEl = document.getElementById(`round-week-${week}-title`);
    const noteEl = document.getElementById(`round-week-${week}-note`);
    const milestoneEl = document.getElementById(`round-week-${week}-milestone`);
    const customEl = document.getElementById(`round-week-${week}-milestone-custom`);
    const visibleEl = document.getElementById(`round-week-${week}-visible`);
    if (titleEl) titleEl.value = resolveRoundWeekTitle(week, draft.title);
    if (noteEl) noteEl.value = draft.note || '';
    if (milestoneEl) milestoneEl.value = draft.milestone || '';
    if (customEl) customEl.value = draft.customMilestone || '';
    if (visibleEl) visibleEl.checked = draft.visible !== false;
    state.roundWeekEventsDraft[week] = Array.isArray(draft.events) ? draft.events : [];
    window.toggleRoundWeekCustomMilestone(week);
    renderRoundWeekDayPicker(week);
  });
}

window.addRoundTimelineWeek = function() {
  const durationInput = document.getElementById('round-form-duration-weeks');
  const currentDuration = Math.max(1, parseInt(durationInput?.value, 10) || 12);
  if (currentDuration >= 24) {
    showToast('Một đợt được cấu hình tối đa 24 tuần.', 'warning');
    return;
  }
  const drafts = readRoundWeeklyContentDraft(currentDuration);
  const nextDuration = currentDuration + 1;
  if (durationInput) durationInput.value = String(nextDuration);
  renderRoundWeeklyContentEditor(nextDuration);
  const defaultTitle = getRoundTimelineDefaultTitle(nextDuration);
  restoreRoundWeeklyContentDraft([...drafts, { title: defaultTitle, note: '', milestone: '', customMilestone: '', visible: true, events: [] }]);
  document.querySelector(`[data-round-week-card="${nextDuration}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.removeRoundTimelineWeek = function(weekNumber) {
  const durationInput = document.getElementById('round-form-duration-weeks');
  const currentDuration = Math.max(1, parseInt(durationInput?.value, 10) || 12);
  if (weekNumber <= 12 || weekNumber > currentDuration) return;
  const drafts = readRoundWeeklyContentDraft(currentDuration).filter((_, index) => index + 1 !== weekNumber);
  const nextDuration = currentDuration - 1;
  if (durationInput) durationInput.value = String(nextDuration);
  renderRoundWeeklyContentEditor(nextDuration);
  restoreRoundWeeklyContentDraft(drafts);
  showToast(`Đã xóa tuần ${weekNumber}.`, 'success');
};

window.resizeRoundTimelineWeeks = function(value) {
  const requestedDuration = Math.max(1, Math.min(24, parseInt(value, 10) || 12));
  const currentDuration = document.querySelectorAll('[data-round-week-card]').length || 12;
  const drafts = readRoundWeeklyContentDraft(currentDuration).slice(0, requestedDuration);
  while (drafts.length < requestedDuration) {
    const week = drafts.length + 1;
    drafts.push({ title: getRoundTimelineDefaultTitle(week), note: '', milestone: '', customMilestone: '', visible: true, events: [] });
  }
  const durationInput = document.getElementById('round-form-duration-weeks');
  if (durationInput) durationInput.value = String(requestedDuration);
  renderRoundWeeklyContentEditor(requestedDuration);
  restoreRoundWeeklyContentDraft(drafts);
};

window.toggleRoundWeekCustomMilestone = function(weekNumber) {
  const select = document.getElementById(`round-week-${weekNumber}-milestone`);
  const custom = document.getElementById(`round-week-${weekNumber}-milestone-custom`);
  if (custom) custom.classList.toggle('hidden', select?.value !== 'Khác');
};

window.resetWeeklyContentToDefault = function() {
  const durationInput = document.getElementById('round-form-duration-weeks');
  const durationWeeks = parseInt(durationInput?.value, 10) || 12;
  state.roundWeekEventsDraft = {};
  state.roundWeekEditingEvents = {};
  renderRoundWeeklyContentEditor(durationWeeks);
};

if (typeof window !== 'undefined') {
  window.renderRoundWeekDayPicker = renderRoundWeekDayPicker;
  window.renderRoundWeeklyContentEditor = renderRoundWeeklyContentEditor;
  window.normalizeRoundWeekEventColor = normalizeRoundWeekEventColor;
  window.roundWeekEventOccursOnDay = roundWeekEventOccursOnDay;
  window.distinguishOverlappingTimelineEvents = distinguishOverlappingTimelineEvents;
  window.getRoundTimelineDefaultTitle = getRoundTimelineDefaultTitle;
  window.resolveRoundWeekTitle = resolveRoundWeekTitle;
}
