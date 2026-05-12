const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:\\Users\\ignac\\AppData\\Roaming\\tracker-de-horas\\session_data.json', 'utf8'));
const sessions = data.sessions;
const now = new Date('2026-05-12T10:58:43Z'); // Current UTC time approx
const start = new Date('2026-05-01T00:00:00Z');
const end = new Date('2026-05-31T23:59:59Z');

let totalSecs = 0;
sessions.forEach(s => {
    const sStart = new Date(s.startTime);
    const sEnd = s.endTime ? new Date(s.endTime) : now;
    if (sStart >= start && sStart <= end) {
        const secs = Math.floor((sEnd - sStart) / 1000) - (s.totalPausedSeconds || 0);
        console.log(`Session ${s.id}: ${secs}s (${(secs/3600).toFixed(2)}h) - Start: ${s.startTime} - End: ${s.endTime || 'NOW'}`);
        totalSecs += secs;
    }
});

console.log(`Total hours: ${totalSecs / 3600}`);
