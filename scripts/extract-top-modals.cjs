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

const allFiles = walk('.');
const modalEntries = [];

// 1. Scan templates/modals/**/*.html
const modalDir = path.resolve('templates/modals');
const templateFiles = walk(modalDir).filter(f => f.endsWith('.html'));

for (const f of templateFiles) {
  const relPath = path.relative('.', f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf8');

  // Find top-level container: typically <div id="modal-..." class="...fixed inset-0...">
  const topMatches = [...content.matchAll(/<([a-z0-9]+)[^>]*id=["']([^"']+)["'][^>]*class=["']([^"']*(?:fixed inset-0|modal-backdrop)[^"']*)["'][^>]*>/gi)];
  
  if (topMatches.length > 0) {
    for (const tm of topMatches) {
      const modalId = tm[2];
      const outerTag = tm[1];
      const outerClasses = tm[3];
      
      // Find the inner card container immediately inside or within 500 chars
      const afterTop = content.slice(content.indexOf(tm[0]) + tm[0].length);
      const innerMatch = afterTop.match(/<div[^>]*class=["']([^"']*(?:bg-white|rounded|shadow|w-)[^"']*)["'][^>]*>/i);
      const innerClasses = innerMatch ? innerMatch[1] : '';

      // Find modal title
      const titleMatch = content.match(/<(h[1-6]|span|div)[^>]*id=["'][^"']*title[^"']*["'][^>]*>(.*?)<\/\1>/i) ||
                         content.match(/<(h[1-6])[^>]*class=["'][^"']*(?:font-bold|font-semibold)[^"']*["'][^>]*>(.*?)<\/\1>/i);
      const title = titleMatch ? titleMatch[2].replace(/<[^>]+>/g, '').trim() : '';

      modalEntries.push({
        id: modalId,
        file: relPath,
        title,
        outerClasses,
        innerClasses
      });
    }
  } else {
    // Check if there is another structure with id="modal-..."
    const altMatches = [...content.matchAll(/<([a-z0-9]+)[^>]*id=["'](modal-[a-zA-Z0-9_-]+)["'][^>]*class=["']([^"']+)["'][^>]*>/gi)];
    for (const am of altMatches) {
      const modalId = am[2];
      const afterTop = content.slice(content.indexOf(am[0]) + am[0].length);
      const innerMatch = afterTop.match(/<div[^>]*class=["']([^"']*(?:bg-white|rounded|shadow|w-)[^"']*)["'][^>]*>/i);
      modalEntries.push({
        id: modalId,
        file: relPath,
        title: '',
        outerClasses: am[3],
        innerClasses: innerMatch ? innerMatch[1] : ''
      });
    }
  }
}

// 2. Scan index.template.html and views for any modals not in templates/modals
const otherFiles = walk('views').concat(['index.template.html']);
for (const f of otherFiles) {
  if (!fs.existsSync(f)) continue;
  const relPath = path.relative('.', f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf8');

  const topMatches = [...content.matchAll(/<([a-z0-9]+)[^>]*id=["'](modal-[a-zA-Z0-9_-]+)["'][^>]*class=["']([^"']*(?:fixed inset-0|modal-backdrop)[^"']*)["'][^>]*>/gi)];
  for (const tm of topMatches) {
    if (!modalEntries.some(m => m.id === tm[2])) {
      const afterTop = content.slice(content.indexOf(tm[0]) + tm[0].length);
      const innerMatch = afterTop.match(/<div[^>]*class=["']([^"']*(?:bg-white|rounded|shadow|w-)[^"']*)["'][^>]*>/i);
      modalEntries.push({
        id: tm[2],
        file: relPath,
        title: '',
        outerClasses: tm[3],
        innerClasses: innerMatch ? innerMatch[1] : ''
      });
    }
  }
}

// 3. Scan JS files for dynamically generated modals (e.g. innerHTML = `...fixed inset-0...` or createElement)
const jsFiles = walk('js').filter(f => f.endsWith('.js'));
for (const f of jsFiles) {
  const relPath = path.relative('.', f).replace(/\\/g, '/');
  const content = fs.readFileSync(f, 'utf8');

  const dynMatches = [...content.matchAll(/id=["'](modal-[a-zA-Z0-9_-]+)["'][^>]*class=["']([^"']*(?:fixed inset-0|modal-backdrop)[^"']*)["']/gi)];
  for (const dm of dynMatches) {
    if (!modalEntries.some(m => m.id === dm[1])) {
      modalEntries.push({
        id: dm[1],
        file: relPath,
        title: 'Dynamic in JS',
        outerClasses: dm[2],
        innerClasses: 'Dynamic'
      });
    }
  }
}

console.log(`FOUND ${modalEntries.length} TOP-LEVEL MODALS.`);
console.table(modalEntries.map((m, idx) => ({
  '#': idx + 1,
  id: m.id,
  file: m.file,
  title: m.title.slice(0, 30),
  innerClasses: m.innerClasses.slice(0, 50)
})));

fs.writeFileSync('scripts/parsed-top-modals.json', JSON.stringify(modalEntries, null, 2), 'utf8');
