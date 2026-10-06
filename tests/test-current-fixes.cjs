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

const studentTopicPdf = read('js/students/student-topic-pdf.js');
assert.match(studentTopicPdf, /function resolveOfficialStudentFullName/);
assert.match(studentTopicPdf, /resolveOfficialStudentFullName/);
assert.match(studentTopicPdf, /window\.resolveOfficialStudentFullName = resolveOfficialStudentFullName/);

// Verify resolveOfficialStudentFullName logic
const topicPdfContext = {
  state: { myRegistration: { studentName: 'Nguyễn Thanh Hằng Nga' }, impersonation: null, studentSelfProfile: null, user: null },
  window: {}
};
const fnMatch = studentTopicPdf.match(/function resolveOfficialStudentFullName\([\s\S]*?\n\}\nwindow\.resolveOfficialStudentFullName/);
assert.ok(fnMatch, 'resolveOfficialStudentFullName function body found');
vm.runInNewContext(fnMatch[0].replace(/\nwindow\.resolveOfficialStudentFullName$/, ''), topicPdfContext);
const resolvedName = topicPdfContext.resolveOfficialStudentFullName('12200254', { studentName: 'Nguyễn Thanh Hằng Nga' }, { fullName: 'Sinh viên 12200254', isMissing: true });
assert.equal(resolvedName, 'Nguyễn Thanh Hằng Nga', 'resolveOfficialStudentFullName should return actual student name over placeholder');

const modalTopicPreview = read('templates/modals/shared/modal-topic-preview.html');
// Header cancel/save buttons are removed as requested, only kept in footer
assert.doesNotMatch(modalTopicPreview, /id="btn-topic-preview-cancel-edit"/);
assert.doesNotMatch(modalTopicPreview, /id="btn-topic-preview-save-edit"/);
assert.match(modalTopicPreview, /id="btn-topic-preview-footer-cancel-edit"[\s\S]*?id="btn-topic-preview-footer-save"/);
assert.match(modalTopicPreview, /id="btn-topic-preview-footer-save"[\s\S]*?<span>💾<\/span> <span>Lưu & Gửi GVHD duyệt lại<\/span>/);
// Check colon spacing and normal font weight in modal preview
assert.match(modalTopicPreview, /HỌ VÀ TÊN\s*:<\/span> <span id="topic-preview-doc-name" style="font-weight:normal;"/);
assert.match(modalTopicPreview, /MSSV:<\/span> <span id="topic-preview-doc-mssv" style="font-weight:normal;"/);
assert.match(modalTopicPreview, /id="topic-preview-doc-sup-name" style="font-weight:normal;/);
assert.match(modalTopicPreview, /id="topic-preview-version-selector-wrap"/);

const supervisorTopics = read('js/supervisors/supervisor-portal-topics.js');
assert.match(supervisorTopics, /const displayVersion = wasApproved \? \(currentVersion \+ 1\) : currentVersion/);
assert.match(supervisorTopics, /btnSaveBottom\.innerHTML = '<span>💾<\/span> <span>Lưu & Gửi GVHD duyệt lại<\/span>'/);
assert.match(supervisorTopics, /window\.toggleModalVersionDropdown = function/);

// PDF export assertions: bold: false for all names and labels, colon spacing, supervisor name in bottom row
assert.match(studentTopicPdf, /text: 'HỌ VÀ TÊN\s*: ', bold: false/);
assert.match(studentTopicPdf, /text: supervisorName \|\| '', bold: false, fontSize: 12/);
assert.match(studentTopicPdf, /text: identity\.fullName \|\| '', bold: false, fontSize: 12/);
assert.match(studentTopicPdf, /layout: 'noBorders'/);
assert.match(studentTopicPdf, /function getApprovedTopicVersions/);
assert.match(studentTopicPdf, /ensureTimesFontLoaded/);

const impersonationModal = read('js/impersonation/impersonation-modal.js');
assert.match(impersonationModal, /state\.adminReviewData\?\.roundId === r\.id/);
assert.match(impersonationModal, /const hasRealName = Boolean\(currentName && currentName\.toUpperCase\(\) !== sid/);
assert.match(impersonationModal, /candidate\.notFoundInMaster = !hasRealName && \(state\.facultyStudentsLoaded === true\)/);

const assessmentPortal = read('js/grading/assessment-portal.js');
assert.match(assessmentPortal, /state\.adminReviewData\?\.roundId === round\.id/);
assert.match(assessmentPortal, /state\.adminReviewData\?\.roundId === targetRound\.id/);

// 1. Hình GVHD to hơn
const roundsLoader = read('js/rounds/rounds-loader.js');
assert.match(roundsLoader, /w-18 h-18 sm:w-20 sm:h-20 rounded-2xl border-2 border-white\/40 object-cover/);

// 2 & 3. PDF Centered lines & Clean signature block (no 'Đã duyệt đề tài')
assert.match(studentTopicPdf, /widths: \['\*', 120, '\*'\]/);
assert.match(studentTopicPdf, /widths: \['\*', 130, '\*'\]/);
assert.doesNotMatch(studentTopicPdf, /Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN[\s\S]*?\(Đã duyệt đề tài\)/);

// 4. Thẻ sự kiện sắp tới hạn có màu cam nhạt nổi bật
const timelineRoadmap = read('js/planning/timeline-roadmap.js');
assert.match(timelineRoadmap, /border-amber-400 bg-amber-50\/85 ring-2 ring-amber-400\/60 shadow-md/);
assert.match(timelineRoadmap, /⚡ Sắp tới/);

// 5. Thẻ sinh viên màu xanh dương nhạt, xen kẽ đậm nhạt, bỏ thẻ GVHD chính, tên SV lên trước
const supervisorPortalStudents = read('js/supervisors/supervisor-portal-students.js');
assert.match(supervisorPortalStudents, /filtered\.map\(\(st, index\) =>/);
assert.match(supervisorPortalStudents, /bg-sky-50\/70 border-sky-200\/80/);
assert.match(supervisorPortalStudents, /bg-blue-100\/60 border-blue-200/);
assert.doesNotMatch(supervisorPortalStudents, /roleBadge/);
assert.match(supervisorPortalStudents, /MSSV:\s*\$\{studentId\}/);

// 6. Bỏ chữ Beta, đưa phiên bản V1.0.1 xuống cuối cùng và thêm dòng Build by
const indexHtml = read('index.html');
assert.match(indexHtml, /id="app-footer"/);
assert.match(indexHtml, /Phiên bản V1\.0\.1/);
assert.match(indexHtml, /Build by:\s*<strong>ThS\.\s*NCS\.\s*Trần Quang Hải<\/strong>/);
assert.doesNotMatch(indexHtml, /id="ifa-header-title-row"[\s\S]*?<span class="ifa-version-badge">/);
assert.match(indexHtml, /<title>IFA\+ Graduation — Đăng ký & Xét duyệt GVHD Đồ án Tốt nghiệp<\/title>/);
assert.doesNotMatch(indexHtml, /<title>IFA\+ Graduation Beta/);

// 7. Desktop mốc kế hoạch mở rộng thoáng mắt
const roundsTimelinePreview = read('js/rounds/rounds-timeline-preview.js');
assert.match(roundsTimelinePreview, /max-w-3xl lg:max-w-4xl/);

// 8. Admin & GVHD vào trang chủ (/) mặc định là Cổng GVHD, bỏ /supervisor/
assert.match(authJs, /\(isAdmin \|\| isSupervisor\) && !state\.impersonation[\s\S]*?state\.currentView = 'supervisor'/);
const coreJs = read('js/core.js');
assert.match(coreJs, /path\.includes\('\/supervisor'\)[\s\S]*?window\.history\.replaceState\(null, '', '\/'\)/);

// 9. Mobile council workspace: grading column must scroll vertically with overflow-y: auto and touch-action: pan-y
assert.match(stylesCss, /#modal-council-workspace #cws-col-grading:not\(\.hidden\) \{[\s\S]*?overflow-y: auto !important;[\s\S]*?touch-action: pan-y !important;/);
assert.doesNotMatch(stylesCss, /#modal-council-workspace #cws-col-grading:not\(\.hidden\)[^{]*\{[\s\S]*?overflow: hidden !important;/);

console.log('Current regression checks passed.');


