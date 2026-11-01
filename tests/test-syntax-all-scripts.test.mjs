import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('TEST SUITE: ALL JS FILES SYNTAX INTEGRITY (NO DUPLICATE DECLARATIONS / PARSE ERRORS)', async (t) => {
  const jsDir = path.join(root, 'js');
  const errors = [];

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        if (f !== 'node_modules' && f !== '.git') walk(p);
      } else if (f.endsWith('.js')) {
        try {
          execSync(`node --check "${p}"`, { stdio: 'pipe' });
        } catch (err) {
          errors.push({
            file: path.relative(root, p),
            error: err.stderr.toString()
          });
        }
      }
    }
  }

  walk(jsDir);

  await t.test('All JS files in js/ must pass node --check without any SyntaxError', () => {
    if (errors.length > 0) {
      const details = errors.map(e => `${e.file}:\n${e.error}`).join('\n');
      assert.fail(`Syntax errors detected in ${errors.length} file(s):\n${details}`);
    }
    assert.equal(errors.length, 0);
  });
});
