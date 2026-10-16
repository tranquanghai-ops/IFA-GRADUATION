const fs = require('fs');
const path = require('path');

// Modal sizing tier class mappings
const MODAL_TIER_CLASSES = {
  // --- GROUP A: LARGE MANAGEMENT (width: min(90vw, 1440px)) ---
  'modal-round': 'modal-size-management',
  'modal-round-workspace': 'modal-size-management',
  'modal-round-access-monitoring': 'modal-size-management',
  'modal-activity-councils': 'modal-size-management',
  'modal-activity-submissions': 'modal-size-management',
  'modal-add-eligible-student': 'modal-size-management',
  'modal-assignment-excel-preview': 'modal-size-management',

  // --- GROUP B: DETAIL (width: min(90vw, 1200px)) ---
  'modal-council-score-details': 'modal-size-detail',
  'modal-admin-score-detail': 'modal-size-detail',
  'modal-final-score-detail': 'modal-size-detail',
  'modal-student-activity-history': 'modal-size-detail',
  'modal-admin-submission-inspect': 'modal-size-detail',
  'modal-submission-history': 'modal-size-detail',
  'modal-admin-inspect-sup': 'modal-size-detail',
  'modal-supervisor-topic-preview': 'modal-size-detail',
  'supervisor-student-detail-modal': 'modal-size-detail',
  'modal-student-profile': 'modal-size-detail',
  'modal-teacher-profile': 'modal-size-detail',
  'student-timeline-event-dialog': 'modal-size-detail',

  // --- GROUP C: FORM (width: min(90vw, 900px)) ---
  'modal-activity': 'modal-size-form',
  'modal-edit-council': 'modal-size-form',
  'modal-adjust-council-score': 'modal-size-form',
  'modal-admin-impersonate': 'modal-size-form',
  'modal-add-admin': 'modal-size-form',
  'modal-supervisor': 'modal-size-form',
  'modal-add-sup-to-round': 'modal-size-form',
  'modal-admin-edit-supervisor': 'modal-size-form',
  'modal-admin-manual-assign': 'modal-size-form',
  'modal-add-support-supervisor': 'modal-size-form',
  'modal-student-edit-topic': 'modal-size-form',
  'modal-score-calibration': 'modal-size-form',
  'modal-score-entry': 'modal-size-form',
  'modal-rubric-criterion': 'modal-size-form',
  'modal-copy-round': 'modal-size-form',
  'modal-copy-councils-from-milestone': 'modal-size-form',
  'modal-add-council-guest-member': 'modal-size-form',
  'modal-add-council-internal-member': 'modal-size-form',
  'modal-add-guest-slot': 'modal-size-form',
  'modal-milestone-quick-council': 'modal-size-form',
  'modal-submission-override': 'modal-size-form',

  // --- GROUP D: CONFIRM (width: min(90vw, 600px)) ---
  'modal-confirm': 'modal-size-confirm',
  'modal-revoke-progress-review': 'modal-size-confirm',
  'modal-publish-progress-review': 'modal-size-confirm',
  'modal-admin-lock-round': 'modal-size-confirm',
  'modal-reopen-round': 'modal-size-confirm',
  'modal-reopen-council': 'modal-size-confirm',
  'modal-guest-passcode-entry': 'modal-size-confirm',
  'modal-add-letter-option': 'modal-size-confirm',
  'modal-project-type': 'modal-size-confirm',
  'modal-supervisor-confirm': 'modal-size-confirm',
  'dynamic-dialog-core': 'modal-size-confirm',
  'rich-hyperlink-modal': 'modal-size-confirm',

  // --- GROUP E: FULLSCREEN (width: min(98vw, 1720px), height: 96vh) ---
  'modal-council-workspace': 'modal-size-fullscreen'
};

function standardizeInnerCard(classStr, targetSizeClass) {
  // Remove existing max-w-..., xl:max-w-..., 2xl:max-w-..., lg:max-w-...
  let cleaned = classStr
    .replace(/(?:2xl:|xl:|lg:|md:|sm:)?max-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|full|screen-[a-z0-9]+|\[[^\]]+\])/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove duplicate targetSizeClass if already present
  cleaned = cleaned.replace(new RegExp(`\\b${targetSizeClass}\\b`, 'g'), '').trim();

  // Add targetSizeClass
  return `${targetSizeClass} ${cleaned}`.replace(/\s+/g, ' ').trim();
}

console.log('='.repeat(80));
console.log(' APPLYING STANDARDIZED MODAL DESIGN SYSTEM TO ALL MODALS');
console.log('='.repeat(80));

let updatedCount = 0;

// 1. Process templates/modals/**/*.html
const allModals = JSON.parse(fs.readFileSync('scripts/all-modals-catalog.json', 'utf8'));

for (const m of allModals) {
  const filePath = m.file;
  if (!fs.existsSync(filePath)) continue;

  const targetClass = MODAL_TIER_CLASSES[m.id];
  if (!targetClass) {
    console.warn(`[Warning] No target class mapped for modal: ${m.id}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let fileChanged = false;

  // Search for the modal container and its inner card
  if (filePath.endsWith('.html')) {
    // Find <div id="${m.id}" ...> ... <div class="...bg-white/rounded/..." ...>
    const modalIndex = content.indexOf(`id="${m.id}"`) !== -1
      ? content.indexOf(`id="${m.id}"`)
      : content.indexOf(`id='${m.id}'`);

    if (modalIndex !== -1) {
      // Find the closing bracket of the modal element
      const tagCloseIndex = content.indexOf('>', modalIndex);
      if (tagCloseIndex !== -1) {
        // Now find the immediate next child <div ... class="..."
        const nextDivMatch = content.slice(tagCloseIndex).match(/<div[^>]*class=["']([^"']+)["']/i);
        if (nextDivMatch) {
          const oldClass = nextDivMatch[1];
          const newClass = standardizeInnerCard(oldClass, targetClass);
          if (oldClass !== newClass) {
            const oldChunk = nextDivMatch[0];
            const newChunk = oldChunk.replace(oldClass, newClass);
            content = content.slice(0, tagCloseIndex) + content.slice(tagCloseIndex).replace(oldChunk, newChunk);
            fileChanged = true;
            console.log(`[Updated] ${m.id} (${filePath}) -> ${targetClass}`);
          }
        }
      }
    }
  }

  // Handle special JS files
  if (filePath === 'js/core.js') {
    // showInputDialog
    const oldPattern = 'class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"';
    const newPattern = 'class="modal-size-confirm w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"';
    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      fileChanged = true;
      console.log(`[Updated] dynamic-dialog-core (js/core.js) -> modal-size-confirm`);
    }
  }

  if (filePath === 'js/planning/activities-manager.js') {
    // rich-hyperlink-modal
    const oldPattern = 'class="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"';
    const newPattern = 'class="modal-size-confirm w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"';
    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      fileChanged = true;
      console.log(`[Updated] rich-hyperlink-modal (js/planning/activities-manager.js) -> modal-size-confirm`);
    }
  }

  if (filePath === 'js/rounds/rounds-timeline-preview.js') {
    // student-timeline-event-dialog
    const oldPattern1 = 'class="student-timeline-event-panel max-w-3xl lg:max-w-4xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl"';
    const newPattern1 = 'class="modal-size-detail student-timeline-event-panel rounded-2xl sm:rounded-3xl bg-white shadow-2xl"';
    if (content.includes(oldPattern1)) {
      content = content.replace(oldPattern1, newPattern1);
      fileChanged = true;
      console.log(`[Updated] student-timeline-event-dialog (rounds-timeline-preview.js) -> modal-size-detail`);
    }

    const oldPattern2 = 'class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4"';
    const newPattern2 = 'class="modal-size-form w-full rounded-2xl bg-white p-6 shadow-2xl space-y-4"';
    if (content.includes(oldPattern2)) {
      content = content.replaceAll(oldPattern2, newPattern2);
      fileChanged = true;
      console.log(`[Updated] timeline-event-editor (rounds-timeline-preview.js) -> modal-size-form`);
    }
  }

  if (fileChanged) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
  }
}

console.log(`\nSuccessfully standardized ${updatedCount} modal files.`);
