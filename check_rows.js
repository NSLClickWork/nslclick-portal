require('dotenv').config();
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function checkRows() {
    try {
        const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHAT_LOGS!A:G'
        });
        
        console.log('Rows in CHAT_LOGS:', response.data.values);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
checkRows();
