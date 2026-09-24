const fs = require('fs');

let s = fs.readFileSync('js/rounds/rounds-dashboard.js', 'utf8');

const targetOld = `  // Đưa tên đề tài SV đăng ký lên hero banner khi sinh viên đã đăng ký tên đề tài
  const topicWrap = document.getElementById('hero-registered-topic-wrap');
  const topicNameEl = document.getElementById('hero-registered-topic-name');
  const topicMetaEl = document.getElementById('hero-registered-topic-meta');
  const topicDownloadBtn = document.getElementById('hero-download-topic-form-btn');
  const reg = state.myRegistration;
  const registeredTopic = reg?.topicTitle || reg?.topic || reg?.proposalTitle || reg?.title || reg?.topicName;

  if (topicWrap) {
    if (registeredTopic) {
      topicWrap.classList.remove('hidden');
      if (topicNameEl) topicNameEl.textContent = registeredTopic;
      if (topicMetaEl) {
        const submittedAt = fmtDate(reg?.submittedAt);
        const timeStr = submittedAt ? \`🕒 Đã đăng ký: \${submittedAt}\` : '';
        const versionStr = reg?.topicTitleVersion ? \`📝 Lần \${reg.topicTitleVersion}\` : '';
        const approvalText = reg?.topicApprovalStatus === 'approved' ? '✓ GVHD đã duyệt' : reg?.topicApprovalStatus === 'rejected' ? '✕ GVHD yêu cầu chỉnh sửa' : '⌛ Chờ GVHD duyệt';
        topicMetaEl.innerHTML = [versionStr, approvalText, timeStr].filter(Boolean).map(s => \`<span>\${escapeHtml(s)}</span>\`).join('<span class="text-white/30">•</span>');
      }
      if (topicDownloadBtn) topicDownloadBtn.classList.toggle('hidden', reg?.topicApprovalStatus !== 'approved');
    } else {
      topicWrap.classList.add('hidden');
      if (topicDownloadBtn) topicDownloadBtn.classList.add('hidden');
    }
  }`;

const targetNew = `  // Đưa tên đề tài SV đăng ký lên hero banner khi sinh viên đã đăng ký tên đề tài
  const topicWrap = document.getElementById('hero-registered-topic-wrap');
  const topicNameEl = document.getElementById('hero-registered-topic-name');
  const topicMetaEl = document.getElementById('hero-registered-topic-meta');
  const topicApprovalBadge = document.getElementById('hero-topic-approval-badge');
  const topicVersionBadge = document.getElementById('hero-topic-version-badge');
  const topicReviewNoteEl = document.getElementById('hero-registered-topic-review-note');
  const topicDownloadBtn = document.getElementById('hero-download-topic-form-btn');
  const reg = state.myRegistration;
  const registeredTopic = reg?.topicTitle || reg?.topic || reg?.proposalTitle || reg?.title || reg?.topicName;

  if (topicWrap) {
    if (registeredTopic) {
      topicWrap.classList.remove('hidden');
      if (topicNameEl) topicNameEl.textContent = registeredTopic;

      const approvalStatus = reg?.topicApprovalStatus || 'pending';
      if (topicApprovalBadge) {
        if (approvalStatus === 'approved') {
          topicApprovalBadge.textContent = '✅ GVHD ĐÃ DUYỆT';
          topicApprovalBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-400 text-emerald-950 shadow-2xs';
        } else if (approvalStatus === 'rejected') {
          topicApprovalBadge.textContent = '⚠️ GVHD YÊU CẦU SỬA';
          topicApprovalBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-rose-400 text-rose-950 shadow-2xs';
        } else {
          topicApprovalBadge.textContent = '⏳ Chờ GVHD duyệt';
          topicApprovalBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-amber-400 text-slate-950 shadow-2xs';
        }
      }

      if (topicVersionBadge) {
        topicVersionBadge.textContent = \`Lần \${reg?.topicTitleVersion || 1}\`;
      }

      if (topicMetaEl) {
        const submittedAt = fmtDate(reg?.submittedAt);
        const timeStr = submittedAt ? \`🕒 Đã nộp: \${submittedAt}\` : '';
        const typeStr = reg?.projectType ? \`📁 Loại hình: \${reg.projectType}\` : '';
        topicMetaEl.innerHTML = [typeStr, timeStr].filter(Boolean).map(item => \`<span>\${escapeHtml(item)}</span>\`).join('<span class="text-white/30">•</span>');
      }

      if (topicReviewNoteEl) {
        const hasNote = approvalStatus === 'rejected' && String(reg?.topicApprovalNote || '').trim();
        if (hasNote) {
          topicReviewNoteEl.innerHTML = \`<span>💬 <strong>Ý kiến GVHD:</strong> \${escapeHtml(reg.topicApprovalNote)}</span>\`;
          topicReviewNoteEl.classList.remove('hidden');
        } else {
          topicReviewNoteEl.classList.add('hidden');
          topicReviewNoteEl.innerHTML = '';
        }
      }

      if (topicDownloadBtn) {
        topicDownloadBtn.classList.toggle('hidden', approvalStatus !== 'approved');
      }
    } else {
      topicWrap.classList.add('hidden');
      if (topicDownloadBtn) topicDownloadBtn.classList.add('hidden');
    }
  }`;

// normalize line breaks
const normS = s.replace(/\r\n/g, '\n');
const normTargetOld = targetOld.replace(/\r\n/g, '\n');
const normTargetNew = targetNew.replace(/\r\n/g, '\n');

if (normS.includes(normTargetOld)) {
  const updated = normS.replace(normTargetOld, normTargetNew);
  fs.writeFileSync('js/rounds/rounds-dashboard.js', updated, 'utf8');
  console.log('Successfully updated renderRoundHeader in rounds-dashboard.js');
} else {
  console.error('Target snippet not found in rounds-dashboard.js');
}
