const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-SKILL!A1:C200'
        });
        const rows = res.data.values || [];
        const updates = [];

        rows.forEach((row, i) => {
            const id = row[1] || '';
            // NSL-SKILL SHORT NAME = last_word(D) + " " + UPPER(first_word(D))
            // D is auto-computed from C (remove accents). So to get "Quyen TRINH", 
            // store C as "TRINH Quyen" → D="TRINH Quyen" → first="TRINH", last="Quyen" → "Quyen TRINH"
            if (id === 'ANG_Quyen_TRINH_2006') {
                console.log(`Row ${i+1}: fixing "${row[2]}" → "TRINH Quyen"`);
                updates.push({ range: `NSL-SKILL!C${i+1}`, values: [['TRINH Quyen']] });
            }
            if (id === 'ANG_Anh_NGUYEN_2006') {
                console.log(`Row ${i+1}: fixing "${row[2]}" → "NGUYEN Anh"`);
                updates.push({ range: `NSL-SKILL!C${i+1}`, values: [['NGUYEN Anh']] });
            }
        });

        if (updates.length === 0) { console.log('Not found.'); return; }

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
        });
        console.log(`✓ Fixed ${updates.length} name(s) in NSL-SKILL. Formula will now show correct Short Name.`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
