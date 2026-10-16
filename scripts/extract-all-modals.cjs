const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git') files = files.concat(walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const all = walk('.').filter(f => f.endsWith('.html') || f.endsWith('.js'));
const results = [];

for (const f of all) {
  const norm = f.replace(/\\/g, '/');
  if (norm.startsWith('tests/') || norm.startsWith('backups/') || norm === 'index.html') continue;
  const content = fs.readFileSync(f, 'utf8');
  
  // 1. Matches <tag ... class="...fixed inset-0..." ...>
  const regex = /<([a-z0-9]+)[^>]*class=["']([^"']*fixed\s+inset-0[^"']*)["'][^>]*>/gi;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const tag = m[0];
    const idMatch = tag.match(/id=["']([^"']+)["']/i);
    const id = idMatch ? idMatch[1] : '(no-id)';
    // Ignore app-loading-overlay as it's the splash screen
    if (id === 'app-loading-overlay') continue;
    results.push({ id, file: norm, classAttr: m[2], fullTag: tag });
  }

  // 2. Matches dynamically created overlays in JS (e.g., overlay.className = 'fixed inset-0...')
  const jsRegex = /(?:overlay|dialog|modal|container)\.className\s*=\s*['"]([^'"]*fixed\s+inset-0[^'"]*)['"]/gi;
  let jm;
  while ((jm = jsRegex.exec(content)) !== null) {
    // Find preceding or succeeding id assignment
    const snippet = content.slice(Math.max(0, jm.index - 200), Math.min(content.length, jm.index + 300));
    const dynIdMatch = snippet.match(/\.id\s*=\s*['"]([^'"]+)['"]/);
    const id = dynIdMatch ? dynIdMatch[1] : 'dynamic-dialog-' + path.basename(norm, '.js');
    results.push({ id, file: norm, classAttr: jm[1], fullTag: 'JS Dynamic' });
  }
}

// Deduplicate by ID and file
const uniqueModals = [];
const seen = new Set();
for (const r of results) {
  const key = `${r.id}::${r.file}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueModals.push(r);
  }
}

console.log(`Total modal/overlay elements discovered: ${uniqueModals.length}`);
uniqueModals.forEach((r, i) => console.log(`${i+1}. [${r.id}] in ${r.file}`));

fs.writeFileSync('scripts/all-modals-catalog.json', JSON.stringify(uniqueModals, null, 2), 'utf8');
