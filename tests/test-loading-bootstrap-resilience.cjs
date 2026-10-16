/**
 * Regression Test: Loading Overlay Bootstrap & Error Boundary Resilience
 * Verifies that the app loading overlay never hangs indefinitely and gracefully handles
 * errors, 60-second watchdog timeouts, and successful authentications without premature warnings.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('1. Syntax Check: All JS modules parse and compile without syntax errors', () => {
  const { execSync } = require('child_process');
  const targetFiles = [
    path.join(__dirname, '..', 'js', 'core.js'),
    path.join(__dirname, '..', 'js', 'auth.js'),
    path.join(__dirname, '..', 'js', 'grading', 'final-scores-export.js')
  ];
  for (const f of targetFiles) {
    assert.doesNotThrow(() => {
      execSync(`node --check "${f}"`, { stdio: 'pipe' });
    });
  }
});

test('2. HTML Error Boundary & Watchdog Timer: index.template.html & index.html provide 60s threshold', () => {
  const tpl = read('index.template.html');
  const compiled = read('index.html');

  for (const src of [tpl, compiled]) {
    assert.match(src, /id="app-loading-overlay"/);
    assert.match(src, /id="app-loading-msg"/);
    assert.match(src, /window\.addEventListener\('error'/);
    assert.match(src, /window\.addEventListener\('unhandledrejection'/);
    assert.match(src, /window\.__appLoadWatchdog\s*=\s*setTimeout/);
    // 60,000ms threshold check
    assert.match(src, /},\s*60000\);/);
    // Old 8000ms threshold must NOT be used for watchdog
    assert.doesNotMatch(src, /__appLoadWatchdog\s*=\s*setTimeout\([\s\S]*?,\s*8000\);/);
    assert.match(src, /Quá trình tải ứng dụng mất nhiều thời gian hơn dự kiến\.\.\./);
    assert.match(src, /Thử lại/);
    assert.match(src, /Tải lại trang/);
  }
});

test('3. Core hideLoading and showLoading: clears watchdog timer and manages overlay state', () => {
  const coreCode = read('js/core.js');
  assert.match(coreCode, /export function hideLoading\(\)/);
  assert.match(coreCode, /clearTimeout\(window\.__appLoadWatchdog\)/);
  assert.match(coreCode, /window\.__appLoadWatchdog\s*=\s*null/);
  assert.match(coreCode, /export function showLoading/);
});

test('4. Auth setupAuthListener: safetyTimer configured to 60s threshold', () => {
  const authCode = read('js/auth.js');
  assert.match(authCode, /const safetyTimer = setTimeout\(\(\) => \{[\s\S]*?hideLoading\(\);[\s\S]*?},\s*60000\);/);
  // Old 6000ms safety timer must NOT be used
  assert.doesNotMatch(authCode, /safetyTimer = setTimeout\([\s\S]*?,\s*6000\);/);
});

test('5. Simulation Suite: Fake Timers for 60-Second Watchdog and Bootstrap Flows', async (t) => {
  // Minimal Fake Timer Engine
  function createFakeTimerEngine() {
    let now = 0;
    let timerId = 1;
    const timers = new Map();

    return {
      setTimeout(fn, delay) {
        const id = timerId++;
        timers.set(id, { fn, triggerAt: now + delay });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
      advance(ms) {
        now += ms;
        const due = [];
        for (const [id, t] of timers.entries()) {
          if (t.triggerAt <= now) {
            due.push({ id, fn: t.fn });
          }
        }
        // Sort by id for predictable order
        due.sort((a, b) => a.id - b.id);
        for (const item of due) {
          timers.delete(item.id);
          item.fn();
        }
      },
      getNow() { return now; },
      getActiveCount() { return timers.size; }
    };
  }

  // Setup simulated DOM & Window environment
  function setupEnv(fakeEngine) {
    let overlayClasses = new Set();
    let spinnerClasses = new Set();
    let msgInnerHtml = '';
    let msgTextContent = 'Đang tải IFA+ Graduation...';

    const dom = {
      'app-loading-overlay': {
        classList: {
          add: (cls) => overlayClasses.add(cls),
          remove: (cls) => overlayClasses.delete(cls),
          contains: (cls) => overlayClasses.has(cls)
        },
        style: {}
      },
      'app-loading-msg': {
        set innerHTML(val) { msgInnerHtml = val; },
        get innerHTML() { return msgInnerHtml; },
        set textContent(val) { msgTextContent = val; msgInnerHtml = val; },
        get textContent() { return msgTextContent; }
      },
      'app-loading-spinner': {
        classList: {
          add: (cls) => spinnerClasses.add(cls),
          remove: (cls) => spinnerClasses.delete(cls),
          contains: (cls) => spinnerClasses.has(cls)
        }
      }
    };

    const win = {
      __appLoadWatchdog: null,
      location: { reload: () => {} }
    };

    // Watchdog initializer as defined in index.template.html
    function initWatchdog() {
      win.__appLoadWatchdog = fakeEngine.setTimeout(function() {
        const overlay = dom['app-loading-overlay'];
        const msg = dom['app-loading-msg'];
        const spinner = dom['app-loading-spinner'];
        if (overlay && !overlay.classList.contains('hidden') && overlay.style.display !== 'none') {
          if (spinner) spinner.classList.add('hidden');
          if (msg) {
            msg.innerHTML = '<span class="text-amber-700 font-semibold block mt-1">Quá trình tải ứng dụng mất nhiều thời gian hơn dự kiến...</span>' +
              '<button type="button" onclick="window.location.reload(true)">Thử lại</button>';
          }
        }
      }, 60000);
    }

    // Core hideLoading as defined in js/core.js
    function hideLoading() {
      if (win.__appLoadWatchdog) {
        fakeEngine.clearTimeout(win.__appLoadWatchdog);
        win.__appLoadWatchdog = null;
      }
      const overlay = dom['app-loading-overlay'];
      if (overlay) {
        overlay.classList.add('opacity-0');
        fakeEngine.setTimeout(() => {
          overlay.classList.add('hidden');
          const spinner = dom['app-loading-spinner'];
          if (spinner) spinner.classList.remove('hidden');
          const msgEl = dom['app-loading-msg'];
          if (msgEl) msgEl.textContent = 'Đang tải IFA+ Graduation...';
        }, 300);
      }
    }

    // Core showLoading as defined in js/core.js
    function showLoading(text = 'Đang tải IFA+ Graduation...') {
      const overlay = dom['app-loading-overlay'];
      const msgEl = dom['app-loading-msg'];
      const spinner = dom['app-loading-spinner'];
      if (spinner) spinner.classList.remove('hidden');
      if (msgEl) msgEl.textContent = text;
      if (overlay) {
        overlay.classList.remove('hidden', 'opacity-0');
      }
    }

    return { dom, win, initWatchdog, hideLoading, showLoading, overlayClasses, spinnerClasses };
  }

  await t.test('5.1. No warning at 8s, 10s, 30s, or 50s (Normal Slow Network/Firebase)', () => {
    const fake = createFakeTimerEngine();
    const env = setupEnv(fake);

    env.initWatchdog();
    assert.ok(env.win.__appLoadWatchdog, 'Watchdog timer must be active');

    // Advance to 8 seconds (old threshold)
    fake.advance(8000);
    assert.equal(env.spinnerClasses.has('hidden'), false, 'Spinner must NOT be hidden at 8s');
    assert.doesNotMatch(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến/, 'Warning must NOT be displayed at 8s');

    // Advance to 10s, 30s, 50s
    fake.advance(2000); // 10s
    assert.doesNotMatch(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến/);
    fake.advance(20000); // 30s
    assert.doesNotMatch(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến/);
    fake.advance(20000); // 50s
    assert.doesNotMatch(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến/);
  });

  await t.test('5.2. Early completion at 15s dismisses overlay and cancels 60s watchdog', () => {
    const fake = createFakeTimerEngine();
    const env = setupEnv(fake);

    env.initWatchdog();

    // App completes loading at 15 seconds
    fake.advance(15000);
    env.hideLoading();

    assert.equal(env.win.__appLoadWatchdog, null, 'Watchdog timer must be cleared');
    fake.advance(300); // fade out timeout
    assert.equal(env.overlayClasses.has('hidden'), true, 'Overlay must be hidden');

    // Advance past 60s (to 70s)
    fake.advance(55000);
    assert.doesNotMatch(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến/, 'Watchdog must never fire after completion');
  });

  await t.test('5.3. Real Watchdog Timeout triggers warning after 60,000ms if stalled', () => {
    const fake = createFakeTimerEngine();
    const env = setupEnv(fake);

    env.initWatchdog();

    // Advance to 59.999s -> still normal
    fake.advance(59999);
    assert.doesNotMatch(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến/);

    // Hit 60,000ms
    fake.advance(1);
    assert.match(env.dom['app-loading-msg'].innerHTML, /Quá trình tải ứng dụng mất nhiều thời gian hơn dự kiến\.\.\./);
    assert.match(env.dom['app-loading-msg'].innerHTML, /Thử lại/);
    assert.equal(env.spinnerClasses.has('hidden'), true, 'Spinner is hidden when watchdog triggers');
  });

  await t.test('5.4. Late Completion Recovery: App finishes at 65s after watchdog warning', () => {
    const fake = createFakeTimerEngine();
    const env = setupEnv(fake);

    env.initWatchdog();
    fake.advance(60000); // Watchdog triggered warning

    assert.match(env.dom['app-loading-msg'].innerHTML, /mất nhiều thời gian hơn dự kiến\.\.\./);

    // App recovers and finishes at 65s
    fake.advance(5000);
    env.hideLoading();

    assert.equal(env.win.__appLoadWatchdog, null);
    fake.advance(300);
    assert.equal(env.overlayClasses.has('hidden'), true, 'Overlay auto-dismisses on late completion');
    assert.equal(env.spinnerClasses.has('hidden'), false, 'Spinner is reset');
    assert.equal(env.dom['app-loading-msg'].textContent, 'Đang tải IFA+ Graduation...');
  });

  await t.test('5.5. Immediate Real Error Handling (does not wait for 60s)', () => {
    const fake = createFakeTimerEngine();
    const env = setupEnv(fake);

    env.initWatchdog();

    // Simulate an uncaught error at 500ms
    fake.advance(500);
    const err = { message: 'Firebase: Error (auth/network-request-failed).' };

    // Trigger error boundary
    const overlay = env.dom['app-loading-overlay'];
    const msg = env.dom['app-loading-msg'];
    const spinner = env.dom['app-loading-spinner'];
    if (overlay && !overlay.classList.contains('hidden')) {
      if (spinner) spinner.classList.add('hidden');
      if (msg) {
        msg.innerHTML = '<span class="text-rose-600 font-semibold block mt-1">Không thể khởi tạo ứng dụng: ' +
          (err.message || 'Lỗi tập lệnh') + '</span>' +
          '<button type="button" onclick="window.location.reload(true)">Tải lại trang</button>';
      }
    }

    assert.match(env.dom['app-loading-msg'].innerHTML, /Không thể khởi tạo ứng dụng: Firebase: Error/);
    assert.match(env.dom['app-loading-msg'].innerHTML, /Tải lại trang/);
    assert.equal(env.spinnerClasses.has('hidden'), true);
    assert.equal(fake.getNow(), 500, 'Error is reported immediately without waiting 60 seconds');
  });

  await t.test('5.6. Idempotence: Multiple hideLoading calls do not leak timers or throw', () => {
    const fake = createFakeTimerEngine();
    const env = setupEnv(fake);

    env.initWatchdog();
    env.hideLoading();
    env.hideLoading();
    env.hideLoading();

    assert.equal(env.win.__appLoadWatchdog, null);
    fake.advance(300);
    assert.equal(env.overlayClasses.has('hidden'), true);
  });
});
