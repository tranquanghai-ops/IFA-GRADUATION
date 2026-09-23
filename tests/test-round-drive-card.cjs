const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('round form exposes root Drive and configurable child folders', () => {
  assert.match(html, /id="round-drive-folder-url"/);
  assert.match(html, /id="round-drive-subfolder-names"/);
  assert.match(html, /mỗi tên thư mục trên một dòng/i);
});

test('folder names are normalized, de-duplicated and bounded', () => {
  assert.match(app, /function normalizeRoundDriveFolderNames/);
  assert.match(app, /seen\.has\(key\)/);
  assert.match(app, /\.slice\(0, 20\)/);
  assert.match(app, /\.slice\(0, 120\)/);
});

test('saving a validated round provisions idempotent Drive folders', () => {
  assert.match(app, /provisionRoundDriveFolders/);
  assert.match(app, /\/api\/graduation\/drive\/get-or-create-folder/);
  assert.match(app, /folderType: 'round_structure'/);
  assert.match(app, /driveFolderStructure/);
});

test('round cards use the professional dashboard layout and retain workflow actions', () => {
  assert.match(app, /from-slate-950 via-slate-900 to-blue-950/);
  assert.match(app, /Tổng sinh viên ↗/);
  assert.match(app, /GVHD tham gia ↗/);
  assert.match(app, /copyRoundLink\('\$\{r\.id\}', '\$\{shortCode\}'\)/);
  assert.match(app, /lg:whitespace-nowrap/);
  assert.match(app, /inline-flex items-center gap-2 whitespace-nowrap[^]*\$\{activeBadgeHtml\}[^]*\$\{modeBadgeHtml\}/);
  assert.match(app, /openRoundWorkspaceModal\('\$\{r\.id\}', 'timeline'\)/);
  assert.match(app, /openRoundWorkspaceModal\('\$\{r\.id\}', 'eligible-students'\)/);
  assert.match(app, /openRoundWorkspaceModal\('\$\{r\.id\}', 'registrations'\)/);
  assert.match(app, /openRoundWorkspaceModal\('\$\{r\.id\}', 'review', 'assigned'\)/);
  assert.match(app, /openRoundWorkspaceModal\('\$\{r\.id\}', 'scoring-dashboard'\)/);
  assert.match(app, /renderAdminRoundTimelinePreview\(r\)/);
  assert.match(app, /window\.openRoundWeekEditor = async function/);
  assert.match(app, /window\.toggleRoundTimelineWeekVisibility = async function/);
  assert.match(app, /Thêm \/ sửa mốc/);
  assert.match(app, /Kế hoạch \$\{weeks\.length\} tuần/);
  assert.match(app, /if \(cfg\.visible === false\) return/);
  assert.match(app, /visible: document\.getElementById\(`round-week-\$\{n\}-visible`\)\?\.checked !== false/);
  assert.match(app, /directAssignment \? '' : `<button[^`]+Xét nguyện vọng/s);
});

test('round workspace opens existing management panels in a focused popup', () => {
  assert.match(html, /id="modal-round-workspace"/);
  assert.match(html, /id="modal-round-workspace-body"/);
  assert.match(html, /id="modal-round-workspace"[^]*?max-w-6xl/);
  assert.doesNotMatch(html, /id="modal-round-workspace"[^]*?max-w-\[96rem\]/);
  assert.match(app, /window\.openRoundWorkspaceModal = async function/);
  assert.match(app, /body\.replaceChildren\(panel\)/);
  assert.match(app, /window\.closeRoundWorkspaceModal = function/);
});

test('supervisor cells expose assignment and replacement actions', () => {
  assert.match(app, /onclick="openAdminManualAssignModal\('\$\{mssv\}'\)"/);
  assert.match(app, /onclick="openAdminEditSupervisorModal\('\$\{mssv\}'\)"/);
  assert.match(app, /onclick="openAddSupportSupervisorModal\('\$\{mssv\}'\)"/);
  const editModalSource = app.match(/window\.openAdminEditSupervisorModal = function[\s\S]+?\n};/)?.[0] || '';
  assert.match(editModalSource, /if \(!row \|\| !reg\)/);
  assert.doesNotMatch(editModalSource, /!row\.isAssigned/);
  assert.match(html, /id="modal-admin-edit-supervisor" class="hidden fixed inset-0 z-\[80\]/);
  assert.match(html, /id="modal-admin-manual-assign" class="hidden fixed inset-0 z-\[80\]/);
  assert.match(html, /id="modal-add-support-supervisor" class="hidden fixed inset-0 z-\[80\]/);
});

test('milestones stay draft until individually published and empty rounds do not revive legacy data', () => {
  assert.match(app, /export function isActivityPublished/);
  assert.match(app, /publicationStatus: visibility \? 'published' : 'draft'/);
  assert.match(app, /newAct\.publicationStatus = 'draft'/);
  assert.match(app, /const willPublish = !isActivityPublished\(act\)/);
  assert.match(app, /📢 Công bố/);
  assert.match(app, /filter\(a => \(state\.isAdmin && !state\.impersonation\) \|\| isActivityPublished\(a\)\)/);
  assert.match(app, /const hasEmbeddedActivities = Array\.isArray\(targetRound\.activities\)/);
  assert.match(html, /Công bố ngay cho sinh viên/);
  assert.doesNotMatch(html, /id="activity-form-visibility" checked/);
});

test('all portals keep branded header and render assignment plus resilient countdown', () => {
  assert.match(app, /headerEl\.classList\.remove\('hidden'\)/);
  assert.doesNotMatch(app, /headerEl\.classList\.add\('hidden'\)/);
  assert.match(html, /id="round-mode-badge" class="hidden badge/);
  assert.match(app, /normalizeOfficialAssignment\(state\.myOfficialAssignment, state\.myRegistration\)/);
  assert.match(app, /typeof value\.toDate === 'function'/);
  assert.match(app, /round\.closeAtDate \|\| round\.closeAt \|\| round\.endDate \|\| round\.registrationCloseAt/);
});

test('supervisor portal integrates round selector in banner and hides secondary tabs', () => {
  assert.match(html, /id="supervisor-hero-card"[^]*?id="supervisor-round-select"/);
  assert.match(html, /id="supervisor-round-selector-toolbar"/);
  assert.doesNotMatch(html, /id="sup-hero-milestone-strip"/);
  assert.doesNotMatch(html, /id="hero-supervisor-profile-btn"/);
  assert.doesNotMatch(html, /id="sup-round-locked-badge"/);
  assert.doesNotMatch(html, /id="sup-tab-btn-preliminary"/);
  assert.doesNotMatch(html, /id="sup-tab-btn-reviewer"/);
  assert.match(html, /id="sup-tab-btn-review" [^>]*?class="[^"]*?hidden/);
  assert.match(html, /id="sup-tab-btn-accepted" [^>]*?class="[^"]*?hidden/);
  assert.match(app, /const isDirect = isDirectSupervisorAssignment\(round\)/);
  assert.match(app, /tabReviewBtn\.classList\.toggle\('hidden', isDirect\)/);
  assert.match(app, /tabAcceptedBtn\.classList\.toggle\('hidden', isDirect\)/);
  assert.match(app, /toolbar\.classList\.toggle\('hidden', filteredRounds\.length <= 1\)/);
  assert.match(app, /isDirect && \(k === 'review' \|\| k === 'accepted'\)/);
  assert.match(app, /if \(btnGotoStudent\) \{ btnGotoStudent\.classList\.add\('hidden'\)/);
  assert.match(app, /if \(btnGotoAssessment\) \{\s*btnGotoAssessment\.classList\.add\('hidden'\)/);
  assert.match(app, /const studentAvatarUrl = st\.photoURL \|\| studentObj\?\.photoURL \|\| studentObj\?\.avatar \|\| defaultAvatar/);
  assert.doesNotMatch(app, /defaultAvatar = 'data:image\/svg\+xml,<svg xmlns="http:/);
});

test('admin round cards hydrate assignment counts from official and draft sources', () => {
  assert.match(app, /collection\(db, 'graduationRounds', round\.id, 'officialAssignments'\)/);
  assert.match(app, /collection\(db, 'graduationRounds', round\.id, 'assignmentDrafts'\)/);
  assert.match(app, /round\.assignedCount = assignedStudentIds\.size/);
});

test('impersonation banner supports switching directly to another actor', () => {
  assert.match(html, /onclick="openAdminImpersonateModal\(\)"[^>]*>[\s\S]*?Đổi nhân vật/);
});

test('student hero banner displays supervisor card, collapses header gap, and renders 10-step journey', () => {
  assert.match(html, /id="hero-supervisor-info-card"/);
  assert.match(html, /id="hero-sup-card-avatar"/);
  assert.match(html, /id="hero-sup-card-name"/);
  assert.match(html, /id="hero-sup-card-email"/);
  assert.match(html, /id="hero-sup-card-phone"/);
  assert.match(html, /id="hero-supervisor-info-card" class="[^"]*lg:w-\[320px\][^"]*max-w-\[340px\]/);
  assert.match(html, /id="round-status-badge" class="hidden badge/);
  assert.match(html, /id="hero-student-state-badge" class="hidden badge/);
  assert.match(html, /id="round-time-range" class="hidden text-xs/);
  assert.match(html, /id="hero-student-profile-btn" class="hidden flex/);
  assert.match(css, /\.ifa-portal-nav:empty/);
  // Old 10-step stepper titles are now in updateStudentJourneyStepper (still present in app.js)
  assert.match(app, /title: 'Phân công GVHD'/);
  assert.match(app, /title: 'Đăng ký đề tài'/);
  assert.match(app, /title: 'Bảo vệ TN'/);
  assert.match(app, /title: 'Kết quả'/);
});

test('student hero banner displays topic, compact supervisor card, redundant card is hidden, and 12-week timeline renders', () => {
  // 1. Compact supervisor card on hero
  assert.match(html, /id="hero-supervisor-info-card"[^>]*min-w-\[280px\][^>]*lg:w-\[320px\]/);
  assert.match(html, /id="hero-sup-card-avatar"[^>]*w-12 h-12/);

  // 2. Topic on hero banner
  assert.match(html, /id="hero-registered-topic-wrap"/);
  assert.match(html, /id="hero-registered-topic-name"/);
  assert.match(html, /id="hero-registered-topic-meta"/);
  assert.match(app, /hero-registered-topic-wrap/);
  assert.match(app, /reg\?\.topicTitle \|\| reg\?\.topic/);

  // 3. Redundant supervisor card below is hidden
  assert.match(app, /renderStudentOfficialResult\(state\.myRegistration\);\s*if \(officialResultCard\) officialResultCard\.classList\.add\('hidden'\);/);
  assert.doesNotMatch(app, /renderStudentOfficialResult\(state\.myRegistration\);\s*if \(officialResultCard\) officialResultCard\.classList\.remove\('hidden'\);/);

  // 4. Unified card slider HTML structure
  assert.match(html, /id="student-timeline-weeks-card"/);
  assert.match(html, /id="timeline-weeks-dates-range"/);
  assert.match(html, /id="timeline-weeks-current-badge"/);
  assert.match(html, /id="timeline-weeks-grid"/);
  assert.match(html, /id="timeline-cards-track"/);
  assert.match(html, /id="timeline-track-step-indicator"/);
  assert.match(html, /id="round-form-start-date"/);
  assert.match(html, /id="round-form-duration-weeks"/);
  assert.match(html, /id="round-weekly-content-editor-wrap"/);
  assert.match(html, /id="round-weekly-content-grid"/);

  // 5. Card slider JS logic & milestone content
  assert.match(html, /id="timeline-weeks-prev-btn"/);
  assert.match(html, /id="timeline-weeks-next-btn"/);
  assert.match(app, /window\.prevTimelineWeek = function/);
  assert.match(app, /window\.nextTimelineWeek = function/);
  assert.match(app, /window\.onRoundStartDateChanged = function/);
  assert.match(app, /window\.renderStudentTimelineWeeks = function/);
  assert.match(app, /window\.resetWeeklyContentToDefault = function/);
  assert.match(app, /durationWeeks = parseInt\(round\?\.durationWeeks, 10\) \|\| 12/);
  assert.match(app, /timeline-cards-track/);
  assert.match(app, /state\.timelineTrackIndex/);
  assert.match(app, /4: 'Duyệt đợt 1'/);
  assert.match(app, /8: 'Duyệt đợt 2'/);
  assert.match(app, /12: 'Duyệt đợt 3'/);
  assert.match(app, /timelineWeeksConfig/);
  assert.match(app, /renderRoundWeeklyContentEditor/);
});

test('topic registration supports multi-type selection and supervisor title approval history', () => {
  assert.match(html, /id="project-types-checkbox-list"/);
  assert.match(html, /id="input-project-type-other"/);
  assert.match(app, /Mỗi đề tài được chọn tối đa 3 loại hình/);
  assert.match(app, /projectTypes\.map\(t => t === 'Khác'/);
  assert.match(app, /topicTitleVersion/);
  assert.match(app, /topicTitleHistory/);
  assert.match(app, /window\.reviewStudentTopicTitle = async function/);
  assert.match(app, /topicApprovalStatus: decision/);
  assert.match(app, /Đổi tên đề tài/);
});

test('direct assignment registration removes supervisor preference wording and hero reserves full title row', () => {
  assert.match(html, /id="round-title-display"[^>]*lg:whitespace-nowrap/);
  assert.match(html, /id="hero-supervisor-info-card"[^>]*lg:absolute[^>]*lg:top-0/);
  assert.match(html, /id="registration-cta-title"/);
  assert.match(html, /id="registration-cta-description"/);
  assert.match(app, /\? 'Đăng ký Đề tài'/);
  assert.match(app, /chọn từ 1 đến 3 loại hình đồ án trước khi xác nhận đăng ký/);
  assert.match(app, /selectionStep\.classList\.add\('hidden'\)/);
});

test('official topic form captures student-owned class data and unlocks PDF after supervisor approval', () => {
  assert.match(html, /id="registration-current-class"/);
  assert.match(html, /id="registration-student-phone"/);
  assert.match(html, /id="registration-student-permanent-address"/);
  assert.match(html, /id="registration-student-temporary-address"/);
  assert.doesNotMatch(html, /Họ tên và MSSV lấy từ dữ liệu Khoa/);
  assert.match(html, />Lớp <span class="text-rose-500">\*<\/span>/);
  assert.match(html, /id="registration-personal-email"/);
  assert.match(html, /<option value="Đồ án tốt nghiệp">Đồ án tốt nghiệp<\/option>/);
  assert.match(html, /<option value="Đồ án tổng hợp">Đồ án tổng hợp<\/option>/);
  assert.match(html, /id="input-topic-description"/);
  assert.match(html, /id="hero-download-topic-form-btn"/);
  assert.match(html, /pdfmake\.min\.js/);
  assert.match(app, /graduationStudentProfiles/);
  assert.match(app, /studentClass = state\.studentSelfProfile\?\.currentClass \|\| state\.myRegistration\?\.currentClass/);
  assert.match(app, /window\.downloadOfficialTopicRegistrationPdf = function/);
  assert.match(app, /reg\.topicApprovalStatus !== 'approved'/);
  assert.match(app, /PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC/);
  assert.match(app, /fullFieldRow\('EMAIL:', reg\.personalEmail\)/);
  assert.match(app, /fullFieldRow\('ĐỊA CHỈ TẠM TRÚ:', reg\.studentTemporaryAddress \|\| reg\.studentAddress\)/);
  assert.doesNotMatch(app, /text: value\(leftValue\), border: \[false, false, false, true\]/);
  assert.match(app, /fontSize: 18, alignment: 'center'/);
  assert.match(app, /programHeading, bold: true, fontSize: 16/);
  assert.match(app, /defaultStyle: \{ font: 'Roboto', fontSize: 12, lineHeight: 1 \}/);
  assert.match(app, /const descriptionDotLines = Array\.from/);
  assert.match(app, /text: 'Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN', bold: true, fontSize: 12/);
  assert.match(app, /text: 'NGƯỜI ĐĂNG KÝ', fontSize: 12/);
  assert.match(app, /text: identity\.fullName, bold: true/);
  assert.doesNotMatch(app, /Đã xác nhận tên đề tài trên hệ thống/);
});

test('supervisor topic preview modal and strict supervisor assignment scoping', () => {
  assert.match(html, /id="modal-supervisor-topic-preview"/);
  assert.match(html, /id="btn-topic-preview-approve"/);
  assert.match(html, /id="btn-topic-preview-reject"/);
  assert.match(app, /window\.openTopicRegistrationPreviewModal = function/);
  assert.match(app, /window\.closeTopicRegistrationPreviewModal = function/);
  assert.match(app, /const isAssignedToThisSupervisor = \(item\) =>/);
  assert.match(app, /openTopicRegistrationPreviewModal\('\${studentId}'\)/);
});

