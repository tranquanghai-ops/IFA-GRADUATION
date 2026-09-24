const fs = require('fs');
const path = require('path');

if (!fs.existsSync('js/planning')) {
  fs.mkdirSync('js/planning', { recursive: true });
}

const content = fs.readFileSync('js/planning.js', 'utf8');
const lines = content.split('\n');

// 1. activities-manager.js: Lines 1 - 900
const actLines = [
  "/**\n * IFA+ Graduation — Planning Activities & Milestones CRUD Submodule\n */",
  ...lines.slice(0, 900),
  `
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
}
`
];
fs.writeFileSync('js/planning/activities-manager.js', actLines.join('\n'), 'utf8');

// 2. submissions.js: Lines 901 - 1640
const subLines = [
  "/**\n * IFA+ Graduation — Student Submissions & Deadline Override Submodule\n */",
  "import { sanitizeRichHtml, fmtActivityTime } from './activities-manager.js';",
  ...lines.slice(900, 1640),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderStudentSubmissionPanel !== 'undefined') window.renderStudentSubmissionPanel = renderStudentSubmissionPanel;
  if (typeof openActivitySubmissionsModal !== 'undefined') window.openActivitySubmissionsModal = openActivitySubmissionsModal;
  if (typeof openSubmissionOverrideModal !== 'undefined') window.openSubmissionOverrideModal = openSubmissionOverrideModal;
  if (typeof openSubmissionHistoryModal !== 'undefined') window.openSubmissionHistoryModal = openSubmissionHistoryModal;
}
`
];
fs.writeFileSync('js/planning/submissions.js', subLines.join('\n'), 'utf8');

// 3. timeline-roadmap.js: Lines 1641 - 2103
const timeLines = [
  "/**\n * IFA+ Graduation — Unified Timeline & Weekly Roadmap Submodule\n */",
  "import { sanitizeRichHtml, fmtActivityTime, normalizeActivity, isActivityPublished, findNearestMilestone, startMilestoneCountdownTicker } from './activities-manager.js';",
  ...lines.slice(1640, 2103),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderUnifiedActivityCard !== 'undefined') window.renderUnifiedActivityCard = renderUnifiedActivityCard;
  if (typeof renderUnifiedTimelineWeekCard !== 'undefined') window.renderUnifiedTimelineWeekCard = renderUnifiedTimelineWeekCard;
  if (typeof renderUnifiedRoundTimeline !== 'undefined') window.renderUnifiedRoundTimeline = renderUnifiedRoundTimeline;
  if (typeof renderUnifiedPlanList !== 'undefined') window.renderUnifiedPlanList = renderUnifiedPlanList;
}
`
];
fs.writeFileSync('js/planning/timeline-roadmap.js', timeLines.join('\n'), 'utf8');

// 4. Update index planning.js as master bridge
const indexPlanningCode = `/**
 * IFA+ Graduation — Planning, Milestones & Unified Timeline Module
 */
import './planning/activities-manager.js';
import './planning/submissions.js';
import './planning/timeline-roadmap.js';

export * from './planning/activities-manager.js';
export * from './planning/submissions.js';
export * from './planning/timeline-roadmap.js';
`;
fs.writeFileSync('js/planning.js', indexPlanningCode, 'utf8');

console.log('Successfully split planning.js into 3 submodules in js/planning/!');
