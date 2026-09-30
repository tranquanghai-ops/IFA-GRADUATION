const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('next student closes the presenting turn and skips already presented students', async () => {
  const { getNextCouncilPresentation } = await import('../js/grading/council-presentation-state.js');
  const assignments = [
    { councilId: 'hd-1', studentId: 's3', order: 3, presentationStatus: 'waiting' },
    { councilId: 'hd-1', studentId: 's1', order: 1, presentationStatus: 'presenting' },
    { councilId: 'hd-1', studentId: 's2', order: 2, presentationStatus: 'presented' },
    { councilId: 'hd-2', studentId: 'other', order: 2, presentationStatus: 'waiting' }
  ];
  const transition = getNextCouncilPresentation(assignments, 'hd-1');
  assert.equal(transition.current.studentId, 's1');
  assert.equal(transition.next.studentId, 's3');
  assert.equal(getNextCouncilPresentation(assignments, 'hd-2').current, null);
  assignments[0].presentationStatus = 'presented';
  assert.equal(getNextCouncilPresentation(assignments, 'hd-1').next, null);
});

test('council controls match member roles and keep ending at the bottom', () => {
  const workspace = read('js/grading/rubrics-workspace.js');
  const template = read('templates/modals/grading/modal-council-workspace.html');
  assert.match(workspace, /const showEnd = mayEnd &&/);
  assert.match(workspace, /if \(!auth\.isAdmin && !auth\.isChair\)/);
  assert.ok(template.indexOf('id="cws-end-session-footer"') > template.indexOf('id="cws-scoring-section"'));
  assert.match(template, /Kết thúc hội đồng/);
  assert.match(template, /id="cws-presentation-student-select"/);
  assert.match(workspace, /onclick="advanceCouncilPresentation\(\)"/);
});

test('score completion waits for a durable write and streams decisions to chair', () => {
  const scoring = read('js/grading/rubrics-scoring.js');
  const workspace = read('js/grading/rubrics-workspace.js');
  assert.match(scoring, /await setDoc\(decRef, scoreRecord, \{ merge: true \}\);/);
  assert.match(scoring, /new window\.FieldPath\('councilScores', scoreKey\)/);
  assert.match(workspace, /activeCouncilScoresUnsubscribe = onSnapshot\(scoreQuery/);
  assert.match(workspace, /resolveCouncilScorerId\(council, auth\)/);
  assert.match(workspace, /state\.councilScores = \{ \.\.\.updatedData\.councilScores, \.\.\.\(state\.councilScores \|\| \{\}\) \};/);
});

test('timer offers two adjustable increments and ten repeating alert patterns', () => {
  const workspace = read('js/grading/rubrics-workspace.js');
  const template = read('templates/modals/grading/modal-council-workspace.html');
  assert.match(template, /id="cws-timer-short-add-btn"/);
  assert.match(template, /id="cws-timer-long-add-btn"/);
  assert.equal((template.match(/<option value="(?:[1-9]|10)">/g) || []).length, 10);
  assert.match(workspace, /councilAlarmInterval = setInterval/);
  assert.match(workspace, /selected\.presentationStatus !== 'presenting'/);
});

test('mobile council header keeps member identity and timer on separate rows', () => {
  const styles = read('styles.css');
  const workspace = read('js/grading/rubrics-workspace.js');
  assert.match(styles, /#modal-council-workspace \.cws-header-layout \{\s*display: grid;/);
  assert.match(styles, /#cws-header-timer-container \{\s*grid-column: 1 \/ -1;\s*grid-row: 2;/);
  const studentSurface = workspace.split('function updateCouncilSelectedStudentSurface()')[1].split('function renderCouncilSelectedStudentDetails()')[0];
  assert.doesNotMatch(studentSurface, /\bisManager\b|\btimer\b/);
  assert.match(workspace.split('export function renderPresentationTimerUI()')[1], /timerPill\.disabled = !isManager/);
  assert.match(read('templates/modals/grading/modal-council-workspace.html'), /id="cws-header-timer-pill" onclick="toggleCouncilTimerSettings\(\)"/);
});

test('mobile council presentation shows student identity and focused completion actions', () => {
  const workspace = read('js/grading/rubrics-workspace.js');
  const scoring = read('js/grading/rubrics-scoring.js');
  const template = read('templates/modals/grading/modal-council-workspace.html');
  assert.doesNotMatch(template, /DANH SÁCH BÁO CÁO/);
  assert.match(workspace, /Đề tài: \$\{escapeHtml\(sTopic\)\}/);
  assert.match(workspace, /option\.textContent = `#\$\{a\.order \|\| '\?'\} · \$\{profile\?/);
  assert.match(scoring, /Hoàn tất chấm SV này/);
  assert.doesNotMatch(scoring, /Hệ thống tự động lưu nháp khi chọn\/nhập/);
});

test('council edits refresh live authorization indexes and revoke removed members', () => {
  const editor = read('js/grading/councils-editor.js');
  const workspace = read('js/grading/rubrics-workspace.js');
  assert.match(editor, /const expectedMembers = new Map\(\)/);
  assert.match(editor, /currentMembers\.docs\.filter\(snapshot => !expectedMembers\.has\(snapshot\.id\)\)/);
  assert.match(editor, /const expectedStudents = new Map\(\)/);
  assert.match(editor, /currentStudents\.docs\.filter\(snapshot => !expectedStudents\.has\(snapshot\.id\)\)/);
  assert.match(workspace, /\(!state\.isAdmin && !state\.realIsAdmin\)/);
});
