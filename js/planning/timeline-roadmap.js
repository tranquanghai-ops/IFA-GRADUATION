
const renderTimelineWeekDays = (...args) => (typeof window !== 'undefined' && window.renderTimelineWeekDays ? window.renderTimelineWeekDays(...args) : '');
const renderTimelineWeekEvents = (...args) => (typeof window !== 'undefined' && window.renderTimelineWeekEvents ? window.renderTimelineWeekEvents(...args) : '');
const getRoundTimelineWeeksWithActivities = (...args) => (typeof window !== 'undefined' && window.getRoundTimelineWeeksWithActivities ? window.getRoundTimelineWeeksWithActivities(...args) : []);
const getRoundWeekSchedule = (...args) => (typeof window !== 'undefined' && window.getRoundWeekSchedule ? window.getRoundWeekSchedule(...args) : []);
const rememberRoundTimelineEvents = (...args) => (typeof window !== 'undefined' && window.rememberRoundTimelineEvents ? window.rememberRoundTimelineEvents(...args) : undefined);

const resolveRoundWeekTitle = (w, t) => (typeof window !== 'undefined' && window.resolveRoundWeekTitle ? window.resolveRoundWeekTitle(w, t) : (t || ('Tuần ' + w)));
const getRoundTimelineDefaultTitle = (w) => (typeof window !== 'undefined' && window.getRoundTimelineDefaultTitle ? window.getRoundTimelineDefaultTitle(w) : ('Tuần ' + w));

// --- Module Bridges ---
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);
/**
 * IFA+ Graduation — Unified Timeline & Weekly Roadmap Submodule
 */
import { sanitizeRichHtml, fmtActivityTime, normalizeActivity, isActivityPublished, getActivityStatus, formatCountdownText } from './activities-manager.js';
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

let milestoneCountdownInterval = null;

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

  const locationRaw = String(act.location || 'Ngành thông báo sau').trim();
  const locationText = locationRaw.toLowerCase().startsWith('địa điểm') ? locationRaw : `Địa điểm: ${locationRaw}`;

  const pfx = prefix ? `${prefix}-` : '';
  const headerAttrs = `id="milestone-header-${pfx}${act.id}" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" aria-controls="milestone-body-${pfx}${act.id}" onclick="toggleUnifiedMilestoneCard('${roundId}', '${act.id}', '${prefix}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleUnifiedMilestoneCard('${roundId}', '${act.id}', '${prefix}');}"`;

  return `
    <div id="activity-card-${pfx}${act.slug || act.id}" data-activity-id="${act.id}" class="p-4 rounded-2xl border ${cardBorder} transition-all duration-300 relative">
      <div class="w-full">
        <div ${headerAttrs} class="cursor-pointer select-none rounded-xl -mx-1 px-1 py-0.5 hover:bg-slate-900/[.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-tdtu-blue">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div class="flex flex-wrap items-center gap-1.5">
              ${statusPill}
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeMeta.color}">
                <span>${typeMeta.icon}</span> ${typeMeta.label}
              </span>
              ${act.isTentative ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">🟡 Dự kiến</span>' : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">Chính thức</span>'}
              ${countdownBadge}
            </div>
            <div class="flex items-center gap-1.5">
              <span id="milestone-toggle-btn-${pfx}${act.id}" class="text-[11px] font-bold text-slate-500 hover:text-tdtu-blue flex items-center gap-1 transition-colors shrink-0" aria-hidden="true">
                <span>${expanded ? '▲ Thu gọn' : '▼ Xem chi tiết'}</span>
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2.5 mt-1">
            <div class="hidden sm:flex shrink-0">${markerHtml}</div>
            <h3 class="text-sm sm:text-base font-black text-slate-900 tracking-tight">${escapeHtml(act.title)}</h3>
          </div>

          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-700 mt-2.5 font-medium">
            <div class="flex items-center gap-1.5 font-mono text-xs sm:text-sm text-slate-800">
              <span class="shrink-0 text-sm">🕒</span> <span class="text-slate-500 font-sans font-normal whitespace-nowrap">${act.isTentative ? 'Dự kiến:' : 'Chính thức:'}</span> <span class="font-bold text-slate-900">${timeStr}</span>
            </div>
            ${!expanded ? `
              <div class="flex items-center gap-1.5 text-xs sm:text-sm text-slate-700">
                <span class="shrink-0 text-sm">📍</span> <span class="font-medium text-slate-800">${escapeHtml(locationText)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div id="milestone-body-${pfx}${act.id}" class="${expanded ? '' : 'hidden'}">
          <div class="flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 mt-2">
            <span class="shrink-0 text-sm">📍</span> <span class="font-medium text-slate-800">${escapeHtml(locationText)}</span>
          </div>

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

// ============================================================================
// UNIFIED TIMELINE & PLAN RENDERING (ADMIN / SUPERVISOR / STUDENT SHARED)
// ============================================================================

export function renderUnifiedTimelineWeekCard(week, round, options = {}) {
  const role = options.role || (state.currentRole || 'student');
  const isAdmin = role === 'admin' || Boolean(options.isAdmin);
  const canEdit = options.canEdit !== undefined ? options.canEdit : isAdmin;
  const canToggleVisibility = options.canToggleVisibility !== undefined ? options.canToggleVisibility : isAdmin;
  const roundId = round?.id || state.selectedRoundId || '';

  const statusStyles = {
    completed: { card: 'bg-emerald-50 border-emerald-300', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Đã qua' },
    ongoing: { card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-200', badge: 'bg-blue-600 text-white border-blue-600', label: 'Đang diễn ra' },
    upcoming: { card: 'bg-slate-50 border-slate-200', badge: 'bg-white text-slate-500 border-slate-200', label: 'Chưa tới' }
  };

  const isReviewWeek = Boolean(week.milestone && String(week.milestone).trim().length > 0) ||
    Boolean(week.events && week.events.some(e => String(e.title || '').toLowerCase().includes('duyệt')));

  const style = statusStyles[week.status] || statusStyles.upcoming;
  const cardTheme = isReviewWeek
    ? 'bg-gradient-to-b from-amber-50 to-orange-50/80 border-2 border-amber-400 shadow-sm ring-1 ring-amber-300/40 text-slate-900'
    : style.card;

  const resolvedTitle = (typeof resolveRoundWeekTitle === 'function')
    ? resolveRoundWeekTitle(week.week, week.title)
    : (week.title || `Tuần ${week.week}`);

  const isCurrent = week.status === 'ongoing';
  const onClickAttr = canEdit
    ? ` role="button" tabindex="0" data-current-week="${isCurrent ? 'true' : 'false'}" onclick="openRoundWeekEditor('${roundId}', ${week.week})" class="ifa-timeline-card relative min-w-[320px] sm:min-w-[335px] rounded-2xl border p-3 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition ${cardTheme} ${week.visible ? '' : 'opacity-55 border-dashed grayscale'}"`
    : ` data-current-week="${isCurrent ? 'true' : 'false'}" class="ifa-timeline-card relative min-w-[320px] sm:min-w-[335px] rounded-2xl border p-3 flex flex-col items-center text-center transition ${cardTheme} ${week.visible ? '' : 'opacity-55 border-dashed grayscale'}"`;

  const visibilityButton = canToggleVisibility
    ? `<button type="button" onclick="toggleRoundTimelineWeekVisibility('${roundId}', ${week.week}, event)" class="px-1.5 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[9px] font-bold shadow-xs transition cursor-pointer ${week.visible ? 'text-slate-600 hover:text-slate-900' : 'text-blue-700 hover:text-blue-900'}">${week.visible ? 'Ẩn' : 'Hiện'}</button>`
    : '';

  const daysHtml = (typeof renderTimelineWeekDays === 'function')
    ? renderTimelineWeekDays(week.days, week.events, week.week, roundId)
    : '';

  const eventsHtml = (typeof renderTimelineWeekEvents === 'function')
    ? renderTimelineWeekEvents(week.events, week.week, roundId)
    : '';

  return `
    <div${onClickAttr}>
      <div class="flex items-center justify-between gap-1.5 w-full mb-1.5">
        <span class="font-black text-sm ${isReviewWeek ? 'text-amber-950 font-black' : 'text-slate-900'} whitespace-nowrap">${escapeHtml(resolvedTitle)}</span>
        <span class="font-mono font-bold text-[11px] ${isReviewWeek ? 'text-amber-900' : 'text-slate-600'} whitespace-nowrap">${week.dateText || ''}</span>
        <div class="flex items-center gap-1 shrink-0">
          <span class="px-2 py-0.5 rounded-full border text-[9px] font-bold ${isReviewWeek && week.visible ? 'bg-amber-100/90 text-amber-900 border-amber-300' : (week.visible ? style.badge : 'bg-slate-200 text-slate-600 border-slate-300')}">${week.visible ? style.label : 'Đang ẩn'}</span>
          ${visibilityButton}
        </div>
      </div>
      ${daysHtml}
      ${eventsHtml}
      ${week.note ? `<span class="text-[9px] text-slate-500 mt-1 line-clamp-1">${escapeHtml(week.note)}</span>` : ''}
    </div>`;
}

export function scrollTimelineToCurrentWeek() {
  if (typeof window === 'undefined') return;
  setTimeout(() => {
    const currentWeekEl = document.querySelector('[data-current-week="true"]');
    if (currentWeekEl) {
      const scrollContainer = currentWeekEl.closest('.overflow-x-auto');
      if (scrollContainer) {
        const targetScrollLeft = currentWeekEl.offsetLeft - scrollContainer.offsetLeft;
        scrollContainer.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
      }
    }
  }, 100);
}

export function renderUnifiedRoundTimeline(round, options = {}) {
  if (!round) return '';
  const role = options.role || (state.currentRole || 'student');
  const isAdmin = role === 'admin' || Boolean(options.isAdmin);

  const allWeeks = (typeof getRoundTimelineWeeksWithActivities === 'function')
    ? getRoundTimelineWeeksWithActivities(round, !isAdmin)
    : [];

  if (typeof rememberRoundTimelineEvents === 'function') {
    rememberRoundTimelineEvents(round.id, allWeeks);
  }

  const weeks = isAdmin ? allWeeks : allWeeks.filter(w => w.visible);
  if (!weeks.length && !isAdmin) return '';

  const visibleWeeks = allWeeks.filter(w => w.visible).length;
  const hiddenWeeks = allWeeks.length - visibleWeeks;
  const current = allWeeks.find(week => week.status === 'ongoing');
  const completed = allWeeks.filter(week => week.status === 'completed').length;
  const currentTitle = current && typeof resolveRoundWeekTitle === 'function' ? resolveRoundWeekTitle(current.week, current.title) : null;

  const introCards = [
    { icon: '📝', title: 'Đăng ký đề tài', subtitle: 'Đề tài ĐATN' },
    { icon: '👨‍🏫', title: 'Phân công GVHD', subtitle: (typeof isDirectSupervisorAssignment === 'function' && isDirectSupervisorAssignment(round)) ? 'Khoa phân công' : 'Xét nguyện vọng' }
  ].map(card => {
    const editClick = isAdmin ? ` role="button" tabindex="0" onclick="openRoundWeekEditor('${round.id}')" class="ifa-timeline-card min-w-[215px] rounded-2xl border border-slate-200 bg-white p-3 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:shadow-md cursor-pointer transition"` : ` class="ifa-timeline-card min-w-[215px] rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center justify-center text-center"`;
    return `
      <div${editClick}>
        <span class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg mb-2">${card.icon}</span>
        <span class="font-black text-xs text-slate-900">${card.title}</span>
        <span class="text-[10px] text-slate-500 mt-1">${card.subtitle}</span>
      </div>`;
  }).join('');

  const weekCards = weeks.map(week => renderUnifiedTimelineWeekCard(week, round, {
    role,
    isAdmin,
    canEdit: isAdmin,
    canToggleVisibility: isAdmin
  })).join('');

  const hasCustomSokhao = allWeeks.some(w => w.week >= 13 && typeof resolveRoundWeekTitle === 'function' && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('sơ khảo')) || allWeeks.length >= 13;
  const hasCustomBaove = allWeeks.some(w => w.week >= 14 && typeof resolveRoundWeekTitle === 'function' && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('bảo vệ')) || allWeeks.length >= 14;
  const hasCustomKetqua = allWeeks.some(w => w.week >= 15 && typeof resolveRoundWeekTitle === 'function' && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('kết quả')) || allWeeks.length >= 15;

  const stageCard = (icon, title, note) => `<div class="ifa-timeline-card min-w-[215px] rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center justify-center text-center"><span class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg mb-2">${icon}</span><span class="font-black text-xs text-slate-900">${title}</span><span class="text-[10px] text-slate-500 mt-1">${note}</span></div>`;

  const outroCards = (!isAdmin) ? `${!hasCustomSokhao ? stageCard('📄', 'Nộp Sơ khảo', 'Sau giai đoạn thực hiện') : ''}${!hasCustomBaove ? stageCard('🎓', 'Bảo vệ Tốt nghiệp', 'Theo lịch của Khoa') : ''}${!hasCustomKetqua ? stageCard('🏆', 'Kết quả', 'Sau bảo vệ tốt nghiệp') : ''}` : '';

  const headerRight = isAdmin
    ? `<div class="flex items-center gap-2">
        <button type="button" onclick="openRoundWeekEditor('${round.id}')" class="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition cursor-pointer">＋ Thêm / sửa mốc</button>
      </div>`
    : `<span class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">${current ? `Đang diễn ra: ${escapeHtml(currentTitle)}` : `Đã qua ${completed}/${allWeeks.length} tuần`}</span>`;

  scrollTimelineToCurrentWeek();

  return `
    <section class="px-4 py-3.5 bg-white border-b border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">🗓️</span>
          <div>
            <div class="font-black text-sm text-slate-900">Lộ trình đồ án tốt nghiệp & tiến độ thực hiện</div>
            <div class="text-[10px] text-slate-500">Kế hoạch ${allWeeks.length} tuần · ${visibleWeeks} tuần hiển thị${hiddenWeeks ? ` · ${hiddenWeeks} tuần đang ẩn` : ''}</div>
          </div>
        </div>
        ${headerRight}
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2 snap-x">${introCards}${weekCards}${outroCards}</div>
    </section>`;
}

export function renderUnifiedPlanList(round, options = {}) {
  const role = options.role || (state.currentRole || 'supervisor');
  const isStudent = role === 'student';
  const prefix = options.prefix || (isStudent ? 'stu' : 'sup');
  const container = options.container || (typeof options.containerId === 'string' ? document.getElementById(options.containerId) : null);

  const activities = (Array.isArray(round?.activities) ? round.activities : [])
    .map((activity, index) => (typeof normalizeActivity === 'function' ? normalizeActivity(activity, round.id, index) : activity))
    .filter(activity => (typeof isActivityPublished === 'function' ? isActivityPublished(activity) : true))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!activities.length) {
    const emptyHtml = '<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">Khoa chưa công bố mốc kế hoạch cho đợt này.</div>';
    if (container) container.innerHTML = emptyHtml;
    return emptyHtml;
  }

  const nearest = (typeof findNearestMilestone === 'function') ? findNearestMilestone(activities) : null;
  const html = activities.map(activity => {
    const isNearest = Boolean(nearest && nearest.act && nearest.act.id === activity.id);
    return renderUnifiedActivityCard(activity, round, {
      isStudent,
      isNearest,
      nearestType: nearest?.type || 'ongoing',
      nearestTargetMs: nearest?.targetMs || null,
      prefix
    });
  }).join('');

  if (container) {
    container.innerHTML = html;
    if (typeof startMilestoneCountdownTicker === 'function') {
      startMilestoneCountdownTicker();
    }
  }
  return html;
}

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getActivityStatus !== 'undefined') window.getActivityStatus = getActivityStatus;
  if (typeof fmtActivityTime !== 'undefined') window.fmtActivityTime = fmtActivityTime;
  if (typeof isoToVietnameseDateTime !== 'undefined') window.isoToVietnameseDateTime = isoToVietnameseDateTime;
  if (typeof parseVietnameseDateTime !== 'undefined') window.parseVietnameseDateTime = parseVietnameseDateTime;
  if (typeof sanitizeRichHtml !== 'undefined') window.sanitizeRichHtml = sanitizeRichHtml;
  if (typeof cleanNode !== 'undefined') window.cleanNode = cleanNode;
  if (typeof generateUniqueSlug !== 'undefined') window.generateUniqueSlug = generateUniqueSlug;
  if (typeof isActivityPublished !== 'undefined') window.isActivityPublished = isActivityPublished;
  if (typeof normalizeActivity !== 'undefined') window.normalizeActivity = normalizeActivity;
  if (typeof formatCountdownText !== 'undefined') window.formatCountdownText = formatCountdownText;
  if (typeof findNearestMilestone !== 'undefined') window.findNearestMilestone = findNearestMilestone;
  if (typeof startMilestoneCountdownTicker !== 'undefined') window.startMilestoneCountdownTicker = startMilestoneCountdownTicker;
  if (typeof renderUnifiedActivityCard !== 'undefined') window.renderUnifiedActivityCard = renderUnifiedActivityCard;
  if (typeof renderUnifiedTimelineWeekCard !== 'undefined') window.renderUnifiedTimelineWeekCard = renderUnifiedTimelineWeekCard;
  if (typeof renderUnifiedRoundTimeline !== 'undefined') window.renderUnifiedRoundTimeline = renderUnifiedRoundTimeline;
  if (typeof renderUnifiedPlanList !== 'undefined') window.renderUnifiedPlanList = renderUnifiedPlanList;
  if (typeof renderActivityCard !== 'undefined') window.renderActivityCard = renderActivityCard;
  if (typeof pad !== 'undefined') window.pad = pad;
  if (typeof fmtPart !== 'undefined') window.fmtPart = fmtPart;
}
