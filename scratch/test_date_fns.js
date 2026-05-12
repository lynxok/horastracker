const { differenceInSeconds, parseISO } = require('date-fns');

const d1 = parseISO('2026-05-01T12:00:00Z');
const d2 = parseISO('2026-05-01T13:00:00Z');

console.log(`Difference in seconds: ${differenceInSeconds(d2, d1)}`);
console.log(`Difference in ms: ${d2.getTime() - d1.getTime()}`);
