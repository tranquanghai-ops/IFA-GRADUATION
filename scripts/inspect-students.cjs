const fs = require('fs');
const lines = fs.readFileSync('js/students.js', 'utf8').split('\n');

console.log('Total lines in js/students.js:', lines.length);
lines.forEach((l, i) => {
  if (l.includes('printOfficialRegistrationForm') || l.includes('TAB B: ELIGIBLE STUDENTS') || l.includes('IFAA FACULTY STUDENT MASTER') || l.includes('PHASE 2: STUDENT PORTAL ENHANCEMENTS')) {
    console.log(`Line ${i + 1}: ${l.trim()}`);
  }
});
