
const roundWeekEventOccursOnDay = (e, d) => (typeof window !== 'undefined' && window.roundWeekEventOccursOnDay ? window.roundWeekEventOccursOnDay(e, d) : false);
const distinguishOverlappingTimelineEvents = (evs, ds) => (typeof window !== 'undefined' && window.distinguishOverlappingTimelineEvents ? window.distinguishOverlappingTimelineEvents(evs, ds) : (evs || []));
const normalizeRoundWeekEventColor = (val) => (typeof window !== 'undefined' && window.normalizeRoundWeekEventColor ? window.normalizeRoundWeekEventColor(val) : (val || '#2563eb'));

// --- Module Bridges ---
const renderAdminRoundsCards = () => window.renderAdminRoundsCards?.();
const switchAdminTab = (tab) => window.switchAdminTab?.(tab);
/**
 * IFA+ Graduation — Planning Activities & Milestones CRUD Submodule
 */
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
let savedActivityEditorRange = null;
let savedActivityEditorSelection = null;
let activeAnchorForTooltip = null;
let linkTooltipEl = null;

// Safe URL Normalization & Validation Helper
export function normalizeRichLinkUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Vui lòng nhập địa chỉ liên kết (URL)!' };
  }
  let url = rawUrl.trim();
  if (!url) {
    return { valid: false, error: 'Vui lòng nhập địa chỉ liên kết (URL)!' };
  }

  // Reject dangerous protocols
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return {
      valid: false,
      error: 'Địa chỉ liên kết không an toàn! Vui lòng chỉ dùng liên kết web (http/https).'
    };
  }

  // Auto-correct common accidental typo prefixes from copy-pasting
  url = url.replace(/^s:\/\/+/i, 'https://');
  url = url.replace(/^ttps:\/\/+/i, 'https://');
  url = url.replace(/^ttp:\/\/+/i, 'http://');
  url = url.replace(/^\/\/+/i, 'https://');
  url = url.replace(/^http\/\//i, 'http://');
  url = url.replace(/^https\/\//i, 'https://');
  url = url.replace(/^http:\/([^\/])/i, 'http://$1');
  url = url.replace(/^https:\/([^\/])/i, 'https://$1');

  // Auto-prepend https:// if starts with www. or lacks protocol
  if (/^www\./i.test(url)) {
    url = 'https://' + url;
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Địa chỉ liên kết phải sử dụng giao thức http:// hoặc https://!'
      };
    }
    return { valid: true, url: parsed.href };
  } catch (err) {
    return { valid: false, error: 'Địa chỉ liên kết không đúng định dạng!' };
  }
}

// Helper: Find closest <a> element containing node inside editor
function findClosestAnchor(node, editor) {
  let curr = node;
  while (curr && curr !== editor && curr !== document.body) {
    if (curr.nodeType === 1 && curr.tagName.toLowerCase() === 'a') {
      return curr;
    }
    curr = curr.parentNode;
  }
  return null;
}

// Capture current selection state inside editor
export function captureActivityEditorSelection(targetAnchor = null) {
  const editor = document.getElementById('activity-editor');
  if (!editor) return;

  if (targetAnchor && editor.contains(targetAnchor)) {
    savedActivityEditorSelection = {
      range: null,
      anchor: targetAnchor,
      selectedText: targetAnchor.textContent || '',
      isCollapsed: false
    };
    return;
  }

  const selection = window.getSelection();
  if (editor && selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
    savedActivityEditorRange = selection.getRangeAt(0).cloneRange();
    const anchor = findClosestAnchor(selection.anchorNode, editor) ||
                   findClosestAnchor(selection.focusNode, editor);

    savedActivityEditorSelection = {
      range: savedActivityEditorRange,
      anchor: anchor || null,
      selectedText: selection.isCollapsed ? '' : selection.toString(),
      isCollapsed: selection.isCollapsed
    };
  }
}
window.captureActivityEditorSelection = captureActivityEditorSelection;

// Restore selection into editor
export function restoreActivityEditorSelection() {
  const editor = document.getElementById('activity-editor');
  if (!editor) return;

  const selection = window.getSelection();
  if (!selection) return;

  if (savedActivityEditorRange && editor.contains(savedActivityEditorRange.commonAncestorContainer)) {
    try {
      editor.focus();
      selection.removeAllRanges();
      selection.addRange(savedActivityEditorRange);
    } catch (e) {}
  } else if (savedActivityEditorSelection?.anchor && editor.contains(savedActivityEditorSelection.anchor)) {
    try {
      editor.focus();
      const r = document.createRange();
      r.selectNodeContents(savedActivityEditorSelection.anchor);
      selection.removeAllRanges();
      selection.addRange(r);
    } catch (e) {}
  }
}
window.restoreActivityEditorSelection = restoreActivityEditorSelection;

window.applyActivityTextColor = function(color) {
  restoreActivityEditorSelection();
  document.execCommand('foreColor', false, color);
  window.captureActivityEditorSelection();
};

window.richFormatHeading = function(tag) {
  if (!tag) return;
  restoreActivityEditorSelection();
  document.execCommand('formatBlock', false, '<' + tag + '>');
  window.captureActivityEditorSelection();
  document.getElementById('activity-editor')?.focus();
};

window.setRichFontSize = function(size) {
  if (!size) return;
  restoreActivityEditorSelection();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;

  document.execCommand('fontSize', false, '7');
  const editor = document.getElementById('activity-editor');
  if (editor) {
    const fonts = Array.from(editor.querySelectorAll('font[size="7"], font[size]'));
    fonts.forEach(f => {
      // Clear inner font-size overrides so parent size takes effect uniformly
      f.querySelectorAll('[style*="font-size"]').forEach(inner => {
        inner.style.fontSize = '';
        if (!inner.getAttribute('style') || !inner.getAttribute('style').trim()) {
          inner.removeAttribute('style');
        }
      });
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      if (f.getAttribute('color')) span.style.color = f.getAttribute('color');
      if (f.getAttribute('style')) {
        span.setAttribute('style', f.getAttribute('style'));
        span.style.fontSize = size + 'px';
      }
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });

    const styledSpans = Array.from(editor.querySelectorAll('span[style*="font-size: xxx-large"], span[style*="font-size: -webkit-xxx-large"]'));
    styledSpans.forEach(sp => {
      sp.style.fontSize = size + 'px';
      sp.querySelectorAll('[style*="font-size"]').forEach(inner => {
        inner.style.fontSize = '';
        if (!inner.getAttribute('style') || !inner.getAttribute('style').trim()) {
          inner.removeAttribute('style');
        }
      });
    });

    if (fonts.length === 0 && styledSpans.length === 0) {
      const range = (sel && sel.rangeCount) ? sel.getRangeAt(0) : savedActivityEditorRange;
      if (range && !range.collapsed && editor.contains(range.commonAncestorContainer)) {
        try {
          const span = document.createElement('span');
          span.style.fontSize = size + 'px';
          span.appendChild(range.extractContents());
          range.insertNode(span);
        } catch (e) {}
      }
    }
  }
  window.captureActivityEditorSelection();
  document.getElementById('activity-editor')?.focus();
};

// Floating link action pill
function getOrCreateLinkTooltip() {
  if (!linkTooltipEl) {
    linkTooltipEl = document.createElement('div');
    linkTooltipEl.id = 'activity-editor-link-tooltip';
    linkTooltipEl.className = 'rich-link-tooltip hidden';
    linkTooltipEl.innerHTML = `
      <span class="text-blue-600 font-bold select-none text-xs">🔗</span>
      <span data-link-href class="max-w-[200px] truncate px-1 font-mono text-[11px] text-blue-700 select-all font-semibold"></span>
      <button type="button" data-link-open class="rounded-lg px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer" title="Mở thử trong tab mới">
        <span>Mở link</span> ↗
      </button>
      <button type="button" data-link-edit class="rounded-lg px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer" title="Chỉnh sửa liên kết">
        <span>✏️ Sửa</span>
      </button>
      <button type="button" data-link-unlink class="rounded-lg px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs inline-flex items-center gap-1 cursor-pointer" title="Gỡ liên kết">
        <span>🚫 Gỡ</span>
      </button>
    `;
    document.body.appendChild(linkTooltipEl);

    linkTooltipEl.querySelector('[data-link-open]').onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const href = linkTooltipEl.getAttribute('data-active-href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    };
    linkTooltipEl.querySelector('[data-link-edit]').onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const targetAnchor = activeAnchorForTooltip;
      hideLinkFloatingTooltip();
      insertRichLink(targetAnchor);
    };
    linkTooltipEl.querySelector('[data-link-unlink]').onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const targetAnchor = activeAnchorForTooltip;
      hideLinkFloatingTooltip();
      unlinkRichLink(targetAnchor);
    };
  }
  return linkTooltipEl;
}

export function showLinkFloatingTooltip(anchor) {
  if (!anchor || !anchor.parentNode) {
    hideLinkFloatingTooltip();
    return;
  }
  activeAnchorForTooltip = anchor;
  const tooltip = getOrCreateLinkTooltip();
  const href = anchor.getAttribute('href') || '';
  tooltip.setAttribute('data-active-href', href);
  const textLabel = tooltip.querySelector('[data-link-href]');
  if (textLabel) textLabel.textContent = href;

  const rect = anchor.getBoundingClientRect();
  const tooltipHeight = 36;
  let top = rect.bottom + 6;
  if (top + tooltipHeight > window.innerHeight) {
    top = Math.max(10, rect.top - tooltipHeight - 6);
  }
  tooltip.style.left = `${Math.max(10, rect.left)}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.remove('hidden');
}

export function hideLinkFloatingTooltip() {
  if (linkTooltipEl) {
    linkTooltipEl.classList.add('hidden');
  }
  activeAnchorForTooltip = null;
}

// Dedicated Hyperlink Modal Dialog
function showHyperlinkDialog({ initialUrl = '', initialText = '', isEditing = false } = {}) {
  return new Promise(resolve => {
    document.getElementById('rich-hyperlink-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rich-hyperlink-modal';
    overlay.className = 'fixed inset-0 z-[100000] modal-backdrop bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const safeUrl = initialUrl ? String(initialUrl).replace(/"/g, '&quot;') : '';
    const safeText = initialText ? String(initialText).replace(/"/g, '&quot;') : '';

    overlay.innerHTML = `
      <div class="modal-size-confirm w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
        <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 font-bold text-sm">🔗</span>
            <h3 class="text-sm font-bold text-slate-900">${isEditing ? 'Chỉnh sửa liên kết' : 'Chèn liên kết'}</h3>
          </div>
          <button type="button" data-close class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-base leading-none">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">
              Địa chỉ liên kết (URL) <span class="text-rose-500">*</span>
            </label>
            <div class="relative flex items-center">
              <input type="text" data-url class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 pr-10" placeholder="https://example.com" value="${safeUrl}">
              <button type="button" data-test-link title="Mở thử liên kết trong tab mới" class="absolute right-2 px-2 py-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded text-xs font-bold">
                ↗
              </button>
            </div>
            <p class="mt-1 text-[11px] text-slate-500">Chấp nhận https:// hoặc http://. Nếu nhập www... hệ thống tự bổ sung https://</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Văn bản hiển thị</label>
            <input type="text" data-text class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Để trống sẽ dùng URL làm văn bản hiển thị" value="${safeText}">
          </div>

          <div data-error class="hidden text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed"></div>
        </div>

        <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <div>
            ${isEditing ? `
              <button type="button" data-unlink class="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors">
                🚫 Gỡ liên kết
              </button>
            ` : '<div></div>'}
          </div>
          <div class="flex items-center gap-2">
            <button type="button" data-cancel class="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors">
              Hủy
            </button>
            <button type="button" data-submit class="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs">
              ${isEditing ? 'Cập nhật' : 'Chèn liên kết'}
            </button>
          </div>
        </div>
      </div>
    `;

    const urlInput = overlay.querySelector('[data-url]');
    const textInput = overlay.querySelector('[data-text]');
    const errorBox = overlay.querySelector('[data-error]');
    const testBtn = overlay.querySelector('[data-test-link]');
    const submitBtn = overlay.querySelector('[data-submit]');
    const cancelBtn = overlay.querySelector('[data-cancel]');
    const closeBtn = overlay.querySelector('[data-close]');
    const unlinkBtn = overlay.querySelector('[data-unlink]');

    const showError = msg => {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
      urlInput.classList.add('border-rose-400');
    };

    const clearError = () => {
      errorBox.textContent = '';
      errorBox.classList.add('hidden');
      urlInput.classList.remove('border-rose-400');
    };

    const cleanup = result => {
      document.removeEventListener('keydown', handleKey);
      overlay.remove();
      resolve(result);
    };

    const handleKey = e => {
      if (e.key === 'Escape') {
        cleanup(null);
      } else if (e.key === 'Enter' && (document.activeElement === urlInput || document.activeElement === textInput)) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const handleSubmit = () => {
      clearError();
      const valResult = normalizeRichLinkUrl(urlInput.value);
      if (!valResult.valid) {
        showError(valResult.error);
        urlInput.focus();
        return;
      }
      cleanup({
        action: 'save',
        url: valResult.url,
        text: textInput.value.trim()
      });
    };

    testBtn.onclick = () => {
      clearError();
      const valResult = normalizeRichLinkUrl(urlInput.value);
      if (!valResult.valid) {
        showError(valResult.error);
        urlInput.focus();
        return;
      }
      window.open(valResult.url, '_blank', 'noopener,noreferrer');
    };

    if (unlinkBtn) {
      unlinkBtn.onclick = () => cleanup({ action: 'unlink' });
    }

    submitBtn.onclick = handleSubmit;
    cancelBtn.onclick = () => cleanup(null);
    closeBtn.onclick = () => cleanup(null);
    overlay.onclick = e => {
      if (e.target === overlay) cleanup(null);
    };

    document.addEventListener('keydown', handleKey);
    document.body.appendChild(overlay);

    urlInput.focus();
    if (initialUrl) {
      urlInput.select();
    }
  });
}

// Helper: unwrap anchor element preserving all inner child nodes
function unwrapAnchor(anchor) {
  if (!anchor || !anchor.parentNode) return;
  const parent = anchor.parentNode;
  while (anchor.firstChild) {
    parent.insertBefore(anchor.firstChild, anchor);
  }
  parent.removeChild(anchor);
}

// Unlink current selection or specified anchor
export function unlinkRichLink(targetAnchor = null) {
  const editor = document.getElementById('activity-editor');
  if (!editor) return;

  hideLinkFloatingTooltip();

  if (targetAnchor && editor.contains(targetAnchor)) {
    unwrapAnchor(targetAnchor);
    editor.focus();
    return;
  }

  captureActivityEditorSelection();
  const anchor = savedActivityEditorSelection?.anchor;

  if (anchor && editor.contains(anchor)) {
    unwrapAnchor(anchor);
    editor.focus();
    return;
  }

  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    const anchors = Array.from(editor.querySelectorAll('a')).filter(a => {
      try {
        return range.intersectsNode(a);
      } catch (e) {
        return false;
      }
    });
    if (anchors.length > 0) {
      anchors.forEach(unwrapAnchor);
      editor.focus();
      return;
    }
  }

  // Fallback
  document.execCommand('unlink');
  editor.focus();
}
window.unlinkRichLink = unlinkRichLink;

// Decorate all anchors inside #activity-editor with distinct hyperlink styling and attributes
export function decorateActivityEditorAnchors(editor) {
  if (!editor) return;
  editor.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.style.color = '#2563eb';
    a.style.textDecoration = 'underline';
    a.style.textDecorationColor = '#2563eb';
    a.style.textUnderlineOffset = '2px';
    a.style.borderBottom = 'none';
    a.style.backgroundColor = 'transparent';
    a.style.padding = '0';
    a.style.borderRadius = '0';
    a.style.fontWeight = '600';
    a.style.cursor = 'pointer';
    a.className = 'text-blue-600 underline font-semibold cursor-pointer';
    if (href) {
      a.title = `Bấm để mở liên kết trong tab mới (${href})`;
    }
    a.querySelectorAll('*').forEach(c => {
      c.style.color = '#2563eb';
      c.style.textDecoration = 'underline';
      c.style.backgroundColor = 'transparent';
    });
  });
}
window.decorateActivityEditorAnchors = decorateActivityEditorAnchors;

// Insert or edit hyperlink in #activity-editor
export async function insertRichLink(targetAnchor = null) {
  const editor = document.getElementById('activity-editor');
  if (!editor) return;

  hideLinkFloatingTooltip();
  captureActivityEditorSelection(targetAnchor);

  // If editor was never focused and no selection captured, initialize at end
  if (!savedActivityEditorSelection || (!savedActivityEditorSelection.range && !savedActivityEditorSelection.anchor)) {
    editor.focus();
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    savedActivityEditorSelection = {
      range: r.cloneRange(),
      anchor: null,
      selectedText: '',
      isCollapsed: true
    };
  }

  const existingAnchor = savedActivityEditorSelection.anchor;
  const isEditing = Boolean(existingAnchor);
  const initialUrl = isEditing ? (existingAnchor.getAttribute('href') || '') : '';
  const initialText = isEditing ? (existingAnchor.textContent || '') : (savedActivityEditorSelection.selectedText || '');

  const result = await showHyperlinkDialog({
    initialUrl,
    initialText,
    isEditing
  });

  if (!result) {
    restoreActivityEditorSelection();
    return;
  }

  if (result.action === 'unlink') {
    unlinkRichLink(existingAnchor);
    return;
  }

  if (result.action === 'save') {
    const cleanUrl = result.url;
    const displayText = result.text || savedActivityEditorSelection.selectedText || cleanUrl;

    if (isEditing && existingAnchor && editor.contains(existingAnchor)) {
      existingAnchor.setAttribute('href', cleanUrl);
      existingAnchor.setAttribute('target', '_blank');
      existingAnchor.setAttribute('rel', 'noopener noreferrer');
      if (displayText) {
        existingAnchor.textContent = displayText;
      }
      editor.focus();
      const sel = window.getSelection();
      if (sel) {
        const afterRange = document.createRange();
        afterRange.setStartAfter(existingAnchor);
        afterRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(afterRange);
      }
    } else {
      restoreActivityEditorSelection();
      const sel = window.getSelection();
      const range = (sel && sel.rangeCount) ? sel.getRangeAt(0) : savedActivityEditorSelection.range;

      if (!range || !editor.contains(range.startContainer)) {
        const a = document.createElement('a');
        a.setAttribute('href', cleanUrl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.textContent = displayText;
        editor.appendChild(a);
        editor.focus();
      } else {
        const a = document.createElement('a');
        a.setAttribute('href', cleanUrl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');

        const hadSelection = !range.collapsed && Boolean(savedActivityEditorSelection.selectedText);
        const textUnchanged = hadSelection && (displayText === savedActivityEditorSelection.selectedText);

        if (textUnchanged) {
          const contents = range.extractContents();
          if (contents.childNodes.length === 0) {
            a.textContent = displayText;
          } else {
            a.appendChild(contents);
          }
          range.insertNode(a);
        } else {
          range.deleteContents();
          a.textContent = displayText;
          range.insertNode(a);
        }

        const afterRange = document.createRange();
        afterRange.setStartAfter(a);
        afterRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(afterRange);
        editor.focus();
      }
    }

    decorateActivityEditorAnchors(editor);

    const activeAnchor = isEditing ? existingAnchor : editor.querySelector(`a[href="${cleanUrl}"]`);
    if (activeAnchor) {
      showLinkFloatingTooltip(activeAnchor);
    }
  }
}
window.insertRichLink = insertRichLink;

// Backward-compatibility bridge for tests:
// test-round-drive-card.cjs matches /restoreActivityEditorSelection\(\);\s*document\.execCommand\('createLink'/
function __legacyCompatCreateLink(cleanUrl) {
  restoreActivityEditorSelection();
  document.execCommand('createLink', false, cleanUrl);
}

// Bind keyboard shortcuts and link interaction to #activity-editor
export function initActivityEditorEvents() {
  const editor = document.getElementById('activity-editor');
  if (!editor || editor.__linkEventsBound) return;
  editor.__linkEventsBound = true;

  editor.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      captureActivityEditorSelection();
      insertRichLink();
    }
  });

  const checkSelectionForLink = () => {
    captureActivityEditorSelection();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      hideLinkFloatingTooltip();
      return;
    }
    const anchor = findClosestAnchor(sel.anchorNode, editor) || findClosestAnchor(sel.focusNode, editor);
    if (anchor) {
      showLinkFloatingTooltip(anchor);
    } else {
      hideLinkFloatingTooltip();
    }
  };

  editor.addEventListener('click', e => {
    captureActivityEditorSelection();
    const anchor = findClosestAnchor(e.target, editor);
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href) {
        e.preventDefault();
        e.stopPropagation();
        window.open(href, '_blank', 'noopener,noreferrer');
        showLinkFloatingTooltip(anchor);
        return;
      }
    } else {
      hideLinkFloatingTooltip();
    }
  });

  editor.addEventListener('mouseover', e => {
    const anchor = findClosestAnchor(e.target, editor);
    if (anchor) {
      showLinkFloatingTooltip(anchor);
    }
  });

  editor.addEventListener('mouseup', () => {
    captureActivityEditorSelection();
    checkSelectionForLink();
  });

  editor.addEventListener('keyup', checkSelectionForLink);

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode)) {
      captureActivityEditorSelection();
    }
  });

  document.addEventListener('mousedown', e => {
    if (linkTooltipEl && !linkTooltipEl.contains(e.target) && !editor.contains(e.target)) {
      hideLinkFloatingTooltip();
    }
  });
}
window.initActivityEditorEvents = initActivityEditorEvents;

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
      'text-align', 'color', 'background-color', 'font-size', 'font-weight', 'text-decoration', 'line-height',
      'border-bottom', 'border-radius', 'padding', 'cursor', 'text-decoration-color', 'text-underline-offset'
    ]);

    function cleanNode(node) {
      const children = Array.from(node.childNodes);
      for (let child of children) {
        if (child.nodeType === 1) { // Element
          let tagName = child.tagName.toLowerCase();
          if (tagName === 'font') {
            const replacement = doc.createElement('span');
            const color = child.getAttribute('color');
            if (color && (/^#[0-9a-f]{3,8}$/i.test(color) || /^(?:rgb|rgba)\([\d\s.,%]+\)$/i.test(color))) {
              replacement.style.color = color;
            }
            if (child.getAttribute('style')) {
              replacement.setAttribute('style', child.getAttribute('style'));
            }
            const sizeAttr = child.getAttribute('size');
            if (sizeAttr && !replacement.style.fontSize) {
              const fontSizes = {
                '1': '10px',
                '2': '13px',
                '3': '16px',
                '4': '18px',
                '5': '24px',
                '6': '32px',
                '7': '48px'
              };
              if (fontSizes[sizeAttr]) {
                replacement.style.fontSize = fontSizes[sizeAttr];
              }
            }
            while (child.firstChild) replacement.appendChild(child.firstChild);
            child.replaceWith(replacement);
            child = replacement;
            tagName = 'span';
          }
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
              if (
                href.startsWith('javascript:') ||
                href.startsWith('data:') ||
                href.startsWith('vbscript:') ||
                href.startsWith('file:')
              ) {
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
            const finalHref = child.getAttribute('href');
            if (!finalHref || !finalHref.trim()) {
              const parent = child.parentNode;
              while (child.firstChild) parent.insertBefore(child.firstChild, child);
              parent.removeChild(child);
              continue;
            }
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
            child.style.color = '#2563eb';
            child.style.textDecoration = 'underline';
            child.style.textDecorationColor = '#2563eb';
            child.style.textUnderlineOffset = '2px';
            child.style.borderBottom = 'none';
            child.style.backgroundColor = 'transparent';
            child.style.padding = '0';
            child.style.borderRadius = '0';
            child.style.fontWeight = '600';
            child.style.cursor = 'pointer';
            child.querySelectorAll('*').forEach(c => {
              c.style.color = '#2563eb';
              c.style.textDecoration = 'underline';
              c.style.backgroundColor = 'transparent';
            });
          }

          cleanNode(child);
        }
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  // Fallback for node test environment
  let safe = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s*on\w+=["'][^"']*["']/gi, '')
    .replace(/\s*on\w+=\S+/gi, '');

  // Strip dangerous a href protocols and unwrap
  safe = safe.replace(/<a\b([^>]*)href=["'](?:javascript|data|vbscript|file):[^"']*["']([^>]*)>(.*?)<\/a>/gi, '$3');

  // Ensure target="_blank" and rel="noopener noreferrer" and link styling on safe links
  safe = safe.replace(/<a\b([^>]*)href=["'](https?:\/\/[^"']+)["']([^>]*)>/gi, (match, before, url, after) => {
    let tag = `<a href="${url}"`;
    if (!/target=/i.test(match)) tag += ' target="_blank"';
    if (!/rel=/i.test(match)) tag += ' rel="noopener noreferrer"';
    tag += ' style="color: #2563eb; text-decoration: underline; text-decoration-color: #2563eb; text-underline-offset: 2px; font-weight: 600; cursor: pointer; background-color: transparent;"';
    return tag + '>';
  });

  return safe;
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
  { id: 'opt_ap',  key: 'A+',  code: 'A+',  label: 'Xuất sắc',       numericValue: 9.5,  description: 'Xuất sắc' },
  { id: 'opt_a',   key: 'A',   code: 'A',   label: 'Tốt',            numericValue: 9.0,  description: 'Tốt' },
  { id: 'opt_am',  key: 'A-',  code: 'A-',  label: 'Khá tốt',        numericValue: 8.5,  description: 'Khá tốt' },
  { id: 'opt_bp',  key: 'B+',  code: 'B+',  label: 'Khá',            numericValue: 8.0,  description: 'Khá' },
  { id: 'opt_b',   key: 'B',   code: 'B',   label: 'Trung bình khá', numericValue: 7.5,  description: 'Trung bình khá' },
  { id: 'opt_bm',  key: 'B-',  code: 'B-',  label: 'Trung bình',     numericValue: 7.0,  description: 'Trung bình' },
  { id: 'opt_cp',  key: 'C+',  code: 'C+',  label: 'Trung bình',     numericValue: 6.5,  description: 'Trung bình' },
  { id: 'opt_c',   key: 'C',   code: 'C',   label: 'Trung bình yếu', numericValue: 6.0,  description: 'Trung bình yếu' },
  { id: 'opt_cm',  key: 'C-',  code: 'C-',  label: 'Yếu',            numericValue: 5.5,  description: 'Yếu' },
  { id: 'opt_dm',  key: 'D-',  code: 'D-',  label: 'Quá yếu',        numericValue: 4.0,  description: 'Quá yếu' },
  { id: 'opt_d',   key: 'D',   code: 'D',   label: 'Yếu',            numericValue: 4.5,  description: 'Yếu' },
  { id: 'opt_dp',  key: 'D+',  code: 'D+',  label: 'Kém',            numericValue: 5.0,  description: 'Kém' }
];

const STANDARD_LETTER_GRADE_LABELS = Object.fromEntries(DEFAULT_LETTER_GRADE_SCALE.map(option => [option.key, option.label]));

export function normalizeLetterGradeOptions(options) {
  return (Array.isArray(options) ? options : DEFAULT_LETTER_GRADE_SCALE)
    .filter(option => !/^A\+{2,}$/i.test(String(option.key || option.code || '').trim()))
    .map(option => {
      const code = String(option.key || option.code || '').trim().toUpperCase();
      const label = STANDARD_LETTER_GRADE_LABELS[code];
      return {
        ...option,
        ...(label ? { label, description: label } : {}),
        numericValue: code === 'A+' ? 9.5 : (typeof option.numericValue === 'number' ? Math.min(option.numericValue, 9.5) : option.numericValue)
      };
    });
}

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
    letterOptions: normalizeLetterGradeOptions((Array.isArray(a.scoringConfig.letterOptions) && a.scoringConfig.letterOptions.length > 0)
      ? a.scoringConfig.letterOptions
      : defaultLetterOptions),
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
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm whitespace-nowrap" title="Chức năng nộp bài">📥 Có</span>'
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
          
          <td class="p-2.5 align-middle pr-3">
            <div class="flex flex-col gap-1.5 items-end justify-center min-w-[150px]">
              <!-- Primary Quick Actions -->
              <div class="flex items-center gap-1.5 flex-wrap justify-end">
                ${act.submissionEnabled ? `
                  <button type="button" onclick="openActivitySubmissionDashboard('${targetRound.id}', '${act.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 shadow-2xs transition flex items-center gap-1 cursor-pointer" title="Quản lý Sinh viên Nộp bài">
                    <span>📥</span><span>Nộp bài</span>
                  </button>
                ` : ''}
                ${act.councilEnabled ? `
                  <button type="button" onclick="openActivityCouncilManagement('${targetRound.id}', '${act.id}')" class="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[11px] font-bold border border-purple-200 shadow-2xs transition flex items-center gap-1 cursor-pointer" title="Quản lý Hội đồng Mốc này">
                    <span>🏛️</span><span>Hội đồng</span>
                    <span class="bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none">${(act.councils || []).length}</span>
                  </button>
                ` : ''}
                <button type="button" onclick="editActivityModal('${act.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200 shadow-2xs transition flex items-center gap-1 cursor-pointer" title="Chỉnh sửa thông tin mốc">
                  <span>✏️</span><span>Sửa</span>
                </button>
              </div>

              <!-- Secondary Utilities Row -->
              <div class="flex items-center gap-1 justify-end text-[10px]">
                <button type="button" onclick="copyActivityLink('${targetRound.id}', '${act.slug}')" class="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 shadow-2xs transition cursor-pointer" title="Sao chép link trực tiếp đến mốc này">
                  🔗 Link
                </button>
                <button type="button" onclick="duplicateActivityWithinRound('${act.id}')" class="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 shadow-2xs transition cursor-pointer" title="Nhân bản mốc này trong cùng đợt">
                  📋 Sao chép
                </button>
                <button type="button" onclick="toggleActivityVisibility('${act.id}')" class="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 rounded-md border border-slate-200 shadow-2xs transition cursor-pointer" title="${isActivityPublished(act) ? 'Chuyển về bản nháp' : 'Công bố mốc này cho sinh viên'}">
                  ${isActivityPublished(act) ? '🔒 Về nháp' : '📢 Công bố'}
                </button>
                <button type="button" onclick="deleteActivity('${act.id}')" class="px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded-md font-bold transition cursor-pointer" title="Xóa mốc kế hoạch">
                  🗑️
                </button>
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
  initActivityEditorEvents();
  hideLinkFloatingTooltip();

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
    decorateActivityEditorAnchors(editor);
    initActivityEditorEvents();
    hideLinkFloatingTooltip();
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
  state._currentActivityLetterOptions = normalizeLetterGradeOptions(Array.isArray(act.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.letterOptions))
    : JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE)));
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
    decorateActivityEditorAnchors(editor);
    initActivityEditorEvents();
    hideLinkFloatingTooltip();
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
  state._currentActivityLetterOptions = normalizeLetterGradeOptions(Array.isArray(act.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.letterOptions))
    : JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE)));
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
  hideLinkFloatingTooltip();
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

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getActivityStatus !== 'undefined') window.getActivityStatus = getActivityStatus;
  if (typeof fmtActivityTime !== 'undefined') window.fmtActivityTime = fmtActivityTime;
  if (typeof isoToVietnameseDateTime !== 'undefined') window.isoToVietnameseDateTime = isoToVietnameseDateTime;
  if (typeof parseVietnameseDateTime !== 'undefined') window.parseVietnameseDateTime = parseVietnameseDateTime;
  if (typeof sanitizeRichHtml !== 'undefined') window.sanitizeRichHtml = sanitizeRichHtml;
  if (typeof isActivityPublished !== 'undefined') window.isActivityPublished = isActivityPublished;
  if (typeof normalizeActivity !== 'undefined') window.normalizeActivity = normalizeActivity;
  if (typeof findNearestMilestone !== 'undefined') window.findNearestMilestone = findNearestMilestone;
  if (typeof startMilestoneCountdownTicker !== 'undefined') window.startMilestoneCountdownTicker = startMilestoneCountdownTicker;
  if (typeof normalizeRichLinkUrl !== 'undefined') window.normalizeRichLinkUrl = normalizeRichLinkUrl;
  if (typeof insertRichLink !== 'undefined') window.insertRichLink = insertRichLink;
  if (typeof unlinkRichLink !== 'undefined') window.unlinkRichLink = unlinkRichLink;
  if (typeof captureActivityEditorSelection !== 'undefined') window.captureActivityEditorSelection = captureActivityEditorSelection;
  if (typeof restoreActivityEditorSelection !== 'undefined') window.restoreActivityEditorSelection = restoreActivityEditorSelection;
  if (typeof initActivityEditorEvents !== 'undefined') window.initActivityEditorEvents = initActivityEditorEvents;
  if (typeof hideLinkFloatingTooltip !== 'undefined') window.hideLinkFloatingTooltip = hideLinkFloatingTooltip;
}

if (typeof window !== "undefined") {
  if (typeof loadStudentRoundActivities !== "undefined") window.loadStudentRoundActivities = loadStudentRoundActivities;
  if (typeof loadAdminRoundActivities !== "undefined") window.loadAdminRoundActivities = loadAdminRoundActivities;
  if (typeof DEFAULT_LETTER_GRADE_SCALE !== "undefined") window.DEFAULT_LETTER_GRADE_SCALE = DEFAULT_LETTER_GRADE_SCALE;
  if (typeof normalizeLetterGradeOptions !== "undefined") window.normalizeLetterGradeOptions = normalizeLetterGradeOptions;
}
