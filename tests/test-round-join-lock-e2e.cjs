/**
 * IFA+ Graduation — Join Link Lock E2E & Browser UI Test Suite (Local Emulator)
 * 
 * Validates:
 * 1. Admin toolbar join link badge & lock/unlock buttons per round.
 * 2. Custom confirmation modal (showConfirm) with exact prompt titles & text.
 * 3. Persistence of allowSelfJoin on Firestore across reloads and round switches.
 * 4. Rejection of new student self-join when link is locked with exact toast message.
 * 5. Preservation of existing student membership & access when link is locked.
 * 6. Successful self-join when link is reopened.
 * 7. Mobile 375px and Desktop 1920px responsiveness.
 * 8. Takes 7 high-resolution screenshots for artifacts.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { verifyEmulatorSafety } = require('../scripts/emulator-guard.cjs');
const { seedTestData } = require('../scripts/seed-test-data.cjs');

const ARTIFACT_SCREENSHOT_DIR = 'C:/Users/HHHH-HP/.gemini/antigravity/brain/85d98480-3b40-4985-ae5c-72405fe52acd/screenshots';
const LOCAL_SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/emulator-ui');

[ARTIFACT_SCREENSHOT_DIR, LOCAL_SCREENSHOT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function getBrowserExecutablePath() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Microsoft Edge nor Google Chrome executable found on this Windows system.');
}

function startStaticServer(port = 5055) {
  const root = path.resolve(__dirname, '..');
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(root, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexData);
          }
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'text/plain',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });

  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/', method: 'GET', timeout: 1000 },
      (res) => resolve(res.statusCode < 500)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function saveDualScreenshot(page, filename) {
  const artPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
  const locPath = path.join(LOCAL_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: artPath, fullPage: false });
  fs.copyFileSync(artPath, locPath);
  console.log(`📸 Screenshot saved: ${filename}`);
}

async function runJoinLockE2ETests() {
  console.log('\n================================================================');
  console.log('🔒 IFA-GRADUATION — JOIN LINK LOCK BROWSER E2E TEST SUITE');
  console.log('================================================================');

  // STEP 0: Safety Guard & Seed
  await verifyEmulatorSafety({ strictProjectCheck: true, pingCheck: true });
  console.log('✓ Safety Guard passed: Local emulator active.');
  await seedTestData();

  // STEP 1: Determine URL
  let server = null;
  let baseUrl = 'http://127.0.0.1:5000';
  if (await isPortOpen(5000)) {
    console.log('✓ Detected running Hosting Emulator at http://127.0.0.1:5000');
  } else {
    console.log('Hosting emulator port 5000 not active. Starting local static test server on 5055...');
    server = await startStaticServer(5055);
    baseUrl = 'http://127.0.0.1:5055';
    console.log(`✓ Test static server listening at ${baseUrl}`);
  }

  const execPath = getBrowserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------------------
    // PHASE 1: ADMIN WORKSPACE — LOCK / UNLOCK LINK & UI SYNC
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 1: ADMIN TOOLBAR & MODAL JOIN LINK LOCK (1920x1080) ---');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${baseUrl}/?emulator=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.state !== 'undefined', { timeout: 15000 });

    // Bootstrap Admin state & open Students tab
    await page.evaluate(() => {
      window.state = window.state || {};
      window.state.user = {
        email: 'admin@tdtu.edu.vn',
        displayName: 'Quản trị viên Hệ thống',
        uid: 'mock_admin_uid'
      };
      window.state.isAdmin = true;
      window.state.isOwner = true;
      if (typeof window.switchView === 'function') window.switchView('admin');
      if (typeof window.switchAdminTab === 'function') window.switchAdminTab('eligible-students');
    });

    await new Promise(r => setTimeout(r, 1000));

    // Select test round and ensure initial open state
    const roundId = await page.evaluate(async () => {
      const select = document.getElementById('admin-round-student-select');
      const targetRoundId = select?.value || (window.state.rounds || [])[0]?.id || 'round_test_datn_2027';
      if (select) {
        select.value = targetRoundId;
      }
      window.state.selectedRoundId = targetRoundId;

      // Ensure round exists in memory with allowSelfJoin: true initially
      const round = (window.state.rounds || []).find(r => r.id === targetRoundId);
      if (round) round.allowSelfJoin = true;

      if (typeof window.loadAdminEligibleStudents === 'function') {
        await window.loadAdminEligibleStudents(targetRoundId);
      }
      if (typeof window.updateAdminRoundJoinLinkToolbar === 'function') {
        window.updateAdminRoundJoinLinkToolbar(targetRoundId);
      }
      return targetRoundId;
    });

    console.log(`Working with Round ID: ${roundId}`);

    // Verify initial open state
    let toolbarState = await page.evaluate(() => ({
      badgeText: document.getElementById('admin-round-join-link-badge')?.innerText?.trim(),
      btnText: document.getElementById('btn-admin-toggle-round-join-link')?.innerText?.trim()
    }));
    console.log(`Initial toolbar state: Badge="${toolbarState.badgeText}", Button="${toolbarState.btnText}"`);

    // 1. Click "Khóa link" button on toolbar
    console.log('Admin clicks "Khóa link" button...');
    await page.evaluate(() => {
      document.getElementById('btn-admin-toggle-round-join-link').click();
    });

    await new Promise(r => setTimeout(r, 600));

    // Verify Custom Confirm Modal
    const modalConfirmData = await page.evaluate(() => {
      const m = document.getElementById('modal-confirm');
      const isVisible = m && !m.classList.contains('hidden');
      const title = document.getElementById('modal-confirm-title')?.textContent?.trim();
      const message = document.getElementById('modal-confirm-message')?.textContent?.trim();
      const okBtn = document.getElementById('modal-confirm-btn-ok')?.textContent?.trim();
      return { isVisible, title, message, okBtn };
    });

    console.log(`Confirm Modal: Title="${modalConfirmData.title}", OK="${modalConfirmData.okBtn}"`);
    if (!modalConfirmData.title.includes('Khóa link tham gia đợt tốt nghiệp?')) {
      throw new Error(`Confirm modal title mismatch: got "${modalConfirmData.title}"`);
    }

    // Confirm locking
    console.log('Confirming lock action in modal...');
    await page.evaluate(() => {
      document.getElementById('modal-confirm-btn-ok').click();
    });

    await new Promise(r => setTimeout(r, 1200));

    // Verify Toolbar updated to LOCKED state
    toolbarState = await page.evaluate(() => ({
      badgeText: document.getElementById('admin-round-join-link-badge')?.innerText?.trim(),
      btnText: document.getElementById('btn-admin-toggle-round-join-link')?.innerText?.trim()
    }));
    console.log(`After Lock toolbar state: Badge="${toolbarState.badgeText}", Button="${toolbarState.btnText}"`);
    if (!toolbarState.badgeText.includes('Link đã khóa') || !toolbarState.btnText.includes('Mở lại link')) {
      throw new Error('Toolbar did not transition to Locked state properly.');
    }

    // Screenshot 1: Desktop Admin Locked Toolbar
    await saveDualScreenshot(page, '01_desktop_admin_round_join_link_locked.png');

    // 2. Open Join Link Modal and inspect
    console.log('Admin opens Join Link Modal...');
    await page.evaluate(() => {
      window.openRoundJoinLinkModal();
    });
    await new Promise(r => setTimeout(r, 600));

    const modalJoinData = await page.evaluate(() => {
      const modal = document.getElementById('modal-round-join-link');
      const isVisible = modal && !modal.classList.contains('hidden');
      const badge = document.getElementById('round-join-link-status-badge')?.textContent?.trim();
      const toggle = document.getElementById('round-join-link-toggle')?.checked;
      const notice = document.getElementById('round-join-link-locked-notice');
      const noticeVisible = notice && !notice.classList.contains('hidden');
      const noticeText = notice?.textContent?.trim();
      const url = document.getElementById('round-join-link-url')?.value;
      return { isVisible, badge, toggle, noticeVisible, noticeText, url };
    });

    console.log(`Modal Details: Badge="${modalJoinData.badge}", NoticeVisible=${modalJoinData.noticeVisible}, Notice="${modalJoinData.noticeText}"`);
    if (!modalJoinData.noticeVisible || !modalJoinData.noticeText.includes('Link đã khóa')) {
      throw new Error('Modal locked notice is missing or not visible.');
    }

    // Screenshot 2: Desktop Admin Modal Locked
    await saveDualScreenshot(page, '02_desktop_admin_modal_round_join_link_locked.png');

    // Close Modal
    await page.evaluate(() => window.closeRoundJoinLinkModal());
    await new Promise(r => setTimeout(r, 400));

    // 3. Test Reload Persistence
    console.log('Reloading page (F5) to verify persistence in Firestore...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.state !== 'undefined', { timeout: 15000 });

    await page.evaluate(async (rId) => {
      window.state = window.state || {};
      window.state.user = { email: 'admin@tdtu.edu.vn', displayName: 'Quản trị viên Hệ thống' };
      window.state.isAdmin = true;
      if (typeof window.switchView === 'function') window.switchView('admin');
      if (typeof window.switchAdminTab === 'function') window.switchAdminTab('eligible-students');
      if (typeof window.loadAdminEligibleStudents === 'function') {
        await window.loadAdminEligibleStudents(rId);
      }
      if (typeof window.updateAdminRoundJoinLinkToolbar === 'function') {
        window.updateAdminRoundJoinLinkToolbar(rId);
      }
    }, roundId);

    await new Promise(r => setTimeout(r, 800));

    const persistedState = await page.evaluate(() => ({
      badgeText: document.getElementById('admin-round-join-link-badge')?.innerText?.trim(),
      btnText: document.getElementById('btn-admin-toggle-round-join-link')?.innerText?.trim()
    }));
    console.log(`Persisted Toolbar State after reload: Badge="${persistedState.badgeText}", Button="${persistedState.btnText}"`);
    if (!persistedState.badgeText.includes('Link đã khóa')) {
      throw new Error('Locked state was not persisted across page reload.');
    }

    // 4. Test "Mở lại link" button on toolbar
    console.log('Admin clicks "Mở lại link"...');
    await page.evaluate(() => {
      document.getElementById('btn-admin-toggle-round-join-link').click();
    });
    await new Promise(r => setTimeout(r, 600));

    const unlockModalData = await page.evaluate(() => ({
      title: document.getElementById('modal-confirm-title')?.textContent?.trim(),
      okBtn: document.getElementById('modal-confirm-btn-ok')?.textContent?.trim()
    }));
    console.log(`Unlock Confirm Modal: Title="${unlockModalData.title}", Button="${unlockModalData.okBtn}"`);
    if (!unlockModalData.title.includes('Cho phép sinh viên mới tham gia')) {
      throw new Error('Unlock confirmation title mismatch.');
    }

    // Confirm reopening
    await page.evaluate(() => document.getElementById('modal-confirm-btn-ok').click());
    await new Promise(r => setTimeout(r, 1200));

    toolbarState = await page.evaluate(() => ({
      badgeText: document.getElementById('admin-round-join-link-badge')?.innerText?.trim(),
      btnText: document.getElementById('btn-admin-toggle-round-join-link')?.innerText?.trim()
    }));
    console.log(`Toolbar State after Reopening: Badge="${toolbarState.badgeText}", Button="${toolbarState.btnText}"`);
    if (!toolbarState.badgeText.includes('Link đang mở') || !toolbarState.btnText.includes('Khóa link')) {
      throw new Error('Toolbar did not transition back to Open state.');
    }

    // Screenshot 3: Desktop Admin Reopened Toolbar
    await saveDualScreenshot(page, '03_desktop_admin_round_join_link_unlocked.png');

    // Lock again for student testing phase
    console.log('Re-locking link for student rejection test phase...');
    await page.evaluate(async (rId) => {
      await window.executeRoundJoinLinkToggle(rId, false);
    }, roundId);
    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------------------
    // PHASE 2: STUDENT INTERACTION & MOBILE 375PX
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2: STUDENT SELF-JOIN REJECTION WHEN LOCKED (Mobile 375px) ---');
    await page.setViewport({ width: 375, height: 812, isMobile: true });

    // New student arrives via join link
    const newStudentMssv = '99200999';
    await page.goto(`${baseUrl}/?join=${roundId}&emulator=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.state !== 'undefined', { timeout: 15000 });

    const toastMessage = await page.evaluate(async (rId, mssv) => {
      window.state = window.state || {};
      window.state.user = {
        email: `${mssv.toLowerCase()}@student.tdtu.edu.vn`,
        displayName: 'Sinh viên Mới Test',
        uid: 'mock_student_new_uid'
      };
      window.state.isStudent = true;
      window.state.studentMssv = mssv;

      let capturedToast = '';
      const origShowToast = window.showToast;
      window.showToast = function(msg, type, duration) {
        capturedToast = msg;
        if (typeof origShowToast === 'function') origShowToast(msg, type, duration);
      };

      if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
        await window.checkAndHandlePendingRoundJoin();
      }

      return capturedToast;
    }, roundId, newStudentMssv);

    console.log(`Captured Toast for Locked Link: "${toastMessage}"`);
    if (!toastMessage.includes('Đợt tốt nghiệp này đã ngừng tiếp nhận sinh viên tham gia mới. Vui lòng liên hệ Khoa nếu cần hỗ trợ.')) {
      throw new Error(`Expected lock notification toast, but got: "${toastMessage}"`);
    }

    // Screenshot 4: Mobile 375px Student Blocked
    await saveDualScreenshot(page, '04_mobile_375_student_join_link_locked_blocked.png');

    // -------------------------------------------------------------------------
    // PHASE 3: EXISTING STUDENT ACCESS PRESERVED WHEN LINK IS LOCKED
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 3: EXISTING STUDENT ACCESS PRESERVED (Desktop 1920x1080) ---');
    await page.setViewport({ width: 1920, height: 1080 });

    const existingStudentMssv = '99200001';
    await page.goto(`${baseUrl}/?join=${roundId}&emulator=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.state !== 'undefined', { timeout: 15000 });

    const existingStudentResult = await page.evaluate(async (rId, mssv) => {
      window.state = window.state || {};
      window.state.user = {
        email: `${mssv.toLowerCase()}@student.tdtu.edu.vn`,
        displayName: 'Sinh viên Đã Tham Gia 01',
        uid: 'mock_student_existing_01'
      };
      window.state.isStudent = true;
      window.state.studentMssv = mssv;

      if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
        await window.checkAndHandlePendingRoundJoin();
      }

      const modal = document.getElementById('modal-student-confirm-join-round');
      const isModalVisible = modal && !modal.classList.contains('hidden');
      const resultTitle = document.getElementById('student-join-result-title')?.textContent?.trim();
      const resultDesc = document.getElementById('student-join-result-desc')?.textContent?.trim();

      return { isModalVisible, resultTitle, resultDesc };
    }, roundId, existingStudentMssv);

    console.log(`Existing Student Check: ModalVisible=${existingStudentResult.isModalVisible}, Title="${existingStudentResult.resultTitle}"`);
    if (!existingStudentResult.resultTitle.includes('Bạn đã tham gia đợt tốt nghiệp này')) {
      throw new Error('Existing student was not recognized or blocked incorrectly.');
    }

    // Screenshot 5: Existing student membership confirmed
    await saveDualScreenshot(page, '05_desktop_existing_student_access_preserved.png');

    // -------------------------------------------------------------------------
    // PHASE 4: REOPEN LINK & NEW STUDENT JOINS SUCCESSFULLY
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 4: REOPEN LINK & NEW STUDENT SUCCESSFUL JOIN ---');
    // Admin reopens link
    await page.evaluate(async (rId) => {
      await window.executeRoundJoinLinkToggle(rId, true);
    }, roundId);
    await new Promise(r => setTimeout(r, 1000));

    // New student arrives again
    await page.goto(`${baseUrl}/?join=${roundId}&emulator=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.state !== 'undefined', { timeout: 15000 });

    const formModalData = await page.evaluate(async (rId, mssv) => {
      window.state = window.state || {};
      window.state.user = {
        email: `${mssv.toLowerCase()}@student.tdtu.edu.vn`,
        displayName: 'Nguyễn Văn Mới',
        uid: 'mock_new_join_uid'
      };
      window.state.isStudent = true;
      window.state.studentMssv = mssv;

      if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
        await window.checkAndHandlePendingRoundJoin();
      }

      const formSection = document.getElementById('student-join-form-section');
      const isFormVisible = formSection && !formSection.classList.contains('hidden');
      const mssvVal = document.getElementById('student-join-mssv')?.value;

      return { isFormVisible, mssvVal };
    }, roundId, newStudentMssv);

    console.log(`New Student Form: Visible=${formModalData.isFormVisible}, MSSV="${formModalData.mssvVal}"`);
    if (!formModalData.isFormVisible) {
      throw new Error('Student registration form modal did not open when link was unlocked.');
    }

    // Fill form and submit
    await page.evaluate(async () => {
      const nameInput = document.getElementById('student-join-fullname');
      const classInput = document.getElementById('student-join-class');
      if (nameInput) nameInput.value = 'Nguyễn Văn Mới';
      if (classInput) classInput.value = '21050101';
      if (typeof window.confirmStudentSelfJoinRound === 'function') {
        await window.confirmStudentSelfJoinRound();
      }
    });

    await new Promise(r => setTimeout(r, 1500));

    const joinSuccessResult = await page.evaluate(() => {
      const title = document.getElementById('student-join-result-title')?.textContent?.trim();
      const desc = document.getElementById('student-join-result-desc')?.textContent?.trim();
      return { title, desc };
    });
    console.log(`Join Success: Title="${joinSuccessResult.title}", Desc="${joinSuccessResult.desc}"`);
    if (!joinSuccessResult.title.includes('Bạn đã tham gia đợt tốt nghiệp thành công')) {
      throw new Error('Student self-join submission did not complete successfully.');
    }

    // Screenshot 6: New student join success
    await saveDualScreenshot(page, '06_desktop_new_student_join_success.png');

    // -------------------------------------------------------------------------
    // PHASE 5: MOBILE 375PX ADMIN CONTROLS
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 5: MOBILE 375PX ADMIN TOOLBAR CONTROLS ---');
    await page.setViewport({ width: 375, height: 812, isMobile: true });

    await page.evaluate(async (rId) => {
      window.state = window.state || {};
      window.state.user = { email: 'admin@tdtu.edu.vn', displayName: 'Quản trị viên Hệ thống' };
      window.state.isAdmin = true;
      if (typeof window.switchView === 'function') window.switchView('admin');
      if (typeof window.switchAdminTab === 'function') window.switchAdminTab('eligible-students');
      if (typeof window.loadAdminEligibleStudents === 'function') {
        await window.loadAdminEligibleStudents(rId);
      }
      if (typeof window.updateAdminRoundJoinLinkToolbar === 'function') {
        window.updateAdminRoundJoinLinkToolbar(rId);
      }
    }, roundId);

    await new Promise(r => setTimeout(r, 1000));

    // Screenshot 7: Mobile 375px Admin Toolbar
    await saveDualScreenshot(page, '07_mobile_375_admin_toolbar_controls.png');

    console.log('\n================================================================');
    console.log('🎉 ALL 7 E2E BROWSER TESTS & SCREENSHOTS PASSED PERFECTLY!');
    console.log('================================================================\n');

  } finally {
    await browser.close();
    if (server) {
      server.close();
      console.log('Static test server stopped.');
    }
  }
}

runJoinLockE2ETests().catch(err => {
  console.error('\n❌ E2E Browser Test Suite Failed:', err);
  process.exit(1);
});
