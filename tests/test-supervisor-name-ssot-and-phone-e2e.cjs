/**
 * IFA+ Graduation — Puppeteer E2E Verification Suite
 * 1. SSOT Supervisor Name Resolution across Admin Review & Assignments ("TS. KTS Nguyễn Minh Hiếu")
 * 2. Student Phone Number Display in Supervisor Candidate Review & Portal ("📞 SĐT: 09xxxxxxxx" with tel: link)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const ARTIFACT_DIR = 'C:\\Users\\HHHH-HP\\.gemini\\antigravity\\brain\\85d98480-3b40-4985-ae5c-72405fe52acd\\screenshots';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function getBrowserExecutablePath() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Edge nor Chrome executable found.');
}

function startStaticServer(port = 5088) {
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

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function run() {
  console.log('================================================================');
  console.log('🧪 E2E SUITE: SSOT SUPERVISOR NAME & STUDENT PHONE VERIFICATION');
  console.log('================================================================');

  const server = await startStaticServer(5088);
  console.log('✓ Static server running on http://127.0.0.1:5088');

  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const targetUrl = 'http://127.0.0.1:5088/?emulator=true';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForFunction(() => typeof window.setupAuthListener === 'function', { timeout: 15000 });
    console.log('✓ App scripts loaded.');

    const roundId = 'p6OSVMkVgvvbkjGyPOFb';
    const hieuMasterId = 'oWS52UHJbLDk2rkzQyPR';
    const hieuEmail = 'nguyenminhhieu@tdtu.edu.vn';

    // =========================================================================
    // SCENARIO 1: ADMIN MANUAL ASSIGNMENT (KHOA PHÂN CÔNG) - TS. KTS NGUYỄN MINH HIẾU
    // =========================================================================
    console.log('\n--- SCENARIO 1: Admin Review & Manual Assignment Table (TS. KTS Nguyễn Minh Hiếu) ---');
    const adminData = await page.evaluate(async (rId, mId, hEmail) => {
      // 1. Master supervisors catalog
      window.state.supervisorsMaster = [
        {
          id: mId,
          supervisorId: mId,
          name: 'TS. KTS Nguyễn Minh Hiếu',
          email: hEmail,
          employmentType: 'internal',
          department: 'Thiết kế nội thất',
          defaultQuota: 10,
          phone: '095409354',
          active: true,
          status: 'active'
        },
        {
          id: 'SZ5gSix1l0BZs0NLkkjU',
          supervisorId: 'SZ5gSix1l0BZs0NLkkjU',
          name: 'ThS. KTS. Phan Bảo Cường',
          email: 'phanbaocuong@tdtu.edu.vn',
          employmentType: 'internal',
          department: 'Kiến trúc',
          defaultQuota: 10,
          active: true
        }
      ];
      window.state._isSupervisorsMasterFullyLoaded = true;

      // 2. Active Round
      const roundObj = {
        id: rId,
        title: 'Đợt 4/2027 (K27)',
        roundName: 'Đợt 4/2027',
        academicYear: '2026-2027',
        currentReviewRound: 3,
        reviewStatus: 'manual_assignment',
        status: 'reviewing',
        isActive: true,
        preferenceCount: 3
      };
      window.state.rounds = [roundObj];
      window.state.activeRound = roundObj;
      window.state.selectedRoundId = rId;

      // 3. Round supervisors (snapshot may contain old typo "TS. KTX Nguyễn MInh Hiếu")
      window.state.roundSupervisors = [
        {
          id: mId,
          supervisorId: mId,
          name: 'TS. KTX Nguyễn MInh Hiếu',
          email: hEmail,
          department: 'Thiết kế nội thất',
          capacity: 10,
          maxQuota: 10,
          acceptedCount: 8,
          active: true
        },
        {
          id: 'SZ5gSix1l0BZs0NLkkjU',
          supervisorId: 'SZ5gSix1l0BZs0NLkkjU',
          name: 'ThS. KTS. Phan Bảo Cường',
          email: 'phanbaocuong@tdtu.edu.vn',
          department: 'Kiến trúc',
          capacity: 10,
          maxQuota: 10,
          acceptedCount: 9,
          active: true
        }
      ];

      // 4. Registrations where NV3 snapshot has outdated text "TS. KTX Nguyễn MInh Hiếu"
      const regObj = {
        id: '12000146',
        studentId: '12000146',
        studentName: 'Nguyễn Lê Minh Hiếu',
        className: '21010301',
        topicTitle: 'Trung tâm Nghiên cứu Ứng dụng Không gian Đô thị',
        projectType: 'Đề tài Ứng dụng',
        reviewStatus: 'unassigned',
        routeToKhoaReason: 'unselected_after_round_3',
        studentPhone: '0942912711',
        preferences: [
          { rank: 1, supervisorId: 'SZ5gSix1l0BZs0NLkkjU', supervisorName: 'ThS. KTS. Phan Bảo Cường' },
          { rank: 2, supervisorId: 'other_sup', supervisorName: 'GVHD Khác' },
          { rank: 3, supervisorId: mId, supervisorName: 'TS. KTX Nguyễn MInh Hiếu', department: 'Thiết kế nội thất' }
        ]
      };

      window.state.adminReviewData = {
        roundId: rId,
        supervisors: window.state.roundSupervisors,
        registrations: [regObj],
        decisions: [],
        eligible: [{ studentId: '12000146', fullName: 'Nguyễn Lê Minh Hiếu', className: '21010301', eligible: true }],
        officialAssignments: [],
        assignmentDrafts: []
      };

      window.state.isAdmin = true;
      window.state.currentRole = 'admin';
      window.state.currentView = 'admin';
      window.state.user = { email: 'tranquanghai@tdtu.edu.vn', displayName: 'Admin Trần Quang Hải' };

      // Switch to Admin view
      document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
      const adminView = document.getElementById('view-admin');
      if (adminView) adminView.classList.remove('hidden');

      // Switch to Review tab
      document.querySelectorAll('#view-admin > div').forEach(d => {
        if (d.id && d.id.startsWith('tab-content-')) d.classList.add('hidden');
      });
      const reviewTab = document.getElementById('tab-content-assignments');
      if (reviewTab) reviewTab.classList.remove('hidden');

      // Render Admin review dashboard and manual assignment table
      if (typeof window.renderAdminReviewDashboard === 'function') window.renderAdminReviewDashboard();
      if (typeof window.renderAdminManualAssignmentTable === 'function') window.renderAdminManualAssignmentTable();
      if (typeof window.renderAdminReviewSupervisorsTable === 'function') window.renderAdminReviewSupervisorsTable();

      const tbody = document.getElementById('admin-manual-assign-tbody');
      return {
        renderedHtml: tbody ? tbody.innerHTML : '',
        rowCount: tbody ? tbody.querySelectorAll('tr').length : 0
      };
    }, roundId, hieuMasterId, hieuEmail);

    console.log(`✓ Admin manual assignment rendered ${adminData.rowCount} unassigned row(s).`);
    const containsCanonicalName = adminData.renderedHtml.includes('TS. KTS Nguyễn Minh Hiếu');
    const containsOldTypo = adminData.renderedHtml.includes('TS. KTX');
    console.log(`- Canonical "TS. KTS Nguyễn Minh Hiếu" present: ${containsCanonicalName}`);
    console.log(`- Outdated "TS. KTX" typo present: ${containsOldTypo}`);

    if (!containsCanonicalName || containsOldTypo) {
      throw new Error(`SSOT Name Resolution failure in Admin Manual Assignment table! Output: ${adminData.renderedHtml}`);
    }

    const shot1Path = path.join(ARTIFACT_DIR, '01_desktop_admin_manual_assignment_kts_hieu_nv3.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${shot1Path}`);

    // =========================================================================
    // SCENARIO 2: ADMIN SUPERVISORS MASTER TABLE (1366x768)
    // =========================================================================
    console.log('\n--- SCENARIO 2: Admin Supervisors Master Table (TS. KTS Nguyễn Minh Hiếu) ---');
    await page.setViewport({ width: 1366, height: 768 });

    await page.evaluate(() => {
      document.querySelectorAll('#view-admin > div').forEach(d => {
        if (d.id && d.id.startsWith('tab-content-')) d.classList.add('hidden');
      });
      const masterTab = document.getElementById('tab-content-supervisors-master');
      if (masterTab) masterTab.classList.remove('hidden');
      if (typeof window.renderAdminSupervisorsMasterTable === 'function') window.renderAdminSupervisorsMasterTable();
    });

    const shot2Path = path.join(ARTIFACT_DIR, '02_desktop_admin_supervisors_master_hieu.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${shot2Path}`);

    // =========================================================================
    // SCENARIO 3: SUPERVISOR CANDIDATE REVIEW WITH PHONE NUMBER (1366x768)
    // =========================================================================
    console.log('\n--- SCENARIO 3: Supervisor Candidate Review - Phone Numbers & Links ---');
    const candReviewData = await page.evaluate(async (rId, mId, hEmail) => {
      window.state.currentRole = 'supervisor';
      window.state.isSupervisor = true;
      window.state.isAdmin = false;
      window.state.supervisorId = mId;
      window.state.supervisorName = 'TS. KTS Nguyễn Minh Hiếu';
      window.state.supervisorEmail = hEmail;
      window.state.user = { email: hEmail, displayName: 'TS. KTS Nguyễn Minh Hiếu', uid: mId };

      // Candidates with varying phone data
      window.state.supervisorCandidates = [
        {
          studentId: '12000146',
          studentName: 'Nguyễn Lê Minh Hiếu',
          fullName: 'Nguyễn Lê Minh Hiếu',
          className: '21010301',
          classDisplay: '21010301',
          hasValidClass: true,
          phone: '0942912711',
          studentPhone: '0942912711',
          topicTitle: 'Trung tâm Văn hóa Cộng đồng Gò Vấp',
          topicDescription: 'Không gian mở kết nối di sản địa phương với công nghệ số.',
          projectType: 'Đề tài Ứng dụng',
          candidateRank: 1
        },
        {
          studentId: '12000160',
          studentName: 'Lương Nguyễn Thảo Vy',
          fullName: 'Lương Nguyễn Thảo Vy',
          className: '21010302',
          classDisplay: '21010302',
          hasValidClass: true,
          phone: '0888468223',
          studentPhone: '0888468223',
          topicTitle: 'Thiết kế Không gian Nghỉ dưỡng Sinh thái Ven biển',
          topicDescription: 'Khai thác vật liệu gỗ tái chế và hệ thống chiếu sáng tự nhiên.',
          projectType: 'Đề tài Nghiên cứu',
          candidateRank: 1
        },
        {
          studentId: '12000166',
          studentName: 'Hoàng Thái Thảo My',
          fullName: 'Hoàng Thái Thảo My',
          className: '21010301',
          classDisplay: '21010301',
          hasValidClass: true,
          phone: '',
          studentPhone: '',
          topicTitle: 'Bảo tàng Nghệ thuật Tương tác Đương đại',
          topicDescription: 'Mô hình không gian trải nghiệm đa giác quan cho giới trẻ.',
          projectType: 'Đề tài Đổi mới sáng tạo',
          candidateRank: 1
        }
      ];

      window.state.supervisorDecisions = {
        '12000146': 'selected',
        '12000160': '',
        '12000166': 'rejected'
      };

      // Show supervisor view
      document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
      const supView = document.getElementById('view-supervisor');
      if (supView) supView.classList.remove('hidden');

      // Show review panel
      const matchingPanel = document.getElementById('sup-tab-content-matching');
      if (matchingPanel) matchingPanel.classList.remove('hidden');

      if (typeof window.renderSupervisorCandidatesTable === 'function') {
        window.renderSupervisorCandidatesTable(false);
      }

      const tbody = document.getElementById('sup-candidates-tbody');
      return {
        renderedHtml: tbody ? tbody.innerHTML : '',
        rowCount: tbody ? tbody.querySelectorAll('tr').length : 0
      };
    }, roundId, hieuMasterId, hieuEmail);

    console.log(`✓ Candidate table rendered ${candReviewData.rowCount} candidate(s).`);
    const hasPhoneIcon = candReviewData.renderedHtml.includes('📞 SĐT:');
    const hasTelLink1 = candReviewData.renderedHtml.includes('href="tel:0942912711"');
    const hasTelLink2 = candReviewData.renderedHtml.includes('href="tel:0888468223"');
    const hasMissingPhoneNotice = candReviewData.renderedHtml.includes('Chưa cập nhật SĐT');
    const hasSelectAll = candReviewData.renderedHtml.includes('select-all');

    console.log(`- Phone icon present: ${hasPhoneIcon}`);
    console.log(`- tel:0942912711 link present: ${hasTelLink1}`);
    console.log(`- tel:0888468223 link present: ${hasTelLink2}`);
    console.log(`- "Chưa cập nhật SĐT" notice present: ${hasMissingPhoneNotice}`);
    console.log(`- "select-all" class present: ${hasSelectAll}`);

    if (!hasPhoneIcon || !hasTelLink1 || !hasMissingPhoneNotice) {
      throw new Error(`Student phone display verification failed! Output: ${candReviewData.renderedHtml}`);
    }

    const shot3Path = path.join(ARTIFACT_DIR, '03_desktop_supervisor_portal_candidates_phone.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${shot3Path}`);

    // =========================================================================
    // SCENARIO 4: TABLET 768px VIEWPORT
    // =========================================================================
    console.log('\n--- SCENARIO 4: Tablet 768px Viewport ---');
    await page.setViewport({ width: 768, height: 1024 });
    const shot4Path = path.join(ARTIFACT_DIR, '04_tablet_768_supervisor_candidates_phone.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${shot4Path}`);

    // =========================================================================
    // SCENARIO 5: MOBILE 375px VIEWPORT
    // =========================================================================
    console.log('\n--- SCENARIO 5: Mobile 375px Viewport ---');
    await page.setViewport({ width: 375, height: 812 });
    const shot5Path = path.join(ARTIFACT_DIR, '05_mobile_375_supervisor_candidates_phone_tel.png');
    await page.screenshot({ path: shot5Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${shot5Path}`);

    // =========================================================================
    // SCENARIO 6: SUPERVISOR ASSIGNED STUDENTS PORTAL (1920x1080)
    // =========================================================================
    console.log('\n--- SCENARIO 6: Supervisor Assigned Students Cards (Phone display) ---');
    await page.setViewport({ width: 1920, height: 1080 });

    const assignedCardData = await page.evaluate((mId, hEmail) => {
      window.state.supervisorAssignedStudents = [
        {
          studentId: '12000146',
          id: '12000146',
          studentName: 'Nguyễn Lê Minh Hiếu',
          className: '21010301',
          major: 'Thiết kế Nội thất',
          phone: '0942912711',
          studentPhone: '0942912711',
          topicTitle: 'Trung tâm Văn hóa Cộng đồng Gò Vấp',
          topicApprovalStatus: 'approved',
          topicTitleVersion: 1,
          supervisors: [
            { supervisorId: mId, supervisorName: 'TS. KTS Nguyễn Minh Hiếu', supervisorEmail: hEmail, role: 'primary' }
          ]
        }
      ];

      // Switch to assigned students tab
      document.querySelectorAll('#view-supervisor > div').forEach(d => {
        if (d.id && d.id.startsWith('sup-tab-content-')) d.classList.add('hidden');
      });
      const studentsTab = document.getElementById('sup-tab-content-students');
      if (studentsTab) studentsTab.classList.remove('hidden');

      if (typeof window.renderSupervisorAssignedStudents === 'function') {
        window.renderSupervisorAssignedStudents();
      }

      const listEl = document.getElementById('supervisor-students-list');
      return {
        renderedHtml: listEl ? listEl.innerHTML : '',
        cardCount: listEl ? listEl.children.length : 0
      };
    }, hieuMasterId, hieuEmail);

    console.log(`✓ Assigned students card rendered: ${assignedCardData.cardCount} card(s).`);
    const cardHasPhone = assignedCardData.renderedHtml.includes('📞 SĐT:');
    const cardHasTel = assignedCardData.renderedHtml.includes('href="tel:0942912711"');
    console.log(`- Card phone icon present: ${cardHasPhone}`);
    console.log(`- Card tel:0942912711 link present: ${cardHasTel}`);

    const shot6Path = path.join(ARTIFACT_DIR, '06_desktop_supervisor_assigned_students_phone.png');
    await page.screenshot({ path: shot6Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${shot6Path}`);

    console.log('\n================================================================');
    console.log('🎉 ALL 6 E2E SCREENSHOT SCENARIOS COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('E2E Test Execution Error:', err);
  process.exit(1);
});
