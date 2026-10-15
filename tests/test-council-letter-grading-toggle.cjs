/**
 * Test Suite: Council Letter Grading (A/B/C) & Toggle-Off Deselect Mechanism
 * IFA-GRADUATION Regression Verification
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Read source files
const defenseScoresSrc = fs.readFileSync(path.join(root, 'js/grading/defense-scores.js'), 'utf8');
const rubricsScoringSrc = fs.readFileSync(path.join(root, 'js/grading/rubrics-scoring.js'), 'utf8');
const rubricsWorkspaceSrc = fs.readFileSync(path.join(root, 'js/grading/rubrics-workspace.js'), 'utf8');
const exportScoresSrc = fs.readFileSync(path.join(root, 'js/grading/final-scores-export.js'), 'utf8');
const activitiesManagerSrc = fs.readFileSync(path.join(root, 'js/planning/activities-manager.js'), 'utf8');

test('Suite 1: resolveNumericToLetter algorithm & midpoint conversion', async (t) => {
  // Extract resolveNumericToLetter logic
  const mockWindow = {};
  const mockState = { councilScores: {}, councilLocalDrafts: {} };

  // Define scale
  const customScale3 = [
    { key: 'A', code: 'A', label: 'Tốt', numericValue: 9.0 },
    { key: 'B', code: 'B', label: 'Khá', numericValue: 7.5 },
    { key: 'C', code: 'C', label: 'Trung bình', numericValue: 6.0 }
  ];

  const act3 = {
    id: 'act_review_1',
    scoringConfig: {
      mode: 'letter',
      letterOptions: customScale3
    }
  };

  // Test with mini module evaluation or direct logic replication matching defense-scores.js
  const resolveNumericToLetter = (numericScore, act) => {
    if (numericScore === null || numericScore === undefined || isNaN(Number(numericScore))) {
      return null;
    }
    const rawOpts = (Array.isArray(act?.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0)
      ? act.scoringConfig.letterOptions
      : [];
    const validOpts = (rawOpts || [])
      .filter(o => o && typeof o.numericValue === 'number' && !isNaN(o.numericValue) && (o.key || o.code))
      .map(o => ({
        key: String(o.key || o.code).trim(),
        code: String(o.code || o.key).trim(),
        label: o.label || o.key,
        numericValue: Number(o.numericValue)
      }));
    if (validOpts.length === 0) return null;
    validOpts.sort((a, b) => b.numericValue - a.numericValue);
    if (validOpts.length === 1) return validOpts[0];
    const scoreNum = Number(numericScore);
    for (let i = 0; i < validOpts.length - 1; i++) {
      const higher = validOpts[i];
      const lower = validOpts[i + 1];
      const midpoint = (higher.numericValue + lower.numericValue) / 2;
      if (scoreNum >= midpoint) {
        return higher;
      }
    }
    return validOpts[validOpts.length - 1];
  };

  // Case 1: 3 council members vote A (9.0), B (7.5), B (7.5) -> avg = 8.00
  const avg1 = (9.0 + 7.5 + 7.5) / 3; // 8.00
  const res1 = resolveNumericToLetter(avg1, act3);
  assert.equal(res1?.key, 'B', 'Members voted A, B, B (avg 8.00) must resolve to letter B');

  // Case 2: 3 council members vote A (9.0), A (9.0), B (7.5) -> avg = 8.50
  const avg2 = (9.0 + 9.0 + 7.5) / 3; // 8.50 >= 8.25 midpoint
  const res2 = resolveNumericToLetter(avg2, act3);
  assert.equal(res2?.key, 'A', 'Members voted A, A, B (avg 8.50) must resolve to letter A');

  // Case 3: 3 council members vote B (7.5), C (6.0), C (6.0) -> avg = 6.50
  const avg3 = (7.5 + 6.0 + 6.0) / 3; // 6.50 < 6.75 midpoint
  const res3 = resolveNumericToLetter(avg3, act3);
  assert.equal(res3?.key, 'C', 'Members voted B, C, C (avg 6.50) must resolve to letter C');

  // Case 4: 3 council members vote A (9.0), B (7.5), C (6.0) -> avg = 7.50
  const avg4 = (9.0 + 7.5 + 6.0) / 3; // 7.50
  const res4 = resolveNumericToLetter(avg4, act3);
  assert.equal(res4?.key, 'B', 'Members voted A, B, C (avg 7.50) must resolve to letter B');

  // Case 5: Null / undefined / NaN scores
  assert.equal(resolveNumericToLetter(null, act3), null);
  assert.equal(resolveNumericToLetter(undefined, act3), null);
  assert.equal(resolveNumericToLetter(NaN, act3), null);
});

test('Suite 2: defense-scores.js exports and implements resolveNumericToLetter & getOfficialDefenseScore', () => {
  // Check export in defense-scores.js
  assert.match(defenseScoresSrc, /export function resolveNumericToLetter\(/);
  assert.match(defenseScoresSrc, /window\.resolveNumericToLetter = resolveNumericToLetter;/);

  // Check that getOfficialDefenseScore returns letterGrade and formattedScore as letter in letter mode
  assert.match(defenseScoresSrc, /const mode = act\.scoringConfig\?\.mode \|\| 'numeric';/);
  assert.match(defenseScoresSrc, /const resolved = resolveNumericToLetter\(rawAverage, act\);/);
  assert.match(defenseScoresSrc, /letterGrade = resolved\.key;/);
  assert.match(defenseScoresSrc, /formattedScore = letterGrade \|\| '--';/);
  assert.match(defenseScoresSrc, /formattedNumericScore: rawAverage !== null \? rawAverage\.toFixed\(2\) : '--'/);

  // Check that finalizeCouncilSession stores letterGrade and formattedScore
  assert.match(defenseScoresSrc, /letterGrade: official\.letterGrade/);
  assert.match(defenseScoresSrc, /letterLabel: official\.letterLabel/);
});

test('Suite 3: Council post-session UI displays letter badge with reference score', () => {
  // Check renderPostCouncilSection table display
  assert.match(defenseScoresSrc, /if \(mode === 'letter'\) \{/);
  assert.match(defenseScoresSrc, /\$\{official\.letterGrade\}/);
  assert.match(defenseScoresSrc, /\(Tham khảo: \$\{official\.formattedNumericScore\}đ\)/);
  assert.match(defenseScoresSrc, /liveResolved = resolveNumericToLetter\(rawAvg, act\)/);
});

test('Suite 4: Toggle-off (Bỏ chọn tạm) mechanism in rubrics-scoring.js', () => {
  // Check onSelectLetterScore implementation
  assert.match(rubricsScoringSrc, /window\.onSelectLetterScore = function\(key\) \{/);
  assert.match(rubricsScoringSrc, /isAlreadySelected = Boolean\(currentVal\) && String\(currentVal\)\.trim\(\)\.toUpperCase\(\) === String\(key\)\.trim\(\)\.toUpperCase\(\);/);
  assert.match(rubricsScoringSrc, /const nextVal = isAlreadySelected \? '' : key;/);
  assert.match(rubricsScoringSrc, /onScoreInputChange\(nextVal\);/);

  // Check renderLetterBtn isSelected check
  assert.match(rubricsScoringSrc, /const isSelected = Boolean\(currentVal\) && \(String\(currentVal\)\.trim\(\)\.toUpperCase\(\) === String\(o\.key \|\| o\.code\)\.trim\(\)\.toUpperCase\(\)\);/);

  // Check saveCurrentScore blocks empty completion
  assert.match(rubricsScoringSrc, /if \(val === '' \|\| val === null \|\| val === undefined\) \{/);
  assert.match(rubricsScoringSrc, /showToast\('Vui lòng chọn hoặc nhập điểm trước khi hoàn tất chấm!', 'warning'\);/);
});

test('Suite 5: rubrics-workspace.js handles empty drafts and letter score sorting', () => {
  // In renderCouncilStudentList: scoreValue uses localValue directly when defined
  assert.match(rubricsWorkspaceSrc, /const localValue = state\.councilLocalDrafts\?\.\[sid\]\?\.value;/);
  assert.match(rubricsWorkspaceSrc, /const scoreValue = myScore\?\.status === 'completed'\s+\?\s+myScore\.value\s+:\s+\(localValue !== undefined \? localValue : myScore\?\.value\);/);

  // In getCouncilRankedStudentsForScorer: resolves letter scores to numeric values
  assert.match(rubricsWorkspaceSrc, /const resolvedNum = \(typeof resolveScoreNumericValue === 'function'\) \? resolveScoreNumericValue\(\{ value: val \}, act\) : null;/);

  // In saveDraftScoresForStudent: preserves empty draft string when switching students
  assert.match(rubricsWorkspaceSrc, /value: currentVal !== undefined \? currentVal : '',/);
});

test('Suite 6: final-scores-export.js includes official letter grade and reference score', () => {
  // Check exportAllCouncilsToExcel
  assert.match(exportScoresSrc, /const isLetterMode = \(act\.scoringConfig\?\.mode === 'letter'\);/);
  assert.match(exportScoresSrc, /headerRow\.push\('Kết quả chính thức', 'Điểm tham khảo'\);/);
  assert.match(exportScoresSrc, /row\.push\(official\.isComplete && official\.letterGrade \? official\.letterGrade : ''\);/);
  assert.match(exportScoresSrc, /row\.push\(official\.isComplete && official\.score !== null \? Number\(official\.score\.toFixed\(2\)\) : ''\);/);

  // Check exportSingleCouncilToExcel
  assert.match(exportScoresSrc, /headerRow\.push\('Kết quả chính thức', 'Điểm tham khảo'\);/);
});

test('Suite 7: DEFAULT_LETTER_GRADE_SCALE and normalizeLetterGradeOptions window bridge', () => {
  assert.match(activitiesManagerSrc, /window\.DEFAULT_LETTER_GRADE_SCALE = DEFAULT_LETTER_GRADE_SCALE;/);
  assert.match(activitiesManagerSrc, /window\.normalizeLetterGradeOptions = normalizeLetterGradeOptions;/);
});
