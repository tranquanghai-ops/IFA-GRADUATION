const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

let scriptLines = 0;
let styleLines = 0;
let inScript = false;
let inStyle = false;

lines.forEach(l => {
  if (l.includes('<script')) inScript = true;
  if (inScript) scriptLines++;
  if (l.includes('</script>')) inScript = false;

  if (l.includes('<style')) inStyle = true;
  if (inStyle) styleLines++;
  if (l.includes('</style>')) inStyle = false;
});

console.log('Total HTML lines:', lines.length);
console.log('Inline script tag lines:', scriptLines);
console.log('Inline style tag lines:', styleLines);

// Find major section containers
const sections = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('id="view-') || line.includes('id="modal-') || line.includes('-modal"') || line.includes('<!-- ===')) {
    sections.push({ line: i + 1, text: line.trim() });
  }
}
console.log('Major views and modal landmarks in index.html:');
sections.slice(0, 30).forEach(s => console.log(`Line ${s.line}: ${s.text}`));
