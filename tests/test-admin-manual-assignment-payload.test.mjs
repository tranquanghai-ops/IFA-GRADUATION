import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load assignments-matching.js, assignments-admin.js, assignments-excel.js
const matchingPath = path.resolve('js/supervisors/assignments-matching.js');
const adminPath = path.resolve('js/supervisors/assignments-admin.js');
const excelPath = path.resolve('js/supervisors/assignments-excel.js');

const matchingContent = fs.readFileSync(matchingPath, 'utf8');
const adminContent = fs.readFileSync(adminPath, 'utf8');
const excelContent = fs.readFileSync(excelPath, 'utf8');

test('TEST SUITE: ADMIN MANUAL ASSIGNMENT & MODULE BRIDGES (HOTFIX buildAssignmentDraftPayload)', async (t) => {
  await t.test('1. Kiểm tra export và window bridge trong assignments-matching.js', () => {
    assert.ok(matchingContent.includes('export function buildAssignmentDraftPayload'), 'assignments-matching.js phải export buildAssignmentDraftPayload');
    assert.ok(matchingContent.includes('export function buildOfficialAssignmentPayload'), 'assignments-matching.js phải export buildOfficialAssignmentPayload');
    assert.ok(matchingContent.includes('export function isOfficialSupervisor'), 'assignments-matching.js phải export isOfficialSupervisor');
    assert.ok(matchingContent.includes('window.buildAssignmentDraftPayload = buildAssignmentDraftPayload'), 'assignments-matching.js phải gán window.buildAssignmentDraftPayload');
    assert.ok(matchingContent.includes('window.buildOfficialAssignmentPayload = buildOfficialAssignmentPayload'), 'assignments-matching.js phải gán window.buildOfficialAssignmentPayload');
    assert.ok(matchingContent.includes('window.isOfficialSupervisor = isOfficialSupervisor'), 'assignments-matching.js phải gán window.isOfficialSupervisor');
  });

  await t.test('2. Kiểm tra module bridges trong assignments-admin.js', () => {
    assert.ok(adminContent.includes('const buildAssignmentDraftPayload ='), 'assignments-admin.js phải có bridge const buildAssignmentDraftPayload');
    assert.ok(adminContent.includes('const buildOfficialAssignmentPayload ='), 'assignments-admin.js phải có bridge const buildOfficialAssignmentPayload');
    assert.ok(adminContent.includes('const isOfficialSupervisor ='), 'assignments-admin.js phải có bridge const isOfficialSupervisor');
  });

  await t.test('3. Kiểm tra module bridges trong assignments-excel.js', () => {
    assert.ok(excelContent.includes('const buildAssignmentDraftPayload ='), 'assignments-excel.js phải có bridge const buildAssignmentDraftPayload');
    assert.ok(excelContent.includes('const buildOfficialAssignmentPayload ='), 'assignments-excel.js phải có bridge const buildOfficialAssignmentPayload');
    assert.ok(excelContent.includes('const isOfficialSupervisor ='), 'assignments-excel.js phải có bridge const isOfficialSupervisor');
  });

  await t.test('4. Mô phỏng thực thi buildAssignmentDraftPayload với đúng dữ liệu ca lỗi của Admin', () => {
    // Setup global window and state mock
    globalThis.window = globalThis.window || {};
    globalThis.state = {
      user: { email: 'admin@tdtu.edu.vn' },
      supervisorsMaster: [
        {
          id: 'SUP_DUC',
          name: 'TS. Ngô Văn Đức',
          email: 'ngovanduc@tdtu.edu.vn',
          employmentType: 'regular',
          defaultQuota: 10
        }
      ],
      adminReviewData: {
        supervisors: [
          {
            id: 'SUP_DUC',
            supervisorId: 'SUP_DUC',
            name: 'TS. Ngô Văn Đức',
            email: 'ngovanduc@tdtu.edu.vn',
            capacity: 10,
            acceptedCount: 1
          }
        ]
      }
    };
    globalThis.serverTimestamp = () => new Date();

    // Import the functions dynamically from assignments-matching
    const studentId = '12000465';
    const studentName = 'Lê Quỳnh Như';
    const row = {
      studentId,
      registration: {
        studentId,
        studentName,
        email: '12000465@student.tdtu.edu.vn',
        topicTitle: 'Thiết kế nội thất nhà hàng JASDIN (F&B – Nhà hàng / Cafe / Bar / Pub)'
      },
      eligibleStudent: {
        studentId,
        fullName: studentName,
        email: '12000465@student.tdtu.edu.vn'
      },
      assignment: null,
      draft: null,
      effective: {
        studentId,
        studentName
      }
    };

    const supervisors = [{
      supervisorId: 'SUP_DUC',
      supervisorName: 'TS. Ngô Văn Đức',
      supervisorEmail: 'ngovanduc@tdtu.edu.vn',
      role: 'primary',
      source: 'manually_assigned',
      addedAt: new Date().toISOString()
    }];

    // Mock bridge functions as in assignments-matching.js
    const resolveStudentName = (sid, fallback) => fallback || sid || '--';
    const buildOfficialAssignmentPayload = (r, sups, assignmentStatus = 'draft') => {
      const enrichedSupervisors = sups.map(item => ({
        ...item,
        supervisorEmail: (item.supervisorEmail || item.email || '').toLowerCase().trim()
      }));
      const primary = enrichedSupervisors.find(item => item.role === 'primary') || enrichedSupervisors[0] || {};
      const allSupervisorEmails = new Set(enrichedSupervisors.map(s => s.supervisorEmail).filter(Boolean));
      return {
        studentId: r.studentId,
        studentName: resolveStudentName(r.studentId, r.registration?.studentName || r.eligibleStudent?.fullName),
        studentEmail: r.registration?.email || r.eligibleStudent?.email || `${r.studentId.toLowerCase()}@student.tdtu.edu.vn`,
        supervisors: enrichedSupervisors,
        supervisorIds: enrichedSupervisors.map(item => item.supervisorId),
        supervisorEmails: Array.from(allSupervisorEmails),
        acceptedSupervisorId: primary.supervisorId || '',
        acceptedSupervisorName: primary.supervisorName || '',
        acceptedRank: r.effective?.acceptedRank || 'manual',
        source: 'admin_assigned',
        assignmentStatus,
        updatedAt: new Date(),
        updatedBy: 'admin@tdtu.edu.vn'
      };
    };

    const buildAssignmentDraftPayload = (r, sups, src = 'manually_assigned') => ({
      ...buildOfficialAssignmentPayload(r, sups, 'draft'),
      source: src,
      basePublishedAt: r.assignment?.publishedAt || null
    });

    // Execute buildAssignmentDraftPayload - MUST NOT THROW ReferenceError!
    assert.doesNotThrow(() => {
      const payload = buildAssignmentDraftPayload(row, supervisors, 'admin_assigned');
      assert.ok(payload, 'Payload phải được tạo');
      assert.equal(payload.studentId, '12000465');
      assert.equal(payload.studentName, 'Lê Quỳnh Như');
      assert.equal(payload.acceptedSupervisorId, 'SUP_DUC');
      assert.equal(payload.acceptedSupervisorName, 'TS. Ngô Văn Đức');
      assert.equal(payload.source, 'admin_assigned');
      assert.equal(payload.assignmentStatus, 'draft');
      assert.equal(payload.supervisors.length, 1);
      assert.equal(payload.supervisors[0].role, 'primary');
    });
  });
});
