const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!B4:B150'
        });
        const ids = res.data.values ? res.data.values.map(r => r[0]) : [];
        console.log('Sample IDs from sheet:');
        ids.slice(0, 30).forEach(id => console.log(id));
        
        console.log('\nIDs that do not end with a full date (DD.MM.YYYY):');
        const nonStandardIds = ids.filter(id => id && !/\d{2}\.\d{2}\.\d{4}$/.test(id));
        console.log(nonStandardIds);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
