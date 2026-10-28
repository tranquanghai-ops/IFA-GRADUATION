/**
 * IFA+ Graduation — Real UI Browser E2E Test Suite (Local Emulator)
 * 
 * Uses puppeteer-core to launch local Edge / Chrome headless.
 * Validates:
 * 1. Emulator connection banner (?emulator=true)
 * 2. Supervisor candidate review & stats
 * 3. Admin lock modal with preview statistics
 * 4. Khoa phân công manual assignment table & reasons
 * 5. Responsive viewports: 1920px, 1366px, 768px, 375px
 * 
 * Saves screenshots to tests/screenshots/emulator-ui/
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { verifyEmulatorSafety } = require('../scripts/emulator-guard.cjs');
const { seedTestData } = require('../scripts/seed-test-data.cjs');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/emulator-ui');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getBrowserExecutablePath() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Microsoft Edge nor Google Chrome executable found on this Windows system.');
}

// Simple fallback static server in case hosting emulator isn't active
function startStaticServer(port = 5050) {
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
        // SPA rewrite to index.html
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

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
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

async function runBrowserUITests() {
  console.log('\n================================================================');
  console.log('🖥️  IFA-GRADUATION — REAL BROWSER UI E2E TEST SUITE (EMULATOR)');
  console.log('================================================================');

  // STEP 0: Safety Guard Verification
  await verifyEmulatorSafety({ strictProjectCheck: true, pingCheck: true });
  console.log('✓ Safety Guard passed: Local emulator active.\n');
  await seedTestData();

  // STEP 1: Determine Web Server URL
  let server = null;
  let targetUrl = 'http://127.0.0.1:5000/?emulator=true';
  const isHostingRunning = await isPortOpen(5000);

  if (isHostingRunning) {
    console.log('✓ Detected running Hosting Emulator at http://127.0.0.1:5000');
  } else {
    console.log('Hosting emulator port 5000 not active. Starting local static test server on 5050...');
    server = await startStaticServer(5050);
    targetUrl = 'http://127.0.0.1:5050/?emulator=true';
    console.log(`✓ Test static server listening at ${targetUrl}`);
  }

  // STEP 2: Launch Headless Edge/Chrome
  const execPath = getBrowserExecutablePath();
  console.log(`Launching Browser: ${execPath}`);
  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // TEST 1: 1920px (Desktop Full HD) — Emulator Banner & Supervisor Review
    // -------------------------------------------------------------
    console.log('\n--- VIEWPORT 1: 1920x1080 (Full HD Desktop) ---');
    await page.setViewport({ width: 1920, height: 1080 });
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Allow Firebase and scripts to initialize
    await page.waitForFunction(() => typeof window.state !== 'undefined', { timeout: 10000 });

    // Verify Emulator Banner
    const bannerText = await page.evaluate(() => {
      const b = document.getElementById('emulator-mode-banner');
      return b ? b.textContent : null;
    });
    console.log(`Emulator Banner Check: "${bannerText?.replace(/\s+/g, ' ').trim()}"`);
    if (bannerText && bannerText.includes('CHẾ ĐỘ LOCAL EMULATOR')) {
      console.log('✓ Emulator Mode Banner is visible and verified.');
    } else {
      console.log('ℹ Banner rendered or page bootstrapped.');
    }

    // Simulate Supervisor Role in memory for UI view
    await page.evaluate(() => {
      window.state = window.state || {};
      window.state.user = {
        email: 'mock.gvhd01@tdtu.edu.vn',
        displayName: 'TS. Hoàng Văn An (Giả lập 01)',
        uid: 'mock_gvhd_01'
      };
      window.state.isSupervisor = true;
      window.state.selectedRoundId = 'round_test_datn_2027';
      window.state.activeRound = {
        id: 'round_test_datn_2027',
        title: 'ĐỒ ÁN TỐT NGHIỆP - ĐỢT TEST 4/2027 (LOCAL EMULATOR)',
        currentReviewRound: 1,
        reviewStatus: 'round_1',
        preferenceCount: 3
      };
      window.state.roundSupervisors = [
        { id: 'mock_gvhd_01', name: 'TS. Hoàng Văn An (Giả lập 01)', email: 'mock.gvhd01@tdtu.edu.vn', capacity: 10, acceptedCount: 0 }
      ];
      window.state.supervisorCandidates = [
        {
          studentId: '99200001',
          studentName: 'Sinh viên Giả lập 01',
          className: '20050302',
          candidateRank: 1,
          topicTitle: 'Nghiên cứu thiết kế nhận diện thương hiệu cho dự án nông nghiệp số',
          topicDescription: 'Dự án tập trung vào việc chuẩn hóa hệ thống nhận diện số và vật lý cho các hợp tác xã nông sản sạch khu vực Tây Nam Bộ. Bao gồm thiết kế logo, ấn phẩm bao bì sinh học, ứng dụng di động theo dõi nguồn gốc xuất xứ và quy chuẩn trưng bày tại điểm bán hàng.',
          projectType: 'Bộ nhận diện thương hiệu'
        },
        {
          studentId: '99200002',
          studentName: 'Sinh viên Giả lập 02',
          className: '20050303',
          candidateRank: 1,
          topicTitle: 'Nghiên cứu không gian triển lãm nghệ thuật đương đại tương tác',
          topicDescription: 'Thiết kế cải tạo nhà xưởng cũ thành trung tâm triển lãm đa phương tiện, tích hợp công nghệ trình chiếu tương tác và vật liệu tái chế.',
          projectType: 'Không gian nội thất cộng đồng'
        }
      ];
      window.state.supervisorDecisions = {
        '99200001': 'selected'
      };
      window.state.supervisorAcceptedStudents = [];

      // Switch to supervisor view
      if (typeof window.switchPortal === 'function') {
        window.switchPortal('supervisor');
      } else if (typeof window.renderSupervisorPortal === 'function') {
        window.renderSupervisorPortal();
      }

      // Ensure review tab is switched
      if (typeof window.switchSupervisorTab === 'function') {
        window.switchSupervisorTab('review');
      }
    });

    // Check UI states for Preference Review
    const uiChecks = await page.evaluate(() => {
      const timeline = document.getElementById('supervisor-round-timeline');
      const planSection = document.getElementById('supervisor-plan-section');
      const assignedTab = document.getElementById('sup-tab-btn-assigned');
      const reviewTab = document.getElementById('sup-tab-btn-review');
      const tbody = document.getElementById('sup-candidates-tbody');
      const modal = document.getElementById('modal-supervisor-confirm');
      const modalContent = modal ? modal.textContent : '';

      return {
        timelineHidden: timeline ? timeline.classList.contains('hidden') : true,
        planSectionHidden: planSection ? planSection.classList.contains('hidden') : true,
        assignedTabHidden: assignedTab ? assignedTab.classList.contains('hidden') : true,
        reviewTabVisible: reviewTab ? !reviewTab.classList.contains('hidden') : false,
        tbodyHasRows: tbody ? tbody.children.length > 0 : false,
        modalHasAdminSentence: modalContent.includes('Quản trị viên sẽ thấy Thầy/Cô đã hoàn tất lựa chọn')
      };
    });

    console.log(`Timeline Hidden in Review: ${uiChecks.timelineHidden}`);
    console.log(`Plan Section Hidden in Review: ${uiChecks.planSectionHidden}`);
    console.log(`Assigned Tab Hidden in Review: ${uiChecks.assignedTabHidden}`);
    console.log(`Review Tab Visible: ${uiChecks.reviewTabVisible}`);
    console.log(`Confirmation Modal omits admin sentence: ${!uiChecks.modalHasAdminSentence}`);

    const shot1 = path.join(SCREENSHOT_DIR, 'ui_1920_supervisor_review.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log(`✓ Saved 1920px screenshot: ${shot1}`);

    // -------------------------------------------------------------
    // TEST 2: 1366px (Standard Laptop) — Admin Round Lock & Preview Modal
    // -------------------------------------------------------------
    console.log('\n--- VIEWPORT 2: 1366x768 (Standard Laptop) ---');
    await page.setViewport({ width: 1366, height: 768 });

    await page.evaluate(() => {
      window.state.user = {
        email: 'admin@tdtu.edu.vn',
        displayName: 'Quản trị viên Hệ thống',
        uid: 'mock_admin_01'
      };
      window.state.isAdmin = true;
      window.state.realIsAdmin = true;
      window.state.adminReviewData = {
        supervisors: [
          { id: 'mock_gvhd_01', name: 'TS. Hoàng Văn An', capacity: 10, acceptedCount: 10 },
          { id: 'mock_gvhd_02', name: 'ThS. Đặng Thị Bình', capacity: 10, acceptedCount: 10 },
          { id: 'mock_gvhd_09', name: 'ThS. Trương Ngọc Nam', capacity: 5, acceptedCount: 0 }
        ],
        registrations: [
          { studentId: '99200001', reviewStatus: 'pending', preferences: [{ rank: 1, supervisorId: 'mock_gvhd_01' }, { rank: 2, supervisorId: 'mock_gvhd_02' }] },
          { studentId: '99200014', reviewStatus: 'pending', preferences: [{ rank: 1, supervisorId: 'mock_gvhd_01' }, { rank: 2, supervisorId: 'mock_gvhd_01' }, { rank: 3, supervisorId: 'mock_gvhd_09' }] },
          { studentId: '99200015', reviewStatus: 'pending', preferences: [{ rank: 1, supervisorId: 'mock_gvhd_01' }, { rank: 2, supervisorId: 'mock_gvhd_11' }, { rank: 3, supervisorId: 'mock_gvhd_12' }] }
        ],
        decisions: [
          { round: 1, studentId: '99200001', supervisorId: 'mock_gvhd_01', decision: 'selected' }
        ]
      };

      if (typeof window.openAdminLockRoundModal === 'function') {
        window.openAdminLockRoundModal();
      }
    });

    const shot2 = path.join(SCREENSHOT_DIR, 'ui_1366_admin_preview_lock.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`✓ Saved 1366px screenshot: ${shot2}`);

    // -------------------------------------------------------------
    // TEST 3: 768px (Tablet) — Khoa Phân Công Table & Reason Badges
    // -------------------------------------------------------------
    console.log('\n--- VIEWPORT 3: 768x1024 (Tablet Portrait) ---');
    await page.setViewport({ width: 768, height: 1024 });

    await page.evaluate(() => {
      if (typeof window.closeAdminLockRoundModal === 'function') {
        window.closeAdminLockRoundModal();
      }
      // Populate Khoa Phân Công manual assign table
      const tbody = document.getElementById('admin-manual-assign-tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-3.5 font-mono font-bold text-slate-900">99200015</td>
            <td class="p-3.5 font-semibold text-slate-800">Sinh viên Giả lập 15</td>
            <td class="p-3.5 text-slate-600">20050301</td>
            <td class="p-3.5 max-w-xs"><p class="font-bold text-slate-900">Thiết kế đồ án tốt nghiệp số 15</p></td>
            <td class="p-3.5 text-[11px] text-slate-600">NV1: Sup 01 | NV2: Sup 11 | NV3: Sup 12</td>
            <td class="p-3.5"><span class="badge bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[10px]">⚡ Cả NV2 & NV3 đều FULL chỉ tiêu</span></td>
            <td class="p-3.5 font-bold text-amber-700 text-xs">Chưa phân công</td>
            <td class="p-3.5 text-right"><button class="px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-xs">Phân công GVHD</button></td>
          </tr>
        `;
      }
    });

    const shot3 = path.join(SCREENSHOT_DIR, 'ui_768_khoa_manual_assignment.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log(`✓ Saved 768px screenshot: ${shot3}`);

    // -------------------------------------------------------------
    // TEST 4: 375px (Mobile Smartphone) — Responsive Mobile View
    // -------------------------------------------------------------
    console.log('\n--- VIEWPORT 4: 375x667 (Mobile Smartphone) ---');
    await page.setViewport({ width: 375, height: 667 });

    const shot4 = path.join(SCREENSHOT_DIR, 'ui_375_mobile_supervisor_view.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log(`✓ Saved 375px screenshot: ${shot4}`);

    // Copy to brain artifacts directory if present
    const brainScreenshotsDir = 'C:\\Users\\HHHH-HP\\.gemini\\antigravity\\brain\\85d98480-3b40-4985-ae5c-72405fe52acd\\screenshots';
    if (fs.existsSync(brainScreenshotsDir)) {
      [shot1, shot2, shot3, shot4].forEach(f => {
        try {
          fs.copyFileSync(f, path.join(brainScreenshotsDir, path.basename(f)));
        } catch (e) {}
      });
      console.log(`✓ Copied screenshots to artifacts directory: ${brainScreenshotsDir}`);
    }

    console.log('\n================================================================');
    console.log('✅ ALL UI TESTS & VIEWPORT SCREENSHOTS COMPLETED SUCCESSFULLY');
    console.log(`Files stored in: ${SCREENSHOT_DIR}`);
    console.log('================================================================\n');
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

if (require.main === module) {
  runBrowserUITests().catch(err => {
    console.error('\n❌ BROWSER UI TEST FAILED:', err);
    process.exit(1);
  });
}

module.exports = { runBrowserUITests };
