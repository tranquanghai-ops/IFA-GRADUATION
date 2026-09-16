/**
 * auth.js — Firebase ID token verification for graduation upload API
 *
 * Verifies tokens issued by tknt-tdtu project using Google public certs.
 * Does NOT require service account credentials — public key only.
 */

'use strict';

const { OAuth2Client } = require('google-auth-library');

const TKNT_TDTU_PROJECT_ID = 'tknt-tdtu';
const oauthClient = new OAuth2Client();

/**
 * Verifies a Firebase ID token from the tknt-tdtu project.
 * @param {string} idToken
 * @returns {{ uid, email, studentId }}
 */
async function verifyIdToken(idToken) {
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: TKNT_TDTU_PROJECT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error('Token payload empty after verification');

  const expectedIssuer = 'https://securetoken.google.com/' + TKNT_TDTU_PROJECT_ID;
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer: ' + payload.iss);
  }

  const email = payload.email || '';
  const uid = payload.sub || '';
  if (!email) throw new Error('Token missing email claim');

  // MSSV@student.tdtu.edu.vn → studentId = MSSV (uppercased)
  const studentMatch = email.match(/^([^@]+)@student\.tdtu\.edu\.vn$/i);
  const studentId = studentMatch ? studentMatch[1].toUpperCase() : null;

  return { uid, email, studentId };
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
 * Middleware: requires @student.tdtu.edu.vn account.
 */
async function requireStudentAuth(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.auth.studentId) {
      return res.status(403).json({
        error: 'Chỉ sinh viên TDTU mới có thể nộp hồ sơ xét tốt nghiệp',
      });
    }
    next();
  });
}

module.exports = { verifyIdToken, requireAuth, requireStudentAuth };
