const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

async function fixData() {
    console.log('Starting data fix...');
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const spreadsheetId = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
    
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'CHECKLIST!A1:Z1000'
    });
    
    const rows = res.data.values;
    if (!rows || rows.length === 0) return console.log('No data');
    
    let headerIndex = rows.findIndex(row => row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
    if (headerIndex === -1) headerIndex = 0;
    
    const headers = rows[headerIndex];
    const idColIdx = headers.findIndex(h => typeof h === 'string' && h.trim().toLowerCase().replace(/\s/g, '') === 'studentid');
    const shortNameColIdx = headers.findIndex(h => typeof h === 'string' && h.trim().toLowerCase().includes('short name'));
    
    console.log('Headers found at row ' + (headerIndex + 1));
    if (idColIdx === -1 || shortNameColIdx === -1) return console.log('Columns not found');
    
    const updates = [];
    
    for (let i = headerIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const studentId = row[idColIdx];
        if (!studentId || typeof studentId !== 'string') continue;
        
        const parts = studentId.split('_');
        if (parts.length >= 3) {
            const given = parts[1];
            const lastPart = parts[parts.length - 1];
            const hasDOB = /\d/.test(lastPart);
            const familyIdx = hasDOB ? parts.length - 2 : parts.length - 1;
            
            if (familyIdx > 1) {
                const family = parts[familyIdx].toUpperCase();
                const shortName = given.charAt(0).toUpperCase() + given.slice(1).toLowerCase() + ' ' + family;
                const currentShortName = row[shortNameColIdx] || '';
                if (currentShortName !== shortName) {
                    console.log('Row ' + (i + 1) + ': ID ' + studentId + ' | Current ShortName: ' + currentShortName + ' -> New ShortName: ' + shortName);
                    const colLetter = String.fromCharCode(65 + shortNameColIdx);
                    updates.push({
                        range: 'CHECKLIST!' + colLetter + (i + 1),
                        values: [[shortName]]
                    });
                }
            }
        }
    }
    
    if (updates.length > 0) {
        console.log('Applying ' + updates.length + ' updates...');
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
        console.log('Update complete.');
    } else {
        console.log('No updates needed.');
    }
}
fixData().catch(console.error);
