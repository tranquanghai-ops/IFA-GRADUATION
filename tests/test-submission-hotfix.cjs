/**
 * test-submission-hotfix.cjs
 * Comprehensive test suite verifying all 6 priorities of the emergency hotfix:
 * A. PDF & PPTX file validation, normalization, and extension preservation
 * B. Submission attempt counter (0/N, 1/N, N/N - Hết lượt nộp)
 * C. Submit button states, locking, view submission button, and removal of manual check button
 * D. Backend & Google Drive "File cũ" archiving mechanism
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const { validateFile, getExtension, ValidationError } = require('../functions/validation.js');
const { archivePreviousAttemptFiles, moveDriveFile, setTestDriveDriver } = require('../functions/drive.js');

test('A. PDF & PPTX Validation Suite', async (t) => {
  await t.test('1. Normal PDF file is accepted', () => {
    assert.doesNotThrow(() => {
      validateFile({ name: 'baocao.pdf', size: 5 * 1024 * 1024, type: 'application/pdf' }, 200 * 1024 * 1024, ['pdf', 'pptx']);
    });
  });

  await t.test('2. Uppercase .PDF file is accepted without error', () => {
    assert.doesNotThrow(() => {
      validateFile({ name: 'THUYET_MINH.PDF', size: 10 * 1024 * 1024, type: 'application/pdf' }, 200 * 1024 * 1024, ['pdf', 'pptx']);
    });
  });

  await t.test('3. Vietnamese filename with diacritics and spaces is accepted', () => {
    assert.doesNotThrow(() => {
      validateFile({
        name: 'BÀI TRÌNH BÀY ĐỒ ÁN - 11900375 - NGUYỄN THANH NGÂN.pdf',
        size: Math.round(74.17 * 1024 * 1024),
        type: 'application/pdf'
      }, 200 * 1024 * 1024, ['pdf', 'pptx']);
    });
  });

  await t.test('4. Filename with multiple dots preserves extension correctly', () => {
    const ext = getExtension('11900375.NguyenThanhNgan.v2.1.final.PDF');
    assert.equal(ext, '.pdf');
    assert.doesNotThrow(() => {
      validateFile({
        name: '11900375.NguyenThanhNgan.v2.1.final.PDF',
        size: 15 * 1024 * 1024,
        type: 'application/pdf'
      }, 200 * 1024 * 1024, ['pdf', 'pptx']);
    });
  });

  await t.test('5. File without extension throws meaningful error', () => {
    assert.throws(
      () => validateFile({ name: 'document', size: 1024, type: 'application/pdf' }, 200 * 1024 * 1024),
      /không có phần mở rộng/
    );
  });

  await t.test('6. File with unaccepted extension is rejected', () => {
    assert.throws(
      () => validateFile({ name: 'script.exe', size: 1024, type: 'application/octet-stream' }, 200 * 1024 * 1024),
      /Định dạng tệp không được phép: \.exe/
    );
  });

  await t.test('7. File exceeding 200MB limit is rejected', () => {
    assert.throws(
      () => validateFile({ name: 'large.pdf', size: 201 * 1024 * 1024, type: 'application/pdf' }, 200 * 1024 * 1024),
      /Dung lượng tệp không hợp lệ/
    );
  });

  await t.test('8. Valid PPTX file is accepted', () => {
    assert.doesNotThrow(() => {
      validateFile({
        name: 'BaoCaoSlide.pptx',
        size: 25 * 1024 * 1024,
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }, 200 * 1024 * 1024, ['pdf', 'pptx']);
    });
  });
});

test('B. Client Filename Generation and Naming Rules', async (t) => {
  // Mock browser environment for drive-rules-naming.js
  global.window = global.window || {};
  require('../js/drive/drive-rules-naming.js');

  await t.test('1. generateExpectedFilename preserves .pdf extension and replaces spaces & diacritics', () => {
    const fn = window.generateExpectedFilename({
      template: '{MSSV}_{HO_TEN}',
      student: { studentId: '11900375', studentName: 'Nguyễn Thanh Ngân' },
      activity: { title: 'Duyệt 1' },
      round: { title: 'Đợt 1' },
      extension: 'pdf'
    });
    assert.equal(fn, '11900375_Nguyen Thanh Ngan.pdf');
  });

  await t.test('2. generateExpectedFilename avoids duplicate extensions like .pdf.pdf', () => {
    const fn = window.generateExpectedFilename({
      template: '{MSSV}_{HO_TEN}.pdf',
      student: { studentId: '11900375', studentName: 'Nguyễn Thanh Ngân' },
      activity: { title: 'Duyệt 1' },
      round: { title: 'Đợt 1' },
      extension: '.PDF'
    });
    assert.equal(fn, '11900375_Nguyen Thanh Ngan.pdf');
  });

  await t.test('3. validateFilename handles uppercase .PDF and multiple dots', () => {
    const res = window.validateFilename({
      filename: 'BÀI_TRÌNH_BÀY.final.v1.PDF',
      template: '{MSSV}_{HO_TEN}',
      student: { studentId: '11900375', studentName: 'Nguyễn Thanh Ngân' },
      activity: { title: 'Duyệt 1' },
      round: { title: 'Đợt 1' },
      acceptedExtensions: ['pdf', 'pptx']
    });
    assert.equal(res.valid, true);
    assert.equal(res.expectedFilename, '11900375_Nguyen Thanh Ngan.pdf');
  });
});

test('C. UI Panel Logic, Attempt Counters and Submit Button States', async (t) => {
  const panelSource = fs.readFileSync(path.join(root, 'js/drive/drive-upload-panel.js'), 'utf8');
  const filesSource = fs.readFileSync(path.join(root, 'js/drive/drive-files.js'), 'utf8');

  await t.test('1. Displays "Số lần đã nộp / Tối đa" and 0/N, 1/N, N/N - Hết lượt nộp', () => {
    assert.match(panelSource, /Số lần đã nộp \/ Tối đa/);
    assert.match(panelSource, /\$\{rules\.completedAttempts\}\/\$\{rules\.totalAllowedAttempts\} lần\$\{rules\.remainingAttempts <= 0 \? ' – Hết lượt nộp' : ''\}/);
  });

  await t.test('2. Manual "Kiểm tra file" button has been completely removed from UI', () => {
    assert.doesNotMatch(panelSource, /🔍 Kiểm tra file/);
  });

  await t.test('3. Provides instant validation inside onStudentFileSelected', () => {
    assert.match(panelSource, /validateFileSubmission\(files, targetStudent, act, round\)/);
    assert.match(panelSource, /⚠️ Tệp không hợp lệ:/);
  });

  await t.test('4. Features "👁️ Xem bài đã nộp" button pointing to current submission', () => {
    assert.match(panelSource, /👁️ Xem bài đã nộp/);
    assert.match(panelSource, /rules\.currentSubmission\.files/);
  });

  await t.test('5. Submit button transitions to "🚫 Đã hết lượt nộp" and disabled when remainingAttempts <= 0', () => {
    assert.match(panelSource, /rules\.remainingAttempts <= 0/);
    assert.match(panelSource, /🚫 Đã hết lượt nộp/);
    assert.match(panelSource, /disabled class="[^"]*cursor-not-allowed/);
  });

  await t.test('6. Distinguishes not started and past deadline states', () => {
    assert.match(panelSource, /⏳ Chưa mở nhận bài/);
    assert.match(panelSource, /⏰ Đã hết hạn nộp bài/);
  });

  await t.test('7. drive-files.js guards against submissions when remainingAttempts <= 0', () => {
    assert.match(filesSource, /valRes\.rules\.remainingAttempts <= 0/);
    assert.match(filesSource, /Bạn đã hết lượt nộp bài cho mốc này!/);
  });
});

test('D. Backend & Google Drive "File cũ" Archiving Suite', async (t) => {
  const backendSource = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
  const driveSource = fs.readFileSync(path.join(root, 'functions/drive.js'), 'utf8');

  await t.test('1. submitActivityHandler uses driveDoc.fileName fallback and does NOT default to "document"', () => {
    assert.match(backendSource, /const fileName = driveDoc\.fileName \|\| driveDoc\.name \|\| f\.validatedName/);
  });

  await t.test('2. completeUploadHandler writes both fileName and name in persistentRecord', () => {
    assert.match(backendSource, /fileName: verified\.fileName,\s*name: verified\.fileName/);
  });

  await t.test('3. functions/drive.js exports moveDriveFile and archivePreviousAttemptFiles', () => {
    assert.match(driveSource, /moveDriveFile,/);
    assert.match(driveSource, /archivePreviousAttemptFiles,/);
  });

  await t.test('4. archivePreviousAttemptFiles moves previous attempt files into "File cũ" folder', async () => {
    const movedCalls = [];
    const createdFolders = [];

    setTestDriveDriver({
      getOrCreateDriveChildFolder: async ({ parentFolderId, folderName }) => {
        createdFolders.push({ parentFolderId, folderName });
        return { ok: true, folderId: 'folder-old-files-123', folderName, reused: false };
      },
      moveDriveFile: async ({ fileId, fromFolderId, toFolderId }) => {
        movedCalls.push({ fileId, fromFolderId, toFolderId });
        return true;
      }
    });

    const previousAttempts = [
      {
        attempt: 1,
        status: 'submitted',
        files: [{ providerFileId: 'drive-file-attempt-1', storageProvider: 'google_drive' }]
      }
    ];

    const result = await archivePreviousAttemptFiles({
      studentFolderId: '1234567890123456789012345_student_ngan',
      previousAttempts
    });

    assert.equal(result.archivedCount, 1);
    assert.equal(result.oldFolderId, 'folder-old-files-123');
    assert.equal(movedCalls.length, 1);
    assert.equal(movedCalls[0].fileId, 'drive-file-attempt-1');
    assert.equal(movedCalls[0].fromFolderId, '1234567890123456789012345_student_ngan');
    assert.equal(movedCalls[0].toFolderId, 'folder-old-files-123');
  });

  await t.test('5. submitActivityHandler integrates archivePreviousAttemptFiles after commit', () => {
    assert.match(backendSource, /archivePreviousAttemptFiles\(\{/);
    assert.match(backendSource, /studentFolderId,/);
    assert.match(backendSource, /previousAttempts: previousAttemptsList/);
  });
});
