const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        console.log('Reading NSL-ASSESS sheet...');
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-ASSESS!A1:Z600'
        });
        const rows = res.data.values || [];
        
        // Find row to remove
        const updatedRows = rows.filter(row => {
            if (!row || row.length < 2) return true;
            return row[1] !== 'ANG__NEW';
        });

        if (rows.length === updatedRows.length) {
            console.log('ANG__NEW not found or already deleted.');
            return;
        }

        console.log(`Deleting ANG__NEW... Clearing sheet and writing back ${updatedRows.length} rows.`);
        
        // Clear range
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-ASSESS!A1:ZZ600'
        });

        // Write back
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-ASSESS!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: updatedRows
            }
        });
        
        console.log('Corrupted row ANG__NEW removed successfully!');
    } catch (e) {
        console.error('Error removing corrupted row:', e.message);
    }
}

run();
