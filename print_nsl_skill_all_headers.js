const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-SKILL!A6:ZZ6'
        });
        const headers = res.data.values[0];
        console.log('All NSL-SKILL columns:');
        headers.forEach((h, i) => {
            console.log(`Col ${i} [${colLetter(i)}]: ${h || ''}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

function colLetter(i) {
    let letter = '';
    let temp = i;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

run();
