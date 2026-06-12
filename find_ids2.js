const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const fs = require('fs');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A1:Z200' // search up to 200 rows
        });
        const rows = res.data.values || [];
        const candidates = JSON.parse(fs.readFileSync('extracted_candidates.json', 'utf8'));

        console.log('Searching for original candidate IDs...');
        candidates.forEach(c => {
            const parts = normalize(c.Name).split(' ');
            const foundRow = rows.find(r => {
                const sheetName = normalize(r[2]); // Student Name is at index 2
                // We only want original rows, let's say original rows have No < 120 or they have full name
                // To avoid matching our newly appended rows, let's check if the ID has 2 dots (e.g. 01.06.2005)
                if (!r[1]) return false;
                const isOriginal = (r[1].match(/\./g) || []).length === 2; 
                
                return isOriginal && parts.every(p => sheetName.includes(p));
            });
            if (foundRow) {
                console.log(`Found ${c.Name} -> Sheet Name: ${foundRow[2]} | ID: ${foundRow[1]}`);
            } else {
                console.log(`NOT FOUND: ${c.Name}`);
            }
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
