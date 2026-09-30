// One-off, council-scoped migration. Dry-run by default; --apply writes only
// the minimal student identity needed by authenticated council members.
const { Client } = require('firebase-tools/lib/apiv2');
const firebaseAuth = require('firebase-tools/lib/auth');

const project = 'ifa-graduation';
const code = process.argv.find(arg => arg.startsWith('--code='))?.slice(7);
const apply = process.argv.includes('--apply');
if (!code) throw new Error('Pass --code=<council short code>');

firebaseAuth.setActiveAccount({}, firebaseAuth.getGlobalDefaultAccount());
const client = new Client({ auth: true, apiVersion: 'v1', urlPrefix: 'https://firestore.googleapis.com' });
const base = `projects/${project}/databases/(default)/documents`;

function decode(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [key, decode(nested)]));
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  return null;
}
const fields = document => Object.fromEntries(Object.entries(document?.fields || {}).map(([key, value]) => [key, decode(value)]));
const string = value => ({ stringValue: String(value || '') });

async function get(path) {
  try { return fields((await client.get(`${base}/${path}`)).body); }
  catch (err) { if (err.status === 404 || err.statusCode === 404) return null; throw err; }
}

async function main() {
  const response = await client.get(`${base}/graduationRounds?pageSize=100`);
  const rounds = response.body.documents || [];
  const matches = [];
  for (const roundDoc of rounds) {
    const round = fields(roundDoc);
    for (const activity of round.activities || []) {
      for (const council of activity.councils || []) {
        if ([council.shortCode, council.code, council.slug, council.id].some(value => String(value || '').toLowerCase() === code.toLowerCase())) {
          matches.push({ roundId: roundDoc.name.split('/').pop(), round, activity, council });
        }
      }
    }
  }
  if (matches.length !== 1) throw new Error(`Expected exactly one council for ${code}; found ${matches.length}`);
  const { roundId, round, activity, council } = matches[0];
  const assignments = (activity.councilStudentAssignments || []).filter(item => item.councilId === council.id);
  const members = Object.values(council.membersBySlot || {});
  const membershipChecks = await Promise.all(members.map(async item => ({
    name: item.memberName || '',
    email: item.memberEmail || '',
    indexed: Boolean(await get(`graduationRounds/${roundId}/councilMemberships/${activity.id}_${council.id}_${String(item.memberEmail || '').toLowerCase().trim()}`))
  })));
  console.log(JSON.stringify({ roundId, activityId: activity.id, councilId: council.id,
    students: assignments.length, members: membershipChecks }));

  const writes = [];
  for (const assignment of assignments) {
    const studentId = String(assignment.studentId || '');
    if (!studentId) continue;
    const [registration, official, eligible] = await Promise.all([
      get(`graduationRounds/${roundId}/registrations/${studentId}`),
      get(`graduationRounds/${roundId}/officialAssignments/${studentId}`),
      get(`graduationRounds/${roundId}/eligibleStudents/${studentId}`)
    ]);
    const topicReg = round.topicRegistrations?.[studentId] || {};
    const stored = await get(`graduationRounds/${roundId}/councilStudentAssignments/${activity.id}_${studentId}`);
    const fullName = registration?.studentName || registration?.fullName || official?.studentName || official?.fullName || eligible?.fullName || eligible?.name || assignment.studentName || assignment.fullName || '';
    const topicTitle = registration?.topicTitle || official?.topicTitle || topicReg.topicTitle || topicReg.topic || assignment.topicTitle || '';
    const supervisorName = official?.acceptedSupervisorName || official?.supervisorName || registration?.acceptedSupervisorName || registration?.supervisorName || assignment.supervisorName || '';
    const path = `${base}/graduationRounds/${roundId}/councilStudentAssignments/${activity.id}_${studentId}`;
    console.log(JSON.stringify({ studentId, hasName: Boolean(fullName), hasTopic: Boolean(topicTitle), hasSupervisor: Boolean(supervisorName),
      storedSummary: Boolean(stored?.fullName && stored?.topicTitle && stored?.supervisorName) }));
    if (!fullName || !topicTitle) continue;
    writes.push({ update: { name: path, fields: {
      roundId: string(roundId), activityId: string(activity.id), councilId: string(council.id),
      studentId: string(studentId), fullName: string(fullName), topicTitle: string(topicTitle),
      supervisorName: string(supervisorName), active: { booleanValue: true },
      updatedAt: string(new Date().toISOString())
    } } });
  }
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', ready: writes.length, total: assignments.length }));
  if (apply) {
    if (writes.length !== assignments.length) throw new Error('Some student summaries are incomplete; nothing written');
    await client.post(`${base}:commit`, { writes });
    console.log(`Updated ${writes.length} council student summaries.`);
  }
}
main().catch(err => { console.error(err.message || err); process.exitCode = 1; });
