/**
 * IFA+ Graduation — Test Data Reset Tool
 * 
 * Safely clears all documents in the local Firestore Emulator via the
 * emulator-only REST reset endpoint:
 * DELETE /emulator/v1/projects/{projectId}/databases/(default)/documents
 * 
 * Contains STRICT safety checks ensuring it NEVER runs against production.
 */

const { verifyEmulatorSafety } = require('./emulator-guard.cjs');
const http = require('http');

async function resetEmulatorData() {
  console.log('\n======================================================');
  console.log('🧹 IFA+ GRADUATION — LOCAL EMULATOR DATA RESET');
  console.log('======================================================');

  // 1. Strict safety check
  const guard = await verifyEmulatorSafety({ strictProjectCheck: true, pingCheck: true });
  console.log(`✓ Safety check passed. Connected to Emulator: ${guard.emulatorHost}`);
  console.log(`✓ Project ID: ${guard.projectId} (STRICTLY NON-PRODUCTION)\n`);

  // 2. Call emulator-only reset endpoint
  const [hostname, port] = guard.emulatorHost.split(':');
  const path = `/emulator/v1/projects/${guard.projectId}/databases/(default)/documents`;

  console.log(`Calling emulator reset endpoint at http://${guard.emulatorHost}${path}...`);

  await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: hostname || '127.0.0.1',
        port: parseInt(port || '8088', 10),
        path,
        method: 'DELETE',
        timeout: 5000
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Reset endpoint failed with status ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });

  console.log('✓ All local Firestore Emulator data cleared successfully.');
  console.log('======================================================\n');
}

if (require.main === module) {
  resetEmulatorData().catch(err => {
    console.error('\n❌ RESET FAILED:', err.message);
    process.exit(1);
  });
}

module.exports = { resetEmulatorData };
