/**
 * IFA+ Graduation — Round Schedule Copying & Timeline Recalculation Engine
 *
 * Accurately shifts all milestone dates, council evaluation windows, and submission deadlines
 * from an existing round to a new round, preserving:
 * - Week index (Week 4, Week 8, Week 12, etc.)
 * - Day of week (Friday -> Friday, Monday -> Monday)
 * - Exact hours, minutes, seconds in Vietnam Timezone (+07:00)
 * - Strict relationship: openAt <= deadlineAt <= council startAt <= council endAt
 * - Total duration (N weeks) and weekly milestone themes
 * - Template configurations (Drive subfolders, rubric, submission formats)
 *
 * STRICT DATA ISOLATION:
 * - Completely excludes students, registrations, supervisor assignments, scores, submissions,
 *   attendance, audit logs, and concrete Google Drive IDs.
 * - Generates clean, independent IDs and slugs.
 */

const pad = n => String(n).padStart(2, '0');

/**
 * Parses any date/timestamp into Vietnam (+07:00) calendar components.
 * Supports: 'YYYY-MM-DD', ISO strings, Date instances, Firestore Timestamps ({ toDate() }).
 */
export function parseDateToVietnamComponents(val) {
  if (!val) return null;

  // Case 1: Plain 'YYYY-MM-DD' string
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    const [y, m, d] = val.trim().split('-').map(Number);
    const utcMidnight = Date.UTC(y, m - 1, d);
    const utcDate = new Date(utcMidnight);
    const dayOfWeek = (utcDate.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
    return {
      year: y,
      month: m,
      date: d,
      hours: 0,
      minutes: 0,
      seconds: 0,
      dayOfWeek,
      dateStr: `${y}-${pad(m)}-${pad(d)}`,
      timeStr: '00:00',
      utcMidnightMs: utcMidnight
    };
  }

  // Case 2: Date object, Timestamp object, or ISO string
  const rawDate = new Date(val?.toDate ? val.toDate() : val);
  if (isNaN(rawDate.getTime())) return null;

  // Convert to UTC+7 offset in milliseconds (+7 hours)
  const vnMs = rawDate.getTime() + (7 * 60 + rawDate.getTimezoneOffset()) * 60 * 1000;
  const vn = new Date(vnMs);
  const y = vn.getFullYear();
  const m = vn.getMonth() + 1;
  const d = vn.getDate();
  const hours = vn.getHours();
  const minutes = vn.getMinutes();
  const seconds = vn.getSeconds();
  const dayOfWeek = (vn.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const utcMidnight = Date.UTC(y, m - 1, d);

  return {
    year: y,
    month: m,
    date: d,
    hours,
    minutes,
    seconds,
    dayOfWeek,
    dateStr: `${y}-${pad(m)}-${pad(d)}`,
    timeStr: `${pad(hours)}:${pad(minutes)}`,
    utcMidnightMs: utcMidnight,
    rawDate
  };
}

/**
 * Returns the Monday (at 00:00:00 in Vietnam time) for a given date.
 */
export function getVietnamMonday(val) {
  const parts = parseDateToVietnamComponents(val);
  if (!parts) return null;

  const monUtcMs = parts.utcMidnightMs - parts.dayOfWeek * 86400000;
  const monDate = new Date(monUtcMs);
  const y = monDate.getUTCFullYear();
  const m = monDate.getUTCMonth() + 1;
  const d = monDate.getUTCDate();

  return {
    year: y,
    month: m,
    date: d,
    dateStr: `${y}-${pad(m)}-${pad(d)}`,
    utcMidnightMs: monUtcMs
  };
}

/**
 * Shifts a single timestamp from source schedule to new schedule.
 * Preserves the exact day-offset from Monday, weekday, and hour/minute/second.
 * Returns ISO string formatted as 'YYYY-MM-DDTHH:mm:ss+07:00'
 */
export function shiftTimestampVN(sourceTs, sourceMondayMs, newMondayMs) {
  if (!sourceTs) return null;
  const src = parseDateToVietnamComponents(sourceTs);
  if (!src) return null;

  const dayDiff = Math.round((src.utcMidnightMs - sourceMondayMs) / 86400000);
  const targetUtcMs = newMondayMs + dayDiff * 86400000;
  const targetDate = new Date(targetUtcMs);

  const ty = targetDate.getUTCFullYear();
  const tm = targetDate.getUTCMonth() + 1;
  const td = targetDate.getUTCDate();

  return `${ty}-${pad(tm)}-${pad(td)}T${pad(src.hours)}:${pad(src.minutes)}:${pad(src.seconds)}+07:00`;
}

/**
 * Formats ISO or Date to Vietnamese friendly string: "08:00 20/03/2026"
 */
export function formatVietnamDateTime(val) {
  if (!val) return '--';
  const p = parseDateToVietnamComponents(val);
  if (!p) return '--';
  return `${pad(p.hours)}:${pad(p.minutes)} ${pad(p.date)}/${pad(p.month)}/${p.year}`;
}

/**
 * Slugs helper
 */
function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Core function: Recalculates shifted schedule from a source round to a new start date.
 *
 * @param {Object} sourceRound - Source round document
 * @param {string} newStartDateStr - Target start date ('YYYY-MM-DD')
 * @param {Object} [options] - Optional overrides: { newTitle, newAcademicYear, newSlug }
 * @returns {Object} Recalculated schedule and shifted activities ready for preview or persistence
 */
export function calculateShiftedRoundSchedule(sourceRound, newStartDateStr, options = {}) {
  if (!sourceRound || typeof sourceRound !== 'object') {
    throw new Error('Đợt nguồn không hợp lệ hoặc chưa được chọn.');
  }
  if (!newStartDateStr) {
    throw new Error('Vui lòng chọn ngày bắt đầu thực hiện đợt mới.');
  }

  // 1. Determine Source Monday
  const sourceStartRaw = sourceRound.startDate || sourceRound.datnStartDate || sourceRound.openAt;
  const sourceMonday = getVietnamMonday(sourceStartRaw) || getVietnamMonday(new Date());

  // 2. Determine New Monday
  const newMonday = getVietnamMonday(newStartDateStr);
  if (!newMonday) {
    throw new Error('Ngày bắt đầu mới không hợp lệ.');
  }

  const durationWeeks = Math.max(1, Math.min(24, parseInt(sourceRound.durationWeeks, 10) || 12));

  // Calculate new round end date (Sunday of final week)
  const finalWeekEndUtcMs = newMonday.utcMidnightMs + (durationWeeks * 7 - 1) * 86400000;
  const finalEndDate = new Date(finalWeekEndUtcMs);
  const newEndDateStr = `${finalEndDate.getUTCFullYear()}-${pad(finalEndDate.getUTCMonth() + 1)}-${pad(finalEndDate.getUTCDate())}`;

  const validationErrors = [];
  const validationWarnings = [];

  // Check start vs end
  if (finalWeekEndUtcMs <= newMonday.utcMidnightMs) {
    validationErrors.push('Ngày kết thúc phải sau ngày bắt đầu.');
  }

  // 3. Shift Activities
  const sourceActivities = Array.isArray(sourceRound.activities) ? sourceRound.activities : [];
  const shiftedActivities = [];

  sourceActivities.forEach((srcAct, index) => {
    if (!srcAct) return;

    const actId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const baseTitle = String(srcAct.title || `Hoạt động ${index + 1}`).trim();
    const actSlug = slugify(baseTitle) || `act-${index + 1}`;

    // Deep clone activity config
    const shifted = JSON.parse(JSON.stringify(srcAct));

    // Overwrite unique identity and link to new round
    shifted.id = actId;
    shifted.roundId = ''; // will be set upon saving
    shifted.slug = actSlug;
    shifted.order = typeof srcAct.order === 'number' ? srcAct.order : (index + 1);
    shifted.title = baseTitle;
    shifted.activityType = srcAct.activityType || 'other';
    shifted.isTentative = Boolean(srcAct.isTentative);
    shifted.publicationStatus = 'draft';
    shifted.visibility = false;

    // Shift council / milestone startAt & endAt
    shifted.startAt = shiftTimestampVN(srcAct.startAt, sourceMonday.utcMidnightMs, newMonday.utcMidnightMs);
    shifted.endAt = shiftTimestampVN(srcAct.endAt, sourceMonday.utcMidnightMs, newMonday.utcMidnightMs);

    // Shift submission window if enabled
    if (shifted.submissionConfig) {
      shifted.submissionConfig.openAt = shiftTimestampVN(
        srcAct.submissionConfig.openAt,
        sourceMonday.utcMidnightMs,
        newMonday.utcMidnightMs
      );
      shifted.submissionConfig.deadlineAt = shiftTimestampVN(
        srcAct.submissionConfig.deadlineAt,
        sourceMonday.utcMidnightMs,
        newMonday.utcMidnightMs
      );

      // CLEAR Drive folders from submission config
      shifted.submissionConfig.driveFolderId = null;
      shifted.submissionConfig.driveFolderName = null;
      shifted.submissionConfig.driveFolderUrl = null;
    }

    // STRICT DATA ISOLATION: Purge runtime and specific data
    delete shifted.submissions;
    delete shifted.scores;
    delete shifted.attendance;
    delete shifted.auditLogs;
    delete shifted.presentationStatuses;
    delete shifted.liveTimer;
    delete shifted.timerSettings;
    delete shifted.presentationOrder;
    delete shifted.publishedReviews;
    shifted.councils = [];
    shifted.councilStudentAssignments = [];

    // Clear concrete Google Drive IDs
    shifted.driveFolderId = null;
    shifted.driveFolderName = null;
    shifted.driveFolderUrl = null;

    // Calculate Week Index for preview
    const actDateMs = parseDateToVietnamComponents(shifted.startAt || shifted.endAt || shifted.submissionConfig?.deadlineAt)?.utcMidnightMs;
    let computedWeek = 1;
    if (actDateMs) {
      computedWeek = Math.floor((actDateMs - newMonday.utcMidnightMs) / (7 * 86400000)) + 1;
    }
    shifted.computedWeek = computedWeek;

    // Validation checks for this shifted activity
    if (shifted.startAt && shifted.endAt) {
      const sMs = new Date(shifted.startAt).getTime();
      const eMs = new Date(shifted.endAt).getTime();
      if (eMs < sMs) {
        validationErrors.push(`Mốc "${shifted.title}": Thời gian kết thúc (${formatVietnamDateTime(shifted.endAt)}) sớm hơn thời gian bắt đầu (${formatVietnamDateTime(shifted.startAt)}).`);
      }
    }

    if (shifted.submissionEnabled && shifted.submissionConfig) {
      const openMs = shifted.submissionConfig.openAt ? new Date(shifted.submissionConfig.openAt).getTime() : 0;
      const deadMs = shifted.submissionConfig.deadlineAt ? new Date(shifted.submissionConfig.deadlineAt).getTime() : 0;
      const startMs = shifted.startAt ? new Date(shifted.startAt).getTime() : 0;

      if (openMs && deadMs && deadMs <= openMs) {
        validationErrors.push(`Mốc "${shifted.title}": Hạn nộp bài (${formatVietnamDateTime(shifted.submissionConfig.deadlineAt)}) phải sau thời gian mở nộp (${formatVietnamDateTime(shifted.submissionConfig.openAt)}).`);
      }
      if (deadMs && startMs && deadMs > startMs) {
        validationWarnings.push(`Mốc "${shifted.title}": Hạn nộp bài (${formatVietnamDateTime(shifted.submissionConfig.deadlineAt)}) trễ hơn thời điểm Hội đồng bắt đầu (${formatVietnamDateTime(shifted.startAt)}).`);
      }
    }

    shiftedActivities.push(shifted);
  });

  // 4. Shift Weekly Timeline Configuration (timelineWeeksConfig)
  const sourceWeekly = Array.isArray(sourceRound.timelineWeeksConfig) ? sourceRound.timelineWeeksConfig : [];
  const shiftedWeeklyConfig = Array.from({ length: durationWeeks }, (_, i) => {
    const weekNum = i + 1;
    const srcWeek = sourceWeekly.find(w => Number(w.week) === weekNum) || {};
    const weekStartMs = newMonday.utcMidnightMs + i * 7 * 86400000;

    const shiftedEvents = Array.isArray(srcWeek.events) ? srcWeek.events.map(ev => {
      const sDay = Math.max(0, Math.min(6, Number(ev.startDayIndex ?? ev.dayIndex ?? 0)));
      const eDay = Math.max(sDay, Math.min(6, Number(ev.endDayIndex ?? sDay)));

      const evStartMs = weekStartMs + sDay * 86400000;
      const evEndMs = weekStartMs + eDay * 86400000;

      const evStart = new Date(evStartMs);
      const evEnd = new Date(evEndMs);

      return {
        id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: String(ev.title || '').trim(),
        startDayIndex: sDay,
        endDayIndex: eDay,
        dayIndex: sDay,
        startDate: `${evStart.getUTCFullYear()}-${pad(evStart.getUTCMonth() + 1)}-${pad(evStart.getUTCDate())}`,
        endDate: `${evEnd.getUTCFullYear()}-${pad(evEnd.getUTCMonth() + 1)}-${pad(evEnd.getUTCDate())}`,
        color: ev.color || '#2563eb'
      };
    }).filter(e => e.title) : [];

    return {
      week: weekNum,
      title: srcWeek.title || `Tuần ${weekNum}`,
      note: srcWeek.note || '',
      milestone: srcWeek.milestone || (weekNum === 4 ? 'Duyệt đợt 1' : (weekNum === 8 ? 'Duyệt đợt 2' : (weekNum === 12 ? 'Duyệt đợt 3' : ''))),
      visible: srcWeek.visible !== false,
      events: shiftedEvents
    };
  });

  return {
    sourceRoundId: sourceRound.id,
    sourceRoundTitle: sourceRound.title || '',
    sourceAcademicYear: sourceRound.academicYear || '',
    sourceMondayDate: sourceMonday.dateStr,
    newMondayDate: newMonday.dateStr,
    newStartDate: newMonday.dateStr,
    newEndDate: newEndDateStr,
    durationWeeks,
    activities: shiftedActivities,
    timelineWeeksConfig: shiftedWeeklyConfig,
    driveSubfolderNames: Array.isArray(sourceRound.driveSubfolderNames) ? [...sourceRound.driveSubfolderNames] : [],
    preferenceCount: sourceRound.preferenceCount || 3,
    selectionMode: sourceRound.selectionMode || 'cards',
    supervisorAssignmentMode: sourceRound.supervisorAssignmentMode || 'student_preference',
    allowStudentEdit: sourceRound.allowStudentEdit !== false,
    allowTopicEdit: sourceRound.allowTopicEdit !== false,
    allowPreferenceEdit: sourceRound.allowPreferenceEdit !== false,
    showEmailAfterPublish: sourceRound.showEmailAfterPublish !== false,
    showPhoneAfterPublish: sourceRound.showPhoneAfterPublish !== false,
    validationErrors,
    validationWarnings
  };
}

if (typeof window !== 'undefined') {
  window.parseDateToVietnamComponents = parseDateToVietnamComponents;
  window.getVietnamMonday = getVietnamMonday;
  window.shiftTimestampVN = shiftTimestampVN;
  window.formatVietnamDateTime = formatVietnamDateTime;
  window.calculateShiftedRoundSchedule = calculateShiftedRoundSchedule;
}
