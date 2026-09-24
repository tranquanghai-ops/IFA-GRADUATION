/**
 * IFA+ Graduation — Khoa Mỹ thuật Công nghiệp (ĐH Tôn Đức Thắng)
 * Orchestrator Entry Point (ES Modules)
 */

// 1. Core Services, State & Utilities
import './js/core.js';
import './js/ui.js';

// 2. Foundation Data & Masters
import './js/supervisors.js';
import './js/students.js';

// 3. Rounds, Planning & Google Drive
import './js/rounds.js';
import './js/planning.js';
import './js/drive.js';

// 4. Councils, Rubric Scoring & Grading
import './js/grading.js';

// 5. Exact Act-As Impersonation Test Mode
import './js/impersonation.js';

// 6. Authentication, Roles & Session Router (Initializes onAuthStateChanged)
import './js/auth.js';

// Bootstrap Notice
if (typeof window !== 'undefined') {
  console.log('[IFA Graduation] Modular architecture initialized successfully.');
}
