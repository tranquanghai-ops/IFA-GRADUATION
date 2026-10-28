/**
 * IFA+ Graduation — Emulator Safety Guard
 * 
 * Strict safety enforcement to ensure seed, reset, and workflow tests
 * NEVER communicate with or mutate Firestore Production.
 */

const http = require('http');

const SAFE_EMULATOR_PROJECT_IDS = new Set([
  'tknt-tdtu-test',
  'ifa-graduation-emulator',
  'demo-ifa-graduation'
]);

const DEFAULT_EMULATOR_HOST = '127.0.0.1:8088';
const DEFAULT_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

/**
 * Pings the emulator REST endpoint to verify it is responsive
 */
function pingEmulator(host) {
  return new Promise((resolve) => {
    const [hostname, port] = host.split(':');
    const req = http.request(
      {
        hostname: hostname || '127.0.0.1',
        port: parseInt(port || '8088', 10),
        path: '/',
        method: 'GET',
        timeout: 1500
      },
      (res) => {
        resolve(res.statusCode < 500);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Validates and locks the environment strictly to the local emulator
 */
async function verifyEmulatorSafety({ strictProjectCheck = true, pingCheck = true } = {}) {
  const host = process.env.FIRESTORE_EMULATOR_HOST || DEFAULT_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = host;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || DEFAULT_AUTH_EMULATOR_HOST;

  // 1. Check for missing host
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      '[CRITICAL SAFETY VIOLATION] FIRESTORE_EMULATOR_HOST is missing! ' +
      'Refusing to run seed/reset without an active Firestore Emulator.'
    );
  }

  // 2. Prevent accidental Production project pointer
  const project = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'tknt-tdtu-test';
  if (strictProjectCheck && !SAFE_EMULATOR_PROJECT_IDS.has(project)) {
    if (project === 'ifa-graduation') {
      throw new Error(
        `[CRITICAL SAFETY VIOLATION] Detected Production Project ID "${project}"! ` +
        'Local seed/reset tasks are STRICTLY restricted to test/demo project IDs (e.g. tknt-tdtu-test).'
      );
    }
  }

  // 3. Ping the emulator
  if (pingCheck) {
    const isAlive = await pingEmulator(host);
    if (!isAlive) {
      throw new Error(
        `[EMULATOR NOT REACHABLE] Cannot connect to Firestore Emulator at ${host}. ` +
        'Please ensure the emulator is running (e.g. via npm run dev:emulator or emulators:exec).'
      );
    }
  }

  return {
    isSafe: true,
    projectId: project,
    emulatorHost: host,
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST
  };
}

module.exports = {
  SAFE_EMULATOR_PROJECT_IDS,
  DEFAULT_EMULATOR_HOST,
  DEFAULT_AUTH_EMULATOR_HOST,
  pingEmulator,
  verifyEmulatorSafety
};
