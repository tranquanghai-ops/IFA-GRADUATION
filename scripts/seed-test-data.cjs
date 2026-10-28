/**
 * IFA+ Graduation — Test Data Seeder
 * 
 * Safely seeds 2 rounds, 12 mock supervisors, and 60 mock students
 * directly into the local Firestore Emulator using rules-unit-testing.
 */

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { verifyEmulatorSafety } = require('./emulator-guard.cjs');
const {
  generateMockSupervisors,
  generateMockRounds,
  generateMockStudents
} = require('./mock-dataset.cjs');

async function seedTestData() {
  console.log('\n======================================================');
  console.log('🌱 IFA+ GRADUATION — LOCAL TEST DATA SEEDER');
  console.log('======================================================');

  // Strict emulator safety verification
  const guard = await verifyEmulatorSafety({ strictProjectCheck: true, pingCheck: true });
  console.log(`✓ Safety check passed. Connected to Emulator: ${guard.emulatorHost}`);
  console.log(`✓ Project ID: ${guard.projectId} (STRICTLY NON-PRODUCTION)\n`);

  const root = path.resolve(__dirname, '..');
  const rulesPath = path.join(root, 'firestore.rules');
  const rules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';

  const env = await initializeTestEnvironment({
    projectId: guard.projectId,
    firestore: rules ? { rules } : undefined
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 0. Seed admin users
    await setDoc(doc(db, 'admins', 'admin@tdtu.edu.vn'), {
      email: 'admin@tdtu.edu.vn',
      role: 'admin',
      name: 'Quản trị viên Hệ thống'
    });
    await setDoc(doc(db, 'admins', 'tranquanghai@tdtu.edu.vn'), {
      email: 'tranquanghai@tdtu.edu.vn',
      role: 'owner',
      name: 'Chủ sở hữu'
    });

    const supervisors = generateMockSupervisors();
    const rounds = generateMockRounds();
    const students = generateMockStudents(supervisors);

    console.log(`Writing 12 Supervisors to Master Collection (supervisorMaster)...`);
    for (const s of supervisors) {
      await setDoc(doc(db, 'supervisorMaster', s.id), s);
    }
    console.log(`✓ Seeded ${supervisors.length} supervisors to supervisorMaster.`);

    for (const round of rounds) {
      console.log(`\nSetting up Round: ${round.title} (${round.id})...`);
      await setDoc(doc(db, 'graduationRounds', round.id), round);

      // Seed round supervisors subcollection
      for (const s of supervisors) {
        await setDoc(doc(db, 'graduationRounds', round.id, 'supervisors', s.id), {
          id: s.id,
          supervisorId: s.id,
          name: s.name,
          email: s.email,
          department: s.department,
          capacity: s.capacity,
          acceptedCount: 0,
          activeInRound: true
        });
      }
      console.log(`✓ Seeded ${supervisors.length} supervisors in round roster.`);

      // If active DATN round, seed students
      if (round.id === 'round_test_datn_2027') {
        console.log(`Writing 60 Students with 3-Round preferences...`);
        for (const st of students) {
          await setDoc(doc(db, 'graduationRounds', round.id, 'registrations', st.studentId), st);
          await setDoc(doc(db, 'graduationRounds', round.id, 'eligibleStudents', st.studentId), {
            studentId: st.studentId,
            fullName: st.studentName,
            className: st.className,
            email: st.email,
            eligible: true,
            joinMethod: st.joinMethod
          });
        }
        console.log(`✓ Seeded ${students.length} students to registrations & eligibleStudents.`);
      }
    }

    console.log('\n======================================================');
    console.log('✅ SEED COMPLETED SUCCESSFULLY');
    console.log('------------------------------------------------------');
    console.log(`• Rounds Seeded:      ${rounds.length} (DATN 2027 Test, DATH 2028 Test)`);
    console.log(`• Supervisors Seeded: ${supervisors.length} (Quotas: 0, 5, 10)`);
    console.log(`• Students Seeded:    ${students.length} (MSSV: 99200001 → 99200060)`);
    console.log('• Rule 3.5 Ready:     SV 14 has NV2 = FULL sup_01 -> will skip to NV3');
    console.log('• Rule 3.6 Ready:     SV 15 has NV2 & NV3 = Quota 0 -> will route to Khoa');
    console.log('======================================================\n');
  });

  await env.cleanup();
}

if (require.main === module) {
  seedTestData().catch(err => {
    console.error('\n❌ SEED FAILED:', err.message);
    process.exit(1);
  });
}

module.exports = { seedTestData };
