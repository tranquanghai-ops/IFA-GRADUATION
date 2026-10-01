/**
 * tests/test-graduation-configurable-drive.cjs
 * Comprehensive test suite for IFA-GRADUATION configurable Google Drive root:
 * - Admin verify-drive-folder endpoint & URL/ID parsing
 * - Doc/Sheet/Slide rejection
 * - Drive write capability test
 * - Firestore graduationSystemConfig/drive persistence
 * - Server-derived folder hierarchy & DRIVE_ROOT_NOT_CONFIGURED fail-closed
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractDriveFolderId,
  isGoogleDriveDocOrFileUrl,
  validateRootDriveFolder,
  _setTestDriveDriver,
} = require('../functions/drive.js');

const {
  getGraduationDriveConfig,
  saveGraduationDriveConfig,
  setTestFirestoreDriver,
} = require('../functions/firestore.js');

const {
  resolveTargetDriveFolder,
  validateRootFolderHandler,
  saveDriveConfigHandler,
} = require('../functions/index.js');

function createMockReqRes({ auth = null, body = {}, query = {}, headers = {}, method = 'POST' } = {}) {
  let statusCode = 200;
  let responseData = null;
  const resHeaders = {};

  const req = {
    auth,
    body,
    query,
    headers: {
      authorization: 'Bearer mock-token',
      ...headers,
    },
    method,
    path: '/',
  };

  const res = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return this;
    },
    set(header, value) {
      resHeaders[header.toLowerCase()] = value;
      return this;
    },
    setHeader(header, value) {
      resHeaders[header.toLowerCase()] = value;
      return this;
    },
    json(data) {
      this.headersSent = true;
      responseData = data;
      return this;
    },
    send(data) {
      this.headersSent = true;
      responseData = data;
      return this;
    },
    end() {
      this.headersSent = true;
      return this;
    }
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getBody: () => responseData,
  };
}

test('extractDriveFolderId & isGoogleDriveDocOrFileUrl reject non-folder URLs', () => {
  const validFolderUrl = 'https://drive.google.com/drive/folders/1abcDEF_ghIJK-lmNOpqRSTuvWXyz1234';
  const rawId = '1abcDEF_ghIJK-lmNOpqRSTuvWXyz1234';
  assert.equal(extractDriveFolderId(validFolderUrl), rawId);
  assert.equal(extractDriveFolderId(rawId), rawId);
  assert.equal(isGoogleDriveDocOrFileUrl(validFolderUrl), false);

  const docUrl = 'https://docs.google.com/document/d/1abcDEF_ghIJK-lmNOpqRSTuvWXyz1234/edit';
  assert.equal(isGoogleDriveDocOrFileUrl(docUrl), true);
  assert.equal(extractDriveFolderId(docUrl), null, 'Must reject docs URL');

  const sheetUrl = 'https://docs.google.com/spreadsheets/d/1abcDEF_ghIJK-lmNOpqRSTuvWXyz1234/edit';
  assert.equal(isGoogleDriveDocOrFileUrl(sheetUrl), true);
  assert.equal(extractDriveFolderId(sheetUrl), null, 'Must reject sheets URL');

  const fileUrl = 'https://drive.google.com/file/d/1abcDEF_ghIJK-lmNOpqRSTuvWXyz1234/view';
  assert.equal(isGoogleDriveDocOrFileUrl(fileUrl), true);
  assert.equal(extractDriveFolderId(fileUrl), null, 'Must reject file/d/ URL');

  assert.equal(extractDriveFolderId('https://example.com/not-drive'), null);
  assert.equal(extractDriveFolderId('too-short'), null);
});

test('validateRootDriveFolder tests write capability and properties', async () => {
  let probeTested = false;

  _setTestDriveDriver({
    async validateRootDriveFolder(rawUrl, folderId) {
      if (folderId === 'trashed-folder-id-123456789012345') {
        throw new Error('Thư mục này hiện đang nằm trong Thùng rác của Google Drive.');
      }
      if (folderId === 'read-only-folder-123456789012345') {
        throw new Error('Tài khoản hệ thống không có quyền tạo thư mục con trong thư mục này.');
      }
      if (folderId === 'valid-folder-id-12345678901234567') {
        probeTested = true;
        return {
          ok: true,
          folderId,
          folderName: 'DATN 2026',
          folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
          canAddChildren: true,
          checkMethod: 'write_probe',
        };
      }
      throw new Error('File not found');
    }
  });

  // Test 1: Valid folder
  const resValid = await validateRootDriveFolder('https://drive.google.com/drive/folders/valid-folder-id-12345678901234567');
  assert.equal(resValid.ok, true);
  assert.equal(resValid.folderId, 'valid-folder-id-12345678901234567');
  assert.equal(resValid.folderName, 'DATN 2026');
  assert.equal(resValid.canAddChildren, true);
  assert.equal(probeTested, true);

  // Test 2: Trashed folder
  await assert.rejects(
    async () => validateRootDriveFolder('trashed-folder-id-123456789012345'),
    /Thùng rác/
  );

  // Test 3: Read-only folder
  await assert.rejects(
    async () => validateRootDriveFolder('read-only-folder-123456789012345'),
    /không có quyền/
  );

  // Test 4: Document URL (rejected by validateRootDriveFolder before driver)
  await assert.rejects(
    async () => validateRootDriveFolder('https://docs.google.com/document/d/valid-folder-id-12345678901234567/edit'),
    /Google Docs/
  );
});

test('Firestore drive config reads from graduationSystemConfig/drive and persists sync', async () => {
  const store = new Map();
  setTestFirestoreDriver({
    getServerToken: async () => 'test-token',
    async getDocument(docPath) {
      return store.get(docPath) || null;
    },
    async createOrReplaceDocument(docPath, data) {
      store.set(docPath, { ...data });
      return { ...data };
    },
    async setDocument(docPath, data) {
      store.set(docPath, { ...data });
      return { ...data };
    },
    async createDocumentWithPrecondition(docPath, data) {
      store.set(docPath, { ...data });
      return { ok: true };
    },
    async updateDocumentFields(docPath, fields) {
      const existing = store.get(docPath) || {};
      store.set(docPath, { ...existing, ...fields });
      return { ok: true };
    }
  });

  // Initially empty
  const initialConfig = await getGraduationDriveConfig();
  assert.equal(initialConfig, null);

  // Save config
  await saveGraduationDriveConfig({
    folderId: 'datn-root-folder-123456789012345678',
    folderName: 'DATN Master Root',
    folderUrl: 'https://drive.google.com/drive/folders/datn-root-folder-123456789012345678',
    updatedBy: 'admin@tdtu.edu.vn'
  });

  // Verify saved in graduationSystemConfig/drive
  const primaryDoc = store.get('graduationSystemConfig/drive');
  assert.ok(primaryDoc);
  assert.equal(primaryDoc.graduationRootFolderId, 'datn-root-folder-123456789012345678');
  assert.equal(primaryDoc.graduationRootFolderName, 'DATN Master Root');
  assert.equal(primaryDoc.updatedBy, 'admin@tdtu.edu.vn');

  // Verify sync to settings/main.driveConfig
  const settingsDoc = store.get('settings/main');
  assert.ok(settingsDoc);
  assert.equal(settingsDoc.driveConfig?.graduationRootFolderId, 'datn-root-folder-123456789012345678');

  // Read back
  const loadedConfig = await getGraduationDriveConfig();
  assert.equal(loadedConfig.graduationRootFolderId, 'datn-root-folder-123456789012345678');
});

test('resolveTargetDriveFolder fails-closed with DRIVE_ROOT_NOT_CONFIGURED and derives hierarchy', async () => {
  const store = new Map();
  const folderTree = new Map(); // `parentId/folderName` -> folderId

  setTestFirestoreDriver({
    getServerToken: async () => 'test-token',
    async getDocument(docPath) {
      return store.get(docPath) || null;
    },
  });

  _setTestDriveDriver({
    async getOrCreateDriveChildFolder({ parentFolderId, folderName }) {
      const key = `${parentFolderId}/${folderName}`;
      if (!folderTree.has(key)) {
        folderTree.set(key, 'child-folder-' + Math.random().toString(36).substring(2, 9) + '-1234567890');
      }
      return {
        ok: true,
        folderId: folderTree.get(key),
        folderName,
        folderUrl: `https://drive.google.com/drive/folders/${folderTree.get(key)}`,
        reused: true,
      };
    }
  });

  const roundDoc = { id: 'round-datn-2026', title: 'Học kỳ 1 2026-2027' };
  const activityDoc = { id: 'act-baocao-cuoiky', title: 'Nộp Báo cáo Cuối kỳ' };

  // 1. When root is NOT configured: MUST throw DRIVE_ROOT_NOT_CONFIGURED
  await assert.rejects(
    async () => {
      await resolveTargetDriveFolder({
        roundDoc,
        activityDoc,
        studentId: '521H0001',
        serverToken: 'test-token',
      });
    },
    (err) => {
      assert.equal(err.code, 'DRIVE_ROOT_NOT_CONFIGURED');
      assert.match(err.message, /DRIVE_ROOT_NOT_CONFIGURED/);
      return true;
    }
  );

  // 2. Configure root folder (valid length >= 25 chars)
  store.set('graduationSystemConfig/drive', {
    graduationRootFolderId: 'root-datn-1234567890123456789012',
    graduationRootFolderName: 'DATN MASTER',
  });

  // 3. Resolve target folder - creates Root -> Đợt -> Mốc -> Sinh viên
  const targetFolder = await resolveTargetDriveFolder({
    roundDoc,
    activityDoc,
    studentId: '521H0001',
    serverToken: 'test-token',
  });

  assert.ok(targetFolder, 'Should return a valid folder ID');
  assert.match(targetFolder, /^child-folder-/);

  // Verify second call reuses existing folder (idempotent)
  const targetFolder2 = await resolveTargetDriveFolder({
    roundDoc,
    activityDoc,
    studentId: '521H0001',
    serverToken: 'test-token',
  });
  assert.equal(targetFolder, targetFolder2, 'Must return same folder ID for same student and activity');
});

test('validateRootFolderHandler: admin check & verify integration', async () => {
  _setTestDriveDriver({
    async validateRootDriveFolder(rawUrl, folderId) {
      if (folderId === 'valid-folder-id-12345678901234567') {
        return {
          ok: true,
          folderId,
          folderName: 'DATN 2026',
          folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
          canAddChildren: true,
          checkMethod: 'write_probe',
        };
      }
      throw new Error('Thư mục không tồn tại');
    }
  });

  // Non-admin request
  const nonAdmin = createMockReqRes({
    auth: { uid: 'user-1', email: 'student@tdtu.edu.vn', isAdmin: false },
    body: { folderUrlOrId: 'https://drive.google.com/drive/folders/valid-folder-id-12345678901234567' }
  });
  await validateRootFolderHandler(nonAdmin.req, nonAdmin.res);
  assert.equal(nonAdmin.getStatus(), 403);
  assert.match(nonAdmin.getBody().error, /quản trị viên/i);

  // Admin request with valid folder
  const adminReq = createMockReqRes({
    auth: { uid: 'admin-1', email: 'admin@tdtu.edu.vn', isAdmin: true },
    body: { folderUrlOrId: 'https://drive.google.com/drive/folders/valid-folder-id-12345678901234567' }
  });
  await validateRootFolderHandler(adminReq.req, adminReq.res);
  assert.equal(adminReq.getStatus(), 200);
  assert.equal(adminReq.getBody().ok, true);
  assert.equal(adminReq.getBody().folderName, 'DATN 2026');
});

test('saveDriveConfigHandler: admin check & persistence', async () => {
  const store = new Map();
  setTestFirestoreDriver({
    getServerToken: async () => 'test-token',
    async getDocument(docPath) { return store.get(docPath) || null; },
    async createOrReplaceDocument(docPath, data) { store.set(docPath, data); return data; },
    async setDocument(docPath, data) { store.set(docPath, data); return data; },
    async createDocumentWithPrecondition(docPath, data) { store.set(docPath, data); return { ok: true }; },
    async updateDocumentFields(docPath, fields) { store.set(docPath, { ...store.get(docPath), ...fields }); return { ok: true }; }
  });

  // Non-admin rejected
  const nonAdmin = createMockReqRes({
    auth: { uid: 'student-1', email: 'student@tdtu.edu.vn', isAdmin: false },
    body: { folderId: 'datn-root-folder-123456789012345678' }
  });
  await saveDriveConfigHandler(nonAdmin.req, nonAdmin.res);
  assert.equal(nonAdmin.getStatus(), 403);

  // Admin succeeds
  const adminReq = createMockReqRes({
    auth: { uid: 'admin-1', email: 'admin@tdtu.edu.vn', isAdmin: true },
    body: {
      folderId: 'datn-root-folder-123456789012345678',
      folderName: 'DATN Root Test',
      folderUrl: 'https://drive.google.com/drive/folders/datn-root-folder-123456789012345678',
    }
  });
  await saveDriveConfigHandler(adminReq.req, adminReq.res);
  assert.equal(adminReq.getStatus(), 200);
  assert.equal(adminReq.getBody().ok, true);
  assert.equal(adminReq.getBody().config.graduationRootFolderId, 'datn-root-folder-123456789012345678');
});
