const fs = require('fs');
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
require('dotenv').config();

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
const JSON_FILE = 'extracted_candidates.json';

// Helper to format short name
function getShortName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 2) {
        if (parts[1] === parts[1].toUpperCase() || parts[0] === parts[0].toUpperCase()) {
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() + ' ' + parts[1].toUpperCase();
        }
    }
    if (parts.length >= 2) {
        const ho = parts[0].toUpperCase();
        const ten = parts[parts.length - 1];
        return ten.charAt(0).toUpperCase() + ten.slice(1).toLowerCase() + ' ' + ho;
    }
    return fullName;
}

// Calculate grade from score
function getGradeFromScore(score) {
    const s = parseInt(score) || 0;
    if (s >= 85) return 'A';
    if (s >= 75) return 'B';
    if (s >= 65) return 'C';
    if (s >= 55) return 'D';
    return 'E';
}

// List of candidate names we added
const addedNames = [
    'Phuong NGUYEN', 'Khoa NGUYEN', 'Quynh TRAN', 'Linh LE', 
    'Phu NGUYEN', 'Long DOAN', 'Binh Duong', 'Hoang TRAN', 
    'Thai THAN', 'Thai NGO', 'Thi NGUYEN', 'Huyen PHAM', 
    'Trang BUI', 'Nhi PHAM'
];

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    try {
        // --- 1. REVERT PREVIOUS ENTRIES ---
        console.log('Reverting previous entries from sheets...');

        const sheetNames = ['CHECKLIST', 'NSL-ASSESS', 'NSL-SKILL', 'HDEU'];
        
        for (const name of sheetNames) {
            console.log(`Processing revert for sheet: ${name}...`);
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:Z600` // Read first 26 columns
            });
            const rows = res.data.values || [];
            
            // Find header row index
            let headerIdx = rows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
            if (headerIdx === -1) {
                headerIdx = rows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentname'));
            }
            if (headerIdx === -1) headerIdx = 2; // Default to row 3 (0-indexed 2)

            const hdrs = rows[headerIdx] || [];
            const idColIdx = hdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
            const nameColIdx = hdrs.findIndex(h => h && (h.trim().toLowerCase() === 'student name' || h.trim().toLowerCase() === 'studentname'));

            // Keep header rows, and filter out rows where Student ID or Name matches our added ones
            const headerRows = rows.slice(0, headerIdx + 1);
            const dataRows = rows.slice(headerIdx + 1);

            const filteredDataRows = dataRows.filter(row => {
                if (!row || row.length === 0) return false;
                
                const idVal = idColIdx !== -1 ? (row[idColIdx] || '').trim().toUpperCase() : '';
                const nameVal = nameColIdx !== -1 ? (row[nameColIdx] || '').trim().toLowerCase() : '';

                // If StudentID has 01.01.2000 or 01.01.Year, or name matches our added list
                const isAddedId = idVal.includes('_01.01.');
                const isAddedName = addedNames.some(n => nameVal === n.toLowerCase() || nameVal.includes(n.toLowerCase()));

                return !(isAddedId || isAddedName);
            });

            // Adjust 'No' column (index 0) if applicable
            let noCounter = 1;
            filteredDataRows.forEach(row => {
                if (row.length > 0 && name === 'CHECKLIST') {
                    row[0] = String(noCounter++);
                }
            });

            const updatedRows = [...headerRows, ...filteredDataRows];

            // Clear the sheet
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1:ZZ600`
            });

            // Write the filtered rows back
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${name}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: updatedRows }
            });
            console.log(`Reverted sheet ${name}. Good rows written: ${updatedRows.length}`);
        }

        // --- 2. RE-IMPORT WITH BLANK BIRTHDAY ---
        console.log('\n--- Re-importing candidates without birthday... ---');
        
        if (!fs.existsSync(JSON_FILE)) {
            console.error('Extracted JSON file not found!');
            return;
        }

        const candidates = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
        
        // Fetch current states of sheets again (after revert)
        const clRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:Z600' });
        const clRows = clRes.data.values || [];
        let clHdrIdx = clRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
        if (clHdrIdx === -1) clHdrIdx = 2;

        const hdeuRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'HDEU!A1:Z10' });
        const hdeuRows = hdeuRes.data.values || [];
        let hdHdrIdx = hdeuRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentname'));
        if (hdHdrIdx === -1) hdHdrIdx = 2;

        const clAppends = [];
        const asAppends = [];
        const skAppends = [];
        const hdAppends = [];

        let nextClNo = clRows.length - clHdrIdx;
        let nextHdNo = hdeuRows.length - hdHdrIdx;

        for (const candidate of candidates) {
            let centerCode = 'ANG';
            if (candidate.folderName.includes('HDEU')) {
                centerCode = 'HDEU';
            } else if (candidate.folderName.includes('EI')) {
                centerCode = 'EI';
            }

            const shortName = getShortName(candidate.Name);
            const birthYear = candidate.BirthYear || '2000';
            
            // StudentID format: [CenterCode]_[ShortName]_[BirthYear]
            const studentId = `${centerCode}_${shortName.replace(/\s+/g, '_')}_${birthYear}`.toUpperCase();

            console.log(`Formatting: ${candidate.Name} -> ID: ${studentId}`);

            // 1. CHECKLIST row
            const clRow = new Array(60).fill('');
            clRow[0] = String(nextClNo++); // No
            clRow[1] = studentId; // Student ID
            clRow[2] = candidate.Name; // Student Name
            clRow[3] = shortName; // Short Name
            clRow[4] = centerCode; // Language School
            clRow[6] = 'TRUE'; // Assessment Test
            clRow[7] = 'TRUE'; // Assessment Result
            clRow[17] = 'FALSE'; // B1 Certificate
            clRow[27] = candidate.pdfLink; // Candidate Cards
            clRow[52] = candidate.S1 || ''; // Superpower 1
            clRow[53] = candidate.S2 || ''; // Superpower 2
            clRow[54] = candidate.S3 || ''; // Superpower 3
            clRow[55] = candidate.Avail || ''; // Availability
            clRow[56] = candidate.photoLink || ''; // Photo
            clRow[58] = candidate.videoLink || ''; // Introduction Video
            clAppends.push(clRow);

            // 2. NSL-ASSESS row
            const asRow = new Array(25).fill('');
            asRow[1] = studentId;
            asRow[2] = candidate.Name;
            asRow[3] = 'LANGUAGE SCHOOL';
            asRow[4] = candidate.Profession || '';
            asRow[6] = centerCode;
            asRow[8] = candidate.Level || 'B1';
            asRow[16] = candidate.Score || '';
            asRow[17] = candidate.Grade || getGradeFromScore(candidate.Score);
            asAppends.push(asRow);

            // 3. NSL-SKILL row
            const skRow = new Array(85).fill('');
            skRow[1] = studentId;
            skRow[2] = candidate.Name;
            skRow[3] = candidate.Name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
            skRow[9] = shortName;
            skRow[10] = 'SKILL CENTRE';
            skRow[13] = candidate.Profession || '';
            skRow[18] = candidate.videoLink || '';
            skRow[21] = centerCode;
            skRow[25] = ''; // BIRTHDAY - LEFT COMPLETELY EMPTY AS REQUESTED
            skRow[26] = String(2026 - parseInt(birthYear)); // AGE
            skRow[31] = candidate.Level || 'B1';
            skRow[54] = candidate.Score || '';
            skRow[55] = candidate.Grade || getGradeFromScore(candidate.Score);
            skRow[63] = [candidate.S1, candidate.S2, candidate.S3].filter(Boolean).join(', '); // SUPERPOWERS (DE)
            skRow[67] = candidate.photoLink || '';
            skRow[79] = candidate.pdfLink || '';
            skRow[80] = candidate.videoLink || '';
            skAppends.push(skRow);

            // 4. HDEU row (Only HDEU)
            if (centerCode === 'HDEU') {
                const hdRow = new Array(15).fill('');
                hdRow[0] = String(nextHdNo++); // NO.
                hdRow[1] = candidate.Name; // STUDENT NAME
                hdRow[2] = shortName; // SHORT NAME
                hdRow[3] = 'TRUE'; // ASSESSMENT TEST
                hdRow[9] = 'TRUE'; // VIDEO RECORDING
                hdRow[10] = candidate.Level || 'B1'; // CERTIFICATE
                hdAppends.push(hdRow);
            }
        }

        // Appending to sheets
        if (clAppends.length > 0) {
            await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A:A', valueInputOption: 'USER_ENTERED', requestBody: { values: clAppends } });
        }
        if (asAppends.length > 0) {
            await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!B:B', valueInputOption: 'USER_ENTERED', requestBody: { values: asAppends } });
        }
        if (skAppends.length > 0) {
            await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!B:B', valueInputOption: 'USER_ENTERED', requestBody: { values: skAppends } });
        }
        if (hdAppends.length > 0) {
            await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'HDEU!A:A', valueInputOption: 'USER_ENTERED', requestBody: { values: hdAppends } });
        }

        console.log('\nSUCCESS: Reverted and successfully imported with blank birthdays and updated IDs.');
    } catch (err) {
        console.error('Error during revert & import:', err.message);
    }
}

run();
