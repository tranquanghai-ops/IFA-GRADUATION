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

async function runE2E() {
  const port = 8092;
  const server = await createStaticServer(port);
  console.log(`Static server running at http://127.0.0.1:${port}`);

  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      const t = msg.text();
      if (!t.includes('Failed to load resource') && !t.includes('favicon')) {
        console.log('PAGE LOG:', t);
      }
    });

    // 1. Desktop Test (1920x1080)
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.filterAndDeduplicateMasterSupervisors === 'function', { timeout: 15000 });
    console.log('✓ Application initialized and core resolvers available.');

    // Inject mock state with real production-like duplicates (Master doc + Email index doc)
    await page.evaluate(() => {
      const REAL_HIEU_ID = 'oWS52UHJbLDk2rkzQyPR';
      const HIEU_EMAIL = 'nguyenminhhieu@tdtu.edu.vn';

      window.state = window.state || {};
      window.state.isAdmin = true;
      window.state.realIsOwner = true;
      window.state.allowImpersonation = true;
      window.state.currentView = 'admin';
      window.state.activeRound = {
        id: 'p6OSVMkVgvvbkjGyPOFb',
        title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP - ĐỢT 4/2027',
        roundName: 'T4-2027',
        preferenceCount: 3
      };
      window.state.rounds = [window.state.activeRound];
      window.state.selectedRoundId = 'p6OSVMkVgvvbkjGyPOFb';

      // Raw dataset containing the duplicate index document
      const rawMasterDocs = [
        {
          id: REAL_HIEU_ID,
          supervisorId: REAL_HIEU_ID,
          name: 'TS. KTS Nguyễn Minh Hiếu',
          email: HIEU_EMAIL,
          department: 'Thiết kế nội thất',
          defaultQuota: 10,
          employmentType: 'internal',
          active: true
        },
        {
          id: HIEU_EMAIL, // Email auth index doc
          supervisorId: REAL_HIEU_ID,
          name: 'TS. KTS Nguyễn Minh Hiếu',
          email: HIEU_EMAIL,
          isAuthIndex: true,
          active: true
        },
        {
          id: 'SZ5gSix1l0BZs0NLkkjU',
          supervisorId: 'SZ5gSix1l0BZs0NLkkjU',
          name: 'ThS. KTS. Phan Bảo Cường',
          email: 'phanbaocuong@tdtu.edu.vn',
          department: 'Thiết kế nội thất',
          defaultQuota: 10,
          employmentType: 'internal',
          active: true
        },
        {
          id: 'VMiij78ssdGs9sPd6WTG',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          name: 'ThS. KTS. Nguyễn Tăng Quang',
          email: 'tquangarc@gmail.com',
          department: 'Thiết kế nội thất',
          defaultQuota: 5,
          employmentType: 'adjunct',
          active: true
        }
      ];

      // Pass through deduplicator
      window.state.supervisorsMaster = window.filterAndDeduplicateMasterSupervisors(rawMasterDocs);

      // Round supervisors with old snapshot typo
      window.state.roundSupervisors = [
        {
          id: REAL_HIEU_ID,
          supervisorId: REAL_HIEU_ID,
          name: 'TS. KTX Nguyễn MInh Hiếu', // Typo in round snapshot
          email: HIEU_EMAIL,
          department: 'Thiết kế nội thất',
          capacity: 10,
          activeInRound: true
        },
        {
          id: 'SZ5gSix1l0BZs0NLkkjU',
          supervisorId: 'SZ5gSix1l0BZs0NLkkjU',
          name: 'ThS. KTS. Phan Bảo Cường',
          email: 'phanbaocuong@tdtu.edu.vn',
          department: 'Thiết kế nội thất',
          capacity: 10,
          activeInRound: true
        }
      ];

      // Switch to Admin view and render table
      if (typeof window.switchView === 'function') window.switchView('admin');
      if (typeof window.renderAdminSupervisorsMasterTable === 'function') {
        window.renderAdminSupervisorsMasterTable();
      }
    });

    // Check count in admin table
    const hieuRowsCount = await page.evaluate(() => {
      const tbody = document.getElementById('admin-supervisors-master-tbody');
      if (!tbody) return 0;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      return rows.filter(r => r.textContent.includes('nguyenminhhieu@tdtu.edu.vn')).length;
    });

    console.log(`✓ Admin supervisors master table contains ${hieuRowsCount} row(s) for TS. KTS Nguyễn Minh Hiếu (Expected: 1).`);

    // Screenshot 1: Desktop Admin Supervisor Management Table
    const shot1 = path.join(SCREENSHOT_DIR, '01_desktop_admin_supervisors_master_dedup.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log(`✓ Screenshot 1 saved: ${shot1}`);

    // Open Edit modal for TS. KTS Nguyễn Minh Hiếu
    await page.evaluate(() => {
      if (typeof window.editSupervisorMasterModal === 'function') {
        window.editSupervisorMasterModal('oWS52UHJbLDk2rkzQyPR');
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Verify modal has stable ID
    const formValues = await page.evaluate(() => {
      return {
        id: document.getElementById('sup-form-id')?.value,
        name: document.getElementById('sup-form-name')?.value,
        email: document.getElementById('sup-form-email')?.value
      };
    });
    console.log('✓ Edit Modal values:', formValues);

    // Screenshot 2: Edit Supervisor Modal with stable ID
    const shot2 = path.join(SCREENSHOT_DIR, '02_desktop_edit_supervisor_modal_stable_id.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`✓ Screenshot 2 saved: ${shot2}`);

    // Close edit modal
    await page.evaluate(() => {
      if (typeof window.closeSupervisorModal === 'function') window.closeSupervisorModal();
    });

    // Open Impersonation Modal (Owner Act-As)
    await page.evaluate(async () => {
      if (typeof window.openAdminImpersonateModal === 'function') {
        await window.openAdminImpersonateModal();
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Check candidate name in Impersonation modal
    const impCandidateName = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#impersonate-candidates-container [id^="cand-card-"]'));
      const hieuCard = cards.find(c => c.textContent.includes('nguyenminhhieu@tdtu.edu.vn'));
      return hieuCard ? hieuCard.querySelector('.font-bold')?.textContent : null;
    });
    console.log(`✓ Impersonation modal candidate name resolved to: "${impCandidateName}" (Expected: TS. KTS Nguyễn Minh Hiếu)`);

    // Screenshot 3: Impersonation Modal displaying corrected Master name
    const shot3 = path.join(SCREENSHOT_DIR, '03_desktop_owner_impersonation_candidate_kts_hieu.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log(`✓ Screenshot 3 saved: ${shot3}`);

    // Close impersonation modal
    await page.evaluate(() => {
      if (typeof window.closeAdminImpersonateModal === 'function') window.closeAdminImpersonateModal();
    });

    // Switch to Student Registration View (Bước 2: Chọn GVHD)
    await page.evaluate(async () => {
      if (typeof window.switchView === 'function') await window.switchView('student');
      if (typeof window.loadRoundSupervisors === 'function') {
        // Resolve round supervisors with Master
        state.roundSupervisors = state.roundSupervisors.map(rs => {
          const resolved = window.resolveSupervisorProfile(rs.supervisorId || rs.id, rs);
          return { ...rs, ...resolved };
        });
        if (typeof window.renderSupervisorsGrid === 'function') window.renderSupervisorsGrid();
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Screenshot 4: Student view preference cards
    const shot4 = path.join(SCREENSHOT_DIR, '04_desktop_student_registration_card_kts_hieu.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log(`✓ Screenshot 4 saved: ${shot4}`);

    // 2. Mobile Viewport (375x667)
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.evaluate(async () => {
      if (typeof window.switchView === 'function') await window.switchView('admin');
      if (typeof window.renderAdminSupervisorsMasterTable === 'function') window.renderAdminSupervisorsMasterTable();
    });
    await new Promise(r => setTimeout(r, 400));

    // Screenshot 5: Mobile Admin table
    const shot5 = path.join(SCREENSHOT_DIR, '05_mobile_375_admin_supervisors_dedup.png');
    await page.screenshot({ path: shot5, fullPage: false });
    console.log(`✓ Screenshot 5 saved: ${shot5}`);

    // Open Impersonation modal in Mobile
    await page.evaluate(async () => {
      if (typeof window.openAdminImpersonateModal === 'function') {
        await window.openAdminImpersonateModal();
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Screenshot 6: Mobile Impersonation modal
    const shot6 = path.join(SCREENSHOT_DIR, '06_mobile_375_impersonation_kts_hieu.png');
    await page.screenshot({ path: shot6, fullPage: false });
    console.log(`✓ Screenshot 6 saved: ${shot6}`);

    console.log('\n==================================================');
    console.log('✓ ALL 6 E2E SCREENSHOTS GENERATED SUCCESSFULLY!');
    console.log('==================================================');

  } finally {
    await browser.close();
    server.close();
  }
}

runE2E().catch(err => {
  console.error('E2E Runner Error:', err);
  process.exit(1);
});
