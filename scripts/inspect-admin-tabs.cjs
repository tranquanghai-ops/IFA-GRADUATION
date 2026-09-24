const fs = require('fs');
const content = fs.readFileSync('views/admin.html', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('id="tab-') || line.includes('id="admin-') || line.includes('<section') || line.includes('class="tab-pane') || line.includes('<!--')) {
    console.log(String(index + 1).padStart(5, ' '), line.trim());
  }
});
