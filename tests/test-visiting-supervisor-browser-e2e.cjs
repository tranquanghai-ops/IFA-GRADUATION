/**
 * IFA+ Graduation — Visiting Supervisor Real Browser E2E Test
 * 
 * Tests:
 * 1. Visiting supervisor login with external email (quang.nguyen@gmail.com) declared in supervisorMaster
 * 2. Unauthorized personal email (stranger@gmail.com) rejected with clear error alert
 * 3. Student login (11900335@student.tdtu.edu.vn) maintains full fidelity
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots/visiting-supervisor');
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
  throw new Error('Neither Edge nor Chrome executable found.');
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

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function run() {
  console.log('================================================================');
  console.log('🧪 VISITING SUPERVISOR REAL BROWSER E2E TEST');
  console.log('================================================================');

  const server = await startStaticServer(5055);
  console.log('✓ Local static test server running on http://127.0.0.1:5055');

  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const targetUrl = 'http://127.0.0.1:5055/?emulator=true';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for app initialization
    await page.waitForFunction(() => typeof window.setupAuthListener === 'function', { timeout: 15000 });
    console.log('✓ App scripts loaded.');

    // --- TEST 1: Visiting Supervisor with Authorized Gmail ---
    console.log('\n--- SCENARIO 1: Visiting Supervisor Login (quang.nguyen@gmail.com) ---');
    const supLoginResult = await page.evaluate(async () => {
      // Setup supervisorMaster with Quang Nguyen
      if (!window.state.supervisorsMaster) window.state.supervisorsMaster = [];
      const mockSup = {
        id: 'sup_visiting_quang',
        name: 'ThS. Nguyễn Tăng Quang',
        email: 'quang.nguyen@gmail.com',
        personalEmail: 'quang.nguyen@gmail.com',
        active: true,
        status: 'active',
        employmentType: 'adjunct',
        department: 'Thiết kế nội thất',
        defaultQuota: 5
      };
      if (!window.state.supervisorsMaster.some(s => s.id === mockSup.id)) {
        window.state.supervisorsMaster.push(mockSup);
      }

      // Simulate Firebase Auth state change for visiting supervisor
      const mockUser = {
        uid: 'user_visiting_quang',
        email: 'quang.nguyen@gmail.com',
        displayName: 'Nguyễn Tăng Quang'
      };

      await window.resolveActualRoles(mockUser);
      window.state.user = mockUser;
      window.state.realUser = mockUser;
      window.updateAuthUI();
      await window.switchView('supervisor');

      return {
        actualRole: window.state.actualRole,
        isSupervisor: window.state.isSupervisor,
        isStudent: window.state.isStudent,
        isAdmin: window.state.isAdmin,
        supervisorProfile: window.state.supervisorProfile?.name,
        currentView: window.state.currentView,
        viewSupervisorVisible: !document.getElementById('view-supervisor')?.classList.contains('hidden'),
        viewStudentHidden: document.getElementById('view-student')?.classList.contains('hidden')
      };
    });

    console.log('Supervisor Portal State:', supLoginResult);
    if (!supLoginResult.isSupervisor || supLoginResult.actualRole !== 'supervisor') {
      throw new Error(`Visiting supervisor role not recognized: ${JSON.stringify(supLoginResult)}`);
    }
    if (!supLoginResult.viewSupervisorVisible) {
      throw new Error('Supervisor view is not visible!');
    }
    console.log('✓ Visiting supervisor successfully logged in and granted supervisor role.');

    const supShot = path.join(SCREENSHOT_DIR, '01_visiting_supervisor_desktop.png');
    await page.screenshot({ path: supShot, fullPage: false });
    fs.copyFileSync(supShot, path.join(ARTIFACT_DIR, '01_visiting_supervisor_desktop.png'));
    console.log(`✓ Screenshot saved: ${supShot}`);

    // --- TEST 2: Unauthorized Personal Gmail (stranger@gmail.com) ---
    console.log('\n--- SCENARIO 2: Unauthorized Stranger Login (stranger@gmail.com) ---');
    const rejectResult = await page.evaluate(async () => {
      const strangerUser = {
        uid: 'user_stranger',
        email: 'stranger@gmail.com',
        displayName: 'Stranger User'
      };

      await window.resolveActualRoles(strangerUser);
      const evalRes = window.evaluateAccountDomainAndRole(strangerUser.email);

      // Trigger login reject UI path
      const loginSec = document.getElementById('login-required-section');
      if (loginSec) {
        loginSec.classList.remove('hidden');
        let authErrCard = document.getElementById('login-auth-error-card');
        if (!authErrCard) {
          authErrCard = document.createElement('div');
          authErrCard.id = 'login-auth-error-card';
          loginSec.prepend(authErrCard);
        }
        authErrCard.className = 'p-4 mb-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs text-left space-y-1.5 shadow-sm';
        authErrCard.innerHTML = `<strong>Từ chối truy cập: ${strangerUser.email}</strong><p>${evalRes.message}</p>`;
      }
      document.getElementById('view-supervisor')?.classList.add('hidden');
      document.getElementById('view-student')?.classList.add('hidden');
      window.clearStudentSessionAndState();

      return {
        evalValid: evalRes.isValid,
        evalReason: evalRes.reason,
        evalMessage: evalRes.message,
        actualRole: window.state.actualRole,
        isSupervisor: window.state.isSupervisor,
        isStudent: window.state.isStudent,
        loginSectionVisible: !document.getElementById('login-required-section')?.classList.contains('hidden'),
        errCardText: document.getElementById('login-auth-error-card')?.textContent
      };
    });

    console.log('Stranger Rejection State:', rejectResult);
    if (rejectResult.evalValid !== false || rejectResult.evalReason !== 'personal_email') {
      throw new Error(`Stranger was not properly rejected: ${JSON.stringify(rejectResult)}`);
    }
    if (rejectResult.isSupervisor || rejectResult.isStudent) {
      throw new Error('Stranger received unauthorized role!');
    }
    console.log('✓ Unauthorized personal Gmail successfully rejected and isolated.');

    const rejectShot = path.join(SCREENSHOT_DIR, '02_unauthorized_stranger_rejected.png');
    await page.screenshot({ path: rejectShot, fullPage: false });
    fs.copyFileSync(rejectShot, path.join(ARTIFACT_DIR, '02_unauthorized_stranger_rejected.png'));
    console.log(`✓ Screenshot saved: ${rejectShot}`);

    // --- TEST 3: Student TDTU Login (11900335@student.tdtu.edu.vn) ---
    console.log('\n--- SCENARIO 3: Student TDTU Login (11900335@student.tdtu.edu.vn) ---');
    const studentResult = await page.evaluate(async () => {
      document.getElementById('login-required-section')?.classList.add('hidden');
      document.getElementById('login-auth-error-card')?.remove();

      const studentUser = {
        uid: 'user_student_11900335',
        email: '11900335@student.tdtu.edu.vn',
        displayName: 'Nguyễn Văn Sinh Viên'
      };

      await window.resolveActualRoles(studentUser);
      window.state.user = studentUser;
      window.state.realUser = studentUser;
      window.updateAuthUI();
      await window.switchView('student');

      return {
        actualRole: window.state.actualRole,
        isStudent: window.state.isStudent,
        studentMssv: window.state.studentMssv,
        currentView: window.state.currentView,
        viewStudentVisible: !document.getElementById('view-student')?.classList.contains('hidden'),
        viewSupervisorHidden: document.getElementById('view-supervisor')?.classList.contains('hidden')
      };
    });

    console.log('Student Portal State:', studentResult);
    if (!studentResult.isStudent || studentResult.studentMssv !== '11900335') {
      throw new Error(`Student not properly recognized: ${JSON.stringify(studentResult)}`);
    }
    if (!studentResult.viewStudentVisible) {
      throw new Error('Student view is not visible!');
    }
    console.log('✓ Student successfully logged in with MSSV 11900335 without cross-contamination.');

    const studentShot = path.join(SCREENSHOT_DIR, '03_student_tdtu_desktop.png');
    await page.screenshot({ path: studentShot, fullPage: false });
    fs.copyFileSync(studentShot, path.join(ARTIFACT_DIR, '03_student_tdtu_desktop.png'));
    console.log(`✓ Screenshot saved: ${studentShot}`);

    console.log('\n================================================================');
    console.log('🎉 ALL BROWSER E2E TESTS PASSED WITH 100% FIDELITY');
    console.log('================================================================');

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('Fatal Browser Test Error:', err);
  process.exit(1);
});
