const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Admin Management & Two-Tier Owner Privilege Governance Suite', async (t) => {
  const adminHtml = read('views/admin.html');
  const tabAdminManagementHtml = read('views/admin/tab-admin-management.html');
  const tabSettingsHtml = read('views/admin/tab-settings.html');
  const modalAddAdminHtml = read('templates/modals/shared/modal-add-admin.html');
  const indexHtml = read('index.html');
  const adminMgmtSource = read('js/admin-management.js');
  const authSource = read('js/auth.js');
  const coreSource = read('js/core.js');
  const matchingSource = read('js/supervisors/assignments-matching.js');
  const impSettingsSource = read('js/impersonation/impersonation-settings.js');
  const impModalSource = read('js/impersonation/impersonation-modal.js');
  const impSessionSource = read('js/impersonation/impersonation-session.js');
  const firestoreRules = read('firestore.rules');
  const functionsAuth = read('functions/auth.js');

  await t.test('1. Two-Tier Admin & Root Owner Security Architecture', () => {
    // Root owner identification
    assert.match(adminMgmtSource, /ROOT_OWNER_EMAIL\s*=\s*'tranquanghai@tdtu\.edu\.vn'/);
    assert.match(authSource, /email\s*===\s*'tranquanghai@tdtu\.edu\.vn'/);

    // Initial state sets isOwner and realIsOwner
    assert.match(coreSource, /isOwner:\s*false/);
    assert.match(coreSource, /realIsOwner:\s*false/);
    assert.match(authSource, /state\.realIsOwner\s*=\s*isSystemOwner\(user\)/);
    assert.match(authSource, /state\.isOwner\s*=\s*state\.realIsOwner/);

    // Cloud Functions verifyIdToken returns isOwner boolean
    assert.match(functionsAuth, /const isOwner = \(email === 'tranquanghai@tdtu\.edu\.vn'\);/);
    assert.match(functionsAuth, /return \{ uid, email, studentId, isAdmin, isOwner \};/);
  });

  await t.test('2. Admin Management (Quản lý Admin) UI & Compiled Templates', () => {
    // views/admin.html defines owner section in sidebar
    assert.match(adminHtml, /id="admin-nav-owner-section"/);
    assert.match(adminHtml, /Hệ thống \(Owner\)/);
    assert.match(adminHtml, /id="atab-btn-admin-management"/);
    assert.match(adminHtml, /switchAdminTab\('admin-management'\)/);
    assert.match(adminHtml, /<!-- PARTIAL:views\/admin\/tab-admin-management\.html -->/);

    // views/admin/tab-admin-management.html structure
    assert.match(tabAdminManagementHtml, /id="atab-panel-admin-management"/);
    assert.match(tabAdminManagementHtml, /id="stat-total-admins"/);
    assert.match(tabAdminManagementHtml, /id="stat-owner-count"/);
    assert.match(tabAdminManagementHtml, /id="stat-business-admins"/);
    assert.match(tabAdminManagementHtml, /id="admin-management-search"/);
    assert.match(tabAdminManagementHtml, /id="admins-list-tbody"/);
    assert.match(tabAdminManagementHtml, /openAddAdminModal\(\)/);

    // templates/modals/shared/modal-add-admin.html
    assert.match(modalAddAdminHtml, /id="modal-add-admin"/);
    assert.match(modalAddAdminHtml, /id="form-add-admin"/);
    assert.match(modalAddAdminHtml, /id="add-admin-email"/);
    assert.match(modalAddAdminHtml, /id="add-admin-fullname"/);
    assert.match(modalAddAdminHtml, /id="btn-submit-add-admin"/);
    assert.match(modalAddAdminHtml, /submitAddAdmin\(event\)/);

    // Compiled index.html contains the compiled markup
    assert.match(indexHtml, /id="atab-panel-admin-management"/);
    assert.match(indexHtml, /id="modal-add-admin"/);
    assert.match(indexHtml, /id="admin-nav-owner-section"/);
  });

  await t.test('3. Admin Management Logic & Safeguards (js/admin-management.js)', () => {
    // Exports standard API methods
    assert.match(adminMgmtSource, /window\.loadAdminsList\s*=\s*loadAdminsList/);
    assert.match(adminMgmtSource, /window\.openAddAdminModal\s*=\s*openAddAdminModal/);
    assert.match(adminMgmtSource, /window\.closeAddAdminModal\s*=\s*closeAddAdminModal/);
    assert.match(adminMgmtSource, /window\.submitAddAdmin\s*=\s*submitAddAdmin/);
    assert.match(adminMgmtSource, /window\.revokeAdmin\s*=\s*revokeAdmin/);

    // Real Owner authorization guards
    assert.match(adminMgmtSource, /if \(!state\.realIsOwner\) \{[\s\S]*?return;/);
    assert.match(adminMgmtSource, /if \(!state\.realIsOwner\) \{\s*showToast\('Từ chối truy cập/);

    // Root owner immutability protection
    assert.match(adminMgmtSource, /if \(normalizedEmail === ROOT_OWNER_EMAIL\) \{\s*showToast\('Không thể thu hồi/);

    // Email normalization, deduplication & Firestore persistence
    assert.match(adminMgmtSource, /const normalizedEmail = \(rawEmail \|\| ''\)\.toLowerCase\(\)\.trim\(\);/);
    assert.match(adminMgmtSource, /doc\(db, 'admins', normalizedEmail\)/);
    assert.match(adminMgmtSource, /setDoc\(adminDocRef,/);
    assert.match(adminMgmtSource, /deleteDoc\(adminDocRef\)/);

    // Audit logging on grant and revoke
    assert.match(adminMgmtSource, /action: 'grant_admin'/);
    assert.match(adminMgmtSource, /action: 'revoke_admin'/);
    assert.match(adminMgmtSource, /targetEmail: normalizedEmail/);
    assert.match(adminMgmtSource, /collection\(db, 'auditLogs'\)/);
  });

  await t.test('4. System Settings & Exact Act-As Restricted Strictly to Owner', () => {
    // Title updated in System Settings
    assert.match(tabSettingsHtml, /Cho phép Owner đóng vai người dùng \(Exact Act-As Test Mode\)/);

    // Tab switching security barrier in assignments-matching.js
    assert.match(matchingSource, /if \(\(tabKey === 'admin-management' \|\| tabKey === 'system-settings'\) && !state\.realIsOwner\)/);
    assert.match(matchingSource, /tabKey = 'rounds';/);

    // Header Impersonate button and Owner Nav Section in auth.js
    assert.match(authSource, /if \(state\.realIsOwner && state\.allowImpersonation && !isImp\)/);
    assert.match(authSource, /if \(state\.realIsOwner\) \{\s*ownerNavSection\.classList\.remove\('hidden'\);/);

    // Settings loader & toggles in impersonation-settings.js
    assert.match(impSettingsSource, /const isOwner = Boolean\(isSystemOwner\(\) \|\| state\.realIsOwner\);/);
    assert.match(impSettingsSource, /if \(!isOwner\) \{[\s\S]*?switchAdminTab\('rounds'\)/);
    assert.match(impSettingsSource, /if \(!isSystemOwner\(\)\) \{\s*showToast\('Chỉ Chủ sở hữu hệ thống/);

    // Impersonation modal & session guards
    assert.match(impModalSource, /if \(!state\.allowImpersonation \|\| !state\.realIsOwner\)/);
    assert.match(impSessionSource, /if \(!state\.realIsOwner\)/);

    // Impersonation write protection in core.js
    assert.match(coreSource, /if \(!state\.realIsOwner\) \{[\s\S]*?Chỉ Chủ sở hữu hệ thống \(Owner\) mới được phép/);
  });

  await t.test('5. Firestore Security Rules Enforcement', () => {
    // Admin collection rules
    assert.match(firestoreRules, /match \/admins\/\{adminEmail\} \{/);
    assert.match(firestoreRules, /allow get: if owner\(\) \|\| \(signedIn\(\) && email\(\) == adminEmail\);/);
    assert.match(firestoreRules, /allow list: if owner\(\);/);
    assert.match(firestoreRules, /allow create, update: if owner\(\) && request\.resource\.data\.email == adminEmail;/);
    assert.match(firestoreRules, /allow delete: if owner\(\) && adminEmail != 'tranquanghai@tdtu.edu.vn';/);

    // System settings rule
    assert.match(firestoreRules, /match \/settings\/main \{/);
    assert.match(firestoreRules, /allow create, update, delete: if owner\(\);/);

    // Audit logs rule
    assert.match(firestoreRules, /match \/auditLogs\/\{logId\} \{/);
    assert.match(firestoreRules, /allow create: if \(admin\(\) && request\.resource\.data\.actorEmail == email\(\)\)/);
  });
});
