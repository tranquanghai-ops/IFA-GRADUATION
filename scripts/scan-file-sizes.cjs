const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (['.git', 'node_modules', 'dist', 'build', '.system_generated', '.playwright-mcp'].includes(file)) continue;
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(full));
      } else {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const files = walk('.');
const stats = [];

for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  if (!['.js', '.cjs', '.mjs', '.html', '.css', '.rules'].includes(ext)) continue;
  if (f.endsWith('.zip') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.pdf')) continue;
  // ignore compiled index.html if we want to look at source, but let's include it for reference
  try {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n').length;
    stats.push({ file: f.replace(/\\/g, '/'), lines, ext });
  } catch (e) {}
}

stats.sort((a, b) => b.lines - a.lines);

console.log('=== TOÀN BỘ CÁC FILE CODE TRONG REPOSITORY (SẮP XẾP THEO SỐ DÒNG) ===\n');
stats.forEach((item, index) => {
  const isCompiled = item.file === 'index.html';
  const tag = item.lines > 1500 ? '🔴 [RẤT LỚN - CẦN TÁCH]' : (item.lines > 800 ? '🟡 [LỚN - NÊN TÁCH]' : '🟢 [GỌN GÀNG]');
  console.log(`${String(index + 1).padStart(2, ' ')}. ${item.file.padEnd(50)} : ${String(item.lines).padStart(6, ' ')} dòng  ${isCompiled ? '⚡ (File compiled tự động)' : tag}`);
});
