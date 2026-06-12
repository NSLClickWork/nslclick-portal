const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        console.log('--- NSL-SKILL ---');
        const resSk = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-SKILL!A112:J125'
        });
        const rowsSk = resSk.data.values;
        if (rowsSk) {
            rowsSk.forEach((r, i) => {
                console.log(`Row ${112 + i}:`, r);
            });
        }

        console.log('\n--- NSL-ASSESS ---');
        const resAs = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-ASSESS!A112:D125'
        });
        const rowsAs = resAs.data.values;
        if (rowsAs) {
            rowsAs.forEach((r, i) => {
                console.log(`Row ${112 + i}:`, r);
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
