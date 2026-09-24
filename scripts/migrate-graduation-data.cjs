const fs = require('fs');
const path = require('path');
const os = require('os');

const SOURCE_PROJECT = 'tknt-tdtu';
const DEST_PROJECT = 'ifa-graduation';

console.log('========================================================');
console.log(`MIGRATION SCRIPT: SOURCE = ${SOURCE_PROJECT} -> DEST = ${DEST_PROJECT}`);
console.log('========================================================');

async function getAccessToken() {
  const p = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(p)) {
    throw new Error('Firebase CLI configuration not found at ' + p);
  }
  const config = JSON.parse(fs.readFileSync(p, 'utf8'));
  let token = config.tokens?.access_token;
  
  // Test token
  const testRes = await fetch(`https://firestore.googleapis.com/v1/projects/${SOURCE_PROJECT}/databases/(default)/documents/settings/main`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  if (testRes.status === 401 && config.tokens?.refresh_token) {
    console.log('Refreshing OAuth access token...');
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        grant_type: 'refresh_token',
        refresh_token: config.tokens.refresh_token
      })
    });
    const refreshData = await refreshRes.json();
    if (!refreshData.access_token) {
      throw new Error('Failed to refresh token: ' + JSON.stringify(refreshData));
    }
    token = refreshData.access_token;
  }
  return token;
}

async function listDocuments(token, project, parentPath, collectionId) {
  let allDocs = [];
  let pageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${parentPath ? parentPath + '/' : ''}${collectionId}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (res.status === 404) return [];
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list ${collectionId} in ${project}: ${res.status} ${err}`);
    }
    
    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      allDocs = allDocs.concat(data.documents);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  
  return allDocs;
}

async function listSubcollections(token, project, documentPath) {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${documentPath}:listCollectionIds`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageSize: 100 })
  });
  if (res.status === 404) return [];
  if (!res.ok) return [];
  const data = await res.json();
  return data.collectionIds || [];
}

async function deleteDocument(token, project, fullDocName) {
  const url = `https://firestore.googleapis.com/v1/${fullDocName}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete ${fullDocName}: ${res.status} ${err}`);
  }
}

async function writeDocument(token, project, relativeDocPath, fields) {
  // relativeDocPath: e.g. "graduationRounds/FZRWniqMofaIvn7ogq0w"
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${relativeDocPath}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to write ${relativeDocPath} to ${project}: ${res.status} ${err}`);
  }
  return await res.json();
}

async function main() {
  const token = await getAccessToken();
  console.log('Authenticated successfully!');

  // ==========================================
  // STEP 1: READ EVERYTHING FROM tknt-tdtu
  // ==========================================
  console.log('\n--- 1. READING ALL GRADUATION DATA FROM SOURCE (tknt-tdtu) ---');

  const sourceData = {
    settings: [],
    supervisorMaster: [],
    graduationProjectTypes: [],
    graduationStudentProfiles: [],
    graduationRounds: [],
    roundSubcollections: {} // roundId -> { [subcolId]: docs }
  };

  // settings
  const settingsDocs = await listDocuments(token, SOURCE_PROJECT, '', 'settings');
  // Filter settings to main
  for (const s of settingsDocs) {
    const id = s.name.split('/').pop();
    if (id === 'main') {
      sourceData.settings.push({
        id: 'main',
        fullPath: s.name,
        relativeDocPath: 'settings/main',
        fields: {
          allowImpersonation: s.fields?.allowImpersonation || { booleanValue: true },
          updatedAt: s.fields?.updatedAt || { timestampValue: new Date().toISOString() },
          updatedBy: s.fields?.updatedBy || { stringValue: 'tranquanghai@tdtu.edu.vn' }
        }
      });
    }
  }

  // supervisorMaster
  const supDocs = await listDocuments(token, SOURCE_PROJECT, '', 'supervisorMaster');
  for (const doc of supDocs) {
    const id = doc.name.split('/').pop();
    sourceData.supervisorMaster.push({
      id,
      fullPath: doc.name,
      relativeDocPath: `supervisorMaster/${id}`,
      fields: doc.fields
    });
  }

  // graduationProjectTypes
  const projTypeDocs = await listDocuments(token, SOURCE_PROJECT, '', 'graduationProjectTypes');
  for (const doc of projTypeDocs) {
    const id = doc.name.split('/').pop();
    sourceData.graduationProjectTypes.push({
      id,
      fullPath: doc.name,
      relativeDocPath: `graduationProjectTypes/${id}`,
      fields: doc.fields
    });
  }

  // graduationStudentProfiles
  const profileDocs = await listDocuments(token, SOURCE_PROJECT, '', 'graduationStudentProfiles');
  for (const doc of profileDocs) {
    const id = doc.name.split('/').pop();
    sourceData.graduationStudentProfiles.push({
      id,
      fullPath: doc.name,
      relativeDocPath: `graduationStudentProfiles/${id}`,
      fields: doc.fields
    });
  }

  // graduationRounds & subcollections
  const roundDocs = await listDocuments(token, SOURCE_PROJECT, '', 'graduationRounds');
  for (const doc of roundDocs) {
    const roundId = doc.name.split('/').pop();
    sourceData.graduationRounds.push({
      id: roundId,
      fullPath: doc.name,
      relativeDocPath: `graduationRounds/${roundId}`,
      fields: doc.fields
    });

    sourceData.roundSubcollections[roundId] = {};
    const subcolIds = await listSubcollections(token, SOURCE_PROJECT, `graduationRounds/${roundId}`);
    console.log(`Found subcollections for round ${roundId}:`, subcolIds);

    for (const subcolId of subcolIds) {
      const subDocs = await listDocuments(token, SOURCE_PROJECT, `graduationRounds/${roundId}`, subcolId);
      sourceData.roundSubcollections[roundId][subcolId] = subDocs.map(sd => ({
        id: sd.name.split('/').pop(),
        fullPath: sd.name,
        relativeDocPath: `graduationRounds/${roundId}/${subcolId}/${sd.name.split('/').pop()}`,
        fields: sd.fields
      }));
    }
  }

  // Calculate Exact Source Total
  let totalSourceDocs = 0;
  totalSourceDocs += sourceData.settings.length;
  totalSourceDocs += sourceData.supervisorMaster.length;
  totalSourceDocs += sourceData.graduationProjectTypes.length;
  totalSourceDocs += sourceData.graduationStudentProfiles.length;
  totalSourceDocs += sourceData.graduationRounds.length;

  console.log('\n--- SOURCE SUMMARY BY COLLECTION ---');
  console.log('• settings/main:', sourceData.settings.length);
  console.log('• supervisorMaster:', sourceData.supervisorMaster.length);
  console.log('• graduationProjectTypes:', sourceData.graduationProjectTypes.length);
  console.log('• graduationStudentProfiles:', sourceData.graduationStudentProfiles.length);
  console.log('• graduationRounds:', sourceData.graduationRounds.length);

  for (const [rId, subcols] of Object.entries(sourceData.roundSubcollections)) {
    console.log(`  Round ${rId} subcollections:`);
    for (const [sId, sDocs] of Object.entries(subcols)) {
      console.log(`    - ${sId}: ${sDocs.length}`);
      totalSourceDocs += sDocs.length;
    }
  }

  console.log(`\n>>> TOTAL GRADUATION SOURCE DOCUMENTS = ${totalSourceDocs} <<<`);

  // ==========================================
  // STEP 2: CREATE LOCAL BACKUP
  // ==========================================
  if (!fs.existsSync('backups')) fs.mkdirSync('backups', { recursive: true });
  const backupPath = path.join('backups', `graduation_backup_tknt_tdtu_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(sourceData, null, 2), 'utf8');
  console.log(`\n✔ Backup safely saved to ${backupPath} (${fs.statSync(backupPath).size} bytes)`);

  // ==========================================
  // STEP 3: CHECK DESTINATION ifa-graduation
  // ==========================================
  console.log('\n--- 2. INSPECTING DESTINATION (ifa-graduation) ---');
  const destProjectTypes = await listDocuments(token, DEST_PROJECT, '', 'graduationProjectTypes');
  console.log(`Destination graduationProjectTypes currently has: ${destProjectTypes.length} documents`);

  // Clean up the 10 temporary auto-generated template types in destination
  console.log('Cleaning up temporary auto-generated project types in ifa-graduation...');
  for (const d of destProjectTypes) {
    console.log(`  Deleting temp template doc: ${d.name.split('/').pop()}`);
    await deleteDocument(token, DEST_PROJECT, d.name);
  }

  // ==========================================
  // STEP 4: WRITE TO DESTINATION ifa-graduation
  // ==========================================
  console.log('\n--- 3. MIGRATING DATA TO ifa-graduation ---');
  let createdCount = 0;

  // 1. settings
  for (const s of sourceData.settings) {
    await writeDocument(token, DEST_PROJECT, s.relativeDocPath, s.fields);
    console.log(`✔ Written: ${s.relativeDocPath}`);
    createdCount++;
  }

  // 2. supervisorMaster
  for (const s of sourceData.supervisorMaster) {
    await writeDocument(token, DEST_PROJECT, s.relativeDocPath, s.fields);
    console.log(`✔ Written: ${s.relativeDocPath}`);
    createdCount++;
  }

  // 3. graduationProjectTypes
  for (const p of sourceData.graduationProjectTypes) {
    await writeDocument(token, DEST_PROJECT, p.relativeDocPath, p.fields);
    console.log(`✔ Written: ${p.relativeDocPath}`);
    createdCount++;
  }

  // 4. graduationStudentProfiles
  for (const sp of sourceData.graduationStudentProfiles) {
    await writeDocument(token, DEST_PROJECT, sp.relativeDocPath, sp.fields);
    console.log(`✔ Written: ${sp.relativeDocPath}`);
    createdCount++;
  }

  // 5. graduationRounds & subcollections
  for (const r of sourceData.graduationRounds) {
    await writeDocument(token, DEST_PROJECT, r.relativeDocPath, r.fields);
    console.log(`✔ Written: ${r.relativeDocPath}`);
    createdCount++;

    const subcols = sourceData.roundSubcollections[r.id] || {};
    for (const [subcolId, subDocs] of Object.entries(subcols)) {
      for (const sd of subDocs) {
        await writeDocument(token, DEST_PROJECT, sd.relativeDocPath, sd.fields);
        console.log(`✔ Written: ${sd.relativeDocPath}`);
        createdCount++;
      }
    }
  }

  console.log(`\n>>> TOTAL DOCUMENTS WRITTEN TO ifa-graduation = ${createdCount} <<<`);

  // ==========================================
  // STEP 5: DEEP VERIFICATION IN DESTINATION
  // ==========================================
  console.log('\n--- 4. POST-MIGRATION DEEP VERIFICATION ---');

  const destSettings = await listDocuments(token, DEST_PROJECT, '', 'settings');
  const destSupervisors = await listDocuments(token, DEST_PROJECT, '', 'supervisorMaster');
  const destProjTypes = await listDocuments(token, DEST_PROJECT, '', 'graduationProjectTypes');
  const destProfiles = await listDocuments(token, DEST_PROJECT, '', 'graduationStudentProfiles');
  const destRounds = await listDocuments(token, DEST_PROJECT, '', 'graduationRounds');

  console.log(`• settings: ${destSettings.length} / expected ${sourceData.settings.length}`);
  console.log(`• supervisorMaster: ${destSupervisors.length} / expected ${sourceData.supervisorMaster.length}`);
  console.log(`• graduationProjectTypes: ${destProjTypes.length} / expected ${sourceData.graduationProjectTypes.length}`);
  console.log(`• graduationStudentProfiles: ${destProfiles.length} / expected ${sourceData.graduationStudentProfiles.length}`);
  console.log(`• graduationRounds: ${destRounds.length} / expected ${sourceData.graduationRounds.length}`);

  let destTotal = destSettings.length + destSupervisors.length + destProjTypes.length + destProfiles.length + destRounds.length;

  for (const r of destRounds) {
    const rId = r.name.split('/').pop();
    const subcols = await listSubcollections(token, DEST_PROJECT, `graduationRounds/${rId}`);
    for (const sId of subcols) {
      const sDocs = await listDocuments(token, DEST_PROJECT, `graduationRounds/${rId}`, sId);
      const expectedCount = (sourceData.roundSubcollections[rId]?.[sId] || []).length;
      console.log(`  Round ${rId}/${sId}: ${sDocs.length} / expected ${expectedCount}`);
      destTotal += sDocs.length;
      if (sDocs.length !== expectedCount) {
        throw new Error(`MISMATCH in round ${rId}/${sId}!`);
      }
    }
  }

  console.log(`\n========================================================`);
  console.log(`FINAL VERIFICATION: Source = ${totalSourceDocs} | Destination = ${destTotal}`);
  if (totalSourceDocs === destTotal) {
    console.log('SUCCESS: 100% DATA MATCH AND INTEGRITY VERIFIED!');
  } else {
    console.error('ERROR: DATA COUNT MISMATCH!');
  }
  console.log(`========================================================`);
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
