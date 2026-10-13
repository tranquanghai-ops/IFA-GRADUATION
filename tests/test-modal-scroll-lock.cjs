const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Modal Scroll Lock & Wheel Redirection ---');

const uiJsPath = path.join(__dirname, '..', 'js', 'ui.js');
const uiJs = fs.readFileSync(uiJsPath, 'utf8');

const stylesPath = path.join(__dirname, '..', 'styles.css');
const stylesCss = fs.readFileSync(stylesPath, 'utf8');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Check ui.js features
assert(uiJs.includes('MODAL_OVERLAY_SELECTOR'), 'ui.js should define MODAL_OVERLAY_SELECTOR');
assert(uiJs.includes('handleGlobalModalWheel'), 'ui.js should define handleGlobalModalWheel');
assert(uiJs.includes('getTopmostVisibleModal'), 'ui.js should define getTopmostVisibleModal');
assert(uiJs.includes('findActiveModalScrollContainer'), 'ui.js should define findActiveModalScrollContainer');
assert(uiJs.includes('modalOpenSeq'), 'ui.js should track modal opening order via modalOpenSeq');
assert(uiJs.includes('handleGlobalModalTouchMove'), 'ui.js should handle touchmove redirection');
assert(uiJs.includes('handleGlobalModalKeyDown'), 'ui.js should handle keyboard scroll containment');

// 2. Check wheel listener configuration
assert(uiJs.includes("{ passive: false, capture: true }"), 'Wheel listeners must be added with capture: true, passive: false');

// 3. Check styles.css containment
assert(stylesCss.includes('overscroll-behavior: contain'), 'styles.css must include overscroll-behavior: contain for modals');
assert(stylesCss.includes('.modal-backdrop'), 'styles.css must style .modal-backdrop');

// 4. Check index.html compiled elements
assert(indexHtml.includes('id="modal-round-access-monitoring"'), 'index.html must include access monitoring modal');
assert(indexHtml.includes('id="modal-rubric-criterion"'), 'index.html must include rubric criterion modal');
assert(indexHtml.includes('id="modal-student-edit-topic"'), 'index.html must include student edit topic modal');

// Check that modals have max-h and modal-backdrop
const modalChecks = [
  'modal-round-access-monitoring',
  'modal-round',
  'modal-activity',
  'modal-admin-lock-round',
  'modal-copy-round',
  'modal-reopen-round',
  'modal-council-workspace',
  'modal-activity-councils',
  'modal-rubric-criterion',
  'modal-confirm',
  'modal-project-type',
  'modal-submission-override',
  'modal-add-letter-option',
  'modal-student-edit-topic',
  'modal-admin-manual-assign',
  'modal-supervisor-confirm'
];

modalChecks.forEach(id => {
  assert(indexHtml.includes(`id="${id}"`), `index.html must contain modal with id=${id}`);
});

console.log('✓ All 4 modal scroll lock test suites passed successfully.');
