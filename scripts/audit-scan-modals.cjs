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
const modalMap = new Map();

for (const f of allFiles) {
  const normPath = f.replace(/\\/g, '/');
  if (!normPath.endsWith('.html') && !normPath.endsWith('.js') && !normPath.endsWith('.cjs')) continue;
  if (normPath.startsWith('tests/') || normPath.startsWith('backups/') || normPath === 'index.html') continue;
  
  const content = fs.readFileSync(f, 'utf8');

  // 1. Matches id="modal-..."
  const idMatches = [...content.matchAll(/id=["'](modal-[a-zA-Z0-9_-]+)["']/g)];
  for (const m of idMatches) {
    const id = m[1];
    if (!modalMap.has(id)) modalMap.set(id, { id, sourceFiles: new Set(), dynamic: false, triggers: new Set(), currentClasses: '', currentStyles: '' });
    modalMap.get(id).sourceFiles.add(normPath);
  }

  // 2. Matches role="dialog" or class="...fixed inset-0..."
  const dialogMatches = [...content.matchAll(/<(div|section|aside)[^>]*id=["']([^"']+)["'][^>]*role=["']dialog["']/g)];
  for (const m of dialogMatches) {
    const id = m[2];
    if (!modalMap.has(id)) modalMap.set(id, { id, sourceFiles: new Set(), dynamic: false, triggers: new Set(), currentClasses: '', currentStyles: '' });
    modalMap.get(id).sourceFiles.add(normPath);
  }
}

// Also scan JS files for dynamic modal creation or open modal functions: openModal('...'), showModal('...'), etc.
for (const f of allFiles) {
  const normPath = f.replace(/\\/g, '/');
  if (!normPath.endsWith('.js')) continue;
  if (normPath.startsWith('tests/') || normPath.startsWith('backups/')) continue;
  
  const content = fs.readFileSync(f, 'utf8');
  for (const [id, entry] of modalMap.entries()) {
    if (content.includes(`'${id}'`) || content.includes(`"${id}"`) || content.includes(`\`${id}\``)) {
      entry.triggers.add(normPath);
    }
  }

  // Check for dynamic modals created entirely in JS (e.g., createElement, Swal, custom alert/dialog)
  const dynamicMatches = [...content.matchAll(/(createModal|showCustomModal|openDynamicModal|showConfirmDialog|showPromptDialog)\s*\(([^)]*)\)/g)];
  for (const dm of dynamicMatches) {
    const name = dm[1] + (dm[2] ? ` (${dm[2].slice(0, 30)})` : '');
    // record if interesting
  }
}

// For each modal, extract inner container max-width / width classes
for (const [id, entry] of modalMap.entries()) {
  for (const sf of entry.sourceFiles) {
    if (sf.endsWith('.html')) {
      const content = fs.readFileSync(sf, 'utf8');
      const idx = content.indexOf(`id="${id}"`) !== -1 ? content.indexOf(`id="${id}"`) : content.indexOf(`id='${id}'`);
      if (idx !== -1) {
        // extract the chunk around id and its child card/container
        const snippet = content.slice(idx, idx + 800);
        const classMatches = snippet.match(/class=["']([^"']+)["']/g);
        const styleMatches = snippet.match(/style=["']([^"']+)["']/g);
        entry.currentClasses = classMatches ? classMatches.slice(0, 3).join(' | ') : '';
        entry.currentStyles = styleMatches ? styleMatches.slice(0, 2).join(' | ') : '';
      }
    }
  }
}

console.log('='.repeat(80));
console.log(`TOTAL MODALS DETECTED: ${modalMap.size}`);
console.log('='.repeat(80));

const results = [];
for (const [id, entry] of modalMap.entries()) {
  results.push({
    id,
    sources: Array.from(entry.sourceFiles).join(', '),
    triggerCount: entry.triggers.size,
    classesSnippet: entry.currentClasses.slice(0, 70),
    stylesSnippet: entry.currentStyles.slice(0, 50)
  });
}

console.table(results);

fs.writeFileSync('scripts/detected-modals.json', JSON.stringify(Array.from(modalMap.entries()).map(([k, v]) => ({
  id: k,
  sourceFiles: Array.from(v.sourceFiles),
  triggers: Array.from(v.triggers),
  currentClasses: v.currentClasses,
  currentStyles: v.currentStyles
})), null, 2));
console.log('Saved to scripts/detected-modals.json');
