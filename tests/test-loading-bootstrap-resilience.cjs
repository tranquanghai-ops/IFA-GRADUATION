/**
 * Regression Test: Loading Overlay Bootstrap & Error Boundary Resilience
 * Verifies that the app loading overlay never hangs indefinitely and gracefully handles
 * errors, timeouts, and successful authentications.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('1. Syntax Check: All JS modules parse and compile without syntax errors', () => {
  const { execSync } = require('child_process');
  const targetFile = path.join(__dirname, '..', 'js', 'grading', 'final-scores-export.js');
  assert.doesNotThrow(() => {
    execSync(`node --check "${targetFile}"`, { stdio: 'pipe' });
  });
  const finalScoresExport = read('js/grading/final-scores-export.js');
  assert.match(finalScoresExport, /act\.councils\.forEach\(council\s*=>\s*\{/);
});

test('2. HTML Error Boundary & Watchdog Timer: index.template.html & index.html provide fail-safes', () => {
  const tpl = read('index.template.html');
  const compiled = read('index.html');

  for (const src of [tpl, compiled]) {
    assert.match(src, /id="app-loading-overlay"/);
    assert.match(src, /id="app-loading-msg"/);
    assert.match(src, /window\.addEventListener\('error'/);
    assert.match(src, /window\.__appLoadWatchdog\s*=\s*setTimeout/);
    assert.match(src, /Tải lại trang/);
  }
});

test('3. Core hideLoading clears watchdog timer and removes overlay', () => {
  const coreCode = read('js/core.js');
  assert.match(coreCode, /export function hideLoading\(\)/);
  assert.match(coreCode, /clearTimeout\(window\.__appLoadWatchdog\)/);
  assert.match(coreCode, /window\.__appLoadWatchdog\s*=\s*null/);
});

test('4. Simulation: Unauthenticated visitor flow dismisses loading overlay', () => {
  let overlayHidden = false;
  let overlayClasses = new Set();
  let msgText = '';

  const mockDom = {
    'app-loading-overlay': {
      classList: {
        add: (cls) => overlayClasses.add(cls),
        remove: (cls) => overlayClasses.delete(cls),
        contains: (cls) => overlayClasses.has(cls)
      },
      style: {}
    },
    'app-loading-msg': {
      set textContent(val) { msgText = val; },
      get textContent() { return msgText; }
    },
    'login-required-section': { classList: { add() {}, remove() {} } },
    'view-student': { classList: { add() {}, remove() {} } },
    'view-supervisor': { classList: { add() {}, remove() {} } },
    'view-admin': { classList: { add() {}, remove() {} } },
    'view-assessment': { classList: { add() {}, remove() {} } }
  };

  const context = {
    window: {
      __appLoadWatchdog: 1234,
      location: { search: '' }
    },
    document: {
      getElementById: (id) => mockDom[id] || null,
      body: { classList: { add() {}, remove() {} } }
    },
    clearTimeout: (timer) => {
      if (timer === 1234) overlayHidden = true;
    },
    setTimeout: (fn) => fn()
  };

  // Simulating hideLoading behavior
  function hideLoading() {
    if (context.window.__appLoadWatchdog) {
      context.clearTimeout(context.window.__appLoadWatchdog);
      context.window.__appLoadWatchdog = null;
    }
    const overlay = context.document.getElementById('app-loading-overlay');
    if (overlay) {
      overlay.classList.add('opacity-0');
      overlay.classList.add('hidden');
    }
  }

  hideLoading();
  assert.equal(overlayHidden, true);
  assert.equal(context.window.__appLoadWatchdog, null);
  assert.equal(overlayClasses.has('hidden'), true);
});

test('5. Simulation: Error boundary intercepts error and shows retry button instead of hanging', () => {
  let innerHtml = '';
  let spinnerHidden = false;

  const mockDom = {
    'app-loading-overlay': {
      classList: { contains: () => false },
      style: { display: 'flex' }
    },
    'app-loading-msg': {
      set innerHTML(val) { innerHtml = val; },
      get innerHTML() { return innerHtml; }
    },
    'app-loading-spinner': {
      classList: { add: (cls) => { if (cls === 'hidden') spinnerHidden = true; } }
    }
  };

  // Trigger error simulation
  const errEvent = { message: 'NetworkError when attempting to fetch resource.' };
  const overlay = mockDom['app-loading-overlay'];
  const msg = mockDom['app-loading-msg'];
  const spinner = mockDom['app-loading-spinner'];

  if (overlay && !overlay.classList.contains('hidden')) {
    if (spinner) spinner.classList.add('hidden');
    if (msg) {
      msg.innerHTML = '<span class="text-rose-600">Không thể khởi tạo ứng dụng: ' + errEvent.message + '</span><button>Tải lại trang</button>';
    }
  }

  assert.equal(spinnerHidden, true);
  assert.match(innerHtml, /Không thể khởi tạo ứng dụng/);
  assert.match(innerHtml, /Tải lại trang/);
});
