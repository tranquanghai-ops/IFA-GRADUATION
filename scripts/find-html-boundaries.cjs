const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

console.log('HTML total lines:', lines.length);

// Find exact boundaries of sections
let studentStart = -1, studentEnd = -1;
let supervisorStart = -1, supervisorEnd = -1;
let assessmentStart = -1, assessmentEnd = -1;
let adminStart = -1, adminEnd = -1;
let modalsStart = -1;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('id="view-student"')) studentStart = i;
  if (l.includes('id="view-supervisor"')) { studentEnd = i; supervisorStart = i; }
  if (l.includes('id="view-assessment"')) { supervisorEnd = i; assessmentStart = i; }
  if (l.includes('id="view-admin"')) { assessmentEnd = i; adminStart = i; }
  if (l.includes('id="modal-round"')) { adminEnd = i; modalsStart = i; }
}

console.log('student:', studentStart + 1, 'to', studentEnd);
console.log('supervisor:', supervisorStart + 1, 'to', supervisorEnd);
console.log('assessment:', assessmentStart + 1, 'to', assessmentEnd);
console.log('admin:', adminStart + 1, 'to', adminEnd);
console.log('modalsStart:', modalsStart + 1);
