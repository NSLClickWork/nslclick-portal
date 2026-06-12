const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const tabs = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL', 'HDEU'];
    
    try {
        for (const tab of tabs) {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tab}!A1:Z600`
            });
            const rows = res.data.values || [];
            rows.forEach((r, i) => {
                if (r.some(cell => cell && cell.trim().toUpperCase() === 'ANG__NEW')) {
                    console.log(`Found ANG__NEW in Tab: ${tab} at Row ${i + 1}:`, r.slice(0, 10));
                }
            });
        }
    } catch (e) {
        console.error(e.message);
    }
}

run();
