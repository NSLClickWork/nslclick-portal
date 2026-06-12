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
        
        const targetSheets = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL', 'HDEU'];
        
        for (const name of targetSheets) {
            if (!sheetNames.includes(name)) continue;
            
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:ZZ10`
            });
            const rows = res.data.values;
            if (!rows || rows.length === 0) continue;

            let headerIdx = rows.findIndex(row => row.some(cell => {
                if (!cell) return false;
                const c = cell.trim().toLowerCase().replace(/\s/g, '');
                return c === 'studentid' || c === 'studentname' || c === 'id' || c === 'fullname';
            }));
            
            if (headerIdx === -1) {
                headerIdx = rows.findIndex(row => row.filter(cell => cell && cell.trim() !== '').length >= 3);
            }
            
            if (headerIdx !== -1) {
                console.log(`\n=== Tab: ${name} (Header Row Index: ${headerIdx + 1}) ===`);
                const colLetter = (i) => {
                    let letter = '';
                    let temp = i;
                    while (temp >= 0) {
                        letter = String.fromCharCode((temp % 26) + 65) + letter;
                        temp = Math.floor(temp / 26) - 1;
                    }
                    return letter;
                };
                const headers = rows[headerIdx].map((h, i) => `Col ${i} [${colLetter(i)}]: ${h || ''}`);
                // Print all non-empty headers
                console.log(headers.filter(h => !h.endsWith(': ')));
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
