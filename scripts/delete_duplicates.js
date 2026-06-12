const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const targetIds = ['HDEU_KHOA_NGUYEN_2002', 'EI_LINH_LE_2004'];
    const tabs = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL'];

    try {
        for (const name of tabs) {
            console.log(`Cleaning duplicates in sheet: ${name}...`);
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:Z600`
            });
            const rows = res.data.values || [];
            
            // Find header row index
            let headerIdx = rows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
            if (headerIdx === -1) headerIdx = 2; // Default to row 3 (0-indexed 2)

            const hdrs = rows[headerIdx] || [];
            const idColIdx = hdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');

            if (idColIdx === -1) {
                console.log(`StudentID column not found in ${name}, skipping.`);
                continue;
            }

            const headerRows = rows.slice(0, headerIdx + 1);
            const dataRows = rows.slice(headerIdx + 1);

            const filteredDataRows = dataRows.filter(row => {
                if (!row || row.length === 0) return false;
                const idVal = (row[idColIdx] || '').trim().toUpperCase();
                return !targetIds.includes(idVal);
            });

            // Adjust 'No' column (index 0) if CHECKLIST
            let noCounter = 1;
            filteredDataRows.forEach(row => {
                if (row.length > 0 && name === 'CHECKLIST') {
                    row[0] = String(noCounter++);
                }
            });

            const updatedRows = [...headerRows, ...filteredDataRows];

            // Clear sheet
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:ZZ600`
            });

            // Write back
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: updatedRows }
            });
            console.log(`Cleaned sheet ${name}. Remaining rows: ${updatedRows.length}`);
        }
        console.log('\nSUCCESS: Duplicates Khoa Nguyen and Linh Le deleted successfully.');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
