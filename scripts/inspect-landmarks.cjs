const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

console.log('=== VIEWS ===');
lines.forEach((l, i) => {
  if (l.includes('id="view-')) {
    console.log(`Line ${i + 1}: ${l.trim()}`);
  }
});

console.log('\n=== MODALS / DIALOGS / POPUPS ===');
lines.forEach((l, i) => {
  if (i >= 3000 && (l.includes('id="modal-') || l.includes('id="admin-modal-') || l.includes('-modal"') || l.includes('fixed inset-0')) && l.includes('<div')) {
    console.log(`Line ${i + 1}: ${l.trim().substring(0, 100)}`);
  }
});
