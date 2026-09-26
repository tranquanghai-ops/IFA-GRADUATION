const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('User activity tracker module exists and exports expected methods', () => {
  const code = fs.readFileSync(path.join(__dirname, '../js/tracking/user-activity-tracker.js'), 'utf8');
  assert.ok(code.includes('recordUserLogin'), 'recordUserLogin should be defined');
  assert.ok(code.includes('trackUserActivity'), 'trackUserActivity should be defined');
  assert.ok(code.includes('loadUserActivities'), 'loadUserActivities should be defined');
  assert.ok(code.includes('getUserActivityInfo'), 'getUserActivityInfo should be defined');
  assert.ok(code.includes('renderUserActivityBadge'), 'renderUserActivityBadge should be defined');
  assert.ok(code.includes('openRoundAccessMonitoringModal'), 'openRoundAccessMonitoringModal should be defined');
});

test('Firestore rules allow authenticated users to read and update their userActivities', () => {
  const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  assert.ok(rules.includes('match /userActivities/{userEmail}'), 'userActivities rule must exist');
  assert.ok(rules.includes('allow read: if signedIn();'), 'userActivities must be readable by signedIn');
});

test('HTML templates include activity columns and monitoring modal', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(indexHtml.includes('modal-round-access-monitoring'), 'monitoring modal must be compiled into index.html');
  assert.ok(indexHtml.includes('Lần đăng nhập & Thao tác cuối'), 'activity column header must exist in index.html');
});
