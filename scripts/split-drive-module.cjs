const fs = require('fs');
const path = require('path');

if (!fs.existsSync('js/drive')) {
  fs.mkdirSync('js/drive', { recursive: true });
}

const content = fs.readFileSync('js/drive.js', 'utf8');
const lines = content.split('\n');

// 1. drive-provisioning.js: Lines 1 - 1200
const provLines = [
  "/**\n * IFA+ Graduation — Google Drive Provisioning & Folder Structure Submodule\n */",
  ...lines.slice(0, 1200),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof ensureRoundDriveFolders !== 'undefined') window.ensureRoundDriveFolders = ensureRoundDriveFolders;
  if (typeof parseDriveFolderId !== 'undefined') window.parseDriveFolderId = parseDriveFolderId;
  if (typeof getDriveFolderUrl !== 'undefined') window.getDriveFolderUrl = getDriveFolderUrl;
}
`
];
fs.writeFileSync('js/drive/drive-provisioning.js', provLines.join('\n'), 'utf8');

// 2. drive-files.js: Lines 1201 - 2037
const fileLines = [
  "/**\n * IFA+ Graduation — Google Drive File Upload & Attachment Management Submodule\n */",
  "import { parseDriveFolderId, getDriveFolderUrl } from './drive-provisioning.js';",
  ...lines.slice(1200, 2037),
  `
// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof uploadFileToDrive !== 'undefined') window.uploadFileToDrive = uploadFileToDrive;
  if (typeof getDriveDownloadLink !== 'undefined') window.getDriveDownloadLink = getDriveDownloadLink;
}
`
];
fs.writeFileSync('js/drive/drive-files.js', fileLines.join('\n'), 'utf8');

// 3. Master bridge drive.js
const indexDriveCode = `/**
 * IFA+ Graduation — Google Drive Integration Master Bridge Module
 */
import './drive/drive-provisioning.js';
import './drive/drive-files.js';

export * from './drive/drive-provisioning.js';
export * from './drive/drive-files.js';
`;
fs.writeFileSync('js/drive.js', indexDriveCode, 'utf8');

console.log('Successfully split drive.js into 2 submodules in js/drive/!');
