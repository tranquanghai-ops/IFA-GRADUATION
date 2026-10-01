/**
 * policy.js — Upload & ownership policy engine for IFA-GRADUATION
 * Aligned with IFA Ecosystem standards (IFA-SSR, IFA-GRADUATION, TSNN).
 */

'use strict';

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB technical ceiling = 2,147,483,648 bytes
const DEFAULT_BUSINESS_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB default business limit

/**
 * Calculates effective maximum bytes bounded by 2 GiB technical ceiling.
 * Falls back to default limit (100 MB) instead of expanding to 2 GiB when limit is invalid.
 * @param {number} [businessLimit]
 * @param {number} [defaultLimitMB=100]
 * @returns {number}
 */
function getEffectiveMaxBytes(businessLimit, defaultLimitMB = 100) {
  const fallback = (typeof defaultLimitMB === 'number' && Number.isFinite(defaultLimitMB) && defaultLimitMB > 0)
    ? Math.floor(defaultLimitMB * 1024 * 1024)
    : DEFAULT_BUSINESS_LIMIT_BYTES;

  if (
    typeof businessLimit === 'number' &&
    Number.isFinite(businessLimit) &&
    Number.isSafeInteger(businessLimit) &&
    businessLimit > 0
  ) {
    return Math.min(MAX_BYTES, businessLimit);
  }
  return Math.min(MAX_BYTES, fallback);
}

/**
 * Validates roundId and activityId format.
 * @param {string} roundId
 * @param {string} activityId
 */
function validateDriveTarget(roundId, activityId) {
  if (typeof roundId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(roundId)) {
    throw new Error('INVALID_ROUND_ID');
  }
  if (typeof activityId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(activityId)) {
    throw new Error('INVALID_ACTIVITY_ID');
  }
}

/**
 * Extracts a Google Drive File ID from a URL or raw ID string.
 * @param {string} value
 * @returns {string|null}
 */
function fileId(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') {
      return null;
    }
    const id =
      url.pathname.match(/^\/file\/d\/([\w-]+)\/(?:view|preview)$/)?.[1] ||
      (['/thumbnail', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null);
    return id && /^[\w-]{10,200}$/.test(id) ? id : null;
  } catch {
    return /^[\w-]{10,200}$/.test(value) ? value : null;
  }
}

/**
 * Asserts that the Google Drive file belongs to IFA-GRADUATION and the authorized actor.
 * @param {object} meta — Drive file metadata
 * @param {string} [actorId] — Student ID or UID
 * @param {boolean} [requireUploader=false]
 * @param {boolean} [allowTrashed=false]
 * @returns {object} appProperties
 */
function assertOwned(meta, actorId, requireUploader = false, allowTrashed = false) {
  if (!meta) {
    throw new Error('FILE_NOT_FOUND');
  }
  if (!allowTrashed && meta.trashed) {
    throw new Error('FILE_TRASHED');
  }
  const p = meta.appProperties || {};
  if (p.app !== 'ifa-graduation') {
    throw new Error('FILE_NOT_OWNED');
  }
  if (requireUploader && actorId) {
    const matchStudent = p.studentId && p.studentId.toUpperCase() === actorId.toUpperCase();
    const matchUploader = p.uploadedBy && p.uploadedBy === actorId;
    if (!matchStudent && !matchUploader) {
      throw new Error('FILE_NOT_OWNED');
    }
  }
  if (p.roundId && p.activityId) {
    validateDriveTarget(p.roundId, p.activityId);
  }
  return p;
}

module.exports = {
  MAX_BYTES,
  getEffectiveMaxBytes,
  validateDriveTarget,
  fileId,
  assertOwned,
};
