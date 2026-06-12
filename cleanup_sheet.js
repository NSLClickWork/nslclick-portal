const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function cleanup() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    
    try {
        // Read the good rows (128 to 143)
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A128:ZZ143'
        });
        
        const goodRows = res.data.values;
        if (!goodRows) {
            console.log('No good rows found!');
            return;
        }

        // Update the 'No' column (index 0) for the good rows
        // The last good 'No' was 107 at row 111. So new rows start at 108.
        let noCount = 108;
        for (const row of goodRows) {
            if (row.length > 0) {
                row[0] = noCount++;
            }
        }

        // Clear the messy rows (112 to 150)
        console.log('Clearing rows 112 to 150...');
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A112:ZZ150'
        });

        // Write the good rows back starting at row 112
        console.log('Writing good rows back starting at row 112...');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A112',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: goodRows
            }
        });

        console.log('Cleanup completed successfully!');
    } catch (e) {
        console.error('Error during cleanup:', e.message);
    }
}

cleanup();
