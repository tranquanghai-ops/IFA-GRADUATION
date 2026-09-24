const fs = require('fs');
const lines = fs.readFileSync('js/supervisors.js', 'utf8').split('\n');

console.log('Total lines:', lines.length);
const milestones = [
  'OFFICIAL SUPERVISORS HELPERS',
  'TAB C: SUPERVISORS HELPERS',
  'GVHD PHOTO PROCESSING',
  'PHASE 2A: ADMIN REVIEW MANAGEMENT MODULE',
  'ADMIN OFFICIAL & SUPPORT SUPERVISORS MANAGEMENT TABLE',
  'PHASE 3: SUPERVISOR PORTAL COMPLETE IMPLEMENTATION'
];

milestones.forEach(m => {
  lines.forEach((l, i) => {
    if (l.includes(m)) {
      console.log(`Line ${i + 1}: ${m}`);
    }
  });
});
