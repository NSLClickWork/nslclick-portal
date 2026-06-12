const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

async function sync() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const spreadsheetId = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
    
    // Get CHECKLIST
    const res1 = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'CHECKLIST!A1:D1000' });
    const checklist = res1.data.values;
    const cHeaderIdx = checklist.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'student id'));
    const cIdIdx = checklist[cHeaderIdx].findIndex(h => typeof h === 'string' && h.trim().toLowerCase() === 'student id');
    const cNameIdx = checklist[cHeaderIdx].findIndex(h => typeof h === 'string' && h.trim().toLowerCase().includes('student name'));
    
    // Get NSL-ASSESS
    const res2 = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'NSL-ASSESS!A1:Z1000' });
    const assess = res2.data.values;
    const aHeaderIdx = assess.findIndex(row => row && row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'student id'));
    const aIdIdx = assess[aHeaderIdx].findIndex(h => typeof h === 'string' && h.trim().toLowerCase() === 'student id');
    const aNameIdx = assess[aHeaderIdx].findIndex(h => typeof h === 'string' && h.trim().toLowerCase() === 'student name');
    const aVoucherIdx = assess[aHeaderIdx].findIndex(h => typeof h === 'string' && h.trim().toLowerCase() === 'ac voucher code');
    
    const updates = [];
    
    for(let i = aHeaderIdx + 1; i < assess.length; i++) {
        const aRow = assess[i];
        if(!aRow || aRow.length < 3) continue;
        const aName = aRow[aNameIdx];
        const aId = aRow[aIdIdx];
        if(!aName) continue;
        
        // Find by name in CHECKLIST
        const cRow = checklist.find(c => c && c[cNameIdx] && c[cNameIdx].trim().toLowerCase() === aName.trim().toLowerCase());
        if(cRow) {
            const correctId = cRow[cIdIdx];
            if(correctId && correctId !== aId) {
                console.log('Fixing ' + aName + ': ' + aId + ' -> ' + correctId);
                
                if (aIdIdx !== -1) {
                    updates.push({
                        range: 'NSL-ASSESS!' + String.fromCharCode(65 + aIdIdx) + (i + 1),
                        values: [[correctId]]
                    });
                }
                
                if (aVoucherIdx !== -1) {
                    const currentVoucher = aRow[aVoucherIdx] || '';
                    // Update voucher if it matches the old ID or is empty
                    if (currentVoucher === aId || currentVoucher === '') {
                        updates.push({
                            range: 'NSL-ASSESS!' + String.fromCharCode(65 + aVoucherIdx) + (i + 1),
                            values: [[correctId]]
                        });
                    }
                }
            }
        }
    }
    
    if (updates.length > 0) {
        console.log('Applying ' + updates.length + ' updates...');
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
        });
        console.log('Update complete.');
    } else {
        console.log('No updates needed.');
    }
}
sync().catch(console.error);
