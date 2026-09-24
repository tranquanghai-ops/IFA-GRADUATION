const fs = require('fs');

const lines = fs.readFileSync('index.html', 'utf8').split('\n');

const modalTags = [];
for (let i = 3263; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('<div id="modal-') || l.includes('<div id="admin-modal-')) {
    modalTags.push({ line: i + 1, text: l.trim() });
  }
}

modalTags.forEach(m => console.log(`Line ${m.line}: ${m.text}`));
console.log('Total modals found:', modalTags.length);
