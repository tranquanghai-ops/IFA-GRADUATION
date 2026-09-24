const fs = require('fs');
let code = fs.readFileSync('js/students/student-portal.js', 'utf8');

const target1 = 'function renderSupervisorRoundTimeline(round) {\r\n  const container = document.getElementById(\'supervisor-round-timeline\');\r\n  if (!container) return;';
const target1Alt = 'function renderSupervisorRoundTimeline(round) {\n  const container = document.getElementById(\'supervisor-round-timeline\');\n  if (!container) return;';

const rep1 = `function renderSupervisorRoundTimeline(round) {
  const container = document.getElementById('supervisor-round-timeline');
  if (!container) return;
  if (typeof renderUnifiedRoundTimeline === 'function') {
    const html = renderUnifiedRoundTimeline(round, { role: 'supervisor' });
    container.innerHTML = html;
    container.classList.toggle('hidden', !html);
    return;
  }`;

if (code.includes('function renderSupervisorRoundTimeline(round) {')) {
  code = code.replace(/function renderSupervisorRoundTimeline\(round\)\s*\{\s*const container = document\.getElementById\('supervisor-round-timeline'\);\s*if \(!container\) return;/, rep1);
}

const rep2 = `function renderSupervisorPlanList(round) {
  const section = document.getElementById('supervisor-plan-section');
  const container = document.getElementById('supervisor-plan-list');
  if (!section || !container) return;
  section.classList.remove('hidden');
  if (typeof renderUnifiedPlanList === 'function') {
    renderUnifiedPlanList(round, { role: 'supervisor', container, prefix: 'sup' });
    return;
  }`;

if (code.includes('function renderSupervisorPlanList(round) {')) {
  code = code.replace(/function renderSupervisorPlanList\(round\)\s*\{\s*const section = document\.getElementById\('supervisor-plan-section'\);\s*const container = document\.getElementById\('supervisor-plan-list'\);\s*if \(!section \|\| !container\) return;\s*section\.classList\.remove\('hidden'\);/, rep2);
}

fs.writeFileSync('js/students/student-portal.js', code, 'utf8');
console.log('student-portal.js patched successfully!');
