const fs = require('fs');
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
require('dotenv').config();

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
const JSON_FILE = 'extracted_candidates.json';

// Helper to normalize strings for comparison
function norm(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/đ/g, 'd')
              .replace(/[^a-z0-9]/g, '');
}

// Helper to format short name
function getShortName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 2) {
        // If the second word is all uppercase (like NGUYEN), it's already a short name in Western style
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

async function run() {
    if (!fs.existsSync(JSON_FILE)) {
        console.error('Extracted JSON file not found!');
        return;
    }

    const candidates = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    console.log(`Loaded ${candidates.length} candidates from JSON.`);

    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    try {
        // 1. Fetch current data from CHECKLIST to check duplicates
        console.log('Fetching CHECKLIST sheet...');
        const clRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A1:Z600'
        });
        const clRows = clRes.data.values || [];
        
        let clHdrIdx = clRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
        if (clHdrIdx === -1) clHdrIdx = 2; // Default to row 3 (0-indexed 2)
        const clHdrs = clRows[clHdrIdx] || [];
        
        const clIdCol = clHdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
        const clNameCol = clHdrs.findIndex(h => h && h.trim().toLowerCase() === 'student name');
        
        // Build map of existing candidates
        const existingIds = new Set();
        const existingNames = new Set();
        
        for (let i = clHdrIdx + 1; i < clRows.length; i++) {
            const row = clRows[i];
            if (!row) continue;
            if (clIdCol !== -1 && row[clIdCol]) existingIds.add(row[clIdCol].trim().toUpperCase());
            if (clNameCol !== -1 && row[clNameCol]) existingNames.add(norm(row[clNameCol]));
        }

        // 2. Fetch headers for other sheets
        console.log('Fetching headers for NSL-ASSESS, NSL-SKILL, and HDEU...');
        const assessRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:Z10' });
        const assessRows = assessRes.data.values || [];
        let asHdrIdx = assessRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
        if (asHdrIdx === -1) asHdrIdx = 5;
        const asHdrs = assessRows[asHdrIdx];

        const skillRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A1:CG10' });
        const skillRows = skillRes.data.values || [];
        let skHdrIdx = skillRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
        if (skHdrIdx === -1) skHdrIdx = 5;
        const skHdrs = skillRows[skHdrIdx];

        const hdeuRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'HDEU!A1:Z10' });
        const hdeuRows = hdeuRes.data.values || [];
        let hdHdrIdx = hdeuRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentname'));
        if (hdHdrIdx === -1) hdHdrIdx = 2;
        const hdHdrs = hdeuRows[hdHdrIdx];

        // Prepare append data arrays
        const clAppends = [];
        const asAppends = [];
        const skAppends = [];
        const hdAppends = [];

        // Track next numeric counter (No.) for CHECKLIST
        let nextClNo = clRows.length - clHdrIdx;
        let nextHdNo = hdeuRows.length - hdHdrIdx;

        for (const candidate of candidates) {
            // Determine CenterCode
            let centerCode = 'ANG';
            if (candidate.folderName.includes('HDEU')) {
                centerCode = 'HDEU';
            } else if (candidate.folderName.includes('EI')) {
                centerCode = 'EI';
            }

            // Short Name
            const shortName = getShortName(candidate.Name);
            
            // Birthday and Year of Birth
            const birthYear = candidate.BirthYear || '2000';
            const dob = `01/01/${birthYear}`;
            
            // StudentID format: [CenterCode]_[ShortName_with_underscore]_[DOB_with_dots]
            const dobDots = `01.01.${birthYear}`;
            const studentId = `${centerCode}_${shortName.replace(/\s+/g, '_')}_${dobDots}`.toUpperCase();

            // Check if already exists
            if (existingIds.has(studentId) || existingNames.has(norm(candidate.Name))) {
                console.log(`Skipping existing candidate: ${candidate.Name} (${studentId})`);
                continue;
            }

            console.log(`Processing new candidate: ${candidate.Name} -> ID: ${studentId}`);
            
            // 1. CHECKLIST row
            // Range A:BH has 60 columns. Let's build a row of 60 columns
            const clRow = new Array(60).fill('');
            clRow[0] = String(nextClNo++); // No.
            clRow[1] = studentId; // Student ID
            clRow[2] = candidate.Name; // Student Name
            clRow[3] = shortName; // Short Name
            clRow[4] = centerCode; // Language School
            clRow[6] = 'TRUE'; // Assessment Test
            clRow[7] = 'TRUE'; // Assessment Result
            clRow[17] = 'FALSE'; // B1 Certificate (defaults to FALSE since it's checklist)
            clRow[27] = candidate.pdfLink; // Candidate Cards (Col AB)
            clRow[52] = candidate.S1 || ''; // Superpower 1 (Col BA)
            clRow[53] = candidate.S2 || ''; // Superpower 2 (Col BB)
            clRow[54] = candidate.S3 || ''; // Superpower 3 (Col BC)
            clRow[55] = candidate.Avail || ''; // Availability (Col BD)
            clRow[56] = candidate.photoLink || ''; // Photo (Col BE)
            clRow[58] = candidate.videoLink || ''; // Introduction Video (Col BG)
            clAppends.push(clRow);

            // 2. NSL-ASSESS row
            // Headers: Col 0: NO. | Col 1: STUDENT ID | Col 2: STUDENT NAME | Col 3: CATEGORY | Col 4: APPLIED PROFESSIONS | Col 5: APPLIED INTAKE | Col 6: LANGUAGE SCHOOL | Col 7: TEST LOCATION | Col 8: CURRENT GERMAN LEVEL ... Col 16: NSL SCORE | Col 17: NSL GRADE
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
            // Col 1: STUDENT ID | Col 2: STUDENT NAME | Col 3: TEN KHONG DAU | Col 9: SHORT NAME | Col 10: CATEGORY | Col 13: APPLIED PROFESSIONS | Col 18: INTRODUCTION VIDEO | Col 21: LANGUAGE SCHOOL | Col 25: BIRTHDAY | Col 26: AGE | Col 31: B1 STATUS | Col 54: NSL SCORE | Col 55: NSL GRADE | Col 63: SUPERPOWERS (DE) | Col 67: PROFILE PICTURE | Col 79: CANDIDATE CARD | Col 80: VIDEO
            const skRow = new Array(85).fill('');
            skRow[1] = studentId;
            skRow[2] = candidate.Name;
            // TEN KHONG DAU (Name without accent)
            skRow[3] = candidate.Name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
            skRow[9] = shortName;
            skRow[10] = 'SKILL CENTRE';
            skRow[13] = candidate.Profession || '';
            skRow[18] = candidate.videoLink || '';
            skRow[21] = centerCode;
            skRow[25] = dob; // BIRTHDAY
            skRow[26] = String(2026 - parseInt(birthYear)); // AGE
            skRow[31] = candidate.Level || 'B1'; // B1 STATUS
            skRow[54] = candidate.Score || '';
            skRow[55] = candidate.Grade || getGradeFromScore(candidate.Score);
            skRow[63] = [candidate.S1, candidate.S2, candidate.S3].filter(Boolean).join(', '); // SUPERPOWERS (DE)
            skRow[67] = candidate.photoLink || ''; // PROFILE PICTURE
            skRow[79] = candidate.pdfLink || ''; // CANDIDATE CARD
            skRow[80] = candidate.videoLink || ''; // VIDEO
            skAppends.push(skRow);

            // 4. HDEU row (Only if HDEU)
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

        // Write to sheets
        if (clAppends.length > 0) {
            console.log(`Appending ${clAppends.length} rows to CHECKLIST...`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'CHECKLIST!A:A',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: clAppends }
            });
        }

        if (asAppends.length > 0) {
            console.log(`Appending ${asAppends.length} rows to NSL-ASSESS...`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'NSL-ASSESS!B:B',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: asAppends }
            });
        }

        if (skAppends.length > 0) {
            console.log(`Appending ${skAppends.length} rows to NSL-SKILL...`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'NSL-SKILL!B:B',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: skAppends }
            });
        }

        if (hdAppends.length > 0) {
            console.log(`Appending ${hdAppends.length} rows to HDEU...`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'HDEU!A:A',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: hdAppends }
            });
        }

        console.log('\nSUCCESS: All new candidates imported successfully!');
    } catch (err) {
        console.error('Error writing to Google Sheets:', err.message);
    }
}

run();
