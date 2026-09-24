const fs = require('fs');

const content = fs.readFileSync('js/grading/rubrics.js', 'utf8');
const lines = content.split('\n');

// 1. rubrics-config.js: Lines 1 - 277
const configLines = [
  "/**\n * IFA+ Graduation — Rubric & Letter Criteria Configuration Submodule\n */",
  ...lines.slice(0, 277),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof toggleActivityScoringConfig !== 'undefined') window.toggleActivityScoringConfig = toggleActivityScoringConfig;
  if (typeof switchActivityScoringMode !== 'undefined') window.switchActivityScoringMode = switchActivityScoringMode;
  if (typeof renderActivityRubricList !== 'undefined') window.renderActivityRubricList = renderActivityRubricList;
  if (typeof openAddRubricCriterionModal !== 'undefined') window.openAddRubricCriterionModal = openAddRubricCriterionModal;
  if (typeof closeRubricCriterionModal !== 'undefined') window.closeRubricCriterionModal = closeRubricCriterionModal;
  if (typeof editRubricCriterion !== 'undefined') window.editRubricCriterion = editRubricCriterion;
  if (typeof deleteRubricCriterion !== 'undefined') window.deleteRubricCriterion = deleteRubricCriterion;
  if (typeof saveRubricCriterion !== 'undefined') window.saveRubricCriterion = saveRubricCriterion;
  if (typeof renderActivityLetterOptions !== 'undefined') window.renderActivityLetterOptions = renderActivityLetterOptions;
  if (typeof resetDefaultLetterOptions !== 'undefined') window.resetDefaultLetterOptions = resetDefaultLetterOptions;
  if (typeof openAddLetterOptionModal !== 'undefined') window.openAddLetterOptionModal = openAddLetterOptionModal;
  if (typeof closeLetterOptionModal !== 'undefined') window.closeLetterOptionModal = closeLetterOptionModal;
  if (typeof editLetterOption !== 'undefined') window.editLetterOption = editLetterOption;
  if (typeof deleteLetterOption !== 'undefined') window.deleteLetterOption = deleteLetterOption;
  if (typeof saveLetterOption !== 'undefined') window.saveLetterOption = saveLetterOption;
}
`
];
fs.writeFileSync('js/grading/rubrics-config.js', configLines.join('\n'), 'utf8');

// 2. rubrics-workspace.js: Lines 278 - 1013
const wsLines = [
  "/**\n * IFA+ Graduation — Council Live Workspace & Session Controls Submodule\n */",
  ...lines.slice(277, 1013),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof checkCouncilAuthorization !== 'undefined') window.checkCouncilAuthorization = checkCouncilAuthorization;
  if (typeof getRequiredScorers !== 'undefined') window.getRequiredScorers = getRequiredScorers;
  if (typeof getGuestScorers !== 'undefined') window.getGuestScorers = getGuestScorers;
  if (typeof openCouncilWorkspace !== 'undefined') window.openCouncilWorkspace = openCouncilWorkspace;
  if (typeof closeCouncilWorkspace !== 'undefined') window.closeCouncilWorkspace = closeCouncilWorkspace;
  if (typeof setupCouncilRealtimeSync !== 'undefined') window.setupCouncilRealtimeSync = setupCouncilRealtimeSync;
  if (typeof loadCouncilScores !== 'undefined') window.loadCouncilScores = loadCouncilScores;
  if (typeof renderCouncilWorkspaceFull !== 'undefined') window.renderCouncilWorkspaceFull = renderCouncilWorkspaceFull;
  if (typeof renderCouncilWorkspacePartialSync !== 'undefined') window.renderCouncilWorkspacePartialSync = renderCouncilWorkspacePartialSync;
  if (typeof renderCouncilStudentList !== 'undefined') window.renderCouncilStudentList = renderCouncilStudentList;
  if (typeof filterCouncilWorkspaceStudents !== 'undefined') window.filterCouncilWorkspaceStudents = filterCouncilWorkspaceStudents;
  if (typeof selectCouncilStudent !== 'undefined') window.selectCouncilStudent = selectCouncilStudent;
  if (typeof goToCurrentPresentingStudent !== 'undefined') window.goToCurrentPresentingStudent = goToCurrentPresentingStudent;
  if (typeof renderCouncilSelectedStudentDetails !== 'undefined') window.renderCouncilSelectedStudentDetails = renderCouncilSelectedStudentDetails;
  if (typeof formatStudentSupervisorsForDisplay !== 'undefined') window.formatStudentSupervisorsForDisplay = formatStudentSupervisorsForDisplay;
  if (typeof renderPresentingBanner !== 'undefined') window.renderPresentingBanner = renderPresentingBanner;
  if (typeof renderSecretaryControls !== 'undefined') window.renderSecretaryControls = renderSecretaryControls;
  if (typeof startStudentPresentation !== 'undefined') window.startStudentPresentation = startStudentPresentation;
  if (typeof finishStudentPresentation !== 'undefined') window.finishStudentPresentation = finishStudentPresentation;
  if (typeof resetStudentPresentation !== 'undefined') window.resetStudentPresentation = resetStudentPresentation;
  if (typeof startCouncilSession !== 'undefined') window.startCouncilSession = startCouncilSession;
  if (typeof endCouncilSession !== 'undefined') window.endCouncilSession = endCouncilSession;
}
`
];
fs.writeFileSync('js/grading/rubrics-workspace.js', wsLines.join('\n'), 'utf8');

// 3. rubrics-scoring.js: Lines 1014 - 1695
const scoringLines = [
  "/**\n * IFA+ Graduation — Council Live Scoring & Admin Monitor Submodule\n */",
  ...lines.slice(1013, 1695)
];
fs.writeFileSync('js/grading/rubrics-scoring.js', scoringLines.join('\n'), 'utf8');

// 4. Update index rubrics.js as master bridge
const indexRubricsCode = `/**
 * IFA+ Graduation — Rubrics & Council Live Scoring Master Bridge Module
 */
import './rubrics-config.js';
import './rubrics-workspace.js';
import './rubrics-scoring.js';

export * from './rubrics-config.js';
export * from './rubrics-workspace.js';
export * from './rubrics-scoring.js';
`;
fs.writeFileSync('js/grading/rubrics.js', indexRubricsCode, 'utf8');

console.log('Successfully split rubrics.js into 3 submodules in js/grading/!');
