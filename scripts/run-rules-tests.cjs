const { spawnSync } = require('child_process');

const testFiles = [
  'tests/test-mandatory-three-preferences.rules.test.mjs',
  'tests/firestore-owner-admin-rbac.rules.test.mjs',
  'tests/firestore-official-assignments.rules.test.mjs',
  'tests/firestore-council-live.rules.test.mjs',
  'tests/test-progress-review-security-audit.rules.test.mjs',
  'tests/test-firestore-security-hardening.rules.test.mjs',
  'tests/test-round-self-join.rules.test.mjs',
  'tests/test-visiting-supervisor-access.rules.test.mjs'
];

console.log(`[Rules Test Runner] Running ${testFiles.length} Firestore rules test suites...`);
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 0);
