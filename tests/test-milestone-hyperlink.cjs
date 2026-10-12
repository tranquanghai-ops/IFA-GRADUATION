const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Setup minimal browser globals for Node test environment
if (typeof global.window === 'undefined') {
  global.window = global;
}
if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute: () => {}, querySelector: () => null, innerHTML: '', appendChild: () => {} }),
    body: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

test('Milestone Hyperlink Engine & Data Flow Suite', async (t) => {

  const activitiesManagerSource = read('js/planning/activities-manager.js');
  const modalActivityTemplate = read('templates/modals/rounds/modal-activity.html');
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const timelineRoadmapSource = read('js/planning/timeline-roadmap.js');
  const roundsTimelinePreviewSource = read('js/rounds/rounds-timeline-preview.js');
  const driveUploadPanelSource = read('js/drive/drive-upload-panel.js');

  // --- Dynamic evaluation of normalizeRichLinkUrl and sanitizeRichHtml ---
  // Import from activities-manager.js
  const activitiesManagerModule = await import('../js/planning/activities-manager.js');
  const { normalizeRichLinkUrl, sanitizeRichHtml } = activitiesManagerModule;

  await t.test('1. URL handling and security validation', () => {
    // Valid https and http URLs
    const r1 = normalizeRichLinkUrl('https://tranquanghai-ops.github.io/PDF-Optimizer-Resizer-Studio/');
    assert.equal(r1.valid, true);
    assert.equal(r1.url, 'https://tranquanghai-ops.github.io/PDF-Optimizer-Resizer-Studio/');

    const r2 = normalizeRichLinkUrl('http://example.com/guide');
    assert.equal(r2.valid, true);
    assert.equal(r2.url, 'http://example.com/guide');

    // Auto-prepend https:// for www...
    const r3 = normalizeRichLinkUrl('www.google.com');
    assert.equal(r3.valid, true);
    assert.equal(r3.url, 'https://www.google.com/');

    // Auto-prepend https:// for domain without scheme
    const r4 = normalizeRichLinkUrl('tdtu.edu.vn/thong-bao');
    assert.equal(r4.valid, true);
    assert.equal(r4.url, 'https://tdtu.edu.vn/thong-bao');

    // Auto-correct typo prefixes
    const rTypo1 = normalizeRichLinkUrl('s://tranquanghai-ops.github.io/PDF-Optimizer-Resizer-Studio/');
    assert.equal(rTypo1.valid, true);
    assert.equal(rTypo1.url, 'https://tranquanghai-ops.github.io/PDF-Optimizer-Resizer-Studio/');

    const rTypo2 = normalizeRichLinkUrl('ttps://example.com');
    assert.equal(rTypo2.valid, true);
    assert.equal(rTypo2.url, 'https://example.com/');

    // Reject dangerous URLs (XSS prevention)
    const r5 = normalizeRichLinkUrl('javascript:alert(1)');
    assert.equal(r5.valid, false);
    assert.match(r5.error, /không an toàn/i);

    const r6 = normalizeRichLinkUrl('data:text/html,<script>alert(1)</script>');
    assert.equal(r6.valid, false);

    const r7 = normalizeRichLinkUrl('vbscript:msgbox(1)');
    assert.equal(r7.valid, false);

    const r8 = normalizeRichLinkUrl('file:///C:/Windows/win.ini');
    assert.equal(r8.valid, false);

    // Empty or whitespace URL
    const r9 = normalizeRichLinkUrl('');
    assert.equal(r9.valid, false);
    const r10 = normalizeRichLinkUrl('   ');
    assert.equal(r10.valid, false);
  });

  await t.test('2. HTML sanitization preserves safe hyperlinks with target="_blank" and rel="noopener noreferrer"', () => {
    const rawHtml = '<p>Sinh viên có thể tối ưu file tại <a href="https://tranquanghai-ops.github.io/PDF-Optimizer-Resizer-Studio/">tại đây</a> nhé.</p>';
    const cleaned = sanitizeRichHtml(rawHtml);

    assert.match(cleaned, /<a\s+[^>]*href="https:\/\/tranquanghai-ops\.github\.io\/PDF-Optimizer-Resizer-Studio\/"[^>]*>/);
    assert.match(cleaned, /target="_blank"/);
    assert.match(cleaned, /rel="noopener noreferrer"/);
    assert.match(cleaned, /tại đây<\/a>/);
  });

  await t.test('3. HTML sanitization strips dangerous links and unwraps without losing text', () => {
    const dangerousHtml = '<p>Bấm <a href="javascript:alert(\'hack\')">vào đây</a> để nhận quà.</p>';
    const cleaned = sanitizeRichHtml(dangerousHtml);

    assert.doesNotMatch(cleaned, /javascript:/i);
    assert.doesNotMatch(cleaned, /<a[^>]*href="javascript/i);
    // Preserves text
    assert.match(cleaned, /vào đây/);
  });

  await t.test('4. Hyperlinks inside rich formatting (bold, italic, colors, lists) are preserved', () => {
    const richContent = `
      <ul>
        <li><strong>Bước 1:</strong> Truy cập <a href="https://tdtu.edu.vn">Cổng thông tin</a></li>
        <li><span style="color: #2563eb">Lưu ý:</span> Tham khảo <a href="https://drive.google.com/test"><strong>Tài liệu mẫu</strong></a> quan trọng.</li>
      </ul>
    `;
    const cleaned = sanitizeRichHtml(richContent);

    assert.match(cleaned, /<ul>[\s\S]*<\/ul>/);
    assert.match(cleaned, /<li><strong>Bước 1:<\/strong>/);
    assert.match(cleaned, /<a\s+[^>]*href="https:\/\/tdtu\.edu\.vn"[^>]*>Cổng thông tin<\/a>/);
    assert.match(cleaned, /<a\s+[^>]*href="https:\/\/drive\.google\.com\/test"[^>]*><strong>Tài liệu mẫu<\/strong><\/a>/);
  });

  await t.test('5. Multiple hyperlinks in same content block', () => {
    const multiHtml = `
      <p>Xem <a href="https://site1.com">Liên kết 1</a> và <a href="https://site2.org">Liên kết 2</a> cùng lúc.</p>
    `;
    const cleaned = sanitizeRichHtml(multiHtml);

    assert.match(cleaned, /href="https:\/\/site1\.com"/);
    assert.match(cleaned, /href="https:\/\/site2\.org"/);
    assert.match(cleaned, /Liên kết 1<\/a>/);
    assert.match(cleaned, /Liên kết 2<\/a>/);
  });

  await t.test('6. Editor toolbar in modal-activity.html and index.html includes enhanced handlers', () => {
    // Both template and compiled index.html have the right onmousedown calls
    assert.match(modalActivityTemplate, /captureActivityEditorSelection\(\);\s*insertRichLink\(\)/);
    assert.match(modalActivityTemplate, /unlinkRichLink\(\)/);
    assert.match(indexHtml, /captureActivityEditorSelection\(\);\s*insertRichLink\(\)/);
    assert.match(indexHtml, /unlinkRichLink\(\)/);
  });

  await t.test('7. Activities Manager exports all necessary link and selection methods', () => {
    assert.match(activitiesManagerSource, /export function normalizeRichLinkUrl/);
    assert.match(activitiesManagerSource, /export async function insertRichLink/);
    assert.match(activitiesManagerSource, /export function unlinkRichLink/);
    assert.match(activitiesManagerSource, /export function captureActivityEditorSelection/);
    assert.match(activitiesManagerSource, /export function restoreActivityEditorSelection/);
    assert.match(activitiesManagerSource, /export function initActivityEditorEvents/);
    assert.match(activitiesManagerSource, /window\.insertRichLink = insertRichLink/);
    assert.match(activitiesManagerSource, /window\.unlinkRichLink = unlinkRichLink/);
  });

  await t.test('8. CSS contains proper styling for hyperlinks inside rich editor and timeline cards', () => {
    assert.match(stylesCss, /\.rich-editor-content a\s*\{[\s\S]*color:\s*#2563eb/);
    assert.match(stylesCss, /\.rich-editor-content a\s*\{[\s\S]*text-decoration:\s*underline/);
    assert.match(stylesCss, /\.rich-rendered-content a\s*\{[\s\S]*color:\s*#2563eb/);
    assert.match(stylesCss, /\.rich-link-tooltip/);
  });

  await t.test('9. Student and supervisor timeline roadmaps render sanitized HTML hyperlinks correctly', () => {
    assert.match(timelineRoadmapSource, /sanitizeRichHtml\(act\.descriptionHtml\)/);
    assert.match(roundsTimelinePreviewSource, /sanitizeRichHtml\(activity\.descriptionHtml\)/);
  });

  await t.test('10. Data save & load integrity (activities-manager saveActivityForm)', () => {
    assert.match(activitiesManagerSource, /const descriptionHtml = sanitizeRichHtml\(rawHtml\);/);
    assert.match(activitiesManagerSource, /editor\.innerHTML = act\.descriptionHtml \|\| escapeHtml\(act\.description \|\| ''\);/);
  });

  await t.test('11. Font size preservation and legacy font size tag conversion in sanitizer', () => {
    assert.match(activitiesManagerSource, /window\.setRichFontSize\s*=/);
    assert.match(activitiesManagerSource, /allowedStyles\s*=\s*new Set\(\[\s*'text-align',\s*'color',\s*'background-color',\s*'font-size',\s*'font-weight',\s*'text-decoration'/);
    assert.match(activitiesManagerSource, /fontSizes\s*=\s*\{\s*'1':\s*'10px'/);
    assert.match(activitiesManagerSource, /replacement\.style\.fontSize\s*=\s*fontSizes\[sizeAttr\]/);
  });

  await t.test('12. Dropdown selectors and modal scoped styles guard against Chromium blur and unstyled links', () => {
    assert.match(modalActivityTemplate, /<select class="rich-select" onmousedown="captureActivityEditorSelection\(\)" onfocus="captureActivityEditorSelection\(\)" onchange="setRichFontSize/);
    assert.match(modalActivityTemplate, /<select class="rich-select" onmousedown="captureActivityEditorSelection\(\)" onfocus="captureActivityEditorSelection\(\)" onchange="richFormatHeading/);
    assert.match(modalActivityTemplate, /#activity-editor a,\s*#activity-editor a \*/);
    assert.match(indexHtml, /<select class="rich-select" onmousedown="captureActivityEditorSelection\(\)" onfocus="captureActivityEditorSelection\(\)" onchange="setRichFontSize/);
    assert.match(indexHtml, /#activity-editor a,\s*#activity-editor a \*/);
  });

  await t.test('13. Student milestone dialog features milestone countdown, top submit navigation button, and exclusive bold red deadline countdown', () => {
    // 1. Milestone dialog has countdown timer for event activity
    assert.match(roundsTimelinePreviewSource, /Đếm ngược mốc kế hoạch:/);
    assert.match(roundsTimelinePreviewSource, /data-student-countdown-at/);
    assert.match(roundsTimelinePreviewSource, /data-student-countdown-end-at/);

    // 2. Milestone dialog has top submit button when submission enabled, scrolling to submission slot
    assert.match(roundsTimelinePreviewSource, /onclick="scrollToStudentSubmissionSlot\(\)"/);
    assert.match(roundsTimelinePreviewSource, /<span>📥<\/span>\s*<span>Nộp bài<\/span>/);
    assert.match(roundsTimelinePreviewSource, /window\.scrollToStudentSubmissionSlot\s*=/);

    // 3. Submission panel displays ONLY submission deadline countdown, formatted with bold red text
    assert.match(driveUploadPanelSource, /Kết thúc nhận bài:/);
    assert.match(driveUploadPanelSource, /text-rose-600 font-black/);
    assert.doesNotMatch(driveUploadPanelSource, /Ngày duyệt:\s*<strong/);
  });

  await t.test('14. Admin edit view renders distinct blue underline/pill links in #activity-editor and opens link on direct click', () => {
    // 1. decorateActivityEditorAnchors is exported and decorates anchors with prominent styling
    assert.match(activitiesManagerSource, /export function decorateActivityEditorAnchors/);
    assert.match(activitiesManagerSource, /borderBottom\s*=\s*'2px solid #2563eb'/);
    assert.match(activitiesManagerSource, /backgroundColor\s*=\s*'rgba\(37, 99, 235, 0\.08\)'/);
    assert.match(activitiesManagerSource, /cursor\s*=\s*'pointer'/);
    assert.match(activitiesManagerSource, /decorateActivityEditorAnchors\(editor\)/);

    // 2. Direct click on anchor inside editor opens link in new tab just like student page
    assert.match(activitiesManagerSource, /window\.open\(href,\s*'_blank',\s*'noopener,noreferrer'\)/);

    // 3. Modal template, styles.css and index.html have high-visibility underline & pill styles
    assert.match(modalActivityTemplate, /border-bottom:\s*2px solid #2563eb !important/);
    assert.match(modalActivityTemplate, /background-color:\s*rgba\(37, 99, 235, 0\.08\) !important/);
    assert.match(stylesCss, /border-bottom:\s*2px solid #2563eb !important/);
    assert.match(stylesCss, /background-color:\s*rgba\(37, 99, 235, 0\.08\) !important/);
    assert.match(indexHtml, /border-bottom:\s*2px solid #2563eb !important/);

    // 4. Sanitizer bakes inline styles into output for persistent styling
    const sanitizedLink = sanitizeRichHtml('<p><a href="https://example.com">test link</a></p>');
    assert.match(sanitizedLink, /border-bottom:\s*2px solid #2563eb/);
    assert.match(sanitizedLink, /background-color:\s*rgba\(37, 99, 235, 0\.08\)/);
  });
});
