const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const core = read('js/core.js').replace(/\r\n/g, '\n');
const functionSource = core.match(/export function getRoundManualEventsForWeek\([\s\S]*?\n}\n\nexport function distinguishOverlappingTimelineEvents/);
assert.ok(functionSource, 'shared calendar event helper exists');
const context = { normalizeRoundWeekEventColor: value => value || '#dc2626' };
vm.runInNewContext(functionSource[0].replace(/^export /, '').replace(/\n\nexport function distinguishOverlappingTimelineEvents$/, ''), context);
const days = (start, count = 7) => Array.from({ length: count }, (_, dayIndex) => ({
  dayIndex, key: new Date(Date.parse(`${start}T12:00:00Z`) + dayIndex * 86400000).toISOString().slice(0, 10)
}));
const source = [{ week: 2, events: [{ id: 'moved', title: 'Đóng tiền', startDate: '2026-10-06', endDate: '2026-10-06', dayIndex: 1 }] }];
assert.equal(context.getRoundManualEventsForWeek(source, 2, days('2026-09-28')).length, 0);
assert.equal(context.getRoundManualEventsForWeek(source, 3, days('2026-10-05'))[0].sourceWeek, 2);
assert.match(core, /event\.startDate && event\.endDate && day\.key/);

const students = read('js/students/students-master.js');
assert.match(students, /connectIFAAForAdmin/);
assert.match(students, /collection\(ifaaDb, 'facultyStudents'\)/);
assert.doesNotMatch(students, /token=[0-9a-f]{8}-/);
const supervisor = read('js/supervisors/supervisor-portal-core.js');
assert.match(supervisor, /supervisor-round-loading/);
assert.match(supervisor, /loadSequence !== supervisorPortalLoadSequence/);
const councilsWorkspace = read('js/grading/councils-workspace.js');
assert.match(councilsWorkspace, /openCopyCouncilsFromMilestoneModal/);
assert.match(councilsWorkspace, /confirmCopyCouncilsFromMilestone/);
assert.match(councilsWorkspace, /stopCouncilPresentation/);
assert.match(councilsWorkspace, /shuffleStudentsAvoidingConsecutiveSupervisors/);
assert.match(councilsWorkspace, /randomizeCouncilPresentationOrder/);
assert.match(councilsWorkspace, /autoDistributeUnassignedStudents/);

const councilsEditor = read('js/grading/councils-editor.js');
assert.match(councilsEditor, /isCouncilTimeOverlap/);
assert.match(councilsEditor, /getConflictingCouncilMembersForSlot/);

assert.match(read('templates/modals/grading/modal-activity-councils.html'), /modal-copy-councils-from-milestone/);
assert.match(read('templates/modals/grading/modal-activity-councils.html'), /GV Hướng dẫn/);
assert.match(read('templates/modals/grading/modal-activity-councils.html'), /council-student-subtabs/);
assert.match(read('templates/modals/grading/modal-activity-councils.html'), /max-w-6xl/);
assert.match(read('templates/modals/grading/modal-council-workspace.html'), /z-\[75\]/);
const councilTemplate = read('templates/modals/grading/modal-council-workspace.html');
assert.match(councilTemplate, /id="cws-student-score-card"[\s\S]*id="cws-selected-student-card"[\s\S]*id="cws-scoring-section"[\s\S]*<\/div>/);
assert.doesNotMatch(councilTemplate, /cardFlipNext|card-flip-next/);
assert.match(councilTemplate, /id="cws-member-menu-trigger"[\s\S]*id="cws-member-menu"/);
assert.doesNotMatch(councilTemplate, /id="btn-cws-direct-logout"/);
const rubricsWorkspace = read('js/grading/rubrics-workspace.js');
assert.match(rubricsWorkspace, /council-standalone-active/);
assert.match(rubricsWorkspace, /handleCouncilDirectLogout/);
assert.match(rubricsWorkspace, /isDirectMode/);
assert.match(rubricsWorkspace, /role:\s*'member'/);
assert.match(rubricsWorkspace, /isAdmin:\s*false/);
assert.match(rubricsWorkspace, /const targetCard = document\.getElementById\('cws-student-score-card'\)/);
assert.match(rubricsWorkspace, /exit\.finished\.then\(\(\) => \{[\s\S]*applySelection\(\)/);
assert.match(rubricsWorkspace, /prefers-reduced-motion/);
assert.match(rubricsWorkspace, /navigateCouncilPrevStudent[\s\S]*?\.sort\(\(a, b\) => \(a\.order \|\| 0\) - \(b\.order \|\| 0\)\)/);
assert.match(rubricsWorkspace, /navigateCouncilNextStudent[\s\S]*?\.sort\(\(a, b\) => \(a\.order \|\| 0\) - \(b\.order \|\| 0\)\)/);
assert.match(rubricsWorkspace, /data-tone="\$\{index % 2 === 0 \? 'odd' : 'even'\}"/);
assert.match(rubricsWorkspace, /updateCouncilSelectedStudentSurface\(\)/);
assert.match(rubricsWorkspace, /toggleCouncilMemberMenu/);
assert.match(rubricsWorkspace, /showConfirm\('Đăng xuất'/);
assert.doesNotMatch(rubricsWorkspace, /confirm\('Bạn có chắc chắn muốn đăng xuất/);

const stylesCss = read('styles.css');
assert.match(stylesCss, /body\.council-standalone-active/);
assert.match(stylesCss, /#app-header/);
assert.match(stylesCss, /@media \(max-width: 767px\)[\s\S]*\.cws-header-layout/);
assert.match(stylesCss, /\.cws-status-dot\.is-active \{ background: #22c55e; \}/);
assert.match(stylesCss, /\.cws-identity-line \{ justify-content: center;/);
assert.doesNotMatch(stylesCss, /#modal-council-workspace \.bg-white\.rounded-2xl \{/);
assert.doesNotMatch(stylesCss, /#cws-timer-controls \{[\s\S]*width: 100% !important/);
assert.match(stylesCss, /\.cws-student-list-card\[data-presentation-state="presenting"\]/);
assert.match(stylesCss, /\.cws-student-score-card\[data-presentation-state="presented"\]/);
assert.match(stylesCss, /body\.council-standalone-active #modal-confirm/);

const authJs = read('js/auth.js');
assert.match(authJs, /checkAndHandlePendingCouncilDirectLink/);
assert.match(authJs, /council-standalone-active/);
assert.match(authJs, /handleLogout/);

const studentEligibility = read('js/students/student-eligibility-admin.js');
assert.match(studentEligibility, /topicApprovalStatus/);
assert.match(studentEligibility, /✓ Đã duyệt/);
assert.match(studentEligibility, /⏳ Chờ duyệt/);
assert.match(studentEligibility, /✕ Yêu cầu sửa/);

console.log('Current regression checks passed.');

