const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('js/supervisors.js', 'utf8');
const lines = src.split('\n');

const outDir = path.join('js', 'supervisors');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Let's create the 4 submodules:
// 1. assignments.js: lines 1 to 1075 AND lines 2264 to 3820
const assignmentsPart1 = lines.slice(0, 1075).join('\n');
const assignmentsPart2 = lines.slice(2263, 3820).join('\n');
const assignments = assignmentsPart1 + '\n\n' + assignmentsPart2;
fs.writeFileSync(path.join(outDir, 'assignments.js'), assignments, 'utf8');

// 2. supervisor-quotas.js: lines 1075 to 1345
const quotas = lines.slice(1075, 1345).join('\n');
fs.writeFileSync(path.join(outDir, 'supervisor-quotas.js'), quotas, 'utf8');

// 3. supervisors-master.js: lines 1345 to 2263
const master = lines.slice(1345, 2263).join('\n');
fs.writeFileSync(path.join(outDir, 'supervisors-master.js'), master, 'utf8');

// 4. supervisor-portal.js: lines 3820 to end
const portal = lines.slice(3820).join('\n');
fs.writeFileSync(path.join(outDir, 'supervisor-portal.js'), portal, 'utf8');

// Update js/supervisors.js to aggregate
const agg = `/**
 * IFA+ Graduation — Supervisors Master, Reviews & Assignments Subsystem
 * Aggregates all supervisor submodules into a unified ES Module interface
 */
import './supervisors/supervisors-master.js';
import './supervisors/supervisor-quotas.js';
import './supervisors/assignments.js';
import './supervisors/supervisor-portal.js';
`;
fs.writeFileSync('js/supervisors.js', agg, 'utf8');

console.log('Successfully split js/supervisors.js into 4 submodules.');
