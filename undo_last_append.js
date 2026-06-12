const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        console.log('Undoing the last safe re-import by clearing the appended rows...');
        
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A124:ZZ135'
        });
        console.log('Cleared CHECKLIST!A124:ZZ135');

        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-ASSESS!A126:ZZ137'
        });
        console.log('Cleared NSL-ASSESS!A126:ZZ137');

        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-SKILL!A126:ZZ137'
        });
        console.log('Cleared NSL-SKILL!A126:ZZ137');

        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'HDEU!A5:ZZ5'
        });
        console.log('Cleared HDEU!A5:ZZ5');

        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sales-Baker-Butcher!A15:ZZ26'
        });
        console.log('Cleared Sales-Baker-Butcher!A15:ZZ26');

        console.log('SUCCESS: Undo completed.');
    } catch (e) {
        console.error('Error during undo:', e.message);
    }
}

run();
