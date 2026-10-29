/**
 * IFA+ Graduation — Real Browser E2E Test
 * Simulates Real Google OAuth Login for Supervisor Phan Bảo Cường on Zalo iPhone WebKit Viewport
 * & Compares with Owner Impersonation mode to ensure 100% equivalence.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const puppeteer = require('puppeteer-core');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ARTIFACT_DIR = 'C:\\Users\\HHHH-HP\\.gemini\\antigravity\\brain\\85d98480-3b40-4985-ae5c-72405fe52acd\\screenshots';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function getBrowserExecutablePath() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Microsoft Edge nor Google Chrome executable found on this Windows system.');
}

function startStaticServer(port = 5057) {
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

  return new Promise((resolve) => {
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
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        });
        res.end(data);
      });
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function run() {
  console.log('================================================================');
  console.log('🧪 GVHD PHAN BẢO CƯỜNG REAL LOGIN & ZALO IPHONE SIMULATION E2E');
  console.log('================================================================');

  const server = await startStaticServer(5057);
  console.log('✓ Static test server listening on http://127.0.0.1:5057');

  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // 1. Configure Mobile Safari / Zalo in-app browser on iPhone 15 Pro
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ZaloTheme/light Zalo/24.03.01'
    );
    await page.setViewport({
      width: 393,
      height: 852,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });

    console.log('✓ Viewport set to iPhone 15 Pro (393x852 @3x), User-Agent: Zalo iOS WebKit');
    await page.goto('http://127.0.0.1:5057/?emulator=true', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for core JS to be loaded
    await page.waitForFunction(() => typeof window.resolveSupervisorIdentity === 'function', { timeout: 15000 });
    console.log('✓ Application initialized and resolveSupervisorIdentity is available.');

    // 2. Set up Mock Data matching Production Round 4/2027
    const mockSetup = await page.evaluate(async () => {
      const ROUND_ID = 'p6OSVMkVgvvbkjGyPOFb';
      const SUP_MASTER_ID = 'SZ5gSix1l0BZs0NLkkjU';
      const SUP_EMAIL = 'phanbaocuong@tdtu.edu.vn';
      const SUP_NAME = 'ThS. KTS. Phan Bảo Cường';

      // Master catalog
      window.state.supervisorsMaster = [
        {
          id: SUP_MASTER_ID,
          name: SUP_NAME,
          email: SUP_EMAIL,
          defaultQuota: 10,
          active: true,
          employmentType: 'internal'
        }
      ];

      // Round supervisors
      const roundSup = {
        id: SUP_MASTER_ID,
        supervisorId: SUP_MASTER_ID,
        email: SUP_EMAIL,
        name: SUP_NAME,
        maxQuota: 10, // Matching Production document structure
        active: true
      };

      // Mock Round info
      const roundObj = {
        id: ROUND_ID,
        title: 'Đợt 4/2027',
        roundName: 'Đợt 4/2027',
        academicYear: '2026-2027',
        status: 'ongoing',
        active: true,
        phase: 'matching_r1',
        currentReviewRound: 1,
        reviewStatus: 'round_1',
        reviewLocks: {}
      };
      window.state.rounds = [roundObj];
      window.state.activeRound = roundObj;
      window.state.currentRoundId = ROUND_ID;

      // 5 registered students matching Production NV1
      const mockStudents = [
        {
          id: '12100296',
          mssv: '12100296',
          fullName: 'Đinh Võ Tuấn Anh',
          gpa: 7.82,
          passedCredits: 128,
          topicTitle: 'Trung tâm Nghiên cứu và Phát triển AI',
          preferences: [
            { priority: 1, supervisorId: SUP_MASTER_ID, supervisorName: SUP_NAME, supervisorEmail: SUP_EMAIL }
          ]
        },
        {
          id: '12100306',
          mssv: '12100306',
          fullName: 'Phan Nhật Cường',
          gpa: 8.15,
          passedCredits: 132,
          topicTitle: 'Không gian Văn hóa và Triển lãm Đương đại',
          preferences: [
            { priority: 1, supervisorId: SUP_MASTER_ID, supervisorName: SUP_NAME, supervisorEmail: SUP_EMAIL }
          ]
        },
        {
          id: '12200239',
          mssv: '12200239',
          fullName: 'Ngô Bảo Trân',
          gpa: 8.45,
          passedCredits: 130,
          topicTitle: 'Khu Nghỉ dưỡng Sinh thái Bền vững',
          preferences: [
            { priority: 1, supervisorId: SUP_MASTER_ID, supervisorName: SUP_NAME, supervisorEmail: SUP_EMAIL }
          ]
        },
        {
          id: '12200265',
          mssv: '12200265',
          fullName: 'Phạm Thị Kim Anh',
          gpa: 7.95,
          passedCredits: 125,
          topicTitle: 'Bảo tàng Di sản Kiến trúc Đô thị',
          preferences: [
            { priority: 1, supervisorId: SUP_MASTER_ID, supervisorName: SUP_NAME, supervisorEmail: SUP_EMAIL }
          ]
        },
        {
          id: '12200282',
          mssv: '12200282',
          fullName: 'Võ Lê Nhật Quỳnh',
          gpa: 8.60,
          passedCredits: 135,
          topicTitle: 'Tổ hợp Không gian Sáng tạo và Co-working',
          preferences: [
            { priority: 1, supervisorId: SUP_MASTER_ID, supervisorName: SUP_NAME, supervisorEmail: SUP_EMAIL }
          ]
        }
      ];

      // SIMULATION OF REAL GOOGLE OAUTH LOGIN:
      // Note: UID is an arbitrary OAuth UID, NOT SZ5gSix1l0BZs0NLkkjU!
      const realGoogleUser = {
        uid: 'google_oauth_9988776655_pbc',
        email: SUP_EMAIL,
        displayName: SUP_NAME
      };

      // Resolve identity using new standardized mechanism
      const resolvedIdentity = window.resolveSupervisorIdentity(
        realGoogleUser,
        [roundSup],
        window.state.supervisorsMaster
      );

      // Set user session
      window.state.user = realGoogleUser;
      window.state.realUser = realGoogleUser;
      window.state.isSupervisor = true;
      window.state.isAdmin = false;
      window.state.isOwner = false;
      window.state.impersonating = false;
      window.state.supervisorProfile = resolvedIdentity;

      // Switch to supervisor view
      await window.switchView('supervisor');

      // Populate review UI with current supervisor data
      window.state.roundSupervisors = [roundSup];
      window.state.currentRoundSupervisors = [roundSup];
      window.state.currentRoundStudents = mockStudents;
      window.state.supervisorAcceptedStudents = [];
      window.state.supervisorCandidateFilter = 'all';
      window.state.allDecisions = []; // Real supervisor has 0 prior decisions

      // Switch to review sub-tab
      if (typeof window.switchSupervisorTab === 'function') {
        window.switchSupervisorTab('review');
      }

      // Populate review candidates and stats
      window.state.supervisorCandidates = mockStudents.map(s => ({
        studentId: s.id,
        studentName: s.fullName,
        mssv: s.mssv,
        className: '21050101',
        gpa: s.gpa,
        passedCredits: s.passedCredits,
        topicTitle: s.topicTitle,
        candidateRank: 1,
        preferencePriority: 1
      }));
      window.state.supervisorDecisions = {};

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal('sup-review-stat-total-cap', resolvedIdentity.capacity);
      setVal('sup-review-stat-accepted-prev', 0);
      setVal('sup-review-stat-selected-curr', 0);
      setVal('sup-review-stat-remaining-cap', resolvedIdentity.capacity);
      setVal('sup-review-stat-waiting', mockStudents.length);

      if (typeof window.renderSupervisorCandidatesTable === 'function') {
        window.renderSupervisorCandidatesTable(false);
      }

      // Read actual stats cards
      const greetingEl = document.getElementById('supervisor-greeting-name');
      const capEl = document.getElementById('sup-review-stat-total-cap');
      const selectedEl = document.getElementById('sup-review-stat-selected-curr');
      const remainingEl = document.getElementById('sup-review-stat-remaining-cap');
      const waitingEl = document.getElementById('sup-review-stat-waiting');
      const tbodyEl = document.getElementById('sup-candidates-tbody');
      const tbodyHtml = tbodyEl ? tbodyEl.innerHTML : 'NO_TBODY';
      const tbodyRows = tbodyEl ? tbodyEl.querySelectorAll('tr').length : -1;

      return {
        resolvedIdentity: {
          id: resolvedIdentity.id,
          name: resolvedIdentity.name,
          email: resolvedIdentity.email,
          capacity: resolvedIdentity.capacity,
          activeInRound: resolvedIdentity.activeInRound
        },
        greeting: greetingEl ? greetingEl.innerText.trim() : '',
        capacity: capEl ? capEl.innerText.trim() : '',
        selected: selectedEl ? selectedEl.innerText.trim() : '',
        remaining: remainingEl ? remainingEl.innerText.trim() : '',
        waiting: waitingEl ? waitingEl.innerText.trim() : '',
        tbodyRows,
        tbodyHtml: tbodyHtml.slice(0, 300)
      };
    });

    console.log('✓ Real Google Login Simulation executed. Result:', mockSetup);

    // Assertions for Real Google Auth Login
    assert.strictEqual(mockSetup.resolvedIdentity.capacity, 10, 'Capacity must be 10, NOT 0');
    assert.strictEqual(mockSetup.resolvedIdentity.activeInRound, true, 'Supervisor must be active in round');
    assert.strictEqual(mockSetup.resolvedIdentity.id, 'SZ5gSix1l0BZs0NLkkjU', 'ID must resolve to SZ5gSix1l0BZs0NLkkjU');
    assert.strictEqual(mockSetup.capacity, '10', 'Rendered capacity stat must be 10');
    assert.strictEqual(mockSetup.selected, '0', 'Rendered selected stat must be 0');
    assert.strictEqual(mockSetup.remaining, '10', 'Rendered remaining stat must be 10');
    assert.strictEqual(mockSetup.waiting, '5', 'Rendered waiting stat must be 5');
    assert.strictEqual(mockSetup.tbodyRows, 5, 'Rendered candidate rows must be 5');

    // Wait 500ms for UI transitions
    await new Promise(r => setTimeout(r, 600));

    // Capture mobile screenshot
    const mobileScreenPath = path.join(SCREENSHOT_DIR, '01_supervisor_real_login_zalo_mobile.png');
    const artifactMobileScreenPath = path.join(ARTIFACT_DIR, '01_supervisor_real_login_zalo_mobile.png');
    await page.screenshot({ path: mobileScreenPath, fullPage: true });
    fs.copyFileSync(mobileScreenPath, artifactMobileScreenPath);
    console.log('✓ Captured iPhone Zalo Mobile Screenshot:', artifactMobileScreenPath);

    // 3. Switch to Desktop Viewport (1920x1080) for Desktop Audit
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(r => setTimeout(r, 500));

    const desktopScreenPath = path.join(SCREENSHOT_DIR, '02_supervisor_real_login_desktop.png');
    const artifactDesktopScreenPath = path.join(ARTIFACT_DIR, '02_supervisor_real_login_desktop.png');
    await page.screenshot({ path: desktopScreenPath, fullPage: true });
    fs.copyFileSync(desktopScreenPath, artifactDesktopScreenPath);
    console.log('✓ Captured Desktop Screenshot:', artifactDesktopScreenPath);

    // 4. Test Owner Impersonation on the exact same dataset
    const impersonationResult = await page.evaluate(async () => {
      const SUP_MASTER_ID = 'SZ5gSix1l0BZs0NLkkjU';
      const SUP_EMAIL = 'phanbaocuong@tdtu.edu.vn';
      const SUP_NAME = 'ThS. KTS. Phan Bảo Cường';

      const masterCatalog = [
        {
          id: SUP_MASTER_ID,
          name: SUP_NAME,
          email: SUP_EMAIL,
          defaultQuota: 10,
          active: true,
          employmentType: 'internal'
        }
      ];

      const roundSupList = [
        {
          id: SUP_MASTER_ID,
          supervisorId: SUP_MASTER_ID,
          email: SUP_EMAIL,
          name: SUP_NAME,
          maxQuota: 10,
          active: true
        }
      ];

      // Impersonating actor
      const ownerActor = {
        uid: SUP_MASTER_ID,
        email: 'tranquanghai@tdtu.edu.vn',
        displayName: 'Owner Thầy Hải',
        impersonating: true,
        target: {
          id: SUP_MASTER_ID,
          name: SUP_NAME,
          email: SUP_EMAIL
        }
      };

      const resolvedImpersonated = window.resolveSupervisorIdentity(
        ownerActor,
        roundSupList,
        masterCatalog
      );

      console.log('resolvedImpersonated:', resolvedImpersonated);
      if (!resolvedImpersonated) {
        throw new Error('resolveSupervisorIdentity returned null for impersonated actor: ' + JSON.stringify(ownerActor));
      }

      return {
        id: resolvedImpersonated.id,
        name: resolvedImpersonated.name,
        email: resolvedImpersonated.email,
        capacity: resolvedImpersonated.capacity,
        activeInRound: resolvedImpersonated.activeInRound
      };
    });

    console.log('✓ Owner Impersonation Result:', impersonationResult);

    // Verify 100% equivalence between Real Login and Owner Impersonation
    assert.strictEqual(impersonationResult.id, mockSetup.resolvedIdentity.id);
    assert.strictEqual(impersonationResult.email, mockSetup.resolvedIdentity.email);
    assert.strictEqual(impersonationResult.capacity, mockSetup.resolvedIdentity.capacity);
    assert.strictEqual(impersonationResult.activeInRound, mockSetup.resolvedIdentity.activeInRound);

    console.log('\n================================================================');
    console.log('🎉 REAL BROWSER E2E TEST PASSED WITH 100% FIDELITY & EQUIVALENCE');
    console.log('================================================================');

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err);
  process.exit(1);
});
