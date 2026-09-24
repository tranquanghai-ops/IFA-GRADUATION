const fs = require('fs');
const path = require('path');

function getJsFiles(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(getJsFiles(full));
    } else if (item.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = getJsFiles('js');

allFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove legacy bridge if present
  const legacyMarker = '// Global window bridges for cross-module accessibility';
  if (content.includes(legacyMarker)) {
    content = content.substring(0, content.indexOf(legacyMarker)).trimEnd();
  }

  // Remove submodule window bridge if present
  const bridgeMarker = '// --- SUBMODULE WINDOW BRIDGE ---';
  if (content.includes(bridgeMarker)) {
    content = content.substring(0, content.indexOf(bridgeMarker)).trimEnd();
  }

  // Find all top-level declared functions
  const fnRegex = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g;
  const declaredFns = new Set();
  let match;
  while ((match = fnRegex.exec(content)) !== null) {
    const fnName = match[1];
    if (fnName && !fnName.startsWith('_')) {
      declaredFns.add(fnName);
    }
  }

  // Find all "const / let / var X = ..."
  const varRegex = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/g;
  while ((match = varRegex.exec(content)) !== null) {
    const varName = match[1];
    if (varName && !varName.startsWith('_')) {
      declaredFns.add(varName);
    }
  }

  if (declaredFns.size > 0) {
    const bridgeAssignments = Array.from(declaredFns)
      .map(fn => `  if (typeof ${fn} !== 'undefined') window.${fn} = ${fn};`)
      .join('\n');
    content = `${content}\n\n${bridgeMarker}\nif (typeof window !== 'undefined') {\n${bridgeAssignments}\n}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned & bridged ${filePath}`);
});
