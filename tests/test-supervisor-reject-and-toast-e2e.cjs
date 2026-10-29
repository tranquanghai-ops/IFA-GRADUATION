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
  const port = 8089;
  const server = await createStaticServer(port);
  console.log(`Static server running at http://127.0.0.1:${port}`);

  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // 1. Desktop Test (1920x1080)
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

    // Inject mock supervisor state
    await page.evaluate(() => {
      window.state = window.state || {};
      window.state.user = {
        uid: 'sup_cuong',
        email: 'phanbaocuong@tdtu.edu.vn',
        displayName: 'ThS. KTS. Phan Bảo Cường'
      };
      window.state.isSupervisor = true;
      window.getEffectiveActor = () => ({
        uid: 'sup_cuong',
        email: 'phanbaocuong@tdtu.edu.vn',
        displayName: 'ThS. KTS. Phan Bảo Cường',
        isSupervisor: true,
        isAdmin: false
      });
      window.checkImpersonationWriteGuard = () => true;
      window.setDoc = async () => {};
      window.deleteDoc = async () => {};
      window.loadSupervisorReviewData = async () => {};
      window.state.selectedRoundId = 'round_2027_04';
      window.state.activeRound = {
        id: 'round_2027_04',
        name: 'Đợt 4/2027 - Khóa 2021',
        currentReviewRound: 1,
        reviewStatus: 'round_1',
        reviewLocks: {}
      };
      window.state.roundSupervisors = [
        {
          id: 'sup_cuong',
          supervisorId: 'sup_cuong',
          email: 'phanbaocuong@tdtu.edu.vn',
          fullName: 'ThS. KTS. Phan Bảo Cường',
          capacity: 10,
          acceptedCount: 0
        }
      ];
      window.state.supervisorsMaster = [
        {
          id: 'sup_cuong',
          email: 'phanbaocuong@tdtu.edu.vn',
          fullName: 'ThS. KTS. Phan Bảo Cường'
        }
      ];
      window.state.supervisorAcceptedStudents = [];
      window.state.supervisorDecisions = {};
      window.state.supervisorCandidateFilter = 'all';

      window.state.supervisorCandidates = [
        {
          studentId: '12100325',
          studentName: 'Nguyễn Lê Minh Hiếu',
          fullName: 'Nguyễn Lê Minh Hiếu',
          className: '21010301',
          currentClass: '21010301',
          classDisplay: '21010301',
          hasValidClass: true,
          topicTitle: 'Trung tâm Văn hóa Nghệ thuật Đương đại Sài Gòn',
          topicDescription: 'Nghiên cứu ứng dụng ngôn ngữ không gian chuyển tiếp kết hợp vật liệu gốm địa phương trong thiết kế bảo tàng.',
          projectType: 'Đồ án tốt nghiệp',
          candidateRank: 1,
          isEarlyTransition: false,
          currentDecision: ''
        },
        {
          studentId: '12100326',
          studentName: 'Lương Nguyễn Thảo Vy',
          fullName: 'Lương Nguyễn Thảo Vy',
          className: '21010302',
          currentClass: '21010302',
          classDisplay: '21010302',
          hasValidClass: true,
          topicTitle: 'Không gian Triển lãm và Trải nghiệm Di sản Kiến trúc',
          topicDescription: 'Tái định hình không gian giao lưu cộng đồng và bảo tồn giá trị bản địa trong bối cảnh đô thị hiện đại.',
          projectType: 'Đồ án tốt nghiệp',
          candidateRank: 1,
          isEarlyTransition: false,
          currentDecision: ''
        },
        {
          studentId: '12100327',
          studentName: 'Hoàng Thái Thảo My',
          fullName: 'Hoàng Thái Thảo My',
          className: '21010301',
          currentClass: '21010301',
          classDisplay: '21010301',
          hasValidClass: true,
          topicTitle: 'Trung tâm Thiết kế Sáng tạo và Co-working Trẻ',
          topicDescription: 'Tối ưu hóa không gian làm việc tích hợp vi khí hậu xanh thích ứng với người trẻ thế hệ mới.',
          projectType: 'Đồ án tốt nghiệp',
          candidateRank: 1,
          isEarlyTransition: false,
          currentDecision: ''
        }
      ];

      // Switch to supervisor view
      if (typeof window.switchView === 'function') {
        window.switchView('supervisor');
      }
      if (typeof window.renderSupervisorCandidatesTable === 'function') {
        window.renderSupervisorCandidatesTable(false);
      }
    });

    await new Promise(r => setTimeout(r, 600));

    // Screenshot 1: Desktop Initial Candidate Review View with 2 buttons [✓ Chọn nhận SV] & [✕ Không chọn]
    const shot1 = path.join(SCREENSHOT_DIR, '01_desktop_supervisor_candidates_pending_two_buttons.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log(`Saved screenshot 1: ${shot1}`);

    // Click "Không chọn" on Nguyễn Lê Minh Hiếu
    await page.evaluate(async () => {
      const actor = window.getEffectiveActor ? window.getEffectiveActor() : window.state.user;
      console.log('In browser: actor:', JSON.stringify(actor), 'roundId:', window.state.selectedRoundId);
      const sup = window.resolveSupervisorIdentity(actor, window.state.roundSupervisors, window.state.supervisorsMaster);
      console.log('In browser: resolved supervisor:', sup?.fullName, sup?.email);
      window.setSupervisorDecision('12100325', 'rejected');
    });

    await new Promise(r => setTimeout(r, 400));

    // Verify confirmation modal message contains student name + MSSV
    const confirmText = await page.evaluate(() => {
      const msgEl = document.getElementById('modal-confirm-message');
      return msgEl ? msgEl.textContent : '';
    });
    console.log('Confirmation Modal Message:', confirmText);
    if (!confirmText.includes('Nguyễn Lê Minh Hiếu (12100325)')) {
      throw new Error(`Confirmation modal did NOT contain student name + MSSV: ${confirmText}`);
    }

    // Screenshot 2: Desktop Confirmation Dialog with Student Name + MSSV
    const shot2 = path.join(SCREENSHOT_DIR, '02_desktop_reject_confirm_modal_with_name_mssv.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`Saved screenshot 2: ${shot2}`);

    // Click confirm in modal
    await page.evaluate(() => {
      const okBtn = document.getElementById('modal-confirm-btn-ok');
      if (okBtn) okBtn.click();
    });

    await new Promise(r => setTimeout(r, 500));

    // Screenshot 3: Desktop Candidate Rejected State with [✕ Không chọn] badge and [↺ Hoàn tác] button
    const shot3 = path.join(SCREENSHOT_DIR, '03_desktop_supervisor_candidate_rejected_and_undo.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log(`Saved screenshot 3: ${shot3}`);

    // Filter by "Không chọn"
    await page.evaluate(() => {
      if (typeof window.setSupervisorCandidateFilter === 'function') {
        window.setSupervisorCandidateFilter('rejected');
      }
    });
    await new Promise(r => setTimeout(r, 300));

    // Screenshot 4: Desktop Filtered by Rejected
    const shot4 = path.join(SCREENSHOT_DIR, '04_desktop_filter_rejected_candidates.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log(`Saved screenshot 4: ${shot4}`);

    // 2. Mobile Test (375x812 - iPhone X / 13)
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.evaluate(() => {
      if (typeof window.setSupervisorCandidateFilter === 'function') {
        window.setSupervisorCandidateFilter('all');
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Screenshot 5: Mobile Candidate Review with balanced responsive action buttons
    const shot5 = path.join(SCREENSHOT_DIR, '05_mobile_375_supervisor_candidates_responsive.png');
    await page.screenshot({ path: shot5, fullPage: false });
    console.log(`Saved screenshot 5: ${shot5}`);

    // Select candidate 2 (Lương Nguyễn Thảo Vy)
    await page.evaluate(() => {
      if (typeof window.setSupervisorDecision === 'function') {
        window.setSupervisorDecision('12100326', 'selected');
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Screenshot 6: Mobile Candidate Selected State with Toast notification
    const shot6 = path.join(SCREENSHOT_DIR, '06_mobile_375_candidate_selected_state_and_toast.png');
    await page.screenshot({ path: shot6, fullPage: false });
    console.log(`Saved screenshot 6: ${shot6}`);

    console.log('E2E UI & Visual Regression Suite COMPLETED SUCCESSFULLY (6 Screenshots captured).');
  } finally {
    await browser.close();
    server.close();
  }
}

runE2E().catch(err => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
