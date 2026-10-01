/**
 * upload-protocol.js — Google Drive Resumable Chunked Upload Protocol Engine
 * Standardized reference implementation for IFA Ecosystem (IFA-SSR, IFA-GRADUATION, TSNN).
 * Strictly complies with official Google Drive Resumable Upload specification.
 */

// Chunk size must be a multiple of 256 KiB (262,144 bytes).
export const GOOGLE_DRIVE_CHUNK_ALIGNMENT = 256 * 1024;
export const DEFAULT_CHUNK_SIZE = 32 * 1024 * 1024; // 32 MiB (128 * 256 KiB = 33,554,432 bytes)

export class UploadError extends Error {
  constructor(message, code, status = 0, retryable = false) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isRetryableStatusCode(status) {
  return (
    status === 0 || // Network error
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests / Rate limit
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504 // Gateway Timeout
  );
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Normalizes chunk size to be a multiple of 256 KiB.
 */
export function normalizeChunkSize(size) {
  const chosen = size && size > 0 ? size : DEFAULT_CHUNK_SIZE;
  const remainder = chosen % GOOGLE_DRIVE_CHUNK_ALIGNMENT;
  if (remainder === 0) return chosen;
  return chosen + (GOOGLE_DRIVE_CHUNK_ALIGNMENT - remainder);
}

/**
 * Queries Google Drive for the current byte offset in a resumable session.
 */
export async function queryResumeOffset(sessionUri, totalBytes, signal) {
  if (signal?.aborted) {
    throw new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUri, true);
    xhr.setRequestHeader('Content-Range', `bytes */${totalBytes}`);

    const abortHandler = () => {
      xhr.abort();
      reject(new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false));
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);

      if (xhr.status === 200 || xhr.status === 201) {
        let resData = {};
        try {
          resData = JSON.parse(xhr.responseText);
        } catch {}
        resolve({
          completed: true,
          nextByteOffset: totalBytes,
          fileId: resData.id,
        });
        return;
      }

      if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range');
        if (!range) {
          resolve({ completed: false, nextByteOffset: 0 });
          return;
        }
        const match = range.match(/bytes=0-(\d+)/);
        if (match && match[1]) {
          const lastByte = parseInt(match[1], 10);
          resolve({ completed: false, nextByteOffset: lastByte + 1 });
          return;
        }
        resolve({ completed: false, nextByteOffset: 0 });
        return;
      }

      if (xhr.status === 404 || xhr.status === 410) {
        reject(
          new UploadError(
            'Phiên tải lên Google Drive đã hết hạn hoặc không tồn tại.',
            'SESSION_EXPIRED',
            xhr.status,
            false
          )
        );
        return;
      }

      reject(
        new UploadError(
          `Không thể kiểm tra trạng thái tải tệp (HTTP ${xhr.status}).`,
          'QUERY_STATUS_FAILED',
          xhr.status,
          isRetryableStatusCode(xhr.status)
        )
      );
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(
        new UploadError(
          'Mất kết nối mạng khi kiểm tra phiên tải lên.',
          'NETWORK_ERROR',
          0,
          true
        )
      );
    };

    xhr.timeout = 30000;
    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(
        new UploadError(
          'Hết thời gian chờ kiểm tra phiên tải lên.',
          'TIMEOUT',
          408,
          true
        )
      );
    };

    xhr.send();
  });
}

/**
 * Uploads a single chunk of data with byte-level progress reporting.
 */
export function uploadChunkWithProgress(
  sessionUri,
  chunk,
  start,
  end,
  totalBytes,
  mimeType,
  onChunkProgress,
  signal
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(
        new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false)
      );
    }

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUri, true);
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${totalBytes}`);
    if (mimeType) {
      xhr.setRequestHeader('Content-Type', mimeType);
    }

    const abortHandler = () => {
      xhr.abort();
      reject(
        new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false)
      );
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onChunkProgress) {
        onChunkProgress(e.loaded);
      }
    };

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);

      if (xhr.status === 200 || xhr.status === 201) {
        let resData = {};
        try {
          resData = JSON.parse(xhr.responseText);
        } catch {}
        resolve({
          completed: true,
          nextByteOffset: totalBytes,
          fileId: resData.id,
        });
        return;
      }

      if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range');
        let nextOffset = end + 1;
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match && match[1]) {
            nextOffset = parseInt(match[1], 10) + 1;
          }
        }
        resolve({
          completed: false,
          nextByteOffset: nextOffset,
        });
        return;
      }

      if (xhr.status === 404 || xhr.status === 410) {
        reject(
          new UploadError(
            'Phiên tải lên Google Drive đã hết hạn.',
            'SESSION_EXPIRED',
            xhr.status,
            false
          )
        );
        return;
      }

      const retryable = isRetryableStatusCode(xhr.status);
      reject(
        new UploadError(
          `Lỗi truyền dữ liệu lên Google Drive (HTTP ${xhr.status}).`,
          'CHUNK_UPLOAD_FAILED',
          xhr.status,
          retryable
        )
      );
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(
        new UploadError(
          'Mất kết nối mạng khi tải dữ liệu lên Google Drive.',
          'NETWORK_ERROR',
          0,
          true
        )
      );
    };

    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(
        new UploadError(
          'Hết thời gian chờ gửi dữ liệu.',
          'TIMEOUT',
          408,
          true
        )
      );
    };

    xhr.timeout = 180000; // 3 minutes timeout per chunk
    xhr.send(chunk);
  });
}

/**
 * Calculates exponential backoff delay with random jitter.
 */
export function calculateBackoffDelay(
  attempt,
  initialDelayMs = 1000,
  maxDelayMs = 30000
) {
  const exp = Math.min(attempt, 6);
  const base = initialDelayMs * Math.pow(2, exp);
  const jitter = Math.random() * 500;
  return Math.min(base + jitter, maxDelayMs);
}

/**
 * Main Google Drive Resumable Chunked Upload Engine.
 */
export async function uploadFileToDriveResumable(
  sessionUri,
  file,
  options = {}
) {
  const {
    chunkSize: rawChunkSize,
    maxRetries = 5,
    initialRetryDelayMs = 1000,
    maxRetryDelayMs = 30000,
    signal,
    onProgress,
  } = options;

  const totalBytes = file.size;
  const mimeType = file.type || 'application/octet-stream';
  const chunkSize = normalizeChunkSize(rawChunkSize);
  const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));

  if (signal?.aborted) {
    throw new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false);
  }

  const emit = (state) => {
    if (onProgress) {
      onProgress(state);
    }
  };

  emit({
    phase: 'preparing',
    percent: 0,
    bytesUploaded: 0,
    totalBytes,
    message: 'Đang kết nối Google Drive...',
  });

  // 1. Query resume offset in case we are resuming an active or completed session
  let offset = 0;
  let fileId;

  try {
    const initialStatus = await queryResumeOffset(sessionUri, totalBytes, signal);
    if (initialStatus.completed && initialStatus.fileId) {
      emit({
        phase: 'completed',
        percent: 100,
        bytesUploaded: totalBytes,
        totalBytes,
        message: 'Tệp đã hoàn tất tải lên.',
      });
      return { fileId: initialStatus.fileId };
    }
    offset = initialStatus.nextByteOffset;
  } catch (err) {
    if (err instanceof UploadError && err.code === 'UPLOAD_CANCELLED') {
      throw err;
    }
    offset = 0;
  }

  // 2. Chunk Upload Loop
  let retryCount = 0;

  while (offset < totalBytes) {
    if (signal?.aborted) {
      emit({
        phase: 'cancelled',
        percent: Math.floor((offset / totalBytes) * 100),
        bytesUploaded: offset,
        totalBytes,
        message: 'Đã hủy tải lên.',
      });
      throw new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false);
    }

    const start = offset;
    const end = Math.min(start + chunkSize, totalBytes) - 1;
    const chunkBlob = file.slice(start, end + 1);
    const chunkIdx = Math.floor(start / chunkSize) + 1;

    let chunkLoadedBytes = 0;

    const updateChunkProgress = (loadedInChunk) => {
      chunkLoadedBytes = Math.min(loadedInChunk, end - start + 1);
      const currentTotal = start + chunkLoadedBytes;
      const pct = Math.min(99, Math.floor((currentTotal / totalBytes) * 100));
      emit({
        phase: 'uploading',
        percent: pct,
        bytesUploaded: currentTotal,
        totalBytes,
        chunkIndex: chunkIdx,
        totalChunks,
        message: `Đang tải lên Google Drive (${pct}%) — ${formatBytes(currentTotal)} / ${formatBytes(totalBytes)}`,
      });
    };

    updateChunkProgress(0);

    try {
      const chunkResult = await uploadChunkWithProgress(
        sessionUri,
        chunkBlob,
        start,
        end,
        totalBytes,
        mimeType,
        updateChunkProgress,
        signal
      );

      retryCount = 0;

      if (chunkResult.completed) {
        fileId = chunkResult.fileId;
        offset = totalBytes;
        break;
      }

      offset = chunkResult.nextByteOffset;
    } catch (error) {
      if (signal?.aborted) {
        emit({
          phase: 'cancelled',
          percent: Math.floor((offset / totalBytes) * 100),
          bytesUploaded: offset,
          totalBytes,
          message: 'Đã hủy tải lên.',
        });
        throw new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false);
      }

      const uploadErr =
        error instanceof UploadError
          ? error
          : new UploadError(
              String(error?.message || 'Lỗi không xác định'),
              'UNKNOWN_ERROR',
              0,
              true
            );

      if (!uploadErr.retryable || retryCount >= maxRetries) {
        emit({
          phase: 'error',
          percent: Math.floor((offset / totalBytes) * 100),
          bytesUploaded: offset,
          totalBytes,
          message: uploadErr.message,
        });
        throw uploadErr;
      }

      retryCount++;
      const delay = calculateBackoffDelay(
        retryCount,
        initialRetryDelayMs,
        maxRetryDelayMs
      );

      emit({
        phase: 'retrying',
        percent: Math.floor((offset / totalBytes) * 100),
        bytesUploaded: offset,
        totalBytes,
        retryAttempt: retryCount,
        message: `Mạng gián đoạn. Đang khôi phục phiên tải (Lần ${retryCount}/${maxRetries})...`,
      });

      await new Promise((r) => setTimeout(r, delay));

      if (signal?.aborted) {
        throw new UploadError('Tải lên đã bị hủy.', 'UPLOAD_CANCELLED', 0, false);
      }

      emit({
        phase: 'resuming',
        percent: Math.floor((offset / totalBytes) * 100),
        bytesUploaded: offset,
        totalBytes,
        message: 'Đang xác định vị trí tiếp tục tải lên từ Google Drive...',
      });

      try {
        const syncStatus = await queryResumeOffset(sessionUri, totalBytes, signal);
        if (syncStatus.completed && syncStatus.fileId) {
          fileId = syncStatus.fileId;
          offset = totalBytes;
          break;
        }
        offset = syncStatus.nextByteOffset;
      } catch (syncErr) {
        if (syncErr instanceof UploadError && !syncErr.retryable) {
          throw syncErr;
        }
      }
    }
  }

  if (!fileId) {
    const finalCheck = await queryResumeOffset(sessionUri, totalBytes, signal);
    if (finalCheck.completed && finalCheck.fileId) {
      fileId = finalCheck.fileId;
    } else {
      throw new UploadError(
        'Không nhận được mã tệp từ Google Drive sau khi tải xong.',
        'COMPLETION_MISSING_FILE_ID',
        200,
        false
      );
    }
  }

  emit({
    phase: 'verifying',
    percent: 100,
    bytesUploaded: totalBytes,
    totalBytes,
    message: 'Đang xác nhận tệp...',
  });

  return { fileId };
}

// Window global bridge
if (typeof window !== 'undefined') {
  window.DriveUploadProtocol = {
    GOOGLE_DRIVE_CHUNK_ALIGNMENT,
    DEFAULT_CHUNK_SIZE,
    UploadError,
    isRetryableStatusCode,
    formatBytes,
    normalizeChunkSize,
    queryResumeOffset,
    uploadChunkWithProgress,
    calculateBackoffDelay,
    uploadFileToDriveResumable,
  };
}
