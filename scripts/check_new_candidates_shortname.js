const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A110:E125'
        });
        const rows = res.data.values;
        if (rows && rows.length > 0) {
            rows.forEach((r, i) => {
                console.log(`Row ${110 + i}:`, r);
            });
        } else {
            console.log('No rows found');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
