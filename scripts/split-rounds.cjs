const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('js/rounds.js', 'utf8');
const lines = src.split('\n');

const outDir = path.join('js', 'rounds');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. rounds-dashboard.js: 0 to 706 AND 2190 to end
const dashboardPart1 = lines.slice(0, 706).join('\n');
const dashboardPart2 = lines.slice(2190).join('\n');
const dashboard = dashboardPart1 + '\n\n' + dashboardPart2;
fs.writeFileSync(path.join(outDir, 'rounds-dashboard.js'), dashboard, 'utf8');

// 2. rounds-config.js: 706 to 2028
const config = lines.slice(706, 2028).join('\n');
fs.writeFileSync(path.join(outDir, 'rounds-config.js'), config, 'utf8');

// 3. project-types.js: 2028 to 2190
const projectTypes = lines.slice(2028, 2190).join('\n');
fs.writeFileSync(path.join(outDir, 'project-types.js'), projectTypes, 'utf8');

// Aggregator in js/rounds.js
const agg = `/**
 * IFA+ Graduation — Rounds Management Subsystem
 * Aggregates all rounds submodules into a unified ES Module interface
 */
import './rounds/rounds-dashboard.js';
import './rounds/rounds-config.js';
import './rounds/project-types.js';
`;
fs.writeFileSync('js/rounds.js', agg, 'utf8');

console.log('Successfully split js/rounds.js into 3 submodules.');
