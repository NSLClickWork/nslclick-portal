const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    try {
        // Find the rows for Quyen TRINH and Anh NGUYEN in CHECKLIST
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A1:E200'
        });
        const rows = res.data.values || [];

        const updates = [];
        rows.forEach((row, i) => {
            const id = row[1] || '';
            if (id === 'ANG_Quyen_TRINH_2006') {
                // Short Name (col D = index 3) should be "Quyen TRINH"
                const currentShortName = row[3];
                console.log(`Row ${i+1}: ${id} | Current Short Name: "${currentShortName}" → fixing to "Quyen TRINH"`);
                updates.push({ range: `CHECKLIST!D${i+1}`, values: [['Quyen TRINH']] });
            }
            if (id === 'ANG_Anh_NGUYEN_2006') {
                const currentShortName = row[3];
                console.log(`Row ${i+1}: ${id} | Current Short Name: "${currentShortName}" → fixing to "Anh NGUYEN"`);
                updates.push({ range: `CHECKLIST!D${i+1}`, values: [['Anh NGUYEN']] });
            }
        });

        if (updates.length === 0) {
            console.log('Could not find rows to update.');
            return;
        }

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });

        console.log(`✓ Fixed ${updates.length} Short Name(s). Done.`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
