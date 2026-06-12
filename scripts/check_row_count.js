const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const targetSheets = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL', 'HDEU', 'Sales-Baker-Butcher'];
        for (const name of targetSheets) {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:Z600`
            });
            const rows = res.data.values || [];
            console.log(`Sheet: ${name}, Total rows: ${rows.length}`);
            if (rows.length > 0) {
                // Print the last row
                console.log(`Last row index: ${rows.length - 1}, content:`, rows[rows.length - 1].slice(0, 10));
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
