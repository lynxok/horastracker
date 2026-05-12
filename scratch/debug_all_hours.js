const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:\\Users\\ignac\\AppData\\Roaming\\tracker-de-horas\\session_data.json', 'utf8'));
const sessions = data.sessions;
const now = new Date('2026-05-12T10:58:43Z');

let totalSecs = 0;
sessions.forEach(s => {
    const sStart = new Date(s.startTime);
    const sEnd = s.endTime ? new Date(s.endTime) : now;
    const secs = Math.floor((sEnd - sStart) / 1000) - (s.totalPausedSeconds || 0);
    totalSecs += secs;
});

console.log(`Total hours ALL: ${totalSecs / 3600}`);
