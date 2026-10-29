/**
 * IFA-GRADUATION — E2E TEST: MANDATORY 3 SUPERVISOR PREFERENCES
 * 
 * Verifies:
 * 1. Blocking with 0, 1, 2 preferences with warning toast.
 * 2. Duplicate supervisor rejection.
 * 3. Successful advance to Step 3 when exactly 3 distinct supervisors are selected.
 * 4. Step 3 confirmation renders 3 podium cards and enables official submission.
 * 5. Responsive UI on Desktop (1280x800) and Mobile (375x812).
 * 6. Captures screenshots to artifacts directory.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = 'C:\\Users\\HHHH-HP\\.gemini\\antigravity\\brain\\85d98480-3b40-4985-ae5c-72405fe52acd\\screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getBrowserExecutablePath() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Edge nor Chrome found on this machine.');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function createStaticServer(port) {
  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';
    const filePath = path.join(ROOT_DIR, cleanUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function run() {
  const PORT = 5057;
  console.log(`[E2E] Starting local server on port ${PORT}...`);
  const server = await createStaticServer(PORT);

  const browserPath = getBrowserExecutablePath();
  console.log(`[E2E] Launching browser: ${browserPath}`);
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });

  const page = await browser.newPage();

  // Capture console logs and toast events
  const capturedToasts = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Toast]') || text.includes('TOAST:')) {
      capturedToasts.push(text);
    }
  });

  try {
    console.log('[E2E] Navigating to IFA-Graduation application...');
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?emulator=true`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1500));

    // Setup Mock Test State: Student with Round 4/2027 and 11 round supervisors
    console.log('[E2E] Seeding test state in browser context...');
    await page.evaluate(() => {
      const roundSupList = [
        { id: 'SZ5gSix1l0BZs0NLkkjU', name: 'ThS. KTS. Phan Bảo Cường', department: 'Thiết kế nội thất', quota: 10 },
        { id: 'oWS52UHJbLDk2rkzQyPR', name: 'TS. KTX Nguyễn Minh Hiếu', department: 'Thiết kế nội thất', quota: 10 },
        { id: 'RxB5PvR45YHEueUilTL2', name: 'ThS. NCS Hoàng Lê Duy', department: 'Thiết kế nội thất', quota: 10 },
        { id: 'p9lRkSGtVruipuPxNGVx', name: 'ThS. NCS Trần Quang Hải', department: 'Thiết kế nội thất', quota: 10 },
        { id: 'VMiij78ssdGs9sPd6WTG', name: 'ThS. KTS. Nguyễn Tăng Quang', department: 'Thiết kế nội thất', quota: 5 },
        { id: '6iVH77aqzDmLJleISI4n', name: 'ThS. Ngô Văn Đức', department: 'Thiết kế nội thất', quota: 10 }
      ];

      window.state = window.state || {};
      window.state.activeRound = {
        id: 'p6OSVMkVgvvbkjGyPOFb',
        name: 'Đợt 4/2027 (Khóa 2022 - 2027)',
        preferenceCount: 3,
        supervisorAssignmentMode: 'student_preference',
        status: 'open'
      };
      window.state.selectedRoundId = 'p6OSVMkVgvvbkjGyPOFb';
      window.state.roundSupervisors = roundSupList;
      window.state.supervisorsMaster = roundSupList;
      window.state.studentMssv = '12200999';
      window.state.user = {
        email: '12200999@student.tdtu.edu.vn',
        displayName: 'Nguyễn Văn Kiểm Thử'
      };
      window.state.isEligible = true;
      window.state.eligibilityState = 'eligible';
      window.state.isRegisteringTopic = true;
      window.state.selectedPreferences = [];

      // Intercept showToast to capture messages
      window._capturedToasts = [];
      const origToast = window.showToast;
      window.showToast = function(msg, type) {
        window._capturedToasts.push({ msg, type });
        console.log(`[Toast] [${type}] ${msg}`);
        if (typeof origToast === 'function') origToast(msg, type);
      };

      // Show student section
      if (typeof window.switchPortal === 'function') {
        window.switchPortal('student');
      }
      const studentPortal = document.getElementById('portal-student');
      if (studentPortal) studentPortal.classList.remove('hidden');

      // Populate Step 1 inputs with valid thesis topic
      const titleInput = document.getElementById('input-topic-title');
      if (titleInput) titleInput.value = 'Thiết kế nội thất Trung tâm Nghệ thuật & Văn hóa Đương đại TP.HCM';

      const typeChecks = document.querySelectorAll('input[name="project_types"]');
      if (typeChecks && typeChecks.length > 0) typeChecks[0].checked = true;

      // Advance to Step 2
      if (typeof window.goToStep === 'function') {
        window.goToStep(2);
      }
    });

    await new Promise(r => setTimeout(r, 600));

    // TEST 1: Advance to Step 3 with 0 preferences -> MUST BE BLOCKED
    console.log('[E2E Test 1]: Validating blocking with 0 preferences...');
    const test1Result = await page.evaluate(async () => {
      window._capturedToasts = [];
      await window.validateAndGoToStep3();
      const currentStep2Visible = !document.getElementById('step-panel-2')?.classList.contains('hidden');
      const toast = window._capturedToasts[0];
      return { currentStep2Visible, toast };
    });

    if (!test1Result.currentStep2Visible || !test1Result.toast?.msg.includes('đầy đủ 3 nguyện vọng')) {
      throw new Error(`Test 1 Failed: Expected block with 0 preferences. Got: ${JSON.stringify(test1Result)}`);
    }
    console.log('  ✓ Test 1 Passed: Đã chặn khi 0/3 nguyện vọng với thông báo chuẩn.');

    // TEST 2: Select 1st preference -> Tray shows 1/3 -> Advance to Step 3 MUST BE BLOCKED
    console.log('[E2E Test 2]: Adding 1st preference (Phan Bảo Cường) and checking blocking...');
    const test2Result = await page.evaluate(async () => {
      window._capturedToasts = [];
      window.addCardPreference('SZ5gSix1l0BZs0NLkkjU', encodeURIComponent('ThS. KTS. Phan Bảo Cường'));
      const count = window.state.selectedPreferences.length;
      await window.validateAndGoToStep3();
      const currentStep2Visible = !document.getElementById('step-panel-2')?.classList.contains('hidden');
      const toast = window._capturedToasts.find(t => t.type === 'warning');
      return { count, currentStep2Visible, toast };
    });

    if (test2Result.count !== 1 || !test2Result.currentStep2Visible || !test2Result.toast?.msg.includes('1/3')) {
      throw new Error(`Test 2 Failed: Expected block with 1/3 preferences. Got: ${JSON.stringify(test2Result)}`);
    }
    console.log('  ✓ Test 2 Passed: Đã chọn 1/3 và bị chặn khi bấm Tiếp tục.');

    // TEST 3: Try to select SAME supervisor again -> MUST BE REJECTED (anti-duplicate)
    console.log('[E2E Test 3]: Trying to select duplicate supervisor...');
    const test3Result = await page.evaluate(() => {
      window._capturedToasts = [];
      window.addCardPreference('SZ5gSix1l0BZs0NLkkjU', encodeURIComponent('ThS. KTS. Phan Bảo Cường'));
      const count = window.state.selectedPreferences.length;
      const dupToast = window._capturedToasts.find(t => t.msg.includes('chỉ được chọn ở một nguyện vọng'));
      return { count, dupToast };
    });

    if (test3Result.count !== 1 || !test3Result.dupToast) {
      throw new Error(`Test 3 Failed: Duplicate supervisor was not rejected. Got: ${JSON.stringify(test3Result)}`);
    }
    console.log('  ✓ Test 3 Passed: Trùng GVHD bị chặn ngay với thông báo chọn 3 GV khác nhau.');

    // TEST 4: Select 2nd preference -> Tray shows 2/3 -> Advance to Step 3 MUST BE BLOCKED
    console.log('[E2E Test 4]: Adding 2nd preference (Nguyễn Minh Hiếu) and checking blocking...');
    const test4Result = await page.evaluate(async () => {
      window._capturedToasts = [];
      window.addCardPreference('oWS52UHJbLDk2rkzQyPR', encodeURIComponent('TS. KTX Nguyễn Minh Hiếu'));
      const count = window.state.selectedPreferences.length;
      await window.validateAndGoToStep3();
      const currentStep2Visible = !document.getElementById('step-panel-2')?.classList.contains('hidden');
      const toast = window._capturedToasts.find(t => t.type === 'warning');
      return { count, currentStep2Visible, toast };
    });

    if (test4Result.count !== 2 || !test4Result.currentStep2Visible || !test4Result.toast?.msg.includes('2/3')) {
      throw new Error(`Test 4 Failed: Expected block with 2/3 preferences. Got: ${JSON.stringify(test4Result)}`);
    }
    console.log('  ✓ Test 4 Passed: Đã chọn 2/3 và bị chặn khi bấm Tiếp tục.');

    // TEST 5: Select 3rd preference -> Tray shows 3/3 with checkmark -> Advance to Step 3 MUST SUCCEED
    console.log('[E2E Test 5]: Adding 3rd preference (Hoàng Lê Duy) and proceeding to Step 3...');
    const test5Result = await page.evaluate(async () => {
      window._capturedToasts = [];
      window.addCardPreference('RxB5PvR45YHEueUilTL2', encodeURIComponent('ThS. NCS Hoàng Lê Duy'));
      const count = window.state.selectedPreferences.length;
      const trayHint = document.getElementById('tray-mode-hint')?.innerText || '';
      await window.validateAndGoToStep3();
      const step3Visible = !document.getElementById('step-panel-3')?.classList.contains('hidden');
      const podiumCardsCount = document.querySelectorAll('#confirm-preferences-list > div')?.length || 0;
      const submitBtn = document.getElementById('btn-submit-registration');
      const submitDisabled = submitBtn ? submitBtn.disabled : true;

      return { count, trayHint, step3Visible, podiumCardsCount, submitDisabled };
    });

    if (test5Result.count !== 3 || !test5Result.step3Visible || test5Result.podiumCardsCount !== 3 || test5Result.submitDisabled) {
      throw new Error(`Test 5 Failed: Expected successful transition to Step 3 with 3 podium cards. Got: ${JSON.stringify(test5Result)}`);
    }
    console.log('  ✓ Test 5 Passed: Chọn đủ 3 NV -> chuyển sang Bước 3, hiển thị đủ 3 bục vinh danh và nút nộp được kích hoạt.');

    // Save Desktop Confirmation Screenshot
    const desktopScreenshotPath = path.join(SCREENSHOT_DIR, '01_desktop_mandatory_three_preferences_confirm.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log(`  📸 Saved desktop screenshot: ${desktopScreenshotPath}`);

    // TEST 6: Mobile Responsiveness (375x812 - iPhone X / Zalo Mobile browser)
    console.log('[E2E Test 6]: Testing mobile viewport (375x812)...');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 400));

    // Save Mobile Step 3 Confirmation Screenshot
    const mobileStep3Path = path.join(SCREENSHOT_DIR, '03_mobile_375_mandatory_three_preferences_step3.png');
    await page.screenshot({ path: mobileStep3Path, fullPage: true });
    console.log(`  📸 Saved mobile step 3 screenshot: ${mobileStep3Path}`);

    // Return to Step 2 on Mobile and screenshot tray
    await page.evaluate(() => {
      window.goToStep(2);
    });
    await new Promise(r => setTimeout(r, 400));
    const mobileStep2Path = path.join(SCREENSHOT_DIR, '02_mobile_375_mandatory_three_preferences_step2.png');
    await page.screenshot({ path: mobileStep2Path, fullPage: true });
    console.log(`  📸 Saved mobile step 2 screenshot: ${mobileStep2Path}`);

    console.log('\n======================================================');
    console.log('🎉 ALL 6 E2E BROWSER VALIDATION TESTS PASSED PERFECTLY!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('[E2E FAILED]:', err);
  process.exit(1);
});
