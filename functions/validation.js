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

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Validates file metadata sent by the frontend.
 * @param {{ name: string, type: string, size: number }} fileMeta
 * @throws {ValidationError}
 */
function validateFile(fileMeta) {
  if (!fileMeta || typeof fileMeta.name !== 'string') {
    throw new ValidationError('Thiếu thông tin tệp');
  }

  const ext = getExtension(fileMeta.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      'Định dạng tệp không được phép: ' + ext + '. Chấp nhận: ' + [...ALLOWED_EXTENSIONS].join(', ')
    );
  }

  if (fileMeta.type && !ALLOWED_MIME_TYPES.has(fileMeta.type)) {
    throw new ValidationError('Loại MIME không được phép: ' + fileMeta.type);
  }

  if (typeof fileMeta.size === 'number' && fileMeta.size > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      'Tệp quá lớn: ' + Math.round(fileMeta.size / 1024 / 1024) + ' MB (tối đa 20 MB)'
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

module.exports = { validateFile, validateActivity, ValidationError, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES };
