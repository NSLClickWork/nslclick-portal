const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        const sheetNames = meta.data.sheets.map(s => s.properties.title);
        console.log('Sheets:', sheetNames);

        for (const name of sheetNames) {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:Z5`
            });
            console.log(`\n--- Sheet: ${name} ---`);
            const rows = res.data.values;
            if (rows && rows.length > 0) {
                rows.slice(0, 3).forEach((r, i) => {
                    console.log(`Row ${i + 1}:`, r.slice(0, 15));
                });
            } else {
                console.log('Empty sheet');
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
