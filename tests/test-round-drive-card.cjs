const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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
});
