const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const targetSheets = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL', 'HDEU'];
        for (const name of targetSheets) {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:Z15`,
                valueRenderOption: 'FORMULA'
            });
            console.log(`\n=== Tab: ${name} ===`);
            const rows = res.data.values;
            if (rows && rows.length > 0) {
                rows.slice(0, 8).forEach((r, i) => {
                    console.log(`Row ${i + 1}:`, r.slice(0, 10));
                });
            } else {
                console.log('Empty or not found');
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
