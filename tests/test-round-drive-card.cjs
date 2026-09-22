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
  assert.match(app, /navigateToRoundAction\('\$\{r\.id\}', 'timeline'\)/);
  assert.match(app, /directAssignment \? '' : `<button[^`]+Xét nguyện vọng/s);
});

