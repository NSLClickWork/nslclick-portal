const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sales-Baker-Butcher!A1:Z30'
        });
        console.log('=== Sales-Baker-Butcher Sheet ===');
        const rows = res.data.values || [];
        rows.forEach((r, i) => {
            console.log(`Row ${i + 1}:`, r.slice(0, 10));
        });
    } catch (e) {
        console.error(e.message);
    }
}

run();
