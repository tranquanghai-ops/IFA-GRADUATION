const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const SCREENSHOT_DIR = path.resolve('C:/Users/HHHH-HP/.gemini/antigravity/brain/85d98480-3b40-4985-ae5c-72405fe52acd/screenshots');
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

function startStaticServer(port = 5066) {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function runE2E() {
  console.log('--- STARTING SUPERVISOR PREVIOUS ROUNDS E2E TEST ---');
  const server = await startStaticServer(5066);
  const browserPath = getBrowserExecutablePath();
  console.log('Launching browser at:', browserPath);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to page
    await page.goto('http://127.0.0.1:5066/?emulator=true', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.renderSupervisorPreviousAcceptedRounds === 'function', { timeout: 15000 });

    console.log('Page loaded, injecting mock test state...');

    // Scenario 1: Round 2 Review (showing Round 1 accepted list)
    await page.evaluate(() => {
      // Switch view to supervisor portal review panel
      const supView = document.getElementById('view-supervisor');
      if (supView) supView.classList.remove('hidden');
      const allViews = document.querySelectorAll('.view-section');
      allViews.forEach(v => { if (v.id !== 'view-supervisor') v.classList.add('hidden'); });

      const reviewPanel = document.getElementById('sup-panel-review');
      if (reviewPanel) reviewPanel.classList.remove('hidden');
      const otherPanels = ['sup-panel-dashboard', 'sup-panel-accepted', 'sup-panel-students', 'sup-panel-topics'];
      otherPanels.forEach(pid => {
        const el = document.getElementById(pid);
        if (el) el.classList.add('hidden');
      });

      // Mock state
      window.state = window.state || {};
      window.state.user = { email: 'tquangarc@gmail.com', displayName: 'ThS. KTS. Nguyễn Tăng Quang' };
      window.state.activeRound = {
        id: 'ROUND_TEST_01',
        title: 'Đợt 4/2027 – Đồ án tốt nghiệp',
        roundName: 'Đợt 4/2027',
        academicYear: '2026-2027',
        currentReviewRound: 2,
        reviewStatus: 'round_2'
      };

      const supId = 'SUP_QUANG';
      const currentSup = {
        id: supId,
        supervisorId: supId,
        name: 'ThS. KTS. Nguyễn Tăng Quang',
        email: 'tquangarc@gmail.com',
        capacity: 5,
        acceptedCount: 3
      };

      const round1Students = [
        {
          studentId: '20012001',
          studentName: 'Phạm Nhật Nam',
          fullName: 'Phạm Nhật Nam',
          className: '20050201',
          phone: '0912345678',
          topicTitle: 'Trung tâm Nghiên cứu và Trưng bày Gốm truyền thống Bình Dương',
          topicDescription: 'Dự án nghiên cứu giải pháp thiết kế bảo tồn và phát huy làng nghề gốm sứ thủ công qua không gian kiến trúc nội thất mở kết hợp công nghệ tương tác số.',
          projectType: 'Đồ án Nghiên cứu & Thiết kế',
          reviewStatus: 'accepted',
          acceptedRank: 1
        },
        {
          studentId: '20012002',
          studentName: 'Lê Minh Khang',
          fullName: 'Lê Minh Khang',
          className: '20050201',
          phone: '',
          topicTitle: 'Không gian Văn hóa và Triển lãm Di sản Nghệ thuật Nam Bộ',
          topicDescription: 'Tổ hợp không gian triển lãm kết nối di sản văn hóa đương đại.',
          projectType: 'Đồ án Thiết kế',
          reviewStatus: 'accepted',
          acceptedRank: 1
        },
        {
          studentId: '20012003',
          studentName: 'Đặng Thảo Vy',
          fullName: 'Đặng Thảo Vy',
          className: '20050202',
          phone: '0988776655',
          topicTitle: 'Thiết kế Không gian Trải nghiệm Nghệ thuật Đa giác quan',
          topicDescription: 'Ứng dụng ánh sáng và vật liệu sinh thái trong thiết kế không gian triển lãm.',
          projectType: 'Đồ án Đa giác quan',
          reviewStatus: 'accepted',
          acceptedRank: 1
        }
      ];

      const currentRound2Candidates = [
        {
          studentId: '20012010',
          studentName: 'Hoàng Quốc Bảo',
          fullName: 'Hoàng Quốc Bảo',
          className: '20050201',
          phone: '0933221100',
          topicTitle: 'Bảo tàng Tương tác Kiến trúc Đô thị Sài Gòn',
          topicDescription: 'Không gian trải nghiệm lịch sử phát triển đô thị qua các thời kỳ.',
          projectType: 'Đồ án Nghiên cứu',
          candidateRank: 2
        }
      ];

      window.state.supervisorCandidates = currentRound2Candidates;
      window.state.supervisorDecisions = {};
      window.state.supervisorAcceptedStudents = round1Students;
      window.state.supervisorRound1AcceptedStudents = round1Students;
      window.state.supervisorRound2AcceptedStudents = [];
      window.state.supervisorAcceptedByRound = { 1: round1Students, 2: [] };

      // Set greeting and round badges
      const greetingEl = document.getElementById('supervisor-greeting-name');
      if (greetingEl) greetingEl.innerHTML = 'Kính chào Thầy/Cô <span class="font-black">ThS. KTS. Nguyễn Tăng Quang</span>';
      const roundInfoEl = document.getElementById('supervisor-round-info');
      if (roundInfoEl) roundInfoEl.textContent = 'Đợt 4/2027 – Đồ án tốt nghiệp (2026-2027)';
      const activeBadgeEl = document.getElementById('sup-active-round-badge');
      if (activeBadgeEl) activeBadgeEl.textContent = 'Đợt 4/2027';

      // Update Top Stats Card
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal('sup-stat-total-cap', 5);
      setVal('sup-stat-accepted-prev', 3);
      setVal('sup-stat-selected-curr', 0);
      setVal('sup-stat-remaining-cap', 2);

      setVal('sup-review-stat-total-cap', 5);
      setVal('sup-review-stat-accepted-prev', 3);
      setVal('sup-review-stat-selected-curr', 0);
      setVal('sup-review-stat-remaining-cap', 2);
      setVal('sup-review-stat-waiting', 1);

      // Render candidates table and previous rounds
      window.renderSupervisorCandidatesTable(false);
      window.renderSupervisorPreviousAcceptedRounds();
    });

    await new Promise(r => setTimeout(r, 600));

    // Verify DOM in Round 2
    const round2Check = await page.evaluate(() => {
      const container = document.getElementById('sup-previous-rounds-container');
      const isVisible = container && !container.classList.contains('hidden');
      const card1 = document.getElementById('sup-prev-round-card-1');
      const card2 = document.getElementById('sup-prev-round-card-2');
      const cnt1 = document.getElementById('sup-prev-round-cnt-1')?.textContent?.trim();
      const rows1 = document.querySelectorAll('#sup-prev-round-tbody-1 tr').length;
      return { isVisible, hasCard1: Boolean(card1), hasCard2: Boolean(card2), cnt1, rows1 };
    });

    console.log('Round 2 DOM verification:', round2Check);
    if (!round2Check.isVisible || !round2Check.hasCard1 || round2Check.hasCard2 || round2Check.rows1 !== 3) {
      throw new Error('Round 2 DOM verification failed: ' + JSON.stringify(round2Check));
    }

    // Capture Screenshot 1: Desktop Round 2
    const file1 = path.join(SCREENSHOT_DIR, '01_desktop_supervisor_portal_round2_previous_accepted.png');
    await page.screenshot({ path: file1, fullPage: false });
    console.log('Saved screenshot 1:', file1);

    // Scenario 2: Round 3 Review (showing both Round 1 and Round 2 accepted lists)
    await page.evaluate(() => {
      window.state.activeRound.currentReviewRound = 3;
      window.state.activeRound.reviewStatus = 'round_3';

      const round2Students = [
        {
          studentId: '20012015',
          studentName: 'Trần Gia Huy',
          fullName: 'Trần Gia Huy',
          className: '20050201',
          phone: '0977112233',
          topicTitle: 'Thiết kế Không gian Triển lãm Điêu khắc Ánh sáng',
          topicDescription: 'Khai thác nghệ thuật ánh sáng và bóng đổ trong không gian trưng bày bảo tàng mỹ thuật đương đại.',
          projectType: 'Đồ án Thiết kế',
          reviewStatus: 'accepted',
          acceptedRank: 2
        }
      ];

      window.state.supervisorRound2AcceptedStudents = round2Students;
      window.state.supervisorAcceptedByRound[2] = round2Students;

      // Update stats for Round 3: total 5, accepted prev = 3 (R1) + 1 (R2) = 4, remaining = 1
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal('sup-stat-accepted-prev', 4);
      setVal('sup-stat-remaining-cap', 1);
      setVal('sup-review-stat-accepted-prev', 4);
      setVal('sup-review-stat-remaining-cap', 1);

      window.renderSupervisorPreviousAcceptedRounds();
    });

    await new Promise(r => setTimeout(r, 600));

    // Verify DOM in Round 3
    const round3Check = await page.evaluate(() => {
      const card1 = document.getElementById('sup-prev-round-card-1');
      const card2 = document.getElementById('sup-prev-round-card-2');
      const rows1 = document.querySelectorAll('#sup-prev-round-tbody-1 tr').length;
      const rows2 = document.querySelectorAll('#sup-prev-round-tbody-2 tr').length;
      const statPrev = document.getElementById('sup-review-stat-accepted-prev')?.textContent?.trim();
      const statRem = document.getElementById('sup-review-stat-remaining-cap')?.textContent?.trim();
      return { hasCard1: Boolean(card1), hasCard2: Boolean(card2), rows1, rows2, statPrev, statRem };
    });

    console.log('Round 3 DOM verification:', round3Check);
    if (!round3Check.hasCard1 || !round3Check.hasCard2 || round3Check.rows1 !== 3 || round3Check.rows2 !== 1 || round3Check.statPrev !== '4') {
      throw new Error('Round 3 DOM verification failed: ' + JSON.stringify(round3Check));
    }

    // Capture Screenshot 2: Desktop Round 3 (Showing Round 1 + Round 2)
    const file2 = path.join(SCREENSHOT_DIR, '02_desktop_supervisor_portal_round3_previous_accepted.png');
    await page.screenshot({ path: file2, fullPage: false });
    console.log('Saved screenshot 2:', file2);

    // Scenario 3: Collapse Toggle Interaction
    await page.evaluate(() => {
      window.toggleSupervisorPreviousRoundCollapse(1);
    });
    await new Promise(r => setTimeout(r, 400));

    const collapseCheck = await page.evaluate(() => {
      const body1 = document.getElementById('sup-prev-round-body-1');
      const btn1 = document.getElementById('sup-prev-round-toggle-btn-1');
      return {
        isBodyHidden: body1?.classList.contains('hidden'),
        btnText: btn1?.textContent?.trim()
      };
    });

    console.log('Collapse toggle verification:', collapseCheck);
    if (!collapseCheck.isBodyHidden || !collapseCheck.btnText.includes('Mở rộng')) {
      throw new Error('Collapse toggle failed: ' + JSON.stringify(collapseCheck));
    }

    // Capture Screenshot 3: Desktop Collapse State
    const file3 = path.join(SCREENSHOT_DIR, '03_desktop_supervisor_portal_collapse_toggle.png');
    await page.screenshot({ path: file3, fullPage: false });
    console.log('Saved screenshot 3:', file3);

    // Re-expand Round 1 for mobile view
    await page.evaluate(() => {
      window.toggleSupervisorPreviousRoundCollapse(1);
    });
    await new Promise(r => setTimeout(r, 300));

    // Scenario 4: Mobile Viewport 375px
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await new Promise(r => setTimeout(r, 500));

    // Scroll down to previous rounds container
    await page.evaluate(() => {
      const el = document.getElementById('sup-previous-rounds-container');
      if (el) el.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 400));

    const file4 = path.join(SCREENSHOT_DIR, '04_mobile_375_supervisor_portal_previous_rounds.png');
    await page.screenshot({ path: file4, fullPage: false });
    console.log('Saved screenshot 4:', file4);

    console.log('======================================================');
    console.log('🎉 ALL 4 E2E SCENARIOS & SCREENSHOTS COMPLETED 100%');
    console.log('======================================================');
  } finally {
    await browser.close();
    server.close();
  }
}

runE2E().catch(err => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
