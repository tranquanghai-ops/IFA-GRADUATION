const fs = require('fs');

const content = fs.readFileSync('js/supervisors/assignments.js', 'utf8');
const lines = content.split('\n');

// 1. assignments-matching.js: Lines 1 - 1076
const matchingLines = [
  "/**\n * IFA+ Graduation — Supervisor Assignments & Preference Matching Submodule\n */",
  ...lines.slice(0, 1076),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof loadSupervisorReviewData !== 'undefined') window.loadSupervisorReviewData = loadSupervisorReviewData;
  if (typeof renderSupervisorReviewCards !== 'undefined') window.renderSupervisorReviewCards = renderSupervisorReviewCards;
  if (typeof acceptCandidate !== 'undefined') window.acceptCandidate = acceptCandidate;
  if (typeof rejectCandidate !== 'undefined') window.rejectCandidate = rejectCandidate;
  if (typeof undoCandidateDecision !== 'undefined') window.undoCandidateDecision = undoCandidateDecision;
  if (typeof submitSupervisorReviewBatch !== 'undefined') window.submitSupervisorReviewBatch = submitSupervisorReviewBatch;
}
`
];
fs.writeFileSync('js/supervisors/assignments-matching.js', matchingLines.join('\n'), 'utf8');

// 2. assignments-admin.js: Lines 1077 - 1957 + Lines 2534 - 2710
const adminPart1 = lines.slice(1076, 1957);
const adminPart2 = lines.slice(2533, 2710);

const adminLines = [
  "/**\n * IFA+ Graduation — Admin Manual Assignments & Support Supervisor Submodule\n */",
  ...adminPart1,
  ...adminPart2,
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderAdminReviewManagement !== 'undefined') window.renderAdminReviewManagement = renderAdminReviewManagement;
  if (typeof openAdminAssignModal !== 'undefined') window.openAdminAssignModal = openAdminAssignModal;
  if (typeof saveAdminManualAssignment !== 'undefined') window.saveAdminManualAssignment = saveAdminManualAssignment;
  if (typeof openAdminEditSupervisorAssignmentModal !== 'undefined') window.openAdminEditSupervisorAssignmentModal = openAdminEditSupervisorAssignmentModal;
  if (typeof saveAdminReassignedSupervisor !== 'undefined') window.saveAdminReassignedSupervisor = saveAdminReassignedSupervisor;
  if (typeof openAddSupportSupervisorModal !== 'undefined') window.openAddSupportSupervisorModal = openAddSupportSupervisorModal;
  if (typeof saveSupportSupervisor !== 'undefined') window.saveSupportSupervisor = saveSupportSupervisor;
  if (typeof publishRoundAssignments !== 'undefined') window.publishRoundAssignments = publishRoundAssignments;
}
`
];
fs.writeFileSync('js/supervisors/assignments-admin.js', adminLines.join('\n'), 'utf8');

// 3. assignments-excel.js: Lines 1958 - 2533
const excelPart = lines.slice(1957, 2533);
const excelLines = [
  "/**\n * IFA+ Graduation — Supervisor Assignment Excel Import/Export Submodule\n */",
  ...excelPart,
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof previewAssignmentExcel !== 'undefined') window.previewAssignmentExcel = previewAssignmentExcel;
  if (typeof applyAssignmentExcelBatch !== 'undefined') window.applyAssignmentExcelBatch = applyAssignmentExcelBatch;
  if (typeof exportAssignmentExcel !== 'undefined') window.exportAssignmentExcel = exportAssignmentExcel;
}
`
];
fs.writeFileSync('js/supervisors/assignments-excel.js', excelLines.join('\n'), 'utf8');

// 4. Update index assignments.js as an orchestrator / bridge
const indexAssignmentsCode = `/**
 * IFA+ Graduation — Supervisor Assignments Master Index & Bridge Module
 */
import './assignments-matching.js';
import './assignments-admin.js';
import './assignments-excel.js';

export * from './assignments-matching.js';
export * from './assignments-admin.js';
export * from './assignments-excel.js';
`;
fs.writeFileSync('js/supervisors/assignments.js', indexAssignmentsCode, 'utf8');

console.log('Successfully split assignments.js into 3 submodules!');
