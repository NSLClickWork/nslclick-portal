const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

// Convert 0-indexed column number to A1 letter (A=0, Z=25, AA=26, BA=52, ...)
function colToLetter(col) {
    let letter = '';
    let temp = col + 1;
    while (temp > 0) {
        const rem = (temp - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    return letter;
}


// Map: fakeId -> realId, with data to copy from fake to real
const duplicates = [
    {
        fakeId: 'ANG_NHI_PHAM_2005',
        realId:  'ANG_Nhi_PHAM_18.01.2005',
    },
    {
        fakeId: 'ANG_HOANG_TRAN_2005',
        realId:  'ANG_Hoang_TRAN_01.06.2005',
    },
    {
        fakeId: 'ANG_THAI_THAN_2002',
        realId:  'ANG_Thai_THAN_21.11.2002',
    },
];

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    // Get spreadsheet metadata for sheet IDs
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const getSheetId = name => meta.data.sheets.find(s => s.properties.title === name).properties.sheetId;
    const clSheetId = getSheetId('CHECKLIST');
    const asSheetId = getSheetId('NSL-ASSESS');
    const skSheetId = getSheetId('NSL-SKILL');

    // Fetch all sheets data
    const [clRes, asRes, skRes] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:BH300' }),
        sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:Z300' }),
        sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A1:CG300' }),
    ]);
    const clRows = clRes.data.values || [];
    const asRows = asRes.data.values || [];
    const skRows = skRes.data.values || [];

    const valueUpdates = [];
    const deleteRequests = [];

    for (const dup of duplicates) {
        const fakeIdUp = dup.fakeId.toUpperCase();
        const realIdUp = dup.realId.toUpperCase();

        // --- CHECKLIST ---
        const fakeClIdx = clRows.findIndex(r => r[1] && r[1].toUpperCase() === fakeIdUp);
        const realClIdx = clRows.findIndex(r => r[1] && r[1].toUpperCase() === realIdUp);

        if (fakeClIdx === -1) { console.log(`[CL] Fake not found: ${dup.fakeId}`); continue; }
        if (realClIdx === -1) { console.log(`[CL] Real not found: ${dup.realId}`); continue; }

        const fakeClRow = clRows[fakeClIdx];
        const realClRow = clRows[realClIdx];

        console.log(`\n[${dup.fakeId}] → [${dup.realId}]`);

        // Copy useful fields from fake to real (only if real is empty):
        // Col 27 (AB) = Candidate Cards (setcard link)
        // Col 52-54 (BA-BC) = Superpowers
        // Col 55 (BD) = Availability
        // Col 56 (BE) = Photo
        // Col 58 (BG) = Video
        const fieldsToCopy = [
            { colIdx: 27, name: 'Setcard Link' },
            { colIdx: 52, name: 'S1' },
            { colIdx: 53, name: 'S2' },
            { colIdx: 54, name: 'S3' },
            { colIdx: 55, name: 'Availability' },
            { colIdx: 56, name: 'Photo' },
            { colIdx: 58, name: 'Video' },
        ];

        for (const field of fieldsToCopy) {
            const fakeVal = fakeClRow[field.colIdx] || '';
            const realVal = realClRow[field.colIdx] || '';
            if (fakeVal && !realVal) {
                const colLetter = colToLetter(field.colIdx);
                const range = `CHECKLIST!${colLetter}${realClIdx + 1}`;
                console.log(`  Copy [${field.name}]: "${fakeVal.slice(0,50)}" → ${range}`);
                valueUpdates.push({ range, values: [[fakeVal]] });
            }
        }

        // Delete fake row from CHECKLIST
        console.log(`  Delete CHECKLIST row ${fakeClIdx + 1} (fake ${dup.fakeId})`);
        deleteRequests.push({
            deleteDimension: { range: { sheetId: clSheetId, dimension: 'ROWS', startIndex: fakeClIdx, endIndex: fakeClIdx + 1 } }
        });

        // --- NSL-ASSESS ---
        const fakeAsIdx = asRows.findIndex(r => r[1] && r[1].toUpperCase() === fakeIdUp);
        if (fakeAsIdx !== -1) {
            // Copy score/grade to real if empty
            const fakeAsRow = asRows[fakeAsIdx];
            const realAsIdx = asRows.findIndex(r => r[1] && r[1].toUpperCase() === realIdUp);
            if (realAsIdx !== -1) {
                const realAsRow = asRows[realAsIdx];
                if (fakeAsRow[16] && !realAsRow[16]) { // NSL SCORE col 16
                    valueUpdates.push({ range: `NSL-ASSESS!Q${realAsIdx + 1}`, values: [[fakeAsRow[16]]] });
                    console.log(`  Copy ASSESS Score: ${fakeAsRow[16]} → row ${realAsIdx+1}`);
                }
                if (fakeAsRow[17] && !realAsRow[17]) { // NSL GRADE col 17
                    valueUpdates.push({ range: `NSL-ASSESS!R${realAsIdx + 1}`, values: [[fakeAsRow[17]]] });
                    console.log(`  Copy ASSESS Grade: ${fakeAsRow[17]} → row ${realAsIdx+1}`);
                }
                if (fakeAsRow[4] && !realAsRow[4]) { // Profession col 4
                    valueUpdates.push({ range: `NSL-ASSESS!E${realAsIdx + 1}`, values: [[fakeAsRow[4]]] });
                    console.log(`  Copy ASSESS Profession: ${fakeAsRow[4]} → row ${realAsIdx+1}`);
                }
            }
            console.log(`  Delete NSL-ASSESS row ${fakeAsIdx + 1}`);
            deleteRequests.push({
                deleteDimension: { range: { sheetId: asSheetId, dimension: 'ROWS', startIndex: fakeAsIdx, endIndex: fakeAsIdx + 1 } }
            });
        }

        // --- NSL-SKILL ---
        const fakeSkIdx = skRows.findIndex(r => r[1] && r[1].toUpperCase() === fakeIdUp);
        if (fakeSkIdx !== -1) {
            console.log(`  Delete NSL-SKILL row ${fakeSkIdx + 1}`);
            deleteRequests.push({
                deleteDimension: { range: { sheetId: skSheetId, dimension: 'ROWS', startIndex: fakeSkIdx, endIndex: fakeSkIdx + 1 } }
            });
        }
    }

    // Execute value updates first
    if (valueUpdates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data: valueUpdates }
        });
        console.log(`\n✓ Copied ${valueUpdates.length} field(s) to original rows.`);
    }

    // Execute deletions (descending order to avoid row shift issues)
    if (deleteRequests.length > 0) {
        // Sort descending by startIndex to delete from bottom up
        deleteRequests.sort((a, b) => b.deleteDimension.range.startIndex - a.deleteDimension.range.startIndex);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests: deleteRequests }
        });
        console.log(`✓ Deleted ${deleteRequests.length} duplicate row(s).`);
    }

    console.log('\nDone. No other data was touched.');
}
run();
