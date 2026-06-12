const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A1:Z150'
        });
        const rows = res.data.values || [];
        rows.forEach(r => {
            if (r[1] && r[1].includes('_')) {
                console.log(`${r[1]} \t ${r[2]}`);
            }
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
