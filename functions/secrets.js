/**
 * secrets.js — Google Cloud Secret Manager wrapper
 *
 * Reads secrets from the ifa-activities project.
 * Returns null (graceful degradation) if a secret doesn't exist yet.
 */

'use strict';

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const PROJECT_ID = 'ifa-activities';
let client = null;

function getClient() {
  if (!client) client = new SecretManagerServiceClient();
  return client;
}

/**
 * Reads the latest version of a secret.
 * @param {string} secretName — e.g. 'graduation-drive-owner-token'
 * @returns {string|null} secret value, or null if not found/configured
 */
async function getSecret(secretName) {
  const name = 'projects/' + PROJECT_ID + '/secrets/' + secretName + '/versions/latest';
  try {
    const [version] = await getClient().accessSecretVersion({ name });
    return version.payload.data.toString('utf8').trim();
  } catch (err) {
    if (err.code === 5) { // NOT_FOUND
      console.warn('[secrets] Secret not found:', secretName, '— driveConfigured will be false');
      return null;
    }
    console.error('[secrets] Error reading secret:', secretName, err.message);
    return null;
  }
}

module.exports = { getSecret };
