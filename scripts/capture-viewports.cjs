const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
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

console.log('Target URL:', url);
for (const v of viewports) {
  const outPath = path.join(outDir, `viewport-${v.name}.png`);
  console.log(`Capturing ${v.name} (${v.width}x${v.height})...`);
  const cmd = `"${edge}" --headless=new --no-sandbox --disable-gpu --virtual-time-budget=5000 --window-size=${v.width},${v.height} --screenshot="${outPath}" "${url}"`;
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });
    const stat = fs.statSync(outPath);
    console.log(`✓ Saved ${v.name}: ${stat.size} bytes`);
  } catch (err) {
    console.error(`✕ Error on ${v.name}:`, err.message);
  }
}

console.log('All viewports captured successfully!');
