/**
 * auth.js — Firebase ID token verification & Storage bucket for graduation API
 *
 * Verifies tokens issued by ifa-graduation, independently of the host project.
 * Provides access to ifa-activities Storage bucket.
 */

'use strict';

const admin = require('firebase-admin');
const { getDocument } = require('./firestore.js');

const GRADUATION_PROJECT_ID = 'ifa-graduation';
const IFA_PROJECT_ID = 'ifa-activities';
const IFA_STORAGE_BUCKET = 'ifa-activities.firebasestorage.app';

let gradApp;
let ifaApp;

const existingApps = admin.apps;
gradApp = existingApps.find(a => a.name === 'graduationAuth');
if (gradApp && gradApp.options.projectId !== GRADUATION_PROJECT_ID) {
  throw new Error('GRADUATION_AUTH_PROJECT_MISMATCH');
}
if (!gradApp) {
  gradApp = admin.initializeApp({ projectId: GRADUATION_PROJECT_ID }, 'graduationAuth');
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
  const decodedToken = await gradApp.auth().verifyIdToken(idToken);
  
  const email = (decodedToken.email || '').toLowerCase().trim();
  const uid = decodedToken.uid || '';
  if (!email) throw new Error('Token missing email claim');

  // MSSV@student.tdtu.edu.vn -> studentId = MSSV (uppercased)
  const studentMatch = email.match(/^([^@]+)@student\.tdtu\.edu\.vn$/i);
  const studentId = studentMatch ? studentMatch[1].toUpperCase() : null;

  // Admin determination:
  // 1. System owner
  let isAdmin = (email === 'tranquanghai@tdtu.edu.vn');

  // 2. Admins collection on ifa-graduation
  if (!isAdmin) {
    try {
      const adminDoc = await getDocument('admins/' + encodeURIComponent(email), idToken);
      if (adminDoc) {
        isAdmin = true;
      }
    } catch (e) {
      console.warn('[auth] Could not check admins collection on ifa-graduation:', e.message);
    }
  }

  return { uid, email, studentId, isAdmin };
}

/**
 * Express middleware: reads Bearer token, verifies, attaches req.auth.
 */
async function requireAuth(req, res, next) {
  if (req.auth) return next();
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return typeof next === 'function' ? next(new Error('MISSING_AUTH_HEADER')) : undefined;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty Bearer token' });
    return typeof next === 'function' ? next(new Error('EMPTY_TOKEN')) : undefined;
  }

  try {
    req.auth = await verifyIdToken(idToken);
    next();
  } catch (err) {
    console.error('[auth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
    return typeof next === 'function' ? next(err) : undefined;
  }
}

/**
 * Middleware: requires @student.tdtu.edu.vn account or admin.
 */
async function requireStudentAuth(req, res, next) {
  await requireAuth(req, res, (err) => {
    if (err) return typeof next === 'function' ? next(err) : undefined;
    if (!req.auth.studentId && !req.auth.isAdmin) {
      res.status(403).json({
        error: 'Chỉ sinh viên hoặc giảng viên TDTU mới có thể nộp hồ sơ xét tốt nghiệp',
      });
      return typeof next === 'function' ? next(new Error('FORBIDDEN_STUDENT_REQUIRED')) : undefined;
    }
    next();
  });
}

/**
 * Middleware: requires Admin privileges (system owner or in admins collection).
 */
async function requireAdminAuth(req, res, next) {
  await requireAuth(req, res, (err) => {
    if (err) return typeof next === 'function' ? next(err) : undefined;
    if (!req.auth.isAdmin) {
      res.status(403).json({
        error: 'Chỉ quản trị viên mới có quyền thực hiện thao tác này',
      });
      return typeof next === 'function' ? next(new Error('FORBIDDEN_ADMIN_REQUIRED')) : undefined;
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
