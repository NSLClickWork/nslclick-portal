/**
 * fix_wrong_video_col.js
 * Clears wrongly-written video links from col N (Skill Centre - Video Recording)
 * for students who got video written there by scan_drive_setcards.js.
 * Safe: only clears col N if it has a Google Drive link. Does NOT touch col BG.
 */
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

function colLetter(col) {
    let letter = '', temp = col + 1;
    while (temp > 0) { const r = (temp-1)%26; letter = String.fromCharCode(65+r)+letter; temp = Math.floor((temp-1)/26); }
    return letter;
}

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:BH200'
    });
    const rows = res.data.values || [];
    const hdrIdx = rows.findIndex(r => r && r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
    const hdrs = rows[hdrIdx];
    
    const wrongVideoCol = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'skill centre - video recording');
    console.log(`Wrong video col (to clear): ${wrongVideoCol} = ${colLetter(wrongVideoCol)} = "${hdrs[wrongVideoCol]}"`);
    
    const updates = [];
    for (let i = hdrIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const id = row[1] || '';
        if (!id) continue;
        const wrongVal = row[wrongVideoCol] || '';
        if (wrongVal && wrongVal.includes('drive.google.com')) {
            const r = i + 1;
            updates.push({ range: `CHECKLIST!${colLetter(wrongVideoCol)}${r}`, values: [['']] });
            console.log(`  Clear col N row ${r}: ${id}`);
        }
    }
    
    if (updates.length === 0) { console.log('Nothing to clear.'); return; }
    
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
    });
    console.log(`\n✓ Cleared ${updates.length} wrong video cells from col ${colLetter(wrongVideoCol)}.`);
    console.log('Now run: node scan_drive_setcards.js  (to re-write to correct col BG)');
}
run().catch(e => console.error('Error:', e.message));
