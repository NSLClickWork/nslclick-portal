const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const fs = require('fs');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A1:Z600'
        });
        const rows = res.data.values || [];
        const candidates = JSON.parse(fs.readFileSync('extracted_candidates.json', 'utf8'));

        console.log('Searching for candidate IDs...');
        candidates.forEach(c => {
            const nameLower = c.Name.toLowerCase().trim();
            const foundRow = rows.find(r => r.some(cell => cell && cell.toLowerCase().trim() === nameLower));
            if (foundRow) {
                // ID is in column B (index 1)
                console.log(`Found ${c.Name}: ${foundRow[1]}`);
            } else {
                console.log(`NOT FOUND: ${c.Name}`);
            }
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
