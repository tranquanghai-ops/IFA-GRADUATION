const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('js/grading.js', 'utf8');
const lines = src.split('\n');

const outDir = path.join('js', 'grading');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. councils.js: 1 to 1402
const councils = lines.slice(0, 1402).join('\n');
fs.writeFileSync(path.join(outDir, 'councils.js'), councils, 'utf8');

// 2. rubrics.js: 1402 to 3082
const rubrics = lines.slice(1402, 3082).join('\n');
fs.writeFileSync(path.join(outDir, 'rubrics.js'), rubrics, 'utf8');

// 3. preliminary-scores.js: 3082 to 4285
const preliminary = lines.slice(3082, 4285).join('\n');
fs.writeFileSync(path.join(outDir, 'preliminary-scores.js'), preliminary, 'utf8');

// 4. defense-scores.js: 4285 to 4888
const defense = lines.slice(4285, 4888).join('\n');
fs.writeFileSync(path.join(outDir, 'defense-scores.js'), defense, 'utf8');

// 5. final-scores.js: 4888 to 6301
const finalScores = lines.slice(4888, 6301).join('\n');
fs.writeFileSync(path.join(outDir, 'final-scores.js'), finalScores, 'utf8');

// 6. assessment-portal.js: 6301 to end
const assessment = lines.slice(6301).join('\n');
fs.writeFileSync(path.join(outDir, 'assessment-portal.js'), assessment, 'utf8');

// Update js/grading.js to be the ES Module aggregator
const gradingAggregator = `/**
 * IFA+ Graduation — Councils, Rubric Scoring & Assessment Subsystem
 * Aggregates all grading submodules into a unified ES Module interface
 */
import './grading/councils.js';
import './grading/rubrics.js';
import './grading/preliminary-scores.js';
import './grading/defense-scores.js';
import './grading/final-scores.js';
import './grading/assessment-portal.js';
`;
fs.writeFileSync('js/grading.js', gradingAggregator, 'utf8');

console.log('Successfully split js/grading.js into 6 submodules.');
