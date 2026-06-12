const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    
    // Get sheet metadata for IDs
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    
    const targetSheets = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL'];
    
    let deleteRequests = [];

    for (const sheetName of targetSheets) {
        const sheetId = metaRes.data.sheets.find(s => s.properties.title === sheetName).properties.sheetId;
        
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:Z600` });
        const rows = res.data.values || [];
        
        let indicesToDelete = [];
        
        for (let i = 110; i < rows.length; i++) {
            if (!rows[i]) continue;
            // Column B is index 1
            const studentId = rows[i][1];
            if (studentId) {
                // If it doesn't have 2 dots, it's a fake/appended ID (e.g. ANG_NHI_PHAM_2005)
                const dotCount = (studentId.match(/\./g) || []).length;
                if (dotCount < 2) {
                    indicesToDelete.push(i);
                    console.log(`Will delete row ${i + 1} from ${sheetName}: ${studentId}`);
                }
            }
        }
        
        indicesToDelete.sort((a, b) => b - a); // descending
        for (let idx of indicesToDelete) {
            deleteRequests.push({
                deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
            });
        }
    }

    if (deleteRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { requests: deleteRequests }
        });
        console.log(`Deleted ${deleteRequests.length} rows successfully.`);
    } else {
        console.log('No fake rows found to delete.');
    }
}

run();
