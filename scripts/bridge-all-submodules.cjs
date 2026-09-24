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
  
  // Find all top-level declared functions:
  // "async function foo(" or "function foo("
  // "export function foo(" or "export async function foo("
  const fnRegex = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g;
  const declaredFns = new Set();
  let match;
  while ((match = fnRegex.exec(content)) !== null) {
    const fnName = match[1];
    if (fnName && !fnName.startsWith('_')) {
      declaredFns.add(fnName);
    }
  }

  // Find all "const / let / var X = ..." or "export const / let / var X = ..."
  const varRegex = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/g;
  while ((match = varRegex.exec(content)) !== null) {
    const varName = match[1];
    if (varName && !varName.startsWith('_')) {
      declaredFns.add(varName);
    }
  }

  if (declaredFns.size === 0) return;

  // Check if there is already a window bridge section at the bottom
  const bridgeMarker = '// --- SUBMODULE WINDOW BRIDGE ---';
  let baseContent = content;
  if (baseContent.includes(bridgeMarker)) {
    baseContent = baseContent.substring(0, baseContent.indexOf(bridgeMarker)).trimEnd();
  }

  const bridgeAssignments = Array.from(declaredFns)
    .map(fn => `  if (typeof ${fn} !== 'undefined') window.${fn} = ${fn};`)
    .join('\n');

  const newContent = `${baseContent}\n\n${bridgeMarker}\nif (typeof window !== 'undefined') {\n${bridgeAssignments}\n}\n`;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`[Bridge] Bridged ${declaredFns.size} symbols in ${filePath}`);
});
