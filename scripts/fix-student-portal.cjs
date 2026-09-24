const fs = require('fs');
let s = fs.readFileSync('js/students/student-portal.js', 'utf8');
s = s.replace(
  'const activeTitle = (typeof resolveRoundWeekTitle === \'function\') ? resolveRoundWeekTitle(currentWeekNum, (weeklyConfigLocal.find(c => c.week === currentWeekNum) || {}).title) : Tuần \\;',
  'const activeTitle = (typeof resolveRoundWeekTitle === \'function\') ? resolveRoundWeekTitle(currentWeekNum, (weeklyConfigLocal.find(c => c.week === currentWeekNum) || {}).title) : (\'Tuần \' + currentWeekNum);'
);
fs.writeFileSync('js/students/student-portal.js', s, 'utf8');
console.log('Fixed line 435 in student-portal.js');
