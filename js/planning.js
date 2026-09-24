/**
 * IFA+ Graduation — Planning, Milestones & Unified Timeline Module
 */
// ============================================================================
// MODULE: TIMELINE / KẾ HOẠCH ĐỢT TỐT NGHIỆP (IFA+ GRADUATION BETA v1.6.0)
// ============================================================================

export const ACTIVITY_TYPES = {
  announcement: { label: 'Thông báo', icon: '📢', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  submission: { label: 'Nộp bài', icon: '📥', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review: { label: 'Duyệt hội đồng', icon: '📋', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  preliminary: { label: 'Sơ khảo', icon: '🔍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  thesis: { label: 'Chấm thuyết minh', icon: '📖', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  defense: { label: 'Bảo vệ', icon: '🎓', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  other: { label: 'Khác', icon: '📌', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export function getActivityStatus(act) {
  const now = new Date();
  const start = act.startAt ? new Date(act.startAt) : null;
  const end = act.endAt ? new Date(act.endAt) : null;

  if (end && !isNaN(end.getTime()) && now > end) {
    return 'past'; // Đã kết thúc
  }
  if (start && !isNaN(start.getTime()) && now < start) {
    return 'upcoming'; // Sắp tới
  }
  if ((start && now >= start && (!end || now <= end)) || (!start && end && now <= end)) {
    return 'ongoing'; // Đang diễn ra
  }
  return 'neutral'; // Không có hạn / Kế hoạch
}

export function fmtActivityTime(start, end) {
  if (!start && !end) return 'Chưa ấn định thời gian';
  const pad = n => String(n).padStart(2, '0');
  const fmtPart = iso => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return {
      date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  };

  const p1 = start ? fmtPart(start) : null;
  const p2 = end ? fmtPart(end) : null;

  if (p1 && p2) {
    if (p1.date === p2.date) {
      return `${p1.date} • ${p1.time} → ${p2.time}`;
    }
    return `${p1.date} ${p1.time} → ${p2.date} ${p2.time}`;
  }
  if (p1) return `Bắt đầu: ${p1.date} ${p1.time}`;
  if (p2) return `Hạn cuối: ${p2.date} ${p2.time}`;
  return '--';
}

// Vietnamese Date/Time Parsing & Conversion Helpers
export function isoToVietnameseDateTime(isoStr) {
  if (!isoStr) return { date: '', time: '' };
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

export function parseVietnameseDateTime(dateStr, timeStr, defaultTime = '00:00') {
  if (!dateStr || !dateStr.trim()) return '';
  const dTrim = dateStr.trim();
  const m = dTrim.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null; // Invalid format

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  // Verify real days in month
  const testDate = new Date(year, month - 1, day);
  if (testDate.getDate() !== day || testDate.getMonth() !== month - 1) return null;

  const tTrim = (timeStr && timeStr.trim()) ? timeStr.trim() : defaultTime;
  const tm = tTrim.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!tm) return null; // Invalid time

  const hour = String(parseInt(tm[1], 10)).padStart(2, '0');
  const min = String(parseInt(tm[2], 10)).padStart(2, '0');

  const pad = n => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${hour}:${min}:00`;
}

// Auto format DD/MM/YYYY while typing
window.formatDateInput = function(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 8) val = val.substring(0, 8);
  if (val.length >= 5) {
    input.value = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4);
  } else if (val.length >= 3) {
    input.value = val.substring(0, 2) + '/' + val.substring(2);
  } else {
    input.value = val;
  }
};

window.validateDateInput = function(input) {
  const val = input.value.trim();
  if (!val) return true;
  const parsed = parseVietnameseDateTime(val, '00:00');
  if (parsed === null) {
    showToast('Ngày không hợp lệ! Vui lòng nhập định dạng DD/MM/YYYY (ví dụ: 25/09/2026)', 'warning');
    input.classList.add('border-rose-500', 'bg-rose-50');
    return false;
  }
  input.classList.remove('border-rose-500', 'bg-rose-50');
  return true;
};

window.validateTimeInput = function(input) {
  const val = input.value.trim();
  if (!val) return true;
  const tm = val.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!tm) {
    showToast('Giờ không hợp lệ! Vui lòng nhập định dạng 24h HH:mm (ví dụ: 08:30, 21:00)', 'warning');
    input.classList.add('border-rose-500', 'bg-rose-50');
    return false;
  }
  const pad = n => String(n).padStart(2, '0');
  input.value = `${pad(tm[1])}:${pad(tm[2])}`;
  input.classList.remove('border-rose-500', 'bg-rose-50');
  return true;
};

window.syncPickerToDateInput = function(target, isoDate) {
  if (!isoDate) return;
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const vnDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    const input = document.getElementById(`activity-form-${target}-date`);
    if (input) input.value = vnDate;
    const timeInput = document.getElementById(`activity-form-${target}-time`);
    if (timeInput && !timeInput.value.trim()) {
      timeInput.value = target === 'start' ? '08:00' : '17:00';
    }
  }
};

window.openActivityDatePicker = function(target) {
  const picker = document.getElementById(`activity-form-${target}-date-picker`);
  const textInput = document.getElementById(`activity-form-${target}-date`);
  if (!picker) return;

  // Keep the native picker aligned with a date manually typed in Vietnamese format.
  const typed = String(textInput?.value || '').trim();
  const match = typed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) picker.value = `${match[3]}-${match[2]}-${match[1]}`;

  try {
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }
  } catch (error) {
    // Older browsers can still open the native picker through focus/click.
  }
  picker.focus({ preventScroll: true });
  picker.click();
};

window.clearActivityDateTime = function(target) {
  const dateInput = document.getElementById(`activity-form-${target}-date`);
  const timeInput = document.getElementById(`activity-form-${target}-time`);
  if (dateInput) {
    dateInput.value = '';
    dateInput.classList.remove('border-rose-500', 'bg-rose-50');
  }
  if (timeInput) {
    timeInput.value = '';
    timeInput.classList.remove('border-rose-500', 'bg-rose-50');
  }
};

// Rich Text Editor Helpers
window.richFormatHeading = function(tag) {
  if (!tag) return;
  document.execCommand('formatBlock', false, '<' + tag + '>');
  document.getElementById('activity-editor')?.focus();
};

window.setRichFontSize = function(size) {
  if (!size) return;
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  document.execCommand('fontSize', false, '1');
  const editor = document.getElementById('activity-editor');
  if (editor) {
    const elList = editor.querySelectorAll('font[size="1"], span[style*="font-size: x-small"]');
    elList.forEach(el => {
      el.removeAttribute('size');
      el.style.fontSize = size + 'px';
    });
  }
  document.getElementById('activity-editor')?.focus();
};

window.insertRichLink = async function() {
  const url = await showInputDialog('Chèn liên kết', 'Nhập địa chỉ liên kết (URL):', { defaultValue: 'https://', required: true });
  if (!url || !url.trim()) return;
  const cleanUrl = url.trim();
  if (/^javascript:/i.test(cleanUrl)) {
    showToast('Liên kết không an toàn!', 'warning');
    return;
  }
  document.execCommand('createLink', false, cleanUrl);
  const editor = document.getElementById('activity-editor');
  if (editor) {
    editor.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }
  document.getElementById('activity-editor')?.focus();
};

// Safe HTML Sanitizer (Strict Whitelist)
export function sanitizeRichHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const allowedTags = new Set([
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'div', 'blockquote'
    ]);
    const allowedStyles = new Set([
      'text-align', 'color', 'background-color', 'font-size'
    ]);

    function cleanNode(node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === 1) { // Element
          const tagName = child.tagName.toLowerCase();
          if (!allowedTags.has(tagName)) {
            if (['script', 'iframe', 'object', 'embed', 'style', 'link', 'svg'].includes(tagName)) {
              child.remove();
              continue;
            }
            const parent = child.parentNode;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
            continue;
          }

          // Clean attributes
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith('on') || attrName === 'id' || attrName === 'class') {
              child.removeAttribute(attr.name);
            } else if (tagName === 'a' && attrName === 'href') {
              const href = attr.value.trim().toLowerCase();
              if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('vbscript:')) {
                child.removeAttribute(attr.name);
              }
            } else if (attrName === 'style') {
              const styleRules = child.style;
              const safeStyles = [];
              for (let i = 0; i < styleRules.length; i++) {
                const prop = styleRules[i].toLowerCase();
                if (allowedStyles.has(prop)) {
                  const val = styleRules.getPropertyValue(prop);
                  if (!/url\(|expression\(|javascript:/i.test(val)) {
                    safeStyles.push(`${prop}: ${val}`);
                  }
                }
              }
              if (safeStyles.length > 0) {
                child.setAttribute('style', safeStyles.join('; '));
              } else {
                child.removeAttribute('style');
              }
            } else if (tagName === 'a' && (attrName === 'target' || attrName === 'rel')) {
              // Allowed
            } else {
              child.removeAttribute(attr.name);
            }
          }

          if (tagName === 'a') {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          }

          cleanNode(child);
        }
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  // Fallback for node test environment
  return rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}

// Generate unique slug in round
export function generateUniqueSlug(title, existingActivities = []) {
  const baseSlug = (title ? slugify(title) : '') || ('act-' + Date.now());
  const existingSlugs = new Set((existingActivities || []).map(a => a.slug || a.id));
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-${counter}`;
}

export const DEFAULT_LETTER_GRADE_SCALE = [
  { id: 'opt_app', key: 'A++', code: 'A++', label: 'Xuất sắc',       numericValue: 10.0, description: 'Xuất sắc' },
  { id: 'opt_ap',  key: 'A+',  code: 'A+',  label: 'Rất tốt',        numericValue: 9.5,  description: 'Rất tốt' },
  { id: 'opt_a',   key: 'A',   code: 'A',   label: 'Tốt',            numericValue: 9.0,  description: 'Tốt' },
  { id: 'opt_am',  key: 'A-',  code: 'A-',  label: 'Khá tốt',        numericValue: 8.5,  description: 'Khá tốt' },
  { id: 'opt_bp',  key: 'B+',  code: 'B+',  label: 'Khá',            numericValue: 8.0,  description: 'Khá' },
  { id: 'opt_b',   key: 'B',   code: 'B',   label: 'Khá',            numericValue: 7.5,  description: 'Khá' },
  { id: 'opt_bm',  key: 'B-',  code: 'B-',  label: 'Trung bình khá', numericValue: 7.0,  description: 'Trung bình khá' },
  { id: 'opt_cp',  key: 'C+',  code: 'C+',  label: 'Trung bình',     numericValue: 6.5,  description: 'Trung bình' },
  { id: 'opt_c',   key: 'C',   code: 'C',   label: 'Đạt',            numericValue: 6.0,  description: 'Đạt' },
  { id: 'opt_cm',  key: 'C-',  code: 'C-',  label: 'Trung bình yếu', numericValue: 5.5,  description: 'Trung bình yếu' },
  { id: 'opt_dp',  key: 'D+',  code: 'D+',  label: 'Yếu',            numericValue: 5.0,  description: 'Yếu' },
  { id: 'opt_d',   key: 'D',   code: 'D',   label: 'Chưa đạt',       numericValue: 4.5,  description: 'Chưa đạt' },
  { id: 'opt_dm',  key: 'D-',  code: 'D-',  label: 'Kém',            numericValue: 4.0,  description: 'Kém' }
];

export function isActivityPublished(activity) {
  if (!activity) return false;
  if (activity.publicationStatus) return activity.publicationStatus === 'published';
  return activity.visibility !== false;
}

export function normalizeActivity(a, roundId, idx = 0) {
  const title = String(a.title || '').trim();
  const slug = String(a.slug || (title ? slugify(title) : '') || ('act-' + (idx + 1))).trim();
  const id = String(a.id || slug).trim();
  
  // Default council structure if missing
  const defaultSlots = [
    { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng', type: 'mandatory' },
    { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng', type: 'mandatory' },
    { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng', type: 'mandatory' }
  ];

  // Default Defense Rubric (v2.0.0-beta.1)
  const defaultDefenseRubric = [
    { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
    { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
    { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
    { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
  ];

  // Default Letter Options & Scoring Config (v2.4.0)
  const defaultLetterOptions = JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));

  const scoringMode = (a.scoringConfig && ['numeric', 'letter', 'defense_rubric'].includes(a.scoringConfig.mode))
    ? a.scoringConfig.mode
    : 'numeric';

  const scoringConfig = a.scoringConfig ? {
    enabled: Boolean(a.scoringConfig.enabled),
    mode: scoringMode,
    rubric: (Array.isArray(a.scoringConfig.rubric) && a.scoringConfig.rubric.length > 0)
      ? a.scoringConfig.rubric
      : defaultDefenseRubric,
    letterOptions: (Array.isArray(a.scoringConfig.letterOptions) && a.scoringConfig.letterOptions.length > 0)
      ? a.scoringConfig.letterOptions
      : defaultLetterOptions,
    numericConfig: {
      min: typeof a.scoringConfig.numericConfig?.min === 'number' ? a.scoringConfig.numericConfig.min : 0,
      max: typeof a.scoringConfig.numericConfig?.max === 'number' ? a.scoringConfig.numericConfig.max : 10,
      step: typeof a.scoringConfig.numericConfig?.step === 'number' ? a.scoringConfig.numericConfig.step : 0.1
    }
  } : {
    enabled: false,
    mode: 'numeric',
    rubric: defaultDefenseRubric,
    letterOptions: defaultLetterOptions,
    numericConfig: { min: 0, max: 10, step: 0.1 }
  };

  return {
    id,
    roundId: String(a.roundId || roundId).trim(),
    title,
    activityType: a.activityType || 'other',
    color: normalizeRoundWeekEventColor(a.color),
    description: a.description || '',
    descriptionHtml: a.descriptionHtml || a.description || '',
    startAt: a.startAt || '',
    endAt: a.endAt || '',
    location: a.location || '',
    order: typeof a.order === 'number' ? a.order : (idx + 1),
    visibility: a.visibility !== false,
    publicationStatus: a.publicationStatus || (a.visibility !== false ? 'published' : 'draft'),
    showAfterExpired: a.showAfterExpired !== false,
    isTentative: Boolean(a.isTentative),
    submissionEnabled: Boolean(a.submissionEnabled),
    submissionConfig: a.submissionConfig || null,
    driveFolderId: a.driveFolderId || a.submissionConfig?.driveFolderId || null,
    driveFolderName: a.driveFolderName || a.submissionConfig?.driveFolderName || null,
    driveFolderUrl: a.driveFolderUrl || a.submissionConfig?.driveFolderUrl || null,
    councilEnabled: Boolean(a.councilEnabled),
    showPresentationOrderToStudents: Boolean(a.showPresentationOrderToStudents),
    councilStructure: (a.councilStructure && Array.isArray(a.councilStructure.slots)) ? a.councilStructure : { slots: defaultSlots },
    councils: Array.isArray(a.councils) ? a.councils.map(c => ({
      ...c,
      status: c.status || 'preparing',
      auditLogs: Array.isArray(c.auditLogs) ? c.auditLogs : [],
      guestInclusion: c.guestInclusion || {},
      finalDefenseScores: c.finalDefenseScores || {}
    })) : [],
    councilStudentAssignments: Array.isArray(a.councilStudentAssignments) ? a.councilStudentAssignments : [],
    scoringConfig,
    slug,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString()
  };
}

// 1. OPEN ADMIN TIMELINE FOR A ROUND
window.openRoundTimeline = function(roundId) {
  switchAdminTab('timeline');
  const sel = document.getElementById('admin-timeline-round-select');
  if (sel) {
    sel.value = roundId;
    loadAdminRoundActivities(roundId);
  }
};

// 2. LOAD & RENDER ADMIN TIMELINE ACTIVITIES TABLE
window.loadAdminRoundActivities = async function(roundId) {
  const tbody = document.getElementById('admin-timeline-activities-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Đang tải và kiểm tra lỗi...</td></tr>';
  try {
  const tbody = document.getElementById('admin-timeline-activities-tbody');
  const statsBadge = document.getElementById('admin-timeline-stats-badge');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không tìm thấy thông tin đợt tốt nghiệp.</td></tr>';
    if (statsBadge) statsBadge.textContent = '0 mốc';
    return;
  }

  // Load from targetRound.activities or subcollection
  const hasEmbeddedActivities = Array.isArray(targetRound.activities);
  let list = hasEmbeddedActivities ? targetRound.activities : [];
  if (!hasEmbeddedActivities) {
    try {
      const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
      if (snap && !snap.empty) {
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      // Fallback cleanly to round.activities
    }
  }

  // Normalize and sort by order
  const normalized = list.map((a, idx) => normalizeActivity(a, roundId, idx)).sort((a, b) => (a.order || 0) - (b.order || 0));
  targetRound.activities = normalized;
  state.roundActivities = normalized;
  renderAdminRoundsCards();

  // Calculate stats
  let ongoingCount = 0, upcomingCount = 0, pastCount = 0;
  normalized.forEach(a => {
    const s = getActivityStatus(a);
    if (s === 'ongoing') ongoingCount++;
    else if (s === 'upcoming') upcomingCount++;
    else if (s === 'past') pastCount++;
  });

  const selAdminRoundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const countDisplay = (statsBadge && selAdminRoundId === roundId)
    ? `${normalized.length} mốc (${ongoingCount} đang diễn ra, ${upcomingCount} sắp tới)`
    : `${normalized.length} mốc`;
  if (statsBadge) statsBadge.textContent = countDisplay;

  if (normalized.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center gap-2">
            <span class="text-3xl">🗓️</span>
            <span class="font-bold text-slate-600 text-sm">Chưa có mốc kế hoạch nào cho đợt này</span>
            <p class="text-xs text-slate-400 max-w-sm">Hãy nhấn nút "Thêm Mốc Kế hoạch" phía trên để thiết lập lộ trình cho sinh viên và hội đồng.</p>
            <button type="button" onclick="openCreateActivityModal()" class="px-4 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-xs border border-blue-200 transition-colors">
              + Thêm mốc đầu tiên
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  try {
    tbody.innerHTML = normalized.map((act, idx) => {
      const typeMeta = ACTIVITY_TYPES[act.activityType] || ACTIVITY_TYPES.other;
      const status = getActivityStatus(act);
      const timeStr = fmtActivityTime(act.startAt, act.endAt);

      let statusBadge = '';
      if (status === 'ongoing') {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm whitespace-nowrap">● Đang diễn ra</span>';
      } else if (status === 'upcoming') {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm whitespace-nowrap">○ Sắp tới</span>';
      } else if (status === 'past') {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-50 text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap">✓ Đã kết thúc</span>';
      } else {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm whitespace-nowrap">Kế hoạch</span>';
      }

      const isPub = isActivityPublished(act);
      const visBadge = isPub
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm whitespace-nowrap">👁️ Đã công bố</span>'
        : '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm whitespace-nowrap">📝 Bản nháp</span>';

      const subBadge = act.submissionEnabled
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm whitespace-nowrap" title="Chức năng nộp bài (Beta)">📥 Có</span>'
        : '<span class="text-slate-300 font-bold px-2 py-1">--</span>';

      return `
        <tr class="hover:bg-slate-50/80 transition-colors group border-b border-slate-100 last:border-b-0">
          <td class="p-2 text-center align-middle w-10">
            <div class="flex flex-col items-center justify-center gap-1.5">
              <span class="font-bold text-slate-500 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">#${idx + 1}</span>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onclick="moveActivity('${act.id}', 'up')" ${idx === 0 ? 'disabled' : ''} class="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent shadow-sm" title="Lên">▲</button>
                <button type="button" onclick="moveActivity('${act.id}', 'down')" ${idx === normalized.length - 1 ? 'disabled' : ''} class="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent shadow-sm" title="Xuống">▼</button>
              </div>
            </div>
          </td>
          
          <td class="p-2 align-top">
            <div class="flex flex-col items-start gap-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded whitespace-nowrap text-[9px] font-extrabold border shadow-sm ${typeMeta.color}">
                  <span>${typeMeta.icon}</span> ${typeMeta.label}
                </span>
                ${act.isTentative ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">🟡 Dự kiến</span>' : '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">Chính thức</span>'}
              </div>
              <div>
                <span class="font-bold text-slate-800 text-xs leading-tight block">${act.title}</span>
                ${act.description ? `<p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1 leading-snug" title="${escapeHtml(act.description)}">${escapeHtml(act.description)}</p>` : ''}
              </div>
            </div>
          </td>
          
          <td class="p-2 align-top text-xs text-slate-700 whitespace-nowrap">
            <div class="text-[11px] leading-snug">
              ${timeStr.replace('Hạn cuối:', '<span class="text-rose-600 font-bold">Hạn cuối:</span>')}
            </div>
          </td>
          
          <td class="p-2 align-top text-slate-600 text-[11px]">
            ${act.location ? `
              <div class="flex items-start gap-1 text-[11px]">
                <span class="text-slate-400">📍</span>
                <span class="line-clamp-2 leading-tight" title="${act.location}">${act.location}</span>
              </div>
            ` : '<span class="text-slate-300 font-bold text-[10px]">--</span>'}
          </td>
          
          <td class="p-2 align-top text-center whitespace-nowrap">
            ${statusBadge}
          </td>
          
          <td class="p-2 align-top text-center whitespace-nowrap">
            ${visBadge}
          </td>
          
          <td class="p-2 align-top text-center whitespace-nowrap">
            ${subBadge}
          </td>
          
          <td class="p-2 align-top pr-3">
            <div class="flex flex-col gap-1 items-end whitespace-nowrap">
              <div class="flex items-center gap-1">
                ${act.submissionEnabled ? `<button type="button" onclick="openActivitySubmissionDashboard('${targetRound.id}', '${act.id}')" class="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold border border-indigo-200 shadow-sm transition-all flex items-center gap-1" title="Quản lý Sinh viên Nộp bài"><span>📥</span><span>Nộp bài</span></button>` : ''}
                ${act.councilEnabled ? `<button type="button" onclick="openActivityCouncilManagement('${targetRound.id}', '${act.id}')" class="px-2 py-0.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded text-[10px] font-bold border border-violet-200 shadow-sm transition-all flex items-center gap-1" title="Quản lý Hội đồng Mốc này"><span>⚖️</span><span>Hội đồng</span><span class="bg-violet-200 text-violet-900 px-1 py-0.2 rounded-full text-[8px] leading-none">${(act.councils || []).length}</span></button>` : ''}
              </div>
              
              <div class="flex items-center gap-1 mt-0.5">
                <button type="button" onclick="copyActivityLink('${targetRound.id}', '${act.slug}')" class="p-1 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded border border-slate-200 shadow-sm transition-colors text-[10px]" title="Sao chép link mốc">🔗</button>
                <button type="button" onclick="duplicateActivityWithinRound('${act.id}')" class="px-1.5 py-0.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded font-bold text-[9px] border border-amber-200 shadow-sm transition-colors flex items-center gap-1" title="Nhân bản mốc này trong cùng đợt"><span>📋</span><span>Sao chép</span></button>
                <button type="button" onclick="toggleActivityVisibility('${act.id}')" class="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200 shadow-sm transition-colors">${isActivityPublished(act) ? '🔒 Về bản nháp' : '📢 Công bố'}</button>
                <div class="w-px h-3 bg-slate-200 mx-0.5"></div>
                <button type="button" onclick="editActivityModal('${act.id}')" class="px-1.5 py-0.5 text-blue-600 hover:bg-blue-50 rounded font-bold text-[9px] transition-colors">Sửa</button>
                <button type="button" onclick="deleteActivity('${act.id}')" class="px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 rounded font-bold text-[9px] transition-colors">Xóa</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi khi render danh sách mốc kế hoạch:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-600 bg-rose-50 font-bold border border-rose-200 rounded-lg">⚠️ Đã xảy ra lỗi hiển thị danh sách mốc kế hoạch: ${err.message}. Vui lòng thử lại hoặc báo cáo kỹ thuật.</td></tr>`;
  }

  } catch (globalErr) {
    console.error('Lỗi loadAdminRoundActivities:', globalErr);
    const tbodyFallback = document.getElementById('admin-timeline-activities-tbody');
    if (tbodyFallback) {
      tbodyFallback.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-600 bg-rose-50 font-bold border border-rose-200 rounded-lg">
        <h3 class="text-lg mb-2 text-rose-700">🔥 Lỗi nghiêm trọng (Global Catch)</h3>
        <p class="font-mono text-left whitespace-pre-wrap text-[10px] text-rose-800">${globalErr?.stack || globalErr?.message || String(globalErr)}</p>
      </td></tr>`;
    }
  }
};


// 3. CREATE, EDIT & COPY ACTIVITY MODAL HANDLERS
window.openCreateActivityModal = function() {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  if (!roundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp trước khi thêm mốc kế hoạch!', 'warning');
    return;
  }

  document.getElementById('form-activity').reset();
  document.getElementById('activity-form-id').value = '';
  document.getElementById('activity-form-round-id').value = roundId;
  document.getElementById('activity-form-visibility').checked = false;
  document.getElementById('activity-form-show-expired').checked = true;
  if (document.getElementById('activity-form-is-tentative')) document.getElementById('activity-form-is-tentative').checked = false;
  document.getElementById('activity-form-submission').checked = false;
  if (typeof toggleActivitySubmissionConfig === 'function') toggleActivitySubmissionConfig(false);
  if (typeof resetActivitySubmissionForm === 'function') resetActivitySubmissionForm();
  document.getElementById('activity-form-type').value = 'review';
  setActivityFormColor('#dc2626');

  // Clear date/time
  clearActivityDateTime('start');
  clearActivityDateTime('end');

  // Clear rich editor
  const editor = document.getElementById('activity-editor');
  if (editor) editor.innerHTML = '';

  if (document.getElementById('activity-form-council-enabled')) {
    document.getElementById('activity-form-council-enabled').checked = false;
    toggleActivityCouncilFields(false);
  }
  if (document.getElementById('activity-form-show-order')) {
    document.getElementById('activity-form-show-order').checked = false;
  }
  if (document.getElementById('activity-form-scoring-enabled')) {
    document.getElementById('activity-form-scoring-enabled').checked = false;
    toggleActivityScoringConfig(false);
  }
  state._currentActivityLetterOptions = JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));
  state._currentActivityRubric = [
    { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
    { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
    { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
    { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
  ];
  state._currentActivityCouncils = [];
  switchActivityScoringMode('numeric');
  renderActivityLetterOptions();
  renderActivityRubricList();
  if (typeof renderActivityCouncilsInModal === 'function') renderActivityCouncilsInModal();
  const advBtn = document.getElementById('btn-open-advanced-councils');
  if (advBtn) advBtn.classList.add('hidden');

  document.getElementById('modal-activity-title').textContent = 'Thêm Mốc Kế hoạch Đợt TN';
  document.getElementById('modal-activity').classList.remove('hidden');
};

window.editActivityModal = function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const list = targetRound?.activities || state.roundActivities || [];
  const act = list.find(a => a.id === actId);
  if (!act) {
    showToast('Không tìm thấy thông tin mốc kế hoạch!', 'error');
    return;
  }

  document.getElementById('activity-form-id').value = act.id;
  document.getElementById('activity-form-round-id').value = roundId;
  document.getElementById('activity-form-title').value = act.title || '';
  document.getElementById('activity-form-type').value = act.activityType || 'other';
  document.getElementById('activity-form-location').value = act.location || '';
  setActivityFormColor(act.color);

  // Dates
  const startParts = isoToVietnameseDateTime(act.startAt);
  const startDateInput = document.getElementById('activity-form-start-date');
  const startTimeInput = document.getElementById('activity-form-start-time');
  if (startDateInput) startDateInput.value = startParts.date;
  if (startTimeInput) startTimeInput.value = startParts.time;

  const endParts = isoToVietnameseDateTime(act.endAt);
  const endDateInput = document.getElementById('activity-form-end-date');
  const endTimeInput = document.getElementById('activity-form-end-time');
  if (endDateInput) endDateInput.value = endParts.date;
  if (endTimeInput) endTimeInput.value = endParts.time;

  // Rich Text Editor
  const editor = document.getElementById('activity-editor');
  if (editor) {
    editor.innerHTML = act.descriptionHtml || escapeHtml(act.description || '');
  }

  document.getElementById('activity-form-visibility').checked = isActivityPublished(act);
  document.getElementById('activity-form-show-expired').checked = act.showAfterExpired !== false;
  if (document.getElementById('activity-form-is-tentative')) document.getElementById('activity-form-is-tentative').checked = Boolean(act.isTentative);
  const subEnabled = Boolean(act.submissionEnabled);
  document.getElementById('activity-form-submission').checked = subEnabled;
  if (typeof toggleActivitySubmissionConfig === 'function') toggleActivitySubmissionConfig(subEnabled);
  if (typeof populateActivitySubmissionForm === 'function') populateActivitySubmissionForm({
    ...(act.submissionConfig || {}),
    driveFolderId: act.submissionConfig?.driveFolderId || act.driveFolderId || '',
    driveFolderName: act.submissionConfig?.driveFolderName || act.driveFolderName || '',
    driveFolderUrl: act.submissionConfig?.driveFolderUrl || act.driveFolderUrl || ''
  });

  const councilEnabled = Boolean(act.councilEnabled);
  if (document.getElementById('activity-form-council-enabled')) {
    document.getElementById('activity-form-council-enabled').checked = councilEnabled;
    toggleActivityCouncilFields(councilEnabled);
  }
  if (document.getElementById('activity-form-show-order')) {
    document.getElementById('activity-form-show-order').checked = Boolean(act.showPresentationOrderToStudents);
  }
  const scoringEnabled = Boolean(act.scoringConfig?.enabled);
  if (document.getElementById('activity-form-scoring-enabled')) {
    document.getElementById('activity-form-scoring-enabled').checked = scoringEnabled;
    toggleActivityScoringConfig(scoringEnabled);
  }
  const sMode = act.scoringConfig?.mode || 'numeric';
  switchActivityScoringMode(sMode);
  if (act.scoringConfig?.numericConfig) {
    if (document.getElementById('activity-scoring-min')) document.getElementById('activity-scoring-min').value = act.scoringConfig.numericConfig.min ?? 0;
    if (document.getElementById('activity-scoring-max')) document.getElementById('activity-scoring-max').value = act.scoringConfig.numericConfig.max ?? 10;
    if (document.getElementById('activity-scoring-step')) document.getElementById('activity-scoring-step').value = act.scoringConfig.numericConfig.step ?? 0.1;
  }
  state._currentActivityLetterOptions = Array.isArray(act.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.letterOptions))
    : JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));
  state._currentActivityRubric = Array.isArray(act.scoringConfig?.rubric) && act.scoringConfig.rubric.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.rubric))
    : [
        { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
        { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
        { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
        { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
      ];
  state._currentActivityCouncils = Array.isArray(act.councils)
    ? JSON.parse(JSON.stringify(act.councils))
    : [];
  renderActivityLetterOptions();
  renderActivityRubricList();
  if (typeof renderActivityCouncilsInModal === 'function') renderActivityCouncilsInModal();
  const advBtn = document.getElementById('btn-open-advanced-councils');
  if (advBtn) advBtn.classList.add('hidden');

  document.getElementById('modal-activity-title').textContent = 'Chỉnh sửa Mốc Kế hoạch';
  document.getElementById('modal-activity').classList.remove('hidden');
};

window.copyActivityModal = function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const list = targetRound?.activities || state.roundActivities || [];
  const act = list.find(a => a.id === actId);
  if (!act) {
    showToast('Không tìm thấy thông tin mốc kế hoạch!', 'error');
    return;
  }

  // Clear ID so it will create a new activity on save
  document.getElementById('form-activity').reset();
  document.getElementById('activity-form-id').value = '';
  document.getElementById('activity-form-round-id').value = roundId;
  document.getElementById('activity-form-title').value = act.title ? `${act.title} (Bản sao)` : '';
  document.getElementById('activity-form-type').value = act.activityType || 'other';
  document.getElementById('activity-form-location').value = act.location || '';
  setActivityFormColor(act.color);

  // Dates
  const startParts = isoToVietnameseDateTime(act.startAt);
  const startDateInput = document.getElementById('activity-form-start-date');
  const startTimeInput = document.getElementById('activity-form-start-time');
  if (startDateInput) startDateInput.value = startParts.date;
  if (startTimeInput) startTimeInput.value = startParts.time;

  const endParts = isoToVietnameseDateTime(act.endAt);
  const endDateInput = document.getElementById('activity-form-end-date');
  const endTimeInput = document.getElementById('activity-form-end-time');
  if (endDateInput) endDateInput.value = endParts.date;
  if (endTimeInput) endTimeInput.value = endParts.time;

  // Rich Text Editor
  const editor = document.getElementById('activity-editor');
  if (editor) {
    editor.innerHTML = act.descriptionHtml || escapeHtml(act.description || '');
  }

  document.getElementById('activity-form-visibility').checked = act.visibility !== false;
  document.getElementById('activity-form-show-expired').checked = act.showAfterExpired !== false;
  if (document.getElementById('activity-form-is-tentative')) document.getElementById('activity-form-is-tentative').checked = Boolean(act.isTentative);
  const subEnabled = Boolean(act.submissionEnabled);
  document.getElementById('activity-form-submission').checked = subEnabled;
  if (typeof toggleActivitySubmissionConfig === 'function') toggleActivitySubmissionConfig(subEnabled);
  if (typeof populateActivitySubmissionForm === 'function') populateActivitySubmissionForm({
    ...(act.submissionConfig || {}),
    driveFolderId: '',
    driveFolderName: '',
    driveFolderUrl: ''
  });

  const councilEnabled = Boolean(act.councilEnabled);
  if (document.getElementById('activity-form-council-enabled')) {
    document.getElementById('activity-form-council-enabled').checked = councilEnabled;
    toggleActivityCouncilFields(councilEnabled);
  }
  if (document.getElementById('activity-form-show-order')) {
    document.getElementById('activity-form-show-order').checked = Boolean(act.showPresentationOrderToStudents);
  }
  const scoringEnabled = Boolean(act.scoringConfig?.enabled);
  if (document.getElementById('activity-form-scoring-enabled')) {
    document.getElementById('activity-form-scoring-enabled').checked = scoringEnabled;
    toggleActivityScoringConfig(scoringEnabled);
  }
  const sMode = act.scoringConfig?.mode || 'numeric';
  switchActivityScoringMode(sMode);
  if (act.scoringConfig?.numericConfig) {
    if (document.getElementById('activity-scoring-min')) document.getElementById('activity-scoring-min').value = act.scoringConfig.numericConfig.min ?? 0;
    if (document.getElementById('activity-scoring-max')) document.getElementById('activity-scoring-max').value = act.scoringConfig.numericConfig.max ?? 10;
    if (document.getElementById('activity-scoring-step')) document.getElementById('activity-scoring-step').value = act.scoringConfig.numericConfig.step ?? 0.1;
  }
  state._currentActivityLetterOptions = Array.isArray(act.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.letterOptions))
    : JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));
  state._currentActivityRubric = Array.isArray(act.scoringConfig?.rubric) && act.scoringConfig.rubric.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.rubric))
    : [
        { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
        { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
        { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
        { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
      ];
  state._currentActivityCouncils = Array.isArray(act.councils)
    ? JSON.parse(JSON.stringify(act.councils))
    : [];
  renderActivityLetterOptions();
  renderActivityRubricList();
  if (typeof renderActivityCouncilsInModal === 'function') renderActivityCouncilsInModal();
  const advBtn = document.getElementById('btn-open-advanced-councils');
  if (advBtn) advBtn.classList.add('hidden');

  document.getElementById('modal-activity-title').textContent = 'Sao chép Mốc Kế hoạch (Bản mới)';
  document.getElementById('modal-activity').classList.remove('hidden');
  showToast('Đã sao chép nội dung sang form mới. Bạn có thể chỉnh sửa trước khi lưu.', 'info');
};

window.closeActivityModal = function() {
  document.getElementById('modal-activity').classList.add('hidden');
};

// DUPLICATE ACTIVITY WITHIN SAME ROUND
window.duplicateActivityWithinRound = async function(actId) {
  if (!actId) return;
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Không tìm thấy thông tin đợt tốt nghiệp!', 'warning');
    return;
  }
  const list = targetRound?.activities || state.roundActivities || [];
  const src = list.find(a => a.id === actId);
  if (!src) {
    showToast('Không tìm thấy thông tin mốc kế hoạch cần sao chép!', 'error');
    return;
  }

  try {
    showToast('Đang sao chép mốc kế hoạch...', 'info');
    const nowIso = new Date().toISOString();
    const newId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newTitle = src.title ? `${src.title} (Bản sao)` : 'Mốc kế hoạch (Bản sao)';
    
    let activities = Array.isArray(targetRound.activities) ? [...targetRound.activities] : [];
    const newSlug = typeof generateUniqueSlug === 'function' ? generateUniqueSlug(newTitle, activities) : (slugify(newTitle) + '-' + Date.now());

    // Deep clone to keep configuration but avoid reference sharing
    const newAct = JSON.parse(JSON.stringify(src));

    // Overwrite identifiers & metadata
    newAct.id = newId;
    newAct.roundId = roundId;
    newAct.title = newTitle;
    newAct.slug = newSlug;
    newAct.createdAt = nowIso;
    newAct.updatedAt = nowIso;
    newAct.isTentative = Boolean(src.isTentative);
    newAct.publicationStatus = 'draft';
    newAct.visibility = false;

    // EXCLUDE runtime state & submissions/scoring data
    delete newAct.submissions;
    delete newAct.scores;
    delete newAct.attendance;
    delete newAct.auditLogs;
    newAct.councils = [];
    newAct.councilStudentAssignments = [];

    // Clear submission driveFolderId so newly uploaded files won't cross-contaminate
    if (newAct.submissionConfig) {
      newAct.submissionConfig.driveFolderId = null;
      newAct.submissionConfig.driveFolderUrl = null;
    }
    newAct.driveFolderId = null;
    newAct.driveFolderUrl = null;

    // Place right after the source activity in the timeline
    const srcIndex = activities.findIndex(a => a.id === actId);
    if (srcIndex >= 0) {
      activities.splice(srcIndex + 1, 0, newAct);
    } else {
      activities.push(newAct);
    }

    // Recalculate orders
    activities.forEach((actItem, idx) => {
      actItem.order = (idx + 1) * 10;
    });

    // Save to Firestore round document
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    // Update local state
    targetRound.activities = activities;
    state.roundActivities = activities;

    // Re-render admin timeline
    if (typeof loadAdminRoundActivities === 'function') {
      await loadAdminRoundActivities(roundId);
    }
    if (state.selectedRoundId === roundId && typeof loadStudentRoundActivities === 'function') {
      loadStudentRoundActivities(roundId);
    }

    showToast(`✓ Đã nhân bản mốc "${newTitle}" thành công!`, 'success');

    // Open edit modal for the newly duplicated milestone so admin can adjust dates/times
    if (typeof editActivityModal === 'function') {
      editActivityModal(newAct.id);
    }
  } catch (err) {
    console.error('[duplicateActivityWithinRound] Error:', err);
    showToast('Lỗi sao chép mốc: ' + (err.message || String(err)), 'error');
  }
};

// 4. COPY ACTIVITIES FROM ANOTHER ROUND
window.openCopyFromRoundModal = function() {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Vui lòng chọn đợt tốt nghiệp tiếp nhận kế hoạch!', 'warning');
    return;
  }

  const desc = document.getElementById('copy-round-target-desc');
  if (desc) desc.textContent = `Đợt tiếp nhận: ${targetRound.title}`;

  const sel = document.getElementById('copy-round-source-select');
  if (sel) {
    const otherRounds = (state.rounds || []).filter(r => r.id !== roundId && !r.isDeleted);
    sel.innerHTML = '<option value="">-- Chọn đợt nguồn --</option>' + otherRounds.map(r => {
      const actCount = (r.activities || []).length;
      return `<option value="${r.id}">${r.title} (${actCount} mốc)</option>`;
    }).join('');
  }

  const container = document.getElementById('copy-round-milestones-container');
  if (container) container.classList.add('hidden');
  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (submitBtn) submitBtn.disabled = true;

  document.getElementById('modal-copy-round')?.classList.remove('hidden');
};

window.closeCopyFromRoundModal = function() {
  document.getElementById('modal-copy-round')?.classList.add('hidden');
};

window.onSelectSourceRoundForCopy = async function(sourceRoundId) {
  const container = document.getElementById('copy-round-milestones-container');
  const listEl = document.getElementById('copy-round-milestones-list');
  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (!container || !listEl) return;

  if (!sourceRoundId) {
    container.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const sourceRound = (state.rounds || []).find(r => r.id === sourceRoundId);
  let acts = sourceRound?.activities || [];
  if (acts.length === 0) {
    try {
      const snap = await getDocs(collection(db, 'graduationRounds', sourceRoundId, 'activities'));
      if (snap && !snap.empty) {
        acts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (sourceRound) sourceRound.activities = acts;
      }
    } catch (e) {}
  }

  if (acts.length === 0) {
    listEl.innerHTML = '<div class="p-6 text-center text-slate-400">Đợt được chọn chưa có mốc kế hoạch nào để sao chép.</div>';
    container.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const sorted = acts.map((a, i) => normalizeActivity(a, sourceRoundId, i)).sort((a, b) => (a.order || 0) - (b.order || 0));

  listEl.innerHTML = sorted.map(a => {
    const typeMeta = ACTIVITY_TYPES[a.activityType] || ACTIVITY_TYPES.other;
    const timeStr = fmtActivityTime(a.startAt, a.endAt);
    return `
      <label class="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
        <input type="checkbox" value="${a.id}" data-act-id="${a.id}" checked onchange="updateCopyRoundSubmitState()" class="copy-milestone-checkbox rounded text-tdtu-blue mt-0.5">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-bold border ${typeMeta.color}">
              ${typeMeta.icon} ${typeMeta.label}
            </span>
            <span class="font-bold text-slate-900 text-xs truncate">${a.title}</span>
          </div>
          <p class="text-[11px] text-slate-500 font-mono">${timeStr}</p>
        </div>
      </label>
    `;
  }).join('');

  container.classList.remove('hidden');
  updateCopyRoundSubmitState();
};

window.toggleSelectAllCopyMilestones = function(select) {
  const checkboxes = document.querySelectorAll('.copy-milestone-checkbox');
  checkboxes.forEach(cb => cb.checked = select);
  updateCopyRoundSubmitState();
};

window.updateCopyRoundSubmitState = function() {
  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (!submitBtn) return;
  const checked = document.querySelectorAll('.copy-milestone-checkbox:checked');
  if (checked.length > 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = `Sao chép các mốc đã chọn (${checked.length})`;
  } else {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sao chép các mốc đã chọn';
  }
};

window.executeCopyFromRound = async function() {
  const targetRoundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const sourceRoundId = document.getElementById('copy-round-source-select')?.value;
  const targetRound = (state.rounds || []).find(r => r.id === targetRoundId);
  const sourceRound = (state.rounds || []).find(r => r.id === sourceRoundId);

  if (!targetRound || !sourceRound) {
    showToast('Lỗi xác định đợt nguồn hoặc đợt tiếp nhận!', 'error');
    return;
  }

  const checkedBoxes = Array.from(document.querySelectorAll('.copy-milestone-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 mốc để sao chép!', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang sao chép...';
  }

  try {
    const sourceActs = sourceRound.activities || [];
    const targetActs = Array.isArray(targetRound.activities) ? [...targetRound.activities] : [];

    let copyCount = 0;
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    
    // 1. Prepare Target Activities
    for (const cb of checkedBoxes) {
      const actId = cb.value;
      const src = sourceActs.find(a => a.id === actId);
      if (!src) continue;

      // Unique new ID and Slug
      const newSlug = generateUniqueSlug(src.title, targetActs);
      const newId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Deep clone to keep config but avoid reference sharing
      const newAct = JSON.parse(JSON.stringify(src));

      // Overwrite identifiers and metadata
      newAct.id = newId;
      newAct.roundId = targetRoundId;
      newAct.slug = newSlug;
      newAct.order = targetActs.length + 1;
      newAct.createdAt = nowIso;
      newAct.updatedAt = nowIso;
      newAct.isTentative = Boolean(src.isTentative);
      newAct.publicationStatus = 'draft';
      newAct.visibility = false;

      // EXCLUDE runtime state and avoid cross-round data pollution
      delete newAct.submissions;
      delete newAct.scores;
      delete newAct.attendance;
      delete newAct.auditLogs;
      newAct.councils = [];
      newAct.councilStudentAssignments = [];

      // SAFETY: Explicitly clear driveFolderId so the new round doesn't upload to the old round's folder
      newAct.driveFolderId = null;
      newAct.driveFolderUrl = null;
      if (newAct.submissionConfig) {
        newAct.submissionConfig.driveFolderId = null;
        newAct.submissionConfig.driveFolderUrl = null;
      }

      targetActs.push(newAct);
      
      copyCount++;
    }

    // 2. Batch write to the target round document
    const roundRef = doc(db, 'graduationRounds', targetRoundId);
    batch.update(roundRef, {
      activities: targetActs,
      updatedAt: serverTimestamp()
    });

    // 3. Commit Firestore Transaction
    await batch.commit();

    // 4. Update Local State & UI
    targetRound.activities = targetActs;
    state.roundActivities = targetActs;

    closeCopyFromRoundModal();
    await loadAdminRoundActivities(targetRoundId);
    if (state.selectedRoundId === targetRoundId) {
      loadStudentRoundActivities(targetRoundId);
    }

    showToast(`✓ Đã sao chép thành công ${copyCount} mốc kế hoạch vào đợt "${targetRound.title}"!`, 'success');
  } catch (err) {
    console.error('Lỗi sao chép mốc từ đợt khác:', err);
    showToast('Lỗi sao chép: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sao chép các mốc đã chọn';
    }
  }
};

// 5. SAVE ACTIVITY (PERSISTENCE WITH VIETNAMESE DATES & RICH TEXT)
window.saveActivity = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const roundId = document.getElementById('activity-form-round-id')?.value || state.selectedRoundId;
  const id = document.getElementById('activity-form-id')?.value?.trim();
  const title = document.getElementById('activity-form-title')?.value?.trim();
  const activityType = document.getElementById('activity-form-type')?.value || 'other';
  const location = document.getElementById('activity-form-location')?.value?.trim() || '';

  // Parse start date & time (Vietnamese format DD/MM/YYYY + HH:mm)
  const startDateStr = document.getElementById('activity-form-start-date')?.value?.trim();
  const startTimeStr = document.getElementById('activity-form-start-time')?.value?.trim();
  let startAt = '';
  if (startDateStr) {
    const parsedStart = parseVietnameseDateTime(startDateStr, startTimeStr, '00:00');
    if (parsedStart === null) {
      showToast('Thời gian bắt đầu không hợp lệ! Vui lòng kiểm tra ngày DD/MM/YYYY và giờ HH:mm', 'warning');
      return;
    }
    startAt = parsedStart;
  }

  // Parse end date & time
  const endDateStr = document.getElementById('activity-form-end-date')?.value?.trim();
  const endTimeStr = document.getElementById('activity-form-end-time')?.value?.trim();
  let endAt = '';
  if (endDateStr) {
    const parsedEnd = parseVietnameseDateTime(endDateStr, endTimeStr, '23:59');
    if (parsedEnd === null) {
      showToast('Thời gian kết thúc không hợp lệ! Vui lòng kiểm tra ngày DD/MM/YYYY và giờ HH:mm', 'warning');
      return;
    }
    endAt = parsedEnd;
  }

  // Validation: endAt >= startAt if both provided
  if (startAt && endAt) {
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (endDate < startDate) {
      showToast('Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu!', 'warning');
      return;
    }
  }

  // Rich Text Description
  const editor = document.getElementById('activity-editor');
  const rawHtml = editor ? editor.innerHTML.trim() : '';
  const descriptionHtml = sanitizeRichHtml(rawHtml);
  const descriptionText = editor ? (editor.innerText || editor.textContent || '').trim() : '';

  const visibility = document.getElementById('activity-form-visibility')?.checked !== false;
  const showAfterExpired = document.getElementById('activity-form-show-expired')?.checked !== false;
  const isTentative = document.getElementById('activity-form-is-tentative')?.checked === true;
  const submissionEnabled = document.getElementById('activity-form-submission')?.checked === true;

  if (!title) {
    showToast('Vui lòng nhập tên mốc kế hoạch (*)', 'warning');
    return;
  }

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Không tìm thấy đợt tốt nghiệp tương ứng!', 'error');
    return;
  }

  const submitBtn = document.querySelector('#form-activity button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  try {
    let activities = Array.isArray(targetRound.activities) ? [...targetRound.activities] : [];
    const slug = id ? (activities.find(a => a.id === id)?.slug || slugify(title)) : generateUniqueSlug(title, activities);
    const actId = id || ('act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    const councilEnabled = document.getElementById('activity-form-council-enabled')?.checked === true;
    const showPresentationOrderToStudents = document.getElementById('activity-form-show-order')?.checked === true;
    const scoringEnabled = document.getElementById('activity-form-scoring-enabled')?.checked === true;
    const scoringMode = document.querySelector('input[name="activity_scoring_mode"]:checked')?.value || 'numeric';
    const sMin = parseFloat(document.getElementById('activity-scoring-min')?.value) || 0;
    const sMax = parseFloat(document.getElementById('activity-scoring-max')?.value) || 10;
    const sStep = parseFloat(document.getElementById('activity-scoring-step')?.value) || 0.1;

    if (scoringEnabled && scoringMode === 'defense_rubric') {
      const rList = state._currentActivityRubric || [];
      if (rList.length === 0) {
        showToast('Chế độ Rubric bảo vệ yêu cầu ít nhất 1 tiêu chí chấm!', 'warning');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu Mốc'; }
        return;
      }
      const keys = new Set();
      for (const crit of rList) {
        if (!crit.key || !crit.label || typeof crit.maxScore !== 'number' || crit.maxScore <= 0) {
          showToast('Tiêu chí rubric không hợp lệ: vui lòng nhập mã, tên và điểm tối đa > 0!', 'warning');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu Mốc'; }
          return;
        }
        if (keys.has(crit.key)) {
          showToast(`Mã tiêu chí "${crit.key}" bị trùng lặp trong Rubric!`, 'warning');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu Mốc'; }
          return;
        }
        keys.add(crit.key);
      }
    }

    const scoringConfig = {
      enabled: scoringEnabled,
      mode: scoringMode,
      rubric: state._currentActivityRubric || [],
      letterOptions: state._currentActivityLetterOptions || [],
      numericConfig: { min: sMin, max: sMax, step: sStep }
    };

    // Preserve existing council data if editing
    const existingAct = activities.find(a => a.id === actId);

    const submissionConfig = submissionEnabled && typeof readActivitySubmissionForm === 'function'
      ? readActivitySubmissionForm()
      : (existingAct?.submissionConfig || null);

    const activityData = {
      id: actId,
      roundId,
      title,
      activityType,
      color: normalizeRoundWeekEventColor(document.getElementById('activity-form-color')?.value),
      location,
      startAt,
      endAt,
      description: descriptionText,
      descriptionHtml,
      visibility,
      publicationStatus: visibility ? 'published' : 'draft',
      showAfterExpired,
      isTentative,
      submissionEnabled,
      submissionConfig,
      driveFolderId: submissionConfig?.driveFolderId || existingAct?.driveFolderId || null,
      driveFolderName: submissionConfig?.driveFolderName || existingAct?.driveFolderName || null,
      driveFolderUrl: submissionConfig?.driveFolderUrl || existingAct?.driveFolderUrl || null,
      councilEnabled,
      showPresentationOrderToStudents,
      scoringConfig,
      councilStructure: existingAct?.councilStructure || {
        slots: [
          { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng', type: 'mandatory' },
          { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng', type: 'mandatory' },
          { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng', type: 'mandatory' }
        ]
      },
      councils: Array.isArray(state._currentActivityCouncils) ? state._currentActivityCouncils : (existingAct?.councils || []),
      councilStudentAssignments: existingAct?.councilStudentAssignments || [],
      slug,
      updatedAt: new Date().toISOString()
    };

    const existingIdx = activities.findIndex(a => a.id === actId);
    if (existingIdx >= 0) {
      activityData.order = activities[existingIdx].order || (existingIdx + 1);
      activityData.createdAt = activities[existingIdx].createdAt || activityData.updatedAt;
      activities[existingIdx] = activityData;
    } else {
      activityData.order = activities.length + 1;
      activityData.createdAt = activityData.updatedAt;
      activities.push(activityData);
    }

    // Save to Firestore round document
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    // Best-effort sync to subcollection has been removed as parent array is the strict source of truth.

    targetRound.activities = activities;
    state.roundActivities = activities;

    closeActivityModal();
    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }

    showToast(`✓ Đã lưu mốc "${title}" thành công!`, 'success');
  } catch (err) {
    console.error('Lỗi lưu mốc kế hoạch:', err);
    showToast('Lỗi lưu mốc: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Lưu Mốc';
    }
  }
};

// 6. DELETE ACTIVITY
window.deleteActivity = async function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = targetRound.activities || [];
  const act = activities.find(a => a.id === actId);
  if (!act) return;

  const confirmed = await showConfirm(
    'Xóa mốc kế hoạch',
    `Bạn có chắc chắn muốn xóa mốc "${act.title}" khỏi kế hoạch đợt này không?`,
    { confirmText: 'Xóa vĩnh viễn', danger: true }
  );
  if (!confirmed) return;

  try {
    const updated = activities.filter(a => a.id !== actId).map((a, idx) => ({ ...a, order: idx + 1 }));
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities: updated,
      updatedAt: serverTimestamp()
    });

    // Subcollection sync removed

    targetRound.activities = updated;
    state.roundActivities = updated;

    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
    showToast(`Đã xóa mốc "${act.title}".`, 'info');
  } catch (err) {
    console.error('Lỗi xóa mốc:', err);
    showToast('Lỗi xóa mốc: ' + err.message, 'error');
  }
};

// 7. TOGGLE VISIBILITY
window.toggleActivityVisibility = async function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = targetRound.activities || [];
  const act = activities.find(a => a.id === actId);
  if (!act) return;

  const willPublish = !isActivityPublished(act);
  act.visibility = willPublish;
  act.publicationStatus = willPublish ? 'published' : 'draft';

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
    showToast(willPublish ? `Đã công bố mốc "${act.title}" cho sinh viên.` : `Đã chuyển mốc "${act.title}" về bản nháp.`, 'info');
  } catch (err) {
    showToast('Lỗi cập nhật: ' + err.message, 'error');
  }
};

// 8. MOVE ACTIVITY (REORDER UP/DOWN)
window.moveActivity = async function(actId, direction) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = targetRound.activities || [];
  const idx = activities.findIndex(a => a.id === actId);
  if (idx < 0) return;

  if (direction === 'up' && idx > 0) {
    const temp = activities[idx];
    activities[idx] = activities[idx - 1];
    activities[idx - 1] = temp;
  } else if (direction === 'down' && idx < activities.length - 1) {
    const temp = activities[idx];
    activities[idx] = activities[idx + 1];
    activities[idx + 1] = temp;
  } else {
    return;
  }

  activities.forEach((a, i) => a.order = i + 1);

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
  } catch (err) {
    showToast('Lỗi đổi thứ tự: ' + err.message, 'error');
  }
};

// 9. COPY ACTIVITY LINK
window.copyActivityLink = async function(roundId, activitySlug) {
  const r = (state.rounds || []).find(x => x.id === roundId);
  const rCode = r?.slug || r?.shortCode || roundId;
  const link = `${window.location.origin}${window.location.pathname}?x=${encodeURIComponent(rCode)}&a=${encodeURIComponent(activitySlug)}`;
  await copyLinkWithFallback(link, 'liên kết mốc kế hoạch');
};

// 10. UNIFIED MILESTONE TIMELINE & COUNTDOWN HELPERS
let milestoneCountdownInterval = null;

export function formatCountdownText(targetMs, nowMs = Date.now()) {
  if (!targetMs) return '';
  const diff = targetMs - nowMs;
  if (diff <= 0) return 'Đã đến hạn';

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = n => String(n).padStart(2, '0');

  if (days > 0) {
    return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
window.formatCountdownText = formatCountdownText;

export function findNearestMilestone(activities) {
  if (!Array.isArray(activities) || activities.length === 0) return null;
  const now = Date.now();

  const parsed = activities.map(act => {
    let startMs = null;
    let endMs = null;
    if (act.startAt) {
      const d = act.startAt.toDate ? act.startAt.toDate() : new Date(act.startAt);
      if (!isNaN(d.getTime())) startMs = d.getTime();
    }
    if (act.endAt) {
      const d = act.endAt.toDate ? act.endAt.toDate() : new Date(act.endAt);
      if (!isNaN(d.getTime())) endMs = d.getTime();
    }
    const status = getActivityStatus(act);
    return { act, status, startMs, endMs };
  });

  // Priority 1: Milestone that is 'ongoing' (currently running).
  // Pick the one that ends soonest (minimum endMs > now).
  const ongoing = parsed.filter(p => p.status === 'ongoing' && p.endMs && p.endMs > now);
  if (ongoing.length > 0) {
    ongoing.sort((a, b) => a.endMs - b.endMs);
    return { act: ongoing[0].act, type: 'ongoing', targetMs: ongoing[0].endMs };
  }

  // Priority 2: Milestone that is 'upcoming' (future).
  // Pick the one that starts soonest (minimum startMs > now).
  const upcoming = parsed.filter(p => p.status === 'upcoming' && p.startMs && p.startMs > now);
  if (upcoming.length > 0) {
    upcoming.sort((a, b) => a.startMs - b.startMs);
    return { act: upcoming[0].act, type: 'upcoming', targetMs: upcoming[0].startMs };
  }

  const anyOngoing = parsed.find(p => p.status === 'ongoing');
  if (anyOngoing) {
    return { act: anyOngoing.act, type: 'ongoing', targetMs: anyOngoing.endMs || null };
  }

  const anyUpcoming = parsed.find(p => p.status === 'upcoming');
  if (anyUpcoming) {
    return { act: anyUpcoming.act, type: 'upcoming', targetMs: anyUpcoming.startMs || null };
  }

  return null;
}
window.findNearestMilestone = findNearestMilestone;

export function startMilestoneCountdownTicker() {
  if (milestoneCountdownInterval) return;
  milestoneCountdownInterval = setInterval(() => {
    const badges = document.querySelectorAll('.milestone-countdown-badge[data-countdown-target]');
    if (badges.length === 0) return;
    const now = Date.now();
    badges.forEach(badge => {
      const targetMs = parseInt(badge.dataset.countdownTarget, 10);
      const prefix = badge.dataset.countdownPrefix || '';
      if (!isNaN(targetMs)) {
        badge.textContent = prefix + formatCountdownText(targetMs, now);
      }
    });
  }, 1000);
}
window.startMilestoneCountdownTicker = startMilestoneCountdownTicker;

window.toggleUnifiedMilestoneCard = function(rid, actId, prefix = '') {
  const pfx = prefix ? `${prefix}-` : '';
  let bodyEl = document.getElementById(`milestone-body-${pfx}${actId}`);
  let headerEl = document.getElementById(`milestone-header-${pfx}${actId}`);
  let btnEl = document.getElementById(`milestone-toggle-btn-${pfx}${actId}`);
  if (!bodyEl) {
    bodyEl = document.getElementById(`milestone-body-${actId}`);
    headerEl = document.getElementById(`milestone-header-${actId}`);
    btnEl = document.getElementById(`milestone-toggle-btn-${actId}`);
  }
  if (!bodyEl) return;
  const isHidden = bodyEl.classList.contains('hidden');
  bodyEl.classList.toggle('hidden', !isHidden);
  if (headerEl) headerEl.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  if (btnEl) btnEl.innerHTML = isHidden ? '▲ Thu gọn' : '▼ Xem chi tiết';

  try {
    const key = 'grad_milestone_open_' + rid;
    const map = JSON.parse(sessionStorage.getItem(key) || '{}');
    map[actId] = isHidden ? 'open' : 'closed';
    sessionStorage.setItem(key, JSON.stringify(map));
  } catch (e) {}
};

window.toggleMilestoneCard = function(rid, actId) {
  window.toggleUnifiedMilestoneCard(rid, actId, 'stu');
};

export function renderUnifiedActivityCard(act, round, options = {}) {
  const {
    isStudent = false,
    isNearest = false,
    nearestType = 'ongoing',
    nearestTargetMs = null,
    prefix = (isStudent ? 'stu' : 'sup')
  } = options;

  const roundId = round?.id || state.selectedRoundId || '';
  const typeMeta = ACTIVITY_TYPES[act.activityType] || ACTIVITY_TYPES.other;
  const status = getActivityStatus(act);
  const timeStr = fmtActivityTime(act.startAt, act.endAt);

  let expanded = (status === 'ongoing');
  try {
    const map = JSON.parse(sessionStorage.getItem('grad_milestone_open_' + roundId) || '{}');
    if (map[act.id]) expanded = (map[act.id] === 'open');
  } catch (e) {}

  let markerHtml = '';
  let cardBorder = 'border-slate-200 bg-white';
  let statusPill = '';

  if (status === 'ongoing') {
    markerHtml = '<div class="w-7 h-7 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center text-xs font-black shadow-sm shrink-0 pulse-timer">●</div>';
    cardBorder = 'border-emerald-300 bg-emerald-50/20';
    statusPill = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-sm">● Đang diễn ra</span>';
  } else if (status === 'upcoming') {
    markerHtml = '<div class="w-7 h-7 rounded-full bg-amber-50 border-2 border-amber-400 text-amber-600 flex items-center justify-center text-xs font-black shadow-sm shrink-0">○</div>';
    cardBorder = 'border-amber-200/80 bg-white';
    statusPill = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">○ Sắp tới</span>';
  } else if (status === 'past') {
    markerHtml = '<div class="w-7 h-7 rounded-full bg-slate-200 border-2 border-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">✓</div>';
    cardBorder = 'border-slate-200/70 bg-slate-50/50 opacity-90';
    statusPill = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">✓ Đã kết thúc</span>';
  } else {
    markerHtml = '<div class="w-7 h-7 rounded-full bg-blue-50 border-2 border-blue-300 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">📌</div>';
    cardBorder = 'border-slate-200 bg-white';
    statusPill = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Kế hoạch</span>';
  }

  // Highlight nearest milestone card
  if (isNearest) {
    cardBorder += ' ring-2 ring-emerald-500/40 shadow-sm';
  }

  // Countdown Badge ONLY on the single nearest milestone
  let countdownBadge = '';
  if (isNearest && nearestTargetMs) {
    const isOngoing = (nearestType === 'ongoing');
    const prefixText = isOngoing ? '⏳ Còn lại: ' : '⏳ Bắt đầu sau: ';
    const badgeColor = isOngoing
      ? 'bg-rose-500 text-white ring-2 ring-rose-300/50 animate-pulse'
      : 'bg-amber-500 text-slate-950 ring-2 ring-amber-300/50 font-black';
    const initText = formatCountdownText(nearestTargetMs);

    countdownBadge = `
      <span class="milestone-countdown-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-xs ${badgeColor}"
            data-countdown-target="${nearestTargetMs}"
            data-countdown-prefix="${prefixText}">
        ${prefixText}${initText}
      </span>
    `;
  }

  // Rich description
  let descriptionRender = '';
  if (act.descriptionHtml && act.descriptionHtml.trim()) {
    descriptionRender = `
      <div class="mt-2 text-xs text-slate-700 leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-100 rich-rendered-content shadow-xs">
        ${sanitizeRichHtml(act.descriptionHtml)}
      </div>
    `;
  } else if (act.description && act.description.trim()) {
    descriptionRender = `
      <div class="mt-2 text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-100">
        ${escapeHtml(act.description)}
      </div>
    `;
  }

  const pfx = prefix ? `${prefix}-` : '';
  const headerAttrs = `id="milestone-header-${pfx}${act.id}" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="milestone-body-${pfx}${act.id}" onclick="toggleUnifiedMilestoneCard('${roundId}', '${act.id}', '${prefix}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleUnifiedMilestoneCard('${roundId}', '${act.id}', '${prefix}');}"`;

  return `
    <div id="activity-card-${pfx}${act.slug || act.id}" data-activity-id="${act.id}" class="flex items-start gap-3.5 p-4 rounded-2xl border ${cardBorder} transition-all duration-300 relative">
      ${markerHtml}
      <div class="flex-1 min-w-0">
        <div ${headerAttrs} class="cursor-pointer select-none rounded-xl -mx-1 px-1 py-0.5 hover:bg-slate-900/[.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-tdtu-blue">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div class="flex flex-wrap items-center gap-1.5">
              ${statusPill}
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeMeta.color}">
                <span>${typeMeta.icon}</span> ${typeMeta.label}
              </span>
              ${act.isTentative ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">🟡 Dự kiến</span>' : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">Chính thức</span>'}
              ${countdownBadge}
            </div>
            <div class="flex items-center gap-1.5">
              ${!isStudent ? `
                <button type="button" onclick="event.stopPropagation();copyActivityLink('${roundId}', '${act.slug}')" class="text-[11px] font-semibold text-slate-400 hover:text-tdtu-blue flex items-center gap-1 transition-colors" title="Sao chép link mốc này">
                  <span>🔗 Link</span>
                </button>
              ` : ''}
              <span id="milestone-toggle-btn-${pfx}${act.id}" class="text-[11px] font-bold text-slate-500 hover:text-tdtu-blue flex items-center gap-1 transition-colors shrink-0" aria-hidden="true">
                <span>${expanded ? '▲ Thu gọn' : '▼ Xem chi tiết'}</span>
              </span>
            </div>
          </div>

          <h3 class="text-sm sm:text-base font-black text-slate-900 tracking-tight">${escapeHtml(act.title)}</h3>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5 font-medium">
            <div class="flex items-center gap-1 font-mono text-[11px] text-slate-700">
              <span>🕒</span> <span class="text-slate-500 font-sans font-normal">${act.isTentative ? 'Thời gian dự kiến:' : 'Thời gian chính thức:'}</span> ${timeStr}
            </div>
            ${!expanded && act.location ? `
              <div class="flex items-center gap-1 text-[11px] text-slate-600">
                <span>📍</span> ${escapeHtml(act.location)}
              </div>
            ` : ''}
          </div>
        </div>

        <div id="milestone-body-${pfx}${act.id}" class="${expanded ? '' : 'hidden'}">
          ${act.location ? `
            <div class="flex items-center gap-1 text-[11px] text-slate-600 mt-1.5">
              <span>📍</span> ${escapeHtml(act.location)}
            </div>
          ` : ''}

          ${descriptionRender}

          ${isStudent && act.submissionEnabled && typeof renderStudentSubmissionPanel === 'function' ? renderStudentSubmissionPanel(act, round) : ''}

          ${!isStudent && typeof renderEffectiveCouncilMembershipNotice === 'function' ? renderEffectiveCouncilMembershipNotice(act) : ''}
        </div>
      </div>
    </div>
  `;
}
window.renderUnifiedActivityCard = renderUnifiedActivityCard;

// 11. STUDENT TIMELINE RENDERING
state.showAllActivities = false;

window.toggleStudentTimelineViewAll = function() {
  state.showAllActivities = !state.showAllActivities;
  if (state.selectedRoundId) {
    loadStudentRoundActivities(state.selectedRoundId);
  }
};

window.loadStudentRoundActivities = async function(roundId) {
  const container = document.getElementById('student-timeline-list');
  const actionWrap = document.getElementById('student-timeline-header-actions');
  const timelineSection = document.getElementById('student-timeline-section');
  if (!container) return;

  if (state.eligibilityState === 'not_eligible' && (!state.isAdmin || state.impersonation)) {
    if (timelineSection) timelineSection.classList.add('hidden');
    return;
  }
  if (timelineSection) timelineSection.classList.remove('hidden');

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Chưa có thông tin đợt tốt nghiệp.</div>';
    if (actionWrap) actionWrap.innerHTML = '';
    return;
  }

  const hasEmbeddedActivities = Array.isArray(targetRound.activities);
  let list = hasEmbeddedActivities ? targetRound.activities : [];
  if (!hasEmbeddedActivities) {
    try {
      const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
      if (snap && !snap.empty) {
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {}
  }

  const visible = list
    .map((a, idx) => normalizeActivity(a, roundId, idx))
    .filter(a => (state.isAdmin && !state.impersonation) || isActivityPublished(a))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  state.studentVisibleActivities = { roundId, activities: visible };
  if (typeof renderStudentTimelineWeeks === 'function') renderStudentTimelineWeeks();

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <span class="text-2xl block mb-1">📅</span>
        <span class="font-bold text-slate-700 text-xs block">Kế hoạch đợt tốt nghiệp đang được cập nhật</span>
        <p class="text-[11px] text-slate-400 mt-0.5">Khoa sẽ sớm công bố lộ trình và các mốc kiểm tra cho đợt này.</p>
      </div>
    `;
    if (actionWrap) actionWrap.innerHTML = '';
    return;
  }

  const mainItems = [];
  const collapsedPastItems = [];

  visible.forEach(act => {
    const status = getActivityStatus(act);
    const isExpiredAndHidden = (status === 'past' && act.showAfterExpired === false && !state.showAllActivities);
    if (isExpiredAndHidden) {
      collapsedPastItems.push(act);
    } else {
      mainItems.push(act);
    }
  });

  if (actionWrap) {
    if (collapsedPastItems.length > 0) {
      actionWrap.innerHTML = `
        <button type="button" onclick="toggleStudentTimelineViewAll()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5">
          <span>👁️ Xem toàn bộ (${visible.length})</span>
        </button>
      `;
    } else if (state.showAllActivities && visible.length > mainItems.length) {
      actionWrap.innerHTML = `
        <button type="button" onclick="toggleStudentTimelineViewAll()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5">
          <span>▲ Thu gọn mốc đã qua</span>
        </button>
      `;
    } else {
      actionWrap.innerHTML = '';
    }
  }

  const nearest = findNearestMilestone(visible);

  function renderActivityCard(act) {
    const isNearest = Boolean(nearest && nearest.act && nearest.act.id === act.id);
    return renderUnifiedActivityCard(act, targetRound, {
      isStudent: true,
      isNearest,
      nearestType: nearest?.type || 'ongoing',
      nearestTargetMs: nearest?.targetMs || null,
      prefix: 'stu'
    });
  }

  let htmlContent = '';
  if (mainItems.length > 0) {
    htmlContent += mainItems.map(renderActivityCard).join('');
  }
  if (collapsedPastItems.length > 0) {
    htmlContent += `
      <div class="pt-2">
        <button type="button" onclick="toggleStudentTimelineViewAll()" class="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-colors">
          <span>▼ Xem các mốc đã qua (${collapsedPastItems.length})</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = htmlContent;
  startMilestoneCountdownTicker();

  if (typeof updateStudentPersonalSidebar === 'function') updateStudentPersonalSidebar();
  if (typeof renderRoundHeader === 'function') renderRoundHeader();
  if (typeof updateStudentJourneyStepper === 'function') updateStudentJourneyStepper();

  if (state.targetActivitySlug) {
    const targetSlug = state.targetActivitySlug;
    setTimeout(() => {
      const el = document.getElementById('activity-card-' + targetSlug)
        || document.getElementById('activity-card-' + slugify(targetSlug));
      if (el) {
        // Deep-linked milestone should be visible: force-expand if collapsed.
        const actId = el.getAttribute('data-activity-id');
        if (actId) {
          const bodyEl = document.getElementById('milestone-body-' + actId);
          if (bodyEl && bodyEl.classList.contains('hidden')) {
            window.setMilestoneExpanded(roundId, actId, true);
          }
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400', 'bg-amber-50/70');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-50/70');
        }, 3500);
      }
      state.targetActivitySlug = null;
    }, 300);
  }
};


// Global window bridges for cross-module accessibility
window.getActivityStatus = getActivityStatus;
window.fmtActivityTime = fmtActivityTime;
window.isoToVietnameseDateTime = isoToVietnameseDateTime;
window.parseVietnameseDateTime = parseVietnameseDateTime;
window.sanitizeRichHtml = sanitizeRichHtml;
window.generateUniqueSlug = generateUniqueSlug;
window.isActivityPublished = isActivityPublished;
window.normalizeActivity = normalizeActivity;

window.ACTIVITY_TYPES = ACTIVITY_TYPES;
window.DEFAULT_LETTER_GRADE_SCALE = DEFAULT_LETTER_GRADE_SCALE;
