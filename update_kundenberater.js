const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    try {
        // --- 1. UPDATE THAI THAN'S PROFESSION TO VERKÄUFER ---
        console.log("Updating Thai THAN's profession to Verkäufer in NSL-ASSESS and NSL-SKILL...");

        // A. NSL-ASSESS
        const assessRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:Z600' });
        const assessRows = assessRes.data.values || [];
        let asHdrIdx = assessRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
        if (asHdrIdx === -1) asHdrIdx = 5;
        const asHdrs = assessRows[asHdrIdx];
        const asIdCol = asHdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
        const asProfCol = asHdrs.findIndex(h => h && h.trim().toLowerCase() === 'applied professions');

        const asRowIndex = assessRows.findIndex((r, idx) => idx > asHdrIdx && r[asIdCol] === 'ANG_THAI_THAN_2002');
        if (asRowIndex !== -1 && asProfCol !== -1) {
            const colLetter = String.fromCharCode(65 + asProfCol);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `NSL-ASSESS!${colLetter}${asRowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['Verkäufer']] }
            });
            console.log(`Updated NSL-ASSESS row ${asRowIndex + 1} column ${colLetter} to Verkäufer.`);
        }

        // B. NSL-SKILL
        const skillRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A1:CG600' });
        const skillRows = skillRes.data.values || [];
        let skHdrIdx = skillRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
        if (skHdrIdx === -1) skHdrIdx = 5;
        const skHdrs = skillRows[skHdrIdx];
        const skIdCol = skHdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
        const skProfCol = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'applied professions');

        const skRowIndex = skillRows.findIndex((r, idx) => idx > skHdrIdx && r[skIdCol] === 'ANG_THAI_THAN_2002');
        if (skRowIndex !== -1 && skProfCol !== -1) {
            const colLetter = String.fromCharCode(65 + skProfCol);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `NSL-SKILL!${colLetter}${skRowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['Verkäufer']] }
            });
            console.log(`Updated NSL-SKILL row ${skRowIndex + 1} column ${colLetter} to Verkäufer.`);
        }

        // --- 2. APPEND CANDIDATES TO SALES-BAKER-BUTCHER ---
        console.log("\nAppending sales candidates to Sales-Baker-Butcher...");

        // Candidates to append:
        // 1. Phu NGUYEN (ANG_PHU_NGUYEN_2006, folder: 07. PHU NGUYEN)
        // 2. Thai THAN (ANG_THAI_THAN_2002, folder: 11. THAI THAN)
        // 3. Nhi PHAM (ANG_NHI_PHAM_2005, folder: 16. NHI PHAM)
        const salesCandidates = [
            { name: 'Phu NGUYEN', shortName: 'Phu NGUYEN', school: 'ANG', job: 'Verkäufer' },
            { name: 'Than Ngoc Thai', shortName: 'Thai THAN', school: 'ANG', job: 'Verkäufer' },
            { name: 'Nhi PHAM', shortName: 'Nhi PHAM', school: 'ANG', job: 'Verkäufer' }
        ];

        const sbbRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Sales-Baker-Butcher!A1:Z100' });
        const sbbRows = sbbRes.data.values || [];
        
        let sbbHdrIdx = sbbRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentname'));
        if (sbbHdrIdx === -1) sbbHdrIdx = 1; // Default to row 2

        const sbbAppends = [];
        let nextNo = sbbRows.length - sbbHdrIdx;

        for (const cand of salesCandidates) {
            // Check if already in SBB sheet
            const exists = sbbRows.some((r, idx) => idx > sbbHdrIdx && r[1] === cand.name);
            if (exists) {
                console.log(`Candidate ${cand.name} already in Sales-Baker-Butcher sheet, skipping.`);
                continue;
            }

            const row = new Array(7).fill('');
            row[0] = String(nextNo++); // No.
            row[1] = cand.name; // STUDENT NAME
            row[2] = cand.school; // LANGUAGE SCHOOL
            row[3] = cand.shortName; // SHORT NAME
            row[4] = cand.job; // APPLIED JOB
            sbbAppends.push(row);
        }

        if (sbbAppends.length > 0) {
            console.log(`Appending ${sbbAppends.length} rows to Sales-Baker-Butcher...`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sales-Baker-Butcher!A:A',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: sbbAppends }
            });
        }

        console.log('\nSUCCESS: Kundenberater successfully updated and mapped to Sales sheet.');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
