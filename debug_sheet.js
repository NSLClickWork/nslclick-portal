require('dotenv').config();
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'NSL-ASSESS!A:ZZ'
    });
    const rows = res.data.values;
    const header = rows[0];
    const idIdx = header.findIndex(h => h.trim().toLowerCase().replace(/\s/g, '') === 'studentid');
    
    console.log("Headers:", header.filter(h => h));
    const matches = rows.filter(r => r.some(c => typeof c === 'string' && c.toLowerCase().includes('quyen')));
    console.log('Rows matching quyen in NSL-ASSESS:');
    matches.forEach(row => {
        console.log(`StudentID: ${row[idIdx]}`);
        console.log(row.join(' | '));
    });
}
run().catch(console.error);
