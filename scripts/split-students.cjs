const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('js/students.js', 'utf8');
const lines = src.split('\n');

const outDir = path.join('js', 'students');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. registration.js: 0 to 774
const registration = lines.slice(0, 774).join('\n');
fs.writeFileSync(path.join(outDir, 'registration.js'), registration, 'utf8');

// 2. student-eligibility.js: 774 to 2069
const eligibility = lines.slice(774, 2069).join('\n');
fs.writeFileSync(path.join(outDir, 'student-eligibility.js'), eligibility, 'utf8');

// 3. students-master.js: 2069 to 2810
const master = lines.slice(2069, 2810).join('\n');
fs.writeFileSync(path.join(outDir, 'students-master.js'), master, 'utf8');

// 4. student-portal.js: 2810 to end
const portal = lines.slice(2810).join('\n');
fs.writeFileSync(path.join(outDir, 'student-portal.js'), portal, 'utf8');

// Aggregator in js/students.js
const agg = `/**
 * IFA+ Graduation — Students, Eligibility, IFAA Master & Registrations Subsystem
 * Aggregates all student submodules into a unified ES Module interface
 */
import './students/students-master.js';
import './students/student-eligibility.js';
import './students/registration.js';
import './students/student-portal.js';
`;
fs.writeFileSync('js/students.js', agg, 'utf8');

console.log('Successfully split js/students.js into 4 submodules.');
