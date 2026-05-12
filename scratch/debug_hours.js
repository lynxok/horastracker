const fs = require('fs');
const { parseISO, differenceInSeconds, isWithinInterval, startOfMonth, endOfMonth } = require('date-fns');

const data = JSON.parse(fs.readFileSync('C:\\Users\\ignac\\AppData\\Roaming\\tracker-de-horas\\session_data.json', 'utf8'));
const sessions = data.sessions;
const now = new Date('2026-05-12T07:58:43-03:00');
const start = startOfMonth(now);
const end = endOfMonth(now);

let totalSecs = 0;
sessions.forEach(s => {
    const sStart = parseISO(s.startTime);
    const sEnd = s.endTime ? parseISO(s.endTime) : now;
    if (isWithinInterval(sStart, { start, end })) {
        const secs = differenceInSeconds(sEnd, sStart) - (s.totalPausedSeconds || 0);
        console.log(`Session ${s.id}: ${secs}s (${secs/3600}h)`);
        totalSecs += secs;
    }
});

console.log(`Total hours: ${totalSecs / 3600}`);
