/**
 * auth.js — Firebase ID token verification & Storage bucket for graduation API
 *
 * Verifies tokens issued by tknt-tdtu project using Google public certs.
 * Provides access to ifa-activities Storage bucket.
 */

'use strict';

const admin = require('firebase-admin');
const { getDocument } = require('./firestore.js');

const TKNT_TDTU_PROJECT_ID = 'tknt-tdtu';
const IFA_PROJECT_ID = 'ifa-activities';
const IFA_STORAGE_BUCKET = 'ifa-activities.firebasestorage.app';

let tkntApp;
let ifaApp;

const existingApps = admin.apps;
const defaultApp = existingApps.find(a => a.name === '[DEFAULT]');

if (!defaultApp) {
  tkntApp = admin.initializeApp({ projectId: TKNT_TDTU_PROJECT_ID });
} else {
  tkntApp = defaultApp;
}

ifaApp = existingApps.find(a => a.name === 'ifaStorage');
if (!ifaApp) {
  ifaApp = admin.initializeApp({
    projectId: IFA_PROJECT_ID,
    storageBucket: IFA_STORAGE_BUCKET,
  }, 'ifaStorage');
}

function getStorageBucket() {
  return ifaApp.storage().bucket(IFA_STORAGE_BUCKET);
}

async function verifyIdToken(idToken) {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  
  const email = (decodedToken.email || '').toLowerCase().trim();
  const uid = decodedToken.uid || '';
  if (!email) throw new Error('Token missing email claim');

  // MSSV@student.tdtu.edu.vn -> studentId = MSSV (uppercased)
  const studentMatch = email.match(/^([^@]+)@student\.tdtu\.edu\.vn$/i);
  const studentId = studentMatch ? studentMatch[1].toUpperCase() : null;

  // Admin determination:
  // 1. System owner
  let isAdmin = (email === 'tranquanghai@tdtu.edu.vn');

  // 2. Admins collection on tknt-tdtu
  if (!isAdmin) {
    try {
      const adminDoc = await getDocument('admins/' + encodeURIComponent(email), idToken);
      if (adminDoc) {
        isAdmin = true;
      }
    } catch (e) {
      console.warn('[auth] Could not check admins collection on tknt-tdtu:', e.message);
    }
  }

  return { uid, email, studentId, isAdmin };
}

/**
 * Express middleware: reads Bearer token, verifies, attaches req.auth.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return res.status(401).json({ error: 'Empty Bearer token' });

  try {
    req.auth = await verifyIdToken(idToken);
    next();
  } catch (err) {
    console.error('[auth] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: requires @student.tdtu.edu.vn account or admin.
 */
async function requireStudentAuth(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.auth.studentId && !req.auth.isAdmin) {
      return res.status(403).json({
        error: 'Chỉ sinh viên hoặc giảng viên TDTU mới có thể nộp hồ sơ xét tốt nghiệp',
      });
    }
    next();
  });
}

/**
 * Middleware: requires Admin privileges (system owner or in admins collection).
 */
async function requireAdminAuth(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.auth.isAdmin) {
      return res.status(403).json({
        error: 'Chỉ quản trị viên mới có quyền thực hiện thao tác này',
      });
    }
    next();
  });
}

module.exports = {
  verifyIdToken,
  requireAuth,
  requireStudentAuth,
  requireAdminAuth,
  getStorageBucket,
  IFA_STORAGE_BUCKET
};
