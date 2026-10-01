/**
 * tests/test-graduation-upload-protocol.cjs
 * Comprehensive test suite for Google Drive Resumable Chunked Upload Protocol Engine in IFA-GRADUATION
 * Includes Mock XHR, 308 handling, network recovery, retry/backoff, cancel, and 2 GiB boundaries.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

test('Upload Protocol Constants & Alignment', async (t) => {
  const protocol = await import('../js/drive/upload-protocol.js');

  assert.equal(protocol.GOOGLE_DRIVE_CHUNK_ALIGNMENT, 256 * 1024, 'Alignment must be exactly 256 KiB');
  assert.equal(protocol.DEFAULT_CHUNK_SIZE, 32 * 1024 * 1024, 'Default chunk size must be exactly 32 MiB');
  assert.equal(protocol.DEFAULT_CHUNK_SIZE % protocol.GOOGLE_DRIVE_CHUNK_ALIGNMENT, 0, 'Default chunk size must be multiple of 256 KiB');
});

test('Chunk Size Normalization', async (t) => {
  const { normalizeChunkSize, GOOGLE_DRIVE_CHUNK_ALIGNMENT } = await import('../js/drive/upload-protocol.js');

  assert.equal(normalizeChunkSize(), 32 * 1024 * 1024);
  assert.equal(normalizeChunkSize(0), 32 * 1024 * 1024);
  assert.equal(normalizeChunkSize(256 * 1024), 256 * 1024);
  assert.equal(normalizeChunkSize(512 * 1024), 512 * 1024);
  assert.equal(normalizeChunkSize(32 * 1024 * 1024), 32 * 1024 * 1024);

  const oddSize = 300 * 1024;
  const normalized = normalizeChunkSize(oddSize);
  assert.equal(normalized % GOOGLE_DRIVE_CHUNK_ALIGNMENT, 0);
  assert.equal(normalized, 512 * 1024);

  const tinyOdd = 1000;
  assert.equal(normalizeChunkSize(tinyOdd), 256 * 1024);
});

test('Retryable Status Codes Check', async (t) => {
  const { isRetryableStatusCode } = await import('../js/drive/upload-protocol.js');

  assert.equal(isRetryableStatusCode(0), true, 'Network failure (status 0) is retryable');
  assert.equal(isRetryableStatusCode(408), true, '408 Request Timeout is retryable');
  assert.equal(isRetryableStatusCode(429), true, '429 Rate Limit is retryable');
  assert.equal(isRetryableStatusCode(500), true, '500 Server Error is retryable');
  assert.equal(isRetryableStatusCode(502), true, '502 Bad Gateway is retryable');
  assert.equal(isRetryableStatusCode(503), true, '503 Service Unavailable is retryable');
  assert.equal(isRetryableStatusCode(504), true, '504 Gateway Timeout is retryable');

  assert.equal(isRetryableStatusCode(400), false, '400 Bad Request is terminal');
  assert.equal(isRetryableStatusCode(401), false, '401 Unauthorized is terminal');
  assert.equal(isRetryableStatusCode(403), false, '403 Forbidden is terminal');
  assert.equal(isRetryableStatusCode(404), false, '404 Not Found is terminal');
  assert.equal(isRetryableStatusCode(410), false, '410 Gone is terminal');
});

test('Format Bytes', async (t) => {
  const { formatBytes } = await import('../js/drive/upload-protocol.js');

  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(32 * 1024 * 1024), '32.0 MB');
  assert.equal(formatBytes(2 * 1024 * 1024 * 1024), '2.00 GB');
});

test('Exponential Backoff Delay Bounds', async (t) => {
  const { calculateBackoffDelay } = await import('../js/drive/upload-protocol.js');

  for (let attempt = 1; attempt <= 10; attempt++) {
    const delay = calculateBackoffDelay(attempt, 1000, 30000);
    assert.ok(delay >= 1000, `Delay for attempt ${attempt} must be >= 1000ms`);
    assert.ok(delay <= 30000, `Delay for attempt ${attempt} must not exceed 30000ms ceiling`);
  }
});

// ── Mock XHR Test Harness for Protocol Network Flows ─────────────────────────

class MockXMLHttpRequest {
  constructor() {
    this.headers = {};
    this.responseHeaders = {};
    this.status = 0;
    this.responseText = '';
    this.upload = { onprogress: null };
    this.onload = null;
    this.onerror = null;
    this.ontimeout = null;
    this.aborted = false;
  }

  open(method, url) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key, val) {
    this.headers[key] = val;
  }

  getResponseHeader(key) {
    return this.responseHeaders[key.toLowerCase()] || this.responseHeaders[key] || null;
  }

  abort() {
    this.aborted = true;
  }

  send(body) {
    MockXMLHttpRequest.lastInstance = this;
    if (MockXMLHttpRequest.handleSend) {
      MockXMLHttpRequest.handleSend(this, body);
    }
  }
}

test('Protocol: queryResumeOffset handles HTTP 308 Range header correctly', async (t) => {
  global.XMLHttpRequest = MockXMLHttpRequest;
  const { queryResumeOffset } = await import('../js/drive/upload-protocol.js');

  MockXMLHttpRequest.handleSend = (xhr) => {
    assert.equal(xhr.headers['Content-Range'], 'bytes */1000000');
    xhr.status = 308;
    xhr.responseHeaders['range'] = 'bytes=0-262143';
    setTimeout(() => xhr.onload(), 5);
  };

  const status = await queryResumeOffset('https://drive.mock/session', 1000000);
  assert.equal(status.completed, false);
  assert.equal(status.nextByteOffset, 262144);
});

test('Protocol: queryResumeOffset detects completed session', async (t) => {
  global.XMLHttpRequest = MockXMLHttpRequest;
  const { queryResumeOffset } = await import('../js/drive/upload-protocol.js');

  MockXMLHttpRequest.handleSend = (xhr) => {
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ id: 'completed_file_id_999' });
    setTimeout(() => xhr.onload(), 5);
  };

  const status = await queryResumeOffset('https://drive.mock/session', 1000000);
  assert.equal(status.completed, true);
  assert.equal(status.fileId, 'completed_file_id_999');
});

test('Protocol: uploadFileToDriveResumable handles chunking and transient retry (HTTP 503)', async (t) => {
  global.XMLHttpRequest = MockXMLHttpRequest;
  const { uploadFileToDriveResumable } = await import('../js/drive/upload-protocol.js');

  let callCount = 0;
  let receivedChunks = [];

  MockXMLHttpRequest.handleSend = (xhr, body) => {
    callCount++;
    const rangeHeader = xhr.headers['Content-Range'];

    if (callCount === 1) {
      // 1. Initial query offset
      assert.equal(rangeHeader, 'bytes */1000');
      xhr.status = 308;
      setTimeout(() => xhr.onload(), 5);
      return;
    }

    if (callCount === 2) {
      // 2. First chunk attempt -> simulate transient 503 Service Unavailable
      xhr.status = 503;
      setTimeout(() => xhr.onload(), 5);
      return;
    }

    if (callCount === 3) {
      // 3. Sync resume offset after retry
      xhr.status = 308;
      setTimeout(() => xhr.onload(), 5);
      return;
    }

    if (callCount === 4) {
      // 4. Retry chunk -> succeeds with 200 completion
      xhr.status = 200;
      xhr.responseText = JSON.stringify({ id: 'file_mock_resumed_ok' });
      setTimeout(() => xhr.onload(), 5);
      return;
    }
  };

  // Mock a File/Blob of 1000 bytes
  const mockFile = {
    size: 1000,
    type: 'application/pdf',
    slice: (start, end) => ({ size: end - start + 1 }),
  };

  const result = await uploadFileToDriveResumable('https://drive.mock/session', mockFile, {
    chunkSize: 1024 * 1024,
    initialRetryDelayMs: 10, // Fast delay for test
    maxRetries: 3,
  });

  assert.equal(result.fileId, 'file_mock_resumed_ok');
  assert.ok(callCount >= 4, 'Must have executed retry and resume sync');
});

test('Protocol: uploadFileToDriveResumable honors AbortSignal cancel', async (t) => {
  global.XMLHttpRequest = MockXMLHttpRequest;
  const { uploadFileToDriveResumable } = await import('../js/drive/upload-protocol.js');

  const controller = new AbortController();

  MockXMLHttpRequest.handleSend = (xhr) => {
    // When first call arrives, trigger abort
    controller.abort();
  };

  const mockFile = {
    size: 5000,
    type: 'application/pdf',
    slice: (start, end) => ({ size: end - start + 1 }),
  };

  await assert.rejects(
    async () => {
      await uploadFileToDriveResumable('https://drive.mock/session', mockFile, {
        signal: controller.signal,
      });
    },
    (err) => err.code === 'UPLOAD_CANCELLED' || err.message.includes('hủy')
  );
});
