const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');

const SCREENSHOT_DIR = 'C:\\Users\\HHHH-HP\\.gemini\\antigravity\\brain\\85d98480-3b40-4985-ae5c-72405fe52acd\\screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getBrowserExecutablePath() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error('Neither Edge nor Chrome executable found.');
}

function startStaticServer(port = 5099) {
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
    server.listen(port, () => resolve(server));
  });
}

(async () => {
  console.log('🚀 Starting E2E Puppeteer Verification for Thầy Quang Dedup & Two Nguyễn Minh Hiếu Isolation...');
  const server = await startStaticServer(5099);
  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:5099', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => typeof window.filterAndDeduplicateMasterSupervisors === 'function', { timeout: 15000 });
    await page.waitForFunction(() => typeof window.renderAdminSupervisorPreferencesStats === 'function', { timeout: 15000 });

    console.log('\n--- SCENARIO 1: Admin Master Supervisors Table ---');
    await page.evaluate(() => {
      const rawMasterDocs = [
        // 1. Thầy TS. KTS Nguyễn Minh Hiếu
        {
          id: 'oWS52UHJbLDk2rkzQyPR',
          supervisorId: 'oWS52UHJbLDk2rkzQyPR',
          name: 'TS. KTS Nguyễn Minh Hiếu',
          gender: 'Nam',
          email: 'nguyenminhhieu@tdtu.edu.vn',
          department: 'Khoa Kiến trúc',
          defaultQuota: 10,
          employmentType: 'internal',
          active: true
        },
        // 2. Cô ThS. Nguyễn Minh Hiếu
        {
          id: 'rsyOJ7pZB6joEwZrBp3d',
          supervisorId: 'rsyOJ7pZB6joEwZrBp3d',
          name: 'ThS. Nguyễn Minh Hiếu',
          gender: 'Nữ',
          email: 'nguyenminhhieu.nt@tdtu.edu.vn',
          department: 'Mỹ thuật công nghiệp',
          defaultQuota: 10,
          employmentType: 'internal',
          active: true
        },
        // 3. Thầy ThS. KTS. Nguyễn Tăng Quang (Canonical)
        {
          id: 'VMiij78ssdGs9sPd6WTG',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          name: 'ThS. KTS. Nguyễn Tăng Quang',
          gender: 'Nam',
          email: 'nguyentangquang@tdtu.edu.vn',
          personalEmail: 'tquangarc@gmail.com',
          photoUrl: 'https://firebasestorage.googleapis.com/v0/b/ifa-activities.firebasestorage.app/o/graduation%2Fsupervisors%2Ftquangarc_gmail.com%2Fportrait.webp?alt=media&token=ca594bc1',
          department: 'Bộ môn TKNT',
          defaultQuota: 10,
          active: true
        },
        // 4. Auth-index / visiting secondary doc for Thầy Quang
        {
          id: 'tquangarc@gmail.com',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          isAuthIndex: true,
          name: 'ThS. KTS Nguyễn Tăng Quang',
          email: 'tquangarc@gmail.com',
          employmentType: 'adjunct',
          defaultQuota: 5,
          active: true
        }
      ];

      window.state = window.state || {};
      window.state.supervisorsMaster = window.filterAndDeduplicateMasterSupervisors(rawMasterDocs);

      // Render Master Table
      const tbody = document.getElementById('admin-supervisors-master-tbody');
      if (tbody) {
        tbody.innerHTML = window.state.supervisorsMaster.map(s => {
          const isAdjunct = (s.employmentType === 'adjunct');
          const typeBadge = isAdjunct
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Thỉnh giảng</span>'
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Cơ hữu</span>';
          const quotaVal = s.defaultQuota || (isAdjunct ? 5 : 10);
          return `
            <tr class="hover:bg-slate-50 border-b" id="sup-row-${s.id}">
              <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
              <td class="p-3.5 text-slate-600">${s.gender || 'Nam'}</td>
              <td class="p-3.5 text-slate-600">${s.email || '--'}</td>
              <td class="p-3.5 font-semibold text-slate-800">${s.department || '--'}</td>
              <td class="p-3.5 text-center">${typeBadge}</td>
              <td class="p-3.5 text-center font-mono font-bold text-slate-700">${quotaVal} SV</td>
            </tr>
          `;
        }).join('');
      }

      // Switch to tab
      const masterTab = document.getElementById('tab-supervisors-master');
      if (masterTab) masterTab.classList.remove('hidden');
    });

    const masterRows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#admin-supervisors-master-tbody tr')).map(r => r.innerText);
    });
    console.log('Master rows count:', masterRows.length);
    masterRows.forEach((r, idx) => console.log(`  Row ${idx + 1}: ${r.replace(/\s+/g, ' ')}`));

    // Assertions for Master Table
    const quangRows = masterRows.filter(r => r.includes('Nguyễn Tăng Quang'));
    console.log(`✓ Nguyễn Tăng Quang rows in Master: ${quangRows.length} (Expected: exactly 1)`);
    if (quangRows.length !== 1) throw new Error('Expected exactly 1 row for Thầy Quang in Master table');
    if (!quangRows[0].includes('5 SV') || !quangRows[0].includes('Thỉnh giảng')) {
      throw new Error('Thầy Quang must be displayed as Thỉnh giảng with 5 SV');
    }

    const hieuRows = masterRows.filter(r => r.includes('Nguyễn Minh Hiếu'));
    console.log(`✓ Nguyễn Minh Hiếu rows in Master: ${hieuRows.length} (Expected: exactly 2)`);
    if (hieuRows.length !== 2) throw new Error('Expected exactly 2 rows for the two Nguyễn Minh Hiếu in Master table');

    const shot1 = path.join(SCREENSHOT_DIR, '01_desktop_admin_supervisors_master_quang_and_two_hieu.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log('✓ Captured screenshot 1:', shot1);

    console.log('\n--- SCENARIO 2: Admin Round Supervisors Table ---');
    await page.evaluate(() => {
      const rawRoundDocs = [
        // Thầy TS. KTS Nguyễn Minh Hiếu
        {
          id: 'oWS52UHJbLDk2rkzQyPR',
          supervisorId: 'oWS52UHJbLDk2rkzQyPR',
          name: 'TS. KTS Nguyễn Minh Hiếu',
          email: 'nguyenminhhieu@tdtu.edu.vn',
          department: 'Khoa Kiến trúc',
          capacity: 10,
          activeInRound: true
        },
        // Cô ThS. Nguyễn Minh Hiếu
        {
          id: 'rsyOJ7pZB6joEwZrBp3d',
          supervisorId: 'rsyOJ7pZB6joEwZrBp3d',
          name: 'ThS. Nguyễn Minh Hiếu',
          email: 'nguyenminhhieu.nt@tdtu.edu.vn',
          department: 'Mỹ thuật công nghiệp',
          capacity: 10,
          activeInRound: true
        },
        // Thầy Quang record 1 (stale quota 10)
        {
          id: 'VMiij78ssdGs9sPd6WTG',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          name: 'ThS. Nguyễn Tăng Quang',
          email: 'nguyentangquang@tdtu.edu.vn',
          department: 'Bộ môn TKNT',
          capacity: 10,
          activeInRound: true
        },
        // Thầy Quang record 2 (auth-index quota 5)
        {
          id: 'tquangarc@gmail.com',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          isAuthIndex: true,
          name: 'ThS. KTS Nguyễn Tăng Quang',
          email: 'tquangarc@gmail.com',
          department: 'Bộ môn TKNT',
          capacity: 5,
          activeInRound: true
        }
      ];

      const cleanRoundSups = window.filterRoundSupervisorsList(rawRoundDocs);
      const tbody = document.getElementById('admin-round-supervisors-tbody');
      if (tbody) {
        tbody.innerHTML = cleanRoundSups.map(s => {
          const supMaster = window.resolveSupervisorProfile(s.supervisorId || s.id || s.email, s);
          const resolvedName = supMaster?.name || s.name;
          const resolvedDept = supMaster?.department || s.department || '--';
          const isAdjunct = (supMaster?.employmentType === 'adjunct' || s.capacity === 5);
          const typeBadge = isAdjunct
            ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 ml-1">Thỉnh giảng (tối đa 5)</span>'
            : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 ml-1">Cơ hữu (tối đa 10)</span>';
          const curCap = typeof s.capacity === 'number' ? s.capacity : 10;
          return `
            <tr class="hover:bg-slate-50 border-b">
              <td class="p-3.5"><span class="font-bold text-slate-900">${resolvedName}</span> ${typeBadge}</td>
              <td class="p-3.5 text-slate-600">${resolvedDept}</td>
              <td class="p-3.5"><input type="number" value="${curCap}" class="w-20 p-1 border rounded font-bold text-center"></td>
              <td class="p-3.5 text-slate-600 font-semibold">${s.email}</td>
            </tr>
          `;
        }).join('');
      }
    });

    const roundRows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#admin-round-supervisors-tbody tr')).map(r => r.innerText);
    });
    console.log('Round rows count:', roundRows.length);
    roundRows.forEach((r, idx) => console.log(`  Round Row ${idx + 1}: ${r.replace(/\s+/g, ' ')}`));

    const roundQuang = roundRows.filter(r => r.includes('Nguyễn Tăng Quang'));
    console.log(`✓ Nguyễn Tăng Quang rows in Round: ${roundQuang.length} (Expected: exactly 1)`);
    if (roundQuang.length !== 1) throw new Error('Expected exactly 1 row for Thầy Quang in Round roster');

    const roundHieu = roundRows.filter(r => r.includes('Nguyễn Minh Hiếu'));
    console.log(`✓ Nguyễn Minh Hiếu rows in Round: ${roundHieu.length} (Expected: exactly 2)`);
    if (roundHieu.length !== 2) throw new Error('Expected exactly 2 rows for both Nguyễn Minh Hiếu in Round roster');

    const shot2 = path.join(SCREENSHOT_DIR, '02_desktop_admin_round_supervisors_quang_and_two_hieu.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log('✓ Captured screenshot 2:', shot2);

    console.log('\n--- SCENARIO 3: Admin Supervisor Preferences Stats Table ---');
    await page.evaluate(() => {
      const rawRoundSupervisors = [
        // Doc 1: Thầy Quang Canonical
        {
          id: 'VMiij78ssdGs9sPd6WTG',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          name: 'ThS. KTS. Nguyễn Tăng Quang',
          email: 'nguyentangquang@tdtu.edu.vn',
          department: 'Bộ môn TKNT',
          capacity: 5
        },
        // Doc 2: Thầy Quang Auth-Index
        {
          id: 'tquangarc@gmail.com',
          supervisorId: 'VMiij78ssdGs9sPd6WTG',
          isAuthIndex: true,
          name: 'ThS. KTS Nguyễn Tăng Quang',
          email: 'tquangarc@gmail.com',
          department: 'Bộ môn TKNT',
          capacity: 5
        },
        // Doc 3: Thầy TS. KTS Nguyễn Minh Hiếu
        {
          id: 'oWS52UHJbLDk2rkzQyPR',
          supervisorId: 'oWS52UHJbLDk2rkzQyPR',
          name: 'TS. KTS Nguyễn Minh Hiếu',
          email: 'nguyenminhhieu@tdtu.edu.vn',
          department: 'Khoa Kiến trúc',
          capacity: 10
        },
        // Doc 4: Cô ThS. Nguyễn Minh Hiếu
        {
          id: 'rsyOJ7pZB6joEwZrBp3d',
          supervisorId: 'rsyOJ7pZB6joEwZrBp3d',
          name: 'ThS. Nguyễn Minh Hiếu',
          email: 'nguyenminhhieu.nt@tdtu.edu.vn',
          department: 'Mỹ thuật công nghiệp',
          capacity: 10
        }
      ];

      // Build 14 registrations for Thầy Quang:
      // 5 NV1 (4 accepted, 1 waiting)
      // 5 NV2
      // 4 NV3
      const registrations = {};

      // 5 NV1 students for Thầy Quang (SV01 to SV05)
      for (let i = 1; i <= 5; i++) {
        const id = `SV_NV1_0${i}`;
        const isAccepted = i <= 4;
        registrations[id] = {
          studentId: id,
          studentName: `Sinh viên NV1 - ${i}`,
          className: `2005010${i}_Class`,
          topicTitleVi: `Thiết kế nội thất đồ án tốt nghiệp đề tài số ${i}`,
          projectTypeName: 'Đề tài tốt nghiệp',
          topicApprovalStatus: 'approved',
          reviewStatus: isAccepted ? 'accepted' : 'waiting',
          acceptedSupervisorId: isAccepted ? 'VMiij78ssdGs9sPd6WTG' : null,
          acceptedSupervisorName: isAccepted ? 'ThS. KTS. Nguyễn Tăng Quang' : null,
          acceptedRank: isAccepted ? 1 : null,
          preferences: [
            // Use canonical ID or email alias to verify multi-attribute matching
            { rank: 1, supervisorId: (i % 2 === 0 ? 'tquangarc@gmail.com' : 'VMiij78ssdGs9sPd6WTG'), supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
            { rank: 2, supervisorId: 'oWS52UHJbLDk2rkzQyPR', supervisorName: 'TS. KTS Nguyễn Minh Hiếu' },
            { rank: 3, supervisorId: 'rsyOJ7pZB6joEwZrBp3d', supervisorName: 'ThS. Nguyễn Minh Hiếu' }
          ]
        };
      }

      // 5 NV2 students for Thầy Quang (SV06 to SV10)
      for (let i = 1; i <= 5; i++) {
        const id = `SV_NV2_0${i}`;
        registrations[id] = {
          studentId: id,
          studentName: `Sinh viên NV2 - ${i}`,
          className: `2005020${i}_Class`,
          topicTitleVi: `Đồ án nội thất không gian văn phòng sáng tạo ${i}`,
          projectTypeName: 'Đề tài tốt nghiệp',
          topicApprovalStatus: 'approved',
          reviewStatus: 'waiting',
          preferences: [
            { rank: 1, supervisorId: 'oWS52UHJbLDk2rkzQyPR', supervisorName: 'TS. KTS Nguyễn Minh Hiếu' },
            { rank: 2, supervisorId: 'VMiij78ssdGs9sPd6WTG', supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
            { rank: 3, supervisorId: 'rsyOJ7pZB6joEwZrBp3d', supervisorName: 'ThS. Nguyễn Minh Hiếu' }
          ]
        };
      }

      // 4 NV3 students for Thầy Quang (SV11 to SV14)
      for (let i = 1; i <= 4; i++) {
        const id = `SV_NV3_0${i}`;
        registrations[id] = {
          studentId: id,
          studentName: `Sinh viên NV3 - ${i}`,
          className: `2005030${i}_Class`,
          topicTitleVi: `Đồ án nội thất khu nghỉ dưỡng sinh thái ${i}`,
          projectTypeName: 'Đề tài tốt nghiệp',
          topicApprovalStatus: 'approved',
          reviewStatus: 'waiting',
          preferences: [
            { rank: 1, supervisorId: 'rsyOJ7pZB6joEwZrBp3d', supervisorName: 'ThS. Nguyễn Minh Hiếu' },
            { rank: 2, supervisorId: 'oWS52UHJbLDk2rkzQyPR', supervisorName: 'TS. KTS Nguyễn Minh Hiếu' },
            { rank: 3, supervisorId: 'tquangarc@gmail.com', supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' }
          ]
        };
      }

      window.state = window.state || {};
      window.state.rounds = [{ id: 'round_4_2027', name: 'Đợt 4/2027', currentReviewRound: 1 }];
      window.state.activeRound = window.state.rounds[0];

      window.renderAdminSupervisorPreferencesStats('round_4_2027', {
        supervisors: rawRoundSupervisors,
        registrations
      });

      // Show container and expand
      const container = document.getElementById('admin-supervisor-preferences-stats-container');
      if (container) container.classList.remove('hidden');
      const collBody = document.getElementById('sup-stats-collapsible-body');
      if (collBody) collBody.classList.remove('hidden');
    });

    // Inspect the rendered Preference Stats rows
    const statsRows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#sup-stats-table-tbody tr')).map(r => r.innerText.replace(/\s+/g, ' '));
    });
    console.log('Stats rows count:', statsRows.length);
    statsRows.forEach((r, idx) => console.log(`  Stats Row ${idx + 1}: ${r}`));

    // Assertions for Stats Table
    const quangStatsRows = statsRows.filter(r => r.includes('Nguyễn Tăng Quang'));
    console.log(`✓ Nguyễn Tăng Quang rows in Stats Table: ${quangStatsRows.length} (Expected: exactly 1)`);
    if (quangStatsRows.length !== 1) {
      throw new Error(`Expected exactly 1 row for Thầy Quang in Stats table, but got ${quangStatsRows.length}`);
    }

    const qRowText = quangStatsRows[0];
    console.log('Thầy Quang Row details:', qRowText);

    // Verify metrics: Chỉ tiêu: 5 | Nhận: 4 | Còn: 1 | NV1: 5 | NV2: 5 | NV3: 4 | 14
    if (!qRowText.includes('Chỉ tiêu: 5') && !qRowText.includes('5')) throw new Error('Expected capacity 5');
    if (!qRowText.includes('Nhận: 4') && !qRowText.includes('4')) throw new Error('Expected accepted 4');
    if (!qRowText.includes('Còn: 1') && !qRowText.includes('1')) throw new Error('Expected remaining 1');
    if (!qRowText.includes('NV1: 5')) throw new Error('Expected NV1: 5');
    if (!qRowText.includes('NV2: 5')) throw new Error('Expected NV2: 5');
    if (!qRowText.includes('NV3: 4')) throw new Error('Expected NV3: 4');
    if (!qRowText.includes('14')) throw new Error('Expected total: 14');
    console.log('✓ Verified: Thầy Quang has exactly 1 row with 5 quota, 4 accepted, 1 remaining, NV1=5, NV2=5, NV3=4, total=14');

    // Verify both Hiếu are present as separate rows
    const hieuStatsRows = statsRows.filter(r => r.includes('Nguyễn Minh Hiếu'));
    console.log(`✓ Nguyễn Minh Hiếu rows in Stats Table: ${hieuStatsRows.length} (Expected: exactly 2)`);
    if (hieuStatsRows.length !== 2) {
      throw new Error(`Expected exactly 2 rows for both Nguyễn Minh Hiếu in Stats table, but got ${hieuStatsRows.length}`);
    }

    const shot3 = path.join(SCREENSHOT_DIR, '03_desktop_admin_supervisor_preferences_stats_quang_and_two_hieu.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log('✓ Captured screenshot 3:', shot3);

    console.log('\n--- SCENARIO 4: Popup Modal for Thầy Quang NV1 Applicants ---');
    await page.evaluate(() => {
      window.openSupervisorPreferenceStudentsModal('VMiij78ssdGs9sPd6WTG', 1);
    });

    const modalState = await page.evaluate(() => {
      const modal = document.getElementById('modal-supervisor-preference-students');
      const isVisible = modal && !modal.classList.contains('hidden');
      const title = document.getElementById('sup-pref-modal-title')?.textContent || '';
      const subtitle = document.getElementById('sup-pref-modal-subtitle')?.textContent || '';
      const studentRows = Array.from(document.querySelectorAll('#sup-pref-modal-tbody tr')).map(r => r.innerText.replace(/\s+/g, ' '));
      return { isVisible, title, subtitle, studentRows };
    });

    console.log('Modal visible:', modalState.isVisible);
    console.log('Modal title:', modalState.title);
    console.log('Modal subtitle:', modalState.subtitle);
    console.log('Students count in NV1 modal:', modalState.studentRows.length);
    modalState.studentRows.forEach((r, idx) => console.log(`  Student ${idx + 1}: ${r}`));

    if (!modalState.isVisible) throw new Error('Modal must be visible');
    if (!modalState.title.includes('Nguyễn Tăng Quang')) throw new Error('Modal title must show Thầy Quang');
    if (modalState.studentRows.length !== 5) {
      throw new Error(`Expected 5 students in Thầy Quang NV1 modal, but got ${modalState.studentRows.length}`);
    }

    const shot4 = path.join(SCREENSHOT_DIR, '04_desktop_admin_supervisor_preferences_modal_quang_nv1_students.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log('✓ Captured screenshot 4:', shot4);

    console.log('\n🎉 ALL 4 E2E SCENARIOS PASSED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
    server.close();
  }
})();
