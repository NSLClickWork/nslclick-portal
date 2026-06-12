const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

// Correct Short Names for all restored candidates
// Names in extracted_candidates.json are already "Given FAMILY" format - use directly
const correctShortNames = {
    'HDEU_PHUONG_NGUYEN_1995': 'Phuong NGUYEN',
    'EI_QUYNH_TRAN_1998':      'Quynh TRAN',
    'ANG_PHU_NGUYEN_2006':     'Phu NGUYEN',
    'ANG_LONG_DOAN_2006':      'Long DOAN',
    'ANG_DUONG_BINH_2005':     'Binh DUONG',
    'ANG_HOANG_TRAN_2005':     'Hoang TRAN',
    'ANG_THAI_THAN_2002':      'Thai THAN',
    'ANG_THAI_NGO_2006':       'Thai NGO',
    'ANG_THI_NGUYEN_2006':     'Thi NGUYEN',
    'ANG_HUYEN_PHAM_2005':     'Huyen PHAM',
    'ANG_TRANG_BUI_2005':      'Trang BUI',
    'ANG_NHI_PHAM_2005':       'Nhi PHAM',
    'ANG_Quyen_TRINH_2006':    'Quyen TRINH',
    'ANG_Anh_NGUYEN_2006':     'Anh NGUYEN',
};

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-SKILL!A1:J200'
        });
        const rows = res.data.values || [];
        const updates = [];

        rows.forEach((row, i) => {
            const id = row[1] || '';
            if (correctShortNames[id]) {
                const currentShortName = row[9] || '';
                const newShortName = correctShortNames[id];
                if (currentShortName !== newShortName) {
                    console.log(`Row ${i+1}: [${id}] "${currentShortName}" → "${newShortName}"`);
                    // Column J = index 9 = 10th col
                    updates.push({ range: `NSL-SKILL!J${i+1}`, values: [[newShortName]] });
                } else {
                    console.log(`Row ${i+1}: [${id}] already correct: "${currentShortName}"`);
                }
            }
        });

        if (updates.length === 0) { console.log('Nothing to update.'); return; }

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
        });
        console.log(`\n✓ Fixed ${updates.length} SHORT NAME(s) in NSL-SKILL column J.`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
