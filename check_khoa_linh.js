const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

function norm(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z]/g, '');
}

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
            
            console.log(`\n=== Tab: ${tab} ===`);
            rows.forEach((r, i) => {
                if (!r || r.length === 0) return;
                const matchesKhoa = r.some(cell => cell && norm(cell).includes('khoanguyen'));
                const matchesLinh = r.some(cell => cell && norm(cell).includes('linhle'));
                
                if (matchesKhoa || matchesLinh) {
                    console.log(`Row ${i + 1}:`, r.slice(0, 10));
                }
            });
        }
    } catch (e) {
        console.error(e.message);
    }
}

run();
