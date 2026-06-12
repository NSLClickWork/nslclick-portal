const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

const newIdsToDelete = [
    'ANG_Phu_NGUYEN', 'ANG_Binh_DUONG', 'ANG_Thai_NGO', 'ANG_Huyen_PHAM', 'ANG_Trang_BUI',
    'HDEU_Phuong_NGUYEN', 'HDEU_Nghia_HUYNH', 'HDEU_Khoi_DOAN', 'HDEU_Quynh_TRAN',
    'EI_Quyen_TRINH', 'EI_Anh_NGUYEN'
];

const originalScores = {
    'ANG_Hoang_TRAN_01.06.2005': { score: '', grade: '' },
    'ANG_Long_DOAN_20.04.2006': { score: '48', grade: 'B' },
    'ANG_Thai_THAN_21.11.2002': { score: '', grade: '' },
    'ANG_Thi_NGUYEN_19.05.2006': { score: '0', grade: '0' },
    'ANG_Nhi_PHAM_18.01.2005': { score: '', grade: '' }
};

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    // Get sheet metadata for IDs
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const clSheetId = metaRes.data.sheets.find(s => s.properties.title === 'CHECKLIST').properties.sheetId;
    const asSheetId = metaRes.data.sheets.find(s => s.properties.title === 'NSL-ASSESS').properties.sheetId;

    let deleteRequests = [];
    let valueUpdates = [];

    // --- REVERT CHECKLIST ---
    const clRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:Z' });
    const clRows = clRes.data.values;
    const clHdrIdx = clRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
    const clIdCol = clRows[clHdrIdx].findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');

    let clIndicesToDelete = [];
    for (let i = 0; i < clRows.length; i++) {
        if (clRows[i] && newIdsToDelete.includes(clRows[i][clIdCol])) {
            clIndicesToDelete.push(i);
        }
    }
    clIndicesToDelete.sort((a, b) => b - a); // Sort descending
    for (let idx of clIndicesToDelete) {
        deleteRequests.push({
            deleteDimension: { range: { sheetId: clSheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
        });
    }

    // --- REVERT NSL-ASSESS ---
    const asRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:Z' });
    const asRows = asRes.data.values;
    const asHdrIdx = asRows.findIndex(r => r.some(c => c && c.trim() === 'STUDENT ID'));
    const asIdCol = asRows[asHdrIdx].indexOf('STUDENT ID');
    const asScoreCol = asRows[asHdrIdx].indexOf('NSL SCORE');
    const asGradeCol = asRows[asHdrIdx].indexOf('NSL GRADE');

    let asIndicesToDelete = [];
    for (let i = asHdrIdx + 1; i < asRows.length; i++) {
        if (!asRows[i]) continue;
        const sid = asRows[i][asIdCol];

        if (newIdsToDelete.includes(sid)) {
            asIndicesToDelete.push(i);
        } else if (originalScores[sid]) {
            const orig = originalScores[sid];
            console.log('Restoring existing student', sid, 'to Score:', orig.score, 'Grade:', orig.grade);
            valueUpdates.push({
                range: `NSL-ASSESS!${String.fromCharCode(65 + asScoreCol)}${i+1}:${String.fromCharCode(65 + asGradeCol)}${i+1}`,
                values: [[orig.score, orig.grade]]
            });
        }
    }

    asIndicesToDelete.sort((a, b) => b - a); // Sort descending
    for (let idx of asIndicesToDelete) {
        deleteRequests.push({
            deleteDimension: { range: { sheetId: asSheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
        });
    }

    // Execute Value Updates (Revert scores)
    if (valueUpdates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data: valueUpdates }
        });
        console.log(`Reverted scores for ${valueUpdates.length} existing candidates.`);
    }

    // Execute Deletions (Remove appended rows)
    if (deleteRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests: deleteRequests }
        });
        console.log(`Deleted ${clIndicesToDelete.length} rows from CHECKLIST and ${asIndicesToDelete.length} rows from NSL-ASSESS.`);
    }

    console.log('Revert to original state completed successfully!');
}
run();
