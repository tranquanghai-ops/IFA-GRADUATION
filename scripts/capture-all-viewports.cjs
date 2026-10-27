const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlUrl = 'file:///C:/Code/IFA-GRADUATION/tests/visual-test.html';
const outDir = path.resolve(__dirname, '../tests/screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const viewports = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 }
];

async function captureViewport(vp) {
  const outFile = path.join(outDir, `supervisor-grid-${vp.name}.png`);
  if (fs.existsSync(outFile)) {
    fs.unlinkSync(outFile);
  }

  console.log(`[Capture] Starting ${vp.name} (${vp.width}x${vp.height})...`);
  const args = [
    '--headless=new',
    '--disable-gpu',
    `--window-size=${vp.width},${vp.height}`,
    `--screenshot=${outFile}`,
    htmlUrl
  ];

  const proc = spawn(EDGE_PATH, args);

  // Poll for file existence and size > 0
  const startTime = Date.now();
  let done = false;

  while (!done && Date.now() - startTime < 12000) {
    await new Promise(r => setTimeout(r, 400));
    if (fs.existsSync(outFile)) {
      const stats = fs.statSync(outFile);
      if (stats.size > 1000) {
        console.log(`✓ ${vp.name}: Captured ${(stats.size / 1024).toFixed(1)} KB`);
        done = true;
        break;
      }
    }
  }

  try {
    proc.kill('SIGKILL');
  } catch (e) {}

  if (!done) {
    console.error(`✗ Timeout capturing ${vp.name}`);
  }
}

async function run() {
  for (const vp of viewports) {
    await captureViewport(vp);
  }
  console.log('[Capture] All 4 viewports completed.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
