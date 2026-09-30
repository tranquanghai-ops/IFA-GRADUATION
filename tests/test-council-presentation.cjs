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
  assert.match(styles, /#modal-council-workspace #cws-header-timer-container \{\s*grid-column: 1 \/ -1;\s*grid-row: 2;/);
  const studentSurface = workspace.split('function updateCouncilSelectedStudentSurface()')[1].split('function renderCouncilSelectedStudentDetails()')[0];
  assert.doesNotMatch(studentSurface, /\bisManager\b|\btimer\b/);
  assert.match(workspace.split('export function renderPresentationTimerUI()')[1], /timerPill\.disabled = !isManager/);
  assert.match(read('templates/modals/grading/modal-council-workspace.html'), /id="cws-header-timer-pill" onclick="toggleCouncilTimerSettings\(\)"/);
});

test('desktop council layout centers timer and gives student list more width', () => {
  const template = read('templates/modals/grading/modal-council-workspace.html');
  const styles = read('styles.css');
  assert.match(template, /id="cws-col-students" class="[^"]*lg:w-\[30rem\] xl:w-\[34rem\]/);
  assert.match(styles, /#modal-council-workspace \.cws-header-layout \{ display: grid;/);
  assert.match(styles, /#modal-council-workspace #cws-header-timer-container \{ grid-column: 1 \/ -1; grid-row: 2; justify-content: center;/);
});

test('completed student scores get a blue list card and readable grade', () => {
  const workspace = read('js/grading/rubrics-workspace.js');
  const styles = read('styles.css');
  assert.match(workspace, /scoreStatus = 'completed';/);
  assert.match(workspace, /data-score-status="\$\{scoreStatus\}"/);
  assert.match(workspace, /cws-list-score-badge[^`]*<strong>Điểm \$\{scoreText\}<\/strong><small>\(chính thức\)<\/small>/);
  assert.match(styles, /\.cws-student-list-card\[data-score-status="completed"\] \{ background-color: #eff6ff;/);
  assert.match(styles, /\.cws-list-score-badge strong \{ font-size: 13px; font-weight: 800;/);
  assert.ok(styles.indexOf('.cws-student-list-card[data-presentation-state="presenting"] { background-color: #ecfdf5;') > styles.indexOf('.cws-student-list-card[data-score-status="completed"]'));
});

test('all council members receive live presentation and timer updates without a reload', () => {
  const workspace = read('js/grading/rubrics-workspace.js');
  const rules = read('firestore.rules');
  assert.match(workspace, /activeCouncilLiveUnsubscribe = onSnapshot\(councilLiveDocRef/);
  assert.match(workspace, /applyCouncilLiveSnapshot\(round, activityId, councilId, state\.activeCouncilLiveSnapshot\)/);
  assert.match(workspace, /syncLiveTimerFromCouncil\(council\)/);
  assert.match(workspace, /renderCouncilWorkspacePartialSync\(\)/);
  assert.match(rules, /allow read: if admin\(\) \|\| staff\(\)[\s\S]*isCouncilMember\(resource\.data\.activityId, resource\.data\.councilId, email\(\)\)/);
  assert.match(rules, /allow update: if admin\(\) \|\| \(staff\(\)/);
});

test('letter scale has no A++ and caps A+ conversion at 9.5', () => {
  const config = read('js/planning/activities-manager.js');
  const scoring = read('js/grading/rubrics-scoring.js');
  assert.doesNotMatch(config.split('export const DEFAULT_LETTER_GRADE_SCALE = [')[1].split('];')[0], /key: 'A\+\+'/);
  assert.match(config, /key: 'A\+',\s+code: 'A\+',\s+label: 'Xuất sắc',\s+numericValue: 9\.5/);
  assert.match(config, /export function normalizeLetterGradeOptions/);
  assert.match(scoring, /const opts = normalizeLetterGradeOptions\(rawOpts\);/);
  assert.doesNotMatch(scoring, /appOpt/);
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

test('presentation controls stay in the header and are hidden from ordinary members', () => {
  const template = read('templates/modals/grading/modal-council-workspace.html');
  const workspace = read('js/grading/rubrics-workspace.js');
  const styles = read('styles.css');
  assert.ok(template.indexOf('id="cws-secretary-actions"') < template.indexOf('id="cws-mobile-tab-bar"'));
  assert.ok(template.indexOf('id="cws-header-timer-container"') < template.indexOf('id="cws-secretary-actions"'));
  assert.doesNotMatch(template, /Điều hành trình bày/);
  assert.match(workspace, /auth\?\.role === 'admin' \|\| \(!auth\?\.isSecretary && !auth\?\.isChair\)/);
  assert.match(styles, /\.cws-header-presentation:not\(\.hidden\) \{ display: flex;/);
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

test('guest council profiles are scoped and swipes work across grade buttons', () => {
  const editor = read('js/grading/councils-editor.js');
  const workspace = read('js/grading/rubrics-workspace.js');
  const template = read('templates/modals/grading/modal-council-workspace.html');
  assert.match(editor, /fullName: profile\.fullName/);
  assert.match(editor, /topicTitle: profile\.topicTitle/);
  assert.match(workspace, /councilStudentAssignments', `\$\{activityId\}_\$\{assignment\.studentId\}`/);
  assert.match(workspace, /profiles\.filter\(Boolean\)/);
  assert.match(template, /id="cws-student-score-card"[\s\S]*id="cws-scoring-section"/);
  assert.match(workspace, /e\.target\.closest\('input, textarea, select, label'\)/);
  assert.match(workspace, /if \(e\.target\.closest\('button'\)\) e\.preventDefault\(\)/);
});

test('direct council entry only reports success after authorization and shows a usable page on denial', () => {
  const auth = read('js/auth.js');
  const workspace = read('js/grading/rubrics-workspace.js');
  assert.match(auth, /if \(councilDirectOpenKey === openKey\) return/);
  assert.match(auth, /const opened = await window\.openCouncilWorkspace/);
  assert.match(auth, /if \(opened\) showToast/);
  assert.match(workspace, /document\.documentElement\.classList\.remove\('council-direct-entry'\)/);
});

test('guest score identity matches saved email and council slots are isolated', async () => {
  const { getCouncilMemberScorerId, getCouncilMemberSlots } = await import('../js/grading/council-score-helpers.js');
  const activity = { councilStructure: { slots: [{ key: 'chair', type: 'mandatory' }] } };
  const first = { memberSlots: [...activity.councilStructure.slots, { key: 'guest1', type: 'guest' }] };
  const second = { memberSlots: [...activity.councilStructure.slots, { key: 'guest2', type: 'guest' }, { key: 'guest3', type: 'guest' }] };
  assert.equal(getCouncilMemberScorerId({ type: 'guest', memberId: 'ext_foo', memberEmail: 'Foo@Example.com' }), 'foo@example.com');
  assert.equal(getCouncilMemberScorerId({ type: 'internal', memberId: 'staff-1', memberEmail: 'staff@tdtu.edu.vn' }), 'staff-1');
  assert.equal(getCouncilMemberSlots(first, activity).length, 2);
  assert.equal(getCouncilMemberSlots(second, activity).length, 3);
  assert.equal(activity.councilStructure.slots.length, 1);
  const editor = read('js/grading/councils-editor.js');
  assert.match(editor, /memberSlots: slots\.map\(slot => \(\{ \.\.\.slot \}\)\)/);
  assert.doesNotMatch(editor.split('window.quickAddCouncilMemberSlot')[1].split('window.quickRemoveCouncilMemberSlot')[0], /act\.councilStructure\.slots\.push/);
});

test('a completed student remains official after selection changes', () => {
  const workspace = read('js/grading/rubrics-workspace.js');
  const scoring = read('js/grading/rubrics-scoring.js');
  assert.match(workspace, /if \(savedScore\?\.status === 'completed'\) \{\s*delete state\.councilLocalDrafts\?\.\[oldSid\]/);
  assert.match(workspace, /if \(myScore\?\.status === 'completed'\)/);
  assert.match(scoring, /const isCompleted = savedScore\?\.status === 'completed';/);
  assert.match(scoring, /delete state\.councilLocalDrafts\[sid\];/);
});
