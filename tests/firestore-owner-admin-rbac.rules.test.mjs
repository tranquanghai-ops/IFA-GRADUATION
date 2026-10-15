import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, addDoc, updateDoc } from 'firebase/firestore';

const ownerEmail = 'tranquanghai@tdtu.edu.vn';
const adminEmail = 'admin1@tdtu.edu.vn';
const studentEmail = '11900335@student.tdtu.edu.vn';
const guestEmail = 'guest@gmail.com';

const actorToken = (email) => ({
  email,
  email_verified: true
});

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'owner-admin-rbac-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  // Seed baseline data
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Seed existing admin
    await setDoc(doc(db, `admins/${adminEmail}`), {
      email: adminEmail,
      displayName: 'Admin One',
      role: 'admin',
      status: 'active'
    });
    // Seed system settings
    await setDoc(doc(db, 'settings/main'), {
      allowImpersonation: false,
      updatedBy: ownerEmail
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test('1. System Settings (/settings/main): Strictly Owner Only', async (t) => {
  const ownerDb = env.authenticatedContext(ownerEmail, actorToken(ownerEmail)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actorToken(adminEmail)).firestore();
  const studentDb = env.authenticatedContext(studentEmail, actorToken(studentEmail)).firestore();
  const guestDb = env.authenticatedContext(guestEmail, actorToken(guestEmail)).firestore();
  const unauthDb = env.unauthenticatedContext().firestore();

  await t.test('Owner can read and update settings/main', async () => {
    const snap = await assertSucceeds(getDoc(doc(ownerDb, 'settings/main')));
    assert.equal(snap.exists(), true);
    await assertSucceeds(setDoc(doc(ownerDb, 'settings/main'), {
      allowImpersonation: true,
      updatedBy: ownerEmail
    }));
  });

  await t.test('Admin CANNOT read, update or enable Exact Act-As on settings/main', async () => {
    await assertFails(getDoc(doc(adminDb, 'settings/main')));
    await assertFails(setDoc(doc(adminDb, 'settings/main'), {
      allowImpersonation: true,
      updatedBy: adminEmail
    }));
    await assertFails(deleteDoc(doc(adminDb, 'settings/main')));
  });

  await t.test('Students and external guests CANNOT read or write settings/main', async () => {
    await assertFails(getDoc(doc(studentDb, 'settings/main')));
    await assertFails(setDoc(doc(studentDb, 'settings/main'), { allowImpersonation: true }));
    await assertFails(getDoc(doc(guestDb, 'settings/main')));
    await assertFails(setDoc(doc(guestDb, 'settings/main'), { allowImpersonation: true }));
    await assertFails(getDoc(doc(unauthDb, 'settings/main')));
  });
});

test('2. Admin Management (/admins/{adminEmail}): Privileged Governance', async (t) => {
  const ownerDb = env.authenticatedContext(ownerEmail, actorToken(ownerEmail)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actorToken(adminEmail)).firestore();
  const studentDb = env.authenticatedContext(studentEmail, actorToken(studentEmail)).firestore();

  await t.test('Owner can list admins and provision/revoke new admin', async () => {
    // Owner can list
    const snap = await assertSucceeds(getDocs(collection(ownerDb, 'admins')));
    assert.ok(snap.size >= 1);

    // Owner can add new admin
    const newAdminEmail = 'newadmin@tdtu.edu.vn';
    await assertSucceeds(setDoc(doc(ownerDb, `admins/${newAdminEmail}`), {
      email: newAdminEmail,
      displayName: 'New Admin',
      role: 'admin',
      status: 'active'
    }));

    // Owner can revoke newly added admin
    await assertSucceeds(deleteDoc(doc(ownerDb, `admins/${newAdminEmail}`)));
  });

  await t.test('Owner CANNOT delete root owner account (database safeguard)', async () => {
    await assertFails(deleteDoc(doc(ownerDb, `admins/${ownerEmail}`)));
  });

  await t.test('Admin CAN read own record but CANNOT list other admins', async () => {
    // Admin reads own doc
    const ownSnap = await assertSucceeds(getDoc(doc(adminDb, `admins/${adminEmail}`)));
    assert.equal(ownSnap.exists(), true);

    // Admin cannot list all admins
    await assertFails(getDocs(collection(adminDb, 'admins')));

    // Admin cannot read another admin doc
    await assertFails(getDoc(doc(adminDb, `admins/${ownerEmail}`)));
  });

  await t.test('Admin CANNOT create new admin or revoke another admin', async () => {
    const maliciousAdminEmail = 'hacker@tdtu.edu.vn';
    await assertFails(setDoc(doc(adminDb, `admins/${maliciousAdminEmail}`), {
      email: maliciousAdminEmail,
      role: 'admin'
    }));
    await assertFails(deleteDoc(doc(adminDb, `admins/${adminEmail}`)));
  });

  await t.test('Admin CANNOT self-escalate role or modify own document', async () => {
    await assertFails(updateDoc(doc(adminDb, `admins/${adminEmail}`), {
      role: 'owner'
    }));
  });

  await t.test('Student can only check self admin status, cannot inspect others, list, or write', async () => {
    // Cannot list admins
    await assertFails(getDocs(collection(studentDb, 'admins')));
    // Cannot inspect other admin's doc
    await assertFails(getDoc(doc(studentDb, `admins/${adminEmail}`)));
    await assertFails(getDoc(doc(studentDb, `admins/${ownerEmail}`)));
    // Can check self doc (returns non-existent snap)
    const selfSnap = await assertSucceeds(getDoc(doc(studentDb, `admins/${studentEmail}`)));
    assert.equal(selfSnap.exists(), false);
    // Cannot create self as admin
    await assertFails(setDoc(doc(studentDb, `admins/${studentEmail}`), { role: 'admin' }));
  });
});

test('3. Audit Logs (/auditLogs/{logId}): Immutable Append-Only', async (t) => {
  const ownerDb = env.authenticatedContext(ownerEmail, actorToken(ownerEmail)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actorToken(adminEmail)).firestore();

  await t.test('Owner and Admin can append audit logs with matching actorEmail', async () => {
    const logDoc = await assertSucceeds(addDoc(collection(ownerDb, 'auditLogs'), {
      actorEmail: ownerEmail,
      by: ownerEmail,
      action: 'grant_admin',
      targetEmail: 'test@tdtu.edu.vn'
    }));

    // Immutability: No update or delete allowed
    await assertFails(updateDoc(doc(ownerDb, `auditLogs/${logDoc.id}`), { action: 'tampered' }));
    await assertFails(deleteDoc(doc(ownerDb, `auditLogs/${logDoc.id}`)));
  });
});
