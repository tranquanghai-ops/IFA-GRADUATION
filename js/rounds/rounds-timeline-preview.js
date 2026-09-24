
const ACTIVITY_TYPES = (typeof window !== 'undefined' && window.ACTIVITY_TYPES) || {
  announcement: { label: 'Thông báo', icon: '📢', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  submission: { label: 'Nộp bài', icon: '📥', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review: { label: 'Duyệt hội đồng', icon: '📋', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  preliminary: { label: 'Sơ khảo', icon: '🔍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  thesis: { label: 'Chấm thuyết minh', icon: '📖', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  defense: { label: 'Bảo vệ', icon: '🎓', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  other: { label: 'Khác', icon: '📌', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};
const isActivityPublished = (a) => (typeof window !== 'undefined' && window.isActivityPublished ? window.isActivityPublished(a) : (a && a.visibility !== false));

const resolveRoundWeekTitle = (w, t) => (typeof window !== 'undefined' && window.resolveRoundWeekTitle ? window.resolveRoundWeekTitle(w, t) : (t || ('Tuần ' + w)));
const getRoundTimelineDefaultTitle = (w) => (typeof window !== 'undefined' && window.getRoundTimelineDefaultTitle ? window.getRoundTimelineDefaultTitle(w) : ('Tuần ' + w));

const roundWeekEventOccursOnDay = (e, d) => (typeof window !== 'undefined' && window.roundWeekEventOccursOnDay ? window.roundWeekEventOccursOnDay(e, d) : false);
const distinguishOverlappingTimelineEvents = (evs, ds) => (typeof window !== 'undefined' && window.distinguishOverlappingTimelineEvents ? window.distinguishOverlappingTimelineEvents(evs, ds) : (evs || []));
const normalizeRoundWeekEventColor = (val) => (typeof window !== 'undefined' && window.normalizeRoundWeekEventColor ? window.normalizeRoundWeekEventColor(val) : (val || '#2563eb'));

// --- Module Bridges ---
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);
const renderAdminRoundsCards = () => window.renderAdminRoundsCards?.();
/**
 * IFA+ Graduation — Rounds Timeline Preview & Calendar Events Module
 */
function getRoundWeekSchedule(round) {
  const durationWeeks = parseInt(round?.durationWeeks, 10) || 12;
  const pad = value => String(value).padStart(2, '0');
  const formatDate = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  let startMonday = null;
  const configuredStart = round?.startDate || round?.datnStartDate || round?.openAt || round?.openAtDate;
  if (configuredStart) {
    const parsed = new Date(configuredStart?.toDate ? configuredStart.toDate() : configuredStart);
    if (!isNaN(parsed.getTime())) {
      const day = parsed.getDay();
      parsed.setDate(parsed.getDate() - day + (day === 0 ? -6 : 1));
      parsed.setHours(0, 0, 0, 0);
      startMonday = parsed;
    }
  }
  if (!startMonday) startMonday = new Date();

  const now = new Date();
  const defaultMilestones = { 4: 'Duyệt đợt 1', 8: 'Duyệt đợt 2', 12: 'Duyệt đợt 3' };
  const weeklyConfig = Array.isArray(round?.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
  return Array.from({ length: durationWeeks }, (_, index) => {
    const week = index + 1;
    const start = new Date(startMonday.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
    const config = weeklyConfig.find(item => Number(item.week) === week) || {};
    const status = now > end ? 'completed' : (now >= start ? 'ongoing' : 'upcoming');
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start.getTime() + dayIndex * 86400000);
      return { dayIndex, shortName: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dayIndex], date, label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`, key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
    });
    const events = (Array.isArray(config.events) ? config.events : []).map((event, index) => ({
      id: event.id || `legacy-${week}-${index}`,
      title: String(event.title || event.name || '').trim(),
      dayIndex: Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      date: event.date || event.startDate || '',
      startDayIndex: Number.isInteger(Number(event.startDayIndex)) ? Math.max(0, Math.min(6, Number(event.startDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      endDayIndex: Number.isInteger(Number(event.endDayIndex)) ? Math.max(0, Math.min(6, Number(event.endDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || event.date || '',
      color: normalizeRoundWeekEventColor(event.color)
    })).filter(event => event.title);
    return {
      week,
      title: resolveRoundWeekTitle(week, config.title),
      note: config.note || '',
      milestone: config.milestone || (week <= 12 ? (defaultMilestones[week] || '') : ''),
      visible: config.visible !== false,
      status,
      dateText: `${formatDate(start)} – ${formatDate(end)}`,
      days,
      events
    };
  });
}

function getRoundTimelineWeeksWithActivities(round, publishedOnly = true) {
  const weeks = getRoundWeekSchedule(round);
  const pad = value => String(value).padStart(2, '0');
  const toDateKey = value => {
    if (!value) return '';
    const date = new Date(value?.toDate ? value.toDate() : value);
    return isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const activities = (Array.isArray(round?.activities) ? round.activities : [])
    .filter(activity => (!publishedOnly || isActivityPublished(activity)) && (activity.startAt || activity.endAt))
    .map(activity => {
      const first = toDateKey(activity.startAt || activity.endAt);
      const last = toDateKey(activity.endAt || activity.startAt);
      return { id: `activity-${activity.id}`, activityId: activity.id, activity,
        title: String(activity.title || '').trim(), startDate: first <= last ? first : last,
        endDate: first <= last ? last : first, color: normalizeRoundWeekEventColor(activity.color) };
    }).filter(event => event.title && event.startDate && event.endDate);
  weeks.forEach(week => {
    const first = week.days[0]?.key;
    const last = week.days[6]?.key;
    week.events = distinguishOverlappingTimelineEvents(
      [...week.events, ...activities.filter(event => event.startDate <= last && event.endDate >= first)], week.days
    );
  });
  return weeks;
}

function rememberRoundTimelineEvents(roundId, weeks) {
  if (!state.roundTimelineEventMap) state.roundTimelineEventMap = new Map();
  state.roundTimelineEventMap.set(roundId, new Map(weeks.map(week => [week.week, week.events])));
}

function renderTimelineWeekDays(days = [], events = [], weekNumber = null, roundId = null) {
  const studentCalendar = weekNumber !== null;
  return `<div class="grid grid-cols-7 ${studentCalendar ? 'gap-1.5' : 'gap-1'} w-full mt-2 pt-2 border-t border-slate-200/80">${days.map(day => {
    const dayEvents = events.filter(event => roundWeekEventOccursOnDay(event, day));
    const titles = dayEvents.map(event => escapeHtml(event.title)).join(' · ');
    const isToday = day.date instanceof Date && day.date.toDateString() === new Date().toDateString();
    const eventColors = [...new Set(dayEvents.map(event => normalizeRoundWeekEventColor(event.displayColor || event.color)))];
    const eventColor = eventColors[0] || '';
    const dayClass = dayEvents.length ? '' : (isToday ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'bg-white/70 border-slate-200 text-slate-500');
    const slices = eventColors.map((color, index) => `${color}38 ${index * 100 / eventColors.length}% ${(index + 1) * 100 / eventColors.length}%`).join(',');
    const dayStyle = eventColors.length > 1
      ? ` style="background:linear-gradient(90deg,${slices});border-color:${eventColor};color:#1e293b"`
      : (eventColor ? ` style="background-color:${eventColor}18;border-color:${eventColor};color:${eventColor}"` : '');
    const clickable = weekNumber !== null && dayEvents.length;
    const tag = clickable ? 'button' : 'span';
    const click = clickable ? ` type="button" onclick="event.stopPropagation(); openStudentTimelineDay(${weekNumber}, '${day.key}', ${roundId ? `'${escapeHtml(roundId)}'` : 'null'})" aria-label="Xem ${dayEvents.length} sự kiện ngày ${day.label}"` : '';
    return `<${tag}${click} title="${titles || `${day.shortName} ${day.label}`}" class="min-w-0 rounded-md border text-center ${studentCalendar ? 'min-h-[52px] px-1 py-1.5' : 'px-0.5 py-0.5'} ${dayClass} ${clickable ? 'cursor-pointer hover:shadow-md' : ''}"${dayStyle}><b class="block ${studentCalendar ? 'text-[11px]' : 'text-[8px]'} leading-none">${day.shortName}</b><b class="block ${studentCalendar ? 'text-[11px]' : 'text-[8px]'} leading-none mt-1">${day.label}</b>${dayEvents.length ? `<span class="flex justify-center gap-0.5">${eventColors.map(color => `<i class="${studentCalendar ? 'text-[11px]' : 'text-[8px]'} leading-none not-italic" style="color:${color}">●</i>`).join('')}</span>` : ''}</${tag}>`;
  }).join('')}</div>`;
}

function renderTimelineWeekEvents(events = [], weekNumber = null, roundId = null) {
  if (!events.length) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parseEventDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  };
  const shortDate = value => {
    const date = parseEventDate(value);
    return date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` : '';
  };
  return `<div class="mt-2 w-full space-y-1 text-left">${events.map((event, eventIndex) => {
    const color = normalizeRoundWeekEventColor(event.displayColor || event.color);
    const startValue = event.startDate || event.date || '';
    const endValue = event.endDate || startValue;
    const startDate = parseEventDate(startValue);
    const endDate = parseEventDate(endValue) || startDate;
    const dayCount = startDate ? Math.ceil((startDate - today) / 86400000) : null;
    const countdown = !startDate
      ? ''
      : (dayCount > 0 ? `Còn ${dayCount} ngày` : (endDate >= today ? (dayCount === 0 ? 'Hôm nay' : 'Đang diễn ra') : 'Đã diễn ra'));
    const dateLabel = startValue === endValue ? shortDate(startValue) : `${shortDate(startValue)}–${shortDate(endValue)}`;
    return `<button type="button" onclick="event.stopPropagation(); openStudentTimelineEvent(${weekNumber}, ${eventIndex}, ${roundId ? `'${escapeHtml(roundId)}'` : 'null'})" title="Xem chi tiết sự kiện" class="flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:shadow-sm" style="background-color:${color}18;border-color:${color}66;color:${color}">
      <span class="shrink-0">📌 ${escapeHtml(dateLabel)}</span><span class="min-w-0 flex-1 truncate font-black">${escapeHtml(event.title)}</span>${countdown ? `<span class="shrink-0 font-bold opacity-80">${countdown}</span>` : ''}
    </button>`;
  }).join('')}</div>`;
}

window.closeStudentTimelineEvent = function() {
  document.getElementById('student-timeline-event-dialog')?.remove();
};

window.openStudentTimelineEvent = function(weekNumber, eventIndex, roundId = null) {
  const eventMap = roundId ? state.roundTimelineEventMap?.get(roundId) : state.studentTimelineEventMap;
  const event = eventMap?.get(Number(weekNumber))?.[Number(eventIndex)];
  if (!event) return;
  window.closeStudentTimelineEvent();
  const activity = event.activity;
  const details = activity?.descriptionHtml
    ? sanitizeRichHtml(activity.descriptionHtml)
    : escapeHtml(activity?.description || '').replace(/\n/g, '<br>');
  const dialog = document.createElement('div');
  dialog.id = 'student-timeline-event-dialog';
  dialog.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4';
  dialog.onclick = click => { if (click.target === dialog) window.closeStudentTimelineEvent(); };
  dialog.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Chi tiết sự kiện" class="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
    <div class="flex items-start justify-between gap-3"><div><div class="text-[11px] font-bold uppercase text-blue-700">${activity ? 'Mốc kế hoạch' : 'Sự kiện trong tuần'}</div><h3 class="mt-1 text-lg font-black text-slate-900">${escapeHtml(event.title)}</h3></div><button type="button" onclick="closeStudentTimelineEvent()" class="rounded-lg bg-slate-100 px-3 py-1.5 text-lg text-slate-600" aria-label="Đóng">×</button></div>
    <div class="mt-4 space-y-2 text-sm text-slate-700"><div>🕒 ${activity ? escapeHtml(fmtActivityTime(activity.startAt, activity.endAt)) : escapeHtml(event.startDate === event.endDate ? event.startDate : `${event.startDate} – ${event.endDate}`)}</div>${activity?.location ? `<div>📍 ${escapeHtml(activity.location)}</div>` : ''}${activity?.isTentative ? '<div class="text-amber-700">Thời gian dự kiến</div>' : ''}</div>
    ${details ? `<div class="rich-rendered-content mt-4 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-700">${details}</div>` : ''}
  </div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('button')?.focus();
};

window.openStudentTimelineDay = function(weekNumber, dateKey, roundId = null) {
  const eventMap = roundId ? state.roundTimelineEventMap?.get(roundId) : state.studentTimelineEventMap;
  const events = eventMap?.get(Number(weekNumber)) || [];
  const date = new Date(`${dateKey}T00:00:00`);
  const dayIndex = (date.getDay() + 6) % 7;
  const matches = events.map((event, index) => ({ event, index }))
    .filter(item => roundWeekEventOccursOnDay(item.event, { key: dateKey, dayIndex }));
  if (matches.length === 1) {
    window.openStudentTimelineEvent(weekNumber, matches[0].index, roundId);
    return;
  }
  if (matches.length < 2) return;
  window.closeStudentTimelineEvent();
  const dialog = document.createElement('div');
  dialog.id = 'student-timeline-event-dialog';
  dialog.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4';
  dialog.onclick = click => { if (click.target === dialog) window.closeStudentTimelineEvent(); };
  dialog.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Sự kiện trong ngày" class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div class="flex items-center justify-between gap-2"><h3 class="text-lg font-black text-slate-900">Sự kiện ngày ${escapeHtml(dateKey)}</h3><button type="button" onclick="closeStudentTimelineEvent()" class="rounded-lg bg-slate-100 px-3 py-1.5 text-lg" aria-label="Đóng">×</button></div><div class="mt-4 space-y-2">${matches.map(item => `<button type="button" onclick="openStudentTimelineEvent(${weekNumber}, ${item.index}, ${roundId ? `'${escapeHtml(roundId)}'` : 'null'})" class="block w-full rounded-xl border border-slate-200 p-3 text-left text-sm font-bold text-blue-800 hover:bg-blue-50">${escapeHtml(item.event.title)}</button>`).join('')}</div></div>`;
  document.body.appendChild(dialog);
};

function renderAdminRoundTimelinePreview(round) {
  if (typeof renderUnifiedRoundTimeline === 'function') {
    return renderUnifiedRoundTimeline(round, { role: 'admin', isAdmin: true });
  }
  const weeks = getRoundTimelineWeeksWithActivities(round, false);
  rememberRoundTimelineEvents(round.id, weeks);
  const visibleWeeks = weeks.filter(week => week.visible).length;
  const hiddenWeeks = weeks.length - visibleWeeks;
  const statusStyles = {
    completed: { card: 'bg-emerald-50 border-emerald-300', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Đã qua', icon: '✓' },
    ongoing: { card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-200', badge: 'bg-blue-600 text-white border-blue-600', label: 'Đang diễn ra', icon: '●' },
    upcoming: { card: 'bg-slate-50 border-slate-200', badge: 'bg-white text-slate-500 border-slate-200', label: 'Chưa tới', icon: null }
  };

  const introCards = [
    { icon: '📝', title: 'Đăng ký đề tài', subtitle: 'Đề tài ĐATN' },
    { icon: '👨‍🏫', title: 'Phân công GVHD', subtitle: isDirectSupervisorAssignment(round) ? 'Khoa phân công' : 'Xét nguyện vọng' }
  ].map(card => `
    <div role="button" tabindex="0" onclick="openRoundWeekEditor('${round.id}')" class="ifa-timeline-card min-w-[215px] rounded-2xl border border-slate-200 bg-white p-3 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:shadow-md cursor-pointer transition">
      <span class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg mb-2">${card.icon}</span>
      <span class="font-black text-xs text-slate-900">${card.title}</span>
      <span class="text-[10px] text-slate-500 mt-1">${card.subtitle}</span>
    </div>`).join('');

  const weekCards = weeks.map(week => {
    const style = statusStyles[week.status] || statusStyles.upcoming;
    const resolvedTitle = resolveRoundWeekTitle(week.week, week.title);
    const circleContent = style.icon || (week.week > 12 ? (week.week === 13 ? '📄' : week.week === 14 ? '🎓' : '📌') : week.week);
    return `
      <div role="button" tabindex="0" onclick="openRoundWeekEditor('${round.id}', ${week.week})" class="ifa-timeline-card relative min-w-[290px] rounded-2xl border p-3 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition ${style.card} ${week.visible ? '' : 'opacity-55 border-dashed grayscale'}">
        <div class="flex items-center justify-between gap-1 w-full mb-1">
          <span class="font-black text-xs text-slate-900 whitespace-nowrap">${escapeHtml(resolvedTitle)}</span>
          ${week.milestone ? `<span class="px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-black text-[9px] leading-tight text-center truncate max-w-[100px]" title="${escapeHtml(week.milestone)}">🚩 ${escapeHtml(week.milestone)}</span>` : ''}
          <div class="flex items-center gap-1 shrink-0">
            <span class="px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${week.visible ? style.badge : 'bg-slate-200 text-slate-600 border-slate-300'}">${week.visible ? style.label : 'Đang ẩn'}</span>
            <button type="button" onclick="toggleRoundTimelineWeekVisibility('${round.id}', ${week.week}, event)" class="px-1.5 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[9px] font-bold shadow-xs transition cursor-pointer ${week.visible ? 'text-slate-600 hover:text-slate-900' : 'text-blue-700 hover:text-blue-900'}">${week.visible ? 'Ẩn' : 'Hiện'}</button>
          </div>
        </div>
        <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black my-1 ${week.status === 'ongoing' ? 'bg-blue-600 text-white' : week.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">${circleContent}</span>
        <span class="font-mono font-bold text-[11px] text-slate-700">${week.dateText}</span>
        ${renderTimelineWeekDays(week.days, week.events, week.week, round.id)}
        ${renderTimelineWeekEvents(week.events, week.week, round.id)}
        ${week.note ? `<span class="text-[9px] text-slate-500 mt-1 line-clamp-1">${escapeHtml(week.note)}</span>` : ''}
      </div>`;
  }).join('');

  return `
    <section class="px-4 py-3.5 bg-white border-b border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">🗓️</span>
          <div>
            <div class="font-black text-sm text-slate-900">Lộ trình đồ án tốt nghiệp & tiến độ thực hiện</div>
            <div class="text-[10px] text-slate-500">Kế hoạch ${weeks.length} tuần · ${visibleWeeks} tuần hiển thị${hiddenWeeks ? ` · ${hiddenWeeks} tuần đang ẩn` : ''}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="openRoundWeekEditor('${round.id}')" class="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition">＋ Thêm / sửa mốc</button>
        </div>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2 snap-x">${introCards}${weekCards}</div>
    </section>`;
}

window.openRoundWeekEditor = async function(roundId, weekNumber = null) {
  await window.editRoundModal(roundId, 'info');
  window.setTimeout(() => {
    const target = weekNumber
      ? document.getElementById(`round-week-${weekNumber}-title`)
      : document.getElementById('round-weekly-content-editor-wrap');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (weekNumber) target?.focus();
  }, 180);
};

window.toggleRoundTimelineWeekVisibility = async function(roundId, weekNumber, event) {
  event?.stopPropagation();
  const round = (state.rounds || []).find(item => item.id === roundId);
  if (!round) return;
  const durationWeeks = parseInt(round.durationWeeks, 10) || 12;
  const existing = Array.isArray(round.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
  const nextConfig = Array.from({ length: durationWeeks }, (_, index) => {
    const week = index + 1;
    const current = existing.find(item => Number(item.week) === week) || { week, title: `Tuần ${week}`, note: '', milestone: '' };
    return week === Number(weekNumber) ? { ...current, visible: current.visible === false } : { ...current, visible: current.visible !== false };
  });
  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), { timelineWeeksConfig: nextConfig, updatedAt: serverTimestamp() });
    round.timelineWeeksConfig = nextConfig;
    renderAdminRoundsCards();
    if (state.selectedRoundId === roundId && typeof renderStudentTimelineWeeks === 'function') renderStudentTimelineWeeks();
    const changed = nextConfig.find(item => Number(item.week) === Number(weekNumber));
    showToast(changed?.visible === false ? `Đã ẩn Tuần ${weekNumber} khỏi trang sinh viên.` : `Đã hiện Tuần ${weekNumber} trên trang sinh viên.`, 'success');
  } catch (error) {
    showToast('Không thể cập nhật hiển thị tuần: ' + error.message, 'error');
  }
};

if (typeof window !== 'undefined') {
  window.renderAdminRoundTimelinePreview = renderAdminRoundTimelinePreview;
}

if (typeof window !== 'undefined') {
  window.getRoundWeekSchedule = getRoundWeekSchedule;
  window.getRoundTimelineWeeksWithActivities = getRoundTimelineWeeksWithActivities;
  window.rememberRoundTimelineEvents = rememberRoundTimelineEvents;
  window.renderTimelineWeekDays = renderTimelineWeekDays;
  window.renderTimelineWeekEvents = renderTimelineWeekEvents;
  window.renderAdminRoundTimelinePreview = renderAdminRoundTimelinePreview;
}
