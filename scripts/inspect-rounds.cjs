const fs = require('fs');
const lines = fs.readFileSync('js/rounds.js', 'utf8').split('\n');

console.log('Total lines in js/rounds.js:', lines.length);
lines.forEach((l, i) => {
  if (l.includes('ROUND CONFIGURATION: 4 SECTIONS') || l.includes('ADMIN: PROJECT TYPES CRUD') || l.includes('PHASE 1: IFAA-STYLE ROUNDS MANAGEMENT')) {
    console.log(`Line ${i + 1}: ${l.trim()}`);
  }
});
