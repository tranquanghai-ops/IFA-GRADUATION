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
  assert.doesNotMatch(html, /id="sup-hero-milestone-strip"/);
  assert.match(html, /id="sup-tab-btn-review" [^>]*?class="[^"]*?hidden/);
  assert.match(html, /id="sup-tab-btn-accepted" [^>]*?class="[^"]*?hidden/);
  assert.match(app, /const studentAvatarUrl = st\.photoURL \|\| studentObj\?\.photoURL \|\| studentObj\?\.avatar \|\| defaultAvatar/);
  assert.doesNotMatch(app, /defaultAvatar = 'data:image\/svg\+xml,<svg xmlns="http:/);
});

test('student hero banner displays supervisor card, collapses header gap, and renders 10-step journey', () => {
  assert.match(html, /id="hero-supervisor-info-card"/);
  assert.match(html, /id="hero-sup-card-avatar"/);
  assert.match(html, /id="hero-sup-card-name"/);
  assert.match(html, /id="hero-sup-card-email"/);
  assert.match(html, /id="hero-sup-card-phone"/);
  assert.match(html, /id="round-status-badge" class="hidden badge/);
  assert.match(html, /id="hero-student-state-badge" class="hidden badge/);
  assert.match(html, /id="round-time-range" class="hidden text-xs/);
  assert.match(html, /id="hero-student-profile-btn" class="hidden flex/);
  assert.match(css, /\.ifa-portal-nav:empty/);
  assert.match(html, /grid-cols-2 sm:grid-cols-5 lg:grid-cols-10/);
  assert.match(app, /title: 'Phân công GVHD'/);
  assert.match(app, /title: 'Đăng ký đề tài'/);
  assert.match(app, /title: 'Duyệt đợt 1'/);
  assert.match(app, /title: 'Duyệt Đợt 2'/);
  assert.match(app, /title: 'Duyệt Đợt 3'/);
  assert.match(app, /title: 'Kiểm tra đạo văn'/);
  assert.match(app, /title: 'Nộp Thuyết minh'/);
  assert.match(app, /title: 'Nộp Sơ Khảo'/);
  assert.match(app, /title: 'Bảo vệ TN'/);
  assert.match(app, /title: 'Kết quả'/);
});

test('student hero banner displays topic, supervisor card is widened, redundant card is hidden, and 12-week timeline renders', () => {
  // 1. Widened supervisor card on hero
  assert.match(html, /id="hero-supervisor-info-card"[^>]*min-w-\[320px\]/);
  assert.match(html, /id="hero-sup-card-avatar"[^>]*w-14 h-14/);

  // 2. Topic on hero banner
  assert.match(html, /id="hero-registered-topic-wrap"/);
  assert.match(html, /id="hero-registered-topic-name"/);
  assert.match(html, /id="hero-registered-topic-meta"/);
  assert.match(app, /hero-registered-topic-wrap/);
  assert.match(app, /reg\?\.topicTitle \|\| reg\?\.topic/);

  // 3. Redundant supervisor card below is hidden
  assert.match(app, /renderStudentOfficialResult\(state\.myRegistration\);\s*if \(officialResultCard\) officialResultCard\.classList\.add\('hidden'\);/);
  assert.doesNotMatch(app, /renderStudentOfficialResult\(state\.myRegistration\);\s*if \(officialResultCard\) officialResultCard\.classList\.remove\('hidden'\);/);

  // 4. 12-week timeline UI & settings
  assert.match(html, /id="student-timeline-weeks-card"/);
  assert.match(html, /id="timeline-weeks-dates-range"/);
  assert.match(html, /id="timeline-weeks-current-badge"/);
  assert.match(html, /id="timeline-weeks-grid"/);
  assert.match(html, /id="round-form-start-date"/);
  assert.match(html, /id="round-form-duration-weeks"/);

  // 5. 12-week timeline JS logic
  assert.match(app, /window\.onRoundStartDateChanged = function/);
  assert.match(app, /window\.renderStudentTimelineWeeks = function/);
  assert.match(app, /durationWeeks = parseInt\(round\?\.durationWeeks, 10\) \|\| 12/);
  assert.match(app, /timeline-weeks-grid/);
});
