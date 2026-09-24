/**
 * IFA+ Graduation — Khoa Mỹ thuật Công nghiệp (ĐH Tôn Đức Thắng)
 * Orchestrator Entry Point (ES Modules)
 */

// 1. Core Services, State & Utilities
import './js/core.js';

// 2. UI Components & Dialogs
import './js/ui.js';

// 3. Exact Act-As Impersonation Test Mode
import './js/impersonation.js';

// 4. Authentication, Roles & View Routing
import './js/auth.js';

// 5. Google Drive Provisioning & Submissions
import './js/drive.js';

// 6. Graduation Rounds Management
import './js/rounds.js';

// 7. Milestones, Unified Cards & Timeline Planning
import './js/planning.js';

// 8. Students, Eligibility, IFAA Master & Registrations
import './js/students.js';

// 9. Supervisors Master, Review Workflow & Assignment Matrix
import './js/supervisors.js';

// 10. Councils, Rubric Scoring, Defense & Final Assessment
import './js/grading.js';

// Bootstrap Notice
if (typeof window !== 'undefined') {
  console.log('[IFA Graduation] Modular architecture initialized successfully.');
}
