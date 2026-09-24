const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('index.html', 'utf8');
const lines = src.split('\n');

// Ensure directories exist
const dirs = [
  'views',
  'templates/modals/rounds',
  'templates/modals/supervisors',
  'templates/modals/students',
  'templates/modals/grading',
  'templates/modals/shared'
];
dirs.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Helper to extract line slice (1-indexed start and end inclusive)
function extract(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

// 1. Views
fs.writeFileSync('views/student.html', extract(192, 716), 'utf8');
fs.writeFileSync('views/supervisor.html', extract(717, 1272), 'utf8');
fs.writeFileSync('views/assessment.html', extract(1273, 1601), 'utf8');
fs.writeFileSync('views/admin.html', extract(1602, 3263), 'utf8');

// 2. Modals - Rounds
fs.writeFileSync('templates/modals/rounds/modal-round.html', extract(3264, 3673), 'utf8');
fs.writeFileSync('templates/modals/rounds/modal-admin-lock-round.html', extract(4003, 4039), 'utf8');
fs.writeFileSync('templates/modals/rounds/modal-round-workspace.html', extract(4178, 4197), 'utf8');
fs.writeFileSync('templates/modals/rounds/modal-activity.html', extract(4198, 4726), 'utf8');
fs.writeFileSync('templates/modals/rounds/modal-copy-round.html', extract(4727, 4776), 'utf8');
fs.writeFileSync('templates/modals/rounds/modal-reopen-round.html', extract(5681, 5705), 'utf8');

// 3. Modals - Supervisors
fs.writeFileSync('templates/modals/supervisors/modal-supervisor.html', extract(3733, 3847), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-add-sup-to-round.html', extract(3848, 3876), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-sup-bio.html', extract(3942, 3971), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-supervisor-confirm.html', extract(3972, 4002), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-admin-inspect-sup.html', extract(4040, 4071), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-admin-edit-supervisor.html', extract(4072, 4119), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-admin-manual-assign.html', extract(4120, 4149), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-assignment-excel-preview.html', extract(4150, 4177), 'utf8');
fs.writeFileSync('templates/modals/supervisors/modal-add-support-supervisor.html', extract(4777, 4826), 'utf8');

// 4. Modals - Students
fs.writeFileSync('templates/modals/students/modal-add-eligible-student.html', extract(3674, 3732), 'utf8');
fs.writeFileSync('templates/modals/students/modal-student-profile.html', extract(3910, 3925), 'utf8');
fs.writeFileSync('templates/modals/students/modal-add-letter-option.html', extract(5122, 5159), 'utf8');

// 5. Modals - Grading
fs.writeFileSync('templates/modals/grading/modal-activity-councils.html', extract(4827, 4955), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-edit-council.html', extract(4956, 5074), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-add-guest-slot.html', extract(5075, 5101), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-milestone-quick-council.html', extract(5160, 5196), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-add-council-internal-member.html', extract(5197, 5234), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-add-council-guest-member.html', extract(5235, 5283), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-council-workspace.html', extract(5284, 5411), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-admin-score-detail.html', extract(5412, 5484), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-score-entry.html', extract(5485, 5531), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-rubric-criterion.html', extract(5532, 5566), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-score-calibration.html', extract(5567, 5619), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-reopen-council.html', extract(5620, 5649), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-guest-passcode-entry.html', extract(5650, 5680), 'utf8');
fs.writeFileSync('templates/modals/grading/modal-final-score-detail.html', extract(5706, 5788), 'utf8');

// 6. Modals - Shared
fs.writeFileSync('templates/modals/shared/modal-project-type.html', extract(3877, 3909), 'utf8');
fs.writeFileSync('templates/modals/shared/modal-teacher-profile.html', extract(3926, 3941), 'utf8');
fs.writeFileSync('templates/modals/shared/modal-confirm.html', extract(5102, 5121), 'utf8');
fs.writeFileSync('templates/modals/shared/modal-activity-submissions.html', extract(5789, 5869), 'utf8');
fs.writeFileSync('templates/modals/shared/modal-submission-override.html', extract(5870, 5918), 'utf8');
fs.writeFileSync('templates/modals/shared/modal-submission-history.html', extract(5919, 5942), 'utf8');
fs.writeFileSync('templates/modals/shared/modal-admin-impersonate.html', extract(5943, 5985), 'utf8');

// Header & Navigation: 1 to 191
const header = extract(1, 191);
// Footer & Scripts: 5986 to end
const footer = extract(5986, lines.length).trimEnd();

const template = `${header}
<!-- PARTIAL:views/student.html -->
<!-- PARTIAL:views/supervisor.html -->
<!-- PARTIAL:views/assessment.html -->
<!-- PARTIAL:views/admin.html -->

<!-- === MODALS & DIALOGS === -->
<!-- PARTIAL:templates/modals/rounds/modal-round.html -->
<!-- PARTIAL:templates/modals/students/modal-add-eligible-student.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-supervisor.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-add-sup-to-round.html -->
<!-- PARTIAL:templates/modals/shared/modal-project-type.html -->
<!-- PARTIAL:templates/modals/students/modal-student-profile.html -->
<!-- PARTIAL:templates/modals/students/modal-student-edit-topic.html -->
<!-- PARTIAL:templates/modals/shared/modal-teacher-profile.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-sup-bio.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-supervisor-confirm.html -->
<!-- PARTIAL:templates/modals/rounds/modal-admin-lock-round.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-admin-inspect-sup.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-admin-edit-supervisor.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-admin-manual-assign.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-assignment-excel-preview.html -->
<!-- PARTIAL:templates/modals/rounds/modal-round-workspace.html -->
<!-- PARTIAL:templates/modals/rounds/modal-activity.html -->
<!-- PARTIAL:templates/modals/rounds/modal-copy-round.html -->
<!-- PARTIAL:templates/modals/supervisors/modal-add-support-supervisor.html -->
<!-- PARTIAL:templates/modals/grading/modal-activity-councils.html -->
<!-- PARTIAL:templates/modals/grading/modal-edit-council.html -->
<!-- PARTIAL:templates/modals/grading/modal-add-guest-slot.html -->
<!-- PARTIAL:templates/modals/shared/modal-confirm.html -->
<!-- PARTIAL:templates/modals/students/modal-add-letter-option.html -->
<!-- PARTIAL:templates/modals/grading/modal-milestone-quick-council.html -->
<!-- PARTIAL:templates/modals/grading/modal-add-council-internal-member.html -->
<!-- PARTIAL:templates/modals/grading/modal-add-council-guest-member.html -->
<!-- PARTIAL:templates/modals/grading/modal-council-workspace.html -->
<!-- PARTIAL:templates/modals/grading/modal-admin-score-detail.html -->
<!-- PARTIAL:templates/modals/grading/modal-score-entry.html -->
<!-- PARTIAL:templates/modals/grading/modal-rubric-criterion.html -->
<!-- PARTIAL:templates/modals/grading/modal-score-calibration.html -->
<!-- PARTIAL:templates/modals/grading/modal-reopen-council.html -->
<!-- PARTIAL:templates/modals/grading/modal-guest-passcode-entry.html -->
<!-- PARTIAL:templates/modals/rounds/modal-reopen-round.html -->
<!-- PARTIAL:templates/modals/grading/modal-final-score-detail.html -->
<!-- PARTIAL:templates/modals/shared/modal-activity-submissions.html -->
<!-- PARTIAL:templates/modals/shared/modal-submission-override.html -->
<!-- PARTIAL:templates/modals/shared/modal-submission-history.html -->
<!-- PARTIAL:templates/modals/shared/modal-admin-impersonate.html -->

${footer}
`;

fs.writeFileSync('index.template.html', template, 'utf8');
console.log('Successfully created all partials and index.template.html');
