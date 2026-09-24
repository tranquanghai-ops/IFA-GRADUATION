const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'app.bak.js'), 'utf8');
const lines = code.split('\n');

function getLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const jsDir = path.join(root, 'js');
if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

// 1. core.js
// Lines 484-518 are the Firebase imports. We put them at the top of core.js.
const firebaseImports = getLines(484, 518);
const corePart1 = getLines(1, 64);
const corePart2 = getLines(263, 483);
const corePart3 = getLines(519, 623);
const corePart4 = getLines(624, 678);
const corePart5 = getLines(679, 775);
const corePart6 = getLines(776, 796);

const coreHeader = `/**
 * IFA+ Graduation — Core Module
 * Services, State, Formatters, Audit Guards & UI Primitives
 */
`;

const coreFirebaseWindowBridge = `
// Expose Firebase SDK primitives globally for module interoperability
window.initializeApp = initializeApp;
window.getApps = getApps;
window.getApp = getApp;
window.getStorage = getStorage;
window.storageRef = storageRef;
window.storageGetBytes = storageGetBytes;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
window.deleteObject = deleteObject;
window.getAuth = getAuth;
window.onAuthStateChanged = onAuthStateChanged;
window.signInWithPopup = signInWithPopup;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signOut = signOut;
window.getFirestore = getFirestore;
window.collection = collection;
window.doc = doc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.serverTimestamp = serverTimestamp;
window.onSnapshot = onSnapshot;
window.rawAddDoc = rawAddDoc;
window.rawSetDoc = rawSetDoc;
window.rawUpdateDoc = rawUpdateDoc;
window.rawDeleteDoc = rawDeleteDoc;
window.rawWriteBatch = rawWriteBatch;
window.rawRunTransaction = rawRunTransaction;
`;

const coreFooter = `
// Expose core utilities to global window
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.fmt24h = fmt24h;
window.fmtDateRange24h = fmtDateRange24h;
window.DEFAULT_PROJECT_TYPES = DEFAULT_PROJECT_TYPES;
window.initFirebase = initFirebase;
window.unsubscribeSettings = null;

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'auth', { get: () => auth, set: (v) => { auth = v; }, configurable: true });
  Object.defineProperty(window, 'db', { get: () => db, set: (v) => { db = v; }, configurable: true });
  Object.defineProperty(window, 'app', { get: () => app, set: (v) => { app = v; }, configurable: true });
  Object.defineProperty(window, 'storage', { get: () => storage, set: (v) => { storage = v; }, configurable: true });
}
`;

const coreContent = [
  coreHeader,
  firebaseImports,
  coreFirebaseWindowBridge,
  corePart1,
  corePart2,
  corePart3,
  corePart4,
  corePart5,
  corePart6,
  coreFooter
].join('\n\n');

fs.writeFileSync(path.join(jsDir, 'core.js'), coreContent, 'utf8');
console.log('Created js/core.js (' + coreContent.split('\n').length + ' lines)');

// 2. auth.js
const authHeader = `/**
 * IFA+ Graduation — Authentication & Roles Module
 */
const showLoading = window.showLoading;
const hideLoading = window.hideLoading;
`;
const authContent = authHeader + [
  getLines(797, 1204),
  getLines(1205, 1366),
  getLines(1367, 1483),
  getLines(10076, 10110)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'auth.js'), authContent, 'utf8');
console.log('Created js/auth.js (' + authContent.split('\n').length + ' lines)');

// 3. impersonation.js
const impersonationContent = `/**
 * IFA+ Graduation — Exact Act-As Impersonation Test Mode Module
 */
` + [
  getLines(8870, 8937),
  getLines(8938, 10034)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'impersonation.js'), impersonationContent, 'utf8');
console.log('Created js/impersonation.js (' + impersonationContent.split('\n').length + ' lines)');

// 4. planning.js
const planningContent = `/**
 * IFA+ Graduation — Planning, Milestones & Unified Timeline Module
 */
` + getLines(10864, 12797);
fs.writeFileSync(path.join(jsDir, 'planning.js'), planningContent, 'utf8');
console.log('Created js/planning.js (' + planningContent.split('\n').length + ' lines)');

// 5. drive.js
const driveContent = `/**
 * IFA+ Graduation — Google Drive & Student Submissions Module
 */
` + [
  getLines(5458, 5856),
  getLines(19651, 21182),
  getLines(21286, 21386)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'drive.js'), driveContent, 'utf8');
console.log('Created js/drive.js (' + driveContent.split('\n').length + ' lines)');

// 6. rounds.js
const roundsContent = `/**
 * IFA+ Graduation — Rounds Management Module
 */
` + [
  getLines(1484, 1983),
  getLines(3624, 3749),
  getLines(3750, 4750),
  getLines(5454, 5457),
  getLines(5857, 6245),
  getLines(7746, 7850),
  getLines(21387, 21440),
  getLines(21528, 22343)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'rounds.js'), roundsContent, 'utf8');
console.log('Created js/rounds.js (' + roundsContent.split('\n').length + ' lines)');

// 7. students.js
const studentsContent = `/**
 * IFA+ Graduation — Students, Eligibility & IFAA Master Module
 */
` + [
  getLines(1984, 2410),
  getLines(2669, 3010),
  getLines(4751, 5310),
  getLines(7287, 7745),
  getLines(7851, 8056),
  getLines(8057, 8108),
  getLines(10111, 10863),
  getLines(22344, 23750)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'students.js'), studentsContent, 'utf8');
console.log('Created js/students.js (' + studentsContent.split('\n').length + ' lines)');

// 8. supervisors.js
const supervisorsContent = `/**
 * IFA+ Graduation — Supervisors Master, Reviews & Assignments Module
 */
` + [
  getLines(65, 262),
  getLines(2411, 2668),
  getLines(3011, 3623),
  getLines(5311, 5453),
  getLines(6246, 7104),
  getLines(7105, 7286),
  getLines(8109, 8869),
  getLines(10035, 10075),
  getLines(12798, 13549),
  getLines(23751, 24953)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'supervisors.js'), supervisorsContent, 'utf8');
console.log('Created js/supervisors.js (' + supervisorsContent.split('\n').length + ' lines)');

// 9. grading.js
const gradingContent = `/**
 * IFA+ Graduation — Councils, Rubric Scoring & Assessment Portal Module
 */
` + [
  getLines(13550, 14947),
  getLines(14948, 16626),
  getLines(16627, 17828),
  getLines(17829, 18430),
  getLines(18431, 19650),
  getLines(21183, 21285),
  getLines(21441, 21527),
  getLines(24954, 25945)
].join('\n\n');
fs.writeFileSync(path.join(jsDir, 'grading.js'), gradingContent, 'utf8');
console.log('Created js/grading.js (' + gradingContent.split('\n').length + ' lines)');

// 10. ui.js
const uiContent = `/**
 * IFA+ Graduation — UI Helpers & Modal Layers Module
 */
export function initUIHelpers() {
  if (typeof window !== 'undefined') {
    console.log('[IFA Graduation] UI helpers ready');
  }
}
window.initUIHelpers = initUIHelpers;
`;
fs.writeFileSync(path.join(jsDir, 'ui.js'), uiContent, 'utf8');
console.log('Created js/ui.js (' + uiContent.split('\n').length + ' lines)');

// 11. app.js
const appContent = `/**
 * IFA+ Graduation — Khoa Mỹ thuật Công nghiệp (ĐH Tôn Đức Thắng)
 * Orchestrator Entry Point (ES Modules)
 */

// 1. Core Services, State & Utilities
import './js/core.js';

// 2. UI Components & Dialogs
import './js/ui.js';

// 3. Exact Act-As Impersonation Test Mode
import './js/impersonation.js';

// 4. Authentication, Roles & View Routing
import './js/auth.js';

// 5. Google Drive Provisioning & Submissions
import './js/drive.js';

// 6. Graduation Rounds Management
import './js/rounds.js';

// 7. Milestones, Unified Cards & Timeline Planning
import './js/planning.js';

// 8. Students, Eligibility, IFAA Master & Registrations
import './js/students.js';

// 9. Supervisors Master, Review Workflow & Assignment Matrix
import './js/supervisors.js';

// 10. Councils, Rubric Scoring, Defense & Final Assessment
import './js/grading.js';

// Bootstrap Notice
if (typeof window !== 'undefined') {
  console.log('[IFA Graduation] Modular architecture initialized successfully.');
}
`;
fs.writeFileSync(path.join(root, 'app.js'), appContent, 'utf8');
console.log('Updated app.js (' + appContent.split('\n').length + ' lines)');

// Post-processing: Attach all top-level functions and constants to window for 100% interoperability
const moduleFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
moduleFiles.forEach(file => {
  const filePath = path.join(jsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g)];
  const fnNames = new Set(matches.map(m => m[1]));
  const alreadyOnWindow = new Set();
  for (const m of content.matchAll(/window\.([a-zA-Z0-9_]+)\s*=/g)) {
    alreadyOnWindow.add(m[1]);
  }
  const toAttach = [];
  for (const fn of fnNames) {
    if (!alreadyOnWindow.has(fn)) {
      toAttach.push(fn);
    }
  }
  if (toAttach.length > 0) {
    const bridgeCode = `\n// Global window bridges for cross-module accessibility\n` +
      toAttach.map(fn => `window.${fn} = ${fn};`).join('\n') + '\n';
    content += bridgeCode;
    fs.writeFileSync(filePath, content, 'utf8');
  }
});

// Explicit cross-module constants
fs.appendFileSync(path.join(jsDir, 'planning.js'), '\nwindow.ACTIVITY_TYPES = ACTIVITY_TYPES;\nwindow.DEFAULT_LETTER_GRADE_SCALE = DEFAULT_LETTER_GRADE_SCALE;\n');
fs.appendFileSync(path.join(jsDir, 'supervisors.js'), '\nwindow.SAMPLE_SUPERVISORS = SAMPLE_SUPERVISORS;\n');
fs.appendFileSync(path.join(jsDir, 'students.js'), '\nwindow.IFAA_FIREBASE_CONFIG = IFAA_FIREBASE_CONFIG;\nwindow.DEFAULT_IFAA_DATASET_URL = DEFAULT_IFAA_DATASET_URL;\nwindow.BACKUP_IFAA_DATASET_URL = BACKUP_IFAA_DATASET_URL;\nwindow.FACULTY_MAJORS = FACULTY_MAJORS;\n');
console.log('Attached cross-module window bridges and constants.');

