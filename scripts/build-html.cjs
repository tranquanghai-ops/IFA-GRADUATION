/**
 * IFA+ Graduation HTML Partials Builder
 * Compiles index.template.html and views / modal partials into index.html
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const templatePath = path.join(root, 'index.template.html');
const outputPath = path.join(root, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error(`Template not found at: ${templatePath}`);
  process.exit(1);
}

let template = fs.readFileSync(templatePath, 'utf8');

// Replace all <!-- PARTIAL:path/to/file.html --> with file contents recursively
const partialRegex = /<!--\s*PARTIAL:([^\s]+)\s*-->/g;
let matchCount = 0;

let compiled = template;
let hasMatches = true;
let depth = 0;
while (hasMatches && depth < 10) {
  depth++;
  hasMatches = false;
  compiled = compiled.replace(partialRegex, (match, partialRelPath) => {
    hasMatches = true;
    const fullPath = path.join(root, partialRelPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`Missing partial file: ${fullPath}`);
      process.exit(1);
    }
    matchCount++;
    return fs.readFileSync(fullPath, 'utf8');
  });
}

fs.writeFileSync(outputPath, compiled, 'utf8');
console.log(`[HTML Builder] Successfully compiled index.html with ${matchCount} partials included.`);
