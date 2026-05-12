const { isWithinInterval, parseISO } = require('date-fns');

const start = new Date('2026-05-01T00:00:00Z');
const end = new Date('2026-05-31T23:59:59Z');

console.log(`Test 1: ${isWithinInterval(new Date('2026-05-12T10:00:00Z'), { start, end })}`);
console.log(`Test 2: ${isWithinInterval(new Date('2026-04-12T10:00:00Z'), { start, end })}`);
console.log(`Test 3: ${isWithinInterval(new Date('invalid'), { start, end })}`);
