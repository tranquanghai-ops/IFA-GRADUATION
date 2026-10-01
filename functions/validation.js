/**
 * validation.js — File and activity validation for graduation upload API
 */

'use strict';

// Allowed file extensions and MIME types for graduation document uploads
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.docx', '.doc',
  '.zip', '.rar', '.7z', '.xlsx', '.xls', '.pptx', '.ppt'
]);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/octet-stream', // Generic fallback from various client OS / browsers
]);

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB technical ceiling = 2,147,483,648 bytes
const DEFAULT_BUSINESS_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB default business limit

/**
 * Calculates effective max file size in bytes based on business limit, bounded by 2 GiB technical ceiling.
 * Fallback to default business limit (100 MB) if business limit is invalid/missing, never arbitrarily expanding to 2 GiB.
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
    return Math.min(MAX_FILE_SIZE_BYTES, businessLimit);
  }
  return Math.min(MAX_FILE_SIZE_BYTES, fallback);
}

/**
 * Validates file metadata sent by frontend or backend callers.
 * @param {{ name: string, type: string, size: number }} fileMeta
 * @param {number} [customMaxBytes]
 * @throws {ValidationError}
 */
function validateFile(fileMeta, customMaxBytes) {
  if (!fileMeta || typeof fileMeta.name !== 'string' || !fileMeta.name.trim()) {
    throw new ValidationError('Thiếu thông tin hoặc tên tệp không hợp lệ');
  }

  const trimmedName = fileMeta.name.trim();
  if (trimmedName.length > 180) {
    throw new ValidationError('Tên tệp quá dài (tối đa 180 ký tự)');
  }

  // Reject directory traversal or control characters in filename
  if (/[\x00-\x1f\\/]/.test(trimmedName)) {
    throw new ValidationError('Tên tệp chứa ký tự không hợp lệ');
  }

  const ext = getExtension(trimmedName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      'Định dạng tệp không được phép: ' + (ext || '(không có phần mở rộng)') + '. Chấp nhận: ' + [...ALLOWED_EXTENSIONS].join(', ')
    );
  }

  if (fileMeta.type && !ALLOWED_MIME_TYPES.has(fileMeta.type)) {
    throw new ValidationError('Loại MIME không được phép: ' + fileMeta.type);
  }

  if (
    typeof fileMeta.size !== 'number' ||
    !Number.isFinite(fileMeta.size) ||
    !Number.isSafeInteger(fileMeta.size) ||
    fileMeta.size <= 0
  ) {
    throw new ValidationError('Dung lượng tệp không hợp lệ: phải là số nguyên dương lớn hơn 0');
  }

  const effectiveLimit = getEffectiveMaxBytes(customMaxBytes);
  if (fileMeta.size > effectiveLimit) {
    const limitLabel = effectiveLimit >= MAX_FILE_SIZE_BYTES
      ? '2 GiB (2048 MB)'
      : `${Math.round(effectiveLimit / (1024 * 1024))} MB`;
    throw new ValidationError(
      'Dung lượng tệp không hợp lệ: ' + (fileMeta.size / (1024 * 1024)).toFixed(1) + ' MB (cho phép: 1 byte đến ' + limitLabel + ')'
    );
  }
}

/**
 * Validates that the activity allows submission right now.
 * @param {object} activity — deserialized Firestore activity document
 * @param {number} currentAttempt — 0-based current attempt count for this student
 * @throws {ValidationError}
 */
function validateActivity(activity, currentAttempt) {
  if (!activity) {
    throw new ValidationError('Không tìm thấy thông tin hoạt động');
  }

  if (!activity.submissionEnabled) {
    throw new ValidationError('Chức năng nộp hồ sơ hiện chưa được kích hoạt');
  }

  const now = new Date();

  // Check deadline
  const deadlineStr = activity.submissionConfig?.deadlineMode === 'custom' && activity.submissionConfig?.deadlineAt
    ? activity.submissionConfig.deadlineAt
    : (activity.endAt || activity.submissionDeadline);

  const allowLate = Boolean(activity.submissionConfig?.allowLateSubmission);

  if (deadlineStr && !allowLate) {
    const deadline = deadlineStr instanceof Date ? deadlineStr : new Date(deadlineStr);
    if (!isNaN(deadline.getTime()) && now > deadline) {
      throw new ValidationError('Đã quá hạn nộp hồ sơ: ' + deadline.toLocaleString('vi-VN'));
    }
  }

  const openAtStr = activity.startAt || activity.submissionOpenAt;
  if (openAtStr) {
    const openAt = openAtStr instanceof Date ? openAtStr : new Date(openAtStr);
    if (!isNaN(openAt.getTime()) && now < openAt) {
      throw new ValidationError('Chưa đến thời gian nhận hồ sơ: ' + openAt.toLocaleString('vi-VN'));
    }
  }

  const attemptLimit =
    Number(activity.submissionConfig?.maxAttempts) ||
    Number(activity.maxAttempts) ||
    Number(activity.attemptLimit) ||
    3;

  if (currentAttempt >= attemptLimit) {
    throw new ValidationError(
      'Bạn đã nộp đủ số lần cho phép (' + attemptLimit + ' lần)'
    );
  }
}

function getExtension(filename) {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.isValidationError = true;
  }
}

module.exports = {
  validateFile,
  validateActivity,
  ValidationError,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  getEffectiveMaxBytes,
};
