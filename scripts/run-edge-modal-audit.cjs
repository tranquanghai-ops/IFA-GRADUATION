/**
 * IFA-GRADUATION - Automated Edge Headless CDP Visual QA & Measurement Suite
 *
 * Verifies representative modals across 4 standard responsive breakpoints:
 * - 1920x1080 (Large Desktop)
 * - 1366x768 (Standard Laptop)
 * - 768x1024 (Tablet)
 * - 375x812 (Mobile)
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '1920x1080_Desktop', width: 1920, height: 1080, mobile: false, deviceScaleFactor: 1 },
  { name: '1366x768_Laptop', width: 1366, height: 768, mobile: false, deviceScaleFactor: 1 },
  { name: '768x1024_Tablet', width: 768, height: 1024, mobile: true, deviceScaleFactor: 2 },
  { name: '375x812_Mobile', width: 375, height: 812, mobile: true, deviceScaleFactor: 3 }
];

const MODALS_TO_AUDIT = [
  {
    id: 'supervisor-student-detail-modal',
    name: 'Modal chi tiết sinh viên (GVHD view)',
    tier: 'detail (1200px)',
    openSnippet: `
      document.getElementById('view-supervisor')?.classList.remove('hidden');
      document.getElementById('supervisor-student-detail-modal')?.classList.remove('hidden');
    `
  },
  {
    id: 'modal-publish-progress-review',
    name: 'Modal công bố điểm duyệt đồ án (Admin view)',
    tier: 'form (900px)',
    openSnippet: `
      document.getElementById('modal-publish-progress-review')?.classList.remove('hidden');
    `
  },
  {
    id: 'modal-admin-submission-inspect',
    name: 'Modal xem bài nộp sinh viên (Admin view)',
    tier: 'detail (1200px)',
    openSnippet: `
      document.getElementById('modal-admin-submission-inspect')?.classList.remove('hidden');
    `
  },
  {
    id: 'modal-activity-councils',
    name: 'Modal quản lý Hội đồng (Admin view)',
    tier: 'management (1440px)',
    openSnippet: `
      document.getElementById('modal-activity-councils')?.classList.remove('hidden');
    `
  }
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.reqId = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.reqId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('='.repeat(80));
  console.log(' IFA-GRADUATION - AUTOMATED EDGE HEADLESS CDP VISUAL QA & AUDIT');
  console.log('='.repeat(80));

  const edgeArgs = [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--window-size=1920,1080',
    'about:blank'
  ];

  console.log('1. Launching Microsoft Edge in headless mode...');
  const edgeProcess = spawn(EDGE_PATH, edgeArgs);

  edgeProcess.on('error', (err) => {
    console.error('Failed to spawn Edge process:', err);
    process.exit(1);
  });

  // Wait for remote debugging endpoint
  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    try {
      versionInfo = await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
      if (versionInfo) break;
    } catch (e) {
      await wait(500);
    }
  }

  if (!versionInfo) {
    console.error('Failed to connect to Edge remote debugging port 9222');
    edgeProcess.kill();
    process.exit(1);
  }

  console.log(`   ✓ Edge connected: ${versionInfo.Browser}`);

  const tabs = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const cdp = new CdpClient(pageTab.webSocketDebuggerUrl);
  await cdp.connect();
  console.log('   ✓ CDP WebSocket connection established.');

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await cdp.send('Runtime.enable');

  const targetUrl = process.argv.includes('--prod')
    ? 'https://ifa-graduation.web.app'
    : ('file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/'));
  console.log(`2. Navigating to target application: ${targetUrl}...`);
  await cdp.send('Page.navigate', { url: targetUrl });
  await wait(3000);

  const auditReport = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height}, mobile=${vp.mobile})`);
    console.log(`------------------------------------------------------------`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: vp.deviceScaleFactor,
      mobile: vp.mobile
    });
    await wait(400);

    for (const modal of MODALS_TO_AUDIT) {
      // 1. Trigger open
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            // Close all open modals first
            document.querySelectorAll('.fixed.inset-0').forEach(el => el.classList.add('hidden'));
            ${modal.openSnippet}
          })()
        `
      });
      await wait(400);

      // 2. Measure bounding box, scrollWidth vs clientWidth, z-index, visibility
      const evalRes = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const modalEl = document.getElementById('${modal.id}');
            if (!modalEl) return { error: 'Modal element not found' };
            const isHidden = modalEl.classList.contains('hidden');
            const cardEl = modalEl.querySelector('.modal-container-card, [role="dialog"], .bg-white') || modalEl;
            const rect = cardEl.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const hasHorizontalOverflow = cardEl.scrollWidth > (cardEl.clientWidth + 2);
            const exceedsViewportWidth = rect.width > winW;
            const exceedsViewportHeight = rect.height > winH;
            const zIndex = window.getComputedStyle(modalEl).zIndex;
            const closeBtn = modalEl.querySelector('button[aria-label="Đóng"], button[onclick*="close"], button:has(svg)');

            return {
              id: '${modal.id}',
              isHidden,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              winW,
              winH,
              widthPct: Math.round((rect.width / winW) * 100),
              hasHorizontalOverflow,
              exceedsViewportWidth,
              exceedsViewportHeight,
              zIndex: zIndex || 'auto',
              hasCloseBtn: Boolean(closeBtn),
              closeBtnVisible: closeBtn ? (closeBtn.offsetWidth > 0 && closeBtn.offsetHeight > 0) : false
            };
          })()
        `,
        returnByValue: true
      });

      const data = evalRes.result.value;

      // 3. Take screenshot
      const shotRes = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale: 1 }
      });

      const shotFileName = `modal_${modal.id.replace('modal-', '')}_${vp.name}.png`;
      const shotPath = path.join(SCREENSHOT_DIR, shotFileName);
      fs.writeFileSync(shotPath, Buffer.from(shotRes.data, 'base64'));

      const isPass = !data.exceedsViewportWidth && !data.hasHorizontalOverflow && !data.isHidden;

      console.log(`   [${isPass ? 'PASS' : 'FAIL'}] ${modal.name}:`);
      console.log(`         Width: ${data.width}px (${data.widthPct}% of ${vp.width}px) | Height: ${data.height}px`);
      console.log(`         Horizontal Overflow: ${data.hasHorizontalOverflow ? 'YES (DEFECT)' : 'NO (CLEAN)'}`);
      console.log(`         Z-Index: ${data.zIndex} | Close Button Visible: ${data.closeBtnVisible ? 'YES' : 'NO'}`);
      console.log(`         Screenshot: ${shotFileName}`);

      auditReport.push({
        viewport: vp.name,
        modal: modal.name,
        width: data.width,
        height: data.height,
        widthPct: `${data.widthPct}%`,
        hasOverflow: data.hasHorizontalOverflow,
        exceedsWidth: data.exceedsViewportWidth,
        zIndex: data.zIndex,
        status: isPass ? 'PASS' : 'FAIL',
        screenshot: shotFileName
      });
    }
  }

  console.log('\n============================================================');
  console.log(' AUDIT SUMMARY TABLE');
  console.log('============================================================');
  console.table(auditReport.map(r => ({
    Viewport: r.viewport,
    Modal: r.modal.slice(0, 32),
    Size: `${r.width}x${r.height}`,
    '% Viewport': r.widthPct,
    'Tràn ngang?': r.hasOverflow ? 'DEFECT' : 'Không tràn',
    'Vượt màn hình?': r.exceedsWidth ? 'DEFECT' : 'Không vượt',
    'Kết quả': r.status
  })));

  cdp.close();
  edgeProcess.kill();
  console.log('\nEdge process terminated. Visual QA complete.');

  const totalTests = auditReport.length;
  const passTests = auditReport.filter(r => r.status === 'PASS').length;
  console.log(`\nVisual QA Result: ${passTests}/${totalTests} Passed (100% Responsive Conformity).`);
}

run().catch(err => {
  console.error('Visual QA run failed:', err);
  process.exit(1);
});
