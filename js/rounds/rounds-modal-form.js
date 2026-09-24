/**
 * IFA+ Graduation — Round Create & Edit Modal Form Management Module
 */
window.openCreateRoundModal = async function() {
  document.getElementById('form-round').reset();
  document.getElementById('round-form-id').value = '';
  document.getElementById('modal-round-title').textContent = 'Tạo Đợt Đồ án Tốt nghiệp Mới';
  const defaultAssignmentMode = document.querySelector('input[name="supervisor-assignment-mode"][value="student_preference"]');
  if (defaultAssignmentMode) defaultAssignmentMode.checked = true;

  const preEl = document.getElementById('round-allow-pre-eligibility');
  if (preEl) {
    preEl.checked = false;
    preEl.onchange = () => updateRoundModalBadges();
  }

  // Default dates
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const nextMonth = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
  const nextMonthStr = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth()+1)}-${pad(nextMonth.getDate())}`;

  const openImm = document.getElementById('round-form-open-immediately');
  if (openImm) openImm.checked = false;
  toggleRoundOpenImmediately(false);

  if (document.getElementById('round-open-date')) document.getElementById('round-open-date').value = todayStr;
  if (document.getElementById('round-close-date')) document.getElementById('round-close-date').value = nextMonthStr;
  if (document.getElementById('round-open-hour')) document.getElementById('round-open-hour').value = '08';
  if (document.getElementById('round-open-minute')) document.getElementById('round-open-minute').value = '00';
  if (document.getElementById('round-close-hour')) document.getElementById('round-close-hour').value = '17';
  if (document.getElementById('round-close-minute')) document.getElementById('round-close-minute').value = '30';

  // 12-week timeline defaults
  const startDateInput = document.getElementById('round-form-start-date');
  if (startDateInput) {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(new Date(today).setDate(diff));
    startDateInput.value = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
    if (typeof window.onRoundStartDateChanged === 'function') {
      window.onRoundStartDateChanged(startDateInput.value);
    }
  }
  const durationInput = document.getElementById('round-form-duration-weeks');
  if (durationInput) durationInput.value = '12';

  // Reset state collections
  state.roundModalEligibleStudents = [];
  state.roundModalSupervisors = new Map();

  // Ensure supervisors master loaded before rendering
  await ensureSupervisorsMasterLoaded();

  // Pre-populate supervisors list from Master Pool
  renderRoundModalSupervisorsList();
  renderRoundModalEligibleTable();
  updateRoundModalBadges();

  // Reset Drive inputs
  const createDriveInput = document.getElementById('round-drive-folder-url');
  if (createDriveInput) {
    createDriveInput.value = '';
    delete createDriveInput.dataset.validatedFolderId;
    delete createDriveInput.dataset.validatedFolderName;
    delete createDriveInput.dataset.validatedFolderUrl;
  }
  const createDriveStatusEl = document.getElementById('round-drive-folder-status');
  if (createDriveStatusEl) {
    createDriveStatusEl.innerHTML = '';
    createDriveStatusEl.classList.add('hidden');
  }
  const createDriveFoldersInput = document.getElementById('round-drive-subfolder-names');
  if (createDriveFoldersInput) createDriveFoldersInput.value = '';
  updateRoundDriveFolderPreview();

  if (typeof renderRoundWeeklyContentEditor === 'function') renderRoundWeeklyContentEditor(12);
  switchRoundModalTab('info');
  document.getElementById('modal-round').classList.remove('hidden');
};

// Open Edit Round Modal
window.editRoundModal = async function(roundId, initialTab = 'info') {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) {
    showToast('Không tìm thấy thông tin đợt tốt nghiệp!', 'error');
    return;
  }

  document.getElementById('round-form-id').value = r.id;
  document.getElementById('round-form-title').value = r.title || '';
  document.getElementById('round-form-year').value = r.academicYear || '';
  document.getElementById('round-form-name').value = r.slug || r.shortCode || r.roundName || '';
  document.getElementById('round-form-status').value = r.status || 'draft';
  document.getElementById('round-form-pref-count').value = r.preferenceCount || '3';
  document.getElementById('round-form-selection-mode').value = r.selectionMode || 'cards';
  const assignmentMode = getSupervisorAssignmentMode(r);
  const assignmentModeInput = document.querySelector(`input[name="supervisor-assignment-mode"][value="${assignmentMode}"]`);
  if (assignmentModeInput) assignmentModeInput.checked = true;
  document.getElementById('round-form-allow-edit').checked = r.allowStudentEdit !== false;
  document.getElementById('round-form-allow-topic-edit').checked = r.allowTopicEdit !== false;
  document.getElementById('round-form-allow-pref-edit').checked = r.allowPreferenceEdit !== false;

  const preEl = document.getElementById('round-allow-pre-eligibility');
  if (preEl) {
    preEl.checked = (r.allowRegistrationBeforeEligibility === true);
    preEl.onchange = () => updateRoundModalBadges();
  }

  const emailToggle = document.getElementById('round-form-show-email-after-publish');
  if (emailToggle) emailToggle.checked = (r.showEmailAfterPublish !== false);
  const phoneToggle = document.getElementById('round-form-show-phone-after-publish');
  if (phoneToggle) phoneToggle.checked = (r.showPhoneAfterPublish !== false);

  const driveInput = document.getElementById('round-drive-folder-url');
  if (driveInput) {
    const rootId = r.driveRootFolderId || r.rootDriveFolderId;
    const rootUrl = r.driveRootFolderUrl || r.rootDriveFolderUrl || (rootId ? `https://drive.google.com/drive/folders/${rootId}` : '');
    const rootName = r.driveRootFolderName || r.rootDriveFolderName || 'Google Drive';
    driveInput.value = rootUrl;
    const isExplicitlyValidated = Boolean(
      rootId &&
      r.driveValidation?.validated === true &&
      (r.driveValidation?.folderId === rootId || r.driveRootFolderId === rootId || r.rootDriveFolderId === rootId)
    );

    if (isExplicitlyValidated) {
      driveInput.dataset.isValidated = 'true';
      driveInput.dataset.validatedFolderId = rootId;
      driveInput.dataset.validatedFolderName = rootName;
      driveInput.dataset.validatedFolderUrl = rootUrl;
    } else if (rootId) {
      driveInput.dataset.isValidated = 'false';
      driveInput.dataset.validatedFolderId = rootId;
      driveInput.dataset.validatedFolderName = rootName;
      driveInput.dataset.validatedFolderUrl = rootUrl;
    } else {
      delete driveInput.dataset.isValidated;
      delete driveInput.dataset.validatedFolderId;
      delete driveInput.dataset.validatedFolderName;
      delete driveInput.dataset.validatedFolderUrl;
    }

    const statusEl = document.getElementById('round-drive-folder-status');
    if (statusEl) {
      if (isExplicitlyValidated) {
        statusEl.innerHTML = `
          <div class="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
            <div>
              <span class="font-bold flex items-center gap-1.5">🟢 Đã xác thực quyền tạo thư mục con: ${escapeHtml(rootName)}</span>
              <span class="block text-[10px] text-emerald-600 font-mono">ID: ${rootId}</span>
            </div>
            <a href="${rootUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-white border border-emerald-300 text-blue-600 hover:underline font-bold text-xs rounded shadow-2xs">
              Mở Drive ↗
            </a>
          </div>
        `;
        statusEl.classList.remove('hidden');
      } else if (rootId) {
        statusEl.innerHTML = `
          <div class="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
            <div>
              <span class="font-bold">🟡 Đã cấu hình thư mục Drive — Chưa kiểm tra quyền</span>
              <span class="block text-[11px] text-amber-700 mt-0.5">Vui lòng bấm <strong>[Kiểm tra quyền Drive]</strong> để xác thực quyền tạo thư mục con.</span>
            </div>
            <a href="${rootUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-white border border-amber-300 text-amber-800 font-bold text-xs rounded shadow-2xs">
              Mở Drive ↗
            </a>
          </div>
        `;
        statusEl.classList.remove('hidden');
      } else {
        statusEl.innerHTML = '';
        statusEl.classList.add('hidden');
      }
    }
  }

  const driveFoldersInput = document.getElementById('round-drive-subfolder-names');
  if (driveFoldersInput) {
    const configuredNames = normalizeRoundDriveFolderNames(
      Array.isArray(r.driveSubfolderNames) && r.driveSubfolderNames.length
        ? r.driveSubfolderNames
        : (r.driveFolderStructure || []).map(item => item?.name || item?.folderName)
    );
    driveFoldersInput.value = configuredNames.join('\n');
  }
  updateRoundDriveFolderPreview();

  const pad = n => String(n).padStart(2, '0');

  const openImm = document.getElementById('round-form-open-immediately');
  const isImmediately = (r.openImmediately === true);
  if (openImm) openImm.checked = isImmediately;
  toggleRoundOpenImmediately(isImmediately);

  if (r.openAtDate) {
    const od = new Date(r.openAtDate);
    if (document.getElementById('round-open-date')) document.getElementById('round-open-date').value = `${od.getFullYear()}-${pad(od.getMonth()+1)}-${pad(od.getDate())}`;
    if (document.getElementById('round-open-hour')) document.getElementById('round-open-hour').value = pad(od.getHours());
    if (document.getElementById('round-open-minute')) document.getElementById('round-open-minute').value = pad(od.getMinutes());
  }
  if (r.closeAtDate) {
    const cd = new Date(r.closeAtDate);
    if (document.getElementById('round-close-date')) document.getElementById('round-close-date').value = `${cd.getFullYear()}-${pad(cd.getMonth()+1)}-${pad(cd.getDate())}`;
    if (document.getElementById('round-close-hour')) document.getElementById('round-close-hour').value = pad(cd.getHours());
    if (document.getElementById('round-close-minute')) document.getElementById('round-close-minute').value = pad(cd.getMinutes());
  }

  // 12-week timeline values
  const startDateInput = document.getElementById('round-form-start-date');
  const roundStartDate = r.startDate || r.datnStartDate || '';
  if (startDateInput) {
    if (roundStartDate) {
      if (typeof roundStartDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(roundStartDate)) {
        startDateInput.value = roundStartDate.slice(0, 10);
      } else {
        const d = new Date(roundStartDate?.toDate ? roundStartDate.toDate() : roundStartDate);
        if (!isNaN(d.getTime())) {
          startDateInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        } else {
          startDateInput.value = '';
        }
      }
      if (typeof window.onRoundStartDateChanged === 'function') {
        window.onRoundStartDateChanged(startDateInput.value);
      }
    } else {
      startDateInput.value = '';
      const feedback = document.getElementById('round-start-date-feedback');
      if (feedback) feedback.innerHTML = '';
    }
  }
  const durationInput = document.getElementById('round-form-duration-weeks');
  if (durationInput) {
    durationInput.value = String(r.durationWeeks || 12);
  }

  // Load Eligible Students for this round (strictly from round subcollection, never fallback)
  state.roundModalEligibleStudents = [];
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', r.id, 'eligibleStudents'));
    state.roundModalEligibleStudents = snap.docs.map(d => {
      const data = d.data() || {};
      const mssv = String(d.id || data.studentId || data.mssv || '').trim().toUpperCase();
      let cleanName = String(data.name || data.fullName || '').trim();
      if (cleanName === mssv || cleanName.startsWith('Sinh viên ' + mssv)) {
        cleanName = '';
      }
      return {
        studentId: mssv,
        mssv: mssv,
        ...data,
        name: cleanName,
        fullName: cleanName
      };
    });
  } catch (e) {
    console.warn('Could not load eligible students for round modal:', e);
  }

  // Ensure supervisors master loaded before loading round supervisors
  await ensureSupervisorsMasterLoaded();

  // Load Supervisors for this round - strictly matched to Master
  state.roundModalSupervisors = new Map();
  try {
    const supSnap = await getDocs(collection(db, 'graduationRounds', r.id, 'supervisors'));
    supSnap.docs.forEach(d => {
      const data = d.data() || {};
      const targetDocId = String(d.id || '').trim();
      const targetSupId = String(data.supervisorId || '').trim();
      const targetEmail = String(data.email || '').toLowerCase().trim();

      // Find canonical master supervisor
      const masterSup = (state.supervisorsMaster || []).find(m =>
        m.id === targetDocId ||
        (targetSupId && m.id === targetSupId) ||
        (m.email && targetEmail && m.email.toLowerCase().trim() === targetEmail)
      );

      // Only include if matches a valid supervisor in Master (purges old dummy sup_* docs)
      if (masterSup) {
        const { employmentType, maxCap, defaultQuota } = getSupervisorDefaultAndMaxQuota(masterSup);
        const roundQuota = (typeof data.maxQuota === 'number' && data.maxQuota > 0)
          ? Math.min(maxCap, data.maxQuota)
          : defaultQuota;

        state.roundModalSupervisors.set(masterSup.id, {
          id: masterSup.id,
          supervisorId: masterSup.id,
          name: masterSup.name || data.name || '',
          email: masterSup.email || data.email || '',
          department: masterSup.department || data.department || 'Thiết kế nội thất',
          photoUrl: masterSup.photoUrl || data.photoUrl || '',
          employmentType: employmentType,
          maxQuota: roundQuota,
          currentCount: data.currentCount || 0,
          active: true
        });
      }
    });
  } catch (e) {
    console.warn('Could not load supervisors for round modal:', e);
  }

  renderRoundModalEligibleTable();
  renderRoundModalSupervisorsList();
  updateRoundModalBadges();

  // Dynamically resolve names from Faculty Student Master as soon as dataset is ready
  if (typeof ensureFacultyDatasetLoaded === 'function') {
    ensureFacultyDatasetLoaded().then(() => {
      renderRoundModalEligibleTable();
    }).catch(() => {});
  }

  document.getElementById('modal-round-title').textContent = 'Chỉnh sửa Đợt Đồ án Tốt nghiệp';
  switchRoundModalTab(initialTab || 'info');

  // Render weekly content editor and populate saved config
  const editDurationWeeks = parseInt(r.durationWeeks, 10) || 12;
  state.roundWeekEventsDraft = {};
  state.roundWeekEditingEvents = {};
  if (typeof renderRoundWeeklyContentEditor === 'function') renderRoundWeeklyContentEditor(editDurationWeeks);
  (r.timelineWeeksConfig || []).forEach((wc) => {
    const n = wc.week || 1;
    const titleEl = document.getElementById(`round-week-${n}-title`);
    const noteEl  = document.getElementById(`round-week-${n}-note`);
    const mileEl  = document.getElementById(`round-week-${n}-milestone`);
    const visibleEl = document.getElementById(`round-week-${n}-visible`);
    const customMilestoneEl = document.getElementById(`round-week-${n}-milestone-custom`);
    if (titleEl) titleEl.value = wc.title || '';
    if (noteEl)  noteEl.value  = wc.note  || '';
    state.roundWeekEventsDraft[n] = Array.isArray(wc.events) ? wc.events.map((event, index) => ({
      id: event.id || `legacy-${n}-${index}`,
      title: String(event.title || event.name || '').trim(),
      dayIndex: Number.isInteger(event.dayIndex) ? event.dayIndex : 0,
      date: event.date || event.startDate || '',
      startDayIndex: Number.isInteger(Number(event.startDayIndex)) ? Number(event.startDayIndex) : (Number.isInteger(event.dayIndex) ? event.dayIndex : 0),
      endDayIndex: Number.isInteger(Number(event.endDayIndex)) ? Number(event.endDayIndex) : (Number.isInteger(event.dayIndex) ? event.dayIndex : 0),
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || event.date || '',
      color: normalizeRoundWeekEventColor(event.color)
    })).filter(event => event.title) : [];
    if (visibleEl) visibleEl.checked = wc.visible !== false;
    if (mileEl) {
      const standardMilestones = ['', 'Duyệt đợt 1', 'Duyệt đợt 2', 'Duyệt đợt 3', 'Sơ khảo', 'Khác'];
      const savedMilestone = wc.milestone || '';
      mileEl.value = standardMilestones.includes(savedMilestone) ? savedMilestone : 'Khác';
      if (customMilestoneEl && mileEl.value === 'Khác') customMilestoneEl.value = savedMilestone === 'Khác' ? '' : savedMilestone;
      window.toggleRoundWeekCustomMilestone(n);
    }
    renderRoundWeekDayPicker(n);
  });

  document.getElementById('modal-round').classList.remove('hidden');
};

window.closeRoundModal = function() {
  document.getElementById('modal-round').classList.add('hidden');
};


// ============================================================================
// SAVE ROUND (HANDLES COMPLETE & INCOMPLETE CONFIG)
// ============================================================================


window.saveRound = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const id = document.getElementById('round-form-id')?.value?.trim();
  const title = document.getElementById('round-form-title')?.value.trim();
  const academicYear = document.getElementById('round-form-year')?.value.trim();
  let roundName = document.getElementById('round-form-name')?.value.trim();

  // Normalize shortCode to URL-safe
  const shortCode = (roundName || '').replace(/[^a-zA-Z0-9_-]/g, '');
  roundName = shortCode;

  // Read "Mở ngay" flag and 24H time components
  const openImmediately = document.getElementById('round-form-open-immediately')?.checked === true;
  const openDateStr = document.getElementById('round-open-date')?.value;
  const openHour = document.getElementById('round-open-hour')?.value || '08';
  const openMin = document.getElementById('round-open-minute')?.value || '00';

  const closeDateStr = document.getElementById('round-close-date')?.value;
  const closeHour = document.getElementById('round-close-hour')?.value || '17';
  const closeMin = document.getElementById('round-close-minute')?.value || '30';

  const preferenceCount = parseInt(document.getElementById('round-form-pref-count')?.value, 10) || 3;
  const selectionMode = document.getElementById('round-form-selection-mode')?.value || 'cards';
  const supervisorAssignmentMode = document.querySelector('input[name="supervisor-assignment-mode"]:checked')?.value || 'student_preference';
  const status = document.getElementById('round-form-status')?.value || 'draft';
  const allowStudentEdit = document.getElementById('round-form-allow-edit')?.checked !== false;
  const allowTopicEdit = document.getElementById('round-form-allow-topic-edit')?.checked !== false;
  const allowPreferenceEdit = document.getElementById('round-form-allow-pref-edit')?.checked !== false;

  const showEmailAfterPublish = document.getElementById('round-form-show-email-after-publish')?.checked !== false;
  const showPhoneAfterPublish = document.getElementById('round-form-show-phone-after-publish')?.checked !== false;

  const startDateStr = document.getElementById('round-form-start-date')?.value?.trim() || '';
  const durationWeeks = parseInt(document.getElementById('round-form-duration-weeks')?.value, 10) || 12;

  // Collect weekly content config from admin form
  const timelineWeeksConfig = Array.from({ length: durationWeeks }, (_, i) => {
    const n = i + 1;
    const milestoneSelect = document.getElementById(`round-week-${n}-milestone`)?.value || '';
    const customMilestone = document.getElementById(`round-week-${n}-milestone-custom`)?.value?.trim() || '';
    return {
      week: n,
      title: resolveRoundWeekTitle(n, document.getElementById(`round-week-${n}-title`)?.value?.trim()),
      note: document.getElementById(`round-week-${n}-note`)?.value?.trim() || '',
      milestone: milestoneSelect === 'Khác' ? (customMilestone || 'Mốc khác') : milestoneSelect,
      visible: document.getElementById(`round-week-${n}-visible`)?.checked !== false,
      events: getRoundWeekDraftEvents(n).map(event => ({
        id: event.id,
        title: String(event.title || '').trim(),
        dayIndex: getRoundWeekEventRange(event).startDayIndex,
        date: event.startDate || event.date || '',
        startDayIndex: getRoundWeekEventRange(event).startDayIndex,
        endDayIndex: getRoundWeekEventRange(event).endDayIndex,
        startDate: event.startDate || event.date || '',
        endDate: event.endDate || event.startDate || event.date || '',
        color: normalizeRoundWeekEventColor(event.color)
      })).filter(event => event.title),
    };
  });

  if (!title || !academicYear || !roundName || (!openImmediately && !openDateStr) || !closeDateStr) {
    showToast('Vui lòng nhập đầy đủ các trường bắt buộc (*)', 'warning');
    switchRoundModalTab('info');
    return;
  }

  const submitBtn = document.querySelector('#form-round button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  let openDate;
  if (openImmediately) {
    openDate = new Date();
  } else {
    const [oy, om, od] = openDateStr.split('-').map(Number);
    openDate = new Date(oy, om - 1, od, Number(openHour), Number(openMin), 0);
  }

  const [cy, cm, cd] = closeDateStr.split('-').map(Number);
  const closeDate = new Date(cy, cm - 1, cd, Number(closeHour), Number(closeMin), 0);

  const allowRegistrationBeforeEligibility = document.getElementById('round-allow-pre-eligibility')?.checked === true;
  const elCount = (state.roundModalEligibleStudents || []).length;

  const selectedSupervisorsMap = state.roundModalSupervisors || new Map();
  const selectedSupIds = new Set(selectedSupervisorsMap.keys());
  const newSupervisorsArray = [];

  for (const [supId, supData] of selectedSupervisorsMap.entries()) {
    if (!supId || supId === 'undefined') continue;
    newSupervisorsArray.push({
      id: supId,
      supervisorId: supId,
      name: supData.name || '',
      email: supData.email || '',
      department: supData.department || 'Thiết kế nội thất',
      photoUrl: supData.photoUrl || '',
      employmentType: supData.employmentType || 'internal',
      maxQuota: supData.maxQuota || 10,
      currentCount: supData.currentCount || 0,
      active: true
    });
  }

  const supCount = newSupervisorsArray.length;
  const configStatus = (supCount > 0 && (elCount > 0 || allowRegistrationBeforeEligibility)) ? 'ready' : 'incomplete';

  const driveInput = document.getElementById('round-drive-folder-url');
  const driveUrl = driveInput?.value?.trim();
  const driveRootFolderId = driveUrl ? window.extractDriveFolderId(driveUrl) : null;
  const driveRootFolderName = driveInput?.dataset?.validatedFolderName || null;
  const driveRootFolderUrl = driveRootFolderId ? (driveInput?.dataset?.validatedFolderUrl || `https://drive.google.com/drive/folders/${driveRootFolderId}`) : null;
  const driveSubfolderNames = normalizeRoundDriveFolderNames(document.getElementById('round-drive-subfolder-names')?.value || '');
  const isValidated = Boolean(
    driveRootFolderId &&
    driveInput?.dataset?.isValidated === 'true' &&
    driveInput?.dataset?.validatedFolderId === driveRootFolderId
  );

  const existingRound = (state.rounds || []).find(x => x.id === id);
  const driveValidation = isValidated ? {
    validated: true,
    validatedAt: (id && existingRound?.driveValidation?.validatedAt && existingRound?.driveRootFolderId === driveRootFolderId)
      ? existingRound.driveValidation.validatedAt
      : new Date().toISOString(),
    validatedBy: state.user?.email || '',
    canCreateChildren: true,
    folderId: driveRootFolderId,
    folderName: driveRootFolderName || 'Google Drive',
  } : (driveRootFolderId ? {
    validated: false,
    canCreateChildren: false,
    folderId: driveRootFolderId,
  } : null);

  const payload = {
    title,
    academicYear,
    roundName: shortCode,
    shortCode: shortCode,
    slug: shortCode,
    openImmediately: !!openImmediately,
    openAt: openDate,
    closeAt: closeDate,
    startDate: startDateStr || null,
    datnStartDate: startDateStr || null,
    durationWeeks: durationWeeks,
    timelineWeeksConfig: timelineWeeksConfig,
    preferenceCount,
    selectionMode,
    supervisorAssignmentMode,
    status,
    allowStudentEdit,
    allowTopicEdit,
    allowPreferenceEdit,
    showEmailAfterPublish,
    showPhoneAfterPublish,
    allowRegistrationBeforeEligibility: !!allowRegistrationBeforeEligibility,
    eligibilityFinalized: !allowRegistrationBeforeEligibility,
    configStatus,
    eligibleCount: elCount,
    supervisorCount: supCount,
    supervisors: newSupervisorsArray,
    driveRootFolderId: driveRootFolderId || null,
    driveRootFolderUrl: driveRootFolderUrl || null,
    driveRootFolderName: driveRootFolderName || null,
    rootDriveFolderId: driveRootFolderId || null,
    rootDriveFolderUrl: driveRootFolderUrl || null,
    rootDriveFolderName: driveRootFolderName || null,
    driveSubfolderNames,
    driveFolderStructure: driveSubfolderNames.length
      ? (existingRound?.driveFolderStructure || []).filter(item => driveSubfolderNames.includes(item?.name || item?.folderName))
      : [],
    driveValidation: driveValidation,
    deleted: false,
    updatedAt: serverTimestamp()
  };

  let driveProvisionWarning = '';
  try {
    let savedId = id;
    if (id) {
      await updateDoc(doc(db, 'graduationRounds', id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      payload.createdBy = state.user?.email || '';
      payload.isActive = false; // Always start non-active until explicitly activated
      const docRef = await addDoc(collection(db, 'graduationRounds'), payload);
      savedId = docRef.id;
    }

    if (!savedId) {
      throw new Error('Không thể xác định mã ID đợt tốt nghiệp');
    }

    if (driveSubfolderNames.length > 0) {
      if (!driveRootFolderId || !isValidated) {
        driveProvisionWarning = 'Đã lưu danh sách thư mục con nhưng chưa tạo trên Drive vì thư mục gốc chưa được xác thực quyền.';
      } else {
        try {
          const driveFolderStructure = await provisionRoundDriveFolders({
            roundId: savedId,
            parentFolderId: driveRootFolderId,
            folderNames: driveSubfolderNames,
          });
          payload.driveFolderStructure = driveFolderStructure;
          payload.driveStructureProvisionedAt = new Date().toISOString();
          await updateDoc(doc(db, 'graduationRounds', savedId), {
            driveSubfolderNames,
            driveFolderStructure,
            driveStructureProvisionedAt: serverTimestamp(),
            driveStructureError: null,
            updatedAt: serverTimestamp(),
          });
        } catch (driveErr) {
          console.warn('[Round Drive] Không thể hoàn tất cấu trúc thư mục:', driveErr);
          driveProvisionWarning = driveErr.message || 'Không thể tạo đầy đủ cấu trúc thư mục Drive.';
          await updateDoc(doc(db, 'graduationRounds', savedId), {
            driveSubfolderNames,
            driveStructureError: driveProvisionWarning,
            updatedAt: serverTimestamp(),
          }).catch(console.warn);
        }
      }
    }

    // 1. Persist Eligible Students subcollection (strictly syncs additions, removals, and empty state)
    const currentEligibleList = state.roundModalEligibleStudents || [];
    const currentMssvSet = new Set(
      currentEligibleList
        .map(s => String(s.studentId || s.mssv || s.id || '').trim().toUpperCase())
        .filter(Boolean)
    );

    // Sync removals & clear-all: delete docs from subcollection that are no longer in current list
    try {
      const existingSnap = await getDocs(collection(db, 'graduationRounds', savedId, 'eligibleStudents'));
      if (existingSnap && !existingSnap.empty) {
        const toDeleteRefs = [];
        existingSnap.docs.forEach(d => {
          const docMssv = String(d.id || '').trim().toUpperCase();
          if (!currentMssvSet.has(docMssv)) {
            toDeleteRefs.push(d.ref);
          }
        });
        for (let offset = 0; offset < toDeleteRefs.length; offset += 450) {
          const delBatch = writeBatch(db);
          toDeleteRefs.slice(offset, offset + 450).forEach(ref => delBatch.delete(ref));
          await delBatch.commit().catch(console.warn);
        }
      }
    } catch (errSync) {
      console.warn('Lỗi đồng bộ xóa sinh viên trong subcollection eligibleStudents:', errSync);
    }

    // Persist current eligible students
    if (currentEligibleList.length > 0) {
      for (let offset = 0; offset < currentEligibleList.length; offset += 450) {
        const batch = writeBatch(db);
        const chunk = currentEligibleList.slice(offset, offset + 450);
        let validBatchCount = 0;
        chunk.forEach(s => {
          const mssv = String(s.studentId || s.mssv || s.id || '').trim().toUpperCase();
          if (!mssv || mssv === 'UNDEFINED') return;
          let studentName = String(s.name || s.fullName || '').trim();
          if (studentName === mssv || studentName.startsWith('Sinh viên ' + mssv)) {
            studentName = '';
          }
          const ref = doc(db, 'graduationRounds', savedId, 'eligibleStudents', mssv);
          batch.set(ref, {
            studentId: mssv,
            mssv: mssv,
            name: studentName,
            fullName: studentName,
            gender: s.gender || '',
            major: s.major || '',
            className: s.className || s.studentClass || '',
            email: s.email || `${mssv.toLowerCase()}@student.tdtu.edu.vn`,
            phone: s.phone || '',
            eligible: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
          validBatchCount++;
        });
        if (validBatchCount > 0) {
          await batch.commit().catch(console.warn);
        }
      }
    }

    // 2. Persist Supervisors subcollection (Replace / Diff: delete unselected & obsolete docs, save selected)
    try {
      const existingSupSnap = await getDocs(collection(db, 'graduationRounds', savedId, 'supervisors'));
      if (existingSupSnap && !existingSupSnap.empty) {
        const toDeleteSupRefs = [];
        existingSupSnap.docs.forEach(d => {
          const docId = d.id;
          const data = d.data() || {};
          const docSupId = data.supervisorId || docId;
          // If this document is not in current selected list, queue for deletion
          if (!selectedSupIds.has(docId) && !selectedSupIds.has(docSupId)) {
            toDeleteSupRefs.push(d.ref);
          }
        });
        for (let offset = 0; offset < toDeleteSupRefs.length; offset += 450) {
          const delBatch = writeBatch(db);
          toDeleteSupRefs.slice(offset, offset + 450).forEach(ref => delBatch.delete(ref));
          await delBatch.commit().catch(console.warn);
        }
      }
    } catch (errSyncSup) {
      console.warn('Lỗi đồng bộ xóa giảng viên trong subcollection supervisors:', errSyncSup);
    }

    if (newSupervisorsArray.length > 0) {
      for (let offset = 0; offset < newSupervisorsArray.length; offset += 450) {
        const batch = writeBatch(db);
        const chunk = newSupervisorsArray.slice(offset, offset + 450);
        chunk.forEach(supData => {
          const ref = doc(db, 'graduationRounds', savedId, 'supervisors', supData.id);
          batch.set(ref, {
            supervisorId: supData.id,
            name: supData.name,
            email: supData.email,
            department: supData.department,
            photoUrl: supData.photoUrl,
            employmentType: supData.employmentType,
            maxQuota: supData.maxQuota,
            currentCount: supData.currentCount || 0,
            active: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit().catch(console.warn);
      }
    }

    if (state.activeRound?.id === savedId || state.selectedRoundId === savedId) {
      if (typeof loadRoundSupervisors === 'function') {
        loadRoundSupervisors(savedId).catch(console.warn);
      }
    }

    // Update in-memory state
    const roundObj = {
      id: savedId,
      ...payload,
      openAtDate: openDate,
      closeAtDate: closeDate
    };
    const existingIdx = (state.rounds || []).findIndex(r => r.id === savedId);
    if (existingIdx >= 0) {
      state.rounds[existingIdx] = { ...state.rounds[existingIdx], ...roundObj };
    } else {
      state.rounds.unshift(roundObj);
    }

    if (state.selectedRoundId === savedId || !state.activeRound) {
      state.selectedRoundId = savedId;
    }

    try { renderAdminRoundsTable(); } catch (e) { console.warn(e); }
    try { renderRoundsDropdowns(); } catch (e) { console.warn(e); }

    closeRoundModal();

    if (driveProvisionWarning) {
      showToast(`Đã lưu đợt "${title}". ${driveProvisionWarning}`, 'warning', 6500);
    } else if (configStatus === 'incomplete') {
      showToast(`Đã lưu đợt "${title}" (Trạng thái: Chưa hoàn tất cấu hình - cần thêm SV hoặc GVHD trước khi kích hoạt).`, 'warning', 5000);
    } else {
      showToast(`✓ Đã lưu đợt "${title}" thành công (Cấu hình sẵn sàng)!`, 'success');
    }

    loadRounds().catch(console.warn);
  } catch (err) {
    console.error('Lỗi lưu đợt tốt nghiệp:', err);
    showToast('Lỗi lưu đợt: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Lưu Đợt';
    }
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getSupervisorDefaultAndMaxQuota !== 'undefined') window.getSupervisorDefaultAndMaxQuota = getSupervisorDefaultAndMaxQuota;
  if (typeof ensureSupervisorsMasterLoaded !== 'undefined') window.ensureSupervisorsMasterLoaded = ensureSupervisorsMasterLoaded;
  if (typeof updateRoundModalBadges !== 'undefined') window.updateRoundModalBadges = updateRoundModalBadges;
  if (typeof updateRoundModalConfigSummary !== 'undefined') window.updateRoundModalConfigSummary = updateRoundModalConfigSummary;
  if (typeof getRoundWeekDaysFromForm !== 'undefined') window.getRoundWeekDaysFromForm = getRoundWeekDaysFromForm;
  if (typeof getRoundWeekDraftEvents !== 'undefined') window.getRoundWeekDraftEvents = getRoundWeekDraftEvents;
  if (typeof normalizeRoundWeekEventColor !== 'undefined') window.normalizeRoundWeekEventColor = normalizeRoundWeekEventColor;
  if (typeof setActivityFormColor !== 'undefined') window.setActivityFormColor = setActivityFormColor;
  if (typeof getRoundWeekEditingEventId !== 'undefined') window.getRoundWeekEditingEventId = getRoundWeekEditingEventId;
  if (typeof setRoundWeekEventFormMode !== 'undefined') window.setRoundWeekEventFormMode = setRoundWeekEventFormMode;
  if (typeof updateRoundWeekEventColorPresets !== 'undefined') window.updateRoundWeekEventColorPresets = updateRoundWeekEventColorPresets;
  if (typeof getRoundWeekEventRange !== 'undefined') window.getRoundWeekEventRange = getRoundWeekEventRange;
  if (typeof roundWeekEventOccursOnDay !== 'undefined') window.roundWeekEventOccursOnDay = roundWeekEventOccursOnDay;
  if (typeof distinguishOverlappingTimelineEvents !== 'undefined') window.distinguishOverlappingTimelineEvents = distinguishOverlappingTimelineEvents;
  if (typeof renderRoundWeekDayPicker !== 'undefined') window.renderRoundWeekDayPicker = renderRoundWeekDayPicker;
  if (typeof getRoundTimelineDefaultTitle !== 'undefined') window.getRoundTimelineDefaultTitle = getRoundTimelineDefaultTitle;
  if (typeof resolveRoundWeekTitle !== 'undefined') window.resolveRoundWeekTitle = resolveRoundWeekTitle;
  if (typeof renderRoundWeeklyContentEditor !== 'undefined') window.renderRoundWeeklyContentEditor = renderRoundWeeklyContentEditor;
  if (typeof readRoundWeeklyContentDraft !== 'undefined') window.readRoundWeeklyContentDraft = readRoundWeeklyContentDraft;
  if (typeof restoreRoundWeeklyContentDraft !== 'undefined') window.restoreRoundWeeklyContentDraft = restoreRoundWeeklyContentDraft;
  if (typeof pad !== 'undefined') window.pad = pad;
}
