/**
 * scripts/rebuild-graduation-auth-indexes.cjs
 * IFA+ GRADUATION BETA — v2.3.3
 * 
 * DRY-RUN TOOL FOR PROJECTING BUSINESS DATA TO AUTHORIZATION INDEX DOCS
 * Default: DRY_RUN = true (0 mutations)
 */

const DRY_RUN = process.env.DRY_RUN !== 'false';

console.log('=== IFA+ GRADUATION: AUTHORIZATION INDEX REBUILD TOOL ===');
console.log('Mode: ' + (DRY_RUN ? 'DRY-RUN (Safe, 0 mutations)' : 'LIVE MUTATION (Pending Human Approval)'));

/**
 * Scan a graduation round object and project its nested business assignments
 * into lightweight Authorization Index Documents.
 */
function projectRoundAuthIndexes(round) {
  const roundId = round.id || 'unknown_round';
  const projections = {
    councilMemberships: [],
    councilStudentAssignments: [],
    councilAccess: [],
    supervisorAssignments: [],
    reviewerAssignmentsAuth: [],
    preliminaryScorers: [],
    activityAccess: []
  };

  const report = {
    roundId,
    wouldCreate: 0,
    wouldUpdate: 0,
    wouldDeactivate: 0,
    conflicts: []
  };

  // 1. Council Memberships, Student Assignments & Council Access
  const activities = round.activities || {};
  Object.keys(activities).forEach(actId => {
    const act = activities[actId];
    
    // Activity Access Projection
    projections.activityAccess.push({
      id: actId,
      path: `graduationRounds/${roundId}/activityAccess/${actId}`,
      data: {
        activityId: actId,
        submissionEnabled: Boolean(act.submissionConfig?.enabled ?? act.enableSubmission ?? true),
        supervisorCanView: Boolean(act.fileVisibility?.supervisor ?? true),
        reviewerCanView: Boolean(act.fileVisibility?.reviewer ?? true),
        councilCanView: Boolean(act.fileVisibility?.council ?? true),
        scoringEnabled: Boolean(act.enableScoring ?? true),
        updatedAt: new Date().toISOString()
      }
    });

    const councils = act.councils || {};
    Object.keys(councils).forEach(cId => {
      const council = councils[cId];
      const councilAccessId = `${actId}_${cId}`;

      // Council Access Projection
      projections.councilAccess.push({
        id: councilAccessId,
        path: `graduationRounds/${roundId}/councilAccess/${councilAccessId}`,
        data: {
          roundId,
          activityId: actId,
          councilId: cId,
          status: council.status || 'preparing',
          updatedAt: new Date().toISOString()
        }
      });

      // Council Chair
      if (council.chairEmail) {
        const chairId = `${actId}_${cId}_${council.chairEmail}`;
        projections.councilMemberships.push({
          id: chairId,
          path: `graduationRounds/${roundId}/councilMemberships/${chairId}`,
          data: {
            roundId,
            activityId: actId,
            councilId: cId,
            memberEmail: council.chairEmail,
            role: 'chair',
            active: true,
            updatedAt: new Date().toISOString()
          }
        });
      }

      // Council Members
      const members = council.members || [];
      members.forEach((m, idx) => {
        const email = typeof m === 'string' ? m : (m.email || m.memberEmail);
        if (email) {
          const memId = `${actId}_${cId}_${email}`;
          projections.councilMemberships.push({
            id: memId,
            path: `graduationRounds/${roundId}/councilMemberships/${memId}`,
            data: {
              roundId,
              activityId: actId,
              councilId: cId,
              memberEmail: email,
              role: m.role || 'member',
              slotKey: m.slotKey || ('mem_' + (idx + 1)),
              active: true,
              updatedAt: new Date().toISOString()
            }
          });
        }
      });

      // Council Students
      const students = council.students || council.assignedStudents || [];
      students.forEach(st => {
        const stId = typeof st === 'string' ? st : (st.studentId || st.mssv);
        if (stId) {
          const assignId = `${actId}_${stId}`;
          projections.councilStudentAssignments.push({
            id: assignId,
            path: `graduationRounds/${roundId}/councilStudentAssignments/${assignId}`,
            data: {
              roundId,
              activityId: actId,
              councilId: cId,
              studentId: String(stId),
              active: true,
              updatedAt: new Date().toISOString()
            }
          });
        }
      });
    });
  });

  // 2. Supervisor Assignments
  const supMap = round.supervisorAssignments || round.officialSupervisors || {};
  Object.keys(supMap).forEach(stId => {
    const entry = supMap[stId];
    const emails = [];
    if (typeof entry === 'string') emails.push(entry);
    else if (Array.isArray(entry)) emails.push(...entry);
    else if (entry?.supervisorEmail) emails.push(entry.supervisorEmail);
    if (entry?.supportSupervisorEmail) emails.push(entry.supportSupervisorEmail);

    if (emails.length > 0) {
      projections.supervisorAssignments.push({
        id: stId,
        path: `graduationRounds/${roundId}/supervisorAssignments/${stId}`,
        data: {
          studentId: stId,
          supervisorEmails: Array.from(new Set(emails)),
          updatedAt: new Date().toISOString()
        }
      });
    }
  });

  // 3. Reviewer Assignments
  const revMap = round.reviewerAssignments || {};
  Object.keys(revMap).forEach(stId => {
    const entry = revMap[stId];
    const revEmail = typeof entry === 'string' ? entry : entry?.reviewerEmail;
    if (revEmail) {
      projections.reviewerAssignmentsAuth.push({
        id: stId,
        path: `graduationRounds/${roundId}/reviewerAssignmentsAuth/${stId}`,
        data: {
          studentId: stId,
          reviewerEmail: revEmail,
          active: true,
          updatedAt: new Date().toISOString()
        }
      });
    }
  });

  // Count totals
  let totalDocs = 0;
  Object.keys(projections).forEach(col => {
    totalDocs += projections[col].length;
  });
  report.wouldCreate = totalDocs;

  return { projections, report };
}

// Dry-run simulation on mock round
const sampleRound = {
  id: 'round_2026_01',
  title: 'Đợt 1 - Khóa 2022',
  activities: {
    'act_def': {
      enableSubmission: true,
      fileVisibility: { supervisor: true, reviewer: true, council: true },
      councils: {
        'hd1': {
          status: 'active',
          chairEmail: 'chair1@tdtu.edu.vn',
          members: [
            { email: 'member1@tdtu.edu.vn', role: 'member' },
            { email: 'member2@tdtu.edu.vn', role: 'member' }
          ],
          students: ['12100314', '12100315']
        }
      }
    }
  },
  supervisorAssignments: {
    '12100314': { supervisorEmail: 'sup1@tdtu.edu.vn', supportSupervisorEmail: 'sup2@tdtu.edu.vn' }
  },
  reviewerAssignments: {
    '12100314': { reviewerEmail: 'rev1@tdtu.edu.vn' }
  }
};

const result = projectRoundAuthIndexes(sampleRound);
console.log('\n[DRY RUN AUDIT SUMMARY]');
console.log('Target Round: ' + result.report.roundId);
console.log('Projected Council Memberships: ' + result.projections.councilMemberships.length);
console.log('Projected Council Student Assignments: ' + result.projections.councilStudentAssignments.length);
console.log('Projected Council Access / Status: ' + result.projections.councilAccess.length);
console.log('Projected Supervisor Assignments: ' + result.projections.supervisorAssignments.length);
console.log('Projected Reviewer Assignments: ' + result.projections.reviewerAssignmentsAuth.length);
console.log('Projected Activity Access: ' + result.projections.activityAccess.length);
console.log('Total Projected Index Documents: ' + result.report.wouldCreate);
console.log('Database Mutations Executed: 0 (DRY_RUN = true)');

if (!DRY_RUN) {
  console.log('\nWARNING: Live mutation mode requires explicit owner approval.');
} else {
  console.log('\n✓ Dry-run completed cleanly without any database side effects.');
}
