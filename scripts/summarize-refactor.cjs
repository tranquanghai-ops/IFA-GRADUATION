const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else {
      results.push(full);
    }
  });
  return results;
}

const folders = ['js', 'views', 'templates'];
const allFiles = [];
folders.forEach(f => {
  if (fs.existsSync(f)) {
    allFiles.push(...getFiles(f));
  }
});

const stats = allFiles.map(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n').length;
  const kb = (fs.statSync(f).size / 1024).toFixed(1);
  return { path: f.replace(/\\/g, '/'), lines, kb };
});

stats.sort((a, b) => b.lines - a.lines);
console.log('=== REFACTORED FILE STATISTICS ===');
stats.forEach(s => {
  console.log(`${s.lines.toString().padStart(5, ' ')} lines | ${s.kb.padStart(6, ' ')} KB | ${s.path}`);
});
